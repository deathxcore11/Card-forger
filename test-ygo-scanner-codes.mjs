import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {parseYgoSetCode,ygoCodeReadings,ygoSetCodes,detectGame,mtgCollectors,mtgCollector} from './scan.js';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {scanIdentifierEvidence,rankScanCandidates} from './scan-signals.js';
import {textVerifiedMatch,registerScanner} from './scancam.js';
import {createScannerLookup,scannerNumberParts} from './scanner-lookup.js';
import {cleanScanHints} from './scan-identify-route.js';
import {resolvedEntry,saveBatch,loadBatch} from './scan-batch.js';
import {registerTcg,cache,SOURCES,ui} from './tcg.js';
import {normalizeYgoSets} from './ygo.js';
import {S,blank} from './store.js';

// Only checked-in identity metadata and injected providers. No user photo,
// external requests, provider prices, AI charges or real collection writes.
globalThis.localStorage={values:new Map(),getItem(k){return this.values.get(k)??null;},setItem(k,v){this.values.set(k,v);}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,addEventListener(){}};
globalThis.fetch=async()=>{throw Error('Unexpected external request in full-code fixture');};
const pack=game=>compileCatalog(JSON.parse(gunzipSync(readFileSync(`scanidx/${game}-catalog-v1.json.gz`))));
const ygo=pack('ygo'),mtg=pack('mtg');
const codes=[...ygo.codes.keys()],incomplete=new Set(['MF03-EN0??']);
for(const code of codes){
  if(incomplete.has(code)){assert.deepEqual(ygoSetCodes(code),[]);assert.equal(parseYgoSetCode(code),'');continue;}
  assert.deepEqual(ygoSetCodes(code),[code],`Full catalogue token must round-trip unchanged: ${code}`);
  assert.equal(parseYgoSetCode(code),code);
  assert.equal(ygoCodeReadings(code)[0].corrected,false);
}
assert.equal(codes.length,38545,'Update the pinned catalogue coverage deliberately');
assert.equal(codes.filter(c=>!incomplete.has(c)).length,38544);
assert.deepEqual(codes.filter(c=>!ygoSetCodes(c).length),[...incomplete]);
for(const code of ['LEHD-ENB38','LEHD-ENC38','SBC1-ENI27','LAVD-ENO34','YS15-ENL02','PHSW-ENSP1','IOC-SE1','DB9','DB49','DB-EN66','BLAR-EN10K','SR03-ENTKN','2018-EN002','LOB-001','LOB-E001','LOB-EN001','DUNE-JP001','ZZZZ-EN999','LEHD-ENA38'])assert.deepEqual(ygoSetCodes(code),[code]);
for(const text of ['lehd - enb38','LEHD-EN B38'])assert.deepEqual(ygoSetCodes(text),['LEHD-ENB38']);
for(const text of ['38','B38','ENB38','LEHD','LEHD-','LEHD-EN','42566602','ATK/2400 DEF/500','LINK-4','LINK-004','Rank-4','DEF-500','HP-100','LV-010','ABC-1','Blue-Eyes White Dragon','Yu-Gi-Oh!','1st Edition','2026-10-19','2026-10','1000-200','LEHD-ENB38XYZ','LEHD-ENB38/999','LEHD-ENB38-OTHER','XLEHD-ENB38','DB491','MF03-EN0??']){
  assert.deepEqual(ygoSetCodes(text),[],`Not a complete printed code: ${text}`);
  assert.equal(parseYgoSetCode(text),'');
}
assert.deepEqual(ygoSetCodes('LEHD-\nENB38'),[]);
assert.deepEqual(scanIdentifierEvidence('ygo',{code:'LEHD-',full:'ENB38'}).observations,[]);
assert.equal(detectGame('LEHD-ENB38'),'ygo');
assert.equal(detectGame('38'),'');
assert.equal(detectGame('HP-100'),'');
for(const month of ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']){
  assert.deepEqual(ygoSetCodes(`2026-${month}19`),[]);assert.equal(detectGame(`2026-${month}19`),'');
}
const linkRead={name:'Accesscode Talker',code:'ETCO-EN046',full:'ATK/2300 LINK-4'};
assert.deepEqual(scanIdentifierEvidence('ygo',linkRead).observations,['ETCO-EN046']);assert.equal(scanIdentifierEvidence('ygo',linkRead).identifierConflict,false);
assert(lookupCatalog(ygo,linkRead).cands.length,'A printed Link rating cannot exclude the actual code');

