// Read-only browser inspection. Never assigns scroll, changes DOM or fetches art.
import assert from 'node:assert/strict';
import {assertLayout,boundedTimeout} from './acceptance-contract.mjs';
// Passed by value to browser execution; every helper is self-contained.
export function inspectVisiblePage(){
 const root=document.querySelector('.play-match-table');if(!root)return null;
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 const probe=e=>{
  if(!e)return {visible:false,opacity:0,areaRatio:0,hits:0};
  const r=e.getBoundingClientRect();let left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom),opacity=1;
  for(let p=e;p;p=p.parentElement){
   const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse')return {visible:false,opacity:0,areaRatio:0,hits:0};
   opacity*=Number(s.opacity);if(p!==e){const b=p.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(s.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}if(/hidden|auto|scroll|clip/.test(s.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}}
  }
  const width=Math.max(0,right-left),height=Math.max(0,bottom-top),areaRatio=r.width*r.height>0?width*height/(r.width*r.height):0;
  let hits=0;if(width>0&&height>0&&opacity>=.5)for(const [x,y]of [[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75]]){const h=document.elementFromPoint(left+width*x,top+height*y);if(h===e||e.contains(h))hits++;}
  return {visible:width>0&&height>0&&opacity>=.5,opacity,areaRatio,hits};
 };
 const visible=e=>probe(e).visible;
 const images=[...root.querySelectorAll('img')].filter(visible),cards=[...root.querySelectorAll('.play-match-card')].filter(visible);
 const imagesReady=images.length>0&&images.every(i=>i.complete&&i.naturalWidth>0)&&cards.every(c=>c.querySelector('img')||c.querySelector('.play-match-card-back')?.textContent==='Face down');
 const targets={hand:root.querySelector('.play-match-hand-area'),you:root.querySelector('.play-match-seat[data-seat="you"]'),cpu:root.querySelector('.play-match-seat[data-seat="cpu"]'),dock:root.querySelector('.play-match-decisions')};
 const controls=[...root.querySelectorAll('[data-native-key="mode-smart"],[data-native-key="mode-full"],[data-native-key="ok"],[data-native-key="cancel"]')].filter(visible).map(e=>{const r=rect(e),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {...r,receivesPointer:(h===e||e.contains(h))&&probe(e).areaRatio>.98};});
 return {imagesReady,metrics:{width:innerWidth,height:innerHeight,...Object.fromEntries(Object.entries(targets).map(([k,e])=>[k,rect(e)])),exposure:Object.fromEntries(Object.entries(targets).map(([k,e])=>[k,probe(e)])),lifeVisible:['you','cpu'].map(k=>{const p=probe(targets[k]?.querySelector('.play-match-life'));return p.visible&&p.areaRatio>.98&&p.hits>0;}),compact:root.querySelector('[data-native-panel]')?.dataset.compactStatus==='true',controls,visibleHandCards:[...root.querySelectorAll('.play-match-hand .play-match-card')].filter(e=>{const p=probe(e);return p.visible&&p.hits>0;}).length,imageCount:images.length,imagesReady:images.filter(i=>i.complete&&i.naturalWidth>0).length}};
}
export async function waitVisibleCardImages(page,deadline){
 const end=Date.now()+boundedTimeout(20000,deadline);
 while(Date.now()<end){const data=await page.evaluate(inspectVisiblePage);boundedTimeout(1,end);if(data?.imagesReady){await page.waitForFunction(()=>document.fonts.status==='loaded',null,{timeout:boundedTimeout(5000,end)});boundedTimeout(1,end);return;}await new Promise(r=>setTimeout(r,100));}
 throw Error('Visible card artwork not ready within image deadline');
}
export async function visualCheckpoint(page,{touch,deadline,stage}){
 await waitVisibleCardImages(page,deadline);const data=await page.evaluate(inspectVisiblePage);boundedTimeout(1,deadline);
 assert(data?.imagesReady,'Visible image readiness changed before geometry capture');const metrics=data.metrics;
 assertLayout(metrics,{touch});assert.equal(metrics.imageCount,metrics.imagesReady);
 // Metadata only: no image URLs, card names, raw DOM or private snapshots.
 return {stage,...metrics};
}
