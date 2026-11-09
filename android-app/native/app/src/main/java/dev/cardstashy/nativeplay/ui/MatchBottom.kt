package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * The match on a dual-screen handheld's bottom screen (specs/dual-screen-native.md, screens 1 and 2). Hand: your hand fan on the
 * left (the same fan, taps and slides as the table's) and the lifted card large on the right with its words. Stack: whenever
 * something is on the stack the bottom turns to it by itself, newest on top, with Resolve (the table's gold button) and Respond
 * (back to your hand). The top screen keeps the table and the stack's moment on the felt; its hand fan becomes a small count.
 */
@Composable
internal fun MatchBottom(st: MatchState, hand: List<Card>, lifted: Card?, gold: PadAct?, fan: @Composable (Dp) -> Unit, onInspect: (Card) -> Unit) {
    var zone by remember { mutableStateOf("hand") }
    val stackUp = st.stack.isNotEmpty()
    var seenStack by remember { mutableStateOf(0) }
    // The stack takes the bottom when it grows; Respond goes back to the hand.
    if (st.stack.size > seenStack) { zone = "stack"; seenStack = st.stack.size } else if (st.stack.size < seenStack) seenStack = st.stack.size
    val shown = if (zone == "stack" && stackUp) "stack" else "hand"
    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            ZoneChip("Hand ${hand.size}", shown == "hand") { zone = "hand" }
            if (stackUp) ZoneChip("Stack ${st.stack.size}", shown == "stack") { zone = "stack" }
            // Life totals and the gold button stay on the top screen only (each fact in one place, Randall's rule).
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val h = maxHeight
            if (shown == "stack") StackView(st, gold, onInspect) { zone = "hand" }
            else Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // The lifted card's words across the top, the fan across the whole width below (Randall 9 Nov: "the fan can fit the bottom
                // screen better and knows how to scale when the hand is increasing, nothing jumpy, very natural").
                val c = lifted ?: hand.firstOrNull()
                Column(Modifier.fillMaxWidth().heightIn(max = h * .34f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (c != null) CardWords(c) else Text("Your hand is empty.", style = small(13f, Site.Muted))
                }
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                    // As big as the room allows: the height (leaving space for the lift), then the width shared by the cards with a
                    // generous overlap. The size eases as cards come and go, so the fan breathes instead of jumping.
                    val n = hand.size.coerceAtLeast(1)
                    val byH = (maxHeight - 20.dp) / 1.4f
                    val byW = maxWidth / (1f + (n - 1) * .46f)
                    val target = minOf(byH, byW, 190.dp).coerceAtLeast(56.dp)
                    val cardW by androidx.compose.animation.core.animateDpAsState(target, androidx.compose.animation.core.spring(dampingRatio = .9f, stiffness = 220f), label = "fan")
                    if (hand.isNotEmpty()) Box(Modifier.fillMaxWidth().padding(bottom = 4.dp)) { fan(cardW) }
                }
            }
        }
    }
}

@Composable
private fun StackView(st: MatchState, gold: PadAct?, onInspect: (Card) -> Unit, onRespond: () -> Unit) {
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1.25f).fillMaxHeight().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            // Newest first, as it will resolve: the top item large, the older ones stepped behind it.
            st.stack.asReversed().forEachIndexed { i, s ->
                val top = i == 0
                val shape = RoundedCornerShape(12.dp)
                Column(Modifier.fillMaxWidth().alpha(if (top) 1f else .72f).clip(shape).background(if (top) Color(0x24E8B95B) else Color(0x0DFFFFFF))
                    .border(1.dp, if (top) Color(0x99E8B95B) else Color(0x1FFFFFFF), shape)
                    .then(if (s.source != null) Modifier.clickable { onInspect(s.source) } else Modifier).padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(s.source?.name ?: if (s.ability) "Ability" else "Spell", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = if (top) 16.sp else 13.sp, color = Site.Text),
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(s.text, style = small(if (top) 13f else 12f, Color(0xFFE4E7EA)), maxLines = if (top) 6 else 2, overflow = TextOverflow.Ellipsis)
                    val who = if (s.controller == st.viewer) "Yours" else "Opponent's"
                    val targets = s.targets.mapNotNull { r -> r.name ?: (if (r.kind == "player") st.players.firstOrNull { it.id == r.id }?.let { if (it.isViewer) "you" else it.name } else st.card(r.id)?.name) }
                    Text(who + if (targets.isNotEmpty()) " · targets ${targets.joinToString(", ")}" else "", style = small(11.5f, if (targets.isNotEmpty() && top) Color(0xFFFF8A74) else Site.Muted))
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.Bottom)) {
            Text(if (st.waitingOnMe) "Your priority" else "Waiting", style = small(12f, if (st.waitingOnMe) Site.Gold else Site.Muted))
            GlassButton("Respond", st.waitingOnMe, onRespond)
            gold?.run?.let { GoldButton(gold.label, it) }
        }
    }
}

@Composable
private fun CardWords(c: Card) {
    Text(c.name, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = Site.Text), maxLines = 2, overflow = TextOverflow.Ellipsis)
    Text(listOf(c.type, c.manaCost.ifBlank { null }).filterNotNull().joinToString("  ·  "), style = small(12.5f, Site.Gold))
    if (c.text.isNotBlank()) Text(c.text, style = TextStyle(fontFamily = Site.Manrope, fontSize = 13.5f.sp, lineHeight = 19.sp, color = Color(0xFFE4E7EA)))
    if (c.power != null && c.toughness != null) Text("${c.power} / ${c.toughness}", style = small(13f, Site.Text, FontWeight.Bold))
}

@Composable
private fun ZoneChip(label: String, on: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Box(Modifier.heightIn(min = 36.dp).clip(shape).background(if (on) Color(0x26E8B95B) else Color(0x0DFFFFFF)).border(1.dp, if (on) Color(0x99E8B95B) else Color(0x1FFFFFFF), shape)
        .clickable(onClick = onClick).semantics { role = Role.Tab; selected = on }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
        Text(label, style = small(13f, if (on) Site.Gold else Site.Muted, FontWeight.Bold))
    }
}

@Composable
private fun GoldButton(label: String, run: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Box(Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(shape).background(Brush.verticalGradient(listOf(Color(0xFFF2D48F), Color(0xFFC99C4F)))).clickable(onClick = run)
        .semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (Pad.connected.value) PadKey("X", "")
            Text(label, style = small(15f, Color(0xFF2A1D0C), FontWeight.ExtraBold))
        }
    }
}

@Composable
private fun GlassButton(label: String, enabled: Boolean, run: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).alpha(if (enabled) 1f else .5f).clip(shape).background(Color(0x14FFFFFF)).border(1.dp, Color(0x33FFFFFF), shape)
        .clickable(enabled = enabled, onClick = run).semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
        Text(label, style = small(14f, Site.Text, FontWeight.Bold))
    }
}

private fun small(size: Float, color: Color, weight: FontWeight = FontWeight.SemiBold) = TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, color = color)
