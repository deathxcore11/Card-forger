// The War Chest: CardStashy's toolbox for a night of real cards. It replaces Playtest on the deck page and
// opens from the Decks header. Every tool here works at a real table; nothing touches Play, prices or the store.
import {esc} from './ui.js';
import {loadTable} from './tabletop.js';
// The game on this device's table, for Resume.
export function chestResume(game,storage=globalThis.localStorage){const s=loadTable(game,storage);if(!s)return null;return {line:`Turn ${s.turn+1} · `+s.players.map(p=>p.name+' '+(game==='ptcg'?p.pokemon[p.position].damage+' dmg':p.life)).join(' · ')};}
const I=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const CHEST_ICON=I('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M5 9a7 5 0 0 1 14 0M12 12v3"/>');
// deck: this tool needs a deck. Order is the order on screen.
export const CHEST_TOOLS=[
 {id:'gameNight',label:'Game Night',icon:I('<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>'),hero:true},
 {id:'share',label:'Share table',icon:I('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-3.8M8.2 13l7.6 3.8"/>')},
 {id:'dice',label:'Dice & coin',icon:I('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>')},
 {id:'judge',label:'Ask the Judge',icon:I('<path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l-3 6a3 3 0 0 0 6 0z"/>')},
 {id:'goldfish',label:'Goldfish',deck:true,icon:I('<path d="M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3z"/><circle cx="8" cy="11" r="1"/>')},
 {id:'draw',label:'Draw a hand',deck:true,icon:I('<rect x="3" y="6" width="9" height="13" rx="1.5" transform="rotate(-10 7 12)"/><rect x="12" y="5" width="9" height="13" rx="1.5" transform="rotate(10 16 11)"/>')},
 {id:'spirit',label:'Table Spirit',icon:I('<path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/>')},
 {id:'journal',label:'Deck journal',deck:true,icon:I('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>')},
 {id:'lookup',label:'Card lookup',icon:I('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>')},
];
export const chestTools=({deck=false}={})=>CHEST_TOOLS.filter(t=>deck||!t.deck);
// resume: a saved table for this game, {turn, line} or null.
export function warChestMarkup({deck=null,resume=null,result=''}={}){
 return `<section class="war-chest" aria-label="The War Chest"><header class="wc-head"><small>CardStashy</small><h2>The War Chest</h2><p>Everything for a night of real cards${deck?` · ${esc(deck.name||'this deck')}`:''}</p></header>
 <div class="wc-tools">${chestTools({deck:!!deck}).map(t=>`<button class="wc-tool${t.hero?' wc-hero':''}" data-act="chestTool" data-tool="${t.id}"><span class="wc-orb">${t.icon}</span><span>${esc(t.label)}</span></button>`).join('')}</div>
 <p class="wc-result" role="status" data-chest-result>${esc(result)}</p>
 ${resume?`<div class="wc-resume"><span><b>Game in progress</b>${esc(resume.line)}</span><button class="btn" data-act="chestTool" data-tool="gameNight">Resume</button></div>`:''}</section>`;
}
export function rollDice(rand=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}){const a=rand(),b=rand();return `d6 rolled ${a%6+1} · d20 rolled ${b%20+1} · coin: ${(a>>>8)%2?'heads':'tails'}`;}
// The War Chest as its own window, opened from the Decks header (no deck loaded).
export function openWarChest({resume=null,onTool=()=>{}}={}){
 if(document.querySelector('.war-chest-dialog'))return;
 const d=document.createElement('dialog');d.className='war-chest-dialog';d.setAttribute('aria-label','The War Chest');
 d.innerHTML=`<button class="icon wc-close" data-wc-close aria-label="Close the War Chest">×</button>${warChestMarkup({resume})}`;
 document.body.append(d);
 d.addEventListener('click',e=>{if(e.target.closest('[data-wc-close]'))return d.close();const b=e.target.closest('[data-tool]');if(!b)return;e.stopPropagation();const tool=b.dataset.tool;if(tool==='dice'){d.querySelector('[data-chest-result]').textContent=rollDice();return;}d.close();onTool(tool);});
 d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();
}
