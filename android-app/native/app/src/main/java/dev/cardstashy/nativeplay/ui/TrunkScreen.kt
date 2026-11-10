@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardData
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.Trunk

/** What a Trunk tile opens: that card, its own printing, foil for a holo copy (app.js:3401). */
data class CardPick(val name: String, val oracle: String, val printId: String?, val finish: String)
/** A held Trunk card: what the Play hold menu needs (the printing's picture and set). */
data class CardHold(val pick: CardPick, val image: String, val set: String, val holo: Boolean)

private val Ink get() = Site.Text
private val small get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = Site.Muted)

/**
 * The Trunk, collectionMarkup in play-econ-ui.js: Cards and Sets. Cards = the filter bar (name, colour,
 * type, rarity, sort, set), "N of M cards", then the app's gallery tiles (2 a row on a phone, 170 dp and up
 * on wide screens) with the card's finish, name, set badge, mana cost, set and number, and pips or Holo.
 */
@Composable
fun TrunkScreen(state: JsonObject, onBack: () -> Unit, onCard: (CardPick) -> Unit, onSet: (String) -> Unit, startSet: String? = null, onHold: (CardHold) -> Unit = {}, nav: @Composable () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("play", android.content.Context.MODE_PRIVATE) }
    var tab by rememberSaveable { mutableStateOf(if (startSet != null) "sets" else "cards") }
    var filter by remember { mutableStateOf(Trunk.Filter()) }
    var sort by remember { mutableStateOf(prefs.getString("trunkSort", "") ?: "") }
    var setQuery by rememberSaveable { mutableStateOf(startSet ?: "") }
    var setFormat by rememberSaveable { mutableStateOf("") }
    val facts by CardFacts.cards.collectAsState()
    val prints by CardFacts.prints.collectAsState()
    val all = remember(state) { Trunk.cards(state).sortedBy { it.n } }
    LaunchedEffect(all) { CardFacts.want(all.map { it.o to it.pid }) }
    val sets = remember(state, SetFacts_version()) { Trunk.setRows(state) }
    val matched = remember(all, facts, filter, sort, sets) { Trunk.sort(Trunk.filter(all, { facts[it] }, filter), { facts[it] }, sort, sets) }
    val shown = remember(matched) { Trunk.holoSplit(matched).take(300) }
    val data = CardData.ready.collectAsState().value.also { if (it == null) CardData.warm(context) }
    // Bottom screen (wave 2): the card under the ring in its case; otherwise the binder plaque with the purse and Keep collecting.
    val lens = rememberLens()
    BottomScreen {
        val k = lens.key?.removePrefix("card:")
        val holo = k?.endsWith(":h") == true
        val c = k?.removeSuffix(":h")?.let { o -> all.firstOrNull { it.o == o } }
        ShowcaseLens(c?.let { it to holo }) { pick ->
            if (pick != null) {
                val (card, h) = pick
                val print = card.pid?.let { prints[it] } ?: facts[card.o]?.card
                val cp = CardPick(card.n, card.o, card.pid ?: print?.get("id")?.asString, if (h) "foil" else "nonfoil")
                TrunkCardCase(state, card, h, print, facts[card.o], data, onOpen = { onCard(cp) },
                    onMenu = { onHold(CardHold(cp, trunkImage(card, print, facts[card.o]), print?.get("set")?.asString ?: card.pset ?: card.s.firstOrNull() ?: "", h)) })
            } else TrunkBinderCase(state, all, matched.size, sets)
        }
    }

    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop() // #ambient: the shared art (glass on, or Aura)
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val cols = cardGridCells(maxWidth - 32.dp) // Settings > Card size
            // .pe-coll-list: 18 px between rows, 14 px between columns.
            // Nothing scrolls under the status bar (project rule 4): the grid itself stops below it, as Decks and the Shop do.
            LazyVerticalGrid(cols, Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).gridPinch(), contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        // head('Collection', snapshot): the purse sits under the title, as on every Play screen.
                        PlayHead("Collection", "Play", onBack) { if (!DualScreen.active) dev.cardstashy.nativeplay.play.PlayMath.purse(state)?.let { PurseRow(it, level = dev.cardstashy.nativeplay.play.PlayMath.mastery(state, it.xp)) } }
                        // Sets moved to the Shop (Randall 3 Nov 20:00Z), and came back as a switch here (8 Nov: "I can't find a way" to look at sets).
                        BenchSwitch(listOf("cards" to "Cards", "sets" to "Sets"), tab) { tab = it }
                    }
                }
                if (tab == "cards") {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        FilterBar(filter, sort, sets, { filter = it }) { sort = it; prefs.edit().putString("trunkSort", it).apply() }
                    }
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        if (!DualScreen.active) Text("${"%,d".format(matched.size)} of ${"%,d".format(all.size)} cards", style = small)
                    }
                    if (shown.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                        Empty(if (all.isNotEmpty()) "No cards match" else "Your binder is empty", if (all.isNotEmpty()) "Try another name, colour or type." else "Open a pack to start your Play collection.")
                    }
                    items(shown, key = { it.o + if (it.holo) ":h" else "" }) { c ->
                        val print = c.pid?.let { prints[it] } ?: facts[c.o]?.card
                        Box(Modifier.dualLens(lens, "card:" + c.o + if (c.holo) ":h" else "")) { Tile(c, print, facts[c.o], data, onHold = { img, set -> onHold(CardHold(CardPick(c.n, c.o, c.pid ?: print?.get("id")?.asString, if (c.holo) "foil" else "nonfoil"), img, set, c.holo)) }) { onCard(CardPick(c.n, c.o, c.pid ?: print?.get("id")?.asString, if (c.holo) "foil" else "nonfoil")) } }
                    }
                } else {
                    item(span = { GridItemSpan(maxLineSpan) }) { SetsTab(state, setQuery, setFormat, { setQuery = it }, { setFormat = it }, onSet) }
                }
            }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
}

