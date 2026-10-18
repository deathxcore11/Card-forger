// Run the real async refresh helpers/actions with deferred fixture providers.
// No network, localStorage or production account writes are used by this test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8'),tcg=fs.readFileSync('tcg.js','utf8');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const magicCode=section(app,'let magicPriceRefresh=null;','\nfunction refreshCollectionConditions(')+'\n'+section(app,'A.refreshPrices = async (t) => {','\nA.verifyAll =');
const tcgCode=section(tcg,'export async function refreshPriceCards(','\n// A store\'s price').replace('export ','')+'\n'+section(tcg,'  let priceRefresh=null;','\n  A.tExportColl =');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const card=(id,extra={})=>({id,name:'Card '+id,prices:{usd:'10'},checkedAt:'2020-01-01',...extra});
const initial=()=>({collection:[{id:'lot-a',name:'Card a',printingId:'a',printingVerified:true,manualValue:7}],printings:{a:card('a',{conditionQuotes:[{condition:'Near Mint',price:8}]})},myPrices:{'a:nonfoil':{price:7}},valueHistory:[],settings:{game:'mtg'},tcg:{ptcg:{collection:[],valueHistory:[]},ygo:{collection:[],valueHistory:[]}}});
function harness(kind='magic',state=initial()){
 const S={state:structuredClone(state),ui:{view:'collection'}},A={},catalog={};
 for(const c of Object.values(state.printings||{}))catalog[c.name.toLowerCase()]=structuredClone(c);
 let account=0,workspace=0,revision=0,game=kind==='magic'?'mtg':'ptcg',locked=false,queuedGate=null;
 const reads=[],writes=[],toasts=[],cacheWrites=[];let renders=0,unbusy=0,saveCatalog=0;
 const stamp=()=>({account,workspace,revision,game});
 const same=s=>!locked&&s.account===account&&s.workspace===workspace;
 const navigationCurrent=s=>same(s)&&s.revision===revision&&s.game===game;
 const captureCommit=()=>{const scope=stamp();return async(fn,options={})=>{
  if(queuedGate)await queuedGate.promise;
  if(!same(scope))throw Error('Workspace changed');
  if(options.guard&&!options.guard())return;
  const next=structuredClone(S.state),out=fn(next);
  // Mirrors the all-game value-history hook, not the rendering path.
  next.valueHistory.push({source:'commit'});S.state=next;writes.push({options,state:structuredClone(next)});return out;
 };};
 const context={A,S,console,Date,Map,Set,Promise,globalThis:null,navigator:{onLine:true},
  mutationScope:stamp,mutationCurrent:same,navigationStamp:stamp,navigationCurrent,scopedCommit:captureCommit,captureCommit,
  T:{game:()=>game},g:()=>game,gs:G=>S.state.tcg[G],
  api:async(path,options)=>{const wait=deferred();reads.push({path,options,wait});return wait.promise;},
  SOURCES:{ptcg:{get:async(id,options)=>{const wait=deferred();reads.push({id,options,wait});return wait.promise;}},ygo:{get:async(id,options)=>{const wait=deferred();reads.push({id,options,wait});return wait.promise;}}},
  key:s=>String(s).toLowerCase(),slim:x=>({...x}),meta:n=>catalog[String(n).toLowerCase()],
  cacheCard:(c,aliases=[])=>{cacheWrites.push(c);catalog[c.name.toLowerCase()]=c;aliases.forEach(n=>catalog[n.toLowerCase()]=c);return c;},
  remember:c=>{cacheWrites.push(c);return c;},
  saveCatalogSoon:()=>{saveCatalog++;},busy:()=>()=>{unbusy++;},render:()=>{renders++;},toast:s=>toasts.push(s)};
 context.globalThis=context;vm.createContext(context);vm.runInContext(kind==='magic'?magicCode:tcgCode,context);
 return {A,S,context,reads,writes,toasts,cacheWrites,catalog,
  get renders(){return renders;},get unbusy(){return unbusy;},get saveCatalog(){return saveCatalog;},
  replace(type){if(type==='account')account++;workspace++;revision++;S.state=initial();S.state.printings.a=card('a',{prices:{usd:'77'}});S.state.collection[0].manualValue=99;},
  changeGame(G){game=G;revision++;},navigate(){revision++;},lock(){locked=true;},
  queue(){queuedGate=deferred();return queuedGate;},
  action:()=>kind==='magic'?A.refreshPrices({}):A.tRefreshPrices({}),
  helper:force=>context.refreshMagicCollectionPrices(force)};
}
function finishMagic(h,i=0,rows){const request=h.reads[i];const identifiers=JSON.parse(request.options.body).identifiers;request.wait.resolve({data:rows||identifiers.map(q=>q.id?card(q.id):card('named',{name:q.name}))});}

