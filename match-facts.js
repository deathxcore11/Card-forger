// What one match showed the player, for achievements and Story deeds (story-deeds.js, play-achievements.js).
// Fed the table's Forge surface on every update, it keeps only what the viewer could see: the board,
// graveyards, exile, life, poison and hand/library counts. Nothing here reads hidden information.
// The same tracker runs in the app (every mode) and in the Story sims (scripts/story/sim/deed-facts.mjs),
// so a deed is measured in Forge self-play exactly as the app will judge it.
//
// Turns: Forge numbers every player's turn (turn 7 is the first player's 4th turn). Deeds speak in
// the player's own turns, the way people count them, so `myTurns` counts the turns you started.
const num = v => Number.isFinite(v) ? v : null;

export function createMatchFacts() {
  let seat = null, lastTurn = 0, startLife = null, lastMyLife = null, lastOppLife = null, oppTurnStart = null, turnOfStart = -1;
  let lastPile = new Map();
  const pending = new Map();
  const turnOwner = new Map(), field = new Map(), lastFace = new Map();
  const f = {
    turns: 0, myTurns: 0, minLife: null, endLife: null, maxLife: null, lifeGained: 0, startLife: null,
    oppEndLife: null, oppMinLife: null, oppBigTurn: 0, oppPoison: 0, myPoison: 0, oppLibraryMin: null, oppHandMin: null, maxHand: 0,
    maxCreatures: 0, maxTokens: 0, maxLands: 0, maxArtifacts: 0, maxEnchantments: 0, maxPower: 0, maxBoardPower: 0, maxAttackers: 0,
    maxFlyers: 0, maxCounters: 0, maxSuspended: 0, maxFaceDown: 0, maxAttach: 0, maxSlivers: 0, tribes: {},
    oppMaxCreatures: 0, oppWipes: 0, kills: 0, losses: 0, turnedUp: 0, flipped: 0, endCreatures: 0, oppEndCreatures: 0,
    myCards: new Set(), theirCards: new Set(), killed: new Set(), myDead: new Set(),
  };
  const subtypes = c => { const m = /(?:—|\s-\s)\s*(.+)$/.exec(c.type || ''); return m ? m[1].split(/\s+/).filter(Boolean) : []; };
  function update(s) {
    if (!s || !Array.isArray(s.players)) return;
    seat = s.seat ?? seat; if (seat === null) return;
    const turn = s.turn || 0;
    if (turn > lastTurn) lastTurn = turn;
    f.turns = Math.max(f.turns, turn);
    // A turn belongs to the seat the table last showed as active in it (the turn number can tick a moment
    // before the active player does).
    if (turn > 0 && Number.isInteger(s.activeSeat)) turnOwner.set(turn, s.activeSeat);
    f.myTurns = [...turnOwner.values()].filter(x => x === seat).length;
    const me = s.players.find(p => p.seat === seat), opps = s.players.filter(p => p.seat !== seat), opp = opps.length === 1 ? opps[0] : null;
    if (num(me?.life) !== null) {
      if (startLife === null) { startLife = me.life; f.startLife = me.life; }
      if (lastMyLife !== null && me.life > lastMyLife) f.lifeGained += me.life - lastMyLife;
      lastMyLife = me.life; f.endLife = me.life;
      f.minLife = f.minLife === null ? me.life : Math.min(f.minLife, me.life);
      f.maxLife = f.maxLife === null ? me.life : Math.max(f.maxLife, me.life);
    }
    f.myPoison = Math.max(f.myPoison, me?.counters?.POISON | 0);
    if (Number.isSafeInteger(me?.handCount)) f.maxHand = Math.max(f.maxHand, me.handCount);
    if (opp) {
      if (num(opp.life) !== null) {
        // Most life the opponent lost inside one turn (yours or theirs): the big turn.
        if (oppTurnStart === null || turn !== turnOfStart) { turnOfStart = turn; oppTurnStart = lastOppLife ?? opp.life; }
        f.oppBigTurn = Math.max(f.oppBigTurn, oppTurnStart - opp.life);
        lastOppLife = opp.life; f.oppEndLife = opp.life; f.oppMinLife = f.oppMinLife === null ? opp.life : Math.min(f.oppMinLife, opp.life);
      }
      f.oppPoison = Math.max(f.oppPoison, opp.counters?.POISON | 0);
      if (turn >= 1 && Number.isSafeInteger(opp.libraryCount)) f.oppLibraryMin = f.oppLibraryMin === null ? opp.libraryCount : Math.min(f.oppLibraryMin, opp.libraryCount);
      if (Number.isSafeInteger(opp.handCount) && turn >= 3) f.oppHandMin = f.oppHandMin === null ? opp.handCount : Math.min(f.oppHandMin, opp.handCount);
    }
    const cards = Array.isArray(s.cards) ? s.cards : [];
    const bf = cards.filter(c => c.zone === 'Battlefield'), mine = bf.filter(c => c.controller === seat), theirs = bf.filter(c => c.controller !== seat);
    const isCreature = c => c.known === false ? true : c.types?.includes('Creature');
    const myC = mine.filter(c => c.known !== false && c.types?.includes('Creature')), theirC = theirs.filter(isCreature);
    f.maxCreatures = Math.max(f.maxCreatures, mine.filter(isCreature).length);
    f.maxTokens = Math.max(f.maxTokens, mine.filter(c => c.isToken).length);
    f.maxLands = Math.max(f.maxLands, mine.filter(c => c.types?.includes('Land')).length);
    f.maxArtifacts = Math.max(f.maxArtifacts, mine.filter(c => c.types?.includes('Artifact')).length);
    f.maxEnchantments = Math.max(f.maxEnchantments, mine.filter(c => c.types?.includes('Enchantment')).length);
    f.maxPower = Math.max(f.maxPower, ...myC.map(c => num(c.power) ?? 0), 0);
    f.maxBoardPower = Math.max(f.maxBoardPower, myC.reduce((t, c) => t + Math.max(0, num(c.power) ?? 0), 0));
    f.maxAttackers = Math.max(f.maxAttackers, mine.filter(c => c.attacking).length);
    const flies = c => c.flying === true || (Array.isArray(c.keywords) && c.keywords.some(k => /^flying$/i.test(typeof k === 'string' ? k : k?.keyword || k?.text || '')));
    f.maxFlyers = Math.max(f.maxFlyers, myC.filter(flies).length);
    f.maxCounters = Math.max(f.maxCounters, ...mine.map(c => c.counters?.P1P1 | 0), 0);
    f.maxFaceDown = Math.max(f.maxFaceDown, mine.filter(c => c.known === false).length);
    f.maxAttach = Math.max(f.maxAttach, ...myC.map(c => (c.attachments || []).length), 0);
    f.maxSuspended = Math.max(f.maxSuspended, cards.filter(c => c.zone === 'Exile' && c.owner === seat && (c.counters?.TIME | 0) > 0).length);
    const tribe = {};
    for (const c of myC) for (const t of subtypes(c)) tribe[t] = (tribe[t] || 0) + 1;
    for (const [t, n] of Object.entries(tribe)) if (n > (f.tribes[t] || 0)) f.tribes[t] = n;
    f.maxSlivers = Math.max(f.maxSlivers, myC.filter(c => /Sliver/.test(c.type || c.name || '')).length);
    const prevTheirs = [...field.values()].filter(x => x.creature && x.controller !== seat).length;
    if (prevTheirs >= 3 && theirC.length === 0) f.oppWipes++;
    f.oppMaxCreatures = Math.max(f.oppMaxCreatures, theirC.length);
    f.endCreatures = mine.filter(isCreature).length; f.oppEndCreatures = theirC.length;
    for (const c of bf) if (c.known !== false && c.name) (c.controller === seat ? f.myCards : f.theirCards).add(c.name);
    // Creatures that left the battlefield for a graveyard or exile died; tokens just vanish. A card can be
    // in no public zone for an update or two while it moves, so a creature that left waits here until it
    // lands: in a graveyard or exile (by its id, or by name in its owner's pile), back on the field, or
    // in a hand or library (it never shows up again, and is dropped after a while).
    const onField = new Set(bf.map(c => c.id)), byId = new Map(cards.map(c => [c.id, c]));
    const pile = new Map();
    for (const c of cards) if ((c.zone === 'Graveyard' || c.zone === 'Exile') && c.known !== false && c.name) { const k = c.owner + '|' + c.name; pile.set(k, (pile.get(k) || 0) + 1); }
    const grew = new Map([...pile].map(([k, n]) => [k, n - (lastPile.get(k) || 0)]));
    for (const [id, was] of field) if (was.creature && !onField.has(id)) pending.set(id, {...was, age: 0});
    const died = was => { if (was.controller === seat) { f.losses++; if (was.name) f.myDead.add(was.name); } else { f.kills++; if (was.name) f.killed.add(was.name); } };
    for (const [id, was] of pending) {
      const c = byId.get(id), k = was.owner + '|' + was.name;
      if (onField.has(id)) { pending.delete(id); continue; }
      if (was.token) { died(was); pending.delete(id); continue; }
      if (c && (c.zone === 'Graveyard' || c.zone === 'Exile')) { died(was); pending.delete(id); if ((grew.get(k) || 0) > 0) grew.set(k, grew.get(k) - 1); continue; }
      if (!c && was.name && (grew.get(k) || 0) > 0) { died(was); pending.delete(id); grew.set(k, grew.get(k) - 1); continue; }
      if (++was.age > 40) pending.delete(id);
    }
    lastPile = pile;
    // A face-down card turned up, or a card that changed its face in place (flip, transform).
    for (const c of mine) {
      const before = lastFace.get(c.id);
      if (before !== undefined) { if (before === null && c.known !== false) f.turnedUp++; else if (before && c.known !== false && c.name && c.name !== before) f.flipped++; }
    }
    field.clear(); lastFace.clear();
    for (const c of bf) {
      field.set(c.id, {controller: c.controller, owner: c.owner, creature: isCreature(c), token: !!c.isToken, name: c.known === false ? null : c.name || null});
      if (c.controller === seat) lastFace.set(c.id, c.known === false ? null : c.name || '');
    }
  }
  // The facts as plain JSON (sets become sorted lists).
  function snapshot(extra = {}) {
    const list = s => [...s].sort();
    return {...f, myCards: list(f.myCards), theirCards: list(f.theirCards), killed: list(f.killed), myDead: list(f.myDead), tribes: {...f.tribes}, ...extra};
  }
  return {update, snapshot};
}

