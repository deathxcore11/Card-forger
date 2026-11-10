package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusProperties
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject

/**
 * A panel of the site's own markup run by its own scripts (the engine's site-dom.mjs, CollectionEngine.rules): the nodes as those
 * scripts leave them, drawn with the site's stylesheet rules for them (style.css .rule-learning, .rule-glass, .panel, .btn, .chip,
 * .link, .eyebrow, .foot, .note); a tap or typing goes back to the same listeners and the panel comes back changed. Every word,
 * state and order is the site's; nothing here decides what shows.
 */
/** [pic]: an <img>'s address and its fallbacks (data-art-sources), as the site's onerror walks them. */
class SiteNode(val tag: String, val id: Int, val attrs: Map<String, String>, val kids: List<Any>, val value: String?, val icon: SiteSvg?, val pic: List<String>? = null) {
    val classes: Set<String> = attrs["class"].orEmpty().split(' ', '\t', '\n').filter { it.isNotEmpty() }.toSet()
    fun has(c: String) = c in classes
    val hidden get() = "hidden" in attrs
    operator fun get(k: String) = attrs[k]
    val elements: List<SiteNode> get() = kids.filterIsInstance<SiteNode>()
    /** Its visible words (hidden nodes and drawings left out), whitespace folded. */
    fun text(): String = kids.joinToString("") { if (it is String) it else (it as SiteNode).let { k -> if (k.hidden || k.tag == "svg") "" else k.text() } }.replace(Regex("\\s+"), " ").trim()
    fun find(ok: (SiteNode) -> Boolean): SiteNode? { for (k in elements) { if (ok(k)) return k; k.find(ok)?.let { return it } }; return null }
    companion object {
        fun parse(e: JsonElement?): Any? = when {
            e == null || e.isJsonNull -> null
            e.isJsonPrimitive -> e.asString
            e.isJsonObject -> e.asJsonObject.let { o ->
                SiteNode(o.get("t").asString, o.get("i")?.asInt ?: 0, o.getAsJsonObject("a")?.entrySet()?.associate { it.key to it.value.asString }.orEmpty(),
                    o.getAsJsonArray("k")?.mapNotNull { parse(it) }.orEmpty(), o.get("v")?.takeIf { it.isJsonPrimitive }?.asString,
                    o.get("icon")?.takeIf { it.isJsonObject }?.let { CollectionCardsModel.svg(it.asJsonObject) },
                    o.get("pic")?.takeIf { it.isJsonObject }?.asJsonObject?.let { p -> (p.getAsJsonArray("sources")?.map { it.asString }.orEmpty()
                        .ifEmpty { listOfNotNull(p.get("src")?.asString?.takeIf { it.isNotEmpty() }) }) })
            }
            else -> null
        }
    }
}

/** The engine's panel model: [body] the page's body, [reveal] the node the site last focused or scrolled to, [acted] a data-act the app runs, [toasts] what the site toasted. */
class SitePanelModel(val key: String, val body: SiteNode?, val reveal: Int?, val acted: JsonObject?, val toasts: List<String> = emptyList(),
                     /** The Build decks sheet's model (buildSheetModel) when the panel is that sheet (key tbuild|…). */
                     val sheet: JsonObject? = null) {
    /** The tab's own markup (the body's first child). */
    val page: SiteNode? get() = body?.elements?.firstOrNull()
    /** A rule-dex glass (aside.rule-glass) open over it. */
    val glass: SiteNode? get() = body?.elements?.firstOrNull { it.tag == "aside" && it.has("rule-glass") && !it.hidden }
    companion object {
        fun parse(j: JsonObject) = SitePanelModel(j.get("key")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty(), SiteNode.parse(j.get("body")) as? SiteNode,
            j.get("reveal")?.takeIf { it.isJsonPrimitive }?.asInt, j.get("acted")?.takeIf { it.isJsonObject }?.asJsonObject,
            j.get("toasts")?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty(),
            j.get("sheet")?.takeIf { it.isJsonObject }?.asJsonObject)
    }
}

/**
 * What a tap does: [tap] a node's click on the site's listeners, [type] an input's value, [open] an outside link. [anchor]: where
 * the last tapped node sits in the window (its getBoundingClientRect, which rule-dex.js places its glass under); shared by copies.
 */
class SiteUi(val tap: (Int) -> Unit, val type: (Int, String) -> Unit, val open: (String) -> Unit, val screen: Dp,
             val anchor: androidx.compose.runtime.MutableState<androidx.compose.ui.geometry.Rect?> = mutableStateOf(null),
             /** A search field's Enter: its form's submit (the Wiki's #wikiQ). Null: Enter only closes the keyboard. */
             val submit: ((Int) -> Unit)? = null) {
    internal val seen = HashMap<Int, BringIntoViewRequester>()
}

// style.css :root (dark): the colours these rules use.
private val Good = Color(0xFF6FD29A)
private val Warn = Color(0xFFF2C66D)
private val Bad = Color(0xFFF08A7E)
private val light get() = AppSettings.theme == "light"
/** --accent: settings-theme.css sets it in light (--gold); the dark sheet leaves it unset, so what takes it keeps the text colour. */
private val accent: Color? get() = if (light) Site.Gold else null

/**
 * What an element inherits: the font (body 15 / 1.45 DM Sans and what a rule above changed), white-space pre-wrap, the classes of
 * every element above it ([anc], for descendant rules) and its parent ([parent], for child rules).
 */
private data class Ctx(val style: TextStyle, val line: Float = 1.45f, val pre: Boolean = false, val anc: Set<String> = emptySet(), val parent: SiteNode? = null, val upper: Boolean = false,
                       val bInk: Color? = null, val firstBInk: Color? = null)
private fun Ctx.size(size: Float, line: Float = this.line) = copy(style = style.copy(fontSize = size.sp, lineHeight = (size * line).sp), line = line)
private fun Ctx.color(c: Color) = copy(style = style.copy(color = c))
private fun Ctx.weight(w: Int) = copy(style = style.copy(fontWeight = FontWeight(w)))
private val Ctx.px get() = style.fontSize.value
private fun Ctx.under(n: SiteNode) = copy(anc = anc + n.classes, parent = n)
private fun Ctx.inside(c: String) = c in anc
private val Ctx.glass get() = inside("rule-glass")
private val Ctx.rules get() = inside("rule-learning")
private fun Ctx.parentHas(c: String) = parent?.has(c) == true

private fun base() = Ctx(cssType(15f, 400, 21.75f, Site.Text))

/**
 * The panel: the tab's markup top to bottom; [SitePanelModel.reveal] brings the node the site focused into view. [padded]: its box
 * has padding (tcg.js .deck-body's 4 on top), so the first block's top margin stays in it rather than collapsing out.
 */
@Composable
fun SitePanel(m: SitePanelModel, ui: SiteUi, modifier: Modifier = Modifier, padded: Boolean = true) {
    val page = m.page ?: return
    Column(modifier.fillMaxWidth()) { Blocks(page.kids, ui, base().under(page), padded = padded) }
    LaunchedEffect(m.reveal) { m.reveal?.let { id -> kotlinx.coroutines.delay(60); runCatching { ui.seen[id]?.bringIntoView() } } }
}

/** The page's open sheet (index.html <dialog id="sheet">, app.js openSheet) when the panel holds one: its #sheetBody. */
val SitePanelModel.sheetBody: SiteNode? get() = body?.elements?.firstOrNull { it["id"] == "sheet" && "open" in it.attrs }?.find { it["id"] == "sheetBody" }

/** A sheet's body ([SitePanelModel.sheetBody]) in the page's block flow, 16 in (style.css #sheetBody). */
@Composable
fun SiteSheetBody(n: SiteNode, ui: SiteUi, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) { Blocks(n.kids, ui, base().under(n), padded = false) }
}

/**
 * rule-dex.js showRuleHint's glass (aside.rule-glass), fixed over the page: min(420, the screen less 32) wide, left at the tapped
 * word (16 to 16 from the edges), top 10 under it but kept 16 inside the screen; at most the screen less 32 tall, scrolling inside.
 * Padding 20, corners 20, rgba(22,25,35,.94) over the page blurred 24 (backdrop-filter), its shadow 0 16 70 #0009; it rises in
 * (rule-reveal: .18s, 6 up, .98 to full size). Light: white to 4% gold, the line round it. A tap outside closes it ([onOutside],
 * its pointerdown listener). [backdrop]: the page as drawn under it.
 */
@Composable
fun SiteGlass(m: SitePanelModel, ui: SiteUi, backdrop: androidx.compose.ui.graphics.layer.GraphicsLayer?, onOutside: () -> Unit) {
    val g = m.glass ?: return
    var origin by remember { mutableStateOf(Offset.Zero) }
    var at by remember { mutableStateOf(Offset.Zero) }
    val blurLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val rise = remember(g.id) { androidx.compose.animation.core.Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(g.id) { rise.animateTo(1f, androidx.compose.animation.core.tween(180, easing = androidx.compose.animation.core.LinearOutSlowInEasing)) }
    val shape = RoundedCornerShape(20.dp)
    val lightNow = light
    // A controller: the glass is a popover over the page; the page's buttons under it lend it nothing.
    PadScreen(remember { PadActs(opaque = true) })
    androidx.compose.ui.layout.Layout(content = {
        Column(Modifier
            .graphicsLayer { alpha = rise.value; val s = .98f + .02f * rise.value; scaleX = s; scaleY = s; translationY = (1f - rise.value) * 6.dp.toPx() }
            .then(if (lightNow) Modifier.cssShadow(Color(0x1A24364B), 38.dp, 12.dp, 0.dp, 20.dp) else Modifier.cssShadow(Color(0x99000000), 70.dp, 16.dp, 0.dp, 20.dp))
            .onGloballyPositioned { at = it.positionInRoot() }
            .clip(shape)
            .drawBehind {
                if (!lightNow && backdrop != null && backdrop.size.width > 0) {
                    blurLayer.renderEffect = androidx.compose.ui.graphics.BlurEffect(24.dp.toPx(), 24.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                    blurLayer.record(backdrop.size) { drawLayer(backdrop) }
                    translate(origin.x - at.x, origin.y - at.y) { drawLayer(blurLayer) }
                }
            }
            .background(if (lightNow) Brush.linearGradient(listOf(Color.White, lerp(Site.Surface, Site.Gold, .04f))) else androidx.compose.ui.graphics.SolidColor(Color(0xF0161923)))
            .then(if (lightNow) Modifier.border(1.dp, Site.Line, shape) else Modifier)
            // The glass's tap-catcher and the tap-outside behind it are touch-only: the d-pad skips them.
            .focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) {}
            .verticalScroll(rememberScrollState()).padding(20.dp)) {
            Blocks(g.kids, ui, base().under(g), padded = true)
        }
    }, modifier = Modifier.fillMaxSize().onGloballyPositioned { origin = it.positionInRoot() }
        .focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) { onOutside() }) { ms, c ->
        val w = c.maxWidth; val h = c.maxHeight; val edge = 16.dp.roundToPx()
        val width = minOf(420.dp.roundToPx(), w - 2 * edge)
        val p = ms[0].measure(androidx.compose.ui.unit.Constraints(minWidth = width, maxWidth = width, maxHeight = (h - 2 * edge).coerceAtLeast(0)))
        val a = ui.anchor.value?.translate(-origin)
        val left = minOf(w - width - edge, maxOf(edge, a?.left?.toInt() ?: edge))
        val top = maxOf(edge, minOf((a?.bottom?.toInt() ?: h) + 10.dp.roundToPx(), h - p.height - edge))
        layout(w, h) { p.place(left, top) }
    }
}

// ---------------------------------------------------------------- block flow

private val INLINE = setOf("b", "strong", "em", "i", "small", "span", "a", "code", "br", "abbr", "sup", "sub", "mark", "u", "s", "time", "kbd", "q")
/** Inline content of a block box ([inText]: inside a paragraph, where a link or button sits in the words). */
private fun isInline(k: Any, inText: Boolean): Boolean = when {
    k is String -> true
    k !is SiteNode -> false
    k.tag == "button" -> inText || k.has("rule-word") || k.has("wiki-article-link")
    k.tag == "a" -> inText || (!k.has("btn") && !k.has("link"))
    // Spans the site makes blocks: .bar, .power-chip, .role-chips in a table cell are drawn as their own.
    k.has("bar") || k.has("pair") -> false
    else -> k.tag in INLINE
}

/** One run of the flow: its CSS margins (top, bottom), which meet and collapse between siblings, and how it draws. */
private class FlowPiece(val top: Float, val bottom: Float, val draw: @Composable () -> Unit)

/**
 * Children laid top to bottom as the site's blocks: a run of words and inline tags is one paragraph; margins between siblings
 * collapse to the larger; [padded] keeps the first one's top and the last one's bottom margin (a box with padding holds them in).
 * [gap]: a grid container's row gap, which adds to its items' margins (they don't collapse there). [lead]: the bottom margin of what
 * sits above them in the same box (an open summary's), which meets the first one's top margin.
 */
@Composable
private fun Blocks(kids: List<Any>, ui: SiteUi, ctx: Ctx, padded: Boolean, gap: Float? = null, lead: Float = 0f) {
    val pieces = ArrayList<FlowPiece>()
    var run = ArrayList<Any>()
    fun flush() {
        val r = run; run = ArrayList()
        if (r.isEmpty() || (!ctx.pre && r.all { it is String && it.isBlank() })) return
        pieces += FlowPiece(0f, 0f) { Paragraph(r, ui, ctx) }
    }
    for (k in kids) {
        if (k is SiteNode && (k.hidden || k.tag in setOf("script", "style", "template"))) continue
        if (isInline(k, false)) { run.add(k); continue }
        flush()
        val n = k as SiteNode
        val (t, b) = margins(n, ctx)
        pieces += FlowPiece(t, b) { Element(n, ui, ctx) }
    }
    flush()
    Column(Modifier.fillMaxWidth()) {
        var below = 0f
        pieces.forEachIndexed { i, p ->
            val space = when {
                gap != null -> if (i == 0) (if (padded) maxOf(lead, p.top) else lead) else below + gap + p.top
                i == 0 -> if (padded) maxOf(lead, p.top) else lead
                else -> maxOf(below, p.top)
            }
            if (space > 0f) Spacer(Modifier.height(space.dp))
            p.draw()
            below = p.bottom
        }
        if (padded && below > 0f) Spacer(Modifier.height(below.dp))
    }
}

/** CSS margins (top, bottom) of an element where the site sets them; [ctx] is its parent's. */
private fun margins(n: SiteNode, ctx: Ctx): Pair<Float, Float> = when {
    // The Wiki (style.css .wiki-*, at phone width): its boxes, and the article's flow at 16 / 1.78.
    n.has("wiki-page-head") -> 4f to 2f
    n.has("wiki-search-form") -> 16f to 16f
    n.has("wiki-daily") -> 20f to 20f
    n.has("wiki-glossary") || n.has("wiki-glossary-browse") -> 18f to 18f
    n.has("wiki-reader-empty") -> 24f to 24f
    n.has("wiki-reader-toolbar") -> 16f to 12f
    n.has("home-result-actions") -> 0f to 0f
    n.has("actions") && ctx.parent?.attrs?.containsKey("data-wiki-page-content") == true -> 0f to 8f
    n.tag == "header" && ctx.parentHas("wiki-article") -> 0f to 22f
    n.has("wiki-article-lead") -> 0f to 24.65f
    n.has("wiki-article-section") -> 28.8f to 28.8f
    n.has("wiki-article-figure") -> 20f to 24f
    n.has("wiki-article-table-wrap") -> 21.6f to 25.6f
    n.has("wiki-source-credit") -> 28f to 0f
    n.tag == "h2" && ctx.inside("wiki-article") -> 33f to 14.3f
    n.tag == "h3" && ctx.inside("wiki-article") -> 28.5f to 11.4f
    n.tag == "h4" && ctx.inside("wiki-article") -> 21.6f to 8.8f
    n.tag == "p" && ctx.inside("wiki-article-lead") -> 0f to 18.7f
    n.tag == "p" && ctx.inside("wiki-article") && !ctx.inside("wiki-source-credit") -> 0f to 17.6f
    (n.tag == "ul" || n.tag == "ol") && ctx.inside("wiki-article") -> 11.2f to 20f
    n.tag == "blockquote" && ctx.inside("wiki-article") -> 22.4f to 22.4f
    n.tag == "h2" && (ctx.inside("wiki-glossary") || ctx.inside("wiki-reader-empty")) -> (if (ctx.inside("wiki-glossary")) 4f else 0f) to (if (ctx.inside("wiki-glossary")) 10f else 12f)
    n.tag == "p" && ctx.inside("wiki-reader-empty") && !n.has("eyebrow") -> 0f to 14f
    n.tag == "ul" && ctx.inside("wiki-glossary") -> 8f to 12f
    n.has("panel") -> if (ctx.rules) 0f to 0f else 12f to 12f
    // The old Power page's panels (style.css .pw-*, .scout, .meter, .bar, .curve).
    n.has("bar") -> if (ctx.parentHas("pair")) 3f to 3f else 6f to 6f
    n.has("pw-dual") || n.has("pw-profile") -> 12f to 0f
    n.has("pw-issue") -> 10f to 10f
    n.has("pw-field") -> 0f to 12f
    n.has("curve") -> 10f to 0f
    n.has("meter") -> 4f to 4f
    n.tag == "p" && (ctx.parentHas("pw-cap") || ctx.parentHas("pw-field")) -> 6f to 0f
    n.tag == "p" && ctx.parentHas("pw-issue") -> 4f to 4f
    n.tag == "p" && ctx.parentHas("scout-row") -> 0f to 0f
    n.tag == "h3" && ctx.parentHas("scout-row") -> 0f to 4f
    n.tag == "p" && n.has("eyebrow") && ctx.parentHas("ai-launch-top") -> 0f to 4f
    n.tag == "h3" && ctx.parentHas("ai-launch-top") -> 0f to 0f
    n.has("issues") -> 8f to 0f
    // The one-page Power view (deck-viewer.css .pwp-*): a card's items have no margins of their own but these.
    n.has("pwp") -> 12f to 12f
    n.has("pwp-more") -> 8f to 8f
    n.has("pwp-eyebrow") -> 0f to 2f
    n.has("pwp-plan") -> 2f to 0f
    n.has("pwp-pills") -> 10f to 0f
    n.has("pwp-tier") || n.has("pwp-foot") || n.has("pwp-text") -> 0f to 0f
    n.tag == "h3" && ctx.inside("pwp-card") -> 0f to 0f
    n.tag == "h4" && ctx.inside("pwp-pc") -> 0f to 4f
    n.tag == "p" && n.has("eyebrow") -> 0f to 4f
    n.tag == "p" && n.has("foot") -> 10f to 6f
    n.has("note") -> 10f to 10f
    n.tag == "p" && ctx.parentHas("learn-turn-tip") -> 10f to 10f
    n.tag == "p" && ctx.parentHas("rules-list") -> 8f to 0f
    n.tag == "p" && ctx.inside("rules-list") && ctx.parent?.tag == "details" -> 8f to 0f
    n.tag == "p" -> 6f to 6f
    n.has("wc-draw") -> 22f to 0f
    n.has("hand") -> 8f to 0f
    n.tag == "h3" && ctx.parentHas("wc-draw") -> 0f to 10f
    n.tag == "h3" && ctx.parentHas("learn-welcome") -> 10f to 14f
    n.tag == "h3" && ctx.glass -> 12f to 8f
    n.tag == "h3" && ctx.inside("rules-ask-intro") -> 3f to 3f
    n.tag == "h3" -> 0f to 8f
    n.tag == "h4" -> if (ctx.parentHas("rule-check")) 0f to 14f else 20f to 20f
    n.has("learn-story") -> 22f to 22f
    n.has("learn-example") -> if (ctx.rules) 18f to 18f else 16f to 16f
    n.has("learn-search") -> 16f to 16f
    n.has("learn-step-rail") || n.has("learn-book-filters") || n.has("learn-keywords") -> 14f to 14f
    n.has("learn-turn-tip") || n.has("rule-hint-example") -> 18f to 18f
    n.has("learn-topics") -> 16f to 0f
    n.has("rule-documents") -> 28f to 0f
    n.has("learn-chapters") -> 16f to 16f
    n.has("rule-check-answer") -> 16f to 0f
    n.has("rule-source-footer") -> 24f to 0f
    n.has("rule-card-context") -> 18f to 0f
    n.has("rules-ask-intro") -> 0f to 14f
    n.tag == "ul" || n.tag == "ol" -> 15f to 15f
    n.has("btn") && n.has("block") -> 10f to 0f
    // .grid2 10 above and under; .actions 10 above; .log-form and .life-grid 8 above and under.
    n.has("grid2") -> 10f to 10f
    n.has("finder-controls") -> 10f to 10f
    n.has("actions") -> 10f to 0f
    n.has("log-form") || n.has("life-grid") -> 8f to 8f
    else -> 0f to 0f
}

// ---------------------------------------------------------------- elements

