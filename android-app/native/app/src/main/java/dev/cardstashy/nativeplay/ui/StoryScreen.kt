package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.first
import androidx.compose.foundation.gestures.scrollBy
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.StoryLogic

/**
 * Story (Play › Story): the road of acts and one act's battles, ported from story-ui.js storyHomeMarkup and storyActMarkup
 * (parity checklist SY-06 to SY-10). Progress comes from the server's story refs; the act's battles from /data/story/act-n.json.
 */
private val storyGold: Color get() = Site.Gold
private val ink: Color get() = if (AppSettings.theme == "light") Site.Text else Color(0xFFF6EEDB)
internal fun storyText(size: Float, weight: FontWeight = FontWeight.Bold, color: Color = Site.Text, ls: Float = 0f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = (size * 1.35f).sp, color = color, letterSpacing = ls.sp)
internal fun storyCinzel(size: Float, color: Color = ink) = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, lineHeight = (size * 1.2f).sp, color = color, letterSpacing = .03.sp)

/** "50% 30%" → the image alignment the site's background-position means. */
internal fun storyFocus(f: String?): BiasAlignment {
    val p = (f ?: "50% 30%").split(" ").mapNotNull { it.removeSuffix("%").toFloatOrNull() }
    return BiasAlignment((p.getOrElse(0) { 50f } / 50f) - 1f, (p.getOrElse(1) { 30f } / 50f) - 1f)
}

@Composable
internal fun StoryPic(url: String?, modifier: Modifier, align: Alignment = BiasAlignment(0f, -.4f)) {
    if (url.isNullOrBlank() || StoryTest.noPictures) { Box(modifier.background(Color(0xFF1B1B20))); return }
    StoryTest.art?.invoke(url)?.let { androidx.compose.foundation.Image(it, null, modifier, contentScale = ContentScale.Crop, alignment = align); return }
    coil3.compose.AsyncImage(url, null, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader, modifier = modifier, contentScale = ContentScale.Crop, alignment = align)
}

object StoryTest { @Volatile var noPictures = false; @Volatile var art: ((String) -> androidx.compose.ui.graphics.ImageBitmap?)? = null }

/** The star path of story-ui.js, 24-unit grid. */
@Composable
private fun StarIcon(on: Boolean, size: Dp = 17.dp) {
    Box(Modifier.size(size).drawBehind {
        val k = this.size.width / 24f
        val p = Path().apply { moveTo(12f * k, 2.8f * k); lineTo(14.7f * k, 8.4f * k); lineTo(20.8f * k, 9.2f * k); lineTo(16.3f * k, 13.4f * k); lineTo(17.4f * k, 19.4f * k); lineTo(12f * k, 16.5f * k); lineTo(6.6f * k, 19.4f * k); lineTo(7.7f * k, 13.4f * k); lineTo(3.2f * k, 9.2f * k); lineTo(9.3f * k, 8.4f * k); close() }
        drawPath(p, if (on) storyGold else Color(0x1CFFFFFF))
        drawPath(p, if (on) Color(0xFFF6DFA8) else Color(0x33FFFFFF), style = Stroke(1f * k))
    })
}

@Composable
internal fun StarsRow(rec: Set<String>?, size: Dp = 17.dp) {
    val slots = listOf("loaner", "loaner", "loaner", "own", "villain")
    val have = StoryLogic.STAR_KEYS.sumOf { if (rec?.contains(it) == true) StoryLogic.STAR_VALUE.getValue(it) else 0 }
    Row(Modifier.semantics { contentDescription = "$have of 5 stars" }, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        // Three loaner stars light together, then your own deck's, then the villain side's (story-ui.js STAR_SLOTS).
        slots.forEachIndexed { i, k -> StarIcon(rec?.contains(k) == true, size) }
    }
}

/** Battles won of 8, a ring with the count. */
@Composable
private fun Ring(done: Int, total: Int, ring: Dp = 52.dp) {
    Box(Modifier.size(ring).semantics { contentDescription = "$done of $total battles won" }, contentAlignment = Alignment.Center) {
        Box(Modifier.size(ring).drawBehind {
            val s = 3.dp.toPx(); val r = Size(size.width - s, size.height - s)
            drawArc(Color(0x24FFFFFF), 0f, 360f, false, Offset(s / 2, s / 2), r, style = Stroke(s))
            drawArc(storyGold, -90f, 360f * done / total, false, Offset(s / 2, s / 2), r, style = Stroke(s, cap = StrokeCap.Round))
        })
        Row(verticalAlignment = Alignment.Bottom) { Text("$done", style = storyText(15f, color = Color(0xFFF6EEDB))); Text("/$total", style = storyText(11f, FontWeight.SemiBold, Color(0xFFAAB3BD)), modifier = Modifier.padding(bottom = 1.dp)) }
    }
}

/** Set symbols per act (not leb or 2ed), Scryfall's black SVGs lit gold. */
@Composable
private fun Symbols(sets: List<Pair<String, String>>) {
    val tint = androidx.compose.ui.graphics.ColorFilter.tint(Color(0xFFE8C36F))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.heightIn(min = 22.dp)) {
        sets.filter { it.first != "leb" && it.first != "2ed" }.forEach { (code, name) ->
            if (StoryTest.noPictures) Box(Modifier.size(22.dp)) else
            coil3.compose.AsyncImage("https://svgs.scryfall.io/sets/$code.svg", name, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader, modifier = Modifier.size(22.dp), contentScale = ContentScale.Fit, colorFilter = tint)
        }
    }
}

private val CtaTop = Color(0xFFF2D18E); private val CtaBottom = Color(0xFFC99A4B); private val CtaEdge = Color(0xFFF6DFA8); private val CtaInk = Color(0xFF1B1408)
@Composable
private fun Cta(text: String, modifier: Modifier = Modifier) =
    Box(modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(20.dp)).background(Brush.verticalGradient(listOf(CtaTop, CtaBottom))).border(1.dp, CtaEdge, RoundedCornerShape(20.dp)).padding(horizontal = 20.dp), contentAlignment = Alignment.Center) {
        Text(text, style = storyText(14f, FontWeight.ExtraBold, CtaInk)) }

