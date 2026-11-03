package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.graphics.BlurMaskFilter
import android.media.AudioAttributes
import android.media.SoundPool
import androidx.activity.compose.BackHandler
import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.google.gson.JsonObject
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sign
import kotlin.math.sin

/*
 * Opening a Play pack, as pack-preview.js does it with variant 'play' (Randall's 3 Nov recording is the bar, never
 * regress it): the server has already rolled the pack (POST /api/progress/open). The sealed wrapper floats with its
 * sheen; a tap cuts the top (slice), light bursts out of it (flash) and the strip flies off; the cards rise out of the
 * opened top one after another, fan above it and arc down into the hand, each landing with a tap (the three best
 * with a low rumble and a glow) while the torn pack sinks away with light at its mouth; then the big card rises,
 * face down. Turning it: rares and up glow gold before they turn, mythics gather themselves first (tremble + rising
 * light), and each pull lands with a lift, a pop, the light catch, its ring and embers, rays and a sway of its foil
 * for the big ones, and a backlight in its tier colour behind it like a TV's light strip. Tilt moves the card and its
 * light (switchable), sounds are the site's PACK cues (switchable), haptics are the app's own vocabulary (Feel).
 * Swipe the big card, slide along the hand, tap to turn, tap a turned card (or hold any) to inspect it; Back closes
 * the topmost layer first, and the predictive Back gesture shrinks the pack as the finger pulls.
 */

/** One pulled card, from the open route's pack.contents. */
class Pull(val id: String, val name: String, val rarity: String, val image: String, val art: String, val foil: Boolean) {
    /** rarityTier('mtg'): common 0, uncommon 1, rare 2, mythic/special/bonus 3. */
    val rank: Int get() = when (rarity.lowercase()) { "uncommon" -> 1; "rare" -> 2; "mythic", "special", "bonus" -> 3; else -> 0 }
    /** RARITY_FEEL → FEELS index: the size of the reveal. */
    val level: Int get() = intArrayOf(0, 0, 2, 3, 4)[min(4, rank)]
    /** PLAY_TIER: the frame and glow colour once face up. */
    val tier: Color get() = TIER_COLORS[intArrayOf(0, 1, 3, 4, 5)[min(4, rank)]]
}

/** tier.js TIERS: grey, green, blue, purple, gold, orange. */
val TIER_COLORS = listOf(0xFF9AA3AD, 0xFF4FD18B, 0xFF4AA3FF, 0xFFB46CFF, 0xFFFFC93C, 0xFFFF7A1A).map { Color(it) }

class PackResult(val set: String, val name: String, val pulls: List<Pull>, val note: String, val done: String)

/** The open route's answer, read the way app.js econPicks / econCollector / econOpened read it. */
fun packResult(out: JsonObject, name: String): PackResult {
    val p = out.getAsJsonObject("pack")
    fun JsonObject.s(k: String) = get(k)?.takeIf { !it.isJsonNull }?.asString ?: ""
    val pulls = p.getAsJsonArray("contents").mapNotNull { (it as? JsonObject)?.let { c ->
        Pull(c.s("id"), c.s("name"), c.s("rarity"), c.s("image"), c.s("art"), c.get("foil")?.asBoolean == true) } }
    val god = p.get("god")?.asBoolean == true; val surprise = p.get("surprise")?.asBoolean == true; val collector = p.get("collector")?.asBoolean == true
    val lead = when { god -> "God pack! Every card is a holo rare or mythic."; surprise -> "Collector pack surprise! Every card is holo."; collector -> "Collector pack: every card is holo."; else -> "" }
    val bits = buildList {
        val sb = out.getAsJsonObject("sealBonus")
        for ((k, label) in listOf("u" to "uncommon", "r" to "rare", "m" to "mythic")) if ((sb?.get(k)?.asInt ?: 0) > 0) add("+1 $label seal")
        val dup = out.get("duplicateCoins")?.asInt ?: 0
        if (dup > 0) add("+$dup coins from extra copies")
    }.joinToString(" · ")
    val note = listOf(lead, "Added to your Play collection.", bits).filter { it.isNotBlank() }.joinToString(" ")
    val done = when { god -> "God pack! Every card is a holo rare or mythic."; collector -> if (surprise) "Collector pack surprise! Every card is holo." else "Collector pack: every card is holo."; else -> "" }
    return PackResult(p.s("set"), name, pulls, note, done)
}

/** The pack sounds (PACK-0xx, the site's files) and the two switches the pack header carries, kept on the phone. */
object PackSfx {
    private var pool: SoundPool? = null
    private val ids = HashMap<String, Int>()
    var on = true
    var tilt = true
    fun init(context: Context) {
        val prefs = context.getSharedPreferences("play", Context.MODE_PRIVATE)
        on = prefs.getBoolean("packSound", true); tilt = prefs.getBoolean("motionTilt", true)
        if (pool != null) return
        val p = SoundPool.Builder().setMaxStreams(8).setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build()
        pool = p
        runCatching { for (n in context.assets.list("sfx").orEmpty()) if (n.startsWith("PACK-") && n.endsWith(".ogg")) context.assets.openFd("sfx/$n").use { ids[n.removeSuffix(".ogg")] = p.load(it, 1) } }
    }
    fun toggle(context: Context) { on = !on; context.getSharedPreferences("play", Context.MODE_PRIVATE).edit().putBoolean("packSound", on).apply() }
    fun toggleTilt(context: Context) { tilt = !tilt; context.getSharedPreferences("play", Context.MODE_PRIVATE).edit().putBoolean("motionTilt", tilt).apply() }
    fun play(id: String, volume: Float = 1f, rate: Float = 1f) { if (!on) return; val p = pool ?: return; ids[id]?.let { p.play(it, volume.coerceIn(0f, 1f), volume.coerceIn(0f, 1f), 1, 0, rate) } }
}

/** FEELS and PACK_SOUND, by reveal level. */
private val FEELS = listOf("pack-reveal", "pack-tier-1", "pack-tier-2", "pack-tier-3", "pack-tier-4", "pack-tier-5")
private val REVEAL_SOUND = listOf("PACK-006", "PACK-014", "PACK-015", "PACK-016", "PACK-017", "PACK-018")
private val CHARGE_MS = intArrayOf(0, 0, 0, 420, 620, 860)

enum class PackStage { SEALED, TEARING, DEALING, DEALT }

private val ease = CubicBezierEasing(.2f, .9f, .25f, 1f)
private val flyEase = CubicBezierEasing(.3f, .7f, .25f, 1f)

/** A soft light in [color] around the box, drawn with a real blur (the site's filter: blur() glows; CSS blur(r) is a gaussian of sigma r, Android's radius ~1.73 sigma). */
fun Modifier.glow(color: Color, alpha: Float, spreadX: Float, spreadY: Float, corner: Float, blur: Dp, scale: Float = 1f): Modifier = drawBehind {
    if (alpha <= .01f) return@drawBehind
    val w = size.width * (1 + 2 * spreadX) * scale; val h = size.height * (1 + 2 * spreadY) * scale
    val l = (size.width - w) / 2; val t = (size.height - h) / 2; val r = min(w, h) * corner
    drawIntoCanvas { c ->
        val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; this.color = color.copy(alpha = alpha.coerceIn(0f, 1f)).toArgb(); maskFilter = BlurMaskFilter((blur.toPx() * 1.73f).coerceAtLeast(1f), BlurMaskFilter.Blur.NORMAL) }
        c.nativeCanvas.drawRoundRect(l, t, l + w, t + h, r, r, p)
    }
}