@Composable
private fun Element(n: SiteNode, ui: SiteUi, ctx: Ctx) {
    val req = remember(n.id) { BringIntoViewRequester() }
    ui.seen[n.id] = req
    val mark = Modifier.bringIntoViewRequester(req)
    val inner = ctx.under(n)
    when {
        n.tag == "svg" -> n.icon?.let { SiteIcon(it, 20.dp, ctx.style.color, mark) }
        n.has("ask-orb") -> Box(mark.size(48.dp)) { BrandMark(48.dp) }
        n.tag == "details" -> Details(n, ui, ctx, mark)
        n.tag == "img" -> SitePic(n, mark)
        n.has("ban-grid") -> BanGrid(n, ui, mark)
        n.has("wc-tool") -> ChestTool(n, ui, mark)
        n.has("hand-card") -> HandCard(n, ui, mark)
        n.has("mini-row") -> MiniRow(n, ui, ctx, mark)
        n.has("scan-workspace") -> ScanWorkspace(n, ui, mark) { k -> Blocks(listOf(k), ui, inner, padded = false) }
        n.has("wiki-page-head") -> WikiHead(n, ui, ctx, mark)
        n.has("home-search-pill") -> WikiSearchPill(n, ui, mark)
        n.has("home-suggestions") -> WikiSuggestions(n, ui, ctx, mark)
        n.has("home-assistant-action") -> AssistantAction(n, ui, mark)
        n.has("wiki-daily") -> WikiDaily(n, ui, ctx, mark)
        n.has("wiki-reader-toolbar") -> WikiToolbar(n, ui, mark)
        n.has("wiki-article-figure") -> WikiFigure(n, ui, ctx, mark)
        n.has("wiki-article-table-wrap") -> WikiTable(n, ui, ctx, mark)
        n.tag == "h2" && ctx.inside("wiki-article") -> Paragraph(n.kids, ui, textCtx(n, ctx).under(n), mark.drawBehind {
            drawLine(Site.Line, Offset(0f, size.height - .5.dp.toPx()), Offset(size.width, size.height - .5.dp.toPx()), 1.dp.toPx()) }.padding(bottom = 8.8.dp))
        n.has("note-row") -> NoteRow(n, ui, ctx, mark)
        n.has("life-card") -> LifeCard(n, ui, ctx, mark)
        n.tag == "button" || n.tag == "a" -> SiteButton(n, ui, ctx, mark)
        n.tag == "input" -> SiteInput(n, ui, mark)
        n.tag == "select" -> SiteSelect(n, ui, mark)
        // label.check round a checkbox (style.css: a row, 8 apart, 13.5 / 500 in the text colour; the box 18 square in the gold accent),
        // the whole row its 44 tall tap target; a tap goes to the box's change listener with the box flipped.
        n.tag == "label" && n.elements.any { it.tag == "input" && it["type"] == "checkbox" } -> {
            val box = n.elements.first { it.tag == "input" && it["type"] == "checkbox" }
            val on = (box.value?.let { it == "true" || it == "on" } ?: false) || "checked" in box.attrs
            val gold = LocalGameGold.current
            // Under .finder-controls the later rule (style.css 672) makes the label a grid again, 4 apart, 12.5 muted (500 from
            // label.check): the box (width 100 %, so centred) on its own line, then each of its words' runs on a line of its own.
            if (ctx.parentHas("finder-controls")) Column(mark.fillMaxWidth().clickable { ui.type(box.id, (!on).toString()) }
                .semantics(mergeDescendants = true) { role = androidx.compose.ui.semantics.Role.Checkbox; stateDescription = if (on) "Checked" else "Not checked" },
                verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.fillMaxWidth().heightIn(min = 44.dp), contentAlignment = Alignment.Center) { CheckSquare(on, gold) }
                n.kids.filter { isInline(it, false) && !(it is String && it.isBlank()) }.forEach { k ->
                    Text(if (k is SiteNode) k.text() else (k as String).trim(), style = cssType(12.5f, 500, 18.1f, Site.Muted))
                }
            }
            // .ss-set (Scanner settings): the box at the top, 12 from its words: the title (b) over its line (small, 12 muted), 2 apart; 12 above and below.
            else if (n.has("ss-set")) Row(mark.fillMaxWidth().padding(vertical = 12.dp).heightIn(min = 44.dp).clickable { ui.type(box.id, (!on).toString()) }
                .semantics(mergeDescendants = true) { role = androidx.compose.ui.semantics.Role.Checkbox; stateDescription = if (on) "Checked" else "Not checked" },
                verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.padding(top = 1.dp)) { CheckSquare(on, gold) }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    n.elements.firstOrNull { it.tag == "span" }?.elements?.forEach { k ->
                        if (k.tag == "b") Text(k.text(), style = cssType(14f, 700, 20.3f, Site.Text)) else Text(k.text(), style = cssType(12f, 400, 17.4f, Site.Muted))
                    }
                }
            }
            else Row(mark.fillMaxWidth().heightIn(min = 44.dp).clickable { ui.type(box.id, (!on).toString()) }
                .semantics { role = androidx.compose.ui.semantics.Role.Checkbox; stateDescription = if (on) "Checked" else "Not checked" },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CheckSquare(on, gold)
                Paragraph(n.kids.filter { isInline(it, false) }, ui, inner.size(13.5f).color(Site.Text).weight(500), Modifier.weight(1f))
            }
        }
        // A <label> round its field (style.css label: a grid, 4 apart; its words 12.5, 600, muted).
        n.tag == "label" && n.elements.any { it.tag == "select" || it.tag == "input" } -> Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            // A hint after the field (<small> in label.field, Scanner settings' Lock set) is under it, not in the label's words.
            val after = n.elements.lastOrNull { it.tag == "small" }?.takeIf { sm -> n.kids.indexOf(sm) > n.kids.indexOfFirst { it is SiteNode && (it.tag == "select" || it.tag == "input") } }
            n.kids.filter { isInline(it, false) && it !== after }.takeIf { l -> l.any { !(it is String && it.isBlank()) } }?.let { Paragraph(it, ui, inner.size(12.5f).color(Site.Muted).weight(600)) }
            // style.css 43: a field's font is inherited (font: inherit); under .finder-controls that is the label's 12.5 / 600.
            val finder = ctx.parentHas("finder-controls")
            n.elements.filter { it.tag == "select" || it.tag == "input" }.forEach {
                when {
                    finder && it.tag == "select" -> SiteSelect(it, ui, style = cssType(12.5f, 600, 18.1f, Site.Text))
                    finder && it.tag == "input" -> SiteInput(it, ui, style = cssType(12.5f, 600, 18.1f, Site.Text))
                    else -> Element(it, ui, inner)
                }
            }
            after?.let { Paragraph(it.kids, ui, inner.size(12f).color(Site.Muted).weight(600)) }
        }
        // .sheet-head: the sheet's title (h2, 20 / 800) and its ✕ (a 44 square, corners 12, --surface-2 and the line), 12 10 in.
        n.has("sheet-head") -> Row(mark.fillMaxWidth().padding(top = 12.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            n.elements.forEach { k ->
                if (k.tag == "button") Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(12.dp))
                    .clickable { ui.tap(k.id) }.semantics { role = Role.Button; k["aria-label"]?.let { contentDescription = it } }, contentAlignment = Alignment.Center) {
                    Text(k.text(), style = cssType(17f, 400, 20f, Site.Text)) }
                else Box(Modifier.weight(1f)) { Paragraph(k.kids, ui, inner.size(20f, 1.25f).weight(800), oneLine = true) }
            }
        }
        // .scan-defaults (Scanner settings' batch defaults): a pill (corners 27, 5 in, rgba(10,12,16,.6), a 1 white line at 10 %) of four
        // buttons, each its caption (11 / 700 caps, tracked .08em, white at 55 %) over its value (15 / 800 white and a ⌄), 44 tall.
        n.has("scan-defaults") -> Row(mark.fillMaxWidth().clip(RoundedCornerShape(27.dp)).background(Color(0x990A0C10)).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(27.dp))
            .padding(5.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            val buttons = n.elements.flatMap { if (it.has("sd-pair")) it.elements else listOf(it) }.filter { it.tag == "button" }
            buttons.forEach { b ->
                Column(Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp)).clickable { ui.tap(b.id) }
                    .semantics(mergeDescendants = true) { role = Role.Button; b["aria-label"]?.let { contentDescription = it } }.padding(horizontal = 6.dp, vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    b.elements.firstOrNull { it.tag == "small" }?.let { Text(it.text().uppercase(), style = cssType(11f, 700, 12.1f, Color(0x8CFFFFFF), .08f), maxLines = 1) }
                    b.elements.firstOrNull { it.tag == "span" }?.let { v ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(v.text(), style = cssType(15f, 800, 16.5f, Color.White), maxLines = 1)
                            v.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 14.dp, Color.White.copy(alpha = .7f)) }
                        }
                    }
                }
            }
        }
        // A line with the curve's legend swatches in it (.key, .key.old).
        n.tag == "p" && n.elements.any { it.has("key") } -> KeyLegend(n, textCtx(n, ctx).under(n), mark)
        n.tag == "label" && n.has("learn-search") -> Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            n.kids.filter { isInline(it, false) }.takeIf { l -> l.any { !(it is String && it.isBlank()) } }?.let { Paragraph(it, ui, inner.size(13.6f).color(Site.Muted)) }
            n.elements.filter { it.tag == "input" }.forEach { SiteInput(it, ui) }
        }
        n.tag == "p" || n.tag in setOf("h1", "h2", "h3", "h4", "h5", "h6") -> Paragraph(n.kids, ui, textCtx(n, ctx).under(n), mark, center = n.has("center"))
        n.tag == "ol" && n.has("learn-story") -> LearnStory(n, ui, inner, mark)
        n.tag == "table" -> MetricsTable(n, ui, inner, mark)
        n.has("power-chip") -> PowerChip(n, mark)
        n.has("bar") -> SiteBar(n, mark)
        n.tag == "ol" || n.tag == "ul" -> Column(mark.fillMaxWidth().padding(start = 24.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            n.elements.filter { it.tag == "li" && !it.hidden }.forEachIndexed { i, li ->
                Row { Text(if (n.tag == "ol") "${i + 1}. " else "• ", style = ctx.style); Column(Modifier.weight(1f)) { Blocks(li.kids, ui, inner.under(li), padded = false) } }
            }
        }
        else -> Container(n, ui, ctx, mark)
    }
}

/** A checkbox: 18 square, the gold accent with its tick when on, a 1.5 grey line when off. */
@Composable
private fun CheckSquare(on: Boolean, gold: Color) {
    Box(Modifier.size(18.dp).clip(RoundedCornerShape(3.dp)).background(if (on) gold else Color.Transparent)
        .border(if (on) 0.dp else 1.5.dp, Color(0xFF8A8F98), RoundedCornerShape(3.dp)), contentAlignment = Alignment.Center) {
        if (on) androidx.compose.foundation.Canvas(Modifier.size(14.dp)) { val u = size.width / 24f
            drawPath(androidx.compose.ui.graphics.Path().apply { moveTo(5f * u, 12.5f * u); lineTo(9.5f * u, 17f * u); lineTo(19f * u, 7f * u) }, Color(0xFF15120C),
                style = androidx.compose.ui.graphics.drawscope.Stroke(3f * u, cap = androidx.compose.ui.graphics.StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round)) }
    }
}

/** The font a paragraph or heading sets for its words ([ctx]: its parent's). */
private fun textCtx(n: SiteNode, ctx: Ctx): Ctx {
    var c = ctx
    fun head(size: Float, w: Int) = c.copy(style = c.style.copy(fontFamily = Site.Manrope, letterSpacing = (-.02).em, fontSize = size.sp, lineHeight = (size * 1.15f).sp, fontWeight = FontWeight(w)), line = 1.15f)
    when (n.tag) {
        // polish.css #content .page-head h1: Cinzel 700, .02em apart.
        "h1" -> c = if (ctx.inside("wiki-article")) head(28f, 700).let { it.copy(style = it.style.copy(fontFamily = Type.Cinzel, letterSpacing = .02.em, lineHeight = (28f * 1.12f).sp), line = 1.12f) }
            else if (ctx.inside("page-head")) head(26f, 700).let { it.copy(style = it.style.copy(fontFamily = Type.Cinzel, letterSpacing = .02.em)) } else head(26f, 800)
        "h2" -> c = when {
            ctx.inside("wiki-article") -> head(22f, 800).let { it.size(22f, 1.25f) }
            ctx.inside("wiki-glossary") || ctx.inside("wiki-reader-empty") -> head(24f, 800).let { it.size(24f, 1.25f) }
            else -> head(19f, 800)
        }
        "h3" -> c = if (ctx.parentHas("learn-welcome")) head(23.2f, 700).let { it.copy(style = it.style.copy(lineHeight = (23.2f * 1.17f).sp, letterSpacing = (-.025).em)) } else head(15f, 700)
        "h4" -> c = c.weight(700).let { if (ctx.parentHas("rule-check")) it.size(it.px, 1.5f) else it }
    }
    // .link (style.css 123): gold, 600, also on a span.link inside a row.
    if (n.tag == "span" && n.has("link")) c = c.color(Site.Gold).weight(600)
    // .eyebrow: 11, 700, .12em apart, uppercase, muted.
    if (n.has("eyebrow")) c = c.copy(style = c.style.copy(fontSize = 11.sp, lineHeight = (11 * c.line).sp, letterSpacing = 1.32.sp, color = Site.Muted, fontWeight = FontWeight(700)), upper = true)
    // .eyebrow.up good, .eyebrow.down bad (Versions' In and Out).
    if (n.has("eyebrow") && n.has("up")) c = c.color(Good)
    if (n.has("eyebrow") && n.has("down")) c = c.color(Bad)
    // .pwp-card h3: .7rem, .16em apart, upper case, gold, 700. .pwp-card small and .pwp-text: .76rem muted. .pwp-eyebrow: .64rem,
    // .16em, upper case, gold, 700. .pwp-tier: 700 1.5rem (see pwpDisplay). .pwp-plan .88rem muted; .pwp-foot .7rem muted.
    // .pwp-match b .95rem. .pwp-pc h4: .68rem, .12em, upper case, good under Strong against (.pwp-pro), bad under Weak against.
    if (n.tag == "h3" && ctx.inside("pwp-card")) c = c.copy(style = c.style.copy(fontSize = 11.2.sp, lineHeight = (11.2f * 1.15f).sp, letterSpacing = 1.792.sp,
        color = Site.Gold, fontWeight = FontWeight(700)), upper = true)
    if ((n.tag == "small" || n.has("pwp-text")) && ctx.inside("pwp-card")) c = c.size(12.16f).color(Site.Muted)
    if (n.has("pwp-eyebrow")) c = c.copy(style = c.style.copy(fontSize = 10.24.sp, lineHeight = (10.24f * c.line).sp, letterSpacing = 1.638.sp, color = Site.Gold,
        fontWeight = FontWeight(700)), upper = true)
    if (n.has("pwp-tier")) c = c.copy(style = pwpDisplay(24f, Site.Text), line = 1.302f)
    if (n.has("pwp-plan")) c = c.size(14.08f).color(Site.Muted)
    if (n.has("pwp-foot")) c = c.size(11.2f).color(Site.Muted)
    if (n.tag == "b" && ctx.parentHas("pwp-match")) c = c.size(15.2f)
    if (n.tag == "h4" && ctx.inside("pwp-pc")) c = c.copy(style = c.style.copy(fontSize = 10.88.sp, lineHeight = (10.88f * c.line).sp, letterSpacing = 1.306.sp,
        color = if (ctx.parentHas("pwp-pro")) Good else Bad), upper = true)
    if (n.has("foot")) c = c.size(12f).color(Site.Faint)
    // .scout-row h3: .78rem, .08em, upper case, muted; its p 1.55. .pw-cap p, .pw-issue p, .pw-field p 1.45. .pw-cards .82rem / 1.6 muted.
    if (n.tag == "h3" && ctx.parentHas("scout-row")) c = c.copy(style = c.style.copy(fontSize = 12.48.sp, lineHeight = (12.48f * 1.15f).sp, letterSpacing = 1.sp, color = Site.Muted), upper = true)
    if (n.tag == "p" && ctx.parentHas("scout-row")) c = c.size(c.px, 1.55f)
    if (n.tag == "p" && (ctx.parentHas("pw-cap") || ctx.parentHas("pw-issue") || ctx.parentHas("pw-field"))) c = c.size(c.px, 1.45f)
    if (n.has("pw-cards")) c = c.size(13.12f, 1.6f).color(Site.Muted)
    if (n.has("issues")) c = c.size(13.5f)
    if (n.has("small")) c = c.size(if (n.has("muted") && ctx.inside("ingredient")) 12f else 13f)
    if (n.has("muted")) c = c.color(Site.Muted)
    if (n.has("learn-overview")) c = c.size(c.px, 1.65f).color(Site.Muted)
    if (n.has("learn-context")) c = c.size(c.px, 1.6f)
    // .warn-text (0,1,0) loses to .pwp-card .pwp-text (0,2,0): a Power card's error line stays muted, as the site draws it.
    if (n.has("warn-text") && !(n.has("pwp-text") && ctx.inside("pwp-card"))) c = c.color(Warn)
    if (n.has("ok-text")) c = c.color(Good)
    if (n.has("bad-text")) c = c.color(Bad)
    // The Wiki: the article at 16 / 1.78 (its lead 17 / 1.65), h3 19, h4 16; a glossary entry's words 1.65; the empty reader's muted 1.7.
    if (ctx.inside("wiki-article") && !ctx.inside("wiki-source-credit") && !ctx.inside("wiki-article-table-wrap") && !ctx.inside("wiki-article-figure")) {
        if (n.tag == "p" || n.tag == "li" || n.tag == "dd" || n.tag == "dt" || n.tag == "blockquote") c = if (ctx.inside("wiki-article-lead")) c.size(17f, 1.65f) else c.size(16f, 1.78f)
        if (n.tag == "h3") c = c.size(19f, 1.35f)
        if (n.tag == "h4") c = c.size(16f, 1.4f)
    }
    if (n.tag == "p" && !n.has("eyebrow") && !n.has("foot") && ctx.inside("wiki-glossary")) c = c.size(15f, 1.65f)
    if (n.tag == "p" && !n.has("eyebrow") && ctx.inside("wiki-reader-empty")) c = c.size(15f, 1.7f).color(Site.Muted)
    if (n.tag == "p" && !n.has("eyebrow")) {
        if (ctx.parentHas("learn-turn-body")) c = c.size(16.8f, 1.65f)
        if (ctx.inside("learn-topics") || ctx.inside("learn-topic") || ctx.inside("rule-check")) c = c.size(c.px, 1.65f)
        if (ctx.parentHas("learn-example")) c = c.size(14.72f, 1.65f)
        if (ctx.inside("rules-list")) c = c.size(c.px, 1.55f)
        if (ctx.glass && !n.has("foot")) c = c.size(c.px, 1.6f)
    }
    if (n.has("rule-source-text")) c = c.size(if (ctx.inside("rule-glass")) 14.08f else if (ctx.rules) 14.72f else 14.4f, if (ctx.rules) 1.8f else c.line).copy(pre = true)
    return c
}

