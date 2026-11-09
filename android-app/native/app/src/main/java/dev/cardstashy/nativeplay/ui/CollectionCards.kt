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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
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
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
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

// ---------------------------------------------------------------- the model (CollectionEngine.cards, views.js collection())

/** An inline site icon (icons.js / importance.js svg) as the engine read it: shapes in its view box, currentColor left open. */
class SiteSvg(val vb: List<Float>, val items: List<Item>, val grads: Map<String, Grad>, val texts: List<Glyph> = emptyList()) {
    /** A <text> glyph: at [x], [y] (its baseline) in the view box, [anchor] start / middle / end. */
    class Glyph(val x: Float, val y: Float, val text: String, val size: Float, val weight: Int, val fill: String, val anchor: String)
    class Item(val t: String, val d: String, val x: Float, val y: Float, val w: Float, val h: Float, val r: Float, val rx: Float, val ry: Float,
               val fill: String, val stroke: String, val sw: Float, val cap: String, val join: String)
    class Grad(val x1: Float, val y1: Float, val x2: Float, val y2: Float, val stops: List<Pair<Float, String>>)
}

class CollOption(val value: String, val label: String, val on: Boolean)
class CollSelect(val name: String, val label: String, val options: List<CollOption>) { val current get() = options.firstOrNull { it.on } ?: options.firstOrNull() }
class CollView(val mode: String, val label: String, val on: Boolean, val icon: SiteSvg?)
class CollTab(val key: String, val label: String, val on: Boolean, val icon: SiteSvg?)
class CollRun(val t: String, val bold: Boolean, val muted: Boolean)
class CollSet(val code: String, val rarity: String, val unknown: Boolean, val label: String, val title: String)
class CollSub(val t: String, val foil: Boolean)
class CollRow(val id: String, val name: String, val wanted: Boolean, val tier: String, val tierColor: String, val art: String?, val artSources: List<String>,
              val fallback: String, val finishKey: String, val finishEffect: String, val emblemTitle: String, val emblem: SiteSvg?, val set: CollSet?,
              val mana: List<Pair<String, String>>, val sub: List<CollSub>, val wantChip: String, val wishId: String, val tag: String, val tagWarn: Boolean,
              val price: String, val condition: String, val conditionInfo: String, val origin: String, val qty: Int, val edit: Boolean, val got: String,
              /** The printing record (Scryfall card) when the copy shows a finish: what its foil is drawn from. */
              val print: JsonObject? = null,
              /** ui.js tileChrome on the art (the gallery shows it): colour emblems, the set symbol in its rarity, the importance mark. */
              val chrome: CollChrome? = null,
              /** .want-tag's word on a wishlist card's art ("Wishlist"). */
              val wantTag: String = "",
              /** A Yu-Gi-Oh! or Pokémon lot: its card's id (A.tCard) and its .lot-sub as pieces. */
              val cardId: String = "", val pieces: List<CollPiece> = emptyList(),
              /** workbench-ui.js selectionMark: null when Select is off; else whether this lot is ticked. */
              val mark: Boolean? = null,
              /** A Yu-Gi-Oh! or Pokémon lot's finish (tcg.js .lot-art data-finish-model): what its foil is drawn from. */
              val tcgFinish: TcgFinish? = null)
/** workbench-ui.js selectionTray: "n selected", the four actions (disabled with none ticked) and Clear. */
class CollTray(val count: String, val buttons: List<CollTrayButton>, val clear: String)
class CollTrayButton(val kind: String, val label: String, val disabled: Boolean)
class CollChrome(val emb: List<Pair<String, String>>, val set: String?, val rarity: String, val title: String, val imp: SiteSvg?)
/**
 * One piece of a Yu-Gi-Oh! or Pokémon lot's .lot-sub, in order ([k]): "svg" an emblem (energy disc, level star, attribute), "set" the
 * start of the set badge (.tset, its [title] and rarity [tone]), "img" a set symbol or rarity mark ([ink]: black ink the site inverts),
 * "t" words ([bold] the badge's code, [small] its number, [strong] .hp / .lvl). [set]: inside the set badge.
 */
class CollPiece(val k: String, val t: String, val bold: Boolean, val small: Boolean, val strong: Boolean, val tone: String, val set: Boolean,
                val icon: SiteSvg?, val src: String, val alt: String, val ink: Boolean, val title: String)

class CollectionCardsModel(val game: CardGame, val title: String, val banner: String?, val views: List<CollView>, val selectLabel: String, val selectIcon: SiteSvg?,
                           val menu: String, val menuLabel: String, val tabs: List<CollTab>, val emptyTitle: String?, val emptyText: String, val emptyMark: String,
                           val emptyActions: List<Pair<String, String>>, val summary: List<CollRun>, val sort: CollSelect?, val direction: CollSelect?,
                           val searchValue: String, val searchPlaceholder: String, val filter: CollSelect?, val rows: List<CollRow>, val none: String,
                           val moreLabel: String?, val more: Int,
                           /** icons.js ICON.minus / plus / more: what decorateGlyphs draws in a button whose only text is −, ＋ or ⋯. */
                           val glyphs: Map<String, SiteSvg> = emptyMap(),
                           /** The Select button's visible word (shown from 600 dp; the phone keeps the icon). */
                           val selectText: String = "",
                           /** workbench-ui.js modeFor(game, "collection"): gallery, compact (the site's default here) or symbols. */
                           val mode: String = "compact",
                           /** tcg.js tcgCollection: the game's filter pills (set, kind, rarity, owned or wishlist), the value line's refresh
                            *  button (.coll-summary) and the buttons under the list (Copy wishlist, Paste a list, Export CSV). */
                           val filters: List<CollSelect> = emptyList(), val refresh: SiteSvg? = null, val refreshLabel: String = "",
                           val actions: List<SiteButton> = emptyList(),
                           /** Select is on (the head's button reads Done and is lit), and its tray. */
                           val selectOn: Boolean = false, val tray: CollTray? = null) {
    companion object {
        private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
        private fun JsonObject.f(k: String, d: Float = 0f) = get(k)?.takeIf { it.isJsonPrimitive }?.asFloat ?: d
        private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()

        fun svg(o: JsonObject?): SiteSvg? = o?.let { j ->
            SiteSvg(j.get("vb")?.asJsonArray?.map { it.asFloat } ?: listOf(0f, 0f, 24f, 24f),
                j.objs("items").map { SiteSvg.Item(it.s("t"), it.s("d"), it.f("x", it.f("cx")), it.f("y", it.f("cy")), it.f("w"), it.f("h"), it.f("r"), it.f("rx"), it.f("ry"),
                    it.s("fill"), it.s("stroke"), it.f("sw", 1f), it.s("cap"), it.s("join")) },
                j.o("grads")?.entrySet()?.associate { (k, v) -> val g = v.asJsonObject
                    k to SiteSvg.Grad(g.f("x1"), g.f("y1"), g.f("x2", 1f), g.f("y2"), g.get("stops").asJsonArray.map { s -> s.asJsonArray[0].asFloat to s.asJsonArray[1].asString }) }.orEmpty(),
                j.objs("texts").map { SiteSvg.Glyph(it.f("x"), it.f("y"), it.s("text"), it.f("size", 12f), it.f("weight", 400f).toInt(), it.s("fill"), it.s("anchor")) })
        }
        private fun select(o: JsonObject?) = o?.let { CollSelect(it.s("name"), it.s("label"), it.objs("options").map { x -> CollOption(x.s("value"), x.s("label"), x.b("on")) }) }

        fun parse(j: JsonObject): CollectionCardsModel {
            val e = j.o("empty"); val more = j.o("more")
            return CollectionCardsModel(CardGame.of(j.s("game")), j.s("title"), j.o("banner")?.s("src")?.ifBlank { null },
                j.objs("views").map { CollView(it.s("mode"), it.s("label"), it.b("on"), svg(it.o("icon"))) },
                j.o("select")?.s("aria") ?: "", svg(j.o("select")?.o("icon")), j.o("menu")?.s("label") ?: "", j.o("menu")?.s("aria") ?: "",
                j.objs("tabs").map { CollTab(it.s("key"), it.s("label"), it.b("on"), svg(it.o("icon"))) },
                e?.s("title"), e?.s("text") ?: "", e?.s("mark") ?: "", e?.objs("actions")?.map { it.s("label") to it.s("act") }.orEmpty(),
                j.objs("summary").map { CollRun(it.s("t"), it.b("b"), it.b("m")) }, select(j.o("sort")), select(j.o("direction")),
                j.o("search")?.s("value") ?: "", j.o("search")?.s("placeholder") ?: "", select(j.o("filter")),
                j.objs("rows").map { r ->
                    val pic = r.o("picture"); val fin = r.o("finish"); val emb = r.o("emblem"); val set = r.o("set"); val tag = r.o("tag"); val cond = r.o("condition")
                    CollRow(r.s("id"), r.s("name"), r.b("wanted"), r.s("tier"), r.s("tierColor"), pic?.s("src")?.ifBlank { null },
                        pic?.get("sources")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }.orEmpty(), r.s("fallback"),
                        fin?.s("key") ?: "", fin?.s("effect") ?: "", emb?.s("title") ?: "", svg(emb?.o("icon")),
                        set?.let { CollSet(it.s("code"), it.s("rarity"), it.b("unknown"), it.s("label"), it.s("title")) },
                        r.objs("mana").map { it.s("src") to it.s("alt") }, r.objs("sub").map { CollSub(it.s("t"), it.b("foil")) },
                        r.s("wantChip"), r.s("wishId"), tag?.s("text") ?: "", tag?.b("warn") ?: false, r.s("price"), cond?.s("code") ?: "", cond?.s("info") ?: "",
                        r.s("origin"), r.get("qty")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0, r.b("edit"), r.s("got"), r.o("print"),
                        r.o("chrome")?.let { c -> val cs = c.o("set")
                            CollChrome(c.objs("emb").map { it.s("src") to it.s("alt") }, cs?.s("src")?.let { Regex("/sets/([^/.?]+)\\.svg").find(it)?.groupValues?.get(1) },
                                cs?.s("rarity") ?: "common", cs?.s("title") ?: "", svg(c.o("imp"))) }, r.s("wantTag"), r.s("cardId"),
                        r.objs("pieces").map { x -> CollPiece(x.s("k"), x.s("t"), x.b("b"), x.b("s"), x.b("strong"), x.s("tone"), x.b("set"), svg(x.o("icon")),
                            x.s("src"), x.s("alt").ifBlank { x.s("label") }, x.b("ink"), x.s("title")) },
                        mark = r.o("mark")?.b("on"), tcgFinish = TcgFinish.of(r.o("tcgFinish")))
                }, j.s("none"), more?.s("label"), more?.get("count")?.asInt ?: 0,
                j.o("glyphs")?.entrySet()?.mapNotNull { (k, v) -> svg(v.takeIf { it.isJsonObject }?.asJsonObject)?.let { k to it } }?.toMap().orEmpty(),
                j.o("select")?.s("label") ?: "", j.s("mode").ifBlank { "compact" },
                j.objs("filters").mapNotNull(::select), svg(j.o("refresh")?.o("icon")), j.o("refresh")?.s("aria") ?: "",
                j.objs("actions").map { SiteButton(it.s("label"), it.s("act"), it.b("ghost"), it.b("chest"), it.s("aria"), svg(it.o("icon"))) },
                j.o("select")?.b("on") ?: false,
                j.o("tray")?.let { t -> CollTray(t.s("count"), t.objs("buttons").map { CollTrayButton(it.s("kind"), it.s("label"), it.b("disabled")) }, t.s("clear")) })
        }
    }
}

