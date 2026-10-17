import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { gameTabs, syncGameTabs, attachGameTabs, homeValue, featureArticle, homeEdition, homeDiscovery, isHomeRevealCurrent, homeDeckReveal, displayDate, refreshHomeCommunity } from './home-ui.js';
import { communityState } from './community-feed.js';
import { GAME_IDS } from './games.js';
import { homeHero, heroState, loadHero, heroFor } from './tcg.js';
import { attachHomeSwipe } from './home-swipe.js';
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) || null, setItem: (k,v) => store.set(k,v) };
for (const game of GAME_IDS) {
  const html = gameTabs(game);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
  assert.match(html, new RegExp(`data-game="${game}"[^>]+aria-selected="true"`));
  assert.deepEqual([...html.matchAll(/data-game="(.*?)"/g)].map(m=>m[1]), GAME_IDS, 'tabs and game swipe use exactly the same order');
  assert.match(homeEdition(game), /data-home-gesture="carousel"/);
  assert.doesNotMatch(homeEdition(game), /data-act="homeRandomDeck"|data-home-meta|data-to="#decks\/ideas"/);
  assert.doesNotMatch(homeDiscovery(game), /data-act="homeRandomDeck"/);
  assert.doesNotMatch(homeDiscovery(game), /Build from my cards/);
}
let focused, clicked;
const tabs = GAME_IDS.map(g=>({ dataset:{game:g}, setAttribute(k,v){this[k]=v;}, focus(){focused=g;}, click(){clicked=g;} }));
const listeners = {}, rail = { querySelector:()=>tabs[0], querySelectorAll:()=>tabs, addEventListener:(k,f)=>listeners[k]=f, removeEventListener:k=>delete listeners[k] };
syncGameTabs(rail,'ptcg'); assert.equal(tabs[2].tabIndex,0); assert.equal(tabs[0]['aria-selected'],'false');
const cleanup = attachGameTabs(rail);
for (const [key,from,to] of [['ArrowRight',0,1],['ArrowLeft',0,2],['Home',2,0],['End',0,2]]) {
  let prevented=false;listeners.keydown({key,target:{closest:()=>tabs[from]},preventDefault(){prevented=true;}});
  assert(prevented); assert.equal(focused,GAME_IDS[to]);assert.equal(clicked,GAME_IDS[to]);
}
cleanup();assert.equal(Object.keys(listeners).length,0);
assert.match(homeValue({total:40,copies:5,decks:0,unpriced:2}),/Known subtotal · 2 unpriced/);
assert.match(homeValue({total:0,copies:2,decks:0,unpriced:2}),/<strong data-value-amount>—<\/strong>/);
assert.doesNotMatch(homeValue({total:0,copies:2,decks:0,unpriced:2}),/\$0/);
assert.match(homeValue({total:0,copies:0,decks:0}),/Ready for your first card/);
assert.match(homeValue({total:0,copies:2,decks:0}),/Estimated value/,'known genuine zero is not confused with missing prices');
const malicious=featureArticle('mtg',{kind:'news',title:'<script>alert(1)</script>',url:'javascript:alert(1)',source:'"<x>',summary:'<img src=x>',publishedAt:'not a date'},0,1);
assert.doesNotMatch(malicious,/<script|<img|href="javascript:/);assert.match(malicious,/&lt;script&gt;/);assert.match(malicious,/Publication date unavailable/);assert.match(malicious,/Source link unavailable/);
assert.equal(displayDate('not a date'),'');
const event=featureArticle('ygo',{kind:'event',title:'Official event',source:'Konami',url:'https://www.yugioh-card.com/en/events/',startsAt:'2026-10-20',endsAt:'2026-10-22',fetchedAt:'2026-10-17T01:00:00.000Z'},2,3);
assert.match(event,/Event dates/);assert.match(event,/datetime="2026-10-20"/);assert.match(event,/datetime="2026-10-22"/);assert.doesNotMatch(event,/Publication date unavailable/);
const link=featureArticle('ptcg',{kind:'link',title:'Official news',url:'https://www.pokemon.com/us/pokemon-news',publishedAt:'2026-10-17'},0,3);
assert.match(link,/Source link · not a live headline/);assert.doesNotMatch(link,/<time/);
for(const g of GAME_IDS){
  const date=new Date().toISOString().slice(0,10);
  heroState[g]={game:g,date,name:'Exact daily card',id:'daily-card-'+g,art:'https://example.org/daily.png'};
  const html=homeHero(g,'Welcome back.',true);
  assert.equal((html.match(/id="homeHero"/g)||[]).length,1);
  assert.doesNotMatch(html,/hh-art-link/);assert.match(html,/class="hh-credit"/);
  assert.equal((html.match(/data-act="homeDailyCard"/g)||[]).length,1,'one unobtrusive daily-card action');
  assert.equal((html.match(new RegExp('data-id="daily-card-'+g+'"','g'))||[]).length,1,'the action opens the exact daily printing');
  assert.match(html,/Card of the Day/);assert.doesNotMatch(html,/From your deck|Open deck|data-to="#(?:deck|tdeck)\//);
}
let dailyFetches=0,magicPicks=0;
globalThis.fetch=async url=>{dailyFetches++;return {json:async()=>String(url).includes('ygoprodeck')?{data:[{id:123,name:'Daily YGO',type:'Normal Monster',desc:'',card_images:[{image_url:'https://images.ygoprodeck.com/images/cards/123.jpg',image_url_cropped:'https://images.ygoprodeck.com/images/cards_cropped/123.jpg'}]}]}:[{id:'sv1-1',name:'Daily Pokémon',image:'https://assets.tcgdex.net/en/sv/sv01/001'}]};};
for(const g of GAME_IDS){
  delete heroState[g];
  assert.equal(await loadHero(g,async()=>{magicPicks++;return{id:'daily-magic',name:'Daily Magic',image_uris:{art_crop:'https://example.org/daily.jpg'}};}),true);
  assert(heroFor(g)?.name);assert.equal(await loadHero(g,()=>{throw Error('daily card must be cached');}),false);
  assert.match(homeHero(g,'Hello'),/Card of the Day/);
}
assert.equal(magicPicks,1);assert.equal(dailyFetches,2,'existing provider selection is called once for each non-Magic game');
const picker = {}, origin = { game:'mtg', view:'home', sheet:picker };
assert.equal(isHomeRevealCurrent(origin,{...origin,open:true}),true);
for(const patch of [{game:'ptcg'},{view:'collection'},{sheet:{}},{open:false}]) assert.equal(isHomeRevealCurrent(origin,{...origin,open:true,...patch}),false,'navigation, game, closed or replaced picker cancels the actual-card reveal');
const reveal = homeDeckReveal({name:'Selected real card',format:'Commander',imageHtml:'<img src="https://example.org/real-card.jpg">'});
assert.match(reveal,/Selected real card/);assert.match(reveal,/not a finished deck/);assert.match(reveal,/Build around this card/);assert.match(reveal,/home-reveal-fan/);
const css = fs.readFileSync('style.css','utf8');assert.match(css,/@media \(prefers-reduced-motion:reduce\) \{ \.home-reveal-fan > \* \{ animation:none!important;/);
const timezone = process.env.TZ;process.env.TZ='America/Los_Angeles';assert.match(displayDate('2026-10-17'),/17/,'date-only publication/event dates do not shift in western timezones');process.env.TZ=timezone;
// Explicit interactive islands retain horizontal touches even when they do not overflow.
for(const selector of ['[data-home-gesture]','.deck-tile','[data-hold-card]','[draggable="true"]','.hh-art-link','.hh-credit']){
 const handlers={},root={addEventListener:(k,f)=>handlers[k]=f,removeEventListener(){}};let switches=0;
 const target={closest:s=>s.includes(selector)?{}:null,parentElement:root,scrollWidth:100,clientWidth:100};
 attachHomeSwipe(root,{enabled:()=>true,current:()=> 'mtg',switchGame:()=>switches++,view:{innerWidth:390,getComputedStyle:()=>({overflowX:'visible'})}});
 const touch=x=>({target,touches:[{clientX:x,clientY:100}],cancelable:true,preventDefault(){}});
 handlers.touchstart(touch(260));handlers.touchmove(touch(80));await handlers.touchend({...touch(80),touches:[],changedTouches:[{clientX:80,clientY:100}]});assert.equal(switches,0,selector+' never changes the game');
}
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert.doesNotMatch(html,/id="gamePill"/);assert.match(html,/id="gameTabs"[^>]+role="tablist"/);
assert.match(app,/A\.homeRandomDeck = \(\) => A\.randomDeckOptions/);
assert.match(app,/t\.onPick\(c, f\.name, start\)/,"reveal is tied to the provider-selected card, not decoration before the chooser");
assert.match(app,/Choose a format first\./,'new reveal preserves the existing explicit format choice');
let painted = '';
const feedNode = { contains:()=>false, set outerHTML(value){ painted=value; } }, feedRoot = { querySelector:()=>feedNode }, doc = { body:{dataset:{view:'home',game:'ygo'}},activeElement:null };
refreshHomeCommunity('ygo',feedRoot,{documentRef:doc,loadDecks:()=>new Promise(()=>{}),loadNews:async()=>{
 const now=new Date().toISOString();communityState('ygo').data={items:[{id:'live',sourceId:'konami',game:'ygo',kind:'news',title:'Independent fresh headline',url:'https://www.yugioh-card.com/en/news/real-test',source:'Konami',publishedAt:now,fetchedAt:now}],status:'ready'};
}});
await new Promise(r=>setTimeout(r,0));assert.match(painted,/Independent fresh headline/,'fresh news paints even when tournament request never settles');
console.log('PASS: Home tabs/keyboard, honest partial values, safe dated source slides, exact independent daily-header targets, actual daily-card caches, gesture isolation, reduced motion and navigation-safe reveal.');

// Execute the actual delayed emblem callback, not a duplicate guard. A visitor
// can focus a Home control after the request starts but before its data arrives.
const emblemStart = app.indexOf('const warmed = new Set();'), emblemEnd = app.indexOf('let sheetReturn = null,', emblemStart);
assert(emblemStart >= 0 && emblemEnd > emblemStart, 'production emblem callback is available');
for (const scenario of [
  { name: 'Home carousel button', view: 'home', kind: 'button', inside: true, renders: 0 },
  { name: 'Home source link', view: 'home', kind: 'link', inside: true, renders: 0 },
  { name: 'Home search input', view: 'home', kind: 'input', inside: true, renders: 0 },
  { name: 'unfocused Home', view: 'home', kind: 'body', inside: false, renders: 0 },
  { name: 'Home shell button', view: 'home', kind: 'button', inside: false, renders: 0 },
  { name: 'non-Home button', view: 'decks', kind: 'button', inside: true, renders: 1 },
  { name: 'non-Home input', view: 'decks', kind: 'input', inside: true, renders: 0 },
  { name: 'open sheet', view: 'home', kind: 'body', inside: false, sheet: true, renders: 0 },
]) {
  const body = {}, focused = { kind: scenario.kind, isConnected: true }, cache = { data: null, at: 0, busy: false };
  const documentRef = { activeElement: body, querySelector: () => documentRef.activeElement.kind === 'input' ? documentRef.activeElement : null };
  const nodes = { '#sheet': { open: !!scenario.sheet }, '#content': { contains: node => scenario.inside && node === focused } };
  const calls = [];
  let timer, finish, renders = 0;
  const context = {
    navigationStamp:()=>({}),navigationCurrent:()=>true,
    S: { ui: { view: scenario.view } }, T: { game: () => 'mtg' }, mtgMetaFormat: () => 'Modern',
    metaState: () => cache, document: documentRef, $: selector => nodes[selector],
    setTimeout: (callback, delay) => { timer = { callback, delay }; },
    loadMetaData: key => {
      calls.push(key); cache.busy = true;
      return new Promise(resolve => { finish = () => { cache.data = { source: 'Fresh tournament data' }; cache.at = Date.now(); cache.busy = false; resolve(cache.data); }; });
    },
    render: () => { renders++; if (scenario.inside) { focused.isConnected = false; documentRef.activeElement = body; } },
  };
  vm.runInNewContext(app.slice(emblemStart, emblemEnd) + '\nwarmEmblems();', context);
  assert.equal(timer.delay, 2500, scenario.name + ': exercise the delayed production load');
  timer.callback();
  assert.deepEqual(calls, ['mtg:Modern']);
  assert.equal(cache.busy, true);
  documentRef.activeElement = focused;
  finish();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(cache.data.source, 'Fresh tournament data', scenario.name + ': focus does not cancel the cache update');
  assert.equal(cache.busy, false);
  assert(cache.at > 0);
  assert.equal(renders, scenario.renders, scenario.name + ': bounded background repaint policy');
  if (!scenario.renders) {
    assert.equal(documentRef.activeElement, focused, scenario.name + ': the original focused node remains active');
    assert.equal(focused.isConnected, true, scenario.name + ': the focused node is not replaced');
  }
}
console.log('PASS: delayed production emblem refresh caches fresh data without replacing focused Home controls; Home gestures stay mounted while non-Home redraws and input/sheet guards remain intact.');

// Exercise the hosted regression's actual readiness/measurement helper without
// importing its server or Playwright. A child transition can be replaced by a
// feed refresh while settling; an infinite decorative animation never blocks.
const browserSource=fs.readFileSync('tests/home-browser.mjs','utf8');
const overflowSource=browserSource.slice(browserSource.indexOf('async function noOverflow('),browserSource.indexOf('async function visibleHeaderArt('));
assert(overflowSource.startsWith('async function noOverflow('));
let animations=[],measured=0,rootWidth=390,contentWidth=390,copyRight=374,copyScroll=358;
const finite=()=>{let finish;const animation={playState:'running',effect:{getComputedTiming:()=>({endTime:580})},finished:new Promise(resolve=>{finish=()=>{animation.playState='finished';resolve();};})};return {animation,finish};};
const infinite={playState:'running',effect:{getComputedTiming:()=>({endTime:Infinity})},finished:new Promise(()=>{})};
const contentNode={clientWidth:390,get scrollWidth(){measured++;return contentWidth;},getAnimations:options=>{assert.equal(options.subtree,true,'wait includes the animated page children');return [...animations,infinite];}};
const fixtureDocument={documentElement:{get scrollWidth(){measured++;return rootWidth;}},body:{get scrollWidth(){measured++;return rootWidth;}},querySelector:selector=>selector==='#content'?contentNode:{clientWidth:358,get scrollWidth(){return copyScroll;},getBoundingClientRect:()=>({left:16,right:copyRight})}};
const noOverflow=vm.runInNewContext(overflowSource+'\nnoOverflow;',{assert,document:fixtureDocument,innerWidth:390});
const fakePage={evaluate:fn=>fn()},firstMotion=finite(),replacementMotion=finite();
animations=[firstMotion.animation];const settling=noOverflow(fakePage,'settled descendants');
await Promise.resolve();assert.equal(measured,0,'never measure while the first descendant is moving');
animations=[replacementMotion.animation];firstMotion.finish();await Promise.resolve();await Promise.resolve();
assert.equal(measured,0,'a replacement descendant must settle too');replacementMotion.finish();await settling;assert(measured>0);
animations=[];
rootWidth=402;await assert.rejects(noOverflow(fakePage,'persistent root overflow'),/document overflow/);rootWidth=390;
contentWidth=402;await assert.rejects(noOverflow(fakePage,'persistent content overflow'),/content overflow/);contentWidth=390;
copyRight=399;await assert.rejects(noOverflow(fakePage,'persistent descendant overflow'),/outside viewport/);copyRight=374;
copyScroll=368;await assert.rejects(noOverflow(fakePage,'persistent copy clipping'),/clips overflowing content/);copyScroll=358;
console.log('PASS: hosted overflow helper awaits actual finite descendant/replacement motion, ignores infinite decoration, and still rejects persistent document/content/element overflow and clipped copy.');

// Personal dashboard and activity regressions run in the normal pure test suite.
await import("./test-home-personal-dashboard.mjs");
