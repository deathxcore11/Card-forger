import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {textVerifiedMatch} from './scancam.js';
import {pokemonPrintedName,pokemonPrintedNameKey} from './pokemon-identity.js';
import {samePrintingFamily,printingRows,printingFacets} from './printing-picker.js';
import {createScannerPrintingPicker} from './scanner-printing.js';
import {normalizePtcg,ptcgSource} from './ptcg.js';
import {setContextCard} from './tcg.js';
import {resolvedEntry} from './scan-batch.js';

// Real checked-in identities from the photographed card; no image/OCR or live
// price claims. Exercise number evidence, public adapters and the actual picker.
const pack=compileCatalog(JSON.parse(gunzipSync(readFileSync('scanidx/ptcg-catalog-v1.json.gz'))));
for(const name of ["Professor's Research",'Professor’s Research',"Professor's Research\nProfessor Oak"]){
 for(const code of ['023/025','23/25','023 / 025 ★']){
  const read={name,code},out=lookupCatalog(pack,read).cands;
  assert.deepEqual(out.map(c=>c.id),['cel25-23']);assert.equal(out[0].exact,true);assert(textVerifiedMatch('ptcg',out[0],read));
 }
 const repaired={name,code:'O23/O25'},suggested=lookupCatalog(pack,repaired).cands;
 assert.deepEqual(suggested.map(c=>c.id),['cel25-23']);
 assert.equal(suggested[0].exact,false,'repaired digits suggest the card without claiming exact printed evidence');
 assert.equal(suggested[0].identifierUncertain,true);
 assert.equal(textVerifiedMatch('ptcg',suggested[0],repaired),false);
 const entry=resolvedEntry({id:'repaired-celebrations'},'ptcg',suggested,repaired,c=>textVerifiedMatch('ptcg',c,repaired),{finishConfirmed:true,finish:'holo'});
 assert.equal(entry.status,'review');assert.equal(entry.printingVerified,false);
}
assert.deepEqual(lookupCatalog(pack,{name:"Professor's Research",code:'024/025'}).cands.map(c=>c.id),['cel25-24'],'Neighbor full art remains a different printing');
for(const read of [{name:"Professor's Research",code:'023/025\n024/025'},{name:'Professor Oak',code:'023/025'},{name:"Professor's Research ex",code:'023/025'},{name:"Professor's Research",code:'023/078'}]){
 assert(lookupCatalog(pack,read).cands.every(c=>!textVerifiedMatch('ptcg',c,read)),'Conflicting title/number cannot become verified');
}
assert.equal(pokemonPrintedName("Professor's Research (Professor Oak)"),"Professor's Research");
for(const name of ['Pikachu ex','Pikachu GX','Pikachu (Test)',"Professor Oak's Research","Professor's Research ex","Professor's Research (Test)"])assert.notEqual(pokemonPrintedNameKey(name),pokemonPrintedNameKey("Professor's Research"));

const raw=(id,name,number,set,total)=>({id,name,localId:number,category:'Trainer',trainerType:'Supporter',rarity:'Rare',set:{id:set,name:set==='cel25'?'Celebrations':'Black Bolt',cardCount:{official:total,total}},variants:{holo:true},image:'https://fixture.invalid/'+id});
const records=[raw('cel25-23',"Professor's Research (Professor Oak)",'23','cel25',25),raw('cel25-24',"Professor's Research (Professor Oak)",'24','cel25',25),raw('sv10.5b-085',"Professor's Research",'085','sv10.5b',86),raw('decoy-23',"Professor's Research ex",'23','decoy',25)];
const cards=records.map(normalizePtcg),source=cards[2];
assert(samePrintingFamily('ptcg',source,cards[0]));assert(!samePrintingFamily('ptcg',source,cards[3]));
const original=globalThis.fetch,requests=[];
try{
 globalThis.fetch=async input=>{
  const u=new URL(input);requests.push(u);
  if(u.pathname.endsWith('/cards')){assert.equal(u.searchParams.get('name'),"Professor's Research");return Response.json(records);}
  if(u.pathname.endsWith('/sets'))return Response.json([{id:'cel25',name:'Celebrations',cardCount:{official:25}},{id:'sv10.5b',name:'Black Bolt',cardCount:{official:86}}]);
  if(u.pathname.endsWith('/series'))return Response.json([]);
  throw Error('Unexpected fixture request '+u);
 };
 const page=await ptcgSource.search({q:cards[0].name,exactName:true});
 assert.deepEqual(new Set(page.cards.map(c=>c.id)),new Set(cards.slice(0,3).map(c=>c.id)),'Provider suffix does not exclude Celebrations from exact-title search');
 let config;
 const picker=createScannerPrintingPicker({openPicker:c=>{config=c;},sources:{ptcg:ptcgSource},ensureCard:async(g,id)=>cards.find(c=>c.id===id),projectCard:(g,c,r,catalogue,options)=>setContextCard(g,c,r,catalogue,options)});
 await picker.open({game:'ptcg',candidate:{id:source.id,card:source},isCurrent:()=>true});
 const loaded=await config.loadPage();
 const rows=printingRows('ptcg',loaded.cards,{source,projectCard:config.projectCard});
 assert(printingFacets(rows).sets.some(([id,name])=>id==='cel25'&&name==='Celebrations'),'Scanner Set/release dropdown includes Celebrations');
 assert(rows.some(r=>r.cardId==='cel25-23'&&r.selectable));assert(rows.some(r=>r.cardId==='cel25-24'&&r.selectable));
 picker.abandon();
}finally{globalThis.fetch=original;}
console.log('PASS: actual Celebrations 023/025 identity, professor subtitle alias, separate 024/025 art, contradictory evidence rejection, full exact-name search and selectable scanner set dropdown.');
