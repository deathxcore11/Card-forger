package dev.cardstashy.nativeplay.ui

import android.app.Activity
import android.app.Presentation
import androidx.activity.setViewTreeOnBackPressedDispatcherOwner
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.WindowManager
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.lifecycle.ViewModelStoreOwner
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner

/**
 * Dual-screen handhelds (Randall 8 Nov, specs/dual-screen-native.md: AYN Thor, Retroid Pocket Duo). A second built-in screen is
 * found at start and whenever displays change (the scan runs off the main thread); with one, the app draws a bottom screen there
 * as a second window fed by the same state. Settings › Dual screen turns it off (single screen, the app exactly as before) or back
 * on; the player's choice wins over what was found. Screens put their bottom view up with [BottomScreen] (the newest one shows);
 * with none, the bottom shows the card the ring, cursor or a touch is on ([focus]), else the app's mark. The controller's prompt
 * bar moves to the bottom screen's foot.
 */
object DualScreen {
    class Panel(val id: Int, val name: String, val width: Int, val height: Int, val hz: Float)

    /** The second built-in screen found, or null. */
    var detected by mutableStateOf<Panel?>(null); private set
    /** The player's own choice from Settings, or null to follow [detected]. */
    var choice by mutableStateOf<Boolean?>(null); private set
    /** The bottom screen is up: a second screen is there and the player hasn't turned it off. */
    val active: Boolean get() = detected != null && choice != false
    /** The card the gold ring, the stick cursor or a touch is on, on either screen; every bottom view reads it. */
    var focus by mutableStateOf<FocusCard?>(null)

    internal class Slot { var content by mutableStateOf<(@Composable () -> Unit)?>(null) }
    internal val slots = mutableStateListOf<Slot>()
    /** Views the bottom screen puts up on the top screen (a card page's Enlarge): the newest shows, over the app. */
    internal val tops = mutableStateListOf<Slot>()
    /** Keys a bottom case already prints on its buttons; the hint bar leaves them out. */
    internal val shownKeys = androidx.compose.runtime.mutableStateMapOf<Any, Set<String>>()
    /** The words on the bottom screen's own buttons, lower case: the bar never says them again on another key. */
    internal val shownLabels = androidx.compose.runtime.mutableStateMapOf<Any, Set<String>>()
    /** The card under the ring's quick look (Collection and Play grids); shown when no screen has its own bottom view. */
    var quick by mutableStateOf<QuickLook?>(null)

    private var prefs: android.content.SharedPreferences? = null
    private var window: BottomWindow? = null
    private var host: Activity? = null
    private val main = Handler(Looper.getMainLooper())

