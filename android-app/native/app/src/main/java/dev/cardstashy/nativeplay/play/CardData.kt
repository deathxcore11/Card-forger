package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * The web's card-view data (scripts/export-card-data.mjs): rule words from rule-dex.js and the foil
 * recipes and frame boxes from mtg-foil-recipes.js / mtg-foil-analysis.js. Plus mtgFoilProfile,
 * mtgHoloStamp and mtgFrameKey, checked against the web's own answers (FoilTest).
 */
class CardData(json: JsonObject) {
    data class Rule(val key: String, val label: String, val definition: String, val tip: String, val title: String, val example: String, val detail: String)
    data class Recipe(val key: String, val label: String, val era: String, val pat: Float, val tint: Float, val cover: Float, val relief: Float,
                      val film: Float, val sparkle: Float, val stamp: Float, val keep: Float, val note: String)
    data class Frame(val art: FloatArray, val text: FloatArray)
    data class Profile(val treatment: String, val status: String, val name: String, val unrecognized: List<String>)

    val rules: Map<String, Rule> = json.getAsJsonObject("rules").entrySet().associate { (k, v) -> val o = v.asJsonObject
        k to Rule(k, o.s("label"), o.s("definition"), o.s("tip"), o.s("title"), o.s("example"), o.s("detail")) }
    val recipes: Map<String, Recipe> = json.getAsJsonObject("recipes").entrySet().associate { (k, v) -> val o = v.asJsonObject
        k to Recipe(k, o.s("label"), o.s("era"), o.f("pat"), o.f("tint"), o.f("cover"), o.f("relief"), o.f("film"), o.f("sparkle"), o.f("stamp"), o.f("keep"), o.s("note")) }
    val frames: Map<String, Frame> = json.getAsJsonObject("frames").entrySet().associate { (k, v) -> val o = v.asJsonObject
        k to Frame(o.getAsJsonArray("art").map { it.asFloat }.toFloatArray(), o.getAsJsonArray("text").map { it.asFloat }.toFloatArray()) }
    private val unmodelled: Map<String, Pair<String, String>> = json.getAsJsonObject("unmodelled").entrySet().associate { (k, v) -> val o = v.asJsonObject; k to (o.s("name") to o.s("as")) }

    /** Rule words, longest first, for ruleText's one regex. */
    val ruleWords: List<String> = rules.keys.sortedByDescending { it.length }
    val ruleRegex: Regex = Regex("\\b(" + ruleWords.joinToString("|") { Regex.escape(it) } + ")\\b", RegexOption.IGNORE_CASE)
    fun rule(word: String): Rule? = rules[word] ?: rules.entries.firstOrNull { it.key.equals(word, ignoreCase = true) }?.value

    /** mtgFoilProfile(c, finish): the printing's foil material for the chosen finish. */
    fun profile(c: JsonObject?, finish: String): Profile {
        if (finish == "etched") return Profile("mtg-etched", "family", "", emptyList())
        if (finish != "foil") return Profile("", "family", "", emptyList())
        val promos = c?.getAsJsonArray("promo_types")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()
        for ((k, e) in PROMO) if (k in promos) return Profile(e, "family", "", emptyList())
        promos.firstOrNull { it in unmodelled }?.let { val (name, to) = unmodelled.getValue(it); return Profile(to, "approximate", name, emptyList()) }
        val unrecognized = promos.filter { it.endsWith("foil") && it !in NOT_MATERIAL }
        val set = c.s("set"); val type = c.s("set_type"); val frame = c.s("frame")
        val base = SET_MATERIAL[set] ?: when {
            type == "from_the_vault" -> "mtg-ftv"; type == "masterpiece" -> "mtg-masterpiece"; set in PDS -> "mtg-pds"
            frame == "1997" || frame == "1993" -> "mtg-oldborder"; else -> "mtg-traditional" }
        return Profile(base, if (unrecognized.isNotEmpty()) "approximate" else "family", "", unrecognized)
    }

    companion object {
        // mtg-foil-recipes.js PROMO, most specific first.
        private val PROMO = listOf("oilslick" to "mtg-oilslick", "stepandcompleat" to "mtg-compleat", "gilded" to "mtg-gilded", "neonink" to "mtg-neon",
            "textured" to "mtg-textured", "surgefoil" to "mtg-surge", "galaxyfoil" to "mtg-galaxy", "halofoil" to "mtg-halo", "confettifoil" to "mtg-confetti",
            "doublerainbow" to "mtg-doublerainbow", "fracturefoil" to "mtg-fracture", "rainbowfoil" to "mtg-rainbow", "ripplefoil" to "mtg-ripple",
            "manafoil" to "mtg-mana", "dragonscalefoil" to "mtg-dragonscale", "invisibleink" to "mtg-invisible", "silverfoil" to "mtg-silver",
            "firstplacefoil" to "mtg-firstplace", "raisedfoil" to "mtg-raised", "embossed" to "mtg-embossed", "ampersand" to "mtg-ampersand",
            "silverscreen" to "mtg-silverscreen", "vaultboy" to "mtg-vaultboy")
        private val PDS = setOf("h09", "pd2", "pd3")
        private val SET_MATERIAL = mapOf("dbl" to "mtg-silverscreen")
        private val NOT_MATERIAL = setOf("foil", "serialized", "scroll", "poster", "boosterfun", "universesbeyond")

        /** mtgHoloStamp: rares and mythics in the M15 frame carry the oval holo stamp. */
        fun holoStamp(c: JsonObject?) = c.s("frame") == "2015" && c.s("rarity") in setOf("rare", "mythic") && c.s("border_color") != "borderless"
        /** mtgFrameKey. */
        fun frameKey(c: JsonObject?): String {
            val frame = c.s("frame")
            return when {
                c.s("border_color") == "borderless" || c?.get("full_art")?.takeIf { it.isJsonPrimitive }?.asBoolean == true -> "borderless"
                frame == "1993" -> "1997"; frame in setOf("1997", "2003", "2015") -> frame; else -> "2015" }
        }

        @Volatile private var loaded: CardData? = null
        fun load(context: Context): CardData = loaded ?: synchronized(this) {
            loaded ?: CardData(JsonParser.parseString(context.assets.open("card-data.json").bufferedReader().readText()).asJsonObject).also { loaded = it; _ready.value = it }
        }
        private val _ready = kotlinx.coroutines.flow.MutableStateFlow<CardData?>(null)
        /** The data once parsed; screens read this instead of parsing on the main thread. */
        val ready: kotlinx.coroutines.flow.StateFlow<CardData?> = _ready
        /** Parses card-data.json on a background thread (app start). */
        fun warm(context: Context) { if (loaded != null) return; val app = context.applicationContext
            Thread({ runCatching { load(app) } }, "card-data").apply { isDaemon = true }.start() }
        fun of(json: String) = CardData(JsonParser.parseString(json).asJsonObject)

        private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        private fun JsonObject.f(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asFloat ?: 0f
    }
}
