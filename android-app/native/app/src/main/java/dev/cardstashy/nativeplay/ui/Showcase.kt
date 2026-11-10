package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/*
 * The bottom screen's showcase case (Randall 9 Nov: "the bottom screen should be contextual and cool"; plan "The Showcase").
 * One glass-and-gold case: a plaque (what it is, its name, the purse in Play), a hero, the facts the top screen doesn't show,
 * and big touch buttons that name their pad key. A page's case follows its lens: whatever the ring or a finger is on.
 */

/** A page's lens: the key of what its bottom case previews (null = the page's own default case). It lives as long as the page. */
class LensHost {
    var key by mutableStateOf<String?>(null)
    /** Screenshots: the lens a page opens on. */
    companion object { @androidx.annotation.VisibleForTesting var preset: String? = null }
}

@Composable fun rememberLens(): LensHost = remember { LensHost().also { it.key = LensHost.preset } }

/** The ring (on this or anything inside it) or a finger landing here points the page's bottom case at [key]. */
fun Modifier.dualLens(host: LensHost, key: String?): Modifier = if (!DualScreen.active) this else this
    .onFocusChanged { if (it.hasFocus) host.key = key }
    .pointerInput(host, key) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial); if (!PadCursor.dragging) host.key = key } }

/** A case's touch button: the pad key it shares (A, X, Y) and what it does. */
/** The bottom screen's quick look at the card under the ring (Randall 9 Nov): like Play's Trunk case, with what fits the mode. */
class QuickLook(val key: String, val eyebrow: String, val name: String, val image: String?, val type: String? = null, val text: String? = null,
                val facts: List<Pair<String, String>> = emptyList(), val buttons: List<CaseButton> = emptyList(),
                /** The card's own foil look, when it shines, and where its light starts (0..1); the picture then tilts as its tile does. */
                val look: Foil.Look? = null, val tiltPhase: Float = 0f,
                /** What only this side shows under the facts (Play: the sets a card is owned in, what seals buy). */
                val extra: (@Composable ColumnScope.() -> Unit)? = null)

/**
 * One card case for both sides (Play and Collection family, T2): the whole card in its real corners, with its foil when it has
 * one, then its type, rules text and the facts the side gives it. Play's Trunk and Collection's lots and set cards all build this.
 */
@Composable
internal fun QuickLookCase(q: QuickLook) {
    val shines = q.look?.takeIf { it.shines }
    val tilt = rememberFoilTilt(live = shines != null, phase = q.tiltPhase, tile = false)
    ShowcaseCase(q.eyebrow, q.name, heroWeight = .4f, buttons = q.buttons, hero = if (q.image.isNullOrBlank()) null else { {
        CardPicture(q.image, shines, tilt, Modifier.align(Alignment.Center).padding(10.dp).fillMaxHeight().aspectRatio(63f / 88f, matchHeightConstraintsFirst = true), shape = CardCorner)
    } }) {
        q.type?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Gold)) }
        q.text?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Type.Sans, fontSize = 14.sp, lineHeight = 20.sp, color = Color(0xFFE4DFD3)), maxLines = 7, overflow = TextOverflow.Ellipsis) }
        q.facts.chunked(3).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) { row.forEach { (l, v) -> CaseFact(l, v) } } }
        q.extra?.invoke(this)
    }
}

class CaseButton(val key: String?, val label: String, val gold: Boolean = false, val enabled: Boolean = true, val weight: Float = 1f, val run: () -> Unit)

private val Gold = Color(0xFFD6AD64)
private val GoldHi = Color(0xFFF3D494)
private val Ink = Color(0xFFF6EEDB)
internal val CaseMuted = Color(0xFFB9B2A4)

/** The case, cross-fading as its lens moves. [key] is the lens; [content] draws the case for it. */
@Composable
fun <K> ShowcaseLens(key: K, content: @Composable (K) -> Unit) = Crossfade(key, animationSpec = tween(220), label = "case") { content(it) }

