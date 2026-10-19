import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {pokemonEnergyCapability,pokemonAttackEvidence,attackDamage,ptcgPower,ygoStarterPrerequisites,ygoPower} from './deckpower.js';
import {PTCG_FORMATS,validatePtcg} from './ptcg.js';
import {YGO_FORMATS,validateYgo} from './ygo.js';
const B=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/power-bench.json.gz',import.meta.url))));
const boom=B.ptcg.cards['sv06-166'],rocket=B.ptcg.cards['sv10-182'];
assert.ok(boom&&rocket,'actual public frozen Special Energy text');
const basic=type=>({id:'basic-'+type,name:type+' Energy',category:'Energy',basicEnergy:true});
const attacker={id:'fixture-grass',name:'Fixture Grass attacker',category:'Pokemon',basicPokemon:true,stage:'Basic',types:['Grass'],prize:1,hp:100,attackCosts:['Grass'],attacks:[{name:'Printed hit',cost:['Grass'],damage:200}]};
assert.deepEqual(pokemonEnergyCapability(boom,attacker).types,['Colorless']);assert.equal(pokemonEnergyCapability(boom,attacker).status,'supported','unrelated conditional recycling does not disable printed Energy production');
assert.equal(pokemonEnergyCapability(rocket,attacker).status,'unsupported');assert.deepEqual(pokemonEnergyCapability(rocket,{...attacker,name:"Team Rocket's Fixture"}).types,['Psychic','Darkness']);assert.equal(pokemonEnergyCapability(rocket,{...attacker,name:"Team Rocket's Fixture"}).units,2);
const filler=Array.from({length:11},(_,i)=>({qty:4,c:{id:'trainer-'+i,name:'Fixture trainer '+i,category:'Trainer',typeLine:'Trainer — Item',effect:'Heal 10 damage.'}}));
const rows=(energy,pk=attacker)=>[{qty:4,c:pk},{qty:12,c:energy},...filler];
const part=(p,k)=>p.parts.find(x=>x.key===k),grass=ptcgPower(rows(basic('Grass'))),fire=ptcgPower(rows(basic('Fire'))),colorless=ptcgPower(rows(boom));
assert.ok(part(grass,'Energy').ratio>part(colorless,'Energy').ratio);assert.equal(part(colorless,'Energy').ratio,part(fire,'Energy').ratio,'known Colorless-only Special Energy does not pay Grass');assert.equal(colorless.score,fire.score);assert.match(part(colorless,'Energy').why,/Special Energy is not automatically/);
const colorlessAttacker={...attacker,attackCosts:['Colorless'],attacks:[{name:'Colorless hit',cost:['Colorless'],damage:200}]};assert.ok(ptcgPower(rows(boom,colorlessAttacker)).score>colorless.score,'known Colorless production remains useful for a Colorless cost');
const team={...attacker,name:"Team Rocket's Fixture",attackCosts:['Psychic'],attacks:[{name:'Psychic hit',cost:['Psychic'],damage:200}]};assert.ok(ptcgPower(rows(rocket,team)).score>ptcgPower(rows(rocket,{...team,name:'Ordinary Fixture'})).score,'recipient restrictions apply to otherwise identical attacks');
const mysterious={...boom,name:'Unmapped special Energy',effect:'Provides an Energy according to an unmodeled condition.'};assert.equal(pokemonEnergyCapability(mysterious).status,'unverified');assert.ok(!pokemonEnergyCapability(mysterious).types.length);
for(const format of PTCG_FORMATS){const g=ptcgPower(rows(basic('Grass')),format),bad=ptcgPower(rows(boom),format);assert.ok(part(g,'Energy').ratio>part(bad,'Energy').ratio,format.id+' preserves typed capability across formats; legality is separate');}
for(const effect of ['If you have 99 Prize cards remaining, this attack does 300 more damage.',"If your opponent's Active Pokémon is a Pokémon ex, this attack does100 more damage."]){const a={damage:'10+',effect};assert.equal(attackDamage(a),10);assert.equal(pokemonAttackEvidence(a).status,'conditional');assert.deepEqual(pokemonAttackEvidence(a).requirements,[effect]);}
assert.equal(attackDamage({damage:200,effect:''}),200);assert.equal(attackDamage({damage:'10+',effect:'This attack does 100 more damage.'}),110);
const two=ptcgPower(rows(basic('Grass'),{...attacker,prize:2,ruleBox:true})),three=ptcgPower(rows(basic('Grass'),{...attacker,prize:3,ruleBox:true}));assert.equal(two.score,three.score,'no arbitrary liability penalty');assert.equal(three.capabilityEvidence.prizeLiability[0].prizes,3);assert.notEqual(part(two,'PrizeLiability').count,part(three,'PrizeLiability').count);assert.equal(part(three,'PrizeLiability').weight,0,'prize liability is explicit context, not invented survival odds');
const plain='Add 1 "Fixture" monster from your Deck to your hand.',impossible='If you control 99 monsters: '+plain,normal='If this card is Normal or Special Summoned: You can add 1 "Fixture" monster from your Deck to your hand.';
assert.equal(ygoStarterPrerequisites({text:plain,level:4}).openingCandidate,true);assert.equal(ygoStarterPrerequisites({text:impossible,level:4}).status,'unsupported');assert.equal(ygoStarterPrerequisites({text:normal,level:4}).openingCandidate,true);assert.equal(ygoStarterPrerequisites({text:normal,level:8}).openingCandidate,false);assert.equal(ygoStarterPrerequisites({text:'If this card is sent to the GY: '+plain,level:4}).openingCandidate,false);
assert.equal(ygoStarterPrerequisites({text:impossible+'\n'+plain,level:4}).openingCandidate,true,'independent useful mode survives an optional impossible mode');
const yrows=text=>[...Array.from({length:4},(_,i)=>({zone:'main',qty:3,c:{id:'s'+i,name:'Fixture searcher '+i,category:'Monster',level:4,atk:1800,archetype:'Fixture',text}})),...Array.from({length:4},(_,i)=>({zone:'main',qty:3,c:{id:'t'+i,name:'Fixture target '+i,category:'Monster',level:4,atk:1800,archetype:'Fixture',text:'A normal monster.'}})),...Array.from({length:8},(_,i)=>({zone:'main',qty:2,c:{id:'f'+i,name:'Fixture filler '+i,category:'Spell',text:'Gain 100 LP.'}}))];
const ygood=ygoPower(yrows(plain),YGO_FORMATS[0]),ybad=ygoPower(yrows(impossible),YGO_FORMATS[0]);assert.equal(ygood.stats.N,40);assert.equal(ybad.stats.starters,0);assert.ok(ygood.stats.startOdds>ybad.stats.startOdds);assert.ok(ygood.score>ybad.score,'removing a usable opening capability decreases the unchanged role model');assert.ok(ybad.starterEvidence.every(e=>e.status==='unsupported'));assert.match(part(ybad,'Starters').why,/prerequisites/);
console.log('PASS: public Special Energy type/recipient capability, conditional attack baseline without invented odds, explicit prize liability, and prerequisite-aware YGO opening search modes. Synthetic mechanic arrangements, not empirical format calibration.');

