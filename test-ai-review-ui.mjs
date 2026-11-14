import assert from 'node:assert/strict';
import { aiReviewPanel, showAiReview, closeAiReview, aiReviewDialogContent } from './ai-review.js';
import { readFileSync } from 'node:fs';
// A small DOM boundary fake exercises dialog lifecycle while API requests remain stubbed.
const dialogs = []; let focused = '';
const launch = { dataset: { ai: 'mtg:popup' }, focus: () => { focused = 'launcher'; } };
function element() { return { innerHTML: '', textContent: '', attrs: {}, setAttribute(k,v){this.attrs[k]=v;}, focus(){focused='close';} }; }
globalThis.document = {
 body: { append(d) { dialogs.push(d); } }, querySelectorAll: () => [launch],
 createElement: () => ({ ...element(), nodes: { '.ai-dialog-body': element(), '.ai-dialog-status': element(), '[data-ai-close]': element() }, handlers: {},
  querySelector(q) { return this.nodes[q]; }, addEventListener(k,f){this.handlers[k]=f;}, showModal(){this.open=true;}, close(){this.open=false;}, remove(){this.removed=true;} })
};
const deck = { id: 'popup', cards: [{ name: 'Engine', qty: 4 }] }, p = { heuristic: 60, formatName: 'Casual' }, lookup = () => ({ name: 'Engine', oracle_text: 'Draw two cards.' });
const report = { headline: 'Draw cards.', priority: '', identity: { plan: 'Draw cards.', howItWins: '', winCards: [], engineCards: [] }, explain: [], beyond: [], pilot: { hand: null, lines: [] }, pressure: { scenarios: [] }, improve: [], tests: [], omitted: 0 };
aiReviewPanel('mtg', deck, lookup, p);
const compact=aiReviewPanel('mtg', deck, lookup, p, {}, {compact:true});assert.match(compact,/Coach this deck/);assert.doesNotMatch(compact,/OpenAI|AI review/);assert.match(compact,/stashy-logo/);assert.match(compact,/data-ai="mtg:popup"/);assert.doesNotMatch(compact,/ai-review-launch/);
let calls = 0;
const fetcher = async () => { calls++; throw Error('the coach must not use the network'); };
// The slow part (Power trying swaps) is a hook; hold it to see the progress state.
let release; const slow = { candidates: () => [{ name: 'Owned', oracle_text: 'Draw a card.' }], probe: () => [] };
aiReviewPanel('mtg', deck, lookup, p, slow);
const pending = showAiReview('mtg:popup', () => {}, fetcher);
assert.equal(dialogs.length, 1); assert.equal(dialogs[0].open, true); assert.equal(focused,'close');
assert.match(dialogs[0].nodes['.ai-dialog-body'].innerHTML,/Coaching your deck/);
assert.equal(dialogs[0].nodes['.ai-dialog-body'].attrs['aria-busy'],'true');
closeAiReview(); assert.equal(focused,'launcher'); assert.equal(dialogs[0].removed,true);
showAiReview('mtg:popup', () => {}, fetcher); await pending;
assert.match(dialogs[1].nodes['.ai-dialog-body'].innerHTML,/Coaching ready/);
assert.equal(dialogs[1].nodes['.ai-dialog-body'].attrs['aria-busy'],'false');
let prevented=false; dialogs[1].handlers.cancel({preventDefault(){prevented=true;}});
assert.ok(prevented); assert.equal(dialogs[1].open,false); assert.equal(focused,'launcher');
showAiReview('mtg:popup',()=>{},fetcher); assert.equal(calls,0,'the coach never calls the network');
// Quantity changes invalidate even the currently open report.
deck.cards[0].qty=3; aiReviewPanel('mtg',deck,lookup,p);
assert.match(dialogs[2].nodes['.ai-dialog-body'].innerHTML,/The deck changed/);
closeAiReview();
assert.doesNotMatch(aiReviewDialogContent({busy:true}),/\d+%/,'no fabricated progress percentage');
assert.match(aiReviewDialogContent({error:'<img onerror=evil()>'}),/&lt;img/);
assert.match(aiReviewDialogContent({result:report,payload:{hand:[]},rows:[],game:'mtg'}),/with no AI/);
const css=readFileSync('style.css','utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.ai-review-dialog/);
console.log('PASS: coach popup progress/result/error lifecycle, native dismissal, focus restoration, zero network calls and active stale-deck protection.');
