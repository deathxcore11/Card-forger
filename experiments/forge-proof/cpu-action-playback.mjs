// Presentation only. Newer bridges publish an ordered, viewer-safe event log with each snapshot,
// and the CPU's play is told from it in the order Forge accepted it: the land, the spell and its
// targets, the resolution, the attack, the blocks, the damage, what died. When the log is missing
// or has a gap since the last board shown, order comes from the two snapshots instead; those
// arrivals are labelled "played", not "cast", and no hidden identities are reconstructed.
// Playback never stands between the player and a decision: the board that asks is shown at once
// and the story of how it got there plays over it without blocking a command.
export function createPlaybackSession(authority,{displayed,busy}){
 const commands=new Set(['nativeSelect','nativeButton','selectPrompt','confirmPrompt','clearPrompt','rememberPrompt','reorderPrompt','replyValue','setControlMode','setPhaseStop','yieldSource','concede']);
 return new Proxy(authority,{get(target,key){
  if(key==='snapshot')return()=>({...displayed(),busy:busy()||displayed()?.busy});
  const value=target[key];
  if(commands.has(key)&&typeof value==='function')return(...args)=>{
   if(busy()||displayed()?.status?.revision!==authority.snapshot().status?.revision)throw Error('MATCH_NOT_READY');
   return value(...args);
  };
  return value;
 }});
}

// The engine is waiting on the player: a prompt, or a stop Forge handed to the viewer.
export function isPlayerDecision(s){
 const n=s?.native,surface=s?.status?.surface;
 if(!n||!surface||s.status.terminal||s.status.failure||s.transportError||n.status==='failed')return false;
 if(n.prompt)return true;
 return surface.awaitingHuman===true&&n.busy!==true&&!!n.inputType;
}

const EVENTS_SCHEMA='cardstashy.forge-events.v1';
const eventLog=s=>{const e=s?.native?.events;return e?.schema===EVENTS_SCHEMA&&Number.isSafeInteger(e.latest)&&Array.isArray(e.items)?e:null;};
// The events after the last board shown, in order, or null when the log cannot vouch for all of
// them (no log, a new match, or items that fell out of the 96-item window).
export function eventsSince(before,after){
 const a=eventLog(before),b=eventLog(after);if(!a||!b||b.latest<a.latest)return null;
 if(b.latest===a.latest)return [];
 const items=b.items.filter(x=>Number.isSafeInteger(x?.seq)&&x.seq>a.latest).sort((x,y)=>x.seq-y.seq);
 if(!items.length||items[0].seq!==a.latest+1||items.at(-1).seq!==b.latest)return null;
 for(let i=1;i<items.length;i++)if(items[i].seq!==items[i-1].seq+1)return null;
 return items;
}
const refs=list=>(Array.isArray(list)?list:[]).filter(t=>t&&['card','player'].includes(t.kind)&&Number.isSafeInteger(t.id)).map(t=>({kind:t.kind,id:t.id}));
const count=(n,word,many=word+'s')=>`${n} ${n===1?word:many}`;
const list=items=>items.length<3?items.join(' and '):`${items.slice(0,-1).join(', ')} and ${items.at(-1)}`;

