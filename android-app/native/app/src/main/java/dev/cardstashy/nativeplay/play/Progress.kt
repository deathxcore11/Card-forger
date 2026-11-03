package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.time.LocalDate
import java.time.temporal.IsoFields
import java.time.Instant
import java.time.ZoneOffset

/**
 * Play progression, the web's play-econ-client.js: the wallet, packs, Play collection, Play decks,
 * quest counters and claims come from /api/progress on the site, and every change (open, buy, forge,
 * claim, log-in stamp) is the server's call. The last state is kept on this device per account only
 * so the screen paints at once; the server copy always wins. Never a reward decided here.
 */
object Progress {
    private const val SITE = "https://cardstashy.com"

    class Failure(val code: String, message: String) : Exception(message)

    private val _state = MutableStateFlow<JsonObject?>(null); val state: StateFlow<JsonObject?> = _state
    private val _error = MutableStateFlow<Failure?>(null); val error: StateFlow<Failure?> = _error
    private val _busy = MutableStateFlow(""); val busy: StateFlow<String> = _busy
    private val _story = MutableStateFlow<List<String>?>(null); val storyRefs: StateFlow<List<String>?> = _story
    private val lock = Mutex()
    private var cacheDir: File? = null

    fun init(context: Context) { cacheDir = context.applicationContext.filesDir }

    private fun file(user: String) = cacheDir?.let { File(it, "progress-$user.json") }

    /** The device copy for this account, shown before the server answers. */
    fun loadCached() {
        val u = Account.session.value?.userId ?: return
        if (_state.value != null) return
        try { file(u)?.takeIf { it.isFile }?.let { _state.value = JsonParser.parseString(it.readText()).asJsonObject } } catch (_: Exception) {}
    }

    private fun set(next: JsonObject) {
        _state.value = next
        Account.session.value?.userId?.let { u -> try { file(u)?.writeText(next.toString()) } catch (_: Exception) {} }
    }

    private suspend fun call(path: String, body: JsonObject? = null): JsonObject = withContext(Dispatchers.IO) {
        val token = Account.token() ?: throw Failure("sign_in", MESSAGES.getValue("sign_in"))
        try {
            Http.call(if (body == null) "GET" else "POST", "$SITE/api/progress/$path", mapOf("Authorization" to "Bearer $token"), body?.toString(), timeoutMs = 15000)?.asJsonObject ?: JsonObject()
        } catch (e: Http.Failure) {
            val code = Regex("\"error\"\\s*:\\s*\"([^\"]+)\"").find(e.body)?.groupValues?.get(1) ?: "http_${e.status}"
            throw Failure(code, MESSAGES[code] ?: "Play rewards are unavailable right now. Try again in a moment.")
        } catch (e: Failure) { throw e } catch (e: Exception) {
            throw Failure("offline", "Couldn’t reach CardStashy. Check your connection.")
        }
    }

    private val tz get() = java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000

    /** Server answers carry the wallet; the shop, reward set, counters and claims ride along (keep()). */
    private fun keep(next: JsonObject, extra: JsonObject? = null): JsonObject = next.deepCopy().apply {
        val s = _state.value
        for (k in listOf("rewardSet", "shop")) s?.get(k)?.let { add(k, it) }
        add("counters", s?.get("counters") ?: JsonObject()); add("claimed", s?.get("claimed") ?: JsonArray())
        add("login", s?.get("login") ?: com.google.gson.JsonNull.INSTANCE)
        extra?.entrySet()?.forEach { (k, v) -> add(k, v) }
    }

    /** The state, and the starter gift on a first visit (the web asks for it the same way). */
    suspend fun refresh() = lock.withLock {
        _error.value = null
        try {
            var s = call("state")
            if (s.getAsJsonObject("wallet")?.get("starter_at")?.takeIf { !it.isJsonNull } == null) {
                val shop = s.get("shop")
                s = call("starter", JsonObject()).apply { shop?.let { add("shop", it) } }
            }
            s.add("login", _state.value?.get("login") ?: com.google.gson.JsonNull.INSTANCE)
            set(s)
        } catch (e: Failure) { _error.value = e }
    }

