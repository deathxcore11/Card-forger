import assert from 'node:assert/strict';
import {makeAskTools} from './ai-tools.js';
import {esc} from './ui.js';
const card={category:'Pokemon',name:'Lead card',id:'lead',image:'https://art.test/card.png',imageLarge:'https://art.test/card-large.png',image_uris:{normal:'https://art.test/magic.png',art_crop:'https://art.test/magic-art.png'}};
const data={source:'Fixture tournament',decks:[{key:'winner',name:'Winning deck',cover:'123',list:[{name:card.name,qty:4,kind:'Pokemon'}],main:[{name:card.name,qty:4}]}],archetypes:[{name:'Winning deck',best:'winner',share:.25,count:3}]};
const T={game:()=> 'ptcg',cache:{ptcg:{lead:card},ygo:{lead:card}},cardOf:()=>card,gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data}),metaOwned:()=>({pct:.5,cost:12}),SOURCES:{ptcg:{formats:[{id:'standard',name:'Standard'}],search:async()=>({cards:[card]})},ygo:{}},ui:()=>({})};
let opened=0;
const tools=makeAskTools({S:{state:{settings:{},decks:[]},ui:{}},T,esc,meta:()=>card,inv:()=>({owned:2}),priceOf:()=>1,loadMetaData:async()=>data,MTG_META_FORMATS:[['Modern','Modern']],tcgCtx:{loadMeta:async()=>data},openTcgBuild:()=>opened++});
for(const game of ['mtg','ptcg','ygo']){
 tools.reset();const result=await tools.meta_decks({game,format:game==='mtg'?'Modern':game==='ptcg'?'Standard':'Advanced (TCG)'});assert.equal(result.decks.length,1);
 const item=tools.suggestedItems()[0];assert.equal(item.ref,'winner');
 const html=tools.preview(item,0);assert.match(html,/ask-deck/);assert.match(html,/ask-deck-art/);assert.match(html,/25.0% of the field/);
 assert.match(html,game==='ptcg'?/pk-crop/:game==='ygo'?/img\/ygo\/a\/123/:/magic-art.png/);
 assert.equal(tools.canonicalItem({kind:'meta',game,ref:'Winning deck'}).ref,'winner');
}
// Old builder cards remain attached to their own action after another question.
await tools.build_deck({game:'ptcg',style:'Fire',format:'standard',budget:40});const first=tools.pendingItem();tools.reset();
await tools.build_deck({game:'ptcg',style:'Water',format:'standard',budget:60});const second=tools.pendingItem();
assert.match(tools.preview(first,0),/ask-build-art/);assert.match(tools.preview(first,0),/stashy-logo/);assert.match(tools.preview(first,0),/card-large.png/);assert.match(tools.preview(first,0),/Review list and prices in the builder/);assert.notEqual(first.ref,second.ref);await tools.open(first);assert.equal(opened,1);
console.log('PASS: art-backed meta tiles across all three games, automatic recommendation cards, canonical references and persistent builder-card actions.');
// The archetype's namesake must beat a more plentiful support attacker for the cover.
const slow={...card,id:'slow',name:'Slowking',imageLarge:'https://art.test/slowking.png'};
T.cache.ptcg.slow=slow;
data.decks[0].name='Slowking';data.decks[0].list=[{kind:'Pokemon',name:'Lead card',qty:4},{kind:'Pokemon',name:'Slowking',qty:2}];data.archetypes[0].name='Slowking';
tools.reset();await tools.meta_decks({game:'ptcg'});assert.match(tools.preview(tools.suggestedItems()[0],0),/slowking.png/);
data.archetypes.push({name:'Dhelmise',best:null,share:.04,count:2,icons:['dhelmise']});
tools.reset();await tools.meta_decks({game:'ptcg'});assert.match(tools.preview(tools.suggestedItems()[1],0),/dhelmise.png/);
console.log('PASS: Slowking uses Slowking art instead of a support attacker; an archetype without a placing list uses its supplied icon.');