/** What the page's controls do. Sorting, searching, filtering and Show more are the engine's own (the route asks it again);
 *  the rest still opens the website's page until each part is native. */
class CollectionCardsActions(
    val game: (CardGame) -> Unit = {},
    /** seg data-act="collTab": Binders and Value. */
    val tab: (String) -> Unit = {},
    /** view-switch data-act="viewSave" data-mode. */
    val view: (String) -> Unit = {},
    /** data-act="batchStart" / "collMenu". */
    val select: () -> Unit = {},
    val menu: () -> Unit = {},
    /** data-change collSort / collDirection / collFilter, data-input collSearch, data-act collMore. */
    val sort: (String) -> Unit = {},
    val direction: (String) -> Unit = {},
    val filter: (String) -> Unit = {},
    val search: (String) -> Unit = {},
    val more: () -> Unit = {},
    /** A row: data-act="card" (data-entry), "set", "buyCard", "qty" (±1), "editLot", "own" (Got it), "wishRemove"; empty: addCard / importCollection. */
    val card: (CollRow) -> Unit = {},
    val set: (String) -> Unit = {},
    val price: (CollRow) -> Unit = {},
    val qty: (CollRow, Int) -> Unit = { _, _ -> },
    val edit: (CollRow) -> Unit = {},
    val got: (CollRow) -> Unit = {},
    val unwish: (CollRow) -> Unit = {},
    val emptyAct: (String) -> Unit = {},
    /** Yu-Gi-Oh! and Pokémon: a filter pill (its name, as the engine gave it, and the value), the value line's refresh
     *  (data-act tRefreshPrices) and a button under the list (its data-act). */
    val pick: (String, String) -> Unit = { _, _ -> },
    val refresh: () -> Unit = {},
    val button: (String) -> Unit = {},
    /** Select (workbench-ui.js): a lot's tick (C.batchToggle), the tray's Clear (A.batchClear) and its Move / Add to deck / Wishlist /
     *  Compare (A.batchAction data-kind). */
    val mark: (CollRow, Boolean) -> Unit = { _, _ -> },
    val clear: () -> Unit = {},
    val batch: (String) -> Unit = {},
    /** A controller's Y on a lot: the card big (CardZoom, as the card page's Enlarge shows it). Null = no peek here. */
    val peek: ((CollRow) -> Unit)? = null,
)

/** A lot's picture or name: while Select is on, its tick turns over (app.js attachCardGestures onSelect); otherwise the card opens. */
private fun CollectionCardsActions.open(r: CollRow) { val m = r.mark; if (m != null) mark(r, !m) else card(r) }

/** The controller on a lot (PadPrompts): A opens it (in Select, turns its tick over); X is the lot's own ＋ (the stepper's add one, or a
 *  wanted card's Got it); Y peeks at the card big (CardZoom) when the lot has a picture. */
private fun CollectionCardsActions.pad(r: CollRow): PadActs {
    val m = r.mark
    val x = if (r.wanted) r.got.takeIf { it.isNotBlank() }?.let { g -> PadAct(g.trimStart().removePrefix("＋").removePrefix("+").trim()) { got(r) } }
        else PadAct("Add a copy") { qty(r, 1) }
    val y = peek?.takeIf { !r.art.isNullOrBlank() }?.let { p -> PadAct("Peek") { p(r) } }
    return PadActs(a = if (m == null) "Open" else if (m) "Unselect" else "Select", y = y, x = x)
}

/** A lot's controller acts, and on a dual-screen handheld the card the bottom screen shows (its price and count: Collection keeps prices). */
@Composable
private fun Modifier.lotPad(r: CollRow, act: CollectionCardsActions): Modifier {
    val acts = remember(r, act) { act.pad(r) }
    // Two screens: the lot's whole card page follows the ring onto the bottom screen.
    return followCard { act.card(r) }.padActs(acts)
}

// ---------------------------------------------------------------- site colours (style.css tokens as the live page computes them)

private val GlassLine = Color(0x31EDC980)            // color(srgb .93 .787 .501 / .193)
private val GlassFill = Color(0x851F232B)            // color(srgb .1216 .1373 .1686 / .52)
private val Surface46 = Color(0x75171A20)            // --surface at .46
private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val LineC = Color(0xFF2A2F39)
private val Surface2 = Color(0xFF1F232B)
/** --gold: the open game's accent (body[data-game]: Magic's gold, Yu-Gi-Oh!'s violet, Pokémon's coral). */
private val GoldC: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current
/** A .btn's ink on that accent (style.css body[data-game] --gold-ink); [mtg] is the shade this page used on Magic's gold. */
@Composable @androidx.compose.runtime.ReadOnlyComposable
private fun accentInk(mtg: Color) = when (LocalGameGold.current) { CardGame.YGO.gold -> Color(0xFF150A2C); CardGame.PTCG.gold -> Color(0xFF2A0D09); else -> mtg }
/** color-mix(in srgb, var(--gold) [p], [base]). */
@Composable @androidx.compose.runtime.ReadOnlyComposable
private fun goldMix(p: Float, base: Color) = androidx.compose.ui.graphics.lerp(base, LocalGameGold.current, p)
private val FoilInk = Color(0xFF9FD7F0)

private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color)

internal fun cssColor(v: String, current: Color): Color? {
    val s = v.trim()
    if (s.isEmpty() || s == "none" || s == "transparent") return null
    if (s == "currentColor") return current
    if (s.startsWith("#")) {
        val h = s.drop(1)
        val full = when (h.length) { 3 -> h.map { "$it$it" }.joinToString("") + "ff"; 4 -> h.map { "$it$it" }.joinToString(""); 6 -> h + "ff"; 8 -> h; else -> return null }
        val n = full.toLong(16)
        return Color(((n shr 24) and 0xff).toInt(), ((n shr 16) and 0xff).toInt(), ((n shr 8) and 0xff).toInt(), (n and 0xff).toInt())
    }
    Regex("^rgba?\\(([^)]*)\\)$").find(s)?.let { m ->
        val p = m.groupValues[1].split(',', '/', ' ').map { it.trim() }.filter { it.isNotEmpty() }
        fun ch(v: String) = if (v.endsWith("%")) v.dropLast(1).toFloat() / 100f else v.toFloat() / 255f
        return runCatching { Color(ch(p[0]).coerceIn(0f, 1f), ch(p[1]).coerceIn(0f, 1f), ch(p[2]).coerceIn(0f, 1f), p.getOrNull(3)?.let { a -> if (a.endsWith("%")) a.dropLast(1).toFloat() / 100f else a.toFloat() }?.coerceIn(0f, 1f) ?: 1f) }.getOrNull()
    }
    return when (s) { "white" -> Color.White; "black" -> Color.Black; else -> null }
}

// ---------------------------------------------------------------- inline site icons

private fun ellipsePath(cx: Float, cy: Float, rx: Float, ry: Float) = "M${cx - rx},${cy}a$rx,$ry 0 1,0 ${2 * rx},0a$rx,$ry 0 1,0 ${-2 * rx},0z"
private fun rectPath(x: Float, y: Float, w: Float, h: Float, r0: Float): String {
    val r = r0.coerceAtMost(minOf(w, h) / 2)
    return if (r <= 0f) "M$x,${y}h${w}v${h}h${-w}z"
    else "M${x + r},${y}h${w - 2 * r}a$r,$r 0 0 1 $r,$r v${h - 2 * r}a$r,$r 0 0 1 ${-r},$r h${-(w - 2 * r)}a$r,$r 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a$r,$r 0 0 1 $r,${-r}z"
}

/** The icon as a vector, currentColor = [color]; gradient fills (the emblems' url(#…)) span each shape's own box, as SVG's default does. */
private fun SiteSvg.vector(color: Color, stroke: Float? = null): ImageVector {
    val (vx, vy, vw, vh) = vb + List(4 - vb.size.coerceAtMost(4)) { 24f }
    return ImageVector.Builder(defaultWidth = vw.dp, defaultHeight = vh.dp, viewportWidth = vw, viewportHeight = vh).apply {
        for (it in items) {
            val d = when (it.t) {
                "path" -> it.d
                "rect" -> rectPath(it.x - vx, it.y - vy, it.w, it.h, it.rx)
                "circle" -> ellipsePath(it.x - vx, it.y - vy, it.r, it.r)
                "ellipse" -> ellipsePath(it.x - vx, it.y - vy, it.rx, it.ry)
                else -> ""
            }
            if (d.isEmpty()) continue
            val nodes = addPathNodes(d)
            fun paint(v: String): androidx.compose.ui.graphics.Brush? {
                val m = Regex("url\\(#([^)]+)\\)").find(v)
                if (m != null) {
                    val g = grads[m.groupValues[1]] ?: return null
                    val bounds = PathParser().parsePathString(d).toPath().getBounds()
                    val start = Offset(bounds.left + g.x1 * bounds.width, bounds.top + g.y1 * bounds.height)
                    val end = Offset(bounds.left + g.x2 * bounds.width, bounds.top + g.y2 * bounds.height)
                    return Brush.linearGradient(colorStops = g.stops.map { (o, c) -> o to (cssColor(c, color) ?: Color.Transparent) }.toTypedArray(), start = start, end = end)
                }
                return cssColor(v, color)?.let { SolidColor(it) }
            }
            addPath(nodes, fill = paint(it.fill), stroke = paint(it.stroke), strokeLineWidth = stroke ?: it.sw,
                strokeLineCap = when (it.cap) { "round" -> StrokeCap.Round; "square" -> StrokeCap.Square; else -> StrokeCap.Butt },
                strokeLineJoin = when (it.join) { "round" -> StrokeJoin.Round; "bevel" -> StrokeJoin.Bevel; else -> StrokeJoin.Miter })
        }
    }.build()
}

@Composable
internal fun SiteIcon(icon: SiteSvg?, size: Dp, color: Color, modifier: Modifier = Modifier, stroke: Float? = null, filled: Boolean = false) {
    if (icon == null) return
    // [filled]: a rule like .want-tag svg { fill: currentColor } over an outline icon.
    val v = remember(icon, color, stroke, filled) { (if (filled) SiteSvg(icon.vb, icon.items.map { SiteSvg.Item(it.t, it.d, it.x, it.y, it.w, it.h, it.r, it.rx, it.ry,
        "currentColor", it.stroke, it.sw, it.cap, it.join) }, icon.grads) else icon).vector(color, stroke) }
    if (icon.texts.isEmpty()) { Image(rememberVectorPainter(v), null, modifier.size(size)); return }
    val face = remember { android.graphics.Typeface.create(android.graphics.Typeface.SANS_SERIF, android.graphics.Typeface.BOLD) }
    Box(modifier.size(size)) {
        Image(rememberVectorPainter(v), null, Modifier.fillMaxSize())
        androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
            val (vx, vy, vw, vh) = icon.vb + List(4 - icon.vb.size.coerceAtMost(4)) { 24f }
            val k = minOf(this.size.width / vw, this.size.height / vh)
            for (g in icon.texts) {
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                    textSize = g.size * k; typeface = if (g.weight >= 600) face else android.graphics.Typeface.SANS_SERIF
                    this.color = (cssColor(g.fill, color) ?: color).toArgb()
                    textAlign = when (g.anchor) { "middle" -> android.graphics.Paint.Align.CENTER; "end" -> android.graphics.Paint.Align.RIGHT; else -> android.graphics.Paint.Align.LEFT }
                }
                drawContext.canvas.nativeCanvas.drawText(g.text, (g.x - vx) * k, (g.y - vy) * k, paint)
            }
        }
    }
}

// ---------------------------------------------------------------- the page

