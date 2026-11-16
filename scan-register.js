// Lines the card up by its picture. The outline finder gives a rough outline; real photos (a sleeve
// around the card, glare along one edge, a busy playmat) leave it a few percent off, and a few
// percent is enough to spoil a fingerprint. So: fingerprint several versions of the outline, pool
// the cards they point at, then nudge the outline's corners and sides for each pooled card and
// keep whatever makes that card's fingerprint agree best. The right card improves a lot; a wrong
// card barely moves, which is what tells them apart.
import {boxShrink} from './scan-find.js';
import {pixHashThumb,pixNearest,pixDist,pixFlip,PIX_W,PIX_H} from './scan-pix.js';

const len=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const about=(q,k)=>{const cx=(q[0].x+q[1].x+q[2].x+q[3].x)/4,cy=(q[0].y+q[1].y+q[2].y+q[3].y)/4;return q.map(p=>({x:cx+(p.x-cx)*k,y:cy+(p.y-cy)*k}));};
// The outline's upright bounding box, at the card's proportions (63 x 88) about the same centre.
function box(q){
 const xs=q.map(p=>p.x),ys=q.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 return [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
}
const area=q=>Math.abs((q[2].x-q[0].x)*(q[3].y-q[1].y)-(q[3].x-q[1].x)*(q[2].y-q[0].y))/2;
// Nudging may not bend the outline into something no card seen through a camera looks like: a
// wrong card can be made to "match" by a shape that is no longer a card.
function cardLike(q,area0){
 const top=len(q[0],q[1]),bottom=len(q[3],q[2]),left=len(q[0],q[3]),right=len(q[1],q[2]);
 if(!(top>2&&bottom>2&&left>2&&right>2))return false;
 const a=(top+bottom)/(left+right),lr=left/right,tb=top/bottom,ar=area(q)/area0;
 return a>.56&&a<.9&&lr>.72&&lr<1.39&&tb>.6&&tb<1.67&&ar>.6&&ar<1.5;
}
// Corners and whole sides, each moved along x or y: 16 + 8 moves.
const MOVES=[];
for(let c=0;c<4;c++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])MOVES.push([[c],dx,dy]);
for(const [a,b,dx,dy] of [[0,3,1,0],[0,3,-1,0],[1,2,1,0],[1,2,-1,0],[0,1,0,1],[0,1,0,-1],[2,3,0,1],[2,3,0,-1]])MOVES.push([[a,b],dx,dy]);

