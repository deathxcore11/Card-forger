import {deckViewer,deckCardAttrs,deckShell} from './deck-viewer.js';
import {esc,usd} from './ui.js';
// The shared deck is a read-only mode of the same proven-deck inspector.
// Sections come from the owner's snapshot; no format or zone is guessed.
export function sharedDeckSheet(spec){
 const item=spec.sharedItem,reference=spec.sourceReference,rows=item.cards,hero=rows.find(c=>c.image)?.image;
 const section=(zone,title)=>{const cards=rows.map((c,i)=>({...c,index:i})).filter(c=>c.zone===zone);return cards.length?`<section class="shared-deck-section"><p class="list-head">${title}<span class="muted">${cards.reduce((n,c)=>n+c.qty,0)}</span></p><div class="list compact" data-deck-list>${cards.map(c=>`<button class="mini-row art-row" ${deckCardAttrs(c.name,c.qty,zone,spec.cardFor?.(c)||(item.game==='mtg'?c:{...c,category:c.category||'Unresolved'}),item.commander===c.name?'Commander':'')} data-act="${reference?'wikiDeckCard':'sharedCard'}" ${reference?`data-wiki-result="${esc(reference.token)}" `:''}data-index="${c.index}">${c.image?`<img class="row-thumb" src="${esc(c.image)}" alt="" loading="lazy">`:'<span class="row-thumb img-missing"></span>'}<span class="ellip">${c.qty}× ${esc(c.name)}</span><span class="small muted">${c.referenceUSD===null?'':usd(c.referenceUSD*c.qty)}</span></button>`).join('')}</div></section>`:'';};
 const total=rows.reduce((n,c)=>n+c.qty,0),priced=rows.filter(c=>Number.isFinite(c.referenceUSD)),value=priced.reduce((n,c)=>n+c.referenceUSD*c.qty,0);
 const actions=reference?[{label:'Import deck',primary:true,attrs:`data-act="wikiDeckImport" data-wiki-result="${esc(reference.token)}"`},{label:'Export list',attrs:`data-act="wikiDeckExport" data-wiki-result="${esc(reference.token)}"`},{html:`<a class="btn ghost" href="${esc(reference.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(reference.sourceLabel)}</a>`}]:[{label:'Save to my decks',primary:true,attrs:'data-act="provenSave"',disabled:!(item.deckSchema===1&&item.format)}];
 return `<div class="ds-page">${deckShell({game:item.game,source:reference?'wiki':'shared',art:hero||'',title:item.title,
  back:'<button class="icon light" data-act="closeSheet" aria-label="Back">←</button>',
  badge:reference?'Wiki deck':'Shared deck',format:`<span class="chip dark">${esc(item.format||(reference?'Source deck':'Shared deck'))}</span>`,
  line:item.commander?`Commander · ${esc(item.commander)}`:'',
  stats:[{value:String(total),label:'cards'},...(priced.length?[{value:usd(value,0)+(priced.length<rows.length?'+':''),label:'reference value'}]:[])],
  actions})}${deckViewer(item.game,section('main','Main deck')+section('extra','Extra deck')+section('side','Sideboard'))}<p class="foot">${reference?'Exact source list · format checks have not been run.':item.deckSchema===1?'Save an independent copy to edit in My decks.':'The owner needs to update this shared copy with its format and card sections.'}</p></div>`;
}
