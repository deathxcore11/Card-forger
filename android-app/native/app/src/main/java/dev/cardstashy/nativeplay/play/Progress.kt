package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
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
@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
object Progress {
    private const val SITE = "https://cardstashy.com"

    class Failure(val code: String, message: String) : Exception(message)

    private val _state = MutableStateFlow<JsonObject?>(null); val state: StateFlow<JsonObject?> = _state
    private val _error = MutableStateFlow<Failure?>(null); val error: StateFlow<Failure?> = _error
    private val _busy = MutableStateFlow(""); val busy: StateFlow<String> = _busy
    private val _deeds = MutableStateFlow<JsonObject?>(null)
    /** GET /api/progress/achievements: every achievement worked out by the server (web 4.3.79). Null until it answers; the home falls back to PlayMath. */
    val deeds: StateFlow<JsonObject?> = _deeds
    suspend fun refreshDeeds() { try { _deeds.value = call("achievements?tz=$tz").also { dev.cardstashy.nativeplay.ui.AchievementToasts.seen(it) } } catch (_: Failure) {} }
    private val _story = MutableStateFlow<List<String>?>(null); val storyRefs: StateFlow<List<String>?> = _story
    private val lock = Mutex()
    private var cacheDir: File? = null

    fun init(context: Context) { cacheDir = context.applicationContext.filesDir }

    private fun file(user: String) = cacheDir?.let { File(it, "progress-$user.json") }

    /** The device copy for this account, shown before the server answers. */
    suspend fun loadCached() {
        val u = Account.session.value?.userId ?: return
        if (_state.value != null) return
        // Read and parse off the main thread: the state carries the whole Trunk.
        val cached = withContext(Dispatchers.IO) { try { file(u)?.takeIf { it.isFile }?.let { JsonParser.parseString(it.readText()).asJsonObject } } catch (_: Exception) { null } }
        if (_state.value == null && cached != null) _state.value = cached
    }

