package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState

/**
 * The turn clock (Randall, 4 Nov: every mode shows an animated countdown and an AFK turn skips itself). It runs only while Forge waits on you
 * and starts again for each new decision. Time out and the safest answer goes in: keep the hand, pass priority, declare no attackers or blockers,
 * back out of targets and payment, skip a choice. Three timeouts in a row in a friend match concede it; against the CPU nothing is conceded.
 * The numbers are the first proposal and are shared with the site's table.
 */
object TurnClock {
    const val DECISION_MS = 30_000L
    const val OWN_PRIORITY_MS = 90_000L
    const val KEEP_MS = 45_000L
    const val WARN_MS = 10_000L
    const val CONCEDE_AFTER = 3

    enum class Answer { OK, CANCEL, SKIP, EMPTY, NONE }

    /** How long this decision may take. */
    fun budgetMs(st: MatchState): Long = when {
        st.isMulligan -> KEEP_MS
        st.prompt == null && st.inputType == "InputPassPriority" && st.activePlayer == st.viewer -> OWN_PRIORITY_MS
        else -> DECISION_MS
    }

    /** What goes in when the time is up. */
    fun answer(st: MatchState): Answer {
        val p = st.prompt
        if (p != null) return if (p.maySkip) Answer.SKIP else if (p.min == 0) Answer.EMPTY else Answer.NONE
        if (st.isMulligan) return Answer.OK
        return when (st.inputType) {
            "InputPassPriority", "InputAttack", "InputBlock" -> if (st.buttons.okEnabled) Answer.OK else Answer.NONE
            else -> if (st.buttons.cancelEnabled) Answer.CANCEL else if (st.buttons.okEnabled) Answer.OK else Answer.NONE
        }
    }
}
