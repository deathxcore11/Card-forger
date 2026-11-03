package dev.cardstashy.nativeplay.match

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/** The two demo decks bundled with the test app (decks/demo-decks.json). App data, not engine data. */
data class DemoDeck(val id: String, val name: String, val colour: String, val face: String, val cards: List<Pair<String, Int>>) {
    val count get() = cards.sumOf { it.second }
}

class DemoDecks(val format: String, val decks: List<DemoDeck>, val homeArt: List<String>, private val art: Map<String, String>) {
    /** Asset path of a card image: the full card, or its art crop. */
    fun image(name: String, crop: Boolean = false): String? = art[name]?.let { "cards/$it" + if (crop) ".art.jpg" else ".jpg" }

    /** The same input the web's exactForgeInput builds for Quick Play: Normal CPU, random first player. */
    fun matchInput(you: DemoDeck, cpu: DemoDeck): String {
        fun seat(d: DemoDeck) = JsonObject().apply {
            addProperty("schema", 1); addProperty("id", d.id); addProperty("name", d.name); addProperty("format", format)
            add("cards", JsonArray().apply { d.cards.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } })
            add("side", JsonArray())
        }
        val input = JsonObject().apply {
            addProperty("format", format); add("humanDeck", seat(you)); add("opponentDeck", seat(cpu))
            addProperty("difficultyPolicyVersion", "forge-heuristic-medium-beta-v1")
            addProperty("startingPlayer", "random"); addProperty("playStyle", "quick")
        }
        return JsonObject().apply { add("input", input) }.toString()
    }

    companion object {
        @Volatile private var cached: DemoDecks? = null
        fun load(context: Context): DemoDecks = cached ?: synchronized(this) {
            cached ?: run {
                val o = JsonParser.parseString(context.assets.open("demo-decks.json").use { String(it.readBytes()) }).asJsonObject
                val art = JsonParser.parseString(context.assets.open("cards/art.json").use { String(it.readBytes()) }).asJsonObject
                DemoDecks(
                    o.get("format").asString,
                    o.getAsJsonArray("decks").map { e -> val d = e.asJsonObject
                        DemoDeck(d.get("id").asString, d.get("name").asString, d.get("colour").asString, d.get("face").asString,
                            d.getAsJsonArray("cards").map { c -> c.asJsonObject.let { it.get("name").asString to it.get("qty").asInt } }) },
                    o.getAsJsonArray("homeArt").map { it.asString },
                    art.entrySet().associate { it.key to it.value.asString },
                ).also { cached = it }
            }
        }
    }
}
