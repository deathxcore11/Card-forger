export const CPU_CONFIGURATION_VERSION='cpu-config-v3';
export const CPU_DIFFICULTIES=Object.freeze(['Easy','Medium','Hard']);
// Three implemented policies are available for the limited-deck beta.
// Integration still validates the combined entrypoint and owns deployment.
export const CPU_LABELS_READY=true;
export const CPU_PROFILES=Object.freeze({
 Easy:Object.freeze({depth:1,maxNodes:24,maxReplies:4,maxMs:12,planWeight:0,counterWeight:0}),
 Medium:Object.freeze({depth:2,maxNodes:128,maxReplies:24,maxMs:30,planWeight:1,counterWeight:.25}),
 Hard:Object.freeze({depth:3,maxNodes:512,maxReplies:128,maxMs:60,planWeight:1.5,counterWeight:.8})
});
export function cpuProfile(level='Medium'){const p=CPU_PROFILES[level];if(!p)throw Error('INVALID_CPU_DIFFICULTY');return p;}
