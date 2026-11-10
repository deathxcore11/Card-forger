package dev.cardstashy.nativeplay.ui

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusState
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.foundation.focusGroup
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.focus.FocusEventModifierNode
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * One button's job on the focused thing or the screen: the words the prompt bar shows, and what it does.
 * [run] null = shown only (A, which the focused clickable answers itself as d-pad centre).
 */
class PadAct(val label: String, val run: (() -> Unit)? = null)

/**
 * What the controller's buttons do here (Randall 7 Nov, preview "Contextual controls on a handheld"):
 * A press, B back, X the screen's main action, Y look closer (hold Y = tilt the card), LB/RB tabs, LT/RT page, Start menu.
 * Set on a focused item with [padActs] and on a screen or sheet with [PadScreen]. The focused item's A/X/Y win over the screen's.
 */
class PadActs(
    val a: String? = null,
    val y: PadAct? = null,
    /** Hold Y: true when the hold starts (after a short wait), false when it ends. A short press still runs [y]. */
    val yHold: ((Boolean) -> Unit)? = null,
    val x: PadAct? = null,
    /** B's words when B does something other than going back ("Close", "Cancel"). B itself is always the system back. */
    val b: String? = null,
    /** LB = -1, RB = +1. */
    val tabs: ((Int) -> Unit)? = null,
    val tabsLabel: String = "Tabs",
    /** LT = -1, RT = +1. */
    val page: ((Int) -> Unit)? = null,
    val pageLabel: String = "Page",
    val start: PadAct? = null,
    /** Select (Randall 9 Nov, console convention): the quick menu a long press opens on the thing under the ring. Only the focused
     *  item's counts. [PadAct.run] null = Select long-presses the item itself (PadCursor.holdFocused). */
    val menu: PadAct? = null,
    /** How far up the bar moves so a sheet's own bottom-right buttons stay clear. */
    val lift: Dp = 0.dp,
    /** A whole layer that owns the pad (a match, a sheet): the screens under it lend nothing. */
    val opaque: Boolean = false,
    /** The app's own bottom tabs (Play, Collection): their LB/RB give way to any tabs on the page itself, wherever those are composed. */
    val nav: Boolean = false,
    /** The app's first screen: B has nowhere to go, so no "Back" is shown (fix list E5). */
    val root: Boolean = false,
)

object PadPrompts {
    /** The acts of the thing the gold ring is on, by the node that set them. */
    private var focusOwner: Any? = null
    internal var focused by mutableStateOf<PadActs?>(null)
    /** Screens and sheets, innermost last. */
    internal val screens = mutableStateListOf<Pair<Any, PadActs>>()
    /** Anything in the app has controller focus (a plain button with no acts still gets "A Select"). */
    internal var anyFocus by mutableStateOf(false)
    /** Last pad press (uptime ms), for the half-strength fade. */
    internal var lastPress by mutableLongStateOf(0L)

    /** The screen layers there were when the ring landed: an opaque layer opened after that (a sheet over the item) silences the item. */
    private var focusLayers: Set<Any> = emptySet()
    internal var windowFocused by mutableStateOf(true)

    internal var focusManager: androidx.compose.ui.focus.FocusManager? = null
    internal var inputModes: androidx.compose.ui.input.InputModeManager? = null

    /**
     * A d-pad press with nothing focused: put the ring on the screen's first stop in that direction. Compose only moves focus
     * that exists, so without this the first press did nothing (Randall on the AYN Portal, 7 Nov). True when the ring landed.
     */
    /** Where the ring goes first when nothing has it (the match table: the hand chip), else null for the screen's own order. */
    @Volatile var entry: (() -> Boolean)? = null

