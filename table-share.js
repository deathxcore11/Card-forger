// Shared table: every phone sees the whole Game Night table live. The host phone keeps the one true
// session; other phones send what they tapped and get the table back. It rides on the same Supabase
// Realtime channels the website already connects to, so there is no new service. The channel name is a
// long random code (the link). Whoever has the link can watch; tapping needs a signed-in account.
// Nothing here carries a deck, a collection or a price: only the counters you already see.
import {changeCounter,undoPlayer,loadTable} from './tabletop.js';
import {endTurn,undoTurn,cleanNight} from './game-night.js';
const CODE=/^[A-Za-z0-9_-]{43}$/,HEARTBEAT_MS=15000,AWAY_MS=45000,OPS=['delta','undo','turn','turnUndo'];
export const newShareCode=()=>{const a=new Uint8Array(32);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
export const shareLink=code=>'https://cardstashy.com/#table/'+code;
export const shareCodeFromHash=hash=>{const m=/^#table\/([A-Za-z0-9_-]{43})$/.exec(hash||'');return m?m[1]:null;};
export const validCode=c=>CODE.test(c||'');
// A phone's table arrives as plain data; the same checks that load a saved table decide if it is usable.
export function cleanShared(raw){
 try{const s=loadTable(raw?.game,{getItem:()=>JSON.stringify(raw)});if(!s)return null;s.night=cleanNight(raw.night,s.players.length);return s;}catch{return null;}
}
// What the host does with one phone's tap. Returns true when the table changed.
export function applyOp(s,op,now=Date.now()){
 if(!op||!OPS.includes(op.t))return false;
 const seat=op.seat;
 if(op.t==='delta')return typeof op.field==='string'&&Number.isInteger(seat)&&changeCounter(s,seat,op.field,op.delta);
 if(op.t==='undo')return Number.isInteger(seat)&&undoPlayer(s,seat);
 if(op.t==='turn'){endTurn(s,now);return true;}
 return undoTurn(s,now);
}
export function openShare({client,code,host,editor=false,getState,setState,onStatus=()=>{},now=Date.now,timers={setInterval:(f,n)=>setInterval(f,n),clearInterval:i=>clearInterval(i)}}){
 if(!validCode(code))throw Error('This table link is not valid.');
 if(!client?.channel)throw Error('Sharing needs an online connection.');
 const ch=client.channel('table:'+code,{config:{broadcast:{self:false,ack:false}}});
 let seen=now(),beat=null,watch=null,away=false,closed=false;
 const send=(event,payload)=>{if(!closed)ch.send({type:'broadcast',event,payload});};
 const publish=()=>{if(host&&getState())send('state',{at:now(),table:getState()});};
 ch.on('broadcast',{event:'state'},({payload})=>{
  if(host||closed)return;const table=cleanShared(payload?.table);if(!table)return;
  seen=now();if(away){away=false;onStatus('live');}setState(table);
 });
 ch.on('broadcast',{event:'hello'},()=>{if(host)publish();});
 ch.on('broadcast',{event:'op'},({payload})=>{
  if(!host||closed)return;const s=getState();if(s&&applyOp(s,payload,now()))publish();
 });
 return new Promise((resolve,reject)=>{
  ch.subscribe(status=>{
   if(status==='SUBSCRIBED'){
    onStatus(host?'live':'joining');
    if(host){publish();beat=timers.setInterval(publish,HEARTBEAT_MS);}
    else{send('hello',{});watch=timers.setInterval(()=>{if(!away&&now()-seen>AWAY_MS){away=true;onStatus('away');}},HEARTBEAT_MS);}
    resolve({
     publish,
     tap:op=>{if(!editor||!OPS.includes(op?.t))return false;if(host){const s=getState();if(s&&applyOp(s,op,now())){publish();return true;}return false;}send('op',op);return true;},
     close(){if(closed)return;closed=true;timers.clearInterval(beat);timers.clearInterval(watch);try{client.removeChannel(ch);}catch{}},
    });
   }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){onStatus('offline');if(!closed)reject(Error('The table could not be reached. Try again.'));}
   else if(status==='CLOSED'&&!closed)onStatus('offline');
  });
 });
}
