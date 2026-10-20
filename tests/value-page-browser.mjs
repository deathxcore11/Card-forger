// Hosted actual-app Value QA. Synthetic ownership/values only; pinned source art
// is layout evidence, not identity/price verification or live provider proof.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {startServer,openApp,closeSheet,capture,noOverflow,makeFixtures,CARDS} from './detail-rules-fixtures.mjs';
import {valueBrowserFixture} from './value-page-fixtures.mjs';
const GAMES=['mtg','ptcg','ygo'], WIDTHS=[320,390,768,1440];
const EVIDENCE='Isolated local app fixtures. Holdings and manual values are synthetic. Priced-layout screenshots use pinned publisher-provided card pictures from tests/frame-art as visual-fit samples only, reused across fixture cards. Other UI imagery uses the base harness synthetic SVG fixtures. Neither proves those fixture identities, current provider availability or prices. No physical phone or real account was used.';
async function saveValueReport(checks,error){
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
 await writeFile(new URL('../test-results/value-page-browser.json',import.meta.url),JSON.stringify({generatedAt:new Date().toISOString(),artEvidence:EVIDENCE,status:error?'failed':'passed',checks,...(error?{error:String(error.stack||error)}:{})},null,2));
}
for(const game of GAMES){const base=makeFixtures(game),side=game==='mtg'?base.state:base.state.tcg[game],f=valueBrowserFixture(game,{cards:CARDS[game],collection:side.collection});assert.equal(f.collection.reduce((sum,e)=>sum+e.qty,0),7);assert.equal(Math.round(f.collection.reduce((sum,e)=>sum+e.qty*e.manualValue,0)*100)/100,19.43);assert.equal(f.collection.length,5);assert.equal(f.expected.groups.length,4);assert(!Object.hasOwn(f.unpriced,'manualValue'));}
if(process.argv.includes('--validate-fixtures')){console.log('PASS: all-game actual-app Value fixture identities, exact duplicate lots, synthetic manual values, four composition groups and hosted-only source-art contract. No browser/server/network started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Value browser QA is hosted-only; use --validate-fixtures locally.');
const {chromium}=await import('playwright');
const sources=JSON.parse(await readFile(new URL('./frame-art/sources.json',import.meta.url)));
const art=Object.fromEntries(await Promise.all(GAMES.map(async game=>[game,{url:sources[game][0],type:game==='ptcg'?'image/webp':'image/jpeg',bytes:await readFile(new URL('./frame-art/'+game+'.'+sources[game][1],import.meta.url))}])));
const server=await startServer(),browser=await chromium.launch(),report=[];
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const snapshot=page=>page.evaluate(()=>JSON.stringify({collection:window.__uiTestState.state.collection,tcg:window.__uiTestState.state.tcg,valueHistory:window.__uiTestState.state.valueHistory,decks:window.__uiTestState.state.decks,manual:window.__uiTestState.state.myPrices}));
const todaySnapshot=(page,game)=>page.evaluate(g=>{const S=window.__uiTestState,side=g==='mtg'?S.state:S.state.tcg[g];return side.valueHistory.find(p=>p.date===new Date().toISOString().slice(0,10));},game);
async function seedObservation(page,game){await page.evaluate(async game=>{
 const S=window.__uiTestState,T=window.__uiTestTcg,side=game==='mtg'?S.state:S.state.tcg[game];
 const {recordValueObservation}=await import('/value-history.js'),{collectionValue}=await import('/insights.js'),{useMyPrices}=await import('/mtg-tcgprice.js');
 useMyPrices(S.state.myPrices);const value=game==='mtg'?collectionValue(side.collection,S.catalog,S.state.printings,[]):T.collectionValue(game,S.state);
 side.valueHistory=recordValueObservation(side.valueHistory,value.total,value.copies,{unpriced:value.unpriced,currency:'USD',basis:'exact-owned-v1'});
 },game);}
async function render(page){const before=await snapshot(page);await page.evaluate(()=>dispatchEvent(new Event('cardstashy-rerender')));await frames(page);await page.locator('.collection-value-page').waitFor();assert.equal(await snapshot(page),before,'render never creates device-cache observations or sync edits');}
async function waitCurrent(page,game,copies,unpriced,total){await page.waitForFunction(({game,copies,unpriced,total})=>{const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game],point=side.valueHistory.find(p=>p.date===new Date().toISOString().slice(0,10));return point&&point.copies===copies&&point.unpriced===unpriced&&point.total===total;},{game,copies,unpriced,total});await frames(page);}
async function seed(page,game,artUrl){
 // Test-only .mjs files are intentionally not browser modules on the fixture
 // server. Build the fixture in Node, then inject only serialized local data.
 const source=await page.evaluate(async game=>{
  const S=window.__uiTestState,T=window.__uiTestTcg,{cardKey}=await import('/core.js'),side=game==='mtg'?S.state:S.state.tcg[game];
  return {cards:side.collection.map(entry=>game==='mtg'?S.state.printings[entry.printingId]||S.catalog[cardKey(entry.name)]:T.cardOf(game,entry.cardId)),collection:side.collection,today:new Date().toISOString().slice(0,10)};
 },game);
 assert(source.cards.slice(0,4).every(card=>card?.id),'Value seed requires four existing normalized fixture cards');
 const f=valueBrowserFixture(game,source,source.today);
 return page.evaluate(async({game,artUrl,f})=>{
 const S=window.__uiTestState,T=window.__uiTestTcg,{cardKey}=await import('/core.js'),side=game==='mtg'?S.state:S.state.tcg[game];
 for(const card of f.cards){
  if(game==='mtg'){card.image_uris={...card.image_uris,normal:artUrl,large:artUrl,small:artUrl};S.catalog[cardKey(card.name)]=card;S.state.printings[card.id]=card;}
  else{card.image=artUrl;card.imageLarge=artUrl;card.fetchedAt=new Date().toISOString();T.cache[game][card.id]=card;}
 }
 side.collection=f.collection;side.valueHistory=f.history;
 localStorage.setItem('cardstashy-meta-trend-v1',JSON.stringify({[game]:[{at:Date.now(),pct:{}}]}));
 window.__valueFixture={...structuredClone(f),game};
 return f.expected;
},{game,artUrl,f});}
async function layout(page,label){await noOverflow(page,'#content',label,true);return page.evaluate(()=>{
 const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};},page=document.querySelector('.collection-value-page'),chart=page.querySelector('.value-chart > svg[role="img"]'),amount=page.querySelector('[data-value-amount]'),refresh=page.querySelector('[data-value-refresh]');
 return {viewport:innerWidth,root:box(page),chart:box(chart),amount:box(amount),refresh:box(refresh),groups:[...page.querySelectorAll('[data-value-group]')].map(n=>({key:n.dataset.valueGroup,text:n.textContent,box:box(n)})),lots:[...page.querySelectorAll('.value-lot')].map(n=>{const img=n.querySelector('img'),css=img&&getComputedStyle(img),buttonCSS=getComputedStyle(n);return {entry:n.dataset.entry,text:n.innerText,box:box(n),buttonStyle:{appearance:buttonCSS.appearance,background:buttonCSS.backgroundColor,borderLeft:buttonCSS.borderLeftStyle,borderRight:buttonCSS.borderRightStyle},image:img?{complete:img.complete,naturalWidth:img.naturalWidth,src:img.currentSrc,fit:css.objectFit,...box(img)}:null};})};
 });}
