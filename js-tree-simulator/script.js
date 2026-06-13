/* =============================================================
   Tree Architecture Simulator – script.js
   WBE-aware branching simulator with allometric diagnostics.
   ============================================================= */

// ── WBE optimal values (binary bifurcation, n = 2) ───────────
// radius decay = 2^(-1/2) ≈ 0.707  [area-preserving]
// length decay = 2^(-1/3) ≈ 0.794  [volume-filling]
// symmetric branching control: main-branch bias = 0.5, asymStrength = 0
const WBE = {
  pathFraction: 0.50,
  asymStrength:  0.00,
  lengthDecay:   0.794,
  radiusDecay:   0.707,
  branchProb:    1.00,
  maxDepth:      10,
  minTips:       16,
  maxTips:       128,
  classCount:    4,
  seed:          42
};

// ── UI references ─────────────────────────────────────────────
const UI = {
  pathFraction:      document.getElementById("pathFraction"),
  pathFractionValue: document.getElementById("pathFractionValue"),
  asymStrength:      document.getElementById("asymStrength"),
  asymStrengthValue: document.getElementById("asymStrengthValue"),
  lengthDecay:       document.getElementById("lengthDecay"),
  lengthDecayValue:  document.getElementById("lengthDecayValue"),
  radiusDecay:       document.getElementById("radiusDecay"),
  radiusDecayValue:  document.getElementById("radiusDecayValue"),
  branchProb:        document.getElementById("branchProb"),
  branchProbValue:   document.getElementById("branchProbValue"),
  maxDepth:          document.getElementById("maxDepth"),
  maxDepthValue:     document.getElementById("maxDepthValue"),
  minTips:           document.getElementById("minTips"),
  minTipsValue:      document.getElementById("minTipsValue"),
  maxTips:           document.getElementById("maxTips"),
  maxTipsValue:      document.getElementById("maxTipsValue"),
  classCount:        document.getElementById("classCount"),
  classCountValue:   document.getElementById("classCountValue"),
  balancedWbeMode:   document.getElementById("balancedWbeMode"),
  seed:              document.getElementById("seed"),
  seedValue:         document.getElementById("seedValue"),
  sizeClassPreview:  document.getElementById("sizeClassPreview"),
  generateBtn:       document.getElementById("generateBtn"),
  wbeSnapBtn:        document.getElementById("wbeSnapBtn"),
  treeSvg:           document.getElementById("treeSvg"),
  treeMeta:          document.getElementById("treeMeta"),
  treeStrip:         document.getElementById("treeStrip"),
  withinHist:        document.getElementById("withinHist"),
  acrossHist:        document.getElementById("acrossHist"),
  alloStemVol:       document.getElementById("alloStemVol"),
  alloHeight:        document.getElementById("alloHeight"),
  alloMaxPath:       document.getElementById("alloMaxPath"),
  alloMeanPath:      document.getElementById("alloMeanPath"),
  alloSumPath:       document.getElementById("alloSumPath"),
  alloTotalLen:      document.getElementById("alloTotalLen"),
  alloPF:            document.getElementById("alloPF"),
  alloSizeMeanPath:  document.getElementById("alloSizeMeanPath"),
  alloSizeSumPath:   document.getElementById("alloSizeSumPath"),
  alloSizeVarPath:   document.getElementById("alloSizeVarPath"),
  alloSizeMaxPath:   document.getElementById("alloSizeMaxPath"),
  alloStemVol2:      document.getElementById("alloStemVol2"),
  alloHeight2:       document.getElementById("alloHeight2"),
  alloMaxPath2:      document.getElementById("alloMaxPath2"),
  alloMeanPath2:     document.getElementById("alloMeanPath2"),
  alloTotalLen2:     document.getElementById("alloTotalLen2"),
  alloPF2:           document.getElementById("alloPF2"),
  tradeoffSurface:    document.getElementById("tradeoffSurface"),
  tradeoffFrontier:   document.getElementById("tradeoffFrontier"),
  tradeoffPathMetric: document.getElementById("tradeoffPathMetric"),
  eqDiameter:        document.getElementById("eqDiameter"),
  eqLeaf:            document.getElementById("eqLeaf"),
  eqTradeoff:        document.getElementById("eqTradeoff")
};

const state = {
  classes:       [],
  selectedIndex: 0,
  alloPoints:    [],
  activeTab:     "paths",
  lastParams:    null,
  tradeoffRevision: 0,
  renderedTradeoffRevision: -1,
  tradeoffRendering: false
};

// ── RNG utilities ─────────────────────────────────────────────
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randNorm(rand, mean, sd) {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randBetaApprox(rand, alpha, beta) {
  const x = Math.pow(rand(), 1 / alpha);
  const y = Math.pow(rand(), 1 / beta);
  return x / (x + y);
}

// ── Inputs & slider sync ──────────────────────────────────────
function buildSizeClasses(minTips, maxTips, count) {
  const mn = Math.max(1, Math.round(minTips));
  const mx = Math.max(mn, Math.round(maxTips));
  const n  = Math.max(2, Math.round(count));
  const cls = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    cls.push(Math.max(1, Math.round(mn * Math.pow(mx / mn, t))));
  }
  return [...new Set(cls)].sort((a, b) => a - b);
}

function buildBalancedSizeClasses(minTips, maxTips, count) {
  const mn = Math.max(1, Math.round(minTips));
  const mx = Math.max(mn, Math.round(maxTips));
  const n = Math.max(2, Math.round(count));

  const expMin = Math.ceil(Math.log2(mn));
  const expMax = Math.floor(Math.log2(mx));
  const powers = [];
  for (let e = expMin; e <= expMax; e++) powers.push(2 ** e);

  const candidates = [...new Set([mn, ...powers, mx])].sort((a, b) => a - b);
  if (candidates.length <= n) return candidates;

  const picks = [mn];
  const inner = candidates.filter(v => v !== mn && v !== mx);
  const innerSlots = Math.max(0, n - 2);
  for (let i = 0; i < innerSlots; i++) {
    const t = innerSlots === 1 ? 0.5 : i / (innerSlots - 1);
    const idx = Math.round(t * Math.max(inner.length - 1, 0));
    if (inner[idx] != null) picks.push(inner[idx]);
  }
  picks.push(mx);

  return [...new Set(picks)].sort((a, b) => a - b);
}

function getInputs() {
  const minTips    = Number(UI.minTips.value);
  const maxTips    = Number(UI.maxTips.value);
  const classCount = Number(UI.classCount.value);
  const pathScalingMetric = (UI.tradeoffPathMetric && UI.tradeoffPathMetric.value === "maxPath")
    ? "maxPath"
    : "meanPath";

  let maxDepth = Math.round(Number(UI.maxDepth.value));
  const minDepthForTarget = Math.max(3, Math.ceil(Math.log2(Math.max(2, maxTips))) + 1);
  if (maxDepth < minDepthForTarget) {
    maxDepth = minDepthForTarget;
    if (UI.maxDepth) UI.maxDepth.value = String(maxDepth);
    if (UI.maxDepthValue) UI.maxDepthValue.value = String(maxDepth);
  }

  const balancedMode = Boolean(UI.balancedWbeMode && UI.balancedWbeMode.checked);
  const sizeClasses = balancedMode
    ? buildBalancedSizeClasses(minTips, maxTips, classCount)
    : buildSizeClasses(minTips, maxTips, classCount);
  return {
    pathFraction: Number(UI.pathFraction.value),
    asymStrength:  Number(UI.asymStrength.value),
    lengthDecay:   Number(UI.lengthDecay.value),
    radiusDecay:   Number(UI.radiusDecay.value),
    branchProb:    Number(UI.branchProb.value),
    maxDepth,
    minTips, maxTips, classCount,
    sizeClasses,
    balancedMode,
    pathScalingMetric,
    seed:          Math.round(Number(UI.seed.value))
  };
}

