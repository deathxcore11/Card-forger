// Account-deck integration candidate. Not mounted or publicly activated.
import {loadEngineAssets,RUNTIME_IDENTITY} from './runtime-assets.mjs';
import {openPracticeRecord} from './practice-record.mjs';
import {openPracticeSessionRecord} from './practice-session-record.mjs';
import {initialPresentation,presentInstances} from './practice-presentation.mjs';
import {evaluateMatchAdmission} from './match-input.mjs';
import {PRACTICE_COVERAGE} from './practice-coverage.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {createJournal} from './worker-journal.mjs';
import {CPU_CONFIGURATION_VERSION} from './cpu-difficulty-config.mjs';
const VERSION='practice-candidate-v2:'+CPU_CONFIGURATION_VERSION;
let opening=null,epoch=null,sessionOnly=false;
export function validPracticeBinding(data){
 return !!data&&typeof data==='object'&&!Array.isArray(data)&&!Object.keys(data).some(k=>!['v','epoch','id','op','ownerId','match','operation','input','sessionOnly'].includes(k))&&data.v===1&&data.id==='bind'&&data.op==='bind'&&/^[-\w]{1,80}$/.test(data.epoch||'')&&['create','resume'].includes(data.operation)&&!(data.operation==='resume'&&Object.hasOwn(data,'input'))&&(!Object.hasOwn(data,'sessionOnly')||typeof data.sessionOnly==='boolean');
}
async function boot(data){
 const record=await (sessionOnly?openPracticeSessionRecord:openPracticeRecord)({ownerId:data.ownerId,matchId:data.match,...(data.operation==='create'?{input:data.input}:{})});
 const {input,digest}=record;
 const {engine}=await loadEngineAssets({baseURL:new URL('./runtime/a86578b23adcd26c/',import.meta.url),loadCards:true,onProgress:value=>postMessage({v:1,epoch,id:'loading',progress:value})});
 const admission=evaluateMatchAdmission(engine,input,PRACTICE_COVERAGE);
 const format=engine.getFormatRegistry().find(f=>f.format===input.format)?.default_config;
 if(!format)throw Error('FORMAT_UNAVAILABLE');
 // Difficulty calibration is unfinished; do not silently serve one policy
 // behind three strength labels. This private integration proof uses Medium.
 const cpuAvailable=input.difficulty==='Medium';
 let handler=null;
 if(admission.admitted&&cpuAvailable){
  let presentation=record.getPresentation();
  const {adapter,choose}=createMatchAuthority({engine,epoch,format,decks:input.engineLists,difficulty:input.difficulty,cpuPlaybookProposals:[input.decks.player.practiceCpuPlan,input.decks.opponent.practiceCpuPlan],
   onStart:()=>{presentation=initialPresentation(input,JSON.parse(engine.export_game_state_json()));record.setPresentation(presentation);},
   present:view=>presentInstances(view,presentation)});
  handler=createJournal({engine:adapter,storage:record.storage,choose,version:VERSION+':'+RUNTIME_IDENTITY.wasmSha256+':'+digest,epoch,timing:{matchId:data.match,humanActor:0},turnLimits:data.sessionOnly?{}:null});
 }
 return {handler,binding:{sessionOnly,admission,cpuAvailable,format:input.format,difficulty:input.difficulty,profile:input.profile,deckName:input.decks.player.name,opponentName:input.decks.opponent.name,snapshotDigest:digest,runtimeIdentity:input.runtimeIdentity,deckContexts:{player:input.decks.player.practiceContext||null,opponent:input.decks.opponent.practiceContext||null}}};
}
globalThis.onmessage=async({data})=>{
 if(!opening){
  if(!validPracticeBinding(data)){postMessage({v:1,epoch:null,id:null,ok:false,error:'BIND_REQUIRED'});return;}
  if(data.sessionOnly===true&&data.operation==='resume'){postMessage({v:1,epoch:data.epoch,id:'bind',ok:false,error:'SESSION_RESUME_UNAVAILABLE'});return;}
  sessionOnly=data.sessionOnly===true;
  epoch=data.epoch;opening=boot(data);
  try{const {binding}=await opening;postMessage({v:1,epoch,id:'bind',ok:true,result:binding});}
  catch(error){const safe=new Set(['INVALID_MATCH_BINDING','MATCH_SNAPSHOT_REQUIRED','MATCH_SNAPSHOT_MISMATCH','INCOMPATIBLE_MATCH_INPUT','MATCH_INPUT_MISMATCH','MATCH_STORE_UNAVAILABLE','MATCH_STORE_FAILED','RUNTIME_ASSET_UNAVAILABLE','RUNTIME_ASSET_MISMATCH','RULES_IDENTITY_MISMATCH']);postMessage({v:1,epoch,id:'bind',ok:false,error:safe.has(error.message)?error.message:'BOOT_FAILED'});}return;
 }
 if(sessionOnly&&data?.op==='resume'){postMessage({v:1,epoch,id:data?.id,ok:false,error:'SESSION_RESUME_UNAVAILABLE'});return;}
 try{const {handler}=await opening;if(!handler){postMessage({v:1,epoch,id:data?.id,ok:false,error:'MATCH_NOT_ADMITTED'});return;}postMessage(await handler(data));}
 catch{postMessage({v:1,epoch,id:data?.id,ok:false,error:'BOOT_FAILED'});}
};
