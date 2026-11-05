// The site's Collection Home for the native app: app.js's own wiring (normalize, resolveNames) and the Home models
// (views.js home(), home-ui.js) around the web modules, bundled unchanged for QuickJS (CollectionEngine.kt).
// Nothing is decided here: every number, list and order comes from the site's functions; this file only calls them
// and hands their models to the app instead of HTML.
import {S, blank, meta, cacheCard} from 'WEB/store.js';
import {cardKey} from 'WEB/core.js';
import {validateWorkspace} from 'WEB/confidence.js';
import {normalizeHomeDeckActivity} from 'WEB/home-deck-activity.js';
import {collectionValue} from 'WEB/insights.js';
import {homeValueModel, homeMetaKey, homeMetaSlides, homeMetaArticle, homeMetaCarousel, homeDeckShelf, homeCommunity, featureArticle} from 'WEB/home-ui.js';
import {heroFor, loadHero, homeHero, homeToday} from './tcg-daily-hero.mjs';
import {dailyDetails, todaySetMarkup} from 'WEB/home-today.js';
import {hintPool, SEARCH_PROMPT} from 'WEB/search-hints.js';
import {useMyPrices} from 'WEB/mtg-tcgprice.js';
import {formatOf} from 'WEB/formats.js';
import {art} from 'WEB/ui.js';
import {createScryfallClient} from 'WEB/scryfall-client.js';
import {loadMeta, metaState} from 'WEB/meta.js';
import {loadCommunity, communitySlides} from 'WEB/community-feed.js';
import {loadPulse} from 'WEB/news-pulse.js';

// app.js:193-198, verbatim.
const stripCache = (s) => {
  const { cache, ...keep } = s;
  void cache;
  return keep;
};
const normalize = (s) => normalizeHomeDeckActivity(stripCache({ ...blank(), ...validateWorkspace(s) }));
const key = cardKey;

// app.js resolveNames (497-527), verbatim but for the progress line and the catalog save (the app keeps the catalog).
const api = createScryfallClient();
async function resolveNames(names, progress = () => {}, refresh = false, current = () => true) {
  const wanted = [...new Map(names.filter(Boolean).map((n) => [key(n), n])).values()].filter((n) => refresh || !meta(n)),
    failed = [],
    matched = new Map(),
    retried = new Set();
  for (let i = 0; i < wanted.length; i += 75) {
    if(!current())return {failed,matched,total:wanted.length,cancelled:true};
    const chunk = wanted.slice(i, i + 75);
    progress(`Loading card data ${Math.min(i + 75, wanted.length)}/${wanted.length}…`);
    try {
      const r = await api("/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk.map((name) => ({ name: name.split(" // ")[0] })) }),
      });
      if(!current())return {failed,matched,total:wanted.length,cancelled:true};
      for (const c of r.data || []) {
        const aliases = chunk.filter((n) => key(n) === key(c.name) || key(n.split(" // ")[0]) === key(c.name.split(" // ")[0]) || c.card_faces?.some((f) => key(f.name) === key(n)));
        cacheCard(c, aliases);
        for (const a of aliases) matched.set(key(a), c.name);
      }
      for (const n of chunk) if (!matched.has(key(n))) failed.push(n);
    } catch (e) {
      if(!current())return {failed,matched,total:wanted.length,cancelled:true};
      if (e?.network && !retried.has(i)) { retried.add(i); progress("The card database is busy; trying again…"); await new Promise((r) => setTimeout(r, 4000)); i -= 75; continue; }
      failed.push(...chunk);
    }
  }
  if(!current())return {failed,matched,total:wanted.length,cancelled:true};
  return { failed, matched, total: wanted.length };
}

// views.js:108-115, verbatim: the deck tile's cover.
const coverRank = (c) => /\b(Creature|Planeswalker)\b/.test(c.type_line || "") ? 0 : /\bLand\b/.test(c.type_line || "") ? 2 : 1;
const coverOf = (d) => {
  const lead = meta(d.commander);
  if (lead && art(lead)) return art(lead);
  const pool = d.cards.map((c) => meta(c.name)).filter((c) => c && art(c));
  return art(pool.reduce((best, c) => (!best || coverRank(c) < coverRank(best) ? c : best), null));
};

