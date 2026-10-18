// Presentation only: keep provider/condition resolution in the existing pricing modules.
import {esc,usd} from './ui.js';
import {tcgFallback,myPrice} from './mtg-tcgprice.js';
import {referenceQuote,referenceLabel} from './price-reference.js';
import {editionPrice} from './ygo-prices.js';
import {conditionName} from './condition-value.js';

export const priceAmount=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
export const finishLabel=f=>({nonfoil:'Regular',foil:'Foil',etched:'Etched foil',reference:'Reference quote'}[f]||f);
const dateText=v=>v&&Number.isFinite(Date.parse(v))?String(v).slice(0,10):'';
const editionNames={'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'};
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function supportedFinishes(game,c){
 if(game==='mtg')return ['nonfoil','foil','etched'].filter(f=>(c.finishes?.length?c.finishes:['nonfoil']).includes(f));
 return game==='ptcg'?['reference',...(c.variants||[]).map(v=>v.key)]:['reference'];
}
export function selectedFinish(game,c,wanted){
 const choices=supportedFinishes(game,c||{});wanted ||= c?.setContext?.variantKey;return choices.includes(wanted)?wanted:choices[0]||'reference';
}
const referenceValue=c=>Object.prototype.hasOwnProperty.call(c?.setContext||{},'referencePrice')?c.setContext.referencePrice:c?.prices?.usd;
function referenceVariant(c){
 const priced=(c.variants||[]).filter(v=>priceAmount(v.usd??v.market)!==null);
 const chosen=priced.find(v=>v.key==='normal')||priced[0];
 return chosen&&priceAmount(chosen.usd??chosen.market)===priceAmount(referenceValue(c))?chosen:null;
}
export function selectedPrinting(c,key){
 if(!key)return null;
 const hits=(c.setContext?.printings||c.sets||[]).filter(s=>s.code+'::'+s.rarity===key||s.code===key);
 return hits.length===1?hits[0]:null;
}
export function validSetContext(game,c,ctx={}) {
 const set=c?.setContext;
 if(c?.game && c.game!==game)return false;
 return (!set && !ctx.setReleaseUnverified && (!ctx.setId || game==='mtg' && String(c?.set||'').toLowerCase()===String(ctx.setId).toLowerCase())) || !!(set?.releaseId && set.status==='resolved' && (!set.game || set.game===game) && (!set.cardId || String(set.cardId)===String(c.id)) && (!ctx.setId || ctx.setId===set.releaseId));
}
const contextPrintingKey=c=>!c?.setContext?.printingAmbiguous&&c?.setContext?.printing?c.setContext.printing.code+'::'+c.setContext.printing.rarity:'';
// No personal prices, currency conversion or condition multipliers belong in a market quote.
export function presentationQuote(game,c,finish='reference',printingKey='',edition=''){
 if(!c?.id)return null;
 const context=c.setContext,verified=validSetContext(game,c);
 if(context && !printingKey)printingKey=contextPrintingKey(c);
 let value=null,source='TCGplayer reference',label='Reference quote · finish not specified',kind='market',observedAt='',scope='card',variant=null,printing=null;
 if(game==='mtg'){
  label=finishLabel(finish);scope='printing';source='Scryfall / TCGplayer';
  if(supportedFinishes(game,c).includes(finish)){
   value=priceAmount(c.prices?.[finish==='nonfoil'?'usd':'usd_'+finish]);
   if(value===null){const fallback=tcgFallback(c,finish);if(fallback){value=fallback.value;kind=fallback.kind;source='TCGplayer via TCGCSV';}}
  }
 }else if(game==='ptcg'){
  variant=finish==='reference'?referenceVariant(c):(c.variants||[]).find(v=>v.key===finish);
  value=finish==='reference'?priceAmount(referenceValue(c)):priceAmount(variant?.usd??variant?.market);
  if(variant){source=variant.productFallback?'TCGplayer market via TCGCSV':variant.fallback?'TCGplayer / Pokémon TCG API':'TCGplayer / TCGdex';label=variant.label||finish;kind=variant.priceKind||c.prices?.referenceKind||'market';observedAt=variant.historyQuote||'';scope='printing';}
  else if(finish!=='reference'){label=finish;scope='printing';}
  else {kind=c.prices?.referenceKind||'market';if(/dated quote/i.test(c.prices?.source||''))observedAt=c.prices?.updated||'';}
 }else{
  label=context?[context.name,'Printing and edition not specified'].filter(Boolean).join(' · '):'Reference card · printing and edition not specified';value=context||printingKey?null:priceAmount(c.prices?.usd);
  printing=verified?selectedPrinting(c,printingKey):null;
  if(printing){
   scope='printing';source=printing.priceSource||'TCGplayer printing reference';label=[printing.code,printing.rarity,editionNames[edition]||'Edition not specified'].join(' · ');
   if(edition){value=editionPrice(printing,edition);const q=(printing.quotes||[]).find(q=>norm(q.edition)===norm(editionNames[edition]));kind=referenceQuote(q)?.kind||'market';}
   // A provider having only one edition quote does not select that edition for the user.
   else if(printing.quotes?.length){value=null;}
   else {value=priceAmount(printing.price);kind=printing.priceKind||'market';}
  }
 }
 if(!verified){value=null;variant=null;printing=null;label='Selected release is not verified';}
 const editions=game==='ygo'&&verified?[...new Map((context?.printings||c.sets||[]).map(s=>[s.code+'::'+s.rarity,{code:s.code,rarity:s.rarity,key:s.code+'::'+s.rarity,label:[s.code,s.rarity,s.name].filter(Boolean).join(' · ')}])).values()]:[];
 const fallbackMtg=game==='mtg'&&source==='TCGplayer via TCGCSV';
 const checkedAt=fallbackMtg?null:printing?.checkedAt||c.checkedAt||c.fetchedAt||null,sourceUpdatedAt=fallbackMtg?null:printing?null:c.prices?.updated||null;
 const key=[game,c.id,...(context?[context.releaseId]:[]),source,'USD',finish,...(printing?[printing.code,printing.rarity,edition]:[])].join('|');
 return {releaseId:context?.releaseId||'',selectionVerified:verified,edition:printing?.code||'',rarity:printing?.rarity||'',editionKey:printing?printing.code+'::'+printing.rarity:'',selectedEdition:edition,editions,key,name:c.name,game,cardId:c.id,source,currency:'USD',finish,label,value,kind,scope,variant,printing,checkedAt,sourceUpdatedAt,observedAt,asOf:observedAt||sourceUpdatedAt||checkedAt,cardReferenceValue:context?null:priceAmount(c.prices?.usd)};
}
// UI selectors and the projected card must refer to the same release.
export function quoteForContext(game,card,ctx={}) {
 const quote=presentationQuote(game,card,selectedFinish(game,card,ctx.priceFinish||ctx.finish),ctx.priceEdition||ctx.edition||card.displayPrintingKey,ctx.priceYgoEdition||ctx.ygoEdition||card.displayEdition);
 return !quote || validSetContext(game,card,ctx) ? quote : {...quote,value:null,printing:null,variant:null,selectionVerified:false,label:'Selected release does not match this card'};
}
export function priceSelectionState(quote){
 if(!quote||quote.selectionVerified===false)return 'unverified';
 if(quote.game==='ygo'&&!quote.printing)return 'printing-required';
 if(quote.game==='ygo'&&quote.printing&&!Object.hasOwn(editionNames,quote.selectedEdition))return 'edition-required';
 return 'selected';
}
export const quoteIsStale=(q,now=Date.now())=>{const date=q?.observedAt||q?.sourceUpdatedAt||q?.checkedAt;return !!date&&Number.isFinite(Date.parse(date))&&now-Date.parse(date)>3*864e5;};
// A saved condition value may be shown only beside the same game/card/version.
export function matchingLot(game,card,ctx,state){
 const id=ctx.entryId||ctx.entry,rows=game==='mtg'?state.collection:state.tcg?.[game]?.collection||[],lot=rows.find(e=>e.id===id);
 if(!lot||!card?.id||!validSetContext(game,card,ctx))return null;
 if(game==='ygo' && card.setContext && lot.setReleaseId!==card.setContext.releaseId)return null;
 const finish=selectedFinish(game,card,ctx.priceFinish||ctx.finish);
 if(game==='mtg')return lot.printingVerified&&lot.printingId===card.id&&(lot.finish||'nonfoil')===finish?lot:null;
 if(String(lot.cardId)!==String(card.id))return null;
 if(game==='ptcg'){const variant=finish==='reference'?referenceVariant(card)?.key:finish;return (lot.variant||'reference')===(variant||'reference')?lot:null;}
 const print=selectedPrinting(card,ctx.priceEdition||ctx.edition||contextPrintingKey(card));
 return print&&lot.printing===print.code&&lot.rarity===print.rarity&&(lot.edition||'')===(ctx.priceYgoEdition||ctx.ygoEdition||'')?lot:null;
}
export function quoteTiming(q){
 if(!q)return '';
 const observed=dateText(q.observedAt),updated=dateText(q.sourceUpdatedAt),checked=dateText(q.checkedAt);
 return [observed?'Last observed '+observed:updated?'Source updated '+updated:'Source date unavailable',checked?'Checked '+checked:'',quoteIsStale(q)?'Stale reference':''].filter(Boolean).join(' · ');
}
export function buyContext(game,card,ctx,state){
 const lot=matchingLot(game,card,ctx,state);
 return lot?{...ctx,condition:lot.condition,language:lot.language}:ctx;
}
const currencyValue=(value,currency)=>value===null?'Check price':currency==='EUR'?'€'+value.toFixed(2):currency==='TIX'?value.toFixed(2)+' tix':usd(value);
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const sellerNames={tcgplayer:'TCGplayer',cardmarket:'Cardmarket',cardhoarder:'Cardhoarder',cardkingdom:'Card Kingdom',ebay:'eBay'};
const vendorKey=(_name,url)=>{
 const safe=safeURL(url);if(!safe)return 'invalid';
 const host=new URL(safe).hostname.toLowerCase();
 for(const [key,domain] of [['tcgplayer','tcgplayer.com'],['cardmarket','cardmarket.com'],['cardhoarder','cardhoarder.com'],['cardkingdom','cardkingdom.com'],['ebay','ebay.com']])if(host===domain||host.endsWith('.'+domain))return key;
 return host==='ygoprodeck.com'||host.endsWith('.ygoprodeck.com')?'research':'other:'+host;
};
const productURL=id=>/^[1-9]\d*$/.test(String(id||''))&&Number.isSafeInteger(Number(id))?`https://www.tcgplayer.com/product/${id}`:'';
// Retailer links authenticate their host and product path before using a legacy URL ID.
// Never promote an arbitrary URL's /product/N text into a trusted exact listing.
const magicSellerProduct=(c,finish)=>{
 if(finish==='etched')return c.tcgplayer_etched_id;
 if(c.tcgplayer_id)return c.tcgplayer_id;
 const url=safeURL(c.purchase_uris?.tcgplayer);
 return url&&vendorKey('',url)==='tcgplayer'?new URL(url).pathname.match(/^\/product\/([1-9]\d*)(?:\/|$)/)?.[1]:null;
};
const searchURL=(game,c)=>`https://www.tcgplayer.com/search/${{mtg:'magic',ptcg:'pokemon',ygo:'yugioh'}[game]}/product?q=${encodeURIComponent([c.name,c.collector_number||c.set?.number||''].filter(Boolean).join(' '))}`;
function filteredProductURL(url,game,c,ctx,q,finish){
 const u=new URL(url),lang=ctx.language||c.lang||c.language||'en';
 const languages={en:'English',ja:'Japanese',de:'German',fr:'French',es:'Spanish',it:'Italian',pt:'Portuguese',ko:'Korean',zh:'Chinese'};
 const language=languages[String(lang).toLowerCase()]||Object.values(languages).find(v=>v.toLowerCase()===String(lang).toLowerCase());
 let printing=game==='mtg'?{nonfoil:'Normal',foil:'Foil',etched:'Etched Foil'}[finish]:game==='ygo'?editionNames[q.selectedEdition]:'';
 if(game==='ptcg'){
  const v=q.variant,physical=v?.key?.startsWith('detail:')?v.finish:v?.key;
  printing={normal:'Normal',nonfoil:'Normal',holo:'Holofoil',holofoil:'Holofoil',reverse:'Reverse Holofoil','reverse-holofoil':'Reverse Holofoil','1st-edition':'1st Edition','1st-edition-holofoil':'1st Edition Holofoil',unlimited:'Unlimited','unlimited-holofoil':'Unlimited Holofoil'}[physical]||'';
  if(!printing&&v?.productFallback&&/^(?:1st Edition|Unlimited) (?:Holofoil|Normal)$/.test(v.label||''))printing=v.label;
  if(v?.key?.startsWith('detail:')&&v.stamps?.includes('1st-edition')&&printing)printing='1st Edition '+printing;
  else if(v?.key?.startsWith('detail:')&&['unlimited','shadowless'].includes(v.subtype)&&printing)printing='Unlimited '+printing;
 }
 if(language)u.searchParams.set('Language',language);
 if(printing)u.searchParams.set('Printing',printing);
 if(ctx.condition&&conditionName(ctx.condition)!=='Unknown condition')u.searchParams.set('Condition',conditionName(ctx.condition));
 return u.href;
}
export function conditionBuyLink(game,c,entry={}){
 if(!c)return null;
 if(game==='ptcg'&&(!entry.variant||entry.variant==='reference'))return null;
 if(game==='ygo'&&(!entry.printing||!entry.rarity||!editionNames[entry.edition]))return null;
 if(game==='mtg'&&entry.printingId&&entry.printingId!==c.id)return null;
 return sellerModels(game,c,{priceFinish:game==='ptcg'?entry.variant:entry.finish,priceEdition:game==='ygo'?[entry.printing,entry.rarity].join('::'):'',priceYgoEdition:entry.edition,condition:entry.condition,language:entry.language}).find(r=>r.key==='tcgplayer');
}
export function sellerModels(game,c,ctx={},links=[]){
 const wanted=ctx.priceFinish||ctx.finish||c.setContext?.variantKey,finish=selectedFinish(game,c,wanted),q=quoteForContext(game,c,ctx);
 const candidates=[...links];if(!candidates.some(([n,u])=>vendorKey(n,u)==='tcgplayer'))candidates.unshift(['TCGplayer',searchURL(game,c)]);
 const seen=new Set(),rows=[];
 for(const [name,rawURL] of candidates){
  const key=vendorKey(name,rawURL);if(key==='research'||seen.has(key))continue;
  let url=safeURL(rawURL);if(!url)continue;seen.add(key);
  let value=null,currency='USD',kind='market',scope='',direct=false,source='',observedAt='',sourceUpdatedAt=q?.sourceUpdatedAt,checkedAt=q?.checkedAt;
  if(key==='tcgplayer'){
   const supported=!wanted||supportedFinishes(game,c).includes(wanted),variants=c.variants||[],contextVariant=c.setContext?.variantKey;
   // A projected invalid/ambiguous finish must not silently become Reference/Normal.
   // A reference price is not a product identity when multiple variants share it.
   const uniqueVariant=game!=='ptcg'||!!q?.variant&&!c.setContext?.printingAmbiguous&&(!contextVariant||contextVariant===finish)&&variants.filter(v=>v.key===q.variant.key).length===1&&(finish!=='reference'||variants.filter(v=>priceAmount(v.usd??v.market)!==null&&priceAmount(v.usd??v.market)===q.value).length===1);
   const pid=!q?.selectionVerified||!supported||!uniqueVariant?null:game==='mtg'?magicSellerProduct(c,finish):game==='ptcg'?q.variant.productId:q?.printing?.productId;
   // A finish change must not retain another variant's product link.
   url=productURL(pid)||searchURL(game,c);direct=!!productURL(pid);
   if(direct){url=filteredProductURL(url,game,c,ctx,q,finish);value=q?.value??null;kind=q?.kind||'market';scope=q?.label||'';source=q?.source||'';observedAt=q?.observedAt||'';}
  }else if(key==='cardmarket'){
   currency='EUR';source='Cardmarket';
   if(q?.selectionVerified&&game==='mtg'&&finish!=='etched'){
    direct=safeURL(c.purchase_uris?.cardmarket)===url&&(/\/Products\/Singles\//i.test(url)||/[?&]idProduct=\d+(?:&|$)/.test(url));
    if(direct){value=priceAmount(c.prices?.[finish==='foil'?'eur_foil':'eur']);scope=finishLabel(finish);}
   }else if(q?.selectionVerified&&game==='ptcg'){
    const cm=q?.variant?.cmProduct||(q?.variant?.key==='normal'?c.cmProduct:null);
    if(cm&&/^\d+$/.test(String(cm))){
     url=`https://www.cardmarket.com/en/Pokemon/Products?idProduct=${cm}`;direct=true;scope=q.variant.label||'Normal';
     // Base EUR statistics belong to the base Cardmarket product, not every Normal variant.
     if(q.variant.key==='normal'&&c.cmProduct&&String(cm)===String(c.cmProduct))value=priceAmount(c.cardmarket?.trend??c.cardmarket?.avg);
    }
    else {url=`https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(c.name)}`;}
   }
   if(!direct&&game==='mtg')url=`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(c.name)}`;
  }else if(key==='cardhoarder'&&game==='mtg'&&q?.selectionVerified){
   currency='TIX';direct=safeURL(c.purchase_uris?.cardhoarder)===url&&/\/cards\/\d+(?:[/?#]|$)/.test(url);source='Scryfall / Cardhoarder';scope='Magic Online · not a paper card';if(finish==='nonfoil'&&direct)value=priceAmount(c.prices?.tix);
  }
  rows.push({key,name:sellerNames[key]||(Object.keys(sellerNames).some(k=>norm(name).startsWith(k))?new URL(url).hostname:name),url,direct,value,currency,kind,scope,source,observedAt,sourceUpdatedAt,checkedAt});
 }
 return rows;
}
export function sellerRows(game,c,ctx={},links=[]){
 const rows=sellerModels(game,c,ctx,links);
 return `<section class="market-sellers" id="card-sellers" tabindex="-1" aria-labelledby="card-sellers-title"><div class="market-section-head"><h3 id="card-sellers-title">Find sellers</h3><span class="small muted">Prices & buying</span></div><p class="foot">Provider references, not live stock offers. Confirm finish, condition and shipping at the store.</p><div class="vendor-list">${rows.map(r=>`<a class="vendor-row" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(r.name+' · '+currencyValue(r.value,r.currency)+' · '+(r.direct?'View listing':'Search store'))}"><span class="vendor-copy"><b>${esc(r.name)}</b><small>${esc(r.direct?r.scope||'Product listing · check exact finish':'Search · choose your printing and finish')}</small>${r.value!==null?`<small class="vendor-provenance">${esc(r.source)} · ${esc(quoteTiming(r))}</small>`:''}</span><span class="vendor-quote"><strong>${currencyValue(r.value,r.currency)}</strong>${r.value!==null?`<small>${esc(r.currency)} · ${esc(referenceLabel(r.kind))}${r.observedAt?' · last observed':''}</small>`:''}<span class="vendor-action">${r.direct?'View listing':'Search store'} <span aria-hidden="true">↗</span></span></span></a>`).join('')||'<p class="muted small">Seller links are unavailable for this card.</p>'}</div></section>`;
}
export function compactPriceSummary(game,c,ctx={},lastObserved=null){
 const finish=selectedFinish(game,c,ctx.priceFinish),q=quoteForContext(game,c,ctx);
 let value=q?.value??null,currency='USD',label=q?.label||finishLabel(finish),note=referenceLabel(q?.kind);
 if(value===null&&q?.selectionVerified&&game==='mtg'&&finish!=='etched') {const eur=priceAmount(c.prices?.[finish==='foil'?'eur_foil':'eur']);if(eur!==null){value=eur;currency='EUR';note='Cardmarket reference';}}
 if(value===null&&!c.setContext&&!ctx.priceEdition&&finish==='reference'&&lastObserved){value=priceAmount(lastObserved.value);note='Last observed '+lastObserved.date;label=lastObserved.finish||label;}
 if(value===null&&q?.selectionVerified){const mine=myPrice(c,game==='mtg'?finish:'nonfoil',ctx);if(mine!==null){value=mine;note='Your private value · not a seller quote';}}
 if(q?.observedAt&&q.value!==null)note='Last observed '+dateText(q.observedAt);
 if(q?.value!==null&&quoteIsStale(q))note+=' · stale';
 const buy=sellerModels(game,c,ctx).find(r=>r.key==='tcgplayer');
 const edit=game==='mtg'?`data-act="myPriceSet" data-finish="${esc(finish)}"`:`data-act="tMyPriceSet" data-game="${esc(game)}" data-id="${esc(c.id)}"`;
 return `<div class="card-price-summary"><div class="card-price-reference"><strong>${value===null?c.brief?'Loading price…':'No quote yet':currencyValue(value,currency)}</strong><span>${esc(value===null?'Price unknown':note)}${value!==null?' · '+currency:''}</span><small>${esc(label)}</small></div><div class="card-price-actions"><button class="btn ghost small" data-act="cardPriceJump" data-target="history" aria-label="View price history">Prices</button><a class="btn small card-buy-link" data-focus-key="card-buy" href="${esc(buy.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="${buy.direct?'Buy on TCGplayer · selected product listing':'Search TCGplayer · exact product not verified'} · opens in a new tab" title="${buy.direct?'Confirm finish, edition, condition and price on TCGplayer':'Search TCGplayer and choose your printing and finish'}"><span>${buy.direct?'Buy':'Search TCGplayer'}</span><span aria-hidden="true">↗</span></a><button class="link small personal-price-edit" ${edit}>Your price</button></div></div>`;
}
export const detailIdentity=(ctx,shown=null)=>['card','tcard','buy','market'].includes(ctx?.type)?JSON.stringify([ctx.type,ctx.game||'mtg',ctx.id||ctx.card?.id||ctx.name||'',ctx.print?.id||ctx.card?.id||shown?.id||'',ctx.priceEdition||ctx.edition||'',ctx.setId||ctx.card?.setContext?.releaseId||shown?.setContext?.releaseId||'',ctx.priceYgoEdition||ctx.ygoEdition||'',ctx.setReleaseUnverified?'unverified':'']):'';
export const detailTabs=(tab,items)=>`<nav class="cs-tabs" role="tablist" aria-label="Card details"><span class="cs-tab-indicator" aria-hidden="true"></span>${items.map(([id,label])=>`<button id="card-tab-${esc(id)}" role="tab" aria-controls="card-panel-${esc(id)}" aria-selected="${id===tab}" tabindex="${id===tab?'0':'-1'}" class="${id===tab?'on':''}" data-act="cardTab" data-tab="${esc(id)}">${label}</button>`).join('')}</nav>`;
export const detailPanel=(id,tab,html)=>`<div id="card-panel-${esc(id)}" class="cs-panel" data-tab="${esc(id)}" role="tabpanel" aria-labelledby="card-tab-${esc(id)}" tabindex="0" ${id===tab?'':'hidden'}>${html}</div>`;

// Small DOM helpers keep focus/disclosures stable without replacing the sheet context.
const focusKey=el=>el?.id?'id:'+el.id:el?.dataset?.focusKey?'key:'+el.dataset.focusKey:el?.dataset?.change?'change:'+el.dataset.change:el?.dataset?.act?'act:'+JSON.stringify([el.dataset.act,el.dataset.tab,el.dataset.target,el.dataset.finish,el.dataset.range,el.dataset.src,el.dataset.game,el.dataset.id]):el?.tagName==='SUMMARY'?'summary:'+el.textContent:el?.tagName==='A'?'link:'+el.getAttribute('href'):'';
// A history response can replace the sheet before a native smooth scroll has
// moved at all. Keep that one navigation intent separate from its current top.
// User input, another focus target, completion or newer navigation ends it.
const detailScrolls=new WeakMap(),detailStateJumps=new WeakMap();
const cancelDetailScroll=body=>detailScrolls.get(body)?.cancel();
function rememberDetailScroll(body,target,top,refreshOffsets,isCurrent){
 if(!focusKey(target)||!body.addEventListener)return;
 const max=Number.isFinite(body.scrollHeight)&&Number.isFinite(body.clientHeight)?Math.max(0,body.scrollHeight-body.clientHeight):top,goal=Math.min(top,max);
 if(Math.abs(body.scrollTop-goal)<=1)return;
 const input=['wheel','touchstart','pointerdown','keydown'];
 const intent={target,identity:body.dataset?.detailIdentity,refreshOffsets,isCurrent,cancel:()=>{
  if(detailScrolls.get(body)!==intent)return;
  detailScrolls.delete(body);
  for(const type of input)body.removeEventListener(type,intent.cancel,true);
  body.removeEventListener('focusin',focusChanged,true);body.removeEventListener('scroll',scrolled);
 }};
 const focusChanged=e=>{if(e.target!==target)intent.cancel();};
 const scrolled=()=>{
  if(!isCurrent()){intent.cancel();return;}
  if(Math.abs(body.scrollTop-goal)>1)return;
  intent.cancel();
  // Smooth scrolling can expand a multi-line sticky title after its initial
  // measurement. Settle the current target once, never after user navigation.
  settleDetailClearance(body,target,refreshOffsets);
 };
 detailScrolls.set(body,intent);
 for(const type of input)body.addEventListener(type,intent.cancel,{capture:true,passive:true});
 body.addEventListener('focusin',focusChanged,true);body.addEventListener('scroll',scrolled,{passive:true});
}
export function captureDetailState(body,active=globalThis.document?.activeElement){
 const details=[...(body?.querySelectorAll?.('details')||[])],intent=detailScrolls.get(body);
 const jump=intent&&intent.target===active&&body.contains?.(active)&&intent.identity===body.dataset?.detailIdentity&&intent.isCurrent()?intent:null;
 if(intent&&!jump)intent.cancel();
 const state={top:body?.scrollTop||0,left:body?.querySelector?.('.cs-tabs')?.scrollLeft||0,focus:body?.contains?.(active)?focusKey(active):'',details:details.map((el,i)=>[el.dataset.detailKey||el.id||el.querySelector('summary')?.textContent||String(i),el.open]),pointValue:active?.dataset?.change==='marketPoint'?active.value:null,selection:active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null};
 if(jump){
  // Only the synchronous capture/render/restore may consume this intent. Back
  // snapshots stay plain data and cannot revive navigation on a later turn.
  detailStateJumps.set(state,jump);
  queueMicrotask(()=>{detailStateJumps.delete(state);jump.cancel();});
 }
 return state;
}
export function restoreDetailState(body,state){
 if(!body||!state)return;
 for(const [i,el] of [...(body.querySelectorAll?.('details')||[])].entries()){const key=el.dataset.detailKey||el.id||el.querySelector('summary')?.textContent||String(i),saved=state.details.find(x=>x[0]===key);if(saved)el.open=saved[1];}
 const target=state.focus&&[...(body.querySelectorAll?.('button,input,select,textarea,a,summary,[tabindex]')||[])].find(el=>focusKey(el)===state.focus&&!el.closest?.('[hidden]'));
 if(target&&state.pointValue!==null&&target.dataset?.change==='marketPoint'&&[...(target.options||[])].some(o=>o.value===state.pointValue))target.value=state.pointValue;
 const jump=detailStateJumps.get(state);
 if(target&&jump&&detailScrolls.get(body)===jump&&jump.identity===body.dataset?.detailIdentity&&jump.isCurrent()){
  // Complete once against the replacement layout. Replaying the old top would
  // cancel native smooth scrolling at 0 (or midway), leaving focus off-screen.
  scrollDetailTarget(body,target,true,jump.refreshOffsets);
 }else{target?.focus?.({preventScroll:true});body.scrollTop=state.top;}
 if(target&&state.selection)try{target.setSelectionRange?.(...state.selection);}catch{}
 const tabs=body.querySelector?.('.cs-tabs');if(tabs)tabs.scrollLeft=state.left;
}
// A fold/rotation can clamp native scroll before its resize event arrives.
// Carry only the latest intended reading position through that temporary clamp.
// A real scroll supersedes it in every geometry; an actual content mount starts
// a new lifetime even when the persistent sheet body and card identity are reused.
// No rendering, focus changes, selection changes or model sniff.
const detailViewports = new WeakMap();
export function rememberDetailViewport(body, identity, viewport, generation) {
 if (!body || !identity) return;
 let state = detailViewports.get(body);
 if (!state || state.identity !== identity || state.generation !== generation) {
  state = {identity, generation, viewport, intendedTop:body.scrollTop, appliedTop:body.scrollTop};
  detailViewports.set(body,state); return;
 }
 // Ignore native scroll/clamp events belonging to a not-yet-handled resize.
 // The scroll event from our own clamped assignment must not erase its intent.
 if (state.viewport === viewport && body.scrollTop !== state.appliedTop) {
  state.intendedTop = state.appliedTop = body.scrollTop;
 }
}
export function restoreDetailViewport(body, identity, viewport, generation) {
 const state = body && detailViewports.get(body);
 if (!state || state.identity !== identity || state.generation !== generation || state.viewport === viewport) return rememberDetailViewport(body,identity,viewport,generation);
 state.viewport = viewport; body.scrollTop = state.intendedTop;
 state.appliedTop = body.scrollTop;
}
export function detailTabKey(key,index,length){return key==='Home'?0:key==='End'?length-1:key==='ArrowRight'?(index+1)%length:key==='ArrowLeft'?(index+length-1)%length:null;}
function settleDetailClearance(body,target,refreshOffsets){
 const head=body.querySelector?.('.sheet-head'),tabs=body.querySelector?.('.cs-tabs');
 for(let pass=0;pass<2;pass++){
  refreshOffsets();
  const boundary=Math.max(body.getBoundingClientRect().top,head?.getBoundingClientRect?.().bottom||0,tabs?.getBoundingClientRect?.().bottom||0)+12;
  const overlap=target.getBoundingClientRect().top-boundary;
  if(overlap>=-1)break;
  const corrected=Math.max(0,body.scrollTop+overlap);if(corrected===body.scrollTop)break;
  body.scrollTo?.({top:corrected,behavior:'auto'});
 }
}
export function scrollDetailTarget(body,target,reduced=false,refreshOffsets=()=>{},isCurrent=()=>true){
 if(!body||!target)return false;
 cancelDetailScroll(body);
 const head=body.querySelector?.('.sheet-head'),tabs=body.querySelector?.('.cs-tabs'),clearance=(head?.getBoundingClientRect?.().height||0)+(tabs?.getBoundingClientRect?.().height||0)+12;
 const top=Math.max(0,body.scrollTop+target.getBoundingClientRect().top-body.getBoundingClientRect().top-clearance);
 target.focus?.({preventScroll:true});
 if(!reduced)rememberDetailScroll(body,target,top,refreshOffsets,isCurrent);
 body.scrollTo?.({top,behavior:reduced?'auto':'smooth'});
 // An instant jump can expand the sticky title before the next scroll event.
 // Measure the final boundary now, while this card/context is still current.
 // No delayed correction may take focus or scrolling away from later navigation.
 if(reduced)settleDetailClearance(body,target,refreshOffsets);
 return true;
}
// The latest jump wins. A late render may never move focus in a different card or closed sheet.
export function createDetailJump({getContext,isOpen,showPrices,getBody,refreshOffsets=()=>{},reducedMotion=()=>false,identityOf=detailIdentity}){
 let sequence=0;
 return async target=>{
  const ctx=getContext(),token=++sequence,identity=identityOf(ctx);
  cancelDetailScroll(getBody());
  if(!['card','tcard'].includes(ctx?.type))return false;
  await showPrices();
  const isCurrent=()=>token===sequence&&getContext()===ctx&&identityOf(ctx)===identity&&ctx.tab==='prices'&&isOpen();
  if(!isCurrent())return false;
  const body=getBody(),node=body?.querySelector?.(target==='sellers'?'#card-sellers':'#card-history');
  refreshOffsets();return scrollDetailTarget(body,node,reducedMotion(),refreshOffsets,isCurrent);
 };
}
