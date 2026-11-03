package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
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
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
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
import dev.cardstashy.nativeplay.play.SetFacts
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sign
import kotlin.math.sin

/*
 * Opening a Play pack, as pack-preview.js does it with variant 'play': the server has already rolled the
 * pack (POST /api/progress/open); the sealed wrapper floats, a tap tears its top off, the cards fly out of
 * the opening into the hand, and the big card comes up face down. Tapping turns it: a pull lifts as it
 * flips, rares and up glow before they turn, mythics gather themselves first, and each lands with its
 * ring, embers and pop in the tier colours of tier.js. No prices anywhere (Play). "Open the next pack"
 * asks for the next banked pack of the same set.
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

/** The pack sounds (PACK-0xx), the same files as the site. */
object PackSfx {
    private var pool: SoundPool? = null
    private val ids = HashMap<String, Int>()
    var on = true
    fun init(context: Context) {
        if (pool != null) return
        val p = SoundPool.Builder().setMaxStreams(6).setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build()
        pool = p
        on = context.getSharedPreferences("play", Context.MODE_PRIVATE).getBoolean("packSound", true)
        runCatching { for (n in context.assets.list("sfx").orEmpty()) if (n.startsWith("PACK-") && n.endsWith(".ogg")) context.assets.openFd("sfx/$n").use { ids[n.removeSuffix(".ogg")] = p.load(it, 1) } }
    }
    fun toggle(context: Context) { on = !on; context.getSharedPreferences("play", Context.MODE_PRIVATE).edit().putBoolean("packSound", on).apply() }
    fun play(id: String, volume: Float = 1f, rate: Float = 1f) { if (!on) return; val p = pool ?: return; ids[id]?.let { p.play(it, volume, volume, 1, 0, rate) } }
}

/** PACK_SOUND by reveal level. */
private val REVEAL_SOUND = listOf("PACK-006", "PACK-014", "PACK-015", "PACK-016", "PACK-017", "PACK-018")
private val CHARGE_MS = intArrayOf(0, 0, 0, 420, 620, 860)

enum class PackStage { SEALED, TEARING, DEALING, DEALT }

private val ease = CubicBezierEasing(.2f, .9f, .25f, 1f)

/**
 * The pack opener, full screen over Play. [initial] and [revealedAtStart] exist for the screenshot tests.
 */
