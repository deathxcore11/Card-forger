// No browser or live provider: lifecycle boundary fake plus canonical response validation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { RULE_VERSIONS, RULE_SOURCES, entryReference, resolveRuleReference } from './rule-reference.js';
import { rulesContext, rulesContextKey, rulesAskPanel, rulesAnswerHtml, validateRulesResponse, openRulesAsk, closeRulesAsk, askRules, restartRulesAsk, clearRulesConversations, syncRulesAskContext, removeRulesCardContext } from './ai-rules.js';
import { rulesFallback } from './ai-rules-route.js';
const packs = Object.fromEntries(['mtg', 'ptcg', 'ygo'].map(game => [game, { ...JSON.parse(gunzipSync(readFileSync(`rulebooks/${game}-rules-v1.json.gz`))), version: RULE_VERSIONS[game], sources: RULE_SOURCES[game] }]));
const context = rulesContext({ game: 'ptcg', format: 'Standard' });
const resolved = resolveRuleReference(packs.ptcg, entryReference('ptcg', '0-p13'));
const id = 'ptcg:0:0-p13', section = text => ({ text, citationIds: [id] });
const answer = { status: 'answered', shortAnswer: section('The starting player skips the attack step.'), explanation: [section('Later turns follow the normal attack rules.')], example: section('For example, going second is a different case.'), details: [], questions: [], citations: [{ id, quote: 'On the first turn of the game, the starting player skips this step.', reference: resolved.reference, title: 'Untrusted title replaced', source: { title: 'Evil', url: 'https://evil.test' } }], limitations: ['Dated sources.'], disclaimer: 'AI interpretation, not an official judge or guaranteed ruling.' };
const data = { context, answer };
const valid = await validateRulesResponse(data, context, { load: async () => packs.ptcg });
assert.equal(valid.citations[0].source, RULE_SOURCES.ptcg[0]); assert.equal(valid.citations[0].title, resolved.entry.title); assert.ok(!JSON.stringify(valid).includes('evil.test'));
for (const mutate of [d => d.context.game = 'mtg', d => d.context.format = 'Expanded', d => d.context.version = 'wrong', d => d.answer.citations[0].reference.game = 'mtg', d => d.answer.citations[0].reference.entryId = '0-p9999', d => d.answer.citations[0].quote = 'Invented quote', d => d.answer.shortAnswer.citationIds = [], d => d.answer.citations[0].id = 'mtg:0:502']) {
  const corrupt = structuredClone(data); mutate(corrupt); await assert.rejects(validateRulesResponse(corrupt, context, { load: async () => packs.ptcg }));
}
assert.throws(() => rulesContext({ game: 'unknown' }));
assert.throws(() => rulesContext({ game: 'ptcg', cards: [{ game: 'mtg', id: 'x', name: 'x', text: 'x', complete: true }] }));
const card = { game: 'ptcg', id: 'one', name: 'Same name', set: 'Set A', number: '1', text: 'Full exact text', complete: true };
for (const other of [ rulesContext({ game: 'ygo' }), rulesContext({ game: 'ptcg', format: 'Expanded' }), rulesContext({ game: 'ptcg', format: 'Standard', cards: [card] }), rulesContext({ game: 'ptcg', format: 'Standard', references: [entryReference('ptcg', '0-p10')] }) ]) assert.notEqual(rulesContextKey(context), rulesContextKey(other));
assert.notEqual(rulesContextKey(rulesContext({ game: 'ptcg', cards: [card] })), rulesContextKey(rulesContext({ game: 'ptcg', cards: [{ ...card, id: 'two' }] })));
assert.notEqual(rulesContextKey(rulesContext({ game: 'ptcg', cards: [card] })), rulesContextKey(rulesContext({ game: 'ptcg', cards: [{ ...card, text: 'Changed exact text' }] })));
const escaped = rulesAnswerHtml({ ...valid, shortAnswer: section('<img src=x onerror=evil()>') }); assert.match(escaped, /&lt;img/); assert.doesNotMatch(escaped, /<img/);
assert.match(rulesAskPanel({ game: 'ptcg' }), /Format not selected/); assert.match(rulesAskPanel({ game: 'mtg', format: 'Modern' }), /Modern/);
assert.match(rulesAskPanel({ game: 'ygo' }), /AI rules guide/);
console.log('PASS: client canonical citation reconstruction, game/format/version isolation, exact printing/text session keys, corrupt metadata/quotes rejected and escaped progressive output.');

