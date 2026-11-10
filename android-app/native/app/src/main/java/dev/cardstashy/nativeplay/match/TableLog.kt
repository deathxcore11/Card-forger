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

    /**
     * Every field of a decision as the app read it, once per prompt or input (a scry arrives as a plain InputConfirm with "Top" / "Bottom"
     * buttons and no prompt, so the buttons and input type go in too). A device run turns these lines into the test snapshots, e.g. table/snap-dock-scry1.json.
     */
    fun decision(st: MatchState) {
        if (!on) return
        val p = st.prompt
        if (p == null && st.inputType == null) return
        val b = st.buttons
        line("decision rev=${st.revision} input=${st.inputType} buttons=ok:${b.ok}/${b.okEnabled} cancel:${b.cancel}/${b.cancelEnabled} " +
            (p?.let { "prompt id=${it.id} method=${it.method} message=\"${it.rawMessage.take(200)}\" min=${it.min} max=${it.max} ordered=${it.ordered} topLabel=${it.topLabel} " +
                "destinationIndexes=${it.destinationIndexes} sourceIndexes=${it.sourceIndexes} remaining=${it.remainingMin}..${it.remainingMax} supported=${it.supportedExact} cancelable=${it.cancelable} ack=${it.acknowledgeOnly} " +
                "options=" + it.options.joinToString(";", "[", "]") { o -> "${o.index}:${o.label.take(40)}|kind=${o.kind}|zone=${o.zone}|card=${o.cardId}" } } ?: "prompt=null"))
    }

    /**
     * The whole snapshot a decision came in, in logcat-sized pieces ("raw rev=N k/n ..."), for decisions the table cannot read yet:
     * a scry arrives as a plain InputConfirm ("Top" / "Bottom") and only the raw board can say whether the scried card is in it.
     */
    fun raw(st: MatchState, body: String?) {
        if (!on || body == null) return
        val input = st.inputType ?: return
        if (st.prompt == null && !input.startsWith("InputConfirm")) return
        if (input == "InputConfirmMulligan") return
        val parts = body.chunked(3500)
        parts.forEachIndexed { i, part -> line("raw rev=${st.revision} ${i + 1}/${parts.size} $part") }
    }
}