/** Saturate a tier colour a little, as the backlight's saturate(1.45) does. */
private fun Color.rich(): Color { val hsv = FloatArray(3); android.graphics.Color.colorToHSV(toArgb(), hsv); hsv[1] = min(1f, hsv[1] * 1.45f); return Color(android.graphics.Color.HSVToColor(hsv)) }

/**
 * The pack opener, full screen over Play. [initial], [revealedAtStart] and [focusAtStart] exist for the screenshot tests.
 */
@Composable
fun PackOpening(first: PackResult, onNext: (suspend () -> PackResult?)?, onClose: () -> Unit,
                initial: PackStage = PackStage.SEALED, revealedAtStart: Set<Int> = emptySet(), focusAtStart: Int = 0) {
    val context = LocalContext.current
    val view = LocalView.current
    remember { PackSfx.init(context); 0 }
    val scope = rememberCoroutineScope()
    var pack by remember { mutableStateOf(first) }
    var stage by remember { mutableStateOf(initial) }
    val revealed = remember { mutableStateListOf<Int>().apply { addAll(revealedAtStart) } }
    var focus by remember { mutableIntStateOf(focusAtStart) }
    var charging by remember { mutableStateOf<Int?>(null) }
    var moment by remember { mutableIntStateOf(0) }        // bumps on each reveal moment (pop, catch, ring, embers, rays, sway)
    var momentLevel by remember { mutableIntStateOf(0) }
    var flipping by remember { mutableIntStateOf(0) }
    var slide by remember { mutableIntStateOf(0) }         // +1 / -1 per swipe, for the slide-in
    var flung by remember { mutableStateOf<Pair<Pull, Int>?>(null) }
    var status by remember { mutableStateOf(if (revealedAtStart.size == first.pulls.size && first.pulls.isNotEmpty()) first.done.ifBlank { "${first.pulls.size} of ${first.pulls.size} revealed" } else "") }
    var busy by remember { mutableStateOf(false) }
    var sound by remember { mutableStateOf(PackSfx.on) }
    var tiltOn by remember { mutableStateOf(PackSfx.tilt) }
    var tiltHint by remember { mutableStateOf(false) }
    var inspecting by remember { mutableStateOf<Pull?>(null) }
    var backPull by remember { mutableFloatStateOf(0f) }
    val n = pack.pulls.size
    val allOpen = n > 0 && revealed.size == n
    fun feel(kind: String) = Feel.perform(view, kind)
    DisposableEffect(Unit) { onDispose { Feel.cancel(context) } }

    fun show(i: Int, touch: Boolean = false) {
        val j = i.coerceIn(0, max(0, n - 1)); if (j == focus) return
        focus = j
        // A face-down hit glows before it is flipped, so the next tap feels worth it.
        val p = pack.pulls[j]
        if (j !in revealed && p.rank >= 2 && stage == PackStage.DEALT) { feel("pack-land"); PackSfx.play("PACK-003", .5f) }
        else if (touch) feel("pack-land")
    }

    fun reveal(i: Int, silent: Boolean = false, charged: Boolean = false) {
        if (i !in pack.pulls.indices || charging != null) return
        if (i in revealed) { show(i); return }
        val p = pack.pulls[i]
        if (!silent && !charged && !Motion.still && focus == i && p.level >= 3) {
            // A big pull gathers itself before it turns: it trembles in its own colour while the light builds.
            charging = i
            feel("pack-charge"); PackSfx.play("PACK-020", .45f + p.level * .08f, if (p.level >= 5) .94f else 1f)
            scope.launch { delay(CHARGE_MS[p.level].toLong()); if (charging == i) { charging = null; reveal(i, charged = true) } }
            return
        }
        revealed += i
        if (!silent) {
            focus = i
            feel(FEELS[p.level]); PackSfx.play(REVEAL_SOUND[p.level])
            momentLevel = p.level; moment++; flipping++
            if (p.level >= 3 && !tiltOn) tiltHint = true
        }
        status = if (revealed.size == n) pack.done.ifBlank { "$n of $n revealed" } else "${revealed.size} of $n revealed"
    }

    fun tear() {
        if (stage != PackStage.SEALED) return
        feel("pack-tear"); PackSfx.play("PACK-004")
        stage = PackStage.TEARING
        scope.launch { delay(if (Motion.still) 0 else 440); if (stage == PackStage.TEARING) stage = PackStage.DEALING }
    }

    fun swipe(step: Int) {
        val nx = focus + step
        if (nx !in 0 until n) return
        if (focus in revealed && !Motion.still) flung = pack.pulls[focus] to step
        show(nx); slide = if (step > 0) slide.coerceAtLeast(0) + 1 else slide.coerceAtMost(0) - 1
    }

    fun next() {
        val ask = onNext ?: return
        if (busy) return
        busy = true
        scope.launch {
            val nx = runCatching { ask() }.getOrElse { status = it.message ?: "Could not open the next pack."; null }
            busy = false
            if (nx == null || nx.pulls.isEmpty()) { if (status.isBlank() || status.contains("revealed")) status = "No more packs to open."; return@launch }
            Feel.cancel(context)
            pack = nx; revealed.clear(); focus = 0; charging = null; status = ""; stage = PackStage.SEALED; tiltHint = false
        }
    }

    // Back closes the topmost layer: the card being inspected first, then the pack. The predictive gesture
    // shrinks the pack under the finger, so the Play home shows through before it lets go.
    BackHandler(enabled = inspecting != null) { inspecting = null }
    PredictiveBackHandler(enabled = inspecting == null) { progress ->
        try { progress.collect { backPull = it.progress }; Feel.cancel(context); onClose() } catch (e: CancellationException) { backPull = 0f; throw e }
    }

    Box(Modifier.fillMaxSize().graphicsLayer { val k = 1f - .1f * backPull; scaleX = k; scaleY = k; alpha = 1f - .35f * backPull; shape = RoundedCornerShape((26 * backPull).dp); clip = backPull > 0f }
        .background(Color(0xE605060B)).clickable(remember { MutableInteractionSource() }, null) {}) {
        Column(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF1D1A15), Site.Bg), center = Offset(540f, 0f), radius = 1600f))
            .statusBarsPadding().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp)) {
            // Header: the set's symbol and name, the pack's line, then sound, tilt and close.
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.zIndex(3f)) {
                SetIcon(pack.set, Modifier.padding(top = 4.dp).size(30.dp), tint = Color(0xFFE9E3D6))
                Column(Modifier.weight(1f)) {
                    Text(pack.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 24.sp, color = Site.Text))
                    Text(pack.note, style = TextStyle(fontFamily = Site.Body.fontFamily, fontSize = 11.sp, lineHeight = 15.sp, color = Site.Muted.copy(alpha = .8f)))
                }
                RoundTool(if (sound) "Mute pack sounds" else "Turn pack sounds on", pressed = !sound, onClick = { PackSfx.toggle(context); sound = PackSfx.on; if (sound) PackSfx.play("PACK-014", .5f) }) { SoundGlyph(sound) }
                RoundTool(if (tiltOn) "Tilt on" else "Tilt off", pressed = tiltOn, hint = tiltHint && !tiltOn, onClick = { PackSfx.toggleTilt(context); tiltOn = PackSfx.tilt; tiltHint = false }) { TiltGlyph(tiltOn) }
                RoundTool("Close pack", onClick = { Feel.cancel(context); onClose() }) { CloseGlyph() }
            }
            Box(Modifier.weight(1f).fillMaxWidth()) {
                if (stage == PackStage.SEALED || stage == PackStage.TEARING) Sealed(pack, stage == PackStage.TEARING, ::tear)
                else Dealt(pack, stage, revealed, focus, charging, moment, momentLevel, flipping, slide, flung, allOpen, tiltOn && inspecting == null,
                    onLanded = { if (stage == PackStage.DEALING) stage = PackStage.DEALT },
                    onDealt = { i, best -> if (best) { feel("pack-rumble"); PackSfx.play("PACK-019", .7f); PackSfx.play("PACK-005", .55f, .94f) } else { PackSfx.play("PACK-005", .55f, 1f + i * .02f); feel("pack-deal") } },
                    onShow = { i, touch -> show(i, touch) },
                    onReveal = { reveal(it) },
                    onFocusTap = { if (focus in revealed) inspecting = pack.pulls[focus] else reveal(focus) },
                    onHold = { i -> if (i in revealed) { feel("pack-land"); inspecting = pack.pulls[i] } },
                    onSwipe = ::swipe,
                    onFlungDone = { flung = null },
                    onRevealAll = {
                        if (charging != null) return@Dealt
                        var best = -1; var at = -1
                        pack.pulls.forEachIndexed { j, p -> if (j !in revealed) { if (p.level > best) { best = p.level; at = j }; reveal(j, silent = true) } }
                        if (at >= 0) { focus = at; feel(FEELS[best]); PackSfx.play(REVEAL_SOUND[best]); momentLevel = best; moment++; flipping++ } else focus = n / 2
                    },
                    onNext = if (onNext != null) ::next else null, busy = busy)
            }
            Text(status, Modifier.fillMaxWidth().heightIn(min = 16.dp).padding(top = 2.dp), style = TextStyle(fontFamily = Site.Body.fontFamily, fontSize = 11.5.sp, lineHeight = 17.sp, color = Site.Gold, textAlign = TextAlign.Center))
        }
        inspecting?.let { Inspect(it, tiltOn) { inspecting = null } }
    }
}

