// The web's Deck Forge for the native app: the site's own modules, bundled unchanged for QuickJS.
// forgeTrunk is app.js's finderRefresh Trunk build (trunkDeck + the commander hooks), JSON in, JSON out.
import {buildDeck} from 'WEB/builder.js';
import {trunkDeck} from 'WEB/play-deck-finder.js';
import {commanderHooks, forgeFit} from 'WEB/deck-forge.js';
const hooksOf = (lead, pool) => { const h = commanderHooks(lead); return pool.filter(c => (c.color_identity || []).every(k => (lead.color_identity || []).includes(k)) && forgeFit(c, h, {leader: lead}).n > 0).length; };
globalThis.CardStashyEngine = {
  buildDeck, trunkDeck, commanderHooks, forgeFit,
  forgeTrunk(json) { const {format, ownedCards, facts} = JSON.parse(json); return JSON.stringify(trunkDeck({format, ownedCards, factOf: o => facts[o] || null, build: buildDeck, hooksOf}) || null); },
};
