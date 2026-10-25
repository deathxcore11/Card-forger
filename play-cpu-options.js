// Match the delivered CPU implementation. Shared preflight still owns admission.
import {CPU_CONFIGURATION_VERSION,CPU_DIFFICULTIES,CPU_LABELS_READY} from './experiments/phase-engine/cpu-difficulty-config.mjs';
export function readCpuOptions(){
 if(CPU_CONFIGURATION_VERSION!=='cpu-config-v3'||!Array.isArray(CPU_DIFFICULTIES))return ['Medium'];
 return ['Easy','Medium','Hard'].filter(level=>CPU_DIFFICULTIES.includes(level)&&(CPU_LABELS_READY===true||level==='Medium'));
}
