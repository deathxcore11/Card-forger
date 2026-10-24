// Conservative device admission for future desktop Play. No viewport-width
// heuristic, persistent fingerprint, game state, account access or network.
export function playDeviceEligibility({native=false,ua='',platform='',mobile,maxTouchPoints=0,anyFine=false,anyHover=false}={}) {
  if(native)return {eligible:false,reason:'native'};
  if(mobile===true||/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua))return {eligible:false,reason:'mobile'};
  if(platform==='MacIntel'&&maxTouchPoints>1)return {eligible:false,reason:'tablet'};
  const desktop=/Windows NT|Macintosh|X11|CrOS/i.test(ua);
  if(!desktop||!anyFine||!anyHover)return {eligible:false,reason:'uncertain'};
  return {eligible:true,reason:'desktop-candidate'};
}
export function syncDesktopPlayEntries(game,root=globalThis.document,view=globalThis) {
  let native=false;
  try{native=!!view.Capacitor?.isNativePlatform?.();}catch{native=true;}
  const n=view.navigator||{},result=playDeviceEligibility({native,ua:n.userAgent||'',platform:n.platform||'',mobile:n.userAgentData?.mobile,maxTouchPoints:n.maxTouchPoints||0,anyFine:!!view.matchMedia?.('(any-pointer:fine)').matches,anyHover:!!view.matchMedia?.('(any-hover:hover)').matches});
  for(const node of root?.querySelectorAll?.('[data-desktop-play-entry]')||[]){
    node.hidden=game!=='mtg'||!result.eligible;
    // The engine proof gate is not complete. No control here can start a
    // cosmetic/manual match, claim offline readiness or create a session.
    node.disabled=true;
    node.dataset.playReadiness='development';
  }
  return result;
}
