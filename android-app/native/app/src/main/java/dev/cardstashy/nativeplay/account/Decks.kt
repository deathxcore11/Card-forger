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
    /** The account's saved online lists (workspace data.references): the Play lobby offers them under Community. */
    private val _references = MutableStateFlow<List<JsonObject>>(emptyList()); val references: StateFlow<List<JsonObject>> = _references
    private fun refs(data: JsonObject?) = data?.getAsJsonArray("references")?.mapNotNull { it as? JsonObject } ?: emptyList()
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
            val disk = JsonParser.parseString(file.readText()).asJsonObject
            _decks.value = parse(disk); _references.value = refs(disk)
            timings.value = timings.value + ("decksFromDisk" to System.currentTimeMillis() - t0)
        } catch (_: Exception) {}
        try {
            val token = Account.token() ?: run { _error.value = "Sign in again to load your decks."; return@withContext }
            val rows = Http.call("GET", "${Account.URL}/rest/v1/workspaces?select=data,revision&user_id=eq.${s.userId}",
                mapOf("apikey" to Account.KEY, "Authorization" to "Bearer $token"), timeoutMs = 15000)?.asJsonArray
            val data = rows?.firstOrNull()?.asJsonObject?.getAsJsonObject("data")
            // Only the decks and saved online lists are kept on this device.
            val slim = JsonObject().apply { add("decks", data?.getAsJsonArray("decks") ?: JsonArray()); add("references", data?.getAsJsonArray("references") ?: JsonArray()) }
            file.writeText(slim.toString())
            _decks.value = parse(slim); _references.value = refs(slim); _error.value = null
            timings.value = timings.value + ("decksFromAccount" to System.currentTimeMillis() - t0)
        } catch (e: Exception) {
            if (_decks.value == null) _error.value = "Couldn’t load your decks. Check your connection."
        }
    }

    /**
     * The web's revision-checked save (cloud.js): read the whole account copy fresh, change only its
     * Magic decks, and write it back only if nobody saved in between (revision = what we read). On a
     * clash the fresh copy is read again and the change re-applied once; a second clash gives up with
     * no write. Never inserts a first copy (the web owns that) and never touches anything but data.decks.
     */
    suspend fun update(context: Context, change: (JsonArray) -> JsonArray): String? = withContext(Dispatchers.IO) {
        val s = Account.session.value ?: return@withContext "Sign in to save decks."
        repeat(2) {
            val token = Account.token() ?: return@withContext "Sign in again to save decks."
            val auth = mapOf("apikey" to Account.KEY, "Authorization" to "Bearer $token")
            val row = Http.call("GET", "${Account.URL}/rest/v1/workspaces?select=data,revision&user_id=eq.${s.userId}", auth)?.asJsonArray?.firstOrNull()?.asJsonObject
                ?: return@withContext "Your account copy isn’t set up yet. Open CardStashy on the web once, then try again."
            val revision = row.get("revision").asLong
            val data = row.getAsJsonObject("data") ?: JsonObject()
            data.add("decks", change(data.getAsJsonArray("decks")?.deepCopy() ?: JsonArray()))
            val body = JsonObject().apply { add("data", data); addProperty("revision", revision + 1); addProperty("device", ("Android · " + java.text.DateFormat.getDateInstance(java.text.DateFormat.SHORT).format(java.util.Date())).take(120)) }
            val out = Http.call("PATCH", "${Account.URL}/rest/v1/workspaces?user_id=eq.${s.userId}&revision=eq.$revision&select=revision",
                auth + ("Prefer" to "return=representation"), body.toString())?.asJsonArray
            if (out != null && out.size() > 0) {
                _decks.value = parse(data)
                _references.value = refs(data)
                try { cacheFile(context, s.userId).writeText(JsonObject().apply { add("decks", data.getAsJsonArray("decks")); add("references", data.getAsJsonArray("references") ?: JsonArray()) }.toString()) } catch (_: Exception) {}
                return@withContext null
            }
        }
        "Your decks changed on another device. Reload and try again."
    }

    fun clear() { _decks.value = null; _error.value = null; _references.value = emptyList() }
    internal fun setForTest(list: List<UserDeck>?) { _decks.value = list }
}
