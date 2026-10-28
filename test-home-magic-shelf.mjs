// Actual Magic shelf renderer, offline synthetic reference-price fixtures only.
import assert from 'node:assert/strict';
// Only eligibility-checked quotes participate; legacy entries are covered in test-cheapest.mjs.
const cache={
  'cache-only card':{usd:12976,verified:true,coverage:{provider:'Scryfall',pages:1,marketComplete:false},at:Date.now()},
  'cheaper card':{usd:2,verified:true,coverage:{provider:'Scryfall',pages:1,marketComplete:false},at:Date.now()},
};
const storage=new Map([['cardstashy-mtg-cheapest',JSON.stringify(cache)]]);
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
let networkAttempts=0;globalThis.fetch=()=>{networkAttempts++;throw Error('No network in shelf regression');};
const {S,blank}=await import('./store.js');
const {deckTile,rowsFor,totalsFor}=await import('./views.js');
const {deckValue}=await import('./insights.js');
S.state=blank();
const card=(name,usd,type_line='Sorcery')=>({name,prices:{usd},type_line,legalities:{vintage:'legal'}});
S.catalog={
  'priced card':card('Priced card','356'),
  'cache-only card':card('Cache-only card',null,'Artifact'),
  'swamp':card('Swamp','0','Basic Land — Swamp'),
  'cheaper card':card('Cheaper card','100'),
  'unknown card':card('Unknown card',null),
};
const make=(cards,side=[])=>({id:'shelf-fixture',name:'Synthetic shelf deck',format:'Vintage',cards,side});
const d=make([{name:'Priced card',qty:1},{name:'Cache-only card',qty:1},{name:'Swamp',qty:58}]);
S.state.decks=[d];
assert.deepEqual(deckValue(d.cards,S.catalog),{total:356,unpriced:1},'existing catalog-only resolver is unchanged outside shelf');
let html=deckTile(d);
assert.doesNotMatch(html,/\$13,332|<\/em> value|to finish/);assert.match(html,/<em>60<\/em> to find/);
assert.doesNotMatch(html,/\$356<\/em> value|unpriced/);assert.match(html,/60\/60/);assert.match(html,/>0%<\/em> owned/);
assert.equal(rowsFor(d).find(r=>r.name==='Cache-only card').price,12976);
const cheaper=make([{name:'Cheaper card',qty:3}]);
html=deckTile(cheaper);assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
S.state.priceChoices={'cheaper card':{price:9,finish:'foil'}};
html=deckTile(cheaper);assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
S.state.priceChoices={};
const partial=make([{name:'Priced card',qty:1},{name:'Unknown card',qty:2}]);
html=deckTile(partial);assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
html=deckTile(make([{name:'Unknown card',qty:2}]));
assert.doesNotMatch(html,/\$0/);assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
html=deckTile(make([{name:'Swamp',qty:2}]));assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
S.state.collection=[{name:'Cheaper card',qty:1}];
html=deckTile(cheaper);assert.match(html,/>33%<\/em> owned/);assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
S.state.collection=[{name:'Cheaper card',qty:3,reserved:2}];
html=deckTile(cheaper);assert.match(html,/>33%<\/em> owned/,'existing reserved-copy availability remains unchanged');assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
S.state.collection=[{name:'Unknown card',qty:2}];
html=deckTile(partial);assert.doesNotMatch(html,/\$\d|<\/em> value|for listed cards|unpriced/);
html=deckTile(make([{name:'Unknown card',qty:2}]));assert.match(html,/>100%<\/em> owned/);assert.doesNotMatch(html,/value unavailable|to finish|cost unavailable/);
S.state.collection=[];
const side=make([{name:'Swamp',qty:60}],[{name:'Priced card',qty:1},{name:'Unknown card',qty:3}]);
html=deckTile(side);assert.equal(totalsFor(side).copies,64);assert.doesNotMatch(html,/subtotal|unpriced|\$\d/);
assert.equal(networkAttempts,0);
console.log('PASS: Magic shelf rows keep one main-plus-sideboard USD basis; deck tiles show owned and to-find with no prices, and no fetch.');
