package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Land styles (Randall 16 Nov 2026, preview https://claude.ai/artifact/Xv5a3wJ2Kqmnr2ASuwSsc6): the site's land-styles.js
 * in Kotlin. A style is one real printing of a basic land; owning one copy unlocks its look for that land in every deck.
 * Basics stay free and unlimited. The deck row carries the chosen printing (id), so a match only changes the picture.
 * Data: the site's /data/land-styles.json (scripts/bake-land-styles.mjs), loaded once and kept on the device.
 */
object LandStyles {
    val TYPES = listOf("Plains", "Island", "Swamp", "Mountain", "Forest")
    val KINDS = mapOf("r" to "Regular", "f" to "Full art", "s" to "Special")
    val SORTS = listOf("recent" to "Recently got", "newest" to "Newest set", "oldest" to "Oldest set")

    data class Style(val id: String, val type: String, val set: String, val setName: String, val num: String, val kind: String,
                     val released: String, val artist: String, val booster: Boolean)
    data class Owned(val at: Int, val src: String)
    class Data(val list: List<Style>, val starter: Map<String, String>, val oracles: Map<String, String>) {
        val byId = list.associateBy { it.id }
    }

    fun isType(name: String?) = name in TYPES
    /** Regular set lands craft for a common seal, full art for an uncommon one; Special lands only come from packs. */
    fun craftSeal(kind: String, config: JsonObject? = null): String? {
        if (kind == "s") return null
        val c = ((config?.get("landStyles") as? JsonObject)?.get("craft") as? JsonObject)?.get(kind)?.takeIf { it.isJsonPrimitive }?.asString
        return c ?: if (kind == "f") "u" else "c"
    }
    fun image(id: String, size: String = "normal") = if (Regex("^[0-9a-f-]{36}$").matches(id)) "https://cards.scryfall.io/$size/front/${id[0]}/${id[1]}/$id.jpg" else ""

    fun parse(o: JsonObject): Data {
        val sets = (o.get("sets") as? JsonObject)?.entrySet()?.associate { it.key to it.value.asString } ?: emptyMap()
        val list = (o.get("styles") as? JsonArray)?.mapNotNull { e ->
            val a = e as? JsonArray ?: return@mapNotNull null
            fun s(i: Int) = a.get(i)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
            val type = TYPES.getOrNull(a.get(1)?.asInt ?: -1) ?: return@mapNotNull null
            val set = s(2)
            Style(s(0), type, set, sets[set] ?: set.uppercase(), s(3), s(4), s(5), s(6), a.size() > 7 && a.get(7)?.let { it.isJsonPrimitive && (it.asJsonPrimitive.let { p -> if (p.isBoolean) p.asBoolean else p.isNumber && p.asInt != 0 }) } == true)
        } ?: emptyList()
        fun map(k: String) = (o.get(k) as? JsonObject)?.entrySet()?.associate { it.key to it.value.asString } ?: emptyMap()
        return Data(list, map("starter"), map("oracles"))
    }

    /**
     * Owned styles: each type's starter, every style in play.styles (newest first, so list order is the order they were got), and for
     * packs opened before land styles every booster printing of a land in a set the Trunk holds that land from, plus the card's own printing.
     */
    fun owned(d: Data, styles: List<JsonObject>, cards: List<JsonObject>): Map<String, Owned> {
        val own = LinkedHashMap<String, Owned>()
        for (t in TYPES) d.starter[t]?.let { own[it] = Owned(0, "starter") }
        val held = HashMap<String, Set<String>>()
        for (c in cards) { val n = c.s("n"); if (isType(n)) held[n] = (c.get("s") as? JsonArray)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString?.lowercase() }?.toSet() ?: emptySet() }
        for (s in d.list) if (s.booster && s.kind != "s" && held[s.type]?.contains(s.set) == true && s.id !in own) own[s.id] = Owned(0, "trunk")
        for (c in cards) { val p = c.s("p"); if (isType(c.s("n")) && p in d.byId && p !in own) own[p] = Owned(0, "trunk") }
        styles.forEachIndexed { i, x -> val id = x.s("id"); if (id in d.byId) own[id] = Owned(styles.size - i, x.s("src")) }
        return own
    }

    /** The picker's order: the style in use first, then owned (by [sort]), then locked by set date. */
    fun sorted(list: List<Style>, owned: Map<String, Owned>, sort: String = "recent", inUse: String = ""): List<Style> {
        val num = Comparator<Style> { a, b -> natural(a.num, b.num) }
        val bySet: Comparator<Style> = (if (sort == "oldest") compareBy<Style> { it.released } else compareByDescending { it.released }).then(num)
        val mine = list.filter { it.id in owned }.sortedWith(if (sort == "recent") compareByDescending<Style> { owned.getValue(it.id).at }.then(bySet) else bySet).toMutableList()
        val locked = list.filter { it.id !in owned }.sortedWith(if (sort == "oldest") bySet else compareByDescending<Style> { it.released }.then(num))
        val i = mine.indexOfFirst { it.id == inUse }
        if (i > 0) mine.add(0, mine.removeAt(i))
        return mine + locked
    }
    private fun natural(a: String, b: String): Int {
        val x = a.takeWhile { it.isDigit() }.toIntOrNull(); val y = b.takeWhile { it.isDigit() }.toIntOrNull()
        if (x != null && y != null && x != y) return x.compareTo(y)
        return a.compareTo(b)
    }

    /** The printing a deck's land rows use: the row's own when owned, else the account default (the style marked on), else the starter. */
    fun inDeck(type: String, rowId: String?, owned: Map<String, Owned>, chosen: Map<String, String>, starter: Map<String, String>): String {
        if (!rowId.isNullOrEmpty() && rowId in owned) return rowId
        chosen[type]?.let { if (it in owned) return it }
        return starter[type] ?: ""
    }
    /** play.styles' land rows marked on: the account's default style per land. */
    fun chosen(styles: List<JsonObject>): Map<String, String> =
        styles.filter { isType(it.s("n")) && it.get("on")?.takeIf { e -> e.isJsonPrimitive }?.asBoolean == true }.associate { it.s("n") to it.s("id") }
    /** Styles got from a pack or crafted (play.styles src landopen: / landcraft:), id to land: these can show New. */
    fun got(styles: List<JsonObject>): Map<String, String> =
        styles.filter { isType(it.s("n")) && Regex("^land(open|craft)").containsMatchIn(it.s("src")) }.associate { it.s("id") to it.s("n") }

    // ---- loading, kept on the device

    private val _data = MutableStateFlow<Data?>(null); val data: StateFlow<Data?> = _data
    private val _error = MutableStateFlow(false); val error: StateFlow<Boolean> = _error
    private var dir: File? = null
    private var prefs: android.content.SharedPreferences? = null
    fun init(context: Context) { dir = context.applicationContext.filesDir; prefs = context.applicationContext.getSharedPreferences("land-styles", Context.MODE_PRIVATE) }

    suspend fun load() {
        if (_data.value != null) return
        _error.value = false
        val f = dir?.let { File(it, "land-styles.json") }
        withContext(Dispatchers.IO) {
            f?.takeIf { it.exists() }?.let { runCatching { _data.value = parse(JsonParser.parseString(it.readText()).asJsonObject) } }
            // A fresh copy each day the app is opened: the site re-bakes when new sets arrive.
            val stale = f == null || !f.exists() || System.currentTimeMillis() - f.lastModified() > 24 * 3600_000L
            if (_data.value == null || stale) runCatching {
                val o = dev.cardstashy.nativeplay.account.Http.call("GET", "https://cardstashy.com/data/land-styles.json", mapOf("Accept" to "application/json"), null, 30_000) as? JsonObject
                if (o?.get("styles") is JsonArray) { _data.value = parse(o); f?.writeText(o.toString()) }
            }
            if (_data.value == null) _error.value = true
        }
    }

    /** Styles already looked at on this device: a style just got shows New (and its land a gold dot) until it is tapped. */
    private val _seen = MutableStateFlow<Set<String>?>(null); val seen: StateFlow<Set<String>?> = _seen
    fun initSeen(styles: List<JsonObject>) {
        if (_seen.value != null) return
        val p = prefs ?: return
        val saved = p.getString("seen", null)
        // First time on this device: everything unlocked so far counts as seen, so only what comes next shows New.
        _seen.value = saved?.split(',')?.filter { it.isNotEmpty() }?.toSet() ?: styles.map { it.s("id") }.toSet().also { save(it) }
    }
    fun see(id: String) { val s = _seen.value ?: return; if (id in s) return; val n = s + id; _seen.value = n; save(n) }
    private fun save(s: Set<String>) { prefs?.edit()?.putString("seen", s.toList().takeLast(3000).joinToString(","))?.apply() }

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
}