internal fun trunkImage(c: Trunk.Card, print: JsonObject?, fact: CardFacts.Fact?): String =
    print?.let { p -> p.getAsJsonObject("image_uris")?.get("normal")?.asString ?: p.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")?.get("normal")?.asString }
        ?: c.pimage ?: fact?.i ?: "https://api.scryfall.com/cards/named?format=image&version=normal&exact=" + java.net.URLEncoder.encode(c.n, "UTF-8")

private fun JsonObject.str(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString

/** A Trunk card in the case: the card with its foil, type and rules text, copies and holo copies, the sets you own it in, and what seals buy. */
@Composable
internal fun TrunkCardCase(state: JsonObject, c: Trunk.Card, holo: Boolean, print: JsonObject?, fact: CardFacts.Fact?, data: CardData?, onOpen: () -> Unit, onMenu: () -> Unit) {
    val rarity = print?.str("rarity") ?: c.r
    val finish = Foil.finishFor(print, if (holo) "foil" else "nonfoil")
    val look = data?.let { Foil.look(it, print, finish) }
    val face = print?.getAsJsonArray("card_faces")?.firstOrNull() as? JsonObject
    val type = print?.str("type_line") ?: face?.str("type_line")
    val text = print?.str("oracle_text") ?: face?.str("oracle_text")
    val stamp = Trunk.stamp(state, print)
    val up = Trunk.holo(state, c.n, print)
    val seals = buildList {
        if (stamp != null && c.c < 4) add("Stamp a copy" to "1 ${stamp.rarity} seal · you have ${stamp.seals}")
        if (up != null && up.can) add("Make one holo" to "${up.cost} ${up.seal} seal${if (up.cost == 1) "" else "s"}" + if (up.afford) "" else " · not enough yet")
    }
    // The one card case both sides share (family T2); the Play facts stay Play's: copies, holo copies, the sets it is owned in, seals.
    QuickLookCase(QuickLook("trunk:" + c.o, if (holo) "Trunk · Holo copy" else "Trunk · Card", c.n, trunkImage(c, print, fact), type, text,
        facts = listOf("Copies" to "${c.c}", "Holo copies" to "${minOf(c.h, c.c)}", "Rarity" to rarity.replaceFirstChar { it.uppercase() }) + seals,
        buttons = listOf(CaseButton("A", "Open card", gold = true, run = onOpen), CaseButton(null, "Menu", run = onMenu)),
        look = look, tiltPhase = (c.o.hashCode() and 0xff) / 255f,
        extra = if (c.s.isEmpty()) null else ({
            CaseLabel("Owned in")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { c.s.take(10).forEach { SetBadge(it, rarity) } }
        })))
}

/** The Trunk's default case: the binder plaque (how many cards, copies, holo copies, sets started), the purse, and the sets closest to done. */
@Composable
internal fun TrunkBinderCase(state: JsonObject, all: List<Trunk.Card>, matched: Int, sets: List<Trunk.SetRow>) {
    val copies = all.sumOf { it.c }; val holos = all.sumOf { minOf(it.h, it.c) }
    val started = sets.filter { it.owned > 0 }
    val near = started.filter { (it.total ?: 0) > it.owned }.sortedByDescending { it.owned.toFloat() / (it.total ?: 1) }.take(3)
    ShowcaseCase("Play · Your Trunk", if (matched == all.size) "${"%,d".format(all.size)} cards" else "${"%,d".format(matched)} of ${"%,d".format(all.size)} cards",
        trailing = { dev.cardstashy.nativeplay.play.PlayMath.purse(state)?.let { PurseRow(it, level = dev.cardstashy.nativeplay.play.PlayMath.mastery(state, it.xp)) } },
        buttons = emptyList(), heroWeight = .4f, hero = if (all.isEmpty()) null else ({
            // Your proudest cards on the binder's cover: holo copies first, then the rarest.
            val rank = mapOf("mythic" to 4, "special" to 4, "bonus" to 4, "rare" to 3, "uncommon" to 2)
            val pride = all.sortedWith(compareByDescending<Trunk.Card> { minOf(it.h, it.c) > 0 }.thenByDescending { rank[it.r] ?: 1 }.thenByDescending { it.c }).take(3)
            pride.forEachIndexed { i, c ->
                val off = i - (pride.size - 1) / 2f
                Box(Modifier.align(Alignment.Center).fillMaxWidth(.52f).aspectRatio(63f / 88f).graphicsLayer { translationX = off * 40.dp.toPx(); rotationZ = off * 6f; translationY = kotlin.math.abs(off) * 10.dp.toPx() }
                    .zIndex(if (off == 0f) 3f else 1f)) { CardPicture(trunkImage(c, null, null), null, null, Modifier.fillMaxSize(), shape = CardCorner) }
            }
        })) {
        Row(horizontalArrangement = Arrangement.spacedBy(26.dp)) {
            CaseFact("Copies", "%,d".format(copies))
            CaseFact("Holo copies", "%,d".format(holos))
            CaseFact("Sets started", "${started.size}")
        }
        if (near.isNotEmpty()) {
            CaseLabel("Keep collecting")
            near.forEach { x ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(x.name, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Color(0xFFEDE7DA)), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        Text("${x.owned} / ${x.total}", style = TextStyle(fontFamily = Site.Manrope, fontSize = 14.sp, color = Site.Muted))
                    }
                    ProgressBar(x.owned.toFloat() / (x.total ?: 1))
                }
            }
        }
        Text("Move the ring onto a card to see it here.", style = TextStyle(fontFamily = Site.Manrope, fontSize = 14.sp, color = Site.Muted))
    }
}

