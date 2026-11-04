package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.UserDeck
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.ui.LobbyModel
import dev.cardstashy.nativeplay.ui.LobbyScreen
import dev.cardstashy.nativeplay.ui.SeatDeck
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import dev.cardstashy.nativeplay.account.Decks as Workspace

/**
 * The lobby in the same states as the site harness (scratchpad site/lobby.mjs on web 4.3.87): the five starter decks as
 * Play decks (Blue fliers missing its cards from the Trunk) and one Collection deck (Mono-red aggro, missing Swiftspear).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class LobbyShotTest {
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private val missing = java.util.TreeSet<String>()
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        if (f == null) { missing += url; return null }
        return BitmapFactory.decodeFile(f.path)?.asImageBitmap()
    }

    private val cards by lazy { JsonParser.parseString(javaClass.classLoader!!.getResource("lobby-cards.json")!!.readText()).asJsonArray.map { it.asJsonObject } }
    private val starters = listOf(
        Triple("w", "White angels · Starter", "Plains") to listOf("Healer's Hawk", "Hinterland Sanctifier", "Ajani's Pridemate", "Lifecreed Duo", "Helpful Hunter", "Dazzling Angel", "Inspiring Overseer", "Angel of Vitality", "Bovine Intervention"),
        Triple("u", "Blue fliers · Starter", "Island") to listOf("Spectral Sailor", "Harrier Strix", "Plumecreed Escort", "Floodpits Drowner", "Bellowing Crier", "Mocking Sprite", "Geyser Drake", "Essence Scatter", "Unsummon"),
        Triple("b", "Black drain · Starter", "Swamp") to listOf("Greedy Freebooter", "Infestation Sage", "Sanguine Syphoner", "Burglar Rat", "Marauding Blight-Priest", "Vampire Nighthawk", "Vile Entomber", "Murder", "Feed the Swarm"),
        Triple("r", "Red burn · Starter", "Mountain") to listOf("Fanatical Firebrand", "Reckless Lackey", "Firebrand Archer", "Sunset Strikemaster", "Scytheclaw Raptor", "Spitfire Lagac", "Volley Veteran", "Shock", "Lightning Strike"),
        Triple("g", "Green creatures · Starter", "Forest") to listOf("Llanowar Elves", "Bear Cub", "Ordinary Bear", "Ghalta, Primal Hunger", "Lashwhip Predator", "Tarmogoyf", "Tapestry Warden", "Virulent Emissary", "Scarecrow Guide"))

    private fun rows(land: String, names: List<String>) = JsonArray().apply {
        add(JsonObject().apply { addProperty("name", land); addProperty("qty", 24) }); names.forEach { n -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", 4) }) } }

    private fun setup() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        CardFacts.seed(cards)
        Account.setForTest(Account.Session("a", "r", Long.MAX_VALUE, "u1", "r@example.com"), Account.Profile("Randall", null, "randall"))
        val owned = starters.filter { it.first.first != "u" }.flatMap { it.second }.toSet() + "Mountain"
        val state = JsonObject().apply {
            add("wallet", JsonParser.parseString("""{"coins":170,"xp":230,"seal_c":0,"seal_u":0,"seal_r":0,"seal_m":0}"""))
            add("cards", JsonArray().apply { cards.filter { it["name"].asString in owned }.forEach { c ->
                add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", c["name"].asString); addProperty("r", c["rarity"].asString); addProperty("c", 4); addProperty("h", 0) }) } })
            add("decks", JsonArray().apply { starters.forEach { (t, names) -> add(JsonObject().apply {
                addProperty("id", "starter:" + t.first); addProperty("name", t.second); addProperty("format", "Standard"); add("cards", rows(t.third, names)) }) } })
        }
        Progress.setForTest(state, null)
        val col = JsonParser.parseString("""{"id":"col1","name":"Mono-red aggro","format":"Standard","cards":[{"name":"Mountain","qty":22},{"name":"Monastery Swiftspear","qty":4},{"name":"Shock","qty":4}],"side":[]}""").asJsonObject
        Workspace.setForTest(listOf(UserDeck("col1", "Mono-red aggro", "Standard", col)))
    }

    private fun seat(id: String): SeatDeck {
        val (t, names) = starters.first { "starter:" + it.first.first == id }
        return SeatDeck(JsonObject().apply { addProperty("id", id); addProperty("name", t.second); addProperty("format", "Standard"); addProperty("commander", ""); add("cards", rows(t.third, names)); add("side", JsonArray()) }, "saved")
    }

    private val PASTE = "Deck\n24 Mountain\n4 Shock\n4 Lightning Strike\n4 Fanatical Firebrand\n4 Reckless Lackey\n4 Firebrand Archer\n4 Sunset Strikemaster\n4 Scytheclaw Raptor\n4 Spitfire Lagac\n4 Volley Veteran\nSideboard\n2 Shock\nMaybeboard\n1 Volley Veteran"

    @Test fun lobby() {
        setup()
        val states = listOf<Pair<String, (LobbyModel) -> Unit>>(
            "quick" to { _ -> },
            "quickpicked" to { m -> m.player = seat("starter:r") },
            "practice" to { _ -> },
            "practicepicked" to { m -> m.player = seat("starter:u"); m.inspected = "opponent" },
            "practiceboth" to { m -> m.player = seat("starter:u"); m.opponent = seat("starter:b") },
            "inspect" to { m -> m.player = seat("starter:r"); m.inspectOpen = true },
            "paste" to { m -> m.updateDraft(name = "Pasted burn", text = PASTE); kotlinx.coroutines.runBlocking { dev.cardstashy.nativeplay.ui.importPasteInto(m, online = false) } },
            "pasteused" to { m -> m.updateDraft(name = "Pasted burn", text = PASTE); kotlinx.coroutines.runBlocking { dev.cardstashy.nativeplay.ui.importPasteInto(m, online = false) }; m.candidate?.let { c -> m.inspected = "player"; m.put("player", SeatDeck(c, "import")); m.candidate = null; m.importStatus = "selected" } },
            "inspectpasted" to { m -> m.updateDraft(name = "Pasted burn", text = PASTE); kotlinx.coroutines.runBlocking { dev.cardstashy.nativeplay.ui.importPasteInto(m, online = false) }; m.candidate?.let { c -> m.put("player", SeatDeck(c, "import")) }; m.inspectOpen = true })
        RuntimeEnvironment.setQualifiers("w390dp-h2532dp-xxhdpi")
        for ((name, set) in states) {
            val m = LobbyModel(if (name.startsWith("quick") || name == "inspect") "quick" else "practice").apply { format = "Standard" }
            set(m)
            captureRoboImage(File(System.getProperty("shotsDir"), "lobby-$name.png").path) {
                LobbyScreen(m, {}, {}, {}, {}, {}, online = false)
            }
        }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }
}
