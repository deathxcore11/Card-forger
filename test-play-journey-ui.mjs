import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playMenuMarkup} from './play-menu.js';
const setup=()=>({profile:{signedIn:true,ownerId:'owner',displayName:'Player'},match:{format:'Commander',mode:'cpu',difficulty:'Medium'},decks:[],draft:{},browse:{}});
test('normal deck access does not add a starter funnel or change format on render',()=>{
 const state=setup(),before=structuredClone(state),html=playMenuMarkup(state,{engine:'forge'});
 assert.doesNotMatch(html,/playStarter|tested Standard starter match/);assert.match(html,/Your decks/);assert.deepEqual(state,before);
 state.match.format='Standard';assert.doesNotMatch(playMenuMarkup(state,{engine:'forge'}),/playStarter|tested starter match/);
});
test('Friends changes the visible instructions and hides CPU-only controls',()=>{
 const state=setup();state.match.mode='friends';state.inspectedSeat='opponent';state.opponent={name:'CPU CANARY',cards:[]};
 const html=playMenuMarkup(state);assert.match(html,/Friends · Coming later/);assert.doesNotMatch(html,/id="playDifficulty"|data-act="playStarterMatch"|CPU CANARY|data-play-seat="opponent"/);
 assert.match(html,/Choose Practice to play against the CPU/);
});
test('the deck browser marks the inspected seat without replacing either matchup list',()=>{
 const state=setup();state.match.format='Standard';state.selectedSource='saved';state.opponentSource='saved';state.inspectedSeat='opponent';
 state.selected={id:'you',name:'Your list',format:'Standard',cards:[]};state.opponent={id:'cpu',name:'CPU list',format:'Standard',cards:[]};state.decks=[state.selected,state.opponent];
 const html=playMenuMarkup(state);assert.match(html,/data-play-deck="you" aria-pressed="false"/);assert.match(html,/data-play-deck="cpu" aria-pressed="true"/);
});
test('guest has a direct sign-in action and no false match-readiness promise',()=>{
 const state=setup();state.profile={signedIn:false};const html=playMenuMarkup(state,{matchReleaseReady:true});
 assert.match(html,/data-act="menu"><span class="cs-plate-label">Sign in to play</);assert.doesNotMatch(html,/Play vs CPU|Keep this page open|Social/);
});

test('Standard precons explain the legal 60-card product check and keep normal deck sources',()=>{
 const state=setup();state.match.format='Standard';state.browse.source='precons';const before=structuredClone(state),html=playMenuMarkup(state);
 assert.match(html,/published 60-card products/);assert.match(html,/every card is legal in Standard/);assert.match(html,/data-act="playLoadSource"/);assert.doesNotMatch(html,/playStarter|<details class="play-starter"/);assert.deepEqual(state,before);
});
test('support errors appear by the selected artwork before launch with expandable cards',()=>{
 const state=setup();state.match.format='Standard';state.selected={name:'Unsupported list',format:'Standard',cards:[{name:'Seasoned Cryomancer',qty:4},{name:'Forest',qty:56}],side:[]};state.opponent={name:'CPU',format:'Standard',cards:[{name:'Forest',qty:60}],side:[]};
 const html=playMenuMarkup(state,{matchReleaseReady:true});assert.match(html,/Not supported yet/);assert.match(html,/View affected cards/);assert.match(html,/Seasoned Cryomancer: unfinished rules/);assert.match(html,/disabled[^>]*><span class="cs-plate-label">Play vs CPU</);assert.doesNotMatch(html,/Ready for match checks/);
});
