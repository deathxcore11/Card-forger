// Real contract and dispatch, with deterministic app I/O; no live AI call.
import assert from 'node:assert/strict';
import {readBuildContract,validateBuildProposal,lockBuildContract} from './ai-build-contract.js';
import {makeAskTools} from './ai-tools.js';
import {TOOLS} from './ai-ask-route.js';
import {deckSetupMarkup,deckResultMarkup} from './deck-experience.js';
import {FORMATS} from './formats.js';
const msg=content=>({type:'message',role:'user',content});
const contract=readBuildContract([msg('Build a Standard deck for best-of-three under $50')]);assert.equal(contract.matchMode,'bo3');
assert.equal(readBuildContract([msg('Standard BO1 deck')]).matchMode,'bo1');assert.equal(readBuildContract([msg('Standard deck')]).matchMode,undefined);
assert.equal(readBuildContract([msg('Standard, not best-of-three')]).matchMode,undefined);
const args={game:'mtg',format:'Standard',matchMode:'bo3',style:'',seed:'',commander:'',budget:50,budget_basis:'total',goal:'strongest',required_cards:[],excluded_cards:[],candidate_cards:[],colors:[],avoid_infinite:false};
const checked=validateBuildProposal(args,contract);assert(checked.ok,JSON.stringify(checked));assert.equal(lockBuildContract(checked.args).matchMode,'bo3');
assert(!validateBuildProposal({...args,matchMode:'bo1'},contract).ok);
const schema=TOOLS.find(t=>t.name==='build_deck').parameters;assert(schema.required.includes('matchMode'));assert.deepEqual(schema.properties.matchMode.enum,['unspecified','bo1','bo3']);
let captured;const tools=makeAskTools({S:{state:{collection:[],decks:[]},catalog:{},ui:{}},T:{game:()=> 'mtg'},deckExperience:{build:async request=>{captured=request;return {ok:false,message:'fixture boundary'};}}});
await tools.build_deck(args);assert.equal(captured.matchMode,'bo3','Actual Ask dispatch preserves the checked match mode');
const setup=deckSetupMarkup({request:{game:'mtg',format:'Standard',matchMode:'bo3'}},{mtg:FORMATS});assert.match(setup,/data-flow-field="matchMode"/);assert.match(setup,/<option value="bo3" selected>/);
console.log('PASS: explicit match mode survives natural request contract, correction lock, actual Ask dispatch and manual preferences; unspecified remains unspecified.');
