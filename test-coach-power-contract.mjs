import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewPayload, aiReviewDialogContent} from './ai-review.js';
import {cleanDeck, cleanCriteria, validateReview, instructionsFor} from './ai-review-route.js';

// Public Scryfall data frozen from the audit. This is not the user's 100-card deck.
const fixture = JSON.parse(readFileSync(new URL('./test-fixtures/coach-dion-evidence.json', import.meta.url)));
const [dion, meteor, prism, glass, searchlight, knight] = fixture.cards;
const lookup = name => fixture.cards.find(c => c.name === name);
const deck = {id: 'coach-contract', format: 'Commander', commander: dion.name, cards: fixture.cards.map(c => ({name:c.name, qty:1}))};
const base = {score:99, heuristic:99, formatName:'Commander', ctx:{from:'commander',score:99}, plan:'Commander role balance', parts:[{key:'Ramp',label:'Ramp',count:3,target:10,ratio:.3,weight:10,rawCount:4,effectiveCount:3,countBasis:'Effective contribution units',cards:[prism,glass,searchlight,knight]}], goldfish:{winCon:'Meteor Golem, Dion'}, engine:{links:[{payoff:dion.name,need:'enters effects',providers:[meteor]}]}};
const payload = reviewPayload('mtg',deck,lookup,base);
for (const p of [payload,cleanDeck(payload)]) {
  assert.equal(p.power.competitive,null);
  assert.equal(p.checks.competitive,null);
  assert.equal(p.power.engine,99);
  assert.equal(p.power.scoreSource,'commander');
  assert.ok(p.facts.some(f=>/competitive unknown/.test(f)));
  assert.ok(p.facts.every(f=>!/competitive (?:99|0)\//.test(f)));
  assert.equal(p.power.areas[0].rawCount,4);
  assert.equal(p.power.areas[0].effectiveCount,3);
}
assert.equal(cleanDeck({...payload,checks:{...payload.checks,competitive:99}}).checks.competitive,null,'legacy inconsistent checks cannot override the score contract');
assert.ok(payload.facts.some(f=>/not verified win conditions/.test(f)));
assert.ok(payload.facts.some(f=>/Inferred rules-text link \(unverified\)/.test(f)));
for (const [from,score,fieldEstimate,expected] of [['meta',81,null,81],['mixed',64,null,64],['rogue',99,42,42],['rogue',99,null,null],['commander',0,null,null]]) {
  const p=reviewPayload('mtg',deck,lookup,{...base,ctx:{from,score,fieldEstimate}});
  assert.equal(p.power.competitive,expected); assert.equal(p.checks.competitive,expected); assert.equal(cleanDeck(p).checks.competitive,expected);
}
const constrainedFacts=reviewPayload('mtg',deck,lookup,{...base,engine:{links:[{payoff:'Intangible Virtue',need:'creature tokens',status:'conditional',providers:[{name:'Rootborn Defenses',status:'conditional',requirements:['Requires an existing creature token you control']}],openingAccess:.07}],unsupported:[{payoff:dion.name,provider:meteor.name,requirements:['Self-return cannot target another permanent']}]}}).facts;
assert.ok(constrainedFacts.some(f=>/Requires an existing creature token/.test(f)));
assert.ok(constrainedFacts.some(f=>/Self-return cannot target/.test(f)));
assert.ok(constrainedFacts.some(f=>/library-card access with command-zone support/.test(f)));
const criteria={version:'commander-context-v1',scoreMeaning:'Structural build heuristic, not plan quality or win rate',structure:{score:71,label:'Structure'},plan:{status:'partial',label:'Knight support',primarySupport:[{name:knight.name,qty:1,evidence:'Creature — Human Knight'}],secondarySupport:[],routes:[{kind:'combat',label:'Knight attacks',status:'conditional',cards:[dion.name,knight.name],evidence:['Knights have flying during your turn.'],requirements:['Enough attackers and successful attacks']}],warnings:['Closing route unknown'],supportedCopies:1,eligibleCopies:5},resources:{rawRamp:4,effectiveRamp:2.5,fixing:1,draw:{raw:2,effective:.5,paid:1},warnings:['Paid draw requires spare mana']},coverage:{known:6,total:6,ratio:1,status:'complete',limitations:['Not a rules simulator']},privateNotes:'must never be sent'};
const c=cleanDeck({...payload,criteria}).criteria;
assert.equal(c.plan.status,'partial'); assert.equal(c.plan.routes[0].status,'conditional'); assert.deepEqual(c.plan.routes[0].requirements,criteria.plan.routes[0].requirements);
assert.equal(c.resources.effectiveRamp,2.5); assert.equal(c.resources.efficientRamp,null); assert.match(c.resources.meaning,/not literal card copies/); assert.ok(!JSON.stringify(c).includes('privateNotes'));
assert.equal(cleanCriteria({plan:{status:'certain'},coverage:{}}).plan.status,'unknown');
const sampled=cleanCriteria({...criteria,plan:{...criteria.plan,primarySupport:Array.from({length:40},()=>({name:knight.name,qty:1,evidence:{primary:true,support:['Tokens']}})),routes:[{...criteria.plan.routes[0],cards:[{name:knight.name,qty:1}]}]},resources:{...criteria.resources,manaSinks:[{name:dion.name,qty:1}],evidence:[{name:searchlight.name,qty:1,effective:1,status:'supported',requirements:['Pay the casting cost'],effects:[{kind:'mana',evidence:searchlight.oracle_text,netMana:1,status:'supported'}]}]}});
assert.equal(sampled.plan.primarySupport.length,25);assert.equal(sampled.plan.primarySupportOmitted,15);
assert.deepEqual(sampled.plan.primarySupport[0].evidence,{primary:true,support:['Tokens']});
assert.deepEqual(sampled.plan.routes[0].cards,[{name:knight.name,qty:1}]);
assert.equal(sampled.resources.manaSinks[0].name,dion.name);assert.equal(sampled.resources.evidence[0].effects[0].netMana,1);
assert.deepEqual(cleanCriteria(sampled),sampled,'client/server evidence sanitization is idempotent, including truncated-sample disclosure');
assert.ok(!JSON.stringify(reviewPayload('mtg',deck,lookup,{...base,criteria})).includes('privateNotes'),'unknown criteria fields never leave the client');
const model={headline:'Focus on adding 2–3 more Knights synergy cards to hit the ideal 25.',identity:{plan:'Knight tribal',howItWins:'Win with Meteor Golem.',winCards:['c1'],engineCards:[]},pilot:{lines:[]},pressure:{scenarios:[]},improve:[],beyond:[]};
const checked=validateReview(model,cleanDeck(payload));
assert.doesNotMatch(checked.headline,/ideal 25/);
assert.match(checked.identity.howItWins,/No winning route is established/);
assert.deepEqual(checked.identity.winCards,[]);
assert.deepEqual(checked.identity.proposedCards.map(c=>c.name),['Meteor Golem']);
assert.equal(checked.identity.routeStatus,'unknown');
assert.equal(checked.validation.winningRoute,'unverified');
assert.ok(checked.notes.some(n=>/quota/.test(n)));
const conditional='Meteor Golem could remove a blocker if the attacking board is already large enough; the closing damage is unverified.';
const suggestion=validateReview({...model,headline:'Try 2–3 more Knights if testing shows too few attackers.',identity:{...model.identity,howItWins:conditional,winEvidence:[{cardId:'c1',quote:meteor.oracle_text}]}},cleanDeck(payload));
assert.equal(suggestion.headline,'Try 2–3 more Knights if testing shows too few attackers.');
assert.equal(suggestion.identity.howItWins,conditional);
assert.equal(suggestion.identity.evidenceStatus,'source-text-matched');
assert.equal(suggestion.identity.routeStatus,'unknown','a matching removal quote cannot verify a winning route');
const critique=validateReview({...model,headline:'Separate fixing from acceleration.',beyond:[{area:'Ramp',note:'Only 2 effective accelerants here: Prophetic Prism fixes mana rather than adding net mana.',evidence:[{cardId:'c2',quote:'{1}, {T}: Add one mana of any color.'}]}]},cleanDeck(payload));
assert.equal(critique.beyond.length,1,'effective contribution may disagree with raw role counts');
assert.equal(critique.beyond[0].countScope,'effective-estimate');
assert.match(critique.beyond[0].evidenceStatus,/interpretation-unverified/);
const html=aiReviewDialogContent({result:suggestion,payload,rows:[],game:'mtg'});
assert.doesNotMatch(html,/Wins with|Wins by|passed app checks|App-checked/);
assert.match(html,/Proposed route cards/); assert.match(html,/winning route is still unverified/); assert.match(html,/not the headline, full prose or winning route/);
const pilot=aiReviewDialogContent({result:{...suggestion,pilot:{lines:[{name:'Develop the board',steps:[{cardId:'c1',name:meteor.name,turn:7,kind:'play',action:'Cast Meteor Golem',quote:meteor.oracle_text}],payoff:'Remove a blocker'}]}},payload,rows:[],game:'mtg',tab:'pilot'});
assert.match(pilot,/Candidate line 1/);assert.match(pilot,/Basic checks only/);assert.match(pilot,/claimed outcome are not verified/);
const manaLine={...suggestion,pilot:{lines:[{name:'Test mana',steps:[{cardId:'c2',name:prism.name,turn:2,kind:'play',action:'Cast Prophetic Prism',quote:prism.oracle_text},{cardId:'heavy',name:'Six-mana spell',turn:4,kind:'play',action:'Cast it',quote:''}]}]}};
const manaHtml=aiReviewDialogContent({result:manaLine,payload,rows:[{id:'c2',row:{name:prism.name,qty:1},zone:'main',c:prism},{id:'heavy',row:{name:'Six-mana spell',qty:1},zone:'main',c:{name:'Six-mana spell',cmc:6,oracle_text:'Draw a card.'}}],game:'mtg',tab:'pilot'});
assert.match(manaHtml,/casts 6 mana/,'Prism fixing cannot add a free mana source to the limited line check');
const realCost=validateReview({...model,headline:'Meteor Golem needs 7 mana to cast; plan around that cost.'},cleanDeck(payload));
assert.equal(realCost.headline,'Meteor Golem needs 7 mana to cast; plan around that cost.','card costs are not blanket deck-density quotas');
for (const game of ['mtg','ptcg','ygo']) {
 const out=validateReview({...model,headline:'Consider this plan.',identity:{...model.identity,howItWins:'This could work if its prerequisites are met.'}},cleanDeck({...payload,game}));
 assert.equal(out.identity.outcomeStatus,'unverified');
 assert.match(instructionsFor(game),/Raw counts describe what the app tagged/);
 assert.match(instructionsFor(game),/null competitive score is unknown/);
}
console.log('PASS: Commander score nulls, raw/effective resource evidence, bounded contextual criteria, unsupported quota/win assertions, conditional advice, and honest partial-validation UI across all three games. No paid API requests.');

// Practical route scenarios survive the client/server boundary as diagnostics,
// never replacing missing competitive evidence or manufacturing null scores.
const strategic={version:'commander-routes-v1',score:63,confidence:'partial',status:'provisional',bestRoute:'combat',backupRoute:null,routes:[{kind:'combat',label:'Deployable pressure',status:'conditional',access:.72,deployment:.6,conversion:.48,execution:.592,cards:[{name:knight.name,qty:1}],requirements:['Resolve and retain attackers'],evidence:['Natural card access is not execution probability.']}],dimensions:[{key:'Execution',label:'Deployable pressure',ratio:.592,weight:80,why:'Access, deployment and useful output are separate.'}],coverage:{mappedPressureCopies:12,unmappedPressureCopies:2,knownLibrary:99,library:99},scenario:{library:99,developmentDraws:11,controlDraws:18,expectedResourceUnits:4.2,effectiveRamp:8.1},limitations:['Uncalibrated strategic heuristic, not measured win rate.'],account:'private'};
const ready={...base,score:63,strategic,criteria,readiness:{eligible:true,provisional:false,issues:[]}};
const readyPayload=reviewPayload('mtg',deck,lookup,ready);
const transported=cleanDeck(readyPayload);
assert.equal(readyPayload.power.score,63);assert.equal(readyPayload.power.eligible,true);
assert.equal(transported.criteria.strategic.score,63);assert.equal(transported.criteria.strategic.ratingStatus,'provisional-estimate');
assert.equal(transported.criteria.strategic.routes[0].access,.72);assert.equal(transported.criteria.strategic.routes[0].deployment,.6);assert.equal(transported.criteria.strategic.routes[0].conversion,.48);
assert.deepEqual(transported.criteria.strategic.routes[0].requirements,['Resolve and retain attackers']);
assert.equal(transported.criteria.strategic.scenario.library,99);assert.equal(transported.criteria.strategic.coverage.unmappedPressureCopies,2);
assert.equal(transported.criteria.strategic.confidence,'partial');assert.match(transported.criteria.strategic.limitations[0],/not measured win rate/);
assert.equal(transported.power.competitive,null);assert.equal(transported.checks.competitive,null);
assert.ok(!JSON.stringify(transported.criteria.strategic).includes('account'));
assert.deepEqual(cleanCriteria(transported.criteria),transported.criteria);
const unknownPayload=reviewPayload('mtg',deck,lookup,{...ready,score:null,strategic:{...strategic,score:null,status:'unmapped',confidence:'insufficient',routes:[],dimensions:[]}});
assert.equal(unknownPayload.power.score,null);assert.equal(unknownPayload.criteria.strategic.score,null);assert.equal(cleanDeck(unknownPayload).criteria.strategic.score,null);
assert.equal(unknownPayload.criteria.strategic.ratingStatus,'diagnostic-only');assert.ok(unknownPayload.facts.some(f=>/Strategic route estimate: unknown/.test(f)));
const zeroPayload=reviewPayload('mtg',deck,lookup,{...ready,score:0,strategic:{...strategic,score:0}});
assert.equal(zeroPayload.power.score,0);assert.equal(cleanDeck(zeroPayload).criteria.strategic.score,0,'known zero is distinct from unknown null');
for (const readiness of [{eligible:false,provisional:true,incomplete:true,missingCards:17,issues:['83/100 cards']},{eligible:false,provisional:true,issues:['Card is outside the commander’s color identity']},{eligible:false,issues:['Unresolved card data']}]) {
 const incomplete=reviewPayload('mtg',deck,lookup,{...ready,score:55,readiness,caps:[{key:'Legal',label:'Deck eligibility',max:55,why:readiness.issues[0]}]});
 for(const p of [incomplete,cleanDeck(incomplete)]) {
  assert.equal(p.power.score,null);assert.match(p.power.verdict,/Overall Power unavailable/);assert.doesNotMatch(p.power.verdict,/Held to 55/);
  assert.equal(p.power.engine,99,'structure remains a component diagnostic');assert.equal(p.criteria.strategic.ratingStatus,'diagnostic-only');
  assert.ok(p.checks.issues.some(s=>s.includes(readiness.issues[0])));
  assert.equal(p.power.areas.find(a=>a.key==='cap:Legal').status,'weak');
 }
 assert.equal(incomplete.power.areas.find(a=>a.key==='cap:Legal').max,null);
 const view=aiReviewDialogContent({result:{...suggestion,priority:'cap:Legal',explain:[{area:'cap:Legal',says:'Resolve deck eligibility first.',cards:[]}]},payload:incomplete,rows:[],game:'mtg'});
 assert.match(view,/Power unavailable/);assert.match(view,/Structure diagnostic/);assert.match(view,/Component diagnostics only/);
 assert.doesNotMatch(view,/Held to 55|max 55|Holds the score back/);
}
console.log('PASS: Compact strategic route metrics/limitations and null score round-trip; incomplete or illegal decks show unavailable overall Power while retaining diagnostics, never a Legal-cap rating.');

// Commander availability compares declared scenarios, not survival odds or a
// correction to overall Power. Support totals must not collapse to sample sizes.
{
 const supportRow={name:knight.name,qty:1,reasons:['Printed body independent of commander','Other conditions still apply'],evidence:['If you control a commander, draw a card.'],privateNotes:'PRIVATE_DEPENDENCE_SENTINEL'};
 const dependence={version:'commander-availability-v1',withCommander:{status:'provisional',confidence:'limited',score:63,bestRoute:'combat',execution:.6,library:99,routes:[{kind:'combat',label:'Combat pressure',execution:.6}]},withoutCommander:{status:'unmapped',confidence:'insufficient',score:null,bestRoute:null,execution:null,library:null,routes:[]},support:{independent:[supportRow],mixed:[supportRow],requiresCommander:[supportRow],unmapped:[{...supportRow,reasons:[],evidence:[]}]},counts:{independent:22,mixed:3,requiresCommander:2,unmapped:7},recast:[{name:dion.name,printedCost:'{3}{W}{W}',normalCastMana:5,missingColors:null,scenarios:[{priorCommandZoneCasts:0,genericTax:0,normalCost:'{3}{W}{W}',normalMana:5},{priorCommandZoneCasts:1,genericTax:2,normalCost:'{3}{W}{W} + {2}',normalMana:7},{priorCommandZoneCasts:2,genericTax:4,normalCost:'{3}{W}{W} + {4}',normalMana:9}],status:'conditional',exceptions:['Alternative costs and reductions remain unresolved.']}],modifierCards:['Possible cost modifier'],assumptions:['Same library; all commanders unavailable for battlefield/casting benefits.','Tax counts previous command-zone casts, not removals.'],limitations:['Diagnostic only; no automatic Power penalty, survival odds or winning-turn prediction.'],sources:['https://magic.wizards.com/en/formats/commander'],privateNotes:'PRIVATE_DEPENDENCE_SENTINEL',survivalProbability:.9,automaticPowerPenalty:20,diagnosticOnly:false};
 const prepared=reviewPayload('mtg',deck,lookup,{...ready,strategic:{...strategic,dependence}}),cleaned=cleanDeck(prepared),out=cleaned.criteria.strategic.dependence;
 assert.equal(prepared.power.score,63);assert.equal(cleaned.power.score,63,'counterfactual does not change overall Power');
 assert.equal(cleaned.criteria.strategic.score,63);assert.equal(cleaned.power.competitive,null);assert.equal(cleaned.checks.competitive,null);
 assert.equal(out.version,dependence.version);assert.equal(out.diagnosticOnly,true);assert.equal(out.ratingStatus,'diagnostic-only');
 assert.equal(out.withCommander.score,63);assert.equal(out.withCommander.execution,.6);assert.equal(out.withCommander.library,99);
 assert.equal(out.withoutCommander.score,null);assert.equal(out.withoutCommander.execution,null);assert.equal(out.withoutCommander.library,null);
 assert.equal(out.withoutCommander.status,'unmapped');assert.equal(out.withoutCommander.confidence,'insufficient');
 assert.deepEqual(out.counts,dependence.counts);assert.deepEqual(out.support.mixed[0].reasons,supportRow.reasons);assert.deepEqual(out.support.requiresCommander[0].evidence,supportRow.evidence);
 assert.equal(out.recast[0].printedCost,'{3}{W}{W}');assert.equal(out.recast[0].normalCastMana,5);assert.equal(out.recast[0].missingColors,null);
 assert.deepEqual(out.recast[0].scenarios,dependence.recast[0].scenarios);assert.deepEqual(out.recast[0].exceptions,dependence.recast[0].exceptions);
 assert.deepEqual(out.modifierCards,dependence.modifierCards);assert.deepEqual(out.assumptions,dependence.assumptions);assert.deepEqual(out.limitations,dependence.limitations);assert.deepEqual(out.sources,dependence.sources);
 assert.match(out.meaning,/not survival odds/);assert.match(out.meaning,/No automatic Power penalty or numeric AI score correction/);assert.match(out.meaning,/unmapped means unknown/);
 assert.ok(!JSON.stringify(out).includes('PRIVATE_DEPENDENCE_SENTINEL'));assert.ok(!('survivalProbability' in out));assert.ok(!('automaticPowerPenalty' in out));
 assert.deepEqual(cleanCriteria(cleaned.criteria),cleaned.criteria);
 const zero=cleanCriteria({strategic:{dependence:{...dependence,withoutCommander:{...dependence.withoutCommander,score:0,execution:0,library:0},recast:[{...dependence.recast[0],normalCastMana:0,missingColors:[],scenarios:[{priorCommandZoneCasts:0,genericTax:0,normalCost:'{0}',normalMana:0}]},{...dependence.recast[0],normalCastMana:null,missingColors:['W','W','U','invalid'],scenarios:[{priorCommandZoneCasts:1,genericTax:2,normalCost:'{X}{W} + {2}',normalMana:null}]}]}}}).strategic.dependence;
 assert.equal(zero.withoutCommander.score,0);assert.equal(zero.withoutCommander.execution,0);assert.equal(zero.withoutCommander.library,0);
 assert.deepEqual(zero.recast[0].missingColors,[],'known no missing color differs from unknown colors');assert.equal(zero.recast[0].normalCastMana,0);assert.equal(zero.recast[0].scenarios[0].normalMana,0);
 assert.deepEqual(zero.recast[1].missingColors,['W','U']);assert.equal(zero.recast[1].normalCastMana,null);assert.equal(zero.recast[1].scenarios[0].normalMana,null);
 const repeated=(n,item)=>Array.from({length:n},()=>item);
 const bounded=cleanCriteria({strategic:{dependence:{...dependence,support:{independent:repeated(300,{...supportRow,reasons:repeated(8,'A'.repeat(1000)),evidence:repeated(7,'B'.repeat(1000))}),mixed:[],requiresCommander:[],unmapped:[]},counts:{independent:500,mixed:0,requiresCommander:0,unmapped:null},withCommander:{...dependence.withCommander,routes:repeated(7,dependence.withCommander.routes[0])},recast:repeated(5,{...dependence.recast[0],scenarios:repeated(6,dependence.recast[0].scenarios[0]),exceptions:repeated(8,'Unresolved exception')}),modifierCards:repeated(20,'Modifier'),assumptions:repeated(9,'Assumption'),limitations:repeated(12,'Limitation'),sources:repeated(6,dependence.sources[0])}}});
 const sample=bounded.strategic.dependence;
 assert.equal(sample.support.independent.length,8);assert.equal(sample.supportOmitted.independent,292);assert.equal(sample.counts.independent,500);assert.equal(sample.counts.unmapped,null);
 assert.equal(sample.support.independent[0].reasons.length,4);assert.equal(sample.support.independent[0].reasons[0].length,200);assert.equal(sample.support.independent[0].reasonsOmitted,4);
 assert.equal(sample.support.independent[0].evidence.length,3);assert.equal(sample.support.independent[0].evidence[0].length,350);assert.equal(sample.support.independent[0].evidenceOmitted,4);
 assert.equal(sample.withCommander.routes.length,4);assert.equal(sample.withCommander.routesOmitted,3);
 assert.equal(sample.recast.length,2);assert.equal(sample.recastOmitted,3);assert.equal(sample.recast[0].scenarios.length,4);assert.equal(sample.recast[0].scenariosOmitted,2);assert.equal(sample.recast[0].exceptionsOmitted,2);
 assert.equal(sample.modifierCardsOmitted,8);assert.equal(sample.assumptionsOmitted,3);assert.equal(sample.limitationsOmitted,4);assert.equal(sample.sourcesOmitted,2);
 assert.deepEqual(cleanCriteria(bounded),bounded,'bounded samples and omission counts survive repeated transport, including more than 250 omissions');
 assert.ok(Buffer.byteLength(JSON.stringify(bounded))<30000,'dependence evidence remains a compact sample rather than the full repeated input');
 assert.equal(cleanCriteria({strategic:{}}).strategic.dependence,null);
 assert.equal(cleanCriteria({strategic:{dependence:[]}}).strategic.dependence,null);
 const unknown=cleanCriteria({strategic:{dependence:{}}}).strategic.dependence;
 assert.equal(unknown.withCommander,null);assert.equal(unknown.withoutCommander,null);assert.ok(Object.values(unknown.counts).every(n=>n===null));
 const urls=cleanCriteria({strategic:{dependence:{sources:['javascript:alert(1)','data:text/plain,private',dependence.sources[0]]}}}).strategic.dependence.sources;
 assert.deepEqual(urls,dependence.sources);
 // Exercise actual public card text and the current producer, not just the schema.
 const {commanderStrategicEstimate}=await import('./commander-strategy.js');
 const {engineProfile,engineRoles}=await import('./insights.js');
 const {cardKey}=await import('./core.js');
 const source=JSON.parse(readFileSync(new URL('./test-fixtures/commander-context.json',import.meta.url)));
 for(const actualDeck of [source.decks.knights,source.decks.highRamp]) {
  const context=engineProfile(actualDeck,source.catalog).criteria,actual=commanderStrategicEstimate(actualDeck,source.catalog,context,{roles:engineRoles}),before=JSON.stringify(actual);
  const request=reviewPayload('mtg',actualDeck,n=>source.catalog[cardKey(n)],{...ready,score:actual.score,criteria:context,strategic:actual}),response=cleanDeck(request),dep=response.criteria.strategic.dependence;
  assert.ok(dep);assert.equal(dep.withCommander.score,actual.dependence.withCommander.score);assert.equal(dep.withoutCommander.score,actual.dependence.withoutCommander.score);assert.deepEqual(dep.counts,actual.dependence.counts);
  assert.deepEqual(dep.recast[0].scenarios,actual.dependence.recast[0].scenarios);assert.deepEqual(dep.recast[0].missingColors,actual.dependence.recast[0].missingColors);
  assert.equal(response.power.score,actual.score);assert.equal(response.power.competitive,null);assert.equal(response.checks.competitive,null);
  assert.deepEqual(cleanCriteria(response.criteria),response.criteria);assert.equal(JSON.stringify(actual),before,'transport cannot mutate scoring evidence');
  assert.ok(Buffer.byteLength(JSON.stringify(request))<200000);
 }
 console.log('PASS: Diagnostic-only commander availability, null/zero scenario scores and recast costs, tax scenarios, per-group totals, bounded evidence/omissions and source links round-trip without a Power penalty or competitive fabrication; actual Dion/Kinnan producer covered.');
}

// Public-card constructed fixture, with no target score or tournament conclusion.
{
 const {mtgConstructedPower,mtgConstructedCardProfile}=await import('./deckpower.js');
 const {cardKey}=await import('./core.js');
 const source=JSON.parse(readFileSync(new URL('./test-fixtures/standard-effect-cards.json',import.meta.url)));
 const catalog=Object.fromEntries(source.cards.map(c=>[cardKey(c.name),c]));
 const result=mtgConstructedPower(source.syntheticDeck,catalog,cardKey,60);
 const prepared=reviewPayload('mtg',source.syntheticDeck,n=>catalog[cardKey(n)],{...result,heuristic:result.score,ctx:{from:'rogue',score:result.score,fieldEstimate:null},readiness:{eligible:true,provisional:false,issues:[]}});
 const cleaned=cleanDeck(prepared), constructed=cleaned.criteria.constructed, card=n=>constructed.cards.find(c=>c.name===n);
 assert.equal(constructed.version,'constructed-evidence-v1');
 assert.equal(prepared.power.competitive,null);assert.equal(cleaned.checks.competitive,null);
 const news=card('Action News Crew').flow.effects[0];
 assert.equal(news.mode,'alternative');assert.equal(news.activationMana,6);assert.equal(news.effectMana,6);assert.equal(news.status,'conditional');assert.match(news.requirements.join(' '),/Discard this card instead of casting/);
 const basri=card("Basri, Tomorrow's Champion");
 assert.equal(basri.flow.effects[0].mode,'alternative');assert.equal(basri.flow.effects[0].activationMana,3);
 assert.ok(basri.requirements.some(r=>r.kind==='activation'&&r.activationMana===1&&r.exert));
 for(const name of ['Aang, the Last Airbender','Flash Thompson, Spider-Fan']){assert.equal(card(name).interaction.kind,'tempo');assert.equal(card(name).interaction.effective,.5);assert.match(card(name).interaction.limitations.join(' '),/Temporary interaction, not permanent removal/);}
 assert.ok(card('Aang, the Last Airbender').requirements.some(r=>r.kind==='typed-support'&&r.status==='unsupported'));
 assert.ok(card('Aunt May').requirements.some(r=>r.kind==='typed-support'&&r.status==='unsupported'));
 assert.ok(card('Cat Collector').requirements.some(r=>r.kind==='life-gain'&&r.note.includes('At most one trigger')));
 assert.ok(card('Sage of the Skies').requirements.some(r=>r.kind==='prior-spell'&&Number.isFinite(r.minimumMana)));
 assert.ok(card('Hero in Training').threat.positive.length);assert.ok(card('Hero in Training').flow.effects[0].evidence.includes('draw a card'));
 assert.ok(constructed.cards.every(c=>typeof c.threat.status==='string'&&Array.isArray(c.unsupported)));
 assert.match(constructed.evidencePolicy,/heuristics, not authoritative conclusions/);assert.match(constructed.evidencePolicy,/Explain disagreements/);
 assert.deepEqual(cleanCriteria(cleaned.criteria),cleaned.criteria,'constructed criteria round-trip is idempotent');
 assert.ok(cleaned.facts.some(f=>/Action News Crew: alternative, activation 6 mana, modeled total effect cost 6/.test(f)));
 assert.ok(cleaned.facts.some(f=>/heuristic judgments/.test(f)&&/challenged/.test(f)));
 const newsRow=cleaned.cards.find(c=>c.name==='Action News Crew');
 const output=validateReview({...model,headline:'Consider the paid draw costs.',beyond:[{area:'Flow',note:'Only 1 effective cheap-flow source is an estimate; Action News Crew requires six mana and discarding the card, not its creature casting cost.',evidence:[{cardId:newsRow.id,quote:'Channel — {6}, Discard this card: Put a +1/+1 counter on each creature you control. Draw a card.'}]}]},cleaned);
 assert.equal(output.beyond.length,1,'card-text-backed disagreement with an effective heuristic is allowed');
 assert.equal(output.beyond[0].countScope,'effective-estimate');
 const crowd=source.cards.find(c=>c.name==='Crowd of True Believers'),crowdProfile=mtgConstructedCardProfile(crowd,source.cards.map(c=>({name:c.name,c,qty:1})));
 const solo=cleanCriteria({constructed:{...result.constructedCriteria,cards:[{name:crowd.name,qty:1,...crowdProfile}]}}).constructed.cards[0];
 assert.ok(solo.requirements.some(r=>r.kind==='solo-attacker'&&r.note.includes('exactly one attacking')));
 assert.ok(solo.requirements.some(r=>r.kind==='activation'&&r.tap&&r.activationMana===0));
 const withUnknown=cleanCriteria({constructed:{...result.constructedCriteria,privateNotes:'private',cards:[{...result.constructedCriteria.cards[0],flow:{...result.constructedCriteria.cards[0].flow,effects:[{...news,activationMana:null,effectMana:null}]} }]}}).constructed;
 assert.equal(withUnknown.cards[0].flow.effects[0].activationMana,null);assert.equal(withUnknown.cards[0].flow.effects[0].effectMana,null);assert.ok(!JSON.stringify(withUnknown).includes('privateNotes'));
 assert.ok(Buffer.byteLength(JSON.stringify(prepared))<200000);
 console.log('PASS: Constructed printed costs/alternative modes, temporary interaction, typed/solo/activation/life-gain/prior-spell requirements and uncertainty reach coaching; explained heuristic disagreement survives.');
}

{
 const gap={status:'unsupported',label:'Important storm / recursion route not assessed',primaryCopies:64,eligibleCopies:81,reason:'Explicit spell conversion remains unmodeled.',missingCapabilities:['Storm-copy output','Graveyard recasting costs and fuel'],evidence:[{name:'Brain Freeze',kind:'storm-output',text:'Target player mills three cards. Storm'}],privateNotes:'DO_NOT_TRANSMIT'};
 const p={...ready,score:null,ctx:{from:'commander',score:null},strategic:{...strategic,score:null,status:'primary-route-unmapped',partialScore:41,primaryRouteCoverage:gap}};
 const prepared=reviewPayload('mtg',deck,lookup,p),cleaned=cleanDeck(prepared),out=cleaned.criteria.strategic;
 assert.equal(out.score,null);assert.equal(out.partialScore,41);assert.equal(out.ratingStatus,'diagnostic-only');assert.equal(prepared.power.competitive,null);assert.equal(cleaned.checks.competitive,null);
 assert.equal(out.primaryRouteCoverage.label,gap.label);assert.deepEqual(out.primaryRouteCoverage.missingCapabilities,gap.missingCapabilities);assert.equal(out.primaryRouteCoverage.evidence[0].name,'Brain Freeze');assert.match(out.primaryRouteCoverage.meaning,/diagnostic only/);assert.ok(!JSON.stringify(out).includes('DO_NOT_TRANSMIT'));
 assert.deepEqual(cleanCriteria(cleaned.criteria),cleaned.criteria,'primary-route uncertainty round-trips without promoting the partial score');
 console.log('PASS: named important conversion gap and partial-only diagnostics survive coach cleaning, while overall/competitive remain null.');
}
