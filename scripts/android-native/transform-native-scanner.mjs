// Applied only to the Android bundle. Never mutate the shared scanner source.
const lifecycleAnchor = '  ctx.stopCamera = stopCamera;';
const lifecycle = `
  // Stop only the physical camera. suspendCamera also clears review and queued
  // captures, so it is deliberately NOT used for Android background transitions.
  let nativeCameraBackground=!!globalThis.CARDSTASHY_NATIVE&&globalThis.document?.documentElement?.dataset?.nativeAppState==='background';
  let nativeScannerDisposed=false;
  const pauseNativeCamera=()=>{
    camTicket++; // Retire permission requests, including their fallback attempt.
    clearTimeout(loopTimer);loopTimer=0;
    stream?.getTracks().forEach(track=>track.stop());stream=null;
    if(videoEl)videoEl.srcObject=null;
    Object.assign(s(),{camOn:false,torch:false,torchCap:false,boundaryReady:false});
    captureLock=null;prevGray=null;steady=0;greenSince=0;
    loop.quad=null;loop.proposal=null;loop.signature=null;loop.observation=null;loop.bestCapture=null;
    // No scanTicket/lifecycleGeneration changes: accepted originals, queued OCR,
    // photo drafts and the current review still belong to this scanner visit.
  };
  const nativeScannerLifecycle=event=>{
    if(nativeScannerDisposed)return;
    if(event.detail?.state==='background'){
      nativeCameraBackground=true;pauseNativeCamera();
    }else if(event.detail?.state==='foreground'){
      const wasBackground=nativeCameraBackground;nativeCameraBackground=false;
      // Repaint the Start control, but reopening hardware needs an explicit tap.
      if(wasBackground&&S.ui.view==='scan')render();
    }
  };
  if(globalThis.CARDSTASHY_NATIVE){
    globalThis.addEventListener?.('cardstashy-native-lifecycle',nativeScannerLifecycle);
    ctx.disposeNativeScannerLifecycle=()=>{
      if(nativeScannerDisposed)return;
      nativeScannerDisposed=true;
      globalThis.removeEventListener?.('cardstashy-native-lifecycle',nativeScannerLifecycle);
      pauseNativeCamera();
    };
  }
`;
const replacements = [
  ['export function registerScanner(ctx) {', 'export function registerScanner(ctx) {\n  if(globalThis.CARDSTASHY_NATIVE)ctx.disposeNativeScannerLifecycle?.();'],
  [lifecycleAnchor, lifecycleAnchor + lifecycle],
  ['  A.scanStart = async () => {\n    if(suspended)return;', '  A.scanStart = async () => {\n    if(suspended||nativeCameraBackground||nativeScannerDisposed)return;'],
  ['cam&&visitCurrent()&&ticket===camTicket ? navigator.mediaDevices.getUserMedia', 'cam&&!nativeCameraBackground&&!nativeScannerDisposed&&visitCurrent()&&ticket===camTicket ? navigator.mediaDevices.getUserMedia'],
  ['if (!visitCurrent() || ticket !== camTicket || s().mode === "photo") return got.getTracks().forEach((t) => t.stop());', 'if (nativeCameraBackground || nativeScannerDisposed || !visitCurrent() || ticket !== camTicket || s().mode === "photo") return got.getTracks().forEach((t) => t.stop());'],
  ['  const loop = (allowAuto=true) => {', '  const loop = (allowAuto=true) => {\n    if(nativeCameraBackground||nativeScannerDisposed)return;'],
  ['  const attach = () => {', '  const attach = () => {\n    if(nativeCameraBackground||nativeScannerDisposed)return;'],
  ['  const capture = (automatic=false) => {', '  const capture = (automatic=false) => {\n    if(nativeCameraBackground||nativeScannerDisposed)return;'],
  ['const tick=()=>{const started=clockNow();loop();if(loopTimer&&stream)loopTimer=setTimeout(tick,Math.max(40,160-(clockNow()-started)));};', 'const cameraGeneration=camTicket;const tick=()=>{if(cameraGeneration!==camTicket)return;const started=clockNow();loop();if(cameraGeneration===camTicket&&loopTimer&&stream)loopTimer=setTimeout(tick,Math.max(40,160-(clockNow()-started)));};'],
];
export function transformNativeScanner(source) {
  if(typeof source!=='string'||source.includes('nativeScannerLifecycle'))throw Error('Unexpected scanner source shape; review native lifecycle transform.');
  for(const [anchor] of replacements)if(source.split(anchor).length!==2)throw Error('Unexpected scanner source shape; review native lifecycle transform: '+anchor.slice(0,70));
  for(const [anchor,replacement] of replacements)source=source.replace(anchor,replacement);
  return source;
}
