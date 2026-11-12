package dev.cardstashy.nativeplay.foil

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/*
 * Yu-Gi-Oh! foil, ported from the site (ygo-foil-recipes.js, ygo-foil-analysis.js, ygo-rarity-foil.js, ygo-name-foil.js)
 * and drawn by one AGSL shader on the card's own plane (CardFace), so it is glued to the card at any size.
 *
 * Every rarity is a recipe: where the foil goes (whole card, frame or border band, art), which pattern and tint, and the
 * metal of the hot-stamped name. The art and its letters are measured from the card picture once (off the main thread):
 * where Konami left the white underbase out (foil shows through), coloured glows, the level stars and attribute orb, the
 * stroke direction of the drawing, and the name's letters. The shader then lights foil under the ink, a grating that only
 * throws colour toward you at the right angle, and the name letters as recessed metal.
 */
object YgoFoil {
    // Patterns and tints, same numbers as the site so recipes stay one table.
    const val LINES = 1f; const val DIAG = 2f; const val PRISM = 3f; const val GLITTER = 4f; const val GHOST = 5f; const val EMBOSS = 6f
    const val STROKE = 7f; const val MOSAIC = 8f; const val SHATTER = 9f; const val STARS = 10f; const val PARALLEL = 11f; const val QCR = 12f
    const val HIEROGLYPH = 13f; const val DOTS = 14f
    const val RAINBOW = 0f; const val GOLD = 1f; const val SILVER = 2f; const val PLATINUM = 3f

    /** [pattern, tint, third] for one layer: whole = rules-box share, frame = 1 frame / 2 border band, art = 1 underbase gaps / 2 whole art. */
    class Layer(val pattern: Float, val tint: Float, val third: Float) { val v get() = floatArrayOf(pattern, tint, third) }
    enum class Name(val code: Float) { NONE(0f), SILVER(1f), GOLD(2f), RAINBOW(3f), PLATINUM(4f) }
    data class Recipe(val label: String, val whole: Layer? = null, val frame: Layer? = null, val art: Layer? = null, val name: Name = Name.NONE, val stars: Boolean = false)

    private fun l(p: Float, t: Float, x: Float) = Layer(p, t, x)
    private fun parallel(r: Recipe) = r.copy(whole = l(PARALLEL, RAINBOW, .5f))

    val RECIPES: Map<String, Recipe> = buildMap {
        put("ygo-rare", Recipe("Rare", name = Name.SILVER))
        put("ygo-super", Recipe("Super Rare", art = l(LINES, RAINBOW, 1f)))
        put("ygo-ultra", Recipe("Ultra Rare", art = l(LINES, RAINBOW, 1f), name = Name.GOLD))
        put("ygo-secret", Recipe("Secret Rare", art = l(DIAG, RAINBOW, 1f), name = Name.RAINBOW))
        put("ygo-ultra-secret", Recipe("Ultra Secret Rare", art = l(DIAG, RAINBOW, 1f), name = Name.GOLD))
        put("ygo-prismatic", Recipe("Prismatic Secret Rare", art = l(PRISM, RAINBOW, 1f), name = Name.RAINBOW))
        put("ygo-quarter-century", Recipe("Quarter Century Secret Rare", art = l(QCR, PLATINUM, 1f), name = Name.PLATINUM))
        put("ygo-starlight", Recipe("Starlight Rare", whole = l(GLITTER, RAINBOW, .45f), art = l(GLITTER, RAINBOW, 1f), name = Name.RAINBOW, stars = true)) // rainbow name: round 2
        put("ygo-ghost", Recipe("Ghost Rare", art = l(GHOST, SILVER, 2f), name = Name.SILVER))
        put("ygo-ghost-gold", Recipe("Ghost/Gold Rare", art = l(GHOST, SILVER, 2f), frame = l(LINES, GOLD, 2f), name = Name.GOLD))
        put("ygo-ultimate", Recipe("Ultimate Rare", art = l(EMBOSS, GOLD, 2f), frame = l(EMBOSS, GOLD, 1f), name = Name.GOLD, stars = true))
        put("ygo-ultimate-classic", Recipe("Ultimate Rare", art = l(EMBOSS, GOLD, 2f), frame = l(EMBOSS, GOLD, 2f), name = Name.GOLD, stars = true))
        put("ygo-ultimate-prismatic", Recipe("Ultimate Rare", art = l(EMBOSS, GOLD, 2f), frame = l(GLITTER, RAINBOW, 2f), name = Name.GOLD, stars = true))
        put("ygo-pharaoh", Recipe("Ultra Rare (Pharaoh's Rare)", art = l(LINES, RAINBOW, 1f), frame = l(HIEROGLYPH, GOLD, 1f), name = Name.GOLD))
        put("ygo-collector", Recipe("Collector's Rare", art = l(STROKE, RAINBOW, 1f), frame = l(GLITTER, RAINBOW, 2f), name = Name.RAINBOW))
        put("ygo-gold", Recipe("Gold Rare", art = l(LINES, RAINBOW, 1f), frame = l(LINES, GOLD, 2f), name = Name.GOLD))
        put("ygo-gold-secret", Recipe("Gold Secret Rare", art = l(DIAG, RAINBOW, 1f), frame = l(LINES, GOLD, 2f), name = Name.GOLD))
        put("ygo-premium-gold", Recipe("Premium Gold Rare", frame = l(GLITTER, GOLD, 1f), name = Name.GOLD))
        put("ygo-platinum", Recipe("Platinum Rare", art = l(LINES, PLATINUM, 1f), frame = l(LINES, PLATINUM, 2f), name = Name.PLATINUM))
        put("ygo-platinum-secret", Recipe("Platinum Secret Rare", whole = l(DIAG, PLATINUM, .5f), name = Name.PLATINUM))
        put("ygo-mosaic", Recipe("Mosaic Rare", art = l(MOSAIC, RAINBOW, 1f), name = Name.GOLD))
        put("ygo-shatterfoil", Recipe("Shatterfoil Rare", whole = l(SHATTER, RAINBOW, .5f), name = Name.SILVER))
        put("ygo-starfoil", Recipe("Starfoil Rare", whole = l(STARS, RAINBOW, .5f), name = Name.SILVER))
        put("ygo-parallel", parallel(Recipe("Normal Parallel Rare")))
        put("ygo-rare-parallel", parallel(Recipe("Rare Parallel Rare", name = Name.SILVER)))
        put("ygo-super-parallel", parallel(Recipe("Super Parallel Rare", art = l(LINES, RAINBOW, 1f))))
        put("ygo-ultra-parallel", parallel(Recipe("Ultra Parallel Rare", art = l(LINES, RAINBOW, 1f), name = Name.GOLD)))
        // Duel Terminal parallels by series: DT01-DT04 a square dot matrix, DT05-DT07 shattered ice.
        for (k in listOf("ygo-parallel", "ygo-rare-parallel", "ygo-super-parallel", "ygo-ultra-parallel")) {
            put("$k-dots", get(k)!!.copy(whole = l(DOTS, RAINBOW, .5f))); put("$k-shatter", get(k)!!.copy(whole = l(SHATTER, RAINBOW, .5f)))
        }
    }

