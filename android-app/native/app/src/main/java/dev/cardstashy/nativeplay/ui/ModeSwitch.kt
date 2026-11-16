package dev.cardstashy.nativeplay.ui

import android.annotation.SuppressLint
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.DisposableEffect
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/** The two halves of the app. The emblem of the other half is the switch (Randall, 3 Nov). */
enum class Mode(val asset: String) { PLAY("play/play-emblem.webp"), COLLECTION("play/collection-emblem.webp") }

/**
 * A mode emblem: Randall's painted piece when it is in the app, else a code-drawn stand-in in the
 * same shape (stone disc, gold ring, four points), so the painted one drops in with no code change.
 */
@Composable
fun Emblem(mode: Mode, size: Dp, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    // Unit while loading, then the bitmap or null when the piece isn't in the app yet.
    val art by produceState<Any?>(AssetImages.cached("${mode.asset}@256") ?: Unit, mode) { value = AssetImages.load(context, mode.asset, maxWidth = 256) }
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    Box(modifier.size(size).scale(if (pressed) .92f else 1f).clickable(press, dev.cardstashy.nativeplay.ui.PadFocus.Ring, onClick = onClick), contentAlignment = Alignment.Center) {
        when (val a = art) {
            is ImageBitmap -> Image(a, null, Modifier.fillMaxSize())
            null -> Canvas(Modifier.fillMaxSize()) { drawEmblem(mode) }
            else -> {}
        }
    }
}

private fun DrawScope.drawEmblem(mode: Mode) {
    val c = center; val r = size.minDimension / 2
    val gold = Brush.linearGradient(listOf(Color(0xFFF2CF7E), Color(0xFFB8893A), Color(0xFF6E4E1C)), Offset.Zero, Offset(size.width, size.height))
    // Four points.
    for (i in 0 until 4) rotate(i * 90f, c) {
        val p = Path().apply { moveTo(c.x, c.y - r); lineTo(c.x + r * .16f, c.y - r * .62f); lineTo(c.x - r * .16f, c.y - r * .62f); close() }
        drawPath(p, gold)
    }
    drawCircle(gold, r * .78f, c)
    drawCircle(Brush.radialGradient(listOf(Color(0xFF3A3A3F), Color(0xFF141416)), c, r * .7f), r * .68f, c)
    drawCircle(Color(0x66F2CF7E), r * .68f, c, style = Stroke(r * .03f))
    when (mode) {
        Mode.PLAY -> {
            val p = Path().apply { moveTo(c.x - r * .22f, c.y - r * .34f); lineTo(c.x + r * .36f, c.y); lineTo(c.x - r * .22f, c.y + r * .34f); close() }
            drawPath(p, gold)
        }
        Mode.COLLECTION -> {
            // A small fanned stack of cards.
            val w = r * .44f; val h = r * .62f
            listOf(-14f to Color(0xFF8A6A2C), 0f to Color(0xFFB8893A), 14f to Color(0xFFF2CF7E)).forEach { (deg, col) ->
                rotate(deg, Offset(c.x, c.y + r * .4f)) {
                    drawRoundRect(col, Offset(c.x - w / 2, c.y - h / 2), Size(w, h), CornerRadius(r * .06f))
                    drawRoundRect(Color(0xFF1B1B1F), Offset(c.x - w / 2 + r * .05f, c.y - h / 2 + r * .05f), Size(w - r * .1f, h - r * .1f), CornerRadius(r * .04f), style = Stroke(r * .025f))
                }
            }
        }
    }
}

/**
 * Gap audit G5: the website inside the app is signed in as the app is. Before a cardstashy.com page opens, a tiny page served by the
 * app at that origin writes the site's own Supabase session entry (cloud.js, supabase-js's sb-<ref>-auth-token) and moves on to the
 * page. It carries the app's current access token only: its refresh token stays with the app (the page's copy cannot refresh, so the
 * app's own sign-in is never rotated away), and when it runs out the page simply asks to sign in. Never logged, never in a URL, only
 * for cardstashy.com. Signing out of the app clears the web view's storage.
 */
