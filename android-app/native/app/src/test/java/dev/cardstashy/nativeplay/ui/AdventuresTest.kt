package dev.cardstashy.nativeplay.ui

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Adventures registry (plain JVM): what ships, how a game plugs in, and the pack count both ways. */
class AdventuresTest {
    private class Fake(override val id: String, override val ready: Boolean, private val p: AdventureProgress? = null, private val line: String? = null) : AdventureGame {
        override val name = id; override val style = "s"; override val blurb = "b"; override val accent = 0xFF112233L; override val art: String? = "u"
        val launched = mutableListOf<String>()
        override fun state() = line
        override fun progress() = p
        override fun launch(host: AdventureHost) { launched += id; host.web("web:$id") }
    }

    @After fun clean() { Adventures.all().map { it.id }.forEach { Adventures.unregister(it) }; Adventures.defaults().forEach { Adventures.register(it) }; Adventures.packEvery = 5; Adventures.packCount = PackCount.SHARED }

    @Test fun shipsPlaneswalkReadyAndTheOthersAsSoon() {
        assertEquals(listOf("planeswalk", "lost-memories", "duel-summoner"), Adventures.all().map { it.id })
        assertEquals(listOf("planeswalk"), Adventures.readyGames().map { it.id })
        assertEquals("planeswalk", Adventures.first()?.id)
    }

    @Test fun planeswalkOpensItsPageAndAUnreadyGameOpensNothing() {
        val opened = mutableListOf<String>(); val host = AdventureHost(web = { opened += it })
        Adventures.get("planeswalk")!!.launch(host); Adventures.get("lost-memories")!!.launch(host)
        assertEquals(listOf("https://cardstashy.com/planeswalk.html"), opened)
    }

    @Test fun planeswalkHasNoMadeUpState() { val g = Adventures.get("planeswalk")!!; assertNull(g.state()); assertNull(g.progress()); assertNull(Adventures.shared()) }

    @Test fun aNewGamePlugsInAndTheOthersStayPut() {
        val g = Fake("fourth", true, AdventureProgress(3, 10), "Best 1:00"); Adventures.register(g)
        assertEquals(listOf("planeswalk", "lost-memories", "duel-summoner", "fourth"), Adventures.all().map { it.id })
        assertTrue(Adventures.readyGames().any { it.id == "fourth" })
        g.launch(AdventureHost(web = {})); assertEquals(listOf("fourth"), g.launched)
    }

    @Test fun registeringTheSameIdReplacesAndSoonCanBecomeReady() {
        Adventures.register(Fake("lost-memories", true)); assertEquals(3, Adventures.all().size)
        assertTrue(Adventures.get("lost-memories")!!.ready); assertEquals(listOf("planeswalk", "lost-memories"), Adventures.readyGames().map { it.id })
    }

    @Test fun sharedTotalAddsReadyGamesOnly() {
        Adventures.register(Fake("a", true, AdventureProgress(6, 20))); Adventures.register(Fake("b", true, AdventureProgress(5, 20))); Adventures.register(Fake("c", false, AdventureProgress(7, 20)))
        val s = Adventures.shared()!!; assertEquals(11, s.earned); assertEquals(40, s.total)
    }

    @Test fun packRateIsConfigurableSharedOrPerGame() {
        assertEquals(3, Adventures.packsEarned(listOf(6, 5, 4)))                              // 15 shared, every 5
        assertEquals(1 + 1 + 0, Adventures.packsEarned(listOf(6, 5, 4), count = PackCount.PER_GAME))
        assertEquals(0, Adventures.packsEarned(listOf(6, 5, 4), every = 20)); assertEquals(1, Adventures.packsEarned(listOf(6, 5, 11), every = 20))
        assertEquals(0, Adventures.packsEarned(listOf(6), every = 0))
        assertEquals(5, Adventures.toNextPack(0)); assertEquals(1, Adventures.toNextPack(4)); assertEquals(5, Adventures.toNextPack(5))
    }

    @Test fun homeCardWordsFollowTheRegistry() {
        assertEquals("Planeswalk, with more games on the way.", Adventures.copy()); assertEquals("Planeswalk", Adventures.line())
        Adventures.register(Fake("a", true)); assertEquals("2 games", Adventures.line())
        assertFalse(Adventures.copy().isEmpty())
    }

    @Test fun aGameThatThrowsDoesNotTakeTheTotalDown() {
        Adventures.register(object : AdventureGame by Fake("bad", true) { override fun progress(): AdventureProgress? = error("boom") })
        Adventures.register(Fake("good", true, AdventureProgress(1, 2)))
        assertEquals(1, Adventures.shared()!!.earned)
    }
}
