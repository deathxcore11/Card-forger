// Package-coverage evidence, never a competitive-strength oracle. Real card
// text snapshots are separate from explicitly synthetic filler/quantities.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {inspectTribalStrategy,tribalDiscoveryQueries,TRIBAL_STRATEGY_POLICY} from './deck-strategy-plan.js';
import {atLeastOne} from './deckaudit.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/tribal-strategy-cards.json',import.meta.url))),[krenko,warchief,cordial]=fixture.cards;
const bench=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-fixtures/power-bench.json.gz',import.meta.url)))),real=Object.values(bench.mtg.cards),find=name=>real.find(c=>c.name===name);
const basic={name:'Synthetic test basic',type_line:'Basic Land — Mountain',oracle_text:'{T}: Add {R}.'};
const synthetic=(name,type='Artifact',text='')=>({name:'Synthetic '+name,type_line:type,oracle_text:text});
const row=(card,qty=1,zone='main')=>({name:card.name,card,qty,zone});
const filler=(count,type='Artifact')=>Array.from({length:count},(_,i)=>row(synthetic('filler '+i,type)));
const summarize=rows=>inspectTribalStrategy(rows,{tribes:['Goblin'],commander:krenko.name});

// This reproduces the misleading prior two-support sanity pass: exact100 cards
// and two Goblins cannot establish a full tribal package.
const thin=[row(krenko,1,'commander'),row(warchief),row(find('Goblin Guide')),row(basic,36),...filler(61,'Creature — Human')];
assert.equal(thin.reduce((n,r)=>n+r.qty,0),100);
const thinPlan=summarize(thin),g=thinPlan.groups[0];
assert.equal(thinPlan.status,'partial');assert.equal(g.members.libraryCopies,2);assert.equal(g.members.commanderCopies,1);
assert.equal(g.coverage.library,99);assert.equal(g.coverage.providerCopies,2);assert.equal(g.coverage.supportCopies,2);
assert.equal(g.coverage.providerAccess,Math.round(atLeastOne(99,2,11)*10000)/10000);
assert(g.connections.length);assert(g.missing.some(s=>s.includes('majority')));assert(g.missing.some(s=>s.includes('coverage target')));
assert.equal(thinPlan.competitive,'unverified');

// A bounded real Goblin mechanism is recognized. The quantity fixture is a
// 60-card constructed shape, not a Commander singleton list or a gold deck.
const goblins=[row(krenko,4),row(warchief,4),row(find('Goblin Guide'),4),row(basic,24),...filler(24)];
const goblinPlan=inspectTribalStrategy(goblins,{tribes:['Goblin']});
assert.equal(goblinPlan.status,'supported');assert.equal(goblinPlan.groups[0].members.libraryCopies,12);
assert.equal(goblinPlan.groups[0].producers.libraryCopies,4);assert.equal(goblinPlan.groups[0].payoffs.libraryCopies,8);
assert.equal(goblinPlan.groups[0].coverage.supportCopies,12,'a multirole creature is one physical library card');
assert(goblinPlan.groups[0].resources.libraryCopies>=4);assert(goblinPlan.groups[0].connections.some(c=>c.provider==='Goblin Guide'&&c.payoff==='Goblin Warchief'));
assert(goblinPlan.limitations.some(s=>s.includes('winning turn')));

const vampires=[row(cordial,4),row(find('Bloodghast'),4),row(find('Preacher of the Schism'),4),row(find('Viscera Seer'),4),row(basic,24),...filler(20)];
const vampirePlan=inspectTribalStrategy(vampires,{tribes:['Vampire']});
assert.equal(vampirePlan.status,'supported');assert(vampirePlan.groups[0].connections.some(c=>c.provider==='Bloodghast'&&c.payoff==='Cordial Vampire'));
assert(vampirePlan.groups[0].coverage.providerAccess>TRIBAL_STRATEGY_POLICY.providerAccessTarget);

