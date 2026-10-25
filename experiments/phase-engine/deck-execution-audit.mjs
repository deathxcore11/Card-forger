// DECK-001: exact published decks, shipped runtime, isolated mechanic assertions.
// No coverage promotion, generated card definitions, CPU policy or UI changes.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {bootAcceptance, digest} from './acceptance-inputs.mjs';
import {prepare, deck, state, snapshot, candidates} from './mechanics-fixtures.mjs';
import {projectInteraction, interactionSubmission} from './interaction-surface.mjs';
import {prepareMatchInput, evaluateMatchAdmission} from './match-input.mjs';
import {PRACTICE_COVERAGE} from './practice-coverage.mjs';

const taskBase = 'cfc8f6a5d9cbcfad9252805616cb3467e2ff4ec4';
const integrationInspected = '2a1cb86ccf102321f3cfe662a9fcf83b6447bcbf';
const fixturePaths = ['tramplesaurus-rex', 'calling-all-angels'].map(n => `fixtures/deck-001/${n}.json`);
const decks = await Promise.all(fixturePaths.map(async p => JSON.parse(await readFile(new URL(p, import.meta.url)))));
const catalogBytes = await readFile(new URL('./runtime/a86578b23adcd26c/card-rules.bin', import.meta.url));
const preflightCatalog = JSON.parse(gunzipSync(catalogBytes));
const names = [...new Set(decks.flatMap(d => d.cards.map(c => c.name)))].filter(n => Object.hasOwn(preflightCatalog, n.toLowerCase()));
const {engine: e, catalog, provenance} = await bootAcceptance(names);
const output = resolve(process.env.CARDSTASHY_DECK_AUDIT_OUTPUT || 'test-results/deck-001');
await mkdir(output, {recursive: true});
const requested = new Set((process.env.CARDSTASHY_DECK_AUDIT_CASES || '').split(',').filter(Boolean));
const report = {
  schema: 1, task: 'DECK-001', taskBase, integrationInspected, provenance,
  startedAt: new Date().toISOString(), environment: {node: process.version, platform: process.platform, arch: process.arch},
  rulesReference: 'https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt',
  sessionContractReference: 'fe480bfa42222bd20274b4a97ba60419bad64f94:docs/session001-turn-flow-v1.md',
  cases: [], decks: [],
  limits: [
    'Exact published lists are retained; unavailable card records are not invented or substituted.',
    'Full decks are audited for admission, not initialized with missing rules.',
    'Mechanic starts are engineered two-seat Vintage positions, not complete Commander games.',
    'Interaction API assertions are not rendered browser controls or CPU-policy checks.',
    'Live catalog legality, current picker/account availability, full matches and broader support remain unverified.',
    'Product recovery remains UNSUPPORTED. No engine build or deployment is part of this task.'
  ]
};
let active;
const exact = v => JSON.stringify(v);
const hasAction = (c, code) => c.available && c.surfaces.some(s => s.type === 'action' && s.code === code);
const hasObject = (c, id) => c.surfaces.some(s => s.type === 'object' && s.reference === String(id));
function differences(a,b,path='',out=[]) {
  if(exact(a)===exact(b))return out;
  if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[key],b[key],path+'/'+key,out);
  else out.push({path,before:a,after:b});
  return out;
}
function observe(label, actor = 0) {
  const packet = e.get_legal_actions_for_viewer_js(actor);
  const interaction = projectInteraction(e.get_viewer_snapshot_js(actor).viewerInteraction, actor);
  active.observations.push({label, actor, packet, interaction});
  return {packet, interaction};
}
function saveStart() {
  active.startingState = JSON.parse(snapshot(e));
  active.startingStateSha256 = digest(exact(active.startingState));
}
function fixture({land = 'Forest', own = [], opponent = [], placements = [], activeSeat = 0} = {}) {
  const f = prepare(e, deck(land, ...own), deck('Forest', ...opponent));
  const moved = {};
  for (const [key, name, owner, zone, count = 1] of placements) moved[key] = f.move(name, owner, zone, count);
  f.s.active_player = activeSeat;
  f.restore();
  active.fixture = {format: 'Vintage', seed: 12345, land, own, opponent, placements, activeSeat, ids: moved};
  saveStart();
  return Object.fromEntries(Object.entries(moved).map(([key, value]) => [key, value.length === 1 ? value[0] : value]));
}
function submit(actor, action, {reject = false} = {}) {
  const witness = e.get_legal_actions_for_viewer_js(actor).actions.some(a => exact(a) === exact(action));
  if (!reject) assert(witness, 'accepted direct action needs an engine candidate');
  const before = snapshot(e), result = e.submit_action(actor, action);
  active.operations.push({kind: 'action', actor, action, generatedCandidate: witness, status: result.status, beforeSha256: digest(before), afterSha256: digest(snapshot(e))});
  if (reject) {
    active.rejection = {before: JSON.parse(before), after: JSON.parse(snapshot(e)), result};
    assert.equal(result.status, 'rejected');
    active.rejectionDifferences = differences(active.rejection.before,active.rejection.after);
    assert.deepEqual(active.rejectionDifferences, [], 'rejection must leave the entire exported save unchanged');
  } else {
    assert.equal(result.status, 'applied');
    active.events.push(...(result.result?.events || []));
  }
  return result;
}
function chooseOpportunity(o, choices, actor = 0) {
  const response = o.type === 'choose' ? {type: 'choose', data: {choiceId: choices[0].id}} : {type: o.type, data: {choiceIds: choices.map(c => c.id)}};
  assert(['choose', 'select', 'sequence'].includes(o.type), 'fixture must explicitly support the offered schema');
  const submission = interactionSubmission({interactionId: o.interactionId, response});
  const result = e.submit_interaction_js(actor, submission);
  active.operations.push({kind: 'interaction', actor, submission, status: result.status});
  assert.equal(result.status, 'applied');
  active.events.push(...(result.result?.events || []));
}
function activate(id) {
  const {interaction} = observe('activation available');
  const opportunity = interaction.opportunities.find(o => o.type === 'choose' && o.choices.some(c => hasAction(c, 'activateAbility') && hasObject(c, id)));
  assert(opportunity, 'engine-authored activation must be reachable');
  const choice = opportunity.choices.find(c => hasAction(c, 'activateAbility') && hasObject(c, id) && !c.surfaces.some(s => s.type === 'value' && s.role === 'paymentMode' && s.value === 'manual'));
  assert(choice); chooseOpportunity(opportunity, [choice]);
}
function cast(id) {
  const action = e.get_legal_actions_for_viewer_js(0).actions.find(a => a.type === 'CastSpell' && a.data.object_id === id && a.data.payment_mode?.type === 'Auto');
  assert(action, 'automatic cast candidate required'); submit(0, action);
}
function targets(ids) {
  for (let n = 0; n < 8 && state(e).waiting_for.type === 'TargetSelection'; n++) {
    const {interaction} = observe('target selection');
    const o = interaction.opportunities.find(o => o.choices.some(c => c.available && ids.some(id => hasObject(c, id))));
    assert(o, 'intended targets must be offered');
    const matching = o.choices.filter(c => c.available && ids.some(id => hasObject(c, id)));
    chooseOpportunity(o, matching.slice(0, o.type === 'choose' ? 1 : o.max));
  }
  assert.notEqual(state(e).waiting_for.type, 'TargetSelection', 'bounded target sequence must complete');
}
function resolveStack() {
  for (let n = 0; n < 16 && state(e).stack.length; n++) {
    assert.equal(state(e).waiting_for.type, 'Priority', 'unhandled required choice must not be passed');
    const actor = state(e).waiting_for.data.player;
    const pass = e.get_legal_actions_for_viewer_js(actor).actions.find(a => a.type === 'PassPriority');
    assert(pass); submit(actor, pass);
  }
  assert.equal(state(e).stack.length, 0, 'bounded stack resolution must complete');
}
async function run(id, title, expected, body) {
  if (requested.size && !requested.has(id)) return;
  active = {id, title, buildCommit: provenance.appBaseCommit, taskBase, status: 'NOT TESTED', expected, operations: [], events: [], observations: []};
  try { active.actual = await body(); active.status = 'PASS'; }
  catch (error) { active.actual = {error: error.message.slice(0,3000)}; active.status = 'FAIL'; active.error = String(error.stack).slice(0,5000); }
  if (active.startingState) { active.finalState = JSON.parse(snapshot(e)); active.finalStateSha256 = digest(exact(active.finalState)); }
  await writeFile(resolve(output, id + '.json'), JSON.stringify(active, null, 2) + '\n');
  report.cases.push({id, title, status: active.status, expected, actual: active.actual, evidence: id + '.json'});
  console.log(active.status + ' ' + id);
}

