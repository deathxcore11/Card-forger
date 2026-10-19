import {pokemonVariantChoices} from './pokemon-variant-options.js';
// A read-only, context-local printing browser. Providers and selection callbacks are
// injected: this module never writes collection, default-price or Search state.
import {printingCarouselHTML,attachPrintingCarousel} from './printing-carousel.js';
import {esc,options,usd} from './ui.js';
import {artworkSources} from './artwork.js';
import {catalogueText,setCardFields} from './set-list-ui.js';
import {finishLabel,presentationQuote,priceAmount} from './pricing-presentation.js';
import {normalizeYgoSets,ygoSetPrintings} from './ygo.js';
import {productIdOf} from './mtg-tcgprice.js';
import {pokemonPrintedNameKey} from './pokemon-identity.js';

const text = value => String(value ?? '').normalize('NFC').trim();
const compare = (a,b) => text(a).localeCompare(text(b),undefined,{numeric:true,sensitivity:'base'});
const unique = values => [...new Set(values.filter(value=>value!==''&&value!==null&&value!==undefined))];
const editionLabels = {'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited',unknown:'Edition not specified'};
const editionKey = value => ({'1stedition':'1st-edition',unlimited:'unlimited',limited:'limited'}[text(value).toLowerCase().replace(/[^a-z0-9]/g,'')]||'');
const asKey = parts => JSON.stringify(parts.map(value=>String(value??'')));
const knownFirst = (a,b) => !a&&!b?0:!a?1:!b?-1:compare(a,b);
const safeImage = value => typeof value==='string' && /^(https?:\/\/|img\/)/.test(value) ? value : '';

// Do not strip suffixes, punctuation or accents: Pikachu, Pikachu ex, Pikachu-EX,
// Pikachu GX and Flying Pikachu are not the same printed card name.
export const printingNameKey = value => text(value).replace(/\s+/g,' ').toLocaleLowerCase();
export function samePrintingFamily(game,source,card) {
 if(!source?.id||!card?.id||(source.game&&source.game!==game)||(card.game&&card.game!==game))return false;
 if(game==='mtg')return !!source.oracle_id&&source.oracle_id===card.oracle_id&&(!card.games||card.games.includes('paper'));
 if(game==='ygo')return String(source.id)===String(card.id);
 return game==='ptcg'&&!card.pocket&&pokemonPrintedNameKey(source.name)===pokemonPrintedNameKey(card.name);
}

const emptyFilters = () => ({set:'',number:'',rarity:'',finish:'',edition:'',price:'',sort:'best'});
const isExactProjection = (game,card,release) => card?.setContext?.status==='resolved'&&card.setContext.releaseId===release?.id&&(!card.setContext.game||card.setContext.game===game)&&(!card.setContext.cardId||String(card.setContext.cardId)===String(card.id));
const rowBase = (game,card,release,projected=card) => {
 const fields=setCardFields(projected,game);
 return {game,card,projectedCard:projected,cardId:String(card.id),name:card.name,releaseId:release?.id||'',setName:catalogueText(release?.name||fields.set||'Set unavailable'),date:game==='ygo'?release?.date||'':release?.date||card.released_at||card.released||'',number:String(fields.number||''),total:game==='ptcg'?String(card.set?.total||''):'',best:0,rarity:card.rarity||'',finish:'',variantKey:'',productId:null,printingKey:'',printing:null,edition:'',price:null,priceKind:'market',selectable:true,warning:'',artLabel:'Reference art',image:artworkSources(card)[0]||''};
};
const withKey = row => ({...row,key:asKey([row.game,row.cardId,row.releaseId||row.setName,row.number,row.rarity,row.finish,row.variantKey,row.productId,row.printingKey,row.edition])});
function quoteRow(row) {
 const quote=presentationQuote(row.game,row.projectedCard,row.finish||'reference',row.printingKey,row.edition);
 return {...row,price:row.selectable?priceAmount(quote?.value):null,priceKind:quote?.kind||'market'};
}

