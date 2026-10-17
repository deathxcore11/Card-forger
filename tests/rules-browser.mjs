// Real application-shell Rules regression, for the authorized hosted CI runner.
//   node tests/rules-browser.mjs --validate-fixtures  (never starts a browser)
//   node tests/rules-browser.mjs                    (CI browser job only)
// Preserves every original Rules assertion, with progressive disclosure opened
// through production controls, and adds exact-source and navigation coverage.
import assert from 'node:assert/strict';
import {GAMES,WIDTHS,validateFixtures,startServer,openApp,navigate,noOverflow,capture,saveReport} from './detail-rules-fixtures.mjs';
import {LESSONS,TURN_STEPS,RULE_CHECKS,CORE_RULES} from '../rule-lessons.js';
import {RULE_DEX} from '../rule-dex.js';
import {lessonReference,sourceDestination,RULE_SOURCES} from '../rule-reference.js';

console.log(await validateFixtures());
assert.equal(lessonReference('ptcg','Turn Actions').entryId,'0-p10');
assert(!sourceDestination(RULE_SOURCES.ptcg[0],10).url.includes('#page='),'Pokémon landing page is not a page-level PDF');
if(process.argv.includes('--validate-fixtures'))process.exit(0);
const {chromium}=await import('playwright');
const server=await startServer();let browser,failure;const report=[];
async function reveal(locator){
 const ancestors=locator.locator('xpath=ancestor::details');
 for(let i=0;i<await ancestors.count();i++){const d=ancestors.nth(i);if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}
}
async function openLearning(app){
 await navigate(app.page,'#decks/ideas');
 await app.page.evaluate(()=>{window.__rulesClickTrace=[];for(const kind of ['pointerdown','pointerup','click'])document.addEventListener(kind,e=>window.__rulesClickTrace.push({kind,act:e.target.closest?.('[data-act]')?.dataset.act,tag:e.target.tagName,defaultPrevented:e.defaultPrevented}),true);});
 await app.page.locator('#content [data-act="learnGame"]').first().click();app.health();
 await app.page.locator('#sheet[open] [data-learning-root]').waitFor().catch(async e=>{e.message+='\nRules action state: '+JSON.stringify(await app.page.evaluate(()=>({clicks:window.__rulesClickTrace,toast:document.querySelector('#toast')?.textContent,context:window.__uiTestState.ui.sheetCtx,open:document.querySelector('#sheet')?.open,body:document.querySelector('#sheetBody')?.textContent.slice(0,180)})));throw e;});
}
async function rootSnapshot(page){return page.locator('[data-learning-root]').evaluate(root=>({step:root.querySelector('[data-learn-step][aria-pressed="true"]')?.dataset.learnStep,filter:root.querySelector('[data-learn-search]')?.value,search:root.querySelector('[data-rule-search]')?.value,details:[...root.querySelectorAll('[data-learning-home] details')].map(d=>d.open),top:document.querySelector('#sheetBody').scrollTop}));}
async function sourceVisible(page,entry){
 await page.waitForFunction(id=>{const root=document.querySelector('#sheet[open] [data-learning-root]'),dest=root?.querySelector('[data-rule-destination]'),passage=dest?.querySelector(`[data-rule-entry="${id}"]`),heading=dest?.querySelector('[data-rule-heading]');return [root,dest,passage,heading].every(n=>n?.isConnected)&&!dest.hidden&&passage.getClientRects().length>0&&heading.getClientRects().length>0;},entry);
 assert.equal(await page.locator('[data-rule-destination] input,[data-rule-destination] textarea,[data-rule-destination] [contenteditable="true"]').count(),0,'Exact source destination is not editable');
 const focus=await page.evaluate(()=>({editable:document.activeElement?.matches('input,textarea,[contenteditable="true"]'),heading:document.activeElement?.matches('[data-rule-heading]')}));
 assert.equal(focus.editable,false,'Opening a citation never focuses search or raises the keyboard');assert.equal(focus.heading,true,'Exact source heading gets noneditable focus');
 assert((await page.locator('[data-rule-destination] .rule-passages').innerText()).length>50,'Real bundled passages, including MTG section descendants, not an empty result or matching title');
}
async function returnToLesson(page,before){
 await page.locator('[data-rule-back]').click();await page.locator('[data-learning-home]').waitFor({state:'visible'});
 const after=await rootSnapshot(page);assert.equal(after.step,before.step,'Back restores exact turn step');assert.equal(after.filter,before.filter,'Back restores topic filter');assert.equal(after.search,before.search,'Back does not replace explicit search');assert.deepEqual(after.details,before.details,'Back restores all disclosure state');assert(Math.abs(after.top-before.top)<=2,`Back restores original scroll: ${before.top} → ${after.top}`);
}
async function basicRules(app,game){
 const {page}=app;await openLearning(app);
 const root=page.locator('#sheet [data-learning-root]');
 assert.equal(await root.getAttribute('data-game'),game);
 for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await page.locator('#sheetBody').evaluate(n=>{n.scrollTop=0;});await noOverflow(page,'#sheetBody',`${game} beginner welcome ${width}px`);await capture(page,`rules-${game}-welcome-${width}`);}
 assert.equal(await root.locator('[data-learn-step]').count(),TURN_STEPS[game].length);assert.equal(TURN_STEPS[game].length,6);
 assert.equal(await root.locator('[data-learn-topic]').count(),LESSONS[game].length);assert.equal(LESSONS[game].length,8);
 assert.equal(await root.locator('[data-rule-check]').count(),RULE_CHECKS[game].length);assert.equal(RULE_CHECKS[game].length,4);
 assert.equal(await root.locator('[data-learn-keyword]').count(),Object.keys(RULE_DEX[game]).length,'All existing keyword definitions retained');
 await root.locator('[data-learn-start]').click();
 const steps=root.locator('[data-learn-step]');await steps.nth(3).click();assert.equal(await steps.nth(3).getAttribute('aria-pressed'),'true');assert.match(await root.locator('.learn-turn-body').innerText(),/Step 4 of 6/i);await root.getByRole('button',{name:'Previous step',exact:true}).click();assert.match(await root.locator('.learn-turn-body').innerText(),/Step 3 of 6/i);
 const topic=root.locator('[data-learn-search]');await reveal(topic);await topic.fill(game==='mtg'?'Commander':game==='ptcg'?'Checkup':'Chain');assert(await root.locator('[data-learn-topic]:visible').count()>0);assert(await root.locator('[data-learn-topic]:visible').count()<8);await topic.fill('zzzznotatopic');assert(await root.locator('[data-learn-empty]').isVisible());await topic.fill('');
 const answer=root.locator('[data-rule-check="0"] [data-rule-answer="no"]');await reveal(answer);await answer.click();assert(await root.locator('[data-rule-check="0"] .rule-check-answer').isVisible());assert((await root.locator('[data-rule-check="0"] .rule-check-answer').innerText()).length>70);
 // The original download/search/source-link assertions remain independent of
 // citation opening. Searching is deliberately user initiated, not a substitute.
 const load=root.getByRole('button',{name:'Open searchable rulebook',exact:true});await reveal(load);await load.click();await root.locator('[data-rule-browser]').waitFor({state:'visible'});assert(await root.locator('[data-rule-results] details').count()>0);assert(await root.locator('[data-rule-sources] a').count()>=2);
 const term=game==='mtg'?'903.8':game==='ptcg'?'Rare Candy':'Spell Speed';await root.locator('[data-rule-search]').fill(term);assert(await root.locator('[data-rule-results] details').count()>0);assert.match(await root.locator('[data-rule-result-count]').innerText(),/results/);
 if(await root.locator('[data-rule-results] details').first().getAttribute('open')===null)await root.locator('[data-rule-results] summary').first().click();assert(await root.locator('[data-rule-results] .rule-source-text:visible').count()>0);
 if(game==='mtg'){await root.locator('[data-rule-search]').fill('');await reveal(root.locator('[data-rule-chapter="4"]'));await root.getByRole('button',{name:'Zones',exact:true}).click();assert.match(await root.locator('[data-rule-results]').innerText(),/40[0-8]/);await root.getByRole('button',{name:'Glossary',exact:true}).click();assert.match(await root.locator('[data-rule-results]').innerText(),/Glossary/);await root.locator('[data-rule-chapter=""]').click();}
 await root.locator('[data-rule-home]').click();
 // Every hidden learning section can actually be reached via its own disclosure.
 for(let i=0;i<CORE_RULES[game].length;i++){const d=root.locator('[data-learn-basics] .learn-topics > details').nth(i);await reveal(d);if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();assert((await d.innerText()).includes(CORE_RULES[game][i][1]));}
 for(let i=0;i<LESSONS[game].length;i++){const d=root.locator('[data-learn-topic]').nth(i);await reveal(d);if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();assert((await d.innerText()).includes(LESSONS[game][i].example));}
 for(let i=0;i<RULE_CHECKS[game].length;i++){const b=root.locator(`[data-rule-check="${i}"] [data-rule-answer="yes"]`);await reveal(b);await b.click();assert((await root.locator(`[data-rule-check="${i}"] .rule-check-answer`).innerText()).includes(RULE_CHECKS[game][i].why));}
 for(const width of [...new Set([...WIDTHS,344,884])]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody',`${game} Rules at ${width}px`);if(WIDTHS.includes(width))await capture(page,`rules-${game}-${width}`);}
 await page.setViewportSize({width:844,height:390});await noOverflow(page,'#sheetBody',`${game} short landscape`);await capture(page,`rules-${game}-landscape`);
 for(const width of [390,680,768,390]){await page.setViewportSize({width,height:1000});assert.equal(await root.getAttribute('data-game'),game);await noOverflow(page,'#sheetBody',`${game} open-sheet fold resize ${width}`);}
 report.push(`${game}: all original strict assertions; six steps, eight full topics, four questions and every keyword retained; complete reference search, sources and MTG chapters; seven widths, short landscape and fold resize.`);
}
async function exactSources(app,game){
 const {page}=app,root=page.locator('[data-learning-root]');
 // Reference search stays separately available with its prior user-entered text.
 const search=root.locator('[data-rule-search]');await root.locator('[data-rule-load]').click();await search.waitFor({state:'visible'});await search.fill(game==='ptcg'?'Rare Candy':game==='mtg'?'903.8':'Spell Speed');await root.locator('[data-rule-home]').click();
 const step=root.locator('[data-learn-step="0"]');await reveal(step);await step.click();
 const topic=root.locator('[data-learn-search]');await reveal(topic);await topic.fill(game==='ptcg'?'Checkup':game==='mtg'?'Commander':'Chain');
 const source=root.locator('.learn-turn-body [data-rule-find]').first();await source.scrollIntoViewIfNeeded();await source.focus();const before=await rootSnapshot(page);const ref=lessonReference(game,TURN_STEPS[game][0][3]);await source.click();await sourceVisible(page,game==='mtg'?'502.':ref.entryId);
 const link=page.locator('[data-rule-destination] a[data-source-kind]').first();const href=await link.getAttribute('href');assert.equal(await link.getAttribute('data-source-kind'),game==='ptcg'?'official-page':'pdf');if(game==='ptcg'){assert(!href.includes('#page='));assert.match(await link.innerText(),/official source page/i);assert.equal(await page.locator('[data-rule-destination] [data-rule-entry="0-p10"]').count(),1);}else assert.match(href,/#page=\d+$/);
 await noOverflow(page,'#sheetBody',`${game} exact source`);await capture(page,`rules-${game}-exact-source`);await returnToLesson(page,before);assert.equal(await source.evaluate(n=>document.activeElement===n),true,'Back returns keyboard focus to the source action');
 report.push(`${game}: exact ${ref.entryId} passage opens visibly, without editable focus; honest external link kind; Back restores step, filter, disclosure, search, scroll and source focus.`);
}
try{
 browser=await chromium.launch();
 for(const game of GAMES){const app=await openApp(browser,server.base,{game});try{await basicRules(app,game);await exactSources(app,game);await app.close();}catch(error){try{app.health();}catch(health){error.message+='\n'+health.stack;}await capture(app.page,`rules-${game}-failure`).catch(()=>{});await app.context.close();throw error;}}
 // A starts a slow corpus request. Back selects B while A is still pending.
 // Both await the same real loader; only B may publish or take focus afterward.
 const race=await openApp(browser,server.base,{game:'ptcg',reducedMotion:'reduce'});await openLearning(race);await race.page.locator('[data-learn-start]').click();
 const gate=race.hold(u=>u.pathname==='/rulebooks/ptcg-rules-v1.json.gz');await race.page.locator('.learn-turn-body [data-rule-find]').click();await gate.seen;await race.page.locator('[data-rule-destination]').waitFor({state:'visible'});assert.equal(await race.page.evaluate(()=>document.activeElement?.matches('input,textarea')),false);
 await race.page.locator('[data-rule-back]').click();await race.page.locator('[data-learn-step="1"]').click();await race.page.locator('.learn-turn-body [data-rule-find]').click();gate.release();await sourceVisible(race.page,'0-p11');assert.equal(await race.page.locator('[data-rule-destination] [data-rule-entry="0-p10"]').count(),0,'Late A cannot replace newer B');await capture(race.page,'rules-ptcg-source-race-reduced');await race.close();report.push('Pokémon pending A → Back → B race keeps only B (0-p11); reduced-motion context and no keyboard/search focus.');
 // Visible failure/retry is local. No production endpoint is touched.
 const offline=await openApp(browser,server.base,{game:'ptcg'});await openLearning(offline);await offline.page.locator('[data-learn-start]').click();offline.failRules();await offline.page.locator('.learn-turn-body [data-rule-find]').click();await offline.page.locator('[data-rule-retry]').waitFor({state:'visible'});assert.match(await offline.page.locator('[data-rule-destination]').innerText(),/unavailable|online|retry|try again/i);offline.failRules(false);await offline.page.locator('[data-rule-retry]').click();await sourceVisible(offline.page,'0-p10');await offline.close();report.push('Unavailable/offline reference exposes a visible retry and recovers to exact Pokémon Draw without search.');
 console.log('PASS: '+report.join('\nPASS: '));
}catch(error){failure=error;throw error;}finally{await saveReport('rules-browser',report,failure);await browser?.close();await server.close();}
