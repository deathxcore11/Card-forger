package dev.cardstashy.nativeplay.match

import android.os.SystemClock
import kotlinx.coroutines.delay

/**
 * Staged combat on the board (Battlefield: one attacker at a time, about 1.4 s each) holds the table's pace: the pacing loop
 * shows the next board only once the last pair has played out, a touch skips it, and it never holds longer than 8 s.
 */
object CombatPace {
    @Volatile private var until = 0L
    fun hold(ms: Long) { until = SystemClock.uptimeMillis() + ms.coerceAtMost(8000) }
    fun release() { until = 0L }
    suspend fun await() { while (SystemClock.uptimeMillis() < until) delay(50) }
}
