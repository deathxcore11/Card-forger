// Small, original SVG emblems for Yu-Gi-Oh! attributes, Levels/Ranks/Link,
// Spell/Trap properties and Pokémon Energy types, plus set/rarity badges.
// Drawn here (not copied from card art) so they stay crisp at any size.
import { esc } from "./ui.js";

const svg = (body, cls, label) => `<svg class="emb ${cls}" viewBox="0 0 24 24" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${body}</svg>`;
const disc = (fill, inner, ring = "rgba(0,0,0,.35)") => `<circle cx="12" cy="12" r="11" fill="${fill}" stroke="${ring}" stroke-width="1"/>${inner}`;

/* ---------- Yu-Gi-Oh! ---------- */

const ATTR = {
  DARK: ["#5b2a86", `<path d="M15.5 6.5a6.5 6.5 0 1 0 0 11 5.2 5.2 0 0 1 0-11z" fill="#e9d8ff"/>`],
  LIGHT: ["#d4a514", `<circle cx="12" cy="12" r="3.6" fill="#fff8d6"/><g stroke="#fff8d6" stroke-width="1.6" stroke-linecap="round"><path d="M12 4v2.4M12 17.6V20M4 12h2.4M17.6 12H20M6.3 6.3l1.7 1.7M16 16l1.7 1.7M6.3 17.7 8 16M16 8l1.7-1.7"/></g>`],
  EARTH: ["#7a5a2e", `<path d="M4.5 17 10 8l3.2 5 2-3L19.5 17z" fill="#f2dfc0"/>`],
  WATER: ["#1f6fc2", `<path d="M12 5c3 4 5 6.4 5 9a5 5 0 0 1-10 0c0-2.6 2-5 5-9z" fill="#d6ecff"/>`],
  FIRE: ["#c8361c", `<path d="M12 4.5c1 3 4.5 4.6 4.5 8.6A4.5 4.5 0 0 1 7.5 13c0-1.8.9-3 2-3.8 0 1.4.6 2.3 1.6 2.6-.5-2.3.1-5.2.9-7.3z" fill="#ffe0c2"/>`],
  WIND: ["#2f8f4e", `<path d="M5 9.5h9a2.5 2.5 0 1 0-2.4-3.2M5 13h12a2.6 2.6 0 1 1-2.5 3.3M5 16.5h6" fill="none" stroke="#dcffe6" stroke-width="1.7" stroke-linecap="round"/>`],
  DIVINE: ["#b8892a", `<path d="M12 4.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.8l5-.7z" fill="#fff3cf"/>`],
};
export const ygoAttribute = (a) => (ATTR[a] ? svg(disc(ATTR[a][0], ATTR[a][1]), "attr", a + " attribute") : "");

const PROP = {
  Continuous: `<circle cx="9" cy="12" r="3.2" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="15" cy="12" r="3.2" fill="none" stroke="#fff" stroke-width="1.8"/>`,
  "Quick-Play": `<path d="M13 4 6.5 13.5H11l-1 6.5 6.5-9.5H12z" fill="#fff"/>`,
  Equip: `<path d="M12 6v12M6 12h12" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  Field: `<path d="M4.5 16.5 9 10l3 4 2.2-2.6 5.3 5.1z" fill="#fff"/>`,
  Ritual: `<path d="M12 5c1.2 2.6 4 3.8 4 7a4 4 0 0 1-8 0c0-3.2 2.8-4.4 4-7z" fill="#fff"/>`,
  Counter: `<path d="M17 9.5A5.5 5.5 0 1 0 17.5 14" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M14.5 6.5 18 9.7l-3.8 1.2z" fill="#fff"/>`,
};
// Spell (teal) and Trap (magenta) frame colors with the property glyph.
export function ygoProperty(category, race) {
  if (category !== "Spell" && category !== "Trap") return "";
  const color = category === "Spell" ? "#1b8f7f" : "#b0306f",
    glyph = PROP[race] || `<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="sans-serif">${category === "Spell" ? "魔" : "罠"}</text>`;
  return svg(disc(color, glyph), "prop", `${race || "Normal"} ${category}`);
}

