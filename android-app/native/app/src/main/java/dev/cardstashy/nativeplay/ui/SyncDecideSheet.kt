package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.text.style.TextAlign
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.WorkspaceSync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val INK = Color(0xFFEEF0F4)
private val MUTED = Color(0xFF9AA2B1)
private fun sans(size: Float, weight: Int, line: Float, color: Color = INK, track: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = line.sp, color = color, letterSpacing = track.sp, lineHeightStyle = CSS_LINE)

/** views.js when(): new Date(iso).toLocaleString(), or "never". */
internal fun siteWhen(millis: Long?): String {
    millis ?: return "never"
    val l = java.util.Locale.getDefault()
    return java.text.SimpleDateFormat(android.text.format.DateFormat.getBestDateTimePattern(l, "yMdjms"), l).format(java.util.Date(millis))
}
internal fun siteWhen(iso: String?): String = siteWhen(iso?.let { runCatching { java.time.OffsetDateTime.parse(it).toInstant().toEpochMilli() }.getOrNull()
    ?: runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() })

/**
 * views.js syncDecideSheet ("choose"), opened from the account panel's "Choose which copy to keep" (app.js A.syncDecide) in the
 * site's #sheet ([SiteSheet]). Its buttons are app.js A.syncChoice: replacing the account asks first; keeping the account's copy
 * says so in a toast.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SyncDecideSheet(backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val p0 = WorkspaceSync.pending.value ?: run { LaunchedEffect(Unit) { onClose() }; return }
    // The account's side gains its updated_at and device once read; this device's copy is the file the engine runs on.
    val p by produceState(p0) { WorkspaceSync.pendingDetails()?.let { value = it } }
    val local by produceState<WorkspaceSync.Summary?>(null) {
        value = withContext(Dispatchers.IO) { WorkspaceSync.summarize(Decks.deviceFile(context, p0.userId).takeIf { it.isFile }?.readText()) }
    }
    val cloud = remember(p0) { WorkspaceSync.summarize(p0.cloud.data) }
    fun choose(c: String) {
        val pending = WorkspaceSync.pending.value
        suspend fun run() { if (pending !== WorkspaceSync.pending.value) return; onClose(); WorkspaceSync.resolve(context.applicationContext, c, pending)
            if (c == "account") CollectionWrites.show("Loaded your account copy. This device’s previous data was downloaded as a backup.") }
        if (c == "device") CollectionWrites.confirm("Replace your account copy with this device’s? The account copy is downloaded as a backup first.") { run() }
        else scope.launch { run() }
    }
    SiteSheet("Which copy should we keep?", backdrop, onClose) {
        Text("This device and your account both have cards, and they’re different. The other copy is downloaded as a backup file. Keep that file before continuing. CardStashy doesn’t merge copies automatically, so cards are never counted twice.",
            Modifier.padding(top = 6.dp), style = sans(13f, 400, 18.85f, MUTED))
        // .sync-compare: two columns, 8 apart, 12 above and below.
        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp).height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val l = local
            Side("This device", l, "Saved " + siteWhen(l?.saved), Modifier.weight(1f))
            Side("Your account", cloud, "Saved " + siteWhen(p.cloud.updatedAt) + (p.cloud.device?.takeIf { it.isNotEmpty() }?.let { " · $it" } ?: ""), Modifier.weight(1f))
        }
        // .actions.wrap (its 10 above collapses into the 12 under the copies): the gold button and the glass one, wrapping; then the link.
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SheetButton("Use account copy on this device", ghost = false) { choose("account") }
            SheetButton("Replace account with device copy", ghost = true) { choose("device") }
        }
        Text("Decide later (sync stays paused)", Modifier.clip(RoundedCornerShape(6.dp)).clickable { choose("later") }.padding(vertical = 4.dp),
            style = sans(13f, 600, 18.85f, Site.Gold))
    }
}

/**
 * The site's #sheet (dialog.sheet): a bottom sheet on a phone, a centred 720 card from 700 wide, glass over the blurred app
 * (solid where there is no backdrop-filter), springing in. #sheetBody scrolls under its sticky .sheet-head: 8 down at rest,
 * pinned to the top once scrolled. [content] is the body's, inside its side padding (16, or 22 from 700); its argument is
 * the screen's width.
 */