// Return one explicit supported version per row. Unknown versions remain visible;
// a reference row never secretly chooses a finish or edition.
export function printingRows(game,cards,{source,catalogue=[],projectCard}={}) {
 const out=[];
 const releases=game==='ygo'?normalizeYgoSets(catalogue):catalogue;
 for(const card of cards||[]) {
  if(!samePrintingFamily(game,source,card))continue;
  if(game==='mtg') {
   const release={id:card.set||'',name:card.set_name||card.set||'',date:card.released_at||''};
   const finishes=unique((card.finishes||[]).filter(f=>['nonfoil','foil','etched'].includes(f)));
   for(const finish of finishes.length?finishes:['']) {
    let row={...rowBase(game,card,release),finish,finishName:finish?finishLabel(finish):'Finish not specified',productId:finish==='etched'&&!card.tcgplayer_etched_id?null:finish?productIdOf(card,finish):null,artLabel:'Printing artwork · finish is not shown'};
    row=finish?quoteRow(row):{...row,selectable:false,warning:'This source has not confirmed a supported finish.'};
    out.push(withKey(row));
   }
  } else if(game==='ptcg') {
   const release=catalogue.find(s=>s.id===card.set?.id)||{id:card.set?.id||'',name:card.set?.name||'',date:card.released||''};
   const variants=pokemonVariantChoices(card).filter(v=>text(v.key));
   const counts=new Map();for(const v of variants)counts.set(v.key,(counts.get(v.key)||0)+1);
   for(const variant of variants.length?variants:[null]) {
    const finish=variant?.key||'reference',projected=projectCard?projectCard(card,release,{variantKey:finish}):card;
    const exact=!!release.id&&(!projectCard||isExactProjection(game,projected,release));
    let row={...rowBase(game,card,release,projected),finish,variantKey:variant?.key||'',finishName:variant?.label||'Version not specified',productId:variant?.productId??null,
     selectable:exact&&(!variant||counts.get(variant.key)===1),artLabel:variant?.image?'Variant image':'Reference art · finish/stamp may differ',image:safeImage(variant?.image)||artworkSources(card)[0]||''};
    if(!row.selectable)row.warning=exact?'The source lists conflicting records for this version.':'This printing’s set is not verified.';
    row=quoteRow(row);if(!variant){row.price=null;row.warning='Version details unavailable. Open this card without selecting a finish.';}
    out.push(withKey(row));
   }
  } else if(game==='ygo') {
   const matched=new Set();
   for(const release of releases) {
    const members=ygoSetPrintings(card,release);if(!members.length)continue;
    for(const printing of members)matched.add(printing);
    // Use the existing Sets projection to quarantine old code-only price matches.
    const projected=projectCard?projectCard(card,release,{}):null;
    const exact=isExactProjection(game,projected,release);
    const printings=projected?.setContext?.printings||members;
    for(const printing of printings) {
     const printingKey=String(printing.code||'')+'::'+String(printing.rarity||'');
     const copies=printings.filter(p=>p.code===printing.code&&p.rarity===printing.rarity);
     const editions=unique((printing.quotes||[]).map(q=>editionKey(q.edition)));
     for(const edition of editions.length?editions:['']) {
      let row={...rowBase(game,card,release,projected||card),number:printing.code||'',rarity:printing.rarity||'',finish:'reference',finishName:'',printingKey,printing:{...printing},edition,productId:exact&&!printing.releasePriceAmbiguous?printing.productId??null:null,
       selectable:exact&&copies.length===1,artLabel:'Reference art · release/rarity/edition not pictured'};
      if(!row.selectable)row.warning=exact?'This number and rarity identify multiple source records.':'The source cannot distinguish this release’s date or identity.';
      else if(printing.releasePriceAmbiguous)row.warning='Price and product are unverified for this exact release.';
      row=quoteRow(row);
      // Unsupported edition names must not become a quote for an unspecified edition.
      if(!edition&&printing.quotes?.length)row.price=null;
      out.push(withKey(row));
     }
    }
   }
   for(const printing of card.sets||[])if(!matched.has(printing))out.push(withKey({...rowBase(game,card,null),setName:catalogueText(printing.name||'Release unavailable'),number:printing.code||'',rarity:printing.rarity||'',printingKey:(printing.code||'')+'::'+(printing.rarity||''),printing:{...printing},selectable:false,warning:'This release has not been verified against the set catalogue.'}));
  }
 }
 // Duplicate page rows cannot duplicate a selectable printing. Identity includes
 // variant/product/release/edition, so these are never merged merely by name/code.
 return [...new Map(out.map(row=>[row.key,{...row,best:String(row.cardId)===String(source?.id)?0:1}])).values()];
}

