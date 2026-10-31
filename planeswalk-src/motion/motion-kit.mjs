// Shared motion kit for the Forge table and Planeswalk: arcs, hit-stop strikes, damage numbers,
// shatter, sparks, shake, count-up and flips. Transform and opacity only (no blur), every bit is
// removed when it finishes, and at most BUDGET loose bits fly at once so low-end web views keep up.
// Low power keeps the beat (move, number, count) and drops the garnish (sparks, shards, board shake).
// Planeswalk inlines this file as a classic script: drop the last line (the exports) and use window.CSMotion.
const STYLE=`.cs-mk{position:fixed;inset:0;pointer-events:none;z-index:900;overflow:hidden}
.cs-mk>*{position:absolute;left:0;top:0;will-change:transform,opacity}
.cs-mk-num{font:800 26px/1 'DM Sans',system-ui,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 2px 0 #000,0 0 12px var(--glow,#ff4a2a)}
.cs-mk-num[data-size=big]{font-size:40px}.cs-mk-num[data-size=small]{font-size:16px}
.cs-mk-num[data-kind=heal]{--glow:#4fd07a}.cs-mk-num[data-kind=gold]{--glow:#e8b95b;color:#ffe3a3}
.cs-mk-dot{width:6px;height:6px;margin:-3px;border-radius:50%;background:var(--c,#ffd98a);box-shadow:0 0 6px var(--c,#e8b95b)}
.cs-mk-flash{width:96px;height:96px;margin:-48px;border-radius:50%;background:radial-gradient(circle,#fff 0,rgba(255,240,200,.85) 30%,rgba(255,200,120,0) 70%)}
.cs-mk-ring{width:72px;height:72px;margin:-36px;border-radius:50%;border:3px solid var(--c,#e8b95b)}`;
function createMotion({doc=document,win=doc.defaultView,lowPower=false,reduced=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,budget=12}={}){
 if(!doc.getElementById('cs-mk-style')){const s=doc.createElement('style');s.id='cs-mk-style';s.textContent=STYLE;doc.head.append(s);}
 const layer=doc.createElement('div');layer.className='cs-mk';layer.setAttribute('aria-hidden','true');doc.body.append(layer);
 let live=0;const off=()=>!!reduced();
 const center=n=>{const r=n?.getBoundingClientRect?.()||n;return r&&r.width!==undefined?{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}:r;};
 // A loose bit in the fx layer; refused once the budget is spent so a swarm never piles up.
 function bit(cls,x,y,style=''){if(live>=budget)return null;const n=doc.createElement('span');n.className=cls;if(style)n.style.cssText=style;n.style.left=`${x}px`;n.style.top=`${y}px`;layer.append(n);live++;return n;}
 const done=(a,n)=>{const end=()=>{n.remove();live--;};a.finished.then(end,end);return a;};
 const bump=(n,s=1.3,ms=260)=>off()||!n?null:n.animate([{transform:'scale(1)'},{transform:`scale(${s})`,offset:.35},{transform:'scale(1)'}],{duration:ms,easing:'ease-out'});
 function shake(n,amp=6,ms=320,{garnish=false}={}){if(off()||!n||garnish&&lowPower)return null;return n.animate([0,1,-1,.7,-.6,.3,0].map((f,i)=>({transform:`translate(${f*amp*(i%2?1:-1)}px,${f*amp*.5}px)`})),{duration:ms,easing:'ease-out'});}
 function sparks(at,{n=8,color='#ffd98a',spread=46}={}){if(off()||lowPower)return;const p=center(at);if(!p)return;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2+Math.random()*.4,d=spread*(.6+Math.random()*.6),dot=bit('cs-mk-dot',p.x,p.y,`--c:${color}`);if(!dot)return;
   done(dot.animate([{opacity:1,transform:'translate(0,0)'},{opacity:0,transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px) scale(.3)`}],{duration:420+Math.random()*160,easing:'cubic-bezier(.1,.7,.3,1)'}),dot);}}
 function flash(at,scale=1){if(off())return;const p=center(at),f=p&&bit('cs-mk-flash',p.x,p.y);if(!f)return;
  done(f.animate([{opacity:1,transform:`scale(${.3*scale})`},{opacity:.9,transform:`scale(${.9*scale})`,offset:.3},{opacity:0,transform:`scale(${1.3*scale})`}],{duration:lowPower?200:300,easing:'ease-out'}),f);}
 function ring(at,color='#e8b95b',ms=520){if(off())return;const p=center(at),r=p&&bit('cs-mk-ring',p.x,p.y,`--c:${color}`);if(!r)return;
  done(r.animate([{opacity:.95,transform:'scale(.5)'},{opacity:0,transform:'scale(1.5)'}],{duration:ms,easing:'ease-out'}),r);}
 // A number that punches out of what was hit, overshoots and drifts up. Never budget-limited: it is information.
 function number(at,text,{kind='damage',size='',dx=0}={}){if(off())return;const p=center(at);if(!p)return;
  const n=doc.createElement('span');n.className='cs-mk-num';n.dataset.kind=kind;if(size)n.dataset.size=size;n.textContent=text;n.style.left=`${p.x+dx}px`;n.style.top=`${p.y-p.h*.15}px`;layer.append(n);
  const d=Math.random()*16-8;n.animate([{opacity:0,transform:'translate(-50%,-50%) translateY(8px) scale(.5)'},{opacity:1,transform:`translate(-50%,-50%) translate(${d*.4}px,-14px) scale(1.35)`,offset:.18},{opacity:1,transform:`translate(-50%,-50%) translate(${d*.7}px,-22px) scale(1)`,offset:.6},{opacity:0,transform:`translate(-50%,-50%) translate(${d}px,-40px)`}],{duration:1000,easing:'cubic-bezier(.2,.8,.3,1)',fill:'both'}).finished.then(()=>n.remove(),()=>n.remove());}
 // Move an element that already sits at its destination in from where it was, along a lifted arc.
 function arc(n,from,{lift=60,s0=1,mid=1.15,s1=1,r0=0,r1=0,ms=420,delay=0,easing='cubic-bezier(.3,.1,.3,1)'}={}){if(off()||!n)return null;const a=center(from),b=center(n);if(!a||!b)return null;
  const dx=a.x-b.x,dy=a.y-b.y;return n.animate([{transform:`translate(${dx}px,${dy}px) rotate(${r0}deg) scale(${s0})`},{transform:`translate(${dx/2}px,${dy/2-lift}px) rotate(${(r0+r1)/2}deg) scale(${mid})`,offset:.5},{transform:`rotate(${r1}deg) scale(${s1})`}],{duration:ms,delay,easing,fill:'backwards'});}
 // Arena strike with weight: wind-up, lunge, a short freeze on contact (hit-stop), spring back.
 // onHit runs at contact so the caller can pop numbers and shake the target in time with it.
 function strike(n,to,{reach=.78,ms=520,hold=70,delay=0,onHit}={}){if(off()||!n)return 0;const a=center(n),b=center(to);if(!a||!b)return 0;
  const dx=(b.x-a.x)*reach,dy=(b.y-a.y)*reach,tilt=Math.max(-8,Math.min(8,dx/30)),hit=.55,stop=Math.min(.8,hit+hold/ms);
  n.animate([{transform:'none'},{transform:`translate(${-dx*.06}px,${-dy*.06+6}px) scale(1.05) rotate(${-tilt/2}deg)`,offset:.3,easing:'cubic-bezier(.55,0,.85,.35)'},{transform:`translate(${dx}px,${dy}px) scale(1.16) rotate(${tilt}deg)`,offset:hit},{transform:`translate(${dx}px,${dy}px) scale(1.16) rotate(${tilt}deg)`,offset:stop,easing:'cubic-bezier(.3,.6,.3,1)'},{transform:'none'}],{duration:ms,delay});
  const at=delay+ms*hit;win.setTimeout(()=>{if(to?.isConnected===false)return;flash(to);sparks(to,{n:10,spread:56});onHit?.();},at);return at;}
 // Break a card into six shards and a few embers. Pass the card element (still in place) or a
 // snapshot {rect, html} taken before a redraw removed it.
 const SHARDS=['0 0,55% 0,40% 45%,0 35%','55% 0,100% 0,100% 30%,40% 45%','0 35%,40% 45%,30% 75%,0 70%','40% 45%,100% 30%,100% 65%,60% 60%','0 70%,30% 75%,45% 100%,0 100%','30% 75%,60% 60%,100% 65%,100% 100%,45% 100%'];
 function snapshot(n){const r=n?.getBoundingClientRect?.();return r&&r.width?{rect:{left:r.left,top:r.top,width:r.width,height:r.height},html:n.outerHTML}:null;}
 function shatter(src,{embers=8}={}){if(off())return;const s=src?.rect?src:snapshot(src);if(!s)return;const {left,top,width,height}=s.rect;
  if(src?.style&&src.isConnected)src.style.visibility='hidden';
  const piece=(clip)=>{if(live>=budget)return null;const w=doc.createElement('div');w.style.cssText=`left:${left}px;top:${top}px;width:${width}px;height:${height}px${clip?`;clip-path:polygon(${clip})`:''}`;w.innerHTML=s.html;const c=w.firstElementChild;if(c){c.style.visibility='visible';c.style.margin='0';c.style.width='100%';c.style.height='100%';c.style.transform='none';}layer.append(w);live++;return w;};
  if(lowPower){const w=piece('');if(w)done(w.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.85) translateY(-8px)'}],{duration:320,easing:'ease-in'}),w);return;}
  SHARDS.forEach((poly,i)=>{const w=piece(poly);if(!w)return;const cx=(i%2?1:-1)*(18+Math.random()*22),cy=-20-Math.random()*40+(i>3?24:0),r=Math.random()*60-30;
   done(w.animate([{transform:'none',opacity:1},{transform:`translate(${cx*.4}px,${cy*.3}px) rotate(${r*.3}deg)`,opacity:1,offset:.25},{transform:`translate(${cx}px,${cy}px) rotate(${r}deg) scale(.7)`,opacity:0}],{duration:620,easing:'cubic-bezier(.2,.6,.3,1)'}),w);});
  for(let i=0;i<embers;i++){const e=bit('cs-mk-dot',left+Math.random()*width,top+height*(.2+Math.random()*.7),'--c:#ff8a3d');if(!e)break;
   done(e.animate([{opacity:0,transform:'none'},{opacity:1,offset:.2},{opacity:0,transform:`translate(${(Math.random()-.5)*30}px,${-50-Math.random()*40}px) scale(.4)`}],{duration:700+Math.random()*300,delay:80+i*30,fill:'backwards'}),e);}}
 // A stand-in drawn at a viewport rect (a card that a redraw removed), for the caller to move and remove.
 function ghost(rect,html){if(off())return null;const w=doc.createElement('div');w.style.cssText=`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;w.innerHTML=html;const c=w.firstElementChild;if(c){c.style.width='100%';c.style.height='100%';}layer.append(w);return w;}
 // Tick a number from one value to another (life totals, gold, the tally).
 function countUp(n,from,to,ms=420){if(!n)return Promise.resolve();if(off()||from===to){n.textContent=String(to);return Promise.resolve();}
  const t0=win.performance.now();return new Promise(res=>{const step=t=>{const p=Math.min(1,(t-t0)/ms);n.textContent=String(Math.round(from+(to-from)*(1-(1-p)**2)));p<1?win.requestAnimationFrame(step):res();};win.requestAnimationFrame(step);});}
 // A face-down card turning face up: the element holds both faces (the back is rotated 180deg).
 function flip(n,{ms=380,delay=0,settle=1}={}){if(!n)return null;if(off()){n.style.transform='rotateY(180deg)';return null;}
  return n.animate([{transform:'rotateY(0)'},{transform:'rotateY(90deg) scale(1.12)',offset:.5},{transform:`rotateY(180deg) scale(${settle})`}],{duration:ms,delay,easing:'cubic-bezier(.3,.1,.3,1)',fill:'both'});}
 return {layer,lowPower,ghost,arc,strike,number,shatter,snapshot,sparks,flash,ring,shake,bump,countUp,flip,destroy(){layer.remove();}};
}
if(typeof window!=='undefined')window.CSMotion={createMotion};
export {createMotion};export default createMotion;
