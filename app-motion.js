// App-wide motion, kept light: a page eases in from the side of the tab you came from, the first
// tiles of a grid rise in a quick cascade, and the tab you landed on gives a small bump. It only
// runs when the view changes (body[data-view]), never on ordinary re-renders, and uses transform
// and opacity alone. Reduced motion turns it off; low power keeps the page fade and drops the cascade.
import {createMotion} from './experiments/forge-proof/motion-kit.mjs';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower=(()=>{let p='';try{p=localStorage.getItem('cardstashy.lowPower')||'';}catch{}if(p==='on')return true;if(p==='off')return false;
 const n=navigator,ua=n.userAgent||'';return window.Capacitor?.getPlatform?.()==='android'||/Android/i.test(ua)&&/; wv\)/.test(ua)||!!(n.deviceMemory&&n.deviceMemory<=3);})();
const ORDER=['home','sets','collection','search','decks','scan','play','settings'];
const rank=view=>{const i=ORDER.indexOf(view==='deck'?'decks':['set','wiki'].includes(view)?'search':view);return i<0?ORDER.length:i;};
// The first grid-like block in the page: a container whose children are mostly the same kind of tile.
function tiles(root){
 for(const box of root.querySelectorAll('[class*=grid],[class*=cards],[class*=tiles],ul,ol')){
  const kids=[...box.children].filter(k=>k.offsetParent!==null);if(kids.length<4)continue;
  const tag=kids[0].tagName,cls=kids[0].classList[0];if(kids.filter(k=>k.tagName===tag&&k.classList[0]===cls).length<kids.length*.8)continue;
  return kids.filter(k=>{const r=k.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).slice(0,18);
 }
 return [];
}
function enter(from,to){
 const content=document.getElementById('content');if(!content||reduced())return;
 const dir=Math.sign(rank(to)-rank(from))||0;
 content.animate([{opacity:0,transform:`translateX(${dir*14}px)`},{opacity:1,transform:'none'}],{duration:lowPower?160:240,easing:'cubic-bezier(.2,.8,.3,1)'});
 const tab=document.querySelector('[data-nav].on');tab?.animate([{transform:'scale(1)'},{transform:'scale(1.08)',offset:.4},{transform:'scale(1)'}],{duration:260,easing:'ease-out'});
 if(lowPower)return;
 // Wait a frame so the new page has laid out before measuring its tiles.
 requestAnimationFrame(()=>tiles(content).forEach((t,i)=>t.animate([{opacity:0,transform:'translateY(10px) scale(.98)'},{opacity:1,transform:'none'}],{duration:260,delay:60+i*26,easing:'cubic-bezier(.2,.8,.3,1)',fill:'backwards'})));
}
let view=document.body.dataset.view||'';
new MutationObserver(()=>{const next=document.body.dataset.view||'';if(next===view)return;const prev=view;view=next;if(prev)enter(prev,next);}).observe(document.body,{attributes:true,attributeFilter:['data-view']});

// Match flow flair for Quick Play and Practice: the versus screen, the coin landing and the result.
// It only decorates what play-forge-pregame.js and play-forge-player-mat.js already rendered and
// never changes their state. The fx layer sits above the player mat (z 2000).
if(lowPower)document.documentElement.classList.add('cs-low-power');
let fx=null;const kit=()=>{if(!fx){fx=createMotion({lowPower});fx.layer.style.zIndex='2450';}return fx;};
const haptic=ms=>{try{navigator.vibrate?.(ms);}catch{}};
const seen=new WeakSet(),once=n=>n&&!seen.has(n)&&(seen.add(n),true);
const YOU='#7fd0ff',CPU='#f0c27a',GOLD='#f2d496';
function versus(stage){
 const vs=stage.querySelector('.forge-intro-vs'),row=stage.querySelector('.forge-intro-versus');
 // The seats meet in the middle at about 560 ms; the VS slams down as they do.
 setTimeout(()=>{if(!stage.isConnected)return;const M=kit();
  for(const seat of stage.querySelectorAll('.forge-intro-seat')){const s=document.createElement('span');s.className='cs-vs-sheen';s.setAttribute('aria-hidden','true');seat.append(s);}
  if(vs?.offsetParent){M.ring(vs,GOLD,560);M.flash(vs,.8);M.sparks(vs,{n:10,color:GOLD,spread:70});}
  M.shake(row,lowPower?3:6,320);haptic(18);},560);
}
function landed(toss){
 const coin=toss.querySelector('.forge-intro-coin'),you=coin?.dataset.result==='you',c=you?YOU:CPU,M=kit();
 M.ring(coin,c,620);M.sparks(coin,{n:10,color:c,spread:64});haptic(you?20:12);
 toss.querySelector('h2')?.animate([{opacity:0,transform:'scale(1.5)'},{opacity:1,transform:'scale(.96)',offset:.6},{transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});
}
function result(panel){
 const out=panel.dataset.outcome,banner=panel.querySelector('h1+p'),M=kit();if(!banner)return;
 const rest=[...panel.children].filter(n=>n!==banner&&n.tagName!=='H1');
 rest.forEach((n,i)=>n.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:320,delay:520+i*50,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
 if(out==='win'){
  banner.animate([{opacity:0,transform:'scale(.55)'},{opacity:1,transform:'scale(1.08)',offset:.6},{transform:'none'}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
  setTimeout(()=>{if(!banner.isConnected)return;const r=banner.getBoundingClientRect(),rays=document.createElement('span');rays.className='cs-win-rays';rays.style.left=r.left+r.width/2+'px';rays.style.top=r.top+r.height/2+'px';M.layer.append(rays);
   rays.animate([{opacity:0,transform:'rotate(0) scale(.6)'},{opacity:1,transform:'rotate(25deg) scale(1)',offset:.25},{opacity:0,transform:'rotate(70deg) scale(1.15)'}],{duration:lowPower?900:1600,easing:'ease-out',fill:'both'}).finished.then(()=>rays.remove(),()=>rays.remove());
   M.sparks(banner,{n:12,color:GOLD,spread:120});haptic(30);},300);
 }else if(out==='loss'){
  banner.animate([{opacity:0,transform:'translateY(-28px)'},{opacity:1,transform:'translateY(4px)',offset:.7},{transform:'none'}],{duration:700,easing:'cubic-bezier(.5,0,.3,1)',fill:'backwards'});
  setTimeout(()=>{if(banner.isConnected)M.shake(banner,4,260);},490);
 }else banner.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:400,easing:'ease-out',fill:'backwards'});
}
function scanMatch(){
 if(reduced())return;const mat=document.getElementById('practicePlayerMat');if(!mat)return;
 const stage=mat.querySelector('.forge-match-intro');if(once(stage))versus(stage);
 const toss=mat.querySelector('.forge-intro-toss.is-landed');if(once(toss))landed(toss);
 const panel=mat.querySelector('.play-match-result[data-outcome]');if(once(panel))result(panel);
}
// Watch the player mat only while it exists; the body is watched just for the mat coming and going.
let matchQueued=0,watched=null;const matObs=new MutationObserver(()=>{if(!matchQueued)matchQueued=requestAnimationFrame(()=>{matchQueued=0;scanMatch();});});
const attach=()=>{const mat=document.getElementById('practicePlayerMat');if(mat===watched)return;matObs.disconnect();watched=mat;if(mat){matObs.observe(mat,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});scanMatch();}};
new MutationObserver(attach).observe(document.body,{childList:true});attach();
