package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.audio.Cues
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.match.Director

/**
 * The match sound pass (specs/match-sound-brief.md), cast, landing and turn: which cue plays on which frame. The cues are the
 * new set's names; [Cues] sends them to their files.
 */

/** A cue [at] ms into a cast's leg; [feel] the haptic that goes with it. */
internal data class LegCue(val at: Long, val id: String, val vol: Float = 1f, val rate: Float = 1f, val feel: String? = null)

/** The burst's sound starts 40 ms ahead of the burst (inside its 70 ms freeze), so it is heard on the burst and not after it. */
internal const val BURST_CUE_MS = Director.BURST_FREEZE_MS - 40L

/**
 * Pay: one `mana_tick` as each land turns (and each streak leaves the floating mana), one note higher each time. Burst:
 * `stack_burst` as the rest opens, quieter when nothing was paid (the half-size burst). Undo: `undo_taps` as the lands turn back.
 */
internal fun legCues(t: Director.Travel): List<LegCue> = when (t.leg) {
    Director.Leg.TAPS, Director.Leg.TO_POOL -> List(t.pool + t.taps.size) { i ->
        LegCue(Director.TAP_GAP_MS * i, "mana_tick", rate = Cues.ladder(i), feel = if (t.mine && i >= t.pool) "light" else null) }
    Director.Leg.REST -> listOf(LegCue(BURST_CUE_MS, "stack_burst", vol = if (t.power < 1f) .6f else 1f))
    Director.Leg.UNTAP -> listOf(LegCue(0L, "undo_taps"))
    else -> emptyList()
}

/** The cues a landing can make: the sound player leaves an arrival alone when the board's effects carry one of these. */
internal val LANDING_CUES = setOf("land_drop", "enters_tapped", "creature_land", "creature_land_heavy", "token")

/**
 * What [c] sounds like as it lands: a token its pop, a land its drop (dull when it enters tapped), power 5 or more ([TableFeel.HEAVY_POWER], the same step as the heavy landing's look) the heavy
 * landing, anything else that arrives already turned the dull one, and the rest the plain landing.
 */
internal fun landingCue(c: Card): String = when {
    c.token -> "token"
    c.isLand -> if (c.tapped) "enters_tapped" else "land_drop"
    c.isCreature && (c.power ?: 0) >= TableFeel.HEAVY_POWER -> "creature_land_heavy"
    c.tapped && !c.attacking -> "enters_tapped"
    else -> "creature_land"
}
