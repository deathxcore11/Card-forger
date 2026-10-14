import { ask, askText } from "./dialog.js";
// Card scanner for all three games:
//   live camera → card in the guide → quality checks → crop → read name & code strips → match → confirm → add
// Text recognition runs on the phone (Tesseract). The guide's colour is about capture quality only:
//   red    = no card edges in the guide (or far too dark)
//   amber  = card found but moving, blurry or glared
//   green  = edges, sharpness, light and stillness all pass for several frames → ready to capture
// Thresholds are starting points tuned on test images; they should be refined with real phone photos.
import { S } from "./store.js";
import { esc } from "./ui.js";
import { nameCandidates, detectGame, anchoredNames, scanNameKey } from "./scan.js";
import { fingerprintCanvas, fingerprintUrl, rankPrintings, likeness, hashCanvas, nearest } from "./scanart.js";
import { artworkHTML, artworkSources } from "./artwork.js";
import { openZoom } from "./zoom.js";
import { FINISHES, CONDITIONS, LANGS, QTYS, loadPrefs, savePrefs, loadSession, saveSession, addToSession, itemKey, sessionCount, sessionValue, sessionUnpriced, sessionText, feedback } from "./scansession.js";

const CARD = 63 / 88; // card width / height
// Where the name and the identifying code sit on each game's card (fractions of the card).
export const LAYOUT = {
  mtg: { name: [0.04, 0.025, 0.74, 0.07], code: [0.0, 0.905, 0.62, 0.075] },
  // Modern Pokémon cards print the number at the very bottom-left (older ones a little higher).
  ptcg: { name: [0.1, 0.02, 0.62, 0.075], code: [0.0, 0.93, 0.55, 0.07], pass: [0.55, 0.88, 0.45, 0.08] },
  ygo: { name: [0.04, 0.025, 0.8, 0.075], code: [0.5, 0.7, 0.5, 0.06], pass: [0.0, 0.94, 0.45, 0.06] },
};
// Calibrated on test video (sharp card ≈ 3000, 4px blur ≈ 280, empty table ≈ 1); refine on real phones.
export const T = { edge: 0.6, step: 18, sharp: 150, glare: 0.035, dark: 45, motion: 9, greenFrames: 3 };

/* ---------- image checks (pure; tested) ---------- */

export function toGray(rgba, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  return g;
}

/**
 * gray: w×h luminance of the guide area plus a margin; guide: {x, y, w, h} in those pixels.
 * Returns edge strength per side (top, right, bottom, left), sharpness, glare, brightness, motion.
 */
export function frameMetrics(gray, w, h, g0, prev = null) {
  const guide = { x: Math.round(g0.x), y: Math.round(g0.y), w: Math.round(g0.w), h: Math.round(g0.h) },
    at = (x, y) => gray[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))],
    band = Math.max(2, Math.round(Math.min(guide.w, guide.h) * 0.045)),
    inset = (a, b, f) => [Math.round(a + (b - a) * f), Math.round(b - (b - a) * f)];
  // A card edge is a contrast step along most of the line (texture inside the card isn't):
  // the score is the share of positions on the best line near the guide with a strong step.
  const horiz = (y0) => {
    let best = 0;
    const [x0, x1] = inset(guide.x, guide.x + guide.w, 0.12);
    for (let y = y0 - band; y <= y0 + band; y++) {
      let n = 0;
      for (let x = x0; x < x1; x++) if (Math.abs(at(x, y + 1) - at(x, y - 1)) > T.step) n++;
      best = Math.max(best, n / Math.max(1, x1 - x0));
    }
    return best;
  };
  const vert = (x0) => {
    let best = 0;
    const [y0, y1] = inset(guide.y, guide.y + guide.h, 0.12);
    for (let x = x0 - band; x <= x0 + band; x++) {
      let n = 0;
      for (let y = y0; y < y1; y++) if (Math.abs(at(x + 1, y) - at(x - 1, y)) > T.step) n++;
      best = Math.max(best, n / Math.max(1, y1 - y0));
    }
    return best;
  };
  const sides = [horiz(guide.y), vert(guide.x + guide.w), horiz(guide.y + guide.h), vert(guide.x)];
  // Inside the card: sharpness (variance of the Laplacian), glare (blown-out pixels), brightness.
  const [ix0, ix1] = inset(guide.x, guide.x + guide.w, 0.08),
    [iy0, iy1] = inset(guide.y, guide.y + guide.h, 0.08);
  let n = 0,
    sum = 0,
    lapSum = 0,
    lapSq = 0,
    hot = 0;
  for (let y = iy0; y < iy1; y++)
    for (let x = ix0; x < ix1; x++) {
      const v = at(x, y),
        lap = 4 * v - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1);
      n++;
      sum += v;
      lapSum += lap;
      lapSq += lap * lap;
      if (v > 248) hot++;
    }
  const mean = sum / Math.max(1, n),
    sharp = lapSq / Math.max(1, n) - (lapSum / Math.max(1, n)) ** 2;
  let motion = 0;
  if (prev && prev.length === gray.length) {
    for (let i = 0; i < gray.length; i += 3) motion += Math.abs(gray[i] - prev[i]);
    motion /= gray.length / 3;
  }
  return { sides, edges: sides.filter((s) => s >= T.edge).length, sharp, glare: hot / Math.max(1, n), bright: mean, motion };
}

// Turn the checks into the guide's state, with words (never colour alone).
export function guideState(m, steady = 0) {
  if (m.bright < T.dark) return { state: "red", icon: "◐", msg: "Too dark. Find more light" };
  if (m.edges < 3) return { state: "red", icon: "▢", msg: "Move the whole card inside the frame" };
  if (m.motion > T.motion) return { state: "amber", icon: "✋", msg: "Hold steady" };
  if (m.glare > T.glare) return { state: "amber", icon: "☀", msg: "Tilt slightly to reduce glare" };
  if (m.sharp < T.sharp) return { state: "amber", icon: "◎", msg: "Blurry. Hold still" };
  if (m.edges < 4) return { state: "amber", icon: "▢", msg: "Line the edges up with the frame" };
  return steady + 1 >= T.greenFrames ? { state: "green", icon: "✓", msg: "Got it" } : { state: "amber", icon: "✋", msg: "Hold steady…" };
}

// Where the guide sits in a video/image of size vw×vh (same rule for the overlay and the crop).
// The guide in video pixels, sized to the part of the video that is visible on screen (the box
// crops the feed with object-fit: cover). cw/ch: the box size; omit them to use the whole frame.
export function visibleGuide(vw, vh, cw = 0, ch = 0) {
  if (!cw || !ch) return guideRect(vw, vh);
  const k = Math.max(cw / vw, ch / vh),
    visW = Math.min(vw, cw / k),
    visH = Math.min(vh, ch / k),
    g = guideRect(visW, visH);
  return { x: g.x + (vw - visW) / 2, y: g.y + (vh - visH) / 2, w: g.w, h: g.h };
}
export function guideRect(vw, vh, fill = 0.86) {
  let gh = vh * fill,
    gw = gh * CARD;
  if (gw > vw * fill) {
    gw = vw * fill;
    gh = gw / CARD;
  }
  return { x: (vw - gw) / 2, y: (vh - gh) / 2, w: gw, h: gh };
}

/* ---------- text recognition ---------- */

let ocrLoading = null,
  worker = null,
  workerLang = "";
