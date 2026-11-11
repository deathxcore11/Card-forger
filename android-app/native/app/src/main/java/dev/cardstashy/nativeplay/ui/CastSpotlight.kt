package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll

import android.graphics.BlurMaskFilter
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.InlineTextContent
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card

/**
 * Table-feel spec 2 (Randall 4 Nov 18:18Z): the cast spotlight. The card stands at the right, about 65 % of the table's
 * height, glowing red when the CPU plays it and gold when you do; our glass box sits 16 dp to its left with the site's
 * cpuShowHtml content: kicker (CPU / You + verb), name and cost, type line and P/T, the intent line, rules text with
 * symbols, up to three keyword hints and a thin countdown bar.
 */
class Spotlight(val card: Card, val actor: String, val verb: String, val targets: List<String>, val durationMs: Long, val yours: Boolean,
    /** The intent line's words when they are not a cast (a held card: tapped, damage, counters). */
    val note: String = "")

/** forge-table.mjs KEYWORD_HINTS, word for word. */
private val KEYWORD_HINTS = mapOf(
    "flying" to "Can only be blocked by creatures with flying or reach.", "reach" to "Can block creatures with flying.",
    "haste" to "Can attack and use {T} abilities the turn it arrives.", "vigilance" to "Attacking doesn\u2019t tap it.",
    "trample" to "Combat damage beyond what kills its blockers hits the player.", "deathtouch" to "Any damage it deals to a creature destroys that creature.",
    "lifelink" to "Damage it deals also gains you that much life.", "first strike" to "Deals combat damage before creatures without first strike.",
    "double strike" to "Deals first-strike and regular combat damage.", "menace" to "Can\u2019t be blocked except by two or more creatures.",
    "hexproof" to "Can\u2019t be the target of your opponents\u2019 spells or abilities.", "shroud" to "Can\u2019t be the target of any spell or ability.",
    "indestructible" to "Lethal damage and \u201cdestroy\u201d effects don\u2019t destroy it.", "defender" to "Can\u2019t attack.",
    "flash" to "Can be cast any time you could cast an instant.", "ward" to "Opponents\u2019 spells and abilities that target it are countered unless they pay the ward cost.",
    "prowess" to "Gets +1/+1 until end of turn whenever you cast a noncreature spell.",
    "protection" to "Can\u2019t be blocked, targeted, dealt damage, enchanted or equipped by anything with that quality.",
    "infect" to "Deals damage to creatures as -1/-1 counters and to players as poison counters.", "fear" to "Can only be blocked by artifact or black creatures.",
    "intimidate" to "Can only be blocked by artifact creatures or creatures that share a color with it.",
    "flanking" to "Creatures without flanking that block it get -1/-1 until end of turn.", "changeling" to "Is every creature type.",
    "toxic" to "Combat damage to a player also gives them that many poison counters.",
)
private fun keywordKey(k: String) = k.replace(Regex("([a-z])([A-Z])"), "$1 $2").replace(Regex("[:_]"), " ").replace(Regex("\\s+"), " ").trim().lowercase()
/** Forge spells some keywords with the word twice ("Protection from from black"): say it once. */
private fun keywordLabel(k: String) = keywordKey(k).replace(Regex("\\b(\\w+) \\1\\b"), "$1").replaceFirstChar { it.uppercase() }
private fun hintFor(k: String): String? { val key = keywordKey(k); return KEYWORD_HINTS.entries.firstOrNull { key == it.key || key.startsWith(it.key + " ") }?.value }

/**
 * 0.4.60 G4: one keyword box in the inspect view: the tile's icon ([key], a [TileBadges.KEYWORDS] icon, or null for a keyword the tile
 * shows as its word), Forge's words for it ([name]) and the KEYWORD_HINTS sentence ([hint], null when there is none).
 */
internal data class KeywordBox(val key: String?, val name: String, val hint: String?)

/**
 * 0.4.60 G4: the keyword boxes of [card], in the tile strip's order (TileBadges.of: the iconic ones in rank order, one per icon,
 * then the word ones in Forge's order). Names are Forge's own words (TileBadges.currentKeywords); one icon that stands for more
 * than one of Forge's entries (Protection from black, Protection from red) names them all. The sentence is KEYWORD_HINTS's, never ours.
 */
