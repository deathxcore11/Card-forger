import assert from 'node:assert/strict';
import fs from 'node:fs';
import {textVerifiedMatch,scanConfirmation,scanView,registerScanner,recoverScanCandidates,initialReviewIndex,scanSavedMarkup} from './scancam.js';
import {S,blank} from './store.js';
import {savePrefs,loadPrefs,loadSession,DEFAULT_PREFS} from './scansession.js';
import {registerTcg,SOURCES,cache} from './tcg.js';
globalThis.fetch=async url=>{throw Error('Unexpected external request in scanner confirmation fixture: '+String(url));};
globalThis.localStorage={m:new Map(),getItem(k){return this.m.get(k)??null;},setItem(k,v){this.m.set(k,v)}};
globalThis.document={getElementById:()=>null,addEventListener(){}};
const names=['Kyogre','Cosmog','Reshiram'];
for(const name of names){
 const c={name,exact:true,card:{name,set:{number:'3',total:25}}};
 assert.equal(textVerifiedMatch('ptcg',c,{name,code:'003/025'}),true);
 assert.equal(textVerifiedMatch('ptcg',{...c,name:name+' ex',card:{...c.card,name:name+' ex'}},{name,code:'003/025'}),false);
 assert.equal(textVerifiedMatch('ptcg',c,{name,code:'003/197'}),false);
 assert.equal(textVerifiedMatch('ptcg',c,{name,code:''}),false,'art-only cannot be quick-added');
}
assert.equal(textVerifiedMatch('mtg',{name:'Lightning Bolt',exact:true,card:{set:'m11',collector_number:'146'}},{name:'Lightning Bolt',code:'146/249 C\nM11 EN'}),true);
assert.equal(textVerifiedMatch('mtg',{name:'Lightning Bolt',exact:true,card:{set:'m11',collector_number:'146'}},{name:'Shock',code:'146/249 C\nM11 EN'}),false);
assert.equal(textVerifiedMatch('ygo',{name:'Dark Magician',exact:true,print:'LOB-EN005|Ultra Rare',card:{}},{name:'Dark Magician',code:'LOB-EN005'}),true);
assert.equal(textVerifiedMatch('ygo',{name:'Dark Magician',exact:true,print:'LOB-EN005|Ultra Rare',card:{}},{name:'Dark Magician',code:'LOB-EN001'}),false);
assert.equal(DEFAULT_PREFS.quick,false);
localStorage.setItem('cardstashy-scan-prefs-v1',JSON.stringify({shared:{quick:true}}));
assert.equal(loadPrefs('ptcg').quick,false,'old automatic-add default must not bypass the new popup');
savePrefs('ptcg',{quick:true});assert.equal(loadPrefs('ptcg').quick,true,'explicit quick-add still works');
savePrefs('ptcg',{quick:false});
let renders=0,saves=0,gate,fail=false;
const A={},C={},ctx={A,C,render:()=>renders++,toast(){},game:()=>S.state.settings.game,setOf:()=> 'TEST',numberOf:()=> '3',priceOf:()=>1.5,async addMany(g,items){saves++;assert.equal(items[0].qty,3);assert.equal(items[0].condition,'Lightly Played');assert.equal(items[0].lang,'ja');if(fail)throw Error('save failed');if(gate)await gate.promise;},details(){}};
registerScanner(ctx);
for(const g of ['mtg','ptcg','ygo']){
 S.state=blank();S.state.settings.game=g;S.ui.view='scan';
 savePrefs(g,{sounds:false,haptics:false});
 const cand={id:'card',name:'Demo card',sub:'Test set #3',exact:false,card:{id:'card',name:'Demo card',game:g,image:'',finishes:['nonfoil'],variants:[{key:'normal'}]}};
 const setup=()=>{S.ui.scan={mode:'live',camOn:true,cands:[cand],read:{name:'Demo card',code:''},confirm:{i:0,qty:1,condition:'Near Mint',lang:'en',finish:{mtg:'nonfoil',ptcg:'normal',ygo:'unlimited'}[g],price:1.5,saving:false,error:''}};};
 setup();
 const html=scanView(g,g);
 assert.match(html,/id="camSlot"/);assert.match(html,/Confirm scanned card/);assert.match(html,/Add to collection/);assert.doesNotMatch(html,/sc-compare|Which one is it/);assert.match(html,/Estimated price/);assert.match(html,/Scanned card language/);assert.doesNotMatch(html,/Defaults for scanned cards|Capture automatically|Scanned cards/,'one set of controls while confirming');
 assert.match(scanConfirmation(g,S.ui.scan,{}),/Possible match/);
 A.scanConfirmQty({dataset:{d:'-1'}});assert.equal(S.ui.scan.confirm.qty,1);
 A.scanConfirmQty({dataset:{d:'1'}});A.scanConfirmQty({dataset:{d:'1'}});A.scanConfirmCondition({dataset:{condition:'Lightly Played'}});C.scanConfirmLanguage({value:'ja'});
 let resolve;gate={promise:new Promise(r=>resolve=r)};const count=saves;
 const first=A.scanConfirm();await A.scanConfirm();assert.equal(saves,count+1,'one save despite double tap');assert.equal(S.ui.scan.confirm.saving,true);
 resolve();await first;gate=null;
 assert.equal(S.ui.scan.camOn,true,'save keeps camera live');assert.equal(S.ui.scan.confirm,null);assert.deepEqual(loadSession(g),[],'direct save cannot also enqueue a duplicate');
 setup();S.ui.scan.confirm.qty=3;S.ui.scan.confirm.condition='Lightly Played';S.ui.scan.confirm.lang='ja';fail=true;await A.scanConfirm();fail=false;
 assert.match(S.ui.scan.confirm.error,/Couldn't save/);assert.equal(S.ui.scan.confirm.saving,false);assert.equal(S.ui.scan.cands.length,1,'failed save retains match');
 A.scanDismiss();assert.equal(S.ui.scan.camOn,true);assert.equal(S.ui.scan.confirm,null);
}
// A real lookup returning a wrong total and an ex suffix cannot become an exact Pokémon match.
S.state=blank();S.state.settings.game='ptcg';
const cards=[{id:'correct',name:'Kyogre',game:'ptcg',set:{number:'3',total:25}}, {id:'wrong-total',name:'Kyogre',game:'ptcg',set:{number:'3',total:197}}, {id:'wrong-suffix',name:'Kyogre ex',game:'ptcg',set:{number:'3',total:25}}].map(c=>({...c,variantSchema:9,priceFallbackSchema:3,fetchedAt:new Date().toISOString(),variants:[],prices:{},image:`https://assets.tcgdex.net/en/test/${c.id}/high.webp`}));
for(const c of cards)cache.ptcg[c.id]=c;
const old={search:SOURCES.ptcg.search,byNameNumber:SOURCES.ptcg.byNameNumber};
SOURCES.ptcg.byNameNumber=async()=>cards;
SOURCES.ptcg.search=async()=>({cards});
const tcg={A:{},C:{},I:{},writeRecord:async()=>{},render(){},toast(){},openSheet(){},closeSheet(){},go(){}};registerTcg(tcg);
const result=await tcg.scanMatch({name:'Kyogre',code:'003/025',full:''},'eng',false,()=>{},'ptcg');
assert.deepEqual(result.cands.filter(c=>c.exact).map(c=>c.id),['correct']);
const prints=await tcg.scanPrintings('ptcg',{name:'Kyogre'});assert.ok(prints.length>0);assert.ok(prints.every(p=>p.id!=='wrong-suffix'));
Object.assign(SOURCES.ptcg,old);
const source=fs.readFileSync('scancam.js','utf8');
assert.doesNotMatch(source,/id="camGuide"|<polygon/,'camera detection has no visible outline or mask');
assert.match(source,/if \(s\(\)\.confirm\)/);assert.match(source,/frame=freezeCapture\(v\).original/);assert.doesNotMatch(source,/flattenCapture\(v,/,'live original is frozen before any crop is derived');
console.log('PASS: all-game identifier gates, Pokémon suffix/number collisions, compact live confirmation, quantity/condition, direct save, duplicate-submit protection, failed-save recovery and camera continuity.');

for(const g of ['mtg','ptcg','ygo']){
 const candidate={id:'visual-card',name:g==='ptcg'?'Kyogre':'Known Card',exact:true,card:{name:g==='ptcg'?'Kyogre':'Known Card'}};
 const r=recoverScanCandidates(g,{cands:[],tried:['Nonsensical OCR']},{cands:[candidate],tried:['art']},{name:'Nonsensical OCR'});
 assert.equal(r.cands.length,1,'noisy OCR cannot erase an available visual suggestion');assert.equal(r.cands[0].exact,false,'visual recovery still requires confirmation');
 assert.equal(textVerifiedMatch(g,r.cands[0],{name:'Nonsensical OCR'}),false);
 const empty=scanConfirmation(g,{cands:[],shot:'data:image/png;base64,AA',confirm:{unresolved:true}},{});
 assert.match(empty,/Your captured card/);assert.doesNotMatch(empty,/Find card|scanMatchName/,'failed reads do not demand catalogue hunting');assert.match(empty,/Saved for later/);assert.match(empty,/Scan again/);assert.doesNotMatch(empty,/data-act="scanConfirm"/,'unidentified card cannot be saved as a fabricated match');
}
console.log('PASS: noisy-title visual recovery and nonblocking retry review in all games; unverified artwork never becomes an exact printing.');

S.state=blank();S.state.settings.game='ptcg';S.ui.view='scan';let lookups=0,writes=0;
const retryA={};registerScanner({A:retryA,C:{},render(){},toast(){},game:()=> 'ptcg',setOf:()=>'',numberOf:()=>'',priceOf:()=>null,async candById(){if(++lookups===1)throw Error('temporary lookup outage');return {id:'retry-card',name:'Retry card',card:{id:'retry-card',name:'Retry card',game:'ptcg',variants:[{key:'normal'}]}};},async addMany(){writes++;}});
S.ui.scan={camOn:true,cands:[{id:'retry-card',name:'Retry card',localReference:true,card:{id:'retry-card',name:'Retry card'}}],confirm:{i:0,qty:1,condition:'Near Mint',lang:'en',finish:'normal'}};
await retryA.scanConfirm();assert.equal(lookups,2);assert.equal(writes,1);assert.equal(S.ui.scan.confirm,null);assert.equal(S.ui.scan.camOn,true);
console.log('PASS: transient identifier hydration is retried once; collection writes still happen only once.');

for(const key of ['identityConflict','identifierConflict','signalConflict']){
 assert.equal(initialReviewIndex({cands:[{[key]:true}]}),-1);
 assert.equal(initialReviewIndex({cands:[{[key]:true}],selectedIndex:0}),0,'explicit review remains selected');
}
assert.equal(initialReviewIndex({cands:[{}]}),0);
assert.equal(initialReviewIndex({cands:[]}),-1);
assert.match(scanSavedMarkup({name:'Test',condition:'Lightly Played',finish:'holo',qty:2,price:3.25}),/6.50/);
assert.match(scanSavedMarkup({name:'Test',condition:'Damaged',finish:'holo',qty:1,price:null}),/Condition price unavailable/);
assert.doesNotMatch(scanSavedMarkup({name:'<script>',condition:'Damaged',finish:'holo',qty:1,price:NaN}),/<script>|NaN/);