/** A box: its padding, background and border where the site sets them, then its children as blocks (or a row or a grid). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Container(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val narrow = ui.screen <= 380.dp
    val inner = ctx.under(n)
    val shown = n.kids.filter { !(it is String && it.isBlank()) && !(it is SiteNode && it.hidden) }
    when {
        n.has("rule-learning") -> Column(mark.fillMaxWidth()) { Blocks(n.kids, ui, inner, padded = false, gap = 16f) }
        n.has("war-chest") -> WarChest(n, ui, inner, mark)
        n.has("pwp") -> PwpGrid(n, ui, inner, mark)
        n.has("pwp-card") -> PwpCard(n, ui, ctx, mark)
        n.has("pwp-ring") -> PwpRing(n, mark)
        n.has("pwp-id") || n.has("pwp-pro") || n.has("pwp-con") -> Column(mark.fillMaxWidth()) { Blocks(n.kids, ui, inner, padded = true) }
        // Grids of one column: their items 8 (.pwp-drivers), 7 (.pwp-field), 6 (.pwp-colors) or 4 (.pwp-match) apart, margins kept.
        n.has("pwp-drivers") || n.has("pwp-field") || n.has("pwp-colors") || n.has("pwp-match") -> Column(mark.fillMaxWidth()) {
            FlexItems(n.kids, ui, inner, gap = when { n.has("pwp-drivers") -> 8f; n.has("pwp-field") -> 7f; n.has("pwp-colors") -> 6f; else -> 4f }) }
        n.has("pwp-dr") -> PwpDr(n, mark)
        n.has("pwp-f") -> PwpField(n, mark)
        // .pwp-row: its heading and its note (or the share) apart on one line, centred, 10 at least between.
        n.has("pwp-row") -> FlexBetween(mark.fillMaxWidth(), 10.dp) {
            shown.filterIsInstance<SiteNode>().forEach { k ->
                when {
                    k.has("pwp-same") -> Text(k.text(), style = pwpDisplay(22.4f, Site.Gold))
                    k.tag == "small" -> Paragraph(k.kids, ui, textCtx(k, inner).under(k), fill = false)
                    else -> Element(k, ui, inner)
                }
            }
        }
        // .pwp-pills 8 apart, .pwp-diff 6, .pwp-actions (buttons) 8; all wrapping.
        n.has("pwp-pills") || n.has("pwp-diff") || n.has("pwp-actions") -> {
            val gap = if (n.has("pwp-diff")) 6.dp else 8.dp
            FlowRow(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap), verticalArrangement = Arrangement.spacedBy(gap)) {
                shown.filterIsInstance<SiteNode>().forEach { k -> if (k.tag == "button") SiteButton(k, ui, inner) else PwpPill(k) } }
        }
        n.has("pwp-bars") -> PwpBars(n, mark)
        n.has("pwp-tiles") -> PwpTiles(n, ui, mark)
        n.has("pwp-split") -> PwpSplit(n, mark)
        n.has("pwp-legend") -> PwpLegend(n, mark)
        n.has("pwp-chain") -> PwpChain(n, mark)
        n.has("pwp-meter") -> PwpTrack(mark, 6.dp, styleNum(n.elements.firstOrNull()?.get("style"), "width") ?: 0f, round = false) { w ->
            Brush.horizontalGradient(listOf(PwpGoldDeep, Site.Gold), 0f, w) }
        n.has("pwp-pc") -> PwpPc(n, ui, inner, mark)
        n.has("pwp-m") -> PwpMatch(n, mark)
        n.has("pwp-sw") -> PwpSwap(n, ui, ctx, mark)
        n.has("score-panel") && n.has("power") -> ScorePanel(n, ui, ctx, mark)
        n.has("ai-launch-top") -> Row(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            shown.filterIsInstance<SiteNode>().forEach { k ->
                when {
                    k.has("ai-sigil") -> Box(Modifier.size(48.dp)) { BrandMark(48.dp) }
                    k.has("chip") -> SiteChip(k)
                    else -> Column(Modifier.weight(1f)) { Blocks(k.kids, ui, inner.under(k), padded = false) }
                }
            }
        }
        n.has("ai-launch-actions") -> FlowRow(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp),
            itemVerticalAlignment = Alignment.CenterVertically) {
            shown.forEach { k -> if (k is SiteNode && k.tag == "button") SiteButton(k, ui, inner) else Paragraph(listOf(k), ui, inner, fill = false) } }
        n.has("pw-dual") -> PwDual(n, mark)
        n.has("pw-profile") -> PwProfile(n, ui, mark)
        n.has("pw-chips") -> FlowRow(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            shown.filterIsInstance<SiteNode>().forEach { k -> if (k.has("chip")) SiteChip(k) else PwChip(k) } }
        n.has("pw-issue-top") -> Row(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Bottom) {
            shown.filterIsInstance<SiteNode>().forEach { k ->
                // .pw-lost: .85rem, 700, tabular; bad, warn where the issue is not major.
                if (k.has("pw-lost")) Text(k.text(), style = cssType(13.6f, 700, 19.7f, if (ctx.parentHas("pw-issue") && !ctx.parentHas("major")) Warn else Bad).copy(fontFeatureSettings = "tnum"))
                else Box(Modifier.weight(1f)) { Paragraph(listOf(k), ui, inner) }
            }
        }
        n.has("pw-track") -> PwTrack(n, ctx, mark)
        n.has("curve") -> CurveChart(n, mark, cost = if (ctx.inside("pwp-card")) 12.16f else 11.5f)
        n.has("meter") && n.has("two") -> MeterTwo(n, ui, inner, mark)
        n.has("meta-match") -> Column(mark.fillMaxWidth()) { Blocks(n.kids, ui, inner, padded = true, gap = 6f) }
        n.has("list") && n.has("compact") -> Column(mark.fillMaxWidth()) { shown.filterIsInstance<SiteNode>().forEach { Element(it, ui, inner) } }
        // .grid2: two columns, 10 apart. .diff: two columns, 14 apart (one at 520 and under).
        n.has("grid2") || n.has("diff") -> {
            val cols = if (n.has("diff") && ui.screen <= 520.dp) 1 else 2
            val gap = if (n.has("diff")) 14.dp else 10.dp
            Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(gap)) {
                shown.filterIsInstance<SiteNode>().chunked(cols).forEach { line ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap)) {
                        line.forEach { k -> Column(Modifier.weight(1f)) { if (k.tag == "div") Blocks(k.kids, ui, inner.under(k), padded = false) else Element(k, ui, inner) } }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        // .finder-controls (style.css 671-673): three equal columns 8 apart at every width; a .span-all child takes the whole row.
        n.has("finder-controls") -> Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val lines = ArrayList<List<SiteNode>>(); val run = ArrayList<SiteNode>()
            for (k in shown.filterIsInstance<SiteNode>()) {
                if (k.has("span-all")) { if (run.isNotEmpty()) { lines += run.toList(); run.clear() }; lines += listOf(k) }
                else { run += k; if (run.size == 3) { lines += run.toList(); run.clear() } }
            }
            if (run.isNotEmpty()) lines += run.toList()
            lines.forEach { line ->
                if (line.size == 1 && line[0].has("span-all")) Element(line[0], ui, inner)
                else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                    line.forEach { k -> Column(Modifier.weight(1f)) { Element(k, ui, inner) } }
                    repeat(3 - line.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        n.has("log-form") -> LogForm(n, ui, inner, mark)
        n.has("life-grid") -> LifeGrid(n, ui, inner, mark)
        // .hand: cards in columns at least 96 wide (120 from 600), 6 apart.
        n.has("hand") -> BoxWithConstraints(mark.fillMaxWidth()) {
            val min = if (ui.screen >= 600.dp) 120.dp else 96.dp
            val cols = maxOf(1, ((maxWidth + 6.dp) / (min + 6.dp)).toInt())
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                shown.filterIsInstance<SiteNode>().chunked(cols).forEach { line ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        line.forEach { Box(Modifier.weight(1f)) { Element(it, ui, inner) } }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        // .learn-nav: a wrapping row, 8 apart, 2 above and 8 under (a column at 380 and under).
        n.has("learn-nav") -> FlowRow(mark.fillMaxWidth().padding(top = 2.dp, bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            shown.filterIsInstance<SiteNode>().forEach { Element(it, ui, inner) } }
        // .learn-step-rail: three across (two at 380 and under), 6 apart, each 44 tall.
        n.has("learn-step-rail") -> {
            val cols = if (narrow) 2 else 3
            Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                shown.filterIsInstance<SiteNode>().chunked(cols).forEach { line ->
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        line.forEach { Box(Modifier.weight(1f).fillMaxHeight()) { SiteButton(it, ui, inner, Modifier.fillMaxSize()) } }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        n.has("row") || n.has("learn-book-filters") || n.has("learn-keywords") || n.has("rule-source-footer") || n.has("chips") || n.has("actions")
            || n.has("head-actions") || n.has("src-row") || n.has("page-head") -> {
            // .page-head: flex, wrapping, 10 apart, 4 above and 2 under; .head-actions 8 apart; .src-row 6 apart, 4 above and 12 under.
            val gap = when { n.has("learn-book-filters") || n.has("chips") || n.has("src-row") -> 6.dp; n.has("rule-source-footer") -> 12.dp; n.has("page-head") -> 10.dp; else -> 8.dp }
            val box = if (n.has("src-row")) mark.fillMaxWidth().padding(top = 4.dp, bottom = 12.dp) else if (n.has("page-head")) mark.fillMaxWidth().padding(top = 4.dp, bottom = 2.dp)
                else if (n.has("rule-source-footer")) mark.fillMaxWidth().drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }.padding(top = 20.dp) else mark.fillMaxWidth()
            if (n.has("between") && !n.has("wrap")) FlexBetween(box, gap) {
                shown.forEach { k ->
                    // Each item its own content's width, shrinking in proportion to it when they don't fit (flex-shrink), and a
                    // heading keeps its margins (a flex item's don't collapse): .panel .row h3's 8 under it.
                    when {
                        k is SiteNode && (k.tag == "button" || k.tag == "a" || k.tag == "input") -> Element(k, ui, inner)
                        // A span.chip (the game log's 1W · 0L): its pill.
                        k is SiteNode && k.tag == "span" && k.has("chip") -> SiteChip(k)
                        // .pw-sim b: 1.05rem, tabular, in the check's colour.
                        k is SiteNode && k.tag == "b" && ctx.parentHas("pw-sim") -> Text(k.text(), style = cssType(16.8f, 700, 24.4f, simInk(ctx.parent!!)).copy(fontFeatureSettings = "tnum"))
                        k is SiteNode && k.tag.length == 2 && k.tag[0] == 'h' -> margins(k, inner).let { (t, b) -> Box(Modifier.padding(top = t.dp, bottom = b.dp)) { Element(k, ui, inner) } }
                        k is SiteNode && !isInline(k, false) -> Element(k, ui, inner)
                        else -> Paragraph(listOf(k), ui, inner, Modifier)
                    }
                } }
            else FlowRow(box, horizontalArrangement = Arrangement.spacedBy(gap), verticalArrangement = Arrangement.spacedBy(gap)) {
                shown.forEach { k ->
                    when {
                        k is SiteNode && k.tag == "p" -> Box(Modifier.fillMaxWidth()) { Paragraph(k.kids, ui, textCtx(k, inner).under(k)) }
                        k is SiteNode && k.tag == "span" && k.has("chip") -> SiteChip(k)
                        k is SiteNode && !isInline(k, false) -> Element(k, ui, inner)
                        k is SiteNode && k.tag == "a" -> SiteButton(k, ui, inner)
                        else -> Box { Paragraph(listOf(k), ui, inner) }
                    }
                }
            }
        }
        // .rules-ask-intro: the orb (48) beside its words, 14 apart.
        n.has("rules-ask-intro") -> Row(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            shown.filterIsInstance<SiteNode>().forEach { k -> if (k.has("ask-orb")) Element(k, ui, inner) else Column(Modifier.weight(1f)) { Blocks(k.kids, ui, inner.under(k), padded = false) } }
        }
        n.has("rule-passages") -> Column(mark.fillMaxWidth()) {
            shown.filterIsInstance<SiteNode>().forEachIndexed { i, s ->
                Column(if (i == 0) Modifier.fillMaxWidth() else Modifier.fillMaxWidth().padding(top = 10.dp).drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }.padding(top = 10.dp)) {
                    Blocks(s.kids, ui, inner.under(s), padded = false) }
            }
        }
        n.has("rule-document") -> Column(mark.fillMaxWidth().drawBehind { drawLine(Site.Line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }.padding(vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)) {
            // .rule-document: the book's name over its line (small: a block, muted, .76rem / 1.6, 5 above), then its links.
            shown.filterIsInstance<SiteNode>().forEach { k ->
                if (k.tag == "div") Column {
                    k.elements.forEach { x -> if (x.tag == "small") { Spacer(Modifier.height(5.dp)); Paragraph(x.kids, ui, inner.size(12.16f, 1.6f).color(Site.Muted)) } else Paragraph(listOf(x), ui, inner) }
                } else Element(k, ui, inner)
            }
        }
        else -> {
            val shape = RoundedCornerShape(when { n.has("panel") -> 14.dp; n.has("rule-check") -> 16.dp; n.has("note") -> 12.dp; else -> 0.dp })
            var m = mark.fillMaxWidth()
            var c = inner
            var pad: PaddingValues? = null
            var gap: Float? = null
            when {
                // .learn-welcome: its gradient is mixed from --accent, so in the dark sheet (no --accent) it has no fill at all.
                n.has("learn-welcome") -> {
                    m = m.clip(shape).then(if (light) Modifier.background(Brush.linearGradient(listOf(lerp(Site.Surface, Site.Gold, .08f), Site.Surface))) else Modifier).border(1.dp, Site.Line, shape)
                    pad = PaddingValues(20.dp)
                }
                n.has("rule-dex") && ctx.inside("learn-disclosure") -> {}
                // style.css .wiki-glossary, .wiki-reader-empty: corners 22, the panel's fill and line, 18 in (20 the empty reader).
                n.has("wiki-glossary") || n.has("wiki-reader-empty") -> { val s = RoundedCornerShape(22.dp); m = m.clip(s).background(Site.Surface).border(1.dp, Site.Line, s)
                    pad = PaddingValues(if (n.has("wiki-reader-empty")) 20.dp else 18.dp) }
                // .wiki-article (420 and under): corners 18, 18 in; its header a line under, 18 above it; .wiki-source-credit a line over, 18
                // under it, 12 / 1.65 muted; a blockquote the link colour's 3 edge on surface-2, 14 / 18 in.
                n.has("wiki-article") -> { val s = RoundedCornerShape(18.dp); m = m.clip(s).background(Site.Surface).border(1.dp, Site.Line, s); pad = PaddingValues(18.dp) }
                n.tag == "header" && ctx.parentHas("wiki-article") -> { m = m.drawBehind { drawLine(Site.Line, Offset(0f, size.height - .5.dp.toPx()), Offset(size.width, size.height - .5.dp.toPx()), 1.dp.toPx()) }
                    pad = PaddingValues(bottom = 18.dp) }
                n.has("wiki-source-credit") -> { m = m.drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }; pad = PaddingValues(top = 18.dp); c = c.size(12f, 1.65f).color(Site.Muted) }
                n.tag == "blockquote" && ctx.inside("wiki-page") -> { val edge = WikiLink
                    m = m.clip(RoundedCornerShape(topEnd = 12.dp, bottomEnd = 12.dp)).background(Site.Surface2).drawBehind { drawRect(edge, size = Size(3.dp.toPx(), size.height)) }
                    pad = PaddingValues(start = 21.dp, end = 18.dp, top = 14.dp, bottom = 14.dp) }
                n.has("panel") -> {
                    // .ai-review-launch: the game colour (16 %) glowing from the top left corner over surface-2, its line 40 % the game colour.
                    // .issues-panel: a 40 % bad line. .pw-caps: a 3 warn left edge.
                    m = m.clip(shape).then(if (n.has("ai-review-launch")) Modifier.background(Site.Surface2).drawBehind { cornerGlow(GameColor.copy(alpha = .16f)) } else Modifier.background(Site.Surface))
                    if (n.has("pw-caps")) m = m.drawBehind { drawRect(Warn, size = Size(3.dp.toPx(), size.height)) }
                    m = m.border(1.dp, when { n.has("issues-panel") -> Color(0x66F08A7E); n.has("ai-review-launch") -> lerp(Site.Line, GameColor, .4f); else -> Site.Line }, shape)
                    val p = if (n.has("rule-library") || n.has("rule-destination")) 18.dp else 14.dp
                    pad = PaddingValues(start = if (n.has("pw-caps")) p + 2.dp else p, end = p, top = p, bottom = p)
                    if (n.has("scout")) gap = 4f
                }
                // .pw-cap, .scout-row, .pw-sim: 10 above and under, a line above all but the first of their type (.pw-sim's rows 5 apart).
                n.has("pw-cap") || n.has("scout-row") || n.has("pw-sim") -> {
                    val sibs = ctx.parent?.elements.orEmpty().filter { it.tag == n.tag }
                    if (sibs.firstOrNull() !== n) m = m.drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }
                    pad = PaddingValues(vertical = 10.dp)
                    if (n.has("pw-sim")) gap = 5f
                    // .scout-row:last-of-type p b:first-child: --accent (#e8b85a where the dark sheet leaves it unset).
                    if (n.has("scout-row") && sibs.lastOrNull() === n) c = c.copy(firstBInk = accent ?: Color(0xFFE8B85A))
                }
                // .pw-issue: a 3 left edge (major bad, mid warn, else warn at 55 %), 12 / 14 in.
                n.has("pw-issue") -> {
                    val edge = when { n.has("major") -> Bad; n.has("mid") -> Warn; else -> Warn.copy(alpha = .55f) }
                    m = m.drawBehind { drawRect(edge, size = Size(3.dp.toPx(), size.height)) }
                    pad = PaddingValues(start = 17.dp, top = 12.dp, bottom = 12.dp)
                }
                // .pw-field: corners 12, the text at 5 %, a 3 left edge (muted; warn, ok), 12 / 14 in.
                n.has("pw-field") -> {
                    val edge = when { n.has("warn") -> Warn; n.has("ok") -> Good; else -> Site.Muted }
                    m = m.clip(RoundedCornerShape(12.dp)).background(Site.Text.copy(alpha = .05f)).drawBehind { drawRect(edge, size = Size(3.dp.toPx(), size.height)) }
                    pad = PaddingValues(start = 17.dp, end = 14.dp, top = 12.dp, bottom = 12.dp)
                }
                n.has("rule-check") -> { m = m.clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape); pad = PaddingValues(16.dp) }
                n.has("note") -> { m = m.clip(shape).background(Site.Surface2); pad = PaddingValues(horizontal = 12.dp, vertical = 10.dp); c = c.size(13.5f) }
                n.has("learn-example") -> {
                    val gold = Site.Gold
                    m = m.clip(RoundedCornerShape(topEnd = 12.dp, bottomEnd = 12.dp)).background(Site.Surface).drawBehind { drawRect(gold, size = Size((if (ctx.rules) 2 else 3).dp.toPx(), size.height)) }
                    pad = PaddingValues(start = 16.dp + (if (ctx.rules) 2 else 3).dp, end = 16.dp, top = 12.dp, bottom = 12.dp)
                }
                n.has("learn-turn-body") -> pad = PaddingValues(top = 8.dp, bottom = 22.dp)
                n.has("rule-check-answer") -> { m = m.drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }; pad = PaddingValues(top = 14.dp) }
                n.has("rule-card-context") -> { m = m.drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }; pad = PaddingValues(top = 14.dp) }
                n.has("learn-topic-grid") || n.has("rule-check-grid") || n.has("learn-topics") -> gap = 12f
                "data-learning-home" in n.attrs -> gap = if (ui.screen >= 1000.dp) 14f else 12f
            }
            // .rule-dex in a disclosure: its eyebrow and heading are hidden there.
            val kids = if (n.has("rule-dex") && ctx.inside("learn-disclosure")) n.kids.filterNot { it is SiteNode && (it.has("eyebrow") || it.tag == "h3") } else n.kids
            Column(pad?.let { m.padding(it) } ?: m) { Blocks(kids, ui, c, padded = pad != null, gap = gap) }
        }
    }
}

/** ol.learn-story: three across (10 apart, 8 at 380 and under); each step's number in a 26 ring over its words (.82rem / 1.45). */
@Composable
private fun LearnStory(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val gap = if (ui.screen <= 380.dp) 8.dp else 10.dp
    Row(mark.fillMaxWidth().widthIn(max = 680.dp), horizontalArrangement = Arrangement.spacedBy(gap)) {
        n.elements.filter { it.tag == "li" }.forEach { li ->
            Column(Modifier.weight(1f)) {
                val num = li.elements.firstOrNull { it.tag == "span" }
                if (num != null) Box(Modifier.size(26.dp).border(1.dp, Site.Line, CircleShape), contentAlignment = Alignment.Center) {
                    Text(num.text(), style = cssType(11.52f, 750, 16.7f, accent ?: Site.Text), textAlign = TextAlign.Center) }
                Spacer(Modifier.height(7.dp))
                Paragraph(li.kids.filter { it !== num }, ui, ctx.size(13.12f, 1.45f))
            }
        }
    }
}

/**
 * details / summary: the summary as the site styles it in each place; a tap opens or closes it through the site's own toggle
 * (its listeners hear it, as the page's do). .learn-disclosure: a panel, 18 / 20 in (16 at 380 and under), 20 under an open
 * summary. .learn-topic: 16 above and below, a line under (not the last). Inside .learn-topics: 16 in, a line round, corners 16.
 */
