# Map themes v1: every map, biome and time of day is its own place (Randall, 27 Nov 2026, 7:10 PM ET)

Randall: every map, biome and time of day must be unique to its theme, with its own themed structures and enemies. Don't hold back.

Locked earlier tonight: 8 maps, one per element, each a run of 3 stages (morning, evening, night, 12 min each), with Easy, Medium and Hard per map. A rival duelist rides every stage.

## The rule

The generator holds **no theme in code**. One data entry per map drives everything, and each time of day overrides part of it. Two seeds of one map differ clearly. Two maps should never be mistaken for each other in a single screenshot, even with the HUD off. The same goes for morning, evening and night of one map.

## The theme entry (src/data/themes.js)

```
map: {
  id, element, name,
  ground:   { material: sand | ash | snow | ..., colours: [lit, mid, shade], glint },
  wind:     { strength, ripple, drift: what blows (sand, ash, snow, spores, embers...) },
  landform: { style: dunes | terraces | drifts | canyons | basins | ..., ridgeScale, slipFace, riverbeds: 2..3, basinKillBowl },
  edge:     { range: mesas | cliffs | ice walls | ..., bankStyle },
  setpieces: [15..20 compound ids],      // 5..8 per seed, one central
  far:       [5..6 silhouette ids],      // 3..5 per seed
  dressing:  [small kit ids, ~70% less than today],
  enemies:   { swarm: [ids], elite: [ids], ace: [ids], bosses: [4 ids] },
  rival:     [rival ids from codex/rivals-v1.json],
  music, ambience, sting,                 // from the sound pack (MU*, AM_*, MP*)
  times: {
    morning: { sun, sky, fog, light: [warm, cool], extras },
    evening: { ... },
    night:   { ..., lights: the summons and the card trail lead, plus the map's own glow },
  }
}
```

A time of day can also swap part of the cast or the set dressing. For example, at night the desert's Dust Husks become Grave Husks with glowing eyes, scorpion elites come out, and the shrines light up. A run's stage 1, 2 and 3 use the map's morning, evening and night entries.

## Desert (earth, the beta map), filled in

- **Ground:** golden peach sand, sun-bleached sandstone and dusty violet shade, with a gold glint.
- **Wind:** one direction per seed. Sand streams blow across the ground.
- **Landform:**
  - Long wind dunes with steep slip faces.
  - 2 or 3 dry riverbeds.
  - A scoured basin for the kill bowl.
  - Mesas at the edge.
- **Edge:** a terraced mesa range, whose foot is a 12 m bank.
- **Compounds:** Sunken Aqueduct, Card-Tomb Bowl, Great Spine, Ruined Plaza, Spire Oasis, Fallen Beam Riverbed, Sunken Gate, Stepped Mesa Climb, Card Slalom, Seal Shrine Ring, Buried Arena, Obelisk Field, Caravan Wreck, Lighthouse of Cards and Duelist's Tomb.
- **Far:** card spire, stone ribcage, sunken gate, colossus head, mesa city and the endless aqueduct.
- **Enemies:**
  - Swarm: Dust Husks, Sand Skitters (fast, they cut you off) and Shard Bats (flying).
  - Elites: Dune Golem (charges downhill, slow uphill), Glass Scorpion (shoots a lead line) and Mirage Caster (feints copies).
  - Night swap: Grave Husks, Sand Wraiths (they come out of the sand on your line) and Lantern Scorpions.
- **Bosses:** the Stone Arbiter, plus 3 more from the 12-boss plan.
- **Times of day:**
  - Morning: low gold sun and gold haze. Long violet shadows.
  - Evening: a burnt orange and rose sky, the sun behind the far silhouettes, rim-lit dune crests.
  - Night: deep starry indigo, a big moon, shrine fires and blue sand glint. Summons, the card trail and enemy eyes are the main lights.

## The other 7 maps

The block roster thread writes each map in this exact shape into Library duel-summoner/ and logs it in the README: its ground, wind, landform style, edge range, 15 to 20 compounds, 5 or 6 far silhouettes, enemies (swarm, elite, ace, night swaps) and 3 times of day. They must differ in all of these at once, not only in colour.
- **Landform** changes how the map rides. For example, ash terraces give step-downs, snow drifts give long powder runs, and canyons give half-pipes.
- **Enemy behaviour** changes how it plays. Each map gets at least one swarm and one elite behaviour that no other map has.

## Checks

For each map, show 2 seeds by 3 times of day, from the play camera with the HUD off.
- The six pictures of one map must read as one place, with each time of day clearly its own.
- Put the 8 maps side by side, and none may look like another.
- Bots ride every map: crests launch, the kill bowl and riverbeds are reachable, and frames stay inside 8.3 ms.