@Composable
fun PackOpening(first: PackResult, onNext: (suspend () -> PackResult?)?, onClose: () -> Unit,
                initial: PackStage = PackStage.SEALED, revealedAtStart: Set<Int> = emptySet(), focusAtStart: Int = 0) {
    val context = LocalContext.current
    LaunchedEffect(Unit) { PackSfx.init(context) }
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var pack by remember { mutableStateOf(first) }
    var stage by remember { mutableStateOf(initial) }
    val revealed = remember { mutableStateListOf<Int>().apply { addAll(revealedAtStart) } }
    var focus by remember { mutableIntStateOf(focusAtStart) }
    var charging by remember { mutableStateOf<Int?>(null) }
    var moment by remember { mutableIntStateOf(0) }        // bumps on each reveal, to replay the pop / ring / embers
    var momentLevel by remember { mutableIntStateOf(0) }
    var flipping by remember { mutableIntStateOf(0) }
    var status by remember { mutableStateOf(if (revealedAtStart.size == first.pulls.size && first.pulls.isNotEmpty()) first.done else "") }
    var busy by remember { mutableStateOf(false) }
    var sound by remember { mutableStateOf(PackSfx.on) }
    val n = pack.pulls.size
    val allOpen = n > 0 && revealed.size == n

    fun reveal(i: Int, silent: Boolean = false, charged: Boolean = false) {
        if (i !in pack.pulls.indices || charging != null || i in revealed) { if (i in pack.pulls.indices) focus = i; return }
        val p = pack.pulls[i]
        if (!silent && !charged && !Motion.still && focus == i && p.level >= 3) {
            // A big pull gathers itself before it turns: it trembles in its own colour while the light builds.
            charging = i
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            PackSfx.play("PACK-020", .45f + p.level * .08f)
            scope.launch { delay(CHARGE_MS[p.level].toLong()); if (charging == i) { charging = null; reveal(i, charged = true) } }
            return
        }
        revealed += i
        focus = i
        if (!silent) {
            haptic.performHapticFeedback(if (p.level >= 2) HapticFeedbackType.LongPress else HapticFeedbackType.TextHandleMove)
            PackSfx.play(REVEAL_SOUND[p.level]); momentLevel = p.level; moment++; flipping++
        }
        status = if (revealed.size == n) pack.done.ifBlank { "$n of $n revealed" } else "${revealed.size} of $n revealed"
    }

    fun tear() {
        if (stage != PackStage.SEALED) return
        haptic.performHapticFeedback(HapticFeedbackType.LongPress); PackSfx.play("PACK-004")
        stage = PackStage.TEARING
        scope.launch { delay(if (Motion.still) 0 else 440); stage = PackStage.DEALING }
    }

    fun next() {
        val ask = onNext ?: return
        if (busy) return
        busy = true
        scope.launch {
            val nx = runCatching { ask() }.getOrElse { status = it.message ?: "Could not open the next pack."; null }
            busy = false
            if (nx == null || nx.pulls.isEmpty()) { if (status.isBlank() || status.contains("revealed")) status = "No more packs to open."; return@launch }
            pack = nx; revealed.clear(); focus = 0; charging = null; status = ""; stage = PackStage.SEALED
        }
    }

    Box(Modifier.fillMaxSize().background(Color(0xE605060B)).clickable(remember { MutableInteractionSource() }, null) {}) {
        Column(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF1D1A15), Site.Bg), center = Offset(Float.POSITIVE_INFINITY / 2, 0f), radius = 1400f))
            .statusBarsPadding().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp)) {
            // Header: the set's symbol and name, the pack's line, sound and close.
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SetIcon(pack.set, Modifier.padding(top = 4.dp).size(30.dp), tint = Color(0xFFE9E3D6))
                Column(Modifier.weight(1f)) {
                    Text(pack.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 24.sp, color = Site.Text))
                    Text(pack.note, style = TextStyle(fontFamily = Site.Body.fontFamily, fontSize = 11.sp, lineHeight = 15.sp, color = Site.Muted.copy(alpha = .8f)))
                }
                RoundTool(if (sound) "Mute pack sounds" else "Turn pack sounds on", { PackSfx.toggle(context); sound = PackSfx.on; if (sound) PackSfx.play("PACK-014", .5f) }) { SoundGlyph(sound) }
                RoundTool("Close", onClose) { CloseGlyph() }
            }
            Box(Modifier.weight(1f).fillMaxWidth()) {
                if (stage == PackStage.SEALED || stage == PackStage.TEARING) Sealed(pack, stage == PackStage.TEARING, ::tear)
                else Content(pack, stage, revealed, focus, charging, moment, momentLevel, flipping, allOpen,
                    onLanded = { stage = PackStage.DEALT },
                    onFocus = { i -> if (i != focus) { focus = i; haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) } },
                    onReveal = { reveal(it) },
                    onRevealAll = {
                        var best = -1; var at = -1
                        pack.pulls.forEachIndexed { j, p -> if (j !in revealed) { if (p.level > best) { best = p.level; at = j }; reveal(j, silent = true) } }
                        if (at >= 0) { focus = at; PackSfx.play(REVEAL_SOUND[best]); momentLevel = best; moment++ }
                    },
                    onNext = if (onNext != null) ::next else null, busy = busy)
            }
            Text(status, Modifier.fillMaxWidth().heightIn(min = 16.dp).padding(top = 2.dp), style = TextStyle(fontFamily = Site.Body.fontFamily, fontSize = 11.5.sp, lineHeight = 17.sp, color = Site.Gold, textAlign = TextAlign.Center))
        }
    }
}

@Composable
private fun RoundTool(label: String, onClick: () -> Unit, glyph: @Composable () -> Unit) =
    Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0x14FFFFFF)).border(1.dp, Color(0x1FFFFFFF), CircleShape)
        .clickable(onClick = onClick).semantics { contentDescription = label }, contentAlignment = Alignment.Center) { glyph() }

