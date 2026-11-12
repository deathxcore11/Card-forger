package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.drawText
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * Match punch P1 (specs/match-punch-brief.md, "Shared pieces"): the parts every punch is built from, all drawn on the one FxLayer
 * canvas. Particles (spark, ember, smoke, ring, spike, soft blob) with a hard cap of 160 live, sparks dropped before smoke; every
 * particle gone within 1 s of the moment it was made. A streak with a tapering tail. The board's own jolt (shake and push-in), which
 * moves the board box only, never the strips (squares, phase, End turn, the gold button). The freeze lives on [Battlefield]: it
 * pauses the effect clock only, never input or the bridge.
 */

/** Particle kinds, in the order they are dropped when the cap is reached (sparks first, smoke last). */
internal enum class Bit { SPARK, EMBER, SPIKE, RING, BLOB, SMOKE, GLOW, SHARD }

/**
 * Live particles in plain arrays (no allocation per frame). Positions are in the FxLayer's own pixels. [now] is the effect clock,
 * so a freeze holds them too.
 */
internal class Particles(val cap: Int = CAP) {
    companion object {
        const val CAP = 160
        /** No particle outlives the moment it was made by more than this (ms). */
        const val MAX_LIFE = 1000L
    }
    private val kind = arrayOfNulls<Bit>(cap)
    private val x = FloatArray(cap); private val y = FloatArray(cap)
    private val vx = FloatArray(cap); private val vy = FloatArray(cap)
    private val born = LongArray(cap); private val life = LongArray(cap)
    private val sz = FloatArray(cap); private val grav = FloatArray(cap)
    private val colour = LongArray(cap)
    /** Live count. */
    var count = 0; private set

    /** Sparks before embers, embers before spikes and rings, smoke last: the slot to give up when full, or -1 for none of [k]'s rank or lower. */
    private fun victim(k: Bit): Int {
        var best = -1
        for (i in 0 until count) {
            val ki = kind[i]!!
            if (ki.ordinal > k.ordinal) continue
            if (best < 0 || ki.ordinal < kind[best]!!.ordinal || (ki == kind[best] && born[i] < born[best])) best = i
        }
        return best
    }

    /** One particle; [lifeMs] is held to [MAX_LIFE]. Returns false when the cap holds and nothing weaker could make room. */
    fun add(k: Bit, at: Offset, vel: Offset, sizePx: Float, c: Color, lifeMs: Long, now: Long, gravity: Float = 0f): Boolean {
        val i = if (count < cap) count++ else victim(k).takeIf { it >= 0 } ?: return false
        kind[i] = k; x[i] = at.x; y[i] = at.y; vx[i] = vel.x; vy[i] = vel.y
        born[i] = now; life[i] = lifeMs.coerceIn(1L, MAX_LIFE); sz[i] = sizePx; grav[i] = gravity
        colour[i] = c.value.toLong()
        return true
    }

    /** Drops the finished ones (call once a frame, before drawing). */
    fun sweep(now: Long) {
        var i = 0
        while (i < count) {
            if (now - born[i] >= life[i]) { val last = --count
                if (i != last) { kind[i] = kind[last]; x[i] = x[last]; y[i] = y[last]; vx[i] = vx[last]; vy[i] = vy[last]
                    born[i] = born[last]; life[i] = life[last]; sz[i] = sz[last]; grav[i] = grav[last]; colour[i] = colour[last] }
                kind[last] = null
            } else i++
        }
    }

    fun clear() { for (i in 0 until count) kind[i] = null; count = 0 }

    /** The kinds alive now (tests). */
    fun kinds(): List<Bit> = (0 until count).map { kind[it]!! }
    /** The latest moment any live particle ends (tests), or null when none. */
    fun lastEnd(): Long? = if (count == 0) null else (0 until count).maxOf { born[it] + life[it] }

    // ---- Emitters ----

