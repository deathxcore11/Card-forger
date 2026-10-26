import test from 'node:test';
import assert from 'node:assert/strict';
import {forgeStartingPlayer,forgeDeckBackdrop,mountForgeMatchIntro} from './play-forge-pregame.js';
const state=()=>({viewer:7,players:[{id:7,isViewer:true},{id:9,isViewer:false}],pregame:{schema:'cardstashy.forge-pregame.v1',selection:'random',playStyle:'quick',firstPlayerId:9}});
test('first-player presentation requires a bound native result rather than active-player inference',()=>{
 const s=state();assert.deepEqual(forgeStartingPlayer(s),{firstPlayerId:9,ownFirst:false,selection:'random'});
 delete s.pregame;Object.assign(s,{activePlayer:7,turn:1});assert.equal(forgeStartingPlayer(s),null);
 for(const modify of [s=>s.pregame.firstPlayerId=3,s=>s.pregame.selection='invented',s=>s.players[1].id=7,s=>s.viewer=2,s=>s.pregame.schema='invented']){const bad=state();modify(bad);assert.equal(forgeStartingPlayer(bad),null);}
 const override=state();override.pregame.selection='first';override.pregame.playStyle='practice';assert.equal(forgeStartingPlayer(override).ownFirst,false);
});
test('deck introduction uses prepared artwork and preserves the selected printing',()=>{
 const queries=[],deck={commander:'Commander',cards:[{name:'Commander',printingId:'selected'},{name:'Plains'}]};
 assert.equal(forgeDeckBackdrop(deck,(name,id)=>{queries.push([name,id]);return {image_uris:{art_crop:'https://cards.example/selected.jpg'}};}),'https://cards.example/selected.jpg');
 assert.deepEqual(queries,[['Commander','selected']]);
 assert.equal(forgeDeckBackdrop(deck,()=>({image_uris:{art_crop:'javascript:bad'}})),null);
});
test('VS backdrop honors stored printing preferences and commander records without substitution',()=>{
 const queries=[],deck={commanders:[{name:'Captain’s Choice',qty:1}],cards:[{name:"Captain's Choice",qty:1},{name:'Plains',qty:99}],referencePriceSelections:{"captain's choice":{printingId:'preferred-printing'}}};
 const lookup=(name,id)=>{queries.push([name,id]);return id==='preferred-printing'?{image_uris:{art_crop:'https://cards.example/preferred.jpg'}}:null;};
 assert.equal(forgeDeckBackdrop(deck,lookup),'https://cards.example/preferred.jpg');
 assert.deepEqual(queries,[["Captain's Choice",'preferred-printing']]);
 deck.cards[0].printingId='row-printing';queries.length=0;
 assert.equal(forgeDeckBackdrop(deck,(name,id)=>{queries.push([name,id]);return id==='row-printing'?{image_uris:{art_crop:'https://cards.example/row.jpg'}}:null;}),'https://cards.example/row.jpg');
 assert.deepEqual(queries,[["Captain's Choice",'row-printing']]);
 assert.equal(forgeDeckBackdrop(deck,()=>null),null);
});
function dom(){
 const doc={defaultView:{matchMedia:()=>({matches:false})}};
 doc.createElement=tag=>({tag,children:[],attributes:{},events:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},remove(){},addEventListener(name,fn){this.events[name]=fn;},focus(){}});
 const root=doc.createElement('main');root.ownerDocument=doc;return {doc,root};
}
test('toss shows one committed result and stops its presentation when the account becomes stale',async()=>{
 const {root}=dom(),s=state(),delays=[];let current=true;
 const intro=mountForgeMatchIntro({root,setup:{profile:{username:'player'},selected:{name:'First deck'},opponent:{name:'Second deck'},match:{format:'Modern'},playStyle:'quick'},isCurrent:()=>current,wait:async ms=>{delays.push(ms);current=false;}});
 assert.equal(await intro.reveal(s),false);assert.deepEqual(delays,[950]);
 current=true;intro.destroy();assert.equal(await intro.reveal(s),false);assert.equal(delays.length,1);
});
test('Quick Play chooses randomly; Practice waits for an explicit preference and cancellation sends none',async()=>{
 const setup={profile:{},selected:{name:'One'},opponent:{name:'Two'},match:{format:'Modern'}};
 const quick=mountForgeMatchIntro({root:dom().root,setup:{...setup,playStyle:'quick'}});assert.equal(await quick.chooseStartingPlayer(),'random');
 const {root}=dom(),practice=mountForgeMatchIntro({root,setup:{...setup,playStyle:'practice'}});
 let answered=false;const choosing=practice.chooseStartingPlayer().then(value=>{answered=true;return value;});await Promise.resolve();assert.equal(answered,false);
 const stage=root.children[0],chooser=stage.children.at(-1),options=chooser.children.find(n=>n.className==='forge-intro-start-options');
 options.children[2].events.click();assert.equal(await choosing,'second');
 const cancelled=practice.chooseStartingPlayer();practice.destroy();assert.equal(await cancelled,null);
});
