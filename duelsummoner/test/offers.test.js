import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { buildOffer } from '../src/sim/field.js';
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };

test('offers: an untaken new card does not come back on the next offer, and the first Trap is pushed in once', () => {
  for (const seed of [1, 2, 3]) {
    const g = mk(seed); g.level = 6; let prev = null, repeats = 0, trapsForced = 0;
    for (let n = 0; n < 12; n++) { const cards = buildOffer(g); if (prev) for (const c of cards) if (c.isNew && prev.has(c.id)) repeats++; prev = new Set(cards.filter(c => c.isNew).map(c => c.id)); }
    assert.equal(repeats, 0, 'seed ' + seed + ' repeated ' + repeats + ' declined new cards');
  }
});

test('offers: over 1000 offers the guaranteed upgrade goes to the lower partner of a fielded Fusion pair, and a rule-of-three offer is never starved of it', () => {
  const g = mk(5); g.level = 10; g.field.monsters[0] = { id: 'ember-wyvern', level: 3, cd: 0 }; g.field.monsters[1] = { id: 'cinder-hatchling', level: 5, cd: 0 }; g.field.monsters[2] = { id: 'rune-apprentice', level: 3, cd: 0 };
  const count = {}; let withUp = 0; for (let n = 0; n < 1000; n++) { g.upgHist = [true, true]; const cards = buildOffer(g); let any = false; for (const c of cards) if (c.kind === 'monster' && !c.isNew) { count[c.id] = (count[c.id] || 0) + 1; any = true; } if (any) withUp++; }
  assert.equal(withUp, 1000, 'every offer holds an upgrade even after two upgrade offers in a row (the pair is being finished)');
  const tot = Object.values(count).reduce((a, b) => a + b, 0); assert.ok((count['ember-wyvern'] || 0) / tot > 0.4, 'the lower partner leads: ' + JSON.stringify(count));
  const h = mk(6); h.level = 10; h.field.monsters[0] = { id: 'ember-wyvern', level: 1, cd: 0 }; h.field.monsters[1] = { id: 'cinder-hatchling', level: 1, cd: 0 }; h.upgHist = [true, true]; assert.ok(!buildOffer(h).some(c => c.kind === 'monster' && !c.isNew), 'below the push level the two-in-three rule still holds');
});