@Composable private fun CloseGlyph() = Canvas(Modifier.size(16.dp)) {
    val s = Stroke(1.8.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
    drawLine(Site.Text, Offset(0f, 0f), Offset(size.width, size.height), s.width, s.cap); drawLine(Site.Text, Offset(size.width, 0f), Offset(0f, size.height), s.width, s.cap)
}

@Composable private fun SoundGlyph(on: Boolean) = Canvas(Modifier.size(18.dp)) {
    val u = size.width / 24f
    val body = Path().apply { moveTo(4 * u, 9 * u); lineTo(8 * u, 9 * u); lineTo(13 * u, 5 * u); lineTo(13 * u, 19 * u); lineTo(8 * u, 15 * u); lineTo(4 * u, 15 * u); close() }
    drawPath(body, Site.Text)
    val st = Stroke(1.7f * u, cap = androidx.compose.ui.graphics.StrokeCap.Round)
    if (on) { drawArc(Site.Text, -45f, 90f, false, Offset(10 * u, 8 * u), androidx.compose.ui.geometry.Size(8 * u, 8 * u), style = st); drawArc(Site.Text, -50f, 100f, false, Offset(9 * u, 4.5f * u), androidx.compose.ui.geometry.Size(13 * u, 15 * u), style = st) }
    else { drawLine(Site.Text, Offset(16 * u, 9 * u), Offset(22 * u, 15 * u), st.width, st.cap); drawLine(Site.Text, Offset(22 * u, 9 * u), Offset(16 * u, 15 * u), st.width, st.cap) }
}

// ---------------------------------------------------------------- sealed

@Composable
private fun Sealed(pack: PackResult, tearing: Boolean, onTear: () -> Unit) = BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    // .pack-wrapper: min(56vw, 250px) wide at 400:734, never taller than the room left.
    val h = minOf(maxWidth * .56f * (734f / 400f), 250.dp * (734f / 400f), maxHeight - 40.dp)
    val w = h * (400f / 734f)
    val float = if (Motion.still) 0f else rememberInfiniteTransition(label = "float").animateFloat(0f, 1f, infiniteRepeatable(tween(2250, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "f").value
    val rip = remember { Animatable(0f) }
    LaunchedEffect(tearing) { if (tearing && !Motion.still) rip.animateTo(1f, tween(620, easing = CubicBezierEasing(.4f, 0f, .2f, 1f))) }
    val r = rip.value
    Box(Modifier.width(w).height(h).graphicsLayer {
        // pack-float: up 8 px, a little turn; pack-rip: up and bigger at 30 %, then down 55 % and away.
        cameraDistance = 12f * density
        val up = if (r < .3f) r / .3f else 1f - (r - .3f) / .7f
        translationY = -8.dp.toPx() * float + (-6.dp.toPx() * up) + (if (r > .3f) size.height * .55f * ((r - .3f) / .7f) else 0f)
        rotationY = -6f * float; rotationX = 3f * float; rotationZ = -2f * up
        val k = if (r < .3f) 1f + .03f * up else 1.03f - .18f * ((r - .3f) / .7f)
        scaleX = k; scaleY = k; alpha = if (r > .3f) 1f - (r - .3f) / .7f else 1f
        shadowElevation = 26.dp.toPx(); shape = RoundedCornerShape(6.dp); clip = false
    }.clickable(remember { MutableInteractionSource() }, null, onClick = onTear).semantics { contentDescription = "Open the ${pack.name} pack" }) {
        Booster(pack.set, pack.name, Modifier.fillMaxSize())
        // pack-sheen: a soft rainbow band sweeping across every 3.2 s.
        if (!Motion.still) {
            val sweep = rememberInfiniteTransition(label = "sheen").animateFloat(1.2f, -.2f, infiniteRepeatable(tween(3200, easing = FastOutSlowInEasing)), label = "s").value
            Box(Modifier.fillMaxSize().drawWithContent {
                val cx = size.width * sweep; val half = size.width * .5f
                drawRect(Brush.linearGradient(listOf(Color.Transparent, Color(0x40FFFFFF), Color(0x339FE3FF), Color(0x33FFD0F2), Color.Transparent), Offset(cx - half, 0f), Offset(cx + half, size.height * .2f)), blendMode = BlendMode.Screen)
            })
        }
    }
}

// ---------------------------------------------------------------- dealt

@Composable
private fun Content(pack: PackResult, stage: PackStage, revealed: List<Int>, focus: Int, charging: Int?, moment: Int, momentLevel: Int, flipping: Int, allOpen: Boolean,
                    onLanded: () -> Unit, onFocus: (Int) -> Unit, onReveal: (Int) -> Unit, onRevealAll: () -> Unit, onNext: (() -> Unit)?, busy: Boolean) = BoxWithConstraints(Modifier.fillMaxSize()) {
    val n = pack.pulls.size
    val handW = minOf(maxWidth * .19f, 112.dp, maxHeight * .14f)
    val handH = handW * (88f / 63f) * 1.22f + 16.dp
    // The deal: each card leaves the pack in turn (gap ms apart, 640 ms flight); a tap anywhere lands them all.
    val gap = min(85, 1100 / max(1, n)); val fly = 640
    val deal = remember(pack) { Animatable(if (stage == PackStage.DEALT || Motion.still) 1f else 0f) }
    val total = (n - 1) * gap + fly
    LaunchedEffect(pack, stage) {
        if (stage == PackStage.DEALING) {
            launch { for (i in 0 until n) { delay(if (i == 0) (fly - 40).toLong() else gap.toLong()); PackSfx.play("PACK-005", .55f, 1f + i * .02f) } }
            deal.animateTo(1f, tween(total, easing = LinearEasing)); onLanded()
        }
    }
    val scope = rememberCoroutineScope()
    val t = deal.value * total
    fun cardT(i: Int) = ((t - i * gap) / fly).coerceIn(0f, 1f)
    Column(Modifier.fillMaxSize().pointerInput(stage) { if (stage == PackStage.DEALING) awaitPointerEventScopeSkip { scope.launch { deal.snapTo(1f); onLanded() } } }) {
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            Focus(pack, focus, focus in revealed, charging == focus, moment, momentLevel, flipping, rising = stage == PackStage.DEALT,
                onTap = { onReveal(focus) },
                onSwipe = { step -> val nx = focus + step; if (nx in 0 until n) onFocus(nx) })
        }
        // The hand: cards overlap left to right so each name corner shows; the one in focus rises.
        Hand(pack, revealed, focus, handW, handH, cardT = ::cardT, onFocus = onFocus, onTap = { onFocus(it); onReveal(it) })
        // Actions: Reveal all until every card is up, then Open the next pack.
        Box(Modifier.fillMaxWidth().padding(top = 2.dp), contentAlignment = Alignment.Center) {
            if (!allOpen) PillButton("Reveal all", ghost = true, onClick = onRevealAll)
            else if (onNext != null) PillButton(if (busy) "Opening…" else "Open the next pack", ghost = false, wide = true, onClick = onNext)
        }
    }
}

/** A tap on the deal skips it, as in Arena. */
private suspend fun androidx.compose.ui.input.pointer.PointerInputScope.awaitPointerEventScopeSkip(onDown: () -> Unit) = awaitPointerEventScope {
    while (true) { val e = awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial); if (e.changes.any { it.pressed }) { onDown(); break } }
}

