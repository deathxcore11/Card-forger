// The live release has one CPU policy. Keep the admitted policy identity stable
// while reserving additional levels for a later, tested release.
export const FORGE_CPU_POLICIES=Object.freeze({
 Medium:'forge-heuristic-medium-beta-v1',
});
export const FORGE_CPU_DIFFICULTIES=Object.freeze(['Medium']);
export function forgeCpuPolicy(difficulty='Medium'){
 if(difficulty!=='Medium')throw Object.assign(Error('This release uses the normal CPU opponent. Return to Play setup to start a new match.'),{code:'FORGE_CPU_DIFFICULTY_UNAVAILABLE'});
 return Object.freeze({difficulty:'Medium',difficultyPolicyVersion:FORGE_CPU_POLICIES.Medium,label:'CPU'});
}