@Composable
fun CollectionCards(m: CollectionCardsModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionCardsActions = CollectionCardsActions(),
                    nav: @Composable (vertical: Boolean) -> Unit = {}, query: String = m.searchValue,
                    /** The tab shown (cards, binders, value) and, off Cards, what stands in for the list under the tabs. */
                    tab: String = "cards", body: (androidx.compose.foundation.lazy.LazyListScope.(gutter: Dp, narrow: Boolean) -> Unit)? = null) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val screen = maxWidth
        // body[data-game]: the page's --gold is the open game's accent.
        androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides m.game.gold) {
            if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); CardsPage(m, top, act, Modifier.weight(1f).fillMaxHeight(), screen, query, tab, body) }
            else Column(Modifier.fillMaxSize()) { CardsPage(m, top, act, Modifier.weight(1f).fillMaxWidth(), screen, query, tab, body); nav(false) }
        }
    }
}

@Composable
private fun CardsPage(m: CollectionCardsModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionCardsActions, modifier: Modifier, screen: Dp, query: String,
                      tab: String = "cards", body: (androidx.compose.foundation.lazy.LazyListScope.(gutter: Dp, narrow: Boolean) -> Unit)? = null) {
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    val state = rememberLazyListState()
    val reduced = Playmats.reduced(LocalContext.current)
    // .list: one column on a phone, two from 600 dp, three from 1200 (style.css), 6 apart.
    val cols = if (screen >= 1200.dp) 3 else if (wide) 2 else 1
    var trayH by remember { mutableStateOf(0.dp) }
    // A controller: LB/RB step through Cards / Binders / Value, as a tap on the next tab does, stopping at the ends.
    val tabKeys = m.tabs.map { it.key }
    PadScreen(remember(tabKeys, tab, act) { PadActs(tabs = if (tabKeys.size < 2) null else { d -> val i = tabKeys.indexOf(tab).coerceAtLeast(0)
        tabKeys[(i + d).coerceIn(0, tabKeys.lastIndex)].takeIf { it != tab }?.let(act.tab) }) })
    BoxWithConstraints(modifier) {
    val inner = maxWidth - gutter * 2
    LazyColumn(Modifier.fillMaxSize(), state = state, contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        item(key = "top") {
            // As on the app's Home: the game tabs ride in the bar when there is room, and sit centred under it on a phone.
            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                top(if (wide) ({ GameTabs(m.game, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
            }
        }
        item(key = "head") {
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 16.dp else 10.dp)) {
                if (!wide) GameTabs(m.game, act.game, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                Hero(m, act, wide, tab)
                CollTabs(if (tab == "cards") m.tabs else m.tabs.map { CollTab(it.key, it.label, it.key == tab, it.icon) }, act.tab)
                if (body != null) Unit
                else if (m.emptyTitle != null) Empty(m, act)
                else {
                    if (m.game != CardGame.MTG) ValueLine(m, act) else Summary(m.summary)
                    Tools(m, act, wide, query)
                }
            }
        }
        if (body != null) body(gutter, screen < 420.dp)
        else if (m.emptyTitle == null) {
            if (m.rows.isEmpty()) item(key = "none") {
                Text(m.none.ifBlank { "No cards match." }, Modifier.fillMaxWidth().padding(horizontal = gutter).padding(vertical = 24.dp), style = sans(15f, color = Mute), textAlign = TextAlign.Center)
            }
            // Select's rows (style.css @container collection-batch, max-width 480): a lot whose inside is 480 or less puts its tick,
            // picture and name on one line and its value, stepper and Edit on the next.
            val lotW = (inner - 6.dp * (cols - 1)) / cols
            val stacked = lotW - (if (m.mode == "symbols") 18.dp else 14.dp) <= 480.dp
            val row: @Composable (CollRow, Modifier) -> Unit = when (m.mode) {
                "symbols" -> { r, mod -> if (r.mark != null) SelectLot(r, act, wide, reduced, m.glyphs, mod, symbols = true, stacked) else SymbolLot(r, act, wide, reduced, m.glyphs, mod) }
                else -> { r, mod -> if (r.wanted) WantedRow(r, act, wide, reduced, m.glyphs, mod)
                    else if (r.mark != null) SelectLot(r, act, wide, reduced, m.glyphs, mod, symbols = false, stacked) else LotRow(r, act, wide, reduced, m.glyphs, mod) }
            }
            if (m.mode == "gallery") {
                // 18 between lines: the list's own 6 and 12 more.
                val gc = galleryCols(screen, inner)
                val lines = m.rows.chunked(gc)
                items(lines, key = { line -> "g:" + line.joinToString("|") { it.id.ifBlank { it.name } } }) { line ->
                    Row(Modifier.padding(horizontal = gutter).padding(bottom = if (line === lines.last()) 0.dp else 12.dp).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        for (r in line) GalleryLot(r, act, wide, reduced, m.glyphs, Modifier.weight(1f))
                        repeat(gc - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            else if (cols == 1) items(m.rows, key = { it.id.ifBlank { it.name } }) { r -> Box(Modifier.padding(horizontal = gutter)) { row(r, Modifier.fillMaxWidth()) } }
            // A grid line is as tall as its tallest card (grid rows stretch).
            else items(m.rows.chunked(cols), key = { line -> line.joinToString("|") { it.id.ifBlank { it.name } } }) { line ->
                Row(Modifier.padding(horizontal = gutter).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (r in line) row(r, Modifier.weight(1f).fillMaxHeight())
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            m.moreLabel?.let { label ->
                item(key = "more") {
                    Box(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = 6.dp).heightIn(min = 44.dp).clip(RoundedCornerShape(11.dp)).background(GlassFill)
                        .border(1.dp, GlassLine, RoundedCornerShape(11.dp)).clickable(onClick = act.more).padding(horizontal = 14.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
                        Text(label, style = sans(14f, 700))
                    }
                }
            }
            // .actions.wrap: Copy wishlist, Paste a list, Export CSV (btn ghost small), 14 below the list.
            if (m.actions.isNotEmpty()) item(key = "actions") {
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (b in m.actions) Row(Modifier.heightIn(min = 36.dp).clip(RoundedCornerShape(999.dp)).background(GlassFill).border(1.dp, GlassLine, RoundedCornerShape(999.dp))
                        .clickable { act.button(b.act) }.padding(horizontal = 12.dp, vertical = 7.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        SiteIcon(b.icon, 16.dp, Ink)
                        Text(b.label, style = sans(13f, 700, Ink))
                    }
                }
            }
            // The tray rides over the list's foot (position: sticky); this keeps the last cards scrollable above it (its 20 margin).
            if (m.tray != null) item(key = "tray-room") { Spacer(Modifier.height(trayH + 20.dp)) }
        }
    }
    // .batch-tray: sticky 18 above the screen's foot (100 on a phone, over the site's 64 bottom bar: 36 above the app's).
    m.tray?.let { t ->
        val d = androidx.compose.ui.platform.LocalDensity.current
        SelectTray(t, act, Modifier.align(Alignment.BottomCenter).padding(horizontal = gutter).padding(bottom = if (screen <= 700.dp && !sidewaysScreen()) 36.dp else 18.dp)
            .onSizeChanged { trayH = with(d) { it.height.toDp() } })
    }
    }
}

/** tcg.js .coll-summary: the collection's value (28 px, 800; it opens Value), then copies and wishlist in muted 13 px; the refresh button at the right. */
@Composable
private fun ValueLine(m: CollectionCardsModel, act: CollectionCardsActions) {
    if (m.summary.isEmpty()) return
    Row(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.weight(1f).clickable { act.tab("value") }.semantics { contentDescription = "See collection value" }, horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Bottom) {
            m.summary.firstOrNull { it.bold }?.let { Text(it.t, style = sans(28f, 800, Ink, lh = 1.1f, ls = -.56f)) }
            Text(m.summary.filter { !it.bold }.joinToString("") { it.t }, Modifier.padding(bottom = 3.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(13f, 400, Mute))
        }
        if (m.refresh != null) Box(Modifier.size(40.dp).clip(CircleShape).background(GlassFill).border(1.dp, GlassLine, CircleShape).clickable(onClick = act.refresh)
            .semantics { contentDescription = m.refreshLabel }, contentAlignment = Alignment.Center) { SiteIcon(m.refresh, 20.dp, Ink) }
    }
}

/** A Yu-Gi-Oh! or Pokémon lot's .lot-sub: emblems (16 dp), .hp / .lvl (13 px 800), the set badge (.tset) and the words after it. */
@Composable
internal fun PieceItems(pieces: List<CollPiece>) {
    var i = 0
    while (i < pieces.size) {
        val p = pieces[i]
        if (p.k == "set") {
            var j = i + 1; while (j < pieces.size && pieces[j].set) j++
            SetBadge(p, pieces.subList(i + 1, j)); i = j; continue
        }
        when (p.k) {
            "svg" -> SiteIcon(p.icon, 16.dp, Ink, Modifier.semantics { if (p.alt.isNotBlank()) contentDescription = p.alt })
            "img" -> PieceImg(p, 16.dp, 16.dp)
            else -> if (p.t.isNotBlank()) Text(p.t.trim(), maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = if (p.strong) sans(13f, 800, Ink) else sans(12f, 400, Mute, lh = 1.35f))
        }
        i++
    }
}

/** .tset: 1 × 6 padding, 6 corners on surface-2 with its line; set symbol (16) and rarity mark (11 tall), the code bold 11 px, the number 10 px muted (or its rarity's tint). */
@Composable
private fun SetBadge(head: CollPiece, parts: List<CollPiece>) {
    Row(Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0xFF171A20)).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 1.dp)
        .semantics { contentDescription = head.title }, horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        val tint = when (head.tone) { "super" -> Color(0xFF9AD0FF); "ultra" -> Color(0xFFFFD166); "secret" -> Color(0xFFFF8FD8); "rare" -> Color(0xFFCFD6E0); else -> Mute }
        for (p in parts) when (p.k) {
            "img" -> if (p.alt.isNotBlank() && p.src.contains("/pks/s/")) PieceImg(p, 16.dp, 16.dp) else PieceImg(p, 28.dp, 11.dp)
            "svg" -> SiteIcon(p.icon, 12.dp, Ink)
            else -> if (p.t.isNotBlank()) Text(p.t.trim(), style = if (p.small) sans(10f, 700, tint) else sans(11f, 700, Ink))
        }
    }
}

// img.pks and img.pkr.ink: black ink the site turns light (invert(1) hue-rotate(180deg)).
// The two in one matrix: CSS's hue-rotate(180deg) rows (H) applied to 255 − x, i.e. −H with 255 added (each row of H sums to 1).
private val InvertInk = androidx.compose.ui.graphics.ColorFilter.colorMatrix(androidx.compose.ui.graphics.ColorMatrix(floatArrayOf(
    .574f, -1.43f, -.144f, 0f, 255f, -.426f, -.43f, -.144f, 0f, 255f, -.426f, -1.43f, .856f, 0f, 255f, 0f, 0f, 0f, 1f, 0f)))

@Composable
private fun PieceImg(p: CollPiece, w: Dp, h: Dp) {
    val painter = heroPainter(p.src.takeIf { it.isNotBlank() }?.let(homeArt)) ?: return
    val symbol = p.src.contains("/pks/s/")
    Image(painter, p.alt.ifBlank { null }, Modifier.heightIn(max = h).widthIn(max = w).then(if (symbol) Modifier.size(w, h) else Modifier.height(h)),
        contentScale = ContentScale.Fit, colorFilter = if (symbol || p.ink) InvertInk else null)
}

// ---------------------------------------------------------------- header: banner art, title, view switch, Select, ⋯

@Composable
private fun Hero(m: CollectionCardsModel, act: CollectionCardsActions, wide: Boolean, tab: String = "cards") {
    val shape = RoundedCornerShape(if (wide) 22.dp else 18.dp)
    // .page-hero: 140 tall on a phone (180, padding 22/26 and 22 corners from 600 dp), a 1 px gold-glass edge and a deep shadow;
    // the art (your own card, cover at 50 % 30 %, scaled 1.02) under the left-to-right and bottom shades (.page-hero-art::after).
    Box(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 6.dp).shadow(28.dp, shape, ambientColor = Color.Black.copy(alpha = .3f), spotColor = Color.Black.copy(alpha = .47f))
        .clip(shape).background(Color(0xFF101318)).heightIn(min = if (wide) 180.dp else 140.dp)) {
        val p = heroPainter(m.banner?.let(homeArt))
        if (p != null) Image(p, null, Modifier.matchParentSize().graphicsLayer { scaleX = 1.02f; scaleY = 1.02f }, contentScale = ContentScale.Crop,
            alignment = androidx.compose.ui.BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0.12f to Color(0xF007080B), .48f to Color(0x8007080B), 1f to Color(0x1F07080B))))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Transparent, .35f to Color.Transparent, 1f to Color(0xC707080B))))
        Box(Modifier.matchParentSize().border(1.dp, GlassLine, shape))
        val title = @Composable { mod: Modifier ->
            Text(m.title, mod, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 30.sp, lineHeight = 34.5.sp, letterSpacing = .6.sp, color = Color(0xFFF6EEDB),
                shadow = if (wide) androidx.compose.ui.graphics.Shadow(Color(0xCC000000), Offset(0f, 2f), 14f) else null))
        }
        // From 600 dp the title sits at the foot of the banner and the actions at its top right; a phone stacks them.
        if (wide) Box(Modifier.matchParentSize().padding(horizontal = 26.dp, vertical = 22.dp)) {
            title(Modifier.align(Alignment.BottomStart))
            HeroActions(m, act, wide, Modifier.align(Alignment.TopEnd), tab)
        } else Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            title(Modifier)
            HeroActions(m, act, wide, Modifier, tab)
        }
    }
}

