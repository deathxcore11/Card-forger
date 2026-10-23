import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NEWS_EDITION,editionStories,editionArtwork} from './community-edition.js';
import {communityArtwork} from './community-art.js';
import {safeNewsArticle,safeNewsImage} from './community-sources.js';
import {WeeklyCuration} from './weekly-curation.js';
import {communitySlides,communityState} from './community-feed.js';
const now=Date.parse('2026-10-23T12:00:00Z');
for(const game of ['mtg','ptcg','ygo']){
 const [row]=editionStories(game,now);assert(row);assert.equal(safeNewsArticle(row.url,game,row.sourceId),row.url);
 assert.equal(editionStories(game,Date.parse(NEWS_EDITION.expiresAt)).length,0,'old edition expires at next week');
 assert.equal(editionStories(game,now-864e5).length,0,'cannot publish before verification');
 assert.equal(row.fetchedAt,NEWS_EDITION.checkedAt,'page visits never rewrite check date');
 const art=editionArtwork(game,row);assert(fs.statSync(art).size<200000,'mobile art is bounded');
 assert.match(communityArtwork(game,row),/data-art-kind="ai-illustration"/);assert.match(communityArtwork(game,row),/AI illustration/);
 assert(!communityArtwork(game,row).includes('community-art-scan'),'editorial landscape is not a Pokémon card scan');
 assert.equal(editionArtwork(game,{...row,url:row.url+'-different-story'}),'');assert.equal(editionArtwork(game,{...row,sourceId:'attacker'}),'');
 assert.equal(safeNewsImage('https://attacker.invalid/a.png',game,row.sourceId,row.url),'');
 communityState(game).data={game,items:[],status:'unavailable'};
 assert(communitySlides(game,{now}).some(x=>x.url===row.url),'empty shared feed still has reviewed real story');
 communityState(game).data.items=[row];assert(!communitySlides(game,{now:Date.parse(NEWS_EDITION.expiresAt)}).some(x=>x.url===row.url),'offline cached edition also expires');
}
class Storage {constructor(){this.rows=new Map();this.queue=Promise.resolve();}async get(k){return structuredClone(this.rows.get(k));}async put(k,v){this.rows.set(k,structuredClone(v));}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p;}}
const db=new Storage();let clock=Date.parse('2026-10-19T08:00:00Z'),sources=0,paid=0,fail=true;
const spec='kind=news&game=mtg';
const c=new WeeklyCuration(db,{OPENAI_API_KEY:'fixture'}, {now:()=>clock,collectNews:async()=>{sources++;if(fail)throw Error('source down');const [row]=editionStories('mtg',now);return {status:'ready',items:[{...row,publishedAt:'2026-10-19',fetchedAt:new Date(clock).toISOString()}]};},fetchImpl:async()=>{paid++;throw Error('AI outage');}});
const refresh=()=>c.fetch(new Request('https://internal/weekly/refresh?'+spec,{method:'POST'}));
await refresh();await refresh();assert.equal(sources,1);assert.equal(paid,0);
clock+=864e5;fail=false;
const due=await(await c.fetch(new Request('https://internal/weekly/due'))).json();assert(due.due.some(x=>x.kind==='news'&&x.game==='mtg'));
await Promise.all(Array.from({length:5},refresh));assert.equal(sources,2);assert.equal(paid,0,'recovery is source-only, no second weekly AI opportunity');
const recovered=await(await c.fetch(new Request('https://internal/weekly/read?'+spec))).json();assert.equal(recovered.items.length,1);assert.equal(recovered.status,'ready');assert.equal(recovered.nextCheckAt,'2026-10-21T06:17:00.000Z');
clock=now;const fresh=new WeeklyCuration(new Storage(),{}, {now:()=>clock,fetchImpl:()=>assert.fail('read never calls provider'),collectNews:()=>assert.fail('read never fetches')});
const seeded=await(await fresh.fetch(new Request('https://internal/weekly/read?'+spec))).json();assert.equal(seeded.status,'ready');assert(!seeded.items[0].stale);
clock=Date.parse(NEWS_EDITION.expiresAt);assert.equal((await(await fresh.fetch(new Request('https://internal/weekly/read?'+spec))).json()).items.length,0);
console.log('PASS: dated cross-game news, expiry, exact-story AI art, bounded mobile assets, no fake card scan, daily outage recovery and read-only fallback.');
