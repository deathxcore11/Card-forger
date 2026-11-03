@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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

private val Ink = Site.Text
private val small = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = Site.Muted)

/**
 * The Trunk, collectionMarkup in play-econ-ui.js: Cards and Sets. Cards = the filter bar (name, colour,
 * type, rarity, sort, set), "N of M cards", then the app's gallery tiles (2 a row on a phone, 170 dp and up
 * on wide screens) with the card's finish, name, set badge, mana cost, set and number, and pips or Holo.
 */
@Composable
fun TrunkScreen(state: JsonObject, onBack: () -> Unit, onCard: (CardPick) -> Unit, onSet: (String) -> Unit, startSet: String? = null, nav: @Composable () -> Unit) {
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
    val data = remember { runCatching { CardData.load(context) }.getOrNull() }

    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val cols = if (maxWidth < 600.dp) GridCells.Fixed(2) else GridCells.Adaptive(170.dp)
            val gap = if (maxWidth < 700.dp) 10.dp else 16.dp
            LazyVerticalGrid(cols, Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
                horizontalArrangement = Arrangement.spacedBy(gap), verticalArrangement = Arrangement.spacedBy(gap)) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        PageHeader("Collection", "Play", onBack = onBack)
                        Segmented(listOf("cards" to "Cards", "sets" to "Sets"), tab) { tab = it }
                    }
                }
                if (tab == "cards") {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        FilterBar(filter, sort, sets, { filter = it }) { sort = it; prefs.edit().putString("trunkSort", it).apply() }
                    }
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Text("${"%,d".format(matched.size)} of ${"%,d".format(all.size)} cards", style = small)
                    }
                    if (shown.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                        Empty(if (all.isNotEmpty()) "No cards match" else "Your binder is empty", if (all.isNotEmpty()) "Try another name, colour or type." else "Open a pack to start your Play collection.")
                    }
                    items(shown, key = { it.o + if (it.holo) ":h" else "" }) { c ->
                        val print = c.pid?.let { prints[it] } ?: facts[c.o]?.card
                        Tile(c, print, facts[c.o], data) { onCard(CardPick(c.n, c.o, c.pid ?: print?.get("id")?.asString, if (c.holo) "foil" else "nonfoil")) }
                    }
                } else {
                    item(span = { GridItemSpan(maxLineSpan) }) { SetsTab(state, setQuery, setFormat, { setQuery = it }, { setFormat = it }, onSet) }
                }
            }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
}

@Composable private fun SetFacts_version() = dev.cardstashy.nativeplay.play.SetFacts.sets.collectAsState().value.size

/** .seg: the app's two-way switch (12 dp plate, 9 dp pill on the chosen one). */
@Composable
fun Segmented(options: List<Pair<String, String>>, on: String, modifier: Modifier = Modifier, pick: (String) -> Unit) {
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(12.dp)).padding(3.dp)) {
        options.forEach { (k, label) ->
            val sel = k == on
            Box(Modifier.weight(1f).clip(RoundedCornerShape(9.dp)).background(if (sel) Color(0x14FFFFFF) else Color.Transparent).clickable { pick(k) }.padding(vertical = 9.dp),
                contentAlignment = Alignment.Center) {
                Text(label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, color = if (sel) Ink else Site.Muted))
            }
        }
    }
}