const fullRead={name:'Coral Dragon',code:'LEHD-ENB38'},target=lookupCatalog(ygo,fullRead).cands;
assert.equal(target.length,1);assert.equal(target[0].id,'42566602');assert.equal(target[0].print,'LEHD-ENB38|Ultra Rare');
assert.equal(target[0].exact,true);assert.equal(textVerifiedMatch('ygo',target[0],fullRead),true);
const batch=(read,cands=lookupCatalog(ygo,read).cands)=>resolvedEntry({id:'fixture',qty:1},'ygo',cands,read,c=>textVerifiedMatch('ygo',c,read),{finish:'unlimited',finishConfirmed:true});
for(const read of [
  {...fullRead,code:'LEHD-ENB38\nSTAS-EN042'},
  {...fullRead,full:'STAS-EN042'},
  {...fullRead,code:'STAS-EN042',full:'LEHD-ENB38'},
  {...fullRead,full:'ZZZZ-EN999'},
  {...fullRead,full:'LEHD-ENA38'},
  {...fullRead,full:'LEHD-ENC38'},
  {...fullRead,code:'LEHD-ENB38\nLEHD-ENB38\nLEHD-ENB38\nSTAS-EN042'},
  {...fullRead,code:'LEHD-ENB38\n42566602\n95992081'}
]){
  assert.equal(scanIdentifierEvidence('ygo',read).identifierConflict,true);
  const cands=lookupCatalog(ygo,read).cands;assert(cands.length);
  assert(cands.every(c=>!c.exact&&!textVerifiedMatch('ygo',{...c,exact:true},read)));
  const entry=batch(read,cands);assert.equal(entry.status,'review');assert.equal(entry.finish,'');assert.equal(entry.printingVerified,false);
}
assert.equal(lookupCatalog(ygo,{...fullRead,code:'LEHD-ENA38'}).cands.length,0,'Unknown complete code cannot borrow a same-name printing');
assert.equal(scanIdentifierEvidence('ygo',{code:'LEHD-ENB38',full:'lehd - enb38'}).identifierConflict,false);

// A corrected search key preserves its raw token and can only suggest a result.
assert.deepEqual(ygoCodeReadings('LOB-EN0O1'),[{raw:'LOB-EN0O1',code:'LOB-EN001',corrected:true}]);
assert.deepEqual(ygoSetCodes('LOB-EN0O1'),['LOB-EN001']);
const corrected={name:'Blue-Eyes White Dragon',code:'LOB-EN0O1'},correctionEvidence=scanIdentifierEvidence('ygo',corrected);
assert.equal(correctionEvidence.identifierUncertain,true);assert.equal(correctionEvidence.readings[0].raw,'LOB-EN0O1');
const correctedCands=lookupCatalog(ygo,corrected).cands;assert(correctedCands.length);
assert(correctedCands.every(c=>!c.exact&&c.identifierUncertain&&!textVerifiedMatch('ygo',{...c,exact:true},corrected)));
assert.equal(batch(corrected,correctedCands).status,'review');
assert(rankScanCandidates('ygo',correctedCands.map(c=>({...c,exact:true})),corrected).every(c=>!c.exact));
const correctedAndLiteral={...corrected,full:'LOB-EN001'};
assert.equal(scanIdentifierEvidence('ygo',correctedAndLiteral).identifierConflict,true,'Independent different readings do not outvote original OCR evidence');
assert(lookupCatalog(ygo,correctedAndLiteral).cands.every(c=>!c.exact));
assert.deepEqual(ygoCodeReadings('LOB-ENO01'),[{raw:'LOB-ENO01',code:'LOB-ENO01',corrected:false}],'A leading O can be a subset letter, not a numeric repair');

