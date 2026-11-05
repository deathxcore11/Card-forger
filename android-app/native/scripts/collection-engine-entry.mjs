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
import {mtgMetaKey} from 'WEB/power.js';
import {loadCommunity, communitySlides} from 'WEB/community-feed.js';
import {loadPulse} from 'WEB/news-pulse.js';
import {collection as collectionPage, decks as decksView, deckPage as deckView} from 'WEB/views.js';
import {ICON} from 'WEB/icons.js';

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
const classes = n => (n?.attrs?.class || '').split(/\s+/);
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

// An inline site icon (icons.js actionIcon / importance.js emblemIcon), as drawing items the app paints itself: the svg's own
// shapes, strokes and gradients, with currentColor left for the caller (the button's colour).
function icon(svg, css = {}) {
  if (!svg) return null;
  const num = v => v === undefined || v === '' ? undefined : Number(v);
  const grads = {};
  for (const g of all(svg, tagIs('lineargradient'))) grads[g.attrs.id] = {x1: num(g.attrs.x1) ?? 0, y1: num(g.attrs.y1) ?? 0, x2: num(g.attrs.x2) ?? 1, y2: num(g.attrs.y2) ?? 0,
    stops: all(g, tagIs('stop')).map(s => [num(String(s.attrs.offset || '0').replace('%', '')) / (String(s.attrs.offset || '').includes('%') ? 100 : 1), s.attrs['stop-color'] || '#000'])};
  // [css]: what a stylesheet rule sets on this svg (e.g. .wc-open svg strokes an outline), over its own attributes.
  const base = {fill: css.fill ?? svg.attrs.fill ?? 'currentColor', stroke: css.stroke ?? svg.attrs.stroke ?? 'none', sw: css.sw ?? num(svg.attrs['stroke-width']) ?? 1, cap: css.cap || svg.attrs['stroke-linecap'] || 'butt', join: css.join || svg.attrs['stroke-linejoin'] || 'miter'};
  const paint = (n, inh) => ({fill: n.attrs.fill ?? inh.fill, stroke: n.attrs.stroke ?? inh.stroke, sw: num(n.attrs['stroke-width']) ?? inh.sw, cap: n.attrs['stroke-linecap'] || inh.cap, join: n.attrs['stroke-linejoin'] || inh.join});
  const items = [];
  const walk = (n, inh) => { for (const k of n.kids || []) { if (!k.tag || k.tag === 'defs') continue; const p = paint(k, inh), a = k.attrs;
    if (k.tag === 'g') walk(k, p);
    else if (k.tag === 'path') items.push({t: 'path', d: a.d || '', ...p});
    else if (k.tag === 'rect') items.push({t: 'rect', x: num(a.x) ?? 0, y: num(a.y) ?? 0, w: num(a.width) ?? 0, h: num(a.height) ?? 0, rx: num(a.rx) ?? num(a.ry) ?? 0, ...p});
    else if (k.tag === 'circle') items.push({t: 'circle', cx: num(a.cx) ?? 0, cy: num(a.cy) ?? 0, r: num(a.r) ?? 0, ...p});
    else if (k.tag === 'ellipse') items.push({t: 'ellipse', cx: num(a.cx) ?? 0, cy: num(a.cy) ?? 0, rx: num(a.rx) ?? 0, ry: num(a.ry) ?? 0, ...p});
    else if (k.tag === 'line') items.push({t: 'path', d: `M${a.x1 || 0} ${a.y1 || 0}L${a.x2 || 0} ${a.y2 || 0}`, ...p});
    else if (k.tag === 'polyline' || k.tag === 'polygon') { const pts = String(a.points || '').trim().split(/[\s,]+/); let d = ''; for (let i = 0; i + 1 < pts.length; i += 2) d += (i ? 'L' : 'M') + pts[i] + ' ' + pts[i + 1]; items.push({t: 'path', d: d + (k.tag === 'polygon' ? 'Z' : ''), ...p}); }
  } };
  walk(svg, base);
  const vb = String(svg.attrs.viewbox || '0 0 24 24').split(/[\s,]+/).map(Number);
  return {vb, items, grads};
}
const svgIn = n => n && (n.tag === 'svg' ? n : one(n, tagIs('svg')));
const sources = img => { try { return JSON.parse(img?.attrs['data-art-sources'] || '[]'); } catch { return []; } };
const picture = img => img ? {src: img.attrs.src || '', sources: sources(img)} : null;
const selectOf = sel => sel && {name: sel.attrs['data-change'] || '', label: sel.attrs['aria-label'] || '', options: all(sel, tagIs('option')).map(o => ({value: o.attrs.value ?? text(o), label: text(o), on: o.attrs.selected !== undefined}))};
// Words with their weight, in order (the summary line's <b> runs).
const runs = n => { const out = []; const walk = (x, bold, muted) => { for (const k of x.kids || []) { if (k.text !== undefined) { const t = k.text.replace(/\s+/g, ' '); if (t) out.push({t, b: bold, m: muted}); } else if (k.tag !== 'svg') walk(k, bold || k.tag === 'b' || k.tag === 'strong', muted || cls('muted')(k)); } }; walk(n, false, false);
  return out.reduce((a, r) => { const last = a[a.length - 1]; if (last && last.b === r.b && last.m === r.m) last.t += r.t; else a.push({...r}); return a; }, []).map((r, i, a) => ({...r, t: i === 0 ? r.t.replace(/^\s+/, '') : i === a.length - 1 ? r.t.replace(/\s+$/, '') : r.t})); };

