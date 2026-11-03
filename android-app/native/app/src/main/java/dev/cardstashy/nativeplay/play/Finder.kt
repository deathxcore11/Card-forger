package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject

/**
 * "Build a deck", the Untapped-style finder: play-deck-finder.js and the rules it leans on in
 * play-econ-rules.js (deckStatus, copyCap, singleton formats incl. Standard Brawl, the cap-aware
 * shortfall), from the web's finder branch (PR #105). Kept apart from Decks so the live Decks page
 * keeps today's site rules until that branch is live. Proven against the web in FinderTest.
 */
object Finder {
    val FORMATS = listOf("Standard", "Pioneer", "Modern", "Pauper", "Legacy", "Vintage", "Commander", "Standard Brawl")
    val FILTERS = listOf("all" to "All decks", "trunk" to "In Trunk", "craftable" to "Craftable now")
    val SORTS = listOf("owned" to "Closest to owned", "popular" to "Most played")
    private val SEAL_KEYS = listOf("c", "u", "r", "m")
    private val BASIC_COLOR = mapOf("Plains" to "W", "Island" to "U", "Swamp" to "B", "Mountain" to "R", "Forest" to "G", "Wastes" to "C")

    data class Rules(val size: Int, val copies: Int, val exact: Boolean, val commander: Boolean, val legality: String)
    private val SINGLETON = mapOf("Commander" to (100 to "commander"), "Standard Brawl" to (60 to "standardbrawl"))
    fun isSingleton(format: String?) = format in SINGLETON
    fun deckRules(format: String?): Rules = SINGLETON[format]?.let { (size, legality) -> Rules(size, 1, true, true, legality) }
        ?: Rules(60, 4, false, false, (format?.ifEmpty { null } ?: "standard").lowercase())
    /** Copies a deck may play: basics unlimited, singleton 1, Vintage's restricted list 1. */
    fun copyCap(name: String, format: String?, legalities: JsonObject?): Int {
        if (Decks.isBasicLand(name)) return Int.MAX_VALUE
        val r = deckRules(format)
        return if (legalities?.get(r.legality)?.takeIf { it.isJsonPrimitive }?.asString == "restricted") 1 else r.copies
    }

    data class Shortfall(val missing: List<Decks.Missing>, val seals: Map<String, Int>, val complete: Boolean)
    private fun rarityOf(r: String?) = when (r) { "common", "uncommon", "rare", "mythic" -> r; "special" -> "rare"; "bonus" -> "mythic"; else -> "common" }
    /** deckShortfall with a per-card cap: copies past the cap never bill. */
    fun shortfall(deck: List<Pair<String, Int>>, owned: Map<String, Int>, rarity: (String) -> String?, cap: (String) -> Int): Shortfall {
        val want = LinkedHashMap<String, Int>()
        for ((n, q) in deck) if (n.isNotEmpty() && !Decks.isBasicLand(n)) want[n] = (want[n] ?: 0) + maxOf(1, q)
        val missing = ArrayList<Decks.Missing>(); val seals = linkedMapOf("c" to 0, "u" to 0, "r" to 0, "m" to 0)
        for ((name, qty) in want) {
            val need = minOf(qty, cap(name)) - (owned[name] ?: 0); if (need <= 0) continue
            val r = rarityOf(rarity(name)); val seal = Decks.RARITY_SEAL.getValue(r)
            missing += Decks.Missing(name, need, r, seal); seals[seal] = seals.getValue(seal) + need
        }
        return Shortfall(missing, seals, missing.isEmpty())
    }
    data class Status(val status: String, val short: Map<String, Int>)
    /** Untapped's buckets: buildable, craftable (seals cover every rarity), else short by rarity. */
    fun deckStatus(sh: Shortfall?, seals: Map<String, Int>): Status {
        if (sh?.complete == true) return Status("buildable", SEAL_KEYS.associateWith { 0 })
        val short = SEAL_KEYS.associateWith { k -> maxOf(0, (sh?.seals?.get(k) ?: 0) - (seals[k] ?: 0)) }
        return Status(if (short.values.any { it > 0 }) "short" else "craftable", short)
    }
    /** ownedByName with copies pooled across printings (the branch's version). */
    fun ownedByName(cards: List<Trunk.Card>): Map<String, Int> {
        val out = LinkedHashMap<String, Int>(); val fronts = LinkedHashMap<String, Int>()
        for (c in cards) { out[c.n] = (out[c.n] ?: 0) + c.c; val f = c.n.split(" // ")[0]; if (f != c.n) fronts[f] = (fronts[f] ?: 0) + c.c }
        for ((f, n) in fronts) if (f !in out) out[f] = n
        return out
    }