export function printingFacets(rows) {
 const pairs=(field,label=field)=>[...new Map(rows.filter(row=>row[field]).map(row=>[row[field],row[label]||row[field]])).entries()].sort((a,b)=>compare(a[1],b[1])||compare(a[0],b[0]));
 const sets=pairs('releaseId','setName');
 const labels=new Map();for(const [,label] of sets)labels.set(label,(labels.get(label)||0)+1);
 return {sets:sets.map(([id,label])=>[id,labels.get(label)>1?`${label} · ${rows.find(r=>r.releaseId===id)?.date||'date unavailable'}`:label]),rarities:pairs('rarity'),finishes:pairs('finish','finishName').filter(([id])=>id!=='reference'),editions:unique(rows.map(r=>r.edition||'unknown')).map(id=>[id,editionLabels[id]||id])};
}
// Match a leading collector-number prefix, normalizing numeric padding only.
// Meaningful letters remain intact; 88 must not match 188 or TG88.
const normalizedNumber=value=>String(value||'').trim().toLowerCase().replace(/\s/g,'').replace(/\d+/g,n=>String(Number(n)));
export function printingNumberMatches(row,query){
 const parts=String(query||'').trim().split('/');if(!parts[0])return !query;
 const numerator=normalizedNumber(row.number),wanted=normalizedNumber(parts[0]);
 if(parts.length===1)return numerator.startsWith(wanted);
 return parts.length===2&&numerator===wanted&&!!parts[1]&&normalizedNumber(row.total)===normalizedNumber(parts[1]);
}
export function filterPrintingRows(rows,filters={}) {
 const f={...emptyFilters(),...filters},number=text(f.number).toLocaleLowerCase();
 const visible=rows.filter(r=>(!f.set||r.releaseId===f.set)&&(!number||printingNumberMatches(r,number))&&(!f.rarity||r.rarity===f.rarity)&&(!f.finish||r.finish===f.finish)&&(!f.edition||(r.edition||'unknown')===f.edition)&&(!f.price||(f.price==='known'?r.price!==null:r.price===null)));
 return visible.sort((a,b)=>{
  let diff=0;
  switch(f.sort) {
   case 'best':diff=(a.best||0)-(b.best||0);break;
   case 'price-low':case 'price-high':diff=a.price===null&&b.price===null?0:a.price===null?1:b.price===null?-1:(a.price-b.price)*(f.sort==='price-high'?-1:1);break;
   case 'set':diff=knownFirst(a.setName,b.setName);break;
   case 'number':diff=knownFirst(a.number,b.number);break;
   case 'rarity':diff=knownFirst(a.rarity,b.rarity);break;
   case 'finish':diff=knownFirst(a.finishName,b.finishName);break;
   case 'old':diff=knownFirst(a.date,b.date);break;
   default:diff=!a.date&&!b.date?0:!a.date?1:!b.date?-1:compare(b.date,a.date);
  }
  return diff||knownFirst(a.setName,b.setName)||knownFirst(a.number,b.number)||compare(a.key,b.key);
 });
}
export function printingSelection(row) {
 if(!row?.selectable)return null;
 return {game:row.game,card:row.card,projectedCard:row.projectedCard,cardId:row.cardId,releaseId:row.releaseId,finish:row.finish,variantKey:row.variantKey,productId:row.productId,printingKey:row.printingKey,printing:row.printing,edition:row.edition};
}