for (const d of decks) {
  assert.equal(d.format, 'Commander'); assert.equal(d.cards.reduce((n,c) => n+c.qty,0),100);
  assert.equal(digest(d.source.deckBlock),d.source.deckBlockSha256,'published block must match recorded hash');
  const parsedRows=d.source.deckBlock.trim().split('\n').map(s=>s.trim()).filter(Boolean).map(line=>{
    const stripped=line.replace(/\s+\[[^\]]+\]$/,''); const m=stripped.match(/^(?:(\d+)\s+)?(.+)$/);
    return {name:m[2],qty:Number(m[1]||1)};
  });
  assert.deepEqual(d.cards,parsedRows,'exact published quantities and names must be retained');
  const canonical = d.cards.map(c => ({name: c.name, qty: c.qty}));
  const covered = new Set(PRACTICE_COVERAGE.testedCardNames.map(n => n.toLowerCase()));
  const rows = d.cards.map(c => {
    const record = catalog[c.name.toLowerCase()];
    return {...c, compiledRecord: !!record, explicitUnimplemented: !!record && exact(record).includes('Unimplemented'), admittedByCoverage: covered.has(c.name.toLowerCase()), compiledRecordSha256: record ? digest(exact(record)) : null};
  });
  report.decks.push({id:d.id, name:d.name, commander:d.commander, source:d.source.url, sourceHtmlSha256:d.source.htmlSha256, revisionSha256:digest(exact({format:d.format, commander:d.commander, cards:canonical, side:d.side})), total:100, uniqueNames:rows.length, rows, missingCompiled:rows.filter(c=>!c.compiledRecord).map(c=>c.name), coverageExcluded:rows.filter(c=>!c.admittedByCoverage).map(c=>c.name), fullMatch:{status:'UNSUPPORTED',reason:'Exact deck has missing compiled definitions and fails existing admission; no substitutions or stub records.'}, currentPickerAvailability:'NOT TESTED', liveCatalogLegality:'NOT TESTED'});
}

