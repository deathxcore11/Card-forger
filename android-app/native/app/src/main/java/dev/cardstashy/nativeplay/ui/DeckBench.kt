@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.snap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.foundation.focusable
import androidx.compose.foundation.indication
import androidx.compose.ui.composed
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.zIndex
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.ScaleFactor
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.unit.toSize
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/*
 * Deck Bench (specs/deck-editor-native.md, approved by Randall 6 Nov 00:51Z, preview design/deck-editor/template.html):
 * the deck being edited docked over a card browser, built like Arena. One editor for Play and Collection; the numbers
 * come in through [BenchModel] from each side's own engine, the moves go out through [BenchActions].
 */

/** One deck row: a strip in the List, a card in Stacks or Gallery, a Detailed row. [short] = copies still to craft (Play) or buy (Collection). */
class BenchRow(val name: String, val qty: Int, val short: Int, val seal: String, val art: String, val image: String, val cost: String,
               val colors: List<String>, val set: String, val number: String, val rarity: String, val roles: List<String> = emptyList(),
               /** Collection: the deck page's own words for what is owned ("1/4 owned · need 3"), shown when copies are still to get. */
               val note: String = "",
               /** A sideboard card (Collection): shown as the page shows it, a tap opens the card; no stepper, no drag. */
               val fixed: Boolean = false,
               /** What the Bench moves and opens it by (the name in Magic; a Yu-Gi-Oh! or Pokémon row's card id, "side:" + id in the Side Deck). */
               val key: String = name,
               /** The browser tile it is (its [BenchTile.key]). */
               val ref: String = key,
               /** A Yu-Gi-Oh! or Pokémon row's emblems in place of the mana cost (tiles.js typePart: the Level star and Attribute, the energy orbs). */
               val emb: List<TcgEmb> = emptyList(),
               /** The row's move between zones as the page words it (tcg.js "→ side" / "→ deck"), in the big view. */
               val move: String = "",
               /** The row's own legality tags (tcg.js deckCardsTab: Limited, Forbidden, Not legal …), true = bad; the Detailed view shows them. */
               val flags: List<Pair<String, Boolean>> = emptyList())
class BenchGroup(val name: String, val rows: List<BenchRow>)
/** A chip in the hero that does something (Collection's "2 to review", views.js deckPage's review eyebrow): its words, warn colour, the site action. */
class BenchChip(val label: String, val warn: Boolean, val act: String)
/** One browser tile: copies in the deck, copies owned, room for more; [locked] = not owned yet (greyed with "Craft"). */
class BenchTile(val name: String, val image: String, val cmc: Double, val land: Boolean, val basic: Boolean, val inDeck: Int, val own: Int, val room: Int, val locked: Boolean,
                /** Yu-Gi-Oh! / Pokémon: the card's id, its type group (deck-viewer.js deckCardCategory) and the format's copy limit (the diamonds). */
                val key: String = name, val section: String = "", val cap: Int = 4,
                /** The format's word on it as the deck rows show it (tcg.js: Forbidden, Limited, Semi-Limited, Not legal); [tagBad] = coral. */
                val tag: String = "", val tagBad: Boolean = false,
                /** What a [locked] tile says: Play's "Craft"; Collection's All cards, a card not owned yet, "To buy". */
                val lockWord: String = "Craft")
class BenchStat(val value: String, val label: String, val warn: Boolean = false)
/**
 * One shelf of All cards (Randall 6-7 Nov: deck-first shelves, a set at a time, "only when you pick All"): "For this deck" ([gold]) or a
 * set, newest first. [tiles] null = not loaded yet: the Bench asks for it (BenchActions.shelf) when the shelf comes on screen, and its
 * card backs flip over as the cards arrive. A loaded shelf with no cards (none legal in the format, or none for the filters) is left out.
 */
class BenchShelf(val key: String, val title: String, val code: String = "", val meta: String = "", val gold: Boolean = false,
                 val tiles: List<BenchTile>? = null, val note: String = "", val count: Int = 0,
                 /** Under a "For this deck" card: why it is there ("In 42% of top decks", "Instant"). */
                 val why: Map<String, String> = emptyMap(),
                 /** Still filling: its tiles so far show, and its ask stays on while it is on screen. */
                 val loading: Boolean = false)
class BenchModel(
    val play: Boolean, val modeChip: String, val formatChip: String, val title: String, val heroArt: String?,
    val stats: List<BenchStat>, val power: String?, val tier: String, val roles: List<Pair<String, Int>>,
    val groups: List<BenchGroup>, val basics: List<Pair<String, String>>,
    val browserTitle: String, val tiles: List<BenchTile>, val browserNote: String?,
    val footLead: AnnotatedString, val wallet: Map<String, Int>?, val footRight: String?,
    val busy: Boolean, val canSave: Boolean, val tabs: List<Pair<String, String>>,
    /** The words under the Power number ("power"; Collection's page says "power unavailable" when it has none). */
    val powerLabel: String = "power",
    /** The tab the Power number opens (Collection's stat button: deckTab engine), or null when it opens nothing. */
    val powerTab: String? = null,
    val chips: List<BenchChip> = emptyList(),
    /** The browser's mana colour filter (Magic); the type chips; the order of [BenchTile.section] groups (Yu-Gi-Oh!, Pokémon). */
    val colorFilter: Boolean = true, val types: List<String> = listOf("All", "Creatures", "Spells", "Lands"), val sectionOrder: List<String> = emptyList(),
    /** Under the browser while a search is typed: the deck page's own add by name (Magic "+ Add", Yu-Gi-Oh!/Pokémon "Find"), its words. */
    val findMore: String? = null,
    /** Under the deck's cards: the page's own notes on the format (Collection: views.js's commander note, tcg.js's format note). */
    val listNote: String? = null,
    /** The big view's words for a free card (a basic land; Pokémon's basic Energy). */
    val basicWord: String = "Basic land",
    /** All cards as shelves (null: the grid). Shown while nothing is typed in Find; a search is the whole game's, as before. */
    val shelves: List<BenchShelf>? = null,
    /** Whose card back the shelves flip from: mtg, ygo or ptcg. */
    val cardBack: String = "mtg",
    /** Bumped each time the shelves start over (a filter, or the deck's colours): every shelf on screen asks again. */
    val shelvesGen: Int = 0,
)
class BenchMenuItem(val label: String, val onClick: () -> Unit)
class BenchActions(
    /** Save: Play's (null in Collection, where each change saves as it is made). */
    val back: () -> Unit, val save: (() -> Unit)?, val step: (String, Int) -> Unit, val craft: (String, Int) -> Unit,
    /** The full card view (Play's card sheet, Collection's card page). */
    val open: (String) -> Unit,
    /** The card's actions sheet (deck cover, its pack, its set …), or null where there is none. */
    val more: ((String) -> Unit)?,
    val menu: List<BenchMenuItem>,
    /** ⋯ opens the deck's own menu sheet instead of [menu] (Collection's DeckMenuSheet). */
    val menuOpen: (() -> Unit)? = null,
    /** A tab tapped: true when the Bench shows it, false when the caller took it elsewhere (Collection's Versions opens the website). */
    val tab: ((String) -> Boolean)? = null,
    /** The gold button's word: Save in Play; Collection's is the deck page's own Practice (views.js deckPage's primary action). */
    val saveLabel: String = "Save",
    /** A hero chip's site action (BenchChip.act). */
    val chip: (String) -> Unit = {},
    /** A row's move between zones (BenchRow.move), by its key. */
    val move: ((String) -> Unit)? = null,
    /** [BenchModel.findMore] pressed, with the search as typed. */
    val findMore: (String) -> Unit = {},
    /** The hero's other buttons beside the gold one (views.js deckShell's actions: War Chest, Share), as ghost buttons under it. */
    val heroActions: List<BenchMenuItem> = emptyList(),
    /** A shelf (BenchShelf.key) came on screen before its cards: load them. */
    /** A shelf on screen asks for its cards: suspends until they are in (or failed); cancelled when the shelf leaves the screen. */
    val shelf: suspend (String) -> Unit = {},
    /** A set opened full asks for its next cards as its grid's end comes on screen (Magic's next Scryfall page; the others have them all). */
    val shelfMore: suspend (String) -> Unit = {},
    /** A tab the Bench draws itself (Collection's Versions and the like open the website): the controller's LB/RB step only through these. */
    val drawn: (String) -> Boolean = { true },
)

/** Where the Bench is: tab, deck view, find and filters, the card in the big view. Kept by the caller so Back keeps your place. */
class BenchUi {
    var tab by mutableStateOf("cards")
    var view by mutableStateOf("list")
    var find by mutableStateOf("")
    var colors by mutableStateOf(emptySet<String>())
    var type by mutableStateOf("All")
    var peek by mutableStateOf<String?>(null)
    /** The card that just changed: it pops once in the deck and the browser. */
    var pop by mutableStateOf<String?>(null)
    var popAt by mutableLongStateOf(0L)
    val deckGrid = LazyGridState()
    val tileGrid = LazyGridState()
    /** Portrait: how much of the room the deck takes; the grip between deck and collection moves it (Randall 6 Nov 21:43Z). */
    var split by mutableFloatStateOf(SPLIT_EVEN)
    /** All cards' shelves: where the list is, and the cards that already flipped over (they stay face up when you come back). */
    val shelfList = androidx.compose.foundation.lazy.LazyListState()
    val flipped = HashSet<String>()
    /** A set opened full (its shelf's key; Randall 8 Nov: tap a set's name for the whole set, tap again for every shelf), and the Set dropdown. */
    var openSet by mutableStateOf<String?>(null)
    var setPick by mutableStateOf(false)
    val setGrid = LazyGridState()
    internal var setGridFor: String? = null
    /** Play's ⋯ dropdown is open (here so the controller's Start opens it too). */
    var menu by mutableStateOf(false)
}

/** LB/RB: the tab [d] steps from [on] in [keys], skipping those [here] says open elsewhere; null at either end. */
internal fun padTab(keys: List<String>, on: String, d: Int, here: (String) -> Boolean): String? {
    var i = keys.indexOf(on).coerceAtLeast(0)
    while (true) { i += d; val k = keys.getOrNull(i) ?: return null; if (k != on && here(k)) return k }
}

/**
 * Controller only: a card that takes touch through [benchCard] (no clickable) is still a d-pad stop with the gold ring (PadFocus.Ring),
 * and A (d-pad centre) does [onA]. Touch never focuses it, so a phone sees nothing new and its taps, holds and drags are as before.
 */
private fun Modifier.padTap(acts: PadActs, onA: () -> Unit): Modifier = composed {
    val src = remember { MutableInteractionSource() }
    val a by rememberUpdatedState(onA)
    onKeyEvent { e ->
        val k = e.nativeKeyEvent.keyCode
        if (k == android.view.KeyEvent.KEYCODE_DPAD_CENTER || k == android.view.KeyEvent.KEYCODE_ENTER || k == android.view.KeyEvent.KEYCODE_NUMPAD_ENTER || k == android.view.KeyEvent.KEYCODE_BUTTON_A) {
            if (e.type == KeyEventType.KeyUp) a(); true
        } else false
    }.indication(src, PadFocus.Ring).padActs(acts).focusable(interactionSource = src)
}

/**
 * Controller on a deck row or a browser card (preview "Contextual controls on a handheld"): A adds one, X takes one out, Y its card page —
 * the big view's own − / + and its card. Where no copy can go in, A opens the big view, as a tap does. Returns the acts and A's action.
 */
@Composable
private fun cardPad(m: BenchModel, key: String, ref: String, name: String, qty: Int, ui: BenchUi, a: BenchActions, known: Int? = null): Pair<PadActs, () -> Unit> {
    // The big view's room (Peek): the browser tile's, else unlimited for a basic, else four a card.
    val room = known ?: remember(m.tiles, m.basics, ref, name, qty) { val tile = m.tiles.firstOrNull { it.key == ref }
        tile?.room ?: if (tile?.basic == true || m.basics.any { it.first == name }) Int.MAX_VALUE else (4 - qty) }
    fun step(d: Int) { a.step(key, d); ui.pop = key; ui.popAt = System.nanoTime() }
    val acts = PadActs(a = if (room > 0) "Add one" else null, x = if (qty > 0) PadAct("Take one out") { step(-1) } else null, y = PadAct("Inspect") { ui.peek = key },
        // One word per action (Play and Collection family, T5): Y is Inspect (the card big, the bench's Peek) as everywhere else; the card page is on Select.
        menu = PadAct("Card page") { a.open(key) })
    val onA: () -> Unit = { if (room > 0) step(1) else ui.peek = key }
    return acts to onA
}

