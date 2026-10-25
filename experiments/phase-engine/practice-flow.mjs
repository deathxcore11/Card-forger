// Account-facing orchestration. The host supplies its existing account/setup
// readers; all game commands still pass through the authoritative worker.
import {connectPractice} from './practice-client.mjs';
import {prepareMatchInput} from './match-input.mjs';
import {RUNTIME_IDENTITY} from './runtime-assets.mjs';
import {createMatchSession} from './match-session.mjs';

export function createPracticeFlow({readAccount,readSetup,onChange=()=>{},onProgress=()=>{},
 connect=connectPractice,makeSession=createMatchSession,newId=()=>crypto.randomUUID(),sessionOnly=false}={}){
 if(typeof readAccount!=='function'||typeof readSetup!=='function')throw Error('ACCOUNT_READERS_REQUIRED');
 if(typeof sessionOnly!=='boolean')throw Error('INVALID_SESSION_MODE');
 let operation=0,client=null,session=null,bound=null,recoveryOwner=null,state={phase:'idle',matchId:null,binding:null,game:null,error:null};
 const snapshot=()=>structuredClone(state);
 const publish=()=>onChange(snapshot());
 function account(){
  const a=readAccount()||{},ownerId=a.user?.id,generation=a.accountGeneration??a.generation??null;
  if(typeof ownerId!=='string'||!ownerId||a.switching||a.locked)throw Error('ACCOUNT_UNAVAILABLE');
  return {ownerId,generation};
 }
 function current(binding){try{const a=account();return a.ownerId===binding.ownerId&&a.generation===binding.generation;}catch{return false;}}
 function retire(){operation++;session?.close();client?.close();session=null;client=null;bound=null;recoveryOwner=null;}
 function reconcile(){
  if((bound||recoveryOwner)&&!current(bound||recoveryOwner)){retire();state={phase:'account-changed',matchId:null,binding:null,game:null,error:'ACCOUNT_CHANGED'};publish();return false;}
  return true;
 }
 function acceptGame(game){
  // An engine-rejected selection can be corrected in the same live session.
  // A lost authority cannot be recovered when its only record was in memory.
  const failed=!!game.error&&(!sessionOnly||game.error!=='CHOICE_REJECTED');
  state.game=game;state.phase=failed?(sessionOnly?'session-ended':'recovery-required'):game.status?.terminal?'finished':'playing';state.error=game.error||null;
  if(sessionOnly&&failed)retire();
 }
 async function open({resume=false,matchId,input,seed,first}={}){
  if(resume&&sessionOnly)throw Error('SESSION_RESUME_UNAVAILABLE');
  if(state.phase==='opening'||session)throw Error('MATCH_ALREADY_OPEN');
  const owner=account();retire();const ticket=operation;bound=owner;recoveryOwner=sessionOnly?null:owner;
  state={phase:'opening',matchId,binding:null,game:null,error:null};publish();
  let candidate;
  const active=()=>ticket===operation&&current(owner);
  try{
   candidate=connect({ownerId:owner.ownerId,match:matchId,resume,...(sessionOnly?{sessionOnly:true}:{}),...(!resume?{input}:{}),isCurrent:active,
    onProgress:p=>{if(active())onProgress(structuredClone(p));}});client=candidate;
   const binding=await candidate.ready;
   if(!active())throw Error('ACCOUNT_CHANGED');
   state.binding=binding;
   if(!binding.admission?.admitted||!binding.cpuAvailable){
    candidate.close();client=null;bound=null;recoveryOwner=null;state.phase='unavailable';state.error=binding.cpuAvailable?'DECK_NOT_ADMITTED':'DIFFICULTY_UNAVAILABLE';publish();return snapshot();
   }
   session=makeSession({client:candidate,onChange:game=>{if(active()){state.game=game;if(state.phase!=='opening')acceptGame(game);publish();}}});
   const game=await session.open({resume,...(!resume?{seed,first}:{})});
   if(!active())throw Error('ACCOUNT_CHANGED');
   acceptGame(game);publish();return snapshot();
  }catch(error){
   candidate?.close();
   if(ticket!==operation)throw Error('ACCOUNT_CHANGED');
   session?.close();session=null;client=null;
   const changed=!current(owner);bound=null;if(changed||sessionOnly)recoveryOwner=null;
   state={...state,phase:changed?'account-changed':sessionOnly?'session-ended':'recovery-required',...(changed?{matchId:null,binding:null,game:null}:{}),error:changed?'ACCOUNT_CHANGED':String(error.message)};publish();throw error;
  }
 }
 return {snapshot,reconcile,
  start({opponent,seed,first=0}={}){
   account();const setup=readSetup();
   if(!setup?.selected||setup.match?.mode!=='cpu')throw Error('CPU_DECK_SELECTION_REQUIRED');
   const owner=account();if(setup.profile?.ownerId!==owner.ownerId||setup.profile?.signedIn!==true)throw Error('ACCOUNT_CHANGED');
   if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||![0,1].includes(first))throw Error('PREGAME_REQUIRED');
   const input=prepareMatchInput({player:setup.selected,opponent:opponent===undefined?setup.opponent:opponent,format:setup.match.format,difficulty:setup.match.difficulty,profile:setup.profile,runtimeIdentity:RUNTIME_IDENTITY.wasmSha256});
   return open({matchId:newId(),input,seed,first});
  },
  resume(matchId){if(sessionOnly)throw Error('SESSION_RESUME_UNAVAILABLE');return open({resume:true,matchId});},
  recover(){
   if(sessionOnly)throw Error('SESSION_RESUME_UNAVAILABLE');
   // An unknown outcome is never retried as a fresh command or match. Retire
   // the old epoch first, then read the committed journal using its frozen list.
   if(state.phase!=='recovery-required'||!state.matchId||!recoveryOwner)throw Error('RECOVERY_NOT_AVAILABLE');
   if(!current(recoveryOwner)){
    retire();state={phase:'account-changed',matchId:null,binding:null,game:null,error:'ACCOUNT_CHANGED'};publish();throw Error('ACCOUNT_CHANGED');
   }
   const matchId=state.matchId;retire();return open({resume:true,matchId});
  },
  getSession(){if(!reconcile())return null;return session;},
  // Detaching is a navigation/lifecycle operation, never a fabricated loss or
  // concession. The public Exit flow must separately confirm/commit concession.
  detach(){retire();state={phase:'idle',matchId:null,binding:null,game:null,error:null};publish();}
 };
}
