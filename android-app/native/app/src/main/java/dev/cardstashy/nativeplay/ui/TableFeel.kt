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
    private val DRAWN_PROFILES = listOf(
        Profile("ashen-forge", Color(0xFFFFB46A), Color(0xFFFF5A2A), "ember", "lava", Color(0xFFFF8A3A), Color(0xFFFFE2B0)),
        Profile("drowned-archive", Color(0xFFCFDCFF), Color(0xFF6F9CFF), "mist", "ripple", Color(0xFF8FD0FF), Color(0xFFEEF8FF)),
        Profile("forest-temple", Color(0xFFD8F08A), Color(0xFF6FD0A0), "firefly", "leaf", Color(0xFFB9F07A), Color(0xFFFFF6C8)),
        Profile("star-observatory", Color(0xFFF3E2B8), Color(0xFF9C8CFF), "star", "star", Color(0xFFB9A8FF), Color(0xFFFFFFFF)),
    )
    /** The mats Fable has drawn in the showpiece. The other ten are built from the feel brief's table and are listed as "not drawn" on the Release card. */
    val DRAWN = DRAWN_PROFILES.map { it.id }.toSet()
    /** The air kinds F8 knows. */
    val AIRS = setOf("ember", "mist", "firefly", "star", "dust")
    private val GOLD = Color(0xFFF3D27E); private val GOLD_HI = Color(0xFFFFF0C8)
    /**
     * The other ten (feel brief, F10 table): the light in the two colours the table names, the nearest air kind, the plain crack and
     * the default gold win. What the table says about the painting itself (candles flare, lanterns flicker, hedrons jolt) is not built.
     */
    private val TABLE_PROFILES = listOf(
        Profile("moonlit-courtyard", Color(0xFFDCE4F2), Color(0xFF7FA8E0), "dust", "crack", GOLD, GOLD_HI),      // moon silver / cold blue, candle motes
        Profile("white-sanctuary", Color(0xFFFFE08A), Color(0xFFBFD8FF), "dust", "crack", GOLD, GOLD_HI),        // sun gold / pale blue, petals and gold dust
        Profile("black-ossuary", Color(0xFFFFC27A), Color(0xFFD8324A), "dust", "crack", GOLD, GOLD_HI),          // candle amber / crimson, ash
        Profile("keldon-battlefield", Color(0xFFFF9A4A), Color(0xFFE0402A), "dust", "crack", GOLD, GOLD_HI),     // sunset orange / red, blowing dust
        Profile("wild-hedrons", Color(0xFFEEF6FF), Color(0xFF6FD08A), "mist", "crack", GOLD, GOLD_HI),           // sky white / green, mist
        Profile("artifact-vault", Color(0xFFDCE4F2), Color(0xFFC9A24A), "dust", "crack", GOLD, GOLD_HI),         // moon silver / brass, dust
        Profile("innistrad-graveyard", Color(0xFFFFC98A), Color(0xFF9FB8E8), "mist", "crack", GOLD, GOLD_HI),    // candle / moon cold, ground mist
        Profile("ravnica-guild-city", Color(0xFFFFB860), Color(0xFF5F8FE0), "dust", "crack", GOLD, GOLD_HI),     // lantern amber / city blue, dust
        Profile("zendikar-expedition", Color(0xFFFFE08A), Color(0xFF6FC0F0), "mist", "crack", GOLD, GOLD_HI),    // sun gold / waterfall blue, waterfall mist
        Profile("charcoal-table", Color(0xFFFFC98A), Color(0xFFD8D8D8), "dust", "crack", GOLD, GOLD_HI),         // candle / neutral, dust
    )
    val PROFILES = (DRAWN_PROFILES + TABLE_PROFILES).associateBy { it.id }
    /** A mat with no profile (a Story act's mat): the table's own warm light on both sides, plain dust and crack. */
    val PLAIN = Profile("", Color(0xFFFFE4B8), Color(0xFFFFE4B8), "dust", "crack", GOLD, GOLD_HI)
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
    /** The CPU's lands glow too, at the top edge behind them, dimmer so your side stays the stronger one (design thread, 12 Nov). */
    const val MANA_GLOW_CPU = .16f
    const val MANA_IN_MS = 320L
    const val MANA_OUT_MS = 400L
    /** The line: 2.2 wide with a 10 glow, bowed upward by 12 % of the height; it holds 200 ms, then fades over 700. */
    const val LEY_WIDTH = 2.2f
    const val LEY_GLOW = 10f
    const val LEY_BOW = .12f
    const val LEY_HOLD_MS = 200L
    const val LEY_FADE_MS = 700L

    /** One tapped land's glow: the tile and its colour; [line] when a spell of yours stands on the stack for it to run to. */
    data class ManaGlow(val card: Int, val tone: Color, val line: Boolean, val mine: Boolean = true)
    /** What board [b] (after [a]) does to the mana light: the lands you tapped since [a], and whether the turn ended (all glows fade). */
    data class ManaChange(val glows: List<ManaGlow>, val clear: Boolean)

    /** F2 from two boards. Only what Forge shows: a land of yours untapped in [a] and tapped in [b]. A new turn clears. */
    fun manaChange(a: MatchState, b: MatchState): ManaChange {
        if (a.turn != b.turn) return ManaChange(emptyList(), true)
        val caster = b.stack.firstOrNull()?.controller
        return ManaChange(b.players.sortedBy { it.id != b.viewer }.flatMap { p ->
            val ready = a.players.firstOrNull { it.id == p.id }?.battlefield.orEmpty().filter { it.isLand && !it.tapped }.map { it.id }.toSet()
            p.battlefield.filter { it.isLand && it.tapped && it.id in ready }.map { ManaGlow(it.id, frameTone(cardColors(it)).first, caster == p.id, p.id == b.viewer) }
        }, false)
    }

    // F6, the charge. This is P5's strike ([Strike]) with a bigger wind-up and a trail: P5's order, timing and sounds stay as approved.
    // The attacker swells to 1.14 on the pull back, leaves sparks in its own colour on the dash, and where it lands there are white
    // spikes and a ring in its colour. A declared attacker's rim is gold.
    const val CHARGE_SWELL = 1.14f
    const val CHARGE_TRAIL_EVERY_MS = 16f
    const val CHARGE_TRAIL_BACK = 20f
    const val CHARGE_TRAIL_SPEED = 350f
    const val CHARGE_TRAIL_SPREAD = .5f
    const val CHARGE_TRAIL_LIFE_MS = 340L
    const val CHARGE_TRAIL_SIZE = 3f
    /** Design review, 12 Nov: the sparks are glowing points (a 3 dp core in a 10 dp glow), three a frame across the card's width, so an 85 ms dash leaves twelve or more. */
    const val CHARGE_TRAIL_GLOW = 10f
    const val CHARGE_TRAIL_PER = 3
    /** The after-images behind the card are its own colour: the nearest at 18 %, each one dimmer. */
    const val CHARGE_GHOST = .18f
    const val CHARGE_SPIKES = 10
    const val CHARGE_SPIKE_LEN = 70f
    /** The ring starts at the struck seat's (or tile's) size 4 dp thick and thins to 1 dp as it grows to 1.6 times that over 220 ms. */
    const val CHARGE_RING_GROW = 1.6f
    const val CHARGE_RING_MS = 220f
    const val CHARGE_RING_FROM = 4f
    const val CHARGE_RING_TO = 1f
    val DECLARE_GOLD = Color(0xFFF3D27E)
    /** As it was before F6 (and with Match effects off): the coral of P5's declare ring. */
    val CORAL = Color(0xFFFF6A4A)

    /** One beat of a charge: its name, when it starts (ms from the attacker's first move) and how long it lasts. */
    data class Beat(val name: String, val at: Float, val ms: Float)
    /** A charge's four beats in order, read from [Strike]: pull back, dash, the hit's freeze, the return ([face]: at a player). */
    fun charge(face: Boolean): List<Beat> = listOf(
        Beat("pull-back", 0f, Strike.wind(face)), Beat("dash", Strike.wind(face), Strike.hit(face) - Strike.wind(face)),
        Beat("hit", Strike.hit(face), Strike.freeze(face)), Beat("return", Strike.homeAt(face), Strike.homeMs(face)))
    fun chargeSwell(): Float = if (mode() == Mode.OFF) 1.1f else CHARGE_SWELL
    /** The colour of an attacker's trail and ring: the card's own frame colour. Off: P5's coral. */
    fun chargeTone(c: dev.cardstashy.nativeplay.engine.Card): Color = if (mode() == Mode.OFF) CORAL else frameTone(cardColors(c)).first
    fun declareRim(): Color = if (mode() == Mode.OFF) CORAL else DECLARE_GOLD

    // F3, weight. A creature of [HEAVY_POWER] or more lands heavy: its tile comes in at 1.9 times its size from above and drops in
    // 130 ms (ease-in cubic); where it lands the clock freezes 90 ms, the board shakes 11 dp (fading .03 a ms), a ring in the card's
    // colour runs out to 2.4 tile heights, every other card of that player hops, and the mat keeps a mark until the turn ends.
    // Power 3 to 4 (medium) and 1 to 2 (light) are P3's landing as approved; nothing is added to them.
    const val HEAVY_SCALE = 1.9f
    const val HEAVY_DROP_MS = 130f
    /** How far above its place the drop starts, in tile heights (a fifth of the phone's height). */
    const val HEAVY_RISE = 1.08f
    const val HEAVY_FREEZE_MS = 90L
    const val HEAVY_SHAKE = 11f
    const val HEAVY_SHAKE_FADE = .03f
    const val HEAVY_RING = 2.4f
    const val HEAVY_RING_FROM = 40f
    const val HEAVY_RING_WIDTH = 4f
    const val HEAVY_RING_MS = 460f
    const val HEAVY_SPIKES = 10
    const val HEAVY_SPIKE_LEN = 70f
    /** The hop: tiles 11 dp, whole cards (your hand) 6 dp; up in 90 ms, down in 300 with an overshoot. */
    const val HOP_TILE = 11f
    const val HOP_CARD = 6f
    const val HOP_UP_MS = 90f
    const val HOP_DOWN_MS = 300f
    /**
     * The mark (design review, 12 Nov): 2.2 tile heights across, centred on the tile's middle, starting at the tile's rim and running
     * outward, so a crown shows round the tile even on a full row. After a second it settles to 60 %; it leaves over 400 ms when the turn ends.
     */
    const val MARK_SIZE = 2.2f
    const val MARK_SETTLE = .6f
    const val MARK_SETTLE_AT_MS = 1000f
    const val MARK_SETTLE_MS = 600f
    const val MARK_OUT_MS = 400L
    /** How long the whole heavy landing runs after its drop (the ring and the hop are over by then). */
    const val HEAVY_AFTER_MS = 520f

    enum class Weight { LIGHT, MEDIUM, HEAVY }
    /** The landing's weight from the power Forge reports: 1 to 2 light, 3 to 4 medium, [HEAVY_POWER] or more heavy. */
    fun weight(power: Int?): Weight = when { (power ?: 0) >= HEAVY_POWER -> Weight.HEAVY; (power ?: 0) >= 3 -> Weight.MEDIUM; else -> Weight.LIGHT }
    /** What a heavy landing schedules. Reduced keeps the drop, ring, hop and mark and drops the freeze and the shake. */
    data class Landing(val dropMs: Float, val freezeMs: Long, val shakeDp: Float, val shakeMs: Long, val hop: Boolean, val mark: String)
    /** F3 for an entering card: null unless it is a creature that lands heavy and Match effects are not off. */
    fun landing(c: dev.cardstashy.nativeplay.engine.Card, setting: String = AppSettings.matchEffects, mat: String? = TableFeel.mat): Landing? {
        val m = mode(setting)
        if (m == Mode.OFF || !c.isCreature || weight(c.power) != Weight.HEAVY) return null
        val calm = m == Mode.REDUCED
        return Landing(HEAVY_DROP_MS, if (calm) 0L else HEAVY_FREEZE_MS, if (calm) 0f else HEAVY_SHAKE, if (calm) 0L else (HEAVY_SHAKE / HEAVY_SHAKE_FADE).toLong(), true, profile(mat).mark)
    }
    /** The hop's height (0..1, a little under 0 on the way down) [ms] after the landing. */
    fun hopLift(ms: Float): Float = when {
        ms <= 0f || ms >= HOP_UP_MS + HOP_DOWN_MS -> 0f
        ms < HOP_UP_MS -> 1f - (1f - ms / HOP_UP_MS).let { it * it * it }
        else -> { val x = (ms - HOP_UP_MS) / HOP_DOWN_MS - 1f; val c1 = 1.70158f; -((c1 + 1f) * x * x * x + c1 * x * x) }
    }
    /** The heavy drop's size and height above its place (in tile heights) [ms] into it. */
    fun dropAt(ms: Float): Pair<Float, Float> { val q = (ms / HEAVY_DROP_MS).coerceIn(0f, 1f); val e = q * q * q; return (HEAVY_SCALE + (1f - HEAVY_SCALE) * e) to HEAVY_RISE * (1f - e) }

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
private class ManaLit(val card: Int, val x: Float, val y: Float, val tone: Color, val line: Boolean, val born: Long, val mine: Boolean = true) { var gone: Long = -1L }

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
        for (g in c.glows) if (lit.none { it.card == g.card && it.gone < 0 }) anchors.rects["c${g.card}"]?.let { r -> lit += ManaLit(g.card, r.center.x, r.center.y, g.tone, g.line, t, g.mine) }
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
            // Yours at the table's foot; the CPU's at the top edge behind its lands, dimmer.
            val x = g.x - origin.x; val c = Offset(x, if (g.mine) h + 10.dp.toPx() else -10.dp.toPx())
            drawRect(Brush.radialGradient(listOf(g.tone.copy(alpha = (if (g.mine) TableFeel.MANA_GLOW else TableFeel.MANA_GLOW_CPU) * a), g.tone.copy(alpha = 0f)), center = c, radius = radius),
                topLeft = Offset(x - radius, if (g.mine) h - radius else 0f), size = Size(radius * 2, radius), blendMode = BlendMode.Plus)
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

