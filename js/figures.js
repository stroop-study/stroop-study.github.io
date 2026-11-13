// Figures (graphiques et tableaux) intégrées aux questions et aux fiches.
// Tout est dessiné en SVG à partir d'une petite description JSON, pour rester léger,
// hors ligne et lisible en thème clair comme en thème sombre.
//
//   histo    : { type:'histo', x:[...], y:[...], xlabel, ylabel, reperes:[{x, label}] }
//   barres   : { type:'barres', categories:[...], series:[{nom, valeurs:[...]}], ylabel, ymin, ymax }
//   lignes   : { type:'lignes', categories:[...], series:[{nom, valeurs:[...]}], ylabel, ymin, ymax }
//   courbe   : { type:'courbe', forme:'normale'|'asym-pos'|'asym-neg'|'pointue'|'aplatie',
//                sigmas:true, reference:true, reperes:['moyenne','mediane','mode'] }
//   nuage    : { type:'nuage', r:0.8, n:40, points:[[x,y]...], xlabel, ylabel, droite:true }
//   tableau  : { type:'tableau', entetes:[...], lignes:[[...]] }
// Champs communs : titre, legende.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = 340, H = 210, PAD = { l: 38, r: 12, t: 14, b: 40 };
const fmt = (v) => (Math.round(v * 100) / 100).toString().replace('.', ',');

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function nTicks(min, max) {
  const r = max - min;
  for (const t of [5, 4, 6, 3]) { const st = r / t; if (Math.abs(st - Math.round(st)) < 1e-9 || Math.abs(st * 10 - Math.round(st * 10)) < 1e-9 && r < 2) return t; }
  return 4;
}

function yAxis(min, max, ylabel) {
  const ih = H - PAD.t - PAD.b, ticks = nTicks(min, max);
  let s = '';
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks, y = PAD.t + ih - (ih * i) / ticks;
    s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" class="fg-grid"/><text x="${PAD.l - 5}" y="${y + 3.5}" text-anchor="end" class="fg-t">${fmt(v)}</text>`;
  }
  if (ylabel) s += `<text transform="translate(10 ${PAD.t + ih / 2}) rotate(-90)" text-anchor="middle" class="fg-t">${esc(ylabel)}</text>`;
  return s;
}

function xLabel(txt) { return txt ? `<text x="${PAD.l + (W - PAD.l - PAD.r) / 2}" y="${H - 4}" text-anchor="middle" class="fg-t">${esc(txt)}</text>` : ''; }

function histo(f) {
  const n = f.x.length, iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const max = niceMax(Math.max(...f.y)), bw = iw / n;
  const every = n > 24 ? 4 : n > 14 ? 2 : 1;
  let s = yAxis(0, max, f.ylabel || 'Effectif');
  f.y.forEach((v, i) => {
    const h = (ih * v) / max, x = PAD.l + i * bw;
    s += `<rect x="${x + 0.5}" y="${PAD.t + ih - h}" width="${Math.max(bw - 1, 1)}" height="${h}" class="fg-bar"/>`;
    if (i % every === 0) s += `<text x="${x + bw / 2}" y="${PAD.t + ih + 13}" text-anchor="middle" class="fg-t">${esc(f.x[i])}</text>`;
  });
  (f.reperes || []).forEach((r, k) => {
    const i = f.x.findIndex((v) => String(v) === String(r.x));
    const pos = i >= 0 ? PAD.l + i * bw + bw / 2 : PAD.l + ((Number(r.x) - Number(f.x[0])) / (Number(f.x[n - 1]) - Number(f.x[0]))) * (iw - bw) + bw / 2;
    s += `<line x1="${pos}" x2="${pos}" y1="${PAD.t}" y2="${PAD.t + ih}" class="fg-mark"/><text x="${pos + 3}" y="${PAD.t + 9 + k * 11}" class="fg-t b">${esc(r.label)}</text>`;
  });
  return s + `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${PAD.t + ih}" y2="${PAD.t + ih}" class="fg-axis"/>` + xLabel(f.xlabel);
}

