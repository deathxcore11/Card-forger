/**
 * Pure, best-effort Play deck import. No card database, browser, or network access.
 *
 * parsePlayDeckImport(text, { parseDeckImport }) accepts the existing shared
 * parser as an optional synchronous callback. Text is normalized before that
 * callback; CSV keeps its columns/fields. A small fallback makes text/CSV usable
 * without the callback. Neither path verifies names, format legality, or partners.
 *
 * Result: cards[] includes main-deck cards AND declared commanders; side[] is
 * separate. commanders[] contains every explicit {name, qty} declaration, and
 * commander is the first name for older callers. rows[] retains section and
 * original line information. excludedCards[]/excluded retain maybeboard entries.
 * unresolved[] contains all unverified names, ready for a later card resolver.
 * errors[] and warnings[] contain {line, code, reason, raw}; input/row-size
 * failures are fatal, while invalid card rows are rejected individually. No
 * quantity is clamped. Callers must display errors before confirming an import.
 */
export const PLAY_DECK_IMPORT_LIMITS = Object.freeze({
  inputChars: 250000,
  rows: 2000,
  lineChars: 2000,
  quantity: 1000,
  copies: 10000,
});

const key = (value) => String(value).normalize("NFKC")
  .replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const sum = (rows) => rows.reduce((total, row) => total + row.qty, 0);
const problem = (line, code, reason, raw, fatal = false) => ({
  line, code, reason, raw: Array.isArray(raw) ? raw : [raw], ...(fatal ? { fatal } : {}),
});
const zones = new Map([
  ["commander", "commander"], ["commanders", "commander"],
  ["deck", "main"], ["decklist", "main"], ["mainboard", "main"],
  ["main board", "main"], ["main deck", "main"], ["maindeck", "main"],
  ["sideboard", "side"], ["side board", "side"],
  ["companion", "side"], ["companions", "side"],
  ["maybeboard", "excluded"], ["maybe board", "excluded"], ["considering", "excluded"],
]);
const categories = new Map([
  ["creature", "Creatures"], ["creatures", "Creatures"],
  ["artifact", "Artifacts"], ["artifacts", "Artifacts"],
  ["instant", "Instants"], ["instants", "Instants"],
  ["sorcery", "Sorceries"], ["sorceries", "Sorceries"],
  ["enchantment", "Enchantments"], ["enchantments", "Enchantments"],
  ["land", "Lands"], ["lands", "Lands"],
  ["planeswalker", "Planeswalkers"], ["planeswalkers", "Planeswalkers"],
  ["battle", "Battles"], ["battles", "Battles"],
]);
const zoneHeading = { main: "Deck", commander: "Commander", side: "Sideboard", excluded: "Maybeboard" };

function heading(raw) {
  let value = raw.trim().replace(/^(?:#{1,6}\s*|\/\/\s*)/, "")
    .replace(/\*\*|__/g, "").trim().replace(/:\s*$/, "").trim();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1).trim();
  const match = value.match(/^(.+?)(?:\s*[:—–-]?\s*(?:\((\d+)(?:\s+cards?)?\)|\[(\d+)\]|(\d+)(?:\s+cards?)?))?\s*:?$/i);
  if (!match) return null;
  const label = key(match[1].replace(/^\[|\]$/g, "").trim());
  if (!zones.has(label) && !categories.has(label)) return null;
  const count = match[2] ?? match[3] ?? match[4];
  return { label, section: zones.get(label), category: categories.get(label),
    declared: count === undefined ? null : Number(count) };
}

function aggregate(rows) {
  const result = new Map();
  for (const row of rows) {
    const id = key(row.name);
    if (result.has(id)) result.get(id).qty += row.qty;
    else result.set(id, { name: row.name, qty: row.qty });
  }
  return [...result.values()];
}

function empty() {
  return { source: "Play deck text", rows: [], cards: [], side: [], commanders: [],
    commander: "", excludedCards: [], excluded: 0, unresolved: [], errors: [], warnings: [],
    mapping: {}, total: 0, sideTotal: 0, categoryCounts: {}, categories: [],
    counts: { main: 0, commanders: 0, side: 0, excluded: 0, all: 0 }, normalizedText: "" };
}

function cardText(raw) {
  let value = raw.trim(), qty = 1;
  if (/^\d+\s*[xX]?\s*$/.test(value)) return { error: "Missing card name" };
  if (/^(?:[+-]\d|\.\d|\d+\.(?:\d|\s|$)|\d+[eE][+-]?\d)/.test(value))
    return { error: "Quantity must be a positive whole number" };
  // Also accepts compact clipboard forms such as 1Sol Ring, 1xSol Ring, 1 xSol Ring.
  const quantity = value.match(/^(\d+)(?:\s*[xX]\s*|\s+|(?=[^\d\s]))(.+)$/);
  if (quantity) {
    qty = Number(quantity[1]);
    value = quantity[2].trim();
  } else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:\s*[xX])?(?:\s+|$)/i.test(value)) {
    return { error: "Quantity must be a positive whole number" };
  }
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > PLAY_DECK_IMPORT_LIMITS.quantity)
    return { error: `Quantity must be between 1 and ${PLAY_DECK_IMPORT_LIMITS.quantity}` };
  value = value.replace(/\s+\[[^\]\r\n]+\]\s*$/, "").trim();
  const finish = /\s+\*F\*\s*$/i.test(value) ? "foil" : "nonfoil";
  value = value.replace(/\s+\*F\*\s*$/i, "").trim();
  const printing = value.match(/^(.*?)\s+\(([a-z0-9]{2,10})\)\s+([a-z0-9][a-z0-9/★-]*)$/i);
  if (printing) value = printing[1].trim();
  if (!value) return { error: "Missing card name" };
  return { name: value, qty, set: printing?.[2] || "", collectorNumber: printing?.[3] || "", finish };
}

