import {profileAvatar} from './profile-art.js';
import {cardKey} from './core.js';

// The intro presents an already committed native outcome. It never rolls,
// changes the player order or submits a game action.
export function forgeStartingPlayer(snapshot){
 const receipt=snapshot?.pregame,players=snapshot?.players;
 if(receipt?.schema!=='cardstashy.forge-pregame.v1'||!['random','first','second'].includes(receipt.selection)||!['quick','practice'].includes(receipt.playStyle)
   ||!Number.isSafeInteger(receipt.firstPlayerId)||!Array.isArray(players)||players.length!==2
   ||players.some(p=>!Number.isSafeInteger(p?.id))||new Set(players.map(p=>p.id)).size!==2
   ||!players.some(p=>p.id===receipt.firstPlayerId)||players.filter(p=>p.isViewer===true).length!==1||players.filter(p=>p.id===snapshot.viewer&&p.isViewer===true).length!==1
   ||receipt.playStyle==='quick'&&receipt.selection!=='random')return null;
 return {firstPlayerId:receipt.firstPlayerId,ownFirst:receipt.firstPlayerId===snapshot.viewer,selection:receipt.selection};
}

export function forgeDeckBackdrop(deck,lookup){
 const commanders=(deck?.commanders||[]).map(row=>typeof row==='string'?{name:row}:row);
 const names=[deck?.commander,...commanders.map(row=>row?.name),...(deck?.cards||[]).map(row=>row.name)].filter(name=>typeof name==='string'&&name);
 for(const name of [...new Set(names)]){
  const row=deck?.cards?.find(row=>cardKey(row.name)===cardKey(name))||commanders.find(row=>cardKey(row?.name)===cardKey(name));
  const preparedName=row?.name||name,selection=deck?.referencePriceSelections?.[cardKey(preparedName)];
  const card=lookup(preparedName,row?.printingId||selection?.printingId||null);
  const value=card?.image_uris?.art_crop||card?.card_faces?.[0]?.image_uris?.art_crop;
  try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
 }
 return null;
}

