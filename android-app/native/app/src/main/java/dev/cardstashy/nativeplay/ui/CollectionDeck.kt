package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.LinearGradientShader
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardData

// ---------------------------------------------------------------- the model (CollectionEngine.deck, views.js deckPage(), Cards tab)

/** One of the deck's cards as deckRow draws it: the collection row's parts plus its count, type, roles, ownership and legality. */
class DeckCard(val r: CollRow, val qty: Int, val zone: String, val category: String, val roles: List<String>, val own: String?, val owned: Boolean,
               val legal: List<Pair<String, Boolean>>, val chip: String, val stepper: Boolean,
               /** ui.js tileChrome: the colour emblems (mana symbols) and the set symbol, docked on the art. */
               val chromeEmb: List<Pair<String, String>>, val chromeSet: String?, val chromeRarity: String, val chromeTitle: String, val chromeImp: SiteSvg?)
/** A sideboard card (mtgSideboard's .mini-row): its art, "2× Name" and what is still to get. */
class DeckMini(val name: String, val qty: Int, val category: String, val roles: List<String>, val art: String?, val tier: String, val tierColor: String,
               val label: String, val own: String?, val ok: Boolean)
/** deck-viewer.js stackList as data: a type's piles of up to six cards (indexes into the list). */
class DeckStack(val category: String, val count: Int, val hidden: Boolean, val piles: List<List<Int>>)
class DeckStacks(val groups: List<DeckStack>, val piles: Int)
class DeckGroup(val name: String, val count: String, val cards: List<DeckCard>, val stacks: DeckStacks)
class DeckEyebrow(val kind: String, val label: String, val title: String, val badge: Boolean, val level: String, val icon: SiteSvg?, val dots: List<Pair<String, String>>)
class DeckStat(val value: String, val label: String, val warn: Boolean, val button: Boolean, val act: String, val id: String)
class DeckPageAction(val label: String, val act: String, val id: String, val primary: Boolean, val plate: Boolean, val shown: Boolean)
class DeckChip(val id: String, val label: String, val count: String, val on: Boolean)
class DeckSwap(val out: String, val into: String, val icon: SiteSvg?, val button: String, val why: String)
class DeckTally(val kind: String, val icon: SiteSvg?, val count: String, val label: String)
class DeckSide(val count: String, val over: String, val status: String, val text: String, val rows: List<DeckMini>, val stacks: DeckStacks)
class DeckEmblems(val tally: List<DeckTally>, val none: String, val head: String, val swaps: List<DeckSwap>, val foot: String)
class DeckTable(val title: String, val line: List<CollRun>, val bar: Float, val actions: List<Triple<String, String, Boolean>>)

class CollectionDeckModel(val game: CardGame, val id: String, val format: String, val view: String, val missingTitle: String?, val missingText: String,
                          val art: String?, val menuLabel: String, val eyebrow: List<DeckEyebrow>, val title: String, val line: String, val stats: List<DeckStat>, val owned: Float?,
                          val actions: List<DeckPageAction>, val note: String?, val noteLines: List<String>, val tabs: List<CollTab>, val commanderNote: String?,
                          val searchValue: String, val searchPlaceholder: String, val chips: List<DeckChip>, val group: CollSelect?, val addLabel: String, val addIcon: SiteSvg?,
                          val views: List<CollView>, val groups: List<DeckGroup>, val none: String, val roles: List<Pair<String, Int>>, val side: DeckSide?,
                          val emblems: DeckEmblems?, val table: DeckTable?, val glyphs: Map<String, SiteSvg>) {
    companion object {
        private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
        private fun JsonObject.i(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
        private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
        private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }.orEmpty()
        private fun svg(o: JsonObject?) = CollectionCardsModel.svg(o)
        private fun select(o: JsonObject?) = o?.let { CollSelect(it.s("name"), it.s("label"), it.objs("options").map { x -> CollOption(x.s("value"), x.s("label"), x.b("on")) }) }
        private fun stacks(o: JsonObject?) = DeckStacks(o?.objs("groups").orEmpty().map { g ->
            DeckStack(g.s("category"), g.i("count"), g.b("hidden"), g.get("piles")?.asJsonArray?.map { p -> p.asJsonArray.map { it.asInt } }.orEmpty()) }, o?.i("piles") ?: 0)

        /** The row parts the Cards tab already reads (views.js lotRow), so the deck's cards reuse its art, frame and badges. */
        private fun row(r: JsonObject): CollRow {
            val pic = r.o("picture"); val fin = r.o("finish"); val emb = r.o("emblem"); val set = r.o("set")
            return CollRow(r.s("id"), r.s("name"), false, r.s("tier"), r.s("tierColor"), pic?.s("src")?.ifBlank { null }, pic?.strs("sources").orEmpty(), r.s("fallback"),
                fin?.s("key") ?: "", fin?.s("effect") ?: "", emb?.s("title") ?: "", svg(emb?.o("icon")),
                set?.let { CollSet(it.s("code"), it.s("rarity"), it.b("unknown"), it.s("label"), it.s("title")) },
                r.objs("mana").map { it.s("src") to it.s("alt") }, emptyList(), "", "", "", false, "", "", "", "", r.i("qty"), false, "", r.o("print"))
        }
        private fun card(j: JsonObject): DeckCard {
            val own = j.o("own"); val c = j.o("chrome"); val set = c?.o("set")
            return DeckCard(row(j), j.i("qty"), j.s("zone"), j.s("category"), j.strs("roles"), own?.s("text"), own?.b("yes") ?: false,
                j.objs("legal").map { it.s("text") to it.b("bad") }, j.s("chip"), j.b("stepper"),
                c?.objs("emb").orEmpty().map { it.s("src") to it.s("alt") },
                set?.s("src")?.let { Regex("/sets/([^/.?]+)\\.svg").find(it)?.groupValues?.get(1) }, set?.s("rarity") ?: "common", set?.s("title") ?: "", svg(c?.o("imp")))
        }
        private fun mini(j: JsonObject) = DeckMini(j.s("name"), j.i("qty"), j.s("category"), j.strs("roles"), j.o("picture")?.s("src")?.ifBlank { null }, j.s("tier"), j.s("tierColor"),
            j.s("label"), j.o("own")?.s("text"), j.o("own")?.b("ok") ?: false)

        fun parse(j: JsonObject): CollectionDeckModel {
            val missing = j.o("missing"); val h = j.o("hero"); val note = j.o("note"); val side = j.o("side"); val emb = j.o("emblems"); val table = j.o("table")
            return CollectionDeckModel(CardGame.of(j.s("game")), j.s("id"), j.s("format"), j.s("view").ifBlank { "gallery" }, missing?.s("title"), missing?.s("text") ?: "",
                h?.o("art")?.s("src")?.ifBlank { null }, h?.o("menu")?.s("label") ?: "",
                h?.objs("eyebrow").orEmpty().map { DeckEyebrow(it.s("kind"), it.s("label"), it.s("title"), it.b("badge"), it.s("level"), svg(it.o("icon")), it.objs("dots").map { d -> d.s("src") to d.s("alt") }) },
                h?.s("title") ?: "", h?.s("line") ?: "", h?.objs("stats").orEmpty().map { DeckStat(it.s("value"), it.s("label"), it.b("warn"), it.b("button"), it.s("act"), it.s("id")) },
                h?.get("owned")?.takeIf { it.isJsonPrimitive }?.asFloat,
                j.objs("actions").map { DeckPageAction(it.s("label"), it.s("act"), it.s("id"), it.b("primary"), it.b("plate"), it.b("shown")) },
                note?.s("text"), note?.strs("lines").orEmpty(),
                j.objs("tabs").map { CollTab(it.s("key"), it.s("label"), it.b("on"), svg(it.o("icon"))) }, j.o("commanderNote")?.s("text"),
                j.o("search")?.s("value") ?: "", j.o("search")?.s("placeholder") ?: "", j.objs("chips").map { DeckChip(it.s("id"), it.s("label"), it.s("count"), it.b("on")) },
                select(j.o("group")), j.o("add")?.s("label") ?: "", svg(j.o("add")?.o("icon")),
                j.objs("views").map { CollView(it.s("mode"), it.s("label"), it.b("on"), svg(it.o("icon"))) },
                j.objs("groups").map { g -> DeckGroup(g.s("name"), g.s("count"), g.objs("rows").map(::card), stacks(g.o("stacks"))) }, j.s("none"),
                j.objs("roles").map { it.s("role") to it.i("count") },
                side?.let { DeckSide(it.s("count"), it.s("over"), it.s("status"), it.s("text"), it.objs("rows").map(::mini), stacks(it.o("stacks"))) },
                emb?.let { e -> DeckEmblems(e.objs("tally").map { DeckTally(it.s("kind"), svg(it.o("icon")), it.s("count"), it.s("label")) }, e.s("none"), e.s("head"),
                    e.objs("swaps").map { DeckSwap(it.s("out"), it.s("in"), svg(it.o("inIcon")), it.s("button"), it.s("why")) }, e.s("foot")) },
                table?.let { t -> DeckTable(t.s("title"), t.objs("line").map { CollRun(it.s("t"), it.b("b"), it.b("m")) }, t.get("bar")?.asFloat ?: 0f,
                    t.objs("actions").map { Triple(it.s("label"), it.s("act"), it.b("ghost")) }) },
                j.o("glyphs")?.entrySet()?.mapNotNull { (k, v) -> svg(v.takeIf { it.isJsonObject }?.asJsonObject)?.let { k to it } }?.toMap().orEmpty())
        }
    }
}

