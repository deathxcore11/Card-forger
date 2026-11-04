package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Player

/**
 * A Commander pod (match-table.mjs podRail, play-forge-table.css .play-pod-*): one opponent's seat and board at a time. The focus follows
 * whoever is taking their turn or attacking; tapping a chip in the opponent rail switches it until the next turn or attack.
 */
class PodFocus {
    private var follow: String? = null
    var seat: Int? = null

    /** The opponent on show. Not a pod: the only opponent. */
    fun of(st: MatchState, picked: Int?): Player {
        val rivals = st.players.filter { it.id != st.viewer }
        if (rivals.size < 2) return rivals.firstOrNull() ?: st.cpu
        if (picked != null) seat = picked
        val alive = rivals.filter { it.life > 0 }
        val attacker = rivals.firstOrNull { p -> p.battlefield.any { it.attacking } }?.id
        val key = listOf(st.turn, st.activePlayer, attacker).toString()
        if (key != follow) { follow = key; val want = attacker ?: st.activePlayer?.takeIf { it != st.viewer }; if (want != null && rivals.any { it.id == want }) seat = want }
        val current = rivals.firstOrNull { it.id == seat }
        if (current == null || current.life <= 0 && alive.isNotEmpty()) seat = (alive.firstOrNull() ?: rivals.first()).id
        return rivals.first { it.id == seat }
    }
}

private val Manrope = Type.Sans

/** .play-pod-rail: centred in 60 … W − 8 at the top (max 640, gap 6); each chip up to 210 × 44. */
@Composable
internal fun PodRail(st: MatchState, focus: Int, live: Boolean, intents: TableIntents, onFocus: (Int) -> Unit, W: Dp, d: Du) = with(d) {
    val rivals = st.players.filter { it.id != st.viewer }
    val labels = StorySurface.of(st).labels
    val you = st.me
    Box(Modifier.offset(x = 60.du, y = 8.du).width(W - 68.du), contentAlignment = Alignment.TopCenter) {
        Row(Modifier.widthIn(max = 640.du), horizontalArrangement = Arrangement.spacedBy(6.du)) {
            for (p in rivals) {
                val cmd = you.commanderDamage.filter { it.from == p.id }.maxOfOrNull { it.damage } ?: 0
                val focused = p.id == focus; val active = p.id == st.activePlayer; val lost = p.life <= 0
                val target = live && p.id in st.selection.players
                val shape = RoundedCornerShape(12.du)
                val edge = if (target) Color(0xFFFF8A5C) else if (focused) Color(0xB3E8B95B) else Color(0x1FFFFFFF)
                Row(Modifier.weight(1f).widthIn(max = 210.du).height(44.du).alpha(if (lost) .45f else 1f)
                    .drawBehind {
                        val r = 12.du.toPx()
                        // box-shadow: 0 0 0 1px #8fc6ff99, 0 0 16px #4f9dff66
                        if (active) { drawIntoCanvas { c -> val gp = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = Color(0x664F9DFF).toArgb(); maskFilter = android.graphics.BlurMaskFilter(8.du.toPx(), android.graphics.BlurMaskFilter.Blur.OUTER) }
                                c.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, r, r, gp) }
                            drawRoundRect(Color(0x998FC6FF), topLeft = Offset(-1.dp.toPx(), -1.dp.toPx()), size = Size(size.width + 2.dp.toPx(), size.height + 2.dp.toPx()), cornerRadius = CornerRadius(r + 1.dp.toPx()), style = Stroke(1.dp.toPx())) }
                        if (target) drawRoundRect(Color(0x66FF8A5C), topLeft = Offset(-2.dp.toPx(), -2.dp.toPx()), size = Size(size.width + 4.dp.toPx(), size.height + 4.dp.toPx()), cornerRadius = CornerRadius(r + 2.dp.toPx()), style = Stroke(2.dp.toPx()))
                    }
                    .clip(shape).background(if (focused) Brush.verticalGradient(listOf(Color(0xE62A2112), Color(0xE60D0F15))) else Brush.verticalGradient(listOf(Color(0xD90D0F15), Color(0xD90D0F15))))
                    .border(1.dp, edge, shape)
                    .clickable { if (target) intents.player(p.id) else onFocus(p.id) }
                    .padding(start = 4.du, end = 8.du, top = 4.du, bottom = 4.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.du)) {
                    val label = labels[p.id] ?: "CPU"
                    // .play-pod-face: 30 px, #2a2418, a 1.5 px #e8b95b99 ring; the commander's art, else the label's initial (Cinzel 14).
                    Box(Modifier.size(30.du).clip(CircleShape).background(Color(0xFF2A2418)).border(1.5.dp, Color(0x99E8B95B), CircleShape), contentAlignment = Alignment.Center) {
                        Text(label.take(1), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(14f), color = Color(0xFFE8D6A8)))
                        p.command.firstOrNull { it.commander }?.let { c -> CardImage(c.name, Modifier.fillMaxSize(), crop = true) {} }
                            ?: (p.battlefield + p.graveyard + p.exile).firstOrNull { it.commander && it.owner == p.id }?.let { c -> CardImage(c.name, Modifier.fillMaxSize(), crop = true) {} }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.du)) {
                        Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = sp(12f), color = Color(0xFFEFE6D2)))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.du), verticalAlignment = Alignment.CenterVertically) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.padding(end = 3.du).size(7.du, 10.du).clip(RoundedCornerShape(2.du)).background(Color(0xFF3D5C9E)).border(1.dp, Color(0xFF9FB8E8), RoundedCornerShape(2.du)))
                                Text("${p.handCount}", style = sans(sp(11f), FontWeight.SemiBold, Color(0xFFCFC6B4)))
                            }
                            if (cmd > 0) Text("$cmd cmd", style = sans(sp(11f), FontWeight.SemiBold, if (cmd >= 15) Color(0xFFFF6A5A) else Color(0xFFFFB08F)))
                        }
                    }
                    Text(if (lost) "Out" else "${p.life}", style = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = sp(if (lost) 12f else 17f), color = if (lost) Color(0xFFCFC6B4) else Color.White))
                }
            }
        }
    }
}