    fun enter(keyCode: Int): Boolean {
        if (anyFocus) return false
        // W11/Y5 (Thor test4): on the table the first press lands on your hand, never on whatever spatial search finds first.
        inputModes?.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard)
        entry?.let { if (runCatching { it() }.getOrDefault(false)) return true }
        val fm = focusManager ?: return false
        val dir = when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> androidx.compose.ui.focus.FocusDirection.Up; KeyEvent.KEYCODE_DPAD_DOWN -> androidx.compose.ui.focus.FocusDirection.Down
            KeyEvent.KEYCODE_DPAD_LEFT -> androidx.compose.ui.focus.FocusDirection.Left; KeyEvent.KEYCODE_DPAD_RIGHT -> androidx.compose.ui.focus.FocusDirection.Right
            else -> return false
        }
        return fm.moveFocus(dir) || fm.moveFocus(androidx.compose.ui.focus.FocusDirection.Next)
    }

    /**
     * A controller's d-pad: into the screen when nothing has the ring; up and down always move the ring (a text field would
     * otherwise keep them for its caret and trap it). Left and right go on to the focused thing (sliders, the pack's hand).
     */
    fun navigate(keyCode: Int): Boolean {
        if (enter(keyCode)) return true
        val fm = focusManager ?: return false
        return when (keyCode) {
            // Nothing straight above or below (a glass top bar over a list that runs under it, a side rail's last tab): the next
            // stop in reading order instead, so the ring never sticks.
            KeyEvent.KEYCODE_DPAD_UP -> { fm.moveFocus(androidx.compose.ui.focus.FocusDirection.Up) || fm.moveFocus(androidx.compose.ui.focus.FocusDirection.Previous); true }
            KeyEvent.KEYCODE_DPAD_DOWN -> { fm.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) || fm.moveFocus(androidx.compose.ui.focus.FocusDirection.Next); true }
            else -> false
        }
    }

    internal fun focus(owner: Any, acts: PadActs) { if (focusOwner !== owner) focusLayers = screens.mapTo(HashSet()) { it.first }; focusOwner = owner; focused = acts }
    internal fun blur(owner: Any) { if (focusOwner === owner) { focusOwner = null; focused = null } }

    /** The screen layers that count: from the innermost down to the first opaque one. */
    private fun live(): List<PadActs> {
        val out = ArrayList<PadActs>()
        for (i in screens.indices.reversed()) { val a = screens[i].second; out += a; if (a.opaque) break }
        return out
    }

    /** The merged acts: the focused item's, then the innermost screen that has each button. */
    fun current(): PadActs {
        val s = live()
        val f = focused?.takeIf { screens.none { (o, a) -> a.opaque && o !in focusLayers } }
        fun <T> pick(get: (PadActs) -> T?): T? = f?.let(get) ?: s.firstNotNullOfOrNull(get)
        val tabsFrom = f?.takeIf { it.tabs != null } ?: s.firstOrNull { it.tabs != null && !it.nav } ?: s.firstOrNull { it.tabs != null }
        val pageFrom = f?.takeIf { it.page != null } ?: s.firstOrNull { it.page != null }
        val yFrom = f?.takeIf { it.y != null || it.yHold != null } ?: s.firstOrNull { it.y != null || it.yHold != null }
        return PadActs(
            a = f?.a ?: if (anyFocus) "Select" else null,
            y = yFrom?.y ?: yFrom?.yHold?.let { PadAct("Tilt") }, yHold = yFrom?.yHold,
            x = pick { it.x }, b = pick { it.b },
            tabs = tabsFrom?.tabs, tabsLabel = tabsFrom?.tabsLabel ?: "Tabs",
            page = pageFrom?.page, pageLabel = pageFrom?.pageLabel ?: "Page",
            start = pick { it.start }, menu = f?.menu, lift = s.firstOrNull()?.lift ?: 0.dp,
            // Root only while nothing but the root screen and the app's tabs is up (a sheet over Home still shows its B).
            root = s.any { it.root } && s.all { it.root || it.nav },
        )
    }

    /** At most four, in the same order every time: A, Y, X, then B, the shoulders, Select. Never the same words twice on any two
     *  buttons (Randall 9 Nov: no redundant prompts; 10 Nov: "2 buttons that say next"), so a Y that does what A does ("Inspect")
     *  or a B that does what X does ("Claim") is left off. The button still works; only its repeated words go. */
    fun prompts(acts: PadActs = current()): List<Pair<String, String>> {
        val out = ArrayList<Pair<String, String>>()
        acts.a?.let { out += "A" to it }
        acts.y?.let { y -> if (out.none { it.second.equals(y.label, true) }) out += "Y" to y.label }
        acts.x?.let { x -> if (out.none { it.second.equals(x.label, true) }) out += "X" to x.label }
        val tail = buildList {
            acts.b?.let { add("B" to it) }
            acts.tabs?.let { add("LB RB" to acts.tabsLabel) }
            acts.page?.let { add("LT RT" to acts.pageLabel) }
            acts.menu?.let { add("Select" to it.label) }
            acts.start?.let { add("Start" to it.label) }
            if (acts.b == null && !acts.root) add("B" to "Back")
        }
        for (t in tail) { if (out.size >= 4) break; if (out.none { it.second.equals(t.second, true) }) out += t }
        return out
    }

    private val main = Handler(Looper.getMainLooper())
    private var yDown = false
    private var yHeld = false
    private var yHoldFn: ((Boolean) -> Unit)? = null
    private var yTap: (() -> Unit)? = null
    private val holdStart = Runnable { if (yDown) { yHeld = true; yHoldFn?.invoke(true) } }

    /**
     * The pad's X, Y, shoulders, triggers and Start (A and B stay in MainActivity: A is d-pad centre, B is back).
     * Returns true when the key is the pad's, used or not, so the system never turns it into something else.
     */
    fun key(event: KeyEvent, dpad: (Int) -> Unit): Boolean {
        // Only a pad's buttons: a phone's Menu key, a keyboard or a TV remote keep doing what they always did.
        if (!event.isFromSource(android.view.InputDevice.SOURCE_GAMEPAD) && !event.isFromSource(android.view.InputDevice.SOURCE_JOYSTICK)) return false
        val code = event.keyCode
        val ours = code == KeyEvent.KEYCODE_BUTTON_X || code == KeyEvent.KEYCODE_BUTTON_Y || code == KeyEvent.KEYCODE_BUTTON_L1 ||
            code == KeyEvent.KEYCODE_BUTTON_R1 || code == KeyEvent.KEYCODE_BUTTON_L2 || code == KeyEvent.KEYCODE_BUTTON_R2 ||
            code == KeyEvent.KEYCODE_BUTTON_START || code == KeyEvent.KEYCODE_MENU || code == KeyEvent.KEYCODE_BUTTON_SELECT
        if (!ours) return false
        val down = event.action == KeyEvent.ACTION_DOWN
        if (down) lastPress = SystemClock.uptimeMillis()
        // The shoulders and triggers move the ring (zones, hand/field): the stick cursor steps aside, as it does for the d-pad (U8).
        if (down && (code == KeyEvent.KEYCODE_BUTTON_L1 || code == KeyEvent.KEYCODE_BUTTON_R1 || code == KeyEvent.KEYCODE_BUTTON_L2 || code == KeyEvent.KEYCODE_BUTTON_R2)) PadCursor.dpad()
        val acts = current()
        if (code == KeyEvent.KEYCODE_BUTTON_Y) {
            if (down && event.repeatCount == 0) {
                if (yHeld) yHoldFn?.invoke(false)
                main.removeCallbacks(holdStart)
                yDown = true; yHeld = false; yHoldFn = acts.yHold; yTap = acts.y?.run
                android.util.Log.i("PadA", "Y: ${acts.y?.label} hold=${acts.yHold != null} focused=${focused != null}")
                if (acts.yHold != null) main.postDelayed(holdStart, 320) else acts.y?.run?.invoke()
            } else if (!down) {
                main.removeCallbacks(holdStart)
                if (yHeld) yHoldFn?.invoke(false) else if (yHoldFn != null && !event.isCanceled) yTap?.invoke()
                yDown = false; yHeld = false; yHoldFn = null; yTap = null
            }
            return true
        }
        if (!down) return true
        when (code) {
            KeyEvent.KEYCODE_BUTTON_X -> if (event.repeatCount == 0) acts.x?.run?.invoke()
            KeyEvent.KEYCODE_BUTTON_L1 -> if (event.repeatCount == 0) acts.tabs?.invoke(-1)
            KeyEvent.KEYCODE_BUTTON_R1 -> if (event.repeatCount == 0) acts.tabs?.invoke(1)
            // No page of its own: a page is six steps of the d-pad, which every list and grid already follows.
            KeyEvent.KEYCODE_BUTTON_L2 -> acts.page?.invoke(-1) ?: repeat(6) { dpad(KeyEvent.KEYCODE_DPAD_UP) }
            KeyEvent.KEYCODE_BUTTON_R2 -> acts.page?.invoke(1) ?: repeat(6) { dpad(KeyEvent.KEYCODE_DPAD_DOWN) }
            KeyEvent.KEYCODE_BUTTON_START, KeyEvent.KEYCODE_MENU -> if (event.repeatCount == 0) acts.start?.run?.invoke()
            // Select (Randall 9 Nov): the quick menu a long press opens, on whatever the ring is on, everywhere.
            KeyEvent.KEYCODE_BUTTON_SELECT -> if (event.repeatCount == 0) acts.menu?.run?.invoke() ?: PadCursor.holdFocused()
        }
        return true
    }
}

