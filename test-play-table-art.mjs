import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glyphFor, manaColors, surfaceColors, frameTone } from './play-token-art.js';
import { tokenColors } from './experiments/forge-proof/forge-session.mjs';
import { battlefieldPiles } from './experiments/phase-engine/match-table.mjs';
import { nativeActionLabel, nativePromptUnanswerable, mountNativePanel, orderRemainder } from './experiments/forge-proof/native-panel.mjs';

test('token crests follow the type line, most specific kind first', () => {
  assert.equal(glyphFor('Token Artifact — Treasure'), 'gem');
  assert.equal(glyphFor('Token Creature — Zombie Soldier'), 'skull');
  assert.equal(glyphFor('Token Creature — Soldier'), 'shield');
  assert.equal(glyphFor('Token Creature — Saproling'), 'leaf');
  assert.equal(glyphFor('Creature — Elf Archer'), 'leaf');
  assert.equal(glyphFor('Token Creature — Thopter'), 'wing');
  assert.equal(glyphFor('Creature — Horse'), 'sword');
  assert.equal(glyphFor('Basic Land — Forest'), 'peak');
  assert.equal(glyphFor(''), 'spark');
  assert.equal(glyphFor(undefined), 'spark');
});

test('frame colors come from the printing, then the token, then the mana cost', () => {
  assert.deepEqual(manaColors('{1}{R}{W}'), ['W', 'R']);
  assert.deepEqual(manaColors('{G/U}{G}'), ['U', 'G']);
  assert.deepEqual(manaColors('{3}'), []);
  assert.deepEqual(surfaceColors({ manaCost: '{R}' }, { type_line: 'Creature — Human', colors: ['W'] }), ['W']);
  assert.deepEqual(surfaceColors({}, { type_line: 'Land', colors: [], color_identity: ['R', 'W'] }), ['W', 'R']);
  assert.deepEqual(surfaceColors({ tokenColors: ['G'] }, null), ['G']);
  assert.deepEqual(surfaceColors({ manaCost: '{1}{G}' }, null), ['G']);
  assert.deepEqual(surfaceColors({ manaCost: '{2}' }, null), []);
  assert.equal(surfaceColors({}, null), null);
  assert.equal(frameTone(null), null);
  assert.equal(frameTone([]).key, 'C');
  assert.equal(frameTone(['W', 'U', 'B']).key, 'M');
  assert.deepEqual(frameTone(['W', 'R']), { key: 'WR', a: '#efe3bd', b: '#d6503a' });
});

test("a token's colors are read from Forge's image key only when it names them", () => {
  assert.deepEqual(tokenColors('t:w_1_1_soldier'), ['W']);
  assert.deepEqual(tokenColors('t:c_a_treasure_sac'), []);
  assert.deepEqual(tokenColors('t:wb_1_1_spirit_flying'), ['W', 'B']);
  assert.equal(tokenColors('MOM/123'), null);
  assert.equal(tokenColors(undefined), null);
});

test('identical permanents share a pile; any visible difference splits one out', () => {
  const soldier = id => ({ id, known: true, name: 'Soldier', controller: 1, isToken: true, tapped: false, power: 1, toughness: 1, type: 'Token Creature — Soldier' });
  const cards = [soldier(1), soldier(2), { ...soldier(3), tapped: true }, soldier(4), { ...soldier(5), counters: { P1P1: 1 } }, { id: 6, known: false }, { id: 7, known: false }];
  assert.deepEqual(battlefieldPiles(cards).map(pile => pile.map(c => c.id)), [[1, 2, 4], [3], [5], [6], [7]]);
});