/** What the page's controls do: search, the chips, grouping and the view are the site's own handlers in the engine; the rest opens the website. */
class CollectionDeckActions(
    val game: (CardGame) -> Unit = {},
    val back: () -> Unit = {},
    /** data-act on the page (deckMenu, deckReview, deckPlayCpu, deckShare, deckAddToggle, acquire, deckCopy, gameNight, deckExport, formatSearch …) with its data-id. */
    val act: (act: String, id: String) -> Unit = { _, _ -> },
    /** data-act="deckTab" data-id: the deck's other tabs. */
    val tab: (String) -> Unit = {},
    val search: (String) -> Unit = {},
    val chip: (String) -> Unit = {},
    val group: (String) -> Unit = {},
    val view: (String) -> Unit = {},
    /** A card (data-act="card"), its set badge, its ± (data-act="deckQty"), a swap (data-act="deckEmbSwap"). */
    val card: (String) -> Unit = {},
    val set: (String) -> Unit = {},
    val qty: (String, Int) -> Unit = { _, _ -> },
    val swap: (out: String, into: String) -> Unit = { _, _ -> },
)

// ---------------------------------------------------------------- site colours

private val GlassLine = Color(0x31EDC980)
private val GlassFill = Color(0x851F232B)
private val Surface46 = Color(0x75171A20)
private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val Mute2 = Color(0xFF8B93A3)
private val LineC = Color(0xFF2A2F39)
private val Surface2 = Color(0xFF1F232B)
private val GoldC = Color(0xFFE8B95B)
private val Warn = Color(0xFFF2C66D)
private val Good = Color(0xFF6FD29A)
private val Bad = Color(0xFFF08A7E)
private val Plate = Color(0xFF2A1906)
private val BtnInk = Color(0xFF1B1406)

private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color)
private fun manrope(size: Float, weight: Int, color: Color = Ink, lh: Float = 1.2f, ls: Float = 0f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color)
/** .hero-body text-shadow: 0 1px 2px #000b, 0 0 12px #0008 (Compose keeps one: the near one). */
private val HeroShadow = Shadow(Color(0xBB000000), Offset(0f, 1.5f), 4f)

// ---------------------------------------------------------------- the page

@Composable
fun CollectionDeck(m: CollectionDeckModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionDeckActions = CollectionDeckActions(),
                   nav: @Composable (vertical: Boolean) -> Unit = {}, query: String = m.searchValue) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val screen = maxWidth
        if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); DeckPage(m, top, act, Modifier.weight(1f).fillMaxHeight(), screen, query) }
        else Column(Modifier.fillMaxSize()) { DeckPage(m, top, act, Modifier.weight(1f).fillMaxWidth(), screen, query); nav(false) }
    }
}

