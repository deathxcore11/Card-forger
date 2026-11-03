package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
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

/** The Shop hub's three tabs and one set's page, on the Fold's cover screen, drawn tall so the scroll shows. */
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
            add("cards", cards); add("shop", shop); add("config", JsonObject()); add("secretLair", sl); add("counters", JsonObject())
        }
    }

    @Test fun hub() {
        Progress.setForTest(state(), null)
        rule.setContent { ShopRoute(onBack = {}, nav = { PlayNav(PlayTab.SHOP, {}) }) }
        settle(); shot("sets")
        rule.onNodeWithText("Your packs · 4").performClick(); settle(10); shot("packs")
        rule.onNodeWithText("Forge").performClick(); settle(10); shot("forge")
    }

    @Test fun set() {
        Progress.setForTest(state(), null)
        rule.setContent { ShopRoute(onBack = {}, startSet = "fra", nav = { PlayNav(PlayTab.SHOP, {}) }) }
        settle(60); shot("set-fra")
    }
}
