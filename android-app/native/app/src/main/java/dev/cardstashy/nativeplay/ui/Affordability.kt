package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * Port of the site's "Not enough mana" and "must attack" reads: forge-table.mjs (COST_BENDERS, MANA_SYMBOL, manaSources,
 * landCeiling, TABLE_BENDERS, provenUnaffordable, shortCasts) and native-panel.mjs (costText, nativePayment, owesAttack).
 */
object Affordability {
    private val COST_BENDERS = Regex("\\bcosts?\\b[^.]*\\bless\\b|\\breduc|without paying|rather than pay|alternative|convoke|delve|improvise|affinity|evoke|emerge|offering|assist|spectacle|surge|prowl|\\bdash\\b|blitz|madness|foretell|\\bplot\\b|bestow|mutate|overload|prototype|flashback|escape|unearth|cycling|channel|ninjutsu|morph|disguise|\\bwarp\\b|sneak|freerunning|impending|mayhem|from your hand|discard this card|exile this card|reveal this card", RegexOption.IGNORE_CASE)
    private val MANA_SYMBOL = Regex("^(?:\\d+|[WUBRGC])$")
    private val TABLE_BENDERS = Regex("\\bcosts?\\b[^.]*\\bless\\b|\\breduc|without paying|rather than pay|alternative cost|as though it were mana|spend mana as though|convoke|improvise|affinity|\\bdelve\\b", RegexOption.IGNORE_CASE)
    private val WUBRGC = "WUBRGC".map { it.toString() }
    private fun Card.has(t: String) = Regex("\\b$t\\b").containsMatchIn(type)

    /**
     * Lines that bend OTHER spells' costs ("Equipment and Vehicle spells you cast cost {1} less") work only from the battlefield,
     * so they never make the card itself cheaper in hand. Without this, Cid, Freeflier Pilot glowed on turn 1 with one land.
     */
    private val OTHERS_COST = Regex("[^.\\n]*\\bspells\\b[^.\\n]*\\bcosts?\\b[^.\\n]*\\b(?:less|more)\\b[^.\\n]*\\.?", RegexOption.IGNORE_CASE)

    /** COST_BENDERS: a card whose own cost can bend stays lit (forge-sure false). */
    fun costBends(c: Card) = COST_BENDERS.containsMatchIn(c.text.replace(OTHERS_COST, ""))

    /** manaSources(): each option is a list of tokens, each token the colours it may be; null when this reader can't follow the card. */
    private fun manaSources(card: Card, tapped: Boolean): List<List<List<String>>>? {
        val lines = card.text.split(Regex("\\n|(?<=\\.)\\s+(?=[A-Z{])")).map { it.trim().replace(Regex("^\\((.*)\\)$"), "$1") }.filter { Regex("\\badd\\b", RegexOption.IGNORE_CASE).containsMatchIn(it) }
        if (lines.isEmpty()) {
            if (!card.has("Land") || tapped) return emptyList()
            val colors = listOf("Plains" to "W", "Island" to "U", "Swamp" to "B", "Mountain" to "R", "Forest" to "G").filter { (t, _) -> Regex("\\b$t\\b").containsMatchIn(card.type) }.map { it.second }
            return if (colors.isNotEmpty()) listOf(listOf(colors)) else null
        }
        val options = ArrayList<List<List<String>>>()
        for (line in lines) {
            val split = line.split(Regex(":\\s*"), 2); if (split.size < 2) return null
            val (cost, effect) = split
            val parts = cost.split(Regex(",\\s*")).map { it.trim() }
            if (!parts.all { it == "{T}" || Regex("^sacrifice (?:this|~|it|cardname)", RegexOption.IGNORE_CASE).containsMatchIn(it) || Regex("^sacrifice ", RegexOption.IGNORE_CASE).containsMatchIn(it) && it.lowercase().contains(card.name.lowercase()) }) return null
            // A tapped source still counts when an ability of its needs no tap ("Sacrifice this: Add {W}.").
            if ("{T}" in parts && (tapped || card.summoningSick && card.has("Creature"))) continue
            val add = Regex("^add (.+)$", RegexOption.IGNORE_CASE).find(effect.replace(Regex("\\.?\\s*(?:\\(.*\\))?$"), "")) ?: return null
            val what = add.groupValues[1].trim()
            val any = Regex("^(one|two|three) mana of any (?:one )?(?:color|type)\\b(?:[^.]*\\bcommander'?s? color identity)?$", RegexOption.IGNORE_CASE).find(what)
            if (any != null) options += List(mapOf("one" to 1, "two" to 2, "three" to 3).getValue(any.groupValues[1].lowercase())) { WUBRGC }
            else {
                val alts = what.split(Regex(",\\s*(?:or\\s+)?|\\s+or\\s+"))
                val parsed = alts.map { a -> if (Regex("^(?:\\{[WUBRGC]\\})+$").matches(a)) Regex("[WUBRGC]").findAll(a).map { it.value }.toList() else null }
                if (parsed.any { it == null }) return null
                for (tokens in parsed) options += tokens!!.map { listOf(it) }
            }
        }
        return options
    }

