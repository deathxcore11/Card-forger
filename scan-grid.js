// Scan session grid: every capture as a tile, one destination for the batch and
// one tap that adds every verified card. Pure markup; scancam.js owns the actions,
// the camera and the batch storage.
import {esc} from './ui.js';
import {artworkHTML} from './artwork.js';
import {CONDITIONS} from './scansession.js';

const ico=(b,cls='ico')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
export const GRID_ICONS={
  back:ico(`<path d="m15 5-7 7 7 7"/>`),
  photos:ico(`<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="16" cy="9.5" r="1.5"/>`),
  camera:ico(`<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>`),
  next:ico(`<path d="m9 6 6 6-6 6"/>`),
  check:ico(`<path d="m5 12.5 4.5 4.5L19 7.5"/>`),
  plus:ico(`<path d="M12 5v14M5 12h14"/>`),
  down:ico(`<path d="m6 9 6 6 6-6"/>`),
};
const GAME_LABEL={mtg:'Magic',ygo:'Yu-Gi-Oh!',ptcg:'Pokémon'};
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
const conditionShort=value=>CONDITIONS.find(([v])=>v===value)?.[1]||value||'';
// The candidate a tile stands for: the user's pick, else the only candidate,
// else the best ranked one (shown as a guess that still needs a look).
export function tileCandidate(row){
  const cands=row?.cands||[];
  if(Number.isInteger(row?.selectedIndex)&&row.selectedIndex>=0&&row.selectedIndex<cands.length)return cands[row.selectedIndex];
  return cands[0]||null;
}
export const isReading=row=>['captured','reading'].includes(row?.status);
export const needsLook=row=>!!row&&!isReading(row)&&row.status!=='ready';
// The picture for a tile: the matched printing when there is one, else the
// user's own photo, so an unread card is never shown as another card.
export function tileArt(row){
  const c=tileCandidate(row);
  if(c&&!isReading(row)){
    if(c.card)return artworkHTML(c.card,'',true);
    if(c.image)return `<img src="${esc(c.image)}" alt="" loading="lazy">`;
  }
  if(row?.shot)return `<img src="${esc(row.shot)}" alt="" loading="lazy">`;
  return `<span class="scan-tile-empty" aria-hidden="true"></span>`;
}
export function tileName(row){
  const c=tileCandidate(row);
  return c?.name||(isReading(row)?'Reading…':'Not read yet');
}
export function tileMeta(row,finishLabel=(g,c,f)=>f){
  const c=tileCandidate(row);
  if(isReading(row))return {text:'Reading the card…',tone:'reading'};
  if(!c)return {text:row.reason||'Rescan name and bottom code',tone:'warn'};
  if(row.status==='ready'){
    const parts=[c.sub||'',conditionShort(row.condition),row.finish?finishLabel(row.game,c,row.finish):'',`×${row.qty||1}`].filter(Boolean);
    return {text:parts.join(' · '),tone:'ok'};
  }
  const printings=new Set((row.cands||[]).map(x=>[x.id,x.print||'',x.setReleaseId||''].join('|'))).size;
  return {text:row.reason==='Check printing'&&printings>1?`${printings} printings match`:row.reason||'Check this card',tone:'warn'};
}
function badge(row){
  if(isReading(row))return `<span class="scan-tile-state is-reading" aria-hidden="true">…</span>`;
  if(row.status==='ready')return `<span class="scan-tile-state is-ok" aria-hidden="true">${GRID_ICONS.check}</span>`;
  return `<span class="scan-tile-state is-warn">Check</span>`;
}
const rowLabel=row=>`${tileName(row)}: ${isReading(row)?'reading':row.status==='ready'?'ready to add':row.reason||'needs a look'}`;

