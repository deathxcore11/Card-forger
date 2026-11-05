// Story lessons: soft, one-time "Rift" whispers for new players (Act 1 battles 1-4, then any new mechanic).
// Reads only what the table already shows (the Forge surface); it never takes a tap, never pauses play and
// never changes a rule. Each idea is shown once per device (seen flags), and a switch turns lessons off.
// Plan: https://claude.ai/artifact/FptiwD7aFdtCNBDzvyR3CM
const KEY_SEEN = 'cs.story.lessons.seen', KEY_OFF = 'cs.story.lessons.off';
const read = k => { try { return globalThis.localStorage?.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? globalThis.localStorage?.removeItem(k) : globalThis.localStorage?.setItem(k, v); } catch { /* storage can be blocked */ } };
export const lessonsOff = () => read(KEY_OFF) === '1';
export const setLessonsOff = off => write(KEY_OFF, off ? '1' : null);
const loadSeen = () => { try { return new Set(JSON.parse(read(KEY_SEEN) || '[]')); } catch { return new Set(); } };
const saveSeen = set => write(KEY_SEEN, JSON.stringify([...set]));

// Which concepts each lesson battle teaches, in the order they usually arrive.
export const LESSON_BATTLES = {
  a1b1: ['land', 'cast', 'sick', 'attack', 'block'],
  a1b2: ['flying', 'removal'],
  a1b3: ['protection', 'firststrike'],
  a1b4: ['hold', 'stack'],
};
export const isLessonBattle = id => Object.hasOwn(LESSON_BATTLES, id);
export const lessonNumber = id => Object.keys(LESSON_BATTLES).indexOf(id) + 1;

// One idea per whisper, short, in the Rift's voice.
export const SAY = {
  land: 'The Rift hums. Play a land each turn; it feeds everything you cast.',
  cast: 'Call a creature. It cannot fight the turn it arrives.',
  sick: 'It is still arriving. Next turn it can fight.',
  attack: 'Attack with what is ready. Whatever blocks takes the blow.',
  block: 'Their steel comes at you. Stand a creature in its way.',
  flying: 'Wings pass over the ground. Only fliers can stop fliers.',
  removal: 'A spell can name a target. Spend it on the one that matters.',
  protection: "Protection turns that colour's spells and blows aside.",
  firststrike: 'First strike hits first. The dead strike back no more.',
  hold: 'Cast instants on their turn. The last spell cast resolves first.',
  stack: 'Their spell has not happened yet. Answer it while it waits.',
};

// New-mechanic whispers for later acts: shown the first time a card with the word is on the table.
const WORDS = [
  ['Flanking', /\bflanking\b/i, 'Flanking: a blocker without it gets -1/-1 first.'],
  ['Phasing', /\bphasing\b/i, 'Phasing: it blinks out of time every other turn, then returns untouched.'],
  ['Shadow', /\bshadow\b/i, 'Shadow: it can only block or be blocked by other shadow creatures.'],
  ['Buyback', /\bbuyback\b/i, 'Buyback: pay the extra cost and the spell comes back to your hand.'],
  ['Cumulative upkeep', /cumulative upkeep/i, 'Cumulative upkeep: pay more each turn to keep it, or let it go.'],
  ['Snow', /\bsnow\b/i, 'Snow lands make snow mana, which powers the cards of the long winter.'],
  ['Slivers', /\bsliver\b/i, 'Every sliver shares its ability with all slivers, theirs included.'],
  ['Counters', /\+1\/\+1 counter|spore counter/i, 'Counters placed on a card change it. Answer growing creatures early.'],
  ['Tokens', null, 'Tokens are creatures made by other cards. They vanish when they leave the field.'],
];

const manaValue = cost => String(cost || '').match(/\{([^}]+)\}/g)?.reduce((n, s) => n + (/^\{\d+\}$/.test(s) ? Number(s.slice(1, -1)) : /^\{X\}$/i.test(s) ? 0 : 1), 0) ?? 0;
const kw = c => (c.keywords || []).map(k => typeof k === 'string' ? k : k?.name || '').join(' | ');
const isLand = c => c.types?.includes('Land');
const isCreature = c => c.types?.includes('Creature');
const isMain = s => /main/i.test(s.phase || '');