    fun init(context: Context) {
        val p = context.applicationContext.getSharedPreferences("play", Context.MODE_PRIVATE); prefs = p
        choice = when (p.getString("dual-screen", null)) { "on" -> true; "off" -> false; else -> null }
        val dm = context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager ?: return
        scan(dm)
        dm.registerDisplayListener(object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(id: Int) = scan(dm)
            override fun onDisplayRemoved(id: Int) = scan(dm)
            override fun onDisplayChanged(id: Int) { if (id != Display.DEFAULT_DISPLAY) scan(dm) }
        }, main)
    }

    /** Tests: pretend a second screen is (or isn't) there. */
    @androidx.annotation.VisibleForTesting internal fun pretend(panel: Panel?) { detected = panel }

    fun set(on: Boolean) { choice = on; prefs?.edit()?.putString("dual-screen", if (on) "on" else "off")?.apply(); sync() }

    /** A display that is a second screen of this device (not a cast, a recording or the system's own overlays). */
    internal fun isSecondScreen(id: Int, flags: Int, name: String): Boolean {
        if (id == Display.DEFAULT_DISPLAY || flags and Display.FLAG_PRIVATE != 0) return false
        val n = name.lowercase()
        return listOf("virtual", "overlay", "cast", "wifi", "wi-fi", "miracast", "wireless", "screenrecord", "recorder", "mirror").none { it in n }
    }

    private var scanning = false
    private fun scan(dm: DisplayManager) {
        if (scanning) return; scanning = true
        Thread {
            val found = runCatching {
                dm.displays.firstOrNull { d -> d.isValid && isSecondScreen(d.displayId, d.flags, d.name.orEmpty()) }?.let { d ->
                    val m = d.mode; Panel(d.displayId, d.name.orEmpty(), m.physicalWidth, m.physicalHeight, d.refreshRate) }
            }.getOrNull()
            main.post { scanning = false; if (found?.id != detected?.id || found?.width != detected?.width) { detected = found; sync() } }
        }.start()
    }

    /** The app is on screen: its bottom window may show. */
    fun attach(activity: Activity) { host = activity; sync() }
    fun detach(activity: Activity) { if (host === activity) { host = null; sync() } }

    private fun sync() {
        val a = host; val p = detected
        val want = a != null && p != null && active && !a.isFinishing
        val w = window
        if (w != null && (!want || w.display.displayId != p?.id || w.owner !== a)) { runCatching { w.dismiss() }; window = null }
        if (want && window == null) {
            val d = (a!!.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager).getDisplay(p!!.id) ?: return
            window = runCatching { BottomWindow(a, d).also { it.show() } }.getOrNull()
        }
    }

    private class BottomWindow(val owner: Activity, display: Display) : Presentation(owner, display) {
        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            // The keys stay with the app's main window: the pad drives both screens from there. Touch still works here.
            window?.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)
            val view = ComposeView(context).apply { setContent { BottomRoot() } }
            window?.decorView?.let { v ->
                (owner as? LifecycleOwner)?.let { v.setViewTreeLifecycleOwner(it) }
                (owner as? SavedStateRegistryOwner)?.let { v.setViewTreeSavedStateRegistryOwner(it) }
                (owner as? ViewModelStoreOwner)?.let { v.setViewTreeViewModelStoreOwner(it) }
                // Sheets drawn down here (a card's page) close with the app's own back (B), so they share its dispatcher.
                (owner as? androidx.activity.OnBackPressedDispatcherOwner)?.let { v.setViewTreeOnBackPressedDispatcherOwner(it) }
            }
            setContentView(view)
        }
    }
}

/** What the bottom screen shows about a card: its name and art, and what is known of it (type, rules text, copies owned). */
/** [price]: Collection only (Play stays price-free). [actions]: the card's own buttons on the bottom screen: the first is what A does on the tile (Open card), the second what X does (Got one). */
data class FocusCard(val name: String, val image: String?, val type: String? = null, val text: String? = null, val owned: String? = null, val game: String = "mtg",
                     val price: String? = null, val actions: List<PadAct> = emptyList())

/**
 * This screen's bottom view while it is up (only drawn with the bottom screen on). The newest one shows, so a sheet over a page
 * puts its own up and the page's comes back when it closes.
 */
@Composable
fun BottomScreen(content: @Composable () -> Unit) {
    if (!DualScreen.active) return
    val slot = remember { DualScreen.Slot() }
    slot.content = content
    DisposableEffect(slot) { DualScreen.slots += slot; onDispose { DualScreen.slots -= slot } }
}

/** The bottom screen: the newest [BottomScreen] view (else the focused card, else the mark), with the controller's bar at its foot. */
@Composable
internal fun BottomRoot() {
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF15171D), Color(0xFF0B0C10))))) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                val view = DualScreen.slots.lastOrNull()?.content
                val q = DualScreen.quick
                if (view != null) view() else if (q != null) QuickLookCase(q) else FocusedCardView(DualScreen.focus)
            }
            BottomPadBar()
        }
    }
}

