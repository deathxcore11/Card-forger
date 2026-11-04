package dev.cardstashy.nativeplay.play

import java.text.Normalizer

/**
 * play-deck-import.js parsePlayDeckImport, line for line: best-effort text and CSV deck import, no card database or
 * network. [Result.cards] holds main-deck cards and declared commanders, [Result.side] the sideboard; maybeboard rows
 * stay in [Result.excludedCards]. Errors and warnings carry the site's codes and texts. No quantity is clamped.
 *
 * The site also hands the normalized text to the shared Collection parser (parseDeckImport), which only adds fields to
 * rows it recognises and never drops or changes a card; this port keeps the play-deck-import rows as they are.
 */
object PlayDeckImport {
    const val INPUT_CHARS = 250000; const val ROWS = 2000; const val LINE_CHARS = 2000; const val QUANTITY = 1000; const val COPIES = 10000

    data class Problem(val line: Int, val code: String, val reason: String, val raw: List<String>, val fatal: Boolean = false)
    data class Row(val name: String, val qty: Int, var section: String, val line: Int, val block: Int = 0, val category: String? = null,
                   val set: String = "", val collectorNumber: String = "", val finish: String = "nonfoil")
    data class Card(val name: String, var qty: Int)
    class Category(val name: String, val section: String, val line: Int, val declaredCount: Int?, var actualCount: Int = 0)
    class Result {
        var source = "Play deck text"; var rows: List<Row> = emptyList(); var cards: List<Card> = emptyList(); var side: List<Card> = emptyList()
        var commanders: List<Card> = emptyList(); var commander = ""; var excludedCards: List<Card> = emptyList(); var excluded = 0
        val errors = ArrayList<Problem>(); val warnings = ArrayList<Problem>(); val categories = ArrayList<Category>()
        var total = 0; var sideTotal = 0; var normalizedText = ""; val categoryCounts = LinkedHashMap<String, Int>()
        var unresolved: List<Row> = emptyList()
    }

    fun key(value: String) = Normalizer.normalize(value, Normalizer.Form.NFKC).replace(Regex("[’‘]"), "'").replace(Regex("\\s+"), " ").trim().lowercase()
    private fun sum(rows: List<Row>) = rows.sumOf { it.qty }
    private fun problem(line: Int, code: String, reason: String, raw: Any, fatal: Boolean = false) =
        Problem(line, code, reason, if (raw is List<*>) raw.map { it.toString() } else listOf(raw.toString()), fatal)

    private val zones = linkedMapOf("commander" to "commander", "commanders" to "commander", "deck" to "main", "decklist" to "main", "mainboard" to "main",
        "main board" to "main", "main deck" to "main", "maindeck" to "main", "sideboard" to "side", "side board" to "side",
        "companion" to "side", "companions" to "side", "maybeboard" to "excluded", "maybe board" to "excluded", "considering" to "excluded")
    private val categories = linkedMapOf("creature" to "Creatures", "creatures" to "Creatures", "artifact" to "Artifacts", "artifacts" to "Artifacts",
        "instant" to "Instants", "instants" to "Instants", "sorcery" to "Sorceries", "sorceries" to "Sorceries", "enchantment" to "Enchantments",
        "enchantments" to "Enchantments", "land" to "Lands", "lands" to "Lands", "planeswalker" to "Planeswalkers", "planeswalkers" to "Planeswalkers",
        "battle" to "Battles", "battles" to "Battles")
    private val zoneHeading = mapOf("main" to "Deck", "commander" to "Commander", "side" to "Sideboard", "excluded" to "Maybeboard")

    private class Heading(val label: String, val section: String?, val category: String?, val declared: Long?)

    private fun heading(raw: String): Heading? {
        var value = raw.trim().replace(Regex("^(?:#{1,6}\\s*|//\\s*)"), "").replace(Regex("\\*\\*|__"), "").trim().replace(Regex(":\\s*$"), "").trim()
        if (value.startsWith("[") && value.endsWith("]")) value = value.substring(1, value.length - 1).trim()
        val m = Regex("^(.+?)(?:\\s*[:—–-]?\\s*(?:\\((\\d+)(?:\\s+cards?)?\\)|\\[(\\d+)\\]|(\\d+)(?:\\s+cards?)?))?\\s*:?$", RegexOption.IGNORE_CASE).find(value) ?: return null
        val label = key(m.groupValues[1].replace(Regex("^\\[|\\]$"), "").trim())
        if (label !in zones && label !in categories) return null
        val count = listOf(2, 3, 4).map { m.groups[it]?.value }.firstOrNull { it != null }
        return Heading(label, zones[label], categories[label], count?.toBigInteger()?.let { if (it > Long.MAX_VALUE.toBigInteger()) Long.MAX_VALUE else it.toLong() })
    }