@Composable
internal fun SiteSheet(title: String, backdrop: GraphicsLayer?, onClose: () -> Unit, onBack: (() -> Unit)? = null, eyebrow: String = "",
                        /** h2.build-heading: the brand mark at rest (34, brand-idle) 10 before the title. */
                        brand: Boolean = false,
                        foot: (@Composable () -> Unit)? = null,
                        content: @Composable ColumnScope.(vw: androidx.compose.ui.unit.Dp) -> Unit) {
    val still = Motion.still
    val fade = remember { Animatable(if (still) 1f else 0f) }
    val y = remember { Animatable(if (still) 0f else 46f) }; val k = remember { Animatable(if (still) 1f else .985f) }; val a = remember { Animatable(if (still) 1f else .2f) }
    LaunchedEffect(Unit) {
        // dialog.sheet[open]: sheet-spring .42 s cubic-bezier(.2, .9, .25, 1.1) (0 %: 46 px down, .985, .2; 60 %: 4 px up, 1.002, 1);
        // ::backdrop fade .3 s ease-out.
        val e = CubicBezierEasing(.2f, .9f, .25f, 1.1f)
        launch { fade.animateTo(1f, tween(300, easing = CubicBezierEasing(0f, 0f, .58f, 1f))) }
        launch { y.animateTo(0f, keyframes { durationMillis = 420; 46f at 0 using e; -4f at 252 using e }) }
        launch { k.animateTo(1f, keyframes { durationMillis = 420; .985f at 0 using e; 1.002f at 252 using e }) }
        a.animateTo(1f, keyframes { durationMillis = 420; .2f at 0 using e; 1f at 252 using e })
    }
    BackHandler { (onBack ?: onClose)() }
    val dim = androidx.compose.ui.graphics.rememberGraphicsLayer(); val frost = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val body = androidx.compose.ui.graphics.rememberGraphicsLayer(); val headBlur = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val sheetBox = remember { arrayOf(androidx.compose.ui.geometry.Rect.Zero) }
    val glass = backdrop != null && android.os.Build.VERSION.SDK_INT >= 31; val bg = Site.Bg
    val scroll = rememberScrollState()
    var headH by remember { mutableIntStateOf(0) }
    var footH by remember { mutableIntStateOf(0) }
    val pin = remember { SheetPin() }
    BoxWithConstraints(Modifier.fillMaxSize()
        .drawBehind {
            // body.glass dialog.sheet::backdrop { background: rgba(4, 5, 8, .45); backdrop-filter: blur(3px) }, fading in.
            if (backdrop != null && backdrop.size.width > 0) {
                dim.renderEffect = androidx.compose.ui.graphics.BlurEffect(3.dp.toPx(), 3.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                dim.alpha = fade.value
                dim.record(backdrop.size) { drawLayer(backdrop) }
                drawLayer(dim)
            }
            drawRect(Color(0x73040508), alpha = fade.value)
        }
        // A tap outside the sheet closes it (no semantics of its own: the sheet's close button is the accessible way out).
        .pointerInput(Unit) { detectTapGestures { onClose() } }
        .imePadding()) {
        val vw = maxWidth
        val big = maxWidth >= 700.dp
        val gutter = if (big) 22.dp else 16.dp
        val shape = if (big) RoundedCornerShape(22.dp) else RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
        val navBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
        Box(Modifier.align(if (big) Alignment.Center else Alignment.BottomCenter)
            .width(if (big) minOf(720.dp, maxWidth - 32.dp) else minOf(640.dp, maxWidth))
            .heightIn(max = maxHeight * .92f)
            .graphicsLayer { translationY = y.value * density; scaleX = k.value; scaleY = k.value; alpha = a.value }
            .onGloballyPositioned { sheetBox[0] = it.boundsInRoot() }
            // 0 -20px 60px rgba(0, 0, 0, .45) under the glass.
            .drawBehind {
                drawIntoShadow(this, Color(0x73000000), 60.dp.toPx(), (-20).dp.toPx(), 22.dp.toPx())
            }
            .clip(shape)
            .drawBehind {
                // background: linear-gradient(180deg, rgba(255,255,255,.05), transparent 120px), rgba(18, 20, 26, .6);
                // backdrop-filter: blur(28px) saturate(1.4) — the app behind, blurred and saturated, where the sheet is.
                // Where there is no backdrop-filter (before Android 12), the site's own no-glass sheet: var(--bg), solid.
                if (glass) {
                    frost.renderEffect = frostEffect(28.dp.toPx())
                    frost.record(backdrop!!.size) { drawLayer(backdrop) }
                    val r = sheetBox[0]
                    translate(-r.left, -r.top) { drawLayer(frost) }
                    drawRect(Color(0x9912141A))
                    drawRect(Brush.verticalGradient(0f to Color(0x0DFFFFFF), 1f to Color.Transparent, endY = 120.dp.toPx()))
                } else drawRect(bg)
                // inset 0 1px 0 rgba(255, 255, 255, .1)
                drawRect(Color(0x1AFFFFFF), size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx()))
            }
            .border(1.dp, Color(0x31EDC980), shape)
            // Taps on the sheet stay on it.
            .pointerInput(Unit) { detectTapGestures { } }) {
            val density = androidx.compose.ui.platform.LocalDensity.current
            // Inside the sheet's 1 border, #sheetBody: 8 over the head, the head's height, then the body; 22 under it (and the
            // navigation bar's), then the border again.
            // Under the glass head, what scrolls up is seen only through its blur (backdrop-filter: blur(20px) saturate(1.3)): the body is
            // drawn below the head's bottom, and the head draws it blurred (Randall 5 Nov: labels showed crisp through the header).
            Column(Modifier.fillMaxWidth()
                .then(if (glass) Modifier.drawWithContent {
                    body.record { this@drawWithContent.drawContent() }
                    clipRect(top = maxOf(0f, 9.dp.toPx() - scroll.value) + headH) { drawLayer(body) }
                } else Modifier)
                .verticalScroll(scroll).padding(top = 9.dp + with(density) { headH.toDp() })
                // With a sticky foot (.idea-actions), the body ends where the foot begins (its margin-top 10 above it).
                .padding(start = gutter, end = gutter, bottom = if (foot != null) 10.dp + with(density) { footH.toDp() } else 23.dp + navBottom)) {
                androidx.compose.runtime.CompositionLocalProvider(LocalSheetPin provides pin) { content(vw) } }
            // What the body pins under the head once it scrolls past (position: sticky; top; .sel-bar), on var(--bg).
            pin.content?.let { pinned -> Box(Modifier.align(Alignment.TopStart).fillMaxWidth()
                .offset { androidx.compose.ui.unit.IntOffset(0, headH + maxOf(0, 9.dp.roundToPx() - scroll.value)) }
                .background(bg).padding(start = gutter, end = gutter)) { pinned() } }
            // A sticky foot (position: sticky; bottom; .idea-actions): pinned to the sheet's bottom, var(--bg), a line over it, the
            // navigation bar's inset under it.
            if (foot != null) Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().onSizeChanged { footH = it.height }.background(bg)
                .drawBehind { drawRect(Site.Line, size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx())) }
                .padding(start = gutter, end = gutter, top = 10.dp, bottom = 10.dp + navBottom)) { foot() }
            // .sheet-head (glass): sticky, rgba(18, 20, 26, .8), a .06 white rule under it; h2 Manrope 19/800; the 44 close.
            Row(Modifier.fillMaxWidth().onSizeChanged { headH = it.height }.onGloballyPositioned { pin.headBottom = it.boundsInRoot().bottom }
                .graphicsLayer { translationY = maxOf(0f, 9.dp.toPx() - scroll.value) }
                .then(if (glass) Modifier.drawBehind {
                    if (body.size.width > 0) {
                        headBlur.renderEffect = frostEffect(20.dp.toPx(), 1.3f)
                        headBlur.record(body.size) { drawLayer(body) }
                        clipRect { translate(0f, -maxOf(0f, 9.dp.toPx() - scroll.value)) { drawLayer(headBlur) } }
                    }
                } else Modifier)
                .background(if (glass) Color(0xCC12141A) else bg)
                .drawBehind { drawRect(Color(0x0FFFFFFF), topLeft = Offset(0f, size.height - 1.dp.toPx()), size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx())) }
                .padding(start = gutter, end = gutter, top = 12.dp, bottom = 11.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                // A sheet opened from another (app.js sheet history): the back button, and the title between the two (space-between).
                if (onBack != null) Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF1F232B)).border(1.dp, Color(0xFF2A2F39), RoundedCornerShape(12.dp))
                    .clickable(onClick = onBack).semantics { contentDescription = "Back to previous card or deck" }, contentAlignment = Alignment.Center) {
                    // ICON.back: M14.5 6 8.5 12l6 6, stroke 1.75 on a 24 grid.
                    Canvas(Modifier.size(20.dp)) { val u = size.width / 24f
                        drawPath(androidx.compose.ui.graphics.Path().apply { moveTo(14.5f * u, 6f * u); lineTo(8.5f * u, 12f * u); lineTo(14.5f * u, 18f * u) }, INK,
                            style = Stroke(1.75f * u, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round)) }
                }
                val h2 = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 19.sp,
                    lineHeight = 21.85.sp, letterSpacing = (-.38).sp, color = INK, lineHeightStyle = CSS_LINE)
                // <div><p class="eyebrow">…</p><h2>…</h2></div> (a binder's head): the 11 / 700 tracked eyebrow, 4, then the title.
                if (eyebrow.isNotEmpty()) Column(Modifier.weight(1f)) {
                    Text(eyebrow, Modifier.padding(bottom = 4.dp), style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, lineHeight = 15.95.sp,
                        letterSpacing = 1.32.sp, color = MUTED, lineHeightStyle = CSS_LINE), maxLines = 1)
                    // .sheet-head h2 (style.css 3234): a long title wraps (white-space: normal, overflow-wrap: anywhere).
                    Text(title, style = h2)
                }
                else if (brand) Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    BrandMark(34.dp); Text(title, style = h2)
                }
                else Text(title, Modifier.weight(1f), style = h2, textAlign = if (onBack != null) TextAlign.Center else TextAlign.Start)
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF1F232B)).border(1.dp, Color(0xFF2A2F39), RoundedCornerShape(12.dp))
                    .clickable(onClick = onClose).semantics { contentDescription = "Close" }, contentAlignment = Alignment.Center) {
                    // ICON.close: m6.5 6.5 11 11 M17.5 6.5l-11 11, stroke 1.75 on a 24 grid.
                    Canvas(Modifier.size(20.dp)) { val u = size.width / 24f; val st = Stroke(1.75f * u, cap = StrokeCap.Round)
                        drawLine(INK, Offset(6.5f * u, 6.5f * u), Offset(17.5f * u, 17.5f * u), st.width, StrokeCap.Round)
                        drawLine(INK, Offset(17.5f * u, 6.5f * u), Offset(6.5f * u, 17.5f * u), st.width, StrokeCap.Round) }
                }
            }
        }
    }
}

