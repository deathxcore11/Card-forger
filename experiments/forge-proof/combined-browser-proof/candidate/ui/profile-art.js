import {actionIcon} from './icons.js';
import {esc,cardImage} from './ui.js';
import {GAMES,GAME_IDS} from './games.js';
import {artworkSources} from './artwork.js';

const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const number=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const localImage=value=>/^img\/(?:ygo\/(?:s\/)?\d{1,12}\.jpg|ptcg\/[ls]\/[a-zA-Z0-9.!_%~-]+\.jpg(?:\?v=2)?)$/.test(value);
const imageSource=value=>{
 if(typeof value!=='string')return '';
 if(localImage(value))return value;
 try{const url=new URL(value);if(url.origin===globalThis.location?.origin&&localImage(url.pathname.slice(1)+url.search))return url.pathname.slice(1)+url.search;}catch{}
 return https(value);
};
export function profileCrop(value={}){
 const ratio=clamp(number(value.ratio,1),.2,5),zoom=clamp(number(value.zoom,1),1,4);
 const width=Math.max(1,ratio)*zoom,height=Math.max(1,1/ratio)*zoom;
 return {ratio,zoom,x:clamp(number(value.x,.5),.5/width,1-.5/width),y:clamp(number(value.y,.5),.5/height,1-.5/height),width,height};
}
export function profileArt(value){
 if(!value||!GAME_IDS.includes(value.game)||!value.cardId||!imageSource(value.image))return null;
 const {ratio,zoom,x,y}=profileCrop(value);
 return {game:value.game,cardId:String(value.cardId).slice(0,100),name:String(value.name||'Card artwork').slice(0,200),image:imageSource(value.image),ratio,zoom,x,y};
}
const cropStyle=value=>{const c=profileCrop(value);return `width:${c.width*100}%;height:${c.height*100}%;left:${50-c.x*c.width*100}%;top:${50-c.y*c.height*100}%`;};
const person='<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="20" cy="14" r="6"/><path d="M8 33c0-8 5-12 12-12s12 4 12 12"/></svg>';
export function profileAvatar(value,profile={}){
 const art=profileArt(value),photo=https(profile.avatar_url),initial=String(profile.username||profile.display_name||'').trim().slice(0,1).toUpperCase();
 return `<span class="profile-avatar" aria-hidden="true">${initial?`<span>${esc(initial)}</span>`:person}${art?`<img src="${esc(art.image)}" style="${cropStyle(art)}" alt="" referrerpolicy="no-referrer" onerror="this.hidden=true">`:photo?`<img class="profile-avatar-photo" src="${esc(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.hidden=true">`:''}</span>`;
}
export function profilePhotoControl(value,profile={}, {editAvatar=false}={}){
 return `<div class="profile-photo-row"><button class="profile-photo-source" data-act="${editAvatar?'profilePhoto':'profileSource'}" aria-label="${editAvatar?'Change profile picture':'View profile artwork'}">${profileAvatar(value,profile)}</button><button class="profile-photo-control" data-act="profilePhoto"><span><b>Change profile picture</b><small>${esc(profileArt(value)?.name||'Choose card art from any game')}</small></span><span aria-hidden="true">${actionIcon("brush")}</span></button></div>`;
}

