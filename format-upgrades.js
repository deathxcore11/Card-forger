import {aggregateCards,cardKey,isLand,isBasic,sumQty,typeText,rulesText} from './core.js';
import {formatOf,legalityIn} from './formats.js';
import {functionalIn} from './deck-safety.js';
import {engineRoles} from './insights.js';
const qty=(rows,n)=>rows.filter(r=>cardKey(r.name)===cardKey(n)).reduce((a,r)=>a+r.qty,0);
const colors=c=>c?.color_identity||[];
const cap=(c,f)=>isBasic(c)||/any number of cards named/i.test(rulesText(c))?Infinity:legalityIn(c,f)==='restricted'?1:f.copies;
const allowed=(c,f)=>functionalIn(c,f)&&(!f.legality||['legal','restricted'].includes(legalityIn(c,f)));
// Conservative one-copy, same-function swaps. This is a review aid, not a win-rate model.
export function formatUpgrades(deck,catalog,{budget=25,available=()=>0,price=()=>null}={}) {
 const f=formatOf(deck),rows=aggregateCards(deck.cards),identity=[...new Set(rows.flatMap(r=>colors(catalog[cardKey(r.name)])))];
 if(f.commander||sumQty(rows)!==f.size)return [];
 const suggestions=[],used=new Set();
 for(const row of rows){const out=catalog[cardKey(row.name)];if(!out||isLand(out))continue;
  const roles=engineRoles(out),subtype=typeText(out).split('—')[1]?.trim(),mv=Number(out.cmc)||0;
  const candidates=Object.values(catalog).filter(c=>c?.name&&cardKey(c.name)!==cardKey(out.name)&&!isLand(c)&&allowed(c,f)&&colors(c).every(x=>identity.includes(x))&&qty(rows,c.name)<cap(c,f)&&!used.has(cardKey(c.name))).map(c=>{
   const shared=roles.filter(r=>engineRoles(c).includes(r)),sameSubtype=!!subtype&&typeText(c).split('—')[1]?.trim()===subtype;
   const sameType=typeText(c).split('—')[0].trim()===typeText(out).split('—')[0].trim();
   const gain=mv-(Number(c.cmc)||0),p=price(c),owned=available(c.name)>qty(rows,c.name),cost=owned?0:p;
   return {c,shared,sameSubtype,sameType,gain,cost};
  }).filter(x=>(x.shared.length||x.sameSubtype)&&x.sameType&&x.gain>=1&&x.cost!==null&&Number.isFinite(x.cost)&&x.cost<=budget).sort((a,b)=>b.shared.length-a.shared.length||b.gain-a.gain||a.cost-b.cost);
  const best=candidates[0];if(!best)continue;used.add(cardKey(best.c.name));
  suggestions.push({cardOut:out.name,cardIn:best.c.name,qty:1,cost:best.cost,reason:`Same ${best.shared.length?best.shared.join(' / '):subtype} role; mana value ${mv} → ${Number(best.c.cmc)||0}. Check the rules text and engine trade-off before applying.`});
 }
 return suggestions.slice(0,6);
}
export function applyFormatSwap(deck,swap,catalog) {
 const f=formatOf(deck),rows=aggregateCards(deck.cards).map(r=>({...r})),out=rows.find(r=>cardKey(r.name)===cardKey(swap.cardOut)),c=catalog[cardKey(swap.cardIn)];
 if(!out||out.qty<1||!c||!allowed(c,f)||qty(rows,c.name)+1>cap(c,f))throw Error('This swap is no longer valid. Generate suggestions again.');
 const identity=[...new Set(rows.flatMap(r=>colors(catalog[cardKey(r.name)])))];
 if(!colors(c).every(x=>identity.includes(x)))throw Error('The replacement needs colors outside this deck.');
 out.qty--;const existing=rows.find(r=>cardKey(r.name)===cardKey(c.name));if(existing)existing.qty++;else rows.push({name:c.name,qty:1});
 const result=rows.filter(r=>r.qty>0);if(sumQty(result)!==sumQty(deck.cards))throw Error('Swap changed the deck size.');return result;
}
