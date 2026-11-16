package dev.cardstashy.nativeplay.foil

import android.content.Context
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Pokémon foil, ported from the site (ptcg-foil.js, ptcg-foil-recipes.js and the Pokémon branch of finish-effects.js at
 * 6ceede8c, via /mnt/project-files/specs/foil-native/ptcg-foil-port.json). Coverage comes from the site's measured frame
 * masks (art window for holo rares, surround for reverse holos, whole card for full arts); inside a holo window the Pokémon
 * sits on white ink and only the background shines (the same subject analysis as Yu-Gi-Oh!). The pattern is the era's or
 * variant's own foil sheet. Every rule here follows the site line by line so a printing shines the same on both.
 */
object PtcgFoil {
    // ---- Recipes (ptcg-foil-recipes.js) ----
    class Recipe(val pat: Int, val tint: Int, val underbase: Int, val relief: Float, val sparkle: Float, val soft: Int, val strip: Int, val strength: Float, val coat: Int)
    private fun r(pat: Int, tint: Int = 0, underbase: Int = 0, relief: Float = 0f, sparkle: Float = 0f, soft: Int = 0, strip: Int = 0, strength: Float = 0f, coat: Int = 0) =
        Recipe(pat, tint, underbase, relief, sparkle, soft, strip, strength, coat)
    val RECIPES: Map<String, Recipe> = mapOf(
        "ptcg-wotc-holo" to r(1, underbase = 1, sparkle = .4f), "ptcg-lc-holo" to r(1, underbase = 1, sparkle = .4f),
        "ptcg-ecard-holo" to r(2, underbase = 1, sparkle = .5f, strip = 1), "ptcg-ex-holo" to r(6, underbase = 1),
        "ptcg-classic-holo" to r(4, underbase = 1), "ptcg-sv-holo" to r(8, underbase = 1, sparkle = .35f), "ptcg-cosmos" to r(6, underbase = 1),
        "ptcg-reverse" to r(8), "ptcg-lc-reverse" to r(7), "ptcg-ecard-reverse" to r(2, sparkle = .4f), "ptcg-sv-reverse" to r(8, sparkle = .15f),
        "ptcg-cosmos-reverse" to r(6), "ptcg-pokeball" to r(9, coat = 1), "ptcg-masterball" to r(10, coat = 1), "ptcg-emblem-reverse" to r(17),
        "ptcg-cracked-reverse" to r(18, sparkle = .2f), "ptcg-cracked-ice" to r(18, underbase = 1, sparkle = .2f),
        "ptcg-full-art" to r(14, soft = 1), "ptcg-textured" to r(11, relief = .5f, soft = 1), "ptcg-rainbow" to r(11, relief = .5f, sparkle = .4f, soft = 1),
        "ptcg-gold" to r(11, tint = 1, relief = .5f, soft = 1), "ptcg-illustration" to r(12, sparkle = .3f, soft = 1, strength = .9f),
        "ptcg-special-illustration" to r(12, relief = .28f, sparkle = .55f, soft = 1, strength = 1f), "ptcg-shiny" to r(13, relief = .3f, sparkle = 1f, soft = 1),
        "ptcg-confetti" to r(15, underbase = 1, sparkle = .25f), "ptcg-ancient-speckle" to r(16, tint = 1, sparkle = .3f), "ptcg-double-rare" to r(43, soft = 1),
        "ptcg-rmirror-reverse" to r(19), "ptcg-big-glitter" to r(20, underbase = 1), "ptcg-energy2-reverse" to r(21), "ptcg-pinwheel-reverse" to r(22),
        "ptcg-emerald-reverse" to r(23), "ptcg-ball-hologram-reverse" to r(24), "ptcg-vsheen-spectrum" to r(25, underbase = 1), "ptcg-vsheen" to r(26, tint = 2, underbase = 1),
        "ptcg-cosmos-pixel" to r(27, underbase = 1), "ptcg-cosmos-hd" to r(28, underbase = 1), "ptcg-tinsel" to r(29, underbase = 1), "ptcg-tinsel2" to r(30, underbase = 1),
        "ptcg-diagonal-left" to r(31, soft = 1), "ptcg-horizontal" to r(32, underbase = 1), "ptcg-striped" to r(33, underbase = 1), "ptcg-prism" to r(34, underbase = 1),
        "ptcg-starlight2" to r(35, underbase = 1), "ptcg-water-web" to r(36, underbase = 1), "ptcg-radiant" to r(37, soft = 1), "ptcg-rainbow-glitter" to r(38, soft = 1),
        "ptcg-glitter-sheen" to r(39, soft = 1), "ptcg-ace-spec" to r(40, tint = 3, soft = 1), "ptcg-prismatic-pokeball" to r(41, coat = 1),
        "ptcg-prismatic-masterball" to r(41, sparkle = .3f, coat = 1), "ptcg-rc-dots" to r(42, soft = 1), "ptcg-sequin" to r(44, underbase = 1),
        "ptcg-crosshatch" to r(45, underbase = 1), "ptcg-tcg-classic" to r(46, underbase = 1), "ptcg-acid-wash" to r(47, underbase = 1), "ptcg-disco" to r(48, underbase = 1),
    )
    private val ERA_HOLO = mapOf("pk-wotc" to "ptcg-wotc-holo", "pk-gym" to "ptcg-wotc-holo", "pk-neo" to "ptcg-wotc-holo", "pk-lc" to "ptcg-lc-holo", "pk-ecard" to "ptcg-ecard-holo",
        "pk-exa" to "ptcg-ex-holo", "pk-exb" to "ptcg-ex-holo", "pk-dppt" to "ptcg-ex-holo", "pk-hgss" to "ptcg-ex-holo", "pk-sm" to "ptcg-water-web", "pk-swsh" to "ptcg-vsheen", "pk-sv" to "ptcg-sv-holo")
    private val ERA_REVERSE = mapOf("pk-lc" to "ptcg-lc-reverse", "pk-ecard" to "ptcg-ecard-reverse", "pk-exa" to "ptcg-rmirror-reverse", "pk-exb" to "ptcg-rmirror-reverse", "pk-sv" to "ptcg-sv-reverse")
    private val SET_HOLO = mapOf("col1" to "ptcg-vsheen-spectrum", "xy12" to "ptcg-starlight2", "det1" to "ptcg-striped")
    private val SET_REVERSE = mapOf("ex5" to "ptcg-energy2-reverse", "ex6" to "ptcg-emblem-reverse", "ex8" to "ptcg-pinwheel-reverse", "ex9" to "ptcg-emerald-reverse", "ex10" to "ptcg-ball-hologram-reverse",
        "ex11" to "ptcg-reverse", "ex12" to "ptcg-reverse", "ex13" to "ptcg-reverse", "ex14" to "ptcg-reverse", "ex15" to "ptcg-reverse", "ex16" to "ptcg-reverse")
    private val BW = Regex("^bw\\d+$"); private val XY = Regex("^xy\\d+$")
    private fun setHolo(set: String) = SET_HOLO[set] ?: if (BW.matches(set)) "ptcg-tinsel" else if (XY.matches(set)) "ptcg-vsheen" else ""
    private fun setReverse(set: String) = SET_REVERSE[set] ?: if (BW.matches(set)) "ptcg-emblem-reverse" else ""
    fun norm(v: String?) = (v ?: "").lowercase().replace(Regex("[^a-z0-9]"), "")

    /** ptcgFoilEffect: which sheet a printing's finish is, from its mask era, catalogue pattern name and rarity. */
    fun foilEffect(finish: String, era: String = "", foil: String = "", rarity: String = "", fullArt: Boolean = false, textured: Boolean = false, gold: Boolean = false, set: String = "", number: String = ""): String {
        val f = norm(foil); val rar = norm(rarity); val s = set.lowercase()
        if (finish == "reverse-holofoil") {
            val prismatic = s == "sv08.5"
            if (f == "masterball") return if (prismatic) "ptcg-prismatic-masterball" else "ptcg-masterball"
            if (f == "pokeball") return if (prismatic) "ptcg-prismatic-pokeball" else "ptcg-pokeball"
            if (f == "cosmos") return "ptcg-cosmos-reverse"
            if (f in listOf("energy", "league", "setlogo", "teamrocket")) return "ptcg-emblem-reverse"
            if (f == "crackedice") return "ptcg-cracked-reverse"; if (f == "tinsel") return "ptcg-sv-reverse"
            return setReverse(s).ifEmpty { ERA_REVERSE[era] ?: "ptcg-reverse" }
        }
        if (finish != "holofoil") return ""
        if (f == "confetti") return "ptcg-confetti"; if (f == "ancient") return "ptcg-ancient-speckle"
        if (Regex("acespec|^rareace$").containsMatchIn(rar)) return "ptcg-ace-spec"
        if (Regex("^radiant(rare)?$").containsMatchIn(rar)) return "ptcg-radiant"
        if (rar.contains("amazing")) return "ptcg-rainbow-glitter"
        if (Regex("prismstar|break").containsMatchIn(rar)) return "ptcg-prism"
        if (Regex("^rc\\d", RegexOption.IGNORE_CASE).containsMatchIn(number)) return "ptcg-rc-dots"
        if (rar.contains("shiny") && s in listOf("sma", "sm115") && !fullArt) return "ptcg-rainbow-glitter"
        if (rar.contains("shiny") && s in listOf("swsh4.5", "swsh45sv")) return "ptcg-glitter-sheen"
        if (fullArt) {
            if (gold || f == "gold") return "ptcg-gold"
            if (rar.contains("specialillustration")) return "ptcg-special-illustration"
            if (rar.startsWith("illustrationrare")) return "ptcg-illustration"
            if (rar.contains("rainbow") || f == "rainbow" || rar == "hyperrare" && !Regex("^(sv|me)").containsMatchIn(era)) return "ptcg-rainbow"
            if (rar.contains("shiny")) return "ptcg-shiny"
            if (rar == "doublerare") return "ptcg-double-rare"
            return if (textured) "ptcg-textured" else "ptcg-full-art"
        }
        if (f == "cosmos") return "ptcg-cosmos"; if (f == "crackedice") return "ptcg-cracked-ice"
        if (f == "tinsel") return "ptcg-tinsel"; if (f == "league") return "ptcg-crosshatch"
        if (rar == "doublerare") return "ptcg-double-rare"
        return setHolo(s).ifEmpty { ERA_HOLO[era] ?: "ptcg-classic-holo" }
    }

