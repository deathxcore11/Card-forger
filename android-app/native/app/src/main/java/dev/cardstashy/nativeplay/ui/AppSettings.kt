package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.ui.unit.dp

/**
 * The web's "Glass, motion & feel" switches (views.js settings app pane): per device, never synced (ST-06),
 * all on by default (ST-03), and each acts live with no restart (ST-04).
 */
object AppSettings {
    private var prefs: android.content.SharedPreferences? = null
    var glass by mutableStateOf(true); private set
    var finish by mutableStateOf(true); private set
    var tilt by mutableStateOf(true); private set
    /** App-only 3D cards (rigid depth layers, foil/DepthLayer.kt). Off draws every card exactly as the foil-only renderer did. */
    var depth by mutableStateOf(true); private set
    var haptics by mutableStateOf(true); private set
    var sound by mutableStateOf(true); private set
    var appSounds by mutableStateOf(true); private set
    /** play-presence.js presenceShared(): "Show friends what I’m playing". */
    var presence by mutableStateOf(true); private set
    /** settings-theme.js normalizeTheme / THEME_KEY 'cardstashy-theme': light, dark or aura; dark by default. Per device, never synced. */
    var chosenTheme by mutableStateOf("dark"); private set
    /** Which side is on screen. Play is always dark (Randall 10 Nov 13:26Z): a Light setting only lights Collection and the shell. */
    /** Set once by the app: reads the screen on show, so the theme follows it with nothing written while composing. */
    var playSide: () -> Boolean = { false }
    /** The theme every screen, sheet, toast and the bottom screen draws in: the chosen one, except Light in Play, which is dark. */
    val theme: String get() = if (chosenTheme == "light" && playSide()) "dark" else chosenTheme
    /** grid-settings.js GRID_KEY 'cardstashy-grid-size' (small, medium, large; medium by default) and PINCH_KEY 'cardstashy-grid-pinch' (off by default). */
    var gridSize by mutableStateOf("medium"); private set
    var gridPinch by mutableStateOf(false); private set
    val GRID_SIZES = listOf("small", "medium", "large")
    /** Table effects (Story playmat MOTION-SPEC): cinematic, balanced (default) or minimal. Reduce motion and battery saver act as minimal. */
    var effects by mutableStateOf("balanced"); private set
    val EFFECTS = listOf("cinematic", "balanced", "minimal")
    /** Mobile table M4: "Ask me to order triggers". Off: triggers that happen together are ordered for you, as Arena does. */
    var askTriggerOrder by mutableStateOf(false); private set
    /** Mobile table M3: "Stop to respond". Off: your own spell or trigger on top of the stack resolves by itself. */
    var stopToRespond by mutableStateOf(false); private set

    fun init(context: Context) {
        val p = context.applicationContext.getSharedPreferences("play", Context.MODE_PRIVATE); prefs = p
        glass = p.getBoolean("glass", true); finish = p.getBoolean("finishEffects", true); tilt = p.getBoolean("motionTilt", true); depth = p.getBoolean("depthCards", true)
        haptics = p.getBoolean("haptics", true); sound = p.getBoolean("packSound", true); appSounds = p.getBoolean("appSounds", true); presence = p.getBoolean("presence", true)
        chosenTheme = normalizeTheme(p.getString("cardstashy-theme", null)); gridSize = normalizeGridSize(p.getString("cardstashy-grid-size", null))
        gridPinch = p.getString("cardstashy-grid-pinch", null) == "on"
        effects = p.getString("cardstashy-effects", null).takeIf { it in EFFECTS } ?: "balanced"
        askTriggerOrder = p.getBoolean("askTriggerOrder", false); stopToRespond = p.getBoolean("stopToRespond", false)
    }

