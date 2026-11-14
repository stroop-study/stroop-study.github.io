// Voix naturelles Piper, calculées entièrement sur l'appareil.
// Le moteur (ONNX Runtime + phonémiseur espeak) est copié dans vendor/piper ; seul le modèle de voix
// (fichier public) est téléchargé une fois depuis Hugging Face puis gardé dans le cache du téléphone.
// Aucun texte n'est envoyé nulle part.
const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
const BASE = new URL('../vendor/piper/', import.meta.url).href;
const CACHE_MODELES = 'voix-modeles-1';

export const VOIX = [
  { id: 'tom', nom: 'Tom', genre: 'm', chemin: 'fr/fr_FR/tom/medium/fr_FR-tom-medium', mo: 64 },
  { id: 'pierre', nom: 'Pierre', genre: 'm', chemin: 'fr/fr_FR/upmc/medium/fr_FR-upmc-medium', mo: 77, locuteur: 'pierre' },
  { id: 'gilles', nom: 'Gilles', genre: 'm', chemin: 'fr/fr_FR/gilles/low/fr_FR-gilles-low', mo: 63 },
  { id: 'mls', nom: 'Voix MLS', genre: 'x', chemin: 'fr/fr_FR/mls/medium/fr_FR-mls-medium', mo: 77, multi: true },
  { id: 'siwis', nom: 'Siwis', genre: 'f', chemin: 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium', mo: 63 },
  { id: 'jessica', nom: 'Jessica', genre: 'f', chemin: 'fr/fr_FR/upmc/medium/fr_FR-upmc-medium', mo: 77, locuteur: 'jessica' }
];

let ortP = null;
const ort = () => (ortP ||= import('onnxruntime-web').then((m) => { m.env.wasm.wasmPaths = BASE + 'ort/'; m.env.wasm.numThreads = 1; return m; }));
const sessions = new Map(); // chemin du modèle → { session, config }

async function fichier(url, progression) {
  const cache = await caches.open(CACHE_MODELES);
  const hit = await cache.match(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement impossible (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total || !progression) { await cache.put(url, res.clone()); return res; }
  const lecteur = res.body.getReader(); const morceaux = []; let recu = 0;
  for (;;) { const { done, value } = await lecteur.read(); if (done) break; morceaux.push(value); recu += value.length; progression(recu / total); }
  const blob = new Blob(morceaux);
  const copie = new Response(blob, { headers: { 'content-type': 'application/octet-stream' } });
  await cache.put(url, copie.clone());
  return copie;
}

export async function estTelechargee(v) {
  const cache = await caches.open(CACHE_MODELES);
  return !!(await cache.match(HF + v.chemin + '.onnx'));
}

async function charger(v, progression) {
  if (sessions.has(v.chemin)) return sessions.get(v.chemin);
  const config = await (await fichier(HF + v.chemin + '.onnx.json')).json();
  const modele = await (await fichier(HF + v.chemin + '.onnx', progression)).arrayBuffer();
  const O = await ort();
  const session = await O.InferenceSession.create(modele, { executionProviders: ['wasm'] });
  const s = { session, config };
  sessions.set(v.chemin, s);
  return s;
}

async function phonemes(texte, voixEspeak) {
  const { createPiperPhonemize } = await import('../vendor/piper/piper-o91UDS6e.js');
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('phonémisation trop longue')), 20000);
    createPiperPhonemize({
      print: (d) => { clearTimeout(t); try { ok(JSON.parse(d).phoneme_ids); } catch (e) { ko(e); } },
      printErr: () => {},
      locateFile: (u) => (u.endsWith('.wasm') ? BASE + 'phonemize/piper_phonemize.wasm' : u.endsWith('.data') ? BASE + 'phonemize/piper_phonemize.data' : u)
    }).then((m) => m.callMain(['-l', voixEspeak, '--input', JSON.stringify([{ text: texte }]), '--espeak_data', '/espeak-ng-data'])).catch(ko);
  });
}

/** Découpe en phrases (Piper lit mieux des phrases courtes). */
export const phrases = (t) => (t.replace(/\s+/g, ' ').match(/[^.!?…;:]+[.!?…;:]*/g) || []).map((x) => x.trim()).filter(Boolean);

function wav(echantillons, taux) {
  const n = echantillons.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, taux, true); v.setUint32(28, taux * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, echantillons[i])); v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Lit un texte avec une voix. options : locuteur (numéro, pour les modèles à plusieurs voix),
 * vitesse (1 = normale, 0.85 = plus lent), pause (secondes entre les phrases), progression(0→1).
 */
export async function synthese(v, texte, { locuteur = null, vitesse = 1, pause = 0.35, progression } = {}) {
  const { session, config } = await charger(v, progression);
  const O = await ort();
  const taux = config.audio.sample_rate;
  const inf = config.inference || {};
  let sid = null;
  if (config.num_speakers > 1) sid = locuteur ?? (v.locuteur != null ? config.speaker_id_map[v.locuteur] : 0) ?? 0;
  const morceaux = [];
  const silence = new Float32Array(Math.round(taux * pause));
  for (const p of phrases(texte)) {
    const ids = await phonemes(p, config.espeak.voice);
    const feeds = {
      input: new O.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new O.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new O.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / vitesse, inf.noise_w ?? 0.8]), [3])
    };
    if (sid != null) feeds.sid = new O.Tensor('int64', BigInt64Array.from([BigInt(sid)]), [1]);
    const sortie = await session.run(feeds);
    morceaux.push(sortie.output.data, silence);
  }
  const total = morceaux.reduce((a, m) => a + m.length, 0);
  const tout = new Float32Array(total); let o = 0;
  for (const m of morceaux) { tout.set(m, o); o += m.length; }
  return { blob: wav(tout, taux), secondes: total / taux, nbLocuteurs: config.num_speakers || 1 };
}