    // ---- Measured masks (res/raw/ptcg_masks.json, from the site's finish-effects.css clip paths) ----
    /** A clip shape in card space: [pts] is x0,y0,x1,y1,... as fractions of the card; [evenOdd] shapes are a surround (outer ring, then the hole). */
    class Shape(val evenOdd: Boolean, val pts: FloatArray)
    class Anniversary(val mask: String, val effect: String, val images: List<String>, val alternates: List<Anniversary>)
    /** A printed-mark profile measured on one exact image: the foil keeps [mask] (the card minus the mark) and the layer takes [artMask]. */
    class Stamp(val mask: String, val images: List<String>, val artMask: String?)
    class Masks(val shapes: Map<String, Shape>, val anniversary: Map<String, Anniversary>, val stamps: Map<String, List<Stamp>>) {
        fun shape(name: String): Shape? = if (name == "card") CARD else shapes[name]
        companion object {
            val CARD = Shape(false, floatArrayOf(0f, 0f, 1f, 0f, 1f, 1f, 0f, 1f))
            @Volatile private var cached: Masks? = null
            fun load(context: Context): Masks = cached ?: synchronized(this) {
                cached ?: parse(context.resources.openRawResource(dev.cardstashy.nativeplay.R.raw.ptcg_masks).bufferedReader().use { it.readText() }).also { cached = it }
            }
            fun parse(json: String): Masks {
                val o = JsonParser.parseString(json).asJsonObject
                val shapes = HashMap<String, Shape>()
                for ((k, v) in o.getAsJsonObject("masks").entrySet()) { val a = v.asJsonArray; val p = a[1].asJsonArray; shapes[k] = Shape(a[0].asInt == 1, FloatArray(p.size()) { p[it].asFloat }) }
                fun ann(e: JsonObject): Anniversary = Anniversary(e["mask"].asString, e["effect"].asString, e.getAsJsonArray("images").map { it.asString },
                    e.getAsJsonArray("alternates")?.map { ann(it.asJsonObject) } ?: emptyList())
                val anniversary = o.getAsJsonObject("anniversary").entrySet().associate { (k, v) -> k to ann(v.asJsonObject) }
                val stamps = o.getAsJsonObject("stamps").entrySet().associate { (k, v) -> k to v.asJsonArray.map { s -> val e = s.asJsonObject; Stamp(e["mask"].asString, e.getAsJsonArray("images").map { it.asString }, e["artMask"]?.asString) } }
                return Masks(shapes, anniversary, stamps)
            }
        }
    }
    fun shapeBox(s: Shape): FloatArray {
        var x0 = 1f; var y0 = 1f; var x1 = 0f; var y1 = 0f
        for (i in 0 until s.pts.size / 2) { val x = s.pts[i * 2]; val y = s.pts[i * 2 + 1]; x0 = min(x0, x); y0 = min(y0, y); x1 = max(x1, x); y1 = max(y1, y) }
        return floatArrayOf(x0, y0, x1, y1)
    }
    /** The art window is the shape's inner box: for an evenodd surround, the hole it cuts out. */
    fun artBox(s: Shape): FloatArray {
        if (!s.evenOdd) return shapeBox(s)
        val n = s.pts.size / 2
        val k = (1 until n).firstOrNull { s.pts[it * 2] == s.pts[0] && s.pts[it * 2 + 1] == s.pts[1] } ?: -1
        return if (k > 0 && k < n - 3) shapeBox(Shape(false, s.pts.copyOfRange((k + 1) * 2, s.pts.size))) else shapeBox(s)
    }

    // ---- Frame classification (pokemonFrame) ----
    private val I = RegexOption.IGNORE_CASE
    private val FRAME_ERAS = listOf(
        Regex("^(?:base4|basep|si1)$", I) to "pk-wotc", Regex("^pop1$", I) to "pk-exa", Regex("^(?:np|exu|pop[2-5])$", I) to "pk-exb", Regex("^pop[6-9]$", I) to "pk-dppt",
        Regex("^20\\d\\d(?:bw|xy)$", I) to "pk-bwxy", Regex("^20\\d\\dsm$", I) to "pk-sm", Regex("^20\\d\\dswsh$", I) to "pk-swsh", Regex("^20\\d\\dsv$", I) to "pk-sv",
        Regex("^base[1-3]$", I) to "pk-wotc", Regex("^(?:base5|gym[12])$", I) to "pk-gym", Regex("^neo[1-4]$", I) to "pk-neo", Regex("^lc$", I) to "pk-lc", Regex("^ecard[1-3]$", I) to "pk-ecard",
        Regex("^ex[1-6]$", I) to "pk-exa", Regex("^ex(?:[7-9]|1[0-6])$", I) to "pk-exb", Regex("^(?:dp|pl)", I) to "pk-dppt", Regex("^(?:hgss|col)", I) to "pk-hgss",
        Regex("^(?:bw|xy|g1$|dc1|dv1)", I) to "pk-bwxy", Regex("^(?:sm|det1)", I) to "pk-sm", Regex("^(?:swsh|cel25$|pgo)", I) to "pk-swsh", Regex("^(?:sv|me)", I) to "pk-sv")
    private val MASK_ERA = listOf(Regex("^pk-(?:base|wotc)") to "pk-wotc", Regex("^pk-gym") to "pk-gym", Regex("^pk-neo") to "pk-neo", Regex("^pk-lc") to "pk-lc", Regex("^pk-(?:ecard|expedition)") to "pk-ecard",
        Regex("^pk-exa") to "pk-exa", Regex("^pk-exb") to "pk-exb", Regex("^pk-dppt") to "pk-dppt", Regex("^pk-hgss") to "pk-hgss", Regex("^pk-bwxy") to "pk-bwxy", Regex("^pk-sm") to "pk-sm",
        Regex("^pk-(?:swsh|cel-)") to "pk-swsh", Regex("^pk-sv") to "pk-sv")
    private fun maskEra(mask: String) = MASK_ERA.firstOrNull { it.first.containsMatchIn(mask) }?.second ?: ""

    /** A TCGdex card record, the fields the site's resolver reads. */
    class Card(val id: String, val setId: String, val name: String = "", val category: String = "Pokemon", val stage: String? = null, val rarity: String? = null,
               val localId: String? = null, val setNumber: String? = null, val image: String? = null, val imageLarge: String? = null)
    /** One sellable variant of the card (the site's catalogue rows): [finish] normal/holofoil/reverse-holofoil when the provider says, else read from key and label. */
    class Variant(val key: String, val label: String = "", val finish: String? = null, val foil: String? = null, val size: String? = null, val subtype: String? = null,
                  val stamps: List<String> = emptyList(), val image: String? = null, val imageLarge: String? = null)
    /** How the printing shines: [effect] plain/unknown or a ptcg-* preset, [mask] the coverage shape, [treatment] the RECIPES key the shader draws. */
    class Profile(val effect: String, val mask: String? = null, val material: String? = null, val coverage: String? = null, val texture: String? = null, val pattern: String? = null,
                  val status: String = "approximate", val treatment: String? = null, val imageSources: List<String>? = null) {
        fun with(pattern: String? = this.pattern, treatment: String? = this.treatment, status: String = this.status) = Profile(effect, mask, material, coverage, texture, pattern, status, treatment, imageSources)
    }
    private val UNKNOWN = Profile("unknown", status = "unknown")
    private val PLAIN = Profile("plain", status = "verified")
    private fun preset(effect: String, mask: String, material: String, coverage: String? = null, texture: String? = null, pattern: String? = null, imageSources: List<String>? = null) =
        Profile(effect, mask, material, coverage, texture, pattern, "approximate", null, imageSources)

    /** pokemonFrame: the measured frame era + variant for a card, or "" when its layout was not measured. */
    fun frame(setId: String, category: String?, stage: String?, name: String?, cardId: String = "", anniversary: Set<String> = emptySet()): String {
        val base = FRAME_ERAS.firstOrNull { it.first.containsMatchIn(setId) }?.second
        val cat = norm(category ?: "Pokemon"); val st = norm(stage)
        if (base == null || (setId == "cel25" && cardId in anniversary)) return ""
        if (Regex("^pk-ex[ab]$").matches(base) && Regex("(?:\\sex|☆|\\sStar)$", I).containsMatchIn(name ?: "")) return ""
        if (cat == "trainer") return if (Regex("p$", I).containsMatchIn(setId)) "" else "$base-trainer"
        if (cat != "pokemon") return ""
        return if (st in listOf("", "basic", "baby")) base else if (st in listOf("stage1", "stage2")) "$base-evolved" else ""
    }
    private fun frame(c: Card, m: Masks) = frame(c.setId, c.category, c.stage, c.name, c.id, m.anniversary.keys)

