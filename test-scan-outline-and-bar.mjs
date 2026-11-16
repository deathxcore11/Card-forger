// Approved 15 Nov 2026 (scanner messages mock): the outline's place on the preview, and the one message bar over Add.
import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.addEventListener=()=>{};globalThis.document={querySelector:()=>null,getElementById:()=>null,addEventListener(){}};
const {outlinePoints}=await import('./scancam.js'),{scanGridView,tileTag}=await import('./scan-grid.js');

// Corners the scanner found on the owner's Twin Twisters photo (frame 984 x 1210), on a 412 x 706 phone preview.
const quad=[{x:.193,y:.208},{x:.716,y:.180},{x:.741,y:.741},{x:.240,y:.749}],k=706/1210,cut=(984*k-412)/2;
const pts=outlinePoints(quad,984,1210,412,706).split(' ').map(p=>p.split(',').map(Number));
assert.equal(pts.length,4);
assert(Math.abs(pts[0][0]-(.193*984*k-cut))<.1&&Math.abs(pts[0][1]-.208*706)<.1,'the frame is scaled to fill and its sides cropped evenly');
assert(pts.every(([x,y])=>x>0&&x<412&&y>0&&y<706),'the whole card is inside the preview');
// A preview the frame's own shape needs no crop.
assert.equal(outlinePoints([{x:.5,y:.5}],984,1210,492,605),'246.0,302.5');

// The owner's screen: two Yu-Gi-Oh! cards ready, the save failed.
const card=(id,name,sub)=>({id,game:'ygo',status:'ready',qty:1,condition:'Near Mint',finish:'1st-edition',cands:[{id,name,sub}]});
const rows=[card('a','Jizukiru, the Star Destroying Kaiju','MP16-EN235 · Rare'),card('b','Virtual World Mai-Hime - Lulu','MP21-EN173 · Prismatic Secret Rare')];
const helpers={counts:{ready:2,review:0,reading:0},destinations:[{value:'',label:'Collection'}],destination:'',finishLabel:(g,c,f)=>f,game:'ygo'};
const html=scanGridView({gridError:'2 not added',gridErrorWhy:'No connection',gridErrorRetry:true},rows,helpers);
const bar=html.slice(html.indexOf('class="scan-grid-bar"'));
assert.match(bar,/^class="scan-grid-bar"><div class="scan-grid-error is-failed" role="alert"><span>2 not added<\/span><em>No connection<\/em><button class="scan-grid-retry" data-act="scanBatchAddAll"/,'one bar, inside the Add bar, directly over the button, with Retry');
assert.equal(html.split('scan-grid-error').length-1,1,'the message appears once');
assert.doesNotMatch(html,/still here|not verified|try again/i);
assert(html.indexOf('scan-grid-error')>html.indexOf('class="scan-grid"'),'never above the cards');
// No failure: no bar. Another note (a binder name) has no Retry.
assert.doesNotMatch(scanGridView({},rows,helpers),/scan-grid-error/);
assert.doesNotMatch(scanGridView({gridError:'Name the binder',gridErrorRetry:true,gridErrorWhy:'No connection'},rows,helpers),/scan-grid-retry|<em>/);

// A card's own problem is a short tag on the card.
assert.equal(tileTag({game:'ygo',status:'review',reason:'Pick printing',cands:[{id:'b',name:'Lulu'}]}),'Pick printing');
assert.equal(tileTag({game:'ygo',status:'review',reason:'Pick finish',cands:[{id:'b',name:'Lulu'}]}),'Pick edition');
assert.equal(tileTag({game:'mtg',status:'review',reason:'Pick finish',cands:[{id:'b',name:'Bolt'}]}),'Pick finish');
assert.equal(tileTag({game:'ygo',status:'unresolved',reason:'Retry',cands:[]}),'Retry');
assert.equal(tileTag({game:'ygo',status:'unresolved',reason:'',cands:[]}),'Rescan');
const look=scanGridView({},[{...rows[1],status:'review',reason:'Pick printing',cands:[{id:'b',name:'Virtual World Mai-Hime - Lulu',print:'MP21-EN173|Prismatic Secret Rare'},{id:'b',name:'Virtual World Mai-Hime - Lulu',print:'PHRA-EN010|Ultra Rare'}]}],{...helpers,counts:{ready:0,review:1,reading:0}});
assert.match(look,/scan-tile-state is-warn">Pick printing</);assert.match(look,/2 printings</);
console.log('scanner outline and message bar: ok');
