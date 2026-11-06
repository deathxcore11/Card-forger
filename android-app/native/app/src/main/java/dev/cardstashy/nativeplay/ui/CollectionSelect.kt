package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.InfiniteRepeatableSpec
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.animateColor
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.pairs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()

private val SInk = Color(0xFFEEF0F4)
private val SMute = Color(0xFF9AA2B1)
/** --surface: the compare article's ground. */
private val SSurface = Color(0xFF171A20)

/**
 * workbench-ui.js A.batchAction's sheets for the Select tray. Move selected cards: how many, then collection-locations.js
 * locationPicker (Where it lives, a new place or binder typed in when picked) and Move cards. Add selected cards to a deck: what
 * that does, the Deck select (or "Create a deck first") and Add to draft. Add selected cards to wishlist: how many, Add to
 * wishlist. Each saves through A.batchApply (CollectionWrites.act "batchApply") and closes, the tray's ticks cleared. Compare
 * cards: [CompareSheet].
 */
@Composable
internal fun BatchSheet(o: CollectionWrites.BatchOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val m = o.model
    if (m.s("kind") == "compare") { CompareSheet(m, backdrop, onClose); return }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val loc = m.o("location")
    val deck = m.o("deck")
    var picker by remember { mutableStateOf(loc?.s("selected").orEmpty()) }
    var location by remember { mutableStateOf(loc?.s("input").orEmpty()) }
    // The input is hidden until a new place or binder is picked (locationPicker's isNew is false).
    var locShown by remember { mutableStateOf(false) }
    var locPlaceholder by remember { mutableStateOf(loc?.s("placeholder").orEmpty()) }
    var locHint by remember { mutableStateOf(loc?.s("hint").orEmpty()) }
    var locFocus by remember { mutableIntStateOf(0) }
    var deckId by remember { mutableStateOf(deck?.s("selected").orEmpty()) }
    var busy by remember { mutableStateOf(false) }
    // collection-locations.js chooseLocation.
    fun chooseLocation(v: String) {
        picker = v
        val newName = v == "new" || v == "binder:new"
        locShown = newName
        location = if (newName) "" else if (v.startsWith("location:")) v.removePrefix("location:") else ""
        locPlaceholder = if (v == "binder:new") "Name your binder…" else "e.g. Deck box, Blue box…"
        locHint = if (v == "binder:new") "This creates a named binder and places the card in it when you save." else "Saved names can be selected again for your next card."
        if (newName) locFocus++
    }
    fun apply() {
        if (busy) return
        busy = true
        scope.launch {
            val d = JsonObject().apply {
                addProperty("game", o.game); addProperty("kind", m.s("kind")); addProperty("ids", m.get("ids")?.toString() ?: "[]")
                addProperty("location", location.trim()); addProperty("picker", picker); addProperty("deck", deckId)
            }
            val saved = CollectionWrites.act(context, "batchApply", d)
            busy = false
            if (saved) onClose()
        }
    }
    val button = m.o("button") ?: JsonObject()
    SiteSheet(m.s("title"), backdrop, onClose) { _ ->
        // <p>: margin 6 0, in the sheet's own 15 / 400.
        Text(m.s("text"), Modifier.padding(vertical = 6.dp), style = SHEET_PLAIN)
        if (loc != null) {
            // .location-picker: a grid 8 apart; its label 13 / 600 muted, the select 46 tall, the hint 11 / 15.95 muted.
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(loc.s("label"), style = cssType(13f, 600, 18.85f, SMute))
                FormSelect(loc.pairs("options"), picker, SHEET_PLAIN, minH = 46.dp, desc = loc.s("label")) { chooseLocation(it) }
                if (locShown) {
                    val focus = remember { FocusRequester() }
                    FormInput(location, { location = it.take(100) }, SHEET_PLAIN, locPlaceholder, Modifier.focusRequester(focus), minH = 46.dp,
                        desc = if (picker == "binder:new") "New binder name" else "New location name")
                    LaunchedEffect(locFocus) { runCatching { focus.requestFocus() } }
                }
                Text(locHint, style = cssType(11f, 400, 15.95f, SMute))
            }
        }
        if (deck != null) {
            FormLabeled(deck.s("label"), Modifier.fillMaxWidth()) { FormSelect(deck.pairs("options"), deckId, SHEET_IN_LABEL, desc = deck.s("label")) { deckId = it } }
            // <p>Create a deck first, then return here.</p>: 6 above; its 6 below and the button's 10 both stand (the button is inline).
            if (m.s("none").isNotBlank()) Text(m.s("none"), Modifier.padding(top = 6.dp, bottom = 6.dp), style = SHEET_PLAIN)
        }
        // .btn.block: margin-top 10, the sheet's width, in the game's accent.
        Spacer(Modifier.height(10.dp))
        FormGold(button.s("label"), enabled = !button.b("disabled"), modifier = Modifier.fillMaxWidth(), pal = LocalSheetPal.current) { apply() }
    }
}