@Composable
private fun HeroActions(m: CollectionCardsModel, act: CollectionCardsActions, wide: Boolean, modifier: Modifier, tab: String = "cards") {
    // views.js collection(): the view switch and Select are the Cards tab's; ⋯ stays on every tab (tcg.js's Binders and Value heads carry none).
    val cards = tab == "cards"
    if (!cards && m.game != CardGame.MTG) return
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (cards && m.views.isNotEmpty()) Row(Modifier.clip(RoundedCornerShape(12.dp)).background(GlassFill).border(1.dp, GlassLine, RoundedCornerShape(12.dp)).padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            // workbench-ui.js viewControl: the account's view for this game (modeFor) is the one lit.
            for (v in m.views) {
                val on = v.mode == m.mode
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(9.dp)).then(if (on) Modifier.background(goldMix(.18f, Color(0xFF1F232B))).border(1.dp, GoldC.copy(alpha = .35f), RoundedCornerShape(9.dp)) else Modifier)
                    .clickable { if (!on) act.view(v.mode) }.semantics { contentDescription = v.label; role = Role.RadioButton }, contentAlignment = Alignment.Center) {
                    SiteIcon(v.icon, 20.dp, if (on) GoldC else Mute)
                }
            }
        }
        // .tool-btn: the gold icon, and from 600 dp its word ("Select") beside it.
        // .tool-btn.on (Select is on, "Done"): gold 12 % into the surface, its edge gold at 50 %.
        if (cards && m.selectIcon != null) Row(Modifier.heightIn(min = 44.dp).then(if (wide && m.selectText.isNotBlank()) Modifier else Modifier.width(44.dp)).clip(RoundedCornerShape(11.dp))
            .background(if (m.selectOn) goldMix(.12f, Color(0xFF171A20)) else GlassFill).border(1.dp, if (m.selectOn) GoldC.copy(alpha = .5f) else GlassLine, RoundedCornerShape(11.dp))
            .clickable(onClick = act.select).semantics { selected = m.selectOn }
            .semantics { contentDescription = m.selectLabel.ifBlank { "Select cards" } }.padding(horizontal = if (wide) 12.dp else 0.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
            SiteIcon(m.selectIcon, 18.dp, GoldC)
            if (wide && m.selectText.isNotBlank()) Text(m.selectText, style = sans(13.5f, 700, Ink))
        }
        // .icon: ⋯ drawn as icons.js "more".
        if (m.menu.isNotBlank()) Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Surface2).border(1.dp, LineC, RoundedCornerShape(12.dp))
            .clickable(onClick = act.menu).semantics { contentDescription = m.menuLabel }, contentAlignment = Alignment.Center) {
            val more = m.glyphs["more"]
            if (m.menu.trim() == "⋯" && more != null) SiteIcon(more, 20.dp, Ink) else Text(m.menu, style = sans(17f, 400, Ink))
        }
    }
}

// ---------------------------------------------------------------- Cards / Binders / Value

/** ui.js segmented(): Collection's Cards / Binders / Value, Decks' My decks / Ideas / Meta decks. */
@Composable
internal fun CollTabs(tabs: List<CollTab>, onTab: (String) -> Unit) {
    if (tabs.isEmpty()) return
    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp).drawBehind {
        drawLine(GlassLine, Offset(0f, size.height - .5f), Offset(size.width, size.height - .5f), 1.dp.toPx())
    }.padding(horizontal = 2.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        val gold = GoldC
        for (t in tabs) {
            val on = t.on
            Row(Modifier.weight(1f).heightIn(min = 44.dp).drawBehind {
                if (on) {
                    // .glide: a gold glow from the bottom edge and a 2 px gold line fading out at both ends.
                    drawRect(Brush.radialGradient(listOf(gold.copy(alpha = .24f), Color.Transparent), Offset(size.width / 2, size.height), size.width * .6f * .7f),
                        topLeft = Offset.Zero, size = size)
                    drawRect(Brush.horizontalGradient(.18f to Color.Transparent, .5f to gold, .82f to Color.Transparent), Offset(0f, size.height - 2.dp.toPx()), Size(size.width, 2.dp.toPx()))
                }
            }.clickable { if (!on) onTab(t.key) }.semantics { role = Role.Tab }.padding(horizontal = 6.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                SiteIcon(t.icon, 16.dp, if (on) Ink else Mute.copy(alpha = .75f))
                // A label too long for its share (130% text) wraps under itself rather than being cut.
                Text(t.label, maxLines = 2, textAlign = androidx.compose.ui.text.style.TextAlign.Center, style = sans(13.5f, if (on) 750 else 650, if (on) Ink else Mute, ls = -.135f))
            }
        }
    }
}

// ---------------------------------------------------------------- summary, sort, search, filter

@Composable
private fun Summary(runs: List<CollRun>) {
    if (runs.isEmpty()) return
    Text(buildAnnotatedString {
        for (r in runs) withStyle(SpanStyle(color = if (r.bold) Ink else Mute, fontWeight = if (r.bold) FontWeight.Bold else FontWeight.Normal)) { append(r.t) }
    }, style = sans(13.5f, 400, Mute))
}

@Composable
private fun Tools(m: CollectionCardsModel, act: CollectionCardsActions, wide: Boolean, query: String) {
    // .coll-tools: sort and direction (6 apart), then search, then the filter pill; from 600 dp all four share one line
    // (sort 150, direction 112, search the rest, the filter 152 at the end). 12 above the list.
    if (wide) Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        m.sort?.let { Pick(it, act.sort, Modifier.width(150.dp), big = true, stretch = true) }
        m.direction?.let { Pick(it, act.direction, Modifier.padding(start = 6.dp).width(112.dp), big = true, stretch = true) }
        Search(query, m.searchPlaceholder, act.search, Modifier.padding(start = 8.dp).weight(1f))
        m.filter?.let { Pick(it, act.filter, Modifier.padding(start = 8.dp).width(152.dp), big = false, stretch = true) }
    } else Column(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            m.sort?.let { Pick(it, act.sort, Modifier.weight(1f), big = true, stretch = true) }
            m.direction?.let { Pick(it, act.direction, Modifier, big = true) }
        }
        Search(query, m.searchPlaceholder, act.search, Modifier.fillMaxWidth())
        Row { m.filter?.let { Pick(it, act.filter, Modifier, big = false) } }
    }
    // .filter-pills (Yu-Gi-Oh! and Pokémon): set, kind, rarity and owned or wishlist, 8 apart, scrolling sideways.
    if (m.filters.isNotEmpty()) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (f in m.filters) Pick(f, { v -> act.pick(f.name, v) }, Modifier.widthIn(max = 260.dp), big = false)
    }
}

/** A site <select> pill: the chosen option and a ▾ at its right edge; the options open under it, as the phone's own picker would. */
@Composable
internal fun Pick(sel: CollSelect, onPick: (String) -> Unit, modifier: Modifier, big: Boolean, stretch: Boolean = false) {
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(999.dp)
    Box(modifier) {
        Row(Modifier.then(if (stretch) Modifier.fillMaxWidth() else Modifier).heightIn(min = if (big) 44.dp else 36.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape).clickable { open = true }
            .semantics { contentDescription = sel.label }.padding(start = if (big) 11.dp else 12.dp, end = 12.dp, top = if (big) 9.dp else 6.dp, bottom = if (big) 9.dp else 6.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(sel.current?.label ?: "", Modifier.weight(1f, fill = stretch), maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = sans(if (big) 12f else 13f, 700, Ink, ls = if (big) -.1f else 0f))
            Text("▼", style = sans(9f, 400, Ink.copy(alpha = .8f)))
        }
        DropdownMenu(open, { open = false }, containerColor = Color(0xFF1A1E26)) {
            for (o in sel.options) DropdownMenuItem(text = { Text(o.label, style = sans(14f, if (o.on) 700 else 400, if (o.on) GoldC else Ink)) }, onClick = { open = false; if (!o.on) onPick(o.value) })
        }
    }
}

@Composable
internal fun Search(value: String, placeholder: String, onChange: (String) -> Unit, modifier: Modifier) {
    val shape = RoundedCornerShape(11.dp)
    BasicTextField(value, onChange, modifier.heightIn(min = 44.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape),
        singleLine = true, textStyle = sans(15f, 400, Ink), cursorBrush = SolidColor(GoldC),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        decorationBox = { inner ->
            Box(Modifier.padding(horizontal = 12.dp, vertical = 9.dp), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) Text(placeholder, style = sans(15f, 400, Mute), maxLines = 1, overflow = TextOverflow.Ellipsis)
                inner()
            }
        })
}

// ---------------------------------------------------------------- the rows (.lot, compact view)

/** .lot[data-tier]::before in the compact view: a ring 2 px wide (2.5 purple and gold, 3 orange) whose colours slide along it. */
private class Ring(val width: Float, val tile: Float, val vertical: Boolean, val period: Int, val reverse: Boolean, val stops: List<Pair<Float, Color>>,
                   /** .lot[data-tier] box-shadow 0 0 blur spread colour: gold 16 / -10, orange 18 / -8 (breathing to 22 / -6 #ff5a10). */
                   val glow: Color? = null, val glowBlur: Float = 0f, val glowSpread: Float = 0f,
                   /** t1: fx-pulse, brightness .9 to 1.15 every 2.6 s. t5: a pale glint (160 tile) running right over the fire. */
                   val pulse: Boolean = false, val glint: Boolean = false)