    /** [n] sparks thrown out from [at] inside [spread] radians around [dir] (radians; 0 = right), falling a little. */
    fun sparks(at: Offset, n: Int, c: Color, now: Long, speed: Float, dir: Float = 0f, spread: Float = (2 * PI).toFloat(), lifeMs: Long = 520, sizePx: Float = 3f, seed: Int = 0) {
        for (j in 0 until n) { val a = dir - spread / 2 + spread * frac(seed * 31 + j * 7 + 1); val s = speed * (.55f + .45f * frac(seed * 17 + j * 13 + 3))
            add(Bit.SPARK, at, Offset(cos(a) * s, sin(a) * s), sizePx * (.7f + .6f * frac(j * 5 + seed)), c, (lifeMs * (.7f + .3f * frac(j * 3 + seed + 9))).toLong(), now, gravity = speed * 1.2f) }
    }
    /** F7: [n] thin three- or four-sided shards [minPx] to [maxPx] long thrown out from [at], spinning as they fall; two in three [hi], one in three [rim]. */
    fun shards(at: Offset, n: Int, hi: Color, rim: Color, now: Long, speed: Float, minPx: Float, maxPx: Float, lifeMs: Long = 1100, seed: Int = 0) {
        for (j in 0 until n) { val a = (2 * PI).toFloat() * frac(seed * 31 + j * 7 + 1); val s = speed * (.45f + .55f * frac(seed * 17 + j * 13 + 3))
            add(Bit.SHARD, at, Offset(cos(a) * s, sin(a) * s - speed * .25f), minPx + (maxPx - minPx) * frac(j * 5 + seed), if (j % 3 == 2) rim else hi, (lifeMs * (.7f + .3f * frac(j * 3 + seed + 9))).toLong(), now, gravity = speed * 1.6f) }
    }
    /** Slow embers rising from [at]. */
    fun embers(at: Offset, n: Int, c: Color, now: Long, rise: Float, lifeMs: Long = 800, sizePx: Float = 2.4f, seed: Int = 0) {
        for (j in 0 until n) { val dx = (frac(seed * 11 + j * 7) - .5f) * rise * .8f
            add(Bit.EMBER, at, Offset(dx, -rise * (.5f + .5f * frac(seed + j * 19))), sizePx, c, (lifeMs * (.6f + .4f * frac(j * 23 + seed))).toLong(), now) }
    }
    /** Soft dust or smoke puffs drifting out and up. */
    fun smoke(at: Offset, n: Int, c: Color, now: Long, drift: Float, lifeMs: Long = 900, sizePx: Float = 10f, seed: Int = 0) {
        for (j in 0 until n) { val a = (2 * PI).toFloat() * frac(seed * 13 + j * 29 + 5)
            add(Bit.SMOKE, at, Offset(cos(a) * drift, sin(a) * drift * .5f - drift * .35f), sizePx * (.7f + .6f * frac(j * 3 + seed)), c,
                (lifeMs * (.55f + .45f * frac(j * 41 + seed))).toLong(), now) }
    }
    /** One ring growing from [at] to [radius] px. */
    fun ring(at: Offset, radius: Float, c: Color, now: Long, lifeMs: Long = 460) { add(Bit.RING, at, Offset.Zero, radius, c, lifeMs, now) }
    /** [n] spikes out from [at], [len] px long, inside [spread] radians around [dir]. */
    fun spikes(at: Offset, n: Int, len: Float, c: Color, now: Long, dir: Float = 0f, spread: Float = (2 * PI).toFloat(), lifeMs: Long = 300, seed: Int = 0) {
        for (j in 0 until n) { val a = dir - spread / 2 + spread * ((j + .5f) / n) + (frac(seed + j * 7) - .5f) * spread / n * .6f
            add(Bit.SPIKE, at, Offset(cos(a), sin(a)), len * (.7f + .3f * frac(j * 11 + seed)), c, lifeMs, now) }
    }
    /** F6: [n] glowing points (a [corePx] core in a [glowPx] soft glow) drifting from [at] along [dir], started across [across] px either side of the line. */
    fun glows(at: Offset, n: Int, c: Color, now: Long, speed: Float, dir: Float, spread: Float, across: Float, lifeMs: Long, corePx: Float, glowPx: Float, seed: Int = 0) {
        for (j in 0 until n) { val a = dir - spread / 2 + spread * frac(seed * 31 + j * 7 + 1); val s = speed * (.55f + .45f * frac(seed * 17 + j * 13 + 3))
            val side = (frac(seed * 5 + j * 37 + 11) - .5f) * 2f * across
            add(Bit.GLOW, at + Offset(-sin(dir) * side, cos(dir) * side), Offset(cos(a) * s, sin(a) * s), corePx, c, (lifeMs * (.7f + .3f * frac(j * 3 + seed + 9))).toLong(), now, gravity = glowPx) }
    }
    /** One soft glow blob at [at]. */
    fun blob(at: Offset, radius: Float, c: Color, now: Long, lifeMs: Long = 360) { add(Bit.BLOB, at, Offset.Zero, radius, c, lifeMs, now) }

    // ---- Drawing ----

