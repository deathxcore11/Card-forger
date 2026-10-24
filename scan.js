// What a card photo's text says, per game. The phone reads the text (Tesseract, offline);
// these turn that text into things worth looking up — exact-printing codes first, names second.
import {pokemonPrintedName,pokemonIdentityNames} from './pokemon-identity.js';

// Structural labels are alternate title readings, not permission to discard words.
// Keep the original too: e.g. Energy Stadium is itself a real card name.
export const pokemonTitleLabel = value => /^(?:TRAINER|SUPPORTER|ITEM|STADIUM|POK[EÉ]MON TOOL|TOOL|ENERGY|POK[EÉ]MON|WEAKNESS|RESISTANCE|RETREAT|ABILITY)\W*$/i.test(String(value||'').trim());
export function pokemonTitleReadings(value) {
  const raw=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const withoutTrainer=raw.replace(/^TRAINER\s+/i,'').trim();
  const withoutType=withoutTrainer!==raw?withoutTrainer.replace(/^(?:SUPPORTER|ITEM|STADIUM|POKEMON TOOL)\s+/i,'').trim():withoutTrainer;
  const stripTail=s=>s.replace(/\s+(?:SUPPORTER|ITEM|STADIUM|POKEMON TOOL)$/i,'').trim();
  return [...new Set([stripTail(withoutTrainer),withoutTrainer,stripTail(withoutType),withoutType,raw])].filter(Boolean);
}
// A one/two-letter OCR fragment is not generally a title. Only these known
// Trainer names may enter lookup, and only alongside one independent number.
export function shortTrainerNames(read={}) {
  const ids=[...new Set([String(read.code||''),String(read.full||'')].flatMap(ptcgNumbers).map(n=>ptcgIdentifierKey(n.num,n.total)))].filter(Boolean);
  if(ids.length!==1)return [];
  return [...new Set(String(read.name||read.full||'').split(/\r?\n/).flatMap(pokemonTitleReadings).filter(n=>/^(?:N|AZ)$/.test(n)))];
}
export function scanLookupNames(game,read={}) {
  return [...new Set([...(game==='ptcg'?shortTrainerNames(read):[]),...nameCandidates(game,read.name||read.full||'')])];
}