function syncSliderOutputs() {
  UI.pathFractionValue.value = Number(UI.pathFraction.value).toFixed(2);
  UI.asymStrengthValue.value  = Number(UI.asymStrength.value).toFixed(2);
  UI.lengthDecayValue.value   = Number(UI.lengthDecay.value).toFixed(2);
  UI.radiusDecayValue.value   = Number(UI.radiusDecay.value).toFixed(2);
  UI.branchProbValue.value    = Number(UI.branchProb.value).toFixed(2);
  UI.maxDepthValue.value      = String(Math.round(Number(UI.maxDepth.value)));
  UI.seedValue.value          = String(Math.round(Number(UI.seed.value)));
  let mn = Math.round(Number(UI.minTips.value));
  let mx = Math.round(Number(UI.maxTips.value));
  if (mn > mx) { mx = mn; UI.maxTips.value = String(mx); }
  UI.minTipsValue.value    = String(mn);
  UI.maxTipsValue.value    = String(mx);
  UI.classCountValue.value = String(Math.round(Number(UI.classCount.value)));
  const useBalanced = Boolean(UI.balancedWbeMode && UI.balancedWbeMode.checked);
  const preview = useBalanced
    ? buildBalancedSizeClasses(mn, mx, Number(UI.classCount.value))
    : buildSizeClasses(mn, mx, Number(UI.classCount.value));
  UI.sizeClassPreview.textContent = `Classes: ${preview.join(", ")}`;
}

// ── WBE tick markers (orange vertical line on slider track) ───
function positionWbeTicks() {
  document.querySelectorAll(".slider-wrap[data-wbe]").forEach(wrap => {
    const wbeVal = parseFloat(wrap.dataset.wbe);
    const minVal = parseFloat(wrap.dataset.min);
    const maxVal = parseFloat(wrap.dataset.max);
    const tick   = wrap.querySelector(".wbe-tick");
    if (!tick || isNaN(wbeVal) || isNaN(minVal) || isNaN(maxVal)) return;
    const pct = ((wbeVal - minVal) / (maxVal - minVal)) * 100;
    // Clamp to valid range
    tick.style.left = `calc(${Math.min(100, Math.max(0, pct)).toFixed(2)}% - 1px)`;
  });
}

// ── WBE snap ──────────────────────────────────────────────────
function snapToWbe() {
  UI.pathFraction.value = String(WBE.pathFraction);
  UI.asymStrength.value  = String(WBE.asymStrength);
  UI.lengthDecay.value   = String(WBE.lengthDecay);
  UI.radiusDecay.value   = String(WBE.radiusDecay);
  UI.branchProb.value    = String(WBE.branchProb);
  UI.maxDepth.value      = String(WBE.maxDepth);
  syncSliderOutputs();
}

// ── Tree simulation ───────────────────────────────────────────
function simulateTree(params, targetTips, seedOffset) {
  const rand = mulberry32(((params.seed + (seedOffset | 0)) >>> 0));
  const baseLength = Number.isFinite(params.baseLength) ? params.baseLength : 1;
  const baseRadius = Number.isFinite(params.baseRadius) ? params.baseRadius : 0.1;

  const nodes = [{ id: 1, x: 0, y: 0, depth: 0 }];
  const nodeById = new Map([[1, nodes[0]]]);
  const edges = [];
  let nextId  = 2;

  // Enforce single trunk (no base furcation)
  const trunkAngle  = 90 + randNorm(rand, 0, 3);
  const trunkLen    = baseLength;
  const trunkRad    = baseRadius;
  const tn = {
    id: nextId++,
    x: trunkLen * Math.cos(trunkAngle * Math.PI / 180),
    y: trunkLen * Math.sin(trunkAngle * Math.PI / 180),
    depth: 1
  };
  nodes.push(tn);
  nodeById.set(tn.id, tn);
  edges.push({ from: 1, to: tn.id, depth: 1, length: trunkLen, radius: trunkRad, angle: trunkAngle, isMain: true });

  const frontier = [{
    nodeId: tn.id, depth: 2, angle: trunkAngle,
    length: trunkLen * params.lengthDecay,
    radius: trunkRad * params.radiusDecay,
    mainSteps: 1, steps: 1
  }];

  let frontierIndex = 0;
  let tipCount = 1;

  while (frontierIndex < frontier.length) {
    if (tipCount >= targetTips) break;
    const cur = frontier[frontierIndex++];
    if (cur.depth > params.maxDepth) continue;
    if (rand() > params.branchProb && cur.depth > 2) continue;

    const u     = randBetaApprox(rand, 2.5, 2.5);
    const pMain = (1 - params.asymStrength) * 0.5 + params.asymStrength * (params.pathFraction * 0.7 + 0.3 * u);
    const skew  = (pMain - 0.5) * 2;

    const mainLen = Math.max(cur.length * (1 + 0.35 * skew), 1e-4);
    const sideLen = Math.max(cur.length * (1 - 0.35 * skew), 1e-4);
    const mainRad = Math.max(cur.radius * (1 + 0.22 * skew), 1e-4);
    const sideRad = Math.max(cur.radius * (1 - 0.22 * skew), 1e-4);

    const mainAngle = cur.angle + randNorm(rand, 0, 4);
    const sideSign  = rand() < 0.5 ? -1 : 1;
    const sideAngle = cur.angle + sideSign * (34 + randNorm(rand, 0, 9));

    const parent = nodeById.get(cur.nodeId);
    if (!parent) continue;

    const mn2 = { id: nextId++, x: parent.x + mainLen * Math.cos(mainAngle * Math.PI / 180), y: parent.y + mainLen * Math.sin(mainAngle * Math.PI / 180), depth: cur.depth };
    const sn  = { id: nextId++, x: parent.x + sideLen * Math.cos(sideAngle * Math.PI / 180), y: parent.y + sideLen * Math.sin(sideAngle * Math.PI / 180), depth: cur.depth };
    nodes.push(mn2, sn);
    nodeById.set(mn2.id, mn2);
    nodeById.set(sn.id, sn);
    edges.push({ from: parent.id, to: mn2.id, depth: cur.depth, length: mainLen, radius: mainRad, angle: mainAngle, isMain: true });
    edges.push({ from: parent.id, to: sn.id,  depth: cur.depth, length: sideLen, radius: sideRad, angle: sideAngle, isMain: false });

    frontier.push({ nodeId: mn2.id, depth: cur.depth + 1, angle: mainAngle, length: mainLen * params.lengthDecay, radius: mainRad * params.radiusDecay, mainSteps: cur.mainSteps + 1, steps: cur.steps + 1 });
    frontier.push({ nodeId: sn.id,  depth: cur.depth + 1, angle: sideAngle, length: sideLen * params.lengthDecay, radius: sideRad * params.radiusDecay, mainSteps: cur.mainSteps, steps: cur.steps + 1 });
    tipCount += 1;
  }

  const pathStats = computePathStats(nodes, edges);
  return { nodes, edges, pathStats, targetTips };
}

function countTips(edges) {
  if (!edges.length) return 0;
  const from = new Set(edges.map(e => e.from));
  const to   = new Set(edges.map(e => e.to));
  let tips = 0;
  to.forEach(id => { if (!from.has(id)) tips++; });
  return tips;
}

function computePathStats(nodes, edges) {
  const childMap = new Map();
  for (const e of edges) {
    if (!childMap.has(e.from)) childMap.set(e.from, []);
    childMap.get(e.from).push(e);
  }
  const tips = [];
  function dfs(nodeId, pathLen, mainSteps, steps) {
    const children = childMap.get(nodeId) || [];
    if (children.length === 0 && nodeId !== 1) {
      tips.push({
        nodeId,
        pathLength: pathLen,
        // Keep this as a diagnostic for the branching controller, not Smith Pf.
        mainlineFraction: steps > 0 ? mainSteps / steps : 0,
        // Filled after traversal: Smith per-path fraction L_l / L_l*
        pathFraction: 0
      });
      return;
    }
    for (const e of children) dfs(e.to, pathLen + e.length, mainSteps + (e.isMain ? 1 : 0), steps + 1);
  }
  dfs(1, 0, 0, 0);

  const maxPath = tips.length ? Math.max(...tips.map(t => t.pathLength)) : 1e-6;
  const safeMax = Math.max(maxPath, 1e-6);
  tips.forEach(t => {
    t.pathFraction = t.pathLength / safeMax;
  });

  return tips;
}