    /** The device copy is written on one background thread, newest state only. */
    private val writer = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.IO.limitedParallelism(1))
    private var pending: kotlinx.coroutines.Job? = null

    private val deedsScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.IO)

    private fun set(next: JsonObject) {
        // E6a: an answer equal to what is already shown changes nothing, so the pages do not recompose and the file is not rewritten.
        if (_state.value == next) return
        val before = _state.value?.get("counters")
        _state.value = next
        // Live toasts (app.js: every new server state is diffed): a Play answer that moved the counters refetches the deeds.
        if (Account.session.value != null && (!dev.cardstashy.nativeplay.ui.AchievementToasts.hasBaseline || before != next.get("counters"))) deedsScope.launch { refreshDeeds() }
        Account.session.value?.userId?.let { u -> pending?.cancel(); pending = writer.launch { try { file(u)?.writeText(next.toString()) } catch (_: Exception) {} } }
    }

    private suspend fun call(path: String, body: JsonObject? = null, timeoutMs: Int = 15000): JsonObject = withContext(Dispatchers.IO) {
        val token = Account.token() ?: throw Failure("sign_in", MESSAGES.getValue("sign_in"))
        try {
            Http.call(if (body == null) "GET" else "POST", "$SITE/api/progress/$path", mapOf("Authorization" to "Bearer $token"), body?.toString(), timeoutMs = timeoutMs)?.asJsonObject ?: JsonObject()
        } catch (e: Http.Failure) {
            val code = Regex("\"error\"\\s*:\\s*\"([^\"]+)\"").find(e.body)?.groupValues?.get(1) ?: "http_${e.status}"
            // An answer with no words of its own still names itself (E5a), so a report or a screenshot says what the server said.
            throw Failure(code, MESSAGES[code] ?: "Play rewards are unavailable right now. Try again in a moment. ($code)")
        } catch (e: Failure) { throw e } catch (e: Exception) {
            throw Failure("offline", "Couldn’t reach CardStashy. Check your connection.")
        }
    }

    private val tz get() = java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000

    /** Server answers carry the wallet; the shop, reward set, counters and claims ride along (keep()). */
    private fun keep(next: JsonObject, extra: JsonObject? = null): JsonObject = next.deepCopy().apply {
        val s = _state.value
        for (k in listOf("rewardSet", "shop", "styles", "secretLair", "secretLairStore", "preconStore")) if (!has(k)) s?.get(k)?.let { add(k, it) }
        add("counters", s?.get("counters") ?: JsonObject()); add("claimed", s?.get("claimed") ?: JsonArray())
        add("login", s?.get("login") ?: com.google.gson.JsonNull.INSTANCE)
        extra?.entrySet()?.forEach { (k, v) -> add(k, v) }
    }

    /** The state, and the starter gift on a first visit (the web asks for it the same way). */
    suspend fun refresh() = lock.withLock {
        _error.value = null
        try {
            var s = call("state")
            if ((s.get("wallet") as? JsonObject)?.get("starter_at")?.takeIf { !it.isJsonNull } == null) {
                val shop = s.get("shop")
                s = call("starter", JsonObject()).apply { shop?.let { add("shop", it) } }
            }
            s.add("login", _state.value?.get("login") ?: com.google.gson.JsonNull.INSTANCE)
            set(s)
            if (waiting() > 0) deedsScope.launch { flushQueue() } // back online: matches played offline go up now
        } catch (e: Failure) { _error.value = e } catch (_: Exception) {} // a malformed answer keeps the last state
    }

    suspend fun refreshStory() {
        try { _story.value = (call("story").get("refs") as? JsonArray)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } } catch (_: Exception) {}
    }

    /** A won Story battle (story-client.js claim): the server pays each side once and returns the ledger refs and what it paid. */
    suspend fun claimStory(battle: String, seat: String, deck: String): JsonObject? = try {
        val out = call("story", JsonObject().apply { addProperty("battle", battle); addProperty("seat", seat); addProperty("deck", deck) })
        (out.get("refs") as? JsonArray)?.let { a -> _story.value = a.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } }
        (out.get("state") as? JsonObject)?.let { st -> runCatching { refresh() } }
        out
    } catch (e: Exception) { JsonObject().apply { addProperty("error", e.message) } }

    /** play-econ-client reportDeeds: the Story deeds a won battle earned; the server re-checks and pays each once. Returns the ids it counted. */
    suspend fun reportDeeds(battle: String, deeds: List<String>): List<String> {
        if (deeds.isEmpty()) return emptyList()
        return try {
            val out = call("deeds", JsonObject().apply { addProperty("battle", battle); add("deeds", com.google.gson.JsonArray().apply { deeds.forEach { add(it) } }) })
            runCatching { refreshDeeds() }   // the in-app pop-up fires from the achievements it returns
            (out.get("counted") as? JsonArray)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()
        } catch (_: Failure) { emptyList() }
    }

    /** The day's log-in stamp; {day, stamp, reward, monthReward, fresh} or null. Quiet on failure, like the web. */
    suspend fun login(): JsonObject? = try {
        val out = call("login", JsonObject().apply { addProperty("tz", tz) })
        val login = out.get("login") as? JsonObject
        if (login != null) {
            val base = (out.get("state") as? JsonObject)?.let { keep(it) } ?: _state.value?.deepCopy() ?: JsonObject()
            out.get("counters")?.let { base.add("counters", it) }
            base.add("login", login); set(base)
        }
        login
    } catch (_: Exception) { null }

    /**
     * The app.js 'play:match-recorded' listener and play-econ-client reportMatch: one finished match to /api/progress/match
     * (quests and achievements; the server decides what counts). Quiet on failure, like the web. Facts are the whitelisted
     * numbers plus maxTribe, as the web sends them.
     */
    suspend fun reportMatch(mode: String, outcome: String, format: String, turns: Int?, life: Int?, opponentLife: Int?, onPlay: Boolean?, durationMs: Long?,
                            colors: String, seats: Int?, difficulty: String?, facts: JsonObject?): JsonObject? = try {
        if (Account.session.value == null) null else {
            val id = java.util.UUID.randomUUID().toString().replace(Regex("[^A-Za-z0-9_-]"), "")
            val f = JsonObject()
            if (facts != null) {
                for (k in REPORTED_FACTS) facts.get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.let { f.add(k, it) }
                facts.getAsJsonObject("tribes")?.let { t -> f.addProperty("maxTribe", maxOf(0, t.entrySet().maxOfOrNull { it.value.asInt } ?: 0)) }
            }
            val body = JsonObject().apply {
                addProperty("id", id); addProperty("mode", mode); addProperty("outcome", outcome); addProperty("format", format)
                turns?.let { addProperty("turns", it) }; facts?.get("myTurns")?.takeIf { it.isJsonPrimitive }?.let { add("myTurns", it) }
                life?.let { addProperty("life", it) }; opponentLife?.let { addProperty("opponentLife", it) }; onPlay?.let { addProperty("onPlay", it) }
                durationMs?.let { addProperty("durationMs", it) }; addProperty("colors", colors); seats?.let { addProperty("seats", it) }; difficulty?.let { addProperty("difficulty", it) }
                if (facts != null) add("facts", f); addProperty("tz", tz)
            }
            // Only Practice waits for a signal (approved plan); Quick Play, Story and friends stay online-only.
            try { send(body) } catch (e: Failure) { if (e.code == "offline" && mode == "practice") enqueue(body); null }
        }
    } catch (_: Failure) { null }

    private suspend fun send(body: JsonObject): JsonObject {
        val out = call("match", body)
        out.get("counters")?.takeIf { it.isJsonObject }?.let { c -> _state.value?.deepCopy()?.let { st -> st.add("counters", c); set(st) } }
        return out
    }

    // ---- Offline play (offline art plan, approved 4 Nov): a match finished with no signal waits on the phone and is sent,
    // with its original id, as soon as the app is back online. The server still decides every reward and quest. ----
    private val queueLock = Any()
    private fun queueFile() = cacheDir?.let { File(it, "match-queue.json") }
    private fun queued(): JsonArray = synchronized(queueLock) { runCatching { JsonParser.parseString(queueFile()!!.readText()).asJsonArray }.getOrNull() ?: JsonArray() }
    private fun enqueue(body: JsonObject) = synchronized(queueLock) {
        val q = queued(); if (q.size() < 200) q.add(body.deepCopy().apply { addProperty("queuedAt", System.currentTimeMillis()) })
        runCatching { queueFile()?.writeText(q.toString()) }
    }
    /** Matches waiting to be sent. */
    fun waiting(): Int = queued().size()
    /** Sends queued matches oldest first; stops at the first one that still cannot reach the server. A refused one is dropped. */
    suspend fun flushQueue() = withContext(Dispatchers.IO) {
        if (Account.session.value == null) return@withContext
        while (true) {
            val next = queued().firstOrNull() as? JsonObject ?: break
            val body = next.deepCopy().apply { remove("queuedAt") }
            val sent = try { send(body); true } catch (e: Failure) { if (e.code == "offline") break; true }
            if (sent) synchronized(queueLock) { val q = queued(); if (q.size() > 0) q.remove(0); runCatching { queueFile()?.writeText(q.toString()) } }
        }
    }
    private val REPORTED_FACTS = listOf("myTurns", "minLife", "startLife", "maxLife", "lifeGained", "oppBigTurn", "oppPoison", "oppLibraryMin", "oppHandMin", "maxHand", "maxCreatures",
        "maxTokens", "maxLands", "maxPower", "maxAttackers", "maxFlyers", "maxCounters", "maxAttach", "oppMaxCreatures", "oppWipes", "kills", "losses", "turnedUp")

    private suspend fun run(label: String, path: String, body: JsonObject, timeoutMs: Int = 15000, extra: (JsonObject) -> JsonObject? = { null }): JsonObject {
        _busy.value = label; _error.value = null
        try {
            val out = call(path, body, timeoutMs)
            (out.get("state") as? JsonObject)?.let { set(keep(it, extra(out))) }
            return out
        } catch (e: Failure) { _error.value = e; throw e } finally { _busy.value = "" }
    }

    /** The day's one free quest swap (route reroll): an unfinished easy or hard daily is replaced. Answers {counters}. [scope]/[id] are for the weekly swap once the server has it. */
    suspend fun reroll(level: String, scope: String? = null, id: String? = null) {
        val out = run("reroll", "reroll", JsonObject().apply { if (scope == null) addProperty("level", level); scope?.let { addProperty("scope", it) }; id?.let { addProperty("id", it) }; addProperty("tz", tz) })
        out.get("counters")?.let { c -> val base = _state.value?.deepCopy() ?: JsonObject(); base.add("counters", c); set(base) }
    }

    /**
     * Opening rolls the pack on the server, which first loads the set's cards from Scryfall: an old set's first open can
     * take well over 15 s (Randall 4 Nov, Tenth Edition: "That pack didn't open"). So it waits up to a minute, and a
     * pack that came back unopened for a passing reason is tried once more by itself; the server never spends a pack on
     * a failed roll.
     */
    suspend fun open(id: String): JsonObject {
        val body = JsonObject().apply { addProperty("id", id); addProperty("tz", tz) }
        return try { run("open:$id", "open", body, timeoutMs = 60000) } catch (e: Failure) {
            if (e.code !in setOf("offline", "cards_unavailable", "http_502", "http_503", "http_504", "http_500")) { reportOpen(id, e); throw e }
            kotlinx.coroutines.delay(1500)
            try { run("open:$id", "open", body, timeoutMs = 60000) } catch (again: Failure) { reportOpen(id, again); throw again }
        }
    }
    /** E5a: a pack that would not open goes into the auto report with the server's own answer. */
    private fun reportOpen(id: String, e: Failure) {
        val set = (_state.value?.get("packs") as? JsonArray)?.firstNotNullOfOrNull { (it as? JsonObject)?.takeIf { o -> o.get("id")?.takeIf { v -> v.isJsonPrimitive }?.asString == id }?.get("set")?.takeIf { v -> v.isJsonPrimitive }?.asString }
        runCatching { dev.cardstashy.nativeplay.FreezeReport.matchStuck("pack open failed", "set $set code ${e.code} message ${e.message}") }
    }
    suspend fun buy(set: String) = run("buy", "buy", JsonObject().apply { addProperty("set", set); addProperty("tz", tz) })
    suspend fun forge(to: String, times: Int = 1) = run("forge", "forge", JsonObject().apply { addProperty("to", to); addProperty("times", times); addProperty("tz", tz) })
    /** This week's Secret Lair bundle for coins (play-econ-client secretLair): the cards land in the Trunk in their Secret Lair art. */
    suspend fun secretLair(week: String) = run("secretlair", "secretlair", JsonObject().apply { addProperty("week", week); addProperty("tz", tz) }) { out ->
        JsonObject().apply { out.get("styles")?.let { add("styles", it) }; out.get("secretLair")?.let { add("secretLair", it) } } }
    /** One card of this week's Secret Lair store for coins (play-econ-client secretLairCard): into the Trunk, its Secret Lair art unlocked. */
    suspend fun secretLairCard(id: String, week: String?) = run("sloffer:$id", "sloffer", JsonObject().apply { addProperty("id", id); addProperty("pay", "coins"); week?.let { addProperty("week", it) }; addProperty("tz", tz) }) { out ->
        JsonObject().apply { out.get("styles")?.let { add("styles", it) }; out.get("secretLairStore")?.let { add("secretLairStore", it) } } }
    suspend fun precon(file: String, format: String) = run("precon", "precon", JsonObject().apply { addProperty("file", file); addProperty("format", format) })
    suspend fun holo(oracle: String) = run("holo", "holo", JsonObject().apply { addProperty("oracle", oracle) })
    suspend fun craft(id: String, holo: Boolean = false) = run("craft", "craft", JsonObject().apply { addProperty("id", id); addProperty("holo", holo) })
    suspend fun claim(kind: String, id: String, step: Int?) = run("claim:$kind:$id:${step ?: ""}", "claim",
        JsonObject().apply { addProperty("kind", kind); addProperty("id", id); step?.let { addProperty("step", it) }; addProperty("tz", tz) },
        extra = { out -> JsonObject().apply { out.get("claimed")?.let { add("claimed", it) } } })
    /** Saves a Play deck on the server, then reloads the state (the web's saveDeck). */
    suspend fun saveDeck(deck: JsonObject): JsonElement? { val out = run("deck", "deck", deck); refresh(); return out.get("deck") }

    internal fun setForTest(state: JsonObject?, deeds: JsonObject?) { _state.value = state; _deeds.value = deeds }
    fun clear() { dev.cardstashy.nativeplay.ui.AchievementToasts.reset(); _deeds.value = null; _state.value = null; _story.value = null; _error.value = null }

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
        "bought" to "That Secret Lair is already yours.",
        "no_offer" to "That card has left the Secret Lair store.",
        "bundle_gone" to "That Secret Lair has left the Merchant. A new one is in.",
        "no_bundle" to "No Secret Lair at the Merchant right now.",
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
        val w = state?.get("wallet") as? JsonObject ?: return null
        return Purse(w.int("coins"), mapOf("c" to w.int("seal_c"), "u" to w.int("seal_u"), "r" to w.int("seal_r"), "m" to w.int("seal_m")),
            (state.get("packs") as? JsonArray)?.size() ?: 0, w.int("xp"))
    }

    fun mastery(state: JsonObject?, xp: Int): Level {
        val per = ((state?.get("config") as? JsonObject)?.get("mastery") as? JsonObject)?.int("xpPerLevel")?.takeIf { it > 0 } ?: 1000
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

    private fun counters(state: JsonObject?) = state?.get("counters") as? JsonObject ?: JsonObject()
    private fun claimed(state: JsonObject?) = (state?.get("claimed") as? JsonArray)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }?.toSet() ?: emptySet()

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
        val cards = (state?.get("cards") as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()
        val c = counters(state)
        return when {
            source == "cards" -> cards.sumOf { it.int("c") }
            source == "playsets" -> cards.count { it.int("c") >= 4 }
            source == "mythics" -> cards.count { it.get("r")?.takeIf { e -> e.isJsonPrimitive }?.asString == "mythic" && it.int("c") > 0 }
            source == "packs" -> (state?.get("wallet") as? JsonObject)?.int("packs_opened") ?: 0
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

    /** questReward: the reward a quest pays, from the server's config with the web's defaults. */
    fun questReward(q: PlayRules.Quest, config: JsonObject?): PlayRules.Reward {
        val d = config?.get("daily") as? JsonObject; val w = config?.get("weekly") as? JsonObject
        fun JsonObject?.n(a: String, k: String, def: Int) = (this?.get(a) as? JsonObject)?.get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: def
        fun JsonObject?.m(k: String, def: Int) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: def
        return when (q.level) {
            "first" -> PlayRules.Reward(coins = d.n("firstMatch", "coins", 100))
            "easy" -> PlayRules.Reward(coins = d.n("easy", "coins", 250), xp = d.n("easy", "xp", 50))
            "hard" -> PlayRules.Reward(coins = d.n("hard", "coins", 500), xp = d.n("hard", "xp", 100))
            else -> PlayRules.Reward(packs = w.m("pack", 1), xp = w.m("xp", 250))
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
