import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {aiOrb} from '../ai-ui.js';
assert.equal(process.env.GITHUB_ACTIONS,'true','Discovery browser checks run only in approved hosted CI.');
const {chromium}=await import('playwright');
const root=process.cwd();
async function settled(page){
 await page.waitForFunction(()=>{const root=document.querySelector('#content');return root&&!root.inert&&root.getAttribute('aria-busy')!=='true'&&root.getAnimations({subtree:true}).every(a=>a.playState==='finished'||a.playState==='idle'||!Number.isFinite(a.effect?.getComputedTiming().iterations));});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path==='/logo-test'){res.setHeader('Content-Type','text/html');return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><dialog open class="ai-review-dialog ai-companion"><div class="ai-dialog-shell"><header class="ai-dialog-head ask-head">${aiOrb()}<div><p class="eyebrow">AI coach</p><h2>Deck coaching</h2></div><button class="icon">×</button></header><p>Completed response</p></div></dialog>`);}const f=resolve(root,'.'+(path==='/'?'/index.html':path));if(!f.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 for(const width of [320,412,768,884,1384]){
  const page=await browser.newPage({viewport:{width,height:1000}});await page.goto(base+'/logo-test');
  const bounds=await page.evaluate(()=>{const logo=document.querySelector('.ask-orb'),title=document.querySelector('h2');return {logo:logo.getBoundingClientRect().toJSON(),title:title.getBoundingClientRect().toJSON(),animation:getComputedStyle(logo.querySelector('.brand-card')).animationName};});
  assert(bounds.logo.right<=bounds.title.left,'logo stays clear of title');assert.equal(bounds.animation,'stashy-idle');
  await page.locator('dialog').evaluate(n=>n.classList.add('thinking'));assert.equal(await page.locator('.brand-card').first().evaluate(n=>getComputedStyle(n).animationName),'stashy-fan');
  await page.locator('dialog').evaluate(n=>n.classList.remove('thinking'));assert.equal(await page.locator('.brand-card').first().evaluate(n=>getComputedStyle(n).animationName),'stashy-idle');await page.close();
 }
 for(const game of ['mtg','ptcg','ygo']){
  const page=await browser.newPage({viewport:{width:884,height:1100}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await page.addInitScript(()=>localStorage.setItem('cardstashy-tour-v1','done'));
  await page.goto(base+'/#home');await page.waitForFunction(()=>document.querySelector('#content .home-hero'));
  const skip=page.getByRole('button',{name:'Skip',exact:true});if(await skip.isVisible())await skip.click();
  await page.locator(`#gameTabs [role="tab"][data-game="${game}"]`).click();
  await page.waitForFunction(game=>document.body.dataset.game===game&&history.state?.cardstashy?.game===game,game);
  await page.evaluate(()=>{location.hash='#decks/ideas';});await settled(page);
  await page.getByRole('button',{name:'How to play · keywords',exact:true}).click();await page.locator('#sheet [data-learning-root]').waitFor();assert.equal(await page.locator('#sheet [data-learning-root]').getAttribute('data-game'),game);await page.locator('#sheet [data-learn-glossary] > summary').click();await page.locator('#sheet .rule-dex').waitFor();assert.equal(await page.locator('#sheet').evaluate(n=>n.scrollWidth<=n.clientWidth+2),true,'learning sheet fits fold screen');await page.locator('#sheet [data-act="closeSheet"]').click();
  await page.locator('[data-act="randomDeckOptions"]').first().click();await page.locator('#randomFormat').waitFor();assert.equal(await page.locator('#randomFormat').inputValue(),'','format requires explicit choice');assert.equal(await page.locator('#randomTheme').inputValue(),'','theme optional');await page.locator('[data-act="randomDeckStart"]').click();assert.match(await page.locator('#toast').innerText(),/Choose a format/);
  await page.locator('#sheet [data-act="closeSheet"]').click();await page.evaluate(()=>location.hash='#home');await page.locator('.home-hero').waitFor();await settled(page);assert.equal(await page.locator('#content').evaluate(n=>n.scrollWidth<=n.clientWidth+2),true,'home fits fold screen');assert.equal(await page.getByText('More tools · import, add, sets & rules',{exact:true}).count(),0);assert.deepEqual(errors,[]);await page.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(base+'/logo-test');assert.equal(await reduced.locator('.brand-card').first().evaluate(n=>getComputedStyle(n).animationName),'none');await reduced.close();
 console.log('PASS: logo bounds and busy→idle/reduced-motion at five widths; all-game learning sheets, mandatory random format, optional theme and fold-width home containment.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
