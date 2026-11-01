// Commander land-subtype prerequisites (Hazezon's Deserts) against pinned
// Scryfall Oracle text (tests/fixtures/commander-land-requirements.json,
// retrievedAt inside). The observed 24 Oct 2026 live result is reproduced as an
// explicitly synthetic list: its commander and 36 lands are the observed ones;
// the 63 spells are documented filler (16 generic landfall cards, then the
// cheapest non-Desert spells by name), because the full export was not saved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectMtgTheme,buildDeck} from './builder.js';
import {commanderTheme} from './planner.js';
import {commanderLandRequirements,landSubtypeRoles,inspectLandRequirements,LAND_REQUIREMENT_POLICY} from './mtg-land-requirements.js';
import {inspectDeckPlan} from './deck-construction.js';
import {cardKey} from './core.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/commander-land-requirements.json',import.meta.url)));
const byName=new Map(fixture.cards.map(c=>[c.name,c])),card=n=>{const c=byName.get(n);assert(c,'fixture card '+n);return c;};
const hazezon=card('Hazezon, Shaper of Sand'),HZ=hazezon.name;
const rgw=c=>(c.color_identity||[]).every(x=>'RGW'.includes(x))&&c.legalities?.commander==='legal';
const desertText=c=>/desert/i.test((c.oracle_text||'')+(c.type_line||''));
const nonland=c=>!/\bLand\b/.test(c.type_line||'');
const observedLands=[['Command Tower',1],['Exotic Orchard',1],['Path of Ancestry',1],['Clifftop Retreat',1],['Cinder Glade',1],['Canopy Vista',1],['Battlefield Forge',1],['Rootbound Crag',1],['Sunpetal Grove',1],['Karplusan Forest',1],['Secluded Courtyard',1],['Rockfall Vale',1],['Brushland',1],['Unclaimed Territory',1],['Forest',11],['Mountain',6],['Plains',5]];
assert.equal(observedLands.reduce((n,[,q])=>n+q,0),36);
const landfall=fixture.cards.filter(c=>nonland(c)&&rgw(c)&&!desertText(c)&&/landfall/i.test(c.oracle_text||'')&&!/Legendary/.test(c.type_line)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,16);
const filler=fixture.cards.filter(c=>nonland(c)&&rgw(c)&&!desertText(c)&&!landfall.includes(c)&&c.name!==HZ&&!/landfall|lands? (?:cards? )?from your graveyard|search your library for[^.]*land/i.test(c.oracle_text||'')).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,63-landfall.length);
assert.equal(landfall.length,16);assert.equal(filler.length,47);
const row=(c,qty=1)=>({name:c.name,qty,zone:'main',card:c});
const observed=[row(hazezon),...observedLands.map(([n,q])=>row(card(n),q)),...landfall.map(c=>row(c)),...filler.map(c=>row(c))];
assert.equal(observed.reduce((n,r)=>n+r.qty,0),100);

// Extraction: Hazezon needs a Desert entering under your control, and Deserts
// in your graveyard to replay. Desertwalk is about the opponent's Deserts.
const needs=commanderLandRequirements(hazezon);
assert.deepEqual(needs.map(n=>n.subtype),['Desert']);
assert.deepEqual(needs[0].roles.map(r=>r.kind).sort(),['enters','graveyard']);
assert(!commanderTheme(hazezon).roles.includes('Landfall'),'a Desert prerequisite is not inferred as generic landfall');
assert(commanderTheme(card('Bristly Bill, Spine Sower')).roles.includes('Landfall'),'a real landfall commander keeps its landfall plan');
assert.deepEqual(commanderLandRequirements(card('Bristly Bill, Spine Sower')),[],'generic landfall has no subtype prerequisite');

// R01 / R03: the observed zero-Desert list never passes, and generic landfall
// or land recursion cannot rescue it.
const r01=inspectMtgTheme(observed,{commander:HZ});
assert.notEqual(r01.status,'supported');assert.equal(r01.prerequisites.status,'insufficient');
assert.match(r01.issues[0],/Hazezon, Shaper of Sand needs Deserts/);assert.match(r01.issues[0],/0 Deserts/);
assert.equal(r01.groups[0].label,'Desert plan');assert.equal(r01.groups[0].copies,0);
assert(!r01.groups.some(g=>/Landfall/.test(g.label)),'no generic landfall group stands in for the commander plan');
const r03=observed.map(r=>r.name===filler[0].name?row(card('Crucible of Worlds')):r.name===filler[1].name?row(card('Ramunap Excavator')):r);
assert.equal(inspectLandRequirements(r03,{commander:HZ}).status,'insufficient','generic land recursion is not a Desert');
const plan=inspectDeckPlan({game:'mtg',theme:''},observed,{commander:HZ});
assert(plan.issues.some(i=>/needs Deserts/.test(i)),'the shared deck-plan gate blocks presentation as supported');