private val RINGS = mapOf(
    "t0" to Ring(2f, 320f, false, 7000, false, listOf(0f to Color(0xFF6F7780), .38f to Color(0xFF6F7780), .5f to Color(0xFFE9EEF2), .62f to Color(0xFF6F7780), 1f to Color(0xFF6F7780))),
    "t1" to Ring(2f, 260f, false, 5000, false, listOf(0f to Color(0xFF1F8A50), .2f to Color(0xFF2FAE68), .25f to Color(0xFFC4FFDE), .3f to Color(0xFF2FAE68), .5f to Color(0xFF1F8A50),
        .7f to Color(0xFF2FAE68), .75f to Color(0xFFC4FFDE), .8f to Color(0xFF2FAE68), 1f to Color(0xFF1F8A50)), pulse = true),
    "t2" to Ring(2f, 200f, false, 3600, true, listOf(0f to Color(0xFF1D5FB0), .3f to Color(0xFF2F7FE0), .45f to Color(0xFFE2F4FF), .5f to Color(0xFF7FC3FF), .65f to Color(0xFF2F7FE0), 1f to Color(0xFF1D5FB0))),
    "t3" to Ring(2.5f, 360f, true, 4500, true, listOf(0f to Color(0xFFB46CFF), .2f to Color(0xFF6FD0FF), .4f to Color(0xFFFF7AD9), .6f to Color(0xFFFFE27A), .8f to Color(0xFF7DFFB2), 1f to Color(0xFFB46CFF))),
    "t4" to Ring(2.5f, 240f, false, 2400, false, listOf(0f to Color(0xFF9A6F08), .3f to Color(0xFFE2B53A), .42f to Color(0xFFFFD34D), .5f to Color(0xFFFFFBE6), .58f to Color(0xFFFFD34D),
        .7f to Color(0xFFE2B53A), 1f to Color(0xFF9A6F08)), glow = Color(0xFFFFD34D), glowBlur = 16f, glowSpread = -10f),
    "t5" to Ring(3f, 140f, true, 1600, true, listOf(0f to Color(0xFFA3330A), .25f to Color(0xFFFF7A1A), .5f to Color(0xFFFFB050), .75f to Color(0xFFFF5A10), 1f to Color(0xFFA3330A)), glow = Color(0xFFFF7A1A), glowBlur = 18f, glowSpread = -8f, glint = true),
)

private fun tierColor(css: String): Color? = cssColor(css, Color.Transparent)
/** color-mix(in srgb, var(--tier) 70%, var(--text)). */
private fun mixed(tier: Color?, p: Float = .7f) = tier?.let { Color(it.red * p + Ink.red * (1 - p), it.green * p + Ink.green * (1 - p), it.blue * p + Ink.blue * (1 - p)) } ?: Ink

private val LOT_BG = Brush.linearGradient(listOf(Color(0x0BFFFFFF), Color(0x00FFFFFF)), Offset.Zero, Offset(300f, 520f))

/**
 * A CSS outer box-shadow: drawn only outside the rounded box (box-shadow never shows through a see-through background, which
 * an elevation shadow would), [blur] and [spread] in dp as CSS gives them.
 */
internal fun DrawScope.outerShadow(color: Color, blur: Float, dy: Float, spread: Float, corner: Float) {
    val r = corner.dp.toPx(); val sp = spread.dp.toPx()
    val outline = Path().apply { addRoundRect(RoundRect(Rect(Offset.Zero, size), CornerRadius(r))) }
    clipPath(outline, androidx.compose.ui.graphics.ClipOp.Difference) {
        drawIntoCanvas { c ->
            // CSS blur b is a Gaussian of sigma b/2; Android's shadow radius maps to sigma as radius * .57735 + .5.
            val radius = ((blur.dp.toPx() / 2f - .5f) / .57735f).coerceAtLeast(.5f)
            val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { this.color = color.toArgb(); setShadowLayer(radius, 0f, dy.dp.toPx(), color.toArgb()) }
            c.nativeCanvas.drawRoundRect(-sp, -sp, size.width + sp, size.height + sp, (r + sp).coerceAtLeast(0f), (r + sp).coerceAtLeast(0f), paint)
        }
    }
}

private val GLINT = listOf(Color(0x00FFF0BE), Color(0xD9FFF0BE), Color(0x00FFF0BE))

@Composable
internal fun Modifier.lotFrame(r: CollRow, reduced: Boolean): Modifier {
    val shape = RoundedCornerShape(12.dp)
    val ring = RINGS[r.tier]
    // A wishlist row keeps its tier ring at .4 and still (.lot.wanted::before), over the dashed edge's faint hatching.
    val moving = ring != null && !reduced && !r.wanted && !Motion.still
    val t = if (moving) rememberInfiniteTransition(label = "ring") else null
    val phase = t?.animateFloat(0f, 1f, infiniteRepeatable(tween(ring!!.period, easing = LinearEasing), RepeatMode.Restart), label = "slide")
    val pulse = if (ring?.pulse == true) t?.animateFloat(.9f, 1.15f, infiniteRepeatable(tween(2600, easing = androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse), label = "pulse") else null
    val breathe = if (ring?.glint == true) t?.animateFloat(0f, 1f, infiniteRepeatable(tween(1800, easing = androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse), label = "glow") else null
    return this
        .drawBehind {
            // rgba(0,0,0,.22) 0 10px 30px; the gold and orange tiers add their glow (orange breathes: 12 / -8 #ff7a1a to 22 / -6 #ff5a10).
            outerShadow(Color(0x38000000), 30f, 10f, 0f, 12f)
            val glow = ring?.glow
            if (glow != null) {
                val b = breathe?.value
                if (b == null) outerShadow(glow, ring.glowBlur, 0f, ring.glowSpread, 12f)
                else outerShadow(androidx.compose.ui.graphics.lerp(Color(0xFFFF7A1A), Color(0xFFFF5A10), b), 12f + 10f * b, 0f, -8f + 2f * b, 12f)
            }
        }
        .clip(shape).background(Surface46).then(if (r.wanted) Modifier else Modifier.background(LOT_BG))
        .drawWithContent {
            if (r.wanted) {
                // repeating-linear-gradient(135deg, transparent 0 9px, text 3.5% 9px 10px)
                val step = 10.dp.toPx(); var x = -size.height
                while (x < size.width) { drawLine(Ink.copy(alpha = .035f), Offset(x, size.height), Offset(x + size.height, 0f), 1.dp.toPx()); x += step }
            }
            drawContent()
            val px = 1.dp.toPx()
            // inset 0 1px 0 rgba(255,255,255,.07), inset 0 0 0 1px rgba(255,255,255,.024)
            if (!r.wanted) drawRect(Color(0x12FFFFFF), Offset(0f, 0f), Size(size.width, px))
            if (ring == null) {
                drawRoundRect(LineC, cornerRadius = CornerRadius(12.dp.toPx()), topLeft = Offset(px / 2, px / 2), size = Size(size.width - px, size.height - px),
                    style = Stroke(px, pathEffect = if (r.wanted) androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())) else null))
                return@drawWithContent
            }
            val w = ring.width.dp.toPx(); val tile = ring.tile.dp.toPx(); val p = phase?.value ?: 0f
            val shift = p * tile * (if (ring.reverse) -1 else 1)
            val shader = if (ring.vertical) LinearGradientShader(Offset(0f, shift), Offset(0f, shift + tile), ring.stops.map { it.second }, ring.stops.map { it.first }, TileMode.Repeated)
                else LinearGradientShader(Offset(shift, 0f), Offset(shift + tile, 0f), ring.stops.map { it.second }, ring.stops.map { it.first }, TileMode.Repeated)
            val outer = RoundRect(Rect(Offset.Zero, size), CornerRadius(12.dp.toPx()))
            val inner = RoundRect(Rect(Offset(w, w), Size(size.width - 2 * w, size.height - 2 * w)), CornerRadius((12.dp.toPx() - w).coerceAtLeast(0f)))
            val path = Path().apply { fillType = PathFillType.EvenOdd; addRoundRect(outer); addRoundRect(inner) }
            val bright = pulse?.value?.let { b -> androidx.compose.ui.graphics.ColorFilter.colorMatrix(androidx.compose.ui.graphics.ColorMatrix(floatArrayOf(b, 0f, 0f, 0f, 0f, 0f, b, 0f, 0f, 0f, 0f, 0f, b, 0f, 0f, 0f, 0f, 0f, 1f, 0f))) }
            drawPath(path, ShaderBrush(shader), alpha = if (r.wanted) .4f else 1f, colorFilter = bright)
            if (ring.glint) {
                val g = 160.dp.toPx(); val gs = p * g
                drawPath(path, ShaderBrush(LinearGradientShader(Offset(gs, 0f), Offset(gs + g, 0f), GLINT, listOf(0f, .5f, 1f), TileMode.Repeated)), alpha = if (r.wanted) .4f else 1f)
            }
        }
}

/**
 * One .lot in the compact view. A phone: art (52 × 73, top) | name, sub, and under them price + condition on the left and the
 * stepper + Edit on the right; 9 / 11 in from the edge. From 600 dp the grid is 58 × 80 art | info | an 88 wide side column (wider
 * when big text needs it for the price and its condition badge, which the site lets spill over the name instead)
 * (value top right, the stepper, Edit) with 7 around, everything centred on the row.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LotRow(r: CollRow, act: CollectionCardsActions, wide: Boolean, reduced: Boolean, glyphs: Map<String, SiteSvg>, modifier: Modifier) {
    val tier = tierColor(r.tierColor)
    val value = @Composable { gap: Dp -> LotValue(r, act, sans(13f, 700, mixed(tier)), gap) }
    val edit = @Composable { mod: Modifier -> LotEdit(r, act, mod, if (wide) 0.dp else 4.dp) }
    if (wide) Row(modifier.lotFrame(r, reduced).padding(7.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        LotArt(r, Modifier.lotPad(r, act), 58.dp, 80.dp) { act.open(r) }
        Info(r, act, wide, Modifier.weight(1f))
        Column(Modifier.widthIn(min = 88.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) {
            value(4.dp)
            Stepper(r.qty, glyphs, { act.qty(r, -1) }, { act.qty(r, 1) })
            edit(Modifier)
        }
    } else Row(modifier.lotFrame(r, reduced).padding(horizontal = 11.dp, vertical = 9.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        LotArt(r, Modifier.lotPad(r, act), 52.dp, 73.dp) { act.open(r) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Info(r, act, wide, Modifier)
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                value(6.dp)
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Stepper(r.qty, glyphs, { act.qty(r, -1) }, { act.qty(r, 1) })
                    edit(Modifier.heightIn(min = 44.dp))
                }
            }
        }
    }
}

/** .lot-value: the price (tap: where to buy it), the condition chip, and where the price came from when it is yours. */
@Composable
private fun LotValue(r: CollRow, act: CollectionCardsActions, price: TextStyle, gap: Dp) {
    Row(horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.CenterVertically) {
        Text(r.price, Modifier.clickable { act.price(r) }.padding(vertical = 4.dp), style = price)
        // .condition-badge (polish.css; a touch screen's 38 × 26 at least): flex none, so it never wraps or shrinks.
        if (r.condition.isNotBlank()) Box(Modifier.widthIn(min = 38.dp).heightIn(min = 26.dp).clip(RoundedCornerShape(999.dp)).background(Surface2).border(1.dp, LineC, RoundedCornerShape(999.dp))
            .semantics { contentDescription = r.conditionInfo }.padding(horizontal = 8.dp, vertical = 2.dp), contentAlignment = Alignment.Center) {
            Text(r.condition, style = sans(11.5f, 750, Mute, lh = 1f, ls = .345f), maxLines = 1, softWrap = false)
        }
        if (r.origin.isNotBlank()) Text(r.origin, style = sans(11f, 700, GoldC))
    }
}