@Composable
private fun RoundTool(label: String, pressed: Boolean = false, hint: Boolean = false, onClick: () -> Unit, glyph: @Composable () -> Unit) {
    val pulse = if (hint && !Motion.still) rememberInfiniteTransition(label = "hint").animateFloat(.35f, 1f, infiniteRepeatable(tween(1200), RepeatMode.Reverse), label = "h").value else 0f
    Box(Modifier.size(44.dp).glow(Site.Gold, pulse * .6f, .1f, .1f, .5f, 10.dp).clip(CircleShape).background(Color(0x0AFFFFFF))
        .border(1.dp, if (hint) Color(0x99E8B95B) else Color(0x24FFFFFF), CircleShape)
        .clickable(onClick = onClick).semantics { contentDescription = label }, contentAlignment = Alignment.Center) { glyph() }
}

private val GlyphInk = Color(0xFFD9DDE6)

@Composable private fun CloseGlyph() = Canvas(Modifier.size(15.dp)) {
    val w = 1.8.dp.toPx()
    drawLine(GlyphInk, Offset(0f, 0f), Offset(size.width, size.height), w, StrokeCap.Round); drawLine(GlyphInk, Offset(size.width, 0f), Offset(0f, size.height), w, StrokeCap.Round)
}

@Composable private fun SoundGlyph(on: Boolean) = Canvas(Modifier.size(19.dp)) {
    val u = size.width / 24f
    val body = Path().apply { moveTo(4 * u, 9 * u); lineTo(8 * u, 9 * u); lineTo(13 * u, 5 * u); lineTo(13 * u, 19 * u); lineTo(8 * u, 15 * u); lineTo(4 * u, 15 * u); close() }
    drawPath(body, GlyphInk, style = Stroke(1.7f * u, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    val st = Stroke(1.7f * u, cap = StrokeCap.Round)
    if (on) { drawArc(GlyphInk, -45f, 90f, false, Offset(10 * u, 8 * u), Size(8 * u, 8 * u), style = st); drawArc(GlyphInk, -50f, 100f, false, Offset(8.5f * u, 4.5f * u), Size(13 * u, 15 * u), style = st) }
    else { drawLine(GlyphInk, Offset(16 * u, 9 * u), Offset(22 * u, 15 * u), st.width, StrokeCap.Round); drawLine(GlyphInk, Offset(22 * u, 9 * u), Offset(16 * u, 15 * u), st.width, StrokeCap.Round) }
}

/** The site's tilt glyph: a phone leaning, with two motion arcs; struck through when tilt is off. */
@Composable private fun TiltGlyph(on: Boolean) = Canvas(Modifier.size(20.dp)) {
    val u = size.width / 24f
    val ink = if (on) Site.Gold else GlyphInk
    val st = Stroke(1.8f * u, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round)
    rotate(-18f, Offset(12 * u, 10 * u)) { drawRoundRect(ink, Offset(8 * u, 3 * u), Size(8 * u, 14 * u), CornerRadius(2 * u), style = st) }
    drawArc(ink, 90f, 70f, false, Offset(3 * u - 9 * u, 15 * u - 9 * u + 0f), Size(18 * u, 18 * u), style = st)
    drawArc(ink, -90f, 70f, false, Offset(21 * u - 9 * u, 9 * u - 9 * u), Size(18 * u, 18 * u), style = st)
    if (!on) drawLine(ink, Offset(4 * u, 4 * u), Offset(20 * u, 20 * u), st.width, StrokeCap.Round)
}

// ---------------------------------------------------------------- sealed

/** The wrapper's size in the pack's body (.pack-wrapper: min(56vw, 250 px) wide at 400:734, never taller than the room). */
private fun packHeight(w: Dp, h: Dp) = minOf(w * .56f * (734f / 400f), 250.dp * (734f / 400f), h - 40.dp)

@Composable
private fun Sealed(pack: PackResult, tearing: Boolean, onTear: () -> Unit) = BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    val h = packHeight(maxWidth, maxHeight); val w = h * (400f / 734f)
    val float = if (Motion.still) 0f else rememberInfiniteTransition(label = "float").animateFloat(0f, 1f, infiniteRepeatable(tween(2250, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "f").value
    val rip = remember { Animatable(0f) }; val slice = remember { Animatable(0f) }; val flash = remember { Animatable(0f) }; val strip = remember { Animatable(0f) }
    LaunchedEffect(tearing) {
        if (!tearing || Motion.still) return@LaunchedEffect
        // pack-slice .34 s, pack-strip .5 s, pack-flash .5 s from .3 s, pack-rip .62 s.
        launch { slice.animateTo(1f, tween(340, easing = CubicBezierEasing(.6f, 0f, .4f, 1f))) }
        launch { strip.animateTo(1f, tween(500, easing = CubicBezierEasing(.42f, 0f, 1f, 1f))) }
        launch { delay(300); flash.animateTo(1f, tween(500, easing = LinearEasing)) }
        rip.animateTo(1f, tween(620, easing = CubicBezierEasing(.4f, 0f, .2f, 1f)))
    }
    val r = rip.value
    Box(Modifier.width(w).height(h).graphicsLayer {
        // pack-float: up 8 px with a little turn; pack-rip: up and bigger at 30 %, then down 55 % and away.
        cameraDistance = 12f * density
        val up = if (r < .3f) r / .3f else 1f - (r - .3f) / .7f
        translationY = -8.dp.toPx() * float + (-6.dp.toPx() * up) + (if (r > .3f) size.height * .55f * ((r - .3f) / .7f) else 0f)
        rotationY = -6f * float; rotationX = 3f * float; rotationZ = -2f * up
        val k = if (r < .3f) 1f + .03f * up else 1.03f - .18f * ((r - .3f) / .7f)
        scaleX = k; scaleY = k; alpha = if (r > .3f) 1f - (r - .3f) / .7f else 1f
    }.glow(Color.Black, .6f, .02f, .03f, .04f, 30.dp)
        .clickable(remember { MutableInteractionSource() }, null, onClick = onTear).semantics { contentDescription = "Open the ${pack.name} pack" }) {
        // Body below the cut, and the top strip that tears off and flies (pack-strip).
        Box(Modifier.fillMaxSize().drawWithContent { clipRect(top = size.height * .085f * strip.value.coerceAtMost(1f).let { if (it > 0f) 1f else 0f }) { this@drawWithContent.drawContent() } }) {
            Booster(pack.set, pack.name, Modifier.fillMaxSize())
            if (!Motion.still) {
                // pack-sheen: a soft rainbow band sweeping across every 3.2 s.
                val sweep = rememberInfiniteTransition(label = "sheen").animateFloat(1.2f, -.2f, infiniteRepeatable(tween(3200, easing = FastOutSlowInEasing)), label = "s").value
                Box(Modifier.fillMaxSize().drawWithContent {
                    val cx = size.width * sweep; val half = size.width * .5f
                    drawRect(Brush.linearGradient(listOf(Color.Transparent, Color(0x40FFFFFF), Color(0x339FE3FF), Color(0x33FFD0F2), Color.Transparent), Offset(cx - half, 0f), Offset(cx + half, size.height * .2f)), blendMode = BlendMode.Screen)
                })
            }
        }
        if (strip.value > 0f) Box(Modifier.fillMaxWidth().height(h * .085f).graphicsLayer {
            val s = strip.value; translationX = size.width * .3f * s; translationY = -size.height * 1.8f * s * 2.2f; rotationZ = -14f * s; alpha = 1f - s
        }.drawWithContent { clipRect(bottom = size.height) { this@drawWithContent.drawContent() } }) {
            Box(Modifier.width(w).height(h)) { Booster(pack.set, pack.name, Modifier.fillMaxSize()) }
        }
        // The cut: a bright line racing across under the crimp.
        if (slice.value in .001f..0.999f || (tearing && slice.value >= 1f && r < .5f)) Canvas(Modifier.fillMaxWidth().height(h * .085f + 2.dp)) {
            val y = size.height - 1.dp.toPx(); val half = size.width * slice.value / 2
            drawLine(Brush.horizontalGradient(listOf(Color.Transparent, Color.White, Color(0xFFFFF1C8), Color.White, Color.Transparent), size.width / 2 - half, size.width / 2 + half), Offset(size.width / 2 - half, y), Offset(size.width / 2 + half, y), 2.5.dp.toPx())
        }
        // pack-flash: light bursts out of the opened top (radial at 50 % 20 %, 30 % past every edge).
        val f = flash.value
        val fa = if (f < .3f) f / .3f else 1f - (f - .3f) / .7f
        if (fa > 0f) Canvas(Modifier.fillMaxSize().graphicsLayer { scaleX = 1.6f; scaleY = 1.6f; alpha = fa }) {
            drawRect(Brush.radialGradient(0f to Color.White, .22f to Color(0x88FFFFFF), .6f to Color.Transparent, center = Offset(size.width / 2, size.height * .2f), radius = size.maxDimension * .6f))
        }
    }
}

// ---------------------------------------------------------------- dealt

@Composable
private fun Dealt(pack: PackResult, stage: PackStage, revealed: List<Int>, focus: Int, charging: Int?, moment: Int, momentLevel: Int, flipping: Int, slide: Int,
                  flung: Pair<Pull, Int>?, allOpen: Boolean, tilt: Boolean,
                  onLanded: () -> Unit, onDealt: (Int, Boolean) -> Unit, onShow: (Int, Boolean) -> Unit, onReveal: (Int) -> Unit, onFocusTap: () -> Unit,
                  onHold: (Int) -> Unit, onSwipe: (Int) -> Unit, onFlungDone: () -> Unit, onRevealAll: () -> Unit, onNext: (() -> Unit)?, busy: Boolean) = BoxWithConstraints(Modifier.fillMaxSize()) {
    val n = pack.pulls.size
    val bodyW = maxWidth; val bodyH = maxHeight
    val density = LocalDensity.current
    val handW = minOf(maxWidth * .19f, 112.dp, maxHeight * .14f)
    val handH = handW * (88f / 63f) * 1.22f + 16.dp
    // The deal: each card leaves the pack in turn (gap ms apart, a 640 ms flight); a tap anywhere lands them all.
    val gap = min(85, 1100 / max(1, n)); val fly = 640
    val total = (n - 1) * gap + fly
    val deal = remember(pack) { Animatable(if (stage == PackStage.DEALT || Motion.still) 1f else 0f) }
    val rise = remember(pack) { Animatable(if (stage == PackStage.DEALT) 1f else 0f) }
    // The pack's three best cards (by the feel their flip will have) land with a low rumble and a glow.
    val best = remember(pack) { pack.pulls.indices.sortedWith(compareByDescending<Int> { pack.pulls[it].level }).take(min(3, n)).toSet() }
    val landedAt = remember(pack) { mutableStateListOf<Int>() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(pack, stage) {
        if (stage != PackStage.DEALING) return@LaunchedEffect
        launch { for (i in 0 until n) { delay((if (i == 0) fly - 40 else gap).toLong()); if (deal.value < 1f) { onDealt(i, i in best); landedAt += i } } }
        deal.animateTo(1f, tween(total, easing = LinearEasing))
        onLanded(); rise.animateTo(1f, tween(460, easing = LinearEasing))
    }
    val t = deal.value * total
    fun cardT(i: Int) = if (stage == PackStage.DEALT) 1f else ((t - i * gap) / fly).coerceIn(0f, 1f)
    var handOrigin by remember { mutableStateOf(Offset.Zero) }
    var actionsH by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize().pointerInput(stage) {
        // A tap during the deal skips it, as in Arena: every card lands at once and the big card comes up.
        if (stage == PackStage.DEALING) awaitEachGesture { awaitFirstDown(pass = PointerEventPass.Initial); scope.launch { deal.snapTo(1f); onLanded(); rise.snapTo(1f) } }
    }) {
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            Focus(pack, focus, focus in revealed, charging == focus, moment, momentLevel, flipping, slide, flung, tilt, rise.value, stage == PackStage.DEALING && deal.value < 1f,
                onTap = onFocusTap, onHold = { onHold(focus) }, onSwipe = onSwipe, onFlungDone = onFlungDone)
        }
        // The hand: cards overlap left to right so each name corner shows; the one in focus rises.
        Box(Modifier.onGloballyPositioned { handOrigin = it.positionInParent() }) {
            Hand(pack, revealed, focus, handW, handH, landed = { i -> cardT(i) >= 1f }, bestGlow = { i -> i in best && i in landedAt && stage == PackStage.DEALING },
                onShow = { onShow(it, true) }, onTap = { onShow(it, false); onReveal(it) }, onHold = onHold)
        }
        // Actions: Reveal all until every card is up, then Open the next pack.
        Box(Modifier.fillMaxWidth().padding(top = 2.dp).onGloballyPositioned { actionsH = it.size.height }, contentAlignment = Alignment.Center) {
            if (!allOpen) PillButton("Reveal all", ghost = true, onClick = onRevealAll)
            else if (onNext != null) PillButton(if (busy) "Opening…" else "Open the next pack", ghost = false, wide = true, onClick = onNext)
        }
    }
    // The flight, above everything: the torn pack (cards under it until they clear its top), then the cards.
    if (stage == PackStage.DEALING && deal.value < 1f) with(density) {
        val ph = packHeight(bodyW, bodyH); val pw = ph * (400f / 734f)
        val focusH = bodyH - handH - actionsH.toDp()
        val packTop = (focusH - ph) / 2; val packLeft = (bodyW - pw) / 2
        // Ghost: holds while the cards leave, then sinks 36 % and fades; light glows in its open mouth.
        val ghostHold = min(.8f, (n * gap).toFloat() / (total + 260))
        val g = (t / (total + 260)).coerceIn(0f, 1f)
        val sink = if (g < ghostHold) 0f else ((g - ghostHold) / (1f - ghostHold))
        Box(Modifier.offset(packLeft, packTop).width(pw).height(ph).zIndex(70f).graphicsLayer {
            val e = CubicBezierEasing(.45f, 0f, .55f, 1f).transform(sink)
            translationY = size.height * .36f * e; scaleX = 1f - .1f * e; scaleY = scaleX; alpha = 1f - e
        }) {
            Box(Modifier.fillMaxSize().drawWithContent { clipRect(top = size.height * .085f) { this@drawWithContent.drawContent() } }) { Booster(pack.set, pack.name, Modifier.fillMaxSize()) }
            val m = (t / 900f).coerceIn(0f, 1f)
            val ma = if (m < .35f) m / .35f else 1f - (m - .35f) / .65f
            Canvas(Modifier.fillMaxWidth().height(ph * .2f).offset(y = ph * .0f).graphicsLayer { scaleX = if (m < .35f) .4f + .6f * (m / .35f) else 1f; alpha = ma }) {
                drawOval(Brush.radialGradient(0f to Color(0xCCFFFBE8), .38f to Color(0x55FFE3A0), .72f to Color.Transparent, center = Offset(size.width / 2, size.height * .45f), radius = size.width * .5f),
                    topLeft = Offset(size.width * .06f, size.height * .1f), size = Size(size.width * .88f, size.height * .7f))
            }
        }
        val cardH = handW * (88f / 63f)
        val span = bodyW - 12.dp - handW
        val mid = (n - 1) / 2f
        val k = min(1.6f, pw.value * .78f / handW.value)
        for (i in 0 until n) {
            val ft = cardT(i)
            if (ft <= 0f || ft >= 1f) continue
            val e = flyEase.transform(ft)
            val slotX = 6.dp + (if (n <= 1) (bodyW - 12.dp - handW) / 2 else span * (i.toFloat() / (n - 1)))
            val slotY = handOrigin.y.toDp() + handH - 4.dp - cardH
            val cx = slotX + handW / 2; val cy = slotY + cardH / 2
            val ox = (packLeft + pw / 2 - cx).toPx()
            val inside = (packTop + ph * .42f - cy).toPx(); val above = (packTop - cardH * k * .32f - cy).toPx()
            val spread = (i - mid) * min(14.dp.toPx(), pw.toPx() * .05f)
            fun lerp(a: Float, b: Float, f: Float) = a + (b - a) * f
            val (x, y, rot, sc) = when {
                e < .34f -> { val f = e / .34f; listOf(lerp(ox, ox + spread * .4f, f), lerp(inside, above, f), lerp(0f, (i - mid) * 1.5f, f), lerp(k, k * .92f, f)) }
                e < .4f -> { val f = (e - .34f) / .06f; listOf(lerp(ox + spread * .4f, ox + spread, f), above, lerp((i - mid) * 1.5f, (i - mid) * 3f, f), lerp(k * .92f, k * .9f, f)) }
                else -> { val f = (e - .4f) / .6f; listOf(lerp(ox + spread, 0f, f), lerp(above, 0f, f), lerp((i - mid) * 3f, 0f, f), lerp(k * .9f, 1f, f)) }
            }
            Box(Modifier.offset(slotX, slotY).width(handW).height(cardH).zIndex(if (e < .4f) 10f + i else 200f + i).graphicsLayer {
                translationX = x; translationY = y; rotationZ = rot; scaleX = sc; scaleY = sc
            }.glow(Color(0xFFD9CCFF), .35f, .03f, .03f, .1f, 9.dp).clip(RoundedCornerShape(6.dp))) { MagicBack(Modifier.fillMaxSize()) }
        }
    }
}

@Composable
private fun PillButton(label: String, ghost: Boolean, wide: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Box((if (wide) Modifier.widthIn(max = 420.dp).fillMaxWidth() else Modifier).heightIn(min = 44.dp)
        .then(if (!ghost) Modifier.glow(Site.Gold, .3f, .02f, .1f, .5f, 18.dp) else Modifier).clip(shape)
        .then(if (ghost) Modifier.background(Color(0x0FFFFFFF)).border(1.dp, Color(0x2EFFFFFF), shape) else Modifier.background(Brush.verticalGradient(listOf(Color(0xFFF2D488), Color(0xFFD6AD64)))))
        .clickable(onClick = onClick).padding(horizontal = 26.dp), contentAlignment = Alignment.Center) {
        Text(label, style = TextStyle(fontFamily = Site.Body.fontFamily, fontWeight = FontWeight.Bold, fontSize = 14.sp, letterSpacing = .01.em, color = if (ghost) Site.Text else Color(0xFF1B1507)))
    }
}

/** The big card: face down until tapped, then the pull in its tier frame, its backlight behind it like a TV's light strip. */
@Composable
private fun Focus(pack: PackResult, focus: Int, open: Boolean, charging: Boolean, moment: Int, momentLevel: Int, flipping: Int, slide: Int, flung: Pair<Pull, Int>?,
                  tiltOn: Boolean, rise: Float, awaiting: Boolean, onTap: () -> Unit, onHold: () -> Unit, onSwipe: (Int) -> Unit, onFlungDone: () -> Unit) = BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    val p = pack.pulls.getOrNull(focus) ?: return@BoxWithConstraints
    val meta = 52.dp
    val cardW = minOf(400.dp, maxWidth - 32.dp, (maxHeight - meta - 18.dp) * (63f / 88f))
    val cardH = cardW * (88f / 63f)
    // The flip: 0 = back up, 180 = face up; the card lifts and leans as it turns (flipLift), and settles.
    val flip by animateFloatAsState(if (open) 180f else 0f, if (Motion.still) tween(0) else tween(700, easing = ease), label = "flip")
    val lift = remember { Animatable(1f) }
    val pop = remember { Animatable(1f) }
    val ring = remember { Animatable(1f) }; val ring2 = remember { Animatable(1f) }
    val embers = remember { Animatable(1f) }
    val rays = remember { Animatable(1f) }
    val sway = remember { Animatable(1f) }
    val catch = remember { Animatable(1f) }
    val slideIn = remember { Animatable(1f) }
    val charge = remember { Animatable(0f) }
    LaunchedEffect(flipping) { if (flipping > 0 && !Motion.still) { lift.snapTo(0f); lift.animateTo(1f, tween(560 + momentLevel * 70, easing = LinearEasing)) } }
    LaunchedEffect(slide) { if (slide != 0 && !Motion.still) { slideIn.snapTo(0f); slideIn.animateTo(1f, tween(320, easing = ease)) } }
    LaunchedEffect(charging) { if (charging) { charge.snapTo(0f); charge.animateTo(1f, tween(CHARGE_MS[min(5, p.level)].coerceAtLeast(1), easing = CubicBezierEasing(.5f, 0f, .9f, .6f))) } else charge.snapTo(0f) }
    LaunchedEffect(moment) {
        if (moment == 0 || Motion.still) return@LaunchedEffect
        delay(330)
        val L = momentLevel
        launch { catch.snapTo(0f); catch.animateTo(1f, tween(660, easing = CubicBezierEasing(.3f, .7f, .2f, 1f))) }
        launch { pop.snapTo(1f); val peak = when (L) { 2 -> 1.09f; 3 -> 1.12f; 4, 5 -> 1.17f; else -> 1.07f }
            pop.animateTo(peak, tween(if (L >= 4) 160 else 140)); pop.animateTo(1f, spring(dampingRatio = .55f, stiffness = 500f)) }
        if (L >= 1) launch { ring.snapTo(0f); ring.animateTo(1f, tween(620 + L * 110, easing = CubicBezierEasing(.2f, .7f, .3f, 1f))) }
        if (L >= 5) launch { delay(220); ring2.snapTo(0f); ring2.animateTo(1f, tween(1300, easing = CubicBezierEasing(.2f, .7f, .3f, 1f))) }
        if (L >= 2) launch { embers.snapTo(0f); embers.animateTo(1f, tween(1100 + L * 90, easing = LinearEasing)) }
        if (L >= 3) {
            launch { rays.snapTo(0f); rays.animateTo(1f, tween(if (L >= 5) 2500 else if (L == 4) 2000 else 1600, easing = CubicBezierEasing(0f, 0f, .58f, 1f))) }
            launch { sway.snapTo(0f); sway.animateTo(1f, tween(1100, easing = LinearEasing)) }
        }
    }
    val tease = !open && p.rank >= 2
    val teaseGlow = if (Motion.still) .7f else rememberInfiniteTransition(label = "tease").animateFloat(.35f, .85f, infiniteRepeatable(tween(1100, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "t").value
    val tremble = if (charging && !Motion.still) rememberInfiniteTransition(label = "charge").animateFloat(-1f, 1f, infiniteRepeatable(tween(36, easing = LinearEasing), RepeatMode.Reverse), label = "c").value else 0f
    var drag by remember { mutableFloatStateOf(0f) }
    val dragAnim by animateFloatAsState(drag, if (drag == 0f) spring(stiffness = 600f, dampingRatio = .8f) else tween(0), label = "drag")
    val tilt by rememberTilt()
    val live = tiltOn && tilt.live && open
    // At rest the light drifts slowly over the card (the site's light(): 50 + 44 sin(t/1500), 42 + 30 sin(t/2100)).
    val clock = if (Motion.still) 0f else rememberInfiniteTransition(label = "light").animateFloat(0f, 1f, infiniteRepeatable(tween(60000, easing = LinearEasing)), label = "l").value * 60000f
    val sw = sway.value.let { if (it < 1f) sin(it * PI.toFloat() * 2.5f) * (1f - it) else 0f }
    val lx = when { live -> .5f + tilt.x * .4f; sw != 0f -> .5f + sw * .46f; else -> .5f + .44f * sin(clock / 1500f) }
    val ly = when { live -> .5f + tilt.y * .4f; sw != 0f -> .4f - sw * .12f; else -> .42f + .3f * sin(clock / 2100f) }
    val L = momentLevel
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.graphicsLayer {
            // pack-await, then pack-rise: up from 42 % below at 82 %, past its place at 70 %, settled.
            if (awaiting) { alpha = 0f; return@graphicsLayer }
            val r = rise
            val ty = if (r < .7f) lerpF(.42f, -.02f, ease.transform(r / .7f)) else lerpF(-.02f, 0f, (r - .7f) / .3f)
            val s = if (r < .7f) lerpF(.82f, 1.03f, ease.transform(r / .7f)) else lerpF(1.03f, 1f, (r - .7f) / .3f)
            translationY = cardH.toPx() * ty; scaleX = s; scaleY = s; alpha = (r / .7f).coerceIn(0f, 1f)
        }) {
        Box(Modifier.width(cardW).height(cardH), contentAlignment = Alignment.Center) {
            val tier = p.tier.rich()
            // Rays for big pulls: a slow fan of light turning behind the card.
            if (rays.value < 1f && L >= 3) Canvas(Modifier.width(cardW * 2.2f).height(cardW * 2.2f).graphicsLayer {
                val r = rays.value; val k = if (r < .25f) .4f + .6f * (r / .25f) else 1f + .15f * ((r - .25f) / .75f)
                scaleX = k; scaleY = k; rotationZ = if (r < .25f) 20f * (r / .25f) else 20f + 50f * ((r - .25f) / .75f)
                alpha = if (r < .25f) .9f * (r / .25f) else .9f * (1f - (r - .25f) / .75f)
            }) { drawRays(TIER_COLORS[min(5, L)]) }
            // The backlight: the tier's light spilling far past the card, like a TV's light strip on the wall.
            val backColor = when { charging -> TIER_COLORS[min(5, p.level)]; tease -> Color(0xFFF0C75E); open -> tier; else -> null }
            val backAlpha = when { charging -> .35f + .65f * charge.value; tease -> teaseGlow * .8f; open -> .48f; else -> 0f }
            if (backColor != null) Box(Modifier.width(cardW).height(cardH).graphicsLayer { val s = if (charging) .9f + .22f * charge.value else 1f; scaleX = s; scaleY = s }
                .glow(backColor, backAlpha, .16f, .14f, .22f, 42.dp))
            // Ring: a frame of the tier colour that grows and fades from the card (a second, slower one for a grail).
            for ((a, big) in listOf(ring to false, ring2 to true)) if (a.value < 1f && L >= 1) Box(Modifier.width(cardW).height(cardH).graphicsLayer {
                val k = if (big) .95f + 1.25f * a.value else .92f + (.43f + L * .12f) * a.value
                scaleX = k; scaleY = k; alpha = (if (big) .8f else .95f) * (1f - a.value)
            }.glow(TIER_COLORS[L], .6f, .02f, .02f, .06f, 14.dp).border(3.dp, TIER_COLORS[L], RoundedCornerShape(6)))
            // The card leaving on a swipe flicks off the stack with a tilt.
            flung?.let { (fp, step) -> FlungCard(fp, step, cardW, cardH, onFlungDone) }
            Box(Modifier.width(cardW).height(cardH)
                .pointerInput(focus) {
                    detectHorizontalDragGestures(onDragEnd = { val d = drag; drag = 0f; if (abs(d) > 40.dp.toPx()) onSwipe(if (d < 0) 1 else -1) }, onDragCancel = { drag = 0f }) { _, dx -> drag += dx }
                }
                .pointerInput(focus, open) { detectTapGestures(onTap = { onTap() }, onLongPress = { onHold() }) }
                .semantics { contentDescription = if (open) "${p.name}. Open card" else "Card ${focus + 1}, face down. Reveal" }
                .graphicsLayer {
                    cameraDistance = 14f * density
                    val l = lift.value; val arc = if (l >= 1f) 0f else if (l < .42f) l / .42f else 1f - (l - .42f) / .58f
                    val big = if (open) intArrayOf(3, 5, 7, 10, 13, 17)[min(5, L)] else 2
                    val si = slideIn.value; val sIn = if (si < 1f) (1f - si) else 0f
                    translationX = dragAnim * .6f + tremble * (1.2f + p.level * .9f).dp.toPx() * (.4f + charge.value) + sign(slide.toFloat()) * size.width * .38f * sIn
                    translationY = -size.height * big / 100f * arc
                    rotationZ = (-1.5f - big * .12f) * arc
                    rotationX = if (live) -tilt.y * 8f else sw * -4f
                    rotationY = if (live) tilt.x * 8f else sw * 14f
                    val s = pop.value * (if (sIn > 0f) 1f - .08f * sIn else 1f)
                    scaleX = s; scaleY = s; alpha = if (sIn > 0f) 1f - .8f * sIn else 1f
                }) {
                // Back and face turn about the card's middle; each hides once past edge-on.
                Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 14f * density; rotationY = flip; alpha = if (flip < 90f) 1f else 0f }) {
                    Box(Modifier.fillMaxSize().clip(RoundedCornerShape(4.6f.dp))) { MagicBack(Modifier.fillMaxSize()) }
                    val edge = if (charging) TIER_COLORS[min(5, p.level)] else Color(0xFFF0C75E)
                    if (tease || charging) Box(Modifier.fillMaxSize().border(3.dp, edge.copy(alpha = .6f), RoundedCornerShape(4.6f.dp)).background(Brush.radialGradient(listOf(Color.Transparent, edge.copy(alpha = .22f)), radius = with(LocalDensity.current) { cardW.toPx() } * .8f), RoundedCornerShape(4.6f.dp)))
                }
                Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 14f * density; rotationY = flip - 180f; alpha = if (flip >= 90f) 1f else 0f }) {
                    // The collection's tier frame (3 % of the card's width), then the card, its foil and the light catch.
                    Box(Modifier.fillMaxSize().drawBehind {
                        val e = size.width * .03f
                        drawRoundRect(Brush.verticalGradient(listOf(tier.copy(alpha = .95f), tier.copy(alpha = .75f))), Offset(-e, -e), Size(size.width + 2 * e, size.height + 2 * e), CornerRadius(size.width * .076f))
                        drawRoundRect(Color(0x55FFFFFF), Offset(-e, -e), Size(size.width + 2 * e, size.height + 2 * e), CornerRadius(size.width * .076f), style = Stroke(1.dp.toPx()))
                    }.clip(RoundedCornerShape(cardW * .046f)).background(Color(0xFF0B0C10))) {
                        PullFace(p, Modifier.fillMaxSize(), lx, ly)
                        if (catch.value < 1f) Box(Modifier.fillMaxSize().drawWithContent {
                            // fx-catch: a band of white light crossing the card once, skewed.
                            val x = size.width * (-1.7f + 3.4f * catch.value)
                            drawRect(Brush.linearGradient(listOf(Color.Transparent, Color(0x99FFFFFF), Color.Transparent), Offset(x, 0f), Offset(x + size.width * .5f, size.height * .1f)), blendMode = BlendMode.Screen)
                        })
                    }
                }
            }
            if (embers.value < 1f && L >= 2) Embers(cardW, cardH, L, embers.value, moment)
        }
        // Name and rarity pill once face up.
        Column(Modifier.heightIn(min = meta - 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            if (open) {
                Text(p.name, style = TextStyle(fontFamily = Site.Body.fontFamily, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Site.Text), textAlign = TextAlign.Center)
                RarityPill(p.rarity, if (p.foil) "Foil" else "")
            }
        }
    }
}

