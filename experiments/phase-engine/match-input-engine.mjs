import assert from 'node:assert/strict';
import {bootMechanics} from './mechanics-inputs.mjs';import {prepareMatchInput,evaluateMatchAdmission} from './match-input.mjs';
const {engine,provenance}=await bootMechanics();
const d={name:'Basic legality control',format:'Standard',cards:[{name:'Forest',qty:60}],side:[]};
const input=prepareMatchInput({player:d,opponent:d,format:'Standard',difficulty:'Medium',runtimeIdentity:provenance.buildIdentity});
const result=evaluateMatchAdmission(engine,input,{testedCardNames:['Forest'],coverageVersion:'research-control'});
assert(result.seats.player.constructionLegal);assert(result.seats.opponent.constructionLegal);
d.cards=[{name:'Grizzly Bears',qty:60}];const bad=evaluateMatchAdmission(engine,prepareMatchInput({player:d,opponent:d,format:'Standard',difficulty:'Medium',runtimeIdentity:provenance.buildIdentity}),{testedCardNames:['Forest','Grizzly Bears'],coverageVersion:'research-control'});assert.equal(bad.admitted,false);assert.equal(bad.seats.player.constructionLegal,false);
console.log(JSON.stringify({provenance,validBasicControl:result,invalidCopiesAndStandard:bad,limits:'Construction gate and lossless snapshot bridge only. Not CPU strength or broad supported-pool validation.'}));
