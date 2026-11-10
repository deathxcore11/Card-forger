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

    fun clear() = byName.clear()

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
    }
}