@Composable
private fun DeckPage(m: CollectionDeckModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionDeckActions, modifier: Modifier, screen: Dp, query: String) {
    val wide = screen >= 600.dp
    val small = screen <= 480.dp
    val gutter = if (wide) 22.dp else 16.dp
    val inner = screen - gutter * 2
    val reduced = Playmats.reduced(LocalContext.current)
    LazyColumn(modifier, contentPadding = PaddingValues(bottom = 28.dp)) {
        item(key = "top") {
            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                top { GameTabs(m.game, act.game, compact = !wide, Modifier.widthIn(max = if (wide) 560.dp else 240.dp)) }
            }
        }
        if (m.missingTitle != null) {
            item(key = "missing") {
                Column(Modifier.fillMaxWidth().padding(horizontal = gutter, vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(m.missingTitle, style = sans(18f, 700), textAlign = TextAlign.Center)
                    Text(m.missingText, style = sans(14f, 400, Mute), textAlign = TextAlign.Center)
                    DeckGhost("Back to decks", Modifier.padding(top = 8.dp), onClick = act.back)
                }
            }
            return@LazyColumn
        }
        item(key = "hero") { Box(Modifier.padding(horizontal = gutter).padding(top = 4.dp)) { Hero(m, act, wide, screen, reduced) } }
        item(key = "head") {
            // Block margins collapse as on the site: .ds-actions 14, .note 10, nav.tabs 12, .deck-toolbar 14 / 12 (the groups' 12 meets its 12).
            val blocks = buildList<Triple<Dp, Dp, @Composable () -> Unit>> {
                if (m.actions.any { it.shown && it.label.isNotBlank() }) add(Triple(14.dp, 14.dp) { Actions(m, act, wide) })
                m.note?.let { add(Triple(10.dp, 10.dp) { NoteWarn(it, m.noteLines) }) }
                if (m.tabs.isNotEmpty()) add(Triple(12.dp, 12.dp) { DeckTabs(m.tabs, screen, act.tab) })
                m.commanderNote?.let { add(Triple(10.dp, 10.dp) { NoteWarn("⚠ $it", emptyList(), Modifier.clickable { act.tab("upgrade") }) }) }
                // .deck-body's 4 top padding keeps the toolbar's 14 from collapsing into what is above it.
                add(Triple((-18).dp, 12.dp) { Toolbar(m, act, wide, query) })
                if (m.view == "stacks" && m.roles.isNotEmpty()) add(Triple(0.dp, 0.dp) { RoleSummary(m.roles) })
            }
            Column(Modifier.padding(horizontal = gutter)) {
                var below = 0.dp
                // A negative top is a margin that does not collapse: it adds to the one above.
                for ((top, bottom, block) in blocks) { Spacer(Modifier.height(if (top < 0.dp) below - top else maxOf(below, top))); block(); below = bottom }
                Spacer(Modifier.height(below))
            }
        }
        if (m.groups.isEmpty()) item(key = "none") {
            Text(m.none.ifBlank { "No cards match." }, Modifier.fillMaxWidth().padding(horizontal = gutter, vertical = 16.dp), style = sans(15f, 400, Mute), textAlign = TextAlign.Center)
        }
        when (m.view) {
            "stacks" -> item(key = "stacks") {
                // The type groups flow side by side, each as wide as its piles (206 a pile less 16; 158 less 10 at 480 and under).
                // The role line is the viewer's first flex row: its row gap of 20 sits under it too.
                FlowRow(Modifier.padding(horizontal = gutter).padding(top = if (m.roles.isNotEmpty()) 20.dp else 0.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(if (small) 10.dp else 18.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    for (g in m.groups) {
                        val w = (if (small) g.stacks.piles * 158 - 10 else g.stacks.piles * 206 - 16).dp.coerceAtMost(inner).coerceAtLeast(if (small) 128.dp else 174.dp)
                        Column(Modifier.width(w)) {
                            GroupHead(g.name, g.count, null)
                            StackList(g.stacks, w - 6.dp, small, Modifier.padding(start = 3.dp, end = 3.dp, top = 8.dp, bottom = 12.dp)) { i, mod, last -> StackCard(g.cards[i], m.glyphs, last, small, act, mod) }
                        }
                    }
                }
            }
            // details.group: margin 12 0, collapsing with the toolbar's 12 and with the next group's, so 12 between them all.
            else -> for ((gi, g) in m.groups.withIndex()) {
                item(key = "g:" + g.name) { Box(Modifier.padding(horizontal = gutter).padding(top = if (gi == 0) 0.dp else 12.dp)) { GroupHead(g.name, g.count, null) } }
                val lastCard = g.cards.lastOrNull()
                when (m.view) {
                    "compact" -> items(g.cards, key = { "c:" + g.name + ":" + it.r.name }) { c ->
                        Box(Modifier.padding(horizontal = gutter).padding(bottom = if (c === lastCard) 0.dp else 8.dp)) { CompactCard(c, small, reduced, m.glyphs, act) }
                    }
                    "symbols" -> items(g.cards, key = { "n:" + g.name + ":" + it.r.name }) { c ->
                        Box(Modifier.padding(horizontal = gutter).padding(bottom = if (c === lastCard) 0.dp else 4.dp)) { NameCard(c, reduced, m.glyphs, act) }
                    }
                    else -> {
                        // Art grid: repeat(auto-fill, minmax(170px, 1fr)), 20 / 14 apart; two columns at 480 and under, 16 / 10.
                        val gap = if (small) 10.dp else 14.dp
                        val cols = if (small) 2 else ((inner.value + gap.value) / (170f + gap.value)).toInt().coerceAtLeast(1)
                        val lines = g.cards.chunked(cols)
                        items(lines, key = { line -> "a:" + g.name + ":" + line.joinToString("|") { it.r.name } }) { line ->
                            Row(Modifier.padding(horizontal = gutter).padding(bottom = if (line === lines.last()) 0.dp else if (small) 16.dp else 20.dp).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
                                for (c in line) GalleryCard(c, small, reduced, m.glyphs, act, Modifier.weight(1f).fillMaxHeight())
                                repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
        }
        m.side?.let { s -> item(key = "side") { Box(Modifier.padding(horizontal = gutter).padding(top = 12.dp)) { Sideboard(s, m.view, small, inner, act) } } }
        m.emblems?.let { e -> item(key = "emb") { Box(Modifier.padding(horizontal = gutter).padding(top = 12.dp)) { EmblemPanel(e, act) } } }
        m.table?.let { t -> item(key = "table") { Box(Modifier.padding(horizontal = gutter)) { TableFooter(t, act) } } }
    }
}

// ---------------------------------------------------------------- deckShell: the hero (deck-viewer.js), 300 tall, 18 corners

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Hero(m: CollectionDeckModel, act: CollectionDeckActions, wide: Boolean, screen: Dp, reduced: Boolean) {
    val shape = RoundedCornerShape(18.dp)
    // --ds-h: clamp(300px, 34vw, 380px); a phone (under 700) 300.
    val h = if (screen < 700.dp) 300.dp else (screen.value * .34f).coerceIn(300f, 380f).dp
    Box(Modifier.fillMaxWidth().heightIn(min = h)
        .drawBehind {
            outerShadow(Color(0xEE000000), 40f, 22f, -22f, 18f)
            outerShadow(Color(0x99000000), 10f, 3f, -4f, 18f)
        }
        .clip(shape).background(Brush.linearGradient(listOf(Color(0xFF252936), Color(0xFF141720)), Offset.Zero, Offset.Infinite))) {
        // .hero-art: cover, 50% 28%.
        val p = heroPainter(m.art?.let(homeArt))
        // header-breathe: the art eases to 103.5 % and back over 20 s (none with reduced motion). The site clips the art itself, so
        // it pokes a few px past the hero's edge at full scale; here it stays inside the rounded box.
        val breathe = if (reduced || Motion.still) null else rememberInfiniteTransition(label = "hero")
            .animateFloat(1f, 1.035f, infiniteRepeatable(tween(20_000, easing = androidx.compose.animation.core.CubicBezierEasing(.42f, 0f, .58f, 1f)), RepeatMode.Reverse), label = "breathe")
        if (p != null) Image(p, null, Modifier.matchParentSize().graphicsLayer { val k = breathe?.value ?: 1f; scaleX = k; scaleY = k },
            contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.44f))
        // .hero-shade: up from the foot (.98 → .85 at 30% → .44 at 58% → .08), and in from the left (.7 → clear at 55%); a top light and an inner vignette.
        Box(Modifier.matchParentSize().drawBehind {
            drawRect(Brush.verticalGradient(0f to Color(0x140B0E15), .42f to Color(0x700B0E15), .7f to Color(0xD90B0E15), 1f to Color(0xFA0B0E15)))
            drawRect(Brush.horizontalGradient(0f to Color(0xB30B0E15), .55f to Color.Transparent))
            drawRect(Color(0x1FFFFFFF), size = Size(size.width, 1.dp.toPx()))
            val v = 34.dp.toPx()
            drawRect(Brush.verticalGradient(0f to Color(0x66000000), v / size.height to Color.Transparent))
            drawRect(Brush.verticalGradient((1f - v / size.height) to Color.Transparent, 1f to Color(0x66000000)))
            drawRect(Brush.horizontalGradient(0f to Color(0x66000000), v / size.width to Color.Transparent))
            drawRect(Brush.horizontalGradient((1f - v / size.width) to Color.Transparent, 1f to Color(0x66000000)))
        })
        Column(Modifier.matchParentSize()) {
            // .ds-nav: ← and ⋯, 44 square, 12 corners.
            Row(Modifier.fillMaxWidth().padding(start = if (wide) 18.dp else 14.dp, end = if (wide) 18.dp else 14.dp, top = if (wide) 14.dp else 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x73000000)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(12.dp))
                    .clickable(onClick = act.back).semantics { contentDescription = "Back to decks"; role = Role.Button }, contentAlignment = Alignment.Center) {
                    SiteIcon(m.glyphs["back"], 20.dp, Color.White)
                }
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xC70B0E15)).border(1.dp, GoldC.copy(alpha = .42f), RoundedCornerShape(12.dp))
                    .clickable { act.act("deckMenu", m.id) }.semantics { contentDescription = m.menuLabel; role = Role.Button }.padding(bottom = 4.dp), contentAlignment = Alignment.Center) {
                    SiteIcon(m.glyphs["more"], 20.dp, GoldC)
                }
            }
            Spacer(Modifier.weight(1f).heightIn(min = 10.dp))
            // .deck-hero-id: the eyebrow (badge, format, colours, review), the Cinzel name, the commander.
            Column(Modifier.padding(horizontal = if (wide) 18.dp else 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                    for (e in m.eyebrow) when (e.kind) {
                        "review" -> ReviewBadge(e) { act.act("deckReview", m.id) }
                        "dots" -> Row(Modifier.semantics { contentDescription = e.label }, horizontalArrangement = Arrangement.spacedBy(2.dp)) { e.dots.forEach { (src, alt) -> Mana(src, alt) } }
                        else -> HeroChip(e)
                    }
                }
                val size = if (wide) (screen.value * .036f).coerceIn(26f, 40f) else 26f
                Text(m.title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, lineHeight = (size * 1.08f).sp, letterSpacing = (size * .02f).sp,
                    color = Color.White, shadow = Shadow(Color(0x99000000), Offset(0f, 2f), 12f)))
                if (m.line.isNotBlank()) Text(m.line, style = sans(13f, 400, Color(0xFFE0E3EB), lh = 1.4f).copy(shadow = HeroShadow))
            }
            Spacer(Modifier.height(10.dp))
            // .ds-foot: the stats on a glass base that fades up into the art, and the owned bar along the bottom edge.
            Column(Modifier.fillMaxWidth().drawBehind {
                val up = 34.dp.toPx()
                drawRect(Brush.verticalGradient(0f to Color.Transparent, (46.dp.toPx() - up).coerceAtLeast(0f) / size.height to Color(0x400B0E15), .6f to Color(0x8C0B0E15), 1f to Color(0xD90B0E15)))
            }) {
                FlowRow(Modifier.fillMaxWidth().padding(start = if (wide) 18.dp else 14.dp, end = if (wide) 18.dp else 14.dp, top = if (wide) 12.dp else 10.dp, bottom = if (wide) 14.dp else 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(if (wide) 18.dp else 14.dp), verticalArrangement = Arrangement.spacedBy(if (wide) 6.dp else 4.dp),
                    itemVerticalAlignment = Alignment.CenterVertically) {
                    m.stats.forEachIndexed { i, s ->
                        // .ds-stat:last-child { margin-left: auto } from 700.
                        if (screen >= 700.dp && i == m.stats.lastIndex && i > 0) Spacer(Modifier.weight(1f))
                        HeroStat(s) { if (s.act == "deckTab") act.tab(s.id) else if (s.act.isNotBlank()) act.act(s.act, s.id) }
                    }
                }
                m.owned?.let { o ->
                    Box(Modifier.fillMaxWidth().height(3.dp).background(Color(0x14FFFFFF))) {
                        Box(Modifier.fillMaxWidth(o.coerceIn(0f, 1f)).fillMaxHeight().background(Brush.horizontalGradient(listOf(Color(0xFFEFCE8C), GoldC))))
                    }
                }
            }
        }
        // ::after: a 1 px hairline, gold at the top left and bottom right fading through glass.
        Box(Modifier.matchParentSize().drawBehind {
            val px = 1.dp.toPx()
            val d = Offset(size.width * .42f, size.height * .91f)
            drawRoundRect(Brush.linearGradient(0f to Color(0xB3F1D08A), .26f to Color(0x38FFFFFF), .52f to Color(0x12FFFFFF), .7f to Color(0x0AFFFFFF), 1f to Color(0x66F1D08A),
                start = center - d, end = center + d), topLeft = Offset(px / 2, px / 2), size = Size(size.width - px, size.height - px), cornerRadius = CornerRadius(18.dp.toPx()), style = Stroke(px))
        })
    }
}

/** .deck-hero-eyebrow .chip.dark: 12 px bold on black glass; the "My deck" badge in gold. */
@Composable
private fun HeroChip(e: DeckEyebrow) {
    val shape = RoundedCornerShape(999.dp)
    // .deck-hero-eyebrow .chip and .ds-badge ("My deck") measure the same: white on black .55 with a white 15% line.
    Box(Modifier.clip(shape).background(Color(0x8C000000)).border(1.dp, Color(0x26FFFFFF), shape)
        .semantics { if (e.title.isNotBlank()) contentDescription = e.label + " · " + e.title }.padding(horizontal = 9.dp, vertical = 3.dp)) {
        Text(e.label, maxLines = 1, softWrap = false, style = sans(12f, 700, Color.White).copy(shadow = HeroShadow))
    }
}

/** .review-badge: ● n to review (rule broken, coral), ▲ n to review (worth a look, amber), ✓ Nothing to review (green). */
@Composable
private fun ReviewBadge(e: DeckEyebrow, onClick: () -> Unit) {
    val ink = when (e.level) { "bad" -> Bad; "ok" -> Good; else -> Warn }
    val line = when (e.level) { "bad" -> Color(0x8CF08A7E); "ok" -> Color(0x2EFFFFFF); else -> Color(0x80F2C66D) }
    val shape = RoundedCornerShape(999.dp)
    Row(Modifier.heightIn(min = 34.dp).clip(shape).background(Color(0x80000000)).border(1.dp, line, shape).clickable(onClick = onClick).semantics { role = Role.Button }
        .padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        SiteIcon(e.icon, 15.6.dp, ink)
        Text(e.label, style = sans(13f, 700, ink))
    }
}

/** .ds-stat: the value (Manrope 800, 15) and its word (12, #cfd4de); Power is a button with its value on a gold chip. */
@Composable
private fun HeroStat(s: DeckStat, onClick: () -> Unit) {
    Row(Modifier.then(if (s.button) Modifier.heightIn(min = 28.dp).clickable(onClick = onClick).semantics { role = Role.Button } else Modifier),
        horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        if (s.button) Box(Modifier.widthIn(min = 30.dp).clip(RoundedCornerShape(7.dp)).background(Color(0xFF443A27)).border(1.dp, GoldC.copy(alpha = .45f), RoundedCornerShape(7.dp))
            .padding(horizontal = 7.dp, vertical = 1.dp), contentAlignment = Alignment.Center) { Text(s.value, style = manrope(15f, 800, GoldC)) }
        else Text(s.value, style = manrope(15f, 800, if (s.warn) Warn else Color.White).copy(shadow = HeroShadow))
        Text(s.label, style = sans(12f, 400, Color(0xFFCFD4DE)).copy(shadow = HeroShadow))
    }
}

// ---------------------------------------------------------------- .ds-actions: Practice (the gold plate), War Chest, Share

@Composable
private fun Actions(m: CollectionDeckModel, act: CollectionDeckActions, wide: Boolean) {
    val shown = m.actions.filter { it.shown && it.label.isNotBlank() }
    if (shown.isEmpty()) return
    val primary = shown.filter { it.primary }; val ghosts = shown.filter { !it.primary }
    val tap = { a: DeckPageAction -> if (a.act == "deckTab") act.tab(a.id) else act.act(a.act, a.id) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (wide) Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            primary.forEach { PracticePlate(it.label, Modifier.widthIn(min = 180.dp).fillMaxHeight()) { tap(it) } }
            ghosts.forEach { DeckGhost(it.label, Modifier.fillMaxHeight(), minHeight = 50.dp, pad = 16.dp) { tap(it) } }
        } else {
            // A phone: the plate takes the row; the others share the next one.
            primary.forEach { PracticePlate(it.label, Modifier.fillMaxWidth()) { tap(it) } }
            if (ghosts.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { ghosts.forEach { DeckGhost(it.label, Modifier.weight(1f), minHeight = 46.dp, pad = 10.dp) { tap(it) } } }
        }
    }
}

/** .btn.ds-primary.cs-plate: the gold plate, an inner keyline 4 in, Cinzel 15 tracked 1.5 between two small diamonds. */
@Composable
private fun PracticePlate(label: String, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Row(modifier.heightIn(min = 50.dp)
        .drawBehind { outerShadow(Color(0x3DC99A4B), 26f, 10f, 0f, 10f) }
        .clip(shape).background(Brush.verticalGradient(0f to Color(0xFFF8E2A8), .44f to Color(0xFFE9BF6C), .56f to Color(0xFFC08A3A), 1f to Color(0xFFDDB064)))
        .drawWithContent {
            drawContent()
            val px = 1.dp.toPx()
            drawRect(Color(0xFFFFF6D6), size = Size(size.width, px))
            drawRect(Color(0x668A5C1F), topLeft = Offset(0f, size.height - 2 * px), size = Size(size.width, 2 * px))
            drawRoundRect(Color(0xFF5A3B12), cornerRadius = CornerRadius(10.dp.toPx()), style = Stroke(px))
            val i = 4.dp.toPx()
            drawRoundRect(Color(0x5E6B4515), topLeft = Offset(i + px / 2, i + px / 2), size = Size(size.width - 2 * i - px, size.height - 2 * i - px), cornerRadius = CornerRadius(7.dp.toPx()), style = Stroke(px))
        }
        .clickable(onClick = onClick).semantics { role = Role.Button }.padding(horizontal = 30.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        Diamond(); Text(label, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 15.sp, lineHeight = 15.sp, letterSpacing = 1.5.sp, color = Plate,
            shadow = Shadow(Color(0x99FBE9BD), Offset(0f, 1f), 0f))); Diamond()
    }
}

/** .cs-plate-label::before / ::after: a 6 px square turned 45°, #5e3c11 with a pale 1 px shadow under it. */
@Composable
private fun Diamond() {
    Box(Modifier.size(9.dp).drawBehind {
        val s = 6.dp.toPx()
        rotate(45f) {
            drawRect(Color(0x99FBE9BD), topLeft = center - Offset(s / 2, s / 2 - 1.dp.toPx()), size = Size(s, s))
            drawRect(Color(0xFF5E3C11), topLeft = center - Offset(s / 2, s / 2), size = Size(s, s))
        }
    })
}

/** .btn.ghost: glass, 11 corners, 15 bold. */
@Composable
private fun DeckGhost(label: String, modifier: Modifier = Modifier, minHeight: Dp = 44.dp, pad: Dp = 16.dp, onClick: () -> Unit) {
    val shape = RoundedCornerShape(11.dp)
    Box(modifier.heightIn(min = minHeight).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape)
        .drawWithContent { drawContent(); drawRect(Color(0x12FFFFFF), size = Size(size.width, 1.dp.toPx())) }
        .clickable(onClick = onClick).semantics { role = Role.Button }.padding(horizontal = pad), contentAlignment = Alignment.Center) {
        Text(label, maxLines = 1, style = sans(15f, 700))
    }
}

