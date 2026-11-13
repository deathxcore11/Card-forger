package dev.cardstashy.nativeplay.collection

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
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.ui.CollectionWrites
import dev.cardstashy.nativeplay.ui.SitePanelModel
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The Scanner's engine: the site's own scanner (scancam.js with app.js's scanCtx, bundled by scripts/export-collection-engine.mjs
 * from scripts/scan-web-entry.mjs as assets/scan-web.js) in a hidden WebView at https://cardstashy.com/, whose canvas, images and
 * text reader (vendor tesseract.js) are the browser's own, as on the website. Nothing about a scan is decided here: the page's markup
 * comes back as the tree SitePanel draws ([model]), taps and typing go in ([tap], [type]), and the phone's camera frames are painted
 * into the canvas scancam reads as its video ([frame]). What the scanner saves (a batch, an "Add to" binder) and a review's condition
 * price run in the Collection engine through CollectionWrites, as app.js runs them; a card's page goes to the screen ([acted]).
 */
object ScanWeb {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _model = MutableStateFlow<SitePanelModel?>(null); val model: StateFlow<SitePanelModel?> = _model
    private val _acted = MutableSharedFlow<JsonObject>(extraBufferCapacity = 8); val acted: SharedFlow<JsonObject> = _acted
    /** The flashlight, as scancam's track.applyConstraints asks for it (the screen's camera sets it). */
    @Volatile var torch: (Boolean) -> Unit = {}

    private var app: Context? = null
    fun init(context: Context) { app = context.applicationContext }

    private var web: WebView? = null
    private var webCtx: MutableContextWrapper? = null
    private var host: WeakReference<ViewGroup>? = null
    private var ready: CompletableDeferred<Boolean>? = null

    private const val PAGE = "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\">" +
        "<body></body><script src=\"/__native/scan-web.js\"></script>"

    // The page pushes its whole markup up to every 30 ms while scanning: only the newest is parsed, off the main thread, at most
    // every 120 ms, and a push the same as the last is dropped.
    private val pushes = Channel<String>(Channel.CONFLATED)
    @Volatile private var lastPush: String? = null
    init {
        CoroutineScope(SupervisorJob() + Dispatchers.Default).launch {
            for (j in pushes) {
                if (j == lastPush) continue
                lastPush = j
                val m = runCatching { SitePanelModel.parse(JsonParser.parseString(j).asJsonObject) }.getOrNull() ?: continue
                withContext(Dispatchers.Main) { _model.value = m }
                delay(120)
            }
        }
    }
    // A camera frame waiting in the page: newer ones are dropped until it has been handed over.
    private val framing = AtomicBoolean(false)

    private class Bridge {
        @JavascriptInterface fun ready() { scope.launch { ready?.complete(true) } }
        @JavascriptInterface fun model(json: String?) { val j = json ?: return; pushes.trySend(j) }
        @JavascriptInterface fun toast(text: String?) { if (!text.isNullOrBlank()) scope.launch { CollectionWrites.show(text) } }
        @JavascriptInterface fun acted(json: String?) { val j = json ?: return; scope.launch { runCatching { _acted.tryEmit(JsonParser.parseString(j).asJsonObject) } } }
        @JavascriptInterface fun torch(on: Boolean) { scope.launch { torch(on) } }
        @JavascriptInterface fun call(id: Int, name: String?, json: String?) { scope.launch { answer(id, name.orEmpty(), json) } }
    }

