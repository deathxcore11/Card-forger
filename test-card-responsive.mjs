// Pure lifecycle/fixture tests: no DOM renderer, server, browser or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {attachTilt,motionCard} from './feel.js';
import {rememberDetailViewport,restoreDetailViewport,quoteForContext} from './pricing-presentation.js';
import {visibleRulePassage,ygoTurnStructureDisplay} from './rule-reference.js';
import {auditedCollectionControl,detailHistoryContext,detailHistoryReady,collectionControlGeometry,collectionRowGeometry,noOverflow,CARDS} from './tests/detail-rules-fixtures.mjs';
import {loadSharedHistory,sharedHistory,historyKey,setHistoryRefresh} from './shared-history.js';
import * as responsiveStore from './store.js';
import {cardKey} from './core.js';
// The exact serialized native-control probe must keep subpixel dimensions and
// canvas font metrics in CSS space, at both unit scale and visual zoom.
{
 const saved={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle};
 const rectangle=(width,height=36,scale=1)=>({left:16,top:20,right:16+width*scale,bottom:20+height*scale,width:width*scale,height:height*scale,toJSON(){return {...this,toJSON:undefined};}});
 let scale=1,width=107.484375,label='All kinds';const s={width:'107.484375px',height:'36px',boxSizing:'border-box',paddingLeft:'12px',paddingRight:'12px',paddingTop:'6px',paddingBottom:'6px',borderLeftWidth:'1px',borderRightWidth:'1px',borderTopWidth:'1px',borderBottomWidth:'1px',columnGap:'10px',fontSize:'13px',fontFamily:'sans-serif',fontStyle:'normal',fontWeight:'400',fontVariant:'normal',whiteSpace:'normal',lineHeight:'18.85px',textOverflow:'clip'};
 const rail={getBoundingClientRect:()=>rectangle(288),clientWidth:288,scrollWidth:430,scrollLeft:0},el={getBoundingClientRect:()=>rectangle(width,36,scale),parentElement:rail,dataset:{change:'tCollKind',field:'kind'},value:'',get selectedOptions(){return [{label}];},getAttribute:()=> 'Kind',tabIndex:0,disabled:false,clientWidth:105,clientHeight:34,scrollWidth:105,scrollHeight:34,contains:()=>false};
 try{
  globalThis.document={activeElement:el,elementFromPoint:()=>el,createElement:()=>({getContext:()=>({measureText:text=>({width:text==='All kinds'?62.89892578125:text==='All'?18:40})})})};globalThis.getComputedStyle=(node,pseudo)=>pseudo?{width:'8.57812px'}:node===rail?{overflowX:'auto'}:s;
  let measured=collectionControlGeometry(rail);assert(Math.abs(measured.labelWidth-62.906255)<1e-6);assert.equal(measured.requiredTextHeight,18.85);assert.equal(measured.labelHeight,22);assert(measured.selectedTextWidth<=measured.labelWidth,'The exact hosted one-line label fits without any tolerance change');
  scale=1.25;measured=collectionControlGeometry(rail);assert.equal(measured.scaleX,1.25);assert.equal(measured.labelHeight,22);assert(Math.abs(measured.labelWidth-62.906255)<1e-6);assert.equal(measured.requiredTextHeight,18.85,'Zoomed rects are converted to the same CSS space as the font metrics');
  s.boxSizing='content-box';s.width='81.484375px';s.height='22px';measured=collectionControlGeometry(rail);assert(Math.abs(measured.labelWidth-62.906255)<1e-6);assert.equal(measured.labelHeight,22);
  width=107;s.width='81px';measured=collectionControlGeometry(rail);assert(measured.selectedTextWidth>measured.labelWidth);assert.equal(measured.requiredTextHeight,37.7,'A genuinely narrower wrapping label still fails the unchanged height assertion');assert(measured.requiredTextHeight>measured.labelHeight+2);
  s.whiteSpace='nowrap';width=100;s.width='74px';measured=collectionControlGeometry(rail);assert(measured.selectedTextWidth>measured.labelWidth+2,'A genuinely clipped nowrap label still fails the unchanged width assertion');
 }finally{Object.assign(globalThis,saved);}
}
console.log('PASS: exact fractional select content box, border/content-box and zoom coordinate parity; genuine wrap/nowrap clipping still fails.');
// Run the same TreeWalker/range callback as hosted CI with deliberately empty,
// split and clipped glyph ranges. Only SVG title/desc metadata are non-rendering.
{
 const saved={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle,NodeFilter:globalThis.NodeFilter,window:globalThis.window,location:globalThis.location,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight},svgNS='http://www.w3.org/2000/svg',htmlNS='http://www.w3.org/1999/xhtml';
 const rect=(left=0,top=0,width=100,height=30)=>({left,top,right:left+width,bottom:top+height,width,height,toJSON(){return {...this,toJSON:undefined};}});
 const make=()=>({getBoundingClientRect:()=>rect(),getClientRects:()=>[rect()],clientWidth:100,scrollWidth:100,textContent:'Printing',children:[],querySelectorAll:()=>[],getAttribute:()=>null,matches:()=>false,style:{visibility:'visible',opacity:'1',gridTemplateColumns:'100px 100px',width:'100px',boxSizing:'border-box',paddingLeft:'6px',paddingRight:'6px',borderLeftWidth:'1px',borderRightWidth:'1px',columnGap:'10px'}});
 const info=make(),side=make(),art=make(),target=make(),row=make(),icon=make();icon.parentElement=target;icon.getBoundingClientRect=()=>rect(2,2,20,20);icon.getAttribute=k=>k==='role'?'img':k==='aria-label'?'Grass Energy':null;icon.querySelector=()=>({textContent:'Grass Energy'});
 const title={namespaceURI:svgNS,localName:'title',parentElement:icon,ownerSVGElement:icon},text={textContent:'Grass Energy',parentElement:title,rects:[]};let texts=[text];
 row.querySelector=selector=>({'.lot-info':info,'.lot-side':side,'.lot-art':art,'.batch-mark':null})[selector];row.querySelectorAll=()=>[target];target.querySelectorAll=()=>[icon];
 try{
  globalThis.NodeFilter={SHOW_TEXT:4};globalThis.getComputedStyle=n=>n.style;globalThis.document={createTreeWalker:()=>{let i=0;return {nextNode:()=>texts[i++]||null};},createRange:()=>{let text;return {setStart:n=>{text=n;},setEnd:()=>{},getClientRects:()=>text.rects};}};
  let value=collectionRowGeometry(row);assert.equal(value.contentWidth,86);assert.equal(value.contentLeft,7);assert.equal(value.contentRight,93);assert.equal(value.columnGap,10);assert.deepEqual(value.bad,[]);assert.equal(value.words,0);assert.equal(value.icons.length,1);assert(value.icons[0].visible&&value.icons[0].named);
  row.getBoundingClientRect=()=>rect(0,0,125,37.5);value=collectionRowGeometry(row);assert.equal(value.contentWidth,86,'Container threshold remains CSS content width at125%');assert.equal(value.scaleX,1.25);assert.equal(value.contentLeft,8.75);assert.equal(value.contentRight,116.25);assert.equal(value.columnGap,12.5,'Visual edge assertions use the same scale as their rectangles');row.getBoundingClientRect=()=>rect();
  title.localName='desc';assert.deepEqual(collectionRowGeometry(row).bad,[],'SVG description is metadata too');
  title.namespaceURI=htmlNS;value=collectionRowGeometry(row);assert(value.bad.some(x=>x.word==='Grass'),'An HTML title/description element is not the SVG metadata exemption');
  title.namespaceURI=svgNS;for(const tag of ['text','tspan']){title.localName=tag;assert(collectionRowGeometry(row).bad.some(x=>x.word==='Grass'),'Real SVG '+tag+' with missing glyphs fails');}
  text.parentElement=target;assert(collectionRowGeometry(row).bad.some(x=>x.word==='Grass'),'Arbitrary zero-rectangle HTML text is not silently discarded');
  text.textContent='Printing';text.rects=[rect(0,0,20,10),rect(0,12,20,10)];assert(collectionRowGeometry(row).bad.some(x=>x.word==='Printing'),'A real split word still fails');
  text.rects=[rect(95,0,20,10)];assert(collectionRowGeometry(row).bad.some(x=>x.word==='Printing'),'Clipped visible word still fails');
  text.rects=[rect(0,0,40,10)];assert.deepEqual(collectionRowGeometry(row).bad,[]);target.style.visibility='hidden';assert(collectionRowGeometry(row).bad.some(x=>x.reason==='hidden or clipped metadata'));target.style.visibility='visible';
  text.parentElement=title;title.localName='title';icon.getAttribute=()=>null;assert(collectionRowGeometry(row).bad.some(x=>x.reason==='Accessible icon is hidden, clipped or unnamed'),'Excluding metadata still requires the visible named icon');
  icon.getAttribute=k=>k==='role'?'img':'Grass Energy';texts=[];icon.querySelector=()=>null;assert(collectionRowGeometry(row).bad.some(x=>x.reason==='Accessible icon is hidden, clipped or unnamed'),'An emblem with removed metadata is audited independently of the text walker');icon.querySelector=()=>({textContent:'Grass Energy'});icon.style.opacity='0';assert(collectionRowGeometry(row).bad.some(x=>x.reason==='Accessible icon is hidden, clipped or unnamed'),'Transparent accessible icons are not accepted');
  icon.style.opacity='1';icon.querySelector=()=>null;icon.getAttribute=k=>k==='aria-hidden'?'true':null;icon.matches=()=>true;target.matches=selector=>selector==='.lvl';target.textContent='8';target.getAttribute=()=> 'Level 8';assert.deepEqual(collectionRowGeometry(row).bad,[],'The exact decorative YGO star is visible and named by its real Level parent');target.getAttribute=()=>null;assert(collectionRowGeometry(row).bad.length,'An unnamed star parent fails');target.getAttribute=()=> 'Rank 7';assert(collectionRowGeometry(row).bad.length,'Parent name must match its visible level/rank');target.getAttribute=()=> 'Level 8';target.matches=()=>false;assert(collectionRowGeometry(row).bad.length,'Unrelated aria-hidden emblems are not broadly exempt');
  // Model the two protocol operations without running Playwright: an attached
  // handle is resolved, a real-render-shaped replacement occurs across an await,
  // and the single synchronous selector probe must measure only the current row.
  texts=[];target.querySelectorAll=()=>[];target.textContent='FDN #101';target.style.visibility='visible';
  const expected={id:'lot-mtg-2',game:'mtg',mode:'compact',batch:false,width:560},state={state:{settings:{game:'mtg',displayModes:{mtg:{collection:'compact'}}},collection:[{id:expected.id}]},ui:{view:'collection',batch:{game:'mtg',active:false}}};
  let rows=[row],roots,mode='compact';const list={matches:s=>s==='.display-list'},root={isConnected:true,classList:{contains:s=>s==='view-'+mode},contains:n=>n===list,querySelectorAll:()=>rows};roots=[root];
  art.dataset={entry:expected.id};row.isConnected=true;row.parentElement=list;row.closest=()=>root;
  const rowQuery=s=>({'.lot-info':info,'.lot-side':side,'.lot-art':art,'.batch-mark':null,':scope > .lot-art':art,':scope > .lot-info > .lot-name':art,':scope > .batch-mark':null,'.lot-sub':target,'.condition-value-note':null,'.price':{textContent:'—'},'.stepper b':{textContent:'1'}})[s];row.querySelector=rowQuery;
  row.querySelectorAll=s=>['.lot-sub svg.emb','.lot-side button'].includes(s)?[]:[target];
  Object.assign(document,{body:{dataset:{game:'mtg',view:'collection'}},querySelectorAll:()=>roots});globalThis.window={__uiTestState:state};globalThis.location={hash:'#collection'};globalThis.innerWidth=560;
  const pinned=row;await Promise.resolve();const replacement={...row};rows=[replacement];pinned.isConnected=false;const oldBounds=pinned.getBoundingClientRect,oldStyle=pinned.style;
  pinned.getBoundingClientRect=()=>rect(0,0,0,0);pinned.style={gridTemplateColumns:''};window.__conditionPriorRow=pinned;
  const stale=collectionRowGeometry(pinned);assert.equal(stale.row.width,0);assert(Number.isNaN(stale.contentWidth),'The old-handle negative reproduces zero geometry and absent computed sizing');
  let current=collectionRowGeometry({...expected,previous:true});assert.equal(current.row.width,100);assert.deepEqual(current.bad,[]);assert.deepEqual(current.identity.previous,{connected:false,replaced:true});assert(current.identity.connected&&current.identity.current&&current.identity.rootConnected);assert.equal(current.identity.data.id,expected.id);assert.equal(current.identity.data.metadata,'FDN #101');
  for(const invalid of [{id:'lot-ygo-2'},{id:'lot-mtg-2"]'},{game:'ygo'},{mode:'symbols'},{batch:true},{width:390}])assert.throws(()=>collectionRowGeometry({...expected,...invalid}),/Collection row identity/);
  roots=[];assert.throws(()=>collectionRowGeometry(expected),/unique connected content root/);roots=[root,root];assert.throws(()=>collectionRowGeometry(expected),/unique connected content root/);roots=[root];root.isConnected=false;assert.throws(()=>collectionRowGeometry(expected),/unique connected content root/);root.isConnected=true;
  rows=[];assert.throws(()=>collectionRowGeometry(expected),/unique current lot/);rows=[replacement,replacement];assert.throws(()=>collectionRowGeometry(expected),/unique current lot/);rows=[replacement];replacement.isConnected=false;assert.throws(()=>collectionRowGeometry(expected),/connected direct current list row/);replacement.isConnected=true;
  replacement.closest=()=>null;assert.throws(()=>collectionRowGeometry(expected),/connected direct current list row/);replacement.closest=()=>root;list.matches=()=>false;assert.throws(()=>collectionRowGeometry(expected),/connected direct current list row/);list.matches=s=>s==='.display-list';root.contains=()=>false;assert.throws(()=>collectionRowGeometry(expected),/connected direct current list row/);root.contains=n=>n===list;
  for(const [object,key,bad]of [[document.body.dataset,'game','ygo'],[document.body.dataset,'view','search'],[state.state.settings,'game','ygo'],[state.ui,'view','search'],[location,'hash','#search'],[state.ui.batch,'game','ygo'],[state.ui.batch,'active',true]]){const value=object[key];object[key]=bad;assert.throws(()=>collectionRowGeometry(expected),/Collection row identity/);object[key]=value;}
  mode='symbols';assert.throws(()=>collectionRowGeometry(expected),/current display mode/);mode='compact';state.state.settings.displayModes.mtg.collection='symbols';assert.throws(()=>collectionRowGeometry(expected),/current display mode/);state.state.settings.displayModes.mtg.collection='compact';
  art.dataset.entry='lot-mtg-1';assert.throws(()=>collectionRowGeometry(expected),/matching artwork and name entry/);art.dataset.entry=expected.id;state.state.collection.push({id:expected.id});assert.throws(()=>collectionRowGeometry(expected),/unique current owned entry/);state.state.collection.pop();
  pinned.isConnected=true;assert.throws(()=>collectionRowGeometry({...expected,previous:true}),/real prior row replaced/);pinned.isConnected=false;
  replacement.getBoundingClientRect=()=>rect(0,0,0,0);current=collectionRowGeometry(expected);assert.equal(current.row.width,0,'A genuinely zero current row remains zero; the probe never retries for a passing node');replacement.getBoundingClientRect=oldBounds;
  target.style.visibility='hidden';assert(collectionRowGeometry(expected).bad.some(x=>x.reason==='hidden or clipped metadata'),'Current hidden content still fails after atomic lookup');target.style.visibility='visible';
  text.parentElement=target;text.textContent='Printing';text.rects=[];texts=[text];assert(collectionRowGeometry(expected).bad.some(x=>x.word==='Printing'),'Missing real glyphs still fail on the current node');text.rects=[rect(95,0,20,10)];assert(collectionRowGeometry(expected).bad.some(x=>x.word==='Printing'),'Current clipped text is not treated as a stale-handle exemption');
  // Native instant scrolling and measurement share the exact current node.
  texts=[];let scrolls=0,top=1200;globalThis.innerHeight=1000;list.style={visibility:'visible',opacity:'1'};replacement.getBoundingClientRect=()=>rect(16,top,100,30);
  replacement.scrollIntoView=options=>{assert.deepEqual(options,{behavior:'instant',block:'center',inline:'nearest'});scrolls++;top=400;};
  current=collectionRowGeometry({...expected,scroll:true});assert.equal(scrolls,1);assert.equal(current.identity.scroll.before.top,1200);assert.equal(current.row.top,400);assert(current.identity.scroll.visible&&current.identity.scroll.same);assert.equal(current.identity.data.metadata,'FDN #101');
  replacement.scrollIntoView=()=>{scrolls++;};top=1200;assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/visibly inside the viewport/);assert.equal(scrolls,2,'A failed visibility check is never retried');top=400;
  replacement.style={...oldStyle,visibility:'hidden'};assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/visibly inside the viewport/);replacement.style={...oldStyle,opacity:'0'};assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/visibly inside the viewport/);replacement.style=oldStyle;
  replacement.getBoundingClientRect=()=>rect(16,400,0,0);assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/visibly inside the viewport/);replacement.getBoundingClientRect=()=>rect(16,400,100,30);
  list.style.opacity='0';assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/visible ancestors/);list.style.opacity='1';
  replacement.scrollIntoView=()=>{rows=[{...replacement}];};assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/same current row/);rows=[replacement];replacement.scrollIntoView=()=>{location.hash='#search';};assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/current Collection game and route/);location.hash='#collection';
  replacement.scrollIntoView=()=>{art.dataset.entry='lot-mtg-1';};assert.throws(()=>collectionRowGeometry({...expected,scroll:true}),/matching artwork and name entry/);art.dataset.entry=expected.id;
  pinned.style=oldStyle;pinned.getBoundingClientRect=oldBounds;
 }finally{Object.assign(globalThis,saved);}
}
console.log('PASS: atomic unique connected current-row measurement after stale-reference replacement; wrong root/context/lot rejected, zero/hidden/missing/clipped geometry still fails; SVG metadata exemption stays narrow.');
// Exercise the actual shared page callback, including every consumer's scope
// shape. There is no browser, timer sleep, or retry of a geometry assertion.
{
 const saved=Object.fromEntries(['document','window','location','innerWidth','innerHeight','getComputedStyle','performance','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
 let nodes=[],sheet=null,clock=0,measurements=0,controlRight=300,rootWidth=320,timers=new Map(),timerId=0;
 const node=()=>({isConnected:true,id:'content',style:{visibility:'visible',opacity:'1'},clientWidth:288,scrollWidth:288,width:288,height:100,animations:[],getBoundingClientRect(){measurements++;return {left:16,right:16+this.width,top:100,bottom:100+this.height,width:this.width,height:this.height};},getAnimations(options){assert.deepEqual(options,{subtree:true});return this.animations;},querySelectorAll:()=>[]});
 const finite=()=>{let resolve,reject;const a={playState:'running',effect:{getComputedTiming:()=>({endTime:580})},finished:new Promise((yes,no)=>{resolve=yes;reject=no;})};return {a,finish(){a.playState='finished';resolve();},cancel(){a.playState='idle';reject(Error('Cancelled by real replacement'));}};};
 const infinite={playState:'running',effect:{getComputedTiming:()=>({endTime:Infinity})},finished:new Promise(()=>{})},state={state:{settings:{game:'mtg'}},ui:{view:'collection',sheetCtx:null}};
 const page={evaluate:(fn,arg)=>fn(arg)};
 try{
  Object.assign(globalThis,{window:{__uiTestState:state},location:{hash:'#collection'},innerWidth:320,innerHeight:1000,performance:{now:()=>clock},getComputedStyle:n=>n.style,setTimeout:(fn,ms)=>{assert(ms>0&&ms<=15000);timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),document:{body:{dataset:{game:'mtg',view:'collection'}},documentElement:{get scrollWidth(){return rootWidth;}},querySelector:selector=>selector==='#sheet'?sheet:null,querySelectorAll:()=>nodes}});
  for(const scope of ['#content','#sheetBody','.home-value','.scan-confirm','.glass-select-menu[open]','.rules-ask-dialog[open]','#content .display-list > .lot'])for(const settle of [false,true]){
   nodes=[node()];const result=await noOverflow(page,scope,'stable actual scope '+scope,settle);assert(result.connected&&result.current);assert.deepEqual(result.settlement,{passes:0,replacements:0});
  }
  const first=finite(),second=finite(),old=node(),fresh=node();old.animations=[first.a,infinite];fresh.animations=[second.a,infinite];nodes=[old];measurements=0;
  const pending=noOverflow(page,'#content .display-list > .lot','replacement while settling',true);assert.equal(measurements,0);old.isConnected=false;nodes=[fresh];first.cancel();
  for(let i=0;i<8;i++)await Promise.resolve();assert.equal(measurements,0,'The replacement must settle before any geometry is read');assert.equal(timers.size,1);second.finish();const settled=await pending;assert.equal(settled.settlement.replacements,1);assert.equal(settled.settlement.passes,2);assert.equal(timers.size,0);
  // Default false still measures immediately rather than silently adding waits.
  nodes=[node()];nodes[0].animations=[finite().a];const immediate=await noOverflow(page,'#sheetBody','default no settlement');assert.equal(immediate.settlement.passes,0);assert.equal(timers.size,0);
  for(const change of [()=>{nodes=[];},()=>{nodes=[node(),node()];},()=>{nodes[0].isConnected=false;}]){nodes=[node()];change();await assert.rejects(noOverflow(page,'#content','invalid current root',true),/unique and connected/);}
  for(const change of [n=>{n.width=0;},n=>{n.height=0;},n=>{n.clientWidth=0;},n=>{n.style.visibility='hidden';},n=>{n.style.opacity='0';}]){nodes=[node()];change(nodes[0]);await assert.rejects(noOverflow(page,'#sheetBody','hidden current root',true),/hidden or zero-sized/);}
  const changed=async mutate=>{const motion=finite();nodes=[node()];nodes[0].animations=[motion.a];const p=noOverflow(page,'#sheetBody','changed context',true);mutate();motion.finish();await assert.rejects(p,/context changed/);assert.equal(timers.size,0);};
  for(const [obj,key,value]of [[document.body.dataset,'game','ygo'],[document.body.dataset,'view','search'],[state.state.settings,'game','ptcg'],[state.ui,'view','search'],[location,'hash','#search'],[state.ui,'sheetCtx',{type:'card',name:'Other'}]]){const old=obj[key];await changed(()=>{obj[key]=value;});obj[key]=old;}
  await changed(()=>{sheet={open:true};});sheet=null;sheet={open:true};await changed(()=>{sheet.open=false;});sheet=null;
  state.ui.sheetCtx={type:'card',name:'A',tab:'overview'};await changed(()=>{state.ui.sheetCtx.name='B';});state.ui.sheetCtx=null;
  state.ui.sheetCtx={type:'card',name:'A',print:{id:'printing-a'}};await changed(()=>{state.ui.sheetCtx.print.id='printing-b';});state.ui.sheetCtx=null;
  for(const replacement of [[],[node(),node()]]){const motion=finite();nodes=[node()];nodes[0].animations=[motion.a];const missing=noOverflow(page,'#content','missing/duplicate replacement',true);nodes=replacement;motion.finish();await assert.rejects(missing,/unique and connected/);assert.equal(timers.size,0);}
  nodes=[node()];const stuck=finite();nodes[0].animations=[stuck.a];const timeout=noOverflow(page,'#content','nonsettling finite motion',true);const timer=[...timers.values()][0];assert.equal(timer.ms,15000);timer.fn();await assert.rejects(timeout,/exceeded 15000ms/);assert.equal(timers.size,0);
  nodes=[node()];const repeated=finite();nodes[0].animations=[repeated.a];const budget=noOverflow(page,'#content','continuous replacement motion',true);clock=15000;nodes=[node()];repeated.finish();await assert.rejects(budget,/exceeded 15000ms/);clock=0;assert.equal(timers.size,0);
  const earlier=finite(),later=finite();nodes=[node()];nodes[0].animations=[earlier.a];const rolling=noOverflow(page,'#content','remaining shared budget',true);clock=10000;nodes=[node()];nodes[0].animations=[later.a];earlier.finish();for(let i=0;i<8;i++)await Promise.resolve();const remaining=[...timers.values()][0];assert.equal(remaining.ms,5000,'Replacement motion shares the original15s budget, never restarts it');remaining.fn();await assert.rejects(rolling,/exceeded 15000ms/);clock=0;assert.equal(timers.size,0);
  nodes=[node()];rootWidth=324;await assert.rejects(noOverflow(page,'#content','real document overflow',true),/no horizontal overflow/);rootWidth=320;nodes[0].scrollWidth=292;await assert.rejects(noOverflow(page,'#sheetBody','real local overflow'),/no horizontal overflow/);nodes[0].scrollWidth=288;
  const control={tagName:'BUTTON',className:'btn',textContent:'Visible action',dataset:{},getClientRects:()=>[{}],closest:()=>null,getBoundingClientRect:()=>({left:16,right:controlRight,width:controlRight-16})};nodes[0].querySelectorAll=()=>[control];controlRight=324;await assert.rejects(noOverflow(page,'.glass-select-menu[open]','visible control outside viewport'),/all visible controls/);assert.equal(timers.size,0);
 }finally{Object.assign(globalThis,saved);}
}
console.log('PASS: every shared overflow scope resolves current nodes, settles finite replacements/cancellation within15000ms, rejects changed context/hidden/zero/missing/duplicate/persistent overflow, and never retries geometry.');
const audit={game:'ptcg',width:320,controls:[{change:'tCollSort',field:'',value:'name'}]},railControl={root:'content',view:'collection',game:'ptcg',viewport:320,tag:'SELECT',change:'tCollSort',field:'',value:'name',left:238,right:418,width:180,rail:{known:true,direct:true,overflow:'auto',left:16,right:304,client:288,scroll:402,position:0}};
assert(auditedCollectionControl(railControl,audit),'Only the measured and independently accessed Collection rail admits its partially visible Sort');
for(const change of [{root:'sheetBody'},{view:'search'},{game:'mtg'},{viewport:390},{tag:'BUTTON'},{change:'unknown'},{field:'unknown'},{value:'set-order'},{width:400},{left:-40},{right:500}])assert(!auditedCollectionControl({...railControl,...change},audit),JSON.stringify(change));
for(const change of [{known:false},{direct:false},{overflow:'hidden'},{left:-2},{right:322},{client:0},{scroll:200}])assert(!auditedCollectionControl({...railControl,rail:{...railControl.rail,...change}},audit),JSON.stringify(change));
for(const missing of [null,{...audit,controls:[]},{...audit,game:'ygo'},{...audit,width:390}])assert(!auditedCollectionControl(railControl,missing),'Missing/stale proof never exempts offscreen controls');
console.log('PASS: default-deny Collection rail classification, exact game/width/selection proof, bounded local scrolling and no generic scroller or native-control exemption.');
// Exercise the exact serialized browser resolver using the actual store.meta
// schema, both ordinary name-based Collection and explicitly chosen printing.
{
 const oldWindow=globalThis.window,oldDocument=globalThis.document,oldCatalog=responsiveStore.S.catalog,card=CARDS.mtg[0],ctx={type:'card',name:card.name,entryId:'lot-mtg-0'},node={},body={dataset:{detailIdentity:'mtg:'+card.id},detailMountGeneration:1,querySelector:()=>node};let keys=0;
 try{
  responsiveStore.S.catalog={[cardKey(card.name)]:card};globalThis.document={querySelector:()=>body};globalThis.window={__uiTestState:{ui:{sheetCtx:ctx}},__responsiveStore:responsiveStore,__responsivePricing:{quoteForContext},__responsiveHistory:{historyKey:q=>{keys++;return historyKey(q);}}};
  let resolved=detailHistoryContext('mtg');assert.equal(resolved.id,card.id);assert.equal(resolved.entry,ctx.entryId);assert.equal(window.__openingDetail.ctx,ctx);assert.equal(window.__openingDetail.card,node);assert.equal(keys,1);
  ctx.print=CARDS.mtg[1];resolved=detailHistoryContext('mtg');assert.equal(resolved.id,ctx.print.id,'An explicit printing takes precedence over the name catalogue');assert.equal(keys,2);
  delete ctx.print;responsiveStore.S.catalog={};assert.throws(()=>detailHistoryContext('mtg'),/Real detail card missing/);assert.equal(keys,2,'Missing real data is rejected before historyKey, never replaced by a fixture quote');
  responsiveStore.S.catalog={[cardKey(card.name)]:card};window.__responsivePricing={quoteForContext:()=>null};assert.throws(()=>detailHistoryContext('mtg'),/Real detail quote/);assert.equal(keys,2);
 }finally{responsiveStore.S.catalog=oldCatalog;globalThis.window=oldWindow;globalThis.document=oldDocument;}
}
console.log('PASS: actual Magic catalogue fallback and explicit printing precedence resolve exact context/quote identity, rejecting missing card or quote before history lookup.');
// Actual history module with intercepted responses only. A ready entry is written
// before its synchronous mount-refresh callback, and awaiting completion observes
// that callback finished. The browser probe reads this state, never starts a load.
const historyContext={type:'tcard',game:'ptcg',id:CARDS.ptcg[0].id,priceFinish:'normal',entryId:'lot-ptcg-0'},quote=quoteForContext('ptcg',CARDS.ptcg[0],historyContext),historyId=historyKey(quote),savedFetch=globalThis.fetch,savedWindow=globalThis.window,savedDocument=globalThis.document;
const historyBody={dataset:{detailIdentity:'ptcg:'+quote.cardId}},historySheet={open:true};
let releaseHistory,historyCalls=0,refreshed=false,mountGeneration=1;
try{
 globalThis.window={__openingDetail:{ctx:historyContext,body:historyBody,identity:historyBody.dataset.detailIdentity,key:historyId,quote},__uiTestState:{ui:{sheetCtx:historyContext}},__responsiveHistory:{sharedHistory}};
 globalThis.document={querySelector:selector=>selector==='#sheet'?historySheet:historyBody};
 globalThis.fetch=async url=>{historyCalls++;if(String(url).startsWith('api/prices/archive?'))await new Promise(resolve=>{releaseHistory=resolve;});return {ok:true,json:async()=>({game:quote.game,cardId:quote.cardId,finish:quote.finish,status:'empty',series:[]})};};
 setHistoryRefresh((key,q)=>{assert.equal(key,historyId);assert.equal(q,quote);assert(Number.isFinite(sharedHistory.get(key)?.checked));refreshed=true;mountGeneration++;});
 const pending=loadSharedHistory(quote);for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(historyCalls,3);assert.equal(refreshed,false);assert.equal(sharedHistory.has(historyId),false);assert.equal(mountGeneration,1);assert(!detailHistoryReady());
 releaseHistory();const entry=await pending;assert.equal(entry,sharedHistory.get(historyId));assert.equal(entry.status,'empty');assert(refreshed);assert.equal(mountGeneration,2);assert(detailHistoryReady());
 const stale={...entry,checked:Date.now()-31000};sharedHistory.set(historyId,stale);refreshed=false;releaseHistory=null;
 const refreshing=loadSharedHistory(quote);for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(historyCalls,6);assert.equal(sharedHistory.get(historyId),stale,'Real refresh retains its old entry until all sources complete');assert(!detailHistoryReady(),'An expired but checked terminal entry cannot declare the pending replacement settled');assert(!refreshed);assert.equal(mountGeneration,2);
 releaseHistory();const updated=await refreshing;assert.notEqual(updated,stale);assert(refreshed);assert.equal(mountGeneration,3);assert(detailHistoryReady());
 const recentPoints=Array.from({length:3},(_,i)=>({date:new Date(Date.now()-(2-i)*864e5).toISOString().slice(0,10),value:i+1}));
 sharedHistory.set(historyId,{...updated,checked:Date.now()-60000,series:[{points:recentPoints}]});assert(detailHistoryReady(),'A complete recent series legitimately has the real one-hour cache lifetime');
 sharedHistory.set(historyId,{...updated,checked:Date.now()-60000,series:[{points:recentPoints.slice(1)}]});assert(!detailHistoryReady(),'Two-point fixture history still expires after 30 seconds');
 sharedHistory.set(historyId,updated);window.__uiTestState.ui.sheetCtx={...historyContext};assert(!detailHistoryReady(),'Even fresh matching history cannot settle a different live context');window.__uiTestState.ui.sheetCtx=historyContext;
 historyBody.dataset.detailIdentity='different';assert(!detailHistoryReady(),'A different mounted identity cannot inherit readiness');
}finally{releaseHistory?.();globalThis.fetch=savedFetch;globalThis.window=savedWindow;globalThis.document=savedDocument;setHistoryRefresh(()=>{});sharedHistory.delete(historyId);}
console.log('PASS: exact real history completion follows its synchronous refresh callback; delayed initial and stale-cache refreshes remain pending, with real TTL and context/mount identity checks and no extra requests.');
class Node {
 constructor(classes='') { this.classes=new Set(classes.split(' '));this.values={};this.dataset={};this.handlers={};this.bounds={width:140,height:200,left:10,right:150,top:10,bottom:210};this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v)};this.style={setProperty:(k,v)=>this.values[k]=v}; }
 addEventListener(k,f) {(this.handlers[k]||=[]).push(f);}
 emit(k,extra={}) {for(const f of this.handlers[k]||[])f({target:this,pointerType:'touch',clientX:135,clientY:30,...extra});}
 getBoundingClientRect(){return this.bounds;}
 closest(s){return s.includes('.cd-img')&&this.classes.has('cd-img')?this:null;}
 contains(n){return n===this;}
 querySelectorAll(){return this.cards||[];}
}
let reduce=false,frames=[],intersection,mutation,observed=[];
const root=new Node(),win=new Node(),background=new Node('cd-img'),card=new Node('cd-img'),dialog=new Node();
root.dialogs=[];root.cards=[background,card];dialog.cards=[card];root.querySelectorAll=s=>s==='dialog[open]'?root.dialogs:s.includes('data-shone')?root.cards.filter(c=>!c.dataset.shone):root.cards;root.querySelector=()=>({querySelectorAll:()=>[background]});
globalThis.document=root;root.body=root;globalThis.window=win;globalThis.innerWidth=390;globalThis.innerHeight=844;
Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:1},configurable:true});
globalThis.matchMedia=q=>({matches:q.includes('reduced-motion')?reduce:q.includes('coarse')});
win.DeviceOrientationEvent=globalThis.DeviceOrientationEvent=class {};
globalThis.requestAnimationFrame=f=>{frames.push(f);return frames.length;};globalThis.addEventListener=win.addEventListener.bind(win);
globalThis.IntersectionObserver=class {constructor(f){intersection=f;}observe(c){observed.push(c);}unobserve(){}};
globalThis.MutationObserver=class {constructor(f){mutation=f;}observe(){}};
const flush=()=>{const q=frames;frames=[];q.forEach(f=>f());};
attachTilt(root);assert.equal(win.handlers.deviceorientation.length,1);
win.emit('deviceorientation',{beta:30,gamma:0});flush();assert(background.classes.has('gyro'));
root.dialogs=[dialog];mutation();flush();assert(card.classes.has('gyro'),'opening the first dialog consumes the last available sample without a zoom round trip');
assert.equal(motionCard(root),card);win.emit('deviceorientation',{beta:42,gamma:12});flush();assert.notEqual(card.values['--tx'],'0deg');
card.classList.remove('gyro','tilting');card.classList.add('shine-once');
root.emit('pointerdown',{target:card});assert(!card.classes.has('shine-once'),'first touch removes animation fill before it can mask tilt');assert.notEqual(card.values['--tx'],'0deg');
intersection([{isIntersecting:true,target:card}]);assert(!card.classes.has('shine-once'),'late intersection cannot put the entrance animation over an active touch');flush();
root.emit('pointerup',{target:card});root.emit('pointerdown',{target:card});await new Promise(r=>setTimeout(r,280));assert(card.classes.has('tilting'),'release from an earlier press cannot end a newer press');
root.emit('pointercancel',{target:card});assert(!card.classes.has('tilting'),'scroll cancellation releases touch immediately');
win.emit('deviceorientation',{beta:48,gamma:15});flush();assert(card.classes.has('gyro'));
const replacement=new Node('cd-img');dialog.cards=[replacement];root.cards=[background,replacement];mutation();flush();assert.equal(replacement.values['--tx'],'0deg','replacement printing gets its own resting angle');win.emit('deviceorientation',{beta:55,gamma:25});flush();assert.notEqual(replacement.values['--tx'],'0deg');
const mouseCard=replacement,priorMouse=[replacement.values['--tx'],replacement.values['--ty']];root.emit('pointerover',{target:mouseCard,pointerType:'mouse'});root.emit('pointermove',{target:mouseCard,pointerType:'mouse',clientX:35,clientY:35});const mouseOwned=mouseCard.values['--tx'];assert(mouseOwned!==priorMouse[0]||mouseCard.values['--ty']!==priorMouse[1],'Actual mouse move changes the preceding sensor transform');win.emit('deviceorientation',{beta:60,gamma:30});flush();assert.equal(mouseCard.values['--tx'],mouseOwned,'Sensor leaves a genuine mouse-owned replacement transform untouched');root.emit('pointerout',{target:mouseCard,pointerType:'mouse',relatedTarget:background});win.emit('deviceorientation',{beta:62,gamma:32});flush();assert.equal(dialog.cards[0],mouseCard);assert.notEqual(mouseCard.values['--tx'],mouseOwned,'Mouse exit resumes the same replacement, not a reopen or retry');
const overlay=new Node();overlay.cards=[];root.dialogs.push(overlay);assert.equal(motionCard(root),null,'a non-card foreground modal never animates a background card');const held=replacement.values['--tx'];win.emit('deviceorientation',{beta:70,gamma:35});flush();assert.equal(replacement.values['--tx'],held);
root.dialogs.pop();mutation();flush();assert.notEqual(replacement.values['--tx'],held,'closing overlay resumes existing card without re-opening it');
win.emit('orientationchange');flush();assert.equal(replacement.values['--tx'],'0deg','rotation recalibrates rather than throwing the card to an extreme');
replacement.bounds={...replacement.bounds,top:1100,bottom:1300};assert.equal(motionCard(root),null);replacement.bounds={...replacement.bounds,top:100,bottom:300};root.emit('scroll');flush();assert(replacement.classes.has('gyro'),'scrolling into view schedules motion with no extra touch');
let permissionCalls=0;DeviceOrientationEvent.requestPermission=()=>{permissionCalls++;return Promise.resolve('granted');};const permittedRoot=new Node();permittedRoot.querySelector=()=>null;attachTilt(permittedRoot);assert.equal(win.handlers.deviceorientation.length,2,'Platforms with an existing permission also listen immediately');assert.equal(permissionCalls,0,'Registering for existing motion never prompts for new permission');delete DeviceOrientationEvent.requestPermission;
reduce=true;const reducedRoot=new Node();attachTilt(reducedRoot);assert.deepEqual(reducedRoot.handlers,{});reduce=false;
console.log('PASS: first-open sensor activation, active-touch/late-observer race, release-timer race, cancellation, foreground ownership, replacement calibration, scrolling, rotation and reduced motion.');
const pack=JSON.parse(gunzipSync(readFileSync('rulebooks/ygo-rules-v1.json.gz'))),entry=pack.entries.find(e=>e.id==='0-p20'),before=structuredClone(entry),display=visibleRulePassage('ygo',entry);
assert.equal(display.fullText,entry.text);assert.deepEqual(entry,before);assert(display.text.startsWith('Turn Structure\n\nA Duel'));assert(!display.text.startsWith('How\nTo\nPlay'));assert(display.text.includes('IMPORTANT: The player who goes first cannot draw during the Draw Phase of their first turn.'));
for(const label of ['Draw Phase','Standby Phase','Main Action in this Phase','Possible Other Actions'])assert.equal(display.text.split(label).length,entry.text.split(label).length,'Legitimate repeated '+label+' remains intact');
const tokens=s=>s.replace(/\s+/g,' ').trim();assert.equal(tokens(display.text),tokens(entry.text.replace('How\nTo\nPlay\nHow\nTo\nPlay\nTurn Structure\nTurn Structure\n','Turn Structure\n').replace(/\n35\n34$/,'')),'Only verified page furniture and whitespace change; no rule words disappear');
for(const changed of [{...entry,id:'0-p21'},{...entry,doc:1},{...entry,text:'Rule 1\nRule 1\n'+entry.text},{...entry,text:entry.text+'\n1. Repeated rule 1.'}])assert.equal(ygoTurnStructureDisplay(changed),null,'Unknown structure must remain exact');
for(const game of ['mtg','ptcg'])assert.equal(visibleRulePassage(game,{id:'new',text:'Rule 1\nRule 1\nDraw Phase\nDraw Phase'}).text,'Rule 1\nRule 1\nDraw Phase\nDraw Phase');
console.log('PASS: exact-page display cleanup preserves every rule token and legitimate repeated phase label, complete raw text, canonical entry and all other sources.');
const css=readFileSync('style.css','utf8'),app=readFileSync('app.js','utf8');assert.match(css,/@container \(max-width:520px\)/);assert.match(css,/\.ca-main \{ grid-template-columns:1fr;/);assert.match(app,/window.addEventListener\?\.\("resize"/);assert.doesNotMatch(app,/resize[^\n]*(refreshSheet|location\.reload)/);
const batchLayout=css.slice(css.indexOf('/* Narrow Collection batch rows'),css.indexOf('.view-compact .card-grid .grid-meta',css.indexOf('/* Narrow Collection batch rows')));
assert.match(batchLayout,/@media\(max-width:480px\)/);assert.equal((batchLayout.match(/body\[data-view="collection"\]/g)||[]).length,3);assert.equal((batchLayout.match(/\.display-list > \.lot:has\(> \.batch-mark\)/g)||[]).length,3);
for(const declaration of ['grid-template-columns:30px 58px minmax(0,1fr)','grid-template-columns:auto minmax(0,1fr)','grid-column:1/-1;grid-row:2','display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center'])assert(batchLayout.includes(declaration),declaration);
assert.doesNotMatch(batchLayout,/view-gallery|font-size|overflow|word-break|white-space|display:none|grid-column:3\/5/);assert(!css.includes('grid-column:3/5'),'The legacy implicit symbols track cannot return');
assert(css.indexOf('/* Narrow Collection batch rows')<css.indexOf('/* A condition explanation'),'Later, more-specific condition footer retains its independent layout');
console.log('PASS: narrow direct Collection batch rows only, explicit art/batch tracks and aligned full-row actions; ordinary/gallery/wide styles unchanged.');
const conditionLayout=css.slice(css.indexOf('/* A condition explanation'),css.indexOf('/* A tablet/desktop list',css.indexOf('/* A condition explanation')));
assert.match(conditionLayout,/@media \(max-width:480px\)/);assert.equal((conditionLayout.match(/body\[data-view="collection"\]/g)||[]).length,7);assert.equal((conditionLayout.match(/:has\(> \.lot-side > \.condition-value-note\)/g)||[]).length,7);
for(const declaration of ['grid-template-columns:58px minmax(0,1fr)','grid-template-columns:30px 58px minmax(0,1fr)','grid-template-columns:minmax(0,1fr)','grid-template-columns:auto minmax(0,1fr)','grid-column:1/-1;grid-row:2','max-width:none'])assert(conditionLayout.includes(declaration),declaration);
assert.doesNotMatch(conditionLayout,/view-gallery|font-size|overflow|word-break|white-space|display:none/,'Only real space changes; gallery, fonts, wrapping and visible content remain intact');
assert.equal((conditionLayout.match(/:has\(> \.batch-mark\)/g)||[]).length,2,'Compact and symbols explicitly preserve the independent batch column');
console.log('PASS: narrow Collection condition-only grid reflow, explicit art/batch columns, full-width note and no ordinary/gallery/wide/font/clipping changes.');
const rowContainer=css.slice(css.indexOf('/* A tablet/desktop list'),css.indexOf('@media(prefers-reduced-motion:reduce){.brand-idle',css.indexOf('/* A tablet/desktop list')));
assert.equal((rowContainer.match(/body\[data-view="collection"\]/g)||[]).length,7);assert.equal((rowContainer.match(/\.display-list > \.lot:has\(> \.batch-mark\)/g)||[]).length,7);
assert.match(rowContainer,/container:collection-batch \/ inline-size/);assert.match(rowContainer,/@container collection-batch \(max-width:480px\)/);
const rowRules=rowContainer.slice(rowContainer.indexOf('@container'));
for(const selector of rowRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)){if(selector[1].includes('@container'))continue;assert.match(selector[1],/> \.lot-(info|side)/,'Size queries style only children, never their own container');}
for(const declaration of ['grid-column:3/-1','grid-column:2/-1','grid-column:1/-1;grid-row:2','justify-content:flex-end;align-items:center','grid-template-columns:minmax(0,1fr) auto','max-width:none'])assert(rowContainer.includes(declaration),declaration);
assert.doesNotMatch(rowContainer,/view-gallery|font-size|overflow|word-break|white-space|display:none|grid-template-columns:30px|grid-template-columns:auto minmax/,'Parent tracks, nonbatch/gallery and text remain intact; only constrained children reflow');
assert(359-14<=480&&528-14>480&&515-14>480,'Real tablet cells reflow while roomy one- and two-column rows do not');
console.log('PASS: named Collection batch row-only container, descendant reflow, intact parent tracks and condition footer, independent narrow/roomy cell geometry.');
const reflow=css.slice(css.indexOf('/* Reflow the existing components'));
for(const selector of ['.card-actions .ca-more { display:flex','.card-actions .ca-more .btn { flex:1','.card-actions .ca-main .btn { padding:9px','.cs-card-side .own-line { margin:0','.cs-card-side .stat-grid > :only-child'])assert(reflow.indexOf(selector)>reflow.indexOf('@container (max-width:520px)'),selector+' is narrow-only; approved wide layout retains its existing grid, padding and margins');
const extreme=css.match(/@container \(max-width:(260)px\) \{([\s\S]*?)\n\}/);assert(extreme,'Extreme zoom reflow has its own narrow container breakpoint');
assert.match(extreme[2],/\.cs-card \{ grid-template-columns:minmax\(0,1fr\); \}/);
assert.match(extreme[2],/\.cs-card \.cd-art-stack \{ width:min\(100%,220px\); justify-self:center; grid-template-columns:minmax\(0,1fr\); \}/);
assert.match(extreme[2],/\.cs-card-side \.stat-grid > div \{ grid-template-columns:minmax\(0,1fr\); \}/);
assert.doesNotMatch(extreme[2],/overflow|font-size|word-break|overflow-wrap|display:none/,'No clipping, smaller text or forced word splitting hides intrinsic overflow');
assert(222.4<=Number(extreme[1])&&286>Number(extreme[1]),'Hosted 320px/125% container activates reflow; ordinary 320px container keeps existing two-column design');
assert.equal((css.match(/width:min\(100%,220px\)/g)||[]).length,1,'Finite centered art width is extreme-container only');
console.log('PASS: isolated extreme-width stacking/zero-minimum tracks, finite centered art, unchanged ordinary phone/wide layout and no clipping/font/word-wrap shortcut.');
assert.match(app,/\.detailMountGeneration = \(\$\("#sheetBody"\)\.detailMountGeneration \|\| 0\) \+ 1;\s*\$\("#sheetBody"\)\.innerHTML = html/,'Every actual open/mount creates a new viewport lifetime');
assert.match(app,/body\.detailMountGeneration = \(body\.detailMountGeneration \|\| 0\) \+ 1;\s*body\.innerHTML = ctx\.type/,'A refreshed mount cannot inherit clamp intent from replaced content');

let top=600,max=1000;const body={get scrollTop(){return top;},set scrollTop(v){top=Math.min(max,v);}};
const id='ygo:print-1:overview',portrait='390x1000',landscape='844x390';
rememberDetailViewport(body,id,portrait,1);
max=400;top=400;rememberDetailViewport(body,id,'1024x1000',1); // Native clamp before resize.
restoreDetailViewport(body,id,'1024x1000',1);assert.equal(top,400);
rememberDetailViewport(body,id,'1024x1000',1); // The assignment's scroll event must not erase 600.
max=300;restoreDetailViewport(body,id,landscape,1);rememberDetailViewport(body,id,landscape,1);
max=1000;restoreDetailViewport(body,id,portrait,1);assert.equal(top,600,'Returning from multiple clamped viewports restores the intended reading position');
top=250;rememberDetailViewport(body,id,portrait,1);restoreDetailViewport(body,id,landscape,1);assert.equal(top,250,'A real user scroll updates the remembered place');
top=10;rememberDetailViewport(body,'ygo:print-2:prices',landscape,1);restoreDetailViewport(body,'ygo:print-2:prices',portrait,1);assert.equal(top,10,'New selected printing/tab never inherits another card’s reading position');
// Exact review regression: current intent supersedes every old geometry, not
// only the geometry in which the user happened to scroll.
const current={scrollTop:100};rememberDetailViewport(current,id,portrait,1);restoreDetailViewport(current,id,landscape,1);
current.scrollTop=900;rememberDetailViewport(current,id,landscape,1);restoreDetailViewport(current,id,portrait,1);
assert.equal(current.scrollTop,900,'Portrait100 → landscape → user900 → portrait retains latest900, not obsolete100');
// A user scroll also cancels an outstanding larger, temporarily clamped intent.
top=900;max=1000;rememberDetailViewport(body,id,portrait,2);max=400;top=400;restoreDetailViewport(body,id,landscape,2);
top=150;rememberDetailViewport(body,id,landscape,2);max=1000;restoreDetailViewport(body,id,portrait,2);assert.equal(top,150,'A genuine scroll while clamped discards the earlier900 intent');
// The sheet body and exact card identity persist across close/reopen. Its new
// mount generation, unlike a resize, must discard all earlier carryover.
top=600;rememberDetailViewport(body,id,portrait,3);restoreDetailViewport(body,id,landscape,3);
top=0;rememberDetailViewport(body,id,landscape,4);restoreDetailViewport(body,id,portrait,4);assert.equal(top,0,'Close/reopen same card at0 cannot revive the old600 reading position');
top=600;rememberDetailViewport(body,id,portrait,7);max=0;top=0;restoreDetailViewport(body,id,landscape,7);rememberDetailViewport(body,id,landscape,7);
rememberDetailViewport(body,id,landscape,8);max=1000;restoreDetailViewport(body,id,portrait,8);assert.equal(top,0,'A fresh mount clears600 carryover even when the previous clamped top was already0');
top=600;rememberDetailViewport(body,id,portrait,5);top=0;restoreDetailViewport(body,id,landscape,6);assert.equal(top,0,'Even a resize before the new mount scroll callback starts at its current0');
console.log('PASS: clamp-only carryover, latest user intent across geometries, new-mount/close-reopen reset and exact card/printing/tab isolation without resize remount or focus changes.');
