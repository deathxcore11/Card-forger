import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setFamily,setReleaseDate,setReleaseStatus,setBrowserState,browseSets,setBrowserControls,setBrowserRows,setCatalogueStatus} from './set-browser.js';
import {setProgressMarkup,setRowContent} from './set-list-ui.js';
import {normalizeYgoSets} from './ygo.js';
import {normalizePtcg} from './ptcg.js';
import {detailSetProgress} from './card-detail-extras.js';
import {S,blank} from './store.js';
import {SOURCES,ui,tcgSets,tcgSet,tcgCardSheet,setContextCard,tcgSetProgress,rememberSetMembership,ownedBySet,registerTcg,cache} from './tcg.js';
import {setsPage,setPage,magicSetProgress} from './views.js';
const now='2026-10-19';
const screenshot=[['trk','Star Trek','expansion','main'],['fra','Reality Fracture','expansion','main'],['trc','Star Trek Commander','commander','companion'],['frc','Reality Fracture Commander','commander','companion'],['mbc','Mystery Booster Commander Edition','draft_innovation','companion']].map(([code,name,set_type,family])=>({code,name,set_type,family,released_at:'2026-11-13',card_count:100}));
for(const s of screenshot){assert.equal(setFamily('mtg',s),s.family);assert.equal(setReleaseStatus(s,now),'upcoming');}
assert.equal(browseSets(screenshot,'mtg',{},now).rows.length,0,'future screenshot releases are not silently presented as released');
assert.equal(browseSets(screenshot,'mtg',{family:'all'},now).rows.length,5);
assert.equal(browseSets(screenshot,'mtg',{family:'companion',release:'upcoming'},now).rows.length,3);
const cases={mtg:[[{code:'m21',name:'Core Set 2021',set_type:'core'},'main'],[{name:'Commander token',set_type:'token'},'other'],[{name:'Commander promos',set_type:'promo'},'promos'],[{name:'Unknown',set_type:'future-type'},'other'],[{name:'Digital set',set_type:'expansion',digital:true},'other']],ptcg:[[{id:'base1',name:'Base Set'},'main'],[{id:'sv03.5',name:'151'},'main'],[{id:'me05',name:'Pitch Black'},'main'],[{id:'swsh12.5gg',name:'Crown Zenith Galarian Gallery'},'companion'],[{id:'basep',name:'Wizards Black Star Promos'},'promos'],[{id:'tk-sm-r',name:'Trainer Kit'},'decks'],[{id:'unverified-new-id',name:'Unknown expansion'},'other']],ygo:[[{name:'Legend of Blue Eyes White Dragon'},'main'],[{name:"Duelist’s Advance"},'main'],[{name:'BEYOND THE BRAVE Core Booster Premiere!'},'promos'],[{name:'OTS Tournament Pack 30'},'promos'],[{name:'Starter Deck: Yugi'},'decks'],[{name:'2025 Mega-Pack Tin'},'special'],[{name:'Unverified booster-like name'},'other']]};
for(const [game,rows]of Object.entries(cases))for(const [set,family]of rows)assert.equal(setFamily(game,set),family,game+': '+set.name);
assert.equal(setReleaseDate({date:'2026-02-30'}),'');assert.equal(setReleaseDate({date:'2026-02'}),'');assert.equal(setReleaseStatus({date:''},now),'unknown');
const list=[...screenshot,{code:'a',name:'Alpha released',released_at:'2025-01-01',set_type:'expansion',card_count:2},{code:'p',name:'Alpha promo',released_at:'2024-01-01',set_type:'promo',card_count:5},{code:'u',name:'Alpha unknown',set_type:'unrecognized'}],snapshot=JSON.stringify(list);
assert.deepEqual(browseSets(list,'mtg',{},now).rows.map(s=>s.code),['a']);
assert.equal(browseSets(list,'mtg',{q:'alpha'},now).rows.length,3,'a default search reaches every category and unknown dates');
assert.equal(browseSets(list,'mtg',{q:'alpha',family:'promos'},now).rows.length,1,'search preserves deliberate family filters');
assert.equal(browseSets(list,'mtg',{q:'alpha',release:'upcoming'},now).rows.length,0,'search preserves deliberate release filters');
assert.equal(browseSets(list,'mtg',{q:'alpha',year:'2025'},now).rows.length,1,'search preserves year selection');
assert.equal(setBrowserState({family:'all'}).release,'all','All includes upcoming and undated unless explicitly constrained');
assert.equal(setBrowserState({family:'all',release:'released'}).release,'released');
assert.deepEqual(browseSets(list,'mtg',{family:'all',sort:'name'},now).rows.slice(0,3).map(s=>s.code),['p','a','u'],'A–Z is global, not year-local');
assert.equal(JSON.stringify(list),snapshot,'filtering never mutates the catalogue');
const duplicates=normalizeYgoSets([{set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08',num_of_cards:744},{set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2023-07-14',num_of_cards:126}]);
const duplicateResult=browseSets(duplicates,'ygo',{q:'LOB'},now);assert.equal(duplicateResult.rows.length,2);assert.notEqual(duplicateResult.rows[0].id,duplicateResult.rows[1].id);
const many=Array.from({length:1035},(_,i)=>({id:'u'+i,code:'U'+i,name:'Unknown '+i}));assert.equal(browseSets(many,'ygo',{family:'all'}).visible.length,80);assert.equal(browseSets(many,'ygo',{family:'all',limit:160}).visible.length,160);assert.equal(browseSets(many,'ygo',{family:'all',limit:2000}).visible.length,1035);
const setCss=fs.readFileSync(new URL('./sets-ui.css',import.meta.url),'utf8'),familyRail=setCss.match(/\.set-browser-quick\{([^}]+)\}/)?.[1]||'',familyButtons=setCss.match(/\.set-browser-quick>button\{([^}]+)\}/)?.[1]||'';
for(const rule of ['display:flex','min-width:0','max-width:100%','overflow-x:auto'])assert(familyRail.includes(rule),'Family presets stay in a bounded horizontally scrollable rail: '+rule);
for(const rule of ['flex:1 0 auto','white-space:nowrap','overflow-wrap:normal','word-break:normal'])assert(familyButtons.includes(rule),'Family labels cannot split midword or shrink/clamp: '+rule);
const controls=setBrowserControls(browseSets(list,'mtg',{},now),{game:'mtg',state:{},prefix:'sets',source:'Scryfall'});for(const key of ['setsSearch','setsFamily','setsType','setsRelease','setsYear','setsSort','setsReset'])assert(controls.includes(key));assert(controls.includes('8 in catalogue'));
assert.doesNotMatch(setBrowserRows(browseSets(list,'mtg',{family:'all',sort:'name'},now),s=>s.name),/set-year-section/,'global sorting is not rearranged by year grouping');
for(const total of [100,null]){const input={key:'x',owned:2,total,loaded:2,complete:false},full=setProgressMarkup(input).html,compact=setProgressMarkup({...input,compact:true}).html;assert.equal(/role="progressbar"/.test(full),/role="progressbar"/.test(compact));if(total)for(const attr of ['aria-valuemax="100"','aria-valuenow="2"','scaleX(0.02)'])assert(full.includes(attr)&&compact.includes(attr));else assert(!compact.includes('%')&&!compact.includes('scaleX'));}
assert.doesNotMatch(setProgressMarkup({key:'bad',owned:20,total:10,loaded:20,compact:true}).html,/role="progressbar"|%/);
const ygoTile=setRowContent({name:'Exact Release',code:'LOB',ygoSet:{id:'one'},image:'https://example.invalid/art.jpg',progress:{key:'one',owned:1,total:null}});assert.match(ygoTile,/set-ygo-emblem/);assert.match(ygoTile,/>LOB</);assert.doesNotMatch(ygoTile,/official logo|role="progressbar"/);
const state=S.state,oldSets=S.ui.sets;
try{
 S.state=blank();S.state.settings.game='mtg';S.state.collection=[{id:'one',printingId:'p1',printingVerified:true,qty:8},{id:'two',printingId:'p1',printingVerified:true,qty:3},{id:'unverified',printingId:'p2',qty:2}];S.state.printings={p1:{id:'p1',set:'a'},p2:{id:'p2',set:'a'}};S.ui.sets={list:[list[5]],q:'',family:'all'};
 const before=JSON.stringify(S.state),html=setsPage();assert.match(html,/1 \/ 2 unique cards owned/);assert.match(html,/aria-valuenow="1"/);assert.equal(JSON.stringify(S.state),before,'tile progress cannot change inventory');
 for(const game of ['ptcg','ygo']){
  S.state=blank();S.state.settings.game=game;const U=ui(game).sets;Object.assign(U,{list:[],q:'',family:'all',release:'all',limit:80});const A={},C={},I={};registerTcg({A,C,I,render(){},rerenderKeepingFocus(){},openSheet(){},closeSheet(){},go(){}});
  C.tSetsType({value:'promos'});I.tSetsSearch({value:'foo'});assert.equal(U.family,'promos');assert.equal(U.q,'foo');C.tSetsRelease({value:'upcoming'});assert.equal(U.release,'upcoming');A.tSetsMore();assert.equal(U.limit,160);A.tSetsReset();assert.equal(U.q,'');assert.equal(U.family,undefined);assert.equal(setBrowserState(U).family,'main');
 }
}finally{S.state=state;S.ui.sets=oldSets;}
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');assert.match(source,/!ui\.sets\.error\) loadSetIndex\(\);/,'ordinary on-use rendering honors fresh persisted cache rather than forcing refresh');assert(!source.includes('(fresh && ui.list.length)'),'explicit refresh is not defeated by a fresh cache');
console.log('PASS: three-game source-backed families, exact user screenshot cases, all/search reachability, explicit filters, upcoming/unknown dates, stable IDs, pagination, global sorting, shared unique progress, no inventory writes and real TCG handlers.');

