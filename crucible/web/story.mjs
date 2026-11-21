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
  cleared: { who: '', lines: [
    'The last door opens on a forge that is still warm. On the anvil lies a hammer exactly like yours.',
    'A memory returns: heat on your face, and someone beside the fire saying your name. You almost hear it.',
    'The pyramid seals behind you. It will be different next time. So will you.',
  ] },
  fell: { who: '', lines: ['The last Spark goes out. The pyramid forgets you, but your Codex does not.'] },
  left: { who: '', lines: ['You climb back toward the light. The pyramid keeps its doors, and you keep what you learned.'] },
};
