// Public synthetic fixture (LED7 Ra shape): one release, two rarities, no common printing.
import assert from 'node:assert/strict';
import {normalizeYgoSets} from './ygo.js';
import {setContextCard,tcgSet,tcgCardSheet,ui,cache} from './tcg.js';
import {S,blank} from './store.js';
import {applyYgoSetPrices} from './ygo-set-prices.js';
import {ygoProductMatches} from './ygo-prices.js';
const [release]=normalizeYgoSets([{set_name:'Synthetic Rage',set_code:'SYR',tcg_date:'2020-09-24'}]);
const base={name:release.name,code:'SYR-EN000',productId:1,priceSource:'TCGplayer via TCGCSV',checkedAt:new Date().toISOString()};
const ghost={...base,rarity:'Ghost Rare',productId:2,quotes:[{edition:'1st Edition',market:157.73},{edition:'Unlimited',market:139.89}]};
const ultra={...base,rarity:'Ultra Rare',quotes:[{edition:'1st Edition',market:19.73},{edition:'Unlimited',market:17.5}]};
const card={game:'ygo',id:'10000010',name:'Synthetic Sun Dragon',category:'Monster',stats:[],typeLine:'Effect Monster',sets:[ghost,ultra],prices:{usd:999},fetchedAt:new Date().toISOString()};
S.state=blank();S.state.settings.game='ygo';ui('ygo').sets.list=[release];cache.ygo[card.id]=card;
Object.assign(ui('ygo').set,{info:release,id:release.id,cards:[card],contents:{completeness:'complete'},q:'',filter:'all',rarity:'',edition:'',sort:'number',limit:120});
let html=tcgSet();
assert.match(html,/data-printing="SYR-EN000::Ultra Rare"/,'One tile, carrying the most common rarity into the detail');
assert.doesNotMatch(html,/data-printing="SYR-EN000::Ghost Rare"/,'Rarities stay together on one tile');
assert.match(html,/1 cards|1 card/);
assert.match(html,/\$19\.73/,'Tile shows that printing at 1st Edition');
assert.doesNotMatch(html,/\$157\.73|\$139\.89|\$17\.50|–\$/,'No range across rarities or editions');
ui('ygo').set.edition='unlimited';html=tcgSet();assert.match(html,/\$17\.50/);assert.doesNotMatch(html,/\$19\.73/,'Edition filter still wins');
ui('ygo').set.edition='';ui('ygo').set.rarity='Ghost Rare';html=tcgSet();assert.match(html,/\$157\.73/);assert.doesNotMatch(html,/\$19\.73/,'Rarity filter still wins');assert.match(html,/1 cards|1 card/);
ui('ygo').set.rarity='';
const sheet=tcgCardSheet(setContextCard('ygo',card,release,[release]),{type:'tcard',game:'ygo',id:card.id,setId:release.id,tab:'overview'});
assert.match(sheet,/SYR-EN000/);assert.match(sheet,/Ultra Rare/);assert.doesNotMatch(sheet,/choose a printing; edition unspecified/,'Detail opens on a real printing');
const ghostSheet=tcgCardSheet(setContextCard('ygo',card,release,[release]),{type:'tcard',game:'ygo',id:card.id,setId:release.id,priceEdition:'SYR-EN000::Ghost Rare',tab:'overview'});
assert.doesNotMatch(ghostSheet,/data-change="ygoPreviewPrinting"/,'Rarity chips replace the printing dropdown inside a release');
assert.match(ghostSheet,/data-change="ygoPreviewEdition"/,'Edition stays selectable');
assert.match(ghostSheet,/data-act="ygoPickRarity"[^>]*data-edition="SYR-EN000::Ultra Rare"/,'Ultra Rare is one tap away');
assert.match(ghostSheet,/class="card-printing-mini"[^>]*data-printing="SYR-EN000::Ultra Rare"/,'Other printings lists the other rarity as its own card');
assert.doesNotMatch(ghostSheet,/class="card-printing-mini"[^>]*data-printing="SYR-EN000::Ghost Rare"/,'The open card is not repeated');
assert.doesNotMatch(ghostSheet,/Available artwork|Open Sort &amp; filter|Open Sort & filter|Preview loaded/,'No artwork dump or instruction text');
const mixed={...card,id:'10000012',name:'Synthetic Pharaoh Servant',sets:[{...base,code:'SYR-EN001',rarity:'Rare',productId:null,quotes:[]},{...ultra,code:'SYR-EN001',productId:3,quotes:[{edition:'1st Edition',market:2.88}]}]};
cache.ygo[mixed.id]=mixed;Object.assign(ui('ygo').set,{cards:[mixed],rarity:'',edition:''});
html=tcgSet();assert.match(html,/data-printing="SYR-EN001::Ultra Rare"/,'An unpriced common rarity does not hide a priced one');assert.match(html,/\$2\.88/);assert.doesNotMatch(html,/No quote yet/);
Object.assign(ui('ygo').set,{cards:[card]});
const [other]=normalizeYgoSets([{set_name:'Synthetic Doom',set_code:'SYD',tcg_date:'2025-07-26'}]);
const two={game:'ygo',id:'10000011',name:'Synthetic Primoria',category:'Monster',stats:[],typeLine:'Effect Monster',sets:[{name:other.name,code:'SYD-EN021',rarity:'Common'},{name:release.name,code:'SYR-EN066',rarity:'Ultra Rare'}],prices:{usd:1},fetchedAt:new Date().toISOString()};
cache.ygo[two.id]=two;ui('ygo').sets.list=[release,other];
const doom=tcgCardSheet(setContextCard('ygo',two,other,[release,other]),{type:'tcard',game:'ygo',id:two.id,setId:other.id,tab:'overview'});
assert.match(doom,/class="card-printing-mini"[^>]*data-set-id="[^"]+"[^>]*data-printing="SYR-EN066::Ultra Rare"/,'Printings in other releases are listed, not only the open release');
// TCGplayer naming seen in Magnificent Monsters (3 Nov 2026): Starlight only as "(Starlight Rare)  (Extended Art)",
// Ultra Rare twice (standard + Extended Art), GMR as "(GMR)", and a slightly different provider name.
{
 const q=m=>[{edition:'1st Edition',market:m}];
 const prod=(name,code,rarity,productId,m)=>({name,code,rarity,productId,quotes:q(m)});
 const sc={game:'ygo',id:'20000001',name:'Synthetic Servant of the Sun',sets:['Ultra Rare','Starlight Rare','Grand Master Rare','New'].map(r=>({name:release.name,code:'SYR-EN001',rarity:r}))};
 const body={name:release.name,code:release.code,status:'ready',source:'TCGplayer via TCGCSV',updatedAt:new Date().toISOString(),products:[
  prod('Synthetic Servant of the Sun','SYR-EN001','Ultra Rare',11,2.88),prod('Synthetic Servant of the Sun (Extended Art)','SYR-EN001','Ultra Rare',12,130.25),
  prod('Synthetic Servant of the Sun (Starlight Rare)  (Extended Art)','SYR-EN001','Starlight Rare',13,1132.84),prod('Synthetic Servant of the Sun (GMR)','SYR-EN001','Grand Master Rare',14,5000)]};
 const priced=applyYgoSetPrices(sc,release,body).sets,by=r=>priced.find(x=>x.rarity===r);
 assert.equal(by('Ultra Rare').productId,11,'Standard art wins over the Extended Art duplicate');
 assert.equal(by('Starlight Rare').productId,13,'Rarity tag followed by an art tag still matches');
 assert.equal(by('Grand Master Rare').productId,14,'GMR is priced');
 assert.equal(by('New').productId,undefined,'Placeholder rarity is never priced');
 const close={...sc,name:'Synthetic Dragon of the Four Heavenly Suns',sets:[{name:release.name,code:'SYR-EN013',rarity:'Ultra Rare'}]};
 assert.equal(applyYgoSetPrices(close,release,{...body,products:[prod('Synthetic Dragon, Four Heavenly Suns','SYR-EN013','Ultra Rare',15,1)]}).sets[0].productId,15,'A close provider spelling keeps its price');
 assert.equal(applyYgoSetPrices(close,release,{...body,products:[prod('Another Card Entirely','SYR-EN013','Ultra Rare',16,1)]}).sets[0].productId,undefined,'A different card name is still refused');
 const ext=(n,r)=>[{name:'Number',value:'SYR-EN001'},{name:'Rarity',value:r}];
 assert.deepEqual(ygoProductMatches({code:'SYR-EN001',rarity:'Ultra Rare'},[{productId:11,name:'X',extendedData:ext(0,'Ultra Rare')},{productId:12,name:'X (Extended Art)',extendedData:ext(0,'Ultra Rare')}]).map(p=>p.productId),[11],'Card-page join prefers the standard art too');
}
console.log('PASS: one YGO tile per card at its most common rarity; detail uses rarity chips, edition picker, other-printing tiles; filters still override.');
