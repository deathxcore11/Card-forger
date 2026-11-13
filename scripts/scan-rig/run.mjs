// Scanner test rig, step 2: runs the real website scanner (Photo path, real text reader, local
// catalogue pack, signed out so no AI read) over a labelled photo set and scores it.
//   node scripts/scan-rig/run.mjs --set /tmp/scan-set --out /tmp/scan-score.json [--games mtg,ptcg,ygo] [--limit N]
// Scores per game and per light: right card, right printing, added without asking ("ready"),
// wrong card added without asking (the worst outcome), and seconds per scan on this machine
// (a desktop browser: compare runs with each other, never with a phone).
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {createRequire} from 'node:module';
const {chromium,devices}=createRequire(import.meta.url)('playwright'); // the machine's own Playwright, wherever it is installed
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const root=process.cwd(),set=arg('set','/tmp/scan-set'),out=arg('out','/tmp/scan-score.json'),games=arg('games','mtg,ptcg,ygo').split(','),limit=Number(arg('limit','0'));
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.wasm':'application/wasm','.gz':'application/gzip'})[extname(file)]||'application/octet-stream');
 res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const results=[];
for(const g of games){
 const labels=JSON.parse(await readFile(join(set,g,'labels.json'),'utf8')).slice(0,limit||undefined);
 const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage();page.setDefaultTimeout(20000);
 await page.goto(base+'/#scan');await page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
 const skip=page.getByRole('button',{name:'Skip',exact:true});try{await skip.waitFor({state:'visible',timeout:2500});await skip.click();}catch{}
 if(g!=='mtg'){await page.locator(`#gameTabs [data-game="${g}"]`).click();await page.locator(`#gameTabs [data-game="${g}"][aria-selected="true"]`).waitFor();}
 await page.getByRole('button',{name:'Scanner settings',exact:true}).first().click();
 await page.locator('[data-act="scanCatalogDownload"]').click();
 await page.getByText(/local card records ready/).waitFor({timeout:90000});
 await page.locator('#sheet[open] [data-act="closeSheet"]').first().click();
 await page.evaluate(async()=>{const {loadBatch,saveBatch}=await import('/scan-batch.js'),{S}=await import('/store.js');window.__rig={loadBatch,saveBatch,state:()=>S.ui.scan};});
 for(const L of labels){
  const row={game:g,file:L.file,light:L.light,want:{id:String(L.id),name:L.name}};
  try{
   await page.evaluate(()=>window.__rig.saveBatch([]));
   const photo=page.locator('[data-act="scanMode"][data-id="photo"]');if(await photo.count())await photo.first().click(); // already in Photo mode after the first card
   await page.locator('input[data-change="scanFile"]').last().setInputFiles(join(set,g,L.file));
   const t=Date.now();
   await page.getByRole('button',{name:'Read card',exact:true}).click();
   await page.waitForFunction(()=>{const q=window.__rig;return q.loadBatch().some(x=>['ready','review','unresolved'].includes(x.status))&&!q.state().busy;},{},{timeout:150000});
   row.seconds=(Date.now()-t)/1000;
   const got=await page.evaluate(()=>{const e=window.__rig.loadBatch()[0],s=window.__rig.state();return {status:e.status,reason:e.reason||'',cands:(e.cands||[]).slice(0,3).map(c=>({id:String(c.id),name:c.name,exact:!!c.exact})),read:{name:(s.read?.name||'').slice(0,80),code:(s.read?.code||'').slice(0,80)}};});
   Object.assign(row,got);
   const top=got.cands[0];
   row.card=!!top&&(g==='ygo'?top.id===row.want.id:key(top.name)===key(L.name));
   row.printing=g==='ygo'?null:!!top&&top.id===row.want.id;
   row.inTop3=got.cands.some(c=>g==='ygo'?c.id===row.want.id:key(c.name)===key(L.name));
   row.ready=got.status==='ready';
  }catch(e){row.error=String(e.message||e).slice(0,200);row.card=false;row.printing=g==='ygo'?null:false;row.ready=false;row.inTop3=false;
   await page.goto(base+'/#scan').catch(()=>{});await page.evaluate(async()=>{const {loadBatch,saveBatch}=await import('/scan-batch.js'),{S}=await import('/store.js');window.__rig={loadBatch,saveBatch,state:()=>S.ui.scan};}).catch(()=>{});}
  results.push(row);
  console.log(`${g} ${L.light.padEnd(5)} ${row.card?'CARD':'miss'} ${row.printing==null?'    ':row.printing?'PRNT':'    '} ${row.ready?'ready':(row.status||'error').padEnd(5)} ${(row.seconds||0).toFixed(1)}s  ${L.name} -> ${row.cands?.[0]?.name||row.error||'nothing'}`);
  await writeFile(out,JSON.stringify(results,null,1));
 }
 await context.close();
}
const pct=(a,f)=>a.length?Math.round(100*a.filter(f).length/a.length)+'%':'-';
const line=(label,a)=>{const p=a.filter(r=>r.printing!=null),s=a.map(r=>r.seconds||0).sort((x,y)=>x-y);
 return `${label.padEnd(12)} n=${String(a.length).padStart(3)}  card ${pct(a,r=>r.card).padStart(4)}  printing ${pct(p,r=>r.printing).padStart(4)}  ready ${pct(a,r=>r.ready).padStart(4)}  wrong+ready ${pct(a,r=>r.ready&&!r.card).padStart(4)}  median ${s[Math.floor(s.length/2)]?.toFixed(1)}s  slowest ${s.at(-1)?.toFixed(1)}s`;};
console.log('\n'+line('ALL',results));
for(const g of games)console.log(line(g,results.filter(r=>r.game===g)));
for(const l of ['good','dim','glare','warm','tilt'])console.log(line(l,results.filter(r=>r.light===l)));
await browser.close();server.close();