/**
 * workbench-ui.js's Compare cards: .batch-compare, a grid of columns at least 150 wide (16 apart, the empty ones folded away), each
 * card an <article> (12 in, the surface, 14 corners): its picture (the width, at most 230 tall, contained, the price tier's 2 ring
 * inside its edge), the name (h3, 15 / 700), its type and rules (13 / 1.6), .compare-facts (12: the label muted, the value 600 at
 * the end, 5 apart) and where it lives with its copies, muted. Cards in a row share its height (the grid stretches them).
 */
@Composable
private fun CompareSheet(m: JsonObject, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val cards = m.objs("cards")
    SiteSheet(m.s("title"), backdrop, onClose) { _ ->
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val w = maxWidth
            val fit = max(1, ((w + 16.dp) / (150.dp + 16.dp)).toInt())
            val cols = min(fit, max(1, cards.size))
            val colW = (w - 16.dp * (cols - 1)) / cols
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                cards.chunked(cols).forEach { row ->
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        row.forEach { c -> CompareCard(c, colW, Modifier.weight(1f).fillMaxHeight()) }
                        repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

private val H3 = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, lineHeight = 17.25.sp, letterSpacing = (-.3).sp, color = SInk, lineHeightStyle = CSS_LINE)

@Composable
private fun CompareCard(c: JsonObject, colW: Dp, modifier: Modifier) {
    val inner = colW - 24.dp
    // The picture's own proportions (Magic and Pokémon about 5 : 7, Yu-Gi-Oh! a little taller), at most 230 tall.
    val pic = c.o("picture")
    val tall = if (pic?.s("src")?.contains("ygoprodeck") == true) 614f / 421f else 680f / 488f
    val h = min(inner.value * tall, 230f).dp
    val p13 = cssType(13f, 400, 20.8f, SInk)
    val facts = c.get("facts")?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(SSurface).padding(12.dp).semantics(mergeDescendants = false) { contentDescription = c.s("name") }) {
        TierPicture(pic?.s("src"), c.s("tier"), c.s("tierColor"), Modifier.fillMaxWidth().height(h))
        // The inline picture's line keeps 6.8 under it before the h3.
        Spacer(Modifier.height(6.8.dp))
        Text(c.s("name"), style = H3)
        // The paragraphs' margins as the page collapses them: h3's 8 under, each p 6, the empty .compare-facts' 12 (always there).
        var gap = 8f
        if (c.s("type").isNotEmpty()) { Spacer(Modifier.height(gap.dp)); Text(c.s("type"), style = p13); gap = 6f }
        if (c.s("text").isNotEmpty()) { Spacer(Modifier.height(gap.dp)); Text(c.s("text"), style = p13); gap = 6f }
        gap = max(gap, 12f)
        if (facts.isNotEmpty()) {
            Spacer(Modifier.height(gap.dp))
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                facts.forEach { (dt, dd) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(dt, Modifier.weight(1f, fill = false), style = cssType(12f, 400, 17.4f, SMute))
                        Spacer(Modifier.weight(1f))
                        Text(dd, style = cssType(12f, 600, 17.4f, SInk))
                    }
                }
            }
            gap = 12f
        }
        Spacer(Modifier.height(gap.dp))
        Text(c.s("where"), style = cssType(13f, 400, 20.8f, SMute))
        // Its 6 below, inside the article's 12.
        Spacer(Modifier.height(6.dp))
    }
}

/**
 * img[data-tier]: the picture contained in its box (6 corners) with a 2 ring of the tier's colour inside the box's edge (t0 #8b939c);
 * t3 to t5 glow 12 out (spread −3); t4's ring breathes to #fff0b0 over 3.4 s, t5's to #ffb050 over 2.4 s (still when motion is off).
 */
@Composable
private fun TierPicture(src: String?, tier: String, tierColor: String, modifier: Modifier) {
    val base = if (tier == "t0") Color(0xFF8B939C) else if (tier.isNotEmpty()) cssColor(tierColor, Color.Transparent) ?: Color(0xFF9AA3AD) else null
    val breathe = when (tier) { "t4" -> Color(0xFFFFF0B0) to 3400; "t5" -> Color(0xFFFFB050) to 2400; else -> null }
    val ring = if (base != null && breathe != null && !Motion.still) {
        val t = rememberInfiniteTransition(label = "tier")
        t.animateColor(base, breathe.first, InfiniteRepeatableSpec(tween(breathe.second / 2, easing = CubicBezierEasing(.42f, 0f, .58f, 1f)), RepeatMode.Reverse), label = "ring").value
    } else base
    val glow = base?.takeIf { tier == "t3" || tier == "t4" || tier == "t5" }
    Box(modifier.drawBehind { glow?.let { outerShadow(it, 12f, 0f, -3f, 6f) } }.drawWithContent {
        drawContent()
        if (ring != null) {
            val s = 2.dp.toPx(); val r = 6.dp.toPx()
            drawRoundRect(ring, Offset(s / 2, s / 2), Size(size.width - s, size.height - s), CornerRadius(r - s / 2), style = Stroke(s))
        }
    }) {
        CardPicture(src, null, null, Modifier.fillMaxSize(), shape = RoundedCornerShape(6.dp), contentScale = ContentScale.Fit)
    }
}
