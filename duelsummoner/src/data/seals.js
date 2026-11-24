// Oath seals: every Oath starts SEALED. Breaking a seal means doing its feat in a normal run (a full run with no Oath sworn). One table, so the feats can change in one place.
// riddle: the one line shown on the sealed slot (a hint only); feat: the plain words, shown once the seal is broken; the check lives in sim/seals.js under the same id.
export const SEALS = {
  glass:  { riddle: 'Walk the last stretch of a stage untouched.', feat: 'Clear a stage taking no damage in its last 3 minutes.' },
  hasty:  { riddle: 'The gate does not like to be kept waiting.', feat: 'Wake the gate before 3:00 and defeat its boss.' },
  small:  { riddle: 'Topple the gate while your first friend is still small.', feat: 'Defeat a gate boss after 3:00 of the stage while your starting summon is still level 1.' },
  still:  { riddle: 'A stage crossed on feet that never dash.', feat: 'Clear a stage of at least 6:00 without dashing once.' },
  blind:  { riddle: 'Know the land without unrolling the map.', feat: 'Finish a stage of at least 6:00 without opening the full map.' },
  pauper: { riddle: 'Leave every coin where it lies.', feat: 'Clear a stage of at least 6:00 spending 0 coins.' },
  swift:  { riddle: 'Three stages before the sand runs out.', feat: 'Clear all 3 stages in under 25 minutes (the Oath itself still asks for 20).' },
  peace:  { riddle: 'Let your friends do the killing.', feat: 'Your summons land 300 kills before you land 50 yourself in one run.' }
};
export const SEAL_LIMITS = { glassSeconds: 180, hastySeconds: 180, swiftSeconds: 1500, peaceSummonKills: 300, peaceHandKills: 50, minStageSeconds: 360, smallMinSeconds: 180, maxPerClear: 2 };       // Still, Blind and Pauper need a stage of at least 6:00; Small needs the boss felled after 3:00; at most two seals break from one stage clear