// ── Tree metrics for allometry plots ──────────────────────────
// Returns per-tree summary for scatter plotting.
// All quantities > 0 so log-log plots are safe (except meanPathFrac).
function computeTreeMetrics(tree, sizeIdx) {
  const { nodes, edges, pathStats } = tree;

  // Structural volumes and lengths
  const networkVolume = edges.reduce((s, e) => s + Math.PI * e.radius * e.radius * e.length, 0);
  const totalStemLen = edges.reduce((s, e) => s + e.length, 0);
  const trunkRadius   = edges.length > 0 ? edges[0].radius : 1e-6;
  const trunkDiameter = Math.max(1e-6, 2 * trunkRadius);
  const trunkLength   = edges.length > 0 ? edges[0].length : 1e-6;
  const stemVolume    = Math.PI * trunkRadius * trunkRadius * trunkLength;
  const leafCount     = Math.max(1, pathStats.length);
  const totalBiomass  = networkVolume + 0.02 * leafCount;

  // Height: vertical extent of crown
  const ys    = nodes.map(n => n.y);
  const height = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));

  // Path lengths
  const pathLens   = pathStats.map(p => p.pathLength);
  const nTips      = leafCount;
  const maxPathLen = pathLens.length ? Math.max(...pathLens) : 1e-6;
  const meanPathLen = pathLens.length ? pathLens.reduce((s, v) => s + v, 0) / pathLens.length : 1e-6;
  const totalPathLen = pathLens.length ? pathLens.reduce((s, v) => s + v, 0) : 1e-6;
  const varPathLen = pathLens.length
    ? pathLens.reduce((s, v) => s + (v - meanPathLen) ** 2, 0) / pathLens.length
    : 1e-6;

  // Smith path fraction: Pf = mean(L_l / L_l*) = mean pathFraction.
  const meanPathFrac = pathStats.reduce((s, p) => s + p.pathFraction, 0) / nTips;

  return {
    nTips,
    leafCount,
    trunkDiameter,
    trunkRadius,
    stemVolume,
    networkVolume,
    totalBiomass,
    totalStemLen,
    height,
    maxPathLen,
    meanPathLen,
    totalPathLen,
    varPathLen,
    meanPathFrac,
    targetTips: tree.targetTips,
    sizeIdx: sizeIdx || 0
  };
}

function getTerminalUnitScales(tree, params) {
  const { edges } = tree;
  if (!edges.length) return { lengthScale: 1, radiusScale: 1 };

  const from = new Set(edges.map(e => e.from));
  const tipEdges = edges.filter(e => !from.has(e.to));
  if (!tipEdges.length) return { lengthScale: 1, radiusScale: 1 };

  const tipLengths = tipEdges.map(e => e.length).filter(v => v > 0).sort((a, b) => a - b);
  const tipRadii = tipEdges.map(e => e.radius).filter(v => v > 0).sort((a, b) => a - b);
  if (!tipLengths.length || !tipRadii.length) return { lengthScale: 1, radiusScale: 1 };

  const midLen = tipLengths[Math.floor(tipLengths.length / 2)];
  const midRad = tipRadii[Math.floor(tipRadii.length / 2)];
  const targetTipLength = Number.isFinite(params.baseLength) ? params.baseLength : 1;
  const targetTipRadius = Number.isFinite(params.baseRadius) ? params.baseRadius : 0.1;

  return {
    lengthScale: midLen > 0 ? targetTipLength / midLen : 1,
    radiusScale: midRad > 0 ? targetTipRadius / midRad : 1
  };
}

function rescaleTreeMetrics(metrics, scales) {
  const lengthScale = Number.isFinite(scales.lengthScale) ? scales.lengthScale : 1;
  const radiusScale = Number.isFinite(scales.radiusScale) ? scales.radiusScale : 1;
  const volumeScale = radiusScale * radiusScale * lengthScale;

  return {
    ...metrics,
    trunkDiameter: metrics.trunkDiameter * radiusScale,
    trunkRadius: metrics.trunkRadius * radiusScale,
    stemVolume: metrics.stemVolume * volumeScale,
    networkVolume: metrics.networkVolume * volumeScale,
    totalBiomass: metrics.networkVolume * volumeScale + 0.02 * metrics.leafCount,
    totalStemLen: metrics.totalStemLen * lengthScale,
    height: metrics.height * lengthScale,
    maxPathLen: metrics.maxPathLen * lengthScale,
    meanPathLen: metrics.meanPathLen * lengthScale,
    totalPathLen: metrics.totalPathLen * lengthScale,
    varPathLen: metrics.varPathLen * lengthScale * lengthScale
  };
}

// ── Theory-derived allometric exponents (binary branching) ───
// eta   = daughter/parent length ratio  (lengthDecay)
// gamma = daughter/parent radius ratio  (radiusDecay)
function computeExpectedExponents(eta, gamma) {
  if (!(eta > 0 && eta < 1 && gamma > 0 && gamma < 1)) return null;

  const ln2 = Math.log(2);
  const aL = -Math.log(eta) / ln2;   // trunk length exponent vs N
  const aD = -Math.log(gamma) / ln2; // trunk diameter exponent vs N
  if (!(Number.isFinite(aL) && Number.isFinite(aD) && aL > 0 && aD > 0)) return null;

  const aStem = 2 * aD + aL;
  const q = 2 * gamma * gamma * eta;
  const tol = 1e-6;

  // Total vascular volume regime by geometric ratio q = 2*gamma^2*eta.
  let aNet;
  if (q < 1 - tol) {
    aNet = aStem;           // proximal-dominated: same power as trunk stem volume
  } else if (q > 1 + tol) {
    aNet = 1;               // distal-dominated: finest levels dominate, scales ~ N
  } else {
    aNet = aStem;           // critical: power law with multiplicative log(N) correction
  }

  // totalBiomass in this simulator = networkVolume + c * leafCount.
  const aBio = Math.max(aNet, 1);

  return {
    aL,
    aD,
    // Diameter tab (y vs D)
    bStemVsD: aStem / aD,
    bBiomassVsD: aBio / aD,
    bLeafVsD: 1 / aD,
    bNetVsD: aNet / aD,
    bHeightVsD: aL / aD,
    bMaxPathVsD: aL / aD,
    // Leaf tab (N vs x)
    bLeafVsStem: 1 / aStem,
    bLeafVsBiomass: 1 / aBio,
    bLeafVsD: 1 / aD,
    bLeafVsNet: 1 / aNet,
    bLeafVsHeight: 1 / aL,
    bLeafVsMaxPath: 1 / aL
  };
}

function buildAllometryTargets(minTips, maxTips) {
  const minExp = Math.max(0, Math.ceil(Math.log2(Math.max(1, minTips))));
  const maxExp = Math.max(minExp + 1, Math.floor(Math.log2(Math.max(1, maxTips))));
  const targets = [];
  for (let exp = minExp; exp <= maxExp; exp++) {
    targets.push(2 ** exp);
  }
  if (!targets.includes(maxTips)) targets.push(maxTips);
  return [...new Set(targets)].sort((a, b) => a - b);
}

// Build allometry dataset using branching-consistent tip classes.
// Power-of-two targets reduce last-generation censoring that can strongly bias
// WBE checks when the tree is stopped at arbitrary tip counts.
function buildAllometryPoints(params) {
  const minT = Math.max(1, params.minTips);
  const maxT = Math.min(1000, params.maxTips * 4);
  const targets = buildAllometryTargets(minT, maxT);
  const reps = 6;
  const pts  = [];

  targets.forEach((target, i) => {
    const scaledParams = {
      ...params,
      // Keep terminal twig units fixed across classes; trunk-scale growth then emerges
      // from the realized depth/branching structure of the generated trees.
      baseLength: (Number.isFinite(params.baseLength) ? params.baseLength : 1),
      baseRadius: (Number.isFinite(params.baseRadius) ? params.baseRadius : 0.1)
    };
    for (let rep = 0; rep < reps; rep++) {
      const tree = simulateTree(scaledParams, target, rep * 137 + i * 23);
      const metrics = computeTreeMetrics(tree, i);
      const scales = getTerminalUnitScales(tree, scaledParams);
      pts.push(rescaleTreeMetrics(metrics, scales));
    }
  });
  return pts;
}

// ── Tree drawing ──────────────────────────────────────────────
function fitToBox(points, width, height, pad) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(
    (width  - pad * 2) / Math.max(maxX - minX, 1e-9),
    (height - pad * 2) / Math.max(maxY - minY, 1e-9)
  );
  return {
    tx: x => pad + (x - minX) * s,
    ty: y => height - (pad + (y - minY) * s)
  };
}

