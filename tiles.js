// One layout for the little emblems on card tiles, the same in all three games:
//   top-left     — what the card is: Magic color identity, Pokémon energy type, Yu-Gi-Oh! level + attribute
//   bottom-left  — where it's from: set symbol (or set code) colored by rarity
//   bottom-right — how much it matters for deck building (importance seal, when it has one)
// At most three type icons, so tiles never get busy.
import { esc, sym, setIconUrl } from "./ui.js";
import { ygoEmblems, energyIcon, tcgSetBadge } from "./emblems.js";
import { tileEmblem } from "./importance.js";

const MTG_RARITY = { common: "Common", uncommon: "Uncommon", rare: "Rare", mythic: "Mythic", special: "Special", bonus: "Bonus" };

function typePart(game, c) {
  if (game === "mtg") {
    const id = c.color_identity?.length ? c.color_identity : ["C"];
    return `<span class="emblems">${id.slice(0, 3).map((v) => sym(v)).join("")}${id.length > 3 ? `<small class="more">+${id.length - 3}</small>` : ""}</span>`;
  }
  if (game === "ygo") return ygoEmblems(c);
  const types = c.types || [];
  return `<span class="emblems">${types.slice(0, 2).map((t) => energyIcon(t)).join("")}${types.length > 2 ? `<small class="more">+${types.length - 2}</small>` : ""}</span>`;
}

function setPart(game, c) {
  if (game === "mtg") {
    if (!c.set) return "";
    const r = c.rarity || "common";
    return `<span class="tset mtg" title="${esc(c.set_name || String(c.set).toUpperCase())} · ${esc(MTG_RARITY[r] || r)}"><span class="set-icon r-${esc(r)}" style="--icon:url('${esc(setIconUrl(c.set))}');width:15px;height:15px" aria-hidden="true"></span></span>`;
  }
  return tcgSetBadge(c, true);
}

export function tileChrome(game, c, {setBadge} = {}) {
  if (!c || c.brief) return "";
  const set = setBadge === undefined ? setPart(game, c) : setBadge;
  return `<span class="tile-chrome ${esc(game)}" aria-hidden="true"><span class="tile-emb">${typePart(game, c)}</span>${set ? `<span class="tile-set">${set}</span>` : ""}${tileEmblem(game, c)}</span>`;
}