for (const reverse of [false, true]) await run('admission-' + (reverse ? 'swapped' : 'original'), 'Both exact precons are rejected before play', 'Both-seat admission blocks unsupported exact lists without modifying either input.', () => {
  const ordered = reverse ? [...decks].reverse() : decks;
  const input = prepareMatchInput({player:ordered[0], opponent:ordered[1], format:'Commander', difficulty:'Medium', runtimeIdentity:provenance.wasmSha256});
  const before = exact(input); active.startingInput = input;
  for (const seat of ['player','opponent']) { assert.equal(input.engineLists[seat].main_deck.length,99); assert.equal(input.engineLists[seat].commander.length,1); }
  const result = evaluateMatchAdmission(e,input,PRACTICE_COVERAGE);
  active.operations.push({kind:'evaluateMatchAdmission',format:'Commander',playerCount:2});
  assert.equal(result.admitted,false);
  for (const seat of ['player','opponent']) { assert.equal(result.seats[seat].admitted,false); assert(result.seats[seat].unsupported.length > 0); }
  assert.equal(exact(input),before,'admission must not change lists');
  return {deckOrder:ordered.map(d=>d.name), admission:result, inputUnchanged:true};
});

await run('empty-hand-mana-ability','Empty hand retains a Sol Ring activation','An engine-authored mana ability remains available despite a legacy pass-only action list; it produces two colorless mana.', () => {
  const {ring} = fixture({own:['Sol Ring'],placements:[['ring','Sol Ring',0,'Battlefield']]});
  assert.equal(state(e).players[0].hand.length,0);
  const {packet,interaction} = observe('empty hand priority');
  assert(packet.legalActionsByObject[ring].some(a=>a.type==='ActivateAbility'));
  assert(interaction.opportunities.some(o=>o.choices.some(c=>hasAction(c,'activateAbility')&&hasObject(c,ring))));
  activate(ring); const s=state(e),pool=s.players[0].mana_pool;
  assert.equal(s.objects[ring].tapped,true); assert.equal(pool.mana.length,2); assert(pool.mana.every(m=>m.color==='Colorless')); assert.equal(s.stack.length,0);
  return {legacyActionTypes:packet.actions.map(a=>a.type),legacyAutoPassRecommended:packet.autoPassRecommended,interactionAutoPassRecommended:packet.viewerInteraction.autoPassRecommended,source:ring,mana:pool,sessionPolicy:'NOT TESTED; mana-only window remains a conservative stop'};
});

