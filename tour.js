// First-run tour: five short cards for someone opening CardStashy for the first time (no cards,
// no decks, never seen it), each with a looping mini replay of the app itself: a tap marker moving
// through the real screens. Skip any time; it never comes back on its own once closed, and
// Settings can replay it. Card art comes from the app's own card data.
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

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// A card face: real art when the app has it, otherwise a coloured card.
const card = (art, i, cls = "") => `<span class="tv-card ${cls}" style="--n:${i}">${art ? `<img src="${esc(art)}" alt="" loading="lazy">` : ""}</span>`;
const tap = (cls) => `<i class="tv-tap ${cls}" aria-hidden="true"></i>`;
const phone = (step, body) => `<div class="tv-phone tv-${step}" aria-hidden="true"><div class="tv-notch"></div><div class="tv-screen">${body}</div></div>`;

export const STEPS = [
  {
    key: "scan",
    title: "Add your cards in seconds",
    text: "Point your camera at a card and it's recognised in a moment, or search any card by name. Magic, Pokémon and Yu-Gi-Oh! all live here.",
    demo: (a) => phone("scan", `<div class="tv-top"><b>Scan</b></div><div class="tv-cam"><div class="tv-guide"></div>${card(a[0], 0, "tv-scanned")}<div class="tv-beam"></div></div><div class="tv-toast">✓ Added ${esc(a.names[0] || "Sol Ring")}</div>${tap("t-scan")}`),
  },
  {
    key: "build",
    title: "Decks, three ways",
    text: "Copy a deck that's winning tournaments, build your own, or tap Build for me and set a budget: the app finds legal lists, using the cards you already own first.",
    demo: (a) => phone("build", `<div class="tv-top"><b>Decks</b></div><div class="tv-chips"><span>Meta decks</span><span class="tv-hit">Build for me</span><span>My own</span></div><div class="tv-budget"><span>$25</span><span class="tv-hit2">$50</span><span>$100</span></div><div class="tv-deal">${[1, 2, 3].map((k) => card(a[k], k)).join("")}</div><div class="tv-bar"><span>Deck ready · 3 owned</span></div>${tap("t-build")}`),
  },
  {
    key: "power",
    title: "Know how strong it is",
    text: "Deck Power scores any deck in all three games: what it does well, what holds it back and what to fix first. The AI coach then explains it in plain words.",
    demo: () => phone("power", `<div class="tv-top"><b>Power</b></div><div class="tv-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" class="tv-track"/><circle cx="18" cy="18" r="15.9" class="tv-arc"/></svg><b class="tv-score"></b></div><div class="tv-bars">${["Draw", "Interaction", "Curve"].map((l, k) => `<div><span>${l}</span><i style="--w:${[82, 54, 91][k]}%"></i></div>`).join("")}</div><div class="tv-coach">✦ Coach this deck</div>${tap("t-power")}`),
  },
  {
    key: "prices",
    title: "Watch what it's worth",
    text: "Prices update daily. Follow your collection's value, tap any price to buy it, and get an alert when a card you want gets cheaper.",
    demo: (a) => phone("prices", `<div class="tv-top"><b>Collection</b><span class="tv-bell">🔔</span></div><div class="tv-value"><small>Collection value</small><b>$1,284</b><em>▲ 6.2%</em></div><svg class="tv-chart" viewBox="0 0 120 50" preserveAspectRatio="none"><path d="M0 42 L15 38 L30 40 L45 30 L60 33 L75 22 L90 25 L105 12 L120 8"/></svg><div class="tv-row">${card(a[4], 0, "mini")}<span>${esc(a.names[4] || "Ragavan")}</span><b>$54.10</b></div>${tap("t-prices")}`),
  },
  {
    key: "ask",
    title: "Just ask",
    text: "Tap ✦ Ask next to search and ask anything about your cards, by voice or typing. It only uses the app: cards, prices, sets, tournament decks and your collection.",
    examples: ["What's the most competitive Modern deck?", "What's my most valuable card?", "Build me a Fire deck for $40"],
    demo: (a) => phone("ask", `<div class="tv-top"><b>Search</b><span class="tv-askbtn">✦ Ask</span></div><div class="tv-orb"><i></i><i></i><span>✦</span></div><div class="tv-q"><span>What's the most competitive deck?</span></div><div class="tv-dots"><i></i><i></i><i></i></div><div class="tv-answer"><small>From your app data</small>${card(a[5], 0, "mini")}<b>${esc(a.meta || "Top meta deck")}</b></div>${tap("t-ask")}`),
  },
];

export function openTour({ onDone = () => {}, game = "mtg", art = [], names = [], meta = "" } = {}) {
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
  const a = Object.assign([...art], { names, meta });
  const draw = (dir = 0) => {
    const s = STEPS[i],
      last = i === STEPS.length - 1;
    el.innerHTML = `<div class="tour-card tour-v2" data-step="${i}" data-dir="${dir}">
      <button class="tour-skip" data-tour="skip">Skip</button>
      <div class="tour-demo">${s.demo(a)}</div>
      <h2>${s.title}</h2><p>${s.text}</p>
      ${s.examples ? `<div class="tour-examples">${s.examples.map((q, k) => `<span style="--i:${k}">“${esc(q)}”</span>`).join("")}</div>` : ""}
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
    const t = e.target.closest("[data-tour]")?.dataset.tour;
    if (t === "next") (i++, draw(1));
    else if (t === "back") (i--, draw(-1));
    else if (t === "skip") finish("skip");
    else if (t === "done") finish("done");
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") finish("skip");
    if (e.key === "ArrowRight" && i < STEPS.length - 1) (i++, draw(1));
    if (e.key === "ArrowLeft" && i > 0) (i--, draw(-1));
  });
  // Swipe between cards.
  let x0 = null;
  el.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (dx < -50 && i < STEPS.length - 1) (i++, draw(1));
    else if (dx > 50 && i > 0) (i--, draw(-1));
  });
  draw();
}
