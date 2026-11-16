// Mode écoute : fiches et questions lues par une voix Piper calculée sur le téléphone.
// Tout l'épisode est préparé d'un bloc (un seul fichier audio), pour que la lecture continue écran verrouillé.
// Rien ne quitte l'appareil : le texte des cours reste dans l'appli.
import { resolveVariants, formatOf } from './types.js';

const LETTRES = 'ABCDEFGH';
const CACHE = 'ecoute-1';

/** Rend un texte de cours lisible à voix haute. */
export function pourOral(t) {
  if (t == null) return '';
  return String(t)
    .replace(/\*\*/g, '')
    .replace(/([A-Za-zÀ-ÿ]+)·([a-zà-ÿ]+)(·[a-zà-ÿ]+)?/g, (m, base, suf, suf2) => base + (/s$/.test(suf2 || suf) ? 's' : '')) // écriture inclusive → forme courte à l'oral
    .replace(/[«»"“”]/g, '')
    .replace(/\s*\(([^)]*)\)/g, ', $1,')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1 sur $2')
    .replace(/\s\/\s|(?<=\p{L})\/(?=\p{L})/gu, ' ou ')
    .replace(/≥\s*/g, 'au moins ').replace(/≤\s*/g, 'au plus ').replace(/>\s*/g, 'plus de ').replace(/<\s*/g, 'moins de ')
    .replace(/\s*→\s*/g, ', donc ').replace(/\s*↔\s*/g, ' associé à ').replace(/↑\s*/g, 'plus de ').replace(/↓\s*/g, 'moins de ')
    .replace(/≈\s*/g, 'environ ').replace(/\s*×\s*/g, ' fois ').replace(/\s*=\s*/g, ' égal ')
    .replace(/(\d)\s?[-–]\s?(\d)/g, '$1 à $2')
    .replace(/[−–-]\s?(?=\.?\d)/g, (m, o, s) => (/\d$/.test(s.slice(0, o).trim()) ? m : 'moins '))
    .replace(/(^|[^\d,])\.(\d+)/g, '$10,$2')
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/²/g, ' au carré').replace(/\+(?=\d)/g, 'plus ')
    .replace(/\s*%/g, ' pour cent')
    .replace(/\s·\s/g, ', ').replace(/\s+-\s+/g, ', ')
    .replace(/\bvs\.?\b/g, 'ou bien').replace(/\bex\.\s/g, 'par exemple, ').replace(/\betc\.?/g, 'et cetera')
    .replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/,\s*\./g, '.').replace(/\s{2,}/g, ' ')
    .trim();
}
const fin = (t) => (/[.!?…:]$/.test(t) ? t : t + '.');

/** Les questions qu'on peut faire à l'oral (pas les tris, associations, ordres ni figures). */
export const audible = (it) => ['flashcard', 'vf', 'qcu', 'qcm', 'courte'].includes(formatOf(it)) && !it.figure && !it.lettres;

/** Découpe le programme d'écoute en morceaux : { type: 'parole' | 'silence' | 'bip', texte, secondes, marque } */
export function programme({ chapitres, items, contenu, silence }) {
  const P = [];
  const dire = (texte, marque) => P.push({ type: 'parole', texte: fin(pourOral(texte)), marque });
  const pause = (s) => P.push({ type: 'silence', secondes: s });
  for (const ch of chapitres) {
    if (contenu !== 'questions' && ch.fiche?.length) {
      dire(`${ch.titre}`, { titre: ch.titre, sous: 'Fiche', texte: ch.titre });
      pause(0.8);
      for (const sec of ch.fiche) {
        dire(sec.titre, { titre: ch.titre, sous: sec.titre, texte: sec.points.join('\n') });
        pause(0.5);
        for (const pt of sec.points) { dire(pt); pause(0.6); }
        pause(0.6);
      }
    }
    const qs = items.filter((it) => it.chapitre === ch.id);
    if (contenu !== 'fiches' && qs.length) {
      dire(contenu === 'tout' ? 'Place aux questions.' : `${ch.titre}. Questions.`, { titre: ch.titre, sous: 'Questions', texte: '' });
      pause(0.8);
      qs.forEach((brut, i) => {
        const it = resolveVariants(brut); const fmt = formatOf(it);
        const num = `Question ${i + 1} sur ${qs.length}`;
        let q = '', ecrit = '', rep = '', repEcrit = '';
        if (it.type === 'cas' && it.scenario) { q += fin(it.scenario) + ' '; ecrit += it.scenario + '\n\n'; }
        if (fmt === 'flashcard') { q += it.recto; ecrit += it.recto; rep = it.verso; repEcrit = it.verso; }
        else if (fmt === 'vf') { q += fin(it.affirmation) + ' Vrai ou faux ?'; ecrit += it.affirmation + '\nVrai ou faux ?'; rep = (it.vrai ? 'Vrai. ' : 'Faux. ') + (it.explication || ''); repEcrit = rep; }
        else if (fmt === 'courte') { q += it.question; ecrit += it.question; rep = (it.reponses?.[0] || '') + '. ' + (it.explication || ''); repEcrit = rep; }
        else {
          const ordre = it.choix.map((_, k) => k).sort(() => Math.random() - 0.5);
          const bonnes = new Set(it.bonnes);
          const props = ordre.map((k, j) => `${LETTRES[j]} : ${fin(it.choix[k])}`);
          q += fin(it.question) + (fmt === 'qcm' ? ' Plusieurs réponses possibles. ' : ' ') + props.join(' ');
          ecrit += it.question + '\n' + props.join('\n');
          const ok = ordre.map((k, j) => (bonnes.has(k) ? `${LETTRES[j]}, ${it.choix[k]}` : null)).filter(Boolean);
          rep = `Réponse${ok.length > 1 ? 's' : ''} : ${ok.join(' ; ')}. ${it.explication || ''}`;
          repEcrit = rep;
        }
        dire(`${num}. ${q}`, { titre: ch.titre, sous: num, texte: ecrit, id: brut.id });
        pause(silence);
        P.push({ type: 'bip' });
        pause(0.3);
        dire(rep, { titre: ch.titre, sous: `${num} · réponse`, texte: repEcrit, reponse: true, id: brut.id });
        pause(1.4);
      });
    }
  }
  dire('C’est la fin de cette écoute. À très vite !', { titre: 'Fin', sous: 'Fin de l’écoute', texte: 'C’est la fin de cette écoute. À très vite !' });
  return P;
}

