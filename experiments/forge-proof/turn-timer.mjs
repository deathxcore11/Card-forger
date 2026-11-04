// The turn clock (Randall, 4 Nov): every match mode shows a countdown while the game waits on you, and a player
// who stays away is skipped. 90 s per turn, 30 s for each prompt (keep, attackers, blockers, targets, payment) and
// for a response window on the CPU's turn. The clock runs only while the game waits on the human, and pauses while
// the CPU's play is told, a card pop-up or the menu is open, or the table is busy.
// A missed window plays the safe answer (the table's `act`), and three missed turns in a row concede in a friend
// match only; against the CPU a missed window just passes. Any touch of the table (poke) clears the count.
// Pure logic: no DOM here, so a fake clock tests it. The table draws what `onChange` reports.
import {isPlayerDecision} from './cpu-action-playback.mjs';
export const TURN_MS=90000,PROMPT_MS=30000,WARN_MS=10000,STRIKE_LIMIT=3;

// What the game is waiting on, as a window: {id, kind:'turn'|'prompt'|'response', total}. null when it is not waiting on you.
export function waitingOn(s){
 if(!isPlayerDecision(s))return null;
 const n=s.native,surface=s.status.surface,input=String(n.inputType||'');
 if(n.prompt)return {id:`prompt:${n.prompt.id}:${n.revision}`,kind:'prompt',total:PROMPT_MS};
 if(input==='InputPassPriority'){
  if(n.activePlayer===n.viewer)return {id:`turn:${surface.turn}`,kind:'turn',total:TURN_MS};
  return {id:`response:${n.revision}`,kind:'response',total:PROMPT_MS};
 }
 return {id:`${input}:${n.revision}`,kind:'prompt',total:PROMPT_MS};
}
// A friend's turn, for the line under the turn pill only: nothing here ever acts.
export function rivalTurn(s){
 const n=s?.native;
 if(!n||s.status?.terminal||s.status?.failure||s.transportError||n.activePlayer===undefined||n.activePlayer===n.viewer)return null;
 return {id:`rival:${s.status.surface.turn}`,kind:'rival',total:TURN_MS};
}

export function createTurnTimer({snapshot,paused=()=>false,act,concede=()=>{},onChange=()=>{},onStrike=()=>{},mode='solo',now=()=>Date.now(),every=(fn,ms)=>setInterval(fn,ms),stopEvery=id=>clearInterval(id),tickMs=250}={}){
 let cur=null,acting=false,strikes=0,lastStrikeTurn=null,timer=null,shown='',stopped=false;
 const banks=new Map();
 const left=()=>cur?Math.max(0,cur.left-(cur.since===null?0:now()-cur.since)):0;
 const emit=()=>{
  const s=cur?Math.ceil(left()/1000):0,key=cur?`${cur.kind}|${s}|${cur.since===null?'p':'r'}`:'';
  if(key===shown)return;shown=key;
  onChange(cur?{kind:cur.kind,own:cur.kind!=='rival',total:cur.total,remaining:left(),seconds:s,warn:cur.kind!=='rival'&&left()<=WARN_MS,paused:cur.since===null}:null);
 };
 function expire(w,s){
  if(cur.kind==='rival'){cur.left=0;cur.since=null;return;}
  const turn=s.status?.surface?.turn??null;
  if(turn!==lastStrikeTurn){lastStrikeTurn=turn;strikes++;try{onStrike(strikes,mode==='friend'?STRIKE_LIMIT:null);}catch{/* a toast is optional */}}
  cur.attempts=(cur.attempts||0)+1;
  if(mode==='friend'&&strikes>=STRIKE_LIMIT){acting=true;Promise.resolve().then(concede).catch(()=>{});return;}
  // The answer goes out once; if it is refused (the board moved), try again shortly, a few times.
  if(cur.attempts>3){cur.left=Infinity;cur.since=null;return;}
  cur.left=3000;cur.since=null;acting=true;
  Promise.resolve().then(()=>act(w,s)).catch(()=>{}).finally(()=>{acting=false;});
 }
 function tick(){
  if(stopped)return;
  const s=snapshot(),w=waitingOn(s)||(mode==='friend'?rivalTurn(s):null);
  if(!w){if(cur){banks.set(cur.id,left());cur=null;}emit();return;}
  if(!cur||cur.id!==w.id){
   if(cur&&cur.kind==='turn')banks.set(cur.id,left());
   // A prompt in the middle of your turn pauses that turn's clock; it picks up where it stopped.
   cur={...w,left:banks.get(w.id)??w.total,since:null,attempts:0};
  }
  const hold=!!paused()||acting||s.busy===true||cur.left===Infinity;
  if(hold&&cur.since!==null){cur.left-=now()-cur.since;cur.since=null;}
  else if(!hold&&cur.since===null)cur.since=now();
  if(cur.kind==='turn')banks.set(cur.id,left());
  if(cur.left!==Infinity&&left()<=0&&!acting)expire(w,s);
  emit();
 }
 const id=every(tick,tickMs);timer=id;
 return {
  tick,
  // Any touch of the table: you are here. The count of missed turns clears, and a prompt's window starts over.
  poke(){strikes=0;lastStrikeTurn=null;if(cur&&cur.kind!=='turn'&&cur.kind!=='rival'&&cur.left!==Infinity){cur.left=cur.total;if(cur.since!==null)cur.since=now();emit();}},
  strikes:()=>strikes,
  stop(){stopped=true;stopEvery(timer);cur=null;onChange(null);},
 };
}
