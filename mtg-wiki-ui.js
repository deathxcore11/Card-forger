import {esc} from './ui.js';
import {buildGameWikiReference,resolveGameConcept,searchGameConcepts,gameConcepts} from './game-wiki-knowledge.js';
import {WIKI_SOURCES,wikiSourceForGame} from './wiki-sources.js';
import {readGameWikiReference,readGameWikiDaily,readGameWikiArticle} from './mtg-wiki-client.js';
import {wikiArticleMarkup,bindWikiArticleImages} from './game-wiki-article.js';
import {dailyDate} from './daily-clock.js';
import {searchEmblem} from './home-search.js';
import {aiOrb} from './ai-ui.js';

// Public game topics only. This module never reads an account, collection,
// deck, chat or auth token. Only a successful public daily article is stored.
const CACHE_LIMIT=30,CACHE_MS=5*60*1000,FAILURE_MS=60*1000;
const responses=new Map();
const clean=value=>typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/g,' '):'';
const words25=value=>clean(value).split(/\s+/u).filter(Boolean).slice(0,25).join(' ');
const gameName=game=>({mtg:'Magic',ptcg:'Pokémon',ygo:'Yu-Gi-Oh!'}[game]||'Card game');
const provider=game=>wikiSourceForGame(game);
export function safeGameWikiUrl(value,game='mtg'){
 try{const url=new URL(value),source=provider(game),hosts=source?.allowedHosts||[new URL(source.origin).hostname];return url.protocol==='https:'&&url.origin===source.origin&&hosts.includes(url.hostname)&&!url.username&&!url.password&&(url.pathname==='/'||url.pathname.startsWith('/page/')||url.pathname.startsWith('/wiki/')||url.pathname==='/index.php')?url.href:'';}catch{return '';}
}
export const safeMtgWikiUrl=value=>safeGameWikiUrl(value,'mtg');
const link=(url,label,classes='link',game='mtg')=>safeGameWikiUrl(url,game)?`<a class="${classes}" href="${esc(safeGameWikiUrl(url,game))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';
const readerTopic=value=>{const topic=clean(value);return topic&&topic.length<=180&&!/[\u0000-\u001f\u007f<>|{}\[\]\\]/u.test(String(value))&&!/(?:\w+:\/\/|^\s*\/\/)/u.test(topic)&&!/^\s*(?:special|media|file|image|user|user talk|talk|template|template talk|module|mediawiki|project|mtg wiki|bulbapedia|yu-gi-oh!? wiki|category|help)\s*:/i.test(topic)?topic:'';};
const readerReference=(game,topic)=>readerTopic(topic)?{title:clean(topic),url:provider(game).articlePrefix+encodeURIComponent(clean(topic).replaceAll(' ','_'))}:null;
const topicOf=(card,state)=>clean(state?.topic||card?.name);
const fallbackOf=(card,state)=>buildGameWikiReference(state?.game||card?.game||'mtg',topicOf(card,state));

function localNotes(card,state){
 const game=state?.game||card?.game||'mtg',topic=topicOf(card,state),exact=resolveGameConcept(game,topic),matches=exact?[exact]:state?.mode==='query'?searchGameConcepts(game,topic,{limit:4}):[];
 if(!matches.length)return '';
 return `<section class="panel"><p class="eyebrow">CardStashy topic notes</p>${matches.map(concept=>`<h3>${esc(concept.label)}</h3><p>${esc(concept.summary)}</p><ul>${(concept.prerequisites||[]).map(text=>`<li>${esc(text)}</li>`).join('')}</ul><p class="foot">Original CardStashy summary · ${link(concept.source.url,'Read '+concept.label+' on '+provider(game).name+'','link',game)}</p>`).join('')}</section>`;
}
function retrievedRows(response,game='mtg'){
 if(response?.status!=='available'||response.game&&response.game!==game)return [];
 const rows=Array.isArray(response.results)&&response.results.length?response.results:[{source:response.source,extract:response.extract}],seen=new Set();
 return rows.filter(row=>{
  const url=safeGameWikiUrl(row?.source?.url,game);if(!url||!words25(row.extract)||seen.has(url))return false;seen.add(url);return true;
 }).slice(0,3);
}
export function mtgWikiResults(card,state={}){
 const game=state.game||card?.game||'mtg',sourceInfo=provider(game),reference=fallbackOf(card,state),response=state.response,rows=retrievedRows(response,game),status=state.loading?'loading':response?.status||state.status||'idle';
 const lead=status==='loading'?'Looking up this '+gameName(game)+' topic…':status==='available'&&rows.length?'Short excerpts retrieved from '+sourceInfo.name+'.':status==='not-found'?'No article was found for this topic.':status==='unavailable'||status==='available'&&!rows.length?sourceInfo.name+' could not be retrieved here'+(Number.isInteger(response?.httpStatus)?' (HTTP '+response.httpStatus+')':'')+'. Local notes and reading links remain available.':state.message||'Open a card article or search a game topic. An external reading link alone is not a retrieved article.';
 return `<div data-mtg-wiki-results aria-busy="${!!state.loading}"><p class="small ${status==='unavailable'?'warn-text':'muted'}" role="status" aria-live="polite">${esc(lead)}</p>${localNotes(card,state)}${rows.map(row=>{
  const source=row.source,date=Date.parse(source.checkedAt),when=Number.isFinite(date)?new Date(date).toLocaleDateString():'';
  return `<section class="panel"><h3>${esc(source.title||topicOf(card,state))}</h3><p class="small">Short article excerpt</p><blockquote>${esc(words25(row.extract))}</blockquote><p class="foot">${esc(sourceInfo.publisher)} · community reference${when?' · retrieved '+esc(when):''}. ${link(source.url,'Open on '+sourceInfo.name+'','link',game)}${safeGameWikiUrl(source.historyUrl,game)?' · '+link(source.historyUrl,'Article history','link',game):''}</p></section>`;
 }).join('')}${reference?`<div class="actions wrap">${link(reference.url,'Open '+reference.title+' on '+sourceInfo.name+'','btn ghost small',game)}<button type="button" class="btn ghost small" data-act="mtgWikiRetry" ${state.loading?'disabled':''}>${response?'Retry lookup':'Look up article'}</button>${state.loading?'<button type="button" class="btn ghost small" data-act="mtgWikiCancel">Cancel lookup</button>':''}</div>${!rows.length?'<p class="foot">The reading link’s article contents have not been verified here.</p>':''}`:''}<p class="foot">Community reference, not an official card ruling. ${esc(sourceInfo.scope)}</p></div>`;
}
export function mtgWikiPanel(card,ctx={}){
 const state=ctx.wiki||{},value=state.query??card?.name??'';
 return `<section class="card-rulings-section" data-mtg-wiki-root><h3>Magic Wiki</h3><p class="small muted">Read about this card, mechanics, players and other Magic topics.</p><form data-mtg-wiki-form><label class="field">Magic topic<input type="search" data-mtg-wiki-query data-focus-key="mtg-wiki-query" aria-label="Search Magic Wiki topics" maxlength="160" autocomplete="off" value="${esc(value)}" placeholder="Card name, Bloodthirst, Voltron…"></label><div class="actions wrap"><button type="submit" class="btn ghost small">Search Wiki</button><button type="button" class="btn ghost small" data-act="mtgWikiCard">This card</button></div></form>${mtgWikiResults(card,state)}</section>`;
}
export function mtgWikiCredit(){
 return Object.values(WIKI_SOURCES).map(source=>`<li><b>${esc(gameName(source.game))} reference:</b> ${link(source.origin,source.name,'link',source.game)} · ${esc(source.publisher)}. CardStashy topic notes are original summaries; retrieved excerpts cite their articles. ${link(source.copyrightPolicyUrl,'Copyright policy','link',source.game)}${source.license?` · ${esc(source.license)}`:''}${source.licenseUrl?` · <a href="${esc(source.licenseUrl)}" target="_blank" rel="noopener noreferrer">License details</a>`:''}. Images and imported material may have separate terms.</li>`).join('');
}

export function createMtgWikiController({context,card,root,isOpen,scope=()=>()=>true,fetcher=fetch,now=Date.now,game='mtg',isEligible=ctx=>ctx?.type==='card'&&ctx.tab==='wiki'}={}){
 let active=null,generation=0;const wired=new WeakSet();
 const current=ctx=>context?.()===ctx&&isEligible(ctx)&&isOpen?.()!==false;
 const state=ctx=>ctx.wiki||=( {game,query:card(ctx)?.name||ctx.name||'',topic:card(ctx)?.name||ctx.name||'',mode:'title',status:'idle',started:false,loading:false} );
 const paint=ctx=>{
  if(!current(ctx))return;const node=root?.()?.querySelector?.('[data-mtg-wiki-results]');if(node)node.outerHTML=mtgWikiResults(card(ctx),state(ctx));
 };
 const cancel=({notify=false}={})=>{
  generation++;if(!active)return;const {ctx,controller}=active;active=null;controller.abort();
  if(ctx.wiki){ctx.wiki.loading=false;ctx.wiki.status='idle';ctx.wiki.message='Lookup cancelled. Local notes and reading links remain available.';}
  if(notify)paint(ctx);
 };
 const lookup=async(input,{retry=false}={})=>{
  const ctx=context?.();if(!current(ctx))return null;
  const mode=input?.query!==undefined?'query':'title',topic=clean(input?.[mode]),reference=buildGameWikiReference(game,topic),s=state(ctx);
  if(!reference){s.message='Enter a card name or a game topic up to 160 characters.';s.status='idle';paint(ctx);return null;}
  cancel();const token=++generation,controller=new AbortController(),valid=scope(),cacheKey=game+':'+mode+':'+topic.toLocaleLowerCase(),cached=responses.get(cacheKey);
  Object.assign(s,{topic,query:topic,mode,started:true,loading:true,status:'loading',message:'',response:null});
  const field=root?.()?.querySelector?.('[data-mtg-wiki-query]');if(field&&field.value!==topic)field.value=topic;
  active={ctx,controller,token};paint(ctx);
  const live=()=>generation===token&&current(ctx)&&valid?.()!==false&&!controller.signal.aborted;
  try{
   let response;
   if(!retry&&cached&&cached.until>now())response=structuredClone(cached.response);
   else{
    response=await readGameWikiReference(game,topic,{query:mode==='query',fetcher,signal:controller.signal});
    if(!live())return null;
    responses.set(cacheKey,{until:now()+(response.status==='available'?CACHE_MS:FAILURE_MS),response:structuredClone(response)});
    while(responses.size>CACHE_LIMIT)responses.delete(responses.keys().next().value);
   }
   if(!live())return null;Object.assign(s,{loading:false,status:response.status,response});paint(ctx);return response;
  }catch(error){
   if(!live())return null;Object.assign(s,{loading:false,status:'unavailable',response:{status:'unavailable'},message:''});paint(ctx);return s.response;
  }finally{if(active?.token===token){active=null;if(s.loading){s.loading=false;s.status='idle';s.message='The card or workspace changed. Try the lookup again.';paint(ctx);}}}
 };
 const mount=()=>{
  const ctx=context?.();if(!current(ctx))return;const s=state(ctx),form=root?.()?.querySelector?.('[data-mtg-wiki-form]');
  if(form&&!wired.has(form)){wired.add(form);form.addEventListener('submit',e=>{e.preventDefault();void lookup({query:form.querySelector('[data-mtg-wiki-query]')?.value||''});});form.addEventListener('input',e=>{if(e.target.matches?.('[data-mtg-wiki-query]'))s.query=e.target.value;});}
  if(!s.started)return lookup({title:card(ctx)?.name||ctx.name||''});
  return null;
 };
 return {mount,lookup,cancel,retry:()=>{const ctx=context?.(),s=ctx&&state(ctx);return s?lookup({[s.mode]:s.topic},{retry:true}):null;},thisCard:()=>{const ctx=context?.();return ctx?lookup({title:card(ctx)?.name||ctx.name||''}):null;}};
}

export const wikiDailyCacheKey=game=>'cardstashy.wiki.daily.v1.'+game;
export const MTG_WIKI_DAILY_CACHE_KEY=wikiDailyCacheKey('mtg');
export function localDailyMtgTopic(at=Date.now(),game='mtg'){
 const date=dailyDate(at),hash=[...date].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0),concepts=gameConcepts(game),concept=concepts[hash%concepts.length]||{label:provider(game).name,summary:'Explore this game’s community reference. A live article has not been retrieved.',source:{url:provider(game).origin}};
 return {date,title:concept.label,summary:concept.summary,url:concept.source.url,source:'CardStashy topic note'};
}
export function mtgWikiDailyMarkup(daily={},at=Date.now(),game='mtg'){
 const row=retrievedRows(daily.response,game)[0],fallback=localDailyMtgTopic(at,game),title=row?.source.title||fallback.title,summary=row?words25(row.extract):fallback.summary,url=row?.source.url||fallback.url;
 const notice=daily.loading?'Finding today’s article…':'';
 return `<section class="home-hero compact ${esc(game)} wiki-daily" data-mtg-wiki-daily data-daily-topic="${esc(title)}" data-daily-date="${esc(daily.response?.dailyDateUTC||fallback.date)}"><img class="hh-art" src="${{mtg:'game-tab-mtg.jpg',ygo:'game-tab-ygo.png',ptcg:'game-tab-ptcg.jpg'}[game]}" alt="" loading="lazy"><div class="hh-shade"></div><div class="hh-body"><p class="eyebrow">${row?'Today’s Wiki article':'Today’s '+gameName(game)+' topic'}</p><h2>${esc(title)}</h2><p>${esc(summary)}</p><div class="actions wrap"><button type="button" class="btn ghost small" data-act="mtgWikiPick" data-wiki-topic="${esc(title)}">Read article</button>${link(url,provider(game).name+'','link',game)}${!row&&!daily.loading?'<button type="button" class="link small" data-act="mtgWikiDailyRetry">Refresh</button>':''}</div>${notice?`<p class="foot" role="status">${esc(notice)}</p>`:''}</div></section>`;
}
const localSuggestions=(query,game='mtg')=>searchGameConcepts(game,query,{limit:6}).map(c=>({title:c.label,url:c.source.url,kind:'local',extract:c.summary}));
const suggestionKey=row=>clean(row.title).toLowerCase();
function suggestionContent(state){
 return `<div class="list compact" id="wikiSuggestionList" role="listbox" aria-label="Wiki topics">${(state.suggestions||[]).map((row,i)=>`<button type="button" class="mini-row" id="wiki-suggestion-${i}" role="option" aria-selected="${i===state.suggestionIndex}" data-wiki-suggestion="${i}"><b>${esc(row.title)}</b><span class="small muted">${row.kind==='wiki'?provider(state.game||'mtg').name:'CardStashy topic'}</span></button>`).join('')}</div>${state.suggestionStatus?`<p class="home-result-status small" role="status">${esc(state.suggestionStatus)}</p>`:''}`;
}
export function mtgWikiPageContent(state={},at=Date.now()){
 const game=state.game||'mtg',sourceInfo=provider(game);
 if(state.view!=='article')return `<div data-wiki-page-content>${mtgWikiDailyMarkup(state.daily,at,game)}</div>`;
 const reference=readerReference(game,state.topic),article=state.response?.game===game||!state.response?.game?state.response:null;
 const renderedArticle=article?.status==='available'&&article.article?wikiArticleMarkup(article,{game}):'';
 const toolbar=`<div class="wiki-reader-toolbar"><button type="button" class="btn ghost small" data-act="mtgWikiHome" aria-label="Wiki home">← Wiki home</button><button type="button" class="btn ghost small" data-act="mtgWikiAsk">Ask about this</button></div>`;
 const content=state.loading?`<section class="wiki-reader-empty" role="status" aria-live="polite"><p class="eyebrow">${esc(sourceInfo.name)}</p><h2>${esc(state.topic)}</h2><p>Opening article…</p></section>`:renderedArticle||`<section class="wiki-reader-empty"><p class="eyebrow">${esc(sourceInfo.name)}</p><h2>${esc(state.topic)}</h2><p role="status">${state.status==='not-found'?'No article found. Try another name or choose a suggested topic.':'This article couldn’t load. Try again or read it at the source.'}</p><div class="actions wrap"><button type="button" class="btn ghost small" data-act="mtgWikiRetry">Try again</button>${reference?link(reference.url,'Read on '+sourceInfo.name+'','link',game):''}</div></section>`;
 return `<div data-wiki-page-content data-wiki-view="article" aria-busy="${!!state.loading}">${toolbar}${content}</div>`;
}
export function mtgWikiPageMarkup(state={}){
 const shown=!!state.suggestionsOpen,game=state.game||'mtg',sourceInfo=provider(game),example={mtg:'Lifelink, a card, a player, a mechanic…',ptcg:'Pokémon ex, retreat, a Trainer, a card…',ygo:'Synchro Summon, a card, an archetype…'}[game];
 return `<div class="wiki-page" data-mtg-wiki-page><div class="page-head wiki-page-head"><div><p class="eyebrow">${esc(gameName(game))} · ${esc(sourceInfo.name)}</p><h1>Wiki</h1></div><button class="chip tool-chip" data-act="go" data-to="#sets">◈ Sets</button></div><form data-mtg-wiki-form class="wiki-search-form"><div class="home-search-wrap"><div class="home-search-pill"><span class="home-ai-label" id="wiki-search-label">Wiki &amp; answers</span><input id="wikiQ" data-mtg-wiki-query type="search" role="combobox" aria-label="Search ${esc(gameName(game))} Wiki topics" aria-describedby="wiki-search-label" aria-autocomplete="list" aria-expanded="${shown}" aria-controls="wikiSuggestionList" autocomplete="off" maxlength="180" placeholder="${esc(example)}" value="${esc(state.query||'')}"><button type="submit" class="home-search-submit" aria-label="Search Wiki">${searchEmblem()}</button></div><button type="button" class="home-ai-submit" data-act="mtgWikiAsk" aria-label="Ask CardStashy about this ${esc(gameName(game))} topic">${aiOrb()}</button></div><div id="wikiSuggestions" class="home-suggestions wiki-suggestions" ${shown?'':'hidden'}>${suggestionContent(state)}</div></form>${mtgWikiPageContent(state)}</div>`;
}

export function createMtgWikiPageController({active=()=>false,root,scope=()=>()=>true,fetcher=fetch,now=Date.now,storage,game='mtg',navigate}={}){
 const state={game,view:'home',query:'',topic:'',mode:'title',status:'idle',loading:false,response:null,suggestions:[],suggestionsOpen:false,suggestionIndex:-1,suggestionStatus:'',daily:{attempted:false,loading:false,response:null}};
 const forms=new WeakSet();let store=null,timer=null,suggestionRevision=0,suggestionAbort=null,dailyRevision=0,dailyAbort=null,articleRevision=0,articleAbort=null,pendingTitle=null,routeKey='',imageCleanup=null;
 try{store=storage??globalThis.localStorage;}catch{}
 try{const raw=store?.getItem(wikiDailyCacheKey(game));if(raw&&raw.length<=32768){const saved=JSON.parse(raw);if(saved.game===game&&saved.expiresAt>now()&&saved.expiresAt-saved.storedAt<=86400000&&saved.storedAt<=now()+300000&&retrievedRows(saved.response,game).length){Object.assign(state.daily,{attempted:true,response:saved.response,expiresAt:saved.expiresAt});}}}catch{}
 const paintContent=()=>{if(!active())return;const node=root?.()?.querySelector?.('[data-wiki-page-content]');if(node){imageCleanup?.();node.outerHTML=mtgWikiPageContent(state,now());imageCleanup=bindWikiArticleImages(root?.());}};
 const paintDaily=()=>{if(!active()||state.view!=='home')return;const node=root?.()?.querySelector?.('[data-mtg-wiki-daily]');if(node)node.outerHTML=mtgWikiDailyMarkup(state.daily,now(),game);};
 const paintSuggestions=()=>{
  if(!active())return;const box=root?.()?.querySelector?.('#wikiSuggestions'),field=root?.()?.querySelector?.('#wikiQ');
  if(box){box.hidden=!state.suggestionsOpen;box.innerHTML=suggestionContent(state);}if(field){field.setAttribute('aria-expanded',String(state.suggestionsOpen));if(state.suggestionIndex>=0)field.setAttribute('aria-activedescendant','wiki-suggestion-'+state.suggestionIndex);else field.removeAttribute('aria-activedescendant');}
 };
 const closeSuggestions=()=>{clearTimeout(timer);timer=null;suggestionRevision++;suggestionAbort?.abort();suggestionAbort=null;state.suggestionsOpen=false;state.suggestionIndex=-1;paintSuggestions();};
 const pauseDaily=()=>{if(dailyAbort){dailyRevision++;dailyAbort.abort();dailyAbort=null;state.daily.loading=false;if(!state.daily.response)state.daily.attempted=false;}};
 const cancelArticle=({notify=false}={})=>{articleRevision++;articleAbort?.abort();articleAbort=null;if(state.loading){state.loading=false;state.status='idle';if(notify)paintContent();}};
 const lookup=async(title,{query=false,retry=false}={})=>{
  const topic=clean(title);if(!active()||!topic)return null;
  if(!readerTopic(title)){cancelArticle();closeSuggestions();Object.assign(state,{view:'article',topic:topic.slice(0,180),query:topic.slice(0,180),loading:false,status:'not-found',response:null});paintContent();return null;}
  closeSuggestions();pauseDaily();cancelArticle();const revision=++articleRevision,abort=new AbortController(),valid=scope(),cacheKey=game+':article:'+(query?'query:':'title:')+topic.toLocaleLowerCase(),cached=responses.get(cacheKey);articleAbort=abort;
  Object.assign(state,{view:'article',topic,query:topic,mode:query?'query':'title',loading:true,status:'loading',response:null});const field=root?.()?.querySelector?.('#wikiQ');if(field)field.value=topic;paintContent();
  const live=()=>active()&&revision===articleRevision&&!abort.signal.aborted&&valid?.()!==false;
  try{
   let response;
   if(!retry&&cached&&cached.until>now())response=structuredClone(cached.response);
   else{response=await readGameWikiArticle(game,topic,{query,fetcher,signal:abort.signal});if(!live())return null;responses.set(cacheKey,{until:now()+(response.status==='available'?CACHE_MS:FAILURE_MS),response:structuredClone(response)});while(responses.size>CACHE_LIMIT)responses.delete(responses.keys().next().value);}
   if(!live())return null;Object.assign(state,{loading:false,status:response.status,response});if(response.status==='available'&&response.article?.title){const keepDraft=state.query!==topic||field&&clean(field.value)!==topic;state.topic=clean(response.article.title);if(!keepDraft){state.query=state.topic;if(field)field.value=state.topic;}}paintContent();return response;
  }catch{if(!live())return null;Object.assign(state,{loading:false,status:'unavailable',response:{game,status:'unavailable'}});paintContent();return state.response;}
  finally{if(articleAbort===abort){articleAbort=null;if(state.loading){state.loading=false;state.status='idle';paintContent();}}}
 };
 const open=async(topic,options={})=>{
  if(!navigate)return lookup(topic,options);
  const field=root?.()?.querySelector?.('#wikiQ'),document=field?.ownerDocument||globalThis.document,restore=!!field&&document?.activeElement===field,selection=restore?{start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection}:null,valid=scope();
  const moved=await navigate(clean(topic),options);
  // The app makes the page inert while installing a route, so focus must be
  // restored after navigation settles rather than during the render itself.
  if(moved!==false&&restore&&active()&&valid?.()!==false){const next=root?.()?.querySelector?.('#wikiQ');next?.focus?.({preventScroll:true});if(Number.isInteger(selection.start))try{next?.setSelectionRange?.(selection.start,selection.end,selection.direction);}catch{}}
  return moved;
 };
 const suggest=query=>{
  clearTimeout(timer);suggestionAbort?.abort();suggestionAbort=null;const revision=++suggestionRevision,q=clean(query);state.query=query;state.suggestionIndex=-1;state.suggestions=q?localSuggestions(q,game):[];state.suggestionsOpen=!!q;state.suggestionStatus='';paintSuggestions();if(q)pauseDaily();
  if(q.length<3)return;
  timer=setTimeout(async()=>{
   timer=null;if(!active()||revision!==suggestionRevision)return;const abort=new AbortController(),valid=scope();suggestionAbort=abort;
   try{
    const response=await readGameWikiReference(game,q,{query:true,fetcher,signal:abort.signal});if(!active()||revision!==suggestionRevision||abort.signal.aborted||valid?.()===false)return;
    const online=retrievedRows(response,game).map(row=>({title:row.source.title,url:row.source.url,extract:row.extract,kind:'wiki'})),merged=new Map();for(const row of [...localSuggestions(q,game),...online])if(!merged.has(suggestionKey(row)))merged.set(suggestionKey(row),row);state.suggestions=[...merged.values()].slice(0,8);state.suggestionStatus=!state.suggestions.length?(response.status==='not-found'?'No matches. Try another topic.':'Type a topic and press Search.') :'';paintSuggestions();
   }catch{if(active()&&revision===suggestionRevision&&!abort.signal.aborted&&valid?.()!==false){state.suggestionStatus=state.suggestions.length?'':'Type a topic and press Search.';paintSuggestions();}}
   finally{if(suggestionAbort===abort)suggestionAbort=null;}
  },350);
 };
 const daily=async(retry=false)=>{
  if(!active()||state.view!=='home'||state.daily.loading)return null;
  if(!retry&&state.daily.attempted&&(!state.daily.expiresAt||state.daily.expiresAt>now()))return state.daily.response;
  if(state.daily.expiresAt&&state.daily.expiresAt<=now()){state.daily.response=null;state.daily.expiresAt=0;}
  const revision=++dailyRevision,abort=new AbortController(),valid=scope();dailyAbort=abort;Object.assign(state.daily,{attempted:true,loading:true});paintDaily();
  try{
   const response=await readGameWikiDaily(game,{fetcher,signal:abort.signal});if(!active()||state.view!=='home'||revision!==dailyRevision||abort.signal.aborted||valid?.()===false)return null;
   Object.assign(state.daily,{loading:false,response});
   if(response.status==='available'&&retrievedRows(response,game).length){state.daily.expiresAt=now()+86400000;try{store?.setItem(wikiDailyCacheKey(game),JSON.stringify({game,storedAt:now(),expiresAt:state.daily.expiresAt,response}));}catch{}}
   paintDaily();return response;
  }catch{if(active()&&revision===dailyRevision&&!abort.signal.aborted&&valid?.()!==false){Object.assign(state.daily,{loading:false,response:{status:'unavailable'}});paintDaily();}return null;}
  finally{if(dailyAbort===abort){dailyAbort=null;state.daily.loading=false;}}
 };
 const resetHome=()=>{cancelArticle();closeSuggestions();routeKey='';Object.assign(state,{view:'home',topic:'',query:'',status:'idle',response:null});const field=root?.()?.querySelector?.('#wikiQ');if(field)field.value='';paintContent();return daily();};
 const mount=()=>{
  if(!active())return;imageCleanup?.();imageCleanup=bindWikiArticleImages(root?.());const form=root?.()?.querySelector?.('[data-mtg-wiki-form]');
  if(form&&!forms.has(form)){
   forms.add(form);form.addEventListener('submit',e=>{e.preventDefault();const q=form.querySelector('#wikiQ')?.value||state.query;void open(q,{query:true});});
   form.addEventListener('input',e=>{if(e.target.matches?.('#wikiQ'))suggest(e.target.value);});
   form.addEventListener('click',e=>{const button=e.target.closest?.('[data-wiki-suggestion]');if(!button)return;const row=state.suggestions[Number(button.dataset.wikiSuggestion)];if(row){e.preventDefault();void open(row.title);}});
   form.addEventListener('keydown',e=>{
    if(!e.target.matches?.('#wikiQ'))return;
    if(e.key==='Escape'&&state.suggestionsOpen){e.preventDefault();e.stopPropagation();closeSuggestions();}
    else if(['ArrowDown','ArrowUp'].includes(e.key)&&state.suggestionsOpen&&state.suggestions.length){e.preventDefault();state.suggestionIndex=(state.suggestionIndex+(e.key==='ArrowDown'?1:-1)+state.suggestions.length)%state.suggestions.length;paintSuggestions();root?.()?.querySelector?.('#wiki-suggestion-'+state.suggestionIndex)?.scrollIntoView?.({block:'nearest'});}
    else if(e.key==='Enter'&&state.suggestionsOpen&&state.suggestionIndex>=0){e.preventDefault();e.stopPropagation();const row=state.suggestions[state.suggestionIndex];if(row)void open(row.title);}
   });
  }
  if(pendingTitle){const pending=pendingTitle;pendingTitle=null;return lookup(pending.topic,{query:pending.query});}return state.view==='home'?daily():null;
 };
 const cancel=()=>{cancelArticle();closeSuggestions();pauseDaily();imageCleanup?.();imageCleanup=null;};
 const route=(title,{query=false}={})=>{
  const topic=clean(title);if(!topic){pendingTitle=null;resetHome();return;}
  if(!readerTopic(title)){cancelArticle();pendingTitle=null;routeKey='';Object.assign(state,{view:'article',topic:topic.slice(0,180),query:topic.slice(0,180),loading:false,status:'not-found',response:null});return;}
  const key=(query?'query:':'title:')+topic.toLocaleLowerCase();if(key===routeKey&&state.view==='article'&&state.status!=='idle')return;
  cancelArticle();routeKey=key;pendingTitle={topic,query};Object.assign(state,{view:'article',topic,query:topic,mode:query?'query':'title',loading:true,status:'loading',response:null});
 };
 return {state,mount,lookup:open,suggest,daily,home:()=>navigate?navigate(''):resetHome(),route,cancel,retry:()=>lookup(state.topic,{query:state.mode==='query',retry:true}),cancelLookup:()=>cancelArticle({notify:true}),prepare:title=>{if(clean(title)){if(active())return open(title);route(title);}}};
}
