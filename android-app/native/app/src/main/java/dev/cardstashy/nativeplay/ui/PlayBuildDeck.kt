package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.RandomBuild
import kotlinx.coroutines.launch

/**
 * Play › Decks › Random deck as the website's Build a deck (deck-experience.js; Randall 5 Nov 23:18Z: "hit random commander or random
 * deck and it does what that video does", 23:19Z "make it pretty and cool", preview approved 23:34Z). A build-around card fills the top:
 * 🎲 New card is the site's Random card (app.js randomBuildSeed), Change card resolves a typed name. Format, Theme, a Commander bracket,
 * Power and the Preferences the site offers (match mode, simpler plans) are chips; Forge this deck runs Deck Forge around that card
 * (RandomBuild, the phone's WebView) and the deck opens on Play's deck page. Play is price-free, so no Budget. A deck the background
 * queue already finished for this format and power is offered first: Forge with nothing changed hands it over at once.
 */
@Composable
fun PlayBuildDeckSheet(onClose: () -> Unit, user: String? = null, onDeck: (JsonObject, String) -> Unit, initialFormat: String = "Standard",
                       pick: suspend (String, String?) -> JsonObject? = { f, th -> RandomBuild.card(f, th) },
                       named: suspend (String) -> JsonObject? = { RandomBuild.named(it) },
                       queued: suspend (String) -> List<JsonObject> = { RandomBuild.ready(it) },
                       themes: suspend () -> List<String> = { RandomBuild.themes() }) {
    val build by RandomBuild.state.collectAsState()
    val io = rememberCoroutineScope()
    var format by remember { mutableStateOf(initialFormat) }; var bracket by remember { mutableStateOf<Int?>(null) }
    var power by remember { mutableStateOf("casual") }; var theme by remember { mutableStateOf("") }
    var matchMode by remember { mutableStateOf("unspecified") }; var easy by remember { mutableStateOf(false) }
    var more by remember { mutableStateOf(false) }
    var card by remember { mutableStateOf<JsonObject?>(null) }; var picking by remember { mutableStateOf(false) }; var cardError by remember { mutableStateOf<String?>(null) }
    // The card came from a deck the queue already built (its build-around), for this format and power: unchanged, Forge takes that deck.
    var queuedFor by remember { mutableStateOf<String?>(null) }
    var naming by remember { mutableStateOf(false) }; var name by remember { mutableStateOf("") }; var byName by remember { mutableStateOf(false) }
    var themeList by remember { mutableStateOf<List<String>>(emptyList()) }
    var started by remember { mutableStateOf(false) }
    // Deck Forge's power (play-opponent-build.js): a Commander bracket of 3 or more always builds strong.
    val strongBracket = format == "Commander" && (bracket ?: 0) >= 3
    val powerNow = if (strongBracket) "strong" else power
    val reduced = Playmats.reduced(LocalContext.current)

    fun reroll() {
        if (picking) return
        picking = true; cardError = null; byName = false; queuedFor = null
        io.launch { val c = pick(format, theme.ifBlank { null }); picking = false
            if (c != null) card = c else cardError = "No build-around came back. Check your connection and try 🎲 New card again." }
    }
    LaunchedEffect(Unit) { themeList = runCatching { themes() }.getOrDefault(emptyList()) }
    // A new format draws its own build-around: a deck the queue holds for it (at this power) first, else the site's Random card.
    // Power, theme or bracket changes keep the card; the deck is then built fresh around it.
    LaunchedEffect(format) {
        if (byName) return@LaunchedEffect
        val q = runCatching { queued(format) }.getOrDefault(emptyList()).firstOrNull { d ->
            val r = d.getAsJsonObject("practiceBuild")?.getAsJsonObject("request")
            r?.getAsJsonObject("forge")?.get("power")?.asString == powerNow && r.get("targetBracket")?.isJsonNull != false && r.get("seedCard")?.isJsonObject == true }
        val seed = q?.getAsJsonObject("practiceBuild")?.getAsJsonObject("request")?.getAsJsonObject("seedCard")
        if (seed != null) { card = seed; cardError = null; queuedFor = format + "|" + powerNow } else reroll()
    }
    LaunchedEffect(build.deck, build.busy, started) { val d = build.deck; if (started && !build.busy && d != null) { started = false; onDeck(d.deepCopy(), format) } }
    androidx.activity.compose.BackHandler { if (build.busy) RandomBuild.cancel(); onClose() }

    fun forge() {
        val c = card
        val fromQueue = queuedFor == format + "|" + powerNow && bracket == null && theme.isBlank() && matchMode == "unspecified" && !easy
        started = true
        if (fromQueue) RandomBuild.start(format, null, "classic", powerNow, user)
        else RandomBuild.start(format, if (format == "Commander") bracket else null, "classic", powerNow, user,
            RandomBuild.Choice(seedCard = c, seed = if (c == null) name else null, theme = theme, matchMode = matchMode, easy = easy))
    }

    Box(Modifier.fillMaxSize().background(Color(0xB3000000)).clickable(interactionSource = null, indication = null) { if (!build.busy) onClose() }) {
        val sheet = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)
        Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 22.dp).fillMaxSize().clip(sheet).background(BdSheet)
            .border(1.dp, Brush.verticalGradient(listOf(Color(0x66E9C27A), Color(0x14E9C27A), Color(0x05FFFFFF))), sheet)
            .clickable(interactionSource = null, indication = null) {}) {
            AnimatedContent(started && build.busy, transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(160)) }, label = "forge") { forging ->
                if (forging) Forging(card, build.status, reduced) { RandomBuild.cancel(); started = false }
                else Column(Modifier.fillMaxSize()) {
                    Hero(card, picking, onClose)
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 10.dp, bottom = 12.dp).animateContentSize(),
                        verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Pill("🎲  New card", gold = true, enabled = !picking) { naming = false; reroll() }
                            Pill(if (naming) "Close" else "Change card") { naming = !naming }
                        }
                        if (naming) NameRow(name, { name = it }) {
                            val n = name.trim(); if (n.isEmpty()) return@NameRow
                            picking = true; cardError = null
                            io.launch { val c = named(n); picking = false
                                if (c != null) { card = c; byName = true; queuedFor = null; naming = false } else cardError = "No card called \"$n\" was found. Check the spelling." }
                        }
                        cardError?.let { Text(it, style = bt(12.5f, color = BdWarn)) }
                        Section("Format") { FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            RandomBuild.FORMATS.forEach { f -> ShelfChip(f, format == f) { if (format != f) { format = f; byName = false; if (f != "Commander") bracket = null } } } } }
                        if (themeList.isNotEmpty()) Section("Theme · optional") {
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                ShelfChip("No preference", theme.isBlank()) { theme = "" }
                                themeList.forEach { th -> ShelfChip(th, theme == th) { theme = if (theme == th) "" else th; queuedFor = null } } } }
                        if (format == "Commander") Section("Aim for bracket") { FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            (listOf<Int?>(null) + (1..5)).forEach { b -> ShelfChip(b?.toString() ?: "Any", bracket == b) { bracket = b } } } }
                        Section(if (strongBracket) "Power · brackets 3 and up build Strong" else "Power") { Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("casual" to "Casual", "strong" to "Strong").forEach { (k, l) -> ShelfChip(l, powerNow == k) { if (!strongBracket) power = k } } } }
                        // deck-experience.js Preferences, less what is about prices (Budget rule, Budget covers, owned-card limits: Play has its Trunk and seals).
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x0BFFFFFF)).border(1.dp, SoftRim, RoundedCornerShape(14.dp))) {
                            Row(Modifier.fillMaxWidth().clickable { more = !more }.padding(horizontal = 12.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("More choices", style = bt(13.5f, FontWeight.Bold), modifier = Modifier.weight(1f))
                                Text(listOfNotNull(MATCH_MODES.first { it.first == matchMode }.second.takeIf { matchMode != "unspecified" }, "Simpler plans".takeIf { easy }).joinToString(" · ").ifBlank { "Match mode, simpler plans" } + if (more) "  ˄" else "  ›",
                                    style = bt(12f, color = Site.Muted))
                            }
                            if (more) Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Section("Match mode") { FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    MATCH_MODES.forEach { (k, l) -> ShelfChip(l, matchMode == k) { matchMode = k } } } }
                                ShelfChip(if (easy) "✓ Prefer simpler plans" else "Prefer simpler plans", easy) { easy = !easy }
                            }
                        }
                        build.error?.takeIf { !build.busy && it != "cancelled" }?.let { Text(it, style = bt(12.5f, color = BdWarn)) }
                    }
                    GoldCta(if (picking) "Choosing your card…" else "Forge this deck", Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 14.dp)
                        .windowInsetsPadding(WindowInsets.navigationBars).height(52.dp), enabled = !picking && (card != null || name.isNotBlank()), radius = 16.dp) { forge() }
                }
            }
        }
    }
}