@Composable private fun SetFacts_version() = dev.cardstashy.nativeplay.play.SetFacts.sets.collectAsState().value.size

/** .seg: the app's two-way switch (12 dp plate, 9 dp pill on the chosen one). */
@Composable
fun Segmented(options: List<Pair<String, String>>, on: String, modifier: Modifier = Modifier, glass: Boolean = false, pick: (String) -> Unit) {
    Row(modifier.fillMaxWidth().then(if (glass) Modifier.glass(RoundedCornerShape(12.dp)) else Modifier.clip(RoundedCornerShape(12.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(12.dp))).padding(3.dp)) {
        options.forEach { (k, label) ->
            val sel = k == on
            Box(Modifier.weight(1f).clip(RoundedCornerShape(9.dp)).background(if (sel) Color(0x14FFFFFF) else Color.Transparent).clickable { pick(k) }.padding(horizontal = 6.dp, vertical = 9.dp),
                contentAlignment = Alignment.Center) {
                // One line always (Randall 5 Nov: "Your packs · 1730" wrapped on a phone): the words shrink to fit, to 10 at least.
                androidx.compose.foundation.text.BasicText(label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, color = if (sel) Ink else Site.Muted,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center), maxLines = 1, softWrap = false,
                    autoSize = androidx.compose.foundation.text.TextAutoSize.StepBased(minFontSize = 10.sp, maxFontSize = 13.5.sp, stepSize = .5.sp))
            }
        }
    }
}