internal fun keywordBoxes(card: Card): List<KeywordBox> {
    if (card.hidden) return emptyList()
    val kws = TileBadges.currentKeywords(card)
    fun rank(key: String) = TileBadges.KEYWORDS.indexOfFirst { it.first == key }
    val iconic = kws.filter { it.key != null }.groupBy { it.key!! }.entries.sortedBy { rank(it.key) }
        .map { (key, ks) -> KeywordBox(key, ks.map { it.text }.distinct().joinToString(", "), hintFor(ks.first().text)) }
    val words = kws.filter { it.key == null }.map { KeywordBox(null, it.label, hintFor(it.text)) }
    return iconic + words
}

/** cpuShowHtml's intent: what the play is ("Casting a creature", "Using X's ability"), then who it aims at. */
internal fun spotlightIntent(s: Spotlight): String {
    if (s.note.isNotEmpty()) return s.note
    val c = s.card
    val creature = "Creature" in c.type && c.power != null
    val what = when (s.verb.uppercase()) {
        "CASTS", "CAST" -> when {
            creature -> "Casting a creature"
            Regex("Instant|Sorcery").containsMatchIn(c.type) -> "Casting a spell"
            else -> { val kind = c.type.split(Regex("\\s+[\u2014-]\\s+")).first().ifBlank { "permanent" }.lowercase(); "Casting ${if (kind.first() in "aeiou") "an" else "a"} $kind" }
        }
        "ACTIVATES" -> "Using ${c.name}\u2019s ability"
        "TRIGGERS" -> "${c.name}\u2019s ability triggers"
        else -> ""
    }
    val aims = s.targets.filter { it.isNotBlank() }
    fun list(xs: List<String>) = if (xs.size < 3) xs.joinToString(" and ") else xs.dropLast(1).joinToString(", ") + " and " + xs.last()
    return listOf(what, if (aims.isNotEmpty()) "Targeting ${list(aims)}" else "").filter { it.isNotEmpty() }.joinToString(" \u00B7 ")
}

private val GOLD = Color(0xFFE9C98A)
private val GLOW_CPU = Color(0xFFFF5A3C)
private val GLOW_YOU = Color(0xFFF0C27A)

@Composable
fun CastSpotlight(s: Spotlight, modifier: Modifier = Modifier, onTap: () -> Unit) {
    val enter = remember(s) { Animatable(0f) }
    val timer = remember(s) { Animatable(1f) }
    LaunchedEffect(s) {
        if (Motion.still) enter.snapTo(1f) else enter.animateTo(1f, tween(260, easing = FastOutSlowInEasing))
    }
    LaunchedEffect(s) { if (s.durationMs > 0) timer.animateTo(0f, tween(s.durationMs.toInt(), easing = LinearEasing)) }
    BoxWithConstraints(modifier.fillMaxSize()) {
        // Under the CPU's portrait, above End turn and To combat (Table thread check, 4 Nov 18:38Z): at most 62 % of the table.
        val u = chromeU(maxWidth, maxHeight)
        val top = 74.dp * u; val bottom = 104.dp * u
        val cardH = minOf(maxHeight * .62f, maxHeight - top - bottom); val cardW = cardH * .716f
        // The glass box keeps the site's proportions: on a short phone table everything in it scales down together.
        val k = (maxHeight / 560.dp).coerceIn(.64f, 1f)
        val boxW = (340.dp * k).coerceAtMost(maxWidth - cardW - 16.dp - 160.dp * u)
        val glow = if (s.yours) GLOW_YOU else GLOW_CPU
        // Clear of the CPU's library and graveyard piles at the right edge.
        Row(Modifier.align(Alignment.TopEnd).padding(end = 128.dp * u, top = top).graphicsLayer {
                alpha = enter.value; translationX = (1f - enter.value) * 40.dp.toPx(); val k = .94f + .06f * enter.value; scaleX = k; scaleY = k }
            .clickable(remember { MutableInteractionSource() }, PadFocus.Ring, onClick = onTap) // no press look of its own; the ring is the controller's only
            .semantics { contentDescription = "${s.actor} ${s.verb.lowercase()} ${s.card.name}" },
            horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            val dens = androidx.compose.ui.platform.LocalDensity.current
            androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(dens.density * k, dens.fontScale)) {
                GlassBox(s, boxW / k, cardH / k, timer.value)
            }
            // The card, its frame lit in the caster's colour.
            Box(Modifier.size(cardW, cardH).drawBehind {
                drawIntoCanvas { cv -> val p = Paint().apply { color = glow.copy(alpha = .55f) }
                    p.asFrameworkPaint().apply { maskFilter = BlurMaskFilter(26.dp.toPx(), BlurMaskFilter.Blur.NORMAL); color = glow.copy(alpha = .55f).toArgb() }
                    cv.drawRoundRect(0f, 0f, size.width, size.height, 18.dp.toPx(), 18.dp.toPx(), p) }
            }.clip(RoundedCornerShape(16.dp)).border(3.dp, glow, RoundedCornerShape(16.dp)).background(Color(0xFF141418))) {
                if (!s.card.hidden) CardImage(s.card.name, Modifier.fillMaxSize().padding(3.dp), contentScale = ContentScale.Fit, shape = RoundedCornerShape(12.dp))
            }
        }
    }
}

