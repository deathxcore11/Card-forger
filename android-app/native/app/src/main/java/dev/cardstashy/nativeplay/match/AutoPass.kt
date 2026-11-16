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
    /**
     * Mobile table M4 (Arena orders simultaneous triggers itself): Forge's "order your triggers" question answered for you, in
     * the order Forge listed them. It is the same answer as the box's Auto order button. Null when the player asked to be
     * asked ([ask]), when it is another kind of order (cards for the top of a deck), or when Forge's own limits can't be met.
     */
    fun triggerOrder(st: MatchState, ask: Boolean): List<Int>? {
        val p = st.prompt ?: return null
        if (ask || p.method != "order" || !p.supportedExact || !p.ordered) return null
        if (!(p.rawMessage + "\n" + p.message).contains("simultaneous abilities", ignoreCase = true)) return null
        val picked = ArrayList<Int>()
        for (o in p.options) if (o.described && picked.size < p.max) picked += o.index
        return picked.takeIf { it.isNotEmpty() && it.size >= p.min }
    }

    /**
     * Mobile table M11 (Arena aims a spell with one legal target by itself): the one target Forge offers, when it offers exactly
     * one, asks for exactly one, and the choice is not optional. Nothing is worked out here: the set is Forge's.
     */
    fun onlyTarget(st: MatchState): dev.cardstashy.nativeplay.engine.Ref? {
        if (st.prompt != null || st.inputType != "InputSelectTargets") return null
        val sel = st.selection
        if (sel.min != 1 || sel.max != 1 || sel.chosenCards.isNotEmpty() || sel.chosenPlayers.isNotEmpty()) return null
        if (sel.stackTargets.isNotEmpty()) return null
        val cards = sel.cards + sel.targetCards; val players = sel.players
        return when {
            cards.size == 1 && players.isEmpty() -> dev.cardstashy.nativeplay.engine.Ref("card", cards.first(), null)
            cards.isEmpty() && players.size == 1 -> dev.cardstashy.nativeplay.engine.Ref("player", players.first(), null)
            else -> null
        }
    }

    /**
     * Mobile table M3: your own spell or trigger is on top of the stack and the table will pass for you (the same conditions
     * as the pass itself: not Full Control, no phase stop of yours here, and "Stop to respond" off). The gold button then
     * offers no Resolve press.
     */
    fun resolvesItself(st: MatchState, stopToRespond: Boolean): Boolean {
        if (stopToRespond || st.prompt != null || st.inputType != "InputPassPriority" || st.priorityPlayer != st.viewer) return false
        if (st.stack.firstOrNull()?.controller != st.viewer || st.controlMode == "full") return false
        return st.phaseStops?.containsKey("${if (st.activePlayer == st.viewer) "you" else "opponent"}:${st.phase}") != true
    }

    fun basis(shown: MatchState, forge: MatchState?): MatchState? {
        if (forge == null || forge.revision != shown.revision) return null
        if (shown.stack.map { it.id } != forge.stack.map { it.id }) return null
        return forge
    }
}
