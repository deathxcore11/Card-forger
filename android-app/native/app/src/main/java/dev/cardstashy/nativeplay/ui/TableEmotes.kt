package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.os.SystemClock
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.random.Random

/**
 * table-emotes.mjs: a small button on your seat opens a few friendly lines, and the CPU answers now and then.
 * Presentation only: nothing here reaches Forge. Mute stays on this device.
 */
object TableEmotes {
    val EMOTES = listOf("hello" to "Hello!", "nice" to "Nice play", "thinking" to "Thinking…", "oops" to "Oops", "gg" to "Good game")
    private val REPLIES = mapOf(
        "hello" to listOf("Hello!", "Good luck.", "Greetings, planeswalker."), "nice" to listOf("Thanks!", "You too."),
        "thinking" to listOf("Take your time.", "No rush."), "oops" to listOf("It happens.", "Happens to the best of us."),
        "gg" to listOf("Good game.", "Well played."))
    private const val MUTE_KEY = "cardstashy-cpu-emotes-muted"

    class Bubble(val who: String, val text: String, val serial: Long, var leaving: Boolean = false)

    var you by mutableStateOf<Bubble?>(null); private set
    var cpu by mutableStateOf<Bubble?>(null); private set
    var menuOpen by mutableStateOf(false)
    var muted by mutableStateOf(false); private set
    var random: () -> Double = { Random.nextDouble() }
    var now: () -> Long = { SystemClock.elapsedRealtime() }

    private var prefs: android.content.SharedPreferences? = null
    private var scope: CoroutineScope? = null
    private val jobs = mutableListOf<Job>()
    private var lastYou = -1_000_000L; private var lastCpu = -1_000_000L; private var greeted = false; private var serial = 0L

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences("play", Context.MODE_PRIVATE)
        muted = try { prefs?.getBoolean(MUTE_KEY, false) == true } catch (_: Exception) { false }
    }

    /** mount(): once per match, when the match stage opens, the CPU says hello after 1.8 s (unless muted). */
    fun start(scope: CoroutineScope) {
        destroy(); this.scope = scope; greeted = false
        if (!greeted) { greeted = true; if (!muted) later(1800) { say("cpu", "Good luck, have fun.") } }
    }

    fun destroy() { jobs.forEach { it.cancel() }; jobs.clear(); you = null; cpu = null; menuOpen = false; scope = null }

    fun say(who: String, text: String) {
        val b = Bubble(who, text, ++serial)
        if (who == "you") you = b else cpu = b
        later(2600) {
            if ((if (who == "you") you else cpu)?.serial == b.serial) {
                val gone = Bubble(who, text, b.serial, leaving = true); if (who == "you") you = gone else cpu = gone
                later(260) { if ((if (who == "you") you else cpu)?.serial == b.serial) { if (who == "you") you = null else cpu = null } }
            }
        }
    }

    fun pick(id: String, label: String) {
        menuOpen = false
        if (now() - lastYou < 2500) return
        lastYou = now(); say("you", label); cpuReply(id)
    }

    private fun cpuReply(id: String) {
        if (muted || now() - lastCpu < 8000 || random() > .6) return
        lastCpu = now()
        val lines = REPLIES[id] ?: REPLIES.getValue("hello")
        later(1100 + Math.round(random() * 700)) { say("cpu", lines[(random() * lines.size).toInt().coerceIn(0, lines.lastIndex)]) }
    }

    fun toggleMute() {
        muted = !muted; menuOpen = false
        try { prefs?.edit()?.putBoolean(MUTE_KEY, muted)?.apply() } catch (_: Exception) { /* lasts this match */ }
    }

    private fun later(ms: Long, fn: () -> Unit) { val s = scope ?: return; jobs += s.launch { delay(ms); fn() } }
}
