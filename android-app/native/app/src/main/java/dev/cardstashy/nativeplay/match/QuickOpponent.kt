package dev.cardstashy.nativeplay.match

import com.google.gson.JsonArray
import com.google.gson.JsonObject

/**
 * play-quick-match.js chooseQuickOpponent, line for line: any complete list in the player's format from every
 * source, picked uniformly at random; a different list whenever one exists (the same cards under another record
 * is still a mirror); difficulty never changes which list. Error texts are the site's.
 */
object QuickOpponent {
    data class Result(val deck: JsonObject, val candidateCount: Int, val mirror: Boolean, val reason: String)
    class NoOpponent(message: String) : Exception(message)

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    private fun names(a: JsonArray?) = a?.map { e -> (if (e.isJsonPrimitive) e.asString else (e as? JsonObject)?.s("name") ?: "") } ?: emptyList()

    private fun listKey(d: JsonObject) = listOf(d.s("format"), d.s("commander"), names(d.getAsJsonArray("commanders")).toString(),
        d.getAsJsonArray("cards")?.toString() ?: "[]", d.getAsJsonArray("side")?.toString() ?: "[]").joinToString("\u0001")

    private fun cardsKey(d: JsonObject): String {
        val leaders = (listOf(d.s("commander")) + names(d.getAsJsonArray("commanders"))).map { it.lowercase() }.sorted()
        val zones = listOf("cards", "side").map { z ->
            val total = LinkedHashMap<String, Double>()
            d.getAsJsonArray(z)?.forEach { r -> val o = r as? JsonObject ?: return@forEach
                val n = o.s("name").trim().lowercase(); val q = o.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0; total[n] = (total[n] ?: 0.0) + q }
            total.filter { it.value > 0 }.map { (n, q) -> n + "×" + (if (q == Math.floor(q)) q.toLong().toString() else q.toString()) }.sorted()
        }
        return (listOf(leaders) + zones).toString()
    }

    fun choose(player: JsonObject, candidates: List<JsonObject>, eligible: (JsonObject) -> Boolean, random: () -> Double = Math::random,
               nativeValidationPending: Boolean = true): Result {
        if (!eligible(player)) throw NoOpponent("Your selected deck needs play-support review before Quick Play.")
        val seen = HashSet<String>(); val rows = ArrayList<Pair<JsonObject, String>>()
        for (deck in candidates) {
            if (deck.s("format") != player.s("format")) continue
            val key = listKey(deck); if (key in seen || !eligible(deck)) continue
            seen += key; rows += deck to key
        }
        if (rows.isEmpty()) throw NoOpponent("No compatible CPU deck is available in this format yet. Choose another source in Practice.")
        val ownKey = listKey(player); val ownCards = cardsKey(player); val pid = player.s("id")
        val others = rows.filter { (d, k) -> k != ownKey && cardsKey(d) != ownCards && !(pid.isNotEmpty() && d.s("id") == pid) }
        if (others.isEmpty()) throw NoOpponent("Quick Play needs a different deck for the CPU in this format. Load Precons or Meta, or pick the CPU deck in Practice.")
        val pick = minOf(others.size - 1, Math.floor(maxOf(0.0, random()) * others.size).toInt())
        val selected = others[pick].first; val mirror = cardsKey(selected) == ownCards
        return Result(selected.deepCopy(), others.size, mirror, (if (mirror) "CPU will use the same card list as you. " else "") +
            "Picked at random from ${others.size} deck${if (others.size == 1) "" else "s"} in your format." + if (nativeValidationPending) " Both full lists are checked when the match opens." else "")
    }
}
