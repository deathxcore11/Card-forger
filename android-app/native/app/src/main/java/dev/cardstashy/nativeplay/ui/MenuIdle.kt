package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first

/**
 * Gap audit G4: menus stop animating when nobody is using them. [idle] turns true after [AFTER_MS] with no touch, key or stick on a
 * menu screen and false on the next input; while it is true the menu loops ([menuLoop]) hold the frame they are on, so the screen
 * draws nothing. The table never goes idle ([onMenu] is false there). The refresh rate is not changed.
 */
object MenuIdle {
    const val AFTER_MS = 20_000L
    private val _idle = MutableStateFlow(false); val idle: StateFlow<Boolean> = _idle
    @Volatile private var lastInput = 0L
    /** False on a match screen: the table keeps its own motion. */
    @Volatile var onMenu = true; set(v) { field = v; if (!v) _idle.value = false }
    /** Any touch, key or stick (MainActivity's dispatch); [now] in uptime ms. */
    fun input(now: Long) { lastInput = now; if (_idle.value) _idle.value = false }
    /** The clock's check, about once a second; returns whether the menus are idle now. */
    fun tick(now: Long): Boolean { if (lastInput == 0L) lastInput = now; val v = idleAt(now, lastInput, onMenu); if (_idle.value != v) _idle.value = v; return v }
    internal fun idleAt(now: Long, last: Long, menu: Boolean) = menu && now - last >= AFTER_MS
    internal fun resetForTest() { lastInput = 0L; onMenu = true; _idle.value = false }
}

/**
 * A menu's endless 0..1 loop over [periodMs] (an infiniteRepeatable tween, with [reverse] for RepeatMode.Reverse) that holds its
 * frame while the menus are idle and goes on from the same frame on the next input.
 */
@Composable
fun menuLoop(periodMs: Int, easing: Easing = LinearEasing, reverse: Boolean = false): State<Float> {
    val v = remember { mutableFloatStateOf(easing.transform(0f)) }
    LaunchedEffect(periodMs, easing, reverse) {
        val clock = menuClock()
        while (true) { val ms = clock() / 1_000_000L
            val cycle = ms / periodMs; var f = (ms % periodMs).toFloat() / periodMs
            if (reverse && cycle % 2 == 1L) f = 1f - f
            v.floatValue = easing.transform(f) }
    }
    return v
}

/** A frame clock for a menu loop: each call waits for the next frame and returns the time it has run, in ns, idle time left out. */
internal fun menuClock(): suspend () -> Long {
    var acc = 0L; var last = -1L
    return {
        if (MenuIdle.idle.value) { MenuIdle.idle.first { !it }; last = -1L }
        // The infinite-animation frame: a test (InfiniteAnimationPolicy) can still go idle, as with rememberInfiniteTransition.
        androidx.compose.animation.core.withInfiniteAnimationFrameNanos { n -> if (last >= 0) acc += n - last; last = n }
        acc
    }
}
