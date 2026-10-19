// Haptic choices by action, and the off switch.
import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
let buzz = [];
Object.defineProperty(globalThis, "navigator", { value: { vibrate: (p) => buzz.push(p), userAgent: "Android" }, configurable: true });
const F = await import("./feel.js");
assert.equal(F.hapticFor("sessClear"), "warn");
assert.equal(F.hapticFor("deckDel"), "warn");
assert.equal(F.hapticFor("tOwn"), "tap");
assert.equal(F.hapticFor("x", { getAttribute: (a) => (a === "role" ? "tab" : null), closest: () => null, dataset: {} }), "tick");
F.haptic("success");
assert.deepEqual(buzz.at(-1), F.PATTERNS.success);
F.setHaptics(false);
F.haptic("success");
assert.equal(buzz.length, 1, "off means off");
console.log("PASS: haptics map actions to the right feel and respect the setting.");

// Normal motion previously treated scanner metadata as a count-up target and
// erased the nested review button. Model textContent's destructive DOM semantics
// while running the real countUp scheduler without a browser or timers.
const original={matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,performance:globalThis.performance};
try{
 let reduce=false,frames=[];
 globalThis.matchMedia=()=>({matches:reduce});
 globalThis.performance={now:()=>0};
 globalThis.requestAnimationFrame=callback=>frames.push(callback);
 const node=(count,{children=[],money=false,text=String(count)}={})=>({
  dataset:{count:String(count),...(money?{money:'1'}:{})},children,writes:0,value:text,
  get childElementCount(){return this.children.length;},
  get textContent(){return this.value;},
  set textContent(value){this.writes++;this.value=value;this.children=[];}
 });
 const button={tagName:'BUTTON',id:'review'},icon={tagName:'SVG',id:'counter-icon'};
 const tray=node(6,{children:[button],text:'Review scans'}),decorated=node(12,{children:[icon],text:'12 cards'}),count=node(6),money=node('12.50',{money:true}),invalid=node('not-a-number');
 const nodes=[tray,decorated,count,money,invalid],root={querySelectorAll:()=>nodes.filter(n=>!n.dataset.counted)};
 const tick=t=>{const pending=frames;frames=[];for(const callback of pending)callback(t);};
 F.countUp(root);assert.equal(frames.length,2,'Only finite positive numeric text leaves animate');
 tick(0);assert.equal(count.textContent,'0');assert.equal(money.textContent,'$'+(0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));
 tick(350);assert.notEqual(count.textContent,'0');assert.notEqual(count.textContent,'6');
 tick(700);assert.equal(count.textContent,'6');assert.equal(money.textContent,'$'+(12.5).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));
 assert.equal(frames.length,0);F.countUp(root);assert.equal(frames.length,0,'Completed leaves animate only once');
 assert.equal(tray.textContent,'Review scans');assert.equal(tray.children[0],button);assert.equal(tray.writes,0);
 assert.equal(decorated.textContent,'12 cards');assert.equal(decorated.children[0],icon);assert.equal(decorated.writes,0,'Icons and nested labels are never replaced');
 assert.equal(invalid.writes,0);
 const changed=node(9);F.countUp({querySelectorAll:()=>[changed]});changed.children.push(button);tick(700);
 assert.equal(changed.writes,0,'A leaf becoming a control container before its next frame is also protected');assert.equal(changed.children[0],button);
 reduce=true;const still=node(8);F.countUp({querySelectorAll:()=>[still,tray]});assert.equal(frames.length,0);assert.equal(still.textContent,'8');assert.equal(still.writes,0);assert.equal(tray.children[0],button);
 console.log('PASS: normal-motion count-up preserves nested controls and icons, animates genuine numeric/currency leaves once, and respects reduced motion.');
}finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
