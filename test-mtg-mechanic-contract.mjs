// Actual request/proposal and builder inspection boundaries. Real Slith rules
// snapshots are used only to inspect the requested mechanic; no model, network,
// pricing, saving, competitive-strength or whole-game claim is involved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBuildContract,applyUserBuildIntent,validateBuildProposal,lockBuildContract} from './ai-build-contract.js';
import {normalizeDeckRequest} from './deck-construction.js';
import {inspectMtgTheme,requestedIntent} from './builder.js';
import {FORMATS} from './formats.js';

const user=content=>({type:'message',role:'user',content});
const baseProposal={game:'mtg',format:'Commander',style:'Vampires',goal:'strongest',seed:'',commander:'',budget:100,budget_basis:'total',colors:['B'],required_cards:[],excluded_cards:[],candidate_cards:[],avoid_infinite:false};
const prompt='Build a mono-black Vampire Bloodlust Commander deck under $100';
const initial=readBuildContract([user(prompt)],null,{game:'mtg'});
assert.deepEqual(initial.themes,['vampire','bloodlust']);
assert.equal(initial.autoSelectSeed,true);
assert.equal(validateBuildProposal(baseProposal,initial).ok,false,'the model cannot quietly omit the requested combat-growth plan');
const restored=applyUserBuildIntent(baseProposal,initial),accepted=validateBuildProposal(restored,initial);
assert.equal(accepted.ok,true,JSON.stringify(accepted));
assert(requestedIntent(accepted.args.style).mechanics.includes('Bloodlust'));
assert.deepEqual(accepted.args.colors,['B']);assert.equal(accepted.args.budget,100);assert.equal(accepted.args.format,'Commander');

const fixture=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/mechanic-plan-cards.json',import.meta.url)));
const slith=fixture.cards.find(card=>card.name==='Slith Firewalker');assert(slith);
const inspectionRows=[{name:slith.name,card:slith,qty:1,zone:'main'}];
const inspected=inspectMtgTheme(inspectionRows,{style:accepted.args.style});
assert(inspected.mechanics.groups.some(group=>group.ability==='Bloodlust'),'the accepted request actually reaches the builder mechanic inspector');
assert.equal(inspected.mechanics.competitive,'unverified','retaining a mechanic does not certify competitive strength');

const locked=lockBuildContract(accepted.args,initial);
const cheaper=readBuildContract([user('Make it cheaper')],locked,{game:'mtg'});
assert(cheaper.themes.includes('bloodlust'));assert(cheaper.themes.includes('vampire'));assert.equal(cheaper.budget,100);
for(const alias of ['Slith ability','slith mechanic','Slith-style','combat counter growth']){
 const contract=readBuildContract([user(`Build a mono-black Vampire ${alias} Commander deck under $100`)],null,{game:'mtg'});
 assert(contract.themes.includes('bloodlust'),alias);assert(!contract.themes.includes('slith'),alias);
 assert.equal(contract.autoSelectSeed,true,alias+' is a general mechanic, not an exact required card');
 const args=applyUserBuildIntent(baseProposal,contract);
 assert.equal(validateBuildProposal(args,contract).ok,true,alias);
 const intent=requestedIntent(args.style);assert(intent.mechanics.includes('Bloodlust'));assert(!intent.tribes.includes('Slith'));
}
const slithType=readBuildContract([user('Build a mono-red Commander deck with only Slith creatures under $100')]);
assert.deepEqual(slithType.creatureTypesOnly,['Slith']);assert(slithType.themes.includes('slith'));assert(!slithType.themes.includes('bloodlust'));

const exactCard=readBuildContract([user('Build around "Blood Lust" in a mono-red Commander deck under $100')]);
assert.deepEqual(exactCard.required_cards,['Blood Lust']);assert(!exactCard.themes.includes('bloodlust'));assert.equal(exactCard.autoSelectSeed,false);
const named=applyUserBuildIntent({...baseProposal,style:'red spells',seed:'Blood Lust',required_cards:['Blood Lust']},exactCard);
assert.equal(named.seed,'Blood Lust');assert(named.required_cards.includes('Blood Lust'));assert(!requestedIntent(named.style).mechanics.includes('Bloodlust'));

