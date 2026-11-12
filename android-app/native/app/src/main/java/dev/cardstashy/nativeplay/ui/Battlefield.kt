package dev.cardstashy.nativeplay.ui

import android.graphics.BlurMaskFilter
import android.graphics.RuntimeShader
import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.em
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Living Battlefield, Phase 0 (spec v1, pages 5, 9, 12 and 15): the ten table moments drawn from Forge's own state.
 *
 * Every effect comes from a difference between two Forge snapshots (a card arrived, left, took damage, a spell went on or
 * off the stack, a life total moved); nothing is predicted. The interpreter scores each one 0 to 3 and applies the attention
 * budget: one focal (level 2 or 3) effect at a time, the rest wait their turn or play beside it at level 1. When the
 * player gets priority or a question, nothing is cut short (match director): a non-focal effect may finish at its floor,
 * focal ones play out. A touch anywhere on the board jumps every effect to its end state. Cards only ever move by transform, so no
 * box on the board changes size.
 */
/**
 * Match punch P5, the strike's shape in ms. A clash: pull back and swell (150), strike (85), a 100 ms freeze on contact, then the
 * flash, sparks, ring, shake and numbers while the attacker springs home (240): about 800 a pair. A hit to a face: pull back (160),
 * fly at the profile picture (200), a 125 ms freeze, the burst and the life ticking down, home 120 later (320): about 1100.
 */
internal object Strike {
    const val CLASH_MS = 800L; const val FACE_MS = 1100L
    fun face(it: FxItem) = it.toKey?.startsWith("orb") == true
    fun ms(face: Boolean) = if (face) FACE_MS else CLASH_MS
    /** The pull back ends. */
    fun wind(face: Boolean) = if (face) 160f else 150f
    /** Contact. */
    fun hit(face: Boolean) = if (face) 360f else 235f
    /** The freeze ends: the burst, the shake and the numbers start here. */
    fun after(face: Boolean) = hit(face) + freeze(face)
    /** The hold on contact. Match effects on Reduced has no freeze (living table rule 5): the burst comes with the contact. */
    fun freeze(face: Boolean) = if (TableFeel.mode() == TableFeel.Mode.REDUCED) 0f else if (face) 125f else 100f
    /** The attacker starts home, and how long that takes. */
    fun homeAt(face: Boolean) = if (face) after(true) + 120f else after(false)
    fun homeMs(face: Boolean) = if (face) 320f else 240f
    /** How far along its line the attacker is (px): back by [pull], out to [reach], held, then home (a clash springs past it). */
    fun offset(face: Boolean, ms: Float, reach: Float, pull: Float): Float {
        val w = wind(face); val h = hit(face); val home = homeAt(face)
        return when {
            ms < 0f -> 0f
            ms < w -> -pull * (1f - (1f - ms / w).let { it * it * it })
            ms < h -> { val q = (ms - w) / (h - w); -pull + (reach + pull) * q * q * q }
            ms < home -> reach
            else -> { val q = ((ms - home) / homeMs(face)).coerceAtMost(1f); reach * (1f - (if (face) 1f - (1f - q) * (1f - q) * (1f - q) else backOut(q))) }
        }
    }
    /** The attacker's size: swells 10 % on the pull back ([swell]; the living table's charge, F6, makes it 14 %); a hit to a face shrinks it to .45 as it flies at the picture. */
    fun scale(face: Boolean, ms: Float, swell: Float = 1.1f): Float {
        val w = wind(face); val h = hit(face); val home = homeAt(face)
        val far = if (face) .45f else swell
        return when {
            ms < 0f -> 1f
            ms < w -> 1f + (swell - 1f) * (ms / w)
            ms < h -> swell + (far - swell) * ((ms - w) / (h - w))
            ms < home -> far
            else -> far + (1f - far) * ((ms - home) / homeMs(face)).coerceAtMost(1f)
        }
    }
}
/** P5, the declare: each new attacker steps up in 210 ms, 95 apart, with a coral ring (300). */
/** A staged pair is lit and joined this long before its attacker moves. */
internal const val STAGE_LEAD_MS = 140L
internal const val DECLARE_MS = 210; internal const val DECLARE_GAP_MS = 95L
/** P5, a block: the blocker steps to its attacker (190), rests under its ice ring (360), then goes home. */
internal const val BLOCK_MS = 700L
/** P5, a kill: grey and shudder (240), flash and break (200); its embers reach the owner's square in 380 to 560 and the pile answers. */
internal const val DEATH_MS = 440L; internal const val EMBERS_MS = 880L
/** P6: Fire is 110 of swell and flash and 130 of streak; the impact plays 450; the spent spell leaves 160 after the impact, 320 to the square and 300 of ring. */
internal const val FIRE_MS = 240L; internal const val BOLT_MS = 450L; internal const val SPENT_MS = 620L; internal const val AIM_MS = 320L
/** P5: the life pill comes down one point every 90 ms from contact (faster past eight points, so a big hit still ends in time). */
internal fun lifeGap(points: Int): Long = if (points <= 8) 90L else (720L / points).coerceAtLeast(30L)

internal enum class Fx { DRAW, CAST, RESOLVE, ARRIVE, TOKEN, ATTACK, LUNGE, BLOCK, DAMAGE, LIFE, DEATH, COUNTER,
    /** One attacker's moment in staged combat: the board dims but for [FxItem.ids], a gold line and the pair's glass tag. */
    STAGE,
    /** A TRIGGER SHOWS ITSELF, beat 1: the card that triggered lifts 1.12x (18 dp) and one ring (260 dp) goes out in the caster's colour. */
    TRIG_SOURCE,
    /** Beat 3 on one changed card: a streak from the source, a flash, the change rising ("+1/+1"), the counter chip's pop, the trail line. */
    TRIG_LAND,
    /** Match punch P4: a gold glint on [FxItem.card]'s tile as it turns back in the untap ripple. */
    GLINT,
    /** Match punch P3, the landing's impact on [FxItem.card]'s tile: freeze, squash and spring, flash, ring, dust, sparks; [FxItem.power] scales shake and particles. */
    IMPACT,
    /** Match punch P6, Aim: a target thread has locked on [FxItem.card] (or the player at [FxItem.toKey]): it flinches 5 % and a ring closes on it. */
    AIM,
    /** P6, Fire: the resolving spell's place on the stack ([FxItem.from]) swells and flashes (110), then a thick streak crosses to [FxItem.toKey] (130). */
    FIRE,
    /** P6, Impact on [FxItem.card]: freeze, flash, shake, spikes, sparks and smoke in the spell's colour, the tile knocked and springing; a friendly spell ([FxItem.power] 0) only glows. */
    BOLT,
    /** P6, After: the spent spell ([FxItem.ghost]) leaves the stack for its owner's graveyard (320), where the pile answers with a ring. */
    SPENT,
    /** Match punch P5: nine ember streaks from a dead card's place ([FxItem.from]) to its owner's graveyard, where the pile answers with a ring. */
    EMBERS,
    /** Living table F7, the winning hit: the orb at [FxItem.toKey] breaks, a ring, a crack to the far corner and the mat's win colour flood the table. [FxItem.player] null: a draw, both orbs dim. */
    WIN,
    /** Living table F3: [FxItem.card] lands heavy. It drops from 1.9 times its size (130 ms); where it lands: freeze, shake, a ring in its colour, the cards in [FxItem.ids] hop and the mat keeps a mark. */
    HEAVY }

internal class FxItem(
    val kind: Fx, val level: Int, val baseMs: Long,
    val card: Int? = null, val player: Int? = null, val mine: Boolean = false,
    /** A box captured before it went away (a dying card, the stack card that resolved). */
    val from: Rect? = null,
    /** Anchor keys read at draw time, so they follow the live layout. */
    val fromKey: String? = null, val toKey: String? = null,
    val ghost: Card? = null, val tone: Color = Color.White, val land: Boolean = false, val power: Float = 1f,
    /** A stagger inside its group (ms), and the short label it shows (a damage number, a counter). */
    val delay: Long = 0L, var label: String = "",
    /** Where its number sits: -1 lower left (an attacker), 1 upper right (a blocker), 0 centred. */
    val side: Int = 0,
    /** A staged pair's cards (the attacker and its blockers), which stay lit while the rest of the board dims. */
    val ids: Set<Int> = emptySet(),
    /** Table additions 3, an arrival's importance: 0 ordinary, 1 rare or mythic (hold and drop), 2 a commander from the command zone. */
    val entrance: Int = 0,
    /** A level 2 entrance's name and its "Your commander" / "Their commander" line; a trigger landing's counter chip ("+1"). */
    val title: String = "",
    /** A trigger landing: the caster's colour (its streak) and the one trail line it carries. */
    val caster: Color = Color.White, val note: String = "",
) {
    var t0 = 0L; var dur = baseMs; var p0 = 0f
    /** Things this effect has thrown once (a freeze, a burst of particles), by bit. */
    var marks = 0
    /** P5: a life loss's points, ticked off the pill one by one from this effect's start. On a lunge at a player: the damage it brings (5 or more sounds the big hit). */
    var points = 0
    /** F6: the last trail spark this charge has left behind it (one every [TableFeel.CHARGE_TRAIL_EVERY_MS] of the dash). */
    var trail = -1
    /** P6: of a spell's streaks (one per target), the one that also draws the flash on the stack. */
    var lead = true
    /** The match sound pass: the cue this effect plays once, [soundAt] ms after it starts (its contact frame). */
    var sound: String? = null; var soundAt = 0L; var soundVol = 1f; var soundRate = 1f
    fun sounds(id: String, at: Long = 0L, vol: Float = 1f, rate: Float = 1f) = apply { sound = id; soundAt = at; soundVol = vol; soundRate = rate }
    fun once(bit: Int): Boolean = if (marks and bit != 0) false else { marks = marks or bit; true }
    /** 0..1 through the effect, or -1 while it waits for its turn. */
    fun p(now: Long): Float = if (now < t0) -1f else (p0 + (1f - p0) * ((now - t0).toFloat() / dur.coerceAtLeast(1))).coerceAtMost(1f)
    fun done(now: Long) = now >= t0 + dur
}

class Battlefield {
    internal val items = mutableStateListOf<FxItem>()
    /** Reduce motion (system animations off): only the numbers and the BLOCKED stamp, no movement, flash, shake or shards. */
    internal var reduced = false
    /** Effects set to Minimal (Low power): the beat stays (moves, numbers, ticks); sparks, trails, rays and shards go. */
    internal var low = false
    /** 0.4.59 T5: the leg of a card's travel the table draws now (set by FxDriver before each snapshot is read). */
    internal var travel: dev.cardstashy.nativeplay.match.TravelMoment? = null
    /** The frame clock (ms). Draw lambdas read it; the composition never does. */
    internal val now = mutableLongStateOf(0L)
    /** Bumped when the set of running effects changes, so card layers know to look again. */
    internal val rev = mutableIntStateOf(0)
    /** The board's own jolt: the strongest face hit in flight (0..1) and when it struck. Read in the board's layer only. */
    fun shake(scope: GraphicsLayerScope) {
        val t = now.longValue
        if (reduced || TableFeel.mode() == TableFeel.Mode.REDUCED) return
        // Camera (table-feel spec 3): the board leans in while a strike travels, 1.07 for a clash and 1.09 for a hit to a face.
        val lunge = items.firstOrNull { it.kind == Fx.LUNGE && it.p(t) in 0f..1f }
        var zoom = 1f
        if (lunge != null) { val ms = (t - lunge.t0).toFloat(); val face = Strike.face(lunge)
            zoom = 1f + (if (face) .09f else .07f) * smooth(Strike.wind(face) * .4f, Strike.hit(face), ms) * (1f - smooth(Strike.after(face) + 100f, Strike.ms(face).toFloat(), ms)) }
        // Shake from the contact: 16 dp over 480 ms for a clash, 20 dp over 560 ms for a face hit, damped.
        var dx = 0f; var dy = 0f
        val hit = items.firstOrNull { it.kind == Fx.LUNGE && (t - it.t0 - Strike.after(Strike.face(it)).toLong()) in 0L..(if (Strike.face(it)) 560L else 480L) }
        if (hit != null) {
            val face = Strike.face(hit); val span = if (face) 560f else 480f
            val q = ((t - hit.t0 - Strike.after(face)) / span).coerceIn(0f, 1f); val amp = (if (face) 20f else 16f) * (1f - q) * (1f - q)
            dx = amp * sin(q * 46f); dy = amp * .7f * cos(q * 39f)
        } else items.firstOrNull { it.kind == Fx.LIFE && it.level == 3 && it.p(t) in 0f..1f }?.let { h ->
            val p = h.p(t); if (p <= .5f) { val q = p / .5f; val amp = 20f * h.power * (1f - q) * (1f - q); dx = amp * sin(q * 52f); dy = amp * .7f * cos(q * 43f) }
        }
        // Entrances: 4 dp for 200 ms at a level 1 drop; 12 dp for 340 ms after a level 2 slam's 110 ms hit-stop.
        if (hit == null) items.firstOrNull { it.kind == Fx.ARRIVE && it.entrance > 0 && it.p(t) in 0f..1f }?.let { e ->
            val ms = (t - e.t0).toFloat()
            val (start, span, amp0) = if (e.entrance == 1) Triple(650f, 200f, 4f) else Triple(E2_SLAM + 150f + 110f, 340f, 12f)
            val q = (ms - start) / span
            if (q in 0f..1f) { val amp = amp0 * (1f - q) * (1f - q); dx = amp * sin(q * 46f); dy = amp * .7f * cos(q * 39f) }
        }
        // P1: the punches' own jolts; the stronger shake and the deeper push-in win (never weaker than today's).
        val (jx, jy, jz) = joltAt(jolts, t)
        if (jx * jx + jy * jy > dx * dx + dy * dy) { dx = jx; dy = jy }
        zoom = maxOf(zoom, jz)
        with(scope) { translationX = dx * density; translationY = dy * density; scaleX = zoom; scaleY = zoom }
    }
    /** Haptics at each beat's contact: light on a block, medium on a clash, heavy on a face hit. Set by FxDriver. */
    internal var onImpact: ((String) -> Unit)? = null
    private val felt = HashSet<FxItem>()
    private val byCard = HashMap<Int, MutableList<FxItem>>()
    private var prev: MatchState? = null
    private var focalEnd = 0L
    private var started = false

    /** Match punch P1: the live particles (on the one FxLayer canvas) and the board's jolts in flight. */
    internal val bits = Particles()
    internal val jolts = ArrayList<Jolt>()
    /** One of your questions is open: freezes are dropped (a prompt never waits on a freeze). Set by FxDriver. */
    internal var promptWaiting = false
    private var wall = -1L; private var frozenTo = -1L; private var held = 0L

    /** The FxLayer's top left in root pixels (set by FxLayer): root positions less this are the canvas's own. */
    internal var origin = Offset.Zero
    /** The board being shown (set by FxDriver): a punch reads a card's colour from it, never an outcome. */
    internal var board: MatchState? = null
    private val fired = LinkedHashSet<Long>()
    /** True the first time [bit] is asked for under [key] (a travel leg's key): a burst is thrown once, whatever the frame rate. */
    internal fun once(key: Long, bit: Int): Boolean {
        val added = fired.add(key * 4099L + bit)
        if (added && fired.size > 512) fired.iterator().let { it.next(); it.remove() }
        return added
    }
    /** How far into its leg a travel is (ms): the frame-by-frame tests' fixed clock, else real time since it started. */
    internal fun travelMs(m: dev.cardstashy.nativeplay.match.TravelMoment): Long =
        TravelClock.fixed?.let { (it * m.travel.ms).toLong() } ?: (android.os.SystemClock.elapsedRealtime() - m.startedAt)

    /**
     * P2, Charge and Burst: the stack card's size while [cardId]'s cast pays and bursts. Each streak that arrives swells it 4 %
     * (easing back over 160 ms); the burst swells it 8 % after its freeze. 1 otherwise, and with reduce motion.
     */
    internal fun stackSwell(cardId: Int?): Float {
        now.longValue // a frame's read, so the layer follows the clock
        val m = travel ?: return 1f
        if (reduced || cardId == null || m.travel.cardId != cardId) return 1f
        val el = travelMs(m); val D = dev.cardstashy.nativeplay.match.Director
        fun out(ms: Long, span: Long): Float = if (ms < 0 || ms > span) 0f else (1f - ms.toFloat() / span).let { it * it * it }
        return when (m.travel.leg) {
            dev.cardstashy.nativeplay.match.Director.Leg.TAPS -> 1f + .04f * ((0 until m.travel.taps.size + m.travel.pool).maxOfOrNull { out(el - D.streakArrives(it), D.CHARGE_MS) } ?: 0f)
            dev.cardstashy.nativeplay.match.Director.Leg.REST -> 1f + .08f * m.travel.power * out(el - D.BURST_FREEZE_MS, D.BURST_MS - D.BURST_FREEZE_MS)
            else -> 1f
        }
    }

    /** P4: your drawn card [id] is still on its way (its own picture flies in): its hand card stays clear until it tucks in. */
    internal fun drawHides(id: Int): Boolean {
        val t = now.longValue
        return !reduced && items.any { it.kind == Fx.DRAW && it.card == id && it.ghost != null && !it.done(t) }
    }

    /** P1: a payoff's short freeze. Pauses the effect clock only (effects, particles, jolts); input and the bridge run on. */
    fun freeze(ms: Long) {
        if (reduced || promptWaiting || ms <= 0L || wall < 0L) return
        frozenTo = maxOf(frozenTo, wall + ms)
    }

    /** P1: the board shakes [ampDp] (damped over [ms]) and pushes in by [push]; the board box only. None with reduce motion. */
    fun jolt(ampDp: Float, ms: Long, push: Float = 0f) {
        if (reduced) return
        jolts += Jolt(now.longValue, ampDp, ms, push)
    }

    /** The effect clock for the frame at [wallMs]: the frame clock less the time spent frozen. */
    internal fun effectClock(wallMs: Long): Long {
        if (wall >= 0L && frozenTo > wall) held += (minOf(wallMs, frozenTo) - wall).coerceAtLeast(0L)
        wall = wallMs
        return wallMs - held
    }

    internal fun tick(wallMs: Long) {
        val ms = effectClock(wallMs)
        if (jolts.isNotEmpty()) jolts.removeAll { ms - it.t0 > it.ms }
        if (!started) { started = true; if (items.isNotEmpty()) { val base = ms; items.forEach { it.t0 += base }; focalEnd += base } }
        now.longValue = ms
        onImpact?.let { feel -> for (it in items) if (it !in felt) {
            val kind = when {
                it.kind == Fx.BLOCK && it.p(ms) >= .1f -> "light"
                it.kind == Fx.LUNGE && ms - it.t0 >= Strike.hit(Strike.face(it)) -> if (Strike.face(it)) "heavy" else "medium"
                // A landing is felt: light for a land, medium for anything else (a rare's drop and a commander's slam have their own below).
                it.kind == Fx.IMPACT && it.entrance <= 0 && ms >= it.t0 -> if (it.land) "light" else "medium"
                it.kind == Fx.HEAVY && it.p(ms) * it.baseMs >= TableFeel.HEAVY_DROP_MS -> "heavy"
                it.kind == Fx.ARRIVE && it.entrance == 1 && it.p(ms) * it.dur >= 650f -> "light"
                it.kind == Fx.ARRIVE && it.entrance == 2 && it.p(ms) * it.dur >= E2_SLAM + 150f -> "heavy"
                else -> null
            } ?: continue
            felt += it; feel(kind)
        } }
        onCue?.let { cue -> cues(ms, cue); travel?.let { m -> travelCues(m, travelMs(m), cue) } }
        if (items.any { it.done(ms) }) { items.removeAll { it.done(ms) }; felt.retainAll(items.toSet()); heard.keys.retainAll(items.toSet()); reindex() }
    }

    private var legKey = 0L; private var legAt = -1L
    /**
     * The sound pass on a cast's legs ([legCues]): each cue once, on the frame its moment is reached ([el] ms into the leg). A
     * land that pays is felt too (a light tap, yours only).
     */
    internal fun travelCues(m: dev.cardstashy.nativeplay.match.TravelMoment, el: Long, cue: (String, Float, Float) -> Unit) {
        if (m.key != legKey) { legKey = m.key; legAt = -1L }
        if (el <= legAt) return
        for (c in legCues(m.travel)) if (c.at > legAt && c.at <= el) { cue(c.id, c.vol, c.rate); if (c.feel != null) onImpact?.invoke(c.feel) }
        legAt = el
    }
    /** S2: the players whose low-life warning (5 or less) has been given this match. */
    internal val lowSeen = HashSet<Int>()
    /** Tells the table's sound player which cues the effects of the board just read will play themselves (so it does not play them too). */
    internal var onPlan: ((Long, Set<String>) -> Unit)? = null

