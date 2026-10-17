// Real app-shell Sets regression. Browser execution is authorized in hosted CI
// only. This guard is intentional: --validate-fixtures never imports Playwright,
// starts a server, launches a browser or contacts a provider.
import assert from 'node:assert/strict';
import {GAMES,WIDTHS,SETS,LOB,ANNIVERSARY,PAGED,EXPECTED,ART_EVIDENCE,BROKEN_SET_SYMBOL_SOURCES,validateSetsFixtures,startServer,openSetsApp,navigate,inventorySnapshot,noOverflow,capture,saveReport} from './sets-fixtures.mjs';

console.log(await validateSetsFixtures());
if(process.argv.includes('--validate-fixtures'))process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to the approved hosted GitHub Actions job. Use --validate-fixtures locally.');
const {chromium}=await import('playwright');
const server=await startServer();let browser,failure;const report=[ART_EVIDENCE],outcomes=[],failures=[];
const tiles=page=>page.locator('#content .set-grid > .grid-card');
const bounded=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out after 15 seconds')),15000);})]);}finally{clearTimeout(timer);}};
const route=id=>'#set/'+encodeURIComponent(id);
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const sourceRequest=(game,id,pageNumber=1)=>url=>game==='mtg'?url.hostname==='api.scryfall.com'&&url.pathname==='/cards/search'&&url.searchParams.get('q')?.includes('e:'+id)&&Number(url.searchParams.get('page')||1)===pageNumber:game==='ptcg'?url.hostname==='api.tcgdex.net'&&url.pathname==='/v2/en/sets/'+id:url.hostname==='db.ygoprodeck.com'&&url.pathname.endsWith('/cardinfo.php')&&url.searchParams.get('cardset')===SETS.ygo.find(s=>s.id===id)?.name&&Number(url.searchParams.get('offset')||0)===(pageNumber-1)*100;
async function readyIndex(page){await page.locator('.set-year-section .set-row').first().waitFor();await page.waitForFunction(()=>{const g=window.__uiTestState.state.settings.game;return !(g==='mtg'?window.__uiTestState.ui.sets:window.__uiTestTcg.ui(g).sets).busy;});}
async function readySet(page,game,id){await page.waitForFunction(({game,id})=>{const s=game==='mtg'?window.__uiTestState.ui.set:window.__uiTestTcg.ui(game).set;return window.__uiTestState.ui.view==='set'&&(game==='mtg'?s.code===id:s.id===id)&&!s.busy&&s.cards.length>0;},{game,id});await tiles(page).first().waitFor();}
async function openSet(page,game,id){await navigate(page,route(id));await readySet(page,game,id);}
async function tileIds(page,game){return tiles(page).evaluateAll((nodes,g)=>nodes.map(n=>g==='mtg'?window.__uiTestState.ui.set.cards[Number(n.dataset.setI)]?.id:n.dataset.id),game);}
async function cardTile(page,game,id){const ids=await tileIds(page,game),index=ids.indexOf(id);assert(index>=0,`Exact tile ID ${id} exists, not just a same-name card`);const tile=tiles(page).nth(index);await tile.scrollIntoViewIfNeeded();await frame(page);return tile;}
async function browseMore(app,action,selector,total){
 const {page}=app;
 // The real app intentionally hides its fallback button when native automatic
 // browsing is available. Reach its visible sentinel instead of force-clicking
 // the hidden button or dispatching a test-only action.
 const button=page.locator(`[data-act="${action}"]`),marker=page.locator(`[data-auto-browse="${action}"]`);
 const identities=()=>page.locator(selector).evaluateAll(ns=>ns.map(n=>n.dataset.id||n.dataset.code||n.dataset.setI));
 const sourceReads=()=>app.requests.filter(r=>{const u=new URL(r.url);return u.hostname==='api.scryfall.com'&&['/sets','/cards/search'].includes(u.pathname)||u.hostname==='api.tcgdex.net'&&u.pathname.startsWith('/v2/en/sets')||u.hostname==='db.ygoprodeck.com'&&/\/(?:cardsets|cardinfo)\.php$/.test(u.pathname);}).map(r=>r.method+' '+r.url);
 const before=await identities(),hash=await page.evaluate(()=>location.hash),requests=sourceReads();
 assert.equal(before.length,120,'The first page stays bounded until its sentinel is reached');
 assert(before.every(Boolean),'Every row has an exact release/card identity');
 assert.equal(await button.textContent(),`Show more · ${total-before.length} left`,'Continuation belongs to the exact remaining result count');
 assert.equal(await button.count(),1,'A bounded page exposes exactly one continuation');
 assert(await button.evaluate(n=>n.hidden),'Native automatic browsing keeps the fallback button hidden');
 await marker.waitFor();await marker.scrollIntoViewIfNeeded();
 await page.waitForFunction(({selector,total})=>document.querySelectorAll(selector).length===total,{selector,total});await frame(page);
 const after=await identities();
 assert.equal(after.length,total,'Scrolling the real sentinel loads every remaining result');
 assert.deepEqual(after.slice(0,before.length),before,'Continuation retains the exact existing rows in order');
 assert.equal(new Set(after).size,total,'Continuation adds only distinct release/card identities');
 assert.equal(await page.evaluate(()=>location.hash),hash,'Automatic continuation cannot navigate to a different release');
 assert.deepEqual(sourceReads(),requests,'Client-side continuation cannot refetch or change the loaded release source');
 assert.equal(await button.count(),0,'Exhausted results leave no continuation button');
 assert.equal(await marker.count(),0,'Exhausted results leave no automatic-browse sentinel');
}
async function select(page,selector,value){const control=page.locator(selector);assert.equal(await control.count(),1,`One real control: ${selector}`);const label=await control.locator('option').evaluateAll((nodes,v)=>nodes.find(n=>n.value===v)?.label,value);assert(label,`Supplied option ${value} exists in ${selector}`);await control.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();await page.waitForFunction(({selector,value})=>document.querySelector(selector)?.value===value,{selector,value});await frame(page);}
async function cacheSnapshot(page){return page.evaluate(()=>JSON.stringify(Object.fromEntries(['ptcg','ygo'].map(g=>[g,Object.fromEntries(Object.entries(window.__uiTestTcg.cache[g]).map(([id,c])=>[id,{id:c.id,sets:c.sets,prices:c.prices,image:c.image,imageLarge:c.imageLarge,setContext:c.setContext}]))]))));}
async function setIdentity(page,game,id){const state=await page.evaluate(g=>{const s=g==='mtg'?window.__uiTestState.ui.set:window.__uiTestTcg.ui(g).set;return {info:s.info?.id||s.info?.code,cards:s.cards.map(c=>({id:c.id,context:c.setContext?.releaseId,set:typeof c.set==='string'?c.set:c.set?.id}))};},game);assert.equal(state.info,id,'Loaded release metadata belongs to the latest route');assert(state.cards.length>0);if(game==='ygo'){assert(state.cards.every(c=>c.context===id),'All selected-release card contexts match this exact canonical release');assert.equal(new Set(state.cards.map(c=>c.id)).size,state.cards.length,'Regional and rarity rows cannot duplicate card tiles');assert.deepEqual(await tiles(page).evaluateAll(ns=>[...new Set(ns.map(n=>n.dataset.setId))]),[id]);}else assert(state.cards.every(c=>c.set===id),'Every card belongs to the exact requested set');}
async function progress(page,total,owned){const p=page.locator('.set-collection-progress');await p.waitFor();const bar=p.getByRole('progressbar');assert.equal(await bar.count(),total===null?0:1);if(total!==null){assert.equal(await bar.getAttribute('aria-valuemax'),String(total));assert.equal(await bar.getAttribute('aria-valuenow'),String(owned));}else{assert.doesNotMatch(await p.innerText(),/\b\d+%/,'An unknown total must not display a completion percentage');assert.match(await p.innerText(),/unverified|not verified|unknown/i);}assert.equal(await p.evaluate(n=>n.classList.contains('progress-changed')),false,'Unrelated renders must not replay earned ownership animation');}
async function keyboardRelease(page,game,id){
 // An old release may be beyond the catalogue's first 80 rows. Reach it through
 // the actual search control, then activate its exact identity with the keyboard.
 await page.getByRole('searchbox',{name:'Find a set',exact:true}).fill(game==='ygo'?LOB.code:id);
 await frame(page);
 const selector=game==='mtg'?'.set-row[data-code='+JSON.stringify(id)+']':'.set-row[data-id='+JSON.stringify(id)+']';
 const target=page.locator(selector);assert.equal(await target.count(),1,'Keyboard target is one exact release, not a name collision');
 await target.focus();assert(await target.evaluate(n=>n===document.activeElement));await page.keyboard.press('Enter');await readySet(page,game,id);
}
async function layout(page,game,kind){
 for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await noOverflow(page,'#content',`${game} ${kind} ${width}`);if(kind==='catalogue'){
  const geometry=await page.locator('.set-year-section').evaluateAll(sections=>sections.map(s=>{const header=s.querySelector(':scope > .set-year-heading'),grid=s.querySelector(':scope > .set-year-grid');return {heading:header?.querySelector('h2')?.textContent,head:header?.getBoundingClientRect().toJSON(),grid:grid?.getBoundingClientRect().toJSON(),children:grid?[...grid.children].map(n=>n.classList.contains('set-row')):[],invalidHeading:grid?.querySelector('h2')!==null};}));
  assert(geometry.length>=2,'Different years have distinct semantic sections');for(const g of geometry){assert(g.heading&&g.head&&g.grid);assert(g.children.length&&g.children.every(Boolean),'Each year grid contains only release rows, never a heading cell');assert.equal(g.invalidHeading,false);assert(g.head.bottom<=g.grid.top+2,'Year heading is above its grid, not beside a card');}
 }await capture(page,`sets-${game}-${kind}-${width}`);}
 for(const width of [390,768,320,1440,390]){await page.setViewportSize({width,height:844});await noOverflow(page,'#content',`${game} ${kind} fold resize ${width}`);}
}
async function catalogue(app,game){
 const {page}=app,before=await inventorySnapshot(page);await readyIndex(page);const cache=await cacheSnapshot(page);await layout(page,game,'catalogue');
 const search=page.getByRole('searchbox',{name:'Find a set',exact:true});await search.fill(game==='ygo'?'LOB':game==='ptcg'?'fixturea':'fxa');await frame(page);assert.equal(await page.locator('.set-row').count(),game==='ygo'?2:1);
 if(game==='ygo'){const ids=await page.locator('.set-row').evaluateAll(ns=>ns.map(n=>n.dataset.id));assert.deepEqual(new Set(ids),new Set([LOB.id,ANNIVERSARY.id]));assert.notEqual(ids[0],ids[1],'Original and anniversary never share their route identity');}
 await search.fill('no-matching-fixture-xyz');await page.getByText('No sets match',{exact:true}).waitFor();assert.equal(await page.locator('.set-row').count(),0);
 await search.fill('');await frame(page);
 if(game!=='mtg'){const expected=SETS[game].length;assert.equal(await page.locator('.set-row').count(),120,'Search resets the catalogue boundary to 120');await browseMore(app,'tSetsMore','.set-row',expected);}
 if(game==='ygo'){await select(page,'[data-change="tSetKind"]','decks');assert(await page.locator('.set-row').count()>0);assert((await page.locator('.set-row').allTextContents()).every(t=>/Starter Deck/.test(t)));await select(page,'[data-change="tSetKind"]','all');await browseMore(app,'tSetsMore','.set-row',SETS[game].length);}
 if(game==='mtg'){assert.equal(await page.locator('.set-row[data-code="fxpromo"]').count(),0);await page.locator('[data-change="setsAll"]').check();assert.equal(await page.locator('.set-row[data-code="fxpromo"]').count(),1);await page.locator('[data-change="setsAll"]').uncheck();}
 const unknown=game==='mtg'?page.locator('.set-row[data-code="fxu"]'):game==='ptcg'?page.locator('.set-row[data-id="fixtureunknown"]'):page.locator('.set-row').filter({hasText:'Synthetic undated release'});await unknown.scrollIntoViewIfNeeded();assert.match(await unknown.locator('.set-row-count').innerText(),/Unknown/i);assert.doesNotMatch(await unknown.locator('.set-row-count').innerText(),/^0\s*cards/i);
 const broken=game==='mtg'?page.locator('.set-row[data-code="fxb"]'):game==='ptcg'?page.locator('.set-row[data-id="fixtureb"]'):page.locator('.set-row').filter({hasText:PAGED.name});await broken.scrollIntoViewIfNeeded();await broken.locator('.set-media.no-art').waitFor();const fallback=broken.locator('.set-media-fallback'),fallbackCode=fallback.locator('.set-art-code');assert(await fallback.isVisible(),'Failed source image leaves a visible fallback');assert(await fallbackCode.isVisible(),'The fallback paints independent set-code text, not an empty image wrapper');assert.equal(await fallbackCode.innerText(),game==='mtg'?'FXB':game==='ptcg'?'FIXTUREB':PAGED.code);assert.equal(await fallback.locator('img,svg,.set-icon').count(),0,'Fallback cannot reuse the failed artwork or remote symbol');
 if(game==='ptcg'){await page.waitForFunction(()=>document.querySelector('.set-row[data-id="fixtureb"] .set-catalogue-symbol')?.hidden===true);const sources=BROKEN_SET_SYMBOL_SOURCES.map(source=>new URL(source,page.url()).href);assert.deepEqual([...new Set(app.images.filter(url=>sources.includes(url)))],sources,'Every exact symbol source fails before the final set-code fallback');assert(await fallbackCode.isVisible(),'The code remains visible after the entire symbol chain is exhausted');}
 await keyboardRelease(page,game,EXPECTED[game].a);await setIdentity(page,game,EXPECTED[game].a);assert.equal(await inventorySnapshot(page),before);assert.equal(await cacheSnapshot(page),cache,'Loading a selected release never changes shared card printings, art, generic prices or identity');report.push(`${game}: separate responsive year sections, keyboard release navigation, exact IDs, unknown count/image fallback, catalogue search/category/scroll-pagination boundaries.`);
}
async function filterCards(app,game){
 const {page}=app;await readyIndex(page);const before=await inventorySnapshot(page),cache=await cacheSnapshot(page),id=EXPECTED[game].a;await openSet(page,game,id);await layout(page,game,'cards');await setIdentity(page,game,id);
 const expectedCount=game==='ygo'?14:123;assert.equal(await tiles(page).count(),Math.min(120,expectedCount));if(expectedCount>120){await browseMore(app,game==='mtg'?'setMore':'tSetMore','#content .set-grid > .grid-card',expectedCount);assert.equal(new Set(await tileIds(page,game)).size,expectedCount);}
 await progress(page,EXPECTED[game].count,game==='ygo'?1:0);
 if(game==='ygo'){assert.match(await page.locator('.set-progress-caption').innerText(),/14.*126/s);assert.match(await page.locator('.set-progress-caption').innerText(),/incomplete|partial/i);assert.doesNotMatch(await page.locator('.set-collection-progress').innerText(),/100%/);const tile=await cardTile(page,game,EXPECTED.ygo.id);const badge=tile.locator('.tile-set .tset');assert(await badge.isVisible(),'Exact card badge is painted after scrolling its content-visibility tile into view');assert.equal(await badge.locator('b').innerText(),'LOB');assert.equal(await badge.getAttribute('title'),LOB.name+' · Common','Badge identifies the exact original release, not just a shared prefix');assert.match(await tile.locator('.grid-meta').innerText(),/#118.*Dark Energy/s);assert.doesNotMatch(await tile.innerText(),/KC01|\$999|\$987/,'Selected LOB badge and amount cannot borrow first/owned/global printings');assert.match(await tile.innerText(),/LOB/);assert.equal(await tile.locator('.owned-badge:not(.other)').count(),0,'Owning five KC01 copies does not own the LOB printing');}
 const filter=game==='mtg'?'setFilter':'tSetFilter';await page.locator(`[data-act="${filter}"][data-id="owned"]`).click();await frame(page);assert.equal(await tiles(page).count(),game==='ygo'?1:0,'Owned filter uses exact release, never name/other edition');if(game==='ygo')assert.deepEqual(await tileIds(page,game),['89631139'],'Five copies count as one unique card');await page.locator(`[data-act="${filter}"][data-id="all"]`).click();
 const input=page.locator(`[data-input="${game==='mtg'?'setSearch':'tSetQ'}"]`);await input.fill(game==='ygo'?'118':'123');await frame(page);assert.equal(await tiles(page).count(),1,'Collector-number search is implemented, not name-only');assert.equal((await tileIds(page,game))[0],game==='ygo'?'4614116':game==='mtg'?'fixture-mtg-set-a-123':'fixturea-123');await input.fill('no-card-fixture-xyz');await frame(page);assert.equal(await tiles(page).count(),0);await input.fill('');await frame(page);
 const rarity=game==='mtg'?'setRarity':'tSetRarity';await select(page,`[data-change="${rarity}"]`,game==='mtg'?'rare':'Rare');const ids=await tileIds(page,game);assert(ids.length>0);if(game==='ygo')assert.deepEqual(ids,['46986414'],'A regional rarity facet still produces one unique card');else assert(ids.every(id=>Number(id.split('-').at(-1))%2===0));await select(page,`[data-change="${rarity}"]`,game==='mtg'?'all':'');
 if(game!=='ygo'){await select(page,`[data-change="${game==='mtg'?'setFinish':'tSetFinish'}"]`,game==='mtg'?'foil':'holofoil');assert.equal(await tiles(page).count(),120,'Facet reset restores the bounded first page');await select(page,`[data-change="${game==='mtg'?'setFinish':'tSetFinish'}"]`,game==='mtg'?'all':'');}
 await select(page,`[data-change="${game==='mtg'?'setSort':'tSetSort'}"]`,'name');await select(page,`[data-change="${game==='mtg'?'setSort':'tSetSort'}"]`,'number');assert.equal(await inventorySnapshot(page),before,'Browsing/filtering never changes saved lots or decks');assert.equal(await cacheSnapshot(page),cache,'Set-only release contexts never mutate shared cards, prices, printings or artwork');report.push(`${game}: exact-release ownership, collector search, source-backed rarity/finish facets, bounded scroll-pagination and immutable shared card cache.`);
}
async function releaseChooser(app){const {page}=app;await readyIndex(page);await navigate(page,'#set/LOB');const chooser=page.locator('.set-release-chooser');await chooser.waitFor();assert.equal(await tiles(page).count(),0,'Ambiguous legacy route cannot load a guessed release');const ids=await chooser.locator('[data-act="tSet"]').evaluateAll(ns=>ns.map(n=>n.dataset.id));assert.deepEqual(new Set(ids),new Set([LOB.id,ANNIVERSARY.id]));assert.equal(app.requests.filter(r=>sourceRequest('ygo',LOB.id)(new URL(r.url))||sourceRequest('ygo',ANNIVERSARY.id)(new URL(r.url))).length,0,'Chooser makes no cards request until selection');await chooser.locator('[data-act="tSet"]').filter({hasText:ANNIVERSARY.name}).click();await readySet(page,'ygo',ANNIVERSARY.id);await progress(page,126,0);await setIdentity(page,'ygo',ANNIVERSARY.id);await capture(page,'sets-ygo-legacy-release-selected');report.push('Legacy #set/LOB opens an explicit original/anniversary chooser, including migrated v2 metadata, and never silently resolves the prefix.');}
async function sourceRace(app,game){const {page}=app,a=EXPECTED[game].a,b=EXPECTED[game].b;await readyIndex(page);const before=await inventorySnapshot(page),gate=app.hold(sourceRequest(game,a));try{await navigate(page,route(a));await bounded(gate.seen,'Held source request');if(game==='mtg')await navigate(page,route(b));else await openSet(page,game,b);const response=page.waitForResponse(r=>sourceRequest(game,a)(new URL(r.url())));gate.release();await response;await frame(page);if(game==='mtg'){const stale=await page.evaluate(a=>({info:window.__uiTestState.ui.set.info?.code,cards:window.__uiTestState.ui.set.cards.filter(c=>c.set===a).length}),a);assert.notEqual(stale.info,a,'Queued B route cannot temporarily render stale A metadata');assert.equal(stale.cards,0,'Queued B route cannot temporarily render stale A cards');await readySet(page,game,b);}assert.equal(await page.evaluate(()=>location.hash),route(b));await setIdentity(page,game,b);await readySet(page,game,b);assert.equal(await inventorySnapshot(page),before);await page.goBack();await readySet(page,game,a);await setIdentity(page,game,a);await page.goForward();await readySet(page,game,b);await setIdentity(page,game,b);await capture(page,`sets-${game}-race-history`);}finally{gate.release();}report.push(`${game}: ${game==='mtg'?'a cancelled A response cannot paint the queued B route':'B completes before A; late A cannot replace B'}; Back/Forward restore the correct release without inventory changes.`);}
async function retrySameRoute(app,game){const {page}=app,id=EXPECTED[game].a;await readyIndex(page);app.fail(sourceRequest(game,id),{count:game==='mtg'?3:1});await navigate(page,route(id));const retry=page.locator(`[data-act="${game==='mtg'?'setReload':'tSetRetry'}"]`).first();await retry.waitFor();assert.match(await page.locator('#content .note.warn').innerText(),/unavailable|failed|503|error|source/i);const hash=await page.evaluate(()=>location.hash),attempts=app.requests.filter(r=>sourceRequest(game,id)(new URL(r.url))).length;await retry.click();await readySet(page,game,id);assert.equal(await page.evaluate(()=>location.hash),hash,'Retry does not require a different route');assert(app.requests.filter(r=>sourceRequest(game,id)(new URL(r.url))).length>attempts);await setIdentity(page,game,id);assert.equal(await page.locator('#content .note.warn').count(),0);report.push(`${game}: source failure is visible and retry on the exact same route succeeds.`);}
async function paginatedFailure(app,game){const {page}=app,id=game==='mtg'?'fxa':PAGED.id;await readyIndex(page);app.fail(sourceRequest(game,id,2),{count:game==='mtg'?3:1});await openSet(page,game,id);assert.equal(await tiles(page).count(),100);assert.equal(new Set(await tileIds(page,game)).size,100);assert.match(await page.locator('#content').innerText(),/partial|incomplete|didn.t load|unavailable/i);await progress(page,game==='mtg'?123:null,0);const retry=page.locator(`[data-act="${game==='mtg'?'setReload':'tSetRetry'}"]`).first();await retry.click();await readySet(page,game,id);if(game==='mtg')await browseMore(app,'setMore','#content .set-grid > .grid-card',123);assert.equal(await tiles(page).count(),game==='mtg'?123:103);assert.equal(new Set(await tileIds(page,game)).size,game==='mtg'?123:103,'Retry replaces/merges safely without duplicate earlier pages');await progress(page,game==='mtg'?123:null,0);report.push(`${game}: page-two failure preserves earlier cards with honest partial/unknown coverage; retry completes pagination without duplicate cards.`);}
async function openExactCard(page,game){const id=EXPECTED[game].id;await (await cardTile(page,game,id)).click();await page.waitForFunction(({game,id})=>{const ctx=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&(game==='mtg'?ctx?.print?.id===id:ctx?.id===id)&&!!document.querySelector('.card-price-summary');},{game,id});const ctx=await page.evaluate(()=>window.__uiTestState.ui.sheetCtx);if(game==='mtg'){assert.equal(ctx.print.id,id);assert.equal(ctx.setId,'fxa');assert.equal(ctx.priceFinish,'foil');}else{assert.equal(ctx.id,id);assert.equal(ctx.setId,EXPECTED[game].a);if(game==='ptcg'){assert.equal(ctx.setVariant,'holofoil');assert.equal(ctx.priceFinish,'holofoil');}}return ctx;}
async function exactSave(app,game){
 const {page}=app;await readyIndex(page);await openSet(page,game,EXPECTED[game].a);if(game!=='ygo')await select(page,game==='mtg'?'[data-change="setFinish"]':'[data-change="tSetFinish"]',game==='mtg'?'foil':'holofoil');await openExactCard(page,game);assert.match(await page.locator('.card-price-summary').innerText(),/No quote yet|Price unknown|No verified/i,'Unknown selected-printing amount stays unknown');const inventory=await inventorySnapshot(page),cache=await cacheSnapshot(page);
 await page.locator('[data-act="cardTab"][data-tab="prices"]').click();await page.locator('#card-sellers').waitFor();assert.doesNotMatch(await page.locator('#card-sellers').innerText(),/\$999|\$987\.65|\$1\.75/,'No unrelated/private printing price becomes a seller quote');if(game==='ygo'){assert.match(await page.locator('.price-version').innerText(),/LOB-118/);assert.doesNotMatch(await page.locator('#sheet .cd-set').first().innerText(),/KC01/);}
 assert.equal(await inventorySnapshot(page),inventory);assert.equal(await cacheSnapshot(page),cache);await page.locator('[data-act="cardTab"][data-tab="overview"]').click();await page.locator(`#sheet [data-act="${game==='mtg'?'own':'tOwn'}"]`).first().click();await page.locator(game==='mtg'?'#addQty':'#tQty').waitFor();
 if(game==='mtg'){assert.equal((await page.locator('#addSet').inputValue()).toLowerCase(),'fxa');assert.equal(await page.locator('#addNumber').inputValue(),'1');assert.equal(await page.locator('#addFinish').inputValue(),'foil','Selected set finish survives detail → Add');assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.lookup.id),EXPECTED.mtg.id);}else{assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.id),EXPECTED[game].id);if(game==='ygo'){assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.setId),LOB.id);const options=await page.locator('#tPrint option').evaluateAll(ns=>ns.map(n=>n.value));assert(options.includes('LOB-118|Common'));assert(options.every(v=>!v.startsWith('KC01')&&!v.startsWith('LOB-EN')),'Add only offers matching original-release printings');await select(page,'#tPrint','LOB-118|Common');assert.equal(await page.locator('#tEdition').inputValue(),'','Unknown edition must not silently become First Edition or Unlimited');}else assert.equal(await page.locator('#tPrint').inputValue(),'holofoil','Selected set version survives detail → Add without reverting to normal');}
 await page.locator(game==='mtg'?'#addQty':'#tQty').fill('5');await select(page,game==='mtg'?'#addCondition':'#tCond','Lightly Played');await page.locator('#lotManualValue').fill('1.75');await page.locator(`#sheet [data-act="${game==='mtg'?'addSave':'tOwnSave'}"]`).click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);
 const saved=await page.evaluate(({game,id})=>{const rows=game==='mtg'?window.__uiTestState.state.collection:window.__uiTestState.state.tcg[game].collection;return rows.find(e=>(game==='mtg'?e.printingId:e.cardId)===id&&e.manualValue===1.75);},{game,id:EXPECTED[game].id});assert(saved,'Exact selected card was saved in fixture-only local state');assert.equal(saved.condition,'Lightly Played');assert.equal(saved.qty,5);assert.equal(saved.manualValue,1.75);assert.equal(saved.manualValueCondition,'Lightly Played');if(game==='mtg'){assert.equal(saved.printingId,EXPECTED.mtg.id);assert.equal(saved.printingVerified,true);assert.equal(saved.finish,'foil');assert.equal(saved.set.toLowerCase(),'fxa');assert.equal(saved.collectorNumber,'1');}else{assert.equal(saved.cardId,EXPECTED[game].id);if(game==='ygo'){assert.equal(saved.printing,'LOB-118');assert.equal(saved.rarity,'Common');assert.equal(saved.edition,'');assert.equal(saved.setReleaseId,LOB.id);}else assert.equal(saved.variant,'holofoil');}
 // Persistence is read back through the app's normal reload, not a test-only save.
 await page.reload();await page.locator('#app.ready').waitFor();await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});await readySet(page,game,EXPECTED[game].a);const restored=await page.evaluate(({game,id})=>(game==='mtg'?window.__uiTestState.state.collection:window.__uiTestState.state.tcg[game].collection).find(e=>e.id===id),{game,id:saved.id});assert.deepEqual(restored,saved,'Condition, printing, exact release and private value survive persisted fixture reload');await progress(page,EXPECTED[game].count,game==='ygo'?2:1);await capture(page,`sets-${game}-exact-private-lot`);report.push(`${game}: exact card/release survives sheet → price panel → add → private condition-valued lot and app reload; five copies advance unique progress by one.`);
}
async function reducedMotion(app){const {page}=app;await readyIndex(page);await keyboardRelease(page,'ygo',LOB.id);const bar=page.locator('.set-progress-track > span');await bar.waitFor();const motion=await bar.evaluate(n=>({animation:getComputedStyle(n).animationName,duration:getComputedStyle(n).animationDuration,transition:getComputedStyle(n).transitionDuration}));assert(motion.animation==='none'||motion.duration.split(',').every(t=>parseFloat(t)===0),'Reduced motion removes progress animation');assert(motion.transition.split(',').every(t=>parseFloat(t)===0),'Reduced motion removes progress transition');const filter=page.locator('[data-act="tSetFilter"][data-id="missing"]');await filter.focus();await page.keyboard.press('Enter');await frame(page);assert.equal(await tiles(page).count(),13);await noOverflow(page,'#content','Reduced motion keyboard-only Sets controls');await capture(page,'sets-reduced-motion-keyboard');report.push('Reduced-motion preference and keyboard-only release/filter controls preserve the same exact ownership behavior.');}
function recordFailure(label,phase,error){
 // Retain the actual Error object and original stack. An additional failure in
 // safety checks/cleanup must not replace the scenario's first error.
 const original=error instanceof Error?error:new Error(String(error));
 failures.push({label,phase,error:original});
 console.error(`FAIL: ${label} (${phase})\n${original.stack}`);
 return {phase,stack:original.stack,diagnostics:original.fixtureDiagnostics||null};
}
async function withApp(label,options,run){
 let app;const outcome={scenario:label,game:options.game,status:'passed',errors:[]};
 try{
  app=await openSetsApp(browser,server.base,{...options,evidenceLabel:label});
  await run(app);
 }catch(error){outcome.errors.push(recordFailure(label,app?'assertions':'bootstrap',error));}
 finally{
  if(app){
   // Safety assertions run even after an unrelated layout/control assertion fails.
   try{app.health();}catch(error){outcome.errors.push(recordFailure(label,'network/app safety',error));}
   if(outcome.errors.length){
    try{await capture(app.page,`sets-failure-${label}`);}catch(error){outcome.errors.push(recordFailure(label,'failure screenshot',error));}
   }
   outcome.requests=app.requests.length;
   outcome.fixtureDiagnostics=app.diagnostics();
   try{await app.context.close();}catch(error){outcome.errors.push(recordFailure(label,'context cleanup',error));}
  }
  if(outcome.errors.length)outcome.status='failed';
  outcomes.push(outcome);
  console.log(`${outcome.status.toUpperCase()}: independent scenario ${label}`);
 }
}
function aggregateFailures(){
 if(!failures.length)return undefined;
 const error=new AggregateError(failures.map(f=>f.error),`${failures.length} Sets regression error(s); all ${outcomes.length} independent scenarios were attempted.`);
 error.stack+='\n\n'+failures.map(f=>`--- ${f.label}: ${f.phase} ---\n${f.error.stack}`).join('\n\n');
 return error;
}
try{
 browser=await chromium.launch();
 for(const game of GAMES){
  await withApp(`${game}-catalogue`,{game},app=>catalogue(app,game));
  await withApp(`${game}-cards`,{game},app=>filterCards(app,game));
  await withApp(`${game}-race`,{game},app=>sourceRace(app,game));
  await withApp(`${game}-retry`,{game},app=>retrySameRoute(app,game));
  await withApp(`${game}-save`,{game},app=>exactSave(app,game));
 }
 await withApp('legacy-chooser',{game:'ygo',legacy:true},releaseChooser);
 for(const game of ['mtg','ygo'])await withApp(`${game}-pagination`,{game},app=>paginatedFailure(app,game));
 await withApp('ygo-zero-owned',{game:'ygo',ownership:'unverified'},async app=>{
  await readyIndex(app.page);await openSet(app.page,'ygo',LOB.id);await progress(app.page,126,0);
  await app.page.locator('[data-act="tSetFilter"][data-id="owned"]').click();assert.equal(await tiles(app.page).count(),0);
  report.push('KC01 ownership and an ambiguous unknown-edition legacy LOB lot never silently complete either exact LOB release.');
 });
 await withApp('reduced-motion',{game:'ygo',reducedMotion:'reduce'},reducedMotion);
}catch(error){recordFailure('runner','initialization',error);}
finally{
 try{await browser?.close();}catch(error){recordFailure('runner','browser cleanup',error);}
 try{await server.close();}catch(error){recordFailure('runner','server cleanup',error);}
}
failure=aggregateFailures();
try{await saveReport('sets-browser',[...report,...outcomes],failure);}catch(error){recordFailure('runner','evidence report',error);failure=aggregateFailures();}
console.log(`Sets scenarios: ${outcomes.filter(o=>o.status==='passed').length} passed; ${outcomes.filter(o=>o.status==='failed').length} failed; ${failures.length} total errors.`);
if(failure)throw failure;
console.log('PASS: '+report.join('\nPASS: '));
