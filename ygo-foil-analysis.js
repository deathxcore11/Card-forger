// Yu-Gi-Oh! rarity foil: per-image analysis, run once per card (in a worker when available).
// Konami prints foil first, an opaque white underbase behind the subject, then the ink. A flat
// image has no layers, so this estimates where the underbase was left out: background reached
// from the art border without crossing an outline, plus coloured glows. Pure: no DOM.
export const YGO_ART_BOX=[.1205,.1845,.8795,.7035];
// Pendulum art is wider and stops at the scale box; Skill art stops above a taller rules box (measured).
export const YGO_LAYOUT_ART={standard:YGO_ART_BOX,pendulum:[.066,.183,.934,.609],skill:[.118,.174,.882,.662]};
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
// Returns two RGBA byte maps the size of the input:
//  mask   R foil-through, G coloured energy, B level stars (1) / attribute orb (.6)
//  relief R smoothed brightness, G/B stroke direction (cos 2θ, sin 2θ), A stroke strength
export function analyzeYgoArt(rgba,W,H,box=YGO_ART_BOX){
 const N=W*H,r=new Float32Array(N),g=new Float32Array(N),b=new Float32Array(N),lum=new Float32Array(N);
 for(let i=0;i<N;i++){r[i]=rgba[i*4]/255;g[i]=rgba[i*4+1]/255;b[i]=rgba[i*4+2]/255;lum[i]=.2126*r[i]+.7152*g[i]+.0722*b[i];}
 const ax0=Math.round(box[0]*W)+1,ay0=Math.round(box[1]*H)+1,ax1=Math.round(box[2]*W)-1,ay1=Math.round(box[3]*H)-1;
 const aw=ax1-ax0,ah=ay1-ay0,AN=aw*ah,at=(i,j)=>(ay0+j)*W+ax0+i;
 const mask=new Uint8ClampedArray(N*4),relief=new Uint8ClampedArray(N*4);
 if(aw<16||ah<16)return {mask,relief};
 // Colour outlines inside the art.
 const edge0=new Float32Array(AN);
 for(let j=1;j<ah-1;j++)for(let i=1;i<aw-1;i++){let s=0;for(const c of [r,g,b]){const dx=c[at(i+1,j)]-c[at(i-1,j)],dy=c[at(i,j+1)]-c[at(i,j-1)];s+=dx*dx+dy*dy;}edge0[j*aw+i]=Math.sqrt(s);}
 const edge=boxBlur(edge0,aw,ah,1);
 // Background palette from the art border band (k-means, 6 colours).
 const band=Math.max(2,Math.round(aw/40)),inBand=(i,j)=>i<band||j<band||i>=aw-band||j>=ah-band,samples=[];
 for(let j=0;j<ah;j+=2)for(let i=0;i<aw;i+=2)if(inBand(i,j)){const k=at(i,j);samples.push([r[k],g[k],b[k]]);}
 let C=Array.from({length:6},(_,k)=>samples[Math.floor((k+.5)*samples.length/6)].slice());
 for(let it=0;it<8;it++){
  const sum=C.map(()=>[0,0,0,0]);
  for(const s of samples){let best=0,bd=9;C.forEach((c,k)=>{const d=(s[0]-c[0])**2+(s[1]-c[1])**2+(s[2]-c[2])**2;if(d<bd){bd=d;best=k;}});const q=sum[best];q[0]+=s[0];q[1]+=s[1];q[2]+=s[2];q[3]++;}
  C=C.map((c,k)=>sum[k][3]?[sum[k][0]/sum[k][3],sum[k][1]/sum[k][3],sum[k][2]/sum[k][3]]:c);
  if(it===7)C=C.filter((c,k)=>sum[k][3]>=samples.length*.1);
 }
 // Only dominant border colours count as background: a monster cropped by the frame touches the
 // border too, but covers a minority of it, so its colours never join the background palette.
 const bgd=new Float32Array(AN);
 for(let j=0;j<ah;j++)for(let i=0;i<aw;i++){const k=at(i,j);let bd=9;for(const c of C)bd=Math.min(bd,(r[k]-c[0])**2+(g[k]-c[1])**2+(b[k]-c[2])**2);bgd[j*aw+i]=Math.sqrt(bd);}
 // Barrier height per pixel: an outline or an off-palette colour.
 const cost=boxBlur(edge,aw,ah,1,1),Q=new Uint8Array(AN);
 for(let i=0;i<AN;i++)Q[i]=Math.min(255,Math.round((cost[i]+bgd[i]*.6)*255));
 // Bucket-queue minimax fill (linear time): the lowest barrier crossed to reach a pixel from the seeds.
 const fill=seed=>{
  const D=new Uint8Array(AN).fill(255),buckets=Array.from({length:256},()=>[]);
  for(let k=0;k<AN;k++){const i=k%aw;if(seed(i,(k-i)/aw,k)){D[k]=0;buckets[0].push(k);}}
  for(let lvl=0;lvl<256;lvl++){const q=buckets[lvl];for(let n=0;n<q.length;n++){const k=q[n];if(D[k]!==lvl)continue;const i=k%aw,j=(k-i)/aw;
   for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=aw||jj>=ah)continue;const kk=jj*aw+ii,nd=Math.max(lvl,Q[kk]);if(nd<D[kk]){D[kk]=nd;buckets[nd].push(kk);}}}}
  return D;
 };
 const D=fill((i,j,k)=>inBand(i,j)&&bgd[k]<=.12);
 // Monsters are often cropped by the frame, so touching the border is not proof of background. A
 // second fill grows from the centre (pixels unlike the border palette) and each pixel goes to the
 // side reaching it over lower barriers: a dress touching the frame stays with the girl wearing it.
 let core=(i,j,k)=>Math.abs(i/aw-.5)<.17&&Math.abs(j/ah-.5)<.2&&bgd[k]>.12,coreN=0;
 for(let k=0;k<AN;k++){const i=k%aw;if(core(i,(k-i)/aw,k))coreN++;}
 if(coreN<50)core=(i,j)=>Math.abs(i/aw-.5)<.1&&Math.abs(j/ah-.5)<.1;
 const F=fill(core);
 // Otsu split of barrier heights: each card gets its own background/subject threshold.
 const hist=new Float64Array(256);let tot=0,sumAll=0;for(let i=0;i<AN;i++)hist[D[i]]++;
 for(let i=0;i<256;i++){tot+=hist[i];sumAll+=i*hist[i];}
 let w0=0,s0=0,best=0,T=64;
 for(let t=0;t<256;t++){w0+=hist[t];s0+=t*hist[t];if(!w0||w0===tot)continue;const m0=s0/w0,m1=(sumAll-s0)/(tot-w0),sb=w0*(tot-w0)*(m0-m1)**2;if(sb>best){best=sb;T=t;}}
 const blurL=boxBlur(lum,W,H,Math.max(1,Math.round(W/100))),pass=new Float32Array(N),energy=new Float32Array(N);
 for(let j=0;j<ah;j++)for(let i=0;i<aw;i++){
  const a=j*aw+i,k=at(i,j),mx=Math.max(r[k],g[k],b[k]),mn=Math.min(r[k],g[k],b[k]),sat=(mx-mn)/(mx+1e-4);
  const bg=(1-ss(T*.7,T*1.3,D[a]))*ss(-10,15,F[a]-D[a]);
  // Coloured glows pass anywhere; white only where it belongs to the background (white monster
  // bodies sit on the opaque underbase). Dark ink lines block the foil so the drawing stays crisp.
  let en=ss(.55,.8,mx)*ss(.45,.75,sat)*ss(.04,.14,Math.max(0,lum[k]-blurL[k])+.05);en=Math.max(en,ss(.7,.92,lum[k])*bg);
  pass[k]=Math.max(bg,en)*(1-(1-ss(.06,.2,lum[k]))*.85);energy[k]=en;
 }
 // Spells and Traps have no monster: their whole illustration is effect art. Their frames are teal
 // (Spell) or magenta (Trap), read from the left border, so they get broad coverage instead. Only the
 // standard layout has Spells and Traps; Pendulum and Skill borders are teal or blue but hold monsters.
 let fr=0,fg=0,fb=0,fn=0;
 for(let j=Math.round(.3*H);j<Math.round(.7*H);j+=2)for(let i=Math.round(.03*W);i<Math.round(.06*W);i++){const k=j*W+i;fr+=r[k];fg+=g[k];fb+=b[k];fn++;}
 fr/=fn;fg/=fn;fb/=fn;
 // Measured: Spell teal (.20,.63,.57), Trap magenta (.66,.26,.50); Fusion violet (.57,.35,.61) has blue above red.
 const spellTrap=box===YGO_ART_BOX&&((fg>fr+.3&&fb>fr+.25)||(fr>fg+.25&&fr>fb+.08));
 if(spellTrap)for(let j=0;j<ah;j++)for(let i=0;i<aw;i++){const k=at(i,j);pass[k]=Math.max(pass[k],.55*(1-(1-ss(.06,.2,lum[k]))*.85));}
 const passS=boxBlur(pass,W,H,1,1);
 // Level stars and the attribute orb. The orbs (bright red-orange rims, yellow stars) are far brighter than
 // any frame behind them (Effect orange stays under .78 red), and white/beige frames carry too much blue.
 const stars=new Float32Array(N);
 for(let j=Math.round(.112*H);j<Math.round(.17*H);j++)for(let i=Math.round(.08*W);i<Math.round(.92*W);i++){const k=j*W+i,mx=Math.max(r[k],g[k],b[k]),mn=Math.min(r[k],g[k],b[k]);if(r[k]>.84&&b[k]<.45*r[k]&&mx-mn>.35)stars[k]=1;}
 const ocx=.874*W,ocy=.081*H,orr=.042*W;
 for(let j=Math.max(0,Math.round(ocy-orr));j<ocy+orr;j++)for(let i=Math.max(0,Math.round(ocx-orr));i<Math.min(W,ocx+orr);i++)if((i-ocx)**2+(j-ocy)**2<orr*orr)stars[j*W+i]=Math.max(stars[j*W+i],.6);
 const height=boxBlur(lum,W,H,1,1);
 // Stroke direction (structure tensor) lets Collector's grooves follow the drawing's own lines.
 const Jxx=new Float32Array(N),Jyy=new Float32Array(N),Jxy=new Float32Array(N);
 for(let j=1;j<H-1;j++)for(let i=1;i<W-1;i++){const k=j*W+i,dx=lum[k+1]-lum[k-1],dy=lum[k+W]-lum[k-W];Jxx[k]=dx*dx;Jyy[k]=dy*dy;Jxy[k]=dx*dy;}
 const rad=Math.max(1,Math.round(W/130)),Sxx=boxBlur(Jxx,W,H,rad),Syy=boxBlur(Jyy,W,H,rad),Sxy=boxBlur(Jxy,W,H,rad);
 for(let k=0;k<N;k++){
  mask[k*4]=Math.round(Math.min(1,passS[k])*255);mask[k*4+1]=Math.round(energy[k]*255);mask[k*4+2]=Math.round(stars[k]*255);mask[k*4+3]=255;
  const a=Sxx[k]-Syy[k],c=2*Sxy[k],m=Math.hypot(a,c),coh=m/(Sxx[k]+Syy[k]+1e-6);
  relief[k*4]=Math.round(height[k]*255);relief[k*4+1]=Math.round((a/(m+1e-9)*.5+.5)*255);relief[k*4+2]=Math.round((c/(m+1e-9)*.5+.5)*255);relief[k*4+3]=Math.round(ss(.15,.7,coh)*Math.min(1,m*400)*255);
 }
 return {mask,relief,spellTrap};
}
