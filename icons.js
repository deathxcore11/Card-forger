// One line-icon family for the whole app: 24px grid, 1.8px rounded strokes, currentColor.
// Game marks get their signature color from CSS (--game-color), so they light up when active
// and dim when idle without separate artwork.
const svg = (body, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
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
