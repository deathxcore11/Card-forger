// The application host around the tested rules worker/table. No second engine,
// artwork system, Power calculator, inventory save or automatic concession.
import {capturePracticeArtwork,practiceArtworkHooks} from './play-card-surface.js';
import {capturePracticeDeckContext} from './play-deck-context.js';
import {reviewPracticeSetup} from './experiments/phase-engine/practice-preflight.mjs';
import {powerChip} from './power.js';
import {brandMark} from './brand.js';
import {profileAvatar} from './profile-art.js';
const loadModules=async()=>{
 const [flow,table]=await Promise.all([import('./experiments/phase-engine/practice-flow.mjs'),import('./experiments/phase-engine/match-table.mjs')]);
 return {createPracticeFlow:flow.createPracticeFlow,mountMatchTable:table.mountMatchTable};
};
export function createPlayerMat({root,readAccount,readSetup,lookup,prepareArtwork=async()=>{},reviewDecks=async()=>null,captureContext=capturePracticeDeckContext,onChange=()=>{},onClose=()=>{},onHome=null,onRematch=null,onSaveDeck=null,load=loadModules,sessionOnly=true}={}){
 if(!root||typeof readAccount!=='function'||typeof readSetup!=='function'||typeof lookup!=='function'||typeof prepareArtwork!=='function'||typeof reviewDecks!=='function')throw Error('PLAYER_MAT_HOST_REQUIRED');
 if(typeof sessionOnly!=='boolean')throw Error('INVALID_SESSION_MODE');
 let generation=0,flow=null,table=null,opening=false,last=null,frame=null,pendingPaint=null,warning=false,reviewingResult=false,resultKey=null,matchup=null,matchOwner=null,savedDeckId=null,savePromise=null;
 const view=root.ownerDocument.defaultView;
 const sessionNote='Keep this page open. Refreshing or leaving ends this Practice session; it cannot be resumed.';
 const beforeUnload=event=>{event.preventDefault();event.returnValue='';};
 const warnOnLeave=active=>{if(active===warning)return;warning=active;if(active)view.addEventListener('beforeunload',beforeUnload);else view.removeEventListener('beforeunload',beforeUnload);};
 const stopPaint=()=>{if(frame!==null)view.cancelAnimationFrame(frame);frame=null;pendingPaint=null;};
 const accountKey=()=>{const a=readAccount()||{};return JSON.stringify([a.user?.id,a.accountGeneration??a.generation??null,!!a.locked,!!a.switching]);};
 const setupKey=s=>JSON.stringify([s.profile?.ownerId,s.selected,s.opponent,s.match]);
 const node=(tag,text)=>{const el=root.ownerDocument.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function message(title,lines=[],dismiss=false){stopPaint();table?.destroy();table=null;root.replaceChildren();root.className='play-mat-message';const panel=node('section');panel.className='panel play-journey-message';const mark=node('div');mark.className='play-journey-logo';mark.setAttribute('aria-hidden','true');mark.innerHTML=brandMark(dismiss?'brand-idle':'brand-loading');const heading=node('h1',title);heading.tabIndex=-1;panel.append(mark,heading);panel.setAttribute('aria-live','polite');for(const line of lines)panel.append(node('p',line));const back=node('button',dismiss?'Return to Play setup':'Cancel and return to setup');back.type='button';back.className=dismiss?'btn':'btn ghost';back.addEventListener('click',onClose);panel.append(back);root.append(panel);if(dismiss)heading.focus();}
 function resultScreen(state,ticket){
  const game=state.game,key=JSON.stringify([game.status.revision,game.status.terminal]);if(resultKey===key)return;resultKey=key;
  stopPaint();table?.destroy();table=null;root.replaceChildren();root.className='play-mat-message';const panel=node('section');panel.className='panel play-journey-message play-match-result';
  const winner=game.status.terminal.winner,title=node('h1','Match finished');title.tabIndex=-1;panel.append(node('p','Magic Practice · '+(matchup?.match.format||'Beta')),title,node('h2',winner===null?'Draw':winner===game.status.surface.seat?'You won':'CPU won'));
  panel.append(node('p','This build reports the winner but does not yet distinguish a timeout, concession or other ending here.'));
  if(matchup)panel.append(node('p',matchup.selected.name+' vs '+matchup.opponent.name));
  panel.append(node('p',sessionOnly?'Session-only match: no resumable match record is saved.':'Review the final board before leaving.'));
  const actions=node('div');actions.className='actions wrap';const add=(label,fn,primary=false)=>{const b=node('button',label);b.type='button';b.className=primary?'btn':'btn ghost';b.addEventListener('click',fn);actions.append(b);};
  const savedLink=()=>{const link=node('a','Open saved deck');link.className='btn ghost';link.href='#deck/'+encodeURIComponent(savedDeckId)+'/cards';link.addEventListener('click',onClose);actions.append(link);};
  if(savedDeckId)savedLink();
  if(onSaveDeck&&matchup?.selected){const save=node('button',savedDeckId?'Deck saved':'Save deck'),feedback=node('p');save.type='button';save.className='btn ghost';save.disabled=!!savedDeckId||!!savePromise;feedback.setAttribute('role','status');actions.append(save);
   save.addEventListener('click',async()=>{if(savePromise||ticket!==generation||accountKey()!==matchOwner)return;save.disabled=true;save.textContent='Saving deck…';try{savePromise=Promise.resolve(onSaveDeck(structuredClone(matchup.selected)));const id=await savePromise;if(ticket!==generation||accountKey()!==matchOwner)return;savedDeckId=id;save.textContent='Deck saved';feedback.textContent='Saved to Your decks.';savedLink();}catch{if(ticket===generation){feedback.textContent='The deck could not be saved. Try again.';save.disabled=false;save.textContent='Retry saving deck';}}finally{savePromise=null;}});panel.append(feedback);}
  add('Review final board',()=>{reviewingResult=true;resultKey=null;receive(state,ticket);});
  if(onRematch)add('Rematch setup',onRematch,true);add('Return to Play setup',onClose);if(onHome)add('Home',onHome);panel.append(actions);root.append(panel);title.focus();
 }
 function contextPanel(binding){
  const ctx=binding?.deckContexts;if(!ctx)return null;const details=node('details'),summary=node('summary','Deck Power & Commander brackets');details.dataset.keepOpen='deck-context';summary.dataset.focusKey='match-context-summary';details.append(summary);
  for(const [seat,label]of [['player','Your deck'],['opponent','CPU deck']]){
   const c=ctx[seat];if(!c)continue;const row=node('section');row.append(node('strong',label));const power=node('span');power.innerHTML=powerChip({score:Number.isFinite(c.power?.value)&&c.power.value>=0&&c.power.value<=100?c.power.value:null});row.append(power);
   if(c.bracket){const b=c.bracket;row.append(node('p',b.value===null?'Commander bracket needs review':`At least Bracket ${b.value} · ${b.name||''}`));if(b.target)row.append(node('p',`Aiming for Bracket ${b.target} · ${b.targetStatus||'unverified'}`));for(const reason of b.reasons||[])row.append(node('p',reason));row.append(node('small',`Guidance ${b.guidanceDate||'unknown'} · list ${b.listDate||'unknown'} · ${b.status||'unverified'}`));}
   row.append(node('p',c.note||'Estimates, not measured CPU strength.'));details.append(row);
  }return details;
 }
 let modules;
 function deckArtUrl(deck){const cover=deck?.commander||deck?.cards?.[0]?.name,card=cover?lookup(cover):null;return card?.image_uris?.art_crop||card?.card_faces?.[0]?.image_uris?.art_crop||null;}
 function matchBackdrop(){const box=node('div');for(const deck of [matchup?.selected,matchup?.opponent]){const url=deckArtUrl(deck);if(url){const img=node('img');img.src=url;img.alt='';box.append(img);}}return box.childNodes.length?box:null;}
 function playerPortrait(own,profile){
  const wrapper=node('span');
  if(own)wrapper.innerHTML=profileAvatar(profile?.avatarArt,{display_name:profile?.displayName,username:profile?.username,avatar_url:profile?.avatarUrl});
  else wrapper.textContent='CPU';
  return wrapper;
 }
 function receive(state,ticket){
  if(ticket!==generation)return;last=state;
  warnOnLeave(!!(sessionOnly&&state.phase==='playing'&&state.game?.status&&!state.game.status.terminal));
  if(sessionOnly&&state.phase==='session-ended')message('Practice session stopped',['The outcome could not be verified. Start a new match from Play.',sessionNote],true);
  else if(state.phase==='finished'&&state.game?.status?.terminal&&!reviewingResult)resultScreen(state,ticket);
  else if(state.game){pendingPaint=state;if(frame===null)frame=view.requestAnimationFrame(()=>{frame=null;const paint=pendingPaint;pendingPaint=null;if(ticket!==generation||!paint)return;const session=flow?.getSession();if(!session)return;if(!table)table=modules.mountMatchTable(root,{session,profile:paint.binding?.profile,renderPlayerPortrait:own=>playerPortrait(own,paint.binding?.profile),renderPlayerBackdrop:own=>{const deck=own?matchup?.selected:matchup?.opponent,url=deckArtUrl(deck);if(!url)return null;const img=node('img');img.src=url;img.alt='';img.title=deck?.commander?'Commander art: '+deck.commander:'Deck artwork';return img;},format:matchup?.match?.format,renderMatchBackdrop:matchBackdrop,title:'CardStashy · Magic Practice · Beta',allowConcede:true,...practiceArtworkHooks(),onExit:()=>{if(last?.phase==='finished'&&!reviewingResult)return resultScreen(last,ticket);onClose();},renderMatchContext:()=>{const context=contextPanel(paint.binding);if(!sessionOnly)return context;const wrapper=node('section');wrapper.append(node('p',sessionNote));if(context)wrapper.append(context);return wrapper;}});table.render(paint.game);});}
  else if(state.phase==='unavailable'){
   const a=state.binding?.admission,notes=[];for(const [seat,label]of [['player','Your deck'],['opponent','CPU deck']]){const s=a?.seats?.[seat];if(s&&!s.admitted){notes.push(label+': this list did not pass the match checks.');if(s.unsupported?.length)notes.push(label+': unverified cards — '+s.unsupported.join(', '));}}
   if(state.error==='DIFFICULTY_UNAVAILABLE')notes.push('This CPU difficulty is not available yet. Choose Medium in setup.');message('Match needs review',notes,true);
  }else if(state.phase==='account-changed')message('Account changed',['Return to Play in the current account.'],true);
  else if(state.phase==='recovery-required'&&!state.game)message(sessionOnly?'Practice session stopped':'Recover your saved match',sessionOnly?['The outcome could not be verified. Start a new match from Play.',sessionNote]:['The outcome is uncertain. Resume this same match before another command.'],true);
  onChange(structuredClone(state));
 }
 async function open({resume=false,matchId,seed,first}={}){
  if(resume&&sessionOnly)throw Error('SESSION_RESUME_UNAVAILABLE');
  if(opening||flow)throw Error('MATCH_ALREADY_OPEN');opening=true;const ticket=++generation,owner=accountKey(),setup=resume?null:readSetup(),selection=setup&&setupKey(setup);
  try{
   if(!resume){const review=reviewPracticeSetup(setup);if(!review.canLoad){const error=Error('PRACTICE_SETUP_UNAVAILABLE');error.review=review;throw error;}matchup=structuredClone(setup);matchOwner=owner;}
   message('Opening Practice…',sessionOnly?[sessionNote]:[]);modules=await load();if(!resume){message('Preparing your cards…',sessionOnly?[sessionNote]:[]);await prepareArtwork(structuredClone(setup));}
   if(ticket!==generation||accountKey()!==owner||!resume&&setupKey(readSetup())!==selection)throw Error('SELECTION_CHANGED');
   const catalog=resume?null:await reviewDecks(structuredClone(setup));
   if(ticket!==generation||accountKey()!==owner||!resume&&setupKey(readSetup())!==selection)throw Error('SELECTION_CHANGED');
   const captured=resume?null:{...setup,selected:captureContext(capturePracticeArtwork(setup.selected,lookup)),opponent:captureContext(capturePracticeArtwork(setup.opponent,lookup))};
   if(catalog){captured.selected.practiceCatalogReview=structuredClone(catalog.player);captured.opponent.practiceCatalogReview=structuredClone(catalog.opponent);}
   flow=modules.createPracticeFlow({readAccount,readSetup:()=>captured,sessionOnly,onChange:state=>receive(state,ticket),onProgress:p=>{if(ticket===generation&&!table)message(p.stage==='rules'?'Preparing card rules…':'Loading Practice…',sessionOnly?[sessionNote]:[]);}});
   const result=resume?await flow.resume(matchId):await flow.start({opponent:captured.opponent,seed,first});
   if(ticket!==generation)throw Error('PLAYER_MAT_CLOSED');return result;
  }catch(error){if(ticket===generation){warnOnLeave(false);message(error.review?'Review Practice setup':'Practice could not open',error.review?[...error.review.reasons,...Object.entries(error.review.seats||{}).filter(([,s])=>s.unsupported.length).map(([seat,s])=>(seat==='player'?'Your deck':'CPU deck')+': '+s.unsupported.join(', '))]:['The match could not be prepared. Return to setup and try again; your selected decks remain there.',...(sessionOnly?[sessionNote]:[])],true);onChange({phase:sessionOnly?'session-ended':'error',error:error.message});}throw error;}
  finally{if(ticket===generation)opening=false;}
 }
 return {start:options=>open(options),resume:matchId=>open({resume:true,matchId}),snapshot:()=>last?structuredClone(last):null,requestExit:()=>table?.requestExit(),
  reconcile:()=>flow?.reconcile()??true,
  detach(){generation++;warnOnLeave(false);stopPaint();opening=false;flow?.detach();flow=null;table?.destroy();table=null;last=null;root.replaceChildren();}
 };
}
