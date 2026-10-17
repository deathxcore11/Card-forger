// Bounded on-device geometry: downscaled contour candidates, convex quads, then
// a projective warp only for a chosen frame. No image upload or CV runtime download.
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function convexHull(points){
 const p=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);if(p.length<4)return [];
 const lower=[],upper=[];for(const a of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),a)<=0)lower.pop();lower.push(a);}for(const a of p.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),a)<=0)upper.pop();upper.push(a);}return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
export const quadArea=q=>Math.abs(q.reduce((s,a,i)=>s+a.x*q[(i+1)%q.length].y-a.y*q[(i+1)%q.length].x,0))/2;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function normalizeQuad(points){
 if(points.length!==4)return null;
 const q=[...points],first=q.reduce((best,p,i)=>p.x+p.y<q[best].x+q[best].y?i:best,0);let a=[...q.slice(first),...q.slice(0,first)];
 if(cross(a[0],a[1],a[2])<0)a=[a[0],a[3],a[2],a[1]];
 if((dist(a[0],a[1])+dist(a[2],a[3]))>(dist(a[1],a[2])+dist(a[3],a[0])))a=[a[1],a[2],a[3],a[0]];
 return a;
}
function hullQuad(points){
 const hull=convexHull(points);if(hull.length<4)return null;
 while(hull.length>4){let at=0,loss=Infinity;for(let i=0;i<hull.length;i++){const n=Math.abs(cross(hull[(i+hull.length-1)%hull.length],hull[i],hull[(i+1)%hull.length]));if(n<loss){loss=n;at=i;}}hull.splice(at,1);}
 return normalizeQuad(hull);
}
function components(mask,w,h){
 const seen=new Uint8Array(mask.length),out=[],queue=new Int32Array(mask.length);
 for(let start=0;start<mask.length;start++){
  if(!mask[start]||seen[start])continue;let head=0,tail=1;queue[0]=start;seen[start]=1;const boundary=[];
  while(head<tail){const pos=queue[head++],x=pos%w,y=Math.floor(pos/w);let edge=false;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h){edge=true;continue;}const k=yy*w+xx;if(!mask[k])edge=true;else if(!seen[k]){seen[k]=1;queue[tail++]=k;}}
   if(edge)boundary.push({x,y});
  }
  if(tail>w*h*.018&&boundary.length>=12)out.push({points:boundary,count:tail});
 }
 return out.sort((a,b)=>b.count-a.count).slice(0,8);
}
export function detectCardQuad(rgba,w,h){
 if(w<20||h<20||rgba.length!==w*h*4)return null;
 const gray=new Float32Array(w*h),border=[[],[],[]];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;gray[y*w+x]=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];if((x<3||y<3||x>w-4||y>h-4)&&(x+y)%3===0)for(let c=0;c<3;c++)border[c].push(rgba[i+c]);}
 const bg=border.map(a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]),contrast=new Uint8Array(w*h),edge=new Uint8Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x,i=p*4;contrast[p]=Math.abs(rgba[i]-bg[0])+Math.abs(rgba[i+1]-bg[1])+Math.abs(rgba[i+2]-bg[2])>55?1:0;const grad=Math.hypot(gray[p+1]-gray[p-1],gray[p+w]-gray[p-w]);if(grad>18)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)edge[p+dy*w+dx]=1;}
 let best=null;
 for(const component of [...components(contrast,w,h),...components(edge,w,h)]){
  const q=hullQuad(component.points);if(!q)continue;const area=quadArea(q),fraction=area/(w*h),width=(dist(q[0],q[1])+dist(q[2],q[3]))/2,height=(dist(q[1],q[2])+dist(q[3],q[0]))/2,ratio=width/height;
  if(fraction<.06||fraction>.94||ratio<.43||ratio>.94||Math.min(width,height)<24)continue;
  if(q.some((b,i)=>{const a=q[(i+3)%4],c=q[(i+1)%4];return Math.abs(((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))/(dist(a,b)*dist(c,b)))>.76;}))continue;
  const score=fraction*(1-Math.abs(ratio-63/88)*.6);if(!best||score>best.score)best={quad:q,score,fraction};
 }
 return best;
}
// Unit-square coordinates -> source quadrilateral, including perspective skew.
export function quadPoint(q,u,v){
 const [a,b,c,d]=q,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y,den=dx1*dy2-dx2*dy1;
 const g=Math.abs(den)>1e-8?(dx3*dy2-dx2*dy3)/den:0,h=Math.abs(den)>1e-8?(dx1*dy3-dx3*dy1)/den:0,z=g*u+h*v+1;
 return {x:((b.x-a.x+g*b.x)*u+(d.x-a.x+h*d.x)*v+a.x)/z,y:((b.y-a.y+g*b.y)*u+(d.y-a.y+h*d.y)*v+a.y)/z};
}
export function warpPixels(source,w,h,q,outW=400,outH=560){
 const out=new Uint8ClampedArray(outW*outH*4);
 for(let y=0;y<outH;y++)for(let x=0;x<outW;x++){
  const p=quadPoint(q,x/(outW-1),y/(outH-1)),xx=Math.max(0,Math.min(w-1,p.x)),yy=Math.max(0,Math.min(h-1,p.y)),x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=xx-x0,fy=yy-y0,i=(y*outW+x)*4;
  for(let c=0;c<3;c++)out[i+c]=source[(y0*w+x0)*4+c]*(1-fx)*(1-fy)+source[(y0*w+x1)*4+c]*fx*(1-fy)+source[(y1*w+x0)*4+c]*(1-fx)*fy+source[(y1*w+x1)*4+c]*fx*fy;out[i+3]=255;
 }
 return out;
}
export function normalizedQuality(data,w,h){
 const gray=new Float32Array(w*h);let bright=0,hot=0,n=0,sum=0,sq=0;
 for(let i=0;i<gray.length;i++){const j=i*4;gray[i]=.299*data[j]+.587*data[j+1]+.114*data[j+2];bright+=gray[i];if(gray[i]>250)hot++;}
 // Text bands, not sharp artwork or a textured table, determine whether to run OCR.
 for(let y=2;y<h-2;y++){if(y>h*.19&&y<h*.84)continue;for(let x=2;x<w-2;x++){const i=y*w+x,lap=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-w]-gray[i+w];sum+=lap;sq+=lap*lap;n++;}}
 return {sharp:sq/Math.max(1,n)-(sum/Math.max(1,n))**2,bright:bright/gray.length,glare:hot/gray.length,gray};
}
