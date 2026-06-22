const ui = {
  furcation: document.getElementById("furcation"),
  aRatio: document.getElementById("aRatio"),
  bRatio: document.getElementById("bRatio"),
  pathFraction: document.getElementById("pathFraction"),
  asymStrength: document.getElementById("asymStrength"),
  maxOrder: document.getElementById("maxOrder"),
  scaleMode: document.getElementById("scaleMode"),
  diagText: document.getElementById("diagText"),
  treeSvg: document.getElementById("treeSvg"),
  scalingCanvas: document.getElementById("scalingCanvas"),
  leavesDiameterCanvas: document.getElementById("leavesDiameterCanvas"),
  leavesVolumeCanvas: document.getElementById("leavesVolumeCanvas"),
  treeComparison: document.getElementById("treeComparison")
};

const outputs = {
  furcation: document.querySelector('output[for="furcation"]'),
  aRatio: document.querySelector('output[for="aRatio"]'),
  bRatio: document.querySelector('output[for="bRatio"]'),
  pathFraction: document.querySelector('output[for="pathFraction"]'),
  asymStrength: document.querySelector('output[for="asymStrength"]'),
  maxOrder: document.querySelector('output[for="maxOrder"]')
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeWeights(n, pathFraction, asymStrength) {
  const base = [pathFraction, ...Array(n - 1).fill((1 - pathFraction) / (n - 1))];
  const sym = Array(n).fill(1 / n);
  const w = base.map((v, i) => (1 - asymStrength) * sym[i] + asymStrength * v);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map(v => v / sum);
}

function simulateTree(params, orderCap, seedOffset = 0) {
  const random = rng(1234 + seedOffset);
  const nodes = [{ id: 1, x: 0, y: 0, order: 0 }];
  const edges = [];
  let nodeId = 1;

  function grow(parentId, px, py, order, parentAngle, segLength, segRadius) {
    if (order > orderCap) return;
    const n = params.furcation;
    const weights = makeWeights(n, params.pathFraction, params.asymStrength);

    const minA = parentAngle - 35;
    const maxA = parentAngle + 35;

    for (let i = 0; i < n; i += 1) {
      if (order === 1 && i > 0) continue;

      const baseAngle = n === 1 ? parentAngle : minA + ((maxA - minA) * i) / (n - 1);
      const jitter = (random() - 0.5) * 8;
      const angle = baseAngle + jitter;
      const shareCentered = (weights[i] - (1 / n)) * n;
      const lengthMult = Math.max(0.2, 1 + 0.35 * shareCentered);
      const radiusMult = Math.max(0.2, 1 + 0.25 * shareCentered);

      const length = Math.max(1e-4, segLength * params.a * lengthMult);
      const radius = Math.max(1e-4, segRadius * params.b * radiusMult);
      const rad = (angle * Math.PI) / 180;
      const x = px + length * Math.cos(rad);
      const y = py + length * Math.sin(rad);

      nodeId += 1;
      nodes.push({ id: nodeId, x, y, order });
      edges.push({ from: parentId, to: nodeId, order, child: i + 1, length, radius, isMain: i === 0 });

      grow(nodeId, x, y, order + 1, angle, length, radius);
    }
  }

  grow(1, 0, 0, 1, 90, 1, 0.1);
  return { nodes, edges };
}

function metrics(tree) {
  const parentSet = new Set(tree.edges.map(e => e.from));
  const childSet = new Set(tree.edges.map(e => e.to));
  const tipNodes = [...childSet].filter(n => !parentSet.has(n));

  const byFrom = new Map();
  tree.edges.forEach(e => {
    if (!byFrom.has(e.from)) byFrom.set(e.from, []);
    byFrom.get(e.from).push(e);
  });

  const paths = [];
  function walk(node, pathLen = 0, pathRes = 0) {
    const kids = byFrom.get(node) || [];
    if (kids.length === 0) {
      paths.push({ node, pathLen, pathRes });
      return;
    }
    kids.forEach(e => walk(e.to, pathLen + e.length, pathRes + e.length / Math.pow(e.radius, 4)));
  }
  walk(1);

  const stemVol = tree.edges.reduce((acc, e) => acc + Math.PI * e.radius * e.radius * e.length, 0);
  const kProxy = tree.edges.reduce((acc, e) => acc + Math.pow(e.radius, 4) / e.length, 0);
  const terminalEdges = tree.edges.filter(e => tipNodes.includes(e.to));
  const terminalArea = terminalEdges.reduce((acc, e) => acc + Math.PI * e.radius * e.radius, 0);
  // Effective basal diameter from distal conducting area (pipe-model style).
  const terminalEquivalentDiameter = terminalArea > 0 ? (2 * Math.sqrt(terminalArea / Math.PI)) : NaN;

  return {
    nTips: tipNodes.length,
    mProxy: stemVol,
    kProxy,
    terminalEquivalentDiameter,
    maxPath: Math.max(...paths.map(p => p.pathLen), 0)
  };
}

function fitSlope(points, useLog = true) {
  const valid = points.filter(p => p.x > 0 && p.y > 0);
  const xs = valid.map(p => useLog ? Math.log(p.x) : p.x);
  const ys = valid.map(p => useLog ? Math.log(p.y) : p.y);
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  return num / den;
}

function linearFitXY(points) {
  const valid = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = valid.length;
  if (n < 2) {
    return { slope: NaN, intercept: NaN, r2: NaN };
  }

  const mx = valid.reduce((a, p) => a + p.x, 0) / n;
  const my = valid.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  let sst = 0;
  for (let i = 0; i < n; i += 1) {
    num += (valid[i].x - mx) * (valid[i].y - my);
    den += (valid[i].x - mx) * (valid[i].x - mx);
    sst += (valid[i].y - my) * (valid[i].y - my);
  }

  const slope = den > 0 ? num / den : NaN;
  const intercept = my - slope * mx;

  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const pred = intercept + slope * valid[i].x;
    const err = valid[i].y - pred;
    sse += err * err;
  }

  const r2 = sst > 0 ? 1 - (sse / sst) : NaN;
  return { slope, intercept, r2 };
}