private fun lerpF(a: Float, b: Float, f: Float) = a + (b - a) * f

private fun DrawScope.drawRays(color: Color) {
    val c = center; val r = size.minDimension / 2
    for (k in 0 until 14) {
        val a0 = k * (360f / 14f); val sweep = 9f
        drawArc(Brush.radialGradient(listOf(color.copy(alpha = .55f), color.copy(alpha = .18f), Color.Transparent), c, r), a0, sweep, true, Offset(c.x - r, c.y - r), Size(r * 2, r * 2))
    }
}

@Composable
private fun FlungCard(p: Pull, step: Int, w: Dp, h: Dp, onDone: () -> Unit) {
    val a = remember(p, step) { Animatable(0f) }
    LaunchedEffect(p, step) { a.animateTo(1f, tween(360, easing = CubicBezierEasing(.3f, .6f, .4f, 1f))); onDone() }
    Box(Modifier.width(w).height(h).zIndex(5f).graphicsLayer {
        translationX = -step * size.width * 1.15f * a.value; translationY = -size.height * .06f * a.value; rotationZ = -step * 16f * a.value; alpha = 1f - a.value
    }.clip(RoundedCornerShape(w * .046f))) { PullFace(p, Modifier.fillMaxSize()) }
}

/** A pulled card's face; a holo pull wears the app's foil (a rainbow sweep and a soft light that follow the tilt). */
@Composable
fun PullFace(p: Pull, modifier: Modifier, lx: Float = .5f, ly: Float = .4f) = Box(modifier) {
    val painter = heroPainter(p.image.ifBlank { null }?.let(homeArt))
    if (painter != null) Image(painter, p.name, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
    if (p.foil) Box(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }.drawWithContent {
        val w = size.width; val h = size.height
        val shift = (lx - .5f) * w * 1.4f
        drawRect(Brush.linearGradient(listOf(Color(0x00FF7AB8), Color(0x55FF9A7A), Color(0x55FFE680), Color(0x557DFFC4), Color(0x558AB8FF), Color(0x55C08CFF), Color(0x00FF7AB8)),
            Offset(shift - w * .3f, 0f), Offset(shift + w * 1.3f, h)), blendMode = BlendMode.Overlay)
        drawRect(Brush.radialGradient(listOf(Color(0x59FFFFFF), Color.Transparent), Offset(w * lx, h * ly), w * .55f), blendMode = BlendMode.Screen)
    })
}

