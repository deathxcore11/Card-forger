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
 // Every opponent is a CPU; in a Commander pod each one is told by name (its commander).
 const rivals=b.players.filter(p=>p.seat!==b.seat),pod=rivals.length>1,me=b.players.find(p=>p.seat===b.seat)?.nativeId;
 if(!rivals.length)return [];
 const rival=id=>rivals.find(p=>p.nativeId===id),isCpu=id=>!!rival(id),cpuName=id=>rival(id)?.label||'CPU',CPU=id=>cpuName(id).toUpperCase();
 const now=new Map(b.cards.map(c=>[c.id,c])),was=new Map((before?.status?.surface?.cards||[]).map(c=>[c.id,c]));
 // The board's own copy of a card when it can be seen; otherwise the name the log gave it.
 const cardFor=ref=>{
  if(ref?.kind!=='card'||!Number.isSafeInteger(ref.id))return null;
  const c=now.get(ref.id)?.known?now.get(ref.id):was.get(ref.id)?.known?was.get(ref.id):null;if(c)return c;
  return typeof ref.name==='string'&&ref.name?{id:ref.id,name:ref.name,known:true,types:[],type:'',text:''}:null;
 };
 const who=id=>isCpu(id)?cpuName(id):id===me?'You':null;
 const nameOf=ref=>ref?.kind==='player'?(ref.id===me?'you':isCpu(ref.id)?(pod?cpuName(ref.id):'the CPU'):null):cardFor(ref)?.name||null;
 // Spells the CPU has on the stack: ones already there, and ones cast in this batch.
 const cpuSources=new Set((before?.status?.surface?.stack||[]).filter(s=>s.controller!==b.seat&&Number.isSafeInteger(s.source)).map(s=>s.source));
 const beats=[],shown=new Set();
 const push=(e,beat)=>beats.push({seq:e.seq,targets:[],text:'',...(isCpu(e.player)?{actor:cpuName(e.player)}:{}),...beat});
 for(let i=0;i<events.length;i++){
  const e=events[i];
  const run=test=>{const out=[e];while(i+1<events.length&&test(events[i+1]))out.push(events[++i]);return out;};
  if(e.type==='turn'){const turnSeat=isCpu(e.player)?rival(e.player)?.seat:b.seat;push(e,{kind:'phase',tone:'turn',...(Number.isSafeInteger(turnSeat)?{seat:turnSeat}:{}),label:isCpu(e.player)?(pod?`${CPU(e.player)}’S TURN`:'OPPONENT’S TURN'):'YOUR TURN',line:isCpu(e.player)?`${cpuName(e.player)}'s turn ${e.number??''}`.trim()+'.':'Your turn.',duration:600});continue;}
  if(e.type==='land'&&isCpu(e.player)){
   // A land never gets a spell's spotlight, but it gets its own beat, as on Arena: it drops into
   // its row on its own before anything else happens, so the play can be followed.
   const card=cardFor(e.card);if(!card)continue;shown.add(card.id);
   push(e,{kind:'land',label:`${CPU(e.player)} · LAND`,card,reveal:[card.id],hand:e.player,line:`${cpuName(e.player)} played ${card.name}.`,duration:600});continue;
  }
  if((e.type==='cast'||e.type==='ability')&&isCpu(e.player)){
   const card=cardFor(e.source);if(!card)continue;shown.add(card.id);cpuSources.add(card.id);
   const targets=refs(e.targets),named=targets.map(nameOf).filter(Boolean),item=after.native?.stack?.find(s=>s.id===e.stackId);
   const verb=e.type==='cast'?'cast':`activated`;
   push(e,{kind:'spell',label:`${CPU(e.player)} · ${e.type==='cast'?'CASTS':'ACTIVATES'}`,card,stackId:e.stackId,targets,reveal:[card.id],mana:e.player,...(e.type==='cast'?{hand:e.player}:{}),
    text:e.type==='cast'?card.text||'':item?.text||'',line:`${cpuName(e.player)} ${verb} ${card.name}${e.type==='ability'?'’s ability':''}${named.length?` targeting ${list(named)}`:''}.`,duration:named.length?SPOT+400:SPOT});
   continue;
  }
  if(e.type==='trigger'&&isCpu(e.player)){
   const all=run(x=>x.type==='trigger'&&x.player===e.player),names=[...new Set(all.map(x=>cardFor(x.source)?.name).filter(Boolean))];
   if(!names.length)continue;for(const x of all){const c=cardFor(x.source);if(c)cpuSources.add(c.id);}
   const card=all.length===1?cardFor(e.source):null,targets=all.length===1?refs(e.targets):[];
   push(e,card?{kind:'spell',label:`${CPU(e.player)} · TRIGGER`,card,targets,text:after.native?.stack?.find(s=>s.id===e.stackId)?.text||'',line:`${card.name} triggered.`,duration:SPOT-600}
    :{kind:'phase',tone:'trigger',label:`${count(all.length,CPU(e.player)+' TRIGGER')}`.toUpperCase(),line:`${list(names)} triggered.`,duration:1200});
   continue;
  }
  if(e.type==='resolve'){
   const card=cardFor(e.source);if(!card||!cpuSources.has(card.id))continue;
   push(e,{kind:'resolve',label:`${pod?'':'CPU · '}${e.fizzled?'NO LEGAL TARGETS':'RESOLVES'}`,card,text:'',reveal:[card.id],line:e.fizzled?`${card.name} had no legal targets left, so it didn't resolve.`:`${card.name} resolved.`,duration:e.fizzled?1400:700});
   continue;
  }
  if(e.type==='attack'&&isCpu(e.player)){
   const attackers=(Array.isArray(e.attackers)?e.attackers:[]).filter(a=>Number.isSafeInteger(a?.id));if(!attackers.length)continue;
   const names=attackers.map(a=>cardFor(a)?.name).filter(Boolean);
   // In a pod, say whom: "KRENKO ATTACKS YOU" / "Krenko attacked Giada with Goblin Guide".
   const hit=pod?[...new Set(attackers.map(a=>a.target?.kind==='player'?nameOf(a.target):null).filter(Boolean))]:[];
   push(e,{kind:'phase',tone:'attack',attackers:attackers.map(a=>cardFor({kind:'card',id:a.id})).filter(Boolean),hit,patch:Object.fromEntries(attackers.map(a=>[a.id,{attacking:true,tapped:now.get(a.id)?.tapped??true,...(a.target?{attackTarget:a.target}:{})}])),label:hit.length===1?`${CPU(e.player)} ATTACKS ${hit[0].toUpperCase()}`:`${CPU(e.player)} ATTACKS WITH ${count(attackers.length,'CREATURE')}`.toUpperCase(),line:`${cpuName(e.player)} attacked${hit.length?' '+list(hit):''} with ${list(names.length?names:[count(attackers.length,'creature')])}.`,duration:SPOT-200});
   continue;
  }
  if(e.type==='block'&&isCpu(e.player)){
   const blockers=(Array.isArray(e.blockers)?e.blockers:[]).filter(x=>Number.isSafeInteger(x?.id));if(!blockers.length)continue;
   const pairs=blockers.map(x=>{const a=cardFor({kind:'card',id:x.blocking}),c=cardFor(x);return c&&a?`${c.name} blocks ${a.name}`:null;}).filter(Boolean);
   push(e,{kind:'phase',tone:'block',patch:Object.fromEntries(blockers.filter(x=>now.has(x.id)).map(x=>[x.id,{blockingIds:now.get(x.id).blockingIds||[x.blocking]}])),label:`${CPU(e.player)} BLOCKS WITH ${count(blockers.length,'CREATURE')}`.toUpperCase(),line:pairs.length?list(pairs)+'.':`${cpuName(e.player)} blocked with ${count(blockers.length,'creature')}.`,duration:1500});
   continue;
  }
  if(e.type==='damage'){
   const all=run(x=>x.type==='damage');
   const toYou=all.filter(x=>x.target?.kind==='player'&&x.target.id===me).reduce((t,x)=>t+(x.amount||0),0);
   const toCpu=rivals.map(r=>[r.nativeId,all.filter(x=>x.target?.kind==='player'&&x.target.id===r.nativeId).reduce((t,x)=>t+(x.amount||0),0)]).filter(([,n])=>n);
   const creatures=new Set(all.filter(x=>x.target?.kind==='card').map(x=>x.target.id)).size;
   const parts=[toYou&&`you take ${toYou}`,...toCpu.map(([id,n])=>`${cpuName(id)} takes ${n}`),creatures&&`${count(creatures,'creature')} damaged`].filter(Boolean);
   if(!parts.length)continue;
   const combat=all.some(x=>x.combat===true||x.kind==='Combat');
   push(e,{kind:'phase',tone:'damage',combat,life:true,patch:Object.fromEntries(all.filter(x=>x.target?.kind==='card'&&now.has(x.target.id)).map(x=>[x.target.id,{damage:now.get(x.target.id).damage||0}])),label:(combat?'COMBAT DAMAGE · ':'DAMAGE · ')+parts.join(' · ').toUpperCase(),line:`${combat?'Combat damage':'Damage'}: ${parts.join(', ')}.`,duration:600});
   continue;
  }
  if(e.type==='zone'&&e.from==='Battlefield'&&e.to==='Graveyard'&&e.token!==true){
   const all=run(x=>x.type==='zone'&&x.from==='Battlefield'&&x.to==='Graveyard'&&x.token!==true),cards=all.map(x=>cardFor(x.card)).filter(Boolean);
   if(!cards.length)continue;
   const label=cards.length===1?'TO THE GRAVEYARD':`${cards.length} PERMANENTS TO THE GRAVEYARD`;
   const gone=cards.map(c=>c.id);
   push(e,cards.length===1?{kind:'arrival',label,card:cards[0],reveal:gone,text:'',line:`${cards[0].name} went to the graveyard.`,duration:700}:{kind:'phase',tone:'death',reveal:gone,label,line:`${list(cards.map(c=>c.name))} went to the graveyard.`,duration:800});
   continue;
  }
  // Tokens arrive as one group per run, whoever made them: "CPU · 12 GOBLIN TOKENS" (a "Treasure Token" name is not doubled).
  if(e.type==='zone'&&e.to==='Battlefield'&&e.token===true){
   const all=run(x=>x.type==='zone'&&x.to==='Battlefield'&&x.token===true&&x.player===e.player),names=[...new Set(all.map(x=>cardFor(x.card)?.name).filter(Boolean))];
   const actor=who(e.player);if(!actor||actor==='You')continue;
   const what=names.length===1?`${count(all.length,/\btoken$/i.test(names[0])?names[0]:names[0]+' token')}`:count(all.length,'token');
   push(e,{kind:'phase',tone:'tokens',reveal:all.map(x=>x.card?.id).filter(Number.isSafeInteger),label:`${actor} · ${what}`.toUpperCase(),line:`${actor} created ${what}.`,duration:all.length>1?900:700});
   continue;
  }
  // A permanent put onto the battlefield some other way (not cast, not a token) gets a short beat.
  if(e.type==='zone'&&e.to==='Battlefield'&&e.from!=='Stack'&&isCpu(e.player)){
   const card=cardFor(e.card);if(!card||shown.has(card.id)||card.isToken)continue;
   shown.add(card.id);push(e,{kind:'arrival',label:`${CPU(e.player)} · ENTERED BATTLEFIELD`,card,reveal:[card.id],text:card.text||'',line:`${card.name} entered the battlefield under ${pod?cpuName(e.player)+'\'s':'the CPU\'s'} control.`,duration:SPOT-600});
  }
 }
 settleReveals(beats,b,before?.status?.surface);
 if(pod)return podPaced(beats);
 // Only the latest turn change is worth a banner; earlier ones would only flash past. Your own
 // turn starting is announced by the table already unless the CPU did something first.
 const lastTurn=beats.findLastIndex(x=>x.tone==='turn');
 // Your own turn closing the story is the board itself: it carries the table's turn banner, so no beat holds it.
 const kept=beats.filter((x,i)=>(x.tone!=='turn'||i===lastTurn)&&!(i===beats.length-1&&i>0&&x.tone==='turn'&&x.label==='YOUR TURN'));
 const shownBeats=kept.filter(x=>x.kind!=='log');
 // Three CPUs take turns between yours, so a pod's playback runs quicker and shorter.
 return paced(shownBeats.length===1&&shownBeats[0].label==='YOUR TURN'?kept.filter(x=>x.kind==='log'):kept.slice(pod?-8:-12),pod?7000:16000,pod?.8:1);
}
// A Commander pod tells each CPU's turn on its own: the turn passes to that CPU (its seat lights up
// on the table and its board comes into view), a short hold so you can see whose turn it is, then
// what it did at a readable pace. Turns are never merged or dropped, so three CPUs never blur into
// one burst; only a very long backlog keeps the latest turns.
const POD_HANDOFF=1100,POD_TURN_BUDGET=7000;
function podPaced(beats){
 const turns=[];let cur=[];
 for(const x of beats){if(x.tone==='turn'&&cur.length){turns.push(cur);cur=[];}cur.push(x);}
 if(cur.length)turns.push(cur);
 // Your own turn closing the story is the board itself (the table announces it).
 const last=turns.at(-1);if(last?.length===1&&last[0].tone==='turn'&&last[0].label==='YOUR TURN'&&turns.length>1)turns.pop();
 if(turns.length===1&&turns[0].length===1&&turns[0][0].label==='YOUR TURN')return [];
 return turns.slice(-4).flatMap(turn=>{const head=turn[0].tone==='turn'?[{...turn[0],duration:turn[0].label==='YOUR TURN'?700:POD_HANDOFF}]:[],body=head.length?turn.slice(1):turn;
  return [...head,...paced(body.filter(x=>x.kind!=='log').slice(-8),POD_TURN_BUDGET,.85),...body.filter(x=>x.kind==='log')];});
}
// A whole CPU turn (land, spell, resolve, attack, damage) fits in one update at its natural pace;
// only a longer run (about 5 s of beats) speeds up evenly.
// Randall's pacing rule (1 Nov): every CPU action stays on screen at least about 650 ms, however long the turn.
// Hotfix (2 Nov): a spell, ability or attack is shown big with its glass panel long enough to read it
// (SPOT, about 2.4 s; never under SPOT_MIN even in a long turn). A tap moves on to the next action.
// Trimmed 2 Nov (Randall: the phone match felt much slower): 2.4 s per spell read as a stall; 1.7 s still reads it.
const MIN_BEAT=650,SPOT=1700,SPOT_MIN=1100;
const spotlit=x=>x.kind==='spell'||x.kind==='arrival'&&!!x.card||x.tone==='attack';
function paced(beats,budget=16000,pace=1){
 const total=beats.reduce((t,x)=>t+x.duration*pace,0),scale=pace*(total>budget?budget/total:1);
 return scale<1?beats.map(x=>x.kind==='log'?x:{...x,duration:Math.max(spotlit(x)?SPOT_MIN:MIN_BEAT,Math.round(x.duration*scale))}):beats;
}
const onScreen=beats=>beats.filter(b=>b.kind!=='log');
// Which beat puts each card in its final state on the table. A card named by several beats (a creature
// cast, then resolved; an attacker that then dies) lands at the last of them; earlier beats only patch
// what they show (attacking, blocking, damage marked). The CPU's lands tap for its first spell.
function settleReveals(beats,b,a){
 const last=new Map();beats.forEach((x,i)=>{for(const id of x.reveal||[])last.set(id,i);});
 beats.forEach((x,i)=>{if(x.reveal)x.reveal=x.reveal.filter(id=>last.get(id)===i);});
 const was=new Map((a?.cards||[]).map(c=>[c.id,c])),paid=new Set();
 // A creature that attacked this update tapped to attack, not to pay.
 const swung=new Set(beats.filter(x=>x.tone==='attack').flatMap(x=>Object.keys(x.patch||{}).map(Number)));
 for(const x of beats){
  if(x.kind!=='spell'||x.mana==null||paid.has(x.mana))continue;paid.add(x.mana);
  const seat=b.players.find(p=>p.nativeId===x.mana)?.seat;if(seat==null)continue;
  const taps=b.cards.filter(c=>c.zone==='Battlefield'&&c.controller===seat&&c.tapped&&!c.attacking&&!swung.has(c.id)&&was.get(c.id)?.zone==='Battlefield'&&was.get(c.id).tapped===false);
  if(taps.length)x.patch={...Object.fromEntries(taps.map(c=>[c.id,{tapped:true}])),...x.patch};
 }
 for(const x of beats)delete x.mana;
}
// The board as it stands partway through a CPU update: everything the beats so far have shown is in
// its new state, the rest is still as it was. It is only ever displayed held (no commands), and the
// real accepted board replaces it when the playback ends, so nothing here is ever acted on.
export function stagedSnapshot(before,after,shown){
 const a=before?.status?.surface,b=after?.status?.surface;if(!a||!b)return before;
 const full=new Set(),patch=new Map(),played=new Map();let life=false,turn=false,turnSeat=null;
 for(const x of shown){if(x.tone==='turn'&&Number.isSafeInteger(x.seat))turnSeat=x.seat;if(x.hand!=null)played.set(x.hand,(played.get(x.hand)||0)+1);for(const id of x.reveal||[])full.add(id);for(const [id,p] of Object.entries(x.patch||{}))patch.set(Number(id),{...patch.get(Number(id)),...p});if(x.life)life=true;if(x.tone==='turn')turn=true;}
 const was=new Map(a.cards.map(c=>[c.id,c])),now=new Set(b.cards.map(c=>c.id)),cards=[];
 for(const c of b.cards){if(full.has(c.id)){cards.push(c);continue;}const o=was.get(c.id);if(o)cards.push(patch.has(c.id)?{...o,...patch.get(c.id)}:o);}
 for(const o of a.cards)if(!now.has(o.id)&&!full.has(o.id))cards.push(patch.has(o.id)?{...o,...patch.get(o.id)}:o);
 // A stack item shows from the beat that cast it until the beat that resolved it.
 const inA=new Set(a.stack.map(x=>x.id)),inB=new Set(b.stack.map(x=>x.id));
 const keep=x=>inB.has(x.id)?inA.has(x.id)||full.has(x.source):!full.has(x.source);
 const stack=[...a.stack.filter(x=>!inB.has(x.id)&&keep(x)),...b.stack.filter(keep)],ids=new Set(stack.map(x=>x.id));
 const nativeStack=[...(before.native?.stack||[]).filter(x=>!inB.has(x.id)),...(after.native?.stack||[])].filter(x=>ids.has(x.id));
 // A card leaves the CPU's hand on the beat that plays it.
 const players=(life?b.players:a.players).map(p=>{const was=a.players.find(q=>q.seat===p.seat),is=b.players.find(q=>q.seat===p.seat),n=played.get(p.nativeId);
  return n&&Number.isSafeInteger(was?.handCount)&&Number.isSafeInteger(is?.handCount)?{...p,handCount:Math.max(is.handCount,was.handCount-n)}:p;});
 const surface={...a,cards,stack,players,...(turn?{activeSeat:b.activeSeat,turn:b.turn,phase:b.phase}:{}),...(turnSeat!==null&&turnSeat!==b.activeSeat?{activeSeat:turnSeat,prioritySeat:turnSeat}:{})};
 return answered({...before,status:{...before.status,surface},native:before.native?{...before.native,stack:nativeStack}:before.native});
}
const stages=beat=>!!(beat.reveal?.length||beat.patch&&Object.keys(beat.patch).length||beat.life||beat.tone==='turn');
// The event log when it covers everything since the last board, the snapshot difference otherwise.
export function playbackBeats(before,after){return eventPlaybackBeats(before,after)??cpuPlaybackBeats(before,after);}

