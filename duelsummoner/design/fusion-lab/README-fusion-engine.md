# Fusion engine and attack engine (lab Version 6, 27 Nov 2026)

Reference code, seen running only in the Fusion Lab in a cloud browser. Not tuned. Port the rules, not the drawing code.

## Files
- `chimera.js`: helpers (chiBuild, chiBox, chiCols, chiScale, chiName).
- `fusion.js`: `fuse(a, b, rng)` returns the id `fx_<a>__<b>` and registers a model recipe plus `FX[id]`.
- `sim.js`: `atkOf(id)` builds the attack from the fusion tree. `cast`, `hit`, `fire`, `ult` run it. Also the lab enemies.
- `attacks-320.js`: one attack row for each of the 320 basics, with the 3 form ids.

## Body rule (fusion.js)
1. The first parent is the Line and keeps its body. The second is the graft and fills the next free slot: head, wings, tail, arms. No free slot means colour and glow only. Rank cap 4.
2. New in V6. A small graft never replaces a grand limb. If the graft's limb is under 70% of the Line's limb for its body size, the Line keeps its own limb and takes the graft's colours (`FX[id].inf[slot]`).
3. New in V6. When a graft does replace a limb, it is placed joint on joint and scaled to the old limb's size.
4. New in V6. When the Line has no such limb, the engine tries every height and length along the body, presses the joint onto the body surface, and keeps the spot that cuts through the least. Arms sit at the shoulders of a long body and mid-way on an upright one.
5. New in V6. Graft blocks that would sit inside existing blocks are removed, so two surfaces never flicker through each other.
6. New in V6. A grafted head is sized by volume, not by its longest side.
7. Names: newest two graft words, the Line's last word, then Prime at rank 3 and Apex at rank 4.
8. Mutation roll: 80% standard, 15% Twin-Core, 5% Prismatic, from the run's seeded dice.

## Attack rule (sim.js atkOf)
- Attack = chain of layers. Layer 1 is the Line's attack. Each graft's attack is the next layer and fires from the layer before.
- Layers by rank: 1, 2, 3, 4, 4. Layer damage scale: 1, .6, .45, .35. Rank multiplier: 1, 1.25, 1.6, 2, 2.5.
- Link (how a layer fires from the one before), by `pickLink(delivery, key)`: moving carriers hit, end, trail or kill; still carriers hit, nova, echo or kill.
- Form, only for a fusion of two fusions, by hash of the id, at most two: Volley, Mirror, Storm, Giant, Spiral, Orbit.
- Super = Reaction loop. Epic = Keystone by main element. Show-stopper fills on 24 kills.
- Limits kept from the bots: one reaction per enemy per second, four per build per second, strongest ground zone only, Venom 0.15 per stack.
- Bots, one run of 258 creatures, middle power against a basic by rank: 1.9, 3.5, 4.9, 7.4.