function loadOCR() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return (ocrLoading ||= new Promise((ok, bad) => {
    const el = document.createElement("script");
    el.src = "vendor/tesseract.min.js";
    el.onload = () => ok(window.Tesseract);
    el.onerror = () => {
      ocrLoading = null;
      bad(Error("Text reader couldn’t load. Type the name instead."));
    };
    document.head.appendChild(el);
  }));
}
async function getWorker(lang, progress) {
  if (worker && workerLang === lang) return worker;
  if (worker) await worker.terminate().catch(() => {});
  const Tess = await loadOCR();
  worker = await Tess.createWorker(lang, 1, {
    workerPath: new URL("vendor/worker.min.js", location.href).href,
    workerBlobURL: false,
    logger: (m) => m.status && progress?.(m.status + (typeof m.progress === "number" ? " · " + Math.round(m.progress * 100) + "%" : "")),
  });
  workerLang = lang;
  return worker;
}
export async function releaseOCR() {
  if (worker) await worker.terminate().catch(() => {});
  worker = null;
  workerLang = "";
}
// A region of the card, enlarged and high-contrast, for the reader. Small photos (a card in the
// corner of a picture, a screenshot) are scaled up so letters are tall enough to read.
function regionCanvas(card, [fx, fy, fw, fh], scale = 2, invert = false) {
  const rw = card.width * fw,
    k = Math.min(6, Math.max(scale, 1100 / Math.max(1, rw)));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(rw * k));
  c.height = Math.max(1, Math.round(card.height * fh * k));
  const ctx = c.getContext("2d");
  ctx.filter = `grayscale(1) contrast(1.6)${invert ? " invert(1)" : ""}`;
  ctx.drawImage(card, card.width * fx, card.height * fy, rw, card.height * fh, 0, 0, c.width, c.height);
  return c;
}
const recog = async (w, canvas) => ((await w.recognize(canvas)).data.text || "").trim();
// Where the card is in a photo: the longest run of rows and of columns that differ from the
// photo's border (a table, a playmat, a dark screen). Returns fractions, or null if no card shape.
export function findCardBox(data, W, H) {
  const px = (x, y) => (y * W + x) * 4,
    edge = [];
  for (let x = 0; x < W; x++) edge.push(px(x, 0), px(x, H - 1));
  for (let y = 0; y < H; y++) edge.push(px(0, y), px(W - 1, y));
  const med = [0, 1, 2].map((c) => edge.map((i) => data[i + c]).sort((a, b) => a - b)[edge.length >> 1]),
    off = (x, y) => {
      const i = px(x, y);
      return Math.abs(data[i] - med[0]) + Math.abs(data[i + 1] - med[1]) + Math.abs(data[i + 2] - med[2]) > 60;
    };
  // Longest run of card-like rows (or columns). Short gaps are bridged: dark art the colour of
  // the table can make a few rows look like background.
  const run = (n, m, at) => {
    const gap = Math.max(2, Math.round(n * 0.03));
    let best = [0, -1], start = -1, lastIn = -1;
    for (let a = 0; a <= n; a++) {
      let k = 0;
      if (a < n) for (let b = 0; b < m; b++) k += at(a, b) ? 1 : 0;
      if (a < n && k / m > 0.2) {
        if (start < 0) start = a;
        lastIn = a;
      } else if (start >= 0 && (a === n || a - lastIn > gap)) {
        if (lastIn + 1 - start > best[1] - best[0]) best = [start, lastIn + 1];
        start = -1;
      }
    }
    return best;
  };
  const [y0, y1] = run(H, W, (y, x) => off(x, y)),
    [x0, x1] = run(W, H, (x, y) => y >= y0 && y < y1 && off(x, y));
  const w = (x1 - x0) / W, h = (y1 - y0) / H, aspect = (x1 - x0) / Math.max(1, y1 - y0);
  // A card that already fills the photo isn't cropped (its own frame would look like the edge).
  if (w * h < 0.04 || w * h > 0.6 || aspect < 0.55 || aspect > 0.9) return null;
  // A little margin so the card's edge and corners stay in.
  const m = 0.02, bx = Math.max(0, x0 / W - m), by = Math.max(0, y0 / H - m);
  return { x: bx, y: by, w: Math.min(1 - bx, w + 2 * m), h: Math.min(1 - by, h + 2 * m) };
}

// Read the name strip and the code strip separately; the whole card only as a fallback.
export async function readCard(card, g, lang, progress = () => {}, { codeOnly = false } = {}) {
  const w = await getWorker(lang, progress),
    L = LAYOUT[g] || LAYOUT.mtg;
  // The artwork already named the card: only the set code / number is needed.
  if (codeOnly) {
    progress("Reading the set code…");
    return { name: "", code: [await recog(w, regionCanvas(card, L.code, 3)), L.pass ? await recog(w, regionCanvas(card, L.pass, 3)) : ""].join("\n"), full: "" };
  }
  progress("Reading the name…");
  let name = await recog(w, regionCanvas(card, L.name, 2.5));
  // Light letters on a dark banner (full-art, GX, foils) read better inverted.
  if (!nameCandidates(g, name).length) name = [name, await recog(w, regionCanvas(card, L.name, 2.5, true))].join("\n");
  // A tilted or loosely cropped photo puts the name lower: read a taller strip.
  if (!nameCandidates(g, name).length) name = [name, await recog(w, regionCanvas(card, [0, 0, 1, 0.16], 2))].join("\n");
  progress("Reading the set code and number…");
  const code = [await recog(w, regionCanvas(card, L.code, 3)), L.pass ? await recog(w, regionCanvas(card, L.pass, 3)) : ""].join("\n");
  let full = "";
  if (!nameCandidates(g, name).length) {
    progress("Reading the whole card…");
    full = await readFull(card, lang, progress);
  }
  return { name, code, full };
}
// The whole card as text: for finding the name wherever it is and telling which game it is.
export async function readFull(card, lang, progress = () => {}) {
  const w = await getWorker(lang, progress);
  progress("Reading the whole card…");
  return recog(w, regionCanvas(card, [0, 0, 1, 1], 1));
}

/* ---------- view ---------- */

const LANG_KEY = "cardforge-scan-lang";
export const scanLang = () => {
  try {
    return localStorage.getItem(LANG_KEY) || "eng";
  } catch {
    return "eng";
  }
};

// Finishes this printing actually comes in (Magic: Scryfall finishes; Pokémon: its variants).
export function finishesFor(g, cand) {
  const all = FINISHES[g].map((x) => x[0]),
    card = cand?.card || {};
  const have = g === "mtg" ? card.finishes : g === "ptcg" ? (card.variants || []).map((v) => v.key).filter((k) => all.includes(k)) : null;
  const ok = have?.length ? all.filter((f) => have.includes(f)) : all;
  return ok.length ? ok : all;
}
const money = (v) => (v == null ? "—" : "$" + Number(v).toFixed(2));
const label = (list, v) => (list.find((x) => (Array.isArray(x) ? x[0] : x) === v) || [v, v])[1] ?? v;

// The defaults every scan uses: finish, condition, card language and quantity. Tap to change.
// The defaults every scan uses. Each opens a glass dropdown with the full choices.
const LANG_NAME = { en: "English", ja: "Japanese", de: "German", fr: "French", it: "Italian", es: "Spanish", pt: "Portuguese", ko: "Korean", zhs: "Chinese" };
export function pickOptions(g, k) {
  if (k === "finish") return FINISHES[g].map(([v, l]) => ({ v, l, sub: { nonfoil: "Non-foil", foil: "Traditional foil", etched: "Etched foil", normal: "No holo", holofoil: "Holo art", "reverse-holofoil": "Reverse holo", unlimited: "Unlimited print run", "1st-edition": "1st Edition stamp" }[v] }));
  if (k === "condition") return CONDITIONS.map(([v, l]) => ({ v, l, sub: v }));
  if (k === "lang") return LANGS.map(([v, l]) => ({ v, l, sub: LANG_NAME[v] }));
  return QTYS.map((n) => ({ v: n, l: "×" + n, sub: `${n} cop${n === 1 ? "y" : "ies"} per scan` }));
}
const CAPTION = { finish: "Finish", condition: "Condition", lang: "Language", qty: "Copies" };
function defaultsPill(g, p) {
  const seg = (k, val) => `<button data-act="scanPick" data-k="${k}" aria-haspopup="listbox" aria-label="${CAPTION[k]}: ${esc(String(val))}"><small>${CAPTION[k]}</small><span>${esc(String(val))}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`;
  return `<div class="scan-defaults" role="group" aria-label="Defaults for scanned cards">${seg("finish", label(FINISHES[g], p.finish))}${seg("condition", label(CONDITIONS, p.condition))}${seg("lang", label(LANGS, p.lang))}${seg("qty", "×" + p.qty)}</div>`;
}