    /** A list the finder ranks: a meta list from /api/meta/mtg, or the Trunk build. */
    data class MetaList(val key: String, val name: String, val format: String, val cards: List<Decks.Row>, val archetype: String = "", val source: String = "",
                        val detail: String = "", val commander: String = "", val size: Int? = null, val trunk: Boolean = false)
    private fun front(n: String) = n.split(" // ")[0]
    private fun ownedOf(owned: Map<String, Int>, n: String) = owned[n] ?: owned[front(n)] ?: 0
    private fun label(l: MetaList) = l.archetype.ifBlank { l.name }.trim()
    private fun mainRows(l: MetaList): LinkedHashMap<String, Int> { val rows = LinkedHashMap<String, Int>()
        for (r in l.cards) if (r.name.isNotEmpty() && r.board == null) rows[r.name] = (rows[r.name] ?: 0) + maxOf(1, r.qty); return rows }

    // ---- archetypes: core packages (3+ copies, or the commander), Jaccard ≥ .5, or ≥ .25 with the same label.
    private fun coreOf(l: MetaList): Set<String> {
        val main = l.cards.filter { it.name.isNotEmpty() && it.board == null && !Decks.isBasicLand(it.name) }
        if (isSingleton(l.format)) return setOfNotNull((l.commander.ifEmpty { null } ?: main.firstOrNull()?.name)?.ifEmpty { null })
        for (min in listOf(3, 2, 1)) { val s = main.filter { it.qty >= min }.map { it.name }.toCollection(LinkedHashSet()); if (s.size >= 4 || min == 1) return s }
        return emptySet()
    }
    private fun jaccard(a: Set<String>, b: Set<String>): Double { if (a.isEmpty() || b.isEmpty()) return 0.0; val k = a.count { it in b }; return k.toDouble() / (a.size + b.size - k) }
    data class Arch(val id: String, val name: String, val size: Int, val trunk: Boolean)
    class Clusters(private val of: Map<String, Arch>, val count: Int) { fun of(key: String) = of[key] }
    fun clusterArchetypes(lists: List<MetaList>): Clusters {
        class C(val id: String, val core: Set<String>) { val tags = LinkedHashMap<String, Pair<String, Int>>(); var size = 0 }
        val clusters = ArrayList<C>(); val of = LinkedHashMap<String, Any>()
        for (l in lists) {
            if (l.trunk) { of[l.key] = Arch(l.key, l.name, 1, true); continue }
            val core = coreOf(l); val tag = label(l).lowercase()
            var best: C? = null; var score = 0.0
            for (c in clusters) { val j = jaccard(core, c.core); val s = if (j >= .5 || (tag.isNotEmpty() && tag in c.tags && j >= .25)) j + (if (tag in c.tags) .5 else 0.0) else 0.0
                if (s > score) { score = s; best = c } }
            val b = best ?: C("arch:" + clusters.size, core).also { clusters += it }
            b.size++
            if (tag.isNotEmpty()) b.tags[tag] = label(l) to ((b.tags[tag]?.second ?: 0) + 1)
            of[l.key] = b
        }
        val out = of.mapValues { (_, v) -> if (v is Arch) v else (v as C).let { c -> Arch(c.id, c.tags.values.sortedByDescending { it.second }.firstOrNull()?.first ?: "Deck", maxOf(1, c.size), false) } }
        return Clusters(out, clusters.size)
    }

