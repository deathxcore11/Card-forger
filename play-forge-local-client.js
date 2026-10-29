// The Forge engine inside the Android app: the same client surface as
// createForgeHostClient, answered by the CardStashyForge native plugin instead of the
// server. The card database stays loaded between matches, so only the first match
// after launch waits for it. No network is involved in a match.
import {ACTION_REJECTIONS,FORGE_REVISION,exactDigest,forgeAccountKey} from './play-forge-host-client.js';
const SCHEMA='cardstashy.forge-proof.v1';
const fail=code=>Object.assign(Error(code),{code});
const plugin=()=>{try{return globalThis.Capacitor?.isNativePlatform?.()?globalThis.Capacitor.Plugins?.CardStashyForge||null:null;}catch{return null;}};
export const localForgeAvailable=()=>!!plugin();
// Unpack the engine (first launch only) and load the card database in the background.
// Safe to call often; it returns at once while loading and when already loaded.
export async function prepareLocalForge(){const p=plugin();if(!p)return null;try{return await p.prepare();}catch{return null;}}
export function createForgeLocalClient({readAccount,newId=()=>crypto.randomUUID(),now=Date.now}={}){
 const native=plugin();if(!native)throw fail('LOCAL_ENGINE_UNAVAILABLE');
 const ownerKey=forgeAccountKey(readAccount?.());
 let allocation=null,creating=false,closed=false,blocked=false,submitting=false,error=null,terminal=null,expectedViewer=null,startedAt=0;
 const current=()=>{const a=readAccount?.();if(forgeAccountKey(a)!==ownerKey||a?.locked||a?.switching)throw fail('ACCOUNT_CHANGED');};
 const status=()=>({blocked:blocked||closed,outcomePending:false,error,allocation:allocation?structuredClone(allocation):null,terminal:terminal?structuredClone(terminal):null});
 const call=async(method,path,body)=>{const r=await native.request({method,path,...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:r.body?JSON.parse(r.body):null};};
 return {
  status,
  async create(input){
   if(closed||creating||allocation)throw fail('MATCH_ALREADY_OPEN');
   current();creating=true;
   try{
    const sent=JSON.parse(JSON.stringify(input));
    const [human,opponent]=await Promise.all([exactDigest(sent.humanDeck),exactDigest(sent.opponentDeck)]);
    startedAt=now();
    const r=await native.start({input:JSON.stringify({input:sent})});
    allocation={matchId:r.matchId||newId(),generation:newId(),expiresAt:now()+7200000,deckDigests:{human,opponent}};
    return structuredClone(allocation);
   }catch(e){blocked=true;error=e.code||'LOCAL_ENGINE_START_FAILED';throw e;}finally{creating=false;}
  },
  async read(){
   if(closed||!allocation)throw fail('MATCH_NOT_OPEN');
   current();
   const {status:code,data:s}=await call('GET','/state');
   if(code!==200||!s)throw fail('LOCAL_ENGINE_UNREADABLE');
   if(s.status==='initializing'){const ms={engine:now()-startedAt};return {status:'initializing',progress:{warm:true,step:'engine',ms}};}
   if(s.status==='failed'){
    blocked=true;error='native_interrupted';
    const errors=Array.isArray(s.initialization?.errors)?s.initialization.errors.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,512)):[];
    throw Object.assign(fail('native_interrupted'),{status:410,details:errors,...(typeof s.failure==='string'?{failure:s.failure.slice(0,160)}:{})});
   }
   if(s.schema!==SCHEMA||s.forgeRevision!==FORGE_REVISION||!Number.isSafeInteger(s.viewer))throw fail('HOST_NATIVE_PROJECTION_MISMATCH');
   if(expectedViewer!==null&&s.viewer!==expectedViewer)throw fail('HOST_NATIVE_PROJECTION_MISMATCH');expectedViewer=s.viewer;
   if(s.status==='finished'){
    const result={draw:s.draw===true,winnerPlayerId:s.draw===true?null:Number.isSafeInteger(s.winnerPlayerId)?s.winnerPlayerId:null};
    terminal=result;blocked=true;return {status:'finished',viewerId:s.viewer,result:structuredClone(result)};
   }
   // The same projection the server sends: its private deck receipt stays inside.
   delete s.initialization;
   return {status:'running',snapshot:s};
  },
  async submit(action){
   if(!allocation||closed||blocked||submitting)throw fail(error||'MATCH_NOT_READY');
   current();submitting=true;const commandId=newId();
   try{
    const {status:code,data}=await call('POST','/action',structuredClone(action));
    if(code===202)return {commandId,state:'accepted'};
    const reason=typeof data?.error==='string'&&Object.hasOwn(ACTION_REJECTIONS,data.error)?data.error:'native_action_rejected';
    throw Object.assign(fail(reason),{status:code,message:ACTION_REJECTIONS[reason]});
   }finally{submitting=false;}
  },
  async close(){if(closed)return;closed=true;blocked=true;try{await native.close();}catch{}error=null;},
  release(){if(closed)return false;closed=true;blocked=true;void Promise.resolve().then(()=>native.close()).catch(()=>{});return true;},
  detach(){closed=true;blocked=true;allocation=null;terminal=null;expectedViewer=null;},
 };
}