// views.js collection() / collectionList(): the Cards tab as the site draws it, row by row.
function lotRow(n) {
  const art = one(n, cls('lot-art')), img = one(art, tagIs('img')), name = one(n, cls('lot-name')), badge = one(name, cls('set-badge')), sub = one(n, cls('lot-sub')),
    emb = one(name, cls('imp-row')), tag = one(n, cls('tag')), step = one(n, cls('stepper')), cond = one(n, cls('condition-badge')), origin = one(n, cls('price-origin'));
  const tierColor = (/--tier:\s*([^;]+)/.exec(n.attrs.style || '') || [])[1] || 'transparent';
  let finish = null; try { finish = JSON.parse(art?.attrs['data-finish-model'] || 'null'); } catch {}
  const subRuns = []; for (const k of sub?.kids || []) { if (!k.tag || cls('mana')(k)) continue; if (cls('want-chip')(k)) continue;
    for (const r of runs({kids: [k]})) subRuns.push({t: r.t, foil: false}); const foil = one(k, cls('foil')); if (foil) { const all = subRuns.map(r => r.t).join(''), ft = text(foil), at = all.lastIndexOf(ft); if (at >= 0) { subRuns.length = 0; subRuns.push({t: all.slice(0, at), foil: false}, {t: ft, foil: true}, {t: all.slice(at + ft.length), foil: false}); } } }
  return {id: name?.attrs['data-entry'] || (one(n, n => n.attrs['data-act'] === 'wishRemove')?.attrs['data-id'] ? 'w:' + one(n, n => n.attrs['data-act'] === 'wishRemove').attrs['data-id'] : ''), name: name?.attrs['data-name'] || text(name),
    wanted: cls('wanted')(n), tier: n.attrs['data-tier'] || 'tn', tierColor: tierColor.trim(), picture: picture(img), alt: img?.attrs.alt || '', fallback: img ? '' : text(art),
    finish: finish && {key: finish.key || '', effect: finish.effect || art?.attrs['data-finish-effect'] || '', printingId: finish.printingId || '', status: finish.status || ''},
    emblem: emb && {title: emb.attrs.title || '', icon: icon(svgIn(emb))},
    set: badge && {code: (badge.attrs['data-code'] || '').toUpperCase(), rarity: (classes(badge).find(c => c.startsWith('r-')) || 'r-common').slice(2), unknown: cls('unknown')(badge), label: text(badge), title: badge.attrs.title || ''},
    mana: all(one(sub, cls('mana')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
    sub: subRuns.filter(r => r.t), wantChip: text(one(sub, cls('want-chip'))), wishId: one(n, x => x.attrs['data-act'] === 'wishRemove')?.attrs['data-id'] || '',
    tag: tag && {text: text(tag), warn: cls('warn')(tag), act: tag.attrs['data-act'] || ''},
    price: text(one(n, cls('price'))), condition: cond && {code: text(cond), info: cond.attrs['data-condition-info'] || ''}, origin: origin ? text(origin) : '',
    qty: step ? Number(text(one(step, tagIs('b')))) || 0 : 0, edit: !!one(n, x => x.attrs['data-act'] === 'editLot' && cls('link')(x)), got: text(one(n, cls('want-got'))),
    // The copy's printing when it shows a finish: the app draws that foil from it (finish-preview.js reads the same record).
    print: finish && finish.key && finish.key !== 'nonfoil' && finish.printingId ? S.state.printings?.[finish.printingId] || null : null};
}
// app.js's handlers for the Cards tab's controls (C.collSort, C.collDirection, C.collFilter, I.collSearch, A.collMore), verbatim
// but for the redraw, which is the app's.
const cardsAct = {
  sort: v => { S.ui.collSort = v; S.ui.collDirection = undefined; S.ui.collLimit = 120; },
  direction: v => { S.ui.collDirection = v; S.ui.collLimit = 120; },
  filter: v => { S.ui.collFilter = v; },
  search: v => { S.ui.q.coll = v; S.ui.collLimit = 120; },
  more: () => { S.ui.collLimit += 200; },
};
function cardsPage(game, o = {}) {
  const ui = S.ui;
  if (o.sort) ui.collSort = o.sort; if (o.direction) ui.collDirection = o.direction; if (o.filter) ui.collFilter = o.filter;
  if (o.q !== undefined) ui.q.coll = String(o.q); if (o.limit) ui.collLimit = Number(o.limit) || 120;
  ui.collTab = 'cards';
  const t = tree(collectionPage()), head = one(t, cls('page-head')), seg = one(t, cls('seg')), empty = one(t, cls('empty'));
  const view = one(head, cls('view-switch')), batch = one(head, x => x.attrs['data-act'] === 'batchStart'), menu = one(head, x => x.attrs['data-act'] === 'collMenu');
  const tools = one(t, cls('coll-tools')), search = one(tools, x => x.tag === 'input'), list = one(t, cls('display-list')), more = one(t, x => x.attrs['data-act'] === 'collMore');
  return {game, title: text(one(head, tagIs('h1'))), banner: picture(one(head, cls('page-hero-img'))), bannerCard: head?.attrs['data-banner-card'] || '',
    views: view ? all(view, tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})) : [],
    select: batch && {label: text(batch), aria: batch.attrs['aria-label'] || '', icon: icon(svgIn(batch))}, menu: menu && {label: text(menu), aria: menu.attrs['aria-label'] || ''},
    tabs: all(seg, tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))})),
    empty: empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), mark: text(one(empty, cls('empty-mark'))), actions: all(empty, tagIs('button')).map(b => ({label: text(b), act: b.attrs['data-act'] || '', ghost: cls('ghost')(b)}))},
    summary: runs(one(t, cls('summary-line')) || {kids: []}),
    sort: selectOf(one(tools, x => x.tag === 'select' && x.attrs['data-change'] === 'collSort')), direction: selectOf(one(tools, x => x.tag === 'select' && /dir/i.test(x.attrs['data-change'] || ''))),
    search: search && {value: search.attrs.value || '', placeholder: search.attrs.placeholder || '', label: search.attrs['aria-label'] || ''},
    filter: selectOf(one(tools, x => x.tag === 'select' && x.attrs['data-change'] === 'collFilter')),
    rows: list ? all(list, x => cls('lot')(x) && x.tag === 'div').map(lotRow) : [], none: list ? '' : text(one(one(t, tagIs('div')), x => x.tag === 'p' && cls('center')(x))) || text(one(t, x => x.tag === 'p' && cls('pad')(x))),
    more: more ? {label: text(more), count: Number((/\((\d+)\)/.exec(text(more)) || [])[1]) || 0} : null,
    // icons.js decorateGlyphs: a button whose only text is −, ＋ or ⋯ shows ICON.minus / plus / more; LEAD ＋ and the wishlist tag use plus and heart.
    glyphs: Object.fromEntries(["minus", "plus", "more", "heart"].map(k => [k, icon(svgIn(tree(ICON[k])))]))};
}

