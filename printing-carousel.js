import {esc,options,usd,setIconUrl} from './ui.js';
import {pkCatalogueSymbolSources} from './emblems.js';

export const printingGroupKey = row => JSON.stringify([row.game,row.cardId,row.releaseId,row.number,row.rarity,row.image]);
export function printingGroups(rows) {
 const groups=new Map();
 for(const row of rows){const key=printingGroupKey(row);if(!groups.has(key))groups.set(key,{key,row,versions:[]});groups.get(key).versions.push(row);}
 return [...groups.values()];
}
const image=value=>typeof value==='string'&&/^(https?:\/\/|img\/)/.test(value)?value:'';
const setImage=(state,id)=>{const set=state.catalogue?.find(s=>s.id===id),row=state.rows.find(r=>r.releaseId===id);return state.game==='mtg'?setIconUrl(id):state.game==='ptcg'?pkCatalogueSymbolSources(set||{...row?.card?.set,id,name:row?.setName})[0]||'':image(set?.image||set?.logo);};
const control=(id,label,field,items,current)=>`<label class="field" for="${id}">${label}<select id="${id}" data-change="printingPickerFilter" data-field="${field}">${options(items,current)}</select></label>`;
const versionName=row=>[row.finishName||row.rarity,row.edition&&({'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'}[row.edition]||row.edition)].filter(Boolean).join(' · ');
export function printingCarouselHTML(state,visible,facets) {
 const {game,card,filters,busy,error,nextCursor,loaded,complete}=state,groups=printingGroups(visible);
 const focused=groups.findIndex(g=>g.key===state.activeGroup),index=Math.max(0,focused),selectedSet=facets.sets.find(([id])=>id===filters.set),symbol=filters.set&&setImage(state,filters.set);
 const chips=[['set',selectedSet?.[1]||filters.set],['number',filters.number&&'#'+filters.number],['finish',facets.finishes.find(([id])=>id===filters.finish)?.[1]],['edition',facets.editions.find(([id])=>id===filters.edition)?.[1]],['rarity',filters.rarity]].filter(([,v])=>v);
 return `<section class="printing-picker printing-picker-modern" data-game="${game}" aria-labelledby="printingPickerTitle">
 <div class="sheet-head"><button class="icon" data-act="printingPickerBack" data-history-back="1" aria-label="Back to previous card">←</button><h2 id="printingPickerTitle" tabindex="-1">Choose a printing</h2><button class="btn ghost small" data-act="printingPickerCancel">Cancel</button></div>
 <button class="link small printing-all" data-act="printingPickerView" data-id="grid">All printings</button><div class="printing-picker-heading"><p class="printing-picker-name">${esc(card.name)}</p><p class="muted small">Swipe to compare. Choose the card that matches yours.</p></div>
 <div class="printing-picker-controls">
 <label class="field printing-set-field" for="printingPickerSet">Set<span class="printing-set-pill">${symbol?`<img src="${esc(symbol)}" alt="" onerror="this.hidden=true">`:''}<select id="printingPickerSet" data-search="true" data-change="printingPickerFilter" data-field="set" aria-label="Set"><option value="">All sets</option>${facets.sets.map(([id,name])=>`<option value="${esc(id)}" data-icon="${esc(setImage(state,id))}" ${id===filters.set?'selected':''}>${esc(name)}</option>`).join('')}</select></span></label>
 <label class="field printing-number-field" for="printingPickerNumber">${game==='ygo'?'Code':'Number'}<input id="printingPickerNumber" type="search" autocomplete="off" maxlength="40" value="${esc(filters.number)}" data-input="printingPickerNumber" placeholder="${game==='ygo'?'LOB-001':'023/025'}"></label>
 ${control('printingPickerSort','Sort','sort',[['best','Best match'],['new','Newest set'],['old','Oldest set']],filters.sort)}
 ${game==='ygo'?control('printingPickerRarity','Rarity','rarity',[['','All rarities'],...facets.rarities],filters.rarity):control('printingPickerFinish','Finish','finish',[['','All finishes'],...facets.finishes],filters.finish)}
 ${game==='ygo'?control('printingPickerEdition','Edition','edition',[['','All editions'],...facets.editions],filters.edition):''}</div>
 ${chips.length?`<div class="printing-filter-chips" aria-label="Active filters">${chips.map(([field,label])=>`<button class="chip" data-act="printingPickerRemoveFilter" data-field="${field}" aria-label="Remove ${field} filter">${esc(label)} <span aria-hidden="true">×</span></button>`).join('')}<button class="link" data-act="printingPickerClear">Clear filters</button></div>`:''}
 <div class="printing-picker-status" tabindex="-1" role="status" aria-live="polite"><span>${groups.length} ${groups.length===1?'printing':'printings'}${nextCursor!==null?' loaded':''}</span><span class="muted small">${busy?'Loading printings…':error?'Some results could not load':!loaded?'Finding printings…':nextCursor!==null?'More loading as you browse':!complete?'Some details unavailable':''}</span></div>
 ${state.note?`<p class="foot">${esc(state.note)}</p>`:''}
 ${error?`<p class="note warn" role="alert">${esc(error)} <button class="link" data-act="printingPickerRetry">Retry</button></p>`:''}
 <div class="printing-carousel" role="region" aria-roledescription="carousel" aria-label="Matching printings" aria-busy="${busy}" tabindex="0">${groups.map((group,i)=>{
 const row=group.row,remembered=state.versions?.[group.key],selection=group.versions.find(v=>v.key===remembered)||(group.versions.length===1?row:null);
 return `<article class="printing-slide${i===index?' is-current':''}" data-group="${esc(group.key)}" role="group" aria-roledescription="slide" aria-label="${i+1} of ${groups.length}: ${esc(row.setName)}" ${i===index?'':'inert'}>
 <div class="printing-slide-art">${image(row.image)?`<img src="${esc(row.image)}" alt="${esc(row.name)} — ${esc(row.setName)}" draggable="false" loading="${i<3?'eager':'lazy'}" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="muted" hidden>Artwork unavailable</span>`:'<span class="muted">Artwork unavailable</span>'}</div>
 <div class="printing-slide-copy"><b>${esc(row.setName)}</b><span>${esc([row.number&&'#'+row.number+(row.total?'/'+row.total:''),row.rarity,row.date?.slice(0,4)].filter(Boolean).join(' · '))}</span>
 ${group.versions.length>1?`<label class="field">Finish / version<select data-change="printingPickerVariant" data-group="${esc(group.key)}" aria-label="Finish for ${esc(row.setName)}">${options([['','Choose finish'],...group.versions.map(v=>[v.key,versionName(v)])],selection?.key||'')}</select></label>`:`<small>${esc(versionName(row))}</small>`}
 <small class="muted">${selection?.price!=null?usd(selection.price)+' reference':'Price unavailable'} · ${esc(row.artLabel)}</small>
 ${selection?.warning?`<small class="printing-picker-warning">${esc(selection.warning)}</small>`:''}
 <button class="btn printing-picker-choice" data-act="printingPickerChoose" data-key="${esc(selection?.key||'')}" data-card-id="${esc(row.cardId)}" data-release-id="${esc(row.releaseId)}" data-variant="${esc(selection?.variantKey||'')}" data-printing="${esc(selection?.printingKey||'')}" data-edition="${esc(selection?.edition||'')}" ${selection?.selectable?'':'disabled'}>Use this printing</button></div></article>`;
 }).join('')}</div>
 ${groups.length?`<div class="printing-carousel-nav"><button class="icon" data-act="printingPickerStep" data-d="-1" aria-label="Previous printing" ${index===0?'disabled':''}>←</button><output aria-live="polite" data-printing-position>${index+1} / ${groups.length}</output><button class="icon" data-act="printingPickerStep" data-d="1" aria-label="Next printing" ${index===groups.length-1?'disabled':''}>→</button></div>`:!busy?'<div class="printing-empty"><b>No matching printings</b><p class="muted">Try a different number or clear a filter.</p><button class="btn ghost" data-act="printingPickerClear">Clear filters</button></div>':''}
 ${nextCursor!==null?`<button class="btn ghost block" data-act="printingPickerMore" ${busy?'disabled':''}>${busy?'Loading…':'Load more matching printings'}</button>`:''}
 ${loaded&&!complete&&nextCursor===null&&!busy&&!error?'<button class="link" data-act="printingPickerRetry">Reload matching printings</button>':''}
 <p class="foot">${state.purpose==='scan'?'Nothing is added automatically. Review before saving.':'Choosing opens this exact printing.'} Reference art may not show its finish or stamp.</p></section>`;
}

