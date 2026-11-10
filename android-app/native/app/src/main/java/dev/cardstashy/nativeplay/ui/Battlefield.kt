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
/** The strike's shape as fractions of its length: windup ends, contact. */
private const val LUNGE_WIND = .18f
private const val LUNGE_HIT = .36f
/** Contact freezes everything for 110 ms (the hit-stop); the flash, rings, shake, numbers and shards come after it. */
private const val HIT_STOP = 110L

internal enum class Fx { DRAW, CAST, RESOLVE, ARRIVE, TOKEN, ATTACK, LUNGE, BLOCK, DAMAGE, LIFE, DEATH, COUNTER,
    /** One attacker's moment in staged combat: the board dims but for [FxItem.ids], a gold line and the pair's glass tag. */
    STAGE }

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
    /** A level 2 entrance's name and its "Your commander" / "Their commander" line. */
    val title: String = "",
) {
    var t0 = 0L; var dur = baseMs; var p0 = 0f
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
    /** The frame clock (ms). Draw lambdas read it; the composition never does. */
    internal val now = mutableLongStateOf(0L)
    /** Bumped when the set of running effects changes, so card layers know to look again. */
    internal val rev = mutableIntStateOf(0)
    /** The board's own jolt: the strongest face hit in flight (0..1) and when it struck. Read in the board's layer only. */
    fun shake(scope: GraphicsLayerScope) {
        val t = now.longValue
        if (reduced) return
        // Camera (table-feel spec 3): the board leans in while a strike travels, 1.07 for a clash and 1.09 for a hit to a face.
        val lunge = items.firstOrNull { it.kind == Fx.LUNGE && it.p(t) in 0f..1f }
        var zoom = 1f
        if (lunge != null) { val p = lunge.p(t); val face = lunge.toKey?.startsWith("orb") == true
            zoom = 1f + (if (face) .09f else .07f) * smooth(.1f, LUNGE_HIT, p) * (1f - smooth(LUNGE_HIT + .22f, 1f, p)) }
        // Shake from the contact: 16 dp over 480 ms for a clash, 20 dp over 560 ms for a face hit, damped.
        var dx = 0f; var dy = 0f
        val hit = items.firstOrNull { it.kind == Fx.LUNGE && (t - it.t0 - (it.dur * LUNGE_HIT).toLong() - HIT_STOP) in 0L..560L }
        if (hit != null) {
            val face = hit.toKey?.startsWith("orb") == true; val span = if (face) 560f else 480f
            val q = ((t - hit.t0 - hit.dur * LUNGE_HIT - HIT_STOP) / span).coerceIn(0f, 1f); val amp = (if (face) 20f else 16f) * (1f - q) * (1f - q)
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
        with(scope) { translationX = dx * density; translationY = dy * density; scaleX = zoom; scaleY = zoom }
    }
    /** Haptics at each beat's contact: light on a block, medium on a clash, heavy on a face hit. Set by FxDriver. */
    internal var onImpact: ((String) -> Unit)? = null
    private val felt = HashSet<FxItem>()
    private val byCard = HashMap<Int, MutableList<FxItem>>()
    private var prev: MatchState? = null
    private var focalEnd = 0L
    private var started = false

    internal fun tick(ms: Long) {
        if (!started) { started = true; if (items.isNotEmpty()) { val base = ms; items.forEach { it.t0 += base }; focalEnd += base } }
        now.longValue = ms
        onImpact?.let { feel -> for (it in items) if (it !in felt) {
            val kind = when {
                it.kind == Fx.BLOCK && it.p(ms) >= .1f -> "light"
                it.kind == Fx.LUNGE && it.p(ms) >= LUNGE_HIT -> if (it.toKey?.startsWith("orb") == true) "heavy" else "medium"
                it.kind == Fx.ARRIVE && it.entrance == 1 && it.p(ms) * it.dur >= 650f -> "light"
                it.kind == Fx.ARRIVE && it.entrance == 2 && it.p(ms) * it.dur >= E2_SLAM + 150f -> "heavy"
                else -> null
            } ?: continue
            felt += it; feel(kind)
        } }
        onCue?.let { cue -> cues(ms, cue) }
        if (items.any { it.done(ms) }) { items.removeAll { it.done(ms) }; felt.retainAll(items.toSet()); heard.keys.retainAll(items.toSet()); reindex() }
    }

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
            when (it.kind) {
                Fx.ATTACK -> once(1, 0f, "CMB-001", .9f)
                // At the stamp's slam, the shield ring 40 ms behind it.
                Fx.BLOCK -> { once(1, .24f, "CMB-021", 1f); once(2, .24f + 40f / it.dur, "CMB-016", .5f) }
                // The contact frame: CMB-022 carries its own 110 ms hit-stop gap, matching the visual freeze.
                Fx.LUNGE -> if (it.toKey?.startsWith("orb") == true) { val f = LUNGE_HIT + HIT_STOP.toFloat() / it.dur; once(1, f, "CMB-023", 1f); once(2, f, "CMB-010", .8f) }
                    else once(1, LUNGE_HIT, "CMB-022", 1f)
                // Lower for bigger numbers.
                Fx.DAMAGE -> { val n = it.label.filter(Char::isDigit).toIntOrNull() ?: 1; once(1, 0f, "CMB-006", .6f, (1.04f - .04f * n).coerceIn(.75f, 1f))
                    // Director step 3: a spell or ability's damage sounds its streak on the frame the number lands (combat has the clash).
                    if (it.side == 0) once(2, 0f, "CMB-018", .8f) }
                // A life loss outside a clash (a burn to the face) on the frame the orb takes it.
                Fx.LIFE -> if (it.level == 3 && items.none { l -> l.kind == Fx.LUNGE && l.toKey == it.toKey }) once(1, 0f, "CMB-018", if (it.power >= .8f) 1f else .8f)
                // Counters: on the pop.
                Fx.COUNTER -> once(1, 0f, "CARD-027", .7f)
                // A death: on the white flash after the 260 ms shake; a non-creature to the graveyard softer.
                Fx.DEATH -> if (it.toKey != null || it.ghost?.token == true) once(1, .38f, if (it.ghost?.isCreature == true) "CMB-009" else "CARD-018", 1f)
                else -> {}
            }
        }
        for ((id, v) in now) cue(id, v.first, v.second)
    }

    /** A touch on the board: every effect jumps to its end state (spec: "tap = next action"). */
    fun skip() {
        dev.cardstashy.nativeplay.match.CombatPace.release()
        if (items.isEmpty()) return
        items.clear(); focalEnd = now.longValue; reindex()
    }

    /** Staged combat's pairs in flight, so every card can dim while one pair plays out. */
    private var stages: List<FxItem> = emptyList()
    internal fun reindex() {
        byCard.clear()
        for (it in items) it.card?.let { id -> byCard.getOrPut(id) { mutableListOf() } += it }
        stages = items.filter { it.kind == Fx.STAGE }
        spots = items.filter { it.kind == Fx.ARRIVE && it.entrance == 2 }
        rev.intValue++
    }

    private var spots: List<FxItem> = emptyList()

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

    /** Reads the new snapshot against the last one and queues what changed. */
    fun take(st: MatchState, anchors: Anchors?) {
        val before = prev
        prev = st
        if (before == null || Motion.still || anchors == null) return
        if (st.revision <= before.revision && st.revision != 0L) return
        if (st.players.map { it.id } != before.players.map { it.id }) return
        val t = now.longValue
        val yours = st.waitingOnMe
        if (yours) {
            // Priority or a question (match director, section 6): nothing is cut short or dropped any more. What is in flight
            // finishes at no less than its floor, so the CPU's last action is always readable before you answer it.
            for (it in items) { val left = it.t0 + it.dur - t; val floor = minOf(it.baseMs * 6 / 10, it.dur); if (it.t0 <= t && left > floor && it.level < 2) { it.p0 = it.p(t); it.t0 = t; it.dur = floor } }
        }
        val groups = diff(before, st, anchors)
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

    private fun diff(a: MatchState, b: MatchState, anchors: Anchors): List<List<FxItem>> {
        val viewer = b.viewer
        val bfA = a.players.flatMap { it.battlefield }.associateBy { it.id }
        val bfB = b.players.flatMap { it.battlefield }.associateBy { it.id }
        val handA = a.me.hand.map { it.id }.toSet()
        val stackSrcA = a.stack.mapNotNull { it.source?.id }.toSet()
        val stackRect = anchors.rects["stackcard"]

        val draws = mutableListOf<FxItem>(); val casts = mutableListOf<FxItem>(); val resolves = mutableListOf<FxItem>()
        val arrivals = mutableListOf<FxItem>(); val combat = mutableListOf<FxItem>(); val hits = mutableListOf<FxItem>()
        val deaths = mutableListOf<FxItem>(); val counters = mutableListOf<FxItem>()

        // Draw (level 1, 350 ms): a card slides off the library into the hand.
        val drawn = b.me.hand.filter { it.id !in handA && it.id !in bfA && it.id !in stackSrcA && a.players.none { p -> p.graveyard.any { g -> g.id == it.id } } }
        drawn.take(3).forEachIndexed { i, _ -> draws += FxItem(Fx.DRAW, 1, 350, player = viewer, mine = true, fromKey = "lib$viewer", toKey = "hand", delay = i * 90L) }
        for (p in b.players) if (!p.isViewer && p.id != viewer) {
            val q = a.players.firstOrNull { it.id == p.id } ?: continue
            if (p.handCount > q.handCount && p.libraryCount < q.libraryCount) draws += FxItem(Fx.DRAW, 1, 350, player = p.id, fromKey = "lib${p.id}", toKey = "cpuhand")
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
            // A CPU spell is the card itself flying to the stack (StackFan); only abilities and your own casts keep the light thread.
            if (!mine && !s.ability) continue
            casts += FxItem(Fx.CAST, 2, 450, card = null, mine = mine, fromKey = from, toKey = "stackcard", tone = if (mine) Color(0xFFF3D27E) else Color(0xFFFF8A5C))
        }
        // Resolve (level 2, 300 ms): the stack card ripples; a spell with targets sends its light to them.
        val idsB = b.stack.map { it.id }.toSet()
        for (s in a.stack) if (s.id !in idsB) {
            val src = s.source?.id
            val becomesPermanent = src != null && src in bfB && src !in bfA
            val target = s.targets.firstOrNull()?.let { r -> if (r.kind == "player") "orb${r.id}" else "c${r.id}" }
            resolves += FxItem(Fx.RESOLVE, if (becomesPermanent) 1 else 2, if (becomesPermanent) 220 else 320, mine = s.controller == viewer, from = stackRect,
                toKey = if (becomesPermanent) null else target, tone = if (s.controller == viewer) Color(0xFFF3D27E) else Color(0xFFFF8A5C))
        }

        // Arrivals: travel on an arc to the real slot, land with a 2 % squash and a light sweep (450 ms); tokens form from light (400 ms).
        for ((id, c) in bfB) if (id !in bfA) {
            if (c.token && id !in stackSrcA) { arrivals += FxItem(Fx.TOKEN, 1, 400, card = id, mine = c.controller == viewer,
                delay = runCatching { dev.cardstashy.nativeplay.art.CardArt.holdFor(c.name) }.getOrDefault(0L)); continue }
            val fromStack = id in stackSrcA
            val fromHand = id in handA
            val key = when { fromStack -> null; fromHand -> "hand"; c.controller != viewer && !c.token -> "cpuhand"; else -> null }
            val tone = cardColors(c)?.firstOrNull()?.let { MANA_GLOW[it] } ?: Color(0xFFE8D7A8)
            val fromCommand = a.players.any { p -> p.command.any { it.id == id } }
            val lvl = entranceLevel(c, fromStack || fromCommand, waiting = b.waitingOnMe)
            val mine = c.controller == viewer
            arrivals += when (lvl) {
                2 -> FxItem(Fx.ARRIVE, 2, ENTRANCE2_MS, card = id, mine = mine, from = if (fromStack) stackRect else null, fromKey = key, tone = tone,
                    entrance = 2, title = c.name + "\n" + (if (mine) "Your commander" else "Their commander"))
                1 -> FxItem(Fx.ARRIVE, 2, ENTRANCE1_MS, card = id, mine = mine, from = if (fromStack) stackRect else null, fromKey = key, tone = tone, land = c.isLand, entrance = 1)
                else -> FxItem(Fx.ARRIVE, if (fromStack && c.isCreature) 2 else 1, 450, card = id, mine = mine,
                    from = if (fromStack) stackRect else null, fromKey = key, tone = tone, land = c.isLand)
            }
        }

        // Combat: a new attacker leans in; a new blocker sends a pulse down its thread to the attacker.
        for ((id, c) in bfB) {
            val o = bfA[id] ?: continue
            if (c.attacking && !o.attacking) combat += FxItem(Fx.ATTACK, 1, 640, card = id, mine = c.controller == viewer)
            // A block is a moment (spec 3): the blocker steps in, a gold shield flares over it and BLOCKED slams down; held so it reads.
            if (c.blocking && !o.blocking) c.blockingIds.firstOrNull()?.let { at -> combat += FxItem(Fx.BLOCK, 2, 1640, card = id, fromKey = "c$id", toKey = "c$at", mine = c.controller == viewer) }
        }

        // Combat damage lands: every attacker wind-ups, lunges at what it hit (its blocker, else the player) and strikes (level 2, 640 ms).
        val lungeMs = 1700L; val impactAt = (lungeMs * LUNGE_HIT).toLong()
        val lost = b.players.any { p -> a.players.firstOrNull { it.id == p.id }?.let { q -> p.life < q.life } == true }
        val dmgNow = bfB.values.any { c -> (bfA[c.id]?.damage ?: 0) < c.damage }
        var lunged = false
        // Combat damage may arrive in the damage step or, when priority is passed through it, in a later step: even straight to
        // Main 2 (Randall 4 Nov, test 6: no lunge on his board). Either way the attackers strike. A clash that only kills counts too.
        val wasCombat = a.phase?.startsWith("COMBAT") == true || b.phase?.startsWith("COMBAT") == true
        val clashDied = bfA.values.any { it.isCreature && (it.attacking || it.blocking) && it.id !in bfB }
        // Staged (Table spec, 5 Nov: "attacks play out too fast ... can't tell what is hitting and what is blocking"): one attacker
        // at a time in attack order. Each pair dims the rest of the board, joins attacker and blocker (or the player it hits)
        // with a gold line and a glass tag, then lunge, hit-stop and numbers, and a 500 ms hold before the next pair.
        val step = impactAt + HIT_STOP + 500L
        val startOf = HashMap<Int, Long>()
        val faceOf = HashMap<Int, MutableList<Pair<Long, Int>>>()
        if ((lost || dmgNow || clashDied) && wasCombat && a.turn == b.turn) {
            val said = a.events.lastOrNull { it.type == "attack" && it.attackers.isNotEmpty() }?.attackers?.map { it.first.id }.orEmpty()
            val attackers = bfA.values.filter { it.attacking }.sortedWith(compareBy({ said.indexOf(it.id).let { i -> if (i < 0) Int.MAX_VALUE else i } }, { it.id }))
            attackers.forEachIndexed { i, o ->
                val id = o.id; val start = i * step
                val blockers = bfA.values.filter { it.blocking && id in it.blockingIds }
                val defender = when { o.attackTarget?.kind == "player" -> o.attackTarget.id; else -> b.players.firstOrNull { it.id != o.controller }?.id }
                val to = when {
                    blockers.isNotEmpty() -> "c${blockers.first().id}"
                    o.attackTarget?.kind == "player" -> "orb${o.attackTarget.id}"
                    o.attackTarget != null -> "c${o.attackTarget.id}"
                    else -> defender?.let { "orb$it" }
                } ?: return@forEachIndexed
                startOf[id] = start; blockers.forEach { startOf[it.id] = start }
                if (blockers.isEmpty() && to.startsWith("orb") && defender != null) faceOf.getOrPut(defender) { mutableListOf() } += start to (o.power ?: 0).coerceAtLeast(0)
                fun pt(c: Card) = if (c.power != null) " ${c.power}/${c.toughness ?: 0}" else ""
                val tag = when {
                    blockers.isNotEmpty() -> "${o.name}${pt(o)} blocked by " + blockers.joinToString(" and ") { it.name + pt(it) }
                    to.startsWith("orb") -> "${o.name}${pt(o)} unblocked, ${(o.power ?: 0).coerceAtLeast(0)} damage to ${if (defender == viewer) "you" else "CPU"}"
                    else -> "${o.name}${pt(o)} attacks ${o.attackTarget?.let { r -> bfA[r.id]?.name } ?: "a permanent"}"
                }
                hits += FxItem(Fx.STAGE, 2, step, card = null, mine = o.controller == viewer, fromKey = "c$id", toKey = to, label = tag, delay = start,
                    ids = setOf(id) + blockers.map { it.id } + (o.attackTarget?.takeIf { it.kind == "card" }?.id?.let { setOf(it) } ?: emptySet()))
                hits += FxItem(Fx.LUNGE, 2, lungeMs, card = id, mine = o.controller == viewer, toKey = to, tone = Color(0xFFFF6A4A), power = if (to.startsWith("orb")) 1f else .8f, delay = start); lunged = true
            }
        }
        val lag = if (lunged) impactAt + HIT_STOP else 0L
        fun hitAt(id: Int) = (startOf[id] ?: 0L) + lag
        // Damage (level 2, 350 ms): 70 ms hit-stop, the number pops, a 3 px shake. Life totals move with it.
        for ((id, c) in bfB) {
            val o = bfA[id] ?: continue
            if (c.damage > o.damage) hits += FxItem(Fx.DAMAGE, 2, 1100, card = id, tone = Color(0xFFFF5A4A), label = "−${c.damage - o.damage}", delay = hitAt(id),
                side = if (o.attacking) -1 else if (o.blocking) 1 else 0)
            val gained = c.counters.values.sum() - o.counters.values.sum()
            if (gained != 0) {
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
                faces.forEachIndexed { i, (start, power) ->
                    val n = if (i == faces.lastIndex) left else minOf(power, left); left -= n
                    if (n > 0) hits += FxItem(Fx.LIFE, 3, 950, player = p.id, toKey = "orb${p.id}", delay = start + lag, power = (n / 6f).coerceIn(.35f, 1f), tone = Color(0xFFFF5A4A)).also { it.label = "−$n" }
                }
                continue
            }
            hits += FxItem(Fx.LIFE, if (p.life < q.life) 3 else 1, if (p.life < q.life) 950 else 700, player = p.id, toKey = "orb${p.id}", delay = if (p.life < q.life) lag else 0L, power = ((q.life - p.life) / 6f).coerceIn(.35f, 1f), tone = if (p.life < q.life) Color(0xFFFF5A4A) else Color(0xFF7BE08A))
                .also { it.label = if (p.life < q.life) "−${q.life - p.life}" else "+${p.life - q.life}" }
        }

        // Death (level 2, 600 ms): the holo bands break and drift to the graveyard. Exile and bounce fade where they stood.
        // A creature killed in the clash breaks on impact (after the hit-stop), not after the whole exchange.
        for ((id, c) in bfA) if (id !in bfB) {
            val rect = anchors.rects["c$id"] ?: continue
            val toGrave = b.players.any { p -> p.graveyard.any { it.id == id } }
            val clash = lunged && c.isCreature && (c.attacking || c.blocking)
            val item = FxItem(Fx.DEATH, 2, 600, mine = c.controller == viewer, from = rect, toKey = if (toGrave) "grave${c.owner}" else null, ghost = c, delay = if (clash) hitAt(id) + 120 else 0L)
            if (clash) hits += item else deaths += item
        }
        return listOf(draws, casts, resolves, arrivals, combat, hits, deaths, counters).filter { it.isNotEmpty() }
    }

    /** The card's own motion this frame (transform and alpha only), applied in its tile's layer. */
    internal fun move(scope: GraphicsLayerScope, id: Int, anchors: Anchors?) {
        rev.intValue
        if (stages.isNotEmpty()) scope.dim(id)
        if (spots.isNotEmpty()) scope.spotDim(id)
        val list = byCard[id] ?: return
        if (reduced) return
        val t = now.longValue
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
                    Fx.TOKEN -> {
                        if (p < 0f) { alpha = 0f; continue }
                        alpha = (p / .55f).coerceIn(0f, 1f)
                        val s = .86f + .14f * easeOutBack(p); scaleX = s; scaleY = s
                    }
                    Fx.DAMAGE -> if (p >= 0f) {
                        if (p < .2f) { scaleX = 1.04f; scaleY = 1.04f }
                        else { val q = (p - .2f) / .8f; translationX = 3.dp.toPx() * sin(q * 38f) * (1f - q) }
                    }
                    Fx.ATTACK -> if (p >= 0f) {
                        // Lifts 14 dp and grows to 1.12 over 320 ms, holds, then settles.
                        val e = smooth(0f, .5f, p) * (1f - smooth(.82f, 1f, p))
                        scaleX = 1f + .12f * e; scaleY = 1f + .12f * e; translationY = -(if (it.mine) 1f else -1f) * 14.dp.toPx() * e; shadowElevation = 16f * e
                    }
                    Fx.BLOCK -> if (p >= 0f) {
                        // Slides 70 dp toward its attacker with an overshoot in 240 ms, holds while the shield and stamp read, then goes home.
                        val a = anchors?.rects?.get("c$id"); val b = it.toKey?.let { k -> anchors?.rects?.get(k) }
                        if (a != null && b != null) {
                            val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y; val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f)
                            val go = (p / .146f).coerceAtMost(1f); val back = smooth(.86f, 1f, p)
                            val off = minOf(70.dp.toPx(), dist * .45f) * easeOutBack(go) * (1f - back)
                            translationX = dx / dist * off; translationY = dy / dist * off; shadowElevation = 14f * (1f - back)
                        }
                    }
                    Fx.LUNGE -> if (p >= 0f) {
                        val a = anchors?.rects?.get("c$id"); val b = it.toKey?.let { k -> anchors?.rects?.get(k) }
                        if (a != null && b != null) {
                            val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y
                            val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f); val ux = dx / dist; val uy = dy / dist
                            // Windup (pull back 10 % of the way, grow to 1.12), lunge to contact, a 110 ms hit-stop, a beat at the target,
                            // then spring home with an overshoot (420 ms).
                            val reach = (dist - minOf(b.width, b.height) * .42f - minOf(a.width, a.height) * .3f).coerceAtLeast(0f)
                            val pull = dist * .10f
                            val w0 = LUNGE_WIND; val h = LUNGE_HIT; val stop = h + 110f / it.dur; val home = 1f - 420f / it.dur
                            val off = when {
                                p < w0 -> -pull * smooth(0f, w0, p)
                                p < h -> { val q = (p - w0) / (h - w0); -pull + (reach + pull) * q * q * q }
                                p < home -> reach
                                else -> { val q = (p - home) / (1f - home); reach * (1f - easeOutBack(q)) }
                            }
                            translationX = ux * off; translationY = uy * off
                            val sc = when { p < w0 -> 1f + .12f * smooth(0f, w0, p); p < home -> 1.12f; else -> 1.12f - .12f * smooth(home, 1f, p) }
                            scaleX = sc; scaleY = sc; shadowElevation = 20f
                            if (p in h..stop) { translationX = ux * reach; translationY = uy * reach }
                        }
                    }
                    Fx.COUNTER -> if (p >= 0f) { val k = .03f * sin(PI.toFloat() * p); scaleX = 1f + k; scaleY = 1f + k }
                    else -> {}
                }
            }
        }
    }
}