/** The road: the age you're in as act covers. Cleared covers, the current one as the hero, one blurred tease, nothing after. */
@Composable
fun StoryRoad(acts: List<PlayRules.Act>, age: String, p: StoryLogic.Progress, onBack: () -> Unit, onAct: (Int) -> Unit, purse: @Composable () -> Unit = {}, wallet: @Composable () -> Unit = purse) {
    val now = StoryLogic.currentAct(p, acts.size)
    val shown = acts.filter { it.act <= now + 1 }
    // Bottom screen: the act under the ring (teased acts stay hidden), else the one you are in.
    val lens = rememberLens()
    BottomScreen {
        val n = lens.key?.removePrefix("act:")?.toIntOrNull()?.takeIf { it <= now } ?: now.coerceAtMost(acts.size)
        acts.firstOrNull { it.act == n }?.let { a ->
            val cta = CaseButton("A", if (a.act < now || StoryLogic.actCleared(p, a.act)) "Open" else if (StoryLogic.actWon(p, a.act) > 0) "Continue" else "Begin", gold = true) { onAct(a.act) }
            StoryBottom(a, null, p, null, a.act == now, cta, null, wallet)
        }
    }
    // Controller: X = the act you are in, with its cover's own words (Begin / Continue).
    PadScreen(PadActs(x = if (acts.any { it.act == now }) PadAct(if (StoryLogic.actWon(p, now) > 0) "Continue" else "Begin") { onAct(now) } else null))
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
    // Sideways phone or handheld: the header on one line and the act covers in a row that scrolls across.
    if (sideways()) Column(Modifier.fillMaxSize().padding(top = top + 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(Modifier.weight(1f)) { PageHeader("Story", "Play", onBack = onBack) }
            Box(Modifier.weight(1.3f)) { purse() }
        }
        Text(age.uppercase(), Modifier.padding(horizontal = 16.dp), style = storyText(12f, FontWeight.ExtraBold, storyGold, 3.4f))
        val start = shown.indexOfFirst { it.act == now }.coerceAtLeast(0)
        androidx.compose.foundation.lazy.LazyRow(Modifier.fillMaxWidth().weight(1f), state = androidx.compose.foundation.lazy.rememberLazyListState(start),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            shown.forEach { a ->
                item("act${a.act}") {
                    val won = StoryLogic.actWon(p, a.act); val done = StoryLogic.actCleared(p, a.act); val here = a.act == now; val tease = a.act > now
                    Cover(a, won, done, here, tease, StoryLogic.actStars(p, a.act), Modifier.fillMaxHeight().aspectRatio(1.05f).dualLens(lens, "act:${a.act}")) { onAct(a.act) }
                }
            }
            if (now > acts.size) item("book") { Box(Modifier.fillMaxHeight().aspectRatio(1.4f)) { Book() } }
        }
    } else
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = top + 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item("head") { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { PageHeader("Story", "Play", onBack = onBack); purse() } }
        item("age") { Text(age.uppercase(), style = storyText(12f, FontWeight.ExtraBold, storyGold, 3.4f)) }
        shown.forEach { a ->
            item("act${a.act}") {
                val won = StoryLogic.actWon(p, a.act); val done = StoryLogic.actCleared(p, a.act); val here = a.act == now; val tease = a.act > now
                Cover(a, won, done, here, tease, StoryLogic.actStars(p, a.act), Modifier.fillMaxWidth().heightIn(min = 300.dp).aspectRatio(1.05f).dualLens(lens, "act:${a.act}")) { onAct(a.act) }
            }
        }
        if (now > acts.size) item("book") { Book() }
    }
    }
}

@Composable
private fun Cover(a: PlayRules.Act, won: Int, done: Boolean, here: Boolean, tease: Boolean, stars: Int, size: Modifier = Modifier.fillMaxWidth().heightIn(min = 300.dp).aspectRatio(1.05f), onClick: () -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    Box(size.clip(shape)
        .border(1.dp, if (here) Color(0xAAD6AD64) else Color(0x38D6AD64), shape)
        .then(if (tease) Modifier else Modifier.clickable(onClick = onClick))
        .semantics { contentDescription = "Act ${a.act}, ${a.name}. " + if (done) "Cleared" else "$won of 8 battles won" }) {
        StoryPic(a.art, Modifier.fillMaxSize().then(if (tease) Modifier.blur(8.dp) else Modifier), BiasAlignment(0f, -.4f))
        if (tease) Box(Modifier.fillMaxSize().background(Color(0x99000000)))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, .3f to Color.Transparent, .64f to Color(0xC40C0C0E), 1f to Color(0xF40C0C0E))))
        Column(Modifier.align(Alignment.BottomStart).padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Symbols(a.sets)
            Text("ACT ${a.act}", style = storyText(11f, FontWeight.ExtraBold, Color(0xFFE8B95B), 2.6f))
            Text(a.name, style = storyCinzel(26f, Color(0xFFF6EEDB)))
            if (!tease) Text(a.years, style = storyText(13f, FontWeight.Medium, Color(0xFFC9D0D8)))
            if (!tease) Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                if (here) { Ring(won, 8); Cta(if (won > 0) "Continue" else "Begin") }
                else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) { StarIcon(true, 18.dp); Text("$stars", style = storyText(14f, color = Color(0xFFF6EEDB))); Text("/40", style = storyText(12f, FontWeight.Medium, Color(0xFFAAB3BD))) }
            }
        }
    }
}

@Composable
private fun Book() {
    val shape = RoundedCornerShape(24.dp)
    Box(Modifier.fillMaxWidth().aspectRatio(1.4f).clip(shape).border(1.dp, Color(0x38D6AD64), shape).background(Brush.radialGradient(listOf(Color(0xFF2A2416), Color(0xFF0E0D0A))))) {
        Box(Modifier.align(Alignment.Center).size(96.dp, 128.dp).clip(RoundedCornerShape(4.dp, 10.dp, 10.dp, 4.dp)).border(2.dp, Color(0xFFD6AD64), RoundedCornerShape(4.dp, 10.dp, 10.dp, 4.dp)).background(Color(0xFF5A3F1C)))
        Column(Modifier.align(Alignment.BottomStart).padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("THE NEXT AGE", style = storyText(11f, FontWeight.ExtraBold, Color(0xFFE8B95B), 2.6f)); Text("The Weatherlight Saga", style = storyCinzel(26f, Color(0xFFF6EEDB))) }
    }
}