    fun set(key: String, on: Boolean) {
        when (key) {
            "glass" -> glass = on; "finishEffects" -> finish = on; "haptics" -> haptics = on; "appSounds" -> appSounds = on; "presence" -> presence = on; "depthCards" -> depth = on
            "askTriggerOrder" -> askTriggerOrder = on; "stopToRespond" -> stopToRespond = on
            "motionTilt" -> { tilt = on; PackSfx.tilt = on }
            "packSound" -> { sound = on; PackSfx.on = on }
        }
        prefs?.edit()?.putBoolean(key, on)?.apply()
    }

    fun normalizeTheme(v: String?) = if (v in listOf("light", "dark", "aura")) v!! else "dark"
    fun normalizeGridSize(v: String?) = if (v in GRID_SIZES) v!! else "medium"

    /** applyTheme(): saved on this device only. */
    fun applyTheme(v: String) { chosenTheme = normalizeTheme(v); prefs?.edit()?.putString("cardstashy-theme", chosenTheme)?.apply() }
    /** applyGridSize() / applyGridPinch(). */
    fun applyGridSize(v: String) { gridSize = normalizeGridSize(v); prefs?.edit()?.putString("cardstashy-grid-size", gridSize)?.apply() }
    fun applyGridPinch(on: Boolean) { gridPinch = on; prefs?.edit()?.putString("cardstashy-grid-pinch", if (on) "on" else "off")?.apply() }

    fun applyEffects(v: String) { effects = if (v in EFFECTS) v else "balanced"; prefs?.edit()?.putString("cardstashy-effects", effects)?.apply() }

    /** pinchGridSize(): spread past 1.22 goes a size up, pinch under .82 a size down. */
    fun pinchGridSize(size: String, ratio: Float): String {
        val i = GRID_SIZES.indexOf(normalizeGridSize(size))
        return GRID_SIZES[(i + if (ratio >= 1.22f) 1 else if (ratio <= .82f) -1 else 0).coerceIn(0, 2)]
    }
}

/**
 * collection-display.css :root[data-grid-size]: card galleries follow Card size. Under 600 dp: 3 / 2 / 1 columns; wider:
 * columns at least 110 / 160 / 250 dp (Large is one column up to 700 dp).
 */
fun cardGridColumns(width: androidx.compose.ui.unit.Dp, gap: androidx.compose.ui.unit.Dp = 14.dp): Int = when {
    width < 600.dp -> when (AppSettings.gridSize) { "small" -> 3; "large" -> 1; else -> 2 }
    AppSettings.gridSize == "large" && width <= 700.dp -> 1
    else -> {
        val min = when (AppSettings.gridSize) { "small" -> 110.dp; "large" -> 250.dp; else -> 160.dp }
        maxOf(1, ((width + gap) / (min + gap)).toInt())
    }
}
fun cardGridCells(width: androidx.compose.ui.unit.Dp, gap: androidx.compose.ui.unit.Dp = 14.dp) =
    androidx.compose.foundation.lazy.grid.GridCells.Fixed(cardGridColumns(width, gap))

/**
 * grid-settings.js pinch (Pinch to resize card grids): two fingers spread past 1.22x go a size up, pinch under .82x a size
 * down, once per gesture, with a tick. One finger still scrolls; nothing is consumed unless two fingers are down.
 */
fun androidx.compose.ui.Modifier.gridPinch(): androidx.compose.ui.Modifier = if (!AppSettings.gridPinch) this else this.then(
    androidx.compose.ui.Modifier.pointerInput(Unit) {
        awaitEachGesture {
            var start = 0f; var done = false
            do {
                val e = awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial)
                val down = e.changes.filter { it.pressed }
                if (down.size >= 2) {
                    val d = (down[0].position - down[1].position).getDistance()
                    if (start == 0f) start = d
                    else if (!done && start > 0f) {
                        val next = AppSettings.pinchGridSize(AppSettings.gridSize, d / start)
                        if (next != AppSettings.gridSize) { AppSettings.applyGridSize(next); done = true }
                    }
                    down.forEach { it.consume() }
                } else start = 0f
            } while (e.changes.any { it.pressed })
        }
    })