    private fun aggregate(rows: List<Row>): List<Card> {
        val result = LinkedHashMap<String, Card>()
        for (row in rows) { val id = key(row.name); result[id]?.let { it.qty += row.qty } ?: run { result[id] = Card(row.name, row.qty) } }
        return result.values.toList()
    }

    private class Parsed(val name: String = "", val qty: Int = 0, val set: String = "", val collectorNumber: String = "", val finish: String = "nonfoil", val error: String? = null)

    private fun cardText(raw: String): Parsed {
        var value = raw.trim(); var qty = 1
        if (Regex("^\\d+\\s*[xX]?\\s*$").matches(value)) return Parsed(error = "Missing card name")
        if (Regex("^(?:[+-]\\d|\\.\\d|\\d+\\.(?:\\d|\\s|$)|\\d+[eE][+-]?\\d)").containsMatchIn(value)) return Parsed(error = "Quantity must be a positive whole number")
        // Also accepts compact clipboard forms such as 1Sol Ring, 1xSol Ring, 1 xSol Ring.
        val quantity = Regex("^(\\d+)(?:\\s*[xX]\\s*|\\s+|(?=[^\\d\\s]))(.+)$").find(value)
        if (quantity != null) {
            val n = quantity.groupValues[1].toBigInteger()
            qty = if (n > QUANTITY.toBigInteger()) -1 else n.toInt()
            value = quantity.groupValues[2].trim()
        } else if (Regex("^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?(?:\\s*[xX])?(?:\\s+|$)", RegexOption.IGNORE_CASE).containsMatchIn(value)) {
            return Parsed(error = "Quantity must be a positive whole number")
        }
        if (qty < 1 || qty > QUANTITY) return Parsed(error = "Quantity must be between 1 and $QUANTITY")
        value = value.replace(Regex("\\s+\\[[^\\]\\r\\n]+\\]\\s*$"), "").trim()
        val finish = if (Regex("\\s+\\*F\\*\\s*$", RegexOption.IGNORE_CASE).containsMatchIn(value)) "foil" else "nonfoil"
        value = value.replace(Regex("\\s+\\*F\\*\\s*$", RegexOption.IGNORE_CASE), "").trim()
        val printing = Regex("^(.*?)\\s+\\(([a-z0-9]{2,10})\\)\\s+([a-z0-9][a-z0-9/★-]*)$", RegexOption.IGNORE_CASE).find(value)
        if (printing != null) value = printing.groupValues[1].trim()
        if (value.isEmpty()) return Parsed(error = "Missing card name")
        return Parsed(value, qty, printing?.groupValues?.get(2) ?: "", printing?.groupValues?.get(3) ?: "", finish)
    }

    private fun addRow(rows: MutableList<Row>, candidate: Row, result: Result, raw: Any): Boolean {
        if (candidate.name.isEmpty() || candidate.qty < 1 || candidate.qty > QUANTITY) {
            result.errors += problem(candidate.line, "invalid_quantity", "Invalid card name or quantity", raw); return false }
        if (sum(rows) + candidate.qty > COPIES) { result.errors += problem(candidate.line, "copy_limit", "Import exceeds $COPIES copies", raw); return false }
        fun deck(s: String) = if (s == "commander") "main" else s
        val copies = rows.filter { deck(it.section) == deck(candidate.section) && key(it.name) == key(candidate.name) }.sumOf { it.qty } + candidate.qty
        if (copies > QUANTITY) { result.errors += problem(candidate.line, "card_copy_limit", "Combined quantity for ${candidate.name} exceeds $QUANTITY", raw); return false }
        rows += candidate; return true
    }

    private val META = Regex("^(?:name|deck name|title|author|created by|by|format|description|deck url|url|source|exported(?: from| at| on)?|updated(?: at| on)?|last updated|total(?: cards)?|price|estimated (?:price|value)|budget|views|likes|favorites|tags)\\s*:", RegexOption.IGNORE_CASE)
    private val EXPORT = Regex("^(?:copy (?:deck|decklist|to clipboard)|export(?: deck| decklist)?|download decklist)$", RegexOption.IGNORE_CASE)

