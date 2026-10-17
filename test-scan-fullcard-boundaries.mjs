import assert from 'node:assert/strict';
import {detectCardQuad,normalizeQuad,quadArea,quadPoint,selectCardProposal,warpPixels} from './scan-vision.js';
import {boundaryFixtures,inside,rectangle} from './tests/fixtures/scan-geometry-fixtures.mjs';
const fixtures=boundaryFixtures();
for(const f of fixtures){
 const found=detectCardQuad(f.data,f.w,f.h);
 if(f.name.startsWith('isoluminant-counter')){
  assert(found,f.name+' finds an observed boundary');
  assert(Math.abs(quadArea(found.quad)-quadArea(f.quad))/quadArea(f.quad)<.12,f.name+' chooses whole card, not high-scoring artwork');
  if(!f.name.endsWith('rotated90')){
   for(const [u,v] of [[.5,.08],[.5,.93]]){const p=quadPoint(f.quad,u,v);assert(inside(p.x,p.y,found.quad),f.name+' retains title and collector bands');}
   assert.equal(found.cropSafe,true,f.name+' has an unambiguous geometric crop');
  }else{
   assert(found.nativeAspect>1,'rotated physical card remains native landscape');
   assert(found.outputWidth>found.outputHeight,'no fixed portrait deformation');
   assert.equal(found.cropSafe,false,'landscape orientation waits for text proof');
  }
 }
 if(['art-only','blank-page','two-cards','clipped-card','card-on-printed-page'].includes(f.name))assert(!found||!found.cropSafe,f.name+' cannot authorize an automatic whole-card crop');
 if(f.name==='blank-page'&&found)assert.equal(found.boundary.reason,'no-interior-card-detail');
 if(f.name==='two-cards'||f.name==='card-on-printed-page'){assert(found?.alternatives.length,'both cards remain available');assert.equal(found.boundary.reason,'competing-card-or-page-boundaries');}
 if(f.name==='counter-only')assert.equal(found,null,'textured counter is not a card');
 if(found){
  assert.equal(found.orientation.status,'unverified');assert.equal(found.orientation.rotation,0,'geometry never rotates text');
  assert.equal(found.fullCard.status,'unverified','outline confidence is not title/footer or card identity proof');
  assert(found.alternatives.length<=2,'fallback proposal count is bounded');
  assert(Math.max(found.outputWidth,found.outputHeight)<=672,'native warp work is bounded');
  assert(Math.abs(found.outputWidth/found.outputHeight-found.nativeAspect)<.006,'output keeps the native aspect');
 }
}
const landscape=rectangle(10,20,140,90),ordered=normalizeQuad(landscape);
assert.deepEqual(ordered,landscape,'wide rectangles keep screen-native corner order');
const pixels=new Uint8ClampedArray(180*140*4);for(let y=0;y<140;y++)for(let x=0;x<180;x++)pixels.set([x,y,0,255],(y*180+x)*4);
const warped=warpPixels(pixels,180,140,ordered,140,90);
assert(warped[0]<warped[(140-1)*4],'source x still increases left to right, not top to bottom');
assert(warped[1]<warped[(89*140)*4+1],'source y still increases top to bottom');
const proposal=(quad,score=1)=>{const width=quad[1].x-quad[0].x,height=quad[3].y-quad[0].y;return{quad,score,fraction:quadArea(quad)/(224*300),sideSupport:[1,1,1,1],edgeSupport:1,edges:4,source:'synthetic',width,height,nativeAspect:width/height,aspect:Math.min(width,height)/Math.max(width,height),interiorDetail:true};};
const nested=selectCardProposal([proposal(rectangle(20,15,184,260)),proposal(rectangle(65,85,90,126),.99)]);
assert.equal(nested.cropSafe,false,'a larger page/book cannot silently win over an equally card-shaped inner object');
assert.equal(nested.boundary.reason,'competing-card-or-page-boundaries');assert.equal(nested.alternatives.length,1);
const chain=selectCardProposal([proposal(rectangle(67,87,90,126),1),proposal(rectangle(58,74,108,152),.99),proposal(rectangle(50,62,124,176),.98)]);
assert.equal(chain.cropSafe,false,'near-frame grouping cannot transitively swallow a larger page');
assert.equal(detectCardQuad(new Uint8ClampedArray(3280),20.5,40),null,'fractional dimensions are invalid');
assert.equal(detectCardQuad(null,224,300),null,'missing pixels are invalid');
console.log('PASS: isoluminant textured counters retain full title/footer; native landscape/art/paper/two-card/clipped fallbacks and explicit unverified orientation.');
