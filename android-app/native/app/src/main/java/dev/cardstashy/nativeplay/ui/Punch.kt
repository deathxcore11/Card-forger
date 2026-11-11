package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
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
internal enum class Bit { SPARK, EMBER, SPIKE, RING, BLOB, SMOKE }

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
                    drawCircle(c.copy(alpha = (1f - q) * .9f), r, Offset(x[i], y[i]), style = Stroke(width = max(1f, 4f * (1f - q) + 1f))) }
                Bit.SPIKE -> { val grow = min(1f, q / .35f); val a = (1f - smoothQ(.4f, 1f, q))
                    val from = Offset(x[i], y[i]) + Offset(vx[i], vy[i]) * (sz[i] * .25f * grow)
                    val to = Offset(x[i], y[i]) + Offset(vx[i], vy[i]) * (sz[i] * grow)
                    drawLine(c.copy(alpha = a), from, to, strokeWidth = 3f * (1f - q) + 1f, cap = StrokeCap.Round) }
                Bit.BLOB -> { val a = .7f * (1f - q); val r = sz[i] * (.6f + .4f * q)
                    drawCircle(Brush.radialGradient(listOf(c.copy(alpha = a), c.copy(alpha = 0f)), Offset(x[i], y[i]), r), r, Offset(x[i], y[i])) }
            }
        }
    }

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
