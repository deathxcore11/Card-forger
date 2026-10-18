import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('.',import.meta.url).pathname;
const report=[];
const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true,userAgent:'Isolated audit'},configurable:true});
globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.window={addEventListener(){}};globalThis.location={search:'',origin:'https://test.invalid',pathname:'/',hash:'#home'};
globalThis.fetch=async()=>Response.json({external:{email:true}});
const ws=names=>({collection:names.map(name=>({id:name,name,qty:1})),decks:[],settings:{},tcg:{}});
let cloud={data:ws(['Original']),revision:1};
const client={auth:{onAuthStateChange(){},async getSession(){return {data:{session:{user:{id:'synthetic-same-owner'}}}};}},from(table){let update,revision;const q={select(){return q;},eq(k,v){if(k==='revision')revision=v;return q;},update(v){update=v;return q;},async maybeSingle(){return {data:table==='profiles'?null:structuredClone(cloud)};},then(resolve){assert.equal(table,'workspaces');if(revision!==cloud.revision)return resolve({data:[]});cloud={data:structuredClone(update.data),revision:update.revision};resolve({data:[{revision:cloud.revision}]});}};return q;}};
const tabs=[];
for(const id of ['A','B']){
 const module=await import('file://'+root+'cloud.js?audit-tab='+id),tab={id,module,state:ws(['Original']),conflicts:0};
 await module.initCloud({getState:()=>tab.state,status(){},changed(){},decide(){tab.conflicts++;},apply:async data=>{tab.state=structuredClone(data);},backup:async()=>{}},{createClient:()=>client});
 await new Promise(r=>setTimeout(r,0));await module.startSync();tabs.push(tab);
}
tabs[0].state.collection.push({id:'A-added',name:'A-added',qty:1});await tabs[0].module.startSync();
assert(cloud.data.collection.some(x=>x.name==='A-added'));
tabs[1].state.collection.push({id:'B-added',name:'B-added',qty:1});await tabs[1].module.startSync();
assert(cloud.data.collection.some(x=>x.name==='A-added'));assert(!cloud.data.collection.some(x=>x.name==='B-added'));assert.equal(tabs[1].conflicts,1);
report.push({finding:'01',fixed:true,finalRevision:cloud.revision,finalCards:cloud.data.collection.map(x=>x.name),conflicts:tabs[1].conflicts});

const app=await readFile(root+'app.js','utf8');
const commit=app.slice(app.indexOf('async function commit('),app.indexOf('\nconst safely ='));
const saveLot=app.slice(app.indexOf('async function saveLot('),app.indexOf('\nlet setsIndex ='));
const verifiedLot=app.slice(app.indexOf('function verifiedLot('),app.indexOf('\nasync function verifyPhysical('));
const initialCtx={lookup:{name:'Sol Ring'}};
const fields={addQty:'1',lotManualValue:'',addCondition:'Near Mint',addSet:'C21',addNumber:'263',addFinish:'nonfoil',addLanguage:'en',addLocation:'A-private-location'};
const elements=new Map(Object.entries(fields).map(([k,v])=>['#'+k,{value:v}]));
elements.set('#addError',{textContent:''});elements.set('#addSaveBtn',{});
let releaseVerification;const delayed=new Promise(r=>releaseVerification=r);const writes=[];
const context=vm.createContext({structuredClone,Date,Number,Math,Error,console,S:{state:ws([]),ui:{sheetCtx:initialCtx},pendingPrintings:null},accountGeneration:1,accountLocked:false,workspaceTransition:null,STORAGE:'workspace',lastActTarget:null,conditionWorkspaceRevision:0,lastUndo:null,
 $:selector=>elements.get(selector),uid:()=> 'old-A-card',conditionName:x=>x,busy:()=>()=>{},verifyPhysical:()=>delayed,key:x=>String(x).toLowerCase(),rememberLocation:(s,g,name)=>name,queueWorkspaceWrite:fn=>Promise.resolve().then(fn),stripCache:s=>s,normalize:s=>s,recordHomeDeckWork(){},writeRecords:async rec=>{writes.push(structuredClone(rec));},accountStorageOptions:()=>({}),changedConditionLots:()=>[],afterLocalSave(){},saveCatalogSoon(){},render(){},refreshSheet(){},haptic(){},toast(){},closeSheet(){},setTimeout(){},autoEnrich(){},meta:()=>null,cacheCard(){},slim:x=>x});
