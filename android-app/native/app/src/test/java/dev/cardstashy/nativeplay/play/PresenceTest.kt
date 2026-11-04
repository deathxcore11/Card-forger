package dev.cardstashy.nativeplay.play

import dev.cardstashy.nativeplay.play.Presence.Activity
import dev.cardstashy.nativeplay.play.Presence.Match
import dev.cardstashy.nativeplay.play.Presence.Where
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** test-play-live-toasts.mjs, the presence half, against the native port of play-presence.js. */
class PresenceTest {
    @Test fun labelsComeFromRealAppState() {
        assertEquals(Activity("story", "Story · Act 12 · The Kami Are Coming · turn 5", 5), Presence.activity(Where(match = Match("story", act = 12, battle = "The Kami Are Coming", turn = 5))))
        assertEquals(Activity("quick", "Quick Play · Pauper · turn 7", 7), Presence.activity(Where(match = Match("quick", "Pauper", 7))))
        assertEquals(Activity("friend", "Multiplayer · Commander", null), Presence.activity(Where(match = Match("friend", "Commander", 0))))
        assertEquals(Activity("merchant", "At the Merchant", null), Presence.activity(Where("play", "shop")))
        assertEquals(Activity("app", "In CardStashy", null), Presence.activity(Where("collection")))
        assertTrue(Presence.activity(Where(match = Match("story", act = 1, battle = "x".repeat(200)))).label.length <= 80)
        assertTrue(!Regex("[<>]").containsMatchIn(Presence.activity(Where(match = Match("quick", "<img>"))).label))
    }

    @Test fun beatsStayRare() {
        var t = 0L; var on = true; val sent = mutableListOf<String>()
        Presence.now = { t }; Presence.enabled = { on }; Presence.send = { _, _ -> }; Presence.visible = true; Presence.resetForTest()
        fun poke() { Presence.tick()?.let { sent += it.label } }
        Presence.where = Where("play", "home"); poke(); assertEquals(1, sent.size)
        t = 5000; poke(); assertEquals("same screen, no beat", 1, sent.size)
        Presence.where = Where("play", "shop"); t = 10000; poke(); assertEquals("too soon after the last beat", 1, sent.size)
        t = Presence.MIN_GAP_MS; poke(); assertEquals(2, sent.size); assertEquals("At the Merchant", sent[1])
        t += Presence.BEAT_MS; poke(); assertEquals("heartbeat", 3, sent.size)
        Presence.visible = false; t += Presence.BEAT_MS; poke(); assertEquals("background sends nothing", 3, sent.size)
        Presence.visible = true; on = false; t += Presence.BEAT_MS; poke(); assertEquals("switched off sends nothing", 3, sent.size)
        on = true; Presence.where = Where("play", "", Match("quick", "Pauper")); Presence.matchTurn = 7; t += Presence.BEAT_MS
        assertEquals("Quick Play · Pauper · turn 7", Presence.tick()?.label)
        assertNull(Presence.tick())
    }
}
