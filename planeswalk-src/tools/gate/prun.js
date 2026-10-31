// Planeswalk design-gate runner: the auditor's run-audit.js (same sizes, APK insets, audit-dom.js),
// plus a `setup` step per route that puts the game into a given screen using its own globals.
// node run-audit-pw.js <dir-with-planeswalk.html> <out-dir> [routes.json]   (routes default to pw-routes.json beside this file)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(process.argv[2]||'.'),OUT=path.resolve(process.argv[3]||'./audit-out');fs.mkdirSync(OUT,{recursive:true});
const AUDIT=fs.readFileSync(process.env.AUDITJS||'/mnt/project-files/reviews/audit-kit/audit-dom.js','utf8');
const ROUTES=JSON.parse(fs.readFileSync(process.argv[4]||'/mnt/project-files/qa/pw-routes.json','utf8'));
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const TEXT=+(process.env.TEXT||1); // TEXT=1.3 emulates bigger phone text on the touch sizes
const SIZES=process.env.SIZES?JSON.parse(process.env.SIZES):[['360',360,780,true],['390',390,844,true],['fold',884,1104,true],['land',844,390,true],['tablet',1024,768,false],['1366',1366,800,false],['1440',1440,900,false]];
// ORIENT=land mirrors the auditor's landscape gate (run-audit.js 30 Oct 21:49Z): same sizes, INSETS="top,right,bottom,left" or a preset name
const LAND_SIZES=[['l740',740,360,true],['l780',780,360,true],['l932',932,430,true],['l844',844,390,true],['l766',766,683,true],['lfold',1104,884,true],['ltablet',1024,768,true],['l1366',1366,800,false],['l1440',1440,900,false],['l1780',1780,920,false]];
const LAND=process.env.ORIENT==='land';const SIZES2=process.env.SIZES?SIZES:(LAND?LAND_SIZES:SIZES);
const PRESET={game:'0,48,0,48',app:'32,48,24,48','game-left':'0,0,0,32','game-right':'0,32,0,0','app-gesture':'24,0,24,32','app-3btn':'24,48,0,32'};
const INS=(PRESET[process.env.INSETS]||process.env.INSETS||(LAND?'0,48,0,48':'48,0,34,0')).split(',').map(Number);
const PRE=`window.__pw={
 run(h='R'){try{localStorage.setItem('pw-coach-drag','1')}catch(e){};newRun(4242,h);run.startPick=null;view='map';reward=null;c=null;render()},
 node(t,h){for(let s=4242;s<4342;s++){newRun(s,h||'R');run.startPick=null;view='map';reward=null;c=null;render();const n=[...document.querySelectorAll('.map .node')].find(n=>n.dataset.t===t);if(n){const r=+n.dataset.r,l=+n.dataset.l;if(r>0){const pl=run.map[r-1].findIndex((x,i)=>x&&linked(r-1,i,l));if(pl<0)continue;run.pos={r:r-1,l:pl}}enter(r,l);if(view!=='map')return true}}return false},
 fight(keys,h){this.run(h);startFight(keys||['diregraf','geist'],'fight',0);render()},
 ctx(sel){const el=document.querySelector(sel);const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))}};`;
(async()=>{const b=await chromium.launch();const report={};const only=process.env.ONLY?new RegExp(process.env.ONLY):null;
for(const [tag,w,h,touch] of SIZES2){const [safeTop,safeR,safeBot,safeL]=touch?INS:[0,0,0,0];
 const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:touch,isMobile:touch,deviceScaleFactor:touch?2:1,serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname==='app.local'){const p=decodeURIComponent(u.pathname);const f=path.join(ROOT,p);try{let body=fs.readFileSync(f);if(/\.(html|css)$/.test(p)&&touch)body=Buffer.from(body.toString().replace(/env\(safe-area-inset-top(?:,\s*[^)]*)?\)/g,safeTop+'px').replace(/env\(safe-area-inset-bottom(?:,\s*[^)]*)?\)/g,safeBot+'px').replace(/env\(safe-area-inset-right(?:,\s*[^)]*)?\)/g,safeR+'px').replace(/env\(safe-area-inset-left(?:,\s*[^)]*)?\)/g,safeL+'px'));return r.fulfill({body,contentType:MIME[path.extname(f)]||'application/octet-stream'})}catch{return r.fulfill({status:404,body:''})}}return r.abort()});
 for(const rt of ROUTES){if(only&&!only.test(rt.id))continue;const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message.slice(0,100)));
  try{await page.addInitScript(()=>{try{localStorage.clear();localStorage.setItem('pw-coach-drag','1')}catch(e){}});
   await page.goto('http://app.local/planeswalk.html',{waitUntil:'load',timeout:20000});await page.waitForTimeout(600);
   if(rt.setup){const ok=await page.evaluate(`(()=>{${PRE}${rt.setup}})()`);if(ok===false){report[`${rt.id}@${tag}`]=[{rule:'route-missing',setup:rt.setup.slice(0,60)}];await page.close();continue}await page.waitForTimeout(rt.wait||500);if(rt.after){await page.evaluate(`(()=>{${rt.after}})()`);await page.waitForTimeout(400)}}
   if(TEXT!==1&&touch&&!rt.ingameText)await page.evaluate(k=>{const els=[...document.querySelectorAll('body *')];const fs=els.map(e=>parseFloat(getComputedStyle(e).fontSize));els.forEach((e,i)=>e.style.setProperty('font-size',fs[i]*k+'px','important'))},TEXT),await page.waitForTimeout(100);
   await page.evaluate(([t,bt])=>{document.documentElement.dataset.auditSafeTop=t;document.documentElement.dataset.auditSafeBottom=bt},[safeTop,safeBot]);
   if(!process.env.NOSHOT)await page.screenshot({path:path.join(OUT,`${rt.id}-${tag}.png`)});
   const f=await page.evaluate(AUDIT);if(await page.evaluate(()=>(document.body&&document.body.innerText||'').trim().length<20))f.push({rule:'route-empty'});if(errs.length)f.push({rule:'page-error',errors:[...new Set(errs)].slice(0,3)});report[`${rt.id}@${tag}`]=f;
   console.log(rt.id,tag,f.length?f.length+' findings':'clean')}
  catch(e){report[`${rt.id}@${tag}`]=[{rule:'error',msg:e.message.slice(0,160)}];console.log('ERR',rt.id,tag,e.message.slice(0,120))}
  await page.close()}
 await ctx.close()}
fs.writeFileSync(path.join(OUT,'findings.json'),JSON.stringify(report,null,1));
const total=Object.values(report).reduce((n,f)=>n+f.length,0);console.log('TOTAL findings',total,'->',total?'FAIL':'PASS');await b.close()})();
