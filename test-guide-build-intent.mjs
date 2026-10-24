// A literal player-pasted guide must retain its primary plan without turning
// descriptive names, examples and alternate packages into simultaneous themes.
// This exercises the real contract, continuation, proposal and normalization
// boundaries; no model, network, card-rule rewrite or deck-strength claim.
import assert from 'node:assert/strict';
import {readBuildContract,applyUserBuildIntent,validateBuildProposal,lockBuildContract} from './ai-build-contract.js';
import {normalizeDeckRequest} from './deck-construction.js';
import {requestedIntent} from './builder.js';
import {FORMATS} from './formats.js';
const user=content=>({type:'message',role:'user',content});
const guide="Building a powerful **Ninjutsu Commander (EDH)** deck requires a tight package of cheap, unblockable early drops, impactful ninjas with combat damage triggers, and a commander that accelerates your strategy.\n\n### Choose Your Commander\n\n* **Yuriko, the Tiger's Shadow**: The ultimate meta choice for sheer power. She weaponizes the ninjutsu mechanic by forcing each opponent to lose life equal to the mana value of cards revealed from the top of your library whenever *any* Ninja deals combat damage.\n* **Satoru Umezawa**: Gives every single creature in your hand **Ninjutsu for {4}{U}{B}**, letting you cheat massive sea monsters, praetors, and Eldrazi directly into play unblocked.\n\n### Core Deck Blueprint (Dimir Blue/Black)\n#### 1. The Enablers (Unblockable 1-Drops)\nYou need cheap attackers on turns 1 and 2 that your opponents won't want to block, allowing you to bounce them back to your hand using Ninjutsu.\n* **Ornithopter**\n* **Changeling Outcast** (All creature types, including Ninja)\n* **Moon-Circuit Hacker**\n* **Triton Shorestalker** & **Slither Blade**\n* **Invisible Stalker** (Hexproof and naturally unblockable)\n#### 2. Essential Ninjas\n* **Ingenious Infiltrator** (Draws cards whenever your Ninjas connect)\n* **Fallen Shinobi** (Lets you steal and cast free spells from your opponents' libraries)\n* **Prosperous Thief** (Generates Treasure tokens and ramps your mana)\n* **Sakashima's Student** (Enters as a copy of the best creature on the board via Ninjutsu)\n* **Silver-Fur Master** (Lords your Ninjas and reduces their Ninjutsu costs)\n#### 3. Top-Deck Manipulation & Protection (Crucial for Yuriko)\n* **Brainstorm**\n* **Scroll Rack**\n* **Counterspell** & **Swiftfoot Boots**\n### Featured Options\nThe MTG Decks & More Ninja Commander Deck Yuriko offers an **aggressive 100-card pre-built setup** focused on early unblockable hits and explosive Yuriko triggers.\nThe Satoru Umezawa NINJA Tribal NINJITSU Magic Mtg Custom Commander Deck lets you **cheat massive high-cost threats directly into play** using Satoru's universal ninjutsu enabler ability.\nInk-Eyes, Servant of Oni is a **classic heavy-hitting Ninja** that reanimates creatures straight out of your opponents' graveyards upon connecting.";

const original=guide;
const initial=readBuildContract([user(guide)]);
assert.deepEqual(initial.themes,['ninjutsu','ninja'],'the guide intro requests Ninjutsu/Ninjas; card names and optional packages are examples');
assert.deepEqual(initial.colors,['U','B']);assert.equal(initial.format,'Commander');assert.equal(initial.game,'mtg');
assert.equal(initial.commander,undefined,'alternative commander bullets do not choose a leader');
assert.equal(initial.seed,undefined);assert.deepEqual(initial.required_cards,[]);assert.equal(initial.avoid_infinite,false);
assert.equal(initial.provenance.themes.source,'user');assert.equal(initial.provenance.themes.turn,0);
assert.equal(initial.provenance.themes.text,guide.slice(0,600),'provenance keeps the original authored text');