/** A deck row's controller stop ([cardPad]); a sideboard row (fixed) only opens its card, as its tap does. */
@Composable
private fun Modifier.rowPad(m: BenchModel, r: BenchRow, ui: BenchUi, a: BenchActions): Modifier =
    if (r.fixed) padTap(PadActs(a = "Open")) { a.open(r.key) }
    else cardPad(m, r.key, r.ref, r.name, r.qty, ui, a).let { (acts, onA) -> padTap(acts, onA) }
const val SPLIT_EVEN = .40f
const val SPLIT_MIN = .12f
const val SPLIT_MAX = .80f

// ---------------------------------------------------------------- the look (template.html :root)

private object B {
    val Bg = Color(0xFF0D0F14); val Panel = Color(0xFF151821); val Glass = Color(0xC7161922); val Line = Color(0x17FFFFFF)
    val Fg = Color(0xFFECEAE4); val Mute = Color(0xFF9B9CA8); val Gold = Color(0xFFE5C47E); val Gold2 = Color(0xFFB8924A); val Coral = Color(0xFFFF7A6A)
    val GoldBtn = Brush.verticalGradient(listOf(Color(0xFFF0D9A0), Color(0xFFB8924A)))
    val GoldInk = Color(0xFF1A1405)
}
private fun f(size: Float, weight: Int = 600, color: Color = B.Fg, line: Float = size * 1.4f, track: Float = 0f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = line.sp, color = color, letterSpacing = track.em)
private fun cinzel(size: Float, color: Color, line: Float = size * 1.12f, track: Float = .01f) =
    TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, lineHeight = line.sp, color = color, letterSpacing = track.em)
private val FOCUS_EASE = CubicBezierEasing(.2f, .8f, .2f, 1f)
private val CARD = RoundedCornerShape(percent = 5)

// The deck page's tab and view icons (template ICON, the site's labelIcon set), as 24-unit outlines.
private fun ic(vararg items: SiteSvg.Item) = SiteSvg(listOf(0f, 0f, 24f, 24f), items.toList(), emptyMap())
private fun p(d: String) = SiteSvg.Item("path", d, 0f, 0f, 0f, 0f, 0f, 0f, 0f, "none", "currentColor", 2f, "round", "round")
private fun r(x: Float, y: Float, w: Float, h: Float, rx: Float) = SiteSvg.Item("rect", "", x, y, w, h, 0f, rx, rx, "none", "currentColor", 2f, "round", "round")
private fun c(x: Float, y: Float, rr: Float) = SiteSvg.Item("circle", "", x, y, 0f, 0f, rr, 0f, 0f, "none", "currentColor", 2f, "round", "round")
internal val BENCH_ICONS = mapOf(
    "cards" to ic(r(7f, 3f, 13f, 16f, 2f), p("M4 7v12a2 2 0 0 0 2 2h10")),
    "rules" to ic(p("M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z")),
    "power" to ic(p("M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3")),
    "versions" to ic(r(5f, 8f, 14f, 13f, 2f), p("M7 5h10M9 2h6")),
    "chest" to ic(r(3f, 3f, 18f, 18f, 3f), c(8f, 8f, 1f), c(16f, 8f, 1f), c(12f, 12f, 1f), c(8f, 16f, 1f), c(16f, 16f, 1f)),
    "stacks" to ic(r(7f, 9f, 12f, 12f, 2f), p("M5 6h12M7 3h8")),
    "gallery" to ic(r(4f, 4f, 6.5f, 6.5f, 1.5f), r(13.5f, 4f, 6.5f, 6.5f, 1.5f), r(4f, 13.5f, 6.5f, 6.5f, 1.5f), r(13.5f, 13.5f, 6.5f, 6.5f, 1.5f)),
    "list" to ic(p("M9 6h11M9 12h11M9 18h11"), c(4.5f, 6f, 1.2f), c(4.5f, 12f, 1.2f), c(4.5f, 18f, 1.2f)),
    "detail" to ic(r(3f, 4f, 6f, 6f, 1f), r(3f, 14f, 6f, 6f, 1f), p("M12 5h9M12 9h6M12 15h9M12 19h6")),
)
/** The site's tab keys (views.js deckPage: engine = Power, playtest = War Chest; tcg.js: insights = Power) to the Bench's icons. */
private val TAB_ICON = mapOf("engine" to "power", "insights" to "power", "playtest" to "chest")
private val VIEWS = listOf("stacks" to "Stacks", "gallery" to "Gallery", "list" to "List", "detail" to "Detailed")

/** The strip's colour wash (template tint()): mono colours their own, multicolour gold, colourless grey. */
private val TINT = mapOf("G" to Triple(52, 110, 66), "W" to Triple(150, 132, 84), "U" to Triple(44, 92, 140), "B" to Triple(78, 60, 98), "R" to Triple(140, 58, 44))
private class Tint(val a: Color, val b: Color, val edge: Color)
private fun tintOf(colors: List<String>): Tint {
    val t = if (colors.size == 1) TINT[colors[0]] ?: Triple(84, 86, 96) else if (colors.size > 1) Triple(150, 118, 52) else Triple(84, 86, 96)
    fun rgb(r: Int, g: Int, b: Int, a: Float) = Color(r, g, b, (a * 255).roundToInt())
    return Tint(rgb(t.first, t.second, t.third, .94f), rgb((t.first * .55).toInt(), (t.second * .55).toInt(), (t.third * .55).toInt(), .8f),
        rgb(minOf(255, t.first + 70), minOf(255, t.second + 70), minOf(255, t.third + 70), .45f))
}

// ---------------------------------------------------------------- drag (template drag(): hold 280 ms, lift, drop on the other side)

/** The card being dragged, tracked by the Bench's root so it survives the list it came from scrolling or shrinking. */
private class Drag {
    var name by mutableStateOf<String?>(null)
    var from by mutableStateOf("")
    var image = ""
    var pointer: PointerId? = null
    var start = Offset.Zero
    var pos by mutableStateOf(Offset.Zero)
    var moved = false
    /** Root-relative boxes of the deck dock and the browser grid. */
    var deck = Rect.Zero
    var grid = Rect.Zero
    var origin = Offset.Zero
    val zone: String? get() = if (name == null) null else if (deck.contains(pos)) "deck" else if (grid.contains(pos)) "coll" else null
}

/**
 * A card you can hold and drag: a tap opens the big view ([onTap]); held 280 ms without moving, it lifts and the Bench's root
 * follows the finger from there. A swipe before that scrolls as usual. Taps a child takes (+, a seal chip) are left to it.
 */
private fun Modifier.benchCard(drag: Drag, name: String, image: String, from: String, onLift: () -> Unit, lifts: Boolean = true, onTap: () -> Unit): Modifier {
    var at: LayoutCoordinates? = null
    return this.onGloballyPositioned { at = it }.pointerInput(name, from) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            var up = false; var gone = false; var taken = false
            withTimeoutOrNull(280) {
                while (true) {
                    val e = awaitPointerEvent()
                    val ch = e.changes.firstOrNull { it.id == down.id } ?: run { gone = true; return@withTimeoutOrNull }
                    if (!ch.pressed) { up = true; taken = ch.isConsumed; return@withTimeoutOrNull }
                    if ((ch.position - down.position).getDistance() > viewConfiguration.touchSlop || ch.isConsumed) { gone = true; return@withTimeoutOrNull }
                }
            }
            if (up) { if (!taken) onTap(); return@awaitEachGesture }
            if (gone || !lifts || drag.name != null) return@awaitEachGesture
            val c = at ?: return@awaitEachGesture
            val root = c.localToRoot(down.position) - drag.origin
            drag.image = image; drag.pointer = down.id; drag.start = root; drag.pos = root; drag.moved = false; drag.from = from; drag.name = name
            onLift()
            // Keep the list under the finger still; the root does the tracking.
            while (true) { val e = awaitPointerEvent(); val ch = e.changes.firstOrNull { it.id == down.id } ?: break; ch.consume(); if (!ch.pressed) break }
        }
    }
}

// ---------------------------------------------------------------- the Bench

@Composable
fun DeckBench(m: BenchModel, ui: BenchUi, a: BenchActions, actionRow: (@Composable RowScope.() -> Unit)?, browserSwitch: (@Composable () -> Unit)?,
              tabBody: @Composable (String) -> Unit, onFilter: () -> Unit = {}) {
    val drag = remember { Drag() }
    val haptic = LocalHapticFeedback.current
    fun pop(name: String) { ui.pop = name; ui.popAt = System.nanoTime() }
    fun drop() {
        val name = drag.name ?: return; val zone = drag.zone; val from = drag.from; val moved = drag.moved
        drag.name = null; drag.pointer = null
        if (!moved) { ui.peek = name; return }
        if (from == "coll" && zone == "deck") { a.step(name, 1); pop(name) } else if (from == "deck" && zone == "coll") { a.step(name, -1); pop(name) }
    }
    androidx.activity.compose.BackHandler(enabled = ui.peek != null) { ui.peek = null }
    // Controller (PadPrompts): X the gold button (Save; Collection's Practice / War Chest), LB/RB the deck's tabs, LT/RT a page of the
    // list or grid under the ring (six d-pad steps, as the bar says), Start the ⋯ menu.
    val focus = LocalFocusManager.current
    BottomScreen { BenchBottom(m) }
    PadScreen(PadActs(x = a.save?.takeIf { m.canSave && !m.busy }?.let { PadAct(a.saveLabel, it) },
        tabs = if (m.tabs.size > 1) ({ d -> padTab(m.tabs.map { it.first }, ui.tab, d, a.drawn)?.let { k -> ui.peek = null; if (a.tab?.invoke(k) != false) ui.tab = k } }) else null,
        page = { d -> repeat(6) { focus.moveFocus(if (d > 0) FocusDirection.Down else FocusDirection.Up) } },
        start = PadAct("Menu") { val o = a.menuOpen; if (o == null) ui.menu = true; o?.invoke() }))
    BoxWithConstraints(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF1B1F2B), B.Bg), radius = 1400f, center = Offset(540f, 0f)))
        .onGloballyPositioned { drag.origin = it.positionInRoot() }
        .pointerInput(Unit) {
            // The root follows the lifted card: Initial pass, so no list under it scrolls while it moves.
            awaitPointerEventScope {
                while (true) {
                    val e = awaitPointerEvent(PointerEventPass.Initial)
                    val id = drag.pointer ?: continue
                    val ch = e.changes.firstOrNull { it.id == id } ?: continue
                    if (drag.name == null) continue
                    drag.pos = ch.position
                    if ((ch.position - drag.start).getDistance() > 12.dp.toPx()) drag.moved = true
                    if (!ch.pressed) drop() else ch.consume()
                }
            }
        }) {
        val split = maxWidth >= 720.dp || maxWidth > maxHeight
        val wide = split && maxHeight >= 600.dp
        val land = split && !wide
        // The art wash behind everything (.app:before): the hero art, heavily blurred, at a third.
        val wash = heroPainter(m.heroArt?.let(homeArt))
        if (wash != null) Image(wash, null, Modifier.fillMaxSize().scale(1.15f).blur(46.dp).alpha(.32f), contentScale = ContentScale.Crop)
        val lift = { haptic.performHapticFeedback(HapticFeedbackType.GestureThresholdActivate) }
        val bars = if (land) Modifier else Modifier.windowInsetsPadding(WindowInsets.statusBars).windowInsetsPadding(WindowInsets.navigationBars)
        if (split) Row(Modifier.fillMaxSize().then(bars)) {
            // Another tab (War Chest, Power, Rules, Versions) opens in the big side, where the collection was; the deck stays beside it.
            Box(Modifier.weight(1f).fillMaxHeight()) { if (ui.tab == "cards") Browser(m, ui, a, drag, browserSwitch, cols = if (land) 0 else -1, lift, onFilter) else tabBody(ui.tab) }
            Column(Modifier.fillMaxWidth(if (wide) .37f else .43f).fillMaxHeight().background(Color(0x33000000)).drawBehind {
                drawLine(B.Line, Offset(0f, 0f), Offset(0f, size.height), 1.dp.toPx()) }) {
                Hero(m, a, compact = land, ui = ui)
                // Phone landscape: the four views sit at the end of the icon tabs; wider, under the list in the footer.
                Tabs(m.tabs, ui, iconsOnly = land, a.tab, trailing = if (land && ui.tab == "cards") ({ ViewSwitch(ui, bare = true) }) else null)
                Dock(m, ui, a, drag, actionRow, split = true, Modifier.weight(1f), lift)
                Footer(m, ui, split = true, views = !land)
            }
        } else Column(Modifier.fillMaxSize().then(bars)) {
            Hero(m, a, compact = false, ui = ui)
            Tabs(m.tabs, ui, iconsOnly = false, a.tab)
            if (ui.tab == "cards") {
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val room = maxHeight
                    // Focus while dragging (Randall 6 Nov 01:04Z): the panel a dragged card crosses into grows.
                    val zone = drag.zone
                    // The grip sets the resting share; a card dragged across still opens the side it heads for.
                    var gripping by remember { mutableStateOf(false) }
                    val target = if (drag.name != null && drag.from == "coll" && zone == "deck") maxOf(.66f, ui.split) else if (drag.name != null && drag.from == "deck" && zone == "coll") minOf(.18f, ui.split) else ui.split
                    val share by animateFloatAsState(target, if (gripping || Motion.still) snap() else tween(280, easing = FOCUS_EASE), label = "focus")
                    Column(Modifier.fillMaxSize()) {
                        Dock(m, ui, a, drag, actionRow, split = false, Modifier.height(room * share), lift)
                        SplitGrip(ui, room, onGrip = { gripping = it })
                        Box(Modifier.weight(1f).fillMaxWidth()) { Browser(m, ui, a, drag, browserSwitch, cols = 3, lift, onFilter) }
                    }
                }
                Footer(m, ui, split = false, views = false)
            } else Box(Modifier.weight(1f).fillMaxWidth()) { tabBody(ui.tab) }
        }
        // The lifted card (.ghost): tilted, a gold glow, under the finger.
        drag.name?.let {
            val img = heroPainter(drag.image.let(homeArt))
            val d = LocalDensity.current
            Box(Modifier.offset { IntOffset((drag.pos.x - with(d) { 48.dp.toPx() }).roundToInt(), (drag.pos.y - with(d) { 100.dp.toPx() }).roundToInt()) }
                .size(96.dp, 134.dp).rotate(-4f).scale(1.06f).shadow(26.dp, CARD, ambientColor = Color(0xFFE5C47E), spotColor = Color(0xB3000000)).clip(CARD).background(B.Panel)) {
                if (img != null) Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
        }
        ui.peek?.let { Peek(m, ui, a, it, split) }
    }
}

