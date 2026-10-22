// Actual Home action, delayed set completion, no real browser/network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8');
const state={loaded:false,busy:true,cards:[]};let game='ygo',nav=0,resolve,opens=0,scope=1,loadCalls=0;
const S={ui:{view:'home',tsetId:'fixture-set'}},A={tSetByName:async()=>{S.ui.view='set';nav++;},openSetPack:async()=>{opens++;}};
const messages=[],ctx={A,S,T:{heroFor:()=>({id:'seed',name:'Seed'}),game:()=>game,ui:()=>({set:state})},mutationScope:()=>scope,mutationCurrent:n=>n===scope,navigationStamp:()=>nav,navigationCurrent:n=>n===nav,dailyDetails:async()=>({set:{id:'fixture-set',name:'Fixture set'},rarity:'Secret Rare'}),toast:s=>messages.push(s),tcgCtx:{openSet:()=>{loadCalls++;return new Promise(r=>resolve=r);}}};
vm.runInNewContext(source.slice(source.indexOf('let homePackRequest=0;'),source.indexOf('// Suspended/mobile tabs')),ctx);
const tick=()=>new Promise(r=>setImmediate(r)),button=()=>({dataset:{game},isConnected:true});
const b=button(),first=A.homeTodayPack(b);await tick();assert.equal(loadCalls,1);assert.equal(opens,0);assert(b.disabled);
// Advancing the old deadline would have abandoned this: only the promise is used.
assert(!source.slice(source.indexOf('let homePackRequest=0;'),source.indexOf('// Suspended/mobile tabs')).includes('setTimeout'));
Object.assign(state,{loaded:true,busy:false,cards:[{id:'seed'}]});resolve();await first;assert.equal(opens,1);assert(!b.disabled);assert.equal(S.ui.packFeatured.rarity,'Secret Rare');
S.ui.view='home';const second=A.homeTodayPack(button());await tick();nav++;resolve();await second;assert.equal(opens,1,'navigation away discards the delayed open');
S.ui.view='home';const third=A.homeTodayPack(button());await tick();state.error='Provider unavailable';resolve();await third;assert.equal(opens,1);assert.match(messages.at(-1),/Provider unavailable/);assert.equal(S.ui.packFeatured,null);
console.log('PASS: actual cold Home pack action awaits set completion, preserves finish, reports failure and rejects late navigation.');