function estimateAsymptoticSlope(pointsByOrder, orderValues, useLog = true) {
  if (!useLog) {
    return {
      asymptoticSlope: NaN,
      finiteSizeBias: NaN,
      series: [],
      fitR2: NaN
    };
  }

  // Finite-size scaling ansatz: beta(m) ~= beta_inf + c / m
  // where m is max branching order included in the fit.
  const sortedOrders = [...new Set(orderValues)].sort((a, b) => a - b);
  // Use minimum order >= 6 to avoid O(1/m) bias in finite-size ansatz
  const minCut = Math.max(6, sortedOrders[Math.floor(sortedOrders.length / 3)]);
  const cutoffs = sortedOrders.filter(m => m >= minCut);

  const slopeFromOrderMeans = function(m) {
    const subset = pointsByOrder.filter(p => p.order <= m && p.x > 0 && p.y > 0);
    if (subset.length < 6) return NaN;

    const byOrder = new Map();
    subset.forEach(p => {
      if (!byOrder.has(p.order)) byOrder.set(p.order, []);
      byOrder.get(p.order).push(p);
    });

    const orderMeans = [];
    for (const [ord, arr] of byOrder.entries()) {
      const lx = arr.reduce((a, d) => a + Math.log(d.x), 0) / arr.length;
      const ly = arr.reduce((a, d) => a + Math.log(d.y), 0) / arr.length;
      orderMeans.push({ x: lx, y: ly, order: ord });
    }

    if (orderMeans.length < 3) return NaN;
    return linearFitXY(orderMeans).slope;
  };

  const slopeSeries = [];
  cutoffs.forEach(m => {
    const betaM = slopeFromOrderMeans(m);
    if (Number.isFinite(betaM)) {
      slopeSeries.push({ x: 1 / m, y: betaM, m });
    }
  });

  if (slopeSeries.length < 3) {
    return {
      asymptoticSlope: NaN,
      finiteSizeBias: NaN,
      series: slopeSeries,
      fitR2: NaN
    };
  }

  const fit = linearFitXY(slopeSeries.map(d => ({ x: d.x, y: d.y })));
  const asymptoticSlope = fit.intercept;
  const largestM = Math.max(...slopeSeries.map(d => d.m));
  const betaLargest = slopeSeries.find(d => d.m === largestM)?.y;

  return {
    asymptoticSlope,
    finiteSizeBias: Number.isFinite(betaLargest) ? (betaLargest - asymptoticSlope) : NaN,
    series: slopeSeries,
    fitR2: fit.r2
  };
}