function drawTreeSvg(svg, tree) {
  svg.innerHTML = "";
  const vb = svg.viewBox.baseVal;
  const W  = vb.width  || 900;
  const H  = vb.height || 480;
  const tf = fitToBox(tree.nodes, W, H, 18);
  const nb = new Map(tree.nodes.map(n => [n.id, n]));

  for (const e of tree.edges) {
    const from = nb.get(e.from), to = nb.get(e.to);
    if (!from || !to) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", tf.tx(from.x));
    line.setAttribute("y1", tf.ty(from.y));
    line.setAttribute("x2", tf.tx(to.x));
    line.setAttribute("y2", tf.ty(to.y));
    line.setAttribute("stroke", e.isMain ? "#1f252a" : "#7f9298");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-width", Math.max(0.6, Math.sqrt(e.radius) * 8));
    svg.appendChild(line);
  }
}

function drawMiniTree(svgEl, tree) {
  svgEl.innerHTML = "";
  const W  = svgEl.clientWidth  || 180;
  const H  = svgEl.clientHeight || 72;
  const tf = fitToBox(tree.nodes, W, H, 6);
  const nb = new Map(tree.nodes.map(n => [n.id, n]));

  for (const e of tree.edges) {
    const from = nb.get(e.from), to = nb.get(e.to);
    if (!from || !to) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", tf.tx(from.x));
    line.setAttribute("y1", tf.ty(from.y));
    line.setAttribute("x2", tf.tx(to.x));
    line.setAttribute("y2", tf.ty(to.y));
    line.setAttribute("stroke", e.isMain ? "#223036" : "#8ea19a");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-width", Math.max(0.4, Math.sqrt(e.radius) * 4));
    svgEl.appendChild(line);
  }
}

// ── Path distribution charts ──────────────────────────────────
function makeHist(values, bins, lo, hi) {
  const arr = new Array(bins).fill(0);
  const bw  = (hi - lo) / bins;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    let idx = Math.floor((v - lo) / bw);
    arr[Math.min(bins - 1, Math.max(0, idx))]++;
  }
  return arr;
}

function summarizePathLengths(tree) {
  const vals = tree.pathStats.map(d => d.pathLength).filter(v => Number.isFinite(v) && v > 0);
  if (!vals.length) {
    return {
      values: [],
      mean: 0,
      cv: 0,
      logVar: 0
    };
  }
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const varAbs = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const cv = mean > 0 ? Math.sqrt(varAbs) / mean : 0;
  const logs = vals.map(v => Math.log10(v));
  const meanLog = logs.reduce((s, v) => s + v, 0) / logs.length;
  const logVar = logs.reduce((s, v) => s + (v - meanLog) ** 2, 0) / logs.length;
  return { values: vals, mean, cv, logVar };
}