/**
 * What A, Y and X do while the gold ring is on this item. Put it just before the item's clickable (or focusable),
 * so it hears that one's focus: `Modifier.padActs(PadActs(a = "Open", y = PadAct("Peek") { … })).clickable { … }`.
 */
fun Modifier.padActs(acts: PadActs): Modifier = this then PadActsElement(acts)

private class PadActsElement(val acts: PadActs) : ModifierNodeElement<PadActsNode>() {
    override fun create() = PadActsNode(acts)
    override fun update(node: PadActsNode) { node.acts = acts; if (node.on) PadPrompts.focus(node, acts) }
    override fun equals(other: Any?) = other is PadActsElement && other.acts === acts
    override fun hashCode() = System.identityHashCode(acts)
    override fun InspectorInfo.inspectableProperties() { name = "padActs" }
}

private class PadActsNode(var acts: PadActs) : Modifier.Node(), FocusEventModifierNode {
    var on = false
    override fun onFocusEvent(focusState: FocusState) {
        on = focusState.isFocused
        if (on) PadPrompts.focus(this, acts) else PadPrompts.blur(this)
    }
    override fun onDetach() { on = false; PadPrompts.blur(this) }
}

/** A screen's or sheet's buttons (X main action, LB/RB tabs, LT/RT page, Start menu, B's words) while it is shown. */
@Composable
fun PadScreen(acts: PadActs) {
    val owner = remember { Any() }
    val latest by rememberUpdatedState(acts)
    DisposableEffect(owner) {
        PadPrompts.screens.add(owner to latest)
        onDispose { PadPrompts.screens.removeAll { it.first === owner } }
    }
    // Keep the entry fresh (labels change: "To combat", "Pass", "End turn"), without moving it in the stack.
    LaunchedEffect(acts) { val i = PadPrompts.screens.indexOfFirst { it.first === owner }; if (i >= 0) PadPrompts.screens[i] = owner to acts }
}