    fun draw(scope: DrawScope, now: Long) = with(scope) {
        sweep(now)
        for (i in 0 until count) {
            val age = (now - born[i]).coerceAtLeast(0L); val q = age.toFloat() / life[i]; val s = age / 1000f
            val c = Color(colour[i].toULong())
            val px = x[i] + vx[i] * s; val py = y[i] + vy[i] * s + grav[i] * s * s / 2
            when (kind[i]!!) {
                Bit.SPARK -> { val a = (1f - q).coerceIn(0f, 1f); val tail = Offset(vx[i], vy[i] + grav[i] * s) * .035f
                    drawLine(c.copy(alpha = a), Offset(px, py), Offset(px, py) - tail, strokeWidth = sz[i], cap = StrokeCap.Round) }
                Bit.EMBER -> { val a = (if (q < .15f) q / .15f else 1f - (q - .15f) / .85f).coerceIn(0f, 1f)
                    drawCircle(c.copy(alpha = .9f * a), sz[i], Offset(px + sin(q * 9f + i) * sz[i] * 1.5f, py)) }
                Bit.SMOKE -> { val a = .35f * (1f - q) * min(1f, q * 6f); val r = sz[i] * (1f + q * 1.6f)
                    drawCircle(Brush.radialGradient(listOf(c.copy(alpha = a), c.copy(alpha = 0f)), Offset(px, py), r), r, Offset(px, py)) }
                Bit.RING -> { val e = 1f - (1f - q) * (1f - q); val r = max(1f, sz[i] * e)
                    drawCircle(c.copy(alpha = (1f - q) * .9f), r, Offset(x[i], y[i]), style = Stroke(width = (3f * (1f - q) + 1f) * density)) }
                Bit.SPIKE -> { val grow = min(1f, q / .35f); val a = (1f - smoothQ(.4f, 1f, q))
                    val from = Offset(x[i], y[i]) + Offset(vx[i], vy[i]) * (sz[i] * .25f * grow)
                    val to = Offset(x[i], y[i]) + Offset(vx[i], vy[i]) * (sz[i] * grow)
                    drawLine(c.copy(alpha = a), from, to, strokeWidth = (2.2f * (1f - q) + .8f) * density, cap = StrokeCap.Round)
                    drawLine(Color.White.copy(alpha = a * .7f), from, lerpP(from, to, .6f), strokeWidth = .8f * density, cap = StrokeCap.Round) }
                // (A glow keeps its halo's size where a spark keeps its gravity: it does not fall.)
                Bit.GLOW -> { val a = (1f - q).coerceIn(0f, 1f); val at = Offset(x[i] + vx[i] * s, y[i] + vy[i] * s); val halo = grav[i]
                    drawCircle(Brush.radialGradient(listOf(c.copy(alpha = .55f * a), c.copy(alpha = 0f)), at, halo), halo, at)
                    drawCircle(c.copy(alpha = a), sz[i] / 2, at); drawCircle(Color.White.copy(alpha = .6f * a), sz[i] / 4, at) }
                // A shard: a thin sliver with three or four corners, turning 4 to 9 radians a second (which way and how fast is its own).
                Bit.SHARD -> { val a = (if (q < .7f) 1f else 1f - (q - .7f) / .3f).coerceIn(0f, 1f)
                    val k = kotlin.math.abs(vx[i] * .37f + vy[i] * .11f) % 1f; val turn = (4f + 5f * k) * (if (vx[i] < 0f) -1f else 1f) * s + k * 6.283f
                    val len = sz[i] / 2; val wide = sz[i] * .19f; val cs = cos(turn); val sn = sin(turn)
                    fun at(lx: Float, ly: Float) = Offset(px + lx * cs - ly * sn, py + lx * sn + ly * cs)
                    val pts = if (k > .5f) listOf(at(-len, 0f), at(-len * .1f, -wide), at(len, -wide * .3f), at(len * .2f, wide)) else listOf(at(-len, -wide * .4f), at(len, 0f), at(-len * .3f, wide))
                    val path = androidx.compose.ui.graphics.Path().apply { moveTo(pts[0].x, pts[0].y); for (j in 1 until pts.size) lineTo(pts[j].x, pts[j].y); close() }
                    drawPath(path, c.copy(alpha = a)); drawLine(Color.White.copy(alpha = .55f * a), pts[0], pts[1], .7f * density) }
                Bit.BLOB -> { val a = .7f * (1f - q); val r = sz[i] * (.6f + .4f * q)
                    drawCircle(Brush.radialGradient(listOf(c.copy(alpha = a), c.copy(alpha = 0f)), Offset(x[i], y[i]), r), r, Offset(x[i], y[i])) }
            }
        }
    }