    suspend fun refreshStory() {
        try { _story.value = call("story").getAsJsonArray("refs")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } } catch (_: Failure) {}
    }

    /** The day's log-in stamp; {day, stamp, reward, monthReward, fresh} or null. Quiet on failure, like the web. */
    suspend fun login(): JsonObject? = try {
        val out = call("login", JsonObject().apply { addProperty("tz", tz) })
        val login = out.getAsJsonObject("login")
        if (login != null) {
            val base = out.getAsJsonObject("state")?.let { keep(it) } ?: _state.value?.deepCopy() ?: JsonObject()
            out.get("counters")?.let { base.add("counters", it) }
            base.add("login", login); set(base)
        }
        login
    } catch (_: Failure) { null }

    private suspend fun run(label: String, path: String, body: JsonObject, extra: (JsonObject) -> JsonObject? = { null }): JsonObject {
        _busy.value = label; _error.value = null
        try {
            val out = call(path, body)
            out.getAsJsonObject("state")?.let { set(keep(it, extra(out))) }
            return out
        } catch (e: Failure) { _error.value = e; throw e } finally { _busy.value = "" }
    }

    suspend fun open(id: String) = run("open:$id", "open", JsonObject().apply { addProperty("id", id) })
    suspend fun buy(set: String) = run("buy", "buy", JsonObject().apply { addProperty("set", set) })
    suspend fun forge(to: String, times: Int = 1) = run("forge", "forge", JsonObject().apply { addProperty("to", to); addProperty("times", times) })
    suspend fun precon(file: String, format: String) = run("precon", "precon", JsonObject().apply { addProperty("file", file); addProperty("format", format) })
    suspend fun holo(oracle: String) = run("holo", "holo", JsonObject().apply { addProperty("oracle", oracle) })
    suspend fun craft(id: String, holo: Boolean = false) = run("craft", "craft", JsonObject().apply { addProperty("id", id); addProperty("holo", holo) })
    suspend fun claim(kind: String, id: String, step: Int?) = run("claim:$kind:$id:${step ?: ""}", "claim",
        JsonObject().apply { addProperty("kind", kind); addProperty("id", id); step?.let { addProperty("step", it) }; addProperty("tz", tz) },
        extra = { out -> JsonObject().apply { out.get("claimed")?.let { add("claimed", it) } } })
    /** Saves a Play deck on the server, then reloads the state (the web's saveDeck). */
    suspend fun saveDeck(deck: JsonObject): JsonElement? { val out = run("deck", "deck", deck); refresh(); return out.get("deck") }

    fun clear() { _state.value = null; _story.value = null; _error.value = null }

    val MESSAGES = mapOf(
        "sign_in" to "Sign in to use your Play collection.",
        "not_configured" to "Play rewards are not switched on yet.",
        "short_coins" to "Not enough coins for that pack yet.",
        "short_balance" to "Not enough coins or seals for that.",
        "no_seal" to "You need a seal of that rarity first.",
        "have_max" to "You already have 4 copies of that card.",
        "pack_not_found" to "That pack was already opened.",
        "cards_unavailable" to "The cards for this pack could not be loaded. Your pack is safe; try again in a moment.",
        "no_booster" to "Packs for that set are not available.",
        "bad_card" to "That card cannot be stamped with a seal.",
        "bad_forge" to "That seal cannot be forged.",
        "bad_precon" to "That precon could not be opened.",
        "not_earned" to "That reward is not ready yet.",
        "all_holo" to "Every copy you own is already holo.",
        "no_foil" to "This printing has no foil version.",
        "claimed" to "You already claimed that reward.",
        "not_ready" to "Quests open once the next update finishes.",
        "no_reward_set" to "The reward packs are not ready yet. Try again in a moment.",
    )
}

/** The rules the web computes from a state (play-econ-client purse, play-econ-rules masteryLevel, play-achievements). */
object PlayMath {
    data class Purse(val coins: Int, val seals: Map<String, Int>, val packs: Int, val xp: Int)
    data class Level(val level: Int, val into: Int, val need: Int)
    data class QuestRow(val quest: PlayRules.Quest, val have: Int, val done: Boolean, val claimed: Boolean, val ref: String)
    data class Quests(val day: String, val week: String, val daily: List<QuestRow>, val weekly: List<QuestRow>, val weeklyAllDone: Boolean, val weeklyAllClaimed: Boolean)
    data class Step(val need: Int, val tier: String, val done: Boolean, val claimed: Boolean)
    data class AchRow(val a: PlayRules.Achievement, val value: Int, val steps: List<Step>, val earned: Int, val next: Step?, val ready: Boolean, val complete: Boolean)
    data class Totals(val total: Int, val earned: Int, val ready: Int)
    data class StoryHome(val act: Int, val won: Int, val done: Boolean)

    private fun JsonObject.int(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 0

    fun purse(state: JsonObject?): Purse? {
        val w = state?.getAsJsonObject("wallet") ?: return null
        return Purse(w.int("coins"), mapOf("c" to w.int("seal_c"), "u" to w.int("seal_u"), "r" to w.int("seal_r"), "m" to w.int("seal_m")),
            state.getAsJsonArray("packs")?.size() ?: 0, w.int("xp"))
    }

    fun mastery(state: JsonObject?, xp: Int): Level {
        val per = state?.getAsJsonObject("config")?.getAsJsonObject("mastery")?.int("xpPerLevel")?.takeIf { it > 0 } ?: 1000
        val x = maxOf(0, xp)
        return Level(1 + x / per, x % per, per)
    }

    /** The player's day: the device's offset, limited to UTC-12..UTC+14 (playDay). */
    fun playDay(tzMinutes: Int, now: Long = System.currentTimeMillis()): String {
        val tz = tzMinutes.coerceIn(-720, 840)
        return Instant.ofEpochMilli(now + tz * 60000L).atZone(ZoneOffset.UTC).toLocalDate().toString()
    }

    /** ISO week of a YYYY-MM-DD day, e.g. 2026-W44 (playWeek). */
    fun playWeek(day: String): String {
        val d = LocalDate.parse(day)
        return "%d-W%02d".format(d.get(IsoFields.WEEK_BASED_YEAR), d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR))
    }

