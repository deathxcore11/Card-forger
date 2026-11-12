package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.engine.MatchState
import kotlin.math.PI
import kotlin.math.sin

/**
 * The living table (specs/living-table-feel-brief.md F1 to F10, specs/living-table-build-guide.md): every number of the feel
 * effects in one place, taken from the showpiece (design/living-table-showpiece.html). Look only: nothing here changes a
 * decision, a prompt, a timer or what can be tapped, and every effect starts from a board the app already received.
 */
internal object TableFeel {
    /** The "Match effects" setting: Full, Reduced (no shake, freeze or clock stop) or Off (the table as it was before F1). */
    enum class Mode { FULL, REDUCED, OFF }
    val MODES = listOf("full", "reduced", "off")
    fun mode(setting: String = AppSettings.matchEffects): Mode = when (setting) { "off" -> Mode.OFF; "reduced" -> Mode.REDUCED; else -> Mode.FULL }

    /** F3: a creature of this power or more lands heavy. F5: a loyalty cost of this much or more stops the clock. (Randall may change them.) */
    const val HEAVY_POWER = 5
    const val CLOCK_STOP_COST = 5

    // F1, the turn light. Yours rises from the bottom edge and is gone 30 % of the height from the top; the CPU's falls from the
    // top edge and is gone 70 % down. A turn change cross-fades them while a band of light crosses the table top to bottom.
    const val LIGHT_YOURS = .26f
    const val LIGHT_CPU = .28f
    const val LIGHT_YOURS_END = .30f
    const val LIGHT_CPU_END = .70f
    const val TURN_FADE_MS = 750
    /** The band: 120 tall at the phone's 390 (90 above its line, 30 below), white-gold at 50 % at its peak, strength a half sine. */
    const val SWEEP_ABOVE = 90f / 390f
    const val SWEEP_BELOW = 30f / 390f
    const val SWEEP_PEAK = .5f
    val SWEEP_TONE = Color(0xFFFFF0C8)
    /** The untap wave: a readied land flashes in its own colour at 70 % for 240 ms (on P4's ripple, which keeps its timing). */
    const val UNTAP_FLASH = .7f
    const val UNTAP_FLASH_MS = 240L

    /** F10: one profile per mat, data only. [air] and [mark] are read by F8 and F3. */
    data class Profile(val id: String, val lightYours: Color, val lightCpu: Color, val air: String, val mark: String, val win: Color, val winHi: Color)
    /** The four mats drawn in the showpiece, their exact colours. */
    val PROFILES = listOf(
        Profile("ashen-forge", Color(0xFFFFB46A), Color(0xFFFF5A2A), "ember", "lava", Color(0xFFFF8A3A), Color(0xFFFFE2B0)),
        Profile("drowned-archive", Color(0xFFCFDCFF), Color(0xFF6F9CFF), "mist", "ripple", Color(0xFF8FD0FF), Color(0xFFEEF8FF)),
        Profile("forest-temple", Color(0xFFD8F08A), Color(0xFF6FD0A0), "firefly", "leaf", Color(0xFFB9F07A), Color(0xFFFFF6C8)),
        Profile("star-observatory", Color(0xFFF3E2B8), Color(0xFF9C8CFF), "star", "star", Color(0xFFB9A8FF), Color(0xFFFFFFFF)),
    ).associateBy { it.id }
    /** A mat with no profile yet (F10 fills the other ten): the table's own warm light on both sides, plain dust and crack. */
    val PLAIN = Profile("", Color(0xFFFFE4B8), Color(0xFFFFE4B8), "dust", "crack", Color(0xFFF3D27E), Color(0xFFFFF0C8))
    fun profile(mat: String?): Profile = PROFILES[mat] ?: PLAIN

    /** The mat on the table now (PlaymatScene says which), so the feel follows the painting. */
    var mat by mutableStateOf<String?>(null)

    /** One readied land's flash: the tile, when (ms after the turn's board arrived) and its colour. */
    data class Flash(val card: Int, val delayMs: Long, val tone: Color)
    /** What a new turn's board [b] (after [a]) starts: whose side the light goes to, and one flash per land that turn readied. */
    data class TurnChange(val mine: Boolean, val flashes: List<Flash>)

    /** F1 from two boards: null unless the turn changed. The lands are P4's ripple order and timing ([untapOrder]); nothing is predicted. */
    fun turnChange(a: MatchState, b: MatchState): TurnChange? {
        if (a.turn == b.turn) return null
        val flashes = untapOrder(a, b).mapIndexedNotNull { i, id ->
            val c = b.card(id)?.takeIf { it.isLand } ?: return@mapIndexedNotNull null
            Flash(id, UNTAP_AT_MS + i * UNTAP_GAP_MS, frameTone(cardColors(c)).first)
        }
        return TurnChange(b.activePlayer == b.viewer, flashes)
    }