    /** variantFinish: the physical finish a catalogue row stands for. */
    fun variantFinish(v: Variant): String {
        v.finish?.let { return mapOf("normal" to "nonfoil", "holo" to "holofoil", "reverse" to "reverse-holofoil")[it] ?: it }
        val k = norm(v.key); val label = v.label
        if (Regex("unconfirmed", I).containsMatchIn(label)) return ""
        if (Regex("reverse", I).containsMatchIn(label) || k.contains("reverseholo")) return "reverse-holofoil"
        if (Regex("holo", I).containsMatchIn(label) || k.endsWith("holofoil")) return "holofoil"
        if (k in listOf("normal", "nonfoil", "unlimited", "1stedition") || Regex("\\bNormal\\b", I).containsMatchIn(label)) return "nonfoil"
        return ""
    }
    private fun image(c: Card, v: Variant?) = (v?.imageLarge ?: v?.image ?: c.imageLarge ?: c.image ?: "").substringBefore('?')

    /** effectFor (Pokémon branch): the preset for a card at a physical finish. */
    fun effectFor(c: Card, v: Variant?, physicalFinish: String, m: Masks): Profile {
        if (physicalFinish == "nonfoil") return PLAIN
        val set = c.setId; val rarity = norm(c.rarity); val category = norm(c.category.ifEmpty { "Pokemon" })
        if (Regex("^(?:cel25cc|cel25c|30th-c|30th)$").matches(set) || (set == "cel25" && m.anniversary.containsKey(c.id))) {
            val mapped = m.anniversary[c.id]; val img = image(c, v)
            val entry = (listOfNotNull(mapped) + (mapped?.alternates ?: emptyList())).firstOrNull { it.images.contains(img) } ?: mapped
            val fallback = set == "30th-c" && img == "https://images.pokemontcg.io/me55c/${c.id.substringAfterLast('-').toIntOrNull() ?: 0}_hires.png"
            if (physicalFinish != "holofoil" || entry == null || (!fallback && !entry.images.contains(img))) return UNKNOWN
            return preset(entry.effect, entry.mask, if (entry.effect == "ptcg-full-art") "rainbow" else "holo", imageSources = entry.images,
                pattern = if (set == "cel25cc" && entry.effect == "ptcg-holo") "confetti" else null)
        }
        if (c.id == "miscp-001" && physicalFinish == "holofoil") return preset("ptcg-holo", "card", "holo", pattern = "ancient")
        if (set == "ecard1" && c.id in listOf("ecard1-1", "ecard1-33")) {
            if (physicalFinish == "holofoil") return preset("ptcg-expedition-holo", "pk-expedition-art", "holo")
            if (physicalFinish == "reverse-holofoil") return preset("ptcg-expedition-reverse", "pk-expedition-field", "rainbow")
        }
        if (set == "base1" && Regex("^base1-(?:[1-9]|1[0-6])$").matches(c.id) && physicalFinish == "holofoil") {
            val img = v?.imageLarge ?: v?.image ?: c.imageLarge ?: c.image ?: ""
            val number = c.id.substring(6); val prefix = "https://assets.tcgdex.net/en/base/base1/$number/"
            val traced = img.startsWith(prefix) && Regex("^(?:high|low)\\.webp(?:[?#]|$)").containsMatchIn(img.substring(prefix.length))
            val mask = if (traced) "pk-${c.id}-tcgdex-art" else if (c.id == "base1-4") "pk-base1-4-art" else "pk-base-art"
            return preset("ptcg-holo", mask, "holo")
        }
        if (set == "base4" && c.id == "base4-20" && physicalFinish == "holofoil") return preset("ptcg-holo", "pk-base4-20-art", "holo")
        if (set == "neo1" && c.id == "neo1-9" && physicalFinish == "holofoil") return preset("ptcg-holo", "pk-neo1-9-art", "holo")
        val shinyGX = set == "sma" && rarity.contains("shiny") && Regex("[\\s-]GX$").containsMatchIn(c.name)
        val fullArt = Regex("fullart|illustration|rainbow|shinyvmax|shinyv|secret|hyperrare|ultrarare").containsMatchIn(rarity) || Regex("^(vmax|vstar)$", I).matches(c.stage ?: "") ||
            (!Regex("^ex\\d").containsMatchIn(set) && Regex("[\\s-](?:V|GX|EX|ex|VMAX|VSTAR|V-UNION)$").containsMatchIn(c.name))
        if (physicalFinish == "holofoil" && fullArt) {
            val textured = shinyGX || Regex("specialillustration|shiny.*vmax|rainbow|fullart|ultrarare|rareultra|hyperrare").containsMatchIn(rarity) || Regex("^vmax$", I).matches(c.stage ?: "")
            val gold = Regex("^(sv|me)", I).containsMatchIn(set) && rarity == "hyperrare"
            return preset("ptcg-full-art", "card", if (gold) "gold" else "rainbow", coverage = "full", texture = if (textured) "micro-ridges" else "smooth")
        }
        if (set == "sm11" && c.id == "sm11-4" && !fullArt && physicalFinish == "holofoil") return preset("ptcg-holo", "pk-sm11-4-art", "holo")
        if (category == "pokemon" && Regex("^(?:dp|pl|hgss|col)", I).containsMatchIn(set) && (norm(c.stage) == "levelup" || rarity.contains("lvx")) && physicalFinish == "holofoil")
            return preset("ptcg-holo", "card", "holo", coverage = "full")
        if (c.id == "swsh3-161" && set == "swsh3" && category == "trainer" && physicalFinish == "reverse-holofoil") return preset("ptcg-reverse", "pk-swsh-trainer-field", "rainbow", coverage = "partial")
        if (category == "energy" && physicalFinish in listOf("holofoil", "reverse-holofoil"))
            return preset(if (physicalFinish == "holofoil") "ptcg-holo" else "ptcg-reverse", "card", if (physicalFinish == "holofoil") "holo" else "rainbow", coverage = "full")
        val frame = if (fullArt) "" else frame(c, m)
        if (frame.isNotEmpty() && physicalFinish == "holofoil") return preset("ptcg-holo", if (set == "cel25" && frame == "pk-swsh") "pk-cel-art" else "$frame-art", "holo")
        if (frame.isNotEmpty() && physicalFinish == "reverse-holofoil") return preset("ptcg-reverse", "$frame-surround", if (Regex("^sv", I).containsMatchIn(set)) "tiles" else "rainbow")
        return UNKNOWN
    }

    private val REVIEWED_COSMOS_PROMOS = setOf("swshp-SWSH012", "swshp-SWSH013", "swshp-SWSH032", "swshp-SWSH034", "swshp-SWSH040", "swshp-SWSH060", "swshp-SWSH220")

    /** finishChoices (Pokémon) for one variant, then withPtcgTreatment: the profile with the sheet the shader draws. */
    fun resolve(c: Card, v0: Variant, m: Masks): Profile {
        var v = v0
        val finish = variantFinish(v)
        if (finish == "nonfoil") return effectFor(c, v, finish, m)
        if (v.foil == "galaxy") v = Variant(v.key, v.label, v.finish, "", v.size, v.subtype, v.stamps, v.image, v.imageLarge)
        val foil = v.foil ?: ""
        fun pattern(p: Profile) = if (foil.isNotEmpty()) p.with(pattern = foil) else p
        val cosmosReviewed = c.setId == "swshp" && c.category == "Pokemon" && c.id in REVIEWED_COSMOS_PROMOS && finish == "holofoil" && foil == "cosmos" && (v.size == null || v.size == "standard") && v.subtype == null && v.stamps.isEmpty()
        val p: Profile = when {
            cosmosReviewed -> preset("ptcg-holo", "pk-swsh-art", "holo", pattern = "cosmos")
            else -> {
                val cosmosFrame = if (c.category in listOf("Pokemon", "Trainer")) frame(c, m) else ""
                val sheet = foil in listOf("masterball", "cosmos", "energy", "league", "set-logo", "team-rocket", "cracked-ice", "tinsel") || foil.endsWith("ball")
                val reverseFrame = if (sheet && finish == "reverse-holofoil" && v.size != "jumbo" && v.subtype == null) frame(c, m).ifEmpty { if (c.category == "Energy") "card" else "" } else ""
                val iceFrame = if (foil == "cracked-ice" && finish == "holofoil") frame(c, m) else ""
                if (foil == "cosmos" && finish == "holofoil" && v.size == "standard" && v.subtype == null && cosmosFrame.isNotEmpty()) preset("ptcg-holo", "$cosmosFrame-art", "holo", pattern = "cosmos")
                else if (reverseFrame.isNotEmpty()) preset("ptcg-reverse", if (reverseFrame == "card") "card" else "$reverseFrame-surround", "rainbow", pattern = foil)
                else if (foil == "rainbow" && finish == "holofoil") preset("ptcg-full-art", "card", "rainbow", coverage = "full", texture = "micro-ridges", pattern = "rainbow")
                else if (iceFrame.isNotEmpty()) preset("ptcg-holo", "$iceFrame-art", "holo", pattern = "cracked-ice")
                else {
                    val gold = if (foil == "gold" && finish == "holofoil") effectFor(c, v, finish, m).takeIf { it.status != "unknown" }?.with(pattern = "gold") else null
                    gold ?: run {
                        val placed = if (finish.isNotEmpty() && finish in listOf("holofoil", "reverse-holofoil")) effectFor(c, v, finish, m) else null
                        if (placed != null && placed.status != "unknown") pattern(placed)
                        else if (finish in listOf("holofoil", "reverse-holofoil")) pattern(preset(if (finish == "holofoil") "ptcg-holo" else "ptcg-reverse", "card", if (finish == "holofoil") "holo" else "rainbow", coverage = "full"))
                        else if (finish.isNotEmpty()) effectFor(c, v, finish, m) else UNKNOWN
                    }
                }
            }
        }
        return withTreatment(c, p)
    }

