import { isFormatName } from "./formats.js";
import { cardKey, aggregateCards, cardPrice } from "./core.js";
const canon = (s) => String(s ?? "").trim();
const header = (s) =>
  canon(s)
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
export function csvRows(text) {
  let out = [],
    row = [],
    v = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (q && text[i + 1] === '"') {
        v += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      row.push(v);
      v = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(v);
      if (row.some((x) => x.trim())) out.push(row);
      row = [];
      v = "";
    } else v += c;
  }
  if (q) throw Error("The CSV has an unclosed quoted field.");
  row.push(v);
  if (row.some((x) => x.trim())) out.push(row);
  return out;
}
const aliases = {
  name: ["name", "card name"],
  qty: ["quantity", "qty", "count"],
  set: ["set code", "edition code", "set"],
  setName: ["set name", "edition"],
  number: ["collector number", "card number", "collector no", "number"],
  finish: ["finish", "printing", "foil"],
  language: ["language", "lang"],
  condition: ["condition"],
  location: [
    "binder name",
    "binder",
    "list name",
    "list",
    "location",
    "folder",
  ],
  printingId: ["scryfall id", "scryfallid", "scryfall card id"],
  purchasePrice: ["purchase price", "price purchased", "purchase value"],
  purchaseCurrency: [
    "purchase currency",
    "purchase price currency",
    "currency",
  ],
  signed: ["signed"],
  altered: ["altered"],
  misprint: ["misprint"],
  proxy: ["proxy", "is proxy"],
};
const yes = (s) => /^(true|yes|1|y)$/i.test(canon(s));
function finish(s) {
  const v = canon(s).toLowerCase();
  if (/etched/.test(v)) return "etched";
  if (/^(foil|true|yes|1|f)$/.test(v)) return "foil";
  if (!v || /^(nonfoil|non-foil|normal|false|no|0)$/.test(v)) return "nonfoil";
  return null;
}
function lang(s) {
  const v = canon(s).toLowerCase();
  return (
    {
      english: "en",
      japanese: "ja",
      german: "de",
      french: "fr",
      spanish: "es",
      italian: "it",
      portuguese: "pt",
      russian: "ru",
      korean: "ko",
      "chinese simplified": "zhs",
      "chinese traditional": "zht",
    }[v] ||
    v ||
    "en"
  );
}
function condition(s) {
  const v = canon(s);
  return (
    {
      nm: "Near Mint",
      lp: "Lightly Played",
      mp: "Moderately Played",
      hp: "Heavily Played",
      dmg: "Damaged",
      mint: "Near Mint",
    }[v.toLowerCase()] ||
    v ||
    "Near Mint"
  );
}
export function parseImport(text) {
  const rows = csvRows(text),
    headers = (rows[0] || []).map(header),
    isCSV = headers.some(
      (h) => aliases.name.includes(h) || aliases.printingId.includes(h),
    );
  let parsed = [],
    errors = [],
    mapping = {},
    source = "text";
  if (isCSV) {
    source =
      headers.includes("manabox id") || headers.includes("binder name")
        ? "ManaBox-style CSV"
        : "Collection CSV";
    const indices = {};
    for (const [k, names] of Object.entries(aliases)) {
      const index = headers.findIndex((h) => names.includes(h));
      indices[k] = index;
      if (index >= 0) mapping[k] = rows[0][index];
    }
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i],
        value = (k) => (indices[k] >= 0 ? r[indices[k]] || "" : "");
      const name = canon(value("name")),
        printingId = canon(value("printingId")),
        qty = value("qty") === "" ? 1 : Number(value("qty")),
        f = finish(value("finish"));
      if (!name && !printingId) {
        errors.push({
          line: i + 1,
          reason: "Missing card name and Scryfall ID",
          raw: r,
        });
        continue;
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 100000) {
        errors.push({ line: i + 1, reason: "Invalid quantity", raw: r });
        continue;
      }
      if (f === null) {
        errors.push({
          line: i + 1,
          reason: "Unknown finish: " + value("finish"),
          raw: r,
        });
        continue;
      }
      if (printingId && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(printingId)) {
        errors.push({
          line: i + 1,
          reason: "Invalid Scryfall printing ID",
          raw: r,
        });
        continue;
      }
      if (
        value("purchasePrice") !== "" &&
        (!Number.isFinite(Number(value("purchasePrice"))) ||
          Number(value("purchasePrice")) < 0)
      ) {
        errors.push({ line: i + 1, reason: "Invalid purchase price", raw: r });
        continue;
      }
      const raw = Object.fromEntries(rows[0].map((h, j) => [h, r[j] || ""]));
      parsed.push({
        line: i + 1,
        name,
        qty,
        set: canon(value("set")),
        setName: canon(value("setName")),
        collectorNumber: canon(value("number")),
        finish: f,
        language: lang(value("language")),
        condition: condition(value("condition")),
        location: canon(value("location")),
        printingId: printingId || null,
        printingVerified: false,
        purchasePrice:
          value("purchasePrice") === "" ? null : Number(value("purchasePrice")),
        purchaseCurrency: canon(value("purchaseCurrency")),
        signed: yes(value("signed")),
        altered: yes(value("altered")),
        misprint: yes(value("misprint")),
        proxy: yes(value("proxy")),
        reserved: 0,
        raw,
      });
    }
  } else {
    let line = 0;
    for (const raw of text.split(/\r?\n/)) {
      line++;
      const s = raw.trim();
      if (!s || s.startsWith("[") || s.startsWith("#") || s.startsWith("//"))
        continue;
      const m = s.match(/^(\d+)\s*[xX]?\s+(.+)$/);
      if (!m) {
        errors.push({
          line,
          reason: "Expected quantity + card name",
          raw: [raw],
        });
        continue;
      }
      const qty = Number(m[1]),
        parts = m[2].match(/^(.*?)\s+\(([A-Za-z0-9]+)\)\s+(\S+)(?:\s+\*F\*)?$/);
      if (qty < 1 || qty > 100000) {
        errors.push({ line, reason: "Invalid quantity", raw: [raw] });
        continue;
      }
      parsed.push({
        line,
        name: (parts ? parts[1] : m[2].replace(/\s+\*F\*$/, "")).trim(),
        qty,
        set: parts ? parts[2] : "",
        collectorNumber: parts ? parts[3] : "",
        setName: "",
        finish: /\*F\*$/.test(s) ? "foil" : "nonfoil",
        language: "en",
        condition: "Near Mint",
        location: "",
        printingId: null,
        printingVerified: false,
        reserved: 0,
        raw: { text: raw },
      });
    }
  }
  if (!parsed.length)
    throw Error(
      "No valid cards found. Use a collection CSV or quantity + name lines.",
    );
  return {
    source,
    rows: parsed,
    errors,
    mapping,
    total: parsed.reduce((a, c) => a + c.qty, 0),
  };
}
export function lotKey(e) {
  return JSON.stringify([
    e.printingId ||
      [
        cardKey(e.name),
        canon(e.set).toLowerCase(),
        canon(e.setName).toLowerCase(),
        canon(e.collectorNumber),
        e.language || "en",
      ].join("|"),
    e.finish || "nonfoil",
    e.condition || "Near Mint",
    e.location || "",
    !!e.signed,
    !!e.altered,
    !!e.misprint,
    !!e.proxy,
    e.purchasePrice ?? null,
    e.purchaseCurrency || "",
  ]);
}
export function printingState(e) {
  if (e.printingVerified && e.printingId) return "Verified printing";
  if (e.printingId || ((e.set || e.setName) && e.collectorNumber))
    return "Printing needs verification";
  return "Printing unspecified";
}
export function previewImport(parsed, collection, hash, history = []) {
  const groups = new Map();
  for (const e of parsed.rows) {
    const k = lotKey(e);
    if (groups.has(k)) {
      groups.get(k).qty += e.qty;
      groups.get(k).rawRows.push(e.raw);
    } else groups.set(k, { ...e, rawRows: [e.raw] });
  }
  const duplicates = parsed.rows.length - groups.size;
  const existingKeys = new Set(collection.map(lotKey));
  return {
    ...parsed,
    hash,
    repeated: history.some((h) => h.hash === hash),
    lots: [...groups.values()],
    duplicateRows: duplicates,
    overlappingLots: [...groups.keys()].filter((k) => existingKeys.has(k))
      .length,
  };
}
export function applyImport(collection, preview, mode, sourceKey, createId) {
  if (!["replace-source", "append", "replace-all"].includes(mode))
    throw Error("Invalid import mode.");
  if (preview.repeated && mode === "append")
    throw Error(
      "This exact file was already imported. Use Replace this source instead of adding its quantities again.",
    );
  const lotList = preview.lots.filter((e) => e.include !== false);
  if (!lotList.length) throw Error("No rows selected.");
  const imported = lotList.map((e) => ({
    ...e,
    id: createId(),
    sourceKey,
    importHash: preview.hash,
  }));
  let kept =
    mode === "replace-all"
      ? []
      : mode === "replace-source"
        ? collection.filter((e) => e.sourceKey !== sourceKey)
        : collection.slice();
  return [...kept, ...imported];
}
export function importErrorsCSV(errors) {
  const escape = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  return (
    "Line,Reason,Original row\n" +
    errors
      .map((e) =>
        [e.line, e.reason, JSON.stringify(e.raw)].map(escape).join(","),
      )
      .join("\n")
  );
}
export function exportCollectionCSV(entries) {
  const columns = [
    "Name",
    "Quantity",
    "Set code",
    "Collector number",
    "Foil",
    "Language",
    "Condition",
    "Binder Name",
    "Scryfall ID",
    "Purchase price",
    "Purchase currency",
    "Signed",
    "Altered",
    "Misprint",
    "Proxy",
  ];
  const escape = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  return (
    columns.map(escape).join(",") +
    "\n" +
    entries
      .map((e) =>
        [
          e.name,
          e.qty,
          e.set,
          e.collectorNumber,
          e.finish === "etched"
            ? "etched"
            : e.finish === "foil"
              ? "true"
              : "false",
          e.language || "en",
          e.condition,
          e.location,
          e.printingId,
          e.purchasePrice ?? "",
          e.purchaseCurrency,
          !!e.signed,
          !!e.altered,
          !!e.misprint,
          !!e.proxy,
        ]
          .map(escape)
          .join(","),
      )
      .join("\n")
  );
}
export function migrateWorkspace(input) {
  if (!input || ![2, 3].includes(input.version))
    throw Error("Unsupported backup version.");
  const s = structuredClone(input);
  s.version = 3;
  if (s.references !== undefined && !Array.isArray(s.references))
    throw Error("Invalid reference library.");
  s.references = s.references || [];
  s.printings =
    s.printings && typeof s.printings === "object" ? s.printings : {};
  s.importHistory = Array.isArray(s.importHistory) ? s.importHistory : [];
  s.settings = { shipping: 4.99, tax: 0, budget: 25, ...s.settings };
  // Yu-Gi-Oh! and Pokémon live beside Magic in the same workspace.
  s.tcg = s.tcg && typeof s.tcg === "object" ? s.tcg : {};
  for (const g of ["ygo", "ptcg"]) {
    const x = s.tcg[g] && typeof s.tcg[g] === "object" ? s.tcg[g] : {};
    s.tcg[g] = {
      collection: Array.isArray(x.collection) ? x.collection.filter((e) => e && typeof e.cardId === "string" && Number.isInteger(e.qty) && e.qty > 0) : [],
      decks: Array.isArray(x.decks) ? x.decks.filter((d) => d && typeof d.id === "string").map((d) => ({ ...d, zones: { main: d.zones?.main || [], extra: d.zones?.extra || [], side: d.zones?.side || [] } })) : [],
      wishlist: Array.isArray(x.wishlist) ? x.wishlist : [],
    };
  }
  s.collection = (s.collection || []).map((e) => ({
    ...e,
    language: e.language || "en",
    printingVerified: !!e.printingVerified,
    raw: e.raw || {},
  }));
  return s;
}
export function validateWorkspace(input) {
  const s = migrateWorkspace(input);
  for (const name of ["collection", "decks", "wishlist", "notes"])
    if (!Array.isArray(s[name])) throw Error("Invalid " + name + " in backup.");
  if (s.collection.length > 50000 || s.decks.length > 500)
    throw Error("Backup exceeds workspace limits.");
  const ids = new Set();
  for (const e of s.collection) {
    if (typeof e.id !== "string" || !e.id || ids.has(e.id))
      throw Error("Collection entry IDs must be unique.");
    ids.add(e.id);
    if (
      typeof e.name !== "string" ||
      !e.name ||
      !Number.isInteger(e.qty) ||
      e.qty < 1 ||
      e.qty > 100000
    )
      throw Error("Invalid card quantity or name.");
    if (!["nonfoil", "foil", "etched"].includes(e.finish))
      throw Error("Invalid card finish.");
    if (
      !Number.isInteger(e.reserved || 0) ||
      (e.reserved || 0) < 0 ||
      (e.reserved || 0) > e.qty
    )
      throw Error("Invalid reserved quantity.");
  }
  if (s.references.length > 500)
    throw Error("Reference library exceeds 500 decks.");
  for (const d of s.references) {
    if (
      typeof d.id !== "string" ||
      typeof d.name !== "string" ||
      !Array.isArray(d.cards) ||
      !isFormatName(d.format)
    )
      throw Error("Invalid reference deck.");
    for (const c of d.cards)
      if (
        typeof c.name !== "string" ||
        !Number.isInteger(c.qty) ||
        c.qty < 1 ||
        c.qty > 100000
      )
        throw Error("Invalid reference card.");
  }
  const did = new Set();
  for (const d of s.decks) {
    if (
      typeof d.id !== "string" ||
      !d.id ||
      did.has(d.id) ||
      typeof d.name !== "string" ||
      !Array.isArray(d.cards) ||
      !isFormatName(d.format)
    )
      throw Error("Invalid deck record.");
    did.add(d.id);
    for (const c of d.cards)
      if (
        typeof c.name !== "string" ||
        !c.name ||
        !Number.isInteger(c.qty) ||
        c.qty < 1 ||
        c.qty > 100000
      )
        throw Error("Invalid deck card.");
  }
  for (const w of s.wishlist)
    if (
      typeof w.name !== "string" ||
      !Number.isInteger(w.qty) ||
      w.qty < 1 ||
      w.qty > 100000
    )
      throw Error("Invalid wishlist entry.");
  for (const field of ["shipping", "tax", "budget"])
    if (
      !Number.isFinite(Number(s.settings[field])) ||
      Number(s.settings[field]) < 0
    )
      throw Error("Invalid settings.");
  if (Number(s.settings.tax) > 100) throw Error("Invalid tax setting.");
  s.activeDeck = did.has(s.activeDeck) ? s.activeDeck : s.decks[0]?.id || null;
  return s;
}
export function pricingObservation(item, catalog, choices = {}) {
  const selected = choices[cardKey(item.name)],
    card = catalog[cardKey(item.name)],
    amount = selected?.price ?? cardPrice(card, item.finish || "nonfoil"),
    date = selected?.checkedAt || card?.checkedAt || null;
  return {
    amount: amount === null || amount === undefined ? null : Number(amount),
    provider: "Scryfall",
    currency: "USD",
    kind: "Reference market estimate",
    finish: selected?.finish || item.finish || "nonfoil",
    printing:
      selected?.label ||
      (card
        ? `${card.set?.toUpperCase() || "?"} ${card.collector_number || ""}`
        : "Unverified reference"),
    printingId: selected?.id || card?.id || null,
    date,
    stale: !date || Date.now() - new Date(date).getTime() > 7 * 86400000,
    selected: !!selected,
  };
}
export function backupEnvelope(state) {
  return {
    ...structuredClone(state),
    version: 3,
    exportedAt: new Date().toISOString(),
    backupKind: "cardforge-workspace",
    schemaVersion: 3,
  };
}
export function deckRowsFromImport(rows) {
  return aggregateCards(rows.map((e) => ({ name: e.name, qty: e.qty })));
}