/** rarityEmblem('mtg'): the faceted gem in the set-symbol colour, with the finish before the rarity. */
@Composable
fun RarityPill(rarity: String, finish: String) {
    val r = rarity.lowercase()
    val (gem, ink) = when {
        "mythic" in r -> Color(0xFFF0662A) to Color(0xFFFFB27A)
        "special" in r || "bonus" in r -> Color(0xFFA46AE0) to Color(0xFFE2CCFF)
        "uncommon" in r -> Color(0xFFA9B8C6) to Color(0xFFC9D5E0)
        "rare" in r -> Color(0xFFD8B45A) to Color(0xFFECCA73)
        else -> Color(0xFF1D1D1F) to Site.Text
    }
    Row(Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0x0CFFFFFF)).border(1.dp, Color(0x1CFFFFFF), RoundedCornerShape(99.dp)).padding(start = 9.dp, end = 12.dp, top = 3.dp, bottom = 3.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Canvas(Modifier.size(15.dp)) {
            val u = size.width / 20f
            val body = Path().apply { moveTo(10 * u, 1.5f * u); lineTo(18 * u, 7.2f * u); lineTo(15 * u, 18 * u); lineTo(5 * u, 18 * u); lineTo(2 * u, 7.2f * u); close() }
            drawPath(body, gem)
            val facet = Path().apply { moveTo(10 * u, 1.5f * u); lineTo(13 * u, 7.2f * u); lineTo(10 * u, 18 * u); lineTo(7 * u, 7.2f * u); close(); moveTo(2 * u, 7.2f * u); lineTo(18 * u, 7.2f * u) }
            drawPath(facet, Color(0x70FFFFFF), style = Stroke(.7f * u))
        }
        val label = rarity.replaceFirstChar { it.uppercase() }
        Text(if (finish.isNotBlank()) "$finish · $label" else label, style = TextStyle(fontFamily = Site.Body.fontFamily, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = .03.em, color = ink))
    }
}