    // F2, the mana light. Each land you tap to pay leaves a soft round glow at the table's bottom edge under it, in its colour,
    // until the turn ends; while a spell of yours is on the stack a line in that colour runs from the land up to it.
    const val MANA_RADIUS = .46f
    const val MANA_GLOW = .24f
    const val MANA_IN_MS = 320L
    const val MANA_OUT_MS = 400L
    /** The line: 2.2 wide with a 10 glow, bowed upward by 12 % of the height; it holds 200 ms, then fades over 700. */
    const val LEY_WIDTH = 2.2f
    const val LEY_GLOW = 10f
    const val LEY_BOW = .12f
    const val LEY_HOLD_MS = 200L
    const val LEY_FADE_MS = 700L

    /** One tapped land's glow: the tile and its colour; [line] when a spell of yours stands on the stack for it to run to. */
    data class ManaGlow(val card: Int, val tone: Color, val line: Boolean)
    /** What board [b] (after [a]) does to the mana light: the lands you tapped since [a], and whether the turn ended (all glows fade). */
    data class ManaChange(val glows: List<ManaGlow>, val clear: Boolean)

    /** F2 from two boards. Only what Forge shows: a land of yours untapped in [a] and tapped in [b]. A new turn clears. */
    fun manaChange(a: MatchState, b: MatchState): ManaChange {
        if (a.turn != b.turn) return ManaChange(emptyList(), true)
        val ready = a.me.battlefield.filter { it.isLand && !it.tapped }.map { it.id }.toSet()
        val spell = b.stack.firstOrNull()?.controller == b.viewer
        return ManaChange(b.me.battlefield.filter { it.isLand && it.tapped && it.id in ready }.map { ManaGlow(it.id, frameTone(cardColors(it)).first, spell) }, false)
    }

    /** The band's strength at [p] (0..1) of its way down. */
    fun sweepStrength(p: Float): Float = if (p <= 0f || p >= 1f) 0f else SWEEP_PEAK * sin(p * PI.toFloat())
}

/**
 * F1, the turn light: under every card, over the mat. Your turn lights the table from your edge in the mat's "yours" colour, the
 * CPU's from its edge; a turn change cross-fades the two over 750 ms while a band of light crosses the table. Off: nothing is drawn.
 */
@Composable
internal fun TurnLight(st: MatchState) {
    val mode = TableFeel.mode()
    if (mode == TableFeel.Mode.OFF) return
    val profile = TableFeel.profile(TableFeel.mat)
    val mine = st.activePlayer == st.viewer
    val light = remember { Animatable(if (mine) 1f else 0f) }
    val sweep = remember { Animatable(-1f) }
    var seenTurn by remember { mutableStateOf(st.turn) }
    LaunchedEffect(mine) { if (Motion.still) light.snapTo(if (mine) 1f else 0f) else light.animateTo(if (mine) 1f else 0f, tween(TableFeel.TURN_FADE_MS)) }
    LaunchedEffect(st.turn) {
        if (st.turn == seenTurn || Motion.still) { seenTurn = st.turn; return@LaunchedEffect }
        seenTurn = st.turn
        sweep.snapTo(0f); sweep.animateTo(1f, tween(TableFeel.TURN_FADE_MS, easing = FastOutSlowInEasing)); sweep.snapTo(-1f)
    }
    Canvas(Modifier.fillMaxSize()) {
        val h = size.height; val me = light.value; val cpu = 1f - me
        if (cpu > 0f) drawRect(Brush.verticalGradient(listOf(profile.lightCpu.copy(alpha = TableFeel.LIGHT_CPU * cpu), profile.lightCpu.copy(alpha = 0f)), startY = 0f, endY = h * TableFeel.LIGHT_CPU_END),
            size = Size(size.width, h * TableFeel.LIGHT_CPU_END), blendMode = BlendMode.Plus)
        if (me > 0f) drawRect(Brush.verticalGradient(listOf(profile.lightYours.copy(alpha = 0f), profile.lightYours.copy(alpha = TableFeel.LIGHT_YOURS * me)), startY = h * TableFeel.LIGHT_YOURS_END, endY = h),
            topLeft = Offset(0f, h * TableFeel.LIGHT_YOURS_END), size = Size(size.width, h * (1f - TableFeel.LIGHT_YOURS_END)), blendMode = BlendMode.Plus)
        val p = sweep.value
        if (p >= 0f) {
            val y = p * h; val a = TableFeel.sweepStrength(p); val top = y - TableFeel.SWEEP_ABOVE * h; val bottom = y + TableFeel.SWEEP_BELOW * h
            drawRect(Brush.verticalGradient(0f to TableFeel.SWEEP_TONE.copy(alpha = 0f), .75f to TableFeel.SWEEP_TONE.copy(alpha = a), 1f to TableFeel.SWEEP_TONE.copy(alpha = 0f), startY = top, endY = bottom),
                topLeft = Offset(0f, top), size = Size(size.width, bottom - top), blendMode = BlendMode.Plus)
        }
    }
}

