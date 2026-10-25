import {chooseVisible} from './visible-cpu-policy.mjs';
globalThis.onmessage=({data})=>{try{postMessage({id:data.id,...chooseVisible(data.packet,data.rng)});}catch{postMessage({id:data?.id,error:'CPU_DECISION_UNSUPPORTED'});}};
