import {binderCover} from './binders.js';
import {deckBoxMarkup} from './deck-box.js';
import {esc} from './ui.js';
import {profileArt,profileAvatar} from './profile-art.js';
import {GAMES} from './games.js';

const label=p=>p?.username||p?.display_name||'Collector';
const safeImage=value=>typeof value==='string'&&/^(https:\/\/|img\/)/.test(value)?value:'';
// A showcase is an explicit snapshot. Never serialize private lot values, notes,
// addresses, account data, deck history, or the complete workspace into it.
export function showcaseItem(value){
 if(!['binder','deck'].includes(value?.kind)||!GAMES[value.game])throw Error('Choose a binder or deck.');
 return {key:String(value.key).slice(0,150),kind:value.kind,game:value.game,title:String(value.title||'Untitled').slice(0,100),format:String(value.format||'').slice(0,60),commander:String(value.commander||'').slice(0,200),deckSchema:value.deckSchema===1?1:0,presentationSchema:1,appearance:{color:/^#[a-f\d]{6}$/i.test(value.appearance?.color)?value.appearance.color:'',image:safeImage(value.appearance?.image),background:safeImage(value.appearance?.background),cover:(Array.isArray(value.appearance?.cover)?value.appearance.cover:[]).slice(0,9).map(safeImage).filter(Boolean)},cards:(value.cards||[]).slice(0,5000).map(c=>({id:String(c.id||'').slice(0,100),name:String(c.name||'Card').slice(0,200),qty:Math.min(999,Math.max(1,Math.floor(Number(c.qty)||1))),image:safeImage(c.image),set:String(c.set||'').slice(0,150),number:String(c.number||'').slice(0,60),version:String(c.version||'').slice(0,120),zone:['main','extra','side'].includes(c.zone)?c.zone:'main',referenceUSD:c.referenceUSD!==null&&c.referenceUSD!==undefined&&Number.isFinite(Number(c.referenceUSD))&&Number(c.referenceUSD)>=0?Math.min(1000000,Number(c.referenceUSD)):null}))};
}
export function sharedDeckCopy(value,id){
 const item=showcaseItem(value);
 if(item.kind!=='deck'||item.deckSchema!==1||!item.format)throw Error('Ask the owner to update this shared deck before copying it.');
 if(!item.cards.length||item.cards.some(c=>!c.id||!c.name))throw Error('This deck has unmatched cards. Ask the owner to update it.');
 const base={id,name:item.title,format:item.format,boxAppearance:{color:item.appearance.color||'#7664a0',image:item.appearance.image},locked:false,createdAt:new Date().toISOString(),source:{kind:'Community copy',description:'Independent copy of a shared deck.'}};
 return item.game==='mtg'?{...base,commander:item.commander,strategy:'Auto',cards:item.cards.filter(c=>c.zone==='main').map(c=>({name:c.name,qty:c.qty})),side:item.cards.filter(c=>c.zone==='side').map(c=>({name:c.name,qty:c.qty})),versions:[]}:{...base,zones:Object.fromEntries(['main','extra','side'].map(z=>[z,item.cards.filter(c=>c.zone===z).map(c=>({cardId:c.id,name:c.name,qty:c.qty}))]))};
}
export function showcaseValue(value){const item=showcaseItem(value);return item.cards.reduce((v,c)=>{if(c.referenceUSD===null)v.unpriced+=c.qty;else{v.total+=c.referenceUSD*c.qty;v.priced+=c.qty;}return v;},{total:0,priced:0,unpriced:0});}
export function sharedBinderValue(item){const v=showcaseValue(item);return `<div class="community-binder-value"><strong>${v.priced?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v.total):'Value unavailable'}</strong><span>Known reference subtotal${v.unpriced?' · '+v.unpriced+' unpriced':''}</span><small>Public reference prices when shared; condition and edition may differ.</small></div>`;}
export function showcaseDetail(value,{sharing=false}={}){
 const item=showcaseItem(value),v=showcaseValue(item),count=item.cards.reduce((n,c)=>n+c.qty,0);
 return `<p class="muted small">${esc(GAMES[item.game].name)}${item.format?' · '+esc(item.format):''} · ${count} cards · Read-only shared ${item.kind}</p>${item.kind==='binder'?sharedBinderValue(item):''}${item.commander?`<p>Commander: ${esc(item.commander)}</p>`:''}<div class="community-card-grid">${item.cards.map((c,i)=>`<article><button class="community-shared-card" data-community-card="${i}" aria-label="View ${esc(c.name)}">${c.image?`<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.hidden=true">`:''}<b>${esc(c.name)}</b><small>×${c.qty}${c.number?' · #'+esc(c.number):''}${c.version?' · '+esc(c.version):''}${item.kind==='deck'&&c.zone!=='main'?' · '+esc(c.zone):''}</small></button></article>`).join('')}</div>${sharing?'<footer><button class="btn" data-community-publish>Show on my profile</button></footer>':item.kind==='deck'?`<footer><p class="muted small">Save an independent copy, then edit it in My decks.</p><button class="btn" data-community-copy ${item.deckSchema===1&&item.format?'':'disabled'}>Save to my decks</button>${item.deckSchema!==1?'<p class="muted small">The owner needs to update this shared deck to include its format and card sections.</p>':''}</footer>`:''}`;
}
export const incomingRequestCount=data=>(data?.people||[]).filter(p=>p.relationship==='pending'&&p.incoming).length;
const itemTile=(item,owner,picker=false)=>{
 const attrs=`${picker?'data-community-preview':'data-community-item'}="${esc(item.key)}"`,count=item.cards.reduce((n,c)=>n+c.qty,0),images=item.appearance?.cover?.length?item.appearance.cover:item.cards.map(c=>c.image).filter(Boolean);
 const cover=item.kind==='binder'?binderCover({title:item.title,subtitle:`${GAMES[item.game].short} · ${count} cards`,game:item.game,images:images.map(image=>({image})),color:item.appearance?.color,background:item.appearance?.background,attrs}):`<button class="deck-tile tcg-tile tile-${item.game}" ${attrs} aria-label="Open ${esc(item.title)}"><span class="tile-art">${images[0]?`<img src="${esc(images[0])}" alt="" loading="lazy">`:''}</span><span class="tile-shade"></span><span class="tile-top"><span class="deck-format-stack"><span class="chip">${esc(item.format||GAMES[item.game].short)}</span>${deckBoxMarkup({id:item.key,name:item.title,boxAppearance:item.appearance},{game:item.game,images})}</span></span><span class="tile-body"><b>${esc(item.title)}</b><small>${esc(GAMES[item.game].short)} · ${count} cards</small></span></button>`;
 return `<article class="community-showcase-item community-native-item">${cover}${owner?`<div class="community-item-actions"><button class="btn ghost small" data-community-source="${esc(item.key)}">Edit ${item.kind}</button>${picker?'':`<button class="link small" data-community-preview="${esc(item.key)}">Update shared copy</button><button class="link small" data-community-hide="${esc(item.key)}">Hide</button>`}</div>`:''}</article>`;
};
// Repair only snapshots whose complete card multiset still matches the local
// item. Never silently publish added/removed cards or infer another owner's zones.
export function repairOwnShowcase(item,choices){
 const local=choices.find(c=>c.key===item.key&&c.kind===item.kind&&c.game===item.game);if(!local)return item;
 const signature=value=>JSON.stringify((value.cards||[]).map(c=>[String(c.id||c.name),Number(c.qty)||1]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 if(signature(item)!==signature(local))return item;
 if(item.presentationSchema===1&&(item.kind!=='deck'||item.deckSchema===1))return item;
 const pool=local.cards.map(c=>({...c}));
 const next=showcaseItem({...item,appearance:local.appearance,format:item.deckSchema===1?item.format:local.format,commander:item.deckSchema===1?item.commander:local.commander,deckSchema:item.deckSchema===1?1:local.deckSchema,cards:item.cards.map(c=>{const i=pool.findIndex(r=>(r.id||r.name)===(c.id||c.name)&&r.qty===c.qty),match=pool.splice(i,1)[0];return {...c,zone:item.deckSchema===1?c.zone:match?.zone||c.zone};})});
 return next;
}
export function sharedBinderRows(item){return item.cards.map((c,index)=>({index,entry:{id:'shared-'+index,cardId:c.id,name:c.name,qty:c.qty},game:item.game,image:c.image,version:c.version,card:{id:c.id,game:item.game,name:c.name,image:c.image,imageLarge:c.image,image_uris:item.game==='mtg'?{normal:c.image}:undefined}}));}
export const showcaseSections=(items,owner)=>['binder','deck'].map(kind=>{const group=items.filter(i=>i.kind===kind);return `<section class="community-kind-section" aria-label="${kind==='binder'?'Binders':'Decks'}"><div class="community-section-heading"><h2>${kind==='binder'?'Binders':'Decks'} <span>${group.length}</span></h2>${owner?`<button class="btn ghost small" data-community-share="${kind}">Choose ${kind==='binder'?'binders':'decks'}</button>`:''}</div>${group.length?`<div class="community-showcase-grid">${group.map(i=>itemTile(i,owner)).join('')}</div>`:`<p class="community-empty small">${owner?'Choose what to share with accepted friends.':'Nothing shared here yet.'}</p>`}</section>`;}).join('');
const personPill=(p,controls='')=>`<div class="community-person">${profileAvatar(p.avatar,p)}<span><b>${esc(label(p))}</b></span>${controls}</div>`;
const profileHTML=(p,items,owner=false)=>{
 const avatar=profileArt(p.avatar),header=profileArt(p.header)||avatar;
 return `<section class="community-profile-card"><div class="community-profile-header${header&&header.ratio<.9?' community-profile-header--card':''}">${header?`<img src="${esc(header.image)}" alt="" onerror="this.hidden=true">`:''}${owner?'<button class="btn ghost small" data-community-header>Edit header</button>':''}</div><div class="community-profile-body"><div class="community-profile-identity"><button class="community-avatar-open" data-community-avatar aria-label="View profile artwork">${profileAvatar(avatar,p)}</button><div><h1>${esc(label(p))}</h1><span class="community-privacy">Accepted friends only</span></div>${owner?'<button class="btn ghost small" data-community-edit>Edit profile</button>':''}</div>${p.bio?`<p class="community-bio">${esc(p.bio)}</p>`:owner?'<p class="muted small">Add a short bio to make this space yours.</p>':''}${showcaseSections(items,owner)}</div></section>`;
};
export function communityPage({account,data,busy=false,error,localArt={}}){
 const p={...(account.profile||{}),avatar:data?.art?.avatar||localArt.avatar,header:data?.art?.header||localArt.header},people=data?.people||[],friends=people.filter(p=>p.relationship==='accepted');
 return `<main class="community-page">${!account.user?`<section class="community-signin panel"><h1>Your collection has a story.</h1><p class="muted">Sign in to make your profile and connect with friends.</p><button class="btn" data-community-signin>Sign in</button></section>`:`${error?`<p class="note warn" role="alert">${esc(error)} <button class="link" data-community-retry>Retry</button></p>`:''}<div class="community-layout" aria-busy="${busy}">${profileHTML(p,data?.items||[],true)}<aside class="community-friends panel"><div class="community-section-heading"><h2>Friends${data?` <span>${friends.length}</span>`:""}</h2><button class="btn ghost small" data-community-panel="friends">Open friends</button></div>${busy&&!data?'<p class="muted" role="status">Loading your circle…</p>':''}${friends.map(p=>`<button class="community-friend-link" data-community-person="${esc(p.id)}">${personPill(p)}</button>`).join('')}${data&&!busy&&!error&&!friends.length?'<p class="muted small">Add someone by their username or email. They’ll appear here after accepting.</p>':''}<button class="link small" data-community-requests>Requests${incomingRequestCount(data)?` (${incomingRequestCount(data)})`:""}</button></aside></div>`}</main>`;
}

// Crossed swords: challenge a friend to a match.
const SWORDS='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/></svg>';
export function createCommunity({account,request,rerender,active,localArt,chooseArt,editProfile,signIn,openArt,openShared,showcaseChoices,editItem,copyDeck,onChange=()=>{},toast,challenge=null}){
 let flight=null,returnPanel=null,panelKind='',data=null,busy=false,error='',owner='',generation=0,dialog=null,dialogVersion=0,dialogOwner='',currentPerson=null,preview=null,working=false,shareKind='binder',shareQuery='',viewedItem=null;
 const identity=()=>account().user?.id||'';
 const close=()=>{returnPanel=null;panelKind='';dialogVersion++;dialog?.close();dialog?.remove();dialog=null;currentPerson=null;preview=null;viewedItem=null;};
 const reset=()=>{generation++;flight=null;data=null;busy=false;error='';owner=identity();close();onChange(null);};
 const syncOwner=()=>{if(owner!==identity())reset();};
 const redraw=()=>{if(active())rerender();};
 function refresh(){
  syncOwner();if(!owner)return Promise.resolve();if(flight)return flight;
  const token=++generation,who=owner;busy=true;error='';redraw();
  const job=(async()=>{try{
   const next=await Promise.resolve().then(()=>request('overview'));if(token!==generation||who!==identity())return;
   data=next;
   for(const [i,item] of (data.items||[]).entries()){
    const repaired=repairOwnShowcase(item,showcaseChoices());
    if(repaired!==item){await request('share',{item:repaired});if(token!==generation||who!==identity())return;data.items[i]=repaired;}
   }
   onChange(data);
  }catch(e){if(token===generation)error=e.message||'Could not load your friends.';}
  finally{if(token===generation){busy=false;flight=null;redraw();}}})();
  flight=job;return job;
 }
 const panelSnapshot=()=>dialog&&panelKind?{kind:panelKind,title:dialog.querySelector('h2')?.textContent,body:dialog.querySelector('.community-dialog-body').innerHTML,scroll:dialog.querySelector('.community-dialog-body').scrollTop,query:dialog.querySelector('[name="query"]')?.value||''}:null;
 const dismiss=()=>{const previous=returnPanel;if(!previous)return close();mount(previous.title,previous.body);panelKind=previous.kind;const body=dialog.querySelector('.community-dialog-body');body.scrollTop=previous.scroll;const input=dialog.querySelector('[name="query"]');if(input)input.value=previous.query;};

 const page=()=>{syncOwner();if(owner&&!data&&!busy&&!error)queueMicrotask(refresh);return communityPage({account:account(),data,busy,error,localArt:localArt()});};
 const currentProfile=()=>({...account().profile,avatar:data?.art?.avatar||localArt().avatar,header:data?.art?.header||localArt().header});
 const mount=(title,body)=>{close();dialogOwner=owner;dialog=document.createElement('dialog');dialog.className='community-dialog';dialog.setAttribute('aria-labelledby','communityDialogTitle');dialog.innerHTML=`<header><h2 id="communityDialogTitle">${esc(title)}</h2><button class="icon" data-community-close aria-label="Close">✕</button></header><div class="community-dialog-body">${body}</div><p class="community-message" role="status"></p>`;document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});dialog.showModal();return dialog;};
 const message=text=>{const el=dialog?.querySelector('.community-message');if(el)el.textContent=text;};
 const add=()=>{syncOwner();if(!owner)return signIn();mount('Friends',friendsNav('add')+'<p class="muted small">Enter their exact username or email. Profiles stay private until the request is accepted.</p><form data-community-search class="community-friend-search"><label class="field">Username or email<input name="query" type="search" minlength="3" maxlength="254" autocomplete="off" required></label><button class="btn" type="submit">Search</button></form><div data-community-found></div>');panelKind='add';};
 const relationshipControls=p=>p.relationship==='accepted'?`<button class="btn ghost small" data-community-person="${esc(p.id)}">View profile</button>`:p.relationship==='pending'?p.incoming?`<button class="btn small" data-community-action="accept" data-target="${esc(p.id)}">Accept</button><button class="link" data-community-action="decline" data-target="${esc(p.id)}">Decline</button>`:'<span class="muted small">Request sent</span>':`<button class="btn small" data-community-action="request" data-target="${esc(p.id)}">Add friend</button>`;
 async function search(form){if(working)return;const q=new FormData(form).get('query')?.trim();if(!q)return;const token=++dialogVersion,root=dialog;working=true;const button=form.querySelector('button');button.disabled=true;message('Searching…');try{const result=await request('lookup',{query:q});if(dialog!==root||token!==dialogVersion||dialogOwner!==identity())return;root.querySelector('[data-community-found]').innerHTML=result.person?personPill(result.person,relationshipControls(result.person)):'<p class="muted">No account found. Check the exact username or email.</p>';message('');}catch(e){if(dialog===root&&token===dialogVersion)message(e.message);}finally{working=false;if(button.isConnected)button.disabled=false;}}
 async function mine(){
  syncOwner();if(!owner)return signIn();
  const root=mount('My profile',profileHTML(currentProfile(),data?.items||[],true)),token=dialogVersion;
  await refresh();
  if(dialog!==root||token!==dialogVersion||dialogOwner!==identity())return;
  root.querySelector('.community-dialog-body').innerHTML=profileHTML(currentProfile(),data?.items||[],true);
  if(error)message(error);
 }
 async function showPerson(id){syncOwner();const previous=panelSnapshot();const root=mount('Player profile','<p class="muted">Loading profile…</p>'),token=dialogVersion;returnPanel=previous;try{const p=await request('profile',{target:id});if(dialog!==root||token!==dialogVersion||dialogOwner!==identity())return;currentPerson=p;root.querySelector('.community-dialog-body').innerHTML=(previous?'<button class="link" data-community-back>← Back to friends</button>':'')+profileHTML(p,p.items||[])+`<div class="community-friend-controls"><button class="link" data-community-action="remove" data-target="${esc(id)}">Remove friend</button><button class="link" data-community-action="block" data-target="${esc(id)}">Block</button></div>`;}catch(e){if(dialog===root)message(e.message);}}
 const friendsNav=selected=>`<nav class="friends-tabs" aria-label="Friends"><button data-community-panel="friends" aria-pressed="${selected==='friends'}">Friends</button><button data-community-panel="requests" aria-pressed="${selected==='requests'}">Requests${incomingRequestCount(data)?` <span>${incomingRequestCount(data)}</span>`:''}</button><button data-community-panel="add" aria-pressed="${selected==='add'}">Add friend</button></nav>`;
 const panelRows=kind=>{
  if(busy&&!data)return '<p class="muted" role="status">Loading your friends…</p>';
  if(error&&!data)return `<p role="alert">${esc(error)}</p><button class="btn ghost" data-community-panel="${kind}">Retry</button>`;
  const people=kind==='blocks'?(data?.blocked||[]):(data?.people||[]).filter(p=>p.relationship===(kind==='requests'?'pending':'accepted'));
  const warning=error?`<p class="note warn" role="status">Showing previously loaded information. ${esc(error)} <button class="link" data-community-panel="${kind}">Retry</button></p>`:'';
  if(!data)return '<p role="status">Loading your friends…</p>';
  return warning+(people.length?people.map(p=>kind==='friends'?`<div class="community-friend-row"><button class="community-friend-link" data-community-person="${esc(p.id)}">${personPill(p)}</button>${challenge?`<button class="community-challenge" data-community-challenge="${esc(p.id)}" aria-label="Challenge ${esc(label(p))} to a match" title="Challenge to a match">${SWORDS}</button>`:''}</div>`:personPill(p,kind==='blocks'?`<button class="btn ghost small" data-community-action="unblock" data-target="${esc(p.id)}">Unblock</button>`:relationshipControls(p)+(p.incoming?'':`<button class="link" data-community-action="decline" data-target="${esc(p.id)}">Cancel</button>`))).join(''):`<p class="muted">${kind==='blocks'?'No blocked accounts.':kind==='requests'?'No pending requests.':'Your accepted friends will appear here. Add a friend to start your circle.'}</p>`);
 };
 async function openPanel(kind='friends'){
  syncOwner();if(!owner)return signIn();if(kind==='add')return add();
  const root=mount(kind==='blocks'?'Blocked accounts':'Friends',(kind==='blocks'?'':friendsNav(kind))+'<div data-friends-content role="region" aria-live="polite"><p role="status">Loading…</p></div>'),token=dialogVersion;
  panelKind=kind;
  await refresh();if(dialog!==root||token!==dialogVersion||dialogOwner!==identity())return;
  root.querySelector('.community-dialog-body').innerHTML=(kind==='blocks'?'':friendsNav(kind))+`<div data-friends-content role="region" aria-live="polite">${panelRows(kind)}</div>`;
 }
 const requests=()=>openPanel('requests');

 function shareResults(){const items=showcaseChoices().map(showcaseItem).filter(i=>i.kind===shareKind&&(`${i.title} ${GAMES[i.game].name}`).toLowerCase().includes(shareQuery.toLowerCase()));return items.map(i=>itemTile(i,true,true)).join('')||'<p class="community-empty">No matching '+(shareKind==='binder'?'binders':'decks')+'. Create and edit them in Collection or Decks, then choose what to share here.</p>';}
 function chooseShare(kind='binder'){shareKind=kind==='deck'?'deck':'binder';shareQuery='';mount('Choose what friends see',`<p class="muted small">Choose an existing binder or deck, then preview before sharing. Public reference totals are shown for binders. Purchase costs and private notes stay private.</p><div class="community-picker-tabs" role="tablist" aria-label="Share type">${['binder','deck'].map(k=>`<button role="tab" aria-selected="${k===shareKind}" data-community-kind="${k}">${k==='binder'?'Binders':'Decks'}</button>`).join('')}</div><label class="field community-share-search">Search your binders or decks<input type="search" data-community-filter placeholder="Name or game…" autocomplete="off"></label><div class="community-share-choices" role="tabpanel">${shareResults()}</div>`);}
 function showItem(item,sharing=false){const clean=showcaseItem(item);if(!sharing&&openShared){void openShared(clean,dialog).catch(e=>toast(e.message));return;}mount(sharing?'Preview before sharing':clean.title,showcaseDetail(clean,{sharing}));viewedItem=clean;if(sharing)preview=clean;}
 async function saveCopy(button){if(working||!viewedItem||dialogOwner!==identity())return;const item=viewedItem,root=dialog,who=identity();working=true;button.disabled=true;message('Saving your copy…');try{await copyDeck(item);if(who===identity()&&dialog===root){close();toast('Saved to My decks. Your copy is ready to edit.');}}catch(e){if(dialog===root)message(e.message);}finally{working=false;if(button.isConnected)button.disabled=false;}}
 async function mutate(action,payload,button){if(working)return;const root=dialog,token=dialogVersion,who=identity();working=true;if(button)button.disabled=true;message('Saving…');try{await request(action,payload);if(who!==identity())return;if(flight)await flight;await refresh();if(dialog===root&&token===dialogVersion){const keep=panelKind||returnPanel?.kind;if(keep&&['accept','decline','remove','block','unblock'].includes(action))await openPanel(keep);else close();toast(({request:'Friend request sent.',accept:'Friend added.',decline:'Request removed.',remove:'Friend removed.',block:'Account blocked.',unblock:'Account unblocked.',share:'Shown on your profile.',unshare:'Hidden from your profile.'})[action]||'Saved.');}}catch(e){if(dialog===root)message(e.message);else toast(e.message);}finally{working=false;if(button?.isConnected)button.disabled=false;}}
 document.addEventListener('input',e=>{if(e.target.matches('[data-community-filter]')){shareQuery=e.target.value;dialog.querySelector('.community-share-choices').innerHTML=shareResults();}});
 document.addEventListener('submit',e=>{if(e.target.matches('[data-community-search]')){e.preventDefault();void search(e.target);}});
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b?.hasAttribute)return;
 if(b.hasAttribute('data-community-close')||b.hasAttribute('data-community-back'))return dismiss();
 if(b.dataset.communityPanel)return void openPanel(b.dataset.communityPanel);
 if(b.hasAttribute('data-community-signin'))return signIn();
 if(b.hasAttribute('data-community-add'))return add();
 if(b.hasAttribute('data-community-retry'))return void refresh();
 if(b.hasAttribute('data-community-edit'))return editProfile();
 if(b.hasAttribute('data-community-header'))return chooseArt('header');
 if(b.hasAttribute('data-community-avatar')){const p=currentPerson||currentProfile(),a=profileArt(p.avatar);return a?openArt(a):toast('Choose card artwork in Edit profile.');}
 if(b.hasAttribute('data-community-copy'))return void saveCopy(b);
 if(b.hasAttribute('data-community-card')&&viewedItem){const c=viewedItem.cards[Number(b.dataset.communityCard)];if(c?.image)return openArt({image:c.image,name:c.name});return;}
 if(b.dataset.communityChallenge&&challenge){const p=(data?.people||[]).find(x=>x.id===b.dataset.communityChallenge&&x.relationship==='accepted');if(p){close();challenge({...p,label:label(p)});}return;}
 if(b.dataset.communityPerson)return void showPerson(b.dataset.communityPerson);
 if(b.hasAttribute('data-community-requests'))return requests();
 if(b.hasAttribute('data-community-blocks'))return void openPanel('blocks');
 if(b.dataset.communityAction)return void mutate(b.dataset.communityAction,{target:b.dataset.target},b);
 if(b.hasAttribute('data-community-share'))return chooseShare(b.dataset.communityShare);
 if(b.dataset.communityKind){shareKind=b.dataset.communityKind;dialog.querySelectorAll('[data-community-kind]').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.communityKind===shareKind)));dialog.querySelector('.community-share-choices').innerHTML=shareResults();return;}
 if(b.dataset.communitySource){const item=showcaseChoices().find(i=>i.key===b.dataset.communitySource);if(item){close();editItem(item);}return;}
 if(b.dataset.communityPreview){const item=showcaseChoices().find(i=>i.key===b.dataset.communityPreview);if(item)return showItem(item,true);return toast('This saved item is no longer on this device.');}
 if(b.dataset.communityItem){const items=currentPerson?.items||data?.items||[],item=items.find(i=>i.key===b.dataset.communityItem);if(item)return showItem(item);}
 if(b.dataset.communityHide)return void mutate('unshare',{key:b.dataset.communityHide},b);
 if(b.hasAttribute('data-community-publish')&&preview)return void mutate('share',{item:preview},b);
 });
 window.addEventListener('popstate',close);
 return {page,refresh,reset,add,mine,close,requests,blocks:()=>openPanel('blocks'),friends:()=>openPanel('friends'),get data(){return data;}};
}
