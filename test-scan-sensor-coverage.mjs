// Public synthetic pixels only. No camera, browser, OCR, network, or image files.
import assert from 'node:assert/strict';
import {analysisRegions,selectSensorProposal,detectCardQuad,quadArea,normalizedQuality,warpPixels} from './scan-vision.js';
import {boundaryFixtures,inside,rectangle,rotate90} from './tests/fixtures/scan-geometry-fixtures.mjs';

const round=n=>Math.round(n*1000)/1000;
const cropScale=(data,w,h,r)=>{
 const out=new Uint8ClampedArray(r.width*r.height*4);
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
  const xx=Math.max(0,Math.min(w-1,Math.floor(r.x+(x+.5)*r.w/r.width))),yy=Math.max(0,Math.min(h-1,Math.floor(r.y+(y+.5)*r.h/r.height)));
  out.set(data.subarray((yy*w+xx)*4,(yy*w+xx)*4+4),(y*r.width+x)*4);
 }
 return out;
};
const fixture=({w=720,h=1280,area=.32,angle=0,x,y,cardW,cardH,mode='clear',background='plain'}={})=>{
 const hh=cardH??Math.sqrt(area*w*h/(63/88)),ww=cardW??hh*63/88,cx=(x??(w-ww)/2)+ww/2,cy=(y??(h-hh)/2)+hh/2;
 const a=angle*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a),point=(u,v)=>({x:cx+(u-.5)*ww*cs-(v-.5)*hh*sn,y:cy+(u-.5)*ww*sn+(v-.5)*hh*cs});
 const data=new Uint8ClampedArray(w*h*4),quad=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>point(u,v));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=((x-cx)*cs+(y-cy)*sn)/ww+.5,v=(-(x-cx)*sn+(y-cy)*cs)/hh+.5;
  let rgb=[35,47,50];
  if(background==='wood'){const n=(x*17+y*11)%35;rgb=[125+n,100+n,75+n];}
  if(background==='busy'){const n=45+(x*29+y*71+x*y)%85;rgb=[n,n,n];}
  if(u>=0&&u<1&&v>=0&&v<1&&mode!=='empty'){
   rgb=[220,195,60];
   if(u>.045&&u<.955&&v>.025&&v<.975)rgb=[205,205,205];
   if(u>.07&&u<.93&&v>.18&&v<.60)rgb=[55+(x*3+y)%90,60+(x+y*7)%80,85+(x*3+y*2)%100];
   if(u>.08&&u<.92&&((v>.05&&v<.105)||(v>.90&&v<.94)))rgb=(Math.floor(u*40)%3<2)?[35,35,35]:[205,205,205];
   if(mode==='central-glare'&&u>.30&&u<.70&&v>.25&&v<.65)rgb=[255,255,255];
   if(mode==='title-glare'&&u>.045&&u<.955&&v>.025&&v<.18)rgb=[255,255,255];
   if(mode==='footer-glare'&&u>.045&&u<.955&&v>.84&&v<.975)rgb=[255,255,255];
  }
  data.set([...rgb,255],(y*w+x)*4);
 }
 return {w,h,data,quad,point};
};
function analyze(f,cw=378,ch=416){
 const observations=analysisRegions(f.w,f.h,cw,ch).map(region=>{
  const pixels=cropScale(f.data,f.w,f.h,region);
  return {region,pixels,proposal:detectCardQuad(pixels,region.width,region.height)};
 });
 const found=selectSensorProposal(observations,f.w,f.h);
 let quality=null;
 if(found){
  const o=observations.find(o=>o.region===found.analysis.region);
  assert(o,'quality region keeps its original object identity');
  const quad=found.outputWidth>found.outputHeight?[found.analysis.quad[3],found.analysis.quad[0],found.analysis.quad[1],found.analysis.quad[2]]:found.analysis.quad;
  quality=normalizedQuality(warpPixels(o.pixels,o.region.width,o.region.height,quad,120,168),120,168);
  for(let i=0;i<4;i++){
   const p=found.analysis.quad[i],r=found.analysis.region;
   assert(Math.abs(r.x+p.x*r.w/r.width-found.quad[i].x)<1e-8,'x mapping uses independently rounded width');
   assert(Math.abs(r.y+p.y*r.h/r.height-found.quad[i].y)<1e-8,'y mapping uses independently rounded height');
  }
  assert.equal(found.orientation.status,'unverified');
  assert.equal(found.fullCard.status,'unverified','geometric coverage never verifies card identity');
  assert(found.alternatives.length<=2,'cross-view alternatives stay bounded');
 }
 return {observations,found,quality};
}
const viewStats=(o,f)=>({kind:o.region.kind,resolution:[o.region.width,o.region.height],cropSafe:o.proposal?.cropSafe??false,reason:o.proposal?.boundary.reason||'no-proposal',cardPixels:f?.quad?[round(Math.hypot(f.quad[1].x-f.quad[0].x,f.quad[1].y-f.quad[0].y)*o.region.width/o.region.w),round(Math.hypot(f.quad[3].x-f.quad[0].x,f.quad[3].y-f.quad[0].y)*o.region.height/o.region.h)]:null});
const qualityStats=q=>q&&({nameSharp:round(q.nameSharp),codeSharp:round(q.codeSharp),nameGlare:round(q.nameGlare),codeGlare:round(q.codeGlare)});

