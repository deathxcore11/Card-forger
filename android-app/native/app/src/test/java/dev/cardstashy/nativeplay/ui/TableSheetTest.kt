package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 0.4.59 T3 (faults 19 and 24): what the sheet shows for a pile, a graveyard and one card with what is attached to it. */
class TableSheetTest {
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private val st = state("crowded")

    @Test fun aGroupShowsEveryCardOfThatNameReadyFirstTappedTurned() {
        // Your Forests: 119 and 120 ready, 136 to 138 tapped.
        val s = sheetOf(st, Open.Group(st.viewer, "Forest"))!!
        assertEquals("Your Forest ×5", s.title)
        assertEquals("2 ready, 3 tapped", s.sub)
        assertEquals(listOf(false, false, true, true, true), s.cards.map { it.tapped })
        assertEquals(listOf("Ready", "Ready", "Tapped", "Tapped", "Tapped"), s.cards.map { it.note })
        // The CPU's pile says whose it is.
        assertEquals("CPU's Island ×6", sheetOf(st, Open.Group(st.cpu.id, "Island"))!!.title)
    }

    @Test fun aGraveyardIsNewestFirstWithATabForEachSide() {
        val s = sheetOf(st, Open.Grave(st.cpu.id))!!
        assertEquals(listOf("Ponder", "Brainstorm", "Opt", "Counterspell"), s.cards.map { it.card.name })
        assertEquals("4 cards, newest first", s.sub)
        assertEquals(listOf("Your graveyard" to false, "CPU's graveyard" to true), s.tabs.map { it.label to it.on })
        assertEquals(listOf("Rampant Growth", "Lava Spike", "Shock"), sheetOf(st, Open.Grave(st.viewer))!!.cards.map { it.card.name })
    }

    @Test fun oneCardThenEachAttachmentAttachedToIt() {
        val giant = st.me.battlefield.first { it.name == "Hill Giant" }
        val aura = giant.copy(id = 990, name = "Ethereal Armor", type = "Enchantment — Aura", power = null, toughness = null, attachedTo = giant.id)
        val me = st.me.copy(battlefield = st.me.battlefield.map { if (it.id == giant.id) it.copy(attachments = listOf(990)) else it } + aura)
        val s2 = st.copy(players = st.players.map { if (it.id == st.viewer) me else it })
        val s = sheetOf(s2, Open.One(giant.id))!!
        assertEquals("Hill Giant", s.title)
        assertEquals("1 attached", s.sub)
        assertEquals(listOf("Hill Giant", "Ethereal Armor"), s.cards.map { it.card.name })
        assertEquals("Now 3/3", s.cards[0].note)
        assertEquals("Attached to Hill Giant", s.cards[1].note)
        // A lone tapped card says so.
        val tapped = st.me.battlefield.first { it.tapped }
        assertEquals("Tapped", sheetOf(st, Open.One(tapped.id))!!.sub)
    }

    @Test fun whatLeftTheTableClosesTheSheet() {
        assertNull(sheetOf(st, Open.One(4242)))
        assertNull(sheetOf(st, Open.Group(st.viewer, "Black Lotus")))
        // A graveyard card is not "one permanent".
        assertNull(sheetOf(st, Open.One(st.me.graveyard.first().id)))
    }

    @Test fun aQuestionThatAsksForAGraveyardCardRingsItAndOnlyWhileLive() {
        val opt = st.cpu.graveyard.first { it.name == "Opt" }
        val asking = st.copy(selection = st.selection.copy(targetCards = setOf(opt.id)))
        assertEquals(listOf(opt.id), graveChoices(asking, live = true).map { it.id })
        assertTrue(sheetOf(asking, Open.Grave(st.cpu.id), live = true)!!.cards.single { it.legal }.card.id == opt.id)
        assertTrue(graveChoices(asking, live = false).isEmpty())
        assertTrue(sheetOf(asking, Open.Grave(st.cpu.id), live = false)!!.cards.none { it.legal })
    }
}
