import { pokemonArtCrop } from './artwork.js';
import { ptcgIcon } from './meta.js';
// The app functions Ask AI may use. Each runs on this device against the app's own data and
// returns compact JSON for the model; nothing here reaches outside the app's own data sources.
// app.js passes in its internals (ctx) because its actions are module-scoped.
const GAMES = ['mtg', 'ygo', 'ptcg'];
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v) * 100) / 100 : null);
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const lim = (n, d, max) => Math.max(1, Math.min(max, Number.isInteger(n) && n > 0 ? n : d));
const BASICS = /^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$/i;
const mtgText = (c) => [c?.oracle_text, ...(c?.card_faces || []).map((f) => f.oracle_text)].filter(Boolean).join(' // ');
const mtgImg = (c) => c?.image_uris?.normal || c?.image_uris?.small || c?.card_faces?.[0]?.image_uris?.normal || '';
const tcgSet = (c) => c?.set?.name || c?.setName || c?.sets?.[0]?.name || c?.sets?.[0]?.set || '';

export function makeAskTools(x) {
  const { S, T } = x;
  const visuals = new Map();
  let suggestions = [], buildId = 0;
  const builders = new Map();
  const visualKey = s => [s.game,s.kind,s.ref].join(':');
  async function deckVisual(g, d, item, share = null) {
    if (!d) return;
    const rows = d.list || d.main || d.cards || d.zones?.main || [];
    let card = null, image = '';
    try {
      if (g === 'ygo' && d.cover) image = `img/ygo/a/${encodeURIComponent(d.cover)}.jpg`;
      else if (g === 'mtg') {
        const lead = d.commander || rows.find(r => x.meta(r.name)?.type_line && !/Land/.test(x.meta(r.name).type_line))?.name || rows.find(r=>!BASICS.test(r.name))?.name;
        card = lead ? x.meta(lead) || await x.resolve?.(lead).catch(()=>null) : null;
        image = card?.image_uris?.art_crop || card?.card_faces?.[0]?.image_uris?.art_crop || mtgImg(card);
      } else {
        const words = String(item.label || d.name).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>3 && !['basic','mega','deck'].includes(w));
        const pokemon = rows.filter(r=>r.kind === 'Pokemon').sort((a,b)=>(b.qty||0)-(a.qty||0));
        const lead = pokemon.find(r=>words.some(w=>r.name.toLowerCase().includes(w))) || pokemon.find(r=>/ex|VSTAR|VMAX/i.test(r.name)) || pokemon[0] || rows.find(r=>! /Energy/.test(r.name));
        card = lead && (Object.values(T.cache?.[g] || {}).find(c=>c.name===lead.name) || await (T.SOURCES[g].tournamentCard?.(lead) || T.SOURCES[g].byName(lead.name)).catch(()=>null));
        image = card?.imageLarge || card?.image || '';
      }
    } catch {}
    visuals.set(visualKey(item), { image, card, share, name: d.name, label:item.label });
  }
  async function decorateMeta(g, data, result) {
    const items = (result.decks || []).slice(0,6).map(d=>({kind:'meta',game:g,ref:d.key || d.name,label:d.name}));
    suggestions = items;
    await Promise.all(items.map(async (item,i)=> {
      const d=(data.decks || []).find(d=>d.key===item.ref) || (data.decks || []).find(d=>d.name===item.ref);
      if (d) return deckVisual(g,d,item,result.decks[i].share);
      const a=(data.archetypes || []).find(a=>(a.name || a.id)===item.label);
      const icon=a?.icons?.[0];
      visuals.set(visualKey(item), { image:g==='ptcg' && icon?ptcgIcon(icon):'', sprite:!!icon, share:result.decks[i].share, label:item.label });
    }));
    return result;
  }
  const g0 = (g) => (GAMES.includes(g) ? g : T.game());
  const mtgCard = (c) => ({ name: c.name, type: clip(c.type_line, 80), cost: c.mana_cost || '', set: c.set_name, setCode: c.set, rarity: c.rarity, price: num(x.priceOf(c.name)), owned: x.inv(c.name).owned || 0 });
  const tcgCard = (g, c) => ({ id: String(c.id), name: c.name, type: clip(c.typeLine || c.type || c.category, 80), set: tcgSet(c), rarity: c.rarity || '', price: num(c.prices?.usd), owned: T.ownedMap(g).get(T.SOURCES[g].ownKey(c)) || 0 });
  async function mtgSearch(q, limit) {
    const run = (query) => x.api('/cards/search?' + new URLSearchParams({ q: query + ' game:paper', order: 'edhrec' })).catch(() => null);
    const d = (await run(q)) || (await run(`o:"${q.replace(/"/g, '')}"`));
    return (d?.data || []).slice(0, limit).map((c) => mtgCard(x.cacheCard(c)));
  }
  async function mtgSets() { if (!S.ui.sets?.list?.length) await x.loadSetIndex().catch(() => {}); return (S.ui.sets?.list || []).filter((s) => !s.digital); }
  async function tcgSets(g) { if (!T.ui(g).sets?.list?.length) await x.tcgCtx.loadSets?.(g).catch(() => {}); return T.ui(g).sets?.list || []; }
  const metaKey = (format) => { const f = String(format || S.ui.mtgMeta?.format || 'Modern'); return 'mtg:' + (/commander|edh|cedh/i.test(f) ? 'EDH' : x.MTG_META_FORMATS.find(([k]) => k.toLowerCase() === f.toLowerCase())?.[0] || 'Modern'); };

  const tools = {
    async search_cards({ game, query, limit }) {
      const g = g0(game), n = lim(limit, 8, 15), q = clip(query, 120);
      if (!q) return { error: 'Give a card name or words to search for.' };
      if (g === 'mtg') return { game: g, cards: await mtgSearch(q, n) };
      const r = await T.SOURCES[g].search({ q, page: 0, size: n }).catch(() => ({ cards: [] }));
      // Search results can be brief (no prices or set): load full data for the top few.
      const full = await Promise.all((r.cards || []).slice(0, n).map((c, i) => (i < 5 && (c.brief || c.prices?.usd == null) ? T.ensureCard(g, c.id).catch(() => c) : c)));
      return { game: g, cards: full.map((c) => tcgCard(g, c)) };
    },
    async card_details({ game, name }) {
      const g = g0(game), q = clip(name, 120);
      if (g === 'mtg') {
        const c = x.meta(q) || (await x.resolve(q, true).catch(() => null));
        if (!c) return { error: `No Magic card named ${q}.` };
        return { game: g, card: { ...mtgCard(c), text: clip(mtgText(c), 900), pt: c.power != null ? `${c.power}/${c.toughness}` : '', foilPrice: num(c.prices?.usd_foil), legal: Object.entries(c.legalities || {}).filter(([, v]) => v === 'legal').map(([k]) => k).slice(0, 12) } };
      }
      let c = await T.SOURCES[g].byName(q).catch(() => null);
      if (!c) c = (await T.SOURCES[g].search({ q, page: 0, size: 1 }).catch(() => ({ cards: [] }))).cards?.[0];
      if (!c) return { error: `No ${g === 'ygo' ? 'Yu-Gi-Oh!' : 'Pokémon'} card named ${q}.` };
      c = (await T.ensureCard(g, c.id).catch(() => null)) || c;
      return { game: g, card: { ...tcgCard(g, c), text: clip(c.text || c.desc || [...(c.abilities || []).map((a) => `${a.name}: ${a.effect}`), ...(c.attacks || []).map((a) => `${a.name} ${a.damage || ''} ${a.effect || ''}`)].join(' | '), 900), hp: c.hp || null, level: c.level || null, atk: c.atk ?? null, def: c.def ?? null, printings: (c.sets || []).slice(0, 8).map((s) => ({ set: s.name || s.set, code: s.code, rarity: s.rarity, price: num(s.price) })) } };
    },
    async my_collection({ game, sort, limit }) {
      const g = g0(game), n = lim(limit, 10, 25);
      if (g === 'mtg') {
        const st = S.state, v = x.collectionValue(st.collection, S.catalog, st.printings, st.decks);
        let rows = st.collection.map((e, i) => ({ e, i, value: x.lotPrice(e, S.catalog, st.printings) || 0 }));
        rows.sort(sort === 'quantity' ? (a, b) => b.e.qty - a.e.qty : sort === 'recent' ? (a, b) => b.i - a.i : (a, b) => b.value - a.value);
        return { game: g, totalValue: num(v.total), copies: v.copies, unpriced: v.unpriced, cards: rows.slice(0, n).map(({ e, value }) => ({ name: e.name, qty: e.qty, set: e.setName || e.set || '', value: num(value), each: num(value / Math.max(1, e.qty)) })) };
      }
      const col = T.gs(g).collection, v = T.collectionValue(g);
      let rows = col.map((e, i) => { const c = T.cardOf(g, e.cardId), each = c ? T.entryPrice(c, e) ?? c.prices?.usd : null; return { e, i, c, each: num(each), value: num((each || 0) * e.qty) }; });
      rows.sort(sort === 'quantity' ? (a, b) => b.e.qty - a.e.qty : sort === 'recent' ? (a, b) => b.i - a.i : (a, b) => (b.value || 0) - (a.value || 0));
      return { game: g, totalValue: num(v.total), copies: v.copies, unpriced: v.unpriced, cards: rows.slice(0, n).map((r) => ({ id: String(r.e.cardId), name: r.e.name, qty: r.e.qty, set: r.e.printing || tcgSet(r.c), each: r.each, value: r.value })) };
    },
    async list_sets({ game, query, order, limit }) {
      const g = g0(game), n = lim(limit, 10, 30), q = clip(query, 60).toLowerCase();
      // Real card sets only (no token, promo or art-series sets), each marked released or upcoming.
      const today = new Date().toISOString().slice(0, 10), skip = /^(token|memorabilia|minigame|promo|art_series|alchemy|treasure_chest|vanguard)$/;
      let sets = g === 'mtg' ? (await mtgSets()).filter((s) => !skip.test(s.set_type || '') || q).map((s) => ({ code: s.code, name: s.name, date: s.released_at, cards: s.card_count, type: s.set_type })) : (await tcgSets(g)).map((s) => ({ code: s.id, name: s.name, date: s.date, cards: s.count, series: s.series }));
      sets = sets.map((s) => ({ ...s, status: s.date && s.date > today ? 'upcoming' : 'released' }));
      if (q) sets = sets.filter((s) => s.name.toLowerCase().includes(q) || String(s.code).toLowerCase() === q);
      if (order !== 'largest') sets = sets.filter((s) => s.date);
      sets.sort(order === 'oldest' ? (a, b) => a.date.localeCompare(b.date) : order === 'largest' ? (a, b) => (b.cards || 0) - (a.cards || 0) : (a, b) => b.date.localeCompare(a.date));
      const latest = [...sets].filter((s) => s.status === 'released').sort((a, b) => b.date.localeCompare(a.date))[0] || null, upcoming = sets.filter((s) => s.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
      return { game: g, today, latestReleased: latest, upcoming, sets: sets.slice(0, n) };
    },
    async set_cards({ game, set, limit }) {
      const g = g0(game), n = lim(limit, 8, 20), q = clip(set, 80).toLowerCase();
      if (g === 'mtg') {
        const s = (await mtgSets()).find((s) => s.code.toLowerCase() === q || s.name.toLowerCase() === q) || (await mtgSets()).find((s) => s.name.toLowerCase().includes(q));
        if (!s) return { error: `No Magic set matching ${set}.` };
        const d = await x.api('/cards/search?' + new URLSearchParams({ q: `set:${s.code} game:paper`, order: 'usd', dir: 'desc' })).catch(() => null);
        return { game: g, set: { code: s.code, name: s.name, date: s.released_at }, cards: (d?.data || []).slice(0, n).map((c) => mtgCard(x.cacheCard(c))) };
      }
      const sets = await tcgSets(g), s = sets.find((s) => String(s.id).toLowerCase() === q || s.name.toLowerCase() === q) || sets.find((s) => s.name.toLowerCase().includes(q));
      if (!s) return { error: `No set matching ${set}.` };
      let cards = await T.SOURCES[g].setCards(s).catch(() => T.SOURCES[g].setCards(s.id).catch(() => []));
      cards = Array.isArray(cards) ? cards : cards?.cards || [];
      // Brief cards carry no prices: load full data for up to 60 to rank by price.
      const full = await Promise.all(cards.slice(0, 60).map((c) => (c.prices?.usd != null ? c : T.ensureCard(g, c.id, false, false).catch(() => c))));
      const priced = full.filter((c) => c?.prices?.usd != null).sort((a, b) => b.prices.usd - a.prices.usd);
      return { game: g, set: { code: s.id, name: s.name, date: s.date, cards: s.count }, cards: priced.slice(0, n).map((c) => tcgCard(g, c)), unpricedChecked: full.length - priced.length, checked: full.length };
    },
    async meta_decks({ game, format }) {
      const g = g0(game);
      if (g === 'mtg') {
        const k = metaKey(format), data = await x.loadMetaData(k).catch(() => x.metaState(k).data);
        if (!data) return { error: 'Tournament data for that format isn\'t available right now.' };
        const owned = (d) => { const rows = [...(d.commanders || []).map((r) => (typeof r === 'string' ? { name: r, qty: 1 } : r)), ...(d.main || [])].filter((r) => !BASICS.test(r.name)); const total = rows.reduce((s, r) => s + r.qty, 0), have = rows.reduce((s, r) => s + Math.min(r.qty, x.inv(r.name).owned || 0), 0); return total ? Math.round((have / total) * 100) : 0; };
        return decorateMeta(g, data, { game: g, format: k.slice(4), source: data.source || 'tournament results', decks: (data.archetypes || []).slice(0, 8).map((a) => { const d = data.decks.find((y) => y.key === a.best) || data.decks.find((y) => (y.archetype || y.name) === a.name); return { name: a.name, key: d?.key || '', share: Math.round((a.share || 0) * 1000) / 10, lists: a.lists || a.count || 0, best: d ? `${d.place || ''} ${d.event || ''}`.trim() : '', ownedPercent: d ? owned(d) : 0, keyCards: d ? (d.main || []).filter((r) => !BASICS.test(r.name)).sort((p, q) => q.qty - p.qty).slice(0, 6).map((r) => r.name) : [] }; }) });
      }
      const data = (await x.tcgCtx.loadMeta?.(g).catch(() => null)) || T.metaState(g).data;
      if (!data) return { error: 'Tournament data isn\'t available right now.' };
      return decorateMeta(g, data, { game: g, source: data.source || 'tournament results', decks: (data.archetypes || []).slice(0, 8).map((a) => { const d = data.decks.find((y) => y.key === a.best); const o = d ? T.metaOwned(g, d) : null; return { name: a.name || a.id, key: d?.key || '', share: Math.round((a.share || 0) * 1000) / 10, lists: a.count || 0, best: d ? `${d.place || ''} ${d.event || ''}`.trim() : '', ownedPercent: o ? Math.round(o.pct * 100) : 0, costToFinish: o?.cost != null ? num(o.cost) : null }; }) });
    },
    async my_decks({ game }) {
      const g = g0(game);
      if (g === 'mtg') return { game: g, decks: S.state.decks.slice(0, 15).map((d) => { let power = null; try { power = x.shownPower(x.mtgPower(d)); } catch {} return { id: d.id, name: d.name, format: d.format, commander: d.commander || '', cards: d.cards.reduce((s, r) => s + r.qty, 0), power }; }) };
      return { game: g, decks: T.gs(g).decks.slice(0, 15).map((d) => ({ id: d.id, name: d.name, format: d.format, cards: (d.zones?.main || []).reduce((s, r) => s + r.qty, 0), power: T.deckPowerScore?.(g, d) ?? null })) };
    },
    async build_deck({ game, style, budget, format }) {
      const g = g0(game), want = clip(style, 80), $ = Math.max(0, Math.min(10000, Number(budget) || 0));
      if (g === 'mtg') {
        const fmt = clip(format, 30) || 'Commander', commander = /commander|edh/i.test(fmt);
        const colors = { white: 'w', blue: 'u', black: 'b', red: 'r', green: 'g', mono: '' }, cs = Object.entries(colors).filter(([k]) => new RegExp('\\b' + k).test(want.toLowerCase())).map(([, v]) => v).join('');
        const q = commander ? `is:commander ${cs ? `id=${cs}` : ''} ${cs ? '' : want}` : `${cs ? `c=${cs}` : ''} ${cs ? '' : want} f:${fmt.toLowerCase()} (t:creature or t:planeswalker)`;
        const seed = (await mtgSearch(q.replace(/\s+/g, ' ').trim(), 1))[0] || (await mtgSearch(want, 1))[0];
        if (!seed) return { error: `No ${fmt} build-around card found for "${want}".` };
        x.pending = () => x.openMtgBuild(seed.name, fmt, $); x.pendingGame = g;
        return { game: g, ready: true, seed: seed.name, format: fmt, budget: $ || 'no limit', note: 'The builder opens when the player taps it, and builds legal lists at budget tiers from that card.' };
      }
      const src = T.SOURCES[g];
      let r = g === 'ptcg' && /^(fire|water|grass|lightning|psychic|fighting|darkness|metal|dragon|colorless|fairy)\b/i.test(want) ? await src.search({ q: '', type: want.split(/\s/)[0][0].toUpperCase() + want.split(/\s/)[0].slice(1).toLowerCase(), category: 'Pokemon', format: 'standard', page: 0, size: 12 }).catch(() => null) : null;
      if (!r?.cards?.length) r = await src.search({ q: want, page: 0, size: 12 }).catch(() => ({ cards: [] }));
      const pick = (r.cards || []).find((c) => /ex|VSTAR|VMAX|Stage 2/i.test(`${c.name} ${c.stage || ''}`)) || r.cards?.[0];
      if (!pick) return { error: `No ${g === 'ygo' ? 'Yu-Gi-Oh!' : 'Pokémon'} card found for "${want}".` };
      x.pending = () => x.openTcgBuild(g, pick.id, $); x.pendingGame = g;
      return { game: g, ready: true, seed: pick.name, budget: $ || 'no limit', note: 'The builder opens when the player taps it, and builds legal lists at budget tiers around that card.' };
    },
  };
  // A builder prepared during this question appears as one more tappable item.
  tools.reset = () => { x.pending = null; suggestions = []; };
  tools.suggestedItems = () => suggestions;
  tools.canonicalItem = s => s.kind === 'meta' ? suggestions.find(x=>x.game===s.game && (x.ref===s.ref || x.label===s.ref || x.label===s.label)) || s : s;
  tools.pendingItem = () => { if (!x.pending) return null; const ref = 'builder-' + (++buildId); builders.set(ref,x.pending); return {kind:'build',game:x.pendingGame,ref,label:'Open the deck builder'}; };
  // What a tapped answer item opens, in the right game.
  tools.open = async (s) => {
    if (s.game !== T.game()) await x.A.setGame({ dataset: { game: s.game } });
    if (s.kind === 'build') return builders.get(s.ref)?.();
    if (s.kind === 'deck') return x.go((s.game === 'mtg' ? '#deck/' : '#tdeck/') + encodeURIComponent(s.ref));
    if (s.kind === 'set') {
      if (s.game === 'mtg') { const st = (await mtgSets()).find((y) => y.code.toLowerCase() === s.ref.toLowerCase() || y.name.toLowerCase() === s.ref.toLowerCase()); return x.go('#set/' + (st?.code || s.ref).toLowerCase()); }
      const st = (await tcgSets(s.game)).find((y) => String(y.id) === s.ref || y.name.toLowerCase() === s.ref.toLowerCase()); return x.go('#set/' + encodeURIComponent(st?.id || s.ref));
    }
    if (s.kind === 'meta') {
      const data = s.game === 'mtg' ? Object.values(x.allMeta?.() || {}) : [T.metaState(s.game).data];
      const deck = data.flatMap((d) => d?.decks || []).find((d) => d.key === s.ref) || data.flatMap((d) => (d?.archetypes || []).map((a) => ({ a, d }))).filter(({ a }) => (a.name || a.id) === s.ref).map(({ a, d }) => d.decks.find((y) => y.key === a.best))[0];
      if (!deck) return x.go('#decks/inspiration');
      return s.game === 'mtg' ? x.A.mtgProven({ dataset: { key: deck.key } }) : x.A.tMetaDeck({ dataset: { key: deck.key } });
    }
    if (s.game === 'mtg') return x.A.card({ dataset: { name: s.ref } });
    const id = T.cardOf(s.game, s.ref) ? s.ref : (await T.SOURCES[s.game].byName(s.ref).catch(() => null))?.id;
    return id ? x.A.tCard({ dataset: { id: String(id) } }) : x.go('#search');
  };
  // Answer items as small cards: art from the app's card data when it has it.
  tools.preview = (s, i) => {
    let img = '', price = null, card = null;
    const deck = s.kind === 'meta' || s.kind === 'deck', visual = visuals.get(visualKey(s));
    if (s.kind === 'card') {
      if (s.game === 'mtg') { card = x.meta(s.ref); img = mtgImg(card); price = card ? x.priceOf(card.name) : null; }
      else { card = T.cardOf(s.game, s.ref) || Object.values(T.cache?.[s.game] || {}).find(c=>c.name===s.ref); img = card?.imageLarge || card?.image || ''; price = card?.prices?.usd ?? null; }
    } else if (deck) {
      img = visual?.image || '';
      card = visual?.card;
      if (!img && s.kind === 'deck') {
        const d=(s.game==='mtg'?S.state.decks:T.gs(s.game).decks).find(d=>d.id===s.ref);
        card=s.game==='mtg'?x.meta(d?.commander || d?.cards?.[0]?.name):T.cardOf(s.game,d?.zones?.main?.[0]?.cardId);
        img=s.game==='mtg'?(card?.image_uris?.art_crop || mtgImg(card)):(card?.art || card?.imageLarge || card?.image || '');
      }
    }
    const kind = { card:'Card', set:'Set', meta:'Meta deck', deck:'Your deck', build:'Deck builder' }[s.kind] || '';
    const media = img ? (deck && s.game==='ptcg' && !visual?.sprite ? pokemonArtCrop(card,'ask-deck-art',img) : `<img class="${deck?'ask-deck-art':''}" src="${x.esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">`) : deck ? '<span class="ask-deck-art img-missing" aria-hidden="true">◇</span>' : '';
    return `<button class="ask-item ${deck?'ask-deck':img?'':'wide'}" style="--i:${i}" data-ask-show='${x.esc(JSON.stringify(s))}'>${media}<b>${x.esc(s.label || s.ref)}</b><small>${kind}${visual?.share!=null?' · '+Number(visual.share).toFixed(1)+'% of the field':''}</small>${price!=null?`<em>$${Number(price).toFixed(2)}</em>`:''}</button>`;
  };
  return tools;
}
