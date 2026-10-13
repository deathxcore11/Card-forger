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
