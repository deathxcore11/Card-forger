// One line-icon family for the whole app: 24px grid, 1.8px rounded strokes, currentColor.
// Game marks get their signature color from CSS (--game-color), so they light up when active
// and dim when idle without separate artwork.
const svg = (body, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  back: svg(`<path d="M14.5 6 8.5 12l6 6"/>`),
  home: svg(`<path d="M3.5 10.6 12 4l8.5 6.6"/><path d="M5.6 9.2V19a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.2"/><path d="M10 20v-5.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20"/>`),
  search: svg(`<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.6 4.6"/>`),
  // A binder with a card in its pocket.
  collection: svg(`<rect x="4" y="3.5" width="14.5" height="17" rx="2.2"/><path d="M7.5 3.5v17" stroke-opacity=".55"/><rect x="10.2" y="7.2" width="5.2" height="7.2" rx="1"/><path d="M20.5 6.5v11" stroke-opacity=".55"/>`),
  // A fanned hand of three cards.
  decks: svg(`<rect x="8.6" y="4.2" width="9.4" height="13.4" rx="1.6" transform="rotate(14 13.3 10.9)"/><rect x="5.6" y="5.6" width="9.4" height="13.4" rx="1.6" transform="rotate(-10 10.3 12.3)" fill="var(--nav-fill, transparent)"/>`),
  // Viewfinder corners around a card.
  scan: svg(`<path d="M4 8.2V5.6A1.6 1.6 0 0 1 5.6 4h2.6M15.8 4h2.6A1.6 1.6 0 0 1 20 5.6v2.6M20 15.8v2.6a1.6 1.6 0 0 1-1.6 1.6h-2.6M8.2 20H5.6A1.6 1.6 0 0 1 4 18.4v-2.6"/><rect x="9" y="7.6" width="6" height="8.8" rx="1.1"/><path d="M4 12h3M17 12h3" stroke-opacity=".55"/>`),
  settings: svg(`<path d="M4 7.5h8.5M17.5 7.5H20M4 16.5h2.5M11.5 16.5H20"/><circle cx="15" cy="7.5" r="2.4"/><circle cx="9" cy="16.5" r="2.4"/>`),
  zoom: svg(`<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.6 4.6M10.8 8.2v5.2M8.2 10.8h5.2"/>`),
  chevron: svg(`<path d="m7.5 10 4.5 4.5 4.5-4.5"/>`, "chev"),
  check: svg(`<path d="m5.5 12.5 4 4 9-9"/>`, "check"),
  // Your cards on this device, kept in sync: a card with a sync loop.
  sync: svg(`<rect x="3" y="4" width="12.5" height="16.5" rx="2.4"/><path d="M6.6 8.2h5.2M6.6 11.2h3.2" stroke-opacity=".5"/><path class="sync-loop" d="M15.8 4.6a5.4 5.4 0 0 1 5 7.9"/><path class="sync-loop" d="m21.6 9.6-.8 2.9-2.9-.7"/>`, "sync"),
};

// Game marks, drawn for this app (not official logos).
export const GAME_MARK = {
  // A planeswalker-style spark: tall center blade, two flanking blades, outer wings and a root.
  mtg: svg(`<path d="M12 2.4 13.9 9 12 12l-1.9-3z" fill="currentColor" fill-opacity=".22"/><path d="M7.1 4.4 9.5 10.3 8.5 12.7 5.8 8.7z" fill="currentColor" fill-opacity=".18"/><path d="M16.9 4.4 18.2 8.7l-2.7 4-1-2.4z" fill="currentColor" fill-opacity=".18"/><path d="M2.6 9 5.5 13.5l-1 2.2L2.1 12z"/><path d="m21.4 9 .5 3-2.4 3.7-1-2.2z"/><path d="M8.7 14.3 12 21.6l3.3-7.3L12 12.8z" fill="currentColor" fill-opacity=".32"/>`, "mark mtg"),
  // An all-seeing eye inside a pyramid, with a brow ridge and base line.
  ygo: svg(`<path d="M12 2.6 21.6 20H2.4z"/><path d="M12 2.6v3.6" stroke-opacity=".55"/><path d="M7.4 11.4Q12 8.5 16.6 11.4"/><path d="M7.8 14.4Q12 11.3 16.2 14.4 12 17.5 7.8 14.4z" fill="currentColor" fill-opacity=".16"/><circle cx="12" cy="14.4" r="1.7" fill="currentColor" stroke="none"/><path d="M5.2 18h13.6" stroke-opacity=".5"/>`, "mark ygo"),
  // A capture ball: shell, equator split around a two-ring core.
  ptcg: svg(`<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9h-5.4" fill="currentColor" fill-opacity=".12" stroke="none"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9h-5.3a3.7 3.7 0 0 0-7.4 0z" fill="currentColor" fill-opacity=".14" stroke="none"/><path d="M3.2 12h5.1M15.7 12h5.1"/><circle cx="12" cy="12" r="3.3"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>`, "mark ptcg"),
};