// Opposing tokens, type names and removal targets cannot supply friendly tribal
// bodies/payoffs. Generic token output is not claimed to have a specific type.
const deceptive=[row(synthetic('Goblin in the name','Creature — Human','Destroy target Goblin.')),row(synthetic('opponent production','Enchantment','Each opponent creates ten 1/1 red Goblin creature tokens.')),row(synthetic('generic token','Sorcery','Create three 1/1 red creature tokens.')),row(basic,36),...filler(61)];
const deceptivePlan=inspectTribalStrategy(deceptive,{tribes:['Goblin']});
assert.equal(deceptivePlan.status,'partial');assert.equal(deceptivePlan.groups[0].members.libraryCopies,0);assert.equal(deceptivePlan.groups[0].producers.libraryCopies,0);assert.equal(deceptivePlan.groups[0].payoffs.libraryCopies,0);assert.equal(deceptivePlan.groups[0].connections.length,0);
const wrongOutput=inspectTribalStrategy([row(synthetic('Goblin death to Skeleton','Enchantment','Whenever a Goblin you control dies, create a 1/1 black Skeleton creature token.')),row(basic,59)],{tribes:['Goblin']});assert.equal(wrongOutput.groups[0].producers.libraryCopies,0,'trigger type is not produced-token type');
const wrongCount=inspectTribalStrategy([row(synthetic('Goblin count to Human','Sorcery','Create a 1/1 white Human creature token for each Goblin you control.')),row(basic,59)],{tribes:['Goblin']});assert.equal(wrongCount.groups[0].producers.libraryCopies,0,'a Goblin count after the produced token is not Goblin production');
const tokenProducer=synthetic('Goblin token maker','Sorcery','Create two 1/1 red Goblin creature tokens.'),spellPayoff=synthetic('Goblin spell reducer','Enchantment','Goblin spells you cast cost {1} less to cast.');
const tokensNotCast=inspectTribalStrategy([row(tokenProducer,20),row(spellPayoff,4),row(basic,36)],{tribes:['Goblin']});assert.equal(tokensNotCast.groups[0].connections.length,0,'token creation does not provide a Goblin spell cast');assert.equal(tokensNotCast.status,'partial');
for(const text of ["Goblins you control can't attack.","Goblins you control can't gain flying.","Goblins you control don't have haste.",'Goblins you control get -1/-1.','Goblin spells you cast cost {1} more to cast.','Whenever a Goblin you control dies, you lose 2 life.']){
 const drawback=inspectTribalStrategy([row(synthetic('tribal drawback','Enchantment',text)),row(find('Goblin Guide'),24),row(basic,35)],{tribes:['Goblin']});assert.equal(drawback.groups[0].payoffs.libraryCopies,0,text);assert.equal(drawback.groups[0].connections.length,0,text);assert.equal(drawback.status,'partial');
}
const unknown=summarize([...goblins,row({name:'Unloaded test identity'})]);assert.equal(unknown.status,'unverified');assert.equal(unknown.unknownCopies,1);

// Commanders are never added to the library or multiplied by their token output.
const commandOnly=summarize([row(krenko,1,'commander'),row(basic,36),...filler(63)]);
assert.equal(commandOnly.groups[0].coverage.library,99);assert.equal(commandOnly.groups[0].coverage.providerCopies,0);assert.equal(commandOnly.groups[0].producers.commanderCopies,1);assert.equal(commandOnly.status,'partial');assert(commandOnly.notes.some(n=>n.includes('not proof')));
const weak=inspectTribalStrategy(thin,{tribes:['Goblin'],commander:krenko.name,goal:'weak'});assert.equal(weak.status,'partial');assert(weak.notes.some(n=>n.includes('deliberately weak deck invalid')));
const sideIgnored=inspectTribalStrategy([...deceptive,...goblins.map(r=>({...r,zone:'side'}))],{tribes:['Goblin']});assert.equal(sideIgnored.groups[0].members.libraryCopies,0);
assert.equal(inspectTribalStrategy(goblins).status,'not-requested');assert.deepEqual(tribalDiscoveryQueries([]),[]);
const dense=inspectTribalStrategy([...Array.from({length:50},(_,i)=>row(synthetic('connected Goblin '+i,'Creature — Goblin','Goblins you control have haste.'))),row(basic,50)],{tribes:['Goblin']});assert(dense.groups[0].connectionCount>dense.groups[0].connections.length);assert(dense.groups[0].connectionsTruncated);assert(dense.groups[0].connections.length<=32,'dense tribal lists keep bounded result evidence on phones');
const queries=tribalDiscoveryQueries(['Goblin','Vampire']);assert.equal(queries.length,3);assert(queries.every(q=>/goblin/.test(q)&&/vampire/.test(q)));assert(queries[0].includes('keyword:changeling'));assert(queries[1].includes('you cast'));assert(queries[2].includes('o:create'));assert.equal(tribalDiscoveryQueries(['Goblin'],{limit:2}).length,2);
console.log('PASS: real Goblin/Vampire mechanisms, thin two-member counterexample, physical library access, command-zone separation, honest weak/unknown verdicts, deceptive type mentions and bounded role-specific discovery.');