    // ---- one row in full
    data class CardChip(val name: String, val qty: Int, val have: Int, val basic: Boolean, val rarity: String, val seal: String, val image: String, val art: String)
    data class Group(val label: String, val count: Int, val cards: List<CardChip>)
    data class Row(val status: String, val short: Map<String, Int>, val size: Int, val cardsHave: Int, val open: Int, val key: String, val name: String, val source: String,
                   val detail: String, val format: String, val commander: String, val colors: List<String>, val groups: List<Group>, val want: Int, val have: Int,
                   val share: Double, val shortfall: Shortfall, val complete: Boolean, val enough: Boolean, val cover: String, val list: MetaList)
    private val GROUPS = listOf("Creatures" to Regex("\\bCreature\\b"), "Planeswalkers" to Regex("\\bPlaneswalker\\b"), "Spells" to Regex("\\b(?:Instant|Sorcery)\\b"),
        "Permanents" to Regex("\\b(?:Artifact|Enchantment|Battle)\\b"), "Lands" to Regex("\\bLand\\b"))
    private fun typeOf(c: JsonObject?) = c?.get("type_line")?.asString ?: c?.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.get("type_line")?.asString ?: ""
    private fun groupOf(c: JsonObject?) = typeOf(c).split(" // ")[0].let { t -> GROUPS.firstOrNull { it.second.containsMatchIn(t) }?.first ?: "Other" }
    private fun img(c: JsonObject?, k: String) = c?.getAsJsonObject("image_uris")?.get(k)?.asString ?: c?.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")?.get(k)?.asString

    fun finderRow(l: MetaList, owned: Map<String, Int>, cardOf: (String) -> JsonObject?, seals: Map<String, Int>?, rarityOf: (String) -> String = { "" }): Row {
        val rows = mainRows(l); val rarity = HashMap<String, String>(); val colors = HashSet<String>(); val groups = LinkedHashMap<String, MutableList<CardChip>>()
        var want = 0; var have = 0
        for ((name, qty) in rows) {
            val card = cardOf(name); val basic = Decks.isBasicLand(name); val r = rarityOf(name).ifEmpty { null } ?: card?.get("rarity")?.asString ?: "common"
            rarity[name] = r
            val ids = card?.getAsJsonArray("color_identity")?.map { it.asString } ?: (if (basic) listOfNotNull(BASIC_COLOR[name]) else emptyList())
            for (k in ids) if (k != "C") colors += k
            val got = if (basic) qty else minOf(qty, ownedOf(owned, name))
            if (!basic) { want += qty; have += got }
            val g = if (basic) "Lands" else groupOf(card)
            groups.getOrPut(g) { ArrayList() } += CardChip(name, qty, got, basic, r, Decks.RARITY_SEAL[r] ?: "r", img(card, "small") ?: img(card, "normal") ?: "", img(card, "art_crop") ?: "")
        }
        val sh = shortfall(rows.map { it.key to it.value }, rows.keys.associateWith { ownedOf(owned, it) }, { rarity[it] }) { copyCap(it, l.format, cardOf(it)?.getAsJsonObject("legalities")) }
        val ordered = (GROUPS.map { it.first } + "Other").filter { it in groups }.map { g -> Group(g, groups.getValue(g).sumOf { it.qty },
            groups.getValue(g).sortedWith(compareBy<CardChip> { if (it.have >= it.qty) 0 else 1 }.thenBy { it.name })) }
        val lead = if (isSingleton(l.format)) cardOf(l.commander) else null
        val flat = ordered.flatMap { it.cards }
        val cover = img(lead, "art_crop") ?: flat.firstOrNull { !it.basic && it.art.isNotEmpty() && Regex("Creature|Planeswalker").containsMatchIn(typeOf(cardOf(it.name))) }?.art
            ?: flat.firstOrNull { it.art.isNotEmpty() }?.art ?: ""
        val st = deckStatus(sh, seals ?: emptyMap()); val enough = seals != null && st.status != "short"
        val basics = rows.filter { Decks.isBasicLand(it.key) }.values.sum(); val size = maxOf(want + basics, l.size ?: deckRules(l.format).size)
        val open = maxOf(0, size - want - basics)
        return Row(if (open > 0) "open" else st.status, st.short, size, have + basics, open, l.key, l.name.ifEmpty { "Deck" }, l.source, l.detail, l.format, l.commander,
            "WUBRG".map { it.toString() }.filter { it in colors }, ordered, want, have, (have + basics).toDouble() / size, sh, sh.complete && open == 0, enough, cover, l)
    }

