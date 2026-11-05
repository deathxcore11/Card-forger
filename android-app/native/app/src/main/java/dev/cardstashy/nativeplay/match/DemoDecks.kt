package dev.cardstashy.nativeplay.match

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/** The two demo decks bundled with the test app (decks/demo-decks.json). App data, not engine data. */
data class DemoDeck(val id: String, val name: String, val colour: String, val face: String, val cards: List<Pair<String, Int>>) {
    val count get() = cards.sumOf { it.second }
}

/** Forge's CPU levels (play-forge-cpu-policy.js): Medium keeps its admitted v1 identity, shown as Normal. */
val CPU_POLICIES = mapOf("Easy" to "forge-heuristic-easy-beta-v2", "Medium" to "forge-heuristic-medium-beta-v1", "Hard" to "forge-heuristic-hard-beta-v2")

/** The web's podDeck: a pod seat travels as the rows Forge reads, so four full decks stay under the size limit. */
private val POD_ROW = listOf("name", "qty", "set", "setCode", "collectorNumber", "collector_number", "foil", "finish")
fun podDeck(deck: JsonObject): JsonObject = JsonObject().apply {
    deck.get("format")?.let { add("format", it) }
    for (k in listOf("name", "commander", "companion")) deck.get(k)?.takeIf { !it.isJsonNull }?.let { add(k, it) }
    fun rows(a: JsonArray) = JsonArray().apply { a.forEach { r -> add(if (r is JsonObject) JsonObject().also { o -> POD_ROW.forEach { k -> r.get(k)?.takeIf { !it.isJsonNull }?.let { o.add(k, it) } } } else r) } }
    add("cards", rows(deck.getAsJsonArray("cards") ?: JsonArray()))
    for (k in listOf("side", "commanders")) deck.getAsJsonArray(k)?.takeIf { it.size() > 0 }?.let { add(k, rows(it)) }
    deck.getAsJsonArray("errors")?.takeIf { it.size() > 0 }?.let { add("errors", it) }
}

/**
 * The web's exactForgeInput: both decks whole with every name in Forge's spelling and the match format on
 * each seat ("Standard Brawl" is Forge's "Brawl"). Quick Play is always Normal with a random first player;
 * Practice picks the level, who goes first ("first" / "second" / "random") and, in Commander, up to two more
 * CPU seats with their own decks and levels. The seats reach Forge as "You" and "CPU" (CPU 2, CPU 3 in a
 * pod): deck names stay on the versus plate and never reach Forge's lines.
 */
fun forgeInput(format: String, you: JsonObject, cpu: JsonObject, level: String = "Medium", startingPlayer: String = "random",
               quick: Boolean = true, extras: List<Pair<JsonObject, String>> = emptyList(), setup: JsonObject? = null): String {
    require(level in CPU_POLICIES) { "Choose Easy, Normal or Hard." }
    require(startingPlayer in setOf("random", "first", "second"))
    require(extras.isEmpty() || (format == "Commander" && !quick && extras.size <= 2)) { "A pod is Commander Practice with up to 3 CPUs." }
    // A lesson's match setup (host PR #121's setup.stack + noMulligan): CPU matches only, never a pod, with a chosen first player.
    require(setup == null || (extras.isEmpty() && !quick)) { "A match setup is for a Story lesson against one CPU." }
    val f = if (format == "Standard Brawl") "Brawl" else format
    fun seat(d: JsonObject, name: String) = EngineNames.deck(d).apply { addProperty("format", f); addProperty("name", name) }
    val pod = extras.isNotEmpty()
    val input = JsonObject().apply {
        addProperty("format", f)
        add("humanDeck", seat(you, "You").let { if (pod) podDeck(it) else it })
        add("opponentDeck", seat(cpu, "CPU").let { if (pod) podDeck(it) else it })
        addProperty("difficultyPolicyVersion", CPU_POLICIES.getValue(if (quick) "Medium" else level))
        addProperty("startingPlayer", if (quick) "random" else startingPlayer); addProperty("playStyle", if (quick) "quick" else "practice")
        setup?.let { add("setup", it) }
        if (pod) add("extraOpponents", JsonArray().apply { extras.forEachIndexed { i, (d, lv) ->
            add(JsonObject().apply { add("deck", podDeck(seat(d, "CPU ${i + 2}"))); addProperty("difficultyPolicyVersion", CPU_POLICIES[lv] ?: CPU_POLICIES.getValue("Medium")) })
        } })
    }
    return JsonObject().apply { add("input", input) }.toString()
}

/** Quick Play: Normal CPU, random first player. */
fun quickInput(format: String, you: JsonObject, cpu: JsonObject): String = forgeInput(format, you, cpu)

class DemoDecks(val format: String, val decks: List<DemoDeck>, val homeArt: List<String>, private val art: Map<String, String>) {
    /** Asset path of a card image: the full card, or its art crop. */
    fun image(name: String, crop: Boolean = false): String? = art[name]?.let { "cards/$it" + if (crop) ".art.jpg" else ".jpg" }

    /** A demo deck as a saved-deck object (the shape the web sends Forge). */
    fun seat(d: DemoDeck): JsonObject = JsonObject().apply {
        addProperty("schema", 1); addProperty("id", d.id); addProperty("name", d.name); addProperty("format", format)
        add("cards", JsonArray().apply { d.cards.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } })
        add("side", JsonArray())
    }

    fun matchInput(you: DemoDeck, cpu: DemoDeck): String = quickInput(format, seat(you), seat(cpu))

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