/** F2: one glow on the table (where its land stood, root pixels), when it was lit and, once the turn ended, when it began to fade. */
private class ManaLit(val card: Int, val x: Float, val y: Float, val tone: Color, val line: Boolean, val born: Long) { var gone: Long = -1L }

/**
 * F2, the mana light: under every card. The lands you tap to pay glow at the table's bottom edge until the turn ends, and a line
 * runs from each to your spell on the stack. Read from the boards as they arrive ([TableFeel.manaChange]); Off draws nothing.
 */
@Composable
internal fun ManaLight(st: MatchState) {
    if (TableFeel.mode() == TableFeel.Mode.OFF) return
    val fx = LocalBattlefield.current
    val anchors = LocalAnchors.current ?: return
    val lit = remember { androidx.compose.runtime.mutableStateListOf<ManaLit>() }
    val last = remember { arrayOfNulls<MatchState>(1) }
    var origin by remember { mutableStateOf(Offset.Zero) }
    val clock = remember { androidx.compose.runtime.mutableLongStateOf(0L) }
    fun now() = fx?.now?.longValue ?: clock.longValue
    androidx.compose.runtime.SideEffect {
        val a = last[0]; last[0] = st
        if (a == null || a === st) return@SideEffect
        val c = TableFeel.manaChange(a, st)
        val t = now()
        if (c.clear) lit.forEach { if (it.gone < 0) it.gone = t }
        for (g in c.glows) if (lit.none { it.card == g.card && it.gone < 0 }) anchors.rects["c${g.card}"]?.let { r -> lit += ManaLit(g.card, r.center.x, r.center.y, g.tone, g.line, t) }
        lit.removeAll { it.gone >= 0 && t - it.gone > TableFeel.MANA_OUT_MS }
    }
    if (lit.isEmpty()) return
    Canvas(Modifier.fillMaxSize().then(Modifier.onGloballyPositionedOrigin { origin = it })) {
        val t = now(); val h = size.height; val still = Motion.still
        val radius = h * TableFeel.MANA_RADIUS
        val to = anchors.rects["stackcard"]?.center?.minus(origin)
        for (g in lit) {
            val age = (t - g.born).coerceAtLeast(0L)
            val a = (if (still) 1f else (age / TableFeel.MANA_IN_MS.toFloat()).coerceAtMost(1f)) * (if (g.gone < 0) 1f else (1f - (t - g.gone) / TableFeel.MANA_OUT_MS.toFloat()).coerceIn(0f, 1f))
            if (a <= 0f) continue
            val x = g.x - origin.x; val c = Offset(x, h + 10.dp.toPx())
            drawRect(Brush.radialGradient(listOf(g.tone.copy(alpha = TableFeel.MANA_GLOW * a), g.tone.copy(alpha = 0f)), center = c, radius = radius),
                topLeft = Offset(x - radius, h - radius), size = Size(radius * 2, radius), blendMode = BlendMode.Plus)
            // The line to the spell: held 200 ms, then fading over 700.
            val la = if (still || !g.line || to == null) 0f else (1f - (age - TableFeel.LEY_HOLD_MS) / TableFeel.LEY_FADE_MS.toFloat()).coerceIn(0f, 1f)
            if (la > 0f && to != null) {
                val from = Offset(x, g.y - origin.y)
                val path = androidx.compose.ui.graphics.Path().apply { moveTo(from.x, from.y); quadraticBezierTo((from.x + to.x) / 2, minOf(from.y, to.y) - h * TableFeel.LEY_BOW, to.x, to.y) }
                drawPath(path, g.tone.copy(alpha = .25f * la), style = androidx.compose.ui.graphics.drawscope.Stroke(TableFeel.LEY_GLOW.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round), blendMode = BlendMode.Plus)
                drawPath(path, g.tone.copy(alpha = la), style = androidx.compose.ui.graphics.drawscope.Stroke(TableFeel.LEY_WIDTH.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round), blendMode = BlendMode.Plus)
            }
        }
    }
}

/** Where this layer starts in the root, so anchor boxes (root pixels) can be drawn in it. */
private fun Modifier.onGloballyPositionedOrigin(set: (Offset) -> Unit): Modifier = onGloballyPositioned { set(it.positionInRoot()) }