/** On the app's root: does anything have the controller's focus? It also keeps the focus manager for [PadPrompts.enter]. */
@Composable
fun Modifier.padRoot(): Modifier {
    val fm = androidx.compose.ui.platform.LocalFocusManager.current
    val modes = androidx.compose.ui.platform.LocalInputModeManager.current
    DisposableEffect(fm) { PadPrompts.focusManager = fm; PadPrompts.inputModes = modes; onDispose { if (PadPrompts.focusManager === fm) PadPrompts.focusManager = null } }
    return onFocusChanged { PadPrompts.anyFocus = it.hasFocus }
}

/**
 * The prompt bar: a small glass pill, bottom right, with only the buttons that do something on whatever the gold ring is on.
 * Shown only while a controller is here (a handheld's own pad or one connected); a phone with nothing connected never sees it.
 * A tap doesn't hide it; it rests at half strength a few seconds after the last button press and comes back on the next.
 */
@Composable
fun BoxScope.PadPromptBar() {
    val pad by Pad.connected.collectAsState()
    // Nothing at all on a phone; and hidden while a dialog window has the keys (they never reach the app's window).
    val on = pad && PadPrompts.windowFocused
    // With the bottom screen up the bar sits at its foot instead (DualScreen.BottomRoot).
    if (!pad || DualScreen.active) return
    val acts = PadPrompts.current()
    // A button on the page already prints its key and words (the table's gold X): the bar does not say them again.
    val said = DualScreen.shownLabels.values.flatten().toSet()
    val items = PadPrompts.prompts(acts).filter { it.second.lowercase() !in said }
    var idle by remember { mutableStateOf(false) }
    val pressed = PadPrompts.lastPress
    LaunchedEffect(pressed) { idle = false; delay(4000); idle = true }
    val k by animateFloatAsState(if (idle) .5f else 1f, tween(if (idle) 600 else 150), label = "padbar")
    val lift by animateDpAsState(acts.lift, label = "padlift")
    AnimatedVisibility(on && items.isNotEmpty(), Modifier.align(Alignment.BottomEnd).windowInsetsPadding(WindowInsets.navigationBars).padding(end = 16.dp, bottom = 16.dp + lift),
        enter = fadeIn(), exit = fadeOut()) {
        val shape = RoundedCornerShape(999.dp)
        // The pill's ground stays solid at rest (fix list C2, E4): only its words dim, so the page never reads through it.
        Row(Modifier.clip(shape).background(Color(0xFF101217)).border(1.dp, Color(0x40D6AD64), shape).padding(horizontal = 12.dp, vertical = 7.dp)
            .semantics { contentDescription = "Controller: " + items.joinToString(", ") { "${it.first} ${it.second}" } },
            horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            items.forEach { (b, l) -> Box(Modifier.alpha(k)) { PadKey(b, l) } }
        }
    }
}

