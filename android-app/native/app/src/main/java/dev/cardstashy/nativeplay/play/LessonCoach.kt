package dev.cardstashy.nativeplay.play

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * story-lessons.js createLessonCoach: soft, one-time "Rift" whispers for new players (the Act 1 lesson battles, then any new
 * mechanic in a hero-side Story battle). Reads only what the table shows; it never takes a tap, never pauses play and never
 * changes a rule. Each idea is shown once per device ([seen]). Pure logic: the table shows the [Whisper] and calls [shown].
 */
class LessonCoach(private val data: StoryLessons, battleId: String?, playerSide: String, private val seen: MutableSet<String>, private val now: () -> Long) {
    /** One idea: what to say and the cards to glow (at most four). */
    class Whisper(val concept: String, val ids: List<Int>, val text: String)

    private val lesson: List<String> = if (playerSide == "hero" && data.isLessonBattle(battleId)) data.battles.getValue(battleId!!) else emptyList()
    private var myTurns = 0
    private var lastTurn = -1
    private var lastWhisper = 0L
    private var extra = 0

    /** api.update: count your turns; with nothing showing ([idle]), the first idea that applies to the table right now. */
    fun update(st: MatchState, idle: Boolean): Whisper? {
        if (st.status != "running" || st.turn < 1) return null
        if (st.activePlayer == st.viewer && st.turn != lastTurn) myTurns++
        lastTurn = st.turn
        if (!idle) return null
        return pick(st) ?: pickWord(st)
    }

    /** show(): the idea is marked seen for good, and a word counts toward the two a match allows. */
    fun shown(w: Whisper) {
        seen.add(w.concept); lastWhisper = now()
        if (w.concept.startsWith("w:")) extra++
    }

    private fun pick(s: MatchState): Whisper? {
        val me = s.viewer
        val field = s.players.flatMap { it.battlefield }
        val mine = field.filter { it.controller == me }
        val theirs = field.filter { it.controller != me }
        val hand = s.me.hand
        val myTurn = s.activePlayer == me
        val phase = PHASES[s.phase] ?: s.phase.orEmpty()
        val main = RE.getValue("main").containsMatchIn(phase)
        val lands = mine.filter { it.isLand }
        val free = lands.count { !it.tapped }
        val castable = hand.filter { !it.isLand && manaValue(it.manaCost) <= free }
        val ready = mine.filter { it.isCreature && !it.tapped && !it.summoningSick }
        val prioritySeat = s.priorityPlayer ?: if (s.waitingOnMe) me else null
        val instants = hand.filter { it.type.contains("Instant") && manaValue(it.manaCost) <= free }
        fun ids(cs: List<Card>) = cs.map { it.id }.takeIf { it.isNotEmpty() }
        fun has(c: Card, re: String) = RE.getValue(re).containsMatchIn(kw(c))
        val tests: Map<String, () -> List<Int>?> = mapOf(
            "land" to { if (myTurn && main && lands.size < myTurns) ids(hand.filter { it.isLand }) else null },
            "cast" to { if (myTurn && main && free > 0) ids(castable.filter { it.isCreature }) else null },
            "sick" to { if (myTurn) ids(mine.filter { it.isCreature && it.summoningSick }) else null },
            "attack" to { if (myTurn && main && myTurns >= 2) ids(ready) else null },
            "block" to { if (!myTurn && RE.getValue("declare(attackers|blockers)").containsMatchIn(phase) && field.any { it.controller != me && it.attacking })
                ids(mine.filter { it.isCreature && !it.tapped }) else null },
            "flying" to { if (myTurn && main && theirs.any { it.isCreature && !has(it, "flying|reach") }) ids(ready.filter { has(it, "flying") }) else null },
            "removal" to { if (myTurn && main && theirs.any { it.isCreature }) ids(castable.filter { !it.isCreature }) else null },
            "protection" to { if (theirs.any { has(it, "protection") }) ids(mine.filter { has(it, "protection") }) else null },
            "firststrike" to { if (RE.getValue("firststrike").containsMatchIn(phase)) ids(field.filter { (it.attacking || it.blocking) && has(it, "first strike") }) else null },
            "hold" to { if (!myTurn && free > 0) ids(instants) else null },
            "stack" to { if (s.stack.any { it.controller != me } && prioritySeat == me) ids(instants) else null },
        )
        for (concept in lesson) {
            if (concept in seen) continue
            val ids = tests[concept]?.invoke() ?: continue
            return Whisper(concept, ids.take(4), data.say[concept] ?: continue)
        }
        return null
    }

    /** A new mechanic a new player would not know: one soft line, at most two per match outside the lesson battles. */
    private fun pickWord(s: MatchState): Whisper? {
        if (extra >= 2 || now() - lastWhisper < 20_000) return null
        val cards = s.players.flatMap { it.battlefield } + s.me.hand
        for (w in data.words) {
            if ("w:${w.name}" in seen) continue
            val hit = cards.firstOrNull { c -> if (w.re != null) w.re.containsMatchIn("${kw(c)} ${c.text}") else c.token } ?: continue
            return Whisper("w:${w.name}", listOf(hit.id), w.text)
        }
        return null
    }

    companion object {
        /** forge-session.mjs PHASES: Forge's phase names as the site's table names them, which the lesson tests read. */
        val PHASES = mapOf("UNTAP" to "Untap", "UPKEEP" to "Upkeep", "DRAW" to "Draw", "MAIN1" to "PreCombatMain", "COMBAT_BEGIN" to "BeginningOfCombat",
            "COMBAT_DECLARE_ATTACKERS" to "DeclareAttackers", "COMBAT_DECLARE_BLOCKERS" to "DeclareBlockers", "COMBAT_FIRST_STRIKE_DAMAGE" to "FirstStrikeDamage",
            "COMBAT_DAMAGE" to "CombatDamage", "COMBAT_END" to "EndCombat", "MAIN2" to "PostCombatMain", "END_OF_TURN" to "End", "CLEANUP" to "Cleanup")

        /** manaValue: {N} counts N, {X} nothing, any other symbol one. */
        fun manaValue(cost: String): Int = Regex("\\{([^}]+)\\}").findAll(cost).sumOf { m ->
            val s = m.groupValues[1]
            when { s.all { it.isDigit() } -> s.toInt(); s.equals("X", true) -> 0; else -> 1 }
        }

        private fun kw(c: Card) = c.keywords.joinToString(" | ")

        /** The tests' patterns, compiled once: the coach reads every table snapshot. */
        private val RE = listOf("main", "declare(attackers|blockers)", "firststrike", "flying|reach", "flying", "protection", "first strike")
            .associateWith { Regex(it, RegexOption.IGNORE_CASE) }
    }
}
