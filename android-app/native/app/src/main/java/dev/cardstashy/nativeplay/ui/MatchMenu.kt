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
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
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
    // On two screens the tracker is a bottom case you open when you want it: never brought back open from an earlier match (U7).
    var tracker by mutableStateOf(if (DualScreen.active) null else saved())
        private set

    fun showTracker(side: String?) {
        tracker = side
        if (DualScreen.active) return
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
            (seenType ?: fact(name)?.t ?: dev.cardstashy.nativeplay.art.CardArt.typeLine(name))?.let { Regex("\\bLand\\b").containsMatchIn(it) } ?: BASIC_LAND.matches(name)
    }
}

private const val LANDS_ICON = "M3 20l6-10 4 6 3-4 5 8z"

/** What you can do from the match menu, as lines. Showing the tracker or the history closes the menu, so the table shows it. */
internal fun matchMenuActions(menu: MatchMenu, stackCount: Int): List<ConsoleRow> = buildList {
    add(ConsoleRow("resume", "Resume", "", ConsoleCtl.Go(verb = "Resume") { menu.open = false }))
    val tracking = menu.tracker != null
    if (menu.deck.isNotEmpty()) add(ConsoleRow("tracker", "Deck tracker", "",
        ConsoleCtl.Go(value = if (tracking) "On" else "Off", verb = if (tracking) "Hide" else "Show") { menu.showTracker(if (tracking) null else "deck"); if (!tracking) menu.open = false }))
    add(ConsoleRow("history", "History and stack", "",
        ConsoleCtl.Go(value = if (menu.history) "On" else if (stackCount > 0) "$stackCount on the stack" else "Off", verb = if (menu.history) "Hide" else "Show") { menu.history = !menu.history; if (menu.history) menu.open = false }))
    add(ConsoleRow("concede", "Concede", "", ConsoleCtl.Go(verb = "Concede") { menu.open = false; menu.ask = "concede" }, danger = true))
    add(ConsoleRow("leave", "Return to Play setup", "", ConsoleCtl.Go(verb = "Leave") { menu.open = false; menu.ask = "leave" }))
}

/** The settings you reach for mid-game: Settings' own lines (Gameplay's four, and Sound's two volumes), so they read and act the same. */
internal fun matchMenuSettings(): List<ConsoleRow> = gameplayItems().rows() + soundItems {}.rows().filter { it.id == "music" || it.id == "sfx" }

/**
 * The match menu in the Console look (Randall's pick of 14 Nov 2026): what you can do at the left, the settings you reach for
 * mid-game at the right (new: Settings could not be opened from a match), and under them what the line you are on does.
 * It is called Match menu, not Paused: the turn clock keeps running. On two screens it is the bottom screen, so the table stays
 * in view; the lines stay on top, unseen, as the ring's stops, and the bottom lights the one the ring is on.
 */
@Composable
internal fun MenuPanel(menu: MatchMenu, stackCount: Int, @Suppress("UNUSED_PARAMETER") d: Du, @Suppress("UNUSED_PARAMETER") x: Dp, @Suppress("UNUSED_PARAMETER") y: Dp) {
    // With motion still it is simply there (and a test picture of its first frame shows it).
    val pop = remember { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(Unit) { pop.animateTo(1f, tween(if (Motion.still) 0 else 180)) }
    val padOn = Pad.connected.collectAsState().value
    // Back, B and Start close the menu (B would otherwise leave the match).
    androidx.activity.compose.BackHandler { menu.open = false }
    PadScreen(PadActs(b = "Resume", start = PadAct("Resume") { menu.open = false }, opaque = true))
    val dual = DualScreen.active
    var focus by remember { mutableStateOf("resume") }
    val actions = matchMenuActions(menu, stackCount); val settings = matchMenuSettings()
    if (dual) BottomScreen { Box(Modifier.fillMaxSize().background(Rule.Console.NightSolid)) { MatchMenuBody(actions, settings, focus, { focus = it }, ConsoleRing.NONE, wide = true, short = false, fill = true) } }
    val quiet = remember { MutableInteractionSource() }
    // A tap anywhere else closes the menu. With two screens and no controller the bottom's lines are the only ones (nothing unseen to tap on the table).
    // Only the veil fades in (polish pass, art): the card is whole from its first frame, so it never shows the table through it.
    val veil = Rule.Console.Veil
    Box(Modifier.fillMaxSize().zIndex(40f).graphicsLayer { alpha = if (dual) 0f else 1f }.then(if (dual) Modifier else Modifier.drawBehind { drawRect(veil, alpha = pop.value.coerceIn(0f, 1f)) })
        .focusProperties { canFocus = false }.clickable(quiet, null) { menu.open = false }, contentAlignment = Alignment.Center) {
        if (!dual || padOn) androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxSize().padding(8.dp), contentAlignment = Alignment.Center) {
            val shape = RoundedCornerShape(Rule.Radius.Sheet)
            val wide = maxWidth >= 560.dp; val short = maxHeight < 440.dp; val tall = maxHeight
            Box(Modifier.padLayer().onFocusChanged { if (it.hasFocus) TablePad.held = true }.graphicsLayer { val k = .96f + .04f * pop.value; scaleX = k; scaleY = k }
                .widthIn(max = 780.dp).fillMaxWidth().heightIn(max = tall).clip(shape).background(Brush.verticalGradient(listOf(Site.Surface, Site.Bg))).border(1.dp, Site.Line, shape)
                .clickable(remember { MutableInteractionSource() }, null) {}) {
                MatchMenuBody(actions, settings, focus, { focus = it }, ConsoleRing.TAKE, wide = wide, short = short)
            }
        }
    }
}