function drawBaseAxes(ctx, cw, ch, pad, xLabel, yLabel) {
  ctx.strokeStyle = "#33404a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, ch - pad.b);
  ctx.lineTo(cw - pad.r, ch - pad.b);
  ctx.stroke();
  ctx.fillStyle = "#33404a";
  ctx.font = "9px sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(xLabel, cw / 2 - 16, ch - 3);
  ctx.save();
  ctx.translate(10, ch / 2 + 12);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function drawWithinHistogram(tree) {
  const canvas = UI.withinHist;
  const ctx    = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const summary = summarizePathLengths(tree);
  const vals = summary.values.map(v => Math.log10(v));
  if (!vals.length) return;

  const bins   = 16;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(hi - lo, 1e-6);
  const counts = makeHist(vals, bins, lo - 0.05 * span, hi + 0.05 * span);
  const maxC   = Math.max(...counts, 1);
  const pad    = { l: 34, r: 8, t: 10, b: 26 };
  const w      = canvas.width  - pad.l - pad.r;
  const h      = canvas.height - pad.t - pad.b;

  ctx.fillStyle = "#0d6e6e";
  for (let i = 0; i < bins; i++) {
    const bw = w / bins;
    const bh = (counts[i] / maxC) * h;
    ctx.fillRect(pad.l + i * bw + 1, pad.t + h - bh, Math.max(1, bw - 2), bh);
  }
  drawBaseAxes(ctx, canvas.width, canvas.height, pad, "log10(path length)", "Freq");

  ctx.fillStyle = "#33404a";
  ctx.font = "9px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`CV=${summary.cv.toFixed(2)}  var(logL)=${summary.logVar.toFixed(3)}`, pad.l + 2, 2);
}

function drawAcrossHistogram(classes) {
  const canvas = UI.acrossHist;
  const ctx    = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bins   = 14;
  const pad    = { l: 34, r: 12, t: 10, b: 26 };
  const w      = canvas.width  - pad.l - pad.r;
  const h      = canvas.height - pad.t - pad.b;
  const colors = ["#1f252a", "#0d6e6e", "#b85c38", "#6b7c85", "#4a8f78", "#8a5c38", "#385c8a", "#8a385c"];
  const relLogs = classes.map(c => {
    const summary = summarizePathLengths(c.tree);
    if (!summary.values.length || summary.mean <= 0) return [];
    return summary.values.map(v => Math.log10(v / summary.mean));
  });
  const allVals = relLogs.flat();
  if (!allVals.length) return;
  const lo = Math.min(...allVals);
  const hi = Math.max(...allVals);
  const span = Math.max(hi - lo, 1e-6);
  const hists  = relLogs.map(vals => makeHist(vals, bins, lo - 0.05 * span, hi + 0.05 * span));
  const maxC   = Math.max(1, ...hists.flat());

  for (let ci = 0; ci < classes.length; ci++) {
    ctx.strokeStyle = colors[ci % colors.length];
    ctx.lineWidth   = 2;
    ctx.beginPath();
    hists[ci].forEach((cnt, i) => {
      const x = pad.l + ((i + 0.5) / bins) * w;
      const y = pad.t + h - (cnt / maxC) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  drawBaseAxes(ctx, canvas.width, canvas.height, pad, "log10(path length / mean path)", "Freq");

  ctx.font = "9px sans-serif";
  ctx.textBaseline = "middle";
  classes.forEach((c, i) => {
    const y = 9 + i * 12;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(canvas.width - 122, y - 3, 9, 7);
    ctx.fillStyle = "#28343a";
    ctx.fillText(`${c.targetTips} tips`, canvas.width - 110, y);
  });
}

// ── Allometry scatter plots ───────────────────────────────────
// 12 size classes × 4 reps = 48 points; color by size class index.
const ALLO_COLORS = [
  "#1a6e5f","#2d8a78","#3faa94","#5ec8b0",
  "#1e4d8c","#2f72c4","#4a96e8","#6db8ff",
  "#8c1e3a","#c42f54","#e8547a","#ff7fa0"
];

// superscript helper for axis tick labels
function sup(n) {
  const m = { "-":"⁻","0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹" };
  return String(n).split("").map(c => m[c] || c).join("");
}

/**
 * Draw a log-log scatter with OLS fit line and slope annotation.
 * @param {HTMLCanvasElement} canvas
 * @param {object[]}          points    array with .nTips and target yKey
 * @param {string}            xKey      field name for x axis
 * @param {string}            yKey      field name for y axis
 * @param {string}            xLabel
 * @param {string}            yLabel
 * @param {string}            title
 * @param {boolean}           linearY   if true, y axis is linear (for path fraction [0–1])
 */
function drawScatter(canvas, points, xKey, yKey, xLabel, yLabel, title, linearY, emergentSlope, theorySlope) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const valid = points.filter(p => p[xKey] > 0 && (linearY ? p[yKey] >= 0 : p[yKey] > 0));
  if (valid.length < 3) return null;

  const pad = { l: 56, r: 14, t: 22, b: 30 };
  const cw  = canvas.width;
  const ch  = canvas.height;
  const w   = cw - pad.l - pad.r;
  const h   = ch - pad.t - pad.b;

  // Axis ranges in log/linear space
  const rawXs = valid.map(p => Math.log10(p[xKey]));
  const rawYs = linearY ? valid.map(p => p[yKey]) : valid.map(p => Math.log10(p[yKey]));

  const xMin = Math.min(...rawXs), xMax = Math.max(...rawXs);
  const yMinRaw = Math.min(...rawYs), yMaxRaw = Math.max(...rawYs);
  const xRange = Math.max(xMax - xMin, 1e-6);
  const yPad   = (yMaxRaw - yMinRaw) * 0.08;
  const yMin   = yMinRaw - yPad;
  const yMax   = yMaxRaw + yPad;
  const yRange = Math.max(yMax - yMin, 1e-6);

  const sx = lx => pad.l + ((lx - xMin) / xRange) * w;
  const sy = v  => pad.t + h - ((v  - yMin) / yRange) * h;

  // Light grid lines
  ctx.strokeStyle = "#e4ede9";
  ctx.lineWidth   = 0.7;
  for (let lx = Math.ceil(xMin); lx <= Math.floor(xMax) + 0.1; lx++) {
    const x = sx(lx);
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + h); ctx.stroke();
  }

  // OLS slope in log space (log x always; log y if !linearY)
  const n   = valid.length;
  const mX  = rawXs.reduce((s, v) => s + v, 0) / n;
  const mY  = rawYs.reduce((s, v) => s + v, 0) / n;
  const SSxy = rawXs.reduce((s, v, i) => s + (v - mX) * (rawYs[i] - mY), 0);
  const SSxx = rawXs.reduce((s, v)    => s + (v - mX) ** 2, 0);
  const slope     = SSxx > 1e-9 ? SSxy / SSxx : 0;
  const intercept = mY - slope * mX;

  // Fit line
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(sx(xMin), sy(intercept + slope * xMin));
  ctx.lineTo(sx(xMax), sy(intercept + slope * xMax));
  ctx.stroke();
  ctx.setLineDash([]);

  // Slope labels: boxed so fitted and emergent-asymptotic exponents stay readable.
  const fitText = `fit b = ${slope.toFixed(2)}`;
  const asymText = Number.isFinite(emergentSlope) ? `emergent b∞ = ${emergentSlope.toFixed(2)}` : null;
  const thText = Number.isFinite(theorySlope) ? `theory b_th = ${theorySlope.toFixed(2)}` : null;
  const deltaFitText = Number.isFinite(theorySlope) ? `Δfit = ${(slope - theorySlope).toFixed(2)}` : null;
  const lines = [fitText, asymText, thText, deltaFitText].filter(Boolean);
  ctx.font = "bold 11px sans-serif";
  const labelWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  const boxX = pad.l + 6;
  const boxY = pad.t + 6;
  const boxW = labelWidth + 12;
  const boxH = 6 + lines.length * 12;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 4);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "alphabetic";
  let lineY = boxY + 12;
  ctx.fillStyle = "#c0392b";
  ctx.fillText(fitText, boxX + 6, lineY);
  lineY += 12;
  if (asymText) {
    ctx.fillStyle = "#2d6a4f";
    ctx.fillText(asymText, boxX + 6, lineY);
    lineY += 12;
  }
  if (thText) {
    ctx.fillStyle = "#1f4d8c";
    ctx.fillText(thText, boxX + 6, lineY);
    lineY += 12;
  }
  if (deltaFitText) {
    ctx.fillStyle = "#6b3fa0";
    ctx.fillText(deltaFitText, boxX + 6, lineY);
  }

  // Data points
  for (const p of valid) {
    const col = ALLO_COLORS[(p.sizeIdx || 0) % ALLO_COLORS.length];
    ctx.fillStyle = col + "cc";
    ctx.beginPath();
    ctx.arc(sx(Math.log10(p[xKey])), sy(linearY ? p[yKey] : Math.log10(p[yKey])), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Axes
  ctx.strokeStyle = "#33404a";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + h);
  ctx.lineTo(pad.l + w, pad.t + h);
  ctx.stroke();

  // X tick labels (log)
  ctx.fillStyle    = "#33404a";
  ctx.font         = "9px sans-serif";
  ctx.textBaseline = "top";
  for (let lx = Math.ceil(xMin); lx <= Math.floor(xMax) + 0.1; lx++) {
    ctx.fillText(`10${sup(Math.round(lx))}`, sx(lx) - 7, pad.t + h + 3);
  }

  // Y tick labels
  ctx.textBaseline = "middle";
  if (linearY) {
    const nYTicks = 4;
    for (let i = 0; i <= nYTicks; i++) {
      const v = yMin + (yMax - yMin) * (i / nYTicks);
      ctx.fillText(v.toFixed(2), 2, sy(v));
    }
  } else {
    for (let ly = Math.ceil(yMin); ly <= Math.floor(yMax) + 0.1; ly++) {
      ctx.fillText(`10${sup(Math.round(ly))}`, 2, sy(ly));
    }
  }

  // Title
  ctx.fillStyle    = "#0f2018";
  ctx.font         = "bold 10px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(title, pad.l + 2, 2);

  // Axis labels
  ctx.fillStyle = "#33404a";
  ctx.font      = "bold 10px sans-serif";
  ctx.textBaseline = "alphabetic";
  const xLabelWidth = ctx.measureText(xLabel).width;
  ctx.fillText(xLabel, pad.l + w / 2 - xLabelWidth / 2, ch - 4);
  ctx.save();
  ctx.translate(14, pad.t + h / 2 + 14);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  return { slope, intercept, n: valid.length };
}

function fitLogSlopeValue(points, xKey, yKey) {
  const valid = points.filter(p => p[xKey] > 0 && p[yKey] > 0);
  if (valid.length < 3) return null;
  const xs = valid.map(p => Math.log10(p[xKey]));
  const ys = valid.map(p => Math.log10(p[yKey]));
  const n = xs.length;
  const mX = xs.reduce((s, v) => s + v, 0) / n;
  const mY = ys.reduce((s, v) => s + v, 0) / n;
  const SSxy = xs.reduce((s, v, i) => s + (v - mX) * (ys[i] - mY), 0);
  const SSxx = xs.reduce((s, v) => s + (v - mX) ** 2, 0);
  if (SSxx <= 1e-9) return null;
  return SSxy / SSxx;
}

// Estimate asymptotic slope from finite-size convergence:
// fit b_eff(S) = b_inf + c / S using tail fits over realized tree sizes S = nTips.
function estimateEmergentAsymptote(points, xKey, yKey) {
  const valid = points.filter(p => p[xKey] > 0 && p[yKey] > 0 && (p.targetTips > 0 || p.nTips > 0));
  if (valid.length < 12) return null;

  const getSize = p => (p.targetTips > 0 ? p.targetTips : p.nTips);
  const sizes = [...new Set(valid.map(getSize))].sort((a, b) => a - b);
  if (sizes.length < 6) return null;
  const sizeSpread = sizes[sizes.length - 1] / Math.max(1, sizes[0]);
  if (!(sizeSpread >= 1.8)) return null;

  const eff = [];
  for (let i = 0; i < sizes.length - 2; i++) {
    const s0 = sizes[i];
    const tail = valid.filter(p => getSize(p) >= s0);
    if (tail.length < 10) continue;
    const b = fitLogSlopeValue(tail, xKey, yKey);
    if (Number.isFinite(b)) eff.push({ invS: 1 / s0, b });
  }
  if (eff.length < 4) return null;

  // OLS for b vs 1/S; intercept is asymptotic slope b_inf.
  const n = eff.length;
  const mX = eff.reduce((s, d) => s + d.invS, 0) / n;
  const mY = eff.reduce((s, d) => s + d.b, 0) / n;
  const SSxx = eff.reduce((s, d) => s + (d.invS - mX) ** 2, 0);
  if (SSxx <= 1e-9) {
    return { bInf: mY, c: 0, samples: eff.length };
  }
  const SSxy = eff.reduce((s, d) => s + (d.invS - mX) * (d.b - mY), 0);
  const c = SSxy / SSxx;
  const bInf = mY - c * mX;
  if (!Number.isFinite(bInf)) return null;
  return { bInf, c, samples: eff.length };
}

function fmtSigned(x) {
  if (!Number.isFinite(x)) return "NA";
  return (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(2);
}

function renderEquationPanel(container, rows) {
  if (!container) return;
  container.innerHTML = "";
  rows.forEach(r => {
    const item = document.createElement("div");
    item.className = "equation-item";
    const fitLine = Number.isFinite(r.fitSlope)
      ? `log10(y) = a ${fmtSigned(r.fitSlope)}·log10(x)`
      : "log10(y) = a + b·log10(x)";
    const asymLine = Number.isFinite(r.bInf)
      ? `y ∝ x^${r.bInf.toFixed(2)}`
      : "y ∝ x^b∞ (insufficient tail range)";
    const theoryLine = Number.isFinite(r.bTheory)
      ? `y ∝ x^${r.bTheory.toFixed(2)} (theory)`
      : "y ∝ x^b_th (no closed-form baseline)";
    const fsLine = (Number.isFinite(r.bInf) && Number.isFinite(r.c))
      ? `b_eff(S) = ${r.bInf.toFixed(2)} ${fmtSigned(r.c)} / S`
      : "b_eff(S) = b∞ + c/S";
    const deltaFitLine = (Number.isFinite(r.fitSlope) && Number.isFinite(r.bTheory))
      ? `Δfit = ${(r.fitSlope - r.bTheory).toFixed(2)}`
      : "Δfit = NA";
    const deltaAsymLine = (Number.isFinite(r.bInf) && Number.isFinite(r.bTheory))
      ? `Δasym = ${(r.bInf - r.bTheory).toFixed(2)}`
      : "Δasym = NA";
    item.innerHTML = `
      <div class="eq-title">${r.title}</div>
      <div class="eq-fit">Fit: ${fitLine}</div>
      <div class="eq-asym">Asymptote: ${asymLine}</div>
      <div class="eq-theoryline">Theory: ${theoryLine}</div>
      <div class="eq-fs">Finite-size: ${fsLine}</div>
      <div class="eq-delta">${deltaFitLine} · ${deltaAsymLine}</div>
    `;
    container.appendChild(item);
  });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function localSweep(center, delta, lo, hi) {
  const vals = [center - delta, center, center + delta].map(v => Number(clamp(v, lo, hi).toFixed(3)));
  return [...new Set(vals)].sort((a, b) => a - b);
}

function fitLogSlope(rows, xKey, yKey) {
  const pts = rows
    .map(r => ({ x: Number(r[xKey]), y: Number(r[yKey]) }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.y > 0)
    .map(p => ({ lx: Math.log10(p.x), ly: Math.log10(p.y) }));

  if (pts.length < 2) return null;
  const mx = pts.reduce((s, p) => s + p.lx, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.ly, 0) / pts.length;
  const sxx = pts.reduce((s, p) => s + (p.lx - mx) * (p.lx - mx), 0);
  if (sxx <= 1e-12) return null;
  const sxy = pts.reduce((s, p) => s + (p.lx - mx) * (p.ly - my), 0);
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const sse = pts.reduce((s, p) => {
    const yh = intercept + slope * p.lx;
    return s + (p.ly - yh) * (p.ly - yh);
  }, 0);
  const sst = pts.reduce((s, p) => s + (p.ly - my) * (p.ly - my), 0);
  const r2 = sst > 0 ? 1 - sse / sst : 1;

  return { slope, intercept, r2, n: pts.length };
}

function computeThetaFromDecay(lengthDecay, radiusDecay, nBranch = 2) {
  const logN = Math.log(nBranch);
  const a = -Math.log(radiusDecay) / logN;
  const b = -Math.log(lengthDecay) / logN;
  const denom = 2 * a + b;
  if (!Number.isFinite(denom) || denom <= 0) return null;
  return 1 / denom;
}

function buildTradeoffSurfacePoints(params) {
  const pathVals = localSweep(params.pathFraction, 0.2, 0, 1);
  const asymVals = localSweep(params.asymStrength, 0.3, 0, 1);
  const lenVals = localSweep(params.lengthDecay, 0.05, 0.6, 0.95);
  const radVals = localSweep(params.radiusDecay, 0.05, 0.55, 0.9);

  const sizeClasses = buildSizeClasses(params.minTips, params.maxTips, Math.max(4, params.classCount));
  const reps = 2;
  const rows = [];
  let comboId = 0;
  const pathYKey = params.pathScalingMetric === "maxPath" ? "maxPath" : "meanPath";

  for (const pf of pathVals) {
    for (const asym of asymVals) {
      for (const ld of lenVals) {
        for (const rd of radVals) {
          comboId += 1;
          const comboSamples = [];
          for (const targetTips of sizeClasses) {
            for (let rep = 1; rep <= reps; rep++) {
              const localParams = {
                ...params,
                pathFraction: pf,
                asymStrength: asym,
                lengthDecay: ld,
                radiusDecay: rd,
                seed: params.seed + comboId * 97 + rep * 13 + targetTips * 5
              };
              const tree = simulateTree(localParams, targetTips, rep);
              const met = computeTreeMetrics(tree, 0);
              comboSamples.push({
                mass: met.totalBiomass,
                meanPath: met.meanPathLen,
                maxPath: met.maxPathLen,
                leafCount: met.leafCount
              });
            }
          }

          const pathFit = fitLogSlope(comboSamples, "mass", pathYKey);
          const leafFit = fitLogSlope(comboSamples, "mass", "leafCount");
          const theta = computeThetaFromDecay(ld, rd);

          if (!pathFit || !leafFit || !Number.isFinite(theta)) continue;

          const meanPath = comboSamples.reduce((s, x) => s + x.meanPath, 0) / Math.max(comboSamples.length, 1);
          const isCenter =
            pf === Number(params.pathFraction.toFixed(3)) &&
            asym === Number(params.asymStrength.toFixed(3)) &&
            ld === Number(params.lengthDecay.toFixed(3)) &&
            rd === Number(params.radiusDecay.toFixed(3));

          rows.push({
            comboId,
            pathFraction: pf,
            asymStrength: asym,
            lengthDecay: ld,
            radiusDecay: rd,
            theta,
            lambdaPath: pathFit.slope,
            pathMetric: pathYKey,
            alphaLeaf: leafFit.slope,
            pathR2: pathFit.r2,
            leafR2: leafFit.r2,
            meanPath,
            sampleCount: comboSamples.length,
            isCenter
          });
        }
      }
    }
  }

  return rows;
}

function aggregateTradeoffSurface(rows) {
  return rows;
}

function computeTradeoffFrontier(rows) {
  return rows;
}

function colorByScale(value, lo, hi) {
  const t = hi > lo ? (value - lo) / (hi - lo) : 0.5;
  const tt = clamp(t, 0, 1);
  const r = Math.round(40 + tt * 190);
  const g = Math.round(80 + (1 - tt) * 120);
  const b = Math.round(180 - tt * 110);
  return `rgb(${r}, ${g}, ${b})`;
}

function drawTradeoffPanel(canvas, rows, cfg) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) return;

  const pad = { l: 54, r: 14, t: 22, b: 34 };
  const w = canvas.width - pad.l - pad.r;
  const h = canvas.height - pad.t - pad.b;

  const xs = rows.map(r => r[cfg.xKey]);
  const ys = rows.map(r => r[cfg.yKey]);
  const cs = rows.map(r => r[cfg.colorKey]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const cMin = Math.min(...cs), cMax = Math.max(...cs);

  const sx = x => pad.l + (x - xMin) / Math.max(xMax - xMin, 1e-9) * w;
  const sy = y => pad.t + h - (y - yMin) / Math.max(yMax - yMin, 1e-9) * h;

  ctx.strokeStyle = "#33404a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + h);
  ctx.lineTo(pad.l + w, pad.t + h);
  ctx.stroke();

  rows.forEach(r => {
    const x = sx(r[cfg.xKey]);
    const y = sy(r[cfg.yKey]);
    const isCenter = Boolean(r.isCenter);
    ctx.beginPath();
    ctx.arc(x, y, isCenter ? 4.4 : 3.1, 0, Math.PI * 2);
    ctx.fillStyle = colorByScale(r[cfg.colorKey], cMin, cMax);
    ctx.fill();
    if (isCenter) {
      ctx.strokeStyle = "#981f1f";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  });

  // Color legend for point encoding in this panel.
  const lgW = 90;
  const lgH = 8;
  const lgX = canvas.width - pad.r - lgW;
  const lgY = pad.t + 4;
  const grad = ctx.createLinearGradient(lgX, lgY, lgX + lgW, lgY);
  grad.addColorStop(0, colorByScale(cMin, cMin, cMax));
  grad.addColorStop(1, colorByScale(cMax, cMin, cMax));
  ctx.fillStyle = grad;
  ctx.fillRect(lgX, lgY, lgW, lgH);
  ctx.strokeStyle = "#5d6f67";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(lgX, lgY, lgW, lgH);

  ctx.fillStyle = "#33404a";
  ctx.font = "9px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`${cfg.colorLabel}: ${cMin.toFixed(2)} → ${cMax.toFixed(2)}`, lgX, lgY + lgH + 2);

  ctx.fillStyle = "#0f2018";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText(cfg.title, pad.l + 2, 2);

  ctx.fillStyle = "#33404a";
  ctx.font = "bold 10px sans-serif";
  const xW = ctx.measureText(cfg.xLabel).width;
  ctx.fillText(cfg.xLabel, pad.l + w / 2 - xW / 2, canvas.height - 4);
  ctx.save();
  ctx.translate(14, pad.t + h / 2 + 14);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(cfg.yLabel, 0, 0);
  ctx.restore();
}

function renderTradeoffSummary(container, rows) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = "";
    return;
  }

  const thetaVals = rows.map(r => r.theta);
  const pathVals = rows.map(r => r.lambdaPath);
  const leafVals = rows.map(r => r.alphaLeaf);
  const pathTrend = fitLogSlope(rows.map(r => ({ theta: Math.pow(10, r.theta), lambdaPath: Math.pow(10, r.lambdaPath) })), "theta", "lambdaPath");
  const leafTrend = fitLogSlope(rows.map(r => ({ theta: Math.pow(10, r.theta), alphaLeaf: Math.pow(10, r.alphaLeaf) })), "theta", "alphaLeaf");
  const center = rows.find(r => r.isCenter) || null;
  const pathMetricLabel = center && center.pathMetric === "maxPath" ? "max path length" : "mean path length";

  container.innerHTML = [
    `<div class="equation-item"><div class="eq-title">Theta range</div><div>${Math.min(...thetaVals).toFixed(2)} to ${Math.max(...thetaVals).toFixed(2)} across ${rows.length} architecture settings.</div></div>`,
    `<div class="equation-item"><div class="eq-title">Path-length scaling range</div><div>\u03bb_path from ${pathMetricLabel} in L ~ M^\u03bb spans ${Math.min(...pathVals).toFixed(2)} to ${Math.max(...pathVals).toFixed(2)}.</div></div>`,
    `<div class="equation-item"><div class="eq-title">Leaf scaling range</div><div>\u03b1_leaf in N_leaf ~ M^\u03b1 spans ${Math.min(...leafVals).toFixed(2)} to ${Math.max(...leafVals).toFixed(2)}.</div></div>`,
    `<div class="equation-item"><div class="eq-title">Trend with steeper theta</div><div>Path exponent trend: ${pathTrend ? pathTrend.slope.toFixed(2) : "NA"}; leaf exponent trend: ${leafTrend ? leafTrend.slope.toFixed(2) : "NA"}.</div></div>`,
    center ? `<div class="equation-item"><div class="eq-title">Current slider setting</div><div>Pf=${center.pathFraction.toFixed(2)}, asym=${center.asymStrength.toFixed(2)}, eta=${center.lengthDecay.toFixed(2)}, gamma=${center.radiusDecay.toFixed(2)}, theta=${center.theta.toFixed(2)}, \u03bb_path=${center.lambdaPath.toFixed(2)}, \u03b1_leaf=${center.alphaLeaf.toFixed(2)}</div></div>` : "",
    `<div class="equation-list eq-theory">Leaf scaling uses leaf count as an area proxy (constant mean leaf area assumption). Red-outlined point marks the current slider architecture. Color encodes \u03b1_leaf in the left panel and \u03bb_path in the right panel.</div>`
  ].join("");
}

function renderTradeoffSurfaces(params) {
  const points = buildTradeoffSurfacePoints(params);
  const agg = aggregateTradeoffSurface(points);
  const withFrontier = computeTradeoffFrontier(agg);

  drawTradeoffPanel(UI.tradeoffSurface, withFrontier, {
    xKey: "theta",
    yKey: "lambdaPath",
    colorKey: "alphaLeaf",
    title: "Theta vs path-length scaling",
    xLabel: "Theta (shallow to steep)",
    yLabel: `\u03bb_path (${params.pathScalingMetric === "maxPath" ? "max path" : "mean path"}) in L ~ M^\u03bb`,
    colorLabel: "color: \u03b1_leaf"
  });

  drawTradeoffPanel(UI.tradeoffFrontier, withFrontier, {
    xKey: "theta",
    yKey: "alphaLeaf",
    colorKey: "lambdaPath",
    title: "Theta vs leaf deployment scaling",
    xLabel: "Theta (shallow to steep)",
    yLabel: "\u03b1_leaf in N_leaf ~ M^\u03b1",
    colorLabel: `color: \u03bb_path (${params.pathScalingMetric === "maxPath" ? "max" : "mean"})`
  });

  renderTradeoffSummary(UI.eqTradeoff, withFrontier);
}

function renderTradeoffIfNeeded(force = false) {
  const shouldRender = force || state.activeTab === "tradeoff";
  if (!shouldRender || !state.lastParams) return;
  if (state.tradeoffRendering) return;
  if (state.renderedTradeoffRevision >= state.tradeoffRevision) return;

  const revision = state.tradeoffRevision;
  const params = { ...state.lastParams };
  state.tradeoffRendering = true;

  if (UI.eqTradeoff) {
    UI.eqTradeoff.innerHTML = '<div class="equation-item"><div class="eq-title">Computing theta diagnostics...</div><div>Running local architecture sweep for current controls.</div></div>';
  }

  setTimeout(() => {
    renderTradeoffSurfaces(params);
    state.renderedTradeoffRevision = revision;
    state.tradeoffRendering = false;
    if (state.activeTab === "tradeoff" && state.renderedTradeoffRevision < state.tradeoffRevision) {
      renderTradeoffIfNeeded(true);
    }
  }, 0);
}

// ── Baseline-aligned strip tree renderer ─────────────────────
// All trees share the same root y-position (strip bottom);
// taller trees grow further up — giving an instant size comparison.
function drawStripTree(svgEl, tree, maxTreeH) {
  svgEl.innerHTML = "";
  const vbW = 70, vbH = 90, margin = 3;
  const rootSvgY = vbH - margin;

  const xs   = tree.nodes.map(n => n.x);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const xMid = (xMin + xMax) / 2;
  const xSpan = Math.max(xMax - xMin, 1e-9);
  const ref   = Math.max(maxTreeH, 1e-9);

  const scaleY = (vbH - margin * 2) / ref;
  const scaleX = Math.min(scaleY, (vbW - margin * 2) / xSpan);

  const tx = x => vbW / 2 + (x - xMid) * scaleX;
  const ty = y => rootSvgY - y * scaleY;

  const nb = new Map(tree.nodes.map(n => [n.id, n]));
  for (const e of tree.edges) {
    const from = nb.get(e.from), to = nb.get(e.to);
    if (!from || !to) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", tx(from.x)); line.setAttribute("y1", ty(from.y));
    line.setAttribute("x2", tx(to.x));   line.setAttribute("y2", ty(to.y));
    line.setAttribute("stroke", e.isMain ? "#1f252a" : "#7f9298");
    line.setAttribute("stroke-width", Math.max(0.4, Math.sqrt(e.radius) * 4));
    line.setAttribute("stroke-linecap", "round");
    svgEl.appendChild(line);
  }
}

// ── Size class tree strip ─────────────────────────────────────
function renderSizeCards() {
  UI.treeStrip.innerHTML = "";
  if (!state.classes.length) return;

  const maxTreeH = Math.max(...state.classes.map(c =>
    Math.max(...c.tree.nodes.map(n => n.y), 1e-6)
  ));

  state.classes.forEach((item, idx) => {
    const m = computeTreeMetrics(item.tree, idx);
    const tipDelta = m.nTips - item.targetTips;
    const tipSign = tipDelta > 0 ? "+" : "";

    const div = document.createElement("div");
    div.className = "strip-item" + (idx === state.selectedIndex ? " selected" : "");
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");
    div.title = `requested=${item.targetTips}  realized=${m.nTips}  (Δ=${tipSign}${tipDelta})  ·  h=${m.height.toFixed(1)}  pf=${m.meanPathFrac.toFixed(2)}`;

    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.setAttribute("viewBox", "0 0 70 90");
    svgEl.setAttribute("width", "70");
    svgEl.setAttribute("height", "90");
    svgEl.setAttribute("aria-hidden", "true");

    const label = document.createElement("div");
    label.className = "strip-label";
    label.textContent = `${item.targetTips}→${m.nTips}`;

    div.append(svgEl, label);

    function select() {
      state.selectedIndex = idx;
      renderSizeCards();
      drawTreeSvg(UI.treeSvg, item.tree);
      drawWithinHistogram(item.tree);
      updateTreeMeta(m);
    }
    div.addEventListener("click", select);
    div.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    });

    UI.treeStrip.appendChild(div);
    requestAnimationFrame(() => drawStripTree(svgEl, item.tree, maxTreeH));
  });
}

function updateTreeMeta(m) {
  UI.treeMeta.textContent = [
    `Tips: ${m.nTips}`,
    `D: ${m.trunkDiameter.toFixed(3)}`,
    `Stem vol: ${m.stemVolume.toFixed(3)}`,
    `Net vol: ${m.networkVolume.toFixed(3)}`,
    `H: ${m.height.toFixed(2)}`,
    `Max path: ${m.maxPathLen.toFixed(2)}`,
    `Mean path: ${m.meanPathLen.toFixed(2)}`,
    `Smith Pf: ${m.meanPathFrac.toFixed(2)}`
  ].join("  ·  ");
}

// ── Tab switching ─────────────────────────────────────────────
function initTabs() {
  const activeBtn = document.querySelector(".tab-btn.active");
  state.activeTab = activeBtn ? activeBtn.dataset.tab : "paths";

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
      state.activeTab = btn.dataset.tab;
      if (state.activeTab === "tradeoff") renderTradeoffIfNeeded(true);
    });
  });
}

