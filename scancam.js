import {detectCardQuad,warpPixels,normalizedQuality} from './scan-vision.js';
import {BATCH_LIMIT,CAPTURE_BUFFER_LIMIT,loadBatch,saveBatch,updateBatch,removeBatch,batchStorageHealthy,captureEntry,uniquePrintings,actualFinishes,resolveScanFinish,resolvedEntry,batchCounts} from './scan-batch.js';
import {rankScanCandidates,signalEvidence,collectorKey} from './scan-signals.js';
import { ask, askText } from "./dialog.js";
// Card scanner for all three games:
//   live camera → find card boundary → normalize perspective → readable text bands → local multi-signal match → confirm → add
// Text recognition runs on the phone (Tesseract). The guide's colour is about capture quality only:
//   red    = no card edges in the guide (or far too dark)
//   amber  = card found but moving, blurry or glared
//   green  = edges, sharpness, light and stillness all pass for several frames → ready to capture
// Thresholds are starting points tuned on test images; they should be refined with real phone photos.
import { S } from "./store.js";
import {catalogState,catalogManifest,initCatalog,downloadCatalog,removeCatalog,localScanMatch,localIndexCandidate} from "./scan-catalog.js";
import { esc } from "./ui.js";
import { nameCandidates, detectGame, anchoredNames, scanNameKey, scanCandidateMatches, ptcgNumbers, ygoSetCodes, mtgCollector } from "./scan.js";
import { hashCanvas, nearest } from "./scanart.js";
import { artworkHTML, artworkSources } from "./artwork.js";
import { openZoom } from "./zoom.js";
import { FINISHES, CONDITIONS, LANGS, QTYS, loadPrefs, savePrefs, loadSession, saveSession, addToSession, itemKey, sessionCount, sessionValue, sessionUnpriced, sessionText, feedback } from "./scansession.js";