// Store the chosen source and crop, not a large image blob or a cross-origin canvas.
// This uses the existing workspace save/sync path and never adds a card to inventory.
export function createProfileArtPicker({lookup,read,save,currentGame=()=> 'mtg',onSaved=()=>{},purpose='avatar'}){
 let dialog=null,opener=null,game='mtg',rows=[],draft=null,sequence=0,timer,ready=false,saving=false;
 const close=(force=false)=>{if(saving&&!force)return;clearTimeout(timer);sequence++;dialog?.close();dialog?.remove();dialog=null;saving=false;draft=null;rows=[];opener?.isConnected&&opener.focus({preventScroll:true});};
 const heading=()=>'<header class="profile-picker-head"><div><p class="eyebrow">MAKE IT YOURS</p><h2 id="profileArtTitle">'+(purpose==='header'?'Profile header':'Profile photo')+'</h2></div><button type="button" class="icon" data-avatar-close aria-label="Close profile photo picker">✕</button></header>';
 const results=(cards,status)=>{if(!dialog)return;rows=cards;dialog.querySelector('[data-avatar-results]').innerHTML=`<p class="muted small" role="status">${esc(status)}</p><div class="profile-art-results">${cards.map((c,i)=>{const src=artworkSources({...c,game},false)[0]||cardImage(c);return `<button type="button" data-avatar-pick="${i}">${src?`<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:person}<span><b>${esc(c.name)}</b><small>${esc(game==='mtg'?c.set_name||c.set||'Magic':c.set?.name||GAMES[game].short)}</small></span></button>`;}).join('')}</div>`;};
 const search=async()=>{const q=dialog?.querySelector('[data-avatar-query]')?.value.trim(),token=++sequence,g=game;if(!q||q.length<2)return results([],'Type at least two letters to find a card.');results([],'Finding card art…');try{const found=await lookup(g,q);if(!dialog||token!==sequence||game!==g||!dialog.querySelector('[data-avatar-results]'))return;results(found.cards||[],found.cards?.length?'Choose a card to frame your photo.':found.error?'The card source is unavailable. Try again.':'No cards found. Try another name.');}catch{if(dialog&&token===sequence)results([],'The card source is unavailable. Try again.');}};
 const showSearch=()=>{sequence++;draft=null;ready=false;dialog.innerHTML=heading()+`<p class="muted">Your favorite card, your own framing.</p><form class="profile-art-search"><label>Card game<select data-avatar-game>${GAME_IDS.map(g=>`<option value="${g}" ${g===game?'selected':''}>${esc(GAMES[g].name)}</option>`).join('')}</select></label><label>Card name<input data-avatar-query type="search" maxlength="100" placeholder="Search for a card…" autocomplete="off"></label><button class="btn" type="submit">Search</button></form><div data-avatar-results></div>`;results([],'Search Magic, Pokémon, or Yu-Gi-Oh! without leaving your game.');dialog.querySelector('[data-avatar-query]').focus();};
 const draw=()=>{if(!draft||!dialog)return;Object.assign(draft,profileCrop(draft));for(const img of dialog.querySelectorAll('[data-avatar-image]'))img.setAttribute('style',cropStyle(draft));const slider=dialog.querySelector('[data-avatar-zoom]');if(slider)slider.value=draft.zoom;};
 const crop=(card,saved=null,selectedImage='')=>{
  sequence++;clearTimeout(timer);ready=false;
  const sources=[...new Set((saved?.image?[saved.image]:selectedImage?[selectedImage]:[...artworkSources({...card,game},true),cardImage(card)]).map(imageSource).filter(Boolean))];
  const image=sources[0];
  draft=profileArt(saved||{game,cardId:card.id,name:card.name,image,x:.5,y:.4,zoom:1,ratio:1});
  if(!draft)return showSearch();
  if(purpose==='header'){
   dialog.innerHTML=heading()+`<button class="link" data-avatar-back type="button">← Choose another card</button><h3>${esc(draft.name)}</h3><p class="muted small">A wide artwork header. Your avatar stays as it is.</p><div class="profile-header-preview"><img src="${esc(image)}" alt="Profile header preview" referrerpolicy="no-referrer"></div><div class="profile-crop-footer"><button class="btn" data-avatar-save disabled>Save header</button></div><p role="status" data-avatar-status>Loading artwork…</p>`;
   const img=dialog.querySelector('.profile-header-preview img');img.onload=()=>{if(!dialog?.contains(img))return;draft.ratio=img.naturalWidth/img.naturalHeight;ready=true;dialog.querySelector('[data-avatar-save]').disabled=false;dialog.querySelector('[data-avatar-status]').textContent='';};
   img.onerror=()=>{if(dialog?.contains(img))dialog.querySelector('[data-avatar-status]').textContent='Artwork could not load. Choose another card.';};if(img.complete&&img.naturalWidth)img.onload();return;
  }
  dialog.innerHTML=heading()+`<button class="link" data-avatar-back type="button">← Choose another card</button><h3 class="profile-art-name">${esc(draft.name)}</h3><p class="muted small" id="profileCropHelp">Drag the artwork inside the circle. Pinch or use the slider to zoom. Arrow keys also move the artwork.</p><div class="profile-crop-stage"><div class="profile-crop" data-avatar-crop tabindex="0" role="img" aria-label="Move profile artwork" aria-describedby="profileCropHelp"><img data-avatar-image src="${esc(image)}" alt="" draggable="false" referrerpolicy="no-referrer"></div></div><label class="profile-zoom">Zoom<input data-avatar-zoom type="range" min="1" max="4" step="0.01" value="${draft.zoom}"></label><div class="profile-crop-footer"><span class="profile-avatar profile-avatar-preview"><img data-avatar-image src="${esc(image)}" alt="Profile photo preview" referrerpolicy="no-referrer"></span><span class="small muted">Your profile preview</span><button type="button" class="btn" data-avatar-save disabled>Save photo</button></div><p class="small muted" role="status" data-avatar-status>Loading artwork…</p>`;
  const img=dialog.querySelector('[data-avatar-crop] img');
  img.onload=()=>{if(!dialog||img!==dialog.querySelector('[data-avatar-crop] img'))return;draft.ratio=img.naturalWidth/img.naturalHeight;ready=true;draw();dialog.querySelector('[data-avatar-save]').disabled=false;dialog.querySelector('[data-avatar-status]').textContent='';};
  img.onerror=()=>{if(dialog?.contains(img)){ready=false;dialog.querySelector('[data-avatar-save]').disabled=true;const next=sources[sources.indexOf(draft.image)+1];if(next){draft.image=next;for(const preview of dialog.querySelectorAll('[data-avatar-image]'))preview.src=next;}else dialog.querySelector('[data-avatar-status]').textContent='This artwork could not load. Choose another card or try again.';}};
  draw();if(img.complete&&img.naturalWidth)img.onload();
  const circle=dialog.querySelector('[data-avatar-crop]'),points=new Map();let gesture=null;
  const begin=()=>{const p=[...points.values()],c=profileCrop(draft);gesture=p.length?{x:p.reduce((s,p)=>s+p.x,0)/p.length,y:p.reduce((s,p)=>s+p.y,0)/p.length,d:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0,c}:null;};
  circle.addEventListener('pointerdown',e=>{if(!ready||saving||e.button>0||points.size>=2)return;circle.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});begin();circle.focus({preventScroll:true});e.preventDefault();});
  circle.addEventListener('pointermove',e=>{if(!gesture||!points.has(e.pointerId)||saving)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...points.values()],r=circle.getBoundingClientRect(),mx=p.reduce((s,p)=>s+p.x,0)/p.length,my=p.reduce((s,p)=>s+p.y,0)/p.length;
   draft.zoom=gesture.d?clamp(gesture.c.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/gesture.d,1,4):gesture.c.zoom;
   const next=profileCrop(draft);draft.x=gesture.c.x+(gesture.x-r.left-r.width/2)/(r.width*gesture.c.width)-(mx-r.left-r.width/2)/(r.width*next.width);draft.y=gesture.c.y+(gesture.y-r.top-r.height/2)/(r.height*gesture.c.height)-(my-r.top-r.height/2)/(r.height*next.height);draw();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])circle.addEventListener(type,e=>{points.delete(e.pointerId);begin();});
  circle.addEventListener('keydown',e=>{if(!ready||saving||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const c=profileCrop(draft),step=e.shiftKey ? .08 : .02;draft.x+=({ArrowLeft:step,ArrowRight:-step}[e.key]||0)/c.width;draft.y+=({ArrowUp:step,ArrowDown:-step}[e.key]||0)/c.height;draw();});
 };
 const open=({card,game:selectedGame,image}={})=>{if(dialog)return;opener=document.activeElement;game=GAME_IDS.includes(selectedGame)?selectedGame:currentGame();dialog=document.createElement('dialog');dialog.className='profile-art-dialog';dialog.setAttribute('aria-labelledby','profileArtTitle');document.body.append(dialog);dialog.showModal();
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);search();});
  dialog.addEventListener('input',e=>{if(saving)return;if(e.target.matches('[data-avatar-query]')){clearTimeout(timer);sequence++;timer=setTimeout(search,250);}if(e.target.matches('[data-avatar-zoom]')&&draft){draft.zoom=Number(e.target.value);draw();}});
  dialog.addEventListener('change',e=>{if(e.target.matches('[data-avatar-game]')){game=e.target.value;clearTimeout(timer);search();}});
  dialog.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||saving)return;if(b.hasAttribute('data-avatar-close'))return close();if(b.hasAttribute('data-avatar-back'))return showSearch();if(b.hasAttribute('data-avatar-pick'))return crop(rows[Number(b.dataset.avatarPick)]);if(b.hasAttribute('data-avatar-save')&&ready){const root=dialog,token=sequence;saving=true;b.disabled=true;dialog.querySelector('[data-avatar-status]').textContent='Saving photo…';try{await save(profileArt(draft));if(dialog!==root||token!==sequence)return;saving=false;onSaved();close();}catch{if(dialog!==root||token!==sequence)return;saving=false;b.disabled=false;dialog.querySelector('[data-avatar-status]').textContent='Couldn’t save your photo. Try again.';}}});
  const saved=profileArt(read());if(card)crop(card,null,image);else if(saved){game=saved.game;crop(null,saved);}else showSearch();
 };
 window.addEventListener('popstate',()=>close());
 return {open,close};
}