// The site's Home markup, read back into models: every word, date, link and picture is what the site's own builders
// put in the page (home-ui.js, tcg.js, community-art.js); the app only lays them out. A small tree reader, no DOM.
const VOID = new Set(['img', 'br', 'input', 'meta', 'link', 'hr', 'source', 'wbr']);
const unescape = t => t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '}[e.toLowerCase()]);
function tree(html) {
  const root = {tag: '#root', attrs: {}, kids: []}, stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|</g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[1]) { const tag = m[1].toLowerCase(); const i = stack.map(n => n.tag).lastIndexOf(tag); if (i > 0) stack.length = i; }
    else if (m[2]) {
      const node = {tag: m[2].toLowerCase(), attrs: {}, kids: []}, ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3] || ''))) node.attrs[a[1].toLowerCase()] = unescape(a[2] ?? a[3] ?? a[4] ?? '');
      top.kids.push(node); if (!m[4] && !VOID.has(node.tag)) stack.push(node);
    } else if (m[5] !== undefined) top.kids.push({text: unescape(m[5])});
    else if (m[0] === '<') top.kids.push({text: '<'});
  }
  return root;
}
const classes = n => (n.attrs?.class || '').split(/\s+/);
const all = (n, ok, out = []) => { for (const k of n?.kids || []) { if (k.tag && ok(k)) out.push(k); all(k, ok, out); } return out; };
const one = (n, ok) => all(n, ok)[0] || null;
const cls = c => n => classes(n).includes(c);
const tagIs = t => n => n.tag === t;
// Visible words only: screen-reader-only copy and hidden nodes are skipped, whitespace runs fold to one space.
const text = n => { if (!n) return ''; const walk = x => x.text !== undefined ? x.text : x.tag === 'svg' || x.attrs?.hidden !== undefined || classes(x).includes('home-sr-only') ? '' : (x.kids || []).map(walk).join(''); return walk(n).replace(/\s+/g, ' ').trim(); };
// community-art.js communityArtwork: the picture, what it is, its credit, and the one fallback the site would try.
function artOf(n) {
  const box = n && (cls('community-art')(n) ? n : one(n, cls('community-art'))); if (!box) return null;
  const img = one(box, tagIs('img'));
  return {src: img?.attrs.src || '', kind: box.attrs['data-art-kind'] || '', state: box.attrs['data-art-state'] || '', credit: text(one(box, cls('community-art-credit'))),
    caption: text(one(box, cls('community-art-fallback'))), fallback: box.attrs['data-art-fallback'] || '', fallbackLabel: box.attrs['data-art-fallback-label'] || '', theme: !!one(box, cls('community-art-theme'))};
}
const link = n => n ? {label: text(n), href: n.attrs.href || '', to: n.attrs['data-to'] || '', act: n.attrs['data-act'] || ''} : null;

// home-ui.js homeDeckShelf, with views.js / tcg.js's describe (format name and cover art).
function shelf(game) {
  const describe = game === 'mtg' ? deck => ({format: formatOf(deck).name, artHTML: coverOf(deck) ? `<img src="${coverOf(deck).replace(/"/g, '&quot;')}">` : ''}) : deck => ({format: deck.format || ''});
  const t = tree(homeDeckShelf(game, describe)), head = one(t, cls('home-shelf-heading'));
  const lead = one(t, cls('home-personal-resume')) || one(t, cls('home-resume')), resume = cls('home-resume')(lead || {}) ? lead : one(lead, cls('home-resume'));
  const row = n => ({id: n.attrs['data-home-personal-deck'] || '', name: text(one(n, tagIs('b'))), line: text(one(n, tagIs('small'))), art: one(n, tagIs('img'))?.attrs.src || null, to: n.attrs['data-to'] || ''});
  return {title: text(one(head, tagIs('h2'))), all: link(one(head, tagIs('button'))),
    lead: lead && {id: resume?.attrs['data-resume-deck'] || resume?.attrs['data-home-deck-pick'] || '', empty: cls('home-resume-empty')(resume || {}),
      eyebrow: text(one(resume, cls('eyebrow'))), name: text(one(resume, tagIs('h2'))), line: text(all(resume, tagIs('p')).filter(p => !cls('eyebrow')(p)).pop()),
      action: link(one(resume, n => n.tag === 'button' && !cls('home-resume-open')(n))), to: one(resume, cls('home-resume-open'))?.attrs['data-to'] || '',
      art: cls('home-personal-resume')(lead) ? one(lead, tagIs('img'))?.attrs.src || null : null},
    decks: all(t, n => cls('home-personal-deck')(n) && n.tag === 'button').map(row)};
}

