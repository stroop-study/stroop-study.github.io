// Rendu des fiches de l'onglet Réviser (champ `cours` des chapitres), au style des fiches PDF :
// titre surligné, pastilles enchaînées, cartes teintées en trois tons, encadré « ! ».
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// **gras** autorisé dans le texte des fiches
const t = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const FL = '<svg class="fl" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const BOUCLE = '<svg class="fl" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/></svg>';
const LIEN = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 15l6-6M10 6h8v8"/></svg>';

/** Titre avec les deux derniers mots surlignés, comme sur les fiches PDF. */
export function titreSurligne(s) {
  const mots = String(s || '').split(' ');
  const n = mots.length > 3 ? 2 : 1;
  return `${t(mots.slice(0, -n).join(' '))} <span class="surligne">${t(mots.slice(-n).join(' '))}</span>`;
}

const note = (b) => (b.note ? `<p class="fb-note">${t(b.note)}</p>` : '');
const titre = (b) => (b.t ? `<h3 class="fb-t">${t(b.t)}</h3>` : '');

function pilules(etapes, boucle) {
  return `<div class="fb-chaine">${etapes.map((e, i) => `${i ? FL : ''}<span class="pil${i === etapes.length - 1 && !boucle ? ' fin' : ''}"><b>${t(e.t)}</b>${e.d ? `<span>${t(e.d)}</span>` : ''}</span>`).join('')}${boucle ? BOUCLE : ''}</div>`;
}

