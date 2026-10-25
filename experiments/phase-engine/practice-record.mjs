// Account-local Practice records. No auth/database service or collection writes.
import {prepareMatchInput} from './match-input.mjs';
import {RUNTIME_IDENTITY} from './runtime-assets.mjs';
const identity=v=>typeof v==='string'&&/^[-\w]{1,160}$/.test(v);
export function practiceKey(ownerId,matchId){if(!identity(ownerId)||!identity(matchId)||matchId.length>80)throw Error('INVALID_MATCH_BINDING');return [ownerId,matchId];}
export function canonical(value){
 let nodes=0;
 function walk(v,depth){
  if(++nodes>100000||depth>24)throw Error('SNAPSHOT_LIMIT');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'&&v.length<=100000)return v;
  if(Array.isArray(v))return v.map(x=>walk(x,depth+1));
  if(v&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null))return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>{if(k.length>160)throw Error('SNAPSHOT_LIMIT');return [k,walk(v[k],depth+1)];}));
  throw Error('INVALID_SNAPSHOT');
 }
 const text=JSON.stringify(walk(value,0));if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('SNAPSHOT_LIMIT');return text;
}
export function validatePracticeInput(input){
 if(input?.schema!==1||input.runtimeIdentity!==RUNTIME_IDENTITY.wasmSha256)throw Error('INCOMPATIBLE_MATCH_INPUT');
 const rebuilt=prepareMatchInput({player:input.decks?.player,opponent:input.decks?.opponent,format:input.format,difficulty:input.difficulty,profile:input.profile??{},runtimeIdentity:input.runtimeIdentity});
 if(canonical(rebuilt)!==canonical(input))throw Error('MATCH_INPUT_MISMATCH');return rebuilt;
}
export async function snapshotDigest(input){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(validatePracticeInput(input)))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const transaction=(db,mode,run)=>new Promise((resolve,reject)=>{
 const t=db.transaction('matches',mode),store=t.objectStore('matches');let result,error;
 const finish=v=>{result=v;},abort=e=>{error=e;t.abort();};
 t.oncomplete=()=>resolve(result);t.onabort=()=>reject(error||Error('MATCH_STORE_FAILED'));t.onerror=()=>{};
 try{run(store,finish,abort);}catch(e){abort(e);}
});
export async function openPracticeDatabase(factory=indexedDB){return new Promise((resolve,reject)=>{const q=factory.open('cardstashy-practice-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('matches').createIndex('owner','ownerId');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('MATCH_STORE_UNAVAILABLE'));});}
export async function openPracticeRecord({ownerId,matchId,input,db,now=()=>Date.now()}={}){
 const key=practiceKey(ownerId,matchId),database=db||await openPracticeDatabase();
 const stored=await transaction(database,'readonly',(s,done)=>{const q=s.get(key);q.onsuccess=()=>done(q.result);});
 let frozen=input===undefined?stored?.input:validatePracticeInput(input);
 if(!frozen)throw Error('MATCH_SNAPSHOT_REQUIRED');frozen=validatePracticeInput(frozen);const digest=await snapshotDigest(frozen);
 if(stored&&(stored.schema!==1||stored.ownerId!==ownerId||stored.matchId!==matchId||stored.snapshotDigest!==digest||await snapshotDigest(stored.input)!==digest))throw Error('MATCH_SNAPSHOT_MISMATCH');
 let presentation=structuredClone(stored?.presentation||{});
 const validateRecord=r=>{if(r&&(r.schema!==1||r.ownerId!==ownerId||r.matchId!==matchId||r.snapshotDigest!==digest))throw Error('MATCH_SNAPSHOT_MISMATCH');return r;};
 const storage={
  read:async()=>{const r=await transaction(database,'readonly',(s,done)=>{const q=s.get(key);q.onsuccess=()=>done(q.result);});return validateRecord(r)?.journal;},
  write:(journal,expected)=>transaction(database,'readwrite',(s,done,abort)=>{
   const q=s.get(key);q.onsuccess=()=>{try{
    const prior=validateRecord(q.result);if((prior?.journal?.revision??null)!==expected)throw Error('WRITE_CONFLICT');
    let result=prior?.result??null;
    const response=Object.values(journal.receipts).find(r=>r.response.revision===journal.revision)?.response;
    if(response?.terminal){
     const winner=response.terminal.winner;if(winner!==null&&![0,1].includes(winner))throw Error('INVALID_MATCH_RESULT');
     if(result&&(result.revision!==journal.revision||result.winner!==winner))throw Error('RESULT_CONFLICT');
     result??={matchId,revision:journal.revision,winner,finishedAt:now(),snapshotDigest:digest,format:frozen.format,difficulty:frozen.difficulty};
    }
    if(prior?.result&&!response?.terminal)throw Error('RESULT_CONFLICT');
    s.put({schema:1,ownerId,matchId,snapshotDigest:digest,input:frozen,presentation,journal,result,createdAt:prior?.createdAt??now(),updatedAt:now()},key);done();
   }catch(e){abort(e);}};
  })
 };
 return {input:structuredClone(frozen),digest,storage,
  getPresentation:()=>structuredClone(presentation),setPresentation:value=>{if(stored)throw Error('ALREADY_EXISTS');canonical(value);presentation=structuredClone(value);},
  close:()=>{if(!db)database.close();}};
}
// UI callers receive summaries and explicit copy snapshots, never authority saves.
export async function listPracticeMatches(ownerId,{db}={}){
 practiceKey(ownerId,'list');const database=db||await openPracticeDatabase();
 try{return await transaction(database,'readonly',(s,done)=>{const q=s.index('owner').getAll(ownerId);q.onsuccess=()=>done(q.result.map(r=>({matchId:r.matchId,format:r.input.format,difficulty:r.input.difficulty,deckName:r.input.decks.player.name,opponentName:r.input.decks.opponent.name,revision:r.journal.revision,result:r.result,createdAt:r.createdAt,updatedAt:r.updatedAt})).sort((a,b)=>b.updatedAt-a.updatedAt));});}finally{if(!db)database.close();}
}
export async function copyPracticeOpponent(ownerId,matchId,{db}={}){
 const database=db||await openPracticeDatabase();try{return await transaction(database,'readonly',(s,done)=>{const q=s.get(practiceKey(ownerId,matchId));q.onsuccess=()=>done(q.result?structuredClone(q.result.input.decks.opponent):null);});}finally{if(!db)database.close();}
}
