package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.zIndex
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.play.CardFacts
import kotlin.math.roundToInt

/**
 * The match menu and the deck tracker, ported from forge-table.mjs (foldMenu, renderTracker, setTracker, placeTracker) and
 * play-forge-table.css (.forge-menu-panel, .forge-tracker). One menu button: History & stack and the deck tracker live inside it.
 */
class MatchMenu(input: String?, val onConcede: () -> Unit, val onLeave: () -> Unit) {
    /** One row of your main deck (play-forge-player-mat.js trackerDeck): name and copies. */
    data class Row(val name: String, val qty: Int)
    val deck: List<Row> = runCatching {
        val o = JsonParser.parseString(input ?: "").asJsonObject.let { it.getAsJsonObject("input") ?: it }
        o.getAsJsonObject("humanDeck")?.getAsJsonArray("cards")?.mapNotNull { (it as? JsonObject)?.let { r -> Row(r.get("name")?.asString ?: return@let null, r.get("qty")?.asInt ?: 0) } }
            ?.filter { it.name.isNotBlank() && it.qty > 0 } ?: emptyList()
    }.getOrDefault(emptyList())

    var open by mutableStateOf(false)
    var history by mutableStateOf(false)
    /** "concede" or "leave" while its confirm is up: leaving a match always asks first (Thor run 10 Nov, pad presses left a match). */
    var ask by mutableStateOf<String?>(null)
    /** The match told in plain words (HistoryPanel's Story), kept for the whole match. */
    val story = Story()
    /** "deck" or "opponent" while the tracker shows (cardstashy.tracker), else null. */
    var tracker by mutableStateOf(saved())
        private set

    fun showTracker(side: String?) {
        tracker = side
        try { prefs?.edit()?.putString(KEY, side ?: "")?.apply() } catch (_: Exception) {}
    }

    /** trackerSeen: the CPU's cards, remembered once shown so a card that leaves play still counts. */
    internal class Seen(val name: String, val cost: String)
    internal val seen = LinkedHashMap<Int, Seen>()
    /** trackerIdentity: the deck-list name a physical card first showed under (a transformed card keeps it). */
    private val identity = HashMap<Int, String>()

    internal fun see(st: MatchState) {
        for (p in st.players) if (p.id != st.viewer) for (c in p.battlefield + p.graveyard + p.exile + p.command)
            if (!c.hidden && !c.token && c.id !in seen) seen[c.id] = Seen(c.name, c.manaCost)
        for (s in st.stack) s.source?.let { c -> if (c.owner != st.viewer && !c.hidden && !c.token && c.zone != "Library" && c.zone != "Hand" && c.id !in seen) seen[c.id] = Seen(c.name, c.manaCost) }
    }

    internal fun deckName(id: Int, name: String, listed: Map<String, String>): String = identity.getOrPut(id) {
        (sequenceOf(name) + name.split(" // ").asSequence()).firstOrNull { it in listed }?.let { listed.getValue(it) } ?: name
    }

    companion object {
        private const val KEY = "cardstashy.tracker"
        private var prefs: android.content.SharedPreferences? = null
        fun init(context: Context) { prefs = context.applicationContext.getSharedPreferences("play", Context.MODE_PRIVATE) }
        private fun saved(): String? = try { prefs?.getString(KEY, "")?.takeIf { it == "deck" || it == "opponent" } } catch (_: Exception) { null }
        private val BASIC_LAND = Regex("^(Plains|Island|Swamp|Mountain|Forest|Wastes|Snow-Covered (Plains|Island|Swamp|Mountain|Forest))$")
        private val factsByName = HashMap<String, CardFacts.Fact?>()
        internal fun fact(name: String): CardFacts.Fact? = factsByName.getOrPut(name) {
            CardFacts.cards.value.values.firstOrNull { val n = it.card.get("name")?.asString ?: ""; n == name || n.split(" // ")[0] == name }
        }
        /** trackerDeck land: the card's type line when known, else a basic land's name. */
        internal fun isLand(name: String, seenType: String?): Boolean =
            seenType?.let { Regex("\\bLand\\b").containsMatchIn(it) } ?: fact(name)?.t?.let { Regex("\\bLand\\b").containsMatchIn(it) } ?: BASIC_LAND.matches(name)
    }
}

private const val TRACKER_ICON = "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 9h6M9 13h6"
private const val LANDS_ICON = "M3 20l6-10 4 6 3-4 5 8z"

