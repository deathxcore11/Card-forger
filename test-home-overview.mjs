// Real renderers and device admission, isolated state and no provider calls.
import assert from 'node:assert/strict';
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
    assert.equal((page.match(/id="homeHero"/g)||[]).length,1);assert.doesNotMatch(page,/today-bg/,'no second daily artwork');
    assert.equal((page.match(/data-act="homeDailyCard"/g)||[]).length,1);
    state.decks=[];const empty=homeDeckShelf(game);assert.match(empty,/No saved decks yet/);assert.equal((empty.match(/data-home-personal-deck=/g)||[]).length,0);
  }
}finally{S.state=old;globalThis.fetch=oldFetch;for(const g of GAME_IDS){delete heroState[g];if(originalHeroes[g])heroState[g]=originalHeroes[g];}}
const desktop={ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:'Win32',anyFine:true,anyHover:true};
assert.equal(playDeviceEligibility(desktop).eligible,true);
assert.equal(playDeviceEligibility({...desktop,maxTouchPoints:10}).eligible,true,'touch laptop is not excluded for touch alone');
for(const patch of [{native:true},{mobile:true},{ua:'Mozilla/5.0 (Linux; Android 17) AppleWebKit desktop mode'},{ua:'Mozilla/5.0 (iPad)'},{ua:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5},{anyFine:false},{anyHover:false},{ua:'Unknown browser'}])assert.equal(playDeviceEligibility({...desktop,...patch}).eligible,false,JSON.stringify(patch));
const nodes=[{dataset:{desktopPlayEntry:'practice'},hidden:true,disabled:false},{dataset:{desktopPlayEntry:'draft'},hidden:true,disabled:false}],root={querySelectorAll:()=>nodes},view={navigator:{userAgent:desktop.ua,platform:'Win32'},matchMedia:()=>({matches:true})};
syncDesktopPlayEntries('mtg',root,view);for(const n of nodes){assert.equal(n.hidden,false);assert.equal(n.disabled,n.dataset.desktopPlayEntry!=='practice');assert.equal(n.dataset.playReadiness,'setup-preview');}
syncDesktopPlayEntries('ptcg',root,view);for(const n of nodes)assert.equal(n.hidden,true);
syncDesktopPlayEntries('mtg',root,{...view,navigator:{userAgent:'Android',platform:'Linux'}});for(const n of nodes)assert.equal(n.hidden,true);
console.log('PASS: one daily artwork; exact daily/value/deck/discovery order; bounded escaped personal shelf without state/provider changes; conservative desktop, touch-laptop, mobile/tablet/native/unknown admission; desktop deck-setup entry enabled; Draft remains unavailable.');

