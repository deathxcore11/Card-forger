package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * 0.4.59 T3 (specs/table-look-0459.md, faults 19 and 24): tap a pile, a graveyard or a single permanent to see its whole cards.
 *
 * What is open is kept as a key ([Open]), never as cards, so the sheet always reads the table as it is now: a card that dies
 * leaves it, a card that taps turns in it. [sheetOf] is pure and unit tested (TableSheetTest); [TableSheetView] draws it.
 */
internal sealed interface Open {
    /** Every card of [name] that [controller] has on the battlefield, standing on its own (no attachments, no counters). */
    data class Group(val controller: Int, val name: String) : Open
    /** One permanent and what is attached to it. */
    data class One(val id: Int) : Open
    /** A player's graveyard; the sheet has a tab for each player's. */
    data class Grave(val player: Int) : Open
}

/** One whole card in the sheet: its caption, whether it is drawn turned (tapped), and whether a question asks for it. */
internal data class SheetCard(val card: Card, val note: String, val tapped: Boolean = false, val legal: Boolean = false, val chosen: Boolean = false)

/** A graveyard tab: whose it is, its label, and whether it is the one showing. */
internal data class SheetTab(val player: Int, val label: String, val on: Boolean)

internal data class Sheet(val title: String, val sub: String, val cards: List<SheetCard>, val tabs: List<SheetTab> = emptyList())

/** The cards a question may pick now (targets or a card choice), and the ones already picked. */
internal fun legalNow(st: MatchState, live: Boolean): Set<Int> = if (!live) emptySet() else st.selection.cards + st.selection.targetCards
internal fun graveChoices(st: MatchState, live: Boolean): List<Card> { val l = legalNow(st, live); return st.players.flatMap { it.graveyard }.filter { it.id in l } }

private fun whose(st: MatchState, id: Int) = if (id == st.viewer) "Your" else if (st.players.size <= 2) "CPU's" else (st.players.firstOrNull { it.id == id }?.name?.let { "$it's" } ?: "CPU's")
private fun pt(c: Card) = if (c.power != null && c.toughness != null) "${c.power}/${c.toughness}" else null

/** The sheet for [open] on [st], or null when what was opened has left the table (the sheet closes). */
internal fun sheetOf(st: MatchState, open: Open, live: Boolean = false): Sheet? {
    val legal = legalNow(st, live)
    fun sc(c: Card, note: String, tapped: Boolean = false) = SheetCard(c, note, tapped, c.id in legal, c.id in st.selection.chosenCards)
    return when (open) {
        is Open.Group -> {
            val all = st.players.flatMap { it.battlefield }.filter { it.controller == open.controller && it.name == open.name && it.attachedTo == null && it.attachments.isEmpty() && it.counters.isEmpty() }
            if (all.isEmpty()) return null
            val tapped = all.count { it.tapped }
            // Ready first, then the tapped ones turned (the brief: "ready first, tapped ones turned with Tapped").
            Sheet("${whose(st, open.controller)} ${open.name} ×${all.size}", "${all.size - tapped} ready, $tapped tapped",
                all.sortedBy { if (it.tapped) 1 else 0 }.map { sc(it, if (it.tapped) "Tapped" else "Ready", it.tapped) })
        }
        is Open.One -> {
            val c = st.card(open.id)?.takeIf { it.zone == "Battlefield" } ?: return null
            val attached = c.attachments.mapNotNull { st.card(it) }
            val sub = if (attached.isNotEmpty()) "${attached.size} attached" else if (c.tapped) "Tapped" else ""
            Sheet(c.name, sub, listOf(sc(c, if (c.tapped) "Tapped" else pt(c)?.let { "Now $it" } ?: c.name, c.tapped)) + attached.map { sc(it, "Attached to ${c.name}") })
        }
        is Open.Grave -> {
            val p = st.players.firstOrNull { it.id == open.player } ?: return null
            // Yours first, then the others', as the brief's two tabs ("Your graveyard", "CPU's graveyard").
            val tabs = (st.players.filter { it.id == st.viewer } + st.players.filter { it.id != st.viewer }).map { SheetTab(it.id, "${whose(st, it.id)} graveyard", it.id == p.id) }
            val n = p.graveyard.size
            Sheet("${whose(st, p.id)} graveyard", if (n == 0) "No cards" else "$n card${if (n == 1) "" else "s"}, newest first",
                p.graveyard.asReversed().map { sc(it, it.name) }, tabs)
        }
    }
}

/**
 * The glass sheet. One screen: over the lower 56 % of the table, the board above stays visible, a tap outside closes. Two screens:
 * the caller puts it on the bottom screen, under the hand ([bottom]), and the top screen does not change.
 * A card that a question asks for wears the target ring and a tap picks it ([onPick]); any other card opens the big view ([onInspect]).
 * A controller: the sheet takes the ring (Left and Right walk the cards, A opens or picks, B or Close closes).
 */
