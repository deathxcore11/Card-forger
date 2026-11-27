// The fusion rule v3 (approved in the fusion lab, 27 Nov). Every number here is a starting point, not tuned.
// An attack is a chain of layers. Layer 1 is the Line's own attack (the first parent); each graft's attack is the next layer and fires from the enemies the layer before it hit.
// Rank sets the multiplier; the parents set the kit. Super Fusions add the reaction loop, Epic Fusions a keystone by the Line's element.
export const FUSION = {
  rankMul: [1, 1.25, 1.6, 2, 2.5],          // by rank: Basic, Fusion, Greater, Super, Epic (x the Line's own damage)
  layerCap: [1, 2, 3, 4, 4],                // layers an attack may carry, by rank
  layerScale: [1, 0.6, 0.45, 0.35],         // each layer's damage, a share of that layer's own number
  fireFrom: [0, 2, 2, 1],                   // layer k fires from at most this many of the enemies the layer before it hit
  layerDelay: 0.07,                         // seconds between a hit and the next layer firing from it
  layerReach: 0.65,                         // a later layer's range, a share of its own
  statusT: 3, poisonT: 4,                   // seconds an element stays on an enemy
  reactEvery: 1,                            // one reaction per enemy per this many seconds
  reactPerSec: 4,                           // reactions a second for the whole build
  reactDmg: 1,                              // a burst reaction hits for this x the Line's layer-1 number
  venom: 0.15, venomCap: 20, venomCapKey: 40,       // poison: damage a second per stack (x the rank multiplier)
  burnDps: 1.2,                             // fire on an enemy: damage a second (x the rank multiplier)
  loop: 0.5, loopCd: 0.5,                   // Super and up: every reaction pulses again at this share, at most this often
  meter: 24, meterElite: 4,                 // the show-stopper meter: kills to fill it (an elite counts 4)
  stopperGap: 1.4, stopperMul: 3,           // show-stoppers: seconds between moves, damage x the Line's layer-1 number
  claw: { range: 3.8, arc: 2.2, layerRange: 2.8, knock: 9, layerKnock: 4, lunge: 0.22 },       // claws: a real melee arc in front (radians); a later layer rakes all round. Knockback is a velocity (m/s), it decays
  knockDecay: 6                             // knockback velocity falls off at this rate a second
};

// What each delivery is called in an attack's name, and what it does as a later layer
export const LAYER_NAME = { bolt: 'Lance', lob: 'Mortar', mark: 'Brand', seeker: 'Swarm', cone: 'Breath', plant: 'Totem', dash: 'Charge', pulse: 'Nova', beam: 'Ray', bite: 'Claw', drop: 'Eruption' };

// The kits: each creature's own attack as a layer. The four playable basics use the game's own numbers (src/data/cards.js); the rest are from the lab, for the roster, keyed by roster name.
export const KITS = {
  'ember-wyvern': { d: 'bolt', dmg: 2, cd: 0.65, range: 20, pierce: 2, speed: 34, el: 'fire' },
  'cinder-hatchling': { d: 'lob', dmg: 3, cd: 1.4, range: 22, splash: 3, flight: 0.7, el: 'fire' },
  'rune-apprentice': { d: 'mark', dmg: 1, cd: 1, range: 24, marks: 3, el: 'lightning' },
  'sigil-familiar': { d: 'seeker', dmg: 3, cd: 0.5, range: 26, speed: 22, el: 'lightning' },
  golem: { d: 'plant', dmg: 2, cd: 1.2, range: 10, radius: 5, el: 'earth', riders: ['taunt'] },
  lynx: { d: 'dash', dmg: 5, cd: 1.5, range: 14, el: 'ice', riders: ['elite'] },
  rime: { d: 'pulse', dmg: 2, cd: 1.3, radius: 6, el: 'ice', riders: ['split'] },
  firefly: { d: 'beam', dmg: 1.2, cd: 0.5, range: 18, el: 'light', riders: ['heal'] },
  shade: { d: 'bite', dmg: 3, cd: 0.7, el: 'dark', riders: ['jump'] },
  mole: { d: 'drop', dmg: 5, cd: 2, range: 16, radius: 3.5, el: 'earth' },
  toad: { d: 'lob', dmg: 1.5, cd: 1.6, range: 18, splash: 3, flight: 0.8, el: 'poison', riders: ['puddle'] },
  hedgehog: { d: 'dash', dmg: 3, cd: 1.8, range: 12, el: 'poison', riders: ['spines'] },
  ferret: { d: 'dash', dmg: 2.5, cd: 0.9, range: 9, el: 'wind', riders: ['chain'] },
  ray: { d: 'beam', dmg: 1.6, cd: 0.6, range: 16, el: 'wind', riders: ['pull'] },
  imp: { d: 'bite', dmg: 4, cd: 0.6, el: 'fire', riders: ['blood'] },
  bonepup: { d: 'bite', dmg: 3, cd: 0.55, el: 'dark', riders: ['lowlp'] },
  crab: { d: 'bite', dmg: 3.5, cd: 0.7, el: 'earth', riders: ['coin'] },
  kit: { d: 'bolt', dmg: 3, cd: 0.9, range: 18, pierce: 1, speed: 24, el: 'light', riders: ['chain', 'coins'] }
};

