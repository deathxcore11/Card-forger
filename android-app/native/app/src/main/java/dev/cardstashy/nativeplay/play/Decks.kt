package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject

/**
 * Play deck rules from play-econ-rules.js and play-precon-formats.js, line for line: deckRules,
 * deckShortfall, preconPrice, legalFormats, mtgjsonDeckRows, constructedPrecon, plus the Paste a
 * list reader of app.js (playEconCheckDeck) and the numbers on a Play deck tile (playDeckTile).
 * Proven against the web's own answers in DecksTest (scripts/export-deck-golden.mjs).
 */
object Decks {
    data class Row(val name: String, val qty: Int, val board: String? = null, val set: String = "", val number: String = "", val id: String = "", val rarity: String = "")
    data class Rules(val size: Int, val copies: Int, val exact: Boolean)
    data class Missing(val name: String, val need: Int, val rarity: String, val seal: String)
    data class Shortfall(val missing: List<Missing>, val seals: Map<String, Int>, val complete: Boolean) { val total get() = missing.sumOf { it.need } }

    val PLAY_FORMATS = listOf("Standard", "Pioneer", "Modern", "Legacy", "Vintage", "Pauper", "Commander", "Standard Brawl")
    private val BASICS = Regex("^(?:plains|island|swamp|mountain|forest|wastes|snow-covered (?:plains|island|swamp|mountain|forest))$", RegexOption.IGNORE_CASE)
    fun isBasicLand(name: String?) = BASICS.matches((name ?: "").trim())
    private fun rarityOf(r: String?) = when (r) { "common", "uncommon", "rare", "mythic" -> r; "special" -> "rare"; "bonus" -> "mythic"; else -> "common" }
    val RARITY_SEAL = mapOf("common" to "c", "uncommon" to "u", "rare" to "r", "mythic" to "m", "special" to "r", "bonus" to "m")

    /** deckRules: the singleton formats (Commander 100, Standard Brawl 60) are exact at one copy; the rest 60+ at four. */
    fun deckRules(format: String?) = Finder.deckRules(format).let { Rules(it.size, it.copies, it.exact) }

    fun shortfall(deck: List<Row>, owned: Map<String, Int>, rarity: Map<String, String> = emptyMap(), maxCopies: Int = 4): Shortfall {
        val want = LinkedHashMap<String, Int>()
        for (r in deck) if (r.name.isNotEmpty() && !isBasicLand(r.name)) want[r.name] = (want[r.name] ?: 0) + maxOf(1, r.qty)
        val missing = ArrayList<Missing>(); val seals = linkedMapOf("c" to 0, "u" to 0, "r" to 0, "m" to 0)
        for ((name, qty) in want) {
            val need = minOf(qty, maxCopies) - (owned[name] ?: 0)
            if (need <= 0) continue
            val r = rarityOf(rarity[name]); val seal = RARITY_SEAL.getValue(r)
            missing += Missing(name, need, r, seal); seals[seal] = seals.getValue(seal) + need
        }
        return Shortfall(missing, seals, missing.isEmpty())
    }

    /**
     * preconPrice: only the cards you don't own yet, priced by rarity (Randall 5 Nov 18:05Z). [missing] is a count at the
     * flat perCard rate or deckShortfall's seals {c,u,r,m} at play.config precon.perRarity (PRECON_RATES by default).
     * Minimum 250, no cap; a deck you own entirely is free.
     */
    val PRECON_RATES = mapOf("c" to 25, "u" to 75, "r" to 500, "m" to 1500)
    private fun preconTotal(total: Int, config: JsonObject?): Int {
        val p = config?.getAsJsonObject("precon")
        val min = p?.get("min")?.takeIf { it.isJsonPrimitive }?.asInt ?: 250
        return if (total <= 0) 0 else maxOf(min, total)
    }
    fun preconPrice(missing: Int, config: JsonObject?): Int {
        val per = config?.getAsJsonObject("precon")?.get("perCard")?.takeIf { it.isJsonPrimitive }?.asInt ?: 25
        return preconTotal(missing * per, config)
    }
    fun preconPrice(seals: Map<String, Int>, config: JsonObject?): Int {
        val custom = config?.getAsJsonObject("precon")?.getAsJsonObject("perRarity")
        val rates = PRECON_RATES.mapValues { (k, v) -> custom?.get(k)?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: v }
        return preconTotal(listOf("c", "u", "r", "m").sumOf { (seals[it] ?: 0) * (rates[it] ?: 0) }, config)
    }

