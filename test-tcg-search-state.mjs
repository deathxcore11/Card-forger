// Actual registered Search actions with controlled provider responses. No network.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {registerTcg,ui,cache,SOURCES,tcgSearch,setSavedSearches,savedSearches,normalizeTcgSearch,invalidateTcgSearch} from './tcg.js';
import {normalizeYgo,ygoSource,YGO_FORMATS,ygoSearchFormatLabel,ygoSearchFormatSupported,ygoSearchEligibility,ygoLegality,normalizeYgoSearch} from './ygo.js';
import {normalizePtcg,normalizePtcgSearch,ptcgSource} from './ptcg.js';
const records=new Map();
globalThis.localStorage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)};
globalThis.document={body:{dataset:{}},querySelector:()=>null};
globalThis.fetch=async url=>{throw Error('Unmocked network: '+url);};
S.state=blank();S.state.tcg={ygo:blankGame(),ptcg:blankGame()};S.state.settings.game='ygo';S.ui.view='search';
let renders=0,magicInvalidations=0;
const A={},C={},I={};
registerTcg({A,C,I,commit:async f=>f(S.state),render:()=>renders++,toast(){},go(){},closeSheet(){S.ui.sheetCtx=null;},openSheet(){},writeRecord:async()=>{},invalidateMagicSearch:()=>magicInvalidations++,switchGame:async game=>{magicInvalidations++;invalidateTcgSearch(S.state.settings.game);S.state.settings.game=game;return true;}});
const realYgo=SOURCES.ygo.search,realPtcg=SOURCES.ptcg.search,realGet=SOURCES.ptcg.get;
const requests=[];
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const enqueue=game=>spec=>{const d=deferred();requests.push({game,spec,...d});return d.promise;};
SOURCES.ygo.search=enqueue('ygo');SOURCES.ptcg.search=enqueue('ptcg');
const ygo=(id,opts={})=>normalizeYgo({id,name:'Card '+id,type:'Normal Monster',frameType:'normal',card_prices:[{tcgplayer_price:opts.price??'1'}],misc_info:[{formats:opts.pools??['TCG','OCG','GOAT']}],...opts});
const pk=(id,opts={})=>normalizePtcg({id,name:'Pikachu',category:'Pokemon',legal:{standard:true,expanded:true},set:{id:'test',name:'Test'},pricing:{tcgplayer:{normal:{marketPrice:1}}},...opts});
const respond=async (job,cards,{more=false,total=cards.length}={})=>{requests.at(-1).resolve({cards,more,total});await job;};
const reset=(game='ygo')=>{S.state.settings.game=game;invalidateTcgSearch(game,true);Object.assign(ui(game).search,{q:'',f:{},sort:game==='ygo'?'name':'new',maxPrice:'',own:''});return ui(game).search;};
try {
 let U=reset();
 I.tQ({value:'old'});const first=A.tSearch(),old=requests.at(-1);
 I.tQ({value:'new'});const replacement=A.tSearch(),newer=requests.at(-1);
 assert.equal(requests.length,2,'replacement query starts while prior request is busy');
 newer.resolve({cards:[ygo('new')],more:true,total:3});await replacement;
 old.resolve({cards:[ygo('old')],more:false,total:1});await first;
 assert.deepEqual(U.results.map(c=>c.id),['new']);assert.equal(U.busy,false);assert.equal(cache.ygo.old,undefined,'stale success cannot enter the cache');
 assert(Object.isFrozen(U.submitted));assert(Object.isFrozen(U.submitted.f));
 // Local sorting and editing a draft cannot change the provider page's query/order.
 const sortStart=A.tSearch();await respond(sortStart,[ygo('a',{price:'9'}),ygo('b',{price:'2'})],{more:true,total:4});
 I.tQ({value:'edited but not submitted'});C.tSort({value:'priceAsc'});C.tMax({value:'5'});
 const more=A.tMore(),page=requests.at(-1);
 assert.equal(page.spec.page,1);assert.equal(page.spec.q,'new');assert.equal(page.spec.sort,'name');
 assert.equal(U.page,0,'page advances only after successful response');
 page.reject(Error('temporary page failure'));await more;
 assert.equal(U.page,0);assert.equal(U.more,true);assert.equal(U.failedPage,1);assert.match(tcgSearch(),/Retry load more/);
 const retry=A.tMore();assert.equal(requests.at(-1).spec.page,1);
 await respond(retry,[ygo('b',{price:'2'}),ygo('c',{price:'3'})],{more:false,total:4});
 assert.deepEqual(U.results.map(c=>c.id),['a','b','c'],'duplicate card IDs are not appended twice');assert.equal(U.page,1);
 let html=tcgSearch();assert.match(html,/Price order applies to loaded cards only/);assert.match(html,/Results for/);assert(html.indexOf('data-id="b"')<html.indexOf('data-id="c"'));
 // A replacement also owns state when an older Load more is still pending.
 U=reset();I.tQ({value:'paging old'});const oldBase=A.tSearch();await respond(oldBase,[ygo('base')],{more:true,total:5});
 const oldMore=A.tMore(),oldPage=requests.at(-1);I.tQ({value:'paging replacement'});const pageReplacement=A.tSearch();
 await respond(pageReplacement,[ygo('page-replacement')],{more:false,total:1});oldPage.reject(Error('stale page error'));await oldMore;
 assert.deepEqual(U.results.map(c=>c.id),['page-replacement']);assert.equal(U.page,0);assert.equal(U.error,'');assert.equal(U.more,false);
 // Stale failure cannot clear the busy marker of a replacement.
 U=reset();I.tQ({value:'first'});const failure=A.tSearch(),failing=requests.at(-1);
 const next=C.tFilter({dataset:{field:'type'},value:'Spell Card'}),nextRequest=requests.at(-1);
 failing.reject(Error('old failure'));await failure;assert.equal(U.busy,true);assert.equal(U.error,'');
 nextRequest.resolve({cards:[],more:false,total:0});await next;
 // Clear invalidates even when there is no new search to replace the old one.
 U=reset();U.f={attribute:'DARK'};const clearing=A.tSearch(),clearRequest=requests.at(-1);
 A.tClear();assert.equal(U.busy,false);assert.equal(U.ran,false);assert.equal(U.more,false);
 clearRequest.resolve({cards:[ygo('cleared')],more:true,total:99});await clearing;assert.equal(U.results.length,0);
 // Restored filters are normalized before both UI and provider submission.
 setSavedSearches('ygo',[{label:'saved',q:'saved',f:{type:'Spell Card',attribute:'DARK',level:'8',race:'Dragon'},sort:'defDesc'}]);
 I.tQ({value:'prior'});const previous=A.tSearch(),prior=requests.at(-1);
 const saved=A.tSaved({dataset:{i:'0'}});assert.equal(requests.at(-1).spec.q,'saved');
 assert.equal(requests.at(-1).spec.attribute,undefined);assert.equal(requests.at(-1).spec.level,undefined);assert.equal(requests.at(-1).spec.race,undefined);assert.equal(requests.at(-1).spec.sort,'name');
 await respond(saved,[ygo('saved')]);prior.reject(Error('late prior'));await previous;assert.equal(U.error,'');
 A.tSaveSearch();assert.equal(savedSearches('ygo')[0].f.attribute,undefined);
 // Spell, Trap and Link invalid controls disappear rather than remaining hidden.
 html=tcgSearch();assert.doesNotMatch(html,/data-field="attribute"|data-field="level"|value="defDesc"/);
 U.f={type:'Link Monster',level:'7',attribute:'DARK',race:'Dragon'};U.sort='defDesc';normalizeTcgSearch('ygo',U);
 assert.equal(U.f.level,undefined);assert.equal(U.sort,'name');assert.equal(U.f.attribute,'DARK');html=tcgSearch();assert.doesNotMatch(html,/data-field="level"|value="defDesc"/);assert.match(html,/value="atkDesc"/);
 // Same stable disclosure ID regardless of active filter count.
 const disclosure=html.match(/id="tcg-search-filters-ygo"/)[0];U.maxPrice='3';assert(tcgSearch().includes(disclosure));
 // Departing game and return cannot revive pending cards or stale failure.
 U=reset();I.tQ({value:'depart'});const departing=A.tSearch(),departure=requests.at(-1);
 await A.setGame({dataset:{game:'ptcg'}});await A.setGame({dataset:{game:'ygo'}});
 departure.resolve({cards:[ygo('departed')],more:true,total:30});await departing;assert.equal(U.results.length,0);assert.equal(U.busy,false);assert.equal(magicInvalidations,2);
 // Zero visible owned results still offer provider continuation, and retry is reachable.
 U=reset();U.own='owned';const noVisible=A.tSearch();await respond(noVisible,[ygo('not-owned')],{more:true,total:2});
 html=tcgSearch();assert.match(html,/No matches among loaded cards/);assert.match(html,/data-act="tMore"/);assert.match(html,/0 shown · 1 loaded/);
 const invisibleMore=A.tMore();requests.at(-1).reject(Error('cannot load'));await invisibleMore;assert.match(tcgSearch(),/Retry load more/);
 // Canonical eligibility excludes forbidden, retains limited/semi-limited and Traditional.
 U=reset();U.f={format:'tcg'};U.ran=true;U.results=[ygo('legal'),ygo('banned',{banlist_info:{ban_tcg:'Forbidden'}}),ygo('limited',{banlist_info:{ban_tcg:'Limited'}}),ygo('semi',{banlist_info:{ban_tcg:'Semi-Limited'}}),ygo('ocg-only',{pools:['OCG']}),ygo('unverified',{pools:[]})];
 html=tcgSearch();for(const id of ['legal','limited','semi'])assert(html.includes(`data-id="${id}"`));for(const id of ['banned','ocg-only','unverified'])assert(!html.includes(`data-id="${id}"`));assert.match(html,/unverified format membership/);
 U.f.format='traditional';assert.match(tcgSearch(),/data-id="banned"/);
 U.f.format='ocg';U.results=[ygo('ocg-ok'),ygo('ocg-no',{banlist_info:{ban_ocg:'Forbidden'}})];html=tcgSearch();assert.match(html,/data-id="ocg-ok"/);assert.doesNotMatch(html,/data-id="ocg-no"/);
 U.f.format='edison';html=tcgSearch();assert.match(html,/Edison · verification unavailable/);assert.match(html,/no Edison format filter is applied/);assert.doesNotMatch(html,/Legal in Edison|Card pool: Edison/);assert.match(html,/data-id="ocg-ok"/);assert.match(html,/data-id="ocg-no"/,'unverified format must not silently hide otherwise matching cards');
 // Provider records document lowercase misc formats; older cache casing also works.
 for(const fid of ['tcg','traditional','ocg','goat','md','speed','dl']) {
   const f=YGO_FORMATS.find(f=>f.id===fid);
   for(const [i,pool] of [f.pool.toLowerCase(),f.pool,f.pool.toUpperCase()].entries()) {
     const card=ygo('case-'+fid+'-'+i,{pools:[pool]});const before=JSON.stringify(card);
     assert.equal(ygoSearchEligibility(card,f),'legal',fid+' accepts '+pool);assert.equal(JSON.stringify(card),before,'Search projection does not mutate normalized records');
     U.f={format:fid};U.results=[card];assert(tcgSearch().includes(`data-id="${card.id}"`),fid+' renders '+pool);
   }
 }
 const lowerLimited=ygo('lower-limited',{pools:['tcg'],banlist_info:{ban_tcg:'Limited'}}),lowerSemi=ygo('lower-semi',{pools:['ocg'],banlist_info:{ban_ocg:'Semi-Limited'}}),lowerBanned=ygo('lower-banned',{pools:['tcg'],banlist_info:{ban_tcg:'Forbidden'}});
 assert.equal(ygoSearchEligibility(lowerLimited,YGO_FORMATS.find(f=>f.id==='tcg')),'limited');assert.equal(ygoSearchEligibility(lowerSemi,YGO_FORMATS.find(f=>f.id==='ocg')),'semi');assert.equal(ygoSearchEligibility(lowerBanned,YGO_FORMATS.find(f=>f.id==='traditional')),'limited');
 assert.equal(ygoLegality(lowerLimited,YGO_FORMATS.find(f=>f.id==='tcg')),'limited','deck and Search helpers share case-insensitive provider pool identity');
 U.f={format:'tcg'};U.results=[lowerLimited,lowerBanned];html=tcgSearch();assert.match(html,/data-id="lower-limited"/);assert.doesNotMatch(html,/data-id="lower-banned"/);
 assert.equal(ygoSearchFormatSupported(YGO_FORMATS.find(f=>f.id==='edison')),false);assert.equal(ygoSearchEligibility(ygo('not-verified',{pools:['edison']}),YGO_FORMATS.find(f=>f.id==='edison')),'unknown');
 assert.equal(ygoSearchEligibility(ygo('unknown',{pools:[]}),YGO_FORMATS.find(f=>f.id==='ocg')),'unknown');
 // Repeating pages cannot create an endless control, but previously loaded cards survive.
 U=reset();const repeatStart=A.tSearch();await respond(repeatStart,[ygo('repeat')],{more:true,total:10});const repeat=A.tMore();await respond(repeat,[ygo('repeat')],{more:true,total:10});assert.equal(U.more,false);assert.equal(U.results.length,1);assert.match(U.error,/repeated a page/);
 // Failed first page owns a retry even when no tiles exist.
 U=reset();const failStart=A.tSearch();requests.at(-1).reject(Error('first failed'));await failStart;assert.match(tcgSearch(),/data-act="tRetrySearch"/);const retryStart=A.tRetrySearch();await respond(retryStart,[]);
 // Numeric/enum legacy fields cannot masquerade as active provider filters.
 U=reset();U.f={type:'unsupported',attribute:'invalid',level:'99',format:'old-format',set:'explicit-set'};U.sort='invalid';normalizeTcgSearch('ygo',U);
 assert.deepEqual(U.f,{set:'explicit-set'});assert.equal(U.sort,'name');
 U=reset('ptcg');U.f={stage:'invalid',hp:'NaN',category:'invalid',type:'invalid',rarity:'invalid'};normalizeTcgSearch('ptcg',U);assert.deepEqual(U.f,{});
 // Pokémon category switches and unavailable details keep continuation/recovery visible.
 U=reset('ptcg');U.f={category:'Pokemon',type:'Lightning',stage:'Stage2',hp:'200'};
 const trainer=C.tFilter({dataset:{field:'category'},value:'Trainer'});const trainerSpec=requests.at(-1).spec;
 for(const key of ['type','stage','hp'])assert.equal(trainerSpec[key],undefined);
 await respond(trainer,[]);html=tcgSearch();assert.doesNotMatch(html,/data-field="type"|data-field="stage"|data-field="hp"/);
 U.f={category:'Energy',type:'Lightning',stage:'Stage2',hp:'200'};A.tSaveSearch();for(const key of ['type','stage','hp'])assert.equal(savedSearches('ptcg')[0].f[key],undefined);
 const detail=deferred();SOURCES.ptcg.get=()=>detail.promise;U.f={format:'standard'};U.maxPrice='3';
 const pending=A.tSearch();await respond(pending,[{game:'ptcg',id:'pending-1',name:'Pikachu',brief:true,prices:{}}],{more:true,total:2});
 html=tcgSearch();assert.match(html,/awaiting card details/);assert.match(html,/0 shown · 1 loaded/);assert.match(html,/data-act="tMore"/);assert.doesNotMatch(html,/data-id="pending-1"/);
 detail.reject(Error('detail unavailable'));await new Promise(r=>setTimeout(r,0));html=tcgSearch();assert.match(html,/with details unavailable/);assert.match(html,/data-act="tSearchDetails"/);
 SOURCES.ptcg.get=async id=>pk(id);await A.tSearchDetails();html=tcgSearch();assert.match(html,/data-id="pending-1"/);assert.doesNotMatch(html,/awaiting card details|with details unavailable/);
 console.log('PASS: actual TCG Search actions fence stale success/failure, Clear/saved/game switches; immutable paging, retries, duplicates, local-only price sorting, hidden controls, pending detail recovery and verified YGO legality.');
} finally { SOURCES.ygo.search=realYgo;SOURCES.ptcg.search=realPtcg;SOURCES.ptcg.get=realGet; }
// Adapter-level request contracts: no live API and no category-invalid fields.
let urls=[];
globalThis.fetch=async url=>{urls.push(new URL(String(url),'https://example.test/'));return Response.json({data:[],meta:{total_rows:0,rows_remaining:'0'}});};
let result=await ygoSource.search({type:'Spell Card',attribute:'DARK',level:'7',race:'Dragon',sort:'defDesc'});
assert.equal(urls.length,1);assert.equal(urls[0].searchParams.get('sort'),'name');for(const key of ['attribute','level','race'])assert.equal(urls[0].searchParams.get(key),null);assert.equal(result.more,false,'string zero is exhausted');
urls=[];await ygoSource.search({type:'Link Monster',level:'8',sort:'defDesc',format:'ocg'});assert.equal(urls[0].searchParams.get('level'),null);assert.equal(urls[0].searchParams.get('format'),null,'never invent unsupported OCG provider filtering');
urls=[];await ygoSource.search({q:'matching name',format:'edison'});assert.equal(urls[0].searchParams.get('format'),null,'unsupported Edison provider parameter is never sent');assert.equal(urls[0].searchParams.get('fname'),'matching%name','other requested filters remain applied');
const realSets=ptcgSource.sets;ptcgSource.sets=async()=>[{id:'pk-test'}];
globalThis.fetch=async url=>{urls.push(new URL(String(url)));return Response.json([{id:'pk-test-1',name:'Potion'},{id:'pk-test-1',name:'Potion'},{id:'pk-test-2',name:'Energy'}]);};
try {urls=[];result=await ptcgSource.search({category:'Trainer',type:'Fire',stage:'Basic',hp:'200',size:1});for(const key of ['types','stage','hp'])assert.equal(urls[0].searchParams.get(key),null);assert.equal(result.total,2,'adapter deduplicates before pagination');assert.equal(result.more,true);const page=await ptcgSource.search({category:'Trainer',page:1,size:1});assert.notEqual(page.cards[0].id,result.cards[0].id);assert.equal(page.more,false);}finally{ptcgSource.sets=realSets;}
assert.deepEqual(normalizeYgoSearch({type:'Trap Card',attribute:'DARK',level:'5',race:'Counter',sort:'atkDesc'}),{type:'Trap Card',race:'Counter',sort:'name'});
assert.deepEqual(normalizePtcgSearch({category:'Energy',type:'Fire',stage:'Basic',hp:'100',rarity:'Rare'}),{category:'Energy',rarity:'Rare'});
assert.equal(ygoSearchFormatLabel(YGO_FORMATS.find(f=>f.id==='ocg')),'Legal in OCG');
console.log('PASS: adapter normalization, stable deduplicated Pokémon pages, numeric provider continuation, and unsupported-format safety.');
// Descending provider pages share the original total/offset basis, avoiding
// extra count probes or offset shifts after a local price-sort toggle.
urls=[];let probes=0;
globalThis.fetch=async url=>{
 const u=new URL(String(url));urls.push(u);const count=Number(u.searchParams.get('num')),start=Number(u.searchParams.get('offset'));
 if(count===1&&start===0){probes++;return Response.json({data:[{id:'1',name:'Card 1'}],meta:{total_rows:7}});}
 return Response.json({data:Array.from({length:count},(_,i)=>({id:String(start+i+1),name:'Card '+(start+i+1)})),meta:{total_rows:probes>1?100:7}});
};
const descending=await ygoSource.search({sort:'atkDesc',size:3}),nextDescending=await ygoSource.search({sort:'atkDesc',size:3,page:1,paging:descending.paging});
assert.deepEqual(descending.cards.map(c=>c.id),['7','6','5']);assert.deepEqual(nextDescending.cards.map(c=>c.id),['4','3','2']);assert.equal(probes,1);assert.equal(urls.length,3);
console.log('PASS: descending YGO continuation reuses the first page count/order and does not re-probe or shift its paging basis.');

// Coalesce concurrent identical Pokémon query loads; a failed coalesced lookup
// releases its slot so a later deliberate retry can succeed.
let fetches=0,release;globalThis.fetch=()=>{fetches++;return new Promise(resolve=>release=resolve);};
const coalescedA=ptcgSource.search({q:'coalesced-fixture',sort:'name'}),coalescedB=ptcgSource.search({q:'coalesced-fixture',sort:'new'});
assert.equal(fetches,1);release(Response.json([{id:'coalesce-1',name:'coalesced-fixture'}]));await Promise.all([coalescedA,coalescedB]);
globalThis.fetch=async()=>Response.json({unexpected:'not an array'});await assert.rejects(ptcgSource.search({q:'retry-fixture'}),/invalid list/);
globalThis.fetch=async()=>Response.json([{id:'retry-1',name:'retry-fixture'}]);assert.equal((await ptcgSource.search({q:'retry-fixture'})).cards.length,1);
console.log('PASS: identical concurrent Pokémon queries share one provider request; invalid responses release their retry slot.');
