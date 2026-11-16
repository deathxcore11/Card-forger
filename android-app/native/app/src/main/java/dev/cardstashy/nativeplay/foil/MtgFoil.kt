package dev.cardstashy.nativeplay.foil

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Magic foil's measured maps, ported from the site's mtg-foil-analysis.js (analyzeMtgCard, generated port data at 6ceede8c).
 * The site reads each printing's inks from its own scan: gold ink, fluorescent ink, bare paper, the drawn lines, and a smoothed
 * height for relief and thin film. Ink-selective treatments (gilded, neon, invisible ink, textured, raised) then shine only where
 * that ink is printed, instead of across the whole card.
 *
 * One change from the site, for Android only: the site keeps "drawn lines" in the mask's alpha and the stroke direction and strength
 * in the relief's G/B/A. Android premultiplies bitmap alpha, which would corrupt them, so the maps here are opaque: the lines move to
 * the relief's green channel and the stroke (cos 2θ, sin 2θ, strength) gets its own map. Since the first approved foil (14 Nov) only
 * facet foil reads the stroke, to turn the light along each shard's cut edge.
 *
 * Facet foil (app first, 7 Nov): the printed glass shards are cut, each one its own flat mirror. [facets] finds them once, at analysis
 * time: real connected shards split by their printed neon outlines, each with a fixed hashed tilt, so a shard flashes in one piece.
 */
object MtgFoil {
    /** readFoilPixels(img, 372): half the scan's width, between 64 and 372 pixels, height to scale (488 x 680 -> 244 x 340). */
    fun analysisSize(w: Int, h: Int): Pair<Int, Int> {
        val W = max(64, min(372, (w / 2f).roundToInt()))
        return W to (W.toFloat() * h / w).roundToInt()
    }

    /** Most a drawn line turns the grating (stroke strength's ceiling): enough for the rainbow to run along the lines, never a full
     *  snap to them, so where lines change direction the rainbow bends instead of ringing. */
    const val STEER = .7f

    /** Facet foil's pattern number (MTG_PATTERN.facet in the site prototype of 7 Nov). */
    const val FACET = 21f

    /** True when the recipe reads the measured maps: ink-selective covers, relief, film, textured foil's height and facet shards.
     *  Traditional, etched and the other fixed patterns draw the same without them (the first approved foil, ui/Foil.kt, no longer
     *  steers its grating along the drawn lines), so they skip the work. */
    fun needsMaps(cover: Float, relief: Float, film: Float, pat: Float) = cover > 1.5f || relief > 0f || film > .5f || abs(pat - 5f) < .5f || abs(pat - FACET) < .5f

    /** mask: R gold ink, G fluorescent ink, B bare paper-white, A 255. relief: R smoothed height, G drawn lines, B facet cut edge (0 off
     *  facet foil), A 255. stroke: R/G stroke direction (cos 2θ, sin 2θ as .5 + .5 v), B stroke strength (the site's
     *  coherence x magnitude, gated by line evidence), A 255. facet (facet foil only): see [Facets]. */
    class Maps(val w: Int, val h: Int, val mask: ByteArray, val relief: ByteArray, val stroke: ByteArray, val facet: ByteArray? = null)

    private fun ss(a: Float, b: Float, x: Float): Float { val t = ((x - a) / (b - a)).coerceIn(0f, 1f); return t * t * (3 - 2 * t) }
    private fun q(v: Float): Byte = (v.coerceIn(0f, 1f) * 255).roundToInt().toByte()

