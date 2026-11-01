import {setAtmosphere} from './set-experience.js';
import {pokemonVariantChoices} from './pokemon-variant-options.js';
import {ygoRarity} from './ygo-identity.js';
import {esc} from './ui.js';
import {pkCatalogueSymbolSources} from './emblems.js';
// Decode provider entities as text, then escape at the HTML boundary.
export function catalogueText(value) {
 return String(value ?? '').replace(/&(?:apos|#39|#x27);/gi,"'").replace(/&quot;/gi,'"').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
export const knownSetCount = value => ['number','string'].includes(typeof value) && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
// Symbols belong in the catalogue's reserved artwork slot. A real code stays
// visible while loading and after every source fails, without changing geometry.
function pokemonCatalogueMedia(set, name, code) {
 const sources=pkCatalogueSymbolSources(set),label=code?`${name} (${code})`:name;
 const next=sources[1]?` data-symbol-next="${esc(sources[1])}"`:'',last=sources[2]?` data-symbol-last="${esc(sources[2])}"`:'';
 const symbol=sources.length?`<img class="set-catalogue-symbol" src="${esc(sources[0])}"${next}${last} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.parentElement.classList.remove('no-art')" onerror="this.parentElement.classList.add('no-art');const next=this.dataset.symbolNext||this.dataset.symbolLast;if(next){if(this.dataset.symbolNext){delete this.dataset.symbolNext}else{delete this.dataset.symbolLast}this.src=next}else{this.onerror=null;this.onload=null;this.hidden=true}">`:'';
 return `<span class="set-media set-media-pokemon-symbol no-art" data-set-symbol-id="${esc(set.id||'')}" role="img" aria-label="${esc(label)}">${symbol}<span class="set-media-fallback" aria-hidden="true"><span class="set-art-code">${esc(code||'—')}</span></span></span>`;
}
// Shared emblem treatment. Use verified set logos/symbols; unknown sets keep their code.
export function setRowContent({name,code,image='',symbol='',pokemonSet=null,ygoSet=null,magicSet=null,ambient=false,detail='',count=null,owned=null,printingCount=null,progress=null}){
 name=catalogueText(name);detail=catalogueText(detail);
 // A remote symbol can fail with the artwork URL too. The fallback must be
 // real text, not the same unavailable image painted through a CSS mask.
 const fallback=`<span class="set-art-code">${esc(code)}</span>`,total=knownSetCount(count),prints=knownSetCount(printingCount);
 const media=ygoSet?`<span class="set-media set-media-ygo" role="img" aria-label="${esc(name)} set code ${esc(code)}">${image?`<img src="${esc(image)}" alt="" aria-hidden="true" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true">`:''}<span class="set-ygo-emblem" aria-hidden="true"><span>${esc(code||'YGO')}</span></span></span>`:pokemonSet?pokemonCatalogueMedia(pokemonSet,name,code):`<span class="set-media ${image?'':'no-art'}">${image?`<img src="${esc(image)}" alt="${esc(name)} set artwork" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('no-art')">`:''}<span class="set-media-fallback" aria-hidden="true">${fallback}</span></span>`;
 const atmosphere=ambient?setAtmosphere(ygoSet?"ygo":pokemonSet?"ptcg":"mtg",ygoSet||pokemonSet||magicSet||{code,image}):'';
 const content=`${media}<span class="set-row-main"><b>${pokemonSet?'':symbol}<span>${esc(name)}</span></b><span class="set-row-detail"><span class="set-code-mark">${esc(code)}</span><span>${esc(detail)}</span></span></span><span class="set-row-count">${total!==null?`<b>${total.toLocaleString()}</b><small>${total===1?'card':'cards'}</small>`:prints!==null?`<b>${prints.toLocaleString()}</b><small>printings listed</small><small>unique total unverified</small>`:'<small>Card total</small><b class="count-unknown">Unknown</b>'}${!progress&&owned>0?`<small class="ok-text">${Number(owned).toLocaleString()} owned</small>`:''}</span>`;
 return progress?`${atmosphere}<span class="set-tile-body">${content}</span>${setProgressMarkup({...progress,compact:true}).html}`:atmosphere+content;
}
// Headings live outside each year’s grid, so a heading can never consume a card slot.
export function setYearSections(sets, renderRow, dateOf = set => set.date) {
 const groups=new Map();
 for(const set of sets){const date=String(dateOf(set)||''),year=/^\d{4}/.test(date)?date.slice(0,4):'Date unavailable';if(!groups.has(year))groups.set(year,[]);groups.get(year).push(set);}
 return `<div class="set-year-sections">${[...groups].map(([year,rows])=>`<section class="set-year-section" aria-label="${esc(year)} releases"><header class="set-year-heading"><h2 class="year">${esc(year)}</h2><span>${rows.length.toLocaleString()} ${rows.length===1?'release':'releases'}</span><i aria-hidden="true"></i></header><div class="set-list set-year-grid">${rows.map(renderRow).join('')}</div></section>`).join('')}</div>`;
}
const values = xs => [...new Set(xs.filter(x=>x!==null&&x!==undefined&&x!==''))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
// Detailed provider IDs identify products, not labels a collector can understand.
const finishNames={normal:'Normal',holofoil:'Holofoil','reverse-holofoil':'Reverse Holofoil',reverse:'Reverse Holofoil','1st-edition':'First Edition','1st-edition-holofoil':'First Edition · Holofoil'};
export function setFinishLabel(key){return finishNames[key]||String(key).replace(/^label:/,'').replaceAll('-',' ');}
export function pokemonSetFinish(variant){
 const k=String(variant.key||'');if(!k.startsWith('detail:'))return k;
 const label=String(variant.label||'').trim();return label&&!label.startsWith('detail:')?'label:'+label:'';
}
export function setVariantKey(card,finish){
 if(!finish)return '';const matches=pokemonVariantChoices(card).filter(v=>pokemonSetFinish(v)===finish);
 return matches.length===1?matches[0].key:'';
}
export function setCardFields(card, game) {
 const context=card.setContext,printings=context?.printings||[],single=context?.printing||(!context?.printingAmbiguous&&printings.length===1?printings[0]:null);
 return { set:game==='mtg'?card.set_name||card.set||'':game==='ptcg'?card.set?.name||card.set?.id||'':context?.name||'',
  number:game==='mtg'?card.collector_number||'':game==='ptcg'?card.set?.number||'':values(printings.map(p=>String(p.code||'').split('-').slice(1).join('-'))).length===1?String(printings[0]?.code||'').split('-').slice(1).join('-'):'',
  numbers:values(game==='ygo'?printings.map(p=>p.code):[game==='mtg'?card.collector_number:card.set?.number]),
  rarities:values(game==='ygo'?(single?[single.rarity]:printings.map(p=>p.rarity)).map(ygoRarity):[card.rarity]),
  finishes:values(game==='mtg'?card.finishes||[]:game==='ptcg'?pokemonVariantChoices(card).map(pokemonSetFinish):printings.map(p=>p.finish)),
  price:game==='ygo'&&card.setBrowseReference?card.setBrowseReference.low:context?context.price:card.prices?.usd??null };
}
// Only offer facets that the actual returned cards can substantiate.
export function setCardFacets(cards, game) {
 const rows=cards.map(c=>setCardFields(c,game));
 return {sets:values(rows.map(r=>r.set)),numbers:values(rows.flatMap(r=>r.numbers)),rarities:values(rows.flatMap(r=>r.rarities)),finishes:values(rows.flatMap(r=>r.finishes))};
}
export function filterSortSetCards(cards, game, {q='',set='',rarity='',finish='',sort='number'}={}) {
 const query=String(q).trim().toLocaleLowerCase(),rows=cards.map(card=>({card,fields:setCardFields(card,game)})).filter(({card,fields:f})=>(!query||[card.name,f.number,...f.numbers].some(x=>String(x||'').toLocaleLowerCase().includes(query)))&&(!set||f.set===set)&&(!rarity||rarity==='all'||f.rarities.includes(rarity))&&(!finish||finish==='all'||f.finishes.includes(finish)));
 const text=(a,b)=>String(a||'').localeCompare(String(b||''),undefined,{numeric:true,sensitivity:'base'});
 const knownFirst=(a,b)=>!a&&!b?0:!a?1:!b?-1:text(a,b);
 rows.sort((a,b)=>{let cmp=0;switch(sort){case 'name':cmp=text(a.card.name,b.card.name);break;case 'price':cmp=(Number.isFinite(Number(b.fields.price))&&b.fields.price!==null?Number(b.fields.price):-1)-(Number.isFinite(Number(a.fields.price))&&a.fields.price!==null?Number(a.fields.price):-1);break;case 'set':cmp=knownFirst(a.fields.set,b.fields.set);break;case 'rarity':cmp=knownFirst(a.fields.rarities.join(' · '),b.fields.rarities.join(' · '));break;case 'finish':cmp=knownFirst(a.fields.finishes.join(' · '),b.fields.finishes.join(' · '));break;default:cmp=knownFirst(a.fields.number,b.fields.number);}
  return cmp||knownFirst(a.fields.number,b.fields.number)||text(a.card.name,b.card.name)||text(a.card.id,b.card.id);});return rows.map(x=>x.card);
}
// A previous measurement is optional. Only a real ownership change animates, never page entry,
// catalogue hydration or an unrelated rerender. An unknown unique total has no percentage bar.
export function setProgressMarkup({key,owned=0,total=null,loaded=0,complete=false,previous=null,compact=false,known=loaded}) {
 total=knownSetCount(total);owned=Math.max(0,Math.floor(Number(owned)||0));loaded=Math.max(0,Math.floor(Number(loaded)||0));
 // Contradictory cached totals are not a trustworthy denominator, even in text.
 if(total!==null&&(owned>total||loaded>total||Number(known)>total)){total=null;complete=false;}
 const ratio=total?Math.min(1,owned/total):null,snapshot={key,owned,total},changed=ratio!==null&&previous?.key===key&&previous.total===total&&previous.owned!==owned;
 const label=total?`${owned.toLocaleString()} of ${total.toLocaleString()} unique cards`:`${owned.toLocaleString()} verified ${owned===1?'card':'cards'} owned`,percent=ratio===null?'':`${Math.round(ratio*100)}%`,coverage=complete?'Your collection, one unique card at a time.':`${loaded.toLocaleString()} unique cards loaded${total?` of ${total.toLocaleString()}`:''}. ${total?'Progress counts verified ownership only; catalogue coverage is incomplete.':'The unique-card total is not verified, so no completion percentage is shown.'}`;
 const from=changed?Math.min(1,Math.max(0,previous.owned/total)):ratio;
 if(compact)return {snapshot,html:`<span class="set-tile-progress" aria-label="Set collection progress"><span class="set-tile-progress-label"><span>${esc(total?`${owned.toLocaleString()} / ${total.toLocaleString()} unique cards owned`:`${owned.toLocaleString()} verified ${owned===1?'card':'cards'} owned`)}</span>${percent?`<b>${percent}</b>`:''}</span>${ratio!==null?`<span class="set-progress-track" role="progressbar" aria-label="Verified unique cards owned" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(total,owned)}" aria-valuetext="${esc(label)}${complete?'':' · verified ownership only'}"><span style="transform:scaleX(${ratio})"></span></span>`:''}${ratio===null?'<small>Unique total unverified</small>':''}</span>`};
 return {snapshot,html:`<section class="set-collection-progress${changed?' progress-changed':''}" aria-label="Set collection progress"><div class="set-progress-top"><div><span class="eyebrow">Your collection</span><p>${esc(label)}</p></div>${percent?`<strong>${percent}</strong>`:''}</div>${ratio!==null?`<div class="set-progress-track" role="progressbar" aria-label="Verified unique cards owned" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(total,owned)}" aria-valuetext="${esc(label)}${complete?'':' · incomplete catalogue coverage'}"><span style="--progress-from:${from};--progress-to:${ratio};transform:scaleX(${ratio})"></span></div>`:''}${complete?'':`<p class="set-progress-caption">${esc(coverage)}</p>`}</section>`};
}