    /** Every foil rarity string in the catalogue, normalised (lowercase, letters and digits only). */
    private val RARITY = mapOf(
        "rare" to "ygo-rare", "superrare" to "ygo-super", "ultrarare" to "ygo-ultra", "ultrararepharaohsrare" to "ygo-pharaoh",
        "secretrare" to "ygo-secret", "extrasecretrare" to "ygo-secret", "extrasecret" to "ygo-secret", "10000secretrare" to "ygo-secret", "ultrasecretrare" to "ygo-ultra-secret",
        "prismaticsecretrare" to "ygo-prismatic", "quartercenturysecretrare" to "ygo-quarter-century", "starlightrare" to "ygo-starlight",
        "ghostrare" to "ygo-ghost", "ghostgoldrare" to "ygo-ghost-gold", "ultimaterare" to "ygo-ultimate", "collectorsrare" to "ygo-collector",
        "goldrare" to "ygo-gold", "goldsecretrare" to "ygo-gold-secret", "premiumgoldrare" to "ygo-premium-gold",
        "platinumrare" to "ygo-platinum", "platinumsecretrare" to "ygo-platinum-secret", "mosaicrare" to "ygo-mosaic", "shatterfoilrare" to "ygo-shatterfoil",
        "starfoilrare" to "ygo-starfoil", "starfoil" to "ygo-starfoil",
        "normalparallelrare" to "ygo-parallel", "duelterminalnormalparallelrare" to "ygo-parallel",
        "duelterminalrareparallelrare" to "ygo-rare-parallel", "duelterminalnormalrareparallelrare" to "ygo-rare-parallel",
        "superparallelrare" to "ygo-super-parallel", "duelterminalsuperparallelrare" to "ygo-super-parallel",
        "ultraparallelrare" to "ygo-ultra-parallel", "duelterminalultraparallelrare" to "ygo-ultra-parallel",
    )
    fun effectFor(rarity: String): String = RARITY[rarity.lowercase().filter { it.isLetterOrDigit() }] ?: ""

    /** Modern foil layout (Attribute and Level stars foiled; Gen 2 Ultimate) starts with Breakers of Shadow. */
    const val MODERN_FROM = "2016-02-04"
    /** The printing's own set picks the generation of a rarity (ygoSetEffect). [code] like OP16 or DT05, [date] yyyy-mm-dd. */
    fun setEffect(effect: String, code: String = "", date: String = ""): String {
        val c = code.uppercase()
        if (effect == "ygo-ultimate") return when {
            Regex("^(?:OP(?:1[6-9]|2\\d|30)|RA0[1-5])$").matches(c) -> "ygo-ultimate-prismatic"
            date.isNotEmpty() && date < MODERN_FROM -> "ygo-ultimate-classic"
            else -> effect
        }
        val dt = Regex("^DT0([1-7])$").find(c)
        if (dt != null && effect.endsWith("parallel")) return "$effect-${if (dt.groupValues[1].toInt() <= 4) "dots" else "shatter"}"
        return effect
    }

    /** Level/Rank stars and the Attribute: 1 embossed (Ultimate, Starlight), 2 holo (Super/Ultra from Breakers of Shadow), 3 rainbow
     *  (modern Secret), 4 gold (Gold). Older printings or an unknown date keep plain stars (finish-effects.js starFoil). */
    fun starFoil(rarity: String, date: String): Float {
        val r = rarity.lowercase().filter { it.isLetterOrDigit() }; val modern = date.isNotEmpty() && date >= MODERN_FROM
        return when {
            Regex("^(ultimaterare|starlightrare)$").matches(r) -> 1f
            Regex("^(superrare|ultrarare|ultrararepharaohsrare)$").matches(r) -> if (modern) 2f else 0f
            r.contains("secret") && !Regex("gold|platinum|quartercentury").containsMatchIn(r) -> if (modern) 3f else 0f
            r.contains("gold") -> 4f
            else -> 0f
        }
    }
    /** Pendulum and Skill cards have their own measured art windows; everything else is standard. */
    fun layoutOf(frameText: String): Layout = when {
        Regex("pendulum", RegexOption.IGNORE_CASE).containsMatchIn(frameText) -> Layout.PENDULUM
        Regex("skill", RegexOption.IGNORE_CASE).containsMatchIn(frameText) -> Layout.SKILL
        else -> Layout.STANDARD
    }

    // Card-space boxes [x0, y0, x1, y1], measured on 813x1185 renders.
    enum class Layout(val art: FloatArray, val text: FloatArray) {
        STANDARD(floatArrayOf(.1205f, .1845f, .8795f, .7035f), floatArrayOf(.075f, .735f, .925f, .955f)),
        PENDULUM(floatArrayOf(.066f, .183f, .934f, .609f), floatArrayOf(.062f, .613f, .938f, .955f)),
        SKILL(floatArrayOf(.118f, .174f, .882f, .662f), floatArrayOf(.075f, .67f, .925f, .955f)),
    }
    /** The name bar: clears descenders, stops before the Attribute orb. */
    val NAME_BOX = floatArrayOf(.072f, .050f, .828f, .108f)

    // ------------------------------------------------------------------------------------------------ measuring the card