const STAR = (fill) => `<svg class="emb star" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${fill}"/><path d="M12 5.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L12 15.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" fill="#ffd34d"/></svg>`;
// Level (red stars), Rank (black stars) or Link rating, shown compactly as "★ 7".
export function ygoLevel(c) {
  if (c?.category !== "Monster") return "";
  if (/link/i.test(c.frame)) return `<span class="lvl" aria-label="Link ${esc(c.level)}"><span class="link-mark">LINK</span>${esc(c.level ?? "?")}</span>`;
  if (c.level === null || c.level === undefined) return "";
  const rank = /xyz/i.test(c.frame);
  return `<span class="lvl" aria-label="${rank ? "Rank" : "Level"} ${esc(c.level)}">${STAR(rank ? "#1a1a1a" : "#c4301f")}${esc(c.level)}</span>`;
}

// Everything that sits beside a Yu-Gi-Oh! card's name.
export function ygoEmblems(c) {
  if (!c) return "";
  if (c.category === "Monster") return `<span class="emblems">${ygoLevel(c)}${ygoAttribute(c.attribute)}</span>`;
  return `<span class="emblems">${ygoProperty(c.category, c.race)}</span>`;
}

/* ---------- Pokémon ---------- */

const ENERGY = {
  Grass: ["#3f9d3a", `<path d="M12 4.5c4.5 2.2 6 6 4.4 10.4-1.2 3-4.2 4.6-7.4 4.1C7.5 13.5 8.6 8 12 4.5z" fill="#e6ffd9"/><path d="M9 19c1.5-4 3-7 5.5-10" stroke="#3f9d3a" stroke-width="1.2" fill="none"/>`],
  Fire: ["#e0431d", ATTR.FIRE[1]],
  Water: ["#2b80d8", ATTR.WATER[1]],
  Lightning: ["#f2c218", `<path d="M13.5 3.5 6.8 13.2h4.4L10 20.5l7.2-10.2h-4.4z" fill="#3b2c00"/>`],
  Psychic: ["#8f45b5", `<path d="M3.8 12c2.4-3.6 5.2-5.3 8.2-5.3s5.8 1.7 8.2 5.3c-2.4 3.6-5.2 5.3-8.2 5.3S6.2 15.6 3.8 12z" fill="#f2dcff"/><circle cx="12" cy="12" r="2.6" fill="#8f45b5"/>`],
  Fighting: ["#b4612a", `<path d="M7.5 10.5V8.3a1.3 1.3 0 0 1 2.6 0V7.6a1.3 1.3 0 0 1 2.6 0v.3a1.3 1.3 0 0 1 2.6 0v.6a1.3 1.3 0 0 1 2.6 0v4.8c0 3-2 5.2-5 5.2h-.6c-2.3 0-3.7-1-4.8-2.9l-1.2-2.1a1.3 1.3 0 0 1 2.2-1.3z" fill="#ffe5d0"/>`],
  Darkness: ["#2d2a3a", `<path d="M15 5.5a6.7 6.7 0 1 0 0 13 5.4 5.4 0 0 1 0-13z" fill="#d7d2f0"/>`],
  Metal: ["#7d8794", `<path d="M12 4.5 18.5 8v8L12 19.5 5.5 16V8z" fill="none" stroke="#f2f5f8" stroke-width="2"/><circle cx="12" cy="12" r="2.4" fill="#f2f5f8"/>`],
  Dragon: ["#a6862a", `<path d="M6 17c0-6 3.5-10.5 9-11.5-1.6 2-2 3.6-1.3 5 1.6-.7 3.2-.8 4.8.2-3.4 1-5.3 3.4-6 6.3z" fill="#fff1c7"/>`],
  Fairy: ["#e15ea6", `<path d="M12 4.5l1.7 4.5 4.8.2-3.8 3 1.3 4.6L12 14.1l-4 2.7 1.3-4.6-3.8-3 4.8-.2z" fill="#ffe2f1"/>`],
  Colorless: ["#e8e8e8", `<path d="M12 5.5l1.6 4.6 4.9.1-3.9 2.9 1.4 4.7L12 15l-4 2.8 1.4-4.7-3.9-2.9 4.9-.1z" fill="#8a8a8a"/>`],
};
export const energyIcon = (t, cls = "") => (ENERGY[t] ? svg(disc(ENERGY[t][0], ENERGY[t][1], "rgba(0,0,0,.25)"), "energy " + cls, t + " Energy") : `<span class="energy-txt">${esc(t)}</span>`);
export const ENERGY_TYPES = Object.keys(ENERGY);

