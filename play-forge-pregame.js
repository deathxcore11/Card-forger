import {profileAvatar} from './profile-art.js';
import {cardKey} from './core.js';

// The intro presents an already committed native outcome. It never rolls,
// changes the player order or submits a game action.
export function forgeStartingPlayer(snapshot){
 const receipt=snapshot?.pregame,players=snapshot?.players;
 if(receipt?.schema!=='cardstashy.forge-pregame.v1'||!['random','first','second'].includes(receipt.selection)||!['quick','practice'].includes(receipt.playStyle)
   ||!Number.isSafeInteger(receipt.firstPlayerId)||!Array.isArray(players)||players.length<2||players.length>4
   ||players.some(p=>!Number.isSafeInteger(p?.id))||new Set(players.map(p=>p.id)).size!==players.length
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

// Choice icons share the packet's outline style (24-unit grid, currentColor).
const START_ICONS={
 random:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><path d="m12 8.8 1 2.1 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z"/></svg>',
 first:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
 second:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/></svg>',
};
export function mountForgeMatchIntro({root,setup,lookup=()=>null,onCancel=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),isCurrent=()=>true}={}){
 const doc=root.ownerDocument,view=doc.defaultView,profile=setup.profile||{};
 const node=(tag,text,cls)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 let closed=false,pendingChoice=null;
 const stage=node('section',undefined,'forge-match-intro'),header=node('header',undefined,'forge-intro-header');
 stage.setAttribute('aria-label','Your matchup');
 const rival=setup.friend?.name||'CPU',format=node('p',`${setup.match.format} · ${setup.friend?'Friend match':setup.playStyle==='quick'?'Quick Play':'Practice'}`,'forge-intro-eyebrow');
 const heading=node('h1','A new match awaits');heading.tabIndex=-1;
 header.append(format,heading);
 const versus=node('div',undefined,'forge-intro-versus'),seats=[];
 // A Commander pod shows every CPU: you on one side, CPU 2-4 stacked on the other.
 const extra=Array.isArray(setup.extraOpponents)?setup.extraOpponents.filter(o=>o?.deck).map(o=>o.deck):[],pod=extra.length>0;
 let cpuColumn=null;
 if(pod)versus.classList.add('forge-intro-versus--pod');
 for(const [index,[own,deck]]of [[true,setup.selected],[false,setup.opponent],...extra.map(d=>[false,d])].entries()){
  const seat=node('section',undefined,'forge-intro-seat '+(own?'forge-intro-you':'forge-intro-cpu'));
  const cpuName=pod?'CPU '+(index+1):rival;
  const artwork=node('div',undefined,'forge-intro-art'),identity=node('div',undefined,'forge-intro-identity'),avatar=node('span',undefined,'forge-intro-avatar');
  artwork.setAttribute('aria-hidden','true');
  if(own)avatar.innerHTML=profileAvatar(profile.avatarArt,{display_name:profile.displayName,username:profile.username,avatar_url:profile.avatarUrl});
  // A friend shows their own profile picture: card art with their crop, or a photo.
  else if(setup.friend){const f=setup.friend;avatar.innerHTML=profileAvatar(f.image&&f.crop?{game:'mtg',cardId:'friend',name:f.name||'Friend',image:f.image,...f.crop}:null,{display_name:f.name||'Friend',avatar_url:f.image&&!f.crop?f.image:''});}
  else{const crest=node('span','CPU','forge-cpu-crest');crest.setAttribute('aria-hidden','true');avatar.append(crest);}
  const name=node('div',undefined,'forge-intro-name');if(own||!pod)name.append(node('small',own?'YOU':'YOUR OPPONENT'));name.append(node('h2',own?(profile.displayName||profile.username||'You'):cpuName));
  if(own&&profile.username)name.append(node('span','@'+profile.username.replace(/^@/,'')));
  identity.append(avatar,name);
  const deckInfo=node('div',undefined,'forge-intro-deck');deckInfo.append(node('span','DECK'),node('h3',!own&&setup.friend?'Hidden until played':deck?.name||'Selected deck'));
  seat.append(artwork,identity,deckInfo);seats.push({deck,artwork});
  if(own||!pod)versus.append(seat);else{if(!cpuColumn){cpuColumn=node('div',undefined,'forge-intro-pod');versus.append(cpuColumn);}cpuColumn.append(seat);}
  if(own){const vs=node('span','VS','forge-intro-vs');vs.setAttribute('aria-hidden','true');versus.append(vs);}
 }
 const footer=node('footer',undefined,'forge-intro-footer'),steps=node('ol',undefined,'forge-intro-steps');
 for(const [i,label]of ['Matchup','First player','Opening hand'].entries()){const step=node('li',label);if(i===0)step.setAttribute('aria-current','step');steps.append(step);}
 const status=node('p','Preparing your match…','forge-intro-status');status.setAttribute('role','status');
 // Seconds since the table was requested: shown, never announced (the stage above is).
 const elapsed=node('span','','forge-intro-elapsed');elapsed.setAttribute('aria-hidden','true');elapsed.hidden=true;
 const note=node('p','','forge-intro-note');note.hidden=true;
 const cancel=node('button','Return to setup','btn ghost forge-intro-cancel');cancel.type='button';cancel.addEventListener('click',()=>{if(!closed)onCancel();});
 footer.append(steps,status,elapsed,note,cancel);stage.append(header,versus,footer);root.className='play-mat-message play-forge-intro';root.replaceChildren(stage);
 const refreshArtwork=()=>{if(closed)return;for(const {deck,artwork}of seats){const url=forgeDeckBackdrop(deck,lookup);if(!url)continue;const img=node('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});artwork.replaceChildren(img);}};
 const chooseStartingPlayer=()=>{
  if(closed||!isCurrent())return Promise.resolve(null);
  if(setup.playStyle==='quick')return Promise.resolve('random');
  return new Promise(resolve=>{
   pendingChoice=resolve;
   const chooser=node('section',undefined,'forge-intro-toss forge-intro-choice');chooser.setAttribute('aria-label','Choose who plays first');
   const title=node('h2','How will you begin?');title.tabIndex=-1;
   chooser.append(node('p','PRACTICE','forge-intro-eyebrow'),title);
   const options=node('div',undefined,'forge-intro-start-options');
   for(const [value,label,detail]of [['random','Flip a coin','Let chance choose'],['first','Play first','Take the first turn'],['second','Play second','Let the CPU begin']]){
    const button=node('button'),icon=node('span',undefined,'forge-intro-option-icon');button.type='button';button.setAttribute('data-choice',value);icon.setAttribute('aria-hidden','true');icon.innerHTML=START_ICONS[value];button.append(icon,node('strong',label),node('span',detail));
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
  // A two-faced coin: your profile picture on one side, the CPU deck's art on the
  // other. It lands on the side Forge already committed; it never decides anything.
  const coin=node('div',undefined,'forge-intro-coin'),body=node('div',undefined,'forge-coin-body'),you=node('span',undefined,'forge-coin-face forge-coin-you'),cpu=node('span',undefined,'forge-coin-face forge-coin-cpu');
  coin.setAttribute('aria-hidden','true');coin.setAttribute('data-result',result.ownFirst?'you':'cpu');
  you.innerHTML=profileAvatar(profile.avatarArt,{display_name:profile.displayName,username:profile.username,avatar_url:profile.avatarUrl});you.append(node('b','YOU'));
  const cpuArt=forgeDeckBackdrop(setup.opponent,lookup);if(cpuArt){const img=node('img');img.src=cpuArt;img.alt='';img.referrerPolicy='no-referrer';cpu.append(img);}cpu.append(node('b',setup.friend?String(setup.friend.name||'Friend').toUpperCase():'CPU'));
  body.append(you,cpu);coin.append(body);
  const label=node('p',result.selection==='random'?'Flipping the coin…':'Starting player','forge-intro-eyebrow');
  const outcome=node('h2',result.ownFirst?'You play first':`${setup.friend?.name||'CPU'} plays first`);outcome.hidden=!reduced;
  curtain.append(label,coin,outcome,node('p',rulesChanged?'Card rules determined the starting player. Your opening hand is next.':'Your opening hand is next.'));stage.append(curtain);
  for(const step of steps.children)step.removeAttribute?.('aria-current');steps.children[1]?.setAttribute('aria-current','step');
  if(!reduced&&result.selection==='random')curtain.classList.add('is-flipping');
  await wait(reduced?200:result.selection==='random'?950:250);
  if(closed||!isCurrent())return false;
  curtain.classList.remove('is-flipping');curtain.classList.add('is-landed');outcome.hidden=false;label.textContent=result.selection==='random'?'Coin toss complete':'Starting player';
  await wait(reduced?350:850);
  return !closed&&isCurrent();
 };
 heading.focus();
 return {refreshArtwork,async showMatchup(){if(closed||!isCurrent())return;status.textContent='Your matchup is ready.';await wait(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches?150:750);},chooseStartingPlayer,reveal,status(text){if(!closed)status.textContent=text;},
  elapsed(text){if(closed)return;elapsed.hidden=!text;elapsed.textContent=text||'';},
  note(text){if(closed)return;note.hidden=!text;note.textContent=text||'';},destroy(){if(closed)return;closed=true;pendingChoice?.(null);pendingChoice=null;stage.remove();}};
}