    /** FNV-1a over UTF-16 units with 32-bit wrap, as the web's hash(). */
    fun hash(s: String): Long {
        var h = 2166136261L.toInt()
        for (ch in s) { h = h xor ch.code; h *= 16777619 }
        return h.toLong() and 0xffffffffL
    }

    fun dailyQuests(rules: PlayRules, day: String, user: String = ""): List<PlayRules.Quest> {
        val h = hash("$day:$user")
        return listOf(rules.dailyEasy[(h % rules.dailyEasy.size).toInt()], rules.dailyHard[((h ushr 8) % rules.dailyHard.size).toInt()], rules.firstMatch)
    }

    private fun counters(state: JsonObject?) = state?.getAsJsonObject("counters") ?: JsonObject()
    private fun claimed(state: JsonObject?) = state?.getAsJsonArray("claimed")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }?.toSet() ?: emptySet()

    fun quests(rules: PlayRules, state: JsonObject?, day: String, user: String = ""): Quests {
        val c = counters(state); val got = claimed(state); val week = playWeek(day)
        fun row(q: PlayRules.Quest, scope: String, ref: String): QuestRow {
            val have = c.get("$scope:${q.key}")?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 0
            return QuestRow(q, minOf(have, q.need), have >= q.need, ref in got, ref)
        }
        val daily = dailyQuests(rules, day, user).map { row(it, "d:$day", "daily:$day:${it.id}") }
        val weekly = rules.weekly.map { row(it, "w:$week", "weekly:$week:${it.id}") }
        return Quests(day, week, daily, weekly, weekly.all { it.done }, "weekly:$week:all" in got)
    }

    private val TIERS = mapOf(1 to listOf("gold"), 2 to listOf("bronze", "gold"), 3 to listOf("bronze", "silver", "gold"),
        4 to listOf("bronze", "silver", "gold", "mythic"), 5 to listOf("bronze", "bronze", "silver", "gold", "mythic"))
    fun tierNames(n: Int) = TIERS[n] ?: TIERS.getValue(5)

    fun sourceValue(source: String, state: JsonObject?): Int {
        val cards = state?.getAsJsonArray("cards")?.mapNotNull { it as? JsonObject } ?: emptyList()
        val c = counters(state)
        return when {
            source == "cards" -> cards.sumOf { it.int("c") }
            source == "playsets" -> cards.count { it.int("c") >= 4 }
            source == "mythics" -> cards.count { it.get("r")?.asString == "mythic" && it.int("c") > 0 }
            source == "packs" -> state?.getAsJsonObject("wallet")?.int("packs_opened") ?: 0
            source == "fmt" -> c.entrySet().count { it.key.startsWith("fmt:") && (it.value.takeIf { v -> v.isJsonPrimitive }?.asDouble ?: 0.0) > 0 }
            else -> c.get(source)?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 0
        }
    }

    fun achievements(rules: PlayRules, state: JsonObject?): List<AchRow> {
        val got = claimed(state)
        return rules.achievements.map { a ->
            val value = sourceValue(a.source, state); val names = tierNames(a.steps.size)
            val steps = a.steps.mapIndexed { i, need -> Step(need, if (a.feat) "feat" else names[i], value >= need, "ach:${a.id}:$i" in got) }
            val next = steps.firstOrNull { !it.done }
            AchRow(a, value, steps, steps.count { it.done }, next, steps.any { it.done && !it.claimed }, next == null)
        }
    }

    fun totals(rows: List<AchRow>) = Totals(rows.sumOf { it.steps.size }, rows.sumOf { it.earned }, rows.count { it.ready })

    /** The unfinished achievements closest to their next step ("Almost there"). */
    fun almostThere(rows: List<AchRow>, n: Int = 3) = rows.filter { it.next != null && !it.a.hidden }
        .sortedByDescending { it.value.toDouble() / it.next!!.need }.take(n)

    /** Story progress from the player's story:* ledger refs (story-client.js progressFromRefs and the home's summary). */
    fun storyHome(refs: List<String>, acts: Int): StoryHome {
        val battles = HashMap<String, MutableSet<String>>(); val actsDone = HashSet<Int>()
        for (r in refs) {
            Regex("^story:(a\\d+b\\d+):(loaner|own|villain|vown|clear)$").find(r)?.let { battles.getOrPut(it.groupValues[1]) { HashSet() } += it.groupValues[2]; return@let }
            Regex("^story:act(\\d+):era$").find(r)?.let { actsDone += it.groupValues[1].toInt() }
        }
        fun cleared(id: String) = battles[id]?.let { "clear" in it || it.any { k -> k in setOf("loaner", "own", "villain") } } == true
        fun actCleared(n: Int) = n in actsDone || cleared("a${n}b8")
        val current = (1..acts).firstOrNull { !actCleared(it) } ?: (acts + 1)
        val act = current.coerceAtMost(acts)
        return StoryHome(act, (1..8).count { cleared("a${act}b$it") }, current > acts)
    }
}