@Composable
fun ShowcaseCase(eyebrow: String, title: String, trailing: (@Composable () -> Unit)? = null, buttons: List<CaseButton> = emptyList(),
                 heroWeight: Float = .42f, scroll: Boolean = true, hero: (@Composable BoxScope.() -> Unit)? = null, facts: @Composable ColumnScope.() -> Unit) {
    val frame = RoundedCornerShape(24.dp)
    // A key printed on one of the case's buttons is not repeated in the hint bar under it (Randall 9 Nov: no prompt shown twice).
    val keys = buttons.mapNotNull { it.key?.takeIf { _ -> it.enabled } }.toSet()
    val owner = androidx.compose.runtime.remember { Any() }
    androidx.compose.runtime.DisposableEffect(owner, keys) { DualScreen.shownKeys[owner] = keys; onDispose { DualScreen.shownKeys.remove(owner) } }
    // Nor are a case button's words, whatever key the bar would put beside them ("A Continue" on the case, "X Continue" under it).
    val labels = buttons.filter { it.enabled }.map { it.label.lowercase() }.toSet()
    androidx.compose.runtime.DisposableEffect(owner, labels) { DualScreen.shownLabels[owner] = labels; onDispose { DualScreen.shownLabels.remove(owner) } }
    Box(Modifier.fillMaxSize().padding(10.dp).clip(frame)
        .background(Brush.verticalGradient(listOf(Color(0xE61A1D25), Color(0xF00C0E13))))
        .border(1.dp, Brush.linearGradient(listOf(Gold.copy(alpha = .55f), Gold.copy(alpha = .12f), Gold.copy(alpha = .45f))), frame)) {
        Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Plaque(eyebrow, title, trailing)
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                if (hero != null) {
                    val shape = RoundedCornerShape(16.dp)
                    Box(Modifier.weight(heroWeight).fillMaxHeight().clip(shape).background(Color(0xFF101218)).border(1.dp, Gold.copy(alpha = .3f), shape), content = hero)
                }
                Column(Modifier.weight(if (hero != null) 1f - heroWeight else 1f).fillMaxHeight().let { if (scroll) it.verticalScroll(rememberScrollState()) else it },
                    verticalArrangement = Arrangement.spacedBy(10.dp), content = facts)
            }
            if (buttons.isNotEmpty()) Row(Modifier.fillMaxWidth().height(54.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                buttons.forEach { CaseButtonView(it, Modifier.weight(it.weight).fillMaxHeight()) }
            }
        }
    }
}

/** The case's brass plaque: an eyebrow (CARD, DECK, ACT, BATTLE, PACK…) over the name, with the purse or a count at its right. */
@Composable
private fun Plaque(eyebrow: String, title: String, trailing: (@Composable () -> Unit)?) {
    val shape = RoundedCornerShape(16.dp)
    Row(Modifier.fillMaxWidth().clip(shape).background(Brush.horizontalGradient(listOf(Color(0xFF231C12), Color(0xFF14110C), Color(0xFF0F1015))))
        .border(1.dp, Brush.horizontalGradient(listOf(Gold.copy(alpha = .7f), Gold.copy(alpha = .2f))), shape).padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(eyebrow.uppercase(), style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .16.em, color = Gold), maxLines = 1)
            val long = title.length > 24
            Text(title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = if (long) 17.sp else 20.sp, lineHeight = if (long) 20.sp else 24.sp, color = Ink),
                maxLines = if (long) 2 else 1, overflow = TextOverflow.Ellipsis)
        }
        if (trailing != null) Box(Modifier.widthIn(max = 300.dp)) { trailing() }
    }
}

@Composable
private fun CaseButtonView(b: CaseButton, modifier: Modifier) {
    val shape = RoundedCornerShape(16.dp)
    val bg = if (b.gold && b.enabled) Brush.verticalGradient(listOf(Color(0xFFF0CF8A), Color(0xFFC9963F))) else Brush.verticalGradient(listOf(Color(0x1FFFFFFF), Color(0x0FFFFFFF)))
    val ink = if (b.gold && b.enabled) Color(0xFF1A1206) else if (b.enabled) Ink else CaseMuted
    Row(modifier.clip(shape).background(bg).border(1.dp, if (b.gold) GoldHi.copy(alpha = .8f) else Gold.copy(alpha = .35f), shape)
        .clickable(enabled = b.enabled, onClick = b.run).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
        b.key?.let { k ->
            val c = when (k) { "A" -> KeyA; "B" -> KeyB; "X" -> KeyX; "Y" -> KeyY; else -> Ink }
            Box(Modifier.size(26.dp).clip(CircleShape).background(if (b.gold && b.enabled) Color(0xFF1A1206) else Color(0x66000000)).border(1.5.dp, c, CircleShape),
                contentAlignment = Alignment.Center) { Text(k, style = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = c)) }
        }
        Text(b.label, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** A fact in the case: a small gold label over its words. */
@Composable
fun CaseFact(label: String, body: String, big: Boolean = false) = Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
    Text(label.uppercase(), style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .14.em, color = Gold))
    Text(body, style = if (big) TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, color = Ink)
        else TextStyle(fontFamily = Type.Sans, fontSize = 15.sp, lineHeight = 21.sp, color = Color(0xFFE4DFD3)))
}

/** The case's section label, for a group of facts (quests, packs). */
@Composable
fun CaseLabel(label: String) = Text(label.uppercase(), style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .14.em, color = Gold))
