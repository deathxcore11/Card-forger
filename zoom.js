// Full-screen card viewer: tap a card image to see it at high resolution and zoom into the text
// or the art. Pinch or double-tap to zoom, drag to pan, swipe down / ✕ / Esc to close.
// Shows the image already on screen at once and swaps in the high-resolution one when it loads.

import {esc} from './ui.js';
import {attachZoomMotion} from './mobile-tilt.js';
const MAX = 6;

// Reuse the picture that actually loaded, not a button's stale first URL.
export function zoomCardOptions(target) {
  const data = target.dataset || {}, image = target.querySelector?.("img[data-art-sources]") || target.querySelector?.("img");
  let sources = [];
  try { const parsed = JSON.parse(image?.dataset?.artSources || "[]"); if (Array.isArray(parsed)) sources = parsed; } catch {}
  const src = image?.complete && image.naturalWidth > 0 && !image.hidden ? image.currentSrc || image.src : data.src;
  let finishModel=null;try{finishModel=JSON.parse(target.closest?.('[data-finish-model]')?.dataset.finishModel||'null');}catch{}
  return { src, sources, finishModel, artCrop:data.artCrop||"", hi:data.hi || (/scryfall\.io/.test(src || "") ? scryfallHi(src) : ""), art:data.art, alt:data.name || "Card", fallback:data.fallback || "", holdCard:{holdCard:"true",id:data.id || "",name:data.name || "",entry:data.entry || ""} };
}
export function zoomSources(values, base) {
  return [...new Set(values.filter(value => typeof value === "string" && value).flatMap(value => {
    try { const url = new URL(value, base); return ["https:", "http:", "blob:"].includes(url.protocol) || /^data:image\//i.test(value) ? [url.href] : []; } catch { return []; }
  }))];
}
export function openZoom({ src, hi, sources = [], alt = "Card", art = "", artHi = "", artCrop = "", fallback = "", holdCard=null, finishModel=null }) {
  const base = document.baseURI;
  const views = [{ id: "card", label: "Effects", sources:zoomSources([src, ...sources, fallback, hi], base), hi:zoomSources([hi], base)[0] }];
  views.push({...views[0],id:"plain",label:"Plain card"});
  if (art) views.push({ id: "art", label: "Art", sources:zoomSources([art, artHi], base), hi:zoomSources([artHi], base)[0] });
  if(!art&&artCrop==="pokemon")views.push({...views[0],id:"art",label:"Art",crop:"pokemon"});
  const dlg = document.createElement("dialog");
  dlg.className = "zoom";
  dlg.setAttribute("aria-label", `${alt} — enlarged`);
  dlg.innerHTML = `<div class="zoom-stage"><div class="zoom-card-surface"><div class="zoom-card-light" data-finish-surface="zoom" data-finish-model="${esc(JSON.stringify(finishModel||{}))}"><img class="zoom-img" alt="${esc(alt)}" draggable="false"></div></div></div>
    <div class="zoom-top"><button class="zoom-btn" data-z="tilt" aria-pressed="true" hidden>Tilt on</button><span class="zoom-res" aria-live="polite"></span><button class="zoom-btn" data-z="close" aria-label="Close">✕</button></div>
    <div class="zoom-bar">${views.length > 1 ? `<div class="zoom-seg" role="tablist">${views.map((v, i) => `<button role="tab" data-z="view" data-i="${i}" aria-selected="${i === 0}">${v.label}</button>`).join("")}</div>` : ""}
      <button class="zoom-btn" data-z="out" aria-label="Zoom out">−</button><button class="zoom-btn" data-z="fit" aria-label="Fit to screen">Fit</button><button class="zoom-btn" data-z="in" aria-label="Zoom in">+</button></div>
    <p class="zoom-hint">Pinch or double-tap to zoom · drag to move · swipe down to close</p>`;
  document.body.append(dlg);
  dlg.showModal();
  document.documentElement.classList.add("zoom-open");

  if(holdCard)Object.assign(dlg.querySelector(".zoom-img").dataset,holdCard);
  const stage = dlg.querySelector(".zoom-stage"),
    im = dlg.querySelector(".zoom-img"),
    surface = dlg.querySelector(".zoom-card-surface"),
    res = dlg.querySelector(".zoom-res");
  const light=dlg.querySelector(".zoom-card-light");
  let s = 1, tx = 0, ty = 0, view = 0, loadId = 0;
  const disposeMotion=attachZoomMotion({dialog:dlg,surface:light,button:dlg.querySelector('[data-z="tilt"]'),active:()=>views[view].id==="card"&&s<=1.02});
  const pts = new Map();
  let pinch = null, pan = null, lastTap = 0, swipe = null;

  const apply = (anim = false) => {
    surface.style.transition = anim ? "transform 0.22s cubic-bezier(.2,.8,.2,1)" : "none";
    surface.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    dlg.classList.toggle("zoomed", s > 1.02);
    if(s>1.02)light.style.removeProperty("transform");
  };
  // Keep the image from being dragged entirely off screen.
  const clamp = () => {
    const r = stage.getBoundingClientRect(),
      w = im.offsetWidth * s,
      h = im.offsetHeight * s,
      mx = Math.max(0, (w - r.width) / 2 + 40),
      my = Math.max(0, (h - r.height) / 2 + 40);
    tx = Math.max(-mx, Math.min(mx, tx));
    ty = Math.max(-my, Math.min(my, ty));
  };
  // Zoom to `ns` keeping the point (px, py) — relative to the stage center — still.
  const zoomAt = (ns, px = 0, py = 0, anim = false) => {
    ns = Math.max(1, Math.min(MAX, ns));
    tx = px - (px - tx) * (ns / s);
    ty = py - (py - ty) * (ns / s);
    s = ns;
    if (s === 1) tx = ty = 0;
    clamp();
    apply(anim);
  };
  const center = (x, y) => {
    const r = stage.getBoundingClientRect();
    return [x - r.left - r.width / 2, y - r.top - r.height / 2];
  };

  const load = (i) => {
    view = i;
    // Art crops have a different coordinate system. Preserve identity without misplacing a mask.
    light.dataset.finishModel=JSON.stringify(i===0?(finishModel||{}):{});
    if(i===0)light.dataset.finishSurface="zoom";else delete light.dataset.finishSurface;
    dlg.dataset.view=views[i].id;
    dlg.classList.toggle("zoom-art-crop",views[i].crop==="pokemon");
    dlg.querySelector(".zoom-hint").textContent=views[i].crop==="pokemon"?"Art crop from the source card image":views[i].id==="plain"?"Original source image · no CardStashy lighting or foil effects":"Pinch or double-tap to zoom · drag to move · swipe down to close";
    dlg.dispatchEvent(new Event("cardstashy-zoom-view"));
    surface.querySelector?.('.finish-overlay')?.remove();
    const v = views[i], current = ++loadId, tried = new Set();
    const active = () => loadId === current && dlg.isConnected;
    const show = url => { tried.add(url); im.hidden = false; im.src = url; };
    const recover = () => {
      if (!active()) return;
      const next = v.sources.find(url => !tried.has(url));
      if (next) show(next);
      else { im.hidden = true; res.textContent = "Artwork unavailable"; }
    };
    s = 1; tx = ty = 0; apply();
    im.onerror = recover;
    im.onload = () => { if (active()) { im.hidden = false; res.textContent = `${im.naturalWidth}×${im.naturalHeight}`; } };
    res.textContent = v.hi && v.hi !== v.sources[0] ? "Loading high resolution…" : "";
    recover();
    if (v.hi && v.hi !== v.sources[0]) {
      const pre = new Image();
      pre.referrerPolicy = "no-referrer";
      pre.onload = () => { if (active() && !tried.has(v.hi)) show(v.hi); };
      pre.onerror = () => { if (active()) { tried.add(v.hi); if (!im.hidden) res.textContent = im.complete && im.naturalWidth ? `${im.naturalWidth}×${im.naturalHeight}` : ""; } };
      pre.src = v.hi;
    }
    for (const b of dlg.querySelectorAll('[data-z="view"]')) b.setAttribute("aria-selected", String(Number(b.dataset.i) === i));
  };
  im.referrerPolicy = "no-referrer";
  load(0);

  const close = () => {
    if (!dlg.isConnected) return;
    loadId++;
    disposeMotion();
    dlg.close();
    dlg.remove();
    document.documentElement.classList.remove("zoom-open");
  };
  dlg.addEventListener("close", close);
  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-z]");
    if (!b) return;
    const z = b.dataset.z;
    if (z === "close") close();
    else if (z === "in") zoomAt(s * 1.6, 0, 0, true);
    else if (z === "out") zoomAt(s / 1.6, 0, 0, true);
    else if (z === "fit") zoomAt(1, 0, 0, true);
    else if (z === "view") load(Number(b.dataset.i));
  });
  dlg.addEventListener("keydown", (e) => {
    if(e.target.matches('[role="tab"]')&&["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();load(e.key==="Home"?0:e.key==="End"?views.length-1:(view+(e.key==="ArrowRight"?1:-1)+views.length)%views.length);dlg.querySelector(`[data-i="${view}"]`).focus();return;}
    if (e.key === "+" || e.key === "=") zoomAt(s * 1.4, 0, 0, true);
    else if (e.key === "-") zoomAt(s / 1.4, 0, 0, true);
    else if (e.key === "0") zoomAt(1, 0, 0, true);
  });
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [px, py] = center(e.clientX, e.clientY);
    zoomAt(s * Math.exp(-e.deltaY * 0.0022), px, py);
  }, { passive: false });

  let downOnBackdrop = false,
    downAt = null;
  stage.addEventListener("pointerdown", (e) => {
    if(e.button!==0)return;
    // Note where the finger landed before capturing (capture retargets later events to the stage).
    downOnBackdrop = e.target === stage;
    downAt = { x: e.clientX, y: e.clientY, t: Date.now() };
    stage.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s, mid: center((a.x + b.x) / 2, (a.y + b.y) / 2), tx, ty };
      pan = swipe = null;
    } else if (pts.size === 1) {
      const now = Date.now();
      // Double tap: zoom into that spot, or back out.
      if (now - lastTap < 300) {
        const [px, py] = center(e.clientX, e.clientY);
        zoomAt(s > 1.05 ? 1 : 2.6, px, py, true);
        lastTap = 0;
        return;
      }
      lastTap = now;
      if (s > 1.02) pan = { x: e.clientX, y: e.clientY, tx, ty };
      else swipe = { y: e.clientY, x: e.clientX };
    }
  });
  stage.addEventListener("pointermove", (e) => {
    if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      const r=surface.getBoundingClientRect();
      if(r.width&&r.height){surface.style.setProperty('--mx',`${Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))}%`);surface.style.setProperty('--my',`${Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100))}%`);}
    }
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y),
        ns = Math.max(1, Math.min(MAX, pinch.s * (d / pinch.d))),
        [mx, my] = center((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Scale around the starting midpoint, then follow the fingers as they move.
      tx = pinch.mid[0] - (pinch.mid[0] - pinch.tx) * (ns / pinch.s) + (mx - pinch.mid[0]);
      ty = pinch.mid[1] - (pinch.mid[1] - pinch.ty) * (ns / pinch.s) + (my - pinch.mid[1]);
      s = ns;
      clamp();
      apply();
    } else if (pan) {
      tx = pan.tx + (e.clientX - pan.x);
      ty = pan.ty + (e.clientY - pan.y);
      clamp();
      apply();
    } else if (swipe) {
      const dy = Math.max(0, e.clientY - swipe.y);
      surface.style.transition = "none";
      surface.style.transform = `translate(0, ${dy}px) scale(${1 - Math.min(0.15, dy / 2000)})`;
      dlg.style.setProperty("--fade", String(Math.max(0.35, 1 - dy / 400)));
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (swipe && pts.size === 0) {
      const dy = e.clientY - swipe.y;
      swipe = null;
      dlg.style.setProperty("--fade", "1");
      if (dy > 110) return close();
      apply(true);
    }
    if (pts.size === 0) pan = null;
    if (s < 1.02 && pts.size === 0) zoomAt(1, 0, 0, true);
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  // A quick tap on the dark area (not the card) closes, like a photo viewer.
  stage.addEventListener("pointerup", (e) => {
    if (!downOnBackdrop || !downAt || s > 1.02) return;
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8 && Date.now() - downAt.t < 350) setTimeout(() => lastTap && Date.now() - lastTap >= 300 && close(), 310);
  });
  return { close, dialog: dlg };
}

// Scryfall image URLs come in sizes; png is the sharpest (745×1040).
export const scryfallHi = (url) => String(url || "").replace(/\/(small|normal|large)\//, "/png/").replace(/\.jpg(\?|$)/, ".png$1");
