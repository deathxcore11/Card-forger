// Entry admission only, not engine/deck readiness. Browser viewport + input
// capabilities cannot identify a hinge, physical screen or folded/unfolded state.
// The name stays compatible with desktop callers and their existing placement.
export const PLAY_TOUCH_MIN_EDGE = 600;
export function playDeviceEligibility({native=false,ua='',platform='',mobile,maxTouchPoints=0,anyFine=false,anyHover=false,anyCoarse=false,width=0,height=0}={}) {
  if(native)return {eligible:false,reason:'native',entry:null};
  const touch=Number.isFinite(maxTouchPoints)&&maxTouchPoints>0||anyCoarse===true;
  const mobileDevice=mobile===true||/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)||(platform==='MacIntel'&&maxTouchPoints>1);
  if(mobileDevice){
    // Known mobile/tablet web devices can discover Play even on their cover
    // screen. The route explains the guard instead of promising phone gameplay.
    if(!touch)return {eligible:false,reason:'uncertain',entry:null};
    if(!/Chrome\/|CriOS\//i.test(ua)||/EdgA\/|OPR\/|SamsungBrowser\//i.test(ua))return {eligible:false,reason:'touch-browser',entry:'touch'};
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return {eligible:false,reason:'viewport-unknown',entry:'touch'};
    if(width<PLAY_TOUCH_MIN_EDGE||height<PLAY_TOUCH_MIN_EDGE)return {eligible:false,reason:'touch-space',entry:'touch'};
    return {eligible:true,reason:'wide-touch-candidate',entry:'touch'};
  }
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
  return playDeviceEligibility({native,ua:n.userAgent||'',platform:n.platform||'',mobile:n.userAgentData?.mobile,maxTouchPoints:n.maxTouchPoints||0,anyFine:matches('(any-pointer:fine)'),anyHover:matches('(any-hover:hover)'),anyCoarse:matches('(any-pointer:coarse)'),width:root?.documentElement?.clientWidth||view.innerWidth||0,height:root?.documentElement?.clientHeight||view.innerHeight||0});
}
export function playDeviceGuardText(result={}) {
  if(result.reason==='native')return 'Play is being prepared for the web first. Android app play comes later. Your saved decks remain available in Decks.';
  if(result.reason==='touch-space')return 'Play needs more room in this browser window. Open your inner screen or use a tablet in Chrome, with at least 600 CSS pixels of width and height. Regular narrow-phone play comes later. Your saved decks remain available in Decks.';
  if(result.reason==='touch-browser')return 'For touch-screen Play, use Chrome on a spacious inner screen or tablet. Desktop browsers with a mouse or trackpad can also open Play. Your saved decks remain available in Decks.';
  return 'Play needs a supported desktop browser with a mouse or trackpad, or Chrome on a spacious touch-screen browser window. This browser has not reported the required display and input capabilities. Your saved decks remain available in Decks.';
}
export function touchPlayEntryMarkup(location) {
  if(!['home','decks'].includes(location))return '';
  return `<button type="button" class="btn ghost touch-play-entry ${location}-play-entry" data-touch-play-entry="practice" data-act="go" data-to="#play" hidden disabled aria-label="Open Play menu"><span aria-hidden="true">▷</span> Play</button>`;
}
export function syncDesktopPlayEntries(game,root=globalThis.document,view=globalThis) {
  const result=readPlayDeviceEligibility(view,root);
  for(const node of root?.querySelectorAll?.('[data-desktop-play-entry]')||[]){
    node.hidden=game!=='mtg'||result.entry!=='desktop'||!result.eligible;
    node.disabled=node.hidden||node.dataset.desktopPlayEntry!=='practice';
    node.dataset.playReadiness='cpu-beta';
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
  view.addEventListener?.('resize',update,{passive:true});
  const queries=['(any-pointer:fine)','(any-hover:hover)','(any-pointer:coarse)'].flatMap(query=>{try{return view.matchMedia?.(query)||[];}catch{return [];}});
  for(const query of queries)query.addEventListener?.('change',update);
  return ()=>{view.removeEventListener?.('resize',update);for(const query of queries)query.removeEventListener?.('change',update);};
}
