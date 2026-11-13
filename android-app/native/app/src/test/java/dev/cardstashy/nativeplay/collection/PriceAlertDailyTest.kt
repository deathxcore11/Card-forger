package dev.cardstashy.nativeplay.collection

import android.app.NotificationManager
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.Context
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Gap audit H2 step 4 (new beyond the website): the daily price check is once a day, on an unmetered network, kept across restarts,
 * runs only while there are alerts and the Settings switch is on, and notifies with the site's alert line.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class PriceAlertDailyTest {
    private val app get() = RuntimeEnvironment.getApplication()
    private val js get() = app.getSystemService(JobScheduler::class.java)
    private fun setting(on: Boolean) = app.getSharedPreferences("play", Context.MODE_PRIVATE).edit().putBoolean(PriceAlertDaily.KEY, on).commit()

    @Test fun onceADayOnWifi() {
        val j = PriceAlertDaily.job(app)
        assertTrue(j.isPeriodic); assertEquals(24L * 60 * 60 * 1000, j.intervalMillis)
        assertEquals(JobInfo.NETWORK_TYPE_UNMETERED, j.networkType)
        assertTrue(j.isPersisted)
    }

    @Test fun onlyWithAlertsAndTheSwitchOn() {
        setting(true)
        PriceAlertDaily.sync(app, 0); assertNull(js.getPendingJob(PriceAlertDaily.JOB_ID))
        PriceAlertDaily.sync(app, 2); assertNotNull(js.getPendingJob(PriceAlertDaily.JOB_ID))
        setting(false)
        PriceAlertDaily.sync(app, 2); assertNull(js.getPendingJob(PriceAlertDaily.JOB_ID))
        assertFalse(PriceAlertDaily.enabled(app))
        setting(true)
    }

    @Test fun notifiesWithTheSiteLine() {
        shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
        val f = JsonParser.parseString("""{"game":"mtg","id":"abc|nonfoil|Scryfall / TCGplayer|USD","name":"Sheoldred","usd":49.5,
            "text":"Sheoldred: now $49.50 (below your $52.7)."}""").asJsonObject
        PriceAlertDaily.notify(app, f)
        val posted = shadowOf(app.getSystemService(NotificationManager::class.java)).allNotifications
        assertEquals(1, posted.size)
        val n = posted[0]
        assertEquals("CardStashy price alert", n.extras.getString("android.title"))
        assertEquals("Sheoldred: now $49.50 (below your $52.7).", n.extras.getCharSequence("android.text").toString())
    }
}