const regions=analysisRegions(720,1280,378,416);
assert.equal(regions.length,2);assert.deepEqual(regions[0],{kind:'sensor',x:0,y:0,w:720,h:1280,width:144,height:256});
assert.deepEqual([regions[1].width,regions[1].height],[192,211]);
assert.equal(analysisRegions(720,1280,360,640).length,1,'identical preview needs only one detector pass');
assert.deepEqual(analysisRegions(0,1280,378,416),[]);assert.equal(selectSensorProposal([],720,1280),null);
for(const [w,h,cw,ch] of [[720,1280,378,416],[1280,720,378,416],[1280,720,700,200],[960,1280,378,800],[4032,3024,378,416]]){
 const list=analysisRegions(w,h,cw,ch);
 assert(list.length<=2);assert(list.every(r=>r.width<=192&&r.height<=256),'each of at most two detector passes is bounded');
 assert(list.reduce((n,r)=>n+r.width*r.height,0)<=2*192*256);
}

// Recorded frozen 6110af1 preview-only baseline, verified with the old module
// imported in memory against these same pixels. The quality baseline applies
// production's landscape quality rotation. Occupancy means physical card area
// / sensor area, not the sometimes clipped preview. This test prints that
// recorded comparison; it does not require a historical Git object to run.
const beforeSafe=[true,true,true,true,true,true,false,false];
const beforeSharp=[[982.825,735.590],[1680.020,1365.980],[2909.733,2408.804],[3539.165,2996.100],[4650.938,4000.597],[3009.232,3696.168],[805.533,782.085],[919.403,921.458]],occupancy=[];
for(const [i,area] of [.04,.08,.18,.32,.46,.54,.62,.70].entries()){
 const f=fixture({area}),a=analyze(f),{found}=a;
 assert.equal(found?.cropSafe,true,`${area*100}% full-sensor-visible card remains supported`);
 assert(Math.abs(quadArea(found.quad)/quadArea(f.quad)-1)<.14,'selected boundary follows the real outer card');
 for(const [u,v] of [[.5,.05],[.5,.94]]){const p=f.point(u,v);assert(inside(p.x,p.y,found.quad),`${area*100}% retains both identifier bands`);}
 if(area===.04){assert.equal(a.observations[0].proposal,null,'full-frame-only misses the distant card');assert.equal(found.analysis.region.kind,'preview','existing high-density far-card view is retained');}
 if(area>=.54){assert.equal(found.analysis.detectedRegion.kind,'sensor','sensor outer edge wins over preview internal frame/art');assert.equal(found.analysis.region.kind,'sensor','quality does not sample a clipped preview');}
 const preview=a.observations.find(o=>o.region.kind==='preview'),r=preview.region;
 const previewContainsCard=f.quad.every(p=>p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.w&&p.y<=r.y+r.h);
 occupancy.push({sensorOccupancy:area,beforePreviewSafe:beforeSafe[i],beforePreviewSharp:{name:beforeSharp[i][0],code:beforeSharp[i][1]},previewContainsCard,views:a.observations.map(o=>viewStats(o,f)),afterSafe:found.cropSafe,afterSensorArea:round(found.fraction),boundaryView:found.analysis.detectedRegion.kind,qualityView:found.analysis.region.kind,quality:qualityStats(a.quality)});
}
assert.equal(occupancy[5].beforePreviewSafe,true);assert.equal(occupancy[5].previewContainsCard,false,'54% regression used to accept clipped inner frame');