/**
 * Portrait: the grip between the deck and the collection. Drag it to give one more room; a tap steps through deck small,
 * even, collection small. Sizes stay while the page is open.
 */
@Composable
private fun SplitGrip(ui: BenchUi, room: androidx.compose.ui.unit.Dp, onGrip: (Boolean) -> Unit) {
    val d = LocalDensity.current
    val roomPx = with(d) { room.toPx() }
    val label = when { ui.split <= SPLIT_MIN + .02f -> "Deck folded"; ui.split >= SPLIT_MAX - .02f -> "Collection folded"; else -> "Resize deck and collection" }
    Box(Modifier.fillMaxWidth().height(22.dp)
        // Controller: A steps the split as a tap does (below).
        .padTap(PadActs()) { ui.split = when { ui.split < SPLIT_EVEN - .05f -> SPLIT_MAX; ui.split > SPLIT_EVEN + .05f -> SPLIT_EVEN; else -> SPLIT_MIN } }
        .semantics { contentDescription = label; role = Role.Button }
        .pointerInput(roomPx) {
            awaitEachGesture {
                val down = awaitFirstDown()
                var moved = false; var total = 0f
                onGrip(true)
                while (true) {
                    val e = awaitPointerEvent()
                    val ch = e.changes.firstOrNull { it.id == down.id } ?: break
                    if (!ch.pressed) break
                    val dy = ch.position.y - ch.previousPosition.y
                    total += dy
                    if (!moved && kotlin.math.abs(total) > 6.dp.toPx()) moved = true
                    if (moved && roomPx > 0f) { ui.split = (ui.split + dy / roomPx).coerceIn(SPLIT_MIN, SPLIT_MAX); ch.consume() }
                }
                onGrip(false)
                // A tap: even, then deck small, then collection small, then even again.
                if (!moved) ui.split = when { ui.split < SPLIT_EVEN - .05f -> SPLIT_MAX; ui.split > SPLIT_EVEN + .05f -> SPLIT_EVEN; else -> SPLIT_MIN }
            }
        }, contentAlignment = Alignment.Center) {
        Box(Modifier.size(44.dp, 5.dp).clip(RoundedCornerShape(3.dp)).background(B.Line.copy(alpha = .9f)))
    }
}

// ---------------------------------------------------------------- hero (the deck page hero, compact)

@Composable
private fun Hero(m: BenchModel, a: BenchActions, compact: Boolean, ui: BenchUi) {
    val shape = RoundedCornerShape(18.dp)
    val art = heroPainter(m.heroArt?.let(homeArt))
    val breathe = if (Motion.still) 1f else rememberInfiniteTransition(label = "breathe").animateFloat(1f, 1.035f, infiniteRepeatable(tween(20_000), RepeatMode.Reverse), label = "b").value
    Box(Modifier.padding(start = if (compact) 8.dp else 10.dp, end = if (compact) 8.dp else 10.dp, top = 6.dp).fillMaxWidth()
        .shadow(14.dp, shape, spotColor = Color.Black).clip(shape).background(B.Panel).border(1.dp, Color(0x47E5C47E), shape)) {
        if (art != null) Image(art, null, Modifier.matchParentSize().scale(1.08f * breathe), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x260A0B0F), .78f to Color(0xE00A0B0F))))
        Column(Modifier.fillMaxWidth().padding(start = if (compact) 10.dp else 12.dp, end = if (compact) 10.dp else 12.dp, top = if (compact) 6.dp else 8.dp, bottom = if (compact) 8.dp else 10.dp),
            verticalArrangement = Arrangement.spacedBy(if (compact) 3.dp else 5.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Square("←", "Back", a.back)
                // The chips wrap to a second line before either is cut (large text on a narrow phone).
                if (!compact) FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp),
                    itemVerticalAlignment = Alignment.CenterVertically) {
                    Text(m.modeChip, style = f(12f, 700, B.GoldInk), maxLines = 1, softWrap = false, modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(B.GoldBtn).padding(horizontal = 10.dp, vertical = 4.dp))
                    Text(m.formatChip, style = f(12f, 700, Color(0xFFEEEEEE)), maxLines = 1, softWrap = false,
                        modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0x9908090C)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(99.dp)).padding(horizontal = 10.dp, vertical = 4.dp))
                    for (c in m.chips) ActChip(c, a)
                } else Text(m.title, style = cinzel(16f, Color(0xFFFBF3DC)), modifier = Modifier.weight(1f))
                // Phone landscape: Save beside the menu, so the numbers below keep one line.
                if (compact && a.save != null) SaveButton(m, a.save, a.saveLabel)
                MenuButton(a.menu, a.menuOpen, ui)
            }
            if (!compact) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(m.title, style = cinzel(19f, Color(0xFFFBF3DC)), modifier = Modifier.weight(1f))
                a.save?.let { SaveButton(m, it, a.saveLabel) }
            }
            // .ds-actions' other buttons (War Chest, Share): ghost glass beside the gold one's line, under the title.
            if (a.heroActions.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                for (h in a.heroActions) HeroGhost(h.label, h.onClick)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    for (s in m.stats) Text(buildAnnotatedString {
                        withStyle(SpanStyle(fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = if (s.warn) B.Coral else B.Fg, fontFeatureSettings = "tnum")) { append(s.value) }
                        withStyle(SpanStyle(fontSize = 11.sp, color = Color(0xFFD0D0C8))) { append(" " + s.label) }
                    }, style = f(11f, 600), modifier = Modifier.alignByBaseline())
                }
                // Phone landscape: the review count sits by Power, so the title keeps the top row's width.
                if (compact) for (c in m.chips) ActChip(c, a)
                PowerBadge(m, m.powerTab?.let { k -> { ui.peek = null; if (a.tab?.invoke(k) != false) ui.tab = k } })
            }
        }
    }
}

@Composable
private fun Square(label: String, desc: String, onClick: () -> Unit) = Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x8C08090C))
    .border(1.dp, B.Line, RoundedCornerShape(14.dp)).clickable(onClick = onClick).semantics { contentDescription = desc; role = Role.Button }, contentAlignment = Alignment.Center) {
    Text(label, style = f(if (label == "⋯") 18f else 20f, 800, B.Fg))
}

@Composable
private fun SaveButton(m: BenchModel, save: () -> Unit, label: String) {
    val shape = RoundedCornerShape(13.dp)
    Box(Modifier.heightIn(min = 44.dp).shadow(if (m.canSave) 8.dp else 0.dp, shape, spotColor = Color(0xB3E5C47E)).clip(shape)
        .background(if (m.canSave) B.GoldBtn else SolidColor(Color(0x33E5C47E))).clickable(enabled = m.canSave && !m.busy, onClick = save)
        .semantics { role = Role.Button }.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
        Text(if (m.busy) "Saving…" else label, style = f(14f, 800, if (m.canSave) B.GoldInk else B.Mute), maxLines = 1, softWrap = false)
    }
}

/** A hero's ghost button (.btn.ghost on the deck hero): glass over the art, the gold line round it, 44 tall. */
@Composable
private fun HeroGhost(label: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(13.dp)
    Box(Modifier.heightIn(min = 44.dp).clip(shape).background(Color(0x8C08090C)).border(1.dp, Color(0x59E5C47E), shape).clickable(onClick = onClick)
        .semantics { role = Role.Button }.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
        Text(label, style = f(14f, 700, B.Fg), maxLines = 1, softWrap = false)
    }
}

/** A hero chip that acts (the review count): 44 tall to the touch, the chip itself pill-sized. */
@Composable
private fun ActChip(c: BenchChip, a: BenchActions) = Box(Modifier.heightIn(min = 44.dp).clickable { a.chip(c.act) }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
    Text(c.label, style = f(12f, 700, if (c.warn) B.Coral else Color(0xFFEEEEEE)), maxLines = 1, softWrap = false,
        modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0x9908090C)).border(1.dp, if (c.warn) Color(0x99FF7A6A) else Color(0x2EFFFFFF), RoundedCornerShape(99.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp))
}

@Composable
private fun PowerBadge(m: BenchModel, open: (() -> Unit)? = null) = Row(Modifier.then(if (open != null) Modifier.heightIn(min = 44.dp).clickable(onClick = open)
    .semantics { role = Role.Button } else Modifier), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(m.power ?: "—", style = f(15f, 800, B.Gold), maxLines = 1, softWrap = false, modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Color(0x1FE5C47E))
        .border(1.dp, Color(0x8CE5C47E), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 1.dp))
    Column {
        Text(m.powerLabel, style = f(11f, 600, Color(0xFFDDDDDD), line = 12f))
        if (m.tier.isNotEmpty()) Text(m.tier, style = f(11f, 700, B.Gold, line = 12f), maxLines = 1, softWrap = false)
    }
}

/** ⋯: the deck's menu (Play: Rename, Change format, Copy list, Copy to My decks; Collection: its own sheet). */
@Composable
private fun MenuButton(items: List<BenchMenuItem>, sheet: (() -> Unit)?, ui: BenchUi) {
    Box {
        Square("⋯", "Deck menu") { if (sheet != null) sheet() else ui.menu = true }
        DropdownMenu(ui.menu, { ui.menu = false }, containerColor = Color(0xF714161D), shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, B.Gold2), modifier = Modifier.widthIn(min = 220.dp)) {
            for (it in items) DropdownMenuItem({ Text(it.label, style = f(13f, 700)) }, { ui.menu = false; it.onClick() }, modifier = Modifier.heightIn(min = 44.dp))
        }
    }
}

