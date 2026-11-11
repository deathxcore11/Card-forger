package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card

/**
 * play-board-badges.js: what a battlefield tile shows around the card art, Arena style: a state corner, an activation
 * corner, a combat marker, a keyword rail, counters, marked damage, crew and attachments. All from the Forge snapshot.
 */
object TileBadges {
    /** KEYWORDS: display order for the keyword rail, what changes combat first. */
    val KEYWORDS = listOf(
        Triple("flying", "Flying", Regex("^flying$")), Triple("menace", "Menace", Regex("^menace$")),
        Triple("trample", "Trample", Regex("^trample(?: over planeswalkers)?$")), Triple("first-strike", "First strike", Regex("^first strike$")),
        Triple("double-strike", "Double strike", Regex("^double strike$")), Triple("deathtouch", "Deathtouch", Regex("^deathtouch$")),
        Triple("lifelink", "Lifelink", Regex("^lifelink$")), Triple("vigilance", "Vigilance", Regex("^vigilance$")),
        Triple("reach", "Reach", Regex("^reach$")), Triple("hexproof", "Hexproof", Regex("^hexproof(?: from .+)?$")),
        Triple("ward", "Ward", Regex("^ward\\b.*$")), Triple("indestructible", "Indestructible", Regex("^indestructible$")),
        Triple("protection", "Protection", Regex("^protection(?: from .+)?$")), Triple("haste", "Haste", Regex("^haste$")),
        Triple("defender", "Defender", Regex("^defender$")),
    )
    private val OTHER_KEYWORD = Regex("^(?:flash|prowess|infect|wither|shroud|changeling|persist|undying|convoke|delve|exalted|flanking|horsemanship|fear|intimidate|shadow|skulk|devoid|partner|banding|phasing|cascade|extort|evolve|exploit|myriad|melee|mentor|riot|training|decayed|ravenous|bargain|enlist|living weapon|for mirrodin!|daybound|nightbound|landwalk|[a-z]+walk|split second|storm|rebound|soulbond|undaunted|improvise|ascend|afterlife \\d+|(?:crew|equip|cycling|kicker|multikicker|annihilator|toxic|afflict|bushido|rampage|fading|vanishing|modular|dash|embalm|eternalize|unearth|flashback|escape|madness|morph|megamorph|disguise|ninjutsu|evoke|encore|blitz|prototype|mutate|bestow|reconfigure|squad|backup|affinity for|offspring|plot|craft with|graft|amplify|bloodthirst|dredge|fortify|reinforce|scavenge|outlast|renown|surge|emerge|awaken|aftermath|eminence|companion|boast|foretell|disturb|cleave|casualty|read ahead|more than meets the eye|transfigure|transmute|level up|suspend|channel|hideaway|impending|freerunning|saddle|gift|exhaust|harmonize|mobilize|station|warp)\\b.*)$")
    val COUNTER_ICONS = mapOf("P1P1" to ("counter-plus1-plus1" to "+1/+1"), "M1M1" to ("counter-minus1-minus1" to "−1/−1"), "SHIELD" to ("shield-counter" to "Shield"),
        "STUN" to ("stun" to "Stun"), "FINALITY" to ("finality-counter" to "Finality"), "LORE" to ("saga" to "Lore"), "LOYALTY" to ("loyalty" to "Loyalty"), "DEFENSE" to ("defense" to "Defense"))
    private val COUNTER_ORDER = listOf("P1P1", "M1M1", "SHIELD", "STUN", "FINALITY", "LORE")
    private fun title(s: String) = s.replaceFirstChar { it.uppercase() }

    data class Keyword(val key: String?, val label: String, val text: String)
    data class Counter(val name: String, val count: Int, val icon: String?, val label: String)
    data class Model(
        val state: List<String>, val activation: Boolean, val combat: String?,
        val keywords: List<Keyword>, val keywordsMore: Int, val counters: List<Counter>, val countersMore: Int,
        val plaque: Pair<String, Int>?, val damage: Int, val crew: Int?, val attachments: List<Pair<String, Int>>, val compact: Boolean,
        /** 0.4.60 G1: every keyword with an icon, in rank order, uncapped: a creature's bottom strip fits what it can ([stripShown]). */
        val iconic: List<Keyword> = emptyList(),
    )

    /**
     * 0.4.60 G1: how many of [n] keyword marks a strip with room for [slots] marks shows; the rest fold into one "+N" mark, which
     * takes a slot of its own. No room: nothing.
     */
    fun stripShown(n: Int, slots: Int): Int = if (n <= slots) n else (slots - 1).coerceAtLeast(0)

    /** 0.4.60 G1: marks [kh] wide and [gap] apart that fit in [room] (all dp). */
    fun stripSlots(room: Float, kh: Float, gap: Float): Int = if (kh <= 0f || room < kh - .01f) 0 else ((room + gap + .01f) / (kh + gap)).toInt()

