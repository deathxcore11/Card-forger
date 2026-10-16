// Real OCR + real public lookup APIs + production popup/save handlers, before release.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
const root=process.cwd(),refs=[
 {game:'Magic',g:'mtg',name:'Lightning Bolt',url:'https://api.scryfall.com/cards/7673784e-db4b-43a1-8d55-1bb9fc1e284f'},
 {game:'Pokémon',g:'ptcg',name:'Kyogre',url:'https://api.tcgdex.net/v2/en/cards/cel25-3'},
 {game:'Yu-Gi-Oh!',g:'ygo',name:'Dark Magician',url:'https://db.ygoprodeck.com/api/v7/cardinfo.php?name=Dark%20Magician'}
];
async function download(url){const r=await fetch(url,{headers:{'User-Agent':'CardStashy-Scanner-Regression/1.0','Accept':'*/*'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Reference unavailable: ${url} (${r.status})`);return r;}
for(const ref of refs){
 const raw=await (await download(ref.url)).json(),card=raw.data?.[0]||raw;
 assert.equal(card.name,ref.name);
 const image=ref.g==='mtg'?card.image_uris.normal:ref.g==='ptcg'?card.image+'/high.webp':card.card_images[0].image_url;
 ref.bytes=Buffer.from(await (await download(image)).arrayBuffer());ref.mime=ref.g==='ptcg'?'image/webp':'image/jpeg';
 console.log(`Reference loaded: ${ref.game} ${ref.name}, ${ref.bytes.length} image bytes.`);
}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),ref=refs.find(r=>url.pathname==='/__reference/'+r.g);
 if(ref){res.setHeader('Content-Type',ref.mime);return res.end(ref.bytes);}
 const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
await mkdir('test-results',{recursive:true});
try{
 for(const ref of refs){
  const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage();page.setDefaultTimeout(15000);
  try{
   await page.goto(base+'/#scan');await page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
   const skip=page.getByRole('button',{name:'Skip',exact:true});try{await skip.waitFor({state:'visible',timeout:2000});await skip.click();}catch{}
   if(ref.g!=='mtg'){
    await page.getByRole('button',{name:'Switch game',exact:true}).click();await page.locator('#sheet[open]').getByRole('button',{name:new RegExp(ref.game)}).click();
    await page.getByRole('button',{name:'Switch game',exact:true}).getByText(ref.game,{exact:true}).waitFor();
   }
   await page.getByRole('tab',{name:'Photo',exact:true}).click();
   const upload=page.locator('input[data-change="scanFile"]').last();
   await upload.setInputFiles({name:ref.g+(ref.g==='ptcg'?'.webp':'.jpg'),mimeType:ref.mime,buffer:ref.bytes});
   await page.getByRole('button',{name:'Read card',exact:true}).click();
   await page.locator('.scan-confirm').waitFor({state:'visible',timeout:120000});
   const read=await page.evaluate(async()=>{const {S}=await import('/store.js');return {read:S.ui.scan.read,status:S.ui.scan.status,tried:S.ui.scan.tried};});
   console.log(`${ref.game} real OCR: ${JSON.stringify(read)}`);
   const popup=page.getByRole('region',{name:'Confirm scanned card',exact:true});
   assert.equal(await popup.count(),1,`${ref.game} reference photo must produce a candidate, not a blank result`);
   assert.equal(await popup.getByText(ref.name,{exact:true}).count(),1,`${ref.game} correct card title`);
   assert.equal(await popup.getByRole('img',{name:ref.name,exact:true}).count(),1,'card copy is shown');
   await popup.getByRole('button',{name:'More copies',exact:true}).click();await popup.getByRole('button',{name:'More copies',exact:true}).click();
   await popup.getByRole('button',{name:'Lightly Played',exact:true}).click();
   await popup.getByRole('combobox',{name:'Scanned card language',exact:true}).tap();
   await page.locator('.glass-select-menu[open]').getByRole('option',{name:'Japanese',exact:true}).tap();
   await popup.getByRole('button',{name:'Add to collection',exact:true}).click();
   await popup.waitFor({state:'detached'});
   const saved=await page.evaluate(async g=>{const {S}=await import('/store.js');return (g==='mtg'?S.state:S.state.tcg[g]).collection;},ref.g);
   assert.equal(saved.length,1);assert.equal(saved[0].name,ref.name);assert.equal(saved[0].qty,3);assert.equal(saved[0].condition,'Lightly Played');assert.equal(saved[0].language,'ja');
   await page.getByRole('navigation',{name:'Main',exact:true}).getByRole('button',{name:'Collection',exact:true}).click();
   await page.getByRole('heading',{name:'Collection',exact:true}).waitFor();await page.locator('main').getByRole('img',{name:ref.name,exact:true}).first().waitFor({state:'visible'});
   console.log(`PASS: ${ref.game}: real image → real browser OCR → public lookup → illustrated popup → dropdown edit → 3 LP/Japanese copies saved once → collection screen.`);
  }catch(e){
   console.error(`FAIL ${ref.game}: ${e.stack}`);console.error((await page.locator('main').innerText()).slice(0,6000));
   await page.screenshot({path:`test-results/scanner-${ref.g}-failure.png`,fullPage:true});throw e;
  }finally{await context.close();}
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
