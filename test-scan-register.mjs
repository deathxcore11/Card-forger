// Picture line-up (scan-register.js): an outline that is several percent off (a sleeve's rim, a
// playmat edge) must be pulled onto the card, and a card that is not in the index must not be
// bent into a match.
import assert from 'node:assert/strict';
import {registerPicture,registerBest,middleStarts} from './scan-register.js';
import {pixHash,pixDist,PIX_REC} from './scan-pix.js';

let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
// A "card": smooth coloured blobs on a framed ground, 252 x 352.
function card(){
 const w=252,h=352,out=new Uint8ClampedArray(w*h*4),blobs=Array.from({length:14},()=>[rnd()*w,rnd()*h,20+rnd()*70,rnd()*255,rnd()*255,rnd()*255]);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let r=40,g=40,b=40,n=1;for(const [bx,by,br,cr,cg,cb] of blobs){const k=Math.exp(-((x-bx)**2+(y-by)**2)/(br*br));r+=cr*k;g+=cg*k;b+=cb*k;n+=k;}
  const i=(y*w+x)*4,edge=x<10||y<10||x>w-11||y>h-11;out[i]=edge?20:r/n;out[i+1]=edge?20:g/n;out[i+2]=edge?20:b/n;out[i+3]=255;}
 return out;
}
// The card pasted upright into a noisy 600 x 800 frame at (x0,y0), size cw x ch.
function frame(c,x0,y0,cw,ch){
 const W=600,H=800,out=new Uint8ClampedArray(W*H*4);
 for(let i=0;i<W*H;i++){const v=90+rnd()*40;out[i*4]=v;out[i*4+1]=v*.9;out[i*4+2]=v*.8;out[i*4+3]=255;}
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const sx=Math.min(251,Math.floor(x*252/cw)),sy=Math.min(351,Math.floor(y*352/ch)),i=((y0+y)*W+x0+x)*4,j=(sy*252+sx)*4;out[i]=c[j];out[i+1]=c[j+1];out[i+2]=c[j+2];}
 return {rgba:out,W,H};
}
const cards=Array.from({length:40},card),bin=new Uint8Array(cards.length*PIX_REC);
cards.forEach((c,i)=>bin.set(pixHash(c,252,352,'mtg'),i*PIX_REC));
const same=r=>r,rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];

// The card sits at 170,180 (252 x 352); the outline given is 8% too big and shifted, as a sleeve's rim would be.
const f=frame(cards[3],170,180,252,352),off=rect(150,158,286,396);
const loose=pixDist(pixHash(cards[3],252,352,'mtg'),bin,3);assert.equal(loose,0);
const reg=registerPicture(f.rgba,f.W,f.H,off,'mtg',bin,same);
assert.equal(reg.cards[0].key,3,'the right card leads after lining up');
assert.ok(reg.cards[0].dist<=30,`lined up closely (${reg.cards[0].dist})`);
assert.ok(!reg.cards[1]||reg.cards[1].dist-reg.cards[0].dist>=20,'and well ahead of the next card');
const q=reg.cards[0].quad;assert.ok(Math.abs(q[0].x-170)<14&&Math.abs(q[0].y-180)<14&&Math.abs(q[2].x-422)<14&&Math.abs(q[2].y-532)<14,'the outline moved onto the card');

// No outline at all: the middle-of-frame search finds a centred card.
const g=frame(cards[9],190,250,216,302),best=registerBest(g.rgba,g.W,g.H,null,'mtg',bin,same);
assert.equal(best.cards[0].key,9,'found without the finder');assert.ok(best.cards[0].dist<=46);
assert.ok(middleStarts(600,800).every(s=>s.length===4));

// A card the index does not hold stays far from everything, however the outline is nudged.
const stranger=frame(card(),170,180,252,352),none=registerBest(stranger.rgba,stranger.W,stranger.H,rect(170,180,252,352),'mtg',bin,same);
assert.ok(!none.cards[0]||none.cards[0].dist>58||(none.cards[1]&&none.cards[1].dist-none.cards[0].dist<20),'an unknown card is not named');
console.log('PASS: picture line-up recovers a sleeve-sized outline error, finds a centred card with no outline, and does not name an unknown card.');
