// Planeswalk motion (glue). Built into ../planeswalk-motion.js after the shared motion kit by build-motion.sh.
// It only reads what the game has already rendered into #app (confirmed state), never changes game
// state, and never shakes the screen. Every effect sits in the kit's fixed layer outside #app, so it
// works under the #app CSS zoom. Reduced motion turns it all off; low power drops the garnish.
(function(){
 if(window.pwMotion)return;
 const app=document.getElementById('app')||document.body;
 const lowPower=(()=>{let p='';try{p=localStorage.getItem('cardstashy.lowPower')||'';}catch{}if(p==='on')return true;if(p==='off')return false;
  const n=navigator,ua=n.userAgent||'';return /Android/i.test(ua)&&/; wv\)/.test(ua)||(n.deviceMemory&&n.deviceMemory<=3)||false;})();
 const M=window.CSMotion.createMotion({lowPower});
 const off=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const css=document.createElement('style');css.id='pw-motion-style';css.textContent=`
.cs-mk .pw-mk-ghost{border-radius:50% 50% 8px 8px;background:#1b170f center/cover no-repeat;border:1.5px solid #6d5a33}
.cs-mk .pw-mk-card{width:56px;height:78px;margin:-39px -28px;border-radius:6px;background:linear-gradient(#3a2a14,#1b170f);border:1.5px solid #e8b95b;box-shadow:0 0 16px #ffb06788}
.cs-mk .pw-mk-coin{width:14px;height:14px;margin:-7px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff3c4,#e8b95b 45%,#8a6420);border:1px solid #5b3f12}
.cs-mk .pw-mk-iris{inset:0;left:0;top:0;width:100%;height:100%;background:radial-gradient(circle,var(--t,#3a2a14),#0b0809 75%)}
.cs-mk .cs-mk-flash{background:radial-gradient(circle,rgba(255,236,200,.85) 0,rgba(255,160,80,.45) 32%,rgba(255,120,40,0) 68%)}
.cs-mk .pw-mk-rays{width:220px;height:220px;margin:-110px;border-radius:50%;background:repeating-conic-gradient(rgba(255,138,61,.4) 0 10deg,transparent 10deg 30deg);-webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);mask:radial-gradient(circle,#000 30%,transparent 70%)}
.cs-mk .pw-mk-fx{background:center/100% 100% no-repeat;pointer-events:none}
.cs-mk .pw-mk-token{width:26px;height:26px;margin:-13px;border-radius:50%;border:2px solid #ffd98a;background:radial-gradient(circle at 40% 35%,#fff7e0,#e8b95b 55%,#7a5518);box-shadow:0 3px 8px #000}
.bar>.pw-mk-hp{position:absolute;left:0;top:0;bottom:0;background:#fff;opacity:.85;transform-origin:left;pointer-events:none}
.bar{position:relative}.bar>i{position:relative;z-index:1}
#app .map .node.open:not(:disabled){animation:pw-mk-open 1.8s ease-in-out infinite}
#app .map .node.boss{animation:pw-mk-loom 3.2s ease-in-out infinite}
@keyframes pw-mk-open{50%{box-shadow:0 0 0 4px rgba(232,185,91,.35),0 0 18px rgba(232,185,91,.45)}}
@keyframes pw-mk-loom{50%{transform:scale(1.06);box-shadow:0 0 26px rgba(200,40,40,.55)}}
@media (prefers-reduced-motion:reduce){#app .map .node{animation:none!important}}`;
 document.head.append(css);
 const haptic=n=>{try{window.pwHaptic?.(n);}catch{}};
 const num=t=>Number(String(t||'').replace(/[^\d-]/g,''))||0;
 const pct=el=>parseFloat(el?.style.width)||0;
 // What the last render showed, kept so the next one can be compared with it.
 let last={foes:new Map(),hand:new Map(),mine:new Map(),gold:null,tally:null,screen:'',mul:0},lastDeath=null;
 function read(){
  const foes=new Map(),hand=new Map();
  for(const u of app.querySelectorAll('.side.foe .unit[data-id]')){const r=u.getBoundingClientRect(),art=u.querySelector('.art');
   foes.set(u.dataset.id,{rect:{left:r.left,top:r.top,width:r.width,height:r.height},hp:pct(u.querySelector('.bar>i')),n:num(u.querySelector('.stats.hp')?.textContent),art:art?getComputedStyle(art).backgroundImage:'none'});}
  for(const c of app.querySelectorAll('.hand .card[data-n]')){const r=c.getBoundingClientRect();hand.set(c.dataset.n+'#'+hand.size,{rect:r,name:c.dataset.n,col:c.dataset.col||''});}
  const mine=new Map();for(const u of app.querySelectorAll('.side.you .unit')){const r=u.getBoundingClientRect(),k=(u.classList.contains('hero')?'hero':u.dataset.n||'ally')+'#'+mine.size;
   mine.set(k,{rect:{left:r.left,top:r.top,width:r.width,height:r.height},hp:pct(u.querySelector('.bar>i')),ward:num(u.querySelector('.ward,.shield')?.textContent),name:u.dataset.n||''});}
  const g=app.querySelector('.gold'),t=app.querySelector('.tally');
  const s=app.querySelector('.map')?'map':app.querySelector('.side.foe')?'battle':(app.querySelector('section.screen')?.className||'');
  return {foes,hand,mine,gold:g?num(g.textContent):null,tally:t?num([...t.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('')):null,screen:s,mul:app.querySelectorAll('.tally .juice .mul').length};
 }
 // Painted effect sprites from Randall's codex pack (fire, halo, embers), inlined as WebP by build-motion.sh.
 const FX=window.PW_FX||{};
 function sprite(name,r,{w=1.6,rise=false}={}){if(!FX[name]||off())return;const fx=document.createElement('span');fx.className='pw-mk-fx';const W=r.width*w,H=W*(name==='halo'?.68:.67);
  fx.style.cssText=`background-image:url(${FX[name]});width:${W}px;height:${H}px;margin:${-H/2}px 0 0 ${-W/2}px;left:${r.left+r.width/2}px;top:${r.top+r.height*(rise?.62:.42)}px`;M.layer.prepend(fx);
  fx.animate(rise?[{opacity:0,transform:'translateY(18px) scale(.8)'},{opacity:1,transform:'translateY(0) scale(1)',offset:.3},{opacity:0,transform:'translateY(-26px) scale(1.08)'}]:[{opacity:0,transform:'scale(.6) rotate(-8deg)'},{opacity:1,transform:'scale(1) rotate(0)',offset:.35},{opacity:0,transform:'scale(1.12) rotate(6deg)'}],{duration:lowPower?600:900,easing:'cubic-bezier(.2,.8,.3,1)'}).finished.then(()=>fx.remove(),()=>fx.remove());}
 // The fire streak is painted tail-left, impact-right (impact at 75%/40% of the sprite): pin the impact on
 // the target, turn it toward the source and stretch it over the distance, then reveal it tail to impact.
 function fire(a,b){const ax=a.left+a.width/2,ay=a.top+a.height/2,bx=b.left+b.width/2,by=b.top+b.height/2,d=Math.hypot(bx-ax,by-ay);if(d<20)return;
  const W=Math.min(900,d/.735),H=W*.72,fx=document.createElement('span');fx.className='pw-mk-fx';
  fx.style.cssText=`background-image:url(${FX.fire});width:${W}px;height:${H}px;left:${bx-W*.75}px;top:${by-H*.4}px;transform-origin:75% 40%;transform:rotate(${Math.atan2(by-ay,bx-ax)}rad)`;M.layer.append(fx);
  fx.animate([{clipPath:'inset(0 100% 0 0)',opacity:1},{clipPath:'inset(0 0 0 0)',opacity:1,offset:.45},{clipPath:'inset(0 0 0 0)',opacity:0}],{duration:lowPower?320:460,easing:'ease-out'}).finished.then(()=>fx.remove(),()=>fx.remove());haptic(10);}
 // A card dropped by drag (touch.js adds html.pw-dragging and a fixed .pw-ghost) flies from where it was let go.
 let drop=null;addEventListener('pointerup',()=>{if(!document.documentElement.classList.contains('pw-dragging'))return;const g=document.querySelector('body>.pw-ghost,.pw-ghost:not(.pw-mk-hp)');const r=g?.getBoundingClientRect();if(r?.width)drop={rect:{left:r.left,top:r.top,width:r.width,height:r.height},at:Date.now()};},true);
 const dropRect=()=>{const d=drop&&Date.now()-drop.at<1500?drop.rect:null;drop=null;return d;};
 function onRender(){
  const now=read(),was=last;last=now;if(off())return;
  // Battle: hits drain a white ghost bar behind the life bar; a played card flies to what it hit.
  if(now.screen==='battle'&&was.screen==='battle'){
   const goneHand=[...was.hand.values()].filter(h=>![...now.hand.values()].some(x=>x.name===h.name&&Math.abs(x.rect.left-h.rect.left)<2));
   let flown=false;
   for(const [id,f] of now.foes){const p=was.foes.get(id);if(!p||f.hp>=p.hp)continue;const u=app.querySelector(`.side.foe .unit[data-id="${CSS.escape(id)}"]`),bar=u?.querySelector('.bar');
    const big=p.hp-f.hp>=30,delay=window.PW_CAST?.impactDelay?.(id)??(goneHand.length&&!flown?240:0);
    if(goneHand.length&&!flown&&/R/.test(goneHand[0].col)&&FX.fire){flown=true;const h=goneHand[0],from=dropRect()||h.rect;fire(from,u.getBoundingClientRect());}
    if(goneHand.length&&!flown){flown=true;const h=goneHand[0],src=dropRect()||h.rect,card=document.createElement('span');card.className='pw-mk-card';const to=u.getBoundingClientRect();card.style.left=to.left+to.width/2+'px';card.style.top=to.top+to.height/2+'px';M.layer.append(card);
     M.arc(card,src,{ms:240,lift:50,s0:1,mid:.9,s1:.25,r1:200,easing:'cubic-bezier(.5,0,.8,.6)'})?.finished.then(()=>card.remove(),()=>card.remove());if(off())card.remove();}
    setTimeout(()=>{if(!u?.isConnected)return;M.flash(u,big?.85:.6);M.sparks(u,{n:big?12:7,color:'#ff9a5a',spread:big?64:46});
     u.animate([{transform:'none'},{transform:'translateX(9px) rotate(3deg)',offset:.2},{transform:'none'}],{duration:320,easing:'ease-out'});if(big)haptic(15);},delay);
    // Life and its number hold the old value until the hit lands, then drop; the ghost drains after.
    const hn=u?.querySelector('.stats.hp');if(hn&&delay&&p.n!=null&&!off()){const to=hn.textContent;hn.textContent=String(p.n);setTimeout(()=>{if(hn.isConnected)M.countUp(hn,p.n,num(to),220).then(()=>{if(hn.isConnected)hn.textContent=to;});},delay);}
    if(bar){const fill=bar.querySelector('i');fill?.animate([{width:p.hp+'%'},{width:f.hp+'%'}],{duration:160,delay,easing:'ease-out',fill:'backwards'});
     const gh=document.createElement('span');gh.className='pw-mk-hp';gh.style.width=p.hp+'%';bar.prepend(gh);
     gh.animate([{transform:'scaleX(1)'},{transform:`scaleX(${p.hp?f.hp/p.hp:0})`}],{duration:420,delay:delay+200,easing:'ease-in-out',fill:'both'}).finished.then(()=>gh.remove(),()=>gh.remove());}}
   // Deaths: an enemy that left the field breaks apart where it stood.
   for(const [id,p] of was.foes){if(now.foes.has(id))continue;lastDeath={x:p.rect.left+p.rect.width/2,y:p.rect.top+p.rect.height/2,t:Date.now()};if(window.PW_CAST?.owns?.(id))continue;
    const html=`<div class="pw-mk-ghost" style="background-image:${p.art.replace(/"/g,'&quot;')}"></div>`;setTimeout(()=>M.shatter({rect:p.rect,html}),200);}
   // Your side: a new ally rises out of summoning embers; a heal or a new shield draws a halo on who got it.
   const names=[...was.mine.values()].map(m=>m.name);
   for(const [k,m] of now.mine){const i=names.indexOf(m.name);const p=i>=0&&m.name?(names[i]=null,[...was.mine.values()][i]):k.startsWith('hero')?was.mine.get(k):null;
    if(!p&&m.name){sprite('embers',m.rect,{w:1.9,rise:true});continue;}
    if(p&&(m.hp>p.hp+.5||m.ward>p.ward))sprite('halo',m.rect,{w:1.5});}
   // The tally bumps as it climbs; a fresh multiplier pops.
   const t=app.querySelector('.tally');if(t&&now.tally>was.tally){M.bump(t,1.22,240);M.sparks(t,{n:4,spread:26});}
   if(t&&now.mul>was.mul)M.bump(t.querySelector('.juice .mul:last-of-type'),1.5,320);
  }
  // Gold: coins burst from the last kill (or the middle of the screen) and fly into the counter.
  const g=app.querySelector('.gold');if(g&&was.gold!==null&&now.gold>was.gold){const from=lastDeath&&Date.now()-lastDeath.t<4000?lastDeath:{x:innerWidth/2,y:innerHeight/2},n=Math.min(8,now.gold-was.gold),gr=g.getBoundingClientRect();
   M.countUp(g.lastChild?.nodeType===3?{set textContent(v){g.lastChild.textContent='◎ '+v;}}:null,was.gold,now.gold,500);
   for(let i=0;i<n;i++){const c=document.createElement('span');c.className='pw-mk-coin';c.style.left=gr.left+gr.width/2+'px';c.style.top=gr.top+gr.height/2+'px';M.layer.append(c);
    const bx=(i-n/2)*20,by=-40-(i%3)*14,dx=from.x-(gr.left+gr.width/2),dy=from.y-(gr.top+gr.height/2);
    c.animate([{transform:`translate(${dx}px,${dy}px) scale(.4)`},{transform:`translate(${dx+bx}px,${dy+by}px) scale(1.1)`,offset:.35,easing:'cubic-bezier(.5,0,.75,0)'},{transform:'scale(.6)'}],{duration:lowPower?420:700,delay:300+i*55,fill:'both'}).finished.then(()=>{c.remove();M.bump(g,1.15,180);},()=>c.remove());}}
  // Rewards: the cards turn face up one at a time; rare rims flash gold and a mythic gets light rays.
  if(now.screen!==was.screen&&app.querySelector('[data-act=take]')){const cards=[...app.querySelectorAll('.card[data-act=take],[data-act=take] .card,.card')].filter(c=>c.closest('.choices'));
   cards.slice(0,5).forEach((c,i)=>{c.animate([{transform:'perspective(600px) translateY(-30px) rotateY(90deg)',opacity:0},{transform:'perspective(600px) rotateY(90deg)',opacity:1,offset:.4},{transform:'perspective(600px) rotateY(0) scale(1.06)',offset:.8},{transform:'none',opacity:1}],{duration:560,delay:200+i*260,easing:'cubic-bezier(.3,.1,.3,1)',fill:'backwards'});
    const r=c.dataset.rar;if(r==='R'||r==='M')setTimeout(()=>{if(!c.isConnected)return;M.ring(c,r==='M'?'#ff8a3d':'#e8b95b',600);M.sparks(c,{n:r==='M'?12:6,color:r==='M'?'#ff8a3d':'#ffd98a',spread:70});
     if(r==='M'&&!lowPower){const b=c.getBoundingClientRect(),ray=document.createElement('span');ray.className='pw-mk-rays';ray.style.left=b.left+b.width/2+'px';ray.style.top=b.top+b.height/2+'px';M.layer.prepend(ray);
      ray.animate([{opacity:0,transform:'rotate(0) scale(.6)'},{opacity:1,transform:'rotate(40deg) scale(1.1)',offset:.4},{opacity:0,transform:'rotate(140deg) scale(1)'}],{duration:1600}).finished.then(()=>ray.remove(),()=>ray.remove());haptic(20);}},200+i*260+420);});}
  // Map: on arrival the paths draw in and the nodes come up column by column.
  if(now.screen==='map'&&was.screen!=='map'){const map=app.querySelector('.map');
   for(const p of map.querySelectorAll('svg.pw-paths path,svg.pw-paths line')){const len=p.getTotalLength?.()||200;p.animate([{strokeDasharray:`${len}`,strokeDashoffset:len},{strokeDasharray:`${len}`,strokeDashoffset:0}],{duration:700,delay:150,easing:'ease-out',fill:'backwards'});}
   const rows=[...map.querySelectorAll('.maprow')];rows.forEach((row,ri)=>{const k=rows.length-1-ri;for(const n of row.querySelectorAll('.node'))n.animate([{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'scale(1.08)',offset:.7},{opacity:1,transform:'none'}],{duration:340,delay:k*55,easing:'cubic-bezier(.2,.8,.3,1)',fill:'backwards'});});}
  // Any other new screen (act start, rest, shop, events) rises in; an act start reveals its title.
  else if(now.screen!==was.screen&&now.screen&&now.screen!=='battle'){const s=app.querySelector('section.screen');s?.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:280,easing:'ease-out'});
   if(/actstart/.test(now.screen))s?.querySelector('h2')?.animate([{opacity:0,letterSpacing:'.5em'},{opacity:1,letterSpacing:'normal'}],{duration:900,easing:'cubic-bezier(.2,.8,.3,1)'});}
 }
 // Map walk: tapping an open node walks a token there along the path, then an iris opens into it.
 // The tap is held for the walk and then handed to the game unchanged.
 // A long press (node info) is not a pick: a click that ends a press held over 450 ms walks nowhere.
 let walking=false,pressAt=0;
 app.addEventListener('pointerdown',()=>{pressAt=Date.now();},true);
 app.addEventListener('click',e=>{const node=e.target.closest?.('.map .node[data-act=go]:not(:disabled)');if(!node||node.dataset.pwWalked||off()||pressAt&&Date.now()-pressAt>450)return;
  e.preventDefault();e.stopImmediatePropagation();if(walking)return;walking=true;
  const map=node.closest('.map'),r=+node.dataset.r,prev=[...map.querySelectorAll(`.node.done[data-r="${r-1}"]`)][0],to=node.getBoundingClientRect(),tx=to.left+to.width/2,ty=to.top+to.height/2;
  const tok=document.createElement('span');tok.className='pw-mk-token';tok.style.left=tx+'px';tok.style.top=ty+'px';M.layer.append(tok);
  const from=prev?.getBoundingClientRect()||{left:tx-60,top:ty+40,width:0,height:0},fx=from.left+from.width/2,fy=from.top+from.height/2;
  M.bump(node,1.25,300);M.ring(node,node.classList.contains('boss')?'#c83030':'#e8b95b',480);haptic(10);
  tok.animate([{transform:`translate(${fx-tx}px,${fy-ty}px)`},{transform:`translate(${(fx-tx)/2}px,${(fy-ty)/2-24}px)`,offset:.4,easing:'ease-in'},{transform:`translate(${(fx-tx)*.15}px,${(fy-ty)*.15}px)`,offset:.75,easing:'ease-out'},{transform:'translateY(-14px)',offset:.9},{transform:'none'}],{duration:lowPower?360:520,easing:'ease-out',fill:'both'});
  const iris=document.createElement('span');iris.className='pw-mk-iris';iris.style.setProperty('--t',node.classList.contains('boss')?'#4a1414':'#3a2a14');iris.style.clipPath=`circle(0px at ${tx}px ${ty}px)`;
  const go=()=>{node.dataset.pwWalked='1';node.click();walking=false;tok.remove();requestAnimationFrame(()=>iris.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-out',fill:'both'}).finished.then(()=>iris.remove(),()=>iris.remove()));};
  setTimeout(()=>{if(lowPower){go();return;}M.layer.append(iris);const R=Math.hypot(innerWidth,innerHeight);iris.animate([{clipPath:`circle(0px at ${tx}px ${ty}px)`},{clipPath:`circle(${R}px at ${tx}px ${ty}px)`}],{duration:260,easing:'cubic-bezier(.6,0,.4,1)',fill:'both'}).finished.then(go,go);},lowPower?360:480);
 },true);
 // Read after every render; the game rebuilds #app with innerHTML, so one frame after the burst is enough.
 let queued=0;new MutationObserver(()=>{if(!queued)queued=requestAnimationFrame(()=>{queued=0;onRender();});}).observe(app,{childList:true,subtree:true});
 last=read();
 window.pwMotion={motion:M,lowPower};
})();
