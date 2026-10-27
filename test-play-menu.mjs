import test from 'node:test';
import assert from 'node:assert/strict';
import {playMenuMarkup} from './play-menu.js';
import {S,blank} from './store.js';
import {deckList,deckArtwork,deckTile,decks,sharedPage} from './views.js';
import {deckViewer} from './deck-viewer.js';
import {routeSegments,gameSwitchRoute} from './game-navigation.js';
import {readFileSync} from 'node:fs';

const base=()=>({match:{format:'Standard',mode:'cpu',difficulty:'Medium'},browse:{query:''},profile:{signedIn:true,displayName:'A Player',username:'player',ownerId:'private-account-id'},decks:[],selected:null,selectedSource:null,importStatus:'idle',draft:{name:'',text:'',format:''},warnings:[],unresolved:[],busy:false});
test('menu preserves supplied shared renderers and keeps match creation unavailable',()=>{
  const state=base();state.decks=[{id:'one',name:'Existing deck',format:'Standard'}];
  state.selected={id:'one',name:'Existing deck',format:'Standard',cards:[{name:'Island',qty:60}],side:[]};state.selectedSource='saved';state.readiness={ready:true};
  const tile='<button class="deck-tile" data-act="go" data-to="#deck/one">Shared deck tile</button>';
  const preview='<section class="deck-viewer" data-deck-view="stacks">Shared card rows</section>';
  const html=playMenuMarkup(state,{avatarMarkup:'<span class="profile-avatar">Shared avatar</span>',deckTiles:new Map([['one',tile]]),deckPreview:preview});
  assert(html.includes(tile));assert(html.includes(preview));assert.match(html,/A Player/);assert.match(html,/@player/);
  assert.match(html,/<button class="btn"[^>]*disabled[^>]*>Play CPU<\/button>/);assert.doesNotMatch(html,/private-account-id|data-act="(?:startMatch|playCpu)"/);
});
test('profile, deck names and pasted text cannot inject markup',()=>{
  const s=base();s.profile.displayName='<img src=x onerror=alert(1)>';s.profile.username='evil" onfocus="x';
  s.draft.text='</textarea><script>bad()</script>';s.error='<svg onload=bad()>';
  const html=playMenuMarkup(s);assert.doesNotMatch(html,/<script>|<svg onload|<img src=x/);assert.match(html,/&lt;\/textarea&gt;/);
  assert.match(html,/maxlength="160"/);
});
test('an imported candidate is visible for review before it replaces a saved selection',()=>{
  const s=base();s.importStatus='review';s.reviewDeck={name:'New import',cards:[{name:'Mountain',qty:60}],side:[{name:'Negate',qty:2}]};
  s.selected={name:'Previous saved deck',cards:[{name:'Forest',qty:60}],side:[]};s.selectedSource='saved';
  const html=playMenuMarkup(s,{importPreview:'<div>Exact imported rows</div>',deckPreview:'<div>Original selected rows</div>'});
  assert.match(html,/Review imported list/);assert.match(html,/Exact imported rows/);assert.match(html,/Previous saved deck/);assert.match(html,/Original selected rows/);assert.match(html,/Use this list/);
});
test('Play uses the existing deck viewer without creating an absent commander or merging side cards',()=>{
  S.state=blank();S.catalog={};S.ui.q.deck='unrelated';S.ui.deckFilter='missing';
  const d={name:'Exact list',format:'Commander',commander:'Declared but absent',cards:[{name:'Island',qty:99}],side:[{name:'Island',qty:1}]};
  const before=JSON.stringify(d),html=deckViewer('mtg',deckList(d,{readOnly:true,unfiltered:true,preserveExactList:true,cardAction:'playInspectCard'}));
  assert.equal(JSON.stringify(d),before);assert.doesNotMatch(html,/data-deck-name="Declared but absent"/);
  assert.match(html,/data-deck-name="Island" data-deck-qty="99" data-deck-zone="main"/);
  assert.match(html,/data-deck-name="Island" data-deck-qty="1" data-deck-zone="side"/);
  assert.doesNotMatch(html,/data-act="deckQty"/);assert.match(html,/data-act="playInspectCard"/);assert.match(html,/role="radiogroup" aria-label="Deck view"/);
});
test('Play is a real route and transfers back to Home for other card games',()=>{
  assert.deepEqual(routeSegments('#play'),['play']);
  assert.equal(gameSwitchRoute({hash:'#play'},'ygo').hash,'#home');
  assert.equal(gameSwitchRoute({hash:'#play'},'ptcg').hash,'#home');
});
test('an account change retires an in-flight real name lookup before cache writes or later chunks',async()=>{
  const source=readFileSync(new URL('./app.js',import.meta.url),'utf8').match(/async function resolveNames\([\s\S]*?\n}\n/)[0];
  let complete,current=true,calls=0,cached=0,saves=0;
  const api=()=>{calls++;return new Promise(resolve=>{complete=resolve;});};
  const resolver=new Function('meta','key','api','cacheCard','saveCatalogSoon',`return (${source});`)(()=>null,s=>s.toLowerCase(),api,()=>cached++,()=>saves++);
  const pending=resolver(Array.from({length:150},(_,i)=>'Card '+i),()=>{},false,()=>current);
  assert.equal(calls,1);current=false;complete({data:[{name:'Card 0'}]});
  assert.equal((await pending).cancelled,true);assert.equal(calls,1);assert.equal(cached,0);assert.equal(saves,0);
});

