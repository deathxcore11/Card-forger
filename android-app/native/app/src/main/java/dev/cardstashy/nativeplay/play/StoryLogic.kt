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
    /**
     * Key feats (story-deeds.js KEY_FEATS, Randall 4 Nov 2026): an act's secret boss also needs these three
     * hero-side deeds. One counts as earned when the account's counters hold 'sd:<id>' above zero.
     */
    val KEY_FEATS: Map<Int, List<String>> = mapOf(
        1 to listOf("a1-colossus", "a1-order-ford", "a1-dawn-charge"),
        2 to listOf("a2-ball-rolls", "a2-heretic", "a2-legend-remains"),
        3 to listOf("a3-greedy", "a3-hold-pass", "a3-winter-sky"),
        4 to listOf("a4-elephants", "a4-unrewritten", "a4-flank"),
        5 to listOf("a5-shadow-army", "a5-adept", "a5-hive"),
        6 to listOf("a6-grunk", "a6-brood-cleansed", "a6-cradle"),
        7 to listOf("a7-hat", "a7-rebel-chain", "a7-throne"),
        8 to listOf("a8-cloak", "a8-ancient", "a8-goblin-host"),
        9 to listOf("a9-thirteen", "a9-nuts", "a9-sledge"),
        10 to listOf("a10-faces", "a10-wirewood", "a10-pemmin"),
        11 to listOf("a11-makers", "a11-junk", "a11-iron-golem"),
        12 to listOf("a12-shrine", "a12-kumano", "a12-flipped"),
        13 to listOf("a13-cultists", "a13-legion", "a13-first-blow"),
        14 to listOf("a14-future-waits", "a14-echo-fades", "a14-keld"),
        15 to listOf("a15-endless-court", "a15-arrow", "a15-cold-water"),
        16 to listOf("a16-dragonslayer", "a16-brothers-keeper", "a16-ancients"),
        17 to listOf("a17-titan", "a17-expedition", "a17-brood"),
        18 to listOf("a18-spark", "a18-furnace", "a18-tempered"),
        19 to listOf("a19-hunters", "a19-delver", "a19-zombies"),
        20 to listOf("a20-biomancer", "a20-rubblebelt", "a20-ghosts"),
        21 to listOf("a21-phalanx", "a21-tides", "a21-skyguard"),
        22 to listOf("a22-mantis", "a22-horde", "a22-manifest"),
        23 to listOf("a23-hydra", "a23-spy-network", "a23-reignited"),
        24 to listOf("a24-howlpack", "a24-grounded", "a24-bloodmad"),
        25 to listOf("a25-spire", "a25-fabricate", "a25-compliance"),
        26 to listOf("a26-no-gift", "a26-exerted", "a26-poisons"),
        27 to listOf("a27-golden-city", "a27-treasure", "a27-enrage"),
        28 to listOf("a28-story-unfolds", "a28-weatherlight", "a28-sisay"),
        29 to listOf("a29-beacon", "a29-queen", "a29-debts"),
        30 to listOf("a30-story", "a30-questing", "a30-escape"),
        31 to listOf("a31-party", "a31-doomskar", "a31-extus")
    )
    fun keyFeats(n: Int): List<String> = KEY_FEATS[n].orEmpty()
    fun keyFeatsMissing(n: Int, counters: Map<String, Double>): List<String> = keyFeats(n).filter { (counters["sd:$it"] ?: 0.0) <= 0.0 }
    private fun loaners(p: Progress, n: Int) = (1..8).count { "loaner" in (p.battles["a${n}b$it"] ?: emptySet()) }
    /** secretOpen: the secret boss (slot 9) is open once cleared, or once all 8 battles are won with the Story decks and its key feats are earned. */
    fun secretOpen(p: Progress, n: Int, counters: Map<String, Double>): Boolean =
        "clear" in (p.battles["a${n}b9"] ?: emptySet()) || loaners(p, n) == 8 && keyFeatsMissing(n, counters).isEmpty()
    class SecretStatus(val won: Int, val keys: Int, val keysNeeded: Int)
    fun secretStatus(p: Progress, n: Int, counters: Map<String, Double>) =
        SecretStatus(loaners(p, n), keyFeats(n).size - keyFeatsMissing(n, counters).size, keyFeats(n).size)
    /** story-ui.js secretTease: once 4 battles are won or a key feat is earned, say what the closed secret still needs. */
    fun secretTease(hasSecret: Boolean, p: Progress, n: Int, counters: Map<String, Double>): String? {
        if (!hasSecret || secretOpen(p, n, counters)) return null
        val st = secretStatus(p, n, counters)
        if (st.won < 4 && st.keys == 0) return null
        return "A secret battle waits in this act. Win all 8 battles with the Story decks (${st.won} of 8) and earn its ${st.keysNeeded} key feats (${st.keys} of ${st.keysNeeded}). Key feats are marked in Achievements."
    }
    /** The account's counters from the econ state, as numbers. */
    fun counters(state: com.google.gson.JsonObject?): Map<String, Double> = (state?.get("counters") as? com.google.gson.JsonObject)?.entrySet()
        ?.mapNotNull { (k, v) -> runCatching { k to v.asDouble }.getOrNull() }?.toMap().orEmpty()
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

    /** What a battle pays, in words (story-ui.js rewardText): era packs for your side, the villain's signature card for theirs. */
    fun rewardText(rw: com.google.gson.JsonObject?, set: String, setNames: Map<String, String>): String {
        fun n(k: String) = rw?.get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
        val coins = if (n("coins") > 0) " and ${n("coins")} coins" else ""
        val card = rw?.getAsJsonObject("card")?.get("name")?.asString
        if (card != null) return card + coins
        val packs = n("packs").takeIf { it > 0 } ?: 1
        return "$packs ${setNames[set] ?: set.uppercase()} ${if (packs > 1) "packs" else "pack"}$coins"
    }
}