/** .btn (gold): 44 tall, 11 corners, 15 bold on the gold. */
@Composable
private fun DeckGold(label: String, modifier: Modifier = Modifier, minHeight: Dp = 44.dp, pad: Dp = 16.dp, size: Float = 15f, onClick: () -> Unit) {
    Box(modifier.heightIn(min = minHeight).clip(RoundedCornerShape(11.dp)).background(GoldC).clickable(onClick = onClick).semantics { role = Role.Button }.padding(horizontal = pad),
        contentAlignment = Alignment.Center) { Text(label, maxLines = 1, style = sans(size, 700, BtnInk)) }
}

/** .note.warn: amber words on an amber wash, 12 corners. */
@Composable
private fun NoteWarn(text: String, lines: List<String>, modifier: Modifier = Modifier) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x1AF2C66D)).then(modifier).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text, style = sans(13.5f, 400, Color(0xFFF6DBA2)))
        lines.forEach { Text(it, style = sans(13f, 400, Color(0xFFF6DBA2))) }
    }
}

// ---------------------------------------------------------------- nav.tabs: Cards, Rules, Power, Matchups, Upgrade lab, Versions, War Chest

/** Under 900 the tabs wrap and share each line (flex 1 1 auto); from 900 they sit at their own widths. The gold glide marks the open one. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DeckTabs(tabs: List<CollTab>, screen: Dp, onTab: (String) -> Unit) {
    if (tabs.isEmpty()) return
    val wrap = screen < 900.dp
    FlexWrap(Modifier.fillMaxWidth().drawBehind {
        drawLine(GlassLine, Offset(0f, size.height - .5f), Offset(size.width, size.height - .5f), 1.dp.toPx())
    }.padding(horizontal = 2.dp), gap = 2.dp, grow = wrap) {
        for (t in tabs) {
            val on = t.on
            Row(Modifier.heightIn(min = 44.dp).drawBehind {
                if (on) {
                    drawRect(Brush.radialGradient(listOf(GoldC.copy(alpha = .24f), Color.Transparent), Offset(size.width / 2, size.height), size.width * .6f * .7f), size = size)
                    drawRect(Brush.horizontalGradient(.18f to Color.Transparent, .5f to GoldC, .82f to Color.Transparent), Offset(0f, size.height - 2.dp.toPx()), Size(size.width, 2.dp.toPx()))
                }
            }.clickable { if (!on) onTab(t.key) }.semantics { role = Role.Tab }.padding(horizontal = 14.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                SiteIcon(t.icon, 16.dp, if (on) Ink else Mute.copy(alpha = .75f))
                // white-space: nowrap, so a row breaks on the whole label ("Upgrade lab"), as the site's flex wrap does.
                Text(t.label, maxLines = 1, softWrap = false, style = sans(14f, if (on) 750 else 650, if (on) Ink else Mute, ls = -.14f))
            }
        }
    }
}

/**
 * CSS flex-wrap with flex: 1 1 auto: lines break on each item's natural width, then a line's spare width is shared equally
 * ([grow]). FlowRow's weights break on the shortest width instead, which splits "Upgrade lab" where the site wraps it whole.
 */
@Composable
private fun FlexWrap(modifier: Modifier, gap: Dp, grow: Boolean, content: @Composable () -> Unit) {
    androidx.compose.ui.layout.Layout(content, modifier) { ms, c ->
        val g = gap.roundToPx(); val maxW = c.maxWidth
        val natural = ms.map { it.maxIntrinsicWidth(c.maxHeight).coerceAtMost(maxW) }
        val lines = mutableListOf<MutableList<Int>>(); var used = 0
        natural.forEachIndexed { i, w ->
            if (lines.isEmpty() || (used + g + w > maxW && lines.last().isNotEmpty())) { lines += mutableListOf(i); used = w } else { lines.last() += i; used += g + w }
        }
        val placed = lines.map { line ->
            val free = (maxW - line.sumOf { natural[it] } - g * (line.size - 1)).coerceAtLeast(0)
            line.mapIndexed { k, i ->
                val w = if (grow) natural[i] + free / line.size + (if (k < free % line.size) 1 else 0) else natural[i]
                ms[i].measure(androidx.compose.ui.unit.Constraints(minWidth = w, maxWidth = w, minHeight = 0, maxHeight = c.maxHeight))
            }
        }
        val height = placed.sumOf { l -> l.maxOf { it.height } } + g * (placed.size - 1).coerceAtLeast(0)
        layout(if (c.hasBoundedWidth) maxW else placed.maxOf { l -> l.sumOf { it.width } + g * (l.size - 1) }, height.coerceIn(c.minHeight, c.maxHeight)) {
            var y = 0
            for (l in placed) {
                var x = 0; val lh = l.maxOf { it.height }
                for (p in l) { p.place(x, y + (lh - p.height) / 2); x += p.width + g }
                y += lh + g
            }
        }
    }
}

// ---------------------------------------------------------------- .deck-toolbar: search, show chips, group, + Add, the deck view

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Toolbar(m: CollectionDeckModel, act: CollectionDeckActions, wide: Boolean, query: String) {
    val phone = !wide && LocalConfigurationWidth() <= 640
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp),
        itemVerticalAlignment = Alignment.CenterVertically) {
        DeckSearchField(query, m.searchPlaceholder, act.search, if (phone) Modifier.fillMaxWidth() else Modifier.widthIn(min = 260.dp).weight(1f))
        // Under 640 the chips scroll in one line instead of wrapping.
        Row(Modifier.then(if (phone) Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()) else Modifier), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for (c in m.chips) DeckChipButton(c) { act.chip(c.id) }
        }
        m.group?.let { GroupPick(it, act.group) }
        if (m.addLabel.isNotBlank()) {
            Row(Modifier.height(44.dp).clip(RoundedCornerShape(999.dp)).border(1.dp, LineC, RoundedCornerShape(999.dp)).clickable { act.act("deckAddToggle", m.id) }
                .semantics { role = Role.Button; contentDescription = "Add a card" }.padding(horizontal = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                SiteIcon(m.addIcon ?: m.glyphs["plus"], 18.dp, Ink)
                Text(m.addLabel, style = sans(15f, 400))
            }
        }
        // .deck-view-toolbar { margin-left: auto }: at the right of its line, wherever the line breaks.
        Box(Modifier.widthIn(min = 190.dp).weight(1f), contentAlignment = Alignment.CenterEnd) { ViewSwitch(m.views, act.view) }
    }
}

