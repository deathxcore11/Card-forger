package dev.cardstashy.nativeplay

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * The step 1 pass bar, measured on the phone: sign-in to deck list, and deck pick to a ready
 * table for a deck played before (under 3 s) and a brand-new one (under 6 s on 5G). The last of
 * each is kept and shown on the Quick Play screen.
 */
object Speed {
    const val SIGN_IN = "Sign-in to decks"
    const val KNOWN = "Known deck to table"
    const val NEW = "New deck to table"
    const val REMATCH = "Rematch to table"
    private val BAR = mapOf(KNOWN to 3000L, NEW to 6000L)

    private lateinit var prefs: SharedPreferences
    private val _last = MutableStateFlow<Map<String, Long>>(emptyMap()); val last: StateFlow<Map<String, Long>> = _last

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.applicationContext.getSharedPreferences("speed", Context.MODE_PRIVATE)
        _last.value = listOf(SIGN_IN, KNOWN, NEW).mapNotNull { k -> prefs.getLong(k, -1).takeIf { it >= 0 }?.let { k to it } }.toMap()
    }

    fun record(key: String, ms: Long) {
        Log.i("Speed", "$key: $ms ms" + (BAR[key]?.let { if (ms <= it) " (pass)" else " (over ${it} ms bar)" } ?: ""))
        if (::prefs.isInitialized) prefs.edit().putLong(key, ms).apply()
        _last.value = _last.value + (key to ms)
    }

    fun line(): String = listOf(SIGN_IN, KNOWN, NEW).mapNotNull { k -> _last.value[k]?.let { "$k ${"%.1f".format(it / 1000.0)} s" } }.joinToString(" · ")
}
