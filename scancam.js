// Card scanner for all three games:
//   live camera → card in the guide → quality checks → crop → read name & code strips → match → confirm → add
// Text recognition runs on the phone (Tesseract). The guide's colour is about capture quality only:
//   red    = no card edges in the guide (or far too dark)
//   amber  = card found but moving, blurry or glared
//   green  = edges, sharpness, light and stillness all pass for several frames → ready to capture
// Thresholds are starting points tuned on test images; they should be refined with real phone photos.
import { S } from "./store.js";
import { esc } from "./ui.js";
import { nameCandidates } from "./scan.js";

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
  if (m.bright < T.dark) return { state: "red", icon: "◐", msg: "Too dark — find more light" };
  if (m.edges < 3) return { state: "red", icon: "▢", msg: "Move the whole card inside the frame" };
  if (m.motion > T.motion) return { state: "amber", icon: "✋", msg: "Hold steady" };
  if (m.glare > T.glare) return { state: "amber", icon: "☀", msg: "Tilt slightly to reduce glare" };
  if (m.sharp < T.sharp) return { state: "amber", icon: "◎", msg: "Hold steady — the picture is blurry" };
  if (m.edges < 4) return { state: "amber", icon: "▢", msg: "Line all four edges up with the guide" };
  return steady + 1 >= T.greenFrames ? { state: "green", icon: "✓", msg: "Ready to capture" } : { state: "amber", icon: "✋", msg: "Hold steady…" };
}