    private fun lerpP(a: Offset, b: Offset, t: Float) = Offset(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
    private fun smoothQ(e0: Float, e1: Float, v: Float): Float { val t = ((v - e0) / (e1 - e0)).coerceIn(0f, 1f); return t * t * (3f - 2f * t) }
    /** A fixed spread from a seed, so a burst is the same every time (pictures and tests). */
    private fun frac(n: Int): Float { val v = sin(n * 12.9898f + 78.233f) * 43758.547f; return v - kotlin.math.floor(v) }
}

/**
 * A streak from [from] to [to] along a shallow arc ([bend] of the distance, to the left of travel), its head at [p] (0..1) and a
 * tail tapering behind it over [tail] of the path. Fades out over its last 15 %.
 */
internal fun DrawScope.streak(from: Offset, to: Offset, p: Float, c: Color, widthPx: Float, tail: Float = .35f, bend: Float = .18f) {
    if (p <= 0f) return
    val d = to - from; val len = sqrt(d.x * d.x + d.y * d.y); if (len < 1f) return
    val ctrl = Offset((from.x + to.x) / 2, (from.y + to.y) / 2) + Offset(-d.y / len, d.x / len) * (len * bend)
    fun at(t: Float): Offset { val u = 1 - t; return Offset(u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x, u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y) }
    val head = p.coerceAtMost(1f); val start = (head - tail).coerceAtLeast(0f)
    val fade = if (p > .85f) ((1f - p) / .15f).coerceIn(0f, 1f) else 1f
    val n = 14
    var prev = at(start)
    for (k in 1..n) { val t = start + (head - start) * k / n; val pt = at(t); val w = k.toFloat() / n
        drawLine(c.copy(alpha = fade * (.15f + .85f * w)), prev, pt, strokeWidth = max(1f, widthPx * w), cap = StrokeCap.Round); prev = pt }
    drawCircle(Color.White.copy(alpha = .9f * fade), widthPx * .7f, prev)
    drawCircle(c.copy(alpha = .45f * fade), widthPx * 1.8f, prev)
}

/** The board's jolt: a damped shake of [ampDp] over [ms] and a push-in of [push] (.03 = 3 %) easing out with it. */
internal class Jolt(val t0: Long, val ampDp: Float, val ms: Long, val push: Float)

/** The board's offset (dp) and zoom at [now] from [jolts]: the strongest one in flight wins. */
internal fun joltAt(jolts: List<Jolt>, now: Long): Triple<Float, Float, Float> {
    var dx = 0f; var dy = 0f; var zoom = 1f; var best = 0f
    for (j in jolts) { val q = (now - j.t0).toFloat() / j.ms; if (q < 0f || q > 1f) continue
        val amp = j.ampDp * (1f - q) * (1f - q)
        if (amp >= best) { best = amp; dx = amp * sin(q * 46f); dy = amp * .7f * cos(q * 39f) }
        zoom = max(zoom, 1f + j.push * sin(min(1f, q * 3f) * (PI / 2).toFloat()) * (1f - q)) }
    return Triple(dx, dy, zoom)
}

// ---- Match punch P2: Pay, Charge, Burst (drawn on the FxLayer canvas from the travel leg the table is drawing) ----

private fun easeOutQ(x: Float) = 1f - (1f - x) * (1f - x)

/**
 * P2. While a cast's lands pay ([Director.Leg.TAPS]): each land flashes in its own mana colour as it turns, throws a ring and 7
 * sparks, and 60 ms later a streak arcs from it to the stack card (280 ms); each arrival steps the spell's ring up. As its rest
 * opens ([Director.Leg.REST]): a 70 ms freeze, then the burst in the spell's colour, centred on the stack card with its spikes
 * and sparks fanned toward the board only (the stack stands in the right strip), a ring no wider than 1.1 x the stack card's
 * height, the board pushed in 3 % with a 4 dp shake, and embers for half a second. Reduce motion: the flashes at half strength
 * and the ring, nothing that moves.
 */
internal fun DrawScope.drawCastPunch(fx: Battlefield, m: dev.cardstashy.nativeplay.match.TravelMoment, rect: (String?) -> androidx.compose.ui.geometry.Rect?) {
    val D = dev.cardstashy.nativeplay.match.Director
    val t = m.travel
    if (t.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_POOL || t.leg == dev.cardstashy.nativeplay.match.Director.Leg.UNTAP) { drawHandMana(fx, m, rect); return }
    if (t.leg != dev.cardstashy.nativeplay.match.Director.Leg.TAPS && t.leg != dev.cardstashy.nativeplay.match.Director.Leg.REST) return
    val stack = rect("stackcard") ?: return
    val el = fx.travelMs(m); val now = fx.now.longValue
    val gold = Color(0xFFF3D27E)
    fun toneOf(id: Int?): Color = id?.let { fx.board?.card(it) }?.let { frameTone(cardColors(it)).first } ?: gold
    val tone = toneOf(t.cardId)
    val dp = density; val still = fx.reduced; val half = if (still) .5f else 1f
    val corner = androidx.compose.ui.geometry.CornerRadius(8f * dp)
    fun spellRing(alpha: Float) { if (alpha <= 0f) return
        val g = 3f * dp
        drawRoundRect(tone.copy(alpha = (.25f * alpha).coerceIn(0f, 1f)), stack.topLeft - Offset(g * 2, g * 2), androidx.compose.ui.geometry.Size(stack.width + g * 4, stack.height + g * 4), corner, style = Stroke(width = 6f * dp))
        drawRoundRect(tone.copy(alpha = alpha.coerceIn(0f, 1f)), stack.topLeft - Offset(g, g), androidx.compose.ui.geometry.Size(stack.width + g * 2, stack.height + g * 2), corner, style = Stroke(width = 2f * dp)) }
    if (t.leg == dev.cardstashy.nativeplay.match.Director.Leg.TAPS) {
        val into = Offset(stack.left + stack.width * .25f, stack.center.y)
        var arrived = 0
        // P2b: floating mana you made by hand pays first, its streaks from the pool by your square; the lands' follow.
        val pool = rect("manapool")
        for (j in 0 until t.pool) {
            val at = el - D.TAP_GAP_MS * j
            if (at < 0) continue
            val sp = (at - D.STREAK_LEAVE_MS).toFloat() / D.STREAK_MS
            if (!still && pool != null && sp in 0f..1f) streak(pool.center, into, sp * sp, gold, 5f * dp, bend = -.12f)
            if (at >= D.STREAK_LEAVE_MS + D.STREAK_MS) { arrived++
                if (!still && fx.once(m.key, 400 + j)) fx.bits.sparks(into, 5, gold, now, 110f * dp, dir = PI.toFloat(), spread = 2.4f, lifeMs = 300, sizePx = 1.4f * dp, seed = 80 + j) }
        }
        t.taps.forEachIndexed { k, id ->
            val i = k + t.pool
            val at = el - D.TAP_GAP_MS * i
            if (at < 0) return@forEachIndexed
            val lc = toneOf(id)
            rect("c$id")?.let { r ->
                // The flash on the land, in its own colour (300 ms).
                if (at < 300) drawRoundRect(lc.copy(alpha = .9f * half * (1f - at / 300f).let { it * it }), r.topLeft, r.size, androidx.compose.ui.geometry.CornerRadius(10f * dp))
                if (!still) {
                    if (fx.once(m.key, i * 4)) { fx.bits.ring(r.center, r.height * .75f, lc, now, 320); fx.bits.sparks(r.center, 7, lc, now, 150f * dp, lifeMs = 380, sizePx = 1.6f * dp, seed = i)
                        fx.bits.blob(r.center, r.height * .6f, lc, now, 220) }
                    val sp = (at - D.STREAK_LEAVE_MS).toFloat() / D.STREAK_MS
                    if (sp in 0f..1f) streak(r.center, into, sp * sp, lc, 5f * dp, bend = if (r.center.y > stack.center.y) -.12f else .12f)
                }
            }
            if (at >= D.STREAK_LEAVE_MS + D.STREAK_MS) { arrived++
                if (!still && fx.once(m.key, i * 4 + 1)) fx.bits.sparks(into, 5, lc, now, 110f * dp, dir = PI.toFloat(), spread = 2.4f, lifeMs = 300, sizePx = 1.4f * dp, seed = 40 + i) }
        }
        // Charge: the spell's ring steps up with each arrival.
        if (t.taps.size + t.pool > 0) spellRing(.9f * arrived / (t.taps.size + t.pool))
        return
    }
    // The rest opens with the burst.
    if (el > D.BURST_MS + 600) return
    if (fx.once(m.key, 1)) fx.freeze(D.BURST_FREEZE_MS)
    val b = el - D.BURST_FREEZE_MS
    if (b < 0) { spellRing(.9f * t.power); return }
    val c = stack.center; val h = stack.height; val k = t.power
    if (!still && fx.once(m.key, 2)) {
        fx.bits.spikes(c, 18, h * .95f * k, tone, now, dir = PI.toFloat(), spread = PI.toFloat() * .95f, lifeMs = 240, seed = 3)
        fx.bits.ring(c, h * .55f * k, tone, now, 300)
        fx.bits.blob(c, h * .7f * k, tone, now, 260)
        fx.bits.sparks(c, (22 * k).toInt(), tone, now, 260f * dp * k, dir = PI.toFloat(), spread = 1.5f, lifeMs = 620, sizePx = 1.8f * dp, seed = 5)
        fx.jolt(4f * k, 300L, .03f * k)
    }
    // The white flash on the spell (320 ms) and its ring going out with it.
    val q = (b / 320f).coerceIn(0f, 1f)
    if (q < 1f) drawRoundRect(Color.White.copy(alpha = .85f * half * k * easeOutQ(1f - q)), stack.topLeft, stack.size, corner)
    spellRing(.9f * k * (1f - (b / 300f).coerceIn(0f, 1f)))
    // Embers rise off it for half a second (five puffs, 105 ms apart).
    if (!still) for (j in 0 until 5) if (b >= j * 105L && fx.once(m.key, 10 + j))
        fx.bits.embers(Offset(c.x - stack.width * .3f + stack.width * .15f * j, c.y + h * .15f), 4, tone, now, 40f * dp, lifeMs = 800, sizePx = 1.3f * dp, seed = 60 + j)
}


/**
 * P2b, lands tapped by hand (the behaviour is Forge's; this is the look only). To the pool: each land flashes in its own colour
 * with a ring and 7 sparks as it turns, and its streak flies to the floating mana by your square. Undo: each land takes a gold
 * glint (240 ms) as it turns back, and the light returns from the pool to it.
 */
private fun DrawScope.drawHandMana(fx: Battlefield, m: dev.cardstashy.nativeplay.match.TravelMoment, rect: (String?) -> androidx.compose.ui.geometry.Rect?) {
    val D = dev.cardstashy.nativeplay.match.Director
    val t = m.travel; val el = fx.travelMs(m); val now = fx.now.longValue
    val gold = Color(0xFFF3D27E); val dp = density; val still = fx.reduced; val half = if (still) .5f else 1f
    val pool = rect("manapool") ?: fx.board?.let { rect("orb${it.viewer}") }
    val corner = androidx.compose.ui.geometry.CornerRadius(10f * dp)
    if (t.leg == dev.cardstashy.nativeplay.match.Director.Leg.UNTAP) {
        val q = (el.toFloat() / D.UNDO_MS).coerceIn(0f, 1f)
        for (id in t.taps) rect("c$id")?.let { r ->
            drawRoundRect(gold.copy(alpha = .8f * half * (1f - q)), r.topLeft, r.size, corner)
            if (!still && pool != null) streak(pool.center, r.center, q, gold, 4f * dp, bend = .12f)
        }
        return
    }
    t.taps.forEachIndexed { i, id ->
        val at = el - D.TAP_GAP_MS * i
        if (at < 0) return@forEachIndexed
        val lc = fx.board?.card(id)?.let { frameTone(cardColors(it)).first } ?: gold
        val r = rect("c$id") ?: return@forEachIndexed
        if (at < 300) drawRoundRect(lc.copy(alpha = .9f * half * (1f - at / 300f).let { it * it }), r.topLeft, r.size, corner)
        if (still) return@forEachIndexed
        if (fx.once(m.key, i * 4)) { fx.bits.ring(r.center, r.height * .75f, lc, now, 320); fx.bits.sparks(r.center, 7, lc, now, 150f * dp, lifeMs = 380, sizePx = 1.6f * dp, seed = i)
            fx.bits.blob(r.center, r.height * .6f, lc, now, 220) }
        val sp = (at - D.STREAK_LEAVE_MS).toFloat() / D.STREAK_MS
        if (pool != null && sp in 0f..1f) streak(r.center, pool.center, sp * sp, lc, 5f * dp, bend = .12f)
        if (pool != null && at >= D.STREAK_LEAVE_MS + D.STREAK_MS && fx.once(m.key, i * 4 + 1)) { fx.bits.ring(pool.center, pool.height * .9f, lc, now, 260)
            fx.bits.sparks(pool.center, 4, lc, now, 90f * dp, lifeMs = 280, sizePx = 1.3f * dp, seed = 30 + i) }
    }
}


/**
 * Match punch P3, the landing's impact on a tile at [r]: a 45 ms freeze, a white flash (300 ms), a flat gold ring under the tile
 * (460) with a quicker white one inside it, a dozen dust puffs from its foot and 16 gold sparks thrown up; the board shakes 7 dp
 * for a creature and 3 for anything else ([FxItem.power]), pushed in a little. Effects Minimal ([FxItem.entrance] -1) and reduce
 * motion keep the flash only (halved with reduce motion).
 */
internal fun DrawScope.drawImpact(fx: Battlefield, it: FxItem, p: Float, r: androidx.compose.ui.geometry.Rect) {
    val ms = p * it.dur; val now = fx.now.longValue; val dp = density
    val gold = Color(0xFFF3D27E); val k = it.power.coerceAtLeast(.3f)
    val bare = fx.reduced || it.entrance < 0
    if (!fx.reduced && it.once(1)) fx.freeze(45L)
    if (!bare && it.once(2)) {
        val bit = it.card ?: 0
        fx.jolt(7f * it.power, 220L, .012f)
        val foot = Offset(r.center.x, r.bottom - r.height * .08f)
        fx.bits.smoke(foot, (12 * k).toInt().coerceAtLeast(5), Color(0xFF8A8478), now, 46f * dp, lifeMs = 900, sizePx = r.height * .13f, seed = bit and 0xff)
        fx.bits.sparks(Offset(r.center.x, r.bottom - r.height * .2f), (16 * k).toInt().coerceAtLeast(6), gold, now, 190f * dp, dir = -(PI / 2).toFloat(), spread = 1.3f, lifeMs = 560, sizePx = 1.6f * dp, seed = bit and 0xff)
    }
    // White flash on the tile.
    if (ms < 300f) drawRoundRect(Color.White.copy(alpha = .7f * (if (fx.reduced) .5f else 1f) * (1f - ms / 300f)), r.topLeft, r.size, androidx.compose.ui.geometry.CornerRadius(10f * dp))
    // F3: a heavy landing has one ring, in the card's colour ([drawHeavy]); P3's flat rings are left out for it.
    if (bare || fx.landsHeavy(it.card)) return
    // The flat rings under the tile: gold (460 ms), and a white one inside it (260).
    fun flat(span: Float, r0: Float, r1: Float, c: Color, w: Float) { val q = ms / span; if (q >= 1f) return
        val e = 1f - (1f - q) * (1f - q); val rad = r0 + (r1 - r0) * e
        drawOval(c.copy(alpha = (1f - q) * .9f), Offset(r.center.x - rad, r.bottom - rad * .3f), androidx.compose.ui.geometry.Size(rad * 2, rad * .6f), style = Stroke(width = w * dp * (1f - q * .6f))) }
    flat(460f, r.width * .45f, r.width * 1.15f * (.8f + .2f * k), gold, 2.4f)
    flat(260f, r.width * .3f, r.width * .8f, Color.White, 1.6f)
}

// ---- Living table F3: the heavy landing (specs/living-table-build-guide.md, "F3 Weight") ----

/** F3: what a heavy landing left on the mat: where (root pixels), how big, which kind (the mat's), and when it came and began to leave. */
internal class LandMark(val card: Int, val at: Offset, val size: Float, val kind: String, val tone: Color, val born: Long,
    /** Half the tile's width and height: the mark starts at the tile's rim. */
    val halfW: Float = 0f, val halfH: Float = 0f) { var gone: Long = -1L }

/**
 * F3 on the FxLayer canvas: at the frame the heavy tile lands, the clock freezes and the board shakes (Full only), white spikes fly,
 * the mat's own dust rises and its mark is left; then a ring in the card's colour runs out to 2.4 tile heights.
 */
internal fun DrawScope.drawHeavy(fx: Battlefield, it: FxItem, p: Float, r: androidx.compose.ui.geometry.Rect, self: Offset) {
    val ms = p * it.baseMs - TableFeel.HEAVY_DROP_MS
    if (ms < 0f) return
    val now = fx.now.longValue; val dp = density; val c = r.center; val seed = (it.card ?: 0) and 0xff
    if (it.once(1)) {
        if (TableFeel.mode() == TableFeel.Mode.FULL) { fx.freeze(TableFeel.HEAVY_FREEZE_MS); fx.jolt(TableFeel.HEAVY_SHAKE, (TableFeel.HEAVY_SHAKE / TableFeel.HEAVY_SHAKE_FADE).toLong()) }
        val at = c
        if (fx.landMarks.size >= 8) fx.landMarks.removeAt(0)
        fx.landMarks += LandMark(it.card ?: 0, at + self, r.height * TableFeel.MARK_SIZE, it.note, it.tone, now, r.width / 2, r.height / 2)
        if (!fx.low) {
            val up = -(PI / 2).toFloat()
            // Design review: what the mat throws up rises from the cracks at the tile's rim, never from the card's middle over its name.
            val rim = listOf(Offset(r.left, c.y), Offset(r.right, c.y), Offset(c.x - r.width * .3f, r.top), Offset(c.x + r.width * .3f, r.top))
            fun burst(n: Int, tone: Color, speed: Float, spread: Float, life: Long, sizePx: Float, dir: Float? = up) = rim.forEachIndexed { k, at0 ->
                if (dir != null) fx.bits.sparks(at0, n / rim.size + 1, tone, now, speed, dir = dir, spread = spread, lifeMs = life, sizePx = sizePx, seed = seed + k * 13)
                else fx.bits.sparks(at0, n / rim.size + 1, tone, now, speed, lifeMs = life, sizePx = sizePx, seed = seed + k * 13) }
            // The mat's own answer (the showpiece's landMark): embers and smoke, spray, leaves, star points; a plain mat throws dust.
            when (it.note) {
                "lava" -> { fx.bits.smoke(Offset(at.x, at.y + r.height * .2f), 14, Color(0xFF8A8478), now, 46f * dp, sizePx = r.height * .13f, seed = seed)
                    burst(26, Color(0xFFFF9A3A), 300f * dp, 1.3f, 900, 1.8f * dp) }
                "ripple" -> burst(24, Color(0xFFDFF1FF), 280f * dp, 1.2f, 700, 1.8f * dp)
                "leaf" -> { fx.bits.smoke(Offset(at.x, at.y + r.height * .2f), 8, Color(0xFF8A8478), now, 46f * dp, sizePx = r.height * .13f, seed = seed)
                    burst(30, Color(0xFF8FD45A), 250f * dp, 1.5f, 1300, 2.4f * dp) }
                "star" -> { burst(18, Color.White, 250f * dp, 0f, 800, 1.8f * dp, dir = null) }
                else -> fx.bits.smoke(Offset(at.x, at.y + r.height * .2f), 12, Color(0xFF8A8478), now, 46f * dp, sizePx = r.height * .13f, seed = seed)
            }
        }
    }
    // White spikes from the tile's rim outward, tapered to a point (300 ms): they never cross the name or the P/T.
    if (!fx.low && ms < 300f) { val q = ms / 300f; val grow = minOf(1f, q / .35f); val al = 1f - ((q - .4f) / .6f).coerceIn(0f, 1f)
        for (j in 0 until TableFeel.HEAVY_SPIKES) {
            val ang = (2 * PI).toFloat() * ((j + .5f) / TableFeel.HEAVY_SPIKES) + (((seed + j * 7) * 0.6180339f) % 1f - .5f) * .35f
            val len = TableFeel.HEAVY_SPIKE_LEN * dp * (.7f + .3f * (((j * 11 + seed) * 0.6180339f) % 1f))
            val d = Offset(cos(ang), sin(ang)); val n = Offset(-d.y, d.x) * (2.2f * dp)
            val edge = min(r.width / 2 / kotlin.math.abs(d.x).coerceAtLeast(.001f), r.height / 2 / kotlin.math.abs(d.y).coerceAtLeast(.001f)) + 2f * dp
            val from = c + d * edge; val to = c + d * (edge + len * grow)
            drawPath(androidx.compose.ui.graphics.Path().apply { moveTo(from.x + n.x, from.y + n.y); lineTo(to.x, to.y); lineTo(from.x - n.x, from.y - n.y); close() }, Color.White.copy(alpha = al))
        }
    }
    // The ring: from 40 dp to 2.4 tile heights, 4 dp thinning, in the card's colour.
    val q = ms / TableFeel.HEAVY_RING_MS
    if (q < 1f) { val e = 1f - (1f - q) * (1f - q) * (1f - q); val rad = TableFeel.HEAVY_RING_FROM * dp + (r.height * TableFeel.HEAVY_RING - TableFeel.HEAVY_RING_FROM * dp) * e
        drawCircle(it.tone.copy(alpha = (1f - q) * .9f), rad, c, style = Stroke(width = TableFeel.HEAVY_RING_WIDTH * dp * (1f - q * .7f)), blendMode = androidx.compose.ui.graphics.BlendMode.Plus) }
}

// ---- Living table F7: the winning hit (specs/living-table-build-guide.md, "F7 The winning hit") ----

/**
 * F7 on the FxLayer canvas, from the moment the finished board is shown: a 340 ms freeze and a 15 dp shake (Full only), the
 * loser's orb gone in 18 spinning shards, a ring out to 70 % of the height and a light wash of the mat's win colour over the
 * cards. The flood itself and the crack are in the mat, under the cards ([WinMark]). A draw ([FxItem.player] null) only dims both orbs.
 */
internal fun DrawScope.drawWin(fx: Battlefield, it: FxItem, p: Float, orb: androidx.compose.ui.geometry.Rect?, all: List<androidx.compose.ui.geometry.Rect>) {
    val ms = p * it.baseMs; val now = fx.now.longValue; val dp = density
    if (it.player == null) { if (it.once(1)) fx.orbs.value = it.ids.associateWith { TableFeel.DRAW_DIM }; return }
    val r = orb ?: return; val c = r.center
    if (it.once(1)) {
        fx.orbs.value = mapOf(it.player to 0f)
        if (TableFeel.mode() == TableFeel.Mode.FULL) { fx.freeze(TableFeel.WIN_FREEZE_MS); fx.jolt(TableFeel.WIN_SHAKE, TableFeel.WIN_SHAKE_MS, .02f) }
        // The orb's pieces: shards that fly out, spin and fall.
        if (!fx.low) fx.bits.shards(c, TableFeel.WIN_PIECES, it.caster, TableFeel.ORB_RIM, now, 420f * dp, TableFeel.SHARD_MIN * dp, TableFeel.SHARD_MAX * dp, seed = it.player)
    }
    // Over the cards only a light wash, a third of the flood (the rest and the crack are in the mat: [WinMark]).
    val wash = TableFeel.flood(ms) * TableFeel.FLOOD_OVER_CARDS
    drawRect(Brush.radialGradient(0f to it.tone.copy(alpha = TableFeel.FLOOD_MAT[0] * wash), .5f to it.tone.copy(alpha = TableFeel.FLOOD_MAT[1] * wash), 1f to it.tone.copy(alpha = TableFeel.FLOOD_MAT[2] * wash), center = c, radius = size.width * 1.1f),
        blendMode = androidx.compose.ui.graphics.BlendMode.Plus)
    // The ring.
    val q = ms / TableFeel.WIN_RING_MS
    if (q < 1f) { val e = 1f - (1f - q) * (1f - q) * (1f - q)
        drawCircle(it.caster.copy(alpha = .9f * (1f - q)), r.maxDimension * .5f + (size.height * TableFeel.WIN_RING - r.maxDimension * .5f) * e, c, style = Stroke((6f - 4f * q) * dp), blendMode = androidx.compose.ui.graphics.BlendMode.Plus) }
}

// ---- Living table F5: the clock stops (specs/living-table-build-guide.md, "F5 The clock stops") ----

/** The grey at strength [e] (0..1): 88 % of the colour out of everything already drawn, then a 25 % dark blue wash. */
internal fun DrawScope.drawGrey(e: Float) {
    if (e <= 0f) return
    // Taking colour out needs the saturation blend (Android 10 and up); older phones get a deeper wash in its place.
    if (android.os.Build.VERSION.SDK_INT >= 29) drawRect(Color(0xFF808080).copy(alpha = TableFeel.CLOCK_GREY * e), blendMode = androidx.compose.ui.graphics.BlendMode.Saturation)
    else drawRect(Color(0xFF30333A).copy(alpha = .45f * e))
    drawRect(TableFeel.CLOCK_WASH_TONE.copy(alpha = TableFeel.CLOCK_WASH * e))
}

/**
 * F5 over the grey: one piece leaves the loyalty shield ([shield]) per point, 120 ms apart, and circles the card ([card], as it
 * lies) at 78 % of its height; the shield counts down with them from what it had to what Forge says it has left. When colour
 * starts to return the pieces fly out and fade.
 */
internal fun DrawScope.drawClock(tm: androidx.compose.ui.text.TextMeasurer, it: FxItem, p: Float, card: androidx.compose.ui.geometry.Rect, shield: androidx.compose.ui.geometry.Rect?) {
    val ms = p * it.dur; val n = it.points; val dp = density; val ice = Color(0xFF5CC8FF)
    val e = TableFeel.clockIn(ms, it.dur); val back = it.dur - TableFeel.CLOCK_OUT_MS
    val c = Offset(card.center.x, card.center.y - TableFeel.CLOCK_LIFT * dp * e)
    // Where a point of the card (or its shield, which travels with it) is while the card is lifted and grown.
    fun lifted(o: Offset) = Offset(card.center.x + (o.x - card.center.x) * (1f + TableFeel.CLOCK_GROW * e), card.center.y + (o.y - card.center.y) * (1f + TableFeel.CLOCK_GROW * e) - TableFeel.CLOCK_LIFT * dp * e)
    val from = lifted(shield?.center ?: Offset(card.center.x, card.bottom))
    val orbit = card.height * TableFeel.CLOCK_ORBIT
    val gone = ((ms - back) / 260f).coerceIn(0f, 1f)
    for (k in 0 until n) {
        val born = TableFeel.CLOCK_IN_MS + k * TableFeel.CLOCK_PIECE_GAP_MS
        if (ms < born || born > back) continue
        val age = ms - born; val out = (age / 260f).coerceAtMost(1f).let { x -> 1f - (1f - x) * (1f - x) }
        // Each takes its own place on the ring, and the ring turns half way round in 650 ms.
        val ang = (k.toFloat() / n) * 2f * PI.toFloat() - PI.toFloat() / 2f + age / TableFeel.CLOCK_CIRCLE_MS * PI.toFloat()
        val on = Offset(c.x + cos(ang) * orbit * (1f + .35f * gone), c.y + sin(ang) * orbit * (1f + .35f * gone))
        val at = from + (on - from) * out; val a = 1f - gone; val r = 4.2f * dp
        drawCircle(Brush.radialGradient(listOf(ice.copy(alpha = .5f * a), ice.copy(alpha = 0f)), at, r * 3f), r * 3f, at)
        // A chip of the shield: a small kite, turning as it goes.
        val turn = ang * 2f; val cs = cos(turn); val sn = sin(turn)
        fun pt(x: Float, y: Float) = Offset(at.x + x * cs - y * sn, at.y + x * sn + y * cs)
        val path = androidx.compose.ui.graphics.Path().apply { val a0 = pt(0f, -r); val b0 = pt(r * .7f, 0f); val c0 = pt(0f, r * 1.3f); val d0 = pt(-r * .7f, 0f)
            moveTo(a0.x, a0.y); lineTo(b0.x, b0.y); lineTo(c0.x, c0.y); lineTo(d0.x, d0.y); close() }
        drawPath(path, Color(0xFF0B0E15).copy(alpha = a)); drawPath(path, ice.copy(alpha = a), style = Stroke(1.2f * dp))
    }
    // The number on the shield counts down with the pieces (the tile's own shield already shows what is left).
    val off = TableFeel.clockPieces(ms, n, it.dur); val left = it.label.toIntOrNull()
    if (shield != null && left != null && off < n && ms < back) {
        val s = androidx.compose.ui.geometry.Rect(lifted(shield.topLeft), lifted(shield.bottomRight))
        val path = androidx.compose.ui.graphics.Path().apply { moveTo(s.left, s.top); lineTo(s.right, s.top); lineTo(s.right, s.top + s.height * .58f); lineTo(s.center.x, s.bottom); lineTo(s.left, s.top + s.height * .58f); close() }
        drawPath(path, Color(0xFF0B0E15)); drawPath(path, ice, style = Stroke(1.6f * dp, join = androidx.compose.ui.graphics.StrokeJoin.Round))
        val lay = tm.measure("${left + n - off}", androidx.compose.ui.text.TextStyle(fontFamily = Type.Sans, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, fontSize = (s.height * .58f / dp / fontScale).sp, color = ice))
        drawText(lay, topLeft = Offset(s.center.x - lay.size.width / 2f, s.top + s.height * .29f - lay.size.height / 2f))
    }
}
