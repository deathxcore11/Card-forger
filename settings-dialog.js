// App-wide Settings keeps the underlying game, route, card and camera mounted.
// Form snapshots live only during a synchronous repaint, never in storage/history.
export function createSettingsDialog({dialog,markup,beforeOpen=()=>{},afterPaint=()=>{},afterClose=()=>{},history=globalThis.history,location=globalThis.location,document=globalThis.document}){
 let opener=null,html='',token=null,closingBack=false,reopenPending=false,scroll=0;
 const marker='cardstashySettings';
 const paint=()=>{
  const next=markup();if(next===html)return;
  const focused=document.activeElement,focusId=dialog.contains(focused)?focused.id:'',selection=focusId&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;
  const fields=[...dialog.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea')].filter(n=>n.id).map(n=>({id:n.id,value:n.value}));
  const disclosures=[...dialog.querySelectorAll('details')].map((n,i)=>n.open?i:-1),top=dialog.scrollTop;
  dialog.innerHTML=next;html=next;
  for(const field of fields){const n=dialog.querySelector('#'+field.id);if(n)n.value=field.value;}
  for(const [i,n]of [...dialog.querySelectorAll('details')].entries())if(disclosures.includes(i))n.open=true;
  const target=focusId&&dialog.querySelector('#'+focusId);if(target){target.focus({preventScroll:true});if(selection)try{target.setSelectionRange(...selection);}catch{}}
  dialog.scrollTop=top;afterPaint();
 };
 const open=(push=true)=>{
  if(dialog.open){paint();return;}if(closingBack){reopenPending=true;return;}
  beforeOpen();opener=document.activeElement;scroll=globalThis.scrollY||0;html='';dialog.innerHTML='';paint();
  token=push?String(Date.now())+Math.random():history.state?.[marker];
  if(push)history.pushState({...history.state,[marker]:token},'',location.href);
  dialog.showModal();document.documentElement.classList.add('settings-open');
  dialog.querySelector('[data-act="closeSettings"]')?.focus({preventScroll:true});
 };
 const close=(back=true)=>{
  if(!dialog.open)return;dialog.close();document.documentElement.classList.remove('settings-open');
  // Clear credentials and unsaved drafts after closing; reopening reads saved data.
  dialog.innerHTML='';html='';
  if(back&&history.state?.[marker]===token){closingBack=true;history.back();}
  afterClose(scroll);if(opener?.isConnected)opener.focus({preventScroll:true});token=null;
 };
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 return {get isOpen(){return dialog.open;},open,close,refresh:paint,historyChanged(){if(closingBack){closingBack=false;if(reopenPending){reopenPending=false;open();}return true;}if(dialog.open){if(history.state?.[marker]!==token)close(false);return true;}if(history.state?.[marker]){open(false);return true;}return false;}};
}
