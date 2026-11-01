// Real renderers and device admission, isolated state and no provider calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {todayPackMarkup} from './home-today.js';
import {S,blank} from './store.js';
import {blankGame,GAME_IDS} from './games.js';
import {homeDeckShelf} from './home-ui.js';
import {home} from './views.js';
import {tcgHome,heroState,heroDate} from './tcg.js';
import {playDeviceEligibility,syncDesktopPlayEntries} from './desktop-play.js';
const old=S.state,oldFetch=globalThis.fetch,originalHeroes=structuredClone(heroState);
globalThis.fetch=()=>{throw Error('Home presentation must not fetch or build a deck');};
try{
  S.state={...blank(),tcg:{ptcg:blankGame(),ygo:blankGame()}};
  for(const game of GAME_IDS){
    const state=game==='mtg'?S.state:S.state.tcg[game];
    state.decks=Array.from({length:5},(_,i)=>({id:'saved-'+i,name:i===0?'<img onerror=bad>':'Saved deck '+i,format:game==='mtg'?'Standard':game==='ygo'?'tcg':'standard',cards:[],zones:{main:[],extra:[],side:[]}}));
    S.state.homeDeckActivity||={};S.state.homeDeckActivity[game]=[{id:'saved-3',at:new Date(Date.now()-1000).toISOString()}];
    const snapshot=JSON.stringify(S.state),html=homeDeckShelf(game,d=>({format:d.format,artHTML:''}));
    assert.equal((html.match(/data-home-personal-deck=/g)||[]).length,3);
    assert(html.indexOf('data-home-personal-deck="saved-3"')<html.indexOf('data-home-personal-deck="saved-0"'),'real last-worked deck leads the shelf');
    assert.match(html,/&lt;img onerror=bad&gt;/);assert.doesNotMatch(html,/<img onerror=bad>/);
    assert.equal(JSON.stringify(S.state),snapshot,'rendering never saves, reorders or changes ownership');
    heroState[game]={game,date:heroDate(),id:'daily-'+game,name:'Daily '+game,art:''};
    S.state.settings.game=game;
    const page=game==='mtg'?home():tcgHome();
    const daily=page.indexOf('id="homeToday"'),value=page.indexOf('data-home-value='),decks=page.indexOf('data-home-decks='),meta=page.indexOf('data-home-meta='),news=page.indexOf('home-editorial');
    assert(daily>=0&&daily<value&&value<decks&&decks<meta&&meta<news,'daily → value → saved decks → Community Meta → News');
    // Play lives in the main nav on every device, so Home carries no second Play entry.
    assert.doesNotMatch(page,/data-touch-play-entry/);
    assert.equal((page.match(/id="homeHero"/g)||[]).length,1);assert.doesNotMatch(page,/today-bg/,'no second daily artwork');
    assert.equal((page.match(/data-act="homeDailyCard"/g)||[]).length,1);
    state.decks=[];const empty=homeDeckShelf(game);assert.match(empty,/No saved decks yet/);assert.equal((empty.match(/data-home-personal-deck=/g)||[]).length,0);
  }
}finally{S.state=old;globalThis.fetch=oldFetch;for(const g of GAME_IDS){delete heroState[g];if(originalHeroes[g])heroState[g]=originalHeroes[g];}}
assert.match(readFileSync(new URL('./index.html',import.meta.url),'utf8'),/id="headerPlay" data-desktop-play-entry="practice"[^>]*hidden disabled/,'Play starts hidden until conservative desktop admission');
const pack=todayPackMarkup('mtg',{code:'fdn',name:'Foundations',set_type:'expansion',digital:false,released_at:'2024-11-15'});
assert.match(pack,/homeTodayPack/,'collectible pack action remains');assert.doesNotMatch(pack,/today-draft|data-desktop-play-entry|todayDraftStatus/,'website release has no Draft placeholder');
const desktop={ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:'Win32',anyFine:true,anyHover:true};
assert.equal(playDeviceEligibility(desktop).eligible,true);
assert.equal(playDeviceEligibility({...desktop,maxTouchPoints:10}).eligible,true,'touch laptop is not excluded for touch alone');
for(const patch of [{native:true},{mobile:true},{ua:'Mozilla/5.0 (Linux; Android 17) AppleWebKit desktop mode'},{ua:'Mozilla/5.0 (iPad)'},{ua:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5},{anyFine:false},{anyHover:false},{ua:'Unknown browser'}])assert.equal(playDeviceEligibility({...desktop,...patch}).eligible,false,JSON.stringify(patch));
const nodes=[{dataset:{desktopPlayEntry:'practice'},hidden:true,disabled:false},{dataset:{desktopPlayEntry:'draft'},hidden:true,disabled:false}],root={querySelectorAll:selector=>selector.includes('desktop')?nodes:[]},view={navigator:{userAgent:desktop.ua,platform:'Win32'},matchMedia:()=>({matches:true})};
syncDesktopPlayEntries('mtg',root,view);for(const n of nodes){assert.equal(n.hidden,false);assert.equal(n.disabled,n.dataset.desktopPlayEntry!=='practice');assert.equal(n.dataset.playReadiness,'cpu-beta');}
syncDesktopPlayEntries('ptcg',root,view);for(const n of nodes)assert.equal(n.hidden,true);
// Phones keep the nav Play (it took Community's place); the Play route explains the guard.
syncDesktopPlayEntries('mtg',root,{...view,navigator:{userAgent:'Android',platform:'Linux'}});for(const n of nodes){assert.equal(n.hidden,false);assert.equal(n.dataset.playReadiness,'device-guard');}
// The Android app plays by the touch rules, and keeps Play closed without a touchscreen.
syncDesktopPlayEntries('mtg',root,{...view,Capacitor:{isNativePlatform:()=>true}});for(const n of nodes)assert.equal(n.hidden,false);
syncDesktopPlayEntries('mtg',root,{...view,Capacitor:{isNativePlatform:()=>true},matchMedia:q=>({matches:!q.includes('coarse')})});for(const n of nodes)assert.equal(n.hidden,true);
// A wide Chrome tablet is admitted through the touch entries and the nav Play.
const touchNodes=[{dataset:{touchPlayEntry:'practice'},hidden:true,disabled:true}],tabletRoot={querySelectorAll:selector=>selector.includes('touch')?touchNodes:selector.includes('desktop')?nodes:[],documentElement:{clientWidth:820,clientHeight:1180}};
const tablet={navigator:{userAgent:'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',platform:'Linux armv8l',maxTouchPoints:10},matchMedia:query=>({matches:query.includes('coarse')}),CSS:{supports:()=>true},PointerEvent:function(){}};
assert.equal(syncDesktopPlayEntries('mtg',tabletRoot,tablet).eligible,true);
assert.deepEqual(touchNodes.map(n=>[n.hidden,n.disabled,n.dataset.playReadiness]),[[false,false,'cpu-beta']]);for(const n of nodes){assert.equal(n.hidden,false);assert.equal(n.dataset.playReadiness,'cpu-beta');}
// An upright phone is admitted (setup works upright; the match turns it sideways, desktop-play.js playScreenFits).
syncDesktopPlayEntries('mtg',{...tabletRoot,documentElement:{clientWidth:390,clientHeight:844}},tablet);assert.deepEqual(touchNodes.map(n=>[n.hidden,n.dataset.playReadiness]),[[false,'cpu-beta']]);
// A screen too small even sideways (a folded cover screen) still sees the entry; the Play route explains the space guard.
syncDesktopPlayEntries('mtg',{...tabletRoot,documentElement:{clientWidth:280,clientHeight:560}},tablet);assert.deepEqual(touchNodes.map(n=>[n.hidden,n.dataset.playReadiness]),[[false,'device-guard']]);
syncDesktopPlayEntries('ptcg',tabletRoot,tablet);assert.equal(touchNodes[0].hidden,true);
console.log('PASS: Home order and ownership stay unchanged; desktop Magic Practice entry is admitted; touch devices get the nav Play and wide Chrome tablets are admitted; other games, native and Draft stay unavailable.');
