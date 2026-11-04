// Play it out by hand: one of the simulated trials' opening hands and its exact draw order, played with your
// own choices. Nothing is simulated here and nothing is scored; the zones simply move cards where you say.
import {esc} from './ui.js';
const name=v=>typeof v==='string'&&v.length>0&&v.length<=120;
export function cleanHand(raw){
 try{const o=typeof raw==='string'?JSON.parse(raw):raw;
  if(!Array.isArray(o?.hand)||!Array.isArray(o?.library)||o.hand.length>12||o.library.length>200||![...o.hand,...o.library].every(name))return null;
  return {hand:o.hand.slice(),library:o.library.slice()};}catch{return null;}
}
export function startHand(raw){const h=cleanHand(raw);if(!h)return null;return {turn:1,hand:h.hand,library:h.library,field:[],yard:[],log:['Turn 1. On the play: no draw.'],start:cleanHand(raw)};}
export function draw(s){if(!s.library.length)return false;const c=s.library.shift();s.hand.push(c);s.log.push('Drew '+c+'.');return true;}
export function nextTurn(s){s.turn++;s.log.push('Turn '+s.turn+'.');draw(s);return true;}
const FROM={hand:'hand',field:'field',yard:'yard'};
export function move(s,from,i,to){
 if(!FROM[from]||!FROM[to]||from===to||!Number.isInteger(i)||i<0||i>=s[from].length)return false;
 const [c]=s[from].splice(i,1);s[to].push(c);
 s.log.push({hand_field:'Played ',hand_yard:'Discarded ',field_yard:'Sent to the graveyard: ',field_hand:'Returned to hand: ',yard_hand:'Took back: ',yard_field:'Returned to play: '}[from+'_'+to]+c+'.');return true;
}
const zone=(s,k,title,acts)=>`<section class="pbh-zone"><h4>${title} <b>${s[k].length}</b></h4><ul>${s[k].map((c,i)=>`<li><span>${esc(c)}</span>${acts.map(([to,label])=>`<button data-pbh-move="${k}:${i}:${to}">${label}</button>`).join('')}</li>`).join('')||'<li class="foot">Empty</li>'}</ul></section>`;
export function openPlayByHand(raw){
 const s=startHand(raw);if(!s||document.querySelector('.pbh-dialog'))return;
 const d=document.createElement('dialog');d.className='pbh-dialog tabletop-dialog';d.setAttribute('aria-label','Play it out by hand');document.body.append(d);
 const paint=()=>{d.innerHTML=`<header class="tabletop-head"><div><p class="eyebrow">ONE SIMULATED OPENING</p><h2>Play it out by hand</h2></div><button data-pbh="close" class="icon" aria-label="Close">×</button></header><p class="foot">The seven cards and the draw order come from one of the trials above. You choose the plays; nothing is scored.</p><div class="tabletop-tools"><span>Turn ${s.turn} · ${s.library.length} left in library</span><button data-pbh="next" ${s.library.length?'':'disabled'}>Next turn and draw</button><button data-pbh="draw" ${s.library.length?'':'disabled'}>Draw a card</button><button data-pbh="again">Start over</button></div>${zone(s,'hand','Hand',[['field','Play'],['yard','Discard']])}${zone(s,'field','In play',[['yard','Graveyard'],['hand','To hand']])}${zone(s,'yard','Graveyard',[['field','To play'],['hand','To hand']])}<details class="table-log"><summary>What happened (${s.log.length})</summary><ol class="table-log-list">${s.log.slice().reverse().map(l=>`<li>${esc(l)}</li>`).join('')}</ol></details>`;};
 d.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pbh==='close'){d.close();return;}
  if(b.dataset.pbh==='next')nextTurn(s);else if(b.dataset.pbh==='draw')draw(s);
  else if(b.dataset.pbh==='again'){Object.assign(s,startHand(s.start));}
  else if(b.dataset.pbhMove){const [from,i,to]=b.dataset.pbhMove.split(':');move(s,from,Number(i),to);}
  paint();});
 d.addEventListener('close',()=>d.remove(),{once:true});paint();d.showModal();
}
