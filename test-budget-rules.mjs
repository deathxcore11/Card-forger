import assert from 'node:assert/strict';
import {purchaseCost,bestBudgetDecks,swappedZones,comparePower,sameCardLogic} from './deck-optimizer.js';
import {selectHistoryDataset} from './workbench-ui.js';
import {ruleText,effectText,ruleDexPanel} from './rule-dex.js';
import {ygoProductMatches,applyYgoPrices,editionPrice,ygoPriceRoute} from './ygo-prices.js';
import {entryPrice} from './tcg.js';
import {tradePanel,tradeMatches} from './trade.js';
const quote=new Map([['engine',15],['filler',1],['unknown',null]]),owned=new Map([['engine',1]]);
const cost=d=>purchaseCost(d.rows,{key:r=>r.name,owned:r=>owned.get(r.name)||0,price:r=>quote.get(r.name)});
assert.deepEqual(cost({rows:[{name:'engine',qty:1},{name:'engine',qty:1}]}),{cost:15,unknown:0},'owning one copy is not duplicated across zones');
const p=(score,provisional=false)=>({score,readiness:{provisional,unknown:provisional?4:0,issues:[]}});
for(const game of ['mtg','ptcg','ygo']){
 const candidates=[{name:'draft',rows:[{name:'filler',qty:2}],assessment:p(65)},{name:'winner',proven:game+':winner',rows:[{name:'engine',qty:2}],assessment:p(95)},{name:'illegal',rows:[],assessment:p(99,true)},{name:'unpriced',rows:[{name:'unknown',qty:2}],assessment:p(75)}];
 const results=bestBudgetDecks(candidates,[0,5,15,100,Infinity],{evaluate:d=>d.assessment,cost});
 assert.equal(results[1].name,'draft');assert.equal(results[2].name,'winner');assert.equal(results.at(-1).name,'winner');assert.ok(results.every((d,i)=>!i||comparePower(d.assessment,results[i-1].assessment)>=0));assert.ok(!results.slice(0,-1).some(d=>d.name==='unpriced'));
}
const deck={zones:{main:[{cardId:'a',name:'A',qty:2}],extra:[],side:[]}},next=swappedZones(deck,'main','a',{id:'b',name:'B'});assert.equal(deck.zones.main[0].qty,2);assert.equal(next.zones.main.reduce((n,r)=>n+r.qty,0),2);
const archive={source:'old',points:[{date:'2026-09-13',value:1},{date:'2026-09-14',value:2}]},recent={source:'current',points:[{date:'2026-10-13',value:3}]},now=Date.parse('2026-10-14T18:00:00Z');
assert.equal(selectHistoryDataset([archive,recent],'30',null,now).source,'current');assert.equal(selectHistoryDataset([archive,recent],'365',null,now).source,'old');assert.equal(selectHistoryDataset([archive,recent],'30','old',now).source,'old','manual choice remains explicit');
const markup=ruleText('mtg','Flying, vigilance. <img src=x onerror=alert(1)>');assert.match(markup,/data-rule="flying"/);assert.match(markup,/&lt;img/);assert.doesNotMatch(markup,/<img src=x/);
assert.doesNotMatch(ruleText('ygo','"Chimera the Flying Mythical Beast"'),/rule-word/);assert.match(ruleText('ygo','(Quick Effect): banish this card from your GY; Special Summon it.'),/data-rule="Quick Effect"/);assert.match(ruleDexPanel('ptcg'),/Burned/);
assert.match(effectText('ygo','If summoned: discard 1 card; draw 2 cards.'),/logic-condition.*logic-activation.*logic-resolution/);
const products=[['Secret Rare',10],['Starlight Rare',11]].map(([rarity,productId])=>({productId,extendedData:[{name:'Number',value:'MAMO-EN038'},{name:'Rarity',value:rarity}]}));
assert.equal(ygoProductMatches({code:'MAMO-EN038',rarity:'Starlight Rare'},products)[0].productId,11);assert.equal(ygoProductMatches({code:'WRONG',rarity:'Secret Rare'},products).length,0);
const card={game:'ygo',id:'1',sets:[{code:'MAMO-EN038',rarity:'Starlight Rare'}],prices:{usd:.23}};
const body={cardId:'1',source:'TCGCSV',updatedAt:'2026-10-14',printings:[{code:'MAMO-EN038',rarity:'Starlight Rare',productId:11,quotes:[{edition:'1st Edition',market:18.62},{edition:'Unlimited',market:16}]}]};
assert.ok(applyYgoPrices(card,body));assert.equal(editionPrice(card.sets[0],'1st-edition'),18.62);assert.equal(entryPrice(card,{printing:'MAMO-EN038',rarity:'Starlight Rare',edition:'1st-edition'}),18.62);assert.equal(entryPrice(card,{printing:'MAMO-EN038',edition:'limited'}),null);
const route=await ygoPriceRoute(new URL('https://fixture/api/prices/yugioh?id=1'),{},async u=>{
 if(u.includes('ygoprodeck'))return Response.json({data:[{id:1,card_sets:[{set_name:'Magnificent Monsters',set_code:'MAMO-EN038',set_rarity:'Secret Rare'},{set_name:'Magnificent Monsters',set_code:'MAMO-EN038',set_rarity:'Starlight Rare'}]}]});
 if(u.endsWith('/groups'))return Response.json({results:[{groupId:2,name:'Magnificent Monsters'}]});if(u.endsWith('/products'))return Response.json({results:products});if(u.endsWith('/prices'))return Response.json({results:[{productId:10,subTypeName:'1st Edition',marketPrice:.41},{productId:11,subTypeName:'1st Edition',marketPrice:18.62}]});throw Error('Unexpected '+u);
});assert.equal((await route.json()).printings.length,2);
const empty=tradePanel({key:'t',price:5},[{key:'lot',price:null,qty:1}],[],{game:'ygo'});assert.match(empty,/no usable quote/);assert.doesNotMatch(empty,/Add cards to your collection to see/);
assert.equal(tradeMatches({target:{key:'a',price:5},owned:[{key:'lot',cardKey:'a',price:5,qty:1}]}).singles.length,0);
console.log('PASS: all-game budget tournament competition, monotonic quality, legality/unknown-cost gates, physical ownership, in-range source choice, safe game-specific rule dex, exact YGO rarity/edition prices and honest trade states.');

assert.equal(sameCardLogic('ptcg',{id:'a',name:'Charizard',attacks:[{name:'Attack',damage:'100'}]},{id:'b',name:'Charizard',attacks:[{name:'Attack',damage:'200'}]}),false,'A different same-name Pokémon is not a tournament printing substitution');
