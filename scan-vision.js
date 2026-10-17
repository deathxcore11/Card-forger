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
 // Corner ordering is geometric, not a claim about text orientation. In
 // particular, never turn a wide internal artwork window into a portrait card.
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
const containsQuad=(outer,inner)=>{
 const margin=Math.max(2,Math.max(...outer.map((p,i)=>dist(p,outer[(i+1)%4])))*.03);
 return inner.every(p=>outer.every((a,i)=>cross(a,outer[(i+1)%4],p)>=-margin*dist(a,outer[(i+1)%4])));
};
const quadShape=q=>{
 const width=(dist(q[0],q[1])+dist(q[2],q[3]))/2,height=(dist(q[1],q[2])+dist(q[3],q[0]))/2;
 return {width,height,nativeAspect:width/height,aspect:Math.min(width,height)/Math.max(width,height)};
};
const sameBoundary=(a,b)=>Math.abs(a.fraction-b.fraction)<.035&&a.quad.every((p,i)=>dist(p,b.quad[i])<5);
const sameCardFrame=(a,b)=>{
 const outer=a.fraction>b.fraction?a:b,inner=outer===a?b:a,length=Math.max(outer.width,outer.height);
 const centre=q=>({x:q.reduce((s,p)=>s+p.x,0)/4,y:q.reduce((s,p)=>s+p.y,0)/4});
 return (a.nativeAspect>1)===(b.nativeAspect>1)&&outer.fraction<inner.fraction*1.6&&dist(centre(a.quad),centre(b.quad))<length*.075&&outer.quad.every((p,i)=>dist(p,inner.quad[i])<length*.20);
};

// Supported outlines are proposals, not proof of a whole card or its identity.
// A page/book surrounding a card is not automatically better just because it
// is larger. Only a card-shaped envelope around a transverse art-shaped region
// has a defensible completeness preference; competing full-card shapes abstain.
export function selectCardProposal(input){
 const candidates=[],frameGroups=[];
 for(const c of [...input].sort((a,b)=>b.score-a.score)){
  const at=candidates.findIndex((p,i)=>frameGroups[i].every(member=>sameBoundary(member,c)||sameCardFrame(member,c)));
  if(at<0){candidates.push(c);frameGroups.push([c]);}
  // Near-concentric printed frames belong to one proposal: keep its observed
  // outer edge so a sharp inner border cannot trim title/footer pixels.
  else {frameGroups[at].push(c);if(c.fraction>candidates[at].fraction)candidates[at]=c;}
 }
 candidates.sort((a,b)=>b.score-a.score);
 if(!candidates.length)return null;
 const plausible=c=>c.aspect>=.64&&c.aspect<=.82;
 const transverse=(a,b)=>(a.nativeAspect>1)!==(b.nativeAspect>1);
 const encloses=(a,b)=>a.fraction>b.fraction*1.35&&a.fraction<b.fraction*4.5&&containsQuad(a.quad,b.quad);
 const dominated=new Set();
 for(const outer of candidates)for(const inner of candidates){
  if(outer!==inner&&plausible(outer)&&(!plausible(inner)||outer.endBandsDetailed===true)&&encloses(outer,inner)&&transverse(outer,inner))dominated.add(inner);
 }
 const available=candidates.filter(c=>!dominated.has(c));
 let chosen=available[0];
 const competitors=available.filter(c=>c!==chosen&&plausible(c));
 const ambiguous=competitors.length>0;
 const reason=ambiguous?'competing-card-or-page-boundaries':chosen.touchesFrame?'frame-edge-needs-full-card-proof':!plausible(chosen)?'outline-aspect-does-not-establish-full-card':chosen.interiorDetail===false?'no-interior-card-detail':chosen.endBandsDetailed===false?'identifier-bands-not-established':chosen.nativeAspect>1?'landscape-region-needs-full-card-proof':'supported-outer-boundary';
 const describe=c=>{
  // Preserve the native source axes and physical aspect. OCR may try rotated
  // COPIES later, but only independent identifiers may confirm orientation.
  const outputWidth=c.nativeAspect<=1?Math.max(1,Math.round(672*c.nativeAspect)):672;
  const outputHeight=c.nativeAspect<=1?672:Math.max(1,Math.round(672/c.nativeAspect));
  return {...c,outputWidth,outputHeight,orientation:{status:'unverified',rotation:0},fullCard:{status:'unverified',reason:'text-identifiers-not-checked'}};
 };
 const result=describe(chosen);
 result.cropSafe=reason==='supported-outer-boundary';
 result.boundary={status:result.cropSafe?'supported':'uncertain',reason,source:chosen.source,sideSupport:[...chosen.sideSupport],edgeSupport:chosen.edgeSupport};
 result.alternatives=available.filter(c=>c!==chosen).slice(0,2).map(c=>({...describe(c),cropSafe:false,boundary:{status:'uncertain',reason:'alternative-boundary',source:c.source,sideSupport:[...c.sideSupport],edgeSupport:c.edgeSupport}}));
 return result;
}

