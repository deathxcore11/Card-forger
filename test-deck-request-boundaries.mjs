// Request fidelity across entry points: budget boundaries, soft targets,
// unknown prices, derived vs explicit constraints on Edit choices, and the
// actual Ask/Random builder discovering a commander's required land subtype.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBuildContract,applyUserBuildIntent,validateBuildProposal} from './ai-build-contract.js';
import {normalizeDeckRequest,chooseDeck,priceDeck,withinBudgetCap} from './deck-construction.js';
import {prepareMtgDeck} from './ai-deck-builder.js';
import {FORMATS} from './formats.js';
import {cardKey} from './core.js';
const u=content=>({type:'message',role:'user',content});
const formats={mtg:FORMATS};

// R20–R23 boundaries. "Under" excludes the amount; "at most" includes it.
assert.equal(readBuildContract([u('Build a Commander deck under $20')]).budgetBoundary,'exclusive');
for(const text of ['Build a Commander deck for at most $20','Build a Commander deck up to $20','Build a Commander deck, $20 budget'])assert.equal(readBuildContract([u(text)]).budgetBoundary,'inclusive',text);
assert.equal(readBuildContract([u('Build a Commander deck around 20 dollars')]).budgetMode,'target','"around" is a soft target');
const cap=(budget,budgetBoundary)=>normalizeDeckRequest({game:'mtg',format:'Commander',budget,budgetMode:'cap',budgetBoundary},formats);
assert.equal(withinBudgetCap(20,cap(20,'exclusive')),false,'$20.00 is not under $20');
assert.equal(withinBudgetCap(19.99,cap(20,'exclusive')),true);
assert.equal(withinBudgetCap(20,cap(20,'inclusive')),true,'$20.00 is at most $20');
assert.equal(withinBudgetCap(900,cap(700,'inclusive')),false,'a $900 list never passes a $700 cap');
assert.equal(withinBudgetCap(null,cap(700,'inclusive')),false,'unknown prices never pass a cap');
assert.deepEqual(cap(20,'exclusive').constructionBudgets,[19.99],'an exclusive cap builds toward one cent below it');
const contract=readBuildContract([u('Build a mono-red Commander deck under $20')]);
const proposal=validateBuildProposal(applyUserBuildIntent({game:'mtg',format:'Commander',style:'',budget:20,budget_basis:'total',goal:'strongest',colors:['R'],required_cards:[],excluded_cards:[]},contract),contract);
assert.equal(proposal.args.budgetBoundary,'exclusive','the Ask path carries the player’s boundary');
assert.equal(validateBuildProposal({...proposal.args,budgetBoundary:'inclusive'},contract).args.budgetBoundary,'exclusive','a proposal cannot loosen it');
const candidate=(price,qty=100)=>{const rows=[{name:'Fixture',id:'fixture',qty,zone:'main',card:{name:'Fixture'},price:price===null?null:price/qty,owned:0}];return {deck:{cards:[{name:'Fixture',qty}]},rows,check:{complete:true,legal:true,issues:[]},plan:{issues:[],theme:null},pricing:priceDeck(rows),power:{score:50}};};
assert.equal(chooseDeck([candidate(20)],cap(20,'exclusive')).ok,false);
assert.match(chooseDeck([candidate(20)],cap(20,'exclusive')).message,/under your \$20\.00 cap/);
assert.equal(chooseDeck([candidate(20)],cap(20,'inclusive')).ok,true);
assert.equal(chooseDeck([candidate(900)],cap(700,'inclusive')).code,'budget-cap');
const unknown=chooseDeck([candidate(null)],cap(700,'inclusive'));assert.equal(unknown.ok,false);assert.equal(unknown.code,'budget-cap');
const soft=chooseDeck([candidate(20.5)],normalizeDeckRequest({game:'mtg',format:'Commander',budget:20,budgetMode:'target'},formats));
assert.equal(soft.ok,true);assert.equal(soft.budgetStatus,'over-target');assert.equal(soft.budgetVerified,false);assert.equal(soft.delta,.5,'the variance is disclosed, not hidden');
const softUnknown=chooseDeck([candidate(null)],normalizeDeckRequest({game:'mtg',format:'Commander',budget:20,budgetMode:'target'},formats));
assert.equal(softUnknown.validation.budget,'unverified','an unknown price is unverified, never $0');
console.log('PASS: under/at-most/around budgets, $900 against a $700 cap, and unknown prices keep separate, honest budget results on every path.');