// --- Conditions -------------------------------------------------------------------------------------
// A deed's test is data, so the app, the server, the native app and the sims all read the same rule:
// {myTurns: ['<=', 6], minLife: ['>=', 10], mine: 'Mirri, Cat Warrior', notTheirs: 'Memnarch', killed: 'Phage the Untouchable'}
// Every key must hold. A fact the match never reported (null) fails its test.
const OPS = {'<=': (a, b) => a <= b, '>=': (a, b) => a >= b, '==': (a, b) => a === b, '<': (a, b) => a < b, '>': (a, b) => a > b};
const has = (list, name) => Array.isArray(list) && list.includes(name);
const any = v => Array.isArray(v) ? v : [v];
export function factsMeet(facts = {}, when = {}) {
  for (const [k, rule] of Object.entries(when || {})) {
    if (k === 'mine') { if (!any(rule).every(n => has(facts.myCards, n))) return false; continue; }
    if (k === 'mineAny') { if (!any(rule).some(n => has(facts.myCards, n))) return false; continue; }
    if (k === 'theirs') { if (!any(rule).every(n => has(facts.theirCards, n))) return false; continue; }
    if (k === 'notTheirs') { if (any(rule).some(n => has(facts.theirCards, n))) return false; continue; }
    if (k === 'notMine') { if (any(rule).some(n => has(facts.myCards, n))) return false; continue; }
    if (k === 'killed') { if (!any(rule).every(n => has(facts.killed, n))) return false; continue; }
    if (k === 'killedAny') { if (!any(rule).some(n => has(facts.killed, n))) return false; continue; }
    if (k === 'survived') { if (any(rule).some(n => has(facts.myDead, n)) || !any(rule).every(n => has(facts.myCards, n))) return false; continue; }
    if (k === 'tribe') { const [t, op, v] = rule; if (!OPS[op]?.((facts.tribes?.[t] | 0), v)) return false; continue; }
    if (k === 'onPlay') { if (facts.onPlay !== rule) return false; continue; }
    const [op, v] = Array.isArray(rule) ? rule : ['==', rule], got = facts[k];
    if (!Number.isFinite(got) || !OPS[op]?.(got, v)) return false;
  }
  return true;
}
// One line a person reads for a condition, for the preview sheet and tests.
export const factKeys = ['turns', 'myTurns', 'minLife', 'endLife', 'maxLife', 'lifeGained', 'oppEndLife', 'oppMinLife', 'oppBigTurn', 'oppPoison', 'oppLibraryMin', 'oppHandMin', 'maxHand',
  'maxCreatures', 'maxTokens', 'maxLands', 'maxArtifacts', 'maxEnchantments', 'maxPower', 'maxBoardPower', 'maxAttackers', 'maxFlyers', 'maxCounters', 'maxSuspended', 'maxFaceDown', 'maxAttach', 'maxSlivers',
  'oppMaxCreatures', 'oppWipes', 'kills', 'losses', 'turnedUp', 'flipped', 'endCreatures', 'oppEndCreatures'];