// Two digits are ambiguous even within LEHD. No suffix-only automatic match.
assert.deepEqual(ygo.rows.filter(r=>r[2]?.startsWith('LEHD-')&&r[2]?.endsWith('38')).map(r=>r[1]).sort(),['Coral Dragon','Leviair the Sea Dragon']);
for(const code of ['38','B38','LEHD\n38']){
  const read={name:'Coral Dragon',code};assert.deepEqual(scanIdentifierEvidence('ygo',read).observations,[]);
  assert.equal(textVerifiedMatch('ygo',{...target[0],exact:true},read),false);
  assert.equal(batch(read,[{...target[0],exact:true}]).status,'review');
  assert(lookupCatalog(ygo,read).cands.every(c=>!c.exact));
}
assert.equal(scannerNumberParts('ygo','38'),null);assert.equal(scannerNumberParts('ygo','B38'),null);

// Real production manual adapter, with both an installed and absent catalogue.
S.state=blank();S.state.settings.game='ygo';S.ui.view='scan';S.ui.scan={};
const tcg={A:{},C:{},I:{},commit:async fn=>fn(S.state),render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};
registerTcg(tcg);
const rows=ygo.rows.filter(r=>r[0]==='42566602');
const card={id:'42566602',name:'Coral Dragon',game:'ygo',sets:rows.map(r=>({code:r[2],rarity:r[3],name:r[4]})),artSchema:1,printPriceSchema:1,fetchedAt:new Date().toISOString()};
cache.ygo[card.id]=card;ui('ygo').sets.list=normalizeYgoSets([{set_code:'LEHD',set_name:'Legendary Hero Decks',tcg_date:'2018-10-05'}]);
const requests=[],nameRequests=[];
SOURCES.ygo.byName=async name=>{nameRequests.push(name);return name==='Coral Dragon'?card:null;};
globalThis.fetch=async url=>{const value=String(url);requests.push(value);assert(value.includes('cardsetsinfo.php'),'Only exact identity endpoint is allowed');const code=new URL(value).searchParams.get('setcode');return code==='LEHD-ENB38'?Response.json({id:42566602,set_code:code,set_rarity:'Ultra Rare'}):Response.json({}, {status:404});};
const makeLookup=installed=>createScannerLookup({local:async()=>installed?ygo:null,candById:(...args)=>tcg.scanCandById(...args),sources:SOURCES,match:(game,read,lang,manual)=>tcg.scanMatch(read,lang,manual,()=>{},game)});
for(const installed of [true,false]){
  const lookup=makeLookup(installed);requests.length=0;nameRequests.length=0;
  const found=await lookup('ygo',{name:'Coral Dragon',number:'LEHD-ENB38'});
  assert.equal(found.length,1);assert.equal(found[0].print,'LEHD-ENB38|Ultra Rare');assert.equal(found[0].exact,false);assert.equal(found[0].printingConfirmed,false);
  assert.deepEqual(requests,installed?[]:['https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=LEHD-ENB38']);assert.deepEqual(nameRequests,[]);
}
requests.length=0;nameRequests.length=0;
assert.equal((await tcg.scanMatch({name:'LEHD-ENB38'},'en',true,()=>{},'ygo')).cands[0].print,'LEHD-ENB38|Ultra Rare');
assert.equal(requests.length,1);assert.deepEqual(nameRequests,[],'A full code entered in the name box is never a fuzzy card name');
requests.length=0;
assert.deepEqual(await makeLookup(false)('ygo',{name:'Coral Dragon',number:'LEHD-JPB38'}),[]);
assert.equal(requests.length,1);assert(requests[0].endsWith('LEHD-JPB38'),'UI English cannot replace the printed language');
card.sets.push({code:'LEHD-ENB38',rarity:'Common',name:'Legendary Hero Decks'});
const tied=await tcg.scanMatch(fullRead,'en',false,()=>{},'ygo');
assert.equal(tied.cands.length,2);assert(tied.cands.every(c=>!c.exact&&c.printingAmbiguous));card.sets.pop();

let writes=0;const A={},cold=makeLookup(false);
registerScanner({A,C:{},I:{},game:()=> 'ygo',render(){},toast(){},priceOf:()=>null,identifyPhoto:async()=>cleanScanHints({game:'ygo',readable:true,name:'Coral Dragon',number:'LEHD-ENB38',set:'Legendary Hero Decks'}),lookupCandidates:cold,addMany:async()=>writes++});
saveBatch([batch(corrected,correctedCands)]);await A.scanBatchSave();assert.equal(writes,0);assert.equal(loadBatch()[0].status,'review');
S.ui.scan={confirm:{game:'ygo',i:-1,qty:2,condition:'Lightly Played',lang:'en',finish:''},cands:[],shot:'data:image/jpeg;base64,'+'A'.repeat(128)};
requests.length=0;await A.scanIdentifyAI();
assert.equal(S.ui.scan.confirm.numberDraft,'LEHD-ENB38');assert.equal(S.ui.scan.cands[0].print,'LEHD-ENB38|Ultra Rare');
assert.equal(S.ui.scan.cands[0].exact,false);assert.equal(S.ui.scan.cands[0].printingConfirmed,false);assert.equal(S.ui.scan.confirm.finish,'');assert.equal(writes,0);
assert.equal(requests.length,1);assert(requests[0].endsWith('LEHD-ENB38'));

