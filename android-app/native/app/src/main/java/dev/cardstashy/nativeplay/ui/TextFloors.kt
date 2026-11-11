package dev.cardstashy.nativeplay.ui

/**
 * 0.4.60 Z3 (specs/table-zones-brief.md, "Text floors"): the table's smallest text sizes, as the approved mockup draws them
 * (design/roomier-table-mockup.html: name 11, squeezed 9.5, land 10, P/T 15, life 19, phase dots 8). The tile's words scale with
 * the tile on a bigger screen: the phone design's creature tile is 80 dp tall (20.5 % of 390), so a taller tile's text grows by
 * as much, up to the mockup's biggest chrome scale (1.6); a smaller tile never takes them under the floors. Pure numbers, no Compose.
 */
internal object TextFloors {
    /** The phone design's creature tile height (dp), where the floors hold as drawn. */
    const val BASE_TILE = 80f
    /** The mockup's biggest scale (its tablet). */
    const val MAX_SCALE = 1.6f
    const val NAME = 11f
    const val NAME_SQUEEZED = 9.5f
    const val LAND_NAME = 10f
    const val PT = 15f
    const val LIFE = 19f
    /** Phase dots (dp); the current step's dot is drawn bigger. */
    const val DOT = 8f
    /** Touch targets (dp). */
    const val TOUCH = 44f

    /** How much the tile's words grow for a creature tile [frontH] dp tall: 1 up to the phone's tile, then with the tile, at most 1.6. */
    fun scale(frontH: Float): Float = (frontH / BASE_TILE).coerceIn(1f, MAX_SCALE)

    /** A tile's name size (sp) before any step down: land 10, a squeezed creature 9.5, else 11, times [scale]. */
    fun nameSp(land: Boolean, squeezed: Boolean, scale: Float = 1f): Float = (if (land) LAND_NAME else if (squeezed) NAME_SQUEEZED else NAME) * scale

    /** The smallest a name may step down to so it is never cut: the floor itself, at any screen size. */
    fun nameFloor(land: Boolean, squeezed: Boolean): Float = nameSp(land, squeezed)

    /** Lines a name may take: two, three when squeezed (or overlapped, where less of the tile shows). */
    fun nameLines(squeezed: Boolean): Int = if (squeezed) 3 else 2

    /** The P/T plate's numbers (sp). */
    fun ptSp(scale: Float = 1f): Float = PT * scale
}
