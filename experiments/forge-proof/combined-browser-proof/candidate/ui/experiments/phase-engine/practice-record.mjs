// Account-local Practice records. No auth/database service or collection writes.
import {journalMatchResult} from './match-result.mjs';
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
 // Acknowledged journal/result writes must request disk durability. The
 // browser default may acknowledge before flushing, which is insufficient
 // for crash recovery. Fail closed if the browser cannot honor this mode.
 const t=mode==='readwrite'?db.transaction('matches',mode,{durability:'strict'}):db.transaction('matches',mode);
 if(mode==='readwrite'&&t.durability!=='strict'){t.abort();throw Error('MATCH_STORE_UNAVAILABLE');}
 const store=t.objectStore('matches');let result,error;
 const finish=v=>{result=v;},abort=e=>{error=e;t.abort();};
 t.oncomplete=()=>resolve(result);t.onabort=()=>reject(error||Error('MATCH_STORE_FAILED'));t.onerror=()=>{};
 try{run(store,finish,abort);}catch(e){abort(e);}
});
export async function openPracticeDatabase(factory=indexedDB){return new Promise((resolve,reject)=>{const q=factory.open('cardstashy-practice-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('matches').createIndex('owner','ownerId');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('MATCH_STORE_UNAVAILABLE'));});}
export async function openPracticeRecord({ownerId,matchId,input,db,now=()=>Date.now()}={}){
 const key=practiceKey(ownerId,matchId);let closed=false;
 // Match handles retain snapshots, not an idle database connection across
 // runtime loading or every turn. Each owned transaction closes before its
 // acknowledgement reaches the journal; injected databases remain caller-owned.
 const transact=async(mode,run)=>{if(closed)throw Error('MATCH_STORE_CLOSED');const database=db||await openPracticeDatabase();try{return await transaction(database,mode,run);}finally{if(!db)database.close();}};
 const stored=await transact('readonly',(s,done)=>{const q=s.get(key);q.onsuccess=()=>done(q.result);});
 let frozen=input===undefined?stored?.input:validatePracticeInput(input);
 if(!frozen)throw Error('MATCH_SNAPSHOT_REQUIRED');frozen=validatePracticeInput(frozen);const digest=await snapshotDigest(frozen);
 if(stored&&(stored.schema!==1||stored.ownerId!==ownerId||stored.matchId!==matchId||stored.snapshotDigest!==digest||await snapshotDigest(stored.input)!==digest))throw Error('MATCH_SNAPSHOT_MISMATCH');
 let presentation=structuredClone(stored?.presentation||{});
 const validateRecord=r=>{if(r&&(r.schema!==1||r.ownerId!==ownerId||r.matchId!==matchId||r.snapshotDigest!==digest))throw Error('MATCH_SNAPSHOT_MISMATCH');return r;};
 const storage={
  read:async()=>{const r=await transact('readonly',(s,done)=>{const q=s.get(key);q.onsuccess=()=>done(q.result);});return validateRecord(r)?.journal;},
  write:(journal,expected)=>transact('readwrite',(s,done,abort)=>{
   const q=s.get(key);q.onsuccess=()=>{try{
    const prior=validateRecord(q.result);if((prior?.journal?.revision??null)!==expected)throw Error('WRITE_CONFLICT');
    const result=journalMatchResult(journal,{matchId,snapshotDigest:digest,format:frozen.format,difficulty:frozen.difficulty,now},prior?.result??null);
    s.put({schema:1,ownerId,matchId,snapshotDigest:digest,input:frozen,presentation,journal,result,createdAt:prior?.createdAt??now(),updatedAt:now()},key);done();
   }catch(e){abort(e);}};
  })
 };
 return {input:structuredClone(frozen),digest,storage,
  getPresentation:()=>structuredClone(presentation),setPresentation:value=>{if(stored)throw Error('ALREADY_EXISTS');canonical(value);presentation=structuredClone(value);},
  close:()=>{closed=true;}};
}
// UI callers receive summaries and explicit copy snapshots, never authority saves.
export async function listPracticeMatches(ownerId,{db}={}){
 practiceKey(ownerId,'list');const database=db||await openPracticeDatabase();
 try{return await transaction(database,'readonly',(s,done)=>{const q=s.index('owner').getAll(ownerId);q.onsuccess=()=>done(q.result.map(r=>({matchId:r.matchId,format:r.input.format,difficulty:r.input.difficulty,deckName:r.input.decks.player.name,opponentName:r.input.decks.opponent.name,revision:r.journal.revision,result:r.result,createdAt:r.createdAt,updatedAt:r.updatedAt})).sort((a,b)=>b.updatedAt-a.updatedAt));});}finally{if(!db)database.close();}
}
export async function copyPracticeOpponent(ownerId,matchId,{db}={}){
 const database=db||await openPracticeDatabase();try{return await transaction(database,'readonly',(s,done)=>{const q=s.get(practiceKey(ownerId,matchId));q.onsuccess=()=>done(q.result?structuredClone(q.result.input.decks.opponent):null);});}finally{if(!db)database.close();}
}
