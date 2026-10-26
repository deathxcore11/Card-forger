import test from 'node:test';import assert from 'node:assert/strict';
import {assertNativePrivacy,assertLayout,boundedTimeout,FORGE_REVISION} from './acceptance-contract.mjs';
const make=()=>({schema:'cardstashy.forge-proof.v1',forgeRevision:FORGE_REVISION,viewer:0,revision:7,visibility:{schema:'cardstashy.forge-visibility.v1',forgeRevision:FORGE_REVISION,viewer:0,revision:7,cards:[]},players:[{id:0,isViewer:true,zones:{Hand:{cards:[]},Library:{cards:[]},Battlefield:{cards:[]}}},{id:1,isViewer:false,zones:{Hand:{cards:[]},Library:{cards:[]},Battlefield:{cards:[]}}}]});
test('native own hand, continuous opponent hand and exact library permission accepted',()=>{
 const s=make();for(const [id,holder,zone]of [[10,0,'Hand'],[11,1,'Hand'],[12,1,'Library']]){s.visibility.cards.push({id,zone,zoneHolder:holder});s.players[holder].zones[zone].cards.push({id,owner:1-holder,controller:holder,zone,hidden:false,name:'PUBLIC_SYNTHETIC_FIXTURE'});}
 assert.deepEqual(assertNativePrivacy(s),{privateFaces:3,grants:3});
});
for(const [name,mutate]of [
 ['absent receipt',s=>delete s.visibility],['stale receipt',s=>s.visibility.revision--],['future receipt',s=>s.visibility.revision++],['wrong viewer',s=>s.visibility.viewer=1],['wrong engine',s=>s.visibility.forgeRevision='0'.repeat(40)],['duplicate grant',s=>s.visibility.cards.push({...s.visibility.cards[0]})],['wrong holder',s=>s.visibility.cards[0].zoneHolder=0],['wrong zone',s=>s.visibility.cards[0].zone='Library'],['hidden flag missing',s=>delete s.players[1].zones.Hand.cards[0].hidden],['identity without grant',s=>s.visibility.cards=[]],['duplicate card',s=>s.players[0].zones.Hand.cards.push({...s.players[1].zones.Hand.cards[0]})],['orphan grant',s=>s.players[1].zones.Hand.cards=[]]
])test('fails closed: '+name,()=>{
 const s=make();s.visibility.cards=[{id:99,zone:'Hand',zoneHolder:1}];s.players[1].zones.Hand.cards=[{id:99,owner:0,controller:0,zone:'Hand',hidden:false,name:'SECRET_CANARY'}];mutate(s);
 assert.throws(()=>assertNativePrivacy(s),e=>!e.message.includes('SECRET_CANARY'));
});
test('public face-down object is allowed only without identity',()=>{
 const s=make();s.players[1].zones.Battlefield.cards=[{id:2,hidden:true,owner:1,controller:1,zone:'Battlefield'}];assertNativePrivacy(s);s.players[1].zones.Battlefield.cards[0].name='SECRET_CANARY';assert.throws(()=>assertNativePrivacy(s),e=>!e.message.includes('SECRET_CANARY'));
});
test('revocation removes grant and row, leaving no old permission fallback',()=>{
 const s=make();assertNativePrivacy(s);s.players[1].zones.Hand.cards=[{id:99,hidden:false,zone:'Hand',name:'SECRET_CANARY'}];assert.throws(()=>assertNativePrivacy(s));
});
test('deadline never fabricates a draw or silently extends natural wait',()=>{
 assert.equal(boundedTimeout(120000,22000,1000),21000);assert.equal(boundedTimeout(120000,200000,1000),120000);assert.throws(()=>boundedTimeout(120000,999,1000),/no result invented/);
});
const box=(x,y,width,height)=>({x,y,width,height});
const layout=()=>({width:750,height:832,hand:box(240,470,500,180),you:box(10,500,220,118),cpu:box(520,10,220,118),dock:box(10,660,730,150),exposure:Object.fromEntries(['hand','you','cpu','dock'].map(k=>[k,{visible:true,opacity:1,areaRatio:1,hits:5}])),lifeVisible:[true,true],compact:true,visibleHandCards:7,controls:[box(400,670,70,44),box(475,670,70,44),box(550,670,70,44)].map(x=>({...x,receivesPointer:true}))});
test('visible hand/HUD and compact canonical controls accepted',()=>assertLayout(layout(),{touch:true}));
for(const [name,mutate]of [['hand outside viewport',m=>m.hand.y=900],['dock obscures hand',m=>m.dock.y=600],['offscreen HUD',m=>m.you.x=-20],['covered control',m=>m.controls[0].receivesPointer=false],['undersized control',m=>m.controls[0].height=32],['no hand',m=>m.visibleHandCards=0],['expanded nonprompt dock',m=>{m.dock.height=190;m.dock.y=640;}],['wrong panel mode',m=>m.compact=false],['transparent hand',m=>m.exposure.hand.opacity=0],['clipped HUD',m=>m.exposure.you.areaRatio=.2],['occluded HUD',m=>m.exposure.cpu.hits=0],['life value not visible',m=>m.lifeVisible[1]=false]])test('layout fails closed: '+name,()=>{const m=layout();mutate(m);assert.throws(()=>assertLayout(m,{touch:true}));});

test('private stack copy without matching delivered grant fails closed',()=>{const s=make();s.stack=[{source:{id:99,zone:'Hand',hidden:false,name:'SECRET_CANARY'}}];assert.throws(()=>assertNativePrivacy(s),e=>!e.message.includes('SECRET_CANARY'));});

test('actual wait helper rejects observation/callback success after its deadline',async()=>{
 const fs=await import('node:fs/promises');const source=await fs.readFile(new URL('./browser-journey.mjs',import.meta.url),'utf8');const segment=source.slice(source.indexOf('async function until('),source.indexOf('function privacy(s)'));
 let now=0;const create=new Function('Date','observeDelivered','pause','boundedTimeout',`const stateDeadline=100,lastStage='unit test';${segment};return until;`);
 const until=create({now:()=>now},async()=>{now+=11;},async ms=>{now+=ms;},(r,d)=>boundedTimeout(r,d,now));
 await assert.rejects(until(()=>true,10),/deadline/);now=0;
 const late=create({now:()=>now},async()=>{},async ms=>{now+=ms;},(r,d)=>boundedTimeout(r,d,now));
 await assert.rejects(late(()=>{now+=11;return true;},10),/deadline/);
});
test('native one-shot prompt card must explicitly describe face visibility',()=>{const s=make();s.prompt={options:[{value:{id:91,zone:'Hand',name:'SECRET_CANARY'}}]};assert.throws(()=>assertNativePrivacy(s),e=>!e.message.includes('SECRET_CANARY'));});
test('nested masked prompt card cannot carry identity',()=>{const s=make();s.prompt={options:[{value:{card:{id:91,zone:'Hand',hidden:true,name:'SECRET_CANARY'}}}]};assert.throws(()=>assertNativePrivacy(s));});
test('native explicit one-shot and PaperCard catalog choices remain separate from board grants',()=>{const s=make();s.prompt={options:[{value:{id:91,zone:'Library',hidden:false,name:'PUBLIC_NATIVE_REVEAL'}},{value:{kind:'paperCard',name:'PUBLIC_CATALOG'}}]};assertNativePrivacy(s);});