    /** landCeiling(): any colour, as many mana as its longest Add clause names; anything that scales stays unknown. */
    private fun landCeiling(card: Card): List<List<List<String>>>? {
        if (!card.has("Land") || card.tapped) return null
        if (Regex("for each|\\bX\\b|amount|double|twice|additional|instead", RegexOption.IGNORE_CASE).containsMatchIn(card.text)) return null
        val adds = Regex("\\badd ([^.]+)", RegexOption.IGNORE_CASE).findAll(card.text).map { m -> val t = m.groupValues[1]
            maxOf(Regex("\\{[^}]+\\}").findAll(t).count(), if (Regex("\\btwo\\b", RegexOption.IGNORE_CASE).containsMatchIn(t)) 2 else if (Regex("\\bthree\\b", RegexOption.IGNORE_CASE).containsMatchIn(t)) 3 else 1) }.toList()
        return listOf(List(maxOf(1, adds.maxOrNull() ?: 1)) { WUBRGC })
    }

    private fun surface(st: MatchState): List<Card> = st.players.flatMap { it.battlefield + it.hand + it.graveyard + it.exile + it.command }

    /** provenUnaffordable(): true only when no way of tapping your sources (plus floating mana) can pay the card's printed cost. */
    fun provenUnaffordable(card: Card, st: MatchState, pool: Map<String, Int>): Boolean {
        if (card.hidden || card.zone != "Hand" || card.has("Land") || costBends(card)) return false
        val symbols = Regex("\\{[^}]+\\}").findAll(card.manaCost).map { it.value.drop(1).dropLast(1) }.toList()
        if (symbols.isEmpty() || !symbols.all { MANA_SYMBOL.matches(it) }) return false
        val generic = symbols.filter { Regex("\\d").containsMatchIn(it) }.sumOf { it.toInt() }; val colored = symbols.filter { !Regex("\\d").containsMatchIn(it) }
        val all = surface(st)
        val table = all.filter { it.zone == "Battlefield" || it.zone == "Command" }
        if (table.any { it.hidden || TABLE_BENDERS.containsMatchIn(it.text) }) return false
        if (all.any { it.zone == "Hand" && it.controller == st.viewer && it.id != card.id && Regex("from your hand[^.]*:\\s*add|:\\s*add[^.]*\\bfrom your hand", RegexOption.IGNORE_CASE).containsMatchIn(it.text) }) return false
        val floating = pool.flatMap { (c, n) -> List(maxOf(0, n)) { listOf(c.uppercase()) } }
        val sources = ArrayList<List<List<List<String>>>>()
        for (c in table) { if (c.controller != st.viewer || c.zone != "Battlefield") continue; val o = manaSources(c, c.tapped) ?: landCeiling(c) ?: return false; if (o.isNotEmpty()) sources += o }
        if (sources.size > 14 || sources.fold(1L) { a, o -> a * o.size } > 4096) return false
        fun pays(tokens: List<List<String>>): Boolean {
            if (tokens.size < generic + colored.size) return false
            val used = BooleanArray(tokens.size)
            fun fit(i: Int): Boolean { if (i == colored.size) return true; for (k in tokens.indices) if (!used[k] && colored[i] in tokens[k]) { used[k] = true; if (fit(i + 1)) return true; used[k] = false }; return false }
            return fit(0)
        }
        fun walk(i: Int, tokens: List<List<String>>): Boolean = if (i == sources.size) pays(tokens) else sources[i].any { opt -> walk(i + 1, tokens + opt) }
        return !walk(0, floating)
    }

