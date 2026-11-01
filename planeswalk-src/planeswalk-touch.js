/* Planeswalk touch + app layer (look thread). Inline after the game script.
   Long-press (or right-click) a card or creature to see it full size; Android back closes
   overlays, then asks before leaving a run; haptics on big hits, Fury and callouts.
   Reads the game's globals (view, run) only to decide whether a run is in progress. */
(()=>{
 const app=document.getElementById('app');if(!app)return;
 /* a painted figure's frame overhangs its unit (cast.css): aim and lock on the body, which is the unit's own width, at the frame's height */
 const bodyRect=u=>{const a=u.querySelector('.art'),r=(a||u).getBoundingClientRect();if(!a||!u.classList.contains('pw-fig'))return r;const q=u.getBoundingClientRect();return {left:q.left,right:q.right,width:q.width,top:r.top,bottom:r.bottom,height:r.height,x:q.left,y:r.top}};
 const LP=420;let fired=false,skipPop=false,lastBuzz=0,liftAt=0;const held=new Map();let zoomPid=null;

 // no buzz under reduced motion (the in-game switch or the phone's own setting)
 const buzz=ms=>{const now=Date.now();if(now-lastBuzz<150)return;if(document.documentElement.classList.contains('pw-calm')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;lastBuzz=now;
  try{const H=window.Capacitor?.Plugins?.Haptics;if(H)H.impact({style:ms>=50?'HEAVY':ms>=25?'MEDIUM':'LIGHT'});else navigator.vibrate?.(ms)}catch{}};
 window.pwHaptic=buzz;


 // What a creature does, from the game's own data, so the zoom answers "what is this?".
 const esc=t=>String(t).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
 function panel(html){const d=document.createElement('div');d.className='pw-info';d.innerHTML=html;d.querySelectorAll('[data-act]').forEach(x=>x.remove());return d}
 function describe(el){
  try{
   if(typeof c==='undefined'||!c)return null;const id=+el.dataset.id;
   if(el.closest('.side.foe')&&typeof enemyInfo==='function'){const e=c.enemies.find(x=>x.id===id);return e?panel(enemyInfo(e)):null}
   if(el.classList.contains('hero')){const ab=[...document.querySelectorAll('.controls [data-act=plus],.controls [data-act=minus],.controls [data-act=ult]')].map(b=>esc(b.textContent.trim()));
    return panel(`<b>${esc(typeof HERO!=='undefined'&&HERO?HERO.name:'Planeswalker')}</b><span class="muted"> · Planeswalker · Loyalty ${esc(c.loyalty)}</span>${ab.length?`<p>${ab.join('<br>')}</p>`:''}<p>Loyalty carries between fights.</p>`)}
   if(el.classList.contains('ally')){const a=c.allies.find(x=>x.id===id);if(!a)return null;
    const d=typeof C!=='undefined'&&Object.values(C).find(x=>x.name===a.name);const kw=typeof kws==='function'?kws(a):'';
    const st=(el.classList.contains('front')?'Holds the front: blocks first. ':'')+(a.sick?'Just arrived: can block, attacks next turn.':a.tapped?'Attacked this turn: cannot block.':'Ready to attack.');
    return panel(`<b>${esc(a.name)}</b><span class="muted"> · ${typeof pow==='function'?pow(a):a.p}/${typeof tough==='function'?tough(a)-a.dmg:a.t}</span>${d?`<p>${esc(d.text(false))}</p>`:''}${kw?`<p>${esc(kw)}</p>`:''}<p>${st}</p>`)}
  }catch{}
  return null;
 }
 const zoomOpen=()=>document.querySelector('.pw-zoom:not(.pw-peek)');
 const unpeek=()=>{document.querySelectorAll('.pw-zoom.pw-peek').forEach(x=>x.remove());document.querySelectorAll('.pw-peeked').forEach(x=>x.classList.remove('pw-peeked'))};
 let back=null;
 function closeZoom(fromPop){const o=zoomOpen();if(!o)return false;o.remove();if(!fromPop&&history.state?.pwZoom){skipPop=true;history.back()}
  const b=back;back=null;if(b&&b.isConnected)try{b.focus({preventScroll:true})}catch{}return true}
 const xBtn=box=>{const x=document.createElement('button');x.type='button';x.className='pw-x';x.setAttribute('aria-label','Close');x.textContent='✕';box.prepend(x);setTimeout(()=>x.focus({preventScroll:true}),0)};
 const NODE={fight:'Minions: a normal fight. Win a card reward.',elite:'Legendary: a dangerous fight. Better rewards, including emblems.',rest:'Rest: heal, foil a card, or burn one.',event:'Event: a stranger offer. Read carefully.',treasure:'Treasure: a free card, sometimes an emblem, and 20 to 30 gold.',shop:'Shop: buy cards and emblems, or pay to remove a card.',bargain:'Bargain: power for a price.',boss:'The act boss. Beat them to heal to full and move on.'};
 // the dungeon tells you what is inside before you commit: rooms, its rule, who waits in room 1, the heal between rooms
 const dunInfo=()=>{try{const act=run.act||1,D=DUN[act],A=ACTS[act],ez=A.easy||EASY;const who=[...new Set(ez.flat().map(k=>E[k]?.name).filter(Boolean))].slice(0,3);
  return `${D.rooms} fights in a row, healing 15% between rooms. ${D.rule} Room 1: ${who.join(', ')}. Clear it for a dungeon emblem.`}catch{return ''}};
 function zoom(el,pid){
  closeZoom();unpeek();zoomPid=pid??null;
  if(el.matches('.node')){const box=document.createElement('div');box.className='pw-zoom has-info';box.setAttribute('role','dialog');
   const name=el.querySelector('.nl')?.textContent.trim()||[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||el.dataset.t;box.classList.add('pw-node-zoom');box.append(panel(`<b>${esc(name)}</b><p>${esc(el.dataset.t==='dungeon'&&dunInfo()||(NODE[el.dataset.t]||'').replace(/^[^:]+:\s*/,'').replace(/^./,m=>m.toUpperCase()))}</p>`));
   box.addEventListener('click',()=>closeZoom());back=el;xBtn(box);document.body.append(box);history.pushState({pwZoom:1},'');buzz(10);return}
  const box=document.createElement('div');box.className='pw-zoom';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  const copy=document.createElement('div');copy.className=el.className.replace(/\b(struck|acting|aim|chosen|ready)\b/g,'');
  for(const a of ['data-n','data-rar'])if(el.hasAttribute(a))copy.setAttribute(a,el.getAttribute(a));
  copy.innerHTML=el.innerHTML;copy.querySelectorAll('.pop,.incoming').forEach(x=>x.remove());copy.querySelectorAll('[style]').forEach(x=>x.removeAttribute('style'));
  const info=describe(el);if(info){box.classList.add('has-info');}
  box.append(copy);if(info)box.append(info);box.addEventListener('click',()=>{if(Date.now()-liftAt>400)closeZoom()});back=el;xBtn(box);
  // while the finger that opened it is still down, a second finger reaches the board through it
  if(zoomPid!=null)box.classList.add('pw-holding');
  document.body.append(box);history.pushState({pwZoom:1},'');buzz(10);
 }

 // Two fingers: one finger holds a card or creature to read it while another drags a card.
 // A zoom held open becomes a small read-only peek once a drag starts; it goes when that finger lifts.
 window.pwPeek=()=>{const o=zoomOpen();if(!o||zoomPid==null||!o.classList.contains('pw-holding'))return false;
  const el=back,pid=zoomPid;o.remove();if(history.state?.pwZoom){skipPop=true;history.back()}back=null;if(el&&el.isConnected){peekAt(el);zoomPid=pid}return true};
 // the peek is a small text box under the HUD, so life, the board and the arrow stay in view
 const peekAt=el=>{let info=describe(el);
  if(!info&&el.matches('.card')){const t=q=>esc(el.querySelector(q)?.textContent.trim()||'');
   info=panel(`<b>${esc(el.dataset.n||t('.head b'))}</b><span class="muted"> · ${t('.cost')} energy · ${t('.kind')}</span><p>${t(':scope>span:last-child')}</p>`)}
  if(!info)return;const o=document.createElement('div');o.className='pw-zoom pw-peek';o.setAttribute('aria-hidden','true');o.append(info);
  const hud=document.querySelector('#app .top');o.style.top=Math.round((hud?hud.getBoundingClientRect().bottom:48)+8)+'px';
  document.body.append(o);el.classList.add('pw-peeked');buzz(10)};
 app.addEventListener('pointerdown',e=>{const el=e.target.closest('.card,.unit,.map .node');if(!held.size)fired=false;if(!el||e.button>0)return;
  const h={el,sx:e.clientX,sy:e.clientY,t:0};held.set(e.pointerId,h);
  h.t=setTimeout(()=>{h.t=0;if(zoomOpen())return;fired=true;
   if(document.documentElement.classList.contains('pw-dragging')){unpeek();peekAt(el);zoomPid=e.pointerId}
   else zoom(el,e.pointerType==='mouse'?null:e.pointerId)},LP)},{passive:true});
 app.addEventListener('pointermove',e=>{const h=held.get(e.pointerId);if(h&&h.t&&Math.hypot(e.clientX-h.sx,e.clientY-h.sy)>10){clearTimeout(h.t);h.t=0}},{passive:true});
 for(const k of ['pointerup','pointercancel'])addEventListener(k,e=>{const h=held.get(e.pointerId);if(h){clearTimeout(h.t);held.delete(e.pointerId)}
  if(e.pointerId===zoomPid){zoomPid=null;liftAt=Date.now();unpeek();document.querySelector('.pw-zoom.pw-holding')?.classList.remove('pw-holding')}},{passive:true});
 app.addEventListener('click',e=>{if(fired&&e.isTrusted){fired=false;e.stopPropagation();e.preventDefault()}},true);
 addEventListener('keydown',e=>{if(e.key!=='Escape')return;
  const top=closeZoom()||closeHelp()||(()=>{const b=document.querySelector('[data-act=giftok],[data-act=closeinspect]');if(b){b.click();return true}})();
  if(top){e.preventDefault();e.stopImmediatePropagation()}});
 app.addEventListener('contextmenu',e=>{const el=e.target.closest('.card,.unit,.map .node');if(!el)return;e.preventDefault();if(!fired&&!document.documentElement.classList.contains('pw-dragging'))zoom(el)});

 // Android back button: Capacitor and the WebView both route it through history.
 history.replaceState({pwBase:1},'');history.pushState({pwGuard:1},'');
 const guard=()=>history.pushState({pwGuard:1},'');
 addEventListener('popstate',()=>{
  if(skipPop){skipPop=false;return}
  if(closeZoom(true))return;
  if(closeHelp())return guard();
  const gk=document.querySelector('[data-act=giftok]');if(gk){gk.click();return guard()}
  const deck=document.querySelector('details.deck[open]');if(deck){deck.open=false;return guard()}
  const insp=document.querySelector('[data-act="closeinspect"]');if(insp){insp.click();return guard()}
  const inRun=typeof run!=='undefined'&&run&&typeof view!=='undefined'&&!['victory','defeat','over'].includes(view);
  if(inRun&&!confirm('Leave Planeswalk? Your run is saved, so you can pick it up later.'))return guard();
  const A=window.Capacitor?.Plugins?.App;if(A?.exitApp)A.exitApp();else history.back();
 });

 // New run asks once, in the game's own handler (it only asks when the run has progress).

 // Haptics on the big moments, read from what the game renders.
 let helpFrom=null;
 function closeHelp(){const h=document.querySelector('.pw-help');if(!h)return false;h.remove();const b=helpFrom;helpFrom=null;if(b&&b.isConnected)try{b.focus({preventScroll:true})}catch{}return true}
 function openHelp(from){helpFrom=from;const h=document.createElement('div');h.className='pw-menu pw-help';
  const card=document.createElement('div');card.className='pw-menu-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','How to play');card.setAttribute('data-audit-scroll','');
  card.innerHTML='<h2>How to play</h2>';app.querySelectorAll('details.howto>p').forEach(p=>card.append(p.cloneNode(true)));
  const ok=document.createElement('button');ok.type='button';ok.className='btn main';ok.textContent='Back to the game';card.append(ok);
  const rec=app.querySelector('.note.record');if(rec){const r=rec.cloneNode(true);r.classList.add('pw-credits');card.append(r)}
  h.append(card);xBtn(card);h.addEventListener('click',e=>{if(e.target===h||e.target.closest('.pw-x')||e.target===ok)closeHelp()});document.body.append(h);buzz(8)}
 const infoBtn=()=>{const top=app.querySelector('.top');if(!top||top.querySelector('.pw-infobtn'))return;
  const b=document.createElement('button');b.className='btn pw-infobtn';b.type='button';b.setAttribute('aria-label','How to play and credits');b.textContent='?';
  b.addEventListener('click',()=>{if(!closeHelp())openHelp(b)});
  top.querySelector('details.deck')?.before(b)};
 const sndBtn=()=>{const sec=app.querySelector(':scope>section');if(!sec||app.querySelector(':scope>.pw-sndbtn'))return;
  const sb=document.createElement('button');sb.className='btn pw-sndbtn';sb.type='button';
  const sync=()=>{let on=true;try{on=window.pwSound?window.pwSound.on:localStorage.getItem('pw-sound')!=='off'}catch{}sb.textContent=on?'\u266B Sound: on':'\u266B Sound: off';sb.setAttribute('aria-pressed',on)};
  sb.addEventListener('click',()=>{window.pwSound?.toggle();sync()});sync();sec.after(sb)};
 infoBtn();sndBtn();
 new MutationObserver(()=>{infoBtn();sndBtn();
  if(app.querySelector('.callout'))buzz(60);
  else if(app.querySelector('.battle.quake2'))buzz(45);
  else if(app.querySelector('.pop.big'))buzz(25);
 }).observe(app,{childList:true});
})();

/* Juice chime: each new chip on the turn tally plays a short tone that climbs in pitch,
   mult chips a fifth higher. Quiet, only after the player has touched the page. */
(()=>{let ctx=null,last=0,step=0,on=true;
 try{on=localStorage.getItem('pw-sound')!=='off'}catch{}
 window.pwSound={get on(){return on},toggle(){on=!on;try{localStorage.setItem('pw-sound',on?'on':'off')}catch{}}};
 const unlock=()=>{try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();ctx.resume()}catch{}};
 addEventListener('pointerdown',unlock,{once:true,passive:true});
 const tone=(mul)=>{if(!on||!ctx||ctx.state!=='running'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain(),f=440*Math.pow(2,(Math.min(step,12)+(mul?7:0))/12);
  o.type='triangle';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.5,t+.05);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.04,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.22);
  o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.25)};
 const app=document.getElementById('app');if(!app)return;
 new MutationObserver(()=>{const n=app.querySelectorAll('.tally .juice i').length,b=[...app.querySelectorAll('.tally .juice b')].reduce((s,x)=>s+(parseInt(x.textContent.slice(1))||0),0),k=n*100+b;
  if(k>last){step=n===1&&last===0?0:step+1;tone(app.querySelector('.tally .juice i:last-child')?.classList.contains('mul'));window.pwHaptic?.(12)}
  if(k<last||!n)step=0;last=k}).observe(app,{childList:true});
})();