export function cpuPlaybackBeats(before, after) {
 const a=before?.status?.surface,b=after?.status?.surface;
 if(!a||!b||after.status.terminal||after.status.failure)return [];
 const rivals=b.players.filter(p=>p.seat!==b.seat),pod=rivals.length>1;if(!rivals.length)return [];
 const isCpu=seat=>seat!==b.seat&&rivals.some(p=>p.seat===seat),cpuName=seat=>rivals.find(p=>p.seat===seat)?.label||'CPU';
 const oldCards=new Map(a.cards.map(c=>[c.id,c])),oldStack=new Set(a.stack.map(s=>s.id));
 const beats=[],turn=a.activeSeat!==b.activeSeat||a.turn!==b.turn;
 const phase=!turn&&a.phase!==b.phase&&['BeginningOfCombat','DeclareAttackers'].includes(b.phase)&&!['BeginningOfCombat','DeclareAttackers'].includes(a.phase);
 const banner=turn?{kind:'phase',tone:'turn',label:b.activeSeat===b.seat?'YOUR TURN':pod?`${cpuName(b.activeSeat).toUpperCase()}’S TURN`:"OPPONENT’S TURN",line:b.activeSeat===b.seat?'Your turn.':`${cpuName(b.activeSeat)}'s turn.`,actor:b.activeSeat===b.seat?undefined:cpuName(b.activeSeat),duration:600}:phase?{kind:'phase',label:'COMBAT',line:'Combat.',duration:600}:null;
 if(banner&&b.activeSeat!==b.seat)beats.push(banner);
 const shown=new Set();
 for(const item of b.stack){
  if(!isCpu(item.controller)||oldStack.has(item.id))continue;
  const card=b.cards.find(c=>c.id===item.source&&c.known);if(!card)continue;
  const nativeItem=after.native?.stack?.find(s=>s.id===item.id);
  beats.push({kind:'spell',label:`${cpuName(item.controller).toUpperCase()} · SPELL / ABILITY`,actor:cpuName(item.controller),card,stackId:item.id,reveal:[card.id],text:item.text||card.text||'',targets:(nativeItem?.targets||[]).filter(t=>t&&['card','player'].includes(t.kind)&&Number.isSafeInteger(t.id)),line:`${cpuName(item.controller)} put ${card.name} on the stack.`,duration:SPOT});shown.add(card.id);
 }
 // Lands and new permanents get a beat each, but tokens arrive with the board, and at most
 // three arrivals are shown: a token swarm never holds the table.
 let arrivals=0;
 for(const card of b.cards){
  if(!card.known||card.isToken||!isCpu(card.controller)||card.zone!=='Battlefield'||oldCards.get(card.id)?.zone==='Battlefield'||shown.has(card.id)||arrivals>=3)continue;
  // A source that was on the preceding stack has already had its spotlight.
  if(a.stack.some(s=>s.source===card.id))continue;
  const land=card.types?.includes('Land')||/\bLand\b/.test(card.type||'');
  arrivals++;beats.push({kind:land?'land':'arrival',label:`${cpuName(card.controller).toUpperCase()} · ${land?'LAND PLAYED':'ENTERED BATTLEFIELD'}`,actor:cpuName(card.controller),card,reveal:[card.id],text:card.text||'',targets:[],line:`${card.name} is now on ${pod?cpuName(card.controller)+'\'s':'the CPU\'s'} battlefield.`,duration:land?600:SPOT-600});
 }
 if(banner&&b.activeSeat===b.seat)beats.push(banner);
 return paced(beats,pod?5000:9000,pod?.8:1);
}

