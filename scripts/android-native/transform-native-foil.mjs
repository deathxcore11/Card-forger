// Applied only to the packaged Android copy; the reviewed shared source stays untouched.
const originalLoop = `const handles=new Set();let ticking=0,lastSweep=0;
function tick(now=0){ticking=0;let again=false,sweeping=0;for(const h of handles)if(h.animated())sweeping++;
 const sweep=now-lastSweep>=(sweeping>12?64:32);if(sweep)lastSweep=now;
 for(const h of handles){const anim=h.animated();if(anim)again=true;if(!anim||sweep)h.draw();}
 if(again)ticking=requestAnimationFrame(tick);}
export const foilLoop={
 add(h){handles.add(h);},delete(h){handles.delete(h);},
 kick(){if(!ticking&&typeof requestAnimationFrame!=='undefined')ticking=requestAnimationFrame(tick);}
};`;

const nativeLoop = `
// Native lifecycle pauses scheduling, never disposes mounted foils or card records.
function createNativeFoilLoop(){
 const mounted=new Set();let pending=null,generation=0,lastSweep=0;
 let paused=globalThis.document?.documentElement?.dataset?.nativeAppState==='background';
 const cancel=()=>{generation++;if(pending!==null&&typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(pending);pending=null;};
 const schedule=()=>{
  if(paused||pending!==null||!mounted.size||typeof requestAnimationFrame==='undefined')return;
  const token=++generation;
  pending=requestAnimationFrame(now=>{
   if(token!==generation)return;
   pending=null;if(paused||!mounted.size)return;
   let again=false,sweeping=0;for(const h of mounted)if(h.animated())sweeping++;
   const sweep=now-lastSweep>=(sweeping>12?64:32);if(sweep)lastSweep=now;
   for(const h of mounted){if(paused)break;const anim=h.animated();if(anim)again=true;if(!anim||sweep)h.draw();}
   if(again)schedule();
  });
 };
 globalThis.addEventListener?.('cardstashy-native-lifecycle',event=>{
  const state=event.detail?.state;
  if(state==='background'){paused=true;cancel();}
  else if(state==='foreground'){paused=false;lastSweep=-Infinity;schedule();}
  // Memory pressure is advisory, not a permanent off switch or a disposal request.
 });
 return {add(h){mounted.add(h);},delete(h){mounted.delete(h);if(!mounted.size)cancel();},kick:schedule};
}
export const foilLoop=globalThis.CARDSTASHY_NATIVE?createNativeFoilLoop():desktopFoilLoop;`;

export function transformNativeFoil(source) {
  if (typeof source !== 'string' || source.split(originalLoop).length !== 2) {
    throw new Error('Unexpected foil loop source shape; review native lifecycle transform.');
  }
  return source.replace(originalLoop, originalLoop.replace('export const foilLoop=', 'const desktopFoilLoop=') + nativeLoop);
}
