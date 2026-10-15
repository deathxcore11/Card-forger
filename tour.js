// First-visit welcome; replay stays in Settings. Preview frames use the real app renderers.
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
export const shouldTour = ({ cards = 0, decks = 0, seen = tourSeen() } = {}) => !seen;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// The visuals below are live screen-renderer output, not a second imitation UI.
export const STEPS = [
  { key: "welcome", title: "Your cards. Three games. One place.", text: "Welcome to CardStashy. Pick your game from the menu at the top, or swipe left or right on Home. Your cards and decks stay separate for each game." },
  { key: "scan", title: "Let's get your cards in", text: "Got a pile to sort? Open Scan and hold a card inside the guide. Check the match, then add it. You can search by name or paste a list too." },
  { key: "build", title: "Find your next deck", text: "Start with a list you like, explore Meta decks, or build around cards you already own. Pick a format and a budget, then see what you're missing." },
  { key: "power", title: "Get to know your deck", text: "Once you've added a deck, open Power. It'll show what supports your plan and where the deck needs help. Treat the score as a starting point, then try it in a real game." },
  { key: "prices", title: "See what you've got", text: "Your collection keeps track of your cards and their estimated value. Tap a card to check its printing, finish and prices. Check the seller's listing before you buy." },
  { key: "ask", title: "A little help when you want it", text: "The shiny Ask button sits right beside Search. Ask about cards, prices or your next deck. You can type, or use the microphone if your phone supports it." },
  { key: "collect", title: "Give your cards a home", text: "Head to Collection, then Binders. Make a binder for a set, a favourite deck or whatever you're collecting. Open a card's Versions when you want a different printing." },
  { key: "upgrade", title: "Make a few good changes", text: "Inside your deck, try Upgrade lab. Look through the suggested builds, check the cost and save a version before changing things. Keep what fits the way you like to play." },
  { key: "practice", title: "Give it a few practice hands", text: "Open Playtest from your deck to try your opening hands. Matchups and the AI coach can give you more ideas to test. They're estimates, so let real games have the final say." },
  { key: "backup", title: "Keep a copy of your cards", text: "Before you switch devices, head to Settings and download a backup. You can sign in there for account sync too. Want another look around later? Replay this tour in Settings." },
];

export function previewDocument(html, { cssUrl = './style.css', game = 'mtg', header = '', nav = '' } = {}) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${esc(cssUrl)}"><style>html,body{margin:0;overflow:hidden}body{opacity:1!important}#app{opacity:1!important}#content{padding:12px;padding-bottom:70px}.topbar{position:relative}.sheet-head{margin-bottom:12px}button,input,select,a{pointer-events:none}.ask-launch,[aria-selected=true],.btn:not(.ghost){animation:tour-hint 3s ease-in-out infinite}@keyframes tour-hint{50%{box-shadow:0 0 0 3px color-mix(in srgb,var(--game-color,var(--gold)) 30%,transparent)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body data-game="${esc(game)}" style="--game-color:${({mtg:'#f08a5d',ptcg:'#ef5350',ygo:'#f5b335'})[game] || '#f08a5d'}"><div id="app" class="ready">${header}<main id="content">${html}</main>${nav}</div></body></html>`;
}

export function openTour({ onDone = () => {}, game = "mtg", scenes = {}, header = "", nav = "", cssUrl = "./style.css" } = {}) {
  if (typeof document === "undefined" || document.querySelector(".tour")) return;
  let i = 0, finished = false;
  const launcher = document.activeElement;
  const el = document.createElement("div");
  if (typeof el.setAttribute !== "function" || typeof el.addEventListener !== "function") return;
  el.className = "tour";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Welcome to CardStashy");
  el.dataset.game = game;
  document.body.append(el);

  const draw = (dir = 0) => {
    const s = STEPS[i],
      last = i === STEPS.length - 1;
    el.innerHTML = `<div class="tour-card tour-v2" data-step="${i}" data-dir="${dir}">
      <button class="tour-skip" data-tour="skip">Skip</button>
      <div class="tour-preview" aria-hidden="true">${(scenes[s.key] || []).map((html, n, list) => `<iframe tabindex="-1" title="${esc(s.title)}" sandbox="" style="--frame:${n};--frames:${list.length}" srcdoc="${esc(previewDocument(html, { cssUrl, game, header, nav }))}"></iframe>`).join("")}</div>
      <h2>${s.title}</h2><p>${s.text}</p>
      ${s.examples ? `<div class="tour-examples">${s.examples.map((q, k) => `<span style="--i:${k}">“${esc(q)}”</span>`).join("")}</div>` : ""}
      <div class="tour-dots" aria-hidden="true">${STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="tour-actions">${i ? `<button class="btn ghost" data-tour="back">Back</button>` : "<span></span>"}<button class="btn" data-tour="${last ? "done" : "next"}">${last ? "Let's go" : "Next"}</button></div>
    </div>`;
    el.querySelector(`[data-tour="${last ? "done" : "next"}"]`)?.focus();
  };
  const finish = (how) => {
    if (finished) return;
    finished = true;
    markSeen();
    el.classList.add("leaving");
    setTimeout(() => { el.remove(); if (launcher?.isConnected) launcher.focus?.(); }, 260);
    onDone(how);
  };
  el.addEventListener("click", (e) => {
    if (finished) return;
    const t = e.target.closest("[data-tour]")?.dataset.tour;
    if (t === "next" && i < STEPS.length - 1) (i++, draw(1));
    else if (t === "back" && i > 0) (i--, draw(-1));
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