function sessionPanel(g, p, list) {
  const n = sessionCount(list),
    v = sessionValue(list),
    unp = sessionUnpriced(list);
  return `<section class="panel scan-session" aria-label="Scanned cards">
    <div class="ss-head"><div class="ss-stats"><span class="ss-stat"><b>${n}</b><small>card${n === 1 ? "" : "s"}</small></span>${p.showValue && n ? `<span class="ss-stat"><b>${money(v)}</b><small>${unp ? `+ ${unp} unpriced` : "value"}</small></span>` : ""}</div>
      ${n ? `<button class="btn small ss-save" data-act="sessCommit">Save to collection</button>` : ""}</div>
    <div class="searchbar ss-add"><input id="scanName" placeholder="Add by name${g === "ygo" ? " or set code" : ""}" data-enter="scanFind" aria-label="Add a card by name"><button class="btn ghost small" data-act="scanFind">Find</button></div>
    ${
      n
        ? `<div class="ss-list">${list
            .map((x) => {
              const k = esc(itemKey(x));
              return `<div class="ss-row ${Date.now() - (x.at || 0) < 2500 ? "fresh" : ""}">${x.cand?.card ? artworkHTML(x.cand.card, "ss-img") : x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="ss-noimg"></span>`}
          <span class="ss-txt"><b>${esc(x.name)}</b><small>${esc([x.setCode && String(x.setCode).toUpperCase(), x.number && "#" + x.number].filter(Boolean).join(" "))} · ${esc(label(CONDITIONS, x.condition))} · ${esc(label(LANGS, x.lang))}</small></span>
          ${finishesFor(g, x.cand).length > 1 ? `<button class="ss-chip" data-act="sessFinish" data-k="${k}" title="Tap to change finish">${esc(label(FINISHES[g], x.finish))}</button>` : `<span class="ss-chip fixed" title="Only printed in this finish">${esc(label(FINISHES[g], x.finish))}</span>`}
          <span class="ss-qty"><button data-act="sessQty" data-k="${k}" data-d="-1" aria-label="One fewer">−</button><b>${x.qty}</b><button data-act="sessQty" data-k="${k}" data-d="1" aria-label="One more">＋</button></span>
          ${p.showValue ? `<span class="ss-price">${money(x.price == null ? null : x.price * x.qty)}</span>` : ""}</div>`;
            })
            .join("")}</div>
        <div class="ss-foot"><input id="sessLoc" value="${esc(p.location || "")}" placeholder="Binder or box (optional)" aria-label="Where these cards go"><button class="btn ghost small" data-act="sessCopy">Copy list</button><button class="link small danger" data-act="sessClear">Clear</button></div>`
        : `<div class="ss-empty"><span class="ss-fan" aria-hidden="true"><i></i><i></i><i></i></span><b>Nothing scanned yet</b><small>Cards you scan show up here. When you’re done, save them all to your collection at once.</small></div>`
    }</section>`;
}

const GAME_LABEL = { mtg: "Magic", ygo: "Yu-Gi-Oh!", ptcg: "Pokémon" };

export function scanView(g, gameName) {
  const s = S.ui.scan,
    p = loadPrefs(g),
    list = loadSession(g),
    live = (s.mode || "live") === "live",
    tips = { mtg: "the name at the top and the set code + number at the bottom", ygo: "the name, the set code under the art (like LOB-EN001) and the passcode", ptcg: "the name and the number at the bottom (like 053/128)" }[g];
  // The best match sits beside your own capture, big enough to compare at a glance; tap to zoom.
  const art = (c, cls) => (c.card ? artworkHTML(c.card, cls, true) : c.image ? `<img class="${cls}" src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls} img-missing" role="img" aria-label="Artwork unavailable">◇<small>Art unavailable</small></span>`);
  const cands = (s.cands || [])
    .map((c, i) => {
      const lead = i === 0,
        body = `<div class="sc-body"><b>${esc(c.name)}</b><small>${esc(c.sub || "")}</small><span class="tag ${c.exact ? "ok" : ""}">${esc(c.why)}</span>${c.owned ? `<small class="muted">You own ${c.owned}</small>` : ""}
        <div class="actions wrap"><button class="btn small" data-act="scanAdd" data-i="${i}">Add</button><button class="btn ghost small" data-act="scanDetails" data-i="${i}">Details</button></div></div>`;
      return lead
        ? `<article class="scan-cand2 lead ${c.exact ? "exact" : ""}"><div class="sc-compare">${s.shot ? `<figure><button class="sc-art" data-act="scanZoom" data-i="shot" aria-label="Zoom your capture"><img class="sc-img" src="${s.shot}" alt="Your capture"></button><figcaption>Your card</figcaption></figure>` : ""}<figure><button class="sc-art" data-act="scanZoom" data-i="${i}" aria-label="Zoom ${esc(c.name)}">${art(c, "sc-img")}</button><figcaption>${c.exact ? "Match" : "Best guess"}</figcaption></figure></div>${body}</article>`
        : `<article class="scan-cand2 ${c.exact ? "exact" : ""}"><button class="sc-art" data-act="scanZoom" data-i="${i}" aria-label="Zoom ${esc(c.name)}">${art(c, "sc-img")}</button>${body}</article>`;
    })
    .join("");
  const rail = `<div class="cam-rail">${s.torchCap ? `<button class="${s.torch ? "on" : ""}" data-act="scanTorch" aria-pressed="${!!s.torch}" aria-label="Flashlight">${TORCH}</button>` : ""}<button class="${p.quick ? "on" : ""}" data-act="scanQuick" aria-pressed="${p.quick}" aria-label="Quick mode: exact matches are added without asking">${BOLT}</button><button data-act="scanSettings" aria-label="Scanner settings">${GEAR}</button><button data-act="scanStop" aria-label="Stop camera">${STOP}</button></div>`;
  return `<div class="page-head"><h1>Scan</h1>${p.lockSet ? `<span class="tag">Set locked: ${esc(p.lockSet.toUpperCase())}</span>` : ""}</div>
  <div class="seg" role="tablist"><button role="tab" class="${live ? "on" : ""}" aria-selected="${live}" data-act="scanMode" data-id="live">Live camera</button><button role="tab" class="${live ? "" : "on"}" aria-selected="${!live}" data-act="scanMode" data-id="photo">Photo</button></div>
  <section class="panel scan-panel">
    ${
      live
        ? `<div class="cam-wrap ${s.camOn ? "immersive" : ""}" id="camWrap">${s.camOn ? `<div id="camSlot"></div><div class="cam-guide ${esc(s.guide?.state || "red")}" id="camGuide"></div><div class="cam-status ${esc(s.guide?.state || "red")}" id="camStatus" role="status" aria-live="polite"><i class="cam-dot" aria-hidden="true"></i>${esc(s.guide?.msg || "Starting camera…")}</div>${rail}<div class="scan-flash" id="scanFlash" aria-live="polite"></div>${defaultsPill(g, p)}` : `<div class="scan-drop"><span class="scan-sweep" aria-hidden="true"></span><span class="scan-ghost" aria-hidden="true"></span><b>Point at a card</b><span class="muted small">Hold one ${esc(gameName)} card inside the frame. It scans on its own.</span><span class="scan-tips"><span>${TIP_FLAT} Flat</span><span>${TIP_LIGHT} Bright</span><span>${TIP_GLARE} No glare</span></span><button class="btn scan-go" data-act="scanStart">${CAMERA} Start camera</button><small class="muted scan-tip-line" title="${esc("Keep " + tips + " sharp.")}">Keep the name and the bottom code sharp</small></div>`}</div>
      ${s.camOn ? `<div class="actions wrap scan-under"><button class="btn" id="scanCaptureBtn" data-act="scanCapture">Capture</button><label class="check small"><input type="checkbox" data-change="scanAuto" ${s.auto !== false ? "checked" : ""}> Capture automatically</label></div>` : defaultsPill(g, p)}`
        : `<div class="actions wrap"><label class="btn">${CAMERA} Take photo<input type="file" accept="image/*" capture="environment" data-change="scanFile" hidden></label><label class="btn ghost">Upload<input type="file" accept="image/*" data-change="scanFile" hidden></label></div>
      ${s.url ? `<p class="muted small">Drag a box around the card to crop. Rotate if it’s sideways.</p><div class="crop-wrap" id="cropWrap"><img id="cropImg" src="${s.url}" alt="Your photo"><div class="crop-box" id="cropBox"></div></div>
      <div class="actions wrap"><button class="btn ghost small" data-act="scanRotate">Rotate</button><button class="btn ghost small" data-act="scanCropReset">Whole photo</button><button class="btn" data-act="scanRead" ${s.busy ? "disabled" : ""}>${s.busy ? "Reading…" : "Read card"}</button></div>` : ""}
      ${defaultsPill(g, p)}`
    }
    <p class="muted small" id="scanStatus" role="status">${esc(s.status || "")}</p>
  </section>
  ${
    s.cands?.length || (s.read && !s.busy)
      ? `<section class="panel"><h3>${s.cands?.length ? (s.cands[0].exact ? "Is this your card?" : "Which one is it?") : "Couldn’t find it"}</h3>
      ${s.foundIn && s.cands?.length ? `<p class="scan-other" style="--game-color:${GAME_HUE[s.foundIn]}"><b>Possible ${esc(GAME_LABEL[s.foundIn])} match · not confirmed.</b> Check the picture and selected game before adding${/[!.]$/.test(GAME_LABEL[s.foundIn]) ? "" : "."}</p>` : ""}
      ${cands ? `<div class="scan-cands">${cands}</div>` : `<p class="muted small">Move closer so the card fills the frame and the name is sharp. Or look it up with Google Lens, or type the name.</p>`}
      ${s.lastCard ? `<div class="actions wrap"><button class="btn ghost small scan-lens" data-act="scanLens">${LENS} Search with Google Lens</button>${s.lensUrl ? `<a class="btn small" href="${esc(s.lensUrl)}" target="_blank" rel="noopener">Open Lens results</a>` : ""}</div>` : ""}
      <details class="trouble"><summary>Troubleshooting</summary><p class="small muted">Name strip read as: <code>${esc((s.read?.name || "").slice(0, 120)) || "—"}</code><br>Code strip read as: <code>${esc((s.read?.code || "").replace(/\s+/g, " ").slice(0, 120)) || "—"}</code><br>Names tried: ${esc((s.tried || []).join(" · ") || "—")}</p></details></section>`
      : ""
  }
  ${sessionPanel(g, p, list)}
  <p class="foot">${p.quick ? "Quick mode is on, so cards it’s sure about are added for you." : "You confirm each card before it’s added."} Finish uses your scan defaults; foil and reverse holo are not detected automatically. Scanning runs on your phone. The first scan downloads about 5 MB${scanLang() !== "eng" ? ", plus Japanese" : ""}.</p>`;
}

