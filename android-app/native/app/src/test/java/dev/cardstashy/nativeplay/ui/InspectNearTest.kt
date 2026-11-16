package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Rect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Better table scene 13: where the read card and its panels stand beside the tile. */
class InspectNearTest {
    private fun noCover(p: InspectNear.Place, tile: Rect) {
        assertTrue("card covers tile", !p.card.overlaps(tile))
        assertTrue("panels cover tile", !Rect(p.panelX, 0f, p.panelX + p.panelW, 1000f).overlaps(Rect(tile.left, 0f, tile.right, 1000f)))
    }

    @Test fun foldTileOnTheLeftOpensRight() {
        // The preview's scene: tile at 13-31 % of a 10:9 table; the card right of it, 27 % wide, the panels beyond.
        val tile = Rect(110f, 400f, 270f, 520f)
        val p = InspectNear.place(852f, 764f, tile, 1f)!!
        assertTrue(p.right); assertTrue(!p.panelsAcross)
        assertEquals(tile.right + InspectNear.GAP, p.card.left, .01f)
        assertEquals(852f * .27f, p.card.width, 1f)
        assertTrue(p.panelX >= p.card.right); assertTrue(p.panelX + p.panelW <= 852f + .01f)
        assertEquals(tile.center.y, p.card.center.y, .01f)
        noCover(p, tile)
    }

    @Test fun rightTileOpensLeft() {
        val tile = Rect(620f, 200f, 720f, 280f)
        val p = InspectNear.place(812f, 358f, tile, .7f)!!
        assertTrue(!p.right); assertTrue(p.card.right <= tile.left)
        assertTrue(p.card.top >= 0f && p.card.bottom <= 358f)
        noCover(p, tile)
    }

    @Test fun middleTilePutsPanelsAcross() {
        // Room for the card on one side only: the panels go to the tile's other side.
        val tile = Rect(330f, 100f, 470f, 200f)
        val p = InspectNear.place(800f, 600f, tile, 1f)!!
        assertTrue(p.panelsAcross)
        assertTrue(p.panelX >= 0f && p.panelX + p.panelW <= 800f)
        noCover(p, tile)
    }

    @Test fun noRoomFallsBack() {
        assertNull(InspectNear.place(300f, 300f, Rect(100f, 100f, 200f, 200f), 1f))
    }

    @Test fun tappedTileIsUntilted() {
        val r = Rect(0f, 0f, 100f, 140f)
        val c = Math.cos(Math.toRadians(20.0)).toFloat(); val s = Math.sin(Math.toRadians(20.0)).toFloat()
        val turned = Rect(0f, 0f, 100f * c + 140f * s, 100f * s + 140f * c)
        val back = InspectNear.untilt(turned, true)
        assertEquals(100f, back.width, .5f); assertEquals(140f, back.height, .5f)
        assertEquals(r, InspectNear.untilt(r, false))
    }
}