for (const creature of [true,false]) await run('ooze-' + (creature ? 'creature' : 'noncreature'), 'Empty-hand activation targets ' + (creature?'creature':'land') + ' in a graveyard', 'Legal graveyard target is exiled; counter and life gain occur only for a creature card.', () => {
  const targetName=creature?'Pugnacious Hammerskull':'Forest';
  const {ooze,target}=fixture({own:['Scavenging Ooze'],opponent:creature?[targetName]:[],activeSeat:1,placements:[['ooze','Scavenging Ooze',0,'Battlefield'],['mana','Forest',0,'Battlefield'],['target',targetName,1,'Graveyard']]});
  assert.equal(state(e).players[0].hand.length,0);
  const {packet}=observe('empty hand nonmana response'); assert(packet.actions.some(a=>a.type==='ActivateAbility'&&a.data.source_id===ooze));
  activate(ooze); targets([target]); active.stackBeforeResolution=state(e).stack; resolveStack();
  const s=state(e); active.observedOutcome={targetZone:s.objects[target].zone,life:s.players[0].life,counters:s.objects[ooze].counters};
  assert.equal(s.objects[target].zone,'Exile'); assert.equal(s.players[0].life,creature?21:20); assert.equal(s.objects[ooze].counters.P1P1||0,creature?1:0);
  return {...active.observedOutcome,actingSeat:0,activeSeat:1,source:ooze,target};
});

await run('giada-angel-payment','Restricted mana pays for an Angel spell','Giada mana plus two Plains casts Righteous Valkyrie; it enters with one additional +1/+1 counter.', () => {
  const {giada,angel}=fixture({land:'Plains',own:['Giada, Font of Hope','Righteous Valkyrie'],placements:[['giada','Giada, Font of Hope',0,'Battlefield'],['lands','Plains',0,'Battlefield',2],['angel','Righteous Valkyrie',0,'Hand']]});
  activate(giada); active.manaBeforeCast=state(e).players[0].mana_pool;
  assert.equal(active.manaBeforeCast.mana.length,1); cast(angel); resolveStack();
  const s=state(e); active.observedOutcome={zone:s.objects[angel].zone,counters:s.objects[angel].counters,power:s.objects[angel].power,toughness:s.objects[angel].toughness,mana:s.players[0].mana_pool};
  assert.equal(s.objects[angel].zone,'Battlefield'); assert.equal(s.objects[angel].counters.P1P1,1); assert.equal(s.objects[angel].power,3); assert.equal(s.objects[angel].toughness,5); assert.equal(s.players[0].mana_pool.mana.length,0);
  return active.observedOutcome;
});

