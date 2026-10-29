// Forge's three CPU levels. Quick Play always uses Normal (Medium); Practice lets the
// player choose. Medium keeps its admitted v1 identity; Easy and Hard are the v2 tunings.
export const FORGE_CPU_POLICIES=Object.freeze({
 Easy:'forge-heuristic-easy-beta-v2',
 Medium:'forge-heuristic-medium-beta-v1',
 Hard:'forge-heuristic-hard-beta-v2',
});
export const FORGE_CPU_DIFFICULTIES=Object.freeze(['Easy','Medium','Hard']);
export const FORGE_CPU_LABELS=Object.freeze({Easy:'Easy',Medium:'Normal',Hard:'Hard'});
export const forgeMatchDifficulty=setup=>setup?.playStyle==='quick'?'Medium':setup?.match?.difficulty??'Medium';
export function forgeCpuPolicy(difficulty='Medium'){
 if(!FORGE_CPU_DIFFICULTIES.includes(difficulty))throw Object.assign(Error('Choose Easy, Normal or Hard in Play setup to start a new match.'),{code:'FORGE_CPU_DIFFICULTY_UNAVAILABLE'});
 return Object.freeze({difficulty,difficultyPolicyVersion:FORGE_CPU_POLICIES[difficulty],label:difficulty==='Medium'?'CPU':'CPU · '+FORGE_CPU_LABELS[difficulty]});
}