vm.runInContext(commit+'\n'+verifiedLot+'\n'+saveLot,context);
const saving=vm.runInContext('saveLot(false)',context);
context.accountGeneration=2;context.S.state=ws(['B-only']);context.S.ui.sheetCtx=null;
releaseVerification({id:'verified-sol-ring',name:'Sol Ring',set:'c21',collector_number:'263',finishes:['nonfoil'],lang:'en'});
await saving;
assert(!context.S.state.collection.some(x=>x.name==='Sol Ring'));assert.equal(writes.length,0);assert.equal(context.S.pendingPrintings,null);
assert.equal(elements.get('#addError').textContent,'');
report.push({finding:'02',fixed:true,accountGeneration:context.accountGeneration,finalCards:context.S.state.collection.map(x=>x.name),writes:writes.length,privateLocationCrossed:context.S.state.collection.some(x=>x.location==='A-private-location')});

const {validateYgo,YGO_FORMATS}=await import('file://'+root+'ygo.js');
const {validatePtcg,PTCG_FORMATS}=await import('file://'+root+'ptcg.js');
const ygo=validateYgo({zones:{main:Array.from({length:40},(_,i)=>({cardId:'unknown-'+i,qty:1}))}},()=>null,YGO_FORMATS[0]);
const poke=validatePtcg({zones:{main:Array.from({length:60},(_,i)=>({cardId:String(i),qty:1}))}},id=>id==='0'?{name:'Basic fixture',basicPokemon:true,legal:{standard:true}}:null,PTCG_FORMATS[0]);
assert.equal(ygo.filter(x=>x.level==='pending').length,40);assert.equal(poke.filter(x=>x.level==='pending').length,59);
report.push({finding:'07',fixed:true,ygoUnknown:40,ygoIssues:ygo,pokemonUnknown:59,pokemonIssues:poke});
const {deckComparison,comparisonTotals}=await import('file://'+root+'deck-flow.js');
const {gaps,validateDeck,cardKey}=await import('file://'+root+'core.js');
const d={id:'shop-fixture',format:'Modern',cards:[{name:'Mountain',qty:60}],side:[{name:'Negate',qty:4}]},owned=[{id:'mountain',name:'Mountain',qty:60,reserved:0}];
const shop=comparisonTotals(deckComparison(d,owned,[],{})),actual=gaps(d,owned,[]).reduce((n,r)=>n+r.missing,0);
assert.equal(shop.missing,4);assert.equal(actual,4);
report.push({finding:'08',fixed:true,shopMissing:shop.missing,physicalMissing:actual});
const {powerReadiness}=await import('file://'+root+'power.js');
const {formatOf}=await import('file://'+root+'formats.js');
const deck={id:'copy-fixture',format:'Modern',cards:[{name:'Seven Dwarves',qty:7},{name:'Mountain',qty:53}],side:[]};
const cat={'seven dwarves':{name:'Seven Dwarves',type_line:'Creature — Dwarf',oracle_text:'A deck can have up to seven cards named Seven Dwarves.',legalities:{modern:'legal'},color_identity:['R']},mountain:{name:'Mountain',type_line:'Basic Land — Mountain',oracle_text:'',legalities:{modern:'legal'},color_identity:['R']}};
const validation=validateDeck(deck,cat,[],[]),ready=powerReadiness('mtg',deck,formatOf(deck),name=>cat[cardKey(name)]);
assert(!validation.issues.some(x=>/copies|singleton/.test(x.kind)));assert(!ready.issues.some(x=>x.includes('7 copies')));
report.push({finding:'15',fixed:true,validatorCopyIssues:validation.issues.filter(x=>/copies|singleton/.test(x.kind)),powerIssues:ready.issues});
console.log('PASS: actual isolated cloud tabs, late Magic add across account switch, unresolved deck checks, physical sideboard and copy-limit consistency.');

// Actual durable local boundary: same account, two independent tab baselines.
const {createAccountWorkspaces}=await import('./account-workspaces.js');
const {readRecord,writeRecord,writeRecords}=await import('./storage.js');
Object.defineProperty(navigator,'locks',{value:{request:async(_n,fn)=>fn()}});
store.clear();let stateA=ws(['Original']),stateB=ws(['Original']);
const vault=read=>createAccountWorkspaces({read:readRecord,write:writeRecords,getState:read,blank:()=>ws([]),normalize:x=>x,storage:'local-workspace',recovery:'local-recovery'});
const va=vault(()=>stateA),vb=vault(()=>stateB);stateA=(await va.switchTo('owner',null)).state;stateB=(await vb.switchTo('owner',null)).state;
const writeA=ws(['Original','A-local']),writeB=ws(['Original','B-local']);
await writeRecord('local-workspace',writeA,{guardRecord:va.guard});
await assert.rejects(writeRecord('local-workspace',writeB,{guardRecord:vb.guard}),e=>e.code==='WORKSPACE_CONFLICT');
assert.deepEqual(await readRecord('local-workspace'),writeA);assert.equal(await vb.current(),false);
// A tab's own queued writes advance its baseline without making its next save stale.
await Promise.all([writeRecord('local-workspace',writeA,{guardRecord:va.guard}),writeRecord('local-workspace',ws(['A-latest']),{guardRecord:va.guard})]);
assert.deepEqual(await readRecord('local-workspace'),ws(['A-latest']));
console.log('PASS: durable same-owner stale-tab refusal and serialized same-tab writes.');