function barres(f) {
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b - 14 - (f.series.length > 1 ? 0 : -14) - (Math.max(...f.categories.map((k) => String(k).length)) * 5.4 > iw / f.categories.length ? 10 : 0);
  const all = f.series.flatMap((s) => s.valeurs);
  const min = f.ymin ?? 0, max = f.ymax ?? niceMax(Math.max(...all));
  const gw = iw / f.categories.length, ns = f.series.length, bw = Math.min(34, (gw * 0.7) / ns);
  const yOf = (v) => PAD.t + ih - (ih * (v - min)) / (max - min);
  let s = '';
  const nt = nTicks(min, max);
  for (let i = 0; i <= nt; i++) {
    const v = min + ((max - min) * i) / nt, y = yOf(v);
    s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" class="fg-grid"/><text x="${PAD.l - 5}" y="${y + 3.5}" text-anchor="end" class="fg-t">${fmt(v)}</text>`;
  }
  if (f.ylabel) s += `<text transform="translate(10 ${PAD.t + ih / 2}) rotate(-90)" text-anchor="middle" class="fg-t">${esc(f.ylabel)}</text>`;
  f.categories.forEach((c, ci) => {
    const x0 = PAD.l + ci * gw + (gw - bw * ns) / 2;
    f.series.forEach((se, si) => {
      const v = se.valeurs[ci], y = yOf(v);
      s += `<rect x="${x0 + si * bw}" y="${y}" width="${bw - 2}" height="${PAD.t + ih - y}" rx="3" class="fg-bar s${si}"/>
        <text x="${x0 + si * bw + (bw - 2) / 2}" y="${y - 3}" text-anchor="middle" class="fg-t b">${fmt(v)}</text>`;
    });
    const crowded = Math.max(...f.categories.map((k) => String(k).length)) * 5.4 > gw;
    s += `<text x="${PAD.l + ci * gw + gw / 2}" y="${PAD.t + ih + 13 + (crowded && ci % 2 ? 10 : 0)}" text-anchor="middle" class="fg-t">${esc(c)}</text>`;
  });
  if (ns > 1) {
    let lx = PAD.l;
    f.series.forEach((se, si) => { s += `<rect x="${lx}" y="${H - 13}" width="10" height="10" rx="2" class="fg-bar s${si}"/><text x="${lx + 14}" y="${H - 4.5}" class="fg-t">${esc(se.nom)}</text>`; lx += 24 + se.nom.length * 6; });
  }
  return s + `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${PAD.t + ih}" y2="${PAD.t + ih}" class="fg-axis"/>`;
}

function lignes(f) {
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b - 14;
  const all = f.series.flatMap((s) => s.valeurs);
  const min = f.ymin ?? Math.floor(Math.min(...all) * 0.9), max = f.ymax ?? niceMax(Math.max(...all));
  const yOf = (v) => PAD.t + ih - (ih * (v - min)) / (max - min);
  const gw = iw / f.categories.length, xOf = (i) => PAD.l + gw * i + gw / 2;
  let s = '';
  const nt = nTicks(min, max);
  for (let i = 0; i <= nt; i++) {
    const v = min + ((max - min) * i) / nt, y = yOf(v);
    s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" class="fg-grid"/><text x="${PAD.l - 5}" y="${y + 3.5}" text-anchor="end" class="fg-t">${fmt(v)}</text>`;
  }
  if (f.ylabel) s += `<text transform="translate(10 ${PAD.t + ih / 2}) rotate(-90)" text-anchor="middle" class="fg-t">${esc(f.ylabel)}</text>`;
  f.categories.forEach((c, i) => { s += `<text x="${xOf(i)}" y="${PAD.t + ih + 13}" text-anchor="middle" class="fg-t">${esc(c)}</text>`; });
  f.series.forEach((se, si) => {
    s += `<path d="${se.valeurs.map((v, i) => `${i ? 'L' : 'M'}${xOf(i)} ${yOf(v)}`).join(' ')}" class="fg-line s${si}"/>`;
    se.valeurs.forEach((v, i) => { s += `<circle cx="${xOf(i)}" cy="${yOf(v)}" r="4" class="fg-dot s${si}"/><text x="${xOf(i) + 7}" y="${yOf(v) + 4}" class="fg-t b">${fmt(v)}</text>`; });
  });
  let lx = PAD.l;
  f.series.forEach((se, si) => { s += `<rect x="${lx}" y="${H - 13}" width="10" height="10" rx="5" class="fg-bar s${si}"/><text x="${lx + 14}" y="${H - 4.5}" class="fg-t">${esc(se.nom)}</text>`; lx += 24 + se.nom.length * 6; });
  return s + `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${PAD.t + ih}" y2="${PAD.t + ih}" class="fg-axis"/>`;
}

