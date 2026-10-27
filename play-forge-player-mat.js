// Existing createPlaySetup snapshots and the existing table; no second picker,
// rules engine, external artwork query, or persisted private match state.
import {APP_VERSION} from './config.js';
import {capturePracticeArtwork} from './play-card-surface.js';
import {forgeCpuPolicy} from './play-forge-cpu-policy.js';
import {createForgeHostClient,exactForgeInput,forgeAccountKey} from './play-forge-host-client.js';
import {createForgePresentationSession} from './experiments/forge-proof/forge-session.mjs';
import {mountForgeTable} from './experiments/forge-proof/forge-table.mjs';
import {mountForgeMatchIntro,forgeStartingPlayer} from './play-forge-pregame.js';
const selectionKey=s=>JSON.stringify([s?.profile?.ownerId,s?.selected,s?.opponent,s?.match]);
// Forge may name a Universes Beyond card by its Universes Within flavor name
// (Hydro-Man, Fluid Felon plays as "Belion, the Parched"), which no printing
// carries. Such a card is matched by its printed cost, type line and power/
// toughness instead, and only when exactly one captured card fits.
const nativeType=t=>String(t||'').replace(/\s+[—–-]\s+/g,' - ').replace(/\s+/g,' ').trim().toLowerCase();
const nativeCost=c=>!c||c==='no cost'?'':String(c);
function sameCardFace(card,native){
 const face=card?.card_faces?.[0]&&!card.mana_cost?card.card_faces[0]:card;
 if(!face||nativeCost(native?.manaCost)!==(face.mana_cost||'')||nativeType(native?.type)!==nativeType(face.type_line))return false;
 if(face.power===undefined)return true;
 return String(native?.power)===String(face.power)&&String(native?.toughness)===String(face.toughness);
}
export function capturedForgeArtwork(setup,lookup){
 const rows=[setup.selected,setup.opponent].flatMap(deck=>{const d=capturePracticeArtwork(deck,lookup);return [...d.cards,...(d.side||[])];});
 return (name,native)=>{
  let options=rows.filter(r=>r.name===name&&r.playArtwork).map(r=>r.playArtwork);
  if(!options.length&&native&&!rows.some(r=>r.name===name))options=rows.filter(r=>r.playArtwork&&sameCardFace(r.playArtwork.card,native)).map(r=>r.playArtwork);
  const sameSet=options.filter(a=>a.card?.set?.toLowerCase()===native?.setCode?.toLowerCase());
  const candidates=sameSet.length?sameSet:options,ids=new Set(candidates.map(a=>a.card.id));
  // Native IDs do not map mixed selected printing copies yet. Refuse to invent
  // that association; a unique catalogue reference is labelled as such in UI.
  return ids.size===1?structuredClone(candidates[0]):null;
 };
}

// Safe server codes only: the stop reason tells an engine failure from an expiry or a lost process.
export const forgeDiagnostic=e=>[e?.code||e?.message||'HOST_SESSION_STOPPED',e?.reason,e?.failure,e?.status&&'HTTP '+e.status].filter(Boolean).join(' · ');
export function forgeMatchError(error){
 const code=error?.code||error?.message;
 // The server ends an account's previous match when the same account starts a new one.
 if(error?.reason==='replaced')return 'This match ended because a new match was started on your account (another tab or device). No result was recorded for it.';
 return ({
  authentication_required:'Sign in again, then return to Play to start your match.',
  AUTHENTICATION_REQUIRED:'Sign in again, then return to Play to start your match.',
  ACCOUNT_CHANGED:'Your signed-in account changed. Return to setup to choose your decks again.',
  SELECTION_CHANGED:'Your account or deck selection changed. Return to setup and review your matchup.',
  user_has_active_allocation:'Your previous match is still closing on the server. Wait about a minute, then start again.',
  match_interrupted:'The table stopped unexpectedly. No result was recorded. Return to setup and start again.',
  native_interrupted:'The table stopped unexpectedly. No result was recorded. Return to setup and start again.',
  global_match_capacity:'All match tables are currently in use. Try again when a table becomes available.',
  play_resource_budget_exhausted:'Play has reached its current hosting allowance. Please try again later.',
  create_attempt_rate_limit:'A few matches were requested close together. Wait a moment before trying again.',
  HOST_STARTUP_TIMEOUT:'The table took too long to open. Return to setup and try again shortly.',
  HOST_REQUEST_TIMEOUT:'The connection timed out. Return to setup and try again shortly.',
  STARTING_PLAYER_UNCONFIRMED:'The starting player could not be confirmed. Return to setup and try again shortly.',
  unsupported_native_pregame_choice:'One of these decks needs a setup choice before the starting-player selection that Play does not support yet. Choose another deck; your original list has not changed.',
  companion_sideboard_setup_not_supported:'Companion setup is not supported yet. Choose a deck without a companion in its sideboard; your original list has not changed.',
  match_startup_interrupted:'The table stopped while opening. Return to setup and try again.',
  unsupported_explicit_cpu_policy:'The CPU opponent is temporarily unavailable. Please try again later.',
  play_unavailable:'Play is temporarily unavailable. Please try again shortly.',
  exact_native_adapter_unavailable:'Play is temporarily unavailable. Please try again shortly.',
  match_failed:'The game could not start with these decks. Review any card or format details below.',
  invalid_match_input:'The selected deck information could not be accepted. Review both decks in setup.',
 })[code]||'The game could not open this match. Review any card or format details below, then return to setup.';
}

