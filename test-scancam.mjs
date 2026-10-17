// The scanner's guide: red / amber / green from frame checks, on synthetic grey frames.
import assert from "node:assert/strict";
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { frameMetrics, guideState, guideRect } = await import("./scancam.js");
const W = 120, H = 160, g = guideRect(W, H, 0.8);
const rnd = (x, y) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
const frame = ({ card = true, dx = 0, blur = false, glare = false, dark = false } = {}) => {
  const a = new Float32Array(W * H).fill(dark ? 20 : 70);
  if (card)
    for (let y = Math.round(g.y); y < g.y + g.h; y++)
      for (let x = Math.round(g.x + dx); x < g.x + dx + g.w && x < W; x++) {
        // Text-like ink: short random strokes inside the card, not long straight lines.
        const ink = !blur && y > g.y + 6 && y < g.y + g.h - 6 && x > g.x + dx + 5 && x < g.x + dx + g.w - 5 && rnd(x - Math.round(dx), y) < 0.35;
        a[y * W + x] = dark ? 30 : glare && y < g.y + g.h * 0.45 && x < g.x + g.w * 0.6 ? 255 : ink ? 60 : 225;
      }
  return a;
};
const st = (f, prev, steady = 5) => guideState(frameMetrics(f, W, H, g, prev), steady);
const ok = frame();
assert.equal(st(frame({ card: false })).state, "red", "no card → red");
assert.equal(st(frame({ dx: 30 })).state, "red", "card off to the side → red");
assert.equal(st(frame({ dark: true })).msg, "Too dark. Find more light");
assert.equal(st(frame({ blur: true })).state, "amber", "blurry → amber");
assert.match(st(frame({ glare: true })).msg, /glare/, "glare → amber with a glare tip");
assert.equal(st(ok, frame({ dx: 30 })).msg, "Hold steady", "moving → amber");
assert.equal(st(ok, ok, 0).state, "amber", "not green on the first steady frame");
assert.equal(st(ok, ok, 5).state, "green", "steady, sharp, aligned → green");
for (const s of [st(ok, ok, 5), st(frame({ card: false }))]) assert.ok(s.msg && s.icon, "every state has words and an icon, not just a colour");
{
  const { visibleGuide } = await import("./scancam.js");
  // Landscape feed shown in a portrait box: the guide stays inside the visible middle.
  const g = visibleGuide(1920, 1080, 360, 560), k = Math.max(360 / 1920, 560 / 1080), visW = 360 / k;
  assert.ok(g.x >= (1920 - visW) / 2 - 0.5 && g.x + g.w <= (1920 + visW) / 2 + 0.5, "guide fits the visible width");
  assert.ok(Math.abs(g.w / g.h - 63 / 88) < 0.01, "card-shaped");
}
console.log("PASS: scan guide — red (no card / off-frame / dark), amber (blur, glare, motion), green only when steady.");
// A card on a dark background is found; a plain photo isn't mistaken for one.
{
  const { findCardBox } = await import("./scancam.js");
  const W = 160, H = 340, d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, inCard = x >= 52 && x < 108 && y >= 80 && y < 158; d[i] = d[i + 1] = d[i + 2] = inCard ? 200 : 25; d[i + 3] = 255; }
  const b = findCardBox(d, W, H);
  assert.ok(b && Math.abs(b.x - 52 / W) < 0.04 && Math.abs(b.h - 78 / H) < 0.06, JSON.stringify(b));
  assert.equal(findCardBox(new Uint8ClampedArray(W * H * 4).fill(90), W, H), null);
  console.log("card box ok");
}
{
  const { settleLimited } = await import("./scancam.js");
  let live = 0, peak = 0;
  const r = await settleLimited([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], async (x) => { live++; peak = Math.max(peak, live); await new Promise((ok) => setTimeout(ok, 5)); live--; if (x === 3) throw Error("x"); return x * 2; }, 3);
  assert.equal(peak, 3, "never more than 3 at once");
  assert.equal(r[1].value, 4);
  assert.equal(r[2].status, "rejected");
  console.log("PASS: limited parallel downloads.");
}

// A full-card reference has no outside pixels. Its internal artwork must not
// replace the title/footer with a rotated art-only quadrilateral.
const {preserveWholeCardPhoto}=await import('./scancam.js');
for(const [w,h] of [[488,680],[600,825],[421,614]])assert(preserveWholeCardPhoto(w,h),'card-aspect uploads retain the complete title and footer');
assert.equal(preserveWholeCardPhoto(1200,1600),false,'ordinary phone photos still get free-angle detection');
assert.equal(preserveWholeCardPhoto(1600,1200),false,'landscape photos still get free-angle detection');
assert.equal(preserveWholeCardPhoto(488,680,{x:.2,y:.2,w:.5,h:.5}),false,'observed background still allows cropping the card');
console.log('PASS: already card-shaped photo uploads preserve name/footer instead of rotating an internal art window.');
