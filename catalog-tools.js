export function searchQuery(
  name,
  { color = "", type = "", format = "", maxPrice = "" } = {},
) {
  const parts = ["game:paper"];
  if (name.trim()) parts.push(name.trim());
  if (color) parts.push("id<=" + color);
  if (type) parts.push("t:" + type);
  if (format) parts.push("legal:" + format);
  if (
    maxPrice !== "" &&
    Number.isFinite(Number(maxPrice)) &&
    Number(maxPrice) >= 0
  )
    parts.push("usd<=" + Number(maxPrice));
  return parts.join(" ");
}
export function scanNames(text) {
  const ignore =
    /^(?:creature|legendary|artifact|enchantment|instant|sorcery|land|planeswalker|battle|token|flying|haste|trample|vigilance|copyright|illustration|wizards|the gathering)\b/i;
  return [
    ...new Set(
      String(text)
        .split(/\r?\n/)
        .map((s) =>
          s
            .replace(/\{[^}]*\}/g, "")
            .replace(/[|©®™]/g, " ")
            .replace(/\s+[0-9][0-9\s]*$/, "")
            .replace(/^[^A-Za-z]+/, "")
            .replace(/[^A-Za-z0-9 ,.'’\-]/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(
          (s) =>
            s.length >= 4 &&
            s.length <= 65 &&
            /[a-z]/i.test(s) &&
            !ignore.test(s),
        ),
    ),
  ].slice(0, 5);
}
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
