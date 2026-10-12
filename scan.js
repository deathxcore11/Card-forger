// What a card photo's text says, per game. The phone reads the text (Tesseract, offline);
// these turn that text into things worth looking up — exact-printing codes first, names second.

const clean = (s) =>
  s
    // The Pokémon "ex" logo often reads as @X / €X / eX.
    .replace(/\s*[@€©]\s*X\b|\s*\beX\b/g, " ex")
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
        .map((s) => (g === "ptcg" ? s.replace(/\bHP\s*\d+.*$/i, "") : s))
        .map(clean)
        .filter((s) => s.length >= 3 && s.length <= 60 && /[a-z]/i.test(s) && !ignore.test(s) && (s.match(/[A-Za-z]/g) || []).length >= 3),
    ),
  ].slice(0, 5);
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
    set = t.match(/\b([A-Z0-9]{3,5})\s*[•·*.+°-]\s*(?:EN|ES|FR|DE|IT|PT|JA|JP)\b/)?.[1] || "";
  return num && set ? { set: set.toLowerCase(), number: num } : null;
}
