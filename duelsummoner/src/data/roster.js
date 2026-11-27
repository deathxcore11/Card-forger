// The big roster (owner, 27 Nov: "Yes, lock it with Chimeras", then "All 320 at once"): 320 basics in 40 families of eight (the locked 64 are the eight Core families),
// 160 Fusions (rows 1+2, 3+4, 5+6, 7+8 of every family), 60 Gods (a God per family plus cross Gods), 15 Secrets, Chimeras by rule, Infusions, items in four rarities, boon lines, new enemies.
// The entries come from the plan files (roster-plan.gen.js, made by tools/roster-import.mjs); this file holds the rules that turn them into game data. Old monster ids keep working.
// Stats come from one point budget (forms 100 / 160 / 250, Chimera 350, Fusion 550, God 1,200, Secret 2,600) spread over six dials with job floors and rarity caps:
// rarity sets how often and how strange, never how strong. No number here is tuned. An effect the sim does not have yet is marked built: false; nothing beyond the plans' text is invented.
import { PLAN } from './roster-plan.gen.js';
import { MONSTERS, FUSIONS, DUELISTS } from './cards.js';

// ---- the point budget (the one table every stat comes from; bots read it to check balance) ----
export const DIALS = ['damage', 'rate', 'reach', 'spread', 'toughness', 'effect'];
export const BUDGET = {
  basic: [100, 160, 250],                         // forms 1, 2, 3 (levels 1, 5, 10), the same for every rarity
  chimera: [350],
  fusion: [220, 352, 550],                        // form 3 is 550; forms 1 and 2 keep the basic forms' proportions
  god: [1200],
  secret: [2600],
  trait: 10,                                      // a family trait costs 10 of every 100
  floors: { Melee: ['damage', 30], Ranged: ['reach', 25], Area: ['spread', 30], Guard: ['toughness', 35], Support: ['effect', 40], Trick: ['effect', 30] },       // per 100
  caps: { common: 40, uncommon: 50, rare: 60, epic: 70 },       // the highest any one dial may go, per 100: a rarer monster may lean harder on one dial (stranger), never get more points
  // how a job spends what is left after its floor (its leaning), in order of preference with weights
  lean: { Melee: { damage: 4, rate: 3, toughness: 2, reach: 1 }, Ranged: { damage: 3, rate: 3, reach: 2, effect: 1 }, Area: { spread: 3, damage: 3, rate: 1, effect: 1 },
    Guard: { toughness: 3, damage: 2, spread: 1, effect: 1 }, Support: { effect: 3, rate: 2, reach: 2, toughness: 1 }, Trick: { effect: 3, damage: 2, rate: 2, reach: 1 } },
  // what one dial point buys in the sim's units (starting values, untuned): the bridge from points to attack numbers
  units: { damage: 0.12, rate: 0.012, reach: 0.25, spread: 0.06, toughness: 1.5, effect: 0.01 }
};
export const RARITY = {
  common:   { weight: 60, colour: 0xe6dcc0, label: 'Common' },
  uncommon: { weight: 27, colour: 0x2f7f86, label: 'Uncommon' },
  rare:     { weight: 10, colour: 0xe0b765, label: 'Rare' },
  epic:     { weight: 3,  colour: 0xf08040, label: 'Epic' }
};
export const ELEMENTS = ['fire', 'lightning', 'ice', 'light', 'dark', 'earth', 'poison', 'wind'];
export const JOBS = Object.keys(BUDGET.floors);
export const FORM_LEVELS = [1, 5, 10];
export const RULES = {
  monsterZones: 4,
  stacking: 'same kind adds, different kinds multiply',
  overtimeHpPer30s: 0.22,                         // Overtime grows enemy HP 22 per cent every 30 s (not read by the sim yet)
  runDraw: { homeFamily: true, pairs: 10 },       // a run draws 28 basics: the duelist's home family (8) plus ten random pairs (20) from unlocked families, seeded per run
  chimera: { attackMul: 0.7, canClimb: false, keyItem: 'chimera-key', fromLevel: 10, notPartners: true },
  infusion: { fromLevel: 10, aspects: 1, aspectsWithItem: { 'aspect-vial': 2 } }
};

