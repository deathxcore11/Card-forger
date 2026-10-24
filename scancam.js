import { aiFetch, invalidateAiAuth } from './ai-auth.js';
import {mountFeedback,removeFeedback} from './feedback-layer.js';
import {scannerLookupHTML,scannerCandidateCarousel,scannerBrowseHTML,scannerBrowseFilters,createScannerBrowse,scanHelp} from './scanner-review.js';
import {attachPrintingCarousel} from './printing-carousel.js';
import {detectCardQuad,analysisRegions,selectSensorProposal,warpPixels,normalizedQuality} from './scan-vision.js';
import {BATCH_LIMIT,CAPTURE_BUFFER_LIMIT,CAPTURE_STORAGE_LIMIT,captureCapacity,batchStorageSummary,loadBatch,saveBatch,updateBatch,removeBatch,batchStorageHealthy,captureEntry,uniquePrintings,actualFinishes,resolveScanFinish,resolvedEntry,batchCounts} from './scan-batch.js';
import {rankScanCandidates,signalEvidence,scanIdentifierEvidence,scanTitleEvidence,collectorKey} from './scan-signals.js';
import { ask, askText } from "./dialog.js";
// Card scanner for all three games:
//   live camera → find card boundary → normalize perspective → readable text bands → local multi-signal match → confirm → add
// Text recognition runs on the phone (Tesseract). Capture quality is shown
// in the status message. There is no alignment outline or fixed-size target.
// Thresholds are starting points tuned on test images; they should be refined with real phone photos.
import { S } from "./store.js";
import {catalogState,catalogManifest,initCatalog,invalidateCatalogRead,downloadCatalog,removeCatalog,localScanMatch,localIndexCandidate} from "./scan-catalog.js";
import { esc } from "./ui.js";
import {conditionRetryFeedback} from './condition-value.js';
import { scanLookupNames, shortTrainerNames, pokemonTitleLabel, nameCandidates, detectGame, anchoredNames, scanNameKey, scanCandidateMatches, ptcgNumbers, ygoSetCodes, mtgCollector } from "./scan.js";
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
  if (m.edges < 3) return { state: "red", icon: "▢", msg: "Keep all four card edges visible" };
  if (m.motion > T.motion) return { state: "amber", icon: "✋", msg: "Hold steady" };
  if (m.glare > T.glare) return { state: "amber", icon: "☀", msg: "Tilt slightly to reduce glare" };
  if (m.sharp < T.sharp) return { state: "amber", icon: "◎", msg: "Blurry. Hold still" };
  if (m.edges < 4) return { state: "amber", icon: "▢", msg: "Keep the name and bottom number visible" };
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
export const SCAN_DEADLINES={worker:15000,ocr:12000,local:6000,remote:8000,hydration:6000,artwork:2500,total:45000};
export function scanDeadline(work,ms,label,onTimeout=()=>{}) {
  let timer;
  return Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout();const e=Error(`${label} timed out. Capture saved for retry.`);e.code='SCAN_TIMEOUT';reject(e);},ms);})]).finally(()=>clearTimeout(timer));
}
// One logical capture, including its optional clearer-frame revision, owns this
// finite budget. It is local-only; adapter rounds are not raw HTTP request counts.
export const SCAN_LIMITS=Object.freeze({ocrCalls:18,initialOCR:12,refinementOCR:6,adapterRounds:3,adapterOperations:12,initialAdapterOperations:8,refinementAdapterOperations:4,refinements:1,refinementWindowMs:20000});
export function createScanBudget(now=clockNow){
 let deadline=null,expired=false,ocrCalls=0,adapterRounds=0,revisionOCR=0,revisionRounds=0,adapterOperations=0,revisionOperations=0,refined=false,ownedWorker=null,activeRevision=()=>true;
 const remote=new Map(),operations=new Map();
 const failure=()=>{const e=Error('Capture processing limit reached. Saved for review or explicit retry.');e.code='SCAN_BUDGET';return e;};
 return {latest:null,beginRevision(isRefinement=false){refined=isRefinement;revisionOCR=0;revisionRounds=0;revisionOperations=0;},begin(){deadline??=now()+SCAN_DEADLINES.total;},get expired(){return expired;},get remaining(){return deadline==null?SCAN_DEADLINES.total:Math.max(0,deadline-now());},get counts(){return {ocrCalls,adapterRounds,adapterOperations};},get availableOCR(){return SCAN_LIMITS.ocrCalls-ocrCalls;},
  bindCurrent(active){activeRevision=active;},
  check(){if(!activeRevision()){const e=Error('Reading interrupted · retry');e.code='SCAN_CANCELED';throw e;}if(expired||this.remaining<=0){expired=true;throw failure();}},
  ocr(){this.check();if(ocrCalls>=SCAN_LIMITS.ocrCalls||revisionOCR>=(refined?SCAN_LIMITS.refinementOCR:SCAN_LIMITS.initialOCR))throw failure();ocrCalls++;revisionOCR++;},
  ownWorker(w){this.check();ownedWorker=w;},
  async stage(trace,name,fn){this.begin();this.check();return trace.stage(name,()=>scanDeadline(fn,this.remaining,'Capture processing',()=>{expired=true;retireWorker(ownedWorker);}));},
  cached(key){return remote.get(key)||null;},
  async lookup(key,fn){this.check();if(remote.has(key))return remote.get(key);if(adapterRounds>=SCAN_LIMITS.adapterRounds||revisionRounds>=(refined?1:2))return {cands:[],tried:[],budgetLimited:true};adapterRounds++;revisionRounds++;const result=Promise.resolve().then(fn);remote.set(key,result);return result;},
  adapterControl(active=()=>true){
   const budget=this,until=now()+SCAN_DEADLINES.remote;let canceled=false;
   const check=()=>{budget.check();if(canceled||now()>=until||!active()){const e=Error('Card lookup canceled or timed out. Capture saved for review.');e.code='SCAN_CANCELED';throw e;}};
   return {cancel(){canceled=true;},check,async run(key,fn){check();let pending=operations.get(key);if(!pending){if(adapterOperations>=SCAN_LIMITS.adapterOperations||revisionOperations>=(refined?SCAN_LIMITS.refinementAdapterOperations:SCAN_LIMITS.initialAdapterOperations))throw failure();adapterOperations++;revisionOperations++;pending=Promise.resolve().then(()=>{check();return fn();});operations.set(key,pending);}const result=await pending;check();return result;}};
  },
  checkpoint(result){this.latest={...result,read:{...result.read,titles:result.read?.titles?.map(t=>({...t}))},cands:[...(result.cands||[])]};return result;}
 };
}
export const scanQueryKey=(g,read={})=>JSON.stringify([g,[...new Set(scanLookupNames(g,read).map(scanNameKey))],scanIdentifierEvidence(g,read).observations,scanIdentifierEvidence(g,read).passcodes||[]]);
function retireWorker(w){if(worker===w){worker=null;workerLang='';}try{Promise.resolve(w?.terminate?.()).catch(()=>{});}catch{}}
// The non-whitespace record separator prevents an orphan identifier in one
// image region from being completed by unrelated pixels in the next region.
const joinReads=(...sources)=>sources.filter(Boolean).join('\n␞\n');
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
    if (worker) retireWorker(worker);
    worker=null;
    const Tess = await scanDeadline(()=>loadOCR(),SCAN_DEADLINES.worker,'Text reader loading',()=>{ocrLoading=null;});
    let expired=false;
    const creating=Promise.resolve(Tess.createWorker(lang, 1, {
      workerPath: new URL("vendor/worker.min.js", location.href).href,
      workerBlobURL: false,
      logger: (m) => m.status && progress?.(m.status + (typeof m.progress === "number" ? " · " + Math.round(m.progress * 100) + "%" : "")),
    })).then(created=>{if(expired){retireWorker(created);throw Error('Reader startup expired.');}return created;});
    worker = await scanDeadline(()=>creating,SCAN_DEADLINES.worker,'Text reader startup',()=>{expired=true;});
    workerLang=lang;
    return worker;
  })();
  try {return await workerLoading;} finally {workerLoading=null;}
}
export async function releaseOCR() {
  if (workerLoading) await scanDeadline(()=>workerLoading,SCAN_DEADLINES.worker,'Text reader shutdown').catch(()=>{});
  if (worker) retireWorker(worker);
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
const recog = async (w, canvas, segmentation = 6, budget=null, observed=null) => {
  // Automatic page segmentation often discards a short name/footer strip entirely.
  // Use a text block for those crops and sparse text only for a whole card.
  budget?.ocr();budget?.ownWorker(w);
  return scanDeadline(async()=>{await w.setParameters?.({tessedit_pageseg_mode:String(segmentation)});budget?.check();const data=(await w.recognize(canvas)).data;budget?.check();observed?.(Number.isFinite(data.confidence)?data.confidence:null);return (data.text || "").trim();},SCAN_DEADLINES.ocr,'Text reading',()=>retireWorker(w));
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
export async function readCard(card, g, lang, progress = () => {}, { codeOnly = false, priorFull = '', cache = new Map(), trace = null, budget=null } = {}) {
  const w = await (trace?trace.stage('ocrWarmup',()=>getWorker(lang,progress)):getWorker(lang, progress)),
    L = LAYOUT[g] || LAYOUT.mtg,titles=[];
  const band=(name,roi,scale,invert=false)=>{
    const key=JSON.stringify([roi,scale,invert]);
    if(!cache.has(key)){let confidence=null;const run=async()=>({text:await recog(w,regionCanvas(card,roi,scale,invert),6,budget,c=>confidence=c),confidence});cache.set(key,trace?trace.stage(name,run):run());}
    return cache.get(key).then(result=>{if(name.startsWith('ocrName'))titles.push({text:result.text,source:'title',confidence:result.confidence});return result.text;});
  };
  // The artwork already named the card: only the set code / number is needed.
  if (codeOnly) {
    progress("Reading the set code…");
    return { name: "", code: [await band('ocrCode',L.code,3), L.pass ? await band('ocrPasscode',L.pass,3) : ""].join("\n"), full: priorFull };
  }
  progress("Reading the name…");
  let name = await band('ocrName',L.name,2.5);
  // Light letters on a dark banner (full-art, GX, foils) read better inverted.
  if (!nameCandidates(g, name).length) name = [name, await band('ocrNameInverted',L.name,2.5,true)].join("\n");
  // A tilted or loosely cropped photo puts the name lower: read a taller strip.
  if (!nameCandidates(g, name).length) name = [name, await band('ocrNameWide',[0,0,1,.16],2)].join("\n");
  progress("Reading the set code and number…");
  const code = [await band('ocrCode',L.code,3), L.pass ? await band('ocrPasscode',L.pass,3) : ""].join("\n");
  let full = priorFull;
  if (!full&&!nameCandidates(g, name).length) {
    progress("Reading the whole card…");
    full = await readFull(card, lang, progress,budget);
  }
  return { name, code, full, stats:"",titles };
}
// The whole card as text: for finding the name wherever it is and telling which game it is.
export async function readFull(card, lang, progress = () => {},budget=null) {
  const w = await getWorker(lang, progress);
  progress("Reading the whole card…");
  return recog(w, regionCanvas(card, [0, 0, 1, 1], 1), 11,budget);
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
  // Missing or edition-only Pokémon metadata cannot establish a real finish.
  return g==='ptcg' ? actual : actual.length ? actual : FINISHES[g].map(x=>x[0]);
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
  if (k === "finish") return FINISHES[g].map(([v, l]) => ({ v, l, sub: { nonfoil: "Non-foil", foil: "Traditional foil", etched: "Etched foil", normal: "No holo", holofoil: "Holo art", "reverse-holofoil": "Reverse holo", unlimited: "Unlimited print run", "1st-edition": "1st Edition stamp", limited:"Limited Edition stamp" }[v] }));
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

function captureThumbnails(rows, selected='', disabled=false) {
  return rows.map(row=>`<button class="scan-batch-thumb ${row.status}" data-act="scanBatchReview" data-id="${esc(row.id)}" aria-label="${esc(row.cands?.[0]?.name||'Captured card')}: ${esc(row.reason||row.status)}" ${selected===row.id?'aria-current="true"':''} ${disabled?'disabled':''}>${row.shot?`<img src="${esc(row.shot)}" alt="">`:''}<span>${row.status==='ready'?'✓':['captured','reading'].includes(row.status)?'…':'?'}</span></button>`).join('');
}
export function batchTray(st) {
  const rows=loadBatch(),counts=batchCounts(rows),busy=!!st.busy||counts.reading>0,photoSpace=Math.min(100,Math.round(batchStorageSummary().chars/CAPTURE_STORAGE_LIMIT*100));
  const alerts=`${!batchStorageHealthy()?`<p role="alert">Device storage is full. Keep this page open and review this batch.</p>`:''}${st.batchError?`<p role="alert">${esc(st.batchError)}</p>`:''}`;
  if((st.mode||'live')==='live')return `<section class="scan-batch-tray scan-pile-tray" aria-label="Captured batch" data-batch-count="${rows.length}"><button class="scan-pile" data-act="scanBatchReview" aria-label="Review ${rows.length} captured ${rows.length===1?'card':'cards'}${busy?', reading in progress':''}" ${!rows.length||st.batchSaving?'disabled':''}><span class="scan-pile-cards" aria-hidden="true">${rows.length?rows.slice(-3).map(row=>`<i>${row.shot?`<img src="${esc(row.shot)}" alt="">`:''}</i>`).join(''):'<i></i><i></i>'}<b>${rows.length}</b></span><span>${busy?'Reading…':'Review scans'}</span></button>${alerts?`<div class="scan-pile-alerts">${alerts}</div>`:''}</section>`;
  return `<section class="scan-batch-tray" aria-label="Captured batch" data-batch-count="${rows.length}"><div class="scan-batch-summary"><span><b>${rows.length} captured</b><small>${counts.ready} ready${photoSpace?` · ${photoSpace}% photo space`:''}${counts.review?` · ${counts.review} to check`:''}${busy?' · reading…':''}</small></span><button class="btn ghost small" data-act="scanBatchReview" ${!rows.length||st.batchSaving?'disabled':''}>Review${counts.review?` ${counts.review}`:''}</button>${counts.ready?`<button class="btn small" data-act="scanBatchSave" ${st.batchSaving?'disabled':''}>${st.batchSaving?'Saving…':`Review ${counts.ready} matches`}</button>`:''}</div>${rows.length?`<div class="scan-batch-strip">${captureThumbnails(rows.slice(-8))}</div>`:'<p>Swap cards after each capture. Check any uncertain printings when you’re done.</p>'}${alerts}</section>`;
}
function reviewCapturePile(st) {
  if(!st.confirm?.batchId||(st.mode||'live')!=='live')return '';
  const rows=loadBatch();
  return `<div class="scan-review-queue"><small>${rows.length} ${rows.length===1?'capture':'captures'} to review</small><div class="scan-batch-strip" role="group" aria-label="Choose a captured card">${captureThumbnails(rows,st.confirm.batchId,!!st.confirm.saving)}</div></div>`;
}
export function scanView(g, gameName) {
  const s=S.ui.scan,p=loadPrefs(g),live=(s.mode||"live")==="live",list=loadSession(g);
  const rail=`<div class="cam-rail">${s.torchCap?`<button class="${s.torch?"on":""}" data-act="scanTorch" aria-pressed="${!!s.torch}" aria-label="Flashlight">${TORCH}</button>`:""}<button data-act="scanSettings" aria-label="Scanner settings">${GEAR}</button></div>`;
  return `<div class="scan-workspace ${live?'is-camera':''} ${s.camOn?'is-live':''}"><div class="scan-toolbar"><h1>Scan</h1><span class="scan-auto-game">Auto game</span><button class="btn ghost small" data-act="scanMode" data-id="${live?'photo':'live'}">${live?'Photo':'Camera'}</button>${s.camOn?`<button class="icon" data-act="scanStop" aria-label="Stop camera">${STOP}</button>`:`<button class="icon" data-act="scanSettings" aria-label="Scanner settings">${GEAR}</button>`}</div>
  <section class="panel scan-panel">${live?`<div class="cam-wrap ${s.camOn?'immersive':''}" id="camWrap">${s.camOn?`<div id="camSlot"></div><div class="cam-status" id="camStatus" role="status"><i class="cam-dot" aria-hidden="true"></i>${esc(s.guide?.msg||'Show one whole card anywhere')}</div>${rail}<div class="scan-flash" id="scanFlash" aria-live="polite"></div><button class="scan-shutter" id="scanCaptureBtn" data-act="scanCapture" aria-label="Capture card now">${CAMERA}</button>`:`<div class="scan-drop"><span class="scan-ghost" aria-hidden="true"></span><b>Ready for your next find.</b><span class="muted small">Magic, Pokémon and Yu-Gi-Oh! — recognised as you scan.</span><button class="btn scan-go" data-act="scanStart">${CAMERA} Start camera</button><small class="muted">Keep the whole card in view, with good light.</small><p class="scan-status-line" id="scanStatus" role="status">${esc(s.status||'')}</p></div>`}</div>`:`<div class="actions wrap"><label class="btn">${CAMERA} Take photo<input type="file" accept="image/*" capture="environment" data-change="scanFile" hidden></label><label class="btn ghost">Upload<input type="file" accept="image/*" data-change="scanFile" hidden></label></div>${s.url?`<div class="crop-wrap" id="cropWrap"><img id="cropImg" src="${esc(s.url)}" alt="Your photo"><div class="crop-box" id="cropBox"></div></div><div class="actions wrap"><button class="btn ghost small" data-act="scanRotate">Rotate</button><button class="btn ghost small" data-act="scanCropReset">Whole photo</button><button class="btn" data-act="scanRead" ${s.busy||s.photoLoading?'disabled':''}>${s.busy||s.photoLoading?'Reading…':'Read card'}</button></div>`:''}`}
  ${!live||s.camOn?`<p class="scan-status-line" id="scanStatus" role="status">${esc(s.status||(s.camOn?'Move closer until the name and bottom number are clear. Keep all four edges visible.':'Capture first. Review only what needs checking.'))}</p>`:''}</section>
  ${batchTray(s)}${scanConfirmation(s.confirm?.game||g,s,p)}
  ${!live?`<p class="scan-disclosure">Finish and condition are not detected from a photo. ${p.finishConfirmed?`Batch finish: ${esc(finishLabel(g,null,p.finish))}.`:'Choose the finish during review, or set a batch default in settings.'}</p>`:''}
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
  captureLock = null,
  lockMsg = "",
  greenSince = 0;

const loadImage = (url) =>
  new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => bad(Error("Couldn’t open that photo."));
    img.src = url;
  });
const sigDiff = (a, b) => (a && b ? a.reduce((x, v, i) => x + Math.abs(v - b[i]), 0) / a.length : 255);

export const CAPTURE_MAX_EDGE=1280;
export const SCAN_ANALYSIS_SIZE=Object.freeze({width:192,height:256});
// Duplicate identity has a fixed coordinate system chosen by the accepted
// original. A refined detector quad or resized preview is not a new card.
export function captureLockSignature(rgba,width,height,region=null){
  const quad=region?.length===4?region.map(p=>({x:p.x*(width-1),y:p.y*(height-1)})):[{x:0,y:0},{x:width-1,y:0},{x:width-1,y:height-1},{x:0,y:height-1}];
  // Average a small area per cell rather than aliasing one point. A modest
  // handheld translation/rotation should not look like entirely new artwork.
  const gray=toGray(warpPixels(rgba,width,height,quad,64,88),64,88),signature=new Float32Array(16*22);
  for(let y=0;y<22;y++)for(let x=0;x<16;x++)for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)signature[y*16+x]+=gray[(y*4+dy)*64+x*4+dx]/16;
  return signature;
}
export function observeCaptureLock(lock,signature,{paused=false,missing=false,geometrySignature=null,geometryComparable=false}={}){
  if(!lock)return false;
  if(paused){lock.changedFrames=0;lock.missingFrames=0;return false;}
  const delta=sigDiff(lock.signature,signature),sameMovingCard=geometryComparable&&lock.geometrySignature&&geometrySignature&&sigDiff(lock.geometrySignature,geometrySignature)<=22;
  lock.changedFrames=delta>22&&!sameMovingCard?(lock.changedFrames||0)+1:0;
  // An intermittent outline failure on unchanged pixels must not rearm either.
  lock.missingFrames=missing&&delta>22?(lock.missingFrames||0)+1:0;
  return lock.changedFrames>=3||lock.missingFrames>=3;
}
let lockCanvas=null;
const sourceLockSignature=(source,region=null)=>{
  const c=lockCanvas ||= document.createElement('canvas'),scale=Math.min(SCAN_ANALYSIS_SIZE.width/source.width,SCAN_ANALYSIS_SIZE.height/source.height);
  c.width=Math.max(1,Math.round(source.width*scale));c.height=Math.max(1,Math.round(source.height*scale));
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,0,0,c.width,c.height);
  return captureLockSignature(x.getImageData(0,0,c.width,c.height).data,c.width,c.height,region);
};
const acceptedCaptureLock=candidate=>{
  const source=candidate.original,region=candidate.proposal?.quad?.map(p=>({x:p.x/Math.max(1,source.width-1),y:p.y/Math.max(1,source.height-1)}))||null;
  return {region,signature:sourceLockSignature(source,region),geometrySignature:candidate.signature&&Float32Array.from(candidate.signature),cropSafe:candidate.proposal?.cropSafe===true,changedFrames:0,missingFrames:0};
};

const clockNow=()=>globalThis.performance?.now?.()??Date.now();
// The only retained full-size canvas is the immutable original. A quadrilateral
// is a crop proposal, not proof that all of the card is inside it.
export function freezeCapture(source,proposal=null) {
  const w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height;
  if(!(w>0&&h>0))throw Error('This frame is not ready. Try again.');
  const k=Math.min(1,CAPTURE_MAX_EDGE/Math.max(w,h)),original=document.createElement('canvas');
  original.width=Math.max(1,Math.round(w*k));original.height=Math.max(1,Math.round(h*k));
  original.getContext('2d').drawImage(source,0,0,original.width,original.height);
  const scaleProposal=p=>({...JSON.parse(JSON.stringify(p)),quad:p.quad?.map(p=>({x:p.x*original.width/w,y:p.y*original.height/h})),alternatives:p.alternatives?.slice(0,2).map(scaleProposal)});
  const cloned=proposal?scaleProposal(proposal):null;
  return {original,proposal:cloned};
}
export function rotateCapture(source,turns=1) {
  const n=((turns%4)+4)%4;if(!n)return source;
  const c=document.createElement('canvas');c.width=n%2?source.height:source.width;c.height=n%2?source.width:source.height;
  const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(n*Math.PI/2);x.drawImage(source,-source.width/2,-source.height/2);return c;
}
// A best-frame candidate can never survive a changed card, movement or a new
// camera geometry. Image and signature are kept together through acceptance.
export function canReuseCapture(candidate,signature,geometryMotion=0,now=Date.now()) {
  return !!candidate&&now-candidate.at<900&&geometryMotion<.015&&sigDiff(candidate.signature,signature)<9;
}
// An automatic refinement is not another copy. Require the same held-card
// fingerprints, readable full geometry and substantial improvement in the worse
// text band. Identical encodings are rejected again at durable admission.
export function canRefineCapture(lock,entry,candidate,{paused=false,sourceSignature=null}={},now=Date.now()){
 if(paused||!lock?.automatic||!entry||entry.id!==lock.id||entry.captureRevision!==lock.revision||entry.captureIntent!=='automatic'||!['unresolved','review'].includes(entry.status)||entry.printingVerified||entry.reviewTouched||entry.printingConfirmed||entry.reviewSource||Number.isInteger(entry.selectedIndex)||entry.finish||entry.refinementCount>=SCAN_LIMITS.refinements)return false;
 if(!lock.settledAt||now-lock.settledAt>SCAN_LIMITS.refinementWindowMs||lock.refined||lock.refinementIdentical||lock.budget?.expired||lock.budget?.remaining<2500||lock.budget?.availableOCR<2)return false;
 if(!candidate?.proposal?.cropSafe||!candidate.quality||!lock.quality||!candidate.signature||sigDiff(lock.geometrySignature,candidate.signature)>14||sigDiff(lock.signature,sourceSignature)>22)return false;
 const a=lock.quality,b=candidate.quality;
 return b.motion<T.motion&&b.glare<=T.glare&&b.sharp>=Math.max(T.sharp,a.sharp*1.35,a.sharp+75)&&b.nameSharp>=a.nameSharp*.95&&b.codeSharp>=a.codeSharp*.95;
}
export function supplementScanEvidence(first,result){
 if(!first)return result;
 const current=result.read||{},old=first.game===result.g?first.read||{}:{};
 const read={...current,name:joinReads(old.name,current.name),code:joinReads(old.code,current.code),full:joinReads(old.full,current.full),stats:joinReads(old.stats,current.stats),titles:[...(old.titles||[{text:old.name||'',source:'title',confidence:null}]),...(current.titles||[{text:current.name||'',source:'title',confidence:null}])]};
 // Keep each original evidence object intact at rest. A different game is a
 // conflict too; it cannot be made equivalent by merging arbitrary text bands.
 return {...result,read,cands:uniquePrintings([...(result.cands||[]),...(first.game===result.g?first.cands||[]:[])]).map(c=>({...c,exact:false,...(first.game!==result.g?{identityConflict:true}:{})})),supplemental:true};
}
export function createScanTrace(now=clockNow) {
  const started=now(),timings={},counts={};
  return {timings,counts,async stage(name,fn){const at=now();counts[name]=(counts[name]||0)+1;try{return await fn();}finally{timings[name]=(timings[name]||0)+Math.max(0,now()-at);}},finish(){return {timings:{...timings,totalMs:Math.max(0,now()-started)},counts:{...counts}};}};
}
const capturePrefs=()=>Object.fromEntries(['mtg','ptcg','ygo'].map(G=>{const p=loadPrefs(G);return [G,{finish:p.finish,finishConfirmed:p.finishConfirmed,lockSet:p.lockSet,ignorePromos:p.ignorePromos,condition:p.condition,lang:p.lang,qty:p.qty,location:p.location}];}));

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
export function flattenCapture(source,quad,dimensions={}){
 const left=Math.max(0,Math.floor(Math.min(...quad.map(p=>p.x)))),top=Math.max(0,Math.floor(Math.min(...quad.map(p=>p.y)))),right=Math.ceil(Math.max(...quad.map(p=>p.x))),bottom=Math.ceil(Math.max(...quad.map(p=>p.y))),raw=document.createElement('canvas');
 raw.width=right-left+1;raw.height=bottom-top+1;const x=raw.getContext('2d',{willReadFrequently:true});x.drawImage(source,left,top,raw.width,raw.height,0,0,raw.width,raw.height);
 const out=document.createElement('canvas'),width=dimensions.outputWidth||480,height=dimensions.outputHeight||672;out.width=width;out.height=height;const result=warpPixels(x.getImageData(0,0,raw.width,raw.height).data,raw.width,raw.height,quad.map(p=>({x:p.x-left,y:p.y-top})),width,height);out.getContext('2d').putImageData(new ImageData(result,width,height),0,0);return out;
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
  if (!cand?.exact || !cand.card || cand.printingAmbiguous || (g==='ygo'&&cand.setReleaseUnverified)) return false;
  const evidence=signalEvidence(g,{...cand.card,name:cand.card.name||cand.name},read);
  if(evidence.conflicts.length||evidence.identifierConflict||evidence.identifierUncertain||evidence.signalConflict||evidence.nameConflict||cand.identityConflict||!evidence.exactMatch)return false;
  const names = [cand.name];
  const identifiers=scanIdentifierEvidence(g,read).observations;
  if (g === "ptcg") return names.some(n => scanCandidateMatches(cand.card, n, identifiers)) && identifiers.length > 0;
  if (g === "ygo") return identifiers.some(code => code === String(cand.print || "").split("|")[0]);
  const code = mtgCollector(read.code, read.full);
  return !!code && code.set === String(cand.card.set || "").toLowerCase() && collectorKey(code.number) === collectorKey(cand.card.collector_number);
}

// A loose photo may put the title outside its usual band. These are layout
// hints only; they cannot verify a printing without its independently read code.
export function fullCardNameHints(g,full) {
  const hints=[];
  // Each OCR observation has its own top of card. Never search arbitrary
  // footer/rules lines for a replacement title, and never let a later read
  // discard an earlier title merely because it contains more plausible words.
  for(const observation of String(full||'').split(/\n␞\n/).slice(0,4)){
    const lines=observation.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),anchored=anchoredNames(g,observation);
    if(g==='ptcg')for(let i=0;i<lines.length;i++){
      if(/^evolves\s+from\b/i.test(lines[i])){
        const prior=lines.slice(Math.max(0,i-3),i).reverse().find(x=>(x.match(/[A-Za-z]/g)||[]).length>=4);
        if(prior)anchored.push(prior);
      }
      if(/^(?:HP\s*\d{2,3}|\d{2,3}\s*HP)\W*$/i.test(lines[i]))anchored.push(...lines.slice(Math.max(0,i-1),i),...lines.slice(i+1,i+2));
    }
    const shortTitles=g==='ptcg'?shortTrainerNames({name:lines.slice(0,3).join('\n'),full:observation}):[];
    const title=lines.slice(0,3).find(line=>!(g==='ptcg'&&pokemonTitleLabel(line))&&((line.match(/[A-Za-z]/g)||[]).length>=4||shortTitles.includes(line))&&
      !/©|copyright|studio\s+dice|shueisha|konami|nintendo|creatures|game\s*freak|\b(?:ATK|DEF)\s*[/:]|\b(?:replica|tournaments)\b/i.test(line)&&
      !/^\W*(?:BASIC|STAGE\s*[12]|(?:SPELLCASTER|DRAGON|WARRIOR)\s*[/]\s*(?:NORMAL|EFFECT)|HP\s*\d+|\d+\s*HP)\W*$/i.test(line));
    // Keep one primary hypothesis per observation before expanding name words.
    const primary=anchored[0]||title;
    if(primary)hints.push(nameCandidates(g,primary)[0]||primary);
  }
  return [...new Set(hints)].slice(0,4);
}

// OCR can produce plausible-looking nonsense. Keep visual suggestions reviewable
// when text lookup fails, without turning visual similarity into a verified printing.
export function recoverScanCandidates(g, result, visual, read = {}) {
  if(result.cands.some(c=>textVerifiedMatch(g,c,read)) || !visual?.cands?.length)return result;
  const compatible=visual.cands.filter(c=>scanTitleEvidence(g,c.card||{name:c.name},read).exactMatch);
  const suggestions=(compatible.length?compatible:visual.cands).map(c=>({...c,exact:false,identitySource:'artwork',identityConflict:!compatible.length&&result.cands.length>0,why:"Artwork suggestion · check the card and printing"}));
  // An independent artwork suggestion is still useful against weak OCR, but
  // contradictory identities remain alternatives, never verified printings.
  return {...result,cands:uniquePrintings([...suggestions,...result.cands.map(c=>({...c,exact:false,...(!compatible.length?{identityConflict:true}:{})}))]),tried:[...(result.tried||[]),...(visual.tried||[])]};
}

// Conflicting OCR must be reviewed even when it yields only one candidate.
export function initialReviewIndex(entry) {
  const candidates=entry.cands||[];
  if(Number.isInteger(entry.selectedIndex)&&entry.selectedIndex>=0&&entry.selectedIndex<candidates.length)return entry.selectedIndex;
  return candidates.length===1&&!['identityConflict','identifierConflict','signalConflict'].some(key=>candidates[0][key])?0:-1;
}

export function scanSavedMarkup(item) {
  const price=typeof item.price==='number'&&Number.isFinite(item.price)&&item.price>=0?item.price:null;
  return `<div class="scan-saved-art" aria-hidden="true">${item.cand?.card?artworkHTML(item.cand.card,'',true):''}<span>✓</span></div><div><small>Added to Collection</small><strong>${esc(item.name)}</strong><span>${item.qty} × ${esc(item.condition)} · ${esc(item.finish)}</span><b>${price===null?'Condition price unavailable':money(price*item.qty)+' estimated value'}${price!==null&&item.qty>1?` <small>(${money(price)} each)</small>`:''}</b></div>`;
}

function showScanSaved(item) {
  if(!globalThis.document?.body)return;
  removeFeedback(document.querySelector('.scan-saved-receipt'));
  const receipt=document.createElement('div');receipt.className='scan-saved-receipt';receipt.setAttribute('role','status');receipt.setAttribute('aria-live','polite');receipt.innerHTML=scanSavedMarkup(item);mountFeedback(receipt);
  const target=[...document.querySelectorAll('[data-nav="collection"]')].find(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;});
  const art=receipt.querySelector('.scan-saved-art');
  // Animate a decorative copy only after persistence succeeds; never move the
  // camera, hide the receipt price, or delay the next capture.
  if(target&&art?.animate&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    const a=art.getBoundingClientRect(),b=target.getBoundingClientRect(),fly=art.cloneNode(true);
    fly.className='scan-saved-fly';Object.assign(fly.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px'});mountFeedback(fly);
    const animation=fly.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.18)`,opacity:0}],{duration:780,delay:500,easing:'cubic-bezier(.35,0,.2,1)',fill:'forwards'});
    animation.finished.catch(()=>{}).finally(()=>removeFeedback(fly));
  }
  if(!target&&art?.animate&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)art.animate([{transform:'scale(1)',opacity:1},{transform:'scale(.85)',opacity:0}],{duration:350,delay:800});
  setTimeout(()=>removeFeedback(receipt),4800);
}

