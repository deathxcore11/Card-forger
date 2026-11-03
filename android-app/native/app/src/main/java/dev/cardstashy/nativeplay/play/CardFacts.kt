package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

/**
 * The web's createCardFacts().card (play-econ-cards.js): each Play card's type, colours, mana value,
 * art and its slim Scryfall printing, by oracle id, from Scryfall /cards/collection (75 a request),
 * kept on the device. Public card data only: never prices, never account data.
 */
object CardFacts {
    /** cardFact(): o oracle, t type line, m mana value, k colour identity, i image, a art crop, mc mana cost, card the slim printing. */
    data class Fact(val o: String, val t: String, val m: Double, val k: String, val i: String, val a: String, val mc: String, val card: JsonObject)

    private const val SCRYFALL = "https://api.scryfall.com"
    private val KEYS = listOf("id", "oracle_id", "name", "set", "set_name", "set_type", "collector_number", "rarity", "color_identity", "colors", "type_line", "mana_cost", "cmc",
        "oracle_text", "flavor_text", "artist", "power", "toughness", "loyalty", "finishes", "frame", "frame_effects", "border_color", "security_stamp", "full_art", "layout",
        "promo_types", "released_at", "image_uris", "card_faces", "legalities", "edhrec_rank", "reserved", "game_changer", "scryfall_uri", "keywords")
    val cards = MutableStateFlow<Map<String, Fact>>(emptyMap())
    /** Exact printings by Scryfall id (the copy a Trunk tile shows, a printing picked on Overview). */
    val prints = MutableStateFlow<Map<String, JsonObject>>(emptyMap())
    private var file: File? = null
    private val tried = HashSet<String>()
    private val lock = Mutex()

    fun init(context: Context) {
        if (file != null) return
        file = File(context.filesDir, "card-facts.json")
        try {
            val o = JsonParser.parseString(file!!.readText()).asJsonObject
            val list = o.getAsJsonArray("cards").mapNotNull { it as? JsonObject }
            cards.value = list.associate { val f = fact(it); f.o to f }
            prints.value = list.associate { it.s("id") to it }
        } catch (_: Exception) {}
    }

    fun card(oracle: String?): Fact? = oracle?.let { cards.value[it] }
    fun print(id: String?): JsonObject? = id?.let { prints.value[it] }

    fun slim(c: JsonObject): JsonObject = JsonObject().also { out ->
        for (k in KEYS) c.get(k)?.let { out.add(k, it.deepCopy()) }
        c.getAsJsonObject("image_uris")?.let { u -> out.add("image_uris", JsonObject().apply { u.get("normal")?.let { add("normal", it) }; u.get("art_crop")?.let { add("art_crop", it) }; u.get("png")?.let { add("png", it) } }) }
        c.getAsJsonArray("card_faces")?.let { faces -> out.add("card_faces", JsonArray().apply { faces.forEach { f -> val fo = f as JsonObject
            add(JsonObject().apply { for (k in listOf("name", "type_line", "mana_cost", "oracle_text", "flavor_text", "artist", "power", "toughness", "loyalty", "oracle_id")) fo.get(k)?.let { add(k, it) }
                fo.getAsJsonObject("image_uris")?.let { u -> add("image_uris", JsonObject().apply { u.get("normal")?.let { add("normal", it) }; u.get("art_crop")?.let { add("art_crop", it) } }) } }) } }) }
    }

    fun fact(c: JsonObject): Fact {
        val face = c.getAsJsonArray("card_faces")?.firstOrNull() as? JsonObject
        val img = c.getAsJsonObject("image_uris") ?: face?.getAsJsonObject("image_uris")
        return Fact(c.s("oracle_id").ifBlank { face.s("oracle_id") }, c.s("type_line").ifBlank { face.s("type_line") }, c.get("cmc")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0,
            c.getAsJsonArray("color_identity")?.joinToString("") { it.asString } ?: "", img.s("normal"), img.s("art_crop"), c.s("mana_cost").ifBlank { face.s("mana_cost") }, c)
    }

    /** wantCards: oracle ids, each with the exact printing pulled when there is one. Asked once a visit. */
    suspend fun want(list: List<Pair<String, String?>>) = withContext(Dispatchers.IO) {
        lock.withLock {
            val need = list.distinctBy { it.first }.filter { (o, id) -> o.isNotBlank() && (cards.value[o] == null || (id != null && prints.value[id] == null)) && tried.add(o + ":" + (id ?: "")) }
            if (need.isEmpty()) return@withLock
            for (chunk in need.chunked(75)) {
                val ids = JsonArray().apply { chunk.forEach { (o, id) -> add(JsonObject().apply { if (id != null && Regex("^[0-9a-f-]{36}$", RegexOption.IGNORE_CASE).matches(id)) addProperty("id", id) else addProperty("oracle_id", o) }) } }
                val body = runCatching { Http.call("POST", "$SCRYFALL/cards/collection", mapOf("Accept" to "application/json", "Content-Type" to "application/json"),
                    JsonObject().apply { add("identifiers", ids) }.toString(), 15_000) as? JsonObject }.getOrNull() ?: continue
                add(body.getAsJsonArray("data")?.mapNotNull { it as? JsonObject } ?: emptyList())
            }
            save()
        }
    }

    /** One exact printing (the card sheet's), fetched by id when it is not known yet. */
    suspend fun wantPrint(id: String): JsonObject? = prints.value[id] ?: withContext(Dispatchers.IO) {
        runCatching { Http.call("GET", "$SCRYFALL/cards/$id", mapOf("Accept" to "application/json"), null, 12_000) as? JsonObject }.getOrNull()?.let { add(listOf(it)); save(); prints.value[id] }
    }

    fun add(list: List<JsonObject>) {
        val slim = list.map { slim(it) }
        cards.value = cards.value + slim.map { fact(it) }.filter { it.o.isNotBlank() }.associateBy { it.o }
        prints.value = prints.value + slim.filter { it.s("id").isNotBlank() }.associateBy { it.s("id") }
    }

    private fun save() {
        val all = (prints.value.values + cards.value.values.map { it.card }).distinctBy { it.s("id") }
        runCatching { file?.writeText(JsonObject().apply { add("cards", JsonArray().apply { all.forEach { add(it) } }) }.toString()) }
    }

    /** For screenshots and tests: known printings without the network. */
    fun seed(list: List<JsonObject>) = add(list)

    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
}