@Composable
internal fun TableSheetView(sheet: Sheet, onTab: (Int) -> Unit, onPick: (Card) -> Unit, onInspect: (Card) -> Unit, onClose: () -> Unit, bottom: Boolean = false) {
    val padOn = Pad.connected.collectAsState().value
    androidx.activity.compose.BackHandler(true) { onClose() }
    if (!bottom) PadScreen(PadActs(b = "Close", opaque = true))
    val first = remember { FocusRequester() }
    // The ring moves into the sheet and comes back to where it was when the sheet closes (TablePad.restore).
    LaunchedEffect(Unit) { if (Pad.connected.value) { androidx.compose.runtime.withFrameNanos { }; if (runCatching { first.requestFocus() }.isSuccess) TablePad.held = true } }
    BoxWithConstraints(Modifier.fillMaxSize().zIndex(60f)) {
        // Tap outside closes; the sheet itself swallows its own taps.
        Box(Modifier.fillMaxSize().clickable(remember { MutableInteractionSource() }, null, onClick = onClose))
        val h = maxHeight * (if (bottom) .51f else .56f)
        val k = (h / 300.dp).coerceIn(.62f, 1.6f)
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(h).anchorRect("tableSheet")
            .background(Color(0xED090C14)).border(1.dp, Color(0x33E8D3A0), RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
            .clickable(remember { MutableInteractionSource() }, null) {}
            .padding(horizontal = (19 * k).dp, vertical = (10 * k).dp), verticalArrangement = Arrangement.spacedBy((8 * k).dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy((12 * k).dp)) {
                if (sheet.tabs.size > 1) Row(horizontalArrangement = Arrangement.spacedBy((8 * k).dp)) {
                    sheet.tabs.forEach { t -> SheetButton(t.label, k, on = t.on) { onTab(t.player) } }
                } else Text(sheet.title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = (18 * k).sp, letterSpacing = (1.4 * k).sp, color = Color(0xFFE8C77A)),
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                Text(sheet.sub, style = sans((12.5f * k).sp, FontWeight.Bold, Color(0xFF9A96A8)), maxLines = 1, modifier = Modifier.weight(1f))
                SheetButton("Close", k, onClick = onClose)
            }
            BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
                val n = sheet.cards.size.coerceAtLeast(1)
                val gap = (11 * k).dp
                val capH = (20 * k).dp
                // Whole cards as tall as the sheet allows; when they don't fit side by side they get narrower, down to a readable
                // width, and past that the row scrolls (a 30-card graveyard).
                var ch = maxHeight - capH - (6 * k).dp; var cw = ch / 1.396f
                val fit = (maxWidth - gap * (n - 1)) / n
                if (cw > fit) { cw = maxOf(fit, (64 * k).dp); ch = cw * 1.396f }
                Row(Modifier.align(Alignment.Center).then(if (cw * n + gap * (n - 1) > maxWidth) Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()) else Modifier),
                    horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.CenterVertically) {
                    if (sheet.cards.isEmpty()) Text("Nothing here yet", style = sans((14 * k).sp, FontWeight.Bold, Color(0xFF9A96A8)))
                    sheet.cards.forEachIndexed { i, s ->
                        SheetFigure(s, cw, ch, capH, k, if (i == 0) first else null, padOn, { if (s.legal) onPick(s.card) else onInspect(s.card) }) { onInspect(s.card) }
                    }
                }
            }
        }
    }
}

@Composable
private fun SheetButton(label: String, k: Float, on: Boolean = false, onClick: () -> Unit) {
    val src = remember { MutableInteractionSource() }
    val edge = if (on) Color(0xFFE8C77A) else Color(0x40E8D3A0)
    Box(Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, edge, RoundedCornerShape(999.dp)).matchPadTap(src) { onClick() }
        .clickable(src, null, onClick = onClick).padding(horizontal = (14 * k).dp, vertical = (7 * k).dp)) {
        Text(label, style = sans((12.5f * k).sp, FontWeight.Bold, if (on) Color(0xFFE8C77A) else Color(0xFFEEE6D4)), maxLines = 1)
    }
}

@Composable
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
private fun SheetFigure(s: SheetCard, cw: Dp, ch: Dp, capH: Dp, k: Float, focus: FocusRequester?, padOn: Boolean, onTap: () -> Unit, onHold: () -> Unit) {
    val src = remember { MutableInteractionSource() }
    val ring = when { s.chosen -> Color(0xFFF3D27E); s.legal -> Color(0xFFFF9D5C); else -> null }
    val shape = RoundedCornerShape(cw * .046f)
    // The whole figure (card and caption) takes the tap: A or a tap picks a card the question asks for, else opens it big.
    Column(Modifier.width(cw + 8.dp).semantics { contentDescription = "${s.card.name}, ${s.note}" }
        .combinedClickable(src, null, onLongClick = onHold, onClick = onTap), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(cw, ch).graphicsLayer { if (s.tapped) { rotationZ = 6f; scaleX = .94f; scaleY = .94f } }
            .then(if (focus != null) Modifier.focusRequester(focus) else Modifier)
            .padActs(remember(s.legal) { PadActs(a = if (s.legal) "Choose" else "Inspect") }).matchPadTap(src) { onTap() }
            .then(if (ring != null) Modifier.border(2.5.dp, ring, shape) else Modifier)
            .clip(shape).background(Color(0xFF141418))) {
            if (!s.card.hidden) CardImage(s.card.name, Modifier.fillMaxSize().padding(1.dp), contentScale = ContentScale.Fit, shape = shape)
            // Tapped: darkened (about 60 %), as in the brief's preview.
            if (s.tapped) Box(Modifier.fillMaxSize().background(Color(0x66000000)))
        }
        Spacer(Modifier.height(4.dp))
        Text(s.note, style = sans((10.5f * k).sp, FontWeight.ExtraBold, if (s.tapped) Color(0xFF7FD3FF) else if (s.legal) Color(0xFFFF9D5C) else Color(0xFF9A96A8)),
            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.height(capH))
    }
}
