// Bounded catalogue evidence, reviewed 2026-10-19. These are identities, never prices.
// Full source snapshots and all 25 joins: review/classic-collection-20261019/.
export const CLASSIC_SCHEMA=1;
export const CLASSIC_CHECKLIST='https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/checklist/25th_web_cardlist_en.pdf';
export const CLASSIC_CARDMARKET='https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json';
const rows=[
 [
  "cel25cc-CC001",
  "Blastoise",
  "2",
  "102",
  250319,
  576771
 ],
 [
  "cel25cc-CC002",
  "Charizard",
  "4",
  "102",
  250320,
  576772
 ],
 [
  "cel25cc-CC003",
  "Venusaur",
  "15",
  "102",
  250321,
  576773
 ],
 [
  "cel25cc-CC004",
  "Imposter Professor Oak",
  "73",
  "102",
  250322,
  576774
 ],
 [
  "cel25cc-CC005",
  "Dark Gyarados",
  "8",
  "82",
  250294,
  576775
 ],
 [
  "cel25cc-CC006",
  "Here Comes Team Rocket!",
  "15",
  "82",
  250323,
  576776
 ],
 [
  "cel25cc-CC007",
  "Rocket's Zapdos",
  "15",
  "132",
  250324,
  576777
 ],
 [
  "cel25cc-CC008",
  "_____'s Pikachu",
  "24",
  null,
  250325,
  576778
 ],
 [
  "cel25cc-CC009",
  "Cleffa",
  "20",
  "111",
  250326,
  576779
 ],
 [
  "cel25cc-CC010",
  "Shining Magikarp",
  "66",
  "64",
  250327,
  576780
 ],
 [
  "cel25cc-CC011",
  "Team Magma's Groudon",
  "9",
  "95",
  250328,
  576781
 ],
 [
  "cel25cc-CC012",
  "Rocket's Admin.",
  "86",
  "109",
  250329,
  576782
 ],
 [
  "cel25cc-CC013",
  "Mew ex",
  "88",
  "92",
  250330,
  576783
 ],
 [
  "cel25cc-CC014",
  "Gardevoir ex",
  "93",
  "101",
  250331,
  576784
 ],
 [
  "cel25cc-CC015",
  "Umbreon ☆",
  "17",
  "17",
  250332,
  576785
 ],
 [
  "cel25cc-CC016",
  "Claydol",
  "15",
  "106",
  250333,
  576786
 ],
 [
  "cel25cc-CC017",
  "Luxray GL LV.X",
  "109",
  "111",
  250334,
  576787
 ],
 [
  "cel25cc-CC018",
  "Garchomp C LV.X",
  "145",
  "147",
  250335,
  576788
 ],
 [
  "cel25cc-CC019",
  "Donphan",
  "107",
  "123",
  250336,
  576789
 ],
 [
  "cel25cc-CC020",
  "Reshiram",
  "113",
  "114",
  250337,
  576790
 ],
 [
  "cel25cc-CC021",
  "Zekrom",
  "114",
  "114",
  250338,
  576791
 ],
 [
  "cel25cc-CC022",
  "Mewtwo EX",
  "54",
  "99",
  250339,
  576792
 ],
 [
  "cel25cc-CC023",
  "Xerneas EX",
  "97",
  "146",
  250340,
  576793
 ],
 [
  "cel25cc-CC024",
  "M Rayquaza EX",
  "76",
  "108",
  250341,
  576794
 ],
 [
  "cel25cc-CC025",
  "Tapu Lele GX",
  "60",
  "145",
  250342,
  576795
 ]
];
export const CLASSIC_CARDS=Object.freeze(rows.map(([id,name,number,total,productId,cmProduct])=>Object.freeze({id,name,number,total,productId,cmProduct,setId:'cel25cc',count:25,productSource:`https://mp-search-api.tcgplayer.com/v2/product/${productId}/details`,checklist:CLASSIC_CHECKLIST})));
const byId=new Map(CLASSIC_CARDS.map(row=>[row.id,row]));
export const classicEvidence=card=>byId.get(typeof card==='string'?card:card?.id)||null;
export const classicProductMatches=(card,productId)=>!classicEvidence(card)||String(productId||'')===String(classicEvidence(card).productId);
const cleanName=s=>String(s||'').normalize('NFC').replace(/[‘’]/g,"'").trim().toLowerCase();
export const classicIdentityMatches=card=>{const e=classicEvidence(card);return !e||(!card.set?.id||card.set.id===e.setId)&&(!card.name||cleanName(card.name)===cleanName(e.name));};
export function classicSetIdentity(card,set){
 const e=classicEvidence(card);if(!e||!set||!classicIdentityMatches(card))return set;
 return {...set,number:e.number,total:e.total,count:e.count,catalogueNumber:card.localId||set.catalogueNumber||card.id.split('-').at(-1),identitySource:CLASSIC_CHECKLIST};
}
const physicalHolo=v=>v?.type==='holo'&&(!v.size||v.size==='standard')&&!v.subtype&&!v.foil&&(v.stamp||[]).every(s=>s==='25th-celebration');
const ids=c=>[c?.thirdParty?.tcgplayer,...(c?.variants_detailed||[]).flatMap(v=>[v.thirdParty?.tcgplayer,...Object.values(v.pricing?.tcgplayer||{}).map(q=>q?.productId)]),...Object.values(c?.pricing?.tcgplayer||{}).map(q=>q?.productId)].filter(Boolean);
// Conflicting quotes are removed rather than relabeled with the corrected ID.
// Preserve the original provider record separately in integrity metadata.
export function classicProviderCard(card){
 const e=classicEvidence(card);if(!e)return card;
 const rejected=[...new Set(ids(card).filter(id=>!classicProductMatches(card,id)).map(String))];
 const rejectedCm=[...new Set([card.pricing?.cardmarket?.idProduct,...(card.variants_detailed||[]).flatMap(v=>[v.thirdParty?.cardmarket,v.pricing?.cardmarket?.idProduct])].filter(id=>id&&String(id)!==String(e.cmProduct)).map(String))];
 const pricing=p=>{
  if(!p)return p;
  const tp=p.tcgplayer,cm=p.cardmarket;
  return {...p,...(tp?{tcgplayer:{unit:tp.unit,updated:tp.updated,...(String(tp.holofoil?.productId)===String(e.productId)?{holofoil:{...tp.holofoil}}:{})}}:{}),...(cm?{cardmarket:String(cm.idProduct)===String(e.cmProduct)?{...cm}:{}}:{})};
 };
 const valid=classicIdentityMatches(card);
 const details=(card.variants_detailed||[]).filter(physicalHolo).map(v=>({...v,thirdParty:{...v.thirdParty,tcgplayer:e.productId,cardmarket:e.cmProduct},pricing:pricing(v.pricing)}));
 return {...card,variants:{firstEdition:false,holo:true,normal:false,reverse:false,wPromo:false},variants_detailed:valid?details:[],pricing:valid?pricing(card.pricing):{},thirdParty:valid?{...card.thirdParty,tcgplayer:e.productId,cardmarket:e.cmProduct}:{},classicIntegrity:{schema:CLASSIC_SCHEMA,identityVerified:valid,productSource:e.productSource,checklist:CLASSIC_CHECKLIST,rejectedTcgplayerIds:rejected,rejectedCardmarketIds:rejectedCm,...(!valid?{notice:'Catalogue identity mismatch; provider prices withheld.'}:rejected.length||rejectedCm.length?{notice:'Conflicting provider prices withheld; catalogue product verified independently.'}:{})}};
}
const normalizedHolo=v=>!v.foil&&!v.subtype&&(!v.size||v.size==='standard')&&(v.stamps||[]).every(s=>s==='25th-celebration')&&(v.finish==='holofoil'||v.key==='holofoil'||v.key?.startsWith('detail:')&&/holofoil/i.test(v.label||'')&&!/reverse/i.test(v.label||''));
export function classicVariantAliases(card,variants){
 const e=classicEvidence(card);if(!e||!classicIdentityMatches(card))return variants;
 const rows=variants.map(v=>normalizedHolo(v)?({...v,label:'Holofoil',finish:'holofoil',setFacet:'holofoil',setFacetSource:CLASSIC_CHECKLIST,productId:v.productId||e.productId,cmProduct:e.cmProduct}):({...v,label:'Version identity unconfirmed',usd:null,market:null,low:null,mid:null,productId:null,cmProduct:null}));
 const detail=rows.filter(v=>v.key.startsWith('detail:')&&String(v.productId)===String(e.productId));
 let root=rows.find(v=>v.key==='holofoil');
 if(!root&&detail.length===1){root={...detail[0],key:'holofoil',aliasOf:detail[0].key};rows.push(root);}
 if(root&&detail.length===1&&String(root.productId)===String(e.productId)){
  const target=detail[0];if(target.usd==null&&root.usd!=null)Object.assign(target,{usd:root.usd,market:root.market,low:root.low,mid:root.mid,priceKind:root.priceKind});
  Object.assign(root,{...target,key:'holofoil',aliasOf:target.key});
 }
 return rows;
}
// Old normalized caches may be used offline. Quarantine their wrong quotes on
// read without rewriting saved lots, manual values, or old history records.
export function classicCatalogueCard(card){
 const e=classicEvidence(card);if(!e||card.game&&card.game!=='ptcg')return card;
 if(card.classicSchema===CLASSIC_SCHEMA)return card;
 if(!classicIdentityMatches(card))return {...card,classicSchema:CLASSIC_SCHEMA,...(card.setContext?{setContext:{...card.setContext,status:'missing',referencePrice:null,price:null,variant:null}}:{}),variants:[],prices:{...card.prices,usd:null,eur:null,integrityNotice:'Catalogue identity mismatch; provider prices withheld.'},cmProduct:null,cardmarket:{},conditionQuotes:[],classicIntegrity:{schema:CLASSIC_SCHEMA,identityVerified:false}};
 const rejected=[];
 const variants=classicVariantAliases(card,(card.variants||[]).map(v=>{
  if(normalizedHolo(v)&&classicProductMatches(card,v.productId))return {...v};
  if(v.productId)rejected.push(String(v.productId));
  return {...v,productId:e.productId,usd:null,market:null,low:null,mid:null,historyQuote:null,productFallback:false,fallback:false};
 }));
 const best=variants.find(v=>v.usd!=null),cmOK=String(card.cmProduct||'')===String(e.cmProduct);
 const selected=card.setContext?.variantKey?variants.find(v=>v.key===card.setContext.variantKey):null;
 return {...card,classicSchema:CLASSIC_SCHEMA,set:classicSetIdentity(card,card.set),...(card.setContext?{setContext:{...card.setContext,sourceSet:classicSetIdentity(card,card.setContext.sourceSet||card.set),referencePrice:best?.usd??null,price:card.setContext.variantKey?selected?.usd??null:best?.usd??null,variant:selected?{...selected}:null}}:{}),variants,prices:{...card.prices,usd:best?.usd??null,...(!cmOK?{eur:null}:{}),...(rejected.length?{integrityNotice:'Conflicting provider prices withheld; catalogue product verified independently.'}:{})},cmProduct:e.cmProduct,...(!cmOK?{cardmarket:{}}:{}),conditionQuotes:(card.conditionQuotes||[]).filter(q=>String(q.productId||'')===String(e.productId)),classicIntegrity:{...card.classicIntegrity,schema:CLASSIC_SCHEMA,productSource:e.productSource,rejectedTcgplayerIds:[...new Set([...(card.classicIntegrity?.rejectedTcgplayerIds||[]),...rejected])]},...(card.sets?{sets:card.sets.map(s=>({...s,price:best?.usd??null}))}:{})};
}
export function classicHistoryKey(card,finish,source){const e=classicEvidence(card);return e?[card.id,finish,'product:'+e.productId,source,'USD'].join('|'):'';}

// Supplement only known printed-number identities in discovery. Provider IDs stay exact.
export function classicNumberEntries(name,number){
 const n=String(number||'').split('/')[0].replace(/^0+(?=\d)/,'');
 if(!n)return [];
 return CLASSIC_CARDS.filter(e=>e.number===n&&(!name||cleanName(e.name)===cleanName(name))).map(e=>({id:e.id,name:e.name,localId:e.id.split('-').at(-1),set:{id:e.setId,name:'Celebrations Classic Collection',cardCount:{official:25,total:25}}}));
}