/* Map paths: each node links to 1-2 nodes in the next row (run.edges; old saves link every neighbour,
   every last-row node leads to the boss). Links are curves: walked ones brass, the ways forward from where
   you stand flow gold, the rest stay faint. Hovering or holding a node lights every route it leads to. */
(()=>{const app=document.getElementById('app');if(!app)return;const NS='http://www.w3.org/2000/svg';
 const R=()=>typeof run!=='undefined'?run:null;
 const nexts=(r,l)=>{const g=R();if(!g)return [];if(r===6)return ['7:1'];if(r>6)return [];
  const row=g.map[r+1]||[];return [0,1,2].filter(x=>row[x]&&(g.edges?g.edges[r].some(([a,b])=>a===l&&b===x):Math.abs(l-x)<=1)).map(x=>(r+1)+':'+x)};
 // a stable wobble per link, so curves don't change between redraws
 const wob=k=>{let x=0;for(const ch of k+(typeof seed!=='undefined'?seed:0))x=Math.imul(x^ch.charCodeAt(0),2654435761);x^=x>>>15;return ((x>>>0)%1000)/1000-.5};
 const draw=()=>{const map=app.querySelector('.map');if(!map)return;let svg=map.querySelector(':scope>svg.pw-paths');
  if(!svg){svg=document.createElementNS(NS,'svg');svg.setAttribute('class','pw-paths');svg.setAttribute('aria-hidden','true');map.prepend(svg)}
  const mr=map.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${mr.width} ${mr.height}`);
  // centre of each node's circle from layout, not from the (animated) glyph, so lines always meet the centre
  const nodes={};map.querySelectorAll('.node[data-r]').forEach(n=>{const r=n.getBoundingClientRect(),k=n.offsetWidth?r.width/n.offsetWidth:1,cs=getComputedStyle(n,'::before');
   const ns=parseFloat(cs.height)||r.width/k,mt=parseFloat(cs.marginTop)||0,pt=parseFloat(getComputedStyle(n).paddingTop)||0;
   nodes[n.dataset.r+':'+n.dataset.l]={el:n,x:r.left+r.width/2-mr.left,y:r.top+(pt+mt+ns/2)*k-mr.top}});
  const g=R();const done=new Set(g?.done||[]);const pos=g?.pos?g.pos.r+':'+g.pos.l:null;const startOpen=!pos;
  let out='';
  for(const key of Object.keys(nodes)){const [r,l]=key.split(':').map(Number);if(r>6)continue;const a=nodes[key];
   for(const k of nexts(r,l)){const b=nodes[k];if(!b)continue;const walked=done.has(key)&&done.has(k);const ahead=pos===key&&b.el.classList.contains('open');
    const behind=g?.pos&&r<g.pos.r&&!walked;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,d=wob(key+'>'+k)*len*.32;
    const p1=[a.x+dx/3+nx*d,a.y+dy/3+ny*d],p2=[a.x+dx*2/3-nx*d,a.y+dy*2/3-ny*d];
    out+=`<path class="${walked?'walked':ahead?'ahead':behind?'behind':'future'}" data-a="${key}" data-b="${k}" d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}"/>`}}
  svg.innerHTML=out;if(lit)light(lit)};
 // route preview: everything reachable from the node under the pointer (or finger) stays lit, the rest dims
 let lit=null;
 const light=key=>{const map=app.querySelector('.map');if(!map)return;lit=key;const reach=new Set([key]),q=[key];
  while(q.length){const [r,l]=q.shift().split(':').map(Number);for(const k of nexts(r,l))if(!reach.has(k)){reach.add(k);q.push(k)}}
  map.classList.add('pw-cascade');map.querySelectorAll('.node[data-r]').forEach(n=>n.classList.toggle('pw-reach',reach.has(n.dataset.r+':'+n.dataset.l)));
  map.querySelectorAll('svg.pw-paths path').forEach(p=>p.classList.toggle('pw-reach',reach.has(p.dataset.a)&&reach.has(p.dataset.b)))};
 const unlight=()=>{lit=null;const map=app.querySelector('.map');if(!map)return;map.classList.remove('pw-cascade');map.querySelectorAll('.pw-reach').forEach(x=>x.classList.remove('pw-reach'))};
 const nodeOf=e=>e.target.closest?.('.map .node[data-r]');
 app.addEventListener('pointerover',e=>{const n=nodeOf(e);if(n&&e.pointerType==='mouse')light(n.dataset.r+':'+n.dataset.l)});
 app.addEventListener('pointerout',e=>{const n=nodeOf(e);if(n&&e.pointerType==='mouse'&&!n.contains(e.relatedTarget))unlight()});
 app.addEventListener('pointerdown',e=>{const n=nodeOf(e);if(n&&e.pointerType!=='mouse')light(n.dataset.r+':'+n.dataset.l)},{passive:true});
 for(const t of ['pointerup','pointercancel'])addEventListener(t,e=>{if(e.pointerType!=='mouse'&&lit)unlight()},{passive:true});
 app.addEventListener('focusin',e=>{const n=nodeOf(e);if(n)light(n.dataset.r+':'+n.dataset.l)});
 app.addEventListener('focusout',e=>{if(nodeOf(e))unlight()});
 let raf=0;const later=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)};
 new MutationObserver(()=>{lit=null;later();setTimeout(later,350)}).observe(app,{childList:true});addEventListener('resize',later);addEventListener('pw-fit',later);document.fonts?.ready.then(later);later();
})();

/* Deck pick lists: identical cards share one tile with a ×N badge (foiled copies stay separate),
   and removing a card takes two taps, since it leaves the deck for good. */
(()=>{const app=document.getElementById('app');if(!app)return;const RM=['remove','shopremove'];
 const tidy=()=>{app.querySelectorAll('.screen .choices').forEach(ch=>{const cards=[...ch.querySelectorAll(':scope>.card[data-act]')];
  if(cards.length<5||ch.dataset.pwGrouped)return;ch.dataset.pwGrouped=1;const seen={};
  for(const c of cards){const k=c.dataset.n+'|'+c.classList.contains('foil');if(seen[k]){seen[k].dataset.count=(+seen[k].dataset.count||1)+1;c.hidden=true}else seen[k]=c}})};
 app.addEventListener('click',e=>{const c=e.target.closest('.card[data-act]');if(!c||!RM.includes(c.dataset.act))return;
  if(c.classList.contains('pw-armed'))return;e.stopImmediatePropagation();e.preventDefault();
  app.querySelectorAll('.pw-armed').forEach(x=>{x.classList.remove('pw-armed');x.querySelector('.pw-confirm')?.remove()});
  c.classList.add('pw-armed');const s=document.createElement('span');s.className='pw-confirm';s.textContent=c.dataset.act==='shopremove'?'Tap again to remove':'Tap again to burn';c.append(s);window.pwHaptic?.(15)},true);
 new MutationObserver(tidy).observe(app,{childList:true});tidy();
})();
// Guard links: draw a dashed arc from each ally[data-guard] to the enemy it guards.
(()=>{const app=document.getElementById('app');if(!app)return;let raf=0;
 const draw=()=>{raf=0;const f=app.querySelector('.field');if(!f)return;let s=f.querySelector(':scope>svg.pw-guards');
  const gs=[...f.querySelectorAll('.unit[data-guard]')];if(!gs.length){if(s)s.remove();return}
  if(!s){s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('class','pw-guards');s.setAttribute('aria-hidden','true');f.appendChild(s)}
  const R=f.getBoundingClientRect();let h='';
  for(const a of gs){const e=f.querySelector(`.side.foe .unit[data-id="${a.dataset.guard}"]`);if(!e)continue;
   const A=bodyRect(a),B=bodyRect(e);
   const ax=A.left+A.width/2,ay=A.top+A.height/2,bx=B.left+B.width/2,by=B.top+B.height/2,side=Math.abs(bx-ax)>Math.abs(by-ay);let x1,y1,x2,y2,cx,cy;
   if(side){x1=(bx>ax?A.right:A.left)-R.left;y1=A.bottom-8-R.top;x2=bx-R.left;y2=B.bottom-R.top;cx=(x1+x2)/2;cy=Math.max(y1,y2)+26}
   else{x1=ax-R.left;y1=(by>ay?A.bottom:A.top)-R.top;x2=bx-R.left;y2=(by>ay?B.top:B.bottom)-R.top;cx=(x1+x2)/2+18;cy=(y1+y2)/2}
   h+=`<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}"/><circle cx="${x2}" cy="${y2}" r="2.5"/>`}
  s.innerHTML=h};
 const q=()=>{if(!raf)raf=requestAnimationFrame(draw)};const mine=n=>n&&n.nodeType===1&&(n.matches('svg.pw-guards')||!!n.closest('svg.pw-guards'));new MutationObserver(ms=>{if(ms.some(m=>!mine(m.target)&&![...m.addedNodes,...m.removedNodes].every(mine)||m.type==='attributes'))q()}).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['data-guard']});addEventListener('resize',q);addEventListener('pw-cam',q);q()})();
