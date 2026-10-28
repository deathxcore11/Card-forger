// Production shutter handlers with synthetic pixels and a deterministic OCR stub.
// This exercises capture ownership and admission, not physical-camera/OCR accuracy.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {registerScanner,releaseOCR,SCAN_DEADLINES,scanQueryKey} from './scancam.js';
import {loadBatch,saveBatch} from './scan-batch.js';
import {counterCard,fill,rectangle} from './tests/fixtures/scan-geometry-fixtures.mjs';

const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
globalThis.location={href:'https://camera-fixture.invalid/'};
globalThis.ImageData=class {constructor(data,width,height){Object.assign(this,{data,width,height});}};
function canvas(label='canvas',width=224,height=300,data=null){
 const c={label,width,height,data};
 c.getContext=()=>({
  drawImage(source,...args){
   c.label=source.label;
   const sw=source.width||source.videoWidth,sh=source.height||source.videoHeight;
   let sx=0,sy=0,cw=sw,ch=sh,dx=0,dy=0,dw=c.width,dh=c.height;
   if(args.length===8)[sx,sy,cw,ch,dx,dy,dw,dh]=args;
   else if(args.length===4)[dx,dy,dw,dh]=args;
   else if(args.length===2)[dx,dy]=args;
   const out=new Uint8ClampedArray(c.width*c.height*4),pixels=source.data;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const xx=Math.max(0,Math.min(sw-1,Math.floor(sx+(x-dx+.5)*cw/dw))),yy=Math.max(0,Math.min(sh-1,Math.floor(sy+(y-dy+.5)*ch/dh))),at=(y*c.width+x)*4,from=(yy*sw+xx)*4;
    if(pixels)out.set(pixels.subarray(from,from+4),at);else out.set([110,110,110,255],at);
   }
   c.data=out;
  },
  getImageData(x,y,w=c.width,h=c.height){return {data:c.data||new Uint8ClampedArray(w*h*4).fill(110)};},
  putImageData(image){c.data=image.data;},translate(){},rotate(){},
 });
 c.toDataURL=()=>`data:image/jpeg;base64,${c.label}`;
 return c;
}
let video=null;
globalThis.document={createElement:()=>canvas(),getElementById:id=>id==='scanVideo'?video:null,addEventListener(){},querySelector:()=>null};
globalThis.window={Tesseract:{createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{text:'?',confidence:0}}),terminate:async()=>{}})}};
const wait=async fn=>{const start=Date.now();while(!fn()){assert(Date.now()-start<5000,'capture settles');await new Promise(r=>setTimeout(r,2));}};
const settled=()=>!S.ui.scan.busy&&loadBatch().every(x=>!['reading','captured'].includes(x.status));
function setup(g){
 S.state=blank();S.state.settings.game=g;S.ui.view='scan';S.ui.scan={auto:false};saveBatch([]);
 const ctx={A:{},C:{},game:()=>S.state.settings.game,render(){},toast(){},priceOf:()=>null,setOf:()=>'',numberOf:()=>'',match:async()=>({cands:[],tried:[]})};
 registerScanner(ctx);return ctx;
}
const limits={...SCAN_DEADLINES};
Object.assign(SCAN_DEADLINES,{worker:100,ocr:100,remote:100,local:100,hydration:100});
try{
 assert.notEqual(scanQueryKey('ptcg',{name:'Nidoran ♀'}),scanQueryKey('ptcg',{name:'Nidoran ♂'}),'retry cache cannot substitute one gendered identity for another');
 assert.notEqual(scanQueryKey('ptcg',{name:'Unown !'}),scanQueryKey('ptcg',{name:'Unown ?'}),'retry cache preserves Unown punctuation identities');
 for(const game of ['mtg','ptcg','ygo']){
  await releaseOCR();const ctx=setup(game),f=counterCard();
  // Visible physical border and readable-looking title, faint footer. The real
  // geometry detector accepts its outer card while the advisory sharpness fails.
  for(const top of [60,230])fill(f.data,f.w,f.h,rectangle(53,top,116,7),x=>x%9<5?[180,180,180]:[205,205,205]);
  video={...canvas(`${game}-manual-faint-footer`,f.w,f.h,f.data),videoWidth:f.w,videoHeight:f.h,clientWidth:f.w,clientHeight:f.h};
  ctx.A.scanCapture();
  assert.equal(S.ui.scan.boundaryReady,true,`${game}: fixture retains a supported whole-card boundary`);
  assert.match(S.ui.scan.guide.msg,/Blurry|Hold steady/,`${game}: quality advice remains visible`);
  assert.equal(loadBatch().length,1,`${game}: explicit shutter accepts current pixels despite advisory quality`);
  assert.equal(loadBatch()[0].originalShot,`data:image/jpeg;base64,${game}-manual-faint-footer`);
  ctx.A.scanCapture();assert.equal(loadBatch().length,1,`${game}: same-frame double tap stays debounced`);
  await wait(settled);assert.equal(loadBatch()[0].printingVerified,false,'unreadable capture cannot become a verified printing');ctx.stopCamera();
 }
 console.log('PASS: real manual shutter captures faint-footer frames across Magic, Pokémon and Yu-Gi-Oh!; double-tap guard and review requirement remain.');

 await releaseOCR();const ctx=setup('mtg');
 // Video metadata may arrive before CSS layout. A tap must never reuse the
 // previous screen's cached observation, nor throw while rendering catches up.
 video={...canvas('new-unlaid-frame'),videoWidth:224,videoHeight:300,clientWidth:0,clientHeight:0};
 assert.doesNotThrow(()=>ctx.A.scanCapture());
 assert.equal(loadBatch().length,1,'manual shutter can freeze available sensor pixels before preview layout');
 assert.equal(loadBatch()[0].originalShot,'data:image/jpeg;base64,new-unlaid-frame');
 await wait(settled);ctx.stopCamera();
 console.log('PASS: available sensor frame is captured before preview layout without stale observation reuse or a null-frame crash.');
}finally{Object.assign(SCAN_DEADLINES,limits);await releaseOCR();}