function theoreticalKvsMExponent(n, a, b) {
  const mu = n * a * b * b;
  const kappa = n * Math.pow(b, 4) / a;

  if (!(mu > 0) || !(kappa > 0) || Math.abs(Math.log(mu)) < 1e-12) return NaN;
  if (mu > 1 && kappa > 1) return Math.log(kappa) / Math.log(mu);
  if (mu > 1 && kappa <= 1) return 0;
  return NaN;
}

function theoreticalLeavesExponents(n, a, b) {
  const mu = n * a * b * b;
  const delta = n * b * b;
  const betaNvsM = (mu > 1 && Math.abs(Math.log(mu)) > 1e-12) ? (Math.log(n) / Math.log(mu)) : NaN;
  const betaNvsDeq = (delta > 0 && Math.abs(Math.log(delta)) > 1e-12) ? (2 * Math.log(n) / Math.log(delta)) : NaN;
  return { betaNvsM, betaNvsDeq };
}

function drawTree(svg, tree, width = 900, height = 420) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  
  if (!tree.nodes || tree.nodes.length === 0) return;
  
  const minX = Math.min(...tree.nodes.map(n => n.x));
  const maxX = Math.max(...tree.nodes.map(n => n.x));
  const minY = Math.min(...tree.nodes.map(n => n.y));
  const maxY = Math.max(...tree.nodes.map(n => n.y));

  const pad = Math.min(20, Math.max(10, width * 0.03));
  const rangeX = Math.max(1e-6, maxX - minX);
  const rangeY = Math.max(1e-6, maxY - minY);
  
  const sx = (x) => pad + ((x - minX) / rangeX) * (width - 2 * pad);
  const sy = (y) => height - (pad + ((y - minY) / rangeY) * (height - 2 * pad));

  tree.edges.forEach(e => {
    const a = tree.nodes.find(n => n.id === e.from);
    const b = tree.nodes.find(n => n.id === e.to);
    if (!a || !b) return;
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", sx(a.x));
    line.setAttribute("y1", sy(a.y));
    line.setAttribute("x2", sx(b.x));
    line.setAttribute("y2", sy(b.y));
    line.setAttribute("stroke", e.isMain ? "#0f766e" : "#64748b");
    line.setAttribute("stroke-width", Math.max(0.5, e.radius * (width / 900) * 18));
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
  });
}

