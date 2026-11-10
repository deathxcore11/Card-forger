package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState

/** What the auto-pass decides on: Forge's own state, never the board the table is replaying. */
object AutoPass {
    /**
     * Thor 0.4.56 (finding B): your own saga trigger resolved, and Main 1 was passed straight to combat. The poll's replay shows
     * Forge's revision with the already-resolved trigger held on top of the stack (yours), so a decision on that board read "your
     * own spell on top" and passed priority in Main 1 with Forge's stack empty. The decision is made on Forge's state [forge]
     * (same revision as [shown]); while the board's stack is not Forge's (a held or hidden item, a replay still running) nothing
     * is decided, and the final show of Forge's own state schedules again (the site's !playback.running).
     */
    fun basis(shown: MatchState, forge: MatchState?): MatchState? {
        if (forge == null || forge.revision != shown.revision) return null
        if (shown.stack.map { it.id } != forge.stack.map { it.id }) return null
        return forge
    }
}
