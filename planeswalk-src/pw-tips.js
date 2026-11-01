/* Planeswalk tips: point at any icon, chip or button (mouse), or tap it / hold it (finger), and a small
   bubble says what it is. Cards, creatures and map nodes keep their own long-press zoom. Reads titles,
   so a native tooltip never doubles the bubble. */
(()=>{
 const app=document.getElementById('app');if(!app)return;
 const HOLD=420,ZOOMED='.card,.unit,.map .node';
 // Words for the bits that only show a number or a picture.
 const WORDS=[
  ['#app>.top .life',e=>`Life ${e.dataset.v||''}. At 0 the walk ends. Rest sites heal it, and beating a boss heals you to full.`],
  ['#app>.top .gold',e=>`Gold ${e.dataset.v||''}. Won from fights and treasure. Spend it in shops.`],
  // an emblem says its own name and what it does, nothing else (Randall 1 Nov: "just describe what it is")
  ['.emblems>.emb-art,.emblems>svg',e=>(e.getAttribute('data-tip0')||e.getAttribute('aria-label')||'').trim()],
  ['.top .pw-infobtn',()=>'How to play and credits'],
  ['.battle .piles>span:first-child',()=>'Draw pile. When it runs out, your discard pile shuffles back in.'],
  ['.battle .piles>span:nth-child(2)',()=>'Discard pile. Cards you played or kept this fight wait here.'],
  ['.battle .controls [data-act=all]',()=>'Every ready ally attacks. Each goes for its usual target.']
 ];
 const SEL=WORDS.map(w=>w[0]).join(',')+',[title],[data-tip]';
 /* Only one tooltip ever shows: every native title in the game (attributes and SVG <title> children) moves to data-tip0 as it
    appears, so the browser's own box never opens beside the glass one. */
 const strip=root=>{const one=el=>{if(el.hasAttribute&&el.hasAttribute('title')){if(!el.hasAttribute('data-tip0'))el.setAttribute('data-tip0',el.getAttribute('title'));el.removeAttribute('title')}};
  if(root.nodeType!==1)return;one(root);for(const el of root.querySelectorAll('[title]'))one(el);
  for(const t of root.querySelectorAll('svg title')){const sv=t.closest('svg');const tx=t.textContent.trim();if(sv&&tx&&!sv.hasAttribute('data-tip0'))sv.setAttribute('data-tip0',tx);t.remove()}};
 strip(app);new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes')strip(m.target);else for(const n of m.addedNodes)strip(n)}}).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['title']});
 // a title moves to data-tip0 the first time it is seen, so the browser's own tooltip stays away
 const tipOf=el=>{
  strip(el);
  for(const [s,f] of WORDS)if(el.matches(s))return f(el);
  return el.getAttribute('data-tip')||el.getAttribute('data-tip0')||'';
 };
 const target=n=>{const el=n&&n.closest?.(SEL+',[data-tip0]');return el&&app.contains(el)&&!el.matches('section,#app')?el:null};
 let box=null,anchor=null,timer=0,hideT=0;
 function hide(){clearTimeout(timer);clearTimeout(hideT);timer=0;if(box){box.remove();box=null}anchor=null}
 function show(el){const t=tipOf(el);if(!t)return hide();hide();anchor=el;
  box=document.createElement('div');box.className='pw-tip';box.setAttribute('role','tooltip');box.setAttribute('data-audit-ignore','');
  const m=el.closest('.top,.pw-belt')&&/^([^:.]{2,40}):\s+(.+)$/s.exec(t);if(m){const b=document.createElement('b');b.textContent=m[1];const p=document.createElement('span');p.textContent=m[2];box.append(b,p);box.classList.add('named')}else box.textContent=t;document.body.append(box);
  const r=el.getBoundingClientRect(),b=box.getBoundingClientRect(),G=8,top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw-safe-top'))||0;
  let y=r.bottom+G;if(y+b.height>innerHeight-G)y=Math.max(G+top,r.top-G-b.height);
  const x=Math.min(Math.max(G,r.left+r.width/2-b.width/2),innerWidth-G-b.width);
  box.style.left=Math.round(x)+'px';box.style.top=Math.round(y)+'px';
  box.style.setProperty('--ax',Math.round(Math.min(Math.max(12,r.left+r.width/2-x),b.width-12))+'px');box.classList.toggle('up',y<r.top)}
 // mouse: point and wait a moment
 app.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const el=target(e.target);if(!el||el===anchor)return;clearTimeout(timer);timer=setTimeout(()=>show(el),250)});
 app.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse')return;const el=target(e.target);if(el&&!el.contains(e.relatedTarget))hide()});
 // keyboard: the focused control says what it is
 app.addEventListener('focusin',e=>{const el=target(e.target);if(el&&e.target.matches(':focus-visible'))show(el)});
 app.addEventListener('focusout',hide);
 // finger: tap a picture or number; hold a button. Cards, creatures and nodes have their own hold.
 let press=null,ate=false;
 app.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;const el=target(e.target);ate=false;
  if(box&&el!==anchor)hide();if(!el||el.closest(ZOOMED))return;
  press={el,x:e.clientX,y:e.clientY,t:setTimeout(()=>{press=null;ate=true;show(el);window.pwHaptic?.(8);hideT=setTimeout(hide,4000)},HOLD)}},{passive:true});
 app.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10){clearTimeout(press.t);press=null}},{passive:true});
 addEventListener('pointerup',e=>{if(!press)return;clearTimeout(press.t);const el=press.el;press=null;
  if(!el.closest('button,a,summary,[data-act],input,label')){if(anchor===el)return hide();show(el);hideT=setTimeout(hide,4000)}},{passive:true});
 addEventListener('pointercancel',()=>{if(press){clearTimeout(press.t);press=null}},{passive:true});
 // a hold that showed a tip is not also a tap on the button
 app.addEventListener('click',e=>{if(ate){ate=false;e.stopPropagation();e.preventDefault()}},true);
 addEventListener('scroll',hide,{capture:true,passive:true});addEventListener('resize',hide);
 addEventListener('keydown',e=>{if(e.key==='Escape'&&box){hide();e.stopImmediatePropagation()}},true);
 // a new render can take the anchor away
 new MutationObserver(()=>{if(anchor&&!anchor.isConnected)hide()}).observe(app,{childList:true,subtree:true});
 window.pwTip=sel=>{const el=document.querySelector(sel);if(el)show(el);return !!el};
})();