    /** Sounds on the beats themselves (sounds thread cue map, 4 Nov): set by FxDriver from LocalTableCue. */
    internal var onCue: ((String, Float, Float) -> Unit)? = null
    private val heard = HashMap<FxItem, Int>()

    /** Each cue once per effect, at its frame; one of each id per frame, so six attackers lift with one creak. */
    private fun cues(ms: Long, cue: (String, Float, Float) -> Unit) {
        val now = LinkedHashMap<String, Pair<Float, Float>>()
        for (it in items) {
            val p = it.p(ms); if (p < 0f) continue
            fun once(bit: Int, at: Float, id: String, vol: Float, rate: Float = 1f) {
                val got = heard[it] ?: 0
                if (got and bit == 0 && p >= at) { heard[it] = got or bit; if (id !in now) now[id] = vol to rate }
            }
            // The sound pass: an effect that carries its own cue plays it once on its contact frame.
            it.sound?.let { s -> val got = heard[it] ?: 0
                if (got and 128 == 0 && ms - it.t0 >= it.soundAt) { heard[it] = got or 128; if (s !in now) now[s] = it.soundVol to it.soundRate } }
            when (it.kind) {
                // At the stamp's slam, the shield ring 40 ms behind it.
                Fx.BLOCK -> { once(1, .2f, "CMB-021", 1f); once(2, .2f + 40f / it.dur, "CMB-016", .5f) }
                // The contact frame: CMB-022 carries its own 110 ms hit-stop gap, matching the visual freeze.
                // The sound pass: the dive as the pull-back ends, then the hit on contact (5 or more to a player is the big one).
                Fx.LUNGE -> { val face = Strike.face(it); once(4, Strike.wind(face) / it.dur, "attack_go", 1f)
                    once(1, Strike.hit(face) / it.dur, if (!face) "CMB-022" else if (it.points >= 5) "face_hit_big" else "CMB-023", 1f) }
                // Lower for bigger numbers.
                Fx.DAMAGE -> { val n = it.label.filter(Char::isDigit).toIntOrNull() ?: 1; once(1, 0f, "CMB-006", .6f, (1.04f - .04f * n).coerceIn(.75f, 1f))
                    // Director step 3: a spell or ability's damage sounds its streak on the frame the number lands (combat has the clash).
                    if (it.side == 0) once(2, 0f, "CMB-018", .8f) }
                // A life loss outside a clash (a burn to the face) on the frame the orb takes it.
                Fx.LIFE -> if (it.level == 3 && items.none { l -> l.kind == Fx.LUNGE && l.toKey == it.toKey }) once(1, 0f, "CMB-018", if (it.power >= .8f) 1f else .8f)
                // Counters: on the pop.
                Fx.COUNTER -> once(1, 0f, "CARD-027", .7f)
                // A death: on the white flash after the 260 ms shake; a non-creature to the graveyard softer.
                Fx.DEATH -> if (it.toKey != null || it.ghost?.token == true) once(1, if (it.dur == DEATH_MS) .54f else .38f, if (it.ghost?.isCreature == true) "CMB-009" else "CARD-018", 1f)
                else -> {}
            }
        }
        for ((id, v) in now) cue(id, v.first, v.second)
    }

    /** A touch on the board: every effect jumps to its end state (spec: "tap = next action"). */
    fun skip() {
        dev.cardstashy.nativeplay.match.CombatPace.release()
        bits.clear(); jolts.clear(); frozenTo = -1L
        if (items.isEmpty()) return
        items.clear(); focalEnd = now.longValue; reindex()
    }

    /** Staged combat's pairs in flight, so every card can dim while one pair plays out. */
    private var stages: List<FxItem> = emptyList()
    /** The attackers of the strikes in flight (empty with Match effects off): the table lifts them above everything on it. */
    internal val strikers = androidx.compose.runtime.mutableStateOf<Set<Int>>(emptySet())
    internal fun reindex() {
        byCard.clear()
        for (it in items) it.card?.let { id -> byCard.getOrPut(id) { mutableListOf() } += it }
        stages = items.filter { it.kind == Fx.STAGE }
        spots = items.filter { it.kind == Fx.ARRIVE && it.entrance == 2 }
        impacts = items.filter { it.kind == Fx.IMPACT }
        heavies = items.filter { it.kind == Fx.HEAVY }
        val down = heavies.mapNotNull { it.card }.toSet()
        if (down != landers.value) landers.value = down
        struck = items.filter { it.kind == Fx.LUNGE && it.toKey?.startsWith("c") == true }
        // F6 (design review): the cards in a strike are drawn above the seat panels and the lands for the whole strike.
        val up = if (TableFeel.mode() == TableFeel.Mode.OFF) emptySet() else items.filter { it.kind == Fx.LUNGE }.mapNotNull { it.card }.toSet()
        if (up != strikers.value) strikers.value = up
        rev.intValue++
    }