@Composable
private fun Empty(title: String, text: String) = Column(Modifier.fillMaxWidth().padding(vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(title, style = Site.CardTitle); Text(text, style = small)
}

@Composable
internal fun SearchField(value: String, hint: String, onChange: (String) -> Unit) {
    Box(Modifier.fillMaxWidth().height(44.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
        contentAlignment = Alignment.CenterStart) {
        if (value.isEmpty()) Text(hint, style = small.copy(fontSize = 15.sp))
        BasicTextField(value, { onChange(it.take(80)) }, singleLine = true, textStyle = TextStyle(fontFamily = Site.Manrope, fontSize = 15.sp, color = Ink),
            cursorBrush = SolidColor(Site.Gold), modifier = Modifier.fillMaxWidth())
    }
}

/** A native select: the chosen label in a quiet pill; the list drops below. */
@Composable
fun Select(label: String, options: List<Pair<String, String>>, on: String, modifier: Modifier = Modifier, pick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        Row(Modifier.height(44.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(12.dp)).clickable { open = true }
            .padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(options.firstOrNull { it.first == on }?.second ?: label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Ink), maxLines = 1)
            Text("▾", style = small)
        }
        DropdownMenu(open, { open = false }, containerColor = Site.Surface2) {
            options.forEach { (k, l) -> DropdownMenuItem({ Text(l, style = TextStyle(fontFamily = Site.Manrope, fontSize = 14.sp, color = if (k == on) Site.Gold else Ink)) }, { open = false; pick(k) }) }
        }
    }
}

@Composable
internal fun FilterBar(f: Trunk.Filter, sort: String, sets: List<Trunk.SetRow>, onFilter: (Trunk.Filter) -> Unit, onSort: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SearchField(f.query, "Card name") { onFilter(f.copy(query = it)) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // .pe-color-tabs: 44 px round buttons, 6 px apart.
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Trunk.COLORS.forEach { (k, _) ->
                    val on = f.color == k
                    Box(Modifier.size(44.dp).clip(CircleShape).background(if (on) Color(0x26E8B95B) else Color.Transparent)
                        .border(1.dp, if (on) Site.Gold else Site.Line, CircleShape).clickable { onFilter(f.copy(color = if (on) "" else k)) }, contentAlignment = Alignment.Center) {
                        Symbol(k, 24.dp, Modifier.alpha(if (f.color.isEmpty() || on) 1f else .55f))
                    }
                }
            }
            Select("All types", listOf("" to "All types") + Trunk.TYPES.map { it to it }, f.type) { onFilter(f.copy(type = it)) }
        }
        // .pe-rarity-tabs: 44 px pills, 14 px sides, DM Sans 700 13 px; the chosen one gold. The site wraps them; here they stay on one
        // row that scrolls sideways, so "Mythic" is never left alone on a second row at phone width (family T10, Randall's recording 10 Nov).
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Trunk.RARITIES.forEach { (k, l) -> val on = f.rarity == k
                Box(Modifier.height(44.dp).clip(CircleShape).background(if (on) Color(0x29E8B95B) else Color.Transparent).border(1.dp, if (on) Site.Gold else Site.Line, CircleShape)
                    .clickable { onFilter(f.copy(rarity = k)) }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
                    Text(l, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (on) Color(0xFFF6E4BB) else Site.Text))
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Select("Sort", Trunk.SORTS, sort) { onSort(it) }
            if (sets.size >= 2) Select("Every set", listOf("" to "Every set") + sets.map { it.code to "${it.name} (${it.code.uppercase()})" }, f.set, Modifier.weight(1f, fill = false)) { onFilter(f.copy(set = it)) }
        }
    }
}

@Composable
fun Chip(label: String, on: Boolean, onClick: () -> Unit) = Box(Modifier.height(36.dp).clip(RoundedCornerShape(18.dp))
    .background(if (on) Color(0x26E8B95B) else Site.Surface).border(1.dp, if (on) Color(0x80E8B95B) else Site.Line, RoundedCornerShape(18.dp)).clickable(onClick = onClick)
    .padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
    Text(label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (on) Site.Gold else Site.Muted))
}

