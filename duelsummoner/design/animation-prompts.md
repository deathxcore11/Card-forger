# Duelist animation prompts (Meshy "Text to Motion")

How to use: open the rigged character, choose **Text to Motion**, set AI Model **Motion Prime**, paste the prompt, type the **Name** exactly as in the first column, set the **Duration**, press Generate, then **Add to Character**. When all are added, export one GLB **with animations** as `duelist-kael-anim.glb`. The game plays every clip in place and moves the duelist itself, so every prompt says "in place". The prompt box holds 400 characters; each one below fits.

Rules that apply to every prompt: the character stays at the same spot (no walking away), faces forward, starts and ends in the same pose when the clip loops, no props (the cards are added by the game).

## Already in your file (tested 22 Nov 2026)

| Clip in the file | Used for | Note |
|---|---|---|
| Idle (4.0 s) | idle | in place, good |
| Running (0.63 s) | run | in place, loops, good |
| Walking (1.03 s) | slow walk, menus | in place |
| Walk_Backward (0.87 s) | backpedal | travels 1 m, the game removes that |
| Regular_Jump (1.87 s) | jump rise, apex, fall | in place, I cut it into three parts |
| Jump_Run (2.0 s) | jump while running | in place |
| Fall1 (4.5 s) | falling loop | in place |
| Run_Jump_and_Roll (3.4 s) | dodge roll, stand-in for dash | travels 3.6 m, the game removes that |
| Quad_Jump_Left (1.5 s) | side hop, stand-in for strafe step | travels 1.2 m |
| dying_backwards (2.2 s), Fall_Dead_from_Abdominal_Injury (3.5 s), Shot_and_Fall_Backward (3.5 s), falling_down (2.3 s) | defeat | any of them, I pick one per death cause |
| Jump_with_Arms_and_Legs_Open (2.5 s) | star jump, air-jump stand-in | in place |
| Back_Jump (0.9 s) | back hop, stand-in for dash back | travels 2 m |
| Jump_and_Grab_Wall, Fall_from_Bar, Lie_Back_Leg_Swing, Walk_Backward_with_Sword_inplace, Fall_Dead… | not needed now | wall grab may be used for ledges later |

## Still to make (18), with the exact prompt

| Name | Seconds | Loops | Prompt |
|---|---|---|---|
| idle-fidget | 4 | yes | A young duelist standing in place fans a hand of playing cards, shuffles them from one hand to the other, then looks around with a small confident grin and rolls their shoulders. Relaxed, playful. Stays in place, facing forward, ends in the starting pose. |
| strafe-left | 1 | yes | A character sidesteps to their left in place with quick small steps, shoulders and head still facing forward, knees bent, ready to fight. Stays in the same spot. Loops smoothly. |
| strafe-right | 1 | yes | A character sidesteps to their right in place with quick small steps, shoulders and head still facing forward, knees bent, ready to fight. Stays in the same spot. Loops smoothly. |
| land-light | 0.6 | no | A character lands from a short jump onto both feet, knees bend a little to absorb it, then stands back up quickly. In place, forward facing. |
| land-heavy | 1 | no | A character drops from a high fall and lands hard in a crouch with one hand touching the ground, knees deeply bent, a small shake, then rises slowly to standing. In place, forward facing. |
| air-jump | 0.8 | no | A character in mid-air does a second jump: tucks both knees up, spins once around quickly with arms pulled in, then spreads arms and legs to fall. All in place in the air, no ground contact. |
| dash | 0.5 | no | A character does a fast dash forward: leans hard into it, one arm swept back, legs stretched wide in a sprint stride, then snaps upright. In place, no travel, forward facing. |
| slide | 0.9 | no | A character drops into a low feet-first slide: leans back, one leg extended forward, one knee bent, one hand trailing along the ground, holds the pose, then pushes up to standing. In place, no travel. |
| throw-card | 0.6 | no | A character throws a playing card with a quick flick of the right wrist: right arm cocks back beside the shoulder then whips forward and snaps to a stop, left hand out for balance. Upper body only, feet stay planted. Forward facing. |
| summon | 2 | no | A character summons a creature: raises one hand holding a card high, the other hand sweeps down toward the ground, a deep breath and a confident look, then the hand slams down to the floor. Dramatic, heroic. In place, forward facing. |
| fusion | 2.5 | no | A character performs a powerful fusion: both hands start out to the sides, swing in and join together high over the head, hold with the whole body tense and leaning back, then thrust both hands forward. Epic. In place, forward facing. |
| tribute | 1.5 | no | A character offers a sacrifice: bows the head, lifts both open palms in front of the chest, then slowly pushes them forward and lets go, solemn and sad. In place, forward facing. |
| hurt | 0.5 | no | A character is hit from the front: the upper body snaps back, one arm flings out, the head jerks, one knee buckles, then recovers to a guarded stance. In place, forward facing. |
| limp | 1.2 | yes | A badly hurt character stands and stumbles in place: hunched over, one hand pressed to the side of the stomach, weight shifting heavily from foot to foot, breathing hard. Loops smoothly, stays in place. |
| chest-open | 1.8 | no | A character kneels down on one knee in front of a treasure chest, opens the lid with both hands, looks inside with wide eyes, then stands and raises a fist in joy. In place, forward facing. |
| shrine-channel | 3 | yes | A character stands with feet apart and both arms stretched out to the sides, palms up, head tilted back, the whole body trembling slightly as if absorbing power. Loops smoothly, stays in place. |
| level-up | 1.2 | no | A character crouches low, then springs up with both fists pumping into the air, head back in a shout of triumph, then settles with a proud grin. In place, forward facing. |
| victory | 3 | yes | A character celebrates a win: raises one arm holding a card high, shakes it, turns slowly to show off, grins with pride, then crosses both arms and nods. In place, loops, forward facing. |

To save credits, `victory` and `level-up` can share one clip (use `victory` for both), which makes it 17.

## Tips from the test

- Ask for "in place" every time. In the test file 5 of 19 clips drift a metre or more, which I can remove, but clips that really stay put look cleaner.
- Keep the duration short for single actions (hurt 0.5 s, throw 0.6 s) so they feel snappy; long durations get slow-motion.
- Generate each twice if the first one looks floaty and keep the better one.
- You do not need a different character file for each clip: add them all to the same character and export once.