    private var spots: List<FxItem> = emptyList()
    private var impacts: List<FxItem> = emptyList()
    /** F3: the heavy landings in flight; their cards are drawn over their row while they drop. */
    private var heavies: List<FxItem> = emptyList()
    internal val landers = androidx.compose.runtime.mutableStateOf<Set<Int>>(emptySet())
    /** F7: when the table's last blow reached each seat (effect clock ms; in the future while the strike is in flight). */
    private val seatHit = HashMap<Int, Long>()
    /** F7: how much of each player's orb is left to see (0: broken off the table; a draw dims both). Players not in it are whole. */
    internal val orbs = androidx.compose.runtime.mutableStateOf<Map<Int, Float>>(emptyMap())
    internal fun landsHeavy(card: Int?): Boolean = card != null && heavies.any { it.card == card }
    /** F3: what the heavy landings left on the mat this turn (root pixels), drawn under the cards by [LandMarks]. */
    internal val landMarks = mutableStateListOf<LandMark>()
    /** F3: the other cards of the player whose creature landed heavy hop (tiles [TableFeel.HOP_TILE] dp). */
    private fun GraphicsLayerScope.hop(id: Int) {
        val t = now.longValue
        for (it in heavies) { if (id !in it.ids) continue
            val p = it.p(t); if (p < 0f) continue
            translationY -= TableFeel.hopLift(p * it.baseMs - TableFeel.HEAVY_DROP_MS) * TableFeel.HOP_TILE.dp.toPx() }
    }
    /** F3: how far your hand's cards hop now (dp), when a creature of yours has just landed heavy. */
    internal fun handHop(): Float {
        rev.intValue
        if (heavies.isEmpty() || reduced) return 0f
        val t = now.longValue
        return heavies.filter { it.mine }.maxOfOrNull { val p = it.p(t); if (p < 0f) 0f else TableFeel.hopLift(p * it.baseMs - TableFeel.HEAVY_DROP_MS) }?.times(TableFeel.HOP_CARD) ?: 0f
    }
    /** P5: the clashes in flight, by what they strike: the struck tile is knocked back 16 dp and springs. */
    private var struck: List<FxItem> = emptyList()
    /** The struck tile [id] is knocked 16 dp along the blow and springs back (420 ms, elastic), tipping a little. */
    private fun GraphicsLayerScope.knock(id: Int, anchors: Anchors?, t: Long) {
        val key = "c$id"
        for (s in struck) {
            if (s.toKey != key) continue
            val ms = t - s.t0 - Strike.after(false); if (ms < 0f || ms > 420f) continue
            val a = anchors?.rects?.get("c${s.card}") ?: continue; val b = anchors.rects[key] ?: continue
            val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y; val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f)
            val k = 1f - elasticOut(ms / 420f)
            translationX = dx / dist * 16.dp.toPx() * k; translationY = dy / dist * 16.dp.toPx() * k; rotationZ = (if (dx >= 0f) 2.9f else -2.9f) * k
        }
    }
    /** How far an attacking tile stands toward the other side (px; set by the table), so its declare ring sits where it stands. */
    internal var advancePx = 0f

    /** P6, Aim: a target thread has just locked on [toKey] ("c<id>" or "orb<id>"), in its caster's colour [tone]. */
    internal fun aimLock(toKey: String, tone: Color) {
        if (reduced || Motion.still) return
        items += FxItem(Fx.AIM, 1, AIM_MS, card = toKey.takeIf { it.startsWith("c") }?.drop(1)?.toIntOrNull(), toKey = toKey, tone = tone).sounds("target_lock").also { it.t0 = now.longValue }
        reindex()
    }
    /** A loss of [player]'s is still in flight (so the pill waits for it). */
    internal fun lifePending(player: Int) = items.any { it.kind == Fx.LIFE && it.player == player && it.points > 0 }
    /** P5: the life [player]'s pill shows now. Each loss in flight comes off one point at a time from its contact ([lifeGap]). */
    internal fun lifeShown(player: Int, life: Int): Int {
        val t = now.longValue; var back = 0
        for (it in items) if (it.kind == Fx.LIFE && it.player == player && it.points > 0) {
            val done = if (t < it.t0) 0 else minOf(it.points, ((t - it.t0) / lifeGap(it.points)).toInt() + 1)
            back += it.points - done
        }
        return life + back
    }

    /**
     * P3, follow-through: the tiles beside a landing rock away from it and spring back (620 ms). Side by side at full width they
     * are pushed 10 dp; squeezed or overlapping they only lean. Other rows never move.
     */
    private fun GraphicsLayerScope.rock(id: Int, anchors: Anchors?) {
        val t = now.longValue
        for (it in impacts) {
            if (it.card == id) continue
            val p = it.p(t); if (p < 0f) continue
            val a = anchors?.rects?.get("c${it.card}") ?: continue; val b = anchors.rects["c$id"] ?: continue
            if (kotlin.math.abs(a.center.y - b.center.y) > a.height * .5f) continue
            val dx = b.center.x - a.center.x
            if (kotlin.math.abs(dx) > a.width * 1.9f || kotlin.math.abs(dx) < 1f) continue
            val k = 1f - elasticOut((p * it.dur / 620f).coerceAtMost(1f)); val dir = if (dx > 0) 1f else -1f
            if (kotlin.math.abs(dx) >= (a.width + b.width) / 2 * .98f) translationX += dir * 10.dp.toPx() * k
            rotationZ += dir * 2.9f * k
        }
    }

    /** A level 2 entrance: every other card on the table dims to 26 % (250 ms in, back out after the slam). */
    private fun GraphicsLayerScope.spotDim(id: Int) {
        val t = now.longValue
        val on = spots.firstOrNull { t >= it.t0 && !it.done(t) } ?: return
        if (id == on.card) return
        val ms = (t - on.t0).toFloat()
        val k = minOf(smooth(0f, 250f, ms), 1f - smooth(E2_SLAM + 150f + 110f, E2_SLAM + 150f + 360f, ms))
        alpha = minOf(alpha, 1f - .74f * k)
    }

    /** The arriving card's own motion for a level 1 or 2 entrance (table additions 3). Times are the spec's, in ms from the start. */
    private fun entranceMove(scope: GraphicsLayerScope, it: FxItem, p: Float, slot: Rect?, src: Offset?) = with(scope) {
        val ms = p * it.dur
        if (slot == null) { alpha = smooth(0f, 120f, ms); return@with }
        if (it.entrance == 1) {
            // Travel 380 ms to 46 dp above the slot, hold 140 ms, drop 130 ms ease-in.
            val above = Offset(slot.center.x, slot.center.y - 46.dp.toPx())
            val from = src ?: above
            val at = when {
                ms < 380f -> { val e = 1f - (1f - ms / 380f).let { x -> x * x * x }; lerpO(from, above, e) }
                ms < 520f -> above
                ms < 650f -> { val q = (ms - 520f) / 130f; lerpO(above, slot.center, q * q) }
                else -> slot.center
            }
            translationX = at.x - slot.center.x; translationY = at.y - slot.center.y
            val s = if (ms < 380f) .72f + .28f * (ms / 380f) else if (ms < 650f) 1.04f else 1f
            scaleX = s; scaleY = s
            alpha = if (src == null) smooth(0f, 120f, ms) else (ms / 54f).coerceIn(0f, 1f)
        } else {
            // Fly to the table's centre at 2.3x (520 ms), hold to 1570 ms, slam to the slot in 150 ms ease-in.
            val centre = stageCentre ?: slot.center
            val from = src ?: slot.center
            val (at, s) = when {
                ms < 520f -> { val e = 1f - (1f - ms / 520f).let { x -> x * x * x }; lerpO(from, centre, e) to (.8f + 1.5f * e) }
                ms < E2_SLAM -> centre to 2.3f
                ms < E2_SLAM + 150f -> { val q = (ms - E2_SLAM) / 150f; lerpO(centre, slot.center, q * q) to (2.3f - 1.3f * q * q) }
                else -> slot.center to 1f
            }
            translationX = at.x - slot.center.x; translationY = at.y - slot.center.y
            scaleX = s; scaleY = s
            alpha = smooth(0f, 90f, ms)
        }
    }

    /** Staged combat: a card outside the pair playing now sits at half light (faded in and out over 150 ms). */
    private fun GraphicsLayerScope.dim(id: Int) {
        val t = now.longValue
        val first = stages.minOf { it.t0 }; val last = stages.maxOf { it.t0 + it.dur }
        if (t < first || t > last) return
        val on = stages.lastOrNull { it.t0 <= t } ?: return
        if (id in on.ids) return
        val fade = minOf(1f, (t - first) / 150f, (last - t) / 150f)
        alpha = 1f - .5f * fade
    }

    private var lastMoment = 0L
    /** Cards a trigger's result lands on (and its tokens), until when: the snapshot diff leaves their counter and token effects to it. */
    private val claimed = HashMap<Int, Long>()

    /**
     * A TRIGGER SHOWS ITSELF (sTrig, approved 10 Nov): the controller's beat [m] becomes effects. SOURCE: the card lifts and rings in
     * the caster's colour (coral CPU, gold you). RESULT: on each card the result changed, a streak from the source, a flash, the
     * change rising, the counter chip's 320 ms pop and the trail line; its tokens arrive from the source. Each beat once (its key).
     */
    fun trigger(m: dev.cardstashy.nativeplay.match.TriggerMoment?, st: MatchState, anchors: Anchors?, force: Boolean = false) {
        if (m == null || (m.key == lastMoment && !force)) return
        lastMoment = m.key
        if ((Motion.still && !force) || anchors == null) return
        val t = now.longValue
        val caster = if (m.yours) TRIG_GOLD else TRIG_CORAL
        fun add(it: FxItem) { it.dur = it.baseMs; it.t0 = t + it.delay; items += it }
        when (m.phase) {
            dev.cardstashy.nativeplay.match.TriggerMoment.Phase.SOURCE -> m.sourceId?.let { id ->
                add(FxItem(Fx.TRIG_SOURCE, 2, TRIG_SOURCE_MS, card = id, mine = st.me.battlefield.any { it.id == id }, tone = caster))
            }
            dev.cardstashy.nativeplay.match.TriggerMoment.Phase.STACK -> {}
            dev.cardstashy.nativeplay.match.TriggerMoment.Phase.RESULT -> {
                val r = m.result ?: return
                val from = r.sourceId?.let { "c$it" }?.takeIf { anchors.rects.containsKey(it) } ?: "stackcard"
                val until = t + 3000
                r.changed.forEachIndexed { i, id ->
                    val (label, chip, up) = landing(r, id)
                    add(FxItem(Fx.TRIG_LAND, 2, TRIG_LAND_MS, card = id, fromKey = from, toKey = "c$id", tone = if (up) TRIG_GREEN else TRIG_CORAL, label = label,
                        title = chip ?: "", caster = caster, note = if (i == 0) m.line.orEmpty() else "", delay = i * 120L))
                    claimed[id] = until
                }
                // Tokens arrive with a level 0 entrance from the source's position.
                r.tokens.forEachIndexed { i, tok ->
                    add(FxItem(Fx.ARRIVE, 1, 450, card = tok.id, mine = st.me.battlefield.any { it.id == tok.id }, fromKey = from, tone = caster, delay = i * 90L))
                    claimed[tok.id] = until
                }
                // Damage or life from it: the streak runs to the card or the player it hit (the number itself comes with the board).
                val hit = r.damage.map { (ref, _) -> if (ref.kind == "player") "orb${ref.id}" else "c${ref.id}" } + r.life.map { "orb${it.player}" }
                hit.distinct().forEachIndexed { i, key -> add(FxItem(Fx.TRIG_LAND, 2, TRIG_LAND_MS, fromKey = from, toKey = key, tone = caster, caster = caster,
                    note = if (r.changed.isEmpty() && i == 0) m.line.orEmpty() else "", delay = i * 120L)) }
                if (r.changed.isEmpty() && r.tokens.isNotEmpty() && hit.isEmpty() && m.line != null) r.tokens.firstOrNull()?.let { tok ->
                    add(FxItem(Fx.TRIG_LAND, 1, TRIG_LAND_MS, fromKey = from, toKey = "c${tok.id}", tone = caster, caster = caster, note = m.line)) }
                items.removeAll { (it.kind == Fx.COUNTER || it.kind == Fx.TOKEN) && it.card != null && it.card in claimed }
            }
        }
        reindex()
    }

    /** Reads the new snapshot against the last one and queues what changed. */
    fun take(st: MatchState, anchors: Anchors?) {
        val before = prev
        prev = st
        if (before == null || Motion.still || anchors == null) return
        if (st.revision <= before.revision && st.revision != 0L) return
        if (st.players.map { it.id } != before.players.map { it.id }) return
        val t = now.longValue
        // F3: the marks of the turn that ended leave the mat.
        if (st.turn != before.turn) { landMarks.forEach { if (it.gone < 0L) it.gone = t }; landMarks.removeAll { it.gone >= 0L && t - it.gone > TableFeel.MARK_OUT_MS && it.gone != t } }
        val yours = st.waitingOnMe
        if (yours) {
            // Priority or a question (match director, section 6): nothing is cut short or dropped any more. What is in flight
            // finishes at no less than its floor, so the CPU's last action is always readable before you answer it.
            for (it in items) { val left = it.t0 + it.dur - t; val floor = minOf(it.baseMs * 6 / 10, it.dur); if (it.t0 <= t && left > floor && it.level < 2) { it.p0 = it.p(t); it.t0 = t; it.dur = floor } }
        }
        val groups = diff(before, st, anchors)
        onPlan?.invoke(st.revision, groups.flatMap { g -> g.mapNotNull { it.sound } }.toSet())
        if (groups.isEmpty()) { if (yours) reindex(); return }
        var cursor = maxOf(t, focalEnd)
        var stagedEnd = 0L
        for (g in groups) {
            val focal = g.any { it.level >= 2 }
            // Staged combat keeps its own pace (one attacker at a time, about 1.4 s each): the table waits for it instead.
            val staged = g.any { it.kind == Fx.STAGE }
            for (it in g) {
                // Focal effects keep their full length; only when more than 6 s are queued does a non-focal one play at its floor.
                it.dur = it.baseMs
                if (cursor - t > 6000 && !staged && it.level < 2) it.dur = it.baseMs * 6 / 10
                it.t0 = cursor + it.delay
                // F7: when the table's own blow reaches a seat (a strike's contact, a face hit's start), for the winning hit to know.
                it.toKey?.takeIf { k -> k.startsWith("orb") }?.removePrefix("orb")?.toIntOrNull()?.let { seat ->
                    if (it.kind == Fx.LUNGE) seatHit[seat] = it.t0 + Strike.after(true).toLong() else if (it.kind == Fx.LIFE && it.level == 3) seatHit[seat] = maxOf(seatHit[seat] ?: 0L, it.t0) }
                // F7 starts at the hit still in flight, else as soon as the finished board is shown; the result card waits for it.
                if (it.kind == Fx.WIN && it.player != null) { it.t0 = maxOf(t, seatHit[it.player] ?: 0L); TableFeel.resultWait = st.revision to (it.t0 - t) + TableFeel.resultHold() }
                items += it
            }
            if (staged) stagedEnd = maxOf(stagedEnd, g.maxOf { it.t0 + it.dur })
            if (focal) cursor += g.filter { it.level >= 2 }.maxOf { it.delay + it.dur }
        }
        if (stagedEnd > t) dev.cardstashy.nativeplay.match.CombatPace.hold(stagedEnd - t)
        focalEnd = maxOf(focalEnd, cursor)
        // Never more than 6 thread-like effects at once (spec: max 6 threads).
        val threads = items.filter { it.kind == Fx.BLOCK || it.kind == Fx.CAST || (it.kind == Fx.RESOLVE && it.toKey != null) }
        if (threads.size > 6) items.removeAll(threads.drop(6).toSet())
        reindex()
    }

    /** Commanders that have had their level 2 entrance this match (a recast uses level 1). */
    private val commandersShown = HashSet<String>()
    /** The table's centre in root coordinates, where a level 2 entrance holds. Set by FxLayer. */
    internal var stageCentre: Offset? = null

    /**
     * Table additions 3: level 2 for a commander entering from the command zone (once per commander per match; with a prompt
     * waiting it drops to its floor, the slam without the centre hold, which is level 1), level 1 for a rare or mythic
     * (rarity from the card facts the app already has), level 0 for everything else. Effects set to Minimal: always 0.
     */
    internal fun entranceLevel(c: Card, fromZone: Boolean, waiting: Boolean): Int {
        if (low || c.token) return 0
        if (c.commander && fromZone) {
            if (!waiting && commandersShown.add(c.name)) return 2
            return 1
        }
        return when (dev.cardstashy.nativeplay.art.CardArt.rarity(c.name)) { "rare", "mythic", "special", "bonus" -> 1; else -> 0 }
    }

    /** Mobile table M10: who is looking at this table (set from each board), so a hit knows whether it is you who is hit. */
    internal var viewerId: Int? = null
    private fun diff(a: MatchState, b: MatchState, anchors: Anchors): List<List<FxItem>> {
        val viewer = b.viewer
        viewerId = viewer
        val tNow = now.longValue
        claimed.values.removeAll { it < tNow }
        val claimedNow = claimed.keys.toSet()
        val bfA = a.players.flatMap { it.battlefield }.associateBy { it.id }
        val bfB = b.players.flatMap { it.battlefield }.associateBy { it.id }
        val handA = a.me.hand.map { it.id }.toSet()
        val stackSrcA = a.stack.mapNotNull { it.source?.id }.toSet()
        val stackRect = anchors.rects["stackcard"]

        val draws = mutableListOf<FxItem>(); val casts = mutableListOf<FxItem>(); val resolves = mutableListOf<FxItem>()
        val arrivals = mutableListOf<FxItem>(); val combat = mutableListOf<FxItem>(); val hits = mutableListOf<FxItem>()
        val deaths = mutableListOf<FxItem>(); val counters = mutableListOf<FxItem>()
        // F7: the finished board has arrived. The loser's orb breaks (or, in a draw, both dim); it waits its turn behind the last strike.
        val ends = mutableListOf<FxItem>()
        val nowMs = now.longValue
        if (!reduced) TableFeel.ending(a, b, struck = seatHit.filterValues { it >= nowMs - TableFeel.WIN_STRUCK_MS }.keys)?.let { e -> val look = TableFeel.profile(TableFeel.mat)
            ends += FxItem(Fx.WIN, 2, TableFeel.WIN_HOLD_MS, player = e.loser, mine = e.winner == viewer, toKey = e.loser?.let { "orb$it" }, tone = look.win, caster = look.winHi, ids = b.players.map { it.id }.toSet()) }

        // Draw (level 1, 350 ms): a card slides off the library into the hand.
        val drawn = b.me.hand.filter { it.id !in handA && it.id !in bfA && it.id !in stackSrcA && a.players.none { p -> p.graveyard.any { g -> g.id == it.id } } }
        // Match punch P4: a new turn's draw waits for the banner (380 ms in); the untap ripple starts at 140, each tile 50 ms apart.
        val newTurn = a.turn != b.turn
        val lead = if (newTurn) DRAW_AT_MS else 0L
        // P4, your draw (up to three; an opening hand keeps the quick slide): the card itself lifts off your deck (90), flips while
        // it flies to a spot above the hand at 1.6 (320), holds there in an ice ring (380) and tucks in as the hand spreads (260).
        // On two screens the hand is below: it leaves through the top screen's bottom edge and the bottom screen shows it.
        if (drawn.size <= 3 && !DualScreen.active && !reduced) drawn.forEachIndexed { i, c ->
            draws += FxItem(Fx.DRAW, 1, MY_DRAW_MS, card = c.id, player = viewer, mine = true, fromKey = "lib$viewer", toKey = "hand${c.id}", ghost = c, delay = lead + i * 150L).sounds("CARD-001") }
        // (A whole new hand is dealt by the fan with its own sound; a card or two that slide in sound once.)
        else drawn.take(3).forEachIndexed { i, _ -> draws += FxItem(Fx.DRAW, 1, 350, player = viewer, mine = true, fromKey = "lib$viewer", toKey = "hand", delay = lead + i * 90L)
            .also { if (i == 0 && drawn.size <= 4) it.sounds("CARD-001") } }
        // The living table F1: a readied land flashes in its own colour (70 %, 240 ms) on the same ripple; Off keeps P4's gold glint.
        val landFlash = if (TableFeel.mode() == TableFeel.Mode.OFF) emptyMap() else TableFeel.turnChange(a, b)?.flashes.orEmpty().associateBy { it.card }
        if (newTurn) untapOrder(a, b).forEachIndexed { i, id -> val f = landFlash[id]
            draws += FxItem(Fx.GLINT, 1, f?.let { TableFeel.UNTAP_FLASH_MS } ?: 260, card = id, tone = f?.tone ?: Color(0xFFF3D27E), delay = UNTAP_AT_MS + i * UNTAP_GAP_MS, power = if (f != null) TableFeel.UNTAP_FLASH else 0f)
            .also { if (i == 0) it.sounds("untap") } }
        for (p in b.players) if (!p.isViewer && p.id != viewer) {
            val q = a.players.firstOrNull { it.id == p.id } ?: continue
            // P4, the CPU's draw: a card back, 90 lift + 300, no hold.
            if (p.handCount > q.handCount && p.libraryCount < q.libraryCount) draws += FxItem(Fx.DRAW, 1, 390, player = p.id, fromKey = "lib${p.id}", toKey = "cpuhand", delay = lead).sounds("CARD-002", vol = .5f)
        }

        // Cast (level 2, 450 ms): the card lifts out of the hand to the stack; an ability starts at its permanent.
        val idsA = a.stack.map { it.id }.toSet()
        for (s in b.stack.reversed()) if (s.id !in idsA) {
            val mine = s.controller == viewer
            val src = s.source?.id
            val from = when {
                s.ability && src != null -> "c$src"
                mine -> "hand"
                else -> "cpuhand"
            }
            // 0.4.59 T5: a spell, yours or the CPU's, is the card itself flying to the stack (TravelCard); only abilities keep the light thread.
            if (!s.ability) continue
            casts += FxItem(Fx.CAST, 2, 450, card = null, mine = mine, fromKey = from, toKey = "stackcard", tone = if (mine) Color(0xFFF3D27E) else Color(0xFFFF8A5C))
        }
        // Resolve (level 2, 300 ms): the stack card ripples; a spell with targets sends its light to them.
        val idsB = b.stack.map { it.id }.toSet()
        /** P6: the cards a resolving spell struck, and when (ms into the resolve): one it killed breaks there, not after everything else. */
        val boltAt = HashMap<Int, Long>()
        for (s in a.stack) if (s.id !in idsB) {
            val src = s.source?.id
            val becomesPermanent = src != null && src in bfB && src !in bfA
            // P6: a spell with targets fires at them (abilities and triggers keep the light thread and their own beats).
            val aimed = if (becomesPermanent || s.ability || s.trigger) emptyList() else s.targets.filter { r -> r.kind == "player" || r.id in bfA }.take(4)
            val card = s.source
            val owner = card?.let { c -> b.players.firstOrNull { p -> p.graveyard.any { it.id == c.id } }?.id }
            if (aimed.isNotEmpty()) {
                // Friendly: everything it targets is its caster's own. Then no shake, no freeze, green light.
                val friendly = aimed.all { r -> if (r.kind == "player") r.id == s.controller else bfA[r.id]?.controller == s.controller }
                val tone = if (friendly) TRIG_GREEN else card?.let { frameTone(cardColors(it)).first } ?: Color(0xFFFF8A5C)
                aimed.forEachIndexed { i, r ->
                    val key = if (r.kind == "player") "orb${r.id}" else "c${r.id}"
                    resolves += FxItem(Fx.FIRE, 2, FIRE_MS, mine = s.controller == viewer, from = stackRect, toKey = key, tone = tone).also { it.lead = i == 0; if (i == 0) it.sounds("bolt") }
                    if (r.kind != "player") { boltAt[r.id] = FIRE_MS
                        resolves += FxItem(Fx.BOLT, 1, BOLT_MS, card = r.id, mine = bfA[r.id]?.controller == viewer, from = anchors.rects[key], fromKey = "stackcard", tone = tone, power = if (friendly) 0f else 1f, delay = FIRE_MS)
                            // The impact: the hit for burn and removal, the soft resolve for a spell on its caster's own card.
                            .sounds(if (friendly) "resolve" else "CMB-018") }
                }
            }
            // The spent spell goes to its owner's square (Forge put it in that graveyard), 160 after the impact when it fired.
            if (!becomesPermanent && !s.ability && !s.trigger && card != null && owner != null && stackRect != null)
                resolves += FxItem(Fx.SPENT, 1, SPENT_MS, mine = owner == viewer, from = stackRect, toKey = "grave$owner", ghost = card, delay = if (aimed.isNotEmpty()) FIRE_MS + 160L else 0L)
                    .sounds("CARD-018", at = SPENT_MS - 60L) // as it reaches the pile
            if (aimed.isNotEmpty()) continue
            val target = s.targets.firstOrNull()?.let { r -> if (r.kind == "player") "orb${r.id}" else "c${r.id}" }
            resolves += FxItem(Fx.RESOLVE, if (becomesPermanent) 1 else 2, if (becomesPermanent) 220 else 320, mine = s.controller == viewer, from = stackRect,
                toKey = if (becomesPermanent) null else target, tone = if (s.controller == viewer) Color(0xFFF3D27E) else Color(0xFFFF8A5C))
                // A spell with no landing leaves the stack with its own sound (abilities and triggers have theirs on their beats).
                .also { if (!becomesPermanent && !s.ability && !s.trigger) it.sounds("resolve") }
        }

        // Arrivals: travel on an arc to the real slot, land with a 2 % squash and a light sweep (450 ms); tokens form from light (400 ms).
        for ((id, c) in bfB) if (id !in bfA) {
            if (c.token && id in claimedNow) continue
            if (c.token && id !in stackSrcA) { arrivals += FxItem(Fx.TOKEN, 1, 400, card = id, mine = c.controller == viewer,
                delay = runCatching { dev.cardstashy.nativeplay.art.CardArt.holdFor(c.name) }.getOrDefault(0L)).sounds("token"); continue }
            val fromStack = id in stackSrcA
            val fromHand = id in handA
            val key = when { fromStack -> null; fromHand -> "hand"; c.controller != viewer && !c.token -> "cpuhand"; else -> null }
            val tone = cardColors(c)?.firstOrNull()?.let { MANA_GLOW[it] } ?: Color(0xFFE8D7A8)
            val fromCommand = a.players.any { p -> p.command.any { it.id == id } }
            val lvl = entranceLevel(c, fromStack || fromCommand, waiting = b.waitingOnMe)
            val mine = c.controller == viewer
            // F3: a creature of power 5 or more lands heavy (not a commander's own slam, which is bigger). Its drop ends on the landing's frame.
            val heavy = if (reduced || lvl == 2) null else TableFeel.landing(c)
            fun heavyAt(landsAt: Long) = FxItem(Fx.HEAVY, 1, (TableFeel.HEAVY_DROP_MS + TableFeel.HEAVY_AFTER_MS).toLong(), card = id, mine = mine, tone = frameTone(cardColors(c)).first,
                ids = b.players.firstOrNull { it.id == c.controller }?.battlefield.orEmpty().map { it.id }.filter { it != id }.toSet(), delay = landsAt - TableFeel.HEAVY_DROP_MS.toLong(), note = heavy?.mark.orEmpty())
            // 0.4.59 T5: a card that travelled here (stack to slot, hand to group) is drawn by TravelCard on its way; its tile stays
            // clear until it lands, then takes the landing squash (level 0) or its entrance from where it landed (levels 1 and 2).
            val came = travel?.travel?.takeIf { !reduced && it.cardId == id && it.leg in TRAVEL_LANDS }
            if (came != null) {
                // P3: the travelled card lands with its impact. A creature shakes the board 7 dp, anything else 3; a level 1 entrance
                // adds 30 % (at its drop), a level 2 keeps its big entrance and ends with this landing (after its slam).
                val base = if (c.isCreature) 1f else 3f / 7f
                // F3: an ordinary heavy landing waits for the drop (130 ms); a rare's drop already ends at 650.
                val wait = if (heavy != null && lvl == 0) TableFeel.HEAVY_DROP_MS.toLong() else 0L
                arrivals += FxItem(Fx.IMPACT, 1, IMPACT_MS, card = id, mine = mine, tone = tone, land = c.isLand, power = if (lvl == 1) base * 1.3f else base,
                    entrance = if (low) -1 else lvl, delay = came.ms + wait + when (lvl) { 2 -> (E2_SLAM + 150f + 110f).toLong(); 1 -> 650L; else -> 0L }).sounds(landingCue(c))
                arrivals += when (lvl) {
                    2 -> FxItem(Fx.ARRIVE, 2, ENTRANCE2_MS, card = id, mine = mine, tone = tone, entrance = 2, delay = came.ms,
                        title = c.name + "\n" + (if (mine) "Your commander" else "Their commander"))
                    1 -> FxItem(Fx.ARRIVE, 2, ENTRANCE1_MS, card = id, mine = mine, tone = tone, land = c.isLand, entrance = 1, delay = came.ms)
                    else -> FxItem(Fx.ARRIVE, 1, 135, card = id, mine = mine, tone = tone, land = c.isLand, delay = came.ms).also { it.p0 = .7f }
                }
                if (heavy != null) arrivals += heavyAt(came.ms + wait + (if (lvl == 1) 650L else 0L))
                continue
            }
            arrivals += when (lvl) {
                2 -> FxItem(Fx.ARRIVE, 2, ENTRANCE2_MS, card = id, mine = mine, from = if (fromStack) stackRect else null, fromKey = key, tone = tone,
                    entrance = 2, title = c.name + "\n" + (if (mine) "Your commander" else "Their commander"))
                1 -> FxItem(Fx.ARRIVE, 2, ENTRANCE1_MS, card = id, mine = mine, from = if (fromStack) stackRect else null, fromKey = key, tone = tone, land = c.isLand, entrance = 1)
                else -> FxItem(Fx.ARRIVE, if (fromStack && c.isCreature) 2 else 1, 450, card = id, mine = mine,
                    from = if (fromStack) stackRect else null, fromKey = key, tone = tone, land = c.isLand)
            // The landing's sound on the frame it touches down: after the arc (315 of 450), the drop (650) or the slam.
            }.also { it.sounds(landingCue(c), when (lvl) { 2 -> (E2_SLAM + 150f).toLong(); 1 -> 650L; else -> 315L }) }
            if (heavy != null) arrivals += heavyAt(if (lvl == 1) 650L else 315L)
        }

        // Combat: a new attacker leans in; a new blocker sends a pulse down its thread to the attacker.
        // P5: the new attackers step up one after another (210 each, 95 apart), each with a coral ring.
        declareOrder(a, b).forEachIndexed { i, id -> combat += FxItem(Fx.ATTACK, 1, 300, card = id, mine = bfB[id]?.controller == viewer, tone = TableFeel.declareRim(), delay = i * DECLARE_GAP_MS)
            // Each one that steps up after the first sounds 6 % higher (held from the fifth).
            .sounds("CMB-001", rate = Math.pow(1.06, minOf(i, 4).toDouble()).toFloat()) }
        for ((id, c) in bfB) {
            val o = bfA[id] ?: continue
            // A block is a moment (spec 3, P5): the blocker steps to its attacker, an ice ring flares over it and BLOCKED slams down.
            if (c.blocking && !o.blocking) c.blockingIds.firstOrNull()?.let { at -> combat += FxItem(Fx.BLOCK, 2, BLOCK_MS, card = id, fromKey = "c$id", toKey = "c$at", mine = c.controller == viewer) }
        }

        // Combat damage lands: every attacker pulls back, strikes what it hit (its blocker, else the player) and springs home ([Strike]).
        val lost = b.players.any { p -> a.players.firstOrNull { it.id == p.id }?.let { q -> p.life < q.life } == true }
        val dmgNow = bfB.values.any { c -> (bfA[c.id]?.damage ?: 0) < c.damage }
        var lunged = false
        // Combat damage may arrive in the damage step or, when priority is passed through it, in a later step: even straight to
        // Main 2 (Randall 4 Nov, test 6: no lunge on his board). Either way the attackers strike. A clash that only kills counts too.
        val wasCombat = a.phase?.startsWith("COMBAT") == true || b.phase?.startsWith("COMBAT") == true
        val clashDied = bfA.values.any { it.isCreature && (it.attacking || it.blocking) && it.id !in bfB }
        // Staged (Table spec, 5 Nov: "attacks play out too fast ... can't tell what is hitting and what is blocking"): one attacker
        // at a time in attack order. Each pair dims the rest of the board, joins attacker and blocker (or the player it hits)
        // with a gold line and a glass tag, then the strike, its freeze and the numbers: about 800 ms a clash, 1100 a hit to a face (P5).
        val hitOf = HashMap<Int, Long>()
        val faceOf = HashMap<Int, MutableList<Pair<Long, Int>>>()
        if ((lost || dmgNow || clashDied) && wasCombat && a.turn == b.turn) {
            val said = a.events.lastOrNull { it.type == "attack" && it.attackers.isNotEmpty() }?.attackers?.map { it.first.id }.orEmpty()
            val attackers = bfA.values.filter { it.attacking }.sortedWith(compareBy({ said.indexOf(it.id).let { i -> if (i < 0) Int.MAX_VALUE else i } }, { it.id }))
            var next = 0L
            attackers.forEach { o ->
                val id = o.id; val start = next
                val blockers = bfA.values.filter { it.blocking && id in it.blockingIds }
                val defender = when { o.attackTarget?.kind == "player" -> o.attackTarget.id; else -> b.players.firstOrNull { it.id != o.controller }?.id }
                val to = when {
                    blockers.isNotEmpty() -> "c${blockers.first().id}"
                    o.attackTarget?.kind == "player" -> "orb${o.attackTarget.id}"
                    o.attackTarget != null -> "c${o.attackTarget.id}"
                    else -> defender?.let { "orb$it" }
                } ?: return@forEach
                // The pair is lit and joined for a beat (STAGE_LEAD) before the attacker moves, so who fights whom is read first.
                val face = to.startsWith("orb"); val step = STAGE_LEAD_MS + Strike.ms(face); next += step
                val lands = start + STAGE_LEAD_MS + Strike.after(face).toLong()
                hitOf[id] = lands; blockers.forEach { hitOf[it.id] = lands }
                o.attackTarget?.takeIf { it.kind == "card" && blockers.isEmpty() }?.let { hitOf[it.id] = lands }
                if (blockers.isEmpty() && to.startsWith("orb") && defender != null) faceOf.getOrPut(defender) { mutableListOf() } += lands to (o.power ?: 0).coerceAtLeast(0)
                fun pt(c: Card) = if (c.power != null) " ${c.power}/${c.toughness ?: 0}" else ""
                val tag = when {
                    blockers.isNotEmpty() -> "${o.name}${pt(o)} blocked by " + blockers.joinToString(" and ") { it.name + pt(it) }
                    to.startsWith("orb") -> "${o.name}${pt(o)} unblocked, ${(o.power ?: 0).coerceAtLeast(0)} damage to ${if (defender == viewer) "you" else "CPU"}"
                    else -> "${o.name}${pt(o)} attacks ${o.attackTarget?.let { r -> bfA[r.id]?.name } ?: "a permanent"}"
                }
                hits += FxItem(Fx.STAGE, 2, step, card = null, mine = o.controller == viewer, fromKey = "c$id", toKey = to, label = tag, delay = start,
                    ids = setOf(id) + blockers.map { it.id } + (o.attackTarget?.takeIf { it.kind == "card" }?.id?.let { setOf(it) } ?: emptySet()))
                hits += FxItem(Fx.LUNGE, 2, Strike.ms(face), card = id, mine = o.controller == viewer, toKey = to, tone = TableFeel.chargeTone(o), power = if (face) 1f else .8f, delay = start + STAGE_LEAD_MS)
                    .also { if (face) it.points = (o.power ?: 0).coerceAtLeast(0) }; lunged = true
            }
        }
        val lag = if (lunged) Strike.after(false).toLong() else 0L
        fun hitAt(id: Int) = hitOf[id] ?: lag
        // Damage (level 2, 350 ms): 70 ms hit-stop, the number pops, a 3 px shake. Life totals move with it.
        for ((id, c) in bfB) {
            val o = bfA[id] ?: continue
            if (c.damage > o.damage) hits += FxItem(Fx.DAMAGE, 2, 1100, card = id, tone = Color(0xFFFF5A4A), label = "−${c.damage - o.damage}", delay = hitAt(id),
                side = if (o.attacking) -1 else if (o.blocking) 1 else 0)
            val gained = c.counters.values.sum() - o.counters.values.sum()
            if (gained != 0 && id !in claimedNow) {
                val key = c.counters.entries.firstOrNull { (k, v) -> v != (o.counters[k] ?: 0) }?.key ?: ""
                val n = c.counters.values.sum() - o.counters.values.sum()
                val label = when {
                    key.equals("P1P1", true) -> if (n > 0) "+$n/+$n" else "−${-n}/−${-n}"
                    key.equals("M1M1", true) -> "−${abs(n)}/−${abs(n)}"
                    else -> (if (n > 0) "+$n " else "−${-n} ") + key.lowercase().replace('_', ' ')
                }
                counters += FxItem(Fx.COUNTER, 1, 300, card = id, label = label)
            }
        }
        // A creature that dies in the clash is gone from the new board, so its number comes from what struck it (the power
        // of the creatures it fought); its last picture stays put until the shatter (Ghost), and its old box is still anchored.
        if (lunged) for ((id, o) in bfA) if (id !in bfB && o.isCreature && (o.attacking || o.blocking)) {
            val foes = if (o.attacking) bfA.values.filter { it.blocking && id in it.blockingIds } else bfA.values.filter { it.attacking && it.id in o.blockingIds }
            val n = foes.sumOf { (it.power ?: 0).coerceAtLeast(0) }
            if (n > 0) hits += FxItem(Fx.DAMAGE, 2, 1100, card = id, tone = Color(0xFFFF5A4A), label = "−$n", delay = hitAt(id), side = if (o.attacking) -1 else 1)
        }
        for (p in b.players) {
            val q = a.players.firstOrNull { it.id == p.id } ?: continue
            if (p.life == q.life) continue
            val loss = q.life - p.life
            val faces = faceOf[p.id].orEmpty()
            // Each unblocked attacker takes its own bite at the player's life, in its own beat; what is left over (lifelink,
            // trample, a burn in the same moment) rides the last one.
            if (loss > 0 && lunged && faces.isNotEmpty()) {
                var left = loss
                faces.forEachIndexed { i, (lands, power) ->
                    val n = if (i == faces.lastIndex) left else minOf(power, left); left -= n
                    if (n > 0) hits += FxItem(Fx.LIFE, 3, 950, player = p.id, toKey = "orb${p.id}", delay = lands, power = (n / 6f).coerceIn(.35f, 1f), tone = Color(0xFFFF5A4A)).also { it.label = "−$n"; it.points = n }
                }
                continue
            }
            hits += FxItem(Fx.LIFE, if (p.life < q.life) 3 else 1, if (p.life < q.life) 950 else 700, player = p.id, toKey = "orb${p.id}", delay = if (p.life < q.life) lag else 0L, power = ((q.life - p.life) / 6f).coerceIn(.35f, 1f), tone = if (p.life < q.life) Color(0xFFFF5A4A) else Color(0xFF7BE08A))
                .also { it.label = if (p.life < q.life) "−${q.life - p.life}" else "+${p.life - q.life}"; it.points = (q.life - p.life).coerceAtLeast(0) }
        }

        // Death (P5): the card greys and shudders (240), flashes and breaks (200), and nine ember streaks carry it to its owner's
        // square, where the pile answers with a ring. Exile and bounce fade where they stood (600 ms, as before).
        // A creature killed in the clash breaks on impact (after the freeze), not after the whole exchange.
        for ((id, c) in bfA) if (id !in bfB) {
            val rect = anchors.rects["c$id"] ?: continue
            val toGrave = b.players.any { p -> p.graveyard.any { it.id == id } }
            val clash = lunged && c.isCreature && (c.attacking || c.blocking)
            val item = FxItem(Fx.DEATH, 2, if (toGrave) DEATH_MS else 600, mine = c.controller == viewer, from = rect, toKey = if (toGrave) "grave${c.owner}" else null, ghost = c, delay = if (clash) hitAt(id) else 0L)
            // P6: a card a spell struck breaks 300 after its impact (inside the resolve), while the hit still rings.
            val struckAt = boltAt[id]?.takeIf { toGrave && !clash }
            val group = if (clash) hits else if (struckAt != null) resolves else deaths
            if (struckAt != null) { resolves += FxItem(Fx.DEATH, 2, DEATH_MS, mine = c.controller == viewer, from = rect, toKey = "grave${c.owner}", ghost = c, delay = struckAt + 300L)
                resolves += FxItem(Fx.EMBERS, 1, EMBERS_MS, card = id, mine = c.controller == viewer, from = rect, toKey = "grave${c.owner}", delay = struckAt + 540L); continue }
            group += item
            // The embers follow the break and do not hold the table (level 1): the next thing starts while they fly.
            if (toGrave) group += FxItem(Fx.EMBERS, 1, EMBERS_MS, card = id, mine = c.controller == viewer, from = rect, toKey = "grave${c.owner}", delay = item.delay + 240L)
        }
        return listOf(draws, casts, resolves, arrivals, combat, hits, deaths, counters, ends).filter { it.isNotEmpty() }
    }

    /** The card's own motion this frame (transform and alpha only), applied in its tile's layer. */
    internal fun move(scope: GraphicsLayerScope, id: Int, anchors: Anchors?) {
        rev.intValue
        if (stages.isNotEmpty()) scope.dim(id)
        if (spots.isNotEmpty()) scope.spotDim(id)
        if (impacts.isNotEmpty() && !reduced) with(scope) { rock(id, anchors) }
        if (heavies.isNotEmpty() && !reduced) with(scope) { hop(id) }
        if (reduced) return
        val t = now.longValue
        if (struck.isNotEmpty()) with(scope) { knock(id, anchors, t) }
        val list = byCard[id] ?: return
        anchors?.version?.intValue
        with(scope) {
            for (it in list) {
                val p = it.p(t)
                when (it.kind) {
                    Fx.ARRIVE -> {
                        if (p < 0f) { alpha = 0f; continue }
                        if (it.entrance > 0) { entranceMove(this, it, p, anchors?.rects?.get("c$id"), it.from?.center ?: it.fromKey?.let { k -> anchors?.rects?.get(k)?.center }); continue }
                        val slot = anchors?.rects?.get("c$id")
                        val src = it.from?.center ?: it.fromKey?.let { k -> anchors?.rects?.get(k)?.center }
                        val travel = (p / .7f).coerceAtMost(1f)
                        val e = 1f - (1f - travel).let { x -> x * x * x }
                        if (slot != null && src != null && travel < 1f) {
                            translationX = (src.x - slot.center.x) * (1f - e)
                            translationY = (src.y - slot.center.y) * (1f - e) - sin(PI.toFloat() * e) * 26.dp.toPx() * (if (it.mine) 1f else -1f)
                            val s = .72f + .28f * e; scaleX = s; scaleY = s
                        }
                        alpha = (p / .12f).coerceIn(0f, 1f)
                        if (p >= .7f) { val q = (p - .7f) / .3f; val k = .02f * sin(PI.toFloat() * q); scaleX = 1f + k; scaleY = 1f - k }
                    }
                    // P3, impact: the tile squashes 14 % and springs back (520 ms), after the landing's 45 ms freeze.
                    Fx.IMPACT -> if (p >= 0f) { val k = .14f * (1f - elasticOut((p * it.dur / 520f).coerceAtMost(1f))); scaleX = 1f + k; scaleY = 1f - k }
                    // F3: the heavy drop, on top of whatever brought the tile here: 1.9 times its size and a tile's height up, down in 130 ms.
                    Fx.HEAVY -> if (p >= 0f) { val ms = p * it.baseMs
                        if (ms < TableFeel.HEAVY_DROP_MS) { val (sc, up) = TableFeel.dropAt(ms); scaleX *= sc; scaleY *= sc; translationY -= up * size.height } }
                    Fx.TOKEN -> {
                        if (p < 0f) { alpha = 0f; continue }
                        alpha = (p / .55f).coerceIn(0f, 1f)
                        val s = .86f + .14f * easeOutBack(p); scaleX = s; scaleY = s
                    }
                    // The knock (struck tiles) is already in translationX: the hit's small shake rides on it.
                    Fx.DAMAGE -> if (p >= 0f) {
                        if (p < .2f) { scaleX = 1.04f; scaleY = 1.04f }
                        else { val q = (p - .2f) / .8f; translationX += 3.dp.toPx() * sin(q * 38f) * (1f - q) }
                    }
                    // P6: the aimed card flinches 5 % and springs back; the struck one is knocked 14 dp away from the stack and springs
                    // (a friendly spell only swells it 6 %).
                    Fx.AIM -> if (p >= 0f) { val s = 1f - .05f * (1f - elasticOut(p)); scaleX = s; scaleY = s }
                    Fx.BOLT -> if (p >= 0f) {
                        val k = 1f - elasticOut((p * BOLT_MS / 420f).coerceAtMost(1f))
                        if (it.power <= 0f) { scaleX = 1f + .06f * k; scaleY = 1f + .06f * k }
                        else { val a = anchors?.rects?.get("stackcard"); val b = anchors?.rects?.get("c$id")
                            if (a != null && b != null) { val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y; val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f)
                                translationX += dx / dist * 14.dp.toPx() * k; translationY += dy / dist * 14.dp.toPx() * k; rotationZ = (if (dx >= 0f) 3.4f else -3.4f) * k } }
                    }
                    // P5: a declared attacker steps up in its own tile's layer (attackStep); the effect draws its coral ring only.
                    Fx.ATTACK -> {}
                    Fx.BLOCK -> if (p >= 0f) {
                        // P5: steps toward its attacker with an overshoot in 190 ms, rests while the ice ring and stamp read (360), then goes home.
                        val a = anchors?.rects?.get("c$id"); val b = it.toKey?.let { k -> anchors?.rects?.get(k) }
                        if (a != null && b != null) {
                            val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y; val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f)
                            val ms = p * BLOCK_MS; val go = (ms / 190f).coerceAtMost(1f); val back = smooth(550f, BLOCK_MS.toFloat(), ms)
                            val off = minOf(70.dp.toPx(), dist * .45f) * easeOutBack(go) * (1f - back)
                            translationX = dx / dist * off; translationY = dy / dist * off; shadowElevation = 14f * (1f - back)
                            val s = 1f + .04f * easeOutBack(go) * (1f - back); scaleX = s; scaleY = s
                        }
                    }
                    Fx.LUNGE -> if (p >= 0f) {
                        val a = anchors?.rects?.get("c$id"); val b = it.toKey?.let { k -> anchors?.rects?.get(k) }
                        if (a != null && b != null) {
                            // P5 ([Strike]): pull back and swell, strike to contact, held through the freeze, then home.
                            val face = Strike.face(it); val ms = (t - it.t0).toFloat()
                            val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y
                            val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f); val ux = dx / dist; val uy = dy / dist
                            val off = Strike.offset(face, ms, strikeReach(a, b, face, if (face) anchors?.rects?.get("square" + it.toKey!!.removePrefix("orb")) else null), strikePull(dist, density))
                            translationX = ux * off; translationY = uy * off
                            val sc = Strike.scale(face, ms, TableFeel.chargeSwell()); scaleX = sc; scaleY = sc; shadowElevation = 20f
                            // It leans back on the pull, into the blow on the strike (a face hit spins in), and straightens going home.
                            val lean = if (ux >= 0f) 1f else -1f; val w = Strike.wind(face); val h = Strike.hit(face); val home = Strike.homeAt(face)
                            val far = if (face) -26f else 1.2f
                            rotationZ = lean * when {
                                ms < w -> (if (face) 4.6f else -2.3f) * (ms / w)
                                ms < h -> { val q = (ms - w) / (h - w); (if (face) 4.6f else -2.3f) * (1f - q) + far * q }
                                ms < home -> far
                                else -> far * (1f - ((ms - home) / Strike.homeMs(face)).coerceAtMost(1f))
                            }
                        }
                    }
                    Fx.COUNTER -> if (p >= 0f) { val k = .03f * sin(PI.toFloat() * p); scaleX = 1f + k; scaleY = 1f + k }
                    // sTrig: 180 ms up to 1.12x and 18 px toward the middle on a 145 px card (so 18/145 of the tile's height), held 260 ms, 180 ms back.
                    Fx.TRIG_SOURCE -> if (p >= 0f) {
                        val ms = p * it.dur; val e = smooth(0f, 180f, ms) * (1f - smooth(440f, 620f, ms))
                        scaleX = 1f + .12f * e; scaleY = 1f + .12f * e; translationY = -(if (it.mine) 1f else -1f) * size.height * TRIG_LIFT * e; shadowElevation = 18f * e
                    }
                    // The card takes the hit as the streak lands.
                    Fx.TRIG_LAND -> if (p >= 0f) { val ms = p * it.dur; val k = .06f * (smooth(200f, 280f, ms) * (1f - smooth(280f, 460f, ms))); scaleX = 1f + k; scaleY = 1f + k }
                    else -> {}
                }
            }
        }
    }
}

