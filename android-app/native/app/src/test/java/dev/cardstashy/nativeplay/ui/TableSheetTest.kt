package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 0.4.59 T3 (faults 19 and 24): what the sheet shows for a pile and a graveyard; 0.4.60 G3: a lone card inspects, with its attachments. */
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

    /**
     * 0.4.60 G3 (glance-marks-brief.md "One inspect view") replaces T3's one-card sheet: a lone permanent opens CardInspect, which lists
     * what is attached to it (was: Open.One gave a sheet of the card then each attachment "Attached to Hill Giant").
     */
    @Test fun aLonePermanentInspectsAPileOpensTheGroupSheet() {
        val giant = st.me.battlefield.first { it.name == "Hill Giant" }
        assertEquals(PileTap.Inspect(giant), pileTap(listOf(giant)))
        val forests = st.me.battlefield.filter { it.name == "Forest" && it.attachedTo == null && it.attachments.isEmpty() && it.counters.isEmpty() }
        assertTrue(forests.size > 1)
        val t = pileTap(forests)
        assertEquals(PileTap.Sheet(Open.Group(st.viewer, "Forest")), t)
        // The pile still opens the same group sheet as before.
        assertEquals("Your Forest ×5", sheetOf(st, (t as PileTap.Sheet).open)!!.title)
    }

    @Test fun theInspectViewListsEachAttachmentOfTheCard() {
        val giant = st.me.battlefield.first { it.name == "Hill Giant" }
        val aura = giant.copy(id = 990, name = "Ethereal Armor", type = "Enchantment — Aura", power = null, toughness = null, attachedTo = giant.id)
        val me = st.me.copy(battlefield = st.me.battlefield.map { if (it.id == giant.id) it.copy(attachments = listOf(990, 4242)) else it } + aura)
        val s2 = st.copy(players = st.players.map { if (it.id == st.viewer) me else it })
        // In Forge's order; an id no longer on the table (4242) is skipped.
        assertEquals(listOf("Ethereal Armor"), attachedOf(s2, s2.card(giant.id)!!).map { it.name })
        // A card with nothing attached, a card off the battlefield, or no table: nothing listed.
        assertTrue(attachedOf(s2, s2.me.battlefield.first { it.name == "Forest" }).isEmpty())
        assertTrue(attachedOf(s2, s2.me.graveyard.first()).isEmpty())
        assertTrue(attachedOf(null, s2.card(giant.id)!!).isEmpty())
    }

    @Test fun whatLeftTheTableClosesTheSheet() {
        assertNull(sheetOf(st, Open.Group(st.viewer, "Black Lotus")))
        assertNull(sheetOf(st, Open.Grave(4242)))
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