// ---- points onto dials: the floor, the trait, then the job's leaning, each dial capped by rarity ----
export function dialsOf(points, job, rarity, hasTrait) {
  const per = points / 100, cap = (BUDGET.caps[rarity] || 40) * per, out = Object.fromEntries(DIALS.map(d => [d, 0])), [fd, fv] = BUDGET.floors[job] || BUDGET.floors.Melee;
  let left = points - (hasTrait ? BUDGET.trait * per : 0); out[fd] = Math.min(cap, fv * per); left -= out[fd];
  const lean = BUDGET.lean[job] || BUDGET.lean.Melee;
  for (let guard = 0; left > 1e-6 && guard < 12; guard++) { const open = Object.keys(lean).filter(d => out[d] < cap - 1e-6), w = open.reduce((a, d) => a + lean[d], 0); if (!open.length) { const rest = DIALS.filter(d => out[d] < cap - 1e-6); if (!rest.length) break; for (const d of rest) { const add = Math.min(cap - out[d], left / rest.length); out[d] += add; } left = points - (hasTrait ? BUDGET.trait * per : 0) - DIALS.reduce((a, d) => a + out[d], 0); continue; }
    let spent = 0; for (const d of open) { const add = Math.min(cap - out[d], left * lean[d] / w); out[d] += add; spent += add; } left -= spent; }
  for (const d of DIALS) out[d] = +out[d].toFixed(2);
  return out;
}
const unitsOf = D => { const U = BUDGET.units; return { dmg: +(1 + D.damage * U.damage).toFixed(2), cd: +Math.max(0.25, 1.6 - D.rate * U.rate).toFixed(2), reach: +(2 + D.reach * U.reach).toFixed(1), spread: +(D.spread * U.spread).toFixed(2), hp: +(D.toughness * U.toughness).toFixed(1), effect: +(D.effect * U.effect).toFixed(3) }; };

// ---- cry families for the sound pack (blank when unsure; not wired to sound) ----
const FAMILY = [[/wyvern|drake|wyrm|dragon|salamander|basilisk|hydra|serpent/i, 'dragon'], [/owl|dove|finch|sparrow|heron|crane|raven|fledgling|phoenix|gryphon|roc\b|strix|thunderbird|quetzal|flock|lark|swan|woodpecker|warbler|crow|rooster|chick|hawk|eagle|kite|goose|duck|parrot|magpie|wren|stork/i, 'bird'],
  [/moth|beetle|mantis|wasp|scarab|spider|firefly|bee\b|hornet|cricket|locust|ant\b|cicada|dragonfly|ladybird/i, 'insect'], [/lynx|hare|pup|cub|kit\b|cat\b|fawn|calf|hound|mouse|meerkat|raptor|ferret|bunny|pangolin|armadillo|mole|hedgehog|lion|walrus|yak|mammoth|hart|behemoth|kirin|ram\b|goat|deer|hind|horse|mastiff|fox|fennec|otter|bear|wolf|boar|aurochs|marmot|stag|elk|badger|bison|ox\b|hog|jackal/i, 'beast']];
export const bodyFamily = name => { for (const [re, f] of FAMILY) if (re.test(name)) return f; return ''; };

// ---- the monsters the game plays today: roster id -> game id (old saves and the sim keep their ids) ----
export const LEGACY = { 'ember-wyvern': 'ember-wyvern', 'cinder-hatchling': 'cinder-hatchling', 'rune-newt': 'rune-apprentice', 'sigil-familiar': 'sigil-familiar', 'twinflare-tyrant': 'twinflare-tyrant', 'astral-strix': 'astral-magus' };
export const ALIAS = Object.fromEntries(Object.entries(LEGACY).map(([r, g]) => [g, r]));
const LEGACY_PARENTS = { 'twinflare-tyrant': ['ember-wyvern', 'cinder-hatchling'], 'astral-strix': ['rune-newt', 'sigil-familiar'] };       // the plan names the nine old Fusions without parents; these two come from the game

