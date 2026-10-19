import assert from 'node:assert/strict';
import { WeeklyCuration, curationWeek, curationPlan, prepareCurationRequest, applyNewsCuration, deterministicNews, CURATION_LIMITS } from './weekly-curation.js';
import { metaCurationCandidates, applyMetaCuration, applyMetaOverlay, sourceDate } from './meta-curation.js';
import { weeklyCurationRoute, scheduledWeeklyCuration } from './weekly-curation-route.js';
import { communityArtwork, handleCommunityArtwork } from './community-art.js';
import { featureArticle } from './home-ui.js';
import { ygoMeta, ptcgMeta } from './meta.js';
class Storage {
  constructor() { this.rows = new Map(); this.queue = Promise.resolve(); }
  async get(key) { return structuredClone(this.rows.get(key)); }
  async put(key,value) { this.rows.set(key,structuredClone(value)); }
  transaction(fn) { const run = this.queue.then(() => fn(this)); this.queue = run.catch(() => {}); return run; }
}
const now = Date.parse('2026-10-19T08:00:00Z'), fresh = new Date(now - 864e5).toISOString();
const story = (game='mtg') => ({ id:'https://magic.wizards.com/en/news/announcements/test-release', url:'https://magic.wizards.com/en/news/announcements/test-release', sourceId:'wizards', source:'Wizards of the Coast', game, kind:'news', title:'Magic release preview', evidence:'The new cards were previewed in the official announcement.', publishedAt:fresh, fetchedAt:new Date(now).toISOString(), image:'', summary:'Read at source' });
const snapshot = row => ({ game:row.game,items:[row],sources:[],status:'ready',fetchedAt:new Date(now).toISOString(),checkedAt:new Date(now).toISOString() });
let calls=0, sourceCalls=0;
const store=new Storage(), options={ now:()=>now, collectNews:async game=>{sourceCalls++;await new Promise(r=>setTimeout(r,5));return snapshot(story(game));},fetchImpl:async(url,init)=>{calls++; assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.max_output_tokens,1500);assert(!body.tools);assert.equal(init.redirect,'error');return Response.json({status:'completed',output_text:JSON.stringify({selections:[{id:'0',summary:'The announcement previews new cards.',category:'Release'}]}),usage:{input_tokens:99,output_tokens:40}});}};
const controller=new WeeklyCuration(store,{OPENAI_API_KEY:'fixture-key'},options);
const read=()=>controller.fetch(new Request('https://internal/weekly/read?kind=news&game=mtg'));
const refresh=()=>controller.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));
await read();assert.equal(calls,0);assert.equal(sourceCalls,0,'GET does not generate sources or AI');
const concurrent=await Promise.all(Array.from({length:12},refresh));assert.equal(calls,1);assert.equal(sourceCalls,1,'durable transaction protects concurrent refreshes');
assert.equal((await (await read()).json()).items[0].whyItMatters,'The announcement previews new cards.');
assert.equal((await store.get('budget')).requests,1);assert.equal((await store.get('budget')).inputTokens,99);
await refresh();assert.equal(calls,1,'no repeated attempts within the same week');
const restarted=new WeeklyCuration(store,{OPENAI_API_KEY:'fixture-key'},options);await restarted.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));assert.equal(calls,1,'restart does not spend twice');
const original=await store.get('feed:news:mtg:');
const failed=new WeeklyCuration(store,{OPENAI_API_KEY:'fixture-key'},{...options,now:()=>now+7*864e5,collectNews:async()=>snapshot({...story(),publishedAt:new Date(now+6*864e5).toISOString(),fetchedAt:new Date(now+7*864e5).toISOString()}),fetchImpl:async()=>{calls++;throw Error('timeout')}});
await failed.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));assert.deepEqual(await store.get('feed:news:mtg:'),original,'provider error preserves last-good snapshot');
await failed.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));assert.equal(calls,2,'timeout never retries in same week');
const failureBody=await (await failed.fetch(new Request('https://internal/weekly/read?kind=news&game=mtg'))).json();assert(failureBody.stale);assert.equal(failureBody.items.length,1,'older verified story survives within labelled retention');
for(const env of [{},{OPENAI_API_KEY:'fixture-key',OPENAI_MODEL:'expensive-unknown'}]){
 const db=new Storage(),c=new WeeklyCuration(db,env,{...options,fetchImpl:async()=>assert.fail('unknown/unconfigured provider cannot be called')});await c.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));assert.equal((await db.get('feed:news:mtg:')).items.length,1);
}
const crashed=new Storage();await crashed.put('attempt:news:mtg:',{week:curationWeek(now),status:'started'});const locked=new WeeklyCuration(crashed,{OPENAI_API_KEY:'fixture-key'},{...options,fetchImpl:async()=>assert.fail('uncertain attempt never repeated')});await locked.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));
const huge=Array.from({length:30},(_,i)=>({...story(),title:'🔥'.repeat(1000),evidence:'界'.repeat(2000),id:String(i)}));const prepared=prepareCurationRequest({kind:'news',game:'mtg'},huge,'gpt-4.1-mini');assert(new TextEncoder().encode(JSON.stringify(prepared.body)).length<=CURATION_LIMITS.requestBytes);assert(prepared.inputTokenUpperBound<=5000);assert.equal(curationPlan().length,14);assert.equal(curationWeek(Date.parse('2026-10-18T23:59:59Z')),'2026-10-12');assert.equal(curationWeek(Date.parse('2026-10-19T00:00:00Z')),'2026-10-19');
const dedupe=deterministicNews({...snapshot(story()),items:[story(),{...story(),id:'x',url:story().url+'-duplicate'}]},now);assert.equal(dedupe.items.length,1);
assert.throws(()=>applyNewsCuration(dedupe,dedupe.items,{selections:[{id:'999',summary:'Invented',category:'Cards'}]}));
const grounded=applyNewsCuration(dedupe,dedupe.items,{selections:[{id:'0',summary:'Available for $50 on 2027-01-01.',category:'Release'}]});assert(!grounded.items[0].whyItMatters.includes('$50'));
const source={game:'mtg',format:'Modern',source:'Magic Online',fetchedAt:new Date(now).toISOString(),decks:[{key:'good',name:'Burn',event:'Modern Challenge',date:fresh,rank:1,players:80,main:[{qty:4,name:'Lightning Bolt'}],url:'https://www.mtgo.com/decklist/modern-challenge-2026-10-18'}, {key:'future',name:'Future',date:'2027-01-01',main:[{qty:4,name:'Bad'}],url:'https://www.mtgo.com/decklist/modern-future'}],archetypes:[{name:'Burn',share:.3}],results:{real:true}};
const spec={kind:'meta',game:'mtg',format:'Modern'};assert.equal(metaCurationCandidates(source,spec,now).length,1);assert.equal(metaCurationCandidates(source,{...spec,format:'EDH'},now).length,0);
const overlay={...applyMetaCuration(source,spec,{selections:[{id:'0'}]},now),curatedAt:new Date(now).toISOString()};const input=structuredClone(source),decorated=applyMetaOverlay(source,overlay,now);assert.deepEqual(source,input);assert.deepEqual(decorated.decks,source.decks);assert.deepEqual(decorated.archetypes,source.archetypes);assert.deepEqual(decorated.results,source.results);assert.equal(decorated.curation.selections[0].id,'good');assert.equal(applyMetaOverlay(source,{...overlay,format:'EDH'},now),source);
assert.equal(sourceDate('2026-02-31'),'');assert.equal(sourceDate(1792342800),'2026-10-18T17:00:00.000Z');
let publicCalls=0;const env={AI_REVIEW_LIMITS:{idFromName:name=>{assert.equal(name,'public-weekly-curation-v1');return name;},get:()=>({fetch:async req=>{publicCalls++;const u=typeof req==='string'?req:req.url;assert(u.includes('/weekly/read?'));return Response.json({items:[]});}})}};
await weeklyCurationRoute(new Request('https://app/api/community?game=mtg'),new URL('https://app/api/community?game=mtg'),env);assert.equal(publicCalls,1);
assert.equal((await weeklyCurationRoute(new Request('https://app/api/community?game=mtg&force=true'),new URL('https://app/api/community?game=mtg&force=true'),env)).status,400);
assert.equal((await scheduledWeeklyCuration({})).status,'not-configured');
for(const game of ['mtg','ptcg','ygo']){const sourceId={mtg:'wizards',ptcg:'pokeguardian',ygo:'konami'}[game],url={mtg:story().url,ptcg:'https://www.pokeguardian.com/3412574_tcg-story',ygo:'https://www.yugioh-card.com/en/news/story/'}[game];const html=communityArtwork(game,{kind:'news',sourceId,url,image:''});assert.match(html,/<img/);assert.match(html,/Illustrative/);assert.match(featureArticle(game,{...story(game),whyItMatters:'Source-backed note',category:'Cards'},0,1),/community-pills/);}
const wrapper={dataset:{artKind:'publisher',artState:'pending',artFallback:'img/ygo/a/89631139.jpg',artFallbackLabel:'Illustrative Yu-Gi-Oh! card art'},querySelector:()=>({textContent:''})},image={matches:()=>true,closest:()=>wrapper,naturalWidth:0};handleCommunityArtwork({type:'error',target:image});assert.equal(image.src,'img/ygo/a/89631139.jpg');assert.equal(wrapper.dataset.artKind,'illustrative');assert(!wrapper.hidden);handleCommunityArtwork({type:'error',target:image});assert(image.hidden);assert.equal(wrapper.dataset.artState,'missing');
const ygoRaw={deckNum:1,deck_name:'Test',main_deck:'[89631139]',submit_date:'2026-10-18 12:00:00',tournamentName:'YCS example',tournamentPlacement:'Top 8',pretty_url:'test-list',cover_card:89631139};const ygo=await ygoMeta({now,server:true,fetchImpl:async u=>Response.json(u.includes('/top/')?{results:[]}:[ygoRaw,{...ygoRaw,deckNum:2,submit_date:'2027-01-01'}])});assert.equal(ygo.decks.length,1,'duplicate pages and future submissions are removed');assert.equal(ygo.decks[0].date,'2026-10-18T12:00:00.000Z');assert.equal(ygo.decks[0].dateMeaning,'List submitted');
await assert.rejects(()=>ptcgMeta({now,fetchImpl:async()=>Response.json([{id:'future',date:'2027-01-01',players:100,game:'PTCG',format:'STANDARD'}])}),/No recent/);
console.log('PASS: weekly source-first curation, zero paid GETs, transaction/restart/crash idempotency, caps, fallback/retention, strict IDs/provenance, source dates, Meta immutability, image fallback and source deduplication.');
// Actual Worker and existing Durable Object dispatch, without provider calls.
const {default:worker}=await import('./worker.js');const {AiReviewLimits}=await import('./ai-review-route.js');const {mtgoEventSlugs}=await import('./mtgmeta.js');
assert.deepEqual(mtgoEventSlugs('<a href="/decklist/modern-challenge-2027-01-011234">future</a><a href="/decklist/modern-challenge-2026-02-311234">bad</a>','Modern',{now}),[]);
const realStore=new Storage(),realDO=new AiReviewLimits({storage:realStore},{OPENAI_API_KEY:'fixture-key'});realDO.weekly=new WeeklyCuration(realStore,{OPENAI_API_KEY:'fixture-key'},{...options,fetchImpl:async()=>assert.fail('GET cannot call provider')});
const workerEnv={AI_REVIEW_LIMITS:{idFromName:name=>name,get:name=>{assert.equal(name,'public-weekly-curation-v1');return{fetch:req=>realDO.fetch(typeof req==='string'?new Request(req):req)}}},ASSETS:{fetch:()=>new Response('asset')}};
const before=calls;for(const path of ['/api/community?game=mtg','/api/meta/curation?game=ygo','/api/meta/curation?game=mtg&format=Modern']){const r=await worker.fetch(new Request('https://app'+path),workerEnv,{});assert.equal(r.status,200);assert.equal((await r.json()).cadence,'weekly');}assert.equal(calls,before);
assert.equal((await worker.fetch(new Request('https://app/api/community?game=mtg',{method:'POST'}),workerEnv,{})).status,405);
const ordinary=new AiReviewLimits({storage:new Storage()},{AI_DAILY_LIMIT:'2'});assert.equal((await ordinary.fetch(new Request('https://limits/',{method:'POST',body:JSON.stringify({hash:'a'.repeat(64)})}))).status,200,'existing quota dispatch remains intact');
console.log('PASS: actual Worker GET/POST boundaries, existing Durable Object dispatch/quota isolation, MTGO future/calendar rejection.');
// Every independent budget ceiling denies before a paid request.
for(const limit of [{requests:14},{reservedUsd:.10},{reservedInputTokens:70000},{reservedOutputTokens:21000}]){
 const db=new Storage();await db.put('budget',{week:curationWeek(now),requests:0,reservedUsd:0,reservedInputTokens:0,reservedOutputTokens:0,inputTokens:0,outputTokens:0,...limit});
 const c=new WeeklyCuration(db,{OPENAI_API_KEY:'fixture-key'},{...options,fetchImpl:async()=>assert.fail('exhausted cap must not call provider')});await c.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));assert.equal((await db.get('feed:news:mtg:')).aiStatus,'budget-exhausted');
}
// Malformed, invented-ID, incomplete and oversized provider responses retain last good.
for(const response of [()=>Response.json({status:'completed',output_text:'not JSON',usage:{input_tokens:11,output_tokens:9}}),()=>Response.json({status:'completed',output_text:JSON.stringify({selections:[{id:'999',category:'Cards',summary:'Invented'}]})}),()=>Response.json({status:'incomplete',output_text:'{}'}),()=>new Response('x'.repeat(CURATION_LIMITS.responseBytes+1))]){
 const db=new Storage();await db.put('feed:news:mtg:',original);const c=new WeeklyCuration(db,{OPENAI_API_KEY:'fixture-key'},{...options,fetchImpl:async()=>response()});await c.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));assert.deepEqual(await db.get('feed:news:mtg:'),original);assert.equal((await db.get('attempt:news:mtg:')).status,'failed');
 if((await db.get('budget')).inputTokens)assert.equal((await db.get('budget')).inputTokens,11,'usage audited even for malformed editorial JSON');
}
// A paused old-week request cannot overwrite the new week's ledger or snapshot.
const raceDb=new Storage();let releaseOld,startedOld;const waitingOld=new Promise(r=>startedOld=r),oldBlock=new Promise(r=>releaseOld=r);
const oldRun=new WeeklyCuration(raceDb,{}, {...options,now:()=>now-7*864e5,collectNews:async()=>{startedOld();await oldBlock;return snapshot({...story(),publishedAt:new Date(now-8*864e5).toISOString()});}});
const oldPending=oldRun.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));await waitingOld;
const newRun=new WeeklyCuration(raceDb,{},options);await newRun.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));const currentSnapshot=await raceDb.get('feed:news:mtg:');releaseOld();await oldPending;assert.deepEqual(await raceDb.get('feed:news:mtg:'),currentSnapshot);assert.equal((await raceDb.get('attempt:news:mtg:')).week,curationWeek(now));
const first=new WeeklyCuration(new Storage(),{}, {...options,now:()=>Date.parse('2026-10-19T02:00:00Z')});assert.equal((await (await first.fetch(new Request('https://internal/weekly/read?kind=news&game=mtg'))).json()).nextCheckAt,'2026-10-19T06:17:00.000Z');assert.equal((await (await newRun.fetch(new Request('https://internal/weekly/read?kind=news&game=mtg'))).json()).nextCheckAt,'2026-10-26T06:17:00.000Z');
// Scheduler dispatch exercises the real durable controller, with public source-only mocks.
const cronDb=new Storage(),cron=new WeeklyCuration(cronDb,{},options);const cronEnv={AI_REVIEW_LIMITS:{idFromName:n=>n,get:n=>{assert.equal(n,'public-weekly-curation-v1');return{fetch:req=>cron.fetch(typeof req==='string'?new Request(req):req)}}}};
const scheduled=await scheduledWeeklyCuration(cronEnv,{now,loadMtg:async format=>({...source,format,decks:source.decks.map(d=>({...d,player:'private fixture player'}))}),fetchImpl:async(u,init)=>{assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');if(u.startsWith('https://play.limitlesstcg.com/'))return Response.json([]);if(u.startsWith('https://ygoprodeck.com/'))return Response.json([]);assert.fail('unexpected source URL '+u);}});assert.equal(scheduled.attempted,14);assert.equal((await scheduledWeeklyCuration(cronEnv,{now,fetchImpl:async()=>assert.fail('second cron does not fetch')})).attempted,0);
// Existing browser caches adopt the weekly endpoint once, then respect backoff;
// a successful weekly selection cannot be undone by re-appending rejected old rows.
const memory=new Map(),storageBefore=globalThis.localStorage;globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};memory.set('cardforge-community-v3',JSON.stringify({mtg:{at:now,data:snapshot(story())}}));
const client=await import('./community-feed.js?weekly-adoption=1');assert.equal(client.communityState('mtg').at,0);let gets=0;await client.loadCommunity('mtg',{now,fetchImpl:async()=>{gets++;return Response.json({...snapshot(story()),cadence:'weekly',items:[]});}});assert.equal(client.communityState('mtg').data.items.length,0);const reload=await import('./community-feed.js?weekly-adoption=2');await reload.loadCommunity('mtg',{now:now+1000,fetchImpl:async()=>assert.fail('read backoff persists')});assert.equal(gets,1);globalThis.localStorage=storageBefore;
console.log('PASS: all hard budget limits, malformed/oversized response retention, usage audit, rollover race, actual scheduler/DO due gating, truthful 06:17 checks and one-time client adoption.');
// Pre-cron visits expire after the publication grace, with persisted bounded backoff.
{
 const before=globalThis.localStorage,mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)};
 const pre=Date.parse('2026-10-19T02:00:00Z'),due=Date.parse('2026-10-19T06:17:00Z');
 const c=await import('./community-feed.js?first-cron-expiry=1');let reads=0;
 const get=async()=>{reads++;return Response.json({game:'mtg',cadence:'weekly',status:'unavailable',items:[],nextCheckAt:new Date(due).toISOString()});};
 await c.loadCommunity('mtg',{now:pre,fetchImpl:get});
 const reloaded=await import('./community-feed.js?first-cron-expiry=2');
 await reloaded.loadCommunity('mtg',{now:due+4*60000,fetchImpl:get});assert.equal(reads,1);
 await reloaded.loadCommunity('mtg',{now:due+5*60000,fetchImpl:get});assert.equal(reads,2,'first shared cron may be read without waiting24h');
 await reloaded.loadCommunity('mtg',{now:due+6*60000,fetchImpl:get});assert.equal(reads,2,'past nextCheckAt never causes a visitor retry loop');
 globalThis.localStorage=before;
}
// An overall deadline returns even when a public source ignores cancellation;
// unclaimed feeds stay due and no late completion starts a provider attempt.
for(const blocked of ['source','refresh']){
 let release,claims=0,sourceSignal;
 const hold=new Promise(r=>release=r),specs=curationPlan().filter(x=>blocked==='source'?x.kind==='meta'&&x.game==='mtg':x.kind==='news').slice(0,2);
 const gate={fetch:async request=>{const u=new URL(request.url);if(u.pathname.endsWith('/due'))return Response.json({week:curationWeek(now),due:specs});claims++;if(blocked==='refresh')await hold;return Response.json({status:'ready'});}};
 const env={AI_REVIEW_LIMITS:{idFromName:x=>x,get:()=>gate}};
 const result=await scheduledWeeklyCuration(env,{now,overallMs:15,loadMtg:async(format,opts)=>{sourceSignal=opts.signal;await hold;return {...source,format};}});
 assert.equal(result.status,'deadline');assert.equal(claims,blocked==='source'?0:1);if(sourceSignal)assert(sourceSignal.aborted);
 release();await new Promise(r=>setTimeout(r,5));assert.equal(claims,blocked==='source'?0:1,'no later feed claimed after schedule deadline');
}
console.log('PASS: first-cron cache expiry with backoff and one overall scheduler deadline preserve unclaimed feeds and prevent late attempts.');
// Real durable controller, not a gate mock: delayed sources cannot start paid AI
// after either request abort or an absolute deadline crossing a DO boundary.
for(const mode of ['abort','absolute']){
 const db=new Storage();let releaseSource,sourceStarted,paid=0,clock=now;
 const waiting=new Promise(r=>sourceStarted=r),held=new Promise(r=>releaseSource=r),abort=new AbortController();
 const c=new WeeklyCuration(db,{OPENAI_API_KEY:'fixture-key'},{now:()=>clock,collectNews:async()=>{sourceStarted();await held;return snapshot(story());},fetchImpl:async()=>{paid++;assert.fail('provider must not start after deadline');}});
 const req=new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST',signal:abort.signal,headers:{'X-Weekly-Deadline':String(now+100)}});
 const run=c.fetch(req);await waiting;if(mode==='abort')abort.abort();else clock=now+101;releaseSource();await run;
 assert.equal(paid,0);assert.equal(await db.get('budget'),undefined);assert.equal((await db.get('attempt:news:mtg:')).status,'failed','claimed attempt stays recorded without retry');
 await c.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST'}));assert.equal(paid,0,'new request does not retry the claimed week');
}
{
 const db=new Storage();let paid=0;
 const c=new WeeklyCuration(db,{OPENAI_API_KEY:'fixture-key'},{now:()=>now,collectNews:async()=>assert.fail('expired unclaimed source must remain due'),fetchImpl:async()=>{paid++;}});
 await c.fetch(new Request('https://internal/weekly/refresh?kind=news&game=mtg',{method:'POST',headers:{'X-Weekly-Deadline':String(now-1)}}));
 assert.equal(await db.get('attempt:news:mtg:'),undefined);assert.equal(paid,0);
}
console.log('PASS: actual durable refresh preserves deadline/abort across delayed sources, stops late paid calls and leaves unclaimed feeds due.');
