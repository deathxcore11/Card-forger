// Evidence-led disruption notes, not a win-rate predictor or a complete rules simulator.
import {esc} from './ui.js';
const AXES={
 mtg:[['graveyard','Graveyard engine',/from your graveyard|cards? in your graveyard|escape|flashback|reanimate/i,/exile all (?:cards|graveyards)|exile.*(?:target.*graveyard|cards? from.*graveyard)|cards in graveyards.*(?:lose|can.t)/i],['tokens','Wide board',/create.*tokens?|populate/i,/destroy all creatures|exile all creatures|all creatures get -/i],['abilities','Activated mana engine',/tap a nonland permanent for mana|activated abilities|untap.*(?:artifact|creature)/i,/activated abilities.*can.t be activated|players can.t activate abilities/i],['search','Search engine',/search your library/i,/opponents.*can.t search|opponent.*search.*instead/i]],
 ygo:[['graveyard','Graveyard engine',/from your gy|in your gy|from the graveyard/i,/banish.*(?:gy|graveyard)|cards.*sent.*graveyard.*banish/i],['search','Search engine',/add.*from your deck.*hand/i,/cannot add cards.*hand|can.t add cards.*hand|negate.*effect.*adds.*deck/i],['summons','Special Summon engine',/special summon/i,/cannot special summon|neither player can special summon|can only summon.*once/i]],
 ptcg:[['abilities','Ability engine',/ability:|once during your turn/i,/abilities.*(?:no|can.t|cannot)|no abilities/i],['bench','Bench setup',/your benched|bench.*pok[eé]mon/i,/damage.*(?:each|all).*benched|damage counters.*benched/i],['energy','Energy engine',/attach.*energy|energy.*discard pile/i,/discard.*energy.*opponent|move.*energy.*opponent/i]]
};
export function strategicRisk(game,own,rivals=[],lookup=()=>null){
 const text=c=>c?.oracle_text || c?.text || '',axes=[];
 for(const [key,label,dependency,hate] of AXES[game] || []){
  const reliant=own.filter(r=>r.c&&!/\bLand\b/.test(r.c.type_line || '')&&dependency.test(text(r.c))),copies=reliant.reduce((a,r)=>a+r.qty,0);
  if(copies<2&&!reliant.some(r=>/tap a nonland permanent for mana/.test(text(r.c))))continue;
  const threats=[];
  for(const rival of rivals){for(const r of [...(rival.main || rival.list || []),...(rival.side || [])]){
   if(typeof r==='string'||typeof r==='number')continue;
   const c=lookup(r);if(c&&hate.test(text(c)))threats.push({rival:rival.archetype || rival.name,card:c.name,qty:r.qty || 1});
  }}
  axes.push({key,label,copies,cards:reliant.slice(0,4).map(r=>r.c.name),threats:[...new Map(threats.map(t=>[t.rival+'|'+t.card,t])).values()].slice(0,3)});
 }
 return {axes,rivals:rivals.length};
}
export function riskPanel(profile){
 if(!profile?.axes.length)return '';
 return `<section class="panel"><h3>How this plan can be disrupted</h3><p class="foot">Card-text evidence, not predicted match results. These dependencies suggest what to test against.</p>${profile.axes.map(a=>`<details class="ingredient"><summary><b>${esc(a.label)}</b> · ${a.copies} supporting copies</summary><p class="small muted">${a.cards.map(esc).join(' · ')}</p>${a.threats.length?a.threats.map(t=>`<p class="small"><b>${esc(t.rival)}</b> includes ${t.qty}× ${esc(t.card)}, which can interfere with this engine. Check timing, protection and recovery in practice.</p>`).join(''):'<p class="foot">No opposing disruption card has been verified in the loaded lists for this axis. That does not establish a favorable matchup.</p>'}</details>`).join('')}<p class="foot">${profile.rivals} loaded rival lists checked. Unresolved card text is excluded.</p></section>`;
}