// ---------------------------------------------------------------- tabs (the deck page tabs)

@Composable
private fun Tabs(tabs: List<Pair<String, String>>, ui: BenchUi, iconsOnly: Boolean, pick: ((String) -> Boolean)?, trailing: (@Composable () -> Unit)? = null) =
    Row(Modifier.fillMaxWidth().padding(top = if (iconsOnly) 0.dp else 4.dp).drawBehind { drawLine(B.Line, Offset(0f, size.height - .5f), Offset(size.width, size.height - .5f), 1.dp.toPx()) },
        verticalAlignment = Alignment.CenterVertically) {
    Row(Modifier.weight(1f).horizontalScroll(rememberScrollState()).padding(start = 8.dp, end = 8.dp, top = 2.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        for ((k, label) in tabs) {
            val on = ui.tab == k
            Row(Modifier.heightIn(min = 44.dp).then(if (iconsOnly) Modifier.width(44.dp) else Modifier).clickable { ui.peek = null; if (pick?.invoke(k) != false) ui.tab = k }
                .semantics { role = Role.Tab; selected = on; if (iconsOnly) contentDescription = label }
                .drawBehind { if (on) { val inset = 12.dp.toPx(); drawRoundRect(Brush.horizontalGradient(listOf(Color.Transparent, B.Gold, Color.Transparent), inset, size.width - inset),
                    Offset(inset, size.height - 2.dp.toPx()), Size(size.width - 2 * inset, 2.dp.toPx()), CornerRadius(2.dp.toPx())) } }
                .padding(horizontal = if (iconsOnly) 0.dp else 11.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
                SiteIcon(BENCH_ICONS[TAB_ICON[k] ?: k], if (iconsOnly) 18.dp else 15.dp, (if (on) B.Fg else B.Mute).copy(alpha = if (on) 1f else .8f))
                if (!iconsOnly) Text(label, style = f(13f, 700, if (on) B.Fg else B.Mute), maxLines = 1, softWrap = false)
            }
        }
    }
    trailing?.invoke()
}

// ---------------------------------------------------------------- the deck dock

@Composable
private fun Dock(m: BenchModel, ui: BenchUi, a: BenchActions, drag: Drag, actionRow: (@Composable RowScope.() -> Unit)?, split: Boolean, modifier: Modifier, lift: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val glow = drag.name != null && drag.from == "coll" && drag.zone == "deck"
    Column(modifier.fillMaxWidth().padding(start = if (split) 8.dp else 10.dp, end = if (split) 8.dp else 10.dp, top = if (split) 6.dp else 8.dp)
        .onGloballyPositioned { drag.deck = it.boundsInRoot().translate(-drag.origin) }
        .shadow(if (glow) 0.dp else 12.dp, shape, spotColor = Color.Black).clip(shape)
        .background(B.Glass).background(Brush.verticalGradient(listOf(Color(0x0FFFFFFF), Color(0x04FFFFFF))))
        .border(if (glow) 2.dp else 1.dp, if (glow) B.Gold else B.Line, shape)
        .drawBehind { if (glow) drawRect(Brush.radialGradient(listOf(Color(0x2EE5C47E), Color.Transparent), radius = size.maxDimension * .7f)) }) {
        if (!split) Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 2.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                for ((role, n) in m.roles) Text(buildAnnotatedString { append("$role "); withStyle(SpanStyle(color = B.Fg, fontWeight = FontWeight.Bold)) { append("$n") } },
                    style = f(12f, 500, B.Mute), maxLines = 1, softWrap = false)
            }
            ViewSwitch(ui)
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val w = maxWidth - 16.dp
            DeckBody(m, ui, a, drag, actionRow, split, w, lift)
        }
    }
}

@Composable
private fun ViewSwitch(ui: BenchUi, bare: Boolean = false) {
    Row(Modifier.then(if (bare) Modifier else Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0x40000000)).border(1.dp, B.Line, RoundedCornerShape(12.dp))).padding(2.dp)) {
        for ((k, label) in VIEWS) {
            val on = ui.view == k
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(9.dp)).then(if (on) Modifier.background(Color(0x29E5C47E)) else Modifier)
                .clickable { ui.view = k }.semantics { contentDescription = label; role = Role.RadioButton; selected = on }, contentAlignment = Alignment.Center) {
                SiteIcon(BENCH_ICONS[k], 17.dp, if (on) B.Gold else B.Mute)
            }
        }
    }
}

/** The dock's list: the action row, then the deck grouped by type in the chosen view. */
@Composable
private fun DeckBody(m: BenchModel, ui: BenchUi, a: BenchActions, drag: Drag, actionRow: (@Composable RowScope.() -> Unit)?, split: Boolean, w: Dp, lift: () -> Unit) {
    val cols = when (ui.view) {
        "list" -> if (split) 1 else maxOf(1, (w.value / 176).toInt())
        "gallery" -> maxOf(3, (w.value / 88).toInt())
        "detail" -> maxOf(1, (w.value / 300).toInt())
        else -> 1
    }
    val head: LazyGridScope.() -> Unit = {
        if (actionRow != null) item(key = "actions", span = { GridItemSpan(maxLineSpan) }) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 2.dp, bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically) { actionRow() }
        }
        if (m.groups.isEmpty()) item(key = "empty", span = { GridItemSpan(maxLineSpan) }) {
            Text("Drag cards up here, or tap + on a card.", style = f(13f, 600, B.Mute), modifier = Modifier.padding(horizontal = 4.dp, vertical = 10.dp))
        }
    }
    if (ui.view == "stacks") {
        Column(Modifier.fillMaxSize().padding(horizontal = 8.dp)) {
            if (actionRow != null) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 2.dp, bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically) { actionRow() }
            val pw = if (split && w > 300.dp) 120.dp else if (split) 92.dp else 96.dp
            Row(Modifier.fillMaxSize().horizontalScroll(rememberScrollState()).verticalScroll(rememberScrollState()).padding(bottom = 8.dp, top = 2.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                for (g in m.groups) Column(Modifier.width(pw)) {
                    GroupHead(g.name, g.rows.sumOf { it.qty }, lines = 2)
                    // .pile .card + .card: each card 20 % of the pile's width under the one before.
                    val step = pw * .2f
                    Box(Modifier.width(pw).height(pw * 88f / 63f + step * (g.rows.size - 1).coerceAtLeast(0))) {
                        g.rows.forEachIndexed { i, r -> Box(Modifier.offset(y = step * i).zIndex(i.toFloat())) { DeckCard(m, r, ui, a, drag, pw, lift) } }
                    }
                }
            }
        }
        return
    }
    LazyVerticalGrid(GridCells.Fixed(cols), Modifier.fillMaxSize().semantics { contentDescription = "Deck list" }, ui.deckGrid, PaddingValues(start = 8.dp, end = 8.dp, bottom = 8.dp, top = if (split) 4.dp else 0.dp),
        verticalArrangement = Arrangement.spacedBy(if (ui.view == "gallery") 8.dp else if (ui.view == "detail") 5.dp else 4.dp),
        horizontalArrangement = Arrangement.spacedBy(if (ui.view == "gallery") 8.dp else 6.dp)) {
        head()
        // The deck's own groups, the basics under Lands, then a sideboard (Collection) last.
        val (side, main) = m.groups.partition { g -> g.rows.isNotEmpty() && g.rows.all { it.fixed } }
        val lands = main.any { it.name == "Lands" }
        fun LazyGridScope.group(g: BenchGroup) {
            item(key = "g:" + g.name, span = { GridItemSpan(maxLineSpan) }) { GroupHead(g.name, g.rows.sumOf { it.qty }) }
            itemsIndexed(g.rows, key = { i, r -> "r:${g.name}:$i:${r.key}" }) { _, r ->
                when (ui.view) {
                    "gallery" -> BoxWithConstraints { DeckCard(m, r, ui, a, drag, maxWidth, lift) }
                    "detail" -> DetailRow(m, r, ui, a, drag, lift)
                    else -> Strip(m, r, ui, a, drag, lift)
                }
            }
            if (g.name == "Lands" && m.basics.isNotEmpty()) item(key = "basics", span = { GridItemSpan(maxLineSpan) }) { Basics(m.basics, ui, a) }
        }
        main.forEach { group(it) }
        if (!lands && m.basics.isNotEmpty() && main.isNotEmpty()) {
            item(key = "g:Lands", span = { GridItemSpan(maxLineSpan) }) { GroupHead("Lands", 0) }
            item(key = "basics", span = { GridItemSpan(maxLineSpan) }) { Basics(m.basics, ui, a) }
        }
        side.forEach { group(it) }
        m.listNote?.let { n -> item(key = "note", span = { GridItemSpan(maxLineSpan) }) { Text(n, style = f(12f, 600, B.Mute), modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp)) } }
    }
}

@Composable
private fun GroupHead(name: String, n: Int, lines: Int = 1) = Text(buildAnnotatedString { append(name.uppercase()); withStyle(SpanStyle(color = B.Mute)) { append("  $n") } },
    style = f(11f, 700, B.Gold, track = .09f), minLines = lines, modifier = Modifier.padding(start = 2.dp, end = 2.dp, top = 6.dp, bottom = 1.dp))

/** A changed card pops once (template .pop): a quick scale up from .9 with a flash. */
@Composable
private fun popScale(ui: BenchUi, name: String): Float {
    val k = remember { Animatable(1f) }
    LaunchedEffect(ui.popAt) { if (ui.pop == name && ui.popAt > 0 && !Motion.still) { k.snapTo(.9f); k.animateTo(1f, tween(400)) } }
    return k.value
}

/** .strip: the Arena list row in our glass, the card's art washed in its colour, "4×", the full name, its cost or the seal that crafts it. */
@Composable
private fun Strip(m: BenchModel, r: BenchRow, ui: BenchUi, a: BenchActions, drag: Drag, lift: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    val t = tintOf(r.colors)
    val art = heroPainter(r.art.let(homeArt))
    val dragging = !r.fixed && drag.name == r.key && drag.from == "deck"
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).scale(popScale(ui, r.key)).alpha(if (dragging) .35f else 1f).clip(shape).background(Color(0xFF141720))
        .border(1.dp, if (r.short > 0) Color(0x80FF7A6A) else t.edge, shape)
        .benchCard(drag, r.key, r.image, "deck", lift, lifts = !r.fixed) { if (r.fixed) a.open(r.key) else ui.peek = r.key }.rowPad(m, r, ui, a).semantics { contentDescription = "${r.qty} ${r.name}" }, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).heightIn(min = 44.dp)) {
            if (art != null) Image(art, null, Modifier.matchParentSize().alpha(.95f), contentScale = StripCrop, alignment = BiasAlignment(.24f, -.66f))
            Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0f to t.a, .52f to t.b, 1f to Color(0x4D0E1016)))
                .background(Brush.verticalGradient(0f to Color(0x14FFFFFF), .45f to Color.Transparent)))
            val short = r.short > 0
            val chip = short && m.play && r.seal.isNotEmpty()
            Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(start = 3.dp, end = if (chip) 0.dp else 7.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Box(Modifier.widthIn(min = 30.dp).height(34.dp).clip(RoundedCornerShape(8.dp)).background(Color(0x73000000))
                    .border(1.dp, if (short) Color(0x80FF7A6A) else Color(0x4DE5C47E), RoundedCornerShape(8.dp)).padding(horizontal = 4.dp), contentAlignment = Alignment.Center) {
                    Text("${r.qty}×", style = f(13f, 800, if (short) B.Coral else B.Gold), maxLines = 1, softWrap = false)
                }
                FitName(r.name, Modifier.weight(1f).padding(vertical = 3.dp))
                if (chip) SealChip(r) { a.craft(r.key, r.short) }
                else if (r.emb.isNotEmpty()) EmbRow(r.emb)
                else ManaCost(r.cost, 15.dp)
            }
        }
    }
}

/** The strip's art (background-size: 150% auto): 1.5 times the strip's width. */
private val StripCrop = object : ContentScale {
    override fun computeScaleFactor(srcSize: Size, dstSize: Size): ScaleFactor { val k = maxOf(dstSize.width * 1.5f / srcSize.width, dstSize.height / srcSize.height); return ScaleFactor(k, k) }
}

