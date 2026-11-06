package dev.cardstashy.nativeplay.ui

import com.google.gson.JsonElement
import com.google.gson.JsonObject

// ---------------------------------------------------------------- the model (CollectionEngine.card, views.js cardSheet())

/** A tap target as the site drew it: its words, icon and data-* attributes (what the site's handler reads). */
class CardPress(val label: String, val icon: SiteSvg?, val act: String, val data: Map<String, String>, val href: String, val aria: String, val title: String,
                val ghost: Boolean, val small: Boolean, val link: Boolean, val on: Boolean, val disabled: Boolean, val chip: Boolean = false)

/** One piece of rules text: words (bold / italic), a mana symbol, or a rule word the site makes tappable (rule-dex.js ruleText). */
class CardRun(val t: String?, val bold: Boolean, val italic: Boolean, val sym: String?, val alt: String, val rule: String?)

class CardSym(val src: String, val alt: String)
class CardHead(val art: String, val title: String, val type: String, val owned: String?, val ownedAria: String, val mana: List<CardSym>, val back: Boolean,
               /** "pokemon": the art is the card picture cropped to its art window (artwork.js pokemonArtCrop). */
               val crop: String = "", val emblems: List<TcgEmblem> = emptyList())
class CardEmblem(val kind: String, val icon: SiteSvg?, val title: String, val line: String)
class CardSetProgress(val eyebrow: String, val label: String, val pct: String, val fill: Float, val caption: String, val track: Boolean = true)
class CardSetSummary(val code: String, val rarity: String, val icon: String, val iconTitle: String, val name: String, val go: Boolean, val line: String, val progress: CardSetProgress?,
                     /** Yu-Gi-Oh!'s pack picture (img.ygo-pack) or Pokémon's set symbol (img.pks), its addresses in turn; the line with its set badge or rarity mark; its press. */
                     val picture: List<String> = emptyList(), val pictureKind: String = "", val parts: List<TcgPart> = emptyList(), val press: CardPress? = null)
class CardBuy(val brand: String, val label: String, val href: String, val title: String)
class CardRef(val value: String, val label: String, val finish: String, val press: CardPress?)
class CardPrice(val buy: CardBuy?, val ref: CardRef?, val mine: CardPress?, val add: CardPress?, val note: String)
class CardFinishChip(val finish: String, val label: String, val on: Boolean, val swatch: String, val press: CardPress? = null)
class CardPrintRow(val i: Int, val src: String, val sources: List<String>, val name: String, val num: String, val aria: String, val on: Boolean,
                   /** A Yu-Gi-Oh! / Pokémon printing: the card it opens (data-act="tCard"). */
                   val press: CardPress? = null,
                   /** Its picture's price tier (data-tier) and colour (--tier), when it has one. */
                   val tierKey: String = "", val tier: String = "")
class CardNote(val text: String, val retry: CardPress?)
class CardPrintings(val title: String, val more: CardPress?, val rows: List<CardPrintRow>, val notes: List<CardNote>, val foot: String)
class CardFace(val eyebrow: String, val name: String, val mana: List<CardSym>, val type: String, val lines: List<List<CardRun>>, val flavorLabel: String, val flavor: String?,
               val pt: String, val artist: String?, val artistPress: CardPress?, val pk: PkText? = null)
class CardOwnedGroup(val lot: String, val label: String, val qty: Int, val steps: List<CardPress>, val details: CardPress?)
class CardDeckPanel(val title: String, val qty: Int, val steps: List<CardPress>, val remove: CardPress?)
class CardChipTag(val label: String, val role: String, val warn: Boolean)
class CardLegal(val level: String, val icon: SiteSvg?, val text: String, val deck: String)

/** One row of a Meta or Play guide block (whichever fields its kind uses). */
class CardItem(val name: String = "", val pct: String = "", val fill: Float = 0f, val why: String = "", val image: String = "", val score: String = "", val owned: Boolean = false,
               val level: String = "", val formats: String = "", val copies: String = "", val title: String = "", val line: String = "", val go: String = "",
               val label: String = "", val main: Boolean = false, val runs: List<CardRun> = emptyList(), val foot: String = "", val source: String = "", val press: CardPress? = null)

