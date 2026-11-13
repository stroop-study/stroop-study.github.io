// Types de questions : libellés, durées et correction.

export const TYPES = [
  { key: 'flashcard', label: 'Flashcards', short: 'Flashcard' },
  { key: 'qcu', label: 'QCU', short: 'QCU' },
  { key: 'qcm', label: 'QCM', short: 'QCM' },
  { key: 'vf', label: 'Vrai / Faux', short: 'Vrai ou faux' },
  { key: 'ordre', label: 'Remise en ordre', short: 'Remise en ordre' },
  { key: 'assoc', label: 'Association', short: 'Association' },
  { key: 'tri', label: 'Tri', short: 'Tri en catégories' },
  { key: 'courte', label: 'Réponse courte', short: 'Réponse courte' },
  { key: 'cas', label: 'Cas pratique', short: 'Cas pratique' }
];
export const TYPE_KEYS = TYPES.map((t) => t.key);
export const typeLabel = (k) => (TYPES.find((t) => t.key === k) || {}).short || k;

export const NIVEAUX = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' };

/** Temps de réponse (secondes) : 20 / 40 / 60 s selon la difficulté, plus du temps
 *  selon la forme (paires, éléments à classer) et la longueur du texte à lire. */
export function timeFor(it) {
  const n = it.niveau || 1;
  let t = n >= 3 ? 60 : n === 2 ? 40 : 20;
  const f = formatOf(it);
  if (f === 'assoc') t += 7 * (it.paires?.length || 0);
  else if (f === 'tri') t += 5 * (it.items?.length || 0);
  else if (f === 'ordre') t += 5 * (it.items?.length || 0);
  else if (f === 'qcm') t += 10;
  const txt = [it.scenario, it.question, it.affirmation, ...(it.choix || []), ...(it.items || []).map((x) => (Array.isArray(x) ? x[0] : x)), ...(it.paires || []).flat()]
    .filter((x) => typeof x === 'string').join(' ');
  t += Math.max(0, txt.length - 150) / 15; // ≈ temps de lecture
  return Math.min(180, Math.ceil(t / 5) * 5);
}

/** Choisit une formulation au hasard quand un champ en propose plusieurs (tableau de variantes). */
export function resolveVariants(it) {
  const pick = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);
  const out = { ...it };
  for (const k of ['question', 'affirmation', 'scenario', 'recto', 'verso']) if (Array.isArray(out[k])) out[k] = pick(out[k]);
  if (Array.isArray(out.choix)) out.choix = out.choix.map(pick);
  return out;
}

/** Format effectif d'une question (un cas pratique emprunte le format de sa question). */
export const formatOf = (it) => (it.type === 'cas' ? it.format || 'qcu' : it.type);

/** Normalise une réponse tapée : minuscules, sans accents, sans ponctuation superflue. */
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[«»"“”.,;:!?()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Réponse courte : tolère les accents, la casse et une petite faute de frappe. */
export function checkCourte(input, reponses) {
  const x = normalize(input);
  if (!x) return false;
  return (reponses || []).some((r) => {
    const y = normalize(r);
    if (x === y) return true;
    const tol = y.length >= 12 ? 2 : y.length >= 5 ? 1 : 0;
    return lev(x, y) <= tol;
  });
}

export function sameSet(a, b) {
  const A = new Set(a), B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
}