    /**
     * preconQuote (play-econ-rules.js, site PR #130, Randall 5 Nov 20:12Z "half-scale ladder"): 1 pack = 500 coins = $5. Each
     * product class has a list price (play.config precon.list: pauper 1,500, standard 2,500, brawl 3,000, modern 3,500, commander
     * 5,000, legacy 7,500); a player pays it times the share of the deck's value they don't own yet, the value weighing common 1,
     * uncommon 3, rare 20, mythic 60 and basic lands nothing. At least precon.min (250), rounded to 5; a deck owned entirely is free.
     * [type] and [released]: the DeckList entry's MTGJSON deck type and release date (preconClass); [cap]: copies per card (a Commander deck's 1).
     */
    val PRECON_LIST = mapOf("pauper" to 1500, "standard" to 2500, "brawl" to 3000, "modern" to 3500, "commander" to 5000, "legacy" to 7500)
    /** MTGJSON deck type to class; anything not listed is classed by its cards and release date. */
    val PRECON_TYPE_CLASS = mapOf("Commander Deck" to "commander", "Brawl Deck" to "brawl", "Starter Kit" to "standard", "Arena Starter Kit" to "standard",
        "Intro Pack" to "standard", "Welcome Deck" to "standard", "Clash Pack" to "standard", "Masters Deck" to "legacy", "From the Vault" to "legacy", "Premium Deck" to "legacy")
    /** Release-date eras for the rest (a date opens its class): Standard is the last three years. */
    val PRECON_ERAS = mapOf("modern" to "2012-10-05", "legacy" to "1900-01-01")
    val PRECON_VALUE = mapOf("c" to 1, "u" to 3, "r" to 20, "m" to 60)
    private fun JsonObject?.strings(vararg path: String): Map<String, String> {
        var o: JsonObject? = this
        for (k in path) o = o?.get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        return o?.entrySet()?.mapNotNull { (k, v) -> v.takeIf { it.isJsonPrimitive }?.let { k to it.asString } }?.toMap().orEmpty()
    }
    /** preconClass: the type's class (precon.types over PRECON_TYPE_CLASS), else no rare or mythic card = pauper, else by release era. */
    fun preconClass(type: String, rows: List<Row>, released: String, config: JsonObject?, now: Long = System.currentTimeMillis()): String {
        (PRECON_TYPE_CLASS + config.strings("precon", "types"))[type]?.let { return it }
        val cards = rows.filter { it.name.isNotEmpty() && !isBasicLand(it.name) }
        if (cards.isNotEmpty() && cards.all { rarityOf(it.rarity) == "common" || rarityOf(it.rarity) == "uncommon" }) return "pauper"
        val eras = PRECON_ERAS + config.strings("precon", "eras")
        val std = java.time.Instant.ofEpochMilli(now - 3L * 366 * 86_400_000).toString().take(10)
        return if (released.isEmpty() || released >= std) "standard" else if (released >= eras.getValue("modern")) "modern" else "legacy"
    }
    fun preconListPrice(cls: String, config: JsonObject?): Int {
        val v = config?.getAsJsonObject("precon")?.getAsJsonObject("list")?.get(cls)?.takeIf { it.isJsonPrimitive }?.let { runCatching { it.asDouble }.getOrNull() }
            ?: PRECON_LIST[cls]?.toDouble()
        return if (v == null || v.isNaN() || v == 0.0) PRECON_LIST.getValue("standard") else v.toInt()
    }
    data class Quote(val price: Int, val missing: Int, val share: Double, val short: Shortfall, val cls: String)
    fun preconQuote(rows: List<Row>, owned: Map<String, Int>, type: String, config: JsonObject?, cap: Int = 4, released: String = "", now: Long = System.currentTimeMillis()): Quote {
        val rarity = rows.associate { it.name to it.rarity }
        val short = shortfall(rows, owned, rarity, cap)
        fun w(r: String?) = PRECON_VALUE[RARITY_SEAL[rarityOf(r)]] ?: 1
        val want = LinkedHashMap<String, Int>()
        for (r in rows) if (r.name.isNotEmpty() && !isBasicLand(r.name)) want[r.name] = (want[r.name] ?: 0) + maxOf(1, r.qty)
        var total = 0; for ((name, qty) in want) total += minOf(qty, cap) * w(rarity[name])
        val miss = short.missing.sumOf { it.need * w(it.rarity) }
        val share = if (total > 0) minOf(1.0, miss.toDouble() / total) else 0.0
        val min = config?.getAsJsonObject("precon")?.get("min")?.takeIf { it.isJsonPrimitive }?.asInt ?: 250
        val cls = preconClass(type, rows, released, config, now)
        val price = if (miss <= 0) 0 else maxOf(min, (Math.round(preconListPrice(cls, config) * share / 5) * 5).toInt())
        return Quote(price, short.total, share, short, cls)
    }