// Densités : normale, normale asymétrique (skew-normal), pointue (t de Student), aplatie.
const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
const logn = (t) => (t <= 0 ? 0 : Math.exp(-((Math.log(t) - 0.6) ** 2) / (2 * 0.5 ** 2)) / (t * 0.5 * Math.sqrt(2 * Math.PI)));
const DENS = {
  normale: phi,
  'asym-pos': (x) => logn(x + 2),
  'asym-neg': (x) => logn(-x + 2),
  pointue: (x) => { const v = 3; return Math.pow(1 + (x / 0.6) ** 2 / v, -(v + 1) / 2) * 0.6366 / 0.6 * 0.55; },
  aplatie: (x) => Math.exp(-Math.pow(Math.abs(x) / 1.9, 4)) * 0.235,
};

function courbe(f) {
  const forme = DENS[f.forme] ? f.forme : 'normale', d = DENS[forme];
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b, xmin = -3.6, xmax = 3.6;
  const X = (x) => PAD.l + ((x - xmin) / (xmax - xmin)) * iw;
  const samples = []; for (let x = xmin; x <= xmax + 1e-9; x += 0.05) samples.push([x, d(x)]);
  const ymax = Math.max(...samples.map((p) => p[1]), f.reference ? phi(0) : 0) * 1.12;
  const Y = (y) => PAD.t + ih - (y / ymax) * ih;
  const path = (dd) => samples.map(([x], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(dd(x)).toFixed(1)}`).join(' ');
  let s = '';
  if (f.sigmas && forme === 'normale') {
    [[3, 'z3'], [2, 'z2'], [1, 'z1']].forEach(([k, cls]) => {
      const pts = samples.filter(([x]) => x >= -k - 1e-9 && x <= k + 1e-9);
      s += `<path d="M${X(-k)} ${Y(0)} ${pts.map(([x, y]) => `L${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join(' ')} L${X(k)} ${Y(0)} Z" class="fg-zone ${cls}"/>`;
    });
    [[-0.5, '34 %'], [0.5, '34 %'], [-1.5, '13,5 %'], [1.5, '13,5 %'], [-2.45, '2 %'], [2.45, '2 %']].forEach(([x, t]) => {
      s += `<text x="${X(x)}" y="${Math.abs(x) > 2 ? Y(0) - 18 : Y(0) - 8}" text-anchor="middle" class="fg-t b">${t}</text>`;
    });
    [-3, -2, -1, 0, 1, 2, 3].forEach((k) => { s += `<line x1="${X(k)}" x2="${X(k)}" y1="${Y(0)}" y2="${Y(0) + 4}" class="fg-axis"/><text x="${X(k)}" y="${Y(0) + 15}" text-anchor="middle" class="fg-t">${k === 0 ? 'µ' : (k > 0 ? '+' : '−') + Math.abs(k) + 'σ'}</text>`; });
  }
  if (f.reference && forme !== 'normale') s += `<path d="${path(phi)}" class="fg-ref"/>`;
  s += `<path d="${path(d)}" class="fg-line"/>`;
  if (f.reperes?.length) {
    // position approchée des indices de tendance centrale
    let mode = samples.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const tot = samples.reduce((a, [, y]) => a + y, 0); let acc = 0, med = 0, mean = 0;
    for (const [x, y] of samples) { acc += y; if (!med && acc >= tot / 2) med = x; mean += x * y; }
    mean /= tot;
    const pos = { moyenne: mean, mediane: med, mode };
    const lab = { moyenne: 'Moy.', mediane: 'Méd.', mode: 'Mode' };
    f.reperes.forEach((r, k) => { const x = X(pos[r]); s += `<line x1="${x}" x2="${x}" y1="${PAD.t + 4}" y2="${Y(0)}" class="fg-mark"/><text x="${x}" y="${PAD.t + 10 + k * 11}" text-anchor="middle" class="fg-t b fg-bg">${lab[r]}</text>`; });
  }
  s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(0)}" y2="${Y(0)}" class="fg-axis"/>`;
  if (f.reference && forme !== 'normale') s += `<text x="${W - PAD.r}" y="${PAD.t + 8}" text-anchor="end" class="fg-t">--- loi normale</text>`;
  return s + xLabel(f.xlabel || (f.sigmas ? '' : 'Scores'));
}

// Générateur pseudo-aléatoire déterministe pour que le nuage soit toujours le même.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }

function pearson(pts) {
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy || 1);
}

