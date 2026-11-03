package dev.cardstashy.nativeplay

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/**
 * Finds what froze the app on the phone itself, so a fix is never a guess.
 *  1. Android keeps the trace of every "isn't responding" (ApplicationExitInfo, Android 11+), even from the
 *     previous build: on launch the newest unseen one is read and its main-thread stack kept.
 *  2. A watchdog samples the main thread whenever it stops answering for over 1.5 s and keeps those stacks too.
 * Each new section is also sent on its own, on the next launch, to the site's error log (log_client_error,
 * the same table app-errors.js writes; no account data), so nothing has to be tapped inside a frozen app.
 * Send shares a short version: the newest stall samples first, then each Android report's main thread.
 */
object FreezeReport {
    private val _text = MutableStateFlow<String?>(null)
    val text: StateFlow<String?> = _text
    private lateinit var file: File
    private lateinit var prefs: android.content.SharedPreferences

    fun init(context: Context) {
        val app = context.applicationContext
        file = File(app.filesDir, "freeze-report.txt")
        version = try { app.packageManager.getPackageInfo(app.packageName, 0).versionName ?: "?" } catch (_: Throwable) { "?" }
        Thread({
            prefs = app.getSharedPreferences("freeze", Context.MODE_PRIVATE)
            try { readExitTraces(app) } catch (_: Throwable) {}
            if (file.isFile && file.length() > 0) { _text.value = compact(file.readText()); try { upload(file.readText()) } catch (_: Throwable) {} }
        }, "freeze-report").apply { isDaemon = true; priority = Thread.MIN_PRIORITY }.start()
        watchdog()
    }

    fun dismiss() { _text.value = null; Thread { try { file.delete() } catch (_: Throwable) {} }.start() }

    fun share(context: Context) {
        val body = _text.value ?: return
        val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, "CardStashy freeze report"); putExtra(Intent.EXTRA_TEXT, body) }
        context.startActivity(Intent.createChooser(send, "Send freeze report").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @Synchronized private fun append(section: String) {
        try {
            val old = if (file.isFile) file.readText() else ""
            file.writeText((old + section).takeLast(60_000))
        } catch (_: Throwable) {}
    }

    private var version = "?"
    private fun header() = "CardStashy $version · ${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE}\n"

    private fun readExitTraces(app: Context) {
        if (Build.VERSION.SDK_INT < 30) return
        val am = app.getSystemService(ActivityManager::class.java) ?: return
        val seen = prefs.getLong("seen", 0L)
        val anrs = am.getHistoricalProcessExitReasons(app.packageName, 0, 10).filter { it.reason == ApplicationExitInfo.REASON_ANR && it.timestamp > seen }
        if (anrs.isEmpty()) return
        prefs.edit().putLong("seen", anrs.maxOf { it.timestamp }).apply()
        val a = anrs.maxBy { it.timestamp }
        val trace = try { a.traceInputStream?.bufferedReader()?.use { it.readText() } } catch (_: Throwable) { null } ?: return
        append("== Android froze report (${java.util.Date(a.timestamp)}) ==\n" + header() + (a.description ?: "") + "\n" + mainThread(trace) + "\n")
    }

    /** The report's sections ("== … ==" headings), newest stall samples first, each Android report cut to its main thread; under 7,000 characters to paste anywhere. */
    internal fun compact(all: String): String {
        val parts = all.split(Regex("(?m)^(?=== )")).filter { it.isNotBlank() }
        val stalls = parts.filter { it.startsWith("== Stall") }.takeLast(3).reversed()
        val anrs = parts.filter { it.startsWith("== Android") }.takeLast(2).reversed().map { it.take(3500) }
        return (stalls + anrs).joinToString("\n").take(7000)
    }

    /** Each section not sent yet goes to the site's error log, quietly; a failure keeps it for the next launch. */
    private fun upload(all: String) {
        val done = prefs.getStringSet("sent", emptySet())!!.toMutableSet()
        for (part in all.split(Regex("(?m)^(?=== )")).filter { it.isNotBlank() }) {
            val id = part.hashCode().toString(); if (id in done) continue
            val body = com.google.gson.JsonObject().apply {
                addProperty("app", "native"); addProperty("version", version); addProperty("platform", "android"); addProperty("screen", "")
                addProperty("message", part.lineSequence().first().take(500)); addProperty("stack", part.take(4000))
                add("trail", com.google.gson.JsonArray()); addProperty("device", "${Build.MANUFACTURER} ${Build.MODEL} Android ${Build.VERSION.RELEASE}".take(200))
            }
            try {
                dev.cardstashy.nativeplay.account.Http.call("POST", dev.cardstashy.nativeplay.account.Account.URL + "/rest/v1/rpc/log_client_error",
                    mapOf("apikey" to dev.cardstashy.nativeplay.account.Account.KEY, "Authorization" to "Bearer " + dev.cardstashy.nativeplay.account.Account.KEY),
                    com.google.gson.JsonObject().apply { add("p", body) }.toString())
                done += id; prefs.edit().putStringSet("sent", done).apply()
            } catch (_: Throwable) { return }
        }
    }

    /** The "main" thread's block of an ANR trace, plus the threads it waits on when it names one. */
    internal fun mainThread(trace: String): String {
        val blocks = trace.split(Regex("\n\\s*\n"))
        val main = blocks.firstOrNull { it.trimStart().startsWith("\"main\"") }
            ?: Regex("(?ms)^\"main\".*?(?=^\"|\\z)").find(trace)?.value
            ?: return "main thread not found; threads: " + Regex("(?m)^\"([^\"]+)\".*$").findAll(trace).joinToString(" | ") { it.value.take(90) }.take(3000)
        val waits = Regex("held by (?:thread|tid=)\\s*(\\d+)").findAll(main).map { it.groupValues[1] }.toSet()
        val held = blocks.filter { b -> waits.any { t -> Regex("tid=$t\\b").containsMatchIn(b.lineSequence().firstOrNull() ?: "") } }
        val gc = blocks.filter { it.contains("HeapTaskDaemon") || it.contains("WaitForGcToComplete") }.take(1)
        return (listOf(main) + held + gc).joinToString("\n\n").take(20_000)
    }

    /** Pings the main thread every 500 ms; while a ping goes unanswered past 1.5 s, the main stack is sampled every 1.5 s (up to 4 per stall). */
    private fun watchdog() {
        val main = Handler(Looper.getMainLooper())
        Thread({
            while (true) {
                val answered = java.util.concurrent.atomic.AtomicBoolean(false)
                val sent = SystemClock.uptimeMillis()
                main.post { answered.set(true) }
                var samples = 0
                while (!answered.get()) {
                    Thread.sleep(50)
                    val busy = SystemClock.uptimeMillis() - sent
                    if (busy >= 1500L * (samples + 1) && samples < 4) {
                        samples++
                        val st = Looper.getMainLooper().thread.stackTrace.take(45).joinToString("\n") { "    at $it" }
                        append("== Stall sample $samples: main busy $busy ms ==\n" + header() + st + "\n\n")
                    }
                }
                if (samples > 0) _text.value = try { compact(file.readText()) } catch (_: Throwable) { null }
                Thread.sleep(500)
            }
        }, "freeze-watchdog").apply { isDaemon = true; priority = Thread.MIN_PRIORITY }.start()
    }
}
