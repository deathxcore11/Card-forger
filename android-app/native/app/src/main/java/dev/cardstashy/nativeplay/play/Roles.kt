package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject

/**
 * insights.js engineRoles, text patterns only: Ramp, Draw, Removal, Wipe, Protection. Lands are "Land".
 * The web also reads Scryfall's community tags (mtg-tags.js); those are not on the device yet.
 */
object Roles {
    private val RAMP = listOf(
        """\{t\}(?:,[^:]*)?: add """,
        """\badd (?:\{[wubrgc]\}|one mana|two mana|three mana|x mana|mana of any|an amount of|that much)""",
        """search your library for (?:a|an|up to \w+|two) (?:basic )?(?:land|plains|island|swamp|mountain|forest|snow land)""",
        """put (?:a|up to \w+|two) (?:basic )?land cards? .*onto the battlefield""",
        """you may put a land card from your hand onto the battlefield""",
        """create (?:a|an|one|two|three|x|\w+) treasure tokens?""",
        """spells? (?:you cast )?cost(?:s)? \{\d\} less""").map(::Regex)
    private val DRAW = listOf(
        """\bdraws? (?:a|an|one|two|three|four|five|seven|x|that many|\d+) (?:additional )?cards?""",
        """\bdraw cards? equal to""",
        """exile the top .*?(?:you may|until end of turn,? you may) (?:play|cast)""",
        """\binvestigate\b""",
        """look at the top .*put (?:one|two|that card|it) into your hand""").map(::Regex)
    private val REMOVAL = listOf(
        """deals? \d+ damage to each creature (?:blocking|blocked by)\b""",
        """(?:destroy|exile) target (?:creature|artifact|enchantment|planeswalker|battle|permanent|nonland permanent|nonland|attacking|blocking|tapped|creature or|artifact or|noncreature)""",
        """counter target (?:spell|creature spell|noncreature spell|activated|triggered)""",
        """deals? (?:\d+|x|that much) damage to (?:any target|target creature|target planeswalker|target attacking|another target)""",
        """return target (?:nonland permanent|creature|artifact|enchantment|permanent)[^.]* to (?:its|their) owner'?s? hand""",
        """target creature (?:an opponent controls )?gets -\d+/-\d+""",
        """fights? (?:target|another target|up to one target)""",
        """(?:target|each) (?:opponent|player) sacrifices""").map(::Regex)
    private val WIPE = listOf(
        """(?:destroy|exile) (?:all|each) (?:other )?(?:creatures|nonland permanents|artifacts|enchantments|permanents|nontoken|creature|non-?\w+ creatures|attacking)""",
        """all (?:other )?creatures get -\d+/-\d+""",
        """deals? \d+ damage to each (?:creature|other creature|opponent and each creature)\b(?! (?:blocking|blocked by)\b)""",
        """return all (?:nonland permanents|creatures|other creatures)""",
        """each player sacrifices (?:all|half)""").map(::Regex)
    private val PROTECTION = listOf(
        """(?:gains?|have|has|gets?)[^.]{0,60}(?:hexproof|indestructible|shroud|protection from)""",
        """phases? out""", """can't be countered""", """counter target spell""", """regenerate target""").map(::Regex)

    private fun text(c: JsonObject): String = (c.get("oracle_text")?.takeIf { it.isJsonPrimitive }?.asString?.ifEmpty { null }
        ?: c.getAsJsonArray("card_faces")?.joinToString("\n") { it.asJsonObject.get("oracle_text")?.asString ?: "" } ?: "").lowercase()
    fun isLand(c: JsonObject?) = Regex("\\bLand\\b").containsMatchIn((c?.get("type_line")?.asString ?: "").split(" // ")[0])

    private val memo = HashMap<String, List<String>>()
    fun of(c: JsonObject?): List<String> {
        if (c == null) return emptyList()
        val key = c.get("id")?.asString ?: c.get("name")?.asString ?: ""
        memo[key]?.let { return it }
        val out = if (isLand(c)) listOf("Land") else { val t = text(c); buildList {
            if (RAMP.any { it.containsMatchIn(t) }) add("Ramp")
            if (DRAW.any { it.containsMatchIn(t) }) add("Draw")
            if (REMOVAL.any { it.containsMatchIn(t) }) add("Removal")
            if (WIPE.any { it.containsMatchIn(t) }) add("Wipe")
            if (PROTECTION.any { it.containsMatchIn(t) }) add("Protection")
        } }
        if (key.isNotEmpty()) memo[key] = out
        return out
    }

    /** deck-viewer.js deckCardCategory for Magic. */
    private val CATS = listOf("Lands" to "\\bLand\\b", "Creatures" to "\\bCreature\\b", "Planeswalkers" to "\\bPlaneswalker\\b", "Instants" to "\\bInstant\\b",
        "Sorceries" to "\\bSorcery\\b", "Artifacts" to "\\bArtifact\\b", "Enchantments" to "\\bEnchantment\\b", "Battles" to "\\bBattle\\b").map { it.first to Regex(it.second) }
    val ORDER = listOf("Commander", "Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Battles", "Lands", "Unresolved")
    fun category(c: JsonObject?): String {
        val front = (c?.get("type_line")?.asString ?: "").split(" // ")[0].split(Regex("[—–]"))[0]
        return CATS.firstOrNull { it.second.containsMatchIn(front) }?.first ?: "Unresolved"
    }
}