export function createLessonCoach({root, battle, playerSide = 'hero', doc = document, now = () => Date.now(), store = null} = {}) {
  const seen = store?.seen || loadSeen(), persist = store?.save || saveSeen;
  const lesson = playerSide === 'hero' && isLessonBattle(battle?.id) ? LESSON_BATTLES[battle.id] : [];
  const queue = [];
  let disposed = false, busy = false, shownAny = false, myTurns = 0, lastTurn = -1, glowIds = [], lastWhisper = 0, extra = 0;

  // Evaluate what is true on the table right now; return {concept, ids, text} for the first lesson idea that applies.
  function pick(s) {
    const me = s.seat, cards = s.cards || [], mine = cards.filter(c => c.controller === me && c.zone === 'Battlefield');
    const hand = (s.hand || []).map(id => cards.find(c => c.id === id)).filter(Boolean);
    const theirs = cards.filter(c => c.controller !== me && c.zone === 'Battlefield');
    const myTurn = s.activeSeat === me, lands = mine.filter(isLand), free = lands.filter(c => !c.tapped).length;
    const castable = hand.filter(c => !isLand(c) && manaValue(c.manaCost) <= free);
    const ready = mine.filter(c => isCreature(c) && !c.tapped && !c.summoningSick);
    const tests = {
      land: () => myTurn && isMain(s) && lands.length < myTurns && hand.some(isLand) && hand.filter(isLand).map(c => c.id),
      cast: () => myTurn && isMain(s) && free > 0 && castable.some(isCreature) && castable.filter(isCreature).map(c => c.id),
      sick: () => myTurn && mine.some(c => isCreature(c) && c.summoningSick) && mine.filter(c => isCreature(c) && c.summoningSick).map(c => c.id),
      attack: () => myTurn && isMain(s) && ready.length > 0 && theirs.length >= 0 && myTurns >= 2 && ready.map(c => c.id),
      block: () => !myTurn && /declare(attackers|blockers)/i.test(s.phase || '') && cards.some(c => c.controller !== me && c.attacking) && mine.filter(c => isCreature(c) && !c.tapped).map(c => c.id),
      flying: () => myTurn && isMain(s) && ready.some(c => /flying/i.test(kw(c))) && theirs.some(c => isCreature(c) && !/flying|reach/i.test(kw(c))) && ready.filter(c => /flying/i.test(kw(c))).map(c => c.id),
      removal: () => myTurn && isMain(s) && theirs.some(isCreature) && castable.some(c => !isCreature(c)) && castable.filter(c => !isCreature(c)).map(c => c.id),
      protection: () => mine.some(c => /protection/i.test(kw(c))) && theirs.some(c => /protection/i.test(kw(c))) && mine.filter(c => /protection/i.test(kw(c))).map(c => c.id),
      firststrike: () => /firststrike/i.test(s.phase || '') && cards.some(c => (c.attacking || c.blocking) && /first strike/i.test(kw(c))) && cards.filter(c => (c.attacking || c.blocking) && /first strike/i.test(kw(c))).map(c => c.id),
      hold: () => !myTurn && free > 0 && hand.some(c => c.types?.includes('Instant') && manaValue(c.manaCost) <= free) && hand.filter(c => c.types?.includes('Instant') && manaValue(c.manaCost) <= free).map(c => c.id),
      stack: () => (s.stack || []).some(x => x.controller !== me) && s.prioritySeat === me && hand.some(c => c.types?.includes('Instant') && manaValue(c.manaCost) <= free) && hand.filter(c => c.types?.includes('Instant') && manaValue(c.manaCost) <= free).map(c => c.id),
    };
    for (const concept of lesson) {
      if (seen.has(concept) || queue.some(q => q.concept === concept)) continue;
      const ids = tests[concept]?.();
      if (ids && ids.length) return {concept, ids, text: SAY[concept]};
    }
    return null;
  }

  // A new mechanic a new player would not know: one soft line, at most two per match outside the lesson battles.
  function pickWord(s) {
    if (extra >= 2 || now() - lastWhisper < 20000) return null;
    for (const [name, re, text] of WORDS) {
      if (seen.has('w:' + name) || queue.some(q => q.concept === 'w:' + name)) continue;
      const hit = (s.cards || []).find(c => (c.zone === 'Battlefield' || (c.zone === 'Hand' && c.controller === s.seat)) && (re ? re.test(`${kw(c)} ${c.text || ''}`) : c.isToken));
      if (hit) return {concept: 'w:' + name, ids: [hit.id], text};
    }
    return null;
  }

  const cardEl = id => root.querySelector(`.play-match-card[data-instance="${CSS?.escape ? CSS.escape(String(id)) : id}"]`);
  const clearGlow = () => { for (const id of glowIds) cardEl(id)?.classList.remove('st-glow'); glowIds = []; };

  function show(item) {
    const el = doc.createElement('div');
    el.className = 'st-whisper'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<span class="st-whisper-tag">The Rift</span><span class="st-whisper-line"></span>${shownAny ? '' : '<button type="button" class="st-whisper-skip">Skip lessons</button>'}`;
    el.querySelector('.st-whisper-line').textContent = item.text;
    el.querySelector('.st-whisper-skip')?.addEventListener('click', () => { setLessonsOff(true); api.destroy(); });
    root.append(el); shownAny = true;
    glowIds = item.ids.slice(0, 4); for (const id of glowIds) cardEl(id)?.classList.add('st-glow');
    requestAnimationFrame(() => el.classList.add('in'));
    seen.add(item.concept); persist(seen); lastWhisper = now();
    if (item.concept.startsWith('w:')) extra++;
    const ms = Math.min(7000, 3200 + item.text.length * 45);
    return new Promise(done => setTimeout(() => { clearGlow(); el.classList.remove('in'); el.classList.add('out'); setTimeout(() => { el.remove(); done(); }, 300); }, ms));
  }
  async function pump() { if (busy) return; busy = true; while (queue.length && !disposed) { await show(queue.shift()); await new Promise(r => setTimeout(r, 600)); } busy = false; }

  const api = {
    update(state) {
      if (disposed || lessonsOff() || state?.phase !== 'playing') return;
      const s = state.game?.status?.surface; if (!s) return;
      if (s.activeSeat === s.seat && s.turn !== lastTurn) myTurns++;
      lastTurn = s.turn;
      if (busy || queue.length) return;
      const item = pick(s) || pickWord(s);
      if (item) { queue.push(item); void pump(); }
    },
    destroy() { disposed = true; queue.length = 0; clearGlow(); root.querySelectorAll('.st-whisper').forEach(n => n.remove()); },
    _seen: () => seen,
  };
  return api;
}

// Stacked draws for the four lesson battles (engine setting setup.stack, CPU matches only): names, top of the
// library first. The first seven are the opening hand and the hero keeps it (no mulligan); the rest are the next draws.
// Forge still shuffles, deals and plays; this only moves named cards to the top before the opening draw.
export const LESSON_STACKS = {
  a1b1: {
    hero: ['Plains', 'Savannah Lions', 'Plains', 'Benalish Hero', 'Plains', 'Mesa Pegasus', 'White Knight', 'Plains', 'Pearled Unicorn', 'Plains', 'Northern Paladin', 'Plains'],
    villain: ['Forest', 'Llanowar Elves', 'Forest', 'Grizzly Bears', 'Forest', 'Timber Wolves', 'Elvish Archers', 'Forest', 'Wyluli Wolf', 'Forest'],
  },
  a1b2: {
    hero: ['Plains', 'Mesa Pegasus', 'Plains', 'Mesa Pegasus', 'Plains', 'Swords to Plowshares', 'Pearled Unicorn', 'Plains', 'Plains', 'Savannah Lions', 'Serra Angel', 'Plains'],
    villain: ['Mountain', 'Hill Giant', 'Mountain', 'Gray Ogre', 'Mountain', 'Goblin King', 'Mountain', 'Mountain', 'Uthden Troll', 'Mountain'],
  },
  a1b3: {
    hero: ['Plains', 'White Knight', 'Plains', 'Savannah Lions', 'Plains', 'Benalish Hero', 'Northern Paladin', 'Plains', 'Plains', 'Serra Angel', 'Plains'],
    villain: ['Swamp', 'Black Knight', 'Swamp', 'Scathe Zombies', 'Swamp', 'Erg Raiders', 'Drudge Skeletons', 'Swamp', 'Swamp', 'Hasran Ogress'],
  },
  a1b4: {
    hero: ['Plains', 'Island', 'Plains', 'Island', 'Mesa Pegasus', 'Unsummon', 'Flying Men', 'Island', 'Moorish Cavalry', 'Plains', 'Serra Angel', 'Island'],
    villain: ['Forest', 'Llanowar Elves', 'Forest', 'Ghazbán Ogre', 'Giant Growth', 'Forest', 'Scryb Sprites', 'Forest', 'Grizzly Bears', 'Forest'],
  },
};
// The Forge host with setup.stack went live 5 Nov 00:22Z (PR #121, 0996b7e6). The in-app engine (older APKs, the web build inside the
// APK) refuses an unknown `setup` key until the APK with the engine port ships: flip STACK_LOCAL_LIVE then.
export const STACK_HOST_LIVE = true;
export const STACK_LOCAL_LIVE = false;
const STACK_LIVE = STACK_HOST_LIVE;
export const lessonSetup = (id, live = STACK_LIVE) => live && LESSON_STACKS[id] ? {stack: structuredClone(LESSON_STACKS[id]), noMulligan: true} : null;
