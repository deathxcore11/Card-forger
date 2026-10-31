// Planeswalk sound: music for each screen and cues for the run's moments, read from what the game
// renders and the buttons it marks with data-act, so the game code itself does not change.
// Follows the page's own "Sound: on/off" (window.pwSound / pw-sound) on top of the app's settings.
import {sfx,setMusic,setMuteCheck,preload} from './audio.js';

const pwMuted=()=>{try{return window.pwSound?!window.pwSound.on:localStorage.getItem('pw-sound')==='off';}catch{return false;}};
setMuteCheck(pwMuted);
// The page's Sound button flips pwSound after this listener runs, so re-read it on the next tick.
addEventListener('click',e=>{if(e.target.closest?.('.pw-sndbtn'))setTimeout(()=>setMuteCheck(pwMuted),0);
 // The hero's loyalty diamond opens the ability fan; the game stops that click at #app, so listen above it.
 if(e.target.closest?.('.battle .loyal'))sfx('APP-007',{volume:.6});},true);
const app=document.getElementById('app');
const BOSS_THEMES=[[/^sorin/i,'SORIN'],[/^olivia/i,'OLIVIA'],[/^ob(\b| nixilis)/i,'OB'],[/herald/i,'HERALD'],[/^vraska/i,'VRASKA'],[/^lazav/i,'LAZAV'],[/bolas/i,'BOLAS']];
const GIVERS={ugin:'MUS-PWG-01',sigarda:'MUS-PWG-02',geist:'MUS-PWG-03',tamiyo:'MUS-PWG-04',noyan:'MUS-PWG-05',kiora:'MUS-PWG-06',
 anowon:'MUS-PWG-07',zada:'MUS-PWG-08',teferi:'MUS-PWG-09',niv:'MUS-PWG-10',kaya:'MUS-PWG-11',rakdos:'MUS-PWG-12'};
const CLICK={go:'PW-006',hero:'PW-003',take:'PW-017',skip:'PW-018',emb:'PW-026',bossemb:'PW-026',startemb:'PW-026',buyemb:'PW-020',buy:'PW-020',
 end:'PWB-017',play:'PWB-003',plus:'PWB-009',minus:'PWB-009',ult:'PWB-009',target:'CARD-017',heal:'PW-023',restburn:'PW-023',tend:'PW-023',
 foil:'PW-024',foilpick:'PW-024',shopfoil:'PW-024',shopfoilpick:'PW-024',remove:'PW-022',shopremove:'PW-022',shopremovepick:'PW-022',
 pactmyth:'PW-013','ante-wager':'PW-013','ante-skip':'PW-018',pactcurse:'PW-013',sac:'PWB-015',new:'PW-033',replay:'PW-033',leave:'APP-004',back:'APP-004',shopback:'APP-004',cancel:'APP-004'};