object WebSession {
    const val PATH = "/__native/signin"
    val KEY = "sb-" + android.net.Uri.parse(dev.cardstashy.nativeplay.account.Account.URL).host!!.substringBefore('.') + "-auth-token"
    fun ours(url: String) = runCatching { android.net.Uri.parse(url) }.getOrNull()?.let { it.scheme == "https" && (it.host == "cardstashy.com" || it.host?.endsWith(".cardstashy.com") == true) } == true
    /** The site's session entry for [s] (access token only; [s].expiresAt in seconds). */
    internal fun entry(s: dev.cardstashy.nativeplay.account.Account.Session): String = com.google.gson.JsonObject().apply {
        addProperty("access_token", s.access); addProperty("token_type", "bearer"); addProperty("expires_at", s.expiresAt)
        addProperty("expires_in", (s.expiresAt - System.currentTimeMillis() / 1000).coerceAtLeast(0))
        // Not the app's refresh token: the page cannot rotate it (and so sign the app out). Its refresh fails; it then asks to sign in.
        addProperty("refresh_token", "app-held")
        add("user", com.google.gson.JsonObject().apply { addProperty("id", s.userId); addProperty("email", s.email); addProperty("aud", "authenticated"); addProperty("role", "authenticated") })
    }.toString()
    /** The page served at [PATH]: write the entry, then open [target] in its place. */
    internal fun page(entry: String?, target: String): String {
        val q = { v: String -> com.google.gson.JsonPrimitive(v).toString().replace("</", "<\\/") }
        val write = if (entry != null) "localStorage.setItem(${q(KEY)},${q(entry)});" else ""
        return "<!doctype html><meta charset=\"utf-8\"><script>try{$write}catch(e){}location.replace(${q(target)});</script>"
    }
    fun clear() { android.os.Handler(android.os.Looper.getMainLooper()).post { runCatching { android.webkit.WebStorage.getInstance().deleteAllData() } } }
}

