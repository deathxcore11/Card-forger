// Visual binders are views of collection locations, never extra owned copies.
import { esc } from './ui.js';
export function binderGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = String(row.entry.location || '').trim();
    if (!groups.has(id)) groups.set(id,{id,title:id || 'Unsorted cards',rows:[],copies:0});
    const group=groups.get(id); group.rows.push(row); group.copies+=Number(row.entry.qty)||0;
  }
  return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title));
}
export function binderCover({title,subtitle,game='mtg',image='',attrs='',hint='Open binder ↗',color='',background=''}) {
  return `<button class="stash-binder stash-${esc(game)}" ${color ? `style="--binder:${esc(color)};--binder-light:#ddd2fa"` : ""} ${attrs}><span class="stash-book" aria-hidden="true"><span class="stash-pages"><i></i><i></i><i></i></span><span class="stash-cover">${background ? `<img class="stash-custom-background" src="${esc(background)}" alt="" loading="lazy" onerror="this.hidden=true">` : ""}<span class="stash-spine"></span><span class="stash-foil"></span><span class="stash-emblem">${image ? `<img src="${esc(image)}" alt="" loading="lazy" onerror="this.hidden=true">` : '<img src="icon.svg" alt="">'}</span><span class="stash-cover-title">${esc(title)}</span><span class="stash-cover-brand">CARDSTASHY</span></span></span><span class="stash-binder-label"><b>${esc(title)}</b><small>${esc(subtitle)}</small><span class="stash-open-hint">${esc(hint)}</span></span></button>`;
}
export function binderShelf(rows,game,custom=[]) {
  const groups=binderGroups(rows), customs=customBinderGroups(rows,custom,game);
  return `<section class="binder-shelf"><div class="row between"><div><p class="eyebrow">YOUR CARD SHELF</p><h2>Your binders</h2></div><button class="btn small" data-act="newBinder" data-game="${esc(game)}">＋ New binder</button></div><p class="muted small">Create a filtered binder or browse your collection locations.</p><div class="stash-shelf">${customs.map(b=>binderCover({title:b.title,subtitle:`${b.copies} copies · ${b.rows.length} entries`,game,color:b.color,background:b.background || "",image:b.rows.find(r=>r.entry.id===b.featured)?.image || b.rows.find(r=>r.image)?.image || "",attrs:`data-act="openBinder" data-game="${esc(game)}" data-binder="${esc(b.id)}"`})).join("")}${(groups.length?groups:[{id:'',title:'Your first binder',rows:[],copies:0}]).map(group=>binderCover({title:group.title,subtitle:`${group.copies} copies · ${group.rows.length} entries`,game,image:group.rows.find(r=>r.image)?.image || '',attrs:`data-act="openBinder" data-game="${esc(game)}" data-location="${esc(group.id)}"`})).join('')}</div></section>`;
}
export function binderPage(rows,title,page=0,direction='next',binder=null) {
  const pages=Math.max(1,Math.ceil(rows.length/9)), at=Math.max(0,Math.min(pages-1,Number(page)||0)), shown=rows.slice(at*9,at*9+9);
  return `<div class="sheet-head"><div><p class="eyebrow">CARDSTASHY BINDER</p><h2>${esc(title)}</h2></div><button class="icon" data-act="closeSheet" aria-label="Close binder">✕</button></div><div class="stash-page-tools">${binder?`<button class="btn ghost small" data-act="editBinder" data-binder="${esc(binder.id)}">Customize</button>`:""}<span>${rows.length} entries · page ${at+1} of ${pages}</span><span class="row"><button class="btn ghost small" data-act="binderPage" data-page="${at-1}" ${at===0?'disabled':''} aria-label="Previous binder page">←</button><button class="btn ghost small" data-act="binderPage" data-page="${at+1}" ${at===pages-1?'disabled':''} aria-label="Next binder page">→</button></span></div><section ${binder?.color?`style="border-color:${esc(binder.color)}"`:""} class="stash-open-book" aria-label="Binder page ${at+1}"><div class="stash-rings" aria-hidden="true"><i></i><i></i><i></i></div><div class="stash-pocket-page" data-direction="${esc(direction)}">${Array.from({length:9},(_,i)=>{const row=shown[i]; return row ? `<div class="stash-pocket"><button class="pocket-open" data-act="${row.game==='mtg'?'card':'tCard'}" ${row.game==='mtg'?`data-name="${esc(row.entry.name)}"`:`data-id="${esc(row.entry.cardId)}"`} aria-label="${esc(row.entry.name)}, ${row.entry.qty} copies"><span class="pocket-image">${row.image?`<img src="${esc(row.image)}" alt="${esc(row.entry.name)}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('missing')">`:''}<span class="pocket-placeholder">Image unavailable</span><span class="pocket-glint"></span></span><span class="pocket-caption"><b>${esc(row.entry.name)}</b><small>${esc(row.version || '')}</small></span><span class="pocket-qty">×${row.entry.qty}</span></button>${binder?`<button class="pocket-star ${binder.featured===row.entry.id?"on":""}" data-act="featureBinderCard" data-entry="${esc(row.entry.id)}" aria-label="Feature ${esc(row.entry.name)} on binder cover" aria-pressed="${binder.featured===row.entry.id}">★</button>`:""}</div>`:`<div class="stash-pocket empty-pocket" aria-label="Empty pocket"><span aria-hidden="true">◇</span></div>`;}).join('')}<button class="binder-page-edge previous" data-page-edge="-1" ${at===0?'disabled':''} aria-label="Drag left page edge, or press Enter, to turn back"></button><button class="binder-page-edge next" data-page-edge="1" ${at===pages-1?'disabled':''} aria-label="Drag right page edge, or press Enter, to turn forward"></button></div></section>${!rows.length?'<p class="muted center">No cards here yet. Add cards to your collection to fill these pockets.</p>':''}${binder?.rule==='set'?`<button class="btn ghost small" data-act="go" data-to="#set/${encodeURIComponent(binder.value)}">View set checklist & missing cards →</button>`:""}<p class="foot">Drag a page edge to turn it. ${binder?"Star a card to put it on this binder’s cover. ":""}Each pocket represents a collection entry. Tap a card for details; quantity badges show copies owned.</p>`;
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
// Edge dragging uses continuous progress, not repeated click animations.
export function attachBinderDrag(root,onTurn) {
  const page=root.querySelector('.stash-pocket-page'); if (!page) return ()=>{};
  let drag=null,timer=null,disposed=false;
  const view=root.ownerDocument?.defaultView || window, reduced=!!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const reset=()=>{page.style.transition='transform 180ms ease, opacity 180ms ease';page.style.transform='rotateY(0deg)';page.style.opacity='1';};
  const down=e=>{
    const edge=e.target.closest?.('[data-page-edge]'); if(!edge || edge.disabled || drag || disposed || timer) return;
    const dir=Number(edge.dataset.pageEdge);
    drag={id:e.pointerId,x:e.clientX,start:Date.now(),dir,width:Math.max(1,page.getBoundingClientRect().width),progress:0,moved:0};
    page.style.animation='none';page.style.transition='none';page.style.transformOrigin=dir===1?'left center':'right center';
    edge.setPointerCapture?.(e.pointerId);e.preventDefault();
  };
  const move=e=>{if(!drag || e.pointerId!==drag.id)return;const distance=(drag.x-e.clientX)*drag.dir;drag.moved=Math.abs(e.clientX-drag.x);drag.progress=Math.max(0,Math.min(.96,distance/drag.width));page.style.transform=reduced?'none':`rotateY(${-drag.dir*drag.progress*170}deg)`;page.style.opacity=reduced?'1':String(1-drag.progress*.45);e.preventDefault();};
  const up=e=>{if(!drag || e.pointerId!==drag.id)return;const d=drag;drag=null;const elapsed=Math.max(1,Date.now()-d.start), tap=d.moved<6&&elapsed<450, flick=d.progress*d.width/elapsed>.45&&d.progress*d.width>30;
    if(e.type!=='pointercancel'&&(tap||d.progress>.22||flick)) {if(reduced){onTurn(d.dir);return;}page.style.transition='transform 180ms ease, opacity 180ms ease';page.style.transform=`rotateY(${-d.dir*170}deg)`;page.style.opacity='.15';timer=setTimeout(()=>{timer=null;if(!disposed&&root.isConnected!==false)onTurn(d.dir);},180);} else reset();};
  const keyboard=e=>{const edge=e.target.closest?.('[data-page-edge]');if(edge&&!edge.disabled&&e.detail===0&&!drag&&!timer)onTurn(Number(edge.dataset.pageEdge));};
  root.addEventListener('pointerdown',down);root.addEventListener('click',keyboard);view.addEventListener('pointermove',move,{passive:false});view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);
  return ()=>{disposed=true;clearTimeout(timer);drag=null;root.removeEventListener('pointerdown',down);root.removeEventListener('click',keyboard);view.removeEventListener('pointermove',move);view.removeEventListener('pointerup',up);view.removeEventListener('pointercancel',up);};
}
