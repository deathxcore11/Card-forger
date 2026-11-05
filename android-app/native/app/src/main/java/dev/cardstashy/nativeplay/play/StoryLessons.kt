package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * The web's Story lessons, generated from its own modules (scripts/export-story-lessons.mjs, assets/story-lessons.json):
 * [map] is story-ui.js LESSONS, one plain sentence per mechanic a battle introduces (battle.teaches); the rest is
 * story-lessons.js, the Rift's in-match whispers: the ideas each Act 1 lesson battle teaches ([battles], [say]), the
 * new-mechanic words for later acts ([words]) and the lesson battles' stacked draws ([stacks]).
 */
class StoryLessons(json: JsonObject) {
    class Word(val name: String, val re: Regex?, val text: String)

    val map: Map<String, String> = json.obj("lessons").entrySet().associateTo(LinkedHashMap()) { it.key to it.value.asString }
    val battles: Map<String, List<String>> = json.obj("battles").entrySet().associate { it.key to it.value.asJsonArray.map { e -> e.asString } }
    val say: Map<String, String> = json.obj("say").entrySet().associate { it.key to it.value.asString }
    val words: List<Word> = (json.get("words") as? JsonArray ?: JsonArray()).map { it.asJsonObject }.map { w ->
        val re = w.get("re")?.takeIf { it.isJsonPrimitive }?.asString
        Word(w["name"].asString, re?.let { Regex(it, if (w.get("ignoreCase")?.asBoolean == true) setOf(RegexOption.IGNORE_CASE) else emptySet()) }, w["text"].asString)
    }
    private val stacks: JsonObject = json.obj("stacks")

    /** isLessonBattle: one of the four Act 1 lesson battles. */
    fun isLessonBattle(id: String?): Boolean = id != null && id in battles

    /** lessonSetup: the engine's match setting for a lesson battle, its stacked draws (top of the library first; the first
     *  seven are the opening hand) and no mulligan. Forge still shuffles, deals and plays; null for any other battle. */
    fun setup(id: String): JsonObject? = stacks.get(id)?.takeIf { it.isJsonObject }?.let { st ->
        JsonObject().apply { add("stack", st.deepCopy()); addProperty("noMulligan", true) }
    }

    companion object {
        private val EMPTY = JsonObject()
        private fun JsonObject.obj(k: String): JsonObject = get(k)?.takeIf { it.isJsonObject }?.asJsonObject ?: EMPTY

        @Volatile private var cached: StoryLessons? = null
        fun load(context: Context): StoryLessons = cached ?: synchronized(this) {
            cached ?: runCatching { StoryLessons(JsonParser.parseString(context.assets.open("story-lessons.json").use { String(it.readBytes()) }).asJsonObject) }
                .getOrElse { StoryLessons(JsonObject()) }.also { cached = it }
        }

        // Each idea is shown once per device (seen flags), and Skip lessons turns them off (story-lessons.js KEY_SEEN, KEY_OFF).
        private fun prefs(context: Context) = context.applicationContext.getSharedPreferences("story-lessons", Context.MODE_PRIVATE)
        fun off(context: Context): Boolean = prefs(context).getBoolean("off", false)
        fun setOff(context: Context, off: Boolean) = prefs(context).edit().putBoolean("off", off).apply()
        fun seen(context: Context): MutableSet<String> = HashSet(prefs(context).getStringSet("seen", emptySet()) ?: emptySet())
        fun saveSeen(context: Context, seen: Set<String>) = prefs(context).edit().putStringSet("seen", HashSet(seen)).apply()
    }
}
