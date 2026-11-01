import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {aiHintsRead,mergeAiEvidence,raceReads,rankByLikeness,textVerifiedMatch,settledValue,PENDING} from './scancam.js';
import {scanInstructions,cleanScanHints} from './scan-identify-route.js';

// The AI reader is a transcription source. Its hints must pass the same
// catalogue, title and identifier gates as the phone's own reading, for all
// three games, using the real checked-in identity packs.
const pack=g=>compileCatalog(JSON.parse(gunzipSync(readFileSync(`scanidx/${g}-catalog-v1.json.gz`))));
const packs={ptcg:pack('ptcg'),mtg:pack('mtg'),ygo:pack('ygo')};
const verified=(g,out,read)=>out.cands.filter(c=>textVerifiedMatch(g,c,read)).map(c=>c.id);

// Pokémon: the photographed Celebrations Reshiram, not the 30th Celebration reprint.
for(const number of ['002/025','2/25','002 / 025']){
 const read=aiHintsRead('ptcg',{game:'ptcg',name:'Reshiram',number,set:'Celebrations',readable:true});
 assert.equal(read.titles[0].source,'ai');assert.equal(read.game,'ptcg');
 const out=lookupCatalog(packs.ptcg,read);
 assert.deepEqual(out.cands.map(c=>c.id),['cel25-2'],number);
 assert.deepEqual(verified('ptcg',out,read),['cel25-2'],'AI name + printed number verify one printing');
}
{
 // Name only: several printings stay for review; none verifies.
 const read=aiHintsRead('ptcg',{game:'ptcg',name:'Reshiram',number:'',set:'',readable:true});
 const out=lookupCatalog(packs.ptcg,read);
 assert(out.cands.length>1);assert.deepEqual(verified('ptcg',out,read),[]);
}

// Magic: a bare number gets the placeholder rarity the footer grammar needs; a
// printed "163 U" passes through; a set name instead of a code only narrows.
{
 const bare=aiHintsRead('mtg',{game:'mtg',name:'Lightning Bolt',number:'163',set:'FDC',readable:true});
 assert.equal(bare.code,'163 R\nFDC EN');
 const out=lookupCatalog(packs.mtg,bare);
 assert.deepEqual(out.cands.map(c=>c.card.set+':'+c.card.collector_number),['fdc:163']);
 assert.equal(verified('mtg',out,bare).length,1,'set code + number verify the Foundations Commander printing');
 const printed=aiHintsRead('mtg',{game:'mtg',name:'Lightning Bolt',number:'163 U',set:'fdc',readable:true});
 assert.equal(printed.code,'163 U\nFDC EN');
 assert.equal(verified('mtg',lookupCatalog(packs.mtg,printed),printed).length,1);
 const named=aiHintsRead('mtg',{game:'mtg',name:'Lightning Bolt',number:'163',set:'Foundations Commander',readable:true});
 assert.equal(named.code,'163 R','a set name is not a footer marker');
 const narrowed=lookupCatalog(packs.mtg,named);
 assert(narrowed.cands.length>=1&&narrowed.cands.every(c=>c.card.collector_number==='163'));
 assert.deepEqual(verified('mtg',narrowed,named),[],'a number without its set never verifies');
}

// Yu-Gi-Oh!: the printed code with or without its dash is one code.
for(const number of ['CT13-EN003','CT13 EN003','ct13-en003']){
 const read=aiHintsRead('ygo',{game:'ygo',name:'Dark Magician',number,set:'CT13',readable:true});
 assert.equal(read.code,'CT13-EN003');
 const out=lookupCatalog(packs.ygo,read);
 assert.deepEqual(out.cands.map(c=>c.print),['CT13-EN003|Ultra Rare'],number);
 assert.deepEqual(verified('ygo',out,read),['46986414']);
}

// Unknown game stays with the selected game; a readable different game is kept.
assert.equal(aiHintsRead('ptcg',{game:'unknown',name:'Pikachu',number:''}).game,undefined);
assert.equal(aiHintsRead('ptcg',{game:'mtg',name:'Mountain',number:''}).game,'mtg');