// Every asynchronous identity boundary is exercised after a request has begun.
for(const interruption of ['account','workspace','game','navigation','lock']){
 const h=harness(),running=h.action();assert.equal(h.reads.length,1);
 if(interruption==='game')h.changeGame('ptcg');else if(interruption==='navigation')h.navigate();else if(interruption==='lock')h.lock();else h.replace(interruption);
 const before=JSON.stringify(h.S.state);finishMagic(h);await running;
 assert.equal(JSON.stringify(h.S.state),before,`Magic ${interruption}: stale result never changes private state`);
 assert.equal(h.writes.length,0);assert.equal(h.cacheWrites.length,0,'No cacheCard call can fire the replacement account’s alerts');
 assert.equal(h.renders,0);assert.equal(h.toasts.length,0);assert.equal(h.unbusy,0,'Retired UI is not changed');
}

// A late old response cannot unlock a newer current request.
{
 const h=harness(),old=h.action();h.replace('account');const fresh=h.action();assert.equal(h.reads.length,2);
 finishMagic(h,0);await old;
 const joined=h.action();assert.equal(h.reads.length,2,'Newer single flight survives the old finally');
 finishMagic(h,1);await Promise.all([fresh,joined]);assert.equal(h.writes.length,1);assert.equal(h.S.state.printings.a.prices.usd,'10');
 assert.equal(h.S.state.collection[0].manualValue,99,'Saved manual override is untouched');
}

// Partial provider results report failures and preserve failed data/manual prices.
{
 const state=initial();state.collection.push({id:'lot-b',name:'Card b',printingId:'b',printingVerified:true,manualValue:5},{id:'lot-c',name:'Front',qty:1});state.printings.b=card('b',{prices:{usd:'22'}});
 const h=harness('magic',state),running=h.action();
 h.S.state.printings.a.conditionQuotes=[{condition:'Lightly Played',price:3}];
 finishMagic(h,0,[card('a',{prices:{usd:'12'}}),card('split',{name:'Front // Back',card_faces:[{name:'Front'},{name:'Back'}]})]);await running;
 assert.equal(h.writes.length,1);assert.equal(h.S.state.printings.a.prices.usd,'12');assert.equal(h.S.state.printings.b.prices.usd,'22');
 assert.equal(h.S.state.printings.a.conditionQuotes[0].price,3,'Refresh preserves newer condition quotes');
 assert.equal(h.S.state.collection[0].manualValue,7);assert.equal(h.S.state.myPrices['a:nonfoil'].price,7);
 assert.equal(h.catalog.front.id,'split','Unknown names retain exact-name/face aliases');
 assert.match(h.toasts.at(-1),/refreshed for 2 cards.*1 lookup failed/);assert.equal(h.S.state.valueHistory.length,1);
}
{
 const h=harness(),running=h.action();h.reads[0].wait.reject(Error('Provider outage'));await running;
 assert.equal(h.writes.length,0);assert.match(h.toasts.at(-1),/Couldn’t refresh/);assert.doesNotMatch(h.toasts.at(-1),/refreshed for/);
 const offline=harness();offline.context.navigator.onLine=false;await offline.action();assert.equal(offline.reads.length,0);assert.match(offline.toasts.at(-1),/offline/);
}

// The queued write checks scope and navigation again, not just the fetch result.
for(const kind of ['magic','tcg'])for(const interruption of ['account','workspace','game','navigation']){
 const state=initial();state.tcg.ptcg.collection=[{cardId:'a',manualValue:7}];const h=harness(kind,state),gate=h.queue(),running=h.action();
 if(kind==='magic')finishMagic(h);else h.reads[0].wait.resolve(card('a',{game:'ptcg'}));
 await tick();
 if(interruption==='game')h.changeGame('ygo');else if(interruption==='navigation')h.navigate();else h.replace(interruption);
 const before=JSON.stringify(h.S.state);gate.resolve();await running;
 assert.equal(h.writes.length,0,`${kind} ${interruption}: stale queued commit never saves`);assert.equal(JSON.stringify(h.S.state),before);assert.equal(h.toasts.length,0);assert.equal(h.renders,0);
}

