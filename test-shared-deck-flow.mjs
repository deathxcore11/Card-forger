// Synthetic card data and mocked I/O; the production builders, validators,
// pricing, Power analysis, result gate and renderers execute unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {S,blank} from './store.js';
import * as T from './tcg.js';
import {cardKey,cardPrice} from './core.js';
import {createDeckPipeline} from './deck-pipeline.js';
import {normalizeDeckRequest,priceDeck,chooseDeck,constructDeck} from './deck-construction.js';
import {deckResultMarkup,deckSetupMarkup} from './deck-experience.js';
import {makeAskTools} from './ai-tools.js';
import {inspectMechanicPlan} from './deck-mechanic-plan.js';
S.state=blank();S.catalog={};
const card=(name,type='Artifact',ci=[],price='.25',extra={})=>({name,type_line:type,color_identity:ci,colors:ci,mana_cost:ci.length?'{1}{'+ci[0]+'}':'{2}',cmc:2,oracle_text:'Draw a card.',legalities:{commander:'legal',modern:'legal'},prices:{usd:price},...extra});
const anchor=card('Fixture build-around'),leader=card('Fixture leader','Legendary Creature — Human Artificer',['U'],'2',{oracle_text:'Whenever you cast an artifact spell, create a 1/1 colorless Thopter artifact creature token with flying.'}),land=card('Island','Basic Land — Island',['U'],'.10',{produced_mana:['U'],cmc:0,mana_cost:''});
const pool=[anchor,leader,land,...Array.from({length:85},(_,i)=>card('Artifact fixture '+i,'Artifact',[],'.25',{oracle_text:i%3===0?'Draw a card.':i%3===1?'Add {C}.':'Destroy target artifact.'}))];
for(const c of pool)S.catalog[cardKey(c.name)]=c;
let calls=0;
const context={S,T,tcgCtx:{},meta:name=>S.catalog[cardKey(name)],resolve:async name=>S.catalog[cardKey(name)],cacheCard:c=>S.catalog[cardKey(c.name)]=c,inv:()=>({available:0}),priceOf:name=>cardPrice(S.catalog[cardKey(name)]),api:async path=>{calls++;const q=new URL(path,'https://fixture.invalid').searchParams.get('q');return {data:q?.includes('is:commander')?[leader]:pool};}};
const pipeline=createDeckPipeline(context);
const request={game:'mtg',format:'Commander',seed:anchor.name,commander:leader.name,budget:'10',budgetMode:'target',theme:'Artifacts',preferOwned:false};
let result=await pipeline.build(request);
assert(result.ok,JSON.stringify(result));assert.equal(result.rows.reduce((n,r)=>n+r.qty,0),100);assert(result.rows.some(r=>r.name===anchor.name));assert(pipeline.recheck(result));assert(result.delta>0);assert.equal(result.budgetStatus,'outside-target');assert.equal(S.state.decks.length,0);assert(calls<15,'card retrieval is bounded, not one call per deck slot');
const markup=deckResultMarkup(result,'fixture');assert.match(markup,/Save deck/);assert.match(markup,/exceeds the allowed overage/);assert.doesNotMatch(markup,/Save draft|Hard to play|Buy .*TCG/);
assert.equal(normalizeDeckRequest({...request,budget:''},pipeline.formats).budget,null);assert.equal(normalizeDeckRequest({...request,budget:0},pipeline.formats).budget,0);
assert.equal(priceDeck([{id:'x',qty:4,price:null,owned:1}]).estimate,null);
assert.equal(priceDeck([{id:'x',qty:3,price:1,owned:3},{id:'x',qty:2,price:1,owned:3}],'purchase').subtotal,2,'shared owned copies allocated once across zones');
assert.equal(priceDeck([{id:'x',qty:4,price:'',owned:0}]).estimate,null);
const setup=deckSetupMarkup({request:{...request,seedCard:anchor}},pipeline.formats);assert.match(setup,/data-flow-field="budget" type="number"/);assert.match(setup,/data-flow-field="format"/);assert.match(setup,/Generate deck/);assert.doesNotMatch(setup,/fmt-chips|Save all/);
const ghoti=JSON.parse(fs.readFileSync('tests/fixtures/deck-construction/ghoti-incomplete-report.json'));
const failure=chooseDeck([{deck:{},check:{complete:false,legal:true,issues:[`Required build-around ${ghoti.requiredCard} is missing.`]},plan:{issues:[]},pricing:{}}],normalizeDeckRequest({game:'ygo',format:'tcg',budget:100},pipeline.formats));
assert.equal(failure.ok,false);assert.match(failure.message,/missing/);assert.doesNotMatch(deckResultMarkup(failure,'bad'),/data-act="flowSave"|Buy|Hard to play/);
// Unknown prices still allow a complete checked list, without a false budget fit.
land.prices.usd=null;result=await pipeline.build({...request,budget:''});assert(result.ok,result.message);assert.equal(result.pricing.estimate,null);assert(result.pricing.unpriced>0);assert.equal(result.budgetStatus,'unverified');assert.match(deckResultMarkup(result,'unknown'),/budget fit are unverified/);
land.prices.usd='.10';
let live=true;const pending=constructDeck(request,{formats:pipeline.formats,construct:async()=>{live=false;return [];}},{current:()=>live});await assert.rejects(pending,e=>e.name==='AbortError');
// Chat keeps a compact receipt and opens the exact checked result in the shared
// deck sheet. Opening an answer must not run construction again or save it.
let registered,opened=0,openedId=null;const tools=makeAskTools({...context,esc:(await import('./ui.js')).esc,deckExperience:{build:pipeline.build,register:r=>{registered=r;return 'sheet-result';},openResult:id=>{opened++;openedId=id;},isCurrent:()=>true,markup:()=>'<article class="deck-flow-result">Full deck in chat</article>'},openMtgDraft:()=>{throw Error('Shared builds never use the legacy setup handoff');}});
const answer=await tools.build_deck({...request,budget:50,style:'artifacts',budget_basis:'total'});assert(answer.complete,JSON.stringify(answer));assert.equal(answer.cards.reduce((s,r)=>s+r.qty,0),100);assert.deepEqual(answer.cards,registered.rows.map(r=>({name:r.name,qty:r.qty,zone:r.zone})));
const receipt=tools.pendingItem(),receiptMarkup=tools.preview(receipt,0);assert.equal(receipt.openOnComplete,true,'the app owns the automatic deck handoff');assert.match(receiptMarkup,/data-ask-show=/);assert.match(receiptMarkup,/Fixture build-around/);assert.doesNotMatch(receiptMarkup,/deck-flow-result|flowSave|flowExport|flowCard/,'full deck controls belong only in the deck sheet');assert.equal(opened,0,'the tool finishes before the UI closes Ask');
await tools.open(receipt);assert.equal(opened,1);assert.equal(openedId,'sheet-result');tools.reset();await tools.open(receipt);assert.equal(opened,2,'older receipt keeps its exact result after another question');assert.equal(S.state.decks.length,0);
console.log('PASS: shared construction/validation/Power gate, exact separate-sheet AI handoff, compact persistent receipt, explicit overage, unknown quotes, owned allocation, incomplete Ghoti refusal and stale cancellation.');