function bip(taux) {
  const n = Math.round(taux * 0.16), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / taux; o[i] = Math.sin(2 * Math.PI * 880 * t) * 0.18 * Math.min(1, i / 200) * Math.min(1, (n - i) / 600); }
  return o;
}

/** Calcule tout l'épisode. progression(0→1, texte) ; renvoie { blob, marques:[{t, …}], duree } */
export async function construire(P, voix, { vitesse = 1, progression, annule } = {}) {
  const V = await import('./voix.js');
  const taux = await V.preparer(voix, (x) => progression?.(0, `Téléchargement de la voix : ${Math.round(x * 100)} %`));
  const morceaux = []; const marques = []; let n = 0;
  const paroles = P.filter((p) => p.type === 'parole');
  const totalCar = paroles.reduce((a, p) => a + p.texte.length, 0) || 1; let faitCar = 0;
  for (const p of P) {
    if (annule?.()) throw new Error('annulé');
    if (p.marque) marques.push({ t: n / taux, ...p.marque });
    let f;
    if (p.type === 'silence') f = new Float32Array(Math.round(taux * p.secondes));
    else if (p.type === 'bip') f = bip(taux);
    else { f = (await V.pcm(voix, p.texte, { vitesse, pause: 0.3 })).data; faitCar += p.texte.length; progression?.(faitCar / totalCar, ''); }
    morceaux.push(V.enInt16(f)); n += f.length;
  }
  return { blob: V.wavDe(morceaux, taux), marques, duree: n / taux };
}

/** Garde la dernière écoute (une seule, toutes matières confondues : un épisode pèse plusieurs dizaines de Mo). */
export async function garder(code, ep) {
  try {
    const c = await caches.open(CACHE);
    for (const r of await c.keys()) { const autre = decodeURIComponent(new URL(r.url).pathname).match(/\/ecoute\/(.+)\.wav$/)?.[1]; if (autre && autre !== code) { await c.delete(r); localStorage.removeItem(`stroop-ecoute-${autre}`); } }
    await c.put(`/ecoute/${code}.wav`, new Response(ep.blob, { headers: { 'content-type': 'audio/wav' } }));
    localStorage.setItem(`stroop-ecoute-${code}`, JSON.stringify({ marques: ep.marques, duree: ep.duree, titre: ep.titre, le: Date.now(), pos: 0 }));
  } catch {}
}
export async function retrouver(code) {
  try {
    const meta = JSON.parse(localStorage.getItem(`stroop-ecoute-${code}`) || 'null'); if (!meta) return null;
    const c = await caches.open(CACHE);
    // Au-delà de 14 jours, l'épisode est effacé pour libérer la place.
    if (Date.now() - (meta.le || 0) > 14 * 864e5) { await c.delete(`/ecoute/${code}.wav`); localStorage.removeItem(`stroop-ecoute-${code}`); return null; }
    const r = await c.match(`/ecoute/${code}.wav`); if (!r) return null;
    return { ...meta, blob: await r.blob() };
  } catch { return null; }
}
export function memoriserPosition(code, pos) {
  try { const k = `stroop-ecoute-${code}`; const m = JSON.parse(localStorage.getItem(k) || 'null'); if (m) { m.pos = pos; localStorage.setItem(k, JSON.stringify(m)); } } catch {}
}