    private fun parseText(raw: String, result: Result): MutableList<Row> {
        var section = "main"; var activeCategory: Category? = null; var block = 0; var hadBlank = false; var explicitZone = false
        val rows = ArrayList<Row>(); val normalized = ArrayList<String>()
        for ((index, original) in raw.split("\n").withIndex()) {
            val line = index + 1; val value = original.trim().replace(Regex("^[-*]\\s+"), "")
            if (value.isEmpty()) { normalized += ""; hadBlank = rows.isNotEmpty(); continue }
            if (hadBlank) { block++; hadBlank = false }
            val title = heading(value)
            if (title != null) {
                if (title.section != null) { section = title.section; activeCategory = null; explicitZone = true; normalized += zoneHeading[section]!! }
                if (title.category != null) {
                    // Site exports commonly put card-type categories immediately after the commander block.
                    if (section == "commander") { section = "main"; normalized += zoneHeading["main"]!! }
                    activeCategory = Category(title.category, section, line, title.declared?.takeIf { it <= Int.MAX_VALUE }?.toInt() ?: title.declared?.let { -1 })
                    result.categories += activeCategory
                }
                if (title.declared != null && title.declared > COPIES) result.warnings += problem(line, "invalid_header_count", "Header count is outside import limits", original)
                continue
            }
            if (Regex("^(?:https?://|www\\.)\\S+$", RegexOption.IGNORE_CASE).matches(value) || Regex("^(?:#|//)").containsMatchIn(value) ||
                META.containsMatchIn(value) || EXPORT.matches(value)) {
                result.warnings += problem(line, "ignored_metadata", "Ignored deck metadata or comment", original); continue }
            val prefix = Regex("^(SB|commander|commanders|companion)\\s*:\\s*(.*)$", RegexOption.IGNORE_CASE).find(value)
            val rowSection = if (prefix != null) (if (prefix.groupValues[1].lowercase().startsWith("command")) "commander" else "side") else section
            if (prefix != null) explicitZone = true
            val parsed = cardText(prefix?.groupValues?.get(2) ?: value)
            if (parsed.error != null) { result.errors += problem(line, "invalid_card_row", parsed.error, original); continue }
            val entry = Row(parsed.name, parsed.qty, rowSection, line, block, if (prefix == null) activeCategory?.name else null, parsed.set, parsed.collectorNumber, parsed.finish)
            if (!addRow(rows, entry, result, original)) continue
            if (prefix == null && activeCategory != null) activeCategory.actualCount += entry.qty
            if (prefix != null) normalized += zoneHeading[rowSection]!!
            normalized += "${entry.qty} ${entry.name}" + (if (entry.set.isNotEmpty()) " (${entry.set}) ${entry.collectorNumber}" else "") + (if (entry.finish == "foil") " *F*" else "")
            if (prefix != null) normalized += zoneHeading[section]!!
        }
        // Same narrow MTGO rule as parseDeckImport: two blocks, >=40 main copies, then 1..15 side copies, no explicit zones or categories.
        val groups = rows.map { it.block }.distinct()
        if (!explicitZone && rows.none { it.category != null } && groups.size == 2 && sum(rows.filter { it.block == groups[0] }) >= 40) {
            val last = rows.filter { it.block == groups[1] }
            if (sum(last) in 1..15) last.forEach { it.section = "side" }
        }
        result.normalizedText = normalized.joinToString("\n").trim()
        return rows
    }