/** A block of the Meta or Play guide panel, in the order the site draws them (kind = the site's markup it came from). */
class CardBlock(val kind: String, val text: String = "", val sub: String = "", val runs: List<CardRun> = emptyList(), val items: List<CardItem> = emptyList(),
                val buttons: List<CardPress> = emptyList(), val muted: Boolean = false, val small: Boolean = false, val lead: Boolean = false, val head: String = "",
                val note: String = "", val blocks: List<CardBlock> = emptyList(), val cls: String = "")
class CardSection(val cls: String, val panel: Boolean, val hero: Boolean, val blocks: List<CardBlock>)

class CardOverview(val image: String, val sources: List<String>, val tier: String, val zoomSrc: String, val zoomHi: String, val zoomArt: String, val finishKey: String, val finishEffect: String,
                   val flip: CardPress?, val finishLabel: String, val finishes: List<CardFinishChip>, val finishFoot: String, val profile: CardPress?, val printings: CardPrintings?,
                   val discoverySummary: String, val discoveryText: String, val discovery: List<CardPress>, val faces: List<CardFace>, val loading: CardNote?, val rulesEntry: CardPress?,
                   val alertTitle: String, val alertLine: String, val alert: CardPress?, val own: String, val legal: CardLegal?, val deck: CardDeckPanel?, val chips: List<CardChipTag>,
                   val factLabel: String, val fact: String, val researchLabel: String, val research: List<CardPress>, val ownedAria: String, val owned: List<CardOwnedGroup>,
                   val main: List<CardPress>, val more: List<CardPress>,
                   /** Yu-Gi-Oh!'s printing and edition pickers over the card, and their note. */
                   val pickers: List<TcgPicker> = emptyList(), val pickersFoot: String = "",
                   /** A Yu-Gi-Oh! / Pokémon card's foil (finish-preview.js), the stat grid, the regulation mark's help, every fact. */
                   val tcgFinish: TcgFinish? = null, val stats: List<TcgStat> = emptyList(), val statHelp: Pair<String, List<CardRun>>? = null,
                   val facts: List<String> = emptyList(), val factNext: CardPress? = null,
                   /** Yu-Gi-Oh! / Pokémon: "Not in your collection" heads the collection and deck actions, muted. */
                   val ownInActions: Boolean = false, val ownMuted: Boolean = false)

// Prices (workbench-ui.js priceOverview, historyPanel; pricing-presentation.js sellerRows; views.js Market details).
class CardOpt(val value: String, val label: String, val on: Boolean)
/** A line's pieces: words (bold, a tone: ok / warn / bad) or a control. */
class CardInline(val t: String?, val bold: Boolean, val tone: String, val press: CardPress?)
class CardFresh(val text: String, val state: String, val title: String)
class CardPriceHero(val eyebrow: String, val value: String, val id: String, val rarity: String, val fresh: CardFresh?, val notes: List<String>, val pickers: List<TcgPicker> = emptyList())
class CardPriceCopy(val label: String, val title: String, val value: String, val note: String, val foot: String, val private: Boolean)
class CardRange(val range: String, val label: String, val on: Boolean)
/** One piece of the price history panel, in the order historyPanel draws them (kind = the markup it came from). */
class CardHistBlock(val kind: String, val text: String = "", val title: String = "", val value: String = "", val label: String = "", val key: String = "",
                    val options: List<CardOpt> = emptyList(), val ranges: List<CardRange> = emptyList(), val tone: String = "", val points: List<Pair<Float, Float>> = emptyList(),
                    val dots: Boolean = false, val items: List<String> = emptyList(), val runs: List<CardInline> = emptyList(), val press: CardPress? = null, val href: String = "",
                    val inspect: String? = null, val foots: List<String> = emptyList())