const BLOCS = {
  texte: (b) => `${titre(b)}<p class="fb-p">${t(b.d)}</p>`,
  chaine: (b) => `${titre(b)}${pilules(b.etapes, false)}${note(b)}`,
  cycle: (b) => `${titre(b)}${pilules(b.etapes, true)}${note(b)}`,
  frise: (b) => `${titre(b)}<ol class="fb-frise">${b.jalons.map((j) => `<li><span class="date">${t(j.date)}</span><span class="txt"><b>${t(j.t)}</b>${j.d ? `<span>${t(j.d)}</span>` : ''}</span></li>`).join('')}</ol>${note(b)}`,
  cartes: (b) => {
    // cartes sans texte : de simples pastilles
    if (b.cartes.every((c) => !c.d)) return `${titre(b)}<div class="fb-tags">${b.cartes.map((c) => `<span>${t(c.t)}</span>`).join('')}</div>${note(b)}`;
    const impair = b.cartes.length % 2 === 1;
    return `${titre(b)}<div class="fb-cartes">${b.cartes.map((c, i) => `<div class="carte ton${i % 3}${impair && i === 0 ? ' large' : ''}"><b>${t(c.t)}</b><span>${t(c.d)}</span></div>`).join('')}</div>${note(b)}`;
  },
  duo: (b) => `${titre(b)}<div class="fb-duo">${[b.a, b.b].map((x, i) => `<div class="${i ? 'b' : 'a'}"><b>${t(x.t)}</b><ul>${x.points.map((p) => `<li>${t(p)}</li>`).join('')}</ul></div>`).join('')}</div>${note(b)}`,
  tableau: (b) => `${titre(b)}<div class="fb-tab" tabindex="0"><table><thead><tr>${b.cols.map((c) => `<th>${t(c)}</th>`).join('')}</tr></thead><tbody>${b.lignes.map((l) => `<tr>${l.map((c, i) => (i ? `<td>${t(c)}</td>` : `<th scope="row">${t(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>${note(b)}`,
  chiffres: (b) => `${titre(b)}<div class="fb-chiffres">${b.items.map((i) => `<div><strong>${t(i.v)}</strong><span>${t(i.d)}</span></div>`).join('')}</div>${note(b)}`,
  piege: (b) => `<div class="fb-piege"><span class="bang" aria-hidden="true">!</span><span><b>${t(b.t)}</b> · ${t(b.d)}</span></div>`,
  diff: (b) => `${titre(b)}<div class="fb-diff">${b.items.map((i) => `<div><b>${t(i.trouble)}</b><span class="pour"><i>On y pense</i>${t(i.pour)}</span><span class="contre"><i>On l’écarte</i>${t(i.contre)}</span></div>`).join('')}</div>`
};

/**
 * HTML d'une page de fiche. `ctx.lien(chapId)` renvoie { href, titre } ou null pour les liens « En lien ».
 */
export function pageHtml(page, ctx = {}) {
  const liens = page.blocs.filter((b) => b.type === 'liens').flatMap((b) => b.items);
  const corps = page.blocs.filter((b) => b.type !== 'liens').map((b) => `<section class="fb k-${b.type}">${(BLOCS[b.type] || (() => ''))(b)}</section>`).join('');
  const enLien = liens.map((l) => ({ l, cible: ctx.lien ? ctx.lien(l.chap) : null })).filter((o) => o.cible);
  return `
    <div class="fiche-tete">
      ${ctx.puce ? `<span class="fiche-puce">${esc(ctx.puce)}</span>` : ''}
      <h1>${titreSurligne(page.titre)}</h1>
      <p class="fiche-acc">${t(page.accroche)}</p>
    </div>
    ${corps}
    ${enLien.length ? `<section class="fb fb-liens"><h3 class="fb-t">En lien</h3>${enLien.map(({ l, cible }) => `<a class="lien" href="${esc(cible.href)}">${LIEN}<span><b>${esc(cible.titre)}</b> · ${t(l.d)}</span></a>`).join('')}</section>` : ''}`;
}

/** La page d'un chapitre qui traite une notion (pour « Revoir le cours » après une erreur). */
export const pageDeNotion = (chap, notion) => Math.max(0, (chap?.cours || []).findIndex((p) => p.notions.includes(notion)));

/**
 * Cours complet d'un chapitre (champ `complet` : [{ id, titre, corps }]).
 * `corps` est un texte simple : « ## » sous-titre, « - » puce, « ! » encadré important,
 * « > » citation, « | a | b | » tableau (1re ligne = en-têtes), ligne vide = nouveau paragraphe.
 */
export function completHtml(sections, hl = new Set()) {
  // Présenté comme un document : sommaire cliquable, parties numérotées, lecture continue depuis le début.
  const mots = sections.reduce((n, s) => n + String(s.corps || '').split(/\s+/).length, 0);
  const somm = `<nav class="cc-somm" aria-label="Sommaire"><span class="cc-somm-t">Sommaire · ${sections.length} parties · environ ${Math.max(1, Math.round(mots / 200))} min de lecture</span><ol>${sections.map((s) => `<li><a href="#cc-${esc(s.id)}" data-cc="${esc(s.id)}">${t(s.titre)}</a>${hl.has(s.id) ? '<span class="cc-tag">ta fiche</span>' : ''}</li>`).join('')}</ol></nav>`;
  return somm + sections.map((s, i) => `<section class="cc-sec${hl.has(s.id) ? ' hl' : ''}" id="cc-${esc(s.id)}"><h2><span class="cc-num">${i + 1}</span>${t(s.titre)}</h2>${hl.has(s.id) ? '<span class="cc-tag">En lien avec ta fiche</span>' : ''}${corpsHtml(s.corps)}</section>`).join('')
    + '<button class="btn plain cc-haut" data-cc-haut>Revenir au sommaire</button>';
}
function corpsHtml(src) {
  const out = []; let liste = null, tab = null, para = [];
  const fermer = () => {
    if (para.length) { out.push(`<p>${para.map(t).join(' ')}</p>`); para = []; }
    if (liste) { out.push(`<ul>${liste.map((x) => `<li>${t(x)}</li>`).join('')}</ul>`); liste = null; }
    if (tab) {
      const [h, ...r] = tab;
      out.push(`<div class="fb-tab" tabindex="0"><table><thead><tr>${h.map((c) => `<th>${t(c)}</th>`).join('')}</tr></thead><tbody>${r.map((l) => `<tr>${l.map((c, i) => (i ? `<td>${t(c)}</td>` : `<th scope="row">${t(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`);
      tab = null;
    }
  };
  for (const brut of String(src || '').split('\n')) {
    const l = brut.trim();
    if (!l) { fermer(); continue; }
    if (l.startsWith('## ')) { fermer(); out.push(`<h3>${t(l.slice(3))}</h3>`); continue; }
    if (l.startsWith('- ')) { if (para.length || tab) { const li = liste; liste = null; fermer(); liste = li; } (liste = liste || []).push(l.slice(2)); continue; }
    if (l.startsWith('|')) { if (!tab) fermer(); (tab = tab || []).push(l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); continue; }
    if (l.startsWith('! ')) { fermer(); out.push(`<div class="fb-piege cc-nb"><span class="bang" aria-hidden="true">!</span><span>${t(l.slice(2))}</span></div>`); continue; }
    if (l.startsWith('> ')) { fermer(); out.push(`<blockquote>${t(l.slice(2))}</blockquote>`); continue; }
    if (liste || tab) fermer();
    para.push(l);
  }
  fermer();
  return out.join('');
}