const savedState=S.state,savedSet=S.ui.set,savedCatalogue=S.ui.sets,savedPtcgSet=ui('ptcg').set,savedPtcgCatalogue=ui('ptcg').sets;
try {
 S.state=blank();S.state.settings.game='mtg';S.state.collection=[{id:'owned',printingId:'known0',printingVerified:true,qty:8}];S.state.printings=Object.fromEntries(Array.from({length:11},(_,i)=>['known'+i,{id:'known'+i,set:'safe',name:'Known '+i,finishes:[],prices:{}}]));
 S.ui.set={code:'different',cards:[],total:0};const info={code:'safe',name:'Safe',set_type:'expansion',card_count:10};let snapshot=magicSetProgress('safe',info);assert.equal(snapshot.owned,1);assert.equal(snapshot.known,11);assert.doesNotMatch(setProgressMarkup({...snapshot,compact:true}).html,/role="progressbar"/,'known membership contradicting stale index total never shows a percentage');
 S.ui.set={code:'safe',info,cards:[S.state.printings.known0,S.state.printings.known0],total:12,complete:false,q:'',filter:'all',rarity:'all',sort:'number',limit:120};snapshot=magicSetProgress('safe',info);assert.equal(snapshot.total,12,'active provider denominator beats stale catalogue');assert.equal(snapshot.loaded,1,'partial rows are deduplicated');assert.equal(snapshot.known,11);assert.equal(snapshot.complete,false);assert.match(setPage(),/1 of 12 unique cards/);
 S.ui.sets={list:[info],q:'',family:'all'};assert.match(setsPage(),/1 \/ 12 unique cards owned/);
 S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:{collection:[{cardId:'bw11-RC1',qty:8},{cardId:'bw11-RC1',qty:3}],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
 const card=normalizePtcg({id:'bw11-RC1',localId:'RC1',name:'Trainer',category:'Trainer',trainerType:'Supporter',set:{id:'bw11',name:'Legendary Treasures',cardCount:{official:140,total:140}},variants:{normal:true},rarity:'Common'}),parent={id:'bw11',name:'Legendary Treasures',code:'BW11',count:140},gallery={id:'rc',name:'Radiant Collection',code:'RC',count:25};cache.ptcg[card.id]=card;
 const sets=ui('ptcg').sets;Object.assign(sets,{list:[parent,gallery],q:'',family:'all',release:'all'});
 const screen=ui('ptcg').set;Object.assign(screen,{info:gallery,id:'rc',cards:[{...card,setContext:{game:'ptcg',cardId:card.id,releaseId:'rc',membership:'set-response'}}],contents:{completeness:'partial'},q:'',filter:'all',rarity:'',finish:'',sort:'number',limit:80,candidates:null});
 const inventory=JSON.stringify(S.state),sourceCard=JSON.stringify(card),snap=tcgSetProgress('ptcg',gallery);assert.equal(ownedBySet('ptcg').get('bw11'),1);assert.equal(ownedBySet('ptcg').get('rc'),1,'provider-backed alias is owned once, not eleven copies');assert.equal(snap.owned,1);assert.equal(snap.total,25);assert.equal(snap.loaded,1);assert.equal(snap.complete,false);
 assert.match(tcgSets(),/1 \/ 25 unique cards owned/);assert.match(tcgSet(),/1 of 25 unique cards/);assert.match(tcgCardSheet(setContextCard('ptcg',screen.cards[0],gallery,sets.list),{tab:'overview',setId:'rc'}),/1 of 25 unique cards/,'tile, set page and real popup share provider-backed gallery membership');
 screen.cards=[{...card,setContext:{game:'ptcg',cardId:'conflicting-id',releaseId:'rc',membership:'set-response'}}];assert.equal(ownedBySet('ptcg').get('rc'),undefined,'conflicting membership is never inferred from name');
 screen.cards=[{...card,setContext:{game:'ptcg',cardId:card.id,releaseId:'rc',membership:'unverified'}}];assert.equal(ownedBySet('ptcg').get('rc'),undefined,'unverified subset is not credited');
 const verifiedGalleryCard={...card,setContext:{game:'ptcg',cardId:card.id,releaseId:'rc',membership:'set-response'}};rememberSetMembership('ptcg',gallery,[verifiedGalleryCard]);
 screen.info=parent;screen.cards=[card];assert.equal(tcgSetProgress('ptcg',gallery).owned,1,'verified gallery membership survives opening a different parent set');assert.match(tcgSets(),/1 \/ 25 unique cards owned/);assert.match(tcgCardSheet(setContextCard('ptcg',verifiedGalleryCard,gallery,sets.list),{tab:'overview',setId:'rc'}),/1 of 25 unique cards/);
 rememberSetMembership('ptcg',{id:'unverified-gallery'},[{...card,setContext:{game:'ptcg',cardId:'wrong-id',releaseId:'unverified-gallery',membership:'set-response'}}]);assert.equal(tcgSetProgress('ptcg',{id:'unverified-gallery',count:25}).owned,0);
 screen.info=null;screen.cards=[];sets.list=[];assert.equal(tcgSetProgress('ptcg',parent).owned,1,'cold catalogue still counts exact supplied parent membership');assert.match(tcgCardSheet(card,{tab:'overview'}),/1 of 140 unique cards/,'cold real popup does not invent zero ownership');
 assert.equal(JSON.stringify(S.state),inventory);assert.equal(JSON.stringify(card),sourceCard);
}finally {delete cache.ptcg['bw11-RC1'];S.state=savedState;S.ui.set=savedSet;S.ui.sets=savedCatalogue;ui('ptcg').set=savedPtcgSet;ui('ptcg').sets=savedPtcgCatalogue;}
console.log('PASS: shared tile/popup/page progress snapshots retain true known ownership through partial loads, deduplicate provider gallery aliases, reject conflicting membership and suppress stale-denominator percentages.');

assert.doesNotMatch(detailSetProgress({key:'conflict',owned:1,total:10,loaded:1,known:11}),/role="progressbar"|10%|of 10 unique cards/,'real popup wrapper forwards known-count contradiction');
const day=864e5,clock=Date.now(),storageBefore=globalThis.localStorage,priorState=S.state,priorSetIndex=S.ui.sets,records=new Map(),sourceBefore={ptcg:SOURCES.ptcg.sets,ygo:SOURCES.ygo.sets};
try {
 globalThis.localStorage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,String(v))};S.state=blank();
 const data={code:'ttl',name:'TTL release',released_at:'2026-01-01',set_type:'expansion',card_count:4};let requests=0,result={data:[data]},network={onLine:true};
 const loaderSource=source.slice(source.indexOf('async function loadSetIndex('),source.indexOf('// Every printing in a set, straight from Scryfall'));
 const loader=new Function('S','api','localStorage','SET_INDEX','registerSetIcons','navigationStamp','navigationCurrent','navigator','document','render',loaderSource+';return loadSetIndex;')(S,async()=>{requests++;if(result instanceof Error)throw result;return result;},globalThis.localStorage,'cardforge-sets-v1',()=>{},()=>({}),()=>true,network,{activeElement:null},()=>{});
 const fresh={at:clock-1000,sets:[data]};records.set('cardforge-sets-v1',JSON.stringify(fresh));S.ui.sets={list:[],q:'',busy:false,error:''};await loader();assert.equal(requests,0,'fresh MTG cache avoids a request');assert.equal(S.ui.sets.checkedAt,fresh.at);
 await loader(true);assert.equal(requests,1,'manual refresh bypasses fresh MTG cache');assert(S.ui.sets.checkedAt>=clock);
 const expired={at:clock-day-1,sets:[data]};records.set('cardforge-sets-v1',JSON.stringify(expired));await loader();assert.equal(requests,2,'expired MTG cache refreshes on use');
 const good=records.get('cardforge-sets-v1'),lastChecked=S.ui.sets.checkedAt;for(const bad of [new Error('Offline'),{data:[]}]){result=bad;await loader(true);assert.deepEqual(S.ui.sets.list,JSON.parse(good).sets);assert.equal(S.ui.sets.checkedAt,lastChecked);assert.equal(records.get('cardforge-sets-v1'),good);assert.match(S.ui.sets.error,/Showing the last checked catalogue/);}
 network.onLine=false;await loader(true);assert.equal(requests,4,'offline force shows an error without a network attempt');assert.match(S.ui.sets.error,/offline.*last checked catalogue/);assert.equal(S.ui.sets.checkedAt,lastChecked);network.onLine=true;
 for(const game of ['ptcg','ygo']){
  records.clear();S.state=blank();S.state.settings.game=game;const list=game==='ygo'?normalizeYgoSets([{code:'TTL',name:'TTL release',date:'2026-01-01'}]):[{id:'sv01',code:'SV01',name:'Scarlet & Violet',date:'2023-03-31',count:258}],key=game==='ygo'?'cardforge-ygo-sets-v3':'cardforge-ptcg-sets-v2',schema=game==='ygo'?3:2;let calls=0,value=list;
  SOURCES[game].sets=async()=>{calls++;if(value instanceof Error)throw value;return value;};Object.assign(ui(game).sets,{list:[],busy:false,error:''});const context={A:{},C:{},I:{},render(){},rerenderKeepingFocus(){},openSheet(){},closeSheet(){},go(){}};registerTcg(context);
  records.set(key,JSON.stringify({schema,at:clock-1000,list}));await context.loadSets(game);assert.equal(calls,0,game+' fresh cache');await context.loadSets(game,true);assert.equal(calls,1,game+' forced refresh');
  records.set(key,JSON.stringify({schema,at:clock-day-1,list}));await context.loadSets(game);assert.equal(calls,2,game+' daily on-use expiry');const good=records.get(key),at=ui(game).sets.checkedAt;
  for(const bad of [new Error('Offline'),[]]){value=bad;await context.loadSets(game,true);assert.equal(ui(game).sets.list.length,list.length);assert.equal(ui(game).sets.checkedAt,at);assert.deepEqual(JSON.parse(records.get(key)).list,JSON.parse(good).list);assert.equal(JSON.parse(records.get(key)).at,JSON.parse(good).at);assert.match(ui(game).sets.error,/Showing the last checked catalogue/);}
 }
 assert.match(setCatalogueStatus({checkedAt:clock-1000},clock),/within 24 hours/);assert.match(setCatalogueStatus({checkedAt:clock-day-1},clock),/refresh needed/);assert.match(setCatalogueStatus({checkedAt:clock-1000,error:'Offline'},clock),/refresh needed/);
 const upcoming={code:'soon',name:'Announced release',set_type:'expansion',released_at:'2026-10-20'};assert.equal(browseSets([upcoming],'mtg',{},'2026-10-19').rows.length,0);assert.equal(browseSets([upcoming],'mtg',{},'2026-10-20').rows.length,1,'source-confirmed upcoming release transitions by date without a catalogue deployment');
}finally{globalThis.localStorage=storageBefore;S.state=priorState;S.ui.sets=priorSetIndex;SOURCES.ptcg.sets=sourceBefore.ptcg;SOURCES.ygo.sets=sourceBefore.ygo;}
console.log('PASS: actual three-game loaders use fresh cache, refresh expired daily-on-use cache, honor manual force and preserve last good list/check time on network or invalid-data failure; date transitions are automatic.');

