// Live Forge table (fixture board, no transport) under real touch input: a long press
// previews a card, and however it ends, the next tap still reaches the game.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 for(const viewport of [{width:800,height:1280},{width:390,height:844}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await sleep(800);
  await page.evaluate(()=>{window.calls=[];const s=window.fixture.session;s.nativeSelect=(...a)=>{window.calls.push(['select',...a]);return Promise.resolve();};s.nativeButton=(...a)=>{window.calls.push(['button',...a]);return Promise.resolve();};});
  const cdp=await context.newCDPSession(page),touch=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y])=>({x,y}))});
  const tap=async({x,y})=>{await touch('touchStart',[[x,y]]);await sleep(60);await touch('touchEnd');await sleep(200);};
  const calls=()=>page.evaluate(()=>window.calls.splice(0)),peekOpen=()=>page.evaluate(()=>document.querySelector('.forge-peek')?.dataset.open==='true');
  const [a,b]=await page.evaluate(()=>{document.querySelector('.play-match-hand').scrollIntoView({block:'nearest'});return [...document.querySelectorAll('.play-match-hand .play-match-card[data-instance]')].map(c=>{const r=c.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+Math.min(r.height/2,40);return {id:+c.dataset.instance,x,y,hit:document.elementFromPoint(x,y)?.closest('.play-match-card')===c};}).filter(c=>c.hit).filter((c,i)=>i===0||i===2);});
  const dock=await page.evaluate(()=>{const n=[...document.querySelectorAll('button[data-native-key=ok]')].find(n=>!n.disabled),r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return n.contains(document.elementFromPoint(x,y))&&{x,y};});
  assert(a&&b&&dock,'fixture shows two tappable hand cards and an enabled OK');
  for(const [name,drift,end] of [['still',0,'touchEnd'],['drift then lift',13,'touchEnd'],['drift then cancel',14,'touchCancel'],['slide then cancel',40,'touchCancel']]){
   await touch('touchStart',[[a.x,a.y]]);await sleep(600);assert(await peekOpen(),`${name}: a long press opens the preview`);
   for(let d=3;d<=drift;d+=3){await touch('touchMove',[[a.x+d,a.y+Math.min(d,4)]]);await sleep(16);}
   if(drift)await touch('touchMove',[[a.x+drift,a.y+4]]);
   await sleep(50);await touch(end);await sleep(500);
   assert.deepEqual(await calls(),[],`${name}: the press that opened the preview plays nothing`);
   assert.equal(await peekOpen(),false,`${name}: the preview closes with its press`);
   // A tap opens the card; its Play button plays it.
   await tap(b);assert.deepEqual(await calls(),[],`${name}: the next card tap opens the card`);assert(await peekOpen(),`${name}: the next card tap reaches the table`);
   const play=await page.evaluate(()=>{const n=document.querySelector('.forge-peek [data-peek-play]');if(!n)return null;const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
   assert(play,`${name}: the open card offers Play`);await tap(play);assert.deepEqual(await calls(),[['select','card',b.id]],`${name}: Play reaches the game`);
   await tap(dock);assert.deepEqual((await calls()).map(c=>c.slice(0,2)),[['button','ok']],`${name}: the next dock tap reaches the game`);
  }
  console.log(`PASS ${viewport.width}x${viewport.height}: after a long press that stays, drifts or is taken by the browser, the next card tap opens it, Play plays it and the dock tap reaches the game.`);
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
