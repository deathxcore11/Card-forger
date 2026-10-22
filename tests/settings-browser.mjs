import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {artworkSources} from '../artwork.js';
import {startServer,openSearchApp,noOverflow,capture,inventorySnapshot,CARDS,RAW} from './search-fixtures.mjs';
const sources=JSON.parse(await readFile(new URL('./frame-art/sources.json',import.meta.url)));
const pinned=Object.fromEntries(await Promise.all(['mtg','ptcg','ygo'].map(async game=>[game,{source:sources[game][0],file:`tests/frame-art/${game}.${sources[game][1]}`,type:game==='ptcg'?'image/webp':'image/jpeg',bytes:await readFile(new URL(`./frame-art/${game}.${sources[game][1]}`,import.meta.url))}])));
const review=JSON.parse(await readFile(new URL('../review/cases.json',import.meta.url)));
const cases=Array.isArray(review)?review:review.cases;
const extra=async(file,source,label)=>({file,source,label,type:file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/jpeg',bytes:await readFile(new URL('../'+file,import.meta.url))});
const samples={
 mtg:[{...pinned.mtg,label:'miara-dark'},await extra('review/assets/miara-566.jpg',cases.find(c=>c.key==='mtg-miara-etched').source,'miara-detailed'),await extra('test-fixtures/finish-effects/chishiro-nec77.png','https://media.wizards.com/2021/neo/en_3yF31xnXEM.png','chishiro-complex')],
 ptcg:[await extra('tests/fixtures/pokemon-promos/SWSH032.webp','https://assets.tcgdex.net/en/swsh/swshp/SWSH032/high.webp','wooloo-bright'),{...pinned.ptcg,label:'zapdos-dark'},await extra('tests/fixtures/pokemon-promos/SWSH220.webp','https://assets.tcgdex.net/en/swsh/swshp/SWSH220/high.webp','rowlet-detailed'),await extra('review/assets/charizard-vmax.png',cases.find(c=>c.key==='pk-charizard-vmax').source,'charizard-full-art')],
 ygo:[{...pinned.ygo,label:'blue-eyes-complex'},await extra('test-fixtures/finish-effects/psy-framelord-omega.jpg','https://images.ygoprodeck.com/images/cards/74586817.jpg','omega-dark'),await extra('test-fixtures/finish-effects/dracotail-lukias.jpg','https://images.ygoprodeck.com/images/cards/75003700.jpg','lukias-detailed')]
};
const longNames={mtg:'Alpha fixture • The Archivist of Forgotten Worlds, Keeper of the Unwritten Chronicles',ptcg:'Alpha fixture • Professor’s Research (Professor Oak’s Celebrations Research Archive)',ygo:'Alpha fixture • The Celestial Dragon of Ancient Worlds and the Endless Twilight'};
for(const game of ['mtg','ptcg','ygo'])for(const card of [...CARDS[game],...RAW[game]])if(card.name.startsWith('Alpha fixture'))card.name=longNames[game]+' '+card.id;
const evidence='Synthetic long card names, prices, inventory and provider responses. Unchanged pinned public artwork is substituted into the same-game header/card/daily ambient only for visual-fit, contrast and translucency stress checks, not card identity, live prices, provider availability or real-device proof. No art filters or text opacity are injected by the harness; the temporary ambient visibility A/B is diagnostic only.';
const headerChecks=[],gestureChecks=[];let failure,failureDiagnostics;
const rgb=value=>{const n=String(value).match(/[\d.]+/g)?.map(Number);assert(n&&n.length>=3,'computed RGB color: '+value);return n;};
const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
async function readHeader(page){return page.locator('.cs-banner > .cs-title').evaluate(async title=>{
 const {applyTheme}=await import('/settings-theme.js'),hero=title.parentElement.querySelector('.cs-hero'),box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},style=n=>getComputedStyle(n),ambient=document.querySelector('#ambient'),art=ambient.querySelector('.amb-art'),sheet=document.querySelector('#sheet'),panel=document.querySelector('#sheetBody .cd-text');
 const geometry=()=>({title:box(title),hero:box(hero),mask:style(hero).maskImage,card:[...document.querySelectorAll('#sheetBody .card-img')].map(n=>({box:box(n),filter:style(n).filter,mask:style(n).maskImage})),foil:[...document.querySelectorAll('#sheetBody .finish-layer')].map(n=>({box:box(n),mask:style(n).clipPath}))});
 const light=geometry(),img=hero.querySelector('img');
 const walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT),lines=[];let node;while(node=walker.nextNode())if(node.textContent.trim()){const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width&&r.height)lines.push({x:r.left+r.width/2,y:r.top+r.height/2,top:r.top,bottom:r.bottom});}
 const lastLine=lines.sort((a,b)=>b.bottom-a.bottom)[0];lastLine.reachable=lastLine.x>=0&&lastLine.x<=innerWidth&&lastLine.y>=0&&lastLine.y<=innerHeight&&title.contains(document.elementFromPoint(lastLine.x,lastLine.y));
 // getComputedStyle needs its second argument for a pseudo-element.
 const b=getComputedStyle(title,'::before'),result={geometry:light,lastLine,banner:box(title.parentElement),backing:{color:b.backgroundColor,image:b.backgroundImage,content:b.content,pointerEvents:b.pointerEvents,radius:b.borderRadius,top:parseFloat(b.top),bottom:parseFloat(b.bottom),width:parseFloat(b.width)},ink:[...title.querySelectorAll('h2,.type-line,.hp,.lvl')].map(n=>({tag:n.className||n.tagName,color:style(n).color,shadow:style(n).textShadow,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})),owned:[...title.querySelectorAll('.card-owned-summary')].map(n=>({ink:style(n).color,background:style(n).backgroundColor})),image:{src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight},ambient:{display:style(ambient).display,background:style(art).backgroundImage,source:art.dataset.src,opacity:Number(style(art).opacity),transition:style(art).transitionDuration},sheet:{color:style(sheet).backgroundColor,blur:style(sheet).backdropFilter,art:getComputedStyle(sheet,'::before').backgroundImage,artPointer:getComputedStyle(sheet,'::before').pointerEvents,wash:getComputedStyle(sheet,'::after').backgroundColor,washPointer:getComputedStyle(sheet,'::after').pointerEvents},panel:{color:style(panel).backgroundColor,opacity:Number(style(panel).opacity)},motion:style(hero.querySelector('.cs-art')).animationName};
 applyTheme('dark',{persist:false});result.dark={geometry:geometry(),backing:getComputedStyle(title,'::before').content};applyTheme('light',{persist:false});return result;
 });}
