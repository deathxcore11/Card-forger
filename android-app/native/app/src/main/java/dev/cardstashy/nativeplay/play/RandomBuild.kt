package dev.cardstashy.nativeplay.play

import android.content.Context
import app.cash.zipline.QuickJs
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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
 * The site's random deck builder, run as the site's own code (assets/random-build.js: deck-pipeline, builder,
 * deck-forge, deck-optimizer, deck-construction, power, play-opponent-build and app.js's wiring, bundled by
 * scripts/export-random-build.mjs). Nothing about a deck is decided here: this only carries the bundle's
 * fetches over the network, runs its queued jobs and timers, and reads its status line and result.
 */
object RandomBuild {
    data class State(val busy: Boolean = false, val status: String = "", val deck: JsonObject? = null, val error: String? = null, val trace: String? = null)

    private val thread = java.util.concurrent.Executors.newSingleThreadExecutor { r -> Thread(null, r, "random-build", 8L shl 20).apply { isDaemon = true } }.asCoroutineDispatcher()
    private val scope = CoroutineScope(SupervisorJob() + thread)
    private var qjs: QuickJs? = null
    private var source: () -> String = { "" }
    private val _state = MutableStateFlow(State()); val state: StateFlow<State> = _state
    private val answers = ConcurrentLinkedQueue<Triple<Int, Int, Pair<String, String>>>()
    private val client by lazy { OkHttpClient.Builder().callTimeout(20, TimeUnit.SECONDS).build() }
    private var run: kotlinx.coroutines.Job? = null

    fun init(context: Context) { val app = context.applicationContext; source = { app.assets.open("random-build.js").bufferedReader().readText() } }
    /** For tests: the bundle from a file. */
    fun initFrom(file: File) { source = { file.readText() } }

    private fun js(): QuickJs = qjs ?: QuickJs.create().also { q ->
        q.maxStackSize = 6L shl 20
        q.evaluate(source(), "random-build.js")
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        qjs = q
    }

    /** createRandomDeckProducer({format, targetBracket, deckStyle}): Standard or Commander, like the site's Play. */
    fun start(format: String, targetBracket: Int? = null, deckStyle: String = "classic") {
        run?.cancel()
        _state.value = State(busy = true, status = "Choosing a build-around…")
        run = scope.launch { try { loop(format, targetBracket, deckStyle) } catch (e: kotlinx.coroutines.CancellationException) { throw e }
            catch (e: Throwable) { _state.value = State(error = "The deck builder stopped: ${e.message ?: e.javaClass.simpleName}") } }
    }

    private suspend fun loop(format: String, targetBracket: Int?, deckStyle: String) {
            val q = js()
            val ask = JsonObject().apply { addProperty("format", format); if (targetBracket != null) addProperty("targetBracket", targetBracket); addProperty("deckStyle", deckStyle) }
            q.evaluate("RandomBuild.start(" + JsonPrimitive(ask.toString()) + ")")
            while (true) {
                while (true) { val a = answers.poll() ?: break; q.evaluate("__host.answer(${a.first}, ${a.second}, ${JsonPrimitive(a.third.first)}, ${JsonPrimitive(a.third.second)})") }
                val p = JsonParser.parseString(q.evaluate("__host.pump(${System.currentTimeMillis()})") as String).asJsonObject
                for (r in p.getAsJsonArray("requests")) send(r.asJsonObject)
                val s = JsonParser.parseString(q.evaluate("RandomBuild.poll()") as String).asJsonObject
                val st = State(s.get("busy").asBoolean, s.get("status")?.takeIf { it.isJsonPrimitive }?.asString ?: "",
                    s.get("deck")?.takeIf { it.isJsonObject }?.asJsonObject, s.get("error")?.takeIf { it.isJsonPrimitive }?.asString, s.get("trace")?.takeIf { it.isJsonPrimitive }?.asString)
                if (st != _state.value) _state.value = st
                if (!st.busy) break
                if (p.get("ran").asInt == 0 && answers.isEmpty()) {
                    val next = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
                    delay(if (next != null) (next - System.currentTimeMillis()).coerceIn(1, 25) else 15)
                }
            }
    }

    fun cancel() { run?.cancel(); scope.launch { qjs?.evaluate("RandomBuild.cancel()") }; _state.value = State(status = "Build cancelled.") }

    private val JSON = "application/json".toMediaType()
    private fun send(r: JsonObject) {
        val id = r.get("id").asInt
        val raw = r.get("url").asString
        val url = if (raw.startsWith("/")) "https://cardstashy.com$raw" else raw
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

    /** Tests: the build to the end on the calling thread's terms. */
    suspend fun awaitDone(): State { while (true) { val s = _state.value; if (!s.busy) return s; delay(50) } }
}
