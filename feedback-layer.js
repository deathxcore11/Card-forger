// Native modal dialogs make outside UI inert. Keep feedback inside the active
// modal, and move it back when that dialog closes or its contents are replaced.
const managed=new Set();let observing=false,serial=0;
const order=new WeakMap();
export function feedbackHost(doc=document){
 const dialogs=[...doc.querySelectorAll('dialog[open]')].filter(d=>{try{return d.matches(':modal');}catch{return true;}});
 const focused=doc.activeElement?.closest?.('dialog[open]');
 if(focused&&dialogs.includes(focused))return focused;
 return dialogs.sort((a,b)=>(order.get(a)||0)-(order.get(b)||0)).at(-1)||doc.body;
}
export function mountFeedback(node){
 if(!globalThis.document?.body||!node)return node;
 managed.add(node);const move=()=>{const host=feedbackHost();for(const el of managed){if(el.dataset.feedbackDone==='true'){managed.delete(el);continue;}if(el.parentElement!==host)host.append?.(el);}};
 move();
 if(!observing&&globalThis.MutationObserver){observing=true;new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'&&r.target.tagName==='DIALOG'&&r.target.open)order.set(r.target,++serial);for(const n of r.addedNodes||[])if(n.nodeType===1){if(n.matches?.('dialog[open]'))order.set(n,++serial);for(const d of n.querySelectorAll?.('dialog[open]')||[])order.set(d,++serial);}}move();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});}
 return node;
}
export function removeFeedback(node){if(!node)return;managed.delete(node);node.dataset.feedbackDone='true';node.remove();}