@Composable
private fun Details(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val open = "open" in n.attrs
    val summary = n.elements.firstOrNull { it.tag == "summary" }
    val body = n.kids.filter { it !== summary }
    val inner = ctx.under(n)
    val last = ctx.parent?.elements?.lastOrNull { !it.hidden } === n
    var m = mark.fillMaxWidth()
    var pad = PaddingValues(0.dp)
    var sum = inner
    var bodyCtx = inner
    var openGap = 0f
    var blockSmall = false
    // A plain details.small (deckPlaytest's Peek at Prizes): 13, with the UA's disclosure triangle before its summary.
    // A details with no class in a panel (engine-map's) has it too.
    val marker = (n.has("small") && !n.has("panel")) || (n.classes.isEmpty() && ctx.inside("panel") && !ctx.rules)
    if (n.has("small") && !n.has("panel")) sum = inner.size(13f)
    when {
        n.has("panel") -> {
            val shape = RoundedCornerShape(14.dp)
            m = m.clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape)
            if (n.has("wiki-glossary-browse")) { val s = RoundedCornerShape(22.dp); m = mark.fillMaxWidth().clip(s).background(Site.Surface).border(1.dp, Site.Line, s); pad = PaddingValues(18.dp) }
            else if (n.has("learn-disclosure")) { pad = if (ui.screen <= 380.dp) PaddingValues(16.dp) else PaddingValues(horizontal = 20.dp, vertical = 18.dp); openGap = 20f; blockSmall = true }
            else pad = PaddingValues(14.dp)
        }
        n.has("learn-topic") -> {
            if (!last) m = m.drawBehind { drawLine(Site.Line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }
            pad = PaddingValues(vertical = 16.dp); blockSmall = true
        }
        ctx.parentHas("learn-topics") -> { val r = RoundedCornerShape(16.dp); m = m.clip(r).border(1.dp, Site.Line, r); pad = PaddingValues(16.dp); sum = inner.weight(750) }
        n.has("learn-turn-tip") -> { sum = inner.size(13.76f, 1.6f); bodyCtx = inner.size(13.76f, 1.6f).color(Site.Muted) }
        n.has("rule-hint-example") || n.has("rule-card-context") -> sum = inner.size(12.75f, 1.5f)
        n.has("rule-documents") -> { m = m.drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }; pad = PaddingValues(top = 20.dp); sum = inner.weight(650) }
        n.has("learn-chapters") -> sum = inner.size(13.6f).color(Site.Muted)
        // details.ingredient: a line above (and under, but the last), 8 in, 14; its summary a grid, 6 apart, no marker.
        n.has("ingredient") -> {
            val line = Site.Line
            m = m.drawBehind { drawLine(line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()); if (!last) drawLine(line, Offset(0f, size.height - 1.dp.toPx()), Offset(size.width, size.height - 1.dp.toPx()), 1.dp.toPx()) }
            // details.ingredient[open] > summary b: --accent (gold in light; unset in the dark sheet, so the text colour).
            pad = PaddingValues(vertical = 8.dp); sum = inner.size(14f).copy(bInk = if (open) accent else null); bodyCtx = inner.size(14f)
        }
        // .pwp-more: the glass line round it, corners 12, 0 / 14 in (12 under when open), on surface; its summary 44 tall, gold, .82rem,
        // .06em apart, no marker (a flex box).
        n.has("pwp-more") -> {
            val shape = RoundedCornerShape(12.dp)
            m = m.clip(shape).background(Site.Surface).border(1.dp, PwpLine, shape)
            pad = PaddingValues(start = 14.dp, end = 14.dp, bottom = if (open) 12.dp else 0.dp)
            sum = inner.size(13.12f).color(Site.Gold).let { it.copy(style = it.style.copy(letterSpacing = .787.sp)) }
        }
        ctx.parentHas("rules-list") -> {
            // .rules-list details: a line between (10 in); in the rulebook a line under each (14 in), the summary's small on its own line.
            val library = ctx.inside("rule-library")
            val first = ctx.parent?.elements?.firstOrNull { !it.hidden } === n
            m = if (library) m.drawBehind { drawLine(Site.Line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }
                else if (!first) m.drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) } else m
            pad = PaddingValues(vertical = if (library) 14.dp else 10.dp); blockSmall = library
        }
    }
    Column(m.padding(pad)) {
        val tall = n.has("pwp-more")
        if (summary != null) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).clickable { ui.tap(summary.id) }.semantics { role = Role.Button }
            .then(if (tall) Modifier.heightIn(min = 44.dp) else Modifier), verticalArrangement = Arrangement.Center) {
            if (marker) Row(verticalAlignment = Alignment.CenterVertically) {
                val ink = sum.style.color
                androidx.compose.foundation.Canvas(Modifier.size(7.dp, 8.5.dp)) {
                    val t = androidx.compose.ui.graphics.Path().apply {
                        if (open) { moveTo(0f, size.height * .2f); lineTo(size.width, size.height * .2f); lineTo(size.width / 2, size.height * .9f) }
                        else { moveTo(0f, 0f); lineTo(size.width, size.height / 2); lineTo(0f, size.height) }
                        close()
                    }
                    drawPath(t, ink)
                }
                Spacer(Modifier.width(7.dp))
                Summary(summary, ui, sum.under(summary), blockSmall, n)
            } else if (n.has("rules-supplement")) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // details.panel > summary is a flex row (8 apart, centred): the b (1rem) and its small (.8rem, muted, 400, 5 above).
                summary.elements.forEach { k -> when (k.tag) {
                    "b" -> Text(k.text(), Modifier.weight(1f), style = sum.style.copy(fontSize = 16.sp, lineHeight = 22.4.sp, fontWeight = FontWeight.Bold))
                    "small" -> Text(k.text(), Modifier.weight(1f).padding(top = 5.dp), style = sum.style.copy(fontSize = 12.8.sp, lineHeight = 17.9.sp, fontWeight = FontWeight.Normal, color = Site.Muted))
                } }
            } else if (n.has("panel") && !n.has("learn-disclosure") && summary.elements.any { it.has("chip") }) PanelSummary(summary, ui, sum.under(summary))
            else Summary(summary, ui, sum.under(summary), blockSmall, n)
        }
        // .learn-disclosure[open] > summary: 20 under it, meeting the first block's top margin.
        if (open) Blocks(body, ui, bodyCtx, padded = true, lead = openGap)
    }
}

/** A summary's words; where the site makes its <small> a block, each on its own line under the title (muted, 5 above; .learn-topic's 6, weight 400). */
@Composable
private fun Summary(s: SiteNode, ui: SiteUi, ctx: Ctx, blockSmall: Boolean, d: SiteNode) {
    val smalls = s.kids.filter { it is SiteNode && it.tag == "small" }
    // details.ingredient > summary: a grid, 6 apart, so each element and each run of words is its own row (a block's margins add).
    if (d.has("ingredient")) {
        val items = ArrayList<List<Any>>(); var run = ArrayList<Any>()
        fun flush() { if (run.any { !(it as String).isBlank() }) items.add(run); run = ArrayList() }
        for (k in s.kids) { if (k is SiteNode && k.hidden) continue; if (k is String) run.add(k) else { flush(); items.add(listOf(k)) } }
        flush()
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            for (item in items) {
                val k = item.singleOrNull() as? SiteNode
                if (k != null && !isInline(k, false)) margins(k, ctx).let { (t, b) -> Box(Modifier.fillMaxWidth().padding(top = t.dp, bottom = b.dp)) { Element(k, ui, ctx) } }
                else Paragraph(item, ui, ctx)
            }
        }
        return
    }
    // Blocks in it (a score row and its bar): laid as blocks.
    if (s.kids.any { it is SiteNode && !it.hidden && !isInline(it, false) }) { Column(Modifier.fillMaxWidth()) { Blocks(s.kids, ui, ctx, padded = true) }; return }
    if (!blockSmall || smalls.isEmpty()) { Paragraph(s.kids, ui, ctx); return }
    val disclosure = d.has("learn-disclosure")
    // .learn-disclosure > summary b: 1rem; its small .8rem, 5 above. .learn-topic summary small: 6 above, weight 400, the UA's smaller.
    Paragraph(s.kids.filter { it !in smalls }, ui, if (disclosure) ctx.size(16f, 1.4f) else ctx.size(ctx.px, 1.4f))
    val (size, above) = when { disclosure -> 12.8f to 5f; d.has("learn-topic") -> 12.5f to 6f; else -> 12f to 5f }
    for (k in smalls) { Spacer(Modifier.height(above.dp)); Paragraph((k as SiteNode).kids, ui, ctx.size(size, 1.45f).color(Site.Muted).weight(400)) }
}

// ---------------------------------------------------------------- controls

/**
 * A button or link as the site draws it: .btn (gold; .ghost on surface-2 with its line; .small 34 tall at 13.5), .chip (a pill;
 * .pick 13 with 7 / 12 in; .on gold; in .rule-learning at least 40 tall, the step rail's 44 at .76rem, corners 10), .link (gold,
 * 600), .rule-dismiss (the glass's ✕), a plain <a href> (opens outside the app).
 */
/** icons.js's leading glyphs (decorateGlyphs) for the buttons a panel draws; empty where a host has not read them. */
internal val LocalSiteGlyphs = androidx.compose.runtime.staticCompositionLocalOf<Map<String, SiteSvg>> { emptyMap() }

@Composable
private fun SiteButton(n: SiteNode, ui: SiteUi, ctx: Ctx, modifier0: Modifier = Modifier) {
    val disabled = "disabled" in n.attrs
    val href = n["href"].orEmpty()
    var bounds by remember { mutableStateOf<androidx.compose.ui.geometry.Rect?>(null) }
    val tap: () -> Unit = { if (n.tag == "a" && href.startsWith("http")) ui.open(href) else if (!disabled) { ui.anchor.value = bounds; ui.tap(n.id) } }
    val (icon, label) = leadGlyph(n.text(), LocalSiteGlyphs.current)
    val rail = ctx.parentHas("learn-step-rail")
    val modifier = modifier0.onGloballyPositioned { bounds = it.boundsInRoot() }
    when {
        n.has("btn") -> {
            val ghost = n.has("ghost"); val small = n.has("small")
            val shape = RoundedCornerShape(11.dp)
            val ink = if (n.has("danger")) Bad else if (ghost) Site.Text else Site.GoldInk
            Box(modifier.alpha(if (disabled) .45f else 1f).heightIn(min = if (small) 34.dp else 44.dp).clip(shape).background(if (ghost) Site.Surface2 else Site.Gold)
                .then(if (ghost) Modifier.border(1.dp, Site.Line, shape) else Modifier).clickable(enabled = !disabled) { tap() }
                .semantics { role = Role.Button; n["aria-label"]?.let { contentDescription = it } }.padding(horizontal = if (small) 12.dp else 16.dp, vertical = 6.dp), contentAlignment = Alignment.Center) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (icon != null) SiteIcon(icon, if (small) 15.dp else 17.dp, ink, stroke = 2f)
                    Text(label, style = cssType(if (small) 13.5f else 15f, 700, if (small) 19.6f else 21.75f, ink), textAlign = TextAlign.Center)
                }
            }
        }
        n.has("chip") -> {
            val on = n.has("on") && n.has("pick")
            val shape = RoundedCornerShape(if (rail) 10.dp else 999.dp)
            val size = when { rail || ctx.parentHas("learn-book-filters") -> 12.16f; n.has("pick") -> 13f; else -> 12f }
            Box(modifier.heightIn(min = if (rail) 44.dp else if (ctx.rules) 40.dp else 0.dp).clip(shape).background(if (on) Site.Gold else Site.Surface2)
                .border(1.dp, if (on) Site.Gold else Site.Line, shape).clickable(enabled = !disabled) { tap() }.semantics { role = Role.Button; n["aria-label"]?.let { contentDescription = it } }
                .padding(horizontal = if (rail) 10.dp else if (n.has("pick")) 12.dp else 9.dp, vertical = if (rail) 8.dp else if (n.has("pick")) 7.dp else 3.dp),
                contentAlignment = Alignment.CenterStart) {
                Text(label, style = cssType(size, 700, size * 1.45f, if (on) Site.GoldInk else Site.Text))
            }
        }
        n.has("rule-dismiss") -> Box(modifier.clip(CircleShape).clickable { tap() }.semantics { role = Role.Button; contentDescription = n["aria-label"].orEmpty() }.padding(6.dp)) {
            Text(label, style = ctx.style) }
        else -> {
            // .link: gold words, 600 (.small 13); .rule-source-action wraps at 1.6. A plain <a>: the link colour, underlined (the glass's 12, --accent).
            val plain = n.tag == "a" && !n.has("link")
            val size = if (plain && ctx.glass) 12f else if (n.has("small")) 13f else ctx.px
            val color = if (plain && ctx.glass) (accent ?: Site.Text) else if (n.has("danger")) Bad else Site.Gold
            Row(modifier.clip(RoundedCornerShape(4.dp)).clickable(enabled = !disabled) { tap() }.semantics { role = Role.Button; n["aria-label"]?.let { contentDescription = it } }.padding(vertical = if (plain) 0.dp else 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) SiteIcon(icon, (size + 2f).dp, color, stroke = 2f)
                Text(label, style = cssType(size, if (plain) 400 else 600, size * (if (n.has("rule-source-action")) 1.6f else 1.45f), color)
                    .let { if (plain) it.copy(textDecoration = TextDecoration.Underline) else it })
            }
        }
    }
}

/** input[type=search]: the site's field (44 tall, 11 corners, its line); each letter goes to the site's input listener. */
@Composable
private fun SiteInput(n: SiteNode, ui: SiteUi, modifier: Modifier = Modifier, style: TextStyle = cssType(15f, 400, 21.75f, Site.Text)) {
    // Kept by the field's attributes, not its id: a redraw while typing (C.finderMax, I.finderSearch, I.refSearch draw the panel again)
    // gives it a new id, and the letters typed since stay (app.js rerenderKeepingFocus keeps the field as it is).
    var text by remember(n.tag, n.attrs - "value") { mutableStateOf(n.value ?: n["value"].orEmpty()) }
    val search = ui.submit != null && (n["type"] == "search" || n["enterkeyhint"] == "search")
    FormInput(text, { text = it; ui.type(n.id, it) }, style, n["placeholder"].orEmpty(), modifier, desc = n["aria-label"].orEmpty(),
        keyboard = if (n["type"] == "number") androidx.compose.ui.text.input.KeyboardType.Number else androidx.compose.ui.text.input.KeyboardType.Text,
        ime = if (search) androidx.compose.ui.text.input.ImeAction.Search else androidx.compose.ui.text.input.ImeAction.Done, onGo = { if (search) ui.submit?.invoke(n.id) })
}

/** A <select>: glass-select.js's field with the chosen option (wrapping as the site's does); a pick goes to its change listener. */
@Composable
private fun SiteSelect(n: SiteNode, ui: SiteUi, modifier: Modifier = Modifier, style: TextStyle = cssType(15f, 400, 21.75f, Site.Text)) {
    val opts = n.elements.filter { it.tag == "option" }.map { (it["value"] ?: it.text()) to it.text() }
    var picked by remember(n.id) { mutableStateOf(n.value ?: n.elements.firstOrNull { it.tag == "option" && "selected" in it.attrs }?.let { it["value"] ?: it.text() } ?: opts.firstOrNull()?.first.orEmpty()) }
    Box(modifier.fillMaxWidth()) {
        FormSelect(opts, picked, style, desc = n["aria-label"].orEmpty(), wrap = true) { v -> picked = v; ui.type(n.id, v) }
    }
}

// ---------------------------------------------------------------- words

/**
 * A paragraph of words and inline tags: <b>/<strong> bold, <small> smaller, <em> italic, a rule word (.rule-word, underlined in
 * the accent colour: its tap opens the rule dex) and a link or button inside the words as a gold tap target. Whitespace folds to
 * single spaces as HTML folds it, except in pre-wrap text (.rule-source-text).
 */
@Composable
private fun Paragraph(kids: List<Any>, ui: SiteUi, ctx: Ctx, modifier: Modifier = Modifier, center: Boolean = false, fill: Boolean = true, oneLine: Boolean = false) {
    val spot = remember { LinkSpot() }
    val s = remember(kids, ctx) { buildAnnotatedString { fold(this, kids, ui, ctx, spot) } }
    val shown = if (ctx.pre) s else s.trimEnd()
    if (shown.text.isBlank()) return
    Text(shown, (if (fill) modifier.fillMaxWidth() else modifier).onGloballyPositioned { spot.coords = it }, style = ctx.style, textAlign = if (center) TextAlign.Center else TextAlign.Start,
        onTextLayout = { spot.layout = it }, maxLines = if (oneLine) 1 else Int.MAX_VALUE,
        overflow = if (oneLine) androidx.compose.ui.text.style.TextOverflow.Ellipsis else androidx.compose.ui.text.style.TextOverflow.Clip, softWrap = !oneLine)
}
/** Where a paragraph's words sit, so a tapped link's box (its getBoundingClientRect) is known. */
private class LinkSpot {
    var layout: androidx.compose.ui.text.TextLayoutResult? = null
    var coords: androidx.compose.ui.layout.LayoutCoordinates? = null
    fun rect(start: Int, end: Int): androidx.compose.ui.geometry.Rect? {
        val l = layout ?: return null; val c = coords?.takeIf { it.isAttached } ?: return null
        val e = minOf(end, l.layoutInput.text.length); if (e <= start) return null
        return l.getPathForRange(start, e).getBounds().translate(c.positionInRoot())
    }
}
/** Whitespace at the end of a line box folds away. */
private fun AnnotatedString.trimEnd(): AnnotatedString { var e = text.length; while (e > 0 && text[e - 1] == ' ') e--; return if (e == text.length) this else subSequence(0, e) }

private fun fold(b: AnnotatedString.Builder, kids: List<Any>, ui: SiteUi, ctx: Ctx, spot: LinkSpot) {
    val pre = ctx.pre
    // b:first-child: the first element in the paragraph.
    val first = kids.firstOrNull { it is SiteNode }
    var lastSpace = true
    fun put(t: String) {
        if (pre) { b.append(t); lastSpace = t.endsWith(" ") || t.endsWith("\n"); return }
        val f = t.replace(Regex("\\s+"), " ")
        val out = if (lastSpace) f.trimStart() else f
        if (out.isEmpty()) return
        b.append(out); lastSpace = out.endsWith(" ")
    }
    fun walk(k: Any, upper: Boolean) {
        if (k is String) { put(if (upper) k.uppercase() else k); return }
        val n = k as? SiteNode ?: return
        if (n.hidden || n.tag == "svg") return
        val kids = { u: Boolean -> n.kids.forEach { walk(it, u) } }
        when {
            n.tag == "br" -> { b.append("\n"); lastSpace = true }
            n.tag == "button" || (n.tag == "a" && n["href"] != null) -> {
                val href = n["href"].orEmpty()
                val style = if (n.has("rule-word")) SpanStyle(color = accent ?: Color.Unspecified, textDecoration = TextDecoration.Underline)
                    // style.css .wiki-article .wiki-article-link and .wiki-page a: --wiki-link, underlined, the words' own size and weight.
                    else if (n.has("wiki-article-link") || (n.tag == "a" && ctx.inside("wiki-page"))) SpanStyle(color = WikiLink, textDecoration = TextDecoration.Underline)
                    else SpanStyle(color = Site.Gold, fontWeight = FontWeight(600), fontSize = if (n.has("small")) 13.sp else TextUnit.Unspecified)
                val r = IntArray(2).also { it[0] = b.length }
                b.withLink(LinkAnnotation.Clickable("n:" + n.id, TextLinkStyles(style)) {
                    if (n.tag == "a" && href.startsWith("http")) ui.open(href) else { ui.anchor.value = spot.rect(r[0], r[1]); ui.tap(n.id) } }) { kids(upper) }
                r[1] = b.length
            }
            n.tag == "b" || n.tag == "strong" -> b.withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = when { n.has("warn-text") -> Warn; n.has("ok-text") -> Good; n.has("bad-text") -> Bad
                else -> (if (n === first) ctx.firstBInk else null) ?: ctx.bInk ?: Color.Unspecified })) { kids(upper) }
            n.tag == "em" || n.tag == "i" -> b.withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { kids(upper) }
            n.has("eyebrow") -> b.withStyle(SpanStyle(fontSize = 11.sp, letterSpacing = 1.32.sp, color = Site.Muted, fontWeight = FontWeight(700))) { kids(true) }
            // .pwp-card small: .76rem muted, anywhere in a Power card.
            n.tag == "small" && ctx.inside("pwp-card") -> b.withStyle(SpanStyle(fontSize = 12.16.sp, color = Site.Muted)) { kids(upper) }
            n.tag == "small" -> b.withStyle(SpanStyle(fontSize = (ctx.px * .833f).sp, color = if (n.has("muted")) Site.Muted else Color.Unspecified)) { kids(upper) }
            // .ingredient .muted.small: a block of its own, 12 (a score row's "0 / 22" under its name).
            n.has("muted") && n.has("small") && ctx.inside("ingredient") -> { b.append("\n"); lastSpace = true; b.withStyle(SpanStyle(fontSize = 12.sp, color = Site.Muted)) { kids(upper) } }
            n.has("small") -> b.withStyle(SpanStyle(fontSize = 13.sp, color = if (n.has("muted")) Site.Muted else Color.Unspecified)) { kids(upper) }
            n.has("muted") -> b.withStyle(SpanStyle(color = Site.Muted)) { kids(upper) }
            n.has("warn-text") -> b.withStyle(SpanStyle(color = Warn)) { kids(upper) }
            n.has("ok-text") -> b.withStyle(SpanStyle(color = Good)) { kids(upper) }
            n.tag == "code" -> b.withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) { kids(upper) }
            else -> kids(upper)
        }
    }
    kids.forEach { walk(it, ctx.upper) }
}

// ---------------------------------------------------------------- the War Chest (war-chest.js warChestMarkup, style.css .war-chest)

private val ChestCream = Color(0xFFF5F1E6)
private val ChestGold = Color(0xFFE8CE87)
private val ChestMuted = Color(0xFFB9BFCC)
private val ChestNight = Color(0xFF07090F)

/**
 * section.war-chest: a dark chest lid (radial gradient from the gold top, gold rings rising from under it every 22) with a gold line
 * round it, corners 24, 24 / 18 in; its head, the tools, the dice's result (not when empty) and Resume, 18 apart.
 */