// One beat per public step of the story, each with a plain sentence for the activity log.
// Runs of the same thing (combat damage, creatures dying, tokens arriving, triggers) become one
// beat, so a swarm of Goblins is one arrival rather than a dozen ceremonies.
export function eventPlaybackBeats(before,after){
 const b=after?.status?.surface;
 if(!b||after.status.terminal||after.status.failure)return [];
 const events=eventsSince(before,after);if(events===null)return null;
 const cpuSeat=b.players.find(p=>p.seat!==b.seat),cpu=cpuSeat?.nativeId,me=b.players.find(p=>p.seat===b.seat)?.nativeId;
 if(cpu===undefined)return [];
 const now=new Map(b.cards.map(c=>[c.id,c])),was=new Map((before?.status?.surface?.cards||[]).map(c=>[c.id,c]));
 // The board's own copy of a card when it can be seen; otherwise the name the log gave it.
 const cardFor=ref=>{
  if(ref?.kind!=='card'||!Number.isSafeInteger(ref.id))return null;
  const c=now.get(ref.id)?.known?now.get(ref.id):was.get(ref.id)?.known?was.get(ref.id):null;if(c)return c;
  return typeof ref.name==='string'&&ref.name?{id:ref.id,name:ref.name,known:true,types:[],type:'',text:''}:null;
 };
 const who=id=>id===cpu?'CPU':id===me?'You':null;
 const nameOf=ref=>ref?.kind==='player'?(ref.id===me?'you':ref.id===cpu?'the CPU':null):cardFor(ref)?.name||null;
 // Spells the CPU has on the stack: ones already there, and ones cast in this batch.
 const cpuSources=new Set((before?.status?.surface?.stack||[]).filter(s=>s.controller===cpuSeat.seat&&Number.isSafeInteger(s.source)).map(s=>s.source));
 const beats=[],shown=new Set();
 const push=(e,beat)=>beats.push({seq:e.seq,targets:[],text:'',...beat});
 for(let i=0;i<events.length;i++){
  const e=events[i];
  const run=test=>{const out=[e];while(i+1<events.length&&test(events[i+1]))out.push(events[++i]);return out;};
  if(e.type==='turn'){push(e,{kind:'phase',tone:'turn',label:e.player===cpu?'OPPONENT’S TURN':'YOUR TURN',line:e.player===cpu?`CPU's turn ${e.number??''}`.trim()+'.':'Your turn.',duration:600});continue;}
  if(e.type==='land'&&e.player===cpu){
   // A land never gets a spell's spotlight: it settles into its row when the board updates,
   // and the log says so. A zero-length beat keeps its place in the order without holding.
   const card=cardFor(e.card);if(!card)continue;shown.add(card.id);
   push(e,{kind:'log',label:'',line:`CPU played ${card.name}.`,duration:0});continue;
  }
  if((e.type==='cast'||e.type==='ability')&&e.player===cpu){
   const card=cardFor(e.source);if(!card)continue;shown.add(card.id);cpuSources.add(card.id);
   const targets=refs(e.targets),named=targets.map(nameOf).filter(Boolean),item=after.native?.stack?.find(s=>s.id===e.stackId);
   const verb=e.type==='cast'?'cast':`activated`;
   push(e,{kind:'spell',label:e.type==='cast'?'CPU · CASTS':'CPU · ACTIVATES',card,stackId:e.stackId,targets,
    text:e.type==='cast'?card.text||'':item?.text||'',line:`CPU ${verb} ${card.name}${e.type==='ability'?'’s ability':''}${named.length?` targeting ${list(named)}`:''}.`,duration:named.length?1300:1100});
   continue;
  }
  if(e.type==='trigger'&&e.player===cpu){
   const all=run(x=>x.type==='trigger'&&x.player===cpu),names=[...new Set(all.map(x=>cardFor(x.source)?.name).filter(Boolean))];
   if(!names.length)continue;for(const x of all){const c=cardFor(x.source);if(c)cpuSources.add(c.id);}
   const card=all.length===1?cardFor(e.source):null,targets=all.length===1?refs(e.targets):[];
   push(e,card?{kind:'spell',label:'CPU · TRIGGER',card,targets,text:after.native?.stack?.find(s=>s.id===e.stackId)?.text||'',line:`${card.name} triggered.`,duration:800}
    :{kind:'phase',tone:'trigger',label:`${count(all.length,'CPU TRIGGER')}`.toUpperCase(),line:`${list(names)} triggered.`,duration:700});
   continue;
  }
  if(e.type==='resolve'){
   const card=cardFor(e.source);if(!card||!cpuSources.has(card.id))continue;
   push(e,{kind:'resolve',label:e.fizzled?'CPU · NO LEGAL TARGETS':'CPU · RESOLVES',card,text:'',line:e.fizzled?`${card.name} had no legal targets left, so it didn't resolve.`:`${card.name} resolved.`,duration:e.fizzled?800:550});
   continue;
  }
  if(e.type==='attack'&&e.player===cpu){
   const attackers=(Array.isArray(e.attackers)?e.attackers:[]).filter(a=>Number.isSafeInteger(a?.id));if(!attackers.length)continue;
   const names=attackers.map(a=>cardFor(a)?.name).filter(Boolean);
   push(e,{kind:'phase',tone:'attack',label:`CPU ATTACKS WITH ${count(attackers.length,'CREATURE')}`.toUpperCase(),line:`CPU attacked with ${list(names.length?names:[count(attackers.length,'creature')])}.`,duration:900});
   continue;
  }
  if(e.type==='block'&&e.player===cpu){
   const blockers=(Array.isArray(e.blockers)?e.blockers:[]).filter(x=>Number.isSafeInteger(x?.id));if(!blockers.length)continue;
   const pairs=blockers.map(x=>{const a=cardFor({kind:'card',id:x.blocking}),c=cardFor(x);return c&&a?`${c.name} blocks ${a.name}`:null;}).filter(Boolean);
   push(e,{kind:'phase',tone:'block',label:`CPU BLOCKS WITH ${count(blockers.length,'CREATURE')}`.toUpperCase(),line:pairs.length?list(pairs)+'.':`CPU blocked with ${count(blockers.length,'creature')}.`,duration:800});
   continue;
  }
  if(e.type==='damage'){
   const all=run(x=>x.type==='damage');
   const toYou=all.filter(x=>x.target?.kind==='player'&&x.target.id===me).reduce((t,x)=>t+(x.amount||0),0);
   const toCpu=all.filter(x=>x.target?.kind==='player'&&x.target.id===cpu).reduce((t,x)=>t+(x.amount||0),0);
   const creatures=new Set(all.filter(x=>x.target?.kind==='card').map(x=>x.target.id)).size;
   const parts=[toYou&&`you take ${toYou}`,toCpu&&`CPU takes ${toCpu}`,creatures&&`${count(creatures,'creature')} damaged`].filter(Boolean);
   if(!parts.length)continue;
   const combat=all.some(x=>x.combat===true||x.kind==='Combat');
   push(e,{kind:'phase',tone:'damage',label:(combat?'COMBAT DAMAGE · ':'DAMAGE · ')+parts.join(' · ').toUpperCase(),line:`${combat?'Combat damage':'Damage'}: ${parts.join(', ')}.`,duration:900});
   continue;
  }
  if(e.type==='zone'&&e.from==='Battlefield'&&e.to==='Graveyard'&&e.token!==true){
   const all=run(x=>x.type==='zone'&&x.from==='Battlefield'&&x.to==='Graveyard'&&x.token!==true),cards=all.map(x=>cardFor(x.card)).filter(Boolean);
   if(!cards.length)continue;
   const label=cards.length===1?'TO THE GRAVEYARD':`${cards.length} PERMANENTS TO THE GRAVEYARD`;
   push(e,cards.length===1?{kind:'arrival',label,card:cards[0],text:'',line:`${cards[0].name} went to the graveyard.`,duration:700}:{kind:'phase',tone:'death',label,line:`${list(cards.map(c=>c.name))} went to the graveyard.`,duration:800});
   continue;
  }
  // Tokens arrive as one group per run, whoever made them: "CPU · 12 GOBLIN TOKENS" (a "Treasure Token" name is not doubled).
  if(e.type==='zone'&&e.to==='Battlefield'&&e.token===true){
   const all=run(x=>x.type==='zone'&&x.to==='Battlefield'&&x.token===true&&x.player===e.player),names=[...new Set(all.map(x=>cardFor(x.card)?.name).filter(Boolean))];
   const actor=who(e.player);if(!actor||actor==='You')continue;
   const what=names.length===1?`${count(all.length,/\btoken$/i.test(names[0])?names[0]:names[0]+' token')}`:count(all.length,'token');
   push(e,{kind:'phase',tone:'tokens',label:`${actor} · ${what}`.toUpperCase(),line:`${actor} created ${what}.`,duration:all.length>1?900:700});
   continue;
  }
  // A permanent put onto the battlefield some other way (not cast, not a token) gets a short beat.
  if(e.type==='zone'&&e.to==='Battlefield'&&e.from!=='Stack'&&e.player===cpu){
   const card=cardFor(e.card);if(!card||shown.has(card.id)||card.isToken)continue;
   shown.add(card.id);push(e,{kind:'arrival',label:'CPU · ENTERED BATTLEFIELD',card,text:card.text||'',line:`${card.name} entered the battlefield under the CPU's control.`,duration:850});
  }
 }
 // Only the latest turn change is worth a banner; earlier ones would only flash past. Your own
 // turn starting is announced by the table already unless the CPU did something first.
 const lastTurn=beats.findLastIndex(x=>x.tone==='turn');
 const kept=beats.filter((x,i)=>x.tone!=='turn'||i===lastTurn);
 const shownBeats=kept.filter(x=>x.kind!=='log');
 return paced(shownBeats.length===1&&shownBeats[0].label==='YOUR TURN'?kept.filter(x=>x.kind==='log'):kept.slice(-12));
}
// One update never plays for more than about 3.6 s; longer runs speed up evenly.
function paced(beats,budget=3600){
 const total=beats.reduce((t,x)=>t+x.duration,0),scale=total>budget?budget/total:1;
 return scale<1?beats.map(x=>x.kind==='log'?x:{...x,duration:Math.max(350,Math.round(x.duration*scale))}):beats;
}
const onScreen=beats=>beats.filter(b=>b.kind!=='log');
// The event log when it covers everything since the last board, the snapshot difference otherwise.
export function playbackBeats(before,after){return eventPlaybackBeats(before,after)??cpuPlaybackBeats(before,after);}