    private fun ss(a: Float, b: Float, x: Float): Float { val t = ((x - a) / (b - a)).coerceIn(0f, 1f); return t * t * (3 - 2 * t) }

    fun boxBlur(src: FloatArray, w: Int, h: Int, r: Int, passes: Int = 2): FloatArray {
        var a = src.copyOf(); var b = FloatArray(a.size)
        repeat(passes) {
            for (horiz in booleanArrayOf(true, false)) {
                val n = if (horiz) w else h; val m = if (horiz) h else w
                for (o in 0 until m) {
                    fun at(i: Int): Int { val c = i.coerceIn(0, n - 1); return if (horiz) o * w + c else c * w + o }
                    var s = 0f
                    for (i in -r..r) s += a[at(i)]
                    for (i in 0 until n) { b[at(i)] = s / (2 * r + 1); s += a[at(i + r + 1)] - a[at(i - r)] }
                }
                val t = a; a = b; b = t
            }
        }
        return a
    }

    /** Measured maps the size of the card picture, RGBA bytes. mask: R foil-through, G coloured energy, B stars (1) / orb (.6) above the art and stroke strength inside it.
     *  relief: R smoothed brightness, G/B stroke direction (cos 2θ, sin 2θ). glyph: name letters, one byte per pixel of the name box. */
    class Maps(val w: Int, val h: Int, val mask: ByteArray, val relief: ByteArray, val glyphW: Int, val glyphH: Int, val glyph: ByteArray, val spellTrap: Boolean)

    /** [argb] is the card picture (Android ARGB ints), [layout] its frame. Pure and deterministic; run it off the main thread. */
    fun analyze(argb: IntArray, W: Int, H: Int, layout: Layout = Layout.STANDARD): Maps = analyze(argb, W, H, layout.art, layout == Layout.STANDARD, true)