// Like Promise.allSettled, but at most `n` at a time (60 pictures at once overwhelm a phone's connection).
export async function settleLimited(items, fn, n = 6) {
  const out = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i], i) };
      } catch (e) {
        out[i] = { status: "rejected", reason: e };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return out;
}

// Rail icons (drawn, same family as the app).
const ico = (b) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const TIP_FLAT = ico(`<path d="M3 15.5 12 20l9-4.5L12 11z"/><path d="M3 15.5V13l9-4.5 9 4.5v2.5" stroke-opacity=".5"/>`);
const TIP_LIGHT = ico(`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>`);
const TIP_GLARE = ico(`<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>`);
const TORCH = ico(`<path d="M8 3h8l-1 5H9z"/><path d="M9 8h6v3l-1.5 2v8h-3v-8L9 11z"/><path d="M12 15v2"/>`);
const BOLT = ico(`<path d="M13.5 3 6 13.5h5.5L10 21l8-11h-5.5z"/>`);
const GEAR = ico(`<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6"/>`);
const LENS = ico(`<path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/><circle cx="12" cy="12" r="3.2"/>`);
const GAME_HUE = { mtg: "#f08a5d", ygo: "#f5b335", ptcg: "#ef5350" };
const CAMERA = ico(`<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>`);
const STOP = ico(`<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>`);

/* ---------- controller ---------- */

let stream = null,
  loopTimer = 0,
  prevGray = null,
  steady = 0,
  lockSig = null,
  lockMsg = "",
  greenSince = 0;
const sigOf = (canvas) => {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 22;
  c.getContext("2d").drawImage(canvas, 0, 0, 16, 22);
  return toGray(c.getContext("2d").getImageData(0, 0, 16, 22).data, 16, 22);
};
const loadImage = (url) =>
  new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => bad(Error("Couldn’t open that photo."));
    img.src = url;
  });
const sigDiff = (a, b) => (a && b ? a.reduce((x, v, i) => x + Math.abs(v - b[i]), 0) / a.length : 255);