// Signature color per game (the mark, its chip and its glow).
export const GAME_COLOR = { mtg: "#f08a5d", ygo: "#f5b335", ptcg: "#ef5350" };

/* ---------- Action icons: replace emoji and stock symbols everywhere ---------- */

const ACTION = {
  // Inventory: three straight cards. Binder: cover, spine and visible rings.
  cardStack: svg(`<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M5 6h3M11 11h6M11 15h4"/>`),
  binder: svg(`<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M3 7h4M3 12h4M3 17h4"/><rect x="12" y="7" width="5" height="8" rx="1"/>`),
  decks: ICON.decks,
  plus: svg(`<path d="M12 5v14M5 12h14"/>`),
  minus: svg(`<path d="M5 12h14"/>`),
  close: svg(`<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>`),
  more: svg(`<circle cx="6" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="18" cy="12" r="1.1" fill="currentColor"/>`),
  back: ICON.back,
  check: ICON.check,
  // Build a deck: a stack of cards with a plus.
  build: svg(`<rect x="4" y="6.5" width="10.5" height="14" rx="1.8"/><path d="M7.5 6.5V5a1.6 1.6 0 0 1 1.6-1.6h8.3A1.6 1.6 0 0 1 19 5v11.4a1.6 1.6 0 0 1-1.6 1.6h-2.9" stroke-opacity=".6"/><path d="M9.25 10.5v6M6.25 13.5h6"/>`),
  // Deck ideas: a card with a spark.
  ideas: svg(`<rect x="4" y="5" width="11" height="15" rx="1.8"/><path d="M18.5 3.5v4M16.5 5.5h4M19 11.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/>`),
  trophy: svg(`<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5.2a.7.7 0 0 0-.7.8A4 4 0 0 0 8 10.3M16 6h2.8a.7.7 0 0 1 .7.8 4 4 0 0 1-3.5 3.5"/><path d="M12 13.5V17M8.5 20h7l-.8-3H9.3z"/>`),
  compare: svg(`<rect x="3" y="5" width="7.5" height="11" rx="1.4"/><rect x="13.5" y="8" width="7.5" height="11" rx="1.4"/><path d="M12 2.8v2.4M12 18.8v2.4" stroke-opacity=".55"/>`),
  heart: svg(`<path d="M12 19.5s-7.5-4.3-7.5-9.7A4.1 4.1 0 0 1 12 7.3a4.1 4.1 0 0 1 7.5 2.5c0 5.4-7.5 9.7-7.5 9.7z"/>`),
  heartOn: svg(`<path d="M12 19.5s-7.5-4.3-7.5-9.7A4.1 4.1 0 0 1 12 7.3a4.1 4.1 0 0 1 7.5 2.5c0 5.4-7.5 9.7-7.5 9.7z" fill="currentColor"/>`),
  import: svg(`<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14"/>`),
  export: svg(`<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14"/>`),
  refresh: svg(`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>`),
  // Flip / rotate: a card turning over.
  flip: svg(`<rect x="7" y="4" width="10" height="14" rx="1.6"/><path d="M3.5 13.5a8.5 8.5 0 0 0 15.4 3.6M20.5 10.5A8.5 8.5 0 0 0 5.1 6.9" stroke-opacity=".7"/><path d="m18.6 13.8.3 3.3 3.2-.6M5.4 10.2l-.3-3.3-3.2.6" stroke-opacity=".7"/>`),
  copy: svg(`<rect x="8" y="8" width="11.5" height="12" rx="1.8"/><path d="M15.5 8V5.8A1.8 1.8 0 0 0 13.7 4H6.3a1.8 1.8 0 0 0-1.8 1.8v8.4A1.8 1.8 0 0 0 6.3 16H8"/>`),
  link: svg(`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`),
  print: svg(`<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8" rx="1.8"/><path d="M7 13.5h10V20.5H7z"/>`),
  camera: svg(`<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>`),
  // Sets: a sealed booster pack with crimped ends.
  pack: svg(`<path d="M6 4.5h12l-1 2 1 2v8l-1 2 1 2H6l1-2-1-2v-8l1-2z"/><path d="M8.5 11h7M8.5 14h4.5" stroke-opacity=".6"/>`),
  bookmark: svg(`<path d="M7 4h10v16l-5-3.6L7 20z"/>`),
  bookmarkOn: svg(`<path d="M7 4h10v16l-5-3.6L7 20z" fill="currentColor"/>`),
  grid: svg(`<rect x="4" y="4" width="6.5" height="7" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="7" rx="1.2"/><rect x="4" y="13" width="6.5" height="7" rx="1.2"/><rect x="13.5" y="13" width="6.5" height="7" rx="1.2"/>`),
  history: svg(`<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.8V9h4.2M12 8v4.3l2.8 1.7"/>`),
  bag: svg(`<path d="M5.5 8h13l-1 12h-11z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>`),
  pick: svg(`<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="m8 12.3 2.7 2.7L16 9.6"/>`),
  warn: svg(`<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`),
  // A rule problem: a stop sign with a bar.
  stop: svg(`<path d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3z"/><path d="M8.5 12h7"/>`),
  // Commander damage: crossed blades. Poison: a drop with a skull-like face.
  sword: svg(`<path d="m4 4 9.5 9.5M20 4l-9.5 9.5"/><path d="m6.5 14.5 3 3M17.5 14.5l-3 3M4.5 19.5l3-3M19.5 19.5l-3-3"/>`),
  poison: svg(`<path d="M12 3.5s-6 6.4-6 10.5a6 6 0 0 0 12 0C18 9.9 12 3.5 12 3.5z"/><circle cx="10" cy="14" r=".9" fill="currentColor"/><circle cx="14" cy="14" r=".9" fill="currentColor"/><path d="M10.5 17h3"/>`),
  brush: svg(`<path d="M19.5 4.5 11 13"/><path d="M11 13c-2.5-.4-4.5 1.3-4.5 3.6 0 1.1-.8 2.2-2 2.4 3.9 1.6 8.6.1 8.6-3.8z"/>`),
  share: svg(`<circle cx="6.5" cy="12" r="2.3"/><circle cx="17.5" cy="6" r="2.3"/><circle cx="17.5" cy="18" r="2.3"/><path d="m8.6 10.9 6.8-3.7M8.6 13.1l6.8 3.7"/>`),
  search: ICON.search,
  scan: ICON.scan,
  collection: ICON.collection,
  // Rules: an open rulebook.
  book: svg(`<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5V20"/>`),
  // Card views: gallery (cards in a grid), compact (thumbnail + text rows), symbols (list).
  viewGallery: svg(`<rect x="3.5" y="3.5" width="7.5" height="10.5" rx="1.3"/><rect x="13" y="3.5" width="7.5" height="10.5" rx="1.3"/><path d="M3.5 17.5h7.5M13 17.5h7.5M3.5 20.5h5M13 20.5h5" stroke-opacity=".6"/>`),
  viewCompact: svg(`<rect x="3.5" y="4" width="5" height="7" rx="1"/><rect x="3.5" y="13" width="5" height="7" rx="1"/><path d="M11 6h9.5M11 9h6M11 15h9.5M11 18h6" />`),
  viewSymbols: svg(`<circle cx="5" cy="6" r="1.4"/><circle cx="5" cy="12" r="1.4"/><circle cx="5" cy="18" r="1.4"/><path d="M9 6h11.5M9 12h11.5M9 18h11.5"/>`),
  select: svg(`<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><path d="m5.4 7.4 1.5 1.5 2.6-2.8"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><path d="m5.4 16.9 1.5 1.5 2.6-2.8"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6"/>`),
  // Scanner guide states.
  frame: svg(`<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/>`),
  dark: svg(`<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>`),
  hand: svg(`<path d="M8 12V6.2a1.4 1.4 0 0 1 2.8 0V11M10.8 10.5V4.9a1.4 1.4 0 0 1 2.8 0v5.6M13.6 10.5V6a1.4 1.4 0 0 1 2.8 0v6.2M16.4 9.5a1.4 1.4 0 0 1 2.8 0V14a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-5-2.7l-2.2-3.4a1.4 1.4 0 0 1 2.3-1.6L8 13.5"/>`),
  glare: svg(`<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>`),
  focus: svg(`<circle cx="12" cy="12" r="7.5" stroke-dasharray="3 2.6"/><circle cx="12" cy="12" r="2.5"/>`),
};

