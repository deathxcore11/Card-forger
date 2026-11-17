// Magic foil: per-image analysis, run once per card. Magic prints CMYK straight onto the foil (no
// white underbase on traditional foils), so coverage needs no subject mask. What the treatments
// do need is where the gold ink, neon ink, bare paper-white and drawn lines are, plus a height
// field and stroke direction for embossed and textured foils. Pure: no DOM.
const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
export function boxBlur(src,w,h,r,passes=2){
 let a=Float32Array.from(src),b=new Float32Array(a.length);
 for(let p=0;p<passes;p++)for(const horiz of [true,false]){
  const n=horiz?w:h,m=horiz?h:w;
  for(let o=0;o<m;o++){
   const at=i=>horiz?o*w+Math.min(n-1,Math.max(0,i)):Math.min(n-1,Math.max(0,i))*w+o;let s=0;
   for(let i=-r;i<=r;i++)s+=a[at(i)];
   for(let i=0;i<n;i++){b[at(i)]=s/(2*r+1);s+=a[at(i+r+1)]-a[at(i-r)];}
  }
  [a,b]=[b,a];
 }
 return a;
}
// Frame geometry by Scryfall frame (fractions of the card image, measured on 672x936 scans).
export const MTG_FRAMES={
 '1997':{art:[.113,.096,.884,.545],text:[.104,.594,.897,.887]},
 '1993':{art:[.113,.096,.884,.545],text:[.104,.594,.897,.887]},
 '2003':{art:[.080,.117,.920,.560],text:[.080,.620,.920,.908]},
 '2015':{art:[.075,.107,.925,.560],text:[.075,.615,.925,.908]},
 borderless:{art:[0,0,1,1],text:[.070,.620,.930,.920]},
 // Layouts of their own (Foil Test Bench, 16 Nov 2026), measured on the named scans: Mystical Archive (Counterspell STA 15),
 // Dominaria United schematic textured (Nemata DMU 349), cosmic foil (The Soul Stone SPM 242), gleaming gold (Smaug HOB 249),
 // and full-picture cards with no rules box (singularity, dazzle).
 sta:{art:[0,.118,1,.548],text:[.085,.625,.915,.93]},
 dmusg:{art:[.04,.105,.96,.555],text:[.06,.62,.94,.9]},
 cosmic:{art:[0,.12,1,.8],text:[0,0,0,0]},
 smaug:{art:[.05,.2,.86,.79],text:[0,0,0,0]},
 none:{art:[0,0,1,1],text:[0,0,0,0]}
};
// Returns two RGBA byte maps the size of the input:
//  mask   R gold ink, G neon ink, B bare paper-white, A drawn lines
//  relief R smoothed height, G/B stroke direction (cos 2θ, sin 2θ), A stroke strength
export function analyzeMtgCard(rgba,W,H){
 const N=W*H,lum=new Float32Array(N),gold=new Float32Array(N),neon=new Float32Array(N),paper=new Float32Array(N);
 for(let i=0;i<N;i++){
  const r=rgba[i*4]/255,g=rgba[i*4+1]/255,b=rgba[i*4+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),c=mx-mn,s=mx?c/mx:0;
  lum[i]=.2126*r+.7152*g+.0722*b;
  let h=0;if(c>1e-4){h=mx===r?((g-b)/c+6)%6:mx===g?(b-r)/c+2:(r-g)/c+4;h*=60;}
  // Gold ink: warm yellow-orange, moderately saturated, mid-to-bright.
  gold[i]=ss(.28,.45,s)*ss(.38,.55,mx)*(1-ss(4,10,Math.abs(h-44)-14));
  // Fluorescent inks sit at the edge of sRGB: nearly full saturation and value.
  neon[i]=ss(.72,.9,s)*ss(.72,.92,mx);
  paper[i]=(1-ss(.08,.2,s))*ss(.66,.82,lum[i]);
 }
 const height=boxBlur(lum,W,H,2,2),edge0=new Float32Array(N),Jxx=new Float32Array(N),Jyy=new Float32Array(N),Jxy=new Float32Array(N);
 for(let j=1;j<H-1;j++)for(let i=1;i<W-1;i++){const k=j*W+i,dx=lum[k+1]-lum[k-1],dy=lum[k+W]-lum[k-W];edge0[k]=Math.hypot(dx,dy);Jxx[k]=dx*dx;Jyy[k]=dy*dy;Jxy[k]=dx*dy;}
 const edge=boxBlur(edge0,W,H,1,1),Sxx=boxBlur(Jxx,W,H,3),Syy=boxBlur(Jyy,W,H,3),Sxy=boxBlur(Jxy,W,H,3);
 const goldS=boxBlur(gold,W,H,1,1),neonS=boxBlur(neon,W,H,1,1),paperS=boxBlur(paper,W,H,1,1);
 const mask=new Uint8ClampedArray(N*4),relief=new Uint8ClampedArray(N*4),q=v=>Math.round(Math.max(0,Math.min(1,v))*255);
 for(let k=0;k<N;k++){
  mask[k*4]=q(goldS[k]);mask[k*4+1]=q(neonS[k]);mask[k*4+2]=q(paperS[k]);mask[k*4+3]=q(ss(.05,.22,edge[k]));
  const a=Sxx[k]-Syy[k],b=2*Sxy[k],m=Math.hypot(a,b),coh=m/(Sxx[k]+Syy[k]+1e-6);
  relief[k*4]=q(height[k]);relief[k*4+1]=q(a/(m+1e-9)*.5+.5);relief[k*4+2]=q(b/(m+1e-9)*.5+.5);relief[k*4+3]=q(ss(.15,.7,coh)*Math.min(1,m*400));
 }
 return {mask,relief};
}

