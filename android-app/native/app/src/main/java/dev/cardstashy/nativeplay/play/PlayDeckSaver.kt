package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks as Workspace
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * play-deck-sources.js createPlayDeckSaver + preparePlayDeckSave, and app.js playSaver's writeDeck: Save deck copies a
 * temporary lobby list (pasted, precon, meta, community, random) into Your decks with a fresh id, unlocked, no
 * versions, then withSnapshot(deck, 'Saved from Play'). One save per exact list; a list already saved is not saved again.
 */
object PlayDeckSaver {
    private val FORMATS = listOf("Standard", "Commander", "Modern", "Pioneer", "Legacy", "Vintage", "Pauper", "Standard Brawl")
    private var scopeKey: String? = null
    private val saved = HashMap<String, String>()
    private val pending = HashMap<String, CompletableDeferred<String>>()
    private val _version = MutableStateFlow(0)
    /** Bumps whenever a save starts or ends, so the lobby redraws Save deck / Saving deck… / Saved. */
    val version: StateFlow<Int> = _version

    private fun s(o: JsonObject?, k: String) = o?.get(k)?.takeIf { it.isJsonPrimitive }?.asString
    /** playDeckSaveKey: name, format, commander, commanders, cards, side, price picks, source. */
    fun key(d: JsonObject) = listOf(s(d, "name"), s(d, "format"), s(d, "commander"), (d.get("commanders") ?: JsonArray()).toString(),
        d.get("cards")?.toString(), (d.get("side") ?: JsonArray()).toString(), d.get("referencePriceSelections")?.toString(), d.get("source")?.toString()).toString()

    private fun scope(): Boolean {
        val s = Account.session.value; val k = s?.userId ?: ""
        if (k != scopeKey) { scopeKey = k; saved.clear(); pending.clear() }
        return s != null
    }

    fun savedId(deck: JsonObject?): String? {
        if (!scope() || deck == null) return null
        val k = key(deck); val lists = Workspace.decks.value ?: emptyList()
        lists.firstOrNull { it.id == s(deck, "id") && key(it.raw) == k }?.let { return it.id }
        val id = saved[k] ?: return null
        return if (lists.any { it.id == id && key(it.raw) == k }) id else null
    }
    fun isSaving(deck: JsonObject?): Boolean { scope(); return deck != null && pending.containsKey(key(deck)) }

    /** preparePlayDeckSave. */
    fun prepare(deck: JsonObject, id: String): JsonObject {
        fun bad(r: com.google.gson.JsonElement) = (r as? JsonObject)?.let { o -> s(o, "name").isNullOrBlank() || (o.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0).let { q -> q < 1 || q != Math.floor(q) } } ?: true
        if (s(deck, "format") !in FORMATS || s(deck, "name").isNullOrBlank() || deck.get("cards")?.isJsonArray != true ||
            (deck.get("side") != null && deck.get("side")?.isJsonArray != true) ||
            (deck.getAsJsonArray("cards") + (deck.getAsJsonArray("side") ?: JsonArray())).any(::bad)) throw IllegalStateException("This list needs review before it can be saved.")
        return deck.deepCopy().apply { addProperty("id", id); addProperty("locked", false); add("versions", JsonArray()) }
    }

    /** insights.js withSnapshot on a deck with no versions: one snapshot labelled [label]. */
    private fun withSnapshot(d: JsonObject, label: String) = d.apply {
        fun rows(k: String) = JsonArray().apply { d.getAsJsonArray(k)?.forEach { r -> (r as? JsonObject)?.let { o -> add(JsonObject().apply { add("name", o.get("name")); add("qty", o.get("qty")) }) } } }
        getAsJsonArray("versions").add(JsonObject().apply {
            addProperty("id", java.util.UUID.randomUUID().toString()); addProperty("label", label.take(80)); addProperty("date", java.time.Instant.now().toString())
            addProperty("commander", s(d, "commander") ?: ""); add("cards", rows("cards")); add("side", rows("side")) })
    }

    suspend fun save(context: Context, deck: JsonObject): String {
        if (!scope()) throw IllegalStateException("Sign in before saving a deck.")
        val start = scopeKey
        savedId(deck)?.let { return it }
        val k = key(deck)
        pending[k]?.let { return it.await() }
        val copy = prepare(deck, java.util.UUID.randomUUID().toString())
        val job = CompletableDeferred<String>(); pending[k] = job; _version.value++
        try {
            val error = Workspace.update(context) { decks -> decks.apply { add(withSnapshot(copy, "Saved from Play")) } }
            if (error != null) throw IllegalStateException(error)
            scope(); if (scopeKey != start) throw IllegalStateException("The account changed while saving. Review Your decks in the original account.")
            saved[k] = s(copy, "id")!!; job.complete(s(copy, "id")!!); return s(copy, "id")!!
        } catch (e: Exception) { job.completeExceptionally(e); throw e }
        finally { pending.remove(k); _version.value++ }
    }
}
