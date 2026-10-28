// Match table sound: compares each accepted Forge board with the one before and plays the sound bible's
// cues for what changed (draws, lands, casts, arrivals, combat, deaths, life, turns, the result), and
// picks the table music for the state of the game. Forge stays the authority: this only listens.
import {sfx,setMusic,preload} from './audio.js';

const onField=c=>c.zone==='Battlefield';
const has=(c,t)=>!!c?.types?.includes(t)||new RegExp(`\\b${t}\\b`).test(c?.type||'');
const counters=c=>Object.values(c?.counters||{}).reduce((n,v)=>n+(Number(v?.count??v)||0),0);
const WARM=['CARD-001','CARD-005','CARD-006','CARD-008','CARD-010','CMB-002','CMB-003','CMB-004','CMB-005','CMB-009','TT-001','TT-002'];

export function createTableAudio(root=null){
 let warmed=false,lowSeen=false,ended=false,watch=0;
 // The table's music lasts only while the table is on screen: once the match is over and the table
 // closes, hides, or you go to another screen, it stops, whether or not destroy() is called.
 const onTable=()=>{const el=root||document.querySelector('.play-match-table');return !!el?.isConnected&&el.getClientRects().length>0&&(!document.body.dataset.view||document.body.dataset.view==='play');};
 const stop=()=>{clearInterval(watch);watch=0;setMusic('play',null);};
 const guard=()=>{if(!watch)watch=setInterval(()=>{if(!onTable())stop();},800);};
 // Several sounds from one update are spaced a little so they read as a sequence, not a chord.
 let slot=0;const play=(id,o={})=>{sfx(id,{...o,delay:(o.delay||0)+slot++*70});};
 function update(prev,next){
  const b=next?.status?.surface;if(!b)return;guard();
  if(!warmed){warmed=true;preload(WARM);}
  slot=0;
  const terminal=next.status?.terminal;
  if(terminal){if(!ended){ended=true;const w=terminal.winner,won=w===b.seat,draw=w===null||w===undefined;
   play(draw?'QP-019':won?'QP-017':'QP-018');setMusic('play',draw?'MUS-TBL-08':won?'MUS-TBL-06':'MUS-TBL-07',{loop:draw,then:'MUS-TBL-08'});}return;}
  music(b);
  const a=prev?.status?.surface;if(!a)return;
  const was=new Map(a.cards.map(c=>[c.id,c]));
  // Turn and phase.
  if(b.activeSeat!==a.activeSeat&&b.turn>0)play(b.activeSeat===b.seat?'TT-001':'TT-002');
  else if(b.phase!==a.phase&&b.turn>0)play('TT-003',{volume:.35});
  // Draws: an opening hand or mulligan is a deal; one card is a draw.
  const mine=b.cards.filter(c=>c.zone==='Hand'&&c.controller===b.seat&&was.get(c.id)?.zone!=='Hand');
  if(mine.length>=5)for(let i=0;i<Math.min(7,mine.length);i++)sfx('QP-012',{delay:i*70,gap:0,volume:.8});
  else if(mine.length)play('CARD-001');
  const theirs=b.players.find(p=>p.seat!==b.seat),before=a.players.find(p=>p.seat===theirs?.seat);
  if(theirs&&before&&theirs.handCount>before.handCount&&b.turn>0)play('CARD-002',{volume:.5});
  // Mana: one tap sound per update however many lands paid.
  if(b.cards.some(c=>onField(c)&&c.tapped&&was.get(c.id)?.zone==='Battlefield'&&!was.get(c.id)?.tapped&&!c.attacking&&has(c,'Land')))play('CARD-006',{volume:.7});
  // The stack: something new is a cast (yours) or a trigger/ability.
  const old=new Set((a.stack||[]).map(x=>x.id)),fresh=(b.stack||[]).filter(x=>!old.has(x.id));
  if(fresh.length){const src=fresh.map(x=>b.cards.find(c=>c.id===x.source)).find(Boolean);play(src&&was.get(src.id)?.zone==='Hand'?'CARD-008':'CARD-014');}
  // Arrivals.
  const arrived=b.cards.filter(c=>onField(c)&&was.get(c.id)?.zone!=='Battlefield');
  if(arrived.some(c=>has(c,'Land')))play('CARD-005');
  if(arrived.some(c=>!has(c,'Land')&&!was.has(c.id)))play('CARD-025');
  else if(arrived.some(c=>!has(c,'Land')))play('CARD-010');
  if(b.cards.some(c=>onField(c)&&Number.isSafeInteger(c.attachedTo)&&was.get(c.id)?.attachedTo!==c.attachedTo))play('CARD-028');
  if(b.cards.some(c=>onField(c)&&was.get(c.id)?.zone==='Battlefield'&&counters(c)>counters(was.get(c.id))))play('CARD-027',{volume:.7});
  // Combat.
  if(b.cards.some(c=>onField(c)&&c.attacking&&!was.get(c.id)?.attacking))play('CMB-002');
  if(b.cards.some(c=>onField(c)&&(c.blockingIds?.length||0)>(was.get(c.id)?.blockingIds?.length||0)))play('CMB-003');
  if(b.cards.some(c=>onField(c)&&(c.damage||0)>(was.get(c.id)?.damage||0)))play('CMB-004');
  const combat=/Damage$/.test(String(b.phase||''))||/Damage$/.test(String(a.phase||''));
  for(const p of b.players){const q=a.players.find(x=>x.seat===p.seat);if(!q)continue;
   if(p.life<q.life)play(combat?'CMB-005':'CMB-018',{volume:q.life-p.life>=5?1:.8});
   else if(p.life>q.life)play('CMB-007');}
  // Leaving the battlefield: a death shatters; exile and bounce have their own.
  const left=a.cards.filter(c=>onField(c)).map(c=>[c,b.cards.find(x=>x.id===c.id)]).filter(([,n])=>!n||!onField(n));
  if(left.some(([c,n])=>(!n||n.zone==='Graveyard')&&has(c,'Creature')))play('CMB-009');
  else if(left.some(([,n])=>n?.zone==='Graveyard'))play('CARD-018');
  if(left.some(([,n])=>n?.zone==='Exile'))play('CARD-019');
  if(left.some(([,n])=>n?.zone==='Hand'))play('CARD-020');
  // Low life: once per match when anyone first drops to 5 or less.
  if(!lowSeen&&b.players.some(p=>p.life<=5&&p.life>0)){lowSeen=true;play('CMB-019');}
 }
 // Early turns, then the fuller table, then the low-life track once anyone is close to losing.
 function music(b){setMusic('play',b.players.some(p=>p.life<=5)?'MUS-TBL-05':(b.turn||0)<=8?'MUS-TBL-03':'MUS-TBL-04');}
 return {update,destroy:stop};
}