// ---- Per-card maps for the approved look (Foil Test Bench "Blended", 16 Nov 2026). The analysis picture is
// MTG_MAP_W x MTG_MAP_H, as on the bench; every rule below was checked there on real scans.
export const MTG_MAP_W=336,MTG_MAP_H=468;
// Finds the shooting star that a scan of a real foil already carries. rgba is the card picture, top row first; text is
// the frame's rules box. A star is a white point whose four long rays are all much whiter than the gaps between rays.
// Returns {x,y} (0..1 on the card) or null. Tested on Wrath of God 7ED and Eternal Witness P30A (found, at 672, 360 and
// 200 px wide) and Counterspell DMR 281 (a nonfoil scan: none).
export function findScanStar(rgba,W,H,text){
 const wh=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return 0;const i=(y*W+x)*4;return Math.min(rgba[i],rgba[i+1],rgba[i+2]);};
 const near=(x,y)=>{let m=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)m=Math.max(m,wh(x+dx,y+dy));return m;};
 const R=.06*W,T=[.25,.45,.65,.85];let best=null,top=18;
 for(let cy=Math.floor((text[3]-.035)*H);cy<(text[3]+.03)*H;cy++)for(let cx=Math.floor((text[0]+.04)*W);cx<(text[0]+.17)*W;cx++){
  if(wh(cx,cy)<235)continue;let off=0,arm=255;
  for(let k=0;k<4;k++){const a=k*Math.PI/2,o=a+Math.PI/8;let r1=0;
   for(const t of T){r1+=near(cx+R*t*Math.cos(a),cy+R*t*Math.sin(a));off+=wh(cx+R*t*Math.cos(o),cy+R*t*Math.sin(o));}
   arm=Math.min(arm,r1/T.length);}
  const sc=arm-off/(4*T.length);if(sc>top){top=sc;best={x:(cx+.5)/W,y:(cy+.5)/H,score:sc};}}
 return best;}