test("Forge's generic buttons are named for what they do; other labels stay verbatim", () => {
  const n = (extra = {}) => ({ viewer: 1, activePlayer: 1, phase: 'MAIN1', inputType: 'InputPassPriority', stack: [], players: [{ id: 1, zones: { Battlefield: { cards: [{ attacking: true }, { attacking: true }, { blocking: true }] } } }], ...extra });
  assert.equal(nativeActionLabel(n(), 'ok', 'OK'), 'Next: Combat');
  assert.equal(nativeActionLabel(n(), 'cancel', 'End Turn'), 'End turn');
  assert.equal(nativeActionLabel(n({ stack: [{}] }), 'ok', 'OK'), 'Pass · let it resolve');
  assert.equal(nativeActionLabel(n({ activePlayer: 2 }), 'ok', 'OK'), 'Pass');
  assert.equal(nativeActionLabel(n({ inputType: 'InputAttack' }), 'ok', 'OK'), 'Attack with 2');
  assert.equal(nativeActionLabel(n({ inputType: 'InputBlock' }), 'ok', 'OK'), 'Confirm 1 block');
  assert.equal(nativeActionLabel(n({ inputType: 'InputPayManaOfCostPayment' }), 'ok', 'Auto'), 'Pay automatically');
  assert.equal(nativeActionLabel(n({ inputType: 'InputSelectTargets' }), 'ok', 'OK'), 'Confirm targets');
  assert.equal(nativeActionLabel(n({ inputType: 'InputConfirmMulligan' }), 'ok', 'Keep'), 'Keep');
});

// Concede stays available exactly when the native panel can offer no reply.
{
 const card = (id, hidden = false) => ({ value: { kind: 'card', id, hidden, ...(hidden ? {} : { name: 'Card ' + id }) }, index: id });
 const stuck = [
  { method: 'assignCombatDamage', supported: false },
  { method: 'order', supported: true },
  { method: 'order', supported: true, ordered: false },
  { method: 'order', supported: false, ordered: true },
  { method: 'chooseSingleEntityForEffect', supported: true, min: 1, max: 1, options: [card(1, true), card(2, true)] },
  { method: 'chooseColor', supported: true },
 ];
 const answerable = [
  null,
  { method: 'confirm', supported: true, options: [{ value: 'Yes' }, { value: 'No' }] },
  { method: 'showInputDialog', supported: true },
  { method: 'getChoices', supported: true, acknowledgeOnly: true },
  { method: 'order', supported: true, ordered: true, min: 0, options: [card(1)] },
  { method: 'chooseSingleEntityForEffect', supported: true, min: 1, max: 1, options: [card(1, true), card(2)] },
  { method: 'chooseEntitiesForEffect', supported: true, min: 0, max: 2, options: [card(1, true)] },
 ];
 for (const p of stuck) assert.equal(nativePromptUnanswerable(p), true, JSON.stringify(p));
 for (const p of answerable) assert.equal(nativePromptUnanswerable(p), false, JSON.stringify(p));
 console.log('PASS: Concede opens only for native prompts the panel cannot answer.');
}
test('a highlighted card the table does not draw (flashback, cards playable from exile) can still be picked', () => {
  class El {
    constructor(tag) { Object.assign(this, { tagName: tag, childNodes: [], dataset: {}, attributes: {}, events: {}, textContent: '' }); }
    append(...nodes) { this.childNodes.push(...nodes); }
    replaceChildren(...nodes) { this.childNodes = nodes; }
    setAttribute(k, v) { this.attributes[k] = v; }
    addEventListener(type, fn) { this.events[type] = fn; }
  }
  const all = node => [node, ...node.childNodes.flatMap(all)];
  const drawn = [5, 7].map(id => ({ dataset: { instance: String(id) } }));
  const table = { querySelectorAll: sel => (sel === '.play-match-card[data-instance]' ? drawn : []) };
  const container = new El('footer');
  Object.assign(container, { ownerDocument: { createElement: tag => new El(tag) }, closest: sel => (sel === '.play-match-table' ? table : null) });
  const calls = [], session = { nativeSelect: (...args) => calls.push(args), nativeButton() {} };
  const card = (id, name, zone) => ({ id, known: true, name, zone });
  const ref = (kind, id) => ({ kind, id });
  const snapshot = { busy: false, status: { surface: { cards: [card(5, 'Mountain', 'Battlefield'), card(7, 'Opt', 'Hand'), card(116, 'Shock', 'Graveyard'), { id: 120, known: false, zone: 'Exile' }] } },
    native: { revision: 8, viewer: 1, activePlayer: 1, priorityPlayer: 1, turn: 3, phase: 'MAIN1', inputType: 'InputPassPriority', message: 'Cast spells or pass', stack: [], players: [{ id: 1, name: 'You' }, { id: 2, name: 'CPU' }], buttons: { ok: 'OK', okEnabled: true },
      selection: { cards: [], targets: [ref('player', 2)], chosen: [], actionable: [ref('card', 5), ref('card', 7), ref('card', 116), ref('card', 120)] } } };
  mountNativePanel(container, { session, snapshot, presentation: { hosted: true } });
  const nodes = all(container), picks = nodes.filter(e => e.dataset.nativeKey?.startsWith('ref-'));
  assert.deepEqual(picks.map(e => e.textContent), ['Shock · Graveyard', 'Face-down card · Exile']);
  picks[0].events.click();
  assert.deepEqual(calls, [['card', 116, 8]]);
  drawn.push({ dataset: { instance: '116' } }, { dataset: { instance: '120' } });
  mountNativePanel(container, { session, snapshot, presentation: { hosted: true } });
  assert.equal(all(container).some(e => e.dataset.nativeKey?.startsWith('ref-') || e.textContent === 'In other zones'), false);
});