export function createForgePlayerMat({root,readAccount,readSetup,getAccessToken,lookup,prepareArtwork=async()=>{},onChange=()=>{},onClose=()=>{},onHome=null,onRematch=null,createClient=createForgeHostClient,mountTable=mountForgeTable,mountIntro=mountForgeMatchIntro,pollMs=500,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!root||[readAccount,readSetup,getAccessToken,lookup].some(f=>typeof f!=='function'))throw Error('FORGE_PLAYER_MAT_READERS_REQUIRED');
 const doc=root.ownerDocument,view=doc.defaultView;
 let generation=0,opening=false,client=null,session=null,table=null,last=null,warning=false,viewer=null,matchup=null,matchPolicy=null,matchAccount=null,intro=null,exitDialog=null,exitConfirm=null,exitSubmitting=false,disposed=false;
 const node=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const beforeUnload=e=>{e.preventDefault();e.returnValue='';};
 const warn=enabled=>{if(enabled===warning)return;warning=enabled;view[enabled?'addEventListener':'removeEventListener']('beforeunload',beforeUnload);};
 // Closing or leaving the tab ends an open server table, including one whose start failed.
 const pageHide=()=>{client?.release?.();};view?.addEventListener?.('pagehide',pageHide);
 // Retain the launched policy with every result/stat consumer; never reread a
 // newer setup preference to label an earlier match. No persistence is added.
 const publish=value=>{last={...value,...(matchPolicy?{matchContext:{format:matchup.match.format,difficulty:matchPolicy.difficulty,difficultyPolicyVersion:matchPolicy.difficultyPolicyVersion}}:{})};onChange(structuredClone(last));};
 function message(title,lines,{close=true,diagnostic=null}={}){
  intro?.destroy();intro=null;table?.destroy();table=null;root.replaceChildren();root.className='play-mat-message';const panel=node('section');panel.className='panel play-journey-message';const heading=node('h1',title);heading.tabIndex=-1;panel.append(heading);for(const line of lines)panel.append(node('p',line));
  if(diagnostic){const details=node('details');details.append(node('summary','Technical details'),node('code',diagnostic));panel.append(details);}
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
  publish({phase:'finished',result:structuredClone(result),viewerId:viewer,outcome,endingReason:'unclassified-engine-terminal',deckDigests:client?.status().allocation?.deckDigests||null});message('Match finished',[title,...(outcome===null?[`Forge reported winner player ${result.winnerPlayerId}, but this receipt does not identify your seat. No win or loss has been assigned.`]:[]),'This match has ended. Return to setup whenever you are ready for another game.','Results are not yet saved to your account.']);
  root.classList.add('play-mat-result');const panel=root.querySelector('section');panel.classList.add('play-match-result');panel.setAttribute('data-outcome',outcome||'unknown');
  if(matchup){const decks=node('details');decks.append(node('summary','Exact deck snapshots used'));
   for(const [seat,deck]of [['human',matchup.selected],['opponent',matchup.opponent]]){decks.append(node('h3',(seat==='human'?'Your deck: ':'CPU deck: ')+deck.name));const hash=client?.status().allocation?.deckDigests?.[seat];if(hash)decks.append(node('code','Snapshot SHA-256: '+hash));const list=node('ul');for(const row of deck.cards||[])list.append(node('li',`${row.qty} ${row.name}`));decks.append(list);if(deck.side?.length){decks.append(node('p','Sideboard'));for(const row of deck.side)decks.append(node('p',`${row.qty} ${row.name}`));}const metadata=node('details'),source=node('pre',JSON.stringify(deck,null,2));source.style.whiteSpace='pre-wrap';source.style.overflowWrap='anywhere';metadata.append(node('summary','Read-only snapshot metadata'),source);decks.append(metadata);}
   panel.append(decks);
  }
  for(const [label,fn]of [['Rematch setup',onRematch],['Home',onHome]])if(fn){const b=node('button',label);b.type='button';b.className='btn ghost';b.addEventListener('click',()=>{if(label==='Rematch setup'&&selectionKey(readSetup())!==selectionKey(matchup)){message('Match setup changed',['Your deck selection changed after this match opened. Review the current setup before starting another match.']);return;}fn();});panel.append(b);}
 }
 function stopped(e){
  if(disposed)return;session?.close();warn(false);exitDialog?.remove();exitDialog=null;exitConfirm=null;publish({phase:e.code==='ACCOUNT_CHANGED'?'account-changed':'session-ended',error:e.code||'HOST_SESSION_STOPPED'});
  message('Match interrupted',[e.code==='ACCOUNT_CHANGED'?'The signed-in account changed.':e.reason==='replaced'?forgeMatchError(e):'The connection was interrupted or the match expired. A result was not confirmed.','Return to setup to start a new match.'],{diagnostic:e.code==='ACCOUNT_CHANGED'?null:forgeDiagnostic(e)});
 }
 async function closeSession(){
  session?.close();warn(false);try{await client?.close();onClose();}catch(e){message('The table is still closing',['Try returning to setup again in a moment.']);publish({phase:'session-ended',error:e.code||'RESOURCE_CLEANUP_UNCONFIRMED'});}
 }
 function updateExit(){if(exitConfirm){const s=session?.snapshot();exitConfirm.disabled=exitSubmitting||!!s?.busy||!!s?.native?.prompt||s?.native?.inputType==='InputLockUI';}}
 function requestExit(){
  if(disposed||exitDialog)return;
  if(['finished','account-changed','session-ended'].includes(last?.phase)){void closeSession();return;}
  if(!session&&!client?.status().allocation){generation++;intro?.destroy();intro=null;void closeSession();return;}
  const canConcede=last?.phase==='playing'&&session&&!client.status().blocked;exitSubmitting=false;
  const dialog=node('dialog');dialog.className='play-match-exit';dialog.setAttribute('aria-label',canConcede?'Concede native match':'Close native session');dialog.append(node('h2',canConcede?'Concede this match?':'Close this session?'),node('p',canConcede?'The game ends as a loss once Forge confirms it.':'This session can’t be resumed. No win or loss is recorded.'));
  const keep=node('button','Keep playing'),close=node('button',canConcede?'Concede and return':'Close and return');keep.type=close.type='button';keep.addEventListener('click',()=>{dialog.remove();exitDialog=null;});close.addEventListener('click',async()=>{
   close.disabled=true;exitSubmitting=true;
   if(canConcede){
    try{await session.concede();const until=Date.now()+10000;while(last?.phase==='playing'&&Date.now()<until&&!client.status().blocked)await wait(100);if(last?.phase!=='finished')throw Error('NATIVE_CONCESSION_UNCONFIRMED');dialog.remove();exitDialog=null;await closeSession();}
    catch{if(dialog.isConnected){const note=node('p','Forge hasn’t confirmed the concession, so no result was recorded. Keep playing and try again.');note.className='play-exit-note';dialog.append(note);close.disabled=true;}}
   }else{dialog.remove();exitDialog=null;generation++;await closeSession();}
  });dialog.append(keep,close);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.remove();exitDialog=null;});doc.body.append(dialog);exitDialog=dialog;exitConfirm=canConcede?close:null;if(canConcede){const hint=node('p','Finish your current choice first.');hint.className='play-exit-hint';dialog.append(hint);}updateExit();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.open=true;keep.focus();
 }
 async function start(){
  if(disposed||opening||client)throw Error('MATCH_ALREADY_OPEN');opening=true;const ticket=++generation,account=forgeAccountKey(readAccount()),setup=readSetup(),selection=selectionKey(setup);
  matchAccount=account;
  const current=()=>!disposed&&ticket===generation&&forgeAccountKey(readAccount())===account&&selectionKey(readSetup())===selection;
  let requestedAt=null;
  try{
   matchup=structuredClone(setup);matchPolicy=forgeCpuPolicy(setup.match.difficulty);
   if(!current()||setup.profile?.ownerId!==readAccount()?.user?.id)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});
   intro=mountIntro({root,setup,lookup,onCancel:requestExit,wait,isCurrent:current});
   await prepareArtwork(setup,{isCurrent:current});
   if(!current())throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});
   const artwork=capturedForgeArtwork(setup,lookup);intro.refreshArtwork();await intro.showMatchup?.();
   const startingPlayer=await intro.chooseStartingPlayer();
   if(!current()||startingPlayer===null)throw Object.assign(Error('SELECTION_CHANGED'),{code:'SELECTION_CHANGED'});
   const input=exactForgeInput(setup,{startingPlayer});
   client=createClient({readAccount,getAccessToken});
   intro.status('Preparing the table…');
   requestedAt=Date.now();await client.create(input);warn(true);if(!current()){await client.close();throw Error('SELECTION_CHANGED');}
   let state,deadline=Date.now()+125000;
   while(current()&&Date.now()<deadline){
    try{state=await client.read();}catch(e){if(![429,503].includes(e.status))throw e;await wait(e.retryAfterMs||1000);continue;}
    const waitingForFirst=state.status==='running'&&!forgeStartingPlayer(state.snapshot)&&state.snapshot.turn===0&&!state.snapshot.prompt&&(state.snapshot.busy===true||state.snapshot.inputType==='InputLockUI');
    if(state.status!=='initializing'&&!waitingForFirst)break;
    if(waitingForFirst)intro.status('Choosing the starting player…');
    await wait(pollMs);
   }
   if(!current()){await client.close();throw Error('SELECTION_CHANGED');}
   if(state?.status==='finished'){finish(state.result,state.viewerId);return last;}
   if(state?.status!=='running')throw Error('HOST_STARTUP_TIMEOUT');viewer=state.snapshot.viewer;
   if(!forgeStartingPlayer(state.snapshot))throw Object.assign(Error('STARTING_PLAYER_UNCONFIRMED'),{code:'STARTING_PLAYER_UNCONFIRMED'});
   session=createForgePresentationSession({lookupArtwork:artwork,pollMs,allowControlMode:true,transportStatus:()=>client.status(),request:async(path,body)=>{
    if(body)return client.submit(body);
    try{const next=await client.read();if(next.status==='finished'){finish(next.result,next.viewerId);return null;}if(next.status!=='running')throw Error('HOST_SESSION_NOT_RUNNING');return next.snapshot;}
    catch(e){if(e.status===410||e.status===401||e.code==='ACCOUNT_CHANGED')stopped(e);throw e;}
   }});
   await intro?.reveal(state.snapshot);if(!current()){await client.close();throw Error('SELECTION_CHANGED');}intro?.destroy();intro=null;
   session.acceptState(state.snapshot);session.subscribe(s=>{updateExit();if(!disposed&&ticket===generation&&last?.phase!=='finished')publish({phase:'playing',game:s});});
   // The engine and website build stay identifiable on screen and in diagnostics.
   root.className='';root.dataset.engine='forge-hosted';root.dataset.build=APP_VERSION;table=mountTable(root,{session,profile:setup.profile,format:setup.match.format,title:`CardStashy · Magic · ${APP_VERSION}`,onExit:requestExit,presentation:{hosted:true,allowControlMode:true}});warn(true);await session.start({readInitial:false});return last;
  }catch(e){if(current()){session?.close();warn(false);message('Your match could not start',[forgeMatchError(e),'Your selected decks are unchanged.',...(e.details||[])],{diagnostic:forgeDiagnostic(e)+(requestedAt===null?'':` · ${Math.round((Date.now()-requestedAt)/1000)}s after the table was requested`)});publish({phase:'session-ended',error:e.code||e.message});}throw e;}
  finally{opening=false;}
 }
 return {start,snapshot:()=>last?structuredClone(last):null,requestExit,
  reconcile(){if(matchAccount&&forgeAccountKey(readAccount())!==matchAccount){client?.detach();stopped({code:'ACCOUNT_CHANGED'});return false;}return true;},
  detach(){if(disposed)return;disposed=true;generation++;warn(false);view?.removeEventListener?.('pagehide',pageHide);session?.close();intro?.destroy();intro=null;table?.destroy();table=null;exitDialog?.remove();exitDialog=null;void client?.close().catch(()=>{}).finally(()=>client?.detach());root.replaceChildren();last=null;},
 };
}