/** playCardTile in the gallery view: .lot with 10 dp padding, 16 dp corners; art 63:88 with the finish. */
@Composable
private fun Tile(c: Trunk.Card, print: JsonObject?, fact: CardFacts.Fact?, data: CardData?, onHold: (image: String, set: String) -> Unit = { _, _ -> }, onClick: () -> Unit) {
    val rarity = print?.get("rarity")?.asString ?: c.r
    val set = print?.get("set")?.asString ?: c.pset ?: c.s.firstOrNull() ?: ""
    val number = print?.get("collector_number")?.asString ?: c.pnumber ?: ""
    val image = trunkImage(c, print, fact)
    // A printing that only comes in foil shows its foil whichever copy this is.
    val finish = Foil.finishFor(print, if (c.holo) "foil" else "nonfoil")
    val look = data?.let { Foil.look(it, print, finish) }
    // Holo copies shimmer on their own; the stamp only catches the light when tilted.
    val tilt = rememberFoilTilt(live = finish != "nonfoil", phase = (c.o.hashCode() and 0xff) / 255f, tile = true)
    // .pe-lot in the Trunk: no plate; the art (corners 4.6 % / 3.3 %, a 1.5 px #9aa3ad ring at 70 %, a soft drop shadow),
    // then the name (DM Sans 600 15 px) with its set badge, then Holo and the copy pips. The mana and set line is hidden (.lot-sub display none).
    // Controller: Start opens the card's actions, the same sheet the long press does.
    Column(Modifier.padActs(PadActs(a = "Open", y = PlayInspect.act(image, look?.takeIf { it.shines }), menu = PadAct("Menu") { onHold(image, set) })).combinedClickable(onLongClick = { onHold(image, set) }, onClick = onClick), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CardPicture(image, look?.takeIf { it.shines }, tilt, Modifier.fillMaxWidth().aspectRatio(63f / 88f)
            .drawBehind {
                // box-shadow 0 10px 24px -14px #000c: a soft shadow tucked under the bottom edge.
                drawIntoCanvas { cv -> val sp = 14.dp.toPx(); val pt = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true; color = Color(0xCC000000).toArgb()
                    maskFilter = android.graphics.BlurMaskFilter(12.dp.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                    cv.nativeCanvas.drawRect(sp, sp + 10.dp.toPx(), size.width - sp, size.height - sp + 10.dp.toPx(), pt) }
            }
            .drawWithContent { drawContent(); val w = 1.5.dp.toPx()
                // box-shadow 0 0 0 1.5px #9aa3adb3: a thin grey ring just outside the corners.
                drawRoundRect(Color(0xB39AA3AD), topLeft = androidx.compose.ui.geometry.Offset(-w / 2, -w / 2), size = androidx.compose.ui.geometry.Size(size.width + w, size.height + w),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.width * .046f + w / 2, size.height * .033f + w / 2), style = androidx.compose.ui.graphics.drawscope.Stroke(w)) },
            shape = CardCorner)
        FlowRow(Modifier.padding(horizontal = 2.dp), verticalArrangement = Arrangement.Center, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(c.n, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Ink, lineHeight = 18.75.sp))
            if (set.isNotBlank()) Box(Modifier.align(Alignment.CenterVertically)) { SetBadge(set, rarity) }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            if (c.holo) HoloTag() else Spacer(Modifier.width(1.dp))
            Pips(minOf(c.c, 4), c.holo)
        }
    }
}

/** playSetsTab: search, format chips, "N of M sets · K started", year sections of set tiles with Play progress. */
@Composable
private fun SetsTab(state: JsonObject, query: String, format: String, onQuery: (String) -> Unit, onFormat: (String) -> Unit, onSet: (String) -> Unit) {
    SetFacts_version()
    val all = Trunk.allSets(state)
    val q = query.trim().lowercase()
    val list = all.filter { (format.isEmpty() || (if (format == "started") it.owned > 0 else it.format == format)) && (q.isEmpty() || it.name.lowercase().contains(q) || it.code.contains(q)) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SearchField(query, "Search every set by name or code", onQuery)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { Trunk.SET_FORMATS.forEach { (k, l) -> Chip(l, format == k) { onFormat(k) } } }
        // Keep collecting: the sets you've started and not finished, newest first, each with its completion ring.
        val going = if (q.isEmpty() && format.isEmpty()) all.filter { it.owned > 0 && (it.total == null || it.owned < it.total) }.take(12) else emptyList()
        if (going.isNotEmpty()) {
            Text("Keep collecting", style = Site.Eyebrow)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) { going.forEach { x -> RingTile(x) { onSet(x.code) } } }
        }
        Text("${"%,d".format(list.size)} of ${"%,d".format(all.size)} sets · ${"%,d".format(all.count { it.owned > 0 })} started", style = small)
        if (list.isEmpty()) Empty("No sets match", "Try another format or name.")
        list.groupBy { it.released.take(4).ifBlank { "Other" } }.forEach { (year, rows) ->
            Text(year, style = Site.Eyebrow, modifier = Modifier.padding(top = 8.dp))
            rows.forEach { x -> SetTile(x) { onSet(x.code) } }
        }
    }
}

