# Duel Summoner (test build 3)

A 3D horde-survival run in the Buried Kingdom. One run is 8 minutes plus the boss fight, then Overtime.

## Play it

```powershell
node serve.mjs
```

Open http://localhost:8765/ (add `?debug` for an fps readout). Controls: WASD move, mouse look (click the map to capture it),
Space jump, Shift dash, Ctrl or C slide, **E use** (sealed chest, Royal Gate), Esc pause. Level-up cards: click, or press 1 to 3
(R redraw, P pass, L leave a chest for later). Pause has **END RUN (cash out)**.

## What a run holds

0:00 to 8:00 wave table, Tomb Scarabs from 0:45, Sealed Warden 4:00 (front shield, drops a sealed chest), Twin Jackal Idols 6:00
(kill both within 10 s), the Last Audience ring from 7:00, The Hollow Pharaoh at 8:00 (or through the Royal Gate from 6:00),
then Overtime hunters that grow stronger every 30 s with no cap. Level-ups offer 3 cards (Redraw, Banish, Pass). The field is
4 Monster Zones and 4 Spell/Trap Zones. Monsters level 1 to 10 in three forms (1, 5, 10). Two named partners at level 10 plus
a sealed chest give a Fusion.

## Layout

- `src/data/` every number: `config.js`, `map.js`, `enemies.js`, `waves.js`, `cards.js`, `elements.js` (tiers, recipes, elements), `field.js`
- `src/core/` input, spatial grid, helpers
- `src/sim/` the rules, no drawing (`game.js` is the entry)
- `src/view/` Three.js scene, actors, camera, HUD, offer screen, minimap, model loader
- `test/` `node --test test/` (rules), `node test/run-sim.mjs [runs] [--god] [--focus]` (balance), `node test/browser-run.mjs` and `test/browser-check.mjs` (real Chrome, screenshots)

## Local art

`assets/models/` holds the owner's baked models (`*.ewv.b64`, `puff.png.b64`). They are optional, git-ignored, and the placeholder shapes are used when a file is missing.