let focused = '', transportCalls = 0; const dialogs = [];
class Fake {
  constructor(name = '') { this.name = name; this.children = []; this.nodes = new Map(); this.handlers = {}; this.attrs = {}; this.innerHTML = ''; this.textContent = ''; this.value = ''; this.hidden = false; this.dataset = {}; this.isConnected = true; this.classList = { toggle() {}, add() {}, remove() {} }; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, f) { (this.handlers[k] ||= []).push(f); }
  querySelector(q) { if (q === '[data-rules-pending]' || q === '.ask-empty') return null; if (!this.nodes.has(q)) this.nodes.set(q, new Fake(q)); return this.nodes.get(q); }
  append(n) { this.children.push(n); n.isConnected = true; }
  focus() { focused = this.name; }
  remove() { this.isConnected = false; }
  close() { this.open = false; }
  showModal() { this.open = true; }
}
const trigger = new Fake('launcher');
globalThis.document = { activeElement: trigger, body: { append(node) { node.isConnected = true; dialogs.push(node); } }, createElement: name => new Fake(name) };
const fallbackResponse = ctx => Response.json({ context: ctx, answer: rulesFallback(ctx, 'The retrieved evidence does not establish that specific situation.') });
let finish;
const transport = (url, init) => { transportCalls++; assert.equal(url, '/api/ai/ask'); const body = JSON.parse(init.body); assert.equal(body.mode, 'rules'); assert.ok(!('items' in body)); return new Promise(resolve => { finish = () => resolve(fallbackResponse(body)); }); };
let node = openRulesAsk({ game: 'ptcg', format: 'Standard', trigger, fetcher: transport });
assert.equal(transportCalls, 0); assert.equal(focused, '[data-rules-close]'); assert.match(node.innerHTML, /data-rules-format/); assert.match(node.innerHTML, /Format not selected/);
const first = askRules('A question about attacking'); await new Promise(resolve => setImmediate(resolve)); assert.equal(transportCalls, 1);
await askRules('Duplicate'); assert.equal(transportCalls, 1);
closeRulesAsk(); assert.equal(focused, 'launcher'); assert.equal(node.open, false);
assert.equal(openRulesAsk({ game: 'ptcg', format: 'Standard', trigger, fetcher: transport }), node); assert.equal(transportCalls, 1, 'close/reopen never retries paid call');
finish(); await first; assert.ok(node.querySelector('.rules-ai-log').children.some(n => n.innerHTML.includes('Evidence is limited')));
closeRulesAsk(); openRulesAsk({ game: 'ptcg', format: 'Standard', trigger, fetcher: transport }); assert.equal(transportCalls, 1, 'completed reopen is also free');
const second = askRules('Another question'); await new Promise(resolve => setImmediate(resolve));
const old = node; node = openRulesAsk({ game: 'ygo', format: 'Advanced TCG', trigger, fetcher: transport }); finish(); await second;
assert.ok(!node.querySelector('.rules-ai-log').children.some(n => n.innerHTML.includes('Another question')), 'old game answer never paints in new game');
assert.equal(transportCalls, 2);
syncRulesAskContext({ game: 'mtg', format: 'Modern' }); assert.equal(node.open, false, 'host context changes close an incompatible active guide');
node = openRulesAsk({ game: 'ptcg', format: 'Expanded', trigger, fetcher: transport });
const pending = askRules('Question before New'); await new Promise(resolve => setImmediate(resolve)); const oldNode = node;
node = restartRulesAsk(); finish(); await pending; assert.equal(oldNode.open, false); assert.equal(node.querySelector('.rules-ai-log').children.length, 0, 'new chat discards stale response');
assert.equal(transportCalls, 3, 'new chat itself makes no request');
closeRulesAsk(); node = openRulesAsk({ game: 'mtg', format: 'Commander', trigger, fetcher: () => { transportCalls++; throw Error('Synchronous offline failure'); } });
await askRules('How does priority work?'); assert.equal(node.querySelector('.ask-input').disabled, false, 'sync failure cannot leave a permanent pending promise');
const calls = transportCalls; closeRulesAsk(); openRulesAsk({ game: 'mtg', format: 'Commander', trigger }); assert.equal(transportCalls, calls, 'error reopen never retries');
clearRulesConversations();
let historyBodies = [];
const clarifyTransport = async (url, init) => { const body = JSON.parse(init.body); historyBodies.push(body); return Response.json({ context: body, answer: rulesFallback(body, 'Need more context.', ['Whose turn is it?']) }); };
node = openRulesAsk({ game: 'ptcg', format: 'Standard', trigger, fetcher: clarifyTransport });
await askRules('Can I attack on my first turn?'); await askRules('I am going second.');
assert.deepEqual(historyBodies[1].priorQuestions, ['Can I attack on my first turn?']); assert.equal(historyBodies[1].question, 'I am going second.'); assert.ok(!JSON.stringify(historyBodies).includes('Whose turn'));
await askRules('No effects are active.'); await askRules('It is my turn.'); const bounded = historyBodies.length;
await askRules('Another detail'); assert.equal(historyBodies.length, bounded, 'scenario limit asks for restatement rather than truncation or more spending');
node = openRulesAsk({ game: 'ptcg', format: 'Expanded', trigger, fetcher: clarifyTransport }); await askRules('Can I attack?'); assert.ok(!historyBodies.at(-1).priorQuestions, 'new format has no prior user scenario');
node = openRulesAsk({ game: 'ptcg', format: 'Standard', cards: [{ ...card, complete: false }], references: [entryReference('ptcg', '0-p10')], trigger, fetcher: clarifyTransport });
assert.match(node.querySelector('.rules-ai-log').innerHTML, /Ask without selected card/);
await askRules('Does this work?'); assert.ok(node.querySelector('.rules-ai-log').children.some(n => n.innerHTML.includes('data-rules-drop-cards')), 'remove action remains available after clarification');
node = removeRulesCardContext(); assert.equal(node.querySelector('.rules-ai-log').children.length, 0, 'removal starts a clean general-rules session'); await askRules('How does drawing work?'); assert.deepEqual(historyBodies.at(-1).cards, []); assert.deepEqual(historyBodies.at(-1).references, []); assert.ok(!historyBodies.at(-1).priorQuestions);
clearRulesConversations();
for (const [game, firstFormat, secondFormat] of [['mtg', 'Commander', 'Modern'], ['ptcg', 'Standard', 'Expanded'], ['ygo', 'Advanced TCG', 'Traditional TCG']]) {
  const posted = [];
  const fetcher = async (_url, init) => { const body = JSON.parse(init.body); posted.push(body); return fallbackResponse(body); };
  const firstNode = openRulesAsk({ game, format: firstFormat, trigger, fetcher });
  await askRules('Explain the draw step.');
  const savedRows = [...firstNode.querySelector('.rules-ai-log').children];
  const firstSelect = firstNode.querySelector('[data-rules-format]');
  firstSelect.matches = q => q === '[data-rules-format]';
  firstSelect.value = secondFormat; // A native change mutates the old session DOM first.
  firstNode.handlers.change[0]({ target: firstSelect });
  const secondNode = dialogs.at(-1), secondSelect = secondNode.querySelector('[data-rules-format]');
  // The fake DOM does not parse selected <option> markup on new shells.
  // Model the native selected value before the second real change event.
  secondSelect.value = secondFormat;
  secondSelect.matches = q => q === '[data-rules-format]';
  secondSelect.value = firstFormat;
  secondNode.handlers.change[0]({ target: secondSelect });
  assert.equal(dialogs.at(-1), firstNode, 'Returning restores the same cached answer session');
  assert.equal(firstSelect.value, firstFormat, 'Visible format must match restored answer and request context');
  assert.deepEqual(firstNode.querySelector('.rules-ai-log').children, savedRows);
  assert.equal(posted.length, 1, 'Format switching and answer restoration never submit');
  await askRules('What happens next?');
  assert.equal(posted.at(-1).format, firstFormat);
  firstSelect.value = secondFormat;
  assert.equal(openRulesAsk({ game, format: firstFormat, trigger, fetcher }), firstNode);
  assert.equal(firstSelect.value, firstFormat, 'Same-session opening also repairs stale native selection');
  clearRulesConversations();
}
console.log('PASS: cached all-game format controls, answer sessions and explicit request context stay aligned without automatic calls.');
console.log('PASS: bounded user-only clarification continuity, no prior model answers, fresh context isolation, explicit incomplete-card removal and no silent truncation.');
console.log('PASS: zero calls on open, double-submit guard, pending/completed/error reopen, context changes, New chat stale suppression, synchronous failure recovery, close focus and no automatic retries.');
const source = readFileSync('ai-rules.js', 'utf8');
assert.match(source, /openRuleReference\(session.root, reference, \{ trigger: citation \}\)/); assert.match(source, /session.input.value = example.dataset.rulesExample/); assert.doesNotMatch(source, /askRules\(example.dataset/);
assert.match(source, /await Promise.resolve\(\)/); assert.doesNotMatch(source, /makeAskTools|card_details|my_collection|build_deck/);
console.log('PASS: examples only prefill, source actions use the canonical popup with citation focus, and Rules never reuses generic Search app tools.');

for (const game of ['mtg', 'ptcg', 'ygo']) {
 clearRulesConversations(); const before = transportCalls;
 const empty = openRulesAsk({ game, trigger, fetcher: () => { transportCalls++; throw Error('Must not request without a format'); } });
 const input = empty.querySelector('.ask-input'); input.value = 'Can I attack on the first turn?';
 assert(empty.querySelector('.ask-send').disabled);
 await askRules(input.value);
 assert.equal(transportCalls, before, 'Missing format cannot spend a request');
 assert.equal(input.value, 'Can I attack on the first turn?', 'Missing prerequisite preserves typed draft');
 assert.equal(focused, '[data-rules-format]');
 assert.match(empty.innerHTML, /Choose a format before asking/);
 const selector = empty.querySelector('[data-rules-format]'); selector.matches = q => q === '[data-rules-format]'; selector.value = game === 'mtg' ? 'Commander' : game === 'ptcg' ? 'Standard' : 'Advanced (TCG)';
 empty.handlers.change[0]({target:selector});
 const chosen = dialogs.at(-1); assert(!chosen.querySelector('.ask-send').disabled);
 assert.equal(chosen.querySelector('.ask-input').value, input.value);
 assert.equal(transportCalls, before, 'Choosing the prerequisite never auto-submits');
}
clearRulesConversations();
console.log('PASS: visible all-game format prerequisite, no guessed default, draft preservation, no request on missing format or selection, and enabled explicit submit after selection.');