    private fun csvRecords(text: String): List<List<String>> {
        val records = ArrayList<List<String>>(); var cells = ArrayList<String>(); val cell = StringBuilder(); var quoted = false
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (c == '"') { if (quoted && i + 1 < text.length && text[i + 1] == '"') { cell.append('"'); i++ } else quoted = !quoted }
            else if (c == ',' && !quoted) { cells += cell.toString(); cell.clear() }
            else if (c == '\n' && !quoted) { cells += cell.toString(); if (cells.any { it.isNotBlank() }) records += cells; cells = ArrayList(); cell.clear() }
            else cell.append(c)
            i++
        }
        if (quoted) throw IllegalArgumentException("The CSV has an unclosed quoted field.")
        cells += cell.toString(); if (cells.any { it.isNotBlank() }) records += cells
        return records
    }

    private fun parseCsv(raw: String, result: Result): MutableList<Row> {
        val records = try { csvRecords(raw) } catch (e: IllegalArgumentException) { result.errors += problem(0, "invalid_csv", e.message ?: "", "", true); return ArrayList() }
        val headers = records.firstOrNull() ?: emptyList(); val labels = headers.map(::key)
        val nameIndex = labels.indexOfFirst { it in listOf("name", "card name", "card") }
        val qtyIndex = labels.indexOfFirst { it in listOf("quantity", "qty", "count") }
        val zoneIndex = labels.indexOfFirst { it in listOf("board", "section", "zone") }
        val rows = ArrayList<Row>(); val accepted = ArrayList<List<String>>()
        for ((index, cells) in records.drop(1).withIndex()) {
            val line = index + 2; val name = cells.getOrNull(nameIndex)?.trim() ?: ""
            val token = if (qtyIndex < 0 || cells.getOrNull(qtyIndex).isNullOrBlank()) "1" else cells[qtyIndex].trim()
            if (!Regex("^\\d+$").matches(token) || name.isEmpty()) {
                result.errors += problem(line, "invalid_card_row", if (name.isNotEmpty()) "Quantity must be a positive whole number" else "Missing card name", cells); continue }
            val zone = if (zoneIndex < 0) "" else key(cells.getOrNull(zoneIndex) ?: "")
            if (zone.isNotEmpty() && zone !in zones) result.warnings += problem(line, "unknown_csv_section", "Unrecognized CSV section ${cells[zoneIndex]}; retained in main deck for review", cells)
            val n = token.toBigInteger(); val q = if (n > QUANTITY.toBigInteger()) -1 else n.toInt()
            if (addRow(rows, Row(name, q, zones[zone] ?: "main", line), result, cells)) accepted += cells
        }
        result.source = "Deck CSV"
        fun quote(v: String) = "\"" + v.replace("\"", "\"\"") + "\""
        val safeHeaders = headers.mapIndexed { i, v -> if (i == nameIndex && labels[i] == "card") "Name" else v }
        result.normalizedText = (listOf(safeHeaders) + accepted).joinToString("\n") { r -> r.joinToString(",") { quote(it) } }
        return rows
    }

    fun parse(text: String): Result {
        val result = Result()
        if (text.length > INPUT_CHARS) { result.errors += problem(0, "input_limit", "Input exceeds $INPUT_CHARS characters", "", true); return result }
        val raw = text.removePrefix("﻿").replace(Regex("\r\n?"), "\n").replace(' ', ' ')
        val lines = raw.split("\n")
        if (lines.size > ROWS || lines.any { it.length > LINE_CHARS }) {
            result.errors += problem(0, "row_limit", "Input exceeds $ROWS lines or $LINE_CHARS characters per line", "", true); return result }
        val csv = Regex("(?:^|,)\\s*\"?(?:name|card name|card)\"?\\s*(?:,|$)", RegexOption.IGNORE_CASE).containsMatchIn(lines.firstOrNull { it.isNotBlank() } ?: "")
        val rows = if (csv) parseCsv(raw, result) else parseText(raw, result)
        result.rows = rows
        result.cards = aggregate(rows.filter { it.section == "main" || it.section == "commander" })
        result.side = aggregate(rows.filter { it.section == "side" })
        result.commanders = aggregate(rows.filter { it.section == "commander" })
        result.commander = result.commanders.firstOrNull()?.name ?: ""
        result.excludedCards = aggregate(rows.filter { it.section == "excluded" })
        result.excluded = result.excludedCards.sumOf { it.qty }
        result.total = result.cards.sumOf { it.qty }; result.sideTotal = result.side.sumOf { it.qty }
        result.unresolved = rows.toList()
        for (row in rows) row.category?.let { result.categoryCounts[it] = (result.categoryCounts[it] ?: 0) + row.qty }
        for (c in result.categories) if (c.declaredCount != null && c.declaredCount != c.actualCount)
            result.warnings += problem(c.line, "category_count_mismatch", "${c.name} header says ${c.declaredCount}; imported ${c.actualCount}", "")
        if (result.commanders.size > 1) result.warnings += problem(0, "multiple_commanders", "Multiple commanders were declared; verify their pairing and format before playing", "")
        if (result.excluded > 0) result.warnings += problem(0, "excluded_cards", "${result.excluded} maybeboard/considering copies were kept separate", "")
        if (rows.isEmpty() && result.errors.isEmpty()) result.errors += problem(0, "empty_deck", "No card rows found", "")
        return result
    }
}
