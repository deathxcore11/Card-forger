package dev.cardstashy.nativeplay.art

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import java.util.concurrent.ConcurrentHashMap

/**
 * The art contract's memory (overhaul plan, 10 Nov): every face-up card the engine has shown this match, by name, so a picture
 * that never loads still draws as a real card frame (name, cost, type, rules, P/T) and never as an empty panel; and the engine's
 * own printing of each card goes to the art lookup when the deck row named none.
 */
object TableFacts {
    private val byName = ConcurrentHashMap<String, Card>()
    fun of(name: String?): Card? = name?.let { byName[it.lowercase()] }

    fun clear() { byName.clear(); aheadTurn = -1 }

    /** Loading screens L5: the last turn the CPU's reach was decoded for. */
    @Volatile private var aheadTurn = -1
    /** L5: true once per turn that is not the viewer's, on its first snapshot. */
    internal fun cpuTurnStarts(turn: Int, active: Int?, viewer: Int?): Boolean {
        if (turn == aheadTurn || active == null || active == viewer) return false
        aheadTurn = turn; return true
    }

    /** Every new snapshot: remember its face-up cards (first sighting wins, a later one with more text replaces it). */
    fun note(st: MatchState) {
        fun add(c: Card?) {
            if (c == null || c.hidden || c.name.isBlank()) return
            val k = c.name.lowercase(); val had = byName[k]
            if (had == null || (had.text.isBlank() && c.text.isNotBlank())) {
                byName[k] = c
                if (had == null && !c.setCode.isNullOrBlank() && !c.collectorNumber.isNullOrBlank()) CardArt.enginePrinting(c.name, c.setCode, c.collectorNumber)
            }
        }
        st.players.forEach { p -> (p.hand + p.battlefield + p.graveyard + p.exile + p.command).forEach(::add) }
        st.stack.forEach { add(it.source) }
        // Tokens are made mid-match: ask for the picture on the snapshot that makes them (their arrival waits up to 400 ms for it).
        st.players.forEach { p -> p.battlefield.forEach { c -> if (c.token && !c.hidden && c.name.isNotBlank()) CardArt.made(c.name) } }
        // L5: the CPU's hand is hidden, so its cards were first asked for as they were cast. As each of its turns starts, what it
        // can pay for (its lands plus one) is decoded.
        if (cpuTurnStarts(st.turn, st.activePlayer, st.viewer)) CardArt.aheadForCpu(st.cpu.battlefield.count { it.isLand })
        // Look-ahead: what can reach the felt next (your hand, the command zone, the stack) has its crop decoded now.
        (st.me.hand + st.players.flatMap { it.command } + st.stack.mapNotNull { it.source }).forEach { c -> if (!c.hidden && c.name.isNotBlank()) CardArt.decodeAhead(c.name) }
    }
}
