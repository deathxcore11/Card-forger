// A choice from the CPU's spell (Break Under Pressure): Forge's message is "<card> (id)", " - <rules text>", then the real
// ask last. The ask line must show the real ask as one tap, with no dead OK button.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const page=await (await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true})).newPage();
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
 const ask=await page.evaluate(()=>{const f=window.fixture,n=f.native,you=n.players.find(p=>p.id===n.viewer),cards=you.zones.Battlefield.cards.slice(0,2).map(c=>({kind:'card',id:c.id}));
  f.session.acceptState({...n,revision:n.revision+1,inputType:'InputSelectCardsFromList',prompt:null,
   message:'Break Under Pressure (117)\n - Target opponent sacrifices a creature or planeswalker with the greatest mana value among creatures and planeswalkers they control. You gain 2 life. \nSelect 1 creature or planeswalker they control with the highest mana value among creatures and planeswalkers they control(s) to sacrifice.',
   buttons:{ok:'OK',okEnabled:false,cancel:'Cancel',cancelEnabled:false},selection:{cards,targets:[],chosen:[],actionable:[],blocked:[],min:1,max:1}});
  return new Promise(r=>setTimeout(()=>r({line:document.querySelector('.forge-ask-line')?.textContent||'',ok:!!document.querySelector('[data-native-key=ok]')}),400));});
 assert.equal(ask.line,'Tap a creature or planeswalker to sacrifice','the ask line says what to do, not the card name');
 assert.equal(ask.ok,false,'one tap commits, so there is no OK button');
 console.log('PASS: a one-card sacrifice choice reads "'+ask.line+'" with no dead OK button');
}finally{await browser.close();server.close();}
