import {esc} from './ui.js';
import {artworkHTML} from './artwork.js';
import {printingRows} from './printing-picker.js';
import {setProgressMarkup} from './set-list-ui.js';
import {ygoRarityEffect,ygoRaritySwatch} from './ygo-foil-recipes.js';
// Yu-Gi-Oh! printings differ by rarity within one set, so each tile names its rarity with a foil swatch.
const ygoRarityTag=rarity=>rarity?`<span class="printing-mini-rarity"><span class="rarity-swatch rarity-swatch-${ygoRaritySwatch(ygoRarityEffect(String(rarity).toLowerCase().replace(/[^a-z0-9]/g,'')))}" aria-hidden="true"></span>${esc(rarity==='Rare'||rarity==='Short Print'?rarity:String(rarity).replace(/ Rare$/,''))}</span>`:'';
export function detailSetProgress({key,owned,total,loaded=0,complete=false,known=loaded},compact=false){
 const html=owned===null?'<div class="card-set-progress"><p class="muted small">Choose a verified release to see your set progress.</p></div>':`<div class="card-set-progress">${setProgressMarkup({key,owned,total,loaded,complete,known}).html}</div>`;
 // Button contents must stay phrasing-only, while retaining shared progress truth and ARIA.
 return compact?html.replace(/<(\/?)(?:div|section|p)(?=[ >])/g,'<$1span'):html;
}
// One focus target opens the selected release from either its identity or progress.
// Callers supply escaped, non-interactive identity markup and verified action attributes.
export function detailSetSummary({identity,action='',progress}){
 const tag=action?'button':'div';
 return `<${tag} class="cd-set card-set-summary"${action?` type="button" ${action}`:''}><span class="card-set-identity">${identity}</span>${detailSetProgress(progress,true)}</${tag}>`;
}
export function detailOwnedSummary(total){
 return `<span class="card-owned-summary" aria-label="${Number(total)||0} total copies in your collection">Owned · ${Number(total)||0}</span>`;
}
export function miniPrintingMarkup({game,card,cards=[],catalogue=[],projectCard,busy=false,error='',more=null}){
 const rows=printingRows(game,cards,{source:card,catalogue,projectCard}),seen=new Set(),items=[];
 for(const row of rows){const key=game==='ygo'&&row.printingKey?row.cardId+':'+row.releaseId+':'+row.printingKey:row.cardId+':'+row.releaseId;if(seen.has(key))continue;seen.add(key);items.push(row);}
 const action=game==='mtg'?'magicPrintings':'tOtherPrintings';
 return `<section class="card-printing-preview" aria-label="Other printings"><div class="row between"><h3>Other printings</h3><button class="link small" data-act="${action}" data-id="${esc(card.id)}" data-name="${esc(card.name)}">Sort & filter</button></div>${items.length?`<div class="card-printing-mini-rail" tabindex="0" aria-label="Swipe to browse printings">${items.map(row=>`<button class="card-printing-mini" ${game==='mtg'?`data-act="viewPrint" data-i="${cards.findIndex(c=>c.id===row.cardId)}"`:`data-act="tCard" data-id="${esc(row.cardId)}" data-game="${game}" data-set-id="${esc(row.releaseId)}"`} aria-label="View ${esc(row.setName)} ${esc(row.number)}">${artworkHTML(row.card,'printing-mini-art')}<b>${esc(row.setName)}</b><small>${row.number?'#'+esc(row.number):'Printing'}</small>${game==='ygo'?ygoRarityTag(row.rarity):''}</button>`).join('')}</div>`:`<p class="muted small" role="status">${busy?'Loading printings…':error?'Printings couldn’t load. Use Sort & filter to retry.':'Open Sort & filter to explore verified printings.'}</p>`}<p class="muted small" role="status">${items.length?(busy?'Loading more printing details…':error?'Some printings couldn’t load. Use Sort & filter to retry.':more===true?'Showing a preview. Open Sort & filter for all matching printings.':more===null?'Preview loaded. Open Sort & filter to check available printings.':''):''}</p><p class="foot">${items.length?'Swipe to compare · ':''}Choose finish and edition before adding.</p></section>`;
}
