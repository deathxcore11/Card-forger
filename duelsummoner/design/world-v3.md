# World v3: a desert sculpted like a skatepark made of wind (Randall, 27 Nov 2026, 6:04 PM ET)

The goal is for surfing across the map to feel incredible on its own. That means no aimless lumpy noise with props sprinkled on top. Moving across the world comes first.

## 1. Terrain: wind-carved, not random

- **One wind per run.** Each seed picks a direction and the whole map flows with it. Dunes are long ridges running across that wind, not round bumps.
- **The real dune shape.** The windward side is long and gentle, so you carve up it and build speed. The crest is sharp. The leeward slip face is steep (about 30 to 34 degrees) and drops into a fast downhill. Carve up the long side, launch off the crest, ride the steep face down. Every crest has a clean landing slope.
- **Dry riverbeds.** Two or three wide, curving channels per stage act as natural half-pipes. You drop in, pump wall to wall doing tricks, and shoot out the far end at top speed.
- **The kill bowl is a natural basin.** A wind-scoured hollow with banked sides is the bowl. It is not a placed object. The quarter pipes are its walls.
- **About 70% open sand.** Sightlines stay clear. Monumental silhouettes, visible from 300 m, anchor the horizon: a tilted stone card spire, a half-buried ribcage of stone arches, a sunken gate.
- **Landmarks are navigation.** One kind of landmark points to the boss arena, another frames the portal when it opens, and odd ones mark secrets. Secrets hide behind dune crests and inside ruins, so speed and air are how you find them.

## 2. Ruins are the skatepark

Avoid a plain ramp on flat sand when a ruin can be the ramp.

- **Half-buried stone cards** at 30 to 45 degrees. Ride up the face to launch, wall ride the flat side, or grind the gold edge across a pack of husks.
- **Broken aqueducts and beams.** Long grind lines that curve over a dune bowl, so a line can chain Grind, Ollie, Wallride off a mesa, then Slam Drop into a horde.
- **Stepped sandstone ruins** jutting at bold angles. Their hard geometry contrasts with the smooth dunes, like a sunken city of duelists.

## 3. Light and colour (voxel, not realistic)

- **Warm sun, cool shadow.** Sunlit sand is rich golden peach. Shadow sides of dunes are dusty violet or warm indigo, never grey or black. This contrast is most of the beauty.
- **Sand glint.** Tiny gold-white sparkles twinkle on sunlit faces as the camera moves. Keep them subtle and cheap.
- **Fog by stage:**
  - Stage 1, morning: warm gold haze.
  - Stage 2, evening: burnt orange and rose.
  - Stage 3, night: deep starry indigo, where summons' attacks and the card trail are the main lights.
- Wind-blown sand drifts across the screen in thin streams.

## 4. Sand-surfing juice

- **Downhill rush.** Riding down a steep face speeds the card up. The camera pulls back slightly, the field of view widens a touch, and the duelist's scarf or cloth whips back.
- **Carve trail.** The card leaves a faint sunken ribbon in the sand that fades over about 5 s. Hard carves and powerslides throw a rooster tail of voxel sand cubes.
- **Sound.** A sand hiss rises in volume and pitch with speed, then cuts to near silence for a beat when you launch off a crest. The sound thread makes it.

## 5. The other biomes get the same idea

- **Ashen Orchard:** ash drifts shaped by one wind. Fallen trunks are grind lines, terraced orchard rows are step-downs, and a burnt-out irrigation channel is the riverbed half-pipe.
- **Frostbound Archive:** snow drifts with wind crests. Fallen shelves and frozen aqueducts are grind lines, ice sheets are fast flats, and a frozen stream bed is the half-pipe.

Each biome keeps: one wind per run, about 70% open ground, riverbed half-pipes, a natural basin as the kill bowl, landmarks that navigate, ruins as the park, and a warm-and-cool light pair of its own.

## Hand-offs

- **Asset tool (roster thread):** landmark silhouettes, stone cards, aqueduct and beam sections, stepped ruins, plus biome dressing for all three biomes. Use EWV3 v2 with kind, footprint and ride-surface data in index.json.
- **Sound thread:** the sand hiss and the air cut-out, plus ash and snow versions.
- **Build:** terrain, light, fog and juice, measured in the sim. Every crest launches to a clean landing. Report speed gained down a face and time spent on the card across a full stage.

## 6. Setpieces stamped into seeded sand (Randall, 6:10 PM ET)

Pure random scatter is why the map looks junky. Replace it with hand-built setpieces stamped into a clean, seeded landscape.

- **A library, not five.** About 15 to 20 hand-tuned setpieces per biome, each with 2 or 3 internal variants. Each seed picks 5 to 8 of them: one central landmark plus a rough ring of outer pieces, at well-spaced spots with varied rotation. Desert examples:
  - Sunken Aqueduct: a row of broken arches with one long, wide grind rail through it and a launch at each end.
  - Card-Tomb Bowl: a sunken round basin ringed by tilted stone cards to launch off and wall ride. This can be the kill bowl.
  - Great Spine: a long wind ridge under a buried stone ribcage, for downhill speed and big air.
  - Ruined Plaza: temple steps, shrines and wide ledges, with clear sightlines for elite fights.
  - Spire Oasis: the colossal tilted card spire in a shallow valley, the map's compass.
  - Also: a riverbed with fallen beams, a sunken gate, a stepped mesa climb, a dune slalom of half-buried cards, and so on.
