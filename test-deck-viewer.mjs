import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {deckPage,deckList,totalsFor} from './views.js';
import {deckViewFor,deckViewControl,deckCardCategory,deckCardAttrs} from './deck-viewer.js';
import {registerWorkbench,modeFor,viewControl} from './workbench-ui.js';
import {deckWorkspaceSignature} from './deck-experience.js';
import {proven,provenSheetHtml} from './tcg.js';
import {sharedDeckSheet} from './shared-deck-view.js';
S.state=blank();
const card={id:'shared',name:'Shared zone card',type_line:'Creature — Human',oracle_text:'',cmc:1,prices:{usd:'2'},image_uris:{normal:'https://example.com/exact-printing.jpg'},legalities:{standard:'legal'},finishes:['nonfoil']};
S.catalog['shared zone card']=card;
const deck={id:'zones',name:'Separate quantities',format:'Standard',cards:[{name:card.name,qty:2}],side:[{name:card.name,qty:1}],versions:[]};
S.state.decks=[deck];S.state.activeDeck=deck.id;S.ui.deckId=deck.id;S.ui.deckTab='cards';S.ui.q.deck='';S.ui.deckFilter='all';
const html=deckPage();
assert.match(html,/2\/60<\/b>cards · 1 sideboard/);
assert.match(html,/58 slots remain/);
assert.match(html,/data-deck-name="Shared zone card" data-deck-qty="2" data-deck-zone="main"/);
assert.match(html,/data-deck-name="Shared zone card" data-deck-qty="1" data-deck-zone="side"/);
assert.doesNotMatch(deckList(deck),/data-deck-qty="3"/);
assert.equal(totalsFor(deck).copies,3,'shopping retains the whole physical list');
assert.equal(totalsFor(deck).pricedGap,6,'shopping still includes both zones');
proven.spec={g:'ygo',key:'source-zones',title:'Source zones',sub:'',evidence:'Synthetic zone fixture',lists:[],rows:[{key:'source-extra',name:'Extra source card',qty:2,zone:'extra',kind:'Extra',price:1,owned:0}]};
proven.mode='original';proven.busy=false;proven.msg='';
assert.match(provenSheetHtml(),/data-deck-name="Extra source card" data-deck-qty="2" data-deck-zone="extra"/,'source Extra Deck rows retain their explicit zone');
// Stack classification follows loaded game metadata and the front face.
for(const [card,category] of [
 [{type_line:'Artifact Creature — Golem'},'Creatures'],
 [{type_line:'Basic Land — Forest'},'Lands'],
 [{type_line:'Instant // Land'},'Instants'],
 [{type_line:'Enchantment Creature — Spirit'},'Creatures'],
 [{category:'Pokemon',typeLine:'Grass · Basic'},'Pokémon'],
 [{category:'Trainer',typeLine:'Item'},'Trainers'],
 [{category:'Energy',typeLine:'Basic Energy'},'Energy'],
 [{category:'Monster',typeLine:'Effect Monster'},'Monsters'],
 [{category:'Spell',typeLine:'Spell Card'},'Spells'],
 [{category:'Trap',typeLine:'Trap Card'},'Traps'],
 [{name:'Mystery Creature Name'},'Unresolved']
])assert.equal(deckCardCategory(card),category);
assert.match(deckCardAttrs('Synthetic ramp',1,'main',{type_line:'Creature — Elf Druid',oracle_text:'{T}: Add {G}.'}),/data-deck-roles="Ramp"/);
assert.match(sharedDeckSheet({sharedItem:{game:'ygo',key:'unloaded-shared',title:'Unknown shared card',cards:[{name:card.name,qty:1,zone:'main',image:'',referenceUSD:null}]}}),/data-deck-category="Unresolved"/,'unknown non-Magic shared cards cannot borrow same-name Magic metadata');
const actions={},changes={},calls=[];let closes=0;
globalThis.document={querySelector(){return null;},querySelectorAll(){return [];}};
registerWorkbench({A:actions,C:changes,commit:async(fn,opts)=>{calls.push(opts);fn(S.state);},closeSheet:()=>closes++,getGame:()=> 'mtg'});
const before=JSON.stringify({decks:S.state.decks,collection:S.state.collection});
const signature=deckWorkspaceSignature(S.state);
const ctx={type:'deck-flow',result:'exact-result'};S.ui.sheetCtx=ctx;
for(const game of ['mtg','ptcg','ygo'])for(const mode of ['compact','stacks','gallery','symbols']){
 await actions.deckView({dataset:{game,mode}});
 assert.equal(modeFor(game,'deck'),mode);assert.equal(deckViewFor(game),mode);
 assert.equal(S.ui.sheetCtx,ctx,'view switches keep the exact sheet context');
 assert.match(deckViewControl(game),new RegExp('aria-checked="true"[^>]+data-mode="'+mode+'"'));
 assert.equal((viewControl(game,'deck').match(/role="radio"/g)||[]).length,4);
 assert.equal((viewControl(game,'collection').match(/role="radio"/g)||[]).length,3);
}
assert.equal(JSON.stringify({decks:S.state.decks,collection:S.state.collection}),before);
assert.equal(deckWorkspaceSignature({...S.state,lastSavedAt:'later'}),signature,'display preferences and save time do not invalidate the result');
for(const mutate of [s=>s.collection.push({name:'Changed',qty:1}),s=>s.decks[0].cards[0].qty++,s=>s.myPrices={changed:2},s=>s.priceChoices={changed:'foil'},s=>s.settings.budget++,s=>s.settings.game='ptcg',s=>s.tcg={ygo:{collection:[{qty:1}]}}]){
 const next=structuredClone(S.state);mutate(next);assert.notEqual(deckWorkspaceSignature(next),signature,'meaningful build inputs still invalidate the result');
}
assert.equal(closes,0);assert(calls.every(c=>c.rerender===false&&c.enrich===false&&c.recordDeckWork===false&&c.observeValue===false));
const n=calls.length;await actions.deckView({dataset:{game:'mtg',mode:'unknown'}});await actions.deckView({dataset:{game:'other',mode:'stacks'}});assert.equal(calls.length,n);
S.state.settings.displayModes.mtg.deck='obsolete';assert.equal(deckViewFor('mtg'),'compact');
console.log('PASS: main/side quantities and size remain separate, whole-list purchases remain intact, four shared preferences preserve source context and ownership without rerendering, and collection views remain independent.');
