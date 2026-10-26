import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createForgeArtworkPreparation } from './play-forge-artwork.js';
import { createForgePlayerMat } from './play-forge-player-mat.js';
import { createForgeHostClient, exactDigest, FORGE_REVISION } from './play-forge-host-client.js';
import { chooseQuickOpponent } from './play-quick-match.js';
const OWNER='11111111-1111-4111-8111-111111111111', MATCH='22222222-2222-4222-8222-222222222222', GENERATION='33333333-3333-4333-8333-333333333333';
const introStub=()=>({refreshArtwork(){},chooseStartingPlayer:async()=> 'random',status(){},reveal:async()=>false,destroy(){}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function dom(){
 const doc={defaultView:{addEventListener(){},removeEventListener(){}}};
 const node=tag=>({tag,ownerDocument:doc,children:[],classList:{add(){},remove(){}},style:{},setAttribute(){},addEventListener(){},focus(){},remove(){},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},querySelector(tag){return this.children.find(n=>n.tag===tag)||null;}});
 doc.createElement=node;doc.body=node('body');doc.head=node('head');doc.getElementById=()=>null;
 return {root:node('main'),doc};
}
function setup(format='Commander'){
 const deck=(name,id)=>({id,name,format,commander:format==='Commander'?'Test Commander':null,cards:[{name:'Test Commander',qty:1,printingId:id,finish:'foil'},{name:'Plains',qty:format==='Commander'?99:59}],side:[{name:'Side card',qty:1}],referencePriceSelections:{plains:{printingId:'selected-plains',finish:'nonfoil'}},source:{kind:'import',originalText:'unchanged raw list'}});
 return {profile:{ownerId:OWNER,signedIn:true},playStyle:'practice',match:{mode:'cpu',format,difficulty:'Medium'},selected:deck('Your saved deck','human-printing'),opponent:deck('Found CPU deck','cpu-printing')};
}
test('artwork prepares both complete lists, keeps printings distinct and freezes only matching cards',async()=>{
 const s=setup(),before=structuredClone(s),names=[],ids=[];let network=0;
 const cards=new Map([['Test Commander',{id:'catalogue',name:'Test Commander'}],['Plains',{id:'wrong-plains',name:'Plains'}],['Side card',{id:'side',name:'Side card'}]]);
 const p=createForgeArtworkPreparation({isCurrent:()=>true,resolveNames:async n=>{names.push(...n);network++;},lookup:(name,id)=>id?null:cards.get(name),fetchPrinting:async id=>{ids.push(id);network++;return {id,name:id==='selected-plains'?'Plains':'Test Commander'};}});
 const result=await p.prepare(s);
 assert.deepEqual(new Set(names),new Set(['Test Commander','Plains','Side card']));assert.deepEqual(new Set(ids),new Set(['human-printing','cpu-printing','selected-plains']));assert.equal(result.missing,0);assert.deepEqual(s,before);
 assert.equal(p.lookup('Test Commander','human-printing').id,'human-printing');assert.equal(p.lookup('Test Commander','cpu-printing').id,'cpu-printing');
 const count=network,copy=p.lookup('Side card',null);copy.name='mutated';cards.get('Side card').name='changed catalogue';assert.equal(p.lookup('Side card',null).name,'Side card');assert.equal(network,count);
});
test('artwork outage and wrong printing do not substitute a card or reject deck access',async()=>{
 const p=createForgeArtworkPreparation({isCurrent:()=>true,resolveNames:async()=>{throw Error('offline');},lookup:()=>({id:'wrong',name:'Test Commander'}),fetchPrinting:async()=>({id:'wrong',name:'Test Commander'})});
 await p.prepare(setup());assert.equal(p.lookup('Test Commander','human-printing'),null);assert.equal(p.lookup('Plains','selected-plains'),null);
});
test('artwork deadline ignores late responses; switching accounts invalidates captured metadata',async()=>{
 const gate=deferred();let same=true;
 const p=createForgeArtworkPreparation({timeoutMs:5,isCurrent:()=>same,resolveNames:()=>gate.promise,lookup:()=>null,fetchPrinting:async()=>{throw Error('must not fetch after timeout');}});
 await p.prepare(setup());gate.resolve();await Promise.resolve();assert.equal(p.lookup('Plains','selected-plains'),null);same=false;assert.throws(()=>p.lookup('Plains','selected-plains'),/ACCOUNT_CHANGED/);
});
for(const format of ['Standard','Modern','Commander'])test('native launch sends unchanged '+format+' snapshots with the signed-in token after artwork',async()=>{
 const s=setup(format),before=structuredClone(s),events=[],requests=[],{root}=dom(),account={user:{id:OWNER},accountGeneration:1};
 const mat=createForgePlayerMat({root,mountIntro:introStub,readAccount:()=>account,readSetup:()=>s,getAccessToken:async()=>'account.token.value',lookup:()=>null,prepareArtwork:async()=>events.push('artwork'),
  createClient:options=>createForgeHostClient({...options,fetchImpl:async(path,init)=>{
   requests.push({path,init});assert.equal(init.headers.Authorization,'Bearer account.token.value');
   if(init.method==='POST'){events.push('allocation');const sent=JSON.parse(init.body);assert.deepEqual(sent.humanDeck,before.selected);assert.deepEqual(sent.opponentDeck,before.opponent);assert.equal(sent.format,format);
    return Response.json({matchId:MATCH,generation:GENERATION,expiresAt:Date.now()+60000,deckDigests:{human:await exactDigest(sent.humanDeck),opponent:await exactDigest(sent.opponentDeck)},schema:'cardstashy.forge-proof.v1',forgeRevision:FORGE_REVISION,status:'initializing'},{status:202});}
   return Response.json({matchId:MATCH,generation:GENERATION,status:'finished',viewerId:1,result:{draw:false,winnerPlayerId:1}});
  }})});
 const result=await mat.start();assert.deepEqual(events,['artwork','allocation']);assert.equal(requests.length,2);assert.deepEqual(s,before);assert.equal(result.outcome,'win');assert.equal(result.viewerId,1);
});
for(const cancel of ['account change','detach'])test(cancel+' during artwork prevents allocation',async()=>{
 const gate=deferred(),s=setup(),{root}=dom();let account={user:{id:OWNER},accountGeneration:1},creates=0;
 const mat=createForgePlayerMat({root,mountIntro:introStub,readAccount:()=>account,readSetup:()=>s,getAccessToken:async()=>'token',lookup:()=>null,prepareArtwork:()=>gate.promise,createClient:()=>{creates++;throw Error('unexpected allocation');}});
 const opening=mat.start();if(cancel==='detach')mat.detach();else account={...account,accountGeneration:2};gate.resolve();await assert.rejects(opening,/ACCOUNT_CHANGED/);assert.equal(creates,0);
});
test('account change while acquiring a token sends no request',async()=>{
 const gate=deferred();let account={user:{id:OWNER},accountGeneration:1},requests=0;
 const client=createForgeHostClient({readAccount:()=>account,getAccessToken:()=>gate.promise,fetchImpl:async()=>{requests++;throw Error('unexpected request');}}),s=setup();
 const creating=client.create({format:'Commander',humanDeck:s.selected,opponentDeck:s.opponent,difficultyPolicyVersion:'forge-medium-v1'});
 account={...account,accountGeneration:2};gate.resolve('token');await assert.rejects(creating,/ACCOUNT_CHANGED/);assert.equal(requests,0);
});
test('native Quick Play picks the same opponent list across all three CPU policies',()=>{
 const player=setup('Modern').selected,candidates=[20,45,80].map(score=>({...structuredClone(player),cards:[{name:'List '+score,qty:60}],score}));
 const selected=['Easy','Medium','Hard'].map(difficulty=>chooseQuickOpponent({player,candidates,difficulty,candidateEligible:()=>true,nativeValidationPending:true,estimate:d=>d.score??50}).deck);
 assert.deepEqual(selected[0],selected[1]);assert.deepEqual(selected[1],selected[2]);assert.equal(selected[0].score,45);
});
test('real app handler takes the Forge branch and bypasses legacy pregame and catalogue admission',async()=>{
 let source=readFileSync(new URL('./app.js',import.meta.url),'utf8').match(/A\.playStartCandidate=async\(\)=>\{[\s\S]*?\n\};/)[0];
 source=source.replace("import('./play-forge-player-mat.js')",'loadForgeMat()');
 const {doc}=dom(),s=setup(),events=[];
 const forbidden=()=>{throw Error('legacy path entered');};
 const deps={A:{},FORGE_PLAY_TEST_ENABLED:true,PLAY_MATCH_RELEASE_READY:true,toast:forbidden,T:{game:()=> 'mtg'},syncDesktopPlayEntries:()=>({eligible:true}),playSetup:{snapshot:()=>s},S:{ui:{view:'play'},state:{printings:{}}},document:doc,readPlayAccount:()=>({user:{id:OWNER}}),cloudInfo:()=>({user:{id:OWNER}}),cloudAccessToken:async()=>'token',accountGeneration:1,accountLocked:false,key:x=>x,resolveNames(){},meta(){},api(){},createForgeArtworkPreparation,createPracticeCardPreparation:forbidden,createPlayerMat:forbidden,createPracticeCatalogReview:forbidden,savePlayDeck:forbidden,closePlayerMat(){},go(){},V:{deckArtwork:forbidden},mountPracticePregame:forbidden,resolvePracticePregame:forbidden,loadForgeMat:async()=>({createForgePlayerMat:options=>({start:async()=>{assert.deepEqual(options.readSetup(),s);assert.equal(await options.getAccessToken(),'token');assert.equal(typeof options.prepareArtwork,'function');events.push('native');}})})};
 new Function(...Object.keys(deps),'let playStarting=false,playerMatHost=null,practicePregame=null,playerMatRoot=null;'+source)(...Object.values(deps));
 await deps.A.playStartCandidate();assert.deepEqual(events,['native']);
});