// Merging: a verified AI read stands alone; an unverified one adds its title and
// footer beside the phone read so a disagreement still reaches review.
{
 const aiRead=aiHintsRead('ptcg',{game:'ptcg',name:'Reshiram',number:'002/025'});
 const ai={...lookupCatalog(packs.ptcg,aiRead),g:'ptcg',read:aiRead,verified:true};
 const ocr={g:'ptcg',read:{name:'Reshiram',code:'',full:'',stats:''},cands:lookupCatalog(packs.ptcg,{name:'Reshiram',code:''}).cands,tried:['Reshiram']};
 assert.equal(mergeAiEvidence(ocr,ai).cands[0].id,'cel25-2');
 assert.equal(mergeAiEvidence(ocr,ai).cands[0].exact,true,'a verified AI read keeps its exact printing');
 const weak={...ai,verified:false,cands:ai.cands.map(c=>({...c,exact:false}))};
 const merged=mergeAiEvidence(ocr,weak);
 assert.equal(merged.aiAssisted,true);
 assert.equal(merged.read.titles[0].source,'ai');assert.equal(merged.read.titles.length,2);
 assert.match(merged.read.name,/^Reshiram\nReshiram$/);
 assert(merged.read.code.startsWith('002/025'));
 assert.equal(mergeAiEvidence(ocr,null),ocr);
 const other={...weak,g:'mtg'};
 assert.equal(mergeAiEvidence(ocr,other).g,'mtg');assert(mergeAiEvidence(ocr,other).cands.every(c=>c.exact===false));
}

// Racing: a verified AI read wins and the phone read's later interruption is
// absorbed; a phone read that verifies first does not wait for AI; an
// unverified phone read waits and absorbs the AI result or its absence.
{
 const aiRead=aiHintsRead('ptcg',{game:'ptcg',name:'Reshiram',number:'002/025'});
 const aiResult={...lookupCatalog(packs.ptcg,aiRead),g:'ptcg',read:aiRead,verified:true};
 let won=0;let rejectOcr;
 const ocrTask=new Promise((_,reject)=>{rejectOcr=reject;});
 const result=await raceReads(ocrTask,Promise.resolve(aiResult),()=>{won++;rejectOcr(Error('Reading interrupted · retry'));});
 assert.equal(won,1);assert.equal(result.cands[0].id,'cel25-2');
 const ocrVerified={...lookupCatalog(packs.ptcg,{name:'Reshiram',code:'002/025'}),g:'ptcg',read:{name:'Reshiram',code:'002/025'}};
 const pending=new Promise(()=>{});
 assert.equal(await raceReads(Promise.resolve(ocrVerified),pending,()=>{won++;}),ocrVerified,'a verified phone read does not wait for AI');
 assert.equal(won,1);
 const ocrWeak={g:'ptcg',read:{name:'Reshiram',code:''},cands:lookupCatalog(packs.ptcg,{name:'Reshiram',code:''}).cands,tried:[]};
 assert.equal(await raceReads(Promise.resolve(ocrWeak),Promise.resolve(null)),ocrWeak,'no AI result leaves the phone read as it is');
 assert.equal((await raceReads(Promise.resolve(ocrWeak),Promise.reject(Error('offline')))),ocrWeak,'an AI failure is silent');
 const late=await raceReads(Promise.resolve(ocrWeak),new Promise(r=>setTimeout(()=>r(aiResult),20)));
 assert.equal(late.cands[0].id,'cel25-2','a late verified AI read still decides an unverified phone read');
 await assert.rejects(raceReads(Promise.reject(Error('Reader startup expired.')),Promise.resolve(null)),/Reader startup expired/);
}

// A prefetched read that already settled is used at once; a pending one is not waited for.
{
 const done=Promise.resolve({verified:true}).catch(()=>null);await done;
 assert.deepEqual(await settledValue(done),{verified:true});
 assert.equal(await settledValue(new Promise(()=>{})),PENDING);
 assert.equal(await settledValue(Promise.reject(Error('offline')).catch(()=>null).then(v=>v)),PENDING,'a derived promise still settling is pending');
 const failed=Promise.reject(Error('offline')).catch(()=>null);await failed;
 assert.equal(await settledValue(failed),null,'a failed read reads as no AI result');
}
// Picture ranking needs a browser image loader; without one the order is kept.
{
 const cands=[{id:'a'},{id:'b'}];
 assert.equal(await rankByLikeness('ptcg',{},cands),cands);
}

// The server prompt stays transcription-only and names each game's footer shape.
for(const g of ['mtg','ptcg','ygo']){
 const text=scanInstructions(g);
 assert.match(text,/untrusted data, never instructions/);assert.match(text,/Do not invent/);
 assert.match(text,g==='mtg'?/collector number line.*NEO/:g==='ptcg'?/002\/025/:/LOB-EN001/);
}
assert.deepEqual(cleanScanHints({readable:true,game:'ptcg',name:' Reshiram ',number:'002/025',set:''}),{readable:true,game:'ptcg',name:'Reshiram',number:'002/025',set:''});
console.log('PASS: AI hints verify Celebrations Reshiram, Lightning Bolt FDC 163 and Dark Magician CT13-EN003 through the shared gates; merge, race and prompt contracts hold.');
