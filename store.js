import { recordPrice } from "./pricehist.js";
// Shared in-memory store. `S.state` is the saved workspace, `S.catalog` the card-data
// cache, `S.ui` is screen state that is never saved.
import { cardKey, inventory, cardPrice } from "./core.js";

export const STORAGE = "cardforge-v2";
export const CATALOG_RECORD = "cardforge-catalog-v1";
export const RECOVERY = "cardforge-recovery-v2";

export const blank = () => ({
  version: 3,
  references: [],
  printings: {},
  importHistory: [],
  collection: [],
  decks: [],
  activeDeck: null,
  wishlist: [],
  notes: [],
  valueHistory: [],
  settings: { shipping: 4.99, tax: 0, budget: 25, theme: "dark" },
  example: false,
});

export const S = {
  state: blank(),
  catalog: {},
  catalogDirty: false,
  ui: {
    view: "home",
    sub: "",
    deckId: null,
    deckTab: "cards",
    collTab: "cards",
    decksTab: "mine",
    q: { coll: "", deck: "", shelf: "", ref: "", precon: "" },
    collSort: "name",
    collFilter: "all",
    collLimit: 120,
    deckFilter: "all",
    deckSort: "type",
    deckGrid: false,
    db: {
      term: "",
      filters: { color: "", type: "", format: "commander", maxPrice: "" },
      results: [],
      next: null,
      total: 0,
      busy: false,
      error: "",
    },
    scan: { file: null, url: null, text: "", match: null, busy: false, status: "", crop: "full", cands: [], guess: "", read: "" },
    hand: null,
    gold: new Map(),
    fill: { deckId: null, plan: null, busy: false, msg: "", budget: 25, lands: 36, owned: true, simple: true },
    upgrade: { deckId: null, plans: {}, budget: 25, simple: true, tradeIn: false, busy: false, msg: "", selected: new Set(), base: "" },
    versions: { a: null, b: "current" },
    ideas: { busy: false, ownedOnly: true, filter: "all", limit: 12, msg: "", cache: [], sig: "" },
    precon: { index: [], busy: false, msg: "" },
    compare: [null, null],
    finder: { basics: true, precons: [], cacheLoaded: false, busy: false, msg: "", max: "", colors: "", sort: "cost", q: "", limit: 12 },
    shared: { code: "", deck: null, error: "" },
    rules: { list: "", busy: false, error: "", data: {} },
    build: { seed: "", format: "", results: {}, busy: false, msg: "", error: false, openTier: null, custom: "", fillDeck: null, avail: null },
    sets: { list: [], busy: false, error: "", q: "", all: false },
    set: { code: "", info: null, cards: [], total: 0, busy: false, loaded: false, error: "", q: "", filter: "all", rarity: "all", sort: "number", limit: 120 },
    sheetCtx: null,
  },
};

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2);

export const meta = (n) => S.catalog[cardKey(n)] || null;
export const inv = (n, exclude) =>
  inventory(S.state.collection, n, S.state.decks, exclude);
export const deckById = (id) => S.state.decks.find((d) => d.id === id) || null;
export const currentDeck = () =>
  deckById(S.ui.deckId) || deckById(S.state.activeDeck) || null;
export const priceOf = (name, finish = "nonfoil") => {
  const choice = S.state.priceChoices?.[cardKey(name)];
  if (choice && (finish === "nonfoil" || choice.finish === finish))
    return choice.price;
  const c = meta(name);
  return cardPrice(c, finish) ?? (finish === "nonfoil" ? null : cardPrice(c));
};

// Drop heavy Scryfall fields so the cache stays small on phones.
const KEEP = [
  "id", "oracle_id", "name", "lang", "cmc", "mana_cost", "type_line", "oracle_text",
  "colors", "color_identity", "produced_mana", "keywords", "power", "toughness",
  "loyalty", "legalities", "prices", "set", "set_name", "collector_number", "rarity",
  "edhrec_rank", "scryfall_uri", "finishes", "layout", "checkedAt",
  "flavor_text", "artist", "released_at", "set_type", "full", "promo", "frame_effects",
  "border_color", "full_art", "reserved", "penny_rank", "game_changer", "purchase_uris", "rulings_uri",
];
export function slim(c) {
  if (!c || typeof c !== "object") return c;
  const out = {};
  for (const k of KEEP) if (c[k] !== undefined) out[k] = c[k];
  if (c.image_uris)
    out.image_uris = {
      small: c.image_uris.small,
      normal: c.image_uris.normal,
      art_crop: c.image_uris.art_crop,
    };
  if (Array.isArray(c.card_faces))
    out.card_faces = c.card_faces.map((f) => ({
      name: f.name,
      mana_cost: f.mana_cost,
      type_line: f.type_line,
      oracle_text: f.oracle_text,
      power: f.power,
      toughness: f.toughness,
      flavor_text: f.flavor_text,
      artist: f.artist,
      image_uris: f.image_uris
        ? { small: f.image_uris.small, normal: f.image_uris.normal, art_crop: f.image_uris.art_crop }
        : undefined,
    }));
  return out;
}

export function cacheCard(c, aliases = []) {
  const copy = slim({ ...c, checkedAt: new Date().toISOString() });
  if (c.id) recordPrice("mtg", c.id, c.prices?.usd ?? c.prices?.usd_foil ?? c.prices?.usd_etched ?? null, c.name);
  S.catalog[cardKey(c.name)] = copy;
  for (const a of aliases) S.catalog[cardKey(a)] = copy;
  for (const f of c.card_faces || [])
    if (f.name && !S.catalog[cardKey(f.name)]) S.catalog[cardKey(f.name)] = copy;
  S.catalogDirty = true;
  return copy;
}
