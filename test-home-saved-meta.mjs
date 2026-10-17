// Actual render scheduling + actual score-leaf painter. No browser or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { S, blank } from './store.js';
import { metaState } from './meta.js';
import { refreshHomeCommunity, homeMetaKey } from './home-ui.js';
import { deckTile, refreshDeckScores } from './views.js';
import { mtgMetaKey, mtgPower, powerChip } from './power.js';
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('  if (g === "mtg" && ["decks", "home"].includes(ui.view))');
const end=source.indexOf('\n  if (ui.view === "settings")',start);
assert(start>0 && end>start);
const block=source.slice(start,end);
assert.match(source,/const savedDeckMetaRequests = new Map\(\)/);
let epoch=Date.now()+86400000,network=0;
globalThis.fetch=()=>{network++;throw Error('No provider requests allowed');};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{resolve,reject,promise};};
const makeRoot=()=>{
  const root={isConnected:true,firstElementChild:{},dataset:{disclosureKey:'mtg:home'},search:{value:'Keep my exact typed search'},rail:{},value:{},score:{isConnected:true,dataset:{deckScore:'saved'},innerHTML:'old score'}};
  root.querySelector=()=>null;
  root.querySelectorAll=()=>[root.score];
  return root;
};
for(const view of ['home','decks']) for(const format of ['Modern','Standard','Pioneer'])
for(const focus of ['search','rail','value']) for(const outcome of ['current','route','game','mount','context','workspace','navigation','return','reject','before-timer']) {
  S.state=blank();S.state.settings.game='mtg';S.state.decks=[{id:'saved',name:'Saved plan',format,cards:[],side:[]},{id:'same-format',name:'Another plan',format,cards:[],side:[]}];
  S.ui.view=view;S.ui.sheetCtx=null;delete S.ui.mtgMeta;
  const savedKey=mtgMetaKey(S.state.decks[0]),homeKey=homeMetaKey('mtg'),keys=[...new Set([savedKey,homeKey])];
  for(const key of keys)Object.assign(metaState(key),{data:null,busy:false,at:0,error:'',promise:null});
  let root=makeRoot(),game='mtg',renders=0,paints=0,navigationValid=true;
  root.dataset.disclosureKey=`mtg:${view}`;
  const original=root,identity={search:root.search,rail:root.rail,value:root.value,mount:root.firstElementChild},requests=new Map(),calls=new Map(),timers=[];
  const doc={body:{dataset:{view,game}},activeElement:root[focus]};
  const loadMetaData=key=>{
    calls.set(key,(calls.get(key)||0)+1);
    const M=metaState(key);if(M.busy)return M.promise;
    const pending=deferred();requests.set(key,pending);M.busy=true;
    M.promise=pending.promise.then(()=>M.data={source:'Magic Online',top:[],archetypes:[],decks:[],events:[]}).finally(()=>{M.busy=false;});
    return M.promise;
  };
  const context={screen:{},navigationCurrent:()=>navigationValid,g:game,ui:S.ui,S,content:root,disclosureKey:root.dataset.disclosureKey,T:{game:()=>game},V:{refreshDeckScores:r=>{paints++;refreshDeckScores(r);}},$:()=>root,metaState,mtgMetaKey,autoMeta:new Set(),savedDeckMetaRequests:new Map(),setTimeout:fn=>timers.push(fn),loadMetaData,render:()=>{renders++;root.search={value:''};root.rail={};root.value={};}};
  const schedule=()=>{context.g=game;context.content=root;context.disclosureKey=root.dataset.disclosureKey;vm.runInNewContext(block,context);};
  let shared=Promise.resolve();
  if(view==='home')shared=refreshHomeCommunity('mtg',root,{now:epoch+=86400000,documentRef:doc,loadNews:async()=>{},loadDecks:loadMetaData});
  schedule();schedule();
  assert.equal(timers.length,1,'same render/multiple saved decks schedule only one bounded format task');
  if(outcome==='before-timer'){S.ui.view='collection';doc.body.dataset.view='collection';}
  await Promise.resolve();
  for(const timer of timers.splice(0))timer();
  if(outcome==='before-timer') {
    assert.equal(context.savedDeckMetaRequests.size,0);assert(!context.autoMeta.has(savedKey),'navigation before request start permits a later retry');
  } else {
    assert.equal(calls.get(savedKey),1,'same-format Home promise is subscribed without a second loader call; other formats load exactly once');
    if(view==='home')assert.equal(calls.get(homeKey),1,'Home keeps its selected format independently of saved-deck format');
    if(outcome==='route'){S.ui.view='collection';doc.body.dataset.view='collection';root.dataset.disclosureKey='mtg:collection';}
    if(outcome==='game'){game='ygo';doc.body.dataset.game='ygo';}
    if(outcome==='mount' || outcome==='return') {
      original.isConnected=false;original.score.isConnected=false;root=makeRoot();root.dataset.disclosureKey=`mtg:${view}`;doc.activeElement=root[focus];
      if(outcome==='return'){schedule();assert.equal(timers.length,0,'new mount subscribes to the in-flight task without another timer/request');}
    }
    if(outcome==='context')S.ui.sheetCtx={type:'proven',key:'another-inspector'};
    if(outcome==='workspace')S.state=blank();
    if(outcome==='navigation')navigationValid=false;
  }
  for(const [key,pending] of requests)outcome==='reject'&&key===savedKey?pending.reject(Error('fixture unavailable')):pending.resolve();
  await shared;await settle();
  assert.equal(renders,0,'saved-deck completion never invokes full render on Home or a later game/route');
  const valid=outcome==='current'||outcome==='return';
  assert.equal(paints,valid?1:0,'only the subscribed current mount/game/view/context may receive score leaves');
  if(valid)assert.equal(root.score.innerHTML,powerChip(mtgPower(S.state.decks[0])),'current score comes from the actual existing cached model');
  else assert.equal(root.score.innerHTML,'old score');
  assert.equal(original.search,identity.search);assert.equal(original.search.value,'Keep my exact typed search');
  assert.equal(original.rail,identity.rail);assert.equal(original.value,identity.value);assert.equal(original.firstElementChild,identity.mount);
  if(outcome!=='mount'&&outcome!=='return')assert.equal(doc.activeElement,identity[focus],'completion never steals focus');
  assert.equal(context.savedDeckMetaRequests.size,0,'settlement releases transient subscribers');
}
// A focused containing deck button stays mounted; the painter is idempotent and
// skips deleted/detached rows without touching other price or ownership labels.
S.state=blank();S.state.decks=[{id:'saved',name:'Saved plan',format:'Standard',cards:[],side:[]}];
assert.match(deckTile(S.state.decks[0]),/data-deck-score="saved"/);
let writes=0,html='old';const node={dataset:{deckScore:'saved'},isConnected:true,get innerHTML(){return html;},set innerHTML(value){writes++;html=value;}};
refreshDeckScores({querySelectorAll:()=>[node]});refreshDeckScores({querySelectorAll:()=>[node]});assert.equal(writes,1);
node.isConnected=false;refreshDeckScores({querySelectorAll:()=>[node]});assert.equal(writes,1);
node.isConnected=true;S.state.decks=[];refreshDeckScores({querySelectorAll:()=>[node]});assert.equal(writes,1);
assert.equal(network,0);
console.log('PASS: actual saved Magic Meta scheduling shares same-format Home requests, loads other formats once, preserves typed/focused search/rail/value/mount identity, updates actual score leaves only, resubscribes remounts and rejects stale route/game/context/workspace/error completions.');