// Tablets and foldables: reuse the phone layouts and scale them up so they fill the screen instead of clipping.
(()=>{const app=document.getElementById('app');if(!app)return;const de=document.documentElement;
 const fit=()=>{const W=innerWidth,H=innerHeight,port=W/H<0.8,coarse=matchMedia('(pointer:coarse)').matches;let z=1;
  z=port?Math.min(W/400,H/700):Math.min(W/640,H/470);
  z=Math.max(1,Math.min(2.4,Math.round(z*100)/100));
  if(z>1){app.dataset.pwZoom='';de.style.setProperty('--pw-zoom',z)}else{delete app.dataset.pwZoom;de.style.removeProperty('--pw-zoom')}
  de.style.setProperty('--pw-vh',(H/z)+'px');if(!port&&H/z>=430)app.dataset.pwTall='';else delete app.dataset.pwTall;if(port&&H/z>=760)app.dataset.pwTallp='';else delete app.dataset.pwTallp;if(!port&&H/z>=560)app.dataset.pwRoomy='';else delete app.dataset.pwRoomy;window.dispatchEvent(new Event('pw-fit'))};
 addEventListener('resize',fit);addEventListener('orientationchange',()=>setTimeout(fit,120));fit()})();
/* tally: hide it until the turn has dealt damage (data-zero on .tally) */
(()=>{const app=document.getElementById('app');if(!app)return;
 const mark=()=>{const t=app.querySelector('.battle .tally');if(!t)return;const n=[...t.childNodes].filter(x=>x.nodeType===3).map(x=>x.textContent).join('').trim();
  if(n===''||n==='0')t.dataset.zero='';else delete t.dataset.zero};
 new MutationObserver(mark).observe(app,{childList:true,subtree:true,characterData:true});mark()})();
/* keyword badges: turn each unit's keyword text into icon badges on the art (full word stays in title/aria) */
(()=>{const app=document.getElementById('app');if(!app)return;
 const run=()=>{for(const kw of app.querySelectorAll('.unit .kw')){const u=kw.closest('.unit');const t=kw.textContent.trim().toLowerCase();const have=u.querySelector(':scope>.pw-kws');
  if(have&&have.dataset.t===t)continue;if(have)have.remove();if(!t)continue;
  const box=document.createElement('span');box.className='pw-kws';box.dataset.t=t;box.setAttribute('aria-hidden','true');
  for(const k of t.split(' · ')){const i=document.createElement('i');i.dataset.k=k;i.title=k[0].toUpperCase()+k.slice(1);if(!/^(flying|haste|reach|first strike|vigilance|lifelink|defender|trample|deathtouch)$/.test(k))i.textContent=k.slice(0,2).toUpperCase();box.append(i)}
  // keyword rail: at most 3 badges, the rest fold into +N (the long-press legend lists them all)
  const all=[...box.children];if(all.length>3){for(const i of all.slice(2))i.hidden=true;const m=document.createElement('i');m.className='pw-more';m.textContent='+'+(all.length-2);box.append(m)}
  u.append(box)}};
 let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;run()})}}).observe(app,{childList:true,subtree:true});run()})();
/* Drag and drop in battle (Randall: "a lot should be drag and drop").
   Drag a hand card onto an enemy/ally to cast it there, or up onto the board to play it.
   Drag a ready creature onto an enemy to attack. Drag an ally onto your front ally to move it to the front.
   A drop only replays the game's own taps (same data-act buttons), so rules stay in the game. Taps still work. */
