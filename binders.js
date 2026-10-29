import {magicOwnedCard} from './magic-owned-detail.js';
import {artworkHTML,artworkSources} from './artwork.js';
// Visual binders are views of collection locations, never extra owned copies.
import { esc } from './ui.js';
import {finishAttrs,entryFinishContext} from './finish-preview.js';
export function binderGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = String(row.entry.location || '').trim();
    if (!groups.has(id)) groups.set(id,{id,title:id || 'Unsorted cards',rows:[],copies:0});
    const group=groups.get(id); group.rows.push(row); group.copies+=Number(row.entry.qty)||0;
  }
  return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title));
}
export function binderArtCard(row){
 const ownedMagic=row.owned&&(row.game==='mtg'||!row.game);
 const c=(ownedMagic?magicOwnedCard(row.entry,row.card):row.card) || {}, fallback=ownedMagic?'':row.image, variant=c.variants?.find(v=>v.key===row.entry?.variant);
 return {...c,image_uris:{...c.image_uris,normal:c.image_uris?.normal || ((row.game==='mtg'||!row.game)?fallback:'')},game:row.game,id:c.id || row.entry?.cardId || '',name:row.entry?.name || c.name || '',image:variant?.image || c.image || fallback || '',imageLarge:variant?.imageLarge || variant?.image || c.imageLarge || fallback || c.image || ''};
}
// Up to nine starred cards show through the clear cover, like the first page of a real binder.
export const MAX_FAVORITES = 9;
export const binderFavorites = (b) => [...new Set([...(Array.isArray(b?.favorites) ? b.favorites : []), ...(b?.featured && !(b?.favorites || []).length ? [b.featured] : [])])].slice(0, MAX_FAVORITES);
// Resolve saved cover references without changing stored selections. A card/printing
// ID or name is not a lot ID; only an exact lot or unique recorded stack origin
// can identify the surviving owned entry. Filtered/deleted/ambiguous refs stay saved.
export function binderCoverState(binder, rows = [], collectionRows = rows) {
  const saved = binderFavorites(binder), exact = new Set(rows.map(r => r.entry?.id)), origins = new Map();
  for (const {entry} of collectionRows) for (const origin of Array.isArray(entry?.stackOrigins) ? entry.stackOrigins : []) {
    if (!origin?.id || !entry?.id) continue;
    if (!origins.has(origin.id)) origins.set(origin.id, new Set());
    origins.get(origin.id).add(entry.id);
  }
  const owned = new Set(collectionRows.map(r => r.entry?.id));
  const resolve = id => owned.has(id) ? (exact.has(id) ? id : null) : origins.get(id)?.size === 1 && exact.has([...origins.get(id)][0]) ? [...origins.get(id)][0] : null;
  const favorites = [], unavailable = [], references = [];
  for (const id of saved) {
    const current = resolve(id);
    if (current !== null) { if (!favorites.includes(current)) favorites.push(current); }
    else unavailable.push(id);
    const reference = current ?? id;
    if (!references.includes(reference)) references.push(reference);
  }
  return {favorites, unavailable, references};
}
// Cover art: starred cards first, then the first cards with pictures to fill a 1 / 2×2 / 3×3 window.
export function coverImages(rows, favorites = [], collectionRows = rows) {
  favorites = binderCoverState({favorites}, rows, collectionRows).favorites;
  const byId = new Map(rows.map((r) => [r.entry?.id, r])),
    starred = favorites.map((id) => byId.get(id)).filter(r => r && artworkSources(binderArtCard(r),true).length),
    rest = rows.filter(r => artworkSources(binderArtCard(r),true).length && !favorites.includes(r.entry?.id)),
    want = starred.length > 4 ? 9 : starred.length > 1 ? 4 : starred.length === 1 ? 1 : 4,
    picked = [...starred, ...rest].slice(0, want);
  return picked.map((r) => ({ image: artworkSources(binderArtCard(r),true)[0], sources:artworkSources(binderArtCard(r),true), name: r.entry?.name || "", starred: favorites.includes(r.entry?.id) }));
}
export function binderCover({title,subtitle,game='mtg',images=[],image='',attrs='',hint='Open binder',color='',background=''}) {
  const art = images.length ? images : image ? [{ image, name: '' }] : [];
  const n = art.length > 4 ? 9 : art.length > 1 ? 4 : 1;
  return `<button class="stash-binder stash-${esc(game)}" ${color ? `style="--binder:${esc(color)}"` : ""} ${attrs}><span class="stash-book" aria-hidden="true"><span class="stash-pages"></span><span class="stash-cover clear">${background ? `<img class="stash-custom-background" src="${esc(background)}" alt="" loading="lazy" onerror="this.hidden=true">` : ""}<span class="stash-window w${n}">${art.length ? Array.from({length:n},(_,i)=>art[i]?`<span class="stash-slot${art[i].starred?' starred':''}"><img src="${esc(art[i].image)}" data-art-sources="${esc(JSON.stringify(art[i].sources || [art[i].image]))}" data-art-index="0" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`:`<span class="stash-slot empty"></span>`).join("") : `<span class="stash-slot empty only"><img src="icon.svg" alt=""></span>`}</span><span class="stash-spine"></span><span class="stash-sheen"></span><span class="stash-cover-title">${esc(title)}</span></span></span><span class="stash-binder-label"><b>${esc(title)}</b><small>${esc(subtitle)}</small><span class="stash-open-hint">${esc(hint)}</span></span></button>`;
}
export function binderShelf(rows,game,custom=[]) {
  const customs=customBinderGroups(rows,custom,game);
  return `<section class="binder-shelf"><div class="row between"><div><p class="eyebrow">YOUR CARD SHELF</p><h2>Your binders</h2></div><button class="btn small" data-act="newBinder" data-game="${esc(game)}">＋ New binder</button></div><p class="muted small">Name a binder, choose its cards, and customize its cover.</p>${customs.length?`<div class="stash-shelf">${customs.map(b=>{const {favorites:fav,unavailable}=binderCoverState(b,b.rows,rows);return binderCover({title:b.title,subtitle:`${b.copies} card${b.copies===1?"":"s"}${b.rows.length!==b.copies?` · ${b.rows.length} different`:""}${fav.length?` · ★\u00a0${fav.length} on cover`:""}${unavailable.length?` · ${unavailable.length} cover selection${unavailable.length===1?"":"s"} unavailable`:""}`,game,color:b.color,background:b.background || "",images:coverImages(b.rows,fav),attrs:`data-act="openBinder" data-game="${esc(game)}" data-binder="${esc(b.id)}"`});}).join("")}</div>`:`<div class="binder-empty-state"><h3>No binders yet</h3><p class="muted small">Your cards stay in your collection until you create a binder. Nothing is added automatically.</p><button class="btn ghost" data-act="newBinder" data-game="${esc(game)}">Create your first binder</button></div>`}</section>`;
}
// Owned cards in a binder show their own finish: the foil, holo or rarity they were saved as. Magic
// cards foil only once their exact printing is known.
const pocketFinish=row=>{const g=row.game||'mtg',e=row.entry||{};if(!row.owned||(g==='mtg'&&!e.printingVerified))return '';try{return finishAttrs(g,binderArtCard(row),entryFinishContext(g,e),'card');}catch{return '';}};
export function binderPage(rows,title,page=0,direction='next',binder=null,{readOnly=false,cardAttrs=null,collectionRows=rows}={}) {
  const pages=Math.max(1,Math.ceil(rows.length/9)), at=Math.max(0,Math.min(pages-1,Number(page)||0)), shown=rows.slice(at*9,at*9+9), {favorites:fav,unavailable}=binderCoverState(binder,rows,collectionRows);
  const pocket=row=>{const on=fav.includes(row.entry.id);return `<div class="stash-pocket${on?" starred":""}"><button class="pocket-open" ${cardAttrs?cardAttrs(row):`data-entry="${esc(row.entry.id)}" data-act="${row.game==='mtg'?'card':'tCard'}" ${row.game==='mtg'?`data-name="${esc(row.entry.name)}"`:`data-id="${esc(row.entry.cardId)}"`}`} aria-label="${esc(row.entry.name)}, ${row.entry.qty} copies"><span class="pocket-image" ${pocketFinish(row)}>${artworkHTML(binderArtCard(row),"binder-card-art",true)}<span class="pocket-glint"></span></span><span class="pocket-caption"><b>${esc(row.entry.name)}</b><small>${esc(row.version || '')}</small></span><span class="pocket-qty">×${row.entry.qty}</span></button>${binder&&!readOnly?`<button class="pocket-star ${on?"on":""}" data-act="featureBinderCard" data-entry="${esc(row.entry.id)}" aria-label="${on?"Remove":"Show"} ${esc(row.entry.name)} ${on?"from":"on"} the binder cover" aria-pressed="${on}">★</button>`:""}</div>`;};
  // The pages either side sit underneath, so dragging a page reveals the real next/previous page.
  const under=(dir)=>{const p=at+dir;if(p<0||p>=pages)return "";const list=rows.slice(p*9,p*9+9);return `<div class="stash-under" data-under="${dir}" aria-hidden="true" hidden>${Array.from({length:9},(_,i)=>list[i]?`<span class="stash-pocket under-pocket"><span class="pocket-image">${artworkHTML(binderArtCard(list[i]),"binder-card-art",true)}</span></span>`:`<span class="stash-pocket empty-pocket"></span>`).join("")}</div>`;};
  const dots=pages>1&&pages<=12?`<span class="stash-dots" aria-hidden="true">${Array.from({length:pages},(_,i)=>`<i class="${i===at?"on":""}"></i>`).join("")}</span>`:"";
  return `<div class="sheet-head"><div><p class="eyebrow">CARDSTASHY BINDER</p><h2>${esc(title)}</h2></div><button class="icon" data-act="closeSheet" aria-label="Close binder">✕</button></div><div class="stash-page-tools">${binder&&!readOnly?`<button class="btn ghost small" data-act="editBinder" data-binder="${esc(binder.id)}">Binder options</button>`:"<span></span>"}<span class="stash-page-count">${rows.length} card${rows.length===1?"":"s"} · page ${at+1} of ${pages}${binder&&!readOnly?` · ★ ${fav.length}/${MAX_FAVORITES} on cover`:""}</span></div>${binder&&!readOnly&&unavailable.length?`<div class="binder-cover-notice" role="status"><p class="foot">${unavailable.length} saved cover selection${unavailable.length===1?" is":"s are"} unavailable in this binder. Kept saved, using ${unavailable.length} of ${MAX_FAVORITES} cover slots.</p><button class="btn ghost small" data-act="clearUnavailableBinderFavorites" data-binder="${esc(binder.id)}">Remove unavailable cover selections</button><p class="foot">Only these cover selections are removed. Your cards stay in the collection.</p></div>`:""}<section ${binder?.color?`style="--binder:${esc(binder.color)}"`:""} class="stash-open-book" aria-label="Binder page ${at+1} of ${pages}"><div class="stash-rings" aria-hidden="true"><i></i><i></i><i></i></div>${under(1)}${under(-1)}<div class="stash-pocket-page" data-direction="${esc(direction)}">${Array.from({length:9},(_,i)=>shown[i]?pocket(shown[i]):`<div class="stash-pocket empty-pocket" aria-label="Empty pocket"><span aria-hidden="true">◇</span></div>`).join('')}<button class="binder-page-edge previous" data-page-edge="-1" ${at===0?'disabled':''} aria-label="Turn to the previous page"></button><button class="binder-page-edge next" data-page-edge="1" ${at===pages-1?'disabled':''} aria-label="Turn to the next page"><span class="page-curl" aria-hidden="true"></span></button></div></section><div class="stash-turn-bar"><button class="btn ghost" data-act="binderPage" data-page="${at-1}" ${at===0?'disabled':''} aria-label="Previous binder page">‹ Back</button>${dots}<button class="btn ghost" data-act="binderPage" data-page="${at+1}" ${at===pages-1?'disabled':''} aria-label="Next binder page">Next ›</button></div>${!rows.length?'<p class="muted center">No cards here yet. Add cards to your collection to fill these pockets.</p>':''}${binder?.rule==='set'&&!readOnly?`<button class="btn ghost small" data-act="go" data-to="#set/${encodeURIComponent(binder.value)}">View set checklist & missing cards →</button>`:""}<p class="foot">Swipe the page (or use ← →) to turn it. ${binder&&!readOnly?`Star up to ${MAX_FAVORITES} cards to show them through the cover. `:""}Each pocket is one collection entry; tap a card for details.</p>`;
}
export const BINDER_COLORS=['#805b24','#176b69','#634198','#942f4c','#285ba4','#36794c','#b1652d','#586778'];
export function binderMatches(row,binder) {
  const c=row.card || {}, e=row.entry, value=String(binder.value || '').toLowerCase().trim();
  switch(binder.rule) {
    case 'set': return [row.game==='ygo' ? e.printing?.split('-')[0] : e.set || c.set?.id || (typeof c.set==='string'?c.set:'')].some(x=>String(x || '').toLowerCase()===value);
    case 'rare': return /rare|mythic|ultra|secret|legend|special illustration/i.test(c.rarity || e.rarity || '');
    case 'rarity': return String(c.rarity || e.rarity || '').toLowerCase()===value;
    case 'type': return String(c.type_line || c.typeLine || c.category || '').toLowerCase().includes(value) && !!value;
    case 'color': return [...(c.types || []),...(c.color_identity || []),c.attribute || ''].some(x=>String(x).toLowerCase()===value);
    case 'location': return String(e.location || '').trim().toLowerCase()===value;
    default: return true;
  }
}
export function customBinderGroups(rows,binders,game) {
  return (Array.isArray(binders)?binders:[]).filter(b=>b && b.game===game).map(b=>{const matched=rows.filter(r=>binderMatches(r,b));return {...b,rows:matched,copies:matched.reduce((a,r)=>a+(Number(r.entry.qty)||0),0)};});
}
const prefersReduced = (view) => !!view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The page turn: forward, the old page swings over the rings and away; back, the previous page
// swings in from the rings onto the stack. Called right after the new page is rendered.
export function animateTurn(root, oldPage, dir, { dragged = false } = {}) {
  const book = root?.querySelector?.('.stash-open-book'), page = book?.querySelector('.stash-pocket-page');
  if (!book || !page || !page.animate) return;
  const view = root.ownerDocument?.defaultView;
  if (prefersReduced(view)) { page.animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' }); return; }
  if (dragged) { page.animate([{ opacity: .35, filter: 'brightness(.6)' }, { opacity: 1, filter: 'none' }], { duration: 260, easing: 'ease-out' }); return; }
  if (!oldPage) return;
  const leaf = oldPage.cloneNode(true);
  leaf.classList.add('stash-leaf');
  leaf.querySelectorAll('button').forEach((b) => (b.tabIndex = -1));
  leaf.setAttribute('aria-hidden', 'true');
  Object.assign(leaf.style, { position: 'absolute', left: page.offsetLeft + 'px', top: page.offsetTop + 'px', width: page.offsetWidth + 'px', height: page.offsetHeight + 'px', margin: '0', animation: 'none' });
  const shade = (el, from, to) => { const s = el.ownerDocument.createElement('span'); s.className = 'stash-turn-shade'; el.append(s); s.animate([{ opacity: from }, { opacity: to }], { duration: 560, easing: 'ease-in-out', fill: 'forwards' }); return s; };
  if (dir > 0) {
    // Old page on top, lifting from the right edge and folding over the rings.
    leaf.style.zIndex = '5'; leaf.style.transformOrigin = 'left center';
    book.append(leaf);
    shade(page, .55, 0);
    shade(leaf, 0, .5);
    leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-35deg) skewY(-2deg)', offset: .3 }, { transform: 'rotateY(-180deg)' }], { duration: 560, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'forwards' }).finished.then(() => leaf.remove(), () => leaf.remove());
  } else {
    // Old page stays underneath; the previous page swings back in from the rings.
    leaf.style.zIndex = '0'; book.append(leaf);
    page.style.zIndex = '5'; page.style.transformOrigin = 'left center';
    shade(leaf, 0, .55);
    page.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(-145deg) skewY(2deg)', offset: .3 }, { transform: 'rotateY(0deg)' }], { duration: 560, easing: 'cubic-bezier(.3,.1,.2,1)' }).finished.then(() => { leaf.remove(); page.style.zIndex = ''; }, () => leaf.remove());
  }
}