    /** analyzeMtgCard(rgba, W, H) over ARGB pixels at analysis size. [facetText]: the frame's text box when the printing is facet foil,
     *  so its shards are cut too (null for every other foil). */
    fun analyze(argb: IntArray, W: Int, H: Int, facetText: FloatArray? = null): Maps {
        val N = W * H
        val lum = FloatArray(N); val gold = FloatArray(N); val neon = FloatArray(N); val paper = FloatArray(N)
        for (i in 0 until N) {
            val p = argb[i]
            val r = (p shr 16 and 255) / 255f; val g = (p shr 8 and 255) / 255f; val b = (p and 255) / 255f
            val mx = max(r, max(g, b)); val mn = min(r, min(g, b)); val c = mx - mn; val s = if (mx > 0f) c / mx else 0f
            lum[i] = .2126f * r + .7152f * g + .0722f * b
            var hue = 0f
            if (c > 1e-4f) { hue = if (mx == r) ((g - b) / c + 6) % 6 else if (mx == g) (b - r) / c + 2 else (r - g) / c + 4; hue *= 60 }
            // Gold ink: warm yellow-orange, moderately saturated, mid-to-bright.
            gold[i] = ss(.28f, .45f, s) * ss(.38f, .55f, mx) * (1 - ss(4f, 10f, abs(hue - 44) - 14))
            // Fluorescent inks sit at the edge of sRGB: nearly full saturation and value.
            neon[i] = ss(.72f, .9f, s) * ss(.72f, .92f, mx)
            paper[i] = (1 - ss(.08f, .2f, s)) * ss(.66f, .82f, lum[i])
        }
        val height = YgoFoil.boxBlur(lum, W, H, 2, 2)
        val edge0 = FloatArray(N); val jxx = FloatArray(N); val jyy = FloatArray(N); val jxy = FloatArray(N)
        for (j in 1 until H - 1) for (i in 1 until W - 1) {
            val k = j * W + i; val dx = lum[k + 1] - lum[k - 1]; val dy = lum[k + W] - lum[k - W]
            edge0[k] = hypot(dx, dy); jxx[k] = dx * dx; jyy[k] = dy * dy; jxy[k] = dx * dy
        }
        val edge = YgoFoil.boxBlur(edge0, W, H, 1, 1)
        // Structure tensor (the site's analyzer): the drawn line's direction as a doubled angle, so a line and its reverse agree.
        val sxx = YgoFoil.boxBlur(jxx, W, H, 3); val syy = YgoFoil.boxBlur(jyy, W, H, 3); val sxy = YgoFoil.boxBlur(jxy, W, H, 3)
        // Steering needs real line evidence: drawn lines close by (the edge measure) and local contrast. A smooth shaded area (a halo, a
        // sky) has a coherent gradient too, but no lines; there the gate closes and fades, so it keeps the plain sweep of the sheet.
        val lum2 = FloatArray(N) { lum[it] * lum[it] }
        // Drawn lines come in fields (hatching, speed lines, lettering): many edges close together. A lone edge, the outline of a
        // painted figure against its sky, is not one, so the window is wide (11 px) and asks for edges over a good share of it; else
        // the rainbow would trace a glowing outline round the figure.
        val mu = YgoFoil.boxBlur(lum, W, H, 2, 1); val mu2 = YgoFoil.boxBlur(lum2, W, H, 2, 1)
        for (k in 0 until N) lum2[k] = ss(.05f, .22f, edge[k])
        val lines = YgoFoil.boxBlur(lum2, W, H, max(2, (5 * W / 244f).roundToInt()), 1)
        for (k in 0 until N) lum2[k] = ss(.025f, .07f, kotlin.math.sqrt(max(0f, mu2[k] - mu[k] * mu[k]))) * ss(.3f, .55f, lines[k])
        val gate = YgoFoil.boxBlur(lum2, W, H, 1, 1)
        for (k in 0 until N) {
            val a = sxx[k] - syy[k]; val b = 2 * sxy[k]; val m = hypot(a, b); val coh = m / (sxx[k] + syy[k] + 1e-6f)
            lum2[k] = ss(.15f, .7f, coh) * min(1f, m * 400) * gate[k]
        }
        // Steering turns the grating, and the rainbow is very sensitive to that turn: a gate that opens within a pixel or two draws a
        // ring of rainbow round every island of line evidence. So the strength is spread wide (three passes, about 9 px at 244 px) and
        // capped below a full turn: it rises and falls over many pixels, and the turn is always gradual, with no edge to trace.
        val strength = YgoFoil.boxBlur(lum2, W, H, max(1, (3 * W / 244f).roundToInt()), 3)
        for (k in 0 until N) strength[k] = STEER * ss(0f, .6f, strength[k])
        val goldS = YgoFoil.boxBlur(gold, W, H, 1, 1); val neonS = YgoFoil.boxBlur(neon, W, H, 1, 1); val paperS = YgoFoil.boxBlur(paper, W, H, 1, 1)
        val cut = facetText?.let { facets(argb, W, H, it) }
        val mask = ByteArray(N * 4); val relief = ByteArray(N * 4); val stroke = ByteArray(N * 4)
        for (k in 0 until N) {
            mask[k * 4] = q(goldS[k]); mask[k * 4 + 1] = q(neonS[k]); mask[k * 4 + 2] = q(paperS[k]); mask[k * 4 + 3] = -1
            relief[k * 4] = q(height[k]); relief[k * 4 + 1] = q(ss(.05f, .22f, edge[k])); relief[k * 4 + 2] = if (cut != null) q(cut.edge[k]) else 0; relief[k * 4 + 3] = -1
            val a = sxx[k] - syy[k]; val b = 2 * sxy[k]; val m = hypot(a, b)
            stroke[k * 4] = q(a / (m + 1e-9f) * .5f + .5f); stroke[k * 4 + 1] = q(b / (m + 1e-9f) * .5f + .5f)
            stroke[k * 4 + 2] = q(strength[k]); stroke[k * 4 + 3] = -1
        }
        return Maps(W, H, mask, relief, stroke, cut?.facet)
    }

    /** Facet foil's cut. [facet] RGBA: R the shard's tilt seed (one hashed value per piece, kept whole, never blurred, and carried a
     *  couple of pixels past the piece so filtering never mixes in another value), G the matte figure (0 here: it is measured from the card's depth cut, which [figureMatte] lays in),
     *  B the shard: its depth inside the piece, 0 at the outline rising to 1 halfway in, so flash and sheen fade softly to the outline;
     *  A 255. [edge] the printed cut edges next to a shard (0..1), [shard] the shard pieces as a 0/1 mask and [pieces] how many. */
    class Facets(val facet: ByteArray, val edge: FloatArray, val shard: FloatArray, val pieces: Int)

    /** Share of a piece's outline that must run along a printed outline (a thin line of colour, or the card's edge): a printed shard
     *  is drawn with one, a pale patch of art (teeth, a highlight, sky) is not, so it stays art instead of flashing as glass. */
    const val OUTLINED = .12f