/** .strip .cr: the rarity's seal and the copies to craft; a tap crafts them (site playCraftCopies). */
@Composable
private fun SealChip(r: BenchRow, onCraft: () -> Unit) = Box(Modifier.sizeIn(minWidth = 44.dp, minHeight = 44.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = onCraft)
    .semantics { contentDescription = "Craft ${r.short} ${r.name}"; role = Role.Button }.padding(end = 5.dp), contentAlignment = Alignment.Center) {
    Row(Modifier.height(30.dp).clip(RoundedCornerShape(99.dp)).background(Color(0x8C000000)).border(1.dp, Color(0x80E5C47E), RoundedCornerShape(99.dp)).padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        SealMini(r.seal, 16.dp); Text("${r.short}", style = f(12f, 800, B.Gold))
    }
}

/**
 * A strip's name, never cut: it wraps between words, and when one word is wider than the strip (Shinra Reinforcements) the name
 * steps down toward 11 sp so the word stays whole.
 */
@Composable
private fun FitName(name: String, modifier: Modifier) = BoxWithConstraints(modifier) {
    val measurer = rememberTextMeasurer()
    val base = f(12f, 700, B.Fg, line = 14.2f).copy(shadow = androidx.compose.ui.graphics.Shadow(Color.Black, Offset(0f, 1f), 2f))
    val room = constraints.maxWidth
    val size = remember(name, room, base) {
        val longest = name.split(' ').maxByOrNull { it.length } ?: name
        var sp = 12f
        while (sp > 11f && measurer.measure(longest, base.copy(fontSize = sp.sp), maxLines = 1, softWrap = false).size.width > room) sp -= .25f
        sp
    }
    Text(name, style = base.copy(fontSize = size.sp, lineHeight = (size * 1.18f).sp))
}

/** A deck card as a picture (Stacks, Gallery): the card and its "4×". */
@Composable
private fun DeckCard(m: BenchModel, r: BenchRow, ui: BenchUi, a: BenchActions, drag: Drag, width: Dp, lift: () -> Unit) {
    val img = heroPainter(r.image.let(homeArt))
    val dragging = !r.fixed && drag.name == r.key && drag.from == "deck"
    Box(Modifier.width(width).aspectRatio(63f / 88f).scale(popScale(ui, r.key)).alpha(if (dragging) .35f else 1f).shadow(7.dp, CARD, spotColor = Color(0xBB000000)).clip(CARD).background(B.Panel)
        .benchCard(drag, r.key, r.image, "deck", lift, lifts = !r.fixed) { if (r.fixed) a.open(r.key) else ui.peek = r.key }.rowPad(m, r, ui, a).semantics { contentDescription = "${r.qty} ${r.name}" }) {
        if (img != null) Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        if (r.short > 0) Box(Modifier.fillMaxSize().background(Color(0x66000000)))
        Text("${r.qty}×", style = f(11f, 800, Color.White, line = 15.4f), modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).clip(RoundedCornerShape(7.dp))
            .background(Color(0xE8141820)).border(1.dp, Color(0x60FFFFFF), RoundedCornerShape(7.dp)).padding(horizontal = 6.dp, vertical = 1.dp))
    }
}

/** .drow: thumbnail, "4× Name", set · number, rarity, roles, and what is still to craft or buy; the cost on the right. */
@Composable
private fun DetailRow(m: BenchModel, r: BenchRow, ui: BenchUi, a: BenchActions, drag: Drag, lift: () -> Unit) {
    val img = heroPainter(r.image.let(homeArt))
    val dragging = !r.fixed && drag.name == r.key && drag.from == "deck"
    Row(Modifier.fillMaxWidth().scale(popScale(ui, r.key)).alpha(if (dragging) .35f else 1f).clip(RoundedCornerShape(12.dp)).background(Color(0xFF161A24))
        .border(1.dp, B.Line, RoundedCornerShape(12.dp)).benchCard(drag, r.key, r.image, "deck", lift, lifts = !r.fixed) { if (r.fixed) a.open(r.key) else ui.peek = r.key }.rowPad(m, r, ui, a).padding(5.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        Box(Modifier.width(40.dp).aspectRatio(63f / 88f).clip(RoundedCornerShape(4.dp)).background(B.Panel)) { if (img != null) Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("${r.qty}× ${r.name}", style = f(12f, 700, line = 15f))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                @Composable fun tag(s: String, c: Color = B.Mute) = Text(s, style = f(11f, 700, c), maxLines = 1, softWrap = false,
                    modifier = Modifier.clip(RoundedCornerShape(5.dp)).background(Color(0x12FFFFFF)).padding(horizontal = 5.dp))
                if (r.set.isNotEmpty()) tag(r.set.uppercase() + if (r.number.isNotEmpty()) " · #${r.number}" else "")
                if (r.rarity.isNotEmpty()) tag(r.rarity.replaceFirstChar { it.uppercase() }, B.Gold)
                for (role in r.roles) tag(role)
                for ((t, bad) in r.flags) tag(t, if (bad) B.Coral else B.Gold)
                if (r.short > 0) tag(r.note.ifEmpty { if (m.play) "craft ${r.short}" else "need ${r.short}" }, B.Coral)
            }
        }
        if (r.emb.isNotEmpty()) EmbRow(r.emb) else ManaCost(r.cost, 15.dp)
    }
}

/** .basics: the five basics as art tiles under Lands, free and unlimited; a tap adds one. */
@Composable
private fun Basics(basics: List<Pair<String, String>>, ui: BenchUi, a: BenchActions) = Row(Modifier.fillMaxWidth().padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    for ((name, art) in basics) {
        val p = heroPainter(art.let(homeArt))
        Box(Modifier.weight(1f).height(44.dp).scale(popScale(ui, name)).clip(RoundedCornerShape(9.dp)).border(1.dp, B.Line, RoundedCornerShape(9.dp)).background(B.Panel)
            .clickable { a.step(name, 1); ui.pop = name; ui.popAt = System.nanoTime() }.semantics { contentDescription = "Add a $name"; role = Role.Button }) {
            if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = StripCrop, alignment = BiasAlignment(0f, -.56f))
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.3f to Color.Transparent, 1f to Color(0x99000000))))
            Text(name, style = f(11f, 800, Color.White).copy(shadow = androidx.compose.ui.graphics.Shadow(Color.Black, Offset(0f, 1f), 3f)), maxLines = 1, softWrap = false,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp))
        }
    }
}

// ---------------------------------------------------------------- the card browser

private class Section(val key: String, val tiles: List<BenchTile>, val label: String = if (key == "L") "Lands" else "Mana value $key")
private fun sections(tiles: List<BenchTile>, order: List<String>): List<Section> {
    // Yu-Gi-Oh! and Pokémon: the card's type group in the game's order, by name; the rail shows each group's first letter.
    if (tiles.any { it.section.isNotEmpty() }) return tiles.sortedWith(compareBy<BenchTile> { order.indexOf(it.section).let { i -> if (i < 0) order.size else i } }.thenBy { it.name })
        .groupBy { it.section }.map { (k, v) -> Section(k.take(1).uppercase(), v, k) }
    val out = LinkedHashMap<String, MutableList<BenchTile>>()
    for (t in tiles.sortedWith(compareBy<BenchTile> { it.land }.thenBy { it.cmc }.thenBy { it.name })) {
        val k = if (t.land) "L" else if (t.cmc >= 6) "6+" else "${t.cmc.toInt()}"
        out.getOrPut(k) { ArrayList() } += t
    }
    return out.map { Section(it.key, it.value) }
}

@Composable
private fun Browser(m: BenchModel, ui: BenchUi, a: BenchActions, drag: Drag, switch: (@Composable () -> Unit)?, cols: Int, lift: () -> Unit, onFilter: () -> Unit) {
    val remove = drag.name != null && drag.from == "deck" && drag.zone == "coll"
    Column(Modifier.fillMaxSize()) {
        // The tools in one scrolling row, fading out at the right edge.
        Row(Modifier.fillMaxWidth().graphicsLayer { compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
            .drawWithFade().horizontalScroll(rememberScrollState()).padding(start = 10.dp, end = 26.dp, top = if (cols == 3) 0.dp else 6.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(buildAnnotatedString { append(m.browserTitle); if (m.shelves == null || ui.find.isNotBlank()) withStyle(SpanStyle(fontFamily = Site.Manrope, fontSize = 11.sp, color = B.Mute)) { append("  ${m.tiles.size}") } },
                style = cinzel(15f, B.Gold, track = .03f), maxLines = 1, softWrap = false, modifier = Modifier.padding(start = 2.dp, end = 4.dp))
            switch?.invoke()
            // Set (before Find, so it shows without scrolling the row): a glass dropdown of every set to open one full (Randall 8 Nov).
            if (m.shelves != null && ui.find.isBlank() && m.shelves.count { it.code.isNotEmpty() } > 1) {
                val open = m.shelves.firstOrNull { it.key == ui.openSet }
                val on = open != null || ui.setPick
                Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).background(if (on) Color(0x1AE5C47E) else Color(0x0DFFFFFF))
                    .border(1.dp, if (on) Color(0x99E5C47E) else Color(0x66E5C47E), RoundedCornerShape(12.dp)).clickable { ui.setPick = !ui.setPick }
                    .semantics { role = Role.Button; contentDescription = if (open != null) "Set: ${open.title}. Pick a set" else "Pick a set" }.padding(horizontal = 11.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(open?.code?.ifBlank { null } ?: "Set", style = f(12f, 700, if (on) B.Gold else B.Fg), maxLines = 1, softWrap = false)
                    Text(if (ui.setPick) "▴" else "▾", style = f(11f, 700, B.Gold))
                }
            FindBox(ui, onFilter)
            if (m.colorFilter) Row {
                for (k in listOf("W", "U", "B", "R", "G")) {
                    val on = k in ui.colors
                    Box(Modifier.size(44.dp).clickable { ui.colors = if (on) ui.colors - k else ui.colors + k; onFilter() }
                        .semantics { contentDescription = "Show ${COLOR_NAME[k]}"; selected = on }, contentAlignment = Alignment.Center) {
                        Box(Modifier.size(24.dp).then(if (on) Modifier.shadow(6.dp, CircleShape, ambientColor = Color.White, spotColor = Color.White).border(2.dp, Color.White, CircleShape) else Modifier)
                            .alpha(if (on) 1f else .38f)) { ManaCost("{$k}", 24.dp) }
                    }
                }
            }
            for (t in m.types) {
                val on = ui.type == t
                Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).background(if (on) Color(0x1AE5C47E) else Color(0x0DFFFFFF))
                    .border(1.dp, if (on) Color(0x99E5C47E) else B.Line, RoundedCornerShape(12.dp)).clickable { ui.type = t; onFilter() }
                    .semantics { role = Role.RadioButton; selected = on }.padding(horizontal = 11.dp), contentAlignment = Alignment.Center) {
                    Text(t, style = f(12f, 700, if (on) B.Gold else B.Mute), maxLines = 1, softWrap = false)
                }
            }
            }
        }
        if (m.shelves != null && ui.find.isBlank()) Box(Modifier.weight(1f).fillMaxWidth().padding(top = 2.dp).onGloballyPositioned { drag.grid = it.boundsInRoot().translate(-drag.origin) }) {
            Shelves(m, ui, a, drag, lift)
            if (ui.setPick) SetPicker(m.shelves, ui)
            if (remove) Box(Modifier.fillMaxSize().padding(horizontal = 6.dp, vertical = 2.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x14FF7A6A)).drawBehind {
                drawRoundRect(B.Coral, style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 6.dp.toPx()))), cornerRadius = CornerRadius(14.dp.toPx())) })
        } else BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().padding(top = 2.dp).onGloballyPositioned { drag.grid = it.boundsInRoot().translate(-drag.origin) }) {
            val n = if (cols > 0) cols else if (cols == 0) maxOf(3, ((maxWidth.value - 48) / 96).toInt()) else maxOf(4, ((maxWidth.value - 48) / 104).toInt())
            val secs = remember(m.tiles, m.sectionOrder) { sections(m.tiles, m.sectionOrder) }
            // Each section's first item in the grid, for the letter rail.
            val starts = remember(secs) { var i = 0; secs.map { s -> (s.key to i).also { i += 1 + s.tiles.size } } }
            // A new search or filter starts the grid at the top; coming back to the Bench keeps its place.
            var asked by remember { mutableStateOf(Triple(ui.find, ui.colors, ui.type)) }
            LaunchedEffect(ui.find, ui.colors, ui.type) { val now = Triple(ui.find, ui.colors, ui.type); if (now != asked) { asked = now; ui.tileGrid.scrollToItem(0) } }
            LazyVerticalGrid(GridCells.Fixed(n), Modifier.fillMaxSize().semantics { contentDescription = "Cards to add" }, ui.tileGrid, PaddingValues(start = 10.dp, end = 38.dp, top = 2.dp, bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (secs.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                    Text(m.browserNote ?: "No cards match", style = f(11f, 700, B.Gold, track = .1f).copy(fontSize = 11.sp), modifier = Modifier.padding(top = 8.dp, start = 2.dp))
                }
                for (s in secs) {
                    item(key = "s:" + s.label, span = { GridItemSpan(maxLineSpan) }) { SectionHead(s.label) }
                    itemsIndexed(s.tiles, key = { i, t -> "t:${s.label}:$i:${t.key}" }) { _, t -> Tile(m, t, ui, a, drag, lift) }
                }
                // The deck page's own add by name, for a card the collection doesn't have (app.js deckAdd; tcg.js A.tDeckFind).
                if (m.findMore != null && ui.find.isNotBlank()) item(key = "findMore", span = { GridItemSpan(maxLineSpan) }) {
                    Box(Modifier.padding(top = 6.dp).heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x1AE5C47E))
                        .border(1.dp, Color(0x99E5C47E), RoundedCornerShape(12.dp)).clickable { a.findMore(ui.find.trim()) }.semantics { role = Role.Button }
                        .padding(horizontal = 14.dp), contentAlignment = Alignment.CenterStart) {
                        Text("${m.findMore} “${ui.find.trim()}”", style = f(13f, 700, B.Gold))
                    }
                }
                if (secs.isNotEmpty() && m.browserNote != null) item(span = { GridItemSpan(maxLineSpan) }) {
                    Text(m.browserNote, style = f(12f, 600, B.Mute), modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp))
                }
            }
            if (remove) Box(Modifier.fillMaxSize().padding(horizontal = 6.dp, vertical = 2.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x14FF7A6A)).drawBehind {
                drawRoundRect(B.Coral, style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 6.dp.toPx()))), cornerRadius = CornerRadius(14.dp.toPx())) })
            if (secs.isNotEmpty()) Rail(secs.map { it.key }, starts.toMap(), ui.tileGrid, Modifier.align(Alignment.TopEnd))
        }
    }
}
private val COLOR_NAME = mapOf("W" to "white", "U" to "blue", "B" to "black", "R" to "red", "G" to "green")