/** A started set as a glass card: its symbol large behind, a gold ring with how much of it you own, its name and count. */
@Composable
private fun RingTile(x: Trunk.SetRow, onClick: () -> Unit) {
    val pct = x.total?.takeIf { it > 0 }?.let { (x.owned.toFloat() / it).coerceIn(0f, 1f) } ?: 0f
    val shape = RoundedCornerShape(16.dp)
    Box(Modifier.size(150.dp, 118.dp).clip(shape).background(Brush.linearGradient(listOf(Color(0x1FD6AD64), Color(0x0AFFFFFF)))).border(1.dp, Color(0x40D6AD64), shape)
        .padActs(PadActs(a = "Open")).clickable(onClick = onClick).semantics { contentDescription = "${x.name}, ${(pct * 100).toInt()} percent" }) {
        SetIcon(x.code, Modifier.size(78.dp).align(Alignment.CenterStart).offset(x = (-10).dp).alpha(.14f), Color.White)
        Box(Modifier.align(Alignment.TopEnd).padding(8.dp).size(44.dp), contentAlignment = Alignment.Center) {
            androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
                val w = 4.dp.toPx(); val r = Size(size.width - w, size.height - w); val o = Offset(w / 2, w / 2)
                drawArc(Color(0xFF2A2730), 0f, 360f, false, o, r, style = Stroke(w))
                if (pct > 0f) drawArc(Brush.sweepGradient(listOf(Color(0xFFC99C4F), Color(0xFFF2D48F), Color(0xFFC99C4F))), -90f, 360f * pct, false, o, r, style = Stroke(w, cap = StrokeCap.Round))
            }
            Text("${(pct * 100).toInt()}%", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, color = Ink))
        }
        Column(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
            Text(x.name, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = Ink), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            Text("${"%,d".format(x.owned)} / ${x.total?.let { "%,d".format(it) } ?: "?"}", style = small.copy(fontSize = 11.sp))
        }
    }
}

@Composable
private fun SetTile(x: Trunk.SetRow, onClick: () -> Unit) {
    val pct = x.total?.takeIf { it > 0 }?.let { x.owned.toFloat() / it } ?: 0f
    Column(Modifier.fillMaxWidth().alpha(if (x.owned > 0) 1f else .55f).clip(RoundedCornerShape(14.dp)).background(Color(0x0DFFFFFF)).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(14.dp))
        .clickable(onClick = onClick).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x0FFFFFFF)), contentAlignment = Alignment.Center) { SetIcon(x.code, Modifier.size(32.dp), Color(0xFFE6E8EC)) }
            Column(Modifier.weight(1f)) {
                Text(x.name, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Ink))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(x.code.uppercase(), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Site.Gold),
                        modifier = Modifier.border(1.dp, Color(0x44D6AD64), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp))
                    Text(x.released.take(4), style = small.copy(fontSize = 12.sp))
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(x.total?.let { "%,d".format(it) } ?: "", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Ink))
                Text("cards", style = small.copy(fontSize = 12.sp))
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("${x.owned} / ${x.total ?: "?"} unique cards owned", style = small.copy(fontSize = 12.sp), modifier = Modifier.weight(1f))
            Text("${(pct * 100).toInt()}%", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFC9CED6)))
        }
        ProgressBar(pct)
    }
}

@Composable
fun ProgressBar(frac: Float, modifier: Modifier = Modifier) = Box(modifier.fillMaxWidth().height(5.dp).clip(CircleShape).background(if (AppSettings.theme == "light") Site.Surface2 else Color(0xFF1F2430))) {
    Box(Modifier.fillMaxWidth(frac.coerceIn(0f, 1f)).height(5.dp).clip(CircleShape).background(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFD6AD64), Color(0xFFF2D18E)))))
}

