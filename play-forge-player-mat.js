// Existing createPlaySetup snapshots and the existing table; no second picker,
// rules engine, external artwork query, or persisted private match state.
import {capturePracticeArtwork} from './play-card-surface.js';
import {forgeCpuPolicy} from './play-forge-cpu-policy.js';
import {createForgeHostClient,exactForgeInput,forgeAccountKey} from './play-forge-host-client.js';
import {createForgePresentationSession} from './experiments/forge-proof/forge-session.mjs';
import {mountForgeTable} from './experiments/forge-proof/forge-table.mjs';
const selectionKey=s=>JSON.stringify([s?.profile?.ownerId,s?.selected,s?.opponent,s?.match]);
export function capturedForgeArtwork(setup,lookup){
 const rows=[setup.selected,setup.opponent].flatMap(deck=>{const d=capturePracticeArtwork(deck,lookup);return [...d.cards,...(d.side||[])];});
 return (name,native)=>{
  const options=rows.filter(r=>r.name===name&&r.playArtwork).map(r=>r.playArtwork);
  const sameSet=options.filter(a=>a.card?.set?.toLowerCase()===native?.setCode?.toLowerCase());
  const candidates=sameSet.length?sameSet:options,ids=new Set(candidates.map(a=>a.card.id));
  // Native IDs do not map mixed selected printing copies yet. Refuse to invent
  // that association; a unique catalogue reference is labelled as such in UI.
  return ids.size===1?structuredClone(candidates[0]):null;
 };
}
export function createForgePlayerMat({root,readAccount,readSetup,getAccessToken,lookup,prepareArtwork=async()=>{},onChange=()=>{},onClose=()=>{},onHome=null,onRematch=null,createClient=createForgeHostClient,mountTable=mountForgeTable,pollMs=500,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!root||[readAccount,readSetup,getAccessToken,lookup].some(f=>typeof f!=='function'))throw Error('FORGE_PLAYER_MAT_READERS_REQUIRED');
 const doc=root.ownerDocument,view=doc.defaultView;
 let generation=0,opening=false,client=null,session=null,table=null,last=null,warning=false,viewer=null,matchup=null,matchPolicy=null,matchAccount=null,exitDialog=null,exitConfirm=null,exitSubmitting=false,disposed=false;
 const node=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const beforeUnload=e=>{e.preventDefault();e.returnValue='';};
 const warn=enabled=>{if(enabled===warning)return;warning=enabled;view[enabled?'addEventListener':'removeEventListener']('beforeunload',beforeUnload);};
 // Retain the launched policy with every result/stat consumer; never reread a
 // newer setup preference to label an earlier match. No persistence is added.
 const publish=value=>{last={...value,...(matchPolicy?{matchContext:{format:matchup.match.format,difficulty:matchPolicy.difficulty,difficultyPolicyVersion:matchPolicy.difficultyPolicyVersion}}:{})};onChange(structuredClone(last));};
 function message(title,lines,{close=true}={}){
  table?.destroy();table=null;root.replaceChildren();root.className='play-mat-message';const panel=node('section');panel.className='panel play-journey-message';const heading=node('h1',title);heading.tabIndex=-1;panel.append(heading);for(const line of lines)panel.append(node('p',line));
  if(close){const b=node('button','Return to Play setup');b.type='button';b.className='btn';b.addEventListener('click',requestExit);panel.append(b);}root.append(panel);heading.focus();
 }
 function finish(result,terminalViewer=null){
  if(disposed)return;
  if(matchAccount!==forgeAccountKey(readAccount())){client?.detach();stopped({code:'ACCOUNT_CHANGED'});return;}
  if(terminalViewer!==null&&(!Number.isSafeInteger(terminalViewer)||terminalViewer<0||viewer!==null&&terminalViewer!==viewer)){stopped({code:'INVALID_NATIVE_TERMINAL_RECEIPT'});return;}
  session?.close();warn(false);exitDialog?.remove();exitDialog=null;exitConfirm=null;
  if(Number.isSafeInteger(terminalViewer)&&terminalViewer>=0)viewer=terminalViewer;
  const outcome=result.draw?'draw':viewer===null?null:result.winnerPlayerId===viewer?'win':'loss';
  const title=outcome==='draw'?'Draw':outcome==='win'?'You won':outcome==='loss'?'CPU won':'Your result is not yet identified';
  publish({phase:'finished',result:structuredClone(result),viewerId:viewer,outcome,endingReason:'unclassified-engine-terminal',deckDigests:client?.status().allocation?.deckDigests||null});message('Match finished',[title,...(outcome===null?[`Forge reported winner player ${result.winnerPlayerId}, but this receipt does not identify your seat. No win or loss has been assigned.`]:[]),matchPolicy.label+' · '+matchPolicy.difficultyPolicyVersion,'Forge supplied this result. The host retained the outcome, not a final board snapshot. The ending cause is not retained.','This session cannot be resumed. Return to setup to start a new match.','No persistent match history or statistics have been saved by this integration.']);
  root.classList.add('play-mat-result');const panel=root.querySelector('section');panel.classList.add('play-match-result');
  if(matchup){const decks=node('details');decks.append(node('summary','Exact deck snapshots used'));
   for(const [seat,deck]of [['human',matchup.selected],['opponent',matchup.opponent]]){decks.append(node('h3',(seat==='human'?'Your deck: ':'CPU deck: ')+deck.name));const hash=client?.status().allocation?.deckDigests?.[seat];if(hash)decks.append(node('code','Snapshot SHA-256: '+hash));const list=node('ul');for(const row of deck.cards||[])list.append(node('li',`${row.qty} ${row.name}`));decks.append(list);if(deck.side?.length){decks.append(node('p','Sideboard'));for(const row of deck.side)decks.append(node('p',`${row.qty} ${row.name}`));}const metadata=node('details'),source=node('pre',JSON.stringify(deck,null,2));source.style.whiteSpace='pre-wrap';source.style.overflowWrap='anywhere';metadata.append(node('summary','Read-only snapshot metadata'),source);decks.append(metadata);}
   panel.append(decks);
  }
  for(const [label,fn]of [['Rematch setup',onRematch],['Home',onHome]])if(fn){const b=node('button',label);b.type='button';b.className='btn ghost';b.addEventListener('click',()=>{if(label==='Rematch setup'&&selectionKey(readSetup())!==selectionKey(matchup)){message('Match setup changed',['Your deck selection or difficulty changed after this match opened. Review the current setup before starting another match.']);return;}fn();});panel.append(b);}
 }
 function stopped(e){
  if(disposed)return;session?.close();warn(false);exitDialog?.remove();exitDialog=null;exitConfirm=null;publish({phase:e.code==='ACCOUNT_CHANGED'?'account-changed':'session-ended',error:e.code||'HOST_SESSION_STOPPED'});
  message('Native session stopped',[e.code==='ACCOUNT_CHANGED'?'The signed-in account changed.':'The session was interrupted or expired. No win or loss has been invented.','Return to setup to start a new match. The same match will not be restarted.']);
 }
 async function closeSession(){
  session?.close();warn(false);try{await client?.close();onClose();}catch(e){message('Session cleanup is not confirmed',['The table is stopped. Try closing again; the server also has a bounded expiry.']);publish({phase:'session-ended',error:e.code||'RESOURCE_CLEANUP_UNCONFIRMED'});}
 }
 function updateExit(){if(exitConfirm){const s=session?.snapshot();exitConfirm.disabled=exitSubmitting||!!s?.busy||!!s?.native?.prompt||s?.native?.inputType==='InputLockUI';}}
 function requestExit(){
  if(disposed||exitDialog)return;
  if(last?.phase==='finished'||last?.phase==='account-changed'){void closeSession();return;}
  const canConcede=last?.phase==='playing'&&session&&!client.status().blocked;exitSubmitting=false;
  const dialog=node('dialog');dialog.className='play-match-exit';dialog.setAttribute('aria-label',canConcede?'Concede native match':'Close native session');dialog.append(node('h2',canConcede?'Concede this match?':'Close this session?'),node('p',canConcede?'Confirming sends a real concession to Forge. The match result must be confirmed by the engine.':'This interrupted or unopened session cannot be resumed. Closing resources does not invent a win or loss.'));
  const keep=node('button','Keep playing'),close=node('button',canConcede?'Concede and return':'Close and return');keep.type=close.type='button';keep.addEventListener('click',()=>{dialog.remove();exitDialog=null;});close.addEventListener('click',async()=>{
   close.disabled=true;exitSubmitting=true;
   if(canConcede){
    try{await session.concede();const until=Date.now()+10000;while(last?.phase==='playing'&&Date.now()<until&&!client.status().blocked)await wait(100);if(last?.phase!=='finished')throw Error('NATIVE_CONCESSION_UNCONFIRMED');dialog.remove();exitDialog=null;await closeSession();}
    catch{if(dialog.isConnected){dialog.append(node('p','Forge has not confirmed the ending. No loss has been invented. Keep the table open to inspect the current state.'));close.disabled=true;}}
   }else{dialog.remove();exitDialog=null;generation++;await closeSession();}
  });dialog.append(keep,close);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.remove();exitDialog=null;});doc.body.append(dialog);exitDialog=dialog;exitConfirm=canConcede?close:null;if(canConcede)dialog.append(node('p','Concession is available while Forge is awaiting your next action. Finish or cancel an open native choice first.'));updateExit();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.open=true;keep.focus();
 }
 async function start(){
  if(disposed||opening||client)throw Error('MATCH_ALREADY_OPEN');opening=true;const ticket=++generation,account=forgeAccountKey(readAccount()),setup=readSetup(),selection=selectionKey(setup);
  matchAccount=account;
  const current=()=>!disposed&&ticket===generation&&forgeAccountKey(readAccount())===account&&selectionKey(readSetup())===selection;
  try{
   matchup=structuredClone(setup);const input=exactForgeInput(setup);matchPolicy=forgeCpuPolicy(setup.match.difficulty);
   if(!current()||setup.profile?.ownerId!==readAccount()?.user?.id)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});
   message('Preparing your match…',['Loading artwork for both selected decks. Forge will check the unchanged lists.']);
   await prepareArtwork(setup,{isCurrent:current});
   if(!current())throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});
   const artwork=capturedForgeArtwork(setup,lookup);
   client=createClient({readAccount,getAccessToken});
   message('Opening native match…',[matchPolicy.label+'. The host must admit '+matchPolicy.difficultyPolicyVersion+'.','Using your selected decks exactly. Forge validates their identities and legality.']);
   await client.create(input);if(!current()){await client.close();throw Error('SELECTION_CHANGED');}
   let state,deadline=Date.now()+125000;
   while(current()&&Date.now()<deadline){try{state=await client.read();}catch(e){if(![429,503].includes(e.status))throw e;await wait(e.retryAfterMs||1000);continue;}if(state.status!=='initializing')break;await wait(pollMs);}
   if(!current()){await client.close();throw Error('SELECTION_CHANGED');}
   if(state?.status==='finished'){finish(state.result,state.viewerId);return last;}
   if(state?.status!=='running')throw Error('HOST_STARTUP_TIMEOUT');viewer=state.snapshot.viewer;
   session=createForgePresentationSession({lookupArtwork:artwork,pollMs,allowControlMode:true,transportStatus:()=>client.status(),request:async(path,body)=>{
    if(body)return client.submit(body);
    try{const next=await client.read();if(next.status==='finished'){finish(next.result,next.viewerId);return null;}if(next.status!=='running')throw Error('HOST_SESSION_NOT_RUNNING');return next.snapshot;}
    catch(e){if(e.status===410||e.status===401||e.code==='ACCOUNT_CHANGED')stopped(e);throw e;}
   }});
   session.acceptState(state.snapshot);session.subscribe(s=>{updateExit();if(!disposed&&ticket===generation&&last?.phase!=='finished')publish({phase:'playing',game:s});});
   root.className='';table=mountTable(root,{session,profile:setup.profile,format:setup.match.format,title:'CardStashy · Native Magic',onExit:requestExit,presentation:{hosted:true,policyLabel:matchPolicy.label,allowControlMode:true}});warn(true);await session.start({readInitial:false});return last;
  }catch(e){if(current()){session?.close();warn(false);message('Native match could not open',['Your selected lists are unchanged. '+(e.code==='unsupported_explicit_cpu_policy'?'The selected CPU policy is unavailable on this host. Return to setup; no different difficulty was substituted.':(e.code||e.message)),'No fallback deck or replacement engine was started.',...(e.details||[])]);publish({phase:'session-ended',error:e.code||e.message});}throw e;}
  finally{opening=false;}
 }
 return {start,snapshot:()=>last?structuredClone(last):null,requestExit,
  reconcile(){if(matchAccount&&forgeAccountKey(readAccount())!==matchAccount){client?.detach();stopped({code:'ACCOUNT_CHANGED'});return false;}return true;},
  detach(){if(disposed)return;disposed=true;generation++;warn(false);session?.close();table?.destroy();table=null;exitDialog?.remove();exitDialog=null;void client?.close().catch(()=>{}).finally(()=>client?.detach());root.replaceChildren();last=null;},
 };
}
