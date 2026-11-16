package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Rect
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Better table review: a tile tag ("No mana · skipped", "No legal target") never hangs on into a later match or onto a card that
 * comes back with the same id, and the scene 6 placement helpers keep a line and a popped card off the table.
 */
class TileTagsTest {
    @After fun off() { TileTags.clearAll() }

    @Test fun aLeftBehindTagIsNotShownOnceItsLifeIsOver() {
        TileTags.clearAll()
        TileTags.post(42, NO_MANA_SKIPPED, now = 1_000L)
        assertNotNull("shown while it lives", TileTags.tagFor(42, now = 1_000L + TAG_MS))
        // Its tile never ran (the card left the battlefield): it is stale after its whole life and the slack.
        assertNull(TileTags.tagFor(42, now = 1_000L + TAG_MS + TAG_IN_MS + TAG_OUT_MS + STALE_SLACK_MS + 1))
    }

    @Test fun aNewMatchClearsEveryTag() {
        TileTags.post(7, NO_LEGAL_TARGET, now = 0L)
        TileTags.clearAll()
        assertNull(TileTags.tagFor(7, now = 0L))
        assertEquals(0, TileTags.shown.size)
    }

    @Test fun theLineMovesToTheNearestFreeBand() {
        val words = Rect(100f, 58f, 500f, 80f)
        val lands = Rect(120f, 10f, 300f, 110f); val creatures = Rect(120f, 140f, 600f, 270f)
        val dy = freeBandDy(words, listOf(lands, creatures), top = 8f, bottom = 500f, step = 2f)
        val moved = words.translate(0f, dy)
        assertEquals("clear of both rows", false, moved.overlaps(lands) || moved.overlaps(creatures))
        assertEquals("in the gap between them", true, moved.top >= lands.bottom && moved.bottom <= creatures.top)
        assertEquals("already free: it stays", 0f, freeBandDy(Rect(0f, 0f, 10f, 10f), listOf(lands), 0f, 500f, 2f), 0f)
    }

    @Test fun thePopStaysTheStackCardWhenNothingLargerClears() {
        val self = Rect(0f, 0f, 844f, 390f)
        val stack = Rect(700f, 60f, 830f, 240f)
        // Tiles all round the stack card: no larger place is clear, so it stays the stack card in its own place.
        val tiles = listOf(Rect(560f, 0f, 699f, 390f), Rect(700f, 241f, 844f, 390f), Rect(700f, 0f, 844f, 59f))
        assertEquals(stack, popRect(stack, self, .82f, .46f, emptyList(), 10f, 8f, furniture = tiles))
    }
}
