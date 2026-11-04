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

    /** owesAttack(): only a must-attack creature that could attack now still owes one. */
    fun owesAttack(c: Card) = c.mustAttack && !c.attacking && !c.tapped && !(c.summoningSick && c.keywords.none { Regex("haste", RegexOption.IGNORE_CASE).containsMatchIn(it) })
}

/** forge-table.mjs shortCasts: a spell whose payment Forge couldn't finish stays dark until your mana changes (a land, a new turn, floating mana). */
class ShortCasts {
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
            if (a == "unavailable" || id in short || a != "available" && Affordability.provenUnaffordable(card, st, st.me.mana)) out[id] = "Not enough mana"
        }
        return out
    }

    /**
     * The glow means "you can do this now" (Randall 4 Nov: Cid glowed on turn 1 with one land). Forge lists every card with a
     * usable ability as actionable, mana or not; its own pay check (HumanActionAffordability, per card as "affordability")
     * says "available" only when the cost can really be paid now. A card Forge checked and could not prove stays dark here,
     * but it can still be tapped and tried (X spells, odd alternative costs). Lands that only tap for mana stay dark too.
     * When the check ran out of time (no answer for a card), the "Not enough mana" reader above decides as before.
     */
    fun quiet(st: MatchState, blocked: Map<Int, String>): Set<Int> {
        if (st.prompt != null) return emptySet()
        return st.selection.actionable.filterTo(HashSet()) { id ->
            id !in blocked && st.selection.affordability[id].let { it != null && it != "available" } && (st.card(id) ?: st.players.flatMap { it.command }.firstOrNull { it.id == id })?.controller == st.viewer
        }
    }
}