await run('giada-forbidden-payment','Restricted Angel mana cannot pay for Sol Ring','Non-Angel spell is rejected with its card and restricted mana unchanged.', () => {
  const {giada,ring}=fixture({land:'Plains',own:['Giada, Font of Hope','Sol Ring'],placements:[['giada','Giada, Font of Hope',0,'Battlefield'],['ring','Sol Ring',0,'Hand']]});
  activate(giada); const {packet}=observe('restricted mana with artifact');
  active.automaticCandidates=packet.actions.filter(a=>a.type==='CastSpell'&&a.data.object_id===ring&&a.data.payment_mode?.type==='Auto');
  const action={type:'CastSpell',data:{object_id:ring,card_id:ring,targets:[],payment_mode:{type:'Auto'}}};
  submit(0,action,{reject:true}); assert.equal(state(e).objects[ring].zone,'Hand'); assert.equal(state(e).players[0].mana_pool.mana.length,1);
  return {status:'rejected',stateUnchanged:true,automaticCandidateCount:active.automaticCandidates.length,mana:state(e).players[0].mana_pool};
});

for (const affordable of [false,true]) await run('ram-through-' + (affordable?'paid':'wrong-color'), 'Opponent-turn instant with ' + (affordable?'legal payment':'wrong colors'), affordable?'Two-target instant resolves through real priority; Ghalta deals lethal 6 to the Hammerskull and 6 excess to its controller.':'White mana cannot pay {1}{G}; automatic submission rejects without mutation.', () => {
  const {source,target,spell}=fixture({land:affordable?'Forest':'Plains',own:['Ghalta, Primal Hunger','Ram Through'],opponent:['Pugnacious Hammerskull'],activeSeat:1,placements:[['source','Ghalta, Primal Hunger',0,'Battlefield'],['target','Pugnacious Hammerskull',1,'Battlefield'],['spell','Ram Through',0,'Hand'],['lands',affordable?'Forest':'Plains',0,'Battlefield',2]]});
  const {packet}=observe('instant response availability');
  active.automaticCandidates=packet.actions.filter(a=>a.type==='CastSpell'&&a.data.object_id===spell&&a.data.payment_mode?.type==='Auto');
  if(!affordable){ submit(0,{type:'CastSpell',data:{object_id:spell,card_id:spell,targets:[],payment_mode:{type:'Auto'}}},{reject:true}); return {rejected:true,stateUnchanged:true,automaticCandidateCount:active.automaticCandidates.length}; }
  cast(spell); targets([source,target]); active.stackBeforeResolution=state(e).stack;
  const item=state(e).stack.find(x=>x.id===spell); assert(item);
  assert.deepEqual(item.kind.data.ability.targets,[{Object:source}]);
  assert.deepEqual(item.kind.data.ability.sub_ability.targets,[{Object:target}]);
  resolveStack(); const s=state(e); active.observedOutcome={spellZone:s.objects[spell].zone,targetZone:s.objects[target].zone,opponentLife:s.players[1].life,sourceZone:s.objects[source].zone};
  assert.equal(s.objects[spell].zone,'Graveyard'); assert.equal(s.objects[target].zone,'Graveyard'); assert.equal(s.players[1].life,14); assert.equal(s.objects[source].zone,'Battlefield');
  return {...active.observedOutcome,automaticCandidateCount:active.automaticCandidates.length};
});

report.partial=requested.size>0;
if(report.partial)assert.deepEqual([...requested].sort(),report.cases.map(c=>c.id).sort(),'unknown requested case');
else assert.equal(report.cases.length,9,'complete suite must execute nine cases');
report.counts=Object.fromEntries(['PASS','FAIL','NOT TESTED','UNSUPPORTED'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
report.sourceSha256=Object.fromEntries(await Promise.all(['deck-execution-audit.mjs','acceptance-inputs.mjs','mechanics-fixtures.mjs','mechanics-inputs.mjs','runtime-assets.mjs','interaction-surface.mjs','match-input.mjs','practice-coverage.mjs','catalog-admission.mjs',...fixturePaths].map(async n=>[n,digest(await readFile(new URL(n,import.meta.url)))])));
report.finishedAt=new Date().toISOString();
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts)); if(report.counts.FAIL)process.exitCode=1;
