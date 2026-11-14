package dev.cardstashy.nativeplay.collection

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Gap audit H2 step 4 (new beyond the website, which checks prices only while it is open): once a day at most, on an unmetered
 * network, the app checks the prices of the cards that have an alert and sends a phone notification for each one that crossed its
 * number. The site's own rule holds: no card notifies more than once a day (pricehist.js checkAlerts firedAt). Switchable in Settings
 * ("Price alert notifications", on by default); off cancels the check. Only for the signed-in account's alerts.
 */
object PriceAlertDaily {
    const val JOB_ID = 4207
    const val CHANNEL = "price-alerts"
    private const val PREFS = "play"
    const val KEY = "priceAlertDaily"
    /** Set when the notification permission has been asked once (the first Save alert). */
    const val ASKED = "priceAlertNotifyAsked"
    private const val DAY_MS = 24L * 60 * 60 * 1000

    fun enabled(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY, true)

    /** The job described: daily, unmetered network, kept across restarts. */
    internal fun job(context: Context): JobInfo =
        JobInfo.Builder(JOB_ID, ComponentName(context, PriceAlertJob::class.java))
            .setPeriodic(DAY_MS)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED)
            .setPersisted(true)
            .build()

    /** On with alerts to check: the daily check is scheduled (once; a scheduled one is left as it is). Off, or none: cancelled. */
    fun sync(context: Context, alerts: Int) {
        val js = context.getSystemService(JobScheduler::class.java) ?: return
        if (!enabled(context) || alerts == 0) { js.cancel(JOB_ID); return }
        if (js.getPendingJob(JOB_ID) == null) runCatching { js.schedule(job(context)) }
    }

    /** The check itself: this account's alerts, their prices now, a notification for each one set off. */
    suspend fun run(context: Context): List<JsonObject> {
        val app = context.applicationContext
        if (!enabled(app)) return emptyList()
        Account.init(app); CollectionEngine.init(app)
        val user = Account.session.value?.userId ?: return emptyList()
        CollectionEngine.alertOwner(user)
        if (CollectionEngine.alertList().size() == 0) { sync(app, 0); return emptyList() }
        val fired = CollectionEngine.alertCheck()
        fired.forEach { notify(app, it) }
        return fired
    }

    /** "CardStashy price alert" with the site's line (pricehist.js alertText), one per card (tag game:id); tapping opens the app. */
    fun notify(context: Context, f: JsonObject) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Price alerts", NotificationManager.IMPORTANCE_DEFAULT))
        val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = open?.let { PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
        val text = f.get("text")?.asString ?: return
        val n = android.app.Notification.Builder(context, CHANNEL)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle("CardStashy price alert")
            .setContentText(text)
            .setStyle(android.app.Notification.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .apply { pi?.let { setContentIntent(it) } }
            .build()
        val tag = "${f.get("game")?.asString}:${f.get("id")?.asString}"
        runCatching { nm.notify(tag, 1, n) }
    }
}

/** JobScheduler's daily run of [PriceAlertDaily.run]. */
class PriceAlertJob : JobService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var work: Job? = null
    override fun onStartJob(params: JobParameters): Boolean {
        work = scope.launch {
            val ok = runCatching { PriceAlertDaily.run(this@PriceAlertJob) }
                .onFailure { android.util.Log.w("PriceAlertJob", "daily check failed: ${it.message}") }.isSuccess
            jobFinished(params, !ok)
        }
        return true
    }
    override fun onStopJob(params: JobParameters): Boolean { work?.cancel(); return true }
}
