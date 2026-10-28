// Actual readCard orchestration with deterministic OCR results. These are
// confidence/routing regressions, not photographs or OCR accuracy measurements.
import assert from 'node:assert/strict';
import {readCard,releaseOCR,createScanBudget} from './scancam.js';
import {nameCandidates,ygoSetCodes} from './scan.js';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';

globalThis.location={href:'https://ocr-fixture.invalid/'};
globalThis.document={createElement(){const c={width:0,height:0};c.getContext=()=>({filter:'',drawImage(){}});return c;}};
globalThis.window={};
const card={width:480,height:672};
const fixtures=[
 {game:'mtg',wrong:'Black Lotus',title:'Lightning Bolt',code:'U 0161\nLEA EN',row:['wanted','Lightning Bolt','lea','161','Limited Edition Alpha',['nonfoil'],'o','en'],other:['other','Black Lotus','lea','233','Limited Edition Alpha',['nonfoil'],'x','en']},
 {game:'ptcg',wrong:'Charmander',title:'Pikachu',code:'25/102',row:['wanted','Pikachu','base1','25',102,'Base Set',''],other:['other','Charmander','base1','46',102,'Base Set','']},
 {game:'ygo',wrong:'Blue-Eyes White Dragon',title:'Dark Magician',code:'LOB-EN005',pass:'46986414',row:['46986414','Dark Magician','LOB-EN005','Ultra Rare','Legend of Blue Eyes White Dragon','Normal Monster'],other:['89631139','Blue-Eyes White Dragon','LOB-EN001','Ultra Rare','Legend of Blue Eyes White Dragon','Normal Monster']},
];
let checks=0;
async function run(f,reads,options={}){
 await releaseOCR();let calls=0;const segments=[];
 window.Tesseract={createWorker:async()=>({setParameters:async p=>segments.push(p.tessedit_pageseg_mode),recognize:async()=>{const next=reads[calls++];assert(next,`${f.game}: unexpected extra OCR call ${calls}`);return {data:next};},terminate:async()=>{}})};
 const budget=createScanBudget();budget.begin();
 const read=await readCard(card,f.game,'eng',()=>{},{budget,...options});
 assert.equal(calls,reads.length,`${f.game}: expected bounded OCR sequence`);
 assert.equal(budget.counts.ocrCalls,calls,'actual OCR calls consume the existing budget');
 return {read,calls,segments};
}
const data=(text,confidence=90)=>({text,confidence});
const footer=f=>[data(f.code),...(f.pass?[data(f.pass)]:[])];
try{
 for(const f of fixtures){
  const {read,calls}=await run(f,[data(f.wrong,35),data(f.title,92),...footer(f)]);
  assert.equal(nameCandidates(f.game,read.name)[0],f.title,`${f.game}: recovered strong title leads lookup, even when weak output is another real card`);
  assert.deepEqual(read.titles,[{text:f.wrong,source:'title',confidence:35},{text:f.title,source:'title',confidence:92}],'both independent observations and confidences survive');
  assert.equal(calls,f.pass?4:3,'one inverted retry only');
  const pack=compileCatalog({schema:1,game:f.game,rows:[f.other,f.row]});
  assert.equal(lookupCatalog(pack,read).cands[0]?.id,f.row[0],'weak real-name hit cannot displace the recovered title');checks++;

  const wide=await run(f,[data(f.wrong,20),data('Unclear Word',40),data(f.title,95),...footer(f)]);
  assert.equal(nameCandidates(f.game,wide.read.name)[0],f.title,'wide title retry can recover after two plausible low-confidence readings');
  assert.equal(wide.read.titles.length,3);assert.equal(wide.calls,f.pass?5:4);checks++;

  for(const confidence of [70,95,undefined]){
   const initial=confidence===undefined?{text:f.title}:data(f.title,confidence);
   const good=await run(f,[initial,...footer(f)]);
   assert.equal(good.calls,f.pass?3:2,'good or unknown-confidence title keeps existing fast path');
   assert.equal(good.read.titles[0].confidence,confidence??null);checks++;
  }

  const exhausted=await run(f,[data('Noisy Word',15),data('Other Noise',25),data('Still Noise',30),...footer(f),data(f.title+'\n'+f.code,90)]);
  assert.equal(exhausted.calls,f.pass?6:5,'three title attempts then one whole-card read, with no unbounded retry');
  assert.equal(exhausted.read.titles.length,3);assert.match(exhausted.read.full,new RegExp(f.title));checks++;
 }
 const ygo=fixtures.find(f=>f.game==='ygo');
 const separate=await run(ygo,[data(ygo.title),data('LOB-'),data('EN005')]);
 assert.deepEqual(ygoSetCodes(separate.read.code),[],'separate code and passcode crops cannot fabricate LOB-EN005 across a line boundary');
 const intact=await run(ygo,[data(ygo.title),data('LOB-EN005\n1st Edition'),data(ygo.pass)]);
 assert.deepEqual(ygoSetCodes(intact.read.code),['LOB-EN005'],'intact code survives other lines within its own crop');checks+=2;
 console.log(`PASS: ${checks} OCR-confidence orchestration scenarios across Magic, Pokémon and Yu-Gi-Oh!; low-confidence retry, strong-title ordering, original evidence, fast paths, finite budgets, and code/passcode boundaries.`);
}finally{await releaseOCR();}