const {verifyLeader,canLead}=await import('./formats.js');
const pdh=formatOf('Pauper Commander'),rager={id:'rager',oracle_id:'oracle-rager',name:'Phyrexian Rager',type_line:'Creature',rarity:'uncommon',legalities:{paupercommander:'legal'},color_identity:['B']};
assert.equal(canLead(rager,pdh),false,'selected printing rarity does not grant commander membership');
await verifyLeader(rager,pdh,async()=>{throw Object.assign(Error('No match'),{status:404});});assert.equal(canLead(rager,pdh),false);
const leader={id:'rare-print',oracle_id:'oracle-leader',name:'Verified leader',type_line:'Artifact — Vehicle',rarity:'rare',legalities:{paupercommander:'not_legal'},color_identity:[]};
await verifyLeader(leader,pdh,async path=>{assert(new URL('https://fixture.invalid'+path).searchParams.get('q').includes('is:paupercommander oracleid:oracle-leader'));return {data:[{oracle_id:'oracle-leader'}]};});assert.equal(canLead(leader,pdh),true);
const pdhDeck={format:'Pauper Commander',commander:leader.name,cards:[{name:leader.name,qty:1},{name:'Wastes',qty:99}]};
const pdhCatalog={'verified leader':leader,wastes:{name:'Wastes',type_line:'Basic Land',legalities:{paupercommander:'legal'},color_identity:[]}};
assert(!validateDeck(pdhDeck,pdhCatalog,[]).issues.some(i=>i.kind==='legality'||i.kind==='commander'));
assert.equal(powerReadiness('mtg',pdhDeck,pdh,n=>pdhCatalog[cardKey(n)]).provisional,false);
await assert.rejects(verifyLeader({...rager,pdhCommander:undefined},pdh,async()=>{throw Error('offline')}),/offline/);

const {resolveFinish}=await import('./finish-effects.js');const {normalizeYgo}=await import('./ygo.js');const {artworkSources,knownPokemonPlaceholder}=await import('./artwork.js');
const mantine={game:'ptcg',id:'swsh8-061',name:'Mantine',category:'Pokemon',rarity:'Common',set:{id:'swsh8'},variants:[{key:'normal',label:'Normal'},{key:'reverse-holofoil',label:'Reverse Holo'}]};
assert.equal(resolveFinish('ptcg',mantine,{priceFinish:'normal'}).effect,'plain');assert.equal(resolveFinish('ptcg',mantine,{priceFinish:'reverse-holofoil'}).layers[0].mask,'pk-swsh-surround');
const yc={game:'ygo',id:'test',sets:[{code:'HSRD-EN041',rarity:'Ultra Rare',price:null}],displayPrintingKey:'HSRD-EN041::Ultra Rare'};
assert.equal(resolveFinish('ygo',yc,{}).effect,'ygo-ultra','selected exact printing survives a render without a price');
const bad=normalizeYgo({id:1,name:'Numeric rarity',card_sets:[{set_code:'SDWD-EN001',set_name:'Structure',set_rarity:2}]});assert.equal(bad.sets[0].rarity,'');assert.equal(bad.sets[0].rarityRaw,2);
assert(knownPokemonPlaceholder('https://images.pokemontcg.io/me55c/1_hires.png'));
const art=artworkSources({game:'ptcg',id:'me55c-001',set:{id:'me55c',number:'001'},image:'https://images.pokemontcg.io/me55c/1_hires.png'},true);assert(!art.some(knownPokemonPlaceholder));assert(art.some(u=>u.includes('/me55c-001.jpg')));assert(!art.some(u=>u.includes('base1')));
console.log('PASS: Oracle-level PDH membership, body-versus-leader legality, Common reverse holo, missing-price YGO finish, invalid rarity and known card-back references.');
