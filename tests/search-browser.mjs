// Real hosted app-shell coverage, never a local browser or live-provider test.
// All independent scenarios run even if earlier assertions fail. The original
// Error objects and stacks survive safety checks, cleanup and the final report.
import assert from 'node:assert/strict';
import {GAMES,WIDTHS,ART_EVIDENCE,RAW,CARDS,GROUP_IDS,PRINT_IDS,MAGIC_PRINTS,POKEMON_PRINTS,LOB,ANNIVERSARY,UNIQUE,isSearchRequest,validateSearchFixtures,startServer,openSearchApp,inventorySnapshot,noOverflow,capture,saveReport} from './search-fixtures.mjs';
console.log(await validateSearchFixtures());
if(process.argv.includes('--validate-fixtures'))process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to the approved hosted GitHub Actions job. Use --validate-fixtures locally.');
const {chromium}=await import('playwright');
const outcomes=[],failures=[];let browser,server;
const act=(page,name)=>page.locator(`[data-act="${name}"]`);
const query=(page,game)=>page.locator(game==='mtg'?'#dbTerm':'[data-input="tQ"]');
const tiles=page=>page.locator('#content .card-grid > .grid-card');
const moreAction=game=>game==='mtg'?'dbMore':'tMore';
const more=(page,game)=>act(page,moreAction(game));
const browseMarker=(page,game)=>page.locator(`[data-auto-browse="${moreAction(game)}"]`);
const hasContinuation=state=>!!(state.next||state.more);
const disclosure=(page,game)=>page.locator(game==='mtg'?'#magic-search-filters':`#tcg-search-filters-${game}`);
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const bounded=async(promise,label,timeout=15000)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label+' timed out after '+timeout+' ms')),timeout))]);}finally{clearTimeout(timer);}};
async function searchState(page,game){return page.evaluate(g=>{const u=g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search;return {q:u.term??u.q,f:u.filters??u.f,sort:u.sort,own:u.own,maxPrice:u.maxPrice,ids:u.results.map(c=>String(c.id)),next:u.next,more:u.more,page:u.page,total:u.total,busy:u.busy,error:u.error,submitted:u.submitted,ran:u.ran};},game);}
async function ready(page,game){await page.waitForFunction(g=>!(g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search).busy,game);await frame(page);}
async function detailsReady(page){await page.waitForFunction(()=>!window.__uiTestTcg.ui('ptcg').search.detailsBusy);await frame(page);}
async function submit(page,game,value){await query(page,game).fill(value);await query(page,game).press('Enter');}
async function search(page,game,value){await submit(page,game,value);await ready(page,game);}
async function visibleIds(page,game){return tiles(page).evaluateAll((ns,g)=>ns.map(n=>g==='mtg'?window.__uiTestState.ui.db.results.find(c=>c.name===n.dataset.name)?.id:n.dataset.id),game);}
async function assertIds(page,game,expected,{visible=true}={}){const ids=visible?await visibleIds(page,game):(await searchState(page,game)).ids;assert.deepEqual(new Set(ids),new Set(expected),'Exact provider card IDs, not merely same-name text');assert.equal(ids.length,new Set(ids).size,'No duplicate exact card identities');}
async function filters(page,game){const d=disclosure(page,game);assert.equal(await d.count(),1,'One stable filter disclosure');if(!await d.evaluate(n=>n.open))await d.locator(':scope > summary').click();}
async function select(page,selector,value){const c=page.locator(selector);assert.equal(await c.count(),1,`One real native source control ${selector}`);const label=await c.locator('option').evaluateAll((ns,v)=>ns.find(n=>n.value===v)?.label,value);assert(label,`Option ${value} exists in ${selector}`);await c.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();await page.waitForFunction(({selector,value})=>document.querySelector(selector)?.value===value,{selector,value});await frame(page);}
async function setFilter(page,game,field,value){await filters(page,game);if(game==='mtg'&&['rarity','mv','set'].includes(field)&&!await page.locator('#magic-search-advanced').evaluate(n=>n.open))await page.locator('#magic-search-advanced > summary').click();await select(page,`[data-change="${game==='mtg'?'dbFilter':'tFilter'}"][data-field="${field}"]`,value);await ready(page,game);}
async function setOwn(page,game,value){await filters(page,game);await select(page,game==='mtg'?'[data-change="dbFilter"][data-field="own"]':'[data-change="tOwnFilter"]',value);await ready(page,game);}
async function changeInput(page,selector,value){await page.locator(selector).fill(value);await page.locator(selector).press('Tab');await frame(page);}
async function switchGame(page,game){const choice=page.locator(`#gameTabs [role="tab"][data-act="setGame"][data-game="${game}"]`);assert.equal(await choice.count(),1,'The actual header game tab exists');await choice.click();await page.waitForFunction(g=>document.body.dataset.game===g&&window.__uiTestState.state.settings.game===g,game);assert.equal(await choice.getAttribute('aria-selected'),'true');assert.equal(await page.locator('#content').getAttribute('aria-labelledby'),`game-tab-${game}`);await frame(page);}
async function settledGate(app,gate,match){gate.release();await bounded((async()=>{while(app.requests.some(r=>match(new URL(r.url))&&!r.settled))await new Promise(r=>setTimeout(r,10));})(),'Released fixture response or cancellation');await frame(app.page);}
async function replacement(app,game,lateFailure=false){
 const {page}=app,match=u=>isSearchRequest(game,u,{group:'Alpha'}),gate=app.hold(match);
 if(lateFailure)app.fail(match);
 const newer=game==='mtg'?app.hold(u=>isSearchRequest(game,u,{group:'Beta'})):null;
 try{
  await submit(page,game,'Alpha');await bounded(gate.seen,'Alpha source request');assert.equal(await act(page,game==='mtg'?'dbSearch':'tSearch').isEnabled(),true,'A running request does not disable replacement search');
  if(game==='mtg'){
   await submit(page,game,'Beta');assert.equal((await searchState(page,game)).q,'Beta');assert.deepEqual((await searchState(page,game)).ids,[]);await settledGate(app,gate,match);await bounded(newer.seen,'Queued Beta source request');const waiting=await searchState(page,game);assert.deepEqual(waiting.ids,[],'Old request cannot paint beneath the new draft');assert.equal(waiting.busy,true,'Old completion cannot unlock the newer request');assert.equal(waiting.error,'','Late old failure stays quarantined');newer.release();await ready(page,game);
  }else{
   await search(page,game,'Beta');await assertIds(page,game,GROUP_IDS[game].Beta);const after=await searchState(page,game);await settledGate(app,gate,match);assert.deepEqual(await searchState(page,game),after,'Late old success/failure cannot replace, unlock or add an error to the current query');
  }
  await assertIds(page,game,GROUP_IDS[game].Beta);
 }finally{gate.release();newer?.release();}
}
async function filterReplacement(app,game){
 const {page}=app,match=u=>isSearchRequest(game,u,{group:'Alpha'}),gate=app.hold(match);
 try{await submit(page,game,'Alpha');await bounded(gate.seen,'First search');await filters(page,game);if(game==='mtg'&&!await page.locator('#magic-search-advanced').evaluate(n=>n.open))await page.locator('#magic-search-advanced > summary').click();await select(page,`[data-change="${game==='mtg'?'dbFilter':'tFilter'}"][data-field="${game==='ygo'?'type':'rarity'}"]`,game==='ygo'?'Spell Card':game==='mtg'?'rare':'Rare');
  if(game==='mtg')await settledGate(app,gate,match);
  await ready(page,game);await assertIds(page,game,[GROUP_IDS[game].Alpha[1]]);const current=await searchState(page,game);if(game!=='mtg'){await settledGate(app,gate,match);assert.deepEqual(await searchState(page,game),current,'Filter replacement supersedes the immutable old query');}assert(await disclosure(page,game).evaluate(n=>n.open),'Filter count changes cannot collapse the disclosure');
 }finally{gate.release();}
}
async function clearPending(app,game){
 const {page}=app;await filters(page,game);
 // Ensure Clear is a real visible control before holding the request.
 if(game!=='mtg')await select(page,'[data-change="tOwnFilter"]','owned');
 const match=u=>isSearchRequest(game,u,{group:'Alpha'}),gate=app.hold(match);
 try{await submit(page,game,'Alpha');await bounded(gate.seen,'Held search to clear');await query(page,game).fill('');await act(page,game==='mtg'?'dbClear':'tClear').click();await ready(page,game);const empty=await searchState(page,game);assert.deepEqual(empty.ids,[]);assert.equal(empty.q,'');assert(!empty.next&&!empty.more);await settledGate(app,gate,match);assert.deepEqual(await searchState(page,game),empty,'Clear invalidates cards, error and continuation from late responses');assert.equal(await tiles(page).count(),0);}finally{gate.release();}
}
async function savedPending(app,game){const {page}=app,match=u=>isSearchRequest(game,u,{group:'Alpha'}),gate=app.hold(match);try{await submit(page,game,'Alpha');await bounded(gate.seen,'Held unsaved query');await act(page,game==='mtg'?'dbSaved':'tSaved').filter({hasText:'Saved fixture search'}).click();if(game==='mtg')await settledGate(app,gate,match);await ready(page,game);await assertIds(page,game,GROUP_IDS[game].Saved);const current=await searchState(page,game);if(game!=='mtg'){await settledGate(app,gate,match);assert.deepEqual(await searchState(page,game),current,'Saved search replaces an in-flight query atomically');}}finally{gate.release();}}
async function gamePending(app,game){const {page}=app,next=GAMES[(GAMES.indexOf(game)+1)%3],match=u=>isSearchRequest(game,u,{group:'Alpha'}),gate=app.hold(match);try{await submit(page,game,'Alpha');await bounded(gate.seen,'Held old-game source');await switchGame(page,next);await search(page,next,'Beta');const current=await searchState(page,next);await settledGate(app,gate,match);assert.deepEqual(await searchState(page,next),current,'An old game cannot paint results/errors into the new game');await assertIds(page,next,GROUP_IDS[next].Beta);await switchGame(page,game);assert.equal((await searchState(page,game)).busy,false,'Switching back never strands a busy flag');assert(!(await searchState(page,game)).ids.some(id=>GROUP_IDS[game].Alpha.includes(id)),'A response cancelled by game switch is not applied in the background');}finally{gate.release();}}
async function firstRetry(app,game){const {page}=app,match=u=>isSearchRequest(game,u,{group:'Beta'});app.fail(match);await search(page,game,'Beta');assert.match((await searchState(page,game)).error,/unavailable|outage|503/i);assert.deepEqual((await searchState(page,game)).ids,[]);await act(page,game==='mtg'?'dbSearch':'tRetrySearch').click();await ready(page,game);await assertIds(page,game,GROUP_IDS[game].Beta);assert.equal(app.requests.filter(r=>match(new URL(r.url))).length,2,'Exactly the failed provider request is retried');}
// Observe, never replace, the production IntersectionObserver contract. Short
// and zero-visible pages can advance before the next automation task runs.
async function watchBrowse(page,game){await page.evaluate(g=>{
 window.__fixtureBrowseObserver?.disconnect();window.__fixtureBrowseEvents=[];
 const action=g==='mtg'?'dbMore':'tMore',seen=new WeakSet();
 const record=()=>{for(const marker of document.querySelectorAll(`[data-auto-browse="${action}"]`)){if(seen.has(marker))continue;seen.add(marker);const u=g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search;window.__fixtureBrowseEvents.push({action,role:marker.getAttribute('role'),hidden:document.querySelector(`[data-act="${action}"]`)?.hidden,ids:u.results.map(c=>String(c.id)),visible:document.querySelectorAll('#content .card-grid > .grid-card').length,next:u.next,more:u.more,page:u.page,busy:u.busy});}};
 window.__fixtureBrowseObserver=new MutationObserver(record);window.__fixtureBrowseObserver.observe(document.querySelector('#content'),{childList:true,subtree:true});record();
},game);}
async function scrollBrowse(page,game){
 // Read state and its sentinel in one browser task, so an already completed
 // automatic page cannot leave us waiting on a detached old marker. Scrolling
 // uses the real mouse wheel, never a hidden-button click or observer override.
 const read=()=>page.evaluate(g=>{const u=g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search,action=g==='mtg'?'dbMore':'tMore',markers=[...document.querySelectorAll(`[data-auto-browse="${action}"]`)];return {next:u.next,more:u.more,page:u.page,count:u.results.length,busy:u.busy,error:u.error,markers:markers.length,role:markers[0]?.getAttribute('role'),top:markers[0]?.getBoundingClientRect().top,height:innerHeight,hidden:document.querySelector(`[data-act="${action}"]`)?.hidden};},game);
 const first=await read();
 for(let step=0;step<8;step++){
  const current=await read();assert.equal(current.error,'','Unexpected page failures must not be silently retried');
  if(!hasContinuation(current)||current.next!==first.next||current.page!==first.page||current.count!==first.count)return;
  assert.equal(current.markers,1,'Continuation has a real scroll sentinel');assert.equal(current.role,'status');assert.equal(current.hidden,true,'Healthy auto-browse keeps its ordinary fallback hidden');if(current.busy)return;
  await page.mouse.move(2,Math.min(200,current.height/2));await page.mouse.wheel(0,current.top-current.height/2||100);await frame(page);
  const after=await read();if(after.busy||!hasContinuation(after)||after.next!==first.next||after.page!==first.page||after.count!==first.count||(after.top>=-300&&after.top<=after.height+350))return;
 }
 assert.fail('Real scrolling must bring the continuation sentinel into its observed viewport margin');
}
async function drainBrowse(page,game){
 for(let step=0;step<10;step++){
  const before=await searchState(page,game);assert.equal(before.error,'','Continuation has no unexpected provider error');if(!hasContinuation(before)&&!before.busy){if(game==='ptcg')await detailsReady(page);return;}
  await scrollBrowse(page,game);
  await page.waitForFunction(({g,b})=>{const u=g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search;return !u.busy&&(!!u.error||!(u.next||u.more)||u.page!==b.page||u.next!==b.next||u.results.length!==b.ids.length);},{g:game,b:before});await frame(page);
 }
 assert.fail('Synthetic scroll pagination must reach exhaustion within ten pages');
}
async function pagination(app,game){
 const {page}=app,expected=GROUP_IDS[game].Paged,match=u=>isSearchRequest(game,u,{group:'Paged',page:2}),gate=game==='ptcg'?null:app.hold(match);
 // Install the page failure before submitting: a short first page may enter the
 // sentinel's real 400px root margin without any additional user scroll.
 if(gate)app.fail(match);
 try{
  await submit(page,game,'Paged');await page.waitForFunction(g=>(g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search).results.length>0,game);
  const initial=await searchState(page,game);assert(initial.ids.length<expected.length);assert(hasContinuation(initial));assert.deepEqual(new Set(initial.ids),new Set(expected.slice(0,game==='mtg'?3:game==='ptcg'?48:60)),'The exact first provider page is retained before continuation');
  if(gate){
   await scrollBrowse(page,game);await bounded(gate.seen,'Automatic second provider page');assert.deepEqual((await searchState(page,game)).ids,initial.ids);gate.release();await ready(page,game);
   const failed=await searchState(page,game);assert.deepEqual(failed.ids,initial.ids,'A failed page preserves loaded cards');assert.equal(failed.page,initial.page);assert.equal(failed.next,initial.next);assert.match(failed.error,/outage|unavailable|503/i);
   const retry=more(page,game);assert(await retry.isVisible(),'Only a failed automatic page exposes its retry fallback');assert.match(await retry.innerText(),/try loading again/i);assert.equal(await browseMarker(page,game).count(),0,'A failed cursor cannot auto-loop');const failedUrl=app.requests.find(r=>match(new URL(r.url))).url;
   await retry.click();await ready(page,game);const attempts=app.requests.filter(r=>match(new URL(r.url)));assert.equal(attempts.length,2,'Retry does not skip or duplicate the failed cursor');assert(attempts.every(r=>r.url===failedUrl),'Retry repeats the exact provider URL, including immutable query/order');
  }else await ready(page,game);
  await drainBrowse(page,game);await assertIds(page,game,expected);assert.equal((await searchState(page,game)).ids.length,expected.length,'Overlapping pages are deduplicated');assert.equal(await more(page,game).count(),0);assert.equal(await browseMarker(page,game).count(),0);
  const requests=app.requests.filter(r=>isSearchRequest(game,new URL(r.url),{group:'Paged'}));assert.equal(requests.length,game==='mtg'?4:game==='ygo'?3:1,'Only the expected source pages and one explicit retry are requested');
 }finally{gate?.release();}
}
async function localOrder(app,game){
 const {page}=app;await filters(page,game);await select(page,'[data-change="tSort"]',game==='ptcg'?'name':'new');await search(page,game,'Paged');if(game==='ptcg')await detailsReady(page);const first=await searchState(page,game),requests=app.requests.filter(r=>isSearchRequest(game,new URL(r.url))).length;
 await select(page,'[data-change="tSort"]','priceAsc');assert.match(await page.locator('#content').innerText(),/loaded cards only|loaded.*only/i);assert.equal(app.requests.filter(r=>isSearchRequest(game,new URL(r.url))).length,requests,'Loaded-only price sort makes no replacement provider request');assert.deepEqual((await searchState(page,game)).submitted,first.submitted,'Local price sort leaves provider order frozen');await drainBrowse(page,game);await assertIds(page,game,GROUP_IDS[game].Paged);
 const values=[];for(let i=0;i<await tiles(page).count();i++){
  const tile=tiles(page).nth(i),id=await tile.getAttribute('data-id'),badge=tile.locator('.grid-meta > span:last-child'),amount=CARDS[game].find(c=>c.id===id)?.prices.usd,expected='$'+Number(amount).toFixed(2);
  try{
   assert(Number.isFinite(amount),'The exact fixture ID has a known market price');assert.equal(await badge.textContent(),expected,'The exact card price exists in the actual DOM before waiting for paint');
   // A large content-visibility:auto tile can intersect while its price is still
   // outside the viewport. Scroll the price node itself and await real layout,
   // never substitute textContent for the user-visible price assertion.
   await badge.scrollIntoViewIfNeeded();await frame(page);
   await page.waitForFunction(({id,expected})=>{const tile=[...document.querySelectorAll('#content .grid-card')].find(n=>n.dataset.id===id),node=tile?.querySelector('.grid-meta > span:last-child');if(!node)return false;const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&node.innerText===expected;},{id,expected});
   const text=await badge.innerText();assert.equal(text,expected,'The scrolled and painted badge displays this exact card market price');values.push(Number(text.replace(/[^0-9.]/g,'')));
  }catch(error){error.fixtureDiagnostics={game,id,expected};try{error.fixtureDiagnostics.badge=await badge.evaluate(n=>({html:n.outerHTML,text:n.textContent,rendered:n.innerText,rect:n.getBoundingClientRect().toJSON(),visibility:getComputedStyle(n).visibility,display:getComputedStyle(n).display,tileContentVisibility:getComputedStyle(n.closest('.grid-card')).contentVisibility}));}catch(diagnosticError){error.fixtureDiagnostics.captureError=diagnosticError.stack;}throw error;}
 }
 assert.deepEqual(values,Array.from({length:GROUP_IDS[game].Paged.length},(_,i)=>i+1),'Every loaded exact card price is rendered in ascending numeric order');if(game==='ygo'){const page2=app.requests.find(r=>isSearchRequest(game,new URL(r.url),{group:'Paged',page:2}));assert.equal(new URL(page2.url).searchParams.get('sort'),'new','Next page retains original provider order, not the local price fallback');}
}
async function zeroVisible(app,game){
 const {page}=app;await setOwn(page,game,'owned');await watchBrowse(page,game);await search(page,game,'Paged');await drainBrowse(page,game);assert.equal(await tiles(page).count(),0);await assertIds(page,game,GROUP_IDS[game].Paged,{visible:false});
 const evidence=await page.evaluate(()=>window.__fixtureBrowseEvents);assert(evidence.some(e=>e.ids.length>0&&e.visible===0&&(e.next||e.more)&&e.hidden&&e.role==='status'),'Zero visible loaded matches retain the real automatic continuation, even when it advances immediately');assert.match(await page.locator('#content').innerText(),/loaded/i);
 const loaded=(await searchState(page,game)).ids;await setOwn(page,game,'');await drainBrowse(page,game);await assertIds(page,game,GROUP_IDS[game].Paged);if(game!=='mtg')assert.deepEqual((await searchState(page,game)).ids,loaded,'Clearing a local ownership filter restores the same loaded pages');
}
async function emptyProviderPage(app){
 const {page}=app,match=u=>isSearchRequest('mtg',u,{group:'EmptyPage',page:2}),gate=app.hold(match);await watchBrowse(page,'mtg');
 try{await submit(page,'mtg','EmptyPage');await page.waitForFunction(()=>!!window.__uiTestState.ui.db.next);assert.deepEqual((await searchState(page,'mtg')).ids,[]);await scrollBrowse(page,'mtg');await bounded(gate.seen,'Empty-page automatic continuation');const before=await searchState(page,'mtg');assert.equal(app.requests.find(r=>match(new URL(r.url))).url,new URL(before.next,'https://api.scryfall.com').href,'The empty page follows its exact provider continuation');gate.release();await ready(page,'mtg');await assertIds(page,'mtg',[RAW.mtg.find(c=>c.name.startsWith('EmptyPage fixture')).id]);assert((await page.evaluate(()=>window.__fixtureBrowseEvents)).some(e=>e.ids.length===0&&e.next&&e.hidden),'An empty provider page renders a traversable scroll sentinel');assert.equal(app.requests.filter(r=>isSearchRequest('mtg',new URL(r.url),{group:'EmptyPage'})).length,2);}
 finally{gate.release();}
}
async function pendingPokemon(app,fail=false,byPrice=false){
 const {page}=app,ids=GROUP_IDS.ptcg.Pending,match=u=>u.hostname==='api.tcgdex.net'&&ids.some(id=>u.pathname==='/v2/en/cards/'+id),gates=ids.map(id=>app.hold(u=>u.pathname==='/v2/en/cards/'+id));if(fail)app.fail(match,{count:2});
 try{await filters(page,'ptcg');if(byPrice)await changeInput(page,'[data-change="tMax"]','1');else await select(page,'[data-change="tFilter"][data-field="format"]','standard');await search(page,'ptcg','Pending');await Promise.all(gates.map((g,i)=>bounded(g.seen,'Pending Pokémon detail '+i)));assert.equal(await tiles(page).count(),0,'A brief with unknown price/legality is not displayed as a verified match');assert.match(await page.locator('#content').innerText(),/awaiting card details/i);for(const g of gates)g.release();await detailsReady(page);
 if(fail){assert.equal(await tiles(page).count(),0);assert.match(await page.locator('#content').innerText(),/details unavailable/i);await act(page,'tSearchDetails').click();await detailsReady(page);}
 await assertIds(page,'ptcg',[ids[0]]);assert.equal((await searchState(page,'ptcg')).ids.length,2,'Illegal detail is retained as loaded evidence but excluded visibly');assert.doesNotMatch(await page.locator('#content').innerText(),/awaiting card details|details unavailable/i);
 }finally{for(const g of gates)g.release();}
}
async function ygoLegality(app){const {page}=app;await search(page,'ygo','Legal');await setFilter(page,'ygo','format','tcg');await assertIds(page,'ygo',['99030001','99030002','99030003']);assert.match(await page.locator('.filter-chips').innerText(),/Legal in Advanced/);await setFilter(page,'ygo','format','traditional');await assertIds(page,'ygo',['99030000','99030001','99030002','99030003']);await setFilter(page,'ygo','format','ocg');await assertIds(page,'ygo',['99030000','99030002','99030005']);const ocg=(await searchState(page,'ygo')).submitted;assert.equal(ocg.f.format,'ocg');const last=app.requests.filter(r=>isSearchRequest('ygo',new URL(r.url),{group:'Legal'})).at(-1);assert.equal(new URL(last.url).searchParams.has('format'),false,'OCG is checked locally without guessing an unsupported provider pool');await setFilter(page,'ygo','format','edison');await assertIds(page,'ygo',GROUP_IDS.ygo.Legal);const text=await page.locator('#content').innerText();assert.match(text,/Edison.*verification unavailable/i);assert.match(text,/no Edison format filter is applied/i);assert.doesNotMatch(await page.locator('.filter-chips').innerText(),/Legal in Edison|Card pool: Edison/);const unsupported=app.requests.filter(r=>isSearchRequest('ygo',new URL(r.url),{group:'Legal'})).at(-1);assert.equal(new URL(unsupported.url).searchParams.has('format'),false,'Undocumented Edison pool is not sent as a provider constraint');}

