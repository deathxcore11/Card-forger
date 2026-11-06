package dev.cardstashy.nativeplay.match

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.roundToLong

/**
 * play-quick-match.js chooseQuickOpponent, line for line: any complete list in the player's format from every source; a different
 * list whenever one exists (the same cards under another record is still a mirror); then Power matching. The pool (at most [sample]
 * lists, drawn at random) is ranked by the same Power the Collection shows, the pick aims near the player's percentile (Easy −15,
 * Medium 0, Hard +10, plus the Quick Play streak), with a Wild Card chance; same-archetype lists are rare picks, and a Commander CPU
 * stays within one bracket of yours when three or more such lists are rated. Anything unrated falls back to the random pick.
 * [rate] is app.js quickContext (play-deck-context.js capturePracticeDeckContext's Power and bracket), asked for whole lists at once.
 * Error texts are the site's.
 */
object QuickOpponent {
    data class Result(val deck: JsonObject, val candidateCount: Int, val estimated: Boolean, val wildCard: Boolean, val power: Double?, val bracket: Int?,
                      val myPower: Double?, val mirror: Boolean, val reason: String, val difficulty: String) {
        /** power-tier.js matchupLine: the reveal's line under the CPU's name. */
        val line: String get() = PowerTier.matchupLine(this)
    }
    /** One deck's quickContext: its Power (0-100) and Commander bracket, each null when the site has none. */
    data class Ctx(val power: Double?, val bracket: Int?)
    class NoOpponent(message: String) : Exception(message)

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    private fun names(a: JsonArray?) = a?.map { e -> (if (e.isJsonPrimitive) e.asString else (e as? JsonObject)?.s("name") ?: "") } ?: emptyList()

    private fun listKey(d: JsonObject) = listOf(d.s("format"), d.s("commander"), names(d.getAsJsonArray("commanders")).toString(),
        d.getAsJsonArray("cards")?.toString() ?: "[]", d.getAsJsonArray("side")?.toString() ?: "[]").joinToString("\u0001")

    private fun cardsKey(d: JsonObject): String {
        val leaders = (listOf(d.s("commander")) + names(d.getAsJsonArray("commanders"))).map { it.lowercase() }.sorted()
        val zones = listOf("cards", "side").map { z ->
            val total = LinkedHashMap<String, Double>()
            d.getAsJsonArray(z)?.forEach { r -> val o = r as? JsonObject ?: return@forEach
                val n = o.s("name").trim().lowercase(); val q = o.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0; total[n] = (total[n] ?: 0.0) + q }
            total.filter { it.value > 0 }.map { (n, q) -> n + "×" + (if (q == floor(q)) q.toLong().toString() else q.toString()) }.sorted()
        }
        return (listOf(leaders) + zones).toString()
    }

    private class Row(val deck: JsonObject, val key: String) { var score: Double? = null; var scored = false; var pct = 0.0; var bracket: Int? = null }

    private val OFFSET = mapOf("Easy" to -15.0, "Medium" to 0.0, "Hard" to 10.0)
    private const val SIGMA = 12.0

