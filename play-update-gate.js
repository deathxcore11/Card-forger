// A match must run the website release the server currently publishes. An open tab keeps the
// scripts it loaded, so before a new match a newer release is installed and the Play page reopened.
// Account, decks and collection storage are untouched; an active match is never reloaded.
const KEY='cardstashy-play-update-attempt-v1';
const session=()=>{try{return globalThis.sessionStorage;}catch{return null;}};
export function createPlayUpdateGate({checkRelease,serviceWorker=globalThis.navigator?.serviceWorker,reload=()=>location.reload(),setHash=hash=>{location.hash=hash;},store=session(),wait=ms=>new Promise(r=>setTimeout(r,ms)),native=()=>!!globalThis.CARDSTASHY_NATIVE,notify=()=>{}}={}){
 let replaced=false;
 // A new service worker took control after this page loaded: the scripts in memory are older.
 // A first visit gains its first controller without any older scripts, so that does not count.
 const controlled=!!serviceWorker?.controller;
 serviceWorker?.addEventListener?.('controllerchange',()=>{if(controlled)replaced=true;});
 const attempted=version=>{try{return store?.getItem(KEY)===version;}catch{return false;}};
 const remember=version=>{try{store?.setItem(KEY,version);}catch{}};
 async function installed(){
  if(!serviceWorker?.getRegistration)return;
  let registration=null;try{registration=await serviceWorker.getRegistration();await registration?.update();}catch{return;}
  for(let i=0;i<40&&!replaced&&(registration?.installing||registration?.waiting);i++)await wait(250);
 }
 return {
  // Resolves true when the page is being reopened on the newer release; the caller stops there.
  async beforeMatch(){
   if(native())return false;
   let state=null;try{state=await checkRelease();}catch{}
   if(state?.update!==true&&!replaced)return false;
   const version=state?.update===true&&state.release?.webVersion||'replaced';
   // One attempt per release per tab: a provider cache still serving the old worker must not loop.
   if(attempted(version))return false;
   remember(version);notify(version);await installed();setHash('#play');reload();return true;
  },
  stale:()=>replaced,
 };
}