// home-ui.js homeMetaCarousel / homeMetaArticle: every slide as the site words it, or its loading / empty card.
function metaRail(game) {
  const slides = homeMetaSlides(game), shell = tree(homeMetaCarousel(game)), head = one(shell, cls('home-meta-heading'));
  const card = (slide, i) => {
    const a = one(tree(homeMetaArticle(game, slide, i, slides.length)), tagIs('article'));
    return {key: a.attrs['data-meta-deck'] || '', state: a.attrs['data-meta-state'] || 'ready', eyebrow: text(one(a, cls('eyebrow'))), title: text(one(a, tagIs('h3'))),
      result: text(one(a, cls('home-meta-result'))), source: text(one(a, cls('home-meta-source'))), method: text(one(a, cls('home-meta-method'))), note: slide ? '' : text(one(one(a, cls('home-meta-copy')), tagIs('p'))),
      original: one(a, cls('home-meta-original'))?.attrs.href || '', explore: link(one(a, n => n.tag === 'button' && n.attrs['data-act'] === 'go')), art: artOf(a),
      format: slide ? (game === 'mtg' ? slide.metaKey.slice(4) : game === 'ptcg' ? 'Standard' : 'TCG') : ''};
  };
  return {title: text(one(head, tagIs('h2'))), all: link(one(head, tagIs('button'))), slides: slides.length ? slides.map(card) : [card(null, 0)], empty: !slides.length, interval: 8000};
}

// home-ui.js homeCommunity / featureArticle: the news cards, their sources and the status line.
function newsRail(game) {
  const slides = slidesFor(game), shell = tree(homeCommunity(game));
  const card = (slide, i) => {
    const a = one(tree(featureArticle(game, slide, i, slides.length)), tagIs('article')), open = one(a, cls('community-open'));
    return {id: a.attrs['data-slide-id'] || '', kind: slide?.kind || '', chips: all(one(a, cls('community-pills')), cls('chip')).map(text), title: text(one(a, tagIs('h3'))), href: open?.attrs.href || '',
      summary: text(one(a, cls('community-summary'))), source: all(one(a, cls('community-source')), tagIs('span')).map(text), details: all(one(a, cls('community-context')), tagIs('p')).map(text),
      detailsLabel: text(one(one(a, cls('community-context')), tagIs('summary'))), unavailable: text(one(a, n => n.tag === 'p' && cls('muted')(n))), art: artOf(a), textOnly: cls('feature-text-only')(a)};
  };
  return {title: text(one(one(shell, cls('section-head')), tagIs('h2'))), note: text(one(shell, cls('community-heading-note'))), status: text(one(shell, cls('community-status'))),
    links: all(one(shell, cls('community-source-links')), tagIs('a')).map(link), pageSize: 3, slides: slides.length ? slides.map(card) : [card(null, 0)], empty: !slides.length};
}

// home-ui.js slidesFor, verbatim: news and events only (deck discovery has its own rail).
function slidesFor(g) { return communitySlides(g, { metaState: metaState(homeMetaKey(g)), metaKey: homeMetaKey(g), format: g === 'mtg' ? homeMetaKey(g).slice(4) : undefined }).filter(slide => slide.kind !== 'deck' && slide.kind !== 'link' && slide.category !== 'decks').sort((a, b) => Number(a.kind === 'link') - Number(b.kind === 'link')); }

