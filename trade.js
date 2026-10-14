// Fair trades for one card, from what you own and what you want (all three games).
// Offers: single cards worth about the same (within 15%), then two-card bundles that add up to
// about the same (within 10%). Asks: if you own the card, wishlist cards worth about the same.
import { esc } from "./ui.js";

const money = (v) => `$${Number(v).toFixed(2)}`;

export function tradeMatches({ target, owned = [], wish = [] }) {
  const p = Number(target?.price);
  if (!(p > 0)) return { price: null, singles: [], pairs: [], asks: [] };
  const mine = owned.filter((x) => x.price > 0 && x.key !== target.key && (x.qty || 1) > 0);
  const near = (v, tol) => Math.abs(v - p) / p <= tol;
  const singles = mine
    .filter((x) => near(x.price, 0.15))
    .map((x) => ({ items: [x], total: x.price, diff: x.price - p }))
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
    .slice(0, 5);
  // Two cards that together match: each worth 10–90% of the target; the same card twice only
  // when you have two copies.
  const parts = mine.filter((x) => x.price >= p * 0.1 && x.price <= p * 0.9).sort((a, b) => b.price - a.price).slice(0, 80),
    pairs = [];
  for (let i = 0; i < parts.length; i++)
    for (let j = i; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      if (i === j && (a.qty || 1) < 2) continue;
      const total = a.price + b.price;
      if (near(total, 0.1)) pairs.push({ items: [a, b], total, diff: total - p });
    }
  pairs.sort((x, y) => Math.abs(x.diff) - Math.abs(y.diff));
  // Keep bundles varied: no card in more than two of the shown bundles.
  const used = new Map(),
    shownPairs = [];
  for (const b of pairs) {
    if (b.items.some((x) => (used.get(x.key) || 0) >= 2)) continue;
    for (const x of b.items) used.set(x.key, (used.get(x.key) || 0) + 1);
    shownPairs.push(b);
    if (shownPairs.length >= 4) break;
  }
  const asks = target.owned
    ? wish
        .filter((x) => x.price > 0 && x.key !== target.key && near(x.price, 0.2))
        .map((x) => ({ items: [x], total: x.price, diff: x.price - p }))
        .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
        .slice(0, 5)
    : [];
  // Nothing close? Build the nearest bundle (up to 4 cards, highest value first) so the tab
  // still says what you could put together and how far short it falls.
  let closest = null;
  if (!singles.length && !shownPairs.length && mine.length) {
    const items = [], left = new Map(mine.map((x) => [x.key, x.qty || 1]));
    let total = 0;
    for (const x of [...mine].sort((a, b) => b.price - a.price))
      while (items.length < 4 && left.get(x.key) > 0 && total + x.price <= p * 1.1) {
        items.push(x);
        left.set(x.key, left.get(x.key) - 1);
        total += x.price;
      }
    if (!items.length) {
      const x = [...mine].sort((a, b) => Math.abs(a.price - p) - Math.abs(b.price - p))[0];
      items.push(x);
      total = x.price;
    }
    closest = { items, total, diff: total - p };
  }
  return { price: p, singles, pairs: shownPairs, asks, closest };
}