/** How far the attacker travels to touch what it strikes: a tile's near edge, or well into a profile picture. */
internal fun strikeReach(a: Rect, b: Rect, face: Boolean, square: Rect? = null): Float {
    val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y
    val dist = kotlin.math.hypot(dx, dy)
    if (!face) return (dist - minOf(b.width, b.height) * .42f - minOf(a.width, a.height) * .3f).coerceAtLeast(0f)
    // The picture sits on its player's square, which is drawn over the board: the attacker stops where its line meets the
    // square's edge (it is .45 of its size there, and only its tip goes under), so the blow is seen and not hidden under the glass.
    if (square != null && dist > 1f && !square.contains(a.center)) {
        val ux = dx / dist; val uy = dy / dist
        fun slab(o: Float, u: Float, lo: Float, hi: Float): Pair<Float, Float> = if (kotlin.math.abs(u) < 1e-4f) (if (o in lo..hi) Float.NEGATIVE_INFINITY to Float.POSITIVE_INFINITY else Float.POSITIVE_INFINITY to Float.NEGATIVE_INFINITY)
            else { val t0 = (lo - o) / u; val t1 = (hi - o) / u; minOf(t0, t1) to maxOf(t0, t1) }
        val (x0, x1) = slab(a.center.x, ux, square.left, square.right); val (y0, y1) = slab(a.center.y, uy, square.top, square.bottom)
        val enter = maxOf(x0, y0); val leave = minOf(x1, y1)
        if (enter in 0f..leave) return (enter - maxOf(a.width, a.height) * .45f * .4f).coerceIn(0f, dist)
    }
    return (dist - minOf(b.width, b.height) * .25f).coerceAtLeast(0f)
}
/** The pull back: a tenth of the way, at most 30 dp. */
internal fun strikePull(dist: Float, density: Float) = minOf(dist * .1f, 30f * density)

val LocalBattlefield = staticCompositionLocalOf<Battlefield?> { null }
/** 0.4.59 T5: the cast's travel leg right now (TableScreen provides the controller's), read by TravelCard, the stack and the aura strips. */
val LocalTravel = androidx.compose.runtime.compositionLocalOf<dev.cardstashy.nativeplay.match.TravelMoment?> { null }
internal val TRAVEL_LANDS = setOf(dev.cardstashy.nativeplay.match.Director.Leg.TO_SLOT, dev.cardstashy.nativeplay.match.Director.Leg.TO_HOST, dev.cardstashy.nativeplay.match.Director.Leg.TO_GROUP)
/** Screenshots and tests: where in its leg the travelling card is drawn (0..1); null runs on the frame clock. */
internal object TravelClock { var fixed: Float? = null }
/** The table's sound player (id, volume, playback rate); none outside a match and in tests. */
val LocalTableCue = staticCompositionLocalOf<((String, Float, Float) -> Unit)?> { null }
/** The sound player's ear for [Battlefield.onPlan]: the board's revision and the cues its effects will play themselves. */
val LocalTablePlan = staticCompositionLocalOf<((Long, Set<String>) -> Unit)?> { null }

private val MANA_GLOW = mapOf('W' to Color(0xFFFFF1C2), 'U' to Color(0xFF5AB4FF), 'B' to Color(0xFFB08BD8), 'R' to Color(0xFFFF7A4A), 'G' to Color(0xFF6BE08A))

private fun easeOutBack(x: Float): Float { val c1 = 1.70158f; val c3 = c1 + 1f; return 1f + c3 * (x - 1f).let { it * it * it } + c1 * (x - 1f).let { it * it } }
/** Match punch P4: on a new turn the untap ripple starts 140 ms in (each tile 240 ms, 50 apart) and the draw 380 ms in. */
internal const val UNTAP_AT_MS = 140L
internal const val UNTAP_GAP_MS = 50L
internal const val UNTAP_TURN_MS = 240
internal const val DRAW_AT_MS = 380L
/** P4, your draw: lift 90, flip and fly 320, hold 380, tuck 260. */
internal const val MY_DRAW_MS = 1050L

/** P5: the creatures that have just been declared as attackers, in the order they step up (Forge's attack order, then the board's). */
internal fun declareOrder(a: MatchState, b: MatchState): List<Int> {
    val was = a.players.flatMap { it.battlefield }.filter { it.attacking }.map { it.id }.toSet()
    val now = b.players.flatMap { it.battlefield }.filter { it.attacking && it.id !in was }.map { it.id }
    if (now.isEmpty()) return now
    val said = b.events.lastOrNull { it.type == "attack" && it.attackers.isNotEmpty() }?.attackers?.map { it.first.id }.orEmpty().filter { it in now }
    return said + now.filter { it !in said }
}

/**
 * P4: the cards the player whose turn began readied, in the order the ripple runs: the back row (lands) left to right as Forge
 * lists them, then the rest. Read from the two boards; nothing is predicted.
 */
internal fun untapOrder(a: MatchState, b: MatchState): List<Int> {
    if (a.turn == b.turn) return emptyList()
    val was = a.players.flatMap { it.battlefield }.filter { it.tapped }.map { it.id }.toSet()
    val now = b.players.firstOrNull { it.id == b.activePlayer }?.battlefield.orEmpty().filter { !it.tapped && it.id in was }
    return (now.filter { it.isLand } + now.filter { !it.isLand }).map { it.id }
}

/** P4: the ice ring and eight sparks around your drawn card as it holds above the hand (the card itself is [DrawnCard]). */
private fun DrawScope.drawMyDraw(fx: Battlefield, it: FxItem, p: Float, hand: Rect?) {
    val ms = p * it.dur
    if (ms < 410f || fx.low || hand == null) return
    val at = Offset(hand.center.x, hand.top - hand.height * .55f)
    if (it.once(1)) fx.bits.sparks(at, 8, Color(0xFF5CC8FF), fx.now.longValue, 110f * density, lifeMs = 420, sizePx = 1.5f * density, seed = it.card ?: 0)
}

/** P4: where your drawn card is at [ms] into its draw: centre (root px), scale against its hand size, how far it has flipped (0 back, 1 face), alpha. */
internal fun myDrawAt(ms: Float, lib: Offset, spot: Offset, home: Offset, dp: Float): FloatArray {
    val out = FloatArray(5)
    when {
        ms < 90f -> { val e = 1f - (1f - ms / 90f).let { it * it }; out[0] = lib.x; out[1] = lib.y - 18f * dp * e; out[2] = .3f + .2f * e; out[3] = 0f }
        ms < 410f -> { val q = (ms - 90f) / 320f; val e = 1f - (1f - q).let { it * it * it }
            out[0] = lib.x + (spot.x - lib.x) * e; out[1] = lib.y - 18f * dp + (spot.y - (lib.y - 18f * dp)) * e; out[2] = .5f + 1.1f * e; out[3] = q }
        ms < 790f -> { out[0] = spot.x; out[1] = spot.y; out[2] = 1.6f; out[3] = 1f }
        else -> { val q = ((ms - 790f) / 260f).coerceIn(0f, 1f); val e = q * q * (3f - 2f * q)
            out[0] = spot.x + (home.x - spot.x) * e; out[1] = spot.y + (home.y - spot.y) * e; out[2] = 1.6f - .6f * e; out[3] = 1f }
    }
    out[4] = 1f
    return out
}

@Composable
private fun DrawnCard(it: FxItem, fx: Battlefield, anchors: Anchors, self: Offset, density: androidx.compose.ui.unit.Density) {
    val card = it.ghost ?: return
    Box(Modifier.size(66.dp, 92.dp).graphicsLayer {
            val p = it.p(fx.now.longValue)
            anchors.version.intValue
            val lib = it.fromKey?.let { k -> anchors.rects[k] }
            val tray = anchors.rects["handTray"] ?: anchors.rects["hand"]
            if (p < 0f || lib == null || tray == null) { alpha = 0f; return@graphicsLayer }
            val home = it.toKey?.let { k -> anchors.rects[k] }
            val base = home?.height ?: (tray.height * .86f)
            val spot = Offset(tray.center.x, tray.top - base * .55f)
            val at = myDrawAt(p * it.dur, lib.center, spot, home?.center ?: tray.center, density.density)
            val k = at[2] * base / size.height
            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, .5f)
            translationX = at[0] - self.x - size.width / 2; translationY = at[1] - self.y - size.height / 2
            // The flip: the back narrows to nothing at the half-way point and the face widens again.
            scaleX = k * abs(cos(PI.toFloat() * at[3])).coerceAtLeast(.02f); scaleY = k
            alpha = if (p >= 1f) 0f else 1f
        }.semantics { contentDescription = "${card.name} drawn" }
        .clip(RoundedCornerShape(5.dp)).background(Color(0xFF141418))
        .drawWithContent {
            drawContent()
            // The ice ring while it holds above the hand.
            val ms = it.p(fx.now.longValue) * it.dur
            if (ms in 410f..790f) drawRoundRect(Color(0xFF5CC8FF).copy(alpha = .9f * (1f - (ms - 410f) / 380f * .5f)), Offset.Zero, size, CornerRadius(5f * density.density), style = Stroke(width = 2.5f * density.density))
        }) {
        CardImage(card.name, Modifier.fillMaxSize().graphicsLayer { alpha = if (it.p(fx.now.longValue) * it.dur >= 250f) 1f else 0f }, crop = false)
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = if (it.p(fx.now.longValue) * it.dur >= 250f) 0f else 1f }) { CardBack(Modifier.fillMaxSize()) }
    }
}

