// Browser sensors are simulated; no claim of physical-phone hardware coverage.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Tilt browser execution is restricted to hosted GitHub Actions.');
const {chromium,devices}=await import('playwright');
const root=process.cwd(),baseline='b1fc1fd79b0c9e7b9e46feb0101ca5c485d586c6';
async function layoutFailure(page,cell,error){
 const layout=await page.evaluate(()=>{
  const sheet=document.querySelector('#sheetBody'),bounds=sheet?.getBoundingClientRect();
  const describe=n=>{
   const s=getComputedStyle(n),r=n.getBoundingClientRect(),path=[];for(let p=n;p&&p!==document.body;p=p.parentElement)path.unshift(p.tagName.toLowerCase()+(p.id?'#'+p.id:p.classList.length?'.'+[...p.classList].join('.'):''));
   return {path:path.join(' > '),text:n.textContent.trim().slice(0,140),rect:r.toJSON(),clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,style:Object.fromEntries(['display','position','boxSizing','width','minWidth','maxWidth','gridTemplateColumns','flex','overflowX','overflowY','overflowWrap','wordBreak','whiteSpace','paddingLeft','paddingRight','columnGap','zoom'].map(k=>[k,s[k]])),intentionalTabScroller:!!n.closest('.cs-tabs')};
  };
  const visible=sheet?[sheet,...sheet.querySelectorAll('*')].filter(n=>n.getClientRects().length):[];
  return {viewport:{width:innerWidth,height:innerHeight,devicePixelRatio,documentClient:document.documentElement.clientWidth,documentScroll:document.documentElement.scrollWidth,bodyZoom:getComputedStyle(document.body).zoom},sheet:sheet&&describe(sheet),containers:[...document.querySelectorAll('dialog.sheet,.cs-panel,.cs-card,.cd-art-stack,.cs-card-side,.card-actions,.ca-main,.ca-more,.cs-tabs')].map(describe),overflowing:visible.filter(n=>{const r=n.getBoundingClientRect();return n.scrollWidth>n.clientWidth+2||r.left<bounds.left-2||r.right>bounds.right+2;}).slice(0,120).map(describe)};
 });
 const result={cell,error:String(error.stack||error),layout},dir=resolve(root,'test-results'),name=`tilt-layout-${cell.game.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-${cell.width}-${Math.round(cell.textScale*100)}-failure`;
 console.error('TILT LAYOUT FAILURE '+JSON.stringify(result));await mkdir(dir,{recursive:true});
 await writeFile(resolve(dir,name+'.json'),JSON.stringify(result,null,2));await page.screenshot({path:resolve(dir,name+'.png'),fullPage:true,animations:'disabled'});
}
const fixture=old=>`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0}#content{padding:20px}.cd-img{width:140px;height:195px;background:linear-gradient(30deg,#333,#a85);border-radius:12px}.card-img{width:100%;height:100%;object-fit:cover}dialog{padding:20px;position:fixed;inset:20px auto auto 20px;background:#191c24;color:white}#background{position:fixed;top:10px;left:10px}</style><main id="content"><div class="cd-img" id="background"><span>Background card</span></div></main><dialog id="popup"><h2>Card view</h2><div class="cd-img" id="visible"><button class="cd-zoom" style="height:100%">Card artwork</button></div><button id="replace">Next card</button><button id="close">Close</button></dialog><script type="module">import {attachTilt} from '/${old?'__old-feel.js':'feel.js'}';attachTilt();document.querySelector('#popup').showModal();document.querySelector('#replace').onclick=()=>{const c=document.querySelector('#visible'),next=c.cloneNode(true);next.id='next';next.removeAttribute('style');next.className='cd-img';c.replaceWith(next);};document.querySelector('#close').onclick=()=>document.querySelector('#popup').close();</script>`;
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');if(u.pathname==='/__fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture(u.searchParams.has('old')));}
 if(u.pathname==='/__old-feel.js'){res.setHeader('Content-Type','text/javascript');return res.end(execFileSync('git',['show',baseline+':feel.js']));}
 const file=resolve(root,'.'+u.pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[extname(file)]||'text/plain');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