@Composable
private fun WarChest(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val shape = RoundedCornerShape(24.dp)
    val c = ctx.color(ChestCream)
    Column(mark.fillMaxWidth().clip(shape).drawBehind { chestLid() }.border(1.dp, Color(0x47E8CE87), shape)
        // style.css 5707: .war-chest-dialog .war-chest { padding-top: 64px } leaves room for the dialog's ✕.
        .padding(start = 18.dp, end = 18.dp, top = if (ctx.inside("war-chest-dialog")) 64.dp else 24.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)) {
        n.elements.filter { !it.hidden && !(it.has("wc-result") && it.text().isEmpty()) }.forEach { k ->
            when {
                k.has("wc-head") -> ChestHead(k, ui)
                k.has("wc-tools") -> ChestTools(k, ui)
                // .wc-result: the dice's words, gold, 700, centred, at least 20 tall.
                k.has("wc-result") -> Box(Modifier.fillMaxWidth().heightIn(min = 20.dp), contentAlignment = Alignment.Center) {
                    Paragraph(k.kids, ui, c.weight(700).color(ChestGold), center = true) }
                k.has("wc-resume") -> ChestResume(k, ui, c)
                else -> Element(k, ui, c.under(n))
            }
        }
    }
}

/** The lid: radial-gradient(ellipse at 50% -10%, #3a2f17 0, #0d0f16 55%, #07090f 100%) under repeating 1 px rings of #e8ce870c from 50% 120%. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.chestLid() {
    val w = size.width; val h = size.height
    if (w <= 0f || h <= 0f) return
    val c = Offset(w / 2f, -.1f * h)
    // An ellipse sized farthest-corner keeps closest-side's shape (half the width : the 10 % above), grown through the far corner.
    val ry = .1f * h * kotlin.math.sqrt(122f)
    val sx = (w / 2f) / (.1f * h)
    withTransform({ scale(sx, 1f, c) }) {
        drawRect(Brush.radialGradient(0f to Color(0xFF3A2F17), .55f to Color(0xFF0D0F16), 1f to ChestNight, center = c, radius = ry),
            topLeft = Offset(c.x - w / sx, 0f), size = Size(2f * w / sx, h))
    }
    val rc = Offset(w / 2f, 1.2f * h)
    val far = kotlin.math.hypot(w / 2f, 1.2f * h)
    val step = 22.dp.toPx(); val line = 1.dp.toPx()
    var r = step
    while (r < far) { drawCircle(Color(0x0CE8CE87), r + line / 2f, rc, style = androidx.compose.ui.graphics.drawscope.Stroke(line)); r += step }
}

/** header.wc-head, centred: "CardStashy" (600 11, .2em apart, upper case), the Cinzel title (clamp(24, 5vw, 32), gold, .06em, glowing), its line (13). */
@Composable
private fun ChestHead(n: SiteNode, ui: SiteUi) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        for (k in n.elements.filter { !it.hidden }) when (k.tag) {
            "small" -> Text(k.text().uppercase(), style = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight(600), fontSize = 11.sp, lineHeight = 13.sp,
                letterSpacing = 2.2.sp, color = ChestMuted, lineHeightStyle = CSS_LINE), textAlign = TextAlign.Center)
            "h2" -> {
                val size = (ui.screen.value * .05f).coerceIn(24f, 32f)
                Spacer(Modifier.height(4.dp))
                Text(k.text(), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, lineHeight = (size * 1.35f).sp, letterSpacing = (size * .06f).sp,
                    color = ChestGold, lineHeightStyle = CSS_LINE, shadow = androidx.compose.ui.graphics.Shadow(Color(0x44E8CE87), Offset(0f, 2f * androidx.compose.ui.platform.LocalDensity.current.density),
                        11.3f * androidx.compose.ui.platform.LocalDensity.current.density)), textAlign = TextAlign.Center)
            }
            else -> { Spacer(Modifier.height(4.dp)); Paragraph(k.kids, ui, base().size(13f).color(ChestMuted), center = true) }
        }
    }
}

/** .wc-tools: columns at least 96 wide (8 apart, rows 16 apart), at most 640 across, centred. */
@Composable
private fun ChestTools(n: SiteNode, ui: SiteUi) {
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        val width = minOf(maxWidth, 640.dp)
        val cols = maxOf(1, ((width + 8.dp) / (96.dp + 8.dp)).toInt())
        Column(Modifier.width(width), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            n.elements.filter { !it.hidden }.chunked(cols).forEach { line ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    line.forEach { Box(Modifier.weight(1f), contentAlignment = Alignment.TopCenter) { Element(it, ui, base()) } }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

/** button.wc-tool: its orb over its name (600 12, cream), 8 apart, at least 44 tall; a tap runs the site's chestTool. */
@Composable
private fun ChestTool(n: SiteNode, ui: SiteUi, mark: Modifier) {
    val orb = n.elements.firstOrNull { it.has("wc-orb") }
    val hero = n.has("wc-hero")
    Column(mark.fillMaxWidth().heightIn(min = 44.dp).clickable { ui.tap(n.id) }
        .semantics { role = Role.Button }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(64.dp).drawBehind { chestOrb(hero) }, contentAlignment = Alignment.Center) {
            orb?.find { it.tag == "svg" }?.icon?.let { SiteIcon(outline(it), 30.dp, ChestGold) }
        }
        Text(n.elements.filter { it !== orb }.joinToString(" ") { it.text() }.trim(), style = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight(600),
            fontSize = 12.sp, lineHeight = 14.sp, color = ChestCream, lineHeightStyle = CSS_LINE), textAlign = TextAlign.Center)
    }
}

/** .wc-orb svg: fill none, stroked in the gold at 1.7 with round ends and joins. */
private fun outline(i: SiteSvg) = SiteSvg(i.vb, i.items.map { SiteSvg.Item(it.t, it.d, it.x, it.y, it.w, it.h, it.r, it.rx, it.ry, "none", "currentColor", 1.7f, "round", "round") }, i.grads, i.texts)

/**
 * .wc-orb: a 64 glass ball (radial-gradient(circle at 35% 28%, #2c3446, #0c1019 72%)) with its rings: 1.5 of #b8913f inside 4 of the
 * night, the 0 8 18 #000a drop and a 1 px white top edge; the hero (Game Night) 2 of the gold inside 5 and a 26 gold glow.
 */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.chestOrb(hero: Boolean) {
    val r = size.minDimension / 2f; val c = center
    fun soft(color: Color, blur: Float, dy: Float) = drawIntoCanvas { cv ->
        val paint = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true; this.color = color.toArgb()
            maskFilter = android.graphics.BlurMaskFilter(blur.dp.toPx() / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL) }
        cv.nativeCanvas.drawCircle(c.x, c.y + dy.dp.toPx(), r, paint)
    }
    if (hero) soft(Color(0x55E8CE87), 26f, 0f) else soft(Color(0xAA000000), 18f, 8f)
    drawCircle(ChestNight, r + (if (hero) 5f else 4f).dp.toPx(), c)
    drawCircle(if (hero) ChestGold else Color(0xFFB8913F), r + (if (hero) 2f else 1.5f).dp.toPx(), c)
    val far = kotlin.math.hypot(size.width * .65f, size.height * .72f)
    drawCircle(Brush.radialGradient(0f to Color(0xFF2C3446), .72f to Color(0xFF0C1019), center = Offset(size.width * .35f, size.height * .28f), radius = far), r, c)
    // inset 0 1px 0 #ffffff22: the sliver the ball keeps when it's moved 1 down.
    val edge = androidx.compose.ui.graphics.Path().apply {
        op(androidx.compose.ui.graphics.Path().apply { addOval(androidx.compose.ui.geometry.Rect(c, r)) },
            androidx.compose.ui.graphics.Path().apply { addOval(androidx.compose.ui.geometry.Rect(c + Offset(0f, 1.dp.toPx()), r)) }, androidx.compose.ui.graphics.PathOperation.Difference)
    }
    drawPath(edge, Color(0x22FFFFFF))
}

/** .wc-resume: "Game in progress" and its line beside Resume, corners 18, 12 / 14 in, the gold line round it over the night glass; 13 muted. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChestResume(n: SiteNode, ui: SiteUi, ctx: Ctx) {
    val shape = RoundedCornerShape(18.dp)
    FlowRow(Modifier.widthIn(max = 640.dp).fillMaxWidth().clip(shape).background(Color(0x9E0E131E)).border(1.dp, Color(0x57E8CE87), shape)
        .padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.spacedBy(12.dp),
        itemVerticalAlignment = Alignment.CenterVertically) {
        for (k in n.elements.filter { !it.hidden }) {
            if (k.tag == "button") SiteButton(k, ui, ctx)
            else Column(Modifier.padding(end = 12.dp)) {
                k.elements.firstOrNull { it.tag == "b" }?.let { Text(it.text(), style = cssType(13f, 700, 18.85f, ChestCream)) }
                Text(k.kids.filterIsInstance<String>().joinToString("").trim(), style = cssType(13f, 400, 18.85f, ChestMuted))
            }
        }
    }
}

/** button.hand-card: the card's picture, no padding; a tap opens the card (tcg.js tCard). */
@Composable
private fun HandCard(n: SiteNode, ui: SiteUi, mark: Modifier) {
    Box(mark.fillMaxWidth().clickable { ui.tap(n.id) }.semantics { role = Role.Button; contentDescription = n.find { it.tag == "img" }?.get("alt").orEmpty() }) {
        n.find { it.tag == "img" }?.let { SitePic(it, Modifier) }
    }
}

/** img.card-img: 488 : 680, corners 4.75 % / 3.5 %, surface-2 under it while it loads; the first of its sources that loads. */
/**
 * rules.js banlistView's .ban-grid: columns of at least 150 (auto-fill), 6 apart; each .ban-item a 44 / 1fr grid 8 apart, 6 in, corners 10,
 * the line round it on surface: the art crop (44 × 32, corners 4, removed when it fails) and the name (13, one line, cut with …).
 */
@Composable
private fun BanGrid(n: SiteNode, ui: SiteUi, mark: Modifier) {
    BoxWithConstraints(mark.fillMaxWidth()) {
        val cols = maxOf(1, ((maxWidth + 6.dp) / 156.dp).toInt())
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            n.elements.filter { !it.hidden }.chunked(cols).forEach { line ->
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    line.forEach { b ->
                        val shape = RoundedCornerShape(10.dp)
                        Row(Modifier.weight(1f).fillMaxHeight().heightIn(min = 44.dp).clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape)
                            .clickable { ui.tap(b.id) }.semantics { role = Role.Button }.padding(6.dp), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            val pic = b.find { it.tag == "img" }?.pic.orEmpty().let { if (it.isEmpty()) null else firstOf(it) }
                            Box(Modifier.size(44.dp, 32.dp).clip(RoundedCornerShape(4.dp))) {
                                if (pic != null) androidx.compose.foundation.Image(pic, null, Modifier.matchParentSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                            }
                            Text(b.find { it.tag == "span" }?.text().orEmpty(), Modifier.weight(1f), style = cssType(13f, 400, 18.85f, Site.Text), maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        }
                    }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun SitePic(n: SiteNode, mark: Modifier) {
    val sources = n.pic.orEmpty()
    val p = if (sources.isEmpty()) null else firstOf(sources)
    Box(mark.fillMaxWidth().aspectRatio(488f / 680f).drawWithContent {
        val clip = androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(androidx.compose.ui.geometry.Rect(Offset.Zero, size),
            androidx.compose.ui.geometry.CornerRadius(size.width * .0475f, size.height * .035f))) }
        clipPath(clip) { drawRect(Site.Surface2); this@drawWithContent.drawContent() }
    }) {
        if (p != null) androidx.compose.foundation.Image(p, n["alt"], Modifier.matchParentSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
    }
}

// ---------------------------------------------------------------- the one-page Power view (power.js powerPageHtml, deck-viewer.css .pwp-*)

/** --glass-line under polish.css body.glass (dark): color-mix(#e8b95b 15%, #ffffff0d); light settings-theme.css's. */
private val PwpLine get() = if (light) Site.GlassLine else Color(0x31EEC980)
/** color-mix(in srgb, [a], [b] [t]): mixed channel by channel as sRGB stores them (Compose's lerp mixes in Oklab). */
private fun srgbMix(a: Color, b: Color, t: Float) = Color(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t, a.alpha + (b.alpha - a.alpha) * t)
/** color-mix(in srgb, var(--gold) 55%, #000): the dark end of the bars. */
private val PwpGoldDeep get() = srgbMix(Color.Black, Site.Gold, .55f)
/**
 * .pwp-ring b, .pwp-tier, .pwp-same and .pwp-m em set `font: 700 <size> var(--display, inherit)`: 700 at that size in the body font,
 * line-height normal (DM Sans's ascent and descent, 1.302). No sheet defines --display, so in a browser the fallback puts `inherit`
 * inside the shorthand, which makes it invalid and the four inherit their parent's font; the app draws them as the rule is written.
 */
private fun pwpDisplay(size: Float, color: Color) = cssType(size, 700, size * 1.302f, color)
/** A number an inline style sets ("width:42%", "height:31px"). */
private fun styleNum(style: String?, prop: String) = Regex("(?:^|;)\\s*$prop\\s*:\\s*(-?[\\d.]+)").find(style.orEmpty())?.groupValues?.get(1)?.toFloatOrNull()
/** The colour an inline style's background names (#rrggbb). */
private fun styleInk(style: String?) = Regex("background\\s*:\\s*#([0-9a-fA-F]{6})").find(style.orEmpty())?.groupValues?.get(1)?.toLong(16)?.let { Color(0xFF000000 or it) }

/**
 * .pwp: a 12-column grid, 12 apart. Every card spans the row; from 820 wide a .pwp-6 card spans six, so the cards pair up two to a
 * row, both as tall as the taller (a grid row stretches its items); the hero, an odd last card and the footer stay across the row.
 */
@Composable
private fun PwpGrid(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val items = n.elements.filter { !it.hidden }
    Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (ui.screen < 820.dp) { items.forEach { Element(it, ui, ctx) }; return@Column }
        var i = 0
        while (i < items.size) {
            val a = items[i]; val b = items.getOrNull(i + 1)
            when {
                a.has("pwp-6") && b != null && b.has("pwp-6") -> { PwpPair(a, b, ui, ctx); i += 2 }
                // A .pwp-6 with no partner keeps its six columns, the rest of the row empty.
                a.has("pwp-6") -> { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) { Box(Modifier.weight(1f)) { Element(a, ui, ctx) }; Spacer(Modifier.weight(1f)) }; i++ }
                else -> { Element(a, ui, ctx); i++ }
            }
        }
    }
}

/**
 * Two .pwp-6 cards side by side, 12 apart, each first measured as tall as its content (a copy kept out of the semantics, so
 * TalkBack and tests see each card once), then both laid at the taller height.
 */
@Composable
private fun PwpPair(a: SiteNode, b: SiteNode, ui: SiteUi, ctx: Ctx) = androidx.compose.ui.layout.SubcomposeLayout(Modifier.fillMaxWidth()) { c ->
    val g = 12.dp.roundToPx(); val wa = (c.maxWidth - g) / 2; val wb = c.maxWidth - g - wa
    fun tall(slot: String, n: SiteNode, w: Int) = subcompose(slot) { Box(Modifier.clearAndSetSemantics {}) { Element(n, ui, ctx) } }.maxOfOrNull { it.measure(androidx.compose.ui.unit.Constraints(minWidth = w, maxWidth = w)).height } ?: 0
    val h = maxOf(tall("a-size", a, wa), tall("b-size", b, wb))
    val pa = subcompose("a") { Element(a, ui, ctx) }.map { it.measure(androidx.compose.ui.unit.Constraints.fixed(wa, h)) }
    val pb = subcompose("b") { Element(b, ui, ctx) }.map { it.measure(androidx.compose.ui.unit.Constraints.fixed(wb, h)) }
    layout(c.maxWidth, h) { pa.forEach { it.place(0, 0) }; pb.forEach { it.place(wa + g, 0) } }
}

/** A 1 border round a box with corners [r]: [side] all round, the top edge (to the corners' diagonals) in [top]. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.pwpBorder(side: Color, top: Color, r: Float) {
    val w = 1.dp.toPx()
    val edge = androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(w / 2, w / 2, size.width - w / 2, size.height - w / 2, androidx.compose.ui.geometry.CornerRadius(r - w / 2))) }
    drawPath(edge, side, style = androidx.compose.ui.graphics.drawscope.Stroke(w))
    clipPath(androidx.compose.ui.graphics.Path().apply { moveTo(0f, 0f); lineTo(size.width, 0f); lineTo(size.width - r, r); lineTo(r, r); close() }) {
        drawPath(edge, top, style = androidx.compose.ui.graphics.drawscope.Stroke(w))
    }
}

/**
 * .pwp-card: 14 / 16 in, corners 16, the glass line round it with its top edge 28 % gold into --line, surface 88 % with 3 % white
 * (91 % strong over the page) down to surface, the 0 14 30 -22 black shadow; its items a column 10 apart, where a .pwp-btn or a
 * .pwp-actions takes the spare height above it (margin-top: auto) so in a pair the buttons sit at the foot. The hero: 120° from gold
 * 14 % into surface by 58 %, its ring, words and drivers a wrapping row 22 apart, 16 between lines, centred ([FlexWrap]).
 */
@Composable
private fun PwpCard(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val inner = ctx.under(n)
    val hero = n.has("pwp-hero")
    val surface = Site.Surface; val gold = Site.Gold; val page = Site.Bg
    val side = PwpLine; val top = srgbMix(Site.Line, gold, .28f)
    val lift = srgbMix(page, srgbMix(surface, Color.White, 3f / 91f), .91f)
    val box = mark.fillMaxWidth().cssShadow(Color.Black, 30.dp, 14.dp, (-22).dp, 16.dp).clip(RoundedCornerShape(16.dp)).drawBehind {
        if (hero) {
            val a = Math.toRadians(120.0); val dx = kotlin.math.sin(a).toFloat(); val dy = (-kotlin.math.cos(a)).toFloat()
            val half = (kotlin.math.abs(size.width * dx) + kotlin.math.abs(size.height * dy)) / 2
            drawRect(Brush.linearGradient(0f to srgbMix(surface, gold, .14f), .58f to surface, 1f to surface,
                start = Offset(center.x - dx * half, center.y - dy * half), end = Offset(center.x + dx * half, center.y + dy * half)))
        } else drawRect(Brush.verticalGradient(listOf(lift, surface)))
        pwpBorder(side, top, 16.dp.toPx())
    }.padding(horizontal = 16.dp, vertical = 14.dp)
    if (!hero) { Column(box.fillMaxHeight()) { FlexItems(n.kids, ui, inner, gap = 10f) }; return }
    // .pwp-ring flex none (104), .pwp-id flex 1 1 220px, .pwp-drivers flex 1 1 300px.
    val parts = n.elements.filter { !it.hidden }.map { k -> k to when { k.has("pwp-ring") -> 104f to 0f; k.has("pwp-drivers") -> 300f to 1f; else -> 220f to 1f } }
    FlexWrap(parts.map { it.second.first.dp }, parts.map { it.second.second }, 22.dp, 16.dp, box) { parts.forEach { (k, _) -> Element(k, ui, inner) } }
}

/**
 * A flex column's items ([kids]): each element its own item (an inline one too: a flex item is made a block), each run of words one;
 * [gap] between, each item's margins kept (they don't collapse), and margin-top: auto (.pwp-btn, .pwp-actions) taking the spare height.
 */
@Composable
private fun androidx.compose.foundation.layout.ColumnScope.FlexItems(kids: List<Any>, ui: SiteUi, ctx: Ctx, gap: Float) {
    val items = ArrayList<Any>(); var run = ArrayList<Any>()
    fun flush() { if (run.any { !(it as String).isBlank() }) items.add(run); run = ArrayList() }
    for (k in kids) {
        if (k is SiteNode && (k.hidden || k.tag in setOf("script", "style", "template"))) continue
        if (k is String) run.add(k) else { flush(); items.add(k) }
    }
    flush()
    items.forEachIndexed { i, k ->
        if (i > 0 && gap > 0f) Spacer(Modifier.height(gap.dp))
        if (k is SiteNode) {
            val (t, b) = margins(k, ctx)
            if (k.has("pwp-btn") || k.has("pwp-actions")) Spacer(Modifier.weight(1f)) else if (t > 0f) Spacer(Modifier.height(t.dp))
            when {
                k.tag == "small" || k.tag == "b" || k.tag == "span" -> Paragraph(k.kids, ui, textCtx(k, ctx).under(k).let { if (k.tag == "b") it.weight(700) else it })
                isInline(k, false) -> Paragraph(listOf(k), ui, ctx)
                else -> Element(k, ui, ctx)
            }
            if (b > 0f) Spacer(Modifier.height(b.dp))
        } else (k as? List<*>)?.filterNotNull()?.let { Paragraph(it, ui, ctx) }
    }
}

/**
 * A wrapping flex row: each item [basis] wide, as many to a line as fit with [gap] between; a line's spare width goes to its items
 * by [grow] (0: never wider or narrower), a lone item wider than the line shrinks to it; each line as tall as its tallest item, the
 * items centred in it, [rowGap] between lines.
 */
@Composable
private fun FlexWrap(basis: List<Dp>, grow: List<Float>, gap: Dp, rowGap: Dp, modifier: Modifier, content: @Composable () -> Unit) =
    androidx.compose.ui.layout.Layout(content, modifier) { ms, c ->
        val room = c.maxWidth; val g = gap.roundToPx(); val rg = rowGap.roundToPx()
        val b = basis.map { it.roundToPx() }
        val lines = ArrayList<List<Int>>(); var line = ArrayList<Int>(); var used = 0
        for (i in ms.indices) {
            val need = if (line.isEmpty()) b[i] else used + g + b[i]
            if (line.isNotEmpty() && need > room) { lines += line; line = arrayListOf(i); used = b[i] } else { line += i; used = need }
        }
        if (line.isNotEmpty()) lines += line
        val ps = arrayOfNulls<androidx.compose.ui.layout.Placeable>(ms.size)
        for (l in lines) {
            val free = room - l.sumOf { b[it] } - g * (l.size - 1); val all = l.sumOf { grow[it].toDouble() }.toFloat()
            l.forEach { i ->
                val w = when { free >= 0 && all > 0f -> b[i] + (free * grow[i] / all).toInt(); free < 0 && grow[i] > 0f -> maxOf(0, b[i] + free); else -> b[i] }
                ps[i] = ms[i].measure(androidx.compose.ui.unit.Constraints(minWidth = w, maxWidth = w))
            }
        }
        val heights = lines.map { l -> l.maxOf { ps[it]!!.height } }
        layout(room, heights.sum() + rg * maxOf(0, lines.size - 1)) {
            var y = 0
            lines.forEachIndexed { li, l ->
                var x = 0
                l.forEach { i -> val p = ps[i]!!; p.place(x, y + (heights[li] - p.height) / 2); x += p.width + g }
                y += heights[li] + rg
            }
        }
    }

/** .pwp-ring: 104 square: the track (r 44, 8 wide, --line) and the score's arc in gold from the top, its ends round; the score in the middle. */
@Composable
private fun PwpRing(n: SiteNode, mark: Modifier) {
    val svg = n.find { it.tag == "svg" }
    val said = n.elements.firstOrNull { it.tag == "b" }?.text().orEmpty()
    val score = Regex("(\\d+) of 100").find(svg?.get("aria-label").orEmpty())?.groupValues?.get(1)?.toIntOrNull() ?: said.toIntOrNull() ?: 0
    val track = Site.Line; val gold = Site.Gold
    Box(mark.size(104.dp).semantics { contentDescription = svg?.get("aria-label").orEmpty() }.drawBehind {
        val k = size.width / 104f; val w = 8f * k; val r = 44f * k
        drawCircle(track, r, center, style = androidx.compose.ui.graphics.drawscope.Stroke(w))
        val sweep = 360f * score.coerceIn(0, 100) / 100f
        if (sweep > 0f) drawArc(gold, -90f, sweep, false, Offset(center.x - r, center.y - r), Size(2 * r, 2 * r),
            style = androidx.compose.ui.graphics.drawscope.Stroke(w, cap = androidx.compose.ui.graphics.StrokeCap.Round))
    }, contentAlignment = Alignment.Center) {
        Text(said.ifEmpty { "$score" }, style = pwpDisplay(33.6f, Site.Text))
    }
}

/** .pwp-pill: its line round it, surface-2, corners 999, 5 / 11 in, .76rem; its <b> gold. .add / .cut: good / bad, the line 45 % that colour. */
@Composable
private fun PwpPill(n: SiteNode) {
    val shape = RoundedCornerShape(999.dp)
    val tone = when { n.has("add") -> Good; n.has("cut") -> Bad; else -> null }
    val gold = Site.Gold
    Box(Modifier.clip(shape).background(Site.Surface2).border(1.dp, tone?.let { srgbMix(Site.Line, it, .45f) } ?: Site.Line, shape).padding(horizontal = 11.dp, vertical = 5.dp)) {
        Text(buildAnnotatedString {
            for (k in n.kids) when {
                k is String -> append(k.replace(Regex("\\s+"), " "))
                k is SiteNode && k.tag == "b" -> withStyle(SpanStyle(color = gold, fontWeight = FontWeight.Bold)) { append(k.text()) }
                k is SiteNode -> append(k.text())
            }
        }.let { it.subSequence(0, it.length) }, style = cssType(12.16f, 400, 17.63f, tone ?: Site.Text))
    }
}

/** A 6 or 4 tall track (corners 9, surface-2, what overflows hidden) filled to [pct] % with [fill] across the fill's own width; [round]: the fill's ends round too. */
@Composable
private fun PwpTrack(mark: Modifier, height: Dp, pct: Float, round: Boolean, fill: (Float) -> Brush) {
    val track = Site.Surface2
    androidx.compose.foundation.Canvas(mark.fillMaxWidth().height(height).clip(RoundedCornerShape(9.dp))) {
        drawRect(track)
        val w = size.width * pct.coerceIn(0f, 100f) / 100f
        if (w <= 0f) return@Canvas
        if (round) { val r = minOf(9.dp.toPx(), size.height / 2, w / 2); drawRoundRect(fill(w), size = Size(w, size.height), cornerRadius = androidx.compose.ui.geometry.CornerRadius(r)) }
        else drawRect(fill(w), size = Size(w, size.height))
    }
}

/**
 * .pwp-dr: its label (a column at most 150 wide; .pwp-rk two equal columns), its track filled to its share (gold 55 % black to gold;
 * .low bad) and its number (30, right, bold), 10 apart, centred, .76rem.
 */
@Composable
private fun PwpDr(n: SiteNode, mark: Modifier) {
    val i = n.elements.firstOrNull { it.tag == "i" }
    val pct = i?.elements?.firstOrNull()?.let { styleNum(it["style"], "width") } ?: 0f
    val low = i?.has("low") == true
    val deep = PwpGoldDeep; val gold = Site.Gold; val bad = Bad
    val st = cssType(12.16f, 400, 17.63f, Site.Text)
    BoxWithConstraints(mark.fillMaxWidth()) {
        val label = if (n.has("pwp-rk")) (maxWidth - 50.dp) / 2 else minOf(150.dp, maxWidth - 50.dp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(n.elements.firstOrNull { it.tag == "span" }?.text().orEmpty(), Modifier.width(label.coerceAtLeast(0.dp)), style = st)
            PwpTrack(Modifier.weight(1f), 6.dp, pct, round = true) { w -> if (low) androidx.compose.ui.graphics.SolidColor(bad) else Brush.horizontalGradient(listOf(deep, gold), 0f, w) }
            Text(n.elements.firstOrNull { it.tag == "b" }?.text().orEmpty(), Modifier.width(30.dp), style = st.copy(fontWeight = FontWeight.Bold), textAlign = TextAlign.End)
        }
    }
}

/**
 * .pwp-bars: the turns side by side, 6 apart, 104 tall, .62rem muted; each a column at the foot, 3 apart: its share, its bar (its
 * height, full width, corners 4 on top, gold down to 50 % gold over black) and its turn.
 */
@Composable
private fun PwpBars(n: SiteNode, mark: Modifier) {
    val gold = Site.Gold; val deep = srgbMix(gold, Color.Black, .5f)
    val st = cssType(9.92f, 400, 14.38f, Site.Muted)
    Row(mark.fillMaxWidth().height(104.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
        n.elements.filter { it.tag == "div" }.forEach { d ->
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(3.dp, Alignment.Bottom), horizontalAlignment = Alignment.CenterHorizontally) {
                for (k in d.kids) when {
                    k is String -> k.trim().takeIf { it.isNotEmpty() }?.let { Text(it, style = st, maxLines = 1, softWrap = false) }
                    k is SiteNode && k.tag == "span" -> Box(Modifier.fillMaxWidth().height((styleNum(k["style"], "height") ?: 0f).dp)
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)).background(Brush.verticalGradient(listOf(gold, deep))))
                }
            }
        }
    }
}