(()=>{const app=document.getElementById('app');if(!app)return;
 const de=document.documentElement,TH=9;let d=null,swallow=false;
 const G=()=>typeof c!=='undefined'?c:null;
 const tap=sel=>{const el=app.querySelector(sel);if(el&&!el.disabled){el.click();return true}return false};
 const zoom=()=>parseFloat(getComputedStyle(de).getPropertyValue('--pw-zoom'))||1;
 const under=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&el.closest('.unit')};
 let shown=null;
 const clear=()=>{shown=null;app.querySelectorAll('.pw-drop').forEach(x=>x.classList.remove('pw-drop'));app.querySelectorAll('.pw-prev,.pw-hpghost').forEach(x=>x.remove())};
 // what the drop would do to the hovered foe ("8 → 5", "dies"); only for plain damage, the game still decides
 // the game works this out by playing its real rules on a copy, so buffs, shields and emblems all count
 const preview=(u,D)=>{if(!u.closest('.side.foe')||typeof pwPreview!=='function')return;let r=null;
  try{r=pwPreview(D.kind,D.kind==='ally'?+D.id:+D.i,+u.dataset.id)}catch{}
  if(!r||r.same&&!r.allyDies)return;const b=document.createElement('span');b.className='pw-prev';
  if(r.dies)b.dataset.dies='';b.textContent=(r.dies?'':r.same?'no damage':`${r.hp} → ${r.left}`)+(r.allyDies?' · yours dies':'');if(r.dies){b.insertAdjacentHTML('afterbegin',typeof ico==='function'?ico('skull'):'☠');b.setAttribute('role','img');b.setAttribute('aria-label','Dies')}u.append(b);
  // the slice of life the hit takes flashes on the bar, like Spire's 1/7
  const i=u.querySelector('.bar>i'),was=i&&parseFloat(i.style.width);if(i&&r.hp>0&&r.left<r.hp){const g=document.createElement('b');g.className='pw-hpghost';const now=was*r.left/r.hp;g.style.left=now+'%';g.style.width=was-now+'%';i.parentNode.append(g)}};
 const valid=(u,D=d)=>{if(!D||!u)return false;
  if(D.kind==='card')return true;
  if(D.kind==='ally'){if(u.closest('.side.foe'))return D.ready;return u.classList.contains('ally')&&u!==D.el&&u.classList.contains('front')&&!!app.querySelector('.controls [data-act=arrange]')}
  return false};
 // which drags aim: targeted spells and attacking creatures get a curved arrow instead of a flying card
 const aimOf=D=>{if(D.kind==='ally')return D.ready?'enemy':null;try{const h=G()?.hand?.[+D.i];return h&&typeof C!=='undefined'?C[h.key]?.aim||null:null}catch{return null}};
 // Slay the Spire style aim (Randall: "the arrow kinda moves with the point"): a spine of scales from the card to a big
 // two-tone head. The tip chases the finger on a stiff spring and the bend lags on a soft one, so the body swings as you
 // move. Over a target the tip snaps onto it, corner brackets close in and its life bar shows the hit as a ghost.
 const NS='http://www.w3.org/2000/svg';let arrow=null,A=null,raf=0,lockEl=null;
 const still=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 const arrowOn=()=>{if(arrow)return arrow;const s=document.createElementNS(NS,'svg');s.setAttribute('class','pw-arrow');s.setAttribute('aria-hidden','true');
  s.innerHTML='<defs><mask id="pw-arrow-m" maskUnits="userSpaceOnUse"><rect x="-1e4" y="-1e4" width="2e4" height="2e4" fill="#fff"/><rect class="pw-arrow-hole" fill="#333"/></mask></defs><g mask="url(#pw-arrow-m)"><g class="pw-arrow-sh"><path class="pw-arrow-segs"/><path class="pw-arrow-head"/></g><g class="pw-arrow-body"><path class="pw-arrow-segs"/><path class="pw-arrow-hi"/><path class="pw-arrow-face"/><path class="pw-arrow-face2"/><path class="pw-arrow-head"/></g></g>';
  document.body.append(s);return arrow=s};
 const lockOff=()=>{lockEl?.remove();lockEl=null};
 const lockOn=u=>{if(lockEl&&lockEl._u===u)return;lockOff();if(!u)return;const L=document.createElement('div');L.className='pw-lock';L._u=u;L.setAttribute('aria-hidden','true');L.innerHTML='<i></i><i></i><i></i><i></i>';document.body.append(L);lockEl=L;window.pwHaptic?.(6)};
 const placeLock=()=>{if(!lockEl)return;const u=lockEl._u;if(!u.isConnected)return lockOff();const r=bodyRect(u),p=8;
  Object.assign(lockEl.style,{left:r.left-p+'px',top:r.top-p+'px',width:r.width+2*p+'px',height:r.height+2*p+'px'})};
 const lethals=i=>{if(typeof pwPreview!=='function'||typeof ico!=='function')return;for(const u of app.querySelectorAll('.battle .side.foe .unit[data-id]')){let r=null;try{r=pwPreview('card',i,+u.dataset.id)}catch{}
   if(r&&r.dies&&!u.querySelector('.pw-lethal'))u.insertAdjacentHTML('beforeend',`<span class="pw-lethal pw-lethal-drag" role="img" aria-label="Dies to this card">${ico('skull')}</span>`)}};
 const unlethal=()=>{app.querySelectorAll('.pw-lethal-drag').forEach(x=>x.remove());if(d)d.leth=false};
 const arrowOff=()=>{unlethal();cancelAnimationFrame(raf);raf=0;A=null;lockOff();const s=arrow;arrow=null;if(!s)return;s.classList.add('pw-arrow-out');setTimeout(()=>s.remove(),140)};
 // where the tip rests on a locked target: just short of the middle of its art, coming in along the bend
 const anchor=(u,qx,qy)=>{const r=bodyRect(u);const cx=r.left+r.width/2,cy=r.top+r.height*.5;
  const dx=cx-qx,dy=cy-qy,l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l,k=Math.min(r.width/2/Math.max(.01,Math.abs(ux)),r.height/2/Math.max(.01,Math.abs(uy)))*.86;return [cx-ux*k,cy-uy*k]};
 const spring=(o,gx,gy,k,z,dt)=>{const c=2*Math.sqrt(k)*z;o.vx+=(k*(gx-o.x)-c*o.vx)*dt;o.vy+=(k*(gy-o.y)-c*o.vy)*dt;o.x+=o.vx*dt;o.y+=o.vy*dt};
 const draw=t=>{raf=0;if(!A||!arrow)return;const s=arrow;
  if(A.pend&&!G()?.pending)return arrowOff();
  const dt=Math.min(1/30,Math.max(0,(t-(A.t||t))/1000))||1/60;A.t=t;
  const r=A.src.getBoundingClientRect();const ax=r.left+r.width/2,ay=A.card?r.top+6:r.top+r.height/2;
  let [gx,gy]=[A.px,A.py];if(A.u&&A.u.isConnected)[gx,gy]=anchor(A.u,A.Q?A.Q.x:ax,A.Q?A.Q.y:ay);
  const dx=gx-ax;const qx=ax+dx*.6,qy=Math.min(ay,gy)-Math.max(24,Math.min(220,Math.abs(dx)*.3));
  if(!A.T){A.T={x:gx,y:gy,vx:0,vy:0};A.Q={x:qx,y:qy,vx:0,vy:0}}
  if(still()){Object.assign(A.T,{x:gx,y:gy});Object.assign(A.Q,{x:qx,y:qy})}
  else for(let n=Math.ceil(dt*240),h=dt/n;n--;){spring(A.T,gx,gy,A.u?1400:900,.72,h);spring(A.Q,qx,qy,260,.6,h)}
  if(![A.T.x,A.T.y,A.Q.x,A.Q.y].every(Number.isFinite)){A.T={x:gx,y:gy,vx:0,vy:0};A.Q={x:qx,y:qy,vx:0,vy:0}}
  const T=A.T,Q=A.Q,sc=Math.max(.9,Math.min(1.15,innerWidth/1100));
  // sample the bend and measure it so the scales sit evenly along it
  const N=48,P=[],cum=[0];for(let i=0;i<=N;i++){const k=i/N,m=1-k;P.push([m*m*ax+2*m*k*Q.x+k*k*T.x,m*m*ay+2*m*k*Q.y+k*k*T.y]);if(i)cum.push(cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]))}
  const tot=cum[N],at=d=>{let i=1;while(i<N&&cum[i]<d)i++;const f=(d-cum[i-1])/((cum[i]-cum[i-1])||1),x=P[i-1][0]+(P[i][0]-P[i-1][0])*f,y=P[i-1][1]+(P[i][1]-P[i-1][1])*f,a=Math.atan2(P[i][1]-P[i-1][1],P[i][0]-P[i-1][0]);return [x,y,a]};
  const H=44*sc,W=26*sc,body=tot-H*.7;let segs='',hi='';
  const pt=(x,y,a,l,w)=>`${(x+Math.cos(a)*l-Math.sin(a)*w).toFixed(1)},${(y+Math.sin(a)*l+Math.cos(a)*w).toFixed(1)}`;
  // fat overlapping chevrons, small at the card and growing toward the head; they drift forward slowly
  const wAt=d=>(7+9*Math.max(0,Math.min(1,d/Math.max(body,1))))*sc,ph=still()?0:(t/1000*1.4)%1;
  for(let d=body-wAt(body)*1.25*ph,k=0;d>6*sc&&k<90;d-=wAt(d)*1.25,k++){const w=wAt(d),l=w*1.15;const [x,y,a]=at(d);
   const F=pt(x,y,a,l*.5,0),Lb=pt(x,y,a,-l*.5,w),Nn=pt(x,y,a,-l*.18,0),Rb=pt(x,y,a,-l*.5,-w);
   segs=`M${F}L${Lb}L${Nn}L${Rb}Z`+segs;hi=`M${F}L${Rb}L${Nn}Z`+hi}
  const [hx,hy]=[T.x,T.y],ha=Math.atan2(T.y-P[N-3][1],T.x-P[N-3][0]),pulse=A.u&&!still()?1+.07*Math.sin(t/110):1,h=H*pulse,w=W*pulse;
  const tip=pt(hx,hy,ha,2,0),bl=pt(hx,hy,ha,-h,w),nc=pt(hx,hy,ha,-h+12*sc,0),br=pt(hx,hy,ha,-h,-w);
  s.querySelector('.pw-arrow-hi').setAttribute('d',hi);
  for(const e of s.querySelectorAll('.pw-arrow-segs'))e.setAttribute('d',segs);
  for(const e of s.querySelectorAll('.pw-arrow-head'))e.setAttribute('d',`M${tip}L${bl}L${nc}L${br}Z`);
  s.querySelector('.pw-arrow-face').setAttribute('d',`M${tip}L${bl}L${nc}Z`);s.querySelector('.pw-arrow-face2').setAttribute('d',`M${tip}L${nc}L${br}Z`);
  const m=app.querySelector('.battle .controls .log'),hole=s.querySelector('.pw-arrow-hole');if(m){const R=m.getBoundingClientRect();for(const [k,v] of [['x',R.left],['y',R.top],['width',R.width],['height',R.height]])hole.setAttribute(k,v)}
  s.classList.toggle('pw-hot',!!A.u);placeLock();
  if(!still()||Math.hypot(T.vx,T.vy)>1)raf=requestAnimationFrame(draw)};
 // src: the card or creature the arrow leaves from; u: the target it has locked onto (or null)
 const aimAt=(src,x,y,u,pend)=>{arrowOn();if(!A||A.src!==src)A={src,card:src.classList.contains('card')};Object.assign(A,{px:x,py:y,u:u||null,pend:!!pend});lockOn(u||null);if(!raf)raf=requestAnimationFrame(draw)};
 // a card you can't play stretches toward the finger a little, then springs back
 const poorOf=D=>{try{const h=G()?.hand?.[+D.i];return !!h&&typeof costOf==='function'&&(costOf(h)==='X'?G().energy<1:costOf(h)>G().energy)}catch{return false}};
 const shorts=D=>[D.el.querySelector('.cost'),app.querySelector('.battle .energy')].filter(Boolean);
 const rubber=(D,dx,dy)=>{if(!D.el.classList.contains('pw-rub')&&poorOf(D))shorts(D).forEach(x=>x.classList.add('pw-short-on'));const k=v=>Math.sign(v)*Math.min(26,Math.sqrt(Math.abs(v))*2.6);D.el.classList.add('pw-rub');D.el.style.setProperty('--rbx',k(dx)*.4+'px');D.el.style.setProperty('--rby',Math.min(0,k(dy))+'px')};
 const unrubber=D=>{const el=D.el;el.classList.replace('pw-rub','pw-snap');el.style.removeProperty('--rbx');el.style.removeProperty('--rby');setTimeout(()=>el.classList.remove('pw-snap'),480);
  for(const x of shorts(D)){x.classList.remove('pw-short-on');if(poorOf(D)){x.classList.remove('pw-short');void x.offsetWidth;x.classList.add('pw-short')}}window.pwHaptic?.(12)};
 app.addEventListener('pointerdown',e=>{if(e.button>0||d)return;
  const card=e.target.closest('.battle .hand>.card[data-act=play]');const ally=!card&&e.target.closest('.battle .side.you .unit.ally');
  if(!card&&!ally)return;
  d={el:card||ally,kind:card?'card':'ally',sx:e.clientX,sy:e.clientY,on:false,id:ally?ally.dataset.id:null,i:card?card.dataset.i:null,dead:!!(card&&card.disabled),
   ready:!!(ally&&ally.dataset.act==='atk'&&!ally.disabled),pid:e.pointerId,trail:[[e.timeStamp,e.clientY]]}},{passive:true});
 const peek=x=>{app.querySelectorAll('.battle .hand>.card.pw-peek').forEach(c=>{if(c!==x)c.classList.remove('pw-peek')});if(x)x.classList.add('pw-peek')};
 addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.pid)return;
  d.trail.push([e.timeStamp,e.clientY]);if(d.trail.length>8)d.trail.shift();
  if(document.querySelector('.pw-zoom:not(.pw-peek)')&&!(d.on||d.rub)&&!window.pwPeek?.()){d=null;peek(null);return}
  if(d.rub){rubber(d,e.clientX-d.sx,e.clientY-d.sy);return}
  if(!d.on){const dx=e.clientX-d.sx,dy=e.clientY-d.sy;
   const finger=e.pointerType!=='mouse';
   if(finger&&d.kind==='card'&&(d.browse||Math.abs(dx)>=TH&&Math.abs(dx)>Math.abs(dy)*1.2)){d.browse=true;const el=document.elementFromPoint(e.clientX,e.clientY);peek(el&&el.closest('.battle .hand>.card'));return}
   if(Math.hypot(dx,dy)<TH)return;
   if(finger&&d.kind==='card'&&dy>0){d=null;return}
   if(d.dead){d.rub=true;rubber(d,dx,dy);return}
   if(d.kind==='ally'&&!d.ready&&!app.querySelector('.controls [data-act=arrange]')){d=null;return}
   d.on=true;d.aim=aimOf(d);const r=d.el.getBoundingClientRect(),z=zoom();const g=d.el.cloneNode(true);g.classList.add('pw-ghost');g.removeAttribute('data-act');
   g.style.cssText=`position:fixed;left:0;top:0;width:${r.width/z}px;height:${r.height/z}px;margin:0;zoom:${z};pointer-events:none;z-index:9999;transform:none;translate:none`;
   d.ox=e.clientX-r.left;d.oy=e.clientY-r.top;d.g=g;document.body.append(g);d.el.classList.add('pw-lifted');de.classList.add('pw-dragging');window.pwHaptic?.(8)}
  const z=zoom();d.g.style.left=(e.clientX-d.ox)/z+'px';d.g.style.top=(e.clientY-d.oy)/z+'px';
  const u=under(e.clientX,e.clientY);const ok=valid(u);if(u!==shown||!ok){clear();if(ok){shown=u;u.classList.add('pw-drop');preview(u,d)}}
  const hand=app.querySelector('.battle .hand');const out=d.kind==='ally'||(hand&&e.clientY<hand.getBoundingClientRect().top-10);
  // aimed drags: out of the hand the card waits in place and an arrow follows the finger
  if(d.aim&&out&&d.kind==='card'&&!d.leth){d.leth=true;lethals(+d.i)}
  if(d.aim&&out){d.g.style.visibility='hidden';d.el.classList.add('pw-aiming');aimAt(d.el,e.clientX,e.clientY,ok&&(d.aim==='ally'?u.classList.contains('ally'):!!u.closest('.side.foe'))?u:null);return}
  if(d.aim){d.g.style.visibility='';d.el.classList.remove('pw-aiming');arrowOff()}
  // out of the hand the card shrinks to a chip above the finger, so the target stays visible
  d.g.classList.toggle('pw-chip',out);if(out){d.g.style.left=(e.clientX-d.g.offsetWidth*z/2)/z+'px';d.g.style.top=(e.clientY-d.g.offsetHeight*z-34)/z+'px'}
  d.g.classList.toggle('pw-will-play',d.kind==='card'&&!u&&out)},{passive:true});
 // a quick upward flick plays the card even if it is let go inside the hand; a slow drag has to leave the hand
 const flicked=D=>{const t=D.trail,b=t[t.length-1];const a=t.find(x=>b[0]-x[0]<=90)||t[0];const dt=b[0]-a[0];
  return dt>0&&(a[1]-b[1])/dt>=.55&&D.sy-b[1]>=28};
 const end=e=>{if(!d||e.pointerId!==d.pid)return;const D=d;d=null;peek(null);
  if(D.rub){unrubber(D);return}if(!D.on)return;
  swallow=true;
  D.el.classList.remove('pw-lifted','pw-aiming');de.classList.remove('pw-dragging');arrowOff();
  const u=e.type==='pointercancel'?null:under(e.clientX,e.clientY);const hand=app.querySelector('.battle .hand');
  let inHand=hand&&e.clientY>=hand.getBoundingClientRect().top-10;const ok=valid(u,D);clear();
  const flick=D.kind==='card'&&inHand&&!u&&e.type!=='pointercancel'&&flicked(D);if(flick)inHand=false;
  if(flick){const g=D.g;g.classList.add('pw-flung');setTimeout(()=>g.remove(),200)}else D.g.remove();
  // act after the browser's own click for this pointerup has been swallowed
  setTimeout(()=>{swallow=false;if(e.type==='pointercancel')return;drop(D,u,inHand,ok)},0)};
 const drop=(D,u,inHand,ok)=>{
  try{
   if(D.kind==='card'){if(!u&&inHand)return;
    if(!tap(`.battle .hand>.card[data-act=play][data-i="${D.i}"]`))return;
    const P=G()?.pending;if(!P||!u)return;const id=u.dataset.id;
    if(u.closest('.side.foe'))tap(`.side.foe .unit[data-act=target][data-id="${id}"]`);
    else tap(`.side.you .unit[data-act=target-ally][data-id="${id}"]`);
    window.pwHaptic?.(18);return}
   if(D.kind==='ally'&&ok){
    if(u.closest('.side.foe')){if(!tap(`.side.you .unit[data-act=atk][data-id="${D.id}"]`))return;
     if(G()?.pending)tap(`.side.foe .unit[data-act=target][data-id="${u.dataset.id}"]`);window.pwHaptic?.(18);return}
    if(!G()?.arrange)tap('.controls [data-act=arrange]');tap(`.side.you .unit[data-act=front][data-id="${D.id}"]`);if(G()?.arrange)tap('.controls [data-act=arrange]')}
  }catch{}};
 addEventListener('pointerup',end,{passive:true});addEventListener('pointercancel',end,{passive:true});
 // tap-to-aim with a mouse: after picking a card or attacker, the same arrow follows the cursor until a target is chosen
 const pendSrc=P=>{if(!P)return null;if(P.kind==='card'){const i=G().hand.findIndex(h=>h.id===P.cid);return app.querySelector(`.battle .hand>.card[data-i="${i}"]`)}
  if(P.kind==='atk')return app.querySelector(`.battle .side.you .unit.ally[data-id="${P.id}"]`);if(P.kind==='sacT')return app.querySelector(`.battle .side.you .unit.ally[data-id="${P.sac}"]`);
  return app.querySelector('.battle .side.you .unit.hero')};
 addEventListener('pointermove',e=>{if(d||e.pointerType!=='mouse')return;const P=G()?.pending;if(!P||typeof view!=='undefined'&&view!=='battle'){if(A?.pend)arrowOff(),clear();return}
  const src=pendSrc(P);if(!src)return;const u=under(e.clientX,e.clientY);
  const ok=u&&(P.aim==='ally'?u.matches('[data-act=target-ally]'):u.matches('.side.foe [data-act=target]'))?u:null;
  if(ok!==shown){clear();if(ok){shown=ok;ok.classList.add('pw-drop');if(P.kind==='card'||P.kind==='atk')preview(ok,P.kind==='card'?{kind:'card',i:G().hand.findIndex(h=>h.id===P.cid)}:{kind:'ally',id:P.id})}}
  aimAt(src,e.clientX,e.clientY,ok,true)},{passive:true});
 app.addEventListener('click',e=>{if(swallow){swallow=false;e.stopPropagation();e.preventDefault()}},true);
})();
/* The game's opening hint teaches tapping; the skin teaches drag (tap still works). */
(()=>{const app=document.getElementById('app');if(!app)return;const OLD='Your turn. Play a card, or tap a glowing creature and then an enemy to attack.',NEW='Your turn.';
 const fix=()=>{const l=app.querySelector('.battle .controls .log .pw-logt')||app.querySelector('.battle .controls .log');if(l&&l.textContent.trim()===OLD)l.textContent=NEW};
 new MutationObserver(fix).observe(app,{childList:true,subtree:true});fix()})();
