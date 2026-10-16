// How the app feels: haptics and motion.
// Haptics: vibration patterns on Android; on iPhone (no web vibration) a hidden system switch is
// toggled, which iOS 18+ answers with its own light tap. Motion: a card flies into Collection when
// added, pages glide in, buttons ripple, toasts spring, totals count up. Everything honours
// "Reduce motion", and haptics can be switched off in Settings.

const KEY = "cardstashy-haptics";
export const hapticsOn = () => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};
export const setHaptics = (on) => {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
};
const reduced = () => !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Patterns (ms). tick: tabs and toggles; tap: buttons that do something; success: saved/added;
// warn: removed/undone; error: something failed.
export const PATTERNS = { tick: 6, tap: 10, success: [14, 50, 22], warn: [28, 40, 28], error: [45, 35, 45, 35, 45] };
let iosSwitch = null;
const iosTap = () => {
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.append(input);
    document.body.append(label);
    iosSwitch = label;
  }
  iosSwitch.click();
};
const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
const isIOS = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
export function haptic(kind = "tap") {
  if (!hapticsOn()) return;
  try {
    if (canVibrate()) navigator.vibrate(PATTERNS[kind] ?? PATTERNS.tap);
    else if (isIOS()) {
      iosTap();
      // A second beat for success/warn while the tap still counts as the user's gesture.
      if (kind === "success" || kind === "warn" || kind === "error") setTimeout(iosTap, 90);
    }
  } catch {}
}

// Which haptic an action deserves, from its name.
export function hapticFor(act = "", el = null) {
  if (/^(closeSheet|sheetBack|sheetHistoryBack|go)$/.test(act) && el?.dataset?.nav === undefined) return "tick";
  if (el?.getAttribute?.("role") === "tab" || el?.closest?.(".view-switch, .seg, .segmented, .tabs, [role=tablist]") || el?.dataset?.nav !== undefined) return "tick";
  if (/(Del|Delete|Remove|Clear|Reset)$/i.test(act) || /^(del|remove|clear)/i.test(act)) return "warn";
  return "tap";
}

/* ---------- motion ---------- */

