package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * The web's Play rule data (achievements, quests, log-in calendar, Story acts, CPU levels,
 * playmats), exported at build time from the web's own modules by scripts/export-play-rules.mjs,
 * so native and web count and show the same things. Only the small functions that read it live here.
 */
class PlayRules(o: JsonObject, storyJson: JsonObject) {
    /** Tests: the story acts come from the bundled asset on the classpath. */
    constructor(o: JsonObject) : this(o, JsonParser.parseString(PlayRules::class.java.classLoader!!.getResource("story-acts.json")!!.readText()).asJsonObject)
    data class Achievement(val id: String, val tab: String, val title: String, val lore: String, val art: String, val source: String,
                           val steps: List<Int>, val feat: Boolean, val hidden: Boolean, val riddle: String?, val unit: String?)
    data class Quest(val id: String, val label: String, val key: String, val need: Int, val level: String = "")
    data class Reward(val coins: Int = 0, val packs: Int = 0, val xp: Int = 0, val seals: Map<String, Int> = emptyMap())
    data class Act(val act: Int, val name: String, val years: String, val line: String, val art: String, val battles: Int, val sets: List<Pair<String, String>>)

    private fun str(e: JsonElement?) = e?.takeIf { it.isJsonPrimitive }?.asString
    private fun quest(e: JsonElement, level: String = "") = e.asJsonObject.let { Quest(it["id"].asString, it["label"].asString, it["key"].asString, it["need"].asInt, level) }
    private fun reward(e: JsonElement) = e.asJsonObject.let { r ->
        Reward(r["coins"]?.asInt ?: 0, r["packs"]?.asInt ?: 0, r["xp"]?.asInt ?: 0, r.getAsJsonObject("seals")?.entrySet()?.associate { it.key to it.value.asInt } ?: emptyMap())
    }

    val achievements = o.getAsJsonArray("achievements").map { e -> val a = e.asJsonObject
        Achievement(a["id"].asString, a["tab"].asString, a["title"].asString, a["lore"].asString, str(a["art"]) ?: "", a["source"].asString,
            a.getAsJsonArray("steps").map { it.asInt }, a["feat"]?.asBoolean == true, a["hidden"]?.asBoolean == true, str(a["riddle"]), str(a["unit"]))
    }
    val dailyEasy = o.getAsJsonArray("dailyEasy").map { quest(it, "easy") }
    val dailyHard = o.getAsJsonArray("dailyHard").map { quest(it, "hard") }
    val firstMatch = quest(o["firstMatch"], "first")
    val weekly = o.getAsJsonArray("weekly").map { quest(it, "weekly") }
    val loginWeek = o.getAsJsonArray("loginWeek").map(::reward)
    /** The Story acts: story-acts.js STORY_ACTS (all live acts, bundled as story-acts.json); the line under a title comes from the rules copy where it has one. */
    val acts: List<Act> = run {
        val lines = o.getAsJsonArray("storyActs").associate { it.asJsonObject["act"].asInt to str(it.asJsonObject["line"]) }
        val names = storyJson.getAsJsonObject("setNames")
        storyJson.getAsJsonArray("acts").map { e -> val a = e.asJsonObject
            Act(a["act"].asInt, a["title"].asString, a["years"].asString, lines[a["act"].asInt] ?: "", a.getAsJsonObject("art")["crop"].asString, 8,
                a.getAsJsonArray("sets").map { it.asString }.map { c -> c to (names[c]?.asString ?: c.uppercase()) })
        }
    }
    /** story-acts.js ACT.age per act (the Road prints the first one's). */
    val ages: Map<Int, String> = storyJson.getAsJsonArray("acts").associate { it.asJsonObject["act"].asInt to it.asJsonObject["age"].asString }
    /** Forge CPU levels: Easy, Medium (shown as Normal), Hard, each with its policy version. */
    val cpuPolicies: Map<String, String> = o.getAsJsonObject("cpuPolicies").entrySet().associate { it.key to it.value.asString }
    val cpuLabels: Map<String, String> = o.getAsJsonObject("cpuLabels").entrySet().associate { it.key to it.value.asString }
    val playmats: List<Pair<String, String>> = o.getAsJsonArray("playmats").map { (it as JsonArray).let { p -> p[0].asString to p[1].asString } }

    companion object {
        @Volatile private var cached: PlayRules? = null
        fun load(context: Context): PlayRules = cached ?: synchronized(this) {
            cached ?: PlayRules(JsonParser.parseString(context.assets.open("play-rules.json").use { String(it.readBytes()) }).asJsonObject, JsonParser.parseString(context.assets.open("story-acts.json").use { String(it.readBytes()) }).asJsonObject).also { cached = it }
        }
    }
}
