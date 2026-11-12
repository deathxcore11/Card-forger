package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Loading brief L1, the opening screen (specs/loading-screens-brief.md, "L1 corrections"; approved by Randall 12 Nov 14:30Z):
 * the app's own dark felt with a soft gold light (never playmat or battleground art), the deck you last worked on fanning out one
 * card per finished step, one thin gold line, the step's words and one tip. It covers Play home, which loads underneath, and
 * lifts when Play home's own waits are over: at least [Opening.MIN_MS], at most [Opening.CAP_MS]. A step that does not apply
 * (signed out) never holds it. Shown once per launch.
 */
object Opening {
    const val MIN_MS = 600L
    const val CAP_MS = 4_000L
    const val FADE_MS = 250

    /** What Play home waits for, in the order the steps are shown. The words are the preview's. */
    enum class Step(val words: String) {
        ENGINE("Waking the rules engine"),
        ACCOUNT("Reading your collection"),
        BINDER("Hanging your deck covers"),
        PICTURE("Setting out your home screen"),
    }

    /** The one tip, from the approved preview. */
    const val TIP = "Your own decks are kept on this device, so they open at once, even on slow Wi-Fi."

    /** Shown once per launch (an activity rebuilt on a turn or a fold does not show it again). */
    @Volatile var shown = false

    /**
     * When the screen may lift: never before [minMs]; then once every step is done, or at [capMs] whatever is left.
     * [left] names the steps the cap cut short (logged), empty when everything was in.
     */
    class Gate(val minMs: Long = MIN_MS, val capMs: Long = CAP_MS) {
        val done = linkedSetOf<Step>()
        fun mark(s: Step) { done += s }
        val fraction: Float get() = done.size.toFloat() / Step.entries.size
        fun lifts(elapsedMs: Long): Boolean = elapsedMs >= minMs && (done.size == Step.entries.size || elapsedMs >= capMs)
        val left: List<Step> get() = Step.entries.filter { it !in done }
    }

    /**
     * The fan's cards: the Magic deck the site's Home calls last worked on (home-deck-activity.js lastWorkedDeck: the newest valid
     * homeDeckActivity.mtg row whose deck is still there), else the first deck with cards; its first [max] different names that are
     * not basic lands. Empty when there is no deck. Never a network call.
     */
    fun lastDeckNames(workspace: JsonObject?, max: Int = 5): List<String> {
        val decks = (workspace?.get("decks") as? com.google.gson.JsonArray)?.mapNotNull { it as? JsonObject }.orEmpty()
        fun id(d: JsonObject) = d.get("id")?.takeIf { it.isJsonPrimitive }?.asString
        val history = ((workspace?.get("homeDeckActivity") as? JsonObject)?.get("mtg") as? com.google.gson.JsonArray)
            ?.mapNotNull { it as? JsonObject }?.mapNotNull { r -> val i = r.get("id")?.takeIf { it.isJsonPrimitive }?.asString; val at = r.get("at")?.takeIf { it.isJsonPrimitive }?.asString
                if (i != null && at != null) i to at else null }?.sortedByDescending { it.second }.orEmpty()
        fun names(d: JsonObject) = (d.get("cards") as? com.google.gson.JsonArray)?.mapNotNull { (it as? JsonObject)?.get("name")?.takeIf { n -> n.isJsonPrimitive }?.asString }
            ?.filter { it.isNotBlank() && it !in BASICS }?.distinct().orEmpty()
        val deck = history.firstNotNullOfOrNull { (i, _) -> decks.firstOrNull { id(it) == i } } ?: decks.firstOrNull { names(it).isNotEmpty() }
        return deck?.let { names(it).take(max) }.orEmpty()
    }

    private val BASICS = setOf("Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes",
        "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp", "Snow-Covered Mountain", "Snow-Covered Forest")

    /** A card's picture only if it is already on this device (memory or disk cache): no download, ever. */
    suspend fun cachedFace(context: android.content.Context, name: String): ImageBitmap? = withContext(Dispatchers.IO) {
        val url = dev.cardstashy.nativeplay.art.CardArt.url(name) ?: return@withContext null
        val r = coil3.request.ImageRequest.Builder(context).data(url).size(240, 334)
            .networkCachePolicy(coil3.request.CachePolicy.DISABLED).build()
        val img = (runCatching { dev.cardstashy.nativeplay.art.CardArt.loader.execute(r) }.getOrNull() as? coil3.request.SuccessResult)?.image
        (img as? coil3.BitmapImage)?.bitmap?.asImageBitmap()
    }
}

/**
 * The opening screen over the app, until Play home's waits are over. Put it last in the app's root box, over App.
 * [signals] reads what is done now (overridden in tests).
 */