const variations=[];
for(const opts of [
 {label:'tilt-3',angle:3},{label:'tilt-15',angle:15},
 {label:'off-centre-top',area:.18,x:25,y:70},{label:'off-centre-bottom',area:.18,x:340,y:750},
 {label:'landscape-sensor-portrait-preview',w:1280,h:720,area:.18,x:40,y:90},
 {label:'wood',background:'wood'},{label:'busy-texture',background:'busy'},
 {label:'central-glare',mode:'central-glare'},{label:'title-glare',mode:'title-glare'},{label:'footer-glare',mode:'footer-glare'}
]){
 const f=fixture(opts),a=analyze(f);
 if(!opts.label.endsWith('glare'))assert.equal(a.found?.cropSafe,true,opts.label+' keeps independently supported full card');
 if(a.found?.cropSafe)assert(Math.abs(quadArea(a.found.quad)/quadArea(f.quad)-1)<.14,opts.label+' does not substitute artwork');
 variations.push({label:opts.label,safe:a.found?.cropSafe??false,reason:a.found?.boundary.reason||'no-proposal',qualityView:a.found?.analysis.region.kind,quality:qualityStats(a.quality)});
}
const rotated=analyze(rotate90(fixture()));
assert(!rotated.found?.cropSafe,'landscape card is not stretched into an auto-eligible portrait');
assert(!rotated.found||rotated.found.outputWidth>rotated.found.outputHeight);
const clear=occupancy[3].quality,title=variations.find(v=>v.label==='title-glare').quality,footer=variations.find(v=>v.label==='footer-glare').quality;
assert(title.nameGlare>clear.nameGlare,'title glare is reported in selected full-card coordinates');
assert(footer.codeGlare>clear.codeGlare,'footer glare is reported independently');
assert(title.nameSharp<clear.nameSharp&&footer.codeSharp<clear.codeSharp,'identifier washout cannot borrow other-band sharpness');

