package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * The web's "Glass, motion & feel" switches (views.js settings app pane): per device, never synced (ST-06),
 * all on by default (ST-03), and each acts live with no restart (ST-04).
 */
object AppSettings {
    private var prefs: android.content.SharedPreferences? = null
    var glass by mutableStateOf(true); private set
    var finish by mutableStateOf(true); private set
    var tilt by mutableStateOf(true); private set
    var haptics by mutableStateOf(true); private set
    var sound by mutableStateOf(true); private set
    var appSounds by mutableStateOf(true); private set
    /** play-presence.js presenceShared(): "Show friends what I’m playing". */
    var presence by mutableStateOf(true); private set
    /** settings-theme.js normalizeTheme / THEME_KEY 'cardstashy-theme': light, dark or aura; dark by default. Per device, never synced. */
    var theme by mutableStateOf("dark"); private set
    /** grid-settings.js GRID_KEY 'cardstashy-grid-size' (small, medium, large; medium by default) and PINCH_KEY 'cardstashy-grid-pinch' (off by default). */
    var gridSize by mutableStateOf("medium"); private set
    var gridPinch by mutableStateOf(false); private set
    val GRID_SIZES = listOf("small", "medium", "large")

    fun init(context: Context) {
        val p = context.applicationContext.getSharedPreferences("play", Context.MODE_PRIVATE); prefs = p
        glass = p.getBoolean("glass", true); finish = p.getBoolean("finishEffects", true); tilt = p.getBoolean("motionTilt", true)
        haptics = p.getBoolean("haptics", true); sound = p.getBoolean("packSound", true); appSounds = p.getBoolean("appSounds", true); presence = p.getBoolean("presence", true)
        theme = normalizeTheme(p.getString("cardstashy-theme", null)); gridSize = normalizeGridSize(p.getString("cardstashy-grid-size", null))
        gridPinch = p.getString("cardstashy-grid-pinch", null) == "on"
    }

    fun set(key: String, on: Boolean) {
        when (key) {
            "glass" -> glass = on; "finishEffects" -> finish = on; "haptics" -> haptics = on; "appSounds" -> appSounds = on; "presence" -> presence = on
            "motionTilt" -> { tilt = on; PackSfx.tilt = on }
            "packSound" -> { sound = on; PackSfx.on = on }
        }
        prefs?.edit()?.putBoolean(key, on)?.apply()
    }

    fun normalizeTheme(v: String?) = if (v in listOf("light", "dark", "aura")) v!! else "dark"
    fun normalizeGridSize(v: String?) = if (v in GRID_SIZES) v!! else "medium"

    /** applyTheme(): saved on this device only. */
    fun applyTheme(v: String) { theme = normalizeTheme(v); prefs?.edit()?.putString("cardstashy-theme", theme)?.apply() }
    /** applyGridSize() / applyGridPinch(). */
    fun applyGridSize(v: String) { gridSize = normalizeGridSize(v); prefs?.edit()?.putString("cardstashy-grid-size", gridSize)?.apply() }
    fun applyGridPinch(on: Boolean) { gridPinch = on; prefs?.edit()?.putString("cardstashy-grid-pinch", if (on) "on" else "off")?.apply() }

    /** pinchGridSize(): spread past 1.22 goes a size up, pinch under .82 a size down. */
    fun pinchGridSize(size: String, ratio: Float): String {
        val i = GRID_SIZES.indexOf(normalizeGridSize(size))
        return GRID_SIZES[(i + if (ratio >= 1.22f) 1 else if (ratio <= .82f) -1 else 0).coerceIn(0, 2)]
    }
}