    /**
     * scanCtx's calls that write or price, in the Collection engine (its writeActs scanAddMany, scanRemember, scanCondition); the
     * answer resolves the page's promise (ok with the result, else the message the scanner shows).
     */
    private suspend fun answer(id: Int, name: String, json: String?) {
        val c = app ?: return
        val d = runCatching { JsonParser.parseString(json ?: "null") }.getOrNull()?.takeIf { it.isJsonObject }?.asJsonObject ?: JsonObject()
        val kind = when (name) { "addMany" -> "scanAddMany"; "rememberLocation" -> "scanRemember"; "conditionPrice" -> "scanCondition"; else -> null }
        if (kind == null) { reply(id, false, "{\"message\":\"Not available here.\"}"); return }
        // A signed-out review has no condition feed: the scanner keeps its list price (scanCtx's own failure answer).
        if (kind == "scanCondition" && Account.session.value == null) { reply(id, false, "{\"message\":\"Sign in for condition prices.\"}"); return }
        if (kind == "scanCondition") {
            val r = runCatching { CollectionWrites.actRaw(c, kind, d) }.getOrNull()
            val made = r?.get("made")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotEmpty() }
            if (made == null) reply(id, false, "{\"message\":\"Condition price unavailable.\"}") else reply(id, true, made)
            return
        }
        if (kind == "scanRemember") {
            val r = runCatching { CollectionWrites.actRaw(c, kind, d) }.getOrNull()
            val err = r?.get("error")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }
            if (r == null || err != null) reply(id, false, JsonObject().apply { addProperty("message", err ?: "Could not save to your collection. Try again.") }.toString())
            else { if ((r.get("writes")?.asInt ?: 0) > 0) { CollectionWrites.settleLater(c); refresh() }; reply(id, true, "true") }
            return
        }
        var made: String? = null
        val saved = runCatching { CollectionWrites.act(c, kind, d) { r -> made = r.get("made")?.takeIf { it.isJsonPrimitive }?.asString } }.getOrDefault(false)
        if (!saved) { reply(id, false, "{\"message\":\"Could not save to your collection. Try again.\"}"); return }
        refresh()
        reply(id, true, made?.takeIf { it.isNotEmpty() } ?: "true")
    }
    /** The page's copy of the workspace after a save (what's owned, binders), as the site's page reads S.state. */
    private suspend fun refresh() {
        val expr = runCatching { CollectionEngine.scanWorkspace() }.getOrNull()?.let { withContext(Dispatchers.Default) { "ScanWeb.workspace(${JsonPrimitive(it)})" } } ?: return
        withContext(Dispatchers.Main) { run(expr) }
    }
    private fun reply(id: Int, ok: Boolean, json: String) = run("ScanWeb.answer($id, $ok, ${JsonPrimitive(json)})")

    /** The page with the bundle, made once; false when this phone's WebView can't run it. */
    private suspend fun page(): WebView? {
        val a = app ?: return null
        val r = ready ?: CompletableDeferred<Boolean>().also { ready = it; create(a, it) }
        if (withTimeoutOrNull(20_000) { r.await() } != true) { drop(); return null }
        return web
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun create(a: Context, done: CompletableDeferred<Boolean>) {
        try {
            val ctx = MutableContextWrapper(a)
            val w = WebView(ctx)
            w.settings.javaScriptEnabled = true
            w.settings.domStorageEnabled = true // scancam keeps the batch ("Your scans") and its settings in localStorage, as on the site
            w.settings.mediaPlaybackRequiresUserGesture = false
            w.isFocusable = false; w.isFocusableInTouchMode = false; w.alpha = 0f
            w.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            w.addJavascriptInterface(Bridge(), "NativeScan")
            w.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                    if (req.url.host != "cardstashy.com") return null
                    val file = when (req.url.path) {
                        "/__native/scan-web.js" -> "scan-web.js"
                        "/vendor/tesseract.min.js" -> "vendor/tesseract.min.js"
                        "/vendor/worker.min.js" -> "vendor/worker.min.js"
                        // The text reader's engine and English data ship in the app, so the first scan needs no download.
                        "/vendor/tess/tesseract-core-simd-lstm.wasm.js" -> "vendor/tess/tesseract-core-simd-lstm.wasm.js"
                        "/vendor/tess/eng.traineddata.gz" -> "vendor/tess/eng.traineddata.gz"
                        else -> return null
                    }
                    val stream = runCatching { a.assets.open(file) }.getOrNull() ?: return null
                    return if (file.endsWith(".gz")) WebResourceResponse("application/octet-stream", null, stream)
                    else WebResourceResponse("application/javascript", "utf-8", stream)
                }
                override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest) = true
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    if (web === view) { (view.parent as? ViewGroup)?.removeView(view); view.destroy(); web = null; ready = null; _model.value = null; lastPush = null; framing.set(false) }
                    return true
                }
            }
            web = w; webCtx = ctx; place()
            w.loadDataWithBaseURL("https://cardstashy.com/", PAGE, "text/html", "utf-8", null)
        } catch (e: Throwable) {
            android.util.Log.w("ScanWeb", "WebView unavailable", e)
            web = null; done.complete(false)
        }
    }
    private fun drop() { web?.let { (it.parent as? ViewGroup)?.removeView(it); it.destroy() }; web = null; ready = null; lastPush = null; framing.set(false) }

    private fun run(expr: String) { web?.evaluateJavascript(expr, null) }
    private suspend fun eval(w: WebView, expr: String): String? = withTimeoutOrNull(15_000) {
        suspendCancellableCoroutine { c -> w.evaluateJavascript(expr) { r -> if (c.isActive) c.resumeWith(Result.success(r)) } }
    }

    /**
     * Opens the Scanner for [game] on the collection as this device keeps it ([workspace]: CollectionEngine.scanWorkspace), signed in as
     * [user] (the AI read's token [token]); [camera] / [flash]: what the phone has; [w]×[h]: the preview in dp. False when the page
     * can't run here.
     */
    suspend fun open(game: String, workspace: String?, user: String?, token: String?, camera: Boolean, flash: Boolean, w: Int, h: Int): Boolean = withContext(Dispatchers.Main) {
        val v = page() ?: return@withContext false
        // The workspace is the whole collection: it is parsed and escaped off the main thread, and so is the page's answer.
        val expr = withContext(Dispatchers.Default) {
            val o = JsonObject().apply {
                addProperty("game", game); workspace?.let { runCatching { add("state", JsonParser.parseString(it)) } }
                addProperty("user", user.orEmpty()); addProperty("token", token.orEmpty()); addProperty("camera", camera); addProperty("torch", flash)
                add("preview", JsonObject().apply { addProperty("w", w); addProperty("h", h) })
            }
            "ScanWeb.open(${JsonPrimitive(o.toString())})"
        }
        val m = eval(v, expr) ?: return@withContext false
        withContext(Dispatchers.Default) {
            runCatching { JsonParser.parseString(m).takeIf { it.isJsonPrimitive }?.asString }.getOrNull()?.let { j ->
                runCatching { SitePanelModel.parse(JsonParser.parseString(j).asJsonObject) }.getOrNull()?.let { j to it } }
        }?.let { (j, p) -> lastPush = j; _model.value = p }
        true
    }
    fun tap(id: Int) = run("ScanWeb.tap($id)")
    fun type(id: Int, value: String) = run("ScanWeb.type($id, ${JsonPrimitive(value)})")
    /** Photos for a file input: [files] (name, MIME type, bytes). Encoded on the caller's thread (full-size photos), handed over on main. */
    fun files(id: Int, files: List<Triple<String, String, ByteArray>>) {
        val a = com.google.gson.JsonArray()
        files.forEach { (n, t, b) -> a.add(JsonObject().apply { addProperty("name", n); addProperty("type", t); addProperty("b64", android.util.Base64.encodeToString(b, android.util.Base64.NO_WRAP)) }) }
        val expr = "ScanWeb.files($id, ${JsonPrimitive(a.toString())})"
        scope.launch { run(expr) }
    }
    /**
     * One camera frame ([jpeg], made and encoded on the caller's thread): the page paints the newest when it is free. False, and
     * [jpeg] not made, while the last frame is still on its way in.
     */
    fun frame(jpeg: () -> ByteArray): Boolean {
        if (!framing.compareAndSet(false, true)) return false
        val expr = try { "ScanWeb.frame(\"${android.util.Base64.encodeToString(jpeg(), android.util.Base64.NO_WRAP)}\")" } catch (e: Throwable) { framing.set(false); throw e }
        scope.launch { val w = web; if (w == null) framing.set(false) else w.evaluateJavascript(expr) { framing.set(false) } }
        return true
    }
    /** The sheet's ✕ or a tap outside it: scanCtx.closeSheet. */
    fun closeSheet() = run("ScanWeb.closeSheet()")
    fun preview(w: Int, h: Int) = run("ScanWeb.preview($w, $h)")
    /** Leaving the Scanner: scancam stops its camera; the page and its batch stay for next time. */
    fun close() { torch = {}; run("ScanWeb.close()") }

    /** MainActivity onCreate: the page joins the window (1 px, transparent, behind the app), so Chrome runs its timers at full speed. */
    fun attach(activity: Activity) { host = WeakReference(activity.findViewById(android.R.id.content)); place() }
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
        // Never a key target: an unseen 1-px WebView holding the window's focus ate a handheld's d-pad (AYN Portal, 7 Nov).
        w.isFocusable = false; w.isFocusableInTouchMode = false
        g.addView(w, 0, FrameLayout.LayoutParams(1, 1))
    }
}