// Only the sensor fixtures own a deterministic motion queue. Native rendering
// and observer delivery continue, but each sample applies exactly one queued
// frame regardless of a late intersection/load/resize scheduling the same work.
// Geometry fixtures below keep the browser's untouched animation scheduler.
const installMotionScheduler=page=>page.addInitScript(()=>{
 const nativeFrame=window.requestAnimationFrame.bind(window),frames=new Map();let id=0;
 window.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};
 window.cancelAnimationFrame=key=>frames.delete(key);
 window.__motionFrame=async()=>{
  await new Promise(resolve=>nativeFrame(()=>nativeFrame(resolve)));
  const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(performance.now());
 };
});
const motionFrame=page=>page.evaluate(()=>window.__motionFrame());
const turn=async(page,beta,gamma)=>{await page.evaluate(({beta,gamma})=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta,gamma})),{beta,gamma});await motionFrame(page);};
try{
 const old=await browser.newContext({...devices['Pixel 7']}),before=await old.newPage();await installMotionScheduler(before);await before.goto(base+'/__fixture?old');await turn(before,30,0);await turn(before,40,12);
 assert.equal(await before.locator('#visible').evaluate(c=>c.classList.contains('gyro')),false);assert.equal(await before.locator('#background').evaluate(c=>c.classList.contains('gyro')),true);console.log('REPRODUCED: old sensor handler animates the background card instead of the card in the open sheet.');await old.close();
 for(const [name,viewport,hybrid] of [['Magic',{width:412,height:915},false],['Pokémon',{width:344,height:882},false],['Yu-Gi-Oh!',{width:884,height:1104},true]]){
  const context=await browser.newContext({...devices['Pixel 7'],viewport}),page=await context.newPage();
  await installMotionScheduler(page);
  if(hybrid)await page.addInitScript(()=>{const mm=window.matchMedia.bind(window);window.matchMedia=q=>q==='(hover: none)'?new Proxy(mm(q),{get:(t,k)=>k==='matches'?false:typeof t[k]==='function'?t[k].bind(t):t[k]}):mm(q);});
  await page.goto(base+'/__fixture');await turn(page,30,0);await turn(page,40,12);
  const card=await page.locator('#visible').evaluate(c=>({tx:c.style.getPropertyValue('--tx'),transform:getComputedStyle(c).transform,gyro:c.classList.contains('gyro'),shine:c.classList.contains('shine-once'),holo:getComputedStyle(c,'::before').content}));
  assert(card.gyro);assert.notEqual(card.tx,'0deg');assert.notEqual(card.transform,'none');assert.equal(card.shine,false,'entrance animation cannot mask live sensor tilt');assert.notEqual(card.holo,'none');assert.equal(await page.locator('#background').evaluate(c=>c.classList.contains('gyro')),false);
  const original=await page.locator('#visible').elementHandle();
  await page.getByRole('button',{name:'Next card',exact:true}).click();await motionFrame(page);
  assert(await original.evaluate(c=>!c.isConnected&&document.querySelector('#next')!==c),'replacement is a genuinely new card node');
  const replacement=await page.locator('#next').elementHandle();
  const replacementTilt=()=>replacement.evaluate(c=>{if(!c.isConnected||document.querySelector('#next')!==c)throw Error('The calibrated replacement must remain the current connected node');return {gyro:c.classList.contains('gyro'),tx:c.style.getPropertyValue('--tx'),ty:c.style.getPropertyValue('--ty')};});
  assert.deepEqual(await replacementTilt(),{gyro:true,tx:'0deg',ty:'0deg'},'mutation activates the new printing using the last 40/12 sample before another sensor event');
  await turn(page,40,12);assert.equal((await replacementTilt()).tx,'0deg','the unchanged sample remains the new resting angle');
  await turn(page,60,20);assert.equal((await replacementTilt()).tx,'3.92deg','changed sample tilts from the replacement baseline with exactly 2% drift');
  await turn(page,65,30);assert.notEqual((await replacementTilt()).tx,'0deg');
  await page.getByRole('button',{name:'Close',exact:true}).click();await turn(page,30,0);await turn(page,40,10);assert(await page.locator('#background').evaluate(c=>c.classList.contains('gyro')));
  console.log(`PASS: ${name} shared card view: foreground tilt + holographic light, ${viewport.width}px viewport${hybrid?' with hover-capable touch input':''}, printing replacement/recalibration and popup dismissal.`);await context.close();
 }
 // Use production card-view classes and the reported long flip/title labels.
 for(const width of [320,344,412,768,884])for(const textScale of [1,1.25])for(const game of ['Magic','Pokémon','Yu-Gi-Oh!']){
  const context=await browser.newContext({viewport:{width,height:width>700?540:1104}}),page=await context.newPage();
  try{await page.goto(base+'/__fixture');
  await page.evaluate(game=>{
   document.querySelector('style').remove();document.querySelector('#popup').remove();document.querySelector('#content').innerHTML='';
   const d=document.createElement('dialog');d.className='sheet';d.dataset.cardPopup='true';d.innerHTML=`<div id="sheetBody"><header class="sheet-head overlay scrolled"><span class="sh-title">${game}: Avatar Aang // Aang, Master of Elements with a complete long printing name</span><button class="icon">✕</button></header><div class="cs-title"><div><h2>${game}: Aang, Master of Elements</h2></div></div><nav class="cs-tabs"><button>Overview</button><button>Meta</button><button>Play guide</button><button>Versions</button><button>Prices</button><button>Rules &amp; legality</button></nav><section class="cs-panel"><div class="cs-card"><div class="cd-art-stack"><div class="cd-img"><div style="aspect-ratio:63/88;background:#354">Card</div></div><button class="btn ghost small block">↻ Flip to Aang, Master of Elements</button></div><div class="cs-card-side"><p>Not in your collection</p><div class="stat-grid"><div><small>Stage</small><b>Basic</b></div><div><small>Regulation mark</small><b>F</b><p>Rotated out of Standard · Expanded only</p></div></div></div></div><div class="card-actions"><div class="ca-main"><button class="btn">＋ Add to collection</button><button class="btn ghost">♡ On wishlist</button></div><div class="ca-more"><button class="btn ghost small">⚒ Build decks</button><button class="btn ghost small">⇄ Compare</button></div></div></section></div>`;document.body.append(d);d.showModal();
  },game);
  await page.evaluate(scale=>document.body.style.zoom=scale,textScale);
  const clipped=await page.locator('#sheetBody button, #sheetBody .sh-title, #sheetBody h2, #sheetBody .stat-grid small, #sheetBody .stat-grid b, #sheetBody .stat-grid p').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>({text:n.textContent,width:n.clientWidth,scroll:n.scrollWidth})));
  assert.equal(await page.locator('.cd-art-stack > .btn').evaluate(n=>!!n.closest('.cd-img')),false,'flip label is outside the animated card surface');
  assert(await page.locator('.cs-tabs').evaluate(n=>n.clientHeight<=n.querySelector('button').clientHeight+22),'pill bar is a single horizontally scrollable row');
  assert.deepEqual(clipped,[],`${game} ${width}px full labels must wrap, not clip`);
  assert(await page.locator('#sheetBody').evaluate(n=>n.scrollWidth<=n.clientWidth+2),'no horizontal clipping hidden by sheet overflow');
  assert(await page.locator('.cs-panel').evaluate(n=>n.querySelector('.cd-art-stack > .btn').getBoundingClientRect().bottom<=n.querySelector('.card-actions').getBoundingClientRect().top+2),'wrapped flip control does not overlap collection actions');
  const geometry=await page.locator('.cs-card').evaluate(root=>{
   const art=root.querySelector('.cd-art-stack'),side=root.querySelector('.cs-card-side'),a=art.getBoundingClientRect(),s=side.getBoundingClientRect(),panelWidth=parseFloat(getComputedStyle(root.closest('.cs-panel')).width),narrow=panelWidth<=600;
   const broken=[],outside=[];
   // Intact words in the extreme stacked view, not an anywhere-wrap shortcut.
   if(narrow)for(const n of root.querySelectorAll('.cd-art-stack > .btn,.stat-grid small,.stat-grid b,.stat-grid p')){
    const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();if(r.left<p.left-2||r.right>p.right+2)outside.push(n.textContent);
    const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let text;
    while((text=walker.nextNode()))for(const word of text.textContent.matchAll(/[\p{L}\p{N}]+/gu)){
     if(word[0].length<3)continue;const range=document.createRange();range.setStart(text,word.index);range.setEnd(text,word.index+word[0].length);
     if(new Set([...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>Math.round(r.top))).size>1)broken.push(word[0]);
    }
   }
   return {narrow,panelWidth,cols:getComputedStyle(root).gridTemplateColumns.split(' ').length,statCols:getComputedStyle(side.querySelector('.stat-grid')).gridTemplateColumns.split(' ').length,art:a.toJSON(),side:s.toJSON(),artWidth:parseFloat(getComputedStyle(art).width),artClient:art.clientWidth,artScroll:art.scrollWidth,overlap:Math.min(a.right,s.right)-Math.max(a.left,s.left)>2&&Math.min(a.bottom,s.bottom)-Math.max(a.top,s.top)>2,broken,outside};
  });
  assert.equal(geometry.cols,geometry.narrow?1:2,`Narrow containers stack the centered card ${JSON.stringify(geometry)}`);
  if(geometry.panelWidth<=520)assert.equal(geometry.statCols,2,'Compact stat grid remains two-column; wide auto-fit remains unchanged');
  assert(!geometry.overlap&&geometry.artScroll<=geometry.artClient+2,`Art and flip label cannot intrude into stats ${JSON.stringify(geometry)}`);
  if(geometry.narrow){assert(geometry.artWidth<=(geometry.panelWidth<=260?220.5:310.5));assert.deepEqual(geometry.broken,[],'Full flip/stat words remain intact at extreme zoom');assert.deepEqual(geometry.outside,[],'Long labels stay inside their own cell, not merely inside the sheet');}
  console.log(`PASS: ${game} ${width}px at${Math.round(textScale*100)}% title, face-flip label, all tabs and collection/deck actions fit without text clipping.`);
  }catch(error){await layoutFailure(page,{game,width,textScale},error).catch(diagnosticError=>console.error('Tilt failure diagnostic error:',diagnosticError));throw error;}finally{await context.close();}
 }
 const reduced=await browser.newContext({...devices['Pixel 7'],reducedMotion:'reduce'}),p=await reduced.newPage();await installMotionScheduler(p);await p.goto(base+'/__fixture');await turn(p,30,0);await turn(p,50,15);assert.equal(await p.locator('#visible').evaluate(c=>c.classList.contains('gyro')),false);console.log('PASS: reduced-motion preference remains respected.');await reduced.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
