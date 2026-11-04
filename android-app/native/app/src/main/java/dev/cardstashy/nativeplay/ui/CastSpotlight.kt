package dev.cardstashy.nativeplay.ui

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
class Spotlight(val card: Card, val actor: String, val verb: String, val targets: List<String>, val durationMs: Long, val yours: Boolean)

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
private fun hintFor(k: String): String? { val key = keywordKey(k); return KEYWORD_HINTS.entries.firstOrNull { key == it.key || key.startsWith(it.key + " ") }?.value }

/** cpuShowHtml's intent: what the play is ("Casting a creature", "Using X's ability"), then who it aims at. */
internal fun spotlightIntent(s: Spotlight): String {
    val c = s.card
    val creature = "Creature" in c.type && c.power != null
    val what = when (s.verb.uppercase()) {
        "CASTS" -> when {
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
            .clickable(remember { MutableInteractionSource() }, null, onClick = onTap)
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
private fun GlassBox(s: Spotlight, w: Dp, h: Dp, timer: Float) {
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
            Column(Modifier.weight(1f, fill = false), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                lines.forEach { l -> SymbolLine(l) }
            }
        }
        val kws = c.keywords.map { it }.distinct().mapNotNull { k -> hintFor(k)?.let { k to it } }.take(3)
        kws.forEach { (k, hint) ->
            val inline = HashMap<String, InlineTextContent>()
            Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFFF3E9D2))) { append(keywordKey(k).replaceFirstChar { it.uppercase() }) }; append(" "); symbols(hint, inline) },
                style = sans(12.sp, FontWeight.Normal, Color(0xFFB9B2A4)), inlineContent = inline, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(2.dp))
        if (s.durationMs > 0) Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x1FFFFFFF))) {
            Box(Modifier.fillMaxWidth(timer).height(3.dp).background(Brush.horizontalGradient(listOf(Color(0xFFF7DA97), Color(0xFFE8B95B)))))
        }
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

private fun AnnotatedString.Builder.symbols(s: String, inline: HashMap<String, InlineTextContent>) {
    var last = 0
    for (m in Regex("\\{([^}]+)\\}").findAll(s)) {
        append(s.substring(last, m.range.first)); val sym = m.groupValues[1]; val id = "sym:$sym"
        inline.getOrPut(id) { InlineTextContent(Placeholder(1.05.em, 1.05.em, PlaceholderVerticalAlign.TextCenter)) { Symbol(sym, 16.dp, Modifier.fillMaxSize()) } }
        appendInlineContent(id, "{$sym}"); last = m.range.last + 1
    }
    append(s.substring(last))
}