// Random is the same six-sided die in every game, so the same action always looks the same.
ACTION.random = svg(`<rect x="4" y="4" width="16" height="16" rx="3.2"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>`);
// Leading symbols (followed by a space) and lone symbols in buttons → icons.
const LEAD = { "▲": "warn", "●": "stop", "⚔": "sword", "☠": "poison", "🎲": "random", "⚒": "build", "✧": "ideas", "🏆": "trophy", "⇄": "compare", "♡": "heart", "♥": "heartOn", "＋": "plus", "+": "plus", "↥": "import", "↓": "export", "⟳": "refresh", "↻": "flip", "⧉": "copy", "🔗": "link", "🖨": "print", "📷": "camera", "◈": "pack", "☆": "bookmark", "▦": "collection", "📖": "book", "◷": "history", "🛒": "bag", "⌕": "search", "☑": "pick", "⚠": "warn", "🖌": "brush", "✓": "check", "←": "back", "‹": "back", "▧": "scan" };
const ALONE = { "◐": "dark", "▢": "frame", "✋": "hand", "☀": "glare", "◎": "focus", "✓": "check", "✕": "close", "⋯": "more", "−": "minus", "＋": "plus", "←": "back", "⟳": "refresh", "↻": "flip" };
export const actionIcon = (name) => ACTION[name] || "";
// A lone symbol inside a button (quick tiles, icon buttons) maps like a leading one.
for (const [k, v] of Object.entries(LEAD)) if (!ALONE[k] && k !== "+" && k !== "✓") ALONE[k] = v;
const iconFor = (name) => ACTION[name];

