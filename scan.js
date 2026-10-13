// What a card photo's text says, per game. The phone reads the text (Tesseract, offline);
// these turn that text into things worth looking up — exact-printing codes first, names second.

const clean = (s) =>
  s
    // The Pokémon "ex" logo often reads as @X / €X / eX.
    .replace(/\s*[@€©]\s*[X?x×]?(?![A-Za-z])|\s*\beX\b/g, " ex")
    .replace(/\{[^}]*\}/g, "")
    .replace(/[|©®™]/g, " ")
    .replace(/\s+[0-9][0-9\s]*$/, "")
    .replace(/^[^A-Za-z]+/, "")
    .replace(/[^A-Za-z0-9 ,.'’\-&!]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+[0-9][0-9\s]*$/, "")
    .trim()
    // Stray one- or two-letter fragments after the name (glare, set symbols): "DARK MAGICIAN HE".
    .replace(/(\s+[A-Za-z]{1,2})+$/, (m) => (/\s(ex|EX|GX|V)$/.test(m) ? m : ""))
    .trim();

const IGNORE = {
  mtg: /^(?:creature|legendary|artifact|enchantment|instant|sorcery|land|planeswalker|battle|token|flying|haste|trample|vigilance|copyright|illustration|illus|wizards|the gathering)\b/i,
  ygo: /^(?:effect|normal|ritual|fusion|synchro|xyz|link|pendulum|tuner|flip|spell card|trap card|quick-play|continuous|equip|field|counter|atk|def|level|rank|konami|limited edition|1st edition|this card|you can|once per turn|when|if|during|target|special summon|send|spellcaster|dragon|warrior|machine|fiend|zombie|beast|fairy|aqua|pyro|rock|plant|insect|thunder|reptile|psychic|wyrm|cyberse|dinosaur|winged beast|sea serpent|beast-warrior|divine-beast|illusion|fish)\b/i,
  ptcg: /^(?:basic|stage ?[12]|evolves|weakness|resistance|retreat|illus|pokemon|pokémon|trainer|item|supporter|stadium|tool|energy|ability|rule|ex rule|vstar|vmax|hp|nintendo|creatures|game freak|put|search|attach|discard|draw|flip|this attack|your opponent|once during)\b/i,
};

export function scanNamesFor(g, text) {
  const ignore = IGNORE[g] || IGNORE.mtg;
  return [
    ...new Set(
      String(text)
        .split(/\r?\n/)
        .map((s) => (g === "ptcg" ? s.replace(/^\s*(?:BASIC|STAGE\s*[12])\s+/i, "").replace(/\bHP\s*\d+.*$/i, "") : s))
        // Keep suffixes (ex/GX/V) but remove mixed digit/text OCR fragments
        // before a title: "snce1 Eldegoss". Do not strip legitimate words.
        .map((s) => s.replace(/^(?:\s*[A-Za-z]*\d+[A-Za-z]*\s+)+(?=[A-Za-z])/g, ""))
        .map(clean)
        .filter((s) => s.length >= 3 && s.length <= 60 && /[a-z]/i.test(s) && !ignore.test(s) && (s.match(/[A-Za-z]/g) || []).length >= 3),
    ),
  ].slice(0, 5);
}

// Quality feedback is a capture aid, never a claim that a card was identified.
// All four guide edges must have contrast. Interior detail, exposure and
// multiple stable frames are checked separately by the camera controller.
export function guideQuality({ data, width, height }, box) {
  const gray = (x, y) => {
    const i = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  const { x, y, w, h } = box;
  const edge = (horizontal, at, start, length) => {
    let hits = 0;
    for (let k = 1; k <= 20; k++) {
      const p = Math.round(start + length * k / 21);
      let best = 0;
      for (let d = -5; d <= 5; d++) {
        const a = horizontal ? gray(p, at + d - 2) : gray(at + d - 2, p);
        const b = horizontal ? gray(p, at + d + 2) : gray(at + d + 2, p);
        best = Math.max(best, Math.abs(a - b));
      }
      if (best > 20) hits++;
    }
    return hits / 20;
  };
  const edges = [edge(true, y, x, w), edge(true, y + h, x, w), edge(false, x, y, h), edge(false, x + w, y, h)];
  let detail = 0, exposure = 0, bright = 0, count = 0;
  for (let yy = y + 8; yy < y + h - 8; yy += 3) for (let xx = x + 8; xx < x + w - 8; xx += 3) {
    const v = gray(xx, yy);
    exposure += v; bright += v > 248 ? 1 : 0;
    detail += Math.abs(v - gray(xx + 1, yy)) + Math.abs(v - gray(xx, yy + 1)); count++;
  }
  if (!count) return { state: "red", text: "Move the whole card inside the guide." };
  if (Math.min(...edges) < 0.55) return { state: "red", text: "Align all four card edges with the guide. Use a contrasting background." };
  if (exposure / count < 40) return { state: "amber", text: "More light needed." };
  if (bright / count > 0.18) return { state: "amber", text: "Bright areas detected. Check for glare." };
  if (detail / count < 7) return { state: "amber", text: "Move closer or wait for focus." };
  return { state: "green", text: "Image checks passed. Confirm the card after capture." };
}

// Yu-Gi-Oh! set codes: LOB-EN001, MP23-EN125, RA03-EN016 (OCR often reads O for 0 in the number).
export function ygoSetCodes(text) {
  const out = [];
  for (const m of String(text).toUpperCase().matchAll(/\b([A-Z0-9]{2,4})\s?-\s?([A-Z]{1,2})?\s?([0-9OIL]{3})\b/g)) {
    const num = m[3].replace(/O/g, "0").replace(/[IL]/g, "1");
    if (!/^\d{3}$/.test(num) || !/[A-Z]/.test(m[1])) continue;
    out.push(`${m[1]}-${m[2] || "EN"}${num}`);
  }
  return [...new Set(out)].slice(0, 3);
}
// The 8-digit passcode printed bottom-left identifies the card itself.
export const ygoPasscodes = (text) => [...new Set([...String(text).matchAll(/(?<!\d)(\d{8})(?!\d)/g)].map((m) => String(Number(m[1]))))].slice(0, 2);

// Pokémon collector number: 053/128, 4/102, SV123 → { num, total }.
export function ptcgNumbers(text) {
  const out = [];
  for (const m of String(text).matchAll(/(?<![\d/])(\d{1,3})\s?\/\s?(\d{2,3})(?![\d/])/g)) if (Number(m[1]) > 0 && Number(m[2]) >= 10) out.push({ num: m[1], total: m[2] });
  // The small slash often reads as 7, 1 or l: "0537128" → 053/128.
  if (!out.length) for (const m of String(text).matchAll(/(?<!\d)(\d{3})[71l|I](\d{3})(?!\d)/g)) if (Number(m[1]) > 0 && Number(m[2]) >= 10) out.push({ num: m[1], total: m[2] });
  return out.slice(0, 3);
}

// Magic: collector number and set code from the bottom line ("0123/0281 R" … "FDN • EN").
export function mtgCollector(text) {
  const t = String(text).toUpperCase(),
    num = t.match(/(?<![\d/])0*(\d{1,4})\s?\/\s?\d{2,4}(?![\d/])/)?.[1] || t.match(/\b[CURMLST]\s+0*(\d{1,4})\b/)?.[1] || "",
    // The dot between set code and language reads as almost anything ("M21 + EN", "M21 « EN", "M21 EN").
    set = t.match(/\b([A-Z0-9]{3,5})\s*[^A-Z0-9\s]{0,2}\s*(?:EN|ES|FR|DE|IT|PT|JA|JP)\b/)?.[1] || "";
  return num && set ? { set: set.toLowerCase(), number: num } : null;
}

// Plausible card names in a noisy name strip, best first: the cleaned line, then the line without
// junk tokens (anything with digits or symbols, "snce1"), then shorter runs of real words.
// The matcher tries them in order instead of searching the whole OCR string.
export function nameCandidates(g, text, max = 6) {
  const out = [],
    push = (s) => {
      s = s.replace(/\s+/g, " ").trim();
      if (s.length >= 3 && (s.match(/[A-Za-z]/g) || []).length >= 3 && !out.includes(s)) out.push(s);
    };
  for (const name of scanNamesFor(g, text)) {
    const tokens = name.split(" "),
      words = tokens.filter((w) => /^[A-Za-z][A-Za-z'’,.\-&!]*$/.test(w) && (w.length > 2 || /^(of|the|a|an|to|in|on|ex|EX|GX|V)$/i.test(w)));
    // Junk-free first when the line had junk; the raw line is only a fallback.
    if (words.length < tokens.length) push(words.join(" "));
    push(name);
    // Drop a leading/trailing fragment at a time ("Ase Eldegoss Hk" → "Eldegoss").
    for (let n = words.length - 1; n >= 1; n--) for (let i = 0; i + n <= words.length; i++) push(words.slice(i, i + n).join(" "));
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

// How alike two names are, 0–1 (letters only, case-insensitive), for ranking near-miss reads.
export function similarity(a, b) {
  const x = String(a).toLowerCase().replace(/[^a-z0-9]/g, ""),
    y = String(b).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!x || !y) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}
// A forgiving search pattern for a misread name: the first letters of each word ("DAR MACICTAN" → "DAR MAC").
export const prefixQuery = (name, n = 3) =>
  String(name)
    .split(/\s+/)
    .filter((w) => /[a-z]{2}/i.test(w))
    .slice(0, 3)
    .map((w) => w.slice(0, n))
    .join(" ");
// Automatic recognition must not turn a substring search into identification.
// Ignore punctuation/spacing, but preserve GX/ex/V and other meaningful words.
export const scanNameKey = name => String(name || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function scanCandidateMatches(card, name, numbers = []) {
  if (!card || scanNameKey(card.name) !== scanNameKey(name)) return false;
  if (!numbers.length) return true;
  return numbers.some(n => Number(card.set?.number) === Number(n.num) && Number(card.set?.total) === Number(n.total));
}