@Composable
private fun LocalConfigurationWidth(): Int = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp

@Composable
private fun DeckSearchField(value: String, placeholder: String, onChange: (String) -> Unit, modifier: Modifier) {
    val shape = RoundedCornerShape(12.dp)
    BasicTextField(value, onChange, modifier.height(44.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape),
        singleLine = true, textStyle = sans(15f, 400, Ink), cursorBrush = SolidColor(GoldC), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        decorationBox = { inner ->
            Box(Modifier.padding(horizontal = 14.dp), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) Text(placeholder, style = sans(15f, 400, Mute), maxLines = 1)
                inner()
            }
        })
}

/** .deck-chip: a 44 tall pill (the font rule doesn't apply, so 15 regular); the open one in gold on a dark gold glass, Missing's count in gold. */
@Composable
private fun DeckChipButton(c: DeckChip, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Row(Modifier.height(44.dp).then(if (c.on) Modifier.drawBehind { drawRoundRect(GoldC.copy(alpha = .2f), topLeft = Offset(-1.dp.toPx(), -1.dp.toPx()),
            size = Size(size.width + 2.dp.toPx(), size.height + 2.dp.toPx()), cornerRadius = CornerRadius(size.height)) } else Modifier)
        .clip(shape).background(if (c.on) Brush.verticalGradient(listOf(Color(0xFF2A2418), Color(0xFF1D1912))) else SolidColor(Color(0x99171A20)))
        .border(1.dp, if (c.on) GoldC.copy(alpha = .6f) else LineC, shape).clickable(onClick = onClick).semantics { role = Role.Button }.padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Text(c.label, maxLines = 1, style = sans(15f, 400, if (c.on) Color(0xFFFFF1CF) else Mute))
        if (c.count.isNotBlank()) Text(c.count, Modifier.padding(start = 4.dp), style = sans(15f, 700, GoldC))
    }
}

/** .deck-group (glass-select): the grouping, muted, ▾ at the right. */
@Composable
private fun GroupPick(sel: CollSelect, onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(999.dp)
    Box {
        Row(Modifier.height(44.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape).clickable { open = true }.semantics { contentDescription = sel.label }
            .padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(sel.current?.label ?: "", maxLines = 1, style = sans(15f, 400, Mute))
            // Chrome's own select arrow: a filled triangle about 10 by 8.
            Box(Modifier.size(10.dp, 8.dp).drawBehind {
                drawPath(Path().apply { moveTo(0f, 0f); lineTo(size.width, 0f); lineTo(size.width / 2, size.height); close() }, Color(0xFFB4BAC6))
            })
        }
        DropdownMenu(open, { open = false }, containerColor = Color(0xFF1A1E26)) {
            for (o in sel.options) DropdownMenuItem(text = { Text(o.label, style = sans(14f, if (o.on) 700 else 400, if (o.on) GoldC else Ink)) }, onClick = { open = false; if (!o.on) onPick(o.value) })
        }
    }
}

/** .deck-view-switch: Stacks, Art grid, Names only, Detailed list; 44 square buttons in a glass tray, the chosen one gold. */
@Composable
private fun ViewSwitch(views: List<CollView>, onView: (String) -> Unit) {
    if (views.isEmpty()) return
    val shape = RoundedCornerShape(12.dp)
    Row(Modifier.clip(shape).background(GlassFill).border(1.dp, GlassLine, shape).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        for (v in views) Box(Modifier.size(44.dp).clip(RoundedCornerShape(9.dp)).then(if (v.on) Modifier.background(Color(0xFF433E34)).border(1.dp, GoldC.copy(alpha = .35f), RoundedCornerShape(9.dp)) else Modifier)
            .clickable { if (!v.on) onView(v.mode) }.semantics { contentDescription = v.label; role = Role.RadioButton }, contentAlignment = Alignment.Center) {
            SiteIcon(v.icon, 20.dp, if (v.on) GoldC else Mute)
        }
    }
}

/** .deck-stack-summary: the main deck's roles by copies (Ramp 4 · Draw 12 …), over the piles. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RoleSummary(roles: List<Pair<String, Int>>) {
    FlowRow(Modifier.fillMaxWidth().padding(bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        for ((role, n) in roles) Text(buildAnnotatedString { append("$role "); withStyle(SpanStyle(color = Ink, fontWeight = FontWeight.Bold)) { append("$n") } }, style = sans(12f, 400, Mute))
    }
}

/** details.group summary: the group's name and count, Manrope 13 / 800, uppercase, tracked .06em; the price stays off on the deck page. */
@Composable
private fun GroupHead(name: String, count: String, right: String?) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(horizontal = 2.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(buildAnnotatedString { append(name.uppercase()); if (count.isNotBlank()) withStyle(SpanStyle(color = Mute2)) { append("  " + count) } },
            Modifier.weight(1f), style = manrope(13f, 800, Mute, ls = .78f))
        if (!right.isNullOrBlank()) Text(right.uppercase(), style = manrope(13f, 800, Mute, ls = .78f))
    }
}

// ---------------------------------------------------------------- the cards

/** The card's name and its set badge on one line, the line cut with an ellipsis (the badge goes when the name is long, as the site's does). */
@Composable
private fun NameWithBadge(c: DeckCard, style: TextStyle, maxLines: Int, act: CollectionDeckActions, modifier: Modifier = Modifier) {
    val s = c.r.set
    val text = buildAnnotatedString { append(c.r.name); if (s != null) { append(" "); appendInlineContent("set", s.label) } }
    // .set-badge: its code measured in the badge's own type, the 10 symbol and its 4 gap, 4 padding a side.
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    val density = androidx.compose.ui.platform.LocalDensity.current
    val w = s?.let { with(density) {
        (measurer.measure(it.label, BadgeType, softWrap = false, maxLines = 1).size.width.toDp() + 9.dp + (if (!it.unknown && it.code.isNotBlank()) 14.dp else 0.dp)).toSp()
    } } ?: 0.sp
    val inline = if (s == null) emptyMap() else mapOf("set" to InlineTextContent(Placeholder(w, 17.sp, PlaceholderVerticalAlign.TextCenter)) {
        Box(Modifier.padding(start = 0.dp)) { DeckSetBadge(s) { if (!s.unknown) act.set(s.code) } }
    })
    Text(text, modifier.clickable { act.card(c.r.name) }, inlineContent = inline, maxLines = maxLines, overflow = TextOverflow.Ellipsis, style = style)
}

private val BadgeType = sans(11f, 600, lh = 1.2f, ls = .385f)

/** .deck-viewer .lot-name .set-badge: 11 px code in the rarity's ink, the set symbol, on the dark green-grey plate. */
@Composable
private fun DeckSetBadge(s: CollSet, onClick: () -> Unit) {
    val ink = when (s.rarity) { "mythic" -> Color(0xFFEF9674); "rare" -> Color(0xFFD2B271); "uncommon" -> Color(0xFFBBCED1); else -> Color(0xFFD9D3BC) }
    Row(Modifier.height(17.dp).clip(RoundedCornerShape(5.dp)).background(Color(0xFF252B25)).border(1.dp, LineC, RoundedCornerShape(5.dp)).clickable(onClick = onClick)
        .semantics { contentDescription = s.title }.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        if (!s.unknown && s.code.isNotBlank()) RaritySetIcon(s.code.lowercase(), s.rarity, 10.dp)
        Text(s.label, maxLines = 1, softWrap = false, style = BadgeType.copy(color = if (s.unknown) Color(0xFF929A90) else ink))
    }
}

/** .own: a 7 dot and the words, green when owned, amber when not. */
@Composable
private fun OwnLine(text: String, yes: Boolean, size: Float = 12f) {
    val ink = if (yes) Good else Warn
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(ink))
        Text(text, style = sans(size, 600, ink))
    }
}

/** .lot-side: the stepper, or the Commander chip. */
@Composable
private fun Side(c: DeckCard, glyphs: Map<String, SiteSvg>, act: CollectionDeckActions) {
    if (c.stepper) Stepper(c.qty, glyphs, { act.qty(c.r.name, -1) }, { act.qty(c.r.name, 1) })
    else if (c.chip.isNotBlank()) Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Surface2).border(1.dp, LineC, RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp)) {
        Text(c.chip, style = sans(12f, 700, Ink))
    }
}

/** ui.js tileChrome: the colour emblems and the set symbol in two glass pills joined by a gold hairline, flush on the art's foot. */
@Composable
private fun TileChrome(c: DeckCard, modifier: Modifier) {
    if (c.chromeEmb.isEmpty() && c.chromeSet == null && c.chromeImp == null) return
    val pill = Modifier.drawBehind {
        drawRect(Color(0x30000000), topLeft = Offset(0f, 2.dp.toPx()), size = size)
    }
    Row(modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, bottom = 3.dp), verticalAlignment = Alignment.CenterVertically) {
        val both = c.chromeEmb.isNotEmpty() && c.chromeSet != null
        if (c.chromeEmb.isNotEmpty()) Row(pill.height(17.dp).clip(RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp, topEnd = if (both) 0.dp else 10.dp, bottomEnd = if (both) 0.dp else 10.dp))
            .background(Brush.verticalGradient(0f to Color(0xE62F3138), .55f to Color(0xD50E1016), 1f to Color(0xCC0A0C12)))
            .drawWithContent { drawContent(); drawRect(Color(0x24FFFFFF), size = Size(size.width, 1.dp.toPx())) }
            .padding(start = 6.dp, end = 5.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
            c.chromeEmb.forEach { (src, alt) ->
                val p = heroPainter(src.takeIf { it.isNotBlank() }?.let(homeArt))
                Box(Modifier.size(13.dp).drawBehind { drawCircle(Color.Black.copy(alpha = .55f), size.minDimension / 2, center + Offset(-1.dp.toPx(), 1.dp.toPx())) }.semantics { contentDescription = alt }) {
                    if (p != null) Image(p, null, Modifier.fillMaxSize().clip(CircleShape))
                }
            }
        }
        c.chromeSet?.let { code ->
            Box(pill.height(17.dp).clip(RoundedCornerShape(topStart = if (both) 0.dp else 10.dp, bottomStart = if (both) 0.dp else 10.dp, topEnd = 10.dp, bottomEnd = 10.dp))
                .background(Brush.verticalGradient(0f to Color(0xE62F3138), .55f to Color(0xD50E1016), 1f to Color(0xCC0A0C12)))
                .drawWithContent {
                    drawContent(); drawRect(Color(0x24FFFFFF), size = Size(size.width, 1.dp.toPx()))
                    if (both) drawRect(Brush.verticalGradient(listOf(Color(0x00F4BF58), Color(0xA0F4BF58), Color(0x00F4BF58))), topLeft = Offset(0f, 5.dp.toPx()), size = Size(1.dp.toPx(), size.height - 10.dp.toPx()))
                }
                .semantics { contentDescription = c.chromeTitle }.padding(horizontal = 6.dp), contentAlignment = Alignment.Center) {
                RaritySetIcon(code, c.chromeRarity, 15.dp)
            }
        }
        if (c.chromeImp != null) { Spacer(Modifier.weight(1f)); SiteIcon(c.chromeImp, 16.dp, Ink) }
    }
}

