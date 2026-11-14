package dev.cardstashy.nativeplay.audio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The match sound pass, step 8a (specs/match-sound-brief.md): the 2026 cue kit is in the build and every old cue id is sent to
 * its new file by one router, with the pass's rules: the draw takes rotate, cards and ticks vary 3 % in pitch, and two big hits
 * never start inside 120 ms.
 */
class CuesTest {
    /** The cue files, by name without ".ogg" (the test runs from the app module or the native folder). */
    private val kit: Set<String> = generateSequence(File("").absoluteFile) { it.parentFile }.map { File(it, "sfx") }.first { it.isDirectory }
        .listFiles()!!.filter { it.extension == "ogg" }.map { it.nameWithoutExtension }.toSet()
    private var clock = 0L
    private fun router(rnd: Float = .5f, has: (String) -> Boolean = { it in kit }) = Cues.Router(has, { clock }, { rnd })

    @Test fun everyOldIdGoesToANewCueThatIsInTheKit() {
        for ((old, new) in Cues.TODAY) if (new != null) assertTrue("$old goes to $new, which is not in sfx/", new in kit)
        for (name in Cues.VARIED + Cues.BIG.keys) assertTrue("$name is not in sfx/", name in kit)
        val r = router()
        assertEquals("clash", r.route("CMB-022")!!.name)
        // The old trim was made for the old file: the new one plays at its own level. The CPU's quiet draw stays quiet.
        assertEquals(1f, r.route("CARD-008", .5f)!!.volume, 0f)
        assertEquals(.4f, r.route("CARD-002", .4f)!!.volume, 0f)
        // The second layer of the old block and face hit is inside the new cue: it does not play again.
        assertNull(r.route("CMB-016")); assertNull(r.route("CMB-010"))
        // A new cue is asked for by its own name; a name nobody has is silence, not a crash.
        assertEquals("stack_burst", r.route("stack_burst")!!.name)
        assertNull(r.route("no_such_cue"))
        // A build without the new file still plays the old one, as before.
        val old = router(has = { it == "CMB-022" }).route("CMB-022", .7f, 1.1f)!!
        assertEquals(Cues.Play("CMB-022", .7f, 1.1f), old)
    }

    @Test fun drawsRotateTicksVaryAndTheLadderClimbs() {
        val r = router()
        assertEquals(listOf("card_draw_1", "card_draw_2", "card_draw_3", "card_draw_1"), List(4) { r.route("CARD-001")!!.name })
        // 3 % either way, never more; the middle of the dice is the plain rate.
        assertEquals(1.03f, router(1f).route("CARD-006")!!.rate, .0001f)
        assertEquals(.97f, router(0f).route("CARD-006")!!.rate, .0001f)
        assertEquals(1f, router(.5f).route("CARD-006")!!.rate, .0001f)
        // A cue that is not a card, a tick or a death is never bent.
        assertEquals(1f, router(1f).route("TT-001")!!.rate, 0f)
        // Mana ticks climb 0, 3, 5, 7, 10, 12 semitones and hold at the top.
        assertEquals(1f, Cues.ladder(0), 0f)
        assertEquals(1.1892f, Cues.ladder(1), .0001f)
        assertEquals(2f, Cues.ladder(5), .0001f)
        assertEquals(2f, Cues.ladder(9), .0001f)
        for (n in 1..5) assertTrue(Cues.ladder(n) > Cues.ladder(n - 1))
        // Life ticks fall 3 % a point and stop at .6.
        assertEquals(.91f, Cues.fall(3), .0001f)
        assertEquals(.6f, Cues.fall(40), 0f)
    }

    @Test fun twoBigHitsNeverStartTogether() {
        val r = router()
        clock = 1000
        val first = r.route("CMB-022")
        assertNotNull(first); assertFalse(first!!.cuts)
        // 60 ms later a hit of the same weight is dropped; a louder one cuts in over the first.
        clock = 1060
        assertNull(r.route("CMB-005"))
        val lethal = r.route("lethal_hit")!!
        assertTrue("the louder hit stops the one still ringing", lethal.cuts)
        // And nothing lighter starts over the killing blow.
        clock = 1100
        assertNull(r.route("CMB-022"))
        // Past the gap, the next hit plays in full.
        clock = 1060 + Cues.BIG_GAP_MS
        val next = r.route("CMB-022")!!
        assertFalse(next.cuts)
        // Small cues are never held back.
        clock += 1
        assertNotNull(r.route("CARD-006")); assertNotNull(r.route("CMB-024"))
    }

    /** Butter pass B1 (Randall 14 Nov): the clock and phase ticks keep their callers' quieter levels instead of playing at full volume. */
    @Test fun clockAndPhaseTicksKeepTheirLevel() {
        val r = router(has = { true })
        assertEquals(.35f, r.route("TT-003", .35f)!!.volume, 0f)
        assertEquals(.35f, r.route("TT-007", .35f)!!.volume, 0f)
        assertEquals(.6f, r.route("TT-008", .6f)!!.volume, 0f)
        assertEquals(1f, r.route("TT-001", .5f)!!.volume, 0f)
    }
}