/** The preview's E.elastic: 0 at 0, overshooting and ringing down to 1 (a squash springing back). */
internal fun elasticOut(x: Float): Float = if (x <= 0f) 0f else if (x >= 1f) 1f else Math.pow(2.0, -10.0 * x).toFloat() * sin((x * 10f - .75f) * (2f * PI.toFloat() / 3f)) + 1f
/** P3: a landing's impact as a whole (the neighbours' 620 ms spring is its longest part). */
internal const val IMPACT_MS = 620L
/** Ease out with a small overshoot (the preview's E.back, c = 1.9): 0 at 0, 1 at 1, about 1.12 at its peak. */
internal fun backOut(x: Float): Float { val c = 1.9f; val y = x - 1f; return 1f + (c + 1f) * y * y * y + c * y * y }
private fun smooth(e0: Float, e1: Float, x: Float): Float { val t = ((x - e0) / (e1 - e0)).coerceIn(0f, 1f); return t * t * (3f - 2f * t) }
private fun lerpO(a: Offset, b: Offset, t: Float) = Offset(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

/** Reads each new snapshot (after composition, before the frame draws) and runs the frame clock. */
@Composable
internal fun FxDriver(fx: Battlefield, st: MatchState) {
    val anchors = LocalAnchors.current
    val view = androidx.compose.ui.platform.LocalView.current
    SideEffect { fx.onImpact = { kind -> if (AppSettings.haptics) Feel.perform(view, when (kind) { "light" -> "pack-deal"; "heavy" -> "pack-rumble"; else -> "pack-reveal" }) } }
    val cue = LocalTableCue.current
    val reduced = androidx.compose.runtime.remember { Playmats.reduced(view.context) }
    val plan = LocalTablePlan.current
    SideEffect { fx.onCue = cue; fx.onPlan = plan; fx.reduced = reduced; fx.low = AppSettings.effects == "minimal"; fx.promptWaiting = st.prompt != null && st.waitingOnMe }
    val trig = LocalTrigger.current
    val travel = LocalTravel.current
    SideEffect { fx.travel = travel; fx.board = st; fx.trigger(trig, st, anchors); fx.take(st, anchors) }
    LaunchedEffect(fx) { if (!Motion.still) while (true) withFrameMillis { fx.tick(it) } }
}

/** A touch anywhere on the board skips every effect to its end (seen first, never consumed). */
internal fun Modifier.fxSkip(fx: Battlefield) = pointerInput(fx) {
    awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Initial); if (e.type == PointerEventType.Press) fx.skip() } }
}

// ---- The mat itself: ambient light under the cards (spec page 15) ----

private const val GRAIN_SKSL = """
uniform float2 size; uniform float time; uniform float alpha; uniform float mid; uniform float dir;
float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
half4 main(float2 fc) {
    float band = 1.0 - smoothstep(0.0, size.y * 0.26, abs(fc.y - mid));
    float2 g = float2(fc.x * 0.03 + time * 0.45 * dir, fc.y * 0.5);
    float2 cell = floor(g);
    float n = hash(cell);
    float streak = step(0.94, n) * (1.0 - fract(g.x)) * (0.6 + 0.4 * hash(cell + 3.1));
    float a = streak * band * alpha;
    return half4(half3(1.0, 0.88, 0.72) * a, a);
}
"""

/**
 * Your turn warms your half of the mat by 6 % (their turn, theirs); whoever holds priority has a slow light travelling
 * round their edge, gold for you and cooler for the CPU (one loop per 3 s); combat lays a faint directional grain across
 * the centre. Word twins: the phase strip and the lit play button already say each of these in words.
 */
@Composable
internal fun FxMat(st: MatchState, mid: Dp) {
    if (Motion.still) return
    val fx = LocalBattlefield.current ?: return
    val mineTurn = st.activePlayer == st.viewer
    val warm = remember { Animatable(if (mineTurn) 1f else 0f) }
    LaunchedEffect(mineTurn) { warm.animateTo(if (mineTurn) 1f else 0f, tween(700)) }
    val running = st.status == "running"
    val myEdge = running && st.waitingOnMe
    val theirEdge = running && !myEdge && (st.busy || (st.priorityPlayer != null && st.priorityPlayer != st.viewer))
    val edge = remember { Animatable(0f) } // -1 theirs, +1 yours
    LaunchedEffect(myEdge, theirEdge) { edge.animateTo(if (myEdge) 1f else if (theirEdge) -1f else 0f, tween(500)) }
    val combat = st.phase?.startsWith("COMBAT") == true
    val grain = remember { Animatable(0f) }
    LaunchedEffect(combat) { grain.animateTo(if (combat) 1f else 0f, tween(450)) }
    val shader = remember { if (Build.VERSION.SDK_INT >= 33) runCatching { RuntimeShader(GRAIN_SKSL) }.getOrNull() else null }
    val streaks = remember { val r = java.util.Random(7); List(80) { floatArrayOf(r.nextFloat(), r.nextFloat() * 2f - 1f, .4f + r.nextFloat() * .6f, r.nextFloat()) } }
    val dir = if (mineTurn) -1f else 1f
    Canvas(Modifier.fillMaxSize()) {
        val t = fx.now.longValue
        val m = mid.toPx()
        // Turn warmth: +6 % on the active player's half.
        val wy = warm.value
        if (wy > 0f) drawRect(Color(0xFFFFE4B8).copy(alpha = .06f * wy), topLeft = Offset(0f, m), size = Size(size.width, size.height - m))
        if (wy < 1f) drawRect(Color(0xFFFFE4B8).copy(alpha = .06f * (1f - wy)), size = Size(size.width, m))
        // Combat grain across the centre.
        val g = grain.value
        if (g > 0f) {
            val secs = (t % 600_000L) / 1000f
            if (shader != null && Build.VERSION.SDK_INT >= 33) {
                shader.setFloatUniform("size", size.width, size.height); shader.setFloatUniform("time", secs); shader.setFloatUniform("alpha", .22f * g)
                shader.setFloatUniform("mid", m); shader.setFloatUniform("dir", dir)
                drawRect(ShaderBrush(shader))
            } else {
                val band = size.height * .26f
                for (s in streaks) {
                    // One cycle per 6 s across the board: never faster than one cycle per 2 s.
                    val x = ((s[0] + dir * secs / 6f) % 1f + 1f) % 1f * size.width
                    val y = m + s[1] * band
                    val fade = 1f - abs(s[1])
                    val len = 26.dp.toPx() * s[2]
                    drawLine(Color(0xFFFFE0B8).copy(alpha = .11f * g * fade * (.5f + .5f * s[3])), Offset(x, y), Offset(x + len, y), strokeWidth = 1.dp.toPx())
                }
            }
        }
        // Priority: a light travels round the holder's half.
        val e = edge.value
        if (abs(e) > .01f) {
            val inset = 5.dp.toPx()
            val mine = e > 0f
            val r = if (mine) Rect(inset, m + inset, size.width - inset, size.height - inset) else Rect(inset, inset, size.width - inset, m - inset)
            val path = Path().apply { addRoundRect(RoundRect(r, CornerRadius(14.dp.toPx()))) }
            val pm = PathMeasure().apply { setPath(path, false) }
            val len = pm.length
            val col = if (mine) Color(0xFFF3D27E) else Color(0xFF8FB4FF)
            val a = abs(e) * (if (mine) 1f else .7f)
            drawPath(path, col.copy(alpha = .07f * a), style = Stroke(1.dp.toPx()))
            val head = ((t % 3000L) / 3000f) * len
            val tail = len * .2f
            val parts = 12
            for (i in 0 until parts) {
                val s0 = head - tail * (i + 1) / parts; val s1 = head - tail * i / parts
                val seg = Path()
                fun cut(x0: Float, x1: Float) { pm.getSegment(x0, x1, seg, true) }
                if (s0 >= 0) cut(s0, s1) else if (s1 <= 0) cut(s0 + len, s1 + len) else { cut(s0 + len, len); cut(0f, s1) }
                val k = 1f - i.toFloat() / parts
                drawPath(seg, col.copy(alpha = .55f * a * k), style = Stroke(1.6.dp.toPx() * (.6f + .4f * k)))
                if (i < 3) drawIntoCanvas { c ->
                    val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = 5.dp.toPx(); color = col.copy(alpha = .35f * a * k).toArgb(); maskFilter = BlurMaskFilter(6.dp.toPx(), BlurMaskFilter.Blur.NORMAL) }
                    c.nativeCanvas.drawPath(seg.asAndroid(), p)
                }
            }
        }
    }
}

private fun Path.asAndroid() = (this as androidx.compose.ui.graphics.AndroidPath).internalPath

// ---- Over the cards: arrivals, casts, hits, deaths, numbers ----

@Composable
internal fun FxLayer(force: Boolean = false) {
    if (Motion.still && !force) return
    val fx = LocalBattlefield.current ?: return
    val anchors = LocalAnchors.current ?: return
    var self by remember { mutableStateOf(Offset.Zero) }
    val tm = rememberTextMeasurer()
    val density = LocalDensity.current
    Box(Modifier.fillMaxSize().onGloballyPositioned { val b = it.boundsInRoot(); self = b.topLeft; fx.origin = b.topLeft; fx.stageCentre = b.center }) {
        // Dying cards: the last picture of the card, breaking into holo bands as it drifts to its graveyard.
        for (it in fx.items) if ((it.kind == Fx.DEATH || (it.kind == Fx.SPENT && !fx.reduced)) && it.ghost != null && it.from != null) key(it) { Ghost(it, fx, anchors, self, density) }
        // P4: your drawn card itself, on its way from your deck to its place in your hand.
        if (!fx.reduced) for (it in fx.items) if (it.kind == Fx.DRAW && it.ghost != null) key(it) { DrawnCard(it, fx, anchors, self, density) }
        Canvas(Modifier.fillMaxSize()) {
            val t = fx.now.longValue
            anchors.version.intValue
            fun rect(k: String?): Rect? = k?.let { anchors.rects[it] }?.translate(-self.x, -self.y)
            var bandAt: Rect? = null
            fun band(): Rect = bandAt ?: trailBand(size.width, size.height, anchors.rects.mapValues { (_, r) -> r.translate(-self.x, -self.y) }, 4.dp.toPx()).also { bandAt = it }
            for (it in fx.items) {
                val p = it.p(t); if (p < 0f) continue
                if (fx.reduced) {
                    // Reduce motion: the numbers and the stamp, nothing that moves or flashes.
                    when (it.kind) {
                        Fx.BLOCK -> { val a = rect(it.fromKey); val b = rect(it.toKey); if (a != null && b != null) drawBlock(tm, it, p, a, b, still = true) }
                        Fx.DAMAGE -> rect("c${it.card}")?.let { r -> bigNumber(tm, it.label, p, r.center, it.tone, if (size.height < 500.dp.toPx()) 40f else 52f) }
                        Fx.LIFE -> rect(it.toKey)?.let { r -> pop(tm, it.label, p, Offset(r.center.x, if (r.center.y < size.height / 2) r.bottom + 16.dp.toPx() else r.top - 6.dp.toPx()), it.tone, if (it.level == 3) 34f + 8f * it.power else 20f, down = r.center.y < size.height / 2) }
                        Fx.COUNTER -> rect("c${it.card}")?.let { r -> pop(tm, it.label, p, Offset(r.center.x, r.top + 4.dp.toPx()), Color(0xFFF3D27E), 15f) }
                        Fx.STAGE -> drawStage(tm, it, p, rect(it.fromKey), rect(it.toKey))
                        // Reduce motion: the source keeps one still rim; the landing keeps its words (the change, the chip, the line), unmoving.
                        Fx.TRIG_SOURCE -> rect("c${it.card}")?.let { r -> glowRing(r, it.tone, .9f * (1f - smooth(.8f, 1f, p)), 8.dp.toPx()) }
                        Fx.TRIG_LAND -> drawTrigLand(tm, it, p, rect(it.fromKey), rect(it.toKey), still = true, band = band())
                        Fx.IMPACT -> rect("c${it.card}")?.let { r -> drawImpact(fx, it, p, r) }
                        else -> {}
                    }
                    continue
                }
                when (it.kind) {
                    Fx.AIM -> rect(it.toKey)?.let { r -> val q = (p * AIM_MS / 260f).coerceAtMost(1f)
                        if (q < 1f) drawCircle(it.tone.copy(alpha = .9f * (1f - q)), radius = r.maxDimension * (.95f - .4f * q), center = r.center, style = Stroke(3.dp.toPx() * (1f - .5f * q))) }
                    Fx.FIRE -> drawFire(it, p, it.from?.translate(-self.x, -self.y), rect(it.toKey))
                    Fx.BOLT -> (rect("c${it.card}") ?: it.from?.translate(-self.x, -self.y))?.let { r -> drawBolt(fx, it, p, r, rect(it.fromKey)) }
                    Fx.SPENT -> rect(it.toKey)?.let { g -> val k = (p * SPENT_MS - 320f) / 300f
                        if (k in 0f..1f) drawCircle(Color(0xFFF3D27E).copy(alpha = .9f * (1f - k)), radius = 15.dp.toPx() + 25.dp.toPx() * (1f - (1f - k) * (1f - k)), center = g.center, style = Stroke((2f * (1f - k) + .6f) * density.density)) }
                    Fx.GLINT -> rect("c${it.card}")?.let { r -> drawRoundRect(it.tone.copy(alpha = (if (it.power > 0f) it.power else .4f) * (1f - p)), r.topLeft, r.size, CornerRadius(10.dp.toPx())) }
                    Fx.DRAW -> if (it.ghost != null) drawMyDraw(fx, it, p, rect("handTray") ?: rect("hand")) else drawDraw(it, p, rect(it.fromKey), rect(it.toKey) ?: Rect(size.width / 2 - 20f, size.height - 60f, size.width / 2 + 20f, size.height))
                    Fx.CAST -> drawCast(it, p, rect(it.fromKey) ?: (if (it.mine) Rect(size.width / 2, size.height - 40f, size.width / 2, size.height) else Rect(size.width / 2, 0f, size.width / 2, 20f)), rect(it.toKey))
                    Fx.RESOLVE -> drawResolve(it, p, it.from?.translate(-self.x, -self.y), rect(it.toKey))
                    Fx.ARRIVE -> rect("c${it.card}")?.let { r -> if (it.entrance > 0) drawEntrance(tm, it, p, r, fx.stageCentre?.let { c -> c - self }) else drawArrive(it, p, r) }
                    Fx.TOKEN -> rect("c${it.card}")?.let { r -> drawToken(p, r) }
                    Fx.ATTACK -> rect("c${it.card}")?.let { r -> drawDeclare(fx, it, p, r) }
                    Fx.LUNGE -> drawLunge(fx, it, rect("c${it.card}"), rect(it.toKey), if (Strike.face(it)) rect("square" + it.toKey!!.removePrefix("orb")) else null, if (Strike.face(it)) rect("lifepill" + it.toKey!!.removePrefix("orb")) else null)
                    Fx.BLOCK -> { val a = rect(it.fromKey); val b = rect(it.toKey); if (a != null && b != null) drawBlock(tm, it, p, a, b) }
                    Fx.DAMAGE -> rect("c${it.card}")?.let { r -> drawHit((p * 3.1f).coerceAtMost(1f), r)
                        // An attacker's number sits lower left and a blocker's upper right, so two never stack and the P/T stays readable.
                        // Away from the clash: a card in the upper half shows it above-left, one in the lower half below-right.
                        val at = if (it.side == 0) r.center.copy(y = r.top + r.height * .3f) else if (r.center.y < size.height / 2) Offset(r.left - r.width * .2f, r.top - r.height * .15f) else Offset(r.right + r.width * .2f, r.bottom + r.height * .05f)
                        bigNumber(tm, it.label, p, at, it.tone, if (size.height < 500.dp.toPx()) 40f else 52f) }
                    Fx.LIFE -> rect(it.toKey)?.let { r -> if (it.level == 3) faceHit(fx, it, p, r, fx.low) else glowRing(r, it.tone, .8f * (1f - p), 6.dp.toPx(), round = true); pop(tm, it.label, p, Offset(r.center.x, if (r.center.y < size.height / 2) r.bottom + 16.dp.toPx() else r.top - 6.dp.toPx()), it.tone, if (it.level == 3) 34f + 8f * it.power else 20f, down = r.center.y < size.height / 2) }
                    Fx.COUNTER -> rect("c${it.card}")?.let { r -> drawPour(p, r); pop(tm, it.label, p, Offset(r.center.x, r.top + 4.dp.toPx()), Color(0xFFF3D27E), 15f) }
                    Fx.DEATH -> if (!fx.low && it.toKey == null) it.from?.translate(-self.x, -self.y)?.let { r -> drawShards(it, p, r, rect(it.toKey)) }
                    Fx.EMBERS -> if (!fx.low) it.from?.translate(-self.x, -self.y)?.let { r -> drawEmbers(fx, it, p, r, rect(it.toKey)) }
                    Fx.STAGE -> drawStage(tm, it, p, rect(it.fromKey), rect(it.toKey))
                    Fx.TRIG_SOURCE -> rect("c${it.card}")?.let { r -> drawTrigSource(it, p, r) }
                    Fx.TRIG_LAND -> drawTrigLand(tm, it, p, rect(it.fromKey), rect(it.toKey), band = band())
                    Fx.IMPACT -> rect("c${it.card}")?.let { r -> drawImpact(fx, it, p, r) }
                    Fx.HEAVY -> rect("c${it.card}")?.let { r -> drawHeavy(fx, it, p, r, self) }
                    Fx.WIN -> drawWin(fx, it, p, rect(it.toKey), it.ids.mapNotNull { id -> rect("orb$id") })
                }
            }
            // P2: a cast's pay (each land's flash and streak), charge and burst, read from the leg the table is drawing.
            fx.travel?.let { m -> drawCastPunch(fx, m, ::rect) }
            // P1: every particle on this one canvas, over the effects. None with reduce motion or Effects Minimal.
            if (fx.reduced || fx.low) fx.bits.clear() else fx.bits.draw(this, t)
        }
    }
}

/** A staged pair: a gold line from the attacker to what it meets, and a small glass tag naming the pair at its middle. */
private fun DrawScope.drawStage(tm: androidx.compose.ui.text.TextMeasurer, it: FxItem, p: Float, a: Rect?, b: Rect?) {
    if (a == null || b == null) return
    val ms = p * it.dur
    val alpha = minOf(1f, ms / 120f, (it.dur - ms) / 120f).coerceIn(0f, 1f)
    if (alpha <= 0f) return
    val gold = Color(0xFFF3D27E)
    drawLine(gold.copy(alpha = .28f * alpha), a.center, b.center, strokeWidth = 8.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
    drawLine(gold.copy(alpha = .95f * alpha), a.center, b.center, strokeWidth = 2.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
    val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFF7EEDA).copy(alpha = alpha))
    val lay = tm.measure(it.label, style, constraints = androidx.compose.ui.unit.Constraints(maxWidth = (size.width * .6f).toInt().coerceAtLeast(1)))
    val padX = 10.dp.toPx(); val padY = 5.dp.toPx()
    val mid = Offset((a.center.x + b.center.x) / 2, (a.center.y + b.center.y) / 2)
    val w = lay.size.width + 2 * padX; val h = lay.size.height + 2 * padY
    val x = (mid.x - w / 2).coerceIn(4.dp.toPx(), size.width - w - 4.dp.toPx()); val y = (mid.y - h / 2).coerceIn(4.dp.toPx(), size.height - h - 4.dp.toPx())
    drawRoundRect(Color(0xE60C0C10).copy(alpha = .9f * alpha), Offset(x, y), Size(w, h), CornerRadius(h / 2))
    drawRoundRect(gold.copy(alpha = .7f * alpha), Offset(x, y), Size(w, h), CornerRadius(h / 2), style = Stroke(1.dp.toPx()))
    drawText(lay, topLeft = Offset(x + padX, y + padY))
}

