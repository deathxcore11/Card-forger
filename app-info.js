import {esc} from './ui.js';

// One source for the human help centre and the assistant's app_help tool.
// Keep claims about prices, sync and saved changes tied to shipped behaviour.
export const INFO_TOPICS = [
 {id:'start',category:'Start here',title:'Find your way around',summary:'One workspace, with a separate collection and decks for each game.',lesson:'find',route:'#home',action:'Open Home',details:[
  'Choose Magic, Pokémon or Yu-Gi-Oh! at the top. Home also supports a horizontal swipe. Search, Collection, Decks and Scan stay within the selected game.',
  'The Home search finds real cards as you type. Choose a result to inspect that printing. Submit a question to ask the assistant; typing alone does not start an AI conversation.',
  'Open Settings without leaving your current page. Closing it returns to the same game and task.'
 ]},
 {id:'collection',category:'Your cards',title:'Copies, conditions & binders',summary:'Record what you own, including each copy’s condition and printing.',lesson:'save',route:'#collection',action:'Open Collection',details:[
  'Open a card, choose Add to collection, then check the quantity, condition and version. Copies in different conditions or printings belong in separate saved lots.',
  'Hold a card to open its actions. Owned cards have minus and plus controls; if several saved lots exist, choose the lot you mean. Wishlist stays separate from ownership.',
  'Binders and locations organize saved copies. A card in a deck is a deck requirement, not proof that you own it. Check the owned and missing counts.',
  'A save receipt confirms the local change. Use Undo when offered. Cloud sync has its own status in Account; a local save alone does not confirm a cloud upload.'
 ]},
 {id:'scan',category:'Your cards',title:'Scan, review, save',summary:'Get a clear card image, then confirm the exact match.',lesson:'scan',route:'#scan',action:'Open Scan',details:[
  'Keep the entire card visible and the camera steady. You do not need perfect alignment. Sharp printing numbers and a readable name help distinguish versions; glare and motion blur can hide them.',
  'Review the game, name, set number, edition and finish. A name match alone cannot prove a printing. Use the version selector or search if the match is ambiguous.',
  'Choose condition and quantity before saving. The receipt uses that saved condition’s available quote, labeled estimate or manual value where applicable. Unavailable prices stay unavailable.',
  'The optional catalogue download helps local matching. Recognition and current data may still need internet. Replaying a demo never starts the camera or purchases a price lookup.'
 ]},
 {id:'decks',category:'Play & build',title:'What can I play?',summary:'Pick a format, compare what you own, and inspect missing copies.',lesson:'build',route:'#decks/inspiration',action:'Explore deck ideas',details:[
  'Choose the game and format before building. Explore ideas, import a list or open a tournament list. Saving a deck creates a list; it does not add those cards to your collection.',
  'Owned counts compare quantities, not just names. Different legal printings can represent the same game piece. Copies are compared independently per deck; the app does not physically reserve them across simultaneous decks.',
  'Check missing copies, resources and deck review before playing. Incomplete budget builds are drafts. A cheaper suggestion is useful only if it still supports a playable plan and the chosen format.',
  'Missing prices are not free cards. A covered subtotal is not a guaranteed purchase total; shipping and seller availability can differ. Review the actual list before saving or buying.'
 ]},
 {id:'prices',category:'Your cards',title:'Understand a price',summary:'Printing, condition, source and coverage matter more than a single number.',lesson:'save',route:'#collection',action:'Open Collection value',details:[
  'Catalogue prices are reference quotes. They may describe a specific finish or an aggregate market, not every physical condition. TCGplayer asking listings and a market-price feed are different kinds of evidence.',
  'Saved copies use their exact printing, finish and condition when a matching provider quote exists. Manual values and estimates are labeled. A price for Near Mint must not silently stand in for Lightly Played or Damaged.',
  'Quotes are cached and refreshed through the app’s pricing services, subject to availability and provider limits. Opening a screen does not guarantee a new quote. Look at the displayed source, date and coverage.',
  'Collection value and its history describe priced saved copies. Unpriced copies are counted separately. Additions, removals and manual changes can affect the graph as well as market movement.',
  'To set your own value, hold a price or use Set your price in card details. A personal value is private and is not a verified sale or a promise of sale proceeds.'
 ]},
 {id:'news',category:'Discover',title:'News & tournament lists',summary:'Keep the source, date and format attached to the result.',route:'#home',action:'Open Home',details:[
  'Home news uses supported publisher feeds, cached by the app and checked daily. It shows a bounded selection of recent stories with manual paging; it is not a guaranteed seven-day rotation.',
  'Each story keeps its publication date, source and applicable region. Japanese OCG news does not establish TCG release dates or legality.',
  'Meta lists come from supported tournament sources. Cached results can be older than today. Check the event date and format before treating a list as current.',
  'Loading and an unavailable source are different from an empty result. You can inspect an available list, then explicitly save a copy to your decks.'
 ]},
 {id:'ai',category:'Play & build',title:'Assistant, Coach & Judge',summary:'Use the right evidence for the question you are asking.',route:'#decks',action:'Open Decks',details:[
  'The Home assistant can retrieve card data, collection summaries, saved decks, tournament lists and these Info topics. It can prepare a builder or offer a destination; a recommendation is not a saved change.',
  'Coach works from the selected deck and available analysis. Scores and simulations are estimates, not measured tournament win rates. Review proposed changes before applying them.',
  'Use Ask rules for a ruling. Supply the exact cards, format, relevant text and the situation. The Judge can request missing details and cite the supporting rules; it cannot infer an entire board from a card name or life counter.',
  'AI requests use the app’s server and configured provider. The assistant only receives the app data needed by its tools, not automatic access to every private record. It can be wrong or lack current data.'
 ]},
 {id:'tabletop',category:'Play & build',title:'Tabletop tools',summary:'Local counters with player-specific history and Undo.',lesson:'tabletop',action:'Open Tabletop',details:[
  'Choose the game and players. Magic tracks life, poison and commander damage by source and recipient. Pokémon tracks damage and status on each Active or Bench position. Yu-Gi-Oh! has life-point adjustments.',
  'Each player has their own Undo. A new session needs confirmation. Session counters stay on this device through a reload; they never change a collection or a deck.',
  'Coin flips, dice and counters work locally. Keep awake is optional where your browser supports it. The Judge is separate and needs card and situation details. Check an event’s policy before using any electronic aid.'
 ]},
 {id:'privacy',category:'Your workspace',title:'Account, backup & sharing',summary:'Your account copy and a deliberately shared deck are different things.',route:'#settings',action:'Open Account',details:[
  'Cards and decks are saved on this device first. Signing in adds a private account copy; check Account for sync progress or errors.',
  'Download a backup before changing devices or clearing storage. Restoring a backup changes saved data; checking one only inspects it. Reset onboarding clears guide history only.',
  'A shared deck requires an explicit sharing action. Public profiles, comments, voting and live collaboration are future work; private collections are not automatically public.'
 ]},
];
export function findInfo(query='') {
 const words=String(query).toLowerCase().split(/\W+/).filter(x=>x.length>2);
 return INFO_TOPICS.map(topic=>({topic,score:words.reduce((n,w)=>n+(topic.title.toLowerCase().includes(w)?4:JSON.stringify(topic).toLowerCase().includes(w)?1:0),0)}))
  .filter(x=>!words.length||x.score).sort((a,b)=>b.score-a.score).map(x=>x.topic);
}
export function infoPanel(){return `<section class="info-centre"><header><p class="eyebrow">MAKE IT YOURS</p><h2>A little guidance. A lot to explore.</h2><p class="muted small">Find an answer or watch the action happen.</p></header><label class="info-search">Search help<input id="infoQuery" type="search" placeholder="Conditions, scanning, formats…" autocomplete="off"></label><p id="infoCount" class="foot" role="status">${INFO_TOPICS.length} topics</p><div class="info-topics">${INFO_TOPICS.map(t=>`<details class="info-topic panel" id="info-${t.id}" data-info-topic="${t.id}"><summary><span class="eyebrow">${esc(t.category)}</span><b>${esc(t.title)}</b><span class="muted small">${esc(t.summary)}</span></summary><div class="info-topic-body">${t.details.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="actions wrap">${t.lesson?`<button class="btn small" data-act="replayTour" data-lesson="${t.lesson}">▶ Watch the example</button>`:''}<button class="btn ghost small" data-act="infoGo" data-id="${t.id}">${esc(t.action)}</button></div></div></details>`).join('')}</div><p class="info-empty muted" hidden>No topic matches. Try a shorter word, or ask the Home assistant.</p></section>`;}