// Silver ink on a silver scroll card (Japanese Mystical Archive, SOA): the polished plate borders and bottom frame. In the
// scan they are neutral grey and smooth along their length, while the silver picture is grainy and the rules paper is a
// large bright area. rgba is the card at analysis size, top row first. Returns one value per pixel, 0..1. Checked on seven
// cards (SOA 131, 140, 149, 157, 167, 176, 185): rules box border and bottom frame found on all, name plate ring on most.
export function silverInk(rgba,W,H){
 const N=W*H,ss=(a,b,x)=>Math.max(0,Math.min(1,(x-a)/(b-a))),lum=new Float32Array(N),neu=new Float32Array(N);
 for(let i=0;i<N;i++){const r=rgba[i*4]/255,g=rgba[i*4+1]/255,b=rgba[i*4+2]/255;lum[i]=.2126*r+.7152*g+.0722*b;neu[i]=1-ss(.045,.09,Math.max(r,g,b)-Math.min(r,g,b));}
 // box mean along one axis
 const box=(src,r,horiz)=>{const out=new Float32Array(N),n=horiz?W:H,m=horiz?H:W,st=horiz?1:W,ln=horiz?W:1;
  for(let j=0;j<m;j++){const o=j*ln;let acc=0;for(let t=-r;t<=r;t++)acc+=src[o+Math.max(0,Math.min(n-1,t))*st];
   for(let i=0;i<n;i++){out[o+i*st]=acc/(2*r+1);acc+=src[o+Math.min(n-1,i+r+1)*st]-src[o+Math.max(0,i-r)*st];}}return out;};
 const sq=new Float32Array(N);for(let i=0;i<N;i++)sq[i]=lum[i]*lum[i];
 const sd=h=>{const m=box(lum,3,h),m2=box(sq,3,h),o=new Float32Array(N);for(let i=0;i<N;i++)o[i]=Math.sqrt(Math.max(0,m2[i]-m[i]*m[i]));return o;};
 const sh=sd(true),sv=sd(false);
 // Flat light areas, split by the printed outlines: the largest one is the rules paper, the other sizeable ones are the
 // name and type plates. On the real card the plates are bare mirror silver (black out of the light), although a scan
 // shows them as pale as the paper, so they are told apart by shape, not by colour. Speckled areas (the fur) are neither.
 const flat=new Uint8Array(N);for(let i=0;i<N;i++)flat[i]=(lum[i]>.5&&Math.max(sh[i],sv[i])<.05)?1:0;
 const lab=new Int32Array(N),sizes=[0],cys=[0];let n=0;
 for(let s0=0;s0<N;s0++){if(!flat[s0]||lab[s0])continue;n++;const q=[s0];lab[s0]=n;let cy=0;for(let h=0;h<q.length;h++){const i=q[h],x=i%W;cy+=(i-x)/W;
   if(x>0&&flat[i-1]&&!lab[i-1]){lab[i-1]=n;q.push(i-1);}if(x<W-1&&flat[i+1]&&!lab[i+1]){lab[i+1]=n;q.push(i+1);}
   if(i>=W&&flat[i-W]&&!lab[i-W]){lab[i-W]=n;q.push(i-W);}if(i<N-W&&flat[i+W]&&!lab[i+W]){lab[i+W]=n;q.push(i+W);}}sizes.push(q.length);cys.push(cy/q.length/H);}
 // Printed text can cut the paper into strips, so every flat area that sits in the rules box part of the card is paper.
 let P=new Float32Array(N),plate=new Float32Array(N);for(let i=0;i<N;i++){const c=lab[i];if(!c)continue;if(cys[c]>.605){if(sizes[c]>N*.001&&cys[c]<.9)P[i]=1;}else if(sizes[c]>N*.002&&sizes[c]<N*.04)plate[i]=1;}
 const fill=(m,r)=>{let b=box(box(m,r,true),r,false);for(let i=0;i<N;i++)b[i]=ss(.3,.5,b[i]);return b;};
 // the paper keeps its printed text: everything the paper's outline encloses is paper
 {const out=new Uint8Array(N),st=[];const push=i=>{if(!out[i]&&P[i]<.5){out[i]=1;st.push(i);}};
  for(let x=0;x<W;x++){push(x);push(N-W+x);}for(let y=0;y<H;y++){push(y*W);push(y*W+W-1);}
  while(st.length){const i=st.pop(),x=i%W;if(x>0)push(i-1);if(x<W-1)push(i+1);if(i>=W)push(i-W);if(i<N-W)push(i+W);}
  for(let i=0;i<N;i++)if(!out[i])P[i]=1;}
 // the paper keeps its printed text: a spot is paper when paper lies to its left and right, and above and below it
 {const rf=new Uint8Array(N),cf=new Uint8Array(N);
  const ra=new Int32Array(H).fill(-1),rb=new Int32Array(H).fill(-1);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(P[y*W+x]>.5){if(ra[y]<0)ra[y]=x;rb[y]=x;}
  for(let y=0;y<H;y++){let a=ra[y]<0?W:ra[y],b=rb[y];for(let t=-14;t<=14;t++){const yy=y+t;if(yy>=0&&yy<H&&ra[yy]>=0){a=Math.min(a,ra[yy]);b=Math.max(b,rb[yy]);}}for(let x=a;x<=b;x++)rf[y*W+x]=1;}
  const ca=new Int32Array(W).fill(-1),cb=new Int32Array(W).fill(-1);for(let x=0;x<W;x++)for(let y=0;y<H;y++)if(P[y*W+x]>.5){if(ca[x]<0)ca[x]=y;cb[x]=y;}
  for(let x=0;x<W;x++){let a=ca[x]<0?H:ca[x],b=cb[x];for(let t=-14;t<=14;t++){const xx=x+t;if(xx>=0&&xx<W&&ca[xx]>=0){a=Math.min(a,ca[xx]);b=Math.max(b,cb[xx]);}}for(let y=a;y<=b;y++)cf[y*W+x]=1;}
  for(let i=0;i<N;i++)if(rf[i]&&cf[i])P[i]=1;}
 P=fill(P,2);plate=fill(fill(plate,6),2);for(let i=0;i<N;i++)plate[i]*=1-P[i];
 let k=new Float32Array(N);for(let i=0;i<N;i++)k[i]=neu[i]*(1-ss(.014,.034,Math.min(sh[i],sv[i])))*ss(.1,.2,lum[i])*(1-ss(.5,.9,P[i]));
 k=box(box(k,1,true),1,false);for(let i=0;i<N;i++)k[i]=Math.max(ss(.35,.75,k[i]),plate[i]);const ink=box(box(k,1,true),1,false);ink.paper=box(box(P,1,true),1,false);return ink;}