/**
 * Collection mode: the CardStashy app as it is on the web, until each tab goes native (big
 * picture, step 3). Back returns to Play (Randall 3 Nov: no floating Play button for now).
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun CollectionScreen(onPlay: () -> Unit, url: String = "https://cardstashy.com/", press: String? = null) {
    val web = remember { mutableStateOf<WebView?>(null) }
    // The session the page opens with, read fresh (the app refreshes its token first when it is near its end); null when signed out.
    val signedIn = remember { mutableStateOf<String?>(null) }
    val ready by produceState(false) { if (WebSession.ours(url) && dev.cardstashy.nativeplay.account.Account.session.value != null) {
        dev.cardstashy.nativeplay.account.Account.token(); signedIn.value = dev.cardstashy.nativeplay.account.Account.session.value?.let(WebSession::entry) }
        value = true }
    if (!ready) { Box(Modifier.fillMaxSize().background(Palette.Night)); return }
    // Planeswalk (G6): B pauses the run (Escape), B again with the pause menu up leaves to Play; A taps where the stick cursor is.
    val walking = remember { mutableStateOf(PlaneswalkPack.isPage(android.net.Uri.parse(url))) }
    DisposableEffect(Unit) { PadCursor.freeTap = walking.value; onDispose { PadCursor.freeTap = false } }
    BackHandler { val w = web.value
        if (w != null && walking.value) w.evaluateJavascript(PlaneswalkPack.MENU_JS) { PlaneswalkPack.back(it, { PlaneswalkPack.escape(w) }, onPlay) }
        else w?.takeIf { it.canGoBack() }?.goBack() ?: onPlay() }
    Box(Modifier.fillMaxSize().background(Palette.Night)) {
        AndroidView(factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true
                // The pressed button never came: say so instead of leaving the press silent.
                addJavascriptInterface(object { @android.webkit.JavascriptInterface fun missed() { post { android.widget.Toast.makeText(ctx, "That opens on the website. Sign in there to use it.", android.widget.Toast.LENGTH_LONG).show() } } }, "NativePress")
                webViewClient = object : WebViewClient() {
                    // The sign-in step (WebSession): served by the app at the site's own origin, once, before the page.
                    // Planeswalk (gap audit G6): while it is the page open, it and its scripts come from the app's pack.
                    @Volatile private var planeswalk = PlaneswalkPack.isPage(android.net.Uri.parse(url))
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): android.webkit.WebResourceResponse? {
                        val u = request.url
                        if (request.isForMainFrame && u.path != WebSession.PATH) { planeswalk = PlaneswalkPack.isPage(u)
                            PadCursor.freeTap = planeswalk; val p = planeswalk; view.post { walking.value = p } }
                        if (planeswalk) PlaneswalkPack.serve(ctx, u)?.let { return it }
                        if (!request.isForMainFrame || u.host != "cardstashy.com" || u.path != WebSession.PATH) return null
                        val html = WebSession.page(signedIn.value, url); signedIn.value = null
                        return android.webkit.WebResourceResponse("text/html", "utf-8", html.byteInputStream()).apply { responseHeaders = mapOf("Cache-Control" to "no-store") }
                    }
                    // Stay on CardStashy; other sites open in the browser.
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        val host = request.url.host ?: return false
                        if (planeswalk && PlaneswalkPack.leaves(request.url)) { view.post(onPlay); return true }
                        if (host == "cardstashy.com" || host.endsWith(".cardstashy.com")) return false
                        runCatching { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, request.url)) }
                        return true
                    }
                    // The page itself failed to open (seen 12 Nov, Ask on Search: "net::ERR_FAILED" from the site's saved start
                    // page on the first open after a release; the second open works): open it again, twice at most, before
                    // the person is left looking at the browser's error page.
                    private var retries = 0
                    private var failed = false
                    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                        if (!request.isForMainFrame || retries >= 2) return
                        retries++; failed = true
                        android.util.Log.w("CollectionWeb", "page failed (${error.errorCode} ${error.description}), opening again ($retries)")
                        view.postDelayed({ view.loadUrl(url) }, 350L * retries)
                    }
                    // A native button with no address of its own (pick a game, the Card of the Day): press the site's
                    // own button once the page has drawn it, trying for ten seconds.
                    private var pressed = false
                    override fun onPageFinished(view: WebView, loaded: String?) {
                        // The error page finishing is not the site: the button is pressed on the page that opens after it.
                        if (failed) { failed = false; return }
                        if (loaded?.let { android.net.Uri.parse(it).path } == WebSession.PATH) return
                        if (press == null || pressed) return
                        pressed = true
                        // Several selectors, one per line, press in turn: a tile, then a control in the sheet it opens. After a
                        // line "||" comes a second way in, tried when the first stalls: its "#..." lines move the page there.
                        val parts = press.split("\n||\n", limit = 2)
                        fun arr(t: String) = org.json.JSONArray(t.split("\n").filter { it.isNotBlank() }).toString()
                        val sels = arr(parts[0]); val alt = parts.getOrNull(1)?.let(::arr) ?: "[]"
                        view.evaluateJavascript("(function t(s,i,n,a){if(i>=s.length)return;if(s[i].charAt(0)==='#'){location.hash=s[i];setTimeout(function(){t(s,i+1,0,a)},300);return;}var b=document.querySelector(s[i]);if(b&&b.getClientRects().length){b.click();setTimeout(function(){t(s,i+1,0,a)},120);}else if(n<(a.length?20:50)){setTimeout(function(){t(s,i,n+1,a)},200);}else if(a.length){t(a,0,0,[]);}else if(window.NativePress){NativePress.missed();}})($sels,0,0,$alt)", null)
                    }
                }
                if (PlaneswalkPack.isPage(android.net.Uri.parse(url))) PlaneswalkPack.refresh(ctx)
                loadUrl(if (signedIn.value != null) "https://cardstashy.com" + WebSession.PATH else url)
                web.value = this
            }
        }, modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing), onRelease = { it.destroy() })
    }
}