// Swipe anywhere on the page to turn it: the page follows your finger, past a third (or a flick)
// it turns, otherwise it settles back. Taps still open cards; the edges and ← → keys turn too.
export function attachBinderDrag(root,onTurn) {
  const page=root.querySelector('.stash-pocket-page'); if (!page) return ()=>{};
  let drag=null,timer=null,disposed=false,swallowUntil=0;
  const view=root.ownerDocument?.defaultView || window, reduced=prefersReduced(view);
  const can=dir=>{const edge=root.querySelector(`[data-page-edge="${dir}"]`);return !!edge && !edge.disabled;};
  const reset=()=>{page.style.transition='transform 220ms ease, opacity 220ms ease';page.style.transform='rotateY(0deg)';page.style.opacity='1';page.style.setProperty?.('--turn','0');setTimeout(()=>{page.classList?.remove('turning');root.querySelectorAll?.('.stash-under').forEach(u=>{u.hidden=true;});},230);};
  const down=e=>{
    if(drag || disposed || timer || (e.button!==undefined && e.button!==0)) return;
    if(!e.target.closest?.('.stash-pocket-page,[data-page-edge]')) return;
    if(e.target.closest?.('.pocket-star')) return;
    const edge=e.target.closest?.('[data-page-edge]');
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:Date.now(),dir:edge?Number(edge.dataset.pageEdge):0,edge:!!edge,width:Math.max(1,page.getBoundingClientRect().width),progress:0,moved:0,live:false};
    if(edge){edge.setPointerCapture?.(e.pointerId);e.preventDefault();}
  };
  const move=e=>{
    if(!drag || e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x, dy=(e.clientY??drag.y)-drag.y;
    drag.moved=Math.max(drag.moved,Math.abs(dx));
    if(!drag.live){
      // Only a sideways swipe turns pages; vertical movement scrolls the sheet.
      if(Math.abs(dx)<10 || Math.abs(dx)<Math.abs(dy)){ if(Math.abs(dy)>12 && !drag.edge) drag=null; return; }
      if(!drag.dir) drag.dir=dx<0?1:-1;
      drag.live=true;
      page.style.animation='none';page.style.transition='none';page.style.transformOrigin=drag.dir===1?'left center':'right center';
      const u=root.querySelector(`.stash-under[data-under="${drag.dir}"]`);
      drag.under=u && u!==page && u.classList?.contains?.('stash-under') ? u : null;
      if(drag.under && can(drag.dir)) drag.under.hidden=false;
      page.classList?.add('turning');
    }
    const allowed=can(drag.dir), distance=-dx*drag.dir;
    // Rubber band at the first and last page.
    drag.progress=allowed?Math.max(0,Math.min(.96,distance/drag.width)):Math.max(0,Math.min(.08,distance/drag.width/6));
    page.style.transform=reduced?`translateX(${-drag.dir*drag.progress*40}px)`:`rotateY(${-drag.dir*drag.progress*170}deg)`;
    page.style.opacity=reduced?String(1-drag.progress*.6):'1';
    // The lifted page darkens as it curls; the page underneath brightens as it's uncovered.
    page.style.setProperty?.('--turn',String(drag.progress));
    drag.under?.style?.setProperty?.('--reveal',String(Math.min(1,drag.progress*1.6)));
    e.preventDefault?.();
  };
  const up=e=>{
    if(!drag || e.pointerId!==drag.id)return;
    const d=drag;drag=null;
    const elapsed=Math.max(1,Date.now()-d.start), tap=d.moved<6&&elapsed<450, flick=d.progress*d.width/elapsed>.45&&d.progress*d.width>30;
    // Only a real lift is followed by a click; a cancelled swipe (a system gesture, folding) never gets one,
    // so it must not leave the next tap swallowed. The window is short either way.
    if(d.live && e.type!=='pointercancel') swallowUntil=Date.now()+400;
    if(!d.live && !(d.edge && tap)) return;
    const dir=d.dir;
    if(e.type==='pointercancel' || !can(dir) || !(d.edge&&tap || d.progress>.3 || flick)) return reset();
    if(d.edge && tap && !d.live) return onTurn(dir);
    if(reduced){page.style.transition='none';page.style.transform='none';onTurn(dir,{dragged:true});return;}
    page.style.transition='transform 200ms ease-in, opacity 200ms ease-in';page.style.transform=`rotateY(${-dir*178}deg)`;page.style.opacity='.1';
    timer=setTimeout(()=>{timer=null;if(!disposed&&root.isConnected!==false)onTurn(dir,{dragged:true});},200);
  };
  // After a swipe, the click that follows must not open the card under the finger.
  const click=e=>{
    if(Date.now()<swallowUntil){swallowUntil=0;e.preventDefault?.();e.stopPropagation?.();return;}
    const edge=e.target.closest?.('[data-page-edge]');if(edge&&!edge.disabled&&e.detail===0&&!drag&&!timer)onTurn(Number(edge.dataset.pageEdge));
  };
  const key=e=>{
    if(drag||timer||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName||''))return;
    const dir=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
    if(dir&&can(dir)){e.preventDefault?.();onTurn(dir);}
  };
  root.addEventListener('pointerdown',down);root.addEventListener('click',click,true);view.addEventListener('pointermove',move,{passive:false});view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);view.addEventListener('keydown',key);
  return ()=>{disposed=true;clearTimeout(timer);drag=null;root.removeEventListener('pointerdown',down);root.removeEventListener('click',click,true);view.removeEventListener('pointermove',move);view.removeEventListener('pointerup',up);view.removeEventListener('pointercancel',up);view.removeEventListener('keydown',key);};
}
