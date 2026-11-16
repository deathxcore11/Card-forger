// The live camera's card outline, on the owner's real photos (test-fixtures/scan-real) fed in as the camera:
// the outline appears, sits on the edge the scanner's own finder gives for that frame, and is gone with no card.
// Run: node tests/scanner-outline-browser.mjs   (pictures land in test-results/outline-*.png)
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
const root=process.cwd(),photos=(process.env.OUTLINE_PHOTOS||'ygo/kirin,ygo/twin2,ygo/droll,ygo/twin,ptcg/vulpix').split(',');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
 let body=await readFile(file);if(file.endsWith('/config.js'))body=Buffer.from(body.toString().replace(/key:\s*"[^"]*"/,'key: ""'));res.end(body);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
await mkdir('test-results',{recursive:true});
const results=[];
try{
 for(const photo of photos){
  const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage();page.setDefaultTimeout(20000);
  // The camera: a canvas stream showing the photo (or nothing but a plain table when window.__noCard).
  await page.addInitScript(src=>{
   const c=document.createElement('canvas'),img=new Image();img.src=src;
   img.onload=()=>{c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');let n=0;
    setInterval(()=>{if(window.__noCard){x.fillStyle='#5a5348';x.fillRect(0,0,c.width,c.height);}else x.drawImage(img,0,0);x.fillStyle=`rgb(${n++%2},0,0)`;x.fillRect(0,0,1,1);},60);};
   const stream=()=>c.captureStream(15);
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>stream(),enumerateDevices:async()=>[{kind:'videoinput',deviceId:'',label:'Back camera'}]}});
  },'/test-fixtures/scan-real/'+photo+'.jpg');
  await page.goto(base+'/#scan');await page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
  const skip=page.getByRole('button',{name:'Skip',exact:true});try{await skip.waitFor({state:'visible',timeout:2000});await skip.click();}catch{}
  await page.locator('[data-act="scanStart"]').first().click();
  await page.locator('#scanVideo').waitFor();
  let seen=true;try{await page.locator('#camOutline.is-on').waitFor({timeout:12000});}catch{seen=false;}
  if(seen)await page.screenshot({path:`test-results/outline-${photo.replace('/','-')}.png`});
  const got=await page.evaluate(async src=>{
   const {locateCard}=await import('/scan-find.js'),{outlinePoints,freezeCapture}=await import('/scancam.js');
   const v=document.getElementById('scanVideo'),el=document.getElementById('camOutline'),frame=freezeCapture(v).original;
   const hit=locateCard(frame.getContext('2d').getImageData(0,0,frame.width,frame.height).data,frame.width,frame.height);
   const want=hit?.snapped?outlinePoints(hit.quad.map(p=>({x:p.x/frame.width,y:p.y/frame.height})),v.videoWidth,v.videoHeight,v.clientWidth,v.clientHeight):'';
   const box=v.getBoundingClientRect(),svg=el.getBoundingClientRect();
   const cs=getComputedStyle(el);return {css:[cs.position,cs.zIndex,cs.opacity,getComputedStyle(v).position,getComputedStyle(v).zIndex],drawn:el.firstElementChild.getAttribute('points'),tone:el.getAttribute('class'),want,box:[box.width,box.height],svg:[svg.width,svg.height],frame:[frame.width,frame.height]};
  },photo);
  const pts=s=>s.split(' ').filter(Boolean).map(p=>p.split(',').map(Number));
  const far=got.drawn&&got.want?Math.max(...pts(got.drawn).map((p,i)=>Math.hypot(p[0]-pts(got.want)[i][0],p[1]-pts(got.want)[i][1]))):null;
  // No card: the outline goes within its keep time.
  await page.evaluate(()=>{window.__noCard=true;});
  let cleared=true;try{await page.locator('#camOutline:not(.is-on)').waitFor({timeout:6000});}catch{cleared=false;}
  results.push({photo,seen,svg:got.svg,css:got.css,far:far==null?null:+far.toFixed(1),cleared,tone:got.tone,box:got.box,frame:got.frame});
  console.log(JSON.stringify(results.at(-1)));
  await context.close();
 }
}finally{await browser.close();server.close();}
for(const r of results){
 assert.equal(r.cleared,true,r.photo+': outline goes when the card leaves');
 if(r.seen){assert(r.far!=null&&r.far<=8,r.photo+': the outline sits on the found edge (off by '+r.far+' px)');assert.equal(r.box[0]>0,true);}
}
assert(results.filter(r=>r.seen).length>=Math.ceil(results.length*.6),'the outline shows on most real photos');
console.log(`outline shown on ${results.filter(r=>r.seen).length} of ${results.length} real photos`);
