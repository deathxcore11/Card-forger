// Hosted pixel regression: the lit hot-stamped name replaces the title-band placeholder on
// the detail surface, paints only the name bar, follows the light, and keeps the art foil.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {YGO_NAME_BOX} from '../ygo-name-foil.js';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is hosted-only.');
const {chromium}=await import('playwright'),root=resolve('.'),out='test-results/ygo-name-foil';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)){res.writeHead(403);return res.end();}const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const CASES={'ygo-abyss-ultra':{name:true,art:true},'ygo-omega-secret':{name:true,art:true},'ygo-gamma-rare':{name:true,art:false},'ygo-gamma-super':{name:false,art:true}};
const browser=await chromium.launch(),report={status:'FAIL',cases:[],limits:'Hosted Chromium, retained YGOPRODeck renders; approximate simulation, not physical foil or phone-hardware proof.'};
try{
 const context=await browser.newContext({viewport:{width:1000,height:1100},deviceScaleFactor:1});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const [key,spec] of Object.entries(CASES)){
  await page.goto(base+'/tests/finish-materials.html#'+key);await page.waitForFunction(k=>document.documentElement.dataset.case===k,key);
  await page.waitForFunction(()=>document.querySelector('.card img')?.naturalWidth>0);await page.locator('.finish-overlay').waitFor();
  const card=page.locator('.card');
  // Art foil is unchanged by this work.
  assert.equal(await card.locator('.finish-layer:not(.finish-name-region)').count()>0,spec.art,key+': art foil layer kept');
  if(!spec.name){assert.equal(await card.locator('.finish-name-foil').count(),0,key+': no name foil without a name-foil rarity');report.cases.push({key,name:false});continue;}
  const canvas=card.locator('canvas.finish-name-foil');await canvas.waitFor();
  assert.equal(await card.locator('.finish-name-region.finish-title-glyphs').count()>0,true,key+': placeholder band replaced by letter-shaped mask');
  const geo=await card.evaluate((n,box)=>{const i=n.querySelector('img').getBoundingClientRect(),c=n.querySelector('canvas.finish-name-foil').getBoundingClientRect();return {img:{x:i.x,y:i.y,w:i.width,h:i.height},canvas:{x:c.x,y:c.y,w:c.width,h:c.height},expect:{x:i.x+box[0]*i.width,y:i.y+box[1]*i.height,w:(box[2]-box[0])*i.width,h:(box[3]-box[1])*i.height}};},YGO_NAME_BOX);
  for(const k of ['x','y','w','h'])assert(Math.abs(geo.canvas[k]-geo.expect[k])<1,`${key}: canvas sits on the name bar (${k})`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({path:`${out}/${key}-complete.png`,animations:'disabled'});
  const clip={x:geo.img.x,y:geo.img.y,width:geo.img.w,height:geo.img.h};
  // Keep the WebGL surface composited in both captures. Visibility toggles can
  // re-rasterize the underlying scaled card and create unrelated seam pixels.
  // Clear/redraw its existing shader instead; the real art foil stays visible.
  const shot=async(visible,mx)=>{
   await page.evaluate(async([visible,mx])=>{
    document.querySelector('.card').style.setProperty('--mx',mx);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const gl=document.querySelector('canvas.finish-name-foil').getContext('webgl');
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    if(visible)gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    gl.finish();
   },[visible,mx]);
   return page.screenshot({clip,animations:'disabled'});
  };
  // Same light position for with/without, so only the lit name can differ; then move the light.
  await shot(true,'15%');
  const without=await shot(false,'15%'),left=await shot(true,'15%'),right=await shot(true,'85%');
  await writeFile(`${out}/${key}-without.png`,without);await writeFile(`${out}/${key}-left.png`,left);await writeFile(`${out}/${key}-right.png`,right);
  const stats=await page.evaluate(async({a,b,c,box})=>{
   const read=async s=>{const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();const k=document.createElement('canvas');k.width=i.width;k.height=i.height;const x=k.getContext('2d');x.drawImage(i,0,0);return {w:k.width,h:k.height,d:x.getImageData(0,0,k.width,k.height).data};};
   const A=await read(a),B=await read(b),C=await read(c),inBox=(i,j)=>i>=box[0]*A.w-1&&i<=box[2]*A.w+1&&j>=box[1]*A.h-1&&j<=box[3]*A.h+1;
   let outside=0,boxPx=0,painted=0,moved=0;
   for(let j=0;j<A.h;j++)for(let i=0;i<A.w;i++){const k=(j*A.w+i)*4,d=(X,Y)=>Math.abs(X.d[k]-Y.d[k])+Math.abs(X.d[k+1]-Y.d[k+1])+Math.abs(X.d[k+2]-Y.d[k+2]);
    if(inBox(i,j)){boxPx++;if(d(A,B)>12)painted++;if(d(B,C)>12)moved++;}else if(d(A,B)>3)outside++;}
   return {outside,painted:painted/boxPx,moved:moved/boxPx};
  },{a:without.toString('base64'),b:left.toString('base64'),c:right.toString('base64'),box:YGO_NAME_BOX});
  // Only letters are painted: a share of the bar, never the whole band and nothing outside it.
  assert.equal(stats.outside,0,`${key}: nothing outside the name bar changes ${JSON.stringify(stats)}`);
  assert(stats.painted>.08&&stats.painted<.6,`${key}: letters painted, bar background clear ${JSON.stringify(stats)}`);
  assert(stats.moved>.03,`${key}: glints move with the light ${JSON.stringify(stats)}`);
  report.cases.push({key,name:true,...stats});
 }
 // Reduced motion removes every finish overlay, including the lit name.
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.finish-overlay')&&!document.querySelector('.finish-name-foil'));
 assert.deepEqual(errors,[]);report.status='PASS';
 console.log('PASS: lit hot-stamped names replace the title band on Ultra, Secret and Rare detail surfaces, paint only the letters, follow the light and keep the art foil.');
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