    /** withPtcgTreatment: the recipe key for a resolved profile. */
    fun withTreatment(c: Card, p: Profile): Profile {
        if (p.status == "unknown" || p.effect == "plain" || p.mask == null) return p
        val era = maskEra(p.mask); val fullArt = p.effect == "ptcg-full-art" || p.coverage == "full"
        val finish = if (p.effect == "ptcg-reverse") "reverse-holofoil" else "holofoil"; val gold = p.material == "gold" || p.pattern == "gold"
        val idm = Regex("^(.+)-([^-]+)$").find(c.id)
        val set = c.setId.ifEmpty { idm?.groupValues?.get(1) ?: "" }; val number = c.setNumber ?: c.localId ?: idm?.groupValues?.get(2) ?: ""
        val t = foilEffect(finish, if (fullArt) "" else era, p.pattern ?: "", c.rarity ?: "", fullArt, p.texture == "micro-ridges", gold, set, number)
        return if (t.isNotEmpty() && RECIPES.containsKey(t)) p.with(treatment = t) else p
    }

    /** The printed-mark profile measured on this exact image (finishOverlayProfile): the foil then keeps the mark's clear mask. */
    fun stampFor(c: Card, image: String, m: Masks): Stamp? { val img = image.substringBefore('?'); return m.stamps[c.id]?.firstOrNull { it.images.contains(img) } }

    // ---- Measuring (mountPtcgFoil's analysis) ----
    /** [mask] R foil-through behind the Pokémon, G coloured energy, B coverage; [relief] R height, G/B stroke direction. Opaque RGBA bytes. */
    class Maps(val w: Int, val h: Int, val mask: ByteArray, val relief: ByteArray)

    /** The site analyses at half the scan's width, at most 406 px (readFoilPixels); every threshold below was tuned there. */
    fun analysisSize(w: Int, h: Int): Pair<Int, Int> { val W = max(64, min(406, (w / 2f).roundToInt())); return W to (W.toFloat() * h / w).roundToInt() }

    /** [argb] the card at analysis size. [shape] the coverage mask, [art] the art window shape (artClip, else [shape]), [clip] a printed-mark clear mask over the whole overlay,
     *  [window] when the mask was measured on this exact image (foil-through everywhere in it). Pure; run it off the main thread. */
    fun analyze(argb: IntArray, W: Int, H: Int, recipe: Recipe, shape: Shape, art: Shape = shape, clip: Shape? = null, window: Boolean = false): Maps {
        val N = W * H
        val box = if (recipe.underbase == 1) artBox(art) else floatArrayOf(.1f, .1f, .9f, .5f)
        val a = YgoFoil.analyze(argb, W, H, box, spellTrapRule = false, names = false)
        val cov = coverage(shape, W, H)
        clip?.let { val cc = coverage(it, W, H); for (i in 0 until N) cov[i] *= cc[i] }
        val spill = if (shape.evenOdd) artOverflow(argb, W, H, artBox(shape)) else null
        val mask = ByteArray(N * 4); val relief = ByteArray(N * 4)
        for (i in 0 until N) {
            val k = i * 4
            mask[k] = if (window) 255.toByte() else a.mask[k]; mask[k + 1] = a.mask[k + 1]
            mask[k + 2] = (cov[i] * 255f * (if (spill != null) 1f - spill[i] else 1f)).roundToInt().coerceIn(0, 255).toByte(); mask[k + 3] = 255.toByte()
            relief[k] = a.relief[k]; relief[k + 1] = a.relief[k + 1]; relief[k + 2] = a.relief[k + 2]; relief[k + 3] = 255.toByte()
        }
        if (recipe.strip == 1) ecardStrip(argb, mask, W, H)
        return Maps(W, H, mask, relief)
    }

    /** The shape rasterised on the analysis grid, anti-aliased like the site's canvas fill (4 sub-rows, exact horizontal coverage). 0..1 per pixel. */
    fun coverage(s: Shape, W: Int, H: Int): FloatArray {
        val out = FloatArray(W * H); val n = s.pts.size / 2; if (n < 3) return out
        val SUB = 4; val xs = FloatArray(n * 2); val wind = IntArray(n * 2)
        for (j in 0 until H) for (sub in 0 until SUB) {
            val y = j + (sub + .5f) / SUB
            var c = 0
            for (e in 0 until n) {
                val x0 = s.pts[e * 2] * W; val y0 = s.pts[e * 2 + 1] * H; val x1 = s.pts[((e + 1) % n) * 2] * W; val y1 = s.pts[((e + 1) % n) * 2 + 1] * H
                if (y0 == y1) continue
                val lo = min(y0, y1); val hi = max(y0, y1); if (y < lo || y >= hi) continue
                xs[c] = x0 + (y - y0) * (x1 - x0) / (y1 - y0); wind[c] = if (y1 > y0) 1 else -1; c++
            }
            if (c < 2) continue
            // insertion sort crossings (small c)
            for (p in 1 until c) { val x = xs[p]; val w = wind[p]; var q = p - 1; while (q >= 0 && xs[q] > x) { xs[q + 1] = xs[q]; wind[q + 1] = wind[q]; q-- }; xs[q + 1] = x; wind[q + 1] = w }
            val row = j * W
            fun span(xa0: Float, xb0: Float) {
                val xa = max(0f, xa0); val xb = min(W.toFloat(), xb0); if (xb <= xa) return
                var i = floor(xa).toInt(); val end = ceil(xb).toInt()
                while (i < end) { out[row + i] += (min(xb, i + 1f) - max(xa, i.toFloat())) / SUB; i++ }
            }
            if (s.evenOdd) { var p = 0; while (p + 1 < c) { span(xs[p], xs[p + 1]); p += 2 } }
            else { var w = 0; for (p in 0 until c - 1) { w += wind[p]; if (w != 0) span(xs[p], xs[p + 1]) } }
        }
        for (i in out.indices) out[i] = min(1f, out[i])
        return out
    }