export function cpuPlaybackBeats(before, after) {
 const a=before?.status?.surface,b=after?.status?.surface;
 if(!a||!b||after.status.terminal||after.status.failure)return [];
 const cpu=b.players.find(p=>p.seat!==b.seat)?.seat;if(cpu===undefined)return [];
 const oldCards=new Map(a.cards.map(c=>[c.id,c])),oldStack=new Set(a.stack.map(s=>s.id));
 const beats=[],turn=a.activeSeat!==b.activeSeat||a.turn!==b.turn;
 const phase=!turn&&a.phase!==b.phase&&['BeginningOfCombat','DeclareAttackers'].includes(b.phase)&&!['BeginningOfCombat','DeclareAttackers'].includes(a.phase);
 const banner=turn?{kind:'phase',label:b.activeSeat===b.seat?'YOUR TURN':"OPPONENT’S TURN",line:b.activeSeat===b.seat?'Your turn.':"CPU's turn.",duration:600}:phase?{kind:'phase',label:'COMBAT',line:'Combat.',duration:600}:null;
 if(banner&&b.activeSeat!==b.seat)beats.push(banner);
 const shown=new Set();
 for(const item of b.stack){
  if(item.controller!==cpu||oldStack.has(item.id))continue;
  const card=b.cards.find(c=>c.id===item.source&&c.known);if(!card)continue;
  const nativeItem=after.native?.stack?.find(s=>s.id===item.id);
  beats.push({kind:'spell',label:'CPU · SPELL / ABILITY',card,stackId:item.id,text:item.text||card.text||'',targets:(nativeItem?.targets||[]).filter(t=>t&&['card','player'].includes(t.kind)&&Number.isSafeInteger(t.id)),line:`CPU put ${card.name} on the stack.`,duration:1100});shown.add(card.id);
 }
 // Lands and new permanents get a beat each, but tokens arrive with the board, and at most
 // three arrivals are shown: a token swarm never holds the table.
 let arrivals=0;
 for(const card of b.cards){
  if(!card.known||card.isToken||card.controller!==cpu||card.zone!=='Battlefield'||oldCards.get(card.id)?.zone==='Battlefield'||shown.has(card.id)||arrivals>=3)continue;
  // A source that was on the preceding stack has already had its spotlight.
  if(a.stack.some(s=>s.source===card.id))continue;
  const land=card.types?.includes('Land')||/\bLand\b/.test(card.type||'');
  arrivals++;beats.push({kind:land?'land':'arrival',label:land?'CPU · LAND PLAYED':'CPU · ENTERED BATTLEFIELD',card,text:card.text||'',targets:[],line:`${card.name} is now on the CPU's battlefield.`,duration:land?700:850});
 }
 if(banner&&b.activeSeat===b.seat)beats.push(banner);
 return paced(beats,2600);
}

