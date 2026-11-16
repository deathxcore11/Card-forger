package dev.cardstashy.nativeplay.ui

/**
 * Collection home, lighter C6, the measurement first (specs/collection-home-lighter-brief.md). The whole app is drawn into one
 * recorded layer so a toast can blur what is under it (MainActivity). The brief's guess is that an animation that never stops
 * (the home search bar's light) makes that record run every frame. Read in code it should not: the light is drawn inside the
 * pill's own shadow and clip layers. This counts how often the record really runs and writes one log line per [windowMs], so a
 * device log settles it before anything is changed. At rest the count should be near 0; near the screen's refresh rate times
 * the window means the whole page is being redrawn.
 */
object RootDraws {
    const val WINDOW_MS = 5_000L
    private var start = 0L
    private var count = 0
    /** Called each time the app layer is recorded. Returns the line to log when a window closes, or null. */
    internal fun tick(nowMs: Long, where: String, windowMs: Long = WINDOW_MS): String? {
        if (count == 0) start = nowMs
        count++
        if (nowMs - start < windowMs) return null
        val line = "app layer recorded $count times in ${"%.1f".format(java.util.Locale.US, (nowMs - start) / 1000.0)} s on $where"
        count = 0
        return line
    }
    /** What is on screen, for the log line (set by the router; "?" until then). */
    @Volatile var where = "?"
    fun tick() { tick(android.os.SystemClock.uptimeMillis(), where)?.let { android.util.Log.i("RootDraws", it) } }
    internal fun resetForTest() { count = 0; start = 0L }
}
