// Form values live only in the DOM and this render-local snapshot, never in saved state.
import {PASSWORD_RULES,passwordRuleState} from './password-auth.js';
const IDS=['signEmail','signPassword','signupEmail','signupPassword','signupConfirm','resetEmail','resetPassword','resetConfirm'];
const eye='<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="password-eye-slash" d="m4 3 16 18"/></svg>';
export function passwordField(input,label='password'){
 const id=input.match(/id="([^"]+)"/)?.[1];
 return `<span class="password-field">${input}<button type="button" class="password-toggle" data-act="togglePassword" data-field="${id}" aria-controls="${id}" aria-label="Show ${label}" data-label="${label}" aria-pressed="false">${eye}</button></span>`;
}
// A live checklist under a new-password field. Each rule turns gold as it is met.
export function passwordRules(id){
 return `<ul class="password-rules" data-password-rules="${id}" aria-label="Your password needs">${PASSWORD_RULES.map(([rule,label])=>`<li data-rule="${rule}"><span aria-hidden="true"></span>${label}</li>`).join('')}</ul>`;
}
export function syncPasswordRules(field,root){
 const list=root?.querySelector?.(`[data-password-rules="${field?.id}"]`);if(!list)return;
 for(const {id,ok} of passwordRuleState(field.value)){const item=list.querySelector(`[data-rule="${id}"]`);if(item)item.dataset.ok=String(ok);}
}
export function togglePassword(button,root){
 const field=root.querySelector('#'+button.dataset.field);if(!field)return;
 const reveal=field.type==='password',start=field.selectionStart,end=field.selectionEnd;
 field.type=reveal?'text':'password';button.setAttribute('aria-pressed',String(reveal));
 button.setAttribute('aria-label',(reveal?'Hide ':'Show ')+(button.dataset.label||'password'));
 field.focus({preventScroll:true});try{field.setSelectionRange(start,end);}catch{}
}
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
