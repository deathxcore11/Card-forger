// Inline scanner browsing. Shares canonical printing rows and selection validation
// with the full printing browser; never opens a sheet or writes a collection.
import {esc,options} from './ui.js';
import {printingRows,printingFacets,filterPrintingRows,printingSelection} from './printing-picker.js';
import {printingGroups,attachPrintingCarousel} from './printing-carousel.js';
import {artworkHTML} from './artwork.js';
import {brandMark} from './brand.js';

export const scanHelp = "I couldn’t quite make that out. Try a clearer photo, or enter the card name and bottom number.";
const filters=()=>({set:'',number:'',rarity:'',sort:'best'});
const versionLabel=v=>[v.finishName,v.edition&&({'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'}[v.edition]||v.edition)].filter(Boolean).join(' · ')||'This version';
export const scanBrowseGroups=s=>printingGroups(filterPrintingRows(s.rows,s.filters));
export function scannerLookupHTML(q,{busy=false,photo=false,aiButton=true}={}) {
 const disabled=q.saving||busy||q.aiBusy;
 const setField=`<label class="field" for="scanMatchSet">Set (optional)<input id="scanMatchSet" type="search" maxlength="160" value="${esc(q.setDraft||'')}" data-input="scanSetDraft" data-enter="scanFind" placeholder="Set code or set name" autocomplete="off" ${disabled?'disabled':''}></label>`;
 return `<div class="scan-lookup"><label class="field" for="scanMatchName">Card name<input id="scanMatchName" type="search" maxlength="160" value="${esc(q.nameDraft||'')}" data-input="scanNameDraft" data-enter="scanFind" placeholder="Card name" autocomplete="off" ${disabled?'disabled':''}></label>
 <div class="scan-lookup-row"><label class="field" for="scanMatchNumber">Code or number<input id="scanMatchNumber" type="search" maxlength="40" value="${esc(q.numberDraft||'')}" data-input="scanNumberDraft" data-enter="scanFind" placeholder="${q.game==='ygo'?'KICO-EN046, EN046 or 46':q.game==='mtg'?'275, NEO or 275 NEO':'56/111 or sv03.5'}" aria-describedby="scanMatchNumberHint" autocomplete="off" ${disabled?'disabled':''}></label><button class="btn ghost" data-act="scanFind" ${disabled?'disabled':''}>${busy?'Finding…':'Find card'}</button></div><p class="tiny muted" id="scanMatchNumberHint">Any part works, in any order. The name you typed or scanned narrows it.</p>
 ${setField}
 ${aiButton?`<button class="btn ghost scan-ai-help" data-act="scanIdentifyAI" ${disabled||!photo?'disabled':''}>${brandMark(q.aiBusy?'brand-loading':'brand-idle')}<span>${q.aiBusy?'Reading your photo…':'Identify with AI'}</span></button><small class="muted">${photo?'Sends this photo to AI when tapped. You confirm the match.':'Take a photo to let AI help identify it.'}</small>`:q.aiBusy?`<p class="scan-ai-message" role="status">AI is taking a closer look…</p>`:''}
 ${q.aiMessage?`<p class="scan-ai-message" role="status">${esc(q.aiMessage)}</p>`:''}</div>`;
}
export function scannerCandidateCarousel(st) {
 const q=st.confirm,rows=st.cands||[],index=Math.max(0,Number(q.candidateGroup??q.i)||0);
 if(!rows.length)return `<div class="scan-unknown-art">${st.shot?`<img src="${esc(st.shot)}" alt="Your captured card">`:brandMark('brand-idle')}<b>Let’s find your card</b><p>${scanHelp}</p></div>`;
 return `<div class="scan-candidate-carousel"><div class="printing-carousel" role="region" aria-roledescription="carousel" aria-label="Possible card matches" tabindex="0">${rows.map((c,i)=>`<article class="printing-slide${i===index?' is-current':''}" data-group="${i}" role="group" aria-roledescription="slide" aria-label="${i+1} of ${rows.length}: ${esc(c.name)}" ${i===index?'':'inert'}><div class="printing-slide-art">${c.card?artworkHTML(c.card,'',true):`<img src="${esc(c.image||'')}" alt="${esc(c.name)}">`}</div><div class="printing-slide-copy"><strong>${esc(c.name)}</strong><span>${esc(c.sub||'')}</span><small>${c.reviewSource==='printing-picker'?'Printing selected by you':c.identityConflict?'Title evidence disagrees · check card identity':'Possible match · check name and printing'}</small><button class="btn ghost" data-act="scanChoose" data-i="${i}" ${q.saving?'disabled':''}>${q.i===i?'Browse this card’s printings':'This is my card'}</button></div></article>`).join('')}</div><div class="printing-carousel-nav"><button class="icon" data-act="scanCandidateStep" data-d="-1" aria-label="Previous possible card" ${index===0?'disabled':''}>←</button><output data-printing-position>${index+1} / ${rows.length}</output><button class="icon" data-act="scanCandidateStep" data-d="1" aria-label="Next possible card" ${index===rows.length-1?'disabled':''}>→</button></div></div>`;
}
export function scannerBrowseHTML(s) {
 const groups=scanBrowseGroups(s),index=Math.max(0,groups.findIndex(g=>g.key===s.activeGroup));
 return `<div class="scan-inline-printings" data-game="${s.game}"><div class="printing-carousel" role="region" aria-roledescription="carousel" aria-label="Matching printings" aria-busy="${s.busy}" tabindex="0">${groups.map((g,i)=>{
  const r=g.row,selected=g.versions.find(v=>v.key===s.versions[g.key])||(g.versions.length===1?r:null);
  return `<article class="printing-slide${i===index?' is-current':''}" data-group="${esc(g.key)}" role="group" aria-roledescription="slide" aria-label="${i+1} of ${groups.length}: ${esc(r.setName)}" ${i===index?'':'inert'}><div class="printing-slide-art">${r.image?`<img src="${esc(r.image)}" alt="${esc(r.name)} — ${esc(r.setName)}" draggable="false" loading="${i<3?'eager':'lazy'}">`:'<span>Artwork unavailable</span>'}</div><div class="printing-slide-copy"><strong>${esc(r.name)}</strong><b>${esc(r.setName)}</b><span>${esc([r.number&&'#'+r.number+(r.total?'/'+r.total:''),r.rarity].filter(Boolean).join(' · '))}</span>
  ${g.versions.length>1?`<div class="scan-chips" role="radiogroup" aria-label="Finish or edition for ${esc(r.setName)}">${g.versions.map(v=>`<button class="scan-chip" role="radio" aria-checked="${s.selectedKey===v.key}" data-act="scanBrowseChoose" data-key="${esc(v.key)}" data-card-id="${esc(r.cardId)}" ${v.selectable?'':'disabled'}>${esc(versionLabel(v))}</button>`).join('')}</div>${g.versions.some(v=>v.warning)?`<small>${esc(g.versions.find(v=>v.warning).warning)}</small>`:''}`
   :`${selected?.warning?`<small>${esc(selected.warning)}</small>`:''}<button class="btn${s.selectedKey===selected?.key?' is-selected':''}" data-act="scanBrowseChoose" data-key="${esc(selected?.key||'')}" data-card-id="${esc(r.cardId)}" ${selected?.selectable?'':'disabled'}>${s.selectedKey===selected?.key?'This is my card ✓':'This is my card'}</button>`}</div></article>`;
 }).join('')}</div>${groups.length?`<div class="printing-carousel-nav"><button class="icon" data-act="scanBrowseStep" data-d="-1" aria-label="Previous printing" ${index===0?'disabled':''}>←</button><output data-printing-position>${index+1} / ${groups.length}</output><button class="icon" data-act="scanBrowseStep" data-d="1" aria-label="Next printing" ${index===groups.length-1?'disabled':''}>→</button></div>`:`<p class="scan-browse-status" role="status">${s.busy?'Finding printings…':'No matching printings. Clear a filter or search another name or number.'}</p>`}<p class="foot scan-browse-status" role="status">${s.busy?'Loading printings…':`${groups.length} matching printings${s.nextCursor!==null?' · more available':''}`}${s.error?' · '+esc(s.error):''}</p>${s.error?'<button class="link" data-act="scanBrowseRetry">Retry printing lookup</button>':''}${s.nextCursor!==null?`<button class="link" data-act="scanBrowseMore" ${s.busy?'disabled':''}>Load more printings</button>`:''}</div>`;
}
export function scannerBrowseFilters(s) {
 const facets=printingFacets(s.rows),inSet=s.rows.filter(r=>!s.filters.set||r.releaseId===s.filters.set),numbers=[...new Set(inSet.map(r=>r.number+(r.total?'/'+r.total:'')))].filter(Boolean).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const control=(field,label,items)=>`<label class="field">${label}<select id="scanBrowse-${field}" data-change="scanBrowseFilter" data-field="${field}" aria-label="Scanned card ${label.toLowerCase()}" data-search="true">${options(items,s.filters[field])}</select></label>`;
 return `<div class="scan-browse-filters">${control('set','Set',[['','All matching sets'],...facets.sets])}${control('number','Number',[['','All numbers'],...numbers.map(n=>[n,n])])}${control('rarity','Rarity',[['','All rarities'],...facets.rarities])}<button class="link" data-act="scanBrowseClear">Clear filters</button></div>`;
}
export function createScannerBrowse(config,{current,draw,preview}={}) {
 const s={...config,rows:[],cards:[config.card],filters:filters(),versions:{},activeGroup:'',selectedKey:'',busy:false,loaded:false,nextCursor:null,error:'',abort:new AbortController(),visited:new Set()};
 const active=()=>!s.abort.signal.aborted&&current();
 const invalidate=()=>{s.selectedKey='';preview?.();};
 const rebuild=()=>{s.rows=printingRows(s.game,s.cards,{source:s.card,catalogue:s.catalogue,projectCard:s.projectCard});};
 // Open on the printing the scan or typed code identified (KICO-EN046), not the
 // first release in the list. Only the starting slide changes; nothing is chosen.
 const focus=()=>{
  const f=s.focus;if(!f||s.focused)return;
  const hit=r=>s.game==='ygo'?!!f.code&&String(r.number).toUpperCase()===f.code.toUpperCase()&&(!f.rarity||r.rarity===f.rarity):!!f.cardId&&String(r.cardId)===String(f.cardId);
  const group=scanBrowseGroups(s).find(g=>g.versions.some(hit));
  if(group){s.activeGroup=group.key;s.focused=true;}
 };
 s.load=async()=>{
  if(!active()||s.busy||s.loaded&&s.nextCursor===null)return;
  const cursor=s.loaded?s.nextCursor:null;s.busy=true;s.error='';draw();
  try{
   const page=await s.loadPage({cursor,signal:s.abort.signal});if(!active())return;
   if(!Array.isArray(page?.cards))throw Error('Could not read these printings.');
   s.cards=[...new Map([...s.cards,...page.cards].map(c=>[String(c.id),c])).values()];
   if(page.catalogue)s.catalogue=page.catalogue;s.loaded=true;s.nextCursor=page.nextCursor??null;rebuild();focus();
   s.visited.add(JSON.stringify(cursor));if(s.nextCursor!==null&&s.visited.has(JSON.stringify(s.nextCursor))){s.nextCursor=null;throw Error('The source repeated a page. Try the lookup again.');}
  }catch(e){if(active())s.error=e.message||'Printing lookup unavailable.';}
  finally{if(active()){s.busy=false;draw();}}
 };
 s.choose=key=>{if(!active())return false;const row=s.rows.find(r=>r.key===key),selection=printingSelection(row);if(!selection)return false;const result=s.onSelect(selection);if(result!==false){s.selectedKey=key;draw();}return result;};
 s.filter=(field,value)=>{if(!active()||!Object.hasOwn(s.filters,field))return;s.filters[field]=value;if(field==='set')s.filters.number='';s.activeGroup='';invalidate();draw();};
 s.clear=()=>{if(!active())return;s.filters=filters();s.activeGroup='';invalidate();draw();};
 s.attach=root=>{s.carouselObserver?.disconnect();attachPrintingCarousel(root,s,{step:n=>s.moveCarousel?.(n),onChange:()=>{if(active()){invalidate();draw();}}});};
 s.close=()=>{s.abort.abort();s.carouselObserver?.disconnect();};
 rebuild();return s;
}