/** .forge-menu-panel: under the menu button (top: 100% + 8px, left 0), min-width 220, padding 8, gap 4, radius 16, #11141bf2, #ffffff1a hairline. */
@Composable
internal fun MenuPanel(menu: MatchMenu, stackCount: Int, d: Du, x: Dp, y: Dp) = with(d) {
    // A tap anywhere else closes the menu. It is no stop for the controller's ring (B and Start close the menu there).
    Box(Modifier.fillMaxSize().zIndex(39f).focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) { menu.open = false })
    val pop = remember { Animatable(0f) }
    LaunchedEffect(Unit) { pop.animateTo(1f, tween(if (Motion.still) 0 else 180)) }
    // A controller: the ring starts on the first row; B and Start close the menu (B would otherwise leave the match). A phone with no pad is as it was.
    val padOn = Pad.connected.collectAsState().value
    val first = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (Pad.connected.value) runCatching { first.requestFocus() } }
    androidx.activity.compose.BackHandler(padOn) { menu.open = false }
    PadScreen(PadActs(b = "Close", start = PadAct("Close") { menu.open = false }, opaque = true))
    // Two screens (W3): the menu opens on the bottom so the table stays in view. The rows stay on top as the ring's stops, unseen,
    // and the bottom lights the row the ring is on; a finger uses the bottom's rows.
    val dual = DualScreen.active
    var ringAt by remember { mutableIntStateOf(-1) }
    data class Item(val label: String, val on: Boolean, val danger: Boolean, val run: () -> Unit)
    val items = buildList {
        if (menu.deck.isNotEmpty()) add(Item("Deck tracker", menu.tracker != null, false) { menu.showTracker(if (menu.tracker != null) null else "deck") })
        add(Item("History & stack" + if (stackCount > 0) " · $stackCount" else "", menu.history, false) { menu.history = !menu.history })
        add(Item("Concede", false, true) { menu.open = false; menu.ask = "concede" })
        add(Item("Return to Play setup", false, false) { menu.open = false; menu.ask = "leave" })
    }
    if (dual) BottomScreen {
        ShowcaseCase("Match", "Menu", scroll = false) {
            items.forEachIndexed { i, it ->
                val shape = RoundedCornerShape(Rule.Radius.Panel)
                Row(Modifier.fillMaxWidth().heightIn(min = 72.dp).clip(shape).background(if (it.on) Rule.Color.GoldEdge.copy(alpha = .25f) else Rule.Color.Glass)
                    .border(if (i == ringAt) 2.dp else 1.dp, if (i == ringAt) Rule.Color.CtaTop else Rule.Color.Edge, shape).clickable(onClick = it.run).padding(horizontal = 22.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(it.label, style = Rule.Type.sans(20, FontWeight.Bold, if (it.danger) Rule.Color.Coral else if (it.on) Rule.Color.Gold else Rule.Color.Text), modifier = Modifier.weight(1f))
                    if (it.on) Text("✓", style = Rule.Type.sans(20, FontWeight.Bold, Rule.Color.Gold))
                }
            }
        }
    }
    // With no controller the bottom rows are the only ones (nothing unseen to tap on the table).
    if (dual && !padOn) return@with
    Column(Modifier.padLayer().offset(x = x, y = y).zIndex(40f).graphicsLayer { if (dual) alpha = 0f }.onFocusChanged { if (it.hasFocus) TablePad.held = true }.graphicsLayer { alpha = pop.value; translationY = (1 - pop.value) * -6 * u * density }
        .widthIn(min = 220.du).clip(RoundedCornerShape(16.du)).background(Color(0xF211141B)).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(16.du))
        .padding(8.du), verticalArrangement = Arrangement.spacedBy(4.du)) {
        var n = 0
        @Composable fun item(label: String, on: Boolean = false, icon: String? = null, focus: FocusRequester? = null, onClick: () -> Unit) {
            val idx = n++
            Row(Modifier.widthIn(min = 204.du).heightIn(min = 42.du).clip(RoundedCornerShape(10.du)).background(if (on) Color(0x1AE8B95B) else Color.Transparent)
                .onFocusChanged { f -> if (f.isFocused) ringAt = idx else if (ringAt == idx) ringAt = -1 }
                .then(if (focus != null) Modifier.focusRequester(focus) else Modifier)
                .clickable(onClick = onClick).padding(horizontal = 12.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.du)) {
                if (icon != null) StrokeIcon(icon, Color(0xFFE9D4A4), 17.du, stroke = 1.8f)
                Text(label, style = sans(sp(13.5f), FontWeight.SemiBold, if (on) Color(0xFFF4D78F) else Color(0xFFEEF0F3)))
            }
        }
        if (menu.deck.isNotEmpty()) item("Deck tracker", menu.tracker != null, TRACKER_ICON, focus = first) { menu.showTracker(if (menu.tracker != null) null else "deck") }
        item("History & stack" + if (stackCount > 0) " · $stackCount" else "", menu.history, focus = if (menu.deck.isEmpty()) first else null) { menu.history = !menu.history }
        item("Concede") { menu.open = false; menu.ask = "concede" }
        item("Return to Play setup") { menu.open = false; menu.ask = "leave" }
    }
}