/**
 * The Trunk with its card view on top: the account's /api/progress state (device copy first), the
 * card sheet over the grid, and the Back order of the site (sheet first, then the screen).
 */
@Composable
fun TrunkRoute(onBack: () -> Unit, onWeb: (String) -> Unit, onNav: (PlayTab) -> Unit, startSet: String? = null, onSet: (String) -> Unit = {}, onShop: () -> Unit = {}) {
    val state by dev.cardstashy.nativeplay.play.Progress.state.collectAsState()
    val context = LocalContext.current
    var open by remember { mutableStateOf<CardPick?>(null) }
    var openTab by remember { mutableStateOf("overview") }
    var hold by remember { mutableStateOf<CardHold?>(null) }
    var artFor by remember { mutableStateOf<ArtPick.Card?>(null) }
    LaunchedEffect(Unit) { dev.cardstashy.nativeplay.play.Progress.loadCached(); dev.cardstashy.nativeplay.play.Progress.refresh() }
    val s = state ?: run { Box(Modifier.fillMaxSize().background(Site.Bg), contentAlignment = Alignment.Center) { Text("Opening your binder…", style = Site.Body) }; return }
    LaunchedEffect(s) { dev.cardstashy.nativeplay.play.SetFacts.ensure(Trunk.allSets(s).map { it.code }) }
    val toast = { m: String -> android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_SHORT).show() }
    Box(Modifier.fillMaxSize()) {
        TrunkScreen(s, onBack, { openTab = "overview"; open = it }, onSet, null, onHold = { hold = it }) { PlayNav(PlayTab.TRUNK, onNav) }
        hold?.let { h -> PlayCardHold(h, onOpen = { tab -> hold = null; openTab = tab; open = h.pick }, onSet = { hold = null; onSet(h.set) },
            onMerchant = { hold = null; onSet(h.set) }, onArt = { hold = null; artFor = it }, onClose = { hold = null }) }
        artFor?.let { c -> UseArtworkAs(c) { artFor = null } }
        open?.let { pick ->
            CardSheet(pick, s, startTab = openTab, act = CardSheetActions(
                merchant = { code, _ -> open = null; onSet(code) },
                set = { code -> open = null; onSet(code) },
                precon = { _, _ -> open = null; onWeb("https://cardstashy.com/#play") },
                newDeck = { open = null; onWeb("https://cardstashy.com/#play") },
                toast = toast), onClose = { open = null })
        }
    }
}

/**
 * Hold a card in Play: the Play side's own actions (Play decks, seals, packs, set), never the Collection's
 * (no prices, wishlist or binders). Each is a shortcut into the card view, which has them all.
 */
@Composable
fun PlayCardHold(h: CardHold, onOpen: (tab: String) -> Unit, onSet: () -> Unit, onMerchant: () -> Unit, onArt: (ArtPick.Card) -> Unit, onClose: () -> Unit) {
    val art = h.image.replace("/normal/", "/art_crop/").replace("version=normal", "version=art_crop")
    ContextSheet("Card actions", h.pick.name, listOfNotNull(h.set.uppercase().ifBlank { null }, if (h.holo) "Holo" else null).joinToString(" · "), h.image, listOf(
        listOf(ContextAction(SiteIcons.CardStack, "Open card", "Rules, play guide and printings") { onOpen("overview") },
            ContextAction(SiteIcons.Decks, "Add to deck", "One of your Play decks") { onOpen("overview") },
            ContextAction(SiteIcons.Trunk, "Get it", "Stamp a copy or make it holo with seals") { onOpen("get") }),
        listOfNotNull(if (h.set.isNotBlank()) ContextAction(SiteIcons.PackIcon, "Its pack at the Merchant") { onMerchant() } else null,
            if (h.set.isNotBlank()) ContextAction(SiteIcons.ViewGallery, "See the whole set") { onSet() } else null),
        listOf(ContextAction(SiteIcons.Paint, "Use artwork as…") { onArt(ArtPick.Card("mtg", h.pick.printId ?: h.pick.oracle, h.pick.name, h.set.uppercase(), art, art)) })), onClose)
}
