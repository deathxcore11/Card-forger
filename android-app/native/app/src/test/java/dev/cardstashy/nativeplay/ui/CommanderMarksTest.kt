package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.CommanderDamage
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 0.4.60 Z7: every commander mark read from a bridge-shaped snapshot (table/snap-commander.json, in ForgeHttpBridge's shape: per card
 * "commander", "commanderCasts", "commanderTax"; per player "commanderDamage" [{from, commander, damage}]). Nothing is worked out here.
 */
class CommanderMarksTest {
    private fun snap(json: String = javaClass.classLoader!!.getResource("table/snap-commander.json")!!.readText()) = MatchState.parse(json)!!

    @Test fun parsesCastsAndTaxFromTheBridge() {
        val st = snap()
        val klothys = st.me.command.single()
        assertTrue(klothys.commander); assertEquals(1, klothys.commanderCasts); assertEquals(2, klothys.commanderTax)
        val talrand = st.cpu.battlefield.single { it.name == "Talrand, Sky Summoner" }
        assertTrue(talrand.commander); assertEquals(2, talrand.commanderCasts); assertEquals(4, talrand.commanderTax)
        // A card the bridge sends no tax for (not a commander) has none.
        val bears = st.cpu.battlefield.first { it.name == "Grizzly Bears" }
        assertNull(bears.commanderCasts); assertNull(bears.commanderTax)
    }

    @Test fun parsesCommanderDamagePerOpposingCommander() {
        val st = snap()
        assertEquals(listOf(CommanderDamage(st.cpu.id, "Talrand, Sky Summoner", 7)), st.me.commanderDamage)
        assertEquals(listOf(CommanderDamage(st.me.id, "Klothys, God of Destiny", 0)), st.cpu.commanderDamage)
        assertEquals(listOf("Cmdr damage 7/21"), CommanderMarks.damageShown(st.me).map(CommanderMarks::damageLine))
        assertEquals(listOf("Cmdr damage 0/21"), CommanderMarks.damageShown(st.cpu).map(CommanderMarks::damageLine))
    }

    @Test fun shieldInTheCommandZoneShowsForgesTax() {
        val st = snap()
        val sh = CommanderMarks.shield(st.me, st.players)
        assertNotNull(sh); sh!!
        assertEquals("Klothys, God of Destiny", sh.card.name)
        assertEquals(2, sh.tax); assertEquals("+2", CommanderMarks.taxLabel(sh)); assertFalse(sh.inPlay)
        assertFalse(CommanderMarks.crowned(sh.card))
    }

    @Test fun shieldStaysWhileTheCommanderIsInPlay() {
        val st = snap()
        val sh = CommanderMarks.shield(st.cpu, st.players)!!
        assertEquals("Talrand, Sky Summoner", sh.card.name)
        assertTrue(sh.inPlay); assertEquals("+4", CommanderMarks.taxLabel(sh))
        assertTrue(CommanderMarks.crowned(sh.card))
        // Under another player's control it is still its owner's shield.
        val stolen = sh.card.copy(controller = st.me.id)
        val moved = st.copy(players = st.players.map { p -> when (p.id) {
            st.cpu.id -> p.copy(battlefield = p.battlefield.filter { it.id != stolen.id })
            else -> p.copy(battlefield = p.battlefield + stolen) } })
        val sh2 = CommanderMarks.shield(moved.cpu, moved.players)!!
        assertEquals(stolen.id, sh2.card.id); assertTrue(sh2.inPlay)
        assertNull(CommanderMarks.shield(moved.me.copy(command = emptyList()), moved.players.map { if (it.id == moved.me.id) it.copy(command = emptyList()) else it }))
    }

    @Test fun noTaxBadgeBeforeTheFirstCastAndNoneWithoutForgesNumber() {
        val raw = javaClass.classLoader!!.getResource("table/snap-commander.json")!!.readText()
        val zero = snap(raw.replace("\"commanderCasts\": 1, \"commanderTax\": 2", "\"commanderCasts\": 0, \"commanderTax\": 0"))
        val sh = CommanderMarks.shield(zero.me, zero.players)!!
        assertEquals(0, sh.card.commanderTax); assertNull(CommanderMarks.taxLabel(sh))
        // The app never works the tax out from the casts: with casts but no tax from Forge, no badge.
        val noTax = snap(raw.replace("\"commanderTax\": 2", "\"commanderTaxX\": 2"))
        val sh2 = CommanderMarks.shield(noTax.me, noTax.players)!!
        assertEquals(1, sh2.card.commanderCasts); assertNull(sh2.tax)
    }

    @Test fun atMostTwoDamageLinesTheMostDamageFirstKeptInOrder() {
        val st = snap()
        val pod = st.me.copy(commanderDamage = listOf(CommanderDamage(2, "A", 3), CommanderDamage(3, "B", 0), CommanderDamage(4, "C", 12)))
        assertEquals(listOf("A", "C"), CommanderMarks.damageShown(pod).map { it.commander })
        assertTrue(CommanderMarks.damageShown(st.me.copy(commanderDamage = emptyList())).isEmpty())
    }
}