/* The game's long-press inspect lists keywords as plain words; show each with its icon and what it does. */
(()=>{const app=document.getElementById('app');if(!app)return;
 const DEF={flying:'Only flying or reach creatures can block it.',haste:'Can attack the turn it enters.',reach:'Can block flying creatures.','first strike':'Deals its damage before the other side.',vigilance:'Attacking does not tap it.',lifelink:'Damage it deals heals you.',defender:'Can block but cannot attack.',trample:'Extra damage carries through blockers.',deathtouch:'Any damage it deals is lethal.'};
 const run=()=>{for(const p of document.querySelectorAll(':is(.inspect,.pw-zoom) p:not(.pw-kwdef)')){const ks=p.textContent.trim().split(' · ');if(!ks.every(k=>k in DEF))continue;
  p.className='pw-kwdef';p.innerHTML=ks.map(k=>`<span><i data-k="${k}"></i><b>${k[0].toUpperCase()+k.slice(1)}</b> ${DEF[k]}</span>`).join('')}};
 const mo=new MutationObserver(run);mo.observe(app,{childList:true,subtree:true});mo.observe(document.body,{childList:true});run()})();
/* Loyalty abilities live behind the hero's loyalty diamond: tap it to fan them out; using one or tapping elsewhere folds them. */
(()=>{const app=document.getElementById('app');if(!app)return;let open=false;
 const apply=()=>{const b=app.querySelector('.battle');if(b)b.classList.toggle('pw-abil-open',open)};
 app.addEventListener('click',e=>{if(!app.querySelector('.battle'))return;
  if(e.target.closest('.side.you .unit.hero .loyal')){e.stopPropagation();e.preventDefault();open=!open;apply();window.pwHaptic?.(8);return}
  if(open){open=false;if(!e.target.closest('.controls :is([data-act=plus],[data-act=minus],[data-act=ult])'))apply()}},true);
 new MutationObserver(()=>{const b=app.querySelector('.battle');if(b&&b.classList.contains('pw-abil-open')!==open)apply()}).observe(app,{childList:true});
})();
/* First battle: a one-time coach card that explains drag and the diamond. */
(()=>{const app=document.getElementById('app');if(!app)return;let seen=false;try{seen=localStorage.getItem('pw-coach-drag')==='1'}catch{}
 if(seen)return;const show=()=>{if(seen||!app.querySelector('.battle .hand>.card'))return;seen=true;try{localStorage.setItem('pw-coach-drag','1')}catch{}
  const d=document.createElement('div');d.className='pw-coach';d.setAttribute('role','dialog');
  d.innerHTML='<b>How to play</b><p><i>☝</i> Drag a card onto an enemy to cast it, or up onto the board to play it.</p><p><i>⚔</i> Drag a ready creature onto an enemy to attack.</p><p><i>◆</i> Tap the diamond on your planeswalker for its abilities.</p><span>Tap to start</span>';
  d.addEventListener('click',()=>d.remove());document.body.append(d)};
 new MutationObserver(show).observe(app,{childList:true});show()})();
/* Shandalar features: dungeon room banner, burned-ante shards (look only; the game owns the rules). */
(()=>{const app=document.getElementById('app');if(!app)return;
 const RULE={crypt:'Each time you reshuffle, one card is Lost.',ruins:'1 less energy each turn, but draw 1 more card.',vaults:'Enemies have +1 power. Each kill pays 5 gold.'};
 let key='',el=null,tm=0;
 const room=()=>{const b=app.querySelector('section.battle[data-room]');if(!b){if(el){el.remove();el=null;key=''}return}
  const k=b.dataset.dungeon+'|'+b.dataset.room;if(k===key&&el?.isConnected)return;const fresh=k!==key;key=k;el?.remove();
  el=document.createElement('div');el.className='pw-room';
  // a 2.4s title card over the whole battle (design gate: an overlay, so it may cover the page)
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Room '+b.dataset.room);
  const rule=(b.querySelector('.dungeon-rule')?.textContent.trim()||RULE[b.dataset.dungeon]||'').replace(/\s*[^.]*\bshine here\.$/,'');/* the card states the room's rule only, no deck-building hint (no hint text in battles) */
  el.innerHTML=`<b>Room ${b.dataset.room} of ${b.dataset.rooms||3}</b>${rule?`<span>${rule}</span>`:''}`;
  if(!fresh){el=null;return}document.body.append(el);clearTimeout(tm);tm=setTimeout(()=>{el?.classList.add('pw-gone');setTimeout(()=>{if(el?.classList.contains('pw-gone')){el.remove();el=null}},400)},2400)};
 const SH=[[0,0,55,0,40,45,0,38],[55,0,100,0,100,30,62,50,40,45],[0,38,40,45,30,100,0,100],[40,45,62,50,70,100,30,100],[62,50,100,30,100,100,70,100]];
 const shards=()=>{for(const r of app.querySelectorAll('.ante-result:is([data-r=lost],[data-r=burned]):not([data-pw-sh])')){r.dataset.pwSh='';const cd=r.querySelector(':scope>.card');if(!cd)continue;
  SH.forEach((pts,i)=>{const s=cd.cloneNode(true);s.classList.add('pw-shard');s.removeAttribute('data-act');s.setAttribute('aria-hidden','true');
   let poly=[];for(let j=0;j<pts.length;j+=2)poly.push(pts[j]+'% '+pts[j+1]+'%');s.style.clipPath=`polygon(${poly.join(',')})`;
   const a=(i/SH.length)*Math.PI*2+.6;s.style.setProperty('--dx',Math.round(Math.cos(a)*70)+'px');s.style.setProperty('--dy',Math.round(Math.sin(a)*60+30)+'px');s.style.setProperty('--r',(i%2?1:-1)*(18+i*9)+'deg');
   s.style.width=cd.offsetWidth+'px';s.style.height=cd.offsetHeight+'px';s.style.left=cd.offsetLeft+'px';s.style.top=cd.offsetTop+'px';r.append(s)})}};
 // the elite's ante buff, as a chip under it
 const chip=()=>{const b=app.querySelector('section.battle[data-ante-buff]');if(!b)return;const u=b.querySelector('.side.foe .unit.elite');if(!u||u.querySelector(':scope>.pw-ante-chip'))return;
  const s=document.createElement('span');s.className='pw-ante-chip';s.textContent=b.dataset.anteBuff;u.append(s)};
 // synergy: "pairs with X" on rewards that combo with what you hold
 const pairs=()=>{for(const el of app.querySelectorAll(':is([data-pairs],[data-arch]):not(:has(.pw-pairs))')){const s=document.createElement('span');s.className='pw-pairs';let ic='<i></i>';
  if(!el.dataset.pairs){s.classList.add('pw-arch');s.textContent=el.dataset.arch;(el.querySelector(':scope>.pic')||el).append(s);continue}
  try{const k=el.dataset.pairsK;if(k&&typeof EMB!=='undefined'&&EMB[k])ic=embSvg(k)}catch{}
  s.innerHTML=ic+'pairs with '+el.dataset.pairs.replace(/[<>&]/g,'');(el.querySelector(':scope>.pic')||el).append(s)}};
 // "Taken from X" ribbon (a real element, so it never fights the foil shimmer on ::after)
 const sig=()=>{for(const el of app.querySelectorAll('.card[data-sig]:not(:has(>.pw-sig))')){const s=document.createElement('span');s.className='pw-sig';s.textContent='Taken from '+el.dataset.sig;s.title=s.textContent;el.prepend(s)}};
 let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;room();shards();chip();pairs();sig()})}}).observe(app,{childList:true,subtree:true});room();shards();chip();pairs();sig()})();
/* Pause menu (Randall: "an escape key or something that has settings like options, restart run, or escape").
   Esc or the ☰ button in the HUD opens it on the map, any node screen, or mid-match. The game owns the rules:
   restart and change-hero call its own newRun(), exit uses its own Play-menu link. */