class CardHistory(val state: String, val source: String, val blocks: List<CardHistBlock>)
class CardSeller(val name: String, val scope: String, val provenance: String, val value: String, val unit: String, val action: String, val href: String, val aria: String)
class CardSellers(val title: String, val sub: String, val foot: String, val rows: List<CardSeller>, val empty: String)
class CardPriceRow(val label: String, val sub: String, val cells: List<String>)
class CardMarket(val summary: String, val sources: List<CardPress>, val cols: List<Pair<String, String>>, val rows: List<CardPriceRow>, val lines: List<Pair<Boolean, List<CardInline>>>,
                 /** Yu-Gi-Oh!'s "Every printing", priciest first. */
                 val printsHead: String = "", val prints: List<TcgPrint> = emptyList(), val printsFoot: String = "",
                 /** Yu-Gi-Oh! / Pokémon: each source's table with its name in the corner (Pokémon's TCGplayer and Cardmarket). */
                 val tables: List<CardPriceTable> = emptyList())
class CardPriceTable(val corner: String, val cols: List<Pair<String, String>>, val rows: List<CardPriceRow>)
class CardPrices(val hero: CardPriceHero?, val copies: List<CardPriceCopy>, val warning: Pair<String, String>?, val history: CardHistory?, val sellers: CardSellers?, val details: CardMarket?)

// Yu-Gi-Oh! and Pokémon (tcg.js tcgCardSheet): what only their sheets draw.
/** emblems.js gameEmblems: an orb (Attribute, property, energy), a Level / Rank star or Link rating with its number ([mark] LINK), or HP. */
class TcgEmblem(val icon: SiteSvg?, val label: String, val text: String, val mark: String, val hp: Boolean)
/** A piece of a line: words (bold), Yu-Gi-Oh!'s set badge, or a Pokémon rarity symbol (its addresses in turn). */
class TcgPart(val t: String?, val bold: Boolean, val tset: TcgSetBadge?, val img: List<String>, val alt: String, val ink: Boolean)
/** A labelled picker (Edition, Printing & rarity): [name] is its data-change. */
class TcgPicker(val title: String, val name: String, val aria: String, val options: List<CardOpt>)
class TcgStat(val label: String, val value: String, val wide: Boolean, val note: String, val tone: String)
/** Pokémon text in order: words, or an energy orb. */
class PkOrb(val t: String?, val icon: SiteSvg?, val label: String)
class PkAbility(val tag: String, val name: String, val runs: List<CardRun>)
class PkAttack(val costs: List<PkOrb>, val name: String, val damage: String, val runs: List<CardRun>)
class PkText(val evolvesLabel: String, val evolves: String?, val abilities: List<PkAbility>, val attacks: List<PkAttack>, val rules: List<List<CardRun>>, val strip: List<List<PkOrb>>)
class TcgPrint(val press: CardPress?, val thumb: String, val name: String, val tset: TcgSetBadge?, val line: String, val buyLabel: String, val buyHref: String, val buyAria: String,
               val refLabel: String, val quotes: List<Pair<String, String>>, val value: String)

/** views.js buySheet ("Buy this card", the Cards list's price): the card, the version priced (.price-version), its price blocks, actions, foot. */
class CardBuySheet(val title: String, val back: String, val thumb: String, val name: String, val setIcon: String, val setTitle: String, val setRarity: String, val setName: String,
              val line: String, val version: List<String>?, val prices: CardPrices?, val actions: List<CardPress>, val foot: String)