/** Embers: sparks of the tier colour thrown out from the card's middle (10 for blue, 16 for purple, 26 for gold). */
@Composable
private fun Embers(cardW: Dp, cardH: Dp, level: Int, t: Float, seed: Int) {
    val count = intArrayOf(0, 0, 10, 16, 26, 44)[min(5, level)]
    val color = TIER_COLORS[min(5, level)]
    val rnd = remember(seed) { java.util.Random(seed * 31L + level).let { r -> List(count) { floatArrayOf(r.nextFloat(), r.nextFloat(), r.nextFloat(), r.nextFloat(), r.nextFloat()) } } }
    Canvas(Modifier.width(cardW).height(cardH)) {
        val cx = size.width / 2; val cy = size.height / 2
        for (e in rnd) {
            val a = e[0] * 2 * PI.toFloat(); val d = size.width * (.55f + e[1] * .6f + level * .08f)
            // Each spark has its own length (700–1200 ms + 90 per level) and a short random delay.
            val life = (700f + e[4] * 500f + level * 90f) / (1100f + level * 90f)
            val k = ((t - e[3] * .1f) / life).coerceIn(0f, 1f)
            if (k <= 0f || k >= 1f) continue
            val m = CubicBezierEasing(.15f, .75f, .3f, 1f).transform(k)
            val x = cx + cos(a) * d * m; val y = cy + (sin(a) * d + size.height * .12f) * m
            val alpha = if (k < .12f) k / .12f else 1f - (k - .12f) / .88f
            val r = (3f + e[2] * (2 + level)).dp.toPx() / 2f * (.4f + .6f * m)
            drawCircle(color.copy(alpha = alpha * .35f), r * 3f, Offset(x, y))
            drawCircle(color.copy(alpha = alpha), r, Offset(x, y))
        }
    }
}