/** One act: its banner and the battles reached so far (cleared, the current one, then one tease; the secret row only when open). */
@Composable
fun StoryActPage(a: PlayRules.Act, data: JsonObject?, p: StoryLogic.Progress, onBack: () -> Unit, onBattle: (String) -> Unit, purse: @Composable () -> Unit = {}, wallet: @Composable () -> Unit = purse,
                 setNames: Map<String, String> = emptyMap(), onPlayAs: (String) -> Unit = onBattle) {
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val now = StoryLogic.currentBattle(p, a.act)
    val battles = data?.getAsJsonArray("battles")?.map { it.asJsonObject }.orEmpty()
    val cast = data?.getAsJsonObject("cast")
    val won = battles.count { it["secret"]?.asBoolean != true && StoryLogic.battleCleared(p, it["id"].asString) }
    val counters = StoryLogic.counters(dev.cardstashy.nativeplay.play.Progress.state.collectAsState().value)
    val open = battles.filter { b -> if (b["secret"]?.asBoolean == true) StoryLogic.secretOpen(p, a.act, counters) else b["slot"].asInt <= now + 1 }
    val tease = StoryLogic.secretTease(battles.any { it["secret"]?.asBoolean == true }, p, a.act, counters)
    // Controller: X = the battle you are on (its row's Duel / Replay).
    val current = open.firstOrNull { (it["secret"] as? com.google.gson.JsonPrimitive)?.asBoolean != true && (it["slot"] as? com.google.gson.JsonPrimitive)?.asInt == now }
    val currentId = (current?.get("id") as? com.google.gson.JsonPrimitive)?.asString
    PadScreen(PadActs(x = currentId?.let { id -> PadAct(if (StoryLogic.battleCleared(p, id)) "Replay" else "Duel") { onBattle(id) } }))
    // Bottom screen: the act by default, the battle under the ring (a teased one stays hidden).
    val lens = rememberLens()
    val shownIds = open.filter { b -> b["secret"]?.asBoolean == true || b["slot"].asInt <= now }.map { "battle:" + it["id"].asString }.toSet()
    BottomScreen {
        val cta = currentId?.let { id -> CaseButton("X", if (StoryLogic.battleCleared(p, id)) "Replay" else "Duel", gold = true) { onBattle(id) } }
        StoryBottom(a, data, p, lens.key?.takeIf { it in shownIds }, true, cta, onBattle, wallet)
    }
    // Second take (specs/story-act-and-collection-brief.md): what each battle offers now. Won battles are short rows with their
    // side's prize and "Play as"; the battle you are on is an open card with both decks, what's new and the prize.
    val ctx = LocalContext.current
    val lessons = remember { dev.cardstashy.nativeplay.play.StoryLessons.load(ctx).map }
    val stars = StoryLogic.actStars(p, a.act)
    val theirWins = battles.count { it["secret"]?.asBoolean != true && "villain" in (p.battles[it["id"].asString] ?: emptySet()) }
    // strip: 0 a phone (two deck boxes, chips, Win and Duel), 1 the Thor's top (Duel up top, three boxes, chips under),
    // 2 a tablet (Duel up top, four boxes in one strip).
    val row: @Composable (JsonObject, Int) -> Unit = { b, strip ->
        val id = b["id"].asString; val slot = b["slot"].asInt; val secret = b["secret"]?.asBoolean == true
        Box(Modifier.dualLens(lens, "battle:$id")) {
            when {
                secret || slot > now -> BattleRow(b, cast, p, now) { onBattle(id) }
                slot == now -> NowCard(b, cast, p, setNames, lessons, strip) { onBattle(id) }
                else -> WonRow(b, cast, p, setNames, strip > 0, { onBattle(id) }) { onPlayAs(id) }
            }
        }
    }
    // When the act opens, the battle you are on is scrolled fully into view (review of 736cbc54).
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()
    // Two panes: room after the last item, just enough that the list can rest with a whole row at its top (review of ceb91b17).
    var tail by androidx.compose.runtime.remember { androidx.compose.runtime.mutableIntStateOf(0) }
    LaunchedEffect(currentId, data != null) {
        val key = currentId ?: return@LaunchedEffect
        androidx.compose.runtime.snapshotFlow { listState.layoutInfo.totalItemsCount }.first { it > 0 }
        androidx.compose.runtime.withFrameNanos { }
        val info = listState.layoutInfo
        // Which list is showing is read from the list itself (the phone list starts with its "head" item): LocalConfiguration
        // can lag the window in a capture, which left the Thor's top on the phone path (picture review of b9e921b6).
        if (info.visibleItemsInfo.none { it.key == "head" }) {
            // Two panes (the header sits beside the list): start the list at the first row from which the current battle and the
            // row after it (the tease) both fit, so the top edge lands between rows and nothing is cut (reviews of a4f09acb, 613e7632).
            val pos = open.indexOfFirst { it["id"].asString == key }.coerceAtLeast(0)
            // Everything after the current battle (later rows, the tease) when it fits; otherwise just the row after it.
            val all = open.size - 1 + (if (tease != null) 1 else 0)
            // Real sizes: the rows above from the first layout, then the current battle and what follows after scrolling to it.
            val size = info.visibleItemsInfo.associate { it.index to it.size }.toMutableMap()
            val room = info.viewportEndOffset - info.viewportStartOffset - info.beforeContentPadding - info.afterContentPadding
            if (pos > 0) {
                listState.scrollToItem(pos); androidx.compose.runtime.withFrameNanos { }
                listState.layoutInfo.visibleItemsInfo.forEach { size[it.index] = it.size }
            }
            val guess = size.values.maxOrNull() ?: 0
            // The smallest start (the most rows above) from which the rows through the last one fit (review of 5e49c052).
            fun from(last: Int) = (0..pos).firstOrNull { i -> (i..last).sumOf { size[it] ?: guess } + info.mainAxisItemSpacing * (last - i) <= room }
            val start = from(all) ?: from(minOf(pos + 1, all)) ?: pos
            listState.scrollToItem(start); androidx.compose.runtime.withFrameNanos { }
            // At the end of the list the scroll clamps and the top lands mid-row: add the missing room below and scroll again.
            if (start > 0) {
                val gap = listState.layoutInfo.visibleItemsInfo.firstOrNull { it.index == start }?.offset ?: 0
                if (gap > 0) { tail = gap; androidx.compose.runtime.withFrameNanos { }; listState.scrollToItem(start) }
            }
            return@LaunchedEffect
        }
        val item = info.visibleItemsInfo.firstOrNull { it.key == key }
        if (item == null) { val pos = open.indexOfFirst { it["id"].asString == key }.coerceAtLeast(0); listState.scrollToItem(pos + if (info.visibleItemsInfo.firstOrNull()?.key == "head") 1 else 0) }
        else { val over = item.offset + item.size - info.viewportEndOffset; if (over > 0) listState.scrollBy(over.toFloat()) }
    }
    androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
    val wide = maxWidth >= 600.dp
    val strip = if (maxWidth * .58f >= 700.dp) 2 else 1
    // Wide (Fold open, tablet, sideways, the Thor's top): the act's art and header on the left, its battles on the right.
    if (wide) Row(Modifier.fillMaxSize()) {
        Box(Modifier.weight(.42f).fillMaxHeight()) {
            StoryPic(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.36f))
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0xB8080A0E), .35f to Color(0x4D0D1016), .78f to Color(0xCC0D1016), 1f to Color(0xFF0D1016))))
            Box(Modifier.matchParentSize().background(Brush.horizontalGradient(.7f to Color(0x000D1016), 1f to Site.Bg)))
            ActHead(a, won, stars, theirWins, onBack, Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = top + 12.dp, bottom = 16.dp), wide = true)
        }
        // The top gap is outside the list (not content padding), so the row above the first one never peeks in above it (review of c694f37e).
        LazyColumn(Modifier.weight(.58f).fillMaxHeight().padding(top = top + 12.dp), state = listState, contentPadding = PaddingValues(start = 8.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (data == null) item("loading") { Text("Opening the act…", style = Site.Body, modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp)) }
            open.forEach { b -> item(b["id"].asString) { row(b, strip) } }
            tease?.let { item("tease") { SecretTease(it) } }
            item("purse") { Box(Modifier.padding(top = 4.dp)) { purse() } }
            if (tail > 0) item("tail") { androidx.compose.foundation.layout.Spacer(Modifier.height(with(androidx.compose.ui.platform.LocalDensity.current) { tail.toDp() })) }
        }
    } else Box(Modifier.fillMaxSize()) {
        // Phone: the act's art bleeds behind a short header, then the rows.
        val bleed = top + 160.dp
        LazyColumn(Modifier.fillMaxSize(), state = listState, contentPadding = PaddingValues(bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            item("head") {
                Box(Modifier.fillMaxWidth().height(bleed)) {
                    StoryPic(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
                    Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0xB8080A0E), .42f to Color(0x4D0D1016), .8f to Color(0xCC0D1016), 1f to Color(0xFF0D1016))))
                    ActHead(a, won, stars, theirWins, onBack, Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = top + 14.dp, bottom = 10.dp), wide = false)
                }
            }
            if (data == null) item("loading") { Text("Opening the act…", style = Site.Body, modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp, horizontal = 16.dp)) }
            open.forEach { b -> item(b["id"].asString) { Box(Modifier.padding(horizontal = 16.dp)) { row(b, 0) } } }
            tease?.let { item("tease") { Box(Modifier.padding(horizontal = 16.dp)) { SecretTease(it) } } }
            // The purse sits under the battles on a phone, so three won rows and the open battle fit on one screen.
            item("purse") { Box(Modifier.padding(horizontal = 16.dp).padding(top = 4.dp)) { purse() } }
        }
    }
    }
}