function nuage(f) {
  let pts = f.points;
  if (!pts) {
    const n = f.n || 40, rho = Math.max(-1, Math.min(1, f.r ?? 0));
    const gen = (seed) => { const r = rng(seed); return Array.from({ length: n }, () => { const a = gauss(r), b = gauss(r); return [a, rho * a + Math.sqrt(1 - rho * rho) * b]; }); };
    // on cherche (de façon déterministe) un tirage dont le r observé colle à la valeur voulue
    let best = null, bestD = 9;
    for (let seed = f.seed || 1; seed < (f.seed || 1) + 200; seed++) { const g = gen(seed), d = Math.abs(pearson(g) - rho); if (d < bestD) { best = g; bestD = d; } if (d < 0.02) break; }
    pts = best;
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const X = (x) => PAD.l + 6 + ((x - x0) / (x1 - x0 || 1)) * (iw - 12), Y = (y) => PAD.t + ih - 6 - ((y - y0) / (y1 - y0 || 1)) * (ih - 12);
  let s = `<line x1="${PAD.l}" x2="${PAD.l}" y1="${PAD.t}" y2="${PAD.t + ih}" class="fg-axis"/><line x1="${PAD.l}" x2="${W - PAD.r}" y1="${PAD.t + ih}" y2="${PAD.t + ih}" class="fg-axis"/>`;
  if (f.droite) {
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const sxy = pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0), sxx = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0);
    const b = sxy / (sxx || 1), a = my - b * mx;
    s += `<line x1="${X(x0)}" y1="${Y(a + b * x0)}" x2="${X(x1)}" y2="${Y(a + b * x1)}" class="fg-mark"/>`;
  }
  pts.forEach(([x, y]) => { s += `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="3.4" class="fg-dot"/>`; });
  if (f.ylabel) s += `<text transform="translate(14 ${PAD.t + ih / 2}) rotate(-90)" text-anchor="middle" class="fg-t">${esc(f.ylabel)}</text>`;
  return s + xLabel(f.xlabel);
}

function tableau(f) {
  return `<div class="fg-tablewrap"><table class="fg-table">${f.entetes ? `<thead><tr>${f.entetes.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}
    <tbody>${f.lignes.map((l) => `<tr>${l.map((c, i) => i === 0 && f.entetes ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const DRAW = { histo, barres, lignes, courbe, nuage };

/** Rend une figure (ou une liste de figures) en HTML. Renvoie '' si rien à afficher. */
export function figureHtml(f) {
  if (!f) return '';
  if (Array.isArray(f)) return `<div class="fg-row">${f.map(figureHtml).join('')}</div>`;
  let inner = '';
  try {
    if (f.type === 'tableau') inner = tableau(f);
    else if (DRAW[f.type]) inner = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(f.titre || f.legende || 'Graphique')}">${DRAW[f.type](f)}</svg>`;
    else return '';
  } catch (e) { console.warn('Figure illisible', e); return ''; }
  return `<figure class="fg">${f.titre ? `<figcaption class="fg-title">${esc(f.titre)}</figcaption>` : ''}${inner}${f.legende ? `<figcaption class="fg-leg">${esc(f.legende)}</figcaption>` : ''}</figure>`;
}

/** Vérifie une figure à l'import. Lance une erreur si elle est mal formée. */
export function checkFigure(f, id) {
  const list = Array.isArray(f) ? f : [f];
  for (const g of list) {
    const bad = (w) => { throw new Error(`Figure ${w} : ${id}`); };
    if (!g || typeof g !== 'object') bad('invalide');
    switch (g.type) {
      case 'histo': if (!Array.isArray(g.x) || !Array.isArray(g.y) || g.x.length !== g.y.length) bad('histogramme incomplète'); break;
      case 'barres': if (!Array.isArray(g.categories) || !Array.isArray(g.series) || g.series.some((s) => s.valeurs?.length !== g.categories.length)) bad('barres incomplète'); break;
      case 'lignes': if (!Array.isArray(g.categories) || !Array.isArray(g.series) || g.series.some((s) => s.valeurs?.length !== g.categories.length)) bad('courbes incomplète'); break;
      case 'courbe': break;
      case 'nuage': if (!g.points && typeof g.r !== 'number') bad('nuage incomplète'); break;
      case 'tableau': if (!Array.isArray(g.lignes)) bad('tableau incomplète'); break;
      default: bad(`de type inconnu (${g.type})`);
    }
  }
}
