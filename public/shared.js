// Shared roof math + pricing formula. Runs on the server (require) AND in the browser (window.RQShared),
// so the demo mode and the live server always calculate exactly the same price.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RQShared = factory();
})(typeof self !== "undefined" ? self : this, function () {
const SQFT_PER_M2 = 10.7639;
const riseFromDegrees = (deg) => Math.tan((deg * Math.PI) / 180) * 12;

function haversineM(a, b) {
  const R = 6371000, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Turn the raw Solar response into the numbers the pricing formula needs.
function normalize(insights, geo, measurementCfg = {}) {
  const sp = insights.solarPotential || {};
  const minSeg = measurementCfg.minSegmentSqFt ?? 15;
  const segments = (sp.roofSegmentStats || [])
    .map((s) => {
      const areaSqFt = (s.stats?.areaMeters2 || 0) * SQFT_PER_M2;
      const pitchDeg = s.pitchDegrees || 0;
      return {
        areaSqFt,
        groundSqFt: (s.stats?.groundAreaMeters2 || 0) * SQFT_PER_M2,
        pitchDeg,
        pitchRise: riseFromDegrees(pitchDeg),
        azimuthDeg: s.azimuthDegrees || 0,
        heightM: s.planeHeightAtCenterMeters || 0,
        box: s.boundingBox,
      };
    })
    .filter((s) => s.areaSqFt >= minSeg);

  const totalAreaSqFt = segments.reduce((t, s) => t + s.areaSqFt, 0);
  const groundAreaSqFt = segments.reduce((t, s) => t + s.groundSqFt, 0);
  // Area-weighted predominant pitch
  const weightedRise = totalAreaSqFt ? segments.reduce((t, s) => t + s.pitchRise * s.areaSqFt, 0) / totalAreaSqFt : 0;
  const maxHeight = Math.max(0, ...segments.map((s) => s.heightM));
  const estStories = maxHeight === 0 ? 1 : maxHeight < 5.5 ? 1 : maxHeight < 8.5 ? 2 : 3;

  const center = { lat: insights.center?.latitude, lng: insights.center?.longitude };
  const distanceFromAddressM = geo && center.lat ? Math.round(haversineM(geo, center)) : null;

  return {
    quality: insights.imageryQuality || 'UNKNOWN',
    imageryDate: insights.imageryDate ? `${insights.imageryDate.year}-${String(insights.imageryDate.month).padStart(2, '0')}` : null,
    center,
    boundingBox: insights.boundingBox,
    distanceFromAddressM,
    segments,
    facets: segments.length,
    totalAreaSqFt: Math.round(totalAreaSqFt),
    groundAreaSqFt: Math.round(groundAreaSqFt),
    predominantPitch: `${Math.round(weightedRise)}/12`,
    predominantRise: weightedRise,
    estStories,
  };
}

// Placeholder image for mock mode (no API key yet)
function mockSvg(m) {
  const bb = m.boundingBox;
  const W = 640, H = 400;
  const x = (lng) => ((lng - bb.sw.longitude) / (bb.ne.longitude - bb.sw.longitude)) * 420 + 110;
  const y = (lat) => H - (((lat - bb.sw.latitude) / (bb.ne.latitude - bb.sw.latitude)) * 270 + 70);
  // Shade each plane by the direction it faces, like sunlight on a real aerial photo
  const shade = (az) => { const l = 34 + 14 * Math.cos(((az - 160) * Math.PI) / 180); return `hsl(25, 8%, ${l.toFixed(0)}%)`; };
  const planes = m.segments.slice().sort((a, b) => b.heightM - a.heightM).reverse().map((s) => {
    const { sw, ne } = s.box;
    const rx = x(sw.longitude), ry = y(ne.latitude), rw = x(ne.longitude) - rx, rh = y(sw.latitude) - ry;
    return `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${shade(s.azimuthDeg)}"/>` +
      `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="#f9731622" stroke="#f97316" stroke-width="2.5"/>`;
  }).join('');
  const trees = [[60, 70, 38], [585, 330, 44], [40, 320, 30], [600, 80, 26]].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#2f4f2a"/><circle cx="${cx - r / 4}" cy="${cy - r / 4}" r="${r * 0.6}" fill="#3d6334"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#55704a"/><rect x="0" y="352" width="${W}" height="48" fill="#8a8f8c"/><rect x="300" y="300" width="60" height="60" fill="#b9bcb8"/>` +
    trees + planes +
    `<rect x="12" y="12" width="250" height="28" rx="6" fill="#111827cc"/><text x="24" y="31" fill="#fff" font-family="system-ui,sans-serif" font-size="13" font-weight="600">DEMO ROOF · real satellite photo when live</text></svg>`;
}

const round2 = (n) => Math.round(n * 100) / 100;

function monthlyPayment(principal, aprPercent, months) {
  const r = aprPercent / 100 / 12;
  if (!months) return 0;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/**
 * @param {object} m   normalized measurement (lib/solar.js normalize) – segments, facets, quality
 * @param {object} a   homeowner answers: { materialId, layers, stories, skylights, chimneys }
 * @param {object} cfg config.json
 */
function computeQuote(m, a, cfg, materialIdOverride) {
  const material = cfg.materials.find((x) => x.id === (materialIdOverride || a.materialId)) || cfg.materials.find((x) => x.enabled);
  if (material.percentOf) return percentQuote(m, a, cfg, material);
  const lines = [];
  const add = (label, amount, detail) => { if (amount) lines.push({ label, amount: round2(amount), detail }); };

  const adj = 1 + (cfg.measurement.areaAdjustmentPercent || 0) / 100;

  // --- Area by pitch bucket ---
  let pitchedSqFt = 0, lowSlopeSqFt = 0;
  const steepSqFt = cfg.steepPitch.map(() => 0);
  const tiers = cfg.steepPitch.map((t, i) => ({ ...t, i })).sort((x, y) => y.minRise - x.minRise);
  for (const s of m.segments) {
    const area = s.areaSqFt * adj;
    if (s.pitchRise < cfg.lowSlope.maxRise) { lowSlopeSqFt += area; continue; }
    pitchedSqFt += area;
    const tier = tiers.find((t) => s.pitchRise >= t.minRise);
    if (tier) steepSqFt[tier.i] += area;
  }
  const totalSqFt = pitchedSqFt + lowSlopeSqFt;

  // --- Waste ---
  const w = cfg.waste;
  const wastePct = Math.min(w.maxPercent, w.basePercent + Math.max(0, m.facets - w.facetThreshold) * w.extraPercentPerFacet);
  const wasteMult = 1 + wastePct / 100;

  const pitchedSquares = (pitchedSqFt / 100) * wasteMult;
  const lowSlopeSquares = (lowSlopeSqFt / 100) * wasteMult;
  const totalSquares = pitchedSquares + lowSlopeSquares;

  add(`${material.name}`, pitchedSquares * material.pricePerSquare, `${pitchedSquares.toFixed(1)} sq × $${material.pricePerSquare} (incl. ${wastePct.toFixed(1)}% waste)`);
  add(cfg.lowSlope.label, lowSlopeSquares * cfg.lowSlope.pricePerSquare, `${lowSlopeSquares.toFixed(1)} sq × $${cfg.lowSlope.pricePerSquare}`);

  cfg.steepPitch.forEach((t, i) => {
    const sq = (steepSqFt[i] / 100) * wasteMult;
    add(t.label, sq * t.extraPerSquare, `${sq.toFixed(1)} sq × $${t.extraPerSquare}`);
  });

  // --- Stories ---
  const stories = String(Math.min(3, Math.max(1, parseInt(a.stories, 10) || m.estStories || 1)));
  const storyRate = cfg.stories[stories] || 0;
  add(`${stories}-story access`, totalSquares * storyRate, `${totalSquares.toFixed(1)} sq × $${storyRate}`);

  // --- Tear-off ---
  const layers = a.layers === 'unknown' || a.layers == null || a.layers === '' ? cfg.tearOff.assumeLayersIfUnknown : parseInt(a.layers, 10) || 0;
  add(`Tear-off (${layers} layer${layers === 1 ? '' : 's'})`, totalSquares * layers * cfg.tearOff.perSquarePerLayer, `${totalSquares.toFixed(1)} sq × ${layers} × $${cfg.tearOff.perSquarePerLayer}`);

  // --- Extras ---
  const sky = Math.max(0, parseInt(a.skylights, 10) || 0);
  const chim = Math.max(0, parseInt(a.chimneys, 10) || 0);
  add(`Skylight flashing/reseal (${sky})`, sky * cfg.extras.perSkylight);
  add(`Chimney flashing (${chim})`, chim * cfg.extras.perChimney);
  for (const f of cfg.flatFees) add(f.label, f.amount);

  let subtotal = lines.reduce((t, l) => t + l.amount, 0);

  // --- Complexity ---
  if (m.facets > cfg.complexity.facetThreshold) {
    const c = subtotal * (cfg.complexity.extraPercent / 100);
    add(`Complex roof (${m.facets} planes)`, c);
    subtotal += c;
  }

  // --- Minimum ---
  if (subtotal < cfg.minimumJob) {
    add('Minimum job adjustment', cfg.minimumJob - subtotal);
    subtotal = cfg.minimumJob;
  }

  // --- Range ---
  const rPct = cfg.rangePercentByQuality[m.quality] ?? cfg.rangePercentByQuality.UNKNOWN ?? 15;
  const ro = cfg.roundTo || 1;
  const low = Math.floor((subtotal * (1 - rPct / 100)) / ro) * ro;
  const high = Math.ceil((subtotal * (1 + rPct / 100)) / ro) * ro;

  const fin = cfg.financing?.enabled
    ? { monthlyFrom: Math.round(monthlyPayment(low, cfg.financing.aprPercent, cfg.financing.termMonths)), aprPercent: cfg.financing.aprPercent, termMonths: cfg.financing.termMonths }
    : null;

  return {
    materialId: material.id,
    materialName: material.name,
    roofSqFt: Math.round(totalSqFt),
    squares: round2(totalSquares),
    wastePercent: round2(wastePct),
    stories: Number(stories),
    layers,
    lines,
    mid: Math.round(subtotal),
    low, high, rangePercent: rPct,
    financing: fin,
  };
}

// Priced as a percentage of another material's full estimate for the same roof
// (e.g. roof rejuvenation = 50% of an architectural shingle replacement).
function percentQuote(m, a, cfg, material) {
  const baseMat = cfg.materials.find((x) => x.id === material.percentOf);
  if (!baseMat || baseMat.percentOf) throw new Error(`"${material.name}" must be a percentage of a regular per-square material (check its "% of" ID).`);
  // Treatments don't remove old roofing, so the base is a standard 1-layer job whatever the homeowner picked
  const base = computeQuote(m, material.noTearOff ? { ...a, layers: '1' } : a, cfg, baseMat.id);
  const pct = Number(material.percent) || 0;
  const mid = base.mid * pct / 100;
  const rPct = cfg.rangePercentByQuality[m.quality] ?? cfg.rangePercentByQuality.UNKNOWN ?? 15;
  const ro = cfg.roundTo || 1;
  const low = Math.floor((mid * (1 - rPct / 100)) / ro) * ro;
  const high = Math.ceil((mid * (1 + rPct / 100)) / ro) * ro;
  return {
    materialId: material.id,
    materialName: material.name,
    roofSqFt: base.roofSqFt,
    squares: base.squares,
    wastePercent: 0,
    stories: base.stories,
    layers: material.noTearOff ? 0 : base.layers,
    noTearOff: !!material.noTearOff,
    note: material.note || '',
    lines: [{ label: `${material.name}`, amount: round2(mid), detail: `${pct}% of the ${baseMat.name} replacement price ($${base.mid.toLocaleString('en-US')})` }],
    mid: Math.round(mid),
    low, high, rangePercent: rPct,
    financing: cfg.financing?.enabled
      ? { monthlyFrom: Math.round(monthlyPayment(low, cfg.financing.aprPercent, cfg.financing.termMonths)), aprPercent: cfg.financing.aprPercent, termMonths: cfg.financing.termMonths }
      : null,
  };
}

function quoteAllMaterials(m, a, cfg) {
  return cfg.materials.filter((x) => x.enabled).map((mat) => computeQuote(m, a, cfg, mat.id));
}


  return { normalize, riseFromDegrees, haversineM, mockSvg, computeQuote, quoteAllMaterials, monthlyPayment };
});
