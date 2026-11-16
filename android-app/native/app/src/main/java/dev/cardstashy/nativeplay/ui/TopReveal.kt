package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Lighter Collection home C3 (specs/collection-home-lighter-brief.md): "one reveal for the whole top of the page".
 * Each picture at the top of Home (the Card of the Day behind the page, the deck covers) says it is expected, then that it has
 * landed. Until the last one lands the pictures stay hidden and the tiles show as glass; then all of them show together.
 * Pictures already in memory land within [INSTANT_MS], and then nothing fades: the page is simply whole.
 * A picture that never lands does not hold the others: after [capMs] the top opens with what there is.
 * With nothing expected (bundled art, the picture tests) it is open from the start. Once open it stays open.
 */
internal class TopReveal(val capMs: Long = CAP_MS, private val clock: () -> Long = android.os.SystemClock::uptimeMillis) {
    private val waiting = mutableSetOf<String>()
    private var firstAt = -1L
    /** When the top opened, on [clock]; -1 while it has not. */
    var openedAt by mutableStateOf(-1L); private set
    /** Pictures are expected and not all in yet. */
    var closed by mutableStateOf(false); private set

    val open: Boolean get() = !closed
    /** Everything was there at once: show it without a fade. */
    val instant: Boolean get() = openedAt >= 0 && openedAt - firstAt <= INSTANT_MS

    fun expect(key: String) {
        if (openedAt >= 0) return
        if (firstAt < 0) firstAt = clock()
        waiting += key; closed = true
    }
    fun landed(key: String) { if (waiting.remove(key) && waiting.isEmpty()) opened() }
    /** The picture is no longer wanted (its tile changed or went away): it holds nothing up. */
    fun dropped(key: String) = landed(key)
    /** Call [capMs] after the page appeared. */
    fun giveUp() { if (closed) { waiting.clear(); opened() } }
    private fun opened() { if (openedAt < 0) { openedAt = clock(); closed = false } }

    companion object {
        /** As long as the opening screen and the calm update wait. */
        const val CAP_MS = 4_000L
        const val INSTANT_MS = 150L
        const val FADE_MS = 250
    }
}

/** The reveal of the page being drawn; null outside Collection home (each picture then shows as it always did). */
internal val LocalTopReveal = staticCompositionLocalOf<TopReveal?> { null }
