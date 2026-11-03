package dev.cardstashy.nativeplay.account

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.File

/** One of your saved Magic decks, as the web saves it (workspace data.decks); the row objects are kept whole for Forge. */
data class UserDeck(val id: String, val name: String, val format: String, val raw: JsonObject) {
    val cards: JsonArray get() = raw.getAsJsonArray("cards") ?: JsonArray()
    val side: JsonArray get() = raw.getAsJsonArray("side") ?: JsonArray()
    val commander: String? get() = raw.get("commander")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }
        ?: raw.getAsJsonArray("commanders")?.firstOrNull()?.let { if (it.isJsonPrimitive) it.asString else (it as? JsonObject)?.get("name")?.asString }?.takeIf { it.isNotBlank() }
    val count: Int get() = cards.sumOf { (it as? JsonObject)?.get("qty")?.takeIf { q -> q.isJsonPrimitive }?.asInt ?: 0 }
    /** The card the deck tile shows: its commander, or its first non-land card. */
    val face: String? get() = commander ?: cards.mapNotNull { it as? JsonObject }.firstOrNull { r ->
        val n = r.get("name")?.asString ?: ""; n.isNotBlank() && !BASICS.contains(n) && r.get("type")?.asString?.contains("Land") != true
    }?.get("name")?.asString

    companion object { val BASICS = setOf("Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes") }
}

/**
 * Your decks, read from the same private workspace row the web saves (Supabase table
 * workspaces, row-level secured to you). Read-only here: nothing is written back until the
 * web's revision-checked save is ported, so this app can never overwrite the account copy.
 * The last copy is kept on disk so the list shows at once on the next open, then refreshes.
 */
object Decks {
    /** Formats the bundled Forge plays (play-econ-rules.js PLAY_FORMATS). */
    val PLAYABLE = listOf("Standard", "Pioneer", "Modern", "Legacy", "Vintage", "Pauper", "Commander")

    private val _decks = MutableStateFlow<List<UserDeck>?>(null); val decks: StateFlow<List<UserDeck>?> = _decks
    private val _error = MutableStateFlow<String?>(null); val error: StateFlow<String?> = _error
    val timings = MutableStateFlow<Map<String, Long>>(emptyMap())

    private fun cacheFile(context: Context, user: String) = File(context.filesDir, "workspace-$user.json")

    fun parse(workspace: JsonObject?): List<UserDeck> {
        val list = workspace?.getAsJsonArray("decks") ?: return emptyList()
        return list.mapNotNull { e ->
            val o = e as? JsonObject ?: return@mapNotNull null
            val cards = o.getAsJsonArray("cards") ?: return@mapNotNull null
            if (cards.size() == 0) return@mapNotNull null
            UserDeck(o.get("id")?.asString ?: return@mapNotNull null, o.get("name")?.asString?.takeIf { it.isNotBlank() } ?: "Untitled deck",
                o.get("format")?.takeIf { it.isJsonPrimitive }?.asString ?: "", o)
        }
    }

    /** Shows the disk copy at once (if any), then the account copy. */
    suspend fun load(context: Context) = withContext(Dispatchers.IO) {
        val s = Account.session.value ?: run { _decks.value = null; return@withContext }
        val t0 = System.currentTimeMillis()
        val file = cacheFile(context, s.userId)
        if (_decks.value == null && file.isFile) try {
            _decks.value = parse(JsonParser.parseString(file.readText()).asJsonObject)
            timings.value = timings.value + ("decksFromDisk" to System.currentTimeMillis() - t0)
        } catch (_: Exception) {}
        try {
            val token = Account.token() ?: run { _error.value = "Sign in again to load your decks."; return@withContext }
            val rows = Http.call("GET", "${Account.URL}/rest/v1/workspaces?select=data,revision&user_id=eq.${s.userId}",
                mapOf("apikey" to Account.KEY, "Authorization" to "Bearer $token"), timeoutMs = 15000)?.asJsonArray
            val data = rows?.firstOrNull()?.asJsonObject?.getAsJsonObject("data")
            // Only the decks are kept on this device.
            val slim = JsonObject().apply { add("decks", data?.getAsJsonArray("decks") ?: JsonArray()) }
            file.writeText(slim.toString())
            _decks.value = parse(slim); _error.value = null
            timings.value = timings.value + ("decksFromAccount" to System.currentTimeMillis() - t0)
        } catch (e: Exception) {
            if (_decks.value == null) _error.value = "Couldn’t load your decks. Check your connection."
        }
    }

    fun clear() { _decks.value = null; _error.value = null }
}
