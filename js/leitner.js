// Boîte de Leitner : 5 boîtes. Boîte 0 = jamais vue.
// Délai (en jours) avant qu'une carte redevienne « à revoir », selon sa boîte : J1, J3, J7, J14, J30.
export const INTERVALS = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 7, 5: 16 };
export const MAX_BOX = 5;
export const SAME_DAY_GAP = 5 * 60 * 60 * 1000; // 5 h entre deux montées le même jour (cartes nouvelles)

const DAY = 24 * 60 * 60 * 1000;

export function today(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

export function startOfDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

/** Date (ms, début de journée) à laquelle la carte redevient à revoir. */
export function dueDate(p) {
  if (!p || !p.box) return 0;
  return startOfDay(p.last) + (INTERVALS[p.box] ?? 0) * DAY;
}

/** Une carte est-elle à revoir aujourd'hui ? (Jamais vue = oui.) */
export function isDue(p, now = Date.now()) {
  if (!p || !p.box) return true;
  return dueDate(p) <= startOfDay(now);
}

/**
 * Nouvel état d'une carte après une réponse (méthode de Leitner, version classique).
 * - Erreur : retour en boîte 1, à revoir le lendemain.
 * - Bonne réponse sur une carte à revoir (ou jamais vue) : elle monte d'une boîte.
 * - Exception : une carte nouvelle passée en boîte 1 aujourd'hui peut monter une 2e fois le même jour,
 *   si au moins 5 h séparent les deux bonnes réponses.
 * - Bonne réponse en avance : simple entraînement, la boîte et la date ne bougent pas.
 * - « Au pif » : la carte reste dans sa boîte (sa date est recalculée si elle était à revoir).
 * Le champ `practice` indique un entraînement sans effet sur la boîte.
 */
export function nextState(p, correct, conf, now = Date.now()) {
  const box = p?.box || 0;
  const base = { seen: (p?.seen || 0) + 1, ok: (p?.ok || 0) + (correct ? 1 : 0), ko: (p?.ko || 0) + (correct ? 0 : 1), vu: now, conf: conf || null };
  if (!correct) return { ...base, box: 1, last: now, up: null, err: true, practice: false };
  const due = isDue(p, now);
  const secondToday = box === 1 && p?.up && startOfDay(p.up) === startOfDay(now) && p?.newUp && now - p.up >= SAME_DAY_GAP;
  if (conf === 'pif') {
    if (box === 0) return { ...base, box: 1, last: now, up: null, err: false, practice: false };
    if (due) return { ...base, box, last: now, up: p?.up || null, err: false, practice: false };
    return { ...base, box, last: p.last, up: p?.up || null, err: false, practice: true };
  }
  if (box === 0) return { ...base, box: 1, last: now, up: now, newUp: true, err: false, practice: false };
  if (due || secondToday) return { ...base, box: Math.min(MAX_BOX, box + 1), last: now, up: now, newUp: false, err: false, practice: false };
  return { ...base, box, last: p.last, up: p?.up || null, newUp: p?.newUp || false, err: false, practice: true };
}

/**
 * Maîtrise d'un élément (0 à 1) : 0 s'il n'a jamais été vu ou si la dernière réponse était fausse,
 * puis 25 % en boîte 1, 50 % en boîte 2, 75 % en boîte 3, 100 % en boîtes 4 et 5.
 */
export function itemMastery(p) {
  if (!p || !p.box || p.err) return 0;
  return Math.min(1, p.box / 4);
}

/** Maîtrise d'un ensemble d'éléments, en %. */
export function mastery(ids, prog) {
  if (!ids.length) return 0;
  const sum = ids.reduce((s, id) => s + itemMastery(prog[id]), 0);
  return Math.round((sum / ids.length) * 100);
}

/** Nombre d'éléments déjà vus au moins une fois. */
export function seenCount(ids, prog) {
  return ids.filter((id) => prog[id]?.seen).length;
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