function drawDiameterAllometries(pts, params) {
  const th = computeExpectedExponents(params.lengthDecay, params.radiusDecay);
  const plots = [
    { canvas: UI.alloStemVol,  yKey: "stemVolume",    yLabel: "log10(stem volume)",      title: "Trunk diameter vs stem volume", thSlope: th ? th.bStemVsD : null },
    { canvas: UI.alloHeight,   yKey: "totalBiomass",  yLabel: "log10(total biomass)",    title: "Trunk diameter vs total biomass", thSlope: th ? th.bBiomassVsD : null },
    { canvas: UI.alloMaxPath,  yKey: "leafCount",     yLabel: "log10(leaf number)",      title: "Trunk diameter vs leaf number", thSlope: th ? th.bLeafVsD : null },
    { canvas: UI.alloMeanPath, yKey: "networkVolume", yLabel: "log10(network volume)",   title: "Trunk diameter vs network volume", thSlope: th ? th.bNetVsD : null },
    { canvas: UI.alloSumPath,  yKey: "totalPathLen",  yLabel: "log10(total network path length)", title: "Trunk diameter vs total network path length", thSlope: null },
    { canvas: UI.alloTotalLen, yKey: "height",        yLabel: "log10(height)",           title: "Trunk diameter vs height", thSlope: th ? th.bHeightVsD : null },
    { canvas: UI.alloPF,       yKey: "maxPathLen",    yLabel: "log10(max path length)",  title: "Trunk diameter vs max path length", thSlope: th ? th.bMaxPathVsD : null },
    { canvas: UI.alloSizeMeanPath, xKey: "nTips", yKey: "meanPathLen", yLabel: "log10(mean path length)", title: "Size (tips) vs mean path length", xLabel: "log10(size: tip count)", thSlope: th ? th.aL : null },
    { canvas: UI.alloSizeSumPath,  xKey: "nTips", yKey: "totalPathLen", yLabel: "log10(total network path length)", title: "Size (tips) vs total network path length", xLabel: "log10(size: tip count)", thSlope: null },
    { canvas: UI.alloSizeVarPath,  xKey: "nTips", yKey: "varPathLen",  yLabel: "log10(path length variance)", title: "Size (tips) vs path length variance", xLabel: "log10(size: tip count)", thSlope: null },
    { canvas: UI.alloSizeMaxPath,  xKey: "nTips", yKey: "maxPathLen",  yLabel: "log10(max path length)", title: "Size (tips) vs max path length", xLabel: "log10(size: tip count)", thSlope: th ? th.aL : null }
  ];

  const eqRows = [];
  plots.forEach(plot => {
    const xKey = plot.xKey || "trunkDiameter";
    const xLabel = plot.xLabel || "log10(trunk diameter)";
    const asym = estimateEmergentAsymptote(pts, xKey, plot.yKey);
    const fit = drawScatter(
      plot.canvas,
      pts,
      xKey,
      plot.yKey,
      xLabel,
      plot.yLabel,
      plot.title,
      false,
      asym ? asym.bInf : null,
      plot.thSlope
    );
    eqRows.push({
      title: plot.title,
      fitSlope: fit ? fit.slope : null,
      bInf: asym ? asym.bInf : null,
      c: asym ? asym.c : null,
      bTheory: plot.thSlope
    });
  });
  renderEquationPanel(UI.eqDiameter, eqRows);
}