const clean = (s) =>
  s
    // Suffix glued on with a misread hyphen: "MewtwolGX" / "Mewtwo-GX" → "Mewtwo GX".
    .replace(/([a-z])[lI1|\-–]?(GX|EX|VMAX|VSTAR)\b/g, "$1 $2")
    .replace(/([a-z])[\-–|]V\b/g, "$1 V")
    // A border mark read as a capital stuck to the name: "JMewtwo" → "Mewtwo".
    .replace(/(^|\s)[A-Z](?=[A-Z][a-z]{2,})/g, "$1")
    // The Pokémon "ex" logo often reads as @X / €X / eX (a lone € or © is just noise).
    .replace(/\s*[@€©]\s*[X?x×](?![A-Za-z])|\s*@(?![A-Za-z])|\s*\beX\b/g, " ex")
    .replace(/\{[^}]*\}/g, "")
    .replace(/[|©®™]/g, " ")
    .replace(/^[^A-Za-z]+/, "")
    .replace(/[^A-Za-z0-9 ,.'’\-&!?]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+\d{5,}\s*$/, "")
    .trim()
    // Stray one- or two-letter fragments after the name (glare, set symbols): "DARK MAGICIAN HE".
    .replace(/(\s+[A-Za-z]{1,2})+$/, (m,_letters,_offset,whole) => (/^Unown [A-Z!?]$/i.test(whole)||/\s(ex|EX|GX|V|Up|UP|G|FB|C)$/.test(m) ? m : ""))
    .trim();

const IGNORE = {
  mtg: /^(?:creature|legendary|artifact|enchantment|instant|sorcery|land|planeswalker|battle|token|flying|haste|trample|vigilance|copyright|illustration|illus|wizards|the gathering)\b/i,
  ygo: /^(?:effect|normal|ritual|fusion|synchro|xyz|link|pendulum|tuner|flip|spell card|trap card|quick-play|continuous|equip|field|counter|atk|def|level|rank|konami|limited edition|1st edition|this card|you can|once per turn|when|if|during|target|special summon|send|spellcaster|dragon|warrior|machine|fiend|zombie|beast|fairy|aqua|pyro|rock|plant|insect|thunder|reptile|psychic|wyrm|cyberse|dinosaur|winged beast|sea serpent|beast-warrior|divine-beast|illusion|fish)\b/i,
  ptcg: /^(?:basic|stage ?[12]|evolves|illus|rule|ex rule|vstar|vmax|hp|nintendo|creatures|game freak|put|search|attach|discard|draw|flip|this attack|your opponent|once during)\b/i,
};

export function scanNamesFor(g, text) {
  const ignore = IGNORE[g] || IGNORE.mtg;
  return [
    ...new Set(
      String(text)
        .split(/\r?\n/)
        .map((s) => (g === "ptcg" ? s.replace(/^\s*(?:BASIC|STAGE\s*[12])\s+/i, "").replace(/\(?\bH\s?P(?![A-Za-z]).*$/i, "") : s))
        // Keep suffixes (ex/GX/V) but remove mixed digit/text OCR fragments
        // before a title: "snce1 Eldegoss". Do not strip legitimate words.
        .map((s) => s.replace(/^(?:\s*[A-Za-z]*\d+[A-Za-z]*\s+)+(?=[A-Za-z])/g, ""))
        .flatMap(s=>g==="ptcg"?pokemonTitleReadings(s):[s])
        .map(clean)
        .filter((s) => s.length >= 3 && s.length <= 60 && /[a-z]/i.test(s) && !ignore.test(s) && !(g==="ptcg"&&pokemonTitleLabel(s)) && (s.match(/[A-Za-z]/g) || []).length >= 3),
    ),
  ].slice(0, 5);
}

// Which game a card's text belongs to, from a whole-card read: the scanner set to Magic can still
// tell it is holding a Pokémon card. Returns "" when nothing is clear.
// [pattern, weight]: weight 2 is something only that game prints (an HP line, ATK/DEF, a type line).
const GAME_SIGNS = {
  ptcg: [[/\bH\s?P\s?\d{2,3}\b/i, 2], [/\bweakness\b/i, 2], [/\bresistance\b/i, 1], [/\bretreat\b/i, 2], [/\bevolves from\b/i, 2], [/\bstage\s?[12]\b/i, 1], [/\b(?:GX|VMAX|VSTAR)\b/, 2], [/pok[eé]mon/i, 1], [/\bTrainer\b/, 1], [/\bSupporter\b/, 1], [/\bdamage counters?\b/i, 1], [/\bEnergy\b/, 1]],
  ygo: [[/\bATK\s*[\/|l1]?\s*\d/i, 2], [/\bDEF\s*[\/|l1]?\s*\d/i, 2], [/effect monster|spell card|trap card/i, 2], [/\bspecial summon/i, 2], [{test:text=>ygoSetCodes(text).length>0}, 2], [/\bkonami\b|shu\w{0,3}sha|takahashi|t\w{0,2}okyo/i, 2], [/\bATK\b|\bDEF\b/, 1], [/\bonce per turn\b/i, 1], [/\b(?:Spellcaster|Warrior|Dragon|Fiend|Machine|Cyberse)\s*\//i, 2], [/\bgraveyard\b|\bGY\b/, 1]],
  mtg: [[/\b(?:Creature|Instant|Sorcery|Enchantment|Artifact|Planeswalker)\b/, 2], [/\bLegendary\b/, 1], [/wizards of the coast|\bTM\s*&|™\s*&/i, 2], [/\bbattlefield\b/i, 2], [/\bmana\b/i, 1], [/\b(?:flying|trample|haste|lifelink|deathtouch|vigilance|flash)\b/i, 1], [/\{T\}|\b(?:untap|tap)\b/i, 1], [/\billus\b/i, 1], [/\b[A-Z0-9]{3}\s*\W?\s*EN\b/, 1], [/\bAdd \{?[WUBRGC]\b/, 2]],
};
export function detectGame(text) {
  const t = String(text || "");
  const score = Object.fromEntries(Object.entries(GAME_SIGNS).map(([g, rs]) => [g, rs.reduce((n, [r, w]) => n + (r.test(t) ? w : 0), 0)]));
  const [best, second] = Object.entries(score).sort((a, b) => b[1] - a[1]);
  return best[1] >= 2 && best[1] >= second[1] + 2 ? best[0] : "";
}

// Name lines found by what sits beside them on a whole-card read: a Pokémon name sits right before
// "HP 190"; the line before a Magic type line is often the art, so only Pokémon has a sure anchor.
export function anchoredNames(g, full) {
  const out = [];
  for (const l of String(full || "").split(/\r?\n/)) {
    if (g === "ptcg") {
      // "HP 180", or HP misread ("Y.-180"): a name line ends in a round number from 30 to 340.
      const m = l.match(/^(.*?)\s*\(?\bH\s?P\s?\d{2,3}/i) || l.match(/^(.*?[A-Za-z]{3}.*?)\s+\S{0,4}?\b((?:[3-9]|[12]\d|3[0-4])0)\b\W{0,3}$/);
      if (m && /[a-z]{3}/i.test(m[1])) out.push(m[1].replace(/^\s*(?:BASIC|STAGE\s*[12])\s+/i, ""));
    }
  }
  return out.slice(0, 3);
}

// Phrases worth searching for when the name won't read: runs of real words from the rules,
// flavour or attack text ("The elves of the Llanowar forest" → "elves of the Llanowar").
// Longest runs first; words with digits or odd symbols break a run.
export function textPhrases(full, max = 6) {
  const runs = [];
  for (const line of String(full || "").split(/\r?\n/)) {
    let cur = [];
    const flush = () => {
      if (cur.length >= 3 && cur.filter((w) => w.length >= 4).length >= 2) runs.push(cur);
      cur = [];
    };
    for (const w of line.split(/\s+/)) {
      const t = w.replace(/^[^A-Za-z]+|[^A-Za-z'’]+$/g, "");
      if (/^[A-Za-z][a-z'’]*$|^[A-Z][A-Za-z'’]*$/.test(t) && t.length >= 2 && t === w.replace(/[.,;:!?”"“)(]+/g, "")) cur.push(t);
      else flush();
    }
    flush();
  }
  // Edge scraps ("Bl The elves…") go; then three-word windows, so one misread word ("Llanotwar")
  // spoils only the windows it's in. Windows with long words first (they say more).
  const wins = [];
  for (const r of runs.sort((a, b) => b.join(" ").length - a.join(" ").length).slice(0, 3)) {
    while (r.length && r[0].length <= 2 && !/^(a|an|to|of|in|on|at|by)$/i.test(r[0])) r.shift();
    while (r.length && r[r.length - 1].length <= 2) r.pop();
    for (let i = 0; i + 3 <= r.length; i++) wins.push(r.slice(i, i + 3).join(" "));
  }
  const weight = (w) => w.split(" ").reduce((n, x) => n + Math.max(0, x.length - 3), 0);
  return [...new Set(wins)].sort((a, b) => weight(b) - weight(a)).slice(0, max);
}

// Pokémon attack names: capitalised words before a damage number ("Super Psy Bolt 110").
export function attackNames(full) {
  const out = [];
  for (const m of String(full || "").matchAll(/((?:[A-Z][a-z'’]+[ -]){0,3}[A-Z][a-z'’]{2,})[^A-Za-z\n]{0,6}\d{2,3}\+?(?=\s|$)/g)) if (m[1].replace(/[^a-z]/gi, "").length >= 6) out.push(m[1].trim());
  return [...new Set(out)].slice(0, 4);
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

// Full printed identities include subset letters (LEHD-ENB38), special promos
// (PHSW-ENSP1), old DB numbers and tokens. A bare suffix is not a set code.
export function parseYgoSetCode(value) {
  const text=String(value||'').trim().toUpperCase();
  if(/^DB\d{1,2}$/.test(text))return text;
  const m=text.match(/^([A-Z0-9]{2,4})[ \t]*-[ \t]*((?:[A-Z]{1,2}[ \t]+)?[A-Z0-9?]{1,12})$/);
  if(!m)return '';
  const prefix=m[1],right=m[2].replace(/[ \t]/g,'');
  if(/^(?:ATK|DEF|HP|LINK|RANK|LV|LVL)$/.test(prefix))return '';
  // Year-named promos are real; ordinary dates and numeric ranges are not.
  if(!/[A-Z]/.test(prefix)&&!(/^20\d{2}$/.test(prefix)&&/^[A-Z]{2}\d[0-9OIL]{2}$/.test(right)))return '';
  // Preserve the literal token before considering OCR repair: ENI27, ENO34
  // and ENL02 contain real subset letters, not 127, 034 or 102.
  if(/^(?:[A-Z]{1,4}\d{1,3}[A-Z]?|\d{3}[A-Z]?|[A-Z]{2}TKN)$/.test(right))return `${prefix}-${right}`;
  // Only a numeric field that starts with a real digit is unambiguous enough
  // for this correction (EN0O1 -> EN001). Never rewrite a leading subset letter.
  const numeric=right.match(/^([A-Z]{0,2})(\d[0-9OIL]{2})$/);
  return numeric?`${prefix}-${numeric[1]}${numeric[2].replace(/O/g,'0').replace(/[IL]/g,'1')}`:'';
}
export function ygoCodeReadings(text) {
  const out=[];
  // Consume complete tokens, including unsupported characters such as the ??
  // placeholder. Never accept a valid-looking prefix of a longer identifier,
  // or join orphan pieces across OCR lines/observations.
  const tokens=String(text).toUpperCase().matchAll(/(?<![A-Z0-9_\/-])(?:[A-Z0-9]{2,4}[ \t]*-[ \t]*(?:[A-Z]{1,2}[ \t]+)?[A-Z0-9?]{1,12}|DB\d{1,2})(?![A-Z0-9_\/?*\-])/g);
  for(const [token] of tokens){const code=parseYgoSetCode(token);if(code){const raw=token.replace(/[ \t]/g,'');out.push({raw,code,corrected:raw!==code});}}
  return [...new Map(out.map(reading=>[reading.raw,reading])).values()];
}
// Candidate keys can contain an OCR repair. The original reading and correction
// flag above must survive in evidence; a repaired key never verifies a printing.
export const ygoSetCodes=text=>[...new Set(ygoCodeReadings(text).map(reading=>reading.code))];
// The 8-digit passcode printed bottom-left identifies the card itself.
export const ygoPasscodes = (text) => [...new Set([...String(text).matchAll(/(?<!\d)(\d{8})(?!\d)/g)].map((m) => String(Number(m[1]))))].slice(0, 2);

// Keep the entire printed token: SV038/SV122, TG03/TG30 and 24a/119
// must never become the unrelated numeric printings 38/122, 3/30 or 24/119.
export const scanCollectorKey = value => String(value ?? '').trim().toLowerCase().replace(/^([a-z]*)0+(?=\d)/, '$1');
export function ptcgIdentifierKey(num, total) {
  const number = scanCollectorKey(num), denominator = scanCollectorKey(total);
  const n = number.match(/^([a-z]*)(\d+)([a-z]?)$/), d = denominator.match(/^([a-z]*)(\d+)$/);
  if (!n || !d || (d[1] && d[1] !== n[1])) return '';
  return number + '/' + d[2];
}
export const ptcgNumberMatches = (card, observation) => {
  const observed = ptcgIdentifierKey(observation.num, observation.total);
  return !!observed && observed === ptcgIdentifierKey(card?.set?.number, card?.set?.total);
};
export function ptcgNumbers(text) {
  const out = [];
  const knownPrefix = /^(?:AR|BW|CC|DP|GG|H|HGSS|RC|RT|SH|SL|SM|SV|SWSH|TG|XY)\d/i;
  const fix = token => {
    if (knownPrefix.test(token) || /^\d+[a-z]$/i.test(token)) return token;
    return /^[0-9OIlLSBZ]+$/.test(token) ? token.replace(/[OIlLSBZ]/g,c=>({O:'0',I:'1',l:'1',L:'1',S:'5',B:'8',Z:'2'}[c])) : token;
  };
  for (const m of String(text).matchAll(/(?<![A-Za-z0-9/])([A-Za-z0-9]{1,12})[ \t]*[\/\\][ \t]*([A-Za-z0-9]{1,12})(?![A-Za-z0-9/])/g)) {
    if (!/\d/.test(m[1] + m[2])) continue;
    const num=fix(m[1]),total=fix(m[2]);
    // Preserve even a conflicting denominator suffix as an observation. It cannot
    // match a catalogue row, but must not disappear beside another valid reading.
    if (/^[A-Za-z]{0,5}\d{1,4}[A-Za-z]?$/.test(num) && /^[A-Za-z]{0,5}\d{1,4}[A-Za-z]?$/.test(total) && Number(num.match(/\d+/)[0])>0 && Number(total.match(/\d+/)[0])>=10) out.push({num,total});
  }
  // The small slash often reads as 7, 1 or l: "0537128" → 053/128.
  if (!out.length) for (const m of String(text).matchAll(/(?<![A-Za-z0-9])(\d{3})[71l|I](\d{3})(?![A-Za-z0-9])/g)) if (Number(m[1]) > 0 && Number(m[2]) >= 10) out.push({ num: m[1], total: m[2] });
  return [...new Map(out.map(n => [ptcgIdentifierKey(n.num,n.total) || scanCollectorKey(n.num)+'/'+scanCollectorKey(n.total),n])).values()];
}

// Magic footer observations must keep a number beside its own set/language line.
// OCR retries can disagree. Keep every distinct pair; never splice the first number
// in one read to an unrelated set elsewhere, or treat a majority as verification.
export function mtgIdentifierEvidence(...texts) {
  const observations = new Map();
  let identifierUncertain=false;
  const token = '(?:[A-Z0-9]{1,8}-)?[A-Z]{0,5}0*\\d{1,4}(?:[A-Z]|[★†][A-Z]?)?';
  const add = (set, number) => {
    const pair = { set: set.toLowerCase(), number: number.replace(/^0+(?=\d)/, '').toLowerCase() };
    observations.set(pair.set + ':' + pair.number, pair);
    // The footer font turns "11" into "n" and 0/1 into o/l/I ("0114" → "ON4",
    // "011/274" → "on/274"). Keep the reading as printed and add its digit form
    // beside it, marked uncertain: it can narrow printings, never confirm one.
    const digits = pair.number.replace(/n/g, '11').replace(/o/g, '0').replace(/[li|]/g, '1');
    if (digits !== pair.number && /[onli|]/.test(pair.number) && /^\d+$/.test(digits) && /\d/.test(pair.number)) {
      const repaired = { set: pair.set, number: digits.replace(/^0+(?=\d)/, '') };
      observations.set(repaired.set + ':' + repaired.number, repaired);
      identifierUncertain = true;
    }
  };
  for (const text of texts) {
    let pending = [], copyrightBridge = false,partialAfterSet=false;
    for (const line of String(text || '').toUpperCase().split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      // A complete alphanumeric collector token is indivisible: 123a is not 123.
      const fractions = [...line.matchAll(new RegExp('(?<![A-Z0-9/★†-])(' + token + ')[ \t]?/[ \t]?\\d{2,4}(?![A-Z0-9/★†-])', 'g'))];
      const marked = [...line.matchAll(new RegExp('\\b[CURMLST][ \t]+(' + token + ')(?![A-Z0-9/★†-])', 'g'))];
      const sets = [...line.matchAll(/\b([A-Z0-9]{3,5})(?:[ \t]+|[ \t]*[^A-Z0-9\s]{1,2}[ \t]*)(?:EN|ES|FR|DE|IT|PT|JA|JP)\b/g)];
      // Some physical footers print "077 M", not "M 077". Require the whole
      // segment beside its set/language marker (or a standalone footer line),
      // so a number in rules text or an edition line cannot become a collector.
      const starts=[0,...sets.map(s=>s.index+s[0].length)];
      const trailing=starts.flatMap((start,i)=>{
        const segment=line.slice(start,sets[i]?.index??line.length),unit='(?:'+token+'[ \\t]+[CURMLST]|[CURMLST][ \\t]+'+token+')';
        if(!new RegExp('^[ \\t]*'+unit+'(?:[ \\t]+'+unit+')*[ \\t]*$').test(segment))return [];
        // Repeated footers may be merged onto one OCR line. Keep every number
        // rather than letting a following rarity be mistaken for a new prefix.
        return [...segment.matchAll(new RegExp('(?<![A-Z0-9/★†-])('+token+')[ \\t]+[CURMLST](?![A-Z0-9])','g'))].map(m=>Object.assign([m[0],m[1]],{index:start+m.index}));
      });
      // On old footers the rarity follows the fraction, sometimes with OCR noise
      // ("162/274 R 2"). Prefer that fraction within its own footer, not over a
      // separate numbered footer that happens to share the same OCR line.
      const group = m => sets.findIndex(s => s.index >= m.index + m[0].length);
      const numbers = [...fractions, ...[...marked,...trailing].filter(m => !fractions.some(f => group(f) === group(m)))]
        .sort((a, b) => a.index - b.index).map(m => ({ value: m[1], start: m.index, end: m.index + m[0].length }));
      if (sets.length) {
        // A self-contained line may be set→number instead of number→set.
        // Establish that direction once, then keep every pair beside its own
        // marker. Reusing the forward loop here would shift numbers to the
        // next set and drop the last (possibly contradictory) printing.
        if(!pending.length&&numbers.length&&numbers[0].start>=sets[0].index+sets[0][0].length){
          for(const [i,set] of sets.entries()){
            const adjacent=numbers.filter(n=>n.start>=set.index+set[0].length&&n.end<=(sets[i+1]?.index??line.length));
            if(!adjacent.length)identifierUncertain=true;
            for(const n of adjacent)add(set[1],n.value);
          }
          pending=[];copyrightBridge=false;partialAfterSet=false;continue;
        }
        let afterSet = 0;
        for (const [i, set] of sets.entries()) {
          const nearby = numbers.filter(n => n.start >= afterSet && n.end <= set.index);
          const adjacent=nearby.length ? nearby : i === 0 ? pending : [];
          if(!adjacent.length&&(numbers.length||pending.length))identifierUncertain=true;
          for (const n of adjacent) add(set[1], n.value);
          afterSet = set.index + set[0].length;
        }
        pending = numbers.filter(n => n.start >= afterSet);
        partialAfterSet=pending.length>0;
        copyrightBridge = false;
      } else if (numbers.length) {
        if(partialAfterSet)identifierUncertain=true;
        pending = numbers;
        partialAfterSet=false;
        copyrightBridge = false;
      } else if (pending.length && !copyrightBridge && /^(?:©|\(C\))[ \t]*[A-Z][A-Z \t.]*$/.test(line)) {
        copyrightBridge = true;
      } else {
        if(partialAfterSet)identifierUncertain=true;
        pending = [];
        partialAfterSet=false;
        copyrightBridge = false;
      }
    }
    // A pending number after a set marker can be either a reversed footer or
    // the start of another forward footer. With no closing marker, retain the
    // supported suggestions but do not infer exactness from one orientation.
    if(partialAfterSet)identifierUncertain=true;
  }
  return {observations:[...observations.values()],identifierUncertain};
}
export function mtgCollectors(...texts){return mtgIdentifierEvidence(...texts).observations;}

// Existing exact-identifier consumers need one unambiguous tuple, not a winner.
export function mtgCollector(...texts) {
  const {observations,identifierUncertain} = mtgIdentifierEvidence(...texts);
  return !identifierUncertain&&observations.length === 1 ? observations[0] : null;
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
    // Preserve the intact title before generating lossy search alternatives.
    // Digits, Up and short form designations can be semantic card content.
    if(/^[a-z]{1,3} [A-Z]/.test(name))push(name.replace(/^[a-z]{1,3}\s+/,""));
    push(name);
    const tokens = name.split(" "),
      words = tokens.filter((w) => /^[A-Za-z][A-Za-z'’,.\-&!]*$/.test(w) && (w.length > 2 || /^(of|the|a|an|to|in|on|ex|EX|GX|V)$/i.test(w)));
    // Names are capitalised: lowercase scraps ("aac") around them are noise.
    const caps = words.filter((w, i) => /^[A-Z]/.test(w) || w.length > 3 || (i > 0 && /^(of|the|a|an|to|in|on|ex|and)$/.test(w)));
    if (caps.length && caps.length < words.length) push(caps.join(" "));
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
export const scanCardNameKey=(game,name)=>scanNameKey(game==='ptcg'?pokemonPrintedName(name):name);
export function scanCandidateMatches(card, name, numbers = []) {
  if (!card || !pokemonIdentityNames(card).some(n=>scanCardNameKey('ptcg',n)===scanCardNameKey('ptcg',name))) return false;
  if (!numbers.length) return true;
  return numbers.some(n => ptcgNumberMatches(card, n));
}
