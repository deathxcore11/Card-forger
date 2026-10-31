import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createForgeArtworkPreparation } from './play-forge-artwork.js';
import { createForgePlayerMat, forgeDiagnostic, forgeMatchError, capturedForgeArtwork } from './play-forge-player-mat.js';
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
test('artwork covers a Commander pod\'s extra CPU decks and commanders kept beside the list',async()=>{
 const s={...setup(),extraOpponents:[{deck:{name:'Pod deck',format:'Commander',commanders:[{name:'Pod Commander',qty:1}],cards:[{name:'Pod card',qty:99}]},difficulty:'Medium'}]},names=[];
 const known=new Map(['Test Commander','Plains','Side card','Pod Commander','Pod card'].map(n=>[n,{id:n,name:n}]));
 const p=createForgeArtworkPreparation({isCurrent:()=>true,resolveNames:async n=>{names.push(...n);},lookup:(name,id)=>id?null:known.get(name),fetchPrinting:async id=>({id,name:'Test Commander'})});
 await p.prepare(s);
 assert.ok(names.includes('Pod Commander')&&names.includes('Pod card'),'the third and fourth seats get art too');
 assert.equal(p.lookup('Pod card',null)?.name,'Pod card');
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
test('the table request does not wait for card art, and art is never read before it is ready',async()=>{
 const gate=deferred(),s=setup(),events=[],{root}=dom(),account={user:{id:OWNER},accountGeneration:1};let prepared=false;
 const lookup=()=>{if(!prepared)throw Error('FORGE_ARTWORK_NOT_PREPARED');return null;};
 const mat=createForgePlayerMat({root,mountIntro:introStub,readAccount:()=>account,readSetup:()=>s,getAccessToken:async()=>'token',lookup,wait:async()=>{},
  prepareArtwork:async()=>{events.push('artwork started');await gate.promise;prepared=true;events.push('artwork ready');},
  createClient:options=>createForgeHostClient({...options,fetchImpl:async(path,init)=>{
   if(init.method==='POST'){events.push('allocation');const sent=JSON.parse(init.body);
    return Response.json({matchId:MATCH,generation:GENERATION,expiresAt:Date.now()+60000,deckDigests:{human:await exactDigest(sent.humanDeck),opponent:await exactDigest(sent.opponentDeck)},schema:'cardstashy.forge-proof.v1',forgeRevision:FORGE_REVISION,status:'initializing'},{status:202});}
   return Response.json({matchId:MATCH,generation:GENERATION,status:'finished',viewerId:1,result:{draw:false,winnerPlayerId:1}});
  }})});
 const result=await mat.start();
 assert.deepEqual(events,['artwork started','allocation'],'the server starts the match while art is still loading');assert.equal(result.outcome,'win');
 gate.resolve();await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['artwork started','allocation','artwork ready']);
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
test('native Quick Play picks a random opponent list, the same for every CPU policy',()=>{
 const player=setup('Modern').selected,candidates=[20,45,80].map(score=>({...structuredClone(player),id:'list-'+score,cards:[{name:'List '+score,qty:60}],score}));
 const pick=(difficulty,random)=>chooseQuickOpponent({player,candidates,difficulty,candidateEligible:()=>true,nativeValidationPending:true,estimate:d=>d.score??50,random}).deck.score;
 assert.deepEqual([0,0.5,0.99].map(r=>pick('Medium',()=>r)),[20,45,80]);
 assert.deepEqual(['Easy','Medium','Hard'].map(d=>pick(d,()=>0.99)),[80,80,80]);
});
test('real app handler takes the Forge branch and bypasses legacy pregame and catalogue admission',async()=>{
 let source=readFileSync(new URL('./app.js',import.meta.url),'utf8').match(/A\.playStartCandidate=async\(\)=>\{[\s\S]*?\n\};/)[0];
 source=source.replace("import('./play-forge-player-mat.js')",'loadForgeMat()');
 const {doc}=dom(),s=setup(),events=[];
 const forbidden=()=>{throw Error('legacy path entered');};
 const deps={A:{},loadEngineCardNames:async()=>new Set(),engineUnknownCards:()=>[],engineMissingText:forbidden,nextPlaymat:()=>'ashen-forge',mountPlaymatScene:()=>null,lockPlayLandscape:async()=>'native',unmountPlaymatScene:()=>{},FORGE_PLAY_TEST_ENABLED:true,PLAY_MATCH_RELEASE_READY:true,playUpdates:{beforeMatch:async()=>false},toast:forbidden,T:{game:()=> 'mtg'},syncDesktopPlayEntries:()=>({eligible:true}),playSetup:{snapshot:()=>s},S:{ui:{view:'play'},state:{printings:{}}},document:doc,readPlayAccount:()=>({user:{id:OWNER}}),cloudInfo:()=>({user:{id:OWNER}}),cloudAccessToken:async()=>'token',accountGeneration:1,accountLocked:false,key:x=>x,resolveNames(){},meta(){},api(){},createForgeArtworkPreparation,createPracticeCardPreparation:forbidden,createPlayerMat:forbidden,createPracticeCatalogReview:forbidden,savePlayDeck:forbidden,closePlayerMat(){},go(){},V:{deckArtwork:forbidden},mountPracticePregame:forbidden,resolvePracticePregame:forbidden,loadForgeMat:async()=>({createForgePlayerMat:options=>({start:async()=>{assert.deepEqual(options.readSetup(),s);assert.equal(await options.getAccessToken(),'token');assert.equal(typeof options.prepareArtwork,'function');events.push('native');}})})};
 new Function(...Object.keys(deps),'let playStarting=false,playerMatHost=null,practicePregame=null,playerMatRoot=null;'+source)(...Object.values(deps));
 await deps.A.playStartCandidate();assert.deepEqual(events,['native']);
});
test('leaving the page releases an open server table with a request that outlives the page',async()=>{
 const account={user:{id:OWNER},accountGeneration:1},requests=[],s=setup();
 const client=createForgeHostClient({readAccount:()=>account,getAccessToken:async()=>'account.token.value',fetchImpl:async(path,init)=>{
  requests.push({path,init});if(init.method==='POST'){const sent=JSON.parse(init.body);return Response.json({matchId:MATCH,generation:GENERATION,expiresAt:Date.now()+60000,deckDigests:{human:await exactDigest(sent.humanDeck),opponent:await exactDigest(sent.opponentDeck)},schema:'cardstashy.forge-proof.v1',forgeRevision:FORGE_REVISION,status:'initializing'},{status:202});}
  return new Response(null,{status:204});}});
 assert.equal(client.release(),false,'nothing to release before allocation');
 await client.create({format:'Commander',humanDeck:s.selected,opponentDeck:s.opponent,difficultyPolicyVersion:'forge-medium-v1'});
 assert.equal(client.release(),true);assert.equal(client.release(),false,'released once');
 const sent=requests.at(-1);assert.equal(sent.path,'/api/play/matches/'+MATCH);assert.equal(sent.init.method,'DELETE');assert.equal(sent.init.keepalive,true);assert.equal(sent.init.headers.Authorization,'Bearer account.token.value');assert.equal(client.status().blocked,true);
});
test('the hosted table names its engine and website build',async()=>{
 const src=readFileSync(new URL('./play-forge-player-mat.js',import.meta.url),'utf8');
 assert.match(src,/root\.dataset\.engine='forge-hosted';root\.dataset\.build=APP_VERSION/);assert.match(src,/title:`CardStashy · Magic · \$\{APP_VERSION\}`/);assert.match(src,/addEventListener\?\.\('pagehide',pageHide\)/);
});
test('stop diagnostics carry the safe server reason and status',()=>{
 assert.equal(forgeDiagnostic({code:'match_interrupted',reason:'startup_interrupted',status:410}),'match_interrupted · startup_interrupted · HTTP 410');
 assert.equal(forgeDiagnostic({code:'HOST_REQUEST_TIMEOUT'}),'HOST_REQUEST_TIMEOUT');
 assert.equal(forgeDiagnostic({code:'match_interrupted',reason:'startup_interrupted',failure:'bootstrap_rejected',status:410}),'match_interrupted · startup_interrupted · bootstrap_rejected · HTTP 410');
});
test('Quick Play avoids your own list whenever another list exists',()=>{
 const player=setup('Modern').selected,copy={...structuredClone(player),id:'copy',name:'Copy'},other={...structuredClone(player),id:'other',cards:[{name:'Other',qty:60}]};
 const picked=chooseQuickOpponent({player,candidates:[player,copy,other],candidateEligible:()=>true,nativeValidationPending:true,estimate:d=>d===other?90:50});
 assert.equal(picked.deck.id,'other');assert.equal(picked.mirror,false);
 const reshaped={...structuredClone(player),id:undefined,name:'Precon copy',source:{kind:'precon'},cards:player.cards.map(r=>({name:r.name.toUpperCase(),qty:r.qty})).reverse()};
 assert.equal(chooseQuickOpponent({player,candidates:[reshaped,other],candidateEligible:()=>true,nativeValidationPending:true,estimate:d=>d===other?90:50}).deck.id,'other','same cards in another record is a mirror');
 assert.throws(()=>chooseQuickOpponent({player,candidates:[player],candidateEligible:()=>true,nativeValidationPending:true,estimate:()=>50}),/different deck/);
});

test('a match ended by a newer start on the same account says so, and other stops keep their messages', () => {
 assert.match(forgeMatchError({code:'match_interrupted',reason:'replaced',status:410}),/new match was started on your account/);
 assert.equal(forgeDiagnostic({code:'match_interrupted',reason:'replaced',status:410}),'match_interrupted · replaced · HTTP 410');
 assert.match(forgeMatchError({code:'match_interrupted',reason:'startup_interrupted'}),/stopped unexpectedly/);
 assert.match(forgeMatchError({code:'user_has_active_allocation'}),/still closing/);
});

test('a Universes Within flavor name finds its printing by cost, type and stats, never by guess', () => {
 const hydro={id:'e53115a4-8959-40f0-9a31-3a6f2b6cd8d4',name:'Hydro-Man, Fluid Felon',set:'spm',mana_cost:'{U}{U}',type_line:'Legendary Creature — Elemental Villain',power:'2',toughness:'2',finishes:['nonfoil'],image_uris:{normal:'https://cards.scryfall.io/normal/front/e/5/hydro.jpg'}};
 const bear={id:'b0000000-0000-4000-8000-000000000001',name:'Grizzly Bears',set:'lea',mana_cost:'{1}{G}',type_line:'Creature — Bear',power:'2',toughness:'2',finishes:['nonfoil'],image_uris:{normal:'https://cards.scryfall.io/normal/front/b/0/bear.jpg'}};
 const cards={[hydro.name]:hydro,[bear.name]:bear};
 const deck=(name,rows)=>({id:name,name,format:'Commander',commander:rows[0].name,cards:rows,side:[]});
 const base={selected:deck('Mine',[{name:'Grizzly Bears',qty:1}]),opponent:deck('CPU',[{name:'Hydro-Man, Fluid Felon',qty:1},{name:'Island',qty:99}])};
 const art=capturedForgeArtwork(base,name=>cards[name]||null);
 const belion={name:'Belion, the Parched',manaCost:'{U}{U}',type:'Legendary Creature - Elemental Villain',power:2,toughness:2,setCode:'SPM'};
 assert.equal(art('Belion, the Parched',belion)?.card.id,hydro.id,'flavor-named commander gets its own printing');
 assert.equal(art('Grizzly Bears',{name:'Grizzly Bears',manaCost:'{1}{G}',type:'Creature - Bear',power:2,toughness:2})?.card.id,bear.id,'exact names unchanged');
 assert.equal(art('Belion, the Parched',{...belion,power:3}),null,'different stats are not the same card');
 assert.equal(art('Unknown Token',{name:'Unknown Token',manaCost:'',type:'Token Creature - Bear',power:2,toughness:2}),null,'tokens never borrow deck art');
 const twin={...hydro,id:'e53115a4-8959-40f0-9a31-000000000002',name:'Other Felon'};cards[twin.name]=twin;
 const both=capturedForgeArtwork({...base,selected:deck('Mine',[{name:'Other Felon',qty:1}])},name=>cards[name]||null);
 assert.equal(both('Belion, the Parched',belion),null,'two cards that fit means no art rather than the wrong art');
 const stone={id:'09f09d0a-6054-4545-b81e-000000000003',name:'The Arkenstone // Seek the Heart',set:'hob',mana_cost:'{5} // {1}{W}',type_line:'Legendary Artifact // Sorcery',card_faces:[{name:'The Arkenstone',mana_cost:'{5}',type_line:'Legendary Artifact'},{name:'Seek the Heart',mana_cost:'{1}{W}',type_line:'Sorcery'}]};cards[stone.name]=stone;
 const halves=capturedForgeArtwork({...base,selected:deck('Mine',[{name:stone.name,qty:1}])},name=>cards[name]||null);
 assert.equal(halves('The Arkenstone',{name:'The Arkenstone',manaCost:'{5}',type:'Legendary Artifact'})?.card.id,stone.id,'a two-part card listed by its full name keeps its art when Forge names one half');
});
test('while the server starts the match the intro shows the stage and the seconds so far, then stops counting',async()=>{
 const s=setup(),{root,doc}=dom(),account={user:{id:OWNER},accountGeneration:1},calls=[];let clock=1000,tickFn=null,reads=0;
 doc.defaultView.setInterval=fn=>{tickFn=fn;return 7;};doc.defaultView.clearInterval=id=>{if(id===7)tickFn=null;};
 const intro=()=>({refreshArtwork(){},chooseStartingPlayer:async()=>'random',reveal:async()=>false,destroy(){},status:t=>calls.push(['status',t]),elapsed:t=>calls.push(['elapsed',t]),note:t=>calls.push(['note',t])});
 const mat=createForgePlayerMat({root,mountIntro:intro,readAccount:()=>account,readSetup:()=>s,getAccessToken:async()=>'token',lookup:()=>null,now:()=>clock,pollMs:3000,startupPollMs:3000,
  wait:async ms=>{for(let t=0;t<ms;t+=1000){clock+=Math.min(1000,ms-t);tickFn?.();}},
  createClient:options=>createForgeHostClient({...options,fetchImpl:async(path,init)=>{
   if(init.method==='POST'){const sent=JSON.parse(init.body);return Response.json({matchId:MATCH,generation:GENERATION,expiresAt:Date.now()+60000,deckDigests:{human:await exactDigest(sent.humanDeck),opponent:await exactDigest(sent.opponentDeck)},schema:'cardstashy.forge-proof.v1',forgeRevision:FORGE_REVISION,status:'initializing'},{status:202});}
   // About 30 seconds of start-up at a 3 s poll, then the match reports its result.
   if(++reads<11)return Response.json({matchId:MATCH,generation:GENERATION,status:'initializing'},{status:202});
   return Response.json({matchId:MATCH,generation:GENERATION,status:'finished',viewerId:1,result:{draw:false,winnerPlayerId:1}});
  }})});
 await mat.start();
 assert.deepEqual(calls.find(c=>c[0]==='status'),['status','Starting the rules engine…']);
 const seconds=calls.filter(c=>c[0]==='elapsed'&&c[1]).map(c=>c[1]);
 assert.equal(seconds[0],'0 s');assert.ok(seconds.includes('12 s')&&seconds.includes('29 s'),'the counter follows the clock');
 const notes=calls.filter(c=>c[0]==='note'&&c[1]).map(c=>c[1]);
 assert.equal(notes[0],'Setting up a table can take up to a minute. Keep this page open.','the wait is announced from the first second');
 const later=calls.findIndex(c=>c[0]==='note'&&c[1]==='Still setting up. The first match after an update takes longer.');
 assert.ok(later>calls.findIndex(c=>c[0]==='elapsed'&&c[1]==='25 s'),'the longer-wait line comes after 25 seconds');
 assert.equal(tickFn,null,'no timer is left running once the start ends');
});
test('startup progress from the host keeps only step names and bounded milliseconds',async()=>{
 const {startupProgress}=await import('./play-forge-host-client.js');
 assert.deepEqual(startupProgress({warm:true,step:'ready',ms:{claim:0,bootstrap:40,ready:900,'<b>':1,big:9e9,neg:-1},extra:'x'}),{warm:true,step:'ready',ms:{claim:0,bootstrap:40,ready:900}});
 assert.equal(startupProgress({step:'<script>'}),null);assert.equal(startupProgress(null),null);
 assert.deepEqual(startupProgress({step:'start',warm:'yes'}),{warm:false,step:'start',ms:{}});
});