// What the table is doing right now, in words a player can trust. Only the accepted state and
// the playback in progress decide it: "Your decision" only when Forge is waiting on the viewer,
// "CPU thinking" only when the CPU holds the turn or priority and Forge is still working.
export function tableActivity(s,{beat=null,overlay=false,recent=[]}={}){
 const n=s?.native,surface=s?.status?.surface,detail=recent.at(-1)||'';
 if(!surface||s.status.terminal)return null;
 if(s.transportError)return {kind:'connection',label:'Waiting for connection',detail:''};
 if(s.status.failure||n?.status==='failed')return {kind:'stopped',label:'Match stopped',detail:''};
 if(beat&&!overlay)return {kind:'replay',label:beat.label?.startsWith('YOUR')?'Your turn':`${beat.actor||'CPU'}’s play`,detail:beat.line||''};
 if(isPlayerDecision(s)){
  const top=n?.stack?.[0],cpuTop=top&&top.activatingPlayer!==n.viewer;
  const what=n?.prompt?'Choose':{InputConfirmMulligan:'Keep or mulligan',InputAttack:'Declare attackers',InputBlock:'Declare blockers',InputPayMana:'Pay the cost',InputSelectTargets:'Choose targets'}[n?.inputType]
   ||(cpuTop?'Respond or pass':surface.activeSeat===surface.seat?'Your turn':'Respond or pass');
  return {kind:'decision',label:`Your decision · ${what}`,detail:beat?.line||detail};
 }
 const cpuPriority=surface.prioritySeat!=null&&surface.prioritySeat!==surface.seat;
 if(n?.stack?.length&&!cpuPriority)return {kind:'resolving',label:'Resolving effects',detail};
 const thinker=surface.players?.find?.(p=>p.seat===(cpuPriority?surface.prioritySeat:surface.activeSeat))?.label||null;
 return cpuPriority||surface.activeSeat!==surface.seat?{kind:'thinking',label:`${thinker||'CPU'} thinking`,detail}:{kind:'working',label:'Forge is applying your play',detail};
}

