package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.StackItem

/**
 * Better table scene 10 (design/better-table-preview.html, the saga scene): a Saga stands as a whole upright card at the right
 * end of its owner's side (beside the planeswalkers, M14's column) with its chapter marks I, II, III hanging off its left edge,
 * the chapters reached lit in gold. A chapter on the stack is marked with its numeral. Leaving after the last chapter is Forge's
 * own sacrifice; nothing here adds an effect for it.
 */
internal object SagaMarks {
    /** A chapter mark's width (du, times the card's scale), the space between two marks, and between the marks and the card. */
    const val PIP = 22f; const val PIP_GAP = 3f; const val PIP_OUT = 4f
    /** How long a newly lit chapter mark takes to land (ms). */
    const val PIP_POP_MS = 520

    /** A Saga that is not also a creature (a creature Saga fights in the creature row) and not attached to anything. */
    fun isSaga(c: Card) = c.type.contains("Saga") && !c.isCreature && !c.isLand && c.attachedTo == null

    /** The lore Forge counts on the card: the chapter it has reached. */
    fun lore(c: Card) = c.counters["LORE"] ?: 0

    private val ROMAN = mapOf('I' to 1, 'V' to 5, 'X' to 10)
    /** A roman numeral (I to XXXIX) as a number, or null. */
    fun roman(s: String): Int? {
        if (s.isEmpty() || s.any { it !in ROMAN }) return null
        var total = 0
        for (i in s.indices) { val v = ROMAN.getValue(s[i]); val next = if (i + 1 < s.length) ROMAN.getValue(s[i + 1]) else 0; total += if (v < next) -v else v }
        return total.takeIf { it > 0 }
    }
    fun numeral(n: Int): String = buildString {
        var r = n
        for ((v, t) in listOf(10 to "X", 9 to "IX", 5 to "V", 4 to "IV", 1 to "I")) while (r >= v) { append(t); r -= v }
    }

    // A chapter line opens with its numerals: "I, II — Create a…", "III — Knights you control…" (an em dash, an en dash or a hyphen).
    private val LINE = Regex("(?m)^\\s*([IVX]+(?:\\s*,\\s*[IVX]+)*)\\s*[\\u2014\\u2013-]")
    private val AFTER = Regex("Sacrifice after ([IVX]+)")
    /** How many chapters the Saga's rules text has: the highest numeral that opens a line, else its "Sacrifice after N", else 3. */
    fun chapters(text: String): Int {
        val lines = LINE.findAll(text).flatMap { m -> m.groupValues[1].split(',').mapNotNull { roman(it.trim()) } }.maxOrNull()
        return lines ?: AFTER.find(text)?.let { roman(it.groupValues[1]) } ?: 3
    }

    /** The rules line for chapter [n] ("II — Whenever a creature…"), from a line that names it alone or with others ("I, II — …"). */
    fun chapterLine(text: String, n: Int): String? = text.lines().map { it.trim() }.firstOrNull { l ->
        LINE.find(l)?.groupValues?.get(1)?.split(',')?.mapNotNull { roman(it.trim()) }?.contains(n) == true }

    // Forge's stack text for a chapter: "History of Benalia — I, II — Create…", "(II) — …", "Chapter II — …".
    private val STACK = Regex("(?:^|\\u2014\\s*|Chapter\\s+)\\(?([IVX]+(?:\\s*,\\s*[IVX]+)*)\\)?\\s*[\\u2014\\u2013-]")
    /**
     * The chapter a Saga's trigger on the stack is for, or null when the item is not a Saga's. A line that names several chapters
     * ("I, II —") or none is read from the source's lore count, which Forge has just raised to the chapter that triggered.
     */
    fun stackChapter(s: StackItem): Int? {
        val src = s.source ?: return null
        if (!src.type.contains("Saga")) return null
        val named = STACK.find(s.text)?.groupValues?.get(1)?.split(',')?.mapNotNull { roman(it.trim()) }.orEmpty()
        return named.singleOrNull() ?: lore(src).takeIf { it > 0 }?.let { l -> if (named.isEmpty() || l in named) l else named.max() }
    }

    private val LEAD = Regex("^\\s*(?:Chapter\\s+)?\\(?[IVX]+(?:\\s*,\\s*[IVX]+)*\\)?\\s*[\\u2014\\u2013-]\\s*")
    /** A chapter's words on its stack card: Forge's text after the source's name, without the numerals the card's foot shows. */
    fun chapterWords(text: String): String {
        val body = if (LEAD.containsMatchIn(text)) text else text.substringAfter(" — ", text)
        return body.replaceFirst(LEAD, "").ifBlank { body }
    }

