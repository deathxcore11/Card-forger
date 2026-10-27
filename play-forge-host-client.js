// Same-origin host transport only. No local bridge credential, URL override,
// persistence, automatic command retry, or card-provider request is supported.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import {forgeCpuPolicy} from './play-forge-cpu-policy.js';
export const FORGE_REVISION='e5a0f8156da70ffc7866f923bed371c0111707cd';
const SCHEMA='cardstashy.forge-proof.v1';
// The acceptance page is mounted on the same account origin. Its private
// service route uses this prefix; the production module keeps the root route.
const API_PREFIX=new URL(import.meta.url).pathname.startsWith('/__forge-acceptance/')?'/__forge-acceptance':'';
const fail=code=>Object.assign(Error(code),{code});
// Shown while the server settles an action whose reply was lost; the table unlocks by itself.
const OUTCOME_PENDING='Checking whether your last action went through. The table will update in a moment.';
const ACTION_REJECTIONS=Object.freeze({
 stale_revision:'The game has moved on. Review the current table before choosing again.',
 stale_prompt:'That choice has changed. Review the current prompt before choosing again.',
 native_engine_busy:'Forge is still completing your previous action. Wait for the table to update.',
 native_input_changed:'The available action has changed. Review the current table before choosing again.',
 native_dialog_requires_reply:'Complete the open choice before taking another action.',
 ok_disabled:'That payment or confirmation is no longer available. Review the current prompt.',
 cancel_disabled:'Cancel is no longer available for this choice. Review the current prompt.',
 native_match_unavailable:'Forge cannot accept actions for this match right now.',
 native_game_finished:'This match has finished. Wait for the result.',
 native_concession_in_progress:'Forge is completing your concession. Wait for the result.',
 exact_initialization_unverified:'The match is not ready to accept actions.',
 native_action_rejected:'Forge did not accept that action. Review the current table before choosing again.',
});
export const forgeAccountKey=a=>JSON.stringify([a?.user?.id,a?.accountGeneration??a?.generation??null,!!a?.locked,!!a?.switching]);
export async function exactDigest(value){
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value)))))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function exactForgeInput(setup,{startingPlayer=setup?.match?.startingPlayer??'random'}={}){
 if(setup?.match?.mode!=='cpu'||!setup.selected||!setup.opponent||!['Commander','Standard','Modern'].includes(setup.match.format))throw fail('FORGE_SETUP_INCOMPLETE');
 const {difficultyPolicyVersion}=forgeCpuPolicy(setup.match.difficulty);
 const playStyle=setup.playStyle==='quick'?'quick':'practice';
 if(!['random','first','second'].includes(startingPlayer))throw fail('FORGE_STARTING_PLAYER_INVALID');
 if(playStyle==='quick')startingPlayer='random';
 // Preserve both exact snapshots. The host binds the opening preference and
 // Forge reports the actual starting player before the opening hand.
 return structuredClone({format:setup.match.format,humanDeck:setup.selected,opponentDeck:setup.opponent,difficultyPolicyVersion,startingPlayer,playStyle});
}
export function createForgeHostClient({readAccount,getAccessToken,fetchImpl=globalThis.fetch,timeoutMs=15000,newId=()=>crypto.randomUUID()}={}){
 if(typeof readAccount!=='function'||typeof getAccessToken!=='function'||typeof fetchImpl!=='function')throw fail('FORGE_HOST_READERS_REQUIRED');
 const owner=readAccount(),ownerKey=forgeAccountKey(owner);
 if(!UUID.test(owner?.user?.id||'')||owner.locked||owner.switching)throw fail('ACCOUNT_CHANGED');
 let allocation=null,creating=false,closed=false,closeRequested=false,submitting=false,blocked=false,unsettled=null,error=null,terminal=null,nextReadAt=0,expectedViewer=null,knownPlayers=null,requestedPregame=null,acceptedPregame=null,lastToken=null;
 const current=()=>{const a=readAccount();if(forgeAccountKey(a)!==ownerKey||a.locked||a.switching)throw fail('ACCOUNT_CHANGED');};
 const status=()=>({blocked:blocked||closed||unsettled!==null,outcomePending:unsettled!==null,error,allocation:allocation?structuredClone(allocation):null,terminal:terminal?structuredClone(terminal):null});
 async function request(path,{method='GET',body,headers={},expectedCommandId}={}){
  current();const token=await getAccessToken();current();if(path==='/api/play/matches'&&closeRequested)throw fail('MATCH_CLOSED');
  if(typeof token!=='string'||!token||token.length>8192||!/^[-A-Za-z0-9._]+$/.test(token))throw fail('AUTHENTICATION_REQUIRED');
  lastToken=token;
  const controller=new AbortController();let timer;
  const work=(async()=>{
   const r=await fetchImpl(API_PREFIX+path,{method,body:body===undefined?undefined:JSON.stringify(body),headers:{Accept:'application/json',Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal});
   controller.signal.throwIfAborted();let data=null;if(r.status!==204){
    const declared=Number(r.headers?.get('content-length'));if(declared>4*1024*1024)throw fail('HOST_RESPONSE_TOO_LARGE');
    // Body remains under the same deadline as headers. No raw exception/body is logged.
    const reader=r.body?.getReader();if(!reader)throw fail('HOST_RESPONSE_UNREADABLE');const parts=[];let size=0;const abortBody=()=>{void reader.cancel().catch(()=>{});};controller.signal.addEventListener('abort',abortBody,{once:true});
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw fail('HOST_RESPONSE_TOO_LARGE');parts.push(value);}}
    catch(e){void reader.cancel().catch(()=>{});throw e;}finally{controller.signal.removeEventListener('abort',abortBody);reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   }
   current();
   if(!r.ok){
    const code=typeof data?.error==='string'&&/^[a-z0-9_]{1,100}$/.test(data.error)?data.error:'host_request_rejected';
    if(expectedCommandId!==undefined&&(data?.state!==undefined||Object.hasOwn(ACTION_REJECTIONS,code))
       &&(![400,409].includes(r.status)||data?.state!=='rejected'||data.commandId!==expectedCommandId))throw fail('HOST_COMMAND_RECEIPT_MISMATCH');
    const rejection=fail(code);
    if(expectedCommandId!==undefined&&data?.state==='rejected')rejection.message=Object.hasOwn(ACTION_REJECTIONS,code)?ACTION_REJECTIONS[code]:ACTION_REJECTIONS.native_action_rejected;
    throw Object.assign(rejection,{status:r.status,...(typeof data?.reason==='string'&&/^[a-z0-9_]{1,100}$/.test(data.reason)?{reason:data.reason}:{}),...(typeof data?.failure==='string'&&/^[A-Za-z0-9 _.:-]{1,160}$/.test(data.failure)?{failure:data.failure}:{}),retryAfterMs:Math.max(1000,Math.min(30000,(Number(r.headers.get('Retry-After'))||1)*1000)),details:Array.isArray(data?.validation?.errors||data?.errors)?(data.validation?.errors||data.errors).filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,512)):[]});
   }
   return {status:r.status,data};
  })();
  try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fail('HOST_REQUEST_TIMEOUT'));},timeoutMs);})]);}
  finally{clearTimeout(timer);}
 }
 const bind=data=>{if(data?.matchId!==allocation?.matchId||data?.generation!==allocation?.generation)throw fail('HOST_GENERATION_MISMATCH');};
 return {
  status,
  async create(input){
   if(closed||creating||allocation)throw fail('MATCH_ALREADY_OPEN');
   // JSON is the exact wire representation hashed by the server. No row sorting,
   // metadata stripping, commander movement, substituted cards or alias fallback.
   const sent=JSON.parse(JSON.stringify(input));
   if(sent.startingPlayer!==undefined||sent.playStyle!==undefined){
    if(!['random','first','second'].includes(sent.startingPlayer)||!['quick','practice'].includes(sent.playStyle)||sent.playStyle==='quick'&&sent.startingPlayer!=='random')throw fail('FORGE_STARTING_PLAYER_INVALID');
   }
   requestedPregame=sent.startingPlayer===undefined?null:{selection:sent.startingPlayer,playStyle:sent.playStyle};
   creating=true;
   try{
    const [human,opponent]=await Promise.all([exactDigest(sent.humanDeck),exactDigest(sent.opponentDeck)]);
    const {status:code,data}=await request('/api/play/matches',{method:'POST',body:sent,headers:{'Idempotency-Key':newId()}});
    if(code!==202||!UUID.test(data?.matchId||'')||!UUID.test(data?.generation||'')||data.schema!==SCHEMA||data.forgeRevision!==FORGE_REVISION||data.status!=='initializing'||data.deckDigests?.human!==human||data.deckDigests?.opponent!==opponent||!Number.isSafeInteger(data.expiresAt))throw fail('HOST_ALLOCATION_MISMATCH');
    allocation={matchId:data.matchId,generation:data.generation,expiresAt:data.expiresAt,deckDigests:data.deckDigests};if(closeRequested){await request('/api/play/matches/'+allocation.matchId,{method:'DELETE'});closed=true;throw fail('MATCH_CLOSED');}return structuredClone(allocation);
   }catch(e){blocked=true;error=e.code||'MATCH_CREATION_OUTCOME_UNKNOWN';throw e;}finally{creating=false;}
  },
  async read(){
   if(closed||!allocation)throw fail('MATCH_NOT_OPEN');
   if(nextReadAt>Date.now())await new Promise(r=>setTimeout(r,nextReadAt-Date.now()));if(closed)throw fail('MATCH_NOT_OPEN');nextReadAt=Date.now()+300;
   try{const {status:code,data}=await request('/api/play/matches/'+allocation.matchId);bind(data);
    if(code===202&&data.status==='initializing'){if(terminal)throw fail('INVALID_NATIVE_TERMINAL_RECEIPT');return {status:'initializing'};}
    if(code===200&&data.status==='finished'){
     const hasViewer=Object.hasOwn(data,'viewerId'),terminalViewer=hasViewer?data.viewerId:expectedViewer;
     if(hasViewer&&(!Number.isSafeInteger(terminalViewer)||terminalViewer<0||expectedViewer!==null&&terminalViewer!==expectedViewer||knownPlayers&&!knownPlayers.includes(terminalViewer)))throw fail('INVALID_NATIVE_TERMINAL_RECEIPT');
     if(typeof data.result?.draw!=='boolean'||data.result.draw&&data.result.winnerPlayerId!==null||!data.result.draw&&(!Number.isSafeInteger(data.result?.winnerPlayerId)||data.result.winnerPlayerId<0||knownPlayers&&!knownPlayers.includes(data.result.winnerPlayerId)))throw fail('INVALID_NATIVE_TERMINAL_RECEIPT');
     const result={draw:data.result.draw,winnerPlayerId:data.result.winnerPlayerId};
     if(terminal&&(terminal.draw!==result.draw||terminal.winnerPlayerId!==result.winnerPlayerId))throw fail('INVALID_NATIVE_TERMINAL_RECEIPT');
     // Missing identity in a legacy terminal-first receipt stays unknown. Never
     // infer player zero or a loss. A later bound receipt may enrich that identity.
     expectedViewer=terminalViewer;terminal=result;blocked=true;return {status:'finished',viewerId:terminalViewer,result:structuredClone(terminal)};
    }
    if(terminal)throw fail('INVALID_NATIVE_TERMINAL_RECEIPT');
    const s=data.snapshot;
    // An action whose reply was lost is settled by the server: either the board moved past
    // the revision it was built from, or the server released it. Only then may the next action go.
    if(unsettled&&code===200&&data.status==='running'&&Number.isSafeInteger(s?.revision)&&(data.commandPending===false||s.revision!==unsettled.revision)){unsettled=null;if(!blocked)error=null;}if(code!==200||data.status!=='running'||s?.schema!==SCHEMA||s.forgeRevision!==FORGE_REVISION||!Number.isSafeInteger(s.revision)||!Number.isSafeInteger(s.viewer)||!Array.isArray(s.players)||s.players.length!==2||s.players.some(p=>!Number.isSafeInteger(p?.id))||new Set(s.players.map(p=>p.id)).size!==2||s.players.filter(p=>p.isViewer).length!==1||s.players.filter(p=>p.isViewer&&p.id===s.viewer).length!==1)throw fail('HOST_NATIVE_PROJECTION_MISMATCH');
    if(expectedViewer!==null&&s.viewer!==expectedViewer)throw fail('HOST_NATIVE_PROJECTION_MISMATCH');expectedViewer=s.viewer;knownPlayers=s.players.map(p=>p.id);
    if(s.pregame!==undefined&&s.pregame!==null){
     const p=s.pregame;
     if(p.schema!=='cardstashy.forge-pregame.v1'||!Number.isSafeInteger(p.firstPlayerId)||!knownPlayers.includes(p.firstPlayerId)||!['random','first','second'].includes(p.selection)||!['quick','practice'].includes(p.playStyle)||p.playStyle==='quick'&&p.selection!=='random'||requestedPregame&&(p.selection!==requestedPregame.selection||p.playStyle!==requestedPregame.playStyle))throw fail('HOST_PREGAME_RECEIPT_MISMATCH');
     const stable=JSON.stringify([p.firstPlayerId,p.selection,p.playStyle]);
     if(acceptedPregame&&acceptedPregame!==stable)throw fail('HOST_PREGAME_RECEIPT_MISMATCH');
     acceptedPregame=stable;
    }else if(acceptedPregame)throw fail('HOST_PREGAME_RECEIPT_MISMATCH');
    return {status:'running',snapshot:s};
   }catch(e){if([429,503].includes(e.status))nextReadAt=Date.now()+(e.retryAfterMs||1000);if(e.status===410||e.status===401||e.code==='ACCOUNT_CHANGED'||e.code?.includes('MISMATCH')||e.code==='INVALID_NATIVE_TERMINAL_RECEIPT'){blocked=true;error=e.code;}throw e;}
  },
  async submit(action){
   if(!allocation||closed||blocked||submitting)throw fail(error||'MATCH_NOT_READY');
   if(unsettled)throw Object.assign(fail('ACTION_OUTCOME_PENDING'),{message:OUTCOME_PENDING});
   if(!Number.isSafeInteger(action?.revision)||!['ok','cancel','card','player','stack','reply','concede','controlMode','autoPay'].includes(action?.op))throw fail('INVALID_NATIVE_ACTION');
   if(action.op==='controlMode'&&(!['smart','full'].includes(action.value)||Object.keys(action).some(k=>!['revision','op','value'].includes(k))))throw fail('INVALID_NATIVE_CONTROL_MODE');
   if(action.op==='autoPay'&&(typeof action.value!=='boolean'||Object.keys(action).some(k=>!['revision','op','value'].includes(k))))throw fail('INVALID_NATIVE_AUTO_PAY');
   const commandId=newId();submitting=true;
   try{const {status:code,data}=await request('/api/play/matches/'+allocation.matchId+'/actions',{method:'POST',body:{commandId,generation:allocation.generation,action:structuredClone(action)},expectedCommandId:commandId});
    if(data?.commandId!==commandId||code!==202)throw fail('HOST_COMMAND_RECEIPT_MISMATCH');
    if(data.state==='pending_outcome_unknown'){unsettled={revision:action.revision};error='ACTION_OUTCOME_UNKNOWN';throw Object.assign(fail(error),{message:OUTCOME_PENDING});}
    if(data.state!=='accepted')throw fail('HOST_COMMAND_RECEIPT_MISMATCH');return data;
   }catch(e){
    // 400/409 are recorded refusals and 429 is refused before any dispatch: nothing was applied,
    // nor when the sign-in token was unusable and nothing was sent.
    // A lost reply waits for the server to settle it on the next state read; it is never resent.
    if([401,410].includes(e.status)||e.code==='ACCOUNT_CHANGED'||e.code?.includes('MISMATCH')){blocked=true;error=e.code;}
    else if(![400,409,429].includes(e.status)&&e.code!=='AUTHENTICATION_REQUIRED'&&!unsettled){unsettled={revision:action.revision};error=e.code==='HOST_REQUEST_TIMEOUT'?'ACTION_OUTCOME_UNKNOWN':e.code||'ACTION_OUTCOME_UNKNOWN';try{e.message=OUTCOME_PENDING;}catch{}}
    throw e;
   }finally{submitting=false;}
  },
  async close(){
   if(closed)return;closeRequested=true;if(!allocation){if(!creating)closed=true;blocked=true;return;}blocked=true;
   try{const {status:code}=await request('/api/play/matches/'+allocation.matchId,{method:'DELETE'});if(code!==204)throw fail('RESOURCE_CLEANUP_UNCONFIRMED');closed=true;error=null;}
   catch(e){error=e.code||'RESOURCE_CLEANUP_UNCONFIRMED';throw e;}
  },
  // The page is going away: end the server table in a request that outlives the page, so the
  // one-match-per-account limit does not refuse the next match. Synchronous; it never throws.
  release(){
   if(closed||!allocation||!lastToken)return false;const id=allocation.matchId;closed=true;blocked=true;
   try{void Promise.resolve(fetchImpl(API_PREFIX+'/api/play/matches/'+id,{method:'DELETE',headers:{Accept:'application/json',Authorization:'Bearer '+lastToken},keepalive:true,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'})).catch(()=>{});}catch{}
   return true;
  },
  detach(){closed=true;blocked=true;allocation=null;terminal=null;nextReadAt=0;expectedViewer=null;knownPlayers=null;},
 };
}