// Optical-information loss is modeled before detector resizing: area averaging
// to a coarse sensor grid, then bilinear enlargement. No nearest-neighbor bars
// are treated as actual letters, and geometry-safe never means OCR-readable.
function opticalLoss(f,factor){
 const w=Math.ceil(f.w/factor),h=Math.ceil(f.h/factor),small=new Float32Array(w*h*4),counts=new Uint32Array(w*h);
 for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){const at=Math.floor(y/factor)*w+Math.floor(x/factor),src=(y*f.w+x)*4;counts[at]++;for(let k=0;k<3;k++)small[at*4+k]+=f.data[src+k];}
 for(let i=0;i<counts.length;i++){for(let k=0;k<3;k++)small[i*4+k]/=counts[i];small[i*4+3]=255;}
 const data=new Uint8ClampedArray(f.data.length);
 for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){const sx=Math.max(0,Math.min(w-1,(x+.5)/factor-.5)),sy=Math.max(0,Math.min(h-1,(y+.5)/factor-.5)),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),dx=sx-x0,dy=sy-y0;for(let k=0;k<3;k++)data[(y*f.w+x)*4+k]=small[(y0*w+x0)*4+k]*(1-dx)*(1-dy)+small[(y0*w+x1)*4+k]*dx*(1-dy)+small[(y1*w+x0)*4+k]*(1-dx)*dy+small[(y1*w+x1)*4+k]*dx*dy;data[(y*f.w+x)*4+3]=255;}
 return {...f,data};
}
const optical=[];
for(const area of [.04,.18,.54]){
 const f=fixture({area}),base=normalizedQuality(warpPixels(f.data,f.w,f.h,f.quad,120,168),120,168);
 for(const factor of [4,12,24]){
  const degraded=opticalLoss(f,factor),a=analyze(degraded),q=normalizedQuality(warpPixels(degraded.data,f.w,f.h,f.quad,120,168),120,168);
  assert(q.nameSharp<base.nameSharp&&q.codeSharp<base.codeSharp,'both identifier bands reflect lost optical detail');
  if(a.found?.cropSafe)assert(Math.abs(quadArea(a.found.quad)/quadArea(f.quad)-1)<.20,'degraded safe proposal still covers outer card rather than artwork');
  optical.push({sensorOccupancy:area,opticalDownsample:factor,cardOpticalPixels:[round(Math.hypot(f.quad[1].x-f.quad[0].x,f.quad[1].y-f.quad[0].y)/factor),round(Math.hypot(f.quad[3].x-f.quad[0].x,f.quad[3].y-f.quad[0].y)/factor)],safe:a.found?.cropSafe??false,reason:a.found?.boundary.reason||'no-proposal',detectedQuality:qualityStats(a.quality),knownFullCardQuality:qualityStats(q),knownFullCardSharpRatio:{name:round(q.nameSharp/base.nameSharp),code:round(q.codeSharp/base.codeSharp)}});
 }
}
assert(optical.filter(x=>x.opticalDownsample===24).every(x=>x.knownFullCardSharpRatio.name<.15&&x.knownFullCardSharpRatio.code<.15),'heavy optical loss cannot retain sharp-band values');

// One outer card edge is outside the actual sensor while a complete-looking
// printed inner frame remains visible. Refinement must not launder that missing
// edge into an automatic crop. Exercise both axes and all four sensor borders.
const clipping=[];
for(const background of ['plain','wood','busy'])for(const side of ['left','right','top','bottom'])for(const amount of [5,10,20]){
 const cardW=600,cardH=600*88/63;
 const x=side==='left'?-amount:side==='right'?720-cardW+amount:60;
 const y=side==='top'?-amount:side==='bottom'?1280-cardH+amount:200;
 const a=analyze(fixture({cardW,cardH,x,y,background}));
 // All twelve plain-background cases were independently re-run against the
 // frozen 6110af1 detector and incorrectly called safe before this change.
 clipping.push({background,side,amount,beforeFullSensorSafe:background==='plain'?true:'not-recorded',safe:a.found?.cropSafe??false,reason:a.found?.boundary.reason||'no-proposal'});
 assert(!a.found?.cropSafe,`${background} ${side} ${amount}px actual sensor clipping with an inner border is unsafe`);
}

// Existing art/page/texture/two-card fixtures must remain conservative through
// both views, including a second card visible only to the full sensor.
const adversarial=[];
for(const f of boundaryFixtures()){
 const a=analyze(f);
 if(['art-only','blank-page','two-cards','clipped-card','card-on-printed-page','counter-only'].includes(f.name))assert(!a.found?.cropSafe,f.name+' is not promoted by cross-view fusion');
 adversarial.push({name:f.name,safe:a.found?.cropSafe??false,reason:a.found?.boundary.reason||'no-proposal'});
}
assert.equal(analyze(fixture({mode:'empty',background:'busy'})).found,null,'busy background alone remains rejected');

