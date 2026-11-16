package dev.cardstashy.nativeplay.match

import com.google.gson.JsonObject

/**
 * 0.4.59 T10, the board's light foil: which of your cards wear it, and its timing. The finish comes from your deck's own rows
 * (a row's "finish" foil or etched, or "foil": true), never guessed: a name is foil only when every row of it says so, since
 * Forge does not tell copies of one name apart. The CPU's lists carry no finish, so its cards never wear it.
 */
object BoardFoil {
    /** Your foil names (lower case) for the match on the table. */
    @Volatile var yours: Set<String> = emptySet(); private set

    fun arm(rows: List<Pair<String, JsonObject>>) { yours = names(rows) }
    fun clear() { yours = emptySet() }

    private fun foilRow(r: JsonObject): Boolean? {
        val f = r.get("finish")?.takeIf { it.isJsonPrimitive }?.asString?.lowercase()
        if (f != null && f.isNotBlank()) return f == "foil" || f == "etched"
        val b = r.get("foil")?.takeIf { it.isJsonPrimitive } ?: return null
        return if (b.asJsonPrimitive.isBoolean) b.asBoolean else null
    }

    /** The names whose every row is foil (a row that says nothing is not foil). */
    fun names(rows: List<Pair<String, JsonObject>>): Set<String> =
        rows.groupBy({ it.first.lowercase() }, { it.second }).filterValues { rs -> rs.all { foilRow(it) == true } }.keys

    /** Is this card on the board yours and foil: owned by you (the controller's side, or the other side for a card that changed hands). */
    fun wears(name: String, ownerIsYou: Boolean): Boolean = ownerIsYou && name.lowercase() in yours

    const val SHEEN_MS = 9_000L
    const val BAND_EVERY_MS = 8_000L
    const val BAND_MS = 2_200L
    /** Tapped tiles show it at about a third. */
    const val TAPPED = .33f

    /** The sheen's drift corner to corner and back: 0 to 1 over [SHEEN_MS], then back. */
    fun sheen(t: Long): Float { val p = (t.mod(2 * SHEEN_MS)).toFloat() / SHEEN_MS; return if (p <= 1f) p else 2f - p }

    /** Each tile's own start in the band's 8 s, so foil tiles never flash together. */
    fun bandOffset(id: Int): Long = ((id.toLong() * 2_654_435_761L) and 0xFFFFFFFL).mod(BAND_EVERY_MS)

    /** Where the band is across the tile (0 to 1), or null while it rests; [kick] (when it landed or took the ring) plays it once more. */
    fun band(t: Long, id: Int, kick: Long?): Float? {
        if (kick != null && t >= kick && t - kick < BAND_MS) return (t - kick).toFloat() / BAND_MS
        val p = (t + bandOffset(id)).mod(BAND_EVERY_MS)
        return if (p < BAND_MS) p.toFloat() / BAND_MS else null
    }
}
