// The same fixture entry path runs in hosted Playwright and this pure regression.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeHomeDeckActivity,recordHomeDeckWork} from '../home-deck-activity.js';
import {blank,STORAGE} from '../store.js';
import {validateWorkspace} from '../confidence.js';
import {game as currentGame} from '../tcg.js';
import {GAMES} from '../games.js';
import {createNavigationQueue,gameSwitchRoute} from '../game-navigation.js';

export async function adoptOwnedGame(page,game){
 // blank() intentionally has no game setting and the booted MTG tab is already
 // selected. Leave and return through real tabs so MTG also gets a committed
 // controller transition, rather than pretending a same-game no-op writes it.
 for(const target of game==='mtg'?['ptcg',game]:[game]){
  await page.locator(`#gameTabs [role="tab"][data-game="${target}"]`).click();
  await page.waitForFunction(g=>document.body.dataset.game===g&&window.__ownedTestState.state.settings.game===g&&history.state?.cardstashy?.game===g,target);
  assert.equal(await page.locator('#gameTabs [aria-selected="true"]').getAttribute('data-game'),target);
 }
}

export async function validateOwnedGameAdoption(ownedFixture,lotIdentity){
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const setup=app.slice(app.indexOf('const stripCache ='),app.indexOf('\nfunction setSaveStatus'));
 const commit=app.slice(app.indexOf('async function commit('),app.indexOf('\nconst safely ='));
 const switchGame=app.slice(app.indexOf('function switchGame('),app.indexOf('\nfunction applyHistory('));
 const persist=app.match(/^  persistGame:(.+),$/m)?.[1];assert(persist,'production game persistence callback exists');
 for(const game of ['mtg','ptcg','ygo']){
  const {card,lots}=ownedFixture(game),S={state:blank()},writes=[],clicked=[],waited=[];
  S.state.tcg={ptcg:{collection:[],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
  (game==='mtg'?S.state:S.state.tcg[game]).collection=lots;
  const before=structuredClone({card,lots}),history={state:{cardstashy:{game:'mtg'}}},document={body:{dataset:{game:'mtg'}}};
  // Production switchGame, game fallback, queue, commit and normalization run
  // unchanged. Only DOM installation and disk transport are in-memory fixtures.
  const context=vm.createContext({S,GAMES,blank,validateWorkspace,normalizeHomeDeckActivity,recordHomeDeckWork,STORAGE,structuredClone,gameSwitchRoute,history,document,window:{__ownedTestState:S},
   activeEntry:{game:'mtg',route:'#home'},gameContext:()=>({hash:'#home'}),queueWorkspaceWrite:transaction=>transaction(),
   writeRecords:async records=>writes.push(records[0][1].settings.game),workspaceTransition:null,
   valueHistoryReady:false,accountLocked:false,accountGeneration:0,accountStorageOptions:()=>({guardRecord:null}),
   changedConditionLots:()=>[],afterLocalSave(){},saveCatalogSoon(){}});
  vm.runInContext(`${setup}\n${commit}\nconst T={game:${currentGame.toString()}};\n${switchGame}\npersistGame=${persist};`,context);
  context.navigation=createNavigationQueue({readGame:vm.runInContext('T.game',context),persistGame:context.persistGame,install:intent=>{
   context.activeEntry={game:intent.game,route:intent.hash};history.state.cardstashy={game:intent.game};document.body.dataset.game=intent.game;
  }});
  context.navigate=intent=>context.navigation.request(intent);
  assert.equal(await context.switchGame('mtg'),false,'same active MTG is intentionally a no-op');
  assert.equal(S.state.settings.game,undefined,'blank default MTG is not an explicit saved setting');
  const page={locator:selector=>({
   click:async()=>{const target=selector.match(/data-game="([^"]+)"/)?.[1];assert(target);clicked.push(target);await context.switchGame(target);},
   getAttribute:async name=>{assert.equal(name,'data-game');return document.body.dataset.game;},
  }),waitForFunction:async(predicate,target)=>{context.target=target;assert.equal(vm.runInContext(`(${predicate.toString()})(target)`,context),true,`${game}: exact body/settings/history adoption`);waited.push(target);}};
  await adoptOwnedGame(page,game);
  const expected=game==='mtg'?['ptcg','mtg']:[game];assert.deepEqual(clicked,expected);assert.deepEqual(writes,expected);assert.deepEqual(waited,expected);
  assert.deepEqual(lotIdentity((game==='mtg'?S.state:S.state.tcg[game]).collection),lotIdentity(before.lots),'controller adoption preserves exact saved lot identity');
  assert.deepEqual(card,before.card,'controller adoption never substitutes the card or source price');
 }
}