/** The hand row: every card overlapping the one before it; slide a finger along to scrub, tap to turn, hold to inspect. */
@Composable
private fun Hand(pack: PackResult, revealed: List<Int>, focus: Int, handW: Dp, handH: Dp, landed: (Int) -> Boolean, bestGlow: (Int) -> Boolean,
                 onShow: (Int) -> Unit, onTap: (Int) -> Unit, onHold: (Int) -> Unit) =
    BoxWithConstraints(Modifier.fillMaxWidth().height(handH).padding(horizontal = 6.dp, vertical = 4.dp)) {
        val n = pack.pulls.size
        val fullW = maxWidth; val fullH = maxHeight
        val span = fullW - handW
        val cardH = handW * (88f / 63f)
        val density = LocalDensity.current
        fun under(x: Float): Int = with(density) { ((x - handW.toPx() / 2) / max(1f, span.toPx()) * (n - 1)).roundToInt().coerceIn(0, max(0, n - 1)) }
        Box(Modifier.fillMaxSize()
            .pointerInput(n) { detectHorizontalDragGestures { ch, _ -> onShow(under(ch.position.x)) } }
            .pointerInput(n) { detectTapGestures(onTap = { onTap(under(it.x)) }, onLongPress = { onHold(under(it.x)) }) }) {
            pack.pulls.forEachIndexed { i, p ->
                val d = i - focus
                val edge = (d < 0 && i == 0) || (d > 0 && i == n - 1)
                val push = if (d != 0 && !edge) sign(d.toFloat()) * max(0f, 1f - (abs(d) - 1) * .45f) else 0f
                val focused = i == focus
                val raise by animateFloatAsState(if (focused) 1f else 0f, if (Motion.still) tween(0) else tween(260, easing = ease), label = "raise")
                val shove by animateFloatAsState(push, if (Motion.still) tween(0) else tween(260, easing = ease), label = "push")
                val open = i in revealed
                val turn by animateFloatAsState(if (open) 180f else 0f, if (Motion.still) tween(0) else tween(550, easing = ease), label = "turn")
                val glowIn by animateFloatAsState(if (open) 1f else 0f, if (Motion.still) tween(0) else tween(450), label = "glow")
                val bestLand by animateFloatAsState(if (bestGlow(i)) 1f else 0f, tween(if (bestGlow(i)) 120 else 500), label = "best")
                val x = if (n <= 1) (fullW - handW) / 2 else span * (i.toFloat() / (n - 1))
                Box(Modifier.zIndex(if (focused) 60f else 10f + i).offset(x = x, y = fullH - cardH).width(handW).height(cardH)
                    .graphicsLayer {
                        transformOrigin = TransformOrigin(.5f, 1f)
                        translationX = handW.toPx() * .18f * shove
                        translationY = -cardH.toPx() * .14f * raise
                        val s = 1f + .08f * raise
                        scaleX = s; scaleY = s; alpha = if (landed(i)) 1f else 0f
                    }
                    // The tier's ring and its blurred light under each turned card; the best three glow as they land.
                    .glow(p.tier.rich(), .7f * glowIn, .06f, .05f, .12f, 12.dp)
                    .glow(Color(0xFFFFE39A), .55f * bestLand, .05f, .04f, .12f, 16.dp)
                    .semantics { contentDescription = if (open) "${p.name} · revealed" else "Card ${i + 1}, face down" }) {
                    Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 10f * density.density; rotationY = turn; alpha = if (turn < 90f) 1f else 0f }.clip(RoundedCornerShape(6.dp))) { MagicBack(Modifier.fillMaxSize()) }
                    Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 10f * density.density; rotationY = turn - 180f; alpha = if (turn >= 90f) 1f else 0f }
                        .border(2.dp, p.tier.copy(alpha = glowIn), RoundedCornerShape(6.dp)).clip(RoundedCornerShape(6.dp)).background(Color(0xFF0B0C10))) {
                        PullFace(p, Modifier.fillMaxSize())
                    }
                }
            }
        }
    }