if(app){
 app.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;
  // A button the game shows but you cannot use yet (not enough energy or gold) gets the "can't" knock.
  if(b.disabled||b.getAttribute('aria-disabled')==='true'){sfx(b.closest('.shop, .screen.shop')?'PW-021':'PWB-004',{volume:.6});return;}
  const id=CLICK[b.dataset.act];if(id)sfx(id,{volume:.8});},true);
 let screen='',pops=0;const told=new WeakSet();let lastDungeon='';
 // Each new dungeon room's banner is added to <body>.
 new MutationObserver(l=>{for(const m of l)for(const n of m.addedNodes)if(n.classList?.contains('pw-room'))sfx('RAV-004');}).observe(document.body,{childList:true});
 const read=()=>{
  const q=s=>app.querySelector(s),act=+document.body.dataset.actnum||1;
  // Each blessing patron has a theme of their own; the blessing screen names its patron in data-giver.
  const g=q('[data-giver]');if(g&&GIVERS[g.dataset.giver])return ['giver-'+g.dataset.giver,GIVERS[g.dataset.giver]];
  if(q('.screen.heroes'))return ['heroes','MUS-PW-01'];
  // Ugin's blessing in the Blind Eternities has its own music.
  if(q('.screen.blind-eternities, [data-scene="blind-eternities"]'))return ['eternities','MUS-PW-13'];
  // Fights have a track per act: MUS-PW-05/06/10 for Innistrad, -2 Zendikar, -3 Ravnica.
  const A=act>1?'-'+Math.min(3,act):'';
  if(q('section.battle[data-dungeon]'))return ['dungeon','MUS-PW-06'+A];
  // Every boss has a theme of its own, found by the boss's name on its card (or data-boss on the battle).
  const bu=q('section.battle .unit.boss'),bn=(q('section.battle[data-boss]')?.dataset.boss||bu?.dataset.n||'');
  const bt=bu&&BOSS_THEMES.find(([re])=>re.test(bn));if(bt)return ['boss','MUS-BOSS-'+bt[1]];
  if(q('section.battle'))return q('section.battle .unit.boss')?['boss','MUS-PW-10'+A]:q('section.battle .unit.elite')?['elite','MUS-PW-06'+A]:['battle','MUS-PW-05'+A];
  if(q('section.map')||q('.screen.actstart')||q('.screen.bosspick'))return ['map',['MUS-PW-02','MUS-PW-03','MUS-PW-04'][Math.min(2,act-1)]];
  if(q('section.screen.ante'))return ['ante',''];
  if(q('.screen.shop'))return ['shop','MUS-PW-07'];
  if(q('.screen.bonfire'))return ['rest','MUS-PW-08'];
  if(q('.screen.event')||q('.screen.treasure'))return ['event','MUS-PW-09'];
  const sec=q('section.screen'),h=sec?.querySelector('h2')?.textContent||'';
  if(sec&&sec.querySelector('[data-act="replay"]'))return /^You cleared/.test(sec.querySelector('p')?.textContent||'')?['won','MUS-PW-11']:['lost','MUS-PW-12'];
  if(/defeated$/.test(h))return ['reward',''];
  return [screen,''];
 };
 const STING={ante:'PW-012',boss:'PW-011',elite:'PW-010',battle:'PW-009',won:'PW-030',lost:'PW-031',shop:'PW-019',event:'PW-027',heroes:''};
 const look=()=>{
  const [next,track]=read(),q=s=>app.querySelector(s);
  const dg=q('section.battle[data-dungeon]');if(dg)lastDungeon=dg.dataset.dungeon;
  // The ante settles after the fight: the wager paid off, or the staked card burned.
  const ar=q('.ante-result');if(ar&&!told.has(ar)){told.add(ar);if(ar.dataset.r==='won')sfx('PW-015');else sfx('RAV-005',{delay:900});}
  if(next!==screen){const was=screen;screen=next;
   if(STING[next])sfx(STING[next]);
   if(next==='dungeon'&&was!=='dungeon'){sfx('RAV-001');if(q('section.battle[data-dungeon=vaults]'))sfx('RAV-002',{delay:500});}
   if(next==='reward'&&was==='dungeon'&&lastDungeon==='vaults')sfx('RAV-003',{delay:300});
   if(next==='reward'&&/^(battle|elite|boss|dungeon)$/.test(was))sfx(was==='boss'?'PW-029':'PW-014');
   if(next==='map'&&was&&was!=='map')sfx('PW-005',{volume:.7});
   if(next==='reward'&&q('.card[data-sig]'))sfx('RAV-006',{delay:450});
   if(/^(battle|elite|boss|dungeon)$/.test(next))preload(['PWB-003','PWB-017','PWB-001','CMB-004','CMB-005','PWB-018']);
   if(track)setMusic('app',track,{loop:!/^(won|lost)$/.test(next)});
   else if(next==='reward')setMusic('app','MUS-PW-09');}
  // In a fight: big hits shake the board, a new floating number is a hit landing.
  if(app.querySelector('.battle.quake2'))sfx('CMB-010',{gap:300});
  const n=app.querySelectorAll('.pop').length;if(n>pops)sfx(app.querySelector('.pop.big')?'CMB-005':'CMB-004',{volume:.7,gap:120});pops=n;
 };
 new MutationObserver(look).observe(app,{childList:true});look();
}