// A partner tile resolves individual commanders and keeps its format snapshot.
let chosen,looked=[];
const partner={decks:[{key:'partners',name:'First / Second',commanders:['First','Second'],list:[]}],archetypes:[{name:'First / Second',best:'partners',share:.1}]};
const partnerTools=makeAskTools({S:{state:{decks:[],settings:{}},ui:{mtgMeta:{format:'Modern'}}},T:{...T,game:()=> 'mtg'},esc,meta:()=>null,resolve:async name=>{looked.push(name);return name==='Second'?card:null;},inv:()=>({owned:0}),priceOf:()=>1,loadMetaData:async()=>partner,MTG_META_FORMATS:[['Modern','Modern'],['EDH','Commander']],A:{mtgProven:t=>{chosen=t;}}});
await partnerTools.meta_decks({game:'mtg',format:'Commander'});const tile=partnerTools.suggestedItems()[0];assert.deepEqual(looked,['First','Second']);assert.match(partnerTools.preview(tile,0),/magic-art.png/);await partnerTools.open(tile);assert.equal(chosen.metaSnapshot.deck.key,'partners');assert.match(chosen.dataset.format,/Commander|EDH/);
console.log('PASS: partner commander art fallback and exact clickable meta deck format');

// The single-card row retains the existing exact-card handoff, without collection controls.
const stasis={id:'stasis-print',name:'Stasis',set:'me4',set_name:'Masters Edition IV',collector_number:'64',mana_cost:'{1}{U}',image_uris:{normal:'https://art.test/stasis.jpg'}};
const openedCards=[],previewState={settings:{},decks:[],collection:[]};
let activeGame='mtg',quoted=0;
const rowTools=makeAskTools({S:{state:previewState,ui:{}},T:{...T,game:()=>activeGame},esc,meta:()=>stasis,priceOf:()=>quoted,A:{card:args=>openedCards.push(args),tCard:args=>openedCards.push(args)}});
const beforeRow=JSON.stringify(previewState),stasisItem={kind:'card',game:'mtg',ref:'Stasis',label:'Stasis'};
const row=rowTools.preview(stasisItem,0,{compact:true});
assert.match(row,/ask-card-row/);assert.match(row,/ask-card-thumb/);assert.match(row,/ME4 · #64/);assert.match(row,/Mana cost \{1\}\{U\}/);assert.match(row,/\$0\.00/,'a known zero remains a known zero');
assert.doesNotMatch(row,/data-act="(?:edit|add|remove)|data-change=|data-qty/,'read-only preview cannot edit inventory');
const target=JSON.parse(row.match(/data-ask-show='([^']+)'/)[1].replaceAll('&quot;','"'));
await rowTools.open(target);assert.deepEqual(openedCards.at(-1),{dataset:{name:'Stasis'}},'tap opens the same existing card menu');
quoted=null;assert.match(rowTools.preview(stasisItem,0,{compact:true}),/Price unavailable/);
assert.doesNotMatch(rowTools.preview(stasisItem,0),/ask-card-row/,'multi-item previews keep their established presentation');
for(const game of ['ptcg','ygo']){activeGame=game;const html=rowTools.preview({kind:'card',game,ref:'lead',label:'Lead card'},0,{compact:true});assert.match(html,/ask-card-row/);await rowTools.open({kind:'card',game,ref:'lead'});assert.equal(openedCards.at(-1).dataset.id,'lead');}
assert.equal(JSON.stringify(previewState),beforeRow,'previewing and opening cannot mutate collection or decks');
// Exercise actual answer selection: only one card receives the compact flag.
const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
const askSource=readFileSync('ai-ask.js','utf8'),options=[];
const context={SOURCE:{app:['From your app data','app'],mixed:['Mixed','mixed']},state:{tools:{preview:(item,index,opts)=>{options.push(opts);return '<button>Preview</button>';}}},esc,bubble(){}};
runInNewContext(askSource.slice(askSource.indexOf('function answer(a)')),context);
context.answer({source:'app',text:'Fixture answer',show:[stasisItem]});assert.equal(options.at(-1).compact,true);
context.answer({source:'app',text:'Fixture answer',show:[stasisItem,{...stasisItem,ref:'Other'}]});assert(options.slice(-2).every(o=>o.compact===false));
context.answer({source:'app',text:'Fixture answer',show:[{kind:'deck',game:'mtg',ref:'deck'}]});assert.equal(options.at(-1).compact,false);
console.log('PASS: lone-card compact selection, unchanged multi-card/deck previews, mana/printing/zero/unknown quotes and existing all-game card-menu actions, with no inventory mutation.');