/** The card's own picture, and its foil when the deck's printing has one (finish-preview.js), as the Cards tab draws it. */
@Composable
private fun DeckPicture(c: DeckCard, modifier: Modifier, shape: androidx.compose.ui.graphics.Shape) {
    val r = c.r
    if (r.art == null) { Box(modifier.clip(shape).background(Surface2), contentAlignment = Alignment.Center) { Text(r.fallback.ifBlank { "◇" }, style = sans(10f, 400, Mute)) }; return }
    val context = LocalContext.current
    val data = if (r.print != null) CardData.ready.collectAsState().value.also { if (it == null) CardData.warm(context) } else null
    val finish = Foil.finishFor(r.print, r.finishKey.ifBlank { "nonfoil" })
    val look = data?.let { Foil.look(it, r.print, finish) }?.takeIf { it.shines }
    val tilt = if (look != null) rememberFoilTilt(live = true, phase = (r.name.hashCode() and 0xff) / 255f, tile = true) else null
    CardPicture(r.art, look, tilt, modifier, shape)
}

// ---- Art grid (the deck's default view)

/** The aura (style.css "DeckAura light"): two pools of the price colour offset behind the card and a soft halo; purple, gold and orange orbit. */
private class DeckAura(val a: Color, val b: Color, val mix: Float, val orbit: Int)
private val AURAS = mapOf(
    "t0" to DeckAura(Color(0xFFA7AFB8), Color(0xFF6F7780), .30f, 0), "tn" to DeckAura(Color(0xFFA7AFB8), Color(0xFF6F7780), .30f, 0),
    "t1" to DeckAura(Color(0xFF7BE3A8), Color(0xFF2FAE68), .55f, 0), "t2" to DeckAura(Color(0xFF8CC6FF), Color(0xFF2F7FE0), .60f, 0),
    "t3" to DeckAura(Color(0xFFB46CFF), Color(0xFF6FD0FF), .70f, 8000), "t4" to DeckAura(Color(0xFFFFD34D), Color(0xFFFFB020), .70f, 10000),
    "t5" to DeckAura(Color(0xFFFF7A1A), Color(0xFFFFD08A), .75f, 4500))

/**
 * The framed card of the Art grid: the art 3.75 in from a price band ("six distinct border motions": silver gleam and emerald glints circling,
 * a sapphire current, holo colours rising, a racing gold glint, fire), the aura around it, the emblem dock on its foot.
 */
@Composable
private fun FramedArt(c: DeckCard, reduced: Boolean, modifier: Modifier) {
    val tier = c.r.tier
    val framed = tier in setOf("t0", "t1", "t2", "t3", "t4", "t5")
    val aura = AURAS[tier] ?: AURAS.getValue("tn")
    val moving = framed && !reduced && !Motion.still
    val t = if (moving) rememberInfiniteTransition(label = "frame") else null
    val period = when (tier) { "t0" -> 10000; "t1" -> 7000; "t2" -> 2200; "t3" -> 4500; "t4" -> 2400; else -> 1600 }
    val phase: State<Float>? = t?.animateFloat(0f, 1f, infiniteRepeatable(tween(period, easing = LinearEasing), RepeatMode.Restart), label = "band")
    val orbit: State<Float>? = if (aura.orbit > 0) t?.animateFloat(0f, 1f, infiniteRepeatable(tween(aura.orbit, easing = LinearEasing), RepeatMode.Restart), label = "orbit") else null
    val fw = 3.75.dp
    Box(modifier.aspectRatio(63f / 88f)
        .drawBehind {
            val rx = size.width * .0475f + fw.toPx(); val ry = size.height * .035f + fw.toPx()
            // Two pools offset ±12 / ±9 (orbiting a quarter turn at a time for t3 to t5), a halo 1.5× as soft, and the drop under the card.
            val o = orbit?.value ?: 0f
            val k = (o * 4f).toInt() % 4; val f = o * 4f - (o * 4f).toInt()
            val pts = listOf(Offset(-12f, -9f), Offset(12f, -9f), Offset(12f, 9f), Offset(-12f, 9f))
            val p1 = lerpOffset(pts[k], pts[(k + 1) % 4], f); val p2 = Offset(-p1.x, -p1.y)
            val halo = if (aura.orbit > 0 && k % 2 == 1) aura.b else aura.a
            auraShadow(aura.a.copy(alpha = aura.mix), 34f, p1, -6f, rx, ry)
            auraShadow(aura.b.copy(alpha = aura.mix), 34f, p2, -6f, rx, ry)
            auraShadow(halo.copy(alpha = .4f), 51f, Offset.Zero, -5f, rx, ry)
            auraShadow(Color(0xCC000000), 24f, Offset(0f, 10f), -14f, rx, ry)
        }
        .drawWithContent {
            val rx = size.width * .0475f + fw.toPx(); val ry = size.height * .035f + fw.toPx()
            val outer = Path().apply { addRoundRect(RoundRect(Rect(Offset.Zero, size), CornerRadius(rx, ry))) }
            if (framed) clipPath(outer) { drawBand(tier, phase?.value ?: 0f) }
            drawContent()
        }) {
        val inner = Modifier.fillMaxSize().padding(if (framed) fw else 0.dp)
        BoxWithConstraints(inner) {
            val shape = RoundedCornerShape(percent = 4)
            DeckPicture(c, Modifier.fillMaxSize(), shape)
        }
        TileChrome(c, Modifier.align(Alignment.BottomStart))
    }
}

private fun lerpOffset(a: Offset, b: Offset, f: Float) = Offset(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f)

/** A box-shadow with elliptical corners, outside the box only. */
private fun DrawScope.auraShadow(color: Color, blur: Float, offset: Offset, spread: Float, rx: Float, ry: Float) {
    val outline = Path().apply { addRoundRect(RoundRect(Rect(Offset.Zero, size), CornerRadius(rx, ry))) }
    clipPath(outline, androidx.compose.ui.graphics.ClipOp.Difference) {
        drawIntoCanvas { cc -> val c = cc.nativeCanvas
            val radius = ((blur.dp.toPx() / 2f - .5f) / .57735f).coerceAtLeast(.5f)
            val sp = spread.dp.toPx()
            val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                this.color = color.toArgb(); setShadowLayer(radius, offset.x.dp.toPx(), offset.y.dp.toPx(), color.toArgb())
            }
            // The casting box itself sits under the card (only its shadow shows past the clip).
            c.drawRoundRect(-sp, -sp, size.width + sp, size.height + sp, (rx + sp).coerceAtLeast(0f), (ry + sp).coerceAtLeast(0f), paint)
        }
    }
}


/** The price band itself, filling the box (the card covers all but its 3.75 edge). */
private fun DrawScope.drawBand(tier: String, p: Float) {
    fun conic(stops: List<Pair<Float, Color>>, turn: Float) {
        // conic-gradient(from var(--ring)): 0deg is up and clockwise; a sweep gradient starts at 3 o'clock.
        val big = maxOf(size.width, size.height) * 1.5f
        rotate(turn * 360f - 90f, center) {
            drawRect(Brush.sweepGradient(*stops.toTypedArray(), center = center), topLeft = center - Offset(big, big), size = Size(big * 2, big * 2))
        }
    }
    fun slide(stops: List<Pair<Float, Color>>, tile: Float, shift: Float, vertical: Boolean) {
        val t = tile.dp.toPx(); val s = shift * t
        val shader = if (vertical) LinearGradientShader(Offset(0f, s), Offset(0f, s + t), stops.map { it.second }, stops.map { it.first }, TileMode.Repeated)
            else LinearGradientShader(Offset(s, 0f), Offset(s + t, 0f), stops.map { it.second }, stops.map { it.first }, TileMode.Repeated)
        drawRect(ShaderBrush(shader))
    }
    when (tier) {
        "t0" -> conic(listOf(0f to Color(0xFF6F7780), .3f to Color(0xFF6F7780), .4f to Color(0xFFC9D0D6), .45f to Color.White, .5f to Color(0xFFC9D0D6), .6f to Color(0xFF6F7780), 1f to Color(0xFF6F7780)), p)
        "t1" -> conic(listOf(0f to Color(0xFF1F8A50), .18f to Color(0xFF2FAE68), .24f to Color(0xFFC4FFDE), .3f to Color(0xFF2FAE68), .5f to Color(0xFF1F8A50),
            .68f to Color(0xFF2FAE68), .74f to Color(0xFFC4FFDE), .8f to Color(0xFF2FAE68), 1f to Color(0xFF1F8A50)), -p)
        "t2" -> {
            // tier-current: the base slides right one 260 tile while the sheen runs left one 180 tile.
            slide(listOf(0f to Color(0xFF1D5FB0), .3f to Color(0xFF2F7FE0), .5f to Color(0xFF7FC3FF), .7f to Color(0xFF2F7FE0), 1f to Color(0xFF1D5FB0)), 260f, p, false)
            slide(listOf(0f to Color(0x00E2F4FF), .4f to Color(0x00E2F4FF), .5f to Color(0xFFE2F4FF), .6f to Color(0x00E2F4FF), 1f to Color(0x00E2F4FF)), 180f, -p, false)
        }
        "t3" -> slide(listOf(0f to Color(0xFFB46CFF), .2f to Color(0xFF6FD0FF), .4f to Color(0xFFFF7AD9), .6f to Color(0xFFFFE27A), .8f to Color(0xFF7DFFB2), 1f to Color(0xFFB46CFF)), 360f, -p, true)
        "t4" -> slide(listOf(0f to Color(0xFF9A6F08), .3f to Color(0xFFE2B53A), .42f to Color(0xFFFFD34D), .5f to Color(0xFFFFFBE6), .58f to Color(0xFFFFD34D), .7f to Color(0xFFE2B53A), 1f to Color(0xFF9A6F08)), 240f, p, false)
        "t5" -> {
            slide(listOf(0f to Color(0xFFA3330A), .25f to Color(0xFFFF7A1A), .5f to Color(0xFFFFB050), .75f to Color(0xFFFF5A10), 1f to Color(0xFFA3330A)), 140f, -p, true)
            slide(listOf(0f to Color(0x00FFF0BE), .5f to Color(0xD9FFF0BE), 1f to Color(0x00FFF0BE)), 160f, p, false)
        }
    }
}

