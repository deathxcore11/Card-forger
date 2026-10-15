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
const report = { headline: 'Draw cards.', pilot: { hand: null, lines: [] }, pressure: { scenarios: [], challenges: [] }, improve: [], tests: [], omitted: 0 };
aiReviewPanel('mtg', deck, lookup, p);
let complete, calls = 0;
const fetcher = async () => { calls++; return new Promise(resolve => { complete = resolve; }); };
const pending = showAiReview('mtg:popup', () => {}, fetcher);
assert.equal(dialogs.length, 1); assert.equal(dialogs[0].open, true); assert.equal(focused,'close');
assert.match(dialogs[0].nodes['.ai-dialog-body'].innerHTML,/Finding lines/);
assert.equal(dialogs[0].nodes['.ai-dialog-body'].attrs['aria-busy'],'true');
closeAiReview(); assert.equal(focused,'launcher'); assert.equal(dialogs[0].removed,true);
showAiReview('mtg:popup', () => {}, fetcher); assert.equal(calls,1,'reopening progress never duplicates paid request');
complete(Response.json(report)); await pending;
assert.match(dialogs[1].nodes['.ai-dialog-body'].innerHTML,/Coaching ready/);
assert.equal(dialogs[1].nodes['.ai-dialog-body'].attrs['aria-busy'],'false');
let prevented=false; dialogs[1].handlers.cancel({preventDefault(){prevented=true;}});
assert.ok(prevented); assert.equal(dialogs[1].open,false); assert.equal(focused,'launcher');
showAiReview('mtg:popup',()=>{},fetcher); assert.equal(calls,1,'opening completed report is free');
// Quantity changes invalidate even the currently open report.
deck.cards[0].qty=3; aiReviewPanel('mtg',deck,lookup,p);
assert.match(dialogs[2].nodes['.ai-dialog-body'].innerHTML,/The deck changed/);
closeAiReview();
await showAiReview('mtg:popup',()=>{},async()=>Response.json({code:'billing',message:'Check credits.'},{status:503}));
assert.match(dialogs[3].nodes['.ai-dialog-body'].innerHTML,/API billing needs attention/);
assert.match(dialogs[3].nodes['.ai-dialog-body'].innerHTML,/Check credits/);
assert.equal(dialogs[3].nodes['.ai-dialog-body'].attrs['aria-busy'],'false');
// Explicit retry is allowed; it is never triggered automatically by rendering.
closeAiReview();
assert.match(aiReviewDialogContent({busy:true}),/No automatic retries/);
assert.doesNotMatch(aiReviewDialogContent({busy:true}),/\d+%/,'no fabricated progress percentage');
assert.match(aiReviewDialogContent({error:'<img onerror=evil()>',errorCode:'rate_limit'}),/&lt;img/);
const css=readFileSync('style.css','utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.ai-review-dialog/);
console.log('PASS: AI popup progress/result/error lifecycle, native dismissal, focus restoration, no duplicate calls when reopening and active stale-deck protection.');
