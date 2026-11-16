// The card finder's edge snap and the light levelling, on drawn frames (no camera, no network).
import assert from 'node:assert/strict';
import {luma,snapQuad} from './scan-find.js';
import {levelFrame} from './scan-light.js';
const W=360,H=480;
// A dark-rimmed card with a bright printed frame inside it, turned a little, on a mid-grey table.
function frame({gain=1,cast=[1,1,1],noise=0}={}){
 const rgba=new Uint8ClampedArray(W*H*4),a=.07,c=Math.cos(a),s=Math.sin(a),cx=180,cy=240,hw=100,hh=140;let seed=7;
 const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff-.5;};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const u=(x-cx)*c+(y-cy)*s,v=-(x-cx)*s+(y-cy)*c,inside=Math.abs(u)<=hw&&Math.abs(v)<=hh,inner=Math.abs(u)<=hw-8&&Math.abs(v)<=hh-8;
  const base=inner?230:inside?25:120,i=(y*W+x)*4;
  for(let k=0;k<3;k++)rgba[i+k]=(base+noise*rnd()*2)*gain*cast[k];rgba[i+3]=255;
 }
 const corner=(du,dv)=>({x:cx+du*hw*c-dv*hh*s,y:cy+du*hw*s+dv*hh*c});
 return {rgba,truth:[corner(-1,-1),corner(1,-1),corner(1,1),corner(-1,1)]};
}
const worst=(q,t)=>Math.max(...t.map((p,i)=>Math.hypot(q[i].x-p.x,q[i].y-p.y)));
// A rough guess: upright, too small on one side and too big on another, as the small-frame finder gives.
const rough=[{x:92,y:88},{x:286,y:96},{x:270,y:372},{x:70,y:392}];
{
 const {rgba,truth}=frame(),r=snapQuad(luma(rgba,W,H),W,H,rough);
 assert(r,'a clear card snaps');assert(worst(r.quad,truth)<1.5,`corners within 1.5 px, got ${worst(r.quad,truth).toFixed(2)}`);
 assert(r.support>.8);
}
{
 // The same card in a dim, warm room with sensor grain: levelled first, then snapped to the rim,
 // never to the brighter printed frame 8 px inside it.
 const {rgba,truth}=frame({gain:.2,cast:[1.15,1,.7],noise:6}),lev=levelFrame(rgba,W,H),r=snapQuad(luma(lev,W,H),W,H,rough);
 assert(r,'a dim card snaps after levelling');assert(worst(r.quad,truth)<2.5,`dim corners within 2.5 px, got ${worst(r.quad,truth).toFixed(2)}`);
 // Levelling removes the colour cast: the grey table comes back grey.
 const i=(10*W+10)*4;assert(Math.abs(lev[i]-lev[i+2])<12,`table is neutral after levelling (${lev[i]},${lev[i+1]},${lev[i+2]})`);
 // And uses the full range.
 let max=0;for(let k=0;k<lev.length;k+=4)max=Math.max(max,lev[k+1]);assert(max>240);
}
{
 // Nothing card-like under the guess: no snap, the caller keeps what it had.
 const flat=new Uint8ClampedArray(W*H*4).fill(128);assert.equal(snapQuad(luma(flat,W,H),W,H,rough),null);
}
console.log('PASS: edge snap (clear, dim+warm+grain, nothing there) and light levelling');
