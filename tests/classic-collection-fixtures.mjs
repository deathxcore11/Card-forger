// Public deterministic QA inputs. Identities and products come from the bounded
// source-evidence module; all text, amounts, holdings, histories and art below
// are handcrafted test data, not live prices, real collections or source scans.
import {CLASSIC_CARDS} from '../pokemon-classic-evidence.js';
export const CLASSIC_RELEASE={id:'cel25cc',name:'Celebrations Classic Collection',count:25,date:'2021-10-08'};
export const CLASSIC_SOURCE_DATE='2020-01-01T00:00:00.000Z';
export const CLASSIC_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#29445c"/><rect x="35" y="80" width="560" height="350" fill="#627789"/><text x="315" y="240" text-anchor="middle" font-family="sans-serif" font-size="30" fill="white">SYNTHETIC CLASSIC FIXTURE</text><text x="315" y="550" text-anchor="middle" font-family="sans-serif" font-size="30" fill="white">NOT CARD ARTWORK</text></svg>';
export const CLASSIC_RAW=CLASSIC_CARDS.map((e,i)=>{
 const wrong=i===19?{tp:250301,cm:576747}:i===20?{tp:250308,cm:576755}:null,product=wrong?.tp||e.productId,cm=wrong?.cm||e.cmProduct;
 const pricing={tcgplayer:{unit:'USD',updated:CLASSIC_SOURCE_DATE,holofoil:{productId:product,marketPrice:wrong?987.65:20+i,lowPrice:wrong?987.65:19+i,midPrice:wrong?987.65:21+i}},cardmarket:{unit:'EUR',updated:CLASSIC_SOURCE_DATE,idProduct:cm,low:wrong?987.65:10+i,avg:wrong?987.65:11+i,trend:wrong?987.65:12+i}};
 return {id:e.id,name:e.name,localId:e.id.split('-').at(-1),category:[3,5,11].includes(i)?'Trainer':'Pokemon',rarity:'Classic Collection',types:['Water'],hp:100,...([3,5,11].includes(i)?{effect:'Synthetic Trainer effect, not printed rules.'}:{attacks:[{name:'Synthetic test attack',cost:['Water'],damage:10,effect:'Synthetic attack text, not printed rules.'}]}),set:{id:'cel25cc',name:CLASSIC_RELEASE.name,cardCount:{official:25,total:25}},variants:{holo:true,normal:false,reverse:false,firstEdition:false,wPromo:false},image:'https://detail-fixtures.invalid/classic/'+e.id+'.png',variants_detailed:[{type:'holo',size:'standard',variantId:'synthetic-'+e.id,...(wrong?{stamp:['25th-celebration']}:{}),thirdParty:{tcgplayer:product,cardmarket:cm},pricing:structuredClone(pricing)}],pricing};
});
export const CLASSIC_LOTS=[
 {id:'classic-wrong-saved-manual',cardId:'cel25cc-CC020',name:'Reshiram',key:'id:cel25cc-CC020',variant:'holofoil',productId:250301,qty:2,condition:'Near Mint',language:'en',manualValue:12.34,manualValueCondition:'Near Mint',manualValueCurrency:'USD',addedAt:'2020-01-01'},
 {id:'classic-correct-saved',cardId:'cel25cc-CC001',name:'Blastoise',key:'id:cel25cc-CC001',variant:'holofoil',productId:250319,qty:1,condition:'Near Mint',language:'en',addedAt:'2020-01-01'},
];
export const CLASSIC_HISTORY=[{date:'2020-01-01',total:24.68,copies:2,unpriced:0,currency:'USD',basis:'exact-owned-v1'}];
export const CLASSIC_EXPECTED=CLASSIC_CARDS.map(e=>({id:e.id,name:e.name,number:e.number,total:e.total,productId:e.productId,cmProduct:e.cmProduct,display:'#'+[e.number,e.total].filter(Boolean).join('/')}));
export const CLASSIC_EVIDENCE='Actual index.html/app.js UI with all 25 source-backed Classic identities. Provider payloads, quotes, histories, owned lots and SVG images are deterministic synthetic fixtures. No real accounts, external provider traffic, paid calls or physical foil proof.';