    suspend fun choose(player: JsonObject, candidates: List<JsonObject>, eligible: (JsonObject) -> Boolean, difficulty: String = "Medium",
                       random: () -> Double = Math::random, streak: Int = 0, wildChance: Double = 0.125, sample: Int = 40,
                       nativeValidationPending: Boolean = true, rate: suspend (List<JsonObject>) -> List<Ctx?> = { l -> l.map { null } }): Result {
        if (difficulty !in OFFSET) throw NoOpponent("Choose a CPU difficulty.")
        if (!eligible(player)) throw NoOpponent("Your selected deck needs play-support review before Quick Play.")
        val seen = HashSet<String>(); var rows = ArrayList<Row>()
        for (deck in candidates) {
            if (deck.s("format") != player.s("format")) continue
            val key = listKey(deck); if (key in seen || !eligible(deck)) continue
            seen += key; rows += Row(deck, key)
        }
        if (rows.isEmpty()) throw NoOpponent("No compatible CPU deck is available in this format yet. Choose another source in Practice.")
        // The CPU plays a different list whenever one exists; a mirror is only the last resort.
        val ownKey = listKey(player); val ownCards = cardsKey(player); val pid = player.s("id")
        val others = rows.filter { r -> r.key != ownKey && cardsKey(r.deck) != ownCards && !(pid.isNotEmpty() && r.deck.s("id") == pid) }
        if (others.isEmpty()) throw NoOpponent("Quick Play needs a different deck for the CPU in this format. Load Precons or Meta, or pick the CPU deck in Practice.")
        rows = ArrayList(others)
        // Power matching: rank the pool by the same Power the Collection shows, aim near the player's rank, and keep a small Wild Card
        // chance. Anything unrated or unscored falls back to the random pick.
        fun ok(n: Double?) = n?.takeIf { it.isFinite() && it >= 0 && it <= 100 }
        val mine = runCatching { rate(listOf(player)).firstOrNull() }.getOrNull()
        val myPower = ok(mine?.power)
        var pick = -1; var wildCard = false; var matched = false
        if (myPower != null && rows.size > 2) {
            val pool = if (rows.size > sample) rows.map { random() to it }.sortedBy { it.first }.take(sample).map { it.second } else rows
            val need = pool.filter { !it.scored }
            val got = runCatching { rate(need.map { it.deck }) }.getOrNull()
            need.forEachIndexed { i, r -> val c = got?.getOrNull(i); r.score = ok(c?.power); r.bracket = c?.bracket; r.scored = true }
            var rated = pool.filter { it.score != null }.sortedBy { it.score!! }
            // Commander: keep the CPU within one bracket of yours whenever three or more such lists are rated.
            if (player.s("format") == "Commander") {
                val mineB = mine?.bracket
                if (mineB != null) { val near = rated.filter { r -> r.bracket?.let { abs(it - mineB) <= 1 } == true }; if (near.size > 2) rated = near }
            }
            if (rated.size > 2) {
                // Rank, not raw points: placing lists crowd the top of the 0-100 scale, so the gap is measured in pool percentile.
                fun pct(v: Double) = 100.0 * rated.count { it.score!! < v } / rated.size
                val me = pct(myPower)
                val nudge = streak.coerceIn(-15, 15)
                val target = (me + OFFSET.getValue(difficulty) + nudge).coerceIn(0.0, 100.0)
                rated.forEach { it.pct = pct(it.score!!) }
                matched = true
                val wild = random() < wildChance
                val wide = if (wild) rated.filter { it.pct <= target + (if (difficulty == "Easy") 25 else 40) } else rated
                val band = wide.ifEmpty { rated }
                wildCard = wild
                // Another archetype is more fun than a near-mirror of your own deck: same-archetype lists are rare picks.
                fun arch(d: JsonObject) = (d.s("archetype").ifEmpty { d.s("name") }).split(" · ")[0].trim().lowercase()
                val mineArch = arch(player)
                fun same(r: Row) = if (mineArch.isNotEmpty() && arch(r.deck) == mineArch) 0.15 else 1.0
                val weights = if (wild) band.map(::same) else band.map { r -> (exp(-((r.pct - target) * (r.pct - target)) / (2 * SIGMA * SIGMA)) + 0.02) * same(r) }
                var roll = maxOf(0.0, random()) * weights.sum(); var i = 0
                while (i < band.size - 1) { roll -= weights[i]; if (roll <= 0) break; i++ }
                pick = rows.indexOf(band[i])
            }
        }
        if (pick < 0) pick = minOf(rows.size - 1, floor(maxOf(0.0, random()) * rows.size).toInt())
        val selected = rows[pick]; val mirror = cardsKey(selected.deck) == ownCards
        val bracket = if (selected.deck.s("format") != "Commander") null
            else (if (selected.scored) selected.bracket else runCatching { rate(listOf(selected.deck)).firstOrNull()?.bracket }.getOrNull())
        val n = rows.size
        return Result(selected.deck.deepCopy(), n, matched, wildCard, selected.score, bracket, if (matched) myPower else null, mirror,
            (if (mirror) "CPU will use the same card list as you. " else "") + (if (wildCard) "Wild Card from " else if (matched) "Matched to your deck from " else "Picked at random from ") +
                "$n deck${if (n == 1) "" else "s"} in your format." + (if (nativeValidationPending) " Both full lists are checked when the match opens." else ""), difficulty)
    }
}

/**
 * power-tier.js: the real game's own words. Constructed: the meta's Tier 1 / 2 / 3 (plus Casual) from the one Power number (0-100,
 * the Collection chip). Commander: the official Brackets 1-5, never a made-up tier.
 */
object PowerTier {
    val POWER_TIERS = listOf(90 to "Tier 1", 80 to "Tier 2", 60 to "Tier 3", 0 to "Casual")
    val BRACKET_NAMES = mapOf(1 to "Exhibition", 2 to "Core", 3 to "Upgraded", 4 to "Optimized", 5 to "cEDH")
    fun powerTier(v: Double?): String = if (v != null && v.isFinite()) POWER_TIERS.first { (min, _) -> v >= min }.second else ""
    fun bracketLabel(b: Int?): String = if (b != null && BRACKET_NAMES[b] != null) "Bracket $b" else ""
    /** How the CPU deck compares with yours, from the same two numbers (6 points is a coin flip). */
    fun fairness(mine: Double?, theirs: Double?): String {
        if (mine == null || theirs == null || !mine.isFinite() || !theirs.isFinite()) return ""
        val gap = theirs - mine; return if (gap > 6) "You’re the underdog" else if (gap < -6) "You’re favoured" else "Even match"
    }
    fun matchupLine(m: QuickOpponent.Result?): String {
        val p = m?.power?.takeIf { it.isFinite() } ?: return ""
        val label = if (bracketLabel(m.bracket).isNotEmpty()) bracketLabel(m.bracket) + " " + BRACKET_NAMES[m.bracket] else powerTier(p)
        // Math.round: halves go up.
        return listOf(if (m.wildCard) "Wild Card" else "", "$label · ${floor(p + .5).roundToLong()}", fairness(m.myPower, p)).filter { it.isNotEmpty() }.joinToString(" · ")
    }
}
