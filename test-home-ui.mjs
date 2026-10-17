import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gameTabs, syncGameTabs, attachGameTabs, homeValue, featureArticle, homeEdition, isHomeRevealCurrent, homeDeckReveal, displayDate, refreshHomeCommunity } from './home-ui.js';
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
  assert.match(homeEdition(game), /data-act="homeRandomDeck"/);
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
assert.match(homeValue({total:0,copies:2,decks:0,unpriced:2}),/<strong>—<\/strong>/);
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
  const h={name:'Exact displayed card',id:'exact-card',art:'https://example.org/card.png',deck:true,deckId:'saved-deck'};
  const html=homeHero(g,'Welcome back.',h,true);
  assert.equal((html.match(/id="homeHero"/g)||[]).length,1);
  assert.match(html,/class="hh-art-link"/);assert.match(html,/class="hh-credit"/);
  assert.equal((html.match(g==='mtg'?/data-name="Exact displayed card"/g:/data-id="exact-card"/g)||[]).length,2,'artwork and credit open the identical displayed card');
  assert.match(html,new RegExp(`data-to="#${g==='mtg'?'deck':'tdeck'}/saved-deck"`));
  assert.match(html,/From your deck/);assert.doesNotMatch(html,/Card of the day/);
}
let dailyFetches=0,magicPicks=0;
globalThis.fetch=async url=>{dailyFetches++;return {json:async()=>String(url).includes('ygoprodeck')?{data:[{id:123,name:'Daily YGO',type:'Normal Monster',desc:'',card_images:[{image_url:'https://images.ygoprodeck.com/images/cards/123.jpg',image_url_cropped:'https://images.ygoprodeck.com/images/cards_cropped/123.jpg'}]}]}:[{id:'sv1-1',name:'Daily Pokémon',image:'https://assets.tcgdex.net/en/sv/sv01/001'}]};};
for(const g of GAME_IDS){
  delete heroState[g];
  assert.equal(await loadHero(g,async()=>{magicPicks++;return{name:'Daily Magic',image_uris:{art_crop:'https://example.org/daily.jpg'}};}),true);
  assert(heroFor(g)?.name);assert.equal(await loadHero(g,()=>{throw Error('daily card must be cached');}),false);
  assert.match(homeHero(g,'Hello'),/Card of the day/);
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
 const now=new Date().toISOString();communityState('ygo').data={items:[{id:'live',game:'ygo',kind:'news',title:'Independent fresh headline',url:'https://www.yugioh-card.com/en/news/real-test',source:'Konami',publishedAt:now,fetchedAt:now}],status:'ready'};
}});
await new Promise(r=>setTimeout(r,0));assert.match(painted,/Independent fresh headline/,'fresh news paints even when tournament request never settles');
console.log('PASS: Home tabs/keyboard, honest partial values, safe dated source slides, exact header card/deck targets, actual daily-card caches, gesture isolation, reduced motion and navigation-safe reveal.');
