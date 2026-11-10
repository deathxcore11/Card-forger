package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.graphicsLayer
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.Speed
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.match.DemoDecks
import dev.cardstashy.nativeplay.match.EngineNames
import dev.cardstashy.nativeplay.match.Pick
import dev.cardstashy.nativeplay.match.Plate
import dev.cardstashy.nativeplay.match.QuickPlay
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.runtime.collectAsState

/**
 * Quick Play: your decks from your account, grouped by the format they play in, then the demo
 * decks. The CPU plays a random tournament list of the same format.
 */
@Composable
fun DeckPickScreen(onPick: (Pick) -> Unit, onBack: () -> Unit, onSignIn: () -> Unit) {
    val context = LocalContext.current
    val demos = DemoDecks.load(context)
    val session by Account.session.collectAsState()
    val mine by Decks.decks.collectAsState()
    val error by Decks.error.collectAsState()
    val speed by Speed.last.collectAsState()
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(mine) { mine?.takeIf { it.isNotEmpty() }?.let { QuickPlay.warmInBackground(context, it) } }
    Backdrop("play/playmat-charcoal-table.webp", dim = .5f) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) { Text("‹", style = Type.Title.copy(fontSize = 28.sp)) }
                Text("Quick Play", style = Type.Title.copy(fontSize = 22.sp), modifier = Modifier.weight(1f))
                if (session == null) Text("Sign in", style = Type.Label.copy(color = Palette.Gold), modifier = Modifier.clip(RoundedCornerShape(16.dp)).clickable(onClick = onSignIn).padding(horizontal = 12.dp, vertical = 8.dp))
            }
            LazyVerticalGrid(GridCells.Adaptive(190.dp), Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                fun header(text: String) = item(span = { GridItemSpan(maxLineSpan) }) { Text(text, style = Type.Title.copy(fontSize = 15.sp, color = Palette.Gold), modifier = Modifier.padding(top = 6.dp)) }
                when {
                    session == null -> item(span = { GridItemSpan(maxLineSpan) }) {
                        Row(Modifier.fillMaxWidth().glass().clickable(onClick = onSignIn).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) { Text("Play your own decks", style = Type.Title.copy(fontSize = 17.sp)); Text("Sign in with your CardStashy account and every deck you saved shows up here.", style = Type.Body) }
                            Text("Sign in", style = Type.Label.copy(color = Palette.Gold))
                        }
                    }
                    mine == null -> item(span = { GridItemSpan(maxLineSpan) }) { Text(error ?: "Loading your decks…", style = Type.Body) }
                    mine!!.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) { Text("No saved Magic decks yet. Build one on cardstashy.com and it shows up here.", style = Type.Body) }
                    else -> mine!!.groupBy { QuickPlay.formatOf(it) }.toSortedMap(compareBy { QuickPlay.ForgeFormats.indexOf(it) }).forEach { (format, list) ->
                        header(format)
                        items(list, key = { it.id }) { d ->
                            val note = if (!d.format.equals(format, true) && !(format == "Commander" && d.format.equals("edh", true))) " · plays as $format" else ""
                            DeckTile(d.name, "${d.count} cards$note", d.face?.let(EngineNames::name)) { onPick(Pick.Mine(d)) }
                        }
                    }
                }
                header("Demo decks · ${demos.format}")
                items(demos.decks, key = { "demo:" + it.id }) { d -> DeckTile(d.name, "${d.count} cards", d.face) { onPick(Pick.Demo(d, demos)) } }
                if (speed.isNotEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { Text(Speed.line(), style = Type.Body.copy(fontSize = 11.sp), modifier = Modifier.padding(top = 8.dp)) }
            }
        }
    }
}

@Composable
private fun DeckTile(name: String, line: String, face: String?, onClick: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Box(Modifier.aspectRatio(1.4f).clip(shape).border(1.dp, Palette.Gold.copy(alpha = .8f), shape).background(Palette.PanelBottom).clickable(onClick = onClick)) {
        CardImage(face, Modifier.fillMaxSize(), crop = true)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, .45f to Color(0x22000000), 1f to Color(0xF00A0A0C))))
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp)) {
            Text(name, style = Type.Title.copy(fontSize = 16.sp), maxLines = 2)
            Text(line, style = Type.Label.copy(color = Palette.Gold, fontSize = 12.sp))
        }
    }
}

