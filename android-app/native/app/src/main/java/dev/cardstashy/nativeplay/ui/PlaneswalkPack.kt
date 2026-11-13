package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.webkit.WebResourceResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Gap audit G6: Planeswalk ships inside the app. The site's planeswalk.html (unchanged) and every script and style it loads are packed
 * into assets/planeswalk at build time (scripts/export-planeswalk.mjs, its manifest.json lists them). The in-app website answers them
 * from the app at their own address, https://cardstashy.com/planeswalk.html, so a run the player already has there is kept.
 * Only while Planeswalk is the page open: the rest of the site always comes from the site.
 *
 * Freshness: each time Planeswalk opens online, the site's page is checked in the background (its ETag); when the site has a newer
 * one, it and its scripts are saved whole beside the pack and the next open uses them. The open itself never waits for the network.
 */
object PlaneswalkPack {
    const val PAGE = "/planeswalk.html"
    private const val SITE = "https://cardstashy.com/"
    private class Pack(val files: Set<String>, val page: String, val etag: String?, val dir: File?)
    @Volatile private var packed: Pack? = null
    @Volatile private var kept: Pack? = null
    @Volatile private var keptRead = false
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val checked = java.util.concurrent.atomic.AtomicBoolean(false)

    private fun read(json: String, dir: File?) = runCatching { JSONObject(json).let { o ->
        Pack(o.getJSONArray("files").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }, o.getString("page"), o.optString("etag").ifBlank { null }, dir) } }.getOrNull()
    private fun packed(context: Context) = packed ?: (runCatching { context.assets.open("planeswalk/manifest.json").bufferedReader().readText() }.getOrNull()
        ?.let { read(it, null) } ?: Pack(emptySet(), "", null, null)).also { packed = it }
    internal fun keptDir(context: Context) = File(context.filesDir, "planeswalk-live")
    private fun kept(context: Context): Pack? { if (!keptRead) { keptRead = true; val d = keptDir(context)
        kept = File(d, "manifest.json").takeIf { it.isFile }?.let { read(it.readText(), d) }?.takeIf { p -> p.files.all { File(d, it).isFile } } }
        return kept }
    /** The copy Planeswalk opens with: the newer one saved from the site, else the app's own pack. */
    private fun current(context: Context) = kept(context) ?: packed(context)
    fun files(context: Context): Set<String> = current(context).files

    /** The page's own Exit goes to the site's Play menu ("/#play"); in the app that is the app's Play, not the website. */
    fun leaves(url: android.net.Uri) = url.host == "cardstashy.com" && (url.path.isNullOrEmpty() || url.path == "/") && url.fragment == "play"

    /** Asks the page whether its pause menu is up ("open") or not. */
    const val MENU_JS = "(function(){var m=document.querySelector('.pw-menu');return m&&m.getClientRects().length?'open':'shut'})()"

    /**
     * B on the controller: the first press sends Escape, which closes a zoomed card or help, else opens the pause menu; B with the
     * pause menu up leaves to Play. [menu] is what [MENU_JS] answered (quoted, as evaluateJavascript gives it).
     */
    fun back(menu: String?, escape: () -> Unit, leave: () -> Unit) { if (menu?.trim('"') == "open") leave() else escape() }

    /** Escape, down then up, to the web view (the page listens for the key "Escape"). */
    fun escape(view: android.view.View) {
        val now = android.os.SystemClock.uptimeMillis()
        view.dispatchKeyEvent(android.view.KeyEvent(now, now, android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_ESCAPE, 0))
        view.dispatchKeyEvent(android.view.KeyEvent(now, now, android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_ESCAPE, 0))
    }

    fun isPage(url: android.net.Uri) = url.scheme == "https" && url.host == "cardstashy.com" && url.path == PAGE
    internal fun mime(path: String) = when (path.substringAfterLast('.')) {
        "html" -> "text/html"; "js", "mjs" -> "text/javascript"; "css" -> "text/css"; "json" -> "application/json"; else -> "application/octet-stream" }
    /** The app's answer for [url], or null to let the site answer. */
    fun serve(context: Context, url: android.net.Uri): WebResourceResponse? {
        if (url.scheme != "https" || url.host != "cardstashy.com") return null
        val path = url.path?.removePrefix("/") ?: return null
        val p = current(context)
        if (path !in p.files) return null
        val body = runCatching { p.dir?.let { File(it, path).inputStream() } ?: context.assets.open("planeswalk/$path") }.getOrNull() ?: return null
        return WebResourceResponse(mime(path), "utf-8", body).apply { responseHeaders = mapOf("Cache-Control" to "no-cache", "Access-Control-Allow-Origin" to "https://cardstashy.com") }
    }

    /** The files [path] loads as code (script src, link href, imports, a quoted "./x.js" or "./x.css"), as export-planeswalk.mjs reads them. */
    internal fun refs(path: String, text: String): Set<String> {
        val dir = path.substringBeforeLast('/', "")
        val out = mutableSetOf<String>()
        fun add(r: String) {
            if (r.contains("\${") || Regex("^(https?:|data:|blob:|//)").containsMatchIn(r)) return
            val p = runCatching { java.net.URI("x:/" + (if (dir.isEmpty()) "" else "$dir/") + r).normalize().path.removePrefix("/") }.getOrNull() ?: return
            if (Regex("\\.(js|mjs|css)$").containsMatchIn(p) && !p.startsWith("..")) out += p
        }
        if (path.endsWith(".html")) Regex("""<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']""").findAll(text).forEach { add(it.groupValues[1]) }
        Regex("""\b(?:import|export)\s[^;'"]*?from\s*["']([^"'\s]+)["']""").findAll(text).forEach { add(it.groupValues[1]) }
        Regex("""import\s*\(\s*["']([^"']+)["']\s*\)""").findAll(text).forEach { add(it.groupValues[1]) }
        Regex("""["'`](\./[\w./-]+\.(?:js|mjs|css))["'`]""").findAll(text).forEach { add(it.groupValues[1]) }
        return out
    }

    /**
     * Saves the site's newer Planeswalk into [dir]: [get] fetches a site path (null when it failed). The page is new when its sha256
     * differs from [have]; then every file it loads is fetched and the set is put in place whole, or nothing is kept.
     * Returns true when a new copy was saved.
     */
    internal fun save(dir: File, have: String, page: ByteArray, etag: String?, get: (String) -> ByteArray?): Boolean {
        val sha = java.security.MessageDigest.getInstance("SHA-256").digest(page).joinToString("") { "%02x".format(it) }
        if (sha == have) return false
        val got = linkedMapOf("planeswalk.html" to page); val queue = ArrayDeque(listOf("planeswalk.html"))
        while (queue.isNotEmpty()) { val f = queue.removeFirst()
            for (r in refs(f, String(got[f]!!))) if (r !in got) { got[r] = get(r) ?: return false; queue += r } }
        val tmp = File(dir.path + ".tmp"); tmp.deleteRecursively()
        for ((f, b) in got) File(tmp, f).apply { parentFile?.mkdirs(); writeBytes(b) }
        File(tmp, "manifest.json").writeText(JSONObject().put("page", sha).put("etag", etag ?: "").put("files", JSONArray(got.keys.sorted())).toString())
        dir.deleteRecursively(); return tmp.renameTo(dir)
    }

    /** Once per launch, when Planeswalk opens: ask the site for a newer page in the background (never holds the open). */
    fun refresh(context: Context) {
        if (!checked.compareAndSet(false, true)) return
        val app = context.applicationContext
        scope.launch {
            runCatching {
                val now = current(app)
                val client = okhttp3.OkHttpClient.Builder().callTimeout(60, java.util.concurrent.TimeUnit.SECONDS).build()
                fun fetch(path: String, etag: String? = null) = client.newCall(okhttp3.Request.Builder().url(SITE + path).apply { if (etag != null) header("If-None-Match", etag) }.build()).execute()
                // The site's ETag for the page the app already has, so an unchanged page answers 304 and is not downloaded again.
                val seen = File(app.filesDir, "planeswalk-etag.txt")
                fetch("planeswalk.html", seen.takeIf { it.isFile }?.readText()?.ifBlank { null }).use { r ->
                    if (r.code == 304 || !r.isSuccessful) return@use
                    val body = r.body?.bytes() ?: return@use
                    val saved = save(keptDir(app), now.page, body, r.header("ETag")) { p -> runCatching { fetch(p).use { x -> if (x.isSuccessful) x.body?.bytes() else null } }.getOrNull() }
                    if (saved) { keptRead = false; android.util.Log.i("Planeswalk", "a newer Planeswalk from the site is saved for the next open") }
                    if (saved || java.security.MessageDigest.getInstance("SHA-256").digest(body).joinToString("") { "%02x".format(it) } == now.page) r.header("ETag")?.let { seen.writeText(it) }
                }
            }
        }
    }
}
