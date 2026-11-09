package dev.cardstashy.nativeplay.ui

import android.app.Activity
import android.app.Presentation
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
            }
            setContentView(view)
        }
    }
}

/** What the bottom screen shows about a card: its name and art, and what is known of it (type, rules text, copies owned). */
/** [price]: Collection only (Play stays price-free). [actions]: the card's own buttons on the bottom screen (touch), e.g. Got one / Wishlist. */
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
                if (view != null) view() else FocusedCardView(DualScreen.focus)
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
                BrandMark(56.dp)
                Text("Move the ring onto a card to see it here.", style = TextStyle(fontFamily = Site.Manrope, fontSize = 13.sp, color = Site.Muted))
            }
        }
        return
    }
    Row(Modifier.fillMaxSize().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        val img = heroPainter(card.image?.let(homeArt))
        Box(Modifier.fillMaxHeight().aspectRatio(63f / 88f, matchHeightConstraintsFirst = true).shadow(14.dp, RoundedCornerShape(10.dp)).clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF1C1E25))) {
            if (img != null) Image(img, card.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(card.name, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Site.Text), maxLines = 3, overflow = TextOverflow.Ellipsis)
            card.type?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Site.Gold)) }
            card.text?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Site.Manrope, fontSize = 14.sp, lineHeight = 20.sp, color = Color(0xFFE4E7EA))) }
            card.owned?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Site.Muted)) }
            card.price?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Site.Gold)) }
            extra?.invoke()
            card.actions.forEach { a -> a.run?.let { run ->
                val shape = RoundedCornerShape(14.dp)
                Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(shape).background(Color(0x14FFFFFF)).border(1.dp, Color(0x40D6AD64), shape).clickable(onClick = run),
                    contentAlignment = Alignment.Center) { Text(a.label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Site.Text)) }
            } }
        }
    }
}

/** The controller's prompt bar, at the bottom screen's foot while it is up (the top screen's is hidden then). */
@Composable
private fun BottomPadBar() {
    val pad by Pad.connected.collectAsState()
    if (!pad) return
    val items = PadPrompts.prompts(PadPrompts.current())
    if (items.isEmpty()) return
    Row(Modifier.fillMaxWidth().height(44.dp).background(Color(0xF2101217)).border(1.dp, Color(0x30D6AD64)).padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
        items.forEach { (b, l) -> PadKey(b, l) }
    }
}

/** The ring, the stick cursor or a finger landing on this card makes it the card both screens know about ([DualScreen.focus]). */
fun Modifier.dualFocus(card: FocusCard): Modifier = if (!DualScreen.active) this else this
    .onFocusChanged { if (it.isFocused) DualScreen.focus = card }
    .pointerInput(card) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial); DualScreen.focus = card } }
