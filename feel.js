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
      dec = money ? 2 : 0,
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