    /**
     * Finds the printed glass shards once per card (never per pixel per frame). A shard's face is pale, low-saturation glass (sat < .3,
     * lum > .35, blue at least red); a piece starts outside the text box and the name bar; its printed outline is a saturated neon line.
     * Faces are split into real connected pieces by those lines (4-connected; the lines are walls), crumbs (a letter, a highlight) are
     * let go, and each piece then takes in its own darker blue facets, grown a few pixels over the art and as far as its glass goes over
     * the boxes, never across a line, so a shard flashes in one piece, right across the box edge. Pieces that never run along a
     * printed line are not glass and are let go too. Each piece's tilt
     * seed is hashed from where it starts, so the same card always cuts the same way. Sizes are set at the analysis width of a normal
     * scan (244 px) and scale with [W]. [text] is the frame's text box in card space. No per-pixel allocation: flat int buffers only.
     * [siteSeed]: hash each piece's tilt seed in double, as the site's port (mtgFacets) does, so [cardMaps] gives every shard the
     * site's seed; false keeps this cut's own float hash (the facet map [analyze] has always made).
     */
    fun facets(argb: IntArray, W: Int, H: Int, text: FloatArray, siteSeed: Boolean = false): Facets {
        val N = W * H; val s = W / 244f
        val line = BooleanArray(N); val ink = FloatArray(N); val wall = BooleanArray(N); val box = BooleanArray(N); val seed = BooleanArray(N); val grow = BooleanArray(N)
        for (k in 0 until N) {
            val p = argb[k]; val u = (k % W + .5f) / W; val v = (k / W + .5f) / H
            val r = (p shr 16 and 255) / 255f; val g = (p shr 8 and 255) / 255f; val b = (p and 255) / 255f
            val mx = max(r, max(g, b)); val mn = min(r, min(g, b)); val sat = if (mx > 0f) (mx - mn) / mx else 0f
            val lum = .2126f * r + .7152f * g + .0722f * b
            val across = u >= text[0] && u <= text[2]
            // The boxes: the text box with the type line just above it, and the name bar.
            val boxed = across && (v >= text[1] - .065f && v <= text[3] || v >= .035f && v <= .105f)
            line[k] = sat > .55f && mx > .6f
            ink[k] = if (sat > .35f && mx > .3f) 1f else 0f
            wall[k] = line[k]
            if (wall[k]) continue
            box[k] = boxed
            // The glass runs on over the text box and the name bar, darker there: over a box a shard is its blue glass only, never the
            // box's dark ink or its white letters (pale too), and it follows that glass as far as it goes.
            seed[k] = if (boxed) b - r > .08f && b - g > .04f && b > .26f else sat < .3f && lum > .35f && b >= r
            grow[k] = if (boxed) b - r > .04f && b > .12f && b >= g - .02f else seed[k] || (b - r > .04f && b > .12f) || (sat < .3f && lum > .3f && b >= r - .01f)
        }
        val label = IntArray(N); val queue = IntArray(N); var starts = IntArray(64); var count = 0
        val minArea = max(8, (40 * s * s).roundToInt())
        for (k0 in 0 until N) {
            if (!seed[k0] || label[k0] != 0) continue
            val id = count + 1; var head = 0; var tail = 0; queue[tail++] = k0; label[k0] = id
            while (head < tail) {
                val k = queue[head++]; val x = k % W
                if (x > 0 && seed[k - 1] && label[k - 1] == 0) { label[k - 1] = id; queue[tail++] = k - 1 }
                if (x < W - 1 && seed[k + 1] && label[k + 1] == 0) { label[k + 1] = id; queue[tail++] = k + 1 }
                if (k >= W && seed[k - W] && label[k - W] == 0) { label[k - W] = id; queue[tail++] = k - W }
                if (k < N - W && seed[k + W] && label[k + W] == 0) { label[k + W] = id; queue[tail++] = k + W }
            }
            if (count == starts.size) starts = starts.copyOf(count * 2)
            starts[count++] = k0
            if (tail < minArea) for (i in 0 until tail) label[queue[i]] = -1
        }
        // Darker facets join their shard one ring of pixels at a time (all shards grow together, so none steals another's). The front
        // and the next ring share one buffer: the front at the start, the next ring written from the end.
        var front = 0
        for (k in 0 until N) if (label[k] > 0) queue[front++] = k
        val ring = IntArray(N)
        // Over the art a piece grows a few pixels (its darker facets); over a box it follows its glass as far as it goes, so a shard
        // that crosses the text box top carries on into it in one piece instead of stopping at a straight line.
        val artRings = max(1, (10 * s).roundToInt()); val boxRings = max(artRings, (70 * s).roundToInt())
        for (r in 0 until boxRings) {
            if (front == 0) break
            var next = 0
            for (f in 0 until front) {
                val k = queue[f]; val x = k % W; val id = label[k]
                // The four neighbours, written out (no local function: it would capture and allocate per pixel).
                for (dir in 0 until 4) {
                    val n = when (dir) { 0 -> if (x > 0) k - 1 else -1; 1 -> if (x < W - 1) k + 1 else -1; 2 -> if (k >= W) k - W else -1; else -> if (k < N - W) k + W else -1 }
                    if (n >= 0 && grow[n] && label[n] == 0 && (r < artRings || box[n])) { label[n] = id; ring[next++] = n }
                }
            }
            System.arraycopy(ring, 0, queue, 0, next); front = next
        }
        // Pinholes (a speck of print the rules missed) close: a free pixel held on three sides by one shard joins it.
        repeat(2) {
            for (k in 0 until N) ring[k] = 0
            for (k in 0 until N) {
                if (label[k] > 0 || wall[k]) continue
                val x = k % W
                val a = if (x > 0) label[k - 1] else 0; val b = if (x < W - 1) label[k + 1] else 0
                val c = if (k >= W) label[k - W] else 0; val d = if (k < N - W) label[k + W] else 0
                // Held on three sides: by a's piece or by b's (any three of four include a or b).
                val byA = a > 0 && 1 + (if (b == a) 1 else 0) + (if (c == a) 1 else 0) + (if (d == a) 1 else 0) >= 3
                val byB = b > 0 && (if (a == b) 1 else 0) + 1 + (if (c == b) 1 else 0) + (if (d == b) 1 else 0) >= 3
                ring[k] = if (byA) a else if (byB) b else 0
            }
            for (k in 0 until N) if (ring[k] > 0) label[k] = ring[k]
        }
        // Pieces that touch with no printed line between them are one shard (pale and darker glass seeded apart, then grown together):
        // they join, so a shard never shows a seam inside its glass. Contacts are counted per pair (flat long keys, sorted), and a few
        // pixels of contact are needed, so two shards meeting at a corner where the outline breaks stay apart.
        run {
            var pairs = LongArray(1024); var np = 0
            for (k in 0 until N) for (dir in 0 until 2) {
                val a = label[k]; val b = if (dir == 0) (if (k % W < W - 1) label[k + 1] else 0) else (if (k < N - W) label[k + W] else 0)
                if (a <= 0 || b <= 0 || a == b) continue
                if (np == pairs.size) pairs = pairs.copyOf(np * 2)
                pairs[np++] = min(a, b).toLong() shl 32 or max(a, b).toLong()
            }
            java.util.Arrays.sort(pairs, 0, np)
            val parent = IntArray(count + 1) { it }
            fun find(i: Int): Int { var r = i; while (parent[r] != r) r = parent[r]; var j = i; while (parent[j] != r) { val n = parent[j]; parent[j] = r; j = n }; return r }
            val need = max(3, (4 * s).roundToInt())
            var i = 0
            while (i < np) {
                var j = i; while (j < np && pairs[j] == pairs[i]) j++
                if (j - i >= need) { val a = find((pairs[i] shr 32).toInt()); val b = find((pairs[i] and 0xffffffffL).toInt()); if (a != b) parent[max(a, b)] = min(a, b) }
                i = j
            }
            for (k in 0 until N) if (label[k] > 0) label[k] = find(label[k])
        }
        // A piece is glass only when its outline runs along a printed line for a fair share of its length. A printed outline is a thin
        // line of colour: the bright neon ones, and over the dark boxes dimmer ones; thin means little of that colour around it, so a
        // pale patch inside coloured art (a field of colour, not a line) does not count as outlined. The card's own edge cuts a shard too.
        val dense = YgoFoil.boxBlur(ink, W, H, max(1, (2 * s).roundToInt()), 1)
        val near = FloatArray(N) { if (line[it]) 1f else 0f }
        for (k in 0 until N) ink[k] = if (line[k] || ink[k] > 0f && dense[k] < .5f) 1f else 0f
        val along = max(1, (2 * s).roundToInt())
        val reachLine = YgoFoil.boxBlur(near, W, H, along, 1); val reachThin = YgoFoil.boxBlur(ink, W, H, along, 1)
        val rim = IntArray(count + 1); val drawn = IntArray(count + 1); val neonRun = IntArray(count + 1)
        for (k in 0 until N) {
            val id = label[k]; if (id <= 0) continue
            val x = k % W
            if (x == 0 || x == W - 1 || k < W || k >= N - W) { rim[id]++; drawn[id]++; continue }
            val edgeOf = label[k - 1] != id || label[k + 1] != id || label[k - W] != id || label[k + W] != id
            if (!edgeOf) continue
            rim[id]++; if (reachThin[k] > 1e-3f) drawn[id]++; if (reachLine[k] > 1e-3f) neonRun[id]++
        }
        val keep = BooleanArray(count + 1); var pieces = 0
        // A piece's rim also runs round the darker facets inside it, so a real shard can have a long rim and a modest share on a line:
        // a fair run of bright neon outline (a few pixels) is enough too. Pale art has neither.
        val run = max(4, (6 * s).roundToInt())
        for (id in 1..count) if (rim[id] > 0 && (drawn[id] >= OUTLINED * rim[id] || neonRun[id] >= run)) { keep[id] = true; pieces++ }
        for (k in 0 until N) if (label[k] > 0 && !keep[label[k]]) label[k] = 0
        // Depth inside each piece (chamfer distance to its outline), so the shard fades to its outline; out of the card counts as inside.
        val INF = 1e6f; val dist = FloatArray(N)
        for (k in 0 until N) {
            val id = label[k]
            dist[k] = if (id <= 0) 0f else {
                val x = k % W
                if ((x > 0 && label[k - 1] != id) || (x < W - 1 && label[k + 1] != id) || (k >= W && label[k - W] != id) || (k < N - W && label[k + W] != id)) 1f else INF
            }
        }
        val D = 1.4142f
        for (y in 0 until H) for (x in 0 until W) {
            val k = y * W + x; if (dist[k] <= 1f) continue
            var d = dist[k]
            if (x > 0) d = min(d, dist[k - 1] + 1)
            if (y > 0) { d = min(d, dist[k - W] + 1); if (x > 0) d = min(d, dist[k - W - 1] + D); if (x < W - 1) d = min(d, dist[k - W + 1] + D) }
            dist[k] = d
        }
        for (y in H - 1 downTo 0) for (x in W - 1 downTo 0) {
            val k = y * W + x; if (dist[k] <= 1f) continue
            var d = dist[k]
            if (x < W - 1) d = min(d, dist[k + 1] + 1)
            if (y < H - 1) { d = min(d, dist[k + W] + 1); if (x < W - 1) d = min(d, dist[k + W + 1] + D); if (x > 0) d = min(d, dist[k + W - 1] + D) }
            dist[k] = d
        }
        val deepest = FloatArray(count + 1)
        for (k in 0 until N) { val id = label[k]; if (id > 0 && dist[k] < INF) deepest[id] = max(deepest[id], dist[k]) }
        val ramp0 = 2.5f * s
        val shard = FloatArray(N); val depth = FloatArray(N); val seedOf = FloatArray(count + 1)
        for (id in 1..count) if (keep[id]) {
            val k0 = starts[id - 1]
            seedOf[id] = if (siteSeed) hashJs((k0 % W).toDouble() / W * 97, (k0 / W).toDouble() / H * 97).toFloat()
                else hash((k0 % W).toFloat() / W * 97f, (k0 / W).toFloat() / H * 97f)
        }
        // The seed per pixel: the piece's own, then carried two pixels out into free pixels (never over another piece).
        val seedPx = IntArray(N) { if (label[it] > 0) label[it] else 0 }
        repeat(2) {
            for (k in 0 until N) ring[k] = seedPx[k]
            for (k in 0 until N) {
                if (ring[k] != 0) continue
                val x = k % W
                seedPx[k] = if (x > 0 && ring[k - 1] != 0) ring[k - 1] else if (x < W - 1 && ring[k + 1] != 0) ring[k + 1]
                    else if (k >= W && ring[k - W] != 0) ring[k - W] else if (k < N - W && ring[k + W] != 0) ring[k + W] else 0
            }
        }
        for (k in 0 until N) {
            val id = label[k]
            if (id > 0) { shard[k] = 1f; depth[k] = min(1f, dist[k] / max(ramp0, .5f * deepest[id])) }
        }
        // A soften (two passes of one pixel) so the outline is a smooth curve, not a staircase, when the 244 px map is drawn at card
        // size; it stays within the two pixels the seed is carried past the piece.
        val soft = YgoFoil.boxBlur(depth, W, H, 1, 2)
        val facet = ByteArray(N * 4)
        for (k in 0 until N) {
            facet[k * 4] = if (seedPx[k] > 0) q(seedOf[seedPx[k]]) else 0; facet[k * 4 + 1] = 0
            facet[k * 4 + 2] = q(if (seedPx[k] > 0) soft[k] else 0f); facet[k * 4 + 3] = -1
        }
        // Cut edges: the printed neon outline within a few pixels of a shard, not every saturated ink on the card.
        val reach = YgoFoil.boxBlur(shard, W, H, max(1, (3 * s).roundToInt()), 1)
        for (k in 0 until N) near[k] = if (line[k] && reach[k] > 1e-3f) 1f else 0f
        val rimEdge = YgoFoil.boxBlur(near, W, H, 1, 1)
        return Facets(facet, FloatArray(N) { max(near[it] * .85f, min(1f, rimEdge[it] * 1.6f)) }, shard, pieces)
    }

