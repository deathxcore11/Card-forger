// Execute the actual Home/random action callbacks against a deterministic builder.
// The delayed builder reproduces runBuild's shared-state lifetime, without network/DOM timing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { isHomeRevealCurrent } from './home-ui.js';
const app=fs.readFileSync('app.js','utf8');
const callbacks=app.slice(app.indexOf('let homeRevealPending ='),app.indexOf('A.tierToggle ='));
const build={busy:false,seed:'',results:{},format:'Commander'},S={ui:{view:'home',build,sheetCtx:null}},A={};
const nodes={'#sheet':{open:false},'#randomFormat':{value:'commander'},'#randomTheme':{value:''}};
const finishes=new Map(),starts=[],toasts=[];
let game='mtg',nextCard={name:'Card A'},apiCalls=0;
const format={id:'commander',name:'Commander',commander:true,legality:'commander'};
const context={URLSearchParams,A,S,T:{game:()=>game,formatsOf:()=>[]},FORMATS:[format],formatOf:()=>format,$:id=>nodes[id],options:()=>'',esc:String,homeDeckReveal:x=>x.name,artworkHTML:()=>'',isHomeRevealCurrent,
 openSheet:(html,ctx)=>{nodes['#sheet'].open=true;S.ui.sheetCtx=ctx;},toast:x=>toasts.push(x),busy:()=>()=>{},cacheCard:x=>x,api:async()=>{apiCalls++;return nextCard;},V:{buildSheet:()=>''},
 runBuild:()=>{const B=S.ui.build,seed=B.seed;if(B.busy)return;B.busy=true;starts.push(seed);return new Promise(resolve=>finishes.set(seed,()=>{B.results={Commander:[{seed,cards:[seed]}]};B.busy=false;resolve();}));}}
vm.runInNewContext(callbacks,context);
const settle=()=>new Promise(r=>setTimeout(r,0));
const first=A.buildRandom({dataset:{format:'commander'}});await settle();assert.equal(build.busy,true);assert.equal(build.seed,'Card A');
const firstResults=build.results;
// A direct random request also cannot overwrite a running builder or spend a fetch.
await A.buildRandom({dataset:{format:'commander'}});assert.equal(apiCalls,1);assert.equal(build.seed,'Card A');
nodes['#sheet'].open=false;S.ui.sheetCtx=null;nextCard={name:'Card B'};
A.homeRandomDeck();await A.randomDeckStart({});assert.equal(S.ui.sheetCtx.type,'home-deck-reveal');assert.equal(S.ui.sheetCtx.name,'Card B');
await A.homeBuildReveal();assert.equal(build.seed,'Card A');assert.equal(build.results,firstResults);assert.equal(build.busy,true);assert.deepEqual(starts,['Card A']);assert.match(toasts.at(-1),/still running/);assert.equal(S.ui.sheetCtx.name,'Card B','blocked reveal stays open for retry');
finishes.get('Card A')();await first;assert.equal(build.results.Commander[0].seed,'Card A');
const second=A.homeBuildReveal();await settle();assert.equal(build.seed,'Card B');assert.equal(build.busy,true);assert.deepEqual(starts,['Card A','Card B']);assert.equal(S.ui.sheetCtx.type,'build');
finishes.get('Card B')();await second;assert.equal(build.results.Commander[0].seed,'Card B');assert.equal(build.busy,false);
// Closing/replacing a pending picker scopes its lock away; an abandoned game's
// lookup must not silently block the new game's request or unlock a newer request.
let finishYgo;A.tRandomDeck=()=>new Promise(resolve=>finishYgo=resolve);game='ygo';context.T.formatsOf=()=>[format];A.homeRandomDeck();const abandoned=A.randomDeckStart({});await settle();
nodes['#sheet'].open=false;S.ui.sheetCtx=null;game='mtg';let finishMagic;
context.api=()=>{apiCalls++;return new Promise(resolve=>finishMagic=resolve);};
A.homeRandomDeck();const newMagic=A.randomDeckStart({});await settle();const callsDuringNew=apiCalls;assert.equal(typeof finishMagic,'function','a pending YGO pick does not block a new Magic picker');
finishYgo();await abandoned;await A.randomDeckStart({});assert.equal(apiCalls,callsDuringNew,'older app finally cannot clear the newer picker token');
finishMagic({name:'Card C'});await newMagic;assert.equal(S.ui.sheetCtx.name,'Card C','current request still reveals correctly after an older request completes');
// The exact TCG random callbacks must also release an abandoned same-game lock.
const tcg=fs.readFileSync('tcg.js','utf8'),tcgCallbacks=tcg.slice(tcg.indexOf('  let randomBusy ='),tcg.indexOf('  A.tVariantArt'));
const TA={},lookups=[],reveals=[];let livePicker=1;
const tcgContext={A:TA,g:()=> 'ygo',formatOf:()=>({id:'tcg',name:'Advanced'}),toast:()=>{},remember:x=>x,openBuild:()=>{},SOURCES:{ygo:{randomArchetype:()=>new Promise(resolve=>lookups.push(resolve)),legality:()=> 'legal',limit:()=>3}}};
vm.runInNewContext(tcgCallbacks,tcgContext);
const pick=id=>TA.tRandomDeck({dataset:{format:'tcg'},homePickCurrent:()=>livePicker===id,onPick:seed=>reveals.push(seed.name)});
const oldPick=pick(1);await settle();assert.equal(lookups.length,1);
livePicker=2;const newPick=pick(2);await settle();assert.equal(lookups.length,2,'same-game close/reopen starts a new request while the abandoned request remains unresolved');
lookups[0]({cards:[{id:'old',name:'Old card',category:'Monster'}]});await oldPick;assert.deepEqual(reveals,[],'abandoned TCG result never reveals');
await pick(2);assert.equal(lookups.length,2,'old finally cannot unlock the active newer TCG picker');
lookups[1]({cards:[{id:'new',name:'New card',category:'Monster'}]});await newPick;assert.deepEqual(reveals,['New card']);
console.log('PASS: actual Home callbacks preserve in-flight Magic build A, retain revealed B for retry, start B only after A completes, and release abandoned cross-game picker locks.');