const follow=readBuildContract([user(guide),user('No spending cap')]);
assert.deepEqual(follow.themes,['ninjutsu','ninja']);assert.deepEqual(follow.colors,['U','B']);assert.equal(follow.format,'Commander');
assert.equal(follow.budget,0);assert.equal(follow.budget_basis,'total');assert.equal(follow.budgetUnspecified,undefined);
assert.equal(follow.provenance.budget.turn,1);assert.equal(follow.provenance.themes.turn,0);
const retained=readBuildContract([user('No spending cap')],initial);
for(const field of ['themes','colors','format','required_cards','excluded_cards','budget'])assert.deepEqual(retained[field],follow[field],field+' survives retained recovery as well as transcript replay');
for(const title of ['# Ninjutsu Commander','\n\n# **Ninjutsu Commander**']){
 const titled=readBuildContract([user(title+'\n\n'+guide),user('No spending cap')]);
 assert.deepEqual(titled.themes,['ninjutsu','ninja'],'a leading title must not discard the introductory plan');
 assert.equal(titled.budget,0);assert.deepEqual(titled.colors,['U','B']);assert.equal(titled.format,'Commander');
 assert.equal(titled.commander,undefined);assert.deepEqual(titled.required_cards,[]);
}
const proposal={game:'mtg',format:'Commander',style:'Ninjutsu Ninja',goal:'strongest',seed:'',commander:'',budget:0,budget_basis:'total',colors:['U','B'],required_cards:[],excluded_cards:[],candidate_cards:[],avoid_infinite:false};
const accepted=validateBuildProposal(applyUserBuildIntent(proposal,follow),follow);
assert.equal(accepted.ok,true,JSON.stringify(accepted));assert.equal(accepted.requiresChoice,false);
const normalized=normalizeDeckRequest(accepted.args,{mtg:FORMATS});
assert.deepEqual(requestedIntent(normalized.theme).tribes,['Ninja'],'normalized builder intent has no mandatory Eldrazi/Praetor/Changeling/Eye tribe');
assert.match(normalized.theme,/ninjutsu/i);assert.equal(normalized.budget,0);assert.deepEqual(normalized.colors,['U','B']);
assert.equal(guide,original,'theme scoping never rewrites the pasted guide or authoritative card text');

// Ordinary prose remains unchanged, including unusual but explicit combinations.
const mixed=readBuildContract([user('Build a blue-black Commander deck with Ninja, Eldrazi, Changeling, hexproof, token, protection, shadow and Eye themes. No spending cap.')]);
for(const t of ['ninja','eldrazi','changeling','hexproof','token','protection','shadow','eye'])assert(mixed.themes.includes(t),'ordinary explicit mixed theme: '+t);
assert.equal(mixed.budget,0);assert.deepEqual(mixed.colors,['U','B']);
const checklist=readBuildContract([user(`Build a blue-black Commander deck.
### Plan
* **Ninja**
* **Eldrazi**
* **Changeling**
### Requirements
Use hexproof and protection. No infinite combos. No spending cap.`)]);
for(const t of ['ninja','eldrazi','changeling','hexproof','protection'])assert(checklist.themes.includes(t),'a structured player checklist is not a reference guide: '+t);
assert.equal(checklist.avoid_infinite,true);assert.equal(checklist.budget,0);

// Real additions inside an explicitly identified requirements section survive
// the guide boundary, including mechanic changes and exact quoted choices.
const specified=readBuildContract([user(guide+`
### My Requirements
Keep a token subtheme with hexproof and Eldrazi.
Bloodlust should be part of the plan too.
No Bloodthirst.
Must include "Counterspell".
Exclude "Doomsday".
No infinite combos.
Budget: under $100.`)]);
for(const t of ['ninjutsu','ninja','token','hexproof','eldrazi','bloodlust'])assert(specified.themes.includes(t),'explicit guide requirement: '+t);
for(const t of ['shadow','praetor','changeling','eye','bloodthirst'])assert(!specified.themes.includes(t),'unrequested or removed guide detail: '+t);
assert.deepEqual(specified.required_cards,['Counterspell']);assert.deepEqual(specified.excluded_cards,['Doomsday']);
assert.equal(specified.avoid_infinite,true);assert.equal(specified.budget,100);assert.equal(specified.budgetBoundary,'exclusive');
assert(specified.removedMechanics.includes('bloodthirst'));assert.equal(specified.commander,undefined);
const revised=readBuildContract([user('Remove Bloodlust')],specified);
assert(!revised.themes.includes('bloodlust'));assert(revised.themes.includes('ninja'));assert(revised.themes.includes('ninjutsu'));
assert(revised.removedMechanics.includes('bloodlust'));assert.deepEqual(revised.required_cards,['Counterspell']);assert.deepEqual(revised.excluded_cards,['Doomsday']);
assert.equal(revised.avoid_infinite,true);assert.equal(revised.budget,100);assert.deepEqual(revised.colors,['U','B']);

// The narrative body cannot leak modeled mechanics back through a second
// extractor, while hard first-person constraints outside a section still count.
const described=readBuildContract([user(guide.replace('### Featured Options','### Featured Options\nBloodlust and Bloodthirst are examples of unrelated combat mechanics.'))]);
assert.deepEqual(described.themes,['ninjutsu','ninja']);
const direct=readBuildContract([user(guide+'\nI want an Eldrazi and token subtheme.\nMust retain hexproof.\nNo infinite combos.')]);
for(const t of ['ninja','ninjutsu','eldrazi','token','hexproof'])assert(direct.themes.includes(t),'direct authored requirement: '+t);
assert.equal(direct.avoid_infinite,true);

const locked=lockBuildContract(accepted.args,follow),recovered=readBuildContract([user('Keep the budget the same')],locked);
assert.deepEqual(recovered.themes,['ninjutsu','ninja']);assert.equal(recovered.budget,0);assert.equal(recovered.commander,'');
console.log('PASS: literal structured Ninjutsu guide + no-cap follow-up preserves UB Commander Ninja intent without alternative-card theme pollution; ordinary/structured mixed themes, exact constraints, mechanic changes and recovery remain intact.');
