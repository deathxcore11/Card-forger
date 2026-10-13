import { scanNamesFor } from "./scan.js";
export function searchQuery(
  name,
  { color = "", cardColor = "", type = "", format = "", maxPrice = "", rarity = "", mv = "", set = "" } = {},
) {
  const parts = ["game:paper"];
  if (name.trim()) parts.push(name.trim());
  if (color) parts.push("id<=" + color);
  // Card color (what's printed), separate from Commander color identity above.
  if (cardColor) parts.push(cardColor === "M" ? "c:m" : cardColor === "C" ? "c:c" : "c:" + cardColor.toLowerCase());
  if (type) parts.push("t:" + type);
  if (format) parts.push("legal:" + format);
  if (rarity) parts.push("r:" + rarity);
  if (mv !== "" && /^\d+\+?$/.test(mv)) parts.push(mv.endsWith("+") ? "mv>=" + parseInt(mv, 10) : "mv=" + mv);
  if (/^[a-z0-9]{2,6}$/i.test(set.trim())) parts.push("s:" + set.trim().toLowerCase());
  if (
    maxPrice !== "" &&
    Number.isFinite(Number(maxPrice)) &&
    Number(maxPrice) >= 0
  )
    parts.push("usd<=" + Number(maxPrice));
  return parts.join(" ");
}
export const scanNames = (text) => scanNamesFor("mtg", text);
export function cardLinks(card) {
  const name = encodeURIComponent(card.name);
  return [
    {
      label: "Scryfall · cards & printings",
      url: card.scryfall_uri || "https://scryfall.com/search?q=" + name,
    },
    {
      label: "Gatherer · official database",
      url:
        "https://gatherer.wizards.com/Pages/Search/Default.aspx?name=" +
        encodeURIComponent("+[" + card.name + "]"),
    },
    {
      label: "MTG Wiki · research",
      url: "https://mtg.wiki/page/Special:Search?search=" + name,
    },
    {
      label: "TCGplayer · seller listings",
      url:
        "https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=" +
        name,
    },
    {
      label: "Card Kingdom · seller listings",
      url:
        "https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=" +
        name,
    },
    {
      label: "EDHREC · Commander usage",
      url: "https://edhrec.com/route/?cc=" + name,
    },
  ];
}
