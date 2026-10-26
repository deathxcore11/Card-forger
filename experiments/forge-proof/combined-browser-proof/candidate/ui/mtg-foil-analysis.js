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
 borderless:{art:[0,0,1,1],text:[.070,.620,.930,.920]}
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