// The picture window of a card with a printed gold frame (Smaug): everything the gold frame does not cover, however
// uneven the window is and wherever the picture spills over the frame. Gold is told by its colour after a small blur; the
// frame is the gold that reaches the card's edge; the picture is what is left, without small specks.
export function artWindow(rgba,W,H){
 const N=W*H,ch=c=>{const a=new Float32Array(N);for(let i=0;i<N;i++)a[i]=rgba[i*4+c]/255;return boxBlur(a,W,H,2);};
 const R=ch(0),G=ch(1),B=ch(2);let gold=new Float32Array(N);
 for(let i=0;i<N;i++){const r=R[i],g=G[i],b=B[i];gold[i]=(r>g&&g>b&&(r-b)>.22*r&&g>.7*r&&g<.97*r&&r>.3)?1:0;}
 gold=boxBlur(gold,W,H,3);const fr=new Uint8Array(N),st=[];
 const push=i=>{if(!fr[i]&&gold[i]>.45){fr[i]=1;st.push(i);}};
 for(let x=0;x<W;x++){push(x);push((H-1)*W+x);}for(let y=0;y<H;y++){push(y*W);push(y*W+W-1);}
 while(st.length){const i=st.pop(),x=i%W,y=(i-x)/W;if(x>0)push(i-1);if(x<W-1)push(i+1);if(y>0)push(i-W);if(y<H-1)push(i+W);}
 // components of what is not frame: keep the big ones
 const lab=new Int32Array(N),art=new Float32Array(N);let n=0;
 for(let s0=0;s0<N;s0++){if(fr[s0]||lab[s0])continue;n++;const q=[s0];lab[s0]=n;for(let h=0;h<q.length;h++){const i=q[h],x=i%W,y=(i-x)/W;
   for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1])if(j>=0&&!fr[j]&&!lab[j]){lab[j]=n;q.push(j);}}
  if(q.length>N*.03)for(const i of q)art[i]=1;}
 return boxBlur(boxBlur(art,W,H,2),W,H,1);}
// The picture and rules boxes of this very card: each side of the frame type's box moves to the printed frame line
// nearest to it on the scan (showcase and special frames sit a little off the standard measure). A side with no clear
// line nearby stays where it was.
export function cardBoxes(rgba,W,H,box){
 const lum=new Float32Array(W*H);for(let i=0;i<W*H;i++)lum[i]=(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])/255;
 const snap=(b,none)=>{if(b[2]-b[0]<=0)return b.slice();const o=b.slice();let found=0,tried=0;
  for(let e=0;e<4;e++){const vert=e%2===0,n=vert?W:H,pos=Math.round(b[e]*n);if(b[e]<=.005||b[e]>=.995)continue;tried++;
   const lo0=vert?b[1]*H:b[0]*W,hi0=vert?b[3]*H:b[2]*W,lo=Math.round(lo0+(hi0-lo0)*.1),hi=Math.round(hi0-(hi0-lo0)*.1),rng=Math.round(n*.03);
   let best=0,bp=pos;for(let p=Math.max(2,pos-rng);p<=Math.min(n-3,pos+rng);p++){let acc=0;
     for(let t=lo;t<hi;t++)acc+=vert?lum[t*W+p+1]-lum[t*W+p-1]:lum[(p+1)*W+t]-lum[(p-1)*W+t];
     const sc=Math.abs(acc/(hi-lo))*(1-.5*Math.abs(p-pos)/rng);if(sc>best){best=sc;bp=p;}}
   if(best>.05){o[e]=bp/n;found++;}}
  // A box whose frame lines are not on this card (a full-art or sideways layout filed under a standard frame) is not used.
  if(tried>=3&&found<2)return none;
  return o;};
 return {art:snap(box.art,[0,0,1,1]),text:snap(box.text,[0,0,0,0])};}