/** The act's header over its art: back, "STORY · ACT n", the act name, the years and set marks, stars and their side's wins, the won ring. */
@Composable
private fun ActHead(a: PlayRules.Act, won: Int, stars: Int, theirs: Int, onBack: () -> Unit, modifier: Modifier, wide: Boolean) {
    Column(modifier, verticalArrangement = Arrangement.SpaceBetween) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0x9E0D1016)).border(1.dp, Color(0x4DD6AD64), CircleShape)
                .clickable(onClick = onBack).semantics { contentDescription = "Back" }, contentAlignment = Alignment.Center) { Icon(SiteIcons.Back, 20.dp, Color(0xFFF4EFE6)) }
            Column(Modifier.weight(1f).padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("STORY · ACT ${a.act}", style = storyText(11f, FontWeight.ExtraBold, Color(0xFFF2CF7E), 2.4f))
                Text(a.name, style = storyCinzel(if (wide) 26f else 24f, Color(0xFFF6EEDB)).copy(shadow = androidx.compose.ui.graphics.Shadow(Color(0xB3000000), Offset(0f, 2f), 10f)))
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(a.years, style = storyText(14f, FontWeight.SemiBold, Color(0xFFF4EFE6)))
                    Symbols(a.sets)
                }
                Text(androidx.compose.ui.text.buildAnnotatedString {
                    pushStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFE8B95B))); append("★ "); pop()
                    append("$stars of ${StoryLogic.MAX_STARS * 8} · their side won $theirs of 8")
                }, style = storyText(13f, FontWeight.SemiBold, Color(0xFFDDD8CC)))
            }
            Ring(won, 8, 48.dp)
        }
    }
}

