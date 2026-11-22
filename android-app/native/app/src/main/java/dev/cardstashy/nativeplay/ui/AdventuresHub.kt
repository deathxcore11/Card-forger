package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/*
 * The Adventures hub (mock "Adventures Hub", approved 22 Nov). The games come from the registry (Adventures.kt); this file only draws
 * them. Four shapes of one screen, all sharing the one selected game:
 *   - held sideways (phone, handheld): the games in a row, the selected one wider, Play at the foot;
 *   - Fold inner: the row, then the selected game's panel beside the achievements;
 *   - AYN Thor: the top screen is the games as big posters and nothing else, the bottom screen is the selected game's details;
 *   - upright phone: the games stacked, the selected game's panel and Play under them.
 */

private val Ink = Color(0xFFF6EEDB)
private val Soft = Color(0xFFC9CED6)
private val Glass = Brush.verticalGradient(listOf(Color(0xCC171A22), Color(0xE00D0F14)))
private val Gold get() = Rule.Color.Gold

@Composable
fun AdventuresRoute(onBack: () -> Unit, host: AdventureHost) {
    val games = remember { Adventures.all() }
    AdventuresHub(games, host, onBack)
}

@Composable
internal fun AdventuresHub(games: List<AdventureGame>, host: AdventureHost, onBack: () -> Unit) {
    var sel by rememberSaveable { mutableStateOf(games.firstOrNull { it.ready }?.id) }
    val cur = games.firstOrNull { it.id == sel && it.ready }
    val play = { cur?.launch(host); Unit }
    val shared = remember(games) { Adventures.shared() }
    val dual = DualScreen.active
    BackHandler(onBack = onBack)
    BottomScreen { if (cur != null) Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Detail(cur, play); cur.progress()?.let { GameProgress(cur, it) }; shared?.let { Shared(it) } } }
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg).testTag("adventuresHub")) {
        val wide = maxWidth >= 600.dp
        val fold = wide && maxWidth >= 840.dp && maxHeight >= 560.dp && !dual
        val gap = if (wide) 16.dp else 12.dp
        val boxH = maxHeight
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(gap)) {
            if (dual) {
                // Top screen: the posters and nothing else.
                Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap)) { games.forEach { g -> Poster(g, g.id == cur?.id, Modifier.weight(1f).fillMaxHeight()) { sel = g.id } }; MoreSlot(Modifier.weight(.5f).fillMaxHeight()) }
            } else {
                Header(onBack, shared)
                if (wide) Row(Modifier.fillMaxWidth().height(if (fold) 300.dp else (boxH - 150.dp).coerceIn(140.dp, 260.dp)), horizontalArrangement = Arrangement.spacedBy(gap)) {
                    games.forEach { g -> Poster(g, g.id == cur?.id, Modifier.weight(if (g.id == cur?.id) 1.5f else 1f).fillMaxHeight()) { sel = g.id } }
                    MoreSlot(Modifier.weight(.55f).fillMaxHeight())
                } else Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                    games.forEach { g -> Poster(g, g.id == cur?.id, Modifier.fillMaxWidth().height(if (g.id == cur?.id) 140.dp else 76.dp)) { sel = g.id } }
                }
                if (cur != null) {
                    if (fold) Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(gap)) {
                        Detail(cur, play)
                        Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                            cur.progress()?.let { Box(Modifier.weight(1f)) { GameProgress(cur, it) } }
                            shared?.let { Box(Modifier.weight(1f)) { Shared(it) } }
                        }
                    } else if (wide) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(cur.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Ink))
                            (cur.state() ?: cur.style).let { Text(it, style = TextStyle(fontFamily = Type.Sans, fontSize = 14.sp, color = Soft)) }
                        }
                        GoldCta("Play", onClick = play)
                    } else Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(gap)) {
                        Detail(cur, play); cur.progress()?.let { GameProgress(cur, it) }; shared?.let { Shared(it) }
                    }
                }
            }
        }
    }
    PadScreen(PadActs(x = if (cur != null) PadAct("Play", play) else null, tabs = { k ->
        val ready = games.filter { it.ready }; val i = ready.indexOfFirst { it.id == cur?.id }
        ready.getOrNull((i + k).coerceIn(0, ready.lastIndex))?.let { sel = it.id } }, tabsLabel = "Game"))
}