/** An Art grid card: the framed art, the name with its set badge (one line, 44 tall), what you own, and the stepper. */
@Composable
private fun GalleryCard(c: DeckCard, small: Boolean, reduced: Boolean, glyphs: Map<String, SiteSvg>, act: CollectionDeckActions, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FramedArt(c, reduced, Modifier.fillMaxWidth().clickable { act.card(c.r.name) }.semantics { contentDescription = "Open ${c.r.name}" })
        Column(Modifier.padding(horizontal = 3.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Box(Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.CenterStart) { NameWithBadge(c, sans(13f, 600, Ink, lh = 1.3f), 1, act) }
            c.own?.let { OwnLine(it, c.owned) }
        }
        // .lot-side: 8 under the text (the column's gap), its 5 foot padding below.
        Box(Modifier.weight(1f).padding(start = 3.dp, end = 3.dp, bottom = 5.dp)) { Side(c, glyphs, act) }
    }
}

// ---- Detailed list and Names only (collection rows, their rings)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CompactCard(c: DeckCard, small: Boolean, reduced: Boolean, glyphs: Map<String, SiteSvg>, act: CollectionDeckActions) {
    // The row's padding sits inside a 1 transparent border; the art is centred on the text (align-items: center).
    Row(Modifier.fillMaxWidth().lotFrame(c.r, reduced).padding(if (small) 7.dp else 9.dp), horizontalArrangement = Arrangement.spacedBy(if (small) 7.dp else 10.dp)) {
        val w = if (small) 48.dp else 58.dp; val h = if (small) 67.dp else 81.dp
        Box(Modifier.align(Alignment.CenterVertically).size(w, h).clip(RoundedCornerShape(9.dp)).background(Surface2).clickable { act.card(c.r.name) }.semantics { contentDescription = "Open ${c.r.name}" }) {
            DeckPicture(c, Modifier.fillMaxSize(), RoundedCornerShape(6.dp))
            TileChrome(c, Modifier.align(Alignment.BottomStart))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            NameWithBadge(c, sans(14f, 700, Ink, lh = 1.25f), 3, act)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                if (c.r.mana.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) { c.r.mana.forEach { (src, alt) -> Mana(src, alt) } }
                c.legal.forEach { (t, bad) -> LegalTag(t, bad) }
            }
            c.own?.let { OwnLine(it, c.owned) }
        }
        Side(c, glyphs, act)
    }
}

@Composable
private fun NameCard(c: DeckCard, reduced: Boolean, glyphs: Map<String, SiteSvg>, act: CollectionDeckActions) {
    // 10 padding inside a 1 border; the name and the stepper centred on each other.
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).lotFrame(c.r, reduced).padding(11.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(c.r.name, Modifier.weight(1f).clickable { act.card(c.r.name) }, style = sans(16f, 700, Ink, lh = 1.25f))
        Side(c, glyphs, act)
    }
}

/** .tag: Banned / Not legal (coral), Restricted / Unresolved (amber). */
@Composable
private fun LegalTag(text: String, bad: Boolean) {
    Box(Modifier.clip(RoundedCornerShape(6.dp)).background(if (bad) Color(0x29F08A7E) else Color(0x33E0A040)).padding(horizontal = 6.dp, vertical = 2.dp)) {
        Text(text, style = sans(12f, 700, if (bad) Bad else Color(0xFFF0C070)))
    }
}

// ---- Stacks

/** The piles of one list: each type (its heading unless the list's own heading names it), its piles side by side in columns at least 168 (128) wide. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StackList(st: DeckStacks, width: Dp, small: Boolean, modifier: Modifier, card: @Composable (index: Int, mod: Modifier, last: Boolean) -> Unit) {
    Column(modifier.width(width), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        for (g in st.groups) Column {
            if (!g.hidden) Row(Modifier.padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(g.category, style = sans(15f, 750))
                Box(Modifier.widthIn(min = 26.dp).clip(RoundedCornerShape(8.dp)).background(Surface2).padding(horizontal = 7.dp, vertical = 2.dp), contentAlignment = Alignment.Center) {
                    Text("${g.count}", style = sans(12f, 400, Mute))
                }
            }
            val min = if (small) 128f else 168f; val gap = if (small) 10f else 16f
            val cols = ((width.value + gap) / (min + gap)).toInt().coerceAtLeast(1)
            val colW = ((width.value - gap * (cols - 1)) / cols).dp
            FlowRow(horizontalArrangement = Arrangement.spacedBy(gap.dp), verticalArrangement = Arrangement.spacedBy(if (small) 18.dp else 20.dp)) {
                for (pile in g.piles) Pile(pile, colW, small, card)
            }
        }
    }
}

/** .deck-stack-pile: the cards overlap so each shows its title strip (38 dp, 32 at 480 and under); the top card shows whole, its stepper hanging under it. */
@Composable
private fun Pile(pile: List<Int>, width: Dp, small: Boolean, card: @Composable (index: Int, mod: Modifier, last: Boolean) -> Unit) {
    // polish.css: each card's strip is tall enough for the −/+ of the card under it: 48, 44 at 480 and under.
    val step = if (small) 44.dp else 48.dp
    val h = width * (88f / 63f)
    Box(Modifier.width(width).height(step * (pile.size - 1) + h + 54.dp)) {
        pile.forEachIndexed { i, idx -> card(idx, Modifier.padding(top = step * i).width(width), i == pile.lastIndex) }
    }
}

/** A card in a pile: its art ringed in its tier, the count tab (more than one copy), its roles, and for the pile's top card the stepper under it. */
@Composable
private fun StackCard(c: DeckCard, glyphs: Map<String, SiteSvg>, last: Boolean, small: Boolean, act: CollectionDeckActions, modifier: Modifier) {
    Box(modifier) {
        Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f).drawBehind { outerShadow(Color(0xBB000000), 16f, 7f, -10f, 8f) }
            .clip(RoundedCornerShape(percent = 4)).background(Surface46).clickable { act.card(c.r.name) }.semantics { contentDescription = "${c.qty}× ${c.r.name}" }) {
            DeckPicture(c, Modifier.fillMaxSize(), RoundedCornerShape(percent = 4))
            TierOutline(c.r.tier, c.r.tierColor)
            TileChrome(c, Modifier.align(Alignment.BottomStart))
            if (c.qty > 1) CountTab("${c.qty}×", Modifier.align(Alignment.TopEnd).padding(5.dp))
            if (c.roles.isNotEmpty()) RolesTab(c.roles.joinToString(" · "), Modifier.align(Alignment.BottomEnd).padding(end = 4.dp, bottom = 3.dp).fillMaxWidth(.5f))
        }
        if (last && c.stepper) {
            Box(Modifier.fillMaxWidth().padding(top = 6.dp).offsetBelowCard(), contentAlignment = Alignment.TopCenter) {
                Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Brush.verticalGradient(0f to Color(0xF02F3138), .55f to Color(0xEB0E1016), 1f to Color(0xEB0A0C12)))
                    .border(1.dp, Color(0x50F4BF58), RoundedCornerShape(12.dp)).padding(1.dp)) { BigStepper(c.qty, glyphs, { act.qty(c.r.name, -1) }, { act.qty(c.r.name, 1) }) }
            }
        }
    }
}

/** Places the stepper under the card: the box above it is the card (63:88), so it starts at its foot. */
private fun Modifier.offsetBelowCard(): Modifier = this.then(Modifier.layout { m, cs ->
    val p = m.measure(cs.copy(minHeight = 0, maxHeight = androidx.compose.ui.unit.Constraints.Infinity))
    val y = (cs.maxWidth * 88f / 63f).toInt()
    layout(p.width, p.height + y) { p.place(0, y) }
})

/** .stepper in a pile: the buttons 44 tall, 36 wide; white on glass. */
@Composable
private fun BigStepper(qty: Int, glyphs: Map<String, SiteSvg>, minus: () -> Unit, plus: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Box(Modifier.size(36.dp, 44.dp).clickable(onClick = minus).semantics { contentDescription = "Remove one" }, contentAlignment = Alignment.Center) { SiteIcon(glyphs["minus"], 20.dp, Color.White) }
        Text("$qty", Modifier.widthIn(min = 18.dp), style = sans(14f, 700, Color.White), textAlign = TextAlign.Center)
        Box(Modifier.size(36.dp, 44.dp).clickable(onClick = plus).semantics { contentDescription = "Add one" }, contentAlignment = Alignment.Center) { SiteIcon(glyphs["plus"], 20.dp, Color.White) }
    }
}