// Exercise the exact shared overflow extractor, not a selector-wide exemption.
const {auditedSetFamilyControl,noOverflow}=await import('./tests/detail-rules-fixtures.mjs');
const familyRailAudit={known:true,direct:true,connected:true,visible:true,focusable:true,inForm:false,buttons:4,pressed:'false',action:'setsFamily',value:'all',whiteSpace:'nowrap',left:30,right:280,top:100,bottom:152,scale:1,contentLeft:30,client:250,scroll:350,position:0,overflow:'auto',display:'flex',wrap:'nowrap'};
const familyControl={root:'content',view:'sets',game:'mtg',tag:'BUTTON',viewport:320,left:300,right:375,top:104,bottom:146,width:75,height:42,familyRail:familyRailAudit};
assert(auditedSetFamilyControl(familyControl),'Exact offscreen family button belongs to a reachable contained rail');
assert(auditedSetFamilyControl({...familyControl,left:200,right:275,familyRail:{...familyRailAudit,position:100}}),'Same button remains reachable at the other end of the rail');
for(const change of [{root:'sheetBody'},{view:'collection'},{game:'unknown'},{tag:'A'},{height:41},{width:300},{right:390}])assert(!auditedSetFamilyControl({...familyControl,...change}),JSON.stringify(change));
for(const change of [{known:false},{direct:false},{connected:false},{visible:false},{focusable:false},{inForm:true},{buttons:5},{pressed:null},{action:'tOwnSave'},{value:'unexpected'},{whiteSpace:'normal'},{overflow:'visible'},{overflow:'hidden'},{display:'block'},{wrap:'wrap'},{left:-1},{right:321},{client:0},{scroll:250},{scroll:Infinity},{position:-2},{position:110}])assert(!auditedSetFamilyControl({...familyControl,familyRail:{...familyRailAudit,...change}}),JSON.stringify(change));
for(const game of ['ptcg','ygo'])assert(auditedSetFamilyControl({...familyControl,game,familyRail:{...familyRailAudit,action:'tSetsFamily'}}));
const familyGlobals=Object.fromEntries(['document','window','location','innerWidth','innerHeight','getComputedStyle'].map(k=>[k,globalThis[k]])),box=(left,top,width,height)=>({left,right:left+width,top,bottom:top+height,width,height});
let familyRootWidth=320,familyScopeWidth=288,familyRight=280,familyOverflow='auto',familyOpacity='1';
const familyRoot={id:'content',isConnected:true,clientWidth:288,get scrollWidth(){return familyScopeWidth;},getBoundingClientRect:()=>box(16,0,288,600),querySelectorAll:()=>[familyButton]},familyControls={parentElement:familyRoot};
const familyNode={isConnected:true,parentElement:familyControls,clientLeft:0,clientWidth:250,offsetWidth:250,scrollWidth:350,scrollLeft:0,matches:s=>s==='.set-browser-controls > .set-browser-quick',getAttribute:k=>k==='role'?'group':null,querySelectorAll:()=>Array(4).fill(familyButton),getBoundingClientRect:()=>box(30,100,familyRight-30,52)};
const familyButton={isConnected:true,tagName:'BUTTON',type:'button',className:'',textContent:'All sets',tabIndex:0,disabled:false,form:null,parentElement:familyNode,dataset:{act:'setsFamily',value:'all'},getAttribute:k=>k==='aria-pressed'?'false':null,closest:s=>s==='.set-browser-quick'?familyNode:null,getClientRects:()=>[{}],getBoundingClientRect:()=>box(300,104,75,42)};
try{
 Object.assign(globalThis,{document:{body:{dataset:{game:'mtg',view:'sets'}},documentElement:{get scrollWidth(){return familyRootWidth;}},querySelector:()=>null,querySelectorAll:()=>[familyRoot]},window:{__uiTestState:{state:{settings:{game:'mtg'}},ui:{view:'sets'}}},location:{hash:'#sets'},innerWidth:320,innerHeight:800,getComputedStyle:n=>({visibility:'visible',opacity:n===familyControls?familyOpacity:'1',display:n===familyNode?'flex':'block',flexWrap:'nowrap',whiteSpace:'nowrap',overflowX:familyOverflow})});
 const page={evaluate:(fn,args)=>fn(args)};const result=await noOverflow(page,'#content','exact family rail');assert.equal(result.bad.length,1);assert.equal(result.bad[0].familyRail.action,'setsFamily');
 familyOverflow='visible';await assert.rejects(noOverflow(page,'#content','non-scrollable family rail'),/all visible controls/);familyOverflow='auto';
 familyOpacity='0';await assert.rejects(noOverflow(page,'#content','hidden family controls'),/all visible controls/);familyOpacity='1';
 familyButton.dataset.act='tOwnSave';await assert.rejects(noOverflow(page,'#content','unrelated action'),/all visible controls/);familyButton.dataset.act='setsFamily';
 familyButton.parentElement=familyControls;await assert.rejects(noOverflow(page,'#content','nested unrelated control'),/all visible controls/);familyButton.parentElement=familyNode;
 familyRight=322;await assert.rejects(noOverflow(page,'#content','rail outside viewport'),/all visible controls/);familyRight=280;
 familyRootWidth=324;await assert.rejects(noOverflow(page,'#content','real page overflow'),/no horizontal overflow/);familyRootWidth=320;
 familyScopeWidth=292;await assert.rejects(noOverflow(page,'#content','real content overflow'),/no horizontal overflow/);
}finally{for(const [key,value]of Object.entries(familyGlobals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
console.log('PASS: exact family rail audit verifies native scrolling, contained geometry, valid focusable presets and shared extraction; hidden/generic/unreachable controls and actual page overflow still fail.');