// ---------------------------------------------------------------- All cards, shelf by shelf

/** The shelves, one under another; each asks for its cards when it comes on screen, so only what you scroll to ever loads. */
@Composable
private fun Shelves(m: BenchModel, ui: BenchUi, a: BenchActions, drag: Drag, lift: () -> Unit) {
    // A set with no cards for this deck stays as one line, so the shelves under it don't slide up into view and load on their own.
    val shown = m.shelves.orEmpty()
    // Until the shelves are known the list isn't drawn at all, so its kept scroll place (BenchUi.shelfList) isn't lost to an empty list.
    if (shown.isEmpty()) { Text(m.browserNote ?: "Looking through every card…", style = f(12f, 600, B.Mute), modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)); return }
    val open = ui.openSet?.let { k -> shown.firstOrNull { it.key == k } }
    if (open != null) { SetFull(m, open, ui, a, drag, lift); return }
    androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxSize().semantics { contentDescription = "Cards to add, a shelf at a time" }, ui.shelfList,
        contentPadding = PaddingValues(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items(shown.size, key = { "sh:" + shown[it].key }) { i -> val s = shown[i]
            // Waiting, or failed (its note says scroll back to try again): asks once it has stayed on screen a moment, so a fling past
            // a dozen shelves asks for none of them; leaving the screen cancels the ask.
            if (s.tiles == null || s.loading || s.note.isNotEmpty()) LaunchedEffect(s.key, m.shelvesGen) { kotlinx.coroutines.delay(160); a.shelf(s.key) }
            Shelf(m, s, m.cardBack, ui, a, drag, lift)
        }
    }
}

@Composable
private fun Shelf(m: BenchModel, s: BenchShelf, back: String, ui: BenchUi, a: BenchActions, drag: Drag, lift: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    val none = s.tiles != null && s.tiles.isEmpty() && s.note.isEmpty()
    Column(Modifier.fillMaxWidth().padding(horizontal = if (s.gold) 6.dp else 0.dp).then(if (s.gold) Modifier.clip(shape)
        .background(Brush.verticalGradient(listOf(Color(0x24E5C47E), Color(0x08E5C47E)))).border(1.dp, Color(0x59E5C47E), shape) else Modifier)
        .padding(top = if (none) 4.dp else 8.dp, bottom = 4.dp).semantics(mergeDescendants = false) { contentDescription = s.title + if (s.code.isNotEmpty()) ", ${s.code}" else "" }) {
        ShelfHead(s, none, open = false) { ui.openSet = s.key }
        if (none) Unit
        else if (s.note.isNotEmpty() && s.tiles.isNullOrEmpty()) Text(s.note, style = f(12f, 600, B.Mute), modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
        else {
            val n = s.tiles?.size ?: 6
            androidx.compose.foundation.lazy.LazyRow(Modifier.fillMaxWidth().padding(top = 6.dp), contentPadding = PaddingValues(horizontal = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(n, key = { i -> s.tiles?.getOrNull(i)?.let { "t:${it.key}:$i" } ?: "b:$i" }) { i ->
                    val t = s.tiles?.getOrNull(i)
                    Column(Modifier.width(SHELF_TILE)) {
                        FlipIn(if (t == null) null else s.key + "|" + t.key, i, back, ui) { if (t != null) Tile(m, t, ui, a, drag, lift) }
                        val why = t?.let { s.why[it.key] }
                        if (why != null) Text(why, style = f(11f, 700, B.Gold, line = 13f), maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 3.dp))
                    }
                }
            }
        }
    }
}
private val SHELF_TILE = 96.dp

/**
 * A shelf's heading: its name, code, date and count. A set's name opens it full (a gold › after it), and in the full view
 * closes it again (a ‹ before it).
 */
@Composable
private fun ShelfHead(s: BenchShelf, none: Boolean, open: Boolean, onClick: () -> Unit) {
    val opens = s.code.isNotEmpty() && !none
    Row(Modifier.fillMaxWidth().then(if (opens) Modifier.clip(RoundedCornerShape(8.dp)).padActs(PadActs(a = if (open) "Every set" else "Open set"))
        .clickable(onClickLabel = if (open) "Back to every set" else "Open the whole set", onClick = onClick) else Modifier)
        .padding(horizontal = 12.dp, vertical = if (opens) 4.dp else 0.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (open) Text("‹", style = f(18f, 700, B.Gold, line = 18f))
        // The name keeps its room (up to most of the row); the date and count give way first.
        Text(s.title, style = f(if (open) 15f else 13f, if (none) 600 else 800, if (none) B.Mute else if (s.gold) B.Gold else B.Fg), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, softWrap = false,
            modifier = Modifier.widthIn(max = 230.dp))
        if (s.code.isNotEmpty()) Text(s.code, style = f(11f, 800, B.Mute, track = .06f), maxLines = 1, softWrap = false,
            modifier = Modifier.border(1.dp, Color(0x24FFFFFF), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 1.dp))
        if (opens && !open) Text("›", style = f(16f, 700, B.Gold, line = 16f))
        val right = if (none) listOf("No cards here for this deck") else listOfNotNull(s.meta.ifBlank { null }, s.tiles?.takeIf { it.isNotEmpty() }?.let { if (s.count > it.size) "${it.size}+ cards" else "${it.size} card${if (it.size == 1) "" else "s"}" })
        Text(right.joinToString(" · "), style = f(11f, 600, B.Mute), maxLines = 1, softWrap = false, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}

/** One set, full: its heading (tap, or Back, for every shelf again) and every card in a grid; Magic's next page loads near the end. */
@Composable
private fun SetFull(m: BenchModel, s: BenchShelf, ui: BenchUi, a: BenchActions, drag: Drag, lift: () -> Unit) {
    androidx.activity.compose.BackHandler(enabled = ui.peek == null) { ui.openSet = null }
    PadScreen(PadActs(b = "Every set"))
    if (s.tiles == null || s.loading || s.note.isNotEmpty()) LaunchedEffect(s.key, m.shelvesGen) { a.shelf(s.key) }
    val tiles = s.tiles.orEmpty()
    LaunchedEffect(s.key) { if (ui.setGridFor != s.key) { ui.setGridFor = s.key; ui.setGrid.scrollToItem(0) } }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val n = maxOf(3, ((maxWidth.value - 20) / 104).toInt())
        LazyVerticalGrid(GridCells.Fixed(n), Modifier.fillMaxSize().semantics { contentDescription = "${s.title}, every card" }, ui.setGrid,
            PaddingValues(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item(key = "head", span = { GridItemSpan(maxLineSpan) }) { ShelfHead(s, false, open = true) { ui.openSet = null } }
            val note = if (s.note.isNotEmpty() && tiles.isEmpty()) s.note else if (s.tiles == null) "Opening the set…" else if (tiles.isEmpty()) "No cards here for this deck" else null
            if (note != null) item(key = "note", span = { GridItemSpan(maxLineSpan) }) { Text(note, style = f(12f, 600, B.Mute), modifier = Modifier.padding(horizontal = 2.dp, vertical = 8.dp)) }
            itemsIndexed(tiles, key = { i, t -> "f:${t.key}:$i" }) { _, t -> Tile(m, t, ui, a, drag, lift) }
            if (s.count > tiles.size && tiles.isNotEmpty()) item(key = "more", span = { GridItemSpan(maxLineSpan) }) {
                LaunchedEffect(tiles.size) { a.shelfMore(s.key) }
                Text("More of the set…", style = f(12f, 600, B.Mute), textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp))
            }
        }
    }
}

/** The Set dropdown: glass over the shelves, a search, every set by year newest first; one opens full, "Every set" goes back to the shelves. */
@Composable
private fun SetPicker(shelves: List<BenchShelf>, ui: BenchUi) {
    var q by remember { mutableStateOf("") }
    androidx.activity.compose.BackHandler { ui.setPick = false }
    PadScreen(PadActs(b = "Close", opaque = true))
    val sets = shelves.filter { it.code.isNotEmpty() }
    val t = q.trim()
    val shown = if (t.isEmpty()) sets else sets.filter { it.title.contains(t, true) || it.code.equals(t, true) }
    val shape = RoundedCornerShape(16.dp)
    // A tap outside the glass closes it (the panel's own bounds, so its rows and search keep their taps).
    var panel by remember { mutableStateOf(Rect.Zero) }
    Box(Modifier.fillMaxSize().background(Color(0x66000000)).pointerInput(Unit) {
        awaitEachGesture { val d = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial); if (!panel.contains(d.position)) ui.setPick = false } }) {
        Column(Modifier.align(Alignment.TopEnd).padding(top = 4.dp, end = 10.dp, start = 10.dp).widthIn(max = 320.dp).fillMaxWidth().fillMaxHeight(.94f)
            .shadow(24.dp, shape, spotColor = Color.Black).clip(shape).background(Brush.verticalGradient(listOf(Color(0xF22A2530), Color(0xF21C1920))))
            .border(1.dp, Color(0x66E5C47E), shape).onGloballyPositioned { c -> panel = Rect(c.positionInParent(), c.size.toSize()) }
            .padLayer().padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            BasicTextField(q, { q = it.take(40) }, singleLine = true, textStyle = f(13f, 600), cursorBrush = SolidColor(B.Gold),
                modifier = Modifier.fillMaxWidth().height(42.dp).clip(RoundedCornerShape(10.dp)).background(Color(0x0FFFFFFF)).border(1.dp, B.Line, RoundedCornerShape(10.dp))
                    .semantics { contentDescription = "Find a set" },
                decorationBox = { field -> Box(Modifier.fillMaxSize().padding(horizontal = 10.dp), contentAlignment = Alignment.CenterStart) {
                    if (q.isEmpty()) Text("Find a set…", style = f(13f, 600, B.Mute), maxLines = 1, softWrap = false)
                    field()
                } })
            androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxWidth().weight(1f, fill = false)) {
                item(key = "all") { SetOption("Every set", "", ui.openSet == null, gold = true) { ui.openSet = null; ui.setPick = false } }
                if (shown.isEmpty()) item(key = "none") { Text("No set by that name.", style = f(12f, 600, B.Mute), modifier = Modifier.padding(10.dp)) }
                var year = ""
                for (s in shown) {
                    val y = s.meta.takeLast(4).takeIf { it.all(Char::isDigit) }.orEmpty()
                    if (y != year && y.isNotEmpty()) { year = y; item(key = "y$y") { Text(y, style = f(11f, 800, B.Gold, track = .1f), modifier = Modifier.padding(start = 8.dp, top = 10.dp, bottom = 2.dp)) } }
                    item(key = "s:" + s.key) { SetOption(s.title, s.code, ui.openSet == s.key) { ui.openSet = s.key; ui.setPick = false } }
                }
            }
        }
    }
}

@Composable
private fun SetOption(title: String, code: String, on: Boolean, gold: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp)).background(if (on) Color(0x24E5C47E) else Color.Transparent)
        .clickable(onClick = onClick).semantics { selected = on }.padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = f(13f, if (gold) 800 else 600, if (gold || on) B.Gold else B.Fg), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, softWrap = false, modifier = Modifier.weight(1f))
        if (code.isNotEmpty()) Text(code, style = f(11f, 800, B.Mute, track = .06f), maxLines = 1, softWrap = false,
            modifier = Modifier.border(1.dp, Color(0x24FFFFFF), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 1.dp))
    }
}

