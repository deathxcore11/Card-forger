// App-wide motion, kept light: a page eases in from the side of the tab you came from, the first
// tiles of a grid rise in a quick cascade, and the tab you landed on gives a small bump. It only
// runs when the view changes (body[data-view]), never on ordinary re-renders, and uses transform
// and opacity alone. Reduced motion turns it off; low power keeps the page fade and drops the cascade.
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