// Cancellation between Magic batches retires already staged private printings.
{
 const state=initial();state.collection=[];state.printings={};
 for(let i=0;i<151;i++){const id=String(i);state.printings[id]=card(id);state.collection.push({name:'Card '+id,printingId:id,printingVerified:true});}
 const h=harness('magic',state),running=h.action();finishMagic(h,0);await tick();assert.equal(h.reads.length,2);assert.equal(h.cacheWrites.length,75);
 h.replace('workspace');const before=JSON.stringify(h.S.state);finishMagic(h,1);await running;
 assert.equal(h.reads.length,2,'Cancelled work does not request a third batch');assert.equal(h.cacheWrites.length,75,'Only results received before replacement touch the catalogue/alerts');
 assert.equal(h.writes.length,0,'Earlier staged private printings are not committed after replacement');assert.equal(JSON.stringify(h.S.state),before);assert.equal(h.toasts.length,0);
}

// Automatic refresh is bounded; a joined explicit refresh still covers all cards.
{
 const state=initial();state.collection=[];state.printings={};
 for(let i=0;i<151;i++){const id=String(i);state.printings[id]=card(id);state.collection.push({name:'Card '+id,printingId:id,printingVerified:true});}
 const h=harness('magic',state),automatic=h.helper(false),manual=h.action();
 for(let i=0;i<5;i++){await tick();assert.equal(h.reads.length,i+1);finishMagic(h,i);}
 await Promise.all([automatic,manual]);assert.equal(h.reads.length,5);assert.equal(h.writes.length,2);assert.match(h.toasts.at(-1),/151 cards/);
}

// Six concurrent workers stop scheduling and discard completions after retirement.
for(const interruption of ['account','workspace','game','navigation']){
 const state=initial();state.tcg.ptcg.collection=Array.from({length:8},(_,i)=>({cardId:String(i),manualValue:7}));
 const h=harness('tcg',state),running=h.action();assert.equal(h.reads.length,6);
 if(interruption==='game')h.changeGame('ygo');else if(interruption==='navigation')h.navigate();else h.replace(interruption);
 const before=JSON.stringify(h.S.state);for(const r of h.reads)r.wait.resolve(card(r.id,{game:'ptcg'}));await running;
 assert.equal(h.reads.length,6);assert.equal(h.cacheWrites.length,0);assert.equal(h.writes.length,0);assert.equal(h.toasts.length,0);assert.equal(h.renders,0);assert.equal(JSON.stringify(h.S.state),before);
}

// Deduplicate requests and count actual provider successes, never cache fallbacks.
{
 const state=initial();state.tcg.ptcg.collection=[{cardId:'a',manualValue:7},{cardId:'a'},{cardId:'b'}];
 const h=harness('tcg',state),running=h.action();assert.equal(h.reads.length,2);
 h.reads[0].wait.resolve(card('a',{game:'ptcg'}));h.reads[1].wait.reject(Error('Provider outage'));await running;
 assert.equal(h.writes.length,1);assert.equal(h.cacheWrites.length,1);assert.equal(h.S.state.tcg.ptcg.collection[0].manualValue,7);
 assert.match(h.toasts.at(-1),/refreshed for 1 card.*1 lookup failed/);assert.equal(h.S.state.valueHistory.length,1);
}
{
 const state=initial();state.tcg.ptcg.collection=[{cardId:'a'}];const h=harness('tcg',state),running=h.action();h.reads[0].wait.reject(Error('Provider outage'));await running;
 assert.equal(h.writes.length,0);assert.match(h.toasts.at(-1),/Couldn’t refresh/);
}
// YGO exact-printing failures must not overwrite saved data with reference-only data.
{
 const state=initial();state.tcg.ygo.collection=[{cardId:'a'},{cardId:'b'}];const h=harness('tcg',state);h.changeGame('ygo');const running=h.action();
 h.reads[0].wait.resolve(card('a',{game:'ygo',printPriceSchema:1}));h.reads[1].wait.resolve(card('b',{game:'ygo'}));await running;
 assert.equal(h.cacheWrites.length,1);assert.equal(h.cacheWrites[0].id,'a');assert.match(h.toasts.at(-1),/1 lookup failed/);
}
// A stale TCG request cannot release the lock of a replacement request.
{
 const state=initial();state.tcg.ptcg.collection=[{cardId:'a'}];const h=harness('tcg',state),old=h.action();
 h.navigate();const fresh=h.action();assert.equal(h.reads.length,2);h.reads[0].wait.resolve(card('a',{game:'ptcg'}));await old;
 await h.action();assert.equal(h.reads.length,2);assert.match(h.toasts.at(-1),/already running/);
 h.reads[1].wait.resolve(card('a',{game:'ptcg'}));await fresh;assert.equal(h.writes.length,1);
}
console.log('PASS: real Magic/TCG refresh helpers and actions guard deferred account/workspace/game/navigation results and queued commits, preserve manual values, retire old locks, bound scheduling and report actual successes/failures.');
