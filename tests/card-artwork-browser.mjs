// Hosted CI only. --validate-fixtures is pure and never creates a server/browser.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pokemonArtRoute} from '../pokemon-art.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const sample=JSON.parse(await readFile(new URL('../test-fixtures/card-artwork-provider-samples.json',import.meta.url),'utf8'));
assert.deepEqual(sample.pokemon.map(c=>c.pricing.tcgplayer.normal.productId),[98000,98001,98002,98003]);
assert.equal(sample.ygo.card_images[1].id,46986415);
if(process.argv.includes('--validate-fixtures')){console.log('PASS: exact public artwork fixture identities; no server/browser started.');process.exit(0);}
const {createServer}=await import('node:http');
const {chromium}=await import('playwright');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336"><rect width="240" height="336" fill="#54307a"/><text x="14" y="34" fill="white" font-size="14">SYNTHETIC ART FIXTURE</text></svg>';
const upstream=[],cache=new Map();
const key=x=>typeof x==='string'?x:x.url;
globalThis.caches={default:{match:async x=>cache.get(key(x))?.clone(),put:async(x,response)=>{cache.set(key(x),response.clone());}}};
const fetcher=async url=>{
 upstream.push(String(url));
 if(String(url).startsWith('https://api.tcgdex.net/'))return Response.json(sample.pokemon.find(c=>url.endsWith('/'+c.id))||{});
 if(/^https:\/\/tcgplayer-cdn[.]tcgplayer[.]com\/product\/9800[0-3]_400w[.]jpg$/.test(url))return new Response(svg,{headers:{'Content-Type':'image/svg+xml'}});
 throw Error('Unexpected fixture upstream: '+url);
};
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{padding:24px}#grid{display:flex;flex-wrap:wrap;gap:16px}#grid>div{width:160px}.card-img{width:160px;height:224px;object-fit:contain}.variant-art{width:160px}</style><h1>Exact artwork failure contract</h1><p>Synthetic images test fallback identity, not provider pixels.</p><div id="grid"></div><script type="module">
import {artworkHTML,handleArtworkError} from '/artwork.js';
import {cardImage,img} from '/ui.js';
import {variantArtThumb} from '/tcg.js';
import {normalizeYgo} from '/ygo.js';
import {openZoom,zoomCardOptions} from '/zoom.js';
const sample=await (await fetch('/test-fixtures/card-artwork-provider-samples.json')).json();
document.addEventListener('error',handleArtworkError,true);
const add=(id,html)=>{const box=document.createElement('div');box.id=id;box.innerHTML='<p>'+id+'</p>'+html;document.querySelector('#grid').append(box);};
for(const c of sample.pokemon)add(c.id,artworkHTML({game:'ptcg',id:c.id,name:c.name}));
const ygo=normalizeYgo(sample.ygo);add('ygo-alternate',variantArtThumb(ygo,ygo.artworks[1]));
const face=side=>({normal:'https://artwork-fixture.invalid/'+side+'/normal.jpg',large:'https://artwork-fixture.invalid/'+side+'/large.jpg',png:'https://artwork-fixture.invalid/'+side+'/png.png'});
const magic={id:'same-printing',card_faces:[{image_uris:face('front')},{image_uris:face('back')}]};
add('mtg-front',img(cardImage(magic,'normal',0),'Front','card-img'));
add('mtg-back',img(cardImage(magic,'normal',1),'Back','card-img'));
add('exhausted',artworkHTML({game:'ygo',id:'999999999999',name:'Missing fixture',image:'img/ygo/s/999999999999.jpg',imageLarge:'img/ygo/999999999999.jpg'}));
window.openFixtureZoom=id=>{
 const image=document.querySelector('#'+id+' img'),sources=JSON.parse(image.dataset.artSources);
 const target={dataset:{src:sources[0],fallback:sources[1]||'',name:id,hi:id==='ygo-alternate'?'https://images.ygoprodeck.com/images/cards/46986415.jpg':id.startsWith('mtg-')?'https://artwork-fixture.invalid/'+id.slice(4)+'/png.png':''},querySelector:()=>image};
 window.fixtureZoom=openZoom(zoomCardOptions(target));
};
window.fixtureReady=true;
</script>`;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(html);return;}
  if(url.pathname.startsWith('/img/ptcg/')){
   const response=await pokemonArtRoute(new Request(url),url,{waitUntil:job=>job.catch(()=>{})},fetcher);
   res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(url.pathname.startsWith('/img/')){res.writeHead(404).end();return;}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!path.startsWith(root)){res.writeHead(403).end();return;}
  const body=await readFile(path),type={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'}[extname(path)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type}).end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1200,height:900}}),requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/*',async route=>{
  const url=route.request().url();requests.push(url);
  if(url.startsWith(base))return route.continue();
  if(url==='https://images.ygoprodeck.com/images/cards_small/46986415.jpg'||/^https:\/\/artwork-fixture[.]invalid\/(front|back)\/large[.]jpg$/.test(url))return route.fulfill({contentType:'image/svg+xml',body:svg});
  return route.fulfill({status:404,body:'Not available in fixture'});
 });
 await page.goto(base);await page.waitForFunction(()=>window.fixtureReady);
 for(const id of [...sample.pokemon.map(c=>c.id),'ygo-alternate','mtg-front','mtg-back']){
  await page.locator('#'+id+' img').evaluate(image=>new Promise((resolve,reject)=>{const check=()=>image.complete&&image.naturalWidth>0?resolve():setTimeout(check,30);setTimeout(()=>reject(Error('image failed: '+image.src)),10000);check();}));
  assert.equal(await page.locator('#'+id+' .img-missing').count(),0);
 }
 assert.match(await page.locator('#ygo-alternate img').getAttribute('src'),/cards_small\/46986415[.]jpg$/);
 assert.match(await page.locator('#mtg-front img').getAttribute('src'),/\/front\/large[.]jpg$/);
 assert.match(await page.locator('#mtg-back img').getAttribute('src'),/\/back\/large[.]jpg$/);
 await page.locator('#exhausted .img-missing').waitFor();
 await page.locator('#exhausted img').evaluate(image=>{for(let n=0;n<4;n++)image.dispatchEvent(new Event('error'));});
 assert.equal(await page.locator('#exhausted .img-missing').count(),1);
 assert.ok(!requests.some(url=>url.includes('/46986414.jpg')),'alternate scan never requests base card');
 assert.deepEqual(upstream.filter(url=>url.includes('/product/')).sort(),[98000,98001,98002,98003].map(id=>'https://tcgplayer-cdn.tcgplayer.com/product/'+id+'_400w.jpg'));
 for(const id of ['ygo-alternate','mtg-front','mtg-back']){
  await page.evaluate(id=>window.openFixtureZoom(id),id);
  await page.waitForFunction(()=>{const image=document.querySelector('.zoom-img');return image?.complete&&image.naturalWidth>0&&!image.hidden;});
  const src=await page.locator('.zoom-img').getAttribute('src');
  assert.match(src,id==='ygo-alternate'?/cards_small\/46986415[.]jpg$/:new RegExp('/'+id.slice(4)+'/large[.]jpg$'));
  await page.evaluate(()=>window.fixtureZoom.close());
 }
 await page.evaluate(()=>window.openFixtureZoom('exhausted'));
 await page.waitForFunction(()=>document.querySelector('.zoom-res')?.textContent==='Artwork unavailable');
 await page.locator('.zoom-img').evaluate(image=>{for(let n=0;n<4;n++)image.dispatchEvent(new Event('error'));});
 assert.ok(requests.filter(url=>url.includes('/999999999999.jpg')).length<=8,'thumbnail and zoom each try the four exact sources at most once');
 await page.evaluate(()=>window.fixtureZoom.close());
 assert.deepEqual(errors,[]);
 await mkdir(resolve(root,'test-results'),{recursive:true});
 await page.screenshot({path:resolve(root,'test-results/exact-artwork-contract.png'),fullPage:true});
 await writeFile(resolve(root,'test-results/exact-artwork-contract.json'),JSON.stringify({result:'passed',evidence:'Synthetic image pixels; actual production render helpers, image error events, and exact public source IDs.',requests,upstream},null,2));
 console.log('PASS: hosted image decoding, exact Pokémon proxy, YGO alternate-art retry, MTG same-face recovery, and bounded missing-art fallback.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