// What the table is doing right now, in words a player can trust. Only the accepted state and
// the playback in progress decide it: "Your decision" only when Forge is waiting on the viewer,
// "CPU thinking" only when the CPU holds the turn or priority and Forge is still working.
export function tableActivity(s,{beat=null,overlay=false,recent=[]}={}){
 const n=s?.native,surface=s?.status?.surface,detail=recent.at(-1)||'';
 if(!surface||s.status.terminal)return null;
 if(s.transportError)return {kind:'connection',label:'Waiting for connection',detail:''};
 if(s.status.failure||n?.status==='failed')return {kind:'stopped',label:'Match stopped',detail:''};
 if(beat&&!overlay)return {kind:'replay',label:beat.label?.startsWith('YOUR')?'Your turn':'CPU’s play',detail:beat.line||''};
 if(isPlayerDecision(s)){
  const top=n?.stack?.[0],cpuTop=top&&top.activatingPlayer!==n.viewer;
  const what=n?.prompt?'Choose':{InputConfirmMulligan:'Keep or mulligan',InputAttack:'Declare attackers',InputBlock:'Declare blockers',InputPayMana:'Pay the cost',InputSelectTargets:'Choose targets'}[n?.inputType]
   ||(cpuTop?'Respond or pass':surface.activeSeat===surface.seat?'Your turn':'Respond or pass');
  return {kind:'decision',label:`Your decision · ${what}`,detail:beat?.line||detail};
 }
 const cpuPriority=surface.prioritySeat!=null&&surface.prioritySeat!==surface.seat;
 if(n?.stack?.length&&!cpuPriority)return {kind:'resolving',label:'Resolving effects',detail};
 return cpuPriority||surface.activeSeat!==surface.seat?{kind:'thinking',label:'CPU thinking',detail}:{kind:'working',label:'Forge is applying your play',detail};
}

