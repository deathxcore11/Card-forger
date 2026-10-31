# Planeswalk sources

`planeswalk.html` and `planeswalk-art-zen.css` at the repo root are **built files**. Edit the sources here, then build.

## Build

```sh
sh planeswalk-src/motion/build-motion.sh          # only when motion/ changed: writes planeswalk-src/planeswalk-motion.js
python3 planeswalk-src/tools/cast-anchors.py planeswalk-cast   # only when a figure atlas or cast.json changed
PW_OUT=. python3 planeswalk-src/build.py          # writes ./planeswalk.html and ./planeswalk-art-zen.css
node planeswalk-src/tools/content-check.cjs .     # the content gate: must print 0 FAIL before any push
```

`build.py` inlines, in order: `src.html` (the game), the stylesheets (`planeswalk-skin.css`, `emblem-art.css`,
`extra.css`, `kit.css`, `cast.css`) and the scripts (`emblem-art.js`, `planeswalk-touch.js`, `planeswalk-motion.js`,
`pw-mana.js` (generated), `planeswalk-ink-map.js`, `pw-tips.js`, `pw-kit.js`, `pw-cast.js`). It raises every font
size to at least 11px and moves Zendikar's art into `planeswalk-art-zen.css`, which the game loads near the end of Act 1.

## Files

| File | What it is |
| --- | --- |
| `src.html` | The game: rules, data tables (heroes, cards, emblems, monsters, acts), views |
| `pw-cast.js`, `cast.css` | Painted fighters, fight mats, the one-line fight layout |
| `planeswalk-touch.js` | Touch, hold-to-zoom, aim arrow, Android back |
| `planeswalk-ink-map.js` | The inked map and the top bar |
| `motion/` | Effect sprites, the shared motion kit and its glue; `build-motion.sh` writes `planeswalk-motion.js` |
| `tools/cast-anchors.py` | Measures where each painted figure stands (`cx`, `hx`, `cw`, `bx` in `planeswalk-cast/cast.json`) |
| `tools/content-check.cjs` | The content gate: every monster, intent, act, hero, card, figure, portrait and mat, made-up probe rows, and a sim smoke per hero. FAIL blocks a change |
| `tools/sim.cjs` | Balance sim: `node planeswalk-src/tools/sim.cjs planeswalk.html 300 R` |
| `tools/gate/` | Layout gate routes and runner (`prun.js`, `routes.json`, `summ.py`), used with the design audit kit |

## Rules that hold for every change

- New heroes, monsters, acts and mats are data rows plus their own art; no hard-wired names in engine code.
  See the content-ready plan: https://claude.ai/artifact/Cvn7veLypgYcR91BUn92Te
- A unit without its own painting shows its own card-art portrait, never another character's painting.
- Every UI change passes the layout gate (0 findings at 100% and 130% text) and the design auditor before it ships.
- This repo is public: never commit secrets.
