// Finished Forge matches, kept on this device per account, so a deck shows its record
// the way Arena, Hearthstone and Snap do. Only results Forge confirmed are kept.
import {privateKey} from './account-scope.js';
const KEY='cardstashy-play-record-v1',LIMIT=300;
const text=(v,n=160)=>typeof v==='string'?v.trim().slice(0,n):'';
export const deckRecordKey=deck=>deck?.id!=null?'id:'+String(deck.id):text(deck?.name)?'name:'+text(deck.name).toLowerCase():null;
function read(storage){
 try{const rows=JSON.parse(storage.getItem(privateKey(KEY))||'[]');return Array.isArray(rows)?rows.filter(r=>r&&['win','loss','draw'].includes(r.outcome)):[];}catch{return [];}
}
// The Chronicle page of one match (match-facts.js chronicle()): plain numbers and card names, trimmed.
const whole=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;
export function cleanChronicle(c){
 if(!c||typeof c!=='object')return null;
 const side=w=>w==='you'||w==='opp'?w:null;
 const out={
  ms:whole(c.ms,2e8),kills:whole(c.kills,999),losses:whole(c.losses,999),
  longest:c.longest&&whole(c.longest.ms,2e8)!==null?{ms:whole(c.longest.ms,2e8),who:side(c.longest.who),n:whole(c.longest.n,999)}:null,
  swing:c.swing&&whole(c.swing.dmg,9999)>0?{dmg:whole(c.swing.dmg,9999),who:side(c.swing.who),n:whole(c.swing.n,999)}:null,
  standout:c.standout&&text(c.standout.name,80)?{name:text(c.standout.name,80),power:whole(c.standout.power,999)}:null,
  moments:(Array.isArray(c.moments)?c.moments:[]).slice(0,6).map(m=>({turn:whole(m?.turn,999),life:Number.isSafeInteger(m?.life)?m.life:null,oppLife:Number.isSafeInteger(m?.oppLife)?m.oppLife:null,board:(Array.isArray(m?.board)?m.board:[]).map(n=>text(n,80)).filter(Boolean).slice(0,3)})).filter(m=>m.turn!==null),
 };
 return out;
}
export function matchHistory({storage=globalThis.localStorage}={}){return read(storage);}
// One finished match. outcome is win, loss or draw; anything else is not recorded.
export function recordMatch(entry,{storage=globalThis.localStorage,now=Date.now()}={}){
 if(!['win','loss','draw'].includes(entry?.outcome))return null;
 const key=deckRecordKey(entry.deck);if(!key)return null;
 const num=v=>Number.isSafeInteger(v)?v:null;
 const row={at:now,outcome:entry.outcome,deck:{key,name:text(entry.deck.name)},opponent:{key:deckRecordKey(entry.opponent),name:text(entry.opponent?.name)},
  format:text(entry.format,80),playStyle:text(entry.playStyle,20),onPlay:typeof entry.onPlay==='boolean'?entry.onPlay:null,turns:num(entry.turns),life:num(entry.life),opponentLife:num(entry.opponentLife),durationMs:num(entry.durationMs),conceded:entry.conceded===true,chronicle:cleanChronicle(entry.chronicle)};
 const rows=[...read(storage),row].slice(-LIMIT);
 try{storage.setItem(privateKey(KEY),JSON.stringify(rows));}catch{/* a full or blocked store keeps the match off the record */}
 return row;
}
// Wins, losses and draws for one deck, split by going first or second.
export function deckRecord(deck,{storage=globalThis.localStorage}={}){
 const key=deckRecordKey(deck),out={wins:0,losses:0,draws:0,onPlay:{wins:0,games:0},onDraw:{wins:0,games:0},streak:0,last:null};
 if(!key)return out;
 const rows=read(storage).filter(r=>r.deck?.key===key);
 for(const r of rows){
  out[r.outcome==='win'?'wins':r.outcome==='loss'?'losses':'draws']++;
  const side=r.onPlay===true?out.onPlay:r.onPlay===false?out.onDraw:null;if(side){side.games++;if(r.outcome==='win')side.wins++;}
 }
 // Streak counts back from the newest game: positive for wins, negative for losses.
 for(let i=rows.length-1;i>=0;i--){const o=rows[i].outcome;if(o==='draw')break;const d=o==='win'?1:-1;if(out.streak&&Math.sign(out.streak)!==d)break;out.streak+=d;}
 out.last=rows.at(-1)||null;
 return out;
}
export const recordLine=r=>`${r.wins}–${r.losses}${r.draws?'–'+r.draws:''}`;
// The moment a deck is proudest of: its biggest swing in a win, else a moment you flagged.
export function bestMoment(deck,{storage=globalThis.localStorage}={}){
 const key=deckRecordKey(deck);if(!key)return null;
 const rows=read(storage).filter(r=>r.deck?.key===key&&r.chronicle);
 const swing=rows.filter(r=>r.outcome==='win'&&r.chronicle.swing).sort((a,b)=>b.chronicle.swing.dmg-a.chronicle.swing.dmg)[0];
 if(swing)return `${swing.chronicle.swing.dmg} damage in one turn`;
 const flagged=rows.filter(r=>r.chronicle.moments?.length).at(-1);
 return flagged?`Turn ${flagged.chronicle.moments[0].turn} remembered`:null;
}
// The deck's latest matches with their Chronicle, newest first, for rereading.
export function deckChronicles(deck,{storage=globalThis.localStorage,limit=5}={}){
 const key=deckRecordKey(deck);if(!key)return [];
 return read(storage).filter(r=>r.deck?.key===key&&r.chronicle).slice(-limit).reverse();
}
export const clock=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