@Composable
private fun GlassBox(s: Spotlight, w: Dp, h: Dp, timer: Float, attached: List<Card> = emptyList(), onAttached: (Card) -> Unit = {},
    /** 0.4.60 G4: the inspect view's keyword boxes; they replace the keyword lines. [boxesInside]: drawn here under the rules (a short width). */
    boxes: List<KeywordBox>? = null, boxesInside: Boolean = false) {
    val c = s.card
    val shape = RoundedCornerShape(18.dp)
    val creature = "Creature" in c.type && c.power != null && c.toughness != null
    Column(Modifier.width(w).heightIn(max = h).drawBehind {
            // A deep shadow under the glass.
            drawIntoCanvas { cv -> val p = Paint(); p.asFrameworkPaint().apply { maskFilter = BlurMaskFilter(24.dp.toPx(), BlurMaskFilter.Blur.NORMAL); color = Color(0x99000000).toArgb() }
                cv.drawRoundRect(0f, 10.dp.toPx(), size.width, size.height + 10.dp.toPx(), 18.dp.toPx(), 18.dp.toPx(), p) }
        }.clip(shape).background(Color(0xD60D1016))
        .background(Brush.linearGradient(listOf(Color(0x17FFFFFF), Color(0x04FFFFFF), Color.Transparent), start = androidx.compose.ui.geometry.Offset.Zero, end = androidx.compose.ui.geometry.Offset(w.value * 2f, w.value * 3f)))
        .border(1.dp, Color(0x66E9C98A), shape).padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Kicker: CPU / You chip, then the verb.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(s.actor.uppercase(), style = sans(11.sp, FontWeight.Bold, Color(0xFFF3E9D2)).copy(letterSpacing = .14.em),
                modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0x1FFFFFFF)).padding(horizontal = 9.dp, vertical = 3.dp))
            Text(s.verb.uppercase(), style = sans(11.sp, FontWeight.Bold, GOLD).copy(letterSpacing = .16.em))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(c.name, style = TextStyle(fontFamily = Spectral, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color(0xFFFBF3DF)), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            if (c.manaCost.isNotBlank()) ManaCost(c.manaCost, 18.dp, Modifier.padding(start = 8.dp))
        }
        if (c.type.isNotBlank()) Row(verticalAlignment = Alignment.CenterVertically) {
            Text(c.type, style = sans(14.sp, FontWeight.Medium, Color(0xFFC9C2B2)), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            if (creature) Text("${c.power}/${c.toughness}", style = sans(14.sp, FontWeight.Bold, Color(0xFFFBF3DF)),
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).border(1.dp, Color(0x99E9C98A), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 2.dp))
        }
        val intent = spotlightIntent(s)
        if (intent.isNotEmpty()) Text(intent, style = sans(14.sp, FontWeight.SemiBold, Color(0xFFF3E9D2)), maxLines = 2,
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x14FFFFFF)).border(1.dp, Color(0x33E9C98A), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 8.dp))
        val lines = c.text.split(Regex("\n+")).map { it.trim() }.filter { it.isNotEmpty() }.take(6)
        if (lines.isNotEmpty()) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x1FFFFFFF)))
            // 0.4.60 G4: with the keyword boxes under them the rules keep their full height; the boxes give way (they scroll).
            Column(if (boxes != null && boxesInside && boxes.isNotEmpty()) Modifier else Modifier.weight(1f, fill = false), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                lines.forEach { l -> SymbolLine(l) }
            }
        }
        // 0.4.60 G4: no room beside the card: the keyword boxes go under the rules.
        if (boxes != null && boxesInside && boxes.isNotEmpty()) KeywordBoxes(c, boxes, Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState()), tight = true)
        // 0.4.60 G3: what is attached to the card (auras, equipment), under the rules as small cards; a tap on one inspects it.
        if (attached.isNotEmpty()) AttachedRow(c, attached, onAttached)
        val kws = if (boxes != null) emptyList() else c.keywords.map { it }.distinct().mapNotNull { k -> hintFor(k)?.let { k to it } }.take(3)
        kws.forEach { (k, hint) ->
            val inline = HashMap<String, InlineTextContent>()
            Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFFF3E9D2))) { append(keywordLabel(k)) }; append(" "); symbols(hint, inline) },
                style = sans(12.sp, FontWeight.Normal, Color(0xFFB9B2A4)), inlineContent = inline, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(2.dp))
        if (s.durationMs > 0) Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x1FFFFFFF))) {
            Box(Modifier.fillMaxWidth(timer).height(3.dp).background(Brush.horizontalGradient(listOf(Color(0xFFF7DA97), Color(0xFFE8B95B)))))
        }
    }
}

