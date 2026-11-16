// A Yu-Gi-Oh! lot saved with its release but not its printing (Randall, 12 Nov, app 0.4.66: "the foil is not on the grid view,
// only the pop-up ... it doesn't know what edition it is"). The card page resolves the printing from the saved release; the
// Cards tab, Value and binders must show that same rarity and foil. A lot whose printing is truly unknown still borrows nothing.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
const records=new Map();globalThis.localStorage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,String(v))};
globalThis.fetch=async()=>{throw Error('No network permitted');};
const {cache,ui,tcgCollection,savedYgoPresentation,selectedYgoCard,setContextCard}=await import('./tcg.js');
const {resolveFinish}=await import('./finish-effects.js');
const {normalizeYgoSets}=await import('./ygo.js');
const {valueTopLots}=await import('./value-page.js');
const {binderPage}=await import('./binders.js');
S.state=blank();S.state.settings.game='ygo';S.state.tcg={ygo:blankGame(),ptcg:blankGame()};
const card={id:'27204311',game:'ygo',name:'Release fixture',category:'Monster',sets:[
 {name:'2019 Gold Sarcophagus Tin',code:'TN19-EN013',rarity:'Prismatic Secret Rare',price:3},
 {name:'2020 Tin of Lost Memories',code:'MP20-EN001',rarity:'Ultra Rare',price:1},
 {name:'Two In One',code:'TWO-EN001',rarity:'Super Rare',price:1},{name:'Two In One',code:'TWO-EN001',rarity:'Secret Rare',price:2}],prices:{usd:3},stats:[],artSchema:1,printPriceSchema:1};
const releases=normalizeYgoSets([{set_code:'TN19',set_name:'2019 Gold Sarcophagus Tin',tcg_date:'2019-08-29'},{set_code:'MP20',set_name:'2020 Tin of Lost Memories',tcg_date:'2020-08-27'},{set_code:'TWO',set_name:'Two In One',tcg_date:'2021-01-01'}]);
ui('ygo').sets.list=releases;cache.ygo[card.id]=card;ui('ygo').coll.tab='cards';
const rel=n=>releases.find(s=>s.name===n).id,lot=(id,more)=>({id,cardId:card.id,name:card.name,qty:1,printing:'',rarity:'',edition:'',condition:'NM',...more});
const pageEffect=l=>{const c=selectedYgoCard(setContextCard('ygo',card,l.setReleaseId,releases,{variantKey:''}),'','');return resolveFinish('ygo',c,{type:'tcard',game:'ygo',id:card.id,setId:l.setReleaseId,entryId:l.id}).effect;};
const effects=l=>{S.state.tcg.ygo.collection=[l];const row={entry:l,card,image:'',game:'ygo',owned:true};
 return [tcgCollection(),valueTopLots({game:'ygo',rows:[{...row,unit:3,valuation:{price:3,kind:'reference'}}]}),binderPage([row],'t')].map(h=>(h.match(/data-finish-effect="([^"]*)"/)||[])[1]);};
// The release names one printing: every list wears what the page wears.
const pinned=lot('pinned',{setReleaseId:rel('2019 Gold Sarcophagus Tin')});
assert.equal(pageEffect(pinned),'ygo-prismatic');
assert.deepEqual(effects(pinned),['ygo-prismatic','ygo-prismatic','ygo-prismatic'],'Cards, Value and binder follow the saved release');
assert.equal(savedYgoPresentation(card,pinned).savedPrintingUnresolved,false);assert.doesNotMatch(tcgCollection(),/Printing not verified/);
// Randall's pick: such a lot is marked 'Edition not set' in the Cards list; a lot with its own saved printing is not.
S.state.tcg.ygo.collection=[pinned];assert.match(tcgCollection(),/Edition not set/);assert.equal(savedYgoPresentation(card,pinned).printingFromRelease,true);
// The same with the printing code saved but no rarity.
assert.deepEqual(effects(lot('code',{setReleaseId:rel('2019 Gold Sarcophagus Tin'),printing:'TN19-EN013'})),['ygo-prismatic','ygo-prismatic','ygo-prismatic']);
// Nothing is borrowed when the identity is not known: no release, a release with two rarities of the card, a printing code from another release, an unverified release.
for(const [why,l] of [['no release',lot('none')],['two rarities in the release',lot('two',{setReleaseId:rel('Two In One')})],
 ['printing from another release',lot('other',{setReleaseId:rel('2019 Gold Sarcophagus Tin'),printing:'MP20-EN001'})],
 ['unverified release',lot('unv',{setReleaseId:rel('2019 Gold Sarcophagus Tin'),setReleaseUnverified:true})]]){
 assert.equal(savedYgoPresentation(card,l).savedPrintingUnresolved,true,why);
 for(const e of effects(l))assert.notEqual(e,'ygo-prismatic',why);assert.equal(effects(l)[0],'unknown',why);
}
// A saved printing and rarity still win over the release.
assert.equal(effects(lot('saved',{setReleaseId:rel('2020 Tin of Lost Memories'),printing:'MP20-EN001',rarity:'Ultra Rare'}))[0],'ygo-ultra');
assert.doesNotMatch(tcgCollection(),/Edition not set/);
console.log('PASS: a lot saved with only its release wears the release\'s one printing in Cards, Value and binders, as the card page does; unknown identity borrows nothing.');
