package dev.cardstashy.nativeplay.match

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import java.text.Normalizer

/**
 * The web's play-engine-names.js: the one place a deck's card names become Forge's spelling
 * ("Wear/Tear" becomes "Wear // Tear", curly quotes and Æ are tidied). Nothing else changes.
 */
object EngineNames {
    private val SLASH_NAMES = setOf("summon: choco/mog", "sp//dr, piloted by peni")

    private fun tidy(name: String) = Normalizer.normalize(name, Normalizer.Form.NFC)
        .replace(Regex("[‘’ʼ]"), "'").replace(Regex("[“”]"), "\"").replace("Æ", "Ae").replace("æ", "ae")
        .replace(Regex("\\s+"), " ").trim()

    private fun canonical(name: String) = if (name.trim().lowercase() == "detect intrusion") "Spider-Sense" else name

    fun name(raw: String): String {
        val s = tidy(raw)
        if (!s.contains('/') || s.lowercase() in SLASH_NAMES) return canonical(s)
        val faces = s.split(Regex("\\s*/{1,2}\\s*"))
        return canonical(if (faces.all { it.isNotEmpty() }) faces.joinToString(" // ") else s)
    }

    /** A copy of a saved deck with every name in Forge's spelling (engineDeck). */
    fun deck(raw: JsonObject): JsonObject {
        val out = raw.deepCopy()
        for (k in listOf("cards", "side", "commanders")) out.getAsJsonArray(k)?.let { rows ->
            val mapped = JsonArray()
            rows.forEach { r -> when {
                r.isJsonPrimitive -> mapped.add(name(r.asString))
                r is JsonObject && r.get("name")?.isJsonPrimitive == true -> mapped.add(r.deepCopy().apply { addProperty("name", name(r.get("name").asString)) })
                else -> mapped.add(r)
            } }
            out.add(k, mapped)
        }
        for (k in listOf("commander", "companion")) out.get(k)?.takeIf { it.isJsonPrimitive && it.asString.isNotEmpty() }?.let { out.addProperty(k, name(it.asString)) }
        return out
    }

    /** Every card name a deck sends to Forge. */
    fun names(deck: JsonObject): Set<String> = buildSet {
        for (k in listOf("cards", "side", "commanders")) deck.getAsJsonArray(k)?.forEach { r ->
            (if (r.isJsonPrimitive) r.asString else (r as? JsonObject)?.get("name")?.asString)?.let { add(it) }
        }
        for (k in listOf("commander", "companion")) deck.get(k)?.takeIf { it.isJsonPrimitive && it.asString.isNotEmpty() }?.let { add(it.asString) }
    }
}
