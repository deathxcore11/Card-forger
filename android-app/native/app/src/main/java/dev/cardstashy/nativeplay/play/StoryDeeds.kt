package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * Story deeds (story-deeds.js + match-facts.js factsMeet): each battle deed is a data test over the facts the table showed you;
 * the app reports the ones a win earned and the server re-checks and pays each once. The data is generated from the web's own module
 * (scripts/export-story-deeds.mjs), so a deed added on the site reaches the app with the next asset build.
 */
class StoryDeeds(json: JsonObject) {
    class Deed(val id: String, val act: Int, val battle: String, val title: String, val seat: String, val `when`: JsonObject)
    class ActDeed(val id: String, val act: Int, val kind: String, val title: String)

    val deeds: List<Deed> = json.getAsJsonArray("deeds").map { it.asJsonObject }.map {
        Deed(it["id"].asString, it["act"].asInt, it["battle"].asString, it["title"].asString, it["seat"].asString, it.getAsJsonObject("when") ?: JsonObject())
    }
    val acts: List<ActDeed> = json.getAsJsonArray("acts").map { it.asJsonObject }.map { ActDeed(it["id"].asString, it["act"].asInt, it["kind"].asString, it["title"].asString) }
    fun title(id: String): String? = deeds.firstOrNull { it.id == id }?.title ?: acts.firstOrNull { it.id == id }?.title

    /** storyDeedsEarned: the deeds one won battle earns. [facts] is MatchFacts.snapshot plus seat; [refs] the story:* refs after the win. */
    fun earned(battleId: String, seat: String, own: Boolean, facts: JsonObject, refs: List<String>): List<String> {
        val out = mutableListOf<String>()
        if (!own) deeds.filter { it.battle == battleId && it.seat == seat && meets(facts, it.`when`) }.forEach { out += it.id }
        val act = Regex("^a(\\d+)b").find(battleId)?.groupValues?.get(1)?.toIntOrNull() ?: return out
        val has = refs.toSet(); fun all(kind: String) = (1..8).all { "story:a${act}b$it:$kind" in has }
        acts.filter { it.act == act && (if (it.kind == "loaner") all("loaner") else all("clear") && all("villain")) }.forEach { out += it.id }
        return out
    }

    companion object {
        @Volatile private var cached: StoryDeeds? = null
        fun load(context: Context): StoryDeeds = cached ?: synchronized(this) {
            cached ?: StoryDeeds(JsonParser.parseString(context.assets.open("story-deeds.json").use { String(it.readBytes()) }).asJsonObject).also { cached = it }
        }

        private fun cmp(op: String, a: Double, b: Double) = when (op) { "<=" -> a <= b; ">=" -> a >= b; "==" -> a == b; "<" -> a < b; ">" -> a > b; else -> false }
        private fun any(v: JsonElement): List<String> = if (v.isJsonArray) v.asJsonArray.map { it.asString } else listOf(v.asString)
        private fun list(f: JsonObject, k: String): Set<String> = f.get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }?.toSet() ?: emptySet()
        private fun num(e: JsonElement?): Double? = e?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble

        /** factsMeet: every key must hold; a fact the match never reported (null) fails its test. */
        fun meets(f: JsonObject, w: JsonObject): Boolean {
            for ((k, rule) in w.entrySet()) {
                val mine = list(f, "myCards"); val theirs = list(f, "theirCards"); val killed = list(f, "killed"); val dead = list(f, "myDead")
                when (k) {
                    "mine" -> if (!any(rule).all { it in mine }) return false
                    "mineAny" -> if (!any(rule).any { it in mine }) return false
                    "theirs" -> if (!any(rule).all { it in theirs }) return false
                    "notTheirs" -> if (any(rule).any { it in theirs }) return false
                    "notMine" -> if (any(rule).any { it in mine }) return false
                    "killed" -> if (!any(rule).all { it in killed }) return false
                    "killedAny" -> if (!any(rule).any { it in killed }) return false
                    "survived" -> if (any(rule).any { it in dead } || !any(rule).all { it in mine }) return false
                    "tribe" -> { val a = rule.asJsonArray; val got = f.getAsJsonObject("tribes")?.get(a[0].asString)?.asInt ?: 0
                        if (!cmp(a[1].asString, got.toDouble(), a[2].asDouble)) return false }
                    "onPlay" -> { val g = f.get("onPlay")?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean; if (g != rule.asBoolean) return false }
                    else -> { val (op, v) = if (rule.isJsonArray) rule.asJsonArray.let { it[0].asString to it[1].asDouble } else "==" to rule.asDouble
                        val got = num(f.get(k)) ?: return false; if (!cmp(op, got, v)) return false }
                }
            }
            return true
        }
    }
}