/** Inspecting a pulled card: it comes up big above the pack (which waits, untouched, underneath); Back or a tap puts it down. */
@Composable
private fun Inspect(p: Pull, tiltOn: Boolean, onClose: () -> Unit) {
    val a = remember(p) { Animatable(0f) }
    LaunchedEffect(p) { a.animateTo(1f, spring(dampingRatio = .8f, stiffness = 600f)) }
    val tilt by rememberTilt()
    val live = tiltOn && tilt.live
    BoxWithConstraints(Modifier.fillMaxSize().zIndex(100f).background(Color.Black.copy(alpha = .78f * a.value))
        .clickable(remember { MutableInteractionSource() }, null, onClick = onClose).statusBarsPadding().navigationBarsPadding().padding(16.dp), contentAlignment = Alignment.Center) {
        val w = minOf(maxWidth, (maxHeight - 70.dp) * (63f / 88f), 520.dp)
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.width(w).height(w * (88f / 63f)).graphicsLayer {
                val s = .85f + .15f * a.value; scaleX = s; scaleY = s; alpha = a.value; cameraDistance = 14f * density
                rotationX = if (live) -tilt.y * 8f else 0f; rotationY = if (live) tilt.x * 8f else 0f
            }.glow(p.tier.rich(), .5f, .14f, .12f, .2f, 42.dp).clip(RoundedCornerShape(w * .046f))) {
                PullFace(p, Modifier.fillMaxSize(), if (live) .5f + tilt.x * .4f else .5f, if (live) .5f + tilt.y * .4f else .4f)
            }
            Text(p.name, style = TextStyle(fontFamily = Site.Body.fontFamily, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Site.Text))
            RarityPill(p.rarity, if (p.foil) "Foil" else "")
        }
    }
}

/** Face-down pack cards wear Magic's own card back, as the site's /img/back/mtg.jpg does (Randall's copy, bundled so a flip never waits). */
@Composable
fun MagicBack(modifier: Modifier) = Box(modifier.background(Color(0xFF121014))) {
    AssetImage("play/mtg-back.webp", Modifier.fillMaxSize(), maxWidth = 400)
}