export function scanConditionNotice(q) {
 if(q.price!=null||!q.finish||q.i<0)return '';
 const messages={loading:'Checking this printing, finish, language and condition…',unpriced:'No current quote matches this condition and version.',available:'No current quote matches this condition and version.',unmapped:'This exact version could not be matched to a price product.',unavailable:'The price service could not complete this lookup.',deferred:q.priceReason==='offline'?'Reconnect to check this condition.':'This price lookup is waiting for another attempt.',not_configured:'Condition pricing is not connected on this deployment.',rate_limited:'The price service paused this lookup.'};
 const notice=q.priceNotice||messages[q.priceStatus]||'';
 const retry=['unavailable','deferred','rate_limited','unpriced','unmapped','available'].includes(q.priceStatus);
 const {timing,retryLabel}=conditionRetryFeedback({reason:q.priceReason,nextRetryAt:q.priceNextRetryAt,retryAfterMs:q.priceRetryAfterMs});
 return notice?`<p class="foot scan-price-notice" role="status">${esc(notice+timing)}</p>${retry?`<button class="link small" data-act="scanRetryConditionPrice">${esc(retryLabel)}</button>`:''}`:'';
}

export function scanConfirmation(g, st, prefs) {
  const q=st.confirm;if(!q)return "";
  const c=st.cands?.[q.i??0],isBatch=!!q.batchId,options=st.cands||[],chosen=q.i>=0;
  const observations=st.supplement?`<details class="scan-review-more"><summary>Compare original and clearer frame</summary><figure><img class="scan-confirm-art" src="${esc(st.supplement.original)}" alt="First accepted original" width="96" height="134"><figcaption>First accepted original</figcaption></figure><figure><img class="scan-confirm-art" src="${esc(st.supplement.clearer)}" alt="Clearer supplemental frame" width="96" height="134"><figcaption>Clearer frame · review only</figcaption></figure></details>`:'';
  const correction=scannerLookupHTML({...q,game:g},{busy:st.lookup,photo:!!st.shot});
  const close=`<button class="icon" data-act="scanDismiss" aria-label="Keep for later and continue scanning" ${q.saving?'disabled':''}>✕</button>`;
  if(!options.length)return `<section class="scan-confirm scan-batch-review" role="region" aria-label="Review captured card"><header><b>Find your card</b>${close}</header>${reviewCapturePile(st)}${scannerCandidateCarousel(st)}${observations}${correction}${q.error?`<p class="scan-confirm-error" role="alert">${esc(q.error)}</p>`:''}<div class="scan-confirm-actions"><button class="btn ghost" data-act="scanDismiss">Keep scanning</button><button class="btn" data-act="scanRetry">Scan again</button></div>${isBatch?`<button class="link small" data-act="scanBatchDiscard">Remove this capture</button>`:''}</section>`;
  const candidate=c||options[0],fs=finishesFor(g,candidate),image=candidate.card?artworkHTML(candidate.card,"scan-confirm-art",true):candidate.image?`<img class="scan-confirm-art" src="${esc(candidate.image)}" alt="${esc(candidate.name)}">`:'';
  return `<section class="scan-confirm scan-batch-review" role="region" aria-label="Confirm scanned card" aria-busy="${!!q.saving}"><header><b>${GAME_LABEL[g]} · ${chosen?'Check finish':'Check printing'}</b>${close}</header>${reviewCapturePile(st)}
  ${q.inline?scannerBrowseHTML(q.inline):scannerCandidateCarousel(st)}
  ${observations}${correction}${q.inline?scannerBrowseFilters(q.inline):`<button class="link small" data-act="scanChangePrinting" ${q.saving||q.pickerOpening||!chosen?'disabled':''}>${q.pickerOpening?'Loading printings…':'Browse set, number and rarity'}</button>`}
  <div class="scan-confirm-controls">${q.inline&&(!chosen||q.finish&&!candidate.finishUnconfirmed)?`<span class="scan-selected-finish">${chosen?'Selected finish':'Choose the printing above'}${chosen?`<b>${esc(finishLabel(g,candidate,q.finish))}</b>`:''}</span>`:`<label>Finish / edition<select data-change="scanConfirmFinish" aria-label="Scanned card finish" ${q.saving||!chosen?'disabled':''}><option value="" ${!q.finish?'selected':''}>Choose finish</option>${fs.map(f=>`<option value="${esc(f)}" ${q.finish===f?'selected':''}>${esc(finishLabel(g,candidate,f))}</option>`).join('')}</select></label>`}<span class="ss-qty"><button data-act="scanConfirmQty" data-d="-1" aria-label="Fewer copies" ${q.saving||q.qty<=1?'disabled':''}>−</button><output aria-label="Copies to save">${q.qty}</output><button data-act="scanConfirmQty" data-d="1" aria-label="More copies" ${q.saving?'disabled':''}>＋</button></span></div>
  ${g==='ptcg'&&!fs.length?'<p class="scan-confirm-error">Exact finish unavailable for this source version. Choose another verified printing before adding.</p>':''}
  <details class="scan-review-more" ${q.detailsOpen?'open':''}><summary>${esc(label(CONDITIONS,q.condition))} · ${esc(label(LANGS,q.lang))} · ${q.price==null?(q.priceStatus==='deferred'?'Price lookup deferred':'Price unavailable'):'Estimated price '+money(q.price)}</summary><div class="scan-confirm-conditions" role="group" aria-label="Card condition">${CONDITIONS.map(([v,l])=>`<button data-act="scanConfirmCondition" data-condition="${esc(v)}" aria-label="${esc(v)}" aria-pressed="${q.condition===v}">${l}</button>`).join('')}</div><label>Language<select data-change="scanConfirmLanguage" aria-label="Scanned card language">${LANGS.map(([v,l])=>`<option value="${esc(v)}" ${q.lang===v?'selected':''}>${esc(LANG_NAME[v]||l)}</option>`).join('')}</select></label></details>
  <div class="scan-condition-value" role="status"><span>${esc(q.condition)} · ${q.qty} ${q.qty===1?'copy':'copies'}</span><strong>${!chosen||!q.finish?'Choose printing and finish':q.price==null?(q.priceStatus==='deferred'?'Price lookup deferred':'Condition price unavailable'):money(q.price*q.qty)+' estimated value'}</strong></div>
  ${scanConditionNotice(q)}${q.error?`<p class="scan-confirm-error" role="alert">${esc(q.error)}</p>`:''}<div class="scan-confirm-actions"><button class="btn ghost" data-act="scanRetry" ${q.saving?'disabled':''}>Scan again</button><button class="btn" data-act="scanConfirm" ${q.saving||q.aiBusy||st.lookup||!chosen||!q.finish?'disabled':''}>${q.saving?'Saving…':'Add to collection'}</button></div>${isBatch?`<button class="link small" data-act="scanBatchDiscard">Remove this capture</button>`:''}</section>`;
}

