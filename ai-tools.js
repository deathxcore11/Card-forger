import {findInfo,INFO_TOPICS} from './app-info.js';
import {FORMATS} from './formats.js';
import {prepareMtgDeck} from './ai-deck-builder.js';
import {cardPrice,cardKey} from './core.js';
import {validateBuildProposal,proposalFeedback} from './ai-build-contract.js';
import {goalDescription} from './ai-deck-goal.js';
import {resolveYgoSet} from './ygo.js';
import { pokemonArtCrop, artworkHTML } from './artwork.js';
import { manaCost } from './ui.js';
import { tierOf, tierStyle } from './tier.js';
import { ptcgIcon } from './meta.js';
import { brandMark } from './brand.js';
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
// A deck request that only describes a vibe ("fun", "something spicy", "a random casual deck") names no card.
const VAGUE_WORDS = new Set('a an any anything something some me my fun funny cool good great strong fast random casual silly wacky creative unique interesting janky spicy wild crazy chill fresh new nice neat sweet different surprise surprising cheap budget easy simple beginner kid friendly kids competitive meta powerful aggressive deck decks build list one please for to play with'.split(' '));
export const vagueDeckStyle = (want) => String(want || '').toLowerCase().split(/[^a-z]+/).filter(Boolean).every(w => VAGUE_WORDS.has(w));
const tcgSet = (c) => c?.setContext?.name || c?.set?.name || c?.setName || c?.sets?.[0]?.name || c?.sets?.[0]?.set || '';

// Main-list requirements, including basic resources. Unknown quotes are not zero.
export function completionSummary(rows,owned,unit){
 const counts=new Map();for(const r of rows||[]){const name=String(r.name||r.id||'');if(!name)continue;const key=name.toLowerCase();const old=counts.get(key)||{name,qty:0};old.qty+=Math.max(0,Number(r.qty)||0);counts.set(key,old);}
 let total=0,have=0,cost=0,pricedMissing=0,unpricedMissing=0;const missing=[];
 for(const r of counts.values()){const n=Math.min(r.qty,Math.max(0,owned(r.name)||0)),need=r.qty-n,p=num(unit(r.name));total+=r.qty;have+=n;if(need){if(p==null)unpricedMissing+=need;else{cost+=p*need;pricedMissing+=need;}missing.push({name:r.name,qty:need,each:p});}}
 return {totalCopies:total,ownedCopies:have,missingCopies:total-have,ownedPercent:total?Math.round(have/total*100):0,costToFinish:unpricedMissing?null:num(cost),pricedMissingSubtotal:num(cost),pricedMissingCopies:pricedMissing,unpricedMissingCopies:unpricedMissing,missing:missing.slice(0,8),allocation:'Compared independently per deck; copies are not reserved.',costBasis:'Available reference quotes; excludes shipping. Review legality before saving.'};
}