test('selected import is displayed once and exposes a focus destination',()=>{
 const s=base();s.importStatus='selected';s.selectedSource='import';s.selected={name:'Chosen list',cards:[{name:'Island',qty:60}],side:[]};
 const html=playMenuMarkup(s,{deckPreview:'<div>Selected exact list</div>'});
 assert.equal((html.match(/Selected exact list/g)||[]).length,1);assert.doesNotMatch(html,/Review imported list|data-act="playImportUse"/);assert.match(html,/id="playSelectedTitle" tabindex="-1"/);
});


test('desktop setup has one persistent inspector and only Standard/Commander formats',()=>{
 const html=playMenuMarkup(base());assert.match(html,/class="play-workspace"/);assert.match(html,/<aside class="panel play-inspector"/);
 assert.match(html,/data-play-value="Standard"/);assert.match(html,/data-play-value="Commander"/);assert.doesNotMatch(html,/data-play-value="(?:Modern|Draft)"/);
 assert.match(html,/data-play-style="quick"/);assert.match(html,/data-play-style="practice"/);assert.match(html,/data-play-style="social"/);assert.match(html,/<option value="Easy">Easy<\/option>/);assert.match(html,/<option value="Medium" selected>Medium<\/option>/);assert.match(html,/<option value="Hard">Hard<\/option>/);
});
test('shelf filters exact format and search without deleting the selected deck preview',()=>{
 const s=base();s.decks=[{id:'a',name:'Alpha',format:'Standard'},{id:'b',name:'Beta',format:'Commander'},{id:'c',name:'Gamma',format:'Standard'}];s.browse.query='alpha';
 s.selected={name:'Gamma',format:'Standard',cards:[]};const html=playMenuMarkup(s,{deckPreview:'<div>Selected rows</div>'});
 assert.match(html,/data-play-deck="a"/);assert.doesNotMatch(html,/data-play-deck="[bc]"/);assert.match(html,/Selected rows/);assert.match(html,/1 of 2 Standard decks/);
});
test('friends preference exposes no invented connection and does not advertise a CPU difficulty',()=>{
 const s=base();s.match.mode='friends';const html=playMenuMarkup(s);assert.match(html,/disabled[^>]*>Play with friends<\/button>/);assert.doesNotMatch(html,/id="playDifficulty"|data-act="(?:createRoom|joinRoom)"/);
});


test('malformed selected rows cannot crash artwork rendering and shared tiles retain their default route',()=>{
 S.state=blank();S.catalog={};assert.equal(deckArtwork({name:'Broken',cards:[null]}),'');
 const d={id:'one',name:'A deck',format:'Standard',cards:[{name:'Island',qty:60}],side:[]};
 assert.match(deckTile(d),/data-act="go" data-to="#deck\/one"/);
 // Decks carries the touch Play entry beside its tabs (hidden until touch admission shows it).
 assert.match(decks(),/<div class="decks-play-row"><div class="seg"[\s\S]*?<\/div><button[^>]*data-touch-play-entry="practice"[^>]*hidden disabled/);
 assert.match(deckTile(d,false,{playSelection:true}),/data-act="playSelectDeck" data-play-deck="one" aria-pressed="true"/);
 // The size line counts the main deck against the format; the sideboard is named beside it.
 assert.match(deckTile({...d,id:'two',cards:[{name:'Island',qty:50}],side:[{name:'Island',qty:5}]}),/· 50\/60 · 5 sideboard<\/small>/);
});

test('a shared Magic link lists its sideboard and every quantity',()=>{
 S.state=blank();S.catalog={};S.ui.shared={deck:{name:'Shared',format:'Standard',cards:[{name:'Island',qty:4},{name:'Ironbark Golem',qty:1}],side:[{name:'Negate',qty:2}],budget:null},error:''};
 const html=sharedPage();
 assert.match(html,/<p class="list-head">Sideboard <span class="muted">2<\/span><\/p>[\s\S]*2× Negate/);
 assert.match(html,/1× Ironbark Golem/);
});