/**
 * 0.4.60 G4: the keyword boxes, one glass box each: the tile's icon in the tile's mark (dark pill, gold hairline, gold icon), the
 * keyword's name and its sentence with {symbols} drawn by the app's symbol set.
 * 0.4.60 G5: the dual bottom screen's reading panel draws the same boxes ([prefix] "b.read" names their anchors), two to a row
 * ([columns]) and lighter ([fill]), as they sit inside its glass.
 */
@Composable
internal fun KeywordBoxes(host: Card, boxes: List<KeywordBox>, modifier: Modifier = Modifier, tight: Boolean = false,
                          prefix: String = "inspect", columns: Int = 1, fill: Color = Color(0xF00E121C)) {
    // [tight]: under the rules in the glass box, a little closer together so the rules keep their room.
    val gap = if (tight) 5.dp else 7.dp
    @Composable fun One(i: Int, b: KeywordBox, m: Modifier) {
        val shape = RoundedCornerShape(12.dp)
        Row(m.anchorRect("${prefix}Kw${host.id}.$i")
            .clip(shape).background(fill).border(1.dp, Color(0x6BE3C070), shape).padding(horizontal = 11.dp, vertical = if (tight) 6.dp else 9.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.Top) {
            if (b.key != null) Box(Modifier.size(24.dp).anchorRect("${prefix}KwIcon${host.id}.$i").clip(RoundedCornerShape(50)).background(Color(0xF0101114))
                .border(1.dp, Color(0xFFD6AD64), RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                BoardIcon(b.key, Color(0xFFF2D496), 24.dp * .74f)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(b.name, style = sans(13.sp, FontWeight.ExtraBold, Color(0xFFFBF3DF)), maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (b.hint != null) {
                    val inline = HashMap<String, InlineTextContent>()
                    Text(buildAnnotatedString { symbols(b.hint, inline) }, style = sans(12.sp, FontWeight.Medium, Color(0xFFB8C0CD)).copy(lineHeight = 16.sp), inlineContent = inline)
                }
            }
        }
    }
    Column(modifier.anchorRect("${prefix}Kws${host.id}"), verticalArrangement = Arrangement.spacedBy(gap)) {
        if (columns <= 1) boxes.forEachIndexed { i, b -> One(i, b, Modifier.fillMaxWidth()) }
        // Side by side, each row as tall as its taller box so the pair lines up.
        else boxes.withIndex().chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
                row.forEach { (i, b) -> One(i, b, Modifier.weight(1f).fillMaxHeight()) }
                repeat(columns - row.size) { Box(Modifier.weight(1f)) }
            }
        }
    }
}

/** 0.4.60 G3: the cards attached to [host], each a small card with its name under it; a tap on one opens it in the same view. */
@Composable
private fun AttachedRow(host: Card, attached: List<Card>, onAttached: (Card) -> Unit) {
    Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x1FFFFFFF)))
    Text("ATTACHED", style = sans(11.sp, FontWeight.Bold, GOLD).copy(letterSpacing = .16.em))
    Row(Modifier.fillMaxWidth().anchorRect("inspectAttached${host.id}"), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        attached.take(4).forEach { a ->
            val shape = RoundedCornerShape(5.dp)
            Column(Modifier.width(58.dp).anchorRect("inspectAtt${a.id}").semantics { contentDescription = "${a.name}, attached to ${host.name}" }
                .clickable(remember { MutableInteractionSource() }, null) { onAttached(a) }, horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(52.dp, 72.dp).clip(shape).border(1.dp, Color(0x66E9C98A), shape).background(Color(0xFF141418))) {
                    if (!a.hidden) CardImage(a.name, Modifier.fillMaxSize().padding(1.dp), contentScale = ContentScale.Fit, shape = shape)
                }
                Spacer(Modifier.height(3.dp))
                Text(a.name, style = sans(10.sp, FontWeight.Bold, Color(0xFFC9C2B2)), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (attached.size > 4) Text("+${attached.size - 4}", style = sans(12.sp, FontWeight.Bold, Color(0xFFC9C2B2)), modifier = Modifier.align(Alignment.CenterVertically))
    }
}

/** One rules line with its {symbols} inline; reminder text in parentheses goes italic, as the site's .forge-cpu-rules. */
@Composable
private fun SymbolLine(line: String) {
    val inline = HashMap<String, InlineTextContent>()
    val text = buildAnnotatedString {
        var last = 0
        for (m in Regex("\\([^)]*\\)").findAll(line)) {
            symbols(line.substring(last, m.range.first), inline)
            withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = Color(0xFFA9A293))) { symbols(m.value, inline) }
            last = m.range.last + 1
        }
        symbols(line.substring(last), inline)
    }
    Text(text, style = TextStyle(fontFamily = Spectral, fontSize = 16.sp, lineHeight = 21.sp, color = Color(0xFFEDE6D6)), inlineContent = inline)
}