@Composable
private fun PillButton(label: String, ghost: Boolean, wide: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Box((if (wide) Modifier.widthIn(max = 420.dp).fillMaxWidth() else Modifier).heightIn(min = 44.dp).clip(shape)
        .then(if (ghost) Modifier.background(Color(0x0FFFFFFF)).border(1.dp, Color(0x2EFFFFFF), shape) else Modifier.background(Brush.verticalGradient(listOf(Color(0xFFF2D488), Color(0xFFD6AD64)))))
        .clickable(onClick = onClick).padding(horizontal = 26.dp), contentAlignment = Alignment.Center) {
        Text(label, style = TextStyle(fontFamily = Site.Body.fontFamily, fontWeight = FontWeight.Bold, fontSize = 14.sp, letterSpacing = .01.em, color = if (ghost) Site.Text else Color(0xFF1B1507)))
    }
}

/** The big card: face down until tapped, then the pull in its tier frame and glow. */
@Composable
private fun Focus(pack: PackResult, focus: Int, open: Boolean, charging: Boolean, moment: Int, momentLevel: Int, flipping: Int, rising: Boolean,
                  onTap: () -> Unit, onSwipe: (Int) -> Unit) = BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    val p = pack.pulls.getOrNull(focus) ?: return@BoxWithConstraints
    val meta = 52.dp
    val cardW = minOf(400.dp, maxWidth - 32.dp, (maxHeight - meta - 18.dp) * (63f / 88f))
    val cardH = cardW * (88f / 63f)
    // The flip: 0 = back up, 180 = face up; the card lifts and leans as it turns (flipLift).
    val flip by animateFloatAsState(if (open) 180f else 0f, if (Motion.still) tween(0) else tween(700, easing = ease), label = "flip")
    val lift = remember { Animatable(0f) }
    val pop = remember { Animatable(1f) }
    val ring = remember { Animatable(1f) }
    val embers = remember { Animatable(1f) }
    LaunchedEffect(flipping) { if (flipping > 0 && !Motion.still) { lift.snapTo(0f); lift.animateTo(1f, tween(560 + momentLevel * 70, easing = LinearEasing)) } }
    LaunchedEffect(moment) {
        if (moment == 0 || Motion.still) return@LaunchedEffect
        delay(330)
        launch { pop.snapTo(1f); val peak = when (momentLevel) { 2 -> 1.09f; 3 -> 1.12f; 4, 5 -> 1.17f; else -> 1.07f }
            pop.animateTo(peak, tween(150)); pop.animateTo(1f, spring(dampingRatio = .55f, stiffness = 500f)) }
        if (momentLevel >= 1) launch { ring.snapTo(0f); ring.animateTo(1f, tween(620 + momentLevel * 110, easing = CubicBezierEasing(.2f, .7f, .3f, 1f))) }
        if (momentLevel >= 2) launch { embers.snapTo(0f); embers.animateTo(1f, tween(1100 + momentLevel * 90, easing = CubicBezierEasing(.15f, .75f, .3f, 1f))) }
    }
    val tease = !open && p.level >= 2
    val glow = if (Motion.still) .75f else rememberInfiniteTransition(label = "tease").animateFloat(.45f, .9f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "t").value
    val tremble = if (charging && !Motion.still) rememberInfiniteTransition(label = "charge").animateFloat(-1f, 1f, infiniteRepeatable(tween(45, easing = LinearEasing), RepeatMode.Reverse), label = "c").value else 0f
    var drag by remember { mutableStateOf(0f) }
    val dragAnim by animateFloatAsState(drag, if (drag == 0f) spring(stiffness = 600f, dampingRatio = .8f) else tween(0), label = "drag")
    val tilt by rememberTilt()
    val lightX = if (Motion.still) .5f else rememberInfiniteTransition(label = "light").animateFloat(0f, (2 * PI).toFloat(), infiniteRepeatable(tween(9400, easing = LinearEasing)), label = "l").value
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.width(cardW).height(cardH), contentAlignment = Alignment.Center) {
            val tier = p.tier
            // Backlight: the tier's colour behind the card once up; gold while a hit waits; the charge colour while it gathers.
            val back = when { charging -> TIER_COLORS[min(5, p.level)]; tease -> Color(0xFFF0C75E); open -> tier; else -> null }
            if (back != null) Box(Modifier.width(cardW * 1.06f).height(cardH * 1.06f).graphicsLayer { alpha = if (open) .5f else if (charging) 1f else glow }
                .blur(30.dp).background(back, RoundedCornerShape(8)))
            // Ring: a frame of the tier colour that grows and fades from the card.
            if (ring.value < 1f && momentLevel >= 1) Box(Modifier.width(cardW).height(cardH).graphicsLayer { val k = 1f + (.35f + momentLevel * .12f) * ring.value; scaleX = .92f + (k - .92f); scaleY = scaleX; alpha = .95f * (1f - ring.value) }
                .border(3.dp, TIER_COLORS[momentLevel], RoundedCornerShape(6)))
            Box(Modifier.width(cardW).height(cardH)
                .pointerInput(focus) {
                    detectHorizontalDragGestures(onDragEnd = { val d = drag; drag = 0f; if (abs(d) > 40.dp.toPx()) onSwipe(if (d < 0) 1 else -1) }, onDragCancel = { drag = 0f }) { _, dx -> drag += dx }
                }
                .clickable(remember { MutableInteractionSource() }, null, onClick = onTap)
                .semantics { contentDescription = if (open) p.name else "Card ${focus + 1}, face down. Reveal" }
                .graphicsLayer {
                    cameraDistance = 14f * density
                    val l = lift.value; val arc = if (l < .42f) l / .42f else 1f - (l - .42f) / .58f
                    val big = if (open) intArrayOf(3, 5, 7, 10, 13, 17)[min(5, momentLevel)] else 2
                    translationX = dragAnim * .6f + tremble * (1.2f + p.level * .9f).dp.toPx()
                    translationY = -size.height * big / 100f * arc
                    rotationZ = (-1.5f - big * .12f) * arc
                    rotationX = if (open && tilt.live) -tilt.y * 8f else 0f
                    rotationY = if (open && tilt.live) tilt.x * 10f else 0f
                    scaleX = pop.value; scaleY = pop.value
                    shadowElevation = 30.dp.toPx(); shape = RoundedCornerShape(4.6f.dp); clip = false
                }) {
                // Back and face turn about the card's middle; each hides once past edge-on.
                Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 14f * density; rotationY = flip; alpha = if (flip < 90f) 1f else 0f }.clip(RoundedCornerShape(4.6f.dp))) {
                    MagicBack(Modifier.fillMaxSize())
                    if (tease || charging) Box(Modifier.fillMaxSize().border(3.dp, (if (charging) TIER_COLORS[min(5, p.level)] else Color(0xFFF0C75E)).copy(alpha = .6f), RoundedCornerShape(4.6f.dp)))
                }
                Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 14f * density; rotationY = flip - 180f; alpha = if (flip >= 90f) 1f else 0f }) {
                    // The collection's tier frame, then the card.
                    Box(Modifier.fillMaxSize().border(2.dp, tier.copy(alpha = .9f), RoundedCornerShape(5.dp)).padding(3.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFF0B0C10))) {
                        PullFace(p, Modifier.fillMaxSize(), if (tilt.live) tilt.x * .5f + .5f else .5f + .44f * sin(lightX), if (tilt.live) tilt.y * .5f + .5f else .42f + .3f * sin(lightX * .7f))
                    }
                }
            }
            if (embers.value < 1f && momentLevel >= 2) Embers(cardW, cardH, momentLevel, embers.value, moment)
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
    val rnd = remember(seed) { java.util.Random(seed * 31L + level).let { r -> List(count) { floatArrayOf(r.nextFloat(), r.nextFloat(), r.nextFloat(), r.nextFloat()) } } }
    Canvas(Modifier.width(cardW).height(cardH)) {
        val cx = size.width / 2; val cy = size.height / 2
        for (e in rnd) {
            val a = e[0] * 2 * PI.toFloat(); val d = size.width * (.55f + e[1] * .6f + level * .08f)
            val k = ((t - e[3] * .1f) / .9f).coerceIn(0f, 1f)
            val x = cx + cos(a) * d * k; val y = cy + (sin(a) * d + size.height * .12f) * k
            val alpha = if (k < .12f) k / .12f else 1f - (k - .12f) / .88f
            val r = (3f + e[2] * (2 + level)).dp.toPx() / 2f
            drawCircle(color.copy(alpha = alpha * .5f), r * 2.4f, Offset(x, y))
            drawCircle(color.copy(alpha = alpha), r, Offset(x, y))
        }
    }
}