private val PIPS = mapOf('W' to (Color(0xFFF3EBD3) to "white"), 'U' to (Color(0xFF6FA8DC) to "blue"), 'B' to (Color(0xFF8B7C99) to "black"), 'R' to (Color(0xFFE0705A) to "red"), 'G' to (Color(0xFF6BB77B) to "green"))

/** A deck's colours as small dots, named for a screen reader. */
@Composable
private fun ColourPips(colors: String?) = Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
    colors.orEmpty().uppercase().forEach { c -> PIPS[c]?.let { (col, name) ->
        Box(Modifier.size(11.dp).clip(CircleShape).background(col).border(1.dp, Color(0x66000000), CircleShape).semantics { contentDescription = name }) } }
}

private fun JsonObject.o(k: String): JsonObject? = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.s(k: String): String? = get(k)?.takeIf { it.isJsonPrimitive }?.asString

@Composable
private fun Pill(text: String, gold: Boolean, desc: String = text, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val sh = RoundedCornerShape(999.dp)
    Box(modifier.heightIn(min = 44.dp).then(Modifier.widthIn(max = 120.dp)).clip(sh)
        .then(if (gold) Modifier.background(Brush.verticalGradient(0f to Color(0xFFF6D88C), .6f to Color(0xFFD9A94E), 1f to Color(0xFFB8893A))) else Modifier.border(1.dp, Color(0x8CD6AD64), sh))
        .clickable(onClick = onClick).semantics { contentDescription = desc }.padding(horizontal = 12.dp, vertical = 4.dp), contentAlignment = Alignment.Center) {
        Text(text, style = storyText(12.5f, FontWeight.Bold, if (gold) Color(0xFF1A1408) else Color(0xFFF2CF7E)).copy(lineHeight = 14.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center), maxLines = 3)
    }
}

@Composable
private fun KindLine(b: JsonObject, big: Boolean, modifier: Modifier = Modifier) = Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    Text((if (b["slot"].asInt == 8) "Boss" else b.s("kind").orEmpty()).uppercase(), style = storyText(if (big) 11f else 10.5f, FontWeight.ExtraBold, Color(0xFFF2CF7E), 1.6f), maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
    Text(b.s("difficulty").orEmpty().uppercase(), style = storyText(if (big) 11f else 10.5f, FontWeight.Bold, Color(0xFFAEB3BE), .8f), maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
}

/** A won battle, one short row: face, kind, stars, title (never cut), then their side's prize and "Play as", or "Both sides won" and Replay. */
@Composable
private fun WonRow(b: JsonObject, cast: JsonObject?, p: StoryLogic.Progress, setNames: Map<String, String>, compact: Boolean, onOpen: () -> Unit, onPlayAs: () -> Unit) {
    val id = b["id"].asString; val rec = p.battles[id] ?: emptySet()
    val theirsWon = "villain" in rec
    val rw = b.o("reward"); val vCard = rw?.o("villain")?.o("card") != null
    val villain = cast?.o(b.o("villain")?.s("who") ?: "")
    val face = villain?.o("portrait")
    val shape = RoundedCornerShape(16.dp)
    Row(Modifier.fillMaxWidth().heightIn(min = if (compact) 60.dp else 72.dp).clip(shape).background(Color(0xE6161921)).border(1.dp, Color(0x14FFFFFF), shape)
        .clickable(onClick = onOpen).padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        val fs = RoundedCornerShape(10.dp)
        StoryPic(face?.s("crop"), Modifier.size(if (compact) 44.dp else 48.dp).clip(fs).border(1.dp, Color(0x80D6AD64), fs), storyFocus(face?.s("focus")))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(if (compact) 2.dp else 3.dp)) {
            // The kind and difficulty get the whole line; the stars sit over the button (review: "NOR…" at 100 %).
            KindLine(b, false)
            Text(b.s("title").orEmpty(), style = storyCinzel(14f, Color(0xFFF6EEDB)).copy(lineHeight = 18.sp))
            Text(androidx.compose.ui.text.buildAnnotatedString {
                if (theirsWon) append("Both sides won")
                else if (vCard) { pushStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFF2CF7E), fontWeight = FontWeight.Bold)); append("Their side: "); pop()
                    append(StoryLogic.rewardText(rw?.o("villain"), b.s("rewardSet").orEmpty(), setNames)) }
                else append("Won")
            }, style = storyText(12f, FontWeight.SemiBold, Color(0xFFAEB3BE)).copy(lineHeight = 16.sp))
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            StarsRow(rec, 12.dp)
            if (!theirsWon && vCard) { val n = villain?.s("name") ?: "their side"; Pill("Play as\n$n", true, "Play as $n", onClick = onPlayAs) }
            else Pill("Replay", false, onClick = onOpen)
        }
    }
}

