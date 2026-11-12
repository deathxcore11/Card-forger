package dev.cardstashy.nativeplay.ui

import androidx.test.core.app.ApplicationProvider
import coil3.size.Dimension
import coil3.size.Scale
import coil3.size.Size
import coil3.size.SizeResolver
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Collection home, lighter C4 (specs/collection-home-lighter-brief.md): a home picture is asked for at the size of its box. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BoxArtTest {
    @Test fun theRequestCarriesTheBoxAndFillsIt() {
        val box = SizeResolver(Size(412, 248))
        val r = boxRequest(ApplicationProvider.getApplicationContext(), "https://example.invalid/cover.jpg", box)
        assertSame("the box's own size, not the picture's", box, r.sizeResolver)
        assertEquals(Size(Dimension.Pixels(412), Dimension.Pixels(248)), runBlocking { r.sizeResolver.size() })
        assertEquals("cropped to fill, as the tile draws it", Scale.FILL, r.scale)
        assertEquals("https://example.invalid/cover.jpg", r.data)
    }
}
