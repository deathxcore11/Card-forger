package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

/**
 * Live achievement toasts, the site's play-achievement-toasts.js (web 4.3.92): the steps that just became done drop in
 * as a glass pill under the status bar, one at a time, 4.2 s each; tap opens the deed, swipe up dismisses. The server
 * stays the only judge: native diffs the done steps (id:step) of two GET /api/progress/achievements answers, the same
 * rows achievementRows() builds, refetched whenever a Play answer moves the counters. A full refresh or a new account
 * only resets the baseline, so old deeds never replay.
 */
object AchievementToasts {
    data class Toast(val id: String, val step: Int, val tab: String, val title: String, val art: String?, val trim: Boolean, val tier: String,
                     val line: String, val reward: JsonObject, var queued: Boolean = false)

    private var baseline: Set<String>? = null
    val queue = MutableStateFlow<List<Toast>>(emptyList())

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString
    private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
    private fun rows(p: JsonObject) = p.getAsJsonArray("achievements")?.mapNotNull { it as? JsonObject } ?: emptyList()
    private fun steps(r: JsonObject) = r.getAsJsonArray("steps")?.mapNotNull { it as? JsonObject } ?: emptyList()
    private val n = java.text.NumberFormat.getNumberInstance(java.util.Locale.US).apply { maximumFractionDigits = 3 }

    /** doneSteps(state): every step that is done, as "id:step" (Practice honour steps too). */
    fun doneSteps(p: JsonObject): Set<String> = rows(p).flatMap { r -> steps(r).mapIndexedNotNull { i, s -> if (s.b("done")) "${r.s("id")}:$i" else null } }.toSet()

    /** newlyEarned(before, after): the steps done now that were not before, as toast rows. */
    fun newlyEarned(before: Set<String>, p: JsonObject): List<Toast> = rows(p).flatMap { r ->
        val st = steps(r); val hidden = r.b("hidden"); val kind = r.s("kind"); val honour = kind == "honour"
        st.mapIndexedNotNull { i, s ->
            if (!s.b("done") || "${r.s("id")}:$i" in before) return@mapIndexedNotNull null
            val tier = if (hidden) "hidden" else if (honour) "honour" else if (kind == "feat") "feat" else s.s("tier") ?: "bronze"
            val need = s.get("need")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0
            val line = if (hidden) r.s("riddle") ?: "" else if (st.size > 1) "Tier ${i + 1} of ${st.size} · ${if (r.s("unit") == "h") n.format(need / 60) + " h" else n.format(need)}" else r.s("lore") ?: ""
            val art = r.getAsJsonObject("art")
            Toast(r.s("id") ?: "", i, r.s("tab") ?: "journey", r.s("title") ?: "", art?.s("url"), art?.b("trim") == true, tier, line,
                if (honour) JsonObject() else s.getAsJsonObject("reward") ?: JsonObject())
        }
    }

    /** A fresh achievements answer: the first (or one after a reset) only sets the baseline. */
    fun seen(p: JsonObject?) {
        p ?: return
        val now = doneSteps(p); val before = baseline
        // A union, so an older answer landing late can never make a deed toast twice.
        baseline = now + before.orEmpty()
        if (before != null) newlyEarned(before, p).takeIf { it.isNotEmpty() }?.let { push(it) }
    }
    val hasBaseline get() = baseline != null
    /** Set by the app: is a match open (the pill sits 12 dp under the status bar), and how a tap opens a deed's tab. */
    var overTable by androidx.compose.runtime.mutableStateOf(false)
    var open: (String) -> Unit = {}
    fun reset() { baseline = null; queue.value = emptyList() }
    fun push(list: List<Toast>) { queue.value = queue.value + list }
    fun pop() { queue.value = queue.value.drop(1).also { rest -> rest.forEach { it.queued = true } } }

    private val SEAL = mapOf("c" to "common", "u" to "uncommon", "r" to "rare", "m" to "mythic")
    /** rewardLines(): up to two short reward lines for the right side of the pill. */
    fun rewardLines(r: JsonObject): List<String> {
        fun i(k: String) = r.get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt ?: 0
        val lines = mutableListOf<String>()
        if (i("xp") > 0) lines += "+${n.format(i("xp"))} XP"
        if (i("coins") > 0) lines += "${n.format(i("coins"))} coins"
        r.getAsJsonObject("seals")?.entrySet()?.forEach { (k, v) -> val c = v.asInt; if (c > 0) lines += "$c ${SEAL[k] ?: k} seal${if (c == 1) "" else "s"}" }
        if (r.get("collector")?.let { it.isJsonPrimitive && (it.asJsonPrimitive.isBoolean && it.asBoolean || it.asJsonPrimitive.isNumber && it.asInt > 0) } == true) lines += "Collector pack"
        if (i("packs") > 0) lines += "${i("packs")} pack${if (i("packs") == 1) "" else "s"}"
        return lines.take(2)
    }

