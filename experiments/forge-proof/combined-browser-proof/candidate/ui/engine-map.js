import {inspectAbilityEndpoints} from './mtg-ability-endpoints.js';
// Inferred rules-text links and exact unsearched opening-hand probabilities.
// A dependency graph is evidence to inspect, never a full rules engine or a win-rate forecast.
import {tagsFor,TAG_LABEL} from './pairing.js';
import {mtgLinkEvidence,mtgSelfConflicts} from './mtg-effects.js';
import {atLeastOne} from './deckaudit.js';
import {esc} from './ui.js';
export function engineMap(game,rows,{draws=game==='ygo'?5:7,commanders=[]}={}){
 const nameKey=name=>String(name||'').normalize('NFKC').replace(/[’‘]/g,"'").split(' // ')[0].trim().toLowerCase();
 const commanderNames=new Set(commanders.map(c=>nameKey(typeof c==='string'?c:c?.name)).filter(Boolean));
 const inCommand=r=>r.zone==='commander'||r.zone==='command'||commanderNames.has(nameKey(r.c?.name||r.name));
 const main=rows.filter(r=>r.zone!=='side'),inLibrary=r=>r.zone!=='extra'&&!inCommand(r),library=main.filter(inLibrary),N=library.reduce((n,r)=>n+(Number(r.qty)||0),0);
 const named=new Map();
 for(const r of main.filter(r=>r.c&&r.qty>0)){
  const name=r.c.name,old=named.get(name),qty=Number(r.qty)||0;
  if(old){old.qty+=qty;old.libraryQty+=inLibrary(r)?qty:0;old.commandQty+=inCommand(r)?qty:0;}
  else named.set(name,{...r,qty,libraryQty:inLibrary(r)?qty:0,commandQty:inCommand(r)?qty:0,tags:tagsFor(game,r.c)});
 }
 const endpointEvidence=game==='mtg'?inspectAbilityEndpoints(main.map(r=>({...r,card:r.c})),{commanders}):null;
 const cards=[...named.values()],links=[],unsupported=[],conflicts=game==='mtg'?mtgSelfConflicts(cards.map(r=>r.c)):[];let unmet=0;
 for(const payoff of cards){
  for(const need of payoff.tags.needs){
   const mapped=endpointEvidence?.groups.filter(g=>nameKey(g.sourceName)===nameKey(payoff.c.name)&&need==='sub:'+g.endpointType)||[],eligible=mapped.length?new Set(mapped.flatMap(g=>g.cards.map(c=>nameKey(c.name)))):null;
   if(mapped.length&&!eligible.size){unsupported.push({card:payoff.c.name,need,status:mapped.some(g=>g.status==='unverified')?'unverified':'unsupported',reason:'Mapped optional ability has no verified structural endpoint; other card utility is retained.'});unmet++;continue;}
   const providers=cards.filter(p=>p.c.name!==payoff.c.name&&(eligible?eligible.has(nameKey(p.c.name)):p.tags.provides.has(need))).map(p=>({p,detail:mapped.length?{status:'conditional',evidence:mapped.map(g=>g.source.evidence),requirements:mapped.flatMap(g=>g.limitations)}:game==='mtg'?mtgLinkEvidence(need,p.tags,payoff.tags):{status:'inferred',evidence:[],requirements:[]}}));
   for(const {p,detail} of providers.filter(p=>p.detail.status==='unsupported'))unsupported.push({payoff:payoff.c.name,provider:p.c.name,need,...detail});
   const compatible=providers.filter(p=>p.detail.status!=='unsupported').map(({p,detail})=>{
    const blocked=conflicts.filter(c=>c.provider===p.c.name&&(c.kind==='creature-enter-trigger'&&detail.evidence.some(e=>/\benters?\b/i.test(e))||c.kind==='life-gain'&&need==='lifegain'||c.kind==='life-payment'&&detail.evidence.some(e=>/pay \d+ life/i.test(e))));
    return {p,detail:blocked.length?{...detail,status:'conditional',requirements:[...detail.requirements,...blocked.map(c=>c.reason)]}:detail};
   }).sort((a,b)=>a.p.c.name.localeCompare(b.p.c.name));
   if(!compatible.length){unmet++;continue;}
   if(mapped.length)for(const item of compatible)item.detail={...item.detail,status:'conditional',requirements:[...(item.detail.requirements||[]),...mapped.flatMap(g=>g.limitations)]};
   const k=compatible.reduce((n,{p})=>n+p.libraryQty,0),n=Math.min(draws,N),a=payoff.libraryQty,commandSupport=compatible.some(({p})=>p.commandQty>0);
   // The commander is accessible, not in hand or already on the battlefield. These
   // probabilities describe card access only, never mana/timing/playability.
   let both=null,openingAccess=null,availability='library';
   if(payoff.commandQty){availability='command-payoff';openingAccess=commandSupport?1:k&&N?atLeastOne(N,k,n):null;}
   else if(commandSupport){availability='command-support';openingAccess=a&&N?atLeastOne(N,a,n):null;}
   else if(a&&k&&N)both=Math.max(0,atLeastOne(N,a,n)+atLeastOne(N,k,n)-atLeastOne(N,a+k,n));
   else availability='outside-library';
   const status=compatible.every(p=>p.detail.status==='conditional')?'conditional':compatible.every(p=>p.detail.status==='supported')?'supported':'inferred';
   links.push({payoff:payoff.c.name,need:TAG_LABEL[need] || need,tag:need,status,providers:compatible.map(({p,detail})=>({name:p.c.name,qty:p.qty,availability:p.commandQty?'command-zone':p.libraryQty?'library':'extra-deck',...detail})),supportCopies:k,openingBoth:both,openingAccess,availability});
  }
  for(const effect of payoff.tags.effects?.unsupported||[])unsupported.push({card:payoff.c.name,...effect});
 }
 return {abilityEndpoints:endpointEvidence,library:N,draws:Math.min(draws,N),commanders:cards.filter(c=>c.commandQty).map(c=>c.c.name).sort(),unknown:library.filter(r=>!r.c).reduce((n,r)=>n+(Number(r.qty)||0),0),unmappedNeeds:unmet,unsupported,conflicts,links:links.sort((a,b)=>(b.openingBoth ?? b.openingAccess ?? 0)-(a.openingBoth ?? a.openingAccess ?? 0)||a.payoff.localeCompare(b.payoff)||a.need.localeCompare(b.need)).slice(0,12)};
}
export function engineMapPanel(m){
 if(!m?.links.length&&!m?.conflicts?.length)return '';
 const odds=x=>x.openingBoth!==null?`<p class="small"><b>${Math.round(x.openingBoth*100)}%</b> chance to naturally open both this card and at least one linked support card. This does not establish that their effects can be used.</p>`:x.openingAccess!=null?`<p class="small"><b>${Math.round(x.openingAccess*100)}%</b> chance to open the needed library card; ${x.availability==='command-payoff'?'the payoff':'a linked support card'} is accessible from the command zone, not in the opening hand or on the battlefield. Casting costs still apply.</p>`:'<p class="small muted">Access outside the library must be established separately; it is not an opening draw.</p>';
 return `<section class="panel engine-map"><h3>How this engine connects</h3><p class="muted small">Rules-text dependencies in your own list. Opening odds use ${m.draws} cards from ${m.library}, before searches, mulligans or extra draws.${m.commanders?.length?' Command-zone cards are excluded from the library.':''}</p>${(m.conflicts||[]).map(c=>`<p class="note warn">${esc(c.reason)}</p>`).join('')}${m.links.map(x=>`<details><summary><b>${esc(x.payoff)}</b> · ${esc(x.need)} · ${esc(x.status || 'inferred')}</summary><p>${x.providers.map(p=>`${p.qty}× ${esc(p.name)}${p.status==='conditional'?' (conditional)':''}`).join(' · ')}</p>${x.providers.map(p=>(p.requirements?.length||p.evidence?.length)?`<p class="small muted"><b>${esc(p.name)}:</b> ${esc((p.requirements?.length?p.requirements:p.evidence).join('; '))}</p>`:'').join('')}${odds(x)}</details>`).join('')}<p class="foot">Only recognized effect constraints are checked; links are not a full rules simulation or proof of a winning engine. ${m.unknown?`${m.unknown} unloaded copies limit this analysis.`:''}${m.unmappedNeeds?` ${m.unmappedNeeds} inferred requirements have no recognized provider; inspect card-specific engines before treating them as missing pieces.`:''}${m.unsupported?.length?` ${m.unsupported.length} effects or links have unsupported targets or requirements and receive no automatic credit.`:''}</p></section>`;
}