// Facet foil (Reality Fracture, 13 Shattered Mirror cards): the app's cut, ported line for line from MtgFoil.facets (Kotlin).
// Finds the printed glass shards once per card. rgba is the card at analysis size, top row first; text is the frame's rules
// box. Returns {seed, depth, edge, pieces}: per pixel the shard's tilt seed (one value per piece), its depth inside the piece
// (0 at the outline, 1 halfway in) and the printed cut edge next to a shard.
export function mtgFacets(rgba,W,H,text){
 const N=W*H,s=W/244,line=new Uint8Array(N),wall=new Uint8Array(N),box=new Uint8Array(N),seed=new Uint8Array(N),grow=new Uint8Array(N);let ink=new Float32Array(N);
 for(let k=0;k<N;k++){const u=(k%W+.5)/W,v=((k/W|0)+.5)/H,r=rgba[k*4]/255,g=rgba[k*4+1]/255,b=rgba[k*4+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx>0?(mx-mn)/mx:0,lum=.2126*r+.7152*g+.0722*b;
  const boxed=u>=text[0]&&u<=text[2]&&(v>=text[1]-.065&&v<=text[3]||v>=.035&&v<=.105);
  line[k]=sat>.55&&mx>.6?1:0;ink[k]=sat>.35&&mx>.3?1:0;wall[k]=line[k];if(wall[k])continue;box[k]=boxed?1:0;
  seed[k]=(boxed?b-r>.08&&b-g>.04&&b>.26:sat<.3&&lum>.35&&b>=r)?1:0;
  grow[k]=(boxed?b-r>.04&&b>.12&&b>=g-.02:seed[k]||(b-r>.04&&b>.12)||(sat<.3&&lum>.3&&b>=r-.01))?1:0;}
 const label=new Int32Array(N),queue=new Int32Array(N),starts=[];let count=0;const minArea=Math.max(8,Math.round(40*s*s));
 for(let k0=0;k0<N;k0++){if(!seed[k0]||label[k0]!==0)continue;const id=count+1;let head=0,tail=0;queue[tail++]=k0;label[k0]=id;
  while(head<tail){const k=queue[head++],x=k%W;
   if(x>0&&seed[k-1]&&label[k-1]===0){label[k-1]=id;queue[tail++]=k-1;}
   if(x<W-1&&seed[k+1]&&label[k+1]===0){label[k+1]=id;queue[tail++]=k+1;}
   if(k>=W&&seed[k-W]&&label[k-W]===0){label[k-W]=id;queue[tail++]=k-W;}
   if(k<N-W&&seed[k+W]&&label[k+W]===0){label[k+W]=id;queue[tail++]=k+W;}}
  starts[count++]=k0;if(tail<minArea)for(let i=0;i<tail;i++)label[queue[i]]=-1;}
 // Darker facets join their shard one ring of pixels at a time.
 let front=0;for(let k=0;k<N;k++)if(label[k]>0)queue[front++]=k;
 const ring=new Int32Array(N),artRings=Math.max(1,Math.round(10*s)),boxRings=Math.max(artRings,Math.round(70*s));
 for(let r=0;r<boxRings;r++){if(front===0)break;let next=0;
  for(let f=0;f<front;f++){const k=queue[f],x=k%W,id=label[k];
   for(let dir=0;dir<4;dir++){const n=dir===0?(x>0?k-1:-1):dir===1?(x<W-1?k+1:-1):dir===2?(k>=W?k-W:-1):(k<N-W?k+W:-1);
    if(n>=0&&grow[n]&&label[n]===0&&(r<artRings||box[n])){label[n]=id;ring[next++]=n;}}}
  queue.set(ring.subarray(0,next));front=next;}
 // Pinholes close: a free pixel held on three sides by one shard joins it.
 for(let rep=0;rep<2;rep++){ring.fill(0);
  for(let k=0;k<N;k++){if(label[k]>0||wall[k])continue;const x=k%W,a=x>0?label[k-1]:0,b=x<W-1?label[k+1]:0,c=k>=W?label[k-W]:0,d=k<N-W?label[k+W]:0;
   const byA=a>0&&1+(b===a)+(c===a)+(d===a)>=3,byB=b>0&&(a===b)+1+(c===b)+(d===b)>=3;ring[k]=byA?a:byB?b:0;}
  for(let k=0;k<N;k++)if(ring[k]>0)label[k]=ring[k];}
 // Pieces that touch with no printed line between them are one shard.
 {const pairs=new Map();
  for(let k=0;k<N;k++)for(let dir=0;dir<2;dir++){const a=label[k],b=dir===0?(k%W<W-1?label[k+1]:0):(k<N-W?label[k+W]:0);if(a<=0||b<=0||a===b)continue;
   const key=Math.min(a,b)*65536+Math.max(a,b);pairs.set(key,(pairs.get(key)||0)+1);}
  const parent=new Int32Array(count+1);for(let i=0;i<=count;i++)parent[i]=i;
  const find=i=>{let r=i;while(parent[r]!==r)r=parent[r];let j=i;while(parent[j]!==r){const n=parent[j];parent[j]=r;j=n;}return r;};
  const need=Math.max(3,Math.round(4*s));
  for(const key of [...pairs.keys()].sort((x,y)=>x-y)){if(pairs.get(key)<need)continue;const a=find(Math.floor(key/65536)),b=find(key%65536);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);}
  for(let k=0;k<N;k++)if(label[k]>0)label[k]=find(label[k]);}
 // A piece is glass only when its outline runs along a printed line for a fair share of its length.
 const dense=boxBlur(ink,W,H,Math.max(1,Math.round(2*s)),1),near=new Float32Array(N);for(let k=0;k<N;k++)near[k]=line[k]?1:0;
 for(let k=0;k<N;k++)ink[k]=line[k]||(ink[k]>0&&dense[k]<.5)?1:0;
 const along=Math.max(1,Math.round(2*s)),reachLine=boxBlur(near,W,H,along,1),reachThin=boxBlur(ink,W,H,along,1);
 const rim=new Int32Array(count+1),drawn=new Int32Array(count+1),neonRun=new Int32Array(count+1);
 for(let k=0;k<N;k++){const id=label[k];if(id<=0)continue;const x=k%W;
  if(x===0||x===W-1||k<W||k>=N-W){rim[id]++;drawn[id]++;continue;}
  if(!(label[k-1]!==id||label[k+1]!==id||label[k-W]!==id||label[k+W]!==id))continue;
  rim[id]++;if(reachThin[k]>1e-3)drawn[id]++;if(reachLine[k]>1e-3)neonRun[id]++;}
 const keep=new Uint8Array(count+1);let pieces=0;const run=Math.max(4,Math.round(6*s));
 for(let id=1;id<=count;id++)if(rim[id]>0&&(drawn[id]>=.12*rim[id]||neonRun[id]>=run)){keep[id]=1;pieces++;}
 for(let k=0;k<N;k++)if(label[k]>0&&!keep[label[k]])label[k]=0;
 // Depth inside each piece (chamfer distance to its outline).
 const INF=1e6,dist=new Float32Array(N),D=1.4142;
 for(let k=0;k<N;k++){const id=label[k];if(id<=0){dist[k]=0;continue;}const x=k%W;
  dist[k]=(x>0&&label[k-1]!==id)||(x<W-1&&label[k+1]!==id)||(k>=W&&label[k-W]!==id)||(k<N-W&&label[k+W]!==id)?1:INF;}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x;if(dist[k]<=1)continue;let d=dist[k];
  if(x>0)d=Math.min(d,dist[k-1]+1);if(y>0){d=Math.min(d,dist[k-W]+1);if(x>0)d=Math.min(d,dist[k-W-1]+D);if(x<W-1)d=Math.min(d,dist[k-W+1]+D);}dist[k]=d;}
 for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const k=y*W+x;if(dist[k]<=1)continue;let d=dist[k];
  if(x<W-1)d=Math.min(d,dist[k+1]+1);if(y<H-1){d=Math.min(d,dist[k+W]+1);if(x<W-1)d=Math.min(d,dist[k+W+1]+D);if(x>0)d=Math.min(d,dist[k+W-1]+D);}dist[k]=d;}
 const deepest=new Float32Array(count+1);for(let k=0;k<N;k++){const id=label[k];if(id>0&&dist[k]<INF)deepest[id]=Math.max(deepest[id],dist[k]);}
 const fr=v=>v-Math.floor(v),hash=(x,y)=>{let px=fr(x*234.34),py=fr(y*435.345);const d=px*(px+34.23)+py*(py+34.23);px+=d;py+=d;return fr(px*py);};
 const ramp0=2.5*s,shard=new Float32Array(N),depth=new Float32Array(N),seedOf=new Float32Array(count+1);
 for(let id=1;id<=count;id++)if(keep[id]){const k0=starts[id-1];seedOf[id]=hash((k0%W)/W*97,(k0/W|0)/H*97);}
 const seedPx=new Int32Array(N);for(let k=0;k<N;k++)seedPx[k]=label[k]>0?label[k]:0;
 for(let rep=0;rep<2;rep++){ring.set(seedPx);
  for(let k=0;k<N;k++){if(ring[k]!==0)continue;const x=k%W;
   seedPx[k]=x>0&&ring[k-1]!==0?ring[k-1]:x<W-1&&ring[k+1]!==0?ring[k+1]:k>=W&&ring[k-W]!==0?ring[k-W]:k<N-W&&ring[k+W]!==0?ring[k+W]:0;}}
 for(let k=0;k<N;k++){const id=label[k];if(id>0){shard[k]=1;depth[k]=Math.min(1,dist[k]/Math.max(ramp0,.5*deepest[id]));}}
 const soft=boxBlur(depth,W,H,1,2),seedOut=new Float32Array(N),depthOut=new Float32Array(N);
 for(let k=0;k<N;k++){seedOut[k]=seedPx[k]>0?seedOf[seedPx[k]]:0;depthOut[k]=seedPx[k]>0?soft[k]:0;}
 // Cut edges: the printed neon outline within a few pixels of a shard.
 const reach=boxBlur(shard,W,H,Math.max(1,Math.round(3*s)),1);for(let k=0;k<N;k++)near[k]=line[k]&&reach[k]>1e-3?1:0;
 const rimEdge=boxBlur(near,W,H,1,1),edge=new Float32Array(N);for(let k=0;k<N;k++)edge[k]=Math.max(near[k]*.85,Math.min(1,rimEdge[k]*1.6));
 return {seed:seedOut,depth:depthOut,edge,pieces};}

