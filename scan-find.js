// Finding the card's exact outline. scan-vision.js proposes a rough four-corner shape on a small
// frame; this module snaps each side onto the card's real edge on a larger frame, so the name
// strip and the tiny bottom line land where the readers expect them. Pure pixel maths, no DOM.

import {detectCardQuad,warpPixels} from './scan-vision.js';
import {levelFrame} from './scan-light.js';

// A smaller copy of an RGBA frame (box filter: every source pixel counts once, so grain averages out).
export function boxShrink(rgba,w,h,ow,oh){
 const out=new Uint8ClampedArray(ow*oh*4),sx=w/ow,sy=h/oh;
 for(let y=0;y<oh;y++){
  const y0=Math.floor(y*sy),y1=Math.max(y0+1,Math.floor((y+1)*sy));
  for(let x=0;x<ow;x++){
   const x0=Math.floor(x*sx),x1=Math.max(x0+1,Math.floor((x+1)*sx));let r=0,g=0,b=0,n=0;
   for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*w+xx)*4;r+=rgba[i];g+=rgba[i+1];b+=rgba[i+2];n++;}
   const o=(y*ow+x)*4;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n;out[o+3]=255;
  }
 }
 return out;
}
// Grey (0-255) copy of an RGBA frame.
export function luma(rgba,w,h){
 const out=new Float32Array(w*h);
 for(let i=0,j=0;i<out.length;i++,j+=4)out[i]=.299*rgba[j]+.587*rgba[j+1]+.114*rgba[j+2];
 return out;
}
const sample=(g,w,h,x,y)=>{
 x=x<0?0:x>w-1.001?w-1.001:x;y=y<0?0:y>h-1.001?h-1.001:y;
 const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,i=y0*w+x0;
 return g[i]*(1-fx)*(1-fy)+g[i+1]*fx*(1-fy)+g[i+w]*(1-fx)*fy+g[i+w+1]*fx*fy;
};
// A line through points, tolerant of points that sit on something else (a finger, a second card):
// the pair of points most others agree with, then a least-squares fit to those that agree.
function fitLine(points,tolerance){
 const n=points.length;if(n<6)return null;
 let best=null,bestCount=0;
 for(let a=0;a<n;a+=2)for(let b=a+Math.max(3,n>>2);b<n;b+=2){
  const p=points[a],q=points[b],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);if(len<1e-6)continue;
  let count=0;for(const r of points)if(Math.abs((r.x-p.x)*dy-(r.y-p.y)*dx)/len<=tolerance)count++;
  if(count>bestCount){bestCount=count;best=[p,dx/len,dy/len];}
 }
 if(!best||bestCount<Math.max(6,n*.4))return null;
 const [p,ux,uy]=best,inliers=points.filter(r=>Math.abs((r.x-p.x)*uy-(r.y-p.y)*ux)<=tolerance);
 let mx=0,my=0;for(const r of inliers){mx+=r.x;my+=r.y;}mx/=inliers.length;my/=inliers.length;
 let sxx=0,sxy=0,syy=0;for(const r of inliers){const x=r.x-mx,y=r.y-my;sxx+=x*x;sxy+=x*y;syy+=y*y;}
 const angle=.5*Math.atan2(2*sxy,sxx-syy);
 return {x:mx,y:my,dx:Math.cos(angle),dy:Math.sin(angle),support:inliers.length/n};
}
const meet=(a,b)=>{
 const den=a.dx*b.dy-a.dy*b.dx;if(Math.abs(den)<1e-6)return null;
 const t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/den;return {x:a.x+a.dx*t,y:a.y+a.dy*t};
};
// One pass: along each side, walk across the edge from outside to inside and take the first strong
// change in brightness: the card's own rim, not the printed frame a little further in and not a
// soft shadow further out.
function snapOnce(grey,w,h,quad,reach,points){
 const side=(i)=>Math.hypot(quad[(i+1)%4].x-quad[i].x,quad[(i+1)%4].y-quad[i].y);
 const size=(side(0)+side(1)+side(2)+side(3))/4,R=Math.max(4,Math.round(size*reach));
 const cx=(quad[0].x+quad[1].x+quad[2].x+quad[3].x)/4,cy=(quad[0].y+quad[1].y+quad[2].y+quad[3].y)/4;
 const lines=[];
 for(let i=0;i<4;i++){
  const a=quad[i],b=quad[(i+1)%4],ex=b.x-a.x,ey=b.y-a.y,len=Math.hypot(ex,ey)||1;
  let nx=-ey/len,ny=ex/len; // normal, turned to point into the card
  if((cx-a.x)*nx+(cy-a.y)*ny<0){nx=-nx;ny=-ny;}
  const tx=ex/len,ty=ey/len,hits=[];
  for(let k=0;k<points;k++){
   const t=.1+.8*k/(points-1),px=a.x+ex*t,py=a.y+ey*t,g=new Float32Array(2*R+1);let peak=0;
   for(let s=-R;s<=R;s++){
    // Brightness change across the edge, averaged over three neighbours along it (less grain).
    let v=0;for(const o of [-3,-1.5,0,1.5,3]){const qx=px+tx*o,qy=py+ty*o;v+=sample(grey,w,h,qx+nx*(s+1.5),qy+ny*(s+1.5))-sample(grey,w,h,qx+nx*(s-1.5),qy+ny*(s-1.5));}
    g[s+R]=Math.abs(v)/5;if(g[s+R]>peak)peak=g[s+R];
   }
   if(peak<6)continue;
   // "Strong" is judged against this spot's own grain (the middle value of the profile), so a
   // dim, noisy frame does not trigger on noise and a bright printed frame inside the card
   // does not hide a fainter rim.
   const floor=Float32Array.from(g).sort()[R],need=Math.max(10,peak*.25,floor*3.5);
   for(let s=-R;s<=R;s++)if(g[s+R]>=need){
    // The local top of this first strong rise.
    let m=s;while(m<R&&g[m+1+R]>g[m+R])m++;
    hits.push({x:px+nx*m,y:py+ny*m});break;
   }
  }
  const line=fitLine(hits,Math.max(1.2,size*.006));if(!line)return null;
  lines.push(line);
 }
 const out=[meet(lines[3],lines[0]),meet(lines[0],lines[1]),meet(lines[1],lines[2]),meet(lines[2],lines[3])];
 if(out.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 // A snap that moved a corner far is a different object, not a correction.
 if(out.some((p,i)=>Math.hypot(p.x-quad[i].x,p.y-quad[i].y)>R*2.2))return null;
 return {quad:out,support:Math.min(...lines.map(l=>l.support))};
}
// Snaps a rough quad (corners clockwise from top-left, in this frame's pixels) to the card's edges.
// Three passes, each looking less far: the first reaches well outside a rough guess that is turned
// or too small, the last settles the line to a fraction of a pixel. Returns {quad, support}
// (support: the weakest side's share of points that lie on its line), or null when a side has no
// clear edge; callers then keep the rough quad.
export function snapQuad(grey,w,h,quad,{reaches=[.13,.05,.022],points=44}={}){
 let cur={quad,support:0};
 for(let i=0;i<reaches.length;i++){
  const next=snapOnce(grey,w,h,cur.quad,reaches[i],points);
  if(!next){if(i===0)return null;break;}
  cur=next;
 }
 return cur;
}
// The whole find, for one camera frame or photo of any size: level the light, propose a rough
// outline on a small copy, snap it to the card's rim on a medium copy. Returns
// {quad (corners clockwise from top-left, in the source frame's pixels), snapped, support} or null
// when nothing card-shaped is in view.
export function locateCard(rgba,w,h){
 const aw=192,ah=Math.max(20,Math.round(192*h/w)),small=levelFrame(boxShrink(rgba,w,h,aw,ah),aw,ah),rough=detectCardQuad(small,aw,ah);
 if(!rough?.quad)return null;
 const mw=Math.min(w,540),mh=Math.round(mw*h/w),mid=mw===w?levelFrame(rgba,w,h):levelFrame(boxShrink(rgba,w,h,mw,mh),mw,mh);
 const snap=snapQuad(luma(mid,mw,mh),mw,mh,rough.quad.map(p=>({x:p.x*mw/aw,y:p.y*mh/ah})));
 const quad=snap?snap.quad.map(p=>({x:p.x*w/mw,y:p.y*h/mh})):rough.quad.map(p=>({x:p.x*w/aw,y:p.y*h/ah}));
 return {quad,snapped:!!snap,support:snap?snap.support:0};
}
// The card cut out of the frame and laid flat and upright, as RGBA (outW x outH).
// scale > 1 takes a slightly larger outline and < 1 a tighter one, about the card's centre.
export function flattenCard(rgba,w,h,quad,outW=252,outH=352,scale=1){
 const cx=(quad[0].x+quad[1].x+quad[2].x+quad[3].x)/4,cy=(quad[0].y+quad[1].y+quad[2].y+quad[3].y)/4;
 return warpPixels(rgba,w,h,scale===1?quad:quad.map(p=>({x:cx+(p.x-cx)*scale,y:cy+(p.y-cy)*scale})),outW,outH);
}
