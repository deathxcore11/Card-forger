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
class CardHead(val art: String, val title: String, val type: String, val owned: String?, val ownedAria: String, val mana: List<CardSym>, val back: Boolean)
class CardEmblem(val kind: String, val icon: SiteSvg?, val title: String, val line: String)
class CardSetProgress(val eyebrow: String, val label: String, val pct: String, val fill: Float, val caption: String)
class CardSetSummary(val code: String, val rarity: String, val icon: String, val iconTitle: String, val name: String, val go: Boolean, val line: String, val progress: CardSetProgress?)
class CardBuy(val brand: String, val label: String, val href: String, val title: String)
class CardRef(val value: String, val label: String, val finish: String, val press: CardPress?)
class CardPrice(val buy: CardBuy?, val ref: CardRef?, val mine: CardPress?, val add: CardPress?, val note: String)
class CardFinishChip(val finish: String, val label: String, val on: Boolean, val swatch: String)
class CardPrintRow(val i: Int, val src: String, val sources: List<String>, val name: String, val num: String, val aria: String, val on: Boolean)
class CardNote(val text: String, val retry: CardPress?)
class CardPrintings(val title: String, val more: CardPress?, val rows: List<CardPrintRow>, val notes: List<CardNote>, val foot: String)
class CardFace(val eyebrow: String, val name: String, val mana: List<CardSym>, val type: String, val lines: List<List<CardRun>>, val flavorLabel: String, val flavor: String?,
               val pt: String, val artist: String?, val artistPress: CardPress?)
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
                   val main: List<CardPress>, val more: List<CardPress>)

// Prices (workbench-ui.js priceOverview, historyPanel; pricing-presentation.js sellerRows; views.js Market details).
class CardOpt(val value: String, val label: String, val on: Boolean)
/** A line's pieces: words (bold, a tone: ok / warn / bad) or a control. */
class CardInline(val t: String?, val bold: Boolean, val tone: String, val press: CardPress?)
class CardFresh(val text: String, val state: String, val title: String)
class CardPriceHero(val eyebrow: String, val value: String, val id: String, val rarity: String, val fresh: CardFresh?, val notes: List<String>)
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
class CardMarket(val summary: String, val sources: List<CardPress>, val cols: List<Pair<String, String>>, val rows: List<CardPriceRow>, val lines: List<Pair<Boolean, List<CardInline>>>)
class CardPrices(val hero: CardPriceHero?, val copies: List<CardPriceCopy>, val warning: Pair<String, String>?, val history: CardHistory?, val sellers: CardSellers?, val details: CardMarket?)