    /** The scale the planeswalker shield uses for a whole card [h] dp tall at design unit [u]. */
    fun scale(h: Float, u: Float) = (h / u / 94f).coerceIn(.8f, 1.5f)
    /** How far the marks reach left of a whole card [h] dp tall (dp), so the rows end short of them. */
    fun reach(h: Float, u: Float) = (PIP + PIP_OUT) * scale(h, u) * u
}

private val PipInk = Color(0xFF1C1405)
private val PipDim = Color(0xFF8E8A80)
private val PipGlass = Color(0xFF10131D)
private val PipRing = Color(0xFFFFF3CF)

/**
 * The chapter marks, a column of circles off the card's left edge, centred on its height. A reached chapter is gold; the current
 * one wears a light ring and a soft glow. When Forge adds lore, the new mark lands with a short pop (none while motion is still
 * or reduced). [modifier] is the card's own box (size, offset, its effect transform).
 */
@Composable
internal fun ChapterPips(card: Card, h: Dp, d: Du, calm: Boolean, modifier: Modifier) = with(d) {
    val k = SagaMarks.scale(h.value, u)
    val n = SagaMarks.chapters(card.text)
    val lore = SagaMarks.lore(card).coerceIn(0, n)
    // The ladder never runs past the card: a short card (a crowded column) takes smaller marks, the numerals with them.
    val fit = ((h.value / (n * SagaMarks.PIP + (n - 1) * SagaMarks.PIP_GAP) / u) * .96f).coerceAtMost(k)
    val pip = (SagaMarks.PIP * fit).du; val gap = (SagaMarks.PIP_GAP * fit).du
    val colH = pip * n + gap * (n - 1)
    val pop = remember(card.id) { Animatable(1f) }
    val last = remember(card.id) { androidx.compose.runtime.mutableIntStateOf(lore) }
    LaunchedEffect(lore) {
        if (lore != last.intValue) {
            val up = lore > last.intValue; last.intValue = lore
            if (up && !calm) { pop.snapTo(0f); pop.animateTo(1f, tween(SagaMarks.PIP_POP_MS, easing = { backOut(it) })) }
        }
    }
    Box(modifier) {
        Box(Modifier.align(Alignment.CenterStart).offset(x = -(pip + (SagaMarks.PIP_OUT * k).du)).size(pip, colH).anchorRect("chapter${card.id}")
            .semantics { contentDescription = "Chapter $lore of $n" }
            // The spine: a gold-deep hairline through the marks' centres, so they read as one ladder, not loose coins.
            .drawBehind {
                val x = size.width / 2
                drawLine(Palette.GoldDeep.copy(alpha = .7f), Offset(x, pip.toPx() / 2), Offset(x, size.height - pip.toPx() / 2), 1.2.dp.toPx())
            }) {
            for (i in 1..n) {
                val on = i <= lore; val now = i == lore
                val landing = now && pop.value < 1f
                Box(Modifier.offset(y = (pip + gap) * (i - 1)).size(pip).anchorRect("chapter${card.id}:$i")
                    .graphicsLayer { if (landing) { val s = 1.45f - .45f * pop.value; scaleX = s; scaleY = s } }
                    .drawBehind {
                        val r = size.minDimension / 2
                        drawCircle(Color(0xB3000000), radius = r, center = center + Offset(0f, 1.5.dp.toPx()))
                        if (now) drawIntoCanvas { c ->
                            val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = Palette.GoldBright.copy(alpha = .45f + .45f * (1f - pop.value)).toArgb()
                                maskFilter = android.graphics.BlurMaskFilter(6.dp.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                            c.nativeCanvas.drawCircle(center.x, center.y, r + 1.dp.toPx(), p)
                        }
                        if (on) drawCircle(Brush.radialGradient(listOf(Color(0xFFFFF2C6), Palette.GoldBright, Color(0xFFA9822F)), center = center - Offset(r * .3f, r * .35f), radius = r * 1.5f), radius = r)
                        else {
                            drawCircle(PipGlass, radius = r)
                            drawCircle(Palette.GoldDeep, radius = r - .75.dp.toPx(), style = Stroke(1.5.dp.toPx()))
                        }
                        if (now) drawCircle(PipRing, radius = r + 1.dp.toPx(), style = Stroke(2.dp.toPx()))
                    }, contentAlignment = Alignment.Center) {
                    Text(SagaMarks.numeral(i), maxLines = 1, softWrap = false,
                        style = TextStyle(fontFamily = Type.Cinzel, fontWeight = if (on) FontWeight.ExtraBold else FontWeight.Bold, fontSize = sp(10.5f * fit), color = if (on) PipInk else PipDim))
                }
            }
        }
    }
}