// Number-before-rarity Magic footers retain the same adjacent set/language and
// independent-observation rules. Real Chishiro #77 is not #1 or #73.
const pair=(set,number)=>({set,number}),chishiro='Chishiro, the Shattered Blade';
for(const code of ['077 M\nNEC * EN','M 077\nNEC * EN','077 M NEC * EN','NEC EN 077 M','077 M\n© WIZARDS\nNEC EN']){
  assert.deepEqual(mtgCollectors(code),[pair('nec','77')]);
  const read={name:chishiro,code},found=lookupCatalog(mtg,read).cands;
  assert.equal(found.length,1);assert.equal(found[0].card.collector_number,'77');assert.deepEqual(found[0].card.finishes,['etched']);assert.equal(textVerifiedMatch('mtg',found[0],read),true);
}
for(const code of ['077 M\nUnrelated rules text\nNEC EN','077 M\n1st Edition\nNEC EN','Pay 077 M\nNEC EN','077 M 1st Edition\nNEC EN','077 M\nNEC','077 M\nNEC ENCHANTMENT','077 M\nNEC ZH'])assert.deepEqual(mtgCollectors(code),[]);
assert.deepEqual(mtgCollectors('077 M','NEC EN'),[],'Separate observations cannot complete an orphan footer');
for(const code of ['077 M NEC EN 001 R NEC EN','NEC EN 001 M NEC EN 077 M','NEC EN M 001 NEC EN M 077','NEC EN 001 M 077 M','001 M 077 M NEC EN','NEC EN 001 M M 077','077 M\nNEC EN\nM 073\nNEC EN','077 M\nNEC EN\n077 M\nNEC EN\n001 R\nNEC EN']){
  const read={name:chishiro,code};assert(mtgCollectors(code).length>1);assert.equal(mtgCollector(code),null);
  const found=lookupCatalog(mtg,read).cands;assert(found.length>1);assert(found.every(c=>!c.exact&&!textVerifiedMatch('mtg',{...c,exact:true},read)));
}
assert.deepEqual(mtgCollectors('077 M NEC EN 149 R M11 EN'),[pair('nec','77'),pair('m11','149')],'No cross product between adjacent footers');
assert.deepEqual(mtgCollectors('NEC EN 077 M M11 EN 149 R'),[pair('nec','77'),pair('m11','149')],'Reversed adjacent footers cannot shift a number to the next set');
assert.deepEqual(mtgCollectors('077 M\nNEC EN 149 R M11 EN'),[pair('nec','77'),pair('m11','149')],'A pending preceding footer establishes forward direction');
for(const code of ['001 M\nNEC EN 077 M','NEC EN M 077 M11 EN','077 M NEC EN M11 EN','001 M\nNEC EN 077 M\nUnrelated rules']){
  const read={name:chishiro,code};assert.equal(scanIdentifierEvidence('mtg',read).identifierUncertain,true,'Unmatched edges cannot establish footer orientation');assert.equal(mtgCollector(code),null);
  const found=lookupCatalog(mtg,read).cands;assert(found.length);assert(found.every(c=>!c.exact&&!textVerifiedMatch('mtg',{...c,exact:true},read)));
  const entry=resolvedEntry({id:'ambiguous-magic'},'mtg',found,read,c=>textVerifiedMatch('mtg',c,read),{finishConfirmed:true,finish:'foil'});assert.equal(entry.status,'review');assert.equal(entry.printingVerified,false);
}
console.log('PASS: 38,544 exact YGO catalogue codes; raw/corrected/partial/conflicting evidence guards; installed/cold manual and AI routes; no auto-save; adjacent Magic number-before-rarity footers and real Chishiro etched identity.');