/**
 * A card back that turns over into [content] the first time it shows ([key] null: still waiting, the back shimmers). Each card turns a
 * moment after the one before it; a card that already turned stays face up (BenchUi.flipped).
 */
@Composable
private fun FlipIn(key: String?, i: Int, back: String, ui: BenchUi, content: @Composable () -> Unit) {
    val turn = remember(key) { androidx.compose.animation.core.Animatable(if (key != null && key in ui.flipped) 0f else 180f) }
    if (key != null) LaunchedEffect(key) {
        if (turn.value > 0f) { kotlinx.coroutines.delay(if (i < 8) 60L * i else 0L); turn.animateTo(0f, tween(520, easing = FOCUS_EASE)) }
        ui.flipped += key
    }
    val d = LocalDensity.current.density
    Box(Modifier.fillMaxWidth().graphicsLayer { rotationY = turn.value; cameraDistance = 14f * d }) {
        if (turn.value <= 90f && key != null) content()
        else Column(Modifier.fillMaxWidth().graphicsLayer { rotationY = 180f }) {
            Spacer(Modifier.height(15.dp))
            CardBack(back, key == null)
        }
    }
}

/** The game's card back, drawn: Magic's brown oval, Yu-Gi-Oh!'s dark swirl with its gold eye, Pokémon's blue with the ball. */
@Composable
private fun CardBack(game: String, waiting: Boolean) {
    val shine = if (waiting) androidx.compose.animation.core.rememberInfiniteTransition(label = "back").animateFloat(-1f, 2f,
        androidx.compose.animation.core.infiniteRepeatable(tween(1300, easing = androidx.compose.animation.core.LinearEasing)), label = "shine") else null
    // The back's brushes are made once for its size; only the shine moves (a fixed brush slid across, read at draw time).
    Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f).shadow(8.dp, CARD, spotColor = Color.Black).clip(CARD).drawWithCache {
        val w = size.width; val h = size.height; val c = Offset(w / 2f, h / 2f)
        val sweep = Brush.sweepGradient(listOf(Color(0xFF3A1D0E), Color(0xFF7A4A1C), Color(0xFF3A1D0E), Color(0xFF5B3214), Color(0xFF3A1D0E)), c)
        val eye = Brush.radialGradient(listOf(Color(0xFFF0C870), Color(0xFF8A4A14), Color.Transparent), c, w * .3f)
        val blue = Brush.verticalGradient(listOf(Color(0xFF2C5AB8), Color(0xFF183A86)))
        val brown = Brush.radialGradient(listOf(Color(0xFF6B4A2B), Color(0xFF2E1D10)), c, h * .7f)
        val oval = Brush.radialGradient(listOf(Color(0xFFE09A4A), Color(0xFFC9752F), Color(0xFF8A4518)), c, w * .3f)
        val gleam = Brush.linearGradient(listOf(Color.Transparent, Color(0x2EFFFFFF), Color.Transparent), Offset(-w * .4f, 0f), Offset(w * .4f, h))
        onDrawBehind {
            when (game) {
                "ygo" -> { drawRect(sweep); drawCircle(eye, w * .3f, c); drawRect(Color(0xFF120A05), style = Stroke(w * .04f)) }
                "ptcg" -> {
                    drawRect(blue)
                    val r = w * .24f
                    drawArc(Color(0xFFD8352D), 180f, 180f, true, Offset(c.x - r, c.y - r), androidx.compose.ui.geometry.Size(r * 2, r * 2))
                    drawArc(Color(0xFFF4F1EA), 0f, 180f, true, Offset(c.x - r, c.y - r), androidx.compose.ui.geometry.Size(r * 2, r * 2))
                    drawRect(Color(0xFF222222), Offset(c.x - r, c.y - r * .1f), androidx.compose.ui.geometry.Size(r * 2, r * .2f))
                    drawCircle(Color(0xFF222222), r, c, style = Stroke(r * .14f))
                    drawCircle(Color(0xFFF4F1EA), r * .26f, c); drawCircle(Color(0xFF222222), r * .26f, c, style = Stroke(r * .1f))
                    drawRect(Color(0xFFE9E4D0), style = Stroke(w * .05f))
                }
                else -> {
                    drawRect(brown)
                    drawOval(Color(0xFF5A2C12), Offset(w * .16f, h * .14f), androidx.compose.ui.geometry.Size(w * .68f, h * .72f))
                    drawOval(oval, Offset(w * .27f, h * .25f), androidx.compose.ui.geometry.Size(w * .46f, h * .5f))
                    drawRect(Color(0xFF1A120B), style = Stroke(w * .05f))
                }
            }
            shine?.let { p -> translate(left = p.value * w) { drawRect(gleam, Offset(-w * .4f, 0f), androidx.compose.ui.geometry.Size(w * .8f, h)) } }
        }
    })
}

/** The tools row fades to nothing at its right edge (mask-image 90 %). */
private fun Modifier.drawWithFade() = this.drawWithContent {
    drawContent()
    drawRect(Brush.horizontalGradient(.9f to Color.Black, 1f to Color.Transparent, startX = 0f, endX = size.width), blendMode = androidx.compose.ui.graphics.BlendMode.DstIn)
}

@Composable
private fun FindBox(ui: BenchUi, onFilter: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val w by animateFloatAsState(if (focused || ui.find.isNotEmpty()) 170f else 118f, tween(200), label = "find")
    BasicTextField(ui.find, { ui.find = it.take(60); onFilter() }, singleLine = true, textStyle = f(13f, 600), cursorBrush = SolidColor(B.Gold),
        modifier = Modifier.width(w.dp).height(44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x0FFFFFFF))
            .border(1.dp, if (focused) B.Gold else B.Line, RoundedCornerShape(12.dp)).onFocusChanged { focused = it.isFocused }.semantics { contentDescription = "Find a card" },
        decorationBox = { field -> Box(Modifier.fillMaxSize().padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
            if (ui.find.isEmpty()) Text("Find a card", style = f(13f, 600, B.Mute), maxLines = 1, softWrap = false)
            field()
        } })
}

@Composable
private fun SectionHead(label: String) = Row(Modifier.fillMaxWidth().padding(start = 2.dp, end = 2.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    Text(label.uppercase(), style = f(11f, 700, B.Gold, track = .1f), maxLines = 1, softWrap = false)
    Box(Modifier.weight(1f).height(1.dp).background(Brush.horizontalGradient(listOf(B.Line, Color.Transparent))))
}

/**
 * .tile: Arena's diamonds over the card (gold = in the deck, outlined = owned and unused, dashed coral = in the deck but still to
 * craft or buy, dim = not owned; basics say how many are in), the card, and the gold + at its corner (off at the copy cap).
 */
@Composable
private fun Tile(m: BenchModel, t: BenchTile, ui: BenchUi, a: BenchActions, drag: Drag, lift: () -> Unit) {
    val img = heroPainter(t.image.let(homeArt))
    val dragging = drag.name == t.key && drag.from == "coll"
    Column(Modifier.fillMaxWidth().scale(popScale(ui, t.key)).alpha(if (dragging) .35f else 1f)) {
        Row(Modifier.fillMaxWidth().height(12.dp).padding(bottom = 0.dp), horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
            if (t.basic) Text("${t.inDeck} in deck", style = f(11f, 800, B.Gold, line = 12f), maxLines = 1, softWrap = false)
            else for (i in 0 until t.cap) Diamond(if (i < minOf(t.inDeck, t.own)) "d" else if (i < t.inDeck) "c" else if (i < t.own) "o" else "")
        }
        Spacer(Modifier.height(3.dp))
        Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f)) {
            Box(Modifier.fillMaxSize().shadow(8.dp, CARD, spotColor = Color.Black).clip(CARD).background(B.Panel)
                .dualFocus(FocusCard(t.name, t.image, owned = if (t.inDeck > 0) "${t.inDeck} in the deck" else null))
                .benchCard(drag, t.key, t.image, "coll", lift) { ui.peek = t.key }.then(cardPad(m, t.key, t.key, t.name, t.inDeck, ui, a, known = t.room).let { (acts, onA) -> Modifier.padTap(acts, onA) })
                .semantics { contentDescription = t.name }) {
                if (img != null) Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
                    colorFilter = if (t.locked) ColorFilter.colorMatrix(GREY) else null)
            }
            if (t.locked || t.tag.isNotEmpty()) Text(if (t.locked) t.lockWord else t.tag, style = f(11f, 800, if (t.tagBad) B.Coral else B.Gold), maxLines = 1, softWrap = false,
                modifier = Modifier.align(BiasAlignment(0f, .1f)).clip(RoundedCornerShape(99.dp)).background(Color(0xD90A0B0F))
                    .border(1.dp, if (t.tagBad) Color(0x99FF7A6A) else Color(0x80E5C47E), RoundedCornerShape(99.dp)).padding(horizontal = 8.dp, vertical = 3.dp))
            // .tile .add: 44 dp, scaled to .82 from the bottom right corner.
            val can = t.room > 0
            // The whole 44 dp takes the tap; the button draws at .82 of it, from the bottom right corner.
            Box(Modifier.align(Alignment.BottomEnd).padding(end = 2.dp, bottom = 2.dp).size(44.dp).clip(CircleShape)
                .clickable(enabled = can) { a.step(t.key, 1); ui.pop = t.key; ui.popAt = System.nanoTime() }
                .semantics { contentDescription = "Add ${t.name} to the deck"; role = Role.Button }, contentAlignment = Alignment.BottomEnd) {
                Box(Modifier.size(36.dp).shadow(6.dp, CircleShape, spotColor = Color(0x99000000)).clip(CircleShape)
                    .background(if (can) Brush.verticalGradient(listOf(Color(0xFFF2D18E), Color(0xFFC99A4B))) else Brush.verticalGradient(listOf(Color(0xFF5E5850), Color(0xFF443F38))))
                    .border(1.dp, if (can) Color(0xFFF6DFA8) else Color(0x55F6DFA8), CircleShape), contentAlignment = Alignment.Center) {
                    Text("+", style = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, lineHeight = 18.sp, color = if (can) Color(0xFF1B1408) else Color(0x991B1408)))
                }
            }
        }
    }
}
private val GREY = ColorMatrix().apply { setToSaturation(.1f) }.also { g -> val k = .55f; val v = g.values; for (i in 0 until 3) { v[i * 5] *= k; v[i * 5 + 1] *= k; v[i * 5 + 2] *= k } }