// icons.js decorateGlyphs: a label that starts with one of these and a space wears that icon in its place (LEAD, as the site has it).
const LEAD = { "▲": "warn", "●": "stop", "⚔": "sword", "☠": "poison", "🎲": "random", "⚒": "build", "✧": "ideas", "🏆": "trophy", "⇄": "compare", "♡": "heart", "♥": "heartOn", "＋": "plus", "+": "plus", "↥": "import", "↓": "export", "⟳": "refresh", "↻": "flip", "⧉": "copy", "🔗": "link", "🖨": "print", "📷": "camera", "◈": "pack", "☆": "bookmark", "▦": "collection", "📖": "book", "◷": "history", "🛒": "bag", "⌕": "search", "☑": "pick", "⚠": "warn", "🖌": "brush", "✓": "check", "←": "back", "‹": "back", "▧": "scan" };
const glyph = s => { const m = /^(\s*)(\S)\uFE0F?[ \u00a0](?=\S)/u.exec(s); return m && LEAD[m[2]] && ICON[LEAD[m[2]]] ? {icon: icon(svgIn(tree(ICON[LEAD[m[2]]]))), label: s.slice(m[0].length)} : {icon: null, label: s}; };
// style.css .wc-open svg: an outline, 1.8 wide, round ends.
const WC_SVG = {fill: 'none', stroke: 'currentColor', sw: 1.8, cap: 'round', join: 'round'};
const button = b => { const g = glyph(text(b)); return {label: g.label, act: b.attrs['data-act'] || '', ghost: cls('ghost')(b), chest: cls('wc-open')(b), aria: b.attrs['aria-label'] || '', icon: icon(svgIn(b), cls('wc-open')(b) ? WC_SVG : {}) || g.icon}; };
const widthOf = n => Number((/width:\s*([\d.]+)%/.exec(n?.attrs?.style || '') || [])[1]) || 0;

