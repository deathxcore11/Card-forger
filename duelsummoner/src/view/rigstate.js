// Pure parts of the duelist rig: the clip name map and the state machine. No three.js here, so tests run it in Node.
// ------------------------------------------------------------------ clip names
// canonical name -> real names to try, best first. The right side of FALLBACK is the current Meshy test file.
export const CLIPS = {
  idle_cards: ['idle_cards', 'Idle'], select_fidget: ['select_fidget', 'idle_cards', 'Idle'],
  run: ['run', 'Running'], walk: ['walk', 'Walking'], backpedal: ['backpedal', 'Walk_Backward'], limp_run: ['limp_run', 'Walking'],
  strafe_left: ['strafe_left', 'Quad_Jump_Left', 'Running'], strafe_right: ['strafe_right', 'Running'],
  jump_rise: ['jump_rise', 'Regular_Jump'], jump_apex: ['jump_apex', 'Regular_Jump'], fall_loop: ['fall_loop', 'Fall1'], air_jump: ['air_jump', 'Jump_with_Arms_and_Legs_Open', 'Regular_Jump'],
  land_light: ['land_light', 'Regular_Jump'], land_heavy: ['land_heavy', 'land_light', 'Regular_Jump'],
  dash: ['dash', 'Run_Jump_and_Roll'], slide: ['slide', 'Run_Jump_and_Roll'], dodge_roll: ['dodge_roll', 'Run_Jump_and_Roll'],
  throw_card: ['throw_card'], cast_spell: ['cast_spell', 'summon'], summon: ['summon'], fusion: ['fusion', 'summon'], tribute: ['tribute', 'summon'], taunt: ['taunt', 'victory'],
  hurt: ['hurt'], open_chest: ['open_chest'], shrine_channel: ['shrine_channel'], level_up: ['level_up', 'victory'], victory: ['victory', 'idle_cards', 'Idle'],
  defeat: ['defeat', 'dying_backwards', 'falling_down']
};
// which part of a Regular_Jump-style clip each phase plays (seconds), used only while the real jump_* clips do not exist
export const JUMP_CUT = { jump_rise: [0.0, 0.45], jump_apex: [0.45, 0.8], fall_loop: [0.8, 1.2] };
export const UPPER = /^(Spine|Spine01|Spine02|neck|Head|Left(Shoulder|Arm|ForeArm|Hand)|Right(Shoulder|Arm|ForeArm|Hand))/;   // bone name starts that belong to the upper body

// ------------------------------------------------------------------ state machine (pure: tested without a browser)
// What the base clip should be for this frame. p = the sim's player, g.over / g.won / g.flash as the sim sets them.
export function locomotion(p, g, prev) {
  if (g.over && !g.won) return { clip: 'defeat', loop: false };
  if (g.won) return { clip: 'victory', loop: true };
  if (p.dashT > 0) return { clip: 'dash', loop: false };
  if (p.sliding) return { clip: 'slide', loop: false };
  const sp = Math.hypot(p.vx || 0, p.vz || 0);
  if (!p.grounded) {
    if (prev && prev.airJump) return { clip: 'air_jump', loop: false };
    if (p.vy > 1.5) return { clip: 'jump_rise', loop: false };
    if (p.vy > -2) return { clip: 'jump_apex', loop: false };
    return { clip: 'fall_loop', loop: true };
  }
  if (prev && prev.landT > 0) return { clip: prev.landHeavy ? 'land_heavy' : 'land_light', loop: false };
  if (sp < 0.4) return { clip: 'idle_cards', loop: true };
  if (p.maxHp && p.hp / p.maxHp < 0.25) return { clip: 'limp_run', loop: true, speed: Math.min(1.4, sp / 5) };
  return { clip: sp > 4 ? 'run' : 'walk', loop: true, speed: Math.min(1.5, Math.max(0.5, sp / (sp > 4 ? 9 : 3))) };
}