/** The versus beat: your deck against the CPU's while the engine opens the match and both decks' pictures load. */
@Composable
fun VersusScreen(you: Plate, cpu: Plate?, intro: Boolean = true, preparing: Boolean = false) {
    // intro = false when the beat is already on screen (the CPU's plate arrives into it).
    val a = remember { Animatable(if (intro) 0f else 1f) }
    LaunchedEffect(Unit) { a.animateTo(1f, tween(700)) }
    val b = remember { Animatable(0f) }
    LaunchedEffect(cpu != null) { if (cpu != null) b.animateTo(1f, tween(400)) }
    Backdrop("play/playmat-charcoal-table.webp", dim = .55f) {
        Row(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            PlateView(you, Modifier.weight(1f).alpha(a.value))
            Box(Modifier.size(72.dp).scale(.6f + .4f * a.value).clip(CircleShape).background(Brush.radialGradient(listOf(Palette.GoldBright, Palette.GoldDeep))).border(2.dp, Color(0xFF3A2A10), CircleShape), contentAlignment = Alignment.Center) {
                Text("VS", style = Type.Title.copy(color = Color(0xFF1B140A), fontSize = 24.sp))
            }
            if (cpu != null) PlateView(cpu, Modifier.weight(1f).alpha(a.value * b.value))
            else Box(Modifier.weight(1f).aspectRatio(1.35f).clip(RoundedCornerShape(16.dp)).border(1.5.dp, Palette.Hairline, RoundedCornerShape(16.dp)).alpha(a.value), contentAlignment = Alignment.Center) {
                Text("Finding an opponent…", style = Type.Label.copy(color = Palette.InkSoft))
            }
        }
        // The art gate (spec 12): a thin gold bar while both decks' pictures load; the table opens when they're in.
        if (preparing) {
            val p by dev.cardstashy.nativeplay.art.CardArt.warmProgress.collectAsState()
            val shown by androidx.compose.animation.core.animateFloatAsState(p, tween(240), label = "gate")
            Column(Modifier.align(Alignment.BottomCenter).windowInsetsPadding(WindowInsets.safeDrawing).padding(bottom = 22.dp), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Preparing the table", style = Type.Label.copy(color = Palette.InkSoft))
                Box(Modifier.width(220.dp).height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x33FFFFFF))) {
                    Box(Modifier.fillMaxWidth(shown).fillMaxHeight().background(Brush.horizontalGradient(listOf(Palette.GoldDeep, Palette.GoldBright))))
                }
            }
        }
    }
}

@Composable
private fun PlateView(p: Plate, modifier: Modifier) {
    val shape = RoundedCornerShape(16.dp)
    // Spec 12a: no plate until its cover is decoded (looked up first if it has to be), 4 s at most; then it fades in, never empty.
    val context = androidx.compose.ui.platform.LocalContext.current
    var ready by remember(p.face) { mutableStateOf(p.face == null) }
    LaunchedEffect(p.face) {
        val face = p.face ?: return@LaunchedEffect
        kotlinx.coroutines.withTimeoutOrNull(4000) {
            var url = dev.cardstashy.nativeplay.art.CardArt.url(face, crop = true)
            if (url == null) { dev.cardstashy.nativeplay.art.CardArt.resolve(listOf(face to com.google.gson.JsonObject().apply { addProperty("name", face) })); url = dev.cardstashy.nativeplay.art.CardArt.url(face, crop = true) }
            if (url != null) dev.cardstashy.nativeplay.art.CardArt.loader.execute(dev.cardstashy.nativeplay.art.CardArt.request(context, url, true))
        }
        ready = true
    }
    val show by androidx.compose.animation.core.animateFloatAsState(if (ready) 1f else 0f, tween(260), label = "plate")
    Box(modifier.aspectRatio(1.35f).graphicsLayer { alpha = show }.clip(shape).border(1.5.dp, Palette.Gold, shape).background(Palette.PanelBottom)) {
        CardImage(p.face, Modifier.fillMaxSize(), crop = true)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 1f to Color(0xEE0A0A0C))))
        Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
            Text(p.who, style = Type.Label.copy(color = Palette.Gold)); Text(p.name, style = Type.Title, maxLines = 2)
            // .forge-intro-power: 12 px, bold, .04em, #f0c27a.
            if (p.line.isNotEmpty()) Text(p.line, style = Type.Label.copy(color = Color(0xFFF0C27A), fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = .48.sp), modifier = Modifier.padding(top = 2.dp))
        }
    }
}