/** The battle you are on: an open gold-edged card with the blurb in full, both decks, what's new, the prize and Duel. */
@Composable
private fun NowCard(b: JsonObject, cast: JsonObject?, p: StoryLogic.Progress, setNames: Map<String, String>, lessons: Map<String, String>, strip: Int, onOpen: () -> Unit) {
    val id = b["id"].asString; val slot = b["slot"].asInt; val rec = p.battles[id] ?: emptySet()
    val hero = b.o("hero"); val vil = b.o("villain")
    val villain = cast?.o(vil?.s("who") ?: ""); val face = villain?.o("portrait")
    val heroWho = hero?.s("who"); val heroName = if (heroWho != null && heroWho != "you") cast?.o(heroWho)?.s("name") else null
    val rw = b.o("reward"); val set = b.s("rewardSet").orEmpty()
    val teaches = b.getAsJsonArray("teaches")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }?.filter { it in lessons }.orEmpty()
    val collector = if (slot >= 8) " + a Collector pack" else ""
    val shape = RoundedCornerShape(18.dp)
    Column(Modifier.fillMaxWidth().testShadow(14.dp, shape).clip(shape).background(Brush.verticalGradient(0f to Color(0xEB2A2212), .55f to Color(0xF0161921)))
        .border(1.5.dp, Color(0xFFD6AD64), shape).clickable(onClick = onOpen).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val duel = @Composable { Box(Modifier.size(width = if (strip > 0) 112.dp else 92.dp, height = 48.dp).clip(RoundedCornerShape(999.dp)).background(Brush.verticalGradient(0f to Color(0xFFF6D88C), .6f to Color(0xFFD9A94E), 1f to Color(0xFFB8893A)))
            .clickable(onClick = onOpen).semantics { contentDescription = "Duel" }, contentAlignment = Alignment.Center) { Text("Duel", style = storyText(16f, FontWeight.Bold, Color(0xFF1A1408))) } }
        val you = if (heroName != null) "YOU PLAY AS ${heroName.uppercase()}" else "YOU PLAY"
        val winText = StoryLogic.rewardText(rw?.o("hero"), set, setNames) + collector
        val then = if (rw?.o("villain")?.o("card") != null) "Then their side: " + StoryLogic.rewardText(rw.o("villain"), set, setNames) else null
        val chips = @Composable { if (teaches.isNotEmpty()) androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("NEW", style = storyText(10f, FontWeight.ExtraBold, Color(0xFF9FD0F0), 1.6f), modifier = Modifier.align(Alignment.CenterVertically))
            teaches.forEach { t -> Text(t, style = storyText(12f, FontWeight.SemiBold, Color(0xFFCFE6F7)), modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0x1F9FD0F0))
                .border(1.dp, Color(0x669FD0F0), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 4.dp)) }
        } }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            val fs = RoundedCornerShape(14.dp)
            StoryPic(face?.s("crop"), Modifier.size(if (strip > 0) 56.dp else 64.dp).clip(fs).border(1.5.dp, Color(0xFFD6AD64), fs), storyFocus(face?.s("focus")))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                if (strip > 0) KindLine(b, true) else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { KindLine(b, true, Modifier.weight(1f)); StarsRow(rec, 13.dp) }
                Text(b.s("title").orEmpty(), style = storyCinzel(18f, Color(0xFFF6EEDB)).copy(lineHeight = 22.sp))
            }
            // Wide: Duel in the card's first row, the stars over it.
            if (strip > 0) Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) { StarsRow(rec, 13.dp); duel() }
        }
        Text(b.s("blurb").orEmpty(), style = storyText(13.5f, FontWeight.Medium, Color(0xFFD3D6DE)).copy(lineHeight = 19.sp))
        if (strip > 0) {
            Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Side(you, hero?.o("deck")?.s("name").orEmpty(), hero?.o("deck")?.s("colors"), Modifier.weight(1f).fillMaxHeight())
                Side("AGAINST", vil?.o("deck")?.s("name").orEmpty(), vil?.o("deck")?.s("colors"), Modifier.weight(1f).fillMaxHeight())
                if (strip == 2 && teaches.isNotEmpty()) Box(Modifier.weight(1f).fillMaxHeight()) { Box3("NEW", teaches.joinToString(" · "), null, Color(0xFF9FD0F0)) }
                Box(Modifier.weight(1.2f).fillMaxHeight()) { Box3("WIN", winText, then, Color(0xFFF2CF7E)) }
            }
            if (strip == 1) chips()
        } else {
            Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Side(you, hero?.o("deck")?.s("name").orEmpty(), hero?.o("deck")?.s("colors"), Modifier.weight(1f).fillMaxHeight())
                Side("AGAINST", vil?.o("deck")?.s("name").orEmpty(), vil?.o("deck")?.s("colors"), Modifier.weight(1f).fillMaxHeight())
            }
            chips()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("WIN", style = storyText(10f, FontWeight.ExtraBold, Color(0xFFF2CF7E), 1.6f))
                    Text(winText, style = storyText(13f, FontWeight.SemiBold, Color(0xFFF4EFE6)).copy(lineHeight = 17.sp))
                    then?.let { Text(it, style = storyText(12f, FontWeight.SemiBold, Color(0xFFAEB3BE)).copy(lineHeight = 16.sp)) }
                }
                duel()
            }
        }
    }
}

/** One box of the wide strip: its label, its words, an optional second line. */
@Composable
private fun Box3(label: String, text: String, sub: String?, tint: Color) {
    val sh = RoundedCornerShape(12.dp)
    Column(Modifier.fillMaxSize().clip(sh).background(Color(0x990D1016)).border(1.dp, Color(0x14FFFFFF), sh).padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = storyText(10f, FontWeight.ExtraBold, tint, 1.6f))
        Text(text, style = storyText(13f, FontWeight.SemiBold, Color(0xFFF4EFE6)).copy(lineHeight = 17.sp))
        sub?.let { Text(it, style = storyText(11.5f, FontWeight.SemiBold, Color(0xFFAEB3BE)).copy(lineHeight = 15.sp)) }
    }
}

@Composable
private fun Side(label: String, deck: String, colors: String?, modifier: Modifier) {
    val sh = RoundedCornerShape(12.dp)
    Column(modifier.clip(sh).background(Color(0x990D1016)).border(1.dp, Color(0x14FFFFFF), sh).padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = storyText(10f, FontWeight.ExtraBold, Color(0xFFF2CF7E), 1.6f))
        Text(deck, style = storyText(13f, FontWeight.SemiBold, Color(0xFFF4EFE6)).copy(lineHeight = 17.sp))
        ColourPips(colors)
    }
}

/** .st-secret-tease: a dashed gold note under the battles, muted 13 px. */
@Composable
private fun SecretTease(text: String) {
    Text(text, style = storyText(13f, FontWeight.Normal, Site.Muted).copy(lineHeight = 19.sp),
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp).drawBehind { drawRoundRect(Color(0x55D6AD64), cornerRadius = androidx.compose.ui.geometry.CornerRadius(14.dp.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx(), pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())))) }.padding(horizontal = 14.dp, vertical = 12.dp)
            .semantics { contentDescription = text })
}

