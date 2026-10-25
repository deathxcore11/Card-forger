import {chooseCpu} from './cpu-public-policy.mjs';
globalThis.onmessage=({data})=>{
 try{postMessage({id:data.id,...chooseCpu(data.packet,data.rng)});}
 catch{postMessage({id:data?.id,error:'CPU_DECISION_UNSUPPORTED'});}
};
