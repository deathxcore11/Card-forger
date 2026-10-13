import { aggregateCards,cardKey,isLand,isBasic,rulesText,sumQty,typeText } from './core.js';
import { formatOf,legalityIn } from './formats.js';
// Function and legality are separate. Commander Beacon still produces {C};
// a spell mentioning commander can remain useful when paid for normally.
export function functionalIn(c,format) {
  const f=format?.id ? format : formatOf(format), text=rulesText(c);
  if(f.commander)return true;
  const dependent=/add[^.]{0,120}commander[^.]{0,80}color identity/i.test(text);
  const independent=/add\s*\{[CWUBRG0-9]\}/i.test(text);
  return !dependent || independent;
}
export function cutToTarget(deck,catalog,target=formatOf(deck).size) {
  const f=formatOf(deck),rows=aggregateCards(deck.cards).map(r=>({...r}));let left=Math.max(0,sumQty(rows)-target);const cuts=[];
  const rank=r=>{const c=catalog[cardKey(r.name)];if(!c)return 0;return (!functionalIn(c,f)?100:0)+(f.legality&& !['legal','restricted'].includes(legalityIn(c,f))?100:0)+(isLand(c)?(isBasic(c)?-15:-5):Number(c.cmc)||0);};
  const ordered=rows.filter(r=>cardKey(r.name)!==cardKey(deck.commander)).sort((a,b)=>rank(b)-rank(a)||a.name.localeCompare(b.name));
  for(const row of ordered){if(!left)break;const qty=Math.min(left,row.qty);cuts.push({name:row.name,qty,reason:!functionalIn(catalog[cardKey(row.name)],f)?'Commander-dependent mana source without a commander':'Heuristic consistency cut; review before applying'});row.qty-=qty;left-=qty;}
  return {cards:rows.filter(r=>r.qty>0),cuts,total:sumQty(rows),target};
}
export function zoneCountLabel(game,n,format,zone='main') {
  if(game==='ptcg')return `${n}/60 cards${n===60?'':' · '+(n<60?60-n+' open':n-60+' cuts needed')}`;
  const min=zone==='main'?format.main[0]:0,max=zone==='main'?format.main[1]:format[zone];
  return n>=min&&n<=max?`${n} ${zone} · within ${min}–${max}`:n<min?`${n}/${min} ${zone} · ${min-n} open`:`${n}/${max} ${zone} · ${n-max} cuts needed`;
}
