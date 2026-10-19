import assert from 'node:assert/strict';
import fs from 'node:fs';
import {engineProfile,engineRoles} from './insights.js';
import {commanderDrawProfile} from './commander-criteria.js';
import {mtgPower,powerPanel,powerChip,shownPower} from './power.js';
import {comparePower,bestBudgetDecks} from './deck-optimizer.js';
import {mtgConstructedPower} from './deckpower.js';
import {cardKey} from './core.js';
import {S,blank} from './store.js';
import {competitiveScore} from './scouting.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./test-fixtures/commander-context.json',import.meta.url)));
const {decks,catalog}=fixture;S.state=blank();S.catalog=catalog;
const cards=n=>catalog[cardKey(n)],profiles=Object.fromEntries(Object.entries(decks).map(([k,d])=>[k,engineProfile(d,catalog)]));
const assessed=Object.fromEntries(Object.entries(decks).map(([k,d])=>[k,mtgPower(d)]));
for(const key of ['bad','knights','tokens','highRamp']){
 const p=assessed[key];assert.equal(p.readiness.provisional,false,`${key}: full legal singleton/color/size fixture`);assert.equal(competitiveScore(p),null,'no invented competitive score');assert.equal(p.simulationLibrary,99,'commander excluded from opening simulations');assert.equal(p.engine.library,99);assert.ok(p.criteria);assert.ok(!p.parts.some(x=>x.key==='Critical'||x.key==='Synergy'),'no constructed tribal minimum or universal25 requirement');assert.equal(p.criteria.plan.closing.status,'unverified');
 const html=powerPanel(p);assert.ok(html.includes('Commander Power estimate'));assert.ok(html.includes('What drives the Power estimate'),'actual strategic dimensions, not structural relabeling');assert.match(html,/Structure/);assert.match(html,/not a required quota/);assert.match(html,/Closing route/);assert.match(powerChip(p),/estimate/);
}
assert.equal(profiles.bad.criteria.plan.status,'unsupported');assert.equal(profiles.bad.criteria.plan.supportedCopies,0);
assert.ok(profiles.bad.score>=80,'bad plan can still hit structural checkboxes; do not hide this distinction by target tuning');
assert.ok(profiles.bad.criteria.resources.warnings.some(x=>/outside recognized plan/.test(x)));
assert.equal(profiles.knights.criteria.plan.status,'supported');assert.ok(profiles.knights.criteria.plan.primarySupport.length>0);assert.ok(profiles.knights.criteria.plan.routes.some(r=>r.kind==='tribal'));
assert.equal(profiles.tokens.criteria.plan.status,'supported');assert.equal(profiles.tokens.criteria.plan.primarySupport.length,0,'nontribal Dion support not relabeled Knights');assert.ok(profiles.tokens.criteria.plan.routes.some(r=>r.kind==='tokens'||r.kind==='counters'));
assert.ok(profiles.highRamp.criteria.resources.rawRamp>16);assert.equal(profiles.highRamp.criteria.plan.status,'supported');assert.ok(profiles.highRamp.criteria.plan.routes.some(r=>r.kind==='mana-engine'));assert.ok(!profiles.highRamp.criteria.resources.warnings.some(x=>/outside recognized plan/.test(x)),'mana engine is not punished merely for high ramp');assert.ok(!assessed.highRamp.caps.some(c=>/ramp|tribal|critical/i.test(c.key+' '+c.label)));
// Labels/role counts cannot override actual supported route execution. Do not
// claim the control fixture is weak merely because it lacks Commander typal fit.
assert.ok(assessed.bad.strategic.routes.some(r=>r.kind==='control'));
const sameStrategy={...assessed.knights,heuristic:100,criteria:{...assessed.knights.criteria,plan:{...assessed.knights.criteria.plan,supportedCopies:99}}};
assert.equal(comparePower(sameStrategy,assessed.knights),0,'generic role/support totals cannot game unchanged strategic evidence');
for(const goal of ['fun','chaos','weak'])assert.equal(comparePower({...assessed.bad,goal},{...assessed.knights,goal}),0,'subjective intent must not be silently strength-optimized');
assert.ok(!engineRoles(cards('Prophetic Prism')).includes('Ramp'));assert.ok(engineRoles(cards('Spectral Searchlight')).includes('Ramp'));assert.ok(engineRoles(cards('Knight of the White Orchid')).includes('Ramp'));
const rows=decks.knights.cards.map(r=>({...r,c:cards(r.name)})).filter(r=>r.c),glass=commanderDrawProfile(cards('Magnifying Glass'),rows),prism=commanderDrawProfile(cards('Prophetic Prism'),rows);assert.equal(glass.activationMana,6,'investigate then Clue activation');assert.ok(glass.effective<1);assert.ok(prism.cantrip);assert.ok(prism.effective<1);
const incomplete={...decks.knights,id:'missing-details',cards:decks.knights.cards.map((r,i)=>i===3?{name:'Missing catalog card',qty:r.qty}:r)},missing=mtgPower(incomplete);assert.equal(missing.criteria.plan.status,'unknown');assert.equal(missing.criteria.coverage.status,'incomplete');assert.ok(missing.readiness.provisional);assert.equal(shownPower(missing),null);
const unmappedCommander={...cards(decks.knights.commander),name:'Unsupported mechanic test card',oracle_text:'This card uses an unmodeled mechanic.',card_faces:undefined,type_line:'Legendary Creature — Avatar'};const unknownCatalog={...catalog,[cardKey(unmappedCommander.name)]:unmappedCommander};const unknownProfile=engineProfile({...decks.bad,commander:unmappedCommander.name,cards:decks.bad.cards.map((r,i)=>i===0?{name:unmappedCommander.name,qty:1}:r)},unknownCatalog);assert.equal(unknownProfile.criteria.plan.status,'unknown');assert.match(unknownProfile.criteria.plan.warnings.join(' '),/not a perfect score/);
// Identical card behavior is stable under row order, artwork, rarity and face representation.
const cosmetic=Object.fromEntries(Object.entries(catalog).map(([k,c])=>[k,{...c,prices:{usd:'9999'},rarity:'mythic',image_uris:{normal:'https://example.invalid/art'}}]));const reversed=engineProfile({...decks.knights,cards:[...decks.knights.cards].reverse()},cosmetic);assert.equal(reversed.score,profiles.knights.score);assert.equal(reversed.criteria.plan.supportedCopies,profiles.knights.criteria.plan.supportedCopies);assert.equal(reversed.criteria.resources.effectiveRamp,profiles.knights.criteria.resources.effectiveRamp);
const low=mtgConstructedPower(decks.lowCurve,catalog,cardKey,60);assert.ok(low.stats.avg<3);assert.ok(!low.parts.some(p=>p.key==='Ramp'&&p.target===10),'low-curve constructed not forced into Commander resources');
console.log(JSON.stringify(Object.fromEntries(Object.entries(profiles).map(([k,p])=>[k,{structure:p.score,plan:p.criteria?.plan.status??'constructed',support:p.criteria?.plan.supportedCopies??null,rawRamp:p.criteria?.resources.rawRamp??null,effectiveRamp:p.criteria?.resources.effectiveRamp??null}]))));
console.log('PASS: actual-text legal paired Commander fixtures, bad checklist pile, Knight/conversion and nontribal tokens/counters, legitimate high-ramp engine, low curve, unknown data/mechanics, effective costs, separate strategic UI, and optimizer anti-gaming. Not the user deck or a competitive-strength calibration.');
