// Private local table proof; configuration generated only after host provenance verification.
import {createJournal,fail} from './worker-journal.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {RUNTIME} from './runtime-config.mjs';
export const VERSION=RUNTIME.version;
const hashes=RUNTIME.hashes;
async function checked(path) {
 const response=await fetch(path);if(!response.ok)fail('PACKAGE_UNAVAILABLE');
 const bytes=await response.arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==hashes[path])fail('PACKAGE_MISMATCH');return bytes;
}
async function openStore(match) {
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('cardstashy-phase-research-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('matches');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 return {
  read:()=>new Promise((resolve,reject)=>{const t=db.transaction('matches','readonly'),q=t.objectStore('matches').get(match);t.oncomplete=()=>resolve(q.result);t.onabort=()=>reject(t.error);}),
  write:(value,expected)=>new Promise((resolve,reject)=>{
   const t=db.transaction('matches','readwrite'),s=t.objectStore('matches'),q=s.get(match);let conflict=false;
   q.onsuccess=()=>{if((q.result?.revision??null)!==expected){conflict=true;t.abort();}else s.put(value,match);};
   t.oncomplete=()=>resolve();t.onabort=()=>reject(Error(conflict?'WRITE_CONFLICT':'WRITE_FAILED'));
  })
 };
}
async function boot(epoch,match,mode) {
 const [js,wasm,cards]=await Promise.all(Object.keys(hashes).map(checked));
 const url=URL.createObjectURL(new Blob([js],{type:'text/javascript'}));
 let engine;try{engine=await import(url);}finally{URL.revokeObjectURL(url);}
 await engine.default({module_or_path:wasm});
 if(engine.load_card_database(new TextDecoder().decode(cards))!==RUNTIME.cardCount)fail('FIXTURE_MISMATCH');
 const format=engine.getFormatRegistry().find(f=>f.format===(RUNTIME.format||'Modern')).default_config;
 const {adapter,choose}=createMatchAuthority({engine,epoch,mode,format,decks:RUNTIME.decks||{player:{main_deck:[...Array(56).fill('Forest'),...Array(4).fill('Grizzly Bears')]},opponent:{main_deck:[...Array(57).fill('Forest'),...Array(3).fill('Grizzly Bears')]}}});
 const controller=mode.startsWith('human');
 return createJournal({engine:adapter,storage:await openStore(match),choose,version:controller?VERSION+':human-seat-v3'+(mode==='human-timed'?':clock-v1':''):VERSION,epoch,...(mode==='human-timed'?{timing:{matchId:match,humanActor:0}}:{})});
}
// One match per worker. The main thread receives only bounded diagnostic status;
// no authority save, raw legal action, library order, hand or event is posted.
let opening=null,boundEpoch=null;
globalThis.onmessage=async({data})=>{
 if(!opening){
  const {epoch,match,mode='auto'}=data||{};
  if(!data||Object.keys(data).some(k=>!['v','epoch','id','op','match','mode'].includes(k))||!['auto','human','human-timed'].includes(mode)||data?.op!=='bind'||!/^[-\w]{1,80}$/.test(epoch||'')||!/^[-\w]{1,80}$/.test(match||'')){postMessage({v:1,epoch:null,id:null,ok:false,error:'BIND_REQUIRED'});return;}
  boundEpoch=epoch;opening=boot(epoch,match,mode);
  try{await opening;postMessage({v:1,epoch,id:'bind',ok:true});}
  catch{postMessage({v:1,epoch,id:'bind',ok:false,error:'BOOT_FAILED'});}return;
 }
 try{const handler=await opening;postMessage(await handler(data));}
 catch{postMessage({v:1,epoch:boundEpoch,id:data?.id,ok:false,error:'BOOT_FAILED'});}
};


