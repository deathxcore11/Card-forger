package dev.cardstashy.nativeplay.ui

import android.annotation.SuppressLint
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
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
    Box(modifier.size(size).scale(if (pressed) .92f else 1f).clickable(press, null, onClick = onClick), contentAlignment = Alignment.Center) {
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
 * Collection mode: the CardStashy app as it is on the web, until each tab goes native (big
 * picture, step 3). The Play emblem in the corner switches back to Play.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun CollectionScreen(onPlay: () -> Unit, url: String = "https://cardstashy.com/") {
    val web = remember { mutableStateOf<WebView?>(null) }
    BackHandler { web.value?.takeIf { it.canGoBack() }?.goBack() ?: onPlay() }
    Box(Modifier.fillMaxSize().background(Palette.Night)) {
        AndroidView(factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true
                webViewClient = object : WebViewClient() {
                    // Stay on CardStashy; other sites open in the browser.
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        val host = request.url.host ?: return false
                        if (host == "cardstashy.com" || host.endsWith(".cardstashy.com")) return false
                        runCatching { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, request.url)) }
                        return true
                    }
                }
                loadUrl(url)
                web.value = this
            }
        }, modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing), onRelease = { it.destroy() })
        Emblem(Mode.PLAY, 64.dp, onPlay, Modifier.align(Alignment.BottomEnd).windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp))
    }
}
