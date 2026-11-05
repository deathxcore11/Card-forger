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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
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
class SitePanelModel(val key: String, val body: SiteNode?, val reveal: Int?, val acted: JsonObject?, val toasts: List<String> = emptyList()) {
    /** The tab's own markup (the body's first child). */
    val page: SiteNode? get() = body?.elements?.firstOrNull()
    /** A rule-dex glass (aside.rule-glass) open over it. */
    val glass: SiteNode? get() = body?.elements?.firstOrNull { it.tag == "aside" && it.has("rule-glass") && !it.hidden }
    companion object {
        fun parse(j: JsonObject) = SitePanelModel(j.get("key")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty(), SiteNode.parse(j.get("body")) as? SiteNode,
            j.get("reveal")?.takeIf { it.isJsonPrimitive }?.asInt, j.get("acted")?.takeIf { it.isJsonObject }?.asJsonObject,
            j.get("toasts")?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty())
    }
}

/**
 * What a tap does: [tap] a node's click on the site's listeners, [type] an input's value, [open] an outside link. [anchor]: where
 * the last tapped node sits in the window (its getBoundingClientRect, which rule-dex.js places its glass under); shared by copies.
 */
class SiteUi(val tap: (Int) -> Unit, val type: (Int, String) -> Unit, val open: (String) -> Unit, val screen: Dp,
             val anchor: androidx.compose.runtime.MutableState<androidx.compose.ui.geometry.Rect?> = mutableStateOf(null)) {
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
private data class Ctx(val style: TextStyle, val line: Float = 1.45f, val pre: Boolean = false, val anc: Set<String> = emptySet(), val parent: SiteNode? = null, val upper: Boolean = false)
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
            .clickable(remember { MutableInteractionSource() }, null) {}
            .verticalScroll(rememberScrollState()).padding(20.dp)) {
            Blocks(g.kids, ui, base().under(g), padded = true)
        }
    }, modifier = Modifier.fillMaxSize().onGloballyPositioned { origin = it.positionInRoot() }
        .clickable(remember { MutableInteractionSource() }, null) { onOutside() }) { ms, c ->
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
    k.tag == "button" -> inText || k.has("rule-word")
    k.tag == "a" -> inText || (!k.has("btn") && !k.has("link"))
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
    n.has("panel") -> if (ctx.rules) 0f to 0f else 12f to 12f
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
        n.has("wc-tool") -> ChestTool(n, ui, mark)
        n.has("hand-card") -> HandCard(n, ui, mark)
        n.tag == "button" || n.tag == "a" -> SiteButton(n, ui, ctx, mark)
        n.tag == "input" -> SiteInput(n, ui, mark)
        n.tag == "label" && n.has("learn-search") -> Column(mark.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            n.kids.filter { isInline(it, false) }.takeIf { l -> l.any { !(it is String && it.isBlank()) } }?.let { Paragraph(it, ui, inner.size(13.6f).color(Site.Muted)) }
            n.elements.filter { it.tag == "input" }.forEach { SiteInput(it, ui) }
        }
        n.tag == "p" || n.tag in setOf("h1", "h2", "h3", "h4", "h5", "h6") -> Paragraph(n.kids, ui, textCtx(n, ctx).under(n), mark, center = n.has("center"))
        n.tag == "ol" && n.has("learn-story") -> LearnStory(n, ui, inner, mark)
        n.tag == "ol" || n.tag == "ul" -> Column(mark.fillMaxWidth().padding(start = 24.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            n.elements.filter { it.tag == "li" && !it.hidden }.forEachIndexed { i, li ->
                Row { Text(if (n.tag == "ol") "${i + 1}. " else "• ", style = ctx.style); Column(Modifier.weight(1f)) { Blocks(li.kids, ui, inner.under(li), padded = false) } }
            }
        }
        else -> Container(n, ui, ctx, mark)
    }
}

