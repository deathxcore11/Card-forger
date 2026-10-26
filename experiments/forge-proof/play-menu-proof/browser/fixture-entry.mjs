import {createPlaySetup} from './play-setup.js';
import {playMenuMarkup} from './play-menu.js';
import {parsePlayDeckImport} from './play-deck-import.js';
import {parseDeckImport} from './deck-flow.js';
import {chooseQuickOpponent} from './play-quick-match.js';
import {forgeDeckSupport} from './play-forge-setup-review.js';
import {syncDesktopPlayEntries} from './desktop-play.js';
import {bindPlayHandlers} from './fixture-app-handlers.mjs';
// Only fixture account/provider/cache values enter here. No native state is
// seeded, intercepted, exposed globally, mutated or replied to by fixture code.
const get=async p=>{const r=await fetch(p,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Fixture dependency unavailable');return r.json();};
const [config,{decks},art]=await Promise.all([get('/fixture-config.json'),get('./fixture-decks.json'),get('./experiments/forge-proof/artwork.json')]);
if(!/^https?:$/.test(location.protocol)||!['127.0.0.1','localhost'].includes(location.hostname)||config.fixtureOnly!==true)throw Error('Local fixture boundary required');
const account={user:{id:config.userId},profile:{display_name:'Local browser fixture'},accountGeneration:1};
const S={state:{decks,printings:Object.fromEntries(art.map(c=>[c.id,c]))},ui:{view:'play'}};
const metadata=new Map(art.map(c=>[c.name,c])),readAccount=()=>account;
const setup=createPlaySetup({readAccount,readDecks:()=>S.state.decks,parseImport:text=>parsePlayDeckImport(text,{parseDeckImport}),resolveNames:async names=>({failed:names.filter(n=>!metadata.has(n))})});
let handlers;
const toast=t=>{document.getElementById('toast').textContent=t;};
function render(){
 const content=document.getElementById('content');if(S.ui.view!=='play'){content.innerHTML='<section class="empty"><h1>Home</h1><a class="btn" href="#play">Return to Play</a></section>';return;}
 const eligible=syncDesktopPlayEntries('mtg').eligible;
 if(!eligible){content.innerHTML='<section class="empty"><h1>Play unavailable for this browser</h1><p>The actual device admission rejected this fixture context.</p></section>';return;}
 const open=document.getElementById('playImportDisclosure')?.open;
 const scrolls=[...document.querySelectorAll('[data-play-scroll]')].map(n=>[n.dataset.playScroll,n.scrollTop]);
 content.innerHTML=playMenuMarkup(setup.snapshot(),{engine:'forge',matchReleaseReady:true});
 if(open!==undefined&&document.getElementById('playImportDisclosure'))document.getElementById('playImportDisclosure').open=open;
 for(const [key,top]of scrolls){const n=document.querySelector(`[data-play-scroll="${key}"]`);if(n)n.scrollTop=top;}
}
handlers=bindPlayHandlers({FORGE_PLAY_TEST_ENABLED:true,PLAY_MATCH_RELEASE_READY:true,T:{game:()=> 'mtg'},syncDesktopPlayEntries,S,playSetup:setup,readPlayAccount:readAccount,cloudInfo:readAccount,accountGeneration:1,accountLocked:false,cloudAccessToken:async()=>config.accessToken,meta:n=>metadata.get(n)||null,toast,go:hash=>{location.hash=hash;},chooseQuickOpponent,forgeDeckSupport,capturePracticeDeckContext:()=>({practiceContext:{power:{value:null}}}),readPlaySources:()=>({}),refreshPlayMenu:render,cancelPlayBuilds:()=>{}});
for(const [type,key,map]of [['click','act',handlers.A],['change','change',handlers.C],['input','input',handlers.I]])document.addEventListener(type,e=>{const t=e.target.closest(`[data-${key}]`);if(!t||!map[t.dataset[key]])return;if(t.disabled)return;Promise.resolve(map[t.dataset[key]](t)).catch(()=>toast('Fixture handler failed.'));});
window.addEventListener('hashchange',()=>{S.ui.view=location.hash==='#home'?'home':'play';document.body.dataset.view=S.ui.view;render();});
location.hash='#play';render();document.documentElement.dataset.fixtureReady='true';
