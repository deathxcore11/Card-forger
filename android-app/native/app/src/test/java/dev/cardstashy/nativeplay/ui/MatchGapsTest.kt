package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Randall's 15 Nov recording, specs/arena-vs-ours-gaps-1115.md: items 1 (scry shows its card) and 4 (blockers are ringed). */
class MatchGapsTest {
    private val base = MatchState.parse(javaClass.getResource("/table/snap-main.json")!!.readText())!!

    @Test fun aOneCardScryNamesItsCard() {
        // Forge's own words and buttons for a one-card scry (PlayerControllerHuman.willPutCardOnTop): no prompt, Top is OK, Bottom is cancel.
        val scry = base.copy(inputType = "InputConfirm", prompt = null, buttons = Buttons("Top", "Bottom", true, true),
            message = "Put Seam Rip on the top or bottom of your library?")
        assertEquals("Seam Rip", ScryOne.of(scry))
        // Any other yes/no, a mulligan or a real prompt is not a scry.
        assertNull(ScryOne.of(scry.copy(buttons = Buttons("Yes", "No", true, true))))
        assertNull(ScryOne.of(scry.copy(inputType = "InputConfirmMulligan")))
        assertNull(ScryOne.of(scry.copy(message = "Do you want to shuffle the library?")))
    }

    @Test fun everyCreatureThatCouldBlockIsRinged() {
        val st0 = MatchState.parse(javaClass.getResource("/table/snap-realblock.json")!!.readText())!!
        // Forge's real block question before any blocker is chosen: Glory Seeker stands free, four attackers (three flyers).
        val st = st0.copy(prompt = null, players = st0.players.map { p -> if (p.id == st0.viewer) p.copy(battlefield = p.battlefield.map { it.copy(blocking = false) }) else p })
        val attackers = st.players.filter { it.id != st.viewer }.flatMap { it.battlefield }.filter { it.attacking }
        assertTrue("the fixture has an attack", attackers.isNotEmpty())
        val mine = st.me.battlefield.filter { it.isCreature }
        val marks = Glow.boardMarks(st, true)
        for (c in mine) {
            val could = !c.tapped && !c.blocking && !c.attacking && attackers.any { mayBlock(it, c) } && blockRefusal(null, c) == null
            if (could) assertEquals("${c.name} could block", Mark.PICKABLE, marks[c.id])
        }
        assertEquals("Glory Seeker is ringed", Mark.PICKABLE, marks[57])
        // A tapped creature, and nothing at all when the table is not live.
        mine.firstOrNull { marks[it.id] == Mark.PICKABLE }?.let { c ->
            assertFalse(Glow.canBlock(c.copy(tapped = true), st))
            assertEquals(Mark.NONE, Glow.boardMarks(st, false)[c.id])
        }
    }
}