    /** 0.4.60 G1: a squeezed tile (narrower than it is tall) stacks its marks up the left edge, at most two (the second may be "+N"). */
    const val SQUEEZED_MARKS = 2

    /** currentKeywords(card): Forge's own list wins; until a bridge sends one, only keyword-only lines of the rules text count. */
    fun currentKeywords(card: Card): List<Keyword> {
        val out = mutableListOf<Keyword>(); val seen = HashSet<String>()
        fun add(raw: String, name: String) {
            val text = raw.replace(Regex("\\.$"), "").replace(Regex(":(?=\\S)"), " ").replace(Regex("\\s+"), " ").trim()
            val low = text.lowercase().replace(Regex("[:—–]\\s*"), " ")
            if (text.isEmpty() || text.length > 120 || !seen.add(low)) return
            val named = name.lowercase().replace('_', '-')
            val kw = KEYWORDS.firstOrNull { it.first == named } ?: KEYWORDS.firstOrNull { it.third.matches(low) }
            out += Keyword(kw?.first, kw?.second ?: title(text), if (kw != null && !Regex("^(?:ward|protection|hexproof from)").containsMatchIn(low)) kw.second else title(text))
        }
        if (card.keywordsKnown) { card.keywords.forEach { add(it, "") }; return out }
        for (line in card.text.split(Regex("\\r?\\n"))) {
            val clean = line.replace(Regex("\\([^)]*\\)"), "").trim().replace(Regex("\\.$"), "")
            if (clean.isEmpty() || clean.length > 120) continue
            val tokens = clean.split(Regex("\\s*[,;]\\s*")).map { it.trim() }.filter { it.isNotEmpty() }
            val low = tokens.map { it.lowercase().replace(Regex("[:—–]\\s*"), " ") }
            if (tokens.isEmpty() || !low.all { t -> KEYWORDS.any { it.third.matches(t) } || OTHER_KEYWORD.matches(t) }) continue
            tokens.forEach { add(it, "") }
        }
        return out
    }

    fun counterList(counters: Map<String, Int>): List<Counter> = counters.filter { (n, c) -> n.length <= 40 && c > 0 }
        .map { (n, c) -> Counter(n, c, COUNTER_ICONS[n]?.first, COUNTER_ICONS[n]?.second ?: title(n.replace('_', ' ').lowercase())) }
        .sortedWith(compareBy({ (COUNTER_ORDER.indexOf(it.name) + 1).takeIf { i -> i > 0 } ?: 99 }, { it.name }))

    /** tileBadges(card, {actionable}). */
    fun of(card: Card, actionable: Boolean): Model? {
        if (card.hidden || card.zone != "Battlefield") return null
        val creature = card.isCreature
        val keywords = currentKeywords(card)
        fun rank(k: Keyword) = KEYWORDS.indexOfFirst { it.first == k.key }
        val iconic = keywords.filter { it.key != null }.associateBy { it.key }.values.sortedBy { rank(it) }
        val state = buildList {
            if (card.tapped) add("tapped")
            if (creature && card.summoningSick) add("summoning-sick")
            if (card.attachedTo != null) add("attached")
            if (card.commander) add("commander")
        }
        val shown = if (iconic.size > 3) iconic.take(2) else iconic
        val counters = counterList(card.counters)
        val plaqueName = if (card.type.contains("Planeswalker")) "LOYALTY" else if (card.type.contains("Battle")) "DEFENSE" else null
        val plaqueValue = plaqueName?.takeIf { !creature }?.let { card.counters[it] }
        val damage = card.damage.coerceAtLeast(0); val slots = if (damage > 0) 1 else 2
        val rail = counters.filter { plaqueName == null || creature || it.name != plaqueName }
        val railShown = if (rail.size > slots) rail.take(slots - 1) else rail
        return Model(
            // play-forge-table.css:1078 hides summoning sick and commander on the battlefield.
            state = state.take(2).filter { it != "summoning-sick" && it != "commander" },
            activation = actionable, combat = if (card.attacking) "attacking" else if (card.blocking) "blocking" else null,
            keywords = shown, keywordsMore = iconic.size - shown.size, counters = railShown, countersMore = rail.size - railShown.size,
            plaque = if (plaqueName != null && plaqueValue != null) (if (plaqueName == "LOYALTY") "loyalty" else "defense") to plaqueValue else null,
            damage = damage, crew = if (card.type.contains("Artifact") && card.type.contains("Vehicle")) (card.crew ?: keywords.firstOrNull { Regex("^crew \\d+", RegexOption.IGNORE_CASE).containsMatchIn(it.text) }?.text?.let { Regex("\\d+").find(it)?.value?.toInt() }) else null,
            attachments = emptyList(), compact = !creature, iconic = iconic,
        )
    }
}