// ---- models: the block model by name, else an element stand-in (a Core family monster of the same element), listed by standIns() ----
const formsOf = model => { if (!model) return []; const m = /^(.*?)([123])$/.exec(model); return m ? [1, 2, 3].map(k => m[1] + k) : [model]; };
const STAND_IN = {}; for (const b of PLAN.basics) if (b.model && !STAND_IN[b.element]) STAND_IN[b.element] = formsOf(b.model).pop();
const modelFor = (e, i) => { const f = formsOf(e.model); return f.length ? f[Math.min(i, f.length - 1)] : ''; };
const effectOf = (e, kind) => { const g = LEGACY[e.id]; return g ? { kind: 'legacy', gameId: g, built: true } : { kind: kind === 'basic' ? 'job:' + e.job : kind, text: e.text || '', built: false }; };
const famById = Object.fromEntries(PLAN.families.map(f => [f.id, f]));
const mk = (e, kind, budget) => { const fam = famById[e.family], trait = !!(fam && fam.trait), job = e.job || 'Trick', rar = e.rarity || 'epic';
  return { ...e, kind, job, rarity: rar, parents: e.parents && e.parents.length ? e.parents : (LEGACY_PARENTS[e.id] || e.parents || []), familyTrait: fam ? fam.trait : '',
    forms: budget.map((pts, i) => ({ fromLevel: kind === 'basic' || kind === 'fusion' ? FORM_LEVELS[i] : (kind === 'god' ? 10 : 1), points: pts, model: modelFor(e, i) })),
    standIn: !e.model, standInModel: e.model ? '' : (STAND_IN[e.element || (e.elements || [])[0]] || ''), bodyFamily: bodyFamily(e.name + ' ' + (e.species || '')), trick: '', effect: effectOf(e, kind) }; };

export const FAMILIES = PLAN.families;
export const BASICS = PLAN.basics.map(b => mk(b, 'basic', BUDGET.basic));
export const FUSION_LIST = PLAN.fusions.map(f => mk(f, 'fusion', BUDGET.fusion));
export const GODS = PLAN.gods.map(g => mk(g, 'god', BUDGET.god));
export const SECRETS = PLAN.secrets.map(s => mk(s, 'secret', BUDGET.secret));
export const ROSTER = Object.fromEntries([...BASICS, ...FUSION_LIST, ...GODS, ...SECRETS].map(e => [e.id, e]));
export const rosterOf = id => ROSTER[id] || ROSTER[ALIAS[id]] || null;       // a roster id or a game id

// stats: the form's points spread on the six dials, then turned into the sim's units
export function statsOf(id, form = 0) {
  const e = rosterOf(id); if (!e) return null; const f = e.forms[Math.min(form, e.forms.length - 1)], dials = dialsOf(f.points, e.job, e.rarity, !!e.familyTrait);
  return { points: f.points, dials, ...unitsOf(dials) };
}
export function chimeraStats(a, b) { const A = rosterOf(a), B = rosterOf(b); if (!A || !B) return null; const pts = BUDGET.chimera[0]; return { points: pts, attacks: [A, B].map(e => ({ id: e.id, attackMul: RULES.chimera.attackMul, ...unitsOf(dialsOf(pts / 2, e.job, e.rarity, false)) })) }; }
export function fusionOf(a, b) { const A = rosterOf(a), B = rosterOf(b); if (!A || !B) return null; const has = e => e.parents.length === 2 && e.parents.includes(A.id) && e.parents.includes(B.id); return FUSION_LIST.find(has) || GODS.find(has) || SECRETS.find(has) || null; }
export function chimeraOf(a, b) {
  const A = rosterOf(a), B = rosterOf(b); if (!A || !B || A.kind !== 'basic' || B.kind !== 'basic' || A.id === B.id || A.partner === B.id) return null;
  const [p, q] = [A, B].sort((x, y) => (x.id < y.id ? -1 : 1));
  return { id: 'chimera:' + p.id + '+' + q.id, kind: 'chimera', parents: [p.id, q.id], elements: [...new Set([p.element, q.element])], attackMul: RULES.chimera.attackMul, canClimb: false, models: [modelFor(p, 2) || p.standInModel, modelFor(q, 2) || q.standInModel], effect: { kind: 'chimera', built: false } };
}
// the pairs of a family: rows 1+2, 3+4, 5+6, 7+8
export const pairsOf = famId => { const m = BASICS.filter(b => b.family === famId), out = []; for (let i = 0; i + 1 < m.length; i += 2) out.push([m[i].id, m[i + 1].id]); return out; };
export const homeFamily = duelistId => { const D = DUELISTS[duelistId], s = D && D.start, e = s && rosterOf(s); return e ? e.family : 'core-fire'; };
// the run draw: the duelist's home family plus ten random pairs from the unlocked families, seeded per run
export function runPool(seed, duelistId, unlockedFamilies) {
  let s = (seed >>> 0) || 1; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const home = homeFamily(duelistId), out = BASICS.filter(b => b.family === home).map(b => b.id), fams = (unlockedFamilies || FAMILIES.map(f => f.id)).filter(f => f !== home), pairs = fams.flatMap(pairsOf);
  for (let k = 0; k < RULES.runDraw.pairs && pairs.length; k++) { const i = (rnd() * pairs.length) | 0; out.push(...pairs[i]); pairs.splice(i, 1); }
  return out;
}

