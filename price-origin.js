// Display the source of the valuation actually used by the collection resolver.
// A number alone cannot tell a provider quote from a manually entered price.
import {esc,usd} from './ui.js';
export const isPersonalPrice = value => ['manual','manual-reference'].includes(value?.kind);
export function priceOriginNote(value) {
 if(isPersonalPrice(value))return 'Your value for this condition · manually entered · included in collection value';
 if(value?.kind==='condition-quote')return `Condition quote · ${value.quote?.source||'provider'} · included in collection value`;
 return value?.price==null?'No usable price for this copy · excluded from collection value':'General market reference · included in collection value';
}
export function priceOriginBadge(value) {
 if(!isPersonalPrice(value))return '';
 return `<small class="price-origin is-personal" data-price-origin="personal" title="${esc(priceOriginNote(value))}">Your price</small>`;
}
export function priceSourceSummary(rows=[]) {
 const groups={condition:{label:'Condition quotes',copies:0,total:0},reference:{label:'Market references',copies:0,total:0},personal:{label:'Your prices',copies:0,total:0},unpriced:{label:'Without a price',copies:0,total:0}};
 for(const row of rows){
  const qty=Number(row.entry?.qty)||0;if(qty<=0)continue;
  const value=row.valuation,unit=row.unit;
  const key=unit==null||!Number.isFinite(unit)||unit<0?'unpriced':isPersonalPrice(value)?'personal':value?.kind==='condition-quote'?'condition':'reference';
  groups[key].copies+=qty;if(key!=='unpriced')groups[key].total+=unit*qty;
 }
 return groups;
}
export function priceSourcesHtml(rows=[]) {
 const groups=priceSourceSummary(rows),personal=groups.personal.copies;
 return `<details class="value-price-sources"><summary>Price sources${personal?` · ${personal} ${personal===1?'copy uses':'copies use'} your price`:''}</summary><dl>${Object.entries(groups).filter(([,g])=>g.copies).map(([key,g])=>`<div data-value-source="${key}"><dt>${g.label}<small>${g.copies} ${g.copies===1?'copy':'copies'}</small></dt><dd>${key==='unpriced'?'Excluded':usd(g.total)}</dd></div>`).join('')}</dl><p class="foot">Condition quotes are provider prices for the saved version and condition. Your prices are values you entered yourself. Both count toward the total; copies without a usable price do not.</p></details>`;
}
