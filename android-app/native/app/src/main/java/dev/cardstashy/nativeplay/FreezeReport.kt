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
 * Nothing leaves the phone unless the player taps Send, which opens the share sheet with the report text.
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
            if (file.isFile && file.length() > 0) _text.value = file.readText()
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

    /** The "main" thread's block of an ANR trace, plus the threads it waits on when it names one. */
    internal fun mainThread(trace: String): String {
        val blocks = trace.split(Regex("\n\\s*\n"))
        val main = blocks.firstOrNull { it.trimStart().startsWith("\"main\"") } ?: return trace.take(8000)
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
                if (samples > 0) _text.value = try { file.readText() } catch (_: Throwable) { null }
                Thread.sleep(500)
            }
        }, "freeze-watchdog").apply { isDaemon = true; priority = Thread.MIN_PRIORITY }.start()
    }
}
