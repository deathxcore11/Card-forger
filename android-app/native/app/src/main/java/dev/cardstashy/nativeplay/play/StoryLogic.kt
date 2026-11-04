package dev.cardstashy.nativeplay.play

/**
 * Story progress and gating, ported line by line from story-client.js (stars, progressFromRefs, battleCleared, actCleared,
 * actStars, secretOpen, currentBattle, currentAct). The server decides every reward; this only reads what it says.
 */
object StoryLogic {
    val STAR_KEYS = listOf("loaner", "own", "villain")
    /** 3 stars for a loaner win, 1 for your own Play deck, +1 for the villain side. */
    val STAR_VALUE = mapOf("loaner" to 3, "own" to 1, "villain" to 1)
    const val MAX_STARS = 5

    class Progress(val battles: Map<String, Set<String>> = emptyMap(), val acts: Set<Int> = emptySet())

    private val battleRef = Regex("^story:(a\\d+b\\d+):(loaner|own|villain|vown|clear)$")
    private val actRef = Regex("^story:act(\\d+):era$")

    fun fromRefs(refs: List<String>): Progress {
        val b = HashMap<String, MutableSet<String>>(); val a = HashSet<Int>()
        for (r in refs) {
            battleRef.find(r)?.let { b.getOrPut(it.groupValues[1]) { HashSet() } += it.groupValues[2]; return@let }
            actRef.find(r)?.let { a += it.groupValues[1].toInt() }
        }
        return Progress(b, a)
    }

    fun stars(p: Progress, id: String): Int = STAR_KEYS.sumOf { k -> if (k in (p.battles[id] ?: emptySet())) STAR_VALUE.getValue(k) else 0 }
    fun battleCleared(p: Progress, id: String): Boolean = p.battles[id]?.let { "clear" in it || STAR_KEYS.any { k -> k in it } } == true
    fun actCleared(p: Progress, n: Int): Boolean = n in p.acts || battleCleared(p, "a${n}b8")
    fun actStars(p: Progress, n: Int): Int = (1..8).sumOf { stars(p, "a${n}b$it") }
    fun actWon(p: Progress, n: Int): Int = (1..8).count { battleCleared(p, "a${n}b$it") }
    /** An act's secret boss (slot 9) opens once all 8 battles are won with the Story decks. */
    fun secretOpen(p: Progress, n: Int): Boolean = (1..8).all { "loaner" in (p.battles["a${n}b$it"] ?: emptySet()) }
    /** The battle you're on: the first one in order that isn't cleared. Battles open one at a time. */
    fun currentBattle(p: Progress, n: Int): Int { for (i in 1..8) if (!battleCleared(p, "a${n}b$i")) return i; return 9 }
    /** The act you're on. Act n opens when act n-1's boss falls. */
    fun currentAct(p: Progress, acts: Int): Int { for (a in 1..acts) if (!actCleared(p, a)) return a; return acts + 1 }

    /** An own Play deck is allowed when every non-basic card is in the act's pool, it has 60+ cards and no more than 4 of a name. */
    class Fit(val ok: Boolean, val reason: String)
    private val basic = Regex("^(snow-covered )?(plains|island|swamp|mountain|forest)$", RegexOption.IGNORE_CASE)
    fun ownDeckFits(cards: List<Pair<String, Int>>, pool: Set<String>?): Fit {
        if (pool == null) return Fit(false, "Checking the card pool…")
        var total = 0; val counts = LinkedHashMap<String, Int>(); val outside = ArrayList<String>()
        for ((name, qty) in cards) {
            total += qty
            if (basic.matches(name)) continue
            counts[name] = (counts[name] ?: 0) + qty
            if (name.lowercase() !in pool) outside += name
        }
        if (total < 60) return Fit(false, "$total cards. Story decks need 60.")
        if (counts.values.any { it > 4 }) return Fit(false, "More than 4 copies of a card.")
        if (outside.isNotEmpty()) return Fit(false, "${outside.size} card${if (outside.size == 1) " is" else "s are"} from outside this act, like ${outside[0]}.")
        return Fit(true, "")
    }
}
