// Completed results only. This host-side store contains no engine save, hidden
// game zones, ordered library, account credentials or match-resume mechanism.
import {MATCH_END_REASONS} from './match-result.mjs';
const PREFIX='cardstashy-practice-results-v1:';
const identity=v=>typeof v==='string'&&/^[-\w]{1,160}$/.test(v);
const matchId=v=>identity(v)&&v.length<=80;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const label=v=>typeof v==='string'&&v.length<=512;
const maxBytes=512000;
function deckSnapshot(deck){
 if(!deck||!label(deck.name)||!['Standard','Commander'].includes(deck.format))throw Error('INVALID_RESULT_DECK');
 const rows=value=>{if(!Array.isArray(value)||value.length>2500)throw Error('INVALID_RESULT_DECK');return value.map(row=>{if(!row||!label(row.name)||!row.name||!Number.isSafeInteger(row.qty)||row.qty<1||row.qty>1000)throw Error('INVALID_RESULT_DECK');const copy={name:row.name,qty:row.qty};for(const key of ['printingId','finish','set','setNumber','collectorNumber','lang'])if(row[key]!==undefined){if(typeof row[key]!=='string'||row[key].length>512)throw Error('INVALID_RESULT_DECK');copy[key]=row[key];}return copy;});};
 const result={name:deck.name,format:deck.format,cards:rows(deck.cards),side:rows(deck.side||[])};
 if(deck.commander!==undefined){if(!label(deck.commander))throw Error('INVALID_RESULT_DECK');result.commander=deck.commander;}
 if(deck.commanders!==undefined)result.commanders=rows(deck.commanders);
 return result;
}
function validate(row){
 if(!row||row.schema!==1||!matchId(row.matchId)||!identity(row.ownerId)||!digest(row.snapshotDigest)||!Number.isSafeInteger(row.revision)||row.revision<0||![0,1,null].includes(row.winner)||!MATCH_END_REASONS.includes(row.reason)||!Number.isSafeInteger(row.finishedAt)||row.finishedAt<0||!['Standard','Commander'].includes(row.format)||!['Easy','Medium','Hard'].includes(row.difficulty))throw Error('INVALID_RESULT_HISTORY');
 const result={schema:1,ownerId:row.ownerId,matchId:row.matchId,snapshotDigest:row.snapshotDigest,revision:row.revision,winner:row.winner,reason:row.reason,finishedAt:row.finishedAt,format:row.format,difficulty:row.difficulty,decks:{player:deckSnapshot(row.decks?.player),opponent:deckSnapshot(row.decks?.opponent)}};
 if(result.decks.player.format!==result.format||result.decks.opponent.format!==result.format||new TextEncoder().encode(JSON.stringify(result)).length>maxBytes)throw Error('INVALID_RESULT_HISTORY');return result;
}
export function createPracticeResultHistory({storage=()=>globalThis.localStorage,now=()=>Date.now(),maxEntries=50}={}){
 if(typeof storage!=='function'||typeof now!=='function'||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>100)throw Error('INVALID_HISTORY_OPTIONS');
 const store=()=>{const s=storage();if(!s||typeof s.getItem!=='function'||typeof s.setItem!=='function'||typeof s.key!=='function'||typeof s.removeItem!=='function')throw Error('RESULT_HISTORY_UNAVAILABLE');return s;};
 const prefix=ownerId=>{if(!identity(ownerId))throw Error('INVALID_RESULT_OWNER');return PREFIX+ownerId+':';};
 const key=(ownerId,id)=>{if(!matchId(id))throw Error('INVALID_RESULT_MATCH');return prefix(ownerId)+id;};
 function list(ownerId){const p=prefix(ownerId),s=store(),rows=[];for(let n=0;n<s.length;n++){const k=s.key(n);if(!k?.startsWith(p))continue;try{const row=validate(JSON.parse(s.getItem(k)));if(row.ownerId===ownerId&&key(ownerId,row.matchId)===k)rows.push(row);}catch{ /* Corrupt local rows are never shown as match evidence. */ }}return rows.sort((a,b)=>b.finishedAt-a.finishedAt||a.matchId.localeCompare(b.matchId)).slice(0,maxEntries).map(structuredCloneSafe);}
 function record(ownerId,{matchId:id,snapshotDigest,revision,terminal,input}){
  if(!terminal)throw Error('TERMINAL_RESULT_REQUIRED');
  const k=key(ownerId,id),s=store(),existing=s.getItem(k);
  const candidate=validate({schema:1,ownerId,matchId:id,snapshotDigest,revision,winner:terminal.winner,reason:terminal.reason,finishedAt:existing?JSON.parse(existing).finishedAt:now(),format:input?.format,difficulty:input?.difficulty,decks:input?.decks});
  if(existing){const prior=validate(JSON.parse(existing));if(JSON.stringify(prior)!==JSON.stringify(candidate))throw Error('RESULT_CONFLICT');return structuredClone(prior);}
  // A failed write cannot erase an existing result. Pruning follows success.
  s.setItem(k,JSON.stringify(candidate));
  const p=prefix(ownerId),rows=[];for(let n=0;n<s.length;n++){const name=s.key(n);if(!name?.startsWith(p))continue;try{const row=validate(JSON.parse(s.getItem(name)));if(row.ownerId===ownerId&&key(ownerId,row.matchId)===name)rows.push({name,row});}catch{}}
  rows.sort((a,b)=>b.row.finishedAt-a.row.finishedAt||a.row.matchId.localeCompare(b.row.matchId));for(const old of rows.slice(maxEntries))try{s.removeItem(old.name);}catch{}
  return structuredClone(candidate);
 }
 return {record,list};
}
function structuredCloneSafe(value){return structuredClone(value);}
export const practiceResultHistory=createPracticeResultHistory();
