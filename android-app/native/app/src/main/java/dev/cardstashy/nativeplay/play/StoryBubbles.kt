package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * In-match Story speech (story-ui.js createStoryBubbles). Cues: start, big (a creature of power 4+), half (life 10 or less),
 * low (life 5 or less), win, loss; each side says each cue once. A cue is a plain line or {who, line}: someone else speaks from that seat.
 * Fed the snapshots the table shows, never the engine's, so a line only comes once you could see why.
 */
class StoryBubbles(private val battle: JsonObject, private val playerSide: String) {
    class Line(val mine: Boolean, val who: String, val text: String)
    private val cpuSide = if (playerSide == "hero") "villain" else "hero"
    private val said = HashSet<String>()

    private fun sideOf(mine: Boolean) = if (mine) playerSide else cpuSide
    private fun speaker(side: String) = battle.getAsJsonObject(side)["who"].asString

    private fun say(mine: Boolean, cue: String): Line? {
        val side = sideOf(mine)
        if (!said.add("$side:$cue")) return null
        val c = battle.get("cues")?.takeIf { it.isJsonObject }?.asJsonObject?.get(side)?.takeIf { it.isJsonObject }?.asJsonObject?.get(cue) ?: return null
        return when {
            c.isJsonPrimitive -> Line(mine, speaker(side), c.asString)
            c.isJsonObject -> Line(mine, c.asJsonObject.get("who")?.takeIf { it.isJsonPrimitive }?.asString ?: speaker(side), c.asJsonObject["line"].asString)
            else -> null
        }
    }

    fun update(st: MatchState): List<Line> {
        val out = mutableListOf<Line>()
        if (st.turn >= 1 && "$cpuSide:start" !in said) { say(false, "start")?.let(out::add); say(true, "start")?.let(out::add) }
        for (p in st.players) if (p.life in 1..5) say(p.id == st.viewer, "low")?.let(out::add)
        for (p in st.players) if (p.life in 6..10) say(p.id == st.viewer, "half")?.let(out::add)
        for (p in st.players) for (c in p.battlefield) if (c.isCreature && (c.power ?: 0) >= 4) say(c.controller == st.viewer, "big")?.let(out::add)
        return out
    }

    fun finish(win: Boolean): List<Line> = listOfNotNull(say(false, if (win) "loss" else "win"), say(true, if (win) "win" else "loss"))
}
