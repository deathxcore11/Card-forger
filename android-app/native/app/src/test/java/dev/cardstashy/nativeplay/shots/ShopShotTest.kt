package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.ui.PlayNav
import dev.cardstashy.nativeplay.ui.PlayTab
import dev.cardstashy.nativeplay.ui.ShopRoute
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The Shop's storefront, Every set, Your packs and one set's page, on the Fold's cover screen, drawn tall so the scroll shows. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h2400dp-xxhdpi")
class ShopShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 40) = repeat(n) { Thread.sleep(150); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "shop-$name.png").path)

    private fun get(url: String) = (java.net.URI(url).toURL().openConnection() as java.net.HttpURLConnection).run {
        setRequestProperty("User-Agent", "CardStashyNativeTest/1.0"); setRequestProperty("Accept", "application/json"); inputStream.bufferedReader().readText() }

    private fun state(): JsonObject {
        val shop = JsonArray().apply {
            listOf("fra" to "Reality Fracture|2026-02-06", "hob" to "The Hobbit|2026-01-23", "msh" to "Marvel Super Heroes|2026-01-09", "fin" to "Final Fantasy|2025-06-13",
                "spm" to "Marvel's Spider-Man|2025-09-26", "tla" to "Avatar: The Last Airbender|2025-11-21", "fdn" to "Foundations|2024-11-15", "dsk" to "Duskmourn: House of Horror|2024-09-27")
                .forEach { (c, v) -> add(JsonObject().apply { addProperty("code", c); addProperty("name", v.substringBefore('|')); addProperty("released", v.substringAfter('|')) }) }
        }
        // Owned: every third Reality Fracture card, so the set page shows colour and black-and-white.
        val fra = runCatching { JsonParser.parseString(get("https://api.scryfall.com/cards/search?order=set&unique=prints&q=e%3Afra")).asJsonObject.getAsJsonArray("data") }.getOrNull()
        val cards = JsonArray().apply { fra?.forEachIndexed { i, e -> if (i % 3 == 0) { val c = e.asJsonObject
            add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", c["name"].asString); addProperty("c", 1 + i % 4); add("s", JsonArray().apply { add("fra") }) }) } } }
        val sl = JsonObject().apply {
            addProperty("week", "2026-W45"); addProperty("ref", "sl:2026-W45"); addProperty("title", "Secret Lair · Apr 2024"); addProperty("by", "Art by AKQA")
            addProperty("price", 1500); addProperty("ends", java.time.Instant.now().plusSeconds(6 * 86400).toString()); addProperty("bought", false)
            add("cards", JsonArray().apply { listOf("837edd3f-5380-4c1c-8323-0e61dac385e5" to "Wastes", "bbd37785-bbef-4628-b88a-4ff28b0a7034" to "Evolving Wilds",
                "4991d066-8f4b-4b27-8ba9-bc4e2e017ed4" to "Command Tower", "c21950b7-6aff-4e48-a109-a4b385930867" to "Maze of Ith", "15106aa1-45d6-486b-9ce0-d999161fbd6e" to "Ancient Amphitheater")
                .forEach { (id, n) -> add(JsonObject().apply { addProperty("id", id); addProperty("o", id); addProperty("n", n); addProperty("r", "rare") }) } })
        }
        return JsonObject().apply {
            add("wallet", JsonParser.parseString("""{"coins":12450,"xp":2300,"seal_c":3,"seal_u":15,"seal_r":7,"seal_m":2,"starter_at":"2026-11-01T10:00:00Z"}"""))
            add("packs", JsonParser.parseString("""[{"id":"p1","set":"fra","source":"quest"},{"id":"p2","set":"fra","source":"quest"},{"id":"p3","set":"hob","source":"story"},{"id":"p4","set":"fra","source":"collector"}]"""))
            add("cards", cards); add("shop", shop); add("config", JsonObject()); add("counters", JsonObject())
            add("rewardSet", JsonParser.parseString("""{"code":"fra","name":"Reality Fracture","released":"2026-02-06"}"""))
            // The week's Secret Lair store (play-econ-route secretLairStoreOffer): twenty real printings, four on sale, one already yours.
            val slds = offers()
            add("secretLairStore", JsonObject().apply { addProperty("week", "2026-W45"); addProperty("ends", java.time.Instant.now().plusSeconds(2 * 86400 + 5 * 3600 + 120).toString())
                add("offers", JsonArray().apply { slds.forEachIndexed { i, c -> add(c.deepCopy().apply { mapOf(1 to 60, 4 to 50, 9 to 40, 14 to 25)[i]?.let { addProperty("off", it) } }) } }) })
            add("styles", JsonArray().apply { slds.getOrNull(2)?.let { c -> add(JsonObject().apply { addProperty("id", c["id"].asString); addProperty("o", c["o"].asString) }) } })
            add("preconStore", JsonParser.parseString("""{"week":"2026-W45","files":["fin-ub","fin-rw","blb-gw","blb-ur","otj-br","msc-avengers","msc-wakanda","fic-cloud","fic-yshtola","tdc-sultai"],"formats":{"Standard":["fin-ub","fin-rw"],"Pioneer":["blb-gw","blb-ur"],"Modern":["otj-br"],"Legacy":[],"Commander":["msc-avengers","msc-wakanda","fic-cloud","fic-yshtola","tdc-sultai"]},"prerelease":{"set":"msc","name":"Marvel Super Heroes Commander","releases":"2026-11-13","files":["msc-avengers","msc-wakanda"]}}"""))
        }
    }

    private var slCache: List<JsonObject>? = null
    /** Twenty Secret Lair printings from Scryfall (no basics), as the store hands them: id, oracle, name, rarity, finishes. */
    private fun offers(): List<JsonObject> = slCache ?: runCatching {
        JsonParser.parseString(get("https://api.scryfall.com/cards/search?order=released&dir=desc&unique=prints&q=" + java.net.URLEncoder.encode("e:sld -t:basic -t:token -t:emblem -is:digital", "UTF-8"))).asJsonObject
            .getAsJsonArray("data").map { it.asJsonObject }.filter { it.has("image_uris") }.take(20).map { c -> JsonObject().apply {
                addProperty("id", c["id"].asString); addProperty("o", c["oracle_id"].asString); addProperty("n", c["name"].asString); addProperty("r", c["rarity"].asString)
                add("f", c.getAsJsonArray("finishes")) } }
    }.getOrDefault(emptyList()).also { slCache = it }

    /** The store precons: the app's five starter precons with Scryfall's cards (as PlayDecksTabsShotTest builds them), as the Shop's precon list. */
    private fun precons(): dev.cardstashy.nativeplay.ui.PreconUi {
        val every = JsonParser.parseString(File(System.getProperty("repoRoot"), "data/play-starters/precons.json").readText()).asJsonObject["decks"].asJsonArray.map { it.asJsonObject }
        val all = every.filter { it["format"].asString == "Standard" }
        // The app's Commander precons stand in for the store's Commander decks (the commander as its own row, board "commander").
        val cmd = every.filter { it["format"].asString == "Commander" }
        val ids = LinkedHashMap<String, JsonObject>()
        for (p in all + cmd) for (r in p["rows"].asJsonArray.map { it.asJsonObject }) ids.putIfAbsent(r["name"].asString, JsonObject().apply { addProperty("name", r["name"].asString) })
        val cards = ids.values.chunked(75).flatMap { chunk -> Thread.sleep(120)
            val c = java.net.URI("https://api.scryfall.com/cards/collection").toURL().openConnection() as java.net.HttpURLConnection
            c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("User-Agent", "CardStashyNativeTest/1.0")
            c.outputStream.use { it.write(JsonObject().apply { add("identifiers", JsonArray().apply { chunk.forEach { add(it) } }) }.toString().toByteArray()) }
            JsonParser.parseString(c.inputStream.bufferedReader().readText()).asJsonObject["data"].asJsonArray.map { it.asJsonObject } }
        dev.cardstashy.nativeplay.ui.PreconStore.clearForTest()
        val formats = mapOf(0 to listOf("Standard", "Pioneer", "Modern"), 1 to listOf("Standard", "Pioneer"), 2 to listOf("Pioneer", "Modern"), 3 to listOf("Standard"), 4 to listOf("Modern", "Pauper"))
        val index = all.mapIndexed { i, p -> val face = cards.firstOrNull { it["name"].asString == p["face"].asString }
            val rows = p["rows"].asJsonArray.map { it.asJsonObject }.map { r -> val c = cards.firstOrNull { it["name"].asString == r["name"].asString || it["name"].asString.split(" // ")[0] == r["name"].asString }
                dev.cardstashy.nativeplay.play.Decks.Row(r["name"].asString, r["qty"].asInt, r["board"]?.asString, c?.get("set")?.asString ?: "", c?.get("collector_number")?.asString ?: "", c?.get("id")?.asString ?: "", c?.get("rarity")?.asString ?: "common") }
            dev.cardstashy.nativeplay.ui.PreconStore.summaries[p["key"].asString + ".json"] = dev.cardstashy.nativeplay.ui.PreconStore.Summary(
                (face?.get("name")?.asString ?: "") to (face?.get("id")?.asString ?: ""), listOf("W", "U", "B", "R", "G").filter { k -> (face?.getAsJsonArray("color_identity")?.map { it.asString } ?: emptyList()).contains(k) }, formats.getValue(i % 5), rows)
            dev.cardstashy.nativeplay.play.Decks.PreconEntry(p["name"].asString, (face?.get("set")?.asString ?: "").uppercase(), "Starter Kit", p["released"].asString, p["key"].asString + ".json") }
        fun card(n: String) = cards.firstOrNull { it["name"].asString == n || it["name"].asString.split(" // ")[0] == n }
        val commander = cmd.map { p -> val face = card(p["face"].asString)
            val rows = listOf(dev.cardstashy.nativeplay.play.Decks.Row(p["face"].asString, 1, "commander", rarity = face?.get("rarity")?.asString ?: "mythic")) +
                p["rows"].asJsonArray.map { it.asJsonObject }.filter { it["name"].asString != p["face"].asString }.map { r -> dev.cardstashy.nativeplay.play.Decks.Row(r["name"].asString, r["qty"].asInt, null, rarity = card(r["name"].asString)?.get("rarity")?.asString ?: "common") }
            dev.cardstashy.nativeplay.ui.PreconStore.summaries[p["key"].asString + ".json"] = dev.cardstashy.nativeplay.ui.PreconStore.Summary(
                (face?.get("name")?.asString ?: "") to (face?.get("id")?.asString ?: ""), listOf("W", "U", "B", "R", "G").filter { k -> (face?.getAsJsonArray("color_identity")?.map { it.asString } ?: emptyList()).contains(k) }, listOf("Commander"), rows)
            dev.cardstashy.nativeplay.play.Decks.PreconEntry(p["name"].asString, p["key"].asString.substringBefore('-').uppercase(), "Commander Deck", p["released"]?.asString?.ifEmpty { null } ?: "2025-04-11", p["key"].asString + ".json") }
        return dev.cardstashy.nativeplay.ui.PreconUi().apply { this.index = index; this.commander = commander }
    }
    private fun art() { dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyNativeTest/1.0") }
            .getInputStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() ?: url } }

    /** The storefront (Randall 5 Nov 18:54Z): the aisle bar, the Secret Lair showcase, the featured pack and the shelf, the store precons, the Forge. */
    @Test fun hub() {
        art(); val st = state(); Progress.setForTest(st, null); val pc = precons()
        rule.setContent { ShopRoute(onBack = {}, nav = { PlayNav(PlayTab.SHOP, {}) }, precon = pc) }
        settle(60); shot("front")
        // The per-format store (preconStore.formats): Pioneer's shelf.
        rule.onNodeWithText("Pioneer").performClick(); settle(20); shot("front-pioneer")
        rule.onAllNodesWithText("Standard")[0].performClick(); settle(20); shot("front-standard")
        rule.onNodeWithText("Every set, every year").performClick(); settle(20); shot("sets")
    }
    /** The storefront's first screen on the Fold's cover screen, as you land on it. */
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun front() {
        art(); Progress.setForTest(state(), null); val pc = precons()
        rule.setContent { ShopRoute(onBack = {}, nav = { PlayNav(PlayTab.SHOP, {}) }, precon = pc) }
        settle(60); shot("front-top")
    }
    @Test fun packs() {
        Progress.setForTest(state(), null)
        rule.setContent { ShopRoute(onBack = {}, startTab = "packs", nav = { PlayNav(PlayTab.SHOP, {}) }) }
        settle(); shot("packs")
    }

    /**
     * Randall 5 Nov 15:39Z, phone portrait: Your packs drew the old painted wrappers (the opener draws the template pack), the tab
     * "Your packs · 1730" wrapped, and "Double Masters 2022" took two lines and pushed PLAY BOOSTER off the band.
     */
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun packsPortrait() {
        val st = state().apply {
            getAsJsonArray("shop").apply { add(JsonParser.parseString("""{"code":"2x2","name":"Double Masters 2022","released":"2022-07-08"}""")); add(JsonParser.parseString("""{"code":"2ed","name":"Unlimited Edition","released":"1993-12-01"}""")) }
            add("packs", JsonArray().apply { repeat(1730) { i -> add(JsonObject().apply { addProperty("id", "p$i"); addProperty("set", listOf("2x2", "2ed", "fra", "hob")[i % 4]); addProperty("source", "quest") }) } })
        }
        Progress.setForTest(st, null)
        // The sets' template art (pack-art.json's Scryfall crops), fetched here as the app's image loader would.
        val was = dev.cardstashy.nativeplay.ui.homeArt
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() }
        try {
            rule.setContent { ShopRoute(onBack = {}, startTab = "packs", nav = { PlayNav(PlayTab.SHOP, {}) }) }
            settle(); shot("packs-portrait")
        } finally { dev.cardstashy.nativeplay.ui.homeArt = was }
    }

    /** Randall 4 Nov 17:36Z: on a regular phone all of Play is sideways (the screen, not a tall scroll). */
    @Test @Config(qualifiers = "w844dp-h390dp-xxhdpi") fun landscapePhone() {
        Progress.setForTest(state(), null)
        rule.setContent { ShopRoute(onBack = {}, nav = { PlayNav(PlayTab.SHOP, {}) }) }
        settle(); shot("land-sets")
    }

    @Test fun hubLight() {
        Progress.setForTest(state(), null); dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("light")
        try {
            rule.setContent { ShopRoute(onBack = {}, nav = { PlayNav(PlayTab.SHOP, {}) }) }
            settle(); rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "theme-light-shop-sets.png").path)
            rule.onAllNodesWithText("Forge")[0].performClick(); settle(20); rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "theme-light-shop-forge.png").path)
        } finally { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("dark") }
    }

    @Test fun set() {
        Progress.setForTest(state(), null)
        rule.setContent { ShopRoute(onBack = {}, startSet = "fra", nav = { PlayNav(PlayTab.SHOP, {}) }) }
        settle(60); shot("set-fra")
    }
}