@Composable
private fun BattleRow(b: JsonObject, cast: JsonObject?, p: StoryLogic.Progress, now: Int, onClick: () -> Unit) {
    val id = b["id"].asString; val slot = b["slot"].asInt; val rec = p.battles[id]
    val done = StoryLogic.battleCleared(p, id); val here = slot == now; val tease = slot == now + 1 && b["secret"]?.asBoolean != true
    val boss = slot >= 8; val secret = b["secret"]?.asBoolean == true
    val face = cast?.getAsJsonObject(b.getAsJsonObject("villain")["who"].asString)?.getAsJsonObject("portrait")
    val shape = RoundedCornerShape(18.dp)
    val edge = when { secret -> Color(0x558FA6FF); here || boss -> Color(0xAAD6AD64); else -> Site.Line }
    val tint = when { secret -> Brush.horizontalGradient(listOf(Color(0x263B5BDB), Color.Transparent)); boss -> Brush.horizontalGradient(listOf(Color(0x1FA8402A), Color.Transparent)); else -> null }
    Row(Modifier.fillMaxWidth().heightIn(min = 96.dp).clip(shape).background(Site.Surface.copy(alpha = if (tease) .55f else .9f)).then(if (tint != null) Modifier.background(tint) else Modifier)
        .border(1.dp, edge, shape).then(if (tease) Modifier else Modifier.clickable(onClick = onClick)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        val fs = RoundedCornerShape(14.dp)
        StoryPic(face?.get("crop")?.asString, Modifier.size(72.dp).clip(fs).border(1.5.dp, if (boss) Color(0xFFE8B95B) else Color(0x88D6AD64), fs).then(if (tease) Modifier.blur(4.dp) else Modifier), storyFocus(face?.get("focus")?.asString))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text((if (slot == 8) "Boss" else b["kind"].asString).uppercase(), style = storyText(11f, FontWeight.ExtraBold, storyGold, 2f))
                if (!tease) Text(b["difficulty"].asString.uppercase(), style = storyText(11f, FontWeight.Bold, Site.Muted, 1f))
            }
            Text(b["title"].asString, style = storyCinzel(17f, if (AppSettings.theme == "light") Site.Text else Color(0xFFF6EEDB)), maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (!tease) Text(b["blurb"].asString, style = storyText(13f, FontWeight.Medium, Site.Muted), maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
        if (!tease) Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) { StarsRow(rec); Cta(if (done) "Replay" else "Duel") }
    }
}

/** The Story pages: the road, an act, then a battle's duel setup. The match itself still opens the site's Play page (next piece). */
@Composable
fun StoryRoute(startAct: Int? = null, onBack: () -> Unit, onDuel: (dev.cardstashy.nativeplay.match.Pick.Table) -> Unit = {}) {
    val refs by Progress.storyRefs.collectAsState()
    val state by Progress.state.collectAsState()
    val profile by dev.cardstashy.nativeplay.account.Account.profile.collectAsState()
    val rules = PlayRules.load(LocalContext.current)
    var act by remember { mutableStateOf(startAct) }
    var battle by remember { mutableStateOf<String?>(null) }
    var duel by remember { mutableStateOf(StoryDuelUi()) }
    LaunchedEffect(Unit) { Progress.refreshStory() }
    val p = remember(refs) { StoryLogic.fromRefs(refs ?: emptyList()) }
    val wallet: @Composable () -> Unit = { PlayMath.purse(state)?.let { PurseRow(it, level = PlayMath.mastery(state, it.xp)) } }
    // With a bottom screen up the purse moves into its case's plaque.
    val purse: @Composable () -> Unit = { if (!DualScreen.active) wallet() }
    val open = act
    BackHandler { if (battle != null) { battle = null; duel = StoryDuelUi() } else if (open != null) act = null else onBack() }
    if (rules.acts.isEmpty()) { RulesMissing(onBack); return }
    if (open == null) { StoryRoad(rules.acts, rules.ages[1] ?: "", p, onBack, { act = it }, purse, wallet); return }
    val meta = rules.acts.firstOrNull { it.act == open } ?: rules.acts.first()
    val ctx = LocalContext.current
    // The site's copy first (fixes land without an APK), else the copy shipped in the app (offline, or an act the site has not published yet).
    val data by androidx.compose.runtime.produceState<JsonObject?>(null, open) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching { Http.call("GET", "https://cardstashy.com/data/story/act-$open.json") as? JsonObject }.getOrNull()
                ?: runCatching { com.google.gson.JsonParser.parseString(ctx.assets.open("story/act-$open.json").use { String(it.readBytes()) }) as? JsonObject }.getOrNull()
        }
    }
    // Controller: LB/RB step through the battles you can fight in this act, LT/RT step between the acts you have reached.
    val lastAct = StoryLogic.currentAct(p, rules.acts.size).coerceAtMost(rules.lastAct)
    val fightable = data?.getAsJsonArray("battles")?.mapNotNull { it as? JsonObject }
        ?.filter { it["secret"]?.asBoolean != true && (it["slot"]?.asInt ?: 99) <= StoryLogic.currentBattle(p, open) }?.sortedBy { it["slot"].asInt }?.map { it["id"].asString }.orEmpty()
    PadScreen(PadActs(
        tabs = if (battle != null && fightable.size > 1) { d -> val i = fightable.indexOf(battle); val n = fightable.getOrNull(if (i < 0) 0 else (i + d).coerceIn(0, fightable.lastIndex)); if (n != null && n != battle) { battle = n; duel = StoryDuelUi() } } else null,
        tabsLabel = "Battle",
        page = if (lastAct > 1 || open > 1) { d -> val n = (open + d).coerceIn(1, lastAct); if (n != open && rules.acts.any { it.act == n }) { act = n; battle = null; duel = StoryDuelUi() } } else null,
        pageLabel = "Act"))
    val b = battle?.let { id -> data?.getAsJsonArray("battles")?.map { it.asJsonObject }?.firstOrNull { it["id"].asString == id } }
    if (b == null) { StoryActPage(meta, data, p, { act = null }, { battle = it; duel = StoryDuelUi() }, purse, wallet, rules.setNames) { battle = it; duel = StoryDuelUi(seat = "villain") }; return }
    // The act's card pool gates your own decks (story-client.js loadActPool); null while it loads.
    val pool by androidx.compose.runtime.produceState<Set<String>?>(null, open) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { runCatching {
            ((runCatching { Http.call("GET", "https://cardstashy.com/data/story/pool-$open.json") as? com.google.gson.JsonArray }.getOrNull()
                ?: com.google.gson.JsonParser.parseString(ctx.assets.open("story/pool-$open.json").use { String(it.readBytes()) }) as? com.google.gson.JsonArray))?.map { it.asString.lowercase() }?.toSet() }.getOrNull() }
    }
    val owned = remember(state) { dev.cardstashy.nativeplay.play.Decks.ownedByName(state) }
    val decks = remember(state) { state?.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject } ?: emptyList() }
    val ownDecks = remember(decks, pool, owned) { decks.map { d ->
        val rows = dev.cardstashy.nativeplay.play.Decks.rows(d).filter { it.board != "side" }
        var fit = StoryLogic.ownDeckFits(rows.map { it.name to it.qty }, pool)
        if (fit.ok && !dev.cardstashy.nativeplay.play.Decks.shortfall(rows, owned).complete) fit = StoryLogic.Fit(false, "Some cards aren't in your Play collection yet.")
        StoryOwnDeck(d["id"].asString, d["name"]?.asString ?: "Deck", dev.cardstashy.nativeplay.play.Decks.cover(d).ifBlank { null }, rows.sumOf { it.qty }, fit)
    } }
    StoryDuelPage(open, data!!, b, p, rules.setNames, profile?.avatarUrl, ownDecks, duel, { duel = it }, { battle = null; duel = StoryDuelUi() },
        { seat, own -> onDuel(storyPick(open, data!!, b, seat, own, StoryLogic.battleCleared(p, b["id"].asString), profile?.avatarUrl,
            dev.cardstashy.nativeplay.play.StoryLessons.load(ctx).takeIf { !dev.cardstashy.nativeplay.play.StoryLessons.off(ctx) },
            decks.firstOrNull { it["id"].asString == own }?.let { d -> dev.cardstashy.nativeplay.play.Decks.rows(d).filter { it.board != "side" } }, ownDecks.firstOrNull { it.id == own }?.art)) },
        listFor = { id -> decks.firstOrNull { it["id"].asString == id }?.let { d -> dev.cardstashy.nativeplay.play.Decks.rows(d).filter { it.board != "side" }.map { it.name to it.qty } } }, purse = purse)
}