    /** legalFormats: every card legal (Vintage allows restricted at one copy) and the deck rules met. */
    fun legalFormats(rows: List<Row>, legal: Map<String, Map<String, String>>): List<String> {
        val main = rows.filter { it.board != "side" }; val size = main.sumOf { it.qty }
        val copies = LinkedHashMap<String, Int>(); for (r in rows) copies[r.name] = (copies[r.name] ?: 0) + r.qty
        return PLAY_FORMATS.filter { f ->
            val key = f.lowercase(); val rule = deckRules(f)
            if (if (rule.exact) size != rule.size else size < rule.size) return@filter false
            for ((name, n) in copies) {
                val l = legal[name]?.get(key) ?: return@filter false
                if (if (l == "restricted") n > 1 else l != "legal") return@filter false
                if (!isBasicLand(name) && n > rule.copies) return@filter false
            }
            true
        }
    }

    /** playEconCheckDeck's reader: "4 Lightning Bolt (SET) 123" lines; a Sideboard line starts the sideboard. */
    fun parsePaste(text: String): List<Row> {
        val rows = ArrayList<Row>(); var board: String? = null
        val side = Regex("^(?:(?://)\\s*)?side\\s*board:?$", RegexOption.IGNORE_CASE)
        val skip = Regex("^(?:deck|main\\s*deck|mainboard|companion|commander):?$", RegexOption.IGNORE_CASE)
        val card = Regex("^(\\d+)x?\\s+(.+?)(?:\\s+\\([A-Za-z0-9]{2,8}\\)\\s*\\S*)?$")
        for (raw in text.split(Regex("\\r?\\n"))) {
            val line = raw.trim()
            if (side.matches(line)) { board = "side"; continue }
            if (skip.matches(line)) continue
            card.find(line)?.takeIf { it.range.first == 0 && it.range.last == line.length - 1 }?.let { m ->
                rows += Row(m.groupValues[2].trim(), minOf(250, m.groupValues[1].toInt()), board) }
        }
        return rows
    }

    fun ownedByName(state: JsonObject?): Map<String, Int> = Trunk.byName(Trunk.cards(state))

    fun rows(deck: JsonObject): List<Row> = deck.getAsJsonArray("cards")?.mapNotNull { e -> val o = e as? JsonObject ?: return@mapNotNull null
        Row(o.s("name"), o.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 0, o.s("board").ifBlank { null }, o.s("set"), o.s("number"), o.s("id"), o.s("rarity")) } ?: emptyList()

    /** The numbers on playDeckTile: main count of size, sideboard, share in the Trunk, cards to stamp. */
    data class Tile(val main: Int, val size: Int, val side: Int, val share: Double, val missing: Int)
    fun tile(deck: JsonObject, owned: Map<String, Int>): Tile {
        val rows = rows(deck); val main = rows.filter { it.board != "side" }; val side = rows.filter { it.board == "side" }
        val sh = shortfall(rows, owned); val want = rows.filter { !isBasicLand(it.name) }.sumOf { it.qty }
        val missing = sh.total
        return Tile(main.sumOf { it.qty }, deckRules(deck.s("format")).size, side.sumOf { it.qty }, if (want > 0) (want - missing).toDouble() / want else 1.0, missing)
    }

