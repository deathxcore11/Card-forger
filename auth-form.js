// Form values live only in the DOM and this render-local snapshot, never in saved state.
const IDS=['signEmail','signPassword','signupEmail','signupPassword','signupConfirm','resetEmail'];
export function captureAuthFields(root){return IDS.flatMap(id=>{const e=root.querySelector('#'+id);return e?[{id,value:e.value}]:[];});}
export function restoreAuthFields(root,fields){for(const {id,value} of fields){const e=root.querySelector('#'+id);if(e)e.value=value;}}
export function authFeedback(root,message,tone='error') {
 const e=root.querySelector('#authFeedback');if(!e)return;e.hidden=!message;e.textContent=message;e.className='auth-feedback '+tone;if(message)e.scrollIntoView?.({block:'nearest',behavior:'smooth'});
}
export async function timedFetch(input,options={},timeoutMs=20000,fetcher=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),parent=options.signal;
 const abort=()=>controller.abort();if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
 try{return await fetcher(input,{...options,signal:controller.signal});}catch(e){if(controller.signal.aborted&&!parent?.aborted)throw Error('The account service took too long to respond. Check your connection and try again.');throw e;}finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
}