// R02: real Desert ETB access meeting the declared threshold is credited;
// recursion is reported separately and is optional for the entering plan.
const deserts=fixture.cards.filter(c=>/\bLand\b.*Desert/.test(c.type_line)&&rgw(c)).sort((a,b)=>a.name.localeCompare(b.name));
assert(deserts.length>=LAND_REQUIREMENT_POLICY.commander.target);
const swapBasics=(rows,adds)=>{const out=rows.map(r=>({...r}));let left=adds.length;for(const r of out)while(left&&['Forest','Mountain','Plains'].includes(r.name)&&r.qty>1){r.qty--;left--;}return [...out,...adds.map(c=>row(c))];};
const noSetup=deserts.filter(c=>!landSubtypeRoles(c,'Desert').some(r=>r.kind==='setup')).slice(0,10);
const r02=swapBasics(observed,noSetup);assert.equal(r02.reduce((n,r)=>n+r.qty,0),100);
const g02=inspectLandRequirements(r02,{commander:HZ});
assert.equal(g02.status,'supported');assert.equal(g02.groups[0].sources.copies,10);assert(g02.groups[0].access>=.6);
assert.equal(g02.groups[0].recursion.status,'partial','no way to put a Desert in the graveyard: replay is not credited');
assert.match(g02.notes[0],/optional route is partial/);
assert.match(g02.groups[0].summary,/^10 Deserts, 0 ways to find them, 0 ways to put them in your graveyard\. \d+% chance to draw a Desert; \d+% chance to draw a potential enabler/);
// Below the declared minimum stays insufficient even with a couple of Deserts.
assert.equal(inspectLandRequirements(swapBasics(observed,noSetup.slice(0,3)),{commander:HZ}).status,'insufficient');

// R04: Deserts that cycle or sacrifice themselves set up the graveyard replay.
const withSetup=deserts.filter(c=>landSubtypeRoles(c,'Desert').some(r=>r.kind==='setup')).slice(0,4);
assert(withSetup.length>=2);
const g04=inspectLandRequirements(swapBasics(observed,[...noSetup.slice(0,6),...withSetup]),{commander:HZ});
assert.equal(g04.status,'supported');assert.equal(g04.groups[0].recursion.status,'supported');assert(g04.groups[0].setup.cards.every(c=>c.text));

// Finders count only with a Desert to find; payoffs never count as enablers.
const scout=card('Sand Scout'),hydra=card('Ramunap Hydra'),chanter=card('Dune Chanter');
assert(landSubtypeRoles(scout,'Desert').some(r=>r.kind==='fetch'&&r.conditional));
assert(landSubtypeRoles(hydra,'Desert').every(r=>r.kind==='payoff'));
assert(landSubtypeRoles(chanter,'Desert').some(r=>r.kind==='grant'));
const finderOnly=inspectLandRequirements(observed.map(r=>filler.slice(0,9).some(c=>c.name===r.name)?row(scout):r),{commander:HZ});
assert.equal(finderOnly.groups[0].copies,0,'searches with nothing to find are not access');
const payoffOnly=inspectLandRequirements(observed.map(r=>filler.slice(0,9).some(c=>c.name===r.name)?row(hydra):r),{commander:HZ});
assert.equal(payoffOnly.status,'insufficient');

// R05: another player's Desert is not your Hazezon trigger.
const giver={name:'Fixture Desert Gift',type_line:'Sorcery',oracle_text:'Target opponent searches their library for a Desert card and puts it onto the battlefield.',color_identity:[],mana_cost:'{1}',cmc:1};
assert.deepEqual(landSubtypeRoles(giver,'Desert'),[],'an opponent fetching a Desert is not your enabler');
const watcher={name:'Fixture Desert Watcher',type_line:'Legendary Creature — Human',oracle_text:'Whenever a Desert an opponent controls enters, you gain 1 life.',color_identity:['W'],mana_cost:'{W}',cmc:1};
assert.deepEqual(commanderLandRequirements(watcher),[],'opponent-controlled triggers are not construction prerequisites');

