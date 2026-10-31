// Entry admission only, not engine/deck readiness. Browser viewport + input
// capabilities cannot identify a hinge, physical screen or folded/unfolded state.
// The name stays compatible with desktop callers and their existing placement.
export const PLAY_TOUCH_MIN_EDGE = 600;
// On touch devices the table fits when its shortest side has room: tablets and
// unfolded foldables in either orientation. A phone (or a folded cover screen) fits
// held sideways, where the table has its own compact phone layout, the way Arena
// plays on a phone. Held upright it is admitted so setup works either way; the match
// itself turns the device sideways (play-orientation.js, playTableFits). Size alone
// decides: browsers report no hinge or fold state.
export const PLAY_PHONE_MIN = {width:640, height:300, ratio:1.5};
export const playPhoneSideways=(width,height)=>width>=PLAY_PHONE_MIN.width&&height>=PLAY_PHONE_MIN.height&&width>=height*PLAY_PHONE_MIN.ratio;
export function playScreenFits(width, height, {screenMin=0, typing=false}={}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
  // An on-screen keyboard only takes height, so while a text field is in use the width decides.
  if(typing)return width>=PLAY_TOUCH_MIN_EDGE;
  if(Math.min(width,height)>=PLAY_TOUCH_MIN_EDGE)return true;
  if(playPhoneSideways(width,height))return true;
  // Upright phones can set up a match; the table turns them sideways.
  if(playPhoneSideways(height,width))return true;
  // A tablet held sideways loses height to the browser's own bars; its screen still decides.
  return screenMin>=PLAY_TOUCH_MIN_EDGE&&width>=PLAY_TOUCH_MIN_EDGE&&height>=520;
}
const NOT_TEXT=new Set(['button','checkbox','radio','range','submit','reset','file','color','image','hidden']);
export const playTyping=el=>!!el&&(el.isContentEditable===true||el.tagName==='TEXTAREA'||el.tagName==='INPUT'&&!NOT_TEXT.has(String(el.type||'text').toLowerCase()));
const screenMinOf=view=>{try{return Math.min(Number(view.screen?.width)||0,Number(view.screen?.height)||0);}catch{return 0;}};
// An open match is sideways only (Randall, 30 Oct): an upright phone or tablet waits under the
// "turn sideways" notice. Setup screens still follow however the device is held.
export function playTableFits(width,height,options={}) {
  const fits=playScreenFits(width,height,options);
  return fits===true&&height>width?false:fits;
}
export function readPlayScreen(view=globalThis,root=view.document,{table=false}={}) {
  const width=root?.documentElement?.clientWidth||view.innerWidth||0,height=root?.documentElement?.clientHeight||view.innerHeight||0,options={screenMin:screenMinOf(view),typing:playTyping(root?.activeElement)};
  return {width,height,fits:(table?playTableFits:playScreenFits)(width,height,options)};
}
// The table's layout needs container queries, :has() and pointer events. Every current
// tablet browser has them (Chrome, Samsung Internet, Edge, Opera, Firefox, Safari);
// an older one is asked to update instead of getting a broken table.
export function playTableSupported(view=globalThis) {
  try{const css=view.CSS;return !!(css?.supports?.('container-type','size')&&css.supports('selector(:has(a))')&&typeof view.PointerEvent==='function');}catch{return false;}
}
export function playDeviceEligibility({native=false,ua='',platform='',mobile,maxTouchPoints=0,anyFine=false,anyHover=false,anyCoarse=false,width=0,height=0,tableSupported=true,screenMin=0,typing=false}={}) {
  const touch=Number.isFinite(maxTouchPoints)&&maxTouchPoints>0||anyCoarse===true;
  const mobileDevice=mobile===true||/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)||(platform==='MacIntel'&&maxTouchPoints>1);
  const touchEntry=()=>{
    if(tableSupported===false)return {eligible:false,reason:'touch-browser',entry:'touch'};
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return {eligible:false,reason:'viewport-unknown',entry:'touch'};
    if(!playScreenFits(width,height,{screenMin,typing}))return {eligible:false,reason:playPhoneSideways(height,width)?'touch-rotate':'touch-space',entry:'touch'};
    return {eligible:true,reason:'wide-touch-candidate',entry:'touch'};
  };
  // The Android app plays by the touch rules: Forge runs on the host, which the app reaches
  // through its native transport. Without a touchscreen the app has no Play entry.
  if(native)return touch?touchEntry():{eligible:false,reason:'uncertain',entry:null};
  if(mobileDevice){
    // Known mobile/tablet web devices can discover Play even on their cover
    // screen. The route explains the guard instead of promising phone gameplay.
    if(!touch)return {eligible:false,reason:'uncertain',entry:null};
    return touchEntry();
  }
  // Chrome on a large Android tablet asks for the desktop site by default: a desktop
  // user agent with touch as the only input. It plays by the touch rules.
  if(touch&&!anyFine)return touchEntry();
  // Preserve desktop admission: a narrow desktop window remains desktop, and
  // adding touch to a desktop does not move its Play buttons onto Home/Decks.
  const desktop=/Windows NT|Macintosh|X11|CrOS/i.test(ua);
  if(!desktop||!anyFine||!anyHover)return {eligible:false,reason:'uncertain',entry:null};
  return {eligible:true,reason:'desktop-candidate',entry:'desktop'};
}
export function readPlayDeviceEligibility(view=globalThis,root=view.document) {
  let native=false;
  try{native=!!view.Capacitor?.isNativePlatform?.();}catch{native=true;}
  const n=view.navigator||{},matches=query=>{try{return !!view.matchMedia?.(query)?.matches;}catch{return false;}};
  return playDeviceEligibility({native,ua:n.userAgent||'',platform:n.platform||'',mobile:n.userAgentData?.mobile,maxTouchPoints:n.maxTouchPoints||0,anyFine:matches('(any-pointer:fine)'),anyHover:matches('(any-hover:hover)'),anyCoarse:matches('(any-pointer:coarse)'),tableSupported:playTableSupported(view),screenMin:screenMinOf(view),typing:playTyping(root?.activeElement),width:root?.documentElement?.clientWidth||view.innerWidth||0,height:root?.documentElement?.clientHeight||view.innerHeight||0});
}
// One title and one line per reason, shown in place of the start button.
export function playDeviceGate(result={}) {
  if(result.reason==='touch-rotate')return {title:'Turn your phone sideways',line:'Play runs sideways on a phone, the way Arena does.'};
  if(result.reason==='touch-space'||result.reason==='viewport-unknown')return {title:'Play needs a bigger screen',line:'Unfold your device, or use a tablet or a computer.'};
  if(result.reason==='touch-browser')return {title:'Play needs a newer browser',line:'Update your browser, or open CardStashy in Chrome or Safari.'};
  return {title:'Play isn’t available in this browser',line:'Use Chrome on a tablet or unfolded phone, or a computer with a mouse or trackpad.'};
}
export function playDeviceGuardText(result={}) {const gate=playDeviceGate(result);return `${gate.title}. ${gate.line}`;}
export function touchPlayEntryMarkup(location) {
  if(!['home','decks'].includes(location))return '';
  return `<button type="button" class="btn ghost touch-play-entry ${location}-play-entry" data-touch-play-entry="practice" data-act="go" data-to="#play" hidden disabled aria-label="Open Play menu"><span aria-hidden="true">▷</span> Play</button>`;
}
export function syncDesktopPlayEntries(game,root=globalThis.document,view=globalThis) {
  const result=readPlayDeviceEligibility(view,root);
  // Header and phone-nav Play: desktops that pass admission, and every touch device,
  // where Play opens the menu and explains a screen that is too small instead.
  for(const node of root?.querySelectorAll?.('[data-desktop-play-entry]')||[]){
    node.hidden=game!=='mtg'||!(result.entry==='desktop'&&result.eligible||result.entry==='touch');
    node.disabled=node.hidden||node.dataset.desktopPlayEntry!=='practice';
    node.dataset.playReadiness=result.eligible?'cpu-beta':'device-guard';
  }
  for(const node of root?.querySelectorAll?.('[data-touch-play-entry]')||[]){
    node.hidden=game!=='mtg'||result.entry!=='touch';
    node.disabled=node.hidden||node.dataset.touchPlayEntry!=='practice';
    node.dataset.playReadiness=result.eligible?'cpu-beta':'device-guard';
  }
  return result;
}
// Refresh only when admission changes. No resize stores state, navigates, starts
// a match or infers a physical fold. The app retains ownership of active games.
export function watchPlayDeviceEligibility({game=()=> 'mtg',root=globalThis.document,view=globalThis,onChange=()=>{}}={}) {
  let prior=syncDesktopPlayEntries(game(),root,view);
  const update=()=>{
    const next=syncDesktopPlayEntries(game(),root,view);
    if(next.eligible!==prior.eligible||next.reason!==prior.reason||next.entry!==prior.entry){const old=prior;prior=next;onChange(next,old);}
  };
  const unwatch=watchPlayScreen(view,update);
  const queries=['(any-pointer:fine)','(any-hover:hover)','(any-pointer:coarse)'].flatMap(query=>{try{return view.matchMedia?.(query)||[];}catch{return [];}});
  for(const query of queries)query.addEventListener?.('change',update);
  return ()=>{unwatch();for(const query of queries)query.removeEventListener?.('change',update);};
}
// Window resizes, rotation and on-screen keyboard or zoom changes all report here.
export function watchPlayScreen(view=globalThis,onChange=()=>{}) {
  const visual=view.visualViewport;
  view.addEventListener?.('resize',onChange,{passive:true});view.addEventListener?.('orientationchange',onChange);visual?.addEventListener?.('resize',onChange);
  return ()=>{view.removeEventListener?.('resize',onChange);view.removeEventListener?.('orientationchange',onChange);visual?.removeEventListener?.('resize',onChange);};
}
// While a match is open on a screen that has become too small, the match waits for
// the player. Nothing is sent to the server unless the screen stays too small for
// the whole limit, when onExpire ends the match. A screen that fits again resumes
// immediately. Unknown sizes count as fitting.
export const PLAY_SMALL_SCREEN_LIMIT_MS = 5*60*1000;
// Only phones and tablets fold. A desktop window of any size or zoom never pauses.
export function playScreenPauseApplies(view=globalThis,root=view.document) {return readPlayDeviceEligibility(view,root).entry==='touch';}
export function createPlayScreenPause({limitMs=PLAY_SMALL_SCREEN_LIMIT_MS,now=()=>Date.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),onPause=()=>{},onResume=()=>{},onTick=()=>{},onExpire=()=>{}}={}) {
  let since=null,timer=null,ended=false;
  const stop=()=>{if(timer!==null)clearTimer(timer);timer=null;};
  const tick=()=>{
    timer=null;if(since===null||ended)return;
    const left=Math.max(0,limitMs-(now()-since));
    if(left<=0){ended=true;since=null;onExpire();return;}
    onTick(left);timer=setTimer(tick,Math.min(1000,left));
  };
  return {
    update(fits){
      if(ended)return;
      if(fits===false&&since===null){since=now();onPause(limitMs);tick();}
      else if(fits!==false&&since!==null){since=null;stop();onResume();}
    },
    get paused(){return since!==null;},
    get ended(){return ended;},
    destroy(){ended=true;since=null;stop();},
  };
}