private val MATCH_MODES = listOf("unspecified" to "Not specified", "bo1" to "Best of one", "bo3" to "Best of three")
private val BdSheet = Color(0xFF171A20)
private val BdGold = Color(0xFFF0C66D)
private val BdGoldHi = Color(0xFFFFF3C9)
private val BdWarn = Color(0xFFFFB86B)
private val BdOk = Color(0xFF6FD3A0)
private fun bt(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Site.Text) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = (size * 1.35f).sp, color = color)
private fun label(size: Float = 10.5f) = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = size.sp, letterSpacing = 1.5.sp, color = Site.Muted)

private fun JsonObject.str(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
private fun JsonObject.face0() = getAsJsonArray("card_faces")?.firstOrNull()?.takeIf { it.isJsonObject }?.asJsonObject
/** The card's image (Scryfall image_uris, or its front face's): art_crop for the hero, normal for the card itself. */
private fun JsonObject.image(kind: String) = (getAsJsonObject("image_uris") ?: face0()?.getAsJsonObject("image_uris"))?.get(kind)?.takeIf { it.isJsonPrimitive }?.asString
private fun JsonObject.typeLine() = str("type_line").ifBlank { face0()?.str("type_line") ?: "" }

@Composable
private fun Hero(card: JsonObject?, picking: Boolean, onClose: () -> Unit) {
    Box(Modifier.fillMaxWidth().height(214.dp)) {
        val p = heroPainter(card?.image("art_crop")?.let(homeArt))
        if (p != null) Image(p, card?.str("name"), Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF2A2318), Color(0xFF171A20)))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x00171A20), .4f to Color(0x00171A20), .8f to Color(0xD1171A20), 1f to BdSheet)))
        Box(Modifier.align(Alignment.TopCenter).padding(top = 8.dp).size(38.dp, 4.dp).clip(CircleShape).background(Color(0x59FFFFFF)))
        Box(Modifier.align(Alignment.TopEnd).padding(12.dp).size(36.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x8C0A0C10)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(12.dp))
            .clickable(onClick = onClose).semantics { contentDescription = "Close" }, contentAlignment = Alignment.Center) { Text("✕", style = bt(14f)) }
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("YOUR BUILD-AROUND", style = label().copy(color = BdGold))
            Text(if (picking) "Choosing your card…" else card?.str("name") ?: "Pick a card", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 23.sp, lineHeight = 26.sp, color = Site.Text),
                maxLines = 2, overflow = TextOverflow.Ellipsis)
            card?.typeLine()?.takeIf { it.isNotBlank() && !picking }?.let { Text(it, style = bt(12f, color = Color(0xFFC9CDD5)), maxLines = 1, overflow = TextOverflow.Ellipsis) }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) = Column(verticalArrangement = Arrangement.spacedBy(7.dp)) { Text(title.uppercase(), style = label()); content() }