/**
 * .pwp-tiles: four across (two at 560 and under), 8 apart, each row as tall as its tallest: surface-2, corners 12, 9 / 10 in, a 3
 * left edge (good; .w warn), .68rem muted words under their <b> (a 1.15rem line in the text colour).
 */
@Composable
private fun PwpTiles(n: SiteNode, ui: SiteUi, mark: Modifier) {
    val tiles = n.elements.filter { !it.hidden }
    val cols = if (ui.screen <= 560.dp) 2 else 4
    Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(cols).forEach { line ->
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                line.forEach { t ->
                    val edge = if (t.has("w")) Warn else Good
                    Column(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(12.dp)).background(Site.Surface2)
                        .drawBehind { drawRect(edge, size = Size(3.dp.toPx(), size.height)) }.padding(start = 13.dp, end = 10.dp, top = 9.dp, bottom = 9.dp)) {
                        t.elements.firstOrNull { it.tag == "b" }?.let { Text(it.text(), style = cssType(18.4f, 700, 26.68f, Site.Text)) }
                        val words = t.kids.filter { !(it is SiteNode && it.tag == "b") }.joinToString("") { if (it is String) it else (it as SiteNode).text() }.replace(Regex("\\s+"), " ").trim()
                        if (words.isNotEmpty()) Text(words, style = cssType(10.88f, 400, 15.78f, Site.Muted))
                    }
                }
                repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** .pwp-split: the damage sources in one 12-tall bar, 2 apart, corners 9: each its width % in its shade, all shrunk alike where the gaps overflow it. */
@Composable
private fun PwpSplit(n: SiteNode, mark: Modifier) {
    val parts = n.elements.filter { it.tag == "i" }.map { (styleNum(it["style"], "width") ?: 0f) to (styleInk(it["style"]) ?: Site.Gold) }
    androidx.compose.foundation.Canvas(mark.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(9.dp))) {
        val g = 2.dp.toPx(); val base = parts.map { it.first / 100f * size.width }
        val sum = base.sum(); val over = sum + g * maxOf(0, parts.size - 1) - size.width
        var x = 0f
        parts.forEachIndexed { i, (_, c) ->
            val w = if (over > 0f && sum > 0f) base[i] - over * base[i] / sum else base[i]
            drawRect(c, Offset(x, 0f), Size(w.coerceAtLeast(0f), size.height)); x += w + g
        }
    }
}

/** .pwp-legend: wrapping, 6 / 14 apart, .76rem muted: each its dot (8, round, its shade, 5 before the words, sitting on the line), its share bold in the text colour, its name. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PwpLegend(n: SiteNode, mark: Modifier) {
    val text = Site.Text
    FlowRow(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        n.elements.filter { it.tag == "span" }.forEach { s ->
            val dot = s.elements.firstOrNull { it.has("pwp-dot") }
            val ink = styleInk(dot?.get("style")) ?: Site.Gold
            Row {
                Box(Modifier.alignBy { it.measuredHeight }.padding(end = 5.dp).size(8.dp).clip(CircleShape).background(ink))
                Text(buildAnnotatedString {
                    for (k in s.kids) when {
                        k is String -> append(k.replace(Regex("\\s+"), " "))
                        k is SiteNode && k.tag == "b" -> withStyle(SpanStyle(color = text, fontWeight = FontWeight.Bold)) { append(k.text()) }
                        k is SiteNode && k !== dot -> append(k.text())
                    }
                }.let { it.subSequence(0, it.length) }, Modifier.alignByBaseline(), style = cssType(12.16f, 400, 17.63f, Site.Muted))
            }
        }
    }
}

/**
 * .pwp-chain: a grid of two columns, 6 / 10 apart, each row on one baseline, .82rem: the payoff (gold, bold) in a column as wide as
 * its longest where that leaves the second its narrowest (grid auto beside 1fr), and what it wants (muted) in the rest.
 */
@Composable
private fun PwpChain(n: SiteNode, mark: Modifier) {
    val rows = n.elements.chunked(2)
    val head = cssType(13.12f, 700, 19.02f, Site.Gold); val body = cssType(13.12f, 400, 19.02f, Site.Muted)
    androidx.compose.ui.layout.Layout({ rows.forEach { r -> Text(r[0].text(), style = head); Text(r.getOrNull(1)?.text().orEmpty(), style = body) } }, mark.fillMaxWidth()) { ms, c ->
        val room = c.maxWidth; val g = 10.dp.roundToPx(); val rg = 6.dp.roundToPx()
        val heads = ms.filterIndexed { i, _ -> i % 2 == 0 }; val words = ms.filterIndexed { i, _ -> i % 2 == 1 }
        val inf = androidx.compose.ui.unit.Constraints.Infinity
        val longest = heads.maxOfOrNull { it.maxIntrinsicWidth(inf) } ?: 0; val least = heads.maxOfOrNull { it.minIntrinsicWidth(inf) } ?: 0
        val second = words.maxOfOrNull { it.minIntrinsicWidth(inf) } ?: 0
        val a = maxOf(least, minOf(longest, room - g - second)).coerceIn(0, room); val b = (room - g - a).coerceAtLeast(0)
        // When the names leave the sentence less than 45 % of the row it reads one word per line (fix list C3): stack them,
        // names first, then the sentence at full width. The site's grid has the same squeeze (noted for the web port).
        if (b < room * .45f) {
            val all = ms.map { it.measure(androidx.compose.ui.unit.Constraints(maxWidth = room)) }
            var top = 0; val at = all.mapIndexed { i, pl -> top.also { top += pl.height + if (i % 2 == 0) 2.dp.roundToPx() else rg } }
            return@Layout layout(room, (top - rg).coerceAtLeast(0)) { all.forEachIndexed { i, pl -> pl.place(0, at[i]) } }
        }
        val hp = heads.map { it.measure(androidx.compose.ui.unit.Constraints(maxWidth = a)) }; val wp = words.map { it.measure(androidx.compose.ui.unit.Constraints(maxWidth = b)) }
        val ys = IntArray(hp.size * 2); var y = 0
        hp.indices.forEach { i ->
            val ba = hp[i][androidx.compose.ui.layout.FirstBaseline]; val bb = wp[i][androidx.compose.ui.layout.FirstBaseline]; val line = maxOf(ba, bb)
            ys[2 * i] = y + line - ba; ys[2 * i + 1] = y + line - bb
            y = maxOf(ys[2 * i] + hp[i].height, ys[2 * i + 1] + wp[i].height) + rg
        }
        layout(room, if (hp.isEmpty()) 0 else y - rg) { hp.indices.forEach { i -> hp[i].place(0, ys[2 * i]); wp[i].place(a + g, ys[2 * i + 1]) } }
    }
}

/** .pwp-f: the archetype and its share (38 wide, right, bold), 8 apart, .82rem; under both (4 down) a 4-tall track filled to its width % in gold 55 % black. */
@Composable
private fun PwpField(n: SiteNode, mark: Modifier) {
    val st = cssType(13.12f, 400, 19.02f, Site.Text); val deep = PwpGoldDeep
    val pct = n.elements.firstOrNull { it.tag == "i" }?.elements?.firstOrNull()?.let { styleNum(it["style"], "width") } ?: 0f
    Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(n.elements.firstOrNull { it.tag == "span" }?.text().orEmpty(), Modifier.weight(1f), style = st)
            Text(n.elements.firstOrNull { it.tag == "b" }?.text().orEmpty(), Modifier.width(38.dp), style = st.copy(fontWeight = FontWeight.Bold), textAlign = TextAlign.End)
        }
        PwpTrack(Modifier, 4.dp, pct, round = false) { androidx.compose.ui.graphics.SolidColor(deep) }
    }
}

/** .pwp-pc: Strong against beside Weak against, 14 apart (one over the other at 560 and under). */
@Composable
private fun PwpPc(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val sides = n.elements.filter { !it.hidden }
    if (ui.screen <= 560.dp) Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) { sides.forEach { Element(it, ui, ctx) } }
    else Row(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) { sides.forEach { Box(Modifier.weight(1f)) { Element(it, ui, ctx) } } }
}

/** .pwp-m: the deck (bold) over its first reason (a block, 2 down, .76rem muted) beside its win share (700 1rem, centred; .up good, .down bad); 8 / 0 in, a line above, 8 apart, .82rem. */
@Composable
private fun PwpMatch(n: SiteNode, mark: Modifier) {
    val line = Site.Line
    Row(mark.fillMaxWidth().drawBehind { drawLine(line, Offset(0f, .5.dp.toPx()), Offset(size.width, .5.dp.toPx()), 1.dp.toPx()) }.padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        val words = n.elements.firstOrNull { it.tag == "span" }
        Column(Modifier.weight(1f)) {
            words?.elements?.firstOrNull { it.tag == "b" }?.let { Text(it.text(), style = cssType(13.12f, 700, 19.02f, Site.Text)) }
            words?.elements?.firstOrNull { it.tag == "small" }?.let { Text(it.text(), Modifier.padding(top = 2.dp), style = cssType(12.16f, 400, 17.63f, Site.Muted)) }
        }
        n.elements.firstOrNull { it.tag == "em" }?.let { Text(it.text(), Modifier.align(Alignment.CenterVertically), style = pwpDisplay(16f, if (it.has("up")) Good else if (it.has("down")) Bad else Site.Text)) }
    }
}

/**
 * .pwp-sw: a 1fr / auto / 1fr grid, 4 / 10 apart, centred, on surface-2 (corners 12, 9 / 12 in), .82rem: the cut (bad) → (gold) the
 * add (good, at the end); its note and its button (its own width) across the row under them. An add that sets grid-column 1 / -1
 * (Yu-Gi-Oh! and Pokémon's) takes the row, its words at the start.
 */
@Composable
private fun PwpSwap(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val st = cssType(13.12f, 400, 19.02f, Site.Text)
    val inner = ctx.under(n)
    Column(mark.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Site.Surface2).padding(horizontal = 12.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val out = n.elements.firstOrNull { it.has("o") }; val into = n.elements.firstOrNull { it.has("n") }
        val across = into?.get("style").orEmpty().contains("grid-column")
        if (out != null || (into != null && !across)) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(out?.text().orEmpty(), Modifier.weight(1f), style = st.copy(color = Bad))
            Text(n.elements.firstOrNull { it.tag == "i" }?.text() ?: "→", style = st.copy(color = Site.Gold))
            Text(into?.text().orEmpty(), Modifier.weight(1f), style = st.copy(color = Good), textAlign = TextAlign.End)
        } else if (into != null) Text(into.text(), Modifier.fillMaxWidth(), style = st.copy(color = Good))
        n.elements.filter { it.tag == "small" || it.tag == "button" }.forEach { k ->
            if (k.tag == "small") Paragraph(k.kids, ui, textCtx(k, inner).under(k)) else SiteButton(k, ui, inner)
        }
    }
}

// ---------------------------------------------------------------- the Full breakdown (the old Power page's panels: style.css .pw-*, .score-panel, .curve, .meter, .metrics)

/** :root --game-color (style.css shell polish 3.15). */
private val GameColor = Color(0xFFF08A5D)
/** --W, --U, --B, --R, --G, --C: the mana colours .bar.c-* fill with. */
private val ManaInk = mapOf("W" to Color(0xFFF3ECD2), "U" to Color(0xFF7FB6EA), "B" to Color(0xFFB7A6C9), "R" to Color(0xFFF08A6C), "G" to Color(0xFF79C98F), "C" to Color(0xFFC9CCD3))

/** radial-gradient(ellipse at 0 0, [c], transparent 70%): the farthest-corner ellipse, √2 the box each way. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.cornerGlow(c: Color) {
    val w = size.width; val h = size.height
    if (w <= 0f || h <= 0f) return
    val sx = w / h
    withTransform({ scale(sx, 1f, Offset.Zero) }) {
        drawRect(Brush.radialGradient(0f to c, .7f to c.copy(alpha = 0f), center = Offset.Zero, radius = h * 1.4142f), size = Size(w / sx, h))
    }
}

/** A check's colour: .pw-sim.ok / .pw-out good, .near / .fragile warn, .bad bad. */
private fun simInk(n: SiteNode): Color = when { n.has("bad") -> Bad; n.has("near") || n.has("fragile") -> Warn; else -> Good }

/** span.chip (not a button): a pill on surface-2 with its line, 3 / 9 in, 12 700; .warn in warn, .ok in good. */
@Composable
private fun SiteChip(n: SiteNode) {
    val shape = RoundedCornerShape(999.dp)
    Box(Modifier.clip(shape).background(Site.Surface2).border(1.dp, Site.Line, shape).padding(horizontal = 9.dp, vertical = 3.dp)) {
        Text(n.text(), style = cssType(12f, 700, 17.4f, when { n.has("warn") -> Warn; n.has("ok") -> Good; else -> Site.Text }), maxLines = 1)
    }
}

/** .power-chip: its number in a 6-cornered tint (800 13, 0 / 6 in; p-hi green, p-mid gold, p-lo red), then its words, 3 apart on one baseline. */
@Composable
private fun PowerChip(n: SiteNode, mark: Modifier) {
    val (bg, ink) = when { n.has("p-hi") -> Color(0x406FD29A) to Color(0xFFA6F0C4); n.has("p-lo") -> Color(0x40F08A7E) to Color(0xFFFFB3A8); else -> Color(0x40E8B95B) to Color(0xFFFFD98A) }
    Row(mark, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        n.elements.firstOrNull { it.tag == "em" }?.let { em ->
            Box(Modifier.alignByBaseline().clip(RoundedCornerShape(6.dp)).background(bg).padding(horizontal = 6.dp)) { Text(em.text(), style = cssType(13f, 800, 18.85f, ink)) } }
        val rest = n.kids.filter { !(it is SiteNode && it.tag == "em") }.joinToString("") { if (it is String) it else (it as SiteNode).text() }.replace(Regex("\\s+"), " ").trim()
        if (rest.isNotEmpty()) Text(rest, Modifier.alignByBaseline(), style = cssType(15f, 400, 21.75f, Site.Text))
    }
}