export class CpuActionPlaybackQueue {
 constructor({present,beat=()=>{},clear=()=>{},reducedMotion=()=>false,speed=()=>1,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){Object.assign(this,{present,beat,clear,reducedMotion,speed,schedule,cancel});this.current=null;this.latest=null;this.pending=[];this.timer=null;this.running=false;this.overlay=false;this.closed=false;this.recent=[];this.seenSeq=-1;this.loggedSeq=-1;}
 // Overlay playback runs over a board that already asks the player something; it never blocks.
 get busy(){return this.running&&!this.overlay||this.pending.length>0;}
 // The last dozen things that happened, in plain sentences, for the activity line.
 remember(beats){
  for(const b of beats){
   if(Number.isSafeInteger(b.seq)){if(b.seq<=this.loggedSeq)continue;this.loggedSeq=b.seq;}
   if(b.line&&b.line!==this.recent.at(-1))this.recent.push(b.line);
  }
  this.recent=this.recent.slice(-12);
 }
 push(snapshot){
  if(this.closed)return;this.latest=snapshot;
  if(!this.current||!snapshot?.status||snapshot.status.terminal||snapshot.status.failure||snapshot.transportError){this.flush(snapshot);return;}
  if(this.overlay&&snapshot.status.revision===this.current.status?.revision){this.current=snapshot;this.present(snapshot,false);return;}
  if(this.overlay)this.stop();
  if(isPlayerDecision(snapshot)){this.yieldTo(snapshot);return;}
  if(snapshot.status.revision===this.current.status?.revision&&!this.running){this.current=snapshot;this.present(snapshot,false);return;}
  const tail=this.pending.at(-1);
  if(tail?.status?.revision===snapshot.status.revision)this.pending[this.pending.length-1]=snapshot;
  else if(this.pending.length>=8)this.pending[this.pending.length-1]=snapshot;
  else this.pending.push(snapshot);
  this.advance();
 }
 // A real decision arrived: show its board now, unlocked, and tell what led to it over the top.
 // The log covers everything since the board shown last, so beats already seen are dropped.
 yieldTo(snapshot){
  const all=playbackBeats(this.current,snapshot),beats=onScreen(all).filter(b=>!(Number.isSafeInteger(b.seq)&&b.seq<=this.seenSeq));
  this.stop();this.pending=[];this.current=snapshot;this.remember(all);this.present(snapshot,false);
  if(beats.length)this.play(beats.map(b=>({...b,duration:Math.max(350,Math.round(b.duration*.7))})),snapshot,true);
 }
 advance(){
  if(this.closed||this.running)return;
  const next=this.pending.shift();if(!next)return;
  const all=playbackBeats(this.current,next),beats=onScreen(all);this.remember(all);
  if(!beats.length){this.current=next;this.present(next,this.pending.length>0);this.advance();return;}
  this.present(this.current,true);this.play(beats,next,false);
 }
 play(beats,next,overlay){
  this.running=true;this.overlay=overlay;let index=0;
  const step=()=>{
   if(this.closed)return;this.clear();
   const beat=beats[index++];
   if(!beat){
    this.timer=null;this.running=false;this.overlay=false;
    if(!overlay){this.current=next;this.present(next,this.pending.length>0);this.advance();}
    return;
   }
   if(Number.isSafeInteger(beat.seq))this.seenSeq=Math.max(this.seenSeq,beat.seq);
   this.beat(beat,next);// speed() is read per beat, so switching to Fast also hurries the beats already queued.
   this.timer=this.schedule(step,this.reducedMotion()?250:Math.max(180,Math.round((this.pending.length?beat.duration/2:beat.duration)*this.speed())));
  };step();
 }
 stop(){this.cancel(this.timer);this.timer=null;this.running=false;this.overlay=false;this.clear();}
 flush(snapshot=this.latest){
  // Skipped beats still reach the activity log, so a skip never hides what happened.
  if(snapshot&&this.current&&snapshot!==this.current)this.remember(playbackBeats(this.current,snapshot));
  this.stop();this.pending=[];this.current=snapshot;if(snapshot)this.present(snapshot,false);
 }
 destroy(){this.closed=true;this.cancel(this.timer);this.timer=null;this.pending=[];this.current=null;this.latest=null;this.running=false;this.overlay=false;this.clear();}
}