async function ambientDifference(page){
 const region=await page.locator('#sheet').evaluate(sheet=>{const r=sheet.getBoundingClientRect(),tabs=document.querySelector('.cs-tabs').getBoundingClientRect();return {x:Math.ceil(r.left+20),y:Math.ceil(tabs.bottom+10),width:Math.floor(r.width-40),height:Math.floor(Math.min(r.bottom-20,innerHeight-20)-tabs.bottom-10)};});assert(region.height>50,'lower content remains in viewport for art visibility proof');
 const before=await page.screenshot({animations:'disabled'});const ambientValue=await page.evaluate(()=>document.body.style.getPropertyValue('--ambient-art-image'));await page.evaluate(()=>document.body.style.setProperty('--ambient-art-image','none'));
 let after;try{after=await page.screenshot({animations:'disabled'});}finally{await page.evaluate(value=>document.body.style.setProperty('--ambient-art-image',value),ambientValue);}
 return page.evaluate(async({a,b,r})=>{
  const pixels=async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=r.width;c.height=r.height;const x=c.getContext('2d');x.drawImage(image,r.x,r.y,r.width,r.height,0,0,r.width,r.height);return x.getImageData(0,0,r.width,r.height).data;};
  const x=await pixels(a),y=await pixels(b);let diff=0,changed=0;for(let i=0;i<x.length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(x[i+c]-y[i+c]);diff+=d;if(d>=6)changed++;}return {region:r,meanDifference:diff/(x.length/4*3),changedFraction:changed/(x.length/4)};
 },{a:before.toString('base64'),b:after.toString('base64'),r:region});
}
for(const [game,rows] of Object.entries(samples))for(const sample of rows){assert(sample.bytes.length>5000,game+' pinned art bytes');assert.match(sample.source,/^https:\/\//);sample.sha256=createHash('sha256').update(sample.bytes).digest('hex');}
if(process.argv.includes('--validate-fixtures')){console.log('PASS: ten pinned same-game public-art fixtures, synthetic long title data and hosted-only Light glass matrix. No browser or network started.');process.exit(0);}
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch({headless:true});
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390}),{page}=app;
  try{
   // Read-only event evidence for intermittent missed Settings tab activation.
   // Keep the original one-click assertions: never retry the click or relax it.
   await page.evaluate(()=>{
    const trace=window.__settingsInteractionTrace=[];let pressed=null;
    const record=(type,target,extra={})=>{
     const dialog=document.querySelector('#settingsDialog');
     if(!dialog?.open&&!target?.closest?.('#settingsDialog'))return;
     trace.push({type,at:performance.now(),step:window.__settingsTraceStep||null,target:target?.id||target?.closest?.('[data-act]')?.dataset.act||target?.nodeName,pressed:pressed?.id||null,pressedConnected:pressed?.isConnected??null,stateTab:window.__uiTestState?.ui.settingsTab,pane:dialog.querySelector('.settings-pane:not([hidden])')?.id,selected:dialog.querySelector('.settings-tabs [aria-selected="true"]')?.id,focus:document.activeElement?.id,viewport:innerWidth,navigationBusy:document.querySelector('#content')?.getAttribute('aria-busy'),railLeft:dialog.querySelector('.settings-tabs')?.scrollLeft,dialogTop:dialog.scrollTop,...extra});
     if(trace.length>600)trace.splice(0,trace.length-600);
    };
    for(const type of ['pointerdown','pointerup','click'])window.addEventListener(type,e=>{if(type==='pointerdown')pressed=e.target;record(type+'-capture',e.target,{x:e.clientX,y:e.clientY,pointerType:e.pointerType,detail:e.detail,trusted:e.isTrusted,defaultPrevented:e.defaultPrevented});},true);
    document.addEventListener('click',e=>record('click-bubble',e.target,{defaultPrevented:e.defaultPrevented,trusted:e.isTrusted}));
    document.addEventListener('scroll',e=>record('scroll-capture',e.target,{scrollLeft:e.target.scrollLeft,scrollTop:e.target.scrollTop,trusted:e.isTrusted}),true);
    const dialog=document.querySelector('#settingsDialog');
    new MutationObserver(rows=>{for(const row of rows)if(row.type==='childList'||row.target.matches?.('.settings-pane,.settings-tabs [role="tab"]'))record('mutation',row.target,{attribute:row.attributeName,removed:row.removedNodes?.length||0,added:row.addedNodes?.length||0});}).observe(dialog,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-selected','tabindex']});
   });
   const artHits=new Set(),artURLs=new Set(CARDS[game].filter(c=>c.name.startsWith('Alpha fixture')).flatMap(c=>[...artworkSources(c,true),...artworkSources(c,false),c.art,c.artDirect,c.image,c.imageLarge,...Object.values(c.image_uris||{})].filter(Boolean)).map(url=>new URL(url,server.base).href));
   for(const url of artURLs)await page.route(url,async route=>{await route.fulfill({contentType:pinned[game].type,body:pinned[game].bytes});artHits.add(route.request().url());});
   const field=page.locator(game==='mtg'?'#dbTerm':'[data-input="tQ"]');await field.fill('Keep my search');
   const original=await inventorySnapshot(page),url=page.url();
   await page.evaluate(()=>window.__settingsBackground=document.querySelector('#content').firstElementChild);
   await page.locator('[data-act="menu"]').click();
   assert(await page.locator('#settingsDialog').evaluate(n=>n.matches(':modal')));
   assert.equal(page.url(),url);assert.equal(await page.locator('#settingsDialog [data-act="setGame"]').count(),0);
   assert.deepEqual(await page.locator('.settings-tabs [role=tab] > span:nth-child(2)').allTextContents(),['Profile & account','Appearance & behavior','Backup & downloads','About & help']);
   // Deterministic real-control regression: a rail scroll between trusted mouse
   // down/up must not be mistaken for a card drag. No click retry or dispatch.
   await page.setViewportSize({width:320,height:900});await page.locator('#settingsTab-app').click();
   assert(await page.locator('.settings-tabs').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'All four tabs fit in the mobile grid');
   await page.locator('#settingsDialog').evaluate(async n=>{n.scrollTop=0;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   const account=page.locator('#settingsTab-account'),accountBox=await account.boundingBox();assert(accountBox&&accountBox.width>0);
   const traceStart=await page.evaluate(game=>{window.__settingsTraceStep={game,width:320,tab:'account',probe:'non-card-dialog-scroll'};return window.__settingsInteractionTrace.length;},game);
   await page.mouse.move(accountBox.x+accountBox.width/2,accountBox.y+accountBox.height/2);await page.mouse.down();
   try{await page.locator('#settingsDialog').evaluate(async n=>{n.scrollTop=8;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});assert.equal(await page.locator('#settingsDialog').evaluate(n=>n.scrollTop),8);}finally{await page.mouse.up();}
   assert.equal(await page.locator('.settings-pane:not([hidden])').getAttribute('id'),'settings-account','one actual Account click survives an intervening dialog scroll');
   assert.equal(await page.locator('.settings-tabs [aria-selected="true"]').getAttribute('id'),'settingsTab-account');assert.equal(await page.locator('.settings-tabs [tabindex="0"]').getAttribute('id'),'settingsTab-account');
   const gesture=await page.evaluate(start=>window.__settingsInteractionTrace.slice(start),traceStart),down=gesture.findIndex(e=>e.type==='pointerdown-capture'),scroll=gesture.findIndex(e=>e.type==='scroll-capture'&&e.scrollTop===8),up=gesture.findIndex(e=>e.type==='pointerup-capture');
   assert(down>=0&&scroll>down&&up>scroll,'actual dialog scroll occurs within the one pointer gesture');
   for(const type of ['pointerdown-capture','pointerup-capture','click-capture','click-bubble']){const events=gesture.filter(e=>e.type===type);assert.equal(events.length,1,type+' occurs once');assert.equal(events[0].target,'settingsTab-account');assert.equal(events[0].trusted,true);}
   gestureChecks.push({game,viewport:320,trace:gesture});assert.equal(await inventorySnapshot(page),original);await capture(page,`synthetic-search-settings-${game}-rail-scroll-single-click`);
   for(const theme of ['dark','light']) {
   await page.locator('#settingsTab-app').click();await page.locator('#settingsTheme-'+theme).check();
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   assert.equal(await page.evaluate(()=>localStorage.getItem('cardstashy-theme')||'dark'),theme);
   assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),theme==='light'?'#f3f5f8':'#0f1115');
   // The setting does not flatten artwork or require glass to be switched off.
   for(const glass of [true,false]) {
    await page.locator('[data-change="setGlass"]').setChecked(glass);
    assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('glass')),glass);
    await noOverflow(page,'#settingsDialog',`${game} ${theme} glass=${glass}`);
   }
   for(const width of [320,390,768,1024,1440,390]){
    await page.setViewportSize({width,height:900});
    for(const tab of ['account','recovery','info','app']){
     await page.evaluate(step=>{window.__settingsTraceStep=step;},{game,theme,width,tab});
     await page.locator('#settingsTab-'+tab).click();
     assert.equal(await page.locator('.settings-pane:not([hidden])').getAttribute('id'),'settings-'+tab);
     assert.equal(await page.locator('.settings-tabs [tabindex="0"]').getAttribute('id'),'settingsTab-'+tab);
     assert.equal(await page.locator('.settings-tabs [aria-selected="true"]').count(),1);
     await noOverflow(page,'#settingsDialog',`${game} ${tab} ${width}`);
    }
    if([390,768].includes(width))await capture(page,`synthetic-search-settings-${game}-${theme}-${width}`);
    const rail=await page.locator('.settings-tabs').evaluate(n=>({scroll:n.scrollWidth,client:n.clientWidth,overflow:getComputedStyle(n).overflowX}));
    assert.equal(rail.overflow,'auto');if(width===320)assert(rail.scroll<=rail.client+1,'all four labels fit the mobile grid without a hidden rail');
   }
   assert.equal(await inventorySnapshot(page),original,'appearance leaves all games and saved quantities unchanged');
   }
   await page.locator('#settingsTab-account').click();await page.locator('#settings-account [data-act="settingsTab"][data-id="recovery"]').click();await noOverflow(page,'#settingsDialog',game+' recovery');
   await page.locator('#settingsTab-app').focus();await page.keyboard.press('Home');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-account');
   await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-app');
   await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-info');
   await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-account');
   await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-info');
   await page.locator('#settingsTab-info').click();assert(await page.locator('.settings-tour[data-act="replayTour"]').isVisible());
   await page.locator('#infoQuery').fill('scan');assert(await page.locator('#info-scan').isVisible());
   await page.locator('#settingsTab-app').click();assert(await page.locator('[data-act="resetOnboarding"]').isVisible());
   await page.locator('#settingsTheme-light').check();
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#settingsDialog').open);
   assert.equal(await field.inputValue(),'Keep my search');assert(await page.evaluate(()=>window.__settingsBackground===document.querySelector('#content').firstElementChild));
   await page.locator('[data-act="menu"]').click();await page.goBack();await page.waitForFunction(()=>!document.querySelector('#settingsDialog').open);
   assert.equal(page.url(),url);assert.equal(await inventorySnapshot(page),original);assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.game),game);
   // Inspect the underlying all-game search and actual card sheet in light mode.
   await field.fill('Alpha');await field.press('Enter');
   await page.waitForFunction(g=>{const u=g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search;return !u.busy&&u.results.length>0;},game);
   if(game==='ptcg')await page.waitForFunction(()=>!window.__uiTestTcg.ui('ptcg').search.detailsBusy);
   await page.locator('#content .card-grid > .grid-card').first().waitFor();
   await capture(page,`synthetic-search-theme-light-${game}-search-390`);
   await page.locator('#content .card-grid > .grid-card').first().click();await page.locator('#sheet[open] .cs-title').waitFor();
   // Actual card layout with intentionally long synthetic names and pinned,
   // unchanged public art. The art substitution is visual stress, not identity evidence.
   const longTitle=await page.locator('.cs-title h2').textContent();assert(longTitle.length>65,'long title reaches the production renderer');
   const heroImages=await page.locator('.cs-banner .cs-hero img').evaluateAll(nodes=>nodes.map(n=>n.currentSrc||n.src));
   const cardImages=await page.locator('.cs-card .card-img').evaluateAll(nodes=>nodes.map(n=>n.currentSrc||n.src));
   for(const [sampleIndex,sample] of samples[game].entries()) {
    const ambientURL=server.base+`/theme-ambient-${game}-${sampleIndex}.jpg`;
    await page.route(ambientURL,route=>route.fulfill({contentType:sample.type,body:sample.bytes}));
    const urls=[...new Set([...heroImages,...cardImages])].map(src=>{const u=new URL(src);u.searchParams.set('theme-art',String(sampleIndex));return u.href;});
    for(const src of urls)await page.route(src,async route=>{await route.fulfill({contentType:sample.type,body:sample.bytes});artHits.add(route.request().url());});
    await page.evaluate(({urls,ambientURL,game})=>{
     const nodes=[...document.querySelectorAll('.cs-banner .cs-hero img,.cs-card .card-img')];for(const img of nodes){const u=new URL(img.currentSrc||img.src);const target=urls.find(s=>{const v=new URL(s);v.searchParams.delete('theme-art');return v.href===u.href;})||urls[0];img.src=target;}
     localStorage.setItem('cardstashy-ambient-v1',JSON.stringify({[game]:ambientURL}));
    },{urls,ambientURL,game});
    for(const width of [320,390,768,1440]) for(const glass of [true,false]) {
     await page.setViewportSize({width,height:1000});
     // Use the real setting so saved daily art and the actual glass class update.
     await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#sheet').open);
     await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-app').click();
     await page.locator('[data-change="setGlass"]').setChecked(!glass);await page.locator('[data-change="setGlass"]').setChecked(glass);
     await page.locator('[data-act="closeSettings"]').click();
     await page.locator('#content .card-grid > .grid-card').first().click();await page.locator('#sheet[open] .cs-title').waitFor();
     await page.waitForFunction(()=>!window.__uiTestState.ui.sheetCtx?.previewBusy);
     await page.evaluate(urls=>{for(const img of document.querySelectorAll('.cs-banner .cs-hero img,.cs-card .card-img')){const src=img.currentSrc||img.src;const target=urls.find(s=>{const u=new URL(s);u.searchParams.delete('theme-art');return u.href===src;})||urls[0];img.src=target;}},urls);
     await page.locator('#sheetBody').evaluate(n=>n.scrollTop=0);
     await page.waitForFunction(()=>[...document.querySelectorAll('.cs-banner .cs-hero img')].every(img=>img.complete&&img.naturalWidth>0));
     await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},ambientURL);
     await noOverflow(page,'#sheetBody',`${game} light ${sample.label} glass=${glass} ${width}`);
     const header=await readHeader(page);
     headerChecks.push({game,width,glass,sample:sample.label,source:sample.source,file:sample.file,sha256:sample.sha256,...header});
     assert(artHits.has(header.image.src),'header displays the exact intercepted public artwork');
     assert.deepEqual(header.geometry,header.dark.geometry,'Light changes no title/hero/card geometry, foil or art masks');assert.equal(header.dark.backing,'none','Dark stays unchanged');
     assert.equal(header.backing.content,'""');assert.equal(header.backing.pointerEvents,'none');assert.equal(header.backing.radius,'0px');
     assert(header.geometry.title.y>=header.banner.y-.5&&header.geometry.title.y+header.geometry.title.height<=header.banner.y+header.banner.height+.5,'the complete long-title block fits inside the visible banner');
     assert(header.lastLine.reachable,'the final text line is visible and not covered: '+JSON.stringify(header.lastLine));
     assert.equal(header.backing.top,-80);assert.equal(header.backing.bottom,0);assert(Math.abs(header.backing.width-header.banner.width)<1,'fade spans the complete banner, not a rounded title box');
     assert.match(header.backing.image,/linear-gradient/);assert.match(header.backing.image,/0\.92/);assert.equal(header.backing.color,'rgba(0, 0, 0, 0)');
     const worst=[243,245,248].map(v=>v*.92);
     for(const ink of header.ink){assert(contrast(rgb(ink.color),worst)>=4.5,`${game} ${width} ${ink.tag} AA on pure-black art`);assert.equal(ink.shadow,'none');assert(ink.top>=header.geometry.title.y&&ink.bottom<=header.geometry.title.y+header.geometry.title.height-18+.5,'every title line stays inside the opaque part of the soft fade');}
     for(const badge of header.owned)assert(contrast(rgb(badge.ink),rgb(badge.background))>=4.5,'owned badge remains readable');
     assert.equal(header.ambient.display,glass?'block':'none');assert.equal(header.ambient.source,ambientURL);
     if(glass){assert.match(header.sheet.art,/theme-ambient/);assert.equal(header.sheet.artPointer,'none');assert.equal(header.sheet.wash,'rgba(246, 249, 253, 0.78)');assert.equal(header.sheet.washPointer,'none');assert.match(header.ambient.background,/theme-ambient/);assert.equal(header.ambient.opacity,.8);assert.equal(header.sheet.color,'rgba(246, 249, 253, 0.78)');assert.notEqual(header.sheet.blur,'none');assert.equal(header.panel.opacity,1,'glass changes background alpha, never text opacity');assert(rgb(header.panel.color)[3]<.7,'body panel remains transparent');}
     else{assert.equal(rgb(header.sheet.color)[3]??1,1,'solid mode is opaque');assert.equal(header.sheet.blur,'none');}
     assert.equal(header.motion,'none','reduced motion disables banner animation');if(glass)assert.equal(header.ambient.transition,'0s','reduced motion disables ambient transitions');
     if(width!==320||sampleIndex===0)await capture(page,`synthetic-search-theme-light-${game}-${sample.label}-${glass?'glass':'solid'}-${width}`);
     if([390,1440].includes(width)&&sampleIndex===0){await page.evaluate(async()=>(await import('/settings-theme.js')).applyTheme('dark',{persist:false}));await capture(page,`synthetic-search-theme-dark-${game}-${glass?'glass':'solid'}-${width}`);await page.evaluate(async()=>(await import('/settings-theme.js')).applyTheme('light',{persist:false}));}
     if(width===390&&(sampleIndex===0||game==='ptcg')){const pixels=await ambientDifference(page);headerChecks.push({game,glass,pixels});if(glass)assert(pixels.meanDifference>=1&&pixels.changedFraction>=.05,'real daily-card art measurably shows through lower content: '+JSON.stringify(pixels));else assert(pixels.meanDifference<.01,'solid mode blocks the ambient layer');}
    }
   }
   // OS reduced transparency must win over the user's enabled glass setting.
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#sheet').open);
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-app').click();await page.locator('[data-change="setGlass"]').setChecked(true);await page.locator('[data-act="closeSettings"]').click();
   await page.locator('#content .card-grid > .grid-card').first().click();await page.locator('#sheet[open] .cs-title').waitFor();
   const media=await app.context.newCDPSession(page);await media.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
   const reduced=await page.evaluate(()=>({matches:matchMedia('(prefers-reduced-transparency: reduce)').matches,ambient:getComputedStyle(document.querySelector('#ambient')).display,color:getComputedStyle(document.querySelector('#sheet')).backgroundColor,blur:getComputedStyle(document.querySelector('#sheet')).backdropFilter}));
   assert(reduced.matches);assert.equal(reduced.ambient,'none');assert.equal(reduced.blur,'none');assert.equal(rgb(reduced.color)[3]??1,1);headerChecks.push({game,reducedTransparency:reduced});
   await page.setViewportSize({width:390,height:1000});await capture(page,`synthetic-search-theme-light-${game}-reduced-transparency-390`);
   await media.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'no-preference'}]});await media.detach();
   await app.context.setOffline(true);await page.setViewportSize({width:390,height:1000});
   await page.locator('#sheetBody').evaluate(n=>n.scrollTop=n.scrollHeight);await page.locator('#sheetBody').evaluate(n=>n.scrollTop=0);await noOverflow(page,'#sheetBody',game+' cached offline card');
   assert(await page.locator('.cs-title h2').isVisible());await capture(page,`synthetic-search-theme-light-${game}-cached-offline-390`);await app.context.setOffline(false);
   assert.deepEqual(await page.evaluate(()=>window.__fixtureSensitiveWrites),[],'theme/art inspection never persists inventory or private values');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#sheet').open);assert.equal(await inventorySnapshot(page),original,'light-mode card inspection does not change saved lots');
   await page.setViewportSize({width:390,height:900});
   await page.reload();await page.locator('#app.ready').waitFor();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'light','theme survives reload');
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-app').click();assert(await page.locator('#settingsTheme-light').isChecked());
   await page.locator('#settingsTheme-dark').check();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.locator('[data-act="closeSettings"]').click();
   app.health();console.log(`PASS: ${game} four Settings tabs, light/dark reload, glass parity, keyboard, Back, fold resize, draft and inventory preservation`);
  }catch(error){failureDiagnostics=await page.evaluate(()=>({step:window.__settingsTraceStep||null,trace:window.__settingsInteractionTrace||[]})).catch(()=>null);await capture(page,`synthetic-search-settings-${game}-failure`,{settle:false}).catch(()=>{});throw error;}finally{await app.context.close();}
 }
}catch(error){failure=String(error.stack||error);throw error;}finally{const out=new URL('../test-results/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('synthetic-search-settings-theme-evidence.json',out),JSON.stringify({status:failure?'failed':'passed',evidence,headerChecks,gestureChecks,...(failure?{error:failure,diagnostics:failureDiagnostics}:{})},null,2));await browser.close();await server.close();}
