package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The rulebook's ratchet (specs/rulebook-native.md R2). Counts, file by file in ui/, what is still off the list: font sizes,
 * single-radius RoundedCornerShape corners, and Color(0x...) literals outside Rules.kt, Skin.kt, Theme.kt and the foil files.
 * Each count is held against src/test/resources/rulebook-budget.txt and may only go down. A new file starts at zero.
 * Table units (`du`) are not counted. To lower the budget after a snap: run with RULEBOOK_SEED=1 and commit the file.
 */
class RulebookTest {
    private val ui = File("src/main/java/dev/cardstashy/nativeplay/ui")
    private val budget = File("src/test/resources/rulebook-budget.txt")
    private val size = Regex("""fontSize\s*=\s*(\d+(?:\.\d+)?)f?\.sp|\b(?:sans|t|cinzel)\((\d+(?:\.\d+)?)f\b""")
    private val corner = Regex("""RoundedCornerShape\((\d+(?:\.\d+)?)f?\.dp\)""")
    private val colour = Regex("""Color\(0x[0-9A-Fa-f]{6,8}\)""")
    private val colourFree = setOf("Rules.kt", "Skin.kt", "Theme.kt")

    private fun counts(f: File): Triple<Int, Int, Int> {
        val s = f.readText()
        val sizes = size.findAll(s).count { m -> val v = (m.groupValues[1].ifEmpty { m.groupValues[2] }).toFloat(); v != v.toInt().toFloat() || v.toInt() !in Rule.Sizes }
        val corners = corner.findAll(s).count { m -> val v = m.groupValues[1].toFloat(); !(v == v.toInt().toFloat() && (v.toInt() in Rule.Radius.All || v.toInt() in setOf(0, 1, 99, 999))) }
        val colours = if (f.name in colourFree || f.name.contains("Foil")) 0 else colour.findAll(s).count()
        return Triple(sizes, corners, colours)
    }

    private fun measure() = ui.listFiles { f -> f.extension == "kt" }!!.sortedBy { it.name }.associate { it.name to counts(it) }

    @Test fun offListValuesOnlyGoDown() {
        val now = measure()
        val total = Triple(now.values.sumOf { it.first }, now.values.sumOf { it.second }, now.values.sumOf { it.third })
        println("Rulebook off-list totals: sizes ${total.first}, corners ${total.second}, colours ${total.third} in ${now.size} files")
        if (System.getenv("RULEBOOK_SEED") == "1") {
            budget.parentFile.mkdirs()
            budget.writeText("# file sizes corners colours (off the rulebook list; may only go down)\n" +
                now.filter { (_, c) -> c.first + c.second + c.third > 0 }.map { (n, c) -> "$n ${c.first} ${c.second} ${c.third}" }.joinToString("\n") + "\n")
            return
        }
        val allowed = budget.readLines().filter { it.isNotBlank() && !it.startsWith("#") }.associate { l -> val p = l.split(" "); p[0] to Triple(p[1].toInt(), p[2].toInt(), p[3].toInt()) }
        val over = now.mapNotNull { (n, c) -> val a = allowed[n] ?: Triple(0, 0, 0)
            if (c.first > a.first || c.second > a.second || c.third > a.third) "$n: sizes ${c.first}/${a.first}, corners ${c.second}/${a.second}, colours ${c.third}/${a.third}" else null }
        assertTrue("Off the rulebook list, over budget (now/allowed):\n" + over.joinToString("\n"), over.isEmpty())
    }

    @Test fun snapTablesLandOnTheList() {
        for (v in listOf(9f, 10.5f, 11.5f, 12.5f, 13f, 14.5f, 15f, 17f, 19f, 21f, 23f, 26f, 30f, 40f)) assertTrue(Rule.snapSize(v) in Rule.Sizes)
        for (v in listOf(2f, 7f, 8f, 12f, 14f, 15f, 18f, 22f, 34f)) assertTrue(Rule.Radius.snap(v) in Rule.Radius.All)
        assertTrue(Rule.Radius.snap(999f) == null)
    }
}
