// Actual server/client contracts with synthetic MediaWiki responses. No live
// provider access, private account data, article corpus or image is downloaded.
import assert from 'node:assert/strict';
import {lookupGameWikiReference,wikiReferenceRoute,WIKI_ARTICLE_POLICY as P} from './mtg-wiki-reference.js';
import {readGameWikiArticle,readGameWikiReference} from './mtg-wiki-client.js';
import {WIKI_SOURCES} from './wiki-sources.js';
const json=data=>Response.json(data);
const words=Array.from({length:100},(_,i)=>'fixtureword'+i).join(' ');
const parsed=(title='Bloodlust',html=`<p>${words}</p><h2 id="Plan">Plan</h2><p><a href="/page/Bloodthirst">Read Bloodthirst</a>.</p>`)=>({parse:{title,pageid:100,revid:200,text:html,sections:[{line:'Plan',level:'2',anchor:'Plan'}],images:[],categories:[]}});
const short=(title='Bloodlust')=>({batchcomplete:true,query:{pages:[{title,pageid:100,ns:0,lastrevid:200,extract:words,index:1}]}});
let calls=[];
const fetcher=async(url,init)=>{
 const u=new URL(url);calls.push(u);assert.equal(u.origin,'https://mtg.wiki');assert.equal(u.pathname,'/api.php');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.headers.Accept,'application/json');assert.match(init.headers['User-Agent'],/^CardStashy\//);assert(!('Cookie' in init.headers)&&!('Authorization' in init.headers));
 return json(u.searchParams.get('action')==='parse'?parsed():short());
};
const article=await lookupGameWikiReference({game:'mtg',mode:'article',title:'Bloodlust'},{fetcher});
assert.equal(article.status,'available');assert.equal(article.mode,'article');assert.equal(calls.length,1);assert.equal(calls[0].searchParams.get('action'),'parse');assert(calls[0].searchParams.get('prop').includes('text'));
assert(JSON.stringify(article.article).includes(words));assert.equal(article.article.source,article.source);assert.equal(article.source.revision,200);assert.match(article.source.attribution,/contributors/);assert.match(article.source.license,/NC-SA/);
const ai=await lookupGameWikiReference({game:'mtg',title:'Bloodlust'},{fetcher});assert.equal(calls.length,2);assert(ai.extract.split(/\s+/).length<=25);assert.equal(ai.article,undefined,'AI/default read cannot accidentally receive a full article');
assert.equal((await lookupGameWikiReference({game:'mtg',mode:'article',title:'Bloodlust'},{fetcher})).cache.hit,true);assert.equal(calls.length,2,'Article/excerpt cache entries are separate');

let queryCalls=0;
const query=await lookupGameWikiReference({game:'ptcg',mode:'article',query:'damage'},{fetcher:async(url)=>{const u=new URL(url);assert.equal(u.origin,WIKI_SOURCES.ptcg.origin);queryCalls++;if(u.searchParams.get('action')==='query'){assert.match(u.searchParams.get('gsrsearch'),/TCG/);return json(short('Damage (TCG)'));}assert.equal(u.searchParams.get('page'),'Damage (TCG)');return json(parsed('Damage (TCG)','<p>Paper TCG damage.</p>'));}});
assert.equal(queryCalls,2);assert.equal(query.article.title,'Damage (TCG)');assert.equal(query.topicScope,'tcg');assert.equal(query.source.game,'ptcg');