// Attack text "[Fire · Colorless] Burning Darkness" → energy icons + name.
export function attackLine(costs) {
  return `<span class="costs">${(costs || []).map((t) => energyIcon(t, "sm")).join("")}</span>`;
}

// Pokémon rarity marks as printed on cards.
const PK_RARITY = [
  [/^Common$/i, "●", ""],
  [/^Uncommon$/i, "◆", ""],
  [/ACE SPEC/i, "★", "ace"],
  [/Special illustration/i, "★★", "gold"],
  [/Illustration rare/i, "★", "gold"],
  [/Hyper|Secret|Mega Hyper/i, "★★★", "gold"],
  [/Ultra|Double rare|Holo Rare V|VMAX|VSTAR/i, "★★", ""],
  [/Shiny/i, "★", "shiny"],
  [/Promo/i, "PR", ""],
  [/Rare/i, "★", ""],
];
const pkRarityMark = (r) => {
  const hit = PK_RARITY.find(([re]) => re.test(r));
  return hit ? `<span class="rar ${hit[2]}" title="${esc(r)}">${hit[1]}</span>` : "";
};

/* ---------- Pokémon set & rarity symbols (images from pokesymbols.com) ---------- */
// Served through the site's Worker (cached 30 days); falls back to pokesymbols.com directly,
// then to the drawn mark, so a missing or brand-new symbol never leaves a broken image.
const slugify = (x) =>
  String(x || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
// TCGdex set ids whose symbol file isn't simply the set's name ("" = the set has no symbol).
const PK_SET_SLUG = {"basep": "_promo", "wp": "_promo", "ecard1": "expedition", "ex1": "ruby-and-sapphire-fixed", "ex6": "firered-leafgreen", "np": "_promo", "pop1": "pop-1", "pop2": "pop-2", "pop3": "pop-3", "pop4": "pop-4", "pop5": "pop-5", "pop6": "pop-6", "pop7": "pop-7", "pop8": "pop-8", "pop9": "pop-9", "tk-dp-m": "diamond-and-pearl-trainer-kit-manaphy", "tk-dp-l": "diamond-and-pearl-trainer-kit-lucario", "tk-hs-g": "heartgold-and-soulsilver-trainer-kit-gyarados", "tk-hs-r": "heartgold-and-soulsilver-trainer-kit-raichu", "tk-bw-z": "black-and-white-trainer-kit-zoroark", "tk-bw-e": "black-and-white-trainer-kit-excadrill", "tk-xy-p": "xy-trainer-kit-libre-pikachu", "tk-sm-l": "sun-and-moon-trainer-kit-lycanroc", "tk-sm-r": "sun-and-moon-trainer-kit-raichu", "dpp": "_promo", "hgssp": "_promo", "bwp": "_promo", "2011bw": "mcdonalds-collection-2011", "2012bw": "mcdonalds-collection-2012", "2014xy": "mcdonalds-collection-2014", "2015xy": "mcdonalds-collection-2015", "2016xy": "mcdonalds-collection-2016", "2017sm": "mcdonalds-collection-2017", "2018sm": "mcdonalds-collection-2018", "2019sm": "mcdonalds-collection-2019", "2021swsh": "mcdonalds-collection-2021", "2022swsh": "mcdonalds-collection-2022", "2023sv": "mcdonalds-collection-2023", "2024sv": "mcdonalds-collection-dragon-discovery-2024", "xyp": "_promo", "xy2": "xy-flashfire", "g1": "xy-generations", "xy10": "xy-fates-collide", "xy11": "xy-steam-siege", "xy12": "xy-evolutions", "smp": "_promo", "swshp": "_promo", "fut2020": "fustal-promos", "swsh3.5": "champions-path", "swsh4.5sv": "shining-fates", "cel25cc": "celebrations", "swsh9tg": "brilliant-stars", "swsh10tg": "astral-radiance", "swsh11tg": "lost-origin", "swsh12tg": "silver-tempest", "swsh12.5gg": "crown-zenith", "svp": "_promo", "sve": "scarlet-and-violet-energies", "mep": "_promo", "base1": ""};
const symImg = (kind, slug, label, fallback, cls) =>
  `<img class="${cls}" src="img/pks/${kind}/${slug}.png" data-direct="https://pokesymbols.com/images/tcg/${kind === "s" ? "sets/symbols" : "rarities"}/${slug}.png" data-fb="${esc(fallback)}" alt="${esc(label)}" title="${esc(label)}" loading="lazy" decoding="async" onerror="if(!this.dataset.f){this.dataset.f=1;this.src=this.dataset.direct}else{this.outerHTML=this.dataset.fb}">`;
export function pkSetSymbol(set, cls = "pks") {
  if (!set?.id) return "";
  const slug = set.id in PK_SET_SLUG ? PK_SET_SLUG[set.id] : slugify(set.name);
  // Last resort: TCGdex's own symbol (its symbol files 404 today, but this picks them up if they return).
  const tcgdex = set.symbol ? `<img class="${cls}" src="${esc(/\.(?:png|webp|jpe?g)(?:\?|$)/i.test(set.symbol)?set.symbol:set.symbol+".png")}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return slug ? symImg("s", slug, set.name || "", tcgdex, cls) : tcgdex;
}
// Catalogue-only sources. Reuse the card-symbol identity mapping above, not a
// logo or a neighboring release. Keep the established card/detail renderer intact.
export function pkCatalogueSymbolSources(set) {
  if (!set?.id || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(String(set.id))) return [];
  const mapped = Object.hasOwn(PK_SET_SLUG, set.id), slug = mapped ? PK_SET_SLUG[set.id] : slugify(set.name);
  // The original Base Set has no expansion symbol. Its real code is the fallback.
  if (mapped && !slug) return [];
  const sources = /^[a-z0-9_-]{1,80}$/.test(slug) ? [`img/pks/s/${slug}.png`, `https://pokesymbols.com/images/tcg/sets/symbols/${slug}.png`] : [];
  // Only accept an actual symbol endpoint from the existing image providers.
  // No executable/data URL, credentials, arbitrary host, logo or injected HTML.
  try {
    const url = new URL(set.symbol);
    const symbolPath = url.hostname === 'images.pokemontcg.io' ? /^\/[a-z0-9._-]+\/symbol\.(?:png|webp|jpe?g)$/i.test(url.pathname)
      : url.hostname === 'assets.tcgdex.net' ? /^\/[a-z0-9._/-]+\/symbol(?:\.(?:png|webp|jpe?g))?$/i.test(url.pathname)
      : url.hostname === 'images.scrydex.com' && /^\/pokemon\/[a-z0-9._-]+-symbol\/symbol(?:\.(?:png|webp|jpe?g))?$/i.test(url.pathname);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && symbolPath) {
      if (url.hostname === 'assets.tcgdex.net' && url.pathname.endsWith('/symbol')) url.pathname += '.webp';
      sources.push(url.href);
    }
  } catch { /* Missing or invalid provider symbols leave a real set-code tile. */ }
  return [...new Set(sources)];
}
const PK_RARITY_SLUG = { "rare holo": "rare", "holo rare": "rare" };
const PK_RARITY_FILES = new Set(["ace-spec-rare", "black-white-rare", "common", "double-rare", "hyper-rare", "illustration-rare", "mega-attack-rare", "mega-hyper-rare", "rare", "shiny-rare", "shiny-ultra-rare", "special-illustration-rare", "ultra-rare", "uncommon"]);
export function pkRarity(r) {
  if (!r) return "";
  const slug = PK_RARITY_SLUG[r.toLowerCase()] || slugify(r);
  // Common/Uncommon/Rare marks are black ink; they get recolored for the dark theme (see .pkr.ink).
  return PK_RARITY_FILES.has(slug) ? symImg("r", slug, r, pkRarityMark(r), /^(common|uncommon|rare)$/.test(slug) ? "pkr ink" : "pkr") : pkRarityMark(r);
}

