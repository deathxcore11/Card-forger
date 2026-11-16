package dev.cardstashy.nativeplay.audio

import kotlin.math.pow

/**
 * The match sound pass (specs/match-sound-brief.md, replaces P8 of the match punch brief). The 2026 cue set lives in
 * android-app/native/sfx under plain names ("clash", "mana_tick"). Callers that still name a cue by its old id ("CMB-022") are
 * sent to the new file here, so every caller moves at once and nothing plays twice; an old id with no new cue keeps its old file.
 * The rules of the pass are here too, away from Android so they can be tested: the three draw takes rotate, cards, ticks and
 * deaths vary 3 % in pitch, and two big hits never start inside 120 ms (the louder tier wins, the other is dropped).
 */
object Cues {
    /** Today's id to the new cue (the brief's cue list, column "Today"). Null: the new cue it rode with already carries that layer. */
    val TODAY: Map<String, String?> = mapOf(
        "CARD-001" to "card_draw_1", "CARD-002" to "card_draw_1", "CARD-005" to "land_drop", "CARD-006" to "mana_tick", "CARD-008" to "cast_C",
        "CAST-W" to "cast_W", "CAST-U" to "cast_U", "CAST-B" to "cast_B", "CAST-R" to "cast_R", "CAST-G" to "cast_G", "CAST-C" to "cast_C", "CAST-M" to "cast_M",
        "CARD-010" to "creature_land", "CARD-025" to "token", "CARD-014" to "trigger", "CARD-013" to "ability", "CARD-027" to "counter_add", "CARD-028" to "attach",
        "TT-001" to "turn_yours", "TT-002" to "turn_theirs", "TT-003" to "phase_tick", "TT-007" to "clock_tick", "TT-008" to "time_out",
        "CMB-001" to "attack_ready", "CMB-002" to "attack_go", "CMB-003" to "block", "CMB-021" to "block", "CMB-022" to "clash", "CMB-004" to "damage_tick", "CMB-006" to "damage_tick",
        "CMB-005" to "face_hit", "CMB-023" to "face_hit", "CMB-024" to "life_tick", "CMB-019" to "low_life", "CMB-009" to "death", "CARD-018" to "to_graveyard", "CMB-018" to "spell_hit",
        "CARD-012" to "fizzle", "CARD-019" to "exile", "CARD-020" to "bounce", "CARD-021" to "discard", "CARD-022" to "mill", "CMB-007" to "gain_tick", "CARD-024" to "shuffle",
        // The block's second ring and the face hit's second boom: one layered cue now.
        "CMB-016" to null, "CMB-010" to null,
    )
    /** Cards, ticks and deaths: a random 3 % either way in pitch, so the same file never sounds the same twice running. */
    val VARIED = setOf("card_draw_1", "card_draw_2", "card_draw_3", "card_lift", "card_flip", "card_tuck", "land_drop", "mana_tick", "untap", "damage_tick", "life_tick",
        "gain_tick", "phase_tick", "death", "to_graveyard", "discard", "mill", "token", "counter_add")
    /** The big hits by loudness tier (the brief's tiers): 3 the killing blow and the wipe, 2 face hits, clash, big landing and spell hit. */
    val BIG = mapOf("lethal_hit" to 3, "wipe_break" to 3, "face_hit_big" to 2, "face_hit" to 2, "clash" to 2, "creature_land_heavy" to 2, "spell_hit" to 2)
    const val BIG_GAP_MS = 120L
    private val LADDER = intArrayOf(0, 3, 5, 7, 10, 12)
    /** The climbing notes of `mana_tick` and `gain_tick`: the [n]th in a run (from 0) is 0, 3, 5, 7, 10, 12 semitones up and holds at the top. */
    fun ladder(n: Int): Float = 2.0.pow(LADDER[n.coerceIn(0, LADDER.lastIndex)] / 12.0).toFloat()
    /** `life_tick` falls 3 % a point (never under .6); the second attacker's step is 6 % up. */
    fun fall(n: Int): Float = (1f - .03f * n).coerceAtLeast(.6f)

    /** What to play: the file, its volume and rate, and whether a big hit still ringing must be stopped for it. */
    data class Play(val name: String, val volume: Float, val rate: Float, val cuts: Boolean = false)

    /**
     * One table's router. [has] says which files are loaded; [now] is a clock in ms; [rnd] gives 0..1.
     */
    class Router(private val has: (String) -> Boolean, private val now: () -> Long, private val rnd: () -> Float = { Math.random().toFloat() }) {
        private var take = 0
        private var bigAt = Long.MIN_VALUE / 2; private var bigTier = 0

        fun route(id: String, volume: Float = 1f, rate: Float = 1f): Play? {
            val mapped = TODAY.containsKey(id)
            var name = if (mapped) TODAY[id] ?: return null else id
            // The new file is not in this build: the old one still plays, as it did.
            var vol = volume
            if (!has(name)) { if (mapped && has(id)) return Play(id, volume, rate) else return null }
            // The new set carries its own loudness tiers: an old caller's trim (made for the old file) is not applied twice.
            if (mapped && id !in KEEP_TRIM) vol = 1f
            if (name == "card_draw_1") { val n = take++ % 3 + 1; if (has("card_draw_$n")) name = "card_draw_$n" }
            var r = rate
            if (name in VARIED) r *= 1f + (rnd() * 2f - 1f) * .03f
            var cuts = false
            BIG[name]?.let { tier ->
                val t = now()
                if (t - bigAt < BIG_GAP_MS) { if (tier <= bigTier) return null; cuts = true }
                bigAt = t; bigTier = tier
            }
            return Play(name, vol, r.coerceIn(.5f, 2f), cuts)
        }
    }
    /** Old callers whose volume is part of the moment, not a trim: the CPU's quiet draw, the life ticks, and (butter pass B1,
     *  Randall 14 Nov) the phase tick and the clock's ticks and time-out, which played at full volume over every caller's level. */
    internal val KEEP_TRIM = setOf("CARD-002", "CMB-024", "TT-003", "TT-007", "TT-008")
}
