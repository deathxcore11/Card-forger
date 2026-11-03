package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.match.quickInput
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/** Probe (PROBE=1): what Forge shows the human when the CPU reveals Devourer of Destiny from its opening hand. */
class RevealProbe {
    @Test fun probe() {
        assumeTrue(System.getenv("PROBE") == "1")
        val root = System.getProperty("engineRoot")
        val repo = File(System.getProperty("repoRoot"))
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString())
        System.setProperty("proof.rulesData", File(repo, "forge-rules/current").absolutePath)
        LocalEngine.init(root)
        fun deck(id: String, name: String, rows: List<Pair<String, Int>>) = JsonObject().apply {
            addProperty("id", id); addProperty("name", name); addProperty("format", "Vintage")
            add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } })
        }
        val you = deck("you", "Mine", listOf("Mountain" to 36, "Lightning Bolt" to 4, "Goblin Guide" to 4, "Monastery Swiftspear" to 4, "Lava Spike" to 4, "Rift Bolt" to 4, "Chain Lightning" to 4))
        val cpu = deck("play-meta:karn-tron", "Karn, the Great Creator · Expedition Map", listOf("Devourer of Destiny" to 4, "Wastes" to 56))
        for (seed in 1L..25L) {
            val s = LocalEngine.start(quickInput("Vintage", you, cpu), seed)
            val until = System.currentTimeMillis() + 15_000
            var found = false
            while (System.currentTimeMillis() < until && !found) {
                val raw = JsonParser.parseString(s.call("GET", "/state", null).body()).asJsonObject
                if (raw["status"]?.asString == "failed") { println("FAILED " + raw["failure"]); break }
                val p = raw["prompt"]
                if (p != null && !p.isJsonNull) { println("SEED $seed PROMPT " + p.toString().take(1500)); println("BUTTONS " + raw["buttons"] + " input=" + raw["inputType"] + " msg=" + raw["message"]); println("PLAYERS " + raw["players"].toString().take(600)); found = true }
                Thread.sleep(150)
            }
            s.close()
            if (found) break
        }
    }
}
