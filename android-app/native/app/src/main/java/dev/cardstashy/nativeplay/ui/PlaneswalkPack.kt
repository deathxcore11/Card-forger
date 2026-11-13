package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.webkit.WebResourceResponse
import org.json.JSONObject

/**
 * Gap audit G6: Planeswalk ships inside the app. The site's planeswalk.html (unchanged) and every script and style it loads are packed
 * into assets/planeswalk at build time (scripts/export-planeswalk.mjs, its manifest.json lists them). The in-app website answers them
 * from the pack at their own address, https://cardstashy.com/planeswalk.html, so a run the player already has there is kept.
 * Only while Planeswalk is the page open: the rest of the site always comes from the site.
 */
object PlaneswalkPack {
    const val PAGE = "/planeswalk.html"
    @Volatile private var files: Set<String>? = null
    /** The pack's file list (paths without a leading slash), read once; empty when this build has no pack. */
    fun files(context: Context): Set<String> = files ?: runCatching {
        val o = JSONObject(context.assets.open("planeswalk/manifest.json").bufferedReader().readText())
        val a = o.getJSONArray("files"); (0 until a.length()).map { a.getString(it) }.toSet()
    }.getOrDefault(emptySet()).also { files = it }
    fun isPage(url: android.net.Uri) = url.scheme == "https" && url.host == "cardstashy.com" && url.path == PAGE
    internal fun mime(path: String) = when (path.substringAfterLast('.')) {
        "html" -> "text/html"; "js", "mjs" -> "text/javascript"; "css" -> "text/css"; "json" -> "application/json"; else -> "application/octet-stream" }
    /** The packed answer for [url], or null to let the site answer. */
    fun serve(context: Context, url: android.net.Uri): WebResourceResponse? {
        if (url.scheme != "https" || url.host != "cardstashy.com") return null
        val path = url.path?.removePrefix("/") ?: return null
        if (path !in files(context)) return null
        val body = runCatching { context.assets.open("planeswalk/$path") }.getOrNull() ?: return null
        return WebResourceResponse(mime(path), "utf-8", body).apply { responseHeaders = mapOf("Cache-Control" to "no-cache", "Access-Control-Allow-Origin" to "https://cardstashy.com") }
    }
}