    /** deckCover: the first non-basic card in the deck (else the first), its exact printing's art. */
    fun cover(deck: JsonObject): String {
        val all = deck.getAsJsonArray("cards")?.mapNotNull { it as? JsonObject } ?: emptyList()
        val lead = all.firstOrNull { it.s("board") != "side" && !isBasicLand(it.s("name")) } ?: all.firstOrNull() ?: return ""
        val id = lead.s("id")
        return if (Regex("^[0-9a-f-]{36}$", RegexOption.IGNORE_CASE).matches(id)) "https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/$id.jpg"
        else "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=" + java.net.URLEncoder.encode(lead.s("name"), "UTF-8").replace("+", "%20")
    }

    fun scryfallImage(id: String) = if (Regex("^[0-9a-f-]{36}$", RegexOption.IGNORE_CASE).matches(id)) "https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/$id.jpg" else ""

    // ---------------------------------------------------------------- precons (MTGJSON)

    val CONSTRUCTED_PRECON_TYPES = listOf("Theme Deck", "Starter Kit", "Challenger Deck", "Pioneer Challenger Deck", "Planeswalker Deck", "Game Night Deck", "Arena Starter Kit", "Event Deck", "Duel Deck", "Clash Pack", "Intro Pack")
    data class PreconEntry(val name: String, val code: String, val type: String, val releaseDate: String, val fileName: String)

    fun preconIndex(json: JsonObject): List<PreconEntry> = deckList(json, CONSTRUCTED_PRECON_TYPES)
    /** MTGJSON's Commander decks (play-precon-formats.js COMMANDER_PRECON_TYPE): sold whole only from the weekly store. */
    const val COMMANDER_PRECON_TYPE = "Commander Deck"
    fun commanderPreconIndex(json: JsonObject): List<PreconEntry> = deckList(json, listOf(COMMANDER_PRECON_TYPE))
    private fun deckList(json: JsonObject, types: List<String>) = (json.getAsJsonArray("data")?.mapNotNull { it as? JsonObject } ?: emptyList())
        .filter { it.s("type") in types && it.get("name")?.isJsonPrimitive == true && Regex("^[A-Za-z0-9_.-]+$").matches(it.s("fileName")) }
        .map { PreconEntry(it.s("name"), it.s("code"), it.s("type"), it.s("releaseDate"), it.s("fileName")) }
        .sortedWith(compareByDescending<PreconEntry> { it.releaseDate }.thenBy { it.name })

    fun mtgjsonDeckRows(d: JsonObject): List<Row> {
        fun row(c: JsonObject, board: String?) = Row(c.s("name"), maxOf(1, c.get("count")?.asInt ?: 0), board, c.s("setCode").lowercase(), c.s("number"),
            c.getAsJsonObject("identifiers")?.s("scryfallId") ?: "", rarityOf(c.s("rarity")))
        return ((d.getAsJsonArray("mainBoard")?.map { row(it.asJsonObject, null) } ?: emptyList()) + (d.getAsJsonArray("sideBoard")?.map { row(it.asJsonObject, "side") } ?: emptyList())).filter { it.name.isNotEmpty() }
    }

    /**
     * The precon route's rows (play-econ-route.js 'precon'): a Commander deck's commander zone first, one copy each with
     * board "commander", then mtgjsonDeckRows (the 99, or a constructed deck's main and side).
     */
    fun preconRows(d: JsonObject): List<Row> {
        val cmd = d.getAsJsonArray("commander")?.mapNotNull { it as? JsonObject }.orEmpty().map { c ->
            Row(c.s("name"), 1, "commander", c.s("setCode").lowercase(), c.s("number"), c.getAsJsonObject("identifiers")?.s("scryfallId") ?: "", rarityOf(c.s("rarity"))) }
        return cmd.filter { it.name.isNotEmpty() } + mtgjsonDeckRows(d)
    }
    fun isCommanderPrecon(d: JsonObject) = (d.getAsJsonArray("commander")?.size() ?: 0) > 0
    /** A Commander deck is saved as Commander (the route's p_format); a constructed one plays where constructedPrecon allows. */
    fun preconFormatsAny(payload: JsonObject): List<String>? = (payload.getAsJsonObject("data") ?: payload).let { d -> if (isCommanderPrecon(d)) listOf("Commander") else preconFormats(payload) }
    /** deckShortfall's copy cap on the route: a Commander deck is singleton, one copy of each card. */
    fun preconCopies(rows: List<Row>) = if (rows.any { it.board == "commander" }) 1 else 4

