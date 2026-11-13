package dev.cardstashy.nativeplay.collection

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Gap audit H2 step 1: price alerts run on the site's own code (pricehist.js setAlert / alertFor, app.js A.priceAlertSave's checks)
 * in the Collection engine, kept per account on this device as the site keeps them per account.
 */
class PriceAlertEngineTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    @Test fun saveCheckOpenClearPerAccount() = runBlocking {
        assumeTrue(bundle.isFile)
        val store = CollectionEngine.MemoryStore(); CollectionEngine.store = store
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.alertOwner("u1")
        CollectionEngine.load(com.google.gson.JsonObject(), null)
        val id = "f2b9983e-20d4-4d12-9e2c-ec6d9a345787|nonfoil"
        // The site's two error lines, nothing saved.
        assertEquals("Enter a price above $0 in either field.", CollectionEngine.alertSave("mtg", id, "Sheoldred", "", "0")["error"].asString)
        assertEquals("The lower price must be less than the upper price.", CollectionEngine.alertSave("mtg", id, "Sheoldred", "80", "50")["error"].asString)
        assertEquals(0, CollectionEngine.alertList().size())
        val r = CollectionEngine.alertSave("mtg", id, "Sheoldred", "52.7", "")
        assertTrue(r["ok"].asBoolean)
        val open = CollectionEngine.alertOpen("mtg", id, "Sheoldred")
        assertTrue(open["exists"].asBoolean)
        assertEquals("52.7", open["below"].asString); assertEquals("", open["above"].asString)
        // Kept on the device under this account's own key.
        assertTrue(store.kept.keys.toString(), store.kept.keys.any { it == "cardstashy-price-alerts-v1::app:u1" })
        // Another account sees none of them; back to the first, they are there.
        CollectionEngine.alertOwner("u2")
        assertEquals(0, CollectionEngine.alertList().size())
        assertFalse(CollectionEngine.alertOpen("mtg", id, "Sheoldred")["exists"].asBoolean)
        CollectionEngine.alertOwner("u1")
        assertEquals(1, CollectionEngine.alertList().size())
        // A fresh engine reads them back from the device.
        CollectionEngine.restart(); CollectionEngine.alertOwner("u1")
        assertEquals(1, CollectionEngine.alertList().size())
        CollectionEngine.alertClear("mtg", id)
        assertEquals(0, CollectionEngine.alertList().size())
    }
}
