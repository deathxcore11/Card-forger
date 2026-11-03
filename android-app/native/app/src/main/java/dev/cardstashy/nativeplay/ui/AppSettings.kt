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

    fun init(context: Context) {
        val p = context.applicationContext.getSharedPreferences("play", Context.MODE_PRIVATE); prefs = p
        glass = p.getBoolean("glass", true); finish = p.getBoolean("finishEffects", true); tilt = p.getBoolean("motionTilt", true)
        haptics = p.getBoolean("haptics", true); sound = p.getBoolean("packSound", true); appSounds = p.getBoolean("appSounds", true)
    }

    fun set(key: String, on: Boolean) {
        when (key) {
            "glass" -> glass = on; "finishEffects" -> finish = on; "haptics" -> haptics = on; "appSounds" -> appSounds = on
            "motionTilt" -> { tilt = on; PackSfx.tilt = on }
            "packSound" -> { sound = on; PackSfx.on = on }
        }
        prefs?.edit()?.putBoolean(key, on)?.apply()
    }
}
