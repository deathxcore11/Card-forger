import {esc} from './ui.js';
import {printingRows} from './printing-picker.js';
import {setProgressMarkup} from './set-list-ui.js';
export function detailSetProgress({key,owned,total,loaded=0,complete=false}){
 if(owned===null)return '<div class="card-set-progress"><p class="muted small">Choose a verified release to see your set progress.</p></div>';
 return `<div class="card-set-progress">${setProgressMarkup({key,owned,total,loaded,complete}).html}</div>`;
}
export function miniPrintingMarkup({game,card,cards=[],catalogue=[],projectCard,busy=false,error=''}){
 const rows=printingRows(game,cards,{source:card,catalogue,projectCard}),seen=new Set(),items=[];
 for(const row of rows){const key=row.cardId+':'+row.releaseId;if(seen.has(key))continue;seen.add(key);items.push(row);}
 const action=game==='mtg'?'magicPrintings':'tOtherPrintings';
 return `<section class="card-printing-preview" aria-label="Other printings"><div class="row between"><h3>Other printings</h3><button class="link small" data-act="${action}" data-id="${esc(card.id)}" data-name="${esc(card.name)}">Sort & filter</button></div>${items.length?`<div class="card-printing-mini-rail" tabindex="0" aria-label="Swipe to browse printings">${items.map(row=>`<button class="card-printing-mini" ${game==='mtg'?`data-act="viewPrint" data-i="${cards.findIndex(c=>c.id===row.cardId)}"`:`data-act="tCard" data-id="${esc(row.cardId)}" data-game="${game}" data-set-id="${esc(row.releaseId)}"`} aria-label="View ${esc(row.setName)} ${esc(row.number)}">${row.image?`<img src="${esc(row.image)}" alt="" loading="lazy" onerror="this.hidden=true">`:'<span class="muted">Art unavailable</span>'}<b>${esc(row.setName)}</b><small>${row.number?'#'+esc(row.number):'Printing'}</small></button>`).join('')}</div>`:`<p class="muted small" role="status">${busy?'Loading printings…':error?'Printings couldn’t load. Use Sort & filter to retry.':'Open Sort & filter to explore verified printings.'}</p>`}<p class="foot">${items.length?'Swipe to compare · ':''}Choose finish and edition before adding.</p></section>`;
}