// rgba w x h: the frame. quad: rough outline, corners clockwise from top-left, upright as best known.
// bin: the game's picture index. cardOf(record) -> a key shared by records of the same card.
// Returns {cards: [{key, rec, dist, quad, flipped, hash}] closest first (quad in frame pixels,
// upright: when flipped the corners are already turned), evals}.
export function registerPicture(rgba,w,h,quad,g,bin,cardOf,{cards:keep=4,quick=30,quickGap=24,starts:given=null,flips=true}={}){
 const cw=(len(quad[0],quad[1])+len(quad[3],quad[2]))/2;if(!(cw>4))return {cards:[],evals:0};
 const f=Math.min(1,96/cw),sw=Math.max(8,Math.round(w*f)),sh=Math.max(8,Math.round(h*f)),small=f<1?boxShrink(rgba,w,h,sw,sh):rgba,kx=sw/w,ky=sh/h;
 const q0=quad.map(p=>({x:p.x*kx,y:p.y*ky}));let evals=0;
 // The outline warped straight to fingerprint-size colour planes (2 x 2 samples per cell).
 const thumb=q=>{
  const W=PIX_W,H=PIX_H,n=PIX_W*PIX_H,R=new Float32Array(n),G=new Float32Array(n),B=new Float32Array(n);
  const [a,b,c,d]=q,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y,den=dx1*dy2-dx2*dy1;
  const gg=Math.abs(den)>1e-8?(dx3*dy2-dx2*dy3)/den:0,hh=Math.abs(den)>1e-8?(dx1*dy3-dx3*dy1)/den:0,ax=b.x-a.x+gg*b.x,bx=d.x-a.x+hh*d.x,ay=b.y-a.y+gg*b.y,by=d.y-a.y+hh*d.y;
  for(let y=0;y<H;y++){
   const v=(y+.5)/H,row=y*PIX_W;
   for(let x=0;x<W;x++){
    const u=(x+.5)/W,z=gg*u+hh*v+1;let xx=(ax*u+bx*v+a.x)/z,yy=(ay*u+by*v+a.y)/z;
    xx=xx<0?0:xx>sw-1?sw-1:xx;yy=yy<0?0:yy>sh-1?sh-1:yy;
    const i=((yy|0)*sw+(xx|0))*4,o=row+x;R[o]+=small[i];G[o]+=small[i+1];B[o]+=small[i+2];
   }
  }
  evals++;return [R,G,B]; // sums of four samples: the fingerprint only compares, so no divide
 };
 const starts=[];
 if(given)for(const q of given)starts.push(q.map(p=>({x:p.x*kx,y:p.y*ky})));
 else{for(const k of [1.03,1,.97,.94,.9])starts.push(about(q0,k));const bq=box(q0);for(const k of [1,.95])starts.push(about(bq,k));}
 const hashes=[];
 for(const q of starts){const t=thumb(q);hashes.push({q,flipped:false,hash:pixHashThumb(t,g)});if(flips)hashes.push({q,flipped:true,hash:pixHashThumb(pixFlip(t),g)});}
 // Pool: the closest records to any version, one (its best) per card.
 const seen=new Map();
 for(const [rec,dist] of pixNearest(hashes.map(x=>x.hash),bin,72)){const key=cardOf(rec);if(key==null)continue;if(!seen.has(key))seen.set(key,{key,rec,dist});}
 let pool=[...seen.values()].slice(0,keep*3);
 for(const c of pool){let best=null;for(const x of hashes){const d=pixDist(x.hash,bin,c.rec);if(d!==null&&(!best||d<best.d))best={d,x};}c.dist=best.d;c.q=best.x.q;c.flipped=best.x.flipped;c.hash=best.x.hash;}
 pool.sort((a,b)=>a.dist-b.dist);
 const clear=pool.length&&pool[0].dist<=quick&&(!pool[1]||pool[1].dist-pool[0].dist>=quickGap);
 const fit=(c,steps=[.05,.025,.012],most=3)=>{
  const hashOf=q=>{const t=thumb(q);return pixHashThumb(c.flipped?pixFlip(t):t,g);};
  const own=(len(c.q[0],c.q[1])+len(c.q[3],c.q[2]))/2,area0=area(c.q);
  for(const step of steps){
   const s=step*own;let moved=true,rounds=0;
   while(moved&&rounds++<most){
    moved=false;
    for(const [idx,dx,dy] of MOVES){
     const t=c.q.map(p=>({x:p.x,y:p.y}));for(const i of idx){t[i].x+=dx*s;t[i].y+=dy*s;}
     if(!cardLike(t,area0))continue;
     const hash=hashOf(t),d=pixDist(hash,bin,c.rec);
     if(d<c.dist-.5){c.dist=d;c.q=t;c.hash=hash;moved=true;}
    }
   }
  }
 };
 // A clear winner needs no nudging. Otherwise nudge the leaders: the right card pulls ahead.
 // First one coarse round for every pooled card (the right card, even from a poor start, jumps
 // ahead; wrong cards hardly move), then the full nudging for the leaders only.
 if(!clear){
  for(const c of pool)fit(c,[.05],1);
  pool.sort((a,b)=>a.dist-b.dist);
  for(const c of pool.slice(0,keep))fit(c);
  pool.sort((a,b)=>a.dist-b.dist);
 }
 return {evals,cards:pool.map(c=>{const q=c.q.map(p=>({x:p.x/kx,y:p.y/ky}));return {key:c.key,rec:c.rec,dist:c.dist,flipped:c.flipped,hash:c.hash,quad:c.flipped?[q[2],q[3],q[0],q[1]]:q};})};
}

// Outlines to try when the finder could not outline the card (a dark card on a busy playmat): a
// card around the middle of the frame, at five sizes, nine places and three turns. People centre
// the card; the nudging does the rest.
export function middleStarts(w,h){
 const out=[];
 for(const size of [.42,.5,.6,.72,.84]){
  const ch=Math.min(h*size,w*.96*88/63),cw=ch*63/88;
  for(const turn of size<.84?[0,-.19,.19]:[0])for(const dx of [-.08,0,.08])for(const dy of [-.08,0,.08]){
   const cx=w/2+dx*w,cy=h/2+dy*h,co=Math.cos(turn),si=Math.sin(turn);
   out.push([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:cx+a*cw/2*co-b*ch/2*si,y:cy+a*cw/2*si+b*ch/2*co})));
  }
 }
 return out;
}
// The whole look for one game: the finder's outline first; when that does not name a card clearly
// (or there is no outline), the middle-of-frame outlines. Returns the clearer of the two.
export function registerBest(rgba,w,h,quad,g,bin,cardOf,{clear:isClear=(d,r)=>(d<=58&&r-d>=20)||(d<=46&&r-d>=14),fallback=true}={}){
 const clear=r=>!!r?.cards[0]&&isClear(r.cards[0].dist,r.cards[1]?r.cards[1].dist:Infinity);
 const first=quad?registerPicture(rgba,w,h,quad,g,bin,cardOf):null;
 if(clear(first)||!fallback)return first||{cards:[],evals:0};
 const starts=middleStarts(w,h),second=registerPicture(rgba,w,h,starts[58],g,bin,cardOf,{starts,flips:false});
 if(clear(second)||!first?.cards.length)return second;
 return second.cards[0]&&second.cards[0].dist<first.cards[0].dist?second:first;
}
