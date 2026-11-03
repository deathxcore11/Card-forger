package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref

/** Which CPU actions get a beat, and in which tier. Pure, so it is checked against real engine matches on the JVM. */
object Pacing {
    sealed interface Step
    data class BannerStep(val banner: Banner) : Step
    data class BeatStep(val beat: Beat) : Step

    /** CPU actions from Forge's events, sorted into the three tiers. Your own actions need no replay. */
    fun beatsFor(st: MatchState, events: List<GameEvent>): List<Step> {
        val me = st.viewer
        val mine = (st.me.battlefield + st.me.hand + st.me.graveyard + st.me.exile).map { it.id }.toSet()
        fun touchesMe(refs: List<Ref>) = refs.any { (it.kind == "player" && it.id == me) || (it.kind == "card" && it.id in mine) }
        fun controllerOf(id: Int?) = id?.let { st.card(it)?.controller }
        val out = mutableListOf<Step>()
        var explainedLife = false
        for (e in events) {
            when (e.type) {
                "turn" -> if (e.turn > 1) out += BannerStep(Banner("Turn ${e.turn} · " + if (e.player == me) "Your turn" else "CPU's turn", e.player == me))
                "land" -> if (e.player != null && e.player != me) out += BeatStep(Beat(Beat.Kind.LAND, "CPU plays ${e.card?.name ?: "a land"}", e.card?.id, e.card?.name, null))
                "cast" -> if (e.player != null && e.player != me) {
                    val hits = touchesMe(e.targets)
                    val life = if (hits) lifeChange(st, events) else null
                    if (life != null) explainedLife = true
                    out += BeatStep(Beat(if (hits) Beat.Kind.AFFECTS_YOU else Beat.Kind.ACTION, "CPU casts ${e.source?.name ?: "a spell"}", e.source?.id, e.source?.name,
                        if (hits) targetText(st, e.targets) else null, life?.first, life?.second))
                }
                "trigger", "ability" -> if (controllerOf(e.source?.id)?.let { it != me } == true) {
                    val hits = touchesMe(e.targets)
                    val title = "${e.source?.name ?: "A CPU card"} " + if (e.type == "trigger") "triggers" else "is activated"
                    // The same trigger several times in a row (one per creature entering, say) is one beat.
                    val prev = (out.lastOrNull() as? BeatStep)?.beat
                    if (prev != null && !hits && prev.kind == Beat.Kind.ACTION && (prev.title == title || prev.title.startsWith("$title ×"))) {
                        val n = (prev.title.substringAfter(" ×", "1").toIntOrNull() ?: 1) + 1
                        out[out.lastIndex] = BeatStep(prev.copy(title = "$title ×$n"))
                    } else out += BeatStep(Beat(if (hits) Beat.Kind.AFFECTS_YOU else Beat.Kind.ACTION, title, e.source?.id, e.source?.name, if (hits) targetText(st, e.targets) else null))
                }
                "attack" -> if (e.player != null && e.player != me && e.attackers.isNotEmpty()) {
                    val names = e.attackers.map { it.first.name ?: "a creature" }
                    out += BeatStep(Beat(Beat.Kind.AFFECTS_YOU, "CPU attacks with " + names.joinToString(", "), e.attackers.first().first.id, e.attackers.first().first.name,
                        "${names.size} attacker" + if (names.size == 1) "" else "s"))
                }
                "block" -> if (e.player != null && e.player != me && e.blockers.isNotEmpty()) {
                    val first = e.blockers.first()
                    out += BeatStep(Beat(Beat.Kind.ACTION, "CPU blocks", first.first.id, first.first.name,
                        e.blockers.joinToString("\n") { (b, a) -> "${b.name ?: "A creature"} blocks ${a?.let { st.card(it)?.name } ?: "an attacker"}" }))
                }
            }
        }
        // Damage or drain to you that no cast above explains (combat, a trigger resolving): one red beat.
        if (!explainedLife) lifeChange(st, events)?.let { (from, to) ->
            out += BeatStep(Beat(Beat.Kind.AFFECTS_YOU, if (to < from) "You lose ${from - to} life" else "You gain ${to - from} life", null, null, null, from, to))
        }
        return out
    }

    private fun lifeChange(st: MatchState, events: List<GameEvent>): Pair<Int, Int>? {
        val mine = events.filter { it.type == "life" && it.player == st.viewer && it.lifeFrom != null && it.lifeTo != null }
        if (mine.isEmpty()) return null
        val from = mine.first().lifeFrom!!; val to = mine.last().lifeTo!!
        return if (to < from) from to to else null
    }

    private fun targetText(st: MatchState, refs: List<Ref>) = refs.joinToString(", ") {
        if (it.kind == "player") (if (it.id == st.viewer) "Targets you" else "Targets CPU") else "Targets ${it.name ?: "a card"}"
    }

}
