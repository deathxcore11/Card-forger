import test from 'node:test';import assert from 'node:assert/strict';
import {PRACTICE_STARTER_ROWS,PRACTICE_STARTER_NAME,selectPracticeStarter} from './play-starter-deck.js';
import {createPlaySetup} from './play-setup.js';import {parsePlayDeckImport} from './play-deck-import.js';
test('starter selection uses the real importer and freezes two lists without saving an owner deck',async()=>{
 const saved=[{id:'original',name:'My original',format:'Standard',cards:[{name:'Island',qty:60}],side:[]}],before=structuredClone(saved);
 const setup=createPlaySetup({readAccount:()=>({user:{id:'starter-owner'},accountGeneration:1}),readDecks:()=>saved,parseImport:parsePlayDeckImport,resolveNames:async()=>({failed:[]})});
 const selected=await selectPracticeStarter(setup);assert.deepEqual(saved,before);assert.equal(selected.match.format,'Standard');assert.equal(selected.selectedSource,'import');assert.equal(selected.selected.name,PRACTICE_STARTER_NAME);assert.equal(selected.selected.cards.reduce((n,r)=>n+r.qty,0),60);assert.deepEqual(selected.selected.cards,PRACTICE_STARTER_ROWS);assert.deepEqual(selected.opponent.cards,selected.selected.cards);
 selected.selected.cards[0].qty=1;assert.equal(setup.snapshot().opponent.cards[0].qty,24);
});
test('starter matching cannot select a list after the account changes',async()=>{
 let account={user:{id:'one'},accountGeneration:1};const setup=createPlaySetup({readAccount:()=>account,readDecks:()=>[],parseImport:parsePlayDeckImport,resolveNames:async()=>{account={user:{id:'two'},accountGeneration:2};return {failed:[]};}});
 await assert.rejects(selectPracticeStarter(setup));assert.equal(setup.snapshot().selected,null);assert.equal(setup.snapshot().opponent,null);
});