(()=>{const app=document.getElementById('app');if(!app)return;const de=document.documentElement;
 const G=n=>{try{return eval(n)}catch{return undefined}};
 let calm=false;try{calm=localStorage.getItem('pw-calm')==='1'}catch{}de.classList.toggle('pw-calm',calm);
 // text size: the APK's WebView doesn't always pass the phone's own setting through, so the game has its own (100/115/130%)
 const TS=[100,115,130];let ts=100;try{ts=TS.includes(+localStorage.getItem('pw-text'))?+localStorage.getItem('pw-text'):100}catch{}
 const applyText=()=>{de.style.setProperty('--pw-ts',String(ts/100));dispatchEvent(new Event('resize'))};if(ts!==100)applyText();
 let box=null,armed='',copied=0;
 const live=()=>{const r=G('run');return !!(r&&r.hp>0&&!['over','victory','heroes'].includes(G('view')))};
 const close=()=>{box?.remove();box=null;armed=''};
 // Sound uses the app's own audio settings (audio.js, saved as 'cardstashy-audio'), so the same levels apply in matches and app Settings.
 const AK='cardstashy-audio',AD={on:true,sfx:.7,music:.4};let A=null;import('./audio.js').then(m=>{A=m;draw()},()=>{});
 const aget=()=>{try{return A?A.audioSettings():{...AD,...JSON.parse(localStorage.getItem(AK)||'{}')}}catch{return {...AD}}};
 const aset=p=>{try{if(A)A.setAudioSettings(p);else localStorage.setItem(AK,JSON.stringify({...aget(),...p}))}catch{}};
 const pwOn=()=>{try{return window.pwSound?window.pwSound.on:localStorage.getItem('pw-sound')!=='off'}catch{return true}};
 const sound=()=>aget().on!==false&&pwOn();
 const setSound=on=>{try{if(window.pwSound){if(window.pwSound.on!==on)window.pwSound.toggle()}else localStorage.setItem('pw-sound',on?'on':'off')}catch{}aset({on})};
 const pct=v=>Math.round(Math.max(0,Math.min(1,+v||0))*100);
 const slider=(k,label)=>{const v=pct(aget()[k]);return `<label class="pw-menu-row pw-menu-vol"><span>${label}</span><input type="range" min="0" max="100" step="5" value="${v}" data-vol="${k}" aria-label="${label} volume"${sound()?'':' disabled'} style="--v:${v}%"><output>${v}%</output></label>`};
 const tog=(m,label,on,txt)=>`<button type="button" class="pw-menu-row pw-menu-tog" data-m="${m}" role="switch" aria-checked="${on}"><span>${label}</span><em>${txt}</em><i aria-hidden="true"></i></button>`;
 const draw=()=>{if(!box)return;const r=G('run'),inRun=live(),H=r&&G('HERO'),s=aget(),on=sound(),f=box.contains(document.activeElement)&&document.activeElement.dataset.m;
  box.innerHTML=`<div class="pw-menu-card pwk-panel" role="dialog" aria-modal="true" aria-label="Paused" data-audit-scroll><h2 class="pwk-title"><span class="pwk-mana" aria-hidden="true"></span>Paused<span class="pwk-mana" aria-hidden="true"></span></h2>${inRun&&H?`<p class="pw-menu-sub">${H.name||''} · Act ${r.act||1} · ♥ ${r.hp}/${r.max}</p>`:''}
   <button class="btn main pwk-btn primary" data-m="resume">Resume</button>
   <div class="pw-menu-help"><button type="button" class="pw-menu-mini" data-m="tips">Drag tips</button><button type="button" class="pw-menu-mini${copied?' pw-done':''}" data-m="bug">${copied===1?'Copied':copied===2?'Copy failed':'Report a bug'}</button></div>
   <div class="pw-menu-group pw-menu-snd"><h3>Sound</h3>${tog('sound','Sound',on,on?'On':'Off')}${'master' in s?slider('master','Master'):''}${slider('music','Music')}${slider('sfx','Effects')}</div>
   <div class="pw-menu-group pw-menu-optg"><h3>Options</h3>${tog('calm','Motion',!calm,calm?'Reduced':'Full')}${tog('speed','Battle speed',G('SPEED')===2,G('SPEED')===2?'2x':'1x')}<div class="pw-menu-row pw-menu-text" role="group" aria-label="Text size"><span>Text size</span><span class="pw-seg">${TS.map(v=>`<button type="button" data-m="text" data-v="${v}" aria-pressed="${v===ts}" aria-label="Text size ${v}%">${v}</button>`).join('')}</span></div>${!inRun&&typeof FORM!=='undefined'?tog('form','Formation blocking',!!FORM,FORM?'On':'Off'):''}</div>
   <div class="pw-menu-group pw-menu-run"><h3>Run</h3>${inRun?`<button type="button" class="pw-menu-row${armed==='restart'?' pw-armed':''}" data-m="restart"><span>${armed==='restart'?'Tap again to restart with '+(H&&H.name||'this hero'):'Restart run'}</span></button>`:''}
   <button type="button" class="pw-menu-row${armed==='hero'?' pw-armed':''}" data-m="hero"><span>${armed==='hero'?'Tap again to end this run':'Change hero'}</span></button>
   <button type="button" class="pw-menu-row pw-menu-exit${armed==='exit'?' pw-armed':''}" data-m="exit"><span>${armed==='exit'?'Tap again to leave and end this run':'Exit to Play menu'}</span></button></div></div>`;
  (f&&box.querySelector(`[data-m=${f}]`)||box.querySelector('[data-m=resume]')).focus({preventScroll:true})};
 // sliders: move updates the level live; letting go plays a tick so you hear the effects level
 document.addEventListener('input',e=>{const t=e.target;if(!t.matches?.('.pw-menu [data-vol]'))return;const v=+t.value;t.style.setProperty('--v',v+'%');t.nextElementSibling.textContent=v+'%';aset({[t.dataset.vol]:v/100})});
 document.addEventListener('change',e=>{const t=e.target;if(t.matches?.('.pw-menu [data-vol=sfx],.pw-menu [data-vol=master]'))try{A?.sfx('PWB-003',{volume:.8,gap:0})}catch{}});
 const open=()=>{if(box)return close();box=document.createElement('div');box.className='pw-menu';document.body.append(box);draw();window.pwHaptic?.(8)};
 const end=()=>{try{G('store').del(G('SAVE'))}catch{}};
 const act=(m,b)=>{const r=G('run');
  if(m==='resume')return close();
  if(m==='sound'){setSound(!sound());return draw()}
  if(m==='calm'){calm=!calm;de.classList.toggle('pw-calm',calm);try{localStorage.setItem('pw-calm',calm?'1':'0')}catch{}return draw()}
  if(m==='speed'){G('setSpeed')(G('SPEED')===2?1:2);return draw()}
  if(m==='text'){ts=TS.includes(+b?.dataset.v)?+b.dataset.v:TS[(TS.indexOf(ts)+1)%TS.length];try{localStorage.setItem('pw-text',String(ts))}catch{}applyText();return draw()}
  // the seed, the run's state and the last actions go to the clipboard, so a thread can replay the run in the sim
  if(m==='bug'){const t=G('bugReport')?.()||'';const ok=()=>{copied=1;draw();setTimeout(()=>{copied=0;draw()},2200)};
   const fall=()=>{try{const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.append(a);a.select();const r=document.execCommand('copy');a.remove();if(r)return ok()}catch{}copied=2;draw();setTimeout(()=>{copied=0;draw()},2200)};
   try{navigator.clipboard.writeText(t).then(ok,fall)}catch{fall()}window.pwBugReport?.(t);return}
  // a rules switch, so it only shows between runs; the page reloads to apply it
  if(m==='form'){try{localStorage.setItem('pw-form',FORM?'0':'1')}catch{}location.reload();return}
  if(m==='tips'){try{localStorage.removeItem('pw-coach-drag')}catch{}close();return}
  // anything that ends a live run asks for a second tap first
  if(live()&&armed!==m&&m!=='exit'||live()&&m==='exit'&&armed!=='exit'){armed=m;return draw()}
  close();
  if(m==='restart'){end();return G('newRun')(undefined,r&&r.hero)}
  if(m==='hero'){end();return G('newRun')()}
  if(m==='exit'){end();const a=app.querySelector('.top a.btn[href]');if(a&&a.getAttribute('href')){location.href=a.href;return}return G('newRun')()}};
 document.addEventListener('click',e=>{const b=e.target.closest('.pw-menu [data-m]');if(b){e.stopPropagation();act(b.dataset.m,b);return}
  if(box&&e.target===box)close()},true);
 addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.querySelector('.pw-zoom,.pw-coach'))return;e.preventDefault();open()});
 // the HUD button: one ☰ replaces the separate New run flag and Exit buttons
 const hud=()=>{const t=app.querySelector('.top');if(!t||t.querySelector('.pw-menubtn'))return;const b=document.createElement('button');b.type='button';b.className='btn pw-menubtn';b.setAttribute('aria-label','Menu');b.title='Menu (Esc)';b.innerHTML='<span class="pw-sr">☰</span>';
  b.addEventListener('click',e=>{e.stopPropagation();open()});t.append(b)};
 new MutationObserver(hud).observe(app,{childList:true});hud()})();
/* Full names on hover/long-press for card titles that wrap or clamp (UI rule 6: cut text needs its full version one tap away). */
(()=>{const app=document.getElementById('app');if(!app)return;
 const run=()=>{for(const b of app.querySelectorAll('.card .head b:not([title]):not([data-tip0])'))b.title=b.textContent.trim()};
 let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;run()})}}).observe(app,{childList:true,subtree:true});run()})();
/* Hand fit (design gate: a card's name never sits under a neighbouring card, so every name reads on the resting hand).
   Room to spare: the cards spread apart by more than the fan tilt can close. Short of room: the cards overlap, the tilt
   flattens and each name wraps inside the strip of its card that no neighbour covers. Still short (6+ cards on a phone):
   the hand splits into two rows of whole cards, the second row set between the first like bricks. */
(()=>{const app=document.getElementById('app');if(!app)return;let raf=0;
 // a name's box changes height when the text size changes (settings, or a text-scale pass): the hand fits again
 let tx='';const txOf=()=>{const b=app.querySelector('.battle .hand>.card .head>b');return b?getComputedStyle(b).fontSize+'|'+innerWidth+'x'+innerHeight:''};
 const ro=new ResizeObserver(()=>{const t=txOf();if(t===tx)return;/* only a text-size change re-fits; a card growing under the mouse does not */if(raf){cancelAnimationFrame(raf)}fit()});
 const fit=()=>{raf=0;const h=app.querySelector('.battle .hand');if(!h)return;tx=txOf();/* a card grown under the mouse or held in a drag shows its full name: that is not a reason to re-fit the hand (1 Nov hotfix: the whole hand jumped on hover) */if(h.querySelector(':scope>.card.pw-big,:scope>.card.pw-lifted')||document.documentElement.classList.contains('pw-dragging'))return;const cs=[...h.children].filter(x=>x.classList.contains('card'));
  const bs=cs.map(x=>x.querySelector('.head>b'));bs.forEach(b=>b&&ro.observe(b));h.classList.remove('pw-flat','pw-rows','pw-dense','pw-nameless');['--cols','--cw','--ch','--hshift'].forEach(p=>h.style.removeProperty(p));
  cs.forEach((x,i)=>{x.classList.remove('pw-noname');['margin-inline','grid-column','grid-row','--hw'].forEach(p=>x.style.removeProperty(p));bs[i]&&['max-width','margin-left'].forEach(p=>bs[i].style.removeProperty(p))});
  if(cs.length<2)return;
  const n=cs.length,H=h.getBoundingClientRect(),kz=H.width/(h.offsetWidth||1);let w=cs[0].offsetWidth,k=kz*(parseFloat(getComputedStyle(cs[0]).zoom)||1);
  const set=m=>cs.forEach(x=>x.style.setProperty('margin-inline',m+'px','important'));
  const rs=()=>cs.map(x=>x.getBoundingClientRect());
  // the piles, orb and buttons beside the hand's row bound it (wide screens put them in the same row)
  const r0=rs(),T=Math.min(H.top,...r0.map(q=>q.top))-2,BT=Math.max(H.bottom,...r0.map(q=>q.bottom));
  let lo=H.left,hi=H.right;for(const e of app.querySelectorAll('.battle .piles>span,.battle .energy,.battle .controls>.btn')){const q=e.getBoundingClientRect();if(!q.width||q.bottom<=T||q.top>=BT)continue;
   const c=(q.left+q.right)/2;if(c<H.left+H.width/4)lo=Math.max(lo,q.right+4);else if(c>H.right-H.width/4)hi=Math.min(hi,q.left-4)}
  const pad=Math.max(lo-H.left,H.right-hi),inside=r=>Math.min(...r.map(q=>q.left))>=lo&&Math.max(...r.map(q=>q.right))<=hi;
  let r,m;
  // each name keeps to the strip of its card that neither neighbour's box covers; true when every name fits its strip
  const names=r=>{let ok=true;bs.forEach((b,i)=>{if(!b)return;b.style.removeProperty('max-width');b.style.removeProperty('margin-left');cs[i].classList.remove('pw-noname');if(b.scrollWidth>b.clientWidth-3){cs[i].classList.add('pw-noname');return}const q=b.getBoundingClientRect(),L=i?r[i-1].right+2:-1e9,R=i<n-1?r[i+1].left-2:1e9;
   const sh=Math.max(0,L-q.left)/k;if(sh)b.style.setProperty('margin-left',sh+'px');b.style.setProperty('max-width',Math.max(0,Math.min(q.right,R)-Math.max(q.left,L))/k+'px');
   if(b.scrollWidth>b.clientWidth-3||b.scrollHeight>b.clientHeight+4||b.clientWidth<24){ok=false;if(window.PW_FIT_DEBUG)(window.__pwFit=window.__pwFit||[]).push([cs[0].style.getPropertyValue('--hw'),b.textContent,b.scrollWidth,b.clientWidth,b.scrollHeight,b.clientHeight])}});return ok};
  const lay=()=>{h.classList.remove('pw-flat');cs.forEach(x=>x.style.removeProperty('margin-inline'));w=cs[0].offsetWidth;k=kz*(parseFloat(getComputedStyle(cs[0]).zoom)||1);
   // 1. spread: neighbours' boxes (tilt included) stay 4px apart
   r=rs();m=parseFloat(getComputedStyle(cs[0]).marginLeft)||0;
   const ov=Math.max(...r.slice(1).map((q,i)=>r[i].right-q.left));m+=(ov+4)/2/k;set(m);if(inside(rs()))return names(rs());
   // 2. overlap, flat: each name keeps to the strip between the card on its left and the card on its right
   // the row fills the room between its bounds (deck pile on the left, discard on the right) and slides over to sit centred in it
   h.classList.add('pw-flat');m=((hi-lo)/k-n*w-6/k)/(2*n);set(m);h.style.setProperty('--hshift',(((lo+hi)/2-(H.left+H.right)/2)/kz)+'px');
   // zoom and borders make the first guess approximate: measure and pull in until the row sits between its bounds
   for(let t=0;t<3;t++){r=rs();const ex=Math.max(lo-Math.min(...r.map(q=>q.left)),Math.max(...r.map(q=>q.right))-hi);if(ex<=0)break;m-=(ex+1)/(n*k);set(m)}
   r=rs();return names(r)};
  let ok=lay();
  // 2b. landscape, still short (6-7 cards on a phone): the cards slim down a step at a time until every name fits its strip
  // 2b. landscape, still short (6-7 cards): first the roomy layout's bigger cards drop back to plain size, then the cards slim down a step at a time until every name fits its strip
  if(!ok&&!matchMedia('(max-aspect-ratio:4/5)').matches){if(k/kz>1.01){h.classList.add('pw-dense');ok=lay()}for(let cw=w-2;cw>=48&&!ok;cw-=2){cs.forEach(x=>x.style.setProperty("--hw",cw+"px"));ok=lay()}
   // still short: whole cards at plain size with the names off (the long press and the hover card still name them)
   if(!ok){cs.forEach(x=>x.style.removeProperty('--hw'));h.classList.add('pw-nameless');ok=lay()}}
  // most names off reads uneven: then every name goes (the hold and hover card still name them)
  if(ok&&cs.some(x=>x.classList.contains('pw-noname')))h.classList.add('pw-nameless');// one name off reads uneven: then every name goes
  if(ok||!matchMedia('(max-aspect-ratio:4/5)').matches)return;
  // 3. two rows of whole cards
  h.classList.remove('pw-flat');cs.forEach((x,i)=>{x.style.removeProperty('margin-inline');bs[i]&&['max-width','margin-left'].forEach(p=>bs[i].style.removeProperty(p))});
  const per=Math.ceil(n/2),cw=Math.min(w,Math.floor((H.width/k-8)/per-4));h.classList.add('pw-rows');h.style.setProperty('--cols',2*per);h.style.setProperty('--cw',cw+'px');
  cs.forEach((x,i)=>{const row=i<per?1:2,j=row===1?i:i-per,off=row===2&&n%2?1:0;x.style.setProperty('grid-row',row);x.style.setProperty('grid-column',`${2*j+1+off} / span 2`)});
  // short of height for two rows: the cards get shorter art (down to 70px tall); shorter still and the battle would scroll, so back to the flat hand
  const over=document.scrollingElement.scrollHeight-innerHeight;if(over>0){const ch=cs[0].offsetHeight-Math.ceil(over/2)-1;if(ch>=70)h.style.setProperty('--ch',ch+'px')}
  if(document.scrollingElement.scrollHeight>innerHeight+1){h.style.removeProperty('--ch');h.classList.remove('pw-rows');h.style.removeProperty('--cols');h.style.removeProperty('--cw');cs.forEach(x=>{x.style.removeProperty('grid-row');x.style.removeProperty('grid-column')});h.classList.add('pw-flat');set(m);
   r=rs();bs.forEach((b,i)=>{if(!b)return;const q=b.getBoundingClientRect(),L=-1e9,R=i<n-1?r[i+1].left-2:1e9;const sh=Math.max(0,L-q.left)/k;if(sh)b.style.setProperty('margin-left',sh+'px');b.style.setProperty('max-width',Math.max(0,Math.min(q.right,R)-Math.max(q.left,L))/k+'px');if(b.scrollWidth>b.clientWidth+1)b.style.setProperty('max-width',Math.min(w-8,b.scrollWidth+2)+'px')})}};
 const q=()=>{if(!raf)raf=requestAnimationFrame(fit)};new MutationObserver(ms=>{if(ms.some(m=>m.type==='childList'))q()}).observe(app,{childList:true,subtree:true});addEventListener('resize',q);addEventListener('pw-cam',q);document.fonts&&document.fonts.ready.then(q);q()})();
