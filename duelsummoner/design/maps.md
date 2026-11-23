# Maps


## Maps (decided 23 Nov)

| Map | Name | Stage id in data | State |
|---|---|---|---|
| 1 | Surface Ruins | ruins | built |
| 2 | Ashen Orchard | catacombs (id kept) | name only; content not built (the earlier catacomb content is a stand-in) |
| 3 | Frostbound Archive | vault (id kept) | name only; content not built |

Map 2 is no longer undecided. Anything in this folder that calls map 2 the Ashen Orchard, or map 3 the Frostbound Archive, uses the old working names.



## Designed generator (v2) in the game: what is built and what is content to build

Built: the heightfield maps (tiers, cliffs with rock strata, ramps, pits), the spine route as the road, spawn, gate, boss rings, encounters of the kinds the game has (Witness Stone, Relic Broker, Shrine of Tribute, Altar of Tribute, Card Chest and Wrapped Mimic as a chest, vases), a free chest near the spawn, the kit pieces and hero landmarks drawn from the generator's data (about 30 shapes in view/mapMesh.js), a start heading chosen from the map (view/startview.js), the minimap and big map from the heights with the existing fog of war, the next stage built while an offer is open.

Content to build (the generator places them, the game drops them today): Duel Statue, Deck Anvil, Magnet Tablet, Bone Oath, Scales Court, Broken Covenant, Golden Statue, Sealed Fragment, Echo Forge, Second Seal. The side-quest layer of generator-spec 18.2 (each pocket with one authored quest: Lost Relic on a pillar top, timed coin line, caged summon, sealed urn, Ace den, Duel Statue challenge) is not built: the pockets exist as parkour reward spots that hold a chest, stone or altar.

Not built in the view: summoning pools on the new maps, blending between tiers, the chunk landmark meshes beyond the ~30 box-built shapes, water.
