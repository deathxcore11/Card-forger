import assert from 'node:assert/strict';
import {detectCardQuad,quadEdgeSupport,quadArea,quadPoint,normalizedQuality} from './scan-vision.js';

const inside=(x,y,q)=>{
 let hit=false;
 for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i].y>y)!==(q[j].y>y)&&x<(q[j].x-q[i].x)*(y-q[i].y)/(q[j].y-q[i].y)+q[i].x)hit=!hit;
 return hit;
};
const scene=(w,h,bg)=>{
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4,c=bg(x,y);data[p]=c[0];data[p+1]=c[1];data[p+2]=c[2];data[p+3]=255;}
 return data;
};
const paint=(data,w,h,q,color)=>{
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(inside(x+.5,y+.5,q)){const i=(y*w+x)*4,c=typeof color==='function'?color(x,y):color;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];}
};
const cropQuad=(q,x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>quadPoint(q,x,y));
const matchQuad=(found,expected,label)=>{
 assert(found,label+' is found');
 assert.equal(found.edges,4,label+' requires four observed boundaries');
 assert(found.sideSupport.every(x=>x>=.58),label+' reports actual per-side evidence');
 assert.equal(found.edgeSupport,Math.min(...found.sideSupport));
 assert(Math.abs(quadArea(found.quad)-quadArea(expected))/quadArea(expected)<.14,label+' follows the card, not surrounding texture or the art window');
 const centre=q=>({x:q.reduce((s,p)=>s+p.x,0)/4,y:q.reduce((s,p)=>s+p.y,0)/4});
 const a=centre(found.quad),b=centre(expected);assert(Math.hypot(a.x-b.x,a.y-b.y)<7,label+' centre stays on the card');
};
const w=260,h=340;
for(const [label,q,background,card] of [
 ['off-centre light card',[{x:18,y:45},{x:133,y:28},{x:163,y:204},{x:32,y:220}],()=>[25,28,30],[215,215,210]],
 ['rotated dark border',[{x:115,y:24},{x:218,y:80},{x:129,y:247},{x:30,y:191}],()=>[224,220,216],[30,32,40]],
 ['perspective card on texture',[{x:69,y:89},{x:187,y:94},{x:194,y:267},{x:59,y:260}],(x,y)=>{const n=40+(x*73+y*19+x*y)%55;return[n,n,n];},[215,190,55]],
]){
 const data=scene(w,h,background);paint(data,w,h,q,card);
 paint(data,w,h,cropQuad(q,.08,.19,.92,.60),(x,y)=>[70+(x*17+y*9)%80,80+(x*5+y*13)%70,90+(x*11+y*3)%80]);
 paint(data,w,h,cropQuad(q,.08,.83,.92,.87),[235,228,205]);
 matchQuad(detectCardQuad(data,w,h),q,label);
}

// The old largest-hull score accepted this area even though only disconnected
// texture, not a card, supports its apparent corners.
const texture=scene(w,h,(x,y)=>{const n=45+(x*29+y*71+x*y)%85;return[n,n,n];});
assert.equal(detectCardQuad(texture,w,h),null,'busy texture is not a four-sided card');
const bogus=[{x:25,y:15},{x:230,y:27},{x:212,y:305},{x:17,y:291}];
assert(quadEdgeSupport(texture,w,h,bogus).some(s=>s<.58),'background hull reports weak edge evidence');
assert.equal(detectCardQuad(scene(w,h,()=>[90,90,90]),w,h),null,'blank field is rejected');
assert.equal(detectCardQuad(new Uint8ClampedArray(5),w,h),null,'invalid image buffer is rejected');
assert.equal(detectCardQuad(new Uint8ClampedArray(10*10*4),10,10),null,'tiny image is rejected');

// A card partially outside the image must not get a fabricated fourth edge
// from clamping the sample to the camera boundary.
const clipped=[{x:-15,y:45},{x:111,y:45},{x:111,y:221},{x:-15,y:221}];
const partial=scene(w,h,()=>[28,28,28]);paint(partial,w,h,clipped,[220,220,220]);
assert.equal(detectCardQuad(partial,w,h),null,'clipped boundary is not evidence');

// Reproduce the reported dark mat + large false guide + smaller card geometry
// without shipping the user's private screenshot. A thin crossing line can
// connect a card to unrelated pixels; erosion separates it before hull fitting.
const q=[{x:66,y:91},{x:182,y:94},{x:190,y:260},{x:59,y:258}];
const joined=scene(w,h,(x,y)=>{const n=45+(x*17+y*11)%45;return[n,n,n];});
paint(joined,w,h,q,[225,191,59]);
paint(joined,w,h,cropQuad(q,.09,.19,.91,.58),[67,95,139]);
paint(joined,w,h,[{x:45,y:20},{x:47,y:20},{x:62,y:259},{x:60,y:259}],[215,184,60]);
paint(joined,w,h,[{x:45,y:20},{x:221,y:26},{x:221,y:28},{x:45,y:22}],[215,184,60]);
matchQuad(detectCardQuad(joined,w,h),q,'thin texture bridge beside actual card');
console.log('PASS: edge-supported free-angle card detection, light/dark/texture, clipped-card rejection, false oversized hull and thin-bridge regressions.');

// Capture quality uses BOTH identifier regions. Sharp art/title cannot conceal
// an unreadable footer, and white stock is reported as saturation, not certainty.
const sw=120,sh=168;
const white=scene(sw,sh,()=>[255,255,255]);
for(let y=5;y<27;y++)for(let x=8;x<110;x++)if((x*13+y*7)%11<4){const i=(y*sw+x)*4;white[i]=white[i+1]=white[i+2]=35;}
const washed=normalizedQuality(white,sw,sh);
assert(washed.nameSharp>150,'readable name has strong text detail');
assert.equal(washed.codeSharp,0,'washed-out number remains unreadable despite sharp title');
assert(washed.codeGlare>.95,'saturated footer is reported separately');
assert.equal(washed.glare,washed.rawGlare,'legacy glare field remains raw saturation');
const readable=white.slice();
for(let y=145;y<161;y++)for(let x=8;x<110;x++)if((x*11+y*5)%13<4){const i=(y*sw+x)*4;readable[i]=readable[i+1]=readable[i+2]=35;}
const paper=normalizedQuality(readable,sw,sh);
assert(paper.rawGlare>.7,'ordinary white card can have high raw saturation');
assert(paper.nameSharp>150&&paper.codeSharp>150,'both text bands remain readable on white card');
assert(paper.textGlare>=0&&paper.textGlare<=1,'text saturation is a bounded observed fraction');
console.log('PASS: separate title/footer sharpness, raw/text saturation, and readable white-stock ambiguity.');