/** .lot-side .link.small: "Edit" in gold, 13 / 600, 4 above and below. */
@Composable
private fun LotEdit(r: CollRow, act: CollectionCardsActions, modifier: Modifier, side: Dp = 0.dp) {
    if (r.edit) Box(modifier.clickable { act.edit(r) }.padding(vertical = 4.dp, horizontal = side), contentAlignment = Alignment.Center) { Text("Edit", style = sans(13f, 600, GoldC)) }
}

/** .lot-info: the name line, the sub line (mana, set and number, finish), and a printing or binder tag. */
@Composable
private fun Info(r: CollRow, act: CollectionCardsActions, wide: Boolean, modifier: Modifier, nameSize: Float = if (wide) 16f else 15f) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(if (wide || nameSize >= 16f) 2.dp else 1.dp)) {
        NameLine(r, act, wide, nameSize)
        SubLine(r)
        if (r.tag.isNotBlank()) Tag(r.tag, r.tagWarn) { if (r.tagWarn) act.edit(r) }
    }
}

/** .lot.wanted: a card on the wishlist you don't own. Greyed art with a heart, "Not owned" / "Need n", the price muted, ＋ Got it and ×. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WantedRow(r: CollRow, act: CollectionCardsActions, wide: Boolean, reduced: Boolean, glyphs: Map<String, SiteSvg>, modifier: Modifier) {
    val actions = @Composable {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            // .btn.small.want-got: gold, 32 tall, the leading ＋ drawn as icons.js "plus" at 1.2 em, stroke 2.
            if (r.got.isNotBlank()) Row(Modifier.heightIn(min = 32.dp).clip(RoundedCornerShape(11.dp)).background(GoldC).clickable { act.got(r) }.padding(horizontal = 11.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                val lead = r.got.trimStart().firstOrNull()?.let { it == '＋' || it == '+' } == true
                if (lead) SiteIcon(glyphs["plus"], 16.dp, accentInk(Color(0xFF1A1408)), stroke = 2f)
                Text(if (lead) r.got.trimStart().drop(1).trim() else r.got, style = sans(13.5f, 700, accentInk(Color(0xFF1A1408))))
            }
            Box(Modifier.size(32.dp).clip(CircleShape).border(1.dp, LineC, CircleShape).clickable { act.unwish(r) }.semantics { contentDescription = "Remove ${r.name} from wishlist" }, contentAlignment = Alignment.Center) {
                Text("×", style = sans(18f, 400, Mute, lh = 1f))
            }
        }
    }
    val price = @Composable { Text(r.price, style = sans(13f, 700, Mute)) }
    if (wide) Row(modifier.lotFrame(r, reduced).padding(7.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        LotArt(r, Modifier.lotPad(r, act), 58.dp, 80.dp, grey = true, heart = glyphs["heart"]) { act.open(r) }
        WantInfo(r, act, wide, Modifier.weight(1f))
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) { price(); actions() }
    } else Row(modifier.lotFrame(r, reduced).padding(horizontal = 11.dp, vertical = 9.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        LotArt(r, Modifier.lotPad(r, act), 52.dp, 73.dp, grey = true, heart = glyphs["heart"]) { act.open(r) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            WantInfo(r, act, wide, Modifier)
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                price()
                Spacer(Modifier.weight(1f))
                actions()
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WantInfo(r: CollRow, act: CollectionCardsActions, wide: Boolean, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(if (wide) 2.dp else 1.dp)) {
        Text(r.name, Modifier.lotPad(r, act).clickable { act.open(r) }, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(if (wide) 16f else 15f, 700, Ink.copy(alpha = .72f), lh = 1.25f))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            // .want-chip: rose on a rose wash, 11 px bold.
            if (r.wantChip.isNotBlank()) Box(Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0x1FFF7896)).padding(horizontal = 8.dp, vertical = 1.dp)) {
                Text(r.wantChip, style = sans(11f, 700, Color(0xFFFF8FA3)))
            }
            if (r.pieces.isNotEmpty()) PieceItems(r.pieces)
            if (r.mana.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) { r.mana.forEach { (src, alt) -> Mana(src, alt) } }
            r.sub.forEach { Text(it.t, style = sans(12f, 400, Mute, lh = 1.35f)) }
        }
    }
}

private val Greyed = androidx.compose.ui.graphics.ColorFilter.colorMatrix(androidx.compose.ui.graphics.ColorMatrix().apply { setToSaturation(0f) }.also { g ->
    // grayscale(1) brightness(.6)
    g.timesAssign(androidx.compose.ui.graphics.ColorMatrix(floatArrayOf(.6f, 0f, 0f, 0f, 0f, 0f, .6f, 0f, 0f, 0f, 0f, 0f, .6f, 0f, 0f, 0f, 0f, 0f, 1f, 0f)))
})

/** .lot-art: [w] × [h] at 9 dp corners on the surface-2 plate, the card's own picture (and its foil) inside at 6 dp. */
@Composable
internal fun LotArt(r: CollRow, modifier: Modifier, w: Dp, h: Dp, grey: Boolean = false, heart: SiteSvg? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(9.dp)
    Box(modifier.size(w, h).clip(shape).background(Surface2).clickable(onClick = onClick).semantics { contentDescription = "Open ${r.name}" }, contentAlignment = Alignment.Center) {
        if (r.art != null && grey) {
            // .lot.wanted .lot-art: the picture greyed and dimmed at .8, a 1.5 dashed edge and a soft sheen; the heart tag at its foot.
            val p = heroPainter(homeArt(r.art))
            if (p != null) Image(p, null, Modifier.fillMaxSize().clip(RoundedCornerShape(6.dp)), contentScale = ContentScale.Fit, colorFilter = Greyed, alpha = .8f)
            Box(Modifier.matchParentSize().drawBehind {
                    // linear-gradient(160deg, rgba(255,255,255,.16), transparent 42%)
                    val dx = .342f; val dy = .940f; val half = (size.width * dx + size.height * dy) / 2
                    drawRect(Brush.linearGradient(0f to Color(0x29FFFFFF), .42f to Color.Transparent, start = center - Offset(dx * half, dy * half), end = center + Offset(dx * half, dy * half)))
                    val px = 1.5.dp.toPx()
                    drawRoundRect(Ink.copy(alpha = .4f), topLeft = Offset(px / 2, px / 2), size = Size(size.width - px, size.height - px), cornerRadius = CornerRadius(9.dp.toPx()),
                        style = Stroke(px, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
                })
            if (heart != null) Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 3.dp).clip(RoundedCornerShape(99.dp)).background(Color(0xD10A0A10))
                .border(1.dp, Color(0x55FF8FA3), RoundedCornerShape(99.dp)).padding(3.dp)) { SiteIcon(heart, 12.dp, Color(0xFFFF8FA3), filled = true) }
        } else if (r.art != null && r.tcgFinish != null) {
            TcgLotPicture(r.art, r.tcgFinish, r.id, Modifier.fillMaxSize(), RoundedCornerShape(6.dp))
        } else if (r.art != null) {
            // finish-preview.js on the thumbnail: a copy in a finish wears it, shimmering on its own (no tilt in a list).
            val context = LocalContext.current
            val data = if (r.print != null) CardData.ready.collectAsState().value.also { if (it == null) CardData.warm(context) } else null
            val finish = Foil.finishFor(r.print, r.finishKey.ifBlank { "nonfoil" })
            val look = data?.let { Foil.look(it, r.print, finish) }?.takeIf { it.shines }
            val tilt = if (look != null) rememberFoilTilt(live = true, phase = (r.id.hashCode() and 0xff) / 255f, tile = true) else null
            CardPicture(r.art, look, tilt, Modifier.fillMaxSize(), RoundedCornerShape(6.dp))
        } else Text(r.fallback.ifBlank { "◇" }, Modifier.padding(4.dp), style = sans(10f, 400, Mute), textAlign = TextAlign.Center)
    }
}

/** .lot-name: one line, cut with an ellipsis; the importance emblem and the set badge follow it. */
@Composable
private fun NameLine(r: CollRow, act: CollectionCardsActions, wide: Boolean, size: Float = if (wide) 16f else 15f) {
    Row(Modifier.lotPad(r, act).clickable { act.open(r) }, verticalAlignment = Alignment.CenterVertically) {
        Text(r.name, Modifier.weight(1f, fill = false), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(size, 700, Ink, lh = 1.25f))
        if (r.emblem != null) SiteIcon(r.emblem, 16.dp, Ink, Modifier.padding(start = 4.dp).semantics { contentDescription = r.emblemTitle })
        r.set?.let { s -> Box(Modifier.padding(start = 5.dp)) { LotSetBadge(s, wide) { if (!s.unknown) act.set(s.code) } } }
    }
}

/** .set-badge inside a row name: 8 sp tracked code, the set symbol (10 dp, 12 from 600 dp) in its rarity colours, rarity-tinted ink. */
@Composable
internal fun LotSetBadge(s: CollSet, wide: Boolean, onClick: () -> Unit) {
    // .set-badge (style.css): #d9d3bc, .r-uncommon #bbced1, .r-rare #d2b271, .r-mythic #ef9674, .unknown #929a90.
    val ink = when (s.rarity) { "mythic" -> Color(0xFFEF9674); "rare" -> Color(0xFFD2B271); "uncommon" -> Color(0xFFBBCED1); else -> Color(0xFFD9D3BC) }
    Row(Modifier.clip(RoundedCornerShape(5.dp)).background(Color(0xFF252B25)).border(1.dp, LineC, RoundedCornerShape(5.dp)).clickable(onClick = onClick)
        .semantics { contentDescription = s.title }.padding(horizontal = if (wide) 5.dp else 4.dp, vertical = if (wide) 2.dp else 1.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        if (!s.unknown && s.code.isNotBlank()) RaritySetIcon(s.code.lowercase(), s.rarity, if (wide) 12.dp else 10.dp)
        Text(s.label, maxLines = 1, style = sans(8f, 600, if (s.unknown) Color(0xFF929A90) else ink, lh = 1.4f, ls = .28f))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SubLine(r: CollRow) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        if (r.pieces.isNotEmpty()) PieceItems(r.pieces)
        if (r.mana.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) { r.mana.forEach { (src, alt) -> Mana(src, alt) } }
        if (r.sub.isNotEmpty()) Text(buildAnnotatedString {
            for (s in r.sub) if (s.foil) withStyle(SpanStyle(color = FoilInk, fontWeight = FontWeight.Bold)) { append(s.t) } else append(s.t)
        }, style = sans(12f, 400, Mute, lh = 1.35f))
    }
}

/** A mana symbol from the site's own Scryfall SVG, 18 dp round with its small drop shadow. */
@Composable
internal fun Mana(src: String, alt: String) {
    val p = heroPainter(src.takeIf { it.isNotBlank() }?.let(homeArt))
    Box(Modifier.size(18.dp).drawBehind { drawCircle(Color.Black.copy(alpha = .55f), size.minDimension / 2, center + Offset(-1.dp.toPx(), 1.dp.toPx())) }
        .semantics { contentDescription = alt }) {
        if (p != null) Image(p, null, Modifier.fillMaxSize().clip(CircleShape)) else Box(Modifier.fillMaxSize().clip(CircleShape).background(Color(0xFFCAC5C0)))
    }
}

@Composable
private fun Tag(text: String, warn: Boolean, onClick: () -> Unit) {
    Box(Modifier.clip(RoundedCornerShape(6.dp)).background(if (warn) Color(0x33E0A040) else Color(0x14FFFFFF)).clickable(onClick = onClick).padding(horizontal = 6.dp, vertical = 2.dp)) {
        Text(text, style = sans(12f, 700, if (warn) Color(0xFFF0C070) else Mute))
    }
}

/** .stepper: − n ＋ on the surface-2 plate, 10 dp corners, 30 dp buttons; − and ＋ are icons.js "minus" / "plus" (20 dp, muted). */
@Composable
internal fun Stepper(qty: Int, glyphs: Map<String, SiteSvg>, minus: () -> Unit, plus: () -> Unit) {
    // .stepper: 2 padding inside a 1 border (a CSS border takes room; a Compose one does not), so 36 tall.
    Row(Modifier.clip(RoundedCornerShape(10.dp)).background(Surface2).border(1.dp, LineC, RoundedCornerShape(10.dp)).padding(3.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).clickable(onClick = minus).semantics { contentDescription = "Remove one" }, contentAlignment = Alignment.Center) {
            glyphs["minus"]?.let { SiteIcon(it, 20.dp, Mute) } ?: Text("−", style = sans(16f, 400, Mute))
        }
        Text("$qty", Modifier.widthIn(min = 18.dp), style = sans(14f, 700, Ink), textAlign = TextAlign.Center)
        Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).clickable(onClick = plus).semantics { contentDescription = "Add one" }, contentAlignment = Alignment.Center) {
            glyphs["plus"]?.let { SiteIcon(it, 20.dp, Mute) } ?: Text("＋", style = sans(16f, 400, Mute))
        }
    }
}