// Legal-size/copy matched arrangements through real validators. Legality metadata
// is deliberately mocked for synthetic cards; this is not a real deck reference.
const std=PTCG_FORMATS.find(f=>f.id==='standard'),legalize=c=>({...c,legal:{standard:true,expanded:true}});
const legalRows=energy=>[{qty:4,c:legalize(attacker)},{qty:4,c:energy},{qty:8,c:legalize(basic('Fire'))},...filler.map(r=>({...r,c:legalize(r.c)}))];
for(const energy of [legalize(basic('Grass')),boom]){const rs=legalRows(energy),catalog=Object.fromEntries(rs.map(r=>[r.c.id,r.c])),deck={zones:{main:rs.map(r=>({cardId:r.c.id,name:r.c.name,qty:r.qty}))}};assert.deepEqual(validatePtcg(deck,id=>catalog[id],std).filter(i=>['bad','pending'].includes(i.level)),[],'legal count/copy controlled Energy arrangement');}
assert.ok(ptcgPower(legalRows(legalize(basic('Grass'))),std).score>ptcgPower(legalRows(boom),std).score,'four legal copies of Colorless-only Special Energy cannot fix a Grass requirement');
for(const text of [plain,impossible]){const rs=yrows(text).map(r=>({...r,c:{...r.c,pools:['TCG'],ban:{tcg:null}}})),catalog=Object.fromEntries(rs.map(r=>[r.c.id,r.c])),deck={zones:{main:rs.map(r=>({cardId:r.c.id,name:r.c.name,qty:r.qty})),extra:[],side:[]}};assert.deepEqual(validateYgo(deck,id=>catalog[id],YGO_FORMATS.find(f=>f.id==='tcg')).filter(i=>['bad','pending'].includes(i.level)),[],'legal count/copy controlled search prerequisite arrangement');}
assert.match(ygoPower(yrows(plain),YGO_FORMATS.find(f=>f.id==='goat')).sims[0].note,/6 cards/);assert.match(ygoPower(yrows(plain).map(r=>({...r,qty:r.qty/2})),YGO_FORMATS.find(f=>f.id==='speed')).sims[0].note,/4 cards/);
assert.equal(ptcgPower(rows(mysterious,colorlessAttacker)).capabilityEvidence.energy[0].status,'unverified','unknown production is explicit, not presumed Colorless');
const glcModel=ptcgPower(rows(basic('Grass')),PTCG_FORMATS.find(f=>f.id==='glc'));
assert.equal(part(glcModel,'Consistency').weight,0,'singleton does not ask for illegal four-ofs');assert.equal(part(glcModel,'Ace').weight,0);assert.match(part(glcModel,'Ace').why,/bans ACE SPEC/);

for(const [format,size] of [['goat',6],['edison',6],['speed',4],['tcg',5]]){
 const f=YGO_FORMATS.find(f=>f.id===format),model=ygoPower(yrows(plain),f);
 assert.match(model.goldfish.headline,new RegExp(size+'-card first-turn'));
 assert.ok(model.goldfish.samples.every(sample=>sample.hand.length===size));
 assert.match(part(model,'Side').hint,new RegExp('Up to '+f.side+' Side Deck'));
 if(format==='speed')assert.doesNotMatch(part(model,'Side').hint,/Fifteen/);
}

assert.doesNotMatch(part(glcModel,'Consistency').hint,/3–4-ofs/);assert.match(part(glcModel,'Consistency').hint,/Singleton/);assert.match(part(glcModel,'Ace').hint,/not allowed/);assert.doesNotMatch(part(glcModel,'Ace').hint,/power boost/);
