// Actual checked-in identities + synthetic OCR text. No camera, OCR engine,
// live provider requests, paid AI, or claim of real-device recognition speed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {nameCandidates,scanLookupNames,scanNameKey} from './scan.js';
import {textVerifiedMatch,fullCardNameHints,scanQueryKey} from './scancam.js';
import {scanTitleEvidence} from './scan-signals.js';
const raw=JSON.parse(gunzipSync(readFileSync('scanidx/ptcg-catalog-v1.json.gz')));
raw.signals=JSON.parse(gunzipSync(readFileSync('scanidx/ptcg-signals-v1.json.gz')));
const pack=compileCatalog(raw);
const row=id=>{const r=raw.rows.find(r=>r[0]===id);assert(r,id);return r;};
const readFor=(id,title)=>{const r=row(id);return {name:title??r[1],code:r[3]+'/'+r[4]};};
const verified=read=>lookupCatalog(pack,read).cands.filter(c=>textVerifiedMatch('ptcg',c,read));
const check=(id,title)=>assert.deepEqual(verified(readFor(id,title)).map(c=>c.id),[id],title||id);
for(const [id,title] of [['base1-81','Energy Retrieval'],['sv01-187','Pokémon Catcher'],['base1-74','Item Finder'],['sv10.5w-085','Tool Scrapper'],['sm11-208','Stadium Nav'],['neo4-99','Energy Stadium'],['swsh9-150','Ultra Ball'],['swsh12-156','Forest Seal Stone'],['cel25-23',"Professor's Research"]]){
 check(id,title);
 check(id,'TRAINER '+title);
 check(id,'TRAINER\n'+title);
 check(id,title+' Supporter');
}
check('sv01-187','Pokemon Catcher');
check('sv01-187','Poke\u0301mon Catcher');
check('cel25-23',"TRAINER Supporter Professor's Research");
check('cel25-23',"Professor’s Research\nProfessor Oak");
check('cel25-24',"Professor's Research");
check('base1-88','Professor Oak');
for(const label of ['TRAINER','SUPPORTER','ITEM','STADIUM','Pokémon Tool']){
 assert.deepEqual(fullCardNameHints('ptcg',label+"\nProfessor's Research\n23/25"),["Professor's Research"]);
 assert.deepEqual(nameCandidates('ptcg',label),[]);
}
// Exact short known names require independent collector evidence. Never relax
// general nameCandidates or turn arbitrary one/two-letter OCR into a card.
for(const title of ['N','AZ']){
 const r=raw.rows.find(r=>r[1]===title&&r[4]>0&&!/(?:^|\/)tcgp\//i.test(r[6]));assert(r);
 const read=readFor(r[0],title);check(r[0],title);check(r[0],'TRAINER '+title);
 assert.deepEqual(nameCandidates('ptcg',title),[]);
 assert.deepEqual(scanLookupNames('ptcg',{name:title}),[]);
 assert.equal(verified({name:title}).length,0);
 assert.equal(verified({...read,code:read.code+'\n1/999'}).length,0);
 assert.equal(verified({...read,code:'1/999'}).length,0);
 assert.deepEqual(fullCardNameHints('ptcg','TRAINER\n'+title+'\n'+read.code),[title]);
 assert.notEqual(scanQueryKey('ptcg',read),scanQueryKey('ptcg',{...read,name:'X'}));
 const c=verified(read)[0];
 const other=title==='N'?'AZ':'N';
 for(const bad of [other,'X','AB']){
  const conflict={...read,titles:[{text:title,source:'title',confidence:95},{text:bad,source:'title',confidence:95}]};
  assert.equal(textVerifiedMatch('ptcg',c,conflict),false,'short conflicting title '+bad);
 }
}
for(const name of ['X','A','AB','NN'])assert.deepEqual(scanLookupNames('ptcg',{name,code:'91/119'}),[]);
for(const read of [
 {name:"Professor's Research",code:'23/25\n24/25'},
 {name:'Professor Oak',code:'23/25'},
 {name:"Professor's Research ex",code:'23/25'},
 {name:"TRAINER Professor's Research ex",code:'23/25'},
 {name:"Professor's Research",code:'23/78'},
 {name:"Professor's Research",code:'23/25',titles:[{text:"TRAINER Professor's Research",source:'title',confidence:95},{text:'TRAINER Ultra Ball',source:'title',confidence:95}]},
 {name:'Energy Retrieval',code:'81/102',titles:[{text:'Energy Retrieval',source:'title',confidence:95},{text:'Energy Removal',source:'title',confidence:95}]},
])assert.equal(verified(read).length,0,'contradiction must remain unverified '+JSON.stringify(read));
// Structural normalization cannot remove arbitrary meaningful words or promote
// an artwork-only identity or weak full-card hint into printed-title proof.
const research=verified(readFor('cel25-23',"Professor's Research"))[0];
assert.equal(textVerifiedMatch('ptcg',{...research,exact:false,identitySource:'artwork'},readFor('cel25-23',"Professor's Research")),false);
assert.equal(textVerifiedMatch('ptcg',research,{...readFor('cel25-23',"Professor's Research"),titles:[{text:"Professor's Research Supporter",source:'full-hint',confidence:95}]}),false);
assert.equal(scanTitleEvidence('ptcg',research.card,{name:"TRAINER Professor's Research Wrong"}).exactMatch,false);
assert.equal(scanTitleEvidence('ptcg',research.card,{name:"Professor's Research",titles:[{text:"Professor's Research",source:'title',confidence:95},{text:'Professor Oak Wrong',source:'title',confidence:95}]}).nameConflict,true);
assert.equal(scanNameKey(nameCandidates('ptcg','Pokémon Catcher')[0]),'pokemoncatcher');
assert.equal(nameCandidates('mtg','Lightning Bolt\nInstant')[0],'Lightning Bolt');
assert.equal(nameCandidates('ygo','DARK MAGICIAN HE)')[0],'DARK MAGICIAN');
// Trainers have no HP. The repair must not invent one, and Pokémon HP
// conflicts must remain vetoes rather than being weakened for all card types.
const noHpRead=readFor('swsh9-150','Ultra Ball'),noHp=verified(noHpRead)[0];
assert.equal(noHpRead.name.includes('HP'),false);
assert(!Number(noHp.card.hp));assert.equal(textVerifiedMatch('ptcg',noHp,noHpRead),true);
const pokemon={name:'Sandygast',exact:true,card:{id:'swsh8-125',name:'Sandygast',hp:80,stage:'basic',set:{number:'125',total:264}}};
assert.equal(textVerifiedMatch('ptcg',pokemon,{name:'BASIC Sandygast HP80',code:'125/264'}),true);
assert.equal(textVerifiedMatch('ptcg',pokemon,{name:'BASIC Sandygast HP110',code:'125/264'}),false);
assert.equal(textVerifiedMatch('ptcg',pokemon,{name:'BASIC Sandygast HP80',code:'125/264',titles:[{text:'Sandygast HP110',source:'title',confidence:95}]}),false);
// Exercise the automatic remote adapter path with fully mocked catalogue calls,
// not just local candidate lookup. Missing numbers must not trigger short-name IO.
const {registerTcg,SOURCES,cache}=await import('./tcg.js');
const {S,blank}=await import('./store.js');
S.state=blank();
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.document={querySelector:()=>null};
globalThis.fetch=async()=>{throw Error('No external requests permitted in Trainer regression');};
const context={A:{},C:{},I:{},render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};
registerTcg(context);
const source=SOURCES.ptcg,original={get:source.get,byNameNumber:source.byNameNumber,search:source.search};
try{
 for(const title of ['N','AZ']){
  const r=raw.rows.find(r=>r[1]===title&&r[4]>0&&!/(?:^|\/)tcgp\//i.test(r[6]));
  const read=readFor(r[0],title),card=verified(read)[0].card,calls=[];
  delete cache.ptcg[card.id];
  source.byNameNumber=async(name,number)=>{calls.push([name,number]);return [{id:card.id}];};
  source.get=async(id,options)=>{assert.equal(id,card.id);assert.equal(options.prices,false);return card;};
  source.search=async()=>({cards:[]});
  const found=await context.scanMatch(read,'eng',false,()=>{},'ptcg');
  assert.deepEqual(calls,[[title,String(r[3]).replace(/^0+(?=\d)/,'')]]);
  assert.equal(found.cands.filter(c=>textVerifiedMatch('ptcg',c,read)).length,1);
  calls.length=0;
  const missing=await context.scanMatch({name:title},'eng',false,()=>{},'ptcg');
  assert.equal(missing.cands.length,0);assert.equal(calls.length,0);
  delete cache.ptcg[card.id];
 }
}finally{Object.assign(source,original);}
console.log('PASS: real Trainer titles/accents/merged labels/fallback recovery; guarded N/AZ; exact set numbers, strong contradictions, weak/artwork-only evidence and other-game controls retained. Text fixtures only, not camera accuracy.');