    // ---- fast share by names, for ranking hundreds of lists before facts load
    data class Share(val have: Int, val size: Int, val share: Double, val complete: Boolean, val status: String? = null, val cost: Map<String, Int>? = null, val short: Map<String, Int>? = null)
    fun ownedShare(l: MetaList, owned: Map<String, Int>, rarityOf: ((String) -> String)? = null, seals: Map<String, Int>? = null): Share {
        val rows = mainRows(l); val cap = if (isSingleton(l.format)) 1 else 4
        var have = 0; var total = 0
        for ((name, q) in rows) { total += q; have += if (Decks.isBasicLand(name)) q else minOf(q, cap, ownedOf(owned, name)) }
        val size = maxOf(total, l.size ?: deckRules(l.format).size); val complete = have >= size
        val share = if (size > 0) have.toDouble() / size else 0.0
        if (rarityOf == null) return Share(have, size, share, complete)
        var pending = false
        val sh = shortfall(rows.map { it.key to it.value }, rows.keys.associateWith { ownedOf(owned, it) }, { n -> rarityOf(n).also { if (it.isEmpty()) pending = true } }) { cap }
        val st = deckStatus(sh, seals ?: emptyMap())
        return Share(have, size, share, complete, if (complete) "buildable" else if (pending && st.status != "buildable") "pending" else st.status, sh.seals, st.short)
    }

    data class Ranked(val list: MetaList, val order: Int, val pop: Int, val s: Share)
    private val RANK = mapOf("buildable" to 0, "craftable" to 1, "pending" to 2, "short" to 3)
    fun rankFinderLists(lists: List<MetaList>, owned: Map<String, Int>, sort: String = "owned", query: String = "", filter: String = "all",
                        rarityOf: ((String) -> String)? = null, seals: Map<String, Int>? = null, clusters: Clusters? = null): List<Ranked> {
        val q = query.trim().lowercase(); val only = if (sort == "ready") "trunk" else filter
        val seen = HashMap<String, Int>(); if (clusters == null) for (l in lists) { val a = label(l).lowercase(); seen[a] = (seen[a] ?: 0) + 1 }
        fun pop(l: MetaList) = clusters?.of(l.key)?.size ?: seen[label(l).lowercase()] ?: 0
        return lists.mapIndexed { i, l -> Ranked(l, i, pop(l), ownedShare(l, owned, rarityOf, seals)) }
            .filter { x -> q.isEmpty() || x.list.trunk || x.list.name.lowercase().contains(q) || label(x.list).lowercase().contains(q) || x.list.cards.any { it.name.lowercase().contains(q) } }
            .filter { x -> when (only) { "trunk" -> x.s.complete; "craftable" -> x.s.complete || x.s.status == "craftable"; else -> true } }
            .sortedWith(compareBy<Ranked> { if (it.list.trunk) 0 else 1 }
                .thenBy { if (only == "craftable") RANK[it.s.status] ?: 3 else 0 }
                .thenByDescending { if (sort == "popular") it.pop else 0 }
                .thenByDescending { it.s.share }.thenBy { it.order })
    }
    data class Archetype(val id: String, val name: String, val size: Int, val lead: Ranked, val variants: MutableList<Ranked> = ArrayList())
    fun finderArchetypes(ranked: List<Ranked>, clusters: Clusters?): List<Archetype> {
        val out = ArrayList<Archetype>(); val by = HashMap<String, Archetype>()
        for (x in ranked) {
            val c = clusters?.of(x.list.key) ?: Arch(x.list.key, label(x.list).ifEmpty { "Deck" }, 1, x.list.trunk)
            val a = by[c.id]; if (a == null) Archetype(c.id, if (c.trunk) x.list.name else c.name, c.size, x).also { by[c.id] = it; out += it } else a.variants += x
        }
        return out
    }
}