@Composable
private fun Empty(title: String, text: String) = Column(Modifier.fillMaxWidth().padding(vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(title, style = Site.CardTitle); Text(text, style = small)
}

@Composable
private fun SearchField(value: String, hint: String, onChange: (String) -> Unit) {
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
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Trunk.COLORS.forEach { (k, _) ->
                    val on = f.color == k
                    Box(Modifier.size(36.dp).clip(CircleShape).background(if (on) Color(0x26E8B95B) else Site.Surface)
                        .border(1.dp, if (on) Site.Gold else Site.Line, CircleShape).clickable { onFilter(f.copy(color = if (on) "" else k)) }, contentAlignment = Alignment.Center) {
                        Symbol(k, 20.dp, Modifier.alpha(if (f.color.isEmpty() || on) 1f else .55f))
                    }
                }
            }
            Select("All types", listOf("" to "All types") + Trunk.TYPES.map { it to it }, f.type) { onFilter(f.copy(type = it)) }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Trunk.RARITIES.forEach { (k, l) -> Chip(l, f.rarity == k) { onFilter(f.copy(rarity = k)) } }
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
private fun Tile(c: Trunk.Card, print: JsonObject?, fact: CardFacts.Fact?, data: CardData?, onClick: () -> Unit) {
    val rarity = print?.get("rarity")?.asString ?: c.r
    val set = print?.get("set")?.asString ?: c.pset ?: c.s.firstOrNull() ?: ""
    val number = print?.get("collector_number")?.asString ?: c.pnumber ?: ""
    val image = print?.let { p -> p.getAsJsonObject("image_uris")?.get("normal")?.asString ?: p.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")?.get("normal")?.asString }
        ?: c.pimage ?: fact?.i ?: "https://api.scryfall.com/cards/named?format=image&version=normal&exact=" + java.net.URLEncoder.encode(c.n, "UTF-8")
    val look = data?.let { Foil.look(it, print, if (c.holo) "foil" else "nonfoil") }
    // Holo copies shimmer on their own; the stamp only catches the light when tilted.
    val tilt = rememberFoilTilt(live = c.holo, phase = (c.o.hashCode() and 0xff) / 255f)
    Column(Modifier.clip(RoundedCornerShape(16.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        CardPicture(image, look?.takeIf { it.shines }, tilt, Modifier.fillMaxWidth().aspectRatio(63f / 88f))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            FlowRow(verticalArrangement = Arrangement.Center, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(c.n, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 14.5.sp, color = Ink, lineHeight = 19.sp))
                if (set.isNotBlank()) Box(Modifier.align(Alignment.CenterVertically)) { SetBadge(set, rarity) }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.Center) {
                ManaCost(fact?.mc ?: "", 14.dp, Modifier.align(Alignment.CenterVertically))
                Text(set.uppercase() + if (number.isNotBlank()) " #$number" else "", style = small.copy(fontSize = 11.sp, lineHeight = 16.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
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
        Text("${"%,d".format(list.size)} of ${"%,d".format(all.size)} sets · ${"%,d".format(all.count { it.owned > 0 })} started", style = small)
        if (list.isEmpty()) Empty("No sets match", "Try another format or name.")
        list.groupBy { it.released.take(4).ifBlank { "Other" } }.forEach { (year, rows) ->
            Text(year, style = Site.Eyebrow, modifier = Modifier.padding(top = 8.dp))
            rows.forEach { x -> SetTile(x) { onSet(x.code) } }
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
fun ProgressBar(frac: Float, modifier: Modifier = Modifier) = Box(modifier.fillMaxWidth().height(5.dp).clip(CircleShape).background(Color(0xFF1F2430))) {
    Box(Modifier.fillMaxWidth(frac.coerceIn(0f, 1f)).height(5.dp).clip(CircleShape).background(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFD6AD64), Color(0xFFF2D18E)))))
}

/**
 * The Trunk with its card view on top: the account's /api/progress state (device copy first), the
 * card sheet over the grid, and the Back order of the site (sheet first, then the screen).
 */
@Composable
fun TrunkRoute(onBack: () -> Unit, onWeb: (String) -> Unit, onNav: (PlayTab) -> Unit, startSet: String? = null) {
    val state by dev.cardstashy.nativeplay.play.Progress.state.collectAsState()
    val context = LocalContext.current
    var open by remember { mutableStateOf<CardPick?>(null) }
    LaunchedEffect(Unit) { dev.cardstashy.nativeplay.play.Progress.loadCached(); dev.cardstashy.nativeplay.play.Progress.refresh() }
    val s = state ?: run { Box(Modifier.fillMaxSize().background(Site.Bg), contentAlignment = Alignment.Center) { Text("Opening your binder…", style = Site.Body) }; return }
    LaunchedEffect(s) { dev.cardstashy.nativeplay.play.SetFacts.ensure(Trunk.allSets(s).map { it.code }) }
    val toast = { m: String -> android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_SHORT).show() }
    Box(Modifier.fillMaxSize()) {
        TrunkScreen(s, onBack, { open = it }, { onWeb("https://cardstashy.com/#set/$it/play") }, startSet) { PlayNav(PlayTab.TRUNK, onNav) }
        open?.let { pick ->
            CardSheet(pick, s, CardSheetActions(
                merchant = { _, _ -> open = null; onWeb("https://cardstashy.com/#play") },
                set = { code -> open = null; onWeb("https://cardstashy.com/#set/$code/play") },
                precon = { _, _ -> open = null; onWeb("https://cardstashy.com/#play") },
                newDeck = { open = null; onWeb("https://cardstashy.com/#play") },
                toast = toast), onClose = { open = null })
        }
    }
}