/** The hand row: every card overlapping the one before it; slide a finger along to scrub, tap to turn. */
@Composable
private fun Hand(pack: PackResult, revealed: List<Int>, focus: Int, handW: Dp, handH: Dp, cardT: (Int) -> Float, onFocus: (Int) -> Unit, onTap: (Int) -> Unit) =
    BoxWithConstraints(Modifier.fillMaxWidth().height(handH).padding(horizontal = 6.dp, vertical = 4.dp)) {
        val n = pack.pulls.size
        val fullW = maxWidth; val fullH = maxHeight
        val span = fullW - handW
        val cardH = handW * (88f / 63f)
        val density = androidx.compose.ui.platform.LocalDensity.current
        fun under(x: Float): Int = with(density) { ((x - handW.toPx() / 2) / max(1f, span.toPx()) * (n - 1)).roundToInt().coerceIn(0, n - 1) }
        Box(Modifier.fillMaxSize().pointerInput(n) { detectHorizontalDragGestures { ch, _ -> onFocus(under(ch.position.x)) } }) {
            pack.pulls.forEachIndexed { i, p ->
                val d = i - focus
                val edge = (d < 0 && i == 0) || (d > 0 && i == n - 1)
                val push = if (d != 0 && !edge) sign(d.toFloat()) * max(0f, 1f - (abs(d) - 1) * .45f) else 0f
                val focused = i == focus
                val raise by animateFloatAsState(if (focused) 1f else 0f, if (Motion.still) tween(0) else tween(260, easing = ease), label = "raise")
                val shove by animateFloatAsState(push, if (Motion.still) tween(0) else tween(260, easing = ease), label = "push")
                val open = i in revealed
                val turn by animateFloatAsState(if (open) 180f else 0f, if (Motion.still) tween(0) else tween(550, easing = ease), label = "turn")
                val ft = cardT(i)
                val x = if (n <= 1) (fullW - handW) / 2 else span * (i.toFloat() / (n - 1))
                Box(Modifier.zIndex(if (focused) 60f else 10f + i).offset(x = x, y = fullH - cardH).width(handW).height(cardH)
                    .graphicsLayer {
                        transformOrigin = TransformOrigin(.5f, 1f)
                        // Out of the pack: from above the hand, arcing down into place (the deal).
                        val fly = 1f - ft
                        translationX = handW.toPx() * .18f * shove + fly * ((n - 1) / 2f - i) * handW.toPx() * .3f
                        translationY = -cardH.toPx() * (.14f * raise) - fly * cardH.toPx() * 2.2f
                        rotationZ = fly * (i - (n - 1) / 2f) * 3f
                        val s = 1f + .08f * raise
                        scaleX = s; scaleY = s; alpha = if (ft <= 0f) 0f else 1f
                        shadowElevation = 8.dp.toPx(); shape = RoundedCornerShape(6.dp); clip = false
                    }
                    .clickable(remember { MutableInteractionSource() }, null) { onTap(i) }
                    .semantics { contentDescription = if (open) "${p.name} · revealed" else "Card ${i + 1}, face down" }) {
                    Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 10f * density.density; rotationY = turn; alpha = if (turn < 90f) 1f else 0f }.clip(RoundedCornerShape(6.dp))) { MagicBack(Modifier.fillMaxSize()) }
                    Box(Modifier.fillMaxSize().graphicsLayer { cameraDistance = 10f * density.density; rotationY = turn - 180f; alpha = if (turn >= 90f) 1f else 0f }
                        .border(1.5.dp, p.tier.copy(alpha = .85f), RoundedCornerShape(6.dp)).clip(RoundedCornerShape(6.dp)).background(Color(0xFF0B0C10))) {
                        PullFace(p, Modifier.fillMaxSize())
                    }
                }
            }
        }
    }

/** Face-down pack cards wear Magic's own card back, as the site's /img/back/mtg.jpg does (Randall's copy, bundled so a flip never waits). */
@Composable
fun MagicBack(modifier: Modifier) = Box(modifier.background(Color(0xFF121014))) {
    AssetImage("play/mtg-back.webp", Modifier.fillMaxSize(), maxWidth = 400)
}
