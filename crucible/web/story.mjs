// First-pass story scenes for Lost Memories. Original text; placeholder until the owner
// approves the story. Each scene shows once per profile.
export const SCENES = {
  intro: { who: '', lines: [
    'Asterhold burned the night the Hollow King took its memory. You woke at the top of the pyramid with a hammer in your hand and no name to go with it.',
    'One line is scratched into the first door: "Meld what you find. What you make will remember for you." Under it, a name. Vessa the Ashen.',
    'Three floors down. A guardian on each. Every fall costs a Spark, and you carry three.',
  ] },
  'boss:kiln_warden': { who: 'The Kiln Warden', face: 'face-kiln-warden', lines: ['You again. You never remember me, and I never forget you.', 'This floor is my furnace. Bring your own ground if you want it to last.'] },
  'boss:stone_sentinel': { who: 'The Stone Sentinel', face: 'face-stone-sentinel', lines: ['I do not move. I do not lose a tie. Ask the ones who tried.'] },
  'boss:bone_collector': { who: 'The Bone Collector', face: 'face-bone-collector', lines: ['Every monster of yours that breaks, I keep a piece. It keeps me standing.'] },
  'boss:veiled_magus': { who: 'The Veiled Magus', face: 'face-veiled-magus', lines: ['You will not see what I play. You did not see what you lost, either.'] },
  'boss:white_tyrant': { who: 'The White Tyrant', face: 'face-white-tyrant', lines: ['Smaller hands. Smaller hopes. That is my law down here.'] },
  'boss:last_gate': { who: 'The Last Gate', face: 'face-last-gate', lines: ['You have a few turns. Then what waits behind me arrives, and nothing you forged will matter.'] },
  // The first secret (Lab switch `secret`). Words from the Story thread, 21 November 2026. A guardian leaves one memory
  // behind as it falls; the Codex keeps them as rumours (RUMOURS below). None of them states the rule.
  'memory:kiln_warden': { who: 'A memory, as the Kiln Warden falls', face: 'face-kiln-warden', lines: ['The kiln never held a crowd. One vessel, shaped until it was enough.'] },
  'memory:stone_sentinel': { who: 'A memory, as the Stone Sentinel falls', face: 'face-stone-sentinel', lines: ['A single stone was set at the gate. It did not need company to hold.'] },
  'memory:bone_collector': { who: 'A memory, as the Bone Collector falls', face: 'face-bone-collector', lines: ['He gathered everything. The one he could not take was the one standing by itself.'] },
  'memory:veiled_magus': { who: 'A memory, as the Veiled Magus falls', face: 'face-veiled-magus', lines: ['Many veils, and every one hid the same empty room.'] },
  'memory:white_tyrant': { who: 'A memory, as the White Tyrant falls', face: 'face-white-tyrant', lines: ['He ruled the many and was ruled by them. Nobody asked who stood alone.'] },
  'memory:last_gate': { who: 'A memory, as the Last Gate falls', face: 'face-last-gate', lines: ['The gate opens for one. It always did.'] },
  'secret:door': { who: 'The Last One', face: 'face-last-one', lines: ['You found a door that was not there. Good. Few can stand alone long enough to see it.', 'I keep one thing. Show me you can keep one thing too.'] },
  'secret:won': { who: 'The Last One', face: 'face-last-one', lines: ['One was enough. It always was.', 'Take the door; it will not open again.'] },
  'secret:lost': { who: 'The Last One', face: 'face-last-one', lines: ['You still have too many. Come back with fewer.'] },
  cleared: { who: '', lines: [
    'The last door opens on a forge that is still warm. On the anvil lies a hammer exactly like yours.',
    'A memory returns: heat on your face, and someone beside the fire saying your name. You almost hear it.',
    'The pyramid seals behind you. It will be different next time. So will you.',
  ] },
  fell: { who: '', lines: ['The last Spark goes out. The pyramid forgets you, but your Codex does not.'] },
  left: { who: '', lines: ['You climb back toward the light. The pyramid keeps its doors, and you keep what you learned.'] },
};
// What the Codex writes under Rumours. `near` is added once a guardian has fallen to two monsters at most, `met` once
// the door has been seen, `won` once The Last One has been beaten.
export const RUMOURS = {
  near: 'You came close. Two were one too many. The City remembers the one who stood alone.',
  met: 'A guardian fell to one monster that never had company, and where there was only wall, a door stood.',
  won: 'The Last One was the final keeper the City asked to stay, and stayed after everyone else was forgotten. One remembered thing outlasts a crowd of forgotten ones.',
};
