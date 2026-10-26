// Mechanically extracted from app.js; do not edit generated handler bodies.
export function bindPlayHandlers(deps){const {FORGE_PLAY_TEST_ENABLED,PLAY_MATCH_RELEASE_READY,T,syncDesktopPlayEntries,S,playSetup,readPlayAccount,cloudInfo,accountGeneration,accountLocked,cloudAccessToken,meta,toast,go,chooseQuickOpponent,forgeDeckSupport,capturePracticeDeckContext,readPlaySources,refreshPlayMenu,cancelPlayBuilds}=deps;let playerMatHost=null,playerMatRoot=null,practicePregame=null,playStarting=false,quickSequence=0,quickStatus={busy:false,error:null};const A={},C={},I={};function closePlayerMat(){practicePregame?.destroy();practicePregame=null;playerMatHost?.detach();playerMatHost=null;playerMatRoot?.remove();playerMatRoot=null;document.body.classList.remove('practice-table-open');const app=document.getElementById('app');if(app)app.inert=false;if(!accountLocked&&S.ui.view==='play'&&!syncDesktopPlayEntries(T.game()).eligible)refreshPlayMenu();document.querySelector('[data-act="playStartCandidate"]')?.focus({preventScroll:true});}
function focusNextPlaySelection(){const state=playSetup.snapshot();const target=state.match.mode==='cpu'&&state.playStyle!=='quick'&&state.selected&&!state.opponent?document.querySelector('[data-act="playInspectSeat"][data-play-seat="opponent"]'):document.getElementById('playSelectedTitle');target?.focus({preventScroll:true});}
A.playStyle=t=>{quickSequence++;quickStatus={busy:false,error:null};cancelPlayBuilds();playSetup.configure({mode:t.dataset.playStyle==='social'?'friends':'cpu'});if(t.dataset.playStyle!=='social')playSetup.setPlayStyle(t.dataset.playStyle);refreshPlayMenu();};
A.playSelectDeck=t=>{cancelPlayBuilds();playSetup.selectDeck(t.dataset.playDeck,playSetup.snapshot().playStyle==='quick'?'player':playSetup.snapshot().inspectedSeat);refreshPlayMenu();focusNextPlaySelection();};
A.playInspectSeat=t=>{playSetup.inspectSeat(t.dataset.playSeat);refreshPlayMenu();};
A.playClearSelection=()=>{cancelPlayBuilds();playSetup.clearSelection(playSetup.snapshot().inspectedSeat);refreshPlayMenu();};
A.playConfigure=t=>{cancelPlayBuilds();quickSequence++;quickStatus={busy:false,error:null};playSetup.configure({[t.dataset.playOption]:t.dataset.playValue});refreshPlayMenu();document.querySelector(`[data-act="playConfigure"][aria-pressed="true"]`)?.focus({preventScroll:true});};
A.playImportPreview=async()=>{const pending=playSetup.importDraft();refreshPlayMenu();await pending;refreshPlayMenu();};
A.playImportUse=()=>{cancelPlayBuilds();const state=playSetup.reviewImport(playSetup.snapshot().playStyle==='quick'?'player':playSetup.snapshot().inspectedSeat);refreshPlayMenu();if(!state.error)document.getElementById('playSelectedTitle')?.focus();};
A.playFindOpponent=async()=>{
 const state=playSetup.snapshot();if(quickStatus.busy||!state.profile.signedIn||!state.selected)return false;
 const ticket=++quickSequence,scope=JSON.stringify([readPlayAccount(),state.selected,state.match]);quickStatus={busy:true,error:null};refreshPlayMenu();await new Promise(resolve=>requestAnimationFrame(resolve));
 try{const sources=readPlaySources(),candidates=[...S.state.decks,...Object.values(sources).flat().map(x=>x.deck),state.selected];
 const result=chooseQuickOpponent({player:state.selected,candidates,difficulty:state.match.difficulty,...(FORGE_PLAY_TEST_ENABLED?{candidateEligible:deck=>forgeDeckSupport(deck).status==='native-pending',nativeValidationPending:true}:{}),estimate:deck=>capturePracticeDeckContext(deck).practiceContext.power.value});
 const now=playSetup.snapshot();if(ticket!==quickSequence||JSON.stringify([readPlayAccount(),now.selected,now.match])!==scope)return false;playSetup.setQuickOpponent(result);return true;
 }catch(e){if(ticket===quickSequence)quickStatus.error=e.message;}finally{if(ticket===quickSequence){quickStatus.busy=false;refreshPlayMenu();}}
};
A.playStartCandidate=async()=>{
 if(!PLAY_MATCH_RELEASE_READY)return toast('Practice integration is still being verified.');
 if(playStarting||playerMatHost||practicePregame||T.game()!=='mtg'||!syncDesktopPlayEntries('mtg').eligible)return;
 playStarting=true;
 try{
 const initial=playSetup.snapshot();
 if(initial.playStyle==='quick'&&initial.match.mode==='cpu'&&!initial.quickMatch){if(!await A.playFindOpponent())return;}
 if(T.game()!=='mtg'||S.ui.view!=='play'||!syncDesktopPlayEntries('mtg').eligible)return;
 const source=playSetup.snapshot();if(!source.selected||!source.opponent||source.match.mode!=='cpu')return toast('Choose both Practice decks first.');
 if(!document.getElementById('practiceTableStyles')){const css=document.createElement('link');css.id='practiceTableStyles';css.rel='stylesheet';css.href='experiments/phase-engine/match-table.css';document.head.append(css);}
 playerMatRoot=document.createElement('main');playerMatRoot.id='practicePlayerMat';playerMatRoot.setAttribute('aria-label','Practice player mat');document.body.append(playerMatRoot);document.body.classList.add('practice-table-open');const app=document.getElementById('app');if(app)app.inert=true;
 const beginGame=async options=>{
  practicePregame?.destroy();practicePregame=null;
  const owner=cloudInfo().user?.id,generation=accountGeneration,current=()=>!accountLocked&&generation===accountGeneration&&owner===cloudInfo().user?.id;
  if(FORGE_PLAY_TEST_ENABLED){
   if(!document.getElementById('forgeHostedTableStyles')){const css=document.createElement('link');css.id='forgeHostedTableStyles';css.rel='stylesheet';css.href='play-forge-table.css';document.head.append(css);}
   const {createForgePlayerMat}=await import('./play-forge-player-mat.js');if(!current()||!playerMatRoot)return;
   playerMatHost=createForgePlayerMat({root:playerMatRoot,readAccount:readPlayAccount,readSetup:()=>playSetup.snapshot(),getAccessToken:cloudAccessToken,
    // Cache-only catalogue access: no per-hand/card network lookup during play.
    lookup:(name,id)=>id?S.state.printings?.[id]||null:meta(name),onClose:closePlayerMat,onHome:()=>{closePlayerMat();go('#home');},onRematch:()=>{closePlayerMat();A.playStartCandidate();}});
   try{await playerMatHost.start();}catch(e){toast(e.code||e.message);}return;
  }
  const cards=createPracticeCardPreparation({selectionKey:key,isCurrent:current,
   resolveNames:names=>resolveNames(names,()=>{},false,current),
   lookup:(name,id)=>id?S.state.printings?.[id]||null:meta(name),
   fetchPrinting:id=>api('/cards/'+encodeURIComponent(id))});
  playerMatHost=createPlayerMat({root:playerMatRoot,readAccount:readPlayAccount,readSetup:()=>playSetup.snapshot(),prepareArtwork:cards.prepare,reviewDecks:createPracticeCatalogReview({isCurrent:current,lookupNames:identifiers=>api('/cards/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifiers})})}),lookup:cards.lookup,onClose:closePlayerMat,onSaveDeck:savePlayDeck,onHome:()=>{closePlayerMat();go('#home');},onRematch:()=>{closePlayerMat();A.playStartCandidate();}});
  try{await playerMatHost.start(options);}catch(e){toast(e.message);}
 };
 if(FORGE_PLAY_TEST_ENABLED)await beginGame({}); // Forge owns its opening decisions.
 else if(source.playStyle==='quick')await beginGame(resolvePracticePregame('random'));
 else practicePregame=mountPracticePregame({root:playerMatRoot,renderDeckArtwork:deck=>{const art=document.createElement('div');art.className='play-pregame-art';art.innerHTML=V.deckArtwork(deck);return art;},readAccount:readPlayAccount,readSetup:()=>playSetup.snapshot(),onCancel:closePlayerMat,onConfirm:beginGame});
 }finally{playStarting=false;}
};
I.playImportDraft=C.playImportDraft=t=>{
  const before=playSetup.snapshot();
  playSetup.updateDraft({[t.dataset.playField]:t.value});
  // An edit retires the old preview immediately. Preserve this exact field,
  // selection and scroll: all three fields intentionally share one handler.
  if(before.importStatus!=='idle'||before.error){
    const id=t.id,start=t.selectionStart,end=t.selectionEnd,scroll=t.scrollTop;
    refreshPlayMenu();const again=document.getElementById(id);again?.focus({preventScroll:true});
    try{again?.setSelectionRange(start,end);}catch{}if(again)again.scrollTop=scroll;
  }
};
C.playMatchOption=t=>{cancelPlayBuilds();quickSequence++;quickStatus={busy:false,error:null};const key=t.dataset.playOption,value=t.value;playSetup.configure({[key]:value});refreshPlayMenu();document.querySelector(`[data-play-option="${key}"]${key==='mode'?':checked':''}`)?.focus({preventScroll:true});};
I.playDeckSearch=t=>{const start=t.selectionStart,end=t.selectionEnd;playSetup.searchDecks(t.value);refreshPlayMenu();const field=document.getElementById('playDeckSearch');field?.focus({preventScroll:true});try{field?.setSelectionRange(start,end);}catch{}};return {A,C,I,close:closePlayerMat};}
