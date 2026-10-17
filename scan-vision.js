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
// A convex hull is only a proposal. It can span unrelated texture on a playmat.
// Check a continuous colour step normal to each proposed side, not edge pixels
// somewhere inside the hull. All values are image evidence, not match confidence.
function sideEdgeSupport(rgba,w,h,a,b){
 const sample=(x,y,c)=>{x=Math.max(0,Math.min(w-1,Math.round(x)));y=Math.max(0,Math.min(h-1,Math.round(y)));return rgba[(y*w+x)*4+c];};
  const length=dist(a,b);if(!length)return 0;const nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
  const n=Math.max(20,Math.min(72,Math.round(length))),steps=[];
  let mean=[0,0,0];
  for(let j=0;j<n;j++){
   const t=.08+.84*(j+.5)/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   // Clamped image boundaries are not evidence of a complete visible card edge.
   if(x<3||y<3||x>w-4||y>h-4){steps.push(null);continue;}
   const delta=[0,1,2].map(c=>(sample(x+nx*2,y+ny*2,c)+sample(x+nx*3,y+ny*3,c)-sample(x-nx*2,y-ny*2,c)-sample(x-nx*3,y-ny*3,c))/2);
   steps.push(delta);for(let c=0;c<3;c++)mean[c]+=delta[c];
  }
  const meanLength=Math.hypot(...mean);let count=0;
  for(const d of steps){if(!d)continue;const magnitude=Math.hypot(...d);if(magnitude<30)continue;
   // Random texture reverses direction along a side; a real boundary usually does not.
   if(meanLength>0&&d.reduce((sum,v,c)=>sum+v*mean[c],0)/(magnitude*meanLength)>.35)count++;
  }
  return count/n;
}
export function quadEdgeSupport(rgba,w,h,q){
 return q.map((a,i)=>sideEdgeSupport(rgba,w,h,a,q[(i+1)%4]));
}
// Threshold masks may stop a few pixels inside a rounded/anti-aliased border.
// Move each whole line, never individual samples, to the strongest nearby step.
function refineQuadEdges(rgba,w,h,q){
 const lines=q.map((a,i)=>{
  const b=q[(i+1)%4],length=dist(a,b),nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
  let best={a,b,support:-1,offset:0};
  for(const offset of [0,-1,1,-2,2,-3,3,-4,4]){
   const aa={x:a.x+nx*offset,y:a.y+ny*offset},bb={x:b.x+nx*offset,y:b.y+ny*offset};
   const support=sideEdgeSupport(rgba,w,h,aa,bb);
   if(support>best.support)best={a:aa,b:bb,support,offset};
  }
  return best;
 });
 const hit=(l,r)=>{
  const ax=l.b.x-l.a.x,ay=l.b.y-l.a.y,bx=r.b.x-r.a.x,by=r.b.y-r.a.y,den=ax*by-ay*bx;
  if(Math.abs(den)<1e-8)return null;
  const t=((r.a.x-l.a.x)*by-(r.a.y-l.a.y)*bx)/den;return {x:l.a.x+t*ax,y:l.a.y+t*ay};
 };
 const refined=lines.map((l,i)=>hit(lines[(i+3)%4],l));
 return refined.every(p=>p&&p.x>=1&&p.y>=1&&p.x<w-1&&p.y<h-1)?refined:q;
}
function erodeMask(mask,w,h){
 const out=new Uint8Array(mask.length);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(mask[i]&&mask[i-1]&&mask[i+1]&&mask[i-w]&&mask[i+w]&&mask[i-w-1]&&mask[i-w+1]&&mask[i+w-1]&&mask[i+w+1])out[i]=1;}
 return out;
}
function luminanceSplit(gray){
 const hist=new Uint32Array(256);let sum=0;for(const v of gray){const n=Math.max(0,Math.min(255,Math.round(v)));hist[n]++;sum+=n;}
 let lower=0,weight=0,best=-1,split=128;
 for(let i=0;i<255;i++){weight+=hist[i];lower+=hist[i]*i;if(!weight||weight===gray.length)continue;const delta=lower/weight-(sum-lower)/(gray.length-weight),score=weight*(gray.length-weight)*delta*delta;if(score>best){best=score;split=i;}}
 return split;
}
export function detectCardQuad(rgba,w,h){
 if(w<20||h<20||rgba.length!==w*h*4)return null;
 const gray=new Float32Array(w*h),border=[[],[],[]];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;gray[y*w+x]=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];if((x<3||y<3||x>w-4||y>h-4)&&(x+y)%3===0)for(let c=0;c<3;c++)border[c].push(rgba[i+c]);}
 const bg=border.map(a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]),contrast=new Uint8Array(w*h),edge=new Uint8Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x,i=p*4;contrast[p]=Math.abs(rgba[i]-bg[0])+Math.abs(rgba[i+1]-bg[1])+Math.abs(rgba[i+2]-bg[2])>55?1:0;const grad=Math.hypot(gray[p+1]-gray[p-1],gray[p+w]-gray[p-w]);if(grad>18)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)edge[p+dy*w+dx]=1;}
 let best=null;
 const contains=(outer,inner)=>inner.every(p=>outer.every((a,i)=>cross(a,outer[(i+1)%4],p)>=-2));
 const consider=mask=>{for(const component of components(mask,w,h)){
  let q=hullQuad(component.points);if(!q)continue;const area=quadArea(q),fraction=area/(w*h),width=(dist(q[0],q[1])+dist(q[2],q[3]))/2,height=(dist(q[1],q[2])+dist(q[3],q[0]))/2,ratio=width/height;
  if(fraction<.06||fraction>.94||ratio<.43||ratio>.94||Math.min(width,height)<24)continue;
  if(q.some((b,i)=>{const a=q[(i+3)%4],c=q[(i+1)%4];return Math.abs(((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))/(dist(a,b)*dist(c,b)))>.76;}))continue;
  let sideSupport=quadEdgeSupport(rgba,w,h,q);
  if(sideSupport.filter(s=>s>=.55).length>=2&&Math.min(...sideSupport)<.9){q=refineQuadEdges(rgba,w,h,q);sideSupport=quadEdgeSupport(rgba,w,h,q);}
  const edgeSupport=Math.min(...sideSupport),meanSupport=sideSupport.reduce((a,b)=>a+b,0)/4,edges=sideSupport.filter(s=>s>=.58).length;
  if(edges!==4||meanSupport<.68)continue;
  // Image evidence dominates. Area saturates, so a large background hull cannot
  // beat a smaller card simply by covering more of the camera preview.
  const aspect=Math.max(0,1-Math.abs(ratio-63/88)/.3),score=.58*edgeSupport+.25*meanSupport+.12*aspect+.05*Math.min(1,fraction/.25);
  const candidate={quad:q,score,fraction:quadArea(q)/(w*h),sideSupport,edgeSupport,edges};
  // The wide art window itself can look like a card rotated by 90 degrees.
  // Prefer its well-supported enclosing card, not an arbitrary larger hull.
  const outer=best&&candidate.fraction>best.fraction*1.4&&candidate.fraction<best.fraction*4.5&&edgeSupport>=.8&&contains(q,best.quad);
  const inner=best&&best.fraction>candidate.fraction*1.4&&best.fraction<candidate.fraction*4.5&&best.edgeSupport>=.8&&contains(best.quad,q);
  if(!best||outer||(!inner&&score>best.score))best=candidate;
 }};
 consider(contrast);consider(edge);
 // Different foreground masks find a card even when background texture joins
 // all gradient pixels into one component. Both polarities support dark borders
 // on light desks; thresholds depend on this frame rather than card/game colours.
 const split=luminanceSplit(gray);
 for(const threshold of [...new Set([split,Math.max(12,split-24),Math.min(242,split+24)])])for(const light of [true,false]){
  const mask=new Uint8Array(w*h);for(let i=0;i<gray.length;i++)mask[i]=light?gray[i]>threshold:gray[i]<=threshold;consider(mask);consider(erodeMask(mask,w,h));
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
 const gray=new Float32Array(w*h);let bright=0,hot=0;
 for(let i=0;i<gray.length;i++){const j=i*4;gray[i]=.299*data[j]+.587*data[j+1]+.114*data[j+2];bright+=gray[i];if(gray[i]>250)hot++;}
 const band=(from,to)=>{
  let n=0,sum=0,sq=0,saturated=0;
  for(let y=Math.max(2,Math.floor(h*from));y<Math.min(h-2,Math.ceil(h*to));y++)for(let x=2;x<w-2;x++){
   const i=y*w+x,lap=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-w]-gray[i+w];sum+=lap;sq+=lap*lap;n++;if(gray[i]>250)saturated++;
  }
  return {n,sum,sq,hot:saturated,sharp:sq/Math.max(1,n)-(sum/Math.max(1,n))**2};
 };
 // One readable title must not hide a completely washed-out collector-number
 // band. Saturation is only a clue: white card stock can also be near-white.
 const name=band(0,.19),code=band(.84,1),n=Math.max(1,name.n+code.n),sum=name.sum+code.sum;
 const rawGlare=hot/Math.max(1,gray.length);
 return {sharp:(name.sq+code.sq)/n-(sum/n)**2,nameSharp:name.sharp,codeSharp:code.sharp,
  bright:bright/Math.max(1,gray.length),glare:rawGlare,rawGlare,textGlare:(name.hot+code.hot)/n,nameGlare:name.hot/Math.max(1,name.n),codeGlare:code.hot/Math.max(1,code.n),gray};
}
