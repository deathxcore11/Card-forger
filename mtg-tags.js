// Scryfall's community oracle tags for the roles the app scores (removal, counterspell, board
// wipe, draw, ramp, discard). mtg-tags.json holds only the cards the app's own text patterns
// miss (built by scripts/mtg-tags.mjs), so a tag adds a role and never removes one. Loaded once,
// lazily; until then the patterns alone decide, and "cf:mtg-tags" fires when the tags arrive.
const sets = {};
let loaded = false, loading = null;
export function setMtgTags(data) {
  for (const [role, names] of Object.entries(data?.roles || {})) sets[role] = new Set(names.map((n) => String(n).toLowerCase()));
  loaded = true;
}
export const mtgTagsReady = () => loaded;
export function loadMtgTags() {
  if (loaded || loading || typeof fetch !== "function" || typeof location === "undefined") return loading;
  loading = fetch(new URL("./mtg-tags.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { setMtgTags(d); globalThis.dispatchEvent?.(new Event("cf:mtg-tags")); } })
    .catch(() => {});
  return loading;
}
const nameOf = (c) => String(c?.name || "").toLowerCase();
export const mtgTagged = (c, role) => {
  if (!loaded) { loadMtgTags(); return false; }
  const s = sets[role], n = nameOf(c);
  return !!s && (s.has(n) || (n.includes(" // ") && s.has(n.split(" // ")[0])));
};
