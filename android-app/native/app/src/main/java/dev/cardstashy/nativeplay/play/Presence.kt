package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Rich presence, the site's play-presence.js (web 4.3.92): accepted friends see what you are doing, e.g.
 * "Quick Play · Pauper · turn 7". A beat goes out when what the app shows changes (at most every 15 s) and every 60 s
 * while it is open; nothing in the background; nothing when Settings has it off (and a hide once). Server:
 * public.community_presence (supabase/migrations/20261104013000_community_presence.sql), same token as community_action.
 */
object Presence {
    const val MIN_GAP_MS = 15000L; const val BEAT_MS = 60000L
    data class Match(val kind: String, val format: String? = null, val turn: Int? = null, val act: Int? = null, val battle: String? = null)
    data class Where(val view: String = "", val playView: String = "", val match: Match? = null)
    data class Activity(val mode: String, val label: String, val turn: Int?)

    private val MATCH = mapOf("story" to "Story", "quick" to "Quick Play", "practice" to "Practice", "friend" to "Multiplayer")
    private val VIEW = mapOf("home" to ("lobby" to "In the Play lobby"), "lobby" to ("lobby" to "In the Play lobby"), "deeds" to ("deeds" to "Looking at achievements"),
        "shop" to ("merchant" to "At the Merchant"), "packs" to ("packs" to "Opening packs"), "decks" to ("decks" to "Building a deck"), "deck" to ("decks" to "Building a deck"),
        "finder" to ("decks" to "Building a deck"), "finderDeck" to ("decks" to "Building a deck"), "collection" to ("trunk" to "Looking through the Trunk"),
        "story" to ("story" to "Choosing a Story battle"), "storyBattle" to ("story" to "Choosing a Story battle"))

    private fun clip(s: String, n: Int = 80): String { val t = s.replace(Regex("[\\u0000-\\u001f<>]"), "").trim(); return if (t.length > n) t.take(n - 1) + "…" else t }

    /** presenceActivity(): what to tell friends, from the app's own state. */
    fun activity(w: Where): Activity {
        val m = w.match
        if (m != null && m.kind in MATCH) {
            val turn = m.turn?.takeIf { it > 0 }
            val parts = if (m.kind == "story") listOf(MATCH.getValue("story"), m.act?.takeIf { it != 0 }?.let { "Act $it" } ?: "", m.battle ?: "") else listOf(MATCH.getValue(m.kind), m.format ?: "")
            return Activity(m.kind, clip((parts.filter { it.isNotEmpty() } + (turn?.let { "turn $it" } ?: "")).filter { it.isNotEmpty() }.joinToString(" · ")), turn)
        }
        if (w.view == "play") { val v = VIEW[w.playView] ?: VIEW.getValue("home"); return Activity(v.first, v.second, null) }
        return Activity("app", "In CardStashy", null)
    }

    // ---- the sender (createPresence)
    /** What the app shows now; set by the app as screens change. */
    @Volatile var where = Where()
    /** The open table's turn, from the match poller. */
    @Volatile var matchTurn: Int? = null
    @Volatile var visible = true
    var now: () -> Long = { android.os.SystemClock.elapsedRealtime() }
    var send: suspend (String, JsonObject) -> Unit = { a, p -> dev.cardstashy.nativeplay.account.Account.presence(a, p) }
    var enabled: () -> Boolean = { dev.cardstashy.nativeplay.account.Account.session.value != null && dev.cardstashy.nativeplay.ui.AppSettings.presence }
    private var last = ""; private var lastAt = Long.MIN_VALUE / 2
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var watch: Job? = null

    private fun payload(a: Activity) = JsonObject().apply { addProperty("mode", a.mode); addProperty("label", a.label); if (a.turn != null) addProperty("turn", a.turn) else add("turn", com.google.gson.JsonNull.INSTANCE) }

    /** tick(): a beat when the activity changed (15 s gap) or a minute has passed; nothing hidden or switched off. Returns the beat it sent. */
    @Synchronized fun tick(force: Boolean = false): Activity? {
        if (!enabled() || !visible) return null
        val w = where; val a = activity(if (w.match != null) w.copy(match = w.match.copy(turn = matchTurn)) else w)
        val key = a.toString(); val t = now()
        if (key == last && !force && t - lastAt < BEAT_MS) return null
        if (key != last && !force && t - lastAt < MIN_GAP_MS) return null
        last = key; lastAt = t
        val p = payload(a); scope.launch { runCatching { send("beat", p) } }
        return a
    }

    /** start(): checks every 5 s for a change (a new turn, another screen); the gaps keep beats rare. A switched-off player sends hide once. */
    fun start() {
        if (watch?.isActive == true) return
        watch = scope.launch { while (isActive) { delay(5000); tick() } }
        if (dev.cardstashy.nativeplay.account.Account.session.value != null && !dev.cardstashy.nativeplay.ui.AppSettings.presence) scope.launch { runCatching { send("hide", JsonObject()) } }
        tick(true)
    }
    fun stop() { watch?.cancel(); watch = null }
    fun shown(on: Boolean) { visible = on; if (on) tick(true) }
    /** setShare(): the Settings switch; the server keeps the real one, so another device can't show a switched-off player. */
    suspend fun setShare(on: Boolean) { synchronized(this) { last = "" }; runCatching { send(if (on) "show" else "hide", JsonObject()) }; if (on) tick(true) }
    internal fun resetForTest() { last = ""; lastAt = Long.MIN_VALUE / 2 }
}