private val STORY_LEVEL = mapOf("Easy" to "Easy", "Normal" to "Medium", "Hard" to "Hard")

/** app.js storyPlay's launch: Vintage, the battle's level, a random first player; the Story deck (or your own) against the other side's deck.
 *  An Act 1 lesson ([lessons] on, first hero-side play) meets the battle's lesson deck, with the lesson's stacked draws and you going first. */
private fun storyPick(act: Int, data: JsonObject, b: JsonObject, seat: String, own: String?, cleared: Boolean, avatar: String?,
                      lessons: dev.cardstashy.nativeplay.play.StoryLessons?,
                      ownRows: List<dev.cardstashy.nativeplay.play.Decks.Row>?, ownFace: String?): dev.cardstashy.nativeplay.match.Pick.Table {
    val me = if (seat == "villain" && cleared) "villain" else "hero"; val other = if (me == "hero") "villain" else "hero"
    fun deck(id: String, name: String, cards: List<Triple<String, Int, String?>>) = JsonObject().apply {
        addProperty("id", id); addProperty("name", name); addProperty("format", "Vintage")
        add("cards", com.google.gson.JsonArray().apply { cards.forEach { (n, q, pid) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q); pid?.let { addProperty("printingId", it) } }) } })
    }
    fun side(k: String): JsonObject = b.getAsJsonObject(k).getAsJsonObject("deck")
    fun sideDeck(k: String, id: String) = side(k).let { d -> deck(id, d["name"].asString, d.getAsJsonArray("cards").map { it.asJsonObject }.map { Triple(it["name"].asString, it["qty"].asInt, it.get("id")?.takeIf { x -> x.isJsonPrimitive }?.asString) }) }
    val id = b["id"].asString
    val you = if (own != null && ownRows != null) deck(own, "Your deck", ownRows.map { Triple(it.name, it.qty, null) }) else sideDeck(me, "story:$id:$me")
    val lessonRun = me == "hero" && !cleared && lessons?.isLessonBattle(id) == true
    val lessonDeck = b.getAsJsonObject("lessonDeck")?.getAsJsonObject("deck")?.takeIf { lessonRun }
    val cpu = lessonDeck?.let { d -> deck("story:$id:$other", d["name"].asString, d.getAsJsonArray("cards").map { it.asJsonObject }.map { Triple(it["name"].asString, it["qty"].asInt, it.get("id")?.takeIf { x -> x.isJsonPrimitive }?.asString) }) }
        ?: sideDeck(other, "story:$id:$other")
    val cast = data.getAsJsonObject("cast")
    fun lines(k: String) = data.getAsJsonArray(k)?.map { it.asJsonObject } ?: emptyList()
    val face = ownFace?.takeIf { own != null } ?: side(me).getAsJsonArray("cards").map { it.asJsonObject["name"].asString }.firstOrNull { !basicLand.matches(it) }
    val setup = if (lessonRun && dev.cardstashy.nativeplay.engine.ForgeService.matchSetup) lessons?.setup(id) else null
    val ctx = dev.cardstashy.nativeplay.match.StoryCtx(act, b, cast, me, own != null, b["slot"].asInt == 1 && me == "hero" && !cleared, avatar, lines("intro"), lines("finale"), lines("villainFinale"),
        lessonBattle = id.takeIf { lessonRun }, setup = setup)
    return dev.cardstashy.nativeplay.match.Pick.Table(you, you["name"].asString, "Vintage", face, cpu, STORY_LEVEL[b["difficulty"].asString] ?: "Medium", quick = false, story = ctx)
}
private val basicLand = Regex("^(snow-covered )?(plains|island|swamp|mountain|forest)$", RegexOption.IGNORE_CASE)
