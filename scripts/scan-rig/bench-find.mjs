// Scores the card finder alone against the true corners in a photo set (run to_raw.py first).
//   node scripts/scan-rig/bench-find.mjs /tmp/scan-set2 [--level]
// A find counts when every corner is within 4% of the card's height of the truth.
import {readFileSync} from 'node:fs';import {join} from 'node:path';
import {detectCardQuad} from '../../scan-vision.js';
import {levelFrame} from '../../scan-light.js';
import {luma,snapQuad} from '../../scan-find.js';
const snap=process.argv.includes('--snap');
const set=process.argv[2],level=process.argv.includes('--level');
export function shrink(rgba,w,h,ow,oh){ // box filter
 const out=new Uint8ClampedArray(ow*oh*4),sx=w/ow,sy=h/oh;
 for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){let r=0,g=0,b=0,n=0;
  for(let yy=Math.floor(y*sy);yy<Math.floor((y+1)*sy);yy++)for(let xx=Math.floor(x*sx);xx<Math.floor((x+1)*sx);xx++){const i=(yy*w+xx)*4;r+=rgba[i];g+=rgba[i+1];b+=rgba[i+2];n++;}
  const o=(y*ow+x)*4;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n;out[o+3]=255;}
 return out;}
const tally={};let tight=0;
for(const g of ['mtg','ptcg','ygo']){
 for(const L of JSON.parse(readFileSync(join(set,g,'labels.json'),'utf8'))){
  const rgba=new Uint8ClampedArray(readFileSync(join(set,g,L.file+'.rgba'))),aw=192,ah=256;
  let small=shrink(rgba,L.w,L.h,aw,ah);if(level)small=levelFrame(small,aw,ah);
  const t0=performance.now(),found=detectCardQuad(small,aw,ah),ms=performance.now()-t0;
  let snapped=false;
  if(snap&&found?.quad){const mw=540,mh=720;let mid=shrink(rgba,L.w,L.h,mw,mh);if(level)mid=levelFrame(mid,mw,mh);
   const t1=performance.now(),r=snapQuad(luma(mid,mw,mh),mw,mh,found.quad.map(p=>({x:p.x*mw/aw,y:p.y*mh/ah})));tally.snapMs=(tally.snapMs||0)+performance.now()-t1;
   if(r){found.quad=r.quad.map(p=>({x:p.x*aw/mw,y:p.y*ah/mh}));snapped=true;}}
  const truth=L.quad.map(([x,y])=>({x:x*aw/L.w,y:y*ah/L.h})),height=Math.hypot(truth[3].x-truth[0].x,truth[3].y-truth[0].y);
  let ok=false,err=null;
  if(found?.quad){err=Math.max(...truth.map((t,i)=>Math.hypot(found.quad[i].x-t.x,found.quad[i].y-t.y)))/height;ok=err<.04;tight+=err<.015;}
  if(process.argv.includes('--errs'))console.log(g,L.light,found?.quad?err.toFixed(3):'none',found?.source||'',L.name);
  for(const k of ['all',g,L.light]){const t=tally[k]||={n:0,ok:0,none:0,ms:0};t.n++;t.ok+=ok;t.none+=!found?.quad;t.ms+=ms;}
 }
}
delete tally.snapMs;
for(const [k,t] of Object.entries(tally))console.log(`${k.padEnd(6)} n=${String(t.n).padStart(3)}  found right ${String(Math.round(100*t.ok/t.n)).padStart(3)}%  nothing found ${String(Math.round(100*t.none/t.n)).padStart(3)}%  ${(t.ms/t.n).toFixed(1)} ms`);

console.log('within 1.5% of card height:',tight);
