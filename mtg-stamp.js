// Magic's holographic security stamp, read from the card picture itself. Stamps differ by printing (oval,
// triangle, acorn, heart, circle) and sit at different heights, so nothing here assumes a place or a shape:
// the stamp is the patch of light fully ringed by the dark border at the bottom centre of the card.
// No stamp found means no stamp drawn. Geometry is for presentation only, not authentication.
const ROI={x0:.36,x1:.64,y0:.835,y1:.992};
const lumAt=(d,i)=>d[i]*.299+d[i+1]*.587+d[i+2]*.114;
// rgba: full card pixels (W x H). Returns null, or the stamp's box as fractions of the card and an alpha mask
// (mw x mh, one byte per pixel) that follows the stamp's outline and the brightness of its print.
export function measureStamp(rgba,W,H){
 if(!rgba||W<120||H<160)return null;
 const x0=Math.floor(W*ROI.x0),x1=Math.ceil(W*ROI.x1),y0=Math.floor(H*ROI.y0),y1=Math.min(H,Math.ceil(H*ROI.y1)),w=x1-x0,h=y1-y0,n=w*h;
 const lum=new Float32Array(n),bright=new Uint8Array(n);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const l=lumAt(rgba,((y+y0)*W+x+x0)*4);lum[y*w+x]=l;bright[y*w+x]=l>=58?1:0;}
 // Light that reaches the edge of the search box is frame, text box or art, never the stamp.
 const out=new Uint8Array(n),stack=[];
 const push=i=>{if(bright[i]&&!out[i]){out[i]=1;stack.push(i);}};
 for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
 while(stack.length){const i=stack.pop(),x=i%w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<n-w)push(i+w);}
 // Enclosed islands of light.
 const label=new Int32Array(n),comps=[];
 for(let s=0;s<n;s++){if(!bright[s]||out[s]||label[s])continue;
  const id=comps.length+1,c={id,area:0,minX:w,maxX:0,minY:h,maxY:0};label[s]=id;stack.push(s);
  while(stack.length){const i=stack.pop(),x=i%w,y=(i-x)/w;c.area++;if(x<c.minX)c.minX=x;if(x>c.maxX)c.maxX=x;if(y<c.minY)c.minY=y;if(y>c.maxY)c.maxY=y;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h)continue;const j=Y*w+X;if(bright[j]&&!out[j]&&!label[j]){label[j]=id;stack.push(j);}}}
  comps.push(c);}
 const card=W*H,mid=W*.5-x0;
 const main=comps.filter(c=>c.area>=card*.00035&&Math.abs((c.minX+c.maxX)/2-mid)<=W*.045).sort((a,b)=>b.area-a.area)[0];
 if(!main)return null;
 // A stamp's own dark lines can split it into pieces. A piece joins when it is level with the main piece, inside
 // the widest box a stamp can take around the centre line, and only a thin dark line away from what is already joined.
 const keep=new Set([main.id]),rx=W*.058,gy=(main.maxY-main.minY+1)*.35,gap=Math.max(2,W*.008);
 let bx0=main.minX,bx1=main.maxX,by0=main.minY,by1=main.maxY;
 for(let grew=true;grew;){grew=false;for(const c of comps){if(keep.has(c.id)||c.area<Math.max(3,main.area*.03))continue;
  if(c.minX>=mid-rx&&c.maxX<=mid+rx&&c.minY>=main.minY-gy&&c.maxY<=main.maxY+gy&&c.minX<=bx1+gap&&c.maxX>=bx0-gap){keep.add(c.id);grew=true;bx0=Math.min(bx0,c.minX);bx1=Math.max(bx1,c.maxX);by0=Math.min(by0,c.minY);by1=Math.max(by1,c.maxY);}}}
 const mw=bx1-bx0+1,mh=by1-by0+1;
 if(mw<W*.035||mw>W*.14||mh<H*.016||mh>H*.08||mw/mh<.55||mw/mh>3.6)return null;
 if(Math.abs((bx0+bx1)/2-mid)>W*.04)return null;
 // Solid outline: a pixel is inside when it lies between the stamp's first and last pixel on both its row and its column.
 const on=(x,y)=>keep.has(label[(y+by0)*w+x+bx0]);
 const rowA=new Int32Array(mh).fill(mw),rowB=new Int32Array(mh).fill(-1),colA=new Int32Array(mw).fill(mh),colB=new Int32Array(mw).fill(-1);
 let filled=0;
 for(let y=0;y<mh;y++)for(let x=0;x<mw;x++)if(on(x,y)){if(x<rowA[y])rowA[y]=x;if(x>rowB[y])rowB[y]=x;if(y<colA[x])colA[x]=y;if(y>colB[x])colB[x]=y;}
 const shape=new Uint8Array(mw*mh);
 for(let y=0;y<mh;y++)for(let x=0;x<mw;x++)if(x>=rowA[y]&&x<=rowB[y]&&y>=colA[x]&&y<=colB[x]){shape[y*mw+x]=1;filled++;}
 if(filled<mw*mh*.42||filled<card*.0005||filled>card*.0065)return null;
 // Shine goes where the print is bright (the silver), not on its dark lines; the rim is feathered by one pixel.
 const raw=new Float32Array(mw*mh);
 for(let y=0;y<mh;y++)for(let x=0;x<mw;x++)if(shape[y*mw+x]){const l=lum[(y+by0)*w+x+bx0];raw[y*mw+x]=Math.max(0,Math.min(1,(l-45)/95));}
 const mask=new Uint8ClampedArray(mw*mh);
 for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){let s=0,k=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;k++;if(X>=0&&Y>=0&&X<mw&&Y<mh)s+=raw[Y*mw+X];}
  mask[y*mw+x]=Math.round(255*(raw[y*mw+x]*.6+s/k*.4)*shape[y*mw+x]);}
 return {x:(bx0+x0)/W,y:(by0+y0)/H,w:mw/W,h:mh/H,mw,mh,mask,cover:filled/(mw*mh)};
}
// Browser side: measure once per picture, from a readable copy at its full size.
const cache=new Map();
export function stampFor(src,readable){
 if(cache.has(src))return cache.get(src);
 const job=Promise.resolve().then(readable).then(img=>{
  const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,doc=img.ownerDocument||globalThis.document;if(!W||!H||!doc)return null;
  const c=doc.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,H);
  const s=measureStamp(x.getImageData(0,0,W,H).data,W,H);if(!s)return null;
  const m=doc.createElement('canvas');m.width=s.mw;m.height=s.mh;const mx=m.getContext('2d'),id=mx.createImageData(s.mw,s.mh);
  for(let i=0;i<s.mask.length;i++){id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=255;id.data[i*4+3]=s.mask[i];}
  mx.putImageData(id,0,0);return {x:s.x,y:s.y,w:s.w,h:s.h,url:m.toDataURL('image/png')};
 }).catch(()=>null);
 if(cache.size>60)cache.delete(cache.keys().next().value);
 cache.set(src,job);return job;
}