const CARD = 63 / 88; // card width / height
// Where the name and the identifying code sit on each game's card (fractions of the card).
export const LAYOUT = {
  mtg: { name: [0.025, 0.015, 0.92, 0.125], code: [0.0, 0.905, 0.62, 0.075] },
  // Modern Pokémon cards print the number at the very bottom-left (older ones a little higher).
  ptcg: { name: [0.03, 0.015, 0.94, 0.12], code: [0.0, 0.875, 1.0, 0.125] },
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
  workerLang = "",
  workerLoading = null;
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
  if (workerLoading) { await workerLoading; return getWorker(lang,progress); }
  workerLoading=(async()=>{
    if (worker) await worker.terminate().catch(() => {});
    worker=null;
    const Tess = await loadOCR();
    worker = await Tess.createWorker(lang, 1, {
      workerPath: new URL("vendor/worker.min.js", location.href).href,
      workerBlobURL: false,
      logger: (m) => m.status && progress?.(m.status + (typeof m.progress === "number" ? " · " + Math.round(m.progress * 100) + "%" : "")),
    });
    workerLang=lang;
    return worker;
  })();
  try {return await workerLoading;} finally {workerLoading=null;}
}
export async function releaseOCR() {
  if (workerLoading) await workerLoading.catch(()=>{});
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
const recog = async (w, canvas, segmentation = 6) => {
  // Automatic page segmentation often discards a short name/footer strip entirely.
  // Use a text block for those crops and sparse text only for a whole card.
  await w.setParameters?.({tessedit_pageseg_mode:String(segmentation)});
  return ((await w.recognize(canvas)).data.text || "").trim();
};
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

// A card-filling upload has no pixels outside its physical border. The contour
// detector can therefore see only internal frames (including a sideways art
// window), not prove an outer boundary. Preserve that already card-shaped photo
// when the background box finder also found nothing to crop. This is a photo
// preprocessing decision, never evidence of card identity or a live-camera edge.
export function preserveWholeCardPhoto(width,height,backgroundBox=null) {
  const ratio=width/height;
  return !backgroundBox && Number.isFinite(ratio) && ratio>=.67 && ratio<=.735;
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
  return { name, code, full, stats:"" };
}
// The whole card as text: for finding the name wherever it is and telling which game it is.
export async function readFull(card, lang, progress = () => {}) {
  const w = await getWorker(lang, progress);
  progress("Reading the whole card…");
  return recog(w, regionCanvas(card, [0, 0, 1, 1], 1), 11);
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
  const actual=actualFinishes(g,cand);
  return actual.length ? actual : FINISHES[g].map(x=>x[0]);
}
export function finishLabel(g, cand, key) {
  return cand?.card?.variants?.find(v=>v.key===key)?.label || FINISHES[g]?.find(([k])=>k===key)?.[1] || key || "Choose finish";
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
  if (S.ui.scan.confirm) return "";
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

function catalogControl(g, st) {
  const p=catalogState(g),bytes=(st.catalogMeta?.bytes||0)+(st.catalogMeta?.signals?.bytes||0),size=bytes?` ${(bytes/1048576).toFixed(1)} MB`:"";
  return `<div class="scan-catalog-control" role="status"><span>${p.status==="ready" ? `${p.count.toLocaleString()} local card records ready` : p.status==="downloading" ? `Downloading recognition pack · ${Math.min(100,Math.round((p.loaded||0)/p.bytes*100))}%` : "Faster recognition on this device"}</span>${(p.status!=="ready" || !p.pack?.signals) ? `<button class="link small" data-act="scanCatalogDownload" ${p.status==="downloading" ? "disabled" : ""}>${p.status==="downloading" ? "Downloading…" : p.status==="ready"?"Update recognition details":"Download"+size}</button>` : ""}${p.error ? `<small role="alert">${esc(p.error)}</small>` : ""}</div>`;
}

export function batchTray(st) {
  const rows=loadBatch(),counts=batchCounts(rows),busy=!!st.busy||counts.reading>0;
  return `<section class="scan-batch-tray" aria-label="Captured batch"><div class="scan-batch-summary"><span><b>${rows.length} captured</b><small>${counts.ready} ready${counts.review?` · ${counts.review} to check`:""}${busy?" · reading…":""}</small></span><button class="btn ghost small" data-act="scanBatchReview" ${!rows.length||st.batchSaving?"disabled":""}>Review${counts.review?` ${counts.review}`:""}</button>${counts.ready?`<button class="btn small" data-act="scanBatchSave" ${st.batchSaving?"disabled":""}>${st.batchSaving?"Saving…":`Save ${counts.ready}`}</button>`:""}</div>${rows.length?`<div class="scan-batch-strip">${rows.slice(-8).map(row=>`<button class="scan-batch-thumb ${row.status}" data-act="scanBatchReview" data-id="${esc(row.id)}" aria-label="${esc(row.cands?.[0]?.name||'Captured card')}: ${esc(row.reason||row.status)}">${row.shot?`<img src="${esc(row.shot)}" alt="">`:""}<span>${row.status==='ready'?'✓':['captured','reading'].includes(row.status)?'…':'?'}</span></button>`).join("")}</div>`:`<p>Swap cards after each capture. Check any uncertain printings when you’re done.</p>`}${!batchStorageHealthy()?`<p role="alert">Device storage is full. Keep this page open and save or review this batch.</p>`:""}${st.batchError?`<p role="alert">${esc(st.batchError)}</p>`:""}</section>`;
}
export function scanView(g, gameName) {
  const s=S.ui.scan,p=loadPrefs(g),live=(s.mode||"live")==="live",list=loadSession(g);
  const rail=`<div class="cam-rail">${s.torchCap?`<button class="${s.torch?"on":""}" data-act="scanTorch" aria-pressed="${!!s.torch}" aria-label="Flashlight">${TORCH}</button>`:""}<button data-act="scanSettings" aria-label="Scanner settings">${GEAR}</button></div>`;
  return `<div class="scan-workspace ${s.camOn?'is-live':''}"><div class="scan-toolbar"><h1>Scan</h1><span class="scan-auto-game">Auto game</span><button class="btn ghost small" data-act="scanMode" data-id="${live?'photo':'live'}">${live?'Photo':'Camera'}</button>${s.camOn?`<button class="icon" data-act="scanStop" aria-label="Stop camera">${STOP}</button>`:`<button class="icon" data-act="scanSettings" aria-label="Scanner settings">${GEAR}</button>`}</div>
  <section class="panel scan-panel">${live?`<div class="cam-wrap ${s.camOn?'immersive':''}" id="camWrap">${s.camOn?`<div id="camSlot"></div><div class="cam-status" id="camStatus" role="status"><i class="cam-dot" aria-hidden="true"></i>${esc(s.guide?.msg||'Show one clear card')}</div>${rail}<div class="scan-flash" id="scanFlash" aria-live="polite"></div><button class="scan-shutter" id="scanCaptureBtn" data-act="scanCapture" aria-label="Capture card now">${CAMERA}</button>`:`<div class="scan-drop"><span class="scan-ghost" aria-hidden="true"></span><b>One card. Then the next.</b><span class="muted small">Magic, Pokémon and Yu-Gi-Oh! detected per card. No need to change the game above.</span><button class="btn scan-go" data-act="scanStart">${CAMERA} Start camera</button><small class="muted">Keep the name and bottom code sharp.</small></div>`}</div>`:`<div class="actions wrap"><label class="btn">${CAMERA} Take photo<input type="file" accept="image/*" capture="environment" data-change="scanFile" hidden></label><label class="btn ghost">Upload<input type="file" accept="image/*" data-change="scanFile" hidden></label></div>${s.url?`<div class="crop-wrap" id="cropWrap"><img id="cropImg" src="${esc(s.url)}" alt="Your photo"><div class="crop-box" id="cropBox"></div></div><div class="actions wrap"><button class="btn ghost small" data-act="scanRotate">Rotate</button><button class="btn ghost small" data-act="scanCropReset">Whole photo</button><button class="btn" data-act="scanRead" ${s.busy?'disabled':''}>${s.busy?'Reading…':'Read card'}</button></div>`:''}`}
  <p class="scan-status-line" id="scanStatus" role="status">${esc(s.status||'Capture first. Review only what needs checking.')}</p></section>
  ${batchTray(s)}${scanConfirmation(s.confirm?.game||g,s,p)}
  <p class="scan-disclosure">Finish and condition are not detected from a photo. ${p.finishConfirmed?`Batch finish: ${esc(finishLabel(g,null,p.finish))}.`:'Choose the finish during review, or set a batch default in settings.'}</p>
  ${list.length?`<details class="scan-legacy-session"><summary>${sessionCount(list)} cards in your previous scan list</summary>${sessionPanel(g,p,list)}</details>`:''}</div>`;
}

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
// Include a small safety margin when a dark outer border blends with the table.
export function padQuad(quad,w,h){const cx=quad.reduce((n,p)=>n+p.x,0)/4,cy=quad.reduce((n,p)=>n+p.y,0)/4;return quad.map(p=>({x:Math.max(0,Math.min(w-1,cx+(p.x-cx)*1.02)),y:Math.max(0,Math.min(h-1,cy+(p.y-cy)*1.02))}));}
export function flattenCapture(source,quad){
 const left=Math.max(0,Math.floor(Math.min(...quad.map(p=>p.x)))),top=Math.max(0,Math.floor(Math.min(...quad.map(p=>p.y)))),right=Math.ceil(Math.max(...quad.map(p=>p.x))),bottom=Math.ceil(Math.max(...quad.map(p=>p.y))),raw=document.createElement('canvas');
 raw.width=right-left+1;raw.height=bottom-top+1;const x=raw.getContext('2d',{willReadFrequently:true});x.drawImage(source,left,top,raw.width,raw.height,0,0,raw.width,raw.height);
 const out=document.createElement('canvas');out.width=480;out.height=672;const result=warpPixels(x.getImageData(0,0,raw.width,raw.height).data,raw.width,raw.height,quad.map(p=>({x:p.x-left,y:p.y-top})),480,672);out.getContext('2d').putImageData(new ImageData(result,480,672),0,0);return out;
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
  if(match?.g===selectedGame && match.hashOnly) return Number.isFinite(match.distance) && match.distance<=12 && match.margin>=4 ? {...match,sure:false} : null;
  if (!match || match.g !== selectedGame || !Number.isFinite(match.score) || match.score < 0.62) return null;
  return { ...match, sure: match.like >= 0.72 && match.score >= 0.72 && match.distance <= 20 && match.margin >= 0.10 };
}
// The card id the rest of the app uses for an index entry.
export const indexCardId = (g, id) => (g === "ygo" ? id.split(":")[1] : id);

// An art ranking is not a probability and cannot verify a printed identifier.
export function textVerifiedMatch(g, cand, read = {}) {
  if (!cand?.exact || !cand.card || signalEvidence(g,cand.card,read).conflicts.length) return false;
  const names = nameCandidates(g, read.name || "");
  if (!names.some(n => scanNameKey(n) === scanNameKey(cand.name))) return false;
  const text = `${read.code || ""}\n${read.full || ""}`;
  if (g === "ptcg") return names.some(n => scanCandidateMatches(cand.card, n, ptcgNumbers(text))) && ptcgNumbers(text).length > 0;
  if (g === "ygo") return ygoSetCodes(text).some(code => code === String(cand.print || "").split("|")[0]);
  const code = mtgCollector(text);
  return !!code && code.set === String(cand.card.set || "").toLowerCase() && collectorKey(code.number) === collectorKey(cand.card.collector_number);
}

// A loose photo may put the title outside its usual band. These are layout
// hints only; they cannot verify a printing without its independently read code.
export function fullCardNameHints(g,full) {
  const hints=anchoredNames(g,full),lines=String(full||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(g==='ptcg')for(let i=0;i<lines.length;i++){
    if(/^evolves\s+from\b/i.test(lines[i])){
      const prior=lines.slice(Math.max(0,i-3),i).reverse().find(x=>(x.match(/[A-Za-z]/g)||[]).length>=4);
      if(prior)hints.push(prior);
    }
    if(/^(?:HP\s*\d{2,3}|\d{2,3}\s*HP)\W*$/i.test(lines[i]))hints.push(...lines.slice(Math.max(0,i-1),i),...lines.slice(i+1,i+2));
  }
  return [...new Set(hints)].slice(0,5);
}

// OCR can produce plausible-looking nonsense. Keep visual suggestions reviewable
// when text lookup fails, without turning visual similarity into a verified printing.
export function recoverScanCandidates(g, result, visual, read = {}) {
  if(result.cands.some(c=>textVerifiedMatch(g,c,read)) || !visual?.cands?.length)return result;
  const names=nameCandidates(g,read.name || "");
  const compatible=visual.cands.filter(c=>names.some(n=>scanNameKey(n)===scanNameKey(c.name)));
  if(result.cands.length && !compatible.length)return result;
  const suggestions=(compatible.length?compatible:visual.cands).map(c=>({...c,exact:false,why:"Artwork suggestion · check the card and printing"}));
  return {...visual,cands:suggestions,tried:[...(result.tried||[]),...(visual.tried||[])]};
}

export function scanConfirmation(g, st, prefs) {
  const q=st.confirm;if(!q)return "";
  const c=st.cands?.[q.i??0],isBatch=!!q.batchId,options=st.cands||[],chosen=q.i>=0;
  const close=`<button class="icon" data-act="scanDismiss" aria-label="Keep for later and continue scanning" ${q.saving?'disabled':''}>✕</button>`;
  if(!options.length)return `<section class="scan-confirm scan-batch-review" role="region" aria-label="Review captured card"><header><b>Needs a clearer scan</b>${close}</header><div class="scan-confirm-card">${st.shot?`<img class="scan-confirm-art" src="${esc(st.shot)}" alt="Your captured card">`:''}<div><strong>Saved for later</strong><small>Show the name and bottom code with less glare. You can keep scanning other cards.</small></div></div><div class="scan-confirm-actions"><button class="btn ghost" data-act="scanDismiss">Keep scanning</button><button class="btn" data-act="scanRetry">Scan again</button></div>${isBatch?`<button class="link small" data-act="scanBatchDiscard">Remove this capture</button>`:''}</section>`;
  const candidate=c||options[0],fs=finishesFor(g,candidate),image=candidate.card?artworkHTML(candidate.card,"scan-confirm-art",true):candidate.image?`<img class="scan-confirm-art" src="${esc(candidate.image)}" alt="${esc(candidate.name)}">`:'';
  return `<section class="scan-confirm scan-batch-review" role="region" aria-label="Confirm scanned card" aria-busy="${!!q.saving}"><header><b>${GAME_LABEL[g]} · ${chosen?'Check finish':'Check printing'}</b>${close}</header>
  <div class="scan-confirm-card">${image}<div><strong>${esc(candidate.name)}</strong><small>${esc(candidate.sub||'')}</small><small>${chosen&&textVerifiedMatch(g,candidate,st.read)?'Printed identifier matched':'Possible match · check name and printing'}</small></div></div>
  ${options.length>1||!chosen?`<div class="scan-confirm-options" role="group" aria-label="Possible printings">${options.slice(0,3).map((x,i)=>`<button class="btn ghost small" data-act="scanChoose" data-i="${i}" aria-pressed="${chosen&&i===q.i}">${esc(x.name)}<small>${esc(x.sub||'')}</small></button>`).join('')}</div>`:''}
  <div class="scan-confirm-controls"><label>Finish / edition<select data-change="scanConfirmFinish" aria-label="Scanned card finish" ${q.saving||!chosen?'disabled':''}><option value="" ${!q.finish?'selected':''}>Choose finish</option>${fs.map(f=>`<option value="${esc(f)}" ${q.finish===f?'selected':''}>${esc(finishLabel(g,candidate,f))}</option>`).join('')}</select></label><span class="ss-qty"><button data-act="scanConfirmQty" data-d="-1" aria-label="Fewer copies" ${q.saving||q.qty<=1?'disabled':''}>−</button><output aria-label="Copies to save">${q.qty}</output><button data-act="scanConfirmQty" data-d="1" aria-label="More copies" ${q.saving?'disabled':''}>＋</button></span></div>
  <details class="scan-review-more" ${q.detailsOpen?'open':''}><summary>${esc(label(CONDITIONS,q.condition))} · ${esc(label(LANGS,q.lang))} · ${q.price==null?'Price unavailable':'Reference price '+money(q.price)}</summary><div class="scan-confirm-conditions" role="group" aria-label="Card condition">${CONDITIONS.map(([v,l])=>`<button data-act="scanConfirmCondition" data-condition="${esc(v)}" aria-label="${esc(v)}" aria-pressed="${q.condition===v}">${l}</button>`).join('')}</div><label>Language<select data-change="scanConfirmLanguage" aria-label="Scanned card language">${LANGS.map(([v,l])=>`<option value="${esc(v)}" ${q.lang===v?'selected':''}>${esc(LANG_NAME[v]||l)}</option>`).join('')}</select></label></details>
  ${q.error?`<p class="scan-confirm-error" role="alert">${esc(q.error)}</p>`:''}<div class="scan-confirm-actions"><button class="btn ghost" data-act="scanRetry" ${q.saving?'disabled':''}>Scan again</button><button class="btn" data-act="scanConfirm" ${q.saving||!chosen||!q.finish?'disabled':''}>${q.saving?'Saving…':'Add to collection'}</button></div>${isBatch?`<button class="link small" data-act="scanBatchDiscard">Remove this capture</button>`:''}</section>`;
}

export function registerScanner(ctx) {
  const { A, C, render, toast, game, match, add, details } = ctx,
    s = () => S.ui.scan;
  const prefs = () => loadPrefs(game());
  // A reload cannot resume an in-memory OCR promise, but the image is retained for retry.
  const interrupted=loadBatch();
  if(interrupted.some(x=>['captured','reading'].includes(x.status)))saveBatch(interrupted.map(x=>['captured','reading'].includes(x.status)?{...x,status:'unresolved',reason:'Reading interrupted · retry'}:x));
  // Put a candidate on the scan list with the current defaults (finish falls back if the card
  // doesn't come in that finish).
  const makeItem = (c, overrides = {}, G = game()) => {
    const p = { ...loadPrefs(G), ...overrides }, fins = finishesFor(G, c), finish = p.finish;
    if (!finish || !fins.includes(finish)) throw Error("Choose the exact finish / edition before saving.");
    const item = { ...(overrides.captureId || overrides.batchId ? {captureId: overrides.captureId || overrides.batchId} : {}), id: c.card?.id || c.id, name: c.name, image: c.image || c.card?.image || "", setCode: ctx.setOf(G, c), number: ctx.numberOf(G, c), finish, variantKey: finish, productId: c.card?.variants?.find(v=>v.key===finish)?.productId || "", print: c.print || "", condition: p.condition, lang: p.lang, qty: p.qty, price: ctx.priceOf(G, c, finish), cand: { id: c.id, name: c.name, image: c.image, sub: c.sub, exact: c.exact, printingConfirmed: overrides.printingConfirmed === true || c.exact === true, print: c.print, card: c.card } };
    return item;
  };
  const toSession = (c) => {
    const G = game(), p = prefs(), item = makeItem(c);
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
  let camTicket = 0, scanTicket = 0;
  const stopCamera = () => {
    camTicket++;
    scanTicket++;
    s().busy = false;
    s().confirm = null;
    clearInterval(loopTimer);
    loopTimer = 0;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (videoEl) videoEl.srcObject = null;
    s().camOn = false;s().boundaryReady=false;
    for(const pending of captureBuffer)updateBatch(pending.id,{status:"unresolved",reason:"Reading interrupted · retry"});
    captureBuffer.length=0;s().buffered=0;
    prevGray=null;steady=0;lockSig=null;greenSince=0;
  };
  ctx.stopCamera = stopCamera;

  // Only an unusually close, separated local fingerprint may precede OCR. It is
  // still a reviewable suggestion, never a verified printing or an automatic add.
  const localArtwork = async (card,G) => {
    if(catalogState(G).status!=="ready")return null;
    const idx=await loadIndex(G);if(!idx)return null;
    const near=nearest([0,0.02,0.035,0.05].map(f=>hashCanvas(insetCanvas(card,f),G)),idx.bin,2);
    if(!near[0]||near[0][1]>3||(near[1]&&near[1][1]-near[0][1]<8))return null;
    const c=localIndexCandidate(G,indexCardId(G,idx.ids[near[0][0]][0]));
    return c?{cands:[{...c,exact:false,why:"Possible local artwork match · check printing"}],tried:[c.name],picked:true,localArtwork:true}:null;
  };
  // Reading path: name strip, set code, the whole card, the card's other text, other games.
  const readFlow = async (card, selectedGame, p, progress=setStatus) => {
    const st=s();let G=selectedGame;
    st.read=await readCard(card,G,scanLang(),progress);
    // Game classification happens before a local catalogue can return early.
    // It affects only this capture, never the user's selected collection.
    let other=detectGame(`${st.read.name}\n${st.read.code}\n${st.read.full}`);
    if(other&&other!==G){G=other;st.read=await readCard(card,G,scanLang(),progress);p=loadPrefs(G);}
    const lookup=async()=>{
      let result=await localScanMatch(G,st.read);
      if(!result.cands.length)result=await match(G,st.read,scanLang(),false,progress,p).catch(()=>result);
      return {...result,cands:rankScanCandidates(G,result.cands||[],st.read)};
    };
    progress(`Reading ${GAME_LABEL[G]} printing…`);
    let r=await lookup();
    if(!r.cands.some(c=>textVerifiedMatch(G,c,st.read))){
      // Secondary information can reject a look-alike; it never replaces the set / number.
      const roi=G==='ygo'?[.30,.82,.70,.15]:G==='mtg'?[.02,.37,.96,.59]:[.04,.46,.92,.40];
      st.read.stats=await recog(await getWorker(scanLang(),progress),regionCanvas(card,roi,2));
      r=await lookup();
    }
    if(!r.cands.some(c=>textVerifiedMatch(G,c,st.read))){
      // Retry the identifying footer independently at a wider crop before full-card OCR.
      const w=await getWorker(scanLang(),progress),footer=G==='ygo'?[.35,.66,.65,.31]:[0,.83,1,.17];
      const detail=await recog(w,regionCanvas(card,footer,3));
      st.read.code=[st.read.code,detail].filter(Boolean).join('\n');
      r=await lookup();
    }
    if(!r.cands.some(c=>textVerifiedMatch(G,c,st.read))){
      st.read.full=st.read.full||await readFull(card,scanLang(),progress);
      other=detectGame(`${st.read.name}\n${st.read.code}\n${st.read.full}\n${st.read.stats}`);
      if(other&&other!==G){
        const full=st.read.full;G=other;p=loadPrefs(G);
        st.read={...await readCard(card,G,scanLang(),progress),full};
      }
      const anchored=fullCardNameHints(G,st.read.full);
      if(anchored.length)st.read.name=[...anchored,st.read.name].join('\n');
      r=await lookup();
    }
    st.foundIn=G===selectedGame?'':G;
    return {...r,g:G};
  };
  const captureBuffer=[];
  let draining=false;
  const updatePending=(id,patch)=>updateBatch(id,patch);
  const thumbnail=card=>{
    const c=document.createElement('canvas'),k=Math.min(1,480/card.width);
    c.width=Math.round(card.width*k);c.height=Math.round(card.height*k);
    c.getContext('2d').drawImage(card,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',.78);
  };
  const process = async (card, entryId) => {
    const st=s(),selectedGame=game(),ticket=++scanTicket,started=performance.now();
    const current=()=>ticket===scanTicket&&s()===st&&S.ui.view==='scan';
    const entry=loadBatch().find(x=>x.id===entryId);
    // Only enqueue may create a capture. A discarded queued frame must not
    // resurrect itself when its delayed OCR work reaches the front of the queue.
    if(!entry)return;
    st.shot=entry.shot;st.busy=true;st.lensUrl='';st.cands=[];st.read=null;st.confirm=null;
    updatePending(entry.id,{status:'reading'});render();
    try {
      st.foundIn='';st.recognitionError='';st.read={name:'',code:'',full:''};
      const p=loadPrefs(entry.game);let r;
      try {r=await readFlow(card,entry.game,p,m=>{if(current())setStatus(m);});}
      catch(e){st.recognitionError=e.message||'Reading failed. Capture saved for retry.';r={g:entry.game,cands:[],tried:[]};}
      if(!current())return;
      const G=r.g||entry.game,scanPrefs=G===entry.game?{...p,...entry.defaults}:loadPrefs(G);
      // Local artwork is a fallback suggestion, never proof of an exact printing.
      if(!r.cands.some(c=>textVerifiedMatch(G,c,st.read))){
        const local=await localArtwork(card,G).catch(()=>null);
        if(local)r=recoverScanCandidates(G,r,local,st.read);
      }
      if(!current())return;
      r.cands=uniquePrintings(rankScanCandidates(G,r.cands,st.read)).map(c=>textVerifiedMatch(G,c,st.read)?c:{...c,exact:false});
      if(r.cands.filter(c=>c.exact).length>1)r.cands=r.cands.map(c=>({...c,exact:false}));
      // Old local packs may not include HP/attack metadata. Resolve at most three
      // suggestions, then reject conflicts again before any version is displayed.
      const detailed=await settleLimited(r.cands.slice(0,3),c=>c.localReference?hydrateCandidate(G,c).catch(()=>c):c,2);
      r.cands=rankScanCandidates(G,detailed.map(x=>x.value).filter(Boolean),st.read);
      if(!current())return;
      const resolved=resolvedEntry(entry,G,r.cands,st.read,c=>textVerifiedMatch(G,c,st.read),scanPrefs);
      updatePending(entry.id,{...resolved,error:st.recognitionError||''});
      st.cands=[];st.read=null;st.confirm=null;st.tried=r.tried||[];
      st.status=resolved.status==='ready'?`${resolved.cands[0].name} · ${GAME_LABEL[G]} printing ready.`:resolved.status==='review'?`${resolved.cands[0].name} captured. Check ${resolved.printingVerified?'finish':'printing'} later.`:'Capture saved. Keep scanning; retry this card later.';
      lockMsg='Queued. Next card'; // Capture feedback was already emitted on durable enqueue.
    }catch(e){if(current()){updatePending(entry.id,{status:'unresolved',reason:'Retry this capture',error:String(e.message||e)});st.status='Capture saved for retry. Keep scanning.';}}
    finally {
      if(current()){st.recognitionMs=performance.now()-started;st.busy=false;render();}
      else if(loadBatch().some(x=>x.id===entry.id&&x.status==='reading'))updatePending(entry.id,{status:'unresolved',reason:'Reading interrupted · retry'});
    }
  };
  const drainCaptures=async()=>{
    if(draining||s().busy||s().confirm)return;
    draining=true;
    try{while(captureBuffer.length&&S.ui.view==='scan'&&!s().confirm){
      const next=captureBuffer.shift();s().buffered=captureBuffer.length;
      await process(next.card,next.id);
      if(s().reviewRequested){const id=s().reviewRequested;s().reviewRequested='';openBatchReview(id);break;}
    }}finally{draining=false;s().buffered=captureBuffer.length;}
  };
  const enqueueCapture=(card,replaceId='')=>{
    if(captureBuffer.length>=CAPTURE_BUFFER_LIMIT){setStatus('Reading queue full. Hold this card a moment.');return false;}
    const before=loadBatch();
    if(!replaceId&&before.length>=BATCH_LIMIT){setStatus('Batch full. Save or review some cards to continue.');return false;}
    if(s().storageBlockedAt!=null&&before.length>=s().storageBlockedAt&&Date.now()<(s().storageBlockedUntil||0)){setStatus('Storage full. This card is not queued. Save or review the current batch first.');return false;}
    const snapshot=document.createElement('canvas');snapshot.width=card.width;snapshot.height=card.height;snapshot.getContext('2d').drawImage(card,0,0);
    const entry=captureEntry(game(),thumbnail(snapshot),prefs());
    const replacement=replaceId&&before.some(x=>x.id===replaceId);
    if(replacement)entry.id=replaceId;
    const next=replacement?before.map(x=>x.id===replaceId?entry:x):[...before,entry];
    if(!saveBatch(next)){
      saveBatch(before);s().storageBlockedAt=before.length;s().storageBlockedUntil=Date.now()+2000;
      setStatus('Storage full. This card is not queued. Your earlier captures are unchanged.');render();return false;
    }
    s().storageBlockedAt=null;
    captureBuffer.push({card:snapshot,id:entry.id});s().buffered=captureBuffer.length;
    (s().queueAnimationIds ||= []).push(entry.id);
    feedback('ok',prefs());flash('Queued · next card');render();void drainCaptures();return true;
  };
  ctx.enqueueCapture=enqueueCapture;

  // Live camera
  const loop = () => {
    const v = document.getElementById("scanVideo");
    if (!v || !v.videoWidth || !v.clientWidth || !v.clientHeight) return;
    if (s().confirm) {
      const status=document.getElementById("camStatus");
      if(status) status.textContent="Review the match below. Camera stays live.";
      return;
    }
    if(s().reviewRequested || s().batchSaving)return;
    const cover=Math.max(v.clientWidth/v.videoWidth,v.clientHeight/v.videoHeight),sw=Math.min(v.videoWidth,v.clientWidth/cover),sh=Math.min(v.videoHeight,v.clientHeight/cover),sx=(v.videoWidth-sw)/2,sy=(v.videoHeight-sh)/2,scale=Math.min(224/sw,300/sh),W=Math.round(sw*scale),H=Math.round(sh*scale),c=(loop.c ||= document.createElement("canvas"));
    c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,sx,sy,sw,sh,0,0,W,H);
    const pixels=x.getImageData(0,0,W,H),found=detectCardQuad(pixels.data,W,H);
    let m={edges:0,sharp:0,glare:0,bright:100,motion:0};
    if(found){
      const next=found.quad.map(p=>({x:p.x/scale+sx,y:p.y/scale+sy}));
      const geometryMotion=loop.quad?next.reduce((n,p,i)=>n+Math.hypot(p.x-loop.quad[i].x,p.y-loop.quad[i].y),0)/4/Math.hypot(sw,sh):1;
      loop.geometryMotion=geometryMotion;loop.quad=next;loop.quadAt=Date.now();
      const normalized=warpPixels(pixels.data,W,H,found.quad,120,168),quality=normalizedQuality(normalized,120,168);
      m={edges:found.edges??0,sharp:Math.min(quality.nameSharp,quality.codeSharp),bright:quality.bright,glare:Math.max(quality.nameSharp<T.sharp?quality.nameGlare:0,quality.codeSharp<T.sharp?quality.codeGlare:0),motion:Math.max(prevGray?sigDiff(quality.gray,prevGray):0,loop.geometryMotion*300)};prevGray=quality.gray;loop.signature=toGray(warpPixels(pixels.data,W,H,found.quad,16,22),16,22);
    }else {loop.quad=null;prevGray=null;loop.bestCard=null;}
    if (window.__scanDebug) window.__scanDebug.push({ ...m, vw: v.videoWidth, vh: v.videoHeight });
    let st = found?guideState(m, steady):{state:"red",icon:"◎",msg:"Show one clear card. No alignment needed"};
    steady = st.state === "green" || (st.state === "amber" && st.msg === "Hold steady…") ? steady + 1 : 0;
    // After an add, wait for a different card (or the card to leave) before capturing again.
    // One automatic capture per card: wait for a different card (or the card to leave) first.
    if (lockSig) {
      const now = loop.signature;
      loop.missingFrames=m.edges<2?(loop.missingFrames||0)+1:0;
      loop.changedFrames=now&&sigDiff(now,lockSig)>22?(loop.changedFrames||0)+1:0;
      if (loop.missingFrames>=3 || loop.changedFrames>=3) {lockSig=null;loop.bestCard=null;steady=0;}
      else if (st.state === "green") st = { state: "green", icon: "✓", msg: s().busy ? "Reading card…" : lockMsg };
    }
    if(found&&!lockSig&&m.motion<T.motion&&m.sharp>=T.sharp&&m.glare<=T.glare){
      const qualityScore=m.sharp/(1+m.motion);
      if(!loop.bestCard||Date.now()-loop.bestCard.at>900||qualityScore>loop.bestCard.score){
        loop.bestCard={card:flattenCapture(v,padQuad(loop.quad,v.videoWidth,v.videoHeight)),score:qualityScore,at:Date.now()};
      }
    }
    s().guide = st;
    s().boundaryReady=!!found; // Internal capture state only: no visible outline or mask.
    const el = document.getElementById("camStatus");
    if (el) {
      el.className = "cam-status " + st.state;
      el.innerHTML = `<i class="cam-dot" aria-hidden="true"></i>${esc(st.msg)}`;
    }
    if (st.state === "green" && !lockSig) {
      greenSince ||= Date.now();
      if (s().auto !== false && captureBuffer.length<CAPTURE_BUFFER_LIMIT && Date.now() - greenSince > 160) capture();
    } else greenSince = 0;
  };
  // One <video> for the whole session, moved into each fresh render, so playback never restarts.
  const attach = () => {
    const slot = document.getElementById("camSlot");
    if (!stream || (!slot && !document.getElementById("scanVideo"))) return;
    if (!videoEl) {
      videoEl = document.createElement("video");
      Object.assign(videoEl, { id: "scanVideo", muted: true, autoplay: true, playsInline: true });
      videoEl.setAttribute("playsinline", "");
    }
    if (slot) slot.replaceWith(videoEl);
    const v = videoEl;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (v.paused) v.play?.().catch(() => {});
    clearInterval(loopTimer);
    loopTimer = setInterval(loop, 160);
  };
  const capture = () => {
    const v = document.getElementById("scanVideo");
    if (!v?.videoWidth || s().confirm || s().reviewRequested || s().batchSaving) return;
    if(!loop.quad||Date.now()-loop.quadAt>1000)loop();
    if(!loop.quad||Date.now()-loop.quadAt>1000){toast('Keep one whole card visible so its edges can be found.');return;}
    const c=loop.bestCard&&Date.now()-loop.bestCard.at<900?loop.bestCard.card:flattenCapture(v,padQuad(loop.quad,v.videoWidth,v.videoHeight));
    const sample=document.createElement('canvas');sample.width=120;sample.height=168;const sx=sample.getContext('2d',{willReadFrequently:true});sx.drawImage(c,0,0,120,168);
    const quality=normalizedQuality(sx.getImageData(0,0,120,168).data,120,168);
    if(Math.min(quality.nameSharp,quality.codeSharp)<T.sharp){setStatus('Keep the name and bottom code readable. Hold steady.');return;}
    s().lastCard = c;
    greenSince = 0;
    if(enqueueCapture(c,s().retryBatchId||"")){s().retryBatchId="";lockSig = loop.signature||sigOf(c);loop.missingFrames=0;loop.changedFrames=0;loop.bestCard=null;lockMsg = "Captured. Next card";}
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
      const track=got.getVideoTracks()[0],caps=track?.getCapabilities?.()||{};
      if(caps.focusMode?.includes?.("continuous"))track.applyConstraints({advanced:[{focusMode:"continuous"}]}).catch(()=>{});
      // Warm reusable local readers without blocking camera playback.
      loadIndex(game()).catch(()=>{});
      getWorker(scanLang(),()=>{}).catch(()=>{});
      s().camOn = true;
      s().torch = false;
      s().torchCap = !!got.getVideoTracks()[0]?.getCapabilities?.().torch;
      s().status = "";
      render();
      window.scrollTo?.({top:0});
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
    window.scrollTo?.({top:0});
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
    if (!st.url || st.busy || st.confirm) return;
    const r = await loadImage(st.url).catch(() => null);
    if (!r) return toast("Couldn’t open that photo.");
    // Crop to the box (fractions of the photo as shown).
    const rw = r.naturalWidth,
      rh = r.naturalHeight,
      backgroundBox = st.crop ? null : autoBox(r),
      cr = st.crop || backgroundBox || { x: 0, y: 0, w: 1, h: 1 },
      k = Math.min(3, 1100 / (rw * cr.w)),
      c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(rw * cr.w * k));
    c.height = Math.max(1, Math.round(rh * cr.h * k));
    c.getContext("2d").drawImage(r, rw * cr.x, rh * cr.y, rw * cr.w, rh * cr.h, 0, 0, c.width, c.height);
    let chosen=c;
    if(!st.crop&&!preserveWholeCardPhoto(rw,rh,backgroundBox)){const scale=Math.min(320/rw,400/rh),sample=document.createElement("canvas");sample.width=Math.round(rw*scale);sample.height=Math.round(rh*scale);const x=sample.getContext("2d",{willReadFrequently:true});x.drawImage(r,0,0,sample.width,sample.height);const found=detectCardQuad(x.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height);if(found)chosen=flattenCapture(r,padQuad(found.quad,sample.width,sample.height).map(p=>({x:p.x/scale,y:p.y/scale})));}
    st.lastCard = chosen;
    if(enqueueCapture(chosen,s().retryBatchId||""))s().retryBatchId="";
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
    if(s().busy || s().confirm?.saving || s().lookup)return;
    const q = (document.getElementById(s().confirm ? "scanMatchName" : "scanName")?.value || "").trim();
    if (!q) return toast("Type the card name.");
    const st = s(),G=game();
    st.lookup=true;
    setStatus("Looking it up…");
    let r;
    try {r=await match(G, { name: q, code: q, full: "" }, scanLang(), true, setStatus);}
    catch {if(s()===st && game()===G){st.lookup=false;if(st.confirm)st.confirm.error="Couldn’t look up this card. Try again.";render();}return;}
    st.lookup=false;
    if(s()!==st || game()!==G)return;
    if(st.confirm && !r.cands.length){st.confirm.error="No matching cards. Try another name or skip this scan.";render();return;}
    st.cands = r.cands;
    st.read={name:q,code:"",full:""};
    if(r.cands.length){const p=prefs(),fs=finishesFor(game(),r.cands[0]),finish=resolveScanFinish(game(),r.cands[0],p,st.read);st.confirm={i:0,qty:st.confirm?.qty||p.qty||1,condition:st.confirm?.condition||p.condition,lang:st.confirm?.lang||p.lang||"en",finish,price:ctx.priceOf(game(),r.cands[0],finish),saving:false,error:"",editing:true};}
    else if(st.confirm)st.confirm.error="No matching cards. Try another name or skip this scan.";
    st.tried = r.tried;
    st.status = r.cands.length ? "Check the picture matches your card, then tap Add." : "No card found with that name.";
    render();
  };
  const hydration=new Map();
  const hydrateCandidate=(G,c)=>{
    if(!c.localReference)return Promise.resolve(c);
    const key=G+":"+c.id;
    if(!hydration.has(key))hydration.set(key,(async()=>{
      for(let attempt=0;attempt<2;attempt++)try{
        const full=await ctx.candById?.(G,c.id,c.why,c.exact);
        if(!full?.card || String(full.card.id)!==String(c.card?.id||c.id) || scanNameKey(full.name)!==scanNameKey(c.name))throw Error("Card details are unavailable. Connect and try again.");
        return {...full,exact:c.exact,print:c.print||full.print,sub:c.sub,localReference:false};
      }catch(e){if(attempt===1)throw e;await new Promise(resolve=>setTimeout(resolve,250));}
    })().finally(()=>hydration.delete(key)));
    return hydration.get(key);
  };
  A.scanCatalogDownload=async()=>{
    const G=game();
    try{await downloadCatalog(G,()=>{if(game()===G&&S.ui.view==="scan"){render();const control=document.querySelector?.('.scan-catalog-settings .scan-catalog-control');if(control)control.outerHTML=catalogControl(G,s());}});toast("Recognition pack saved on this device.");}
    catch(e){toast(e.message);}
  };
  A.scanCatalogRemove=async()=>{await removeCatalog(game());toast("Recognition text pack removed. Your collection is unchanged.");render();};
  const persistReview=()=>{
    const q=s().confirm;if(!q?.batchId)return;
    updatePending(q.batchId,{qty:q.qty,condition:q.condition,lang:q.lang,finish:q.finish,selectedIndex:q.i});
  };
  const resetConfirmation = (message) => {
    Object.assign(s(),{confirm:null,cands:[],read:null,status:message});
    lockMsg=message;greenSince=0;render();void drainCaptures();
  };
  const openBatchReview=(id='')=>{
    const rows=loadBatch(),entry=rows.find(x=>x.id===id)||rows.find(x=>!['ready','reading','captured'].includes(x.status))||rows[0];
    if(!entry)return;
    if(s().busy){s().reviewRequested=entry.id;setStatus('Finishing this read, then opening review.');return;}
    const cands=entry.cands||[],i=Number.isInteger(entry.selectedIndex)?entry.selectedIndex:(cands.length===1?0:-1),c=cands[i],G=entry.game;
    Object.assign(s(),{shot:entry.shot,cands,read:entry.read||{},confirm:{batchId:entry.id,game:G,i,qty:entry.qty||1,condition:entry.condition||'Near Mint',lang:entry.lang||'en',finish:entry.finish||'',price:c&&entry.finish?ctx.priceOf(G,c,entry.finish):null,saving:false,error:'',unresolved:!cands.length}});
    render();
  };
  A.scanBatchReview=t=>{if(!s().batchSaving&&!s().confirm?.saving)openBatchReview(t?.dataset?.id||'');};
  A.scanConfirmQty=t=>{const q=s().confirm;if(q&&!q.saving){q.qty=Math.min(999,Math.max(1,q.qty+Number(t.dataset.d)));persistReview();render();}};
  A.scanConfirmCondition=t=>{const q=s().confirm;if(q&&!q.saving&&CONDITIONS.some(([v])=>v===t.dataset.condition)){q.condition=t.dataset.condition;q.detailsOpen=true;persistReview();render();}};
  C.scanConfirmLanguage=t=>{const q=s().confirm;if(q&&!q.saving&&LANGS.some(([v])=>v===t.value)){q.lang=t.value;q.detailsOpen=true;persistReview();render();}};
  C.scanConfirmFinish=t=>{const q=s().confirm,c=s().cands?.[q?.i??0],G=q?.game||game();if(q&&!q.saving&&c&&finishesFor(G,c).includes(t.value)){q.finish=t.value;q.price=ctx.priceOf(G,c,q.finish);persistReview();render();}};
  A.scanEditMatch=()=>{const q=s().confirm;if(q&&!q.saving){q.editing=!q.editing;render();}};
  A.scanChoose=t=>{
    const q=s().confirm,i=Number(t.dataset.i),c=s().cands?.[i],G=q?.game||game();
    if(q&&!q.saving&&c){q.i=i;q.editing=false;q.finish=resolveScanFinish(G,c,loadPrefs(G),s().read);q.price=q.finish?ctx.priceOf(G,c,q.finish):null;persistReview();render();}
  };
  A.scanRetry=async()=>{
    const st=s(),q=st.confirm;if(st.busy||q?.saving)return;
    const entry=loadBatch().find(x=>x.id===q?.batchId);
    st.confirm=null;st.cands=[];st.read=null;st.retryBatchId=entry?.id||'';
    lockSig=null;greenSince=0;steady=0;
    if(st.camOn){st.status='Show this card again, with the name and bottom code clear.';render();return;}
    // A stored capture can be retried after reconnecting, without searching a catalogue.
    if(entry?.shot){
      try{const img=await loadImage(entry.shot),c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;c.getContext('2d').drawImage(img,0,0);enqueueCapture(c,entry.id);st.retryBatchId='';}
      catch{st.status='Open the camera or upload a clearer photo to retry this capture.';render();}
    }else {st.status='Open the camera or choose a clearer photo.';render();}
  };
  A.scanDismiss=()=>{if(!s().confirm?.saving){persistReview();resetConfirmation('Kept for later. Move to the next card.');}};
  A.scanBatchDiscard=()=>{const q=s().confirm;if(q?.batchId&&!q.saving){removeBatch(q.batchId);resetConfirmation('Capture removed. Move to the next card.');}};
  A.scanConfirm=async()=>{
    const st=s(),q=st.confirm,c=st.cands?.[q?.i??0],G=q?.game||game();
    if(!q||!c||q.i<0||!q.finish||q.saving)return;
    q.saving=true;q.error='';q.errorDetail='';render();
    try{
      const resolved=await hydrateCandidate(G,c);
      if(s()!==st||st.confirm!==q)return;
      if(!finishesFor(G,resolved).includes(q.finish)){q.finish='';throw Error('This printing has different finishes. Choose its exact finish.');}
      const item=makeItem(resolved,{...q,printingConfirmed:true},G);
      await ctx.addMany(G,[{...item,location:loadPrefs(G).location||''}]);
      const queueSaved=!q.batchId||removeBatch(q.batchId);
      feedback('ok',loadPrefs(G));
      if(s()===st){flash(`Saved ${item.qty} × ${c.name}`);resetConfirmation(queueSaved?'Saved. Move to the next card.':'Saved to collection. Queue update failed; retrying is safe.');}
    }catch(e){if(s()===st){q.saving=false;q.errorDetail=String(e?.stack||e?.message||e);q.error=e.message==='Choose the exact finish / edition before saving.'?e.message:"Couldn't save this card. Your match is still here; try again.";render();}}
  };
  A.scanBatchSave=async()=>{
    const st=s();if(st.batchSaving||st.confirm?.saving)return;
    const ready=loadBatch().filter(x=>x.status==='ready'&&x.finish&&x.cands?.length===1);
    if(!ready.length)return;
    st.batchSaving=true;st.batchError='';render();let saved=0,queueSaved=true;
    try{
      for(const entry of ready){
        const c=await hydrateCandidate(entry.game,entry.cands[0]);
        if(!finishesFor(entry.game,c).includes(entry.finish)){
          updatePending(entry.id,{status:'review',finish:'',reason:'Choose finish / edition'});continue;
        }
        const item=makeItem(c,{...entry,captureId:entry.id},entry.game);
        // captureId makes collection retries safe if queue removal cannot persist.
        await ctx.addMany(entry.game,[{...item,location:loadPrefs(entry.game).location||''}]);
        if(!removeBatch(entry.id))queueSaved=false;saved+=item.qty;
      }
      st.status=`Saved ${saved} card${saved===1?'':'s'} to the matching collections.${queueSaved?'':' Queue update failed; retrying is safe.'}`;
      if(saved)feedback('ok',prefs());
    }catch(e){st.batchError=`Saved ${saved}. The remaining captures are still here. ${e.message||'Please try again.'}`;}
    finally{st.batchSaving=false;render();void drainCaptures();}
  };

  ctx.confirmKey = e => {
    if(document.querySelector?.("#sheet[open], .zoom-overlay, .tour"))return;
    if(!s().confirm||e.repeat||!['Enter',' '].includes(e.key)||e.target?.closest?.('button,input,select,textarea,a'))return;
    e.preventDefault();A.scanConfirm();
  };
  if(typeof document!=="undefined")document.addEventListener?.("keydown",e=>{if(S.ui.view==="scan")ctx.confirmKey(e);});
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
      <p class="small muted">The camera keeps capturing while cards are read. Nothing is added to your collection until you save.</p>
      <label class="check ss-set"><input type="checkbox" data-change="scanAuto" ${s().auto!==false?'checked':''}><span><b>Capture automatically</b><small>Turn off to capture only with the camera button.</small></span></label>
      ${defaultsPill(G,p)}<p class="small muted">Finish and condition are your batch defaults, not camera measurements. An unsupported finish still needs review.</p>
      ${!s().torchCap?'<p class="small muted">Flashlight is not available on this camera. Use a bright light beside the card and tilt away from glare.</p>':''}
      <label class="field">Lock set<input data-change="scanPref" data-k="lockSet" value="${esc(p.lockSet)}" placeholder="${G === "mtg" ? "Set code, e.g. WOE" : G === "ygo" ? "Set code, e.g. LOB" : "Set id, e.g. sv1"}" autocapitalize="characters"><small class="muted">Sorting one set? Matches from it come first${G === "mtg" ? ", and names are looked up in it" : ""}.</small></label>
      ${G === "mtg" ? chk("ignorePromos", "Ignore promos", "Prefer the regular printing when a name match lands on a promo.") : ""}
      ${chk("preferFoil", "Prefer foil", "Start new scans as foil (you can still tap the finish).")}
      ${chk("sounds", "Sounds", "A short chime for each card added, a low tone when nothing matched.")}
      ${chk("haptics", "Vibration", "A tap on each card added.")}
      ${chk("showValue", "Show prices and total value")}
      <label class="field">Text recognition language<select data-change="scanLang">${[["eng", "English"], ["jpn+eng", "Japanese (+ English)"]].map(([v, l]) => `<option value="${v}" ${scanLang() === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <section class="scan-catalog-settings"><h3>Recognition download</h3><p class="small muted">Card names, printing codes and image references stay on this device. Current prices and full card details use the internet.</p>${catalogControl(G,s())}${catalogState(G).status==="ready" ? `<button class="link small" data-act="scanCatalogRemove">Remove this game's text pack</button>` : ""}</section>
      <details class="settings-disclosure"><summary>Scanning tips</summary><ul class="guide-list small"><li>Plain, contrasting surface; one card at a time.</li><li>No exact alignment needed. Keep the whole card, name and bottom code readable.</li><li>Tilt slightly or use the flashlight off-axis to kill foil glare.</li><li>Sorting a single set? Lock it for faster, surer matches.</li><li>Swap cards after the capture chime; review the uncertain ones when finished.</li></ul></details>`;
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
    const st=s(),G=game();
    if(st.catalogInitGame!==G){
      st.catalogInitGame=G;
      Promise.all([initCatalog(G),catalogManifest().catch(()=>null)]).then(([,m])=>{if(s()===st&&game()===G&&S.ui.view==="scan"){st.catalogMeta=m?.games?.[G];render();}});
    }
    if(!st.ocrWarm){st.ocrWarm=true;getWorker(scanLang(),()=>{}).catch(()=>{});}
    if(st.confirm){
      const q=st.confirm,c=st.cands?.[q.i??0],reviewGame=q.game||G;q.presented=true;
      if(c?.localReference && q.detailStartedFor!==c.id+":"+c.print){
        q.detailStartedFor=c.id+":"+c.print;
        hydrateCandidate(reviewGame,c).then(full=>{if(s()===st&&st.confirm===q&&st.cands[q.i??0]===c){st.cands[q.i??0]=full;const fs=finishesFor(reviewGame,full);if(q.finish&&!fs.includes(q.finish))q.finish="";q.price=q.finish?ctx.priceOf(reviewGame,full,q.finish):null;render();}}).catch(()=>{});
      }
    }
    if (s().camOn) attach();
    const arrivals=st.queueAnimationIds?.splice(0)||[];
    if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)arrivals.forEach((id,i)=>{
      const thumb=[...document.querySelectorAll('.scan-batch-thumb')].find(el=>el.dataset.id===id);
      thumb?.animate?.([{opacity:0,transform:'translateY(-18px) scale(1.15)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:280,delay:Math.min(i,3)*40,easing:'cubic-bezier(.2,.8,.2,1)'});
    });
    attachCrop();
  };
}
