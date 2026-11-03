package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.ForgeService
import dev.cardstashy.nativeplay.match.DemoDecks

/**
 * Home, after Randall's dashboard mockup: currencies, the four mode tiles, the shortcut row and the
 * right column. Only Quick Play works in this test build; the rest are dimmed static panels.
 */
@Composable
fun HomeScreen(onQuickPlay: () -> Unit) {
    val context = LocalContext.current
    val decks = DemoDecks.load(context)
    val engine by ForgeService.status.collectAsState()
    val ready = engine is ForgeService.Status.Ready
    Backdrop(decks.image(decks.homeArt[4], crop = true) ?: "play/playmat-charcoal-table.webp", dim = .6f) {
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp)) {
            val wide = maxWidth > 700.dp
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                TopBar()
                if (wide) Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        ModeTiles(decks, ready, engine, onQuickPlay, columns = 4)
                        ShortcutRow(columns = 4)
                    }
                    Column(Modifier.width(300.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) { ProfilePanel(); TrunkPanel() }
                } else {
                    ModeTiles(decks, ready, engine, onQuickPlay, columns = 2)
                    ShortcutRow(columns = 2)
                    ProfilePanel(); TrunkPanel()
                }
            }
        }
    }
}

@Composable
private fun TopBar() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column {
            Text("Collection", style = Type.Title.copy(fontSize = 24.sp))
            Text("CardStashy", style = Type.Label.copy(color = Palette.Gold))
        }
        Spacer(Modifier.weight(1f))
        Row(Modifier.glass(22.dp).padding(horizontal = 14.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Currency(Palette.GoldBright, "170"); Currency(Color(0xFFB8C7D9), "13"); Currency(Color(0xFFE5B84A), "7"); Currency(Color(0xFFE0663F), "2")
        }
    }
}

@Composable
private fun Currency(color: Color, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(14.dp).clip(CircleShape).background(Brush.radialGradient(listOf(color, color.copy(alpha = .55f)))).border(1.dp, Color(0x66000000), CircleShape))
        Text(value, style = Type.Label)
    }
}

@Composable
private fun ModeTiles(decks: DemoDecks, ready: Boolean, engine: ForgeService.Status, onQuickPlay: () -> Unit, columns: Int) {
    val tiles = listOf(
        Tile("Multiplayer", "Your deck vs. a friend.", decks.image(decks.homeArt[0], true), null),
        Tile("Quick Play", when (engine) {
            is ForgeService.Status.Ready -> "Your deck vs. CPU."
            is ForgeService.Status.Loading -> engine.step + "…"
            is ForgeService.Status.Failed -> "Engine unavailable"
            else -> "Starting…"
        }, decks.image(decks.homeArt[1], true), if (ready) onQuickPlay else null),
        Tile("Practice", "Test decks and rules.", decks.image(decks.homeArt[2], true), null),
        Tile("Planeswalk", "A roguelike MTG adventure.", "play/planeswalk-tile.jpg", null),
    )
    tiles.chunked(columns).forEach { row ->
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            row.forEach { t -> ModeTile(t, Modifier.weight(1f), live = t.title == "Quick Play") }
        }
    }
}

private data class Tile(val title: String, val line: String, val art: String?, val onClick: (() -> Unit)?)

@Composable
private fun ModeTile(t: Tile, modifier: Modifier, live: Boolean) {
    val shape = RoundedCornerShape(14.dp)
    Box(modifier.aspectRatio(.95f).alpha(if (live) 1f else .42f).clip(shape)
        .border(if (live) 1.5.dp else 1.dp, if (live) Palette.Gold else Palette.Hairline, shape)
        .let { m -> t.onClick?.let { m.clickable(onClick = it) } ?: m }) {
        AssetImage(t.art, Modifier.fillMaxSize(), maxWidth = 600)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, .45f to Color(0x33000000), 1f to Color(0xEE0A0A0C))))
        Column(Modifier.align(Alignment.BottomCenter).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(t.title, style = Type.Title.copy(fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(t.line, style = Type.Body.copy(color = Palette.Ink.copy(alpha = .85f)), textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun ShortcutRow(columns: Int) {
    val items = listOf("Decks" to "Build · Edit · Import", "Sets" to "Browse card sets", "Trunk" to "Your cards · Binders", "Shop" to "Packs · Seals · Cards")
    items.chunked(columns).forEach { row ->
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            row.forEach { (title, line) ->
                Column(Modifier.weight(1f).alpha(.42f).glass(12.dp).padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Text(title, style = Type.Title.copy(fontSize = 15.sp)); Text(line, style = Type.Body)
                }
            }
        }
    }
}

@Composable
private fun ProfilePanel() {
    Row(Modifier.fillMaxWidth().glass().padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(48.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Color(0xFF6B2A2A), Color(0xFF1B1B1F)))).border(1.5.dp, Palette.Gold, CircleShape), contentAlignment = Alignment.Center) {
            Text("R", style = Type.Title)
        }
        Column(Modifier.weight(1f)) {
            Text("Randall", style = Type.Title.copy(fontSize = 17.sp))
            Text("Native test build", style = Type.Body)
        }
    }
}

@Composable
private fun TrunkPanel() {
    Column(Modifier.fillMaxWidth().alpha(.42f).glass().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Trunk progress", style = Type.Title.copy(fontSize = 15.sp))
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(Color(0x33FFFFFF))) {
            Box(Modifier.fillMaxWidth(.58f).height(6.dp).background(Palette.Gold))
        }
    }
}