class CollectionCardModel(val name: String, val deck: String, val entry: String, val tab: String, val notice: String?, val loading: Boolean, val head: CardHead?, val tabs: List<CollTab>,
                          val emblems: List<CardEmblem>, val set: CardSetSummary?, val price: CardPrice?, val overview: CardOverview?, val meta: List<List<CardBlock>>, val metaFoot: String,
                          val guide: List<CardSection>, val shown: JsonObject?, val busy: Boolean, val glyphs: Map<String, SiteSvg>, val prices: CardPrices? = null) {
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
                buttons = if (kind == "buttons") presses(b.objs("items")) else emptyList(), muted = b.b("muted"), small = b.b("small"), lead = b.b("lead"), head = b.s("head"),
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
        fun prices(p: JsonObject?): CardPrices? = p?.let { j ->
            val hero = j.o("hero"); val h = j.o("history"); val sl = j.o("sellers"); val d = j.o("details"); val t = d?.o("table")
            CardPrices(hero?.let { x -> CardPriceHero(x.s("eyebrow"), x.s("value"), x.s("id"), x.s("rarity"), x.o("fresh")?.let { CardFresh(it.s("text"), it.s("state"), it.s("title")) },
                    x.arr("notes")?.map { it.asString }.orEmpty()) },
                j.objs("copies").map { CardPriceCopy(it.s("label"), it.s("title"), it.s("value"), it.s("note"), it.s("foot"), it.b("private")) },
                j.o("warning")?.let { it.s("summary") to it.s("text") },
                h?.let { CardHistory(it.s("state"), it.s("source"), it.objs("blocks").map(::histBlock)) },
                sl?.let { s -> CardSellers(s.s("title"), s.s("sub"), s.s("foot"), s.objs("rows").map { CardSeller(it.s("name"), it.s("scope"), it.s("provenance"), it.s("value"), it.s("unit"),
                    it.s("action"), it.s("href"), it.s("aria")) }, s.s("empty")) },
                d?.let { m -> CardMarket(m.s("summary"), presses(m.objs("sources")), t?.objs("cols").orEmpty().map { it.s("finish") to it.s("label") },
                    t?.objs("rows").orEmpty().map { r -> CardPriceRow(r.s("label"), r.s("sub"), r.arr("cells")?.map { it.asString }.orEmpty()) },
                    m.objs("lines").map { it.b("foot") to inline(it.objs("runs")) }) })
        }

        fun parse(j: JsonObject): CollectionCardModel {
            val h = j.o("head")
            val oh = j.o("overviewHead")
            val ov = j.o("overview")
            val card = ov?.o("card")
            val set = oh?.o("set")
            val price = oh?.o("price")
            return CollectionCardModel(j.s("name"), j.s("deck"), j.s("entry"), j.s("tab").ifBlank { "overview" }, j.get("notice")?.takeIf { it.isJsonPrimitive }?.asString, j.b("loading"),
                h?.let { CardHead(it.s("art"), it.s("title"), it.s("type"), it.o("owned")?.s("label"), it.o("owned")?.s("aria").orEmpty(), syms(it.objs("mana")), it.b("back")) },
                j.objs("tabs").map { CollTab(it.s("key"), it.s("label"), it.b("on"), svg(it.o("icon"))) },
                oh?.objs("emblems").orEmpty().map { CardEmblem(it.s("kind"), svg(it.o("icon")), it.s("title"), it.s("line")) },
                set?.let { s -> CardSetSummary(s.s("code"), s.s("rarity"), s.s("icon"), s.s("iconTitle"), s.s("name"), s.b("go"), s.s("line"),
                    s.o("progress")?.let { p -> CardSetProgress(p.s("eyebrow"), p.s("label"), p.s("pct"), p.f("fill"), p.s("caption")) }) },
                price?.let { p -> CardPrice(p.o("buy")?.let { CardBuy(it.s("brand"), it.s("label"), it.s("href"), it.s("title")) },
                    p.o("ref")?.let { CardRef(it.s("value"), it.s("label"), it.s("finish"), press(it.o("press"))) }, press(p.o("mine")), press(p.o("add")), p.s("note")) },
                ov?.let { o ->
                    val fin = card?.o("finishes"); val pp = card?.o("printings"); val disc = o.o("discovery"); val alert = o.o("alert"); val legal = o.o("legal")
                    val deck = o.o("deck"); val fact = o.o("fact"); val res = o.o("research"); val owned = o.o("owned"); val load = o.o("loading")
                    CardOverview(card?.s("image").orEmpty(), card?.arr("sources")?.map { it.asString }.orEmpty(), card?.s("tierKey").orEmpty(),
                        card?.o("zoom")?.s("src").orEmpty(), card?.o("zoom")?.s("hi").orEmpty(), card?.o("zoom")?.s("art").orEmpty(),
                        card?.o("finish")?.s("key").orEmpty(), card?.o("finish")?.s("effect").orEmpty(), press(card?.o("flip")),
                        fin?.s("label").orEmpty(), fin?.objs("chips").orEmpty().map { CardFinishChip(it.s("finish"), it.s("label"), it.b("on"), it.s("swatch")) }, fin?.s("foot").orEmpty(),
                        press(card?.o("profile")),
                        pp?.let { p -> CardPrintings(p.s("title"), press(p.o("more")), p.objs("rows").map { r -> CardPrintRow(r.get("i")?.asInt ?: 0, r.o("picture")?.s("src").orEmpty(),
                            r.o("picture")?.arr("sources")?.map { it.asString }.orEmpty(), r.s("name"), r.s("num"), r.s("aria"), r.b("on")) },
                            p.objs("notes").map { CardNote(it.s("text"), press(it.o("retry"))) }, p.s("foot")) },
                        disc?.s("summary").orEmpty(), disc?.s("text").orEmpty(), presses(disc?.objs("chips").orEmpty()),
                        o.objs("faces").map { f -> CardFace(f.s("eyebrow"), f.s("name"), syms(f.objs("mana")), f.s("type"),
                            f.arr("lines")?.map { l -> runs(l.asJsonArray) }.orEmpty(), f.o("flavor")?.s("label").orEmpty(), f.o("flavor")?.s("text"), f.s("pt"),
                            f.o("artist")?.s("name"), press(f.o("artist")?.o("press"))) },
                        load?.let { CardNote(it.s("text"), press(it.o("retry"))) }, press(o.o("rulesEntry")),
                        alert?.s("title").orEmpty(), alert?.s("line").orEmpty(), press(alert?.o("press")), o.s("own"),
                        legal?.let { l -> CardLegal(l.s("level"), svg(l.o("icon")), runs(l.arr("runs")).joinToString("") { it.t.orEmpty() }, l.s("deck")) },
                        deck?.let { d -> CardDeckPanel(d.s("title"), d.get("qty")?.asInt ?: 0, presses(d.objs("steps")), press(d.o("remove"))) },
                        o.objs("chips").map { CardChipTag(it.s("label"), it.s("role"), it.b("warn")) }, fact?.s("label").orEmpty(), fact?.s("text").orEmpty(),
                        res?.s("label").orEmpty(), presses(res?.objs("links").orEmpty()), owned?.s("aria").orEmpty(),
                        owned?.objs("groups").orEmpty().map { g -> CardOwnedGroup(g.s("lot"), g.s("label"), g.get("qty")?.asInt ?: 0, presses(g.objs("steps")), press(g.o("details"))) },
                        presses(o.objs("main")), presses(o.objs("more")))
                },
                j.o("meta")?.arr("sections")?.map { s -> blocks(s.asJsonArray.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }) }.orEmpty(),
                j.o("meta")?.s("foot").orEmpty(),
                j.o("guide")?.objs("sections").orEmpty().map { s -> CardSection(s.s("cls"), s.b("panel"), s.b("hero"), blocks(s.objs("blocks"))) },
                j.o("shown"), j.b("busy"),
                j.o("glyphs")?.entrySet()?.mapNotNull { (k, v) -> v.takeIf { it.isJsonObject }?.let { k to svg(it.asJsonObject)!! } }?.toMap().orEmpty(),
                prices(j.o("prices")))
        }
    }
}