// Native horizontal scrolling gives touch momentum, trackpad support and scroll
// snapping without intercepting vertical page gestures or writing inventory.
export function attachPrintingCarousel(root,state,{step,nearEnd}={}) {
 const rail=root?.querySelector?.('.printing-carousel');if(!rail)return;
 const slides=[...rail.querySelectorAll('.printing-slide')];if(!slides.length)return;
 const position=root.querySelector('[data-printing-position]'),prev=root.querySelector('[data-d="-1"]'),next=root.querySelector('[data-d="1"]');
 const center=(slide,behavior='instant')=>rail.scrollTo({left:slide.offsetLeft-(rail.clientWidth-slide.offsetWidth)/2,behavior});
 let index=Math.max(0,slides.findIndex(s=>s.dataset.group===state.activeGroup)),timer;
 const select=i=>{index=i;state.activeGroup=slides[i].dataset.group;slides.forEach((s,n)=>{s.classList.toggle('is-current',n===i);s.inert=n!==i;});if(position)position.textContent=`${i+1} / ${slides.length}`;if(prev)prev.disabled=i===0;if(next)next.disabled=i===slides.length-1;};
 select(index);center(slides[index]);
 rail.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!rail.isConnected)return;const midpoint=rail.scrollLeft+rail.clientWidth/2;let best=0;slides.forEach((s,i)=>{if(Math.abs(s.offsetLeft+s.offsetWidth/2-midpoint)<Math.abs(slides[best].offsetLeft+slides[best].offsetWidth/2-midpoint))best=i;});select(best);if(best>=slides.length-3)nearEnd?.();},100);},{passive:true});
 rail.addEventListener('keydown',e=>{if(e.target!==rail||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();step?.(e.key==='Home'?-slides.length:e.key==='End'?slides.length:e.key==='ArrowLeft'?-1:1);});
 // Recenter the same printing after unfolding or rotating, without moving focus.
 if(globalThis.ResizeObserver){const observer=new ResizeObserver(()=>{if(!rail.isConnected)return observer.disconnect();center(slides[index]);});observer.observe(rail);state.carouselObserver=observer;}
 state.moveCarousel=delta=>{const i=Math.max(0,Math.min(slides.length-1,index+delta));select(i);center(slides[i],globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth');if(i>=slides.length-3)nearEnd?.();};
}