    /** Explains itself E1: one mana of a cost as a pip: its colour ("W", "U", "B", "R", "G", "C") or "1" for one generic mana, and whether your open mana covers it. */
    data class Pip(val symbol: String, val paid: Boolean)
    /** Explains itself E1: a hand card's printed cost as pips, the part your open mana covers lit; [missing] is how many are not. */
    data class ManaShort(val pips: List<Pip>) { val missing: Int get() = pips.count { !it.paid } }

    /**
     * Explains itself E1 ("2 mana short"): how much of [card]'s printed cost your untapped sources and floating mana can cover at
     * best. The same reader as [provenUnaffordable] and the same doubts: null whenever that reader cannot follow the card or the
     * table (a cost that bends, a hidden card, a source it cannot read), when the cost can be paid, or when it is over 10 mana
     * (the row would not fit the card). Coloured mana is covered first where it can be, then generic.
     */
    /** Your untapped permanents that make mana: what wears the payment light while a card that is [manaShort] is lifted. */
    fun openSources(st: MatchState): Set<Int> = st.me.battlefield.filter { !it.tapped && !it.hidden && manaSources(it, false)?.isNotEmpty() == true }.map { it.id }.toSet()

    fun manaShort(card: Card, st: MatchState, pool: Map<String, Int>): ManaShort? {
        if (card.hidden || card.zone != "Hand" || card.has("Land") || costBends(card)) return null
        val symbols = Regex("\\{[^}]+\\}").findAll(card.manaCost).map { it.value.drop(1).dropLast(1) }.toList()
        if (symbols.isEmpty() || !symbols.all { MANA_SYMBOL.matches(it) }) return null
        val generic = symbols.filter { Regex("\\d").containsMatchIn(it) }.sumOf { it.toInt() }; val colored = symbols.filter { !Regex("\\d").containsMatchIn(it) }
        if (generic + colored.size > 10) return null
        val all = surface(st)
        val table = all.filter { it.zone == "Battlefield" || it.zone == "Command" }
        if (table.any { it.hidden || TABLE_BENDERS.containsMatchIn(it.text) }) return null
        if (all.any { it.zone == "Hand" && it.controller == st.viewer && it.id != card.id && Regex("from your hand[^.]*:\\s*add|:\\s*add[^.]*\\bfrom your hand", RegexOption.IGNORE_CASE).containsMatchIn(it.text) }) return null
        val floating = pool.flatMap { (c, n) -> List(maxOf(0, n)) { listOf(c.uppercase()) } }
        val sources = ArrayList<List<List<List<String>>>>()
        for (c in table) { if (c.controller != st.viewer || c.zone != "Battlefield") continue; val o = manaSources(c, c.tapped) ?: landCeiling(c) ?: return null; if (o.isNotEmpty()) sources += o }
        if (sources.size > 14 || sources.fold(1L) { a, o -> a * o.size } > 4096) return null
        // The best cover over every way of tapping: most mana covered, and among those the most coloured pips.
        var best: Pair<BooleanArray, Int>? = null
        fun score(c: BooleanArray, g: Int) = (c.count { it } + g) * 100 + c.count { it }
        fun cover(tokens: List<List<String>>) {
            val used = BooleanArray(tokens.size); val got = BooleanArray(colored.size)
            fun fit(i: Int) {
                if (i == colored.size) { val g = minOf(generic, tokens.size - used.count { it }); val b = best
                    if (b == null || score(got, g) > score(b.first, b.second)) best = got.copyOf() to g
                    return }
                for (k in tokens.indices) if (!used[k] && colored[i] in tokens[k]) { used[k] = true; got[i] = true; fit(i + 1); used[k] = false; got[i] = false }
                fit(i + 1)
            }
            fit(0)
        }
        fun walk(i: Int, tokens: List<List<String>>) { if (i == sources.size) cover(tokens) else sources[i].forEach { opt -> walk(i + 1, tokens + opt) } }
        walk(0, floating)
        val (got, g) = best ?: return null
        // In the order the cost is printed: the plain part first, then the coloured pips.
        val pips = List(generic) { Pip("1", it < g) } + colored.mapIndexed { i, c -> Pip(c, got[i]) }
        return ManaShort(pips).takeIf { it.missing > 0 }
    }