// Camera tray: the session's last cards, the shutter, a photo picker and Done.
// `scan-pile` keeps its class so the queue animation and tests find it.
export function scanTray(st,rows,counts,{busy=false,alerts='',cameraOn=false}={}){
  const recent=rows.slice(-8),ready=counts.ready,look=counts.review,reading=counts.reading;
  const thumbs=recent.map(row=>`<button class="scan-batch-thumb ${esc(row.status)}" data-act="scanBatchReview" data-id="${esc(row.id)}" aria-label="${esc(rowLabel(row))}" ${st.batchSaving?'disabled':''}>${row.shot?`<img src="${esc(row.shot)}" alt="">`:''}<span>${row.status==='ready'?'✓':isReading(row)?'…':'?'}</span></button>`).join('');
  const summary=rows.length?`${plural(rows.length,'card')}${ready?` · ${ready} ready`:''}${look?` · ${look} to check`:''}${reading?` · reading ${reading}`:''}`:'Cards you scan land here';
  return `<section class="scan-batch-tray scan-tray${rows.length?'':' is-empty'}" aria-label="Captured batch" data-batch-count="${rows.length}">
  <div class="scan-tray-top"><div class="scan-tray-strip" role="group" aria-label="Cards in this batch" data-audit-scroll data-audit-repeat>${thumbs||'<span class="scan-tray-empty" aria-hidden="true"></span>'}</div><p class="scan-tray-summary" role="status">${esc(summary)}</p></div>
  <div class="scan-tray-row">${cameraOn?`<label class="scan-tray-pick" aria-label="Add photos from your gallery"><input type="file" accept="image/*" multiple data-change="scanFile" hidden>${GRID_ICONS.photos}</label><button class="scan-shutter" id="scanCaptureBtn" data-act="scanCapture" aria-label="Capture card now">${GRID_ICONS.camera}</button>`:`<label class="scan-tray-pick scan-tray-pick-wide"><input type="file" accept="image/*" multiple data-change="scanFile" hidden>${GRID_ICONS.photos}<span>Add photos</span></label>`}<button class="scan-pile" data-act="scanBatchGrid" aria-label="${rows.length?`Open your ${plural(rows.length,'scan')}${busy?', reading in progress':''}`:'No scans yet'}" ${!rows.length||st.batchSaving?'disabled':''}><span class="scan-pile-cards" aria-hidden="true">${rows.length?rows.slice(-3).map(row=>`<i>${row.shot?`<img src="${esc(row.shot)}" alt="">`:''}</i>`).join(''):'<i></i><i></i>'}<b>${rows.length}</b></span><span class="scan-pile-text">Done ${GRID_ICONS.next}</span></button></div>
  ${alerts?`<div class="scan-pile-alerts">${alerts}</div>`:''}</section>`;
}

function destinationChips(st,destinations,current,{selectMode=false}={}){
  return `<div class="scan-dest" role="group" aria-label="${selectMode?'Move selected cards to':'Where scanned cards go'}"><span class="scan-dest-label">${selectMode?'Move to':'Add to'}</span><div class="scan-dest-chips" role="radiogroup" aria-label="Destination">${destinations.map(d=>`<button class="scan-chip scan-dest-chip${d.binder?' is-binder':''}" role="radio" aria-checked="${d.value===current}" data-act="scanDest" data-value="${esc(d.value)}" ${st.gridBusy?'disabled':''}>${d.value===current?GRID_ICONS.check:''}<span>${esc(d.label)}</span></button>`).join('')}<button class="scan-chip scan-dest-new-chip" data-act="scanDestNew" ${st.gridBusy||st.destDraft!=null?'disabled':''}>${GRID_ICONS.plus}<span>New binder</span></button></div></div>
  ${st.destDraft!=null?`<div class="scan-dest-new" role="group" aria-label="New binder"><input id="scanDestName" type="text" maxlength="60" value="${esc(st.destDraft)}" data-input="scanDestDraft" data-enter="scanDestCreate" aria-label="Binder name" autocomplete="off" autocapitalize="words"><button class="btn" data-act="scanDestCreate" ${st.gridBusy?'disabled':''}>Create</button><button class="btn ghost" data-act="scanDestCancel">Cancel</button></div>`:''}`;
}

function tile(row,{selected=null,finishLabel,busy=false}){
  const meta=tileMeta(row,finishLabel),picked=selected?.has(row.id)||false,selecting=!!selected;
  return `<button class="scan-tile is-${esc(row.status)}${picked?' is-selected':''}" data-act="scanTile" data-id="${esc(row.id)}" aria-label="${esc(rowLabel(row))}${selecting?picked?', selected':', not selected':''}" ${selecting?`aria-pressed="${picked}"`:''} ${busy?'disabled':''}><span class="scan-tile-art">${tileArt(row)}${selecting?`<span class="scan-tile-tick${picked?' is-on':''}" aria-hidden="true">${picked?GRID_ICONS.check:''}</span>`:badge(row)}</span><span class="scan-tile-name">${esc(tileName(row))}</span><span class="scan-tile-meta is-${meta.tone}">${esc(meta.text)}</span></button>`;
}

