// Behavioural scanner regressions. Catalogue-shaped fixtures and OCR text,
// not real-camera accuracy or live-provider certification.
import assert from 'node:assert/strict';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {signalEvidence,rankScanCandidates,scanIdentifierEvidence} from './scan-signals.js';
import {createScannerLookup,scannerLookupMatches} from './scanner-lookup.js';
let checks=0,failures=0;
async function check(label,fn){try{await fn();checks++;console.log('PASS '+label);}catch(error){failures++;console.error('FAIL '+label+': '+error.message);}}
const mtg=compileCatalog({schema:1,game:'mtg',rows:[
 ['delver','Delver of Secrets // Insectile Aberration','isd','51','Innistrad',['nonfoil'],'delver-oracle','en'],
 ['fire','Fire // Ice','apc','128','Apocalypse',['nonfoil'],'fire-oracle','en'],
 ['bolt','Lightning Bolt','lea','161','Limited Edition Alpha',['nonfoil'],'bolt-oracle','en'],
]});
for(const [name,id] of [['Delver of Secrets','delver'],['Insectile Aberration','delver'],['Fire','fire'],['Ice','fire']]){
 await check('Magic printed face '+name,()=>{const result=lookupCatalog(mtg,{name});assert.equal(result.cands[0]?.id,id);assert(result.cands.every(c=>!c.exact));assert.equal(result.fuzzy,false);});
}
await check('Magic face + exact footer preserves canonical identity',()=>{const result=lookupCatalog(mtg,{name:'Delver of Secrets',code:'U 0051\nISD EN'});assert.equal(result.cands[0]?.id,'delver');assert.equal(result.cands[0]?.name,'Delver of Secrets // Insectile Aberration');assert.equal(result.cands[0]?.exact,true);});
await check('Magic conflicting face/title remains unverified',()=>{const result=lookupCatalog(mtg,{name:'Delver of Secrets',code:'128 APC EN'});assert(result.cands.every(c=>!c.exact));});
await check('Magic body token fraction is not power/toughness',()=>{const card={name:'Mycoloth',power:'4',toughness:'4'};const e=signalEvidence('mtg',card,{name:'Mycoloth',stats:'Create a 1/1 green Saproling creature token.\n4/4'});assert.deepEqual(e.conflicts,[]);assert(e.agrees.includes('power/toughness'));});
await check('Magic inline rules fraction alone is absent evidence',()=>{const e=signalEvidence('mtg',{name:'Mycoloth',power:'4',toughness:'4'},{name:'Mycoloth',stats:'Create a 1/1 green Saproling creature token.'});assert.deepEqual(e.conflicts,[]);assert(!e.agrees.includes('power/toughness'));});
await check('Magic clear wrong power/toughness still rejects',()=>{assert.deepEqual(rankScanCandidates('mtg',[{name:'Mycoloth',exact:true,card:{name:'Mycoloth',power:'4',toughness:'4'}}],{name:'Mycoloth',stats:'5/5'}),[]);});
const ptcg=compileCatalog({schema:1,game:'ptcg',rows:[
 ['base4-102','Impostor Professor Oak','base4','102',130,'Base Set 2',''],
 ['cel25-23',"Professor’s Research (Professor Oak)",'cel25','23',25,'Celebrations',''],
 ['other','Drowzee','other','32',100,'Other',''],
 ['ex6-32','Drowzee','ex6','32',112,'FireRed & LeafGreen',''],
]});
const lookup=createScannerLookup({local:async game=>game==='mtg'?mtg:ptcg,candById:async()=>null,match:async()=>({cands:[]}),sources:{ptcg:{byNameNumber:async()=>[]}}});
for(const [name,id] of [['Imposter Professor Oak','base4-102'],["Professor's Research",'cel25-23'],['Drowsee','ex6-32']]){
 await check('Manual/AI printed name alias '+name,async()=>{const found=await lookup('ptcg',{name,strictName:true});assert.equal(found[0]?.id,id);assert(found.every(c=>c.exact===false&&c.printingConfirmed===false));});
}
await check('Pokémon printed error alias is release-specific',()=>assert.equal(scannerLookupMatches('ptcg',{id:'other',name:'Drowzee'},{name:'Drowsee',strictName:true}),false));
await check('Pokémon suffix disagreement still rejects',()=>assert.equal(scannerLookupMatches('ptcg',{id:'p',name:'Pikachu ex'},{name:'Pikachu',strictName:true}),false));
await check('Magic manual face alias',async()=>assert.equal((await lookup('mtg',{name:'Insectile Aberration',strictName:true}))[0]?.id,'delver'));
await check('Yu-Gi-Oh exact code remains region-specific',()=>assert.equal(scannerLookupMatches('ygo',{card:{name:'Dark Magician'},print:'LOB-JP005|Ultra Rare'},{number:'LOB-EN005'}),false));
const repairedPack=compileCatalog({schema:1,game:'ptcg',rows:[['p','Pikachu','x','25',102,'X','']]});
for(const code of ['O25/1O2','025\\102'])await check('Repaired Pokémon number is review-only '+code,()=>{const r=lookupCatalog(repairedPack,{name:'Pikachu',code});assert.equal(r.cands[0]?.id,'p');assert.equal(r.cands[0]?.exact,false);assert.equal(r.cands[0]?.identifierUncertain,true);});
await check('Clean Pokémon fraction can still verify',()=>assert.equal(lookupCatalog(repairedPack,{name:'Pikachu',code:'025/102'}).cands[0]?.exact,true));
await check('Distinct Pokémon observations remain conflicting',()=>assert.equal(scanIdentifierEvidence('ptcg',{code:'025/102',full:'026/102'}).identifierConflict,true));
const symbolPack=compileCatalog({schema:1,game:'ptcg',rows:['Nidoran♀','Nidoran♂','Unown !','Unown ?'].map((name,i)=>['symbol-'+i,name,'symbol','25',102,'Symbol fixture',''])});
for(const name of ['Nidoran♀','Nidoran♂','Unown !','Unown ?'])await check('Distinct printed symbol identity '+name,()=>{const r=lookupCatalog(symbolPack,{name,code:'25/102'});assert.equal(r.cands.length,1);assert.equal(r.cands[0].name,name);assert.equal(r.cands[0].exact,true);});
const setPacks={
 mtg:compileCatalog({schema:1,game:'mtg',rows:[['a','Lightning Bolt','lea','161','Limited Edition Alpha',['nonfoil'],'o','en'],['b','Lightning Bolt','m10','146','Magic 2010',['nonfoil'],'o','en']]}),
 ptcg:compileCatalog({schema:1,game:'ptcg',rows:[['a','Kyogre','cel25','3',25,'Celebrations',''],['b','Kyogre','other','3',25,'Other release','']]}),
 ygo:compileCatalog({schema:1,game:'ygo',rows:[['46986414','Dark Magician','LOB-EN005','Ultra Rare','Legend of Blue Eyes White Dragon','Normal Monster'],['46986414','Dark Magician','SDY-006','Ultra Rare','Starter Deck Yugi','Normal Monster']]})
};
const setLookup=createScannerLookup({local:async game=>setPacks[game],candById:async()=>null,match:async()=>({cands:[]}),requestMagic:async()=>null,sources:{ptcg:{byNameNumber:async()=>[]}}});
for(const [game,name,number,set,want] of [
 ['mtg','Lightning Bolt','161','Limited Edition Alpha','a'],
 ['mtg','Lightning Bolt','161','LEA','a'],
 ['ptcg','Kyogre','3/25','Celebrations','a'],
 ['ptcg','Kyogre','3/25','CEL25','a'],
 ['ygo','Dark Magician','5','Legend of Blue Eyes White Dragon','LOB-EN005|Ultra Rare'],
 ['ygo','Dark Magician','5','LOB','LOB-EN005|Ultra Rare'],
])await check(game+' structured set '+set,async()=>{const found=await setLookup(game,{name,number,set,strictName:true});assert.equal(found.length,1);assert.equal(game==='ygo'?found[0].print:found[0].id,want);assert.equal(found[0].exact,false);});
for(const [game,name,number,set] of [
 ['mtg','Lightning Bolt','161','Magic 2010'],
 ['ptcg','Kyogre','99/25','Celebrations'],
 ['ygo','Dark Magician','LOB-EN005','Starter Deck Yugi'],
])await check(game+' AI set/number contradiction cannot broaden',async()=>assert.deepEqual(await setLookup(game,{name,number,set,strictName:true}),[]));
for(const [game,name,number,set,card,print] of [
 ['mtg','Lightning Bolt','161','Limited Edition Alpha',{id:'online-mtg',name:'Lightning Bolt',set:'lea',set_name:'Limited Edition Alpha',collector_number:'161'},''],
 ['ptcg','Kyogre','3/25','Celebrations',{id:'online-ptcg',name:'Kyogre',set:{id:'cel25',name:'Celebrations',number:'3',total:25}},''],
 ['ygo','Dark Magician','LOB-EN005','Legend of Blue Eyes White Dragon',{id:'46986414',name:'Dark Magician',sets:[{code:'LOB-EN005',rarity:'Ultra Rare',name:'Legend of Blue Eyes White Dragon'}]},'LOB-EN005|Ultra Rare'],
]){
 const candidate={id:card.id,name:card.name,card,print};
 const online=createScannerLookup({local:async()=>null,candById:async()=>candidate,requestMagic:async path=>({data:path==='/sets'?[{code:'lea',name:'Limited Edition Alpha'}]:[card]}),sources:{ptcg:{byNameNumber:async()=>[card]}},match:async()=>({cands:[candidate]})});
 await check(game+' online full set name verified against provider identity',async()=>{assert.equal((await online(game,{name,number,set,strictName:true})).length,1);assert.deepEqual(await online(game,{name,number,set:'A different release',strictName:true}),[]);});
}
await check('Invalid set punctuation cannot match missing metadata',async()=>{const card={id:'invalid-set',name:'Lightning Bolt',set:'m10',collector_number:'161'};const lookup=createScannerLookup({local:async()=>null,candById:async()=>({id:card.id,name:card.name,card}),requestMagic:async()=>({data:[card]})});await assert.rejects(()=>lookup('mtg',{name:card.name,set:'???',strictName:true}),/valid set/);});
await check('Hydration cannot substitute another ID',async()=>{const lookup=createScannerLookup({local:async()=>setPacks.mtg,candById:async()=>({id:'wrong',card:{id:'wrong',name:'Lightning Bolt',set:'lea',collector_number:'161'}})});assert.deepEqual(await lookup('mtg',{name:'Lightning Bolt',number:'161',set:'LEA',strictName:true}),[]);});
await check('AI descriptor is rechecked after local hydration',async()=>{const lookup=createScannerLookup({local:async()=>setPacks.mtg,candById:async()=>({id:'a',card:{id:'a',name:'Lightning Bolt',set:'lea',collector_number:'999'}})});assert.deepEqual(await lookup('mtg',{name:'Lightning Bolt',number:'161',set:'LEA',strictName:true}),[]);});
await check('Full Yu-Gi-Oh release name cannot collapse to a shared prefix',async()=>{const pack=compileCatalog({schema:1,game:'ygo',rows:[['46986414','Dark Magician','LOB-EN005','Ultra Rare','Original release','Normal Monster'],['46986414','Dark Magician','LOB-EN005','Ultra Rare','Anniversary release','Normal Monster']]});const lookup=createScannerLookup({local:async()=>pack,candById:async()=>null});const found=await lookup('ygo',{name:'Dark Magician',set:'Original release',strictName:true});assert.equal(found.length,1);assert.equal(found[0].releaseName,'Original release');});
await check('Cold Magic set code constrains the provider search',async()=>{const paths=[],card={id:'cold',name:'Lightning Bolt',set:'lea',collector_number:'161'};const lookup=createScannerLookup({local:async()=>null,candById:async()=>null,requestMagic:async path=>{paths.push(path);return {data:path==='/sets'?[{code:'lea',name:'Limited Edition Alpha'}]:[card]};}});assert.equal((await lookup('mtg',{name:'Lightning Bolt',set:'LEA',strictName:true})).length,1);assert.match(new URL('https://fixture.test'+paths.find(p=>p.startsWith('/cards/search'))).searchParams.get('q'),/e:lea/);});
await check('Cold Magic full names resolve to cached real set codes',async()=>{const paths=[],card={id:'cold',name:'Memory Lapse',set:'mir',set_name:'Mirage',collector_number:'73'};const lookup=createScannerLookup({local:async()=>null,candById:async()=>null,requestMagic:async path=>{paths.push(path);return {data:path==='/sets'?[{code:'mir',name:'Mirage'}]:[card]};}});for(let i=0;i<2;i++)assert.equal((await lookup('mtg',{name:'Memory Lapse',set:'Mirage',strictName:true})).length,1);assert.equal(paths.filter(p=>p==='/sets').length,1);assert(paths.filter(p=>p.startsWith('/cards/search')).every(p=>new URL('https://fixture.test'+p).searchParams.get('q').includes('e:mir')));});
console.log(`${checks} passed, ${failures} failed (text and catalogue fixtures only)`);
if(failures)process.exitCode=1;
