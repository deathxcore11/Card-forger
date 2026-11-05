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
        val all = am.getHistoricalProcessExitReasons(app.packageName, 0, 10).filter { it.timestamp > seen }
        if (all.isEmpty()) return
        prefs.edit().putLong("seen", all.maxOf { it.timestamp }).apply()
        // How each earlier run ended: a freeze that ends with Android killing the app for memory, or with a swipe away, shows here, not as an ANR.
        all.filter { it.reason != ApplicationExitInfo.REASON_ANR }.sortedBy { it.timestamp }.forEach { e ->
            append("== App ended (${java.util.Date(e.timestamp)}): ${exitName(e.reason)} ==\n" + header() +
                "${e.description ?: ""}\nmemory at the end: pss ${e.pss / 1024} MB, rss ${e.rss / 1024} MB, importance ${e.importance}, status ${e.status}\n\n")
        }
        val anrs = all.filter { it.reason == ApplicationExitInfo.REASON_ANR }
        if (anrs.isEmpty()) return
        val a = anrs.maxBy { it.timestamp }
        val trace = try { a.traceInputStream?.bufferedReader()?.use { it.readText() } } catch (_: Throwable) { null } ?: return
        append("== Android froze report (${java.util.Date(a.timestamp)}) ==\n" + header() + (a.description ?: "") + "\n" + mainThread(trace) + "\n")
    }

    private fun exitName(r: Int) = when (r) {
        ApplicationExitInfo.REASON_LOW_MEMORY -> "killed for low memory"; ApplicationExitInfo.REASON_USER_REQUESTED -> "closed by the user"
        ApplicationExitInfo.REASON_CRASH -> "crash"; ApplicationExitInfo.REASON_CRASH_NATIVE -> "native crash"; ApplicationExitInfo.REASON_SIGNALED -> "killed by a signal"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "too much CPU or memory"; ApplicationExitInfo.REASON_USER_STOPPED -> "force stopped"
        ApplicationExitInfo.REASON_EXIT_SELF -> "exited"; ApplicationExitInfo.REASON_OTHER -> "other"; ApplicationExitInfo.REASON_FREEZER -> "frozen by the system"
        else -> "reason $r"
    }

    /** The report's sections ("== … ==" headings), newest stall samples first, each Android report cut to its main thread; under 7,000 characters to paste anywhere. */
    internal fun compact(all: String): String {
        val parts = all.split(Regex("(?m)^(?=== )")).filter { it.isNotBlank() }
        val stalls = parts.filter { it.startsWith("== Stall") }.takeLast(3).reversed()
        val ended = parts.filter { it.startsWith("== App ended") && !it.contains(": exited ==") }.takeLast(2).reversed()
        val secs = parts.filter { it.startsWith("== Section") }.takeLast(3).reversed().map { it.take(2500) }
        val blank = parts.filter { it.startsWith("== No frames") }.takeLast(2).reversed()
        val slow = parts.filter { it.startsWith("== Slow frame") }.takeLast(2).reversed().map { it.take(900) }
        val anrs = parts.filter { it.startsWith("== Android") }.takeLast(2).reversed().map { trimTrace(it).take(3500) }
        return (secs + stalls + blank + anrs + ended + slow).joinToString("\n").take(7000)
    }

    /** A section saved by 0.3.2 holds the whole thread dump; keep its heading lines and cut the dump to the main thread. */
    internal fun trimTrace(section: String): String {
        val at = section.indexOf("DALVIK THREADS").takeIf { it >= 0 } ?: return section
        val head = section.substring(0, at).lineSequence().take(14).joinToString("\n")
        return head + "\n" + mainThread(section.substring(at))
    }

    /** Each section not sent yet goes to the site's error log, quietly; a failure keeps it for the next launch. */
    private fun upload(all: String) {
        val done = prefs.getStringSet("sent", emptySet())!!.toMutableSet()
        for (part in all.split(Regex("(?m)^(?=== )")).filter { it.isNotBlank() }.map { trimTrace(it) }) {
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
        // ART names the UI thread "main" and gives it tid=1; some phones (Android 17 on a Galaxy Fold) name it otherwise, so tid=1 counts too.
        val main = blocks.firstOrNull { it.trimStart().startsWith("\"main\"") }
            ?: Regex("(?ms)^\"main\".*?(?=^\"|\\z)").find(trace)?.value
            ?: blocks.firstOrNull { b -> b.trimStart().startsWith("\"") && Regex("\\btid=1\\b").containsMatchIn(b.lineSequence().first()) }
            ?: Regex("(?ms)^\"[^\"]*\"[^\n]*\\btid=1\\b.*?(?=^\"|\\z)").find(trace)?.value
            ?: return "main thread not found; threads: " + Regex("(?m)^\"([^\"]+)\".*$").findAll(trace).joinToString(" | ") { it.value.take(90) }.take(3000)
        val waits = Regex("held by (?:thread|tid=)\\s*(\\d+)").findAll(main).map { it.groupValues[1] }.toSet()
        val held = blocks.filter { b -> waits.any { t -> Regex("tid=$t\\b").containsMatchIn(b.lineSequence().firstOrNull() ?: "") } }
        val gc = blocks.filter { it.contains("HeapTaskDaemon") || it.contains("WaitForGcToComplete") }.take(1)
        return (listOf(main) + held + gc).joinToString("\n\n").take(20_000)
    }

    /** Per Play home section: [composing, composed, placed, drawn] counts and when it first started composing. */
    private class Sec { val n = IntArray(4); var first = 0L; var placedAt = 0L; var reported = false; var lastSeen = IntArray(4) }
    private val sections = java.util.concurrent.ConcurrentHashMap<String, Sec>()
    fun section(name: String, what: Int) {
        val s = sections.getOrPut(name) { Sec() }
        if (s.first == 0L) s.first = SystemClock.uptimeMillis()
        if (what == 2 && s.placedAt == 0L) s.placedAt = SystemClock.uptimeMillis()
        s.n[what]++
    }
    internal fun sectionLine() = sections.entries.joinToString("; ") { (k, v) -> "$k composing ${v.n[0]} composed ${v.n[1]} placed ${v.n[2]} drawn ${v.n[3]}" }

    /** Every 2 s: a section composing over 40 times since the last check is looping; one placed on screen over 3 s ago that never drew is stuck. */
    private fun checkSections() {
        val now = SystemClock.uptimeMillis()
        for ((k, v) in sections) {
            if (v.reported) continue
            val d = IntArray(4) { v.n[it] - v.lastSeen[it] }; v.lastSeen = v.n.copyOf()
            val loop = d[0] > 40
            val stuck = v.placedAt > 0 && now - v.placedAt > 3000 && v.n[3] == 0
            if (!loop && !stuck) continue
            v.reported = true
            val main = Looper.getMainLooper().thread.stackTrace.take(40).joinToString("\n") { "    at $it" }
            append("== Section ${if (loop) "looping" else "never drawn"}: $k ==\n" + header() +
                "in the last 2 s: composing ${d[0]} composed ${d[1]} placed ${d[2]} drawn ${d[3]}; started ${now - v.first} ms ago\nall: ${sectionLine()}\n" + memory() + "\nmain now:\n" + main + "\n\n")
            try { if (::prefs.isInitialized) upload(file.readText()) } catch (_: Throwable) {}
        }
    }

    /** Every picture decoded (Coil): the biggest ones and the running total, to see if one image is what fills memory. */
    private val images = java.util.concurrent.ConcurrentHashMap<String, Long>()
    @Volatile private var imageCount = 0
    fun image(url: String, w: Int, h: Int, bytes: Long) { imageCount++; images["${w}x$h ${url.takeLast(90)}"] = bytes }
    private fun imageLine(): String {
        val top = images.entries.sortedByDescending { it.value }.take(6).joinToString("; ") { "${it.value / 1024} KB ${it.key}" }
        return "images decoded $imageCount, distinct ${images.size}, ${images.values.sum() / (1024 * 1024)} MB; biggest: $top"
    }

    @Volatile private var lastTouch = 0L
    @Volatile private var lastFrame = 0L
    private val touches = java.util.ArrayDeque<String>()
    private var slowLogged = 0

    /** Called from MainActivity.dispatchTouchEvent: when the finger went down or up, kept to tell "no frames after a touch". */
    fun touched(ev: android.view.MotionEvent) {
        val a = ev.actionMasked; val now = SystemClock.uptimeMillis()
        // A drag moves something on every screen here (scroll, card lean), so a move with no frame after it is a stuck screen.
        if (a == android.view.MotionEvent.ACTION_MOVE) { lastTouch = now; return }
        if (a != android.view.MotionEvent.ACTION_DOWN && a != android.view.MotionEvent.ACTION_UP) return
        synchronized(touches) { touches.addLast("${if (a == 0) "down" else "up"}@$now"); while (touches.size > 6) touches.removeFirst() }
    }

    private fun memory(): String = (try {
        val mi = android.os.Debug.MemoryInfo(); android.os.Debug.getMemoryInfo(mi)
        "memory: total ${mi.totalPss / 1024} MB, graphics ${mi.getMemoryStat("summary.graphics")?.toIntOrNull()?.div(1024)} MB, " +
            "java ${mi.getMemoryStat("summary.java-heap")?.toIntOrNull()?.div(1024)} MB, native ${mi.getMemoryStat("summary.native-heap")?.toIntOrNull()?.div(1024)} MB"
    } catch (_: Throwable) { "memory: ?" }) + "\n" + imageLine()

    /**
     * Every frame's timings arrive on a background thread (FrameMetrics). A frame over 700 ms is kept with where its time went
     * (input, layout, draw, sync, GPU commands, swap, GPU). A second check catches the frozen case where no frame comes at all:
     * a touch more than 3 s old with no frame drawn since, while the main thread still answers. It keeps every thread's
     * stack and the memory split, and sends it right away, since the network still works while the screen is stuck.
     */
    fun watchFrames(activity: android.app.Activity) {
        if (Build.VERSION.SDK_INT < 26) return
        val ht = android.os.HandlerThread("frame-metrics", android.os.Process.THREAD_PRIORITY_BACKGROUND).apply { start() }
        val h = Handler(ht.looper)
        activity.window.addOnFrameMetricsAvailableListener({ _, m, _ ->
            lastFrame = SystemClock.uptimeMillis()
            val total = m.getMetric(android.view.FrameMetrics.TOTAL_DURATION) / 1_000_000
            if (total < 700 || slowLogged >= 12) return@addOnFrameMetricsAvailableListener
            slowLogged++
            fun ms(id: Int) = m.getMetric(id) / 1_000_000
            val gpu = if (Build.VERSION.SDK_INT >= 31) ", gpu ${ms(android.view.FrameMetrics.GPU_DURATION)}" else ""
            append("== Slow frame: $total ms ==\n" + header() +
                "input ${ms(android.view.FrameMetrics.INPUT_HANDLING_DURATION)}, animation ${ms(android.view.FrameMetrics.ANIMATION_DURATION)}, " +
                "layout ${ms(android.view.FrameMetrics.LAYOUT_MEASURE_DURATION)}, draw ${ms(android.view.FrameMetrics.DRAW_DURATION)}, " +
                "sync ${ms(android.view.FrameMetrics.SYNC_DURATION)}, commands ${ms(android.view.FrameMetrics.COMMAND_ISSUE_DURATION)}, " +
                "swap ${ms(android.view.FrameMetrics.SWAP_BUFFERS_DURATION)}$gpu, unknown delay ${ms(android.view.FrameMetrics.UNKNOWN_DELAY_DURATION)}\n" + memory() + "\n\n")
        }, h)
        Thread({
            var reported = 0L; var tick = 0
            while (true) {
                Thread.sleep(500)
                if (++tick % 4 == 0) try { checkSections() } catch (_: Throwable) {}
                val now = SystemClock.uptimeMillis(); val t = lastTouch
                if (t == 0L || t == reported || lastFrame >= t || now - t < 3000 || !activity.hasWindowFocus()) continue
                reported = t
                val stacks = Thread.getAllStackTraces().entries.filter { it.value.isNotEmpty() }.sortedBy { if (it.key.name == "main") 0 else 1 }.take(14)
                    .joinToString("\n") { (th, st) -> "\"${th.name}\" ${th.state}\n" + st.take(if (th.name == "main") 30 else 8).joinToString("\n") { "    at $it" } }
                val tr = synchronized(touches) { touches.joinToString(" ") }
                append("== No frames: ${now - t} ms since the last drag, last frame ${if (lastFrame == 0L) "never" else "${now - lastFrame} ms ago"} ==\n" + header() +
                    "touches $tr, now $now\nsections: ${sectionLine()}\n" + memory() + "\n" + stacks + "\n\n")
                try { if (::prefs.isInitialized) upload(file.readText()) } catch (_: Throwable) {}
            }
        }, "frame-watch").apply { isDaemon = true; priority = Thread.MIN_PRIORITY }.start()
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
                            .ifEmpty { "    (Android gave no stack: the main thread could not be paused to read it)" }
                        // The stack first and the section counts cut short, so the uploaded part (4,000 characters) always keeps the stack.
                        append("== Stall sample $samples: main busy $busy ms ==\n" + header() + st + "\nsections: ${sectionLine().take(600)}\n\n")
                    }
                }
                if (samples > 0) Thread { try { if (::prefs.isInitialized) upload(file.readText()) } catch (_: Throwable) {} }.start()
                if (samples > 0) _text.value = try { compact(file.readText()) } catch (_: Throwable) { null }
                Thread.sleep(500)
            }
        }, "freeze-watchdog").apply { isDaemon = true; priority = Thread.MIN_PRIORITY }.start()
    }
}