// tcg.js homeHero / homeToday and home-today.js dailyDetails: the Card of the Day art, name, set and rarity.
const today = new Map();
function hero(game) {
  const h = heroFor(game), hh = tree(homeHero(game)), d = h && today.get(h.id + '|' + h.date);
  const set = d?.set ? tree(todaySetMarkup(game, d.set, {rarity: d.rarity})) : null;
  return {eyebrow: text(one(hh, cls('eyebrow'))), title: text(one(hh, tagIs('h1'))), prompt: one(hh, tagIs('input'))?.attrs.placeholder || '',
    card: h ? {id: h.id, name: h.name, date: h.date, art: h.art || '', artDirect: h.artDirect || '', label: text(one(one(tree(homeToday(game)), cls('hh-credit')), tagIs('span'))),
      set: set ? text(one(set, cls('today-set-name'))) : '', setCode: set ? one(set, cls('today-set-name'))?.attrs['data-code'] || '' : '', rarity: set ? text(one(set, cls('today-rarity'))) : ''} : null};
}
function loadToday(game) {
  return loadHero(game).catch(() => false).then(() => { const h = heroFor(game); if (!h) return; return dailyDetails(game, h).then(d => { if (d) today.set(h.id + '|' + h.date, d); }, () => {}); });
}

let job = 0, status = {busy: false, step: '', error: null};
const json = v => JSON.stringify(v);
globalThis.Collection = {
  // The account's workspace row data (cloud.js), normalized as app.js loads it; [catalogJson] is the app's saved catalog.
  load(workspaceJson, catalogJson) {
    // No account copy (signed out, or a row never set up): app.js starts from store.js blank().
    const ws = workspaceJson ? JSON.parse(workspaceJson) : null;
    S.state = ws && Object.keys(ws).length ? normalize(ws) : blank();
    S.catalog = catalogJson ? JSON.parse(catalogJson) : {};
    useMyPrices(S.state.myPrices); // app.js render(): the account's own prices count in every value
    return json({copies: S.state.collection.reduce((n, e) => n + (Number(e.qty) || 0), 0), decks: S.state.decks.length});
  },
  // app.js autoEnrich's name lookups (collection, decks, saved lists, wishlist): fills the catalog; poll() reads progress.
  enrich() {
    const st = S.state, me = ++job;
    const names = [...st.collection.filter((e) => !e.lookupFailed).map((e) => e.name), ...st.decks.flatMap((d) => d.cards.map((c) => c.name)),
      ...(st.references || []).flatMap((d) => d.cards.map((c) => c.name)), ...st.wishlist.map((w) => w.name)].filter((n) => n && !meta(n));
    status = {busy: true, step: '', error: null};
    resolveNames(names, m => { if (me === job) status.step = String(m); }, false, () => me === job)
      .then(r => { if (me === job) status = {busy: false, step: '', error: null, failed: r.failed.length, total: r.total}; },
            e => { if (me === job) status = {busy: false, step: '', error: String(e && e.message || e)}; });
  },
  // The feeds Home shows (tcg.js loadHero + home-today.js dailyDetails, meta.js loadMeta, community-feed.js loadCommunity, news-pulse.js loadPulse).
  feeds(game) {
    loadToday(game);
    loadMeta(homeMetaKey(game)).catch(() => {});
    Promise.allSettled([loadCommunity(game), loadPulse(game)]);
  },
  poll() { return json(status); },
  catalog() { return json(S.catalog); },
  // search-hints.js hintPool: the names and questions the search field fades through (the player's own cards mixed in).
  hints(game) { return json({prompt: SEARCH_PROMPT, first: 4000, every: 4200, fade: 260, pool: hintPool(game, game === 'mtg' ? S.state.collection.map(e => e.name) : (S.state.tcg?.[game]?.collection || []).map(e => e.name))}); },
  // views.js home() / tcg.js tcgHome(), section by section, as models.
  home(game) {
    const st = S.state, value = collectionValue(st.collection, S.catalog, st.printings, st.decks);
    return json({game, hero: hero(game), value: homeValueModel({ game, ...value, decks: st.decks.length, history: st.valueHistory }),
      example: st.example ? 'Example data is loaded. Reset it in Settings before adding real cards.' : '', shelf: shelf(game), meta: metaRail(game), news: newsRail(game)});
  },
};