test('combat and target arrows are redrawn when a lane under them scrolls', () => {
  const src = readFileSync(new URL('./experiments/forge-proof/forge-table.mjs', import.meta.url), 'utf8');
  const handler = src.match(/const reflow=\(\)=>\{([^\n]*?)\};/)?.[1];
  assert.match(handler, /\bqueueArrows\(\)/, 'arrows sit in a fixed overlay drawn from viewport positions');
  assert.match(src, /root\.addEventListener\('scroll',reflow,true\)/);
  assert.match(src, /root\.removeEventListener\('scroll',reflow,true\)/);
});

test('reduced motion keeps the turn banner hidden, since only its animation fades it out', () => {
  const css = readFileSync('play-forge-table.css', 'utf8');
  const shown = css.match(/^([^{}\n]*\.play-match-turn-banner)\{[^}]*display:flex[^}]*animation:forge-turn-banner/m);
  assert.ok(shown, 'the Forge table shows the turn banner and fades it with forge-turn-banner');
  assert.ok(css.indexOf(`@media (prefers-reduced-motion:reduce){${shown[1]}{display:none}}`) > shown.index);
});

test('order prompts never show an unbounded side as -1', () => {
  assert.equal(orderRemainder({ remainingMin: -1, remainingMax: -1 }), '');
  assert.equal(orderRemainder({ remainingMin: 2, remainingMax: 2 }), ' Leave 2 in the source.');
  assert.equal(orderRemainder({ remainingMin: 0, remainingMax: 3 }), ' Leave 0–3 in the source.');
  assert.equal(orderRemainder({ remainingMin: 1, remainingMax: -1 }), ' Leave at least 1 in the source.');
  assert.equal(orderRemainder({ remainingMin: -1, remainingMax: 2 }), ' Leave 0–2 in the source.');
});
test('your hand is shown lands first, then spells by mana value, without changing any card',async()=>{
 const {manaValue,arenaHandOrder}=await import('./experiments/forge-proof/forge-session.mjs');
 assert.deepEqual(['{2}{R}{R}','{X}{G}','{2/W}{U}','{W/P}','','{G/U}{G/U}'].map(manaValue),[4,1,3,1,0,2]);
 const hand=[{id:1,known:true,types:['Instant'],manaCost:'{R}'},{id:2,known:true,types:['Land'],manaCost:''},{id:3,known:true,types:['Creature'],manaCost:'{3}{G}'},{id:4,known:true,types:['Creature'],manaCost:'{G}'},{id:5,known:true,types:['Land'],manaCost:''},{id:6,known:false}];
 const before=structuredClone(hand);
 assert.deepEqual(arenaHandOrder(hand).map(c=>c.id),[2,5,1,4,3,6],'lands keep their order, equal mana values keep Forge order, unknown cards go last');
 assert.deepEqual(hand,before,'the snapshot cards are not changed');
});