function addRow(rows, candidate, result, raw) {
  if (!candidate.name || !Number.isSafeInteger(candidate.qty) || candidate.qty < 1 ||
      candidate.qty > PLAY_DECK_IMPORT_LIMITS.quantity) {
    result.errors.push(problem(candidate.line, "invalid_quantity", "Invalid card name or quantity", raw));
    return false;
  }
  if (sum(rows) + candidate.qty > PLAY_DECK_IMPORT_LIMITS.copies) {
    result.errors.push(problem(candidate.line, "copy_limit", `Import exceeds ${PLAY_DECK_IMPORT_LIMITS.copies} copies`, raw));
    return false;
  }
  const inSameDeck = (row) => (row.section === "commander" ? "main" : row.section) ===
    (candidate.section === "commander" ? "main" : candidate.section);
  const copies = rows.filter((row) => inSameDeck(row) && key(row.name) === key(candidate.name))
    .reduce((total, row) => total + row.qty, candidate.qty);
  if (copies > PLAY_DECK_IMPORT_LIMITS.quantity) {
    result.errors.push(problem(candidate.line, "card_copy_limit", `Combined quantity for ${candidate.name} exceeds ${PLAY_DECK_IMPORT_LIMITS.quantity}`, raw));
    return false;
  }
  rows.push({ ...candidate, nameVerified: false });
  return true;
}

