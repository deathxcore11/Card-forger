import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playMenuMarkup} from './play-menu.js';
const setup=()=>({profile:{signedIn:true,ownerId:'owner',displayName:'Player'},match:{format:'Commander',mode:'cpu',difficulty:'Medium'},decks:[],draft:{},browse:{}});
test('starter action explicitly discloses the format switch before committing',()=>{
 const state=setup(),before=structuredClone(state),html=playMenuMarkup(state);
 assert.match(html,/Switch to Standard starter decks/);assert.match(html,/changes the visible format to Standard/);assert.deepEqual(state,before);
 state.match.format='Standard';assert.match(playMenuMarkup(state),/>Use beta starter decks</);
});
test('Friends changes the visible instructions and hides CPU-only controls',()=>{
 const state=setup();state.match.mode='friends';state.inspectedSeat='opponent';state.opponent={name:'CPU CANARY',cards:[]};
 const html=playMenuMarkup(state);assert.match(html,/Friends · Coming later/);assert.doesNotMatch(html,/id="playDifficulty"|data-act="playStarter"|CPU CANARY|data-play-seat="opponent"/);
 assert.match(html,/Choose Practice · CPU to play this beta/);
});
test('the deck browser marks the inspected seat without replacing either matchup list',()=>{
 const state=setup();state.match.format='Standard';state.selectedSource='saved';state.opponentSource='saved';state.inspectedSeat='opponent';
 state.selected={id:'you',name:'Your list',format:'Standard',cards:[]};state.opponent={id:'cpu',name:'CPU list',format:'Standard',cards:[]};state.decks=[state.selected,state.opponent];
 const html=playMenuMarkup(state);assert.match(html,/data-play-deck="you" aria-pressed="false"/);assert.match(html,/data-play-deck="cpu" aria-pressed="true"/);
});
test('guest has a direct sign-in action and no false match-readiness promise',()=>{
 const state=setup();state.profile={signedIn:false};const html=playMenuMarkup(state,{matchReleaseReady:true});
 assert.match(html,/>Sign in to play</);assert.match(html,/disabled[^>]*>Play CPU</);assert.match(html,/Session-only beta/);
});