@Composable
fun OpeningHost(signals: () -> Set<Opening.Step> = ::openingSignals, now: () -> Long = android.os.SystemClock::uptimeMillis) {
    if (Opening.shown) return
    val context = LocalContext.current
    val gate = remember { Opening.Gate() }
    var progress by remember { mutableStateOf(0) }
    var lifting by remember { mutableStateOf(false) }
    var gone by remember { mutableStateOf(false) }
    var faces by remember { mutableStateOf<List<ImageBitmap?>>(List(5) { null }) }
    LaunchedEffect(Unit) {
        val start = now()
        while (true) {
            for (s in signals()) gate.mark(s)
            progress = gate.done.size
            if (gate.lifts(now() - start)) break
            delay(50)
        }
        val ms = now() - start
        android.util.Log.i("Opening", "opening screen ${ms} ms" + if (gate.left.isEmpty()) ", all steps in" else ", cap reached waiting for " + gate.left.joinToString { it.name.lowercase() })
        lifting = true
        delay(Opening.FADE_MS.toLong())
        Opening.shown = true
        gone = true
    }
    LaunchedEffect(Unit) {
        val names = withContext(Dispatchers.IO) {
            runCatching { dev.cardstashy.nativeplay.account.Decks.fullCopy(context)?.let { com.google.gson.JsonParser.parseString(it).asJsonObject } }.getOrNull()
        }.let { Opening.lastDeckNames(it) }
        if (names.isNotEmpty()) faces = names.map { Opening.cachedFace(context, it) } + List(5 - names.size) { null }
    }
    if (gone) return
    val alpha by animateFloatAsState(if (lifting) 0f else 1f, tween(if (Motion.still) 0 else Opening.FADE_MS), label = "opening")
    OpeningScreen(progress, faces, Modifier.graphicsLayer { this.alpha = alpha })
    BottomScreen { OpeningBottom(progress, Modifier.graphicsLayer { this.alpha = alpha }) }
}

/** What is done right now: the rules engine has started, the account is read, Play home's state has answered, its picture is in. */
internal fun openingSignals(): Set<Opening.Step> = buildSet {
    val signedIn = dev.cardstashy.nativeplay.account.Account.session.value != null
    if (dev.cardstashy.nativeplay.engine.ForgeService.status.value !is dev.cardstashy.nativeplay.engine.ForgeService.Status.Idle) add(Opening.Step.ENGINE)
    // Account.init ran before the first frame: the saved session (or none) is read.
    add(Opening.Step.ACCOUNT)
    // Signed out, Play home has no binder or picture to wait for.
    if (!signedIn || dev.cardstashy.nativeplay.play.Progress.state.value != null) add(Opening.Step.BINDER)
    if (!signedIn || HomeStart.picture.value) add(Opening.Step.PICTURE)
}

/**
 * The opening screen itself, drawn from [done] steps and up to five [faces] (null draws one of our card backs).
 * Phone upright: brand at the top, fan in the middle, step and line near the foot, tip under them. Wide: brand, step and line
 * at the left, the fan beside them. With a bottom screen up (AYN Thor) this top screen holds only the brand and the fan.
 */
@Composable
fun OpeningScreen(done: Int, faces: List<ImageBitmap?>, modifier: Modifier = Modifier) {
    val dual = DualScreen.active
    BoxWithConstraints(modifier.fillMaxSize().felt().pointerInput(Unit) { awaitEachGesture { while (true) { val e = awaitPointerEvent(); e.changes.forEach { it.consume() } } } }
        .semantics { contentDescription = "Opening CardStashy" }) {
        val wide = maxWidth > maxHeight || maxWidth >= 600.dp
        val w = maxWidth
        val step = Opening.Step.entries.getOrNull(done)?.words ?: "Ready"
        val fraction = done.toFloat() / Opening.Step.entries.size
        if (wide) {
            val margin = if (dual) 48.dp else 72.dp
            Column(Modifier.align(Alignment.CenterStart).padding(start = margin).widthIn(max = maxWidth * .46f)) {
                Brand()
                if (!dual) { Spacer(Modifier.height(14.dp)); StepWords(step); Spacer(Modifier.height(12.dp)); GoldLine(fraction, Modifier.width(w * .34f)) }
            }
            Fan(done, faces, cardW = (maxHeight * .30f).coerceIn(56.dp, 140.dp), modifier = Modifier.align(Alignment.CenterEnd).padding(end = maxWidth * .12f))
            if (!dual) Tip(Modifier.align(Alignment.BottomStart).padding(start = margin, bottom = 28.dp).widthIn(max = maxWidth * .5f))
        } else {
            Brand(Modifier.align(Alignment.TopCenter).padding(top = 110.dp))
            Fan(done, faces, cardW = (maxWidth * .26f).coerceIn(64.dp, 120.dp), modifier = Modifier.align(Alignment.Center))
            Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 32.dp).padding(bottom = 40.dp)) {
                StepWords(step); Spacer(Modifier.height(12.dp)); GoldLine(fraction, Modifier.fillMaxWidth()); Spacer(Modifier.height(80.dp)); Tip()
            }
        }
    }
}