export function registerScanner(ctx) {
  const { A, C, render, toast, game, match, add, details } = ctx,
    s = () => S.ui.scan;
  const prefs = () => loadPrefs(game());
  const drawReview=()=>{
    const root=globalThis.document?.querySelector?.('.scan-confirm'),scroll=root?.scrollTop||0,id=root?.contains?.(document.activeElement)?document.activeElement.id:'';
    render();const next=globalThis.document?.querySelector?.('.scan-confirm');if(next)next.scrollTop=scroll;
    if(id)document.getElementById(id)?.focus?.({preventScroll:true});
  };
  // Every async screen callback belongs to one visit, not merely one game name.
  // A → B → A must not make an old A callback current again.
  let lifecycleGeneration = 0, suspended = false, switchSource = null;
  const photoDrafts = new Map(); // At most one owned object URL per supported game.
  const scanCurrent = () => {
    const generation=lifecycleGeneration,st=s(),G=game();
    return () => !suspended&&generation===lifecycleGeneration&&s()===st&&game()===G&&S.ui.view==='scan';
  };
  const photoDraft = st => ({mode:st.mode||'live',url:st.url||null,rot:st.rot||0,crop:st.crop&&typeof st.crop==='object'?{...st.crop}:null,auto:st.auto!==false,...(st.confirm&&!st.confirm.batchId?{confirm:{...st.confirm,pickerOpening:false,detailStartedFor:null,priceRequest:null,pickerRequest:null,inline:null,inlineStarted:false,candidateRail:null,aiBusy:false,aiRequest:null},cands:st.cands,read:st.read,shot:st.shot,status:st.status}:{})});
  const idleScan = draft => ({mode:'live',url:null,rot:0,crop:null,auto:true,cands:[],confirm:null,read:null,busy:false,status:'',camOn:false,photoLoading:false,...draft});
  const priceFor=(G,c,finish,selection={})=>ctx.priceOf(G,c,finish,{condition:selection.condition||'Near Mint',language:String(selection.lang||selection.language||'en').toLowerCase().replace('_','-')});
  const refreshReviewPrice=()=>{const q=s().confirm,c=s().cands?.[q?.i??0];if(q)q.price=c&&q.finish?priceFor(q.game||game(),c,q.finish,q):null;};
  // Only explicit review actions request a quote. Camera frames, OCR and ordinary
  // renders remain cache-only. A replacement capture or changed selection retires
  // this callback without reopening a review or touching the next card.
  const requestReviewPrice=({retry=false}={})=>{
    const st=s(),q=st.confirm,c=st.cands?.[q?.i??0];
    if(!q||q.saving||q.i<0||!c||!q.finish||typeof ctx.requestConditionPrice!=='function')return;
    q.priceReviewRequested=true;
    const G=q.game||game(),sheet=S.ui.sheetCtx,token=Symbol('condition-review'),visitCurrent=scanCurrent();
    const identity=()=>JSON.stringify([q.batchId||'',q.captureRevision||'',q.i,q.game||game(),c.id,c.card?.id,c.print||'',c.setReleaseId||'',!!c.setReleaseUnverified,q.finish,q.condition,q.lang]);
    const selected=identity(),captureId=String(q.batchId||''),revision=String(q.captureRevision||'');
    const current=()=>visitCurrent()&&st.confirm===q&&q.priceRequest===token&&st.cands?.[q.i]===c&&
      S.ui.view==='scan'&&S.ui.sheetCtx===sheet&&!q.saving&&(!q.pickerOpening||ctx.inlinePrinting)&&identity()===selected&&
      (!captureId||loadBatch().some(row=>row.id===captureId&&String(row.captureRevision||'')===revision));
    q.priceRequest=token;
    const selection={condition:q.condition||'Near Mint',language:String(q.lang||'en').toLowerCase().replace('_','-')};
    const apply=result=>{
      if(!result||!current())return;
      const price=priceFor(G,c,q.finish,q),status=result.status,reason=result.limitReason||result.reason||'',notice=result.notice||'';
      const changed=q.price!==price||q.priceStatus!==status||q.priceReason!==reason||q.priceNotice!==notice||q.priceNextRetryAt!==result.nextRetryAt;
      Object.assign(q,{price,priceStatus:status,priceReason:reason,priceNotice:notice,priceOwnerVerified:result.ownerVerified,priceNextRetryAt:result.nextRetryAt,priceRetryAfterMs:result.retryAfterMs});if(changed)render();
    };
    Object.assign(q,{priceStatus:'loading',priceReason:'',priceNotice:'',priceNextRetryAt:undefined,priceRetryAfterMs:undefined});render();
    Promise.resolve(ctx.requestConditionPrice(G,c,q.finish,selection,apply,current,{retry})).then(apply).catch(()=>apply({status:'unavailable'}));
  };

  // A reload cannot resume an in-memory OCR promise, but the image is retained for retry.
  const interrupted=loadBatch();
  if(interrupted.some(x=>['captured','reading'].includes(x.status)))saveBatch(interrupted.map(x=>['captured','reading'].includes(x.status)?{...x,status:'unresolved',reason:'Reading interrupted · retry'}:x));
  // Put a candidate on the scan list with the current defaults (finish falls back if the card
  // doesn't come in that finish).
  const makeItem = (c, overrides = {}, G = game()) => {
    const p = { ...loadPrefs(G), ...overrides }, fins = finishesFor(G, c), finish = p.finish;
    if (!finish || !fins.includes(finish)) throw Error("Choose the exact finish / edition before saving.");
    // A picker product belongs to one explicit version, never to a later finish change.
    const selected=c.printingSelection,selectedFinish=G==='ygo'?selected?.edition:G==='ptcg'?selected?.variantKey:selected?.finish;
    const selectionMatches=selected?.game===G&&String(selected.cardId)===String(c.card?.id||c.id)&&selectedFinish===finish&&
      (G!=='ygo'||(String(selected.releaseId||'')===String(c.setReleaseId||'')&&String(selected.printingKey||'')===String(c.print||'').replace('|','::')));
    const productId=c.card?.variants?.find(v=>v.key===finish)?.productId||(selectionMatches?selected.productId:'')||'';
    const item = { ...(overrides.captureId || overrides.batchId ? {captureId: overrides.captureId || overrides.batchId} : {}), id: c.card?.id || c.id, name: c.name, image: c.image || c.card?.image || "", setCode: ctx.setOf(G, c), number: ctx.numberOf(G, c), finish, variantKey: finish, productId, print: c.print || "", condition: p.condition, lang: p.lang, qty: p.qty, price: priceFor(G,c,finish,p), releaseName:c.releaseName||'',setReleaseId:c.setReleaseId||'',setReleaseUnverified:!!c.setReleaseUnverified,printingAmbiguous:!!c.printingAmbiguous,cand: { ...c, id: c.id, name: c.name, image: c.image, sub: c.sub, exact: c.exact, printingConfirmed: overrides.printingConfirmed === true || c.exact === true, print: c.print, card: c.card } };
    return item;
  };
  const toSession = (c, G = game(), present = true) => {
    const p = loadPrefs(G), item = makeItem(c,{},G);
    saveSession(G, addToSession(loadSession(G), item));
    feedback("ok", p);
    if(present&&game()===G&&!suspended){
      s().lastAdded = `+${item.qty} ${c.name}${item.price != null && p.showValue ? ` · $${(item.price * item.qty).toFixed(2)}` : ""}`;
      flash(s().lastAdded);
    }
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
  const suspendCamera = (keepStream = false) => {
    camTicket++;
    scanTicket++;
    s().busy = false;
    s().confirm = null;
    s().supplement = null;
    clearTimeout(loopTimer);
    loopTimer = 0;
    if(!keepStream){
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (videoEl) videoEl.srcObject = null;
    }
    s().camOn = !!stream;s().boundaryReady=false;
    for(const pending of captureBuffer)updateBatch(pending.id,{status:"unresolved",reason:"Reading interrupted · retry"});
    captureBuffer.length=0;s().buffered=0;
    // Keeping the physical feed must not recapture the same held card after
    // Undo. Retain only its accepted-source duplicate latch, never an old frame.
    if(keepStream)observeCaptureLock(captureLock,null,{paused:true});else captureLock=null;
    prevGray=null;steady=0;greenSince=0;loop.quad=null;loop.proposal=null;loop.signature=null;loop.observation=null;loop.bestCapture=null;
  };
  const stopCamera = () => suspendCamera();
  ctx.stopCamera = stopCamera;
  ctx.accountChanged=()=>{
    invalidateAiAuth();
    lifecycleGeneration++;stopCamera();closePop();
    for(const draft of photoDrafts.values())if(draft?.url)URL.revokeObjectURL(draft.url);
    photoDrafts.clear();switchSource=null;suspended=false;
    S.ui.scan=idleScan();
  };

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
  // Capture-local evidence is never stored in shared UI state while reading.
  // A canceled/late result cannot overwrite the next card or a review panel.
  const boundedMatch=async(G,read,lang,progress,prefs,active,budget)=>{
    const control=budget.adapterControl(active);
    try{return await scanDeadline(()=>match(G,{...read},lang,false,progress,prefs,control),Math.min(SCAN_DEADLINES.remote,budget.remaining),'Card lookup',()=>control.cancel());}
    finally{control.cancel();}
  };
  const readFlow = async (card, selectedGame, snapshots, lang, progress, trace, active,budget) => {
    let G=selectedGame,read;
    const cache=new Map();
    const check=()=>{if(!active())throw Error('Reading interrupted · retry');};
    const stage=(name,fn)=>trace.stage(name,async()=>{check();const result=await fn();check();return result;});
    const readLayout=priorFull=>readCard(card,G,lang,progress,{cache,trace,priorFull,budget});
    read=await stage('ocrInitial',()=>readLayout(''));
    let other=detectGame(`${read.name}\n${read.code}\n${read.full}`);
    if(other&&other!==G){G=other;read=await stage('ocrGameCorrection',()=>readLayout(read.full));}
    // Detail bands affect ranking, not the remote adapter query. Reuse remote
    // candidates rather than repeating the same requests after every OCR band.
    const queryKey=()=>scanQueryKey(G,read);
    const hasIdentifier=()=>scanIdentifierEvidence(G,read).observations.length;
    const lookup=async(remote=false)=>{
      const local=await stage('localLookup',()=>scanDeadline(()=>localScanMatch(G,read),SCAN_DEADLINES.local,'Local catalogue',()=>invalidateCatalogRead(G)));
      let result=local,key=queryKey();
      if(local.cands?.length||!budget.latest)budget.checkpoint({...local,g:G,read,cands:rankScanCandidates(G,local.cands||[],read)});
      let prior=null;
      if(budget.cached(key)){try{prior={g:G,...await budget.cached(key)};}catch(e){if(e.code==='SCAN_TIMEOUT'||e.code==='SCAN_BUDGET'||e.code==='SCAN_CANCELED')throw e;}}
      if(!prior&&remote&&!local.cands.some(c=>textVerifiedMatch(G,c,read))){
        try{prior={g:G,...await budget.lookup(key,()=>stage('remoteLookup',()=>boundedMatch(G,read,lang,progress,snapshots[G]||{},active,budget)))};}
        catch(e){if(e.code==='SCAN_TIMEOUT'||e.code==='SCAN_BUDGET'||e.code==='SCAN_CANCELED')throw e;check();}
      }
      if(prior?.g===G)result={...local,cands:uniquePrintings([...local.cands,...prior.cands].sort((a,b)=>Number(!!b.exact)-Number(!!a.exact))),tried:[...(local.tried||[]),...(prior.tried||[])]};
      return budget.checkpoint({...result,g:G,read,cands:rankScanCandidates(G,result.cands||[],read)});
    };
    progress(`Reading ${GAME_LABEL[G]} printing…`);
    // Preserve the fast two-band path when both a name and identifier are read.
    // Otherwise collect useful local evidence before making one remote lookup.
    let r=await lookup(!!hasIdentifier()&&scanLookupNames(G,read).length>0);
    if(!r.cands.some(c=>textVerifiedMatch(G,c,read))){
      const roi=G==='ygo'?[.30,.82,.70,.15]:G==='mtg'?[.02,.37,.96,.59]:[.04,.46,.92,.40];
      read.stats=await stage('ocrDetails',async()=>recog(await getWorker(lang,progress),regionCanvas(card,roi,2),6,budget));
      r=await lookup();
    }
    if(!r.cands.some(c=>textVerifiedMatch(G,c,read))){
      const footer=G==='ygo'?[.35,.66,.65,.31]:[0,.83,1,.17];
      const detail=await stage('ocrFooterRetry',async()=>recog(await getWorker(lang,progress),regionCanvas(card,footer,3),6,budget));
      read.code=joinReads(read.code,detail);
      r=await lookup();
      // Magic footers, and Pokémon full-art footers, are light text on a dark
      // border. When the name is read but no identifier is, read the whole bottom
      // strip inverted: modern Magic prints the number bottom-left, 2003–2014
      // frames bottom-right after the copyright. A number alone still narrows.
      if(G!=='ygo'&&!hasIdentifier()&&scanLookupNames(G,read).length&&!r.cands.some(c=>textVerifiedMatch(G,c,read))){
        const corner=G==='mtg'?[0,.9,1,.09]:[0,.88,1,.12];
        const inverted=await stage('ocrFooterInverted',async()=>recog(await getWorker(lang,progress),regionCanvas(card,corner,4,true),6,budget));
        read.code=joinReads(read.code,inverted);
        r=await lookup();
      }
    }
    if(!r.cands.some(c=>textVerifiedMatch(G,c,read))){
      read.full=read.full||await stage('ocrFull',()=>readFull(card,lang,progress,budget));
      other=detectGame(`${read.name}\n${read.code}\n${read.full}\n${read.stats}`);
      if(other&&other!==G){const full=read.full;G=other;read={...await stage('ocrGameCorrection',()=>readLayout(full)),full};}
      const anchored=fullCardNameHints(G,read.full);
      if(anchored.length){read.titles=[...(read.titles||[]),...anchored.map(text=>({text,source:'full-hint',confidence:null}))];read.name=[...anchored,read.name].join('\n');}
      r=await lookup(true);
    }
    return {...r,g:G,read};
  };
  // Recovery sees the original, not the failed crop. Two independent OCR
  // sources (whole frame and lower detail band) must still pass ordinary name,
  // identifier and conflict gates. Earlier contradictory observations survive.
  const readOriginalEvidence=async(original,prior,entry,progress,trace,active,budget)=>{
    const check=()=>{if(!active())throw Error('Reading interrupted · retry');},lang=entry.ocrLang||'eng';
    check();progress('Checking the original photo…');
    const full=await trace.stage('ocrOriginalFull',()=>readFull(original,lang,progress,budget));check();
    const G=detectGame(full)||prior?.g||entry.game;
    const code=await trace.stage('ocrOriginalFooter',async()=>recog(await getWorker(lang,progress),regionCanvas(original,[0,.40,1,.60],1),11,budget));check();
    const previous=prior?.g===G?prior.read||{}:{},combinedFull=joinReads(previous.full,full),hints=fullCardNameHints(G,combinedFull);
    const read={name:[...hints,previous.name].filter(Boolean).join('\n'),code:joinReads(previous.code,code),full:combinedFull,stats:previous.stats||'',titles:[...(previous.titles||[]),...hints.map(text=>({text,source:anchoredNames(G,full).some(x=>scanNameKey(x)===scanNameKey(text))?'full-anchor':'full-hint',confidence:null}))]};
    // A loose original has no reliable title band. A single top-of-frame hint
    // may support a suggestion; with an independent footer it retains the
    // existing full-frame recovery path, but cannot erase earlier contradictions.
    if(!read.titles.some(t=>(t.source==='title'||t.source==='full-anchor')&&scanLookupNames(G,{...read,name:t.text}).length)&&hints.length===1)read.titles[read.titles.length-1]={...read.titles.at(-1),source:'original-title'};
    let r=await trace.stage('localOriginal',()=>scanDeadline(()=>localScanMatch(G,read),SCAN_DEADLINES.local,'Local catalogue',()=>invalidateCatalogRead(G)));check();
    budget.checkpoint({...r,g:G,read,cands:rankScanCandidates(G,r.cands||[],read)});
    if(!r.cands.some(c=>textVerifiedMatch(G,c,read))&&scanLookupNames(G,read).length){
      try{const remote=await budget.lookup(scanQueryKey(G,read),()=>trace.stage('remoteOriginal',()=>boundedMatch(G,read,lang,progress,entry.defaultsByGame?.[G]||{},active,budget)));r={...r,cands:uniquePrintings([...r.cands,...remote.cands].sort((a,b)=>Number(!!b.exact)-Number(!!a.exact))),tried:[...(r.tried||[]),...(remote.tried||[])]};}
      catch(e){if(e.code==='SCAN_TIMEOUT'||e.code==='SCAN_BUDGET'||e.code==='SCAN_CANCELED')throw e;}
    }
    check();
    if(prior?.g===G)r.cands=uniquePrintings([...r.cands,...(prior.cands||[])].sort((a,b)=>Number(!!b.exact)-Number(!!a.exact)));
    return budget.checkpoint({...r,g:G,read,cands:rankScanCandidates(G,r.cands,read)});
  };
  const probeOrientations=async(packet,prior,entry,progress,trace,active,budget,includeUpright=false)=>{
    const proposal=packet.proposal,lang=entry.ocrLang||'eng';
    if(!proposal?.quad)return prior;
    // This view is a hypothesis only, even for an unsafe art-window outline.
    // Its pixels never replace the original or establish a printing by shape.
    const native=flattenCapture(packet.original,padQuad(proposal.quad,packet.original.width,packet.original.height),proposal),turns=proposal.nativeAspect>1?[1,3]:includeUpright?[0,2]:[2],reads=[];
    for(const turn of turns){
      if(!active())throw Error('Reading interrupted · retry');
      progress('Checking card orientation…');const view=rotateCapture(native,turn),w=await getWorker(lang,progress);
      const name=await trace.stage('ocrOrientationName',()=>recog(w,regionCanvas(view,[.02,.01,.96,.14],2.5),6,budget));
      const G=detectGame(name)||prior.g||entry.game,L=LAYOUT[G];
      let code=await trace.stage('ocrOrientationCode',()=>recog(w,regionCanvas(view,L.code,3),6,budget));
      // Near-edge recovery gets a second sparse footer read at a different
      // scale. Keep both observations so disagreement still requires review.
      if(turn===0)code=joinReads(code,await trace.stage('ocrUprightFooterRetry',()=>recog(w,regionCanvas(view,L.code,2),11,budget)));
      const pass=L.pass?await trace.stage('ocrOrientationPasscode',()=>recog(w,regionCanvas(view,L.pass,3),6,budget)):'';
      reads.push({g:G,name,code:joinReads(code,pass)});
    }
    const plausible=reads.filter(r=>scanLookupNames(r.g,r).length&&(r.g==='ptcg'?ptcgNumbers(r.code).length:r.g==='ygo'?ygoSetCodes(r.code).length:mtgCollector(r.code)));
    if(!plausible.length)return prior;
    const G=plausible[0].g;
    // Different plausible games/orientations are not a license to pick one.
    if(plausible.some(r=>r.g!==G))return {...prior,cands:prior.cands.map(c=>({...c,exact:false}))};
    const old=prior.g===G?prior.read||{}:{},sameGame=reads.filter(r=>r.g===G);
    const read={...old,name:[...fullCardNameHints(G,old.full),...sameGame.map(r=>r.name),old.name].filter(Boolean).join('\n'),code:joinReads(old.code,...sameGame.map(r=>r.code)),titles:[...(old.titles||[]),...sameGame.map(r=>({text:r.name,source:'orientation',confidence:null}))]};
    let r=await trace.stage('localOrientation',()=>scanDeadline(()=>localScanMatch(G,read),SCAN_DEADLINES.local,'Local catalogue',()=>invalidateCatalogRead(G)));
    if(!r.cands.some(c=>textVerifiedMatch(G,c,read))){
      const remote=await budget.lookup(scanQueryKey(G,read),()=>trace.stage('remoteOrientation',()=>boundedMatch(G,read,lang,progress,entry.defaultsByGame?.[G]||{},active,budget)));
      r={...r,cands:uniquePrintings([...r.cands,...remote.cands].sort((a,b)=>Number(!!b.exact)-Number(!!a.exact))),tried:[...(r.tried||[]),...(remote.tried||[])]};
    }
    if(!active())throw Error('Reading interrupted · retry');
    if(prior.g===G)r.cands=uniquePrintings([...r.cands,...prior.cands].sort((a,b)=>Number(!!b.exact)-Number(!!a.exact)));
    return budget.checkpoint({...r,g:G,read,cands:rankScanCandidates(G,r.cands,read)});
  };
  const captureBuffer=[];
  let draining=false;
  const updatePending=(id,patch)=>updateBatch(id,patch);
  const thumbnail=card=>{
    const c=document.createElement('canvas'),k=Math.min(1,240/Math.max(card.width,card.height));
    c.width=Math.max(1,Math.round(card.width*k));c.height=Math.max(1,Math.round(card.height*k));
    c.getContext('2d').drawImage(card,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',.72);
  };
  // Geometry owns whether this proposal covers the physical card. The original
  // remains independent, so a rejected crop or retry never starts from art-only pixels.
  const cardForCapture=packet=>packet.proposal?.quad&&packet.proposal.cropSafe===true?flattenCapture(packet.original,padQuad(packet.proposal.quad,packet.original.width,packet.original.height),packet.proposal):packet.original;
  const process = async (packet, entryId) => {
    const processingAt=clockNow(),st=s(),ticket=++scanTicket,baseTrace=createScanTrace(),budget=packet.budget||createScanBudget(),visitCurrent=scanCurrent();
    budget.begin();budget.beginRevision(packet.refinement===true);budget.latest=null;
    const trace={timings:baseTrace.timings,counts:baseTrace.counts,stage:(name,fn)=>budget.stage(baseTrace,name,fn),finish:()=>({...baseTrace.finish(),budget:budget.counts})};
    const entry=loadBatch().find(x=>x.id===entryId);
    if(!entry||packet.captureRevision!==entry.captureRevision)return;
    const current=()=>visitCurrent()&&ticket===scanTicket&&loadBatch().some(x=>x.id===entryId&&x.captureRevision===entry.captureRevision);
    budget.bindCurrent(current);
    trace.timings.queueWaitMs=Math.max(0,clockNow()-packet.queuedAt);
    trace.timings.captureMs=Math.max(0,packet.captureMs||0);trace.timings.geometryMs=Math.max(0,packet.detectMs||0);trace.timings.frameAnalysisMs=Math.max(0,packet.frameAnalysisMs||0);trace.timings.firstEligibleToAcceptedMs=Math.max(0,packet.firstEligibleToAcceptedMs||0);trace.timings.stableMs=Math.max(0,packet.stableMs||0);trace.timings.persistMs=Math.max(0,packet.persistMs||0);
    st.supplement=null;st.shot=entry.originalShot||entry.shot;st.busy=true;st.lensUrl='';st.cands=[];st.read=null;st.confirm=null;
    updatePending(entry.id,{status:'reading'});render();
    let status='unresolved',recognitionError='';
    try {
      const card=await trace.stage('crop',()=>cardForCapture(packet));
      const snapshots=entry.defaultsByGame||{[entry.game]:{...loadPrefs(entry.game),...entry.defaults}};
      let r;
      const progress=m=>{if(current())setStatus(m);};
      const checkpoint=budget.checkpoint.bind(budget);budget.checkpoint=result=>{if(result.cands?.length&&trace.timings.firstCandidateMs==null)trace.timings.firstCandidateMs=clockNow()-(packet.processingAt||processingAt);return checkpoint(result);};
      try {
        const rawFirst=entry.originalOnly||entry.geometryUncertain||packet.proposal?.cropSafe===false;
        r=rawFirst?await readOriginalEvidence(packet.original,null,entry,progress,trace,current,budget):await readFlow(card,entry.game,snapshots,entry.ocrLang||'eng',progress,trace,current,budget);
        if(!r.cands.some(c=>textVerifiedMatch(r.g,c,r.read))&&packet.proposal?.quad&&!rawFirst)r=await readOriginalEvidence(packet.original,r,entry,progress,trace,current,budget);
        // A near-edge card can fail conservative auto geometry while still giving
        // a useful deskew hypothesis. Probe its upright title/footer after the
        // untouched original, without promoting the crop to safe/auto-ready.
        if(!r.cands.some(c=>textVerifiedMatch(r.g,c,r.read))&&(rawFirst||packet.proposal?.orientation?.status==='unverified'))r=await probeOrientations(packet,r,entry,progress,trace,current,budget,rawFirst);
      }
      catch(e){recognitionError=e.message||'Reading failed. Capture saved for retry.';r=budget.latest||r||{g:entry.game,read:{},cands:[],tried:[]};r={...r,cands:r.cands.map(c=>({...c,exact:false}))};}
      if(!current())return;
      const G=r.g||entry.game;
      if(entry.initialEvidence){entry.refinementEvidence={game:G,read:r.read||{},cands:r.cands||[]};updatePending(entry.id,{refinementEvidence:entry.refinementEvidence});r=supplementScanEvidence(entry.initialEvidence,{...r,g:G});}
      const read=r.read||{};
      const scanPrefs=snapshots[G]||entry.defaults||{};
      if(!r.cands.some(c=>textVerifiedMatch(G,c,read))&&!recognitionError){
        const local=await trace.stage('artwork',()=>scanDeadline(()=>localArtwork(card,G),SCAN_DEADLINES.artwork,'Artwork lookup')).catch(()=>null);
        if(local)r=recoverScanCandidates(G,r,local,read);
      }
      if(!current())return;
      r.cands=uniquePrintings(rankScanCandidates(G,r.cands,read)).map(c=>textVerifiedMatch(G,c,read)?c:{...c,exact:false});
      if(r.cands.filter(c=>c.exact).length>1)r.cands=r.cands.map(c=>({...c,exact:false}));
      const hydrationControl=budget.adapterControl(current);
      const detailed=budget.expired||budget.remaining<=0?r.cands.slice(0,3).map(c=>({status:'fulfilled',value:{...c,exact:false}})):await trace.stage('hydration',()=>settleLimited(r.cands.slice(0,3),c=>{hydrationControl.check();return c.localReference?scanDeadline(()=>hydrateCandidate(G,c,{identityOnly:true,control:hydrationControl}),SCAN_DEADLINES.hydration,'Card details',()=>hydrationControl.cancel()):c;},2)).catch(e=>{recognitionError=e.message;return r.cands.slice(0,3).map(c=>({status:'fulfilled',value:{...c,exact:false}}));});
      hydrationControl.cancel();
      r.cands=rankScanCandidates(G,detailed.map((x,i)=>x.status==='fulfilled'?x.value:{...r.cands[i],exact:false}).filter(Boolean),read);
      if(!current())return;
      const resolved=resolvedEntry(entry,G,r.cands,read,c=>textVerifiedMatch(G,c,read),scanPrefs);
      if(entry.initialEvidence){resolved.status=resolved.cands.length?'review':'unresolved';resolved.reason='Clearer frame added · compare with original';resolved.printingVerified=false;resolved.finish='';}
      if(resolved.cands.some(c=>c.identityConflict)){resolved.reason='Check card identity and printing';resolved.printingVerified=false;resolved.finish='';resolved.status='review';}
      if((entry.geometryUncertain||recognitionError)&&resolved.status==='ready'){resolved.status='review';resolved.reason='Check the whole captured card';}
      status=resolved.status;updatePending(entry.id,{...resolved,error:recognitionError});
      if(captureLock?.id===entry.id&&captureLock.revision===entry.captureRevision){captureLock.status=status;captureLock.settledAt=Date.now();}
      st.tried=r.tried||[];
      st.status=resolved.status==='ready'?`${resolved.cands[0].name} · ${GAME_LABEL[G]} printing ready.`:resolved.status==='review'?`${resolved.cands[0].name} captured. Check ${resolved.cands.some(c=>c.identityConflict)?'card identity':resolved.printingVerified?'finish':'printing'} later.`:'Capture saved. Keep scanning; retry this card later.';
      lockMsg='Queued. Next card';
    }catch(e){if(current()){recognitionError=String(e.message||e);updatePending(entry.id,{status:'unresolved',reason:'Retry this capture',error:recognitionError});if(captureLock?.id===entry.id&&captureLock.revision===entry.captureRevision){captureLock.status='unresolved';captureLock.settledAt=Date.now();}st.status='Capture saved for retry. Keep scanning.';}}
    finally {
      const measured=trace.finish();
      if(current()){
        updatePending(entry.id,measured);st.recognitionMs=measured.timings.totalMs;
        // Bounded, local, numeric diagnostic summaries only. No images, names,
        // OCR text, preference values or network telemetry are recorded here.
        (st.diagnostics ||= []).push({status,...measured});st.diagnostics.splice(0,Math.max(0,st.diagnostics.length-64));
        st.busy=false;render();
      }else {if(loadBatch().some(x=>x.id===entry.id&&x.captureRevision===entry.captureRevision&&x.status==='reading'))updatePending(entry.id,{status:'unresolved',reason:'Reading interrupted · retry',...measured});if(visitCurrent()&&ticket===scanTicket){st.busy=false;render();}}
    }
  };
  const drainCaptures=async()=>{
    if(suspended||draining||s().busy||s().confirm||s().batchSaving)return;
    const generation=lifecycleGeneration;
    draining=true;
    try{while(generation===lifecycleGeneration&&!suspended&&captureBuffer.length&&S.ui.view==='scan'&&!s().confirm&&!s().batchSaving){
      const next=captureBuffer.shift();s().buffered=captureBuffer.length;
      await process(next,next.id);
      if(generation!==lifecycleGeneration||suspended)break;
      if(s().reviewRequested){const id=s().reviewRequested;s().reviewRequested='';openBatchReview(id);break;}
    }}finally{
      draining=false;
      if(generation===lifecycleGeneration&&!suspended)s().buffered=captureBuffer.length;
      // A new visit may already have accepted another capture while the retired
      // reader was settling. Drain it only after that reader has released its turn.
      if(generation!==lifecycleGeneration&&!suspended)void drainCaptures();
    }
  };
  const rejectCapture=message=>{observeCaptureLock(captureLock,null,{paused:true});s().capturePause=message;s().capturePauseRows=loadBatch().length;s().capturePauseSignature=/too large/i.test(message)&&loop.observation?.original?sourceLockSignature(loop.observation.original):null;setStatus(message);return false;};
  const enqueueCapture=(source,replaceId='',capture={})=>{
    if(suspended)return false;
    if(captureBuffer.length>=CAPTURE_BUFFER_LIMIT&&!captureBuffer.some(x=>x.id===replaceId))return rejectCapture('Reading queue full. Hold this card a moment.');
    const before=loadBatch(),prior=replaceId&&before.find(x=>x.id===replaceId);
    if(capture.refinement&&(!prior||!canRefineCapture(captureLock,prior,capture,{paused:!!(s().confirm||s().reviewRequested||s().batchSaving),sourceSignature:sourceLockSignature(source.original,captureLock?.region)})))return false;
    if(!prior&&before.length>=BATCH_LIMIT)return rejectCapture('Batch full. Save or review some cards to continue.');
    if(s().storageBlockedAt!=null&&before.length>=s().storageBlockedAt&&Date.now()<(s().storageBlockedUntil||0))return rejectCapture('Storage full. This card is not queued. Save or review the current batch first.');
    const started=clockNow(),packet=source.original?freezeCapture(source.original,source.proposal):freezeCapture(source),G=prior?.game||capture.selectedGame||game(),snapshots=prior?.defaultsByGame||capture.defaultsByGame||capturePrefs(),p=snapshots[G]||prefs();
    // Serialize the original once at a fixed readable resolution and quality.
    // We never progressively shrink a card until it happens to fit storage.
    const originalShot=capture.originalShot||packet.original.toDataURL('image/jpeg',.86);
    if(capture.refinement&&originalShot===prior.originalShot){captureLock.refinementIdentical=true;return false;}
    const budget=capture.refinement?captureLock.budget:createScanBudget();
    const entry=captureEntry(G,thumbnail(packet.original),p,{originalShot:capture.refinement?prior.originalShot:originalShot,...(capture.refinement?{refinementShot:originalShot,initialEvidence:{game:prior.game,read:prior.read||{},cands:prior.cands||[],proposal:prior.proposal},refinementEvidence:{game:prior.game,read:{},cands:[]},shot:prior.shot}:{}),proposal:packet.proposal?JSON.parse(JSON.stringify(packet.proposal)):null,defaultsByGame:JSON.parse(JSON.stringify(snapshots)),ocrLang:prior?.ocrLang||capture.ocrLang||scanLang(),capturedAt:capture.at||Date.now(),geometryUncertain:capture.geometryUncertain===true,originalOnly:capture.originalOnly===true,captureRevision:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,captureIntent:capture.automatic?'automatic':'manual',refinementCount:capture.refinement?(prior.refinementCount||0)+1:0});
    if(prior)Object.assign(entry,{id:prior.id,qty:prior.qty,condition:prior.condition,lang:prior.lang,location:prior.location});
    const next=prior?before.map(x=>x.id===replaceId?entry:x):[...before,entry],capacity=captureCapacity(next,originalShot);
    if(!capacity.ok)return rejectCapture(capacity.reason);
    const persistStarted=clockNow();
    if(!saveBatch(next)){
      saveBatch(before);s().storageBlockedAt=before.length;s().storageBlockedUntil=Date.now()+2000;
      rejectCapture('Storage full. This card is not queued. Your earlier captures are unchanged.');render();return false;
    }
    s().storageBlockedAt=null;s().capturePause='';s().lastCard=packet.original;
    for(let i=captureBuffer.length-1;i>=0;i--)if(captureBuffer[i].id===entry.id)captureBuffer.splice(i,1);
    enqueueCapture.lastAccepted={id:entry.id,revision:entry.captureRevision,budget};
    captureBuffer.push({...packet,budget,refinement:capture.refinement===true,id:entry.id,captureRevision:entry.captureRevision,queuedAt:clockNow(),captureMs:clockNow()-started+(capture.captureMs||0),detectMs:capture.detectMs,frameAnalysisMs:capture.frameAnalysisMs,firstEligibleToAcceptedMs:capture.firstEligibleAt?Date.now()-capture.firstEligibleAt:0,stableMs:capture.stableMs,persistMs:clockNow()-persistStarted});s().buffered=captureBuffer.length;
    if(!capture.refinement)(s().queueAnimationIds ||= []).push(entry.id);
    feedback('ok',prefs());flash(capture.refinement?'Clearer frame · same capture':'Queued · next card');render();void drainCaptures();return true;
  };
  ctx.enqueueCapture=enqueueCapture;

  // Live camera
  const loop = (allowAuto=true) => {
    const v = document.getElementById("scanVideo");
    if (!v || !v.videoWidth || !v.clientWidth || !v.clientHeight) return;
    if (s().confirm) {
      const status=document.getElementById("camStatus");
      if(status) status.textContent="Review the match below. Camera stays live.";
      return;
    }
    if(s().reviewRequested || s().batchSaving)return;
    // Freeze once, then derive detection, quality, signature and crop coordinates
    // from these exact pixels. No subsequent draw from the advancing video.
    const freezeAt=clockNow(),frame=freezeCapture(v).original,frameMs=clockNow()-freezeAt,fw=frame.width,fh=frame.height;
    const detectorStarted=clockNow(),observations=analysisRegions(fw,fh,v.clientWidth,v.clientHeight,SCAN_ANALYSIS_SIZE).map(region=>{
      const c=(loop.canvases ||= {})[region.kind] ||= document.createElement('canvas');
      c.width=region.width;c.height=region.height;const x=c.getContext('2d',{willReadFrequently:true});
      x.drawImage(frame,region.x,region.y,region.w,region.h,0,0,c.width,c.height);
      const pixels=x.getImageData(0,0,c.width,c.height);
      return {region,pixels,proposal:detectCardQuad(pixels.data,c.width,c.height)};
    });
    const found=selectSensorProposal(observations,fw,fh);loop.detectMs=clockNow()-detectorStarted;
    let m={edges:0,sharp:0,glare:0,bright:100,motion:0};
    if(found){
      const next=found.quad,analysis=found.analysis,observed=observations.find(o=>o.region===analysis.region),pixels=observed.pixels,W=observed.region.width,H=observed.region.height;
      const geometryMotion=loop.quad?next.reduce((n,p,i)=>n+Math.hypot(p.x-loop.quad[i].x,p.y-loop.quad[i].y),0)/4/Math.hypot(fw,fh):1;
      loop.geometryMotion=geometryMotion;loop.quad=next;loop.quadAt=Date.now();loop.proposal=found;
      const qualityQuad=found.outputWidth>found.outputHeight?[analysis.quad[3],analysis.quad[0],analysis.quad[1],analysis.quad[2]]:analysis.quad;
      const normalized=warpPixels(pixels.data,W,H,qualityQuad,120,168),quality=normalizedQuality(normalized,120,168);
      m={edges:found.edges??0,sharp:Math.min(quality.nameSharp,quality.codeSharp),nameSharp:quality.nameSharp,codeSharp:quality.codeSharp,bright:quality.bright,glare:Math.max(quality.nameSharp<T.sharp?quality.nameGlare:0,quality.codeSharp<T.sharp?quality.codeGlare:0),motion:Math.max(prevGray?sigDiff(quality.gray,prevGray):0,loop.geometryMotion*300)};prevGray=quality.gray;loop.signature=toGray(warpPixels(pixels.data,W,H,analysis.quad,16,22),16,22);
    }else {loop.quad=null;loop.proposal=null;loop.signature=null;prevGray=null;loop.bestCapture=null;}
    loop.quality=m;
    loop.observation={original:frame,proposal:loop.proposal,frameAnalysisMs:clockNow()-freezeAt,signature:loop.signature&&Float32Array.from(loop.signature),quality:{...m},at:Date.now(),selectedGame:game(),defaultsByGame:capturePrefs(),ocrLang:scanLang(),captureMs:frameMs,detectMs:loop.detectMs,geometryUncertain:!found||found.cropSafe!==true};
    if(!found||m.motion>=T.motion||m.sharp<T.sharp)loop.stableAt=0;else loop.stableAt ||=Date.now();
    if (Array.isArray(window.__scanDebug)) {window.__scanDebug.push({ ...m, vw:v.videoWidth,vh:v.videoHeight,retainedWidth:fw,retainedHeight:fh,previewWidth:v.clientWidth,previewHeight:v.clientHeight,detectorPasses:observations.length,sensorOccupancy:found?.fraction||0,boundaryReason:found?.boundary?.reason||'no-proposal' });window.__scanDebug.splice(0,Math.max(0,window.__scanDebug.length-120));}
    let st = found?.cropSafe===false?{state:'amber',icon:'◎',msg:'Show the whole card on a clear background'}:found?guideState(m, steady):{state:"red",icon:"◎",msg:"Show the whole card, including its name and bottom edge"};
    steady = st.state === "green" || (st.state === "amber" && st.msg === "Hold steady…") ? steady + 1 : 0;
    // After an add, wait for a different card (or the card to leave) before capturing again.
    // One automatic capture per card: wait for a different card (or the card to leave) first.
    const rowCount=batchStorageSummary().count;
    if(rowCount<(s().capturePauseRows||0)||(/too large/i.test(s().capturePause||'')&&sigDiff(s().capturePauseSignature,sourceLockSignature(frame))>9))s().capturePause='';
    const capacityPaused=captureBuffer.length>=CAPTURE_BUFFER_LIMIT||rowCount>=BATCH_LIMIT||!!(s().capturePause&&/storage|too large/i.test(s().capturePause));
    if (captureLock) {
      const signature=sourceLockSignature(frame,captureLock.region);
      if(observeCaptureLock(captureLock,signature,{paused:capacityPaused,missing:m.edges<2,geometrySignature:loop.signature,geometryComparable:captureLock.cropSafe&&found?.cropSafe===true})){captureLock=null;loop.bestCapture=null;steady=0;greenSince=0;}
      else {
        const waiting=captureLock.automatic&&['unresolved','review'].includes(captureLock.status)&&!captureLock.refined&&!captureLock.refinementIdentical&&!captureLock.reviewTouched&&Date.now()-(captureLock.settledAt||0)<=SCAN_LIMITS.refinementWindowMs&&captureLock.budget?.remaining>=2500&&captureLock.budget?.availableOCR>=2;
        const reason=waiting?'Saved. Hold steady with less glare for one clearer frame':captureLock.status==='unresolved'||captureLock.status==='review'?'Saved for review. Use Scan again to retry, or move to the next card':lockMsg;
        st={state:st.state,icon:st.icon,msg:s().busy?'Reading card…':reason};
        if(allowAuto&&s().auto!==false&&!capacityPaused&&waiting&&steady>=T.greenFrames){
          const entry=loadBatch().find(row=>row.id===captureLock.id);
          if(canRefineCapture(captureLock,entry,loop.observation,{sourceSignature:signature})){
            const refinement={...loop.observation,automatic:true,refinement:true};
            if(enqueueCapture(refinement,entry.id,refinement)){captureLock.refined=true;captureLock.revision=enqueueCapture.lastAccepted.revision;captureLock.status='reading';loop.bestCapture=null;st={state:'green',icon:'✓',msg:'Reading a clearer frame · same capture'};}
          }
        }
      }
    }
    loop.observation.frameAnalysisMs=clockNow()-freezeAt;
    if(loop.bestCapture&&(!canReuseCapture(loop.bestCapture,loop.signature,loop.geometryMotion)||m.motion>=T.motion||loop.bestCapture.selectedGame!==loop.observation.selectedGame||loop.bestCapture.ocrLang!==loop.observation.ocrLang||JSON.stringify(loop.bestCapture.defaultsByGame)!==JSON.stringify(loop.observation.defaultsByGame)))loop.bestCapture=null;
    if(found&&found.cropSafe===true&&!captureLock&&m.motion<T.motion&&m.sharp>=T.sharp&&m.glare<=T.glare){
      const qualityScore=m.sharp/(1+m.motion);
      if(!loop.bestCapture||qualityScore>loop.bestCapture.score){
        loop.bestCapture={...loop.observation,score:qualityScore,stableMs:Date.now()-(loop.stableAt||Date.now()),firstEligibleAt:loop.stableAt};
      }
    }
    if(captureBuffer.length>=CAPTURE_BUFFER_LIMIT)st={state:'amber',icon:'…',msg:'Reading queue full. Hold this card a moment.'};
    else if(rowCount>=BATCH_LIMIT)st={state:'amber',icon:'…',msg:'Batch full. Save or review to continue.'};
    else if(s().capturePause&&/storage|too large/i.test(s().capturePause))st={state:'amber',icon:'…',msg:s().capturePause};
    s().guide = st;
    s().boundaryReady=!!found&&found.cropSafe===true; // Internal auto-capture gate; no alignment target is drawn.
    const el = document.getElementById("camStatus");
    if (el && (el.dataset.guideState!==st.state || el.dataset.guideMessage!==st.msg)) {
      el.dataset.guideState=st.state;el.dataset.guideMessage=st.msg;
      el.className = "cam-status " + st.state;
      el.innerHTML = `<i class="cam-dot" aria-hidden="true"></i>${esc(st.msg)}`;
    }
    if (st.state === "green" && !captureLock) {
      greenSince ||= Date.now();
      if (allowAuto && s().auto !== false && captureBuffer.length<CAPTURE_BUFFER_LIMIT && Date.now() - greenSince > 160) capture(true);
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
    if(!loopTimer){
      // No interval backlog: detection is synchronous and each next observation
      // is scheduled only after it finishes, with a minimum UI input/paint gap.
      const tick=()=>{const started=clockNow();loop();if(loopTimer&&stream)loopTimer=setTimeout(tick,Math.max(40,160-(clockNow()-started)));};
      loopTimer=setTimeout(tick,160);
    }
  };
  const capture = (automatic=false) => {
    const v = document.getElementById("scanVideo");
    if (!v?.videoWidth || s().confirm || s().reviewRequested || s().batchSaving) return;
    if(captureBuffer.length>=CAPTURE_BUFFER_LIMIT)return rejectCapture('Reading queue full. Hold this card a moment.');
    if(!automatic)loop(false);
    if(automatic&&(!loop.quad||Date.now()-loop.quadAt>1000))return;
    if(loop.proposal?.cropSafe===true&&(loop.quality?.sharp||0)<T.sharp){setStatus('Keep the name and bottom code readable. Hold steady.');return;}
    const candidate=canReuseCapture(loop.bestCapture,loop.signature,loop.geometryMotion)?loop.bestCapture:loop.observation;
    if(!automatic&&captureLock&&Date.now()-(s().lastCaptureAt||0)<600&&sigDiff(captureLock.signature,sourceLockSignature(candidate.original,captureLock.region))<9)return;
    const nextLock=acceptedCaptureLock(candidate);
    greenSince = 0;
    if(enqueueCapture(candidate,s().retryBatchId||"",{...candidate,automatic})){
      s().retryBatchId="";s().lastCaptureAt=Date.now();
      captureLock={...nextLock,...enqueueCapture.lastAccepted,automatic,quality:{...candidate.quality},status:'captured',refined:false};loop.bestCapture=null;lockMsg="Captured. Next card";
    }
  };
  A.scanStart = async () => {
    if(suspended)return;
    if (!navigator.mediaDevices?.getUserMedia) return toast("This browser can’t open the camera here. Use Photo instead.");
    const ticket=++camTicket,visitCurrent=scanCurrent(),cam=prefs().camera;
    try {
      const got = await navigator.mediaDevices
          .getUserMedia({ video: { ...(cam ? { deviceId: { exact: cam } } : { facingMode: { ideal: "environment" } }), width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
          .catch((e) => (cam&&visitCurrent()&&ticket===camTicket ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }) : Promise.reject(e)));
      // Closed, switched to Photo or left the page while the permission prompt was open: release it.
      if (!visitCurrent() || ticket !== camTicket || s().mode === "photo") return got.getTracks().forEach((t) => t.stop());
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
      if(!visitCurrent()||ticket!==camTicket)return;
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
    if(suspended)return;
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
    const st = s(),current=scanCurrent();
    if (!st.url||suspended) return;
    const url=st.url,img = await loadImage(url).catch(() => null);
    if (!img||!current()||st.url!==url) return;
    const c = document.createElement("canvas");
    c.width = img.naturalHeight;
    c.height = img.naturalWidth;
    const x = c.getContext("2d");
    x.translate(c.width / 2, c.height / 2);
    x.rotate(Math.PI / 2);
    x.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92));
    if(!current()||st.url!==url||!blob)return;
    URL.revokeObjectURL(url);
    st.url = URL.createObjectURL(blob);
    st.rot = ((st.rot||0)+1)%4;
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
    const st = s(),current=scanCurrent();
    if (suspended || !st.url || st.busy || st.confirm || st.photoLoading) return;
    const url=st.url,crop=st.crop&&{...st.crop};st.photoLoading=true;
    try {
    const r = await loadImage(url).catch(() => null);
    if(!current()||st.url!==url)return;
    if (!r) return toast("Couldn’t open that photo.");
    const rw=r.naturalWidth,rh=r.naturalHeight,backgroundBox=crop?null:autoBox(r),cr=crop||backgroundBox;
    let proposal=null;
    if(cr){const scale=Math.min(1,1100/(rw*cr.w),1540/(rh*cr.h));proposal={quad:[{x:cr.x*rw,y:cr.y*rh},{x:(cr.x+cr.w)*rw,y:cr.y*rh},{x:(cr.x+cr.w)*rw,y:(cr.y+cr.h)*rh},{x:cr.x*rw,y:(cr.y+cr.h)*rh}],cropSafe:true,outputWidth:Math.max(1,Math.round(rw*cr.w*scale)),outputHeight:Math.max(1,Math.round(rh*cr.h*scale)),boundary:{status:'supported',source:crop?'manual':'background'},orientation:{status:'unverified',rotation:0}};}
    if(!crop&&!preserveWholeCardPhoto(rw,rh,backgroundBox)){
      const scale=Math.min(320/rw,400/rh),sample=document.createElement('canvas');sample.width=Math.round(rw*scale);sample.height=Math.round(rh*scale);
      const x=sample.getContext('2d',{willReadFrequently:true});x.drawImage(r,0,0,sample.width,sample.height);
      const found=detectCardQuad(x.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height);
      if(found)proposal={...found,quad:found.quad.map(p=>({x:p.x/scale,y:p.y/scale})),alternatives:found.alternatives?.map(p=>({...p,quad:p.quad.map(q=>({x:q.x/scale,y:q.y/scale}))}))};
    }
    const packet=freezeCapture(r,proposal);st.lastCard=packet.original;
    if(enqueueCapture(packet,s().retryBatchId||""))s().retryBatchId="";
    }finally{if(current())st.photoLoading=false;}
  };
  const attachCrop = () => {
    const wrap = document.getElementById("cropWrap"),
      box = document.getElementById("cropBox");
    if (!wrap || !box) return;
    const current=scanCurrent();
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
      if(!current())return;
      start = pt(e);
      wrap.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    wrap.onpointermove = (e) => {
      if (!current()||!start) return;
      const p = pt(e);
      s().crop = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      show();
    };
    wrap.onpointerup = () => {
      if(!current())return;
      start = null;
      const c = s().crop;
      if (c && (c.w < 0.08 || c.h < 0.08)) s().crop = null;
      show();
    };
  };

  if(ctx.I){
    const edit=(field,t)=>{const q=s().confirm;if(q){q[field]=t.value;q.aiRequest=null;q.aiBusy=false;}};
    ctx.I.scanNameDraft=t=>edit('nameDraft',t);
    ctx.I.scanNumberDraft=t=>edit('numberDraft',t);
  }
  // Confirm & add
  A.scanFind = async () => {
    if(suspended || s().busy || s().confirm?.saving || s().lookup)return;
    const q = (document.getElementById(s().confirm ? "scanMatchName" : "scanName")?.value || s().confirm?.nameDraft || "").trim();
    const number=(document.getElementById('scanMatchNumber')?.value||s().confirm?.numberDraft||'').trim();
    if (!q&&!number) return toast("Enter the card name or bottom number.");
    const st=s(),review=st.confirm,G=review?.game||game(),visitCurrent=scanCurrent(),request=Symbol('name-correction');
    const captureId=review?.batchId,revision=review?.captureRevision;
    const current=()=>visitCurrent()&&st.confirm===review&&st.lookupRequest===request&&(!captureId||loadBatch().some(e=>e.id===captureId&&e.captureRevision===revision));
    st.lookup=true;st.lookupRequest=request;if(review){review.nameDraft=q;review.numberDraft=number;review.aiRequest=null;review.aiBusy=false;}else st.read=null;
    setStatus('Looking it up…');
    let r;
    try{r=ctx.lookupCandidates?{cands:await ctx.lookupCandidates(G,{name:q,number},{isCurrent:current}),tried:[q,number]}:await match(G,{name:q,code:number,full:''},review?.lang||scanLang(),true,m=>{if(current())setStatus(m);});}
    catch(e){if(current()){st.lookup=false;if(review)review.error=e.message||'Couldn’t look up this card. Try again.';render();}return;}
    if(!current())return;
    st.lookup=false;
    if(!r.cands.length){if(review)review.error='No matching cards yet. Check the name and bottom number, or try a clearer photo.';render();return;}
    review?.inline?.close();
    st.cands=r.cands.map(c=>({...c,exact:false,printingConfirmed:false,reviewSource:'name-search'}));
    // Keep original OCR and captured pixels for review. A typed name is not OCR evidence.
    const p=loadPrefs(G);
    st.confirm=review||{game:G,qty:p.qty||1,condition:p.condition,lang:p.lang||'en',saving:false};
    Object.assign(st.confirm,{i:0,finish:'',price:null,priceStatus:'',priceRequest:null,pickerRequest:null,error:'',editing:false,unresolved:false,nameDraft:q,numberDraft:number,inline:null,inlineStarted:false});
    if(captureId)updatePending(captureId,{cands:st.cands,selectedIndex:0,finish:'',status:'review',printingVerified:false,printingConfirmed:false,reason:'Name corrected · choose the printing'});
    st.tried = r.tried;
    st.status = r.cands.length ? "Check the picture matches your card, then tap Add." : "No card found with that name.";
    render();
    if(r.cands.length===1)void A.scanChangePrinting();
  };
  const hydration=new Map();
  const hydrateCandidate=(G,c,{identityOnly=false,control=null}={})=>{
    if(!c.localReference&&(!c.detailsOnly||identityOnly))return Promise.resolve(c);
    const key=JSON.stringify([G,c.id,c.print||'',c.setReleaseId||c.releaseName||'',!!c.setReleaseUnverified,identityOnly]);
    if(!hydration.has(key))hydration.set(key,(async()=>{
      for(let attempt=0;attempt<2;attempt++)try{
        control?.check();const abort=new AbortController();const load=()=>ctx.candById?.(G,c.id,c.why,c.exact,{identityOnly,signal:abort.signal,print:c.print||'',releaseName:c.releaseName||'',setReleaseId:c.setReleaseId||'',setReleaseUnverified:!!c.setReleaseUnverified,printingAmbiguous:!!c.printingAmbiguous});
        const full=await scanDeadline(()=>control?control.run(JSON.stringify(['hydration',key]),load):load(),identityOnly?SCAN_DEADLINES.hydration:SCAN_DEADLINES.ocr,'Card details',()=>{abort.abort();control?.cancel();});control?.check();
        if(!full?.card || String(full.card.id)!==String(c.card?.id||c.id) || scanNameKey(full.name)!==scanNameKey(c.name))throw Error("Card details are unavailable. Connect and try again.");
        return {...full,...(c.identitySource?{identitySource:c.identitySource}:{}),...(c.identityConflict?{identityConflict:true}:{}),...(c.identifierConflict?{identifierConflict:true}:{}),...(c.signalConflict?{signalConflict:true}:{}),exact:c.exact===true&&full.exact!==false,print:c.print||full.print,sub:full.sub||c.sub,releaseName:c.releaseName||full.releaseName||'',setReleaseId:Object.hasOwn(full,'setReleaseId')?full.setReleaseId:c.setReleaseId||'',setReleaseUnverified:Object.hasOwn(full,'setReleaseUnverified')?full.setReleaseUnverified:!!c.setReleaseUnverified,printingAmbiguous:!!(c.printingAmbiguous||full.printingAmbiguous),localReference:false};
      }catch(e){if(attempt===1||/^SCAN_/.test(e.code||''))throw e;await new Promise(resolve=>setTimeout(resolve,250));}
    })().finally(()=>hydration.delete(key)));
    return hydration.get(key);
  };
  A.scanCatalogDownload=async()=>{
    const G=game(),current=scanCurrent();
    try{await downloadCatalog(G,()=>{if(current()){render();const control=document.querySelector?.('.scan-catalog-settings .scan-catalog-control');if(control)control.outerHTML=catalogControl(G,s());}});if(current())toast("Recognition pack saved on this device.");}
    catch(e){if(current())toast(e.message);}
  };
  A.scanCatalogRemove=async()=>{const current=scanCurrent();await removeCatalog(game());if(current()){toast("Recognition text pack removed. Your collection is unchanged.");render();}};
  const persistReview=()=>{
    const q=s().confirm;if(!q?.batchId)return;
    updatePending(q.batchId,{qty:q.qty,condition:q.condition,lang:q.lang,finish:q.finish,selectedIndex:q.i,cands:s().cands});
  };
  const resetConfirmation = (message) => {
    s().confirm?.inline?.close();
    Object.assign(s(),{confirm:null,supplement:null,cands:[],read:null,status:message});
    lockMsg=message;greenSince=0;render();void drainCaptures();
  };
  const openBatchReview=(id='')=>{
    const rows=loadBatch(),entry=rows.find(x=>x.id===id)||rows.find(x=>!['ready','reading','captured'].includes(x.status))||rows[0];
    if(!entry)return;
    updatePending(entry.id,{reviewTouched:true});if(captureLock?.id===entry.id)captureLock.reviewTouched=true;
    if(s().busy){s().reviewRequested=entry.id;setStatus('Finishing this read, then opening review.');return;}
    s().confirm?.inline?.close();
    const cands=entry.cands||[],i=initialReviewIndex(entry),c=cands[i],G=entry.game;
    Object.assign(s(),{shot:entry.originalShot||entry.shot,supplement:entry.refinementShot?{original:entry.originalShot,clearer:entry.refinementShot}:null,cands,read:entry.read||{},confirm:{batchId:entry.id,captureRevision:entry.captureRevision||'',game:G,i,qty:entry.qty||1,condition:entry.condition||'Near Mint',lang:entry.lang||'en',finish:entry.finish||'',price:c&&entry.finish?priceFor(G,c,entry.finish,entry):null,saving:false,error:'',unresolved:!cands.length}});
    render();requestReviewPrice();
  };
  A.scanBatchReview=t=>{if(!s().batchSaving&&!s().confirm?.saving)openBatchReview(t?.dataset?.id||'');};
  A.scanConfirmQty=t=>{const q=s().confirm;if(q&&!q.saving){q.qty=Math.min(999,Math.max(1,q.qty+Number(t.dataset.d)));persistReview();render();}};
  A.scanRetryConditionPrice=()=>{const q=s().confirm;if(q&&!q.saving&&q.priceStatus!=='loading')requestReviewPrice({retry:true});};
  A.scanConfirmCondition=t=>{const q=s().confirm;if(q&&!q.saving&&CONDITIONS.some(([v])=>v===t.dataset.condition)){q.condition=t.dataset.condition;q.detailsOpen=true;refreshReviewPrice();persistReview();render();requestReviewPrice();}};
  C.scanConfirmLanguage=t=>{const q=s().confirm;if(q&&!q.saving&&LANGS.some(([v])=>v===t.value)){q.lang=t.value;q.detailsOpen=true;refreshReviewPrice();persistReview();render();requestReviewPrice();}};
  C.scanConfirmFinish=t=>{const q=s().confirm,c=s().cands?.[q?.i??0],G=q?.game||game();if(q&&!q.saving&&c&&finishesFor(G,c).includes(t.value)){q.finish=t.value;q.price=priceFor(G,c,q.finish,q);persistReview();render();requestReviewPrice();}};
  A.scanEditMatch=()=>{const q=s().confirm;if(q&&!q.saving){q.editing=!q.editing;render();}};
  A.scanChoose=t=>{
    const q=s().confirm,i=Number(t.dataset.i),c=s().cands?.[i],G=q?.game||game();
    if(q&&!q.saving&&c){q.inline?.close();q.inline=null;q.inlineStarted=false;c.printingConfirmed=true;q.i=i;q.editing=false;const entry=q.batchId&&loadBatch().find(x=>x.id===q.batchId);q.finish=resolveScanFinish(G,c,entry?.defaultsByGame?.[G]||entry?.defaults||loadPrefs(G),s().read);q.price=q.finish?priceFor(G,c,q.finish,q):null;persistReview();render();requestReviewPrice();if(ctx.inlinePrinting)void A.scanChangePrinting();}
  };
  A.scanChangePrinting=async()=>{
    const st=s(),q=st.confirm,c=st.cands?.[Math.max(0,q?.i??0)],G=q?.game||game();
    if(!q||(!ctx.inlinePrinting&&q.i<0)||!c||q.saving||q.pickerOpening)return;
    if(typeof ctx.openPrintingPicker!=='function'){q.error='Printing choices are unavailable. Try again later.';render();return;}
    const request=Symbol('printing-review'),revision=String(q.captureRevision||''),captureId=String(q.batchId||''),visitCurrent=scanCurrent();
    const isCurrent=()=>visitCurrent()&&st.confirm===q&&q.pickerRequest===request&&
      (!captureId||loadBatch().some(row=>row.id===captureId&&String(row.captureRevision||'')===revision));
    q.inline?.close();q.inline=null;q.inlineStarted=true;q.aiRequest=null;q.aiBusy=false;q.pickerRequest=request;q.pickerOpening=true;render();
    try{
      await ctx.openPrintingPicker({game:G,candidate:c,captureId,captureRevision:revision,parentContext:S.ui.sheetCtx,isCurrent,
        ...(ctx.inlinePrinting?{openInline:async config=>{if(!isCurrent())return;const [code='',rarity='']=String(c.print||'').split('|');q.inline=createScannerBrowse({...config,focus:{cardId:c.id,code,rarity}},{current:()=>isCurrent()&&!q.saving,draw:()=>{if(isCurrent())drawReview();},preview:()=>{q.aiRequest=null;q.aiBusy=false;st.lookupRequest=null;st.lookup=false;q.i=-1;q.finish='';q.price=null;q.priceRequest=null;persistReview();}});await q.inline.load();}}:{}),
        onSelect:result=>{
          if(!isCurrent()||!result?.candidate||result.candidate.game!==G||(!finishesFor(G,result.candidate).includes(result.finish)&&!(result.finish===''&&result.candidate.finishUnconfirmed===true)))return false;
          q.aiRequest=null;q.aiBusy=false;st.lookupRequest=null;st.lookup=false;
          const candidate={...result.candidate,exact:false,printingConfirmed:true,reviewSource:'printing-picker'};
          // This is explicit manual review, not new OCR evidence or an automatic save.
          // Update only printing fields; capture pixels, revision and defaults stay intact.
          st.cands=[candidate];Object.assign(q,{i:0,finish:result.finish,printingConfirmed:true,reviewSource:'printing-picker',pickerOpening:false,error:'',unresolved:false});
          q.price=q.finish?priceFor(G,candidate,q.finish,q):null;
          if(captureId)updatePending(captureId,{cands:st.cands,selectedIndex:0,finish:q.finish,status:'review',printingVerified:false,printingConfirmed:true,reviewSource:'printing-picker',printingSelection:result.selection,reason:'Printing selected by you · review before adding'});
          render();requestReviewPrice();return true;
        },
        onCancel:()=>{if(!isCurrent())return false;q.pickerOpening=false;render();return true;},
      });
    }catch(error){if(isCurrent()){q.error=error?.message||'Could not load printing choices. Try again.';}}
    finally{if(isCurrent()){q.pickerOpening=false;render();}}
  };
  A.scanBrowseChoose=t=>s().confirm?.inline?.choose(t.dataset.key);
  A.scanBrowseStep=t=>s().confirm?.inline?.moveCarousel?.(Number(t.dataset.d));
  A.scanCandidateStep=t=>s().confirm?.candidateRail?.moveCarousel?.(Number(t.dataset.d));
  A.scanBrowseMore=()=>s().confirm?.inline?.load();
  A.scanBrowseRetry=()=>{const b=s().confirm?.inline;if(b){b.loaded=false;b.nextCursor=null;b.visited.clear();return b.load();}};
  A.scanBrowseClear=()=>s().confirm?.inline?.clear();
  C.scanBrowseFilter=t=>s().confirm?.inline?.filter(t.dataset.field,t.value);
  C.scanBrowseVariant=t=>{const q=s().confirm,b=q?.inline;if(!b||q.saving)return;b.versions[t.dataset.group]=t.value;b.selectedKey='';q.i=-1;q.finish='';q.price=null;q.priceRequest=null;persistReview();render();};
  A.scanIdentifyAI=async()=>{
    const st=s(),q=st.confirm;if(!q||q.saving||q.aiBusy||st.lookup||!st.shot)return;
    const visit=scanCurrent(),token=Symbol('photo-identification'),captureId=q.batchId,revision=q.captureRevision;
    const current=()=>visit()&&st.confirm===q&&q.aiRequest===token&&(!captureId||loadBatch().some(e=>e.id===captureId&&e.captureRevision===revision));
    q.aiRequest=token;q.aiBusy=true;q.aiMessage='Let me take a closer look at the name and bottom number…';q.error='';render();
    try{
      let image=st.shot;
      if(!ctx.identifyPhoto){const photo=await loadImage(image);if(!current())return;const scale=Math.min(1,1400/Math.max(photo.naturalWidth,photo.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(photo.naturalWidth*scale);canvas.height=Math.round(photo.naturalHeight*scale);canvas.getContext('2d').drawImage(photo,0,0,canvas.width,canvas.height);image=canvas.toDataURL('image/jpeg',.88);}
      if(!current())return;
      const hints=ctx.identifyPhoto?await ctx.identifyPhoto({game:q.game||game(),image}):await aiFetch('/api/ai/identify-card',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(50000),body:JSON.stringify({game:q.game||game(),image})}).then(async r=>{const result=await r.json();if(!r.ok)throw Error(result.message||'AI photo help is unavailable. Try the name and bottom number.');return result;});
      if(!current())return;
      const G=q.game||game();
      if(hints.game!=='unknown'&&hints.game!==G){q.aiMessage='This looks like a different game. Switch games and try again, or enter the name and bottom number.';return;}
      if(!hints.readable||(!hints.name&&!hints.number)){q.aiMessage=scanHelp;return;}
      q.nameDraft=hints.name||'';q.numberDraft=hints.number||'';q.aiMessage='I found a few clues. Checking them against the card catalogue…';render();
      const candidates=await ctx.lookupCandidates?.(G,{name:hints.name,number:hints.number,strictName:true},{isCurrent:current});
      if(!current())return;
      if(!candidates?.length){q.aiMessage='I could read part of it, but couldn’t match a card yet. Check the name and bottom number below, or try a clearer photo.';return;}
      q.inline?.close();st.cands=candidates.map(c=>({...c,exact:false,printingConfirmed:false,reviewSource:'ai-hint'}));
      Object.assign(q,{i:0,finish:'',price:null,priceRequest:null,priceStatus:'',pickerRequest:null,inline:null,inlineStarted:false,candidateGroup:'0',error:'',unresolved:false,aiMessage:'Here’s what I could match. Check the art, set and number, then choose your finish.'});
      if(captureId)updatePending(captureId,{cands:st.cands,selectedIndex:0,finish:'',status:'review',printingVerified:false,printingConfirmed:false,reason:'AI suggested a catalogue match · check printing'});
    }catch(e){if(current())q.aiMessage=e.name==='TimeoutError'?'That took too long. Try a clearer photo, or enter the name and bottom number.':e.message||scanHelp;}
    finally{if(current()){q.aiBusy=false;render();if(st.cands.length===1&&q.aiMessage.startsWith('Here’s'))void A.scanChangePrinting();}}
  };
  A.scanRetry=async()=>{
    const st=s(),q=st.confirm,current=scanCurrent();if(suspended||st.busy||q?.saving)return;
    const entry=loadBatch().find(x=>x.id===q?.batchId);
    q?.inline?.close();st.confirm=null;st.supplement=null;st.cands=[];st.read=null;st.retryBatchId=entry?.id||'';
    captureLock=null;greenSince=0;steady=0;
    if(st.camOn){st.status='Show this card again, with the name and bottom code clear.';render();return;}
    // A stored capture can be retried after reconnecting, without searching a catalogue.
    if(entry?.originalShot||entry?.shot){
      try{const img=await loadImage(entry.originalShot||entry.shot);if(!current())return;const c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;c.getContext('2d').drawImage(img,0,0);if(enqueueCapture({original:c,proposal:null},entry.id,{...entry,selectedGame:entry.game,originalOnly:true}))st.retryBatchId='';}
      catch{if(current()){st.status='Open the camera or upload a clearer photo to retry this capture.';render();}}
    }else {st.status='Open the camera or choose a clearer photo.';render();}
  };
  A.scanDismiss=()=>{if(!s().confirm?.saving){persistReview();resetConfirmation('Kept for later. Move to the next card.');}};
  A.scanBatchDiscard=()=>{const q=s().confirm;if(q?.batchId&&!q.saving){removeBatch(q.batchId);resetConfirmation('Capture removed. Move to the next card.');}};
  A.scanConfirm=async()=>{
    const st=s(),q=st.confirm,c=st.cands?.[q?.i??0],G=q?.game||game();
    if(!q||!c||q.i<0||!q.finish||q.saving||q.aiBusy||st.lookup)return;
    q.saving=true;q.error='';q.errorDetail='';render();
    try{
      const resolved=await hydrateCandidate(G,c);
      if(s()!==st||st.confirm!==q)return;
      const changed=(c.print&&resolved.print!==c.print)||(c.setReleaseId&&resolved.setReleaseId!==c.setReleaseId)||(!c.setReleaseUnverified&&resolved.setReleaseUnverified)||(!c.printingAmbiguous&&resolved.printingAmbiguous)||(c.exact===true&&resolved.exact===false);
      if(changed){
        st.cands[q.i]=resolved;q.saving=false;q.error='Printing details changed. Review the updated release before adding.';q.finish='';q.price=null;
        if(q.batchId)updatePending(q.batchId,{cands:st.cands,status:'review',finish:'',printingVerified:false,reason:'Review updated printing details'});render();return;
      }
      if(!finishesFor(G,resolved).includes(q.finish)){q.finish='';throw Error('This printing has different finishes. Choose its exact finish.');}
      const item=makeItem(resolved,{...q,printingConfirmed:true},G);
      const entry=q.batchId&&loadBatch().find(x=>x.id===q.batchId);
      await ctx.addMany(G,[{...item,location:entry?.location??loadPrefs(G).location??''}]);
      const queueSaved=!q.batchId||removeBatch(q.batchId);
      feedback('ok',loadPrefs(G));
      if(s()===st){flash(`Saved ${item.qty} × ${c.name}`);resetConfirmation(queueSaved?'Saved. Move to the next card.':'Saved to collection. Queue update failed; retrying is safe.');showScanSaved(item);}
    }catch(e){if(s()===st){q.saving=false;q.errorDetail=String(e?.stack||e?.message||e);q.error=e.message==='Choose the exact finish / edition before saving.'?e.message:"Couldn't save this card. Your match is still here; try again.";render();}}
  };
  A.scanBatchSave=async()=>{
    const st=s();if(st.batchSaving||st.confirm?.saving)return;
    // A confident match is not permission to save. Every capture is reviewed.
    const next=loadBatch().find(x=>x.status==='ready'&&x.cands?.length);
    if(next)openBatchReview(next.id);
  };

  ctx.confirmKey = e => {
    if(document.querySelector?.("#sheet[open], .zoom-overlay, .tour"))return;
    if(!s().confirm||e.repeat||!['Enter',' '].includes(e.key)||e.target?.closest?.('button,input,select,textarea,a'))return;
    e.preventDefault();A.scanConfirm();
  };
  if(typeof document!=="undefined")document.addEventListener?.("keydown",e=>{if(S.ui.view==="scan")ctx.confirmKey(e);});
  A.scanAdd = async (t) => {
    const st=s(),c = st.cands?.[Number(t.dataset.i)],
      other = st.foundIn,G=other||game(),sourceGeneration=lifecycleGeneration,switching=other&&other!==game();
    if (!c||suspended) return;
    // A card from another game: switch to that game, then put it on that game's list.
    if (switching) {
      const switched=await A.setGame({ dataset: { game: other } });
      if(switched===false)return;
    }
    // The switch may have replaced scan UI or yielded to a newer navigation.
    // Session ownership is the captured destination, never mutable game().
    const present=game()===G&&!suspended&&S.ui.view==='scan'&&lifecycleGeneration<=sourceGeneration+1;
    toSession(c,G,present);
    if(!present)return;
    if(switching)toast(`Switched to ${GAME_LABEL[G]}.`);
    s().foundIn = "";
    // The same card still sitting in front of the camera won't be captured again.
    if (s().lastCard) {
      captureLock = acceptedCaptureLock({original:s().lastCard});
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
    const current=scanCurrent(),card = s().lastCard;
    if (!card?.toBlob) return toast("Scan or photograph a card first.");
    const tab = window.open("", "_blank");
    try {
      if (tab) tab.document.title = "Google Lens";
    } catch {}
    setStatus("Sending the picture to Google Lens…");
    const blob = await new Promise((ok) => card.toBlob(ok, "image/jpeg", 0.9));
    if(!current()){tab?.close();return;}
    const r = blob ? await fetch("api/lens", { method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" } }).then((x) => x.json()).catch(() => null) : null;
    if(!current()){tab?.close();return;}
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
    if (urls.length) openZoom({ src: urls[0], hi: urls[0], alt: c.name, fallback: urls[1] || "", sources: urls });
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
    const current=scanCurrent(),track = stream?.getVideoTracks()[0];
    if (!track || !s().torchCap || !track.getCapabilities?.().torch) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !s().torch }] });
      if(!current()||stream?.getVideoTracks()[0]!==track)return;
      s().torch = !s().torch;
    } catch {
      if(!current())return;
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
      <p class="small muted">Finish and condition are not detected from the photo. Choose them during review, or set a batch default above.</p><details class="settings-disclosure"><summary>Scanning tips</summary><ul class="guide-list small"><li>Plain, contrasting surface; one card at a time.</li><li>No exact alignment needed. Keep the whole card, name and bottom code readable.</li><li>Tilt slightly or use the flashlight off-axis to kill foil glare.</li><li>Sorting a single set? Lock it for faster, surer matches.</li><li>Swap cards after the capture chime; review the uncertain ones when finished.</li></ul></details>`;
  };
  A.scanSettings = async () => {
    const current=scanCurrent();
    ctx.openSheet(settingsSheet(), { type: "scan-settings" });
    const sheet=S.ui.sheetCtx;
    try {
      const cams = (await navigator.mediaDevices?.enumerateDevices?.() || []).filter((d) => d.kind === "videoinput");
      if (current() && S.ui.sheetCtx===sheet && cams.length && document.querySelector("#sheet[open]")) ctx.openSheet(settingsSheet(cams), { type: "scan-settings" });
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
      if(!opts.length)return;
      it.finish = opts[(opts.indexOf(it.finish) + 1) % opts.length];
      it.variantKey=it.finish;
      it.productId=G==='ptcg'?(it.cand?.card?.variants||[]).find(v=>v.key===it.finish)?.productId||'':'';
      if(it.cand?.printingSelection)it.cand={...it.cand,printingSelection:null};
      it.price = priceFor(G,it.cand,it.finish,it);
      // Merge with an identical row if the change made one.
      const twin = list.find((x) => x !== it && itemKey(x) === itemKey(it));
      if (twin) {
        twin.qty += it.qty;
        it.qty = 0;
      }
    });
  A.sessCommit = async () => {
    const st=s(),G = game(),list = loadSession(G);
    if (suspended||st.sessionSaving||!list.length) return;
    const location = (document.getElementById("sessLoc")?.value || "").trim().slice(0, 100);
    savePrefs(G, { location });
    st.sessionSaving=true;
    try{
      await ctx.addMany(G, list.map((x) => ({ ...x, location })));
      saveSession(G, []);
      toast(`Saved ${sessionCount(list)} card${sessionCount(list) === 1 ? "" : "s"} to your collection${location ? ` · ${location}` : ""}.`);
      render();
    }finally{st.sessionSaving=false;}
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
    const G=game(),current=scanCurrent();
    if (!await ask("Clear the scanned list? Cards already saved to your collection stay there.")||!current()) return;
    saveSession(G, []);
    render();
  };

  // App-owned game transitions suspend before committing settings, then restore
  // after success (target) or failure (source). Neither hook renders or starts a camera.
  ctx.beforeGameChange = (sourceGame=game(),targetGame,{workspace=false,kind=""}={}) => {
    if(sourceGame===targetGame&&!workspace)return true;
    if(!Object.hasOwn(GAME_LABEL,sourceGame)||!Object.hasOwn(GAME_LABEL,targetGame))return false;
    const st=s();
    if(st.batchSaving||st.confirm?.saving||st.sessionSaving){
      toast('Finish saving your scans before switching games.');
      return false;
    }
    if(suspended)return false;
    persistReview();
    const oldDraft=photoDrafts.get(sourceGame);
    if(oldDraft?.url&&oldDraft.url!==st.url)URL.revokeObjectURL(oldDraft.url);
    st.confirm?.inline?.close();
    photoDrafts.set(sourceGame,photoDraft(st));
    // Retain an unsaved manual review too if the settings commit rejects. A
    // successful switch leaves captured reviews in their explicit-game batch.
    // Undo rolls back a saved edit, not the live capture device. Only this
    // explicit same-game action may retain an already-open stream. It still
    // retires every old callback/read; import, recovery, reset and game changes
    // use the full stop even when their saved game happens to match.
    const keepCamera=workspace&&kind==='undo'&&sourceGame===targetGame&&S.ui.view==='scan'&&st.camOn&&!!stream;
    switchSource={game:sourceGame,keepCamera,torch:st.torch,torchCap:st.torchCap,lastCaptureAt:st.lastCaptureAt,review:st.confirm?{...st.confirm,pickerOpening:false,detailStartedFor:null,priceRequest:null,pickerRequest:null,inline:null,inlineStarted:false,candidateRail:null,aiBusy:false,aiRequest:null}:null,cands:st.cands,read:st.read,shot:st.shot,status:st.status};
    lifecycleGeneration++;
    suspended=true;
    closePop();
    suspendCamera(keepCamera);
    const rows=loadBatch();
    if(rows.some(row=>['captured','reading'].includes(row.status)))saveBatch(rows.map(row=>['captured','reading'].includes(row.status)?{...row,status:'unresolved',reason:'Reading interrupted · retry'}:row));
    st.photoLoading=false;st.lookup=false;st.reviewRequested='';
    return true;
  };
  ctx.afterGameChange = targetGame => {
    if(!suspended||!Object.hasOwn(GAME_LABEL,targetGame))return false;
    const keepCamera=switchSource?.keepCamera&&switchSource.game===targetGame&&!!stream;
    // A newer cross-game intent can supersede Undo while its write is pending.
    if(stream&&!keepCamera)stopCamera();
    const draft=photoDrafts.get(targetGame);
    photoDrafts.delete(targetGame); // Active UI now owns this URL; switching never revokes it.
    S.ui.scan=idleScan(draft);
    if(keepCamera)Object.assign(s(),{camOn:true,torch:switchSource.torch,torchCap:switchSource.torchCap,lastCaptureAt:switchSource.lastCaptureAt});
    if(switchSource?.game===targetGame){
      const {review,cands,read,shot,status}=switchSource;
      Object.assign(s(),{confirm:review,cands:cands||[],read:read||null,shot,status:status||''});
    }
    switchSource=null;
    suspended=false;
    return true;
  };

  // Called after every render of the scan screen (the page HTML is rebuilt on render).
  ctx.afterRender = () => {
    if (S.ui.view !== "scan") {
      ctx.closePop?.();
      if (stream) stopCamera();
      return;
    }
    const st=s(),G=game(),current=scanCurrent();
    if(suspended)return;
    if(st.catalogInitGame!==G){
      st.catalogInitGame=G;
      Promise.all([initCatalog(G),catalogManifest().catch(()=>null)]).then(([,m])=>{if(current()){st.catalogMeta=m?.games?.[G];render();}});
    }
    if(!st.ocrWarm){st.ocrWarm=true;getWorker(scanLang(),()=>{}).catch(()=>{});}
    if(st.confirm){
      const q=st.confirm,c=st.cands?.[q.i??0],reviewGame=q.game||G;q.presented=true;
      if(q.inline)q.inline.attach(document.querySelector('.scan-inline-printings'));
      else {
        q.candidateRail?.carouselObserver?.disconnect();
        const rail=q.candidateRail={activeGroup:q.candidateGroup??String(Math.max(0,q.i||0))};
        attachPrintingCarousel(document.querySelector('.scan-candidate-carousel'),rail,{step:n=>rail.moveCarousel?.(n),onChange:i=>{if(current()&&st.confirm===q&&!q.saving){q.candidateGroup=String(i);q.i=-1;q.finish='';q.price=null;q.priceRequest=null;persistReview();render();}}});
        if(ctx.inlinePrinting&&!q.inlineStarted&&!q.pickerOpening&&!q.aiBusy&&st.cands.length&&new Set(st.cands.map(c=>c.name)).size===1){q.inlineStarted=true;queueMicrotask(()=>{if(current()&&st.confirm===q)void A.scanChangePrinting();});}
      }
      if((c?.localReference||c?.detailsOnly) && q.detailStartedFor!==JSON.stringify([c.id,c.print,c.setReleaseId||c.releaseName])){
        q.detailStartedFor=JSON.stringify([c.id,c.print,c.setReleaseId||c.releaseName]);
        hydrateCandidate(reviewGame,c).then(full=>{if(current()&&st.confirm===q&&st.cands[q.i??0]===c){st.cands[q.i??0]=full;const fs=finishesFor(reviewGame,full);if(q.finish&&!fs.includes(q.finish))q.finish="";q.price=q.finish?priceFor(reviewGame,full,q.finish,q):null;render();if(q.priceReviewRequested)requestReviewPrice();}}).catch(()=>{});
      }
    }
    if (s().camOn) attach();
    const arrivals=st.queueAnimationIds?.splice(0)||[];
    if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)arrivals.forEach((id,i)=>{
      const thumb=document.querySelector('.scan-pile-cards')||[...document.querySelectorAll('.scan-batch-thumb')].find(el=>el.dataset.id===id);
      thumb?.animate?.([{opacity:0,transform:'translateY(-18px) scale(1.15)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:280,delay:Math.min(i,3)*40,easing:'cubic-bezier(.2,.8,.2,1)'});
    });
    attachCrop();
  };
}
