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

    val PLAY_FORMATS = listOf("Standard", "Pioneer", "Modern", "Legacy", "Vintage", "Pauper", "Commander")
    private val BASICS = Regex("^(?:plains|island|swamp|mountain|forest|wastes|snow-covered (?:plains|island|swamp|mountain|forest))$", RegexOption.IGNORE_CASE)
    fun isBasicLand(name: String?) = BASICS.matches((name ?: "").trim())
    private fun rarityOf(r: String?) = when (r) { "common", "uncommon", "rare", "mythic" -> r; "special" -> "rare"; "bonus" -> "mythic"; else -> "common" }
    val RARITY_SEAL = mapOf("common" to "c", "uncommon" to "u", "rare" to "r", "mythic" to "m", "special" to "r", "bonus" to "m")

    fun deckRules(format: String?) = if (format == "Commander") Rules(100, 1, true) else Rules(60, 4, false)

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

    fun preconPrice(missing: Int, config: JsonObject?): Int {
        val p = config?.getAsJsonObject("precon")
        fun n(k: String, d: Int) = p?.get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: d
        return if (missing <= 0) 0 else maxOf(n("min", 250), minOf(n("max", 1500), missing * n("perCard", 25)))
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

    fun preconIndex(json: JsonObject): List<PreconEntry> = (json.getAsJsonArray("data")?.mapNotNull { it as? JsonObject } ?: emptyList())
        .filter { it.s("type") in CONSTRUCTED_PRECON_TYPES && it.get("name")?.isJsonPrimitive == true && Regex("^[A-Za-z0-9_.-]+$").matches(it.s("fileName")) }
        .map { PreconEntry(it.s("name"), it.s("code"), it.s("type"), it.s("releaseDate"), it.s("fileName")) }
        .sortedWith(compareByDescending<PreconEntry> { it.releaseDate }.thenBy { it.name })

    fun mtgjsonDeckRows(d: JsonObject): List<Row> {
        fun row(c: JsonObject, board: String?) = Row(c.s("name"), maxOf(1, c.get("count")?.asInt ?: 0), board, c.s("setCode").lowercase(), c.s("number"),
            c.getAsJsonObject("identifiers")?.s("scryfallId") ?: "", rarityOf(c.s("rarity")))
        return ((d.getAsJsonArray("mainBoard")?.map { row(it.asJsonObject, null) } ?: emptyList()) + (d.getAsJsonArray("sideBoard")?.map { row(it.asJsonObject, "side") } ?: emptyList())).filter { it.name.isNotEmpty() }
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
