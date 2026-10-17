// HOSTED ONLY. Real app Home leaf refresh after actual local save and a delayed
// exact-condition provider response. Everything is synthetic; no live/paid calls.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GAMES, RESULTS, validateSearchFixtures, startServer, capture, noOverflow } from './search-fixtures.mjs';
import { EVIDENCE, validateConditionFixtures, openConditionApp, seedReviews, openReview, navigate, savedLots, settle, frames, waitUntil } from './condition-refresh-fixtures.mjs';
import { homeValueComparison, homeValueCoverage } from '../home-ui.js';
const widths = [320, 360, 390, 430, 700, 768, 900, 1024, 1200, 1440, 2560];
const foldSequence=[{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:844,height:390},{width:390,height:844}];
const evidenceViewports=[{width:320,height:844},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900},{width:2560,height:1440}];
console.log(await validateSearchFixtures()); console.log(await validateConditionFixtures());
assert.equal(homeValueComparison({ total: 8.75, copies: 5, unpriced: 0 }, [{ date:'2026-10-16', total:8.33, copies:5, ...homeValueCoverage({unpriced:0}) }], Date.parse('2026-10-17')).delta, .42);
if (process.argv.includes('--validate-fixtures')) { console.log('PASS: Home exact-value, all-game local-save/delayed-quote, stale-game, coverage and 320–2560 hosted fixture contract. No browser or server started.'); process.exit(0); }
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Home value UI tests are hosted-only; use --validate-fixtures locally.');
const { chromium } = await import('playwright');
const outcomes = [], failures = []; let browser, server;
const record = (label,phase,error) => { failures.push({label,phase,error}); console.error(label,phase,error.stack); };
async function run(game, mode) {
  const label = `${game}-${mode}`; let app;
  try {
    app = await openConditionApp(browser,server.base,{game,label:`home-value-${label}`,hold:true});
    const { page } = app;
    await page.evaluate(game => {
      const S=window.__uiTestState, row={date:'2026-10-16',total:8.33,copies:5,unpriced:0,currency:'USD',basis:'exact-owned-v1'};
      if(game==='mtg')S.state.valueHistory=[row];else localStorage.setItem(`cardstashy-value-hist-${game}`,JSON.stringify([row]));
    },game);
    await navigate(page,'home');
    assert.equal(await page.locator('[data-value-amount]').innerText(),'$8.75');
    assert.match(await page.locator('[data-value-movement]').innerText(),/↑ \+\$0\.42 · total change since Oct 16, 2026/);
    assert.match(await page.locator('[data-value-explanation]').textContent(),/includes copies, recorded values and available prices/);
    const otherBefore=await page.evaluate(game=>JSON.stringify(Object.fromEntries(['mtg','ptcg','ygo'].filter(g=>g!==game).map(g=>[g,(g==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[g]).collection]))),game);
    await seedReviews(page,game); await openReview(page);
    await waitUntil(()=>app.condition.records.some(row=>row.params.game===game),'Actual exact condition request');
    await page.locator('[data-act="scanConfirm"]').click();
    await page.waitForFunction(game=>!window.__uiTestState.ui.scan.confirm&&(game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game]).collection.reduce((sum,row)=>sum+row.qty,0)===7,game);
    assert.equal(app.condition.records[0].settled,false,'save completes before delayed quote');
    await navigate(page,'home');
    assert.equal(await page.locator('[data-value-amount]').innerText(),'$8.75');
    assert.match(await page.locator('[data-value-note]').innerText(),/Known subtotal · 2 unpriced/);
    assert.equal(await page.locator('[data-value-movement]').isVisible(),false,'increased unpriced coverage is not a market loss');
    if(mode==='late-game') {
      const next=game==='mtg'?'ptcg':'mtg';
      await page.locator(`#game-tab-${next}`).click();
      await page.waitForFunction(g=>document.body.dataset.game===g,next);
      const node=await page.locator('.home-value').elementHandle(),before=await page.locator('.home-value').innerText();
      app.condition.release(); await settle(app);
      assert.equal(await page.locator('.home-value').innerText(),before,'old game quote cannot replace active game numbers');
      assert(await node.evaluate(n=>n.isConnected),'active game glance is not detached by old response');
      await page.locator(`#game-tab-${game}`).click();await page.waitForFunction(g=>document.body.dataset.game===g,game);
      assert.equal(await page.locator('[data-value-amount]').innerText(),'$23.25','returning game reads its updated canonical total');
      await node.dispose();
    } else {
      const resume=page.locator('[data-home-resume] button');
      await resume.focus();
      await page.evaluate(()=>{window.__homeValueStable={resume:document.querySelector('[data-home-resume] button'),value:document.querySelector('.home-value-main'),scrollY};});
      const requestsBeforeResize=app.condition.records.length;
      for(const viewport of foldSequence){
        await page.setViewportSize(viewport);await frames(page);
        assert(await page.evaluate(()=>window.__homeValueStable.resume===document.querySelector('[data-home-resume] button')&&window.__homeValueStable.value===document.querySelector('.home-value-main')),'fold/unfold preserves the actual Home mount while the quote is pending');
        assert(await resume.evaluate(n=>n===document.activeElement),'resume action keeps keyboard focus');
        assert.equal(await page.locator('[data-value-amount]').innerText(),'$8.75');
        assert.equal(app.condition.records[0].settled,false);
      }
      assert.equal(app.condition.records.length,requestsBeforeResize,'viewport changes do not launch duplicate quote requests');
      app.condition.release(); await settle(app);
      await page.waitForFunction(()=>document.querySelector('[data-value-amount]')?.textContent==='$23.25');
      assert(await resume.evaluate(n=>n===document.activeElement),'resume action keeps keyboard focus');
      assert(await page.evaluate(()=>window.__homeValueStable.resume===document.activeElement&&window.__homeValueStable.value===document.querySelector('.home-value-main')),'async quote updates leaves, preserving original resume focus and value button');
      assert.match(await page.locator('[data-value-movement]').innerText(),/↑ \+\$14\.92 · total change since Oct 16, 2026/,'inventory-inclusive total movement uses the actual dated baseline');
      assert.equal(await page.locator('[data-value-copies]').innerText(),'7');
      // Production render event also services later local cache changes without
      // replacing a focused value action. No extra provider request is started.
      await page.locator('.home-value-main').focus();
      assert(await page.locator('.home-value-main').evaluate(n=>n===document.activeElement),'value action accepts keyboard focus');
      const control=await page.locator('.home-value-main').elementHandle();
      await page.evaluate(game=>{
        const st=game==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[game];st.collection[0].qty++;
        dispatchEvent(new Event('cardstashy-rerender'));
      },game); await frames(page);
      assert.equal(await page.locator('[data-value-amount]').innerText(),'$25.00');
      assert(await control.evaluate(n=>n.isConnected&&n===document.activeElement),'local quantity refresh preserves the existing focused value action');
      for(const width of widths){await page.setViewportSize({width,height:1100});await noOverflow(page,'.home-value',`${game} exact cents/delta ${width}`);}
      for(const viewport of evidenceViewports){
        await page.setViewportSize(viewport);await noOverflow(page,'.home-value',`${game} exact total ${viewport.width}x${viewport.height}`);
        await page.locator('.home-value-main').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
        assert(await page.locator('.home-value-main').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'exact value remains directly hittable in each orientation');
        await capture(page,`synthetic-search-home-value-${game}-priced-${viewport.width}x${viewport.height}`);
      }
      await page.setViewportSize({width:390,height:844});
      // A disappeared quote is an unpriced gap, not a downward signal. The
      // actual condition resolver rejects these wrong-currency provider rows.
      await page.evaluate(game=>{
        const S=window.__uiTestState,T=window.__uiTestTcg,st=game==='mtg'?S.state:S.state.tcg[game];
        for(const lot of st.collection){delete lot.manualValue;delete lot.manualValueCondition;lot.condition='Unknown condition';lot.conditionQuotes=[];}
        dispatchEvent(new Event('cardstashy-rerender'));
      },game);await frames(page);
      assert.equal(await page.locator('[data-value-amount]').innerText(),'—');
      assert.equal(await page.locator('[data-value-movement]').isVisible(),false);
      assert.match(await page.locator('[data-value-note]').innerText(),/8 unpriced/);
      assert.doesNotMatch(await page.locator('.home-value-main').innerText(),/\$0\.00|↓/);
      await capture(page,`synthetic-search-home-value-${game}-missing`);await control.dispose();
    }
    assert.equal(await page.evaluate(game=>JSON.stringify(Object.fromEntries(['mtg','ptcg','ygo'].filter(g=>g!==game).map(g=>[g,(g==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[g]).collection]))),game),otherBefore,'other games holdings unchanged');
    assert.equal(await page.evaluate(()=>window.__conditionReview.ocrCalls),0);
    app.health();app.condition.health();outcomes.push({label,passed:true});
  } catch(error) { record(label,'execution',error);if(app)try{await capture(app.page,`synthetic-search-home-value-${label}-failure`,{settle:false});}catch{} }
  finally { if(app){app.condition.release();app.releaseAll();try{await app.context.close();}catch(error){record(label,'cleanup',error);}} }
}
try { server=await startServer();browser=await chromium.launch();for(const game of GAMES){await run(game,'live');await run(game,'late-game');} }
catch(error){record('runner','setup',error);}
finally{await browser?.close();await server?.close();}
await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'home-value-browser.json'),JSON.stringify({kind:'hosted-only-synthetic-home-value',evidence:EVIDENCE,widths,evidenceViewports,statefulResize:foldSequence,outcomes,passed:!failures.length,failures:failures.map(f=>({label:f.label,phase:f.phase,stack:f.error.stack}))},null,2));
if(failures.length)throw new AggregateError(failures.map(f=>f.error),'Home value hosted regression failed');