// Leaf-based tab: leaf number on y-axis, structural metric on x.
// WBE expected slopes (x → leaf number):
//   trunk diameter → N: b ≈ 2.00  (area-preserving: N ∝ D²)
//   height         → N: b ≈ 3.00  (volume-filling:  H ∝ N^(1/3))
//   network volume → N: b ≈ 0.75  (N ∝ V^(3/4))
//   stem volume    → N: b ≈ 0.75
//   total biomass  → N: b ≈ 0.75
//   max path len   → N: b ≈ 3.00  (path ∝ height)
function drawLeafAllometries(pts, params) {
  const th = computeExpectedExponents(params.lengthDecay, params.radiusDecay);
  const plots = [
    { canvas: UI.alloStemVol2,  xKey: "stemVolume",    xLabel: "log10(stem volume)",      title: "Stem volume → leaf number", thSlope: th ? th.bLeafVsStem : null },
    { canvas: UI.alloHeight2,   xKey: "totalBiomass",  xLabel: "log10(total biomass)",    title: "Total biomass → leaf number", thSlope: th ? th.bLeafVsBiomass : null },
    { canvas: UI.alloMaxPath2,  xKey: "trunkDiameter", xLabel: "log10(trunk diameter)",   title: "Trunk diameter → leaf number", thSlope: th ? th.bLeafVsD : null },
    { canvas: UI.alloMeanPath2, xKey: "networkVolume", xLabel: "log10(network volume)",   title: "Network volume → leaf number", thSlope: th ? th.bLeafVsNet : null },
    { canvas: UI.alloTotalLen2, xKey: "height",        xLabel: "log10(height)",           title: "Height → leaf number", thSlope: th ? th.bLeafVsHeight : null },
    { canvas: UI.alloPF2,       xKey: "maxPathLen",    xLabel: "log10(max path length)",  title: "Max path → leaf number", thSlope: th ? th.bLeafVsMaxPath : null }
  ];

  const eqRows = [];
  plots.forEach(plot => {
    const asym = estimateEmergentAsymptote(pts, plot.xKey, "leafCount");
    const fit = drawScatter(
      plot.canvas,
      pts,
      plot.xKey,
      "leafCount",
      plot.xLabel,
      "log10(leaf number)",
      plot.title,
      false,
      asym ? asym.bInf : null,
      plot.thSlope
    );
    eqRows.push({
      title: plot.title,
      fitSlope: fit ? fit.slope : null,
      bInf: asym ? asym.bInf : null,
      c: asym ? asym.c : null,
      bTheory: plot.thSlope
    });
  });
  renderEquationPanel(UI.eqLeaf, eqRows);
}

