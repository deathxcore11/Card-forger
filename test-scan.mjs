import assert from "node:assert/strict";
import { scanNamesFor, ygoSetCodes, ygoPasscodes, ptcgNumbers, mtgCollector, guideQuality } from "./scan.js";
import { scanControls, openScanCamera, transformPhoto } from "./scan-camera.js";

const ygo = "Blue-Eyes White Dragon\n[DRAGON/NORMAL]\nThis legendary dragon is a powerful engine of destruction.\nATK/3000 DEF/2500\nLOB-EN0O1\n89631139\n1st Edition";
assert.deepEqual(ygoSetCodes(ygo), ["LOB-EN001"], "set code, with O read as 0");
assert.deepEqual(ygoPasscodes(ygo), ["89631139"]);
assert.equal(scanNamesFor("ygo", ygo)[0], "Blue-Eyes White Dragon");
assert.deepEqual(ygoSetCodes("MP23-EN125 · RA03 - EN016"), ["MP23-EN125", "RA03-EN016"]);

const pk = "BASIC\nPikachu ex HP190\nPika-Pika Parade\nSearch your deck for any number of Basic Pokémon\nweakness x2 resistance retreat\nIllus. 5ban Graphics\n053/128 ★★";
assert.deepEqual(ptcgNumbers(pk), [{ num: "053", total: "128" }]);
assert.equal(scanNamesFor("ptcg", pk)[0], "Pikachu ex", "HP is stripped and BASIC ignored");

const mtg = "Lightning Bolt\nInstant\nLightning Bolt deals 3 damage to any target.\n0157/0281 C\nFDN • EN  Christopher Moeller";
assert.deepEqual(mtgCollector(mtg), { set: "fdn", number: "157" });
assert.equal(mtgCollector("Lightning Bolt\nInstant"), null);
// Real misreads from a phone-quality OCR pass.
assert.deepEqual(mtgCollector("162/274 R E\nM21 + EN %> LEESHA HANNIGAN"), { set: "m21", number: "162" });
assert.equal(scanNamesFor("ygo", "DARK MAGICIAN HE)\n3555505")[0], "DARK MAGICIAN");
const pk2 = "5 Pikachu@X 41904)\nx Pika-Pika Parade\n(3) EE 0537128 Ne—— ;";
assert.equal(scanNamesFor("ptcg", pk2)[0], "Pikachu ex");
assert.deepEqual(ptcgNumbers(pk2), [{ num: "053", total: "128" }]);
console.log("PASS: scan text — Yu-Gi-Oh! set codes and passcodes, Pokémon collector numbers, Magic set + collector number, names per game.");

assert.equal(scanNamesFor("ptcg", "snce1 Eldegoss\nHP90")[0], "Eldegoss", "real noisy phone title");
assert.equal(scanNamesFor("ptcg", "BASIC Mewtwo GX HP190")[0], "Mewtwo GX");
assert.equal(scanNamesFor("ptcg", "Stage 1 Eldegoss HP90")[0], "Eldegoss");
assert.equal(scanNamesFor("ygo", "Blue-Eyes White Dragon")[0], "Blue-Eyes White Dragon", "legitimate name is preserved");
const width = 320, height = 448, box = { x: 45, y: 63, w: 230, h: 322 };
const image = value => ({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(value) });
assert.equal(guideQuality(image(120), box).state, "red", "blank frame never gives green");
const card = image(10);
for (let y = box.y; y <= box.y + box.h; y++) for (let x = box.x; x <= box.x + box.w; x++) {
  const v = (x % 4 < 2 && y % 4 < 2) ? 120 : 200;
  card.data.fill(v, (y * width + x) * 4, (y * width + x) * 4 + 3);
}
assert.equal(guideQuality(card, box).state, "green", "aligned detailed synthetic card passes capture checks");
const blurred = image(10);
for (let y = box.y; y <= box.y + box.h; y++) for (let x = box.x; x <= box.x + box.w; x++) blurred.data.fill(120, (y * width + x) * 4, (y * width + x) * 4 + 3);
assert.equal(guideQuality(blurred, box).state, "amber", "aligned flat image lacks focus/detail");
const controls = scanControls({ url: "blob:test", busy: false });
assert.match(controls, /Live camera/); assert.match(controls, /Apply crop/); assert.match(controls, /Rotate 90/);
assert.match(controls, /Japanese \(text only; English database\)/);
// Test lifecycle with a minimal camera DOM. Camera permission is asynchronous:
// closing while it is pending must stop any stream that arrives later.
let trackStopped = false, closeListener;
globalThis.document = {
  activeElement: { focus() {} }, hidden: false,
  body: { append() {} }, addEventListener() {}, removeEventListener() {},
  createElement(tag) {
    if (tag === "canvas") return { getContext: () => ({}) };
    const close = {};
    return { setAttribute() {}, showModal() {}, remove() {}, addEventListener(type, fn) { if (type === "cancel") closeListener = fn; }, querySelector(selector) { return selector === "#cameraClose" ? close : {}; } };
  },
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };
let finishPermission;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(resolve => { finishPermission = resolve; }) } } });
const starting = openScanCamera(() => assert.fail("closed camera must not capture"));
closeListener();
finishPermission({ getTracks: () => [{ stop() { trackStopped = true; } }] });
await starting;
assert.equal(trackStopped, true, "late camera stream released after close");
console.log("PASS: noisy title regression, capture-quality states, scanner controls and camera close lifecycle.");
