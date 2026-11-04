# Act 1 seeded Forge runs (2 Nov 2026)

Forge AI against Forge AI (default profile), 200 games per battle, seed 1102, first player alternating.
Rerun: `node scripts/story/check-story-deck.mjs 1 --sim-dir /tmp/story/sim-1 && STORY_SEED=1102 bash scripts/story/sim/run-sims.sh 1 200`.
Target bands are the hero deck's win rate: slots 1-3 60-80%, 4-7 45-60%, boss 30-45%.

| Battle | Hero win | Band | Games (timeouts) | Avg turns | Verdict |
|---|---|---|---|---|---|
| 1 The First Summons | 79% (48 games, 4 Nov) | 60-80 | 48 (0) | n/a | top of the band on purpose: see 4 Nov retune |
| 2 The Goblin King's Toll | 82% | 60-80 | 195 (5) | 23.0 | 2 points high, fine for an Easy flying lesson |
| 3 Knights at the Ford | 64% | 60-80 | 200 (0) | 17.0 | in band after the fix below |
| 4 The Djinn of the Bottle | 49% | 45-60 | 200 (0) | 18.4 | in band |
| 5 Argoth Burns | 66% | 45-60 | 179 (21) | 29.6 | high, and 1 game in 10 stalls (Urza's tron deck) |
| 6 The Efreet of Serendib | 45% | 45-60 | 200 (0) | 18.0 | at the floor |
| 7 Factories at Kroog | 62% | 45-60 | 199 (1) | 26.6 | slightly high |
| 8 Mishra's War Machine (boss) | 41.5% | 30-45 | 200 (0) | 23.6 | in band after the 3 Nov retune (was 59%) |
| 9 How Do You Stop This Deck? (secret) | 86.5% | 30-45 | 200 (0) | 15.9 | still too easy after the 3 Nov retune: the CPU can't pilot draw-seven |

Knights at the Ford: the first rebuild (4 Black Knight in place of the dead Deathgrips) left the hero at 50%.
Back to 2 Black Knight and 26 Swamps, which matches the old deck's live cards, and the hero is at 64%.

Outliers for the next pass: the boss (8), the secret boss (9; in the app it runs on the Hard CPU, which these runs don't use),
and Argoth's stalls (5). Each needs a deck change plus a rerun, and a human try on the Hard CPU.

## 3 Nov retune
- Mishra's Army: Dwarven Weaponsmith, Hurloon Minotaur and Atog out; a 4th Mishra's War Machine, 2 more Shatter, 2 Shivan Dragon and 3 Orcish Artillery in. Hero 59% -> 41.5%.
- Usenet Deck: 4 Red Elemental Blast (dead against a white-red loaner) out, 3 Fireball and 1 Disintegrate in. 1993 Power loaner: 2 Serra Angel and 2 Disenchant out, 2 Pearled Unicorn and 2 Plains in. Hero 87% -> 86.5%: the deck isn't the problem.
  Forge's own Hard.ai profile on the boss seat gave the same result. The app's Hard CPU (CardStashy Hard v2, with look-ahead) can't be run here,
  so the real test is a live match on Hard.

## 4 Nov retune (battle 1 only)
- Randall: green felt stronger than white, and the green side has to stay beatable for the villain-side replay and the Both Sides deed. White out: Healing Salve, Holy Strength, 2 War Elephant, 1 Moorish Cavalry. White in: 3 Swords to Plowshares, 4 Mesa Pegasus, 4th Serra Angel and Northern Paladin. Green out: 1 War Mammoth, 3 Craw Wurm, 2 Ironroot Treefolk. Green in: 3 Scryb Sprites + 1, 2 Wall of Wood. Hero 73% -> 79% over 48 games (default AI both seats, seed 1). An earlier, harsher green cut gave 90%, which would make the villain side too hard.
