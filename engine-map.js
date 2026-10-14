// Inferred rules-text links and exact unsearched opening-hand probabilities.
// A dependency graph is evidence to inspect, never a full rules engine or a win-rate forecast.
import {tagsFor,TAG_LABEL} from './pairing.js';
import {atLeastOne} from './deckaudit.js';
import {esc} from './ui.js';
export function engineMap(game,rows,{draws=game==='ygo'?5:7}={}){
 const main=rows.filter(r=>r.zone!=='side'),library=main.filter(r=>r.zone!=='extra'),N=library.reduce((n,r)=>n+r.qty,0);
 const named=new Map();
 for(const r of main.filter(r=>r.c&&r.qty>0)){
  const name=r.c.name,old=named.get(name);
  if(old){old.qty+=r.qty;old.libraryQty+=r.zone==='extra'?0:r.qty;}
  else named.set(name,{...r,libraryQty:r.zone==='extra'?0:r.qty,tags:tagsFor(game,r.c)});
 }
 const cards=[...named.values()],links=[];let unmet=0;
 for(const payoff of cards){
  for(const need of payoff.tags.needs){
   const providers=cards.filter(p=>p.c.name!==payoff.c.name&&p.tags.provides.has(need));
   if(!providers.length){unmet++;continue;}
   const k=providers.reduce((n,p)=>n+p.libraryQty,0),n=Math.min(draws,N),a=payoff.libraryQty;
   const both=a&&k&&N?Math.max(0,atLeastOne(N,a,n)+atLeastOne(N,k,n)-atLeastOne(N,a+k,n)):null;
   links.push({payoff:payoff.c.name,need:TAG_LABEL[need] || need,providers:providers.map(p=>({name:p.c.name,qty:p.qty})),supportCopies:k,openingBoth:both});
  }
 }
 return {library:N,draws,unknown:library.filter(r=>!r.c).reduce((n,r)=>n+r.qty,0),unmappedNeeds:unmet,links:links.sort((a,b)=>(b.openingBoth || 0)-(a.openingBoth || 0)).slice(0,12)};
}
export function engineMapPanel(m){
 if(!m?.links.length)return '';
 return `<section class="panel engine-map"><h3>How this engine connects</h3><p class="muted small">Rules-text dependencies in your own list. Opening odds use ${m.draws} cards from ${m.library}, before searches, mulligans or extra draws.</p>${m.links.map(x=>`<details><summary><b>${esc(x.payoff)}</b> · ${esc(x.need)}</summary><p>${x.providers.map(p=>`${p.qty}× ${esc(p.name)}`).join(' · ')}</p>${x.openingBoth!==null?`<p class="small"><b>${Math.round(x.openingBoth*100)}%</b> chance to naturally open both this card and at least one linked support card.</p>`:'<p class="small muted">Extra Deck access must be established by its summoning requirements; it is not an opening draw.</p>'}</details>`).join('')}<p class="foot">Links are inferred from card text. Their activation costs, timing and restrictions still need validation. ${m.unknown?`${m.unknown} unloaded copies limit this analysis.`:''}${m.unmappedNeeds?` ${m.unmappedNeeds} inferred requirements have no recognized provider; inspect card-specific engines before treating them as missing pieces.`:''}</p></section>`;
}
