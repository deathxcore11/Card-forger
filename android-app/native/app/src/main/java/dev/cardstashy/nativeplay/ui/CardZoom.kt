package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.foil.finish
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImagePainter
import coil3.compose.rememberAsyncImagePainter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.hypot

/**
 * The site's full-screen card viewer, zoom.js openZoom (live 4.3.83) with style.css 1502–1519 and 4891–4902 and
 * mobile-tilt.js attachZoomMotion, line for line:
 *  - views: Effects (finish + light), Plain card (the source image, no CardStashy lighting or foil), Art (art_crop) when there is one;
 *    the hint changes per view (zoom.js:90) and hides while zoomed (css 1518).
 *  - the image on screen shows at once; the png (scryfallHi) swaps in when it loads; readout "Loading high resolution…" then W×H,
 *    "Artwork unavailable" when every source fails (zoom.js:93–110).
 *  - pinch around the fingers' midpoint, double-tap 2.6× at that spot / back to 1×, drag to pan when zoomed (clamped +40 px),
 *    − / Fit / + (×1.6, 0.22 s cubic-bezier(.2,.8,.2,1)), max 6× (zoom.js:7, 52–75, 128–216).
 *  - not zoomed: swipe down drags the card (scale down to .85) and fades the backdrop to .35; past 110 px it closes, else springs back
 *    (zoom.js:196–213). A quick tap on the dark area closes, unless it was half of a double tap (zoom.js:223).
 *  - the light follows the finger on the card (zoom.js:178); the phone tilts it, perspective(900px) rotateX(−y·8) rotateY(x·8), light 50+x·40 %,
 *    only on Effects and not zoomed in, with the Tilt on / Tilt off button (mobile-tilt.js:10–29). One haptic pack-value-2 when a foil opens
 *    (finish-preview.js:165).
 */
private val zoomEase = CubicBezierEasing(.2f, .8f, .2f, 1f)
private const val MAX = 6f

/** Scryfall image URLs come in sizes; png is the sharpest (745×1040). zoom.js scryfallHi. */
fun scryfallHi(url: String?): String = (url ?: "").replace(Regex("/(small|normal|large)/"), "/png/").replace(Regex("\\.jpg(\\?|$)"), ".png$1")

private class View(val label: String, val src: String, val hi: String?, val effects: Boolean, val art: Boolean)

