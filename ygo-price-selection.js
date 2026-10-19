import {referenceQuote} from './price-reference.js';
import {ygoRarity} from './ygo-identity.js';

export const YGO_EDITION_NAMES={'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'};
const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function supportedYgoEditions(printing){
 const quotes=printing?.releasePriceAmbiguous?[]:printing?.quotes||[];
 return Object.entries(YGO_EDITION_NAMES).filter(([,label])=>{
  const rows=quotes.filter(q=>norm(q.edition)===norm(label));
  return rows.length===1&&!!referenceQuote(rows[0]);
 }).map(([key])=>key);
}

// A browsing convenience, never evidence of the user's physical edition or
// condition. Keep explicit choices (including “not specified”) and saved lots.
// Do not choose between rarities or releases, even if one is much cheaper.
export function ygoPricePreview(card,ctx={}){
 if(card?.game!=='ygo'||ctx.game&&ctx.game!=='ygo'||ctx.id&&String(ctx.id)!==String(card.id)||ctx.entryId||ctx.entry||ctx.setReleaseUnverified)return {};
 const context=card.setContext;
 if(ctx.setId&&!context)return {};
 if(context&&(context.status!=='resolved'||context.releaseAmbiguous||context.game&&context.game!=='ygo'||context.cardId&&String(context.cardId)!==String(card.id)||ctx.setId&&ctx.setId!==context.releaseId))return {};
 const automatic=!!ctx.ygoPriceDefault&&ctx.ygoPriceDefault===ctx.priceYgoEdition&&!ctx.ygoEditionExplicit,
  reset=automatic?{priceYgoEdition:'',ygoPriceDefault:''}:{},
  rows=context?.printings||card.sets||[],wanted=ctx.priceEdition||'',
  matches=wanted?rows.filter(p=>p.code+'::'+p.rarity===wanted):context&&!ctx.ygoPrintingExplicit&&rows.length===1?rows:[],
  printing=matches.length===1&&!matches[0].releasePriceAmbiguous?matches[0]:null;
 if(!printing)return reset;
 const patch={...reset,...(wanted?{}:{priceEdition:printing.code+'::'+printing.rarity})};
 if(ctx.priceYgoEdition&&!automatic||ctx.ygoEditionExplicit)return patch;
 const supported=supportedYgoEditions(printing),edition=supported.includes('1st-edition')?'1st-edition':supported.length===1?supported[0]:'';
 if(edition)Object.assign(patch,{priceYgoEdition:edition,ygoPriceDefault:edition});
 return patch;
}

// Budget references must name a unique product, printing and edition. This is
// only the lowest checked available reference, not a global cheapest/live offer.
export function ygoPurchaseReference(card,selection={}){
 const requested={...selection},unknown=reason=>({value:null,currency:'USD',reason,selection:{...requested}});
 if(card?.game!=='ygo')return unknown('Card identity unavailable');
 if(Object.hasOwn(selection,'printingKey')&&!selection.printingKey)return unknown('Printing not specified');
 const context=card.setContext;
 if(selection.unverified||context&&(context.status!=='resolved'||context.releaseAmbiguous||context.game&&context.game!=='ygo'||context.cardId&&String(context.cardId)!==String(card.id))){requested.unverified=true;return unknown('Release identity unverified');}
 const printingKey=selection.printingKey??card.displayPrintingKey??'',
  edition=Object.hasOwn(selection,'edition')?selection.edition:Object.hasOwn(card,'displayEdition')?card.displayEdition:undefined,
  releaseName=selection.releaseName||context?.name||'',rows=context?.printings||card.sets||[],
  eligible=rows.filter(p=>(!releaseName||p.name===releaseName)&&(!printingKey||p.code+'::'+p.rarity===printingKey));
 if(printingKey)requested.printingKey=printingKey;if(releaseName)requested.releaseName=releaseName;if(edition!==undefined)requested.edition=edition;
 if(edition!==undefined&&!YGO_EDITION_NAMES[edition])return unknown('Edition not specified or unsupported');
 if(Object.hasOwn(selection,'productId')&&(!Number.isSafeInteger(selection.productId)||selection.productId<1))return unknown('Selected product identity unverified');
 const candidates=[];
 for(const p of eligible){
  if(p.releasePriceAmbiguous||!p.name||!p.code||!ygoRarity(p.rarity)||!Number.isSafeInteger(p.productId)||p.productId<1||!p.priceSource||!Number.isFinite(Date.parse(p.checkedAt))||selection.productId&&selection.productId!==p.productId)continue;
  if(rows.filter(other=>(!releaseName||other.name===releaseName)&&other.code===p.code&&ygoRarity(other.rarity)===ygoRarity(p.rarity)).length!==1)continue;
  for(const key of supportedYgoEditions(p)){
   if(edition!==undefined&&key!==edition)continue;
   const q=p.quotes.find(q=>norm(q.edition)===norm(YGO_EDITION_NAMES[key]));
   if(Object.hasOwn(q,'productId')&&q.productId!==p.productId||q.currency&&q.currency!=='USD'||p.currency&&p.currency!=='USD')continue;
   const numeric=Object.fromEntries(['marketPrice','market','midPrice','mid','lowPrice','low'].map(field=>[field,['number','string'].includes(typeof q[field])?q[field]:null])),ref=referenceQuote(numeric);if(!ref)continue;
   candidates.push({...ref,currency:'USD',source:p.priceSource,checkedAt:p.checkedAt,productId:p.productId,printing:p,
    url:'https://www.tcgplayer.com/product/'+p.productId+'?Printing='+encodeURIComponent(YGO_EDITION_NAMES[key]),
    selection:{...requested,printingKey:p.code+'::'+p.rarity,edition:key,releaseName:p.name,productId:p.productId}});
  }
 }
 candidates.sort((a,b)=>a.value-b.value||a.selection.printingKey.localeCompare(b.selection.printingKey)||a.selection.edition.localeCompare(b.selection.edition));
 return candidates[0]||unknown('Exact printing and edition quote unavailable');
}
export function ygoPurchaseChecklist(rows){
 return rows.map(row=>{
  const q=row.purchaseReference||{},s=q.selection||{},identity=[s.releaseName,s.printingKey?.replace('::',' · '),s.edition?YGO_EDITION_NAMES[s.edition]||s.edition:'edition not specified'].filter(Boolean).join(' · '),
   quote=q.value==null?'Price unknown: '+(q.reason||'exact quote unavailable'):`USD ${q.value.toFixed(2)} ${q.kind||'market'} reference each · ${q.source} · checked ${q.checkedAt}`;
  return `${row.qty} ${row.name}${identity?' · '+identity:''}\n  ${quote}${q.url?'\n  '+q.url:''}`;
 }).join('\n');
}
