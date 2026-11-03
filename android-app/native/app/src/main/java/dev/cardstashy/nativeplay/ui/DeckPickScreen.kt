package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.match.DemoDeck
import dev.cardstashy.nativeplay.match.DemoDecks

/** Quick Play: two demo decks side by side. The CPU always plays the other one. */
@Composable
fun DeckPickScreen(onPick: (DemoDeck) -> Unit, onBack: () -> Unit) {
    val decks = DemoDecks.load(LocalContext.current)
    Backdrop("play/playmat-charcoal-table.webp", dim = .5f) {
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp)) {
            val wide = maxWidth > maxHeight
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) { Text("‹", style = Type.Title.copy(fontSize = 28.sp)) }
                    Text("Quick Play", style = Type.Title.copy(fontSize = 22.sp))
                }
                val content: @Composable (Modifier) -> Unit = { m ->
                    decks.decks.forEach { d -> DeckCard(d, decks, m) { onPick(d) } }
                }
                if (wide) Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) { content(Modifier.weight(1f).fillMaxHeight()) }
                else Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) { content(Modifier.weight(1f).fillMaxWidth()) }
            }
        }
    }
}

@Composable
private fun DeckCard(d: DemoDeck, decks: DemoDecks, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(modifier.clip(shape).border(1.5.dp, Palette.Gold, shape).clickable(onClick = onClick)) {
        AssetImage(decks.image(d.face, crop = true), Modifier.fillMaxSize(), maxWidth = 900)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, .5f to Color(0x22000000), 1f to Color(0xF00A0A0C))))
        Column(Modifier.align(Alignment.BottomStart).padding(16.dp)) {
            Text(d.name, style = Type.Title.copy(fontSize = 22.sp))
            Text("${d.count} cards · ${if (d.colour == "R") "Red" else "Green"}", style = Type.Label.copy(color = Palette.Gold))
        }
    }
}

/** The versus beat: your deck against the CPU's while the engine opens the match. */
@Composable
fun VersusScreen(you: DemoDeck, cpu: DemoDeck) {
    val decks = DemoDecks.load(LocalContext.current)
    val a = remember { Animatable(0f) }
    LaunchedEffect(Unit) { a.animateTo(1f, tween(700)) }
    Backdrop("play/playmat-charcoal-table.webp", dim = .55f) {
        Row(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            Plate(you.name, "You", decks.image(you.face, true), Modifier.weight(1f).alpha(a.value))
            Box(Modifier.size(72.dp).scale(.6f + .4f * a.value).clip(CircleShape).background(Brush.radialGradient(listOf(Palette.GoldBright, Palette.GoldDeep))).border(2.dp, Color(0xFF3A2A10), CircleShape), contentAlignment = Alignment.Center) {
                Text("VS", style = Type.Title.copy(color = Color(0xFF1B140A), fontSize = 24.sp))
            }
            Plate(cpu.name, "CPU", decks.image(cpu.face, true), Modifier.weight(1f).alpha(a.value))
        }
    }
}

@Composable
private fun Plate(name: String, who: String, art: String?, modifier: Modifier) {
    val shape = RoundedCornerShape(16.dp)
    Box(modifier.aspectRatio(1.35f).clip(shape).border(1.5.dp, Palette.Gold, shape)) {
        AssetImage(art, Modifier.fillMaxSize(), maxWidth = 900)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 1f to Color(0xEE0A0A0C))))
        Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
            Text(who, style = Type.Label.copy(color = Palette.Gold)); Text(name, style = Type.Title)
        }
    }
}
