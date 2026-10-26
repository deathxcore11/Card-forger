import {cardKey} from './core.js';
import {esc} from './ui.js';

// A physical lot is not a name-wide gameplay card. This read-only resolver never
// substitutes another printing, changes a saved finish, or repairs stored data.
const numberKey=v=>String(v??'').trim().replace(/^0+(?=\d)/,'').toLowerCase();
const signature=e=>JSON.stringify([e.id,cardKey(e.name),e.printingVerified===true,e.printingId||'',e.set||'',e.collectorNumber||'',e.finish||'nonfoil',e.condition||'',e.language||'']);
export function magicOwnedDetail(state,entryId,name='',candidate){
 const matches=(state?.collection||[]).filter(e=>e.id===entryId);
 if(matches.length!==1)return {status:'blocked',reason:'This saved copy is no longer available. Reopen it from your collection.'};
 const entry=matches[0],identity={entryId:entry.id,printingId:entry.printingId||'',signature:signature(entry)};
 const base={entry,identity,finish:entry.finish||'nonfoil'};
 if(name&&cardKey(name)!==cardKey(entry.name))return {...base,status:'blocked',reason:'This saved copy does not match the card you opened. Reopen it from your collection.'};
 if(entry.printingVerified!==true||!entry.printingId)return {...base,status:'blocked',reason:'The exact printing for this saved copy needs review. Your recorded copy is unchanged; edit it to confirm the printing.'};
 const card=candidate===undefined?state.printings?.[entry.printingId]:candidate;
 if(!card)return {...base,status:'loading',reason:'Loading your exact saved printing…'};
 if(card.id!==entry.printingId||(card.game&&card.game!=='mtg')||cardKey(card.name)!==cardKey(entry.name)||
  (entry.set&&String(card.set||'').toLowerCase()!==String(entry.set).toLowerCase())||
  (entry.collectorNumber&&numberKey(card.collector_number)!==numberKey(entry.collectorNumber)))
  return {...base,status:'blocked',reason:'The available card data does not match your saved printing. Your copy is unchanged; review its printing before continuing.'};
 if(!Array.isArray(card.finishes)||!card.finishes.length)return {...base,status:'loading',reason:'Checking the finish of your exact saved printing…'};
 if(!card.finishes.includes(base.finish))return {...base,status:'blocked',reason:'The recorded finish is not supported for this saved printing. Your copy is unchanged; review its printing and finish.'};
 return {...base,status:'ready',card};
}
// Shared display/value boundary for a single saved lot. Unknown/conflicting
// provenance may keep its saved metadata, but cannot borrow a sibling card.
export function magicOwnedCard(entry,candidate){
 if(!entry)return null;
 const resolved=magicOwnedDetail({collection:[entry]},entry.id,'',candidate||null);
 return resolved.status==='ready'?resolved.card:null;
}
export function magicOwnedCurrent(state,identity){
 if(!identity)return false;
 const entries=(state?.collection||[]).filter(e=>e.id===identity.entryId);
 return entries.length===1&&signature(entries[0])===identity.signature;
}
export function magicOwnedContext(result){
 const e=result.entry;
 return {type:'card',name:e?.name||'',entryId:e?.id||'',ownedDetail:result.identity,print:result.card||null,
  setId:result.card?.set||e?.set||'',priceFinish:result.finish,setVariant:result.finish,condition:e?.condition,language:e?.language,
  ownedNotice:result.reason||'',ownedStatus:result.status};
}
export function magicOwnedNotice(ctx){
 return `<div class="sheet-head"><h2>${esc(ctx.name||'Saved card')}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p class="note warn" role="status">${esc(ctx.ownedNotice||'This saved copy changed. Reopen it from your collection.')}</p><p class="muted small">No other printing’s artwork or price is substituted.</p>${ctx.entryId?`<div class="actions"><button class="btn ghost" data-act="card" data-name="${esc(ctx.name)}" data-entry="${esc(ctx.entryId)}">Retry exact printing</button><button class="btn ghost" data-act="editLot" data-id="${esc(ctx.entryId)}">Review saved copy</button></div>`:''}`;
}