/* ---------- set badges ---------- */

const YGO_RARITY_CODE = [
  [/Quarter Century/i, "QCR"], [/Starlight/i, "StR"], [/Ghost/i, "GR"], [/Collector/i, "CR"], [/Prismatic Secret/i, "PScR"], [/Platinum Secret/i, "PlScR"],
  [/Ultimate/i, "UtR"], [/Secret/i, "ScR"], [/Ultra/i, "UR"], [/Super/i, "SR"], [/Gold/i, "GUR"], [/Short Print/i, "SP"], [/Rare/i, "R"], [/Common/i, "C"],
];
export const ygoRarityCode = (r) => (YGO_RARITY_CODE.find(([re]) => re.test(r || "")) || [, ""])[1];
// The foil the card name is printed in at each rarity, for foil-lettered rarity codes.
export const YGO_RARITY_KIND = {QCR:'quarter',StR:'starlight',GR:'ghost',CR:'collector',PScR:'prismatic',PlScR:'platinum',UtR:'ultimate',ScR:'secret',UR:'ultra',GUR:'gold',SR:'super',R:'rare'};
const rarityCode = (code) => code ? `<small class="rx-code rx-${YGO_RARITY_KIND[code] || 'common'}">${esc(code)}</small>` : "";
const rarityTone = (code) => (/ScR|QCR|StR|GR|CR|UtR|PScR|PlScR/.test(code) ? "secret" : /UR|GUR/.test(code) ? "ultra" : /SR/.test(code) ? "super" : /^R$/.test(code) ? "rare" : "common");