@Composable
private fun Header(onBack: () -> Unit, shared: AdventureProgress?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("‹ Play", style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Soft), modifier = Modifier.clip(CircleShape)
            .border(1.dp, Rule.Color.Edge, CircleShape).clickable(onClick = onBack).padding(horizontal = 14.dp, vertical = 8.dp).semantics { contentDescription = "Back to Play" })
        Text("Adventures", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, letterSpacing = .08.em, color = Color(0xFFF3D77A)), modifier = Modifier.weight(1f))
        shared?.let { Text("★ ${it.earned} / ${it.total}", style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Gold), modifier = Modifier.clip(CircleShape).background(Rule.Color.Glass).border(1.dp, Rule.Color.GoldEdge, CircleShape).padding(horizontal = 14.dp, vertical = 8.dp)) }
    }
}

/** One game's card: its art, name and a line; the selected one wears its accent. A game that is not ready is dimmed and does nothing. */
@Composable
private fun Poster(g: AdventureGame, on: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val accent = Color(g.accent)
    val shape = RoundedCornerShape(18.dp)
    val glow by animateFloatAsState(if (on) 1f else 0f, Site.spring(), label = "poster")
    Box(modifier.clip(shape).background(Brush.verticalGradient(listOf(accent.copy(alpha = .35f), Color(0xFF0F1115)))).alpha(if (g.ready) .6f + .4f * glow else .55f)
        .border(if (on) 2.dp else 1.dp, if (on) accent else Rule.Color.Edge, shape).let { if (g.ready) it.clickable(onClick = onClick) else it }
        .semantics { contentDescription = if (g.ready) g.name else "${g.name}, coming soon" }.testTag("adventure-${g.id}")) {
        Art(g.art, Modifier.matchParentSize(), BiasAlignment(0f, g.artFocus))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Transparent, .55f to Color(0x000C0C0E), 1f to Color(0xF20C0C0E))))
        Column(Modifier.align(Alignment.BottomStart).padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(g.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 18.sp, letterSpacing = .03.em, color = if (on) accent else Ink), maxLines = 2)
            Text(if (g.ready) g.style else "Coming soon", style = TextStyle(fontFamily = Type.Sans, fontSize = 13.sp, color = Soft), maxLines = 2)
        }
    }
}

/** The dashed place the next game fills when it registers. */
@Composable
private fun MoreSlot(modifier: Modifier) {
    Box(modifier.drawBehind { drawRoundRect(Rule.Color.Edge, cornerRadius = CornerRadius(18.dp.toPx()), style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f)))) }, contentAlignment = Alignment.Center) {
        Text("More games to come", style = TextStyle(fontFamily = Type.Sans, fontSize = 13.sp, color = Soft, textAlign = androidx.compose.ui.text.style.TextAlign.Center), modifier = Modifier.padding(8.dp))
    }
}

@Composable
private fun Panel(content: @Composable () -> Unit) = Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Glass).border(1.dp, Rule.Color.Edge, RoundedCornerShape(14.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }

private fun heading() = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 14.sp, letterSpacing = .12.em, color = Gold)
private fun body() = TextStyle(fontFamily = Type.Sans, fontSize = 15.sp, lineHeight = 22.sp, color = Ink)

/** The selected game: its name, what it is, its live line, and Play. */
@Composable
private fun Detail(g: AdventureGame, play: () -> Unit) = Panel {
    Text(g.name, style = heading().copy(fontSize = 18.sp))
    Text(g.blurb, style = body())
    g.state()?.let { Text(it, style = TextStyle(fontFamily = Type.Sans, fontSize = 14.sp, color = Soft)) }
    GoldCta("Play", onClick = play)
}

@Composable
private fun GameProgress(g: AdventureGame, p: AdventureProgress) = Panel {
    Text("${g.name} achievements".uppercase(), style = heading())
    Text("${p.earned} of ${p.total}", style = body())
    Meter(p.earned, p.total)
    p.next?.let { Text("Next: $it", style = TextStyle(fontFamily = Type.Sans, fontSize = 14.sp, color = Soft)) }
}

@Composable
private fun Shared(p: AdventureProgress) = Panel {
    Text("SHARED ACHIEVEMENTS", style = heading())
    Text("${p.earned} of ${p.total}", style = body())
    Meter(p.earned, p.total)
    Text("${Adventures.toNextPack(p.earned)} more for a pack", style = TextStyle(fontFamily = Type.Sans, fontSize = 14.sp, color = Soft))
}

@Composable
private fun Meter(n: Int, of: Int) = Box(Modifier.fillMaxWidth().height(8.dp).clip(CircleShape).background(Color(0xFF1F2430))) {
    Box(Modifier.fillMaxWidth(if (of > 0) (n.toFloat() / of).coerceIn(0f, 1f) else 0f).fillMaxHeight().clip(CircleShape).background(Color(0xFFE2B866)))
}