/**
 * .score-panel.power: a panel whose items wrap 14 apart, centred: the Power chip beside its words (at least 180 wide, growing),
 * then each full-width piece (.pw-dual, .pw-profile and the rest) on its own line, its top margin added (a flex item's don't collapse).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ScorePanel(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val shape = RoundedCornerShape(14.dp)
    val inner = ctx.under(n)
    val items = n.elements.filter { !it.hidden }
    val chip = items.firstOrNull { it.has("power-chip") }
    val words = items.firstOrNull { it.tag == "div" && !it.has("pw-dual") && !it.has("pw-profile") && !it.has("pw-plan-context") && !it.has("pw-chips") }
    Column(mark.fillMaxWidth().clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape).padding(14.dp)) {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp),
            itemVerticalAlignment = Alignment.CenterVertically) {
            chip?.let { PowerChip(it, Modifier) }
            words?.let { Column(Modifier.weight(1f).widthIn(min = 180.dp)) { Blocks(it.kids, ui, inner.under(it), padded = false) } }
        }
        items.filter { it !== chip && it !== words }.forEach { k ->
            Spacer(Modifier.height((14f + margins(k, inner).first).dp))
            Element(k, ui, inner)
        }
    }
}

/** .pw-dual: two tiles side by side, 8 apart, the same height: 10 / 12 in, corners 12, the text at 5 %, a 3 left edge (line; ok good, warn warn); the number (1.5rem, .dim muted) over its label (.78rem muted) and its note (.72rem). */
@Composable
private fun PwDual(n: SiteNode, mark: Modifier) {
    Row(mark.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        n.elements.filter { it.tag == "span" && !it.hidden }.forEach { t ->
            val edge = when { t.has("ok") -> Good; t.has("warn") -> Warn; else -> Site.Line }
            Column(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(12.dp)).background(Site.Text.copy(alpha = .05f))
                .drawBehind { drawRect(edge, size = Size(3.dp.toPx(), size.height)) }.padding(start = 15.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(1.dp)) {
                t.elements.firstOrNull { it.tag == "b" }?.let { Text(it.text(), style = cssType(24f, 700, 26.4f, if (t.has("dim")) Site.Muted else Site.Text)) }
                t.kids.filterIsInstance<String>().joinToString("").trim().takeIf { it.isNotEmpty() }?.let { Text(it, style = cssType(12.48f, 400, 18.1f, Site.Muted)) }
                t.elements.firstOrNull { it.tag == "small" }?.let { Text(it.text(), style = cssType(11.52f, 400, 16.7f, Site.Muted)) }
            }
        }
    }
}

/** .pw-profile: tiles at least 56 wide, growing to share the row, 6 apart: 8 / 10 in, corners 10, the text at 5 %; the number (1.05rem) over its label (.78rem muted), 2 apart. */
@Composable
private fun PwProfile(n: SiteNode, ui: SiteUi, mark: Modifier) {
    val tiles = n.elements.filter { it.tag == "span" && !it.hidden }
    val measure = androidx.compose.ui.text.rememberTextMeasurer()
    val density = androidx.compose.ui.platform.LocalDensity.current
    val num = cssType(16.8f, 700, 24.4f, Site.Text); val label = cssType(12.48f, 400, 18.1f, Site.Muted)
    // Each tile's flex basis: 56, or its narrowest (its longest word, 10 in each side) where that is wider.
    val basis = tiles.map { t ->
        val words = t.elements.filter { it.tag == "b" }.flatMap { it.text().split(' ') }.map { it to num } +
            t.kids.filterIsInstance<String>().joinToString(" ").split(Regex("\\s+")).filter { it.isNotEmpty() }.map { it to label }
        maxOf(56f, 20f + with(density) { (words.maxOfOrNull { (w, st) -> measure.measure(w, st, maxLines = 1).size.width } ?: 0).toDp().value })
    }
    BoxWithConstraints(mark.fillMaxWidth()) {
        // Flex wrap: a line holds tiles while their bases fit, then they grow to share it.
        val lines = ArrayList<List<Pair<SiteNode, Float>>>(); var line = ArrayList<Pair<SiteNode, Float>>(); var used = 0f
        val room = maxWidth.value
        tiles.forEachIndexed { i, t ->
            val w = basis[i]
            if (line.isNotEmpty() && used + 6f + w > room) { lines.add(line); line = ArrayList(); used = 0f }
            used += (if (line.isEmpty()) 0f else 6f) + w; line.add(t to w)
        }
        if (line.isNotEmpty()) lines.add(line)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            lines.forEach { l ->
                // flex-grow 1: the line's free room shared equally on top of each basis.
                val free = maxOf(0f, room - l.sumOf { it.second.toDouble() }.toFloat() - 6f * (l.size - 1)) / l.size
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    l.forEach { (t, w) ->
                        Column(Modifier.width((w + free).dp).fillMaxHeight().clip(RoundedCornerShape(10.dp)).background(Site.Text.copy(alpha = .05f)).padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            t.elements.firstOrNull { it.tag == "b" }?.let { Text(it.text(), style = cssType(16.8f, 700, 24.4f, Site.Text)) }
                            t.kids.filterIsInstance<String>().joinToString("").trim().takeIf { it.isNotEmpty() }?.let { Text(it, style = cssType(12.48f, 400, 18.1f, Site.Muted)) }
                        }
                    }
                }
            }
        }
    }
}

/** .pw-chip: a pill, good at 14 %, 6 / 10 in, .8rem; its <b> good, 650. */
@Composable
private fun PwChip(n: SiteNode) {
    Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Good.copy(alpha = .14f)).padding(horizontal = 10.dp, vertical = 6.dp)) {
        Text(buildAnnotatedString {
            for (k in n.kids) when {
                k is String -> append(k.replace(Regex("\\s+"), " "))
                k is SiteNode && k.tag == "b" -> withStyle(SpanStyle(color = Good, fontWeight = FontWeight(650))) { append(k.text()) }
                k is SiteNode -> append(k.text())
            }
        }, style = cssType(12.8f, 400, 18.6f, Site.Text))
    }
}

/** .pw-track: 6 tall, round, the text at 9 %; its fill (the check's colour) to its width, and the goal: 2 wide, 4 past each edge, the text colour at 70 %. */
@Composable
private fun PwTrack(n: SiteNode, ctx: Ctx, mark: Modifier) {
    fun pct(k: SiteNode?, prop: String) = Regex("$prop:\\s*([\\d.]+)%").find(k?.get("style").orEmpty())?.groupValues?.get(1)?.toFloatOrNull()
    val fill = pct(n.elements.firstOrNull { it.has("pw-fill") }, "width") ?: 0f
    val goal = pct(n.elements.firstOrNull { it.has("pw-goal") }, "left")
    val ink = ctx.parent?.let { simInk(it) } ?: Good
    val track = Site.Text.copy(alpha = .09f); val text = Site.Text
    Box(mark.fillMaxWidth().height(6.dp).drawBehind {
        val r = androidx.compose.ui.geometry.CornerRadius(size.height / 2)
        drawRoundRect(track, cornerRadius = r)
        if (fill > 0f) drawRoundRect(ink, size = Size(size.width * fill.coerceIn(0f, 100f) / 100f, size.height), cornerRadius = r)
        goal?.let { g ->
            val x = size.width * g / 100f
            drawRoundRect(text.copy(alpha = .7f), Offset(x - 1.dp.toPx(), -4.dp.toPx()), Size(2.dp.toPx(), size.height + 8.dp.toPx()), androidx.compose.ui.geometry.CornerRadius(2.dp.toPx()))
        }
    })
}

/** .bar: 7 tall, round, surface-2; its fill to its width (gold; .good, .warn, .c-W … .c-C; .faint at 45 %). */
@Composable
private fun SiteBar(n: SiteNode, mark: Modifier) {
    val w = Regex("width:\\s*([\\d.]+)%").find(n.elements.firstOrNull()?.get("style").orEmpty())?.groupValues?.get(1)?.toFloatOrNull() ?: 0f
    val ink = when { n.has("good") -> Good; n.has("warn") -> Warn; else -> n.classes.firstNotNullOfOrNull { c -> c.takeIf { it.startsWith("c-") }?.let { ManaInk[it.drop(2)] } } ?: Site.Gold }
        .let { if (n.has("faint")) it.copy(alpha = it.alpha * .45f) else it }
    val track = Site.Surface2
    Box(mark.fillMaxWidth().height(7.dp).drawBehind {
        val r = androidx.compose.ui.geometry.CornerRadius(size.height / 2)
        drawRoundRect(track, cornerRadius = r)
        if (w > 0f) clipPath(androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(androidx.compose.ui.geometry.Rect(Offset.Zero, size), r)) }) {
            drawRoundRect(ink, size = Size(size.width * w.coerceIn(0f, 100f) / 100f, size.height), cornerRadius = r)
        }
    })
}

/**
 * .curve: eight columns, 6 apart, 140 tall: each its bars (at most 30 wide, at least 2 tall, corners 5 on top and 2 under, gold;
 * .old grey), the count 17 over each (11 muted), and its cost under them (11.5 muted), 4 apart.
 */
@Composable
private fun CurveChart(n: SiteNode, mark: Modifier, cost: Float = 11.5f) {
    val cols = n.elements.filter { it.has("curve-col") }
    val gold = Site.Gold
    Row(mark.fillMaxWidth().height(140.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
        cols.forEach { col ->
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                val bars = col.elements.firstOrNull { it.has("curve-bars") }?.elements?.filter { it.has("cb") }.orEmpty()
                Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom) {
                    bars.forEach { cb ->
                        val h = Regex("height:\\s*([\\d.]+)%").find(cb["style"].orEmpty())?.groupValues?.get(1)?.toFloatOrNull() ?: 0f
                        val ink = if (cb.has("old")) Color(0xFF5B6170) else gold
                        BoxWithConstraints(Modifier.weight(1f, fill = false).widthIn(max = 30.dp).fillMaxWidth().fillMaxHeight(), contentAlignment = Alignment.BottomCenter) {
                            val bar = maxOf(2.dp, maxHeight * (h / 100f))
                            Box(Modifier.fillMaxWidth().height(bar).drawBehind {
                                val top = 5.dp.toPx(); val bottom = 2.dp.toPx()
                                drawPath(androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(androidx.compose.ui.geometry.Rect(Offset.Zero, size),
                                    androidx.compose.ui.geometry.CornerRadius(top), androidx.compose.ui.geometry.CornerRadius(top), androidx.compose.ui.geometry.CornerRadius(bottom), androidx.compose.ui.geometry.CornerRadius(bottom))) }, ink)
                            })
                            cb.elements.firstOrNull { it.tag == "em" }?.text()?.takeIf { it.isNotEmpty() }?.let { t ->
                                Text(t, Modifier.fillMaxWidth().padding(bottom = bar + 17.dp - 16.dp), style = cssType(if (n.has("dual")) 9.5f else 11f, 400, 16f, Site.Muted), textAlign = TextAlign.Center, maxLines = 1)
                            }
                        }
                    }
                }
                // .curve-col small 11.5; in a Power card .pwp-card small (.76rem, the later sheet) wins.
                col.elements.firstOrNull { it.tag == "small" }?.let { Text(it.text(), style = cssType(cost, 400, cost * 1.45f, Site.Muted), maxLines = 1) }
            }
        }
    }
}

/** .meter.two: the mana symbol (20, in a 30 column) beside its two bars (3 apart), its words under the bars (muted, 500, 6 under), 13.5. */
@Composable
private fun MeterTwo(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val sym = n.find { it.tag == "img" }?.get("src")?.let { Regex("card-symbols/([^/.]+)\\.svg").find(it)?.groupValues?.get(1) }
    val pair = n.elements.firstOrNull { it.has("pair") }
    val words = n.elements.firstOrNull { it.tag == "b" }
    Column(mark.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(30.dp)) { if (sym != null) Symbol(sym, 20.dp) }
            Column(Modifier.weight(1f)) { pair?.elements?.filter { it.has("bar") }?.forEach { SiteBar(it, Modifier.padding(vertical = 3.dp)) } }
        }
        words?.let { Text(it.text(), Modifier.padding(start = 40.dp, top = 6.dp), style = cssType(13f, 500, 18.85f, Site.Muted)) }
    }
}

/**
 * .mini-row: its words (.ellip: one line, cut with … as the site cuts it) and its figure or its links apart, 10 between; 9 / 2 in,
 * a line under all but the last; 14. A button row opens as a whole; a div row's .row of links (Restore, ✕) each tap on their own, 8 apart.
 */
@Composable
private fun MiniRow(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val last = ctx.parent?.elements?.lastOrNull { !it.hidden } === n
    val line = Site.Line
    val inner = ctx.under(n).size(14f)
    val whole = n.tag == "button"
    // .wiki-suggestions .mini-row: the topic and its source at either end, 48 tall.
    val ends = ctx.inside("home-suggestions")
    Row(mark.fillMaxWidth().then(if (ends) Modifier.heightIn(min = 48.dp) else Modifier).then(if (whole) Modifier.clickable { ui.tap(n.id) }.semantics { role = Role.Button } else Modifier).drawBehind {
        if (!last) drawLine(line, Offset(0f, size.height - .5.dp.toPx()), Offset(size.width, size.height - .5.dp.toPx()), 1.dp.toPx()) }.padding(horizontal = 2.dp, vertical = 9.dp),
        horizontalArrangement = if (ends) Arrangement.SpaceBetween else Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        n.elements.filter { !it.hidden }.forEach { k ->
            when {
                k.has("ellip") -> Paragraph(k.kids, ui, textCtx(k, inner).under(k), Modifier.weight(1f), oneLine = true)
                k.has("row") -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    k.elements.filter { !it.hidden }.forEach { b -> SiteButton(b, ui, inner.under(k)) } }
                // .mini-row > span:last-child: its own width, never shrinking.
                else -> Paragraph(listOf(k), ui, if (k.tag == "span" && k.has("link")) inner.color(Site.Gold).weight(600) else inner, fill = false, oneLine = true)
            }
        }
    }
}

/** .note-row: a game's result chip, its date and note (one line, cut with …, 13) and its ✕, 8 apart; 8 / 0 in, a line above. */
@Composable
private fun NoteRow(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val line = Site.Line
    val inner = ctx.under(n)
    Row(mark.fillMaxWidth().drawBehind { drawLine(line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }.padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        n.elements.filter { !it.hidden }.forEach { k ->
            when {
                k.has("chip") && k.tag == "span" -> SiteChip(k)
                k.has("ellip") -> Paragraph(k.kids, ui, textCtx(k, inner).under(k), Modifier.weight(1f), oneLine = true)
                else -> Element(k, ui, inner)
            }
        }
    }
}

/** A line with the curve's legend in it: each .key a 10 square (corners 3; gold, .old #5b6170), 8 before it (not .old) and 2 after, on the words' middle. */
@Composable
private fun KeyLegend(n: SiteNode, ctx: Ctx, mark: Modifier) {
    val gold = Site.Gold
    Row(mark.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        var lead = true
        n.kids.forEach { k ->
            if (k is SiteNode && k.has("key")) {
                Box(Modifier.padding(start = if (k.has("old")) 0.dp else 8.dp, end = 2.dp).size(10.dp).clip(RoundedCornerShape(3.dp)).background(if (k.has("old")) Color(0xFF5B6170) else gold))
                lead = false
            } else {
                val t = (if (k is SiteNode) k.text() else k as String).replace(Regex("\\s+"), " ").let { if (lead) it.trimStart() else it }
                if (t.isNotEmpty()) Text(t, style = ctx.style)
            }
        }
    }
}

/** .log-form: a grid of 1fr and 74, 8 apart: the result and the turn, then the note and Save each across the whole row. */
@Composable
private fun LogForm(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val items = n.elements.filter { !it.hidden }
    val wide = { k: SiteNode -> (k.tag == "input" && k["id"] == "logNote") || k.has("btn") }
    Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        var i = 0
        while (i < items.size) {
            val k = items[i]
            if (wide(k)) { if (k.tag == "button") SiteButton(k, ui, ctx, Modifier.fillMaxWidth()) else Element(k, ui, ctx); i++; continue }
            val next = items.getOrNull(i + 1)?.takeIf { !wide(it) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { Element(k, ui, ctx) }
                Box(Modifier.width(74.dp)) { next?.let { Element(it, ui, ctx) } }
            }
            i += if (next != null) 2 else 1
        }
    }
}

/** .life-grid: two columns, 8 apart (three for 3 and 6 players from 900); with 3 or 5 players the first takes the whole row. */
@Composable
private fun LifeGrid(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val cards = n.elements.filter { !it.hidden }
    val three = ui.screen >= 900.dp && (n.has("n3") || n.has("n6"))
    val cols = if (three) 3 else 2
    val lead = !three && (n.has("n3") || n.has("n5"))
    val lines = (if (lead) listOf(cards.take(1)) else emptyList()) + cards.drop(if (lead) 1 else 0).chunked(cols)
    Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        lines.forEachIndexed { i, line ->
            if (lead && i == 0) Element(line[0], ui, ctx)
            else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                line.forEach { Box(Modifier.weight(1f)) { Element(it, ui, ctx) } }
                repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * .life-card: surface-2, corners 14, its line (gold at 55 % for .me), 10 / 6 in, centred (.out at 50 %, its Out chip 8 from the top
 * right): the player's name (an input with no box, 700 muted, 44 tall), the life (800 40 Manrope over its four steps, 3 apart),
 * then ⚔ and ☠ with their steps (13 muted, spaced around).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LifeCard(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val shape = RoundedCornerShape(14.dp)
    val name = n.elements.firstOrNull { it.has("life-name") }
    val main = n.elements.firstOrNull { it.has("life-main") }
    val sub = n.elements.firstOrNull { it.has("life-sub") }
    val out = n.elements.firstOrNull { it.has("life-out") }
    Box(mark.fillMaxWidth().alpha(if (n.has("out")) .5f else 1f).clip(shape).background(Site.Surface2).border(1.dp, if (n.has("me")) Color(0x8CE8B95B) else Site.Line, shape)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            name?.let { LifeName(it, ui) }
            main?.let { m ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    m.elements.firstOrNull { it.has("life-total") }?.let {
                        Text(it.text(), Modifier.padding(top = 2.dp, bottom = 6.dp), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight(800), fontSize = 40.sp,
                            lineHeight = 40.sp, color = Site.Text, fontFeatureSettings = "tnum", textAlign = TextAlign.Center))
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        m.elements.filter { it.tag == "button" }.forEach { LifeStep(it, ui, 32.dp, 36.dp, 15f) }
                    }
                }
            }
            sub?.let { su ->
                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    su.elements.filter { it.tag == "span" }.forEach { sp ->
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                            sp.kids.forEach { k ->
                                when {
                                    k is String -> k.trim().takeIf { it.isNotEmpty() }?.let { Text(it + "\uFE0E", style = cssType(13f, 400, 18.85f, Site.Muted)) }
                                    k is SiteNode && k.tag == "button" -> LifeStep(k, ui, 28.dp, 28.dp, 13f)
                                    k is SiteNode && k.tag == "b" -> Text(k.text(), Modifier.widthIn(min = 16.dp), style = cssType(13f, 700, 18.85f, if (k.has("warn-text")) Warn else Site.Text)
                                        .copy(fontFeatureSettings = "tnum"), textAlign = TextAlign.Center)
                                }
                            }
                        }
                    }
                }
            }
        }
        out?.let { Box(Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp)) { SiteChip(it) } }
    }
}

/** .life-card button: at least [w] wide, [h] tall, corners 10, its line, on surface, 700 (gold under the finger). */
@Composable
private fun LifeStep(n: SiteNode, ui: SiteUi, w: Dp, h: Dp, size: Float) {
    val shape = RoundedCornerShape(10.dp)
    val press = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val down by press.collectIsPressedAsState()
    Box(Modifier.widthIn(min = w).height(h).clip(shape).background(if (down) Site.Gold else Site.Surface).border(1.dp, Site.Line, shape)
        .clickable(press, PadFocus.Ring) { ui.tap(n.id) }.semantics { role = Role.Button; contentDescription = n["aria-label"].orEmpty() }.padding(horizontal = 4.dp),
        contentAlignment = Alignment.Center) {
        Text(n.text(), style = cssType(size, 700, size * 1.15f, if (down) Site.GoldInk else Site.Text), maxLines = 1)
    }
}

