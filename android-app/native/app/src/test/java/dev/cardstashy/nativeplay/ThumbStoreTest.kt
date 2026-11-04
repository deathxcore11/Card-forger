package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.art.ThumbStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ThumbStoreTest {
    @Test fun keys() {
        assertEquals("a9738cda-adb1-47fb-9f4c-ecd930228c4d-front", ThumbStore.key("https://cards.scryfall.io/normal/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg?1626098250"))
        assertEquals("a9738cda-adb1-47fb-9f4c-ecd930228c4d-back", ThumbStore.key("https://cards.scryfall.io/normal/back/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg"))
        assertNull(ThumbStore.key("https://cards.scryfall.io/art_crop/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg"))
        assertNull(ThumbStore.key("https://svgs.scryfall.io/card-symbols/R.svg"))
    }

    @Test fun storedFileAnswers() {
        ThumbStore.init(RuntimeEnvironment.getApplication())
        val url = "https://cards.scryfall.io/normal/front/0/1/01234567-89ab-cdef-0123-456789abcdef.jpg"
        assertNull(ThumbStore.local(url))
        ThumbStore.file(url)!!.writeBytes(byteArrayOf(1, 2, 3))
        assertEquals(ThumbStore.file(url), ThumbStore.local(url))
        assertEquals(false, ThumbStore.setDone("dsk"))
        ThumbStore.clear(); assertNull(ThumbStore.local(url))
    }
}