// ---- items in four rarities ----
export const ITEM_RULES = Object.fromEntries(PLAN.itemRules.map(r => [r.rarity, { odds: r.odds, count: r.count, stacking: r.stacking, maxCopies: r.rarity === 'rare' ? 3 : r.rarity === 'epic' ? 1 : Infinity }]));
export const ROSTER_ITEMS = PLAN.items.map(i => ({ ...i, built: false }));
// ---- boons: 14 lines of four, three ranks each; the plan writes each line's push and its capstone, the first three boons of a line are not written yet ----
export const BOON_LINES = PLAN.boonLines.map(l => ({ ...l, ranks: 3, boons: [1, 2, 3].map(k => ({ id: l.id + '-' + k, name: '', text: '', written: false, built: false })).concat([{ id: l.id + '-capstone', name: 'Capstone', text: l.capstone, written: true, built: false }]) }));
export const BUILDS = PLAN.builds;
// ---- enemies by attack type (Sealed variants are a modifier, not an enemy) ----
export const ENEMY_TYPES = PLAN.enemyTypes;
export const NEW_ENEMIES = PLAN.enemyTypes.flatMap(t => t.new.filter(e => e.id !== 'sealed-variants').map(e => ({ ...e, type: t.type, asks: t.asks, built: false })));

// ---- the lists for the report ----
export function notBuilt() {
  const L = [];
  for (const e of Object.values(ROSTER)) if (!e.effect.built) L.push(e.kind + ' ' + e.name + ': ' + (e.text || e.effect.kind));
  for (const i of ROSTER_ITEMS) L.push('item ' + i.name + ': ' + i.text);
  for (const l of BOON_LINES) L.push('boon line ' + l.name + ': ' + l.push + '; capstone ' + l.capstone);
  for (const e of NEW_ENEMIES) L.push('enemy ' + e.name + ' (' + e.type + ')' + (e.note ? ': ' + e.note : ''));
  for (const f of FAMILIES) if (f.trait) L.push('family trait ' + f.name + ': ' + f.trait);
  L.push('rule: Overtime enemy HP +22% per 30 s', 'rule: the run draw of 28 feeding the offers', 'rule: Chimera fusing at a sealed chest', 'rule: Infusion (absorb a level 10 basic, one aspect)');
  return L;
}
export const standIns = () => Object.values(ROSTER).filter(e => e.standIn).map(e => e.id);
export const missingParents = () => [...FUSION_LIST, ...GODS, ...SECRETS].filter(e => e.parents.length !== 2 || e.parents.some(p => !ROSTER[p])).map(e => e.id);
export const legacyOk = () => Object.entries(LEGACY).every(([r, g]) => !!ROSTER[r] && !!(MONSTERS[g] || FUSIONS[g]));
