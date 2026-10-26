// Match the delivered CPU implementation. Shared preflight still owns admission.
import {CPU_CONFIGURATION_VERSION,CPU_DIFFICULTIES,CPU_LABELS_READY} from './experiments/phase-engine/cpu-difficulty-config.mjs';
import {FORGE_CPU_DIFFICULTIES} from './play-forge-cpu-policy.js';
export function readCpuOptions({engine='phase'}={}){
 if(engine==='forge')return [...FORGE_CPU_DIFFICULTIES];
 if(CPU_CONFIGURATION_VERSION!=='cpu-config-v3'||!Array.isArray(CPU_DIFFICULTIES))return ['Medium'];
 return ['Easy','Medium','Hard'].filter(level=>CPU_DIFFICULTIES.includes(level)&&(CPU_LABELS_READY===true||level==='Medium'));
}