/** The menu's two lists and the words under them. [wide]: side by side; [short]: no room for the Settings heading (a phone on its side). */
@Composable
private fun MatchMenuBody(actions: List<ConsoleRow>, settings: List<ConsoleRow>, focus: String, onFocus: (String) -> Unit, ring: ConsoleRing, wide: Boolean, short: Boolean,
                          fill: Boolean = false) {
    val current = (actions + settings).firstOrNull { it.id == focus } ?: actions.first()
    // The d-pad's left and right change a setting, so up from the first setting goes back to the actions (to Resume when they stand
    // side by side, polish pass UX), and down from the last action on to the settings.
    val firstAction = remember { FocusRequester() }; val lastAction = remember { FocusRequester() }; val firstSetting = remember { FocusRequester() }
    val left: @Composable () -> Unit = {
        actions.forEachIndexed { i, r -> androidx.compose.runtime.key(r.id) {
            ConsoleLine(r, r.id == current.id, { onFocus(r.id) }, if (r.id == current.id) ring else ring.quiet(),
                if (ring == ConsoleRing.NONE) Modifier
                else (if (i == 0) Modifier.focusRequester(firstAction) else Modifier).then(if (i == actions.lastIndex) Modifier.focusRequester(lastAction).focusProperties { down = firstSetting } else Modifier))
        } }
    }
    val right: @Composable () -> Unit = {
        if (!short || !wide) ConsoleHead("Settings")
        settings.forEachIndexed { i, r -> androidx.compose.runtime.key(r.id) {
            ConsoleLine(r, r.id == current.id, { onFocus(r.id) }, ring.quiet(),
                if (i == 0 && ring != ConsoleRing.NONE) Modifier.focusRequester(firstSetting).focusProperties { up = if (wide) firstAction else lastAction } else Modifier)
        } }
    }
    // [fill]: the bottom screen is all menu, so the lists take its height and the words sit at its foot.
    Column(if (fill) Modifier.fillMaxSize() else Modifier.fillMaxWidth()) {
        Text("MATCH MENU", Modifier.padding(start = 18.dp, end = 18.dp, top = if (short) 8.dp else 14.dp, bottom = 4.dp).semantics { heading(); contentDescription = "Match menu" },
            style = Rule.Type.cinzel(if (short) 16 else 20).copy(letterSpacing = .08.em), maxLines = 1)
        if (wide) Row(Modifier.weight(1f, fill = fill).fillMaxWidth()) {
            Column(Modifier.weight(.85f).verticalScroll(rememberScrollState())) { left() }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) { right() }
        } else Column(Modifier.weight(1f, fill = fill).fillMaxWidth().verticalScroll(rememberScrollState())) { left(); right() }
        // No line of words under the lists (Randall 14 Nov: "look at how simple and not over explained that is"): names and values only.
        Spacer(Modifier.height(10.dp))
    }
}

/** .forge-tracker: 210 px (coarse pointer), left 8 (measured), the no-blur fill (#0f1218ee, the site's low-power fallback: Compose has no backdrop blur), top header bottom + 10, down to 12 px above your seat. Library / Opponent tabs and a close. */
@Composable
internal fun DeckTracker(st: MatchState, menu: MatchMenu, H: Dp, d: Du, x: Dp, top: Dp) = with(d) {
    val side = menu.tracker ?: return@with
    // W9: the deck's lands are counted by their type lines; names the app has no type for yet are looked up once (Scryfall).
    dev.cardstashy.nativeplay.art.CardArt.version.collectAsState().value
    androidx.compose.runtime.LaunchedEffect(menu.deck) { dev.cardstashy.nativeplay.art.CardArt.fetchTypes(menu.deck.map { it.name }) }
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
    // B (and a phone's back) closes the tracker (U7: there was no way out but the ×).
    androidx.activity.compose.BackHandler { menu.showTracker(null) }
    PadScreen(PadActs(b = "Close", tabs = { dir -> menu.showTracker(if (dir < 0) "deck" else "opponent") }))
    val maxH = maxOf(160.du, H - 98.du - top)
    val shape = RoundedCornerShape(16.du)
    val dual = DualScreen.active
    val body: @Composable ColumnScope.() -> Unit = {
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
    // Two screens (U7): the tracker is a case on the bottom screen, so the top keeps the menu button, the piles and the table clear.
    if (dual) BottomScreen {
        ShowcaseCase("Match", "Deck tracker", scroll = false) { Column(Modifier.fillMaxWidth().weight(1f, fill = false), content = body) }
    } else Column(Modifier.offset(x = x, y = top).zIndex(25f).graphicsLayer { alpha = pop.value; translationY = (1 - pop.value) * -6 * u * density; val s = .98f + .02f * pop.value; scaleX = s; scaleY = s }
        .width(210.du).heightIn(max = maxH).clip(shape)
        .background(Color(0xEE0F1218)).background(Brush.linearGradient(listOf(Color(0x12FFFFFF), Color(0x02FFFFFF), Color.Transparent)))
        .border(1.dp, Color(0x1FFFFFFF), shape), content = body)
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