/** How much a scrolling page leaves free at its foot so its last rows can clear the prompt pill (fix list C2, E4): 56 with a pad on one screen, else 0. */
@Composable
fun padBarSpace(): androidx.compose.ui.unit.Dp { val pad by Pad.connected.collectAsState(); return if (pad && !DualScreen.active) 56.dp else 0.dp }

internal val KeyA = Color(0xFF5FBF6A); internal val KeyB = Color(0xFFE0645A); internal val KeyX = Color(0xFF5B8DE0); internal val KeyY = Color(0xFFE6C04A)

@Composable
internal fun PadKey(button: String, label: String) = Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
    val round = button.length == 1
    val c = when (button) { "A" -> KeyA; "B" -> KeyB; "X" -> KeyX; "Y" -> KeyY; else -> Color(0xFFECE6D8) }
    val shape = if (round) CircleShape else RoundedCornerShape(5.dp)
    Box((if (round) Modifier.size(20.dp) else Modifier.height(20.dp).widthIn(min = 20.dp)).clip(shape).border(1.5.dp, if (round) c else Color(0xFF3A3D4C), shape)
        .padding(horizontal = if (round) 0.dp else 5.dp), contentAlignment = Alignment.Center) {
        androidx.compose.material3.Text(button, style = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = if (round) 11.sp else 10.sp, color = c))
    }
    androidx.compose.material3.Text(label, style = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color(0xFFE6E1D6)), maxLines = 1, softWrap = false)
}

/**
 * A sheet, zoom or overlay that owns the pad while it is up: with a controller here the ring moves into it when it opens
 * and cannot wander onto the page underneath. On a phone this does nothing.
 */
@Composable
fun Modifier.padLayer(): Modifier {
    val pad by Pad.connected.collectAsState()
    if (!pad) return this.padCover()
    val req = remember { androidx.compose.ui.focus.FocusRequester() }
    LaunchedEffect(Unit) { androidx.compose.runtime.withFrameNanos { }; runCatching { req.requestFocus() } }
    return this.padCover().focusRequester(req).focusProperties { onExit = { cancelFocusChange() } }.focusGroup()
}