// Saving changes the workspace stamp but must not break this result's read actions.
const {createDeckExperience}=await import('./deck-experience.js');
let workspace=0,account=0,exported='',openedHtml='',openedRequest=null,changeAccountOnSave=false;
const actions={},scope=()=>{const a=account,w=workspace;return()=>a===account&&w===workspace;};
const experience=createDeckExperience({A:actions,pipeline,scope,identity:()=>{const a=account;return()=>a===account;},
 save:async()=>{workspace++;if(changeAccountOnSave)account++;},export:text=>exported=text,
 open:(html,request)=>{openedHtml=html;openedRequest=request;},meta:context.meta,T,
 onInput:()=>{},game:()=> 'mtg'});
const savedId=experience.register(result,scope()),saveButton={dataset:{result:savedId}};
assert.equal(experience.openResult(savedId),savedId);assert.match(openedHtml,new RegExp('data-flow-result="'+savedId+'"'));assert.deepEqual(openedRequest,result.request);assert.match(openedHtml,/flowSave/);
await actions.flowSave(saveButton);assert.equal(experience.isCurrent(savedId),true,'saving refreshes this exact result lifetime');assert.equal(experience.openResult(savedId),savedId);assert.match(openedHtml,/data-act="flowSave"[^>]*disabled>Saved to My decks/,'reopening a saved receipt preserves its visible saved state');assert.equal(saveButton.textContent,'Saved to My decks');actions.flowExport(saveButton);assert.match(exported,/Fixture build-around/);
account++;assert.equal(experience.isCurrent(savedId),false);assert.throws(()=>experience.openResult(savedId),/account or collection changed/);assert.throws(()=>actions.flowExport(saveButton),/account or collection changed/);
const unsafeId=experience.register(result,scope());changeAccountOnSave=true;
await assert.rejects(actions.flowSave({dataset:{result:unsafeId}}),/account changed while saving/);
assert.throws(()=>actions.flowExport({dataset:{result:unsafeId}}),/account or collection changed/);
console.log('PASS: Save → Export stays usable; account changes before or during Save remain blocked.');

