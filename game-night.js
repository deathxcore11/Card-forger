// Game Night: the Tabletop session grows a turn clock, a turn log, notes, a winner, optional Table Spirit
// tallies and a deck journal. Everything here is pure data work on the tabletop session (tabletop.js), so the
// same functions run on the host phone and are tested without a screen. Game Night never touches Play
// Glory, Play collection or any price: it is a tool for real cards on a real table.
import {privateKey} from './account-scope.js';
export const LONG_TURN_MS=180000;                       // a turn past three minutes is marked, never enforced
export const SPIRIT_KINDS=['kill','firstBlood','save','extraTurn'];
export const SPIRIT_LABELS={kill:'Kill',firstBlood:'First blood',save:'Saved a player',extraTurn:'Extra turn'};
export const SPIRIT_DEFAULT=Object.freeze({kill:1,firstBlood:1,save:1,extraTurn:1});
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const text=(v,n)=>String(v??'').replace(/[\u0000-\u001f<>]/g,' ').slice(0,n);
export function newNight(){return {running:false,startedAt:0,banked:0,longMs:LONG_TURN_MS,note:'',log:[],winner:null,spirit:{on:false,values:{...SPIRIT_DEFAULT},tally:{},firstBlood:null}};}
export function cleanNight(raw,seats){
 const n=newNight();if(!raw||typeof raw!=='object')return n;
 n.running=raw.running===true;n.startedAt=int(raw.startedAt,0,4e12)?raw.startedAt:0;n.banked=int(raw.banked,0,864e5)?raw.banked:0;
 n.longMs=int(raw.longMs,10000,36e5)?raw.longMs:LONG_TURN_MS;n.note=text(raw.note,200);
 if(n.running&&!n.startedAt)n.running=false;
 n.log=(Array.isArray(raw.log)?raw.log:[]).slice(-80).filter(e=>e&&int(e.turn,0,100000)&&seatOk(e.seat,seats)&&int(e.ms,0,864e5)).map(e=>({turn:e.turn,seat:e.seat,ms:e.ms,long:e.long===true,note:text(e.note,200)}));
 n.winner=int(raw.winner,0,seats-1)?raw.winner:null;
 const sp=raw.spirit&&typeof raw.spirit==='object'?raw.spirit:{};
 n.spirit.on=sp.on===true;for(const k of SPIRIT_KINDS)if(int(sp.values?.[k],0,20))n.spirit.values[k]=sp.values[k];
 for(const [seat,t] of Object.entries(sp.tally&&typeof sp.tally==='object'?sp.tally:{})){if(!/^[0-5]$/.test(seat)||Number(seat)>=seats)continue;n.spirit.tally[seat]={};for(const k of SPIRIT_KINDS)if(int(t?.[k],0,999))n.spirit.tally[seat][k]=t[k];}
 n.spirit.firstBlood=int(sp.firstBlood,0,seats-1)?sp.firstBlood:null;return n;
}
const seatOk=(v,seats)=>Number.isInteger(v)&&v>=0&&v<seats;
const night=s=>s.night||(s.night=newNight());
export const elapsed=(s,now=Date.now())=>{const n=night(s);return n.banked+(n.running&&n.startedAt?Math.max(0,now-n.startedAt):0);};
export function clockText(ms){const t=Math.floor(Math.max(0,ms)/1000),h=Math.floor(t/3600),m=Math.floor(t%3600/60),sec=t%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(sec).padStart(2,'0');}
export function startClock(s,now=Date.now()){const n=night(s);if(n.running)return false;n.running=true;n.startedAt=now;return true;}
export function pauseClock(s,now=Date.now()){const n=night(s);if(!n.running)return false;n.banked=elapsed(s,now);n.running=false;n.startedAt=0;return true;}
export const isLong=(s,now=Date.now())=>elapsed(s,now)>night(s).longMs;
// Next turn: the finished turn goes in the log with its time, the clock restarts for the next player.
export function endTurn(s,now=Date.now()){
 const n=night(s),ms=elapsed(s,now),seat=s.turn%s.players.length,wasRunning=n.running;
 n.log.push({turn:s.turn+1,seat,ms,long:ms>n.longMs,note:n.note});n.log=n.log.slice(-80);n.note='';n.banked=0;n.startedAt=wasRunning?now:0;
 s.turnHistory.push(s.turn);s.turnHistory=s.turnHistory.slice(-80);s.turn++;return n.log.at(-1);
}
// Undo turn gives back the turn, its note and the time it had taken.
export function undoTurn(s,now=Date.now()){
 if(!s.turnHistory.length)return false;const n=night(s),e=n.log.pop();s.turn=s.turnHistory.pop();
 if(e&&e.turn===s.turn+1){n.note=e.note;n.banked=e.ms;n.startedAt=n.running?now:0;}else{n.note='';n.banked=0;n.startedAt=n.running?now:0;}return true;
}
export const setNote=(s,value)=>{night(s).note=text(value,200);};
export function setWinner(s,seat){const n=night(s);if(seat===null){n.winner=null;return true;}if(!seatOk(seat,s.players.length))return false;n.winner=n.winner===seat?null:seat;return true;}
// Table Spirit: friendly tallies the group opts into. Values are the group's to edit; nothing here is a rule.
export function setSpirit(s,on){night(s).spirit.on=!!on;}
export function setSpiritValue(s,kind,value){if(!SPIRIT_KINDS.includes(kind)||!int(Number(value),0,20))return false;night(s).spirit.values[kind]=Number(value);return true;}
export function spiritAward(s,seat,kind){
 const sp=night(s).spirit;if(!sp.on||!SPIRIT_KINDS.includes(kind)||!seatOk(seat,s.players.length))return false;
 if(kind==='firstBlood'){if(sp.firstBlood!==null)return false;sp.firstBlood=seat;}
 const t=sp.tally[seat]||(sp.tally[seat]={});t[kind]=Math.min(999,(t[kind]||0)+1);return true;
}
export function spiritUndo(s,seat,kind){
 const sp=night(s).spirit,t=sp.tally[seat];if(!t||!t[kind])return false;t[kind]--;if(!t[kind])delete t[kind];
 if(kind==='firstBlood'&&sp.firstBlood===seat)sp.firstBlood=null;return true;
}
export function spiritScores(s){const sp=night(s).spirit;return s.players.map(p=>{const t=sp.tally[p.id]||{};return {id:p.id,name:p.name,counts:{...t},points:SPIRIT_KINDS.reduce((a,k)=>a+(t[k]||0)*sp.values[k],0)};});}
// One line per finished or ongoing game, for the deck journal and the share sheet.
export function summary(s,now=Date.now()){
 const n=night(s),long=n.log.filter(e=>e.long).length,total=n.log.reduce((a,e)=>a+e.ms,0)+elapsed(s,now);
 return {game:s.game,players:s.players.map(p=>({name:p.name,life:p.life})),turns:s.turn+1,winner:n.winner===null?null:s.players[n.winner]?.name??null,longTurns:long,totalMs:total,spirit:n.spirit.on?spiritScores(s).map(x=>({name:x.name,points:x.points})):null};
}
// Deck journal: kept on this device next to the deck, never in Play.
export const journalKey=(game,deckId)=>privateKey('cardstashy-deck-journal-v1:'+game+':'+text(deckId,80));
export function loadJournal(game,deckId,storage=globalThis.localStorage){try{const a=JSON.parse(storage.getItem(journalKey(game,deckId)));return Array.isArray(a)?a.filter(e=>e&&typeof e.at==='number'&&typeof e.line==='string').slice(-60):[];}catch{return [];}}
export function addJournal(game,deckId,entry,storage=globalThis.localStorage){
 const all=loadJournal(game,deckId,storage),row={at:Number(entry.at)||Date.now(),line:text(entry.line,300)};if(!row.line.trim())return all;
 all.push(row);const kept=all.slice(-60);try{storage.setItem(journalKey(game,deckId),JSON.stringify(kept));}catch{}return kept;
}
export function journalLine(sum){
 const names=sum.players.map(p=>p.name).join(', ');
 return `${sum.turns} turn${sum.turns===1?'':'s'}, ${names}.${sum.winner?` ${sum.winner} won.`:''}${sum.longTurns?` ${sum.longTurns} long turn${sum.longTurns===1?'':'s'}.`:''}`;
}
