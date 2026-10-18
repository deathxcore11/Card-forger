// Real application, isolated synthetic owned lots; never a real account or network write.
import assert from 'node:assert/strict';
import {startServer,openApp,navigate,inventorySnapshot,capture} from './detail-rules-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Collection sorting browser QA runs only in hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch();
const rows=page=>page.locator('#content .lot-art[data-entry]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.entry,name:n.closest('.lot').querySelector('.lot-name').textContent.trim(),value:n.closest('.lot').querySelector('.lot-value .price').textContent.trim()})));
const ids=async page=>(await rows(page)).map(r=>r.id);
const selected=(page,label)=>page.getByRole('combobox',{name:label,exact:true});
const settle=async page=>{await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>!document.querySelector('#content').getAnimations({subtree:true}).some(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState)),null,{timeout:5000});};
try{for(const game of ['mtg','ptcg','ygo']){
 const app=await openApp(browser,server.base,{game,width:390}),{page}=app;
 try{
  // Independent nonchronological array order exposes fake "recent" sorts.
  const recent=await page.evaluate(g=>{const S=window.__uiTestState,list=g==='mtg'?S.state.collection:S.state.tcg[g].collection;list.forEach((e,i)=>e.addedAt=new Date(Date.UTC(2025,0,[3,1,5,2,4][i])).toISOString());return list.map(e=>({id:e.id,time:Date.parse(e.addedAt)})).sort((a,b)=>b.time-a.time).map(e=>e.id);},game);
  await navigate(page,'#home');await navigate(page,'#collection');await settle(page);
  const before=await inventorySnapshot(page),all=[...(await ids(page))].sort();
  assert.equal(await selected(page,'Sort collection').inputValue(),'recent','Default is Recently added, not provider/set order');
  assert.deepEqual(await ids(page),recent,'Recently added follows actual lot timestamps');
  await selected(page,'Collection sort direction').selectOption('asc');assert.deepEqual(await ids(page),[...recent].reverse());
  // Value unknowns stay last in either direction; totals are displayed lot totals.
  for(const direction of ['asc','desc']){
   await selected(page,'Sort collection').selectOption('value');await selected(page,'Collection sort direction').selectOption(direction);
   const values=(await rows(page)).map(r=>/^\$[\d,.]+$/.test(r.value)?Number(r.value.replace(/[$,]/g,'')):null);
   assert(values.some(v=>v===null)&&values.some(v=>v!==null),'Fixtures exercise known and unknown values');
   const firstUnknown=values.indexOf(null);assert(values.slice(firstUnknown).every(v=>v===null),'Unknown values follow known values in '+direction);
   const known=values.filter(v=>v!==null);assert.deepEqual(known,[...known].sort((a,b)=>direction==='asc'?a-b:b-a));
  }
  const options=await selected(page,'Sort collection').locator('option').evaluateAll(ns=>ns.map(n=>n.value));
  for(const sort of options)for(const direction of ['asc','desc']){
   await selected(page,'Sort collection').selectOption(sort);await selected(page,'Collection sort direction').selectOption(direction);
   assert.deepEqual([...(await ids(page))].sort(),all,'Sort/direction preserve exact lots: '+sort+'/'+direction);
  }
  await selected(page,'Sort collection').selectOption('name');await selected(page,'Collection sort direction').selectOption('desc');
  const chosen=await ids(page);await navigate(page,'#home');await navigate(page,'#collection');await settle(page);
  assert.equal(await selected(page,'Sort collection').inputValue(),'name');assert.equal(await selected(page,'Collection sort direction').inputValue(),'desc');assert.deepEqual(await ids(page),chosen,'Explicit sort survives navigation');
  // Search narrows, clearing restores the same identity order and direction.
  const name=await page.locator('#content .lot-art[data-entry]').first().getAttribute('aria-label');
  await page.getByRole('searchbox',{name:'Search collection',exact:true}).fill(name.replace(/^Open /,''));
  assert((await ids(page)).length>0);assert((await ids(page)).every(id=>all.includes(id)));
  await page.getByRole('searchbox',{name:'Search collection',exact:true}).fill('');assert.deepEqual(await ids(page),chosen);
  // Existing game filters remain usable and don't reset an explicit sort.
  if(game==='mtg'){
   await selected(page,'Filter').selectOption('owned');assert.equal(await selected(page,'Sort collection').inputValue(),'name');await selected(page,'Filter').selectOption('all');
  }else{
   const filter=selected(page,'Kind');await filter.selectOption(game==='ptcg'?'Pokemon':'Monster');assert.equal(await selected(page,'Sort collection').inputValue(),'name');await filter.selectOption('');
  }
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});await settle(page);
   const geometry=await page.evaluate(()=>{const root=document.querySelector('.collection-primary-tools'),sort=root.querySelector('.collection-sort-controls'),search=root.querySelector('input'),filters=root.nextElementSibling,box=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};return {width:innerWidth,doc:document.documentElement.scrollWidth,root:box(root),sort:box(sort),search:box(search),filters:box(filters),controls:[...sort.querySelectorAll('select')].map(box),first:root.firstElementChild===sort};});
   assert(geometry.first,'Sort is first, not hidden among filters');assert(geometry.doc<=width+2,'No horizontal document overflow '+JSON.stringify(geometry));
   assert(geometry.sort.left<=geometry.root.left+2&&geometry.sort.top<=geometry.search.top+2,'Sort occupies upper-left');
   assert(geometry.filters.top>=Math.max(geometry.sort.bottom,geometry.search.bottom)-2,'Filters follow primary controls');
   for(const c of geometry.controls)assert(c.height>=44&&c.left>=0&&c.right<=width+1,'Readable touch-sized sort controls '+JSON.stringify(geometry));
   assert.deepEqual(await ids(page),chosen,'Resize does not reorder chosen lots');
   await capture(page,`collection-sort-${game}-${width}`);
  }
  assert.equal(await inventorySnapshot(page),before,'Sorting/filtering/resizing never changes lots, values or decks');app.health();
  console.log(`PASS ${game}: timestamp order, unknown prices last both ways, all sorts/directions preserve lots, explicit selection/search/filters and320/390/768/1440 layout.`);
 }catch(error){await capture(page,`collection-sort-${game}-failure`).catch(()=>{});throw error;}finally{await app.context.close();}
}}finally{await browser.close();await server.close();}