/** .sync-side: the copy's eyebrow, its cards, what they are, and when it was saved. */
@Composable
private fun Side(title: String, s: WorkspaceSync.Summary?, extra: String, modifier: Modifier) {
    val nf = java.text.NumberFormat.getInstance()
    Column(modifier.fillMaxSize().clip(RoundedCornerShape(14.dp)).background(Color(0xFF171A20)).border(1.dp, Color(0xFF2A2F39), RoundedCornerShape(14.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title.uppercase(), Modifier.padding(bottom = 4.dp), style = sans(11f, 700, 15.95f, MUTED, 1.32f))
        Text(if (s == null) " " else "${nf.format(s.copies)} cards", style = sans(18f, 700, 26.1f))
        Text(if (s == null) " " else "${nf.format(s.names)} different · ${s.decks} decks · ${s.wishlist} wishlist", style = sans(13f, 400, 18.85f))
        Text(if (s == null) " " else extra, style = sans(13f, 400, 18.85f, MUTED))
    }
}

/** .btn (gold) and .btn.ghost (glass): 44 tall, 8 / 16 padding, radius 11, 15 / 700. */
@Composable
private fun SheetButton(label: String, ghost: Boolean, onClick: () -> Unit) {
    val r = RoundedCornerShape(11.dp)
    Box(Modifier.defaultMinSize(minHeight = 44.dp).clip(r)
        .then(if (ghost) Modifier.background(Color(0x851F232B)).border(1.dp, Color(0x31EDC980), r)
            .drawBehind { drawLine(Color(0x12FFFFFF), Offset(11.dp.toPx(), 1.5f), Offset(size.width - 11.dp.toPx(), 1.5f), 1f) }
        else Modifier.background(Color(0xFFE8B95B)))
        .clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        Text(label, style = sans(15f, 700, 21.75f, if (ghost) INK else Color(0xFF1B1406)))
    }
}

/** blur(r) saturate([sat]): the saturation as a colour matrix chained under the blur (Android 12+; earlier, no backdrop-filter). */
internal fun frostEffect(r: Float, sat: Float = 1.4f): androidx.compose.ui.graphics.RenderEffect? {
    if (android.os.Build.VERSION.SDK_INT < 31) return null
    val m = android.graphics.ColorMatrix().apply { setSaturation(sat) }
    return android.graphics.RenderEffect.createChainEffect(android.graphics.RenderEffect.createColorFilterEffect(android.graphics.ColorMatrixColorFilter(m)),
        android.graphics.RenderEffect.createBlurEffect(r, r, android.graphics.Shader.TileMode.CLAMP)).asComposeRenderEffect()
}

/** A CSS box-shadow (blur, dy) under a box rounded at its top corners. */
private fun drawIntoShadow(scope: androidx.compose.ui.graphics.drawscope.DrawScope, color: Color, blur: Float, dy: Float, radius: Float) = with(scope) {
    drawContext.canvas.nativeCanvas.drawRoundRect(0f, dy, size.width, size.height + dy, radius, radius, android.graphics.Paint().apply {
        isAntiAlias = true; this.color = android.graphics.Color.argb((color.alpha * 255).toInt(), 0, 0, 0)
        maskFilter = android.graphics.BlurMaskFilter(blur / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
    })
}

/** A sheet's sticky-top slot: the head's bottom (in the root), and what is pinned under it while its own place is scrolled past. */
internal class SheetPin {
    var headBottom by androidx.compose.runtime.mutableFloatStateOf(0f)
    var content by androidx.compose.runtime.mutableStateOf<(@Composable () -> Unit)?>(null)
}
internal val LocalSheetPin = androidx.compose.runtime.staticCompositionLocalOf<SheetPin?> { null }