function parseText(raw, result) {
  let section = "main", activeCategory = null, block = 0, hadBlank = false, explicitZone = false;
  const rows = [], normalized = [];
  for (const [index, original] of raw.split("\n").entries()) {
    const line = index + 1, value = original.trim().replace(/^[-*]\s+/, "");
    if (!value) { normalized.push(""); hadBlank = rows.length > 0; continue; }
    if (hadBlank) { block++; hadBlank = false; }
    const title = heading(value);
    if (title) {
      if (title.section) { section = title.section; activeCategory = null; explicitZone = true; normalized.push(zoneHeading[section]); }
      if (title.category) {
        // Site exports commonly put card-type categories immediately after the
        // commander block. Categories inside a side/maybeboard stay there.
        if (section === "commander") { section = "main"; normalized.push(zoneHeading.main); }
        activeCategory = { name: title.category, section, line, declaredCount: title.declared, actualCount: 0 };
        result.categories.push(activeCategory);
      }
      if (title.declared !== null && (!Number.isSafeInteger(title.declared) || title.declared > PLAY_DECK_IMPORT_LIMITS.copies))
        result.warnings.push(problem(line, "invalid_header_count", "Header count is outside import limits", original));
      continue;
    }
    if (/^(?:https?:\/\/|www\.)\S+$/i.test(value) || /^(?:#|\/\/)/.test(value) ||
        /^(?:name|deck name|title|author|created by|by|format|description|deck url|url|source|exported(?: from| at| on)?|updated(?: at| on)?|last updated|total(?: cards)?|price|estimated (?:price|value)|budget|views|likes|favorites|tags)\s*:/i.test(value) ||
        /^(?:copy (?:deck|decklist|to clipboard)|export(?: deck| decklist)?|download decklist)$/i.test(value)) {
      result.warnings.push(problem(line, "ignored_metadata", "Ignored deck metadata or comment", original));
      continue;
    }
    const prefix = value.match(/^(SB|commander|commanders|companion)\s*:\s*(.*)$/i);
    const rowSection = prefix ? (/^command/i.test(prefix[1]) ? "commander" : "side") : section;
    if (prefix) explicitZone = true;
    const parsed = cardText(prefix ? prefix[2] : value);
    if (parsed.error) { result.errors.push(problem(line, "invalid_card_row", parsed.error, original)); continue; }
    const entry = { ...parsed, section: rowSection, line, block,
      category: !prefix && activeCategory ? activeCategory.name : null, raw: { text: original } };
    if (!addRow(rows, entry, result, original)) continue;
    if (!prefix && activeCategory) activeCategory.actualCount += entry.qty;
    if (prefix) normalized.push(zoneHeading[rowSection]);
    normalized.push(`${entry.qty} ${entry.name}${entry.set ? ` (${entry.set}) ${entry.collectorNumber}` : ""}${entry.finish === "foil" ? " *F*" : ""}`);
    if (prefix) normalized.push(zoneHeading[section]);
  }
  // Same narrow MTGO rule as parseDeckImport: two blocks, >=40 main copies,
  // then 1..15 side copies, with no explicit zone declaration. Preserve blanks
  // in normalizedText so an injected parser can apply its own existing rule.
  const groups = [...new Set(rows.map((row) => row.block))];
  if (!explicitZone && groups.length === 2 && sum(rows.filter((row) => row.block === groups[0])) >= 40) {
    const last = rows.filter((row) => row.block === groups[1]);
    if (sum(last) > 0 && sum(last) <= 15) for (const row of last) row.section = "side";
  }
  result.normalizedText = normalized.join("\n").trim();
  return rows;
}

function csvRecords(text) {
  const records = []; let cells = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const value = text[index];
    if (value === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (value === "," && !quoted) { cells.push(cell); cell = ""; }
    else if (value === "\n" && !quoted) {
      cells.push(cell); if (cells.some((value) => value.trim())) records.push(cells);
      cells = []; cell = "";
    } else cell += value;
  }
  if (quoted) throw Error("The CSV has an unclosed quoted field.");
  cells.push(cell); if (cells.some((value) => value.trim())) records.push(cells);
  return records;
}

function parseCSV(raw, result, sharedParser) {
  let records;
  try { records = csvRecords(raw); }
  catch (error) { result.errors.push(problem(0, "invalid_csv", error.message, "", true)); return []; }
  const headers = records[0] || [], labels = headers.map(key);
  const nameIndex = labels.findIndex((value) => ["name", "card name", "card"].includes(value));
  const qtyIndex = labels.findIndex((value) => ["quantity", "qty", "count"].includes(value));
  const zoneIndex = labels.findIndex((value) => ["board", "section", "zone"].includes(value));
  const rows = [], accepted = [headers], sourceLines = [1];
  for (const [index, cells] of records.slice(1).entries()) {
    const line = index + 2, name = (cells[nameIndex] || "").trim();
    const token = qtyIndex < 0 || !(cells[qtyIndex] || "").trim() ? "1" : cells[qtyIndex].trim();
    if (!/^\d+$/.test(token || "") || !name) {
      result.errors.push(problem(line, "invalid_card_row", name ? "Quantity must be a positive whole number" : "Missing card name", cells));
      continue;
    }
    const zone = zoneIndex < 0 ? "" : key(cells[zoneIndex] || "");
    if (zone && !zones.has(zone)) result.warnings.push(problem(line, "unknown_csv_section", `Unrecognized CSV section ${cells[zoneIndex]}; retained in main deck for review`, cells));
    if (addRow(rows, { name, qty: Number(token), section: zones.get(zone) || "main", line, raw: Object.fromEntries(headers.map((header, i) => [header, cells[i] || ""])) }, result, cells)) {
      accepted.push(cells); sourceLines.push(line);
    }
  }
  result.source = "Deck CSV";
  const quote = (value) => '"' + String(value).replace(/"/g, '""') + '"';
  // The shared parser recognizes Name/Card name; preserve every other column.
  const safeHeaders = headers.map((value, index) => index === nameIndex && labels[index] === "card" ? "Name" : value);
  result.normalizedText = [safeHeaders, ...accepted.slice(1)].map((cells) => cells.map(quote).join(",")).join("\n");
  if (!sharedParser || !rows.length) return rows;
  try {
    const parsed = sharedParser(result.normalizedText);
    if (!parsed || !Array.isArray(parsed.rows)) throw Error("Shared parser did not return rows");
    const delegated = [];
    for (const row of parsed.rows) {
      const line = sourceLines[row.line - 1] || row.line || 0;
      const original = rows.find((entry) => entry.line === line);
      addRow(delegated, { ...row, section: original?.section || "main", line }, result, row.raw || []);
    }
    result.source = parsed.source || result.source;
    result.mapping = parsed.mapping || {};
    for (const error of parsed.errors || []) result.errors.push({ ...error, line: sourceLines[error.line - 1] || error.line, code: error.code || "shared_parser_row" });
    return delegated;
  } catch (error) {
    result.warnings.push(problem(0, "shared_parser_unavailable", `Used basic CSV parsing: ${error.message}`, ""));
    return rows;
  }
}

export function parsePlayDeckImport(text, { parseDeckImport: sharedParser } = {}) {
  const result = empty();
  if (sharedParser !== undefined && typeof sharedParser !== "function") throw TypeError("parseDeckImport must be a function");
  if (typeof text !== "string") { result.errors.push(problem(0, "invalid_input", "Paste deck text or CSV", "", true)); return result; }
  if (text.length > PLAY_DECK_IMPORT_LIMITS.inputChars) {
    result.errors.push(problem(0, "input_limit", `Input exceeds ${PLAY_DECK_IMPORT_LIMITS.inputChars} characters`, "", true)); return result;
  }
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const lines = raw.split("\n");
  if (lines.length > PLAY_DECK_IMPORT_LIMITS.rows || lines.some((line) => line.length > PLAY_DECK_IMPORT_LIMITS.lineChars)) {
    result.errors.push(problem(0, "row_limit", `Input exceeds ${PLAY_DECK_IMPORT_LIMITS.rows} lines or ${PLAY_DECK_IMPORT_LIMITS.lineChars} characters per line`, "", true)); return result;
  }
  const csv = /(?:^|,)\s*"?(?:name|card name|card)"?\s*(?:,|$)/i.test(lines.find((line) => line.trim()) || "");
  const rows = csv ? parseCSV(raw, result, sharedParser) : parseText(raw, result);
  if (!csv && sharedParser && rows.length) {
    try {
      const parsed = sharedParser(result.normalizedText);
      if (!parsed || !Array.isArray(parsed.cards)) throw Error("Shared parser did not return cards");
      result.source = parsed.source || result.source;
      result.mapping = parsed.mapping || {};
      for (const error of parsed.errors || []) result.warnings.push({ ...error, code: "shared_parser_row", reason: `Retained for review: ${error.reason || "unrecognized row"}` });
      // The adapter retains all rows. The shared parser enriches known text
      // formats, but cannot silently discard a name that needs later resolution.
      for (const entry of rows) {
        const detail = parsed.rows?.find((row) => key(row.name) === key(entry.name));
        if (detail) for (const [field, value] of Object.entries(detail)) {
          if (!Object.hasOwn(entry, field)) entry[field] = value;
        }
      }
    } catch (error) { result.warnings.push(problem(0, "shared_parser_unavailable", `Used basic deck parsing: ${error.message}`, "")); }
  }
  result.rows = rows.map(({ block, ...row }) => row);
  result.cards = aggregate(rows.filter((row) => row.section === "main" || row.section === "commander"));
  result.side = aggregate(rows.filter((row) => row.section === "side"));
  result.commanders = aggregate(rows.filter((row) => row.section === "commander"));
  result.commander = result.commanders[0]?.name || "";
  result.excludedCards = aggregate(rows.filter((row) => row.section === "excluded"));
  result.excluded = sum(result.excludedCards);
  result.total = sum(result.cards); result.sideTotal = sum(result.side);
  result.counts = { main: sum(rows.filter((row) => row.section === "main")), commanders: sum(result.commanders), side: result.sideTotal, excluded: result.excluded, all: sum(rows) };
  result.unresolved = rows.map(({ name, qty, section, line }) => ({ name, qty, section, line }));
  for (const row of rows) if (row.category) result.categoryCounts[row.category] = (result.categoryCounts[row.category] || 0) + row.qty;
  for (const category of result.categories) if (category.declaredCount !== null && category.declaredCount !== category.actualCount)
    result.warnings.push(problem(category.line, "category_count_mismatch", `${category.name} header says ${category.declaredCount}; imported ${category.actualCount}`, ""));
  if (result.commanders.length > 1) result.warnings.push(problem(0, "multiple_commanders", "Multiple commanders were declared; verify their pairing and format before playing", ""));
  if (result.excluded) result.warnings.push(problem(0, "excluded_cards", `${result.excluded} maybeboard/considering copies were kept separate`, ""));
  if (!rows.length && !result.errors.length) result.errors.push(problem(0, "empty_deck", "No card rows found", ""));
  return result;
}