// A copy of the card picture arcs from where you tapped into the Collection tab, which then pops.
export function flyToCollection(fromEl) {
  const nav = [...document.querySelectorAll('[data-nav="collection"]')].find((n) => n.offsetParent !== null);
  if (!nav) return;
  const pop = () => {
    nav.classList.remove("nav-pop");
    void nav.offsetWidth;
    nav.classList.add("nav-pop");
  };
  const img = fromEl?.closest?.(".sheet, #sheet, .tile, .lot, article, section, .scan-cand2")?.querySelector?.("img.cs-art, .cd-img img, img.card-img, img.sc-img, img") || null;
  if (!img || reduced() || !img.getBoundingClientRect) return pop();
  const a = img.getBoundingClientRect(),
    b = nav.getBoundingClientRect();
  if (!a.width || !b.width) return pop();
  const ghost = img.cloneNode();
  ghost.removeAttribute("loading");
  ghost.className = "fly-card";
  const w = Math.min(a.width, 140),
    h = w * (a.height / a.width || 1.4);
  Object.assign(ghost.style, { left: `${a.left + (a.width - w) / 2}px`, top: `${a.top + (a.height - h) / 2}px`, width: `${w}px`, height: `${h}px` });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2),
    dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost
    .animate(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.15 - 80}px) scale(.62) rotate(-8deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(6deg)`, opacity: 0.2, offset: 1 },
      ],
      { duration: 650, easing: "cubic-bezier(.45,.05,.35,1)" },
    )
    .finished.catch(() => {})
    .finally(() => {
      ghost.remove();
      pop();
    });
}

// Count a number up from 0 (money or plain), once per element.
export function countUp(root = document) {
  if (reduced()) return;
  for (const el of root.querySelectorAll?.("[data-count]:not([data-counted])") || []) {
    el.dataset.counted = "1";
    const target = Number(el.dataset.count),
      money = el.dataset.money === "1",
      dec = el.dataset.count.includes(".") ? 2 : 0,
      fmt = (v) => (money ? "$" : "") + v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (!Number.isFinite(target) || target <= 0) continue;
    const t0 = performance.now(),
      dur = 700;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur),
        e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(target * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

// A soft ripple from the exact spot a button was pressed.
export function ripple(e) {
  const b = e.target.closest?.(".btn, .tool-btn, .chip, .kpi, .mini-row, nav button, .seg button");
  if (!b || reduced()) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty("--rx", `${e.clientX - r.left}px`);
  b.style.setProperty("--ry", `${e.clientY - r.top}px`);
  b.classList.remove("rippling");
  void b.offsetWidth;
  b.classList.add("rippling");
}

/* ---------- gestures (touch) ---------- */
// Swipe a sheet down to close it; swipe a collection row left to remove one copy; pull the
// collection down from the top to refresh prices. Each gesture only presses the button that
// already does that job, so undo and feedback stay the same.
export function attachGestures({ closeSheet }) {
  if (typeof document === "undefined" || !("ontouchstart" in globalThis)) return;
  const sheet = document.getElementById("sheet"),
    body = document.getElementById("sheetBody"),
    content = document.getElementById("content");

  // Sheet: drag down from the title bar, or anywhere when already scrolled to the top.
  let sh = null;
  sheet?.addEventListener("touchstart", (e) => {
    const t = e.touches[0],
      onHead = e.target.closest?.(".sheet-head");
    if (e.touches.length !== 1 || (!onHead && body.scrollTop > 2) || e.target.closest?.("input, textarea, select, .zoom-stage")) return (sh = null);
    sh = { y: t.clientY, x: t.clientX, dy: 0, live: false };
  }, { passive: true });
  sheet?.addEventListener("touchmove", (e) => {
    if (!sh) return;
    const t = e.touches[0],
      dy = t.clientY - sh.y,
      dx = Math.abs(t.clientX - sh.x);
    if (!sh.live && (dy < 8 || dx > dy)) return;
    sh.live = true;
    sh.dy = Math.max(0, dy);
    sheet.style.transition = "none";
    sheet.style.transform = `translateY(${sh.dy * 0.9}px)`;
  }, { passive: true });
  sheet?.addEventListener("touchend", () => {
    if (!sh?.live) return (sh = null);
    const close = sh.dy > 110;
    sheet.style.transition = "transform .24s cubic-bezier(.2,.8,.2,1)";
    sheet.style.transform = close ? "translateY(100%)" : "";
    if (close) {
      haptic("tick");
      setTimeout(() => {
        closeSheet();
        sheet.style.transform = sheet.style.transition = "";
      }, 200);
    } else setTimeout(() => (sheet.style.transition = ""), 260);
    sh = null;
  });

  // Rows and pull-to-refresh on the page.
  let row = null,
    pull = null;
  const ptr = document.createElement("div");
  ptr.className = "ptr";
  ptr.setAttribute("aria-hidden", "true");
  ptr.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/></svg>`;
  document.body.append(ptr);
  content?.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0],
      lot = e.target.closest?.(".lot");
    row = lot && lot.querySelector('[data-delta="-1"]') ? { el: lot, x: t.clientX, y: t.clientY, dx: 0, live: false } : null;
    pull = window.scrollY <= 0 && document.querySelector('[data-act="refreshPrices"], [data-act="tRefreshPrices"]') ? { y: t.clientY, dy: 0 } : null;
  }, { passive: true });
  content?.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (row) {
      const dx = t.clientX - row.x,
        dy = Math.abs(t.clientY - row.y);
      if (!row.live && (Math.abs(dx) < 10 || dy > Math.abs(dx))) {
        if (dy > 12) row = null;
      } else {
        row.live = true;
        pull = null;
        row.dx = Math.min(0, Math.max(-140, dx));
        row.el.classList.add("swiping");
        row.el.style.transform = `translateX(${row.dx}px)`;
        row.el.classList.toggle("swipe-armed", row.dx < -90);
      }
    }
    if (pull) {
      pull.dy = Math.max(0, t.clientY - pull.y);
      if (pull.dy > 6 && window.scrollY <= 0) {
        const k = Math.min(1, pull.dy / 90);
        ptr.style.opacity = String(k);
        ptr.style.transform = `translate(-50%, ${Math.min(70, pull.dy * 0.6)}px) rotate(${pull.dy * 3}deg)`;
        ptr.classList.toggle("armed", k >= 1);
      }
    }
  }, { passive: true });
  content?.addEventListener("touchend", () => {
    if (row?.live) {
      const el = row.el,
        go = row.dx < -90;
      el.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1)";
      el.style.transform = "";
      setTimeout(() => {
        el.style.transition = "";
        el.classList.remove("swiping", "swipe-armed");
      }, 240);
      if (go) el.querySelector('[data-delta="-1"]')?.click();
    }
    row = null;
    if (pull) {
      const go = pull.dy > 90;
      ptr.classList.add("done");
      ptr.style.opacity = "0";
      ptr.style.transform = "translate(-50%, 0)";
      setTimeout(() => ptr.classList.remove("done", "armed"), 300);
      if (go) document.querySelector('[data-act="refreshPrices"], [data-act="tRefreshPrices"]')?.click();
      pull = null;
    }
  });
}