private fun markRand(n: Int): Float { val v = sin(n * 12.9898f + 78.233f) * 43758.547f; return v - kotlin.math.floor(v) }

/**
 * F3, the mark a heavy landing leaves: under every card, over the mat, until the turn ends. Which mark is the mat's own
 * ([TableFeel.Profile.mark]): cracks that glow on the forge, rings on the water, a smaller crack in the temple, a constellation
 * under the stars; a mat with no profile cracks. Off: none are made, so nothing is drawn.
 */
@Composable
internal fun LandMarks() {
    val fx = LocalBattlefield.current ?: return
    if (fx.landMarks.isEmpty()) return
    var origin by remember { mutableStateOf(Offset.Zero) }
    Canvas(Modifier.fillMaxSize().then(Modifier.onGloballyPositionedOrigin { origin = it })) {
        val t = fx.now.longValue; val u = 1.dp.toPx()
        for (m in fx.landMarks) {
            val age = (t - m.born).coerceAtLeast(0L).toFloat()
            val out = if (m.gone < 0L) 1f else (1f - (t - m.gone) / TableFeel.MARK_OUT_MS.toFloat()).coerceIn(0f, 1f)
            if (out <= 0f) continue
            val c = m.at - origin; val seed = m.card * 131
            // Settled to 60 % a second after the landing, so it does not fight the cards.
            val calm = 1f - (1f - TableFeel.MARK_SETTLE) * ((age - TableFeel.MARK_SETTLE_AT_MS) / TableFeel.MARK_SETTLE_MS).coerceIn(0f, 1f)
            val reach = m.size / 2
            /** Where the ray at [ang] leaves the tile, as a distance from its middle. */
            fun rim(ang: Float): Float = minOf(m.halfW / kotlin.math.abs(kotlin.math.cos(ang)).coerceAtLeast(.001f), m.halfH / kotlin.math.abs(sin(ang)).coerceAtLeast(.001f))
            fun on(ang: Float, d: Float) = Offset(c.x + kotlin.math.cos(ang) * d, c.y + sin(ang) * d)
            when (m.kind) {
                "ripple" -> {
                    // A wet patch that stays, and four rings that run out once.
                    val wet = calm * out; val ww = m.halfW + (reach - m.halfH) * .8f; val wh = m.halfH + (reach - m.halfH) * .8f
                    drawOval(Color(0xFF0A1830).copy(alpha = .35f * wet), Offset(c.x - ww, c.y - wh), Size(ww * 2, wh * 2))
                    drawOval(Color(0xFFCFE8FF).copy(alpha = .45f * wet), Offset(c.x - ww, c.y - wh), Size(ww * 2, wh * 2), style = androidx.compose.ui.graphics.drawscope.Stroke(1.4f * u), blendMode = BlendMode.Plus)
                    for (i in 0 until 4) { val a0 = age - i * 230f; if (a0 <= 0f || a0 >= 1500f) continue
                        val g = 1f - (1f - a0 / 1500f).let { it * it * it }; val rad = m.size * (.2f + (1.4f + i * .5f) * g)
                        val al = if (a0 < 120f) .9f * a0 / 120f else .9f * (1f - ((a0 - 120f) / 1300f).coerceAtMost(1f)).let { it * it }
                        drawOval(Color(0xFFCFE8FF).copy(alpha = al * out), Offset(c.x - rad, c.y - rad * .42f), Size(rad * 2, rad * .84f), style = androidx.compose.ui.graphics.drawscope.Stroke(1.6f * u), blendMode = BlendMode.Plus) }
                }
                "star" -> {
                    // Eight points joined in the order they light (900 ms); it settles to half strength over three seconds.
                    val a = (age / 150f).coerceAtMost(1f) * calm * out
                    val shown = (1f - (1f - (age / 900f).coerceAtMost(1f)).let { it * it * it }) * 8f
                    val pts = (0 until 8).map { i -> val ang = i / 8f * 6.283f + (markRand(seed + i) - .5f) * .6f; val from = rim(ang)
                        on(ang, from + (reach - from).coerceAtLeast(0f) * (.35f + .65f * markRand(seed + i * 7 + 3))) }
                    val tone = Color(0xFFB9A8FF)
                    for (i in 1 until 8) if (i <= shown) { drawLine(tone.copy(alpha = .3f * a), pts[i - 1], pts[i], 5f * u, blendMode = BlendMode.Plus); drawLine(tone.copy(alpha = a), pts[i - 1], pts[i], 1.2f * u, blendMode = BlendMode.Plus) }
                    pts.forEachIndexed { i, p -> if (i <= shown) drawCircle(Color.White.copy(alpha = a), (2.2f + 1.2f * sin(t / 300f + i)) * u, p, blendMode = BlendMode.Plus) }
                }
                else -> {
                    // Cracks: nine rays of three short strokes, flattened to the table. On the forge they glow and cool to 40 % in six seconds.
                    val far = if (m.kind == "leaf") .8f else 1f
                    val a = (age / 80f).coerceAtMost(1f) * calm * out
                    // Each ray starts where it leaves the tile and runs outward in three short strokes.
                    val rays = (0 until 9).map { i -> val ang = i / 9f * 6.283f + (markRand(seed + i) - .5f) * .5f; val from = rim(ang); val run = (reach - from).coerceAtLeast(0f) * far
                        androidx.compose.ui.graphics.Path().apply { on(ang, from).let { moveTo(it.x, it.y) }
                            for (j in 1..3) { val aa = ang + (if (j == 3) 0f else (markRand(seed + i * 3 + j * 17 + 2) - .5f) * .35f)
                                on(aa, from + run * (j / 3f) * (.8f + .2f * markRand(seed + i * 5 + j * 11 + 1))).let { lineTo(it.x, it.y) } } } }
                    val round = androidx.compose.ui.graphics.StrokeCap.Round
                    for (ray in rays) drawPath(ray, Color.Black.copy(alpha = .8f * a), style = androidx.compose.ui.graphics.drawscope.Stroke(2.6f * u, cap = round))
                    translateBy(u) { for (ray in rays) drawPath(ray, Color.White.copy(alpha = .13f * a), style = androidx.compose.ui.graphics.drawscope.Stroke(1f * u, cap = round)) }
                    if (m.kind == "lava") { val heat = (1f - .6f * (age / 6000f).coerceAtMost(1f)) * (.75f + .25f * sin(t / 240f)) * (age / 80f).coerceAtMost(1f) * out
                        for (ray in rays) { drawPath(ray, Color(0xFFFF5A1A).copy(alpha = .35f * heat), style = androidx.compose.ui.graphics.drawscope.Stroke(7f * u, cap = round), blendMode = BlendMode.Plus)
                            drawPath(ray, Color(0xFFFFB060).copy(alpha = heat), style = androidx.compose.ui.graphics.drawscope.Stroke(1.6f * u, cap = round), blendMode = BlendMode.Plus) } }
                }
            }
        }
    }
}

private inline fun androidx.compose.ui.graphics.drawscope.DrawScope.translateBy(d: Float, block: androidx.compose.ui.graphics.drawscope.DrawScope.() -> Unit) {
    drawContext.transform.translate(d, d); block(); drawContext.transform.translate(-d, -d)
}
