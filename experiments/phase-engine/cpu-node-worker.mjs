// Node test bridge for the exact production policy worker; no engine in this worker.
import {Worker} from 'node:worker_threads';
export function nodePolicyWorker(){
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.postMessage=data=>parentPort.postMessage(data);import(${JSON.stringify(new URL('./cpu-public-worker.mjs',import.meta.url).href)}).then(()=>parentPort.on('message',data=>globalThis.onmessage({data})));`,{eval:true});
 const listeners=new Map();
 return {postMessage:data=>worker.postMessage(data),terminate:()=>worker.terminate(),
  addEventListener(type,fn){const listener=type==='message'?data=>fn({data}):fn;listeners.set(fn,listener);worker.on(type,listener);},
  removeEventListener(type,fn){const listener=listeners.get(fn);if(listener)worker.off(type,listener);listeners.delete(fn);}};
}