async function categoryNormalization(app,game){
 const {page}=app;await search(page,game,'Alpha');
 if(game==='ygo'){
  await setFilter(page,game,'type','Effect Monster');await setFilter(page,game,'attribute','LIGHT');await setFilter(page,game,'level','8');await select(page,'[data-change="tSort"]','defDesc');await ready(page,game);await setFilter(page,game,'type','Spell Card');const spell=await searchState(page,game);assert(!spell.f.attribute&&!spell.f.level&&!spell.f.race);assert.equal(spell.sort,'name');for(const f of['attribute','level'])assert.equal(await page.locator(`[data-change="tFilter"][data-field="${f}"]`).count(),0);assert.match(await page.locator('#content').innerText(),/Spell kind/);
  await setFilter(page,game,'type','Effect Monster');await setFilter(page,game,'level','8');await select(page,'[data-change="tSort"]','defDesc');await ready(page,game);await setFilter(page,game,'type','Link Monster');const link=await searchState(page,game);assert(!link.f.level);assert.equal(link.sort,'name');assert.equal(await page.locator('[data-change="tFilter"][data-field="level"]').count(),0);assert.equal(await page.locator('[data-change="tSort"] option[value="defDesc"]').count(),0);
 }else{
  await setFilter(page,game,'category','Pokemon');await setFilter(page,game,'type','Grass');await setFilter(page,game,'stage','Basic');await setFilter(page,game,'hp','100');for(const category of['Trainer','Energy']){await setFilter(page,game,'category',category);const state=await searchState(page,game);for(const f of['type','stage','hp']){assert(!state.f[f]);assert.equal(await page.locator(`[data-change="tFilter"][data-field="${f}"]`).count(),0);}const last=app.requests.filter(r=>isSearchRequest(game,new URL(r.url))).at(-1),u=new URL(last.url);for(const param of['types','stage','hp'])assert(!u.searchParams.has(param),'Hidden incompatible filter is absent from request');}
 }
}
async function savedNormalization(app,game){
 const {page}=app;await act(page,'tSaved').filter({hasText:'Incompatible category fixture'}).click();await ready(page,game);const restored=await searchState(page,game),fields=game==='ygo'?['attribute','level','race']:['type','stage','hp'];for(const field of fields)assert(!restored.f[field],'Restored category removes incompatible '+field);if(game==='ygo')assert.equal(restored.sort,'name');
 const last=app.requests.filter(r=>isSearchRequest(game,new URL(r.url))).at(-1),url=new URL(last.url);for(const field of(game==='ygo'?['attribute','level','race']:['types','stage','hp']))assert(!url.searchParams.has(field),'Saved search cannot send hidden '+field+' constraint');
 // Saving is a Search preference only, never collection or private-price data.
 const save=act(page,'tSaveSearch');assert.equal(await save.count(),1);await save.click();const first=await page.evaluate(g=>window.__uiTestTcg.savedSearches(g)[0],game);for(const field of fields)assert(!first.f[field],'Saved canonical search does not resurrect '+field);
}
async function magicQuery(app){const {page}=app;await filters(page,'mtg');await act(page,'dbClear').click();await changeInput(page,'[data-change="dbFilter"][data-field="maxPrice"]','0');await ready(page,'mtg');let last=app.requests.filter(r=>isSearchRequest('mtg',new URL(r.url))).at(-1);assert(last,'A price-only zero-budget search reaches the provider');assert.match(new URL(last.url).searchParams.get('q'),/usd(?:<=|<|=)0/);await setFilter(page,'mtg','type','legendary creature');last=app.requests.filter(r=>isSearchRequest('mtg',new URL(r.url))).at(-1);const q=new URL(last.url).searchParams.get('q');assert.match(q,/t:legendary\b/);assert.match(q,/t:creature\b/);assert.doesNotMatch(q,/t:legendary creature/);await page.locator('#magic-search-advanced > summary').click();const count=app.requests.filter(r=>isSearchRequest('mtg',new URL(r.url))).length;await changeInput(page,'[data-change="dbFilter"][data-field="set"]','bad!');await ready(page,'mtg');assert.match((await searchState(page,'mtg')).error,/set code|letters|invalid/i);assert.equal(app.requests.filter(r=>isSearchRequest('mtg',new URL(r.url))).length,count,'Invalid set code is not silently dropped from a broader request');}
async function searchLayout(app,game){
 const {page}=app;await search(page,game,'Alpha');await filters(page,game);
 for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await frame(page);await noOverflow(page,'#content',`${game} Search ${width}`);assert(await disclosure(page,game).evaluate(n=>n.open));await capture(page,`synthetic-search-${game}-filters-${width}`);}
 const selector=game==='mtg'?'[data-change="dbFilter"][data-field="type"]':'[data-change="tFilter"][data-field="'+(game==='ptcg'?'category':'type')+'"]';const control=page.locator(selector),prior=await control.inputValue();await control.focus();await page.keyboard.press('Enter');await page.locator('.glass-select-menu[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.glass-select-menu[open]').count(),0);assert.equal(await control.inputValue(),prior,'Escape dismisses without changing the selected filter');assert(await control.evaluate(n=>n===document.activeElement),'Escape returns focus to the original filter');
 const next=game==='mtg'?'legendary creature':game==='ptcg'?'Pokemon':'Effect Monster';await select(page,selector,next);await ready(page,game);assert(await disclosure(page,game).evaluate(n=>n.open),'Stable disclosure stays open after chip count changes');assert(await page.locator(selector).evaluate(n=>n===document.activeElement),'Focused filter survives a render');await query(page,game).fill('Alpha');await query(page,game).focus();await query(page,game).evaluate(n=>n.setSelectionRange(2,2));await query(page,game).press('x');assert.equal(await query(page,game).inputValue(),'Alxpha');assert.deepEqual(await query(page,game).evaluate(n=>[n===document.activeElement,n.selectionStart,n.selectionEnd]),[true,3,3],'Editing through a render preserves exact query cursor');
 const labels=await disclosure(page,game).innerText();if(game==='mtg'){assert.match(labels,/Mana value|Commander identity/);assert.doesNotMatch(labels,/HP at least|Level \/ Rank/);}if(game==='ptcg'){assert.match(labels,/Energy type|HP at least/);assert.doesNotMatch(labels,/Commander identity|Level \/ Rank/);}if(game==='ygo'){assert.match(labels,/Format \/ card pool|Monster type/);assert.doesNotMatch(labels,/HP at least|Commander identity/);}
 await disclosure(page,game).locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.equal(await disclosure(page,game).evaluate(n=>n.open),false);await page.keyboard.press('Enter');assert(await disclosure(page,game).evaluate(n=>n.open));
}
const picker=page=>page.locator('.printing-picker');
const choices=page=>page.locator('.printing-picker-choice');
const pickerEntry=(page,game)=>page.locator(`#card-panel-versions [data-act="${game==='mtg'?'magicPrintings':'tOtherPrintings'}"]`).first();
async function pickerReady(page){await picker(page).waitFor();await page.locator('.printing-picker-results[aria-busy="false"]').waitFor();await frame(page);}
async function parentDetail(page){return page.evaluate(()=>{const c=window.__uiTestState.ui.sheetCtx,b=document.querySelector('#sheetBody');return {type:c.type,game:c.game,name:c.name,id:c.id,print:c.print?.id,setId:c.setId,setVariant:c.setVariant,priceFinish:c.priceFinish,priceEdition:c.priceEdition,priceYgoEdition:c.priceYgoEdition,entryId:c.entryId,deckId:c.deckId,tab:c.tab,top:b.scrollTop,tabLeft:b.querySelector('.cs-tabs')?.scrollLeft,focus:document.activeElement?.dataset.act,details:[...b.querySelectorAll('details')].map(n=>[n.id||n.dataset.detailKey||n.querySelector('summary')?.textContent,n.open])};});}
async function cardForPicker(app,game){
 const {page}=app,name=CARDS[game].find(c=>c.id===PRINT_IDS[game]).name;
 await search(page,game,name);if(game==='ptcg')await detailsReady(page);await setOwn(page,game,'owned');
 if(game!=='mtg')await select(page,'[data-change="tSort"]','priceAsc');
 const card=game==='mtg'?tiles(page).filter({hasText:name}):page.locator(`#content .grid-card[data-id="${PRINT_IDS[game]}"]`);assert.equal(await card.count(),1);await card.click();await page.locator('#sheet[open]').waitFor();
 if(game==='mtg')await page.waitForFunction(()=>!window.__uiTestState.ui.sheetCtx.printsBusy&&Array.isArray(window.__uiTestState.ui.sheetCtx.prints));
 if(game==='ygo')await page.waitForFunction(()=>window.__uiTestTcg.currentYgoCatalogue().length>0);
 await page.locator('#card-tab-versions').click();await pickerEntry(page,game).waitFor();await frame(page);
 const searchBefore=await searchState(page,game);await pickerEntry(page,game).scrollIntoViewIfNeeded();await pickerEntry(page,game).focus();const detailBefore=await parentDetail(page);await page.evaluate(()=>window.__fixturePickerParentContext=window.__uiTestState.ui.sheetCtx);
 return {searchBefore,detailBefore};
}
async function openPicker(app,game){const prior=await cardForPicker(app,game);await pickerEntry(app.page,game).click();await pickerReady(app.page);return prior;}
async function assertParentRestored(page,game,prior){
 assert.equal(await picker(page).count(),0);assert(await page.locator('#sheet').evaluate(n=>n.open),'Cancel/Back restores card, not the closed underlying route');assert(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx===window.__fixturePickerParentContext),'Exact original detail context object is restored');const after=await parentDetail(page),before=prior.detailBefore;assert(Math.abs(after.top-before.top)<=2,`Exact card scroll restored (${after.top} vs ${before.top})`);assert(Math.abs((after.tabLeft||0)-(before.tabLeft||0))<=2,'Horizontal card-tab position restored');delete after.top;delete after.tabLeft;const copy={...before};delete copy.top;delete copy.tabLeft;assert.deepEqual(after,copy,'Original tab, focus, disclosure, printing/edition and lot context restored');assert.deepEqual(await searchState(page,game),prior.searchBefore,'Underlying query, filter, order, results and pagination are unchanged');
}
async function pickerNavigation(app,game,exit='cancel',layout=false){
 const {page}=app,prior=await openPicker(app,game);assert.equal(await picker(page).getAttribute('data-game'),game);assert(await page.locator('#printingPickerTitle').evaluate(n=>n===document.activeElement),'New printing picker receives accessible heading focus');assert.deepEqual(await searchState(page,game),prior.searchBefore,'Opening never rewrites Search');
 if(layout){
  for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await frame(page);await noOverflow(page,'#sheetBody',`${game} picker grid ${width}`);await page.locator('#printingPickerTitle').scrollIntoViewIfNeeded();await capture(page,`synthetic-search-${game}-picker-filters-${width}`);await choices(page).first().scrollIntoViewIfNeeded();await capture(page,`synthetic-search-${game}-picker-grid-${width}`);await act(page,'printingPickerView').filter({hasText:'List'}).click();await noOverflow(page,'#sheetBody',`${game} picker list ${width}`);await choices(page).first().scrollIntoViewIfNeeded();await capture(page,`synthetic-search-${game}-picker-list-${width}`);await act(page,'printingPickerView').filter({hasText:'Grid'}).click();}
  await page.setViewportSize({width:390,height:1000});
  const number=page.locator('#printingPickerNumber');await number.fill('01');await number.evaluate(n=>n.setSelectionRange(1,1));await number.press('2');assert.equal(await number.inputValue(),'021');assert.deepEqual(await number.evaluate(n=>[n===document.activeElement,n.selectionStart,n.selectionEnd]),[true,2,2],'Picker live filtering preserves exact input cursor');assert(await page.locator('.printing-picker-filters').evaluate(n=>n.open),'Changing active filter count keeps disclosure open');
  await act(page,'printingPickerClear').click();await select(page,'#printingPickerPrice','unknown');assert.equal(await page.locator('#printingPickerPrice').inputValue(),'unknown');assert((await choices(page).allTextContents()).every(t=>/Price unavailable/.test(t)),'Unknown-price filter never treats missing price as zero');await act(page,'printingPickerClear').click();
  const control=page.locator('#printingPickerSort'),before=await control.inputValue();await control.focus();await page.keyboard.press('Enter');await page.locator('.glass-select-menu[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await control.inputValue(),before);assert(await control.evaluate(n=>n===document.activeElement));assert.equal(await picker(page).count(),1,'Escape closes the select menu before the picker');
  const summary=page.locator('.printing-picker-filters > summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.printing-picker-filters').evaluate(n=>n.open),false);await page.keyboard.press('Enter');assert(await page.locator('.printing-picker-filters').evaluate(n=>n.open));
  const text=await picker(page).innerText();assert.match(text,/loaded|source/i);assert.match(text,/condition|edition|finish/i);if(game==='ygo'){assert.equal(await page.locator('#printingPickerFinish').count(),0);assert.equal(await page.locator('#printingPickerEdition').count(),1);assert.match(text,/Printed code/);}else{assert.equal(await page.locator('#printingPickerEdition').count(),0);assert.equal(await page.locator('#printingPickerFinish').count(),1);assert.match(text,/Collector number/);}
 }
 if(exit==='escape')await page.keyboard.press('Escape');else await act(page,exit==='back'?'printingPickerBack':'printingPickerCancel').click();await frame(page);await assertParentRestored(page,game,prior);
}
async function allPickerPages(page){let pages=1;while(await act(page,'printingPickerMore').count()){assert(pages<20,'Synthetic picker must reach its truthful exhaustion');await act(page,'printingPickerMore').click();await pickerReady(page);pages++;}return pages;}
async function renderedChoices(page){const rows=[];for(let i=0;i<await choices(page).count();i++){const row=choices(page).nth(i);await row.scrollIntoViewIfNeeded();rows.push(await row.evaluate(n=>({key:n.dataset.key,id:n.dataset.cardId,release:n.dataset.releaseId,variant:n.dataset.variant,printing:n.dataset.printing,edition:n.dataset.edition,disabled:n.disabled,text:n.innerText})));}return rows;}
async function pickerIdentities(app,game){
 const {page}=app,prior=await openPicker(app,game),pages=await allPickerPages(page),rows=await renderedChoices(page);
 assert.equal(new Set(rows.map(r=>r.key)).size,rows.length,'Opaque exact version keys do not collide');assert(rows.length>0);assert.match(await page.locator('.printing-picker-status').innerText(),/all matching results.*loaded/i);assert.match(await picker(page).innerText(),/completeness is not independently verified/i);
 if(game==='mtg'){
  assert.equal(pages,4,'Printing browser continues past the former three-page ceiling');assert.deepEqual(new Set(rows.map(r=>r.id)),new Set(MAGIC_PRINTS.map(c=>c.id)));assert(!rows.some(r=>r.id.includes('wrongoracle')));const unknown=rows.filter(r=>r.id===MAGIC_PRINTS.at(-1).id);assert.equal(unknown.length,1);assert.match(unknown[0].text,/Finish not specified/);assert.match(unknown[0].text,/Price unavailable/);assert.equal(unknown[0].disabled,true,'Unconfirmed Magic finish cannot silently become nonfoil');
 }else if(game==='ptcg'){
  assert.deepEqual(new Set(rows.map(r=>r.id)),new Set(POKEMON_PRINTS.slice(0,2).map(c=>c.id)),'ex, V, VMAX and Pocket stay outside the exact-name picker');const unknown=rows.find(r=>r.id===POKEMON_PRINTS[1].id);assert(unknown);assert.equal(unknown.variant,'firstEdition');assert.match(unknown.text,/finish unconfirmed/i);assert.match(unknown.text,/Price unavailable/);assert(!rows.some(r=>r.id==='A1-001'));assert(!app.requests.some(r=>/\/v2\/en\/cards\/(?:fxa-printing00[345]|A1-001)$/.test(new URL(r.url).pathname)),'Excluded name variants need no detail fetch');
 }else{
  assert(rows.every(r=>r.id==='89631139'),'A same-name different card ID is never a printing');assert(rows.some(r=>r.release===LOB.id));assert(rows.some(r=>r.release===ANNIVERSARY.id));const original=rows.find(r=>r.release===LOB.id&&r.printing==='LOB-001::Ultra Rare'),anniversary=rows.find(r=>r.release===ANNIVERSARY.id&&r.printing==='LOB-001::Ultra Rare');assert(original&&anniversary);assert.notEqual(original.key,anniversary.key,'Same literal code and rarity retain canonical release identity');for(const r of[original,anniversary]){assert.equal(r.edition,'');assert.match(r.text,/Edition not specified/);assert.match(r.text,/Price unavailable/);assert.doesNotMatch(r.text,/\$777|\$999|\$987/,'Legacy/global/private prices cannot leak into exact release quotes');}const explicit=rows.filter(r=>r.release===UNIQUE.id);assert.deepEqual(new Set(explicit.map(r=>r.edition)),new Set(['1st-edition','unlimited']));assert(explicit.some(r=>r.text.includes('$31.00')));assert(explicit.some(r=>r.text.includes('$11.00')));assert(rows.every(r=>/Reference art/.test(r.text)),'YGO reference image is not represented as a verified edition scan');
 }
 await select(page,'#printingPickerSort','price-low');const sorted=(await renderedChoices(page)).map(r=>r.text),firstUnknown=sorted.findIndex(t=>/Price unavailable/.test(t));if(firstUnknown>=0)assert(sorted.slice(firstUnknown).every(t=>/Price unavailable/.test(t)),'Unknown prices remain last, never free');await act(page,'printingPickerCancel').click();await frame(page);await assertParentRestored(page,game,prior);
}
async function pickerSelect(app,game){
 const {page}=app,prior=await openPicker(app,game);await allPickerPages(page);
 const selector=game==='mtg'?`.printing-picker-choice[data-card-id="${MAGIC_PRINTS[1].id}"]`:game==='ptcg'?`.printing-picker-choice[data-card-id="${POKEMON_PRINTS[1].id}"][data-variant="firstEdition"]`:`.printing-picker-choice[data-release-id=${JSON.stringify(ANNIVERSARY.id)}][data-printing="LOB-001::Ultra Rare"]`;
 const row=page.locator(selector).first();assert.equal(await row.isEnabled(),true);const exact=await row.evaluate(n=>({...n.dataset}));await row.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>['card','tcard'].includes(window.__uiTestState.ui.sheetCtx?.type));await frame(page);assert.equal(await picker(page).count(),0);const ctx=await parentDetail(page);
 if(game==='mtg'){assert.equal(ctx.print,exact.cardId);assert.equal(ctx.setId,exact.releaseId);assert(['nonfoil','foil'].includes(ctx.priceFinish));}
 else {assert.equal(ctx.id,exact.cardId);assert.equal(ctx.setId,exact.releaseId);assert.equal(ctx.entryId,'','Another printing never inherits the owned lot identity');if(game==='ptcg'){assert.equal(ctx.setVariant,'firstEdition');assert.equal(ctx.priceFinish,'firstEdition');assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.setMembership?.status),'resolved');await page.locator('.card-price-summary').scrollIntoViewIfNeeded();assert.match(await page.locator('.card-price-summary').innerText(),/No quote yet|Price unknown/);}else{assert.equal(ctx.priceEdition,'LOB-001::Ultra Rare');assert.equal(ctx.priceYgoEdition,'','Unknown edition stays unknown after selection');await page.locator('.card-price-summary').scrollIntoViewIfNeeded();assert.match(await page.locator('.card-price-summary').innerText(),/No quote yet|Price unknown/);}}
 assert.deepEqual(await searchState(page,game),prior.searchBefore,'Selection changes only the inspected detail, not parent Search');
}
async function pickerContinuationRetry(app){const {page}=app;await openPicker(app,'mtg');const match=u=>u.hostname==='api.scryfall.com'&&u.searchParams.get('q')?.includes('shared-fixture-oracle')&&u.searchParams.get('page')==='2',before=await choices(page).evaluateAll(ns=>ns.map(n=>n.dataset.key));app.fail(match);await act(page,'printingPickerMore').click();await pickerReady(page);assert.deepEqual(await choices(page).evaluateAll(ns=>ns.map(n=>n.dataset.key)),before,'Picker page failure retains verified loaded versions');await page.locator('.printing-picker [role="alert"]').waitFor();await act(page,'printingPickerRetry').click();await pickerReady(page);assert.equal(app.requests.filter(r=>match(new URL(r.url))).length,2,'Printing retry repeats the same failed continuation');assert((await choices(page).count())>before.length);await allPickerPages(page);assert.deepEqual(new Set(await choices(page).evaluateAll(ns=>ns.map(n=>n.dataset.cardId))),new Set(MAGIC_PRINTS.map(c=>c.id)));}
async function pickerPendingCancel(app){const {page}=app,prior=await cardForPicker(app,'mtg'),match=u=>u.hostname==='api.scryfall.com'&&u.searchParams.get('q')?.includes('shared-fixture-oracle'),gate=app.hold(match);try{await pickerEntry(page,'mtg').click();await bounded(gate.seen,'Held picker page');await act(page,'printingPickerCancel').click();await frame(page);await assertParentRestored(page,'mtg',prior);await settledGate(app,gate,match);await assertParentRestored(page,'mtg',prior);}finally{gate.release();}}
async function pokemonMetaNativeSelection(app){
 const {page}=app;await search(page,'ptcg','Paged');await detailsReady(page);await setOwn(page,'ptcg','missing');const before=await searchState(page,'ptcg');
 await page.locator('[data-act="go"][data-to="#decks"]:visible').first().click();await page.waitForFunction(()=>window.__uiTestState.ui.view==='decks');await act(page,'decksTab').filter({hasText:'Meta decks'}).first().click();await page.waitForFunction(()=>window.__uiTestState.ui.decksTab==='inspiration');
 const staple=page.locator('#content [data-act="tOtherPrintings"][data-name="Pikachu"]');assert.equal(await staple.count(),1);assert.equal(await staple.getAttribute('data-id'),null,'Meta staple is a real name-only entry, not a disguised card-ID entry');assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx),null,'No card context exists before root-level picker launch');assert.equal(await page.locator('#sheet').evaluate(n=>n.open),false);
 await staple.click();await pickerReady(page);const exact=page.locator(`.printing-picker-choice[data-card-id="${POKEMON_PRINTS[1].id}"][data-variant="firstEdition"]`);assert.equal(await exact.count(),1);await page.evaluate(()=>{window.__fixtureNativeCloseEvents=[];document.querySelector('#sheet').addEventListener('close',()=>window.__fixtureNativeCloseEvents.push({open:document.querySelector('#sheet').open,type:window.__uiTestState.ui.sheetCtx?.type}));});await exact.click();
 // Native <dialog>.close queues an event after synchronous selection/reopen.
 // A real browser tick is essential; a DOM stub cannot exercise this lifecycle.
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));await frame(page);
 const state=await page.evaluate(()=>({open:document.querySelector('#sheet').open,ctx:window.__uiTestState.ui.sheetCtx,locked:document.documentElement.classList.contains('sheet-open'),overflow:getComputedStyle(document.body).overflow}));assert(state.open);assert.equal(state.ctx?.type,'tcard','A queued old close event cannot erase the selected card context');assert.equal(state.ctx.id,POKEMON_PRINTS[1].id);assert.equal(state.ctx.setId,'fxb');assert.equal(state.ctx.setVariant,'firstEdition');assert.equal(state.ctx.priceFinish,'firstEdition');assert(state.locked,'Sheet-open scroll lock remains on the selected card');assert.equal(state.overflow,'hidden');
 await page.locator('#card-tab-prices').click();await page.locator('#card-panel-prices').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx?.tab),'prices','Prices remains functional after the native close-event boundary');await frame(page);assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx?.id),POKEMON_PRINTS[1].id);assert.deepEqual(await searchState(page,'ptcg'),before,'Name-only Meta picker never overwrites previously submitted Search');
}
async function pokemonMetaStaleRoute(app){
 const {page}=app;await search(page,'ptcg','Alpha');const before=await searchState(page,'ptcg');await page.locator('[data-act="go"][data-to="#decks"]:visible').first().click();await page.waitForFunction(()=>window.__uiTestState.ui.view==='decks');await act(page,'decksTab').filter({hasText:'Meta decks'}).first().click();await page.waitForFunction(()=>window.__uiTestState.ui.decksTab==='inspiration');
 assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx),null);assert.equal(await page.evaluate(()=>Object.values(window.__uiTestTcg.cache.ptcg).some(c=>c.name==='Eevee')),false,'Fixture truly needs its first name-only provider page');
 const match=u=>u.hostname==='api.tcgdex.net'&&u.pathname==='/v2/en/cards'&&u.searchParams.get('name')==='Eevee',gate=app.hold(match);
 try{await page.locator('#content [data-act="tOtherPrintings"][data-name="Eevee"]').click();await bounded(gate.seen,'Name-only Meta first page');await page.locator('[data-act="go"][data-to="#collection"]:visible').first().click();await page.waitForFunction(()=>window.__uiTestState.ui.view==='collection');const target=page.getByRole('searchbox',{name:'Search collection',exact:true});await target.focus();assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx),null,'Both routes have null parent context');await settledGate(app,gate,match);assert.equal(await picker(page).count(),0,'Late name-only lookup cannot open a picker in a different route');assert.equal(await page.locator('#sheet').evaluate(n=>n.open),false);assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx),null);assert(await target.evaluate(n=>n===document.activeElement),'Late lookup does not steal collection focus');assert.equal(await page.evaluate(()=>location.hash),'#collection');assert.deepEqual(await searchState(page,'ptcg'),before);assert(!app.requests.some(r=>new URL(r.url).pathname.endsWith('/cards/fxa-metauncached001')),'Abandoned prelaunch lookup does not hydrate or open another card');}
 finally{gate.release();}
}
async function ygoLowercasePools(app){const {page}=app;await search(page,'ygo','Pool');await setFilter(page,'ygo','format','tcg');await assertIds(page,'ygo',['99040000']);await setFilter(page,'ygo','format','ocg');await assertIds(page,'ygo',['99040000']);await setFilter(page,'ygo','format','md');await assertIds(page,'ygo',['99040000','99040002']);assert.match(await page.locator('.filter-chips').innerText(),/Card pool: Master Duel/);assert.doesNotMatch(await page.locator('.filter-chips').innerText(),/Legal in Master Duel/);}
async function magicOwnedPrintingActions(app){
 const {page}=app;await search(page,'mtg','Alpha');const before=await searchState(page,'mtg');await page.locator('[data-act="go"][data-to="#collection"]:visible').first().click();await page.waitForFunction(()=>window.__uiTestState.ui.view==='collection');const owned=page.locator('.lot-name[data-act="card"][data-entry="fixture-lot-mtg"]');assert.equal(await owned.count(),1);await owned.click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.entryId==='fixture-lot-mtg'&&!window.__uiTestState.ui.sheetCtx.printsBusy);assert.equal(await page.locator('.cd-zoom[data-hold-card]').getAttribute('data-entry'),'fixture-lot-mtg');await page.locator('#card-tab-versions').click();await pickerEntry(page,'mtg').click();await pickerReady(page);await allPickerPages(page);const selected=MAGIC_PRINTS[1];await page.locator(`.printing-picker-choice[data-card-id="${selected.id}"]`).first().click();await frame(page);
 const ctx=await parentDetail(page);assert.equal(ctx.print,selected.id);assert.equal(ctx.setId,selected.set);assert.equal(ctx.entryId,'','Selecting another printing detaches the original physical lot');assert.equal(ctx.tab,'versions','Choosing a printing retains the inspected Versions tab');await page.locator('#card-tab-overview').click();await page.locator('#card-panel-overview').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.tab),'overview');const art=page.locator('#card-panel-overview .cd-zoom[data-hold-card]');await art.scrollIntoViewIfNeeded();assert(await art.isVisible(),'The action gesture targets visible Overview art');assert.equal(await art.getAttribute('data-entry'),'','The displayed new art cannot target the prior lot');
 // The native context-menu gesture invokes the same onHold/action-card resolver
 // as long-press, without risking an accidental click on a newly opened action.
 await art.click({button:'right'});await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.type==='card-actions');const action=await page.evaluate(()=>window.__uiTestState.ui.sheetCtx);assert.equal(action.id,selected.id,'Hold/action resolution follows the exact newly chosen printing');assert.equal(action.setId,selected.set);assert.equal(await page.locator('.quick-owned').count(),0,'The old lot is not offered for quantity changes');assert.equal(await act(page,'quickQty').count(),0);assert.equal(await page.locator('#quickLotValue').count(),0);assert.equal(await act(page,'quickOwn').count(),1);await act(page,'quickOwn').click();await page.locator('#addQty').waitFor();assert.equal(await page.locator('#addQty').inputValue(),'1','Old five-copy quantity is not inherited');assert.equal(await page.locator('#addCondition').inputValue(),'Near Mint','Old Lightly Played condition is not inherited');assert.equal(await page.locator('#lotManualValue').inputValue(),'','Old private lot value is not inherited');assert.equal((await page.locator('#addSet').inputValue()).toLowerCase(),selected.set);assert.equal(await page.locator('#addNumber').inputValue(),selected.collector_number);assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.lookup?.id),selected.id);assert.deepEqual(await searchState(page,'mtg'),before);await page.locator('#sheet [data-act="closeSheet"]').first().click();
}
function recordFailure(label,phase,error){const original=error instanceof Error?error:new Error(String(error));failures.push({label,phase,error:original});console.error(`FAIL: ${label} (${phase})\n${original.stack}`);return {phase,stack:original.stack,diagnostics:original.fixtureDiagnostics||null};}
async function withApp(label,options,run){
 let app,before;const result={scenario:label,game:options.game,status:'passed',errors:[]};
 try{app=await openSearchApp(browser,server.base,{...options,evidenceLabel:label});before=await inventorySnapshot(app.page);await bounded(run(app),label+' independent scenario',60000);}catch(error){result.errors.push(recordFailure(label,app?'assertions':'bootstrap',error));}
 finally{
  if(app){
   // These checks run independently of the scenario assertion outcome. No later
   // safety/cleanup error is allowed to mask the first fatal assertion stack.
   try{assert.equal(await inventorySnapshot(app.page),before,'No collection, deck, printing, condition, wishlist or private-price state was changed');assert.deepEqual(await app.page.evaluate(()=>window.__fixtureSensitiveWrites),[],'No durable collection/private-price mutation was attempted');}catch(error){result.errors.push(recordFailure(label,'zero-write sentinels',error));}
   try{app.health();}catch(error){result.errors.push(recordFailure(label,'network/app safety',error));}
   if(result.errors.length)try{await capture(app.page,`synthetic-search-failure-${label}`,{settle:false});}catch(error){result.errors.push(recordFailure(label,'failure screenshot',error));}
   result.fixtureDiagnostics=app.diagnostics();app.releaseAll();try{await app.context.close();}catch(error){result.errors.push(recordFailure(label,'context cleanup',error));}
  }
  if(result.errors.length)result.status='failed';outcomes.push(result);console.log(`${result.status.toUpperCase()}: independent scenario ${label}`);
 }
}
try{
 server=await startServer();browser=await chromium.launch();
 for(const game of GAMES){
  await withApp(`${game}-query-replacement`,{game},a=>replacement(a,game));
  await withApp(`${game}-late-failure`,{game},a=>replacement(a,game,true));
  await withApp(`${game}-filter-replacement`,{game},a=>filterReplacement(a,game));
  await withApp(`${game}-clear-pending`,{game},a=>clearPending(a,game));
  await withApp(`${game}-saved-replacement`,{game},a=>savedPending(a,game));
  await withApp(`${game}-game-switch`,{game},a=>gamePending(a,game));
  await withApp(`${game}-first-page-retry`,{game},a=>firstRetry(a,game));
  await withApp(`${game}-pagination-dedup`,{game},a=>pagination(a,game));
  await withApp(`${game}-zero-visible-more`,{game},a=>zeroVisible(a,game));
  await withApp(`${game}-responsive-keyboard`,{game},a=>searchLayout(a,game));
  await withApp(`${game}-picker-layout-cancel`,{game},a=>pickerNavigation(a,game,'cancel',true));
  await withApp(`${game}-picker-back`,{game},a=>pickerNavigation(a,game,'back'));
  await withApp(`${game}-picker-escape`,{game},a=>pickerNavigation(a,game,'escape'));
  await withApp(`${game}-picker-identities`,{game},a=>pickerIdentities(a,game));
  await withApp(`${game}-picker-selection`,{game},a=>pickerSelect(a,game));
 }
 for(const game of['ptcg','ygo']){
  await withApp(`${game}-loaded-price-order`,{game},a=>localOrder(a,game));
  await withApp(`${game}-category-normalization`,{game},a=>categoryNormalization(a,game));
  await withApp(`${game}-saved-category-normalization`,{game},a=>savedNormalization(a,game));
 }
 await withApp('mtg-empty-provider-continuation',{game:'mtg'},emptyProviderPage);
 await withApp('mtg-query-constraints',{game:'mtg'},magicQuery);
 await withApp('mtg-picker-continuation-retry',{game:'mtg'},pickerContinuationRetry);
 await withApp('mtg-picker-cancel-pending',{game:'mtg'},pickerPendingCancel);
 await withApp('ptcg-pending-detail-legality',{game:'ptcg',pendingDetails:true},a=>pendingPokemon(a));
 await withApp('ptcg-detail-retry',{game:'ptcg',pendingDetails:true},a=>pendingPokemon(a,true));
 await withApp('ptcg-pending-detail-price',{game:'ptcg',pendingDetails:true},a=>pendingPokemon(a,false,true));
 await withApp('ygo-banlist-pool-semantics',{game:'ygo'},ygoLegality);
 await withApp('ptcg-meta-root-native-dialog-selection',{game:'ptcg'},pokemonMetaNativeSelection);
 await withApp('ptcg-meta-pending-route-replacement',{game:'ptcg'},pokemonMetaStaleRoute);
 await withApp('ygo-lowercase-provider-pools',{game:'ygo'},ygoLowercasePools);
 await withApp('mtg-owned-picker-action-identity',{game:'mtg'},magicOwnedPrintingActions);
}catch(error){recordFailure('runner','initialization',error);}
finally{try{await browser?.close();}catch(error){recordFailure('runner','browser cleanup',error);}try{await server?.close();}catch(error){recordFailure('runner','server cleanup',error);}}
try{await saveReport(outcomes,failures);}catch(error){recordFailure('runner','evidence report',error);}
console.log(ART_EVIDENCE);console.log(`Search / printing scenarios: ${outcomes.filter(o=>o.status==='passed').length} passed; ${outcomes.filter(o=>o.status==='failed').length} failed; ${failures.length} errors.`);
if(failures.length){const error=new AggregateError(failures.map(f=>f.error),`${failures.length} Search/printing regression error(s); every one of ${outcomes.length} independent scenarios was attempted.`);error.stack+='\n\n'+failures.map(f=>`--- ${f.label}: ${f.phase} ---\n${f.error.stack}`).join('\n\n');throw error;}
