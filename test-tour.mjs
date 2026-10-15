import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const { shouldTour, STEPS } = await import("./tour.js");
assert.equal(shouldTour({ cards: 0, decks: 0, seen: false }), true, "brand new: show");
assert.equal(shouldTour({ cards: 3, decks: 0, seen: false }), true, "existing collectors can learn new features");
assert.equal(shouldTour({ cards: 0, decks: 0, seen: true }), false, "seen: never again");
assert.equal(STEPS.length, 9);
assert.deepEqual(STEPS.map((s) => s.key), ["scan", "build", "power", "prices", "ask", "collect", "upgrade", "practice", "backup"]);
const demo = STEPS[4].demo(Object.assign(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"], { names: [], meta: "Dragapult <x>" }));
assert.match(demo, /f\.jpg/); assert.match(demo, /Dragapult &lt;x&gt;/); assert.ok(STEPS[4].examples.length >= 3);
console.log("PASS: first-run tour for new and existing collectors, once; nine animated demos with real card art, Ask AI examples, escaped text.");

const {homeHero}=await import('./tcg.js');
for(const g of ['mtg','ptcg','ygo']) { const html=homeHero(g,'Welcome');assert.match(html,/Learn CardStashy/);assert.match(html,/data-act="replayTour"/); }
for(const step of STEPS) assert.ok(step.demo(Object.assign([],{names:[]})).includes('tv-phone'));
console.log('PASS: always-visible Home tour entry in all three games and animated demos for every guide chapter.');
const dialogs=[];
globalThis.document={activeElement:{isConnected:true,focus(){}},querySelector:()=>null,body:{append:e=>dialogs.push(e)},createElement:()=>({dataset:{},handlers:{},classList:{add(){}},setAttribute(){},addEventListener(k,f){this.handlers[k]=f;},querySelector(){return {focus(){}};},remove(){this.removed=true;}})};
const {openTour,tourSeen}=await import('./tour.js');let completions=0;
openTour({onDone:()=>completions++});const dialog=dialogs.at(-1);
assert.match(dialog.innerHTML,/Step 1 of 9/);
for(let n=0;n<12;n++) dialog.handlers.keydown({key:'ArrowRight'});
assert.match(dialog.innerHTML,/Step 9 of 9/);assert.match(dialog.innerHTML,/Keep your cards safe/);
for(let n=0;n<12;n++) dialog.handlers.keydown({key:'ArrowLeft'});
assert.match(dialog.innerHTML,/Step 1 of 9/);
dialog.handlers.keydown({key:'Escape'});dialog.handlers.keydown({key:'Escape'});
assert.equal(completions,1);assert.equal(tourSeen(),true);
openTour();assert.match(dialogs.at(-1).innerHTML,/Step 1 of 9/,'explicit replay works even after dismissal');
console.log('PASS: nine-slide navigation stays in bounds, dismissal is idempotent, seen state persists and explicit replay still works.');
