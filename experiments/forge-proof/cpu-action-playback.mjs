// Presentation only: order comes from accepted snapshots, never a guessed game log.
// A snapshot can omit actions between polls. Those arrivals are labelled "played",
// not "cast", and no targets or earlier hidden card identities are reconstructed.
export function createPlaybackSession(authority,{displayed,busy}){
 const commands=new Set(['nativeSelect','nativeButton','selectPrompt','confirmPrompt','clearPrompt','rememberPrompt','reorderPrompt','replyValue','setControlMode','concede']);
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

export function cpuPlaybackBeats(before, after) {
 const a=before?.status?.surface,b=after?.status?.surface;
 if(!a||!b||after.status.terminal||after.status.failure)return [];
 const cpu=b.players.find(p=>p.seat!==b.seat)?.seat;if(cpu===undefined)return [];
 const oldCards=new Map(a.cards.map(c=>[c.id,c])),oldStack=new Set(a.stack.map(s=>s.id));
 const beats=[],turn=a.activeSeat!==b.activeSeat||a.turn!==b.turn;
 const phase=!turn&&a.phase!==b.phase&&['BeginningOfCombat','DeclareAttackers'].includes(b.phase)&&!['BeginningOfCombat','DeclareAttackers'].includes(a.phase);
 const banner=turn?{kind:'phase',label:b.activeSeat===b.seat?'YOUR TURN':"OPPONENT’S TURN",duration:600}:phase?{kind:'phase',label:'COMBAT',duration:600}:null;
 if(banner&&b.activeSeat!==b.seat)beats.push(banner);
 const shown=new Set();
 for(const item of b.stack){
  if(item.controller!==cpu||oldStack.has(item.id))continue;
  const card=b.cards.find(c=>c.id===item.source&&c.known);if(!card)continue;
  const nativeItem=after.native?.stack?.find(s=>s.id===item.id);
  beats.push({kind:'spell',label:'CPU · SPELL / ABILITY',card,stackId:item.id,text:item.text||card.text||'',targets:(nativeItem?.targets||[]).filter(t=>t&&['card','player'].includes(t.kind)&&Number.isSafeInteger(t.id)),duration:1100});shown.add(card.id);
 }
 for(const card of b.cards){
  if(!card.known||card.controller!==cpu||card.zone!=='Battlefield'||oldCards.get(card.id)?.zone==='Battlefield'||shown.has(card.id))continue;
  // A source that was on the preceding stack has already had its spotlight.
  if(a.stack.some(s=>s.source===card.id))continue;
  const land=card.types?.includes('Land')||/\bLand\b/.test(card.type||'');
  beats.push({kind:land?'land':'arrival',label:land?'CPU · LAND PLAYED':'CPU · ENTERED BATTLEFIELD',card,text:card.text||'',targets:[],duration:land?700:850});
 }
 if(banner&&b.activeSeat===b.seat)beats.push(banner);
 return beats;
}

export class CpuActionPlaybackQueue {
 constructor({present,beat=()=>{},clear=()=>{},reducedMotion=()=>false,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){Object.assign(this,{present,beat,clear,reducedMotion,schedule,cancel});this.current=null;this.latest=null;this.pending=[];this.timer=null;this.running=false;this.closed=false;}
 get busy(){return this.running||this.pending.length>0;}
 push(snapshot){
  if(this.closed)return;this.latest=snapshot;
  const immediate=!this.current||!snapshot?.status||snapshot.status.terminal||snapshot.status.failure||snapshot.transportError||this.current.native?.prompt||snapshot.native?.prompt;
  if(immediate){this.flush(snapshot);return;}
  if(snapshot.status.revision===this.current.status?.revision&&!this.running){this.current=snapshot;this.present(snapshot,false);return;}
  const tail=this.pending.at(-1);
  if(tail?.status?.revision===snapshot.status.revision)this.pending[this.pending.length-1]=snapshot;
  else if(this.pending.length>=8)this.pending[this.pending.length-1]=snapshot;
  else this.pending.push(snapshot);
  this.advance();
 }
 advance(){
  if(this.closed||this.running)return;
  const next=this.pending.shift();if(!next)return;
  const beats=cpuPlaybackBeats(this.current,next);
  if(!beats.length){this.current=next;this.present(next,this.pending.length>0);this.advance();return;}
  this.running=true;this.present(this.current,true);let index=0;
  const step=()=>{
   if(this.closed)return;this.clear();
   const beat=beats[index++];
   if(!beat){this.timer=null;this.running=false;this.current=next;this.present(next,this.pending.length>0);this.advance();return;}
   this.beat(beat,next);this.timer=this.schedule(step,this.reducedMotion()?250:beat.duration);
  };step();
 }
 flush(snapshot=this.latest){this.cancel(this.timer);this.timer=null;this.pending=[];this.running=false;this.clear();this.current=snapshot;if(snapshot)this.present(snapshot,false);}
 destroy(){this.closed=true;this.cancel(this.timer);this.timer=null;this.pending=[];this.current=null;this.latest=null;this.running=false;this.clear();}
}
