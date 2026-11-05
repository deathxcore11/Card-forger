package dev.cardstashy.nativeplay.collection

import android.content.Context
import app.cash.zipline.QuickJs
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit

/**
 * The site's Collection Home, run as the site's own code (assets/collection-engine.js: store.js, insights.js
 * collectionValue, home-ui.js homeValueModel and the Home rails, meta.js, community-feed.js, news-pulse.js and
 * app.js's resolveNames, bundled by scripts/export-collection-engine.mjs). Nothing about the collection is decided
 * here: this only carries the bundle's fetches over the network, runs its jobs and timers, and reads its models.
 * One thread owns the QuickJS instance; every call goes through it.
 */
object CollectionEngine {
    private val thread = java.util.concurrent.Executors.newSingleThreadExecutor { r -> Thread(null, r, "collection-engine", 8L shl 20).apply { isDaemon = true } }.asCoroutineDispatcher()
    private var qjs: QuickJs? = null
    private var source: () -> String = { "" }
    private val answers = ConcurrentLinkedQueue<Triple<Int, Int, Pair<String, String>>>()
    private val client by lazy { OkHttpClient.Builder().callTimeout(20, TimeUnit.SECONDS).build() }

    fun init(context: Context) { val app = context.applicationContext; source = { app.assets.open("collection-engine.js").bufferedReader().readText() } }
    /** For tests: the bundle from a file. */
    fun initFrom(file: File) { source = { file.readText() } }

    private fun js(): QuickJs = qjs ?: QuickJs.create().also { q ->
        q.maxStackSize = 6L shl 20
        // QuickJS has no time zone data: the site's daily clock (daily-clock.js, America/New_York) reads the zone's UTC
        // offsets from the device's own rules, three years either side of now (web-locale-prelude.js DateTimeFormat).
        q.evaluate("globalThis.__tz=${zoneTable(listOf("America/New_York"))}")
        q.evaluate(source(), "collection-engine.js")
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        qjs = q
    }

    /** {zone: [[fromMs, offsetMinutes], …]} from java.time's rules for each zone. */
    internal fun zoneTable(zones: List<String>, now: java.time.Instant = java.time.Instant.now()): String = JsonObject().apply {
        for (z in zones) {
            val rules = java.time.ZoneId.of(z).rules
            val from = now.minus(java.time.Duration.ofDays(3 * 366)); val until = now.plus(java.time.Duration.ofDays(3 * 366))
            val rows = com.google.gson.JsonArray()
            fun row(at: Long, off: Int) = rows.add(com.google.gson.JsonArray().apply { add(at); add(off) })
            row(from.toEpochMilli(), rules.getOffset(from).totalSeconds / 60)
            var t = rules.nextTransition(from)
            while (t != null && t.instant.isBefore(until)) { row(t.instant.toEpochMilli(), t.offsetAfter.totalSeconds / 60); t = rules.nextTransition(t.instant) }
            add(z, rows)
        }
    }.toString()

    private suspend fun <T> on(block: (QuickJs) -> T): T = withContext(thread) { block(js()) }
    private fun str(v: String) = JsonPrimitive(v).toString()

    /** app.js normalize() of the account's workspace data, with the catalog this device saved last time. */
    suspend fun load(workspace: JsonObject, catalog: String?): JsonObject = load(workspace.toString(), catalog)
    /** The same from the workspace's JSON text (the device's saved copy), without parsing it here first. */
    suspend fun load(workspace: String, catalog: String?): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.load(${str(workspace)}, ${catalog?.let(::str) ?: "null"})") as String).asJsonObject }

    /** Looks up every card name the catalog lacks (app.js autoEnrich's names) and starts Home's feeds; returns when done or after [maxMs]. */
    suspend fun refresh(game: String, maxMs: Long = 60_000, onStep: (String) -> Unit = {}): JsonObject {
        on { q -> q.evaluate("Collection.enrich()"); q.evaluate("Collection.feeds(${str(game)})") }
        val until = System.currentTimeMillis() + maxMs
        var status = JsonObject()
        while (System.currentTimeMillis() < until) {
            val (p, s) = on { q ->
                while (true) { val a = answers.poll() ?: break; q.evaluate("__host.answer(${a.first}, ${a.second}, ${str(a.third.first)}, ${str(a.third.second)})") }
                JsonParser.parseString(q.evaluate("__host.pump(${System.currentTimeMillis()})") as String).asJsonObject to
                    JsonParser.parseString(q.evaluate("Collection.poll()") as String).asJsonObject
            }
            for (r in p.getAsJsonArray("requests")) send(r.asJsonObject)
            status = s
            s.get("step")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let(onStep)
            if (!s.get("busy").asBoolean && p.get("open").asInt == 0 && answers.isEmpty()) break
            if (p.get("ran").asInt == 0 && answers.isEmpty()) {
                val next = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
                delay(if (next != null) (next - System.currentTimeMillis()).coerceIn(1, 25) else 15)
            }
        }
        return status
    }

    /** views.js home() / tcg.js tcgHome() as a model: value at a glance, your decks, Top Meta and News. */
    suspend fun home(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.home(${str(game)})") as String).asJsonObject }

    /** views.js collection(): the Cards tab as a model; [opts] = {sort, direction, filter, q, limit}, the site's own control values. */
    suspend fun cards(game: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cards(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** views.js decks(), My decks, as a model; [opts] = {q} as I.shelfSearch sets it. */
    suspend fun decks(game: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.decks(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** One Cards-tab control as app.js handles it (sort, direction, filter, search, more), then the page again. */
    suspend fun cardsDo(game: String, kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cardsDo(${str(game)}, ${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** search-hints.js: the search field's prompt and the names and questions it fades through. */
    suspend fun hints(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.hints(${str(game)})") as String).asJsonObject }

    /** The catalog the lookups filled (store.js S.catalog), for the app to keep between visits. */
    suspend fun catalog(): String = on { q -> q.evaluate("Collection.catalog()") as String }

    /** For tests: any expression in the bundle's scope, as a string. */
    internal suspend fun eval(code: String): String = on { q -> q.evaluate("String($code)") as String }

    private val JSON = "application/json".toMediaType()
    private fun send(r: JsonObject) {
        val id = r.get("id").asInt
        val raw = r.get("url").asString
        // The site's own routes are relative ("api/meta/mtg?…", "/api/…"): they resolve against the site.
        val url = if (raw.startsWith("http")) raw else "https://cardstashy.com/" + raw.removePrefix("/")
        val method = r.get("method")?.asString ?: "GET"
        val body = r.get("body")?.takeIf { it.isJsonPrimitive }?.asString
        CoroutineScope(Dispatchers.IO).launch {
            val ans = try {
                val b = Request.Builder().url(url).header("User-Agent", dev.cardstashy.nativeplay.art.CardArt.UA)
                r.getAsJsonObject("headers")?.entrySet()?.forEach { (k, v) -> if (v.isJsonPrimitive) b.header(k, v.asString) }
                b.method(method, body?.toRequestBody(JSON) ?: if (method == "GET" || method == "HEAD") null else ByteArray(0).toRequestBody(JSON))
                client.newCall(b.build()).execute().use { res ->
                    val h = JsonObject(); res.headers.forEach { (k, v) -> h.addProperty(k.lowercase(), v) }
                    Triple(id, res.code, h.toString() to (res.body?.string() ?: ""))
                }
            } catch (_: Exception) { Triple(id, -1, "{}" to "") }
            answers.add(ans)
        }
    }
}