// ---------------------------------------------------------------- empty collection (ui.js empty())

@Composable
private fun Empty(m: CollectionCardsModel, act: CollectionCardsActions) {
    Column(Modifier.fillMaxWidth().padding(vertical = 28.dp, horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(m.emptyMark, style = sans(26f, 400, GoldC))
        Text(m.emptyTitle ?: "", style = sans(18f, 700, Ink), textAlign = TextAlign.Center)
        Text(m.emptyText, style = sans(14f, 400, Mute), textAlign = TextAlign.Center)
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            m.emptyActions.forEachIndexed { i, (label, a) ->
                val shape = RoundedCornerShape(11.dp)
                Box(Modifier.heightIn(min = 44.dp).clip(shape).then(if (i == 0) Modifier.background(GoldC) else Modifier.background(GlassFill).border(1.dp, GlassLine, shape))
                    .clickable { act.emptyAct(a) }.padding(horizontal = 16.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
                    Text(label, style = sans(14f, 700, if (i == 0) accentInk(Color(0xFF1A1408)) else Ink))
                }
            }
        }
    }
}

// ---------------------------------------------------------------- the Gallery and Symbols views (workbench-ui.js viewControl)

/**
 * .view-gallery .display-list: two cards a line on a phone (and up to 700 wide, style.css), else repeat(auto-fill, minmax(170px, 1fr));
 * 14 apart, 18 between lines.
 */
internal fun galleryCols(screen: Dp, inner: Dp) = if (screen <= 700.dp) 2 else ((inner.value + 14f) / 184f).toInt().coerceAtLeast(1)

/** CSS justify-content: space-between with a gap: FlowRow breaks lines as if the items were [gap] apart, then spreads each line. */
private class SpaceBetweenGap(gap: Dp) : Arrangement.Horizontal {
    override val spacing = gap
    override fun androidx.compose.ui.unit.Density.arrange(totalSize: Int, sizes: IntArray, layoutDirection: androidx.compose.ui.unit.LayoutDirection, outPositions: IntArray) =
        with(Arrangement.SpaceBetween) { arrange(totalSize, sizes, layoutDirection, outPositions) }
}
private val SideGap = SpaceBetweenGap(6.dp)

/**
 * A gallery card (.view-gallery .display-list .lot): the card in its price band with its aura (polish.css, the deck page's frame at an
 * 18 blur), the emblem dock on its foot; 8 under it the name on one line with its set badge; 8 under that the value, the stepper
 * (drawn at .86 towards its right) and Edit, spread across the line and wrapping when they don't fit.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GalleryLot(r: CollRow, act: CollectionCardsActions, wide: Boolean, reduced: Boolean, glyphs: Map<String, SiteSvg>, modifier: Modifier) {
    if (r.wanted) { GalleryWanted(r, act, wide, glyphs, modifier); return }
    val tier = tierColor(r.tierColor)
    val on = r.mark == true
    // Select: the ring round the tile, and the tick over the picture's corner (16 up and left of it, on its dark plate).
    Box(modifier.selectRing(r.mark, GoldC)) {
    Column(Modifier.fillMaxWidth().selectTap(r, act), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TierFrame(r.tier, reduced, Modifier.fillMaxWidth().lotPad(r, act).clickable { act.open(r) }.semantics { contentDescription = if (r.mark != null) r.name else "Open ${r.name}" }, blur = 18f) { framed ->
            Box(Modifier.fillMaxSize().padding(if (framed) 3.75.dp else 0.dp)) { RowPicture(r, Modifier.fillMaxSize(), RoundedCornerShape(percent = 4)) }
            r.chrome?.let { c -> TileDock(c.emb, c.set, c.rarity, c.title, c.imp, Modifier.align(Alignment.BottomStart).padding(start = 4.dp, end = 4.dp, bottom = 2.dp)) }
        }
        GalleryName(r, act, wide, sans(15f, 600, Ink, lh = 1.25f), Modifier.then(if (on) Modifier.background(SelectTint, RoundedCornerShape(8.dp)) else Modifier).padding(horizontal = 2.dp))
        FlowRow(Modifier.fillMaxWidth().padding(horizontal = 2.dp), horizontalArrangement = SideGap, verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            // .price: 15 / 700 in the tier's colour (75 % of it), muted for the cheapest tier.
            LotValue(r, act, sans(15f, 700, if (r.tier == "t0") Mute else mixed(tier, .75f)), 4.dp)
            Box(Modifier.graphicsLayer { scaleX = .86f; scaleY = .86f; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, .5f) }) {
                Stepper(r.qty, glyphs, { act.qty(r, -1) }, { act.qty(r, 1) })
            }
            LotEdit(r, act, Modifier)
        }
    }
    // #content.view-gallery .batch-mark: 12 in from the lot's box (28 round the picture), rgba(12, 16, 23, .85), 10 corners.
    if (r.mark != null) BatchMark(on, Modifier.offset((-16).dp, (-16).dp).background(Color(0xD90C1017), RoundedCornerShape(10.dp)))
    }
}

/**
 * .lot-name in the gallery: one line, the name then its set badge 5 on. CSS cuts the line with an ellipsis: a badge that doesn't fit
 * goes and "…" takes its place; a name that doesn't fit itself is cut.
 */
@Composable
private fun GalleryName(r: CollRow, act: CollectionCardsActions, wide: Boolean, style: TextStyle, modifier: Modifier) {
    androidx.compose.ui.layout.Layout(content = {
        Text(r.name, maxLines = 1, softWrap = false, style = style)
        Text(r.name + " …", maxLines = 1, softWrap = false, style = style)
        Text(r.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = style)
        r.set?.let { s -> LotSetBadge(s, wide) { if (!s.unknown) act.set(s.code) } }
    }, modifier.fillMaxWidth().lotPad(r, act).clickable { act.open(r) }) { ms, c ->
        val w = c.maxWidth
        val full = ms[0].measure(androidx.compose.ui.unit.Constraints())
        val badge = ms.getOrNull(3)?.measure(androidx.compose.ui.unit.Constraints())
        val gap = 5.dp.roundToPx()
        when {
            badge == null && full.width <= w -> layout(w, full.height) { full.place(0, 0) }
            badge != null && full.width + gap + badge.width <= w -> layout(w, maxOf(full.height, badge.height)) {
                full.place(0, 0); badge.place(full.width + gap, (full.height - badge.height) / 2)
            }
            else -> {
                val cut = ms[1].measure(androidx.compose.ui.unit.Constraints())
                if (badge != null && cut.width <= w) layout(w, cut.height) { cut.place(0, 0) }
                else { val e = ms[2].measure(androidx.compose.ui.unit.Constraints.fixedWidth(w)); layout(w, e.height) { e.place(0, 0) } }
            }
        }
    }
}

/**
 * A wishlist card in the gallery: no band, the plate in a dashed edge 3 out (.28 white) and a dashed line inside with a soft sheen,
 * the picture greyed, "♥ Wishlist" at its foot; the name at .72, "Not owned" under it; the price faint, then Got it and ×.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GalleryWanted(r: CollRow, act: CollectionCardsActions, wide: Boolean, glyphs: Map<String, SiteSvg>, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f)
            .drawBehind {
                // outline: 1.5px dashed rgba(255,255,255,.28), 3 out; the corners 4.6 % / 3.3 % of the box, plus the offset.
                val o = 3.dp.toPx(); val px = 1.dp.toPx()
                drawRoundRect(Color(0x47FFFFFF), topLeft = Offset(-o - px / 2, -o - px / 2), size = Size(size.width + 2 * o + px, size.height + 2 * o + px),
                    cornerRadius = CornerRadius(size.width * .046f + o, size.height * .033f + o), style = Stroke(px, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(3 * px, 3 * px))))
            }
            .clip(RoundedCornerShape(percent = 4)).background(Surface2).lotPad(r, act).clickable { act.open(r) }.semantics { contentDescription = "Open ${r.name} (on your wishlist, not owned)" }) {
            if (r.art != null) heroPainter(homeArt(r.art))?.let { Image(it, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, colorFilter = Greyed, alpha = .8f) }
            else Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("◇", style = sans(18f, 400, Mute)); Text("Art unavailable", style = sans(11f, 400, Mute))
            }
            r.chrome?.let { c -> Box(Modifier.align(Alignment.BottomStart).graphicsLayer { alpha = .55f }) { TileDock(c.emb, c.set, c.rarity, c.title, c.imp, Modifier.padding(start = 4.dp, end = 4.dp, bottom = 2.dp)) } }
            // ::after: 1px dashed text at .4 inside, and linear-gradient(160deg, rgba(255,255,255,.16), transparent 42%).
            Box(Modifier.matchParentSize().drawBehind {
                val dx = .342f; val dy = .940f; val half = (size.width * dx + size.height * dy) / 2
                drawRect(Brush.linearGradient(0f to Color(0x29FFFFFF), .42f to Color.Transparent, start = center - Offset(dx * half, dy * half), end = center + Offset(dx * half, dy * half)))
                val px = 1.dp.toPx()
                drawRoundRect(Ink.copy(alpha = .4f), topLeft = Offset(px / 2, px / 2), size = Size(size.width - px, size.height - px), cornerRadius = CornerRadius(size.width * .046f, size.height * .033f),
                    style = Stroke(px, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(3 * px, 3 * px))))
            })
            WantTag(r.wantTag.ifBlank { "Wishlist" }, glyphs["heart"], Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp))
        }
        Column(Modifier.padding(horizontal = 2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            GalleryName(r, act, wide, sans(15f, 600, Ink.copy(alpha = .72f), lh = 1.25f), Modifier)
            if (r.wantChip.isNotBlank()) WantChip(r.wantChip, 16.5f)
        }
        FlowRow(Modifier.fillMaxWidth().padding(horizontal = 2.dp), horizontalArrangement = SideGap, verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text(r.price, style = sans(14f, 700, Ink.copy(alpha = .25f)))
            WantActions(r, act, glyphs, got = 30.dp, gotPad = 10.dp, gotSize = 13f, x = 28.dp, xSize = 16f)
        }
    }
}

/** .want-tag: "♥ WISHLIST", 10 / 800 tracked .08 em in rose on a dark pill with a rose hairline, the heart 12 and filled. */
@Composable
private fun WantTag(text: String, heart: SiteSvg?, modifier: Modifier) {
    Row(modifier.clip(RoundedCornerShape(99.dp)).background(Color(0xD10A0A10)).border(1.dp, Color(0x55FF8FA3), RoundedCornerShape(99.dp)).padding(horizontal = 9.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        SiteIcon(heart, 12.dp, Color(0xFFFF8FA3), filled = true)
        Text(text.uppercase(), style = sans(10f, 800, Color(0xFFFF8FA3), ls = .8f))
    }
}

/** .want-chip: rose on a rose wash, 11 / 700, 8 in. */
@Composable
private fun WantChip(text: String, lh: Float) {
    Box(Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0x1FFF7896)).padding(horizontal = 8.dp, vertical = 1.dp)) {
        Text(text, style = sans(11f, 700, Color(0xFFFF8FA3), lh = lh / 11f))
    }
}

