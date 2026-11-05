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

    @Test fun combatThatSkipsToMain2StillLunges() {
        dev.cardstashy.nativeplay.ui.Motion.still = false
        fun snap(phase: String, attacking: Boolean, life: Int) = MatchState.parse("""{"status":"running","viewer":1,"turn":3,"revision":${if (attacking) 1 else 2},"phase":"$phase",
            "players":[{"id":1,"isViewer":true,"life":20,"zones":{"Battlefield":{"cards":[{"id":5,"zone":"Battlefield","owner":1,"controller":1,"hidden":false,"name":"Bear","type":"Creature — Bear","power":2,"toughness":2,"attacking":$attacking}]}}},
                       {"id":2,"life":$life,"zones":{}}]}""")!!
        val anchors = dev.cardstashy.nativeplay.ui.Anchors()
        val fx = dev.cardstashy.nativeplay.ui.Battlefield()
        fx.take(snap("COMBAT_DECLARE_ATTACKERS", true, 20), anchors)
        fx.take(snap("MAIN2", false, 18), anchors)
        assertTrue(fx.items.any { it.kind == dev.cardstashy.nativeplay.ui.Fx.LUNGE && it.card == 5 && it.toKey == "orb2" })
    }

    @Test fun updaterComparesVersions() {
        assertFalse(Updater.newer("0.4.9", 0, "0.4.10-test5-native-test", 33))
        assertTrue(Updater.newer("0.4.11", 0, "0.4.10-test5-native-test", 33))
        assertTrue(Updater.newer("0.4.10", 0, "0.4.10-test5-native-test", 33))
        assertFalse(Updater.newer("0.4.10", 0, "0.4.10", 34))
        assertFalse(Updater.newer("0.4.10", 0, "0.4.10-native-test", 35))
        assertTrue(Updater.newer("0.4.10", 35, "0.4.10", 34))
        val rel = Updater.parse(com.google.gson.JsonParser.parseString("""{"nativeTest":{"href":"/downloads/cardstashy-native-test-0.4.9.apk","bytes":74063483,"version":"0.4.9"}}""").asJsonObject)!!
        assertEquals("https://cardstashy.com/downloads/cardstashy-native-test-0.4.9.apk", rel.url)
        assertEquals(null, Updater.parse(com.google.gson.JsonParser.parseString("""{"nativeTest":{"href":"https://evil.example/x.apk","version":"9.9.9"}}""").asJsonObject))
    }

    @Test fun updaterClearsInstalledDownload() {
        val d = kotlin.io.path.createTempDirectory("updates").toFile()
        for (n in listOf("cardstashy-0.4.25.apk", "cardstashy-0.4.26.part", "cardstashy-0.4.24.apk", "stray.tmp")) java.io.File(d, n).writeText("x")
        // 0.4.25 installed: its own download and older ones go; 0.4.26 still on its way stays.
        assertEquals(listOf("cardstashy-0.4.24.apk", "cardstashy-0.4.25.apk", "stray.tmp"), Updater.spent(d, "0.4.25-native-test").map { it.name }.sorted())
        assertEquals(listOf("cardstashy-0.4.24.apk", "stray.tmp"), Updater.spent(d, "0.4.24-native-test").map { it.name }.sorted())
        d.deleteRecursively()
    }
}