// One small badge: set code + rarity, colored by rarity.
// compact: symbols only (for the small search tiles); the full badge adds the set code and number.
export function tcgSetBadge(c, compact = false) {
  if (!c) return "";
  if (c.game === "ptcg") {
    const code = c.setCode || (c.set?.id || "").toUpperCase(),
      sym = pkSetSymbol(c.set);
    if (compact && sym) return `<span class="tset" title="${esc(c.set?.name || "")} #${esc(c.set?.number || "")}${c.rarity ? " · " + esc(c.rarity) : ""}">${sym}${pkRarity(c.rarity)}</span>`;
    return code ? `<span class="tset" title="${esc(c.set?.name || "")}${c.rarity ? " · " + esc(c.rarity) : ""}">${sym}${pkRarity(c.rarity)}<b>${esc(code)}</b>${c.set?.number ? `<small>${esc(c.set.number)}</small>` : ""}</span>` : "";
  }
  const context=c.setContext;
  const s=context?(context.printing||(!context.printingAmbiguous&&context.printings?.length===1?context.printings[0]:null)):c.sets?.[0];
  if(context&&!s)return `<span class="tset" title="${esc(context.name||'Selected release')} · ${context.status==='resolved'?'printing not selected':'release unverified'} · edition unspecified"><b>${esc(context.code||'Unverified')}</b></span>`;
  if (!s) return "";
  const code = ygoRarityCode(s.rarity);
  return `<span class="tset ${rarityTone(code)}" title="${esc(s.name)} · ${esc(s.rarity || "")}"><b>${esc(String(s.code).split("-")[0])}</b>${rarityCode(code)}</span>`;
}
export const ygoPrintBadge = (s) => {
  const code = ygoRarityCode(s.rarity);
  return `<span class="tset ${rarityTone(code)}"><b>${esc(String(s.code))}</b>${rarityCode(code)}</span>`;
};