// R31: Edit choices re-derives constraints that came from the theme text and
// keeps the ones the player selected explicitly.
const first=normalizeDeckRequest({game:'mtg',format:'Commander',theme:'only Elves, infinite mana'},formats);
assert.deepEqual(first.creatureTypesOnly,['Elf']);assert.equal(first.constraintSources.creatureTypesOnly,'theme');assert.equal(first.requireLoop,'infinite-mana');
const edited=normalizeDeckRequest({...first,theme:'Goblins'},formats);
assert.deepEqual(edited.creatureTypesOnly,[],'a changed theme does not keep a hidden stale Elf-only rule');assert.equal(edited.requireLoop,null);
const explicit=normalizeDeckRequest({game:'mtg',format:'Commander',theme:'tokens',creatureTypesOnly:['Elf']},formats);
assert.deepEqual(normalizeDeckRequest({...explicit,theme:'Goblins'},formats).creatureTypesOnly,['Elf'],'an explicit restriction survives an optional theme change');
assert.equal(normalizeDeckRequest({...first,theme:'Goblins'},formats).randomSeed,first.randomSeed,'the seed is kept for a reproducible rebuild');
console.log('PASS: Edit choices recomputes theme-derived restrictions and loop intent, keeps explicit restrictions, and keeps the build seed.');

// The real AI/Random builder: Hazezon's Desert need drives discovery,
// reservation and the final gate. Provider answers come from the pinned
// Scryfall fixture; no network or AI is used.
const fixture=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/commander-land-requirements.json',import.meta.url))).cards.filter(c=>c.legalities?.commander==='legal');
const hazezon=fixture.find(c=>c.name==='Hazezon, Shaper of Sand'),catalog={},queries=[];
const isLand=c=>/\bLand\b/.test(c.type_line||'');
const answer=q=>/is:commander/.test(q)?[hazezon]:/t:land t:desert/.test(q)?fixture.filter(c=>isLand(c)&&/Desert/.test(c.type_line)):/-t:land o:desert/.test(q)?fixture.filter(c=>!isLand(c)&&/desert/i.test(c.oracle_text||'')):/(?:^|\s)t:land/.test(q)?fixture.filter(c=>isLand(c)&&!/Desert/.test(c.type_line)):fixture.filter(c=>!isLand(c)&&!/desert/i.test(c.oracle_text||''));
const x={S:{state:{collection:[],decks:[],priceChoices:{}},catalog,ui:{}},meta:n=>catalog[cardKey(n)],resolve:async n=>fixture.find(c=>cardKey(c.name)===cardKey(n)),cacheCard:c=>(catalog[cardKey(c.name)]=c),priceOf:n=>{const p=Number(fixture.find(c=>cardKey(c.name)===cardKey(n))?.prices?.usd);return Number.isFinite(p)?p:null;},inv:()=>({owned:0,available:0}),
 api:async path=>{const url=new URL(path,'https://fixture.invalid');if(url.pathname.includes('/named'))return fixture.find(c=>cardKey(c.name)===cardKey(url.searchParams.get('exact')))||null;const q=url.searchParams.get('q')||'';queries.push(q);return {data:answer(q)};}};
const prepared=await prepareMtgDeck({format:'Commander',commander:hazezon.name,seed:hazezon.name,style:'',goal:'strongest'},x);
assert(queries.some(q=>/t:land t:desert/.test(q)),'Desert lands are searched for');assert(queries.some(q=>/-t:land o:desert/.test(q)),'cards that find Deserts are searched for');
assert.equal(prepared.draft.total,100,JSON.stringify(prepared.draft.warnings));
const gate=prepared.result.themeCheck.prerequisites;
assert.equal(gate.status,'supported',JSON.stringify(gate.issues));
assert(gate.groups[0].sources.copies>=8,'Deserts are in the final list');
assert.notEqual(prepared.result.themeCheck.groups[0].label,'Landfall commander plan');
console.log(`PASS: the Ask/Random builder searches for Deserts and Desert finders, and its final list passes the shared gate: ${gate.groups[0].summary}`);

// The validation report names the request it checked and keeps the commander
// prerequisite separate from legality, completeness and budget.
import {requestFingerprint} from './deck-construction.js';
const fixed=normalizeDeckRequest({game:'mtg',format:'Commander',budget:20,randomSeed:7},formats);
assert.equal(requestFingerprint(fixed),requestFingerprint({...fixed}));assert.notEqual(requestFingerprint(fixed),requestFingerprint({...fixed,budget:21}));
const report=chooseDeck([candidate(10)],fixed).validation;
assert.equal(report.request,requestFingerprint(fixed));assert.equal(report.prerequisites,'not-applicable');assert.equal(report.legal,true);assert.equal(report.budget,'pass');
console.log('PASS: validation reports keep a request fingerprint and a separate commander-prerequisite status.');
