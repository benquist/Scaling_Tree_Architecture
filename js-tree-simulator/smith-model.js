function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const UI = {
  nTips: document.getElementById("nTips"),
  nTipsOut: document.getElementById("nTipsOut"),
  dTwig: document.getElementById("dTwig"),
  dTwigOut: document.getElementById("dTwigOut"),
  fMax: document.getElementById("fMax"),
  fMaxOut: document.getElementById("fMaxOut"),
  uParam: document.getElementById("uParam"),
  uParamOut: document.getElementById("uParamOut"),
  safety: document.getElementById("safety"),
  safetyOut: document.getElementById("safetyOut"),
  bConst: document.getElementById("bConst"),
  bConstOut: document.getElementById("bConstOut"),
  l0Factor: document.getElementById("l0Factor"),
  l0FactorOut: document.getElementById("l0FactorOut"),
  seed: document.getElementById("seed"),
  runSingle: document.getElementById("runSingle"),
  minTips: document.getElementById("minTips"),
  maxTips: document.getElementById("maxTips"),
  nClasses: document.getElementById("nClasses"),
  nRep: document.getElementById("nRep"),
  runSweep: document.getElementById("runSweep"),
  treeSvg: document.getElementById("treeSvg"),
  treeMeta: document.getElementById("treeMeta"),
  plotTips: document.getElementById("plotTips"),
  plotBasal: document.getElementById("plotBasal")
};

function syncOutputs() {
  UI.nTipsOut.value = String(Math.round(Number(UI.nTips.value)));
  UI.dTwigOut.value = Number(UI.dTwig.value).toFixed(3);
  UI.fMaxOut.value = String(Math.round(Number(UI.fMax.value)));
  UI.uParamOut.value = Number(UI.uParam.value).toFixed(1);
  UI.safetyOut.value = Number(UI.safety.value).toFixed(1);
  UI.bConstOut.value = Number(UI.bConst.value).toFixed(1);
  UI.l0FactorOut.value = Number(UI.l0Factor.value).toFixed(3);
}

function getParams(seedOffset = 0) {
  return {
    N_t: Math.max(2, Math.round(Number(UI.nTips.value))),
    D_t: Math.max(1e-6, Number(UI.dTwig.value)),
    f_max: Math.max(2, Math.round(Number(UI.fMax.value))),
    u: Number(UI.uParam.value),
    s: Math.max(1e-6, Number(UI.safety.value)),
    b: Math.max(1e-6, Number(UI.bConst.value)),
    l0: Math.max(0, Number(UI.l0Factor.value)),
    seed: Math.max(1, Math.round(Number(UI.seed.value))) + seedOffset
  };
}

function weightedChoice(values, weights, rand) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return values[Math.floor(rand() * values.length)];
  const u = rand() * total;
  let c = 0;
  for (let i = 0; i < values.length; i++) {
    c += weights[i];
    if (u <= c) return values[i];
  }
  return values[values.length - 1];
}

function partitionRank(Rm, f, u, rand) {
  const daughters = new Array(f).fill(0);
  for (let i = 0; i < f - 1; i++) {
    const Ai = i === 0 ? 1 : daughters[i - 1];
    const sumPrev = daughters.slice(0, i).reduce((a, b) => a + b, 0);
    const Rrem = Rm - sumPrev;
    let Zi = Math.floor(Rrem / (f - i));
    if (Zi < Ai) Zi = Ai;

    const cands = [];
    for (let k = Ai; k <= Zi; k++) cands.push(k);

    let pick;
    if (cands.length === 1) {
      pick = cands[0];
    } else {
      let weights;
      if (u <= 0) {
        weights = cands.map(v => Math.pow(v, u));
      } else {
        weights = cands.map(v => Math.pow(Zi - Ai + v, -u));
      }
      weights = weights.map(w => (Number.isFinite(w) && w > 0 ? w : 0));
      if (weights.reduce((a, b) => a + b, 0) <= 0) weights = cands.map(() => 1);
      pick = weightedChoice(cands, weights, rand);
    }
    daughters[i] = pick;
  }

  daughters[f - 1] = Rm - daughters.slice(0, f - 1).reduce((a, b) => a + b, 0);
  return daughters;
}

