// Applies only to the isolated packaged bundle. Does not alter shared/browser source.
const marker = '// CardStashy native artwork settings boundary';
const helpers = `// CardStashy native artwork settings boundary
let nativeArtworkCleanupBusy=false,nativeStorageDetailGeneration=0;
const nativeArtworkBytes=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString()+' bytes':'Unavailable';
async function clearNativeArtwork(t,pinned=false){
 if(t.disabled||nativeArtworkCleanupBusy)return;
 nativeArtworkCleanupBusy=true;t.disabled=true;
 const status=document.getElementById('storageActionStatus'),generation=accountGeneration,owner=cloudInfo().user?.id||null;
 try{
  const store=globalThis.CARDSTASHY_ARTWORK_STORAGE;
  if(!store)throw Error('Native artwork storage unavailable');
  const question=pinned?'Remove pinned offline artwork from this phone? Those pictures will no longer be available offline. Your cards, decks and unfinished scans stay.':'Remove downloaded artwork from this phone? Pinned offline artwork, cards, decks and unfinished scans stay.';
  if(!await ask(question))return;
  if(!t.isConnected||generation!==accountGeneration||(cloudInfo().user?.id||null)!==owner)return;
  const result=await (pinned?store.clearPinned({confirm:true}):store.clearEvictable());
  if(!Number.isSafeInteger(result?.removedBytes)||result.removedBytes<0)throw Error('Artwork removal was not confirmed');
  const message='Removed '+nativeArtworkBytes(result.removedBytes)+' of '+(pinned?'pinned offline':'downloaded')+' artwork. Cards, decks and unfinished scans are unchanged.';
  if(status?.isConnected)status.textContent=message;
  toast(message);await storageDetail();
 }catch{
  const message='Artwork cleanup could not be confirmed and may be partial. Cards, decks and unfinished scans are unchanged.';
  if(status?.isConnected)status.textContent=message;
  toast(message);await storageDetail();
 }finally{nativeArtworkCleanupBusy=false;if(t.isConnected)t.disabled=false;}
}
A.clearPinnedArtwork=t=>globalThis.CARDSTASHY_NATIVE?clearNativeArtwork(t,true):undefined;
async function nativeArtworkStorageDetail(){
 const el=$('#storageDetail'),breakdown=$('#storageBreakdown'),generation=accountGeneration,owner=cloudInfo().user?.id||null,request=++nativeStorageDetailGeneration;
 const current=()=>el?.isConnected&&request===nativeStorageDetailGeneration&&generation===accountGeneration&&(cloudInfo().user?.id||null)===owner;
 try{
  const stats=await globalThis.CARDSTASHY_ARTWORK_STORAGE.stats();
  if(!['evictableBytes','pinnedBytes','pendingBytes','availableBytes'].every(key=>Number.isSafeInteger(stats?.[key])&&stats[key]>=0))throw Error('Invalid native artwork usage');
  if(!current())return;
  el.textContent='Downloaded artwork uses app-private phone storage, separate from the installed app package. '+nativeArtworkBytes(stats.availableBytes)+' free on this storage volume.';
  let text='Unavailable',batch='Unavailable';
  try{text='~'+(localStorageFootprint()*2/1048576).toFixed(1)+' MB';const scan=batchStorageSummary();batch=scan.count+' pending · ~'+(scan.chars*2/1048576).toFixed(1)+' MB';}catch{}
  if(breakdown?.isConnected)breakdown.innerHTML='<div><span>Downloaded artwork · removable</span><b>'+nativeArtworkBytes(stats.evictableBytes)+'</b></div><div><span>Pinned offline artwork</span><b>'+nativeArtworkBytes(stats.pinnedBytes)+'</b></div><div><span>Artwork transfers · temporary</span><b>'+nativeArtworkBytes(stats.pendingBytes)+'</b></div><div><span>Pending scan captures · estimate</span><b>'+esc(batch)+'</b></div><div><span>Local web data · estimate</span><b>'+esc(text)+'</b></div><p class="foot">Artwork file bytes are measured on disk; other figures are estimates, not a complete app-storage total. Built-in pictures and app files are not removable here.</p>';
 }catch{if(current()){el.textContent='Native artwork storage details are unavailable. Your saved data has not been changed.';if(breakdown?.isConnected)breakdown.textContent='';}}
}
`;
function replacer(source) {
  if (typeof source !== 'string' || source.includes(marker)) throw Error('Native storage settings transform already applied or invalid source.');
  let code = source;
  return {
    replace(before, after) {
      if (code.split(before).length !== 2) throw Error('Native storage settings transform expected exactly one anchor: ' + before.slice(0, 90));
      code = code.replace(before, after);
    },
    result: () => code,
  };
}
export function transformNativeStorageApp(source) {
  const output = replacer(source);
  output.replace('A.clearCachedImages = async t => {\n', helpers + 'A.clearCachedImages = async t => {\n  if(globalThis.CARDSTASHY_NATIVE)return clearNativeArtwork(t);\n');
  output.replace('async function storageDetail() {\n', 'async function storageDetail() {\n  if(globalThis.CARDSTASHY_NATIVE)return nativeArtworkStorageDetail();\n');
  return output.result();
}
export function transformNativeStorageViews(source) {
  const output = replacer(source);
  const actions = '<div class="actions wrap"><button class="btn ghost small" data-act="clearCachedImages">Remove downloaded pictures</button><button class="btn ghost small" data-act="persist">Keep offline data</button></div>';
  const footnotes = '<p class="foot">Removing downloaded pictures keeps your cards, decks, earlier saves and unfinished scans. Pictures download again when needed and may be unavailable offline until then.</p><p class="foot">Keep offline data asks the browser to reduce automatic cleanup. It does not create an online backup or increase photo storage.</p>';
  output.replace(actions, '${globalThis.CARDSTASHY_NATIVE?\'<div class="actions wrap"><button class="btn ghost small" data-act="clearCachedImages">Remove downloaded art</button><button class="btn ghost small" data-act="clearPinnedArtwork">Remove pinned offline art</button></div>\':\'' + actions + '\'}');
  output.replace(footnotes, '${globalThis.CARDSTASHY_NATIVE?\'<p class="foot">Artwork removal keeps your cards, decks, earlier saves and unfinished scans. Pinned artwork stays until you choose to remove it. App-private artwork counts as app data, is not in your Gallery, and is removed when you uninstall.</p><p class="foot">No bulk artwork downloads are enabled in this build. These controls do not remove pictures built into the app or download replacement art.</p>\':\'' + footnotes + '\'}');
  // A top-level comment also makes accidental repeated application fail explicitly.
  return marker + '\n' + output.result();
}