test('prompts speak plainly: payment names the cost, card and ability, never engine names or ids', async () => {
  const { nativePayment, plainText } = await import('./experiments/forge-proof/native-panel.mjs');
  const { nativeDecisionKind } = await import('./experiments/forge-proof/forge-session.mjs');
  const food = { id: 204, known: true, zone: 'Battlefield', name: 'Food', text: '{2}, {T}, Sacrifice this token: You gain 3 life.' };
  const n = { viewer: 1, inputType: 'InputPayManaOfCostPayment', message: 'Food Token (204) - {2}, {T}, Sacrifice this token: You gain 3 life.\nPay Mana Cost: {2}', payment: { remaining: '{2}', forCard: { kind: 'card', id: 204, name: 'Food Token' } }, players: [{ id: 1, mana: { R: 0 } }], selection: { actionable: [] } };
  const p = nativePayment(n, [food]);
  assert.equal(p.remaining, '{2}');
  assert.equal(`${p.verb} ${p.name}`, 'Activate Food');
  assert.equal(p.ability, food.text);
  assert.equal(p.stuck, true, 'no mana to tap is said plainly');
  assert.equal(nativePayment({ ...n, payment: undefined }, []).remaining, '{2}', 'older bridges: the cost is read from the message');
  assert.equal(plainText('Food Token (204) - sacrifice'), 'Food Token - sacrifice');
  assert.equal(nativeDecisionKind({ inputType: 'InputPayManaOfCostPayment' }), 'ManaPayment');
  assert.equal(nativeDecisionKind({ inputType: 'InputSelectEntitiesFromList' }), 'Choice');
  assert.equal(nativeDecisionKind({ inputType: 'InputSomethingNew' }), 'Decision');
  assert.equal(nativeActionLabel({ viewer: 1, activePlayer: 1, phase: 'COMBAT_DECLARE_ATTACKERS', inputType: 'InputPassPriority', stack: [], players: [{ id: 1, zones: { Battlefield: { cards: [] } } }] }, 'ok', 'OK'), 'Next: Second main', 'no blockers step promised without attackers');
});

test('attachments tuck under their host, and differing attachments or combat never share a pile', async () => {
  const { tuckAttachments } = await import('./experiments/phase-engine/match-table.mjs');
  const giant = { id: 1, known: true, name: 'Hill Giant', attachments: [3] }, boots = { id: 3, known: true, name: 'Swiftfoot Boots', attachedTo: 1 }, rancor = { id: 4, known: true, name: 'Rancor', attachedTo: 99 };
  const { loose, tucked } = tuckAttachments([giant, boots, rancor]);
  assert.deepEqual(loose.map(c => c.id), [1, 4], 'a host elsewhere leaves the attachment in place');
  assert.deepEqual(tucked.get(1).map(c => c.id), [3]);
  const bear = id => ({ id, known: true, name: 'Bear', controller: 0, power: 2, toughness: 2, type: 'Creature' });
  assert.equal(battlefieldPiles([bear(1), { ...bear(2), attachments: [9] }]).length, 2);
  assert.equal(battlefieldPiles([{ ...bear(1), attacking: true, attackTarget: { kind: 'player', id: 1 } }, { ...bear(2), attacking: true, attackTarget: { kind: 'card', id: 7 } }]).length, 2);
});