// Reactions: two elements on one enemy. The kind says what the reaction does.
export const REACTIONS = { 'fire+ice': 'Steam', 'fire+lightning': 'Overload', 'fire+poison': 'Blast', 'fire+wind': 'Firestorm', 'earth+fire': 'Magma', 'ice+lightning': 'Shatter', 'ice+poison': 'Preserve', 'ice+wind': 'Blizzard', 'earth+ice': 'Permafrost',
  'lightning+poison': 'Conduct', 'lightning+wind': 'Thunderhead', 'earth+lightning': 'Magnetise', 'poison+wind': 'Miasma', 'earth+poison': 'Overgrowth', 'earth+wind': 'Sandstorm', 'dark+light': 'Eclipse' };
export const REACT_KIND = { Steam: 'burst', Overload: 'burst', Blast: 'burst', Shatter: 'burst', Eclipse: 'burst', Thunderhead: 'burst', Magma: 'zone', Firestorm: 'spread', Miasma: 'spread', Blizzard: 'spread', Conduct: 'spread', Prism: 'spread',
  Permafrost: 'hold', Overgrowth: 'hold', Sandstorm: 'hold', Magnetise: 'pull', Preserve: 'keep', Hex: 'keep' };
export function reactionOf(a, b) { if (a === b) return null; const k = [a, b].sort().join('+'); return REACTIONS[k] || (a === 'light' || b === 'light' ? 'Prism' : a === 'dark' || b === 'dark' ? 'Hex' : null); }

// Show-stoppers: one per element. A build fires one for each element it carries, back to back.
export const STOPPERS = { fire: 'Meteor Rain', ice: 'Glacier', lightning: 'Thunderstorm', poison: 'Plague Bloom', wind: 'Cyclone', earth: 'Faultline', light: 'Sunlance', dark: 'Eclipse' };
// Epic keystones, by the Line's element
export const KEYSTONES = { fire: 'Wildfire: when a burning enemy dies, its fire jumps to everything within 4 m', ice: 'Deep freeze: freezes on the second chill, not the third', lightning: 'Live wire: every layer fires from one more enemy',
  poison: 'Rot: venom stacks to 40, not 20', wind: 'Eye of the storm: every attack drags the crowd toward it', earth: 'Aftershock: every attack repeats at 40%', light: 'Lens: light crits half the time, not a quarter', dark: 'Debt: cursed enemies take 45% more, not 20%' };

// ---- v4: links and forms (lab version 4, 27 Nov) ----
// LINKS: how a later layer fires from the one before. A moving carrier (bolt, seeker, lob, dash) uses hit, end, trail or kill; a standing one uses hit, nova, echo or kill.
// The choice is the carrier's delivery plus a hash of the pair, so the same pair always gives the same attack.
export const MOVING = ['bolt', 'seeker', 'lob', 'dash'], DIRECTIONAL = ['bolt', 'seeker', 'beam', 'cone', 'dash'];
export const LINK = { echo: { scale: 0.8, again: 0.5 }, kill: { scale: 1.6, delay: 0.05, extra: 1 }, trail: { n: 3, every: 4 }, nova: { dirs: 5, layerDirs: 3, ring: 4.5 } };
// FORMS: a fusion of two fusions gets up to two, from a hash of its id
export const FORMS = ['Volley', 'Mirror', 'Storm', 'Giant', 'Spiral', 'Orbit'];
export const FORM = { Volley: { spread: 0.42, side: 4, scale: 0.6 }, Mirror: { dist: 17, scale: 0.7 }, Storm: { n: 3, scale: 0.55 }, Giant: { mult: 2.2, cd: 1.8, size: 1.5 }, Spiral: { mult: 0.5, cd: 0.45, turn: 2.6 }, Orbit: { n: 3, r: 5.5, scale: 0.8 } };
export const hashKey = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export const pickLink = (carrier, key) => (MOVING.includes(carrier) ? ['hit', 'end', 'trail', 'kill'] : ['hit', 'nova', 'echo', 'kill'])[hashKey(key) % 4];
// the lab's names for the playable Fusions, so a pair hashes to the same links here as in the lab
export const LAB_KEY = { 'twinflare-tyrant': 'tyrant', 'astral-magus': 'strix' };

// ---- the whole roster's attacks (lab version 6): one data-driven loader ----
// A creature's kit is, in order: the table above (the playable four and the lab's own creatures), then its row in the 320 imported rows (tools/attacks-import.mjs), by game id or roster id.
import { ATTACK_ROWS } from './attacks.gen.js';
import { ALIAS } from './roster.js';
export const kitOf = id => KITS[id] || ATTACK_ROWS[id] || ATTACK_ROWS[ALIAS[id]] || null;