/** .forge-tracker: 210 px (coarse pointer), left 8 (measured), the no-blur fill (#0f1218ee, the site's low-power fallback: Compose has no backdrop blur), top header bottom + 10, down to 12 px above your seat. Library / Opponent tabs and a close. */
@Composable
internal fun DeckTracker(st: MatchState, menu: MatchMenu, H: Dp, d: Du, x: Dp, top: Dp) = with(d) {
    val side = menu.tracker ?: return@with
    menu.see(st)
    val me = st.me; val lib = me.libraryCount.coerceAtLeast(0)
    // Your library: the deck list minus every copy you can see anywhere else.
    val listed = LinkedHashMap<String, String>().apply { for (r in menu.deck) for (n in listOf(r.name) + r.name.split(" // ")) if (n !in this) put(n, r.name) }
    val types = HashMap<String, String>(); val costs = HashMap<String, String>()
    val out = HashMap<String, Int>()
    val mine = (me.hand + me.battlefield + me.graveyard + me.exile + me.command + st.stack.mapNotNull { it.source }.filter { it.owner == st.viewer }).filter { !it.hidden && !it.token }
    for (c in mine) { val n = menu.deckName(c.id, c.name, listed); out[n] = (out[n] ?: 0) + 1; types[n] = c.type; if (c.manaCost.isNotBlank()) costs[n] = c.manaCost }
    data class Left(val name: String, val qty: Int, val left: Int, val land: Boolean, val cost: String)
    val left = menu.deck.map { r -> Left(r.name, r.qty, (r.qty - (out[r.name] ?: 0)).coerceAtLeast(0), MatchMenu.isLand(r.name, types[r.name]), costs[r.name] ?: MatchMenu.fact(r.name)?.mc ?: "") }
    val landsLeft = left.filter { it.land }.sumOf { it.left }; val landsTotal = left.filter { it.land }.sumOf { it.qty }
    fun pct(n: Int, of: Int) = if (of > 0) "${(n * 100f / of).roundToInt()}%" else "0%"
    val seen = LinkedHashMap<String, Pair<MatchMenu.Seen, Int>>().apply { for (v in menu.seen.values) put(v.name, (get(v.name)?.let { it.first to it.second + 1 }) ?: (v to 1)) }

    val pop = remember { Animatable(0f) }
    LaunchedEffect(Unit) { pop.animateTo(1f, tween(if (Motion.still) 0 else 180)) }
    // A controller's LB / RB: the tracker's own Library and Opponent tabs.
    PadScreen(PadActs(tabs = { dir -> menu.showTracker(if (dir < 0) "deck" else "opponent") }))
    val maxH = maxOf(160.du, H - 98.du - top)
    val shape = RoundedCornerShape(16.du)
    Column(Modifier.offset(x = x, y = top).zIndex(25f).graphicsLayer { alpha = pop.value; translationY = (1 - pop.value) * -6 * u * density; val s = .98f + .02f * pop.value; scaleX = s; scaleY = s }
        .width(210.du).heightIn(max = maxH).clip(shape)
        .background(Color(0xEE0F1218)).background(Brush.linearGradient(listOf(Color(0x12FFFFFF), Color(0x02FFFFFF), Color.Transparent)))
        .border(1.dp, Color(0x1FFFFFFF), shape)) {
        // header: tabs and a close (padding 6 6 6 8, gap 6), a #ffffff12 rule under it.
        Row(Modifier.fillMaxWidth().padding(start = 8.du, end = 6.du, top = 6.du, bottom = 6.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.du)) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(2.du)) {
                for ((k, l, n) in listOf(Triple("deck", "Library", lib), Triple("opponent", "Opponent", menu.seen.size))) {
                    val on = side == k
                    Row(Modifier.weight(if (k == "deck") 1f else 1.25f).heightIn(min = 34.du).clip(RoundedCornerShape(9.du)).background(if (on) Color(0x1FE8B95B) else Color.Transparent)
                        .clickable { if (!on) menu.showTracker(k) }.padding(horizontal = 4.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.du, Alignment.CenterHorizontally)) {
                        val ink = if (on) Color(0xFFF4E3BD) else Color(0xFF9AA2B1)
                        Text(l.uppercase(), style = sans(sp(11f), FontWeight.Bold, ink).copy(letterSpacing = .1.em), maxLines = 1)
                        Text("$n", style = sans(sp(11f), FontWeight.Bold, ink), modifier = Modifier.alpha(.75f))
                    }
                }
            }
            Box(Modifier.size(34.du).clip(CircleShape).background(Color(0x0DFFFFFF)).clickable { menu.showTracker(null) }, contentAlignment = Alignment.Center) {
                Text("×", style = sans(sp(20f), FontWeight.Normal, Color(0xFFCFD3DA)))
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x12FFFFFF)))
        @Composable fun row(name: String, cost: String, count: Int, sub: String) =
            Row(Modifier.fillMaxWidth().alpha(if (count > 0) 1f else .38f).padding(horizontal = 6.du, vertical = 4.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.du)) {
                Box(Modifier.size(30.du, 22.du).clip(RoundedCornerShape(5.du)).background(Color(0x10FFFFFF)).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(5.du))) {
                    CardImage(name, Modifier.fillMaxSize(), crop = true)
                }
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.du)) {
                    Text(name, style = sans(sp(12.5f), FontWeight.SemiBold, Color(0xFFEEF0F3)), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    if (cost.isNotBlank()) ManaCost(cost, 12.du)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("$count", style = sans(sp(13f), FontWeight.ExtraBold, Color(0xFFF4E3BD)))
                    if (sub.isNotEmpty()) Text(sub, style = sans(sp(11f), FontWeight.SemiBold, Color(0xFF8E96A4)), modifier = Modifier.padding(top = 2.du))
                }
            }
        if (side == "deck") {
            val rows = left.filter { !it.land }.sortedWith(compareBy<Left>({ if (it.left > 0) 0 else 1 }, { it.name.lowercase() }))
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(4.du)) { rows.forEach { row(it.name, it.cost, it.left, if (it.left > 0) pct(it.left, lib) else "") } }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x12FFFFFF)))
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.du, vertical = 9.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.du)) {
                StrokeIcon(LANDS_ICON, Color(0xFFE8B95B), 15.du, stroke = 1.8f)
                Text("Lands", style = sans(sp(12f), FontWeight.SemiBold, Color(0xFFCFD4DC)), modifier = Modifier.weight(1f))
                Text("$landsLeft/$landsTotal", style = sans(sp(12f), FontWeight.Bold, Color(0xFFF4E3BD)))
                Text(pct(landsLeft, lib), style = sans(sp(11f), FontWeight.SemiBold, Color(0xFF8E96A4)))
            }
        } else if (seen.isEmpty()) Text("Nothing shown yet.", style = sans(sp(12.5f), FontWeight.Medium, Color(0xFF9AA2B1)), modifier = Modifier.padding(horizontal = 12.du, vertical = 14.du))
        else Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(4.du)) { seen.values.forEach { (v, n) -> row(v.name, v.cost, n, "") } }
    }
}

/** The confirm behind Concede and Return to Play setup: one sheet, Cancel and the action; X does it, B cancels. */
@Composable
fun MatchLeaveConfirm(menu: MatchMenu) {
    val k = menu.ask ?: return
    val concede = k == "concede"
    RuleConfirm(text = if (concede) "The CPU wins this match." else "The match ends here and you go back to Play setup.",
        action = if (concede) "Concede" else "Leave", title = if (concede) "Concede the match?" else "Leave the match?", danger = true,
        onAction = { menu.ask = null; if (concede) menu.onConcede() else menu.onLeave() }, onCancel = { menu.ask = null })
}