@Composable
private fun Pill(text: String, gold: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Box(Modifier.height(38.dp).clip(shape).background(Color(0x0BFFFFFF)).border(1.dp, if (gold) SolidColor(Color(0x73F0C66D)) else SoftRim, shape)
        .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 15.dp), contentAlignment = Alignment.Center) {
        Text(text, style = bt(13.5f, FontWeight.Bold, if (gold) BdGoldHi else Site.Text)) }
}

@Composable
private fun NameRow(value: String, onValue: (String) -> Unit, onUse: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF1F232B)).border(1.dp, Color(0xFF353B46), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp),
            contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) Text("Card name", style = bt(14f, color = Site.Muted))
            BasicTextField(value, onValue, singleLine = true, textStyle = bt(14f), cursorBrush = SolidColor(BdGold), modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { onUse() }))
        }
        Pill("Use", gold = true, onClick = onUse)
    }
}

/** While Deck Forge builds: the card floats in a turning gold rim with rising motes, its live status in gold, and where it is in the build. */
@Composable
private fun Forging(card: JsonObject?, status: String, reduced: Boolean, onCancel: () -> Unit) {
    // Still (shots, Motion.still): one frame of the same motion. Reduced motion: no turning, floating or motes.
    val still = Motion.still || reduced
    val spin = if (still) null else rememberInfiniteTransition(label = "forge")
    val turn = spin?.animateFloat(0f, 360f, infiniteRepeatable(tween(2600, easing = LinearEasing)), label = "turn")?.value ?: 300f
    val bob = spin?.animateFloat(0f, 1f, infiniteRepeatable(tween(2000), RepeatMode.Reverse), label = "bob")?.value ?: .5f
    val rise = spin?.animateFloat(0f, 1f, infiniteRepeatable(tween(3200, easing = LinearEasing)), label = "rise")?.value ?: .3f
    // The builder's own status lines (deck-pipeline.js, deck-forge.js) in order: the plan, the cards, the engine upgrades, the final checks.
    val step = when { status.startsWith("Checking the final") -> 3; status.startsWith("Testing engine") -> 2; status.startsWith("Finding cards") -> 1; else -> 0 }
    Column(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF2A2114), Color(0xFF14161C), Color(0xFF0B0D11)), radius = 1400f)).padding(horizontal = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterVertically)) {
        Box(Modifier.width(212.dp).aspectRatio(63f / 88f).drawBehind {
            val r = 14.dp.toPx(); val pad = 10.dp.toPx()
            drawCircle(Brush.radialGradient(listOf(Color(0x47F0C66D), Color(0x00F0C66D)), center = center, radius = size.maxDimension * .75f), radius = size.maxDimension * .75f,
                alpha = if (reduced) .8f else .55f + .45f * bob)
            // The rim: a faint gold ring, and a bright comet running round it (a turning sweep, clipped to the ring).
            val w = 4.dp.toPx()
            drawRoundRect(Color(0x40F0C66D), Offset(-pad, -pad), Size(size.width + 2 * pad, size.height + 2 * pad), CornerRadius(r + pad), style = Stroke(1.5.dp.toPx()))
            if (!reduced) {
                val ring = androidx.compose.ui.graphics.Path().apply {
                    addRoundRect(androidx.compose.ui.geometry.RoundRect(-pad - w / 2, -pad - w / 2, size.width + pad + w / 2, size.height + pad + w / 2, CornerRadius(r + pad + w / 2)))
                    addRoundRect(androidx.compose.ui.geometry.RoundRect(-pad + w / 2, -pad + w / 2, size.width + pad - w / 2, size.height + pad - w / 2, CornerRadius(r + pad - w / 2)))
                    fillType = androidx.compose.ui.graphics.PathFillType.EvenOdd
                }
                clipPath(ring) { rotate(turn) {
                    drawCircle(Brush.sweepGradient(0f to Color(0x00FFE7A6), .42f to Color(0x00FFE7A6), .8f to Color(0xFFFFF3C9), .835f to Color(0x00FFE7A6), 1f to Color(0x00FFE7A6), center = center),
                        radius = size.maxDimension, center = center)
                } }
            }
        }, contentAlignment = Alignment.Center) {
            val p = heroPainter(card?.image("normal")?.let(homeArt))
            Box(Modifier.width(186.dp).aspectRatio(63f / 88f).graphicsLayer { if (!reduced) { translationY = -6.dp.toPx() * bob; rotationZ = -.6f * bob } }
                .clip(RoundedCornerShape(10.dp)).background(Color(0xFF1F232B))) {
                if (p != null) Image(p, card?.str("name"), Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else BrandMark(56.dp, Modifier.align(Alignment.Center))
            }
            if (!reduced) Canvas(Modifier.fillMaxSize()) {
                listOf(.2f to 0f, .72f to .28f, .48f to .53f, .86f to .75f, .08f to .38f).forEach { (x, delay) ->
                    val t = (rise + delay) % 1f; val a = if (t < .2f) t / .2f else 1f - (t - .2f) / .8f
                    val c = Offset(size.width * x, size.height * (1.02f - .55f * t))
                    drawCircle(Color(0x66F0C66D), 7.dp.toPx(), c, alpha = a * .5f); drawCircle(BdGoldHi, 2.5.dp.toPx(), c, alpha = a)
                }
            }
        }
        Text("Forging your deck", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Site.Text))
        Text(status.ifBlank { "Choosing a build-around…" }, style = bt(13.5f, FontWeight.Bold, BdGold).copy(textAlign = TextAlign.Center), modifier = Modifier.height(40.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("Plan", "Cards", "Upgrades", "Checks").forEachIndexed { i, s ->
                val shape = RoundedCornerShape(999.dp)
                Box(Modifier.clip(shape).background(if (i == step) Brush.verticalGradient(listOf(Color(0xFF3A3020), Color(0xFF2A2416))) else SolidColor(Color(0xFF1F232B)))
                    .border(1.dp, when { i < step -> Color(0x666FD3A0); i == step -> Color(0xB3F0C66D); else -> Color(0xFF353B46) }, shape).padding(horizontal = 10.dp, vertical = 5.dp)) {
                    Text((if (i < step) "✓ " else "") + s, style = bt(11.5f, FontWeight.ExtraBold, when { i < step -> BdOk; i == step -> BdGoldHi; else -> Site.Muted }))
                }
            }
        }
        Pill("Cancel build", onClick = onCancel)
        Text("Your deck opens here when it's ready.", style = bt(12f, color = Site.Muted))
        Spacer(Modifier.height(20.dp))
    }
}