    /** The matte figure (zone 3: the creature printed without foil) into a facet map's G, from a 0..1 matte at the map's size; under
     *  the shards it is 0 (the shard draws there). Returns a new map; the cut itself is untouched. */
    fun withFigure(facet: ByteArray, figure: FloatArray): ByteArray {
        val o = facet.copyOf()
        for (k in figure.indices) o[k * 4 + 1] = q(figure[k] * (1f - (facet[k * 4 + 2].toInt() and 255) / 255f))
        return o
    }

    /** The depth cut's figure ([fig], [fw] x [fh] over the whole card) laid into a facet map of [w] x [h]: scaled to the map and kept off
     *  the text box, the footer under it and the name bar (those are frame, not art). */
    fun figureMatte(facet: ByteArray, fig: FloatArray, fw: Int, fh: Int, w: Int, h: Int, text: FloatArray): ByteArray {
        val m = DepthMatte.resize(fig, fw, fh, w, h)
        for (k in m.indices) {
            val u = (k % w + .5f) / w; val v = (k / w + .5f) / h
            if (v >= text[3] || u >= text[0] && u <= text[2] && (v >= text[1] || v >= .035f && v <= .105f)) m[k] = 0f
        }
        return withFigure(facet, m)
    }

    // ---- Per-card maps for the approved look (Foil Test Bench "Blended", 16 Nov 2026), ported line for line from the site's
    // mtg-foil-analysis.js (findScanStar, silverInk, artWindow, cardBoxes, mtgCardMaps). The analysis picture is MAP_W x MAP_H,
    // as on the bench; every rule below was checked there on real scans. The site computes in double and stores in Float32Array:
    // so do these (Double arithmetic, Float storage), and round like Math.round (floor(v + .5)), so the maps match the site's
    // byte for byte nearly everywhere (MtgCardMapsTest).