const artHtml='<p>Article lead.</p><figure><a href="/page/File:Art.png"><img src="https://files.mtg.wiki/Art.png" width="300" height="400" alt="Art"></a><figcaption>Visible caption.</figcaption></figure>';
let artCalls=0;
const credited=await lookupGameWikiReference({game:'mtg',mode:'article',title:'Art'},{fetcher:async(url)=>{
 const u=new URL(url);artCalls++;if(u.searchParams.get('action')==='parse')return json(parsed('Art',artHtml));
 assert.equal(u.searchParams.get('prop'),'imageinfo');assert.equal(u.searchParams.get('titles'),'File:Art.png');
 return json({query:{pages:[{ns:6,title:'File:Art.png',imageinfo:[{descriptionurl:'https://mtg.wiki/page/File:Art.png',extmetadata:{Artist:{value:'<b>Fixture Artist</b><script>secret()</script>'},Credit:{value:'Source collection'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]}]}});
}});
assert.equal(artCalls,2);assert.equal(credited.article.images[0].attribution,'Fixture Artist · Source collection');assert.equal(credited.article.images[0].license,'CC BY-SA 4.0');assert(!JSON.stringify(credited).includes('secret()'));
const creditHang=async(url,init)=>new URL(url).searchParams.get('action')==='parse'?json(parsed('Slow credits',artHtml)):new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
const ready=await lookupGameWikiReference({game:'mtg',mode:'article',title:'Slow credits'},{fetcher:creditHang,timeoutMs:25});assert.equal(ready.status,'available','Credit timeout must preserve the fetched article');assert(ready.article.lead.length);
const controller=new AbortController();let started;
const begin=new Promise(r=>started=r),cancelFetch=async(url,init)=>{if(new URL(url).searchParams.get('action')==='parse')return json(parsed('Cancel',artHtml));started();return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));};
const pending=lookupGameWikiReference({game:'mtg',mode:'article',title:'Cancel'},{fetcher:cancelFetch,signal:controller.signal});await begin;controller.abort();const cancelled=await pending;assert.equal(cancelled.status,'unavailable');assert.equal(cancelled.reason,'cancelled');assert.equal(cancelled.mode,'article');assert.equal(cancelled.article,null);

let release,excerptStarted;
const active=new Promise(r=>excerptStarted=r),concurrent=async(url)=>{const u=new URL(url);if(u.searchParams.get('action')==='parse')return json(parsed('Click topic'));excerptStarted();return new Promise(r=>release=()=>r(json(short('Daily'))));};
const excerpt=lookupGameWikiReference({game:'mtg',daily:true},{fetcher:concurrent});await active;
const clicked=await lookupGameWikiReference({game:'mtg',mode:'article',title:'Click topic'},{fetcher:concurrent});assert.equal(clicked.status,'available','A daily/typeahead excerpt cannot block an explicitly opened article');release();await excerpt;

for(const [name,f] of [['403',async()=>new Response('Forbidden',{status:403})],['redirect',async()=>new Response('',{status:302,headers:{Location:'https://evil.test'}})],['HTML challenge',async()=>new Response('<html>challenge</html>',{headers:{'Content-Type':'text/html'}})],['oversize',async()=>new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':String(P.maxResponseBytes+1)}})]]){
 let reads=0;const out=await lookupGameWikiReference({game:'ygo',mode:'article',title:name},{fetcher:async(...args)=>{reads++;return f(...args);}});assert.equal(out.status,'unavailable',name);assert.equal(out.mode,'article');assert.equal(out.article,null);assert.equal(reads,1,'No alternate endpoints or HTML scrape fallback');
}
const absent=await lookupGameWikiReference({game:'mtg',mode:'article',title:'Missing'},{fetcher:async()=>json({error:{code:'missingtitle'}})});assert.equal(absent.status,'not-found');assert.equal(absent.article,null);
const already=new AbortController();already.abort();assert.equal((await lookupGameWikiReference({game:'mtg',mode:'article',title:'Canceled'},{signal:already.signal,fetcher:()=>assert.fail('No canceled read')})).mode,'article');

let sent;
const client=await readGameWikiArticle('mtg','Bloodlust',{query:true,fetcher:async(path,init)=>{sent={path,init,body:JSON.parse(init.body)};return json(article);}});
assert.equal(client.mode,'article');assert.equal(sent.path,'/api/reference/wiki');assert.deepEqual(sent.body,{game:'mtg',mode:'article',query:'Bloodlust'});assert.equal(sent.init.credentials,'omit');assert.deepEqual(sent.init.headers,{'Content-Type':'application/json'});
await assert.rejects(readGameWikiArticle('mtg','Bloodlust',{fetcher:async()=>json({...ai,mode:'article'})}),/incomplete/,'A short extract cannot masquerade as a reader article');
await assert.rejects(readGameWikiArticle('ptcg','Damage',{fetcher:async()=>json(article)}),/different game/,'A stale/cross-game response cannot become the selected game’s article');
await readGameWikiReference('mtg','Bloodlust',{fetcher:async(_,init)=>{assert.equal(JSON.parse(init.body).mode,undefined);return json(ai);}});
const request=body=>new Request('https://cardstashy.com/api/reference/wiki',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const route=await wikiReferenceRoute(request({game:'mtg',mode:'article',title:'Bloodlust'}),{fetcher:async()=>json(parsed())});assert.equal(route.status,200);assert.equal((await route.json()).mode,'article');
for(const body of [{game:'mtg',mode:'html',title:'Bloodlust'},{game:'mtg',mode:'article',title:'Bloodlust',collection:['private']},{game:'mtg',mode:'article',title:'https://evil.test'}])assert.equal((await wikiReferenceRoute(request(body),{fetcher:()=>assert.fail('Invalid article request cannot fetch')})).status,400);
let cacheReads=0;const smallFetcher=async(url)=>{cacheReads++;return json(parsed(new URL(url).searchParams.get('page'),'<p>Small cache fixture.</p>'));};
for(let i=0;i<P.maxCacheEntries+1;i++)await lookupGameWikiReference({game:'mtg',mode:'article',title:'Cache '+i},{fetcher:smallFetcher});
const before=cacheReads;assert.equal((await lookupGameWikiReference({game:'mtg',mode:'article',title:'Cache 0'},{fetcher:smallFetcher})).cache.hit,false);assert.equal(cacheReads,before+1,'Full articles have a smaller bounded cache than excerpts');
console.log('PASS: explicit full article mode, query resolution, attributed image metadata, isolated AI/excerpt caches and concurrency, privacy-only client/route, blocked-provider honesty, cancellation and readable-article preservation after credit timeout.');