// views.js deckTile: cover art, format chip and its emblem, the deck box (power.js / deck-box.js), colour identity, name, size line,
// power chip, owned share and what is left to find, and the owned bar.
function deckTileModel(n) {
  const to = n.attrs['data-to'] || '', fmt = one(n, cls('deck-format-emblem')), box = one(n, cls('deck-box')), body = one(n, cls('tile-body')), chip = one(n, cls('power-chip'));
  const owned = one(n, cls('tile-owned')), find = one(n, cls('tile-find')), em = text(one(chip, tagIs('em')));
  const cover = one(one(n, cls('tile-art')), tagIs('img'));
  // ui.js img / tierRing: the cover card's price tier rings the art.
  return {id: decodeURIComponent(to.replace(/^#deck\//, '')), to, wide: cls('wide')(n), cover: picture(cover), tier: cover?.attrs['data-tier'] || '', tierColor: ((/--tier:\s*([^;]+)/.exec(cover?.attrs.style || '') || [])[1] || '').trim(),
    format: {name: text(fmt), icon: icon(svgIn(fmt))},
    box: box && {color: ((/--deck-box-color:\s*([^;]+)/.exec(box.attrs.style || '') || [])[1] || '').trim(), cards: all(one(box, cls('deck-box-cards')), tagIs('img')).map(i => i.attrs.src || '')},
    dots: all(one(n, cls('dots')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
    name: text(one(body, tagIs('b'))), line: text(one(body, tagIs('small'))),
    power: chip && {value: em, label: text(chip).slice(em.length).trim(), level: ((/\bp-(hi|mid|lo)\b/.exec(chip.attrs.class || '') || [])[1]) || 'mid', title: chip.attrs.title || ''},
    owned: text(one(owned, tagIs('em'))), ownedText: text(owned).slice(text(one(owned, tagIs('em'))).length).trim(),
    find: text(one(find, tagIs('em'))), findText: text(find).slice(text(one(find, tagIs('em'))).length).trim(),
    bar: widthOf(one(one(body, cls('bar')), tagIs('span'))) / 100};
}

// views.js decks(), My decks: the page head, its tabs and tools, and every deck as deckTile draws it. [o] = {q} as I.shelfSearch sets it.
function decksPage(game, o = {}) {
  const ui = S.ui;
  ui.decksTab = 'mine'; if (o.q !== undefined) ui.q.shelf = String(o.q);
  const t = tree(decksView()), head = one(t, cls('page-head')), empty = one(t, cls('empty')), search = one(one(t, cls('toolbar')), tagIs('input')), list = one(t, x => x.attrs.id === 'shelfList');
  return {game, title: text(one(head, tagIs('h1'))), actions: all(one(head, cls('head-actions')), tagIs('button')).map(button),
    tabs: all(one(t, cls('seg')), tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))})),
    tools: all(one(t, cls('random-tools')), tagIs('button')).map(button),
    search: search && {value: search.attrs.value || '', placeholder: search.attrs.placeholder || '', label: search.attrs['aria-label'] || ''},
    tiles: all(t, x => cls('deck-tile')(x)).map(deckTileModel),
    none: list ? text(one(list, x => x.tag === 'p')) : '',
    empty: empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), mark: text(one(empty, cls('empty-mark'))), actions: all(empty, tagIs('button')).map(button)}};
}


