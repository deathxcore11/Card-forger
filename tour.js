// Playback changes sample controls and results, never application data.
const KEY='cardstashy-tour-v1',GUIDE_KEY='cardstashy-guides-v2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const tourSeen=()=>{try{return localStorage.getItem(KEY)==='done';}catch{return true;}};
export const shouldTour=({seen=tourSeen()}={})=>!seen;
const markSeen=()=>{try{localStorage.setItem(KEY,'done');}catch{}};
export const guideSeen=key=>{try{return JSON.parse(localStorage.getItem(GUIDE_KEY)||'[]').includes(key);}catch{return true;}};
export function markGuide(key){try{const seen=JSON.parse(localStorage.getItem(GUIDE_KEY)||'[]');localStorage.setItem(GUIDE_KEY,JSON.stringify([...new Set([...seen,key])].slice(-30)));}catch{}}
export function resetOnboarding(){try{localStorage.removeItem(KEY);localStorage.removeItem(GUIDE_KEY);}catch{}}
// The welcome: short recordings of the real app (scripts/record-tour.mjs), not imitation screens.
const clip=key=>({video:`./tour/${key}.mp4`,webm:`./tour/${key}.webm`,poster:`./tour/${key}.jpg`});
export const STEPS=[
 {key:'find',title:'Find any card. Add it in seconds.',text:'Choose a game at the top or swipe left or right on Home, then search any card, check its price and add your copies.',...clip('find')},
 {key:'collection',title:'Your collection, at a glance.',text:'Coloured borders show what each card is worth. Watch your total value over time, and sort cards into binders.',...clip('collection')},
 {key:'decks',title:'Decks that win right now.',text:'Browse the decks winning tournaments, see how many of their cards you already own, and what the rest would cost.',...clip('decks')},
 {key:'power',title:'Know how strong your deck is.',text:'Deck Power scores every deck, shows what holds it back and what to fix first. The AI coach explains it in plain words.',...clip('power')},
 {key:'ask',title:'Just ask.',text:'Tap Ask and type or say anything: “most valuable card?”, “best Modern deck?”, “build me a Fire deck for $40”.',...clip('ask')},
];
export const LESSONS=[...STEPS,
 {key:'save',title:'Make it yours',text:'Check the printing, choose a condition and save your copies.'},
 {key:'scan',title:'From camera to collection',text:'Capture a clear card, confirm the match, choose its condition and save.'},
 {key:'build',title:'From your cards to a deck',text:'Choose a format, include the resources, and check what you still need before saving.'},
 {key:'tabletop',title:'Keep the game moving',text:'Change a counter and undo it. Each player keeps their own controls and history.'},
];
export function guidePrompt(key){const lesson=LESSONS.find(l=>l.key===key);return !lesson||guideSeen(key)?'':`<aside class="context-guide" data-guide="${key}"><span>New here? <b>${esc(lesson.title)}</b></span><button class="link" data-act="replayTour" data-lesson="${key}">Watch an example</button><button class="icon" data-act="dismissGuide" data-id="${key}" aria-label="Dismiss this guide">×</button></aside>`;}
export function previewDocument(html,{cssUrl='./style.css',game='mtg'}={}){
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${esc(cssUrl)}"><style>html,body{margin:0;overflow:hidden}body{opacity:1!important}button,input,select,a{pointer-events:none}*{box-sizing:border-box}</style></head><body class="demo-body" data-game="${game}" style="--game-color:${({mtg:'#f08a5d',ptcg:'#ef5350',ygo:'#b99bff'})[game]||'#f08a5d'}">${html}</body></html>`;
}
export function openTour({onDone=()=>{},onTry=()=>{},game='mtg',scenes={},cssUrl='./style.css',lesson='',choose=false}={}){
 if(typeof document==='undefined'||document.querySelector('.tour'))return;
 const launcher=document.activeElement,el=document.createElement('dialog'),reduced=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 let steps=lesson?LESSONS.filter(s=>s.key===lesson):STEPS,i=0,frame=0,timer=null,finished=false,playing=!reduced(),menu=choose;
 if(!steps.length)steps=STEPS;
 el.className='tour action-tour';el.dataset.game=game;el.setAttribute('aria-label','CardStashy tutorials');document.body.append(el);el.showModal();
 const clear=()=>{clearTimeout(timer);timer=null;};
 function play(){clear();if(!playing||menu||finished||document.hidden)return;const frames=scenes[steps[i].key]||[];if(frame>=frames.length-1){playing=false;updateControls();return;}timer=setTimeout(()=>{frame++;paintFrame();play();},frames[frame]?.duration||2200);}
 function updateControls(){const b=el.querySelector('[data-tour="play"]');if(b){b.textContent=playing?'Pause':'Play';b.setAttribute('aria-pressed',String(playing));}const next=el.querySelector('[data-tour="frame"]');if(next)next.disabled=frame>=(scenes[steps[i].key]?.length||1)-1;}
 function paintFrame(){const s=steps[i],f=scenes[s.key]?.[frame],preview=el.querySelector('iframe'),caption=el.querySelector('.demo-caption'),progress=el.querySelector('.demo-progress');if(preview){/* A new sandbox frame avoids adding child entries to browser Back history. */const next=preview.cloneNode(false);next.srcdoc=previewDocument(f?.html||'<p>Choose another example.</p>',{cssUrl,game});preview.replaceWith(next);}if(caption)caption.textContent=f?.caption||s.text;if(progress)progress.textContent=`Action ${frame+1} of ${scenes[s.key]?.length||1}`;el.dataset.lesson=s.key;el.dataset.frame=String(frame);updateControls();}
 function draw(){clear();if(menu){el.innerHTML=`<div class="tour-card"><button class="tour-skip" data-tour="close">Close</button><p class="eyebrow">LEARN BY DOING</p><h2>See it happen.</h2><p>Short examples. Sample cards. Your collection stays yours.</p><div class="tour-lessons">${LESSONS.map(s=>`<button class="panel" data-lesson="${s.key}"><b>${esc(s.title)}</b><span>${esc(s.text)}</span><em>Watch →</em></button>`).join('')}</div></div>`;el.querySelector('[data-tour="close"]')?.focus();return;}
  const s=steps[i],last=i===steps.length-1;
  if(s.video){
   const next=steps[i+1]?.webm;
   el.innerHTML=`<div class="tour-card tour-v3 tour-video-card"><button class="tour-skip" data-tour="skip">Skip</button><p class="eyebrow">${lesson?'WATCH IT IN ACTION':`${i+1} / ${steps.length} · WELCOME`}</p><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p><div class="tour-video"><video poster="${esc(s.poster)}" muted playsinline loop preload="auto" ${playing?'autoplay':''} aria-label="${esc(s.title)}: recording of the app"><source src="${esc(s.webm)}" type="video/webm"><source src="${esc(s.video)}" type="video/mp4"></video><button class="tour-video-play" data-tour="play" aria-label="Play">▶</button><i class="tour-vbar" aria-hidden="true"><b></b></i></div>${next?`<link rel="preload" as="video" href="${esc(next)}">`:''}<div class="tour-dots" aria-hidden="true">${steps.length>1?steps.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join(''):''}</div><div class="tour-actions">${i?'<button class="btn ghost" data-tour="back">Back</button>':lesson?'<button class="btn ghost" data-tour="menu">All examples</button>':'<span></span>'}<button class="btn" data-tour="${last?'done':'next'}">${last?lesson?'Try it':'Let’s go':'Next'}</button></div></div>`;
   const v=el.querySelector('video'),bar=el.querySelector('.tour-vbar b'),box=el.querySelector('.tour-video');
   const sync=()=>{box.classList.toggle('paused',v.paused);};
   v.addEventListener('timeupdate',()=>{bar.style.width=`${v.duration?Math.min(100,v.currentTime/v.duration*100):0}%`;});
   v.addEventListener('play',sync);v.addEventListener('pause',sync);
   if(playing)v.play?.().catch(()=>sync());sync();el.dataset.lesson=s.key;
   el.querySelector(`[data-tour="${last?'done':'next'}"]`)?.focus({preventScroll:true});
   return;
  }
  el.innerHTML=`<div class="tour-card tour-v3"><button class="tour-skip" data-tour="skip">Skip</button><p class="eyebrow">${lesson?'WATCH THE EXAMPLE':`${i+1} / ${steps.length} · WELCOME`}</p><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p><div class="demo-label"><span>Sample cards · example values</span><span class="demo-progress"></span></div><div class="tour-preview"><iframe tabindex="-1" aria-hidden="true" title="Sample action demonstration" sandbox=""></iframe></div><p class="demo-caption" role="status" aria-live="polite"></p><div class="demo-playback"><button data-tour="replay" aria-label="Replay this demonstration">↺ Replay</button><button data-tour="play" aria-pressed="${playing}">${playing?'Pause':'Play'}</button><button data-tour="frame">Next action →</button></div><div class="tour-actions">${i?'<button class="btn ghost" data-tour="back">Back</button>':lesson?'<button class="btn ghost" data-tour="menu">All examples</button>':'<span></span>'}<button class="btn" data-tour="${last?'done':'next'}">${last?lesson?'Try it':'Let’s go':'Next'}</button></div></div>`;
  paintFrame();play();el.querySelector('[data-tour="skip"]')?.focus({preventScroll:true});
 }
 const visibility=()=>{clear();if(!document.hidden)play();};document.addEventListener('visibilitychange',visibility);
 const finish=(how)=>{if(finished)return;finished=true;clear();document.removeEventListener('visibilitychange',visibility);if(!lesson&&!choose)markSeen();if(!menu)markGuide(steps[i].key);el.close();el.remove();if(launcher?.isConnected)launcher.focus({preventScroll:true});onDone(how);if(how==='try')onTry(steps[i].key);};
 el.addEventListener('close',()=>finish('closed'));
 el.addEventListener('cancel',e=>{e.preventDefault();finish('skip');});
 el.addEventListener('click',e=>{const selected=e.target.closest('button[data-lesson]')?.dataset.lesson;if(selected){lesson=selected;steps=LESSONS.filter(s=>s.key===selected);i=0;frame=0;menu=false;playing=!reduced();draw();return;}const action=e.target.closest('[data-tour]')?.dataset.tour;
  if(!action&&e.target.closest('.tour-video video')){const v=e.target;if(v.paused)v.play?.();else v.pause();return;}
  if(action==='skip'||action==='close')finish('skip');
  else if(action==='done')finish(lesson?'try':'done');
  else if(action==='next'&&i<steps.length-1){markGuide(steps[i].key);i++;frame=0;playing=!reduced();draw();}
  else if(action==='back'&&i>0){i--;frame=0;draw();}
  else if(action==='menu'){menu=true;draw();}
  else if(action==='replay'&&el.querySelector('video')){const v=el.querySelector('video');v.currentTime=0;v.play?.();}
  else if(action==='replay'){frame=0;paintFrame();play();}
  else if(action==='play'&&el.querySelector('video')){const v=el.querySelector('video');if(v.paused){v.play?.();playing=true;}else{v.pause();playing=false;}}
  else if(action==='play'){playing=!playing;if(playing&&frame>=(scenes[steps[i].key]?.length||1)-1)frame=0;paintFrame();play();}
  else if(action==='frame'){playing=false;clear();frame=Math.min(frame+1,(scenes[steps[i].key]?.length||1)-1);paintFrame();}
 });
 // Swipe or arrow keys move between welcome cards.
 const go=d=>{if(menu)return;const j=i+d;if(j<0||j>=steps.length)return;if(d>0)markGuide(steps[i].key);i=j;frame=0;playing=!reduced();draw();};
 el.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(1);else if(e.key==='ArrowLeft')go(-1);});
 let x0=null;el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;},{passive:true});
 el.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)go(dx<0?1:-1);});
 draw();
}
