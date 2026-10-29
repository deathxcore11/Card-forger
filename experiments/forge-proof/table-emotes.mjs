// Emotes, like Arena's: a small button on your seat opens a few friendly lines, and the CPU
// answers now and then. Presentation only: nothing here reaches Forge. Mute stays on this device.
const EMOTES=[['hello','Hello!'],['nice','Nice play'],['thinking','Thinking…'],['oops','Oops'],['gg','Good game']];
const REPLIES={hello:['Hello!','Good luck.','Greetings, planeswalker.'],nice:['Thanks!','You too.'],thinking:['Take your time.','No rush.'],oops:['It happens.','Happens to the best of us.'],gg:['Good game.','Well played.']};
const MUTE_KEY='cardstashy-cpu-emotes-muted';
const ICON='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16v11H9l-5 4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
export function createTableEmotes({root,doc=root.ownerDocument,win=doc.defaultView,random=Math.random,schedule=(fn,ms)=>win.setTimeout(fn,ms),cancel=id=>win.clearTimeout(id)}){
 let menu=null,lastYou=0,lastCpu=0,greeted=false,closed=false;const timers=new Set(),bubbles=new Set();
 let muted=false;try{muted=win.localStorage?.getItem(MUTE_KEY)==='true';}catch{/* blocked storage: the CPU talks */}
 const later=(fn,ms)=>{const id=schedule(()=>{timers.delete(id);if(!closed)fn();},ms);timers.add(id);};
 const seat=who=>root.querySelector(`.play-match-seat[data-seat=${who}]`);
 function say(who,text){
  const at=seat(who)?.querySelector('.play-match-profile-badge')||seat(who);if(!at)return;
  for(const b of bubbles)if(b.dataset.who===who){b.remove();bubbles.delete(b);}
  const r=at.getBoundingClientRect(),b=doc.createElement('div');b.className='forge-emote-bubble';b.dataset.who=who;b.setAttribute('role','status');
  // The visible bubble drops the "You:"/"CPU:" prefix; screen readers keep it.
  b.innerHTML=`<span class="forge-emote-sr">${who==='you'?'You':'CPU'}: </span>${text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c])}`;
  doc.body.append(b);bubbles.add(b);
  const w=b.offsetWidth,h=b.offsetHeight,vw=win.innerWidth,vh=win.innerHeight;
  const left=Math.min(Math.max(8,r.left+r.width/2-w/2),vw-w-8),top=who==='you'?Math.max(8,r.top-h-10):Math.min(vh-h-8,r.bottom+10);
  b.style.left=left+'px';b.style.top=top+'px';
  later(()=>{b.dataset.leaving='true';later(()=>{b.remove();bubbles.delete(b);},260);},2600);
 }
 function cpuReply(id){
  if(muted||Date.now()-lastCpu<8000||random()>.6)return;lastCpu=Date.now();
  const lines=REPLIES[id]||REPLIES.hello;later(()=>say('cpu',lines[Math.floor(random()*lines.length)]),1100+Math.round(random()*700));
 }
 function closeMenu(){if(!menu)return;menu.remove();menu=null;doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);root.querySelector('.forge-emote-button')?.setAttribute('aria-expanded','false');}
 const outside=e=>{if(!menu?.contains(e.target)&&!e.target.closest?.('.forge-emote-button'))closeMenu();};
 const escape=e=>{if(e.key==='Escape'){e.stopPropagation();const b=root.querySelector('.forge-emote-button');closeMenu();b?.focus();}};
 function openMenu(button){
  closeMenu();menu=doc.createElement('div');menu.className='forge-emote-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Emotes');
  for(const [id,label]of EMOTES){const b=doc.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=label;b.addEventListener('click',()=>{closeMenu();if(Date.now()-lastYou<2500)return;lastYou=Date.now();say('you',label);cpuReply(id);});menu.append(b);}
  const mute=doc.createElement('button');mute.type='button';mute.className='forge-emote-mute';mute.setAttribute('role','menuitemcheckbox');mute.setAttribute('aria-checked',String(muted));mute.textContent=muted?'Unmute CPU':'Mute CPU';
  mute.addEventListener('click',()=>{muted=!muted;try{win.localStorage?.setItem(MUTE_KEY,String(muted));}catch{/* lasts this match */}closeMenu();});menu.append(mute);
  doc.body.append(menu);
  const r=button.getBoundingClientRect(),w=menu.offsetWidth,h=menu.offsetHeight;
  menu.style.left=Math.min(Math.max(8,r.left),win.innerWidth-w-8)+'px';menu.style.top=Math.max(8,r.top-h-8)+'px';
  button.setAttribute('aria-expanded','true');menu.querySelector('button')?.focus({preventScroll:true});
  doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);
 }
 return {
  // The table redraws its seats each render, so the button is put back each time.
  mount(){
   const you=seat('you');if(!you||you.querySelector(':scope>.forge-emote-button'))return;
   const b=doc.createElement('button');b.type='button';b.className='forge-emote-button';b.innerHTML=ICON;b.setAttribute('aria-label','Emotes');b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded',String(!!menu));b.title='Emotes';
   b.addEventListener('click',e=>{e.stopPropagation();menu?closeMenu():openMenu(b);});you.append(b);
   if(!greeted&&root.dataset.stage==='match'){greeted=true;if(!muted)later(()=>say('cpu','Good luck, have fun.'),1800);}
  },
  destroy(){closed=true;closeMenu();for(const id of timers)cancel(id);timers.clear();for(const b of bubbles)b.remove();bubbles.clear();},
 };
}