    /** The same measuring over any art window [box] (Pokémon holo windows use it, as the site does): [spellTrapRule] is the
     *  Yu-Gi-Oh! standard-frame Spell/Trap check, [names] measures the name-bar letters. */
    fun analyze(argb: IntArray, W: Int, H: Int, box: FloatArray, spellTrapRule: Boolean, names: Boolean): Maps {
        val N = W * H
        val r = FloatArray(N); val g = FloatArray(N); val b = FloatArray(N); val lum = FloatArray(N)
        for (i in 0 until N) { val c = argb[i]; r[i] = (c shr 16 and 255) / 255f; g[i] = (c shr 8 and 255) / 255f; b[i] = (c and 255) / 255f; lum[i] = .2126f * r[i] + .7152f * g[i] + .0722f * b[i] }
        val ax0 = (box[0] * W).roundToInt() + 1; val ay0 = (box[1] * H).roundToInt() + 1; val ax1 = (box[2] * W).roundToInt() - 1; val ay1 = (box[3] * H).roundToInt() - 1
        val aw = ax1 - ax0; val ah = ay1 - ay0; val AN = aw * ah
        fun at(i: Int, j: Int) = (ay0 + j) * W + ax0 + i
        val mask = ByteArray(N * 4); val relief = ByteArray(N * 4)
        val (glyph, gw, gh) = if (names) glyphs(r, g, b, W, H) else Triple(ByteArray(0), 0, 0)
        if (aw < 16 || ah < 16) return Maps(W, H, mask, relief, gw, gh, glyph, false)
        // Colour outlines inside the art.
        val edge0 = FloatArray(AN)
        for (j in 1 until ah - 1) for (i in 1 until aw - 1) {
            var s = 0f
            for (c in arrayOf(r, g, b)) { val dx = c[at(i + 1, j)] - c[at(i - 1, j)]; val dy = c[at(i, j + 1)] - c[at(i, j - 1)]; s += dx * dx + dy * dy }
            edge0[j * aw + i] = sqrt(s)
        }
        val edge = boxBlur(edge0, aw, ah, 1)
        // Background palette from the art's border band (k-means, 6 colours).
        val band = max(2, (aw / 40f).roundToInt())
        fun inBand(i: Int, j: Int) = i < band || j < band || i >= aw - band || j >= ah - band
        val samples = ArrayList<FloatArray>()
        for (j in 0 until ah step 2) for (i in 0 until aw step 2) if (inBand(i, j)) { val k = at(i, j); samples.add(floatArrayOf(r[k], g[k], b[k])) }
        var C = List(6) { k -> samples[((k + .5) * samples.size / 6).toInt()].copyOf() }
        for (it in 0 until 8) {
            val sum = C.map { DoubleArray(4) }
            for (s in samples) {
                var best = 0; var bd = 9f
                C.forEachIndexed { k, c -> val d = sq(s[0] - c[0]) + sq(s[1] - c[1]) + sq(s[2] - c[2]); if (d < bd) { bd = d; best = k } }
                val q = sum[best]; q[0] += s[0].toDouble(); q[1] += s[1].toDouble(); q[2] += s[2].toDouble(); q[3]++
            }
            C = C.mapIndexed { k, c -> if (sum[k][3] > 0) floatArrayOf((sum[k][0] / sum[k][3]).toFloat(), (sum[k][1] / sum[k][3]).toFloat(), (sum[k][2] / sum[k][3]).toFloat()) else c }
            if (it == 7) C = C.filterIndexed { k, _ -> sum[k][3] >= samples.size * .1 }
        }
        // Only dominant border colours count as background (a cropped monster touches the border but covers a minority of it).
        val bgd = FloatArray(AN)
        for (j in 0 until ah) for (i in 0 until aw) { val k = at(i, j); var bd = 9f; for (c in C) bd = min(bd, sq(r[k] - c[0]) + sq(g[k] - c[1]) + sq(b[k] - c[2])); bgd[j * aw + i] = sqrt(bd) }
        // Barrier height per pixel: an outline or an off-palette colour.
        val cost = boxBlur(edge, aw, ah, 1, 1); val Q = IntArray(AN)
        for (i in 0 until AN) Q[i] = min(255, ((cost[i] + bgd[i] * .6f) * 255).roundToInt())
        // Bucket-queue minimax fill: the lowest barrier crossed to reach a pixel from the seeds.
        fun fill(seed: (Int, Int, Int) -> Boolean): IntArray {
            val D = IntArray(AN) { 255 }; val buckets = Array(256) { IntList() }
            for (k in 0 until AN) { val i = k % aw; if (seed(i, k / aw, k)) { D[k] = 0; buckets[0].add(k) } }
            val di = intArrayOf(1, -1, 0, 0); val dj = intArrayOf(0, 0, 1, -1)
            for (lvl in 0 until 256) {
                val q = buckets[lvl]; var n = 0
                while (n < q.size) {
                    val k = q[n++]; if (D[k] != lvl) continue
                    val i = k % aw; val j = k / aw
                    for (d in 0 until 4) {
                        val ii = i + di[d]; val jj = j + dj[d]; if (ii < 0 || jj < 0 || ii >= aw || jj >= ah) continue
                        val kk = jj * aw + ii; val nd = max(lvl, Q[kk]); if (nd < D[kk]) { D[kk] = nd; buckets[nd].add(kk) }
                    }
                }
            }
            return D
        }
        val D = fill { i, j, k -> inBand(i, j) && bgd[k] <= .12f }
        // A second fill grows from the centre; each pixel goes to the side reaching it over lower barriers.
        var core: (Int, Int, Int) -> Boolean = { i, j, k -> abs(i.toFloat() / aw - .5f) < .17f && abs(j.toFloat() / ah - .5f) < .2f && bgd[k] > .12f }
        var coreN = 0; for (k in 0 until AN) { val i = k % aw; if (core(i, k / aw, k)) coreN++ }
        if (coreN < 50) core = { i, j, _ -> abs(i.toFloat() / aw - .5f) < .1f && abs(j.toFloat() / ah - .5f) < .1f }
        val F = fill(core)
        // Otsu split of barrier heights: each card gets its own background/subject threshold.
        val hist = DoubleArray(256); var tot = 0.0; var sumAll = 0.0
        for (i in 0 until AN) hist[D[i]]++
        for (i in 0 until 256) { tot += hist[i]; sumAll += i * hist[i] }
        var w0 = 0.0; var s0 = 0.0; var best = 0.0; var T = 64
        for (t in 0 until 256) {
            w0 += hist[t]; s0 += t * hist[t]; if (w0 == 0.0 || w0 == tot) continue
            val m0 = s0 / w0; val m1 = (sumAll - s0) / (tot - w0); val sb = w0 * (tot - w0) * (m0 - m1) * (m0 - m1)
            if (sb > best) { best = sb; T = t }
        }
        val blurL = boxBlur(lum, W, H, max(1, (W / 100f).roundToInt())); val pass = FloatArray(N); val energy = FloatArray(N)
        for (j in 0 until ah) for (i in 0 until aw) {
            val a = j * aw + i; val k = at(i, j); val mx = max(r[k], max(g[k], b[k])); val mn = min(r[k], min(g[k], b[k])); val sat = (mx - mn) / (mx + 1e-4f)
            val bg = (1 - ss(T * .7f, T * 1.3f, D[a].toFloat())) * ss(-10f, 15f, (F[a] - D[a]).toFloat())
            // Coloured glows pass anywhere; white only where it belongs to the background; dark ink blocks the foil.
            var en = ss(.55f, .8f, mx) * ss(.45f, .75f, sat) * ss(.04f, .14f, max(0f, lum[k] - blurL[k]) + .05f); en = max(en, ss(.7f, .92f, lum[k]) * bg)
            pass[k] = max(bg, en) * (1 - (1 - ss(.06f, .2f, lum[k])) * .85f); energy[k] = en
        }
        // Spells (teal) and Traps (magenta) have no monster: the whole illustration is effect art. Standard layout only.
        var fr = 0f; var fg = 0f; var fb = 0f; var fn = 0
        for (j in (.3f * H).roundToInt() until (.7f * H).roundToInt() step 2) for (i in (.03f * W).roundToInt() until (.06f * W).roundToInt()) { val k = j * W + i; fr += r[k]; fg += g[k]; fb += b[k]; fn++ }
        fr /= fn; fg /= fn; fb /= fn
        val spellTrap = spellTrapRule && ((fg > fr + .3f && fb > fr + .25f) || (fr > fg + .25f && fr > fb + .08f))
        if (spellTrap) for (j in 0 until ah) for (i in 0 until aw) { val k = at(i, j); pass[k] = max(pass[k], .55f * (1 - (1 - ss(.06f, .2f, lum[k])) * .85f)) }
        val passS = boxBlur(pass, W, H, 1, 1)
        // Level stars and the attribute orb.
        val stars = FloatArray(N)
        for (j in (.112f * H).roundToInt() until (.17f * H).roundToInt()) for (i in (.08f * W).roundToInt() until (.92f * W).roundToInt()) {
            val k = j * W + i; val mx = max(r[k], max(g[k], b[k])); val mn = min(r[k], min(g[k], b[k]))
            if (r[k] > .84f && b[k] < .45f * r[k] && mx - mn > .35f) stars[k] = 1f
        }
        val ocx = .874f * W; val ocy = .081f * H; val orr = .042f * W
        run {
            var j = max(0, (ocy - orr).roundToInt())
            while (j < ocy + orr) { var i = max(0, (ocx - orr).roundToInt()); while (i < min(W.toFloat(), ocx + orr)) { if (sq(i - ocx) + sq(j - ocy) < orr * orr) stars[j * W + i] = max(stars[j * W + i], .6f); i++ }; j++ }
        }
        val height = boxBlur(lum, W, H, 1, 1)
        // Each star is its own round orb: fit its circle, fill it whole and dome it so its highlight circles its own centre.
        fun dome(cx: Float, cy: Float, R: Float, weight: Float) {
            for (j in max(0, kotlin.math.floor(cy - R - 1).toInt())..min(H - 1, kotlin.math.ceil(cy + R + 1).toInt()))
                for (i in max(0, kotlin.math.floor(cx - R - 1).toInt())..min(W - 1, kotlin.math.ceil(cx + R + 1).toInt())) {
                    val d = hypot(i + .5f - cx, j + .5f - cy) / R; if (d > 1) continue
                    val k = j * W + i; val e = 1 - ss(.86f, 1f, d)
                    stars[k] = max(stars[k], weight * e); height[k] = max(height[k], .35f + .6f * sqrt(1 - d * d)) * e + height[k] * (1 - e)
                }
        }
        run {
            val y0 = (.105f * H).roundToInt(); val y1 = (.178f * H).roundToInt(); val x0 = (.06f * W).roundToInt(); val x1 = (.94f * W).roundToInt()
            val seen = BooleanArray(N); val minR = .011f * W; val maxR = .04f * W
            for (j in y0 until y1) for (i in x0 until x1) {
                val k0 = j * W + i; if (stars[k0] < 1 || seen[k0]) continue
                var n = 0; var ax = W; var ay = H; var bx = 0; var by = 0
                val q = IntList(); q.add(k0); seen[k0] = true
                while (q.size > 0) {
                    val k = q.pop(); val x = k % W; val y = k / W; n++
                    ax = min(ax, x); ay = min(ay, y); bx = max(bx, x); by = max(by, y)
                    for (dy in -2..2) for (dx in -2..2) {
                        val nx = x + dx; val ny = y + dy; if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue
                        val kk = ny * W + nx; if (!seen[kk] && stars[kk] >= 1) { seen[kk] = true; q.add(kk) }
                    }
                }
                val R = ((bx - ax) + (by - ay) + 2) / 4f; val round = abs((bx - ax) - (by - ay)) <= max(2f, R * .35f)
                if (R >= minR && R <= maxR && round) dome((ax + bx + 1) / 2f, (ay + by + 1) / 2f, R * 1.04f, 1f)
            }
        }
        dome(ocx, ocy, orr, .6f)
        // Stroke direction (structure tensor): Collector's grooves follow the drawing's own lines.
        val Jxx = FloatArray(N); val Jyy = FloatArray(N); val Jxy = FloatArray(N)
        for (j in 1 until H - 1) for (i in 1 until W - 1) { val k = j * W + i; val dx = lum[k + 1] - lum[k - 1]; val dy = lum[k + W] - lum[k - W]; Jxx[k] = dx * dx; Jyy[k] = dy * dy; Jxy[k] = dx * dy }
        val rad = max(1, (W / 130f).roundToInt())
        val Sxx = boxBlur(Jxx, W, H, rad); val Syy = boxBlur(Jyy, W, H, rad); val Sxy = boxBlur(Jxy, W, H, rad)
        // Maps stay opaque: Android stores bitmaps premultiplied, so a data channel in alpha would scale the others. The site's
        // seventh channel (stroke strength) shares mask B with the stars: stars only matter above the art, strokes only inside it.
        for (j in 0 until H) for (i in 0 until W) {
            val k = j * W + i; val inArt = i >= ax0 && i < ax1 && j >= ay0 && j < ay1
            val a = Sxx[k] - Syy[k]; val c = 2 * Sxy[k]; val m = hypot(a, c); val coh = m / (Sxx[k] + Syy[k] + 1e-6f)
            mask[k * 4] = byte(min(1f, passS[k])); mask[k * 4 + 1] = byte(energy[k])
            mask[k * 4 + 2] = byte(if (inArt) ss(.15f, .7f, coh) * min(1f, m * 400) else stars[k]); mask[k * 4 + 3] = -1
            relief[k * 4] = byte(height[k]); relief[k * 4 + 1] = byte(a / (m + 1e-9f) * .5f + .5f); relief[k * 4 + 2] = byte(c / (m + 1e-9f) * .5f + .5f); relief[k * 4 + 3] = -1
        }
        return Maps(W, H, mask, relief, gw, gh, glyph, spellTrap)
    }

