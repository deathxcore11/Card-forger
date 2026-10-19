// Reviewed set contracts contain identities and availability, never prices.
// Add another set only after its independent primary-source matrix is reviewed.
// Regular Celebrations: review/celebrations-20261019/source-provenance-matrix.json.
import {pokemonPrintedNameKey} from './pokemon-identity.js';
import {classicEvidence,classicProviderCard,classicCatalogueCard,classicIdentityMatches} from './pokemon-classic-evidence.js';
export const POKEMON_SET_EVIDENCE_SCHEMA=1;
export const CELEBRATIONS_CHECKLIST='https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/checklist/25th_web_cardlist_en.pdf';
const rows=[
 ["cel25-1", "Ho-Oh", "1", 250300, 576746, true],
 ["cel25-2", "Reshiram", "2", 250301, 576747, true],
 ["cel25-3", "Kyogre", "3", 250298, 576748, true],
 ["cel25-4", "Palkia", "4", 250302, 576749, true],
 ["cel25-5", "Pikachu", "5", 250303, 576750, false],
 ["cel25-6", "Flying Pikachu V", "6", 250304, 576751, true],
 ["cel25-7", "Flying Pikachu VMAX", "7", 250305, 576752, true],
 ["cel25-8", "Surfing Pikachu V", "8", 250306, 576753, true],
 ["cel25-9", "Surfing Pikachu VMAX", "9", 250307, 576754, true],
 ["cel25-10", "Zekrom", "10", 250308, 576755, true],
 ["cel25-11", "Mew", "11", 250309, 576756, false],
 ["cel25-12", "Xerneas", "12", 250310, 576757, true],
 ["cel25-13", "Cosmog", "13", 250311, 576758, true],
 ["cel25-14", "Cosmoem", "14", 250297, 576759, true],
 ["cel25-15", "Lunala", "15", 250312, 576760, true],
 ["cel25-16", "Zacian V", "16", 250313, 576761, true],
 ["cel25-17", "Groudon", "17", 250314, 576762, true],
 ["cel25-18", "Zamazenta V", "18", 250299, 576763, true],
 ["cel25-19", "Yveltal", "19", 250315, 576764, true],
 ["cel25-20", "Dialga", "20", 250296, 576765, true],
 ["cel25-21", "Solgaleo", "21", 250316, 576766, true],
 ["cel25-22", "Lugia", "22", 250317, 576767, true],
 ["cel25-23", "Professor's Research (Professor Oak)", "23", 250318, 576768, false],
 ["cel25-24", "Professor's Research (Professor Oak)", "24", 250293, 576769, false],
 ["cel25-25", "Mew", "25", 250295, 576770, false]
];
export const CELEBRATIONS_CARDS=Object.freeze(rows.map(([id,name,number,productId,cmProduct,cardmarketVerified])=>Object.freeze({id,name,number,total:25,count:25,setId:'cel25',setName:'Celebrations',productId,cmProduct,cardmarketVerified,finishes:Object.freeze(['holofoil']),productSource:`https://mp-search-api.tcgplayer.com/v2/product/${productId}/details`,checklist:CELEBRATIONS_CHECKLIST})));
const cards=new Map(CELEBRATIONS_CARDS.map(e=>[e.id,e]));
export const pokemonSetEvidence=card=>cards.get(typeof card==='string'?card:card?.id)||null;
export const pokemonReviewedEvidence=card=>pokemonSetEvidence(card)||classicEvidence(card);
const number=s=>String(s??'').replace(/^0+(?=\d)/,'');
export function pokemonSetIdentityMatches(card){const e=pokemonSetEvidence(card);return !e||(!card.game||card.game==='ptcg')&&(!card.set?.id||card.set.id===e.setId)&&(!card.set?.name||String(card.set.name).trim().toLowerCase()===e.setName.toLowerCase())&&(!card.name||pokemonPrintedNameKey(card.name)===pokemonPrintedNameKey(e.name))&&(!card.localId||number(card.localId)===e.number)&&(!card.set?.number||number(card.set.number)===e.number);}
export const pokemonReviewedIdentityMatches=card=>pokemonSetEvidence(card)?pokemonSetIdentityMatches(card):classicIdentityMatches(card);
export const pokemonSetProductMatches=(card,id)=>!pokemonSetEvidence(card)||String(id||'')===String(pokemonSetEvidence(card).productId);
export const pokemonReviewedProductMatches=(card,id)=>!pokemonReviewedEvidence(card)||String(id||'')===String(pokemonReviewedEvidence(card).productId);
export function pokemonReviewedHistoryKey(card,finish,source){const e=pokemonReviewedEvidence(card);return e?[card.id,finish,'product:'+e.productId,source,'USD'].join('|'):'';}
export const pokemonReviewedHoloOnly=card=>!!pokemonReviewedEvidence(card);
const rawHolo=v=>v?.type==='holo'&&(!v.size||v.size==='standard')&&!v.subtype&&!v.foil&&(v.stamp||[]).every(s=>s==='25th-celebration');
const normalizedHolo=v=>(v.key==='holofoil'||v.key?.startsWith('detail:'))&&(!v.finish||v.finish==='holofoil')&&(!v.type||v.type==='holo')&&!/normal|nonfoil|reverse|unconfirmed|first edition|1st ed|unlimited/i.test(v.label||'')&&(!v.size||v.size==='standard')&&!v.subtype&&!v.foil&&(v.stamps||[]).every(s=>s==='25th-celebration');
const emptyQuote=v=>({...v,usd:null,market:null,low:null,mid:null,historyQuote:null,productFallback:false,fallback:false});
const notice=e=>!e.cardmarketVerified?'Cardmarket printing identity unverified; EUR quote withheld.':'';
// Keep old/source records intact. Unknown or conflicting values are not moved
// onto a verified product, even when the product identity is independently known.
export function pokemonProviderCard(card){
 card=classicProviderCard(card);const e=pokemonSetEvidence(card);if(!e)return card;
 const valid=pokemonSetIdentityMatches(card),pricing=p=>{if(!p)return p;const tp=p.tcgplayer,cm=p.cardmarket;return {...p,...(tp?{tcgplayer:{unit:tp.unit,updated:tp.updated,...(String(tp.holofoil?.productId)===String(e.productId)?{holofoil:{...tp.holofoil}}:{})}}:{}),...(cm?{cardmarket:e.cardmarketVerified&&String(cm.idProduct)===String(e.cmProduct)?{...cm}:{}}:{})};};
 const details=(card.variants_detailed||[]).filter(rawHolo).map(v=>({...v,thirdParty:{...v.thirdParty,tcgplayer:e.productId,cardmarket:e.cardmarketVerified?e.cmProduct:null},pricing:pricing(v.pricing)}));
 return {...card,variants:{firstEdition:false,holo:true,normal:false,reverse:false,wPromo:false},variants_detailed:valid?details:[],pricing:valid?pricing(card.pricing):{},reviewedIntegrity:{schema:POKEMON_SET_EVIDENCE_SCHEMA,identityVerified:valid,cardmarketVerified:e.cardmarketVerified,providerCardmarketId:card.pricing?.cardmarket?.idProduct||null,productSource:e.productSource,notice:valid?notice(e):'Catalogue identity mismatch; provider prices withheld.'}};
}
// Read-time protection also covers unsupported variants introduced by old backup
// quotes. Saved owned lots, chosen keys, manual values and old caches are not rewritten.
export function pokemonCatalogueCard(card){
 card=classicCatalogueCard(card);const e=pokemonSetEvidence(card);if(!e||card.game&&card.game!=='ptcg')return card;
 const valid=pokemonSetIdentityMatches(card),variants=valid?(card.variants||[]).filter(normalizedHolo).map(v=>pokemonSetProductMatches(card,v.productId)?{...v,cmProduct:e.cardmarketVerified?e.cmProduct:null}:{...emptyQuote(v),productId:e.productId,cmProduct:e.cardmarketVerified?e.cmProduct:null}):[];
 if(valid&&!variants.length)variants.push({key:'holofoil',label:'Holofoil',finish:'holofoil',productId:e.productId,cmProduct:e.cardmarketVerified?e.cmProduct:null,usd:null});
 const best=variants.find(v=>v.usd!=null),selected=card.setContext?.variantKey?variants.find(v=>v.key===card.setContext.variantKey):null;
 const cmOK=valid&&e.cardmarketVerified&&String(card.cmProduct||'')===String(e.cmProduct),message=!valid?'Catalogue identity mismatch; provider prices withheld.':notice(e);
 return {...card,reviewedSchema:POKEMON_SET_EVIDENCE_SCHEMA,reviewedIntegrity:{...card.reviewedIntegrity,schema:POKEMON_SET_EVIDENCE_SCHEMA,identityVerified:valid,cardmarketVerified:cmOK,providerCardmarketId:card.reviewedIntegrity?.providerCardmarketId||card.cmProduct||null,productSource:e.productSource,...(message?{notice:message}:{})},variants,prices:{...card.prices,usd:best?.usd??null,...(!cmOK?{eur:null}:{}),...(message?{integrityNotice:message}:{})},cmProduct:cmOK?e.cmProduct:null,...(!cmOK?{cardmarket:{}}:{}),...(card.setContext?{setContext:{...card.setContext,...(!valid?{status:'missing'}:{}),referencePrice:best?.usd??null,price:card.setContext.variantKey?selected?.usd??null:best?.usd??null,variant:selected?{...selected}:null}}:{}),conditionQuotes:(card.conditionQuotes||[]).filter(q=>valid&&pokemonSetProductMatches(card,q.productId)&&(!q.variant||variants.some(v=>v.key===q.variant))),...(card.sets?{sets:card.sets.map(s=>({...s,price:best?.usd??null}))}:{})};
}
