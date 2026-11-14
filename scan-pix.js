// The picture clue: which card does this look like? A card's picture fingerprint is 48 bytes:
// for each of red, green and blue on its own, 63 bits for the art box and 63 for the whole card.
// Each bit says whether one broad light/dark pattern is stronger than that card's typical one, so
// a dim room (everything darker) or a warm lamp (red up, blue down) leaves the bits unchanged.
// The index (scanidx/<game>-pix-v2.bin) holds one fingerprint per catalogue row; a search is a
// bit-count over the whole index, a few thousandths of a second. Pure pixel maths, no DOM.
// scripts/build-scan-pix.mjs builds the index with this same code, so both sides always agree.

export const PIX_W=64,PIX_H=88,PIX_REC=48;
// Where the art sits on each game's card, as fractions [x, y, w, h] (same as scanart.js ART).
export const PIX_ART={mtg:[.08,.11,.84,.44],ptcg:[.08,.1,.84,.4],ygo:[.12,.18,.76,.52]};
const N=32,K=8;
const COS=Array.from({length:K},(_,u)=>Float32Array.from({length:N},(_,x)=>Math.cos(Math.PI*(2*x+1)*u/(2*N))));

// Any upright RGBA card picture -> PIX_W x PIX_H RGB planes (box filter: every source pixel counts once).
export function pixThumb(rgba,w,h){
 const out=[new Float32Array(PIX_W*PIX_H),new Float32Array(PIX_W*PIX_H),new Float32Array(PIX_W*PIX_H)];
 for(let y=0;y<PIX_H;y++){
  const y0=Math.floor(y*h/PIX_H),y1=Math.max(y0+1,Math.floor((y+1)*h/PIX_H));
  for(let x=0;x<PIX_W;x++){
   const x0=Math.floor(x*w/PIX_W),x1=Math.max(x0+1,Math.floor((x+1)*w/PIX_W));let r=0,g=0,b=0,n=0;
   for(let yy=y0;yy<y1&&yy<h;yy++)for(let xx=x0;xx<x1&&xx<w;xx++){const i=(yy*w+xx)*4;r+=rgba[i];g+=rgba[i+1];b+=rgba[i+2];n++;}
   const o=y*PIX_W+x;out[0][o]=r/n;out[1][o]=g/n;out[2][o]=b/n;
  }
 }
 return out;
}
// A region of a PIX_W x PIX_H plane, stretched to N x N (bilinear).
function square(plane,[fx,fy,fw,fh]){
 const out=new Float32Array(N*N),x0=fx*PIX_W,y0=fy*PIX_H,sw=fw*PIX_W,sh=fh*PIX_H;
 for(let y=0;y<N;y++){
  let sy=y0+(y+.5)*sh/N-.5;sy=sy<0?0:sy>PIX_H-1.001?PIX_H-1.001:sy;const yi=sy|0,fyy=sy-yi;
  for(let x=0;x<N;x++){
   let sx=x0+(x+.5)*sw/N-.5;sx=sx<0?0:sx>PIX_W-1.001?PIX_W-1.001:sx;const xi=sx|0,fxx=sx-xi,i=yi*PIX_W+xi;
   out[y*N+x]=plane[i]*(1-fxx)*(1-fyy)+plane[i+1]*fxx*(1-fyy)+plane[i+PIX_W]*(1-fxx)*fyy+plane[i+PIX_W+1]*fxx*fyy;
  }
 }
 return out;
}
// 63 broad patterns (the low 8 x 8 corner of the cosine transform, without the average), each above
// or below their middle value -> 8 bytes, last bit unused.
function bits(m,out,at){
 const rows=new Float32Array(K*N),d=new Float32Array(K*K);
 for(let u=0;u<K;u++)for(let x=0;x<N;x++){let s=0;for(let y=0;y<N;y++)s+=COS[u][y]*m[y*N+x];rows[u*N+x]=s;}
 for(let u=0;u<K;u++)for(let v=0;v<K;v++){let s=0;for(let x=0;x<N;x++)s+=rows[u*N+x]*COS[v][x];d[u*K+v]=s;}
 const rest=d.subarray(1),mid=Float32Array.from(rest).sort()[31];
 for(let k=0;k<8;k++)out[at+k]=0;
 for(let k=0;k<63;k++)if(rest[k]>mid)out[at+(k>>3)]|=0x80>>(k&7);
}
// Fingerprint from thumb planes (pixThumb). Layout: art R, card R, art G, card G, art B, card B.
export function pixHashThumb(planes,g='mtg'){
 const out=new Uint8Array(PIX_REC),art=PIX_ART[g]||PIX_ART.mtg;
 for(let c=0;c<3;c++){bits(square(planes[c],art),out,c*16);bits(square(planes[c],[0,0,1,1]),out,c*16+8);}
 return out;
}
export const pixHash=(rgba,w,h,g)=>pixHashThumb(pixThumb(rgba,w,h),g);

