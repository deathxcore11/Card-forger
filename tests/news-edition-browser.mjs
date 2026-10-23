import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NEWS_EDITION} from '../community-edition.js';
import {startServer,openSearchApp,inventorySnapshot,noOverflow} from './search-fixtures.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted CI only');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
fs.mkdirSync('test-results',{recursive:true});const report={status:'FAIL',cases:[]};let app;
try{
 for(const game of ['mtg','ptcg','ygo']){
  app=await openSearchApp(browser,server.base,{game,evidenceLabel:'news-edition-'+game});
  const {page}=app;const before=await inventorySnapshot(page);
  await page.evaluate(()=>{Date.now=()=>Date.parse('2026-10-23T12:00:00Z');location.hash='#home';});
  const region=page.locator('[data-home-community]');await region.waitFor();
  const story=NEWS_EDITION.stories.find(x=>x.game===game);
  await region.locator(`a[href="${story.url}"]`).waitFor();
  assert.equal(await region.locator('.feature-link').count(),0,'source directories never fill news cards');
  assert.equal(await region.locator('.community-source-links a').count(),2);
  const image=region.locator('[data-art-kind="ai-illustration"] img');
  await image.evaluate(n=>n.decode());
  assert((await image.getAttribute('src')).endsWith(story.art));
  for(const width of [320,768,1440]){
   await page.setViewportSize({width,height:1000});await region.scrollIntoViewIfNeeded();
   await noOverflow(page,`${game} weekly news ${width}`);
   await region.screenshot({path:`test-results/news-edition-${game}-${width}.png`,animations:'disabled'});
   report.cases.push({game,width,source:story.url,art:story.art});
  }
  assert.deepEqual(await inventorySnapshot(page),before,'News never changes collection or deck data');
  await app.context.close();app=null;
 }
 report.status='PASS';
}finally{fs.writeFileSync('test-results/news-edition-report.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