/** input.life-name: the player's name, centred, 700, muted, no box (surface while typing in it), 2 in, 44 tall; each letter to C.lifeName. */
@Composable
private fun LifeName(n: SiteNode, ui: SiteUi) {
    var text by remember(n.id) { mutableStateOf(n.value ?: n["value"].orEmpty()) }
    var focused by remember { mutableStateOf(false) }
    androidx.compose.foundation.text.BasicTextField(text, { v -> val t = v.take(24); text = t; ui.type(n.id, t) },
        Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused }.semantics { contentDescription = n["aria-label"].orEmpty() },
        singleLine = true, textStyle = cssType(15f, 700, 21.75f, if (focused) Site.Text else Site.Muted).copy(textAlign = TextAlign.Center),
        cursorBrush = androidx.compose.ui.graphics.SolidColor(Site.Gold),
        decorationBox = { inner -> Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(6.dp)).background(if (focused) Site.Surface else Color.Transparent)
            .padding(2.dp), contentAlignment = Alignment.Center) { inner() } })
}

/**
 * table.metrics: 13.5; its head (11, .08em, upper case, muted, 700, 6 / 4 in) over rows 8 / 4 in with a line above; .num right,
 * as wide as its widest figure; the card cell its name (a link, 600) over its role chips (.68rem pills, 2 / 7 in, 4 apart, 4 under).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MetricsTable(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val head = n.find { it.tag == "thead" }?.find { it.tag == "tr" }?.elements?.filter { it.tag == "th" }.orEmpty()
    val rows = n.find { it.tag == "tbody" }?.elements?.filter { it.tag == "tr" && !it.hidden }.orEmpty()
    val th = cssType(11f, 700, 15.95f, Site.Muted, track = .88f)
    val td = cssType(13.5f, 400, 19.6f, Site.Text)
    // A figure cell's look: .up good 700, .down bad 700, .muted muted, its <b> bold.
    fun cell(c: SiteNode): TextStyle = when {
        c.has("up") -> td.copy(color = Good, fontWeight = FontWeight.Bold)
        c.has("down") -> td.copy(color = Bad, fontWeight = FontWeight.Bold)
        c.has("muted") -> td.copy(color = Site.Muted)
        c.elements.any { it.tag == "b" || it.tag == "strong" } -> td.copy(fontWeight = FontWeight.Bold)
        else -> td
    }
    val measure = androidx.compose.ui.text.rememberTextMeasurer()
    val density = androidx.compose.ui.platform.LocalDensity.current
    val cols = maxOf(head.size, rows.maxOfOrNull { r -> r.elements.count { it.tag == "td" } } ?: 0)
    // An auto table: each figure column as wide as its widest cell, the first takes the rest.
    val widths = (1 until cols).map { i ->
        val texts = listOf(head.getOrNull(i)?.text()?.uppercase() to th) + rows.map { r -> r.elements.filter { it.tag == "td" }.getOrNull(i).let { c -> c?.text() to (c?.let { cell(it) } ?: td) } }
        with(density) { (texts.maxOf { (t, st) -> if (t == null) 0 else measure.measure(t, st, maxLines = 1).size.width }.toDp() + 8.dp) }
    }
    val line = Site.Line
    Column(mark.fillMaxWidth()) {
        if (head.isNotEmpty()) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            head.forEachIndexed { i, h ->
                val m = if (i == 0) Modifier.weight(1f) else Modifier.width(widths[i - 1])
                Text(h.text().uppercase(), m.padding(horizontal = 4.dp, vertical = 6.dp), style = th, textAlign = if (h.has("num")) TextAlign.End else TextAlign.Start, maxLines = 1)
            }
        }
        rows.forEach { r ->
            Row(Modifier.fillMaxWidth().drawBehind { drawLine(line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }, verticalAlignment = Alignment.CenterVertically) {
                r.elements.filter { it.tag == "td" }.forEachIndexed { i, c ->
                    val m = (if (i == 0) Modifier.weight(1f) else Modifier.width(widths.getOrElse(i - 1) { 48.dp })).padding(horizontal = 4.dp, vertical = 8.dp)
                    if (c.has("num")) Text(c.text(), m, style = cell(c), textAlign = TextAlign.End, maxLines = 1, softWrap = false)
                    else Column(m) {
                        c.elements.filter { it.tag == "button" || it.tag == "a" }.forEach { b ->
                            Text(b.text(), Modifier.clickable { ui.tap(b.id) }.semantics { role = Role.Button }, style = cssType(13.5f, 600, 19.6f, Site.Gold)) }
                        c.elements.firstOrNull { it.has("role-chips") }?.elements?.takeIf { it.isNotEmpty() }?.let { chips ->
                            FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                chips.forEach { rc ->
                                    Box(Modifier.clip(RoundedCornerShape(99.dp)).then(accent?.let { Modifier.background(it.copy(alpha = .16f)) } ?: Modifier).padding(horizontal = 7.dp, vertical = 2.dp)) {
                                        Text(rc.text(), style = cssType(10.88f, 400, 15.8f, Site.Text), maxLines = 1) }
                                }
                            }
                        }
                        c.kids.filterIsInstance<String>().joinToString("").trim().takeIf { it.isNotEmpty() }?.let { Text(it, style = td) }
                    }
                }
            }
        }
    }
}

/** details.panel > summary: a row, centred, 8 apart: its words and its chip (Rules checks · 1 to fix). */
@Composable
private fun PanelSummary(s: SiteNode, ui: SiteUi, ctx: Ctx) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        val run = ArrayList<Any>()
        @Composable fun flush() { if (run.any { !(it is String && it.isBlank()) }) Paragraph(run.toList(), ui, ctx, fill = false); run.clear() }
        for (k in s.kids) { if (k is SiteNode && k.has("chip")) { flush(); SiteChip(k) } else run.add(k) }
        flush()
    }
}

/**
 * A row's items spaced apart (.row.between: justify-content space-between, align-items center, [gap] apart): each its content's
 * width; where they don't fit, each shrinks in proportion to that width (flex-shrink 1), never under its narrowest (min-content).
 */
@Composable
private fun FlexBetween(modifier: Modifier, gap: Dp, content: @Composable () -> Unit) = androidx.compose.ui.layout.Layout(content, modifier) { ms, c ->
    val g = gap.roundToPx()
    val room = if (c.hasBoundedWidth) c.maxWidth else ms.sumOf { it.maxIntrinsicWidth(androidx.compose.ui.unit.Constraints.Infinity) } + g * maxOf(0, ms.size - 1)
    val natural = ms.map { it.maxIntrinsicWidth(androidx.compose.ui.unit.Constraints.Infinity) }
    val total = natural.sum() + g * maxOf(0, ms.size - 1)
    val widths = if (total <= room) natural else {
        val over = (total - room).toFloat(); val sum = natural.sum().coerceAtLeast(1).toFloat()
        natural.mapIndexed { i, w -> maxOf(ms[i].minIntrinsicWidth(androidx.compose.ui.unit.Constraints.Infinity), (w - over * w / sum).toInt()) }
    }
    val ps = ms.mapIndexed { i, m -> m.measure(androidx.compose.ui.unit.Constraints(maxWidth = widths[i].coerceIn(0, room), maxHeight = c.maxHeight)) }
    val h = ps.maxOfOrNull { it.height } ?: 0
    layout(room, h) {
        val used = ps.sumOf { it.width }
        val spare = (room - used).coerceAtLeast(0)
        val step = if (ps.size > 1) maxOf(g, spare / (ps.size - 1)) else 0
        var x = 0
        ps.forEachIndexed { i, p -> val at = if (ps.size > 1 && i == ps.size - 1) room - p.width else x; p.place(at, (h - p.height) / 2); x = at + p.width + step }
    }
}

// ---------------------------------------------------------------- the Wiki (mtg-wiki-ui.js mtgWikiPageMarkup, style.css / polish.css .wiki-*)

/** --wiki-link: #86bbff, light #165faf. */
private val WikiLink get() = if (light) Color(0xFF165FAF) else Color(0xFF86BBFF)
/** The glass (polish.css body.glass) the site's buttons and chips wear: --glass-line, color-mix(#e8b95b 15%, #ffffff0d). */
private val WikiGlassLine get() = if (light) Site.Line else Color(0x31EEC980)

/** .wiki-page-head: the eyebrow over "Wiki" (Cinzel) on the left, ◈ Sets on the right, 16 apart, tops in line. */
@Composable
private fun WikiHead(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val inner = ctx.under(n)
    Row(mark.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Top) {
        n.elements.forEach { k ->
            if (k.tag == "div") Column(Modifier.weight(1f)) { Blocks(k.kids, ui, inner.under(k), padded = false) }
            else Element(k, ui, inner)
        }
    }
}

/**
 * .home-search-pill round #wikiQ: 76 tall, corners 25, the 120° night gradient, a 1 gold line at 70 %, its shadow 0 10 32 #0004; the
 * field 16 / 23.2, 22 in from the sides. Its words go to the field's input listener (suggest) as they're typed, Enter to the form's
 * submit; ✕ (the search field's clear) empties it.
 */
@Composable
private fun WikiSearchPill(n: SiteNode, ui: SiteUi, mark: Modifier) {
    val f = n.elements.firstOrNull { it.tag == "input" } ?: return
    var text by remember(f["id"]) { mutableStateOf(f.value ?: f["value"].orEmpty()) }
    val seen = f.value ?: f["value"].orEmpty()
    // The page put other words in the box (a pick, Wiki home): they show.
    LaunchedEffect(seen) { if (seen != text) text = seen }
    val shape = RoundedCornerShape(25.dp)
    // The line is the game's accent (Yu-Gi-Oh!'s violet, Pokémon's), as the site's --gold is per game.
    val gold = LocalGameGold.current
    val style = cssType(16f, 400, 23.2f, Site.Text)
    Box(mark.fillMaxWidth().heightIn(min = 76.dp).cssShadow(Color(0x44000000), 32.dp, 10.dp, 0.dp, 25.dp).clip(shape)
        .background(if (light) androidx.compose.ui.graphics.SolidColor(Site.Surface) else Brush.linearGradient(listOf(Color(0xE81B202D), Color(0xEF131720)), start = Offset.Zero, end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)))
        .border(1.dp, gold.copy(alpha = .7f), shape), contentAlignment = Alignment.CenterStart) {
        androidx.compose.foundation.text.BasicTextField(text, { text = it; ui.type(f.id, it) }, Modifier.fillMaxWidth().heightIn(min = 48.dp)
            .semantics { f["aria-label"]?.let { contentDescription = it } }, singleLine = true, textStyle = style, cursorBrush = androidx.compose.ui.graphics.SolidColor(gold),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { ui.submit?.invoke(f.id) }),
            decorationBox = { inner ->
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(start = 22.dp, end = if (text.isEmpty()) 22.dp else 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) {
                        if (text.isEmpty()) Text(f["placeholder"].orEmpty(), style = style.copy(color = Site.Muted), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        inner()
                    }
                    if (text.isNotEmpty()) Box(Modifier.size(48.dp).clip(CircleShape).clickable { text = ""; ui.type(f.id, "") }.semantics { role = Role.Button; contentDescription = "Clear" },
                        contentAlignment = Alignment.Center) { Text("✕", style = cssType(15f, 700, 20f, Site.Text)) }
                }
            })
    }
}

/** #wikiSuggestions (.home-suggestions): 8 under the box, corners 20, the 160° night gradient, a 1 gold line at 32 %, 8 in. */
@Composable
private fun WikiSuggestions(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val shape = RoundedCornerShape(20.dp)
    Column(mark.fillMaxWidth().padding(top = 8.dp).cssShadow(Color(0xEE000000), 50.dp, 24.dp, (-18).dp, 20.dp).clip(shape)
        .background(if (light) androidx.compose.ui.graphics.SolidColor(Site.Surface) else Brush.verticalGradient(listOf(Color(0xFF1D1F29), Color(0xFF12141B))))
        .border(1.dp, LocalGameGold.current.copy(alpha = .32f), shape).padding(8.dp)) {
        Blocks(n.kids, ui, ctx.under(n), padded = false)
    }
}

/** .home-assistant-action (Ask about this · CardStashy AI): 52 tall, corners 14, the violet-night gradient, a gold line at 55 %, the orb. */
@Composable
private fun AssistantAction(n: SiteNode, ui: SiteUi, mark: Modifier) {
    val shape = RoundedCornerShape(14.dp)
    val words = n.elements.firstOrNull { it.tag == "span" }
    val small = words?.elements?.firstOrNull { it.tag == "small" }?.text().orEmpty()
    val main = words?.kids?.filterIsInstance<String>()?.joinToString("")?.trim().orEmpty()
    Row(mark.padding(top = 6.dp).fillMaxWidth().heightIn(min = 52.dp).clip(shape)
        .background(if (light) androidx.compose.ui.graphics.SolidColor(Site.Surface2) else Brush.linearGradient(listOf(Color(0xFF2C2638), Color(0xFF1B2232))))
        .border(1.dp, Site.Gold.copy(alpha = .55f), shape).clickable { ui.tap(n.id) }.semantics(mergeDescendants = true) { role = Role.Button }
        .padding(horizontal = 14.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        BrandMark(30.dp)
        Column {
            Text(main, style = cssType(12f, 400, 17.4f, Site.Text))
            if (small.isNotEmpty()) Text(small, style = cssType(10f, 400, 14.5f, Site.Gold))
        }
    }
}

/**
 * section.home-hero.compact.wiki-daily (today's article): 260 tall at least, corners 22, the game's tab art filling it under a shade
 * (90°, rgba(17,23,34,.93) to .61); its words at the foot, 20 in (72 on the right): the eyebrow 11 / 700 1.76 apart, the title 24 /
 * 800, the summary 15 / 1.5, then Read article and the wiki's link. ↻ (when the day's article didn't come) a 44 round button at the top
 * right, 10 in.
 */
@Composable
private fun WikiDaily(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val shape = RoundedCornerShape(22.dp)
    val art = n.elements.firstOrNull { it.tag == "img" }
    val body = n.elements.firstOrNull { it.has("hh-body") } ?: return
    val refresh = body.elements.firstOrNull { it.has("wiki-daily-refresh") }
    val ink = Color(0xFFF5F7FC)
    val inner = ctx.under(n).under(body).color(ink)
    Box(mark.fillMaxWidth().heightIn(min = 260.dp).clip(shape).background(Site.Surface2), contentAlignment = Alignment.BottomStart) {
        val p = art?.pic?.takeIf { it.isNotEmpty() }?.let { firstOf(it) }
        if (p != null) androidx.compose.foundation.Image(p, null, Modifier.matchParentSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            alignment = androidx.compose.ui.BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(listOf(Color(0xED111722), Color(0x9C111722)))))
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 72.dp, top = 20.dp, bottom = 20.dp)) {
            body.elements.filter { !it.hidden && it !== refresh }.forEach { k ->
                when {
                    k.has("eyebrow") -> Text(k.text().uppercase(), Modifier.padding(bottom = 4.dp), style = cssType(11f, 700, 16.5f, Color(0xFFD9E1EF), track = 1.76f))
                    k.tag == "h2" -> Text(k.text(), Modifier.padding(top = 8.dp, bottom = 12.dp), style = cssType(24f, 800, 27.6f, ink).copy(fontFamily = Site.Manrope, letterSpacing = (-.48).sp))
                    k.has("actions") -> Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        k.elements.forEach { b -> SiteButton(b, ui, inner.under(k)) } }
                    k.tag == "p" -> Paragraph(k.kids, ui, inner.size(if (k.has("foot")) 12f else 15f, 1.5f), Modifier.padding(vertical = 6.dp))
                    else -> Element(k, ui, inner)
                }
            }
        }
        if (refresh != null) Box(Modifier.align(Alignment.TopEnd).padding(10.dp).size(44.dp).clip(CircleShape).background(Color(0xA60C0E13))
            .clickable { ui.tap(refresh.id) }.semantics { role = Role.Button; contentDescription = refresh["aria-label"].orEmpty() }, contentAlignment = Alignment.Center) {
            Text(refresh.text(), style = cssType(18f, 700, 22f, Color(0xFFF1E9D8)))
        }
    }
}

/** .wiki-reader-toolbar (420 and under): ← Wiki home and Ask about this sharing the row, 8 apart, each 44 tall, 13 / 700, 10 in. */
@Composable
private fun WikiToolbar(n: SiteNode, ui: SiteUi, mark: Modifier) {
    Row(mark.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        n.elements.filter { !it.hidden }.forEach { b ->
            val shape = RoundedCornerShape(11.dp)
            val icon = b.elements.flatMap { listOf(it) + it.elements }.firstOrNull { it.tag == "svg" }?.icon
            Row(Modifier.weight(1f).fillMaxHeight().heightIn(min = 44.dp).clip(shape).background(Site.Surface2.copy(alpha = .52f)).border(1.dp, WikiGlassLine, shape)
                .clickable(enabled = "disabled" !in b.attrs) { ui.tap(b.id) }.semantics(mergeDescendants = true) { role = Role.Button }.padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) { SiteIcon(icon, 15.dp, Site.Text); Spacer(Modifier.width(6.dp)) }
                Text(b.text(), style = cssType(13f, 700, 18.85f, Site.Text), textAlign = TextAlign.Center)
            }
        }
    }
}

/**
 * figure.wiki-article-figure (680 and under): centred, as wide as its picture up to 320, 7 in, corners 18 on surface-2 with the line;
 * the picture at most 370 tall, corners 11, whole; "Image unavailable" (13 muted, 180 tall) where it won't load; its caption 12 muted.
 */
@Composable
private fun WikiFigure(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val shape = RoundedCornerShape(18.dp)
    val img = n.elements.firstOrNull { it.tag == "img" }
    val fallback = n.elements.firstOrNull { "data-wiki-image-fallback" in it.attrs }
    val caption = n.elements.firstOrNull { it.tag == "figcaption" }
    Box(mark.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 320.dp).width(androidx.compose.foundation.layout.IntrinsicSize.Max).clip(shape).background(Site.Surface2).border(1.dp, Site.Line, shape).padding(7.dp)) {
            val p = img?.pic?.takeIf { it.isNotEmpty() }?.let { firstOf(it) }
            if (p != null) {
                val ratio = p.intrinsicSize.let { if (it != androidx.compose.ui.geometry.Size.Unspecified && it.width > 0f && it.height > 0f) it.width / it.height else .7f }
                androidx.compose.foundation.Image(p, img["alt"], Modifier.widthIn(max = 306.dp).heightIn(max = 370.dp).aspectRatio(ratio).clip(RoundedCornerShape(11.dp)),
                    contentScale = androidx.compose.ui.layout.ContentScale.Fit)
            } else Box(Modifier.width(150.dp).heightIn(min = 180.dp).clip(RoundedCornerShape(11.dp)).background(Site.Surface).padding(20.dp), contentAlignment = Alignment.Center) {
                Text(fallback?.text() ?: "Image unavailable", style = cssType(13f, 400, 18.85f, Site.Muted), textAlign = TextAlign.Center)
            }
            if (caption != null) Box(Modifier.padding(start = 4.dp, end = 4.dp, top = 9.dp, bottom = 4.dp)) {
                Paragraph(caption.kids, ui, ctx.under(n).under(caption).size(12f, 1.55f).color(Site.Muted), fill = false)
            }
        }
    }
}

/**
 * .wiki-article-table-wrap: a line round it, corners 14, surface; the table at least 28rem (448) wide, scrolling sideways inside it.
 * Cells 10 / 12 in, a line under each row but the last; th 700 on surface-2; 14 / 1.6. A colspan cell takes the row.
 */
@Composable
private fun WikiTable(n: SiteNode, ui: SiteUi, ctx: Ctx, mark: Modifier) {
    val shape = RoundedCornerShape(14.dp)
    val table = n.elements.firstOrNull { it.tag == "table" } ?: return
    val rows = table.elements.flatMap { if (it.tag == "tr") listOf(it) else it.elements.filter { r -> r.tag == "tr" } }
    val cols = rows.maxOfOrNull { r -> r.elements.filter { it.tag == "th" || it.tag == "td" }.sumOf { (it["colspan"]?.toIntOrNull() ?: 1) } } ?: 1
    val inner = ctx.under(n).under(table).size(14f, 1.6f)
    BoxWithConstraints(mark.fillMaxWidth().clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape)) {
        val w = maxOf(maxWidth, 448.dp)
        Column(Modifier.horizontalScroll(rememberScrollState()).width(w)) {
            table.elements.firstOrNull { it.tag == "caption" }?.let { cap ->
                Box(Modifier.fillMaxWidth().background(Site.Surface2).padding(horizontal = 14.dp, vertical = 12.dp)) { Paragraph(cap.kids, ui, inner.weight(700)) }
            }
            rows.forEachIndexed { i, r ->
                val line = Site.Line
                val last = i == rows.lastIndex
                Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min)) {
                    r.elements.filter { it.tag == "th" || it.tag == "td" }.forEach { cell ->
                        val span = (cell["colspan"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
                        val th = cell.tag == "th"
                        Box(Modifier.weight(span.toFloat() / cols).fillMaxHeight().then(if (th) Modifier.background(Site.Surface2) else Modifier)
                            .then(if (!last || th) Modifier.drawBehind { drawLine(line, Offset(0f, size.height - .5.dp.toPx()), Offset(size.width, size.height - .5.dp.toPx()), 1.dp.toPx()) } else Modifier)
                            .padding(horizontal = 12.dp, vertical = 10.dp)) {
                            Column { Blocks(cell.kids, ui, if (th) inner.under(cell).weight(700) else inner.under(cell), padded = false) }
                        }
                    }
                }
            }
        }
    }
}