function buildSmithTree(params) {
  const rand = mulberry32(params.seed >>> 0);
  const segments = [{ id: 1, parent: null, rank: params.N_t, depth: 0, children: [] }];
  let queue = [1];
  let nextId = 1;

  while (queue.length) {
    const sid = queue.shift();
    const seg = segments.find(s => s.id === sid);
    if (!seg || seg.rank <= 1) continue;

    let ranks;
    if (seg.id === 1) {
      // Keep a single non-bifurcating trunk segment before any furcation.
      ranks = [seg.rank];
    } else {
      const fUpper = Math.max(2, Math.min(params.f_max, seg.rank));
      const f = 2 + Math.floor(rand() * (fUpper - 1));
      ranks = partitionRank(seg.rank, f, params.u, rand);
    }

    for (let j = 0; j < ranks.length; j++) {
      nextId += 1;
      const child = {
        id: nextId,
        parent: sid,
        rank: ranks[j],
        depth: seg.depth + 1,
        daughterOrder: j + 1,
        children: []
      };
      segments.push(child);
      seg.children.push(child.id);
      if (child.rank > 1) queue.push(child.id);
    }
  }

  const byId = new Map(segments.map(s => [s.id, s]));
  const Lstar = D => (params.b / params.s) * Math.pow(D, 2 / 3) - params.l0 * (params.b / params.s) * Math.pow(params.D_t, 2 / 3);

  for (const seg of segments) {
    seg.diameter = params.D_t * Math.sqrt(seg.rank);
  }

  const depthSorted = [...segments].sort((a, b) => b.depth - a.depth);
  for (const seg of depthSorted) {
    if (!seg.children.length) {
      seg.length = Math.max(Lstar(seg.diameter), 1e-8);
      seg.isTerminal = true;
    } else {
      const maxChildD = Math.max(...seg.children.map(cid => byId.get(cid).diameter));
      seg.length = Math.max(Lstar(seg.diameter) - Lstar(maxChildD), 1e-8);
      seg.isTerminal = false;
    }
  }

  const asc = [...segments].sort((a, b) => a.depth - b.depth);
  for (const seg of asc) {
    if (seg.parent === null) {
      seg.pathFromBase = seg.length;
    } else {
      seg.pathFromBase = byId.get(seg.parent).pathFromBase + seg.length;
    }
  }

  const tips = segments.filter(s => s.isTerminal);
  const totalNetworkPathLength = tips.reduce((acc, s) => acc + s.pathFromBase, 0);
  const pathFraction = tips.length ? (tips.reduce((acc, s) => acc + s.pathFromBase, 0) / tips.length) / Math.max(...tips.map(t => t.pathFromBase)) : 0;

  return {
    segments,
    tips,
    basalDiameter: byId.get(1).diameter,
    totalNetworkPathLength,
    meanPathLength: totalNetworkPathLength / Math.max(tips.length, 1),
    maxPathLength: tips.length ? Math.max(...tips.map(t => t.pathFromBase)) : 0,
    pathFraction
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function interp(u, uMin, uMax, yMin, yMax) {
  const uu = clamp(u, uMin, uMax);
  return yMin + (uu - uMin) * (yMax - yMin) / (uMax - uMin);
}

function computeTreeLayout(tree, u, seed) {
  const rand = mulberry32(seed >>> 0);
  const byId = new Map(tree.segments.map(s => [s.id, s]));
  const crownSpread = interp(u, -5, 5, 0.55, 1.25);
  const branchSpread = interp(u, -5, 5, Math.PI / 5.5, Math.PI / 2.6);
  const jitter = interp(u, -5, 5, 0.055, 0.16);

  const root = byId.get(1);
  root._x0 = 0;
  root._y0 = 0;
  root._angle = Math.PI / 2;
  root._x1 = root._x0 + root.length * Math.cos(root._angle);
  root._y1 = root._y0 + root.length * Math.sin(root._angle);

  const queue = [1];
  while (queue.length) {
    const sid = queue.shift();
    const parent = byId.get(sid);
    const kids = parent.children.map(cid => byId.get(cid));
    if (!kids.length) continue;

    const sorted = kids.sort((a, b) => a.rank - b.rank);
    const maxRank = Math.max(...sorted.map(k => k.rank));
    const largestIdx = sorted.findIndex(k => k.rank === maxRank);

    for (let i = 0; i < sorted.length; i++) {
      const child = sorted[i];
      const relSize = child.rank / maxRank;
      let offset;
      if (sid === 1 && sorted.length === 1) {
        offset = 0;
      } else if (i === largestIdx) {
        offset = (rand() - 0.5) * 2 * jitter * 0.25;
      } else {
        const side = i % 2 === 0 ? -1 : 1;
        const lateralStrength = Math.pow(1 - relSize, 0.45);
        offset = side * branchSpread * (0.35 + 0.65 * lateralStrength);
        offset += (rand() - 0.5) * 2 * jitter;
      }

      let angle = parent._angle + offset * crownSpread;
      angle = clamp(angle, 0.05, Math.PI - 0.05);

      child._x0 = parent._x1;
      child._y0 = parent._y1;
      child._angle = angle;
      child._x1 = child._x0 + child.length * Math.cos(angle);
      child._y1 = child._y0 + child.length * Math.sin(angle);
      queue.push(child.id);
    }
  }

  const xs = tree.segments.flatMap(s => [s._x0, s._x1]).filter(Number.isFinite);
  const ys = tree.segments.flatMap(s => [s._y0, s._y1]).filter(Number.isFinite);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const H = Math.max(1e-9, yMax - yMin);

  for (const seg of tree.segments) {
    seg._x0 /= H;
    seg._x1 /= H;
    seg._y0 = (seg._y0 - yMin) / H;
    seg._y1 = (seg._y1 - yMin) / H;
  }

  return tree;
}

function drawTree(tree, params) {
  const svg = UI.treeSvg;
  svg.innerHTML = "";

  computeTreeLayout(tree, params.u, params.seed + 1000);

  const W = 900;
  const H = 520;
  const pad = 20;
  const xVals = tree.segments.flatMap(s => [s._x0, s._x1]);
  const yVals = tree.segments.flatMap(s => [s._y0, s._y1]);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals);

  const sx = x => pad + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (W - 2 * pad);
  const sy = y => H - (pad + ((y - yMin) / Math.max(1e-9, yMax - yMin)) * (H - 2 * pad));

  const byId = new Map(tree.segments.map(s => [s.id, s]));
  const maxD = Math.max(...tree.segments.map(s => s.diameter));

  const drawOrder = [...tree.segments].filter(s => s.parent !== null).sort((a, b) => b.diameter - a.diameter);

  for (const seg of drawOrder) {
    const p = byId.get(seg.parent);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", sx(seg._x0));
    line.setAttribute("y1", sy(seg._y0));
    line.setAttribute("x2", sx(seg._x1));
    line.setAttribute("y2", sy(seg._y1));
    line.setAttribute("stroke", seg.rank <= 4 ? "#4a4a4a" : "#111111");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-width", Math.max(0.15, 7 * Math.pow(seg.diameter / maxD, 0.75)));
    svg.appendChild(line);
  }

  UI.treeMeta.textContent = [
    `tips=${tree.tips.length}`,
    `u=${params.u.toFixed(2)}`,
    `P_f=${tree.pathFraction.toFixed(2)}`,
    `basal diameter=${tree.basalDiameter.toFixed(4)}`,
    `total path length=${tree.totalNetworkPathLength.toFixed(4)}`,
    `mean path=${tree.meanPathLength.toFixed(4)}`,
    `max path=${tree.maxPathLength.toFixed(4)}`
  ].join("  |  ");
}

function geometricClasses(minVal, maxVal, n) {
  const mn = Math.max(2, Math.round(minVal));
  const mx = Math.max(mn, Math.round(maxVal));
  const k = Math.max(2, Math.round(n));
  const out = [];
  for (let i = 0; i < k; i++) {
    const t = i / (k - 1);
    out.push(Math.round(mn * Math.pow(mx / mn, t)));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function fitLogSlope(xs, ys) {
  const pts = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > 0 && ys[i] > 0 && Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      pts.push({ x: Math.log10(xs[i]), y: Math.log10(ys[i]) });
    }
  }
  if (pts.length < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let sxx = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx <= 1e-12) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

function drawScatter(canvas, rows, xKey, yKey, title, xLabel, yLabel) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pts = rows.filter(r => r[xKey] > 0 && r[yKey] > 0).map(r => ({
    lx: Math.log10(r[xKey]),
    ly: Math.log10(r[yKey]),
    cls: r.classIdx
  }));
  if (pts.length < 3) return;

  const pad = { l: 52, r: 14, t: 24, b: 34 };
  const W = canvas.width, H = canvas.height;
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;

  const xMin = Math.min(...pts.map(p => p.lx));
  const xMax = Math.max(...pts.map(p => p.lx));
  const yMin = Math.min(...pts.map(p => p.ly));
  const yMax = Math.max(...pts.map(p => p.ly));
  const sx = x => pad.l + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * w;
  const sy = y => pad.t + h - ((y - yMin) / Math.max(1e-9, yMax - yMin)) * h;

  ctx.strokeStyle = "#314248";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + h);
  ctx.lineTo(pad.l + w, pad.t + h);
  ctx.stroke();

  const palette = ["#176f5d", "#2e8a75", "#3fa88f", "#4f74b8", "#7a4eb8", "#b84e6a", "#cf7d4f", "#5a8c3d"];
  for (const p of pts) {
    ctx.beginPath();
    ctx.fillStyle = palette[p.cls % palette.length] + "cc";
    ctx.arc(sx(p.lx), sy(p.ly), 3.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const fit = fitLogSlope(rows.map(r => r[xKey]), rows.map(r => r[yKey]));
  if (fit) {
    ctx.strokeStyle = "#b43131";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(sx(xMin), sy(fit.intercept + fit.slope * xMin));
    ctx.lineTo(sx(xMax), sy(fit.intercept + fit.slope * xMax));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#b43131";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`slope = ${fit.slope.toFixed(3)}`, pad.l + 8, pad.t + 14);
  }

  ctx.fillStyle = "#17242a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(title, pad.l + 4, 14);

  ctx.fillStyle = "#314248";
  ctx.font = "10px sans-serif";
  const xW = ctx.measureText(xLabel).width;
  ctx.fillText(xLabel, pad.l + w / 2 - xW / 2, H - 8);
  ctx.save();
  ctx.translate(14, pad.t + h / 2 + 15);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function runSingleTree() {
  const params = getParams(0);
  const tree = buildSmithTree(params);
  drawTree(tree, params);
}

function runSweep() {
  const minTips = Math.max(2, Math.round(Number(UI.minTips.value)));
  const maxTips = Math.max(minTips, Math.round(Number(UI.maxTips.value)));
  const nClasses = Math.max(2, Math.round(Number(UI.nClasses.value)));
  const nRep = Math.max(1, Math.round(Number(UI.nRep.value)));
  const classes = geometricClasses(minTips, maxTips, nClasses);

  const rows = [];
  classes.forEach((nt, classIdx) => {
    for (let rep = 0; rep < nRep; rep++) {
      const p = getParams(classIdx * 1000 + rep * 17);
      p.N_t = nt;
      const tr = buildSmithTree(p);
      rows.push({
        classIdx,
        targetNTips: nt,
        realizedNTips: tr.tips.length,
        basalDiameter: tr.basalDiameter,
        totalPathLength: tr.totalNetworkPathLength
      });
    }
  });

  drawScatter(
    UI.plotTips,
    rows,
    "realizedNTips",
    "totalPathLength",
    "Total network path length vs tip count",
    "log10(tip count)",
    "log10(total network path length)"
  );

  drawScatter(
    UI.plotBasal,
    rows,
    "basalDiameter",
    "totalPathLength",
    "Total network path length vs basal diameter",
    "log10(basal diameter)",
    "log10(total network path length)"
  );
}

[UI.nTips, UI.dTwig, UI.fMax, UI.uParam, UI.safety, UI.bConst, UI.l0Factor].forEach(el => {
  el.addEventListener("input", syncOutputs);
});

UI.runSingle.addEventListener("click", runSingleTree);
UI.runSweep.addEventListener("click", runSweep);

syncOutputs();
runSingleTree();
runSweep();
