// The whole roster as playable summons: every basic of the roster (src/data/roster.js, 320) becomes a monster card beside the four the game began with.
// Its attack is its own row of the attack table (src/data/attacks.gen.js), fired by the layered attack engine as a one-layer build (src/sim/fusion.js);
// its three forms are its three baked bodies (assets/models/maps/<id>1..3, or the older block bodies of the first eighteen).
// A game takes them into its offers only when it is made with { roster: true } (the app does; the older tests keep the four-card pool).
import { MONSTERS } from './cards.js';
import { BASICS, ALIAS } from './roster.js';
import { ATTACK_ROWS } from './attacks.gen.js';
import { ANSWERS } from './answers.js';

// the trick each roster summon answers, by its job (the four hand-made cards keep their own)
const JOB_ANSWER = {
  Melee: { on: 'land', cd: 1.2, gen: 'burst', text: 'A clean landing: it strikes where you land.' },
  Area: { on: 'air', cd: 2, gen: 'storm', text: 'Big air: a wide burst of its element where you land.' },
  Ranged: { on: 'flip', cd: 0.8, gen: 'haste', text: 'Each flip: it attacks again at once.' },
  Trick: { on: 'spin', cd: 1.2, gen: 'mark', text: 'A landed spin of 360 or more marks the 3 nearest enemies.' },
  Guard: { on: 'grab', cd: 2, gen: 'mend', text: 'Each grab mends you a little.' },
  Support: { on: 'manual', cd: 0.9, gen: 'drill', text: 'Each second of a manual: your monsters strike again sooner.' }
};

const LEGACY_KIND = { bolt: 'line', beam: 'line', dash: 'line', cone: 'line', lob: 'lob', drop: 'lob', plant: 'lob', pulse: 'lob', mark: 'mark', seeker: 'homing', bite: 'homing' };
const TYPE = { insect: 'Insect', beast: 'Beast', bird: 'Winged Beast', fish: 'Fish', reptile: 'Reptile', plant: 'Plant', spirit: 'Spirit', construct: 'Construct', dragon: 'Dragon' };
const SCALE = [0.7, 0.85, 1], FROM = [1, 5, 10];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const taken = new Set(Object.keys(MONSTERS).concat(Object.keys(ALIAS || {}), Object.values(ALIAS || {})));
export const ROSTER_IDS = [];
for (const b of BASICS) {
  if (MONSTERS[b.id] || taken.has(b.id)) continue;       // the four the game began with keep their hand-made cards
  const q = ATTACK_ROWS[b.id]; if (!q) continue;
  const forms = FROM.map((lv, i) => ({ fromLevel: lv, modelId: (b.forms[i] && b.forms[i].model) || b.id + (i + 1), scale: SCALE[i], baked: true }));
  MONSTERS[b.id] = { name: b.name, type: TYPE[b.bodyFamily] || cap(b.bodyFamily || 'creature'), elements: [q.el || b.element], rarity: b.rarity || 'common', partner: b.partner, roster: true, job: b.job, forms,
    text: b.text + '.', attack: { kind: LEGACY_KIND[q.d] || 'homing', dmg: q.dmg, cd: q.cd, range: q.range || 20, speed: q.speed || 26, length: q.range || 20, pierce: q.pierce || 0, splash: q.splash || 3, flight: q.flight || 0.7 }, fx: {}, fxText: {} };
  ANSWERS[b.id] = [JOB_ANSWER[b.job] || JOB_ANSWER.Melee]; ROSTER_IDS.push(b.id);
}
// the body files a summon needs (its three forms), for the view to fetch before it draws it
export const bodyIds = id => { const D = MONSTERS[id]; return D && D.roster ? D.forms.filter(f => f.baked).map(f => f.modelId) : []; };