class CollectionCardModel(val name: String, val deck: String, val entry: String, val tab: String, val notice: String?, val loading: Boolean, val head: CardHead?, val tabs: List<CollTab>,
                          val emblems: List<CardEmblem>, val set: CardSetSummary?, val price: CardPrice?, val overview: CardOverview?, val meta: List<List<CardBlock>>, val metaFoot: String,
                          val guide: List<CardSection>, val shown: JsonObject?, val busy: Boolean, val glyphs: Map<String, SiteSvg>, val prices: CardPrices? = null,
                          val game: CardGame = CardGame.MTG, val id: String = "", val setId: String = "", val archetype: CardPress? = null,
                          val buy: CardBuySheet? = null, val jump: String = "", val toast: String = "") {
    companion object {
        private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
        private fun JsonObject.f(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asFloat ?: 0f
        private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        private fun JsonObject.arr(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray
        private fun JsonObject.objs(k: String) = arr(k)?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
        private fun svg(o: JsonObject?) = CollectionCardsModel.svg(o)

        fun press(o: JsonObject?): CardPress? = o?.let { p ->
            CardPress(p.s("label"), svg(p.o("icon")), p.s("act"), p.o("data")?.entrySet()?.associate { (k, v) -> k to (v.takeIf { it.isJsonPrimitive }?.asString ?: "") }.orEmpty(),
                p.s("href"), p.s("aria"), p.s("title"), p.b("ghost"), p.b("small"), p.b("link"), p.b("on"), p.b("disabled"), p.b("chip"))
        }
        private fun presses(a: List<JsonObject>) = a.mapNotNull(::press)
        fun runs(a: com.google.gson.JsonArray?): List<CardRun> = a?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }?.map { r ->
            // A rule word keeps its visible words in t and the rule dex key in rule.
            val rule = if (r.has("rule")) r.s("rule") else null
            CardRun(if (rule != null) r.s("label") else r.get("t")?.takeIf { it.isJsonPrimitive }?.asString, r.b("b"), r.b("i"),
                r.get("sym")?.takeIf { it.isJsonPrimitive }?.asString, r.s("alt"), rule)
        }.orEmpty()
        private fun syms(a: List<JsonObject>) = a.map { CardSym(it.s("src"), it.s("alt")) }
        private fun item(o: JsonObject) = CardItem(o.s("name"), o.s("pct"), o.f("fill"), o.s("why"), o.s("image"), o.s("score"), o.b("owned"), o.s("level"), o.s("formats"), o.s("copies"),
            o.s("title"), o.s("line"), o.s("go"), o.s("label"), o.b("main"), runs(o.arr("runs")), o.s("foot"), o.s("source"), press(o.o("press")))
        fun blocks(a: List<JsonObject>): List<CardBlock> = a.map { b ->
            val kind = b.s("kind")
            CardBlock(kind, b.s("text"), b.s("sub"), runs(b.arr("runs")),
                items = (b.objs("items").takeIf { kind != "buttons" } ?: emptyList()).map(::item) + b.objs("rows").map(::item),
                buttons = if (kind == "buttons") presses(b.objs("items")) else presses(b.objs("links")), muted = b.b("muted"), small = b.b("small"), lead = b.b("lead"), head = b.s("head"),
                note = b.s("note"), blocks = blocks(b.objs("blocks")), cls = b.s("cls"))
        }

        private fun opts(a: List<JsonObject>) = a.map { CardOpt(it.s("value"), it.s("label"), it.b("on")) }
        private fun inline(a: List<JsonObject>) = a.map { r -> CardInline(r.get("t")?.takeIf { it.isJsonPrimitive }?.asString, r.b("b"), r.s("tone"), press(r.o("press"))) }
        private fun histBlock(b: JsonObject): CardHistBlock {
            val about = b.o("inspect")
            // 'range' keeps its change (−7.9 %) in value; 'about' its inspector's label in inspect and its days in options.
            return CardHistBlock(b.s("kind"), b.s("text").ifBlank { b.s("summary") }, b.s("title"), b.s("value").ifBlank { b.o("change")?.s("text").orEmpty() }, b.s("label"), b.s("key"),
                opts(b.objs("options").ifEmpty { about?.objs("options").orEmpty() }), b.objs("items").takeIf { b.s("kind") == "ranges" }.orEmpty().map { CardRange(it.s("range"), it.s("label"), it.b("on")) },
                b.o("change")?.s("tone").orEmpty(), b.arr("points")?.mapNotNull { p -> p.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asFloat to it[1].asFloat } }.orEmpty(),
                b.b("dots"), b.arr("items")?.takeIf { b.s("kind") == "dates" }?.map { it.asString }.orEmpty(), inline(b.objs("runs")), press(b.o("press")), b.s("href"),
                about?.s("label"), b.arr("foots")?.map { it.asString }.orEmpty())
        }
        fun tset(o: JsonObject?): TcgSetBadge? = o?.let { t -> TcgSetBadge(t.s("tone"), t.s("code"), t.o("rarity")?.s("text").orEmpty(), t.o("rarity")?.s("kind").orEmpty(),
            emptyList(), emptyList(), false, "", false, t.s("title")) }
        private fun strs(a: com.google.gson.JsonArray?) = a?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
        private fun pickers(a: List<JsonObject>) = a.map { TcgPicker(it.s("title"), it.s("name"), it.s("aria"), opts(it.objs("options"))) }
        private fun orbs(a: List<JsonObject>) = a.map { PkOrb(it.get("t")?.takeIf { e -> e.isJsonPrimitive }?.asString, svg(it.o("icon")), it.s("label")) }
        private fun pk(o: JsonObject?) = o?.let { p -> PkText(p.o("evolves")?.s("label").orEmpty(), p.o("evolves")?.s("name"),
            p.objs("abilities").map { PkAbility(it.s("tag"), it.s("name"), runs(it.arr("runs"))) },
            p.objs("attacks").map { PkAttack(orbs(it.objs("costs")), it.s("name"), it.s("damage"), runs(it.arr("runs"))) },
            p.arr("rules")?.map { runs(it.asJsonArray) }.orEmpty(), p.arr("strip")?.map { l -> orbs(l.asJsonArray.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }) }.orEmpty()) }
        fun prices(p: JsonObject?): CardPrices? = p?.let { j ->
            val hero = j.o("hero"); val h = j.o("history"); val sl = j.o("sellers"); val d = j.o("details"); val t = d?.o("table")
            CardPrices(hero?.let { x -> CardPriceHero(x.s("eyebrow"), x.s("value"), x.s("id"), x.s("rarity"), x.o("fresh")?.let { CardFresh(it.s("text"), it.s("state"), it.s("title")) },
                    x.arr("notes")?.map { it.asString }.orEmpty(), pickers(x.objs("pickers"))) },
                j.objs("copies").map { CardPriceCopy(it.s("label"), it.s("title"), it.s("value"), it.s("note"), it.s("foot"), it.b("private")) },
                j.o("warning")?.let { it.s("summary") to it.s("text") },
                h?.let { CardHistory(it.s("state"), it.s("source"), it.objs("blocks").map(::histBlock)) },
                sl?.let { s -> CardSellers(s.s("title"), s.s("sub"), s.s("foot"), s.objs("rows").map { CardSeller(it.s("name"), it.s("scope"), it.s("provenance"), it.s("value"), it.s("unit"),
                    it.s("action"), it.s("href"), it.s("aria")) }, s.s("empty")) },
                d?.let { m -> CardMarket(m.s("summary"), presses(m.objs("sources")), t?.objs("cols").orEmpty().map { it.s("finish") to it.s("label") },
                    t?.objs("rows").orEmpty().map { r -> CardPriceRow(r.s("label"), r.s("sub"), r.arr("cells")?.map { it.asString }.orEmpty()) },
                    m.objs("lines").map { it.b("foot") to inline(it.objs("runs")) }, m.o("printings")?.s("head").orEmpty(),
                    m.o("printings")?.objs("rows").orEmpty().map { r -> TcgPrint(press(r.o("press")), r.s("thumb"), r.s("name"), tset(r.o("tset")), r.s("line"), r.o("buy")?.s("label").orEmpty(),
                        r.o("buy")?.s("href").orEmpty(), r.o("buy")?.s("aria").orEmpty(), r.s("refLabel"), r.objs("quotes").map { it.s("label") to it.s("value") }, r.s("value")) },
                    m.o("printings")?.s("foot").orEmpty(),
                    m.objs("tables").map { x -> CardPriceTable(x.s("corner"), x.objs("cols").map { it.s("finish") to it.s("label") },
                        x.objs("rows").map { r -> CardPriceRow(r.s("label"), r.s("sub"), r.arr("cells")?.map { it.asString }.orEmpty()) }) }) })
        }

        fun parse(j: JsonObject): CollectionCardModel {
            val h = j.o("head")
            val oh = j.o("overviewHead")
            val ov = j.o("overview")
            val card = ov?.o("card")
            val set = oh?.o("set")
            val price = oh?.o("price")
            return CollectionCardModel(j.s("name"), j.s("deck"), j.s("entry"), j.s("tab").ifBlank { "overview" }, j.get("notice")?.takeIf { it.isJsonPrimitive }?.asString, j.b("loading"),
                h?.let { CardHead(it.s("art"), it.s("title"), it.s("type"), it.o("owned")?.s("label"), it.o("owned")?.s("aria").orEmpty(), syms(it.objs("mana")), it.b("back"), it.s("crop"),
                    it.objs("emblems").map { e -> TcgEmblem(svg(e.o("icon")), e.s("label"), e.s("text"), e.s("mark"), e.b("hp")) }) },
                j.objs("tabs").map { CollTab(it.s("key"), it.s("label"), it.b("on"), svg(it.o("icon"))) },
                oh?.objs("emblems").orEmpty().map { CardEmblem(it.s("kind"), svg(it.o("icon")), it.s("title"), it.s("line")) },
                set?.let { s -> CardSetSummary(s.s("code"), s.s("rarity"), s.s("icon"), s.s("iconTitle"), s.s("name"), s.b("go"), s.s("line"),
                    s.o("progress")?.let { p -> CardSetProgress(p.s("eyebrow"), p.s("label"), p.s("pct"), p.f("fill"), p.s("caption"), p.get("track")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: true) },
                    strs(s.o("picture")?.arr("src")), s.o("picture")?.s("kind").orEmpty(),
                    s.objs("parts").map { x -> TcgPart(x.get("t")?.takeIf { it.isJsonPrimitive }?.asString, x.b("b"), tset(x.o("tset")), strs(x.arr("img")), x.s("alt"), x.b("ink")) }, press(s.o("press"))) },
                price?.let { p -> CardPrice(p.o("buy")?.let { CardBuy(it.s("brand"), it.s("label"), it.s("href"), it.s("title")) },
                    p.o("ref")?.let { CardRef(it.s("value"), it.s("label"), it.s("finish"), press(it.o("press"))) }, press(p.o("mine")), press(p.o("add")), p.s("note")) },
                ov?.let { o ->
                    val fin = card?.o("finishes"); val pp = card?.o("printings"); val disc = o.o("discovery"); val alert = o.o("alert"); val legal = o.o("legal")
                    val deck = o.o("deck"); val fact = o.o("fact"); val res = o.o("research"); val owned = o.o("owned"); val load = o.o("loading")
                    CardOverview(card?.s("image").orEmpty(), card?.arr("sources")?.map { it.asString }.orEmpty(), card?.s("tierKey").orEmpty(),
                        card?.o("zoom")?.s("src").orEmpty(), card?.o("zoom")?.s("hi").orEmpty(), card?.o("zoom")?.s("art").orEmpty(),
                        card?.o("finish")?.s("key").orEmpty(), card?.o("finish")?.s("effect").orEmpty(), press(card?.o("flip")),
                        fin?.s("label").orEmpty(), fin?.objs("chips").orEmpty().map { CardFinishChip(it.s("finish"), it.s("label"), it.b("on"), it.s("swatch"), press(it.o("press"))) }, fin?.s("foot").orEmpty(),
                        press(card?.o("profile")),
                        pp?.let { p -> CardPrintings(p.s("title"), press(p.o("more")), p.objs("rows").map { r -> CardPrintRow(r.get("i")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0, r.o("picture")?.s("src").orEmpty(),
                            r.o("picture")?.arr("sources")?.map { it.asString }.orEmpty(), r.s("name"), r.s("num"), r.s("aria"), r.b("on"), press(r.o("press")), r.s("tierKey"), r.s("tier")) },
                            p.objs("notes").map { CardNote(it.s("text"), press(it.o("retry"))) }, p.s("foot")) },
                        disc?.s("summary").orEmpty(), disc?.s("text").orEmpty(), presses(disc?.objs("chips").orEmpty()),
                        o.objs("faces").map { f -> CardFace(f.s("eyebrow"), f.s("name"), syms(f.objs("mana")), f.s("type"),
                            f.arr("lines")?.map { l -> runs(l.asJsonArray) }.orEmpty(), f.o("flavor")?.s("label").orEmpty(), f.o("flavor")?.s("text"), f.s("pt"),
                            f.o("artist")?.s("name"), press(f.o("artist")?.o("press")), pk(f.o("pk"))) },
                        load?.let { CardNote(it.s("text"), press(it.o("retry"))) }, press(o.o("rulesEntry")),
                        alert?.s("title").orEmpty(), alert?.s("line").orEmpty(), press(alert?.o("press")), o.s("own"),
                        legal?.let { l -> CardLegal(l.s("level"), svg(l.o("icon")), runs(l.arr("runs")).joinToString("") { it.t.orEmpty() }, l.s("deck")) },
                        deck?.let { d -> CardDeckPanel(d.s("title"), d.get("qty")?.asInt ?: 0, presses(d.objs("steps")), press(d.o("remove"))) },
                        o.objs("chips").map { CardChipTag(it.s("label"), it.s("role"), it.b("warn")) }, fact?.s("label").orEmpty(), fact?.s("text").orEmpty(),
                        res?.s("label").orEmpty(), presses(res?.objs("links").orEmpty()), owned?.s("aria").orEmpty(),
                        owned?.objs("groups").orEmpty().map { g -> CardOwnedGroup(g.s("lot"), g.s("label"), g.get("qty")?.asInt ?: 0, presses(g.objs("steps")), press(g.o("details"))) },
                        presses(o.objs("main")), presses(o.objs("more")),
                        pickers(o.o("selectors")?.objs("selects").orEmpty()), o.o("selectors")?.s("foot").orEmpty(),
                        card?.o("tcgFinish")?.let { f -> TcgFinish(f.s("effect"), f.s("treatment"), f.s("mask"), f.s("clip"), f.f("stars"), f.s("frame")) },
                        o.objs("stats").map { TcgStat(it.s("label"), it.s("value"), it.b("wide"), it.s("note"), it.s("tone")) },
                        o.o("statHelp")?.let { it.s("summary") to runs(it.arr("runs")) }, strs(fact?.arr("all")), press(fact?.o("next")), o.b("ownInActions"), o.b("ownMuted"))
                },
                j.o("meta")?.arr("sections")?.map { s -> blocks(s.asJsonArray.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }) }.orEmpty(),
                j.o("meta")?.s("foot").orEmpty(),
                j.o("guide")?.objs("sections").orEmpty().map { s -> CardSection(s.s("cls"), s.b("panel"), s.b("hero"), blocks(s.objs("blocks"))) },
                j.o("shown"), j.b("busy"),
                j.o("glyphs")?.entrySet()?.mapNotNull { (k, v) -> v.takeIf { it.isJsonObject }?.let { k to svg(it.asJsonObject)!! } }?.toMap().orEmpty(),
                prices(j.o("prices")), CardGame.of(j.s("game")), j.s("id"), j.s("setId"), press(oh?.o("archetype")),
                j.o("buy")?.let { b -> val st = b.o("set"); val v = b.o("version")
                    CardBuySheet(b.s("title"), b.s("back"), b.s("thumb"), b.s("name"), st?.s("icon").orEmpty(), st?.s("title").orEmpty(), st?.s("rarity").orEmpty(), st?.s("name").orEmpty(),
                        b.s("line"), v?.let { listOf(it.s("eyebrow"), it.s("title"), it.s("line"), it.s("foot")) }, prices(b.o("prices")), presses(b.objs("actions")), b.s("foot")) },
                j.s("jump"), j.s("toast"))
        }
    }
}