test('a surveil prompt shows the named card, and stack text drops Forge bookkeeping', async () => {
  const { createForgePresentationSession, stackText } = await import('./experiments/forge-proof/forge-session.mjs');
  assert.equal(stackText('surveil 1. Put that card into your hand. [Phase: CardStashy]'), 'surveil 1. Put that card into your hand.');
  const art = { card: { id: 'x', name: 'Liliana the Faultless', image_uris: { normal: 'https://cards.scryfall.io/normal/x.jpg' } } };
  const session = createForgePresentationSession({ request: async () => null, lookupArtwork: name => name === 'Liliana the Faultless' ? art : null });
  const players = [{ id: 1, name: 'You', isViewer: true, life: 20, zones: {} }, { id: 2, name: 'CPU', isViewer: false, life: 20, zones: {} }];
  session.acceptState({ schema: 'cardstashy.forge-proof.v1', revision: 3, viewer: 1, status: 'running', turn: 3, players, stack: [], prompt: { id: 'p', supported: true, method: 'confirm', message: 'Liliana the Faultless\nPut Liliana the Faultless on the top of library or graveyard?', options: [{ index: 0, value: 'Library' }, { index: 1, value: 'Graveyard' }] } });
  assert.equal(session.promptNamedCard().name, 'Liliana the Faultless');
  assert.equal(session.promptNamedCard().printing.playArtwork, art);
});

test('a payment step that opens without a new revision still reaches the table', async () => {
  const { createForgePresentationSession } = await import('./experiments/forge-proof/forge-session.mjs');
  const session = createForgePresentationSession({ request: async () => null });
  const players = [{ id: 1, name: 'You', isViewer: true, life: 20, zones: {} }, { id: 2, name: 'CPU', isViewer: false, life: 20, zones: {} }];
  const base = { schema: 'cardstashy.forge-proof.v1', revision: 5, viewer: 1, status: 'running', turn: 2, players, stack: [] };
  assert.equal(session.acceptState({ ...base, busy: true, inputType: 'InputLockUI' }), true);
  assert.equal(session.acceptState({ ...base, busy: true, inputType: 'InputLockUI' }), false, 'a plain repeat is ignored');
  assert.equal(session.acceptState({ ...base, busy: false, inputType: 'InputPayManaOfCostPayment', buttons: { cancel: 'Cancel', cancelEnabled: true } }), true, 'Forge finished working: the payment with Cancel is shown');
  assert.equal(session.snapshot().native.buttons.cancelEnabled, true);
  assert.equal(session.acceptState({ ...base, revision: 4 }), false, 'older revisions stay ignored');
});

test('divided damage starts from a legal split and sends one number per option', async () => {
  const { assignStart, nativePromptUnanswerable } = await import('./experiments/forge-proof/native-panel.mjs');
  const opt = (i, name) => ({ index: i, value: { kind: 'card', id: 10 + i, hidden: false, name } });
  const trample = { id: 'a', supported: true, method: 'assignCombatDamage', options: [opt(0, 'Bear'), opt(1, 'Elf'), { index: 2, value: { kind: 'player', id: 2, name: 'CPU' } }], assign: { amount: 6, lethal: [2, 1, null], defenderIndex: 2, maySkip: false } };
  assert.equal(nativePromptUnanswerable(trample), false, 'the dock answers it instead of showing only Concede');
  assert.deepEqual(assignStart(trample), [2, 1, 3], 'lethal to each blocker first, the rest tramples over');
  const bolt = { id: 'b', supported: true, method: 'assignGenericAmount', options: [opt(0, 'Bear'), opt(1, 'Elf')], assign: { amount: 3, maxima: [3, 3], atLeastOne: true } };
  assert.deepEqual(assignStart(bolt), [1, 2]);
  assert.equal(nativePromptUnanswerable({ ...bolt, assign: undefined }), true, 'without the division contract it is not guessed');
});
