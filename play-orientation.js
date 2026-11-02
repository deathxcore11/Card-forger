// Every play mode runs sideways on phones and tablets, the way Slay the Spire and Arena do on mobile.
// Setup screens follow however the device is held; the turn happens once a match starts loading, and
// the device gets its own rotation back when the player leaves. The Android app turns the screen through
// its native bridge (PWNative.setOrientation). A browser can only lock rotation in full screen, so it
// asks for full screen first; where that is refused, the table shows its "turn sideways" notice instead.
let enteredFullscreen=false;
const touchDevice=view=>{try{return (view.navigator?.maxTouchPoints||0)>0||!!view.matchMedia?.('(any-pointer:coarse)')?.matches;}catch{return false;}};
// A big screen (an unfolded foldable, a tablet) is never turned: it plays however it is held (Randall, 2 Nov).
const bigScreen=view=>{try{return Math.min(Number(view.screen?.width)||0,Number(view.screen?.height)||0)>=600;}catch{return false;}};
export async function lockPlayLandscape(view=globalThis){
 const native=view.PWNative;
 if(!native&&bigScreen(view))return 'unsupported';
 if(typeof native?.setOrientation==='function'){try{await native.setOrientation('landscape');return 'native';}catch{return 'refused';}}
 const orientation=view.screen?.orientation,doc=view.document;
 if(!touchDevice(view)||typeof orientation?.lock!=='function')return 'unsupported';
 try{
  if(doc&&!doc.fullscreenElement&&typeof doc.documentElement?.requestFullscreen==='function'){await doc.documentElement.requestFullscreen({navigationUI:'hide'});enteredFullscreen=true;}
  await orientation.lock('landscape');return 'web';
 }catch{return 'refused';}
}
export async function releasePlayOrientation(view=globalThis){
 const native=view.PWNative;
 if(typeof native?.setOrientation==='function'){try{await native.setOrientation('default');}catch{}return;}
 try{view.screen?.orientation?.unlock?.();}catch{}
 const doc=view.document;
 if(enteredFullscreen){enteredFullscreen=false;try{if(doc?.fullscreenElement)await doc.exitFullscreen();}catch{}}
}