// The capture with a fraction trimmed from every side.
export function insetCanvas(src, f) {
  if (!f) return src;
  const c = document.createElement("canvas"),
    x = Math.round(src.width * f),
    y = Math.round(src.height * f);
  c.width = src.width - 2 * x;
  c.height = src.height - 2 * y;
  c.getContext("2d").drawImage(src, x, y, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}
// Instant-scan index (scanidx/, built by scripts/build-scan-index.py): one fingerprint per card
// picture. Loaded once per game when the scanner is used; the service worker keeps it.
const IDX = {};
export function loadIndex(g) {
  return (IDX[g] ||= (async () => {
    const [b, t] = await Promise.all([fetch(`scanidx/${g}.bin`).then((r) => (r.ok ? r.arrayBuffer() : null)), fetch(`scanidx/${g}-ids.txt`).then((r) => (r.ok ? r.text() : null))]);
    if (!b || !t) throw Error("Recognition index unavailable");
    return { bin: new Uint8Array(b), ids: t.split("\n").filter(Boolean).map((l) => l.split("\t")) };
  })().catch(() => { delete IDX[g]; return null; }));
}
// A small picture of index entry [id, path] that allows reading pixels (for the close comparison).
export function indexThumb(g, [id, path]) {
  if (g === "mtg") return `https://cards.scryfall.io/small/front/${id[0]}/${id[1]}/${id}.jpg`;
  if (g === "ptcg") return `https://assets.tcgdex.net/en/${path}/low.webp`;
  return `img/ygo/s/${id.split(":")[0]}.jpg`;
}
// Layout fingerprints from different games are not comparable. A weak guess is never proof.
export function acceptArtMatch(selectedGame, match) {
  if (!match || match.g !== selectedGame || !Number.isFinite(match.score) || match.score < 0.62) return null;
  return { ...match, sure: match.like >= 0.72 && match.score >= 0.72 && match.distance <= 20 && match.margin >= 0.10 };
}
// The card id the rest of the app uses for an index entry.
export const indexCardId = (g, id) => (g === "ygo" ? id.split(":")[1] : id);

export function registerScanner(ctx) {
  const { A, C, render, toast, game, match, add, details } = ctx,
    s = () => S.ui.scan;
  const prefs = () => loadPrefs(game());
  // Put a candidate on the scan list with the current defaults (finish falls back if the card
  // doesn't come in that finish).
  const toSession = (c) => {
    const G = game(),
      p = prefs(),
      fins = finishesFor(G, c),
      finish = fins.includes(p.finish) ? p.finish : fins[0];
    const item = { id: c.card?.id || c.id, name: c.name, image: c.image || c.card?.image || "", setCode: ctx.setOf(G, c), number: ctx.numberOf(G, c), finish, condition: p.condition, lang: p.lang, qty: p.qty, price: ctx.priceOf(G, c, finish), cand: { id: c.id, name: c.name, image: c.image, sub: c.sub, exact: c.exact, print: c.print, card: c.card } };
    saveSession(G, addToSession(loadSession(G), item));
    feedback("ok", p);
    s().lastAdded = `+${item.qty} ${c.name}${item.price != null && p.showValue ? ` · $${(item.price * item.qty).toFixed(2)}` : ""}`;
    flash(s().lastAdded);
    return item;
  };
  const flash = (msg) => {
    const el = document.getElementById("scanFlash");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  };
  let videoEl = null;
  const setStatus = (m) => {
    s().status = m;
    const el = document.getElementById("scanStatus");
    if (el) el.textContent = m;
  };
  let camTicket = 0;
  const stopCamera = () => {
    camTicket++;
    clearInterval(loopTimer);
    loopTimer = 0;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (videoEl) videoEl.srcObject = null;
    s().camOn = false;
  };
  ctx.stopCamera = stopCamera;

  // Instant path: find the picture in the index (milliseconds), confirm the closest few with a
  // detailed comparison, then settle the printing inside the game the user selected.
  const lookArt = async (card, g) => {
    const idx = await loadIndex(g);
    if (!idx) return null;
    // Hash the capture as it is and slightly tighter (a crop with a sliver of table around it
    // shifts the fingerprint); each index entry keeps its best distance over the versions.
    const near = nearest([0, 0.02, 0.035, 0.05].map((f) => hashCanvas(insetCanvas(card, f), g)), idx.bin, 24),
      scan = fingerprintCanvas(card, g),
      fps = await settleLimited(near, ([i]) => fingerprintUrl(indexThumb(g, idx.ids[i]), g), 6),
      dmin = near[0]?.[1] ?? 0,
      // Picture likeness, minus a little for every step the index put it further away: the index
      // distance is the sharper signal between look-alikes, the likeness catches index misses.
      ranked = near.map(([i, dist], k) => ({ id: idx.ids[i][0], like: fps[k].value ? likeness(scan, fps[k].value) : -1, score: fps[k].value ? likeness(scan, fps[k].value) - 0.03 * (dist - dmin) : -1 })).sort((a, b) => b.score - a.score),
      [a, b] = ranked;
    return a && a.score > 0 ? { g, id:a.id, score:a.score, like:a.like, distance:near.find(([i])=>idx.ids[i][0]===a.id)?.[1] ?? Infinity, margin:b ? a.score-b.score : 1 } : null;
  };
  const artFirst = async (card, G) => {
    const best = acceptArtMatch(G, await lookArt(card,G).catch(() => null));
    if (!best) return null;
    const cand = await ctx.candById(best.g, indexCardId(best.g, best.id), "Artwork match", false);
    if (!cand) return null;
    const picked = await pickPrinting(best.g, card, cand).catch(() => null);
    // A printing is only "found" when the index match itself was clear.
    const cands = (picked?.length ? picked : [cand]).map((c) => (best.sure ? c : { ...c, exact: false, why: "Possible artwork match · confirm the name" }));
    return { g: best.g, sure: best.sure, exact: !!cands[0].exact, r: { cands, tried: [cand.name], picked: true } };
  };
  // Which printing: the only one there is, or the one whose artwork and frame match the scan.
  // Unsure → the three closest pictures to choose from.
  const pickPrinting = async (g, card, cand) => {
    const prints = await ctx.printings(g, cand);
    if (!prints?.length) return null;
    const scan = fingerprintCanvas(card, g);
    if (prints.length === 1) {
      // The only printing — but only "found" if the picture agrees (a weak look-alike isn't proof).
      const fp = await fingerprintUrl(prints[0].thumb, g).catch(() => null),
        score = fp ? likeness(scan, fp) : null,
        agrees = score != null && score >= 0.72,
        c = await ctx.candOf(g, prints[0], agrees ? "The only printing" : "Closest artwork", agrees);
      if (c) c.artScore = score;
      return c ? [c] : null;
    }
    const fps = await settleLimited(prints.slice(0, 60), (x) => fingerprintUrl(x.thumb, g), 6),
      ok = prints.slice(0, 60).map((x, i) => ({ ...x, fp: fps[i].value })).filter((x) => x.fp),
      { ranked, sure } = rankPrintings(scan, ok);
    const out = [];
    for (const [i, x] of (sure ? ranked.slice(0, 1) : ranked.slice(0, 3)).entries()) {
      const c = await ctx.candOf(g, x, sure ? "Artwork match" : "Closest artwork", sure && i === 0);
      if (c) out.push(Object.assign(c, { artScore: x.score }));
    }
    return out;
  };
  // No name: cards suggested by the card's other text (rules, flavour, attacks). Each suggestion's
  // printings are compared with the photo and the closest picture wins, if it clearly looks alike.
  // A name match already found is never replaced by a text guess.
  const fromText = async (g, full, r, p, card) => {
    setStatus("Reading the rest of the card…");
    const names = await Promise.resolve(ctx.byText?.(g, full)).catch(() => []);
    if (!names?.length) return r;
    const key = (x) => scanNameKey(x);
    if (r.cands.length && names.some((n) => key(n) === key(r.cands[0].name))) return { ...r, tried: [...r.tried, r.cands[0].name] };
    setStatus("Comparing the artwork…");
    let best = null;
    for (const n of names.slice(0, 5)) {
      const rt = await match(g, { name: n, code: "", full: "" }, scanLang(), true, setStatus, p).catch(() => null),
        c = rt?.cands?.find((x) => key(x.name) === key(n)) || rt?.cands?.[0];
      if (!c) continue;
      const picked = await pickPrinting(g, card, c).catch(() => null),
        score = picked?.[0]?.artScore ?? -1;
      if (picked?.length && (!best || score > best.score)) best = { picked, score, n };
    }
    if (!best || best.score < 0.62) return r;
    return { cands: best.picked.map((c) => ({ ...c, why: c.exact ? "Found from its text and artwork" : "Found from its text" })), tried: [...r.tried, best.n], picked: true };
  };
  const st0 = () => s();
  // Reading path: name strip, set code, the whole card, the card's other text, other games.
  const readFlow = async (card, G, p, fast) => {
    const st = s();
    st.read = await readCard(card, G, scanLang(), setStatus);
    setStatus("Matching…");
    let r = await match(G, st.read, scanLang(), false, setStatus, p);
    // A sure match is an exact printing or a name read letter for letter; a closest spelling
    // ("MAGICIAN" → Zacian) is only a guess and gets a second look.
    const sure = (x) => x.cands.some((c) => c.exact || x.tried.some((t) => scanNameKey(t) === scanNameKey(c.name)));
    // Not sure: read the whole card and look for the name wherever it sits
    // (a card in the corner of a photo, a screenshot, an unusual frame), and check the game.
    if (!sure(r)) {
      const full = st.read.full || (await readFull(card, scanLang(), setStatus));
      st.read.full = full;
      const wide = { name: [...anchoredNames(G, full), st.read.name, full].join("\n"), code: st.read.code, full };
      setStatus("Reading the whole card…");
      const r2 = await match(G, wide, scanLang(), false, setStatus, p);
      if (sure(r2) || !r.cands.length) r = { cands: r2.cands.length ? r2.cands : r.cands, tried: [...r.tried, ...r2.tried] };
      // Still no name: find the card from its other text (rules, flavour, attack names).
      if (!sure(r)) r = await fromText(G, full, r, p, card);
      // Keep the selected game authoritative. Another game's OCR is only a hint,
      // never permission to replace candidates with a different catalogue.
      const other = detectGame(`${st.read.name}\n${st.read.code}\n${full}`);
      if (!sure(r) && other && other !== G) setStatus(`Could not confirm this as a ${GAME_LABEL[G]} card. Check the game selector.`);
    }
    // The artwork had a likely card the reading couldn't beat: offer it.
    if (fast?.g === G && fast?.r.cands.length && !sure(r)) {
      if (fast.g !== G) st.foundIn = fast.g;
      return fast.r;
    }
    return r;
  };
  const process = async (card) => {
    const st = s(),
      G = game();
    try {
      const k = Math.min(1, 360 / card.width), t = document.createElement("canvas");
      t.width = Math.round(card.width * k);
      t.height = Math.round(card.height * k);
      t.getContext("2d").drawImage(card, 0, 0, t.width, t.height);
      st.shot = t.toDataURL("image/jpeg", 0.85);
    } catch {
      st.shot = "";
    }
    st.busy = true;
    st.lensUrl = "";
    st.cands = [];
    render();
    try {
      st.foundIn = "";
      const p = prefs();
      setStatus("Looking at the artwork…");
      const fast = await artFirst(card, G).catch(() => null);
      let r;
      if (fast?.exact) {
        // The picture settled it: no reading needed.
        r = fast.r;
        st.read = { name: "", code: "", full: "" };
        if (fast.g !== G) st.foundIn = fast.g;
      } else if (fast?.sure) {
        // Card known, printing not: read just the set code at the bottom.
        const FG = fast.g;
        st.read = await readCard(card, FG, scanLang(), setStatus, { codeOnly: true });
        st.read.name = fast.r.cands[0].name;
        const rc = await match(FG, st.read, scanLang(), false, setStatus, FG === G ? p : {});
        const hit = rc.cands.find((c) => c.exact && scanNameKey(c.name) === scanNameKey(fast.r.cands[0].name));
        r = hit ? { cands: [hit], tried: rc.tried, picked: true } : fast.r;
        if (FG !== G) st.foundIn = FG;
      } else r = await readFlow(card, G, p, fast);
      // The picture picks the printing: compare the scan with every printing of the best name.
      if (r.cands.length && !r.cands[0].exact && !r.picked) {
        setStatus("Comparing the artwork…");
        const picked = await pickPrinting(st.foundIn || G, card, r.cands[0]).catch(() => null);
        if (picked?.length) r = { ...r, cands: picked[0].exact ? picked : [...picked, ...r.cands.filter((c) => c.name !== picked[0].name)].slice(0, 3) };
      }
      // Lock set: candidates from the locked set first.
      if (p.lockSet && !st.foundIn) r.cands.sort((a, b) => (ctx.setOf(G, b).toLowerCase() === p.lockSet.toLowerCase()) - (ctx.setOf(G, a).toLowerCase() === p.lockSet.toLowerCase()));
      st.tried = r.tried;
      st.guess = r.cands[0]?.name || nameCandidates(G, st.read.name || st.read.full)[0] || "";
      if (p.quick && r.cands[0]?.exact && !st.foundIn) {
        // Quick mode: an exact printing goes straight on the list; wait for the next card.
        const it = toSession(r.cands[0]);
        st.cands = [];
        st.read = null;
        st.status = `Added ${it.name}. Next card.`;
        lockMsg = "Added. Next card";
      } else {
        st.cands = r.cands;
        if (!r.cands.length) feedback("fail", p);
        st.status = st.foundIn
          ? `Found it in ${GAME_LABEL[st.foundIn]}.`
          : r.cands.length
            ? r.cands[0].exact
              ? "Found it."
              : "Pick the right version."
            : "Couldn’t read this card.";
      }
    } catch (e) {
      st.status = e.message;
    } finally {
      st.busy = false;
      render();
    }
  };

  // Live camera
  const loop = () => {
    const v = document.getElementById("scanVideo");
    if (!v || !v.videoWidth) return;
    const g = visibleGuide(v.videoWidth, v.videoHeight, v.clientWidth, v.clientHeight),
      margin = 0.1,
      sx = Math.max(0, g.x - g.w * margin),
      sy = Math.max(0, g.y - g.h * margin),
      sw = Math.min(v.videoWidth - sx, g.w * (1 + 2 * margin)),
      sh = Math.min(v.videoHeight - sy, g.h * (1 + 2 * margin)),
      W = 120,
      H = Math.round((W * sh) / sw),
      c = (loop.c ||= document.createElement("canvas"));
    c.width = W;
    c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(v, sx, sy, sw, sh, 0, 0, W, H);
    const gray = toGray(x.getImageData(0, 0, W, H).data, W, H),
      k = W / sw,
      m = frameMetrics(gray, W, H, { x: (g.x - sx) * k, y: (g.y - sy) * k, w: g.w * k, h: g.h * k }, prevGray);
    prevGray = gray;
    if (window.__scanDebug) window.__scanDebug.push({ ...m, vw: v.videoWidth, vh: v.videoHeight });
    let st = guideState(m, steady);
    steady = st.state === "green" || (st.state === "amber" && st.msg === "Hold steady…") ? steady + 1 : 0;
    // After an add, wait for a different card (or the card to leave) before capturing again.
    // One automatic capture per card: wait for a different card (or the card to leave) first.
    if (lockSig) {
      const now = sigOf(c);
      if (m.edges < 2 || sigDiff(now, lockSig) > 22) lockSig = null;
      else if (st.state === "green") st = { state: "green", icon: "✓", msg: s().busy ? "Reading card…" : lockMsg };
    }
    s().guide = st;
    const el = document.getElementById("camStatus"),
      guide = document.getElementById("camGuide");
    if (el) {
      el.className = "cam-status " + st.state;
      el.innerHTML = `<i class="cam-dot" aria-hidden="true"></i>${esc(st.msg)}`;
    }
    if (guide) guide.className = "cam-guide " + st.state;
    if (st.state === "green" && !lockSig) {
      greenSince ||= Date.now();
      if (s().auto !== false && !s().busy && Date.now() - greenSince > 500) capture();
    } else greenSince = 0;
  };
  const placeGuide = () => {
    const v = document.getElementById("scanVideo"),
      guide = document.getElementById("camGuide");
    if (!v || !guide || !v.videoWidth) return;
    const g = visibleGuide(v.videoWidth, v.videoHeight, v.clientWidth, v.clientHeight),
      W = v.clientWidth,
      H = v.clientHeight;
    // The video fills its box with object-fit: cover, so map video pixels → screen pixels the
    // same way: scale to cover, centered. The guide then sits exactly over the captured area.
    const k = Math.max(W / v.videoWidth, H / v.videoHeight),
      ox = (W - v.videoWidth * k) / 2,
      oy = (H - v.videoHeight * k) / 2;
    Object.assign(guide.style, { left: ox + g.x * k + "px", top: oy + g.y * k + "px", width: g.w * k + "px", height: g.h * k + "px" });
  };
  // One <video> for the whole session, moved into each fresh render, so playback never restarts.
  const attach = () => {
    const slot = document.getElementById("camSlot");
    if (!stream || (!slot && !document.getElementById("scanVideo"))) return;
    if (!videoEl) {
      videoEl = document.createElement("video");
      Object.assign(videoEl, { id: "scanVideo", muted: true, autoplay: true, playsInline: true });
      videoEl.setAttribute("playsinline", "");
      videoEl.onloadedmetadata = placeGuide;
      window.addEventListener("resize", placeGuide);
    }
    if (slot) slot.replaceWith(videoEl);
    const v = videoEl;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (v.paused) v.play?.().catch(() => {});
    placeGuide();
    clearInterval(loopTimer);
    loopTimer = setInterval(loop, 160);
  };
  const capture = () => {
    const v = document.getElementById("scanVideo");
    if (!v?.videoWidth || s().busy) return;
    const g = visibleGuide(v.videoWidth, v.videoHeight, v.clientWidth, v.clientHeight),
      c = document.createElement("canvas"),
      k = Math.min(1, 900 / g.w);
    c.width = Math.round(g.w * k);
    c.height = Math.round(g.h * k);
    c.getContext("2d").drawImage(v, g.x, g.y, g.w, g.h, 0, 0, c.width, c.height);
    s().lastCard = c;
    greenSince = 0;
    lockSig = sigOf(c);
    lockMsg = "Captured. Tap Add, or try the next card";
    process(c);
  };
  A.scanStart = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return toast("This browser can’t open the camera here. Use Photo instead.");
    try {
      const ticket = ++camTicket,
        cam = prefs().camera,
        got = await navigator.mediaDevices
          .getUserMedia({ video: { ...(cam ? { deviceId: { exact: cam } } : { facingMode: { ideal: "environment" } }), width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
          .catch((e) => (cam ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }) : Promise.reject(e)));
      // Closed, switched to Photo or left the page while the permission prompt was open: release it.
      if (ticket !== camTicket || s().mode === "photo" || S.ui.view !== "scan") return got.getTracks().forEach((t) => t.stop());
      stream = got;
      s().camOn = true;
      s().torch = false;
      s().torchCap = !!got.getVideoTracks()[0]?.getCapabilities?.().torch;
      s().status = "";
      render();
    } catch (e) {
      s().status = /denied|NotAllowed/i.test(e.name + e.message) ? "Camera permission was declined. Allow it in your browser settings, or use Photo." : "Couldn’t open the camera. Use Photo instead.";
      render();
    }
  };
  A.scanStop = () => {
    stopCamera();
    render();
  };
  A.scanCapture = () => capture();
  C.scanAuto = (t) => (s().auto = t.checked);
  A.scanMode = (t) => {
    s().mode = t.dataset.id;
    if (t.dataset.id !== "live") stopCamera();
    render();
  };
  C.scanLang = (t) => {
    try {
      localStorage.setItem(LANG_KEY, t.value);
    } catch {}
    render();
  };

  // Photo: rotate, drag a crop box, read
  C.scanFile = (t) => {
    const f = t.files[0],
      st = s();
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Choose a photo.");
    if (st.url) URL.revokeObjectURL(st.url);
    Object.assign(st, { url: URL.createObjectURL(f), rot: 0, crop: null, cands: [], read: null, status: "Crop to the card if there’s a lot around it, then tap Read card." });
    render();
  };
  // Rotate the photo itself (not just its display), so the crop box always matches the pixels.
  A.scanRotate = async () => {
    const st = s();
    if (!st.url) return;
    const img = await loadImage(st.url).catch(() => null);
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = img.naturalHeight;
    c.height = img.naturalWidth;
    const x = c.getContext("2d");
    x.translate(c.width / 2, c.height / 2);
    x.rotate(Math.PI / 2);
    x.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92));
    URL.revokeObjectURL(st.url);
    st.url = URL.createObjectURL(blob);
    st.crop = null;
    render();
  };
  A.scanCropReset = () => {
    s().crop = null;
    render();
  };
  // No crop drawn: find the card in the photo by itself.
  const autoBox = (img) => {
    const W = 160, H = Math.max(1, Math.round((160 * img.naturalHeight) / img.naturalWidth)), c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, W, H);
    return findCardBox(x.getImageData(0, 0, W, H).data, W, H);
  };
  A.scanRead = async () => {
    const st = s();
    if (!st.url || st.busy) return;
    const r = await loadImage(st.url).catch(() => null);
    if (!r) return toast("Couldn’t open that photo.");
    // Crop to the box (fractions of the photo as shown).
    const rw = r.naturalWidth,
      rh = r.naturalHeight,
      cr = st.crop || autoBox(r) || { x: 0, y: 0, w: 1, h: 1 },
      k = Math.min(3, 1100 / (rw * cr.w)),
      c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(rw * cr.w * k));
    c.height = Math.max(1, Math.round(rh * cr.h * k));
    c.getContext("2d").drawImage(r, rw * cr.x, rh * cr.y, rw * cr.w, rh * cr.h, 0, 0, c.width, c.height);
    st.lastCard = c;
    process(c);
  };
  const attachCrop = () => {
    const wrap = document.getElementById("cropWrap"),
      box = document.getElementById("cropBox");
    if (!wrap || !box) return;
    const show = () => {
      const c = s().crop;
      box.hidden = !c;
      if (c) Object.assign(box.style, { left: c.x * 100 + "%", top: c.y * 100 + "%", width: c.w * 100 + "%", height: c.h * 100 + "%" });
    };
    show();
    let start = null;
    const pt = (e) => {
      const r = wrap.getBoundingClientRect();
      return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    };
    wrap.onpointerdown = (e) => {
      start = pt(e);
      wrap.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    wrap.onpointermove = (e) => {
      if (!start) return;
      const p = pt(e);
      s().crop = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      show();
    };
    wrap.onpointerup = () => {
      start = null;
      const c = s().crop;
      if (c && (c.w < 0.08 || c.h < 0.08)) s().crop = null;
      show();
    };
  };

  // Confirm & add
  A.scanFind = async () => {
    const q = (document.getElementById("scanName")?.value || "").trim();
    if (!q) return toast("Type the card name.");
    const st = s();
    setStatus("Looking it up…");
    const r = await match(game(), { name: q, code: q, full: "" }, scanLang(), true, setStatus);
    st.cands = r.cands;
    st.tried = r.tried;
    st.status = r.cands.length ? "Check the picture matches your card, then tap Add." : "No card found with that name.";
    render();
  };
  A.scanAdd = async (t) => {
    const c = s().cands?.[Number(t.dataset.i)],
      other = s().foundIn;
    if (!c) return;
    // A card from another game: switch to that game, then put it on that game's list.
    if (other && other !== game()) {
      await A.setGame({ dataset: { game: other } });
      toast(`Switched to ${GAME_LABEL[other]}.`);
    }
    s().foundIn = "";
    toSession(c);
    // The same card still sitting in front of the camera won't be captured again.
    if (s().lastCard) {
      lockSig = sigOf(s().lastCard);
      lockMsg = "Added. Next card";
    }
    s().cands = [];
    s().read = null;
    s().status = s().camOn ? "On the list. Swap in the next card." : "On the list. Take the next photo.";
    render();
  };
  // Backup reader: Google Lens. The app's server uploads the picture (Lens refuses uploads posted
  // straight from other sites) and the results open in a new tab. The tab opens during the tap so
  // it isn't blocked as a pop-up; if it is blocked anyway, a link to the results appears instead.
  A.scanLens = async () => {
    const card = s().lastCard;
    if (!card?.toBlob) return toast("Scan or photograph a card first.");
    const tab = window.open("", "_blank");
    try {
      if (tab) tab.document.title = "Google Lens";
    } catch {}
    setStatus("Sending the picture to Google Lens…");
    const blob = await new Promise((ok) => card.toBlob(ok, "image/jpeg", 0.9));
    const r = blob ? await fetch("api/lens", { method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" } }).then((x) => x.json()).catch(() => null) : null;
    if (!r?.url) {
      tab?.close();
      s().lensUrl = "";
      setStatus("Google Lens didn’t answer. Try again in a moment.");
      return;
    }
    if (tab && !tab.closed) {
      tab.location.href = r.url;
      setStatus("Lens results are open in a new tab. Type the name it finds below.");
    } else {
      s().lensUrl = r.url;
      setStatus("Lens is ready. Tap the link to see the results.");
      render();
    }
  };
  A.scanZoom = (t) => {
    if (t.dataset.i === "shot") return s().shot && openZoom({ src: s().shot, alt: "Your capture" });
    const c = s().cands?.[Number(t.dataset.i)];
    if (!c) return;
    const urls = c.card ? artworkSources(c.card, true) : [c.image].filter(Boolean);
    if (urls.length) openZoom({ src: urls[0], hi: urls[0], alt: c.name, fallback: urls[1] || "" });
  };
  A.scanDetails = (t) => {
    const c = s().cands?.[Number(t.dataset.i)];
    if (c) details(game(), c);
  };

  /* ---------- scan session controls ---------- */
  const CYCLE = { finish: () => FINISHES[game()].map((x) => x[0]), condition: () => CONDITIONS.map((x) => x[0]), lang: () => LANGS.map((x) => x[0]), qty: () => QTYS };
  A.scanCycle = (t) => {
    const k = t.dataset.k,
      opts = CYCLE[k]?.();
    if (!opts) return;
    const cur = prefs()[k],
      next = opts[(opts.indexOf(cur) + 1) % opts.length];
    savePrefs(game(), { [k]: next });
    render();
  };
  // Glass dropdown for a default: opens above or below its button, closes on pick, tap outside or Esc.
  let pop = null;
  const closePop = () => {
    if (!pop) return;
    pop.remove();
    pop = null;
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", onKey, true);
  };
  const outside = (e) => {
    if (pop && !pop.contains(e.target) && !e.target.closest?.('[data-act="scanPick"]')) closePop();
  };
  const onKey = (e) => {
    if (e.key === "Escape") closePop();
  };
  A.scanPick = (t) => {
    const k = t.dataset.k,
      same = pop?.dataset.k === k;
    closePop();
    if (same) return;
    const G = game(),
      cur = prefs()[k],
      opts = pickOptions(G, k);
    pop = document.createElement("div");
    pop.className = "glass-pop";
    pop.dataset.k = k;
    pop.setAttribute("role", "listbox");
    pop.setAttribute("aria-label", CAPTION[k]);
    pop.innerHTML = `<p class="gp-title">${CAPTION[k]}</p>${opts.map((o) => `<button role="option" aria-selected="${o.v === cur}" class="${o.v === cur ? "on" : ""}" data-act="scanSet" data-k="${k}" data-v="${esc(String(o.v))}"><b>${esc(o.l)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}<svg class="gp-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}`;
    document.body.append(pop);
    const r = t.getBoundingClientRect(),
      ph = pop.offsetHeight,
      pw = pop.offsetWidth,
      up = r.top > ph + 16 && window.innerHeight - r.bottom < ph + 16;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + "px";
    pop.style.top = (up ? r.top - ph - 8 : r.bottom + 8) + "px";
    pop.classList.add(up ? "up" : "down");
    pop.querySelector(".on, button")?.focus({ preventScroll: true });
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", onKey, true);
  };
  A.scanSet = (t) => {
    const k = t.dataset.k,
      v = k === "qty" ? Number(t.dataset.v) : t.dataset.v;
    savePrefs(game(), { [k]: v });
    closePop();
    render();
  };
  ctx.closePop = closePop;
  A.scanQuick = () => {
    const p = savePrefs(game(), { quick: !prefs().quick });
    toast(p.quick ? "Quick mode on. Cards it’s sure about go straight on the list." : "Quick mode off. You confirm each card.");
    render();
  };
  A.scanTorch = async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !s().torch }] });
      s().torch = !s().torch;
    } catch {
      toast("This camera's flashlight can't be controlled from the browser.");
    }
    render();
  };
  const settingsSheet = (cams = []) => {
    const p = prefs(),
      G = game(),
      chk = (k, label, help = "") => `<label class="check ss-set"><input type="checkbox" data-change="scanPref" data-k="${k}" ${p[k] ? "checked" : ""}><span><b>${label}</b>${help ? `<small>${help}</small>` : ""}</span></label>`;
    return `<div class="sheet-head"><h2>Scanner settings</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
      <label class="field">Camera<select data-change="scanPref" data-k="camera"><option value="">Back camera (automatic)</option>${cams.map((c, i) => `<option value="${esc(c.deviceId)}" ${p.camera === c.deviceId ? "selected" : ""}>${esc(c.label || "Camera " + (i + 1))}</option>`).join("")}</select></label>
      ${chk("quick", "Quick mode", "Exact matches (set code and number) go straight on the list; anything less sure asks first.")}
      <label class="field">Lock set<input data-change="scanPref" data-k="lockSet" value="${esc(p.lockSet)}" placeholder="${G === "mtg" ? "Set code, e.g. WOE" : G === "ygo" ? "Set code, e.g. LOB" : "Set id, e.g. sv1"}" autocapitalize="characters"><small class="muted">Sorting one set? Matches from it come first${G === "mtg" ? ", and names are looked up in it" : ""}.</small></label>
      ${G === "mtg" ? chk("ignorePromos", "Ignore promos", "Prefer the regular printing when a name match lands on a promo.") : ""}
      ${chk("preferFoil", "Prefer foil", "Start new scans as foil (you can still tap the finish).")}
      ${chk("sounds", "Sounds", "A short chime for each card added, a low tone when nothing matched.")}
      ${chk("haptics", "Vibration", "A tap on each card added.")}
      ${chk("showValue", "Show prices and total value")}
      <label class="field">Text recognition language<select data-change="scanLang">${[["eng", "English"], ["jpn+eng", "Japanese (+ English)"]].map(([v, l]) => `<option value="${v}" ${scanLang() === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <details class="settings-disclosure"><summary>Scanning tips</summary><ul class="guide-list small"><li>Plain, contrasting surface; one card at a time.</li><li>Fill the frame; keep the name and the bottom code sharp.</li><li>Tilt slightly or use the flashlight off-axis to kill foil glare.</li><li>Sorting a single set? Lock it for faster, surer matches.</li><li>Quick mode + automatic capture: just swap cards; listen for the chime.</li></ul></details>`;
  };
  A.scanSettings = async () => {
    ctx.openSheet(settingsSheet(), { type: "scan-settings" });
    try {
      const cams = (await navigator.mediaDevices?.enumerateDevices?.() || []).filter((d) => d.kind === "videoinput");
      if (cams.length && document.querySelector("#sheet[open]")) ctx.openSheet(settingsSheet(cams), { type: "scan-settings" });
    } catch {}
  };
  C.scanPref = (t) => {
    const k = t.dataset.k,
      v = t.type === "checkbox" ? t.checked : k === "lockSet" ? t.value.trim().toLowerCase() : t.value;
    const before = prefs();
    savePrefs(game(), { [k]: v, ...(k === "preferFoil" && v !== before.preferFoil ? { finish: v ? FINISHES[game()][1][0] : FINISHES[game()][0][0] } : {}) });
    if (k === "camera" && stream) {
      stopCamera();
      A.scanStart();
    }
    render();
  };
  // Session list
  const editRow = (k, fn) => {
    const G = game(),
      list = loadSession(G),
      it = list.find((x) => itemKey(x) === k);
    if (!it) return;
    fn(it, list);
    saveSession(G, list.filter((x) => x.qty > 0));
    render();
  };
  A.sessQty = (t) => editRow(t.dataset.k, (it) => (it.qty = Math.max(0, it.qty + Number(t.dataset.d))));
  A.sessFinish = (t) =>
    editRow(t.dataset.k, (it, list) => {
      const G = game(),
        opts = finishesFor(G, it.cand);
      it.finish = opts[(opts.indexOf(it.finish) + 1) % opts.length];
      it.price = ctx.priceOf(G, it.cand, it.finish);
      // Merge with an identical row if the change made one.
      const twin = list.find((x) => x !== it && itemKey(x) === itemKey(it));
      if (twin) {
        twin.qty += it.qty;
        it.qty = 0;
      }
    });
  A.sessCommit = async () => {
    const G = game(),
      list = loadSession(G);
    if (!list.length) return;
    const location = (document.getElementById("sessLoc")?.value || "").trim().slice(0, 100);
    savePrefs(G, { location });
    await ctx.addMany(G, list.map((x) => ({ ...x, location })));
    saveSession(G, []);
    toast(`Saved ${sessionCount(list)} card${sessionCount(list) === 1 ? "" : "s"} to your collection${location ? ` · ${location}` : ""}.`);
    render();
  };
  A.sessCopy = async () => {
    const text = sessionText(loadSession(game()));
    try {
      await navigator.clipboard.writeText(text);
      toast("List copied. Paste it into Moxfield, ManaBox or a message.");
    } catch {
      toast("Couldn't copy. Your browser blocked the clipboard.");
    }
  };
  A.sessClear = async () => {
    if (!await ask("Clear the scanned list? Cards already saved to your collection stay there.")) return;
    saveSession(game(), []);
    render();
  };

  // Called after every render of the scan screen (the page HTML is rebuilt on render).
  ctx.afterRender = () => {
    if (S.ui.view !== "scan") {
      ctx.closePop?.();
      if (stream) stopCamera();
      return;
    }
    if (s().camOn) attach();
    attachCrop();
  };
}