@Composable
fun CardZoom(src: String, hi: String?, art: String?, look: Foil.Look?, finish: dev.cardstashy.nativeplay.foil.CardFinish? = null,
             /** Two screens: the Art view is the Gallery (specs/thor-gallery-native.md), the painting up top and its museum label below. */
             gallery: Gallery? = null, onClose: () -> Unit) {
    BackHandler(onBack = onClose)
    val views = remember(src, hi, art) {
        val h = (hi?.ifBlank { null } ?: if (src.contains("scryfall.io")) scryfallHi(src) else null)?.takeIf { it != src }
        buildList {
            add(View("Effects", src, h, effects = true, art = false)); add(View("Plain card", src, h, effects = false, art = false))
            if (!art.isNullOrBlank()) add(View("Art", art, null, effects = false, art = true))
        }
    }
    var view by remember { mutableIntStateOf(0) }
    val v = views[view]
    val scope = rememberCoroutineScope()
    val hostView = LocalView.current
    val dens = LocalDensity.current

    // s, tx, ty: the card surface's translate(tx, ty) scale(s), in px from the stage centre.
    var s by remember { mutableFloatStateOf(1f) }; var tx by remember { mutableFloatStateOf(0f) }; var ty by remember { mutableFloatStateOf(0f) }
    var swipeY by remember { mutableFloatStateOf(0f) }
    var fade by remember { mutableFloatStateOf(1f) }
    var stage by remember { mutableStateOf(Size.Zero) }
    var cardSize by remember { mutableStateOf(Size.Zero) }
    var light by remember { mutableStateOf<Offset?>(null) }          // finger on the card, 0..1
    val anim = remember { Animatable(0f) }
    val zoomed = s > 1.02f

    fun clamp() {
        val mx = maxOf(0f, (cardSize.width * s - stage.width) / 2f + 40f); val my = maxOf(0f, (cardSize.height * s - stage.height) / 2f + 40f)
        tx = tx.coerceIn(-mx, mx); ty = ty.coerceIn(-my, my)
    }
    fun animateTo(ns: Float, ntx: Float, nty: Float) {
        val s0 = s; val x0 = tx; val y0 = ty; val y1 = swipeY
        scope.launch { anim.snapTo(0f); anim.animateTo(1f, tween(220, easing = zoomEase)) { val k = value
            s = s0 + (ns - s0) * k; tx = x0 + (ntx - x0) * k; ty = y0 + (nty - y0) * k; swipeY = y1 * (1f - k) } }
    }
    // Zoom to ns keeping the point (px, py), relative to the stage centre, still.
    fun zoomAt(target: Float, px: Float = 0f, py: Float = 0f, animate: Boolean = false) {
        val ns = target.coerceIn(1f, MAX)
        var nx = px - (px - tx) * (ns / s); var ny = py - (py - ty) * (ns / s)
        if (ns == 1f) { nx = 0f; ny = 0f }
        val mx = maxOf(0f, (cardSize.width * ns - stage.width) / 2f + 40f); val my = maxOf(0f, (cardSize.height * ns - stage.height) / 2f + 40f)
        nx = nx.coerceIn(-mx, mx); ny = ny.coerceIn(-my, my)
        if (animate) animateTo(ns, nx, ny) else { s = ns; tx = nx; ty = ny }
    }
    fun load(i: Int) { view = i; s = 1f; tx = 0f; ty = 0f; light = null }

    // A controller: B closes, LB/RB step through the views (Effects, Plain card, Art), holding Y moves the light slowly round the card
    // as a finger on it does (the same light), back to rest when Y comes up.
    var padSweep by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    PadScreen(remember(views) { PadActs(b = "Close", opaque = true, tabs = if (views.size < 2) null else { d -> val i = (view + d).coerceIn(0, views.lastIndex); if (i != view) load(i) },
        yHold = if (Motion.still) null else { held -> padSweep?.cancel(); padSweep = null
            if (held && !Motion.still) padSweep = scope.launch { var t0 = -1L
                try { while (true) androidx.compose.runtime.withFrameMillis { t -> if (t0 < 0) t0 = t; val a = (t - t0) / 2400.0 * 2 * Math.PI - Math.PI / 4
                    light = Offset(.5f + .38f * Math.cos(a).toFloat(), .5f + .38f * Math.sin(a).toFloat()) } } finally { light = null } } }) })

    // The phone's tilt (attachZoomMotion): origin = the first reading; tiltCoordinates clamps Δ/18° and turns with the screen.
    val sensorThere = remember { (LocalContextHolder.sensor(hostView.context)) }
    var gyro by remember { mutableStateOf<Offset?>(null) }
    val tiltOn = AppSettings.tilt && !Motion.still
    val gyroActive = tiltOn && v.effects && !zoomed
    if (sensorThere && tiltOn) DisposableEffect(Unit) {
        val sm = hostView.context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val sensor = sm?.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        val rot = FloatArray(9); val ori = FloatArray(3); var b0 = Float.NaN; var g0 = 0f
        @Suppress("DEPRECATION") val angle = { ((hostView.context.getSystemService(Context.WINDOW_SERVICE) as? android.view.WindowManager)?.defaultDisplay?.rotation ?: 0) * 90 }
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                SensorManager.getRotationMatrixFromVector(rot, e.values); SensorManager.getOrientation(rot, ori)
                val b = Math.toDegrees(-ori[1].toDouble()).toFloat(); val g = Math.toDegrees(ori[2].toDouble()).toFloat()
                if (b0.isNaN()) { b0 = b; g0 = g }
                val x0 = ((g - g0) / 18f).coerceIn(-1f, 1f); val y0 = ((b - b0) / 18f).coerceIn(-1f, 1f)
                val r = Math.toRadians(angle().toDouble()); val c = Math.cos(r).toFloat(); val sn = Math.sin(r).toFloat()
                gyro = Offset(x0 * c + y0 * sn, y0 * c - x0 * sn)
            }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        if (sensor != null) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_GAME)
        onDispose { sm?.unregisterListener(l); gyro = null }
    }
    // Switching views or zooming in resets the lean (dialog 'cardstashy-zoom-view' → reset).
    LaunchedEffect(view, zoomed) { if (zoomed || !v.effects) gyro = null }

    // One small tap when a foil opens in the zoom view, once per card.
    LaunchedEffect(Unit) { if (look?.shines == true) Feel.perform(hostView, "pack-value-2") }
    // aura.js modalArt(): the opened card's art becomes the Aura atmosphere, and stays after closing until the screen changes.
    LaunchedEffect(art, src) { Aura.focus = art ?: src }

    // Pictures: the one on screen at once, the png when it arrives.
    val base = heroPainter(homeArt(v.src)) ?: rememberAsyncImagePainter(v.src, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader)
    val hiP = v.hi?.let { heroPainter(homeArt(it)) }
    val baseState = (base as? AsyncImagePainter)?.state?.collectAsState()?.value
    val hiState = (hiP as? AsyncImagePainter)?.state?.collectAsState()?.value
    val hiReady = hiP != null && (hiP !is AsyncImagePainter || hiState is AsyncImagePainter.State.Success)
    val baseSize = base.intrinsicSize.takeIf { it.isSpecified && it.width > 0f }
    val shownSize = if (hiReady) hiP!!.intrinsicSize else baseSize
    val res = when {
        baseState is AsyncImagePainter.State.Error && (hiP == null || hiState is AsyncImagePainter.State.Error) -> "Artwork unavailable"
        hiP != null && !hiReady && hiState !is AsyncImagePainter.State.Error -> "Loading high resolution…"
        shownSize != null && shownSize.isSpecified -> "${shownSize.width.toInt()}×${shownSize.height.toInt()}"
        else -> ""
    }

    // The Gallery: on two screens the Art view is a museum wall up top and the piece's label on the bottom. B closes, LB/RB still
    // switch views, LT/RT walk the wall when it holds more than one piece. Single-screen devices keep the plain art view.
    if (DualScreen.active && v.art && gallery != null && gallery.pieces.isNotEmpty()) {
        var piece by remember(gallery) { mutableIntStateOf(gallery.start.coerceIn(0, gallery.pieces.lastIndex)) }
        val walk = gallery.pieces.size > 1
        PadScreen(PadActs(b = "Back", opaque = true, tabs = { d -> val i = (view + d).coerceIn(0, views.lastIndex); if (i != view) load(i) }, tabsLabel = "View",
            page = if (walk) { d -> piece = (piece + d).coerceIn(0, gallery.pieces.lastIndex) } else null, pageLabel = "Walk",
            x = gallery.pieces[piece].open?.let { open -> PadAct("Card page") { open() } }))
        Box(Modifier.fillMaxSize().padLayer()) { GalleryWall(gallery, piece) }
        BottomScreen { GalleryLabel(gallery, piece) { piece = it } }
        return
    }

    BoxWithConstraints(Modifier.fillMaxSize().padLayer().background(Color(4, 5, 8).copy(alpha = .985f * fade))) {
        val phone = maxWidth <= 600.dp; val screenW = maxWidth
        val stageTop = if (phone) 66.dp else 0.dp; val stageBottom = if (phone) 160.dp else 0.dp
        // .zoom-img: max-width min(94vw, 680px); max-height 100dvh − 150px (− 240px on phones). Art crops are 626×457.
        val maxW = minOf(maxWidth * .94f, 680.dp); val maxH = maxHeight - if (phone) 240.dp else 150.dp
        val aspect = if (v.art) shownSize?.takeIf { it.isSpecified }?.let { it.width / it.height } ?: (626f / 457f) else 745f / 1040f
        val w = if (maxW / aspect <= maxH) maxW else maxH * aspect
        val h = w / aspect
        val radius = minOf(w * .0475f, h * .035f) // .zoom-card-light > .zoom-img border-radius 4.75% / 3.5%

        // The stage: every touch on it (zoom.js pointer handlers).
        Box(Modifier.fillMaxSize().padding(top = stageTop, bottom = stageBottom).onGloballyPositioned { stage = Size(it.size.width.toFloat(), it.size.height.toFloat()) }
            .pointerInput(views) {
                var lastTap = 0L
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val c0 = Offset(size.width / 2f, size.height / 2f)
                    val cardRect = androidx.compose.ui.geometry.Rect(c0.x + tx - cardSize.width * s / 2f, c0.y + ty + swipeY - cardSize.height * s / 2f,
                        c0.x + tx + cardSize.width * s / 2f, c0.y + ty + swipeY + cardSize.height * s / 2f)
                    val onBackdrop = !cardRect.contains(down.position)
                    val t0 = System.currentTimeMillis()
                    fun onCard(p: Offset) { if (!Motion.still && cardRect.width > 0) light = Offset(((p.x - cardRect.left) / cardRect.width).coerceIn(0f, 1f), ((p.y - cardRect.top) / cardRect.height).coerceIn(0f, 1f)) }
                    onCard(down.position)
                    // Double tap: zoom into that spot, or back out.
                    if (t0 - lastTap < 300) { val p = down.position - c0; zoomAt(if (s > 1.05f) 1f else 2.6f, p.x, p.y, animate = true); lastTap = 0L
                        do { val e = awaitPointerEvent() } while (e.changes.any { it.pressed }); return@awaitEachGesture }
                    lastTap = t0
                    var pinch: FloatArray? = null   // d, s, midX, midY, tx, ty
                    val pan = if (s > 1.02f) floatArrayOf(down.position.x, down.position.y, tx, ty) else null
                    var swipe = if (pan == null) down.position.y else null
                    var last = down.position
                    var moved = 0f
                    while (true) {
                        val e = awaitPointerEvent()
                        val pts = e.changes.filter { it.pressed }
                        if (pts.isEmpty()) { last = e.changes.firstOrNull()?.position ?: last; break }
                        pts.forEach { if (it.positionChanged()) it.consume() }
                        if (pts.size >= 2) {
                            val a = pts[0].position; val b = pts[1].position
                            val d = hypot(a.x - b.x, a.y - b.y); val mid = (a + b) / 2f - c0
                            val p = pinch ?: floatArrayOf(d, s, mid.x, mid.y, tx, ty).also { pinch = it; swipe = null; swipeY = 0f; fade = 1f }
                            val ns = (p[1] * (d / p[0])).coerceIn(1f, MAX)
                            // Scale around the starting midpoint, then follow the fingers as they move.
                            tx = p[2] - (p[2] - p[4]) * (ns / p[1]) + (mid.x - p[2]); ty = p[3] - (p[3] - p[5]) * (ns / p[1]) + (mid.y - p[3])
                            s = ns; clamp()
                        } else {
                            val q = pts[0].position; moved = maxOf(moved, (q - down.position).getDistance()); onCard(q)
                            if (pinch == null && pan != null) { tx = pan[2] + (q.x - pan[0]); ty = pan[3] + (q.y - pan[1]); clamp() }
                            else if (pinch == null) swipe?.let { sy -> val dy = maxOf(0f, q.y - sy); swipeY = dy; fade = maxOf(.35f, 1f - dy / 400f) }
                            last = q
                        }
                    }
                    swipe?.let { sy -> val dy = last.y - sy; fade = 1f
                        if (dy > 110f) { onClose(); return@awaitEachGesture }
                        if (swipeY != 0f) animateTo(s, tx, ty) }
                    if (s < 1.02f) zoomAt(1f, animate = true)
                    // A quick tap on the dark area (not the card) closes, like a photo viewer; a second tap within 300 ms is a double tap instead.
                    if (onBackdrop && s <= 1.02f && moved < 8f && System.currentTimeMillis() - t0 < 350) scope.launch {
                        delay(310); if (lastTap != 0L && System.currentTimeMillis() - lastTap >= 300) onClose() }
                }
            }, contentAlignment = Alignment.Center) {
            val g = if (gyroActive) gyro else null
            val lightAt = g?.let { Offset(.5f + it.x * .4f, .5f + it.y * .4f) } ?: light
            val foilTilt = remember { mutableStateOf(Offset.Zero) }
            foilTilt.value = lightAt?.let { Offset((it.x - .5f) * 2f, (it.y - .5f) * 2f) } ?: Offset.Zero
            Box(Modifier.size(w, h)
                .onGloballyPositioned { cardSize = Size(it.size.width.toFloat(), it.size.height.toFloat()) }
                .graphicsLayer {
                    translationX = tx; translationY = ty + swipeY
                    val k = if (swipeY > 0f) 1f - minOf(.15f, swipeY / 2000f) else 1f
                    scaleX = s * k; scaleY = s * k
                }
                .graphicsLayer {
                    // .zoom-card-light: perspective(900px) rotateX(−y·8deg) rotateY(x·8deg), .16 s ease-out.
                    cameraDistance = 900f / 72f * density
                    rotationX = -(g?.y ?: 0f) * 8f; rotationY = (g?.x ?: 0f) * 8f
                }
                .shadow(36.dp, RoundedCornerShape(radius), ambientColor = Color(0xCC000000), spotColor = Color(0xCC000000))
                .clip(RoundedCornerShape(radius))
                .then(if (v.effects && look != null) Modifier.foil(look, foilTilt) else if (v.effects && finish != null) Modifier.finish(finish, foilTilt) else Modifier)
                .drawWithContent {
                    drawContent()
                    if (!v.effects || Motion.still || !AppSettings.finish) return@drawWithContent
                    // finish-effects.css .finish-spotlight on the enlarged card: a neutral lamp at the light, screen blend, .65.
                    val at = lightAt ?: Offset(.5f, .5f)
                    val cx = at.x * size.width; val cy = at.y * size.height
                    val rx = maxOf(cx, size.width - cx) * 1.4142f; val ry = maxOf(cy, size.height - cy) * 1.4142f
                    withTransform({ scale(1f, ry / rx, Offset(cx, cy)) }) {
                        drawCircle(Brush.radialGradient(0f to Color(1f, 1f, 1f, .46f), .18f to Color(245 / 255f, 249 / 255f, 1f, .18f), .55f to Color.Transparent,
                            center = Offset(cx, cy), radius = rx), radius = rx, center = Offset(cx, cy), alpha = .65f, blendMode = BlendMode.Screen)
                    }
                }) {
                Image(base, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                if (hiP != null && hiReady) Image(hiP, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
        }

        // .zoom-top: Tilt (when the phone has the sensor), the size readout, ✕.
        Row(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = 12.dp).padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            if (sensorThere) ZoomBtn(if (!AppSettings.tilt) "Tilt off" else "Tilt on", small = true, enabled = !Motion.still) { AppSettings.set("motionTilt", !AppSettings.tilt) }
            else Spacer(Modifier.width(44.dp))
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                if (res.isNotEmpty()) Text(res, style = TextStyle(fontSize = 11.sp, color = Color(0xA0FFFFFF)),
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0x77000000)).padding(horizontal = 8.dp, vertical = 4.dp))
            }
            ZoomBtn("✕", onClick = onClose)
        }

        // .zoom-bar: the views (own row on phones), − Fit +; the hint under it.
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().windowInsetsPadding(WindowInsets.navigationBars), horizontalAlignment = Alignment.CenterHorizontally) {
            val seg = @Composable { mod: Modifier ->
                Row(mod.clip(RoundedCornerShape(999.dp)).background(Color(0x66000000)).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    views.forEachIndexed { i, z -> val on = i == view
                        Box(Modifier.then(if (phone) Modifier.weight(1f) else Modifier).heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp))
                            .background(if (on) Site.Gold else Color.Transparent).clickable { load(i) }.padding(horizontal = if (phone) 10.dp else 12.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center) {
                            Text(z.label, style = TextStyle(fontSize = if (phone) 12.sp else 14.sp, fontWeight = FontWeight.Bold, color = if (on) Site.GoldInk else Color(0xB0FFFFFF)), maxLines = 1, softWrap = false)
                        } }
                }
            }
            val buttons = @Composable {
                ZoomBtn("−") { zoomAt(s / 1.6f, animate = true) }; ZoomBtn("Fit") { zoomAt(1f, animate = true) }; ZoomBtn("+") { zoomAt(s * 1.6f, animate = true) }
            }
            Column(Modifier.padding(horizontal = 12.dp).widthIn(max = screenW - 24.dp).clip(RoundedCornerShape(26.dp)).background(Color(20, 22, 28).copy(alpha = .78f)).padding(6.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                // Phones (css 4898): the bar is as wide as views + buttons would be on one line (width: max-content), the views take the
                // whole first row (flex-basis 100 %, each tab flex 1) and the buttons wrap centred under them.
                if (phone) androidx.compose.ui.layout.Layout({ seg(Modifier.fillMaxWidth()); Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) { buttons() } }) { m, c ->
                    val gap = 5.dp.roundToPx()
                    val want = (m[0].maxIntrinsicWidth(c.maxHeight) + gap + m[1].maxIntrinsicWidth(c.maxHeight)).coerceAtMost(c.maxWidth)
                    val a = m[0].measure(androidx.compose.ui.unit.Constraints.fixedWidth(want)); val b = m[1].measure(androidx.compose.ui.unit.Constraints(maxWidth = want))
                    layout(want, a.height + gap + b.height) { a.place(0, 0); b.place((want - b.width) / 2, a.height + gap) }
                }
                else Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { seg(Modifier); buttons() }
            }
            val hint = if (!v.effects && !v.art) "Original source image · no CardStashy lighting or foil effects" else "Pinch or double-tap to zoom · drag to move · swipe down to close"
            Text(hint, style = TextStyle(fontSize = if (phone) 10.sp else 11.5.sp, color = Color(0x80FFFFFF), textAlign = TextAlign.Center),
                modifier = Modifier.fillMaxWidth().alpha(if (zoomed) 0f else 1f).padding(horizontal = 16.dp).padding(top = if (phone) 18.dp else 10.dp, bottom = 10.dp))
        }
    }
}

@Composable
private fun ZoomBtn(label: String, small: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) =
    Box(Modifier.heightIn(min = 44.dp).widthIn(min = 44.dp).clip(RoundedCornerShape(999.dp)).background(Color(0x14FFFFFF)).alpha(if (enabled) 1f else .5f)
        .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
        Text(label, style = TextStyle(fontSize = if (small) 12.sp else 16.sp, fontWeight = FontWeight.Bold, color = Color.White))
    }

private object LocalContextHolder {
    fun sensor(c: Context) = (c.getSystemService(Context.SENSOR_SERVICE) as? SensorManager)?.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR) != null
}