// Select mode: every change applies to the ticked cards at once.
function selectBar(st,rows,selectedRows,{finishLabel,finishOptions}){
  const n=selectedRows.length,qtys=new Set(selectedRows.map(r=>r.qty||1)),qty=qtys.size===1?[...qtys][0]:null,disabled=!n||st.gridBusy?'disabled':'';
  const conditions=new Set(selectedRows.map(r=>r.condition));
  const ready=selectedRows.filter(r=>r.status==='ready').length,more=!!st.select?.more;
  // Collapsed, the bar is one row so the cards stay in view; Change opens the chips.
  return `<div class="scan-select-bar${more?' is-open':''}" role="region" aria-label="Change selected cards">${more?`
  <div class="scan-select-row"><span class="scan-select-label">Condition</span><div class="scan-select-chips" role="group" aria-label="Condition for selected cards">${CONDITIONS.map(([v,l])=>`<button class="scan-chip" data-act="scanSelectCondition" data-value="${esc(v)}" aria-pressed="${conditions.size===1&&conditions.has(v)}" aria-label="${esc(v)}" ${disabled}>${l}</button>`).join('')}</div></div>
  ${finishOptions.length?`<div class="scan-select-row"><span class="scan-select-label">Finish</span><div class="scan-select-chips" role="group" aria-label="Finish for selected cards">${finishOptions.map(f=>`<button class="scan-chip" data-act="scanSelectFinish" data-value="${esc(f.value)}" aria-pressed="${f.all}" ${disabled}>${esc(f.label)}</button>`).join('')}</div></div>`:''}
  <div class="scan-select-row"><span class="scan-select-label">Copies</span><span class="scan-select-qty"><button data-act="scanSelectQty" data-d="-1" aria-label="Fewer copies" ${disabled||(qty!==null&&qty<=1)?'disabled':''}>−</button><output aria-label="Copies of each selected card">${qty===null?(n?'mixed':'—'):qty}</output><button data-act="scanSelectQty" data-d="1" aria-label="More copies" ${disabled}>＋</button></span><button class="btn ghost scan-select-remove" data-act="scanSelectRemove" ${disabled}>Remove${n?` ${n}`:''}</button></div>`:''}
  <div class="scan-grid-bar is-select"><button class="btn ghost" data-act="scanSelectToggle">Done</button><button class="btn ghost scan-select-more" data-act="scanSelectMore" aria-expanded="${more}" ${more?'aria-label="Hide the options"':''}>${more?GRID_ICONS.down:'Change'}</button><button class="btn" data-act="scanBatchAddAll" ${!ready||st.gridBusy?'disabled':''}>${st.gridBusy?'Adding…':ready?`Add ${ready} selected`:'Select ready cards to add'}</button></div></div>`;
}

export function scanGridView(st,rows,h){
  const {counts,destinations,destination,finishLabel,finishOptions=[],game}=h;
  const select=st.select?new Set(st.select.ids):null,selectedRows=select?rows.filter(r=>select.has(r.id)):[];
  const destLabel=destinations.find(d=>d.value===destination)?.label||destination||'Collection';
  const summary=rows.length?`${plural(rows.length,'card')}${counts.ready?` · ${counts.ready} ready`:''}${counts.review?` · ${counts.review} to check`:''}${counts.reading?` · reading ${counts.reading}…`:''}`:'Nothing scanned yet';
  const head=`<header class="scan-grid-head"><button class="icon" data-act="scanGridBack" aria-label="Back to the camera">${GRID_ICONS.back}</button><div class="scan-grid-title"><h1>${select?`${plural(selectedRows.length,'card')} selected`:'Your scans'}</h1><span role="status">${esc(summary)}</span></div>${rows.length?select?`<button class="btn ghost small" data-act="${selectedRows.length===rows.length?'scanSelectNone':'scanSelectAll'}">${selectedRows.length===rows.length?'None':'All'}</button>`:`<button class="btn ghost small" data-act="scanSelectToggle" aria-pressed="false">Select</button>`:''}</header>`;
  if(!rows.length)return `<div class="scan-workspace is-grid">${head}<div class="scan-grid-empty"><p>Nothing scanned yet.</p><button class="btn" data-act="scanGridBack">${GRID_ICONS.camera} Back to scanning</button></div></div>`;
  const tiles=`<div class="scan-grid${select?' is-selecting':''}" aria-label="Cards in this batch" data-audit-repeat>${rows.map(row=>tile(row,{selected:select,finishLabel,busy:st.gridBusy})).join('')}</div>`;
  const note=st.gridError?`<p class="scan-grid-error" role="alert">${esc(st.gridError)}</p>`:st.reviewRequested&&st.status?`<p class="scan-grid-note" role="status">${esc(st.status)}</p>`:'';
  const bar=select?selectBar(st,rows,selectedRows,{finishLabel,finishOptions}):st.confirm?'':`<div class="scan-grid-bar">${counts.review?`<button class="btn ghost" data-act="scanBatchReview" ${st.gridBusy?'disabled':''}>Fix ${counts.review}</button>`:''}<button class="btn" data-act="scanBatchAddAll" ${!counts.ready||st.gridBusy?'disabled':''}>${st.gridBusy?'Adding…':counts.ready?`Add ${counts.ready} to ${esc(destLabel)}`:counts.reading?'Reading…':'Nothing ready to add'}</button></div>`;
  return `<div class="scan-workspace is-grid${select?' is-selecting':''}">${head}${destinationChips(st,destinations,destination,{selectMode:!!select})}${note}${tiles}${bar}</div>`;
}