/* ---------- card tilt (TCG Pocket style) ---------- */
// Card art leans toward your finger or cursor, with a holographic shine that follows it.
// Touch: only while pressing (a press that turns into a scroll lets go at once).
const TILT = ".lot-art, .cd-img, .tile-art, .scan-cand2 .sc-img, .quick-card-thumb";
export function attachTilt(root = typeof document === "undefined" ? null : document) {
  if (!root || reduced()) return;
  let el = null;
  const set = (e) => {
    const r = el.getBoundingClientRect(),
      x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--tx", `${(x - 0.5) * 16}deg`);
    el.style.setProperty("--ty", `${(0.5 - y) * 16}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const end = () => {
    if (!el) return;
    el.classList.remove("tilting");
    el.closest(".lot")?.classList.remove("peek");
    el = null;
  };
  root.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = e.target.closest?.(TILT);
    if (t && t !== el && !t.closest(".view-symbols")) {
      end();
      el = t;
      el.classList.add("tilting");
    }
  }, { passive: true });
  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    const t = e.target.closest?.(TILT);
    if (!t || t.closest(".view-symbols")) return;
    end();
    el = t;
    el.classList.add("tilting");
    el.closest(".lot.wanted")?.classList.add("peek");
    set(e);
  }, { passive: true });
  root.addEventListener("pointermove", (e) => {
    if (!el) return;
    if (e.pointerType === "mouse" && !el.contains(e.target)) return end();
    set(e);
  }, { passive: true });
  for (const ev of ["pointerup", "pointercancel"]) root.addEventListener(ev, (e) => e.pointerType !== "mouse" && setTimeout(end, 260), { passive: true });
  root.addEventListener("pointerout", (e) => e.pointerType === "mouse" && el && !el.contains(e.relatedTarget) && end(), { passive: true });
  root.addEventListener("scroll", end, { passive: true, capture: true });
  attachMotionTilt(root, () => el);
}

// Phones have no hover, so the card on a card page answers the phone itself: tilt the phone and
// the card leans and its shine slides, like holding a real foil. It also catches the light once
// when it opens. iOS asks for motion access the first time you touch a card (Apple requires a tap).
export function motionCard(root=document) {
  // An open sheet owns the visible card, even when a card page remains behind it.
  const dialogs=Array.from(root.querySelectorAll('dialog[open]'));
  const scope=dialogs.at(-1)||root.querySelector('#content')||root;
  return Array.from(scope.querySelectorAll('.cd-img')).find(c=>{
    const r=c.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
  })||null;
}
function attachMotionTilt(root, pressed) {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
  // Foldables, tablets and phones with a pen/mouse can report hover support.
  if (!(navigator.maxTouchPoints>0 || matchMedia?.("(any-pointer: coarse)").matches || matchMedia?.("(hover: none)").matches)) return;
  let base = null, frame = 0, last = null, asked = false, listening = false, currentCard=null;
  const hero = () => motionCard(root);
  const apply = () => {
    frame = 0;
    const c = hero();
    if (!c || !last || pressed() === c) return;
    const clamp = (v) => Math.max(-1, Math.min(1, v / 18));
    if(c!==currentCard){currentCard=c;base=null;}
    if (!base) base = { ...last };
    // The entrance sweep must not override the sensor transform with animation fill.
    c.classList.remove("shine-once");
    // The resting angle drifts toward however you hold the phone, so the card settles flat.
    base.b += (last.b - base.b) * 0.02;
    base.g += (last.g - base.g) * 0.02;
    const x = clamp(last.g - base.g), y = clamp(last.b - base.b);
    c.classList.add("tilting", "gyro");
    c.style.setProperty("--tx", `${x * 9}deg`);
    c.style.setProperty("--ty", `${-y * 9}deg`);
    c.style.setProperty("--mx", `${50 + x * 45}%`);
    c.style.setProperty("--my", `${50 + y * 45}%`);
  };
  const onTurn = (e) => {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    last = { b: e.beta, g: e.gamma };
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const listen = () => {
    if (listening) return;
    listening = true;
    addEventListener("deviceorientation", onTurn, { passive: true });
  };
  const needsAsk = typeof DeviceOrientationEvent.requestPermission === "function";
  if (!needsAsk) listen();
  root.addEventListener("click", (e) => {
    if (!needsAsk || asked || !e.target.closest?.(TILT)) return;
    asked = true;
    DeviceOrientationEvent.requestPermission().then((r) => r === "granted" && listen()).catch(() => {});
  }, { capture: true, passive: true });
  // A new card page: forget the old resting angle and sweep the light across once.
  // It plays when the card first comes into view (on a card page it often sits below the art).
  const seen = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((xs) => {
    for (const x of xs) {
      if (!x.isIntersecting) continue;
      seen.unobserve(x.target);
      if(x.target.classList.contains("gyro"))continue;
      x.target.classList.add("shine-once");
      setTimeout(() => x.target.classList.remove("shine-once"), 1300);
    }
  }, { threshold: 0.6 });
  if (seen) {
    const observeCards=()=>{for (const c of root.querySelectorAll(".cd-img:not([data-shone])")) { c.dataset.shone = "1"; seen.observe(c); }};
    observeCards();
    new MutationObserver(observeCards).observe(document.body, { childList: true, subtree: true });
  }
}
