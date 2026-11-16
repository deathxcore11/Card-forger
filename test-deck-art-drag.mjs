// Deck art by drag and drop: the header hit test and the edge scroll that lets a long deck reach its header.
import assert from 'node:assert/strict';
import {heroAt, edgeScroller, LIFT_MS} from './deck-art-drag.js';

const hero = {getBoundingClientRect: () => ({left: 10, right: 310, top: 50, bottom: 250})};
const root = {querySelector: s => (s === '.deck-hero' ? hero : null)};
assert.equal(heroAt(100, 100, root), hero);
assert.equal(heroAt(100, 260, root), null);
assert.equal(heroAt(5, 100, root), null);
assert.equal(heroAt(100, 100, {querySelector: () => null}), null);

// Fake window: frames run on demand.
const frames = [];
const win = {innerHeight: 800, scrolled: 0, scrollBy(_, y) { this.scrolled += y; },
  requestAnimationFrame: f => (frames.push(f), frames.length), cancelAnimationFrame() { frames.length = 0; }};
const run = n => { for (let i = 0; i < n && frames.length; i++) frames.shift()(); };
let calls = 0;
const edge = edgeScroller(() => calls++, win);
edge.at(100, 400); run(3);
assert.equal(win.scrolled, 0, 'no scroll in the middle of the screen');
edge.at(100, 20); run(3);
assert.ok(win.scrolled < 0, 'holding near the top scrolls up');
assert.ok(calls > 0, 'the cue is re-checked after each step');
const up = win.scrolled;
edge.at(100, 790); run(3);
assert.ok(win.scrolled > up, 'holding near the bottom scrolls down');
edge.stop(); const at = win.scrolled; run(3);
assert.equal(win.scrolled, at, 'stop ends the scroll');
assert.ok(LIFT_MS >= 150 && LIFT_MS <= 400, 'touch lift is a short hold');
console.log('deck art drag ok');