/** ui.js tierRing on the card image: a 2 px outline in the tier colour just inside its edge (t0 #8b939c). */
@Composable
private fun BoxScope.TierOutline(tier: String, tierColor: String) {
    val c = (if (tier == "t0") Color(0xFF8B939C) else cssColor(tierColor, Color.Transparent)) ?: return
    if (tier == "tn") return
    Box(Modifier.matchParentSize().drawBehind {
        val px = 2.dp.toPx()
        drawRoundRect(c, topLeft = Offset(px / 2, px / 2), size = Size(size.width - px, size.height - px), cornerRadius = CornerRadius(size.width * .05f, size.height * .035f), style = Stroke(px))
    })
}

/** The count tab: "4×" in pale gold on dark glass, 18 tall, 9 corners, a gold keyline. */
@Composable
private fun CountTab(text: String, modifier: Modifier) {
    Box(modifier.heightIn(min = 18.dp).clip(RoundedCornerShape(9.dp)).background(Brush.verticalGradient(0f to Color(0xE6343640), .55f to Color(0xD20E1016), 1f to Color(0xD10A0C12)))
        .border(1.dp, Color(0x50F4BF58), RoundedCornerShape(9.dp)).padding(horizontal = 7.dp), contentAlignment = Alignment.Center) {
        Text(text, style = sans(11f, 800, Color(0xFFFFE3A3), lh = 1.2f))
    }
}

/** .deck-stack-roles: Ramp · Draw on slim glass, a cool keyline. */
@Composable
private fun RolesTab(text: String, modifier: Modifier) {
    Box(modifier.wrapContentWidth(Alignment.End), contentAlignment = Alignment.CenterEnd) {
        Box(Modifier.height(17.dp).clip(RoundedCornerShape(9.dp)).background(Brush.verticalGradient(0f to Color(0xE62F3138), .55f to Color(0xD50E1016), 1f to Color(0xCC0A0C12)))
            .border(1.dp, Color(0x408CC6FF), RoundedCornerShape(9.dp)).padding(horizontal = 7.dp), contentAlignment = Alignment.Center) {
            Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(11f, 700, Color(0xFFE9EDF3), lh = 1.3f, ls = .11f))
        }
    }
}

// ---------------------------------------------------------------- the sideboard (mtgSideboard), the emblems, Take it to the table

@Composable
private fun Sideboard(s: DeckSide, view: String, small: Boolean, inner: Dp, act: CollectionDeckActions) {
    Column {
        GroupHead("Sideboard", s.count + if (s.over.isNotBlank()) "  · ${s.over}" else "", if (view == "stacks") null else s.status)
        if (s.text.isNotBlank()) Text(s.text, Modifier.padding(vertical = 6.dp), style = sans(13f, 400, Mute))
        when (view) {
            "stacks" -> {
                val w = (if (small) 148.dp else 190.dp)
                StackList(s.stacks, w - 6.dp, small, Modifier.padding(start = 3.dp, end = 3.dp, top = 8.dp, bottom = 12.dp)) { i, mod, _ -> MiniStack(s.rows[i], act, mod) }
            }
            "compact", "symbols" -> Column(verticalArrangement = Arrangement.spacedBy(if (view == "symbols") 4.dp else 8.dp)) {
                for (r in s.rows) Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { act.card(r.name) }.padding(horizontal = if (view == "symbols") 10.dp else 2.dp, vertical = if (view == "symbols") 10.dp else 9.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (view == "compact") Box(Modifier.size(48.dp, 67.dp)) { MiniArt(r, Modifier.fillMaxSize(), RoundedCornerShape(6.dp)) }
                    Text(r.label, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(14f, 400))
                    if (view == "compact") r.own?.let { Text(it, style = sans(13f, 400, if (r.ok) Good else Warn)) }
                }
            }
            else -> {
                val gap = if (small) 10.dp else 14.dp
                val cols = if (small) 2 else ((inner.value + gap.value) / (170f + gap.value)).toInt().coerceAtLeast(1)
                Column(verticalArrangement = Arrangement.spacedBy(if (small) 16.dp else 20.dp)) {
                    for (line in s.rows.chunked(cols)) Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                        for (r in line) Column(Modifier.weight(1f).clickable { act.card(r.name) }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f)) {
                                MiniArt(r, Modifier.fillMaxSize(), RoundedCornerShape(percent = 4))
                                if (r.qty > 1) Box(Modifier.align(Alignment.TopEnd).padding(7.dp).clip(RoundedCornerShape(7.dp)).background(Color(0xE8141820)).border(1.dp, Color(0x60FFFFFF), RoundedCornerShape(7.dp))
                                    .padding(horizontal = 7.dp, vertical = 3.dp)) { Text("${r.qty}×", style = sans(12f, 800, Color.White, lh = 1.4f)) }
                            }
                            Text(r.label, Modifier.padding(horizontal = 6.dp), style = sans(14f, 400))
                            r.own?.let { Text(it, Modifier.fillMaxWidth().padding(start = 6.dp, end = 6.dp, bottom = 8.dp), style = sans(13f, 400, if (r.ok) Good else Warn), textAlign = TextAlign.End) }
                        }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

/** .mini-art: the card on the surface-2 plate, ringed in its tier (2 px inside). */
@Composable
private fun MiniArt(r: DeckMini, modifier: Modifier, shape: androidx.compose.ui.graphics.Shape) {
    Box(modifier.clip(shape).background(Surface2)) {
        val p = heroPainter(r.art?.let(homeArt))
        if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        TierOutline(r.tier, r.tierColor)
    }
}

@Composable
private fun MiniStack(r: DeckMini, act: CollectionDeckActions, modifier: Modifier) {
    Box(modifier.aspectRatio(63f / 88f).drawBehind { outerShadow(Color(0xBB000000), 16f, 7f, -10f, 8f) }.clickable { act.card(r.name) }) {
        MiniArt(r, Modifier.fillMaxSize(), RoundedCornerShape(percent = 4))
        if (r.qty > 1) CountTab("${r.qty}×", Modifier.align(Alignment.TopEnd).padding(5.dp))
        if (r.roles.isNotEmpty()) RolesTab(r.roles.joinToString(" · "), Modifier.align(Alignment.BottomEnd).padding(end = 4.dp, bottom = 3.dp).fillMaxWidth(.5f))
    }
}

/** importance.js deckEmblemHtml: the meta and staple tally, owned upgrades with Swap, and the caution under them. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EmblemPanel(e: DeckEmblems, act: CollectionDeckActions) {
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp).drawBehind { outerShadow(Color(0x38000000), 30f, 10f, 0f, 14f) }
        .clip(shape).background(Surface46).background(Brush.linearGradient(listOf(Color(0x0BFFFFFF), Color(0x00FFFFFF)), Offset.Zero, Offset(300f, 520f)))
        .border(1.dp, GlassLine, shape).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (e.tally.isEmpty() && e.none.isNotBlank()) Text(e.none, style = sans(13f, 400, Mute))
            for (t in e.tally) Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                SiteIcon(t.icon, 16.dp, Ink)
                Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(t.count) }; append(" " + t.label) }, style = sans(13f, 400))
            }
        }
        if (e.swaps.isNotEmpty()) {
            Text(e.head.uppercase(), Modifier.padding(top = 12.dp, bottom = 4.dp), style = sans(13f, 700, Ink, ls = .78f))
            for (s in e.swaps) Column(Modifier.padding(horizontal = 2.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(s.out, Modifier.weight(1f).clickable { act.card(s.out) }.padding(vertical = 4.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(14f, 600, GoldC))
                    Text("→", style = sans(14f, 400, Mute))
                    Row(Modifier.weight(1f).clickable { act.card(s.into) }.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                        SiteIcon(s.icon, 15.dp, Ink)
                        Text(s.into, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(14f, 700, GoldC))
                    }
                    DeckGold(s.button, minHeight = 34.dp, pad = 12.dp, size = 13.5f) { act.swap(s.out, s.into) }
                }
                Text(s.why, style = sans(11.5f, 400, Mute))
            }
            if (e.foot.isNotBlank()) Text(e.foot, Modifier.padding(top = 10.dp, bottom = 6.dp), style = sans(12f, 400, Mute2))
        }
    }
}

/** .deck-table-footer: Take it to the table, what is owned and still missing, the owned bar, then Fill / I got cards / Copy list / Game Night / Export. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TableFooter(t: DeckTable, act: CollectionDeckActions) {
    Column(Modifier.fillMaxWidth().padding(top = 28.dp, bottom = 12.dp).drawBehind { drawLine(LineC, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }.padding(top = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column {
            Text(t.title, Modifier.padding(bottom = 4.dp), style = manrope(18f, 700, Ink, lh = 1.15f, ls = -.36f))
            Text(buildAnnotatedString { for (r in t.line) if (r.bold) withStyle(SpanStyle(color = Ink, fontWeight = FontWeight.Bold)) { append(r.t) } else append(r.t) },
                Modifier.padding(bottom = 8.dp), style = sans(13.5f, 400, Mute))
            Box(Modifier.padding(vertical = 6.dp).widthIn(max = 360.dp).fillMaxWidth().height(7.dp).clip(RoundedCornerShape(99.dp)).background(Surface2)) {
                Box(Modifier.fillMaxWidth(t.bar.coerceIn(0f, 1f)).fillMaxHeight().clip(RoundedCornerShape(99.dp)).background(GoldC))
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((label, a, ghost) in t.actions) {
                val tap = { if (a == "deckTab") act.tab("upgrade") else act.act(a, "") }
                if (ghost) DeckGhost(label, onClick = tap) else DeckGold(label, onClick = tap)
            }
        }
    }
}
