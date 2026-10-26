// UI selection contract for the reviewed native host release. This maps the
// existing setup preference, not deck strength or the separate phase CPU.
// Native host admission still verifies the exact policy/build receipt.
export const FORGE_CPU_POLICIES=Object.freeze({
 Easy:'forge-heuristic-easy-beta-v1',
 Medium:'forge-heuristic-medium-beta-v1',
 Hard:'forge-heuristic-hard-beta-v1',
});
export const FORGE_CPU_DIFFICULTIES=Object.freeze(Object.keys(FORGE_CPU_POLICIES));
export function forgeCpuPolicy(difficulty){
 if(typeof difficulty!=='string'||!Object.hasOwn(FORGE_CPU_POLICIES,difficulty))throw Object.assign(Error('Choose an available CPU difficulty: Easy, Medium or Hard.'),{code:'FORGE_CPU_DIFFICULTY_UNAVAILABLE'});
 return Object.freeze({difficulty,difficultyPolicyVersion:FORGE_CPU_POLICIES[difficulty],label:difficulty+' CPU (experimental beta)'});
}