    private fun costText(v: String?) = v?.trim()?.takeIf { Regex("^(\\{[^{}\\s]{1,8}\\})+$").matches(it) }

    /** nativePayment(): while Forge asks for mana, is the rest short (Auto refused, or nothing to tap and nothing floating)? */
    data class Paying(val short: Boolean, val name: String?, val forCard: Int?)
    fun paying(st: MatchState): Paying? {
        if (st.inputType?.startsWith("InputPayMana") != true) return null
        val lines = st.message.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        val owed = lines.firstOrNull { Regex("^pay mana cost:", RegexOption.IGNORE_CASE).containsMatchIn(it) }
        val remaining = costText(st.payment?.remaining) ?: costText(owed?.replace(Regex("^pay mana cost:", RegexOption.IGNORE_CASE), ""))
        val ref = st.payment?.forCard; val card = ref?.let { id -> surface(st).firstOrNull { it.id == id && !it.hidden } }
        val name = card?.name ?: st.payment?.forName?.trim()?.takeIf { it.isNotEmpty() }
        val pool = st.me.mana.values.any { it > 0 }; val sources = st.selection.actionable.isNotEmpty()
        val autoOff = (st.buttons.ok ?: "").equals("auto", true) && !st.buttons.okEnabled
        return Paying(remaining != null && (autoOff || !pool && !sources), name, ref)
    }

    /**
     * specs/match-table-master.md OPTIONAL PAY TRIGGERS (Randall 10 Nov, Spellbook Vendor "you may pay {1}" with no mana): your own
     * trigger, resolving on top of the stack, asks for a payment the reader proves you can't make, and Cancel is open. The name of
     * its source, to decline it for you; null when it might be payable, is a spell, or an ability you started yourself.
     */
    fun unpayableTrigger(st: MatchState): String? {
        if (st.prompt != null || !st.buttons.cancelEnabled || paying(st)?.short != true) return null
        val top = st.stack.firstOrNull() ?: return null
        val src = top.source ?: return null
        return src.name.takeIf { top.ability && top.controller == st.viewer && src.id == st.payment?.forCard }
    }

    /** owesAttack(): only a must-attack creature that could attack now still owes one. */
    fun owesAttack(c: Card) = c.mustAttack && !c.attacking && !c.tapped && !(c.summoningSick && c.keywords.none { Regex("haste", RegexOption.IGNORE_CASE).containsMatchIn(it) })
}

/** forge-table.mjs shortCasts: a spell whose payment Forge couldn't finish stays dark until your mana changes (a land, a new turn, floating mana). */
class ShortCasts {
    companion object { const val NOT_ENOUGH = "Not enough mana" }
    private val short = HashMap<Int, String>(); private var sig = ""

    /** Returns the "Not enough mana" ids: actionable hand cards Forge or the reader says you can't pay for. */
    fun blocked(st: MatchState): Map<Int, String> {
        val all = st.players.flatMap { it.battlefield + it.hand + it.graveyard + it.exile + it.command }
        val now = listOf(st.turn, all.filter { it.controller == st.viewer && it.zone == "Battlefield" && !it.tapped }.map { it.id }, st.me.mana).toString()
        val paying = Affordability.paying(st)
        if (paying?.short == true && paying.forCard != null && all.firstOrNull { it.id == paying.forCard }?.zone != "Battlefield") short[paying.forCard] = sig
        if (paying == null) { sig = now; short.entries.removeAll { it.value != now } }
        if (st.prompt != null) return emptyMap()
        val out = HashMap<Int, String>()
        for (id in st.selection.actionable) {
            val card = all.firstOrNull { it.id == id } ?: continue
            if (card.controller != st.viewer) continue
            val a = st.selection.affordability[id]
            if (a == "unavailable" || id in short || a != "available" && Affordability.provenUnaffordable(card, st, st.me.mana)) out[id] = NOT_ENOUGH
        }
        return out
    }