internal const val TRIG_SOURCE_MS = 620L
internal const val TRIG_LAND_MS = 1200L
internal val TRIG_GOLD = Color(0xFFE3C070)
internal val TRIG_CORAL = Color(0xFFFF6A4D)
internal val TRIG_GREEN = Color(0xFF62E39A)

/** A trigger's beat right now (TableScreen provides the controller's), read by the board's effects and the P/T plates. */
val LocalTrigger = androidx.compose.runtime.compositionLocalOf<dev.cardstashy.nativeplay.match.TriggerMoment?> { null }

/** What a result shows on card [id]: the change rising ("+1/+1"), its counter chip ("+1", or null with no counter) and whether it went up. */
internal fun landing(r: dev.cardstashy.nativeplay.match.Director.Resolution, id: Int): Triple<String, String?, Boolean> {
    val cs = r.counters.filter { it.cardId == id }
    val pt = r.pt.firstOrNull { it.cardId == id }
    fun sg(n: Int) = if (n >= 0) "+$n" else "\u2212${-n}"
    val main = cs.groupBy { it.counter }.maxByOrNull { (_, l) -> abs(l.sumOf { it.delta }) }
    if (main != null) {
        val (kind, l) = main; val n = l.sumOf { it.delta }
        return when {
            kind.equals("P1P1", true) -> Triple(if (n > 0) "+$n/+$n" else "\u2212${-n}/\u2212${-n}", sg(n), n > 0)
            kind.equals("M1M1", true) -> Triple(if (n > 0) "\u2212$n/\u2212$n" else "+${-n}/+${-n}", sg(-n), n < 0)
            else -> Triple(sg(n) + " " + kind.lowercase().replace('_', ' '), sg(n), pt?.up ?: (n > 0))
        }
    }
    if (pt != null) return Triple("${sg(pt.toP - pt.fromP)}/${sg(pt.toT - pt.fromT)}", null, pt.up)
    return Triple("", null, true)
}

/**
 * The free band for a result's trail line, in the canvas's own space: below the CPU's tucked hand ("cpuhand"), above the
 * highest card in the upper half (the CPU's top row), and between the boxes beside it on the left (phase track, turn clock)
 * and right (the CPU's seat and orb, the stack). Measured from [rects], so it fits any table size and the dual-screen top screen.
 */
internal fun trailBand(w: Float, h: Float, rects: Map<String, Rect>, gap: Float): Rect {
    val top = maxOf(gap, (rects["cpuhand"]?.bottom ?: 0f) + gap)
    val upper = rects.filterKeys { it.length > 1 && it[0] == 'c' && it.drop(1).toIntOrNull() != null }.values.filter { it.center.y < h / 2 }
    val bottom = maxOf(top + 1f, (upper.minOfOrNull { it.top } ?: h * .27f) - gap)
    val side = rects.filterKeys { k -> k == "phasetrack" || k == "turnring" || k == "turncount" || k == "cpuseat" || k.startsWith("orb") || k == "stackcard" || k == "stacklabel" }
        .values.filter { it.bottom > top && it.top < bottom }
    val left = maxOf(gap, side.filter { it.center.x < w / 2 }.maxOfOrNull { it.right + gap } ?: gap)
    val right = minOf(w - gap, side.filter { it.center.x >= w / 2 }.minOfOrNull { it.left - gap } ?: (w - gap))
    return Rect(left, top, maxOf(right, left + 1f), bottom)
}

/**
 * sTrig's numbers are preview stage px, where a creature is 104 x 145 px: the ring is 260 px across (2.5 card widths) and the
 * lift 18 px (18/145 of the card's height). The table sizes both from the tile, so the look holds at any card size.
 */
private const val TRIG_RING = 260f / 104f
internal const val TRIG_LIFT = 18f / 145f

/** Beat 1's ring: one ring out to 2.5 card widths across in 520 ms, and the card's rim in the caster's colour while it is lifted. */
private fun DrawScope.drawTrigSource(it: FxItem, p: Float, r: Rect) {
    val ms = p * it.dur
    val q = (ms / 520f).coerceIn(0f, 1f)
    if (q < 1f) drawCircle(it.tone.copy(alpha = .9f * (1f - q)), radius = r.width * TRIG_RING / 2f * (.35f + .65f * q), center = r.center, style = Stroke((4f - 3f * q).dp.toPx()))
    // The rim follows the lifted card (move() lifts it 18/145 of its height toward the middle at 1.12x).
    val e = smooth(0f, 180f, ms) * (1f - smooth(440f, 620f, ms))
    val k = 1f + .12f * e; val dy = -(if (it.mine) 1f else -1f) * r.height * TRIG_LIFT * e
    val lifted = Rect(Offset(r.center.x - r.width * k / 2, r.center.y + dy - r.height * k / 2), Size(r.width * k, r.height * k))
    glowRing(lifted, it.tone, .95f * e, 9.dp.toPx())
}

/**
 * Beat 3 on one card (sTrig): the streak from the source (0 to 280 ms) in the caster's colour, a 380 ms flash in green (up) or
 * coral (down), the change rising above the card, the counter chip popping .2 to 1.3 to 1 in 320 ms at its corner, and the trail
 * line in a glass tag under or over the card. [still] (reduce motion): no streak, flash or rise; the words stand.
 */
private fun DrawScope.drawTrigLand(tm: androidx.compose.ui.text.TextMeasurer, it: FxItem, p: Float, from: Rect?, to: Rect?, still: Boolean = false, band: Rect? = null) {
    if (to == null) return
    val ms = p * it.dur
    val out = 1f - smooth(it.dur - 220f, it.dur.toFloat(), ms)
    if (!still) {
        if (from != null && ms < 300f) comet(from.center, to.center, (ms / 280f).coerceIn(0f, 1f), it.caster, 34f * density)
        val fq = (ms - 200f) / 380f
        if (fq in 0f..1f) { val rad = 100.dp.toPx() * (.6f + .4f * fq)
            drawCircle(Brush.radialGradient(listOf(it.tone.copy(alpha = .8f * (1f - fq)), it.tone.copy(alpha = .3f * (1f - fq)), Color.Transparent), center = to.center, radius = rad), radius = rad, center = to.center) }
        if (ms in 200f..900f) glowRing(to, it.tone, .9f * (1f - smooth(500f, 900f, ms)), 7.dp.toPx())
    } else glowRing(to, it.tone, .8f * out, 5.dp.toPx())
    // The change, rising from the card's top.
    if (it.label.isNotEmpty() && (still || ms >= 220f)) {
        val rise = if (still) 0f else smooth(220f, 1000f, ms)
        val a = if (still) out else smooth(220f, 320f, ms) * out
        val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Black, fontSize = 22.sp, color = it.tone.copy(alpha = a))
        val lay = tm.measure(it.label, style)
        val at = Offset(to.center.x - lay.size.width / 2f, (to.top - lay.size.height * .6f - 16.dp.toPx() * rise).coerceAtLeast(2.dp.toPx()))
        for ((dx, dy) in listOf(-1.5f to 0f, 1.5f to 0f, 0f to -1.5f, 0f to 1.5f)) drawText(tm, it.label, at + Offset(dx * density, dy * density), style.copy(color = Color.Black.copy(alpha = .9f * a)))
        drawText(lay, topLeft = at)
    }
    // The counter chip at the card's top right corner.
    if (it.title.isNotEmpty() && (still || ms >= 240f)) {
        val q = if (still) 1f else ((ms - 240f) / 320f).coerceIn(0f, 1f)
        val k = if (q < .6f) .2f + 1.1f * (q / .6f) else 1.3f - .3f * ((q - .6f) / .4f)
        val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Black, fontSize = 12.sp, color = Color(0xFF2A1D05).copy(alpha = out))
        val lay = tm.measure(it.title, style)
        val h = 20.dp.toPx(); val w = maxOf(h, lay.size.width + 10.dp.toPx())
        val c = Offset(to.right - 2.dp.toPx(), to.top + 4.dp.toPx())
        scale(k, c) {
            drawRoundRect(Brush.radialGradient(listOf(Color(0xFFFFF2C6), Color(0xFFD9B463), Color(0xFFA9822F)), center = c, radius = w), Offset(c.x - w / 2, c.y - h / 2), Size(w, h), CornerRadius(h / 2), alpha = out)
            drawRoundRect(Color(0xFFFFF3CF).copy(alpha = out), Offset(c.x - w / 2, c.y - h / 2), Size(w, h), CornerRadius(h / 2), style = Stroke(1.5f.dp.toPx()))
            drawText(lay, topLeft = Offset(c.x - lay.size.width / 2f, c.y - lay.size.height / 2f))
        }
    }
    // The one trail line ("Optimistic Scavenger: +1/+1 counter on Grizzly Bears"), beside the card it landed on.
    if (it.note.isNotEmpty()) {
        val a = (if (still) 1f else smooth(200f, 340f, ms)) * out
        val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFF7EEDA).copy(alpha = a))
        val padX = 10.dp.toPx(); val padY = 5.dp.toPx()
        // In the free band between the CPU's tucked hand and its top row, clear of the phase track and the CPU's seat, measured
        // from the table's own boxes each frame (any size, either screen): one line, cut with an ellipsis when it does not fit.
        val bd = band ?: trailBand(size.width, size.height, emptyMap(), 4.dp.toPx())
        val lay = tm.measure(it.note, style, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, maxLines = 1, softWrap = false,
            constraints = androidx.compose.ui.unit.Constraints(maxWidth = (bd.width - 2 * padX).toInt().coerceAtLeast(1)))
        val w = lay.size.width + 2 * padX; val h = lay.size.height + 2 * padY
        val x = (to.center.x - w / 2).coerceIn(bd.left, (bd.right - w).coerceAtLeast(bd.left))
        val y = bd.center.y - h / 2
        drawRoundRect(Color(0xE60C0C10).copy(alpha = .92f * a), Offset(x, y), Size(w, h), CornerRadius(h / 2))
        drawRoundRect(it.caster.copy(alpha = .75f * a), Offset(x, y), Size(w, h), CornerRadius(h / 2), style = Stroke(1.dp.toPx()))
        drawText(lay, topLeft = Offset(x + padX, y + padY))
    }
}

@Composable private fun key(k: Any, content: @Composable () -> Unit) = androidx.compose.runtime.key(k) { content() }

@Composable
private fun Ghost(it: FxItem, fx: Battlefield, anchors: Anchors, self: Offset, density: androidx.compose.ui.unit.Density) {
    val r = it.from!!
    // The anchor is the tile's box on screen, so a tapped card's box is the bounds of the turned card: undo the 20° turn.
    val turn = if (it.ghost?.tapped == true) 20f else 0f
    val (gw, gh) = if (turn == 0f) r.width to r.height else {
        val c = cos(turn * PI.toFloat() / 180f); val s = sin(turn * PI.toFloat() / 180f); val k = c * c - s * s
        ((r.width * c - r.height * s) / k).coerceAtLeast(8f) to ((r.height * c - r.width * s) / k).coerceAtLeast(8f)
    }
    val w = with(density) { gw.toDp() }; val h = with(density) { gh.toDp() }
    Box(Modifier.offset { IntOffset((r.center.x - gw / 2 - self.x).roundToInt(), (r.center.y - gh / 2 - self.y).roundToInt()) }.size(w, h)
        .graphicsLayer {
            val p = it.p(fx.now.longValue)
            if (p < 0f) { alpha = 1f; return@graphicsLayer }
            if (fx.reduced) { alpha = 1f - smooth(.3f, 1f, p); return@graphicsLayer }
            val drift = smooth(.28f, 1f, p)
            if (it.kind == Fx.SPENT) {
                // P6, After: the spent spell shrinks to .3 on its way to its owner's graveyard (320 ms, gathering speed) and is gone.
                val q = (p * SPENT_MS / 320f).coerceAtMost(1f); val e = q * q * q
                anchors.version.intValue
                val g = it.toKey?.let { k -> anchors.rects[k] }
                if (g != null) { translationX = (g.center.x - r.center.x) * e; translationY = (g.center.y - r.center.y) * e }
                val s = 1f - .7f * e; scaleX = s; scaleY = s; alpha = 1f - smooth(.55f, 1f, q)
            } else if (it.toKey != null) {
                // P5, a kill: it shudders where it stands (240), then swells 18 % and is gone (200); its embers carry it to the square.
                val ms = p * DEATH_MS; val q = (ms / 240f).coerceAtMost(1f); val out = ((ms - 240f) / 200f).coerceIn(0f, 1f)
                rotationZ = turn + sin(q * 40f) * 2.9f * (1f - q)
                val s = 1f + .18f * (1f - (1f - out) * (1f - out)); scaleX = s; scaleY = s
                alpha = 1f - out
            } else { val s = 1f - .12f * drift; scaleX = s; scaleY = s; rotationZ = turn; alpha = 1f - smooth(.7f, 1f, p) }
        }
        .drawWithContent {
            if (fx.reduced || fx.low || it.kind == Fx.SPENT) { drawContent(); return@drawWithContent }
            val p = it.p(fx.now.longValue).coerceAtLeast(0f)
            val kill = it.toKey != null; val ms = p * DEATH_MS
            val brk = if (kill) smooth(240f, DEATH_MS.toFloat(), ms) else smooth(.12f, .55f, p)
            val n = 6; val bh = size.height / n
            for (i in 0 until n) {
                val dx = (if (i % 2 == 0) 1f else -1f) * brk * (5f + i * 1.4f) * density.density
                val dy = brk * (i - n / 2f) * 1.6f * density.density
                clipRect(0f, i * bh, size.width, (i + 1) * bh) { translate(dx, dy) { this@drawWithContent.drawContent() } }
            }
            // Holo seams where the bands part.
            if (brk > 0f) for (i in 1 until n) {
                val y = i * bh + brk * (i - n / 2f) * 1.6f * density.density
                drawLine(Brush.horizontalGradient(listOf(Color(0xFF6FF2FF), Color(0xFFE77CFF), Color(0xFFFFE07A), Color(0xFF6FF2FF))),
                    Offset(-4f, y), Offset(size.width + 4f, y), strokeWidth = 1.6f * density.density, alpha = (.9f * brk * (1f - smooth(.6f, 1f, p))))
            }
            if (kill) {
                // It greys as it shudders, then one white flash (160 ms) as it breaks.
                drawRect(Color(0xFF55524E).copy(alpha = .62f * smooth(0f, 200f, ms)))
                if (ms >= 240f && ms < 400f) drawRect(Color.White.copy(alpha = 1f - (ms - 240f) / 160f))
            }
            // The hit-stop: a white flash for the first 70 ms.
            else if (p < .12f) drawRect(Color.White.copy(alpha = .45f * (1f - p / .12f)))
        }
        .clip(RoundedCornerShape(10.dp))) {
        CardImage(it.ghost!!.name, Modifier.fillMaxSize(), crop = it.kind != Fx.SPENT) {
            val (a, b) = frameTone(cardColors(it.ghost))
            Box(Modifier.fillMaxSize().drawWithContent { drawRect(Brush.linearGradient(listOf(a, b))) })
        }
    }
}

private fun DrawScope.glowRing(r: Rect, col: Color, a: Float, spread: Float, round: Boolean = false) {
    if (a <= 0.01f) return
    drawIntoCanvas { c ->
        val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = spread; color = col.copy(alpha = a.coerceIn(0f, 1f)).toArgb(); maskFilter = BlurMaskFilter(spread, BlurMaskFilter.Blur.NORMAL) }
        if (round) c.nativeCanvas.drawCircle(r.center.x, r.center.y, r.minDimension / 2 + spread / 2, p)
        else c.nativeCanvas.drawRoundRect(r.left - spread / 2, r.top - spread / 2, r.right + spread / 2, r.bottom + spread / 2, 10.dp.toPx(), 10.dp.toPx(), p)
    }
}

private fun DrawScope.comet(from: Offset, to: Offset, p: Float, col: Color, lift: Float) {
    val n = 9
    for (i in n downTo 0) {
        val q = (p - i * .035f).coerceIn(0f, 1f)
        val e = 1f - (1f - q).let { it * it }
        val at = lerpO(from, to, e).let { it.copy(y = it.y - sin(PI.toFloat() * e) * lift) }
        val k = 1f - i.toFloat() / (n + 1)
        drawCircle(col.copy(alpha = .75f * k), radius = (2.5f + 4f * k) * density, center = at)
        if (i == 0) drawCircle(Brush.radialGradient(listOf(col.copy(alpha = .6f), Color.Transparent), center = at, radius = 18f * density), radius = 18f * density, center = at)
    }
}

private fun DrawScope.drawDraw(it: FxItem, p: Float, lib: Rect?, hand: Rect) {
    val from = lib?.center ?: Offset(size.width - 60f * density, size.height / 2)
    val to = Offset(hand.center.x, hand.top + hand.height * .45f)
    val e = 1f - (1f - p).let { x -> x * x }
    val at = lerpO(from, to, e).let { o -> o.copy(y = o.y - sin(PI.toFloat() * e) * 30f * density) }
    val w = 30f * density * (1f + .5f * e); val h = w * 1.4f
    // Flips into the hand: the back narrows past the middle of the move and the face side widens again.
    val flip = abs(cos(PI.toFloat() * e))
    val a = if (it.mine) 1f else .7f
    rotate(-12f * (1f - e), pivot = at) {
        val tl = Offset(at.x - w * flip / 2, at.y - h / 2)
        drawRoundRect(Brush.linearGradient(listOf(Color(0xFF2A2F55), Color(0xFF14172B)), tl, tl + Offset(w, h)), tl, Size(w * flip, h), CornerRadius(3f * density), alpha = a * (1f - smooth(.85f, 1f, p)))
        drawRoundRect(Color(0xFFC9A75A), tl, Size(w * flip, h), CornerRadius(3f * density), style = Stroke(1.2f * density), alpha = a * (1f - smooth(.85f, 1f, p)))
    }
}

private fun DrawScope.drawCast(it: FxItem, p: Float, from: Rect, stack: Rect?) {
    val to = stack?.center ?: Offset(size.width - 150f * density, size.height / 2)
    val travel = (p / .65f).coerceAtMost(1f)
    if (travel < 1f) comet(from.center, to, travel, it.tone, 40f * density * (if (it.mine) 1f else -1f))
    if (p > .55f) { val q = (p - .55f) / .45f; ripple(to, (stack?.maxDimension ?: 80f * density) * .5f, q, it.tone) }
}

private fun DrawScope.ripple(c: Offset, base: Float, q: Float, col: Color) {
    for (j in 0..1) {
        val k = (q - j * .25f).coerceIn(0f, 1f); if (k <= 0f) continue
        drawCircle(col.copy(alpha = .6f * (1f - k)), radius = base * (.6f + .9f * k), center = c, style = Stroke((3f - 2f * k) * density))
    }
}

private fun DrawScope.drawResolve(it: FxItem, p: Float, stack: Rect?, target: Rect?) {
    val c = stack?.center ?: Offset(size.width - 150f * density, size.height / 2)
    ripple(c, (stack?.maxDimension ?: 80f * density) * .5f, (p / .6f).coerceAtMost(1f), it.tone)
    if (stack != null) drawRoundRect(Color.White.copy(alpha = .35f * (1f - smooth(0f, .5f, p))), stack.topLeft, stack.size, CornerRadius(8f * density))
    if (target != null) {
        // The spell's light runs to what it targets: a bright head with a fading line behind it.
        val q = smooth(.1f, .8f, p)
        val head = lerpO(c, target.center, q)
        drawLine(Brush.linearGradient(listOf(it.tone.copy(alpha = 0f), it.tone.copy(alpha = .85f)), c, head), c, head, strokeWidth = 2.5f * density, alpha = 1f - smooth(.8f, 1f, p))
        drawCircle(Brush.radialGradient(listOf(Color.White, it.tone.copy(alpha = .6f), Color.Transparent), center = head, radius = 14f * density), radius = 14f * density, center = head, alpha = 1f - smooth(.85f, 1f, p))
    }
}

private fun DrawScope.drawArrive(it: FxItem, p: Float, r: Rect) {
    if (p < .62f) return
    val q = (p - .62f) / .38f
    // The landing: a light sweep across the card, and a land's mana glow in its colour.
    val shape = Path().apply { addRoundRect(RoundRect(r, CornerRadius(10f * density))) }
    clipPath(shape) {
        val x = r.left - r.width * .6f + (r.width * 2.2f) * q
        drawRect(Brush.linearGradient(listOf(Color.Transparent, Color.White.copy(alpha = .42f), Color.Transparent), Offset(x - r.width * .3f, r.top), Offset(x + r.width * .3f, r.bottom)), r.topLeft, r.size)
    }
    glowRing(r, it.tone, (if (it.land) .9f else .55f) * sin(PI.toFloat() * q), (if (it.land) 10f else 7f) * density)
    if (it.land) drawCircle(Brush.radialGradient(listOf(it.tone.copy(alpha = .35f * sin(PI.toFloat() * q)), Color.Transparent), center = r.center, radius = r.maxDimension), radius = r.maxDimension, center = r.center)
}

