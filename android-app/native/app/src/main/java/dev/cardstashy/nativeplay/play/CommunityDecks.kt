package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * The lobby's Community source (app.js A.playLoadSource, community branch): decks your accepted friends show on their
 * profiles (first 12 friends), each an independent copy made by community-profile.js sharedDeckCopy.
 */
object CommunityDecks {
    data class Shared(val key: String, val deck: JsonObject, val detail: String)
    data class Loaded(val decks: List<Shared>, val message: String)

    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString

    /** sharedDeckCopy for a Magic deck: needs deckSchema 1, a format, and every card matched (id and name). */
    fun sharedDeckCopy(item: JsonObject, id: String): JsonObject {
        val format = (item.s("format") ?: "").take(60)
        if (item.s("kind") != "deck" || item.get("deckSchema")?.takeIf { it.isJsonPrimitive }?.asDouble != 1.0 || format.isEmpty())
            throw IllegalStateException("Ask the owner to update this shared deck before copying it.")
        val cards = item.getAsJsonArray("cards")?.take(5000)?.mapNotNull { it as? JsonObject } ?: emptyList()
        if (cards.isEmpty() || cards.any { (it.s("id") ?: "").isEmpty() || (it.s("name") ?: "Card").isEmpty() })
            throw IllegalStateException("This deck has unmatched cards. Ask the owner to update it.")
        fun qty(c: JsonObject) = (c.get("qty")?.takeIf { it.isJsonPrimitive }?.asString?.toDoubleOrNull() ?: 1.0).let { if (it.isNaN() || it == 0.0) 1.0 else it }.let { Math.floor(it).toInt().coerceIn(1, 999) }
        fun zone(c: JsonObject) = c.s("zone").takeIf { it in listOf("main", "extra", "side") } ?: "main"
        fun rows(z: String) = JsonArray().apply { cards.filter { zone(it) == z }.forEach { c -> add(JsonObject().apply { addProperty("name", (c.s("name") ?: "Card").take(200)); addProperty("qty", qty(c)) }) } }
        val color = item.getAsJsonObject("appearance").s("color")?.takeIf { Regex("^#[a-fA-F\\d]{6}$").matches(it) } ?: ""
        val image = item.getAsJsonObject("appearance").s("image")?.takeIf { Regex("^(https://|img/)").containsMatchIn(it) } ?: ""
        return JsonObject().apply {
            addProperty("id", id); addProperty("name", (item.s("title") ?: "Untitled").take(100)); addProperty("format", format)
            add("boxAppearance", JsonObject().apply { addProperty("color", color.ifEmpty { "#7664a0" }); addProperty("image", image) })
            addProperty("locked", false); addProperty("createdAt", java.time.Instant.now().toString())
            add("source", JsonObject().apply { addProperty("kind", "Community copy"); addProperty("description", "Independent copy of a shared deck.") })
            addProperty("commander", (item.s("commander") ?: "").take(200)); addProperty("strategy", "Auto")
            add("cards", rows("main")); add("side", rows("side")); add("versions", JsonArray())
        }
    }

    suspend fun load(): Loaded = coroutineScope {
        val overview = Account.community("overview")
        val friends = overview.getAsJsonArray("people")?.mapNotNull { it as? JsonObject }?.filter { it.s("relationship") == "accepted" } ?: emptyList()
        val profiles = friends.take(12).map { p -> async { runCatching { Account.community("profile", JsonObject().apply { addProperty("target", p.s("id")) }) to p } } }.awaitAll()
        val loaded = ArrayList<Shared>(); var unavailable = 0
        for (r in profiles) {
            val (profile, person) = r.getOrElse { unavailable++; null } ?: continue
            for (item in profile.getAsJsonArray("items")?.mapNotNull { it as? JsonObject } ?: emptyList()) {
                if (item.s("kind") != "deck" || item.s("game") != "mtg") continue
                try {
                    val itemKey = (item.s("key") ?: "").take(150)
                    val deck = sharedDeckCopy(item, "play-community:" + person.s("id") + ":" + itemKey)
                    val author = profile.s("username")?.ifBlank { null } ?: profile.s("display_name")?.ifBlank { null } ?: person.s("username")?.ifBlank { null } ?: "Community player"
                    deck.getAsJsonObject("source").addProperty("author", author)
                    loaded += Shared(person.s("id") + ":" + itemKey, deck, "Shared by $author")
                } catch (_: Exception) { unavailable++ }
            }
        }
        Loaded(loaded, "${loaded.size} shared decks loaded" + (if (friends.size > 12) " · Showing decks from your first 12 friends" else "") +
            (if (unavailable > 0) " · $unavailable shared lists could not be loaded" else "") + ". Public showcase is coming later.")
    }
}