    /**
     * The glow means "you can do this now" (Randall 4 Nov: Cid glowed on turn 1 with one land). Forge lists every card with a
     * usable ability as actionable, mana or not; its own pay check (HumanActionAffordability, per card as "affordability")
     * says "available" only when the cost can really be paid now. A card Forge checked and could not prove stays dark here,
     * but it can still be tapped and tried (X spells, odd alternative costs). Lands that only tap for mana stay dark too.
     * When the check ran out of time (no answer for a card), the "Not enough mana" reader above decides as before. A card the
     * check could not prove but whose payment Forge's auto-pay planned (a non-empty tapPreview) is not quieted.
     */
    fun quiet(st: MatchState, blocked: Map<Int, String>): Set<Int> {
        if (st.prompt != null) return emptySet()
        return st.selection.actionable.filterTo(HashSet()) { id ->
            id !in blocked && st.selection.affordability[id].let { it != null && it != "available" } &&
                // Thor 0.4.56 (Shardmage's Rescue, flash {W}, during the CPU's turn): Forge's check ran out of time ("unknown") but
                // Forge's own auto-pay planned the sources for it (tapPreview): that is Forge saying it can be paid, so it stays lit.
                // Forge's own "unavailable" always stays dark: a plan beside it may be partial, and stopsFor never stops for it.
                (st.selection.affordability[id] == "unavailable" || st.selection.tapPlans[id]?.sources.isNullOrEmpty()) && (st.card(id) ?: st.players.flatMap { it.command }.firstOrNull { it.id == id })?.controller == st.viewer
        }
    }
}

/**
 * Explains itself E1 (specs/explains-itself-briefs.md, approved 19 Nov): why a hand card that does not glow cannot be used now, said
 * on the card when it is lifted. Only what the card's own type and the turn make certain; anything else says nothing.
 */
object WhyNot {
    const val YOUR_TURN = "Only on your turn"
    const val MAIN_PHASE = "Only in your main phase"
    /** A tap on your own creature while Forge asks for attackers, and it cannot attack. */
    const val ARRIVED = "Attacks next turn"
    const val TAPPED = "Tapped"
    fun short(n: Int) = "$n mana short"
    private val FAST_TYPE = Regex("\\b(Land|Instant)\\b"); private val FLASH = Regex("\\bflash\\b", RegexOption.IGNORE_CASE)
    /** How long a lift that only says a timing reason stays up (brief E1.4). */
    const val SHOWN_MS = 2500L

    /**
     * The timing reason for a hand card Forge does not offer: it is not an instant and has no flash, and it is the CPU's turn
     * ([YOUR_TURN]) or your turn outside a main phase ([MAIN_PHASE]). Null for a card Forge lists (it has its own light or its own
     * reason), a land (the state holds no land-play count), a card with flash anywhere in its words, and every case not named here.
     */
    fun timing(card: Card, st: MatchState): String? {
        if (card.hidden || card.zone != "Hand" || card.controller != st.viewer || card.id in st.selection.actionable) return null
        // Only while the table is in plain play: a question (a discard, a target, a mulligan) has its own words.
        if (st.prompt != null || card.id in st.selection.cards || st.inputType !in setOf(null, "InputLockUI", "InputPassPriority", "InputAttack", "InputBlock")) return null
        if (FAST_TYPE.containsMatchIn(card.type)) return null
        if (FLASH.containsMatchIn(card.text) || card.keywords.any { it.contains("flash", ignoreCase = true) }) return null
        val active = st.activePlayer ?: return null
        if (active != st.viewer) return YOUR_TURN
        val phase = st.phase ?: return null
        return if (phase != "MAIN1" && phase != "MAIN2") MAIN_PHASE else null
    }

    /** Your creature tapped on while attackers are asked for and Forge does not offer it: the fact on the card that says why, or null. */
    fun attack(card: Card, st: MatchState): String? {
        if (st.inputType != "InputAttack" || card.zone != "Battlefield" || card.controller != st.viewer || !card.isCreature) return null
        if (card.attacking || card.id in st.selection.cards) return null
        return when {
            card.tapped -> TAPPED
            card.summoningSick && card.keywords.none { it.contains("haste", ignoreCase = true) } -> ARRIVED
            else -> null
        }
    }
}
