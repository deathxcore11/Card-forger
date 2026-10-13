// Search suggestions: card names as you type (all three games) and your recent searches when
// the box is empty. Works on any input with data-suggest="mtg|ptcg|ygo"; picking a suggestion
// fills the box and runs the search the box already runs on Enter.
import { esc } from "./ui.js";

const RECENT = (g) => `cardstashy-recent-${g}`;
export function recentSearches(g) {
  try {
    return JSON.parse(localStorage.getItem(RECENT(g)) || "[]");
  } catch {
    return [];
  }
}
export function rememberSearch(g, q) {
  q = String(q || "").trim();
  if (q.length < 2 || /[:<>=]/.test(q)) return;
  const list = [q, ...recentSearches(g).filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
  try {
    localStorage.setItem(RECENT(g), JSON.stringify(list));
  } catch {}
}

// Names starting with (or containing) the typed text, best first, from each game's source.
const cache = new Map();
export async function suggestNames(g, q, fetcher = fetch) {
  q = q.trim();
  if (q.length < 2) return [];
  const k = g + ":" + q.toLowerCase();
  if (cache.has(k)) return cache.get(k);
  let names = [];
  try {
    if (g === "mtg") names = (await fetcher("https://api.scryfall.com/cards/autocomplete?" + new URLSearchParams({ q })).then((r) => r.json())).data || [];
    else if (g === "ygo") names = ((await fetcher("https://db.ygoprodeck.com/api/v7/cardinfo.php?" + new URLSearchParams({ fname: q, num: "12", offset: "0" })).then((r) => (r.ok ? r.json() : { data: [] }))).data || []).map((c) => c.name);
    else names = ((await fetcher("https://api.tcgdex.net/v2/en/cards?" + new URLSearchParams({ name: q, "pagination:itemsPerPage": "40" })).then((r) => (r.ok ? r.json() : []))) || []).filter((c) => !/^(A\d|P-A)/.test(c.id)).map((c) => c.name);
  } catch {
    names = [];
  }
  // "Sol Ring // Sol Ring" (art cards, oversized reprints) is the same card twice.
  names = names.filter((n) => !/^(.+) \/\/ \1$/.test(n));
  const low = q.toLowerCase(),
    uniq = [...new Set(names)].sort((a, b) => (b.toLowerCase().startsWith(low) - a.toLowerCase().startsWith(low)) || a.length - b.length).slice(0, 7);
  cache.set(k, uniq);
  return uniq;
}

let box = null,
  input = null,
  timer = 0,
  active = -1,
  ticket = 0;
const close = () => {
  box?.remove();
  box = null;
  active = -1;
  input?.setAttribute("aria-expanded", "false");
};
function show(items, recent) {
  if (!input?.isConnected || !items.length) return close();
  if (!box) {
    box = document.createElement("div");
    box.className = "suggest";
    box.id = "suggestBox";
    box.setAttribute("role", "listbox");
    document.body.append(box);
    box.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("[data-pick]");
      if (!b) return;
      e.preventDefault();
      pick(b.dataset.pick);
    });
  }
  const r = input.getBoundingClientRect();
  Object.assign(box.style, { left: `${r.left + window.scrollX}px`, top: `${r.bottom + window.scrollY + 6}px`, width: `${r.width}px` });
  box.innerHTML = `${recent ? `<p class="suggest-head">Recent</p>` : ""}${items.map((n, i) => `<button type="button" role="option" id="sg${i}" class="${i === active ? "on" : ""}" data-pick="${esc(n)}">${recent ? `<svg class="sg-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.8V9h4.2M12 8v4.3l2.8 1.7"/></svg>` : ""}${esc(n)}</button>`).join("")}`;
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-controls", "suggestBox");
}
function pick(name) {
  if (!input) return;
  input.value = name;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  rememberSearch(input.dataset.suggest, name);
  close();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}
async function update() {
  const g = input?.dataset.suggest,
    q = input?.value || "";
  if (!g) return;
  const my = ++ticket;
  if (!q.trim()) return show(recentSearches(g), true);
  const names = await suggestNames(g, q);
  if (my === ticket && document.activeElement === input) show(names.filter((n) => n.toLowerCase() !== q.trim().toLowerCase() || names.length > 1), false);
}

export function attachSuggest() {
  if (typeof document === "undefined") return;
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest?.("input[data-suggest]");
    if (!el) return;
    input = el;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    update();
  });
  document.addEventListener("input", (e) => {
    if (e.target !== input || !e.isTrusted) return;
    clearTimeout(timer);
    timer = setTimeout(update, 180);
  });
  document.addEventListener("focusout", (e) => {
    if (e.target === input) setTimeout(close, 120);
  });
  document.addEventListener("keydown", (e) => {
    if (e.target !== input) return;
    if (e.key === "Enter") {
      if (box && active >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return pick(box.querySelectorAll("[data-pick]")[active]?.dataset.pick || input.value);
      }
      rememberSearch(input.dataset.suggest, input.value);
      return close();
    }
    if (!box) return;
    const n = box.querySelectorAll("[data-pick]").length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      box.querySelectorAll("[data-pick]").forEach((b, i) => b.classList.toggle("on", i === active));
      input.setAttribute("aria-activedescendant", "sg" + active);
    } else if (e.key === "Escape") close();
  }, true);
  window.addEventListener("scroll", () => box && close(), { passive: true });
}
