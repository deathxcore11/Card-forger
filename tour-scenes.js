// Render the same screen functions the app uses. Work only on disposable copies;
// the sandboxed preview has no scripts, handlers, camera access or storage writes.
import { S } from './store.js';
import * as V from './views.js';
import * as T from './tcg.js';
import { GAMES, blankGame } from './games.js';
import { scanView } from './scancam.js';
const deckPanel = html => html.slice(Math.max(0, html.indexOf('<nav class="tabs"')));
export function tourScenes(game = 'mtg') {
  const state = S.state, ui = S.ui, tcgUi = T.ui(game), originalTcgUi = { ...tcgUi };
  const copiedState = structuredClone(state), copiedUi = structuredClone(ui), copiedTcgUi = structuredClone(tcgUi);
  try {
    Object.assign(tcgUi, copiedTcgUi); S.state = copiedState; S.ui = copiedUi;
    S.state.settings.game = game;
    const mtg = game === 'mtg';
    const decks = () => mtg ? V.decks() : T.tcgDecks();
    const collection = () => mtg ? V.collection() : T.tcgCollection();
    const search = () => mtg ? V.search() : T.tcgSearch();
    let deck = mtg ? S.state.decks.find(d => d.id === state.activeDeck) || S.state.decks.at(-1) : T.gs(game).decks.at(-1);
    const deckView = (tab) => {
      if (!deck) {
        deck = { id:'tour-draft', name:'A new deck', format:mtg ? 'Standard' : game === 'ygo' ? 'tcg' : 'standard', commander:'', strategy:'Auto', budget:50, cards:[], side:[], versions:[], zones:{main:[],extra:[],side:[]} };
        if (mtg) S.state.decks.push(deck);
        else { S.state.tcg ||= {}; S.state.tcg[game] ||= blankGame(); S.state.tcg[game].decks.push(deck); }
      }
      if (mtg) { S.ui.deckId = deck.id; S.ui.deckTab = tab === 'power' ? 'engine' : tab; return deckPanel(V.deckPage()); }
      (S.ui.tdeckTab ||= {})[game+":"+deck.id] = tab === 'power' ? 'insights' : tab; return deckPanel(T.tcgDeck(deck.id));
    };
    const home = mtg ? V.home() : T.tcgHome();
    const collect = collection();
    if (mtg) S.ui.collTab = 'binders'; else T.ui(game).coll.tab = 'binders';
    const binders = collection();
    S.ui.settingsTab = 'account'; const account = V.settings();
    S.ui.settingsTab = 'backup'; const backup = V.settings();
    return {
      welcome: [home], scan: [scanView(game, GAMES[game].short)], build: [decks()],
      power: [deckView('power')], prices: [collect], ask: [search()],
      collect: [collect, binders], upgrade: [deckView('upgrade')],
      practice: [deckView('playtest')], backup: [account, backup],
    };
  } finally { S.state = state; S.ui = ui; for (const k of Object.keys(tcgUi)) delete tcgUi[k]; Object.assign(tcgUi, originalTcgUi); }
}