- **The ground molds to the setpiece.** Before placing a piece, blend the heightmap to its base height with a wide soft skirt. Every lip, rail and ruin then sits flush with the sand. Nothing floats or half-buries. Test every setpiece by riding it (ramps 20 of 20), then it is trusted on every seed.
- **Surf highways between them.** Only smooth, low-frequency wind dunes and worn sand paths linking the setpieces in a loop. Nothing stands in the middle of nowhere: anything seen on the horizon is worth surfing to.
- **One open arena.** Setpieces sit inside open sand. They are never rooms, walls or districts (standing rule).
- **Cut clutter by about 70%.** Delete tiny rocks and scattered junk, and make landmarks about 3 times bigger, so they silhouette against the fog.
- **Palette.** Golden peach sand, sun-bleached sandstone and dusty violet shadow lead. Other colours are allowed, but this trio guides everything.
- **The asset tool builds setpieces** as composed kits (pieces plus a footprint and base height in index.json). Each stage biome gets its own library.

## 7. Vast, bounded, and built to the horizon (Randall, 27 Nov, 6:30 PM ET)

Generated, not bespoke. The hybrid in section 6 stays the plan: seeded wind terrain gives every run a new map, and the hand-built setpiece library makes it feel designed. Bespoke maps would be memorised in a week; pure noise feels junky. This keeps both strengths.

### Edges
- The map is about 720 m across, ringed by an impassable mountain range (already in code: `EDGE_R` in src/gen/open/terrain.js). This replaces the 23 Nov "no edge wall" rule: the edge is a natural wall, never a fence or an invisible stop.
- The range is part of the look: tall themed silhouettes, layered in 2 or 3 depth bands, fading into the stage fog. Near the foot it rises as a steep, rideable bank (a giant quarter pipe) that turns you back in, so touching the edge is a trick, not a dead stop.
- One or two passes in the range are closed gates with a structure behind them. They are reserved for secrets and the stage boss's entrance later.

### Horizon structures (themed per map)
Two tiers, both made in the asset tool as voxel kits.
- **Far silhouettes** (300 to 1,500 m away, outside or on the range): huge, simple shapes that only need to read in fog. They never collide. They are cheap: one low-detail mesh each, no props. 3 to 5 per seed, picked from the map's list.
- **Compounds** (inside the arena): the section 6 setpieces, scaled so their tallest part is visible from 300 m. Anything seen on the horizon inside the range can be reached and ridden.

Desert (the beta map):
- Far: a colossal tilted stone card spire, a half-buried ribcage of stone arches, a sunken gate, a broken colossus head, a terraced mesa city in the range, and a long aqueduct running off into the dunes.
- Compounds: Sunken Aqueduct, Card-Tomb Bowl, Great Spine, Ruined Plaza, Spire Oasis, Fallen Beam Riverbed, Sunken Gate, Stepped Mesa Climb, Card Slalom, Seal Shrine Ring, Buried Arena (an old dueling floor, half in the sand), Obelisk Field, Caravan Wreck (giant stone cart), Lighthouse of Cards (a stacked card tower), and Duelist's Tomb (a stepped pyramid with a rail spiral).
- Every other element map gets its own list of 15 to 20 compounds and 5 or 6 far silhouettes in the same shape, written by the roster thread into Library duel-summoner/ and logged in its README.

### Movement: carve, charge, launch
The world is built like a big snowy mountain run in sand. Every slope is speed, and every crest is a jump.
- **Slope speed.** Riding downhill builds speed (a stronger gravity pull along the slope), and riding up spends it. There is no flat top speed: the fastest you go is at the bottom of a long face.
- **Crouch charge.** Hold ollie while riding to crouch. Charge builds over 0.6 s and holds there. Crouching also tucks you, adding a little downhill speed.
- **Lip boost.** Release ollie at a lip or crest for a boosted launch. A launch inside the last 0.15 s before the lip is a Perfect Pop: a gold flash, extra height and a Flow bonus. Height is the pop charge plus the speed you carried up the face, so a long downhill into a big crest sends you highest.
- **Air control.** In the air, the stick tilts the card a little (pre-rotation for landing) and picks the trick. Landing on a downslope, aligned with it, keeps all your speed. Landing flat or crooked bleeds some speed, but never bails you on a normal landing.
- **Boost meter.** Landed tricks fill a short boost (Shift). It is the reward for style, and it is how you cross flat ground fast.
- Every crest has a clean landing slope (section 1), and every compound has a run-in and a run-out, so a line flows: downhill, charge, lip, trick, land on the next downslope.

### The boss comes to you
Unchanged: at time-out the stage boss hunts you across open sand. Its approach is visible from far off (a dust plume and a horizon silhouette), so you can choose your ground, ideally the kill bowl.
