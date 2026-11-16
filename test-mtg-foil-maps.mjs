// Per-card foil maps on real Scryfall scans (Foil Test Bench, approved 16 Nov 2026). Each check guards a fault the owner saw:
//  - "really lazy mapping": the foil was placed with one fixed rectangle per frame type, so on special frames its box edge
//    showed. Now each card's boxes snap to its own frame lines, and a box whose lines are not on the card is not used
//    (Llanowar Elves FDN 439, Japanese showcase: no standard rules box), and a printed gold frame's picture window is found by
//    its shape, however uneven (Smaug the Magnificent HOB 249).
//  - "3 lies in a row": on the silver scroll card the name plate was mapped as paper, so it never turned to mirror silver.
//    Culling the Weak SOA 157: the name plate is silver ink, the cat's fur is neither ink nor paper, the rules box is paper.
//  - a second shooting star was drawn on scans that already carry one: Eternal Witness P30A 12 has it (found), Counterspell
//    DMR 281 is a nonfoil scan without one (none found, so the shader draws it).
// Scans are 336 x 468 (the maps' own size), except silver scroll: its 672 x 936 'large' scan, which the foil reads for that
// pattern because the plates of the 488 px 'normal' scan are too noisy to read as flat (checked on SOA 131-185). Software decoding in a desktop browser; this checks the maps, not a phone.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),PROBE=!!process.env.MAP_PROBE;
const {MTG_FRAMES}=await import('./mtg-foil-analysis.js'),F1997text=MTG_FRAMES['1997'].text;
const page_js=`window.run=async()=>{
 const A=await import('/mtg-foil-analysis.js');const px=async f=>{const i=new Image();i.src='/test-fixtures/mtg-foil-maps/'+f+'.jpg';await i.decode();
  const c=document.createElement('canvas');c.width=336;c.height=468;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(i,0,0,336,468);return x.getImageData(0,0,336,468).data;};
 const W=336,H=468,F=A.MTG_FRAMES,o={};
 // mean of a map over a box given in card fractions
 const mean=(m,stride,ch,[x0,y0,x1,y1])=>{let s=0,n=0;for(let y=Math.round(y0*H);y<Math.round(y1*H);y++)for(let x=Math.round(x0*W);x<Math.round(x1*W);x++){s+=m[(y*W+x)*stride+ch];n++;}return s/n/(stride===4?255:1);};
 {const p=await px('silverscroll'),m=A.mtgCardMaps(p,W,H,{pat:23,frame:F.borderless}).mask;
  o.silver={plate:Math.min(mean(m,4,0,[.08,.06,.12,.21]),mean(m,4,0,[.16,.06,.2,.21])),plateAsPaper:mean(m,4,2,[.04,.03,.2,.24]),furInk:mean(m,4,0,[.45,.12,.6,.22]),furPaper:mean(m,4,2,[.45,.12,.6,.22]),paper:mean(m,4,2,[.2,.7,.8,.82]),bottomFrame:mean(m,4,0,[.3,.955,.7,.975])};}
 {const p=await px('retro_witness');o.star=A.findScanStar(p,W,H,F['1997'].text);}
 {const p=await px('retro_counterspell');o.nostar=A.findScanStar(p,W,H,F['1997'].text);}
 {const p=await px('gleaming'),a=A.artWindow(p,W,H);o.smaug={centre:mean(a,1,0,[.4,.4,.6,.55]),leftFrame:mean(a,1,0,[.0,.3,.04,.6]),bottomFrame:mean(a,1,0,[.3,.9,.7,.97])};}
 {const p=await px('fracture');o.fracture=A.cardBoxes(p,W,H,F['2015']);}
 {const p=await px('retro_counterspell');o.counterspell=A.cardBoxes(p,W,H,F['1997']);}
 return o;};window.ready=1;`;
const html=`<!doctype html><script type=module>${page_js}</script>`;
const types={'.js':'text/javascript','.jpg':'image/jpeg'};
const server=createServer(async(q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);if(p==='/')return s.end(html);
 const b=await readFile(resolve(root,'.'+p));s.setHeader('Content-Type',types[extname(p)]||'application/octet-stream');s.end(b);}catch{s.statusCode=404;s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
try{const pg=await browser.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto(`http://127.0.0.1:${server.address().port}/`);await pg.waitForFunction(()=>window.ready);const o=await pg.evaluate(()=>window.run());
 if(PROBE)console.log(JSON.stringify(o,null,1));
 assert.deepEqual(errs,[]);
 assert(o.silver.plate>.8&&o.silver.plateAsPaper<.05,`SOA 157: the name plate (beside its letters) is silver ink, not paper (ink ${o.silver.plate.toFixed(2)}, paper ${o.silver.plateAsPaper.toFixed(2)})`);
 assert(o.silver.furInk<.25&&o.silver.furPaper<.1,`SOA 157: the cat's fur is bare silver picture, neither plate ink nor paper (ink ${o.silver.furInk.toFixed(2)}, paper ${o.silver.furPaper.toFixed(2)})`);
 assert(o.silver.paper>.8,`SOA 157: the rules box is paper (${o.silver.paper.toFixed(2)})`);
 assert(o.silver.bottomFrame>.5,`SOA 157: the bottom frame is silver ink (${o.silver.bottomFrame.toFixed(2)})`);
 assert(o.star&&Math.abs(o.star.x-(F1997text[0]+.10))<.04&&Math.abs(o.star.y-F1997text[3])<.03,`P30A 12: the scan's own star is found at the rules box corner (${JSON.stringify(o.star)})`);
 assert.equal(o.nostar,null,'DMR 281 (nonfoil scan): no star found, so the shader draws one');
 assert(o.smaug.centre>.9&&o.smaug.leftFrame<.1&&o.smaug.bottomFrame<.1,`HOB 249: the picture window is the picture, the gold frame is not (${JSON.stringify(o.smaug)})`);
 assert.deepEqual(o.fracture.art,[0,0,1,1],'FDN 439 Japanese showcase: no standard picture box on this card, so none is used');
 assert(o.counterspell.text.some((v,i)=>v!==F1997text[i]),"DMR 281: the rules box snaps to this card's own frame lines");
 console.log('PASS: per-card foil maps on real scans: silver scroll plate/fur/paper (SOA 157), the scan\'s own star found (P30A 12) and none on a nonfoil scan (DMR 281), Smaug\'s gold-frame window, boxes dropped where the card has none (FDN 439) and snapped where it does (DMR 281).');
}finally{await browser.close();server.close();}