// A decision the player already answered (the mulligan above all) leaves the screen while the CPUs'
// play is told: the story runs on the board, never under a stale "Keep / Mulligan" panel.
export function answered(s){
 if(!isPlayerDecision(s))return s;
 // Only the pregame (mulligan, cards to the bottom); a stop during play keeps its steady layout.
 const surface=s.status.surface;if(s.native.inputType!=='InputConfirmMulligan'&&Number(surface.turn)>0)return s;
 return {...s,status:{...s.status,surface:{...surface,awaitingHuman:false}},native:{...s.native,prompt:null,inputType:null,selection:null,buttons:null}};
}
// After the keep, the hand lands and the table settles before the CPU's first turn starts (Randall, 2 Nov).
const KEEP_BEAT=1600;
export class CpuActionPlaybackQueue {
 constructor({present,beat=()=>{},clear=()=>{},preload=()=>{},reducedMotion=()=>false,speed=()=>1,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){Object.assign(this,{present,beat,clear,preload,reducedMotion,speed,schedule,cancel});this.current=null;this.latest=null;this.pending=[];this.timer=null;this.running=false;this.overlay=false;this.closed=false;this.recent=[];this.seenSeq=-1;this.loggedSeq=-1;this.target=null;}
 // Overlay playback runs over a board that already asks the player something; it never blocks.
 get busy(){return this.running&&!this.overlay||this.pending.length>0||!!this.gate;}
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
  if(!this.current||!snapshot?.status||snapshot.status.terminal||snapshot.status.failure||snapshot.transportError){this.gate=null;this.flush(snapshot);return;}
  // Nothing from turn one shows until the keep is confirmed, and then only after a short beat (Randall, 1 Nov):
  // the opening hand settles first, then the game starts. Boards that arrive meanwhile wait for it.
  if(this.gate){this.gate=snapshot;return;}
  // Any opening decision counts (keep or mulligan, or putting cards on the bottom after one): the gate is the step
  // from the pregame (turn 0) to turn one, so a CPU that goes first never plays behind the mulligan screen.
  if(!this.opened&&(this.current.native?.inputType==='InputConfirmMulligan'||Number(this.current.status?.surface?.turn)===0)&&Number(snapshot.status.surface?.turn)>0&&snapshot.native?.inputType!=='InputConfirmMulligan'){
   this.opened=true;this.keptAt=Date.now();try{console.info('[pace] keep confirmed',this.keptAt);}catch{}
   this.current=answered(this.current);this.present(this.current,true);
   if(!this.reducedMotion()){this.gate=snapshot;this.timer=this.schedule(()=>{const next=this.gate;this.gate=null;this.timer=null;if(next&&!this.closed)this.push(next);},KEEP_BEAT);return;}
  }
  if(this.overlay&&snapshot.status.revision===this.current.status?.revision){this.current=snapshot;this.present(snapshot,false);return;}
  // The board being told is polled again unchanged: keep telling it.
  if(this.running&&!this.overlay&&snapshot.status.revision===this.target?.status?.revision){this.target=snapshot;return;}
  if(this.overlay)this.stop();
  if(isPlayerDecision(snapshot)){this.yieldTo(snapshot);return;}
  if(snapshot.status.revision===this.current.status?.revision&&!this.running){this.current=snapshot;this.present(snapshot,false);return;}
  const tail=this.pending.at(-1);
  if(tail?.status?.revision===snapshot.status.revision)this.pending[this.pending.length-1]=snapshot;
  else if(this.pending.length>=8)this.pending[this.pending.length-1]=snapshot;
  else this.pending.push(snapshot);
  this.advance();
 }
 // A real decision arrived. As on Arena, what the CPU did first plays out at its own pace, beat by
 // beat on the table, and the decision opens when it ends; one tap skips straight to it. Reduced
 // motion shows the decision at once and tells the story over it instead.
 // The log covers everything since the board shown last, so beats already seen are not replayed.
 yieldTo(snapshot){
  const all=playbackBeats(this.current,snapshot),beats=onScreen(all),fresh=beats.filter(b=>!this.seen(b));
  this.stop();this.pending=[];this.remember(all);
  if(fresh.length&&!this.reducedMotion()){this.present(answered(this.current),true);this.play(beats,snapshot,false);return;}
  this.current=snapshot;this.present(snapshot,false);
  if(fresh.length)this.play(fresh.map(b=>({...b,duration:Math.max(350,Math.round(b.duration*.7))})),snapshot,true);
 }
 seen(b){return Number.isSafeInteger(b.seq)&&b.seq<=this.seenSeq;}
 advance(){
  if(this.closed||this.running)return;
  const next=this.pending.shift();if(!next)return;
  const all=playbackBeats(this.current,next),beats=onScreen(all);this.remember(all);
  if(!beats.some(b=>!this.seen(b))){this.current=next;this.present(next,this.pending.length>0);this.advance();return;}
  this.present(answered(this.current),true);this.play(beats,next,false);
 }
 play(beats,next,overlay){
  this.running=true;this.overlay=overlay;this.target=next;let index=0;
  // Held playback moves the board one beat at a time; beats already told keep their place on it.
  const from=this.current,shown=beats.filter(b=>this.seen(b));beats=beats.filter(b=>!this.seen(b));
  // Every card the story will spotlight starts loading now, so none opens on a blank frame.
  try{this.preload(beats);}catch{/* art is optional */}
  const step=()=>{
   if(this.closed)return;this.clear();
   const beat=beats[index++];
   if(!beat){
    this.timer=null;this.running=false;this.overlay=false;
    if(!overlay){this.current=this.target;this.present(this.target,this.pending.length>0);this.advance();}
    return;
   }
   if(Number.isSafeInteger(beat.seq))this.seenSeq=Math.max(this.seenSeq,beat.seq);
   // A beat lasts its duration from when it starts, however long its board takes to draw.
   const start=Date.now();shown.push(beat);if(!overlay&&stages(beat))this.present(stagedSnapshot(from,this.target,shown),true,true);
   this.beat(beat,this.target);// speed() is read per beat, so switching to Fast also hurries the beats already queued.
   const spent=Date.now()-start;
   // A backlog of two or more updates hurries a little; the table never races through a turn.
   if(beat.actor&&!this.firstCpuShown){this.firstCpuShown=true;try{console.info('[pace] first CPU action shown',Date.now(),this.keptAt?`${Date.now()-this.keptAt} ms after the keep`:'');}catch{}}
   this.timer=this.schedule(step,this.reducedMotion()?250:Math.max(spotlit(beat)?Math.min(SPOT_MIN,beat.duration):MIN_BEAT,Math.round((this.pending.length>1?beat.duration*.85:beat.duration)*this.speed())-(spent>=10?spent:0)));
  };this.step=step;step();
 }
 // A tap moves straight on to the next action (Arena's click-to-continue), never past the whole turn.
 next(){if(!this.running||typeof this.step!=='function')return false;this.cancel(this.timer);this.timer=null;this.step();return true;}
 stop(){this.cancel(this.timer);this.timer=null;this.step=null;this.running=false;this.overlay=false;this.clear();if(this.gate){const g=this.gate;this.gate=null;this.latest=g;}}
 flush(snapshot=this.latest){
  // Skipped beats still reach the activity log, so a skip never hides what happened.
  if(snapshot&&this.current&&snapshot!==this.current)this.remember(playbackBeats(this.current,snapshot));
  this.stop();this.pending=[];this.current=snapshot;if(snapshot)this.present(snapshot,false);
 }
 destroy(){this.closed=true;this.cancel(this.timer);this.timer=null;this.pending=[];this.current=null;this.latest=null;this.running=false;this.overlay=false;this.clear();}
}

