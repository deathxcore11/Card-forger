# Kael: motion prompts for Meshy Text to Motion

Checked 22 Nov 2026, 6:10 PM ET: duelist-kael-anim.glb, 2,312 triangles, 44-bone humanoid rig, 1.87 m tall, 19 clips.

## What you already have that works

| Game move | Use this clip |
|---|---|
| Idle (fallback) | Idle |
| Run | Running |
| Walk | Walking |
| Backpedal | Walk_Backward |
| Jump | Regular_Jump (I cut it into rise, apex and fall in code) |
| Running jump | Jump_Run |
| Dash (stand-in) | Run_Jump_and_Roll |
| Defeat | dying_backwards (falling_down and Shot_and_Fall_Backward are spares) |

These are not needed and can be deleted to keep the file small: Lie_Back_Leg_Swing, Fall_from_Bar, Quad_Jump_Left, Walk_Backward_with_Sword_inplace, Jump_and_Grab_Wall, Jump_with_Arms_and_Legs_Open. Fall1 is a skydiving pose, so it doesn't work for a short fall.

## How to make each one

1. Open Kael in Meshy, then go to Animate and choose Text to Motion.
2. Paste one prompt below. Set **Name** to the exact name given, and set **Duration** to the seconds given.
3. Use the **Motion Prime** model. Press Generate (10 credits each) and check it. If it looks off, generate once more and keep the better one. Then press **Add to Character**.
4. When all are added, download the GLB with every clip as `duelist-kael-anim.glb` and save it in `app art\DS\3d`.

The rules for every clip:
- It stays in place, with no walking off the spot. The game moves the body.
- A clip that loops starts and ends in the same pose.
- Keep action clips short (as listed). A long duration comes out in slow motion.

## Prompts (24 clips, about 240 credits)

**Must have first (12):**

1. **idle_cards** (4 s, loops): A young card duelist stands relaxed and confident in place, holding a fan of five playing cards in his left hand at chest height. He breathes slowly, shifts his weight gently from foot to foot, and glances side to side. He stays in place and ends in the starting pose so it loops.
2. **strafe_left** (0.8 s, loops): A young man jogs sideways to his left in place, facing forward the whole time, with quick side steps and his arms loose and ready. He stays in place and ends in the starting pose so it loops.
3. **strafe_right** (0.8 s, loops): A young man jogs sideways to his right in place, facing forward the whole time, with quick side steps and his arms loose and ready. He stays in place and ends in the starting pose so it loops.
4. **land_light** (0.5 s): A young man lands on both feet from a small jump, bends his knees softly to absorb it, then rises straight back to a ready stance, in place.
5. **land_heavy** (0.9 s): A young man drops from a great height and lands hard in a deep crouch with one hand touching the ground, pauses for a beat, then pushes himself back up to standing, in place.
6. **dash** (0.4 s): A young man bursts forward in a fast low lunge, his body leaning hard forward and his arms swept back, then snaps upright again. Very quick and snappy. The feet stay on the spot.
7. **slide** (0.8 s): A young man drops into a baseball-style slide in place: he leans back with one leg stretched forward and the other bent under him, one hand trailing near the ground, holds it, then springs back up to a run pose.
8. **throw_card** (0.5 s, upper body): A young man flicks a playing card forward with his right hand in a fast sidearm throw, from a wrist cocked near his left hip out to an extended arm, then recovers. Only his upper body moves and his legs stay still.
9. **summon** (1.2 s): A young man slaps a playing card down toward the ground in front of him with his right hand, then sweeps his arm upward as if raising something huge from the ground. Big and dramatic, in place.
10. **hurt** (0.4 s): A young man flinches sharply from a hit to the chest, his head and shoulders snapping back, one arm coming up to guard, then he recovers to standing in place.
11. **open_chest** (1.5 s): A young man kneels on one knee, reaches forward with both hands, lifts a heavy lid upward and pushes it open, then leans back in surprise, in place.
12. **victory** (2.5 s): A young man punches one fist up into the air in triumph, then holds a fan of playing cards up high with a big confident grin, in place.

**Then (12):**

13. **fusion** (1.6 s): A young man raises both arms overhead and clasps his hands together, palms joined, leaning back slightly as if channelling power upward, then holds the pose, in place.
14. **tribute** (1.4 s): A young man places his right hand flat over his heart, bows his head solemnly, then opens his arm outward as if letting something go, in place.
15. **shrine_channel** (3 s, loops): A young man stands with both palms held forward at chest height, fingers spread, as if pushing energy into a glowing stone. His body trembles slightly with effort. He stays in place and ends in the starting pose so it loops.
16. **level_up** (1.2 s): A young man spins once in place, then strikes a sharp pose with a card held up between two fingers beside his face, in place.
17. **air_jump** (0.6 s): A young man does a forward flip in mid-air with his knees tucked, then opens out again, as a second jump in the air. He stays on the spot.
18. **fall_loop** (0.8 s, loops): A young man falls through the air in place, his arms raised a little for balance and his legs slightly bent, kicking gently. He ends in the starting pose so it loops.
19. **limp_run** (0.8 s, loops): A hurt young man jogs in place with a limp, clutching his side with his left hand and favouring one leg, tired but still moving. He ends in the starting pose so it loops.
20. **select_fidget** (3 s): A confident young man on a character-select screen shuffles a deck of cards between his hands, then flips the top card toward the viewer with a smirk, in place.
21. **defeat** (2.5 s): A young man drops to his knees, his playing cards slipping from his hand and scattering, then slumps forward onto his hands, exhausted, in place.
22. **dodge_roll** (0.7 s): A young man does a quick forward shoulder roll and comes back up to a crouched ready stance, on the spot.
23. **taunt** (1.5 s): A young man points straight forward at an enemy, then beckons with two fingers, "come on", in place.
24. **cast_spell** (0.9 s): A young man holds a glowing card up in front of him with both hands, pushes it forward with a strong thrust, then recovers, in place.
