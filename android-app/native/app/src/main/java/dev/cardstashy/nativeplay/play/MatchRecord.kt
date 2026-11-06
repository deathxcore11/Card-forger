package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * play-match-record.js: finished Forge matches, kept on this device per account (account-scope.js privateKey), the last 300.
 * recordMatch keeps one row a match (win, loss or draw); quickStreak reads Quick Play form in one format for the next CPU pick.
 * The Chronicle page isn't kept yet (the native table has no match-facts chronicle), so rows carry chronicle null, as the site's
 * cleanChronicle(null) does.
 */
object MatchRecord {
    private const val KEY = "cardstashy-play-record-v1"
    private const val LIMIT = 300
    private val OUTCOMES = listOf("win", "loss", "draw")

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences("play-record", Context.MODE_PRIVATE)
    /** account-scope.js privateKey: the key, then the signed-in account. */
    private fun scoped(user: String?) = if (user.isNullOrBlank()) KEY else "$KEY::account:$user"
    private fun text(v: String?, n: Int = 160) = v?.trim()?.take(n) ?: ""
    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString

    /** deckRecordKey: the deck's id, else its name. */
    fun deckRecordKey(deck: JsonObject?): String? {
        val id = deck?.get("id")?.takeIf { it.isJsonPrimitive }?.asString
        return if (id != null) "id:$id" else text(deck.s("name")).takeIf { it.isNotEmpty() }?.let { "name:" + it.lowercase() }
    }

    fun history(context: Context, user: String?): List<JsonObject> = runCatching {
        val rows = JsonParser.parseString(prefs(context).getString(scoped(user), null) ?: "[]")
        if (!rows.isJsonArray) emptyList() else rows.asJsonArray.mapNotNull { (it as? JsonObject)?.takeIf { r -> r.s("outcome") in OUTCOMES } }
    }.getOrDefault(emptyList())

    /** recordMatch: one finished match; an outcome other than win, loss or draw, or a deck with no id or name, is not recorded. */
    fun record(context: Context, user: String?, outcome: String, deck: JsonObject?, opponent: JsonObject?, format: String?, playStyle: String?,
               onPlay: Boolean?, turns: Int?, life: Int?, opponentLife: Int?, durationMs: Long?, conceded: Boolean, now: Long = System.currentTimeMillis()): JsonObject? {
        if (outcome !in OUTCOMES) return null
        val key = deckRecordKey(deck) ?: return null
        val row = JsonObject().apply {
            addProperty("at", now); addProperty("outcome", outcome)
            add("deck", JsonObject().apply { addProperty("key", key); addProperty("name", text(deck.s("name"))) })
            add("opponent", JsonObject().apply { addProperty("key", deckRecordKey(opponent)); addProperty("name", text(opponent.s("name"))) })
            addProperty("format", text(format, 80)); addProperty("playStyle", text(playStyle, 20)); addProperty("onPlay", onPlay)
            addProperty("turns", turns); addProperty("life", life); addProperty("opponentLife", opponentLife); addProperty("durationMs", durationMs)
            addProperty("conceded", conceded); add("chronicle", null)
        }
        val rows = (history(context, user) + row).takeLast(LIMIT)
        runCatching { prefs(context).edit().putString(scoped(user), JsonArray().apply { rows.forEach { add(it) } }.toString()).apply() }
        return row
    }

    /**
     * quickStreak: Quick Play form in one format, newest matches last. Two or more straight wins (or losses) lean the next CPU deck
     * stronger (or weaker) by 5 rank points per extra result, capped at 15. A draw ends the run; conceded games don't count.
     */
    fun quickStreak(context: Context, user: String?, format: String): Int = quickStreak(history(context, user), format)

    fun quickStreak(history: List<JsonObject>, format: String): Int {
        val rows = history.filter { it.s("playStyle") == "quick" && it.s("format") == format && it.get("conceded")?.takeIf { c -> c.isJsonPrimitive }?.asBoolean != true }
        var run = 0; var kind: String? = null
        for (i in rows.indices.reversed()) { val o = rows[i].s("outcome"); if (o == "draw") break; if (kind == null) kind = o; if (o != kind) break; run++ }
        return if (run < 2) 0 else minOf(15, 5 * (run - 1)) * (if (kind == "win") 1 else -1)
    }
}