// The Trade tab. Each item: { key, name, price, art (html), open (attrs that open the card) }.
export function tradePanel(target, owned, wish, config={}) {
  const m = tradeMatches({ target, owned, wish });
  if (m.price == null) return `<section class="trade"><p class="muted">No price yet, so there's nothing fair to match it against. Trades appear here once stores list it.</p></section>`;
  const diff = (d) => (Math.abs(d) < 0.005 ? `<span class="tdiff even">Even</span>` : `<span class="tdiff ${d > 0 ? "over" : "under"}">${d > 0 ? "+" : "−"}${money(Math.abs(d))}</span>`);
  const row = (b) =>
    `<div class="trade-row">${b.items.map((x) => `<button class="trade-card" ${x.open} aria-label="Open ${esc(x.name)}">${x.art}<span>${esc(x.name)}</span><small>${money(x.price)}</small></button>`).join(`<span class="trade-plus" aria-hidden="true">+</span>`)}<div class="trade-total"><b>${money(b.total)}</b>${diff(b.diff)}</div></div>`;
  const block = (title, sub, list, emptyText) => `<div class="trade-block"><h3>${title}</h3><p class="muted small">${sub}</p>${list.length ? list.map(row).join("") : `<p class="trade-empty">${emptyText}</p>`}</div>`;
  const offers = [...m.singles, ...m.pairs],
    near = m.closest ? `<div class="trade-block"><h3>Closest you can get</h3><p class="muted small">Nothing you own matches it on its own or as a pair. Your best bundle${m.closest.items.length > 1 ? ` of ${m.closest.items.length} cards` : ""}:</p>${row(m.closest)}</div>` : "";
  const intent=config.mode || 'hybrid',tolerance=Number(config.tolerance || .08),credit=Number(config.credit || 1),needs=config.needs || [];
  const wanted=intent==='deck'?needs:intent==='wishlist'?wish:[...needs,...wish.filter(w=>!needs.some(n=>n.key===w.key))];
  const proposals=target.owned?tradeProposals(m.price,wanted.filter(x=>x.key!==target.key),{tolerance,credit}):[];
  const controls=target.owned?`<details class="trade-intent" open><summary>Trade into what I need</summary><div class="grid2"><label>Goal<select data-change="tradeOption" data-field="mode"><option value="hybrid" ${intent==='hybrid'?'selected':''}>Deck needs + wants</option><option value="deck" ${intent==='deck'?'selected':''}>Missing deck cards</option><option value="wishlist" ${intent==='wishlist'?'selected':''}>Wanted cards</option></select></label><label>Value window<select data-change="tradeOption" data-field="tolerance">${[.05,.08,.1,.15].map(v=>`<option value="${v}" ${v===tolerance?'selected':''}>±${Math.round(v*100)}%</option>`).join('')}</select></label><label>Trade value<select data-change="tradeOption" data-field="credit"><option value="1" ${credit===1?'selected':''}>Player · 100%</option><option value="0.75" ${credit===.75?'selected':''}>Vendor estimate · 75%</option></select></label></div><p class="foot">Vendor credit is an editable assumption, not an offer. Up to four copies per bundle; cached prices work offline.</p>${proposals.length?proposals.map(b=>`<div class="trade-proposal"><div class="row between"><b>My side ${money(b.target)}</b><b>Bundle ${money(b.total)}</b></div><progress max="${Math.max(b.target,b.total)}" value="${Math.min(b.target,b.total)}" aria-label="Relative trade values"></progress>${row(b)}<p class="small muted">${[...new Set(b.items.map(x=>x.deckName?'Needs for '+x.deckName:'Wanted card'))].map(esc).join(' · ')}</p></div>`).join(''):'<p class="muted small">No bundle within this window yet. Add missing deck cards or wanted cards, or widen the value window.</p>'}</details>`:'';
  return `<section class="trade">
    <div class="trade-head"><span class="muted small">Worth about</span><b>${money(m.price)}</b></div>
    ${near || block("Offer from your cards", "Cards you own worth about the same, alone or as a pair.", offers, "Add cards to your collection to see what you could offer.")}
    ${controls}
    ${target.owned ? block("Ask for from your wishlist", "You own this one. These cards you want are worth about the same.", m.asks, wish.length ? "Nothing on your wishlist is close in value." : "Add cards to your wishlist to see fair swaps for this one.") : ""}
    <p class="foot">Values are daily market estimates. Condition, edition and the other trader decide the real deal.</p>
  </section>`;
}

// Bounded beam search: up to four physical copies, ranked by usefulness then value gap.
// A suggestion is not a reservation or a transaction, and never claims global optimality.
export function tradeProposals(value,candidates,{tolerance=.08,credit=1,maxCards=4}={}){
 if(!(value>0))return [];
 const target=Math.round(value*credit*100),high=Math.round(target*(1+tolerance)),low=Math.round(target*(1-tolerance));
 const items=candidates.filter(x=>x.price>0&&Number.isFinite(x.price)&&x.price*100<=high).sort((a,b)=>(b.priority||1)-(a.priority||1)||b.price-a.price).slice(0,60);
 let states=[{items:[],total:0,utility:0}];
 for(const item of items){const next=[...states],cost=Math.round(item.price*100);
  for(const state of states)for(let n=1;n<=Math.min(item.qty||1,maxCards-state.items.length);n++){
   const total=state.total+cost*n;if(total>high)break;
   next.push({items:[...state.items,...Array(n).fill(item)],total,utility:state.utility+(item.priority||1)*cost*n});
  }
  const seen=new Map();for(const s of next){const k=s.total+':'+s.items.length;const old=seen.get(k);if(!old||s.utility>old.utility)seen.set(k,s);}
  states=[...seen.values()].sort((a,b)=>Math.abs(a.total-target)-Math.abs(b.total-target)||b.utility-a.utility).slice(0,500);
  if(!states.some(s=>!s.items.length))states.push({items:[],total:0,utility:0});
 }
 return states.filter(s=>s.items.length&&s.total>=low&&s.total<=high).sort((a,b)=>b.utility-a.utility||Math.abs(a.total-target)-Math.abs(b.total-target)||a.items.length-b.items.length).slice(0,6).map(s=>({...s,total:s.total/100,diff:(s.total-target)/100,target:target/100}));
}
