package dev.cardstashy.nativeplay.play

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.MutableContextWrapper
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import app.cash.zipline.QuickJs
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit

/**
 * The site's random deck builder, run as the site's own code (assets/random-build.js: deck-pipeline, builder,
 * deck-forge, deck-optimizer, deck-construction, power, play-opponent-build and app.js's wiring, bundled by
 * scripts/export-random-build.mjs). Nothing about a deck is decided here: this only carries the bundle's
 * fetches over the network, runs its queued jobs and timers, and reads its status line and result.
 *
 * Two engines run the same bundle. The phone's WebView (Chrome's JIT, assets/random-build-web.js) goes first: a Commander deck
 * takes about as long as on the website (14 s in Chrome against 112 s in QuickJS for the same code). QuickJS (assets/random-build.js)
 * takes over when the WebView can't load the page or its process dies, and in the JVM tests, which have no WebView.
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

    private var app: Context? = null
    fun init(context: Context) { val a = context.applicationContext; app = a; source = { a.assets.open("random-build.js").bufferedReader().readText() } }
    /** For tests: the bundle from a file, in QuickJS. */
    fun initFrom(file: File) { source = { file.readText() }; app = null }

    private fun js(): QuickJs = qjs ?: QuickJs.create().also { q ->
        q.maxStackSize = 6L shl 20
        q.evaluate(source(), "random-build.js")
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        qjs = q
    }

    /** Not while a match is on the table or the app is out of sight (app.js playRandomQueue idle()): queued builds wait. */
    @Volatile var paused = false; set(v) { if (field != v) { field = v; idleChanged() } }
    @Volatile var hidden = false; set(v) { if (field != v) { field = v; idleChanged() } }
    private fun idleChanged() { scope.launch { if (webReady != null || qjs != null) runCatching { eval("RandomBuild.idle(${!paused && !hidden})") } } }
    private var pump: kotlinx.coroutines.Job? = null
    private val wake = kotlinx.coroutines.channels.Channel<Unit>(kotlinx.coroutines.channels.Channel.CONFLATED)

    /** The formats the site's random builder makes (play-opponent-build.js RANDOM_DECK_FORMATS). */
    val FORMATS = listOf("Standard", "Commander", "Modern", "Pioneer", "Legacy", "Vintage", "Pauper", "Standard Brawl")

    /** The build the app is waiting for: a status or result the bundle tags with another ticket is an older one's. */
    @Volatile private var ticket = 0
    private fun ask(format: String, targetBracket: Int?, deckStyle: String, power: String?) = JsonObject().apply {
        addProperty("format", format); if (targetBracket != null) addProperty("targetBracket", targetBracket); addProperty("deckStyle", deckStyle)
        if (power == "strong") addProperty("power", "strong")
    }
    private fun scoped(user: String?) = "RandomBuild.scope(" + JsonPrimitive(com.google.gson.JsonArray().apply { add(user) }.toString()) + ");"

    /**
     * createPracticeOpponentBuilder build() as the bundle runs it: a deck the background queue already finished comes at once,
     * one it is still building is awaited, else one is built now ({format, targetBracket, deckStyle, power}; power "strong" is
     * Deck Forge's strong build, and Commander brackets 3+ build strong anyway).
     */
    fun start(format: String, targetBracket: Int? = null, deckStyle: String = "classic", power: String? = null, user: String? = null, choice: Choice? = null) {
        val mine = ++ticket
        _state.value = State(busy = true, status = if (choice?.seedCard != null) "Finding cards for your plan…" else "Choosing a build-around…")
        val a = ask(format, targetBracket, deckStyle, power).apply { addProperty("ticket", mine); choice?.into(this) }
        val expr = scoped(user) + "RandomBuild.start(" + JsonPrimitive(a.toString()) + ")"
        lastStart = expr
        scope.launch { try { eval(expr) }
            catch (e: kotlinx.coroutines.CancellationException) { throw e }
            catch (e: Throwable) { if (ticket == mine) _state.value = State(error = "The deck builder stopped: ${e.message ?: e.javaClass.simpleName}") } }
    }
    /**
     * Build a deck's choices (deck-experience.js): the build-around card (from [card] or [named]) or a name to resolve, and the
     * optional theme, match mode and "Prefer simpler plans". With any of them the build skips the background queue.
     */
    class Choice(val seedCard: JsonObject? = null, val seed: String? = null, val theme: String? = null, val matchMode: String? = null, val easy: Boolean = false) {
        internal fun into(o: JsonObject) {
            seedCard?.let { o.add("seedCard", it) }; seed?.takeIf { it.isNotBlank() }?.let { o.addProperty("seed", it) }
            theme?.takeIf { it.isNotBlank() }?.let { o.addProperty("theme", it) }; matchMode?.takeIf { it != "unspecified" }?.let { o.addProperty("matchMode", it) }
            if (easy) o.addProperty("easy", true)
        }
    }
    /** deck-experience.js themes.mtg: Build a deck's Theme choices. */
    suspend fun themes(): List<String> = withContext(thread) {
        runCatching { JsonParser.parseString(eval("RandomBuild.themes()", pump = false)!!).asJsonArray.map { it.asString } }.getOrDefault(emptyList())
    }
    /** A random build-around for [format] (and [theme]), as the site's Random card picks it (app.js randomBuildSeed); null if none came. */
    suspend fun card(format: String, theme: String? = null): JsonObject? = call("card", JsonObject().apply { addProperty("format", format); theme?.takeIf { it.isNotBlank() }?.let { addProperty("theme", it) } })
    /** The card a player typed in Change card (app.js resolve, fuzzy); null if Scryfall has none by that name. */
    suspend fun named(name: String): JsonObject? = call("named", JsonObject().apply { addProperty("name", name) })

    private val calls = java.util.concurrent.ConcurrentHashMap<Int, CompletableDeferred<JsonObject>>()
    private val callIds = java.util.concurrent.atomic.AtomicInteger()
    private suspend fun call(name: String, a: JsonObject): JsonObject? = withContext(thread) {
        val id = callIds.incrementAndGet(); val d = CompletableDeferred<JsonObject>(); calls[id] = d
        try {
            eval("RandomBuild.call($id, ${JsonPrimitive(name)}, ${JsonPrimitive(a.toString())})")
            withTimeoutOrNull(30_000) { d.await() }?.takeIf { it.get("ok")?.asBoolean == true }?.get("value")?.takeIf { it.isJsonObject }?.asJsonObject
        } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (_: Throwable) { null } finally { calls.remove(id) }
    }
    /** takeDone()'s finished calls ({id, ok, value} or {id, ok: false, error}): each answers the call that waits for it. */
    private fun delivered(json: String?) {
        if (json.isNullOrEmpty()) return
        runCatching { JsonParser.parseString(json).asJsonArray.forEach { e -> val o = e.asJsonObject; calls[o.get("id").asInt]?.complete(o) } }
    }

    // ── Collection's Build a deck (deck-flow-entry.mjs: deck-experience.js's setup and result, on the same pipeline) ──
    // It runs only in the WebView: a phone without one opens the website's Build a deck instead.
    /** A flow call's answer: its value, or the site's message when it threw. */
    class Flow(val value: JsonElement?, val error: String?) {
        val obj: JsonObject? get() = value?.takeIf { it.isJsonObject }?.asJsonObject
    }
    /** DeckFlow.status(): the build's live line (deck-experience.js onStatus), "" when nothing builds. */
    private val _flowStatus = MutableStateFlow(""); val flowStatus: StateFlow<String> = _flowStatus
    /** True once the WebView has the bundle (it starts it if needed); false on a phone that can't run it. */
    suspend fun flowReady(): Boolean = withContext(thread) { webEngine() != null }
    /** One of deck-flow-entry.mjs's flowCalls ([name], with [a]); a build waits up to [ms]. */
    suspend fun flow(name: String, a: JsonObject, ms: Long = 300_000): Flow = withContext(thread) {
        val w = webEngine() ?: return@withContext Flow(null, "Build a deck needs the website on this phone.")
        val id = callIds.incrementAndGet(); val d = CompletableDeferred<JsonObject>(); calls[id] = d
        try {
            evalWeb(w, "RandomBuild.call($id, ${JsonPrimitive(name)}, ${JsonPrimitive(a.toString())})")
            val o = withTimeoutOrNull(ms) { d.await() } ?: return@withContext Flow(null, "The deck builder took too long. Try again.")
            if (o.get("ok")?.asBoolean == true) Flow(o.get("value"), null) else Flow(null, o.get("error")?.takeIf { it.isJsonPrimitive }?.asString ?: "The deck builder stopped.")
        } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Throwable) { Flow(null, e.message ?: "The deck builder stopped.") } finally { calls.remove(id) }
    }
    /** A.flowCancelBuild: the build or the card pick in hand stops (its answer comes back {cancelled}). */
    fun flowCancel() { _flowStatus.value = ""; scope.launch { if (webReady != null) runCatching { withContext(Dispatchers.Main) { web }?.let { evalWeb(it, "DeckFlow.cancel()") } } } }

    /** The build in hand, so QuickJS can run it again if the WebView's process dies under it. */
    @Volatile private var lastStart: String? = null

    /**
     * app.js warmPlayRandom (each time Play opens, signed in, at most every 30 s): a Casual and a Strong deck for the format in
     * play, Commander and Standard start building in the background, one at a time, so Build random deck hands one over at once.
     */
    private var warmedAt = 0L
    fun warm(format: String, user: String?) {
        if (user == null || System.currentTimeMillis() - warmedAt < 30_000) return
        warmedAt = System.currentTimeMillis()
        enqueue(listOf(format, "Commander", "Standard").distinct().filter { it in FORMATS }.flatMap { f -> listOf(f to null, f to "strong") }, user)
    }
    /** The queue builds a deck for each (format, power) in the background (play-random-queue.js warm). */
    internal fun enqueue(asks: List<Pair<String, String?>>, user: String?) {
        val a = com.google.gson.JsonArray().apply { asks.forEach { (f, p) -> add(ask(f, null, "classic", p)) } }
        // The WebView's first start costs the main thread a moment, so not while Home is still drawing.
        scope.launch { if (app != null && webReady == null) delay(2_000); runCatching { eval(scoped(user) + "RandomBuild.warm(" + JsonPrimitive(a.toString()) + ")") } }
    }

    /** Decks the queue has ready for [format] (play-random-queue.js peek), with their Power. */
    suspend fun ready(format: String): List<JsonObject> = withContext(thread) {
        if (webReady == null && qjs == null) return@withContext emptyList()
        runCatching { JsonParser.parseString(eval("RandomBuild.peek(" + JsonPrimitive(format) + ")", pump = false)!!).asJsonArray.map { it.asJsonObject } }.getOrDefault(emptyList())
    }

    /** Runs [expr] in the engine that has the bundle (the WebView, else QuickJS) and returns its string result. On the build thread. */
    private suspend fun eval(expr: String, pump: Boolean = true): String? {
        val w = webEngine()
        if (w != null) return evalWeb(w, expr)?.let { r -> runCatching { JsonParser.parseString(r) }.getOrNull()?.takeIf { it.isJsonPrimitive }?.asString }
        val r = js().evaluate(expr) as? String
        if (pump) pumping()
        return r
    }

    // Runs the bundle's jobs, timers and fetches while anything is pending (a build here, the queue's background builds), and stops
    // when it is quiet. Between turns it waits for the next fetch answer or the next timer, not a fixed sleep.
    private fun pumping() {
        if (pump?.isActive == true) { wake.trySend(Unit); return }
        pump = scope.launch {
            val q = js()
            while (true) {
                while (true) { val a = answers.poll() ?: break; q.evaluate("__host.answer(${a.first}, ${a.second}, ${JsonPrimitive(a.third.first)}, ${JsonPrimitive(a.third.second)})") }
                q.evaluate("RandomBuild.idle(${!paused && !hidden})")
                val p = JsonParser.parseString(q.evaluate("__host.pump(${System.currentTimeMillis()})") as String).asJsonObject
                for (r in p.getAsJsonArray("requests")) send(r.asJsonObject)
                publish(q.evaluate("RandomBuild.poll()") as String?)
                delivered(q.evaluate("RandomBuild.takeDone()") as String?)
                val open = p.get("open").asInt; val next = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
                if (p.get("ran").asInt > 0 || answers.isNotEmpty()) continue
                if (calls.isNotEmpty() && open == 0 && next == null) { kotlinx.coroutines.withTimeoutOrNull(250) { wake.receive() }; continue }
                if (open == 0 && next == null) break
                val wait = if (next != null) (next - System.currentTimeMillis()).coerceAtLeast(0) else 30_000
                if (wait > 0) kotlinx.coroutines.withTimeoutOrNull(wait) { wake.receive() }
            }
        }
    }

    /** The bundle's poll() result, when it is the build the app is waiting for (its ticket) and that build is still on screen. */
    private fun publish(json: String?) {
        val s = runCatching { JsonParser.parseString(json ?: return) }.getOrNull()?.takeIf { it.isJsonObject }?.asJsonObject ?: return
        if (s.get("ticket")?.takeIf { it.isJsonPrimitive }?.asInt != ticket) return
        val st = State(s.get("busy").asBoolean, s.get("status")?.takeIf { it.isJsonPrimitive }?.asString ?: "",
            s.get("deck")?.takeIf { it.isJsonObject }?.asJsonObject, s.get("error")?.takeIf { it.isJsonPrimitive }?.asString, s.get("trace")?.takeIf { it.isJsonPrimitive }?.asString)
        if (st != _state.value && _state.value.busy) _state.value = st
    }

    fun cancel() { ticket++; lastStart = null; scope.launch { if (webReady != null || qjs != null) runCatching { eval("RandomBuild.cancel()", pump = false) } }; _state.value = State(status = "Build cancelled.") }

    // ── The WebView engine ──
    // A page at https://cardstashy.com/ (the site's origin, so its relative api/ fetches and Scryfall's CORS work as on the site) loads
    // assets/random-build-web.js; a 100 ms loop in the page hands each new poll() result to [Bridge.state]. The view sits in the
    // activity's window, 1 px, transparent and behind the app, so Chrome counts the page as on screen and runs its timers at full speed.
    private var web: WebView? = null                         // main thread
    private var webCtx: MutableContextWrapper? = null         // main thread
    private var host: WeakReference<ViewGroup>? = null        // main thread
    @Volatile private var webReady: CompletableDeferred<Boolean>? = null // set on the build thread
    @Volatile private var webFailed = false
    private const val PAGE = "<!doctype html><meta charset=\"utf-8\"><script src=\"/__native/random-build-web.js\"></script>" +
        "<script>(function(){var ok=typeof RandomBuild==='object';NativeRandom.ready(ok);if(!ok)return;var last=null;" +
        "var lf='';setInterval(function(){var s=RandomBuild.poll();if(s!==last){last=s;NativeRandom.state(s);}var d=RandomBuild.takeDone();if(d)NativeRandom.done(d);" +
        "var f=typeof DeckFlow==='object'?DeckFlow.status():'';if(f!==lf){lf=f;NativeRandom.flow(f);}},100);})();</script>"

    private class Bridge(val ready: CompletableDeferred<Boolean>) {
        @JavascriptInterface fun ready(ok: Boolean) { ready.complete(ok) }
        @JavascriptInterface fun state(json: String?) { publish(json) }
        @JavascriptInterface fun done(json: String?) { delivered(json) }
        @JavascriptInterface fun flow(status: String?) { _flowStatus.value = status ?: "" }
    }

    /** The WebView once its page has the bundle, or null when this phone can't run it (QuickJS then, for the rest of the session). */
    private suspend fun webEngine(): WebView? {
        val a = app ?: return null
        if (webFailed) return null
        val r = webReady ?: CompletableDeferred<Boolean>().also { d ->
            webReady = d
            withContext(Dispatchers.Main) { createWeb(a, d) }
            if (withTimeoutOrNull(20_000) { d.await() } == true) withContext(Dispatchers.Main) { web }?.let { evalWeb(it, "RandomBuild.idle(${!paused && !hidden})") }
        }
        if (withTimeoutOrNull(20_000) { r.await() } != true) { dropWeb("the page did not load"); return null }
        return withContext(Dispatchers.Main) { web } ?: run { webFailed = true; null }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun createWeb(a: Context, ready: CompletableDeferred<Boolean>) {
        try {
            val ctx = MutableContextWrapper(a)
            val w = WebView(ctx)
            w.settings.javaScriptEnabled = true
            w.settings.domStorageEnabled = false // the bundle keeps its caches in memory (random-build-web-prelude.js)
            w.settings.blockNetworkImage = true
            w.isFocusable = false; w.isFocusableInTouchMode = false; w.alpha = 0f
            w.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            w.addJavascriptInterface(Bridge(ready), "NativeRandom")
            w.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? =
                    if (req.url.host == "cardstashy.com" && req.url.path == "/__native/random-build-web.js")
                        WebResourceResponse("application/javascript", "utf-8", a.assets.open("random-build-web.js")) else null
                override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest) = true
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean { gone(view); return true }
            }
            web = w; webCtx = ctx; place()
            w.loadDataWithBaseURL("https://cardstashy.com/", PAGE, "text/html", "utf-8", null)
        } catch (e: Throwable) {
            android.util.Log.w("RandomBuild", "WebView unavailable, using QuickJS", e)
            web = null; ready.complete(false)
        }
    }

    private suspend fun evalWeb(w: WebView, expr: String): String? = withTimeoutOrNull(15_000) {
        withContext(Dispatchers.Main) { suspendCancellableCoroutine { c -> w.evaluateJavascript(expr) { r -> if (c.isActive) c.resumeWith(Result.success(r)) } } }
    }

    /** The WebView can't run the builder: QuickJS takes over for the rest of the session. */
    private suspend fun dropWeb(why: String) {
        android.util.Log.w("RandomBuild", "WebView engine dropped: $why")
        webFailed = true
        withContext(Dispatchers.Main) { web?.let { (it.parent as? ViewGroup)?.removeView(it); it.destroy() }; web = null }
    }

    /** The WebView's process died (low memory, an update): QuickJS takes over, and runs again the build that was on screen. */
    private fun gone(view: WebView) {
        webFailed = true; webReady?.complete(false)
        if (web === view) { (view.parent as? ViewGroup)?.removeView(view); view.destroy(); web = null }
        val again = lastStart
        if (again != null && _state.value.busy) scope.launch { runCatching { eval(again) } }
    }

    /** MainActivity onCreate: the WebView joins this activity's window (see the engine notes above). */
    fun attach(activity: Activity) { host = WeakReference(activity.findViewById(android.R.id.content)); place() }
    /** MainActivity onDestroy: the WebView leaves the window, and lets go of the activity. */
    fun detach(activity: Activity) {
        val g = activity.findViewById<ViewGroup>(android.R.id.content)
        web?.let { if (it.parent === g) g.removeView(it) }
        app?.let { webCtx?.setBaseContext(it) }
        if (host?.get() === g) host = null
    }
    private fun place() {
        val w = web ?: return; val g = host?.get() ?: return
        if (w.parent === g) return
        (w.parent as? ViewGroup)?.removeView(w)
        webCtx?.setBaseContext(g.context)
        g.addView(w, 0, FrameLayout.LayoutParams(1, 1))
    }

    private val JSON = "application/json".toMediaType()
    private val SITE = "https://cardstashy.com/".toHttpUrl()
    private fun send(r: JsonObject) {
        val id = r.get("id").asInt
        // Relative addresses (api/meta/…, /data/…) are the site's, as the page at https://cardstashy.com/ resolves them.
        val url = SITE.resolve(r.get("url").asString)?.toString() ?: r.get("url").asString
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
            answers.add(ans); wake.trySend(Unit)
        }
    }

    /** Tests: the build to the end on the calling thread's terms. */
    suspend fun awaitDone(): State { while (true) { val s = _state.value; if (!s.busy) return s; delay(50) } }
    /** Tests: until the queue has a deck ready for [format]. */
    suspend fun awaitReady(format: String, n: Int = 1): List<JsonObject> { while (true) { val r = ready(format); if (r.size >= n) return r; delay(200) } }
}