val LocalBattlefield = staticCompositionLocalOf<Battlefield?> { null }
/** The table's sound player (id, volume, playback rate); none outside a match and in tests. */
val LocalTableCue = staticCompositionLocalOf<((String, Float, Float) -> Unit)?> { null }

private val MANA_GLOW = mapOf('W' to Color(0xFFFFF1C2), 'U' to Color(0xFF5AB4FF), 'B' to Color(0xFFB08BD8), 'R' to Color(0xFFFF7A4A), 'G' to Color(0xFF6BE08A))

private fun easeOutBack(x: Float): Float { val c1 = 1.70158f; val c3 = c1 + 1f; return 1f + c3 * (x - 1f).let { it * it * it } + c1 * (x - 1f).let { it * it } }
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
    SideEffect { fx.onCue = cue; fx.reduced = reduced; fx.low = AppSettings.effects == "minimal" }
    SideEffect { fx.take(st, anchors) }
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
    Box(Modifier.fillMaxSize().onGloballyPositioned { val b = it.boundsInRoot(); self = b.topLeft; fx.stageCentre = b.center }) {
        // Dying cards: the last picture of the card, breaking into holo bands as it drifts to its graveyard.
        for (it in fx.items) if (it.kind == Fx.DEATH && it.ghost != null && it.from != null) key(it) { Ghost(it, fx, anchors, self, density) }
        Canvas(Modifier.fillMaxSize()) {
            val t = fx.now.longValue
            anchors.version.intValue
            fun rect(k: String?): Rect? = k?.let { anchors.rects[it] }?.translate(-self.x, -self.y)
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
                        else -> {}
                    }
                    continue
                }
                when (it.kind) {
                    Fx.DRAW -> drawDraw(it, p, rect(it.fromKey), rect(it.toKey) ?: Rect(size.width / 2 - 20f, size.height - 60f, size.width / 2 + 20f, size.height))
                    Fx.CAST -> drawCast(it, p, rect(it.fromKey) ?: (if (it.mine) Rect(size.width / 2, size.height - 40f, size.width / 2, size.height) else Rect(size.width / 2, 0f, size.width / 2, 20f)), rect(it.toKey))
                    Fx.RESOLVE -> drawResolve(it, p, it.from?.translate(-self.x, -self.y), rect(it.toKey))
                    Fx.ARRIVE -> rect("c${it.card}")?.let { r -> if (it.entrance > 0) drawEntrance(tm, it, p, r, fx.stageCentre?.let { c -> c - self }) else drawArrive(it, p, r) }
                    Fx.TOKEN -> rect("c${it.card}")?.let { r -> drawToken(p, r) }
                    Fx.ATTACK -> rect("c${it.card}")?.let { r -> glowRing(r, Color(0xFFFFD98A), .9f * smooth(0f, .5f, p) * (1f - smooth(.8f, 1f, p)), 17.dp.toPx()) }
                    Fx.LUNGE -> drawLunge(it, p, rect("c${it.card}"), rect(it.toKey), fx.low)
                    Fx.BLOCK -> { val a = rect(it.fromKey); val b = rect(it.toKey); if (a != null && b != null) drawBlock(tm, it, p, a, b) }
                    Fx.DAMAGE -> rect("c${it.card}")?.let { r -> drawHit((p * 3.1f).coerceAtMost(1f), r)
                        // An attacker's number sits lower left and a blocker's upper right, so two never stack and the P/T stays readable.
                        // Away from the clash: a card in the upper half shows it above-left, one in the lower half below-right.
                        val at = if (it.side == 0) r.center.copy(y = r.top + r.height * .3f) else if (r.center.y < size.height / 2) Offset(r.left - r.width * .2f, r.top - r.height * .15f) else Offset(r.right + r.width * .2f, r.bottom + r.height * .05f)
                        bigNumber(tm, it.label, p, at, it.tone, if (size.height < 500.dp.toPx()) 40f else 52f) }
                    Fx.LIFE -> rect(it.toKey)?.let { r -> if (it.level == 3) faceHit(it, p, r, fx.low) else glowRing(r, it.tone, .8f * (1f - p), 6.dp.toPx(), round = true); pop(tm, it.label, p, Offset(r.center.x, if (r.center.y < size.height / 2) r.bottom + 16.dp.toPx() else r.top - 6.dp.toPx()), it.tone, if (it.level == 3) 34f + 8f * it.power else 20f, down = r.center.y < size.height / 2) }
                    Fx.COUNTER -> rect("c${it.card}")?.let { r -> drawPour(p, r); pop(tm, it.label, p, Offset(r.center.x, r.top + 4.dp.toPx()), Color(0xFFF3D27E), 15f) }
                    Fx.DEATH -> if (!fx.low) it.from?.translate(-self.x, -self.y)?.let { r -> drawShards(it, p, r, rect(it.toKey)) }
                    Fx.STAGE -> drawStage(tm, it, p, rect(it.fromKey), rect(it.toKey))
                }
            }
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
            anchors.version.intValue
            val grave = it.toKey?.let { k -> anchors.rects[k] }
            val drift = smooth(.28f, 1f, p)
            if (grave != null) {
                translationX = (grave.center.x - r.center.x) * drift
                translationY = (grave.center.y - r.center.y) * drift
                val s = 1f + (grave.width / gw - 1f) * drift; scaleX = s; scaleY = s
                rotationZ = turn * (1f - drift) - 8f * drift * (if (it.mine) 1f else -1f)
            } else { val s = 1f - .12f * drift; scaleX = s; scaleY = s; rotationZ = turn }
            alpha = 1f - smooth(.7f, 1f, p)
        }
        .drawWithContent {
            if (fx.reduced || fx.low) { drawContent(); return@drawWithContent }
            val p = it.p(fx.now.longValue).coerceAtLeast(0f)
            val brk = smooth(.12f, .55f, p)
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
            // The hit-stop: a white flash for the first 70 ms.
            if (p < .12f) drawRect(Color.White.copy(alpha = .45f * (1f - p / .12f)))
        }
        .clip(RoundedCornerShape(10.dp))) {
        CardImage(it.ghost!!.name, Modifier.fillMaxSize(), crop = true) {
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
private fun DrawScope.drawLunge(it: FxItem, p: Float, a: Rect?, b: Rect?, low: Boolean = false) {
    if (a == null || b == null) return
    val face = it.toKey?.startsWith("orb") == true
    val dur = it.dur.toFloat()
    if (!low && p in LUNGE_WIND..LUNGE_HIT) {
        val q = ((p - LUNGE_WIND) / (LUNGE_HIT - LUNGE_WIND)).coerceIn(0f, 1f)
        val dir = b.center - a.center; val len = kotlin.math.hypot(dir.x, dir.y).coerceAtLeast(1f)
        val ux = dir.x / len; val uy = dir.y / len
        val reach = (len - minOf(b.width, b.height) * .42f - minOf(a.width, a.height) * .3f).coerceAtLeast(0f); val pull = len * .1f
        val n = if (face) 7 else 5
        // The card itself keeps its art: a trail shows only where it has fallen behind the card (no pale cover on the windup).
        val now = -pull + (reach + pull) * q * q * q
        for (i in 1..n) {
            val qi = (q - i * .07f).coerceIn(0f, 1f); val off = -pull + (reach + pull) * qi * qi * qi
            val apart = smooth(0f, minOf(a.width, a.height) * .9f, kotlin.math.abs(now - off))
            if (apart <= 0f) continue
            val w = a.width * 1.12f; val h = a.height * 1.12f; val cx = a.center.x + ux * off; val cy = a.center.y + uy * off
            drawRoundRect(Color(0xFFFFE2B0).copy(alpha = .5f * apart * (1f - i / (n + 1f)) * (1f - smooth(.85f, 1f, q))), Offset(cx - w / 2, cy - h / 2), Size(w, h), CornerRadius(10f * density))
        }
    }
    // Contact, then the hit-stop: nothing new draws for 110 ms.
    val t = (p - LUNGE_HIT) * dur - HIT_STOP
    if (t < 0f) return
    val at = b.center
    // Flash: 150 dp of white-gold growing to 1.7x and gone.
    val fq = (t / 260f).coerceIn(0f, 1f)
    if (fq < 1f) drawCircle(Brush.radialGradient(listOf(Color.White.copy(alpha = .95f * (1f - fq)), Color(0xFFFFD98A).copy(alpha = .7f * (1f - fq)), Color.Transparent), center = at, radius = 75.dp.toPx() * (1f + .7f * fq)), radius = 75.dp.toPx() * (1f + .7f * fq), center = at)
    // Shock rings: white-gold, then orange 90 ms later (face: and red), 620 ms each.
    val rings = if (face) listOf(Color(0xFFFFF4D6), Color(0xFFFF4A3A), Color(0xFFF0C27A)) else listOf(Color(0xFFFFF0C8), Color(0xFFFF9A3C))
    rings.forEachIndexed { j, col -> val k = ((t - j * 90f) / 620f).coerceIn(0f, 1f); if (k > 0f && k < 1f)
        drawCircle(col.copy(alpha = .9f * (1f - k)), radius = b.maxDimension * (.35f + (if (face) 2.4f else 1.6f) * k), center = at, style = Stroke((6f - 5f * k) * density)) }
    // Sparks in the fire palette, thrown out and pulled down.
    val rnd = java.util.Random((it.card?.toLong() ?: 1L) * 31L)
    val sq = (t / 900f).coerceIn(0f, 1f)
    if (!low && sq < 1f) for (i in 0 until (if (face) 36 else 28)) {
        val ang = rnd.nextFloat() * 6.283f; val sp = (60f + rnd.nextFloat() * 160f) * density
        val col = listOf(Color(0xFFFFF4D6), Color(0xFFFFD98A), Color(0xFFFF9A3C), Color(0xFFFF5A2A))[i % 4]
        val pos = at + Offset(cos(ang) * sp * sq, sin(ang) * sp * sq + 220f * density * sq * sq)
        drawCircle(col.copy(alpha = 1f - sq), radius = (1.6f + 2f * rnd.nextFloat()) * density * (1f - sq * .5f), center = pos)
    }
}

/** A hit to a face: a red flash across the board edge, a big shockwave from the orb, sparks, and the life number slamming in. */
private fun DrawScope.faceHit(it: FxItem, p: Float, r: Rect, low: Boolean = false) {
    val k = it.power
    val ms = p * it.dur
    // Red at the screen's edges only, peaking near 0.9 and gone by about 700 ms.
    val vig = (if (ms < 90f) ms / 90f else 1f - smooth(90f, 700f, ms)) * .9f * (.75f + .25f * k)
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

/** The block (spec 3): a pulse down the thread, a gold shield ring flaring over the blocker, and BLOCKED slamming from 3x beside it. */
private fun DrawScope.drawBlock(tm: androidx.compose.ui.text.TextMeasurer, it: FxItem, p: Float, a: Rect, b: Rect, still: Boolean = false) {
    val pulse = (p / .2f).coerceAtMost(1f)
    if (!still && pulse < 1f) for (j in 0..1) {
        val q = (pulse * 1.25f - j * .25f).coerceIn(0f, 1f); if (q <= 0f || q >= 1f) continue
        val at = lerpO(a.center, b.center, q)
        drawCircle(Brush.radialGradient(listOf(Color.White, Color(0xFFF0C27A).copy(alpha = .7f), Color.Transparent), center = at, radius = 12f * density), radius = 12f * density, center = at)
    }
    // Centred on the blocker where its slide put it, the tile plus 12 %.
    val dx = b.center.x - a.center.x; val dy = b.center.y - a.center.y; val dist = kotlin.math.hypot(dx, dy).coerceAtLeast(1f)
    val slide = if (still) 0f else minOf(70.dp.toPx(), dist * .45f) * easeOutBack((p / .146f).coerceAtMost(1f)) * (1f - smooth(.86f, 1f, p))
    val c = a.center + Offset(dx / dist * slide, dy / dist * slide)
    val flare = smooth(0f, .55f, p); val out = 1f - smooth(.84f, 1f, p)
    // Table thread 19:04Z: shield and stamp 1.4x so they read at phone scale.
    val grow = 1.12f * 1.4f * (1.2f - .2f * flare)
    val sw = a.width * grow; val sh = a.height * grow
    val oval = Rect(c.x - sw / 2, c.y - sh / 2, c.x + sw / 2, c.y + sh / 2)
    val rad = CornerRadius(minOf(sw, sh) * .18f)
    val gold = Color(0xFFF0C27A)
    if (!still) drawIntoCanvas { cv ->
        val glow = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = 14.dp.toPx(); color = gold.copy(alpha = .75f * flare * out).toArgb(); maskFilter = BlurMaskFilter(20.dp.toPx(), BlurMaskFilter.Blur.NORMAL) }
        cv.nativeCanvas.drawRoundRect(oval.left, oval.top, oval.right, oval.bottom, rad.x, rad.y, glow)
        val inner = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = 11.dp.toPx(); color = gold.copy(alpha = .4f * flare * out).toArgb(); maskFilter = BlurMaskFilter(11.dp.toPx(), BlurMaskFilter.Blur.INNER) }
        cv.nativeCanvas.drawRoundRect(oval.left + 5.dp.toPx(), oval.top + 5.dp.toPx(), oval.right - 5.dp.toPx(), oval.bottom - 5.dp.toPx(), rad.x, rad.y, inner)
    }
    if (!still) drawRoundRect(Color(0xFFFFE6B0).copy(alpha = .95f * flare * out), oval.topLeft, oval.size, rad, style = Stroke(3.5f * density))
    // BLOCKED: gold, letter-spaced, -4 degrees, slams from 3x to 1x, held, then fades with the shield.
    val slam = if (still) 1f else smooth(.1f, .24f, p); if (slam <= 0f) return
    val k = 3f - 2f * slam
    val style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Black, fontSize = 42.sp, letterSpacing = .18.em, color = gold)
    val lay = tm.measure("BLOCKED", style)
    // The stamp goes on whichever side of the blocker has more room.
    val side = if (c.x > size.width - c.x) -1f else 1f
    val at = Offset((c.x + side * (sw / 2 + lay.size.width * .55f)).coerceIn(lay.size.width / 2f + 8f, size.width - lay.size.width / 2f - 8f), c.y)
    val alpha = slam.coerceAtMost(1f) * out
    rotate(-4f, at) { scale(k, at) {
        val tl = Offset(at.x - lay.size.width / 2f, at.y - lay.size.height / 2f)
        for ((dx, dy) in listOf(-2f to 0f, 2f to 0f, 0f to -2f, 0f to 2f)) drawText(tm, "BLOCKED", tl + Offset(dx * density, dy * density), style.copy(color = Color(0xFF2A1A06).copy(alpha = .9f * alpha)))
        drawText(tm, "BLOCKED", tl, style.copy(brush = Brush.verticalGradient(listOf(Color(0xFFFFF0C8), gold, Color(0xFFC4903A)), tl.y, tl.y + lay.size.height), alpha = alpha))
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