/** The font a paragraph or heading sets for its words ([ctx]: its parent's). */
private fun textCtx(n: SiteNode, ctx: Ctx): Ctx {
    var c = ctx
    fun head(size: Float, w: Int) = c.copy(style = c.style.copy(fontFamily = Site.Manrope, letterSpacing = (-.02).em, fontSize = size.sp, lineHeight = (size * 1.15f).sp, fontWeight = FontWeight(w)), line = 1.15f)
    when (n.tag) {
        "h1" -> c = head(26f, 800)
        "h2" -> c = head(19f, 800)
        "h3" -> c = if (ctx.parentHas("learn-welcome")) head(23.2f, 700).let { it.copy(style = it.style.copy(lineHeight = (23.2f * 1.17f).sp, letterSpacing = (-.025).em)) } else head(15f, 700)
        "h4" -> c = c.weight(700).let { if (ctx.parentHas("rule-check")) it.size(it.px, 1.5f) else it }
    }
    // .eyebrow: 11, 700, .12em apart, uppercase, muted.
    if (n.has("eyebrow")) c = c.copy(style = c.style.copy(fontSize = 11.sp, lineHeight = (11 * c.line).sp, letterSpacing = 1.32.sp, color = Site.Muted, fontWeight = FontWeight(700)), upper = true)
    if (n.has("foot")) c = c.size(12f).color(Site.Faint)
    if (n.has("small")) c = c.size(13f)
    if (n.has("muted")) c = c.color(Site.Muted)
    if (n.has("learn-overview")) c = c.size(c.px, 1.65f).color(Site.Muted)
    if (n.has("learn-context")) c = c.size(c.px, 1.6f)
    if (n.has("warn-text")) c = c.color(Warn)
    if (n.has("ok-text")) c = c.color(Good)
    if (n.has("bad-text")) c = c.color(Bad)
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
        n.has("row") || n.has("learn-book-filters") || n.has("learn-keywords") || n.has("rule-source-footer") || n.has("chips") || n.has("actions") -> {
            val gap = when { n.has("learn-book-filters") || n.has("chips") -> 6.dp; n.has("rule-source-footer") -> 12.dp; else -> 8.dp }
            val box = if (n.has("rule-source-footer")) mark.fillMaxWidth().drawBehind { drawLine(Site.Line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }.padding(top = 20.dp) else mark.fillMaxWidth()
            if (n.has("between") && !n.has("wrap")) Row(box, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                shown.forEach { k ->
                    // A control keeps its own width; words take what they need of the rest (a flex item's max-content, shrinking to fit),
                    // and a heading keeps its margins (a flex item's don't collapse): .panel .row h3's 8 under it.
                    if (k is SiteNode && (k.tag == "button" || k.tag == "a" || k.tag == "input")) Element(k, ui, inner)
                    else Box(Modifier.weight(1f, fill = false).width(IntrinsicSize.Max)) {
                        when {
                            k is SiteNode && k.tag.length == 2 && k.tag[0] == 'h' -> margins(k, inner).let { (t, b) -> Box(Modifier.padding(top = t.dp, bottom = b.dp)) { Element(k, ui, inner) } }
                            k is SiteNode && !isInline(k, false) -> Element(k, ui, inner)
                            else -> Paragraph(listOf(k), ui, inner, Modifier)
                        }
                    }
                } }
            else FlowRow(box, horizontalArrangement = Arrangement.spacedBy(gap), verticalArrangement = Arrangement.spacedBy(gap)) {
                shown.forEach { k ->
                    when {
                        k is SiteNode && k.tag == "p" -> Box(Modifier.fillMaxWidth()) { Paragraph(k.kids, ui, textCtx(k, inner).under(k)) }
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
                n.has("panel") -> { m = m.clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape); pad = PaddingValues(if (n.has("rule-library") || n.has("rule-destination")) 18.dp else 14.dp) }
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
    val marker = n.has("small") && !n.has("panel")
    if (marker) sum = inner.size(13f)
    when {
        n.has("panel") -> {
            val shape = RoundedCornerShape(14.dp)
            m = m.clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape)
            if (n.has("learn-disclosure")) { pad = if (ui.screen <= 380.dp) PaddingValues(16.dp) else PaddingValues(horizontal = 20.dp, vertical = 18.dp); openGap = 20f; blockSmall = true }
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
        if (summary != null) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).clickable { ui.tap(summary.id) }.semantics { role = Role.Button }) {
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
            } else Summary(summary, ui, sum.under(summary), blockSmall, n)
        }
        // .learn-disclosure[open] > summary: 20 under it, meeting the first block's top margin.
        if (open) Blocks(body, ui, bodyCtx, padded = true, lead = openGap)
    }
}

/** A summary's words; where the site makes its <small> a block, each on its own line under the title (muted, 5 above; .learn-topic's 6, weight 400). */
@Composable
private fun Summary(s: SiteNode, ui: SiteUi, ctx: Ctx, blockSmall: Boolean, d: SiteNode) {
    val smalls = s.kids.filter { it is SiteNode && it.tag == "small" }
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
@Composable
private fun SiteButton(n: SiteNode, ui: SiteUi, ctx: Ctx, modifier0: Modifier = Modifier) {
    val disabled = "disabled" in n.attrs
    val href = n["href"].orEmpty()
    var bounds by remember { mutableStateOf<androidx.compose.ui.geometry.Rect?>(null) }
    val tap: () -> Unit = { if (n.tag == "a" && href.startsWith("http")) ui.open(href) else if (!disabled) { ui.anchor.value = bounds; ui.tap(n.id) } }
    val label = n.text()
    val rail = ctx.parentHas("learn-step-rail")
    val modifier = modifier0.onGloballyPositioned { bounds = it.boundsInRoot() }
    when {
        n.has("btn") -> {
            val ghost = n.has("ghost"); val small = n.has("small")
            val shape = RoundedCornerShape(11.dp)
            val ink = if (n.has("danger")) Bad else if (ghost) Site.Text else Site.GoldInk
            Box(modifier.alpha(if (disabled) .45f else 1f).heightIn(min = if (small) 34.dp else 44.dp).clip(shape).background(if (ghost) Site.Surface2 else Site.Gold)
                .then(if (ghost) Modifier.border(1.dp, Site.Line, shape) else Modifier).clickable(enabled = !disabled) { tap() }
                .semantics { role = Role.Button }.padding(horizontal = if (small) 12.dp else 16.dp, vertical = 6.dp), contentAlignment = Alignment.Center) {
                Text(label, style = cssType(if (small) 13.5f else 15f, 700, if (small) 19.6f else 21.75f, ink), textAlign = TextAlign.Center)
            }
        }
        n.has("chip") -> {
            val on = n.has("on") && n.has("pick")
            val shape = RoundedCornerShape(if (rail) 10.dp else 999.dp)
            val size = when { rail || ctx.parentHas("learn-book-filters") -> 12.16f; n.has("pick") -> 13f; else -> 12f }
            Box(modifier.heightIn(min = if (rail) 44.dp else if (ctx.rules) 40.dp else 0.dp).clip(shape).background(if (on) Site.Gold else Site.Surface2)
                .border(1.dp, if (on) Site.Gold else Site.Line, shape).clickable(enabled = !disabled) { tap() }.semantics { role = Role.Button }
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
            val color = if (plain && ctx.glass) (accent ?: Site.Text) else Site.Gold
            Box(modifier.clip(RoundedCornerShape(4.dp)).clickable(enabled = !disabled) { tap() }.semantics { role = Role.Button }.padding(vertical = if (plain) 0.dp else 4.dp)) {
                Text(label, style = cssType(size, if (plain) 400 else 600, size * (if (n.has("rule-source-action")) 1.6f else 1.45f), color)
                    .let { if (plain) it.copy(textDecoration = TextDecoration.Underline) else it })
            }
        }
    }
}

/** input[type=search]: the site's field (44 tall, 11 corners, its line); each letter goes to the site's input listener. */
@Composable
private fun SiteInput(n: SiteNode, ui: SiteUi, modifier: Modifier = Modifier) {
    var text by remember(n.id) { mutableStateOf(n.value ?: n["value"].orEmpty()) }
    FormInput(text, { text = it; ui.type(n.id, it) }, cssType(15f, 400, 21.75f, Site.Text), n["placeholder"].orEmpty(), modifier, desc = n["aria-label"].orEmpty())
}

// ---------------------------------------------------------------- words

/**
 * A paragraph of words and inline tags: <b>/<strong> bold, <small> smaller, <em> italic, a rule word (.rule-word, underlined in
 * the accent colour: its tap opens the rule dex) and a link or button inside the words as a gold tap target. Whitespace folds to
 * single spaces as HTML folds it, except in pre-wrap text (.rule-source-text).
 */
@Composable
private fun Paragraph(kids: List<Any>, ui: SiteUi, ctx: Ctx, modifier: Modifier = Modifier, center: Boolean = false) {
    val spot = remember { LinkSpot() }
    val s = remember(kids, ctx) { buildAnnotatedString { fold(this, kids, ui, ctx, spot) } }
    val shown = if (ctx.pre) s else s.trimEnd()
    if (shown.text.isBlank()) return
    Text(shown, modifier.fillMaxWidth().onGloballyPositioned { spot.coords = it }, style = ctx.style, textAlign = if (center) TextAlign.Center else TextAlign.Start,
        onTextLayout = { spot.layout = it })
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
                    else SpanStyle(color = Site.Gold, fontWeight = FontWeight(600), fontSize = if (n.has("small")) 13.sp else TextUnit.Unspecified)
                val r = IntArray(2).also { it[0] = b.length }
                b.withLink(LinkAnnotation.Clickable("n:" + n.id, TextLinkStyles(style)) {
                    if (n.tag == "a" && href.startsWith("http")) ui.open(href) else { ui.anchor.value = spot.rect(r[0], r[1]); ui.tap(n.id) } }) { kids(upper) }
                r[1] = b.length
            }
            n.tag == "b" || n.tag == "strong" -> b.withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { kids(upper) }
            n.tag == "em" || n.tag == "i" -> b.withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { kids(upper) }
            n.has("eyebrow") -> b.withStyle(SpanStyle(fontSize = 11.sp, letterSpacing = 1.32.sp, color = Site.Muted, fontWeight = FontWeight(700))) { kids(true) }
            n.tag == "small" -> b.withStyle(SpanStyle(fontSize = (ctx.px * .833f).sp)) { kids(upper) }
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
    Column(mark.fillMaxWidth().clip(shape).drawBehind { chestLid() }.border(1.dp, Color(0x47E8CE87), shape).padding(horizontal = 18.dp, vertical = 24.dp),
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
    Column(mark.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).clickable { ui.tap(n.id) }
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