function drawScaling(canvas, points, obsSlope, theoSlope, asymSlope = NaN, useLog = true) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const transformed = points
    .map(p => ({ x: useLog ? Math.log(p.x) : p.x, y: useLog ? Math.log(p.y) : p.y }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xMin = Math.min(...transformed.map(p => p.x));
  const xMax = Math.max(...transformed.map(p => p.x));
  const yMin = Math.min(...transformed.map(p => p.y));
  const yMax = Math.max(...transformed.map(p => p.y));
  const pad = 30;
  const sx = x => pad + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (w - 2 * pad);
  const sy = y => h - (pad + ((y - yMin) / Math.max(1e-9, yMax - yMin)) * (h - 2 * pad));

  ctx.strokeStyle = "#d1d5db";
  ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);

  ctx.fillStyle = "#155e75";
  transformed.forEach(p => {
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const xMid = (xMin + xMax) / 2;
  const yMid = transformed.reduce((a, p) => a + p.y, 0) / transformed.length;

  const drawLine = (slope, color, dashed) => {
    const intercept = yMid - slope * xMid;
    ctx.beginPath();
    if (dashed) ctx.setLineDash([6, 5]); else ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.moveTo(sx(xMin), sy(slope * xMin + intercept));
    ctx.lineTo(sx(xMax), sy(slope * xMax + intercept));
    ctx.stroke();
  };

  drawLine(obsSlope, "#b45309", false);
  drawLine(theoSlope, "#991b1b", true);
  if (Number.isFinite(asymSlope)) {
    drawLine(asymSlope, "#1d4ed8", true);
  }
  ctx.setLineDash([]);

  // Axis labels and units for interpretation.
  ctx.fillStyle = "#334155";
  ctx.font = "12px Avenir Next, sans-serif";
  ctx.textAlign = "center";
  const xAxisLabel = useLog
    ? "x-axis: ln(M_proxy), M_proxy = Σ(pi * r^2 * l) [arbitrary volume units]"
    : "x-axis: M_proxy = Σ(pi * r^2 * l) [arbitrary volume units]";
  ctx.fillText(xAxisLabel, w / 2, h - 8);

  ctx.textAlign = "left";
  ctx.fillStyle = "#b45309";
  ctx.fillText(`Observed slope: ${obsSlope.toFixed(3)}`, 36, 22);
  ctx.fillStyle = "#991b1b";
  ctx.fillText(`Theory slope: ${theoSlope.toFixed(3)}`, 36, 38);
  if (Number.isFinite(asymSlope)) {
    ctx.fillStyle = "#1d4ed8";
    ctx.fillText(`Asymptotic slope (finite-size corrected): ${asymSlope.toFixed(3)}`, 36, 54);
  }

  ctx.save();
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  const yAxisLabel = useLog
    ? "y-axis: ln(K_proxy), K_proxy = Σ(r^4 / l) [arbitrary conductance-proxy units]"
    : "y-axis: K_proxy = Σ(r^4 / l) [arbitrary conductance-proxy units]";
  ctx.fillText(yAxisLabel, 0, 0);
  ctx.restore();
}

function fitLineXY(points) {
  const valid = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = valid.length;
  if (n < 2) {
    return { slope: NaN, intercept: NaN, xMin: NaN, xMax: NaN, yMean: NaN };
  }
  const mx = valid.reduce((a, p) => a + p.x, 0) / n;
  const my = valid.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (valid[i].x - mx) * (valid[i].y - my);
    den += (valid[i].x - mx) * (valid[i].x - mx);
  }
  const slope = den > 0 ? (num / den) : NaN;
  const intercept = my - slope * mx;
  return {
    slope,
    intercept,
    xMin: Math.min(...valid.map(p => p.x)),
    xMax: Math.max(...valid.map(p => p.x)),
    yMean: my
  };
}

function drawLeavesScatter(canvas, points, title, xLabel, yLabel, useLog = false, pointColor = "#155e75", lineColor = "#b45309") {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const valid = points
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.y > 0)
    .map(p => ({ x: useLog ? Math.log(p.x) : p.x, y: useLog ? Math.log(p.y) : p.y }));
  if (valid.length < 2) {
    ctx.fillStyle = "#334155";
    ctx.font = "14px Avenir Next, sans-serif";
    ctx.fillText("Not enough data to draw plot.", 20, 30);
    return;
  }

  const xMin = Math.min(...valid.map(p => p.x));
  const xMax = Math.max(...valid.map(p => p.x));
  const yMin = Math.min(...valid.map(p => p.y));
  const yMax = Math.max(...valid.map(p => p.y));

  const padLeft = 62;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 42;

  const sx = x => padLeft + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (w - padLeft - padRight);
  const sy = y => h - padBottom - ((y - yMin) / Math.max(1e-9, yMax - yMin)) * (h - padTop - padBottom);

  ctx.strokeStyle = "#d1d5db";
  ctx.strokeRect(padLeft, padTop, w - padLeft - padRight, h - padTop - padBottom);

  ctx.fillStyle = pointColor;
  valid.forEach(p => {
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const fit = fitLineXY(valid);
  if (Number.isFinite(fit.slope)) {
    const y1 = fit.slope * fit.xMin + fit.intercept;
    const y2 = fit.slope * fit.xMax + fit.intercept;
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.moveTo(sx(fit.xMin), sy(y1));
    ctx.lineTo(sx(fit.xMax), sy(y2));
    ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.font = "12px Avenir Next, sans-serif";
    ctx.fillText(`Linear fit slope: ${fit.slope.toFixed(3)}`, padLeft + 8, padTop + 14);
  }

  ctx.fillStyle = "#334155";
  ctx.font = "12px Avenir Next, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(xLabel, w / 2, h - 10);

  ctx.save();
  ctx.translate(16, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function run() {
  try {
    const params = {
      furcation: Number(ui.furcation.value),
      a: Number(ui.aRatio.value),
      b: Number(ui.bRatio.value),
      pathFraction: Number(ui.pathFraction.value),
      asymStrength: Number(ui.asymStrength.value)
    };
    const maxOrder = Number(ui.maxOrder.value);
    const useLog = ui.scaleMode ? (ui.scaleMode.value === "log") : true;

    // Draw tree at max order
    const maxTree = simulateTree(params, maxOrder, maxOrder * 1000);
    drawTree(ui.treeSvg, maxTree, 900, 420);

    // Generate comparison trees at different orders
    const comparisonOrders = [4, 6, 8, 10, 12].filter(o => o <= maxOrder);
    ui.treeComparison.innerHTML = "";
    
    comparisonOrders.forEach(ord => {
      const div = document.createElement("div");
      div.className = "tree-item";
      
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 200 160");
      svg.setAttribute("aria-label", `Tree at order ${ord}`);
      div.appendChild(svg);
      
      const tree = simulateTree(params, ord, ord * 1000);
      drawTree(svg, tree, 200, 160);
      
      const label = document.createElement("label");
      label.textContent = `Order ${ord}`;
      div.appendChild(label);
      
      ui.treeComparison.appendChild(div);
    });

    // Generate scaling data
    const reps = [];
    const ordersForScaling = [4, 5, 6, 7, 8, 9, 10, 11, 12].filter(o => o <= maxOrder);
    for (let ord of ordersForScaling) {
      for (let r = 0; r < 15; r += 1) {
        const tr = simulateTree(params, ord, ord * 1000 + r);
        reps.push({ ...metrics(tr), order: ord });
      }
    }

    const points = reps.map(m => ({ x: m.mProxy, y: m.kProxy }));
    const pointsByOrder = reps.map(m => ({ x: m.mProxy, y: m.kProxy, order: m.order }));
    const obs = fitSlope(points, true);
    const theo = theoreticalKvsMExponent(params.furcation, params.a, params.b);
    const asym = estimateAsymptoticSlope(pointsByOrder, ordersForScaling, useLog);

    if (ui.scalingCanvas && ui.scalingCanvas.getContext) {
      drawScaling(ui.scalingCanvas, points, obs, theo, asym.asymptoticSlope, useLog);
    }

    if (ui.leavesDiameterCanvas && ui.leavesDiameterCanvas.getContext) {
      const leavesVsDiameter = reps.map(m => ({ x: m.terminalEquivalentDiameter, y: m.nTips }));
      drawLeavesScatter(
        ui.leavesDiameterCanvas,
        leavesVsDiameter,
        "Leaves vs Terminal-Equivalent Diameter",
        useLog ? "ln(Terminal-equivalent diameter)" : "Terminal-equivalent diameter [arbitrary length units]",
        useLog ? "ln(Number of leaves)" : "Number of leaves (tip count) [count]",
        useLog,
        "#0f766e",
        "#b45309"
      );
    }

    if (ui.leavesVolumeCanvas && ui.leavesVolumeCanvas.getContext) {
      const leavesVsVolume = reps.map(m => ({ x: m.mProxy, y: m.nTips }));
      drawLeavesScatter(
        ui.leavesVolumeCanvas,
        leavesVsVolume,
        "Leaves vs Branching Network Volume",
        useLog ? "ln(Branching network volume: M_proxy)" : "Branching network volume (M_proxy) [arbitrary volume units]",
        useLog ? "ln(Number of leaves)" : "Number of leaves (tip count) [count]",
        useLog,
        "#155e75",
        "#7c3aed"
      );
    }
    
    const leavesTheory = theoreticalLeavesExponents(params.furcation, params.a, params.b);
    const leavesMObs = fitSlope(reps.map(m => ({ x: m.mProxy, y: m.nTips })), true);
    const leavesDObs = fitSlope(reps.map(m => ({ x: m.terminalEquivalentDiameter, y: m.nTips })), true);

    const delta = obs - theo;
    const asymDelta = Number.isFinite(asym.asymptoticSlope) ? (asym.asymptoticSlope - theo) : NaN;
    const bias = Number.isFinite(asym.finiteSizeBias) ? asym.finiteSizeBias : NaN;
    ui.diagText.innerHTML = `<strong>Scale:</strong> ${useLog ? "Log-Log" : "Raw"}<br/><strong>K~M observed exponent:</strong> ${obs.toFixed(4)}<br/><strong>K~M theory exponent:</strong> ${Number.isFinite(theo) ? theo.toFixed(4) : "NA"}<br/><strong>K~M asymptotic (finite-size corrected):</strong> ${Number.isFinite(asym.asymptoticSlope) ? asym.asymptoticSlope.toFixed(4) : "NA (log mode only)"}<br/><strong>K~M observed - theory:</strong> ${Number.isFinite(delta) ? delta.toFixed(4) : "NA"}<br/><strong>K~M asymptotic - theory:</strong> ${Number.isFinite(asymDelta) ? asymDelta.toFixed(4) : "NA"}<br/><strong>Finite-size bias (largest order - asymptotic):</strong> ${Number.isFinite(bias) ? bias.toFixed(4) : "NA"}${Number.isFinite(asym.fitR2) ? `<br/><strong>Finite-size fit R²:</strong> ${asym.fitR2.toFixed(3)}` : ""}<br/><strong>N~M observed exponent (log):</strong> ${Number.isFinite(leavesMObs) ? leavesMObs.toFixed(4) : "NA"}<br/><strong>N~M theory exponent (log):</strong> ${Number.isFinite(leavesTheory.betaNvsM) ? leavesTheory.betaNvsM.toFixed(4) : "NA"}<br/><strong>N~D_eq observed exponent (log):</strong> ${Number.isFinite(leavesDObs) ? leavesDObs.toFixed(4) : "NA"}<br/><strong>N~D_eq theory exponent (log):</strong> ${Number.isFinite(leavesTheory.betaNvsDeq) ? leavesTheory.betaNvsDeq.toFixed(4) : "NA"}`;
  } catch (e) {
    console.error("Error in run():", e);
    ui.diagText.textContent = "Error: " + e.message;
  }
}

// Update output displays and run simulation on slider change
const sliders = ["furcation", "aRatio", "bRatio", "pathFraction", "asymStrength", "maxOrder"];
sliders.forEach(id => {
  ui[id].addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    const formatted = val.toFixed(id === "furcation" || id === "maxOrder" ? 0 : 2);
    if (outputs[id]) {
      outputs[id].textContent = formatted;
    }
    run();
  });
});

if (ui.scaleMode) {
  ui.scaleMode.addEventListener("change", () => {
    run();
  });
}

// WBE Target Mode: sets parameters to approximate 3/4 and 2 exponents
function applyWBETargetMode() {
  // For N ~ M^(3/4) target, we need ab^2 ≈ 1.26
  // For this, set a = 1.3, b = 0.984 (gives ab^2 ≈ 1.257)
  // This yields: beta_N~M ≈ ln(2)/ln(2*1.257) ≈ 0.746 ≈ 3/4
  // and beta_N~D_eq = 2*ln(2)/ln(2*0.984^2) ≈ 2.006 ≈ 2.0
  
  ui.aRatio.value = "1.30";
  outputs.aRatio.textContent = "1.30";
  
  ui.bRatio.value = "0.984";
  outputs.bRatio.textContent = "0.98";
  
  ui.furcation.value = "2";
  outputs.furcation.textContent = "2";
  
  ui.asymStrength.value = "0";
  outputs.asymStrength.textContent = "0.00";
  
  run();
}

const wbeTargetCheckbox = document.getElementById("wbeTargetMode");
if (wbeTargetCheckbox) {
  wbeTargetCheckbox.addEventListener("change", (e) => {
    if (e.target.checked) {
      applyWBETargetMode();
    }
  });
}

// Initialize on load
window.addEventListener("DOMContentLoaded", () => {
  // Set initial output values
  sliders.forEach(id => {
    const val = parseFloat(ui[id].value);
    const formatted = val.toFixed(id === "furcation" || id === "maxOrder" ? 0 : 2);
    if (outputs[id]) {
      outputs[id].textContent = formatted;
    }
  });
  run();
});

// Run on page load too (in case DOMContentLoaded already fired)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    sliders.forEach(id => {
      const val = parseFloat(ui[id].value);
      const formatted = val.toFixed(id === "furcation" || id === "maxOrder" ? 0 : 2);
      if (outputs[id]) {
        outputs[id].textContent = formatted;
      }
    });
    run();
  });
} else {
  sliders.forEach(id => {
    const val = parseFloat(ui[id].value);
    const formatted = val.toFixed(id === "furcation" || id === "maxOrder" ? 0 : 2);
    if (outputs[id]) {
      outputs[id].textContent = formatted;
    }
  });
  run();
}
