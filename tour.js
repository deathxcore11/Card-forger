// First-run tour: three short cards for someone opening CardStashy for the first time (no cards,
// no decks, never seen it). Skip any time; it never comes back once closed.
const KEY = "cardstashy-tour-v1";
export const tourSeen = () => {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return true;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(KEY, "done");
  } catch {}
};
export const shouldTour = ({ cards = 0, decks = 0, seen = tourSeen() } = {}) => !seen && !cards && !decks;

const svg = (b) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
export const STEPS = [
  {
    art: svg(`<rect x="18" y="10" width="28" height="40" rx="4"/><path d="M10 18v-6a4 4 0 0 1 4-4h6M44 8h6a4 4 0 0 1 4 4v6M54 46v6a4 4 0 0 1-4 4h-6M20 56h-6a4 4 0 0 1-4-4v-6"/><path d="M24 22h16M24 28h10" stroke-opacity=".5"/>`),
    title: "Add your cards",
    text: "Point your camera at a card and it's recognised in a moment, or search any card by name. Magic, Pokémon and Yu-Gi-Oh! all live here.",
  },
  {
    art: svg(`<rect x="10" y="16" width="22" height="32" rx="3" transform="rotate(-10 21 32)"/><rect x="21" y="13" width="22" height="32" rx="3"/><rect x="32" y="16" width="22" height="32" rx="3" transform="rotate(10 43 32)"/><path d="M32 6v4M27 8h10" stroke-opacity=".6"/>`),
    title: "See the decks they make",
    text: "CardStashy shows the decks your cards are closest to, what tournament players run, and exactly what you'd need to finish them.",
  },
  {
    art: svg(`<path d="M10 50h44"/><path d="M14 42l10-10 8 6 14-16 6 5"/><circle cx="46" cy="22" r="3" fill="currentColor"/><path d="M14 14h10M14 20h6" stroke-opacity=".5"/>`),
    title: "Watch what they're worth",
    text: "Prices update daily. Follow your collection's value, see price history, and get an alert when a card you want gets cheaper.",
  },
];

export function openTour({ onDone = () => {}, game = "mtg" } = {}) {
  if (typeof document === "undefined" || document.querySelector(".tour")) return;
  let i = 0;
  const el = document.createElement("div");
  if (typeof el.setAttribute !== "function" || typeof el.addEventListener !== "function") return;
  el.className = "tour";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Welcome to CardStashy");
  el.dataset.game = game;
  document.body.append(el);
  const draw = () => {
    const s = STEPS[i],
      last = i === STEPS.length - 1;
    el.innerHTML = `<div class="tour-card" data-step="${i}">
      <button class="tour-skip" data-tour="skip">Skip</button>
      <div class="tour-art">${s.art}</div>
      <h2>${s.title}</h2><p>${s.text}</p>
      <div class="tour-dots" aria-hidden="true">${STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="tour-actions">${i ? `<button class="btn ghost" data-tour="back">Back</button>` : "<span></span>"}<button class="btn" data-tour="${last ? "done" : "next"}">${last ? "Let's go" : "Next"}</button></div>
    </div>`;
    el.querySelector(`[data-tour="${last ? "done" : "next"}"]`)?.focus();
  };
  const finish = (how) => {
    markSeen();
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 260);
    onDone(how);
  };
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-tour]")?.dataset.tour;
    if (a === "next") (i++, draw());
    else if (a === "back") (i--, draw());
    else if (a === "skip") finish("skip");
    else if (a === "done") finish("done");
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") finish("skip");
  });
  // Swipe between cards.
  let x0 = null;
  el.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (dx < -50 && i < STEPS.length - 1) (i++, draw());
    else if (dx > 50 && i > 0) (i--, draw());
  });
  draw();
}