// Every game and AI/manual result uses the same existing deck design.
for(const game of ['mtg','ygo','ptcg']){
 const html=deckResultMarkup({...result,request:{...result.request,game}},'presentation');
 assert.match(html,/class="cs-hero compact/);assert.match(html,/class="cs-title"/);
 assert.match(html,/list compact deck-compact-list/);assert.match(html,/mini-row art-row deck-compact-row/);
 assert.doesNotMatch(html,/deck-flow-row|Tournament-backed/);assert.match(html,/data-flow-budget[^>]*value=""/);assert.match(html,/Rebuild with budget/);
 const busy=deckSetupMarkup({request:{...request,game},busy:true,status:'Checking the selected cards…'},pipeline.formats);
 assert.match(busy,/Your deck is being built/);assert.match(busy,/brand-loading/);assert.match(busy,/flowCancelBuild/);
 assert.doesNotMatch(busy,/data-flow-field/,'in-progress setup exposes cancellation, not editable stale inputs');
}
console.log('PASS: shared generated-deck presentation and branded progress for all three games.');

// Presentation must distinguish card-type purity, conditional loop output and
// the quality of a strategic package. These are different claims to the player.
const combo={requested:true,status:'verified',requirement:'infinite-mana',issues:[],packages:[{id:'fixture-basalt',label:'Basalt Monolith + Forsaken Monument',status:'verified',cards:['Basalt Monolith','Forsaken Monument'],prerequisites:['Both pieces are on the battlefield.','Pay their casting costs before starting.'],steps:['Tap Basalt Monolith for four colorless mana.','Pay three colorless mana to untap Basalt <Monolith>.','Repeat with one more colorless mana each time.'],netResources:{C:1},startupMana:0,output:'colorless',limitations:['This makes colorless mana, not red mana.','An opponent can interrupt the loop. It is not an automatic win.'],sources:[{title:'Official rules',url:'https://magic.wizards.com/en/rules'},{title:'Unsafe script',url:'javascript:alert(1)'},{title:'Lookalike domain',url:'https://magic.wizards.com.example.invalid/'}]}],missing:[],scope:'Checks this list and the recognized setup; does not simulate a game.'};
const strategy={status:'partial',goal:'strongest',groups:[{tribe:'goblin',members:{libraryCopies:24,commanderCopies:1,creatureShare:.8},producers:{libraryCopies:4,commanderCopies:1},payoffs:{libraryCopies:2,commanderCopies:0},resources:{libraryCopies:1,commanderCopies:0},coverage:{library:99,supportCopies:12,providerCopies:4,seen:11,supportAccess:.76,providerAccess:.39},missing:['More independent token producers are needed.']}],issues:[],notes:[],limitations:['Natural access is not a win probability.'],competitive:'unverified'};
const strategicResult={...result,requestSatisfied:false,request:{...result.request,game:'mtg',colors:['R'],creatureTypesOnly:['goblin'],excludedSubtypes:['elf'],requireLoop:'infinite-mana'},plan:{...result.plan,combo,strategy}};
let planMarkup=deckResultMarkup(strategicResult,'strategy');
for(const expected of ['Mono-red identity','Goblin creature cards only','No Elf creature cards','Noncreature support is allowed; token types may differ.','Some request checks remain unmet or unverified.','Tribal plan partly established','Competitive performance is unverified.','Infinite colorless mana','Requires the listed battlefield setup; not an automatic win.','How the mana loop works','Net per repetition:','+1 colorless mana','Floating mana needed after deploying the pieces: 0. Casting costs are separate.','76% to recognized support','39% to a recognized provider','first 11 library cards','More independent token producers are needed.'])assert(planMarkup.includes(expected),expected);
assert(planMarkup.indexOf('Tribal plan partly established')<planMarkup.indexOf('data-act="flowSave"'),'partial strategy remains visible before the Save action');
assert(planMarkup.indexOf('Pay their casting costs before starting.')<planMarkup.indexOf('Repeat these steps'),'setup precedes the repeatable steps');
assert.match(planMarkup,/Basalt &lt;Monolith&gt;/);assert.doesNotMatch(planMarkup,/Basalt <Monolith>|javascript:|example\.invalid|Infinite red mana|win rate:|winner/i);
assert.match(planMarkup,/href="https:\/\/magic\.wizards\.com\/en\/rules"[^>]*rel="noopener noreferrer"/);
for(const status of ['unverified','conflict']){
 const html=deckResultMarkup({...strategicResult,plan:{...strategicResult.plan,combo:{...combo,status,issues:['The requested mana output has not been established.']}}},status);
 assert(html.includes(status==='conflict'?'Mana loop conflicts with this list':'Requested mana loop is unverified'));
 assert.doesNotMatch(html,/<b>Infinite colorless mana<\/b>/,'unverified/conflicting aggregate cannot inherit a verified loop headline');
}
const blocked=deckResultMarkup({...strategicResult,plan:{...strategicResult.plan,combo:{...combo,status:'unverified',packages:[],missing:[{id:'blocked',cards:['Rings of Brighthearth'],invalidCards:['Changed rules <card>'],blockedBy:['Null Rod']} ]}}},'blocked');
for(const reason of ['Missing package pieces: Rings of Brighthearth.','Unverified package cards: Changed rules &lt;card&gt;.','Blocked by: Null Rod.'])assert(blocked.includes(reason),reason);
planMarkup=deckResultMarkup({...strategicResult,plan:{...strategicResult.plan,combo:{...combo,packages:[{...combo.packages[0],output:'unknown'}]}}},'unknown-output');
assert.match(planMarkup,/Requested mana loop is unverified/);assert.doesNotMatch(planMarkup,/<b>Infinite .*mana.*<\/b>/,'unknown output cannot become a mana-production claim');
console.log('PASS: request restrictions, visible partial strategy, natural-access scope, conditional colorless loop prerequisites/steps/resources, official safe sources and unverified/conflicting/unknown-output disclosures.');

// Actual prerequisite reports drive visible result copy. A familiar keyword or
// one incidental Slith must not acquire a full-theme success headline in the UI.
const mechanicCards=JSON.parse(fs.readFileSync('tests/fixtures/mechanic-plan-cards.json')).cards,mechanicCard=name=>mechanicCards.find(c=>c.name===name),mechanicRow=(card,qty=1,zone='main')=>({card,name:card.name,qty,zone,price:null}),mechanicBasic=card('Swamp','Basic Land — Swamp',['B'],'.10',{oracle_text:'{T}: Add {B}.',power:undefined}),mechanicFill=n=>Array.from({length:n},(_,i)=>mechanicRow(card('Unrelated mechanic fixture '+i)));
const renderMechanic=(rows,mechanics,{theme='Bloodlust',commander=''}={})=>deckResultMarkup({...result,requestSatisfied:mechanics.status==='supported',request:{...result.request,game:'mtg',budget:null,theme,seedCard:rows[0].card},deck:{...result.deck,buildAround:rows[0].name,commander},rows:rows.map(r=>({...r,zone:'main'})),plan:{...result.plan,strategy:null,combo:null,mechanics}},'mechanic-result');
const incidentalRows=[mechanicRow(mechanicCard('Slith Firewalker')),mechanicRow(mechanicBasic,36),...mechanicFill(63)],incidentalMechanic=inspectMechanicPlan(incidentalRows,{abilities:['Bloodlust']}),incidentalMarkup=renderMechanic(incidentalRows,incidentalMechanic);
assert.equal(incidentalMechanic.status,'partial');assert.equal(incidentalMechanic.groups[0].mechanismStatus,'supported');
for(const expected of ['Bloodlust · informal combat-growth: Plan partly established.','Recognizing a rules connection does not establish a focused, working deck.','Rules connection:</b> Recognized, with the printed conditions.','Focused coverage:</b> Plan partly established.','How the requested mechanics connect','Merely attacking, noncombat damage and life loss do not establish this growth.','first 11 seen','11% to naturally see at least one payoff','not universal deck rules or win probabilities'])assert(incidentalMarkup.includes(expected),expected);
assert(incidentalMarkup.indexOf('Bloodlust · informal combat-growth: Plan partly established.')<incidentalMarkup.indexOf('data-act="flowSave"'),'mechanic qualification is visible before saving');
assert(incidentalMarkup.indexOf('How the requested mechanics connect')<incidentalMarkup.indexOf('class="deck-flow-cards"'),'mechanic details use the established disclosure placement before the card list');
assert.doesNotMatch(incidentalMarkup,/Bloodlust · informal combat-growth: Conditional plan recognized\./,'a valid individual growth rule cannot upgrade thin deck coverage');
assert.match(incidentalMarkup,/Community reference: Bloodlust/);assert.match(incidentalMarkup,/Official reference: Drana card text and combat timing/);
assert.match(incidentalMarkup,/href="https:\/\/mtg\.wiki\/page\/Bloodlust"[^>]*rel="noopener noreferrer"/);

const drana=mechanicCard('Drana, Liberator of Malakir'),commanderRows=[mechanicRow(drana,1,'commander'),mechanicRow(mechanicBasic,36),...mechanicFill(63)],commanderMechanic=inspectMechanicPlan(commanderRows,{abilities:['Bloodlust'],commander:drana.name}),commanderMarkup=renderMechanic(commanderRows,commanderMechanic,{commander:drana.name});
assert.equal(commanderMechanic.status,'supported');
for(const expected of ['Bloodlust · informal combat-growth: Conditional plan recognized.','on each attacking creature you control','Counters resolved after first-strike damage can affect a later regular combat-damage step; damage already dealt stays unchanged.','99 cards; first 11 seen. 0% to naturally see at least one payoff','The payoff is accessible from the command zone and still must be cast.','Command-zone cards are excluded from these draw odds.'])assert(commanderMarkup.includes(expected),expected);
assert.doesNotMatch(commanderMarkup,/guaranteed win|automatic lethal|100% win|combat always connects/i);

const bloodthirstRows=[mechanicRow(mechanicCard('Vampire Outcasts')),mechanicRow(mechanicCard('Bloodrage Vampire')),mechanicRow(mechanicCard('Sign in Blood')),mechanicRow(mechanicBasic,36),...mechanicFill(61)],bloodthirstMechanic=inspectMechanicPlan(bloodthirstRows,{abilities:['Bloodthirst']}),bloodthirstMarkup=renderMechanic(bloodthirstRows,bloodthirstMechanic,{theme:'Bloodthirst'});
assert.equal(bloodthirstMechanic.status,'partial');
for(const expected of ['Bloodthirst · keyword: Plan partly established.','An opponent must be dealt damage earlier in the same turn, before entry. Life loss alone does not qualify','entering creature’s own entry-damage trigger is too late.','Bloodthirst 2: 2 +1/+1 counters after qualifying damage, regardless of how much damage enabled it.'])assert(bloodthirstMarkup.includes(expected),expected);
assert.doesNotMatch(bloodthirstMarkup,/Bloodlust · informal combat-growth/,'the separate mechanic must not inherit the informal growth label');

const unsafeMechanics=structuredClone(commanderMechanic),unsafeGroup=unsafeMechanics.groups[0];unsafeGroup.payoffs[0].name='<img src=x onerror=alert(1)>';unsafeGroup.routes[0].requirements.push('<script>unsafe prerequisite</script>');unsafeGroup.rule={source:{url:'javascript:alert(1)',title:'Unsafe source'}};
let unsafeMarkup=renderMechanic(commanderRows,unsafeMechanics,{commander:drana.name});assert.match(unsafeMarkup,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.match(unsafeMarkup,/&lt;script&gt;unsafe prerequisite&lt;\/script&gt;/);assert.doesNotMatch(unsafeMarkup,/<img src=x|<script>unsafe|javascript:/);
for(const url of ['http://mtg.wiki/page/Bloodlust','https://magic.wizards.com.example.invalid/','https://mtg.wiki.example.invalid/','https://person@mtg.wiki/page/Bloodlust','https://mtg.wiki:444/page/Bloodlust']){unsafeGroup.rule.source={url,title:'Rejected source <card>'};unsafeMarkup=renderMechanic(commanderRows,unsafeMechanics,{commander:drana.name});assert.doesNotMatch(unsafeMarkup,/Rejected source|example\.invalid|person@|:444/);}
const notRequestedMarkup=renderMechanic(commanderRows,{status:'not-requested',groups:[]});assert.doesNotMatch(notRequestedMarkup,/data-flow-mechanic-status|deck-mechanic-checks/,'ordinary deck results gain no empty mechanic section');
console.log('PASS: actual partial Bloodlust coverage, conditional Drana/first-strike setup, distinct Bloodthirst damage prerequisites, command-zone draw exclusion, safe community/official sources and escaped mechanic evidence.');