export function mountForgeMatchIntro({root,setup,lookup=()=>null,onCancel=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),isCurrent=()=>true}={}){
 const doc=root.ownerDocument,view=doc.defaultView,profile=setup.profile||{};
 const node=(tag,text,cls)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 let closed=false,pendingChoice=null;
 const stage=node('section',undefined,'forge-match-intro'),header=node('header',undefined,'forge-intro-header');
 stage.setAttribute('aria-label','Your matchup');
 const format=node('p',`${setup.match.format} · ${setup.playStyle==='quick'?'Quick Play':'Practice'}`,'forge-intro-eyebrow');
 const heading=node('h1','A new match awaits');heading.tabIndex=-1;
 header.append(format,heading,node('p','Your deck. Your decisions.','forge-intro-subtitle'));
 const versus=node('div',undefined,'forge-intro-versus'),seats=[];
 for(const [own,deck]of [[true,setup.selected],[false,setup.opponent]]){
  const seat=node('section',undefined,'forge-intro-seat '+(own?'forge-intro-you':'forge-intro-cpu'));
  const artwork=node('div',undefined,'forge-intro-art'),identity=node('div',undefined,'forge-intro-identity'),avatar=node('span',undefined,'forge-intro-avatar');
  artwork.setAttribute('aria-hidden','true');
  if(own)avatar.innerHTML=profileAvatar(profile.avatarArt,{display_name:profile.displayName,username:profile.username,avatar_url:profile.avatarUrl});
  else{const crest=node('span','CPU','forge-cpu-crest');crest.setAttribute('aria-hidden','true');avatar.append(crest);}
  const name=node('div',undefined,'forge-intro-name');name.append(node('small',own?'YOU':'YOUR OPPONENT'),node('h2',own?(profile.displayName||profile.username||'You'):'CPU'));
  if(own&&profile.username)name.append(node('span','@'+profile.username.replace(/^@/,'')));
  identity.append(avatar,name);
  const deckInfo=node('div',undefined,'forge-intro-deck');deckInfo.append(node('span','DECK'),node('h3',deck?.name||'Selected deck'));
  seat.append(artwork,identity,deckInfo);seats.push({deck,artwork});versus.append(seat);
  if(own){const vs=node('span','VS','forge-intro-vs');vs.setAttribute('aria-hidden','true');versus.append(vs);}
 }
 const footer=node('footer',undefined,'forge-intro-footer'),steps=node('ol',undefined,'forge-intro-steps');
 for(const [i,label]of ['Matchup','First player','Opening hand'].entries()){const step=node('li',label);if(i===0)step.setAttribute('aria-current','step');steps.append(step);}
 const status=node('p','Preparing your match…','forge-intro-status');status.setAttribute('role','status');
 const cancel=node('button','Return to setup','btn ghost forge-intro-cancel');cancel.type='button';cancel.addEventListener('click',()=>{if(!closed)onCancel();});
 footer.append(steps,status,cancel);stage.append(header,versus,footer);root.className='play-mat-message play-forge-intro';root.replaceChildren(stage);
 const refreshArtwork=()=>{if(closed)return;for(const {deck,artwork}of seats){const url=forgeDeckBackdrop(deck,lookup);if(!url)continue;const img=node('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});artwork.replaceChildren(img);}};
 const chooseStartingPlayer=()=>{
  if(closed||!isCurrent())return Promise.resolve(null);
  if(setup.playStyle==='quick')return Promise.resolve('random');
  return new Promise(resolve=>{
   pendingChoice=resolve;
   const chooser=node('section',undefined,'forge-intro-toss forge-intro-choice');chooser.setAttribute('aria-label','Choose who plays first');
   const title=node('h2','How will you begin?');title.tabIndex=-1;
   chooser.append(node('p','PRACTICE','forge-intro-eyebrow'),title,node('p','Choose your starting position for this game.'));
   const options=node('div',undefined,'forge-intro-start-options');
   for(const [value,label,detail]of [['random','Flip a coin','Let chance choose'],['first','Play first','Take the first turn'],['second','Play second','Let the CPU begin']]){
    const button=node('button');button.type='button';button.append(node('strong',label),node('span',detail));
    button.addEventListener('click',()=>{if(closed||!isCurrent()||!pendingChoice)return;const done=pendingChoice;pendingChoice=null;chooser.remove();done(value);});options.append(button);
   }
   const back=node('button','Return to setup','btn ghost forge-intro-cancel');back.type='button';back.addEventListener('click',()=>{if(!closed)onCancel();});
   chooser.append(options,back);stage.append(chooser);title.focus();
  });
 };
 // Whole-deck preparation populates lookup before this call; never request an
 // individual hand card or couple missing artwork to admission.
 const reveal=async snapshot=>{
  const result=forgeStartingPlayer(snapshot);if(!result||closed||!isCurrent())return false;
  const rulesChanged=result.selection==='first'&&!result.ownFirst||result.selection==='second'&&result.ownFirst;
  const reduced=view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const curtain=node('section',undefined,'forge-intro-toss');curtain.setAttribute('role','status');curtain.setAttribute('aria-live','polite');
  const coin=node('div',result.ownFirst?'YOU':'CPU','forge-intro-coin');coin.setAttribute('aria-hidden','true');
  const label=node('p',result.selection==='random'?'Flipping the coin…':'Starting player','forge-intro-eyebrow');
  const outcome=node('h2',result.ownFirst?'You play first':'CPU plays first');outcome.hidden=!reduced;
  curtain.append(label,coin,outcome,node('p',rulesChanged?'Card rules determined the starting player. Your opening hand is next.':'Your opening hand is next.'));stage.append(curtain);
  for(const step of steps.children)step.removeAttribute?.('aria-current');steps.children[1]?.setAttribute('aria-current','step');
  if(!reduced&&result.selection==='random')curtain.classList.add('is-flipping');
  await wait(reduced?200:result.selection==='random'?950:250);
  if(closed||!isCurrent())return false;
  curtain.classList.remove('is-flipping');outcome.hidden=false;label.textContent=result.selection==='random'?'Coin toss complete':'Starting player';
  await wait(reduced?350:850);
  return !closed&&isCurrent();
 };
 heading.focus();
 return {refreshArtwork,async showMatchup(){if(closed||!isCurrent())return;status.textContent='Your matchup is ready.';await wait(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches?150:750);},chooseStartingPlayer,reveal,status(text){if(!closed)status.textContent=text;},destroy(){if(closed)return;closed=true;pendingChoice?.(null);pendingChoice=null;stage.remove();}};
}