/** .want-actions: the gold ＋ Got it and the round ×, 6 apart, sized as each view has them. */
@Composable
private fun WantActions(r: CollRow, act: CollectionCardsActions, glyphs: Map<String, SiteSvg>, got: Dp, gotPad: Dp, gotSize: Float, x: Dp, xSize: Float) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        if (r.got.isNotBlank()) Row(Modifier.heightIn(min = got).clip(RoundedCornerShape(11.dp)).background(GoldC).clickable { act.got(r) }.padding(horizontal = gotPad),
            horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            val lead = r.got.trimStart().firstOrNull()?.let { it == '＋' || it == '+' } == true
            if (lead) SiteIcon(glyphs["plus"], (gotSize * 1.2f).dp, accentInk(Color(0xFF1B1406)), stroke = 2f)
            Text(if (lead) r.got.trimStart().drop(1).trim() else r.got, style = sans(gotSize, 700, accentInk(Color(0xFF1B1406))))
        }
        Box(Modifier.size(x).clip(CircleShape).border(1.dp, LineC, CircleShape).clickable { act.unwish(r) }.semantics { contentDescription = "Remove ${r.name} from wishlist" }, contentAlignment = Alignment.Center) {
            Text("×", style = sans(xSize, 400, Mute, lh = 1f))
        }
    }
}

/**
 * A row of the Symbols view: the collection row and its ring with no picture (the art's ◈ is hidden), 10 / 8 inside its line,
 * at least 60 tall. A phone puts the value and the stepper on a line under the name with Edit below; from 600 the side column
 * (88) sits right, as in the compact view. A wishlist row keeps its price, Got it and × in a right-hand column.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SymbolLot(r: CollRow, act: CollectionCardsActions, wide: Boolean, reduced: Boolean, glyphs: Map<String, SiteSvg>, modifier: Modifier) {
    val frame = modifier.lotFrame(r, reduced).heightIn(min = 60.dp).padding(horizontal = 9.dp, vertical = 11.dp)
    val tier = tierColor(r.tierColor)
    if (r.wanted) Row(frame, horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(r.name, Modifier.lotPad(r, act).clickable { act.open(r) }, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(16f, 700, Ink.copy(alpha = .72f), lh = 1.25f))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                if (r.wantChip.isNotBlank()) WantChip(r.wantChip, 14.85f)
                if (r.pieces.isNotEmpty()) PieceItems(r.pieces)
                if (r.mana.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) { r.mana.forEach { (src, alt) -> Mana(src, alt) } }
                r.sub.forEach { Text(it.t, style = sans(12f, 400, Mute, lh = 1.35f)) }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) {
            Text(r.price, style = sans(13f, 700, Ink.copy(alpha = .3f)))
            WantActions(r, act, glyphs, got = 34.dp, gotPad = 12.dp, gotSize = 13.5f, x = 32.dp, xSize = 18f)
        }
    }
    else if (wide) Row(frame, horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Info(r, act, wide, Modifier.weight(1f), nameSize = 16f)
        Column(Modifier.widthIn(min = 88.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) {
            LotValue(r, act, sans(13f, 700, mixed(tier)), 4.dp)
            Stepper(r.qty, glyphs, { act.qty(r, -1) }, { act.qty(r, 1) })
            LotEdit(r, act, Modifier)
        }
    } else Column(frame, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Info(r, act, wide, Modifier, nameSize = 16f)
        // .lot-side: a grid of 1fr and 88, 6 apart: the value beside the stepper, Edit under the value.
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { LotValue(r, act, sans(13f, 700, mixed(tier)), 4.dp) }
                Box(Modifier.width(88.dp), contentAlignment = Alignment.CenterEnd) { Stepper(r.qty, glyphs, { act.qty(r, -1) }, { act.qty(r, 1) }) }
            }
            LotEdit(r, act, Modifier)
        }
    }
}

// ---------------------------------------------------------------- Select (workbench-ui.js)

/** .batch-selected .lot-info: gold at 9 % behind the chosen lot's name, 8 corners. */
private val SelectTint: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current.copy(alpha = .09f)

/** .lot:has(.batch-mark input:checked): a 3 gold outline 2 outside the lot, its corners following the lot's 12. */
private fun Modifier.selectRing(on: Boolean?, gold: Color): Modifier = if (on != true) this else drawWithContent {
    drawContent()
    val o = 3.5.dp.toPx()
    drawRoundRect(gold, Offset(-o, -o), Size(size.width + o * 2, size.height + o * 2), CornerRadius(12.dp.toPx() + o), style = Stroke(3.dp.toPx()))
}

/** While Select is on, a tap on the lot that isn't one of its own controls turns its tick over (app.js attachCardGestures onSelect). */
private fun Modifier.selectTap(r: CollRow, act: CollectionCardsActions): Modifier {
    val m = r.mark ?: return this
    return padActs(act.pad(r)).clickable { act.mark(r, !m) }.semantics { selected = m; stateDescription = if (m) "Selected" else "Not selected" }
}

/**
 * .batch-mark: the label (6 in) round Chrome's dark checkbox (23 square, 3 / 3 / 3 / 4 margins, 2.5 corners): #3b3b3b in a #858585
 * edge, or gold (accent-color) with its tick in #3b3b3b. 42 by 41 in all; the lot itself takes the tap.
 */
@Composable
private fun BatchMark(on: Boolean, modifier: Modifier = Modifier) {
    val gold = GoldC
    Box(modifier.clearAndSetSemantics { }.padding(start = 10.dp, top = 9.dp, bottom = 9.dp, end = 9.dp).size(23.dp).drawBehind {
        val u = 1.dp.toPx(); val r = CornerRadius(2.5f * u)
        if (on) {
            drawRoundRect(gold, cornerRadius = r)
            val tick = Path().apply { moveTo(size.width * .2f, size.height * .53f); lineTo(size.width * .41f, size.height * .74f); lineTo(size.width * .8f, size.height * .3f) }
            drawPath(tick, Color(0xFF3B3B3B), style = Stroke(2.6f * u, cap = StrokeCap.Butt, join = StrokeJoin.Miter))
        } else {
            drawRoundRect(Color(0xFF3B3B3B), cornerRadius = r)
            drawRoundRect(Color(0xFF858585), Offset(u / 2, u / 2), Size(size.width - u, size.height - u), r, style = Stroke(u))
        }
    })
}

/**
 * A Compact or Symbols lot while Select is on (style.css .lot:has(> .batch-mark)). [stacked] (the lot 480 or less inside, so every
 * phone and most tablets): the tick (Compact's 30 track, Symbols' 42), the 58 × 80 picture (Compact) and the name over gold when
 * chosen, 10 apart and centred; under them the value beside the stepper, Edit under the value, 8 down. Wider: one line, the side
 * column at the right. Compact pads 6 (+1), Symbols 10 / 8.
 */
@Composable
private fun SelectLot(r: CollRow, act: CollectionCardsActions, wide: Boolean, reduced: Boolean, glyphs: Map<String, SiteSvg>, modifier: Modifier,
                      symbols: Boolean, stacked: Boolean) {
    val on = r.mark == true
    val tier = tierColor(r.tierColor)
    val frame = modifier.selectRing(r.mark, GoldC).lotFrame(r, reduced).selectTap(r, act)
        .padding(if (symbols) PaddingValues(horizontal = 9.dp, vertical = 11.dp) else PaddingValues(7.dp))
    val lead = @Composable {
        if (symbols) BatchMark(on)
        else Box(Modifier.width(30.dp)) { BatchMark(on, Modifier.wrapContentWidth(Alignment.Start, unbounded = true)) }
        if (!symbols) LotArt(r, Modifier.lotPad(r, act), 58.dp, 80.dp) { act.open(r) }
    }
    val info = @Composable { mod: Modifier -> Info(r, act, wide, mod.then(if (on) Modifier.background(SelectTint, RoundedCornerShape(8.dp)) else Modifier), nameSize = 16f) }
    val step = @Composable { Stepper(r.qty, glyphs, { act.qty(r, -1) }, { act.qty(r, 1) }) }
    if (stacked) Column(frame, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) { lead(); info(Modifier.weight(1f)) }
        // .lot-side: a grid of 1fr and auto (10 apart): the value at the start beside the stepper, Edit under the value (8 down).
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { LotValue(r, act, sans(13f, 700, mixed(tier)), 4.dp) }
                step()
            }
            LotEdit(r, act, Modifier.heightIn(min = 44.dp))
        }
    } else Row(frame, horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        lead(); info(Modifier.weight(1f))
        Column(Modifier.widthIn(min = 88.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) {
            LotValue(r, act, sans(13f, 700, mixed(tier)), 4.dp); step(); LotEdit(r, act, Modifier)
        }
    }
}

/**
 * .batch-tray: centred and wrapping, 8 apart, 14 in, 18 corners, #1b2230 at .96 (blur 16) in a hairline, 0 12 35 #0006 under it:
 * "n selected" (15 / 700), Move, Add to deck, Wishlist, Compare (btn ghost small: 34 tall, 13.5 / 700, 11 corners, dim when
 * none are ticked) and Clear (link small, gold 13 / 600). Each tap is 44 tall.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SelectTray(t: CollTray, act: CollectionCardsActions, modifier: Modifier) {
    val shape = RoundedCornerShape(18.dp)
    FlowRow(modifier.fillMaxWidth().semantics { contentDescription = "Selected card actions" }
        .drawBehind { outerShadow(Color(0x66000000), 35f, 12f, 0f, 18f) }
        .clip(shape).background(Color(0xF51B2230)).border(1.dp, LineC, shape).padding(horizontal = 14.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(-2.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        Text(t.count, Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite }, style = sans(15f, 700, Ink))
        for (b in t.buttons) Box(Modifier.heightIn(min = 44.dp).clickable(enabled = !b.disabled) { act.batch(b.kind) }.semantics { role = Role.Button },
            contentAlignment = Alignment.Center) {
            Box(Modifier.height(34.dp).alpha(if (b.disabled) .45f else 1f).clip(RoundedCornerShape(11.dp)).background(GlassFill).border(1.dp, GlassLine, RoundedCornerShape(11.dp))
                .padding(horizontal = 12.dp), contentAlignment = Alignment.Center) { Text(b.label, style = sans(13.5f, 700, Ink), maxLines = 1) }
        }
        if (t.clear.isNotBlank()) Box(Modifier.heightIn(min = 44.dp).clickable(onClick = act.clear).semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
            Text(t.clear, Modifier.padding(vertical = 4.dp), style = sans(13f, 600, GoldC))
        }
    }
}