    /** The maps' fixed size (the site's MTG_MAP_W x MTG_MAP_H, the Foil Test Bench's). */
    const val MAP_W = 336
    const val MAP_H = 468

    /** JS Math.round: halves go up, toward +infinity. */
    private fun jsRound(v: Double): Int = kotlin.math.floor(v + .5).toInt()
    /** A frame box fraction as the site writes it (.887, not .887f's 0.88700002): its shortest decimal, read back as a double. */
    private fun dec(v: Float): Double = v.toString().toDouble()
    private fun dec(b: FloatArray) = DoubleArray(b.size) { dec(b[it]) }
    /** The site's boxBlur (mtg-foil-analysis.js): YgoFoil.boxBlur's algorithm, but its running sum is a double, as in JS. */
    private fun boxBlurJs(src: FloatArray, w: Int, h: Int, r: Int, passes: Int = 2): FloatArray {
        var a = src.copyOf(); var b = FloatArray(a.size)
        repeat(passes) {
            for (horiz in booleanArrayOf(true, false)) {
                val n = if (horiz) w else h; val m = if (horiz) h else w
                for (o in 0 until m) {
                    fun at(i: Int): Int { val c = min(n - 1, max(0, i)); return if (horiz) o * w + c else c * w + o }
                    var s = 0.0
                    for (i in -r..r) s += a[at(i)]
                    for (i in 0 until n) { b[at(i)] = (s / (2 * r + 1)).toFloat(); s += a[at(i + r + 1)].toDouble() - a[at(i - r)].toDouble() }
                }
                val t = a; a = b; b = t
            }
        }
        return a
    }

    /**
     * Finds the shooting star that a scan of a real foil already carries. [argb] is the card picture, top row first; [text] is the
     * frame's rules box. A star is a white point whose four long rays are all much whiter than the gaps between rays. Returns (x, y)
     * (0..1 on the card) or null. Tested on Wrath of God 7ED and Eternal Witness P30A (found, at 672, 360 and 200 px wide) and
     * Counterspell DMR 281 (a nonfoil scan: none).
     */
    fun findScanStar(argb: IntArray, W: Int, H: Int, text: FloatArray): FloatArray? {
        val tx = dec(text)
        fun wh(x0: Double, y0: Double): Int {
            val x = jsRound(x0); val y = jsRound(y0)
            if (x < 0 || y < 0 || x >= W || y >= H) return 0
            val p = argb[y * W + x]
            return min(p shr 16 and 255, min(p shr 8 and 255, p and 255))
        }
        fun near(x: Double, y: Double): Int { var m = 0; for (dy in -1..1) for (dx in -1..1) m = max(m, wh(x + dx, y + dy)); return m }
        val R = .06 * W; val T = doubleArrayOf(.25, .45, .65, .85)
        var best: FloatArray? = null; var top = 18.0
        var cy = kotlin.math.floor((tx[3] - .035) * H).toInt()
        while (cy < (tx[3] + .03) * H) {
            var cx = kotlin.math.floor((tx[0] + .04) * W).toInt()
            while (cx < (tx[0] + .17) * W) {
                if (wh(cx.toDouble(), cy.toDouble()) >= 235) {
                    var off = 0.0; var arm = 255.0
                    for (k in 0 until 4) {
                        // StrictMath: the fdlibm sine and cosine, as V8's.
                        val a = k * Math.PI / 2; val o = a + Math.PI / 8; var r1 = 0.0
                        for (t in T) {
                            r1 += near(cx + R * t * StrictMath.cos(a), cy + R * t * StrictMath.sin(a))
                            off += wh(cx + R * t * StrictMath.cos(o), cy + R * t * StrictMath.sin(o))
                        }
                        arm = min(arm, r1 / T.size)
                    }
                    val sc = arm - off / (4 * T.size)
                    if (sc > top) { top = sc; best = floatArrayOf(((cx + .5) / W).toFloat(), ((cy + .5) / H).toFloat()) }
                }
                cx++
            }
            cy++
        }
        return best
    }

