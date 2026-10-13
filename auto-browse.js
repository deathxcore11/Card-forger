const ACTIONS=['dbMore','tMore','setMore','tSetMore','tSetsMore','collMore','tCollMore'];
export const AUTO_BROWSE_SELECTOR=ACTIONS.map(a=>`[data-act="${a}"]`).join(',');
// Keep the ordinary button as a fallback, but use a separate, quiet scroll sentinel.
export function attachAutomaticBrowse(root,{Observer,dispatch,errorFor=()=>false,blocked=()=>false}={}){
 if(!root || !Observer)return ()=>{};
 const targets=new Map(), fired=new WeakSet(), pending=new Map();
 const consume=entry=>{
   const button=targets.get(entry.target);
   if(!button?.isConnected || button.disabled || fired.has(button))return;
   if(blocked()){pending.set(entry.target,entry);return;}
   pending.delete(entry.target);fired.add(button);observer.unobserve(entry.target);
   entry.target.textContent='Loading more…';
   Promise.resolve().then(()=>dispatch(button)).catch(()=>{if(button.isConnected){button.hidden=false;button.textContent='Try loading again';entry.target.remove();}});
 };
 const observer=new Observer(entries=>{
  for(const entry of entries){if(entry.isIntersecting)consume(entry);else pending.delete(entry.target);}
 },{rootMargin:'400px 0px',threshold:0});
 const resume=()=>{for(const entry of pending.values())consume(entry);};
 root.ownerDocument?.addEventListener?.('close',resume,true);
 for(const button of root.querySelectorAll(AUTO_BROWSE_SELECTOR)){
  if(errorFor(button.dataset.act)){button.hidden=false;button.textContent='Try loading again';continue;}
  const marker=button.ownerDocument.createElement('div');marker.className='auto-browse-status';marker.dataset.autoBrowse=button.dataset.act;
  marker.setAttribute('role','status');marker.setAttribute('aria-live','polite');marker.textContent=button.disabled?'Loading more…':'';
  button.before(marker);button.hidden=true;targets.set(marker,button);observer.observe(marker);
 }
 return ()=>{observer.disconnect();pending.clear();root.ownerDocument?.removeEventListener?.("close",resume,true);};
}