const control=(id,label,field,items,current)=>`<label class="field" for="${id}">${label}<select id="${id}" data-change="printingPickerFilter" data-field="${field}">${options(items,current)}</select></label>`;
export function printingPickerHTML(state) {
 const {game,card,rows,filters,busy,error,nextCursor,complete,loaded,note,view}=state;
 const visible=filterPrintingRows(rows,filters),facets=printingFacets(rows);
 if(view==='carousel')return printingCarouselHTML(state,visible,facets);
 const active=Object.entries(filters).filter(([key,value])=>key!=='sort'&&value).length;
 const priceNote=filters.sort.startsWith('price')?'Prices are source reference quotes, not condition-adjusted values. Unknown prices stay last.':'Filters and sorting apply to loaded versions only.';
 const coverage=busy?'Loading matching printings…':!loaded?'No results loaded yet.':nextCursor!==null?'More source results are available.':complete?'All matching results returned by the source are loaded.':'Source coverage is incomplete or unverified.';
 return `<section class="printing-picker" data-game="${game}" aria-labelledby="printingPickerTitle"><div class="sheet-head"><button class="icon" data-act="printingPickerBack" data-history-back="1" aria-label="Back to previous card">←</button><h2 id="printingPickerTitle" tabindex="-1">Find a printing</h2><button class="btn ghost small" data-act="printingPickerCancel">Cancel</button></div>
 <p class="printing-picker-name">${esc(card.name)}</p><p class="muted small">${game==='mtg'?'Same Oracle card, across paper printings.':game==='ptcg'?'Exact printed name only. ex, EX, GX and other name variants stay separate.':'Same card, with release, printed code, rarity and edition kept separate.'} ${state.purpose==='scan'?'Choose for this queued capture, then review before saving. Nothing is added automatically.':'Choosing only changes the card detail you are viewing.'}</p>
 <details class="group printing-picker-filters" data-disclosure-id="printing-picker-filters" ${state.filtersOpen?'open':''}><summary>Filters${active?` · ${active} on`:''}</summary><div class="printing-picker-controls">
 ${control('printingPickerSet','Set / release','set',[['','All loaded releases'],...facets.sets],filters.set)}
 <label class="field" for="printingPickerNumber">${game==='ygo'?'Printed code':'Collector number'}<input id="printingPickerNumber" type="search" autocomplete="off" value="${esc(filters.number)}" data-input="printingPickerNumber" placeholder="${game==='ygo'?'e.g. LOB-EN001':'e.g. 025'}"></label>
 ${control('printingPickerRarity','Rarity','rarity',[['','All rarities'],...facets.rarities],filters.rarity)}
 ${game==='ygo'?control('printingPickerEdition','Edition','edition',[['','All editions'],...facets.editions],filters.edition):control('printingPickerFinish',game==='mtg'?'Finish':'Version / finish','finish',[['','All supported versions'],...facets.finishes],filters.finish)}
 ${control('printingPickerPrice','Price availability','price',[['','Include unknown prices'],['known','With a reference price'],['unknown','Price unavailable']],filters.price)}
 <button class="btn ghost small" data-act="printingPickerClear" ${active?'':'disabled'}>Clear filters</button></div></details>
 <div class="printing-picker-toolbar">${control('printingPickerSort','Sort loaded versions','sort',[['best','Best match'],['new','Newest release'],['old','Oldest release'],['set','Set / release'],['number',game==='ygo'?'Printed code':'Collector number'],['rarity','Rarity · A to Z'],...(game==='ygo'?[]:[['finish',game==='mtg'?'Finish':'Version']]),['price-low','Price: low to high · loaded'],['price-high','Price: high to low · loaded']],filters.sort)}<div class="seg printing-picker-view" role="group" aria-label="Printing layout"><button data-act="printingPickerView" data-id="carousel">Carousel</button><button data-act="printingPickerView" data-id="grid" aria-pressed="${view==='grid'}" class="${view==='grid'?'on':''}">Grid</button><button data-act="printingPickerView" data-id="list" aria-pressed="${view==='list'}" class="${view==='list'?'on':''}">List</button></div></div>
 <div class="printing-picker-status" tabindex="-1" role="status" aria-live="polite"><p>${visible.length} versions shown · ${rows.length} loaded${rows.length?` · ${rows.filter(r=>r.price===null).length} without prices`:''}</p><p class="muted small">${coverage}${note?' '+esc(note):''}</p></div><p class="foot">${priceNote}</p>
 ${error?`<div class="note warn" role="alert">${esc(error)} <button class="link" data-act="printingPickerRetry">Retry</button></div>`:''}
 <div class="printing-picker-results printing-picker-${view}" aria-label="Matching printings" aria-busy="${busy}">${visible.map(row=>`<button class="printing-picker-choice" data-act="printingPickerChoose" data-key="${esc(row.key)}" data-card-id="${esc(row.cardId)}" data-release-id="${esc(row.releaseId)}" data-variant="${esc(row.variantKey)}" data-printing="${esc(row.printingKey)}" data-edition="${esc(row.edition)}" ${row.selectable?'':'disabled'} aria-label="${esc([row.setName,row.number,row.rarity,row.finishName,game==='ygo'?editionLabels[row.edition||'unknown']:'',row.price===null?'Price unavailable':usd(row.price),row.warning].filter(Boolean).join(' · '))}"><span class="printing-picker-art">${safeImage(row.image)?`<img src="${esc(row.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="muted small">Image unavailable</span>'}<small>${esc(row.artLabel)}</small></span><span class="printing-picker-copy"><b>${esc(row.setName)}</b><span>${esc([row.number&&'#'+row.number,row.rarity].filter(Boolean).join(' · '))}</span><span>${esc(game==='ygo'?editionLabels[row.edition||'unknown']:row.finishName)}</span><small class="muted">${esc(row.date||'Release date unavailable')}</small><strong>${row.price===null?'Price unavailable':usd(row.price)+(row.priceKind==='market'?' reference':' '+esc(row.priceKind)+' reference')}</strong>${row.warning?`<small class="printing-picker-warning">${esc(row.warning)}</small>`:''}<small>${row.selectable?(state.purpose==='scan'?'Use this printing':'View this printing'):'Selection unavailable'}</small></span></button>`).join('')}</div>
 ${!visible.length&&!busy?`<p class="note">${rows.length?'No loaded versions match these filters. Clear filters'+(nextCursor!==null?' or load more results.':'.'):'No verified matching versions are available yet.'}</p>`:''}
 ${nextCursor!==null?`<button class="btn block" data-act="printingPickerMore" ${busy?'disabled':''}>${busy?'Loading…':'Load more matching printings'}</button>`:''}
 ${loaded&&!complete&&nextCursor===null&&!busy&&!error?'<button class="btn ghost block" data-act="printingPickerRetry">Reload matching printings</button>':''}
 <p class="foot">Catalogue completeness is not independently verified. Reference art does not prove foil, stamp or edition. No collection or default-price settings are changed.</p></section>`;
}

/**
 * loadPage({cursor, signal}) -> {cards,catalogue?,nextCursor,complete,total?,note?}
 * projectCard(card,release,{variantKey}) reuses the app's existing Sets projection.
 * back() restores the existing sheet snapshot. onSelect runs only after that restore.
 */
export function createPrintingPicker({A={},C={},I={},openSheet,getContext,getBody=()=>null,back}) {
 let state=null,serial=0;
 const current=s=>state===s&&getContext?.()===s.context;
 const capture=()=>{const body=getBody(),active=globalThis.document?.activeElement;return {scroll:body?.scrollTop||0,id:body?.contains?.(active)?active?.id:'',key:body?.contains?.(active)?active?.dataset?.key:'',act:body?.contains?.(active)?active?.dataset?.act:'',actionId:active?.dataset?.id,start:active?.selectionStart,end:active?.selectionEnd,filtersOpen:body?.querySelector?.('.printing-picker-filters')?.open};};
 const draw=(s,initial=false)=>{
  if(!initial&&!current(s))return;
  const saved=initial?{scroll:0}:capture();if(saved.filtersOpen!==undefined)s.filtersOpen=saved.filtersOpen;
  s.carouselObserver?.disconnect();
  openSheet(printingPickerHTML(s),s.context,saved.scroll);
  attachPrintingCarousel(getBody(),s,{step:delta=>s.moveCarousel?.(delta),nearEnd:()=>{if(current(s)&&!s.busy&&!s.error&&s.nextCursor!==null)void load(s);}});
  const body=getBody();let focus=initial?body?.querySelector?.('#printingPickerTitle'):saved.id?body?.querySelector?.('#'+saved.id):null;
  if(!focus&&(saved.key||saved.act))focus=[...(body?.querySelectorAll?.('[data-act]')||[])].find(node=>saved.key?node.dataset.key===saved.key:node.dataset.act===saved.act&&(saved.actionId===undefined||node.dataset.id===saved.actionId));
  if(!initial&&(focus?.disabled||!focus&&(saved.id||saved.key||saved.act)))focus=body?.querySelector?.('.printing-picker-status');
  focus?.focus?.({preventScroll:true});if(Number.isInteger(saved.start))try{focus?.setSelectionRange?.(saved.start,saved.end);}catch{}
 };
 const rebuild=s=>{s.rows=printingRows(s.game,s.cards,{source:s.card,catalogue:s.catalogue,projectCard:s.projectCard});};
 async function load(s=state) {
  if(!s||!current(s)||s.busy||(s.loaded&&s.nextCursor===null))return;
  const request=++s.request,cursor=s.loaded?s.nextCursor:null,cursorKey=asKey([typeof cursor,typeof cursor==='object'?JSON.stringify(cursor):cursor]);
  s.busy=true;s.error='';draw(s);
  try {
   const page=await s.loadPage({cursor,signal:s.abort.signal});
   if(!current(s)||request!==s.request||s.abort.signal.aborted)return;
   if(!page||!Array.isArray(page.cards))throw Error('The source returned an invalid printing page.');
   const cards=new Map(s.cards.map(card=>[String(card.id),card]));
   for(const card of page.cards)if(samePrintingFamily(s.game,s.card,card)){const previous=cards.get(String(card.id));if(!card.brief||!previous||previous.brief)cards.set(String(card.id),card);}
   s.cards=[...cards.values()];if(Array.isArray(page.catalogue))s.catalogue=[...page.catalogue];
   s.visited.add(cursorKey);s.loaded=true;s.nextCursor=page.nextCursor??null;const pendingDetails=s.cards.filter(card=>card.brief).length;s.complete=page.complete===true&&s.nextCursor===null&&!pendingDetails;s.note=text(page.note);if(pendingDetails&&!/could not be loaded|unavailable|reload/i.test(s.note))s.note+=(s.note?' ':'')+`${pendingDetails} card details could not be loaded. Reload to retry.`;rebuild(s);
   const nextKey=asKey([typeof s.nextCursor,typeof s.nextCursor==='object'?JSON.stringify(s.nextCursor):s.nextCursor]);
   if(s.nextCursor!==null&&s.visited.has(nextKey)) {s.nextCursor=null;s.complete=false;s.restartRequired=true;throw Error('The source repeated a printing page. Loaded versions are kept; retry restarts the lookup.');}
  } catch(error) {
   if(!current(s)||request!==s.request||s.abort.signal.aborted)return;
   s.error=error?.message||'Could not load matching printings.';s.complete=false;
  } finally {if(current(s)&&request===s.request){s.busy=false;draw(s);if(s.view==='carousel'&&s.nextCursor!==null&&!s.error)queueMicrotask(()=>load(s));}}
 }
 function abandon() {if(!state)return false;state.carouselObserver?.disconnect();state.abort.abort();state.request++;state=null;return true;}
 function cancel() {
  const s=state;if(!s||!current(s))return false;
  s.carouselObserver?.disconnect();s.abort.abort();s.request++;state=null;back?.();s.onCancel?.(s.parentContext);return true;
 }
 function choose(key) {
  const s=state;if(!s||!current(s))return false;
  const selection=printingSelection(s.rows.find(row=>row.key===key));if(!selection)return false;
  s.carouselObserver?.disconnect();s.abort.abort();s.request++;state=null;back?.();const result=s.onSelect?.(selection,s.parentContext);return result&&typeof result.then==='function'?result.then(()=>true):true;
 }
 function open(config) {
  if(!['mtg','ptcg','ygo'].includes(config?.game)||!config.card?.id||typeof config.loadPage!=='function')throw Error('A verified card and printing loader are required.');
  state?.abort.abort();
  state={...config,catalogue:[...(config.catalogue||[])],context:{type:'printing-picker',game:config.game,id:'picker-'+(++serial)},cards:[],rows:[],filters:emptyFilters(),filtersOpen:true,view:config.view||'carousel',activeGroup:'',versions:{},busy:false,error:'',loaded:false,nextCursor:null,complete:false,note:'',abort:new AbortController(),visited:new Set(),request:0,restartRequired:false};
  draw(state,true);return load(state);
 }
 A.printingPickerBack=A.printingPickerCancel=cancel;
 A.printingPickerChoose=t=>choose(t?.dataset?.key);
 A.printingPickerMore=()=>load();
 A.printingPickerStep=t=>state?.moveCarousel?.(Number(t.dataset.d)||0);
 A.printingPickerRemoveFilter=t=>{if(!state||!current(state)||!Object.hasOwn(state.filters,t.dataset.field))return;state.filters[t.dataset.field]='';draw(state);};
 C.printingPickerVariant=t=>{if(!state||!current(state))return;state.versions[t.dataset.group]=t.value;draw(state);};
 A.printingPickerRetry=()=>{if(state&&(state.restartRequired||state.loaded&&!state.complete&&state.nextCursor===null)){state.abort.abort();state.abort=new AbortController();state.cards=[];state.rows=[];state.loaded=false;state.nextCursor=null;state.visited.clear();state.restartRequired=false;}return load();};
 A.printingPickerClear=()=>{if(!state||!current(state))return;state.filters={...emptyFilters(),sort:state.filters.sort};draw(state);};
 A.printingPickerView=t=>{if(!state||!current(state))return;state.view=['list','carousel'].includes(t?.dataset?.id)?t.dataset.id:'grid';draw(state);};
 C.printingPickerFilter=t=>{if(!state||!current(state)||!Object.hasOwn(state.filters,t?.dataset?.field))return;state.filters[t.dataset.field]=String(t.value||'');state.activeGroup='';draw(state);if(state.view==='carousel'&&state.nextCursor!==null&&!state.busy&&!state.error)void load(state);};
 I.printingPickerNumber=t=>{if(!state||!current(state))return;state.filters.number=String(t.value||'');state.activeGroup='';draw(state);};
 return {open,cancel,abandon,choose,load,get state(){return state;}};
}