    val EYEBROW = mapOf("bronze" to "Achievement · Bronze", "silver" to "Achievement · Silver", "gold" to "Achievement · Gold", "mythic" to "Achievement · Mythic",
        "feat" to "Feat", "hidden" to "Hidden feat", "honour" to "Earned with honour")
    /** TOAST_FEEL: feel.js haptic kinds and the claim sounds. */
    val FEEL = mapOf("bronze" to ("reward-claim" to "RWD-001"), "silver" to ("reward-claim" to "RWD-001"), "gold" to ("reward-big" to "RWD-006"),
        "mythic" to ("pack-tier-4" to "RWD-006"), "feat" to ("reward-big" to "RWD-006"), "hidden" to ("pack-tier-5" to "RWD-006"), "honour" to ("reward-claim" to "RWD-001"))
    /** .ach-toast--tier: the tier colour of the ring, glow, eyebrow and reward. */
    fun tierColor(t: String) = when (t) { "silver" -> Color(0xFFE3E9F0); "gold", "feat" -> Color(0xFFF3DFB4); "mythic", "hidden" -> Color(0xFFFF9A6A); "honour" -> Color(0xFFA9B3C0); else -> Color(0xFFE0A46C) }
    const val IN_MS = 420; const val HOLD_MS = 4200L; const val OUT_MS = 320

    private var pool: SoundPool? = null
    private val ids = HashMap<String, Int>()
    fun sound(context: Context, id: String) {
        if (!AppSettings.sound) return
        val p = pool ?: SoundPool.Builder().setMaxStreams(2).setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build().also { pool = it }
        val loaded = ids[id]
        if (loaded != null) { p.play(loaded, 1f, 1f, 1, 0, 1f); return }
        runCatching { context.assets.openFd("sfx/$id.ogg").use { fd -> val sid = p.load(fd, 1); ids[id] = sid
            p.setOnLoadCompleteListener { sp, s, ok -> if (ok == 0 && s == sid) sp.play(s, 1f, 1f, 1, 0, 1f) } } }
    }
}

private fun ts(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Color(0xFFECEAE4), line: Float = size * 1.4f) =
    androidx.compose.ui.text.TextStyle(fontFamily = Site.Manrope, fontSize = size.sp, fontWeight = weight, color = color, lineHeight = line.sp)

/** The pill host, above every screen. [backdrop]: the app as drawn, for the pill's backdrop-filter: blur(14px). */
@Composable
fun AchievementToastHost(backdrop: androidx.compose.ui.graphics.layer.GraphicsLayer?) {
    val list by AchievementToasts.queue.collectAsState()
    val t = list.firstOrNull() ?: return
    val more = if (!t.queued) list.size - 1 else 0
    androidx.compose.runtime.key(t.id + ":" + t.step) { Pill(t, more, AchievementToasts.overTable, backdrop) { AchievementToasts.open(it) } }
}