async function trendRegression(page,game){
 const checks=[];
 for(const [direction,totals,text] of [['down',[.04,.04,.04,0],'↓ −$0.04'],['up',[0,0,.02,.04],'↑ +$0.04'],['flat',[0,0,0,0],'↔ $0.00']]){
  // Only this isolated synthetic fixture is changed. The current collection
  // agrees with the last observation; down/flat reproduce zero owned copies.
  await page.evaluate(({game,totals})=>{
   const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game],current=totals.at(-1),today=new Date().toISOString().slice(0,10),day=Date.parse(today+'T00:00:00Z');
   side.collection=current?[{...structuredClone(window.__valueFixture.collection.at(-1)),qty:1,manualValue:current,condition:'Near Mint',manualValueCondition:'Near Mint'}]:[];
   side.valueHistory=totals.map((total,i)=>({date:new Date(day-(3-i)*86400000).toISOString().slice(0,10),total,copies:total>0?1:0,unpriced:0,currency:'USD',basis:'exact-owned-v1'}));
  },{game,totals});
  await render(page);const before=await snapshot(page);
  assert.equal(await page.locator('[data-value-amount]').innerText(),totals.at(-1)?'$0.04':'$0.00');
  assert.match(await page.locator('.value-overview').innerText(),totals.at(-1)?/1 copy\b/:/0 copies/);
  assert.match(await page.locator('.value-section-head').first().innerText(),/4 saved snapshots/);
  assert.equal(await page.locator('.value-chart-point.complete').count(),4);
  // Exercise the real decorator explicitly, including its repeated-call path.
  // A raw renderer string alone would miss the original down-arrow regression.
  const decorated=await page.evaluate(async game=>{
   const {decorateGlyphs}=await import('/icons.js'),root=document.querySelector('.collection-value-page');
   decorateGlyphs(root,game);const once=root.innerHTML;decorateGlyphs(root,game);return {stable:root.innerHTML===once};
  },game);assert(decorated.stable,'real icon decoration is idempotent');
  assert.equal(await page.locator(`.value-chart-change.${direction} strong.no-ic`).innerText(),text);
  assert.equal(await page.locator('.value-chart-change svg, .value-chart-change .gl').count(),0,'financial arrows never become download/action icons');
  for(const theme of ['dark','light']){
   await page.evaluate(async theme=>(await import('/settings-theme.js')).applyTheme(theme,{persist:false}),theme);
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:1000});await frames(page);const geometry=await layout(page,`${game} ${direction} ${theme} ${width}`);
    const trend=await page.locator('.value-chart-change').evaluate(n=>{const r=n.getBoundingClientRect(),strong=n.querySelector('strong'),s=strong.getBoundingClientRect();return {height:r.height,width:r.width,fontSize:parseFloat(getComputedStyle(strong).fontSize),labelHeight:s.height,labelWidth:s.width,text:n.innerText};});
    assert(trend.height<=56,`trend stays compact: ${JSON.stringify({game,direction,theme,width,trend})}`);
    assert(trend.labelHeight<=trend.fontSize*2,'trend label stays text-sized, not a giant replacement icon');
    assert(geometry.chart.width>200&&geometry.chart.height>50,'the actual chart retains its responsive size');
    assert(Math.abs(geometry.chart.width-trend.width)<2,'plot remains panel-wide independently of trend text');
    assert.equal(await snapshot(page),before,'decoration, theme and viewport changes preserve owned data and every recorded observation');
    checks.push({direction,theme,width,trend,chart:geometry.chart,trendSVGs:0,snapshots:4,ownedDataUnchanged:true});
    if(width!==390)await capture(page,`value-page-${game}-trend-${direction}-${theme}-${width}`);
   }
  }
 }
 await page.evaluate(async()=>(await import('/settings-theme.js')).applyTheme('dark',{persist:false}));
 await page.setViewportSize({width:390,height:1000});await frames(page);
 return checks;
}
async function subtotalRegression(page,game){
 const checks=[];
 async function setSubtotal(first,last,patch={}){
  await page.evaluate(({game,first,last,patch})=>{
   const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game],day=Date.parse(new Date().toISOString().slice(0,10)+'T00:00:00Z'),date=offset=>new Date(day-offset*86400000).toISOString().slice(0,10);
   const priced={...structuredClone(window.__valueFixture.collection[0]),qty:6,manualValue:last/6,condition:'Near Mint',manualValueCondition:'Near Mint',manualValueCurrency:'USD'},unknown={...structuredClone(window.__valueFixture.unpriced),qty:3};
   side.collection=[priced,unknown];
   const point=(date,total,extra={})=>({date,total,copies:9,unpriced:3,currency:'USD',basis:'exact-owned-v1',...extra});
   side.valueHistory=[point(date(3),first,{copies:4,unpriced:0}),point(date(2),first,{copies:6,unpriced:2}),point(date(0),last,patch)];
  },{game,first,last,patch});
  await render(page);
 }
 for(const [kind,first,last,direction,text] of [['up',8.34,9.44,'up','↑ +$1.10'],['down',9.44,8.34,'down','↓ −$1.10'],['flat',0,0,'flat','↔ $0.00'],['zero-start',0,2,'up','↑ +$2.00'],['zero-end',2,0,'down','↓ −$2.00']]){
  await setSubtotal(first,last);const before=await snapshot(page);
  assert.equal(await page.locator('.value-chart-line').count(),2,'heterogeneous complete→partial→partial records form one recorded-amount timeline');
  assert.equal(await page.locator('.value-chart-line[data-value-series="partial"]').count(),2);
  for(const title of await page.locator('.value-chart-line title').allTextContents())assert.match(title,/subtotal included/);
  assert.equal(await page.locator('.value-chart-point.partial').count(),2);assert.equal(await page.locator('.value-chart-point.complete').count(),1);
  assert.equal(await page.locator('[data-value-coverage]').innerText(),'Known subtotal · USD');
  assert.equal(await page.locator('.value-chart-change span').innerText(),'Change in recorded value');
  const titles=await page.locator('.value-chart-point title').allTextContents(),period=await page.locator('[data-value-period]').innerText();
  for(const title of [titles[0],titles.at(-1)])assert(period.includes(title.split(' · ')[0]),'badge dates are the actual saved endpoints');
  assert(period.includes('$'+first.toFixed(2))&&period.includes('$'+last.toFixed(2)),'badge amounts are the actual saved endpoints');
  assert.match(await page.locator('.value-chart .value-chart-note').innerText(),/newly priced copies, collection quantities and custom values/);
  assert.match(await page.locator('.value-chart .value-chart-note').innerText(),/not market-only returns/);
  assert.match(await page.locator('.value-chart-legend').innerText(),/Dashed: subtotal included/);
  const rowText=await page.locator('.value-history-details').textContent();for(const coverage of ['4 copies total · 4 priced · 0 unpriced','6 copies total · 4 priced · 2 unpriced','9 copies total · 6 priced · 3 unpriced'])assert(rowText.includes(coverage));
  const decoration=await page.evaluate(async game=>{const {decorateGlyphs}=await import('/icons.js'),root=document.querySelector('.collection-value-page');decorateGlyphs(root,game);const once=root.innerHTML;decorateGlyphs(root,game);return root.innerHTML===once;},game);assert(decoration);
  assert.equal(await page.locator(`.value-chart-change.${direction} strong.no-ic`).innerText(),text);assert.equal(await page.locator('.value-chart-change svg, .value-chart-change .gl').count(),0);
  if(kind==='up')for(const theme of ['dark','light']){
   await page.evaluate(async theme=>(await import('/settings-theme.js')).applyTheme(theme,{persist:false}),theme);
   for(const width of WIDTHS){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));await frames(page);const geometry=await layout(page,`${game} recorded subtotal ${theme} ${width}`);
    const trend=await page.locator('.value-chart-change').boundingBox();assert(trend.height<=56,'recorded-value change remains compact');
    assert((await page.locator('[data-value-period]').boundingBox()).height<=70,'saved endpoint amount/date line wraps without excessive height');
    const dashed=await page.locator('.value-chart-line').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).strokeDasharray));assert(dashed.every(value=>value!=='none'&&value.includes('6')),'both incomplete segments are visibly dashed');
    assert.equal(await snapshot(page),before,'render/theme/resize preserves every owned lot and saved value');
    await capture(page,`value-page-${game}-subtotal-${theme}-${width}`);checks.push({kind,theme,width,geometry,segments:2,dashed,partialPoints:2,changeText:text,period,ownedDataUnchanged:true,scrollReset:true});
   }
  }
  assert.equal(await snapshot(page),before);checks.push({kind,direction,text,segments:2,ownedDataUnchanged:true});
 }
 await page.evaluate(async()=>(await import('/settings-theme.js')).applyTheme('dark',{persist:false}));await page.setViewportSize({width:390,height:1000});await frames(page);
 for(const [kind,patch] of [['changed-copies',{copies:7}],['same-priced-count-different-coverage',{copies:7,unpriced:3}],['matching-counts',{copies:6,unpriced:2}],['changed-unpriced',{unpriced:1}],['complete-transition',{unpriced:0}]]){
  await setSubtotal(8.34,9.44,patch);const before=await snapshot(page);
  assert.equal(await page.locator('.value-chart-line[data-value-series="partial"]').count(),2,kind);assert.equal(await page.locator('.value-chart-change').count(),1,kind);assert.equal(await page.locator('.value-chart-change span').innerText(),'Change in recorded value');assert.doesNotMatch(await page.locator('.value-chart-change strong').innerText(),/%/);
  await layout(page,`${game} ${kind}`);assert.equal(await snapshot(page),before);checks.push({kind,segments:2,changeVisible:true});
 }
 await setSubtotal(8.34,9.44);await page.evaluate(game=>(game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game]).valueHistory.forEach(p=>p.unpriced=0),game);await render(page);assert.equal(await page.locator('.value-chart-line[data-value-series="complete"]').count(),2);assert((await page.locator('.value-chart-line').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).strokeDasharray))).every(value=>value==='none'));assert.doesNotMatch(await page.locator('.value-chart-change strong').innerText(),/%/,'changed fully priced quantities do not produce a misleading percentage');checks.push({kind:'fully-priced-changed-quantity',solidSegments:2});
 for(const [kind,patch] of [['all-unpriced',{unpriced:9}],['foreign-currency',{currency:'EUR'}],['other-basis',{basis:'other'}],['legacy',{currency:null,basis:null}]]){
  await setSubtotal(8.34,9.44,patch);const before=await snapshot(page);
  assert.equal(await page.locator('.value-chart-line').count(),1,kind);assert.equal(await page.locator('.value-chart-change').count(),0,kind);
  await layout(page,`${game} ${kind}`);assert.equal(await snapshot(page),before);checks.push({kind,segments:1,changeHidden:true});
 }
 // A valid-date unavailable middle observation remains a true barrier. Earlier
 // links stay visible, but cannot supply a badge when the latest run is one point.
 await setSubtotal(8.34,9.44);await page.evaluate(game=>{const side=game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game],last=side.valueHistory.at(-1),date=new Date(Date.parse(last.date)-86400000).toISOString().slice(0,10);side.valueHistory.splice(2,0,{...last,date,total:0,unpriced:last.copies});},game);await render(page);
 assert.equal(await page.locator('.value-chart-line').count(),1);assert.equal(await page.locator('.value-chart-change').count(),0);assert.equal(await page.locator('.value-chart-gap').count(),1);checks.push({kind:'unavailable-middle-barrier',segments:1,changeHidden:true});
 // Current fully priced quotes may be newer than saved partial observations.
 // Render never inserts them or calculates movement against that unsaved amount.
 await setSubtotal(8.34,9.44);await page.evaluate(game=>{const side=game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game],entry={...side.collection[0],qty:9,manualValue:12.34/9};side.collection=[entry];},game);await render(page);const unsaved=await snapshot(page);
 assert.equal(await page.locator('[data-value-amount]').innerText(),'$12.34');assert.equal(await page.locator('[data-value-coverage]').innerText(),'Estimated value · USD');assert.match(await page.locator('[data-value-saved-note]').innerText(),/Latest saved subtotal: \$9\.44/);assert.match(await page.locator('[data-value-period]').innerText(),/Saved \$8\.34 on .+ to \$9\.44 on/);assert.equal(await page.locator('.value-chart-change strong').innerText(),'↑ +$1.10');assert.equal(await snapshot(page),unsaved);
 await page.evaluate(()=>scrollTo(0,0));await frames(page);await capture(page,`value-page-${game}-newer-current-complete`);checks.push({kind:'newer-current-complete',current:'$12.34',saved:'$9.44',change:'+$1.10',historyUnchanged:true});
 await page.evaluate(game=>(game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game]).collection[0].manualValue=9.44/9,game);await render(page);const equal=await snapshot(page);assert.equal(await page.locator('[data-value-saved-note]').count(),0);assert.equal(await page.locator('.value-chart-point.partial').count(),2);assert.equal(await page.locator('.value-chart-change strong').innerText(),'↑ +$1.10');assert.equal(await snapshot(page),equal,'equal amount with new complete coverage does not rewrite saved partial coverage');
 await seedObservation(page,game);await render(page);await waitCurrent(page,game,9,0,9.44);assert.equal(await page.locator('.value-chart-line[data-value-series="partial"]').count(),2,'a newly recorded complete endpoint still connects to the preceding partial');assert.equal(await page.locator('.value-chart-point.complete').count(),2);assert.equal(await page.locator('.value-chart-change span').innerText(),'Change in recorded value');
 // Half-cent custom values exercise the unchanged real resolver and recorder.
 await page.evaluate(game=>{const side=game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game],entry={...structuredClone(window.__valueFixture.collection[0]),qty:1,manualValue:19.435,condition:'Near Mint',manualValueCondition:'Near Mint',manualValueCurrency:'USD'};side.collection=[entry];side.valueHistory=[];},game);await seedObservation(page,game);await render(page);await waitCurrent(page,game,1,0,19.44);
 assert.equal(await page.locator('[data-value-amount]').innerText(),'$19.44');assert.equal(await page.locator('[data-value-range]').innerText(),'Plotted values: $19.44');assert.equal(await page.locator('[data-value-saved-note]').count(),0);
 await page.evaluate(game=>(game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game]).valueHistory[0].total=19.43,game);await render(page);const oldSaved=await snapshot(page);
 assert.match(await page.locator('[data-value-saved-note]').innerText(),/Latest saved value: \$19\.43 on .+ \(UTC\)/);assert.equal(await page.locator('[data-value-amount]').innerText(),'$19.44');assert.equal(await page.locator('[data-value-range]').innerText(),'Plotted values: $19.43');assert.equal(await snapshot(page),oldSaved,'old cents are explained, never silently rewritten');
 await page.evaluate(()=>scrollTo(0,0));await frames(page);await capture(page,`value-page-${game}-saved-rounding-notice`);checks.push({kind:'half-cent-rounding',current:'$19.44',newSnapshot:'$19.44',oldSnapshotPreserved:'$19.43'});
 return checks;
}

