// Boîte de Leitner : 5 boîtes. Boîte 0 = jamais vue.
// Intervalle (en jours) avant qu'un élément redevienne « à revoir », selon sa boîte.
export const INTERVALS = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
export const MAX_BOX = 5;

const DAY = 24 * 60 * 60 * 1000;

export function today(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

export function startOfDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

/** Un élément est-il à revoir aujourd'hui ? */
export function isDue(p, now = Date.now()) {
  if (!p || !p.box) return true; // jamais vu
  const interval = INTERVALS[p.box] ?? 0;
  return startOfDay(p.last) + interval * DAY <= startOfDay(now);
}

/**
 * Nouvel état d'un élément après une réponse.
 * conf : 'sure' | 'hesitante' | 'pif' | null — une bonne réponse « au pif » ne fait pas monter de boîte.
 */
export function nextState(p, correct, conf, now = Date.now()) {
  const box = p?.box || 0;
  let newBox;
  if (!correct) newBox = 1;
  else if (conf === 'pif') newBox = Math.max(box, 1);
  else newBox = Math.min(MAX_BOX, box + 1);
  return {
    box: newBox,
    last: now,
    seen: (p?.seen || 0) + 1,
    ok: (p?.ok || 0) + (correct ? 1 : 0),
    ko: (p?.ko || 0) + (correct ? 0 : 1),
    err: !correct,
    conf: conf || null
  };
}

/** Maîtrise d'un ensemble d'éléments, en %. */
export function mastery(ids, prog) {
  if (!ids.length) return 0;
  const sum = ids.reduce((s, id) => s + (prog[id]?.box || 0), 0);
  return Math.round((sum / (ids.length * MAX_BOX)) * 100);
}

/**
 * Ordonne les éléments pour une session : d'abord ceux à revoir (boîtes basses en premier),
 * puis les jamais vus, puis le reste. Un peu de hasard à priorité égale.
 */
export function prioritize(items, prog, now = Date.now()) {
  const score = (it) => {
    const p = prog[it.id];
    if (p && p.box && isDue(p, now)) return 0 + p.box / 10;
    if (!p || !p.box) return 1;
    return 2 + p.box / 10;
  };
  return items
    .map((it) => ({ it, s: score(it) + Math.random() * 0.05 }))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.it);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Série de jours consécutifs (aujourd'hui compris s'il est validé, sinon jusqu'à hier). */
export function streak(days) {
  let n = 0;
  const d = new Date();
  if (!days[today(d)]) d.setDate(d.getDate() - 1);
  while (days[today(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