export function makeAskTools(x) {
  const { S, T } = x;
  let lastSharedBuild=null;
  const metaTargets = new Map();
  const visuals = new Map(), exactCards = new Map(), exactAliases = new Map();
  let exactCardSequence = 0;
  function exactCardResult(game,card,releaseId,result) {
    const ref='set-card-'+(++exactCardSequence),record={game,card,releaseId,ref};
    exactCards.set(ref,record);
    while(exactCards.size>500)exactCards.delete(exactCards.keys().next().value);
    for(const alias of [String(card.id),card.name]) {
      const key=game+':'+alias,existing=exactAliases.get(key)||[];
      exactAliases.set(key,[...existing.filter(r=>r.releaseId!==releaseId),record]);
    }
    return {...result,ref};
  }
  function exactCardFor(item) {
    const direct=exactCards.get(item.ref);
    if(direct)return direct.game===item.game?direct:null;
    const matches=exactAliases.get(item.game+':'+item.ref)||[];
    return matches.length===1?matches[0]:null;
  }
  let suggestions = [], buildId = 0, buildEpoch = 0;
  const builders = new Map();
  let buildReads=new Map(),buildReadVersion=null,bestBuild=null;
  const stateVersion = g => {const st=g==='mtg'?S.state:T.gs?.(g)||S.state;return JSON.stringify([st?.collection||[],st?.decks||[]]);};
  const cachedBuildRead = (key,fn) => {
    if(!buildReads.has(key))buildReads.set(key,Promise.resolve().then(fn));
    return buildReads.get(key).then(value=>value===undefined?value:structuredClone(value));
  };
  const buildRank = d => [d.legalChecked?1:0,d.withinBudget?1:0,d.complete?1:0,d.total||0,-(d.unpricedCopies||0)];
  const noWorse = (a,b) => {const aa=buildRank(a),bb=buildRank(b);for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return aa[i]>bb[i];return true;};
  const visualKey = s => [s.game,s.kind,s.ref].join(':');
  async function deckVisual(g, d, item, share = null) {
    if (!d) return;
    const rows = d.list || d.main || d.cards || d.zones?.main || [];
    let card = null, image = '';
    try {
      if (g === 'ygo' && d.cover) image = `img/ygo/a/${encodeURIComponent(d.cover)}.jpg`;
      else if (g === 'mtg') {
        const leads=[...(d.commanders||[]).map(c=>typeof c==='string'?c:c.name),...String(d.commander||'').split(/\s+\/\s+/),...rows.filter(r=>!BASICS.test(r.name)).map(r=>r.name)].filter(Boolean);
        for(const lead of [...new Set(leads)].slice(0,3)){
          card=x.meta(lead)||await x.resolve?.(lead).catch(()=>null);
          image=card?.image_uris?.art_crop||card?.card_faces?.[0]?.image_uris?.art_crop||mtgImg(card);
          if(image)break;
        }
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
      if (d) {metaTargets.set(visualKey(item),{deck:d,data,format:result.format});return deckVisual(g,d,item,result.decks[i].share);}
      const a=(data.archetypes || []).find(a=>(a.name || a.id)===item.label);
      const icon=a?.icons?.[0];
      visuals.set(visualKey(item), { image:g==='ptcg' && icon?ptcgIcon(icon):'', sprite:!!icon, share:result.decks[i].share, label:item.label });
    }));
    return result;
  }
  const g0 = (g) => (GAMES.includes(g) ? g : T.game());
  const mtgCard = (c) => ({ name: c.name, type: clip(c.type_line, 80), cost: c.mana_cost || '', set: c.set_name, setCode: c.set, rarity: c.rarity, price: num(x.priceOf(c.name)), owned: x.inv(c.name).owned || 0 });
  const mtgSetCard = c => ({...mtgCard(c),price:num(cardPrice(c)),owned:(S.state.collection || []).filter(e=>e.printingVerified && e.printingId===c.id).reduce((n,e)=>n+Math.max(0,Number(e.qty)||0),0)});
  const tcgCard = (g, c) => ({ id: String(c.id), name: c.name, type: clip(c.typeLine || c.type || c.category, 80), set: tcgSet(c), rarity: c.rarity || '', price: num(c.setContext ? c.setContext.price : c.prices?.usd), owned: c.setContext ? T.setCardOwnedCount(g,c,c.setContext.releaseId) : T.ownedMap(g).get(T.SOURCES[g].ownKey(c)) || 0 });
  async function mtgSearch(q, limit) {
    const run = (query) => x.api('/cards/search?' + new URLSearchParams({ q: query + ' game:paper', order: 'edhrec' })).catch(() => null);
    const d = (await run(q)) || (await run(`o:"${q.replace(/"/g, '')}"`));
    return (d?.data || []).slice(0, limit).map((c) => mtgCard(x.cacheCard(c)));
  }
  async function mtgSets() { if (!S.ui.sets?.list?.length) await x.loadSetIndex().catch(() => {}); return (S.ui.sets?.list || []).filter((s) => !s.digital); }
  async function tcgSets(g) { if (!T.ui(g).sets?.list?.length) await x.tcgCtx.loadSets?.(g).catch(() => {}); return T.ui(g).sets?.list || []; }
  const metaKey = (format) => { const f = String(format || S.ui.mtgMeta?.format || 'Modern'); return 'mtg:' + (/commander|edh|cedh/i.test(f) ? 'EDH' : x.MTG_META_FORMATS.find(([k]) => k.toLowerCase() === f.toLowerCase())?.[0] || 'Modern'); };

  const tools = {
    async app_help({query}) { return {topics:findInfo(clip(query,160)).slice(0,4).map(t=>({ref:t.id,title:t.title,summary:t.summary,details:t.details,demonstration:t.lesson||null,action:t.action})),note:'Read-only help. Open a returned topic for instructions or a sample demonstration; opening it does not change saved cards.'}; },
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
        let rows = st.collection.map((e, i) => ({ e, i, each: x.lotPrice(e, S.catalog, st.printings), value: x.lotPrice(e, S.catalog, st.printings)==null?null:x.lotPrice(e, S.catalog, st.printings)*e.qty }));
        rows.sort(sort === 'quantity' ? (a, b) => b.e.qty - a.e.qty : sort === 'recent' ? (a, b) => b.i - a.i : (a, b) => b.value - a.value);
        return { game: g, totalValue: num(v.total), copies: v.copies, unpriced: v.unpriced, cards: rows.slice(0, n).map(({ e, value, each }) => ({ name: e.name, qty: e.qty, condition:e.condition, set: e.setName || e.set || '', value: num(value), each:num(each) })) };
      }
      const col = T.gs(g).collection, v = T.collectionValue(g);
      let rows = col.map((e, i) => { const c = T.cardOf(g, e.cardId), each = c ? T.entryPrice(c, e) : null; return { e, i, c, each: num(each), value: each==null?null:num(each * e.qty) }; });
      rows.sort(sort === 'quantity' ? (a, b) => b.e.qty - a.e.qty : sort === 'recent' ? (a, b) => b.i - a.i : (a, b) => (b.value || 0) - (a.value || 0));
      return { game: g, totalValue: num(v.total), copies: v.copies, unpriced: v.unpriced, cards: rows.slice(0, n).map((r) => ({ id: String(r.e.cardId), name: r.e.name, qty: r.e.qty, condition:r.e.condition, set: r.e.printing || (r.e.setReleaseUnverified ? 'Printing not verified' : tcgSet(r.c)), each: r.each, value: r.value })) };
    },
    async list_sets({ game, query, order, limit }) {
      const g = g0(game), n = lim(limit, 10, 30), q = clip(query, 60).toLowerCase();
      // Real card sets only (no token, promo or art-series sets), each marked released or upcoming.
      const today = new Date().toISOString().slice(0, 10), skip = /^(token|memorabilia|minigame|promo|art_series|alchemy|treasure_chest|vanguard)$/;
      let sets = g === 'mtg' ? (await mtgSets()).filter((s) => !skip.test(s.set_type || '') || q).map((s) => ({ code: s.code, name: s.name, date: s.released_at, cards: s.card_count, type: s.set_type })) : (await tcgSets(g)).map((s) => ({ id: s.id, code: s.code || s.id, name: s.name, date: s.date || '', cards: s.count, series: s.series }));
      sets = sets.map((s) => ({ ...s, status: s.date && s.date > today ? 'upcoming' : 'released' }));
      if (q) sets = sets.filter((s) => s.name.toLowerCase().includes(q) || String(s.code).toLowerCase() === q);
      if (order !== 'largest') sets = sets.filter((s) => s.date);
      sets.sort(order === 'oldest' ? (a, b) => a.date.localeCompare(b.date) : order === 'largest' ? (a, b) => (b.cards || 0) - (a.cards || 0) : (a, b) => b.date.localeCompare(a.date));
      const latest = [...sets].filter((s) => s.status === 'released').sort((a, b) => b.date.localeCompare(a.date))[0] || null, upcoming = sets.filter((s) => s.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
      return { game: g, today, latestReleased: latest, upcoming, sets: sets.slice(0, n) };
    },
    async set_cards({ game, set, limit }) {
      const g = g0(game), n = lim(limit, 8, 20);
      // Canonical release IDs are case-sensitive and can exceed 80 characters. Reject
      // oversized/malformed input rather than silently turning it into another release.
      if(typeof set !== 'string' || !set.trim() || set.length > 4096 || /[\u0000-\u001f\u007f]/.test(set))return {error:'Choose a set name, code or full release ID (up to 4096 characters).'};
      const query = set.normalize('NFC').trim(), q = query.toLowerCase();
      const sets = g === 'mtg' ? await mtgSets() : await tcgSets(g);
      const choice = s => ({id:s.id || s.code,code:s.code || s.id,name:s.name,date:s.date || s.released_at || ''});
      let candidates;
      if(g === 'ygo') candidates = resolveYgoSet(sets,query).candidates;
      else {
        candidates=sets.filter(s=>String(s.id || s.code)===query);
        if(!candidates.length)candidates=sets.filter(s=>String(s.code || s.id).toLowerCase()===q || s.name.toLowerCase()===q);
      }
      if(!candidates.length) {
        const matches=sets.filter(s=>s.name.toLowerCase().includes(q));
        return {game:g,error:matches.length?'Choose an exact release from these matches.':`No set matching ${query}.`,requiresChoice:!!matches.length,candidates:matches.slice(0,30).map(choice)};
      }
      if(candidates.length!==1)return {game:g,error:'That name or code identifies more than one release. Choose a full release ID.',requiresChoice:true,candidates:candidates.slice(0,30).map(choice)};
      const s = candidates[0];
      if (g === 'mtg') {
        const d = await x.api('/cards/search?' + new URLSearchParams({ q: `set:${s.code} game:paper`, order: 'usd', dir: 'desc' })).catch(() => null);
        return { game: g, set: { code: s.code, name: s.name, date: s.released_at }, cards: (d?.data || []).slice(0, n).map(c => exactCardResult(g,c,s.code,mtgSetCard(c))) };
      }
      let cards = await T.SOURCES[g].setCards(s).catch(() => []);
      cards = Array.isArray(cards) ? cards : cards?.cards || [];
      const unique = [...new Map(cards.filter(c=>c?.id).map(c=>[String(c.id),c])).values()];
      const full = await Promise.all(unique.slice(0, 60).map(async c => {
        const loaded = c.prices?.usd != null && !c.brief ? c : await T.ensureCard(g, c.id, false, false).catch(() => c);
        return T.setContextCard(g, {...loaded,setContext:c.setContext}, s, sets);
      }));
      const priced = full.filter(c=>c.setContext?.price != null).sort((a,b)=>b.setContext.price-a.setContext.price);
      const unpriced = full.filter(c=>c.setContext?.price == null);
      return { game: g, set: { ...choice(s), cards: s.count }, cards: [...priced,...unpriced].slice(0,n).map(c=>exactCardResult(g,c,s.id,tcgCard(g,c))), unpricedChecked: unpriced.length, checked: full.length };
    },
    async meta_decks({ game, format }) {
      const g = g0(game);
      if (g === 'mtg') {
        const k = metaKey(format), data = await x.loadMetaData(k).catch(() => x.metaState(k).data);
        if (!data) return { error: 'Tournament data for that format isn\'t available right now.' };
        const summary=d=>completionSummary([...(d.commanders||[]).map(r=>typeof r==='string'?{name:r,qty:1}:r),...(d.main||[])],n=>x.inv(n).owned,n=>x.priceOf(n));
        return decorateMeta(g,data,{game:g,format:k.slice(4),source:data.source||'tournament results',fetchedAt:data.fetchedAt||data.updatedAt||null,decks:(data.archetypes||[]).slice(0,8).map(a=>{const d=data.decks.find(y=>y.key===a.best)||data.decks.find(y=>(y.archetype||y.name)===a.name);return {name:a.name,key:d?.key||'',share:Math.round((a.share||0)*1000)/10,lists:a.lists||a.count||0,best:d?`${d.place||''} ${d.event||''}`.trim():'',eventDate:d?.date||null,...(d?summary(d):{listUnavailable:true,ownedPercent:null,costToFinish:null})};})});
      }
      const data = (await x.tcgCtx.loadMeta?.(g).catch(() => null)) || T.metaState(g).data;
      if (!data) return { error: 'Tournament data isn\'t available right now.' };
      const own=T.ownedMap(g),byName=new Map();for(const e of T.gs(g).collection)byName.set(e.name.toLowerCase().replace(/^basic /,''),(byName.get(e.name.toLowerCase().replace(/^basic /,''))||0)+e.qty);
      const summary=d=>g==='ygo'?completionSummary([...(d.main||[]),...(d.extra||[])].map(id=>({name:String(id),qty:1})),id=>own.get('id:'+id),id=>T.cardOf(g,id)?.prices?.usd):completionSummary(d.list,n=>byName.get(n.toLowerCase().replace(/^basic /,'')),n=>Object.values(T.cache?.[g]||{}).find(c=>c.name.toLowerCase()===n.toLowerCase())?.prices?.usd);
      const metaFormat=g==='ptcg'?'Standard':'Advanced (TCG)';
      if(format&&!(g==='ptcg'?/^standard$/i:/^(tcg|advanced(?: \(tcg\))?)$/i).test(format))return {game:g,error:'This tournament source covers '+metaFormat+'. Choose that format or use the builder for other formats.',format:metaFormat};
      return decorateMeta(g,data,{game:g,format:metaFormat,source:data.source||'tournament results',fetchedAt:data.fetchedAt||data.updatedAt||null,decks:(data.archetypes||[]).slice(0,8).map(a=>{const d=data.decks.find(y=>y.key===a.best)||a.representative;return {name:a.name||a.id,key:d?.key||'',share:Math.round((a.share||0)*1000)/10,lists:a.count||0,best:d?`${d.place||''} ${d.event||''}`.trim():'',eventDate:d?.date||null,...(d?summary(d):{listUnavailable:true,ownedPercent:null,costToFinish:null})};})});
    },
    async my_decks({ game }) {
      const g = g0(game);
      if (g === 'mtg') return { game: g, decks: S.state.decks.slice(0, 15).map((d) => { let power = null; try { power = x.shownPower(x.mtgPower(d)); } catch {} return { id: d.id, name: d.name, format: d.format, commander: d.commander || '', cards: d.cards.reduce((s, r) => s + r.qty, 0), power }; }) };
      return { game: g, decks: T.gs(g).decks.slice(0, 15).map((d) => ({ id: d.id, name: d.name, format: d.format, cards: (d.zones?.main || []).reduce((s, r) => s + r.qty, 0), power: T.deckPowerScore?.(g, d) ?? null })) };
    },
    async build_deck(input, handshake={}) {
      const checked=validateBuildProposal(input);
      if(!checked.ok)return proposalFeedback(checked,{terminal:true});
      const { game, style, budget, format, seed, commander, budget_basis,goal,required_cards,excluded_cards,colors,avoid_infinite,candidate_cards }=checked.args;
      const g = g0(game), want = clip(style, 120), $ = budget;
      const epoch=buildEpoch, origin=x.navigationStamp?.(), identityCurrent=x.captureAskScope?.()||(()=>true),version=stateVersion(g);
      const scopeCurrent=()=>identityCurrent()&&stateVersion(g)===version;
      const preparingCurrent=()=>epoch===buildEpoch && scopeCurrent() && handshake.current?.()!==false && !handshake.signal?.aborted && (!origin || x.navigationCurrent?.(origin)!==false);
      if(buildReadVersion!==version || !handshake.revision){buildReads=new Map();bestBuild=null;buildReadVersion=version;}
      const formats=g==='mtg'?FORMATS.map(f=>({id:f.name,name:f.name})):T.SOURCES[g].formats;
      const selected=formats.find(f=>[f.id,f.name].some(n=>n.toLowerCase()===String(format||'').toLowerCase()));
      if(!selected)return {game:g,requiresChoice:true,formats:formats.map(f=>({id:f.id,name:f.name})),note:'Choose a format before preparing a deck. No deck has been changed.'};
      if(x.deckExperience){
        const previous=lastSharedBuild?.current()&&/^\s*(?:keep|same|make (?:it|that)|adjust|change|closer|cheaper|easier|simpler)/i.test(handshake.userRequest||'')&&lastSharedBuild.result.request.game===g&&lastSharedBuild.result.request.format===selected.id?lastSharedBuild.result:null;
        const result=await x.deckExperience.build({...checked.args,previousDeck:previous?.deck,seed:seed||previous?.request.seed,seedCard:seed&&seed!==previous?.request.seed?null:previous?.request.seedCard,game:g,format:selected.id,budget:budget===0?null:budget,theme:previous&&/^(?:easy|easier|simple|simpler|beginner|cheaper|closer|easy to play)(?: deck)?$/i.test(want.trim())?previous.request.theme:g==='mtg'?want:g==='ptcg'?(['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Dragon','Colorless'].find(t=>new RegExp('\\b'+t+'\\b','i').test(want))||''):(!seed&&!vagueDeckStyle(want)?want:''),easy:/easy|easier|beginner|simple|simpler/i.test(style||'')},{current:preparingCurrent});
        if(!preparingCurrent())return {cancelled:true,terminal:true,note:'This request or workspace changed. Nothing was saved.'};
        if(!result.ok)return {game:g,terminal:true,complete:false,note:result.message,issues:result.details||[]};
        lastSharedBuild={result,current:scopeCurrent};
        const resultId=x.deckExperience.register(result,scopeCurrent);
        x.pending=()=>{};x.pending.current=scopeCurrent;x.pendingGame=g;x.pending.resultId=resultId;
        return {game:g,terminal:true,ready:true,complete:true,reviewAvailable:true,format:result.request.formatName,seed:result.request.seedCard?.name||result.deck.buildAround,budget:result.request.budget,budgetBasis:result.pricing.basis,estimate:result.pricing.estimate,knownSubtotal:result.pricing.subtotal,unpricedCopies:result.pricing.unpriced,budgetStatus:result.budgetStatus,delta:result.delta,cards:result.rows.map(r=>({name:r.name,qty:r.qty,zone:r.zone})),note:'One complete list is shown in this conversation. Save is available here; nothing was saved automatically. Power is a heuristic, not a win rate.'};
      }
      if (g === 'mtg') {
        const buildContext={...x,api:(...a)=>cachedBuildRead('api:'+JSON.stringify(a),()=>x.api(...a)),resolve:(...a)=>cachedBuildRead('resolve:'+JSON.stringify(a),()=>x.resolve(...a))};
        const built = await prepareMtgDeck({ style:want, budget:$, format:selected.name, seed, commander, budget_basis,goal,required_cards,excluded_cards,colors,avoid_infinite,candidate_cards,allowUnverifiedInfinite:handshake.allowUnverifiedInfinite===true,current:preparingCurrent },buildContext);
        if (!preparingCurrent()){if(epoch===buildEpoch)x.pending=null;return {cancelled:true,terminal:true,note:'This question, workspace, or deck/collection version changed. Nothing was saved.'};}
        if (!built.draft) return {game:g,...built,terminal:true};
        if(!bestBuild || noWorse(built.draft,bestBuild.draft))bestBuild=structuredClone(built);
        const draft = structuredClone(bestBuild.draft),result=bestBuild.result;
        const validation={authority:'app',status:result.ready?'ready':'needs_review',issues:(draft.issues||[]).slice(0,12),goal,goalVerified:false,
          budget:{basis:budget_basis,limit:draft.budget===Infinity?'no limit':draft.budget,withinBudget:!!draft.withinBudget,estimate:budget_basis==='total'?draft.totalEstimate:draft.purchaseEstimate,unpricedCopies:budget_basis==='total'?draft.unpricedCopies:draft.unpricedPurchaseCopies}};
        const mayCorrect=handshake.allowCorrection===true&&!result.ready&&!result.unverifiedConstraints?.length;
        const correction=mayCorrect?{candidateLimit:6,remaining:1,feedback:[...(draft.issues||[]).map(i=>i.text),...(draft.warnings||[])].slice(0,10),
          expensiveOrUnpricedCards:[...draft.cards].sort((a,b)=>{const pa=draft.referencePrices?.[cardKey(a.name)],pb=draft.referencePrices?.[cardKey(b.name)];return (pb==null?Infinity:pb*b.qty)-(pa==null?Infinity:pa*a.qty);}).slice(0,8).map(r=>({name:r.name,qty:r.qty,each:draft.referencePrices?.[cardKey(r.name)]??null})),
          instruction:'Suggest up to six exact candidate_cards once. Preserve every other request field. App checks decide what fits; unknown prices are not free.'}:null;
        draft.validation=validation;draft.goal=goal;draft.goalVerified=false;
        if (x.openMtgDraft) {
          x.pending = () => { if(!scopeCurrent()){x.toast?.('Your workspace, decks, or collection changed. Ask again before reviewing this draft.');return;} return x.openMtgDraft(structuredClone(draft),scopeCurrent); };
          x.pending.current=scopeCurrent; x.pendingGame=g;
          const cover=x.meta?.(draft.commander||draft.buildAround);
          x.pending.visual={card:cover,image:cover?.image_uris?.art_crop||cover?.card_faces?.[0]?.image_uris?.art_crop||mtgImg(cover),name:draft.commander||draft.buildAround,format:draft.format,summary:`${draft.total}/${result.target} cards · ${draft.lands} lands`,status:result.ready?'Checked draft':'Needs review',ready:result.ready,estimate:draft.totalEstimate};
        }
        return {...result,goal,goalVerified:false,goalDescription:goalDescription(goal),validation,correction,requiresCorrection:mayCorrect,reviewAvailable:!!x.openMtgDraft,terminal:!mayCorrect};
      }
      const src = T.SOURCES[g], required = clip(seed||required_cards[0],120);
      const extraRequirements=required_cards.filter(n=>cardKey(n)!==cardKey(required));
      // A named build-around is already the existing TCG builder's seed, and
      // fun/theme are reviewable preferences rather than unsupported hard rules.
      // Do not reject Charizard just because the model repeated it in required_cards.
      if(['chaos','weak'].includes(goal)||extraRequirements.length||excluded_cards.length||colors.length||avoid_infinite)return {game:g,requiresChoice:true,terminal:true,goal,note:'I can open this game’s existing builder around one main card or archetype. It cannot enforce extra card exclusions, multiple required cards, Magic color constraints, or a no-infinite-combos guarantee. Tell me which main card to keep and which restriction to revise. Nothing was saved.'};
      if(budget_basis==='owned')return {game:g,requiresChoice:true,note:'This builder handoff cannot guarantee an owned-only list. Choose a purchase budget, or use your saved deck to review the missing cards.'};
      if(commander)return {game:g,requiresChoice:true,note:'A commander is a Magic deck role. For this game, give the main card or archetype as the build-around instead.'};
      const canSeed=c=>!!c && (g!=='ptcg'||c.category==='Pokemon') && (!src.legality||src.legality(c,selected)!=='not_legal') && (!src.limit||src.limit(c,selected)>0);
      const hydrate=async c=>c?.id&&src.get?await src.get(c.id).catch(()=>null):c;
      let r = null;
      if(required){
        const exact=await src.byName?.(required).catch(()=>null);
        if(!preparingCurrent())return {cancelled:true,note:'This question was closed or replaced. Nothing was saved.'};
        r=canSeed(exact)?{cards:[exact],hydrated:true}:await src.search({q:required,exactName:true,category:g==='ptcg'?'Pokemon':'',format:selected.id,page:0,size:12}).catch(()=>({cards:[]}));
      } else {
        for(const name of candidate_cards.slice(0,3)){
          const card=await src.byName?.(name).catch(()=>null);
          if(!preparingCurrent())return {cancelled:true,note:'This question was closed or replaced. Nothing was saved.'};
          if(canSeed(card)&&cardKey(card.name)===cardKey(name)){r={cards:[card],hydrated:true};break;}
        }
        if(!r&&g==='ptcg' && /^(fire|water|grass|lightning|psychic|fighting|darkness|metal|dragon|colorless|fairy)\b/i.test(want))r=await src.search({q:'',type:want.split(/\s/)[0][0].toUpperCase()+want.split(/\s/)[0].slice(1).toLowerCase(),category:'Pokemon',format:selected.id,page:0,size:12}).catch(()=>null);
      }
      if (!preparingCurrent()) return {cancelled:true,note:'This question was closed or replaced. Nothing was saved.'};
      // A vibe with no card or archetype ("a fun deck", "something spicy") is not a card name: pick a
      // build-around the way Random deck does, a random archetype or a headline Pokémon legal in the format.
      if(!r?.cards?.length&&!required&&vagueDeckStyle(want)){
        const pool=g==='ygo'?((await src.randomArchetype?.().catch(()=>null))?.cards||[]).filter(c=>c.category==='Monster'&&!c.extra):((await src.search({category:'Pokemon',format:selected.id,size:100}).catch(()=>({cards:[]}))).cards||[]);
        for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
        r={cards:pool.slice(0,24),vague:true};
      }
      if (!preparingCurrent()) return {cancelled:true,note:'This question was closed or replaced. Nothing was saved.'};
      if (!r?.cards?.length && !required) r = await src.search({ q: want, format:selected.id, page: 0, size: 12 }).catch(() => ({ cards: [] }));
      if (!preparingCurrent()) return {cancelled:true,note:'This question was closed or replaced. Nothing was saved.'};
      const named=c=>clip(c?.name,120).toLowerCase()===required.toLowerCase();
      const candidates=(r?.cards||[]).filter(c=>!required||named(c));
      if(!required)candidates.sort((a,b)=>Number(/ex|VSTAR|VMAX|Stage 2/i.test(`${b.name} ${b.stage||''}`))-Number(/ex|VSTAR|VMAX|Stage 2/i.test(`${a.name} ${a.stage||''}`)));
      let pick=null;
      for(const candidate of candidates.slice(0,6)){
        const full=r.hydrated?candidate:await hydrate(candidate);
        if(!preparingCurrent())return {cancelled:true,note:'This question was closed or replaced. Nothing was saved.'};
        if(canSeed(full)&&(!required||named(full))){pick=full;break;}
      }
      if(required&&!pick)return {game:g,requiresChoice:true,note:`I could not verify a ${selected.name}-compatible printing of “${required}”. Which card or format should the builder use?`};
      if (!pick) return r?.vague?{game:g,requiresChoice:true,note:`I couldn’t find a ${selected.name}-legal build-around just now. Name a card, archetype or type you like and I’ll build around it.`}:{ error: `No ${g === 'ygo' ? 'Yu-Gi-Oh!' : 'Pokémon'} card found for "${want}".` };
      x.pending = () => {if(!scopeCurrent()){x.toast?.('Your workspace changed. Ask again in the current workspace.');return;}return x.openTcgBuild(g,pick.id,$,selected.id,scopeCurrent);}; x.pending.current=scopeCurrent; x.pendingGame=g;
      x.pending.visual={card:pick,image:pick.art||pick.imageLarge||pick.image||'',name:pick.name,format:selected.name,summary:'Generate and review the list',status:'Builder setup',ready:false,estimate:null};
      return { game:g, prepared:true, complete:false, terminal:true, reviewAvailable:true, actionLabel:'Open the deck builder', seed:pick.name, format:selected.name, goal,goalVerified:false,budget:$||'no limit', budgetBasis:'purchase', requestedBudgetBasis:budget_basis||'total', note:'The '+selected.name+' builder is prepared around '+pick.name+'. '+(goal!=='strongest'?'Your '+goal+' preference is for you to review; it is not a verified playability or strength rating. ':'')+'Its budget is purchases after owned cards, not a verified whole-deck total. Open it to generate and check the actual list and price coverage. No complete deck or under-budget result has been verified yet; nothing was saved.' };
    },
  };
  // Snapshot request ownership before a provider wait, not only when its reply
  // eventually starts a tool. Cross-game actions keep their own version ticket.
  tools.captureRequestScope = () => {
    const identity=x.captureAskScope?.()||(()=>true),versions=new Map(GAMES.map(g=>[g,stateVersion(g)]));
    return g=>identity()&&stateVersion(g)===versions.get(g);
  };
  // A builder prepared during this question appears as one more tappable item.
  tools.reset = ({forgetBuild=false}={}) => { if(forgetBuild)lastSharedBuild=null; buildEpoch++; x.pending = null; suggestions = []; exactAliases.clear(); buildReads.clear(); buildReadVersion=null; bestBuild=null; };
  tools.defaultBuildFormat=x.deckExperience?g=>({mtg:'Standard',ygo:'tcg',ptcg:'standard'}[g]):undefined;
  tools.buildFormats=()=>Object.fromEntries(GAMES.map(g=>[g,(g==='mtg'?FORMATS:T.SOURCES?.[g]?.formats||[]).map(f=>({id:f.id,name:f.name}))]));
  tools.cancel = () => { buildEpoch++; x.pending = null; buildReads.clear(); buildReadVersion=null; bestBuild=null; };
  tools.suggestedItems = () => suggestions;
  tools.canonicalItem = s => { const exact=s.kind==='card'?exactCardFor(s):null; return exact?{...s,ref:exact.ref,label:s.label||exact.card.name}:s.kind==='meta'?suggestions.find(x=>x.game===s.game&&(x.ref===s.ref||x.label===s.ref||x.label===s.label))||s:s; };
  tools.pendingItem = () => { if (!x.pending) return null; const ref = 'builder-' + (++buildId); builders.set(ref,x.pending); const item={kind:'build',game:x.pendingGame,ref,label:x.pending.resultId?'Your deck':x.pendingGame==='mtg'?'Review the deck draft':'Open the deck builder'};if(x.pending.visual)visuals.set(visualKey(item),structuredClone(x.pending.visual));return item; };
  // What a tapped answer item opens, in the right game.
  tools.open = async (s) => {
    s=tools.canonicalItem(s);
    if(s.kind==='help')return INFO_TOPICS.some(t=>t.id===s.ref)?x.A.helpOpen({dataset:{id:s.ref}}):undefined;
    if (s.kind==='build' && builders.get(s.ref)?.current?.()===false){x.toast?.('Your workspace changed. Ask again in the current workspace.');return;}
    if (s.game !== T.game() && await x.A.setGame({ dataset: { game: s.game } }) === false) return;
    const screen=x.navigationStamp?.(),current=()=>!screen || x.navigationCurrent?.(screen)!==false;
    if (s.kind === 'build') return builders.get(s.ref)?.();
    if (s.kind === 'deck') return x.go((s.game === 'mtg' ? '#deck/' : '#tdeck/') + encodeURIComponent(s.ref));
    if (s.kind === 'set') {
      if (s.game === 'mtg') { const rows=await mtgSets(),code=rows.find(y=>y.code.toLowerCase()===s.ref.toLowerCase()),names=rows.filter(y=>y.name.toLowerCase()===s.ref.toLowerCase()),st=code||(names.length===1?names[0]:null); return current() && x.go(st?'#set/'+encodeURIComponent(st.code):'#sets'); }
      const rows=await tcgSets(s.game),matches=s.game==='ygo'?resolveYgoSet(rows,s.ref).candidates:rows.filter(y=>String(y.id)===s.ref||y.name.toLowerCase()===s.ref.toLowerCase()); const st=matches.length===1?matches[0]:null; return current() && x.go(s.game!=='ygo'&&!st?'#sets':'#set/' + encodeURIComponent(st?.id || s.ref));
    }
    if (s.kind === 'meta') {
      const target=metaTargets.get(visualKey(s));
      const sources=s.game==='mtg'?Object.entries(x.allMeta?.()||{}).map(([key,data])=>({data,format:key.replace(/^mtg:/,'')})):[{data:T.metaState(s.game).data}];
      const found=target||sources.map(({data,format})=>({data,format,deck:data?.decks?.find(d=>d.key===s.ref)})).find(x=>x.deck);
      if(!found?.deck){x.toast?.('This deck is no longer available. Choose another list.');return x.go('#decks/inspiration');}
      if(!current())return;
      return s.game==='mtg'?x.A.mtgProven({dataset:{key:found.deck.key,format:found.format},metaSnapshot:found}):x.A.tMetaDeck({dataset:{key:found.deck.key}});
    }
    const exact=s.kind==='card'?exactCardFor(s):null;
    if(exact)return s.game==='mtg'?x.A.card({dataset:{name:exact.card.name},printing:exact.card}):x.A.tCard({dataset:{id:String(exact.card.id),setId:exact.releaseId},setMembership:exact.card.setContext});
    if(s.kind==='card' && (String(s.ref).startsWith('set-card-') || exactAliases.has(s.game+':'+s.ref)))return x.go('#sets');
    if (s.game === 'mtg') return x.A.card({ dataset: { name: s.ref } });
    const id = T.cardOf(s.game, s.ref) ? s.ref : (await T.SOURCES[s.game].byName(s.ref).catch(() => null))?.id;
    if(!current())return;
    return id ? x.A.tCard({ dataset: { id: String(id), game:s.game } }) : x.go('#search');
  };
  // Answer items as small cards: art from the app's card data when it has it.
  tools.preview = (s, i, {compact = false} = {}) => {
    s=tools.canonicalItem(s);
    let img = '', price = null, card = null;
    const deck = s.kind === 'meta' || s.kind === 'deck', visual = visuals.get(visualKey(s));
    if(s.kind==='build'&&builders.get(s.ref)?.resultId)return x.deckExperience.markup(builders.get(s.ref).resultId);
    if(s.kind==='build'&&visual){
      const art=visual.image?(s.game==='ptcg'?pokemonArtCrop(visual.card,'ask-build-image',visual.image):`<img src="${x.esc(visual.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('ask-art-unavailable')"><span class="ask-build-art-fallback">Artwork unavailable</span>`):'<span class="ask-build-no-art">Artwork unavailable</span>';
      const estimate=typeof visual.estimate==='number'&&Number.isFinite(visual.estimate)?`$${visual.estimate.toFixed(2)} reference estimate`:s.game==='mtg'?'Price estimate incomplete':'Review list and prices in the builder';
      return `<button type="button" class="ask-item ask-build" style="--i:${i}" aria-label="${x.esc(s.label+': '+visual.name)}" data-ask-show='${x.esc(JSON.stringify(s))}'><span class="ask-build-art">${art}<span class="ask-build-badges"><span class="ask-build-brand">${brandMark()}<span>AI draft</span></span><span class="ask-build-format">${x.esc(visual.format)}</span></span></span><span class="ask-build-body"><b class="ask-build-title">${x.esc(visual.name)}</b><small>${x.esc(visual.summary)}</small><span class="ask-build-status ${visual.ready?'ready':''}">${x.esc(visual.status)}</span><small>${x.esc(estimate)}</small><span class="ask-build-action">${x.esc(s.label)} <span aria-hidden="true">→</span></span></span></button>`;
    }
    if (s.kind === 'card') {
      const exact=exactCardFor(s),ambiguous=String(s.ref).startsWith('set-card-')||exactAliases.has(s.game+':'+s.ref);
      if(exact){card=exact.card;img=s.game==='mtg'?mtgImg(card):card.imageLarge||card.image||'';price=s.game==='mtg'?cardPrice(card):card.setContext?.price??null;}
      else if(ambiguous){price=null;}
      else if (s.game === 'mtg') { card = x.meta(s.ref); img = mtgImg(card); price = card ? x.priceOf(card.name) : null; }
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
    if (compact && s.kind === 'card') {
      const name = card?.name || s.label || s.ref;
      const set = s.game === 'mtg' ? card?.set?.toUpperCase() || card?.set_name : tcgSet(card);
      const number = s.game === 'mtg' ? card?.collector_number : card?.set?.number || card?.localId;
      const printing = [set, number ? '#'+number : ''].filter(Boolean).join(' · ');
      const quote = num(price), tier = tierOf(s.game,card?.rarity,quote);
      const art = card ? artworkHTML({...card,game:s.game},'ask-card-thumb') : '<span class="ask-card-thumb img-missing" aria-hidden="true">◇</span>';
      return `<button type="button" class="ask-item deck-compact-row ask-card-row" data-tier="${tier.key}" style="--i:${i};${tierStyle(tier)}" aria-label="${x.esc('Open '+name)}" data-ask-show='${x.esc(JSON.stringify(s))}'><span class="ask-card-row-art">${art}${quote!==null?`<span class="art-price">$${quote.toFixed(2)}</span>`:''}</span><span class="deck-compact-copy ask-card-copy"><b>${x.esc(name)}</b>${s.game==='mtg'&&card?manaCost(card):''}${printing?`<small>${x.esc(printing)}</small>`:''}${quote===null?'<small>Price unavailable</small>':''}</span><span class="ask-card-arrow" aria-hidden="true">›</span></button>`;
    }
    const kind = { card:'Card', set:'Set', meta:'Meta deck', deck:'Your deck', build:'Deck builder', help:'App guide' }[s.kind] || '';
    const media = img ? (deck && s.game==='ptcg' && !visual?.sprite ? pokemonArtCrop(card,'ask-deck-art',img) : `<img class="${deck?'ask-deck-art':''}" src="${x.esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('ask-art-unavailable')"><span class="ask-build-art-fallback">Artwork unavailable</span>`) : deck ? '<span class="ask-deck-art img-missing" aria-hidden="true">Artwork unavailable</span>' : '';
    return `<button class="ask-item ${deck?'ask-deck':img?'':'wide'}" style="--i:${i}" data-ask-show='${x.esc(JSON.stringify(s))}'>${media}<b>${x.esc(s.label || s.ref)}</b><small>${kind}${visual?.share!=null?' · '+Number(visual.share).toFixed(1)+'% of the field':''}</small>${price!=null?`<em>$${Number(price).toFixed(2)}</em>`:''}</button>`;
  };
  return tools;
}
