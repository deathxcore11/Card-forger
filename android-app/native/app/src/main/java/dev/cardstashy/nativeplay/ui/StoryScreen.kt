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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
internal fun StarsRow(rec: Set<String>?) {
    val slots = listOf("loaner", "loaner", "loaner", "own", "villain")
    val have = StoryLogic.STAR_KEYS.sumOf { if (rec?.contains(it) == true) StoryLogic.STAR_VALUE.getValue(it) else 0 }
    Row(Modifier.semantics { contentDescription = "$have of 5 stars" }, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        // Three loaner stars light together, then your own deck's, then the villain side's (story-ui.js STAR_SLOTS).
        slots.forEachIndexed { i, k -> StarIcon(rec?.contains(k) == true) }
    }
}

/** Battles won of 8, a ring with the count. */
@Composable
private fun Ring(done: Int, total: Int) {
    Box(Modifier.size(52.dp).semantics { contentDescription = "$done of $total battles won" }, contentAlignment = Alignment.Center) {
        Box(Modifier.size(52.dp).drawBehind {
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
fun StoryRoad(acts: List<PlayRules.Act>, age: String, p: StoryLogic.Progress, onBack: () -> Unit, onAct: (Int) -> Unit, purse: @Composable () -> Unit = {}) {
    val now = StoryLogic.currentAct(p, acts.size)
    val shown = acts.filter { it.act <= now + 1 }
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    LazyColumn(Modifier.fillMaxSize().background(Site.Bg), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = top + 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item("head") { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { PageHeader("Story", "Play", onBack = onBack); purse() } }
        item("age") { Text(age.uppercase(), style = storyText(12f, FontWeight.ExtraBold, storyGold, 3.4f)) }
        shown.forEach { a ->
            item("act${a.act}") {
                val won = StoryLogic.actWon(p, a.act); val done = StoryLogic.actCleared(p, a.act); val here = a.act == now; val tease = a.act > now
                Cover(a, won, done, here, tease, StoryLogic.actStars(p, a.act)) { onAct(a.act) }
            }
        }
        if (now > acts.size) item("book") { Book() }
    }
}

@Composable
private fun Cover(a: PlayRules.Act, won: Int, done: Boolean, here: Boolean, tease: Boolean, stars: Int, onClick: () -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    Box(Modifier.fillMaxWidth().heightIn(min = 300.dp).aspectRatio(1.05f).clip(shape)
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
fun StoryActPage(a: PlayRules.Act, data: JsonObject?, p: StoryLogic.Progress, onBack: () -> Unit, onBattle: (String) -> Unit, purse: @Composable () -> Unit = {}) {
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val now = StoryLogic.currentBattle(p, a.act)
    val battles = data?.getAsJsonArray("battles")?.map { it.asJsonObject }.orEmpty()
    val cast = data?.getAsJsonObject("cast")
    val won = battles.count { it["secret"]?.asBoolean != true && StoryLogic.battleCleared(p, it["id"].asString) }
    LazyColumn(Modifier.fillMaxSize().background(Site.Bg), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = top + 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item("head") { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { PageHeader(a.name, "Story · Act ${a.act}", onBack = onBack); purse() } }
        item("banner") {
            val shape = RoundedCornerShape(24.dp)
            Box(Modifier.fillMaxWidth().heightIn(min = 170.dp).clip(shape).border(1.dp, Color(0x38D6AD64), shape)) {
                StoryPic(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.36f))
                Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x100C0C0E), 1f to Color(0xF00C0C0E))))
                Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Symbols(a.sets); Text(a.years, style = storyText(14f, FontWeight.Medium, Color(0xFFD6DBE2))) }
                    Ring(won, 8)
                }
            }
        }
        if (data == null) item("loading") { Text("Opening the act…", style = Site.Body, modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp)) }
        battles.filter { b -> if (b["secret"]?.asBoolean == true) StoryLogic.secretOpen(p, a.act) else b["slot"].asInt <= now + 1 }.forEach { b ->
            item(b["id"].asString) { BattleRow(b, cast, p, now) { onBattle(b["id"].asString) } }
        }
    }
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
fun StoryRoute(startAct: Int? = null, onBack: () -> Unit, onDuel: (battle: String, seat: String, own: String?) -> Unit = { _, _, _ -> }) {
    val refs by Progress.storyRefs.collectAsState()
    val state by Progress.state.collectAsState()
    val profile by dev.cardstashy.nativeplay.account.Account.profile.collectAsState()
    val rules = PlayRules.load(LocalContext.current)
    var act by remember { mutableStateOf(startAct) }
    var battle by remember { mutableStateOf<String?>(null) }
    var duel by remember { mutableStateOf(StoryDuelUi()) }
    LaunchedEffect(Unit) { Progress.refreshStory() }
    val p = remember(refs) { StoryLogic.fromRefs(refs ?: emptyList()) }
    val purse: @Composable () -> Unit = { PlayMath.purse(state)?.let { PurseRow(it, {}, {}, {}, level = PlayMath.mastery(state, it.xp)) } }
    val open = act
    BackHandler { if (battle != null) { battle = null; duel = StoryDuelUi() } else if (open != null) act = null else onBack() }
    if (open == null) { StoryRoad(rules.acts, rules.ages[1] ?: "", p, onBack, { act = it }, purse); return }
    val meta = rules.acts.first { it.act == open }
    val data by androidx.compose.runtime.produceState<JsonObject?>(null, open) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { runCatching { Http.call("GET", "https://cardstashy.com/data/story/act-$open.json") as? JsonObject }.getOrNull() }
    }
    val b = battle?.let { id -> data?.getAsJsonArray("battles")?.map { it.asJsonObject }?.firstOrNull { it["id"].asString == id } }
    if (b == null) { StoryActPage(meta, data, p, { act = null }, { battle = it; duel = StoryDuelUi() }, purse); return }
    // The act's card pool gates your own decks (story-client.js loadActPool); null while it loads.
    val pool by androidx.compose.runtime.produceState<Set<String>?>(null, open) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { runCatching {
            (Http.call("GET", "https://cardstashy.com/data/story/pool-$open.json") as? com.google.gson.JsonArray)?.map { it.asString.lowercase() }?.toSet() }.getOrNull() }
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
        { seat, own -> onDuel(b["id"].asString, seat, own) },
        listFor = { id -> decks.firstOrNull { it["id"].asString == id }?.let { d -> dev.cardstashy.nativeplay.play.Decks.rows(d).filter { it.board != "side" }.map { it.name to it.qty } } }, purse = purse)
}