// A commander's short name ("Cloud" for "Cloud, …") is not a Cloud land.
const cloud={name:'Cloud, Fixture Soldier',type_line:'Legendary Creature — Human Soldier',oracle_text:'Whenever Cloud attacks, return target creature card from your graveyard to your hand.\nWhenever a land you control enters, Cloud gets +1/+1 until end of turn.',color_identity:['W'],mana_cost:'{W}',cmc:1};
assert.deepEqual(commanderLandRequirements(cloud),[]);
assert.deepEqual(commanderLandRequirements({name:'Fixture Panther',type_line:'Legendary Creature — Cat',oracle_text:'Mine Vibranium — {3}: Move all +1/+1 counters from target land you control onto target creature.'}),[],'an ability word is not a Mine land');assert.deepEqual(commanderTheme(cloud).roles.sort(),['Graveyard','Landfall']);
// Generalization: a graveyard-only Desert commander needs Deserts and setup.
const yuma=card('Yuma, Proud Protector');
assert.deepEqual(commanderLandRequirements(yuma).map(n=>[n.subtype,n.primary]),[['Desert','graveyard']]);
// A synthetic Gate commander uses the same predicates with real Gate lands.
const gateLead={name:'Fixture Gatekeeper',type_line:'Legendary Creature — Human Advisor',oracle_text:'Whenever a Gate you control enters, draw a card.',color_identity:['R','G','W'],mana_cost:'{R}{G}{W}',cmc:3};
const gates=fixture.cards.filter(c=>/\bGate\b/.test(c.type_line)&&/\bLand\b/.test(c.type_line)&&rgw(c));
assert.deepEqual(commanderLandRequirements(gateLead).map(n=>n.subtype),['Gate']);
assert(gates.length>=8);
assert.equal(inspectLandRequirements([row(gateLead),...observed.slice(1)],{commander:gateLead.name}).status,'insufficient');
assert.equal(inspectLandRequirements(swapBasics([row(gateLead),...observed.slice(1)],gates.slice(0,10)),{commander:gateLead.name}).status,'supported');
console.log(`PASS: Hazezon zero-Desert list fails (100 cards, 0 Deserts, ${landfall.length} generic landfall cards); Deserts, finders, setup, payoffs, opponent Deserts, Yuma and a Gate commander are classified from card text.`);

// End to end: the builder reserves Deserts before spells and the final gate passes.
const catalog=Object.fromEntries(fixture.cards.filter(c=>c.legalities?.commander==='legal').map(c=>[cardKey(c.name),c]));
const price=c=>{const p=Number(c?.prices?.usd);return Number.isFinite(p)?p:null;};
const built=buildDeck({format:'Commander',commander:hazezon,seeds:[hazezon],catalog,price,colors:['R','G','W']});
assert.equal(built.total,100);
const builtRows=built.cards.map(r=>row(catalog[cardKey(r.name)],r.qty));
const builtGate=inspectLandRequirements(builtRows,{commander:HZ});
assert.equal(builtGate.status,'supported',JSON.stringify(builtGate.groups[0]?.summary));
const desertsBuilt=builtGate.groups[0].sources.copies;
assert(desertsBuilt>=LAND_REQUIREMENT_POLICY.commander.minimum&&desertsBuilt<=LAND_REQUIREMENT_POLICY.commander.target);
assert.equal(built.lands,38,'Deserts take land slots, not spell slots');
const colorlessDeserts=builtGate.groups[0].sources.cards.filter(c=>!(catalog[cardKey(c.name)].produced_mana||[]).some(m=>'RGW'.includes(m))).length;
assert(colorlessDeserts<=Math.floor(36*LAND_REQUIREMENT_POLICY.colorlessShare),'colorless Deserts are capped');
const builtPlan=inspectDeckPlan({game:'mtg',theme:''},builtRows,{commander:HZ});
assert(!builtPlan.issues.some(i=>/needs Deserts|No confirmed land source/.test(i)),builtPlan.issues.join(' | '));
// Fixed seed and catalog give the same list.
assert.deepEqual(buildDeck({format:'Commander',commander:hazezon,seeds:[hazezon],catalog,price,colors:['R','G','W']}).cards,built.cards);
console.log(`PASS: builder reserves ${desertsBuilt} Deserts (${colorlessDeserts} colorless-only) in 36 lands; ${builtGate.groups[0].summary}`);

// The deck window shows the prerequisite counts from the final check.
import {deckResultMarkup} from './deck-experience.js';
import {engineMap} from './engine-map.js';
const sheet=(theme)=>deckResultMarkup({ok:true,request:{game:'mtg',formatName:'Commander',budget:null,budgetMode:'cap'},pricing:{estimate:10,subtotal:10,basis:'total',ownedCopies:0,copies:100,unpriced:0,coverage:1,note:''},rows:[],deck:{buildAround:HZ,commander:HZ},plan:{theme,notes:[],engine:engineMap('mtg',[],{commanders:[]}),strategy:null,mechanics:null,combo:null},compared:1,requestSatisfied:theme.status==='supported',delta:null},'fixture');
assert.match(sheet(r01),/data-flow-prerequisite><b>Desert plan: not established\.<\/b> 0 Deserts, 0 ways to find them/);
const builtTheme=inspectMtgTheme(builtRows,{commander:HZ});
assert.match(sheet(builtTheme),new RegExp(`Desert plan: established\\.</b> ${desertsBuilt} Deserts`));
assert.doesNotMatch(sheet(r01),/Landfall commander plan/);
console.log('PASS: the deck window states Desert counts and access from the final check, never the generic landfall figure.');