// The match history in plain words, for both sides (Arena's game log): "You cast Biotech Specialist.",
// "Chandra's Pyreling and Burnished Hart blocked Biotech Specialist." One entry per public event, keyed by
// its sequence number so a history kept across boards never repeats a line. Draws and other hidden moves stay out.
export function storyLines(items,surface){
 if(!Array.isArray(items)||!surface?.players)return [];
 const me=surface.players.find(p=>p.seat===surface.seat)?.nativeId,rivals=surface.players.filter(p=>p.seat!==surface.seat),pod=rivals.length>1;
 const cards=new Map((surface.cards||[]).map(c=>[c.id,c]));
 const who=id=>id===me?'You':rivals.find(p=>p.nativeId===id)?.label||'CPU';
 const card=ref=>ref?.kind==='card'?(cards.get(ref.id)?.known?cards.get(ref.id).name:typeof ref.name==='string'&&ref.name?ref.name:null):null;
 const target=ref=>ref?.kind==='player'?(ref.id===me?'you':who(ref.id)):card(ref);
 const out=[],push=(e,text,id=null)=>{if(text)out.push({seq:e.seq,turn:e.turn,text,...(Number.isSafeInteger(id)?{card:id}:{})});};
 const list=xs=>xs.length<3?xs.join(' and '):`${xs.slice(0,-1).join(', ')} and ${xs.at(-1)}`;
 for(const e of items){if(!Number.isSafeInteger(e?.seq))continue;
  switch(e.type){
   case 'turn':push(e,`Turn ${e.number??e.turn} · ${e.player===me?'your turn':`${who(e.player)}’s turn`}`);break;
   case 'land':push(e,card(e.card)&&`${who(e.player)} played ${card(e.card)}.`,e.card?.id);break;
   case 'cast':case 'ability':{const name=card(e.source);if(!name)break;const aims=(e.targets||[]).map(target).filter(Boolean);
    push(e,`${who(e.player)} ${e.type==='cast'?'cast':'activated'} ${name}${e.type==='ability'?'’s ability':''}${aims.length?` targeting ${list(aims)}`:''}.`,e.source.id);break;}
   case 'trigger':push(e,card(e.source)&&`${card(e.source)} triggered.`,e.source?.id);break;
   case 'resolve':if(e.fizzled)push(e,card(e.source)&&`${card(e.source)} didn’t resolve: no legal targets.`,e.source?.id);break;
   case 'attack':{const by=(e.attackers||[]).map(a=>({name:card(a),to:target(a.target)})).filter(a=>a.name);if(!by.length)break;
    const tos=[...new Set(by.map(a=>a.to).filter(Boolean))];push(e,`${who(e.player)} attacked${tos.length===1?` ${tos[0]}`:''} with ${list(by.map(a=>a.name))}.`);break;}
   case 'block':{const by=new Map();for(const b of e.blockers||[]){const n=card(b),a=card({kind:'card',id:b.blocking});if(n&&a)by.set(a,[...(by.get(a)||[]),n]);}
    for(const [a,bs] of by)push(e,`${list(bs)} blocked ${a}.`);break;}
   case 'damage':{const from=card(e.source),to=target(e.target);if(from&&to&&e.amount>0)push(e,`${from} dealt ${e.amount} damage to ${to}.`,e.source.id);break;}
   case 'life':if(Number.isSafeInteger(e.from)&&Number.isSafeInteger(e.to)&&e.to>e.from)push(e,`${who(e.player)} gained ${e.to-e.from} life.`);break;
   case 'zone':{const n=card(e.card);if(!n)break;
    if(e.from==='Battlefield'&&e.to==='Graveyard')push(e,`${n} ${/Creature/.test(cards.get(e.card.id)?.type||'Creature')?'died':'went to the graveyard'}.`,e.card.id);
    else if(e.to==='Exile'&&e.from!=='Stack')push(e,`${n} was exiled.`,e.card.id);
    else if(e.to==='Battlefield'&&e.token)push(e,`${who(e.player)} created ${/^[aeiou]/i.test(n)?'an':'a'} ${n}.`,e.card.id);
    else if(e.from==='Battlefield'&&e.to==='Hand')push(e,`${n} returned to its owner’s hand.`,e.card.id);
    break;}
  }}
 return out;
}