    /**
     * preconFace (play-econ-rules.js): the card a precon tile shows, as (name, Scryfall id). The commander when there
     * is one, else the weightiest nonland spell: planeswalkers, then creatures, then rarity, mana value and foil, less
     * a point per copy (so a one-of lead beats a four-of).
     */
    fun preconFace(d: JsonObject): Pair<String, String>? {
        fun pick(c: JsonObject?): Pair<String, String>? = c?.getAsJsonObject("identifiers")?.s("scryfallId")?.ifEmpty { null }?.let { c.s("name") to it }
        pick(d.getAsJsonArray("commander")?.firstOrNull() as? JsonObject)?.let { return it }
        fun strings(c: JsonObject, k: String) = c.getAsJsonArray(k)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()
        fun num(c: JsonObject, k: String) = c.get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble?.toInt() ?: 0
        fun weight(c: JsonObject): Int { val types = strings(c, "types"); val r = when (c.s("rarity")) { "mythic" -> 3; "rare" -> 2; "uncommon" -> 1; else -> 0 }
            return (if ("Planeswalker" in types) 40 else if ("Creature" in types) 20 else 0) + r * 12 + minOf(10, num(c, "manaValue")) +
                (if (c.get("isFoil")?.takeIf { it.isJsonPrimitive }?.asBoolean == true) 2 else 0) - minOf(4, num(c, "count")) }
        val pool = (d.getAsJsonArray("mainBoard") ?: return null).mapNotNull { it as? JsonObject }
            .filter { it.getAsJsonObject("identifiers")?.s("scryfallId")?.isNotEmpty() == true && "Basic" !in strings(it, "supertypes") && "Land" !in strings(it, "types") }
        return pick(pool.sortedByDescending(::weight).firstOrNull())
    }

    private val PRECON_FORMATS = listOf("Standard" to "standard", "Pioneer" to "pioneer", "Modern" to "modern", "Legacy" to "legacy", "Vintage" to "vintage", "Pauper" to "pauper")
    /** constructedPrecon(payload, entry).formats, or null when it isn't playable as published. */
    fun preconFormats(payload: JsonObject): List<String>? {
        val d = payload.getAsJsonObject("data") ?: payload
        val mb = d.getAsJsonArray("mainBoard") ?: return null
        if ((d.getAsJsonArray("commander")?.size() ?: 0) > 0) return null
        fun ok(e: com.google.gson.JsonElement) = (e as? JsonObject)?.let { it.get("name")?.isJsonPrimitive == true && (it.get("count")?.asDouble ?: 0.0).let { n -> n > 0 && n == Math.floor(n) } } == true
        val main = mb.filter(::ok).map { it.asJsonObject }; val sb = d.getAsJsonArray("sideBoard"); val side = sb?.filter(::ok)?.map { it.asJsonObject } ?: emptyList()
        if (main.size != mb.size() || side.size != (sb?.size() ?: 0)) return null
        val mainCount = main.sumOf { it.get("count").asInt }; val sideCount = side.sumOf { it.get("count").asInt }
        if (mainCount < 60 || sideCount > 15) return null
        val copies = LinkedHashMap<String, Int>(); for (c in main + side) copies[c.s("name")] = (copies[c.s("name")] ?: 0) + c.get("count").asInt
        fun unlimited(c: JsonObject) = c.getAsJsonArray("supertypes")?.any { it.asString == "Basic" } == true || Regex("any number of cards named", RegexOption.IGNORE_CASE).containsMatchIn(c.s("text"))
        val formats = PRECON_FORMATS.filter { (_, key) -> (main + side).all { it.getAsJsonObject("legalities")?.s(key) == "Legal" } && (main + side).all { unlimited(it) || (copies[it.s("name")] ?: 0) <= 4 } }.map { it.first }
        return formats.ifEmpty { null }
    }

    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
}