// ── Main simulation run ───────────────────────────────────────
function runSimulation() {
  const params = getInputs();
  state.lastParams = { ...params };
  state.tradeoffRevision += 1;

  state.classes = params.sizeClasses.map((targetTips, idx) => ({
    targetTips,
    tree: simulateTree(params, targetTips, idx * 13)
  }));
  state.selectedIndex = 0;

  const sel = state.classes[0];
  const m   = computeTreeMetrics(sel.tree, 0);
  drawTreeSvg(UI.treeSvg, sel.tree);
  updateTreeMeta(m);
  renderSizeCards();
  drawWithinHistogram(sel.tree);
  drawAcrossHistogram(state.classes);

  // Allometry: wider size range with replicates for meaningful scatter
  state.alloPoints = buildAllometryPoints(params);
  drawDiameterAllometries(state.alloPoints, params);
  drawLeafAllometries(state.alloPoints, params);
  renderTradeoffIfNeeded(false);
}

// ── Event listeners & init ────────────────────────────────────
document.querySelectorAll(".controls input[type='range']").forEach(el =>
  el.addEventListener("input", syncSliderOutputs)
);

UI.generateBtn.addEventListener("click", runSimulation);

UI.wbeSnapBtn.addEventListener("click", () => {
  snapToWbe();
  runSimulation();
});

if (UI.balancedWbeMode) {
  UI.balancedWbeMode.addEventListener("change", syncSliderOutputs);
}

if (UI.tradeoffPathMetric) {
  UI.tradeoffPathMetric.addEventListener("change", () => {
    state.tradeoffRevision += 1;
    renderTradeoffIfNeeded(true);
  });
}

initTabs();
syncSliderOutputs();
positionWbeTicks();
runSimulation();