    /** Illustration that breaks out of its window (a head over the name bar, a tail over the attack text) is printed ink, not reverse-holo frame.
     *  Learn the frame's colours away from the art, then grow from the window edge through pixels that do not match them; an opening removes thin
     *  window borders, which really are foil. 0..1 per pixel. Pure. */
    fun artOverflow(argb: IntArray, W: Int, H: Int, box: FloatArray, reach: Float = .18f, threshold: Float = .16f): FloatArray {
        val N = W * H; val out = FloatArray(N)
        val x0 = (box[0] * W).roundToInt(); val y0 = (box[1] * H).roundToInt(); val x1 = (box[2] * W).roundToInt(); val y1 = (box[3] * H).roundToInt()
        fun inside(x: Int, y: Int) = x >= x0 && x < x1 && y >= y0 && y < y1
        fun gap(x: Int, y: Int) = max(max(x0 - x, x - x1 + 1), max(max(y0 - y, y - y1 + 1), 0))
        fun c(k: Int): FloatArray { val p = argb[k]; return floatArrayOf((p shr 16 and 255) / 255f, (p shr 8 and 255) / 255f, (p and 255) / 255f) }
        val samples = ArrayList<FloatArray>()
        run { var y = 0; while (y < H) { var x = 0; while (x < W) { if (!inside(x, y) && gap(x, y) > .05f * W) samples.add(c(y * W + x)); x += 3 }; y += 3 } }
        if (samples.size < 12 || x1 - x0 < 8 || y1 - y0 < 8) return out
        var C = Array(6) { k -> samples[floor((k + .5f) * samples.size / 6f).toInt()].copyOf() }
        for (it in 0 until 8) {
            val sum = Array(C.size) { FloatArray(4) }
            for (p in samples) {
                var b = 0; var bd = 9f
                C.forEachIndexed { k, q -> val d = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2]); if (d < bd) { bd = d; b = k } }
                val t = sum[b]; t[0] += p[0]; t[1] += p[1]; t[2] += p[2]; t[3]++
            }
            C = Array(C.size) { k -> val t = sum[k]; if (t[3] > 0) floatArrayOf(t[0] / t[3], t[1] / t[3], t[2] / t[3]) else C[k] }
            if (it == 7) C = C.filterIndexed { k, _ -> sum[k][3] >= samples.size * .05f }.toTypedArray()
        }
        val off = ByteArray(N)
        for (y in 0 until H) for (x in 0 until W) {
            if (inside(x, y) || gap(x, y) > reach * H) continue
            val p = c(y * W + x); var bd = 9f
            for (q in C) bd = min(bd, sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2])))
            if (bd > threshold) off[y * W + x] = 1
        }
        // Grow from just outside the window edge through off-palette pixels.
        val seen = ByteArray(N); val queue = IntArray(N); var qn = 0
        for (y in max(0, y0 - 2) until min(H, y1 + 2)) for (x in max(0, x0 - 2) until min(W, x1 + 2)) { val k = y * W + x; if (off[k].toInt() != 0 && gap(x, y) <= 2) { seen[k] = 1; queue[qn++] = k } }
        var qi = 0
        while (qi < qn) {
            val k = queue[qi++]; val x = k % W; val y = (k - x) / W
            for ((dx, dy) in arrayOf(1 to 0, -1 to 0, 0 to 1, 0 to -1)) {
                val nx = x + dx; val ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
                val nn = ny * W + nx; if (seen[nn].toInt() != 0 || off[nn].toInt() == 0) continue; seen[nn] = 1; queue[qn++] = nn
            }
        }
        // Opening (erode 2, dilate 3): thin frame lines vanish, real overflow survives with a soft edge.
        fun morph(src: ByteArray, r: Int, keep: Boolean): ByteArray {
            val dst = ByteArray(N)
            for (y in 0 until H) for (x in 0 until W) {
                var all = true; var any = false
                loop@ for (j in -r..r) { for (i in -r..r) { val v = src[min(H - 1, max(0, y + j)) * W + min(W - 1, max(0, x + i))].toInt() != 0; if (!v) all = false else any = true }; if (if (keep) !all else any) break@loop }
                dst[y * W + x] = if (if (keep) all else any) 1 else 0
            }
            return dst
        }
        val opened = morph(morph(seen, 2, true), 3, false)
        for (k in 0 until N) if (opened[k].toInt() != 0) { val x = k % W; val y = (k - x) / W; if (!inside(x, y)) out[k] = 1f }
        return out
    }

    /** e-Card holo rares stamp the e-Reader dashes down the left border in holo foil: in that strip the dashes are whatever is not border yellow. */
    fun ecardStrip(argb: IntArray, mask: ByteArray, W: Int, H: Int) {
        val x1 = (W * .085f).roundToInt()
        for (y in 0 until H) for (x in 0 until x1) {
            val p = argb[y * W + x]; val r = p shr 16 and 255; val g = p shr 8 and 255; val b = p and 255
            val dash = ((170 - min(r, g)) / 60f).coerceIn(0f, 1f) * (if (b < 200) 1f else 0f)
            if (dash > 0f) { val k = (y * W + x) * 4; mask[k + 2] = max(mask[k + 2].toInt() and 255, (255 * dash).roundToInt()).toByte(); mask[k] = 255.toByte() }
        }
    }

    /** The site's PTCG_FOIL_FRAGMENT as AGSL: same maths, child shaders for the card and maps, coverage read from mask B (maps are opaque, since Android
     *  premultiplies alpha), and the pattern ladders flattened into sibling ifs (Skia's parser depth cap). Verified pixel-equal to the site's WebGL on every recipe. */
    const val AGSL = """
uniform shader u_card;uniform shader u_mask;uniform shader u_relief;
uniform float2 u_size;uniform float2 u_px;uniform float2 u_map;uniform float2 u_tilt;uniform float u_aspect;
uniform float4 u_r1;uniform float4 u_r2;
const float PI=3.14159265;
float sq(float x){return x*x;}
float3 toLin(float3 c){return mix(c/12.92,pow((c+.055)/1.055,float3(2.4)),step(float3(.04045),c));}
float3 toSrgb(float3 c){return mix(c*12.92,1.055*pow(max(c,float3(0.)),float3(1./2.4))-.055,step(float3(.0031308),c));}
float hash(float2 p){p=fract(p*float2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float2 hash2(float2 p){return float2(hash(p),hash(p+17.31));}
// Smooth value noise: neighbouring cells blend, so a foil's streaks flow into each other instead of tiling.
float vnoise(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+float2(1.,0.)),f.x),mix(hash(i+float2(0.,1.)),hash(i+float2(1.,1.)),f.x),f.y);}
float3 spectrum(float l){float3 c=float3(exp(-sq((l-600.)/70.))+.35*exp(-sq((l-440.)/30.)),exp(-sq((l-540.)/60.)),exp(-sq((l-455.)/40.)));return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
// Reflection grating: light reaching the eye satisfies (L+V)·g = mλ/d along grating vector g.
float3 grating(float3 L,float3 V,float2 g,float d,float off){float s=abs(dot(L.xy+V.xy,g))+off;float3 c=float3(0.);for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);return c;}
float3 shoulder(float3 x){float3 e=max(x-.82,0.);return min(x,.82)+.18*e/(e+.18);}
float3 voro(float2 q){float2 n=floor(q),f=fract(q);float d1=8.,d2=8.;float2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float2 o=float2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return float3(id,sqrt(d2)-sqrt(d1));}
// Small printed emblems (energy-symbol sheets): a ring, a diamond, a drop-like triangle or a four-point star.
float emblem(float2 f,float h){float r=length(f),s;
 if(h<.25)s=abs(r-.24)-.07;else if(h<.5)s=abs(f.x)+abs(f.y)-.34;else if(h<.75){float2 p=f;p.y+=.08;s=max(abs(p.x)*.866+p.y*.5,-p.y)-.2;}else s=pow(abs(f.x),.5)+pow(abs(f.y),.5)-.62;
 return 1.-smoothstep(0.,.03,s);}
// Top-side coats (Poké Ball / Master Ball stamps) shine over the printed ink, only where the stamp is.
// A ball on a tiled sheet: 1 inside, with the centre band and button left bare (seam 0).
float2 ball(float2 q,float scale){float2 p=q*scale;p.x+=mod(floor(p.y),2.)*.5;float2 f=fract(p)-.5;float r=length(f);
 float inside=1.-smoothstep(.3,.32,r),band=smoothstep(.025,.045,abs(f.y)),button=smoothstep(.07,.09,r);return float2(inside*band*button,f.y);}
// Pattern -> foil radiance. N is the surface normal (relief included).
float3 foil(float pat,float tint,float2 uv,float3 L,float3 V,float3 N,float spot,float2 grad,float height,float2 stroke,out float coatMask){bool c1=false;bool c2=false;bool c3=false;
 float3 H=normalize(L+V);float2 q=float2(uv.x,uv.y*u_aspect),px=uv*u_px;float2 g=normalize(float2(.86,.5));
 float d=1550.,lines=0.,glint=0.,mirror=.35,ex=14.,amp=.75,off=0.;
 coatMask=0.;
 if(pat<1.5){c1=true;  // WotC: vertical starlight streaks that flow into one another (smooth across and along each streak)
  float2 sp=float2(q.x*55.,q.y*.7);float2 j=float2(vnoise(sp),vnoise(sp+float2(31.7,11.3)));g=normalize(float2(1.,(j.x-.5)*.12));d=1400.;off=j.y*.55;  // each streak carries its own colour
  lines=.5+.5*vnoise(float2(q.x*160.,q.y*6.));float3 w=voro(q*60.);glint=step(.93,hash(w.xy))*pow(max(dot(normalize(float3((hash2(w.xy)-.5)*.6,1.)),H),0.),60.)*1.1;amp=.85;
  // Four-point stars on three scales, fixed in the card: tilt never moves them, it only decides which ones light.
  for(int k=0;k<3;k++){float s=10.+float(k)*9.;float2 p=q*s,cc=floor(p),f=fract(p)-.5-(hash2(cc+float(k)*13.)-.5)*.5;float2 r=hash2(cc+float(k)*29.);
   float on=step(.72,r.y),star=on*(1.-smoothstep(0.,.012+.01*r.x,abs(f.x*f.y)*14.+length(f)*.09)),fire=pow(max(cos(dot(u_tilt,float2(3.5))+r.x*6.28),0.),8.);glint+=star*fire*(1.6-.35*float(k));}}
 if(!c1&&(pat<2.5)){c1=true;float3 w=voro(q*110.);float2 sm=float2(vnoise(q*28.),vnoise(q*28.+7.3));float2 j=mix(hash2(w.xy),sm,.6);float a=j.x*PI;g=float2(cos(a),sin(a));d=1100.+j.y*800.;mirror=.25;  // e-Card crystal: fine facets whose colours blend into their neighbours
  glint=pow(max(dot(normalize(float3((hash2(w.xy)-.5)*.7,1.)),H),0.),160.)*.8;amp=.72;}
 if(!c1&&(pat<3.5)){c1=true;g=normalize(float2(1.,1.));d=1400.;lines=.5+.5*sin((px.x+px.y)*1.1);mirror=.3;amp=.8;}          // EX: fine diagonal lines
 if(!c1&&(pat<4.5)){c1=true;}                                                                                              // broad sheen
 if(!c1&&(pat<5.5)){c1=true;float3 w=voro(q*170.);float2 j=mix(hash2(w.xy*1.7),float2(vnoise(q*22.),vnoise(q*22.+5.1)),.65);float a=j.x*PI;g=float2(cos(a),sin(a));d=1000.+j.y*900.;mirror=.25;  // fine sparkle, neighbouring specks share their colour
  glint=pow(max(dot(normalize(float3((hash2(w.xy*3.1)-.5)*.5,1.)),H),0.),300.)*.95;amp=.7;}
 if(!c1&&(pat<6.5)){c1=true;float on=0.;for(int k=0;k<2;k++){float s=k==0?9.:17.;float2 p=q*s,c=floor(p),f=fract(p)-.5-(hash2(c+float(k)*7.)-.5)*.4;  // cosmos circles
   float rad=.12+.26*hash(c+3.+float(k));float circ=1.-smoothstep(rad-.03,rad,length(f));if(circ>on){on=circ;float a=hash(c+9.)*PI;g=float2(cos(a),sin(a));d=1050.+hash(c+5.)*900.;}}
  float2 pq=floor(q*250.)/250.*14.,pc=floor(pq),pf=fract(pq)-.5;float ring=(1.-smoothstep(.02,.05,abs(length(pf)-.18)))*step(.8,hash(pc+21.));
  float ang=atan(pf.y,pf.x),spiral=(1.-smoothstep(.0,.05,abs(length(pf)-(.08+.05*(ang+PI))*1.)))*step(.9,hash(pc+33.));on=max(on,max(ring,spiral)*.8);
  amp=mix(.45,1.4,on);mirror=.3;lines=on;}
 if(!c1&&(pat<7.5)){c1=true;float2 p=q*5.,c=floor(p),f=fract(p)-.5;float a=atan(f.y,f.x),rr=length(f);  // Legendary Collection firework
  g=normalize(f+1e-4);d=1200.+hash(c)*600.;float rays=pow(.5+.5*cos(a*18.+hash(c)*6.28),6.)*(1.-smoothstep(.15,.5,rr));lines=rays;amp=mix(.55,1.5,rays);mirror=.3;}
 if(!c1&&(pat<8.5)){c1=true;mirror=.6;amp=.55;ex=10.;}                                                                    // plain mirror reverse
 if(!c1&&(pat<10.5)){c1=true;float2 b=ball(q,pat<9.5?7.:6.);coatMask=b.x;float a=b.y>0.?.3:-.6;if(pat>9.5)a+=.9;g=mix(g,float2(cos(a),sin(a)),b.x);  // Poké / Master Ball
  d=mix(1500.,b.y>0.?1150.:1350.,b.x);amp=mix(.35,1.35,b.x);lines=b.x;mirror=.3;
  if(pat>9.5){c2=true;float2 p=q*6.;p.x+=mod(floor(p.y),2.)*.5;float2 f=fract(p)-.5;float bumps=(1.-smoothstep(.06,.08,length(f-float2(-.15,-.12))))+(1.-smoothstep(.06,.08,length(f-float2(.15,-.12))));glint=bumps*b.x*pow(max(H.z,0.),20.);}}
 if(!c1&&(pat<11.5)){c1=true;float ph=height*55.,gr=sin(ph);float2 gn=length(grad)>1e-4?normalize(grad):float2(1.,0.);         // textured: contours of the art
  g=gn;d=1250.;lines=.5+.15*gr;N=normalize(N+float3(gn*cos(ph)*.07,0.));mirror=.4;ex=24.;amp=.72;}
 if(!c1&&(pat<12.5)){c1=true;float2 across=normalize(float2(-stroke.y,stroke.x)+1e-4);  // texture that follows the brushwork
  // The rainbow keeps one smooth diagonal, only leaning a little with the strokes: a grating that turned with every
  // stroke changed colour wherever the brushwork did, drawing coloured contour lines over the art. The brushwork
  // shows as fine raised ridges along each stroke (light, not hue).
  g=normalize(mix(float2(.86,.5),across,.18));d=1350.;lines=.5+.5*sin(dot(px,across)*1.3);N=normalize(N+float3(across*sin(dot(px,across)*1.3)*.05,0.));mirror=.35;amp=.7;}
 if(!c1&&(pat>14.5&&pat<15.5)){c1=true;  // Confetti (Celebrations Classic Collection): flakes of foil, each its own angle and colour, over a fine etched grain
  float3 w=voro(q*46.);float2 j=hash2(w.xy);float flake=step(.35,j.y)*smoothstep(0.,.05,w.z),a=j.x*PI;g=mix(float2(1.,0.),float2(cos(a),sin(a)),flake);d=mix(1500.,1050.+hash(w.xy+3.)*800.,flake);
  lines=.5+.5*sin((px.x-px.y)*.63);amp=mix(.45,1.3,flake);mirror=.3;glint=flake*pow(max(dot(normalize(float3((j-.5)*.8,1.)),H),0.),90.)*.9;}
 if(!c1&&(pat>15.5&&pat<16.5)){c1=true;  // Ancient speckle (Ancient Mew): gold foil scattered with coloured flecks of varied sizes, each lighting at its own tilt
  float2 sc=q*130.,gc=floor(sc),f=fract(sc)-.5,rn=hash2(gc);float on=step(.62,rn.y),size=.1+.22*hash(gc+4.),part=on*smoothstep(size,size*.4,length(f-(rn-.5)*.4)),trig=pow(max(0.,cos(dot(u_tilt,float2(4.5))+rn.x*6.28)),10.),a=rn.x*PI;
  g=float2(cos(a),sin(a));d=mix(1500.,1000.+hash(gc+9.)*900.,part);mirror=.35;amp=.55+1.6*part*(.35+.65*trig);lines=part;}
 if(!c1&&(pat>16.5&&pat<17.5)){c1=true;  // Emblem tiles (energy-symbol, League and set-logo reverses): rows of small raised discs, each its own angle
  float2 sc=q*9.;sc.x+=mod(floor(sc.y),2.)*.5;float2 c=floor(sc),f=fract(sc)-.5;float em=emblem(f*1.1,hash(c)),odd=mod(c.x+c.y,2.);
  g=mix(normalize(float2(1.,1.)),odd>.5?normalize(float2(.3,-.3)):normalize(float2(-.3,.3)),em);d=mix(1500.,odd>.5?1150.:1450.,em);lines=em;amp=.45+.9*em;mirror=.4;}
 if(!c1&&(pat>17.5&&pat<18.5)){c1=true;  // Cracked Ice: large shards, each its own angle and colour, with bright crack lines between them
  float3 w=voro(q*7.);float2 j=hash2(w.xy);float a=j.x*PI,crack=1.-smoothstep(0.,.035,w.z);g=float2(cos(a),sin(a));d=1050.+j.y*850.;
  amp=.95;mirror=.35;lines=.6+.4*j.y;glint=crack*pow(max(dot(normalize(float3((j-.5)*.6,1.)),H),0.),30.)*1.2;}
 if(!c1&&(pat>18.5)){c1=true;
  if(pat<19.5){c2=true; // 5 Rainbow Mirror: grain-free mirror under a diffraction film that sweeps the spectrum with the light
   g=normalize(float2(1.,1.));d=1500.;off=fract((q.x+q.y)*.55-(u_tilt.x+u_tilt.y)*.45)*.9;mirror=.55;ex=12.;amp=1.25;}
  if(!c2&&(pat<20.5)){c2=true; // 6 Big Glitter: tight hex grid of hard dots, each tilted its own way
   float2 p=q*95.;p.x+=mod(floor(p.y),2.)*.5;float2 c=floor(p),f=fract(p)-.5;float dt=1.-smoothstep(.34,.38,length(f));float2 j=hash2(c);float a=j.x*PI;
   g=mix(g,float2(cos(a),sin(a)),dt);d=mix(1500.,1050.+j.y*850.,dt);lines=dt;amp=mix(.4,1.25,dt);mirror=.3;
   glint=dt*pow(max(dot(normalize(float3((j-.5)*.9,1.)),H),0.),120.)*1.2;}
  if(!c2&&(pat<21.5)){c2=true; // 8 Energy Symbols II: two rotated scatters of emblems at two sizes
   float best=0.;for(int k=0;k<2;k++){float s=k==0?5.:11.;float2 p=k==0?q*s:float2x2(.906,-.423,.423,.906)*q*s;float2 c=floor(p),f=fract(p)-.5;float em=emblem(f,hash(c+float(k)*5.));
    if(em>best){best=em;float a=(k==0?.6:-.6)+hash(c)*.4;g=float2(cos(a),sin(a));d=1100.+hash(c+2.)*700.;}}
   lines=best;amp=mix(.45,1.35,best);mirror=.35;}
  if(!c2&&(pat<22.5)){c2=true; // 10 Pinwheel: four blades per tile, each blade its own facet angle
   float2 p=q*14.,c=floor(p),f=fract(p)-.5;float quad=(f.x>0.?1.:0.)+(f.y>0.?2.:0.),diag=step(abs(f.y),abs(f.x)),blade=mod(quad+diag,4.),a=blade*PI*.5+.4;
   g=float2(cos(a),sin(a));d=1150.+blade*120.;lines=smoothstep(0.,.04,min(abs(f.x),abs(f.y)))*smoothstep(0.,.04,abs(abs(f.x)-abs(f.y)));amp=mix(.35,1.3,lines);mirror=.3;}
  if(!c2&&(pat<23.5)){c2=true; // 11 EX Emerald: gem octagons, four-point stars and rings in a lattice
   float2 p=q*10.,c=floor(p),f=fract(p)-.5;float m=mod(c.x+2.*c.y,3.),s;
   if(m<.5)s=max(max(abs(f.x),abs(f.y)),(abs(f.x)+abs(f.y))*.707)-.32;else if(m<1.5)s=pow(abs(f.x),.5)+pow(abs(f.y),.5)-.62;else s=abs(length(f)-.26)-.05;
   float on=1.-smoothstep(0.,.03,s),a=m*1.05+hash(c)*.3;g=mix(g,float2(cos(a),sin(a)),on);d=mix(1500.,1100.+m*220.,on);lines=on;amp=mix(.4,1.35,on);mirror=.35;
   glint=on*step(.5,m)*step(m,1.5)*pow(max(dot(normalize(float3((hash2(c)-.5)*.6,1.)),H),0.),60.);}
  if(!c2&&(pat<24.5)){c2=true; // 12 Poké Ball hologram: one large ball floating in the card, lit like a sphere
   float2 dc=float2(uv.x-.5,(uv.y-.72)*u_aspect);float R=.24,rr=length(dc),inside=1.-smoothstep(R-.01,R,rr);
   float3 sn=normalize(float3(dc,sqrt(max(0.,R*R-dot(dc,dc)))));float band=smoothstep(.012,.02,abs(dc.y)),btn=smoothstep(.05,.06,rr);
   g=normalize(dc+1e-4);d=1200.+rr*1500.;lines=inside*band*btn;amp=mix(.4,1.4,lines);mirror=.3;glint=inside*band*pow(max(dot(sn,H),0.),40.)*1.3;}
  if(!c2&&(pat<25.5)){c2=true; // 13 Vertical Sheen Rainbow: brushed vertical hairlines, saturated bands sweeping left to right
   g=float2(1.,0.);d=1350.;off=fract(q.x*2.-u_tilt.x*1.5)*.8;lines=.6+.4*vnoise(float2(q.x*400.,q.y*3.));amp=1.15;mirror=.3;ex=10.;}
  if(!c2&&(pat<26.5)){c2=true; // 14 Vertical Sheen: a silvery pillar of light sliding with the tilt
   float bar=exp(-sq((uv.x-(.5+u_tilt.x*.48))*5.));g=float2(1.,0.);d=1500.;lines=bar;amp=mix(.15,.9,bar);mirror=mix(.25,.9,bar);ex=8.;}
  if(!c2&&(pat<28.5)){c2=true; // 15 Cosmos II (pixel) / 16 Cosmos III (smooth HD): bokeh orbs at several sizes, fixed in the card
   bool hd=pat>27.5;float2 qq=hd?q:floor(q*140.)/140.;float on=0.;
   for(int k=0;k<4;k++){if(!hd&&k>1)break;float s=7.+float(k)*6.;float2 p=qq*s,c=floor(p),f=fract(p)-.5-(hash2(c+float(k)*11.)-.5)*.45;
    float rad=.1+.28*hash(c+float(k)*3.),e=hd?.12:.02,circ=(1.-smoothstep(rad-e,rad,length(f)))*(hd?.85:1.);if(circ>on){on=circ;float a=hash(c+9.)*PI;g=float2(cos(a),sin(a));d=1050.+hash(c+5.)*900.;}}
   amp=mix(.4,1.35,on);mirror=hd?.35:.45;lines=on;}
  if(!c2&&(pat<30.5)){c2=true; // 17 Tinsel / 18 Tinsel II: horizontal wavy ribbons with fine vertical striations
   bool two=pat>29.5;float rows=two?52.:28.,row=floor(uv.y*rows),bh=hash(float2(row,3.)),sgn=two?mod(row,2.)*2.-1.:1.,w=sin(uv.x*400.+bh*6.28),a=PI*.5+sgn*(.35+.25*w);
   g=float2(cos(a),sin(a));d=1250.+bh*500.;lines=(.55+.45*abs(w))*(1.-smoothstep(.38,.5,abs(fract(uv.y*rows)-.5))+.3);amp=.95;mirror=.35;}
  if(!c2&&(pat<31.5)){c2=true; // 20 Diagonal Left Sheen: the mirrored -45° band
   float band=pow(.5+.5*sin((q.x-q.y)*5.5-(u_tilt.x-u_tilt.y)*4.5),3.);g=normalize(float2(1.,-1.));d=1500.;lines=band;amp=mix(.3,1.35,band);mirror=.45;ex=8.;}
  if(!c2&&(pat<32.5)){c2=true; // 21 Horizontal Sheen: a wide bar sweeping top to bottom
   float bar=exp(-sq((uv.y-(.5+u_tilt.y*.48))*5.));g=float2(0.,1.);d=1450.;lines=bar;amp=mix(.2,1.2,bar);mirror=mix(.25,.8,bar);ex=8.;}
  if(!c2&&(pat<33.5)){c2=true; // 22 Striped Vertical Sheen: the vertical pillar broken into pin-stripes
   float bar=exp(-sq((uv.x-(.5+u_tilt.x*.48))*5.)),st=pow(sin(uv.x*160.)*.5+.5,3.);g=float2(1.,0.);d=1450.;lines=bar*st;amp=mix(.2,1.3,bar*st);mirror=mix(.25,.85,bar);ex=8.;}
  if(!c2&&(pat<34.5)){c2=true; // 23 Prism: interlocking triangular facets, each a flat mirror
   float2 p=q*7.,sk=float2(p.x+p.y*.57735,p.y*1.1547),c=floor(sk),f=fract(sk);float up=step(f.x+f.y,1.);float2 j=hash2(c*2.+up);float a=j.x*PI;
   g=float2(cos(a),sin(a));d=1050.+j.y*850.;lines=.6+.4*smoothstep(0.,.05,min(min(f.x,f.y),abs(1.-f.x-f.y)));amp=1.05;mirror=.35;
   glint=pow(max(dot(normalize(float3((j-.5)*.7,1.)),H),0.),70.)*1.1;}
  if(!c2&&(pat<35.5||(pat>42.5&&pat<43.5))){c2=true; // 24 Starlight II (art box) / 33 ex Starfoil (whole card): crisp four-point stars
   bool full=pat>42.5;g=normalize(float2(1.,.3));d=1450.;mirror=.15;amp=.4;
   for(int k=0;k<3;k++){float s=full?(k==0?25.:k==1?45.:80.)*.35:9.+float(k)*8.;float2 p=q*s,cc=floor(p),f=fract(p)-.5-(hash2(cc+float(k)*13.)-.5)*.5;float2 r=hash2(cc+float(k)*29.);
    float on=step(full?.55:.7,r.y),sd=abs(f.x)*abs(f.y)*14.+length(f)*.09,star=on*(1.-smoothstep(.01,.12,sd*4.)),fire=pow(max(cos(dot(u_tilt,float2(3.5))+r.x*6.28),0.),24.);glint+=star*(.6+fire*4.)*(1.-.25*float(k));}}
  if(!c2&&(pat<36.5)){c2=true; // 25 Water Web: domain-warped caustic ridges
   // Ridges fixed in the card: tilt changes only how they catch the light.
   float2 w=q*8.+float2(vnoise(q*6.),vnoise(q*6.+float2(5.2,1.3)))*1.6;float n=vnoise(w)*2.-1.,ridge=pow(1.-abs(n),6.);
   g=normalize(float2(vnoise(w+3.)-.5,vnoise(w+7.)-.5)+1e-4);d=1150.+ridge*500.;lines=ridge;amp=mix(.4,1.4,ridge);mirror=.35;}
  if(!c2&&(pat<37.5)){c2=true; // 26 Radiant: diagonally woven micro-diamonds catching opposite tilt axes
   float wv=sin((px.x+px.y)*.9)*sin((px.x-px.y)*.9),cell=step(0.,wv);g=cell>.5?normalize(float2(1.,1.)):normalize(float2(1.,-1.));d=1250.+cell*200.;lines=.5+.5*abs(wv);amp=1.05;mirror=.35;
   glint=pow(abs(wv),8.)*pow(max(H.z,0.),30.)*.6;}
  if(!c2&&(pat<39.5)){c2=true; // 27 Rainbow Glitter / 28 Rainbow Glitter Sheen: fine coloured flakes, each lighting at its own tilt
   float3 w=voro(q*110.);float2 j=hash2(w.xy);float a=j.x*PI,trig=pow(max(0.,cos(dot(u_tilt,float2(5.))+j.y*6.28)),6.);g=float2(cos(a),sin(a));d=950.+j.y*1000.;mirror=.25;amp=.55+1.2*trig;
   glint=trig*pow(max(dot(normalize(float3((j-.5)*.7,1.)),H),0.),40.)*.8;
   if(pat>38.5){c3=true;float band=pow(.5+.5*sin((q.x+q.y)*5.5-(u_tilt.x+u_tilt.y)*4.5),3.);amp=.6*mix(.3,1.35,band)+.8*amp;lines=band;}}
  if(!c2&&(pat<40.5)){c2=true; // 29 ACE SPEC: circuit grid of squares and X crosses (magenta tint)
   float2 p=q*45.,f=fract(p)-.5;float x=min(abs(f.x-f.y),abs(f.x+f.y)),sq=abs(max(abs(f.x),abs(f.y))-.42),on=max(1.-smoothstep(0.,.06,x),1.-smoothstep(0.,.05,sq));
   float a=on>.5?.785:0.;g=float2(cos(a),sin(a));d=1300.;lines=on;amp=mix(.5,1.3,on);mirror=.4;}
  if(!c2&&(pat<41.5)){c2=true; // 31 Prismatic Poké Ball (top-side coat): radial diffraction inside each ball
   float2 b=ball(q,6.),p=q*6.;p.x+=mod(floor(p.y),2.)*.5;float2 f=fract(p)-.5;g=normalize(f+1e-4);d=900.+length(f)*2400.;off=length(f)*2.;coatMask=b.x;lines=b.x;amp=mix(.2,1.6,b.x);mirror=.3;}
  if(!c2&&(pat<42.5)){c2=true; // 32 Radiant Collection: soft pastel dots, hearts and stars with a pearly sheen
   float2 p=q*18.;p.x+=mod(floor(p.y),2.)*.5;float2 c=floor(p),f=fract(p)-.5;float h=hash(c),s;
   if(h<.4)s=length(f)-.22;else if(h<.7)s=pow(abs(f.x),.5)+pow(abs(f.y),.5)-.55;if(!c3){c3=true;float2 hp=float2(abs(f.x),f.y+.05);s=min(length(hp-float2(.09,.06))-.12,max(abs(f.x)*.9+f.y*.8-.1,-f.y-.25));}
   float on=1.-smoothstep(-.02,.06,s);g=float2(cos(h*PI),sin(h*PI));d=1250.;lines=on;amp=mix(.35,.95,on);mirror=.5;ex=4.;}
  if(!c2&&(pat<44.5)){c2=true; // 34 Sequin: overlapping cupped discs
   float2 p=q*float2(16.,22./u_aspect);p.x+=mod(floor(p.y),2.)*.5;float2 c=floor(p),f=fract(p)-.5;float disc=1.-smoothstep(.46,.48,length(f));
   g=normalize(f+1e-4);d=1100.+hash(c)*700.;N=normalize(mix(N,normalize(float3(f,.8)),disc));lines=disc;amp=mix(.4,1.25,disc);mirror=.45;ex=18.;}
  if(!c2&&(pat<45.5)){c2=true; // 35 Crosshatch: checkerboard of ±45° grooves
   float2 c=floor(q*35.);float even=mod(c.x+c.y,2.),gv=even>.5?sin((px.x+px.y)*1.6):sin((px.x-px.y)*1.6);g=even>.5?normalize(float2(1.,-1.)):normalize(float2(1.,1.));d=1350.;lines=.5+.5*gv;amp=.95;mirror=.35;}
  if(!c2&&(pat<46.5)){c2=true; // 36 TCG Classic: crushed-opal diamond dust inside, prism bars along the border
   if(min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y))<.06){float2 j=hash2(floor(uv*float2(40.,12.)));float a=j.x*PI;g=float2(cos(a),sin(a));d=1100.+j.y*800.;lines=.7;amp=1.1;mirror=.35;}
   else{float3 w=voro(q*190.);float2 j=hash2(w.xy);float a=j.x*PI;g=float2(cos(a),sin(a));d=1000.+j.y*900.;mirror=.3;amp=.8;glint=pow(max(dot(normalize(float3((j-.5)*.6,1.)),H),0.),200.)*1.3;}}
  if(!c2&&(pat<47.5)){c2=true; // 38 Acid Wash: marbled veins of raw foil
   float f1=vnoise(q*6.)*.5+vnoise(q*12.)*.25+vnoise(q*24.)*.125,vein=smoothstep(.45,.52,sin(f1*12.+u_tilt.x*.5)*.5+.5);
   g=normalize(float2(vnoise(q*9.)-.5,vnoise(q*9.+4.)-.5)+1e-4);d=1200.+f1*700.;lines=vein;amp=mix(.15,1.35,vein);mirror=mix(.2,.7,vein);}
  if(!c2){c2=true; // 39 Disco: square mirror tiles with mortar, snapping on in steps
   float2 p=uv*float2(32.,44.),c=floor(p),f=fract(p);float mortar=step(.06,f.x)*step(.06,f.y);float2 j=floor(hash2(c)*6.)/6.;float a=j.x*PI,snap=step(.8,cos(dot(u_tilt,float2(4.))+j.y*6.28));
   g=float2(cos(a),sin(a));d=1050.+j.y*900.;lines=mortar;amp=mortar*(.4+1.2*snap);mirror=.5*mortar;glint=mortar*snap*.5;}
 }
 if(!c1&&(pat>13.5)){c1=true;float band=pow(.5+.5*sin((q.x+q.y)*5.5-(u_tilt.x+u_tilt.y)*4.5),3.);g=normalize(float2(1.,1.));d=1500.;  // modern smooth 45° oil-slick band
  lines=band;amp=mix(.3,1.35,band);mirror=.45;ex=8.;}
 if(!c1){c1=true;float3 w=voro(q*200.);float2 j=hash2(w.xy);float a=j.x*PI;g=float2(cos(a),sin(a));d=1000.+j.y*900.;mirror=.2;    // shiny glitter
  glint=pow(max(dot(normalize(float3((j-.5)*.5,1.)),H),0.),260.)*2.;amp=.7;}
 float3 dif=grating(L,V,g,d,off)*amp;float spec=pow(max(dot(N,H),0.),ex);
 float3 metal=tint<.5?float3(1.):tint<1.5?float3(1.,.74,.32):tint<2.5?float3(.86,.9,.96):float3(1.,.32,.74);
 float3 col=tint<.5?dif*1.9:tint<1.5?metal*(.5*spot+.9*length(dif))*1.3:tint<2.5?metal*(.6*spot+.5*length(dif))*1.3+dif*.25:metal*(.6*spot+.6*length(dif))*1.25+dif*.45;
 return float3(.18)*metal+spot*(mirror*spec*metal+col)*(.7+.3*lines)+glint*metal;
}
float3 overInk(float3 base,float3 F,float cover){float3 T=mix(base,base/max(max(base.r,max(base.g,base.b)),.04),.32);return mix(base,shoulder(T*F*1.35),clamp(cover,0.,1.));}
float4 M(float2 uv){return u_mask.eval(uv*u_map);}
float4 R(float2 uv){return u_relief.eval(uv*u_map);}
half4 main(float2 p){
 float2 uv=p/u_size;half4 src=u_card.eval(p);float a0=src.a;if(a0<=0.)return src;
 float3 sb=float3(src.rgb)/a0;float3 base=toLin(sb);float4 mk=M(uv),rl=R(uv);float2 tx=1./u_map;
 // The site samples maps with flipped rows (v up); here uv runs down the card, so every vertical offset changes sign.
 float2 bt=tx*1.5;mk.r=(mk.r*4.+M(uv+float2(bt.x,0.)).r+M(uv-float2(bt.x,0.)).r+M(uv-float2(0.,bt.y)).r+M(uv+float2(0.,bt.y)).r)/8.;
 float2 lp=float2(.5,.45)+u_tilt*.6;float3 P=float3(uv.x,uv.y*u_aspect,0.);
 float3 L=normalize(float3(lp.x,lp.y*u_aspect,.85)-P),V=normalize(float3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 float2 dl=(uv-lp)*float2(1.,u_aspect);float spot=exp(-dot(dl,dl)/.3);
 float2 e=tx*2.;float2 grad=float2(R(uv+float2(e.x,0.)).r-R(uv-float2(e.x,0.)).r,R(uv+float2(0.,e.y)).r-R(uv-float2(0.,e.y)).r);
 float rel=u_r1.w;float3 N=normalize(float3(-grad*rel*9.,1.));float2 stroke=normalize(rl.gb*2.-1.+1e-4);
 // Coverage lives in mask B here (Android premultiplies alpha, so maps are opaque).
 float cov=smoothstep(.35,.65,mk.b)*mix(1.,smoothstep(.05,.35,mk.r),u_r1.z)*(1.-.5*u_r2.y*smoothstep(.52,.64,uv.y));
 float coatMask=0.;
 float3 F=foil(u_r1.x,u_r1.y,uv,L,V,N,spot,grad,rl.r,stroke,coatMask)*(1.+mk.g*u_r1.z*.6);

 // Reverse holos print their text, symbols and outlines in opaque ink over the foil: dark ink stays solid
 // and the foil shows through the lighter areas only. (Holo windows and full arts keep their own rules.)
 float rev=(1.-step(.5,u_r1.z))*(1.-step(.5,u_r2.y))*(1.-step(.5,u_r2.w)),ink=smoothstep(.03,.22,dot(base,float3(.2126,.7152,.0722)));
 cov*=mix(1.,ink,rev);
 // Full-art cards print the illustration in heavy white-backed ink over the foil, so the art keeps half its
 // weight there, while holo windows and reverse frames show the bare foil.
 float3 outC=overInk(base,F,cov*mix(.92,.5,u_r2.y));
 // A top-side coat is varnish stamped over the print: the stamp reflects white-silver light over whatever
 // ink is under it (never multiplied by it), and the rest of the card stays as printed.
 if(u_r2.w>.5)outC=base+(1.-base)*clamp(F*1.1-.18,0.,1.)*coatMask*cov;
 // Illustration rares keep their painting's own colour: the foil adds its sheen on top at partial strength.
 float str=u_r2.z>0.?u_r2.z:1.;outC=mix(base,outC,str);
 if(rel>0.){float rim=pow(max(dot(N,H),0.),24.)*(.35+.65*spot)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*float3(1.,.97,.92)*rim*rel*cov*.8;}
 if(u_r2.x>0.){float2 sqq=float2(uv.x,uv.y*u_aspect)*70.,sc=floor(sqq);float2 j=hash2(sc);float on=step(1.-.22*u_r2.x,j.x);
  float pt=1.-smoothstep(.0,.1+.12*j.y,length(fract(sqq)-.2-.6*hash2(sc*1.3)));
  float tw=pow(max(dot(normalize(float3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=on*pt*(.2+tw*3.)*cov*(.4+.6*spot)*float3(1.,.97,.9);}
 // Outside the foil the canvas is clear, so the card shows through exactly as printed.
 float a=smoothstep(0.,.03,cov);return half4(half3(mix(sb,toSrgb(clamp(outC,0.,1.)),a)*a0),half(a0));
}
"""
}