    /** The name's letters (ygo-name-foil.js glyphCoverage): flat black or white ink unlike the bar's median and nearly colourless,
     *  so gold, teal, magenta and dark Xyz bars all work. One byte per pixel of the name box. */
    private fun glyphs(r: FloatArray, g: FloatArray, b: FloatArray, W: Int, H: Int): Triple<ByteArray, Int, Int> {
        val x0 = (NAME_BOX[0] * W).roundToInt(); val y0 = (NAME_BOX[1] * H).roundToInt()
        val w = (NAME_BOX[2] * W).roundToInt() - x0; val h = (NAME_BOX[3] * H).roundToInt() - y0
        if (w < 24 || h < 6) return Triple(ByteArray(0), 0, 0)
        val n = w * h; val lum = FloatArray(n); val sat = FloatArray(n)
        for (j in 0 until h) for (i in 0 until w) {
            val k = (y0 + j) * W + x0 + i; val q = j * w + i
            lum[q] = .2126f * r[k] + .7152f * g[k] + .0722f * b[k]; sat[q] = max(r[k], max(g[k], b[k])) - min(r[k], min(g[k], b[k]))
        }
        val med = lum.sortedArray()[n shr 1]; val raw = FloatArray(n); val out = ByteArray(n)
        for (i in 0 until n) raw[i] = ss(.20f, .34f, abs(lum[i] - med)) * (1 - ss(.18f, .32f, sat[i]))
        for (j in 1 until h - 1) for (i in 1 until w - 1) {
            var s = 0f
            for (bb in -1..1) for (a in -1..1) s += raw[(j + bb) * w + i + a] * (if (a != 0 || bb != 0) 1 else 4)
            out[j * w + i] = byte(min(1f, s / 12))
        }
        return Triple(out, w, h)
    }

    private fun sq(x: Float) = x * x
    private fun byte(v: Float): Byte = (v * 255).roundToInt().coerceIn(0, 255).toByte()

    /** A growable int list (no boxing) for the fills. */
    private class IntList { var a = IntArray(64); var size = 0
        fun add(v: Int) { if (size == a.size) a = a.copyOf(size * 2); a[size++] = v }
        operator fun get(i: Int) = a[i]
        fun pop(): Int = a[--size]
    }

    // ------------------------------------------------------------------------------------------------ the shader

