package dev.cardstashy.nativeplay

import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.match.EngineNames
import dev.cardstashy.nativeplay.match.MetaDecks
import dev.cardstashy.nativeplay.match.QuickPlay
import dev.cardstashy.nativeplay.match.quickInput
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixtures in the shapes the web saves and serves (workspace data.decks, /api/meta/mtg, Supabase Auth errors). */
class ParsingTest {
    private fun obj(s: String) = JsonParser.parseString(s).asJsonObject

    @Test fun workspaceDecks() {
        val ws = obj("""{"decks":[
            {"id":"a","name":"Mono Red","format":"modern","cards":[{"name":"Mountain","qty":20,"type":"Basic Land — Mountain"},{"name":"Lightning Bolt","qty":4,"set":"m11","collectorNumber":"149"}]},
            {"id":"b","name":"","format":"","cards":[]},
            {"id":"c","name":"Atraxa","format":"commander","commander":"Atraxa, Praetors’ Voice","cards":[{"name":"Sol Ring","qty":1}]},
            {"id":"d","name":"Kitchen","format":"","cards":[{"name":"Wear/Tear","qty":60}]},
            {"id":"e","name":"Brawl pile","format":"oathbreaker","commanders":[{"name":"Kenrith, the Returned King"}],"cards":[{"name":"Sol Ring","qty":1}]}
        ]}""")
        val decks = Decks.parse(ws)
        assertEquals(listOf("a", "c", "d", "e"), decks.map { it.id })
        val red = decks[0]
        assertEquals(24, red.count); assertEquals("Lightning Bolt", red.face); assertEquals("Modern", QuickPlay.formatOf(red))
        assertEquals("Commander", QuickPlay.formatOf(decks[1])); assertEquals("Atraxa, Praetors’ Voice", decks[1].face)
        assertEquals("Vintage", QuickPlay.formatOf(decks[2]))
        assertEquals("Kenrith, the Returned King", decks[3].commander); assertEquals("Commander", QuickPlay.formatOf(decks[3]))
        assertTrue(Decks.parse(null).isEmpty())
    }

    @Test fun engineNames() {
        assertEquals("Wear // Tear", EngineNames.name("Wear/Tear"))
        assertEquals("Fire // Ice", EngineNames.name("Fire // Ice"))
        assertEquals("Atraxa, Praetors' Voice", EngineNames.name("Atraxa, Praetors’ Voice"))
        assertEquals("Aether Vial", EngineNames.name("Æther Vial"))
        assertEquals("Spider-Sense", EngineNames.name("Detect Intrusion"))
        assertEquals("Summon: Choco/Mog", EngineNames.name("Summon: Choco/Mog"))
        val d = EngineNames.deck(obj("""{"commander":"Atraxa, Praetors’ Voice","cards":[{"name":"Wear/Tear","qty":1,"set":"dgm"}],"side":["Æther Vial"]}"""))
        assertEquals(setOf("Atraxa, Praetors' Voice", "Wear // Tear", "Aether Vial"), EngineNames.names(d))
        assertEquals("dgm", d.getAsJsonArray("cards")[0].asJsonObject.get("set").asString)
    }

    @Test fun metaLists() {
        val body = obj("""{"decks":[
            {"key":"k1","name":"Boros Energy","main":[{"name":"Guide of Souls","qty":4}],"side":[{"name":"Wear/Tear","qty":1}],"commanders":[]},
            {"key":"k2","name":"Atraxa","main":[{"name":"Sol Ring","qty":1}],"commanders":[{"name":"Atraxa, Praetors' Voice","qty":1}]},
            {"key":"k3","name":"Empty","main":[]}
        ]}""")
        val lists = MetaDecks.parse(body, "Commander")
        assertEquals(2, lists.size)
        assertEquals("play-meta:k2", lists[1].get("id").asString)
        assertEquals("Atraxa, Praetors' Voice", lists[1].get("commander").asString)
        assertEquals("Atraxa, Praetors' Voice", lists[1].getAsJsonArray("cards")[0].asJsonObject.get("name").asString)
        assertNull(lists[0].get("commander"))
        // Never your own list.
        assertEquals("play-meta:k2", MetaDecks.pick(lists, lists[0])!!.get("id").asString)
    }

    @Test fun matchInput() {
        val you = obj("""{"id":"a","format":"modern","cards":[{"name":"Wear/Tear","qty":4}]}""")
        val cpu = obj("""{"id":"b","format":"Modern","cards":[{"name":"Lightning Bolt","qty":4}]}""")
        val input = obj(quickInput("Modern", you, cpu)).getAsJsonObject("input")
        assertEquals("Modern", input.get("format").asString)
        assertEquals("Modern", input.getAsJsonObject("humanDeck").get("format").asString)
        assertEquals("Wear // Tear", input.getAsJsonObject("humanDeck").getAsJsonArray("cards")[0].asJsonObject.get("name").asString)
        assertEquals("random", input.get("startingPlayer").asString); assertEquals("quick", input.get("playStyle").asString)
        assertEquals("forge-heuristic-medium-beta-v1", input.get("difficultyPolicyVersion").asString)
    }

    @Test fun forgeNamesNeverShow() {
        val tidy = dev.cardstashy.nativeplay.engine.MatchState.namesFor(mapOf(1 to "Randall", 2 to "Forge AI — Karn, the Great Creator · Expedition Map"), viewer = 1)
        assertEquals("Looking at cards in the CPU's hand", tidy("Looking at cards in Forge AI — Karn, the Great Creator · Expedition Map's hand"))
        assertEquals("CPU is going first.", tidy("Forge AI — Karn, the Great Creator · Expedition Map is going first."))
        assertEquals("You are going first.", tidy("Randall is going first."))
        assertEquals("Looking at cards in your library", tidy("Looking at cards in Randall's library"))
        assertEquals("CPU attacks", tidy("Forge AI attacks"))
    }

    @Test fun authErrors() {
        assertEquals("Email or password is incorrect. Try again or use Forgot password on the website.",
            Account.authError("""{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}"""))
        assertEquals("Confirm your email before logging in. Check your inbox and spam folder.", Account.authError("""{"error_code":"email_not_confirmed","msg":"Email not confirmed"}"""))
        assertEquals("Too many requests. Wait before trying again.", Account.authError("""{"error_code":"over_request_rate_limit","msg":"x"}"""))
    }
}