/* Battle camera (Randall: "change aspect ratio when more monsters are on screen"): both sides of the field are zoomed as
   far as they fit, so a lone monster stands big and a crowd pulls the view back. The fit is measured, not guessed: every
   unit and badge must stay inside the field and the two sides must not touch. Changes glide like a camera move. */
(()=>{const app=document.getElementById('app');if(!app)return;const de=document.documentElement;
 let Z=1,key='',busy=false;
 const units=f=>[...f.querySelectorAll(':scope>.side .unit')];
 const idOf=u=>(u.closest('.foe')?'f':'a')+(u.dataset.id||'h');
 // B: how far the board may reach (the field, or as far as its badges already reach at zoom 1); G: the gap the sides need
 const boxes=f=>{let all=null;const sides=[...f.querySelectorAll(':scope>.side')].map(s=>{let b=null;for(const e of [s,...s.querySelectorAll('*')]){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;
   all=all?{l:Math.min(all.l,r.left),r:Math.max(all.r,r.right),t:Math.min(all.t,r.top),b:Math.max(all.b,r.bottom)}:{l:r.left,r:r.right,t:r.top,b:r.bottom};
   b=b?{l:Math.min(b.l,r.left),r:Math.max(b.r,r.right),t:Math.min(b.t,r.top),b:Math.max(b.b,r.bottom)}:{l:r.left,r:r.right,t:r.top,b:r.bottom}}return b});return {all,sides}};
 const gap=([a,b])=>!a||!b?1e9:Math.max(b.l-a.r,a.l-b.r,b.t-a.b,a.t-b.b);
 const fits=(f,F,B,G)=>{const R=f.getBoundingClientRect();if(Math.abs(R.height-F.height)>2||Math.abs(R.width-F.width)>2)return false;
  const {all,sides}=boxes(f);if(!all)return true;return all.l>=B.l-1&&all.r<=B.r+1&&all.t>=B.t-1&&all.b<=B.b+1&&gap(sides)>=G};
 const set=(f,z)=>f.style.setProperty('--pw-cam',z);
 // a unit name never splits inside a word: when big text makes its longest word wider than the plate, the name steps down to fit
 const ruler=document.createElement('span');ruler.setAttribute('aria-hidden','true');ruler.style.cssText='position:fixed;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none';
 const fitNames=f=>{if(!ruler.isConnected)document.body.append(ruler);
  for(const n of f.querySelectorAll('.unit>.name')){n.classList.remove('pw-clip');const cs=getComputedStyle(n),fs=parseFloat(cs.fontSize);if(!fs)continue;
   Object.assign(ruler.style,{fontFamily:cs.fontFamily,fontWeight:cs.fontWeight,fontSize:fs+'px',letterSpacing:cs.letterSpacing,fontVariant:cs.fontVariant,textTransform:cs.textTransform});
   const ww=Math.max(...n.textContent.trim().split(/\s+/).map(w=>{ruler.textContent=w;return ruler.getBoundingClientRect().width}))+2;
   const room=n.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);if(!(room>0)||ww<=room)continue;
   const nf=Math.min(fs,Math.max(11,Math.floor(fs*room/ww*10)/10));n.style.setProperty('font-size',nf+'px','important');
   // still too wide at the smallest size: thinner padding, then one line that ends in an ellipsis (the full name shows on hold)
   const need=ww*nf/fs-room;if(need>.5){n.style.setProperty('padding-inline','2px','important');if(need>4){n.classList.add('pw-clip');n.title=n.textContent.trim()}}}
};
 // a status tag (Zzz, Tapped) that would sit on the unit's own badges at big text steps aside: the dimmed art still shows the state
 const hit=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))>4;
 const fitTags=f=>{for(const t of f.querySelectorAll('.unit .tag')){t.classList.remove('pw-tag-off');const u=t.closest('.unit'),tr=t.getBoundingClientRect();
   for(const s of u.querySelectorAll('*'))if(s!==t&&!t.contains(s)&&!s.contains(t)&&!s.children.length&&s.textContent.trim()&&hit(tr,s.getBoundingClientRect())){t.classList.add('pw-tag-off');break}}};
 const spill=f=>{const F=f.getBoundingClientRect(),{all}=boxes(f);return !!all&&(all.l<F.left-2||all.r>F.right+2)};
 const run=()=>{if(busy)return;const f=app.querySelector('.battle .field');if(!f){key='';return}if(!f.matches('.pw-stage,.pw-plates')){if(key)set(f,Z);return}/* frame once the figures stand (pw-cast), never on the portraits first */fitNames(f);
  if(de.classList.contains('pw-dragging')||document.querySelector('svg.pw-arrow')){set(f,Z);return}
  // Slay the Spire framing (Randall 1 Nov): pw-cast sizes the figures for the full line (hero + 4 allies, 4 foes) from the first frame,
  // so the camera never zooms in, and it is set once per fight: units arriving or falling never move it. Only a new screen size, or a line
  // that really spills out of the field, frames it again.
  const us=units(f),k=innerWidth+'x'+innerHeight+'|'+(app.dataset.pwZoom!=null);
  set(f,Z);if(k===key&&!spill(f))return fitTags(f);const fresh=true;key=k;busy=true;
  try{const before=new Map(us.map(u=>[idOf(u),u.getBoundingClientRect()]));set(f,1);const F=f.getBoundingClientRect(),o=boxes(f),A=o.all||{l:F.left,r:F.right,t:F.top,b:F.bottom};
   const B={l:Math.min(F.left,A.l),r:Math.max(F.right,A.r),t:Math.min(F.top,A.t),b:Math.max(F.bottom,A.b)};const lg=app.querySelector('.battle .controls .log')?.getBoundingClientRect();
   // where the turn pill rides up over the field's foot (wide screens), the units stay above it
   const LB=lg&&lg.width&&lg.top<F.bottom&&lg.bottom>F.top&&lg.left<F.right&&lg.right>F.left?lg.top-4:1e9;B.b=Math.min(B.b,LB),G=Math.min(16,gap(o.sides));
   // only badges may reach past the field (the pills above the top row); a crowd that overflows pulls the camera back instead
   const tight=A.l<F.left-1||A.r>F.right+1||A.b>Math.min(F.bottom,LB)+1||gap(o.sides)<8;
   // a crowd starts from the narrow crowd widths, so it may zoom further back up
   const crowd=f.querySelectorAll(':scope>.side.foe .unit').length>=4||f.querySelectorAll(':scope>.side.you .unit').length>=5;
   // never pull back so far that a unit drops under a 44px target
   const w1=Math.min(...us.map(u=>u.getBoundingClientRect().width).filter(Boolean),1e9);
   let z=1,lo=tight?Math.min(1,Math.max(.6,44.5/w1)):1,hi=1;if(tight){B.l=F.left;B.r=F.right;B.b=Math.min(F.bottom,LB)}const g=tight?8:G;
   /* Slay the Spire 2 scale (Randall 1 Nov: "keep the camera backed up", "keep scale"): the camera holds at 1. pw-cast already sizes every figure for the
      full 4v4 at about a third of the screen and shrinks the line itself only if it truly overflows, so a zoom here only made figures jump or shrink */
   z=1;
   z=Math.round(z*100)/100;if(Math.abs(z-Z)<.03&&!fresh)z=Z;set(f,z);const old=Z;Z=z;
   if(!fresh&&Math.abs(z-old)>=.03&&!matchMedia('(prefers-reduced-motion:reduce)').matches)for(const u of us){const a=before.get(idOf(u)),b=u.getBoundingClientRect();if(!a||!b.width)continue;
    const s=a.width/b.width;u.animate([{transform:`translate(${a.left+a.width/2-(b.left+b.width/2)}px,${a.top+a.height/2-(b.top+b.height/2)}px) scale(${s})`},{transform:'none'}],{duration:480,easing:'cubic-bezier(.22,.8,.24,1)'})}
  }finally{busy=false}
  fitTags(f);window.dispatchEvent(new Event('pw-cam'))};
 new MutationObserver(run).observe(app,{childList:true,subtree:true});addEventListener('pw-fit',()=>{key='';run()});
 // bigger system text re-flows the units, so measure again (our own zoom writes on the field itself are ignored)
 let rq=0;new MutationObserver(ms=>{if(busy||rq||!ms.some(m=>!m.target.matches('.field,.field>.side,.unit>.name')&&!m.target.closest('.hand')))return;rq=requestAnimationFrame(()=>{rq=0;key='';run()})}).observe(app,{attributes:true,attributeFilter:['style'],subtree:true});run()})();