    /**
     * YGO_RARITY_FRAGMENT and YGO_NAME_FRAGMENT in one AGSL pass. Card space is the layer: uv = p / u_size, so the plane is
     * the card (CardFace). Maps are sampled at uv * their own size. pow(x, 2.) is written sq(x) (AGSL leaves pow undefined
     * for negative bases). The name foil reads its letter mask from u_glyph inside the name box only.
     */
    const val AGSL = """
uniform shader u_card;uniform shader u_mask;uniform shader u_relief;uniform shader u_glyph;
uniform float2 u_size;uniform float2 u_px;uniform float2 u_map;uniform float2 u_gmap;uniform float2 u_tilt;uniform float u_aspect;
uniform float4 u_art;uniform float4 u_name;uniform float4 u_text;
uniform float3 u_whole;uniform float3 u_frame;uniform float3 u_artL;uniform float u_stars;uniform float u_metal;uniform float u_maps;
const float PI=3.14159265;
float sq(float x){return x*x;}
float3 toLin(float3 c){return mix(c/12.92,pow((c+.055)/1.055,float3(2.4)),step(float3(.04045),c));}
float3 toSrgb(float3 c){return mix(c*12.92,1.055*pow(max(c,float3(0.)),float3(1./2.4))-.055,step(float3(.0031308),c));}
float hash(float2 p){p=fract(p*float2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float2 hash2(float2 p){return float2(hash(p),hash(p+17.31));}
float vnoise(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+float2(1.,0.)),f.x),mix(hash(i+float2(0.,1.)),hash(i+float2(1.,1.)),f.x),f.y);}
float inBox(float2 p,float4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
float3 spectrum(float l){float3 c=float3(exp(-sq((l-600.)/70.))+.35*exp(-sq((l-440.)/30.)),exp(-sq((l-540.)/60.)),exp(-sq((l-455.)/40.)));return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
float3 grating(float3 L,float3 V,float2 g,float d){float s=abs(dot(L.xy+V.xy,g));float3 c=float3(0.);for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);return c;}
float3 shoulder(float3 x){float3 e=max(x-.82,0.);return min(x,.82)+.18*e/(e+.18);}
float3 voro(float2 q){float2 n=floor(q),f=fract(q);float d1=8.,d2=8.;float2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float2 o=float2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return float3(id,sqrt(d2)-sqrt(d1));}
// Distance to the nearest flake centre, for the soft glow around a lit flake.
float seedDist(float2 q){float2 n=floor(q),f=fract(q);float d1=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float2 o=float2(float(x),float(y));float2 r=o+hash2(n+o)-f;d1=min(d1,dot(r,r));}return sqrt(d1);}
// Real glitter twinkles as the card moves: each flake's phase turns with the tilt, so a still card is still and a moving one sparkles.
float twinkle(float2 id){return .3+.7*sq(.5+.5*sin(dot(u_tilt,float2(9.,7.))+hash(id)*6.2832));}
float4 mapAt(float2 uv){return u_maps>.5?u_mask.eval(uv*u_map):float4(.35,0.,0.,1.);}
float4 relAt(float2 uv){return u_maps>.5?u_relief.eval(uv*u_map):float4(.5,.5,.5,0.);}
float3 foil(float pat,float tint,float2 uv,float3 L,float3 V,float3 H,float spot,float energy,float2 stroke){
 float2 px=uv*u_px,q=float2(uv.x,uv.y*u_aspect);float2 g=float2(1.,0.);float d=1400.,lines=0.,glint=0.,mirror=.5,ex=40.,seam=1.;
 // Pattern cells keep the full-size card's screen density (572 px wide), so a grid tile shows fewer, larger flakes, never sub-pixel static.
 float fine=max(30.,min(210.,u_px.x/2.7)),prism=max(12.,min(72.,u_px.x/7.9)),dots=max(10.,min(64.,u_px.x/8.9)),flake=max(16.,min(110.,u_px.x/5.2));
 if(pat<1.5){d=1350.;lines=.5+.5*sin(px.x*2.0944);mirror=.7;ex=14.;}
 else if(pat<2.5){float2 r=float2(uv.x+uv.y*u_aspect,uv.x-uv.y*u_aspect);float2 j=hash2(floor(r*float2(90.,22.)));float a=PI*.25+(j.x-.5)*.16;g=float2(cos(a),-sin(a));d=1250.+j.y*450.;lines=.5+.5*sin((px.x+px.y)*1.5708);mirror=.35;}
 else if(pat<3.5){float2 c=floor(q*prism),f=fract(q*prism);g=mod(c.x+c.y,2.)<.5?float2(1.,0.):float2(0.,1.);d=1150.+hash(c)*600.;lines=smoothstep(0.,.12,f.x)*smoothstep(0.,.12,f.y)*(1.-smoothstep(.88,1.,f.x))*(1.-smoothstep(.88,1.,f.y));mirror=.3;}
 else if(pat<4.5){float3 w=voro(q*fine);float2 j=mix(hash2(w.xy*1.7),float2(vnoise(q*24.),vnoise(q*24.+5.1)),.6);float a=j.x*PI;g=float2(cos(a),sin(a));d=1000.+j.y*900.;float gk=pow(max(dot(normalize(float3((hash2(w.xy*3.1)-.5)*.5,1.)),H),0.),400.)*twinkle(w.xy);glint=gk*1.8+gk*exp(-sq(seedDist(q*fine)/.45))*.9;mirror=.25;}
 else if(pat<7.5){g=normalize(float2(-stroke.y,stroke.x)+1e-4);mirror=.45;}
 else if(pat<8.5){float3 w=voro(q*18.);float2 j=hash2(w.xy);float a=j.x*PI;g=float2(cos(a),sin(a));d=1100.+j.y*700.;seam=smoothstep(0.,.06,w.z);mirror=.4;}
 else if(pat<9.5){float3 w=voro(q*float2(7.,4.));float2 j=hash2(w.xy);float a=j.x*PI;g=float2(cos(a),sin(a));d=1200.+j.y*800.;glint=(1.-smoothstep(0.,.035,w.z))*pow(max(dot(normalize(float3((j-.5)*.8,1.)),H),0.),20.)*1.5;mirror=.35;}
 else if(pat<10.5){float2 c=floor(q*26.),f=fract(q*26.)-.5;float star=step(length(f),.18+.12*cos(atan(f.y,f.x)*5.+hash(c)*6.28));float2 j=hash2(c);g=star>.5?float2(cos(j.x*PI),sin(j.x*PI)):float2(1.,0.);d=star>.5?1100.+j.y*700.:1600.;lines=star;mirror=.3;}
 else if(pat<11.5){g=float2(0.,1.);d=1500.;lines=.5+.5*sin(px.y*2.0944);mirror=.6;ex=18.;}
 else if(pat>12.5&&pat<13.5){float2 c=floor(q*float2(9.,9.)),f=fract(q*float2(9.,9.))-.5;float k=mod(c.x+c.y,2.),glyph;
  if(k<.5){float loop=abs(length((f-float2(0.,.17))*float2(1.3,1.))-.13)-.035,bar=max(abs(f.x)-.03,abs(f.y+.12)-.2),arm=max(abs(f.x)-.2,abs(f.y-.0)-.03);glyph=1.-smoothstep(0.,.03,min(loop,min(bar,arm)));}
  else{float2 e=f*float2(1.,1.9);float lid=abs(length(e)-.26)-.03,pupil=length(f)-.07,tear=max(abs(f.x+.04)-.03,abs(f.y+.17)-.1);glyph=1.-smoothstep(0.,.03,min(lid,min(pupil,tear)));}
  float show=exp(-sq((u_tilt.x-.35)/.22))*exp(-sq((u_tilt.y+.1)/.5));g=float2(.7071,.7071);d=1300.;lines=glyph*show;mirror=.5;glint=glyph*show*pow(max(H.z,0.),20.)*1.2;}
 else if(pat>13.5){float2 c=floor(q*dots),f=fract(q*dots)-.5;float dm=1.-smoothstep(.26,.32,max(abs(f.x),abs(f.y)));float2 j=hash2(c);
  g=normalize(float2(1.,(j.x-.5)*.3));d=mix(1500.,1200.+j.y*500.,dm);lines=dm;mirror=.35;}
 else{float2 r=float2(uv.x+uv.y*u_aspect,uv.x-uv.y*u_aspect);float2 j=hash2(floor(r*float2(130.,30.)));float a=PI*.25+(j.x-.5)*.3;g=float2(cos(a),-sin(a));d=1150.+j.y*600.;float3 w=voro(q*flake);float gk=pow(max(dot(normalize(float3((hash2(w.xy)-.5)*.5,1.)),H),0.),300.)*twinkle(w.xy);glint=gk*1.6+gk*exp(-sq(seedDist(q*flake)/.45))*.8;mirror=.3;}
 float3 dif=grating(L,V,g,d)*seam;float spec=pow(max(H.z,0.),ex);
 float3 metal=tint<.5?float3(1.):tint<1.5?float3(1.,.74,.32):tint<2.5?float3(.86,.9,.96):float3(.92,.94,1.);
 float3 col=tint<.5?dif*(1.9+energy*1.2):tint<2.5?metal*(.55*spot+.8*length(dif))*1.4:mix(metal*(.5+.9*length(dif)),dif*1.6,.35);
 return (float3(.2)*metal+spot*(mirror*spec*metal+col)*(.7+.3*lines)+glint*metal)*seam+float3(.06)*(1.-seam);
}
// Ink over foil: thin inks pass part of the foil, brightened toward the ink's own hue. The scan is already a lit print, so the
// foil may add colour and sparkle but never sink the printed art below 80 % of its own brightness (art stays readable).
// Whole-card and art glitter stay light on the subject (the printed figure sits on white underbase; Randall 4 Nov 20:51Z).
float3 overInk(float3 base,float3 F,float cover){float3 T=mix(base,base/max(max(base.r,max(base.g,base.b)),.04),.32);
 // Most of a foil's reflection is broadband metal; only part of it is the grating's hue, so inks keep their own colour.
 float3 Fm=mix(float3(dot(F,float3(.2126,.7152,.0722))),F,.55);float3 o=mix(base,shoulder(T*Fm*1.35),clamp(cover,0.,1.));
 float lb=dot(base,float3(.2126,.7152,.0722)),lo=dot(o,float3(.2126,.7152,.0722));return lo<lb*.8?min(o*(lb*.8/max(lo,1e-4)),float3(1.)):o;}
float glyphAt(float2 uv){float2 t=(uv-u_name.xy)/(u_name.zw-u_name.xy);if(t.x<0.||t.y<0.||t.x>1.||t.y>1.)return 0.;return u_glyph.eval(t*u_gmap).r;}
half4 main(float2 p){
 float2 uv=p/u_size;half4 src=u_card.eval(p);float a=src.a;if(a<=0.)return src;
 float3 base=toLin(float3(src.rgb)/a);float4 mk=mapAt(uv),rl=relAt(uv);
 float art=inBox(uv,u_art),name=inBox(uv,u_name),text=inBox(uv,u_text),frame=(1.-art)*(1.-text)*(1.-name);
 float2 lp=float2(.5,.45)+u_tilt*.6;float3 P=float3(uv.x,uv.y*u_aspect,0.);
 float3 L=normalize(float3(lp.x,lp.y*u_aspect,.85)-P),V=normalize(float3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 float2 dl=(uv-lp)*float2(1.,u_aspect);float spot=exp(-dot(dl,dl)/.28);
 float2 e=2./u_map;float hx=relAt(uv+float2(e.x,0.)).r-relAt(uv-float2(e.x,0.)).r,hy=relAt(uv+float2(0.,e.y)).r-relAt(uv-float2(0.,e.y)).r;
 float3 nRel=normalize(float3(-hx*6.,-hy*6.,1.));float2 stroke=normalize(rl.gb*2.-1.+1e-4);
 float3 outC=base;
 // The figure's drawn folds and hair (strong strokes, little colour) stay ink even where the measuring calls them open:
 float satB=(max(base.r,max(base.g,base.b))-min(base.r,min(base.g,base.b)))/(max(base.r,max(base.g,base.b))+1e-3);
 mk.r*=1.-.75*art*smoothstep(.15,.6,mk.b)*(1.-smoothstep(.25,.6,satB));
 // Name bar ink is what differs from the bar's own ground (a wide horizontal average), so dark bars with black letters and black
 // Xyz bars with white letters both foil their ground, never the letters (site c86c6dbf, 05e587b6).
 float nameInk=0.;
 if(name>.5){float3 LW=float3(.2126,.7152,.0722);float l0=dot(base,LW),acc=0.;
  for(int i=-4;i<=4;i++)acc+=dot(toLin(float3(u_card.eval(float2(clamp(p.x+float(i)*.009*u_size.x,0.,u_size.x-1.),p.y)).rgb)),LW);
  nameInk=smoothstep(.05,.16,abs(l0-acc/9.));}
 if(u_whole.x>.5){float3 F=foil(u_whole.x,u_whole.y,uv,L,V,H,spot,0.,stroke);outC=overInk(outC,F,(1.-text*(1.-u_whole.z))*(1.-name*nameInk)*mix(1.,max(mk.r,.18),art)*.85);
  // A dark ground (Xyz black, Link navy) passes too little light through the ink to show its flakes; the sheet's glints add on top.
  if(name>.5){float dark=1.-smoothstep(.04,.25,dot(base,float3(.2126,.7152,.0722)));outC=shoulder(outC+F*dark*(1.-nameInk)*.16);}}
 if(u_frame.x>.5){float cov=u_frame.z>1.5?1.-inBox(uv,float4(.045,.032,.955,.968)):frame;
  if(u_frame.x>5.5&&u_frame.x<6.5){float rim=pow(max(dot(nRel,H),0.),18.)*(.35+.65*spot);outC=outC*(1.-.06*cov)+(1.-outC)*mix(float3(.95,.88,.7),outC*2.,.6)*rim*cov*.7;}
  else outC=overInk(outC,foil(u_frame.x,u_frame.y,uv,L,V,H,spot,0.,stroke),cov);}
 if(u_artL.x>.5){float cov=art*(u_artL.z>1.5?1.:max(mk.r,u_artL.x>3.5&&u_artL.x<4.5?.15:.35));if(u_artL.x>6.5&&u_artL.x<7.5)cov=art*max(mk.r,.22*mk.b);
  if(u_artL.x>4.5&&u_artL.x<5.5){float3 silver=float3(dot(outC,float3(.2126,.7152,.0722)))*float3(.9,.95,1.04);float rim=pow(max(dot(nRel,H),0.),10.);
   outC=mix(outC,shoulder(mix(silver,outC,.2)*(.55+.9*rim*(.4+.6*spot))+grating(L,V,float2(.7071),1600.)*.35*spot),art);}
  else if(u_artL.x>5.5&&u_artL.x<6.5){float rim=pow(max(dot(nRel,H),0.),18.)*(.35+.65*spot);outC=outC*(1.-.06*art)+(1.-outC)*mix(float3(.95,.88,.7),outC*2.,.6)*rim*art*.7;}
  else outC=overInk(outC,foil(u_artL.x,u_artL.y,uv,L,V,H,spot,mk.g,stroke),cov);}
 if(u_stars>.5&&art<.5&&mk.b>.3){float sc=smoothstep(.3,.8,mk.b);
  if(u_stars<1.5){float s=pow(max(dot(nRel,H),0.),30.)*(.3+.7*spot);outC+=(1.-outC)*float3(1.,.9,.6)*s*.9*sc;}
  else{float2 gr=length(nRel.xy)>.02?normalize(nRel.xy):float2(1.,0.);float3 dif=grating(L,V,gr,u_stars>3.5?1500.:1300.);float sp=pow(max(dot(nRel,H),0.),u_stars>3.5?24.:40.)*(.4+.6*spot);
   float3 metal=u_stars>3.5?float3(1.,.8,.42):float3(1.,.97,.9);float3 sheen=u_stars>3.5?metal*length(dif)*.35:dif*(u_stars>2.5?.42:.3);
   outC+=(1.-outC)*(metal*sp*.85+sheen*(.45+.55*spot))*sc;}}
 // Hot-stamped name: letters pressed into the card (height = -coverage), lit as metal by the same light.
 if(u_metal>.5&&name>.5){float c=glyphAt(uv);if(c>0.){
  float2 dg=1.5/u_gmap*(u_name.zw-u_name.xy);
  float dx=glyphAt(uv+float2(dg.x,0.))-glyphAt(uv-float2(dg.x,0.)),dy=glyphAt(uv+float2(0.,dg.y))-glyphAt(uv-float2(0.,dg.y));
  float3 n=normalize(float3(dx*1.6,dy*1.6,1.));
  float3 toL=float3((lp-uv)*float2(1.,u_aspect),.45),Ln=normalize(toL),Hn=normalize(Ln+float3(0.,0.,1.));
  float sp2=exp(-dot(toL.xy,toL.xy)/.30),shade=clamp(dot(n,Ln)*.6+.4,.15,1.),spec=pow(max(dot(n,Hn),0.),48.),wall=clamp(length(float2(dx,dy)),0.,1.);
  float3 metal;
  if(u_metal<1.5)metal=float3(.62,.66,.72);
  else if(u_metal<2.5)metal=float3(.83,.55,.13);
  else if(u_metal>3.5)metal=float3(.74,.77,.84);
  else{float hue=fract(uv.x*1.3+uv.y*.7+u_tilt.x*.35+u_tilt.y*.2);float3 rain=.5+.5*cos(6.28318*(hue+float3(0.,.33,.67)));
   float hatch=.5+.5*sin(dot(p,float2(1.))*1.2566);metal=mix(float3(.70,.72,.78),toLin(rain),.55+.25*hatch);}
  float3 nf=metal*shade*(.42+.58*sp2)+float3(1.,.97,.9)*(spec*(.35+.65*sp2)+wall*max(dot(n,Ln),0.)*sp2*.6);
  outC=mix(outC,clamp(nf,0.,1.),c);}}
 // The card's clear gloss coat: a soft band of light that slides across the whole face with the tilt.
 float band=dot((uv-lp)*float2(1.,u_aspect),normalize(float2(1.,.55)));outC+=(1.-outC)*.07*exp(-sq(band/.09))*(.4+.6*spot);
 return half4(half3(toSrgb(clamp(outC,0.,1.))*a),half(a));
}
"""
}