internal const val ENTRANCE1_MS = 1070L
internal const val ENTRANCE2_MS = 2330L
/** When a level 2 entrance's slam starts (ms): 520 fly + 1050 hold. */
internal const val E2_SLAM = 1570f

/** Level 1 and 2 entrances' light (table additions 3): gold rings and flash at the landing, the sweep and the name for level 2. */
private fun DrawScope.drawEntrance(tm: androidx.compose.ui.text.TextMeasurer, it: FxItem, p: Float, r: Rect, centre: Offset?) {
    val ms = p * it.dur
    val gold = Color(0xFFF3D27E)
    fun ring(at: Float, radiusPx: Float, len: Float = 520f) {
        val q = (ms - at) / len; if (q !in 0f..1f) return
        drawCircle(gold.copy(alpha = .9f * (1f - q)), radius = radiusPx / 2f * (.35f + .65f * q) * density, center = r.center, style = Stroke((4f - 3f * q) * density))
    }
    fun flash(at: Float, radiusPx: Float, len: Float) {
        val q = (ms - at) / len; if (q !in 0f..1f) return
        val rad = radiusPx / 2f * density * (.6f + .4f * q)
        drawCircle(Brush.radialGradient(listOf(Color.White.copy(alpha = .85f * (1f - q)), gold.copy(alpha = .45f * (1f - q)), Color.Transparent), center = r.center, radius = rad), radius = rad, center = r.center)
    }
    if (it.entrance == 1) {
        ring(650f, 250f); ring(740f, 160f); flash(650f, 280f, 280f)
        return
    }
    val c = centre ?: r.center
    // While it holds at the centre: a light sweep across the card (800 ms) and the name in Cinzel gold with its line.
    if (ms in 520f..E2_SLAM) {
        val w = r.width * 2.3f; val h = r.height * 2.3f
        val card = Rect(c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2)
        val q = ((ms - 520f) / 800f).coerceIn(0f, 1f)
        if (q < 1f) clipPath(Path().apply { addRoundRect(RoundRect(card, CornerRadius(14f * density))) }) {
            val x = card.left - card.width * .6f + card.width * 2.2f * q
            drawRect(Brush.linearGradient(listOf(Color.Transparent, Color.White.copy(alpha = .5f), Color.Transparent), Offset(x - card.width * .3f, card.top), Offset(x + card.width * .3f, card.bottom)), card.topLeft, card.size)
        }
        val a = smooth(520f, 940f, ms) * (1f - smooth(E2_SLAM - 120f, E2_SLAM, ms))
        val (name, line) = it.title.split("\n").let { s -> s[0] to s.getOrElse(1) { "" } }
        val big = tm.measure(name, TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, color = gold.copy(alpha = a)))
        val small = tm.measure(line, TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, letterSpacing = 1.2.sp, color = Color(0xFFF6EEDB).copy(alpha = a)))
        val y0 = (card.bottom + 12f * density).coerceAtMost(size.height - big.size.height - small.size.height - 8f * density)
        drawText(big, topLeft = Offset(c.x - big.size.width / 2f, y0))
        drawText(small, topLeft = Offset(c.x - small.size.width / 2f, y0 + big.size.height))
    }
    // The slam: three rings (460/300/200 px) and a 460 px flash after the 110 ms hit-stop.
    val land = E2_SLAM + 150f + 110f
    ring(land, 460f, 600f); ring(land + 90f, 300f, 560f); ring(land + 180f, 200f, 500f); flash(land, 460f, 380f)
}

private fun DrawScope.drawToken(p: Float, r: Rect) {
    // Form from light: motes gather into the card while a bloom fades.
    val bloom = 1f - smooth(.2f, .8f, p)
    drawCircle(Brush.radialGradient(listOf(Color.White.copy(alpha = .75f * bloom), Color(0xFFF3D27E).copy(alpha = .3f * bloom), Color.Transparent), center = r.center, radius = r.maxDimension), radius = r.maxDimension, center = r.center)
    val gather = smooth(0f, .7f, p)
    for (i in 0 until 14) {
        val ang = i / 14f * 2f * PI.toFloat() + .4f
        val rad = r.maxDimension * (1.1f - gather)
        val at = r.center + Offset(cos(ang) * rad, sin(ang) * rad)
        drawCircle(Color(0xFFFFF4D6).copy(alpha = .9f * (1f - smooth(.7f, 1f, p))), radius = 2.2f * density, center = at)
    }
}

/** The strike (spec 3): ghost trails behind the lunge (5 for a clash, 7 for a face), then at contact a white-gold flash
 *  growing to 1.7x, two shock rings (white-gold, then orange 90 ms later, 620 ms) and sparks that fall (28, or 36 at a face). */
/** Draws [block] everywhere but inside the pill [r] (a box with round ends); all of it when [r] is null. */
private inline fun DrawScope.clipOut(r: Rect?, block: DrawScope.() -> Unit) {
    if (r == null) block()
    else clipPath(androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(r, CornerRadius(r.height / 2))) }, androidx.compose.ui.graphics.ClipOp.Difference) { block() }
}

private fun DrawScope.drawLunge(fx: Battlefield, it: FxItem, a: Rect?, b: Rect?, sq: Rect? = null, lifePill: Rect? = null) {
    if (a == null || b == null) return
    val face = Strike.face(it); val low = fx.low
    val ms = (fx.now.longValue - it.t0).toFloat()
    val dir = b.center - a.center; val len = kotlin.math.hypot(dir.x, dir.y).coerceAtLeast(1f)
    val ux = dir.x / len; val uy = dir.y / len
    val reach = strikeReach(a, b, face, sq); val pull = strikePull(len, density)
    val w0 = Strike.wind(face); val h0 = Strike.hit(face)
    if (!low && ms in w0..h0) {
        val n = if (face) 7 else 5
        // The card itself keeps its art: a trail shows only where it has fallen behind the card (no pale cover on the windup).
        val now = Strike.offset(face, ms, reach, pull)
        for (i in 1..n) {
            val mi = (ms - i * (h0 - w0) * .07f).coerceAtLeast(w0); val off = Strike.offset(face, mi, reach, pull)
            val apart = smooth(0f, minOf(a.width, a.height) * .9f, kotlin.math.abs(now - off))
            if (apart <= 0f) continue
            val sc = Strike.scale(face, mi); val w = a.width * sc; val h = a.height * sc; val cx = a.center.x + ux * off; val cy = a.center.y + uy * off
            // F6 (design review): with Match effects on the after-images are the card's own colour, from 18 %, each dimmer than the last.
            val ghost = if (TableFeel.mode() == TableFeel.Mode.OFF) Color(0xFFFFE2B0).copy(alpha = .5f * apart * (1f - i / (n + 1f))) else it.tone.copy(alpha = TableFeel.CHARGE_GHOST * apart * (1f - (i - 1f) / n))
            drawRoundRect(ghost, Offset(cx - w / 2, cy - h / 2), Size(w, h), CornerRadius(10f * density))
        }
    }
    // F6, the charge: on the dash the card leaves sparks in its own colour behind it, thrown back along its line.
    val feel = !low && TableFeel.mode() != TableFeel.Mode.OFF
    if (feel && ms in w0..h0) {
        val k = ((ms - w0) / TableFeel.CHARGE_TRAIL_EVERY_MS).toInt()
        if (k > it.trail) { it.trail = k
            val off = Strike.offset(face, ms, reach, pull) - TableFeel.CHARGE_TRAIL_BACK * density
            fx.bits.glows(a.center + Offset(ux, uy) * off, TableFeel.CHARGE_TRAIL_PER, it.tone, fx.now.longValue, TableFeel.CHARGE_TRAIL_SPEED * .25f * density, dir = kotlin.math.atan2(-uy, -ux),
                spread = TableFeel.CHARGE_TRAIL_SPREAD, across = a.width * Strike.scale(face, ms, TableFeel.chargeSwell()) / 2, lifeMs = TableFeel.CHARGE_TRAIL_LIFE_MS,
                corePx = TableFeel.CHARGE_TRAIL_SIZE * density, glowPx = TableFeel.CHARGE_TRAIL_GLOW * density, seed = ((it.card ?: 0) + k * 13) and 0xff) }
    }
    // Contact, then the freeze: nothing new draws until it ends.
    val t = ms - Strike.after(face)
    if (t < 0f) return
    // Where the blow lands: the struck tile's near edge, or the middle of the profile picture.
    val at = if (face) b.center else b.center - Offset(ux, uy) * (minOf(b.width, b.height) * .42f)
    // P5: sparks thrown on past the hit, away from the attacker, with a quick white ring and a soft blob; once, when the freeze ends.
    if (!low && it.once(1)) {
        val now = fx.now.longValue; val seed = (it.card ?: 0) and 0xff; val away = kotlin.math.atan2(uy, ux)
        // F6: white spikes and one ring in the attacker's colour where the blow lands.
        if (!face) {
            fx.bits.sparks(at, 24, Color(0xFFFFF3D0), now, 330f * density, dir = away, spread = 1.25f, lifeMs = 520, sizePx = 1.6f * density, seed = seed)
            fx.bits.sparks(at, 10, Color(0xFFF3D27E), now, 170f * density, lifeMs = 480, sizePx = 1.4f * density, seed = seed + 7)
            fx.bits.ring(at, 65.dp.toPx(), Color.White, now, lifeMs = 260)
            fx.bits.blob(at, 60.dp.toPx(), Color(0xFFFFF3D0), now, lifeMs = 160)
        }
    }
    // F6: the life number is the pay-off, so at a player nothing of the burst is drawn over the life pill.
    clipOut(lifePill?.takeIf { feel && face }) {
        // F6: the ring in the attacker's colour, from the struck seat's (or tile's) size, thinning as it grows.
        if (feel && t < TableFeel.CHARGE_RING_MS) { val k = t / TableFeel.CHARGE_RING_MS; val r0 = (sq ?: b).maxDimension / 2
            drawCircle(it.tone.copy(alpha = 1f - .6f * k), radius = r0 * (1f + (TableFeel.CHARGE_RING_GROW - 1f) * k), center = (sq ?: b).center,
                style = Stroke((TableFeel.CHARGE_RING_FROM + (TableFeel.CHARGE_RING_TO - TableFeel.CHARGE_RING_FROM) * k) * density)) }
        // Flash: 150 dp of white-gold growing to 1.7x and gone; and a white flash on both tiles of a clash (240 and 280 ms).
        val fq = (t / 260f).coerceIn(0f, 1f)
        // F6: the life number is the pay-off, so at a player the flash is not drawn over the life pill.
        if (fq < 1f) drawCircle(Brush.radialGradient(listOf(Color.White.copy(alpha = .95f * (1f - fq)), Color(0xFFFFD98A).copy(alpha = .7f * (1f - fq)), Color.Transparent), center = at, radius = 75.dp.toPx() * (1f + .7f * fq)), radius = 75.dp.toPx() * (1f + .7f * fq), center = at)
        if (!face && t < 280f) drawRoundRect(Color.White.copy(alpha = .8f * (1f - t / 280f)), b.topLeft, b.size, CornerRadius(10f * density))
        // Shock rings: white-gold, then orange 90 ms later (face: and red), 620 ms each.
        val rings = if (face) listOf(Color(0xFFFFF4D6), Color(0xFFFF4A3A), Color(0xFFF0C27A)) else listOf(Color(0xFFFFF0C8), Color(0xFFFF9A3C))
        rings.forEachIndexed { j, col -> val k = ((t - j * 90f) / 620f).coerceIn(0f, 1f); if (k > 0f && k < 1f)
            drawCircle(col.copy(alpha = .9f * (1f - k)), radius = b.maxDimension * (.35f + (if (face) 2.4f else 1.6f) * k), center = at, style = Stroke((6f - 5f * k) * density)) }
        // F6: white spikes that taper to a point (300 ms), drawn here so the life pill stays clear of them too.
        if (feel && t < 300f) { val q = t / 300f; val grow = minOf(1f, q / .35f); val al = 1f - smooth(.4f, 1f, q); val seed = (it.card ?: 0) and 0xff
            for (j in 0 until TableFeel.CHARGE_SPIKES) {
                val ang = (2 * PI).toFloat() * ((j + .5f) / TableFeel.CHARGE_SPIKES) + (((seed + j * 7) * 0.6180339f) % 1f - .5f) * .35f
                val len = TableFeel.CHARGE_SPIKE_LEN * density * (.7f + .3f * (((j * 11 + seed) * 0.6180339f) % 1f))
                val d = Offset(cos(ang), sin(ang)); val n = Offset(-d.y, d.x) * (1.8f * density)
                val from = at + d * (len * .25f * grow); val to = at + d * (len * grow)
                drawPath(androidx.compose.ui.graphics.Path().apply { moveTo(from.x + n.x, from.y + n.y); lineTo(to.x, to.y); lineTo(from.x - n.x, from.y - n.y); close() }, Color.White.copy(alpha = al))
            }
        }
    }
}

/** P6, Fire: the spell's place on the stack swells 8 % and flashes in its colour (110 ms), then a thick streak crosses to the target (130). */
private fun DrawScope.drawFire(it: FxItem, p: Float, stack: Rect?, target: Rect?) {
    val ms = p * FIRE_MS
    val from = stack?.center ?: Offset(size.width - 80f * density, size.height / 2)
    if (stack != null && it.lead) { val q = (ms / 200f).coerceAtMost(1f); val grow = stack.minDimension * .04f * (1f - (1f - q) * (1f - q))
        drawRoundRect(Brush.verticalGradient(listOf(Color.White.copy(alpha = .9f * (1f - q)), it.tone.copy(alpha = .8f * (1f - q))), stack.top, stack.bottom),
            Offset(stack.left - grow, stack.top - grow), Size(stack.width + 2 * grow, stack.height + 2 * grow), CornerRadius(10f * density)) }
    if (target == null || ms < 110f) return
    val q = (ms - 110f) / 130f
    val hot = Color(1f - (1f - it.tone.red) * .45f, 1f - (1f - it.tone.green) * .45f, 1f - (1f - it.tone.blue) * .45f)
    streak(from, target.center, q * q * q, hot, 6.dp.toPx(), tail = .55f, bend = .04f)
}

/**
 * P6, Impact on the tile at [r]: a 115 ms freeze, a white flash (320), a 12 dp shake pushed in 3.5 %, 18 spikes, 30 sparks, a ring, a
 * blob and smoke in the spell's colour. A friendly spell has no freeze and no shake: a soft flash, a ring and rising embers in its light.
 */
private fun DrawScope.drawBolt(fx: Battlefield, it: FxItem, p: Float, r: Rect, stack: Rect?) {
    val ms = p * BOLT_MS; val now = fx.now.longValue; val seed = (it.card ?: 0) and 0xff
    val hostile = it.power > 0f
    if (hostile && it.once(1)) fx.freeze(115L)
    if (!fx.low && it.once(2)) {
        if (hostile) {
            fx.jolt(12f, 300L, .035f)
            fx.bits.spikes(r.center, 18, r.maxDimension * 1.25f, it.tone, now, lifeMs = 300, seed = seed)
            fx.bits.sparks(r.center, 30, it.tone, now, 300f * density, lifeMs = 640, sizePx = 1.7f * density, seed = seed)
            fx.bits.ring(r.center, 90.dp.toPx(), it.tone, now, lifeMs = 340)
            fx.bits.blob(r.center, 75.dp.toPx(), it.tone, now, lifeMs = 220)
            fx.bits.smoke(Offset(r.center.x, r.center.y + r.height * .2f), 7, Color(0xFF8A8478), now, 34f * density, lifeMs = 850, sizePx = r.height * .14f, seed = seed)
        } else {
            fx.bits.ring(r.center, r.maxDimension * .9f, it.tone, now, lifeMs = 420)
            fx.bits.embers(Offset(r.center.x, r.bottom - r.height * .2f), 10, it.tone, now, 60f * density, lifeMs = 800, sizePx = 1.6f * density, seed = seed)
            fx.bits.blob(r.center, r.maxDimension * .7f, it.tone, now, lifeMs = 360)
        }
    }
    if (ms < 320f) drawRoundRect((if (hostile) Color.White else it.tone).copy(alpha = (if (hostile) 1f else .5f) * (1f - ms / 320f)), r.topLeft, r.size, CornerRadius(10f * density))
}

/** P5, the declare: the attacker's coral ring flares where it now stands, with one ring going out from it (300 ms). */
private fun DrawScope.drawDeclare(fx: Battlefield, it: FxItem, p: Float, home: Rect) {
    val ms = p * it.dur
    val step = fx.advancePx * backOut((ms / DECLARE_MS).coerceAtMost(1f)) * (if (it.mine) -1f else 1f)
    val r = home.translate(0f, step)
    glowRing(r, it.tone, .9f * (1f - smooth(.5f, 1f, p)), 14.dp.toPx())
    val q = (ms / 300f).coerceIn(0f, 1f); val e = 1f - (1f - q) * (1f - q)
    val grow = r.minDimension * .45f * e
    drawRoundRect(it.tone.copy(alpha = .9f * (1f - q)), Offset(r.left - grow, r.top - grow), Size(r.width + 2 * grow, r.height + 2 * grow), CornerRadius(10f * density + grow), style = Stroke((3f * (1f - q) + 1f) * density))
}

/**
 * P5, a kill's embers: nine streaks, gold and bone, leave the place the card stood for its owner's graveyard (380 to 560 ms each),
 * with pale sparks and a little smoke where it broke; when the last has landed (580) the pile answers with a gold ring (300).
 */
private fun DrawScope.drawEmbers(fx: Battlefield, it: FxItem, p: Float, r: Rect, grave: Rect?) {
    val ms = p * EMBERS_MS; val seed = (it.card ?: 3)
    if (it.once(1)) { val now = fx.now.longValue
        fx.bits.sparks(r.center, 18, Color(0xFFE9DFC8), now, 130f * density, lifeMs = 600, sizePx = 1.5f * density, seed = seed and 0xff)
        fx.bits.smoke(r.center, 6, Color(0xFF8A8478), now, 30f * density, lifeMs = 800, sizePx = r.height * .14f, seed = seed and 0xff) }
    val to = grave?.center ?: return
    val rnd = java.util.Random(seed.toLong() * 131L + 7L)
    for (i in 0 until 9) {
        val from = Offset(r.left + rnd.nextFloat() * r.width, r.top + rnd.nextFloat() * r.height)
        val life = 380f + rnd.nextFloat() * 180f; val bend = (rnd.nextFloat() - .5f) * .6f
        val q = ms / life
        if (q < 1f) streak(from, to, q * q * (3f - 2f * q), if (i % 2 == 1) Color(0xFFF3D27E) else Color(0xFFCFC6B4), 3.5f * density, tail = .3f, bend = bend)
    }
    val k = (ms - 580f) / 300f
    if (k in 0f..1f) drawCircle(Color(0xFFF3D27E).copy(alpha = .9f * (1f - k)), radius = 15.dp.toPx() + 25.dp.toPx() * (1f - (1f - k) * (1f - k)), center = to, style = Stroke((2f * (1f - k) + .6f) * density))
}