/* Modal focus: while a dialog is up (pause menu, help, zoom, found card, deck list, combat log) everything behind it is
   inert, so taps and keyboard focus can't reach the dimmed game, and the layout check skips what the dialog covers.
   The controls that close a dialog (the deck summary, the log button, ✕) stay live. */
(()=>{const app=document.getElementById('app');if(!app)return;
 const MODAL='body>.pw-menu,body>.pw-zoom:not(.pw-peek):not(.pw-holding),#app>.pw-gift,#app details.deck[open]>.decklist,#app .battle .pw-hist';
 // the control that closes each dialog stays live: the deck's summary, the log button
 const keepOf=m=>m.matches('.decklist')?'summary':m.matches('.pw-hist')?'[data-act=hist]':null;let locked=[],KEEP=null;
 let want=null;const lock=e=>want.push(e);
 const apply=()=>{for(const e of locked)if(!want.includes(e)){e.inert=false;delete e.dataset.auditIgnore}for(const e of want)if(!locked.includes(e)){e.inert=true;e.dataset.auditIgnore=''}locked=want};
 // inert every sibling along the path from the dialog up to <body>; a sibling holding a close control is opened up instead
 const around=(m,parent,path)=>{for(const k of parent.children){if(path.includes(k)||k.matches('script,style,svg#pwEmbDefs'))continue;
  if(KEEP&&k.matches(KEEP))continue;if(KEEP&&k.querySelector(KEEP))around(m,k,path);else lock(k)}};
 const run=()=>{const m=document.querySelector(MODAL);want=[];if(m){KEEP=keepOf(m);const path=[];for(let n=m;n&&n!==document.body;n=n.parentElement)path.push(n);
  for(let n=m;n&&n!==document.body;n=n.parentElement)around(m,n.parentElement,path)}apply()};
 let q=0;new MutationObserver(()=>{if(!q){q=1;queueMicrotask(()=>{q=0;run()})}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','class']});run()})();
// Reward/shop rows: when big phone text makes the cards taller than the screen, shrink the row until it clears the gesture bar.
(()=>{const app=document.getElementById('app');if(!app)return;
 const probe=document.createElement('i');probe.style.cssText='position:fixed;left:0;bottom:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-bottom,0px)';document.body.append(probe);
 let mine=false;
 const heroes=s=>{mine=true;s.classList.remove('pw-tight');const lim=Math.min(s.getBoundingClientRect().bottom,innerHeight-probe.offsetHeight)-6;
  // hero cards taller than the screen: the loyalty line goes first (it is shown again in the fight)
  if(Math.max(...[...s.querySelectorAll('.hero-pick')].map(e=>e.getBoundingClientRect().bottom))>lim+.5)s.classList.add('pw-tight');queueMicrotask(()=>{mine=false})};
 // market: when big text makes Leave (top right) reach the wares, the strip starts below it
 const shop=s=>{const row=s.querySelector('.choices:has(>.buy)'),lv=s.querySelector(':scope>[data-act=leave]');if(!row||!lv)return;mine=true;row.style.removeProperty('margin-top');
  const a=lv.getBoundingClientRect();const r=[...row.children].map(e=>e.getBoundingClientRect()).find(r=>r.right>a.left-4&&r.left<a.right&&r.top<a.bottom+4&&r.bottom>a.top);
  if(r)row.style.setProperty('margin-top',Math.ceil(parseFloat(getComputedStyle(row).marginTop)+a.bottom+6-r.top)+'px','important');queueMicrotask(()=>{mine=false})};
 const run=()=>{const hs=app.querySelector('.screen.heroes');if(hs)return heroes(hs);const sh=app.querySelector('.screen.shop');if(sh)shop(sh);const row=app.querySelector('.screen:not(.shop) .choices');if(!row)return;const cards=[...row.children].filter(e=>e.matches('.card,.option'));if(!cards.length)return;
  mine=true;cards.forEach(c=>c.style.removeProperty('zoom'));const s=row.closest('.screen');s.classList.remove('pw-tight');
  const lim=Math.min(s.getBoundingClientRect().bottom,innerHeight-probe.offsetHeight)-6;
  const fit=()=>{for(let i=0;i<6;i++){const top=Math.min(...cards.map(c=>c.getBoundingClientRect().top)),bot=Math.max(...cards.map(c=>c.getBoundingClientRect().bottom));if(bot<=lim+.5||bot-top<40)return true;
   const z0=parseFloat(getComputedStyle(cards[0]).zoom)||1,z=Math.max(.62,z0*(lim-top)/(bot-top));if(z===z0)return false;cards.forEach(c=>c.style.zoom=z.toFixed(3))}return false};
  // still too tall at the smallest readable size: drop the fight recap line, the cards matter more
  if(!fit()){s.classList.add('pw-tight');cards.forEach(c=>c.style.removeProperty('zoom'));fit()}
  queueMicrotask(()=>{mine=false})};
 let rq=0;const kick=()=>{if(!rq)rq=requestAnimationFrame(()=>{rq=0;run()})};
 new MutationObserver(ms=>{if(mine||ms.every(m=>m.type==='attributes'&&(m.target.matches('.choices>.card,.choices>.option,.screen')||m.target.classList.contains('pw-big')||m.target.closest('.pw-big'))))return;kick()}).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
 addEventListener('resize',kick);kick()})();
/* Desktop: rest the mouse on a card in hand and that card grows in place, with its type line and rules text (the StS read). The grown card
   takes 54px more width and gives it back as margin, so the fan footprint stays the same and no other card moves. Touch keeps hold-to-read. */
(()=>{const app=document.getElementById('app');if(!app||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 let cur=null,saved=null;
 const drop=()=>{if(!cur)return;const el=cur;cur=null;el.classList.remove('pw-big');el.style.removeProperty('--pw-bigw');if(saved){if(saved.m==null)el.style.removeProperty('margin-inline');else el.style.setProperty('margin-inline',saved.m,'important')}saved=null};
 const grow=el=>{if(cur===el||document.documentElement.classList.contains('pw-dragging')||document.querySelector('.pw-zoom'))return;drop();cur=el;
  const m=el.style.getPropertyValue('margin-inline');saved={m:m||null};const base=parseFloat(getComputedStyle(el).marginLeft)||0;
  /* the big card is 130px wide or its own width, whichever is more, and the extra goes back as margin: on wide screens the cards are already wider than 130, so no card moves (1 Nov hotfix: the hand used to shift on hover) */
  const w0=el.offsetWidth,W=Math.max(130,w0);el.style.setProperty('--pw-bigw',W+'px');el.style.setProperty('margin-inline',(base-(W-w0)/2)+'px','important');el.classList.add('pw-big')};
 app.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const el=e.target.closest('.battle .hand>.card');if(el)grow(el)});
 app.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse'||!cur)return;const el=e.target.closest('.battle .hand>.card');if(el!==cur||(e.relatedTarget&&cur.contains(e.relatedTarget)))return;
  // the card changes shape under the pointer, so a leave is believed only when the pointer has really gone
  setTimeout(()=>{if(cur&&!cur.matches(':hover'))drop()},60)});
 for(const k of ['pointerdown','wheel'])addEventListener(k,()=>{if(cur&&!cur.matches(':hover'))drop()},{passive:true,capture:true});
 addEventListener('pointerdown',e=>{if(cur&&e.pointerType==='mouse'&&e.target.closest('.battle .hand>.card')===cur)drop()},{capture:true});
 new MutationObserver(()=>{if(cur&&!cur.isConnected){cur=null;saved=null}}).observe(app,{childList:true,subtree:true})})();
/* Landscape-only play (Randall 30 Oct): setup screens (hero select, journal) follow the phone; once a run is on, the APK turns
   the phone to landscape through the native bridge (window.PWNative, APK thread) and hands rotation back on the way out.
   Website: best-effort screen.orientation.lock, ignored where the browser refuses it. */
(()=>{const app=document.getElementById('app');if(!app)return;let want='';
 const apply=()=>{const setup=!!app.querySelector(':scope>.screen.heroes,:scope>.screen.journal');const w=setup?'default':'landscape';if(w===want)return;want=w;
  const n=window.PWNative;if(n&&typeof n.setOrientation==='function'){try{n.setOrientation(w)}catch(e){}return}
  const so=screen.orientation;if(!so)return;try{if(w==='landscape'){if(so.lock)so.lock('landscape').catch(()=>{})}else if(so.unlock)so.unlock()}catch(e){}};
 new MutationObserver(apply).observe(app,{childList:true});addEventListener('pwnative-ready',()=>{want='';apply()});apply()})();
/* long names on the small ware/reward cards: mark them so the CSS can step the type down instead of breaking mid-word */
(()=>{const app=document.getElementById('app');if(!app)return;
 const run=()=>{for(const b of app.querySelectorAll('.screen .choices .card .head b')){const t=b.textContent.trim();const w=t.split(/\s+/).reduce((m,x)=>Math.max(m,x.length),0);if(w>=10)b.dataset.long='';else delete b.dataset.long}};
 let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;run()})}}).observe(app,{childList:true,subtree:true});run()})();
/* a name wider than its band (MANAMORPHOSE on a 112px ware card, or any name at a large text size) steps its type down until it fits, never below 11px */
(()=>{const app=document.getElementById('app');if(!app)return;const MIN=11;const seen=new WeakSet();
 const fit=b=>{if(!b.isConnected||!b.clientWidth)return;let fs=parseFloat(getComputedStyle(b).fontSize),n=0;while(b.scrollWidth>b.clientWidth+1&&fs>MIN&&n++<16){fs=Math.max(MIN,fs-.5);b.style.setProperty('font-size',fs+'px','important')}};
 const ro=new ResizeObserver(es=>{for(const e of es)fit(e.target)});
 const run=()=>{for(const b of app.querySelectorAll('.screen .choices .card .head b, .pw-zoom .card .head b')){if(!seen.has(b)){seen.add(b);ro.observe(b)}fit(b)}};
 let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;run()})}}).observe(app,{childList:true,subtree:true});run()})();
/* ware and reward cards: the mana cost rides the art's corner (Slay the Spire style) so the name band keeps its whole width for long names */
(()=>{const app=document.getElementById('app');if(!app)return;
 const run=()=>{for(const c of app.querySelectorAll('.screen .choices .card')){const cost=c.querySelector(':scope>.head>.cost'),pic=c.querySelector(':scope>.pic');if(cost&&pic)pic.prepend(cost)}};
 let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;run()})}}).observe(app,{childList:true,subtree:true});run()})();
/* Hand glide (1 Nov hotfix, Randall: "glitchy on the hand and cards"): a re-render rebuilds the hand, so after a play or a draw the cards
   that stay used to jump to their new seats. Their old places are read just before the render; once the hand has been fitted (same frame,
   before paint) each card slides from where it was, like Slay the Spire. */
(()=>{const app=document.getElementById('app');if(!app)return;let old=null;
 const rm=matchMedia('(prefers-reduced-motion:reduce)');
 addEventListener('pw-prerender',()=>{old=null;if(rm.matches)return;const h=app.querySelector('.battle .hand');if(!h)return;old=new Map();for(const c of h.querySelectorAll(':scope>.card[data-cid]'))old.set(c.dataset.cid,c.getBoundingClientRect())});
 new MutationObserver(()=>{if(!old)return;const o=old;old=null;requestAnimationFrame(()=>{const h=app.querySelector('.battle .hand');if(!h||document.documentElement.classList.contains('pw-dragging'))return;
  const k=h.getBoundingClientRect().width/(h.offsetWidth||1)||1;
  for(const c of h.querySelectorAll(':scope>.card[data-cid]')){const a=o.get(c.dataset.cid);if(!a)continue;const b=c.getBoundingClientRect(),dx=(a.left+a.width/2-(b.left+b.width/2))/k,dy=(a.top+a.height/2-(b.top+b.height/2))/k;
   if(Math.abs(dx)<1&&Math.abs(dy)<1)continue;c.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0px,0px)'}],{duration:220,easing:'cubic-bezier(.22,.8,.24,1)',composite:'add'})/* translate is pinned with !important in the skins, so the slide adds onto the fan's transform */}})}).observe(app,{childList:true})})();