// Everything one card needs for its recipe: the ink maps, this card's own picture and rules boxes, and the shooting star
// its scan already carries. rgba is the card at MTG_MAP_W x MTG_MAP_H, top row first; frame is the frame type's boxes;
// emblem is the Jurassic World emblem's shape (R channel, same size) for pattern 29.
export function mtgCardMaps(rgba,W,H,{pat=1,frame=MTG_FRAMES['2015'],emblem=null}={}){
 const an=analyzeMtgCard(rgba,W,H),mask=an.mask;
 if(pat===23){const k=silverInk(rgba,W,H);for(let i=0;i<W*H;i++){mask[i*4]=Math.round(k[i]*255);mask[i*4+2]=Math.round(k.paper[i]*255);mask[i*4+1]=Math.round((1-k.paper[i])*(1-k[i])*255);}}
 if(pat===28){const a=artWindow(rgba,W,H);for(let i=0;i<W*H;i++){mask[i*4+1]=Math.round(a[i]*255);mask[i*4+2]=0;}}
 if(pat===29&&emblem)for(let i=0;i<W*H;i++)mask[i*4]=emblem[i*4];
 if(pat===21){const f=mtgFacets(rgba,W,H,frame.text);for(let i=0;i<W*H;i++){mask[i*4]=Math.round(f.seed[i]*255);mask[i*4+1]=Math.round(f.depth[i]*255);mask[i*4+2]=Math.round(f.edge[i]*255);}}
 return {mask,relief:an.relief,box:cardBoxes(rgba,W,H,frame),star:findScanStar(rgba,W,H,frame.text)};
}