/**
 * Table-feel spec 2: holding or inspecting a card shows it with the same glass box as a cast (no countdown).
 * The kicker says whose it is and where; the intent line says its state on the table. Tap anywhere to close.
 */
@Composable
fun CardInspect(card: Card, viewer: Int?, start: PadAct? = null,
    /** 0.4.60 G3: the cards attached to [card] (attachedOf), listed under the rules; a tap on one calls [onAttached] to inspect it. */
    attached: List<Card> = emptyList(), onAttached: (Card) -> Unit = {},
    /** Two screens: the card shows on the bottom screen beside play. It takes no ring, holds no clock and hides no table button (test4: X on the gold and the clock died while it stayed open). */
    beside: Boolean = false, onClose: () -> Unit) {
    val yours = viewer == null || card.controller == viewer
    val where = when (card.zone) { "Battlefield" -> "On the battlefield"; "Hand" -> "In hand"; "Graveyard" -> "In the graveyard"; "Exile" -> "In exile"; "Stack" -> "On the stack"; "Command" -> "In the command zone"; else -> card.zone }
    val state = buildList {
        if (card.attacking) add("Attacking"); if (card.blocking) add("Blocking")
        if (card.tapped && card.zone == "Battlefield") add("Tapped")
        if (card.summoningSick && card.isCreature && card.zone == "Battlefield") add("Summoning sick")
        if (card.damage > 0) add("${card.damage} damage")
        card.counters.forEach { (k, v) -> if (v > 0) add("$v ${k.lowercase().replace('_', ' ').replace("p1p1", "+1/+1").replace("m1m1", "\u22121/\u22121")} counter" + if (v > 1) "s" else "") }
    }.joinToString(" \u00B7 ")
    val s = remember(card) { Spotlight(card, if (yours) "You" else "CPU", where, emptyList(), 0, yours, note = state) }
    val enter = remember(card) { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(card) { enter.animateTo(1f, tween(200, easing = FastOutSlowInEasing)) }
    // A controller: the open card takes the focus (A closes it, as a tap anywhere does), B closes it instead of leaving the match,
    // and closing hands the ring back to the card it was on. A phone with no pad keeps its back and taps as they were.
    val padOn = Pad.connected.collectAsState().value
    val padFocus = remember { FocusRequester() }
    val close = { TablePad.restore(); onClose() }
    LaunchedEffect(Unit) { if (Pad.connected.value && !beside) runCatching { padFocus.requestFocus() } }
    androidx.activity.compose.BackHandler(padOn) { close() }
    if (!beside) PadScreen(PadActs(b = "Close", start = start, opaque = true))
    val padHere = remember { PadActs(a = "Close") }
    // The whole dimmed page is the target, so it carries no ring of its own; the prompt bar says what A does.
    BoxWithConstraints(Modifier.fillMaxSize().padCover().background(Color(0xB3000000)).then(if (beside) Modifier else Modifier.padActs(padHere).focusRequester(padFocus).onFocusChanged { if (it.isFocused) TablePad.held = true })
        .clickable(remember { MutableInteractionSource() }, null, onClick = close)
        .windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp)) {
        val cardH = maxHeight * .92f; val cardW = cardH * .716f
        val k = (maxHeight / 560.dp).coerceIn(.64f, 1f)
        val boxW = (340.dp * k).coerceAtMost(maxWidth - cardW - 16.dp)
        val glass = boxW >= 200.dp
        // 0.4.60 G4: one glass box per keyword, in a column on the far side of the card from the glass box; when the width is short
        // (narrower than 180 dp at the glass box's scale) they go under the rules in the glass box instead.
        val boxes = remember(card) { keywordBoxes(card) }
        val kwW = (260.dp * k).coerceAtMost(maxWidth - cardW - (if (glass) boxW + 16.dp else 0.dp) - 16.dp)
        val kwBeside = boxes.isNotEmpty() && (kwW >= 180.dp * k || !glass)
        val glow = if (yours) GLOW_YOU else GLOW_CPU
        val dens = androidx.compose.ui.platform.LocalDensity.current
        Row(Modifier.align(Alignment.Center).graphicsLayer { alpha = enter.value; val z = .96f + .04f * enter.value; scaleX = z; scaleY = z }
            .semantics { contentDescription = card.name }, horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            if (glass) {
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(dens.density * k, dens.fontScale)) {
                    GlassBox(s, boxW / k, cardH / k, 0f, attached, onAttached, boxes = boxes, boxesInside = !kwBeside)
                }
            }
            Box(Modifier.size(cardW, cardH).anchorRect("inspectCard${card.id}").drawBehind {
                drawIntoCanvas { cv -> val p = Paint(); p.asFrameworkPaint().apply { maskFilter = BlurMaskFilter(26.dp.toPx(), BlurMaskFilter.Blur.NORMAL); color = glow.copy(alpha = .45f).toArgb() }
                    cv.drawRoundRect(0f, 0f, size.width, size.height, 18.dp.toPx(), 18.dp.toPx(), p) }
            }.clip(RoundedCornerShape(16.dp)).border(2.dp, glow.copy(alpha = .8f), RoundedCornerShape(16.dp)).background(Color(0xFF141418))) {
                if (!card.hidden) CardImage(card.name, Modifier.fillMaxSize().padding(2.dp), contentScale = ContentScale.Fit, shape = RoundedCornerShape(13.dp))
            }
            if (kwBeside && kwW > 0.dp) androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(dens.density * k, dens.fontScale)) {
                KeywordBoxes(card, boxes, Modifier.width(kwW / k).heightIn(max = cardH / k).verticalScroll(rememberScrollState()))
            }
        }
    }
}
