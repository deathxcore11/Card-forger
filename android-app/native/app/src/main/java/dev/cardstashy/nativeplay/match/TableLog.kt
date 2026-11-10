package dev.cardstashy.nativeplay.match

import android.util.Log
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * One logcat line (tag TableStep) per board read, board shown, director plan and step, so a table that stops can be read
 * from `adb logcat -s TableStep` alone. Only in test builds (a "-testN" version name); release builds stay quiet.
 */
object TableLog {
    const val TAG = "TableStep"
    @Volatile var on = false

    fun line(text: String) { if (on) Log.i(TAG, text) }

    fun board(what: String, st: MatchState, latest: Long?) {
        if (!on) return
        val p = st.prompt
        line("$what rev=${st.revision} latest=$latest turn=${st.turn} phase=${st.phase} active=${st.activePlayer} priority=${st.priorityPlayer} busy=${st.busy} " +
            "status=${st.status} input=${st.inputType} prompt=${p?.let { "${it.id} ${it.method} \"${it.message.take(60)}\" n=${it.options.size}" }} waitingOnMe=${st.waitingOnMe} " +
            st.players.joinToString(" ") { pl -> "seat${pl.id}[hand=${pl.handCount} field=${pl.battlefield.size} life=${pl.life}]" } + " stack=${st.stack.size}")
    }
}