// The cover preview can hide the top/bottom (or left/right) of a card that is
// completely present in the retained camera frame. Keep that full-frame view
// AND the existing closer preview view: the latter still resolves small cards
// below the detector's unchanged six-percent full-frame area floor.
export function analysisRegions(fw,fh,cw,ch,limits={width:192,height:256}){
 if(![fw,fh,cw,ch].every(v=>Number.isFinite(v)&&v>0))return [];
 const maxW=Math.min(192,limits.width??192),maxH=Math.min(256,limits.height??256);
 if(![maxW,maxH].every(v=>Number.isFinite(v)&&v>0))return [];
 const region=(kind,x,y,w,h)=>{
  const scale=Math.min(maxW/w,maxH/h,1);
  return {kind,x,y,w,h,width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale))};
 };
 const sensor=region('sensor',0,0,fw,fh),cover=Math.max(cw/fw,ch/fh),w=Math.min(fw,cw/cover),h=Math.min(fh,ch/cover);
 if(Math.abs(w-fw)<.01&&Math.abs(h-fh)<.01)return [sensor];
 return [sensor,region('preview',(fw-w)/2,(fh-h)/2,w,h)];
}

// Each observation is {region,proposal}, from detectCardQuad at region.width /
// region.height. All selected geometry and alternatives use retained-sensor
// coordinates. analysis.region is the original input object, and analysis.quad
// uses that region's analysis coordinates for bounded quality/signature warps.
export function selectSensorProposal(observations,fw,fh){
 if(!Array.isArray(observations)||![fw,fh].every(v=>Number.isFinite(v)&&v>0))return null;
 const validRegion=r=>r&&[r.x,r.y,r.w,r.h,r.width,r.height].every(Number.isFinite)&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&Number.isInteger(r.width)&&Number.isInteger(r.height)&&r.width>0&&r.height>0&&r.x+r.w<=fw+.01&&r.y+r.h<=fh+.01;
 const views=observations.slice(0,2).filter(o=>validRegion(o?.region));
 const fromSensor=(q,r)=>q.map(p=>({x:(p.x-r.x)*r.width/r.w,y:(p.y-r.y)*r.height/r.h}));
 const map=(proposal,region)=>{
  if(!proposal||!Array.isArray(proposal.quad)||proposal.quad.length!==4||!proposal.quad.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
  // Do not use one rounded scale for both axes: canvas rounds W and H
  // independently, and even sub-pixel discrepancies can clip an identifier.
  const quad=proposal.quad.map(p=>({x:region.x+p.x*region.w/region.width,y:region.y+p.y*region.h/region.height}));
  const clippedEdge=region.kind==='preview'&&proposal.quad.some(p=>
   (region.x>.01&&p.x<=4)||(region.y>.01&&p.y<=4)||
   (region.x+region.w<fw-.01&&p.x>=region.width-5)||(region.y+region.h<fh-.01&&p.y>=region.height-5));
  return {...proposal,quad,...quadShape(quad),fraction:quadArea(quad)/(fw*fh),
   analysis:{region,quad:proposal.quad,cropSafe:proposal.cropSafe===true&&!clippedEdge,
    reason:clippedEdge?'preview-edge-needs-sensor-boundary':proposal.boundary?.reason}};
 };
 const candidates=[];
 for(const {region,proposal} of views){
  const main=map(proposal,region);if(main)candidates.push(main);
  for(const alternate of (proposal?.alternatives||[]).slice(0,2)){const mapped=map(alternate,region);if(mapped)candidates.push(mapped);}
 }
 // Re-use the existing conservative grouping/competition rules on a common
 // coordinate system. In particular a second card/page must not disappear just
 // because one view has a more attractive score. Full outer boundaries may
 // dominate enclosed transverse artwork, not another independent card shape.
 const chosen=selectCardProposal(candidates);if(!chosen)return null;
 const observed=chosen.analysis;
 if(!observed.cropSafe&&chosen.cropSafe){
  chosen.cropSafe=false;
  chosen.boundary={...chosen.boundary,status:'uncertain',reason:observed.reason||'view-boundary-not-established'};
 }
 // Prefer the higher-density view for quality only when it contains the ENTIRE
 // selected boundary. This retains far-card title/footer resolution without
 // evaluating a preview-clipped inner crop as if it were the full sensor card.
 const qualityViews=views.map(({region})=>({region,quad:fromSensor(chosen.quad,region)}))
  .filter(({region,quad})=>quad.every(p=>p.x>=0&&p.y>=0&&p.x<=region.width-1&&p.y<=region.height-1))
  .sort((a,b)=>b.region.width*b.region.height/(b.region.w*b.region.h)-a.region.width*a.region.height/(a.region.w*a.region.h));
 const quality=qualityViews[0]||{region:observed.region,quad:fromSensor(chosen.quad,observed.region)};
 chosen.analysis={...quality,detectedRegion:observed.region};
 chosen.alternatives=chosen.alternatives.map(p=>({...p,analysis:{region:p.analysis.region,quad:fromSensor(p.quad,p.analysis.region)}}));
 return chosen;
}

// Cheap non-semantic texture check: a blank page is not sufficient evidence for
// auto-cropping. This does NOT identify text or prove a title/footer is present.
function proposalDetail(rgba,w,h,q){
 const nativeAspect=quadShape(q).nativeAspect;
 const variance=(from,to)=>{
  let sum=0,sq=0,n=0;
  for(let y=0;y<6;y++)for(let x=0;x<18;x++){
   const across=.06+.88*(x+.5)/18,along=from+(to-from)*(y+.5)/6;
   const p=quadPoint(q,nativeAspect<=1?across:along,nativeAspect<=1?along:across),i=(Math.max(0,Math.min(h-1,Math.round(p.y)))*w+Math.max(0,Math.min(w-1,Math.round(p.x))))*4;
   const v=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];sum+=v;sq+=v*v;n++;
  }
  return Math.max(0,sq/n-(sum/n)**2);
 };
 const interior=variance(.05,.95),first=variance(.035,.18),last=variance(.84,.98);
 return {interiorDetail:interior>64,endBandsDetailed:first>64&&last>64,endBandVariance:{first,last}};
}
export function detectCardQuad(rgba,w,h){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<20||h<20||!rgba||rgba.length!==w*h*4)return null;
 const gray=new Float32Array(w*h),border=[[],[],[]],chroma=[new Float32Array(w*h),new Float32Array(w*h),new Float32Array(w*h)],chromaSum=[0,0,0],chromaSq=[0,0,0];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,i=p*4;gray[p]=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];
  const v=[(rgba[i]-rgba[i+1]+255)/2,(rgba[i]-rgba[i+2]+255)/2,(rgba[i+1]-rgba[i+2]+255)/2];
  for(let c=0;c<3;c++){chroma[c][p]=v[c];chromaSum[c]+=v[c];chromaSq[c]+=v[c]*v[c];}
  if((x<3||y<3||x>w-4||y>h-4)&&(x+y)%3===0)for(let c=0;c<3;c++)border[c].push(rgba[i+c]);
 }
 const bg=border.map(a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]),contrast=new Uint8Array(w*h),edge=new Uint8Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x,i=p*4;contrast[p]=Math.abs(rgba[i]-bg[0])+Math.abs(rgba[i+1]-bg[1])+Math.abs(rgba[i+2]-bg[2])>55?1:0;const grad=Math.hypot(gray[p+1]-gray[p-1],gray[p+w]-gray[p-w]);if(grad>18)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)edge[p+dy*w+dx]=1;}
 const candidates=[],seen=new Set();
 const consider=(mask,source)=>{let accepted=0;for(const component of components(mask,w,h)){
  let q=hullQuad(component.points);if(!q)continue;
  const fraction=quadArea(q)/(w*h),shape=quadShape(q),{width,height,aspect}=shape;
  if(fraction<.06||fraction>.94||aspect<.43||aspect>.94||Math.min(width,height)<24)continue;
  if(q.some((b,i)=>{const a=q[(i+3)%4],c=q[(i+1)%4];return Math.abs(((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))/(dist(a,b)*dist(c,b)))>.76;}))continue;
  const key=q.map(p=>Math.round(p.x)+','+Math.round(p.y)).join(';');if(seen.has(key))continue;seen.add(key);
  // Refinement must not turn an image-clipped contour into a complete card by
  // moving its missing outer edge onto a visible inner printed frame.
  const observedTouchesFrame=q.some(p=>p.x<=1||p.y<=1||p.x>=w-2||p.y>=h-2);
  let sideSupport=quadEdgeSupport(rgba,w,h,q);
  if(sideSupport.filter(s=>s>=.55).length>=2&&Math.min(...sideSupport)<.9){q=refineQuadEdges(rgba,w,h,q);sideSupport=quadEdgeSupport(rgba,w,h,q);}
  const edgeSupport=Math.min(...sideSupport),meanSupport=sideSupport.reduce((a,b)=>a+b,0)/4,edges=sideSupport.filter(s=>s>=.58).length;
  if(edges!==4||meanSupport<.68)continue;
  const actual=quadShape(q),aspectScore=Math.max(0,1-Math.abs(actual.aspect-63/88)/.3),score=.58*edgeSupport+.25*meanSupport+.12*aspectScore+.05*Math.min(1,fraction/.25);
  candidates.push({quad:q,score,fraction:quadArea(q)/(w*h),sideSupport,edgeSupport,edges,source,touchesFrame:observedTouchesFrame||q.some(p=>p.x<3||p.y<3||p.x>w-4||p.y>h-4),...actual,...proposalDetail(rgba,w,h,q)});accepted++;
 }
 return accepted;};
 consider(contrast,'background-contrast');consider(edge,'gradient');
 const split=luminanceSplit(gray);
 for(const threshold of [...new Set([split,Math.max(12,split-24),Math.min(242,split+24)])])for(const light of [true,false]){
  const mask=new Uint8Array(w*h);for(let i=0;i<gray.length;i++)mask[i]=light?gray[i]>threshold:gray[i]<=threshold;
  consider(mask,'luminance');consider(erodeMask(mask,w,h),'luminance-eroded');
 }
 // Luminance-only masks merge similarly bright card stock and stone/wood desks.
 // Two strongest opponent-colour axes add bounded, colour-agnostic proposals.
 // They are still checked against four real boundaries, never assumed cards.
 const axes=[0,1,2].map(i=>({i,variance:chromaSq[i]/gray.length-(chromaSum[i]/gray.length)**2})).sort((a,b)=>b.variance-a.variance).slice(0,2);
 for(const {i,variance} of axes){
  if(variance<16)continue;
  const channel=chroma[i],threshold=luminanceSplit(channel);
  for(const light of [true,false]){
   const mask=new Uint8Array(w*h);for(let p=0;p<channel.length;p++)mask[p]=light?channel[p]>threshold:channel[p]<=threshold;
   if(!consider(mask,'opponent-colour'))consider(erodeMask(mask,w,h),'opponent-colour-eroded');
  }
 }
 return selectCardProposal(candidates);
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