@Composable
private fun Diamond(kind: String) = Box(Modifier.size(8.dp).rotate(45f).clip(RoundedCornerShape(1.dp)).then(when (kind) {
    "d" -> Modifier.shadow(4.dp, RoundedCornerShape(1.dp), ambientColor = B.Gold, spotColor = B.Gold).background(B.Gold)
    "o" -> Modifier.border(1.5.dp, Color(0xFFE8E4DA), RoundedCornerShape(1.dp))
    "c" -> Modifier.drawBehind { drawRoundRect(B.Coral, style = Stroke(1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 1.5.dp.toPx()))), cornerRadius = CornerRadius(1.dp.toPx())) }
    else -> Modifier.background(Color(0x1FFFFFFF))
}))

/** .scrub: the letter rail; drag (or tap) to jump between sections, with the gold bubble beside the finger. */
@Composable
private fun Rail(keys: List<String>, starts: Map<String, Int>, grid: LazyGridState, modifier: Modifier) {
    val scope = rememberCoroutineScope()
    var on by remember { mutableIntStateOf(-1) }
    var y by remember { mutableFloatStateOf(0f) }
    var h by remember { mutableIntStateOf(1) }
    fun go(at: Float) {
        val i = ((at / h) * keys.size).toInt().coerceIn(0, keys.size - 1); y = at
        if (i != on) { on = i; scope.launch { grid.scrollToItem(starts[keys[i]] ?: 0) } }
    }
    Box(modifier.fillMaxHeight().padding(top = 2.dp, bottom = 8.dp)) {
        Column(Modifier.width(34.dp).fillMaxHeight().onGloballyPositioned { h = it.size.height.coerceAtLeast(1) }
            .semantics { contentDescription = "Jump to a section" }
            .pointerInput(keys) {
                awaitEachGesture {
                    val d = awaitFirstDown(); d.consume(); go(d.position.y)
                    while (true) { val e = awaitPointerEvent(); val ch = e.changes.firstOrNull { it.id == d.id } ?: break; if (!ch.pressed) break; ch.consume(); go(ch.position.y) }
                    on = -1
                }
            }, horizontalAlignment = Alignment.CenterHorizontally) {
            keys.forEachIndexed { i, k -> Box(Modifier.width(28.dp).weight(1f), contentAlignment = Alignment.Center) {
                Text(k, style = f(11f, 800, if (i == on) B.Gold else B.Mute), textAlign = TextAlign.Center, maxLines = 1, softWrap = false) } }
        }
        if (on >= 0) {
            val d = LocalDensity.current
            val top = with(d) { (y - 30.dp.toPx()).coerceIn(0f, (h - 60.dp.toPx()).coerceAtLeast(0f)).toDp() }
            Box(Modifier.offset(x = (-44).dp - 26.dp, y = top).size(60.dp).shadow(14.dp, CircleShape, spotColor = Color(0x80000000)).clip(CircleShape).background(B.GoldBtn),
                contentAlignment = Alignment.Center) { Text(keys[on], style = cinzel(20f, B.GoldInk, line = 22f)) }
        }
    }
}

// ---------------------------------------------------------------- footer

@Composable
private fun Footer(m: BenchModel, ui: BenchUi, split: Boolean, views: Boolean) = FlowRow(Modifier.fillMaxWidth().heightIn(min = 36.dp).background(Color(0xD90A0B0F))
    .drawBehind { drawLine(B.Line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }.padding(start = 12.dp, end = if (split) 4.dp else 12.dp),
    horizontalArrangement = Arrangement.spacedBy(10.dp), itemVerticalAlignment = Alignment.CenterVertically) {
    // The message, the seals, then (split) the four views; on a narrow deck column the views drop to their own line, at the right.
    Text(m.footLead, style = f(12f, 600, B.Mute), maxLines = 1, softWrap = false, modifier = Modifier.heightIn(min = 36.dp).wrapContentHeight())
    Box(Modifier.weight(1f).heightIn(min = 36.dp), contentAlignment = Alignment.CenterEnd) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            m.wallet?.let { w -> for (k in listOf("c", "u", "r", "m")) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                SealMini(k, 18.dp); Text("${w[k] ?: 0}", style = f(12f, 700, B.Fg), maxLines = 1, softWrap = false) } }
            m.footRight?.let { Text(it, style = f(12f, 600, B.Mute), maxLines = 1, softWrap = false) }
        }
    }
    if (views) Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) { ViewSwitch(ui, bare = true) }
}

// ---------------------------------------------------------------- the big card view (.peek)

@Composable
private fun Peek(m: BenchModel, ui: BenchUi, a: BenchActions, key: String, split: Boolean) {
    val row = m.groups.firstNotNullOfOrNull { g -> g.rows.firstOrNull { it.key == key } }
    val tile = m.tiles.firstOrNull { it.key == (row?.ref ?: key) }
    val name = row?.name ?: tile?.name ?: key
    val qty = row?.qty ?: tile?.inDeck ?: 0
    val image = row?.image ?: tile?.image ?: ""
    val own = tile?.own
    val short = row?.short ?: 0
    val basic = tile?.basic == true || m.basics.any { it.first == name }
    val room = tile?.room ?: if (basic) Int.MAX_VALUE else (4 - qty)
    val img = heroPainter(image.let(homeArt))
    // Controller: B closes the big view (the Bench's BackHandler); the Bench's tabs and Save stay out of it while it is up. Opened by a
    // tap while a pad is here, the ring moves onto the card so the d-pad starts inside it.
    PadScreen(PadActs(b = "Close", opaque = true))
    val first = remember { FocusRequester() }
    LaunchedEffect(key) { if (Pad.connected.value) runCatching { first.requestFocus() } }
    // The scrim is no stop for the d-pad (a tap outside still closes it).
    Box(Modifier.fillMaxSize().padLayer().background(Color(0xB8050609)).focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) { ui.peek = null }) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).padding(start = 20.dp, end = 20.dp, top = 40.dp, bottom = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically)) {
            BoxWithConstraints(Modifier.weight(1f, fill = false), contentAlignment = Alignment.Center) {
                val w = if (split) minOf(maxHeight * .9f * 63f / 88f, maxWidth) else minOf(260.dp, maxWidth * .62f, maxHeight * 63f / 88f)
                Box(Modifier.width(w).aspectRatio(63f / 88f).shadow(30.dp, CARD, spotColor = Color.Black).clip(CARD).background(B.Panel).focusRequester(first).padActs(PadActs(a = "Card page")).clickable { ui.peek = null; a.open(key) }
                    .semantics { contentDescription = "$name, open the card" }) {
                    if (img != null) Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(name, style = f(15f, 700, B.Fg), textAlign = TextAlign.Center)
                Text(if (basic) m.basicWord else listOfNotNull(own?.let { "You own $it" }, if (short > 0) row?.note?.ifEmpty { null } ?: "${if (m.play) "craft" else "need"} $short more" else null).joinToString(" · "),
                    style = f(12f, 600, B.Mute), textAlign = TextAlign.Center)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0xF214161D)).border(1.dp, B.Gold2, RoundedCornerShape(99.dp)).padding(3.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    StepDot("−", "Remove one", qty > 0) { a.step(key, -1) }
                    Text("$qty", style = f(18f, 800), textAlign = TextAlign.Center, modifier = Modifier.widthIn(min = 30.dp))
                    StepDot("+", "Add one", room > 0) { a.step(key, 1) }
                }
                if (m.play && short > 0 && row != null && row.seal.isNotEmpty()) Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(13.dp)).background(B.GoldBtn)
                    .clickable { a.craft(key, short) }.semantics { role = Role.Button }.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) { SealMini(row.seal, 18.dp); Text("Craft $short", style = f(14f, 800, B.GoldInk), maxLines = 1, softWrap = false) }
                // A Yu-Gi-Oh! row's move to or from the Side Deck (tcg.js A.tDeckMove), worded as the page words it.
                if (row != null && row.move.isNotEmpty()) a.move?.let { mv -> Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(13.dp)).background(Color(0xF214161D))
                    .border(1.dp, B.Gold2, RoundedCornerShape(13.dp)).clickable { ui.peek = null; mv(key) }.semantics { role = Role.Button }.padding(horizontal = 14.dp),
                    contentAlignment = Alignment.Center) { Text(row.move, style = f(14f, 800, B.Gold), maxLines = 1, softWrap = false) } }
                a.more?.let { more -> Square("⋯", "Card actions") { ui.peek = null; more(key) } }
            }
        }
    }
}

@Composable
private fun StepDot(label: String, desc: String, enabled: Boolean, onClick: () -> Unit) = Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0x12FFFFFF))
    .clickable(enabled = enabled, onClick = onClick).semantics { contentDescription = desc; role = Role.Button }.alpha(if (enabled) 1f else .3f), contentAlignment = Alignment.Center) {
    Text(label, style = f(22f, 700, B.Fg, line = 24f))
}

/** A Yu-Gi-Oh! or Pokémon row's emblems where Magic shows the cost (CollectionSet's TcgDock pill parts, without the set). */
@Composable
private fun EmbRow(emb: List<TcgEmb>) = Row(Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0x8C000000)).padding(horizontal = 6.dp, vertical = 3.dp),
    horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) { for (e in emb) TcgEmbItem(e) }


/**
 * Deck building on a dual-screen handheld's bottom screen (specs/dual-screen-native.md, screen 5): the deck's name, count, curve and
 * Power on the left, its list by type on the right. The card the ring is on in the pool lights its row gold ("2 → 3"), or shows as
 * a new row when it isn't in the deck yet.
 */
@Composable
private fun BenchBottom(m: BenchModel) {
    val on = DualScreen.focus?.name
    Row(Modifier.fillMaxSize().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(m.title, style = cinzel(17f, B.Gold), maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            Text(m.formatChip, style = f(12f, 700, B.Mute))
            m.stats.take(3).forEach { st -> Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.ExtraBold, color = if (st.warn) B.Coral else B.Fg)) { append(st.value) }; append("  " + st.label) }, style = f(13f, 600, B.Mute)) }
            m.power?.let { p -> Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.ExtraBold, color = B.Gold)) { append(p) }; append("  power" + if (m.tier.isNotBlank()) " · ${m.tier}" else "") }, style = f(13f, 600, B.Mute)) }
            // The mana curve from the list's own costs (Magic): 0 to 6+, the bar the ring's card would add to glows.
            val curve = IntArray(7); var any = false
            val onCost = m.groups.flatMap { it.rows }.firstOrNull { it.name == on }?.cost
            for (g in m.groups) for (r in g.rows) { if (r.cost.isBlank()) continue; any = true; curve[manaValue(r.cost).coerceAtMost(6)] += r.qty }
            if (any) {
                val top = maxOf(1, curve.max()); val lit = onCost?.let { manaValue(it).coerceAtMost(6) }
                Row(Modifier.fillMaxWidth().weight(1f, fill = false).heightIn(max = 90.dp).height(70.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom) {
                    curve.forEachIndexed { i, n -> Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.fillMaxWidth().height((52f * n / top).coerceAtLeast(2f).dp).clip(RoundedCornerShape(3.dp)).background(if (i == lit) B.Gold else Color(0x66E5C47E)))
                        Text(if (i == 6) "6+" else "$i", style = f(11f, 700, if (i == lit) B.Gold else B.Mute))
                    } }
                }
            }
        }
        androidx.compose.foundation.lazy.LazyColumn(Modifier.weight(1.2f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val inDeck = m.groups.any { g -> g.rows.any { it.name == on } }
            if (on != null && !inDeck) item(key = "new") { BottomRow("0 → 1", on, true) }
            for (g in m.groups) {
                item(key = "g:" + g.name) { Text("${g.name.uppercase()}  ${g.rows.sumOf { it.qty }}", style = f(11f, 800, B.Gold, track = .1f), modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)) }
                items(g.rows.size, key = { "r:${g.name}:" + g.rows[it].key }) { i -> val r = g.rows[i]; val lit = r.name == on
                    BottomRow(if (lit) "${r.qty} → ${r.qty + 1}" else "${r.qty}", r.name, lit) }
            }
        }
    }
}

@Composable
private fun BottomRow(qty: String, name: String, lit: Boolean) = Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (lit) Color(0x29E5C47E) else Color.Transparent)
    .padding(horizontal = 6.dp, vertical = 3.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
    Text(qty, style = f(12f, 800, if (lit) B.Gold else B.Mute), modifier = Modifier.widthIn(min = 22.dp))
    Text(name, style = f(13f, if (lit) 800 else 600, if (lit) B.Gold else B.Fg), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
}