/** The bottom screen's default: the card the ring is on, large, with its words beside it; with none, the app's mark. */
@Composable
fun FocusedCardView(card: FocusCard?, extra: (@Composable () -> Unit)? = null) {
    if (card == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // At rest: the mark alone, never an instruction (U13).
                BrandMark(56.dp)
            }
        }
        return
    }
    // The same case as Play's Trunk card and Collection's lots (family T2); only the facts differ. Money shows on the Collection side alone.
    // A case button always prints its key: A opens, X is the main action (the tile binds the same two).
    // One gold button per case: X (the main action) when there is one, else A.
    val acts = card.actions.filter { it.run != null }.take(2)
    val buttons = acts.mapIndexed { i, a -> CaseButton(if (i == 0) "A" else "X", a.label, gold = i == acts.lastIndex) { a.run?.invoke() } }
    val facts = listOfNotNull(card.owned?.takeIf { it.isNotBlank() }?.let { "Yours" to it }, card.price?.takeIf { it.isNotBlank() }?.let { "Price" to it })
    QuickLookCase(QuickLook("focus:" + card.name, if (card.price.isNullOrBlank()) "Card" else "Collection · Card", card.name, card.image, card.type, card.text, facts, buttons,
        extra = extra?.let { e -> { e() } }))
}

/** The controller's prompt bar, at the bottom screen's foot while it is up (the top screen's is hidden then). */
@Composable
private fun BottomPadBar() {
    val pad by Pad.connected.collectAsState()
    if (!pad) return
    val shown = DualScreen.shownKeys.values.flatten().toSet()
    val said = DualScreen.shownLabels.values.flatten().toSet()
    val items = PadPrompts.prompts(PadPrompts.current()).filter { it.first !in shown && it.second.lowercase() !in said }
    if (items.isEmpty()) return
    Row(Modifier.fillMaxWidth().height(44.dp).background(Color(0xF2101217)).border(1.dp, Color(0x30D6AD64)).padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
        items.forEach { (b, l) -> PadKey(b, l) }
    }
}

/** The ring, the stick cursor or a finger landing on this card makes it the card both screens know about ([DualScreen.focus]). */
fun Modifier.dualFocus(card: FocusCard): Modifier = if (!DualScreen.active) this else this
    .onFocusChanged { if (it.isFocused) DualScreen.focus = card }
    .pointerInput(card) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial); if (!PadCursor.dragging) DualScreen.focus = card } }

/**
 * Two screens, Collection (Randall 9 Nov, "No pop-up, bottom is the page"): the card page lives on the bottom screen and follows the
 * ring on the top grid. A tile the ring rests on for a moment opens its page below; a quick sweep over the grid opens nothing.
 */
object DualFollow {
    private val main = android.os.Handler(android.os.Looper.getMainLooper())
    private var pending: Runnable? = null
    fun request(run: () -> Unit) {
        pending?.let(main::removeCallbacks)
        val r = Runnable { pending = null; run() }
        pending = r; main.postDelayed(r, 320)
    }
}

/** On two screens the ring resting on this tile opens its card page on the bottom screen ([DualFollow]). */
fun Modifier.followCard(open: () -> Unit): Modifier = if (!DualScreen.active) this else onFocusChanged { if (it.isFocused) DualFollow.request(open) }

/**
 * Opening a card page: on one screen it stacks over the last (back returns to it); on two screens the bottom holds one page,
 * the newest, so the routes' `cards + open` swaps the page instead of piling pages up under the ring.
 */
internal operator fun List<CardOpen>.plus(open: CardOpen): List<CardOpen> = if (DualScreen.active) listOf(open) else toMutableList().apply { add(open) }

/** From the bottom screen, a view drawn over the top screen while it is composed (the card page's Y: the card big up top). */
@Composable
fun TopScreen(content: @Composable () -> Unit) {
    val slot = remember { DualScreen.Slot() }
    slot.content = content
    DisposableEffect(slot) { DualScreen.tops += slot; onDispose { DualScreen.tops -= slot } }
}

/** On the app's root, over everything: the newest [TopScreen] view. */
@Composable
fun TopScreenHost() { DualScreen.tops.lastOrNull()?.content?.invoke() }

/** On two screens, the ring on this card puts its [QuickLook] on the bottom; leaving it takes the look away. */
fun Modifier.quickLook(make: () -> QuickLook): Modifier = if (!DualScreen.active) this else onFocusChanged { f ->
    if (f.hasFocus) DualScreen.quick = make() else { val q = DualScreen.quick; if (q != null && q.key == make().key) DualScreen.quick = null }
}