/**
 * Replace emoji / stock-symbol icons inside `root` with drawn icons. Safe to run repeatedly:
 * replaced text no longer starts with a symbol. Empty-state ◇ marks become the game's own mark.
 */
export function decorateGlyphs(root, game = "mtg") {
  if (!root?.querySelectorAll) return;
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* text */);
  const hits = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest("script, style, textarea, input, select, option, svg, .no-ic, .oracle, .flavor, .rulings, pre, code")) continue;
    const s = n.data;
    const lone = s.trim().replace(/\uFE0F/g, "");
    if (ALONE[lone] && p.closest("button, a, .icon, .cam-status, .quick-btn, .review-icon, .bad-text, .warn-text, .ok-text") && p.childNodes.length === 1) hits.push([n, ALONE[lone], "", true]);
    else {
      const m = s.match(/^(\s*)(\S)\uFE0F?[ \u00a0](?=\S)/u);
      if (m && LEAD[m[2]] && p.closest("button, a, label, summary, .tag, .chip, .small, .foot, small, span, h3, p")) hits.push([n, LEAD[m[2]], s.slice(m[0].length), false, m[1]]);
    }
  }
  for (const [n, name, rest, lone, pad] of hits) {
    const icon = iconFor(name, game);
    if (!icon) continue;
    const span = root.ownerDocument.createElement("span");
    span.className = "gl" + (lone ? " lone" : "");
    span.innerHTML = icon;
    n.parentNode.insertBefore(span, n);
    n.data = lone ? "" : (pad || "") + rest;
  }
}