    /** Silver scroll's two maps: [ink] the polished silver ink, [paper] the rules paper (0..1 per pixel). */
    class SilverInk(val ink: FloatArray, val paper: FloatArray)

    /**
     * Silver ink on a silver scroll card (Japanese Mystical Archive, SOA): the polished plate borders and bottom frame. In the scan
     * they are neutral grey and smooth along their length, while the silver picture is grainy and the rules paper is a large bright
     * area. [argb] is the card at analysis size, top row first. Checked on seven cards (SOA 131, 140, 149, 157, 167, 176, 185): rules
     * box border and bottom frame found on all, name plate ring on most.
     */
    fun silverInk(argb: IntArray, W: Int, H: Int): SilverInk {
        val N = W * H
        fun ss(a: Double, b: Double, x: Double) = max(0.0, min(1.0, (x - a) / (b - a)))
        val lum = FloatArray(N); val neu = FloatArray(N)
        for (i in 0 until N) {
            val p = argb[i]; val r = (p shr 16 and 255) / 255.0; val g = (p shr 8 and 255) / 255.0; val b = (p and 255) / 255.0
            lum[i] = (.2126 * r + .7152 * g + .0722 * b).toFloat(); neu[i] = (1 - ss(.045, .09, max(r, max(g, b)) - min(r, min(g, b)))).toFloat()
        }
        // box mean along one axis
        fun box(src: FloatArray, r: Int, horiz: Boolean): FloatArray {
            val out = FloatArray(N); val n = if (horiz) W else H; val m = if (horiz) H else W; val st = if (horiz) 1 else W; val ln = if (horiz) W else 1
            for (j in 0 until m) {
                val o = j * ln; var acc = 0.0
                for (t in -r..r) acc += src[o + max(0, min(n - 1, t)) * st]
                for (i in 0 until n) { out[o + i * st] = (acc / (2 * r + 1)).toFloat(); acc += src[o + min(n - 1, i + r + 1) * st].toDouble() - src[o + max(0, i - r) * st].toDouble() }
            }
            return out
        }
        val sq = FloatArray(N) { (lum[it].toDouble() * lum[it]).toFloat() }
        fun sd(h: Boolean): FloatArray {
            val m = box(lum, 3, h); val m2 = box(sq, 3, h)
            return FloatArray(N) { kotlin.math.sqrt(max(0.0, m2[it] - m[it].toDouble() * m[it])).toFloat() }
        }
        val sh = sd(true); val sv = sd(false)
        // Flat light areas, split by the printed outlines: the largest one is the rules paper, the other sizeable ones are the
        // name and type plates. On the real card the plates are bare mirror silver (black out of the light), although a scan
        // shows them as pale as the paper, so they are told apart by shape, not by colour. Speckled areas (the fur) are neither.
        val flat = BooleanArray(N) { lum[it] > .5 && max(sh[it], sv[it]) < .05 }
        val lab = IntArray(N); val sizes = ArrayList<Int>().apply { add(0) }; val cys = ArrayList<Double>().apply { add(0.0) }; var n = 0
        val q = IntArray(N)
        for (s0 in 0 until N) {
            if (!flat[s0] || lab[s0] != 0) continue
            n++; var len = 0; q[len++] = s0; lab[s0] = n; var cy = 0.0; var h = 0
            while (h < len) {
                val i = q[h]; val x = i % W; cy += ((i - x) / W).toDouble()
                if (x > 0 && flat[i - 1] && lab[i - 1] == 0) { lab[i - 1] = n; q[len++] = i - 1 }
                if (x < W - 1 && flat[i + 1] && lab[i + 1] == 0) { lab[i + 1] = n; q[len++] = i + 1 }
                if (i >= W && flat[i - W] && lab[i - W] == 0) { lab[i - W] = n; q[len++] = i - W }
                if (i < N - W && flat[i + W] && lab[i + W] == 0) { lab[i + W] = n; q[len++] = i + W }
                h++
            }
            sizes.add(len); cys.add(cy / len / H)
        }
        // Printed text can cut the paper into strips, so every flat area that sits in the rules box part of the card is paper.
        var P = FloatArray(N); var plate = FloatArray(N)
        for (i in 0 until N) {
            val c = lab[i]; if (c == 0) continue
            if (cys[c] > .605) { if (sizes[c] > N * .001 && cys[c] < .9) P[i] = 1f } else if (sizes[c] > N * .002 && sizes[c] < N * .04) plate[i] = 1f
        }
        fun fill(m: FloatArray, r: Int): FloatArray { val b = box(box(m, r, true), r, false); for (i in 0 until N) b[i] = ss(.3, .5, b[i].toDouble()).toFloat(); return b }
        // the paper keeps its printed text: everything the paper's outline encloses is paper
        run {
            val out = BooleanArray(N); val st = IntArray(N); var sp = 0
            fun push(i: Int) { if (!out[i] && P[i] < .5f) { out[i] = true; st[sp++] = i } }
            for (x in 0 until W) { push(x); push(N - W + x) }
            for (y in 0 until H) { push(y * W); push(y * W + W - 1) }
            while (sp > 0) { val i = st[--sp]; val x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < N - W) push(i + W) }
            for (i in 0 until N) if (!out[i]) P[i] = 1f
        }
        // the paper keeps its printed text: a spot is paper when paper lies to its left and right, and above and below it
        run {
            val rf = BooleanArray(N); val cf = BooleanArray(N)
            val ra = IntArray(H) { -1 }; val rb = IntArray(H) { -1 }
            for (y in 0 until H) for (x in 0 until W) if (P[y * W + x] > .5f) { if (ra[y] < 0) ra[y] = x; rb[y] = x }
            for (y in 0 until H) {
                var a = if (ra[y] < 0) W else ra[y]; var b = rb[y]
                for (t in -14..14) { val yy = y + t; if (yy >= 0 && yy < H && ra[yy] >= 0) { a = min(a, ra[yy]); b = max(b, rb[yy]) } }
                for (x in a..b) rf[y * W + x] = true
            }
            val ca = IntArray(W) { -1 }; val cb = IntArray(W) { -1 }
            for (x in 0 until W) for (y in 0 until H) if (P[y * W + x] > .5f) { if (ca[x] < 0) ca[x] = y; cb[x] = y }
            for (x in 0 until W) {
                var a = if (ca[x] < 0) H else ca[x]; var b = cb[x]
                for (t in -14..14) { val xx = x + t; if (xx >= 0 && xx < W && ca[xx] >= 0) { a = min(a, ca[xx]); b = max(b, cb[xx]) } }
                for (y in a..b) cf[y * W + x] = true
            }
            for (i in 0 until N) if (rf[i] && cf[i]) P[i] = 1f
        }
        P = fill(P, 2); plate = fill(fill(plate, 6), 2)
        for (i in 0 until N) plate[i] = (plate[i] * (1.0 - P[i])).toFloat()
        var k = FloatArray(N) {
            (neu[it] * (1 - ss(.014, .034, min(sh[it], sv[it]).toDouble())) * ss(.1, .2, lum[it].toDouble()) * (1 - ss(.5, .9, P[it].toDouble()))).toFloat()
        }
        k = box(box(k, 1, true), 1, false)
        for (i in 0 until N) k[i] = max(ss(.35, .75, k[i].toDouble()).toFloat(), plate[i])
        return SilverInk(box(box(k, 1, true), 1, false), box(box(P, 1, true), 1, false))
    }

    /**
     * The picture window of a card with a printed gold frame (Smaug HOB 249): everything the gold frame does not cover, however
     * uneven the window is and wherever the picture spills over the frame. Gold is told by its colour after a small blur; the frame
     * is the gold that reaches the card's edge; the picture is what is left, without small specks. 0..1 per pixel.
     */
    fun artWindow(argb: IntArray, W: Int, H: Int): FloatArray {
        val N = W * H
        fun ch(shift: Int): FloatArray = boxBlurJs(FloatArray(N) { ((argb[it] shr shift and 255) / 255.0).toFloat() }, W, H, 2)
        val R = ch(16); val G = ch(8); val B = ch(0)
        var gold = FloatArray(N)
        for (i in 0 until N) {
            val r = R[i].toDouble(); val g = G[i].toDouble(); val b = B[i].toDouble()
            gold[i] = if (r > g && g > b && (r - b) > .22 * r && g > .7 * r && g < .97 * r && r > .3) 1f else 0f
        }
        gold = boxBlurJs(gold, W, H, 3)
        val fr = BooleanArray(N); val st = IntArray(N); var sp = 0
        fun push(i: Int) { if (!fr[i] && gold[i] > .45) { fr[i] = true; st[sp++] = i } }
        for (x in 0 until W) { push(x); push((H - 1) * W + x) }
        for (y in 0 until H) { push(y * W); push(y * W + W - 1) }
        while (sp > 0) { val i = st[--sp]; val x = i % W; val y = (i - x) / W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W) }
        // components of what is not frame: keep the big ones
        val lab = IntArray(N); val art = FloatArray(N); var n = 0; val q = IntArray(N)
        for (s0 in 0 until N) {
            if (fr[s0] || lab[s0] != 0) continue
            n++; var len = 0; q[len++] = s0; lab[s0] = n; var h = 0
            while (h < len) {
                val i = q[h++]; val x = i % W; val y = (i - x) / W
                if (x > 0 && !fr[i - 1] && lab[i - 1] == 0) { lab[i - 1] = n; q[len++] = i - 1 }
                if (x < W - 1 && !fr[i + 1] && lab[i + 1] == 0) { lab[i + 1] = n; q[len++] = i + 1 }
                if (y > 0 && !fr[i - W] && lab[i - W] == 0) { lab[i - W] = n; q[len++] = i - W }
                if (y < H - 1 && !fr[i + W] && lab[i + W] == 0) { lab[i + W] = n; q[len++] = i + W }
            }
            if (len > N * .03) for (j in 0 until len) art[q[j]] = 1f
        }
        return boxBlurJs(boxBlurJs(art, W, H, 2), W, H, 1)
    }

    /** This card's own picture and rules boxes (left, top, right, bottom on the card, 0..1). */
    class Boxes(val art: FloatArray, val text: FloatArray)

    /**
     * The picture and rules boxes of this very card: each side of the frame type's box ([art], [text]) moves to the printed frame
     * line nearest to it on the scan (showcase and special frames sit a little off the standard measure). A side with no clear line
     * nearby stays where it was. A box whose frame lines are not on this card (a full-art or sideways layout filed under a standard
     * frame, Fracture FDN 439 under 2015) is not used: art becomes [0, 0, 1, 1] and text [0, 0, 0, 0].
     */
    fun cardBoxes(argb: IntArray, W: Int, H: Int, art: FloatArray, text: FloatArray): Boxes {
        val lum = FloatArray(W * H) { val p = argb[it]; ((.2126 * (p shr 16 and 255) + .7152 * (p shr 8 and 255) + .0722 * (p and 255)) / 255).toFloat() }
        fun snap(b: DoubleArray, none: DoubleArray): DoubleArray {
            if (b[2] - b[0] <= 0) return b.copyOf()
            val o = b.copyOf(); var found = 0; var tried = 0
            for (e in 0 until 4) {
                val vert = e % 2 == 0; val n = if (vert) W else H; val pos = jsRound(b[e] * n)
                if (b[e] <= .005 || b[e] >= .995) continue
                tried++
                val lo0 = if (vert) b[1] * H else b[0] * W; val hi0 = if (vert) b[3] * H else b[2] * W
                val lo = jsRound(lo0 + (hi0 - lo0) * .1); val hi = jsRound(hi0 - (hi0 - lo0) * .1); val rng = jsRound(n * .03)
                var best = 0.0; var bp = pos
                for (p in max(2, pos - rng)..min(n - 3, pos + rng)) {
                    var acc = 0.0
                    for (t in lo until hi) acc += if (vert) lum[t * W + p + 1].toDouble() - lum[t * W + p - 1] else lum[(p + 1) * W + t].toDouble() - lum[(p - 1) * W + t]
                    val sc = abs(acc / (hi - lo)) * (1 - .5 * abs(p - pos) / rng)
                    if (sc > best) { best = sc; bp = p }
                }
                if (best > .05) { o[e] = bp.toDouble() / n; found++ }
            }
            if (tried >= 3 && found < 2) return none
            return o
        }
        fun f(d: DoubleArray) = FloatArray(4) { d[it].toFloat() }
        return Boxes(f(snap(dec(art), doubleArrayOf(0.0, 0.0, 1.0, 1.0))), f(snap(dec(text), doubleArrayOf(0.0, 0.0, 0.0, 0.0))))
    }

    /** One card's maps for its recipe: [maps] as [analyze] measures them, with the mask's channels the pattern needs replaced (see
     *  [cardMaps]); [boxes] this card's own picture and rules boxes; [star] the shooting star its scan carries ((x, y) or null). */
    class CardMaps(val maps: Maps, val boxes: Boxes, val star: FloatArray?) {
        val mask get() = maps.mask
        val relief get() = maps.relief
        val stroke get() = maps.stroke
        val art get() = boxes.art
        val text get() = boxes.text
    }

    /**
     * Everything one card needs for its recipe (the site's mtgCardMaps): the ink maps, this card's own picture and rules boxes, and
     * the shooting star its scan already carries. [argb] is the card at MAP_W x MAP_H, top row first; [frameArt] / [frameText] the
     * frame type's boxes; [emblem] the Jurassic World emblem's shape (RGBA, same size; its R is read) for pattern 29. By pattern the
     * mask's channels become: 23 silver scroll R silver ink, G neither ink nor paper, B rules paper; 28 gleaming G the picture window,
     * B 0; 29 R the emblem; 21 facet R the shard's seed, G its depth, B the cut edge (from [facets], the same cut the site ports).
     */
    fun cardMaps(argb: IntArray, W: Int, H: Int, pat: Int, frameArt: FloatArray, frameText: FloatArray, emblem: ByteArray? = null): CardMaps {
        val N = W * H
        val m = analyze(argb, W, H)
        val mask = m.mask
        if (pat == 23) {
            val k = silverInk(argb, W, H)
            for (i in 0 until N) {
                mask[i * 4] = jsRound(k.ink[i] * 255.0).toByte(); mask[i * 4 + 2] = jsRound(k.paper[i] * 255.0).toByte()
                mask[i * 4 + 1] = jsRound((1.0 - k.paper[i]) * (1.0 - k.ink[i]) * 255).toByte()
            }
        }
        if (pat == 28) { val a = artWindow(argb, W, H); for (i in 0 until N) { mask[i * 4 + 1] = jsRound(a[i] * 255.0).toByte(); mask[i * 4 + 2] = 0 } }
        if (pat == 29 && emblem != null) for (i in 0 until N) mask[i * 4] = emblem[i * 4]
        if (pat == FACET.toInt()) {
            // The shards cut with the frame's text box (seeds hashed as the site does): facet R the seed, B the depth, and the cut edge.
            // The relief carries the edge in B too, as analyze(facetText) lays it.
            val f = facets(argb, W, H, frameText, siteSeed = true)
            for (i in 0 until N) { val e = q(f.edge[i]); mask[i * 4] = f.facet[i * 4]; mask[i * 4 + 1] = f.facet[i * 4 + 2]; mask[i * 4 + 2] = e; m.relief[i * 4 + 2] = e }
            return CardMaps(Maps(W, H, mask, m.relief, m.stroke, f.facet), cardBoxes(argb, W, H, frameArt, frameText), findScanStar(argb, W, H, frameText))
        }
        return CardMaps(m, cardBoxes(argb, W, H, frameArt, frameText), findScanStar(argb, W, H, frameText))
    }

    /** [hash] as the site's mtgFacets computes it: in double. Float and double part ways after the fractions, so the two give a
     *  piece different (equally spread) seeds; [cardMaps] uses this one so a shard tilts as it does on the site. */
    private fun hashJs(x: Double, y: Double): Double {
        fun fr(v: Double) = v - kotlin.math.floor(v)
        var px = fr(x * 234.34); var py = fr(y * 435.345)
        val d = px * (px + 34.23) + py * (py + 34.23); px += d; py += d
        return fr(px * py)
    }

    /** The shader's hash() (Foil.AGSL), so a shard's seed is spread like the prototype's hashed facet ids. */
    private fun hash(x: Float, y: Float): Float {
        fun fr(v: Float) = v - kotlin.math.floor(v)
        var px = fr(x * 234.34f); var py = fr(y * 435.345f)
        val d = px * (px + 34.23f) + py * (py + 34.23f); px += d; py += d
        return fr(px * py)
    }
}