for(const revision of ['No Bloodlust','Remove the Bloodlust mechanic','Drop Bloodlust',"I don't want Bloodlust",'I don’t want Bloodlust','Without the slith ability']){
 const revised=readBuildContract([user(revision)],locked,{game:'mtg'});
 assert.deepEqual(revised.themes,['vampire'],revision);assert.deepEqual(revised.removedMechanics,['bloodlust']);
 assert.equal(revised.budget,100);assert.deepEqual(revised.colors,['B']);assert.equal(revised.format,'Commander');
 const stale={...baseProposal,style:'Vampires tokens Bloodlust-style'};
 assert.equal(validateBuildProposal(stale,revised).ok,false,'a later proposal cannot restore the removed mechanic: '+revision);
 const args=applyUserBuildIntent(stale,revised),check=validateBuildProposal(args,revised);
 assert.equal(check.ok,true,JSON.stringify(check));
 assert.match(args.style,/tokens/,'only the explicitly removed mechanic is stripped');
 assert(!requestedIntent(args.style).mechanics.includes('Bloodlust'));
 const request=normalizeDeckRequest(args,{mtg:FORMATS}),plan=inspectMtgTheme(inspectionRows,{style:request.theme});
 assert(!plan.mechanics.groups.some(group=>group.ability==='Bloodlust'),'normalization/rebuild inspection cannot resurrect a stale mechanic');
 const next=readBuildContract([user('Keep the budget the same')],lockBuildContract(check.args,revised),{game:'mtg'});
 assert.deepEqual(next.removedMechanics,['bloodlust']);
 assert(!requestedIntent(applyUserBuildIntent(stale,next).style).mechanics.includes('Bloodlust'));
 const reenabled=readBuildContract([user('Add Bloodlust again')],next,{game:'mtg'});
 assert(!reenabled.removedMechanics.includes('bloodlust'));assert(reenabled.themes.includes('vampire'));assert(reenabled.themes.includes('bloodlust'));
 assert(requestedIntent(applyUserBuildIntent(baseProposal,reenabled).style).mechanics.includes('Bloodlust'));
}

const different=readBuildContract([user('No Bloodlust, use Bloodthirst')],locked,{game:'mtg'});
assert(different.themes.includes('vampire'));assert(different.themes.includes('bloodthirst'));assert(!different.themes.includes('bloodlust'));
const swapped=applyUserBuildIntent({...baseProposal,style:'Vampires Bloodlust'},different);
assert.equal(validateBuildProposal(swapped,different).ok,true);assert.deepEqual(requestedIntent(swapped.style).mechanics,['Bloodthirst']);
for(const revision of ['No Bloodlust or Bloodthirst','Remove Bloodlust and Bloodthirst','Without Bloodlust, Bloodthirst']){
 const neither=readBuildContract([user(revision)],locked,{game:'mtg'});
 assert.deepEqual(neither.themes,['vampire'],revision);assert.deepEqual([...neither.removedMechanics].sort(),['bloodlust','bloodthirst']);
 const stripped=applyUserBuildIntent({...baseProposal,style:'Vampires Bloodlust Bloodthirst'},neither);
 assert.equal(validateBuildProposal(stripped,neither).ok,true);assert.deepEqual(requestedIntent(stripped.style).mechanics,[]);
}
const fresh=readBuildContract([user('Build a new mono-red Goblin Commander deck under $50')],different,{game:'mtg'});
assert.deepEqual(fresh.removedMechanics,[]);assert(!fresh.themes.includes('bloodlust'));assert.deepEqual(fresh.colors,['R']);assert.equal(fresh.budget,50);
const untouched=applyUserBuildIntent({...baseProposal,style:'Vampires Bloodlust'},readBuildContract([user('Build a mono-black Vampire Commander deck under $100')]));
assert.match(untouched.style,/Bloodlust/,'an unrequested AI plan is not arbitrarily stripped without an explicit removal');
console.log('PASS: authoritative Bloodlust retention, Slith mechanic/type and Blood Lust identity, explicit removal/re-enable, stale-style rejection and actual normalized builder inspection preserve the player’s request.');
