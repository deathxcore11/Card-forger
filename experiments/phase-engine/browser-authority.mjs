import {submitHumanCommand} from './human-command.mjs';
import {createJournal,fail} from './worker-journal.mjs';
import {describeChoices} from './smoke-policy-worker.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {createSeatController} from './seat-surface.mjs';
const PIN='71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234';
export const VERSION=PIN+':browser-smoke-v1';
const hashes={
 '/runtime/engine_wasm.js':'47c42e78d34eeaad37d74b8163e5319d0578ba0ee8bd3476cfb70131de6287c9',
 '/runtime/engine_wasm_bg.wasm':'6057521d851bb8544eaeea467f741b90cd2941aa5ba2fddb17e1bcc3d9933f8f',
 '/runtime/cards.json':'ee062b8ad351e067723b79fc8462aaea19202ef9756d35b2101334eb3e350107'};
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
 if(engine.load_card_database(new TextDecoder().decode(cards))!==3)fail('FIXTURE_MISMATCH');
 const format=engine.getFormatRegistry().find(f=>f.format==='Modern').default_config;
 const policy=new Worker(new URL('./smoke-policy-worker.mjs',import.meta.url),{type:'module'});let seq=0;
 const smokeChoose=(actions,rng)=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{cleanup();policy.terminate();reject(Error('POLICY_TIMEOUT'));},5000);
  const cleanup=()=>{clearTimeout(timer);policy.removeEventListener('message',onMessage);policy.removeEventListener('error',onError);};
  const onMessage=({data})=>{if(data?.id!==id)return;cleanup();data.error?reject(Error('POLICY_FAILED')):resolve(data);};
  const onError=()=>{cleanup();reject(Error('POLICY_FAILED'));};
  policy.addEventListener('message',onMessage);policy.addEventListener('error',onError);
  policy.postMessage({id,choices:describeChoices(actions),rng});
 });
 const controller=mode.startsWith('human')?createSeatController({engine,seat:0,epoch}):null;
 const choose=(actions,rng,context)=>{
  if(controller&&context.actor===0)return controller.select(actions,rng,context);
  if(context.choice!==undefined)fail('WRONG_SEAT');
  return smokeChoose(actions,rng);
 };
 const adapter={
  clockContext(revision){
   const w=engine.get_filtered_game_state(0).state.waiting_for;
   const interaction=engine.get_viewer_snapshot_js(0).viewerInteraction;
   const actor=w?.type==='Priority'?w.data.player:interaction?.canSubmit&&interaction.authorizedSubmitters?.includes(0)?0:1;
   return {actor,kind:w?.type||'Unavailable',decisionId:`decision-${revision}`};
  },
  humanSeat:controller?0:null,
  act:controller?command=>submitHumanCommand(engine,command):undefined,
  respond:controller?submission=>{const r=engine.submit_interaction_js(0,submission);if(['applied','Applied'].includes(r.status))return true;if(['rejected','Rejected'].includes(r.status))return false;fail('ENGINE_FAILED');}:undefined,
  start(seed,first){const result=engine.initialize_game({player:{main_deck:[...Array(56).fill('Forest'),...Array(4).fill('Grizzly Bears')]},opponent:{main_deck:[...Array(57).fill('Forest'),...Array(3).fill('Grizzly Bears')]}},seed,format,null,2,first);if(!Array.isArray(result.events))fail('INITIALIZE_FAILED');},
  save:()=>engine.export_game_state_json(),restore:s=>engine.restore_game_state(s),
  summary(revision){const s=engine.get_filtered_game_state(0).state;return {turn:s.turn_number,waiting:s.waiting_for?.type||null,terminal:s.waiting_for?.type==='GameOver'?{winner:s.waiting_for.data?.winner??null}:null,...(controller?{surface:{...controller.read(revision),awaitingHuman:engine.get_viewer_snapshot_js(0).viewerInteraction.authorizedSubmitters?.includes(0)===true,interaction:projectInteraction(engine.get_viewer_snapshot_js(0).viewerInteraction,0)}}:{})};},
  legal(){for(const actor of [0,1]){const {actions}=engine.get_legal_actions_for_viewer_js(actor);if(actions.length)return {actor,actions};}return {actor:null,actions:[]};},
  apply(actor,action){const r=engine.submit_action(actor,action);if(!['applied','Applied'].includes(r.status))fail('ENGINE_REJECTED');}
 };
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