@Composable
private fun Pill(t: AchievementToasts.Toast, more: Int, overTable: Boolean, backdrop: androidx.compose.ui.graphics.layer.GraphicsLayer?, onOpen: (String) -> Unit) {
    val blurLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val at = remember { androidx.compose.runtime.mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    val context = LocalContext.current; val view = LocalView.current
    val still = Motion.still
    val y = remember { Animatable(if (still) 0f else -1.4f) }; val a = remember { Animatable(if (still) 1f else 0f) }
    val pop = remember { Animatable(if (still) 1f else .4f) }; val glow = remember { Animatable(0f) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var closing = remember { booleanArrayOf(false) }
    fun close(open: Boolean) {
        if (closing[0]) return; closing[0] = true
        scope.launch {
            if (!still) { launch { y.animateTo(-1.4f, tween(AchievementToasts.OUT_MS, easing = CubicBezierEasing(.42f, 0f, 1f, 1f))) }; a.animateTo(0f, tween(AchievementToasts.OUT_MS, easing = CubicBezierEasing(.42f, 0f, 1f, 1f))) }
            AchievementToasts.pop()
        }
        if (open) onOpen(t.tab)
    }
    LaunchedEffect(Unit) {
        val (haptic, sound) = AchievementToasts.FEEL[t.tier] ?: AchievementToasts.FEEL.getValue("bronze")
        Feel.perform(view, if (!t.queued) haptic else "tick")
        if (!t.queued) AchievementToasts.sound(context, sound)
        val ease = CubicBezierEasing(.2f, .8f, .25f, 1.1f)
        launch { y.animateTo(0f, tween(AchievementToasts.IN_MS, easing = ease)) }
        launch { a.animateTo(1f, tween(if (still) 200 else AchievementToasts.IN_MS, easing = ease)) }
        if (!still) {
            // achPop .5s after .18s, then achGlow 1.4s after .5s.
            launch { delay(180); pop.animateTo(1f, tween(500, easing = CubicBezierEasing(.3f, 1.6f, .5f, 1f))) }
            launch { delay(500); glow.animateTo(1f, tween(560)); glow.animateTo(2f, tween(840)) }
        }
        delay(AchievementToasts.IN_MS + AchievementToasts.HOLD_MS)
        close(false)
    }
    val tc = AchievementToasts.tierColor(t.tier)
    val lines = AchievementToasts.rewardLines(t.reward)
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars), contentAlignment = Alignment.TopCenter) {
        Box(Modifier.padding(top = if (overTable) 12.dp else 74.dp).padding(horizontal = 16.dp).widthIn(max = 358.dp).fillMaxWidth()
            .graphicsLayer { translationY = y.value * size.height; alpha = a.value }
            .pointerInput(Unit) { var dy = 0f; detectVerticalDragGestures(onDragStart = { dy = 0f }) { _, d -> dy += d; if (dy < -24.dp.toPx()) close(false) } }) {
            val shape = RoundedCornerShape(34.dp)
            Row(Modifier.fillMaxWidth().heightIn(min = 68.dp)
                .drawBehind {
                    // box-shadow: 0 12px 32px #000a (a 32 px blur is a 16 px Gaussian radius).
                    drawIntoCanvas { c ->
                        val paint = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true; color = 0xAA000000.toInt()
                            maskFilter = android.graphics.BlurMaskFilter(16.dp.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                        val r = 34.dp.toPx(); c.nativeCanvas.drawRoundRect(0f, 12.dp.toPx(), size.width, size.height + 12.dp.toPx(), r, r, paint)
                    }
                }
                .onGloballyPositioned { at.value = it.positionInRoot() }
                .clip(shape).drawBehind {
                    if (backdrop != null && backdrop.size.width > 0) {
                        blurLayer.renderEffect = androidx.compose.ui.graphics.BlurEffect(14.dp.toPx(), 14.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                        blurLayer.record(backdrop.size) { drawLayer(backdrop) }
                        translate(-at.value.x, -at.value.y) { drawLayer(blurLayer) }
                    }
                }.background(Color(0xD6101218)).border(1.dp, Color(0x17FFFFFF), shape)
                .clickable { close(true) }.padding(start = 10.dp, end = 18.dp, top = 8.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // .ach-toast-art: 48 px round art, a 2 px ring and an 18 px glow in the tier colour (achGlow swells it to 30 px once).
                val g = glow.value; val spread = if (g <= 1f) g * 8f else 8f * (2f - g); val blur = if (g <= 1f) g * 30f else 30f - (g - 1f) * 12f
                Box(Modifier.size(48.dp).scale(pop.value).drawBehind {
                    val r = size.minDimension / 2
                    val glowR = if (g == 0f) 18.dp.toPx() else blur.dp.toPx()
                    drawCircle(androidx.compose.ui.graphics.Brush.radialGradient(listOf(tc.copy(alpha = .55f), Color.Transparent), radius = r + spread.dp.toPx() + glowR), radius = r + spread.dp.toPx() + glowR)
                    drawCircle(tc, radius = r + 2.dp.toPx())
                }.clip(CircleShape).background(Color.Black)) {
                    // trim: background auto 125 % (the art scaled to 125 % of the ring's height, centred).
                    val p = t.art?.let { heroPainter(homeArt(it)) }
                    if (p != null) androidx.compose.foundation.Image(p, null, Modifier.fillMaxSize().let { if (t.trim) it.scale(1.25f) else it }, contentScale = ContentScale.Crop)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text((AchievementToasts.EYEBROW[t.tier] ?: "Achievement").uppercase(), style = ts(11f, color = tc).copy(letterSpacing = 1.32.sp))
                    Text(t.title, style = ts(16f, FontWeight.Bold, Color(0xFFECEAE4), line = 19.2f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(t.line, style = ts(12f, color = Color(0xFFA3A7AE), line = 15.6f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                if (lines.isNotEmpty()) Text(lines.joinToString("\n"), style = ts(12f, FontWeight.SemiBold, tc, line = 15f).copy(textAlign = androidx.compose.ui.text.style.TextAlign.End))
            }
            if (more > 0) Box(Modifier.align(Alignment.BottomEnd).offset(x = (-14).dp, y = 9.dp).clip(RoundedCornerShape(9.dp)).background(Color(0xFF232831))
                .border(1.dp, Color(0x17FFFFFF), RoundedCornerShape(9.dp)).padding(horizontal = 7.dp)) { Text("+$more", style = ts(11f, color = Color(0xFFECEAE4), line = 18f)) }
        }
    }
}
