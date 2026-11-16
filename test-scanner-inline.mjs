import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog} from './scan-catalog.js';
import {createScannerLookup,scannerLookupMatches,scannerNumberParts,reviewLookupCatalog} from './scanner-lookup.js';
import {createScannerBrowse,scannerBrowseHTML,scannerBrowseFilters,scannerLookupHTML} from './scanner-review.js';
import {registerScanner} from './scancam.js';
import {S,blank} from './store.js';
globalThis.localStorage={m:new Map(),getItem(k){return this.m.get(k)??null;},setItem(k,v){this.m.set(k,v)}};
globalThis.document={getElementById:()=>null,addEventListener(){}};
globalThis.fetch=async()=>{throw Error('No external calls in scanner fixtures');};
const pack=compileCatalog(JSON.parse(gunzipSync(fs.readFileSync('scanidx/ptcg-catalog-v1.json.gz'))));
let calls=0;
const lookup=createScannerLookup({local:async()=>pack,candById:async()=>{calls++;return null;},sources:{},match:async()=>({cands:[]})});
const found=await lookup('ptcg',{name:'Bewear',number:'056/111'});assert.equal(found.length,1);assert.equal(found[0].id,'sm4-56');assert.equal(found[0].exact,false);assert.equal(calls,1);
const byNumber=await lookup('ptcg',{number:'56/111'});assert(byNumber.some(c=>c.id==='sm4-56'));assert(byNumber.every(c=>c.card.set.total===111));
assert.equal(scannerLookupMatches('ptcg',found[0],{number:'56/112'}),false);assert.equal(scannerLookupMatches('ptcg',found[0],{name:'Bewear ex',strictName:true}),false);
assert.deepEqual(scannerNumberParts('mtg','MH3 0123'),{set:'mh3',number:'0123',total:''});assert.equal(scannerNumberParts('mtg','56 OR anything'),null);
assert.equal(scannerLookupMatches('ygo',{card:{name:'Card'},print:'LOB-JP001|Rare'},{number:'LOB-EN001'}),false);
assert.equal(scannerLookupMatches('mtg',{card:{set:'mh3',collector_number:'123',name:'Card'}},{number:'MH3 0123'}),true);
assert.deepEqual(await lookup('ptcg',{name:'Bewear'},{isCurrent:()=>false}),[]);

// A first-time number-only lookup must use the complete denominator index,
// without relying on the first page of a remote card-number search.
const offlineFetch=globalThis.fetch,packRequests=[];
globalThis.fetch=async url=>{packRequests.push(url);if(url==='scanidx/catalog-manifest.json')return Response.json(JSON.parse(fs.readFileSync(url)));if(url==='scanidx/ptcg-catalog-v1.json.gz')return new Response(fs.readFileSync(url));throw Error('Unexpected lookup download: '+url);};
assert.equal(await reviewLookupCatalog('mtg',{number:'MH3 123'}),null);
assert.equal(await reviewLookupCatalog('ptcg'),null);assert.equal(packRequests.length,0);
const coldLookup=createScannerLookup({candById:async()=>null,sources:{ptcg:{byNameNumber:()=>{throw Error('Exact fraction must resolve from our identity pack');}}}});
assert((await coldLookup('ptcg',{number:'56/111'})).some(c=>c.id==='sm4-56'));
assert((await coldLookup('ptcg',{name:'Bewear',number:'56/111'})).some(c=>c.id==='sm4-56'));
assert.deepEqual(packRequests,['scanidx/catalog-manifest.json','scanidx/ptcg-catalog-v1.json.gz'],'One compact identity download, shared across subsequent lookups');
globalThis.fetch=offlineFetch;

const card={id:'fixture',oracle_id:'oracle',name:'Fixture',set:'one',set_name:'First set',collector_number:'123',finishes:['nonfoil','foil'],image_uris:{normal:'https://example.test/card.jpg'}};
let current=true,selected=0,preview=0,release;
const b=createScannerBrowse({game:'mtg',card,loadPage:async()=>({cards:[card,{...card,id:'other',set:'two',set_name:'Second set',collector_number:'124'}],nextCursor:null}),onSelect:()=>{selected++;return true;}},{current:()=>current,draw(){},preview:()=>preview++});
await b.load();assert.equal(b.rows.length,4);assert.match(scannerBrowseHTML(b),/aria-roledescription="carousel"/);assert.doesNotMatch(scannerBrowseHTML(b),/openSheet|Choose a printing<\/h2>/);
assert.match(scannerBrowseFilters(b),/Scanned card number/);b.filter('number','123');assert.equal(preview,1);b.choose(b.rows[0].key);assert.equal(selected,1);assert.equal(b.selectedKey,b.rows[0].key);b.clear();assert.equal(b.selectedKey,'');
current=false;b.choose(b.rows[0].key);assert.equal(selected,1);
const stale=createScannerBrowse({game:'mtg',card,loadPage:()=>new Promise(r=>release=r)},{current:()=>true,draw(){}});const pending=stale.load();stale.close();release({cards:[card]});await pending;assert.equal(stale.rows.length,2,'Cancelled response does not append rows to the initial preview');
assert.doesNotMatch(scannerLookupHTML({game:'ptcg'}),/scanIdentifyAI|\bAI\b/,'the correction sheet offers no AI read');

console.log('PASS: inline carousel/filter identity; real Bewear number lookup; all-game strict matching; no AI read on the correction sheet.');

// Loading printings in the same panel must not cancel an already confirmed
// condition selection; only changing the actual card/finish invalidates it.
S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.sheetCtx=null;
const pricingActions={};let finishLoad,quoteCurrent=false;
registerScanner({A:pricingActions,C:{},inlinePrinting:true,game:()=> 'mtg',render(){},toast(){},priceOf:()=>7.25,openPrintingPicker:()=>new Promise(r=>finishLoad=r),requestConditionPrice:(_g,_c,_f,_s,_done,current)=>{quoteCurrent=current();return {status:'available'};}});
S.ui.scan={cands:[{id:card.id,name:card.name,card,printingConfirmed:true}],confirm:{game:'mtg',i:0,finish:'nonfoil',condition:'Lightly Played',lang:'en',qty:1,priceStatus:'unavailable'}};
const opening=pricingActions.scanChangePrinting();pricingActions.scanRetryConditionPrice();assert(quoteCurrent,'An inline catalogue request does not pause condition pricing');finishLoad();await opening;
