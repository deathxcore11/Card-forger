import assert from 'node:assert/strict';
import {completionPlan} from './planner.js';
import {cardKey,sumQty} from './core.js';
import {setBadge,customBudget} from './ui.js';
import {S,blank} from './store.js';
import * as V from './views.js';
import { mtgPower, shownPower } from './power.js';
const leader={id:'leader',name:'Metal Leader',type_line:'Legendary Artifact Creature',oracle_text:'Artifact creatures you control get a bonus.',color_identity:[],legalities:{commander:'legal'},cmc:3,prices:{usd:'5'},set:'TST',set_name:'Test Set',collector_number:'1',rarity:'rare'},land={name:'Wastes',type_line:'Basic Land',color_identity:[],legalities:{commander:'legal'},prices:{usd:'4'},cmc:0,set:'OGW'},spells=Array.from({length:75},(_,i)=>({name:'Machine '+i,type_line:'Artifact Creature',oracle_text:i%2?'When this creature enters, draw a card.':'',color_identity:[],legalities:{commander:'legal'},cmc:2,prices:{usd:'.1'},set:'TST'}));
const catalog=Object.fromEntries([leader,land,...spells].map(c=>[cardKey(c.name),c])),deck={id:'d',name:'Metal test',commander:leader.name,format:'Commander',strategy:'Artifacts',cards:[{name:leader.name,qty:1}]},owned=[{id:'owned',name:leader.name,qty:1,reserved:0}];
const larger=completionPlan(deck,owned,[],catalog,{budget:200,landTarget:36});assert.equal(sumQty(larger.deck.cards),100);assert.equal(larger.stats.lands,36);assert.equal(larger.deck.cards.find(c=>c.name==='Wastes').qty,36);assert.equal(larger.cost>100,true);assert.equal(larger.cost<=200,true);assert.equal(deck.cards.length,1);assert.equal(owned.length,1);
const small=completionPlan(deck,owned,[],catalog,{budget:100});assert.equal(small.cost<=100,true);assert.equal(small.stats.lands<36,true);assert.ok(small.warnings.length);
// The planner must leave money for the rest instead of consuming it on a flashy card.
const expensive={name:'Expensive Machine',type_line:'Artifact Creature',oracle_text:'When this enters, draw a card. Destroy target creature.',color_identity:[],legalities:{commander:'legal'},cmc:2,prices:{usd:'195'},set:'TST'};const cautious=completionPlan(deck,owned,[],{...catalog,[cardKey(expensive.name)]:expensive},{budget:200});assert.equal(sumQty(cautious.deck.cards),100);assert.equal(cautious.deck.cards.some(c=>c.name===expensive.name),false);
assert.equal(customBudget('250.75'),250.75);assert.equal(customBudget('0'),0);assert.throws(()=>customBudget(''),/budget/);assert.throws(()=>customBudget('-1'),/budget/);assert.throws(()=>customBudget('Infinity'),/budget/);
assert.match(setBadge(leader),/TST/);assert.match(setBadge(leader),/Reference printing/);assert.match(setBadge({}, {physical:true,unspecified:true}),/SET \?/);assert.doesNotMatch(setBadge({set:"x');alert(1)//"}),/alert/);
S.state={...blank(),collection:owned,decks:[larger.deck],activeDeck:'d'};S.catalog=catalog;S.ui.deckId='d';assert.doesNotMatch(V.home(),/More tools|New to Commander/);assert.match(V.decks(),/data-act="randomDeckOptions"/);S.ui.decksTab='mine';assert.match(V.decks(),/data-act="randomDeck"/);assert.match(V.ideaSheet({commander:leader,plan:'Artifacts'},larger.deck,{budget:200,busy:false,msg:''},new Set()),/Save 100-card list/);assert.match(V.ideaSheet({commander:leader,plan:'Artifacts'},larger.deck,{budget:200,busy:false,msg:''},new Set()),/id="ideaCustomBudget"/);
console.log('PASS: full 100-card plans with 36 lands, custom budgets above $100, budget reservation, ownership isolation, random controls and set badges.');

// Strategic-model coverage must not masquerade as an incomplete deck.
const assessment=mtgPower(larger.deck), preview=V.ideaSheet({commander:leader,plan:'Artifacts'},larger.deck,{budget:200,busy:false,msg:''},new Set());
assert.equal(assessment.readiness.eligible,true);assert.equal(assessment.readiness.incomplete,false);assert.equal(shownPower(assessment),null);
assert.match(preview,/deck-compact-list/);assert.match(preview,/deck-compact-art/);assert.match(preview,/Reference printing/);assert.match(preview,/TST · #1/);assert.match(preview,/Power unavailable/);assert.match(preview,/>Save as deck<\/button>/);assert.doesNotMatch(preview,/>Save draft<\/button>/);
const invalid={...larger.deck,cards:larger.deck.cards.map(r=>r.name===leader.name?{...r,qty:2}:r.name==='Wastes'?{...r,qty:r.qty-1}:r)};
const invalidPreview=V.ideaSheet({commander:leader,plan:'Artifacts'},invalid,{budget:200,busy:false,msg:''},new Set());
assert.equal(sumQty(invalid.cards),100);assert.equal(mtgPower(invalid).readiness.eligible,false);
assert.match(invalidPreview,/>Save draft<\/button>/);assert.match(invalidPreview,/Deck legality or card-data checks need review/);assert.doesNotMatch(invalidPreview,/0 cards over|>Save as deck<\/button>/);
console.log('PASS: complete legal but strategically unmapped list remains saveable as a deck with unavailable Power; actual legality failures retain draft labels.');