try{
 for(const game of GAMES){
  let app;
  try{
   app=await openApp(browser,server.base,{game,width:390,isMobile:true});const {page}=app,artUrl=server.base+'/tests/value-page-art-'+game;
   await app.context.route(artUrl,route=>route.fulfill({status:200,contentType:art[game].type,body:art[game].bytes}));
   const expected=await seed(page,game,artUrl);await seedObservation(page,game);
   await page.locator(`#content [data-act="${game==='mtg'?'collTab':'tCollTab'}"][data-id="value"]`).first().click();
   await page.locator(`.collection-value-page[data-value-game="${game}"]`).waitFor();await waitCurrent(page,game,7,0,19.43);
   await page.waitForFunction(url=>[...document.querySelectorAll('.value-lot img')].every(img=>img.complete&&img.naturalWidth>300&&img.currentSrc===url),artUrl);
   assert.equal(await page.locator('[data-value-amount]').innerText(),'$19.43');assert.equal(await page.locator('[data-value-coverage]').innerText(),'Estimated value · USD');
   assert.equal(await page.locator('[data-value-range]').innerText(),'Plotted values: $2.50 to $19.43');assert.equal(await page.locator('.value-lot').count(),5);assert.equal(await page.locator('[data-value-refresh]').getAttribute('data-act'),game==='mtg'?'refreshPrices':'tRefreshPrices');
   assert.deepEqual(await page.locator('[data-value-group]').evaluateAll(ns=>ns.map(n=>n.dataset.valueGroup)),expected.groups);
   assert.match(await page.locator('.value-chart').innerText(),/Legacy/);assert.match(await page.locator('.value-chart').innerText(),/Known subtotal/);assert.match(await page.locator('.value-chart').innerText(),/Unavailable/);assert.doesNotMatch(await page.locator('.value-chart').innerText(),/2099|\$999/);
   assert.match(await page.locator('.value-chart-change').innerText(),/\+\$6\.98/);assert.equal(await page.locator('.value-chart-line').count(),2,'supported subtotal connects while unavailable and legacy remain barriers');
   assert.match(await page.locator('#content').innerText(),/Price alerts/);assert.equal(await page.locator('details.advice').count(),1,'existing advice is retained');if(game==='mtg')assert.match(await page.locator('#content').innerText(),/Trade binder/);
   const immutable=await snapshot(page),geometries=[];
   for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await frames(page);const measured=await layout(page,`${game} Value ${width}`);assert(measured.refresh.height>=44);assert(await page.locator('[data-value-range]').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=12),'HTML chart values stay readable without SVG scaling');assert(measured.chart.height>50&&measured.chart.width>200,'graph remains visibly drawn');for(const lot of measured.lots){assert(lot.box.height>=44,'touch row height');assert.deepEqual(lot.buttonStyle,{appearance:'none',background:'rgba(0, 0, 0, 0)',borderLeft:'none',borderRight:'none'},'art rows keep intentional transparent glass-panel styling, not native gray button chrome');assert(lot.image?.complete&&lot.image.naturalWidth>300,'pinned art loaded');assert(lot.image.width>=36&&lot.image.height>=50,'full-card illustration remains visible');assert.equal(lot.image.fit,'contain');}geometries.push(measured);await capture(page,`value-page-${game}-${width}`);}
   assert.equal(await snapshot(page),immutable,'resizing/render-only work preserves owned data and observations');
   await page.setViewportSize({width:390,height:1000});await frames(page);
   // Open the duplicate lot, not merely another lot with the same card/name.
   const selected=page.locator(`.value-lot[data-entry="${expected.selectedId}"]`);await selected.scrollIntoViewIfNeeded();await selected.focus();await selected.press('Enter');
   await page.waitForFunction(({game,expected})=>{const S=window.__uiTestState,ctx=S.ui.sheetCtx;return document.querySelector('#sheet')?.open&&ctx?.entryId===expected.selectedId&&(game==='mtg'?ctx.name===expected.name:ctx.id===expected.cardId);},{game,expected});
   assert.equal(await page.locator('#sheet .cs-title h2').innerText(),expected.name);await closeSheet(page);await page.locator('.value-lot').first().waitFor();assert.equal(await snapshot(page),immutable,'opening and closing exact lot does not change holdings/history');
   // Native recorded-values disclosure remains keyboard accessible.
   const summary=page.locator('.value-history-details summary');await summary.scrollIntoViewIfNeeded();await summary.focus();await summary.press('Enter');assert.equal(await page.locator('.value-history-details').getAttribute('open'),'');assert.equal(await page.locator('.value-history-details li').count(),6);await summary.press('Enter');
   report.push({game,phase:'priced-layout-and-actions',evidence:EVIDENCE,artSource:art[game].url,expected,geometries});
   // Missing coverage is a subtotal, then unknown, never a synthetic zero loss.
   await page.evaluate(game=>{const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game];side.collection.push(structuredClone(window.__valueFixture.unpriced));},game);await seedObservation(page,game);await render(page);await waitCurrent(page,game,8,1,19.43);
   assert.equal(await page.locator('[data-value-amount]').innerText(),'$19.43');assert.equal(await page.locator('[data-value-coverage]').innerText(),'Known subtotal · USD');assert.equal(await page.locator('.value-chart-change').count(),1);assert.match(await page.locator('.value-chart-change').innerText(),/Change in recorded value/);assert.match(await page.locator('.value-overview').innerText(),/1 copy without a price/);await layout(page,`${game} partial coverage`);await capture(page,`value-page-${game}-partial`);
   await page.evaluate(game=>{const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game];for(const e of side.collection){delete e.manualValue;delete e.manualValueCondition;delete e.manualValueCurrency;e.condition='Unknown condition';e.conditionQuotes=[];}},game);await seedObservation(page,game);await render(page);await waitCurrent(page,game,8,8,0);
   assert.equal(await page.locator('[data-value-amount]').innerText(),'—');assert.equal(await page.locator('[data-value-coverage]').innerText(),'Value unavailable');assert.equal(await page.locator('.value-chart-change').count(),0);assert.equal(await page.locator('.value-lot').count(),0);assert((await page.locator('.value-chart-gap').count())>=2);await layout(page,`${game} unavailable coverage`);await capture(page,`value-page-${game}-unavailable`);
   // A genuine user-entered zero remains $0.00, with singular copy wording.
   await page.evaluate(game=>{const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game],entry=structuredClone(window.__valueFixture.collection.at(-1));entry.qty=1;entry.manualValue=0;entry.condition='Near Mint';entry.manualValueCondition='Near Mint';side.collection=[entry];},game);await seedObservation(page,game);await render(page);await waitCurrent(page,game,1,0,0);
   assert.equal(await page.locator('[data-value-amount]').innerText(),'$0.00');assert.match(await page.locator('.value-overview').innerText(),/1 copy\b/);assert.equal(await page.locator('.value-lot').count(),1);await capture(page,`value-page-${game}-custom-zero`);
   await page.evaluate(game=>{const S=window.__uiTestState;(game==='mtg'?S.state:S.state.tcg[game]).collection=[];},game);await seedObservation(page,game);await render(page);await waitCurrent(page,game,0,0,0);
   assert.equal(await page.locator('.value-chart').count(),1);assert.equal(await page.locator('[data-value-amount]').innerText(),'$0.00');assert.match(await page.locator('.value-overview').innerText(),/0 copies/);assert.doesNotMatch(await page.locator('#content').innerText(),/No value to track yet/);await capture(page,`value-page-${game}-empty-history`);
   report.push({game,phase:'decorated-negative-positive-flat-trends',checks:await trendRegression(page,game)});
   report.push({game,phase:'shared-known-subtotal-parity',checks:await subtotalRegression(page,game)});
   // First-day display has exactly the recorded current observation, no backfill.
   await page.evaluate(game=>{const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game];side.collection=[structuredClone(window.__valueFixture.collection[1])];side.valueHistory=[];},game);await seedObservation(page,game);await render(page);await waitCurrent(page,game,1,0,12.34);
   assert.equal(await page.locator('.value-chart-point').count(),1);assert.equal(await page.locator('.value-chart-line').count(),0);assert.match(await page.locator('.value-chart').innerText(),/No earlier values have been estimated/);assert.equal((await todaySnapshot(page,game)).total,12.34);await capture(page,`value-page-${game}-first-day`);
   // 500 usable observations plus one bad-clock future point: visible window
   // remains bounded without deleting any real saved records or future input.
   const longBefore=await page.evaluate(game=>{const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game],point={total:12.34,copies:1,unpriced:0,currency:'USD',basis:'exact-owned-v1'};side.valueHistory=[...Array.from({length:499},(_,i)=>({...point,date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),total:i/10})),{...point,date:new Date().toISOString().slice(0,10)},{...point,date:'2099-01-01',total:999}];return JSON.stringify(side.valueHistory);},game);await render(page);await waitCurrent(page,game,1,0,12.34);
   assert.equal(await page.locator('.value-chart-point').count(),365);assert.equal(await page.locator('.value-history-details li').count(),365);assert.match(await page.locator('.value-chart').innerText(),/500 saved snapshots/);assert.match(await page.locator('.value-chart').innerText(),/latest 365 snapshots/);assert.doesNotMatch(await page.locator('.value-chart').innerText(),/2099|\$999/);
   assert.deepEqual(JSON.parse(await page.evaluate(game=>JSON.stringify((game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game]).valueHistory),game)),JSON.parse(longBefore),'every saved date, value and coverage field survives; current observation key order is not data loss');await layout(page,`${game} bounded history`);await capture(page,`value-page-${game}-bounded-history`);
   report.push({game,phase:'coverage-empty-first-and-bounded-history',partial:{copies:8,unpriced:1,total:19.43},allMissing:{copies:8,unpriced:8,shown:'—'},customZero:true,emptyRetained:true,firstDay:true,retainedRecords:501,visibleRecords:365});
   // Exercise the actual Refresh control. Only this exact Scryfall batch-read
   // endpoint is allowed a POST, and every requested ID must be in this isolated
   // fixture cache. The request is fulfilled here and never reaches a provider.
   const refreshReads=[],refreshErrors=[],requestStart=app.requests.length;
   const protectedBefore=await page.evaluate(()=>{const s=window.__uiTestState.state;return JSON.stringify({magic:s.collection,ptcg:s.tcg.ptcg.collection,ygo:s.tcg.ygo.collection,myPrices:s.myPrices});});
   if(game==='mtg'){
    const allowed=await page.evaluate(()=>structuredClone(window.__uiTestState.state.printings));
    await app.context.route(/^https:\/\/api\.scryfall\.com\/cards\/collection$/,async route=>{
     const request=route.request();let body;try{body=request.postDataJSON();}catch{}
     const identifiers=body?.identifiers,valid=request.method()==='POST'&&Array.isArray(identifiers)&&identifiers.length>0&&identifiers.length<=75&&identifiers.every(row=>row&&Object.keys(row).length===1&&typeof row.id==='string'&&Object.hasOwn(allowed,row.id));
     if(!valid){refreshErrors.push('Rejected non-fixture Scryfall batch read');return route.fulfill({status:403,json:{error:'Only exact fixture IDs may be read'}});}
     refreshReads.push(identifiers.map(row=>row.id));return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({data:identifiers.map(row=>allowed[row.id]),has_more:false,not_found:[]})});
    });
   }
   await page.evaluate(game=>{const S=window.__uiTestState,side=game==='mtg'?S.state:S.state.tcg[game];side.valueHistory=side.valueHistory.filter(p=>p.date!==new Date().toISOString().slice(0,10));},game);assert.equal(await todaySnapshot(page,game),undefined);
   await page.locator('[data-value-refresh]').click();
   await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Price data refreshed for 1 card.'));
   await page.waitForFunction(()=>{const n=document.querySelector('[data-value-refresh]');return n&&!n.disabled&&!n.textContent.includes('Refreshing');});await frames(page);
   await waitCurrent(page,game,1,0,12.34);assert.equal(await page.locator('[data-value-amount]').innerText(),'$12.34','refresh keeps the selected custom value');
   assert.equal(await page.evaluate(()=>{const s=window.__uiTestState.state;return JSON.stringify({magic:s.collection,ptcg:s.tcg.ptcg.collection,ygo:s.tcg.ygo.collection,myPrices:s.myPrices});}),protectedBefore,'actual refresh preserves owned lots and manual values');
   assert.deepEqual(refreshErrors,[]);if(game==='mtg')assert.equal(refreshReads.length,1);else assert(app.requests.slice(requestStart).some(request=>game==='ptcg'?request.includes('api.tcgdex.net/v2/en/cards/'):request.includes('db.ygoprodeck.com/api/v7/cardinfo.php')),'actual refresh reached the mocked game provider');
   assert.doesNotMatch(await page.locator('#toast').innerText(),/Couldn’t|failed|offline/);
   report.push({game,phase:'actual-refresh-control',completed:true,manualValuePreserved:true,busyCleared:true,fixtureBatchReads:refreshReads,externalRequestsForwarded:0});
   app.health();console.log(`PASS ${game}: actual Value UI, 320/390/768/1440 layout, pinned art, composition, exact lot keyboard action, gaps and all coverage/history states.`);
  }catch(error){if(app)await capture(app.page,`value-page-${game}-failure`).catch(()=>{});throw error;}finally{if(app)await app.context.close();}
 }
 await saveValueReport(report);
}catch(error){await saveValueReport(report,error);throw error;}finally{await browser.close();await server.close();}
