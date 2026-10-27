// Live Forge table (fixture board, no transport) on real tablet and foldable screen
// sizes: everything a player needs is on screen, the board takes the height, nothing
// covers your hand or your permanents, every control is a full touch target, and tapping
// a card you can't act on shows it larger.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const UA='Mozilla/5.0 (Linux; Android 15; SM-F956U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
// CSS viewports of real devices, both ways round for the foldables.
const DEVICES=[['Galaxy Z Fold 8 Ultra',884,830],['Galaxy Z Fold 8 Ultra sideways',982,729],['Galaxy Z Fold 6',928,1004],['Galaxy Z Fold 6 sideways',1004,928],['Galaxy Z Fold 7',984,1016],['Pixel Fold',841,701],['Pixel 9 Pro Fold',791,820],
 ['iPad',768,1024],['iPad Pro 11',834,1194],['Galaxy Tab S9',640,1024],['Nexus 7',600,960],['Tablet sideways',1180,820],['Galaxy Tab S9 sideways with the browser bar',1024,560]];
const open=async(page,state)=>{await page.goto(base+'/experiments/forge-proof/table-fixture.html?state='+state);await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
 // Let the arrival animations finish so sizes are the settled ones.
 await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getTiming().iterations===Infinity));await sleep(300);};
try{
 for(const [name,width,height] of DEVICES){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1,userAgent:UA}),page=await context.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,'main');
  const m=await page.evaluate(()=>{
   const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}:null;};
   const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
   const need={cpuSeat:'.play-match-seat[data-seat=cpu]',youSeat:'.play-match-seat[data-seat=you]',cpuZones:'.forge-zone-row[data-seat=cpu]',youZones:'.forge-zone-row[data-seat=you]',mana:'.forge-mana-panel',next:'button[data-native-key=ok]',board:'.play-match-battlefields',cpuCommander:'.play-command-zone[data-seat=cpu]',youCommander:'.play-command-zone[data-seat=you]'};
   const boxes=Object.fromEntries(Object.entries(need).map(([k,s])=>[k,box(s)]));
   const hand=[...document.querySelectorAll('.play-match-hand .play-match-card[data-instance]')].map(c=>c.getBoundingClientRect());
   const dock=box('.play-match-decisions');
   const targets=[...document.querySelectorAll('.play-match-header>button,.play-match-header>details>summary,.forge-native-panel button,.forge-zone-row button')].filter(visible).map(e=>({label:(e.textContent||'').trim().slice(0,24),h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width}));
   const pieces=[...document.querySelectorAll('.play-match-battlefields .play-match-card[data-instance]')].map(c=>c.getBoundingClientRect().width);
   // Each of your permanents is reachable: the point at its centre hits that piece, not the hand or a panel.
   // (A crowded row scrolls sideways; only pieces scrolled into the board's view are checked.)
   const view=document.querySelector('.play-match-battlefields').getBoundingClientRect();
   const covered=[...document.querySelectorAll('.play-match-battlefields .play-match-zone[data-owner=you] .play-match-card[data-instance]')].filter(c=>{const r=c.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(x<view.left||x>view.right)return false;const hit=document.elementFromPoint(x,y);return !hit||hit.closest('.play-match-hand,.play-match-decisions,.play-match-seat,.forge-zone-row,.forge-mana-panel');}).map(c=>c.dataset.instance);
   const halves=[...document.querySelectorAll('.play-match-battlefields .play-match-zone')].map(z=>z.getBoundingClientRect().height);
   return {covered,halves,boxes,dock,handTop:Math.min(...hand.map(r=>r.top)),handBottom:Math.max(...hand.map(r=>r.bottom)),handLeft:Math.min(...hand.map(r=>r.left)),handRight:Math.max(...hand.map(r=>r.right)),
    magnifiers:[...document.querySelectorAll('.play-match-inspect-card')].filter(visible).length,targets,minPiece:Math.min(...pieces),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  for(const [k,b] of Object.entries(m.boxes)){assert(b,`${name}: ${k} is shown`);assert(b.l>=-1&&b.t>=-1&&b.r<=width+1&&b.b<=height+1,`${name}: ${k} is fully on screen ${JSON.stringify(b)}`);}
  assert.equal(m.magnifiers,0,`${name}: no magnifier buttons`);
  assert(m.overflow<=1,`${name}: no sideways scrolling`);
  for(const t of m.targets)assert(t.h>=44,`${name}: "${t.label}" is a 44 px touch target (${Math.round(t.h)}px)`);
  // Offline the fixture has no Scryfall type lines, so every permanent shares one row: the
  // worst case. With real card types (a live match) pieces are about twice this size.
  assert(m.minPiece>=50,`${name}: board pieces stay readable (${Math.round(m.minPiece)}px)`);
  // The hand is tucked along the bottom edge beside the decision card and never covers your
  // permanents; each half of the board keeps real height.
  const upright=width/height<=1.15;
  assert(m.handRight<=m.dock.l+2,`${name}: the hand sits beside the decision card (${Math.round(m.handRight)} > ${Math.round(m.dock.l)})`);
  assert(m.handTop>=m.boxes.board.b-12,`${name}: the hand starts below the board (${Math.round(m.handTop)} < ${Math.round(m.boxes.board.b)})`);
  assert.deepEqual(m.covered,[],`${name}: none of your permanents is under the hand or a panel`);
  assert(Math.min(...m.halves)>=height*(height<650?.22:.25),`${name}: each half of the board keeps its height (${m.halves.map(Math.round)})`);
  // Tapping a card Forge does not offer shows it larger; tapping one it offers plays it.
  await page.evaluate(()=>{window.calls=[];const s=window.fixture.session;s.nativeSelect=(...a)=>{window.calls.push(['select',...a]);return Promise.resolve();};});
  // A point where the card itself is on top (piles and the hand fan overlap their neighbours).
  const [plain,offered]=await page.evaluate(()=>{const at=c=>{const r=c.getBoundingClientRect();for(let fy=.5;fy>.1;fy-=.1)for(let fx=.15;fx<.9;fx+=.1){const x=r.left+r.width*fx,y=r.top+r.height*fy;if(document.elementFromPoint(x,y)?.closest('.play-match-card')===c)return {x,y,id:Number(c.dataset.instance)};}return null;};
   const first=(sel,ok)=>[...document.querySelectorAll(sel)].filter(ok).map(at).find(Boolean);
   return [first('[data-owner=cpu] .play-match-card[data-instance]',c=>c.dataset.forgeHint!=='true'),first('.play-match-hand .play-match-card[data-instance]',c=>c.dataset.forgeHint==='true')];});
  assert(plain&&offered,`${name}: a CPU card and a playable hand card can be tapped`);
  await page.touchscreen.tap(plain.x,plain.y);await sleep(300);
  assert.equal(await page.evaluate(()=>document.querySelector('.forge-peek')?.dataset.open),'true',`${name}: tapping a CPU card shows it larger`);
  assert.deepEqual(await page.evaluate(()=>window.calls.splice(0)),[],`${name}: that tap plays nothing`);
  const peek=await page.evaluate(()=>{const r=document.querySelector('.forge-peek').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom};});
  assert(peek.l>=-1&&peek.t>=-1&&peek.r<=width+1&&peek.b<=height+1,`${name}: the preview fits on screen ${JSON.stringify(peek)}`);
  await page.touchscreen.tap(plain.x,plain.y);await sleep(300);
  assert.equal(await page.evaluate(()=>document.querySelector('.forge-peek')?.dataset.open),'false',`${name}: tapping it again closes the preview`);
  await page.touchscreen.tap(offered.x,offered.y);await sleep(300);
  assert.deepEqual(await page.evaluate(()=>window.calls.splice(0)),[],`${name}: tapping a playable card opens it without playing it`);
  const play=await page.evaluate(()=>{const n=document.querySelector('.forge-peek[data-open=true] [data-peek-play]');if(!n)return null;const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,h:r.height,label:n.textContent};});
  assert(play&&play.label==='Play'&&play.h>=44,`${name}: the open card offers a Play button ${JSON.stringify(play)}`);
  assert(play.x>0&&play.x<width&&play.y>0&&play.y<height,`${name}: Play is on screen`);
  await page.touchscreen.tap(play.x,play.y);await sleep(300);
  assert.deepEqual(await page.evaluate(()=>window.calls.splice(0)),[['select','card',offered.id]],`${name}: Play plays the card`);
  assert.equal(await page.evaluate(()=>document.querySelector('.forge-peek')?.dataset.open),'false',`${name}: the preview closes after Play`);
  // A finger drag: up onto the board plays the card; back onto the hand plays nothing; the page never scrolls.
  const cdp=await context.newCDPSession(page),touch=(type,pts=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y])=>({x,y}))});
  const drag=async(from,dy,back=false)=>{await touch('touchStart',[[from.x,from.y]]);for(let i=1;i<=12;i++){await touch('touchMove',[[from.x+i,from.y+dy*i/12]]);await sleep(16);}
   if(back)for(let i=11;i>=0;i--){await touch('touchMove',[[from.x+i,from.y+dy*i/12]]);await sleep(16);}await sleep(40);await touch('touchEnd');await sleep(350);};
  await drag(offered,-Math.min(300,offered.y-120));
  assert.deepEqual((await page.evaluate(()=>window.calls.splice(0))).map(c=>c.slice(0,3)),[['select','card',offered.id]],`${name}: dragging a card up out of the hand plays it`);
  await drag(offered,-Math.min(300,offered.y-120),true);
  assert.deepEqual(await page.evaluate(()=>window.calls.splice(0)),[],`${name}: dragging a card back onto the hand plays nothing`);
  assert.deepEqual(await page.evaluate(()=>[scrollX,scrollY,document.querySelector('.forge-drag-ghost')===null]),[0,0,true],`${name}: no page scroll and no leftover drag image`);
  // The opening hand: every card whole and readable, Keep and Mulligan on screen.
  await open(page,'opening');
  const o=await page.evaluate(()=>({cards:[...document.querySelectorAll('.play-match-hand .play-match-card[data-instance]')].map(c=>{const r=c.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width};}),
   buttons:[...document.querySelectorAll('.forge-native-panel button[data-native-key]')].map(b=>{const r=b.getBoundingClientRect();return {k:b.dataset.nativeKey,b:r.bottom,h:r.height};})}));
  assert.equal(o.cards.length,7,`${name}: seven opening cards`);
  for(const c of o.cards)assert(c.t>=-1&&c.b<=height+1&&c.l>=-1&&c.r<=width+1,`${name}: opening card on screen ${JSON.stringify(c)}`);
  if(upright)assert(Math.min(...o.cards.map(c=>c.w))>=110,`${name}: opening cards are readable on an upright screen (${Math.round(Math.min(...o.cards.map(c=>c.w)))}px)`);
  for(const b of o.buttons.filter(b=>['ok','cancel'].includes(b.k)))assert(b.b<=height+1&&b.h>=44,`${name}: ${b.k} is on screen and a full target`);
  assert.deepEqual(errors,[],`${name}: no page errors`);
  console.log(`PASS ${name} ${width}x${height}: complete table on screen, board-first with the hand tucked beside the decision card, 44 px controls, tap opens a card with Play, finger drag plays, readable opening hand.`);
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