// views.js deckPage(), the Cards tab: deckShell's hero (deck-viewer.js), the actions under it, the deck tabs, the card toolbar,
// the cards as deckRow / mtgSideboard draw them, the emblem panel (importance.js deckEmblemHtml) and "Take it to the table".
const DECK_VIEWS = ['stacks', 'gallery', 'symbols', 'compact'];
const tierOfNode = n => ({tier: n?.attrs?.['data-tier'] || 'tn', tierColor: ((/--tier:\s*([^;]+)/.exec(n?.attrs?.style || '') || [])[1] || '').trim()});
const lead = b => { const g = glyph(text(b)); return {label: g.label, icon: icon(svgIn(b)) || g.icon}; };
function deckRowModel(n) {
  const r = lotRow(n), own = one(n, cls('own')), side = one(n, cls('lot-side')), chip = one(side, cls('chip')), sub = one(n, cls('lot-sub'));
  return {...r, id: n.attrs['data-deck-name'] || r.name, name: n.attrs['data-deck-name'] || r.name, sub: [], tag: null,
    qty: Number(n.attrs['data-deck-qty']) || r.qty, zone: n.attrs['data-deck-zone'] || 'main', category: n.attrs['data-deck-category'] || 'Unresolved',
    roles: (n.attrs['data-deck-roles'] || '').split(',').filter(Boolean), short: cls('short')(n),
    own: own ? {text: text(own), yes: cls('yes')(own)} : null,
    legal: all(sub, cls('tag')).map(t => ({text: text(t), bad: cls('bad')(t)})),
    chip: chip ? text(chip) : '', stepper: !!one(side, cls('stepper')),
    // ui.js tileChrome on the art: the colour emblems (mana symbols) and the set symbol in its rarity, docked at the foot.
    chrome: (() => { const c = one(one(n, cls('lot-art')), cls('tile-chrome')); if (!c) return null; const set = one(c, cls('set-icon')), imp = one(c, cls('imp-tile'));
      return {emb: all(one(c, cls('tile-emb')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
        set: set ? {src: ((/url\('([^']+)'\)/.exec(set.attrs.style || '') || [])[1] || ''), rarity: (classes(set).find(x => x.startsWith('r-')) || 'r-common').slice(2), title: one(c, cls('tset'))?.attrs.title || ''} : null,
        imp: imp ? icon(svgIn(imp)) : null}; })()};
}
function miniRowModel(n) {
  const img = one(n, tagIs('img')), small = one(n, x => x.tag === 'span' && cls('small')(x));
  return {name: n.attrs['data-deck-name'] || n.attrs['data-name'] || '', qty: Number(n.attrs['data-deck-qty']) || 0, zone: n.attrs['data-deck-zone'] || 'side',
    category: n.attrs['data-deck-category'] || 'Unresolved', roles: (n.attrs['data-deck-roles'] || '').split(',').filter(Boolean),
    picture: picture(img), ...tierOfNode(img), label: text(one(n, cls('ellip'))), own: small ? {text: text(small), ok: cls('ok-text')(small)} : null};
}
// deck-viewer.js stackList / stackSummary, which rebuild the list in the page: the same piles as data. Cards group by their type in
// GROUP_ORDER, six to a pile; a group's heading hides when it is the list's only type and the list's own heading already names it.
const GROUP_ORDER = ['Commander', 'Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Battles', 'Lands', 'Pokémon', 'Trainers', 'Energy', 'Monsters', 'Spells', 'Traps', 'Unresolved'];
function stacksOf(rows, heading) {
  const groups = new Map();
  rows.forEach((r, i) => { const c = r.category || 'Unresolved'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); });
  let piles = 0;
  const out = [...groups].sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)).map(([category, idx]) => {
    const pile = []; for (let i = 0; i < idx.length; i += 6) pile.push(idx.slice(i, i + 6)); piles += pile.length;
    return {category, count: idx.reduce((n, i) => n + (Number(rows[i].qty) || 0), 0), hidden: groups.size === 1 && heading.trim().startsWith(category), piles: pile};
  });
  return {groups: out, piles};
}
const deckAct = {
  // app.js I.deckSearch, A.deckChip, C.deckSort and workbench-ui.js A.deckView (the account's settings.displayModes[game].deck).
  search: v => { S.ui.q.deck = String(v); },
  filter: v => { S.ui.deckFilter = v || 'all'; },
  sort: v => { S.ui.deckSort = v; },
  view: v => { if (DECK_VIEWS.includes(v)) ((S.state.settings.displayModes ||= {}).mtg ||= {}).deck = v; },
};
// app.js route(): opening another deck clears the deck search.
function deckOpen(id) { if (id !== S.ui.deckId) { S.ui.q.deck = ''; S.ui.deckId = id; } }
function deckPageModel(game, id) {
  const ui = S.ui;
  deckOpen(id);
  ui.deckTab = 'cards';
  const t = tree(deckView()), hero = one(t, cls('ds-hero'));
  if (!hero) { const e = one(t, cls('empty')); return {game, id, missing: {title: text(one(e, tagIs('h3'))), text: text(one(e, tagIs('p')))}}; }
  const nav = one(hero, cls('ds-nav')), menu = one(nav, cls('ds-menu')), brow = one(hero, cls('deck-hero-eyebrow'));
  const eyebrow = (brow?.kids || []).filter(k => k.tag).map(k => cls('review-badge')(k) ? {kind: 'review', level: ['bad', 'warn', 'ok'].find(c => cls(c)(k)) || 'warn', ...lead(k), act: k.attrs['data-act'] || ''}
    : cls('dots')(k) ? {kind: 'dots', label: k.attrs['aria-label'] || '', dots: all(k, tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''}))}
    : {kind: 'chip', label: text(k), title: k.attrs.title || '', badge: cls('ds-badge')(k)});
  const viewer = one(t, cls('deck-viewer')), list = one(viewer, x => x.attrs.id === 'deckList'), toolbar = one(t, cls('deck-toolbar'));
  const groups = all(list, x => x.tag === 'details' && cls('group')(x) && !cls('side-group')(x)).map(g => {
    const sum = one(g, tagIs('summary')), first = one(sum, tagIs('span')), em = one(first, tagIs('em'));
    const rows = all(one(g, x => x.attrs['data-deck-list'] !== undefined), x => cls('deck-row')(x)).map(deckRowModel);
    const heading = text(first);
    return {name: heading.slice(0, heading.length - text(em).length).trim(), count: text(em), rows, stacks: stacksOf(rows, heading)};
  });
  const sideG = one(viewer, cls('side-group')), sideSum = one(sideG, tagIs('summary')), sideFirst = one(sideSum, tagIs('span'));
  const sideRows = all(sideG, cls('mini-row')).map(miniRowModel);
  const embS = one(t, cls('deck-emb')), foot = one(t, cls('deck-table-footer')), footP = one(foot, tagIs('p'));
  // stackSummary: the roles of the main deck's cards, counted by copies.
  const roles = new Map();
  for (const r of groups.flatMap(g => g.rows)) if (r.zone !== 'side') for (const role of r.roles) roles.set(role, (roles.get(role) || 0) + (Number(r.qty) || 0));
  const cmdNote = one(t, x => cls('block-note')(x));
  return {game, id, format: (S.state.decks || []).find(d => String(d.id) === String(id))?.format || '', view: viewer?.attrs['data-deck-view'] || 'gallery',
    hero: {art: picture(one(hero, cls('hero-art'))), back: !!one(nav, cls('icon')), menu: menu ? {label: menu.attrs['aria-label'] || '', title: menu.attrs.title || ''} : null,
      eyebrow, title: text(one(hero, tagIs('h1'))), line: text(one(hero, cls('ds-line'))),
      stats: all(one(hero, cls('ds-stats')), cls('ds-stat')).map(x => ({value: text(one(x, tagIs('b'))), label: text(one(x, tagIs('span'))), warn: cls('warn')(x), button: x.tag === 'button', act: x.attrs['data-act'] || '', id: x.attrs['data-id'] || ''})),
      owned: one(hero, cls('ds-bar')) ? widthOf(one(one(hero, cls('ds-bar')), tagIs('i'))) / 100 : null},
    // desktop-play.js syncDesktopPlayEntries: on every touch device Magic's Practice plate shows (the page draws it hidden until then).
    actions: all(one(t, cls('ds-actions')), tagIs('button')).map(b => ({label: text({kids: b.kids}), act: b.attrs['data-act'] || '', id: b.attrs['data-id'] || '', primary: cls('ds-primary')(b), plate: cls('cs-plate')(b),
      shown: b.attrs['data-desktop-play-entry'] === 'practice' ? game === 'mtg' : b.attrs.hidden === undefined})),
    note: (() => { const n = one(t, x => cls('note')(x) && cls('warn')(x) && x.tag === 'div'); return n ? {text: text({kids: (n.kids || []).filter(k => k.tag !== 'p')}), lines: all(n, tagIs('p')).map(text)} : null; })(),
    tabs: all(one(t, x => x.tag === 'nav' && cls('tabs')(x)), tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))})),
    commanderNote: cmdNote ? {text: text(cmdNote).replace(/^⚠\s*/, ''), act: cmdNote.attrs['data-act'] || '', id: cmdNote.attrs['data-id'] || ''} : null,
    search: (() => { const i = one(toolbar, tagIs('input')); return i && {value: i.attrs.value || '', placeholder: i.attrs.placeholder || '', label: i.attrs['aria-label'] || ''}; })(),
    chips: all(one(toolbar, cls('deck-chips')), tagIs('button')).map(b => { const c = text(one(b, tagIs('b'))); const l = text(b); return {id: b.attrs['data-id'], label: c ? l.slice(0, l.length - c.length).trim() : l, count: c, on: cls('on')(b)}; }),
    group: selectOf(one(toolbar, x => x.tag === 'select')),
    add: (() => { const b = one(toolbar, cls('deck-add-toggle')); return b ? {...lead(b), title: b.attrs.title || ''} : null; })(),
    views: all(one(toolbar, cls('deck-view-switch')), tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})),
    groups, none: groups.length ? '' : text(one(list, x => x.tag === 'p')),
    roles: [...roles].map(([role, count]) => ({role, count})),
    side: sideG ? {count: text(one(sideFirst, tagIs('em'))), over: text(one(sideFirst, cls('warn-text'))).replace(/^·\s*/, ''), status: text(one(sideSum, cls('muted'))),
      text: text(one(sideG, x => x.tag === 'p')), rows: sideRows, stacks: stacksOf(sideRows, text(sideFirst))} : null,
    emblems: embS ? {tally: all(one(embS, cls('emb-tally')), cls('emb-count')).map(x => { const b = text(one(x, tagIs('b'))); return {kind: (classes(x).find(c => c.startsWith('imp-')) || '').slice(4), icon: icon(svgIn(x)), count: b, label: text(x).slice(b.length).trim()}; }),
      none: text(one(one(embS, cls('emb-tally')), cls('muted'))), head: text(one(embS, cls('list-head'))),
      swaps: all(embS, cls('emb-swap')).map(x => { const [o, i] = all(x, x => x.tag === 'button' && cls('link')(x)); const btn = one(x, x => cls('btn')(x));
        return {out: o?.attrs['data-name'] || text(o), in: i?.attrs['data-name'] || text(i), inIcon: icon(svgIn(i)), button: text(btn), why: text(one(x, cls('emb-why')))}; }),
      foot: text(one(embS, cls('foot')))} : null,
    table: foot ? {title: text(one(foot, tagIs('h3'))), line: runs(footP || {kids: []}), bar: widthOf(one(one(foot, cls('bar')), tagIs('span'))) / 100,
      actions: all(one(foot, cls('deck-table-actions')), tagIs('button')).map(b => ({label: text(b), act: b.attrs['data-act'] || '', ghost: cls('ghost')(b)}))} : null,
    glyphs: Object.fromEntries(["minus", "plus", "more", "back"].map(k => [k, icon(svgIn(tree(ICON[k])))]))};
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
  // [deckId]: the open deck page also fetches its own format's tournament decks (app.js route: Deck Power and the emblems
  // compare against them), when they are missing or older than 12 hours.
  feeds(game, deckId) {
    loadToday(game);
    loadMeta(homeMetaKey(game)).catch(() => {});
    const deck = deckId ? S.state.decks.find(d => String(d.id) === String(deckId)) : null, mk = deck ? mtgMetaKey(deck) : null;
    if (mk) { const M = metaState(mk); if (!M.busy && (!M.data || Date.now() - M.at > 12 * 3600e3)) loadMeta(mk).catch(() => {}); }
    Promise.allSettled([loadCommunity(game), loadPulse(game)]);
  },
  poll() { return json(status); },
  catalog() { return json(S.catalog); },
  // search-hints.js hintPool: the names and questions the search field fades through (the player's own cards mixed in).
  hints(game) { return json({prompt: SEARCH_PROMPT, first: 4000, every: 4200, fade: 260, pool: hintPool(game, game === 'mtg' ? S.state.collection.map(e => e.name) : (S.state.tcg?.[game]?.collection || []).map(e => e.name))}); },
  // views.js home() / tcg.js tcgHome(), section by section, as models.
  // views.js collection(): the Cards tab, [optsJson] = {sort, direction, filter, q, limit} as the site's controls set them.
  cards(game, optsJson) { return json(cardsPage(game, optsJson ? JSON.parse(optsJson) : {})); },
  // One of the page's controls, as the site handles it (cardsAct), then the page again.
  // views.js decks(), My decks; [optsJson] = {q} (I.shelfSearch).
  decks(game, optsJson) { return json(decksPage(game, optsJson ? JSON.parse(optsJson) : {})); },
  // views.js deckPage(), the Cards tab of deck [id]; deckDo applies one of its controls as the site's handler does (deckAct), then draws it again.
  // [opts] = {search, filter, sort, view}: the controls as the app last left them, applied before the page draws.
  deck(game, id, opts) { deckOpen(id); const o = opts ? JSON.parse(opts) : {}; for (const k of Object.keys(deckAct)) if (o[k] != null) deckAct[k](o[k]); return json(deckPageModel(game, id)); },
  deckDo(game, id, kind, value) { if (!deckAct[kind]) throw Error('unknown deck control ' + kind); deckOpen(id); deckAct[kind](value); return json(deckPageModel(game, id)); },
  cardsDo(game, kind, value) { if (!cardsAct[kind]) throw Error('unknown Cards control ' + kind); cardsAct[kind](value); return json(cardsPage(game)); },
  home(game) {
    const st = S.state, value = collectionValue(st.collection, S.catalog, st.printings, st.decks);
    return json({game, hero: hero(game), value: homeValueModel({ game, ...value, decks: st.decks.length, history: st.valueHistory }),
      example: st.example ? 'Example data is loaded. Reset it in Settings before adding real cards.' : '', shelf: shelf(game), meta: metaRail(game), news: newsRail(game)});
  },
};