/** A hit to a face: a red flash across the board edge, a big shockwave from the orb, sparks, and the life number slamming in. */
private fun DrawScope.faceHit(fx: Battlefield, it: FxItem, p: Float, r: Rect, low: Boolean = false) {
    val k = it.power
    val ms = p * it.dur
    // P5: coral spikes off the square, a ring and sparks, thrown once on the frame the freeze ends.
    if (!low && it.once(1)) {
        val now = fx.now.longValue; val coral = Color(0xFFFF6A4A); val seed = (it.player ?: 0) and 0xff
        fx.bits.spikes(r.center, 14, r.maxDimension * (1.2f + .6f * k), coral, now, lifeMs = 300, seed = seed)
        fx.bits.ring(r.center, r.maxDimension * 1.7f, coral, now, lifeMs = 360)
        fx.bits.sparks(r.center, (16 + 12 * k).toInt(), coral, now, 290f * density, lifeMs = 600, sizePx = 1.6f * density, seed = seed)
    }
    // Red at the screen's edges only, peaking near 0.9 and gone by about 700 ms.
    // Mobile table M10 (and match-punch-brief): only when you are hit. Damage to the CPU does not wash the screen red. Yours is
    // the hit on your own life; with no viewer known (a drawn test), the square in the lower half is yours.
    val you = fx.viewerId?.let { v -> it.player == v } ?: (r.center.y > size.height / 2)
    val vig = if (!you) 0f else (if (ms < 90f) ms / 90f else 1f - smooth(90f, 700f, ms)) * .9f * (.75f + .25f * k)
    // The red vignette lives at the screen's edges; the middle of the board stays readable.
    // A band along each edge, as deep on a wide screen's sides as on its top and bottom, so the board stays readable.
    val band = size.minDimension * .24f; val red = Color(0xFFE02A1A).copy(alpha = vig)
    drawRect(Brush.horizontalGradient(listOf(red, Color.Transparent), 0f, band), Offset.Zero, Size(band, size.height))
    drawRect(Brush.horizontalGradient(listOf(Color.Transparent, red), size.width - band, size.width), Offset(size.width - band, 0f), Size(band, size.height))
    drawRect(Brush.verticalGradient(listOf(red, Color.Transparent), 0f, band), Offset.Zero, Size(size.width, band))
    drawRect(Brush.verticalGradient(listOf(Color.Transparent, red), size.height - band, size.height), Offset(0f, size.height - band), Size(size.width, band))
    for (j in 0..2) { val q = ((p - j * .08f) / .6f).coerceIn(0f, 1f); if (q > 0f)
        drawCircle(it.tone.copy(alpha = .85f * (1f - q)), radius = r.maxDimension * (.5f + (2.4f + 2f * k) * q), center = r.center, style = Stroke((7f - 6f * q) * density)) }
    // The flash: a white-gold burst on the struck portrait only, 150 dp, 120 ms in and 200 ms out.
    val fl = if (ms < 120f) ms / 120f else 1f - ((ms - 120f) / 200f).coerceIn(0f, 1f)
    if (fl > 0f) { val rad = 150.dp.toPx()
        drawCircle(Brush.radialGradient(0f to Color.White.copy(alpha = .95f * fl), .35f to Color(0xFFFFE6A8).copy(alpha = .75f * fl), .7f to it.tone.copy(alpha = .3f * fl), 1f to Color.Transparent, center = r.center, radius = rad), radius = rad, center = r.center) }
    if (low) return
    // Magic: gold and violet light rays fan out of the orb and arcane motes drift up the board.
    val rays = 12; val rq = smooth(0f, .55f, p) * (1f - smooth(.55f, 1f, p))
    for (i in 0 until rays) { val ang = i / rays.toFloat() * 6.283f + .3f; val l0 = r.maxDimension * .6f; val l1 = r.maxDimension * (1.4f + 3.2f * k) * rq
        val a = Offset(cos(ang), sin(ang)); drawLine(Brush.linearGradient(listOf(Color(0xFFFFE9A8).copy(alpha = .8f * rq), Color(0xFFB58CFF).copy(alpha = 0f)), r.center + a * l0, r.center + a * (l0 + l1)), r.center + a * l0, r.center + a * (l0 + l1), strokeWidth = 3f * density) }
    val mr = java.util.Random(5L)
    for (i in 0 until 26) { val x = mr.nextFloat() * size.width; val y0 = size.height * (.3f + .6f * mr.nextFloat()); val t = smooth(.1f, 1f, p)
        drawCircle((if (i % 2 == 0) Color(0xFFFFE9A8) else Color(0xFFC9A8FF)).copy(alpha = .8f * (1f - t) * smooth(0f, .2f, p)), radius = (1.6f + 1.6f * mr.nextFloat()) * density, center = Offset(x + 12f * density * sin(t * 6f + i), y0 - t * 90f * density)) }
    val rnd = java.util.Random(11L); val q = smooth(0f, .8f, p)
    for (i in 0 until (18 + 20 * k).toInt()) { val ang = rnd.nextFloat() * 6.283f; val sp = (40f + rnd.nextFloat() * 140f) * density * q
        drawCircle(Color(0xFFFFB070).copy(alpha = 1f - q), radius = 2.8f * density * (1f - q * .5f), center = r.center + Offset(cos(ang), sin(ang)) * sp) }
}

/** The block (spec 3, P5): a pulse down the thread, an ice ring flaring over the blocker as it steps in, and BLOCKED slamming from 3x beside it. */
private fun DrawScope.drawBlock(tm: androidx.compose.ui.text.TextMeasurer, it: FxItem, p: Float, a: Rect, b: Rect, still: Boolean = false) {
    val ms = p * BLOCK_MS
    val pulse = (ms / 190f).coerceAtMost(1f)
    if (!still && pulse < 1f) for (j in 0..1) {
        val q = (pulse * 1.25f - j * .25f).coerceIn(0f, 1f); if (q <= 0f || q >= 1f) continue
        val at = lerpO(a.center, b.center, q)
        drawCircle(Brush.radialGradient(listOf(Color.White, Color(0xFF6AAEFF).copy(alpha = .7f), Color.Transparent), center = at, radius = 12f * density), radius = 12f * density, center = at)
    }
    // Centred on the blocker where its slide put it, the tile plus 12 %.
    val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y; val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f)
    val slide = if (still) 0f else minOf(70.dp.toPx(), dist * .45f) * easeOutBack((ms / 190f).coerceAtMost(1f)) * (1f - smooth(550f, BLOCK_MS.toFloat(), ms))
    val c = a.center + Offset(dx / dist * slide, dy / dist * slide)
    val flare = smooth(0f, 190f, ms); val out = 1f - smooth(520f, BLOCK_MS.toFloat(), ms)
    // Table thread 19:04Z: shield and stamp 1.4x so they read at phone scale.
    val grow = 1.12f * 1.4f * (1.2f - .2f * flare)
    val sw = a.width * grow; val sh = a.height * grow
    val oval = Rect(c.x - sw / 2, c.y - sh / 2, c.x + sw / 2, c.y + sh / 2)
    val rad = CornerRadius(minOf(sw, sh) * .18f)
    // P5: the block's light is ice blue (the blocker's own ring colour), where the attack's is coral.
    val gold = Color(0xFF8CC4FF)
    if (!still) drawIntoCanvas { cv ->
        val glow = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = 14.dp.toPx(); color = gold.copy(alpha = .75f * flare * out).toArgb(); maskFilter = BlurMaskFilter(20.dp.toPx(), BlurMaskFilter.Blur.NORMAL) }
        cv.nativeCanvas.drawRoundRect(oval.left, oval.top, oval.right, oval.bottom, rad.x, rad.y, glow)
        val inner = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = 11.dp.toPx(); color = gold.copy(alpha = .4f * flare * out).toArgb(); maskFilter = BlurMaskFilter(11.dp.toPx(), BlurMaskFilter.Blur.INNER) }
        cv.nativeCanvas.drawRoundRect(oval.left + 5.dp.toPx(), oval.top + 5.dp.toPx(), oval.right - 5.dp.toPx(), oval.bottom - 5.dp.toPx(), rad.x, rad.y, inner)
    }
    if (!still) drawRoundRect(Color(0xFFE2F1FF).copy(alpha = .95f * flare * out), oval.topLeft, oval.size, rad, style = Stroke(3.5f * density))
    // BLOCKED: gold, letter-spaced, -4 degrees, slams from 3x to 1x, held, then fades with the shield.
    val slam = if (still) 1f else smooth(60f, 190f, ms); if (slam <= 0f) return
    val k = 3f - 2f * slam
    val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Black, fontSize = 42.sp, letterSpacing = .18.em, color = gold)
    val lay = tm.measure("BLOCKED", style)
    // The stamp goes on whichever side of the blocker has more room.
    val side = if (c.x > size.width - c.x) -1f else 1f
    val at = Offset((c.x + side * (sw / 2 + lay.size.width * .55f)).coerceIn(lay.size.width / 2f + 8f, size.width - lay.size.width / 2f - 8f), c.y)
    val alpha = slam.coerceAtMost(1f) * out
    rotate(-4f, at) { scale(k, at) {
        val tl = Offset(at.x - lay.size.width / 2f, at.y - lay.size.height / 2f)
        for ((dx, dy) in listOf(-2f to 0f, 2f to 0f, 0f to -2f, 0f to 2f)) drawText(tm, "BLOCKED", tl + Offset(dx * density, dy * density), style.copy(color = Color(0xFF06162A).copy(alpha = .9f * alpha)))
        drawText(tm, "BLOCKED", tl, style.copy(brush = Brush.verticalGradient(listOf(Color(0xFFF2F9FF), gold, Color(0xFF4A86D0)), tl.y, tl.y + lay.size.height), alpha = alpha))
    } }
}

private fun DrawScope.drawHit(p: Float, r: Rect) {
    if (p < .2f) drawRoundRect(Color.White.copy(alpha = .5f), r.topLeft, r.size, CornerRadius(10f * density))
    val q = smooth(0f, .7f, p)
    drawCircle(Color(0xFFFFB08A).copy(alpha = .7f * (1f - q)), radius = r.minDimension * (.3f + .6f * q), center = r.center, style = Stroke(3f * density * (1f - q) + .5f))
}

private fun DrawScope.drawPour(p: Float, r: Rect) {
    // Light pours into the card from the top.
    val shape = Path().apply { addRoundRect(RoundRect(r, CornerRadius(10f * density))) }
    val fill = smooth(0f, .7f, p); val a = .45f * (1f - smooth(.6f, 1f, p))
    clipPath(shape) {
        drawRect(Brush.verticalGradient(listOf(Color(0xFFF3D27E).copy(alpha = a), Color.Transparent), r.top, r.top + r.height * fill + 1f), r.topLeft, Size(r.width, r.height * fill + 1f))
    }
}

private fun DrawScope.drawShards(it: FxItem, p: Float, r: Rect, grave: Rect?) {
    if (p < .15f) return
    val to = grave?.center ?: r.center.copy(y = r.center.y + r.height * .3f)
    val rnd = java.util.Random(it.ghost?.id?.toLong() ?: 3L)
    val cols = listOf(Color(0xFF6FF2FF), Color(0xFFE77CFF), Color(0xFFFFE07A))
    for (i in 0 until 18) {
        val sx = r.left + rnd.nextFloat() * r.width; val sy = r.top + rnd.nextFloat() * r.height
        val delay = rnd.nextFloat() * .25f
        val q = smooth(.15f + delay, 1f, p)
        val at = lerpO(Offset(sx, sy), to, q * q).let { o -> o.copy(y = o.y - sin(PI.toFloat() * q) * 18f * density * rnd.nextFloat()) }
        drawRect(cols[i % 3].copy(alpha = .85f * (1f - q)), at, Size(2.6f * density, 2.6f * density))
    }
}

/** A damage number (spec 3): pops to 1.7x with a -5 degree tilt, settles, drifts up and fades over its 1.1 s. */
private fun DrawScope.bigNumber(tm: androidx.compose.ui.text.TextMeasurer, text: String, p: Float, at: Offset, col: Color, sizeSp: Float) {
    if (text.isEmpty()) return
    val s = if (p < .12f) 1f + .7f * (p / .12f) else 1.7f - .7f * smooth(.12f, .3f, p)
    val a = 1f - smooth(.7f, 1f, p)
    val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Black, fontSize = sizeSp.sp, color = col)
    val lay = tm.measure(text, style)
    val y = at.y - 34f * density * smooth(.25f, 1f, p)
    rotate(-5f, Offset(at.x, y)) { scale(s, Offset(at.x, y)) {
        val tl = Offset(at.x - lay.size.width / 2f, y - lay.size.height / 2f)
        for ((dx, dy) in listOf(-2f to 0f, 2f to 0f, 0f to -2f, 0f to 2f)) drawText(tm, text, tl + Offset(dx * density, dy * density), style.copy(color = Color.Black.copy(alpha = .9f * a)))
        drawText(tm, text, tl, style.copy(color = col.copy(alpha = col.alpha * a)))
    } }
}

/** A number pops (1.4× to 1× in the first quarter), rises 14 dp and fades in its last third. */
private fun DrawScope.pop(tm: androidx.compose.ui.text.TextMeasurer, text: String, p: Float, at: Offset, col: Color, sizeSp: Float, down: Boolean = false) {
    if (text.isEmpty()) return
    val s = if (p < .25f) 1.4f - .4f * (p / .25f) else 1f
    val a = 1f - smooth(.66f, 1f, p)
    val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Black, fontSize = sizeSp.sp, color = col)
    val lay = tm.measure(text, style)
    val y = at.y + (if (down) 10f else -14f) * density * smooth(0f, 1f, p)
    scale(s, Offset(at.x, y)) {
        val tl = Offset(at.x - lay.size.width / 2f, y - lay.size.height / 2f)
        // A dark outline so the number reads on any art.
        for ((dx, dy) in listOf(-1.5f to 0f, 1.5f to 0f, 0f to -1.5f, 0f to 1.5f)) drawText(tm, text, tl + Offset(dx * density, dy * density), style.copy(color = Color.Black.copy(alpha = .9f * a)))
        drawText(tm, text, tl, style.copy(color = col.copy(alpha = col.alpha * a)))
    }
}

/**
 * 0.4.59 T5, the cast travels: the card itself on its way. To the stack (440 ms, ease-out): from its place in your hand (on two
 * screens, in through the bottom edge of the top screen) or from the CPU's seat face down, turning face up, growing to the stack
 * size; the stack card stays clear until it arrives. To its slot or host (380 ms): from the stack, the whole card cropping to its
 * art as it shrinks into the tile. A land skips the stack: hand (or the CPU's seat) to its group, 380 ms. With reduce motion
 * nothing moves (the card is simply where it ends) while the same pauses still play.
 */
@Composable
internal fun TravelCard() {
    val m = LocalTravel.current ?: return
    val t = m.travel
    if (t.leg == dev.cardstashy.nativeplay.match.Director.Leg.TAPS || t.leg == dev.cardstashy.nativeplay.match.Director.Leg.REST || t.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_POOL || t.leg == dev.cardstashy.nativeplay.match.Director.Leg.UNTAP) return
    if (LocalBattlefield.current?.reduced == true) return
    val anchors = LocalAnchors.current ?: return
    val name = t.name ?: return
    val toStack = t.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_STACK
    // Mobile table M6: a CPU cast grows from the stack card to be read (82 % of the height on a phone, 64 % on a big screen), is held, and returns.
    val pop = t.leg == dev.cardstashy.nativeplay.match.Director.Leg.POP
    val fromHand = toStack || t.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_GROUP
    // T6: Cancel, from the stack back to its place in your hand (on two screens, off the bottom edge to the hand below).
    val back = t.leg == dev.cardstashy.nativeplay.match.Director.Leg.BACK
    val dual = DualScreen.active
    val p = remember(m.key) { androidx.compose.runtime.mutableFloatStateOf(TravelClock.fixed ?: 0f) }
    val fxB = LocalBattlefield.current
    val density = LocalDensity.current
    LaunchedEffect(m.key) {
        if (TravelClock.fixed != null) return@LaunchedEffect
        val start = withFrameMillis { it }
        var shed = start
        while (p.floatValue < 1f) withFrameMillis { p.floatValue = ((it - start).toFloat() / t.ms.coerceAtLeast(1)).coerceIn(0f, 1f)
            // P2, Lift: the flying card sheds gold embers (two every 45 ms) from where it is.
            if (toStack && fxB != null && !fxB.low && it - start > dev.cardstashy.nativeplay.match.Director.LIFT_MS && it - shed >= 45) { shed = it
                anchors.rects["travelcard"]?.let { r -> fxB.bits.embers(r.center - fxB.origin, 2, Color(0xFFF3D27E), fxB.now.longValue, 34f * density.density, lifeMs = 520, sizePx = 1.2f * density.density, seed = (it % 997).toInt()) } }
        }
    }
    var self by remember { mutableStateOf(Rect.Zero) }
    /** Where it starts: the stack card (to a slot or host), your hand card, the CPU's seat; on two screens your card enters at the bottom edge. */
    fun source(dest: Rect): Rect? {
        val r = anchors.rects
        if (!fromHand) return r["stackcard"]
        if (!t.mine) return r["cpuhand"]
        if (!dual) (r["hand${t.cardId}"] ?: r["hand"])?.let { return it }
        val w = dest.width; val h = dest.height
        return Rect(self.center.x - w / 2, self.bottom, self.center.x + w / 2, self.bottom + h)
    }
    fun frame(): Rect? {
        anchors.version.intValue
        if (pop) {
            val a = anchors.rects["stackcard"] ?: return null
            if (self.isEmpty) return a
            val dp = density.density
            val h = self.height * (if (ZoneLayout.phone(self.width / dp, self.height / dp)) ZoneLayout.POP_PHONE else ZoneLayout.POP_BIG)
            val w = h * a.width / a.height.coerceAtLeast(1f)
            val to = Offset(self.right - w / 2 - 10f * dp, self.center.y)
            val e = dev.cardstashy.nativeplay.match.Director.popAt((p.floatValue * t.ms).toLong())
            val c = lerpO(a.center, to, e); val cw = a.width + (w - a.width) * e; val ch = a.height + (h - a.height) * e
            return Rect(c.x - cw / 2, c.y - ch / 2, c.x + cw / 2, c.y + ch / 2)
        }
        val b = if (back) { val s = anchors.rects["stackcard"] ?: return null
            if (dual) Rect(self.center.x - s.width / 2, self.bottom, self.center.x + s.width / 2, self.bottom + s.height)
            else t.toKey?.let { anchors.rects[it] } ?: anchors.rects["hand"] ?: return null } else t.toKey?.let { anchors.rects[it] } ?: return null
        val a = (if (back) anchors.rects["stackcard"] else source(b)) ?: return null
        val q = p.floatValue
        // P2, Lift: a wind-up first (the card dips 10 dp away from where it is going and shrinks 4 %, 70 ms), then it flies to the
        // stack with a small overshoot.
        val lift = if (toStack) (dev.cardstashy.nativeplay.match.Director.LIFT_MS.toFloat() / t.ms.coerceAtLeast(1)).coerceAtMost(.4f) else 0f
        val u = if (toStack) ((q - lift) / (1f - lift)).coerceIn(0f, 1f) else q
        // P3, the dive: on the stack the card rises 6 % and 12 dp (90 ms), then dives to its slot, accelerating, cropping to its tile.
        val dive = t.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_SLOT
        val rise = if (dive) (dev.cardstashy.nativeplay.match.Director.RISE_MS.toFloat() / t.ms.coerceAtLeast(1)).coerceAtMost(.5f) else 0f
        val v = if (dive) ((q - rise) / (1f - rise)).coerceIn(0f, 1f) else q
        val e = if (toStack) backOut(u) else if (dive) v * v * v else smooth(0f, 1f, q)
        val wind = if (toStack) (if (q < lift) sin(PI.toFloat() / 2 * q / lift) else 1f - smooth(0f, .35f, u)) else 0f
        val up = if (dive) (if (q < rise) 1f - (1f - q / rise).let { it * it } else 1f - v) else 0f
        val c = lerpO(a.center, b.center, e)
        val arc = (if (dive) 0f else sin(PI.toFloat() * e.coerceIn(0f, 1f)) * 20f * density.density * (if (t.mine) -1f else 1f)) +
            wind * 10f * density.density * (if (t.mine) 1f else -1f) - up * 12f * density.density
        val k = 1f - .04f * wind + .06f * up
        val w = (a.width + (b.width - a.width) * e) * k; val h = (a.height + (b.height - a.height) * e) * k
        return Rect(c.x - w / 2, c.y - h / 2 + arc, c.x + w / 2, c.y + h / 2 + arc)
    }
    val rim = if (t.mine) Color(0xFFE8B95B) else CpuRed
    val shape = RoundedCornerShape(8.dp)
    Box(Modifier.fillMaxSize().onGloballyPositioned { self = it.boundsInRoot() }) {
        Box(Modifier
            .layout { measurable, c ->
                val r = frame()
                val pl = measurable.measure(androidx.compose.ui.unit.Constraints.fixed((r?.width ?: 1f).roundToInt().coerceAtLeast(1), (r?.height ?: 1f).roundToInt().coerceAtLeast(1)))
                layout(c.maxWidth, c.maxHeight) { pl.place(((r?.left ?: 0f) - self.left).roundToInt(), ((r?.top ?: 0f) - self.top).roundToInt()) }
            }
            .graphicsLayer {
                if (frame() == null) { alpha = 0f; return@graphicsLayer }
                // The CPU's card turns face up on its way out of the seat.
                if (!t.mine && fromHand) { rotationY = 180f * (1f - smooth(0f, .6f, p.floatValue)); cameraDistance = 12f * density.density }
            }
            .anchorRect("travelcard")
            .semantics { contentDescription = "$name on its way" }
            .clip(shape).background(Color(0xFF141418)).border(2.dp, rim, shape)) {
            // Into a tile the whole card gives way to its art as it shrinks.
            val crop = !fromHand && !pop
            CardImage(name, Modifier.fillMaxSize().graphicsLayer { if (crop) alpha = 1f - smooth(.35f, .9f, p.floatValue) }, crop = false)
            if (crop) CardImage(name, Modifier.fillMaxSize().graphicsLayer { alpha = smooth(.35f, .9f, p.floatValue) }, crop = true)
            if (!t.mine && fromHand) Box(Modifier.fillMaxSize().graphicsLayer { alpha = if (p.floatValue < .3f) 1f else 0f }) { CardBack(Modifier.fillMaxSize()) }
        }
    }
}