/** The Thor's bottom screen while the opening screen is up: the four steps as a list, the gold line and the tip. */
@Composable
fun OpeningBottom(done: Int, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().felt().padding(horizontal = 32.dp, vertical = 24.dp), verticalArrangement = Arrangement.Center) {
        Opening.Step.entries.forEachIndexed { i, s ->
            val on = i < done; val now = i == done
            Row(Modifier.padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(RoundedCornerShape(99.dp)).background(if (on) Palette.Gold else Felt.Track))
                Spacer(Modifier.width(12.dp))
                Text(s.words, style = TextStyle(fontFamily = Type.Sans, fontWeight = if (now) FontWeight.SemiBold else FontWeight.Normal, fontSize = 14.sp,
                    color = if (on || now) Palette.Ink else Felt.Dim))
            }
        }
        Spacer(Modifier.height(16.dp))
        GoldLine(done.toFloat() / Opening.Step.entries.size, Modifier.fillMaxWidth())
        Spacer(Modifier.height(20.dp))
        Tip()
    }
}

/** .glow: our own dark felt (160° from #141924 to #0a0c11) under a soft gold light at 72% 48% and a faint cool light low at the left. */
private fun Modifier.felt(): Modifier = drawBehind {
    drawRect(Brush.linearGradient(0f to Felt.Top, .7f to Felt.Bottom, start = Offset.Zero, end = Offset(size.width * .34f, size.height)))
    val big = maxOf(size.width, size.height)
    drawRect(Brush.radialGradient(listOf(Felt.GoldGlow, Felt.GoldGlow.copy(alpha = 0f)), center = Offset(size.width * .72f, size.height * .48f), radius = big * .55f))
    drawRect(Brush.radialGradient(listOf(Felt.BlueGlow, Felt.BlueGlow.copy(alpha = 0f)), center = Offset(size.width * .15f, size.height * 1.1f), radius = big * .5f))
}

@Composable
private fun Brand(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        BrandMark(40.dp, static = true)
        Spacer(Modifier.width(12.dp))
        Text(buildAnnotatedString { append("Card"); withStyle(SpanStyle(color = Palette.Gold)) { append("Stashy") } },
            style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 28.sp, color = Palette.Ink, letterSpacing = .5.sp))
    }
}

@Composable
private fun StepWords(words: String) =
    Text(words, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Felt.Dim))

/** One thin gold line: the share of steps done, eased (no percent, no spinner). */
@Composable
private fun GoldLine(fraction: Float, modifier: Modifier) {
    val f by animateFloatAsState(fraction, tween(if (Motion.still) 0 else 500), label = "gold line")
    Canvas(modifier.height(3.dp).clip(RoundedCornerShape(99.dp))) {
        drawRect(Felt.Track)
        if (f > 0f) drawRect(Brush.horizontalGradient(listOf(Felt.GoldLow, Palette.Gold, Felt.GoldHigh), endX = size.width * f), size = size.copy(width = size.width * f))
    }
}

@Composable
private fun Tip(modifier: Modifier = Modifier) =
    Text(buildAnnotatedString {
        withStyle(SpanStyle(color = Palette.Gold, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp, fontSize = 11.sp)) { append("DID YOU KNOW  ") }
        append(Opening.TIP)
    }, modifier, style = TextStyle(fontFamily = Type.Sans, fontSize = 13.sp, color = Felt.Dim, lineHeight = 18.sp))

/**
 * Five cards fanning out from one point below them (transform origin 50% 150%), one per finished step at -24, -12, 0, 12 and
 * 24 degrees, the fifth when everything is in. A card with no picture on the device is one of our card backs.
 */
@Composable
private fun Fan(done: Int, faces: List<ImageBitmap?>, cardW: Dp, modifier: Modifier = Modifier) {
    val cardH = cardW * (418f / 300f)
    Box(modifier.size(cardW * 2.6f, cardH * 1.25f), contentAlignment = Alignment.BottomCenter) {
        for (i in 0 until 5) {
            val shown = i < done || (i == 4 && done >= Opening.Step.entries.size)
            val k by animateFloatAsState(if (shown) 1f else 0f, tween(if (Motion.still) 0 else 550), label = "fan $i")
            val shape = RoundedCornerShape(10.dp)
            Box(Modifier.size(cardW, cardH).graphicsLayer {
                alpha = k
                transformOrigin = TransformOrigin(.5f, 1.5f)
                rotationZ = (-24f + i * 12f) * k
                translationY = (1f - k) * 12.dp.toPx()
            }.shadow(12.dp, shape, ambientColor = Felt.Shadow, spotColor = Felt.Shadow).clip(shape)) {
                val face = faces.getOrNull(i)
                if (face != null) Image(face, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else CardBack()
            }
        }
    }
}

/** Our own drawn card back: a dark plate, a gold hairline inset and the brand mark in the middle. */
@Composable
private fun CardBack() {
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Felt.BackTop, Felt.BackBottom))).padding(5.dp)
        .border(1.dp, Palette.Hairline, RoundedCornerShape(6.dp)), contentAlignment = Alignment.Center) {
        BrandMark(28.dp, static = true)
    }
}
