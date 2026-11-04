package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Affordability
import dev.cardstashy.nativeplay.ui.ShortCasts
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The playable glow means "you can do this now" (Randall 4 Nov: Cid glowed on turn 1 with one land). */
class GlowTest {
    private fun card(id: Int, zone: String, name: String, type: String, cost: String, text: String, tapped: Boolean = false) =
        """{"id":$id,"zone":"$zone","owner":1,"controller":1,"hidden":false,"name":"$name","type":"$type","manaCost":"$cost","text":"$text","tapped":$tapped}"""

    private fun state(actionable: String, hand: List<String>, field: List<String>) = MatchState.parse("""{"status":"running","viewer":1,"turn":1,
        "players":[{"id":1,"isViewer":true,"zones":{"Hand":{"count":${hand.size},"cards":[${hand.joinToString(",")}]},"Battlefield":{"cards":[${field.joinToString(",")}]}},"mana":{}},
                   {"id":2,"zones":{}}],
        "inputType":"InputPassPriority","selection":{"actionable":[$actionable]}}""")!!

    private val cid = card(10, "Hand", "Cid, Freeflier Pilot", "Legendary Creature — Human Warrior Pilot", "{1}{W}",
        "Equipment and Vehicle spells you cast cost {1} less to cast.\\nJump — During your turn, Cid has flying.\\n{2}, {Q}: Return target Equipment or Vehicle card from your graveyard to your hand.")
    private val ridge = card(20, "Battlefield", "Wooded Ridgeline", "Land", "", "This land enters tapped.\\n({T}: Add {R} or {G}.)", tapped = true)

    @Test fun cidWithOneTappedLandIsNotEnoughMana() {
        val st = state("""{"kind":"card","id":10}""", listOf(cid), listOf(ridge))
        assertTrue(Affordability.provenUnaffordable(st.card(10)!!, st, emptyMap()))
        assertEquals("Not enough mana", ShortCasts().blocked(st)[10])
    }

    @Test fun ownCostReducersStillStayLit() {
        val c = MatchState.parseCard(com.google.gson.JsonParser.parseString(card(11, "Hand", "Ghalta", "Creature", "{10}{G}{G}", "This spell costs {X} less to cast, where X is the total power of creatures you control.")).asJsonObject)
        assertTrue(Affordability.costBends(c))
        val other = MatchState.parseCard(com.google.gson.JsonParser.parseString(card(12, "Hand", "Goblin Electromancer", "Creature", "{R}{R}", "Instant and sorcery spells you cast cost {1} less to cast.")).asJsonObject)
        assertFalse(Affordability.costBends(other))
    }

    @Test fun forgeUnprovenCardsStayDarkButProvenOnesGlow() {
        val bolt = card(30, "Hand", "Lightning Bolt", "Instant", "{R}", "Lightning Bolt deals 3 damage to any target.")
        val x = card(31, "Hand", "Fireball", "Sorcery", "{X}{R}", "Fireball deals X damage.")
        val st = state("""{"kind":"card","id":30,"affordability":"available"},{"kind":"card","id":31,"affordability":"unknown"}""", listOf(bolt, x), emptyList())
        val sc = ShortCasts(); val blocked = sc.blocked(st)
        assertEquals(setOf(31), sc.quiet(st, blocked))
    }

    @Test fun updaterComparesVersions() {
        assertFalse(Updater.newer("0.4.9", 0, "0.4.10-test5-native-test", 33))
        assertTrue(Updater.newer("0.4.11", 0, "0.4.10-test5-native-test", 33))
        assertTrue(Updater.newer("0.4.10", 0, "0.4.10-test5-native-test", 33))
        assertFalse(Updater.newer("0.4.10", 0, "0.4.10", 34))
        assertTrue(Updater.newer("0.4.10", 35, "0.4.10", 34))
        val rel = Updater.parse(com.google.gson.JsonParser.parseString("""{"nativeTest":{"href":"/downloads/cardstashy-native-test-0.4.9.apk","bytes":74063483,"version":"0.4.9"}}""").asJsonObject)!!
        assertEquals("https://cardstashy.com/downloads/cardstashy-native-test-0.4.9.apk", rel.url)
        assertEquals(null, Updater.parse(com.google.gson.JsonParser.parseString("""{"nativeTest":{"href":"https://evil.example/x.apk","version":"9.9.9"}}""").asJsonObject))
    }
}