// Deterministic agreement/conflict tests, independent of detector masks.
const mock=(sensorQuad,region,{safe=true,score=1,reason='supported-outer-boundary'}={})=>{
 const quad=sensorQuad.map(p=>({x:(p.x-region.x)*region.width/region.w,y:(p.y-region.y)*region.height/region.h})),width=Math.hypot(quad[1].x-quad[0].x,quad[1].y-quad[0].y),height=Math.hypot(quad[3].x-quad[0].x,quad[3].y-quad[0].y);
 return {quad,width,height,nativeAspect:width/height,aspect:Math.min(width,height)/Math.max(width,height),score,fraction:quadArea(quad)/(region.width*region.height),source:'synthetic',sideSupport:[1,1,1,1],edgeSupport:1,edges:4,interiorDetail:true,endBandsDetailed:true,cropSafe:safe,boundary:{reason},alternatives:[]};
};
const [sensor,preview]=regions,q=rectangle(220,450,220,310),p=mock(q,sensor);
const agreed=selectSensorProposal([{region:sensor,proposal:p},{region:preview,proposal:mock(q,preview)}],720,1280);
assert.equal(agreed.cropSafe,true);assert.equal(agreed.analysis.region,preview,'complete agreed card keeps higher-density quality');
for(let i=0;i<4;i++){assert(Math.abs(agreed.quad[i].x-q[i].x)<1e-8);assert(Math.abs(agreed.quad[i].y-q[i].y)<1e-8);}
const conflict=selectSensorProposal([{region:sensor,proposal:mock(rectangle(20,450,180,250),sensor)},{region:preview,proposal:mock(rectangle(460,500,180,250),preview,{score:.9})}],720,1280);
assert.equal(conflict.cropSafe,false,'independent sensor and preview subjects cannot be reconciled by score');assert.equal(conflict.boundary.reason,'competing-card-or-page-boundaries');
assert.equal(conflict.alternatives.length,1);
const expectedAlternative=rectangle(460,500,180,250);
for(let i=0;i<4;i++)assert(Math.hypot(conflict.alternatives[0].quad[i].x-expectedAlternative[i].x,conflict.alternatives[0].quad[i].y-expectedAlternative[i].y)<1e-8,'alternatives also use retained-sensor coordinates');
assert(Math.abs(conflict.alternatives[0].fraction-180*250/(720*1280))<1e-8);
const page=selectSensorProposal([{region:sensor,proposal:mock(rectangle(80,200,560,800),sensor)},{region:preview,proposal:mock(rectangle(240,450,200,280),preview)}],720,1280);
assert.equal(page.cropSafe,false,'larger full-sensor page does not overrule preview card ambiguity');
const unsafe=selectSensorProposal([{region:sensor,proposal:mock(q,sensor,{safe:false,reason:'identifier-bands-not-established'})}],720,1280);
assert.equal(unsafe.cropSafe,false);assert.equal(unsafe.boundary.reason,'identifier-bands-not-established','fusion never upgrades originally unsafe evidence');
const edge=mock(rectangle(200,preview.y+3*preview.h/preview.height,300,390),preview);
const previewOnly=selectSensorProposal([{region:sensor,proposal:null},{region:preview,proposal:edge}],720,1280);
assert.equal(previewOnly.cropSafe,false,'preview-clipped frame cannot establish missing full-card edges without sensor evidence');
assert.equal(previewOnly.boundary.reason,'preview-edge-needs-sensor-boundary');
console.log(JSON.stringify({baseline:'Recorded frozen 6110af1 same-frame in-memory A/B: preview-only occupancy and full-sensor clipping.',limits:'Synthetic resampling with9 coarse-optical/blur scenes and pure CV only, not Android focus, camera latency, text readability, OCR accuracy, or physical-device acceptance.',occupancy,variations,optical,clipping,adversarial},null,2));
console.log('PASS: bounded sensor + cover-preview coverage, exact coordinate mapping, small-card resolution, clipped-edge/inner-frame rejection, quality-band reporting, and cross-view ambiguity.');