// Where the guide sits in a video/image of size vw×vh (same rule for the overlay and the crop).
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
// A region of the card, enlarged and high-contrast, for the reader.
function regionCanvas(card, [fx, fy, fw, fh], scale = 2) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(card.width * fw * scale));
  c.height = Math.max(1, Math.round(card.height * fh * scale));
  const ctx = c.getContext("2d");
  ctx.filter = "grayscale(1) contrast(1.6)";
  ctx.drawImage(card, card.width * fx, card.height * fy, card.width * fw, card.height * fh, 0, 0, c.width, c.height);
  return c;
}
// Read the name strip and the code strip separately; the whole card only as a fallback.
export async function readCard(card, g, lang, progress = () => {}) {
  const w = await getWorker(lang, progress),
    L = LAYOUT[g] || LAYOUT.mtg,
    text = async (canvas) => ((await w.recognize(canvas)).data.text || "").trim();
  progress("Reading the name…");
  const name = await text(regionCanvas(card, L.name, 2.5));
  progress("Reading the set code and number…");
  const code = [await text(regionCanvas(card, L.code, 3)), L.pass ? await text(regionCanvas(card, L.pass, 3)) : ""].join("\n");
  let full = "";
  if (!nameCandidates(g, name).length) {
    progress("Reading the whole card…");
    full = await text(regionCanvas(card, [0, 0, 1, 1], 1));
  }
  return { name, code, full };
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

export function scanView(g, gameName) {
  const s = S.ui.scan,
    live = (s.mode || "live") === "live",
    tips = { mtg: "the name at the top and the set code + number at the bottom", ygo: "the name, the set code under the art (like LOB-EN001) and the passcode", ptcg: "the name and the number at the bottom (like 053/128)" }[g];
  const cands = (s.cands || [])
    .map(
      (c, i) => `<article class="scan-cand2 ${c.exact ? "exact" : ""}">${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<div class="sc-body"><b>${esc(c.name)}</b><small>${esc(c.sub || "")}</small><span class="tag ${c.exact ? "ok" : ""}">${esc(c.why)}</span>${c.owned ? `<small class="muted">You own ${c.owned}</small>` : ""}
        <div class="actions wrap"><button class="btn small" data-act="scanAdd" data-i="${i}">＋ Add 1</button><button class="btn ghost small" data-act="scanDetails" data-i="${i}">Details</button></div></div></article>`,
    )
    .join("");
  return `<div class="page-head"><h1>Scan a card</h1></div>
  <div class="seg" role="tablist"><button role="tab" class="${live ? "on" : ""}" aria-selected="${live}" data-act="scanMode" data-id="live">Live camera</button><button role="tab" class="${live ? "" : "on"}" aria-selected="${!live}" data-act="scanMode" data-id="photo">Photo</button></div>
  <section class="panel scan-panel">
    ${
      live
        ? `<div class="cam-wrap" id="camWrap">${s.camOn ? `<div id="camSlot"></div><div class="cam-guide ${esc(s.guide?.state || "red")}" id="camGuide"></div><div class="cam-status ${esc(s.guide?.state || "red")}" id="camStatus" role="status" aria-live="polite"><span aria-hidden="true">${esc(s.guide?.icon || "▢")}</span> ${esc(s.guide?.msg || "Starting camera…")}</div>` : `<div class="scan-drop"><b>Hold one ${esc(gameName)} card inside the frame</b><span class="muted small">On a plain, contrasting surface, all four corners visible, no glare. Keep ${tips} sharp.</span><button class="btn" data-act="scanStart">📷 Start camera</button></div>`}</div>
      ${s.camOn ? `<div class="actions wrap"><button class="btn" id="scanCaptureBtn" data-act="scanCapture">Capture</button><label class="check small"><input type="checkbox" data-change="scanAuto" ${s.auto !== false ? "checked" : ""}> Capture automatically when ready</label><button class="btn ghost small" data-act="scanStop">Stop</button></div>` : ""}`
        : `<div class="actions wrap"><label class="btn">📷 Take photo<input type="file" accept="image/*" capture="environment" data-change="scanFile" hidden></label><label class="btn ghost">Upload<input type="file" accept="image/*" data-change="scanFile" hidden></label></div>
      ${s.url ? `<p class="muted small">Drag a box around the card to crop. Rotate if it’s sideways.</p><div class="crop-wrap" id="cropWrap"><img id="cropImg" src="${s.url}" alt="Your photo"><div class="crop-box" id="cropBox"></div></div>
      <div class="actions wrap"><button class="btn ghost small" data-act="scanRotate">↻ Rotate</button><button class="btn ghost small" data-act="scanCropReset">Whole photo</button><button class="btn" data-act="scanRead" ${s.busy ? "disabled" : ""}>${s.busy ? "Reading…" : "Read card"}</button></div>` : ""}`
    }
    <div class="row between wrap"><label class="small">Card language <select data-change="scanLang">${[["eng", "English"], ["jpn+eng", "Japanese (+ English)"]].map(([v, l]) => `<option value="${v}" ${scanLang() === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>${s.lastAdded ? `<span class="small ok-text">✓ ${esc(s.lastAdded)}</span>` : ""}</div>
    <p class="muted small" id="scanStatus" role="status">${esc(s.status || "")}</p>
  </section>
  ${
    s.cands?.length || (s.read && !s.busy)
      ? `<section class="panel"><h3>${s.cands?.length ? (s.cands[0].exact ? "Found it — check the printing" : "Which card is it?") : "No match yet"}</h3>
      ${cands ? `<div class="scan-cands">${cands}</div>` : `<p class="muted small">Type the name instead, or try again with the card flat and the name sharp.</p>`}
      <div class="searchbar"><input id="scanName" value="${esc(s.guess || "")}" placeholder="Not right? Type the name${g === "ygo" ? " or set code" : ""}" data-enter="scanFind" aria-label="Card name"><button class="btn ghost" data-act="scanFind">Find</button></div>
      <details class="trouble"><summary>Troubleshooting</summary><p class="small muted">Name strip read as: <code>${esc((s.read?.name || "").slice(0, 120)) || "—"}</code><br>Code strip read as: <code>${esc((s.read?.code || "").replace(/\s+/g, " ").slice(0, 120)) || "—"}</code><br>Names tried: ${esc((s.tried || []).join(" · ") || "—")}</p></details></section>`
      : ""
  }
  <p class="foot">Green means a good picture, not a confirmed card — you always confirm before anything is added. Text recognition runs on your phone; only names and codes are looked up online. The first scan downloads the reader (~5 MB${scanLang() !== "eng" ? ", plus Japanese" : ""}).</p>`;
}

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

export function registerScanner(ctx) {
  const { A, C, render, toast, game, match, add, details } = ctx,
    s = () => S.ui.scan;
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

  const process = async (card) => {
    const st = s(),
      G = game();
    st.busy = true;
    st.cands = [];
    render();
    try {
      st.read = await readCard(card, G, scanLang(), setStatus);
      setStatus("Matching…");
      const r = await match(G, st.read, scanLang(), false, setStatus);
      st.cands = r.cands;
      st.tried = r.tried;
      st.guess = r.cands[0]?.name || nameCandidates(G, st.read.name || st.read.full)[0] || "";
      st.status = r.cands.length ? (r.cands[0].exact ? "Found the exact printing — check it and tap Add." : "Check the picture matches your card, then tap Add.") : "Couldn’t match it — type the name below.";
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
    const g = guideRect(v.videoWidth, v.videoHeight),
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
      el.innerHTML = `<span aria-hidden="true">${st.icon}</span> ${esc(st.msg)}`;
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
    const g = guideRect(v.videoWidth, v.videoHeight);
    Object.assign(guide.style, { left: (g.x / v.videoWidth) * 100 + "%", top: (g.y / v.videoHeight) * 100 + "%", width: (g.w / v.videoWidth) * 100 + "%", height: (g.h / v.videoHeight) * 100 + "%" });
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
    const g = guideRect(v.videoWidth, v.videoHeight),
      c = document.createElement("canvas"),
      k = Math.min(1, 900 / g.w);
    c.width = Math.round(g.w * k);
    c.height = Math.round(g.h * k);
    c.getContext("2d").drawImage(v, g.x, g.y, g.w, g.h, 0, 0, c.width, c.height);
    s().lastCard = c;
    greenSince = 0;
    lockSig = sigOf(c);
    lockMsg = "Captured — tap Add below, or swap in the next card";
    process(c);
  };
  A.scanStart = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return toast("This browser can’t open the camera here — use Photo instead.");
    try {
      const ticket = ++camTicket,
        got = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      // Closed, switched to Photo or left the page while the permission prompt was open: release it.
      if (ticket !== camTicket || s().mode === "photo" || S.ui.view !== "scan") return got.getTracks().forEach((t) => t.stop());
      stream = got;
      s().camOn = true;
      s().status = "";
      render();
    } catch (e) {
      s().status = /denied|NotAllowed/i.test(e.name + e.message) ? "Camera permission was declined. Allow it in your browser settings, or use Photo." : "Couldn’t open the camera — use Photo instead.";
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
  A.scanRead = async () => {
    const st = s();
    if (!st.url || st.busy) return;
    const r = await loadImage(st.url).catch(() => null);
    if (!r) return toast("Couldn’t open that photo.");
    // Crop to the box (fractions of the photo as shown).
    const rw = r.naturalWidth,
      rh = r.naturalHeight,
      cr = st.crop || { x: 0, y: 0, w: 1, h: 1 },
      k = Math.min(1, 1100 / (rw * cr.w)),
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
    const c = s().cands?.[Number(t.dataset.i)];
    if (!c) return;
    await add(game(), c);
    s().lastAdded = `Added 1 × ${c.name}`;
    // The same card still sitting in front of the camera won't be captured again.
    if (s().lastCard) {
      lockSig = sigOf(s().lastCard);
      lockMsg = "Added — swap in the next card";
    }
    s().cands = [];
    s().read = null;
    s().status = s().camOn ? "Added. Swap in the next card." : "Added. Take the next photo.";
    render();
  };
  A.scanDetails = (t) => {
    const c = s().cands?.[Number(t.dataset.i)];
    if (c) details(game(), c);
  };

  // Called after every render of the scan screen (the page HTML is rebuilt on render).
  ctx.afterRender = () => {
    if (S.ui.view !== "scan") {
      if (stream) stopCamera();
      return;
    }
    if (s().camOn) attach();
    attachCrop();
  };
}