const POP=Uint8Array.from({length:256},(_,i)=>{let n=0;for(let b=i;b;b>>=1)n+=b&1;return n;});
// Fingerprints and the index read four bytes at a time (a 48-byte record is 12 words). The view
// is kept per buffer; a buffer that does not start on a word boundary is copied once.
const WORDS=new WeakMap();
function words(u8){
 let w=WORDS.get(u8);
 if(!w){const len=u8.length&~3;w=u8.byteOffset%4===0?new Uint32Array(u8.buffer,u8.byteOffset,len>>2):new Uint32Array(u8.slice(0,len).buffer);WORDS.set(u8,w);}
 return w;
}
const pop=v=>{v-=(v>>>1)&0x55555555;v=(v&0x33333333)+((v>>>2)&0x33333333);return (((v+(v>>>4))&0x0f0f0f0f)*0x01010101)>>>24;};
// The k closest index records to one or more fingerprints of the same capture (slightly different
// outlines of it: each record keeps its best). Distance: differing art bits count fully, whole-card
// bits half (frames repeat across cards; art does not). Lower is closer; 0 is the same picture,
// about 141 is an unrelated one. Records that are all zero (no picture known) are skipped.
// skip(row) leaves rows out (to find the closest different card). Returns [[row, distance], ...] closest first.
export function pixNearest(hashes,bin,k=12,skip=null){
 const hs=(hashes instanceof Uint8Array?[hashes]:hashes).map(words),B=words(bin),n=Math.floor(bin.length/PIX_REC),best=[];let worst=Infinity;
 for(let i=0;i<n;i++){
  const o=i*12;
  if(!(B[o]|B[o+1]|B[o+2]|B[o+3]|B[o+4]|B[o+5]|B[o+6]|B[o+7]|B[o+8]|B[o+9]|B[o+10]|B[o+11]))continue;
  if(skip&&skip(i))continue;
  let dist=Infinity;
  for(let j=0;j<hs.length;j++){
   const h=hs[j];
   // Art bits first: most records are ruled out before the whole-card bits are looked at.
   const a=pop(h[0]^B[o])+pop(h[1]^B[o+1])+pop(h[4]^B[o+4])+pop(h[5]^B[o+5])+pop(h[8]^B[o+8])+pop(h[9]^B[o+9]);
   if(a>=dist)continue;
   const d=a+.5*(pop(h[2]^B[o+2])+pop(h[3]^B[o+3])+pop(h[6]^B[o+6])+pop(h[7]^B[o+7])+pop(h[10]^B[o+10])+pop(h[11]^B[o+11]));
   if(d<dist)dist=d;
  }
  if(best.length<k||dist<worst){
   let at=best.length;while(at>0&&best[at-1][1]>dist)at--;
   best.splice(at,0,[i,dist]);if(best.length>k)best.pop();
   worst=best.length===k?best[k-1][1]:Infinity;
  }
 }
 return best;
}
// Distance from a capture's fingerprints to one index record, or null when that record has no picture.
export function pixDist(hashes,bin,row){
 const hs=hashes instanceof Uint8Array?[hashes]:hashes,o=row*PIX_REC;let z=0,dist=Infinity;
 for(let j=0;j<PIX_REC;j++)z|=bin[o+j];if(!z)return null;
 for(const h of hs){let a=0,f=0;for(let c=0;c<48;c+=16){for(let j=0;j<8;j++)a+=POP[h[c+j]^bin[o+c+j]];for(let j=8;j<16;j++)f+=POP[h[c+j]^bin[o+c+j]];}if(a+f*.5<dist)dist=a+f*.5;}
 return dist;
}
// The same thumb turned upside down (a card held the other way up).
export const pixFlip=planes=>planes.map(p=>Float32Array.from(p).reverse());
