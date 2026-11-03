package dev.cardstashy.nativeplay.match

import android.os.SystemClock
import android.util.Log
import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.ForgeService
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/** One CPU action shown in the sidebar feed. */
data class Beat(
    val kind: Kind, val title: String, val cardId: Int?, val cardName: String?, val detail: String?,
    val lifeFrom: Int? = null, val lifeTo: Int? = null, val durationMs: Long = 0,
) {
    enum class Kind { LAND, ACTION, AFFECTS_YOU }
}

data class Banner(val text: String, val yours: Boolean)

enum class Stage { STARTING, MULLIGAN, INTRO, PLAYING, FINISHED, FAILED }

/**
 * The table's pace, owned by the client (standing rule): Forge's snapshots are queued and shown
 * at human speed. Nothing from turn 1 is drawn before the keep; then a beat and the turn banner;
 * then each CPU action alone in the feed for its tier (land 0.9 s, other 2.4 s, affects you 3.6 s),
 * 0.25 s apart. A decision for you waits with no timer. Skipping or delaying never changes the game:
 * the queue only decides when a snapshot is shown, and every action goes against Forge's latest revision.
 */
class MatchController(private val scope: CoroutineScope, private val input: String) {
    companion object {
        const val LAND_MS = 900L; const val ACTION_MS = 2400L; const val AFFECTS_MS = 3600L
        const val ACTION_FLOOR_MS = 1500L; const val AFFECTS_FLOOR_MS = 2400L
        const val GAP_MS = 250L; const val BACKLOG = 3
        const val INTO_HAND_MS = 600L; const val QUIET_MS = 1000L; const val FIRST_BANNER_MS = 1600L; const val BANNER_MS = 1400L
        private const val TAG = "MatchController"
    }

    private val _shown = MutableStateFlow<MatchState?>(null); val shown: StateFlow<MatchState?> = _shown
    private val _beat = MutableStateFlow<Beat?>(null); val beat: StateFlow<Beat?> = _beat
    private val _banner = MutableStateFlow<Banner?>(null); val banner: StateFlow<Banner?> = _banner
    private val _stage = MutableStateFlow(Stage.STARTING); val stage: StateFlow<Stage> = _stage
    private val _sending = MutableStateFlow(false); val sending: StateFlow<Boolean> = _sending
    private val _live = MutableStateFlow(false); val live: StateFlow<Boolean> = _live // shown == latest and Forge waits on you
    private val _failure = MutableStateFlow<String?>(null); val failure: StateFlow<String?> = _failure
    private val _log = MutableStateFlow<List<String>>(emptyList()); val log: StateFlow<List<String>> = _log
    val timings = MutableStateFlow<Map<String, Long>>(emptyMap())

    @Volatile private var session: LocalEngine.Session? = null
    @Volatile private var latest: MatchState? = null
    private val snapshots = Channel<MatchState>(Channel.UNLIMITED)
    private var skip: CompletableDeferred<Unit>? = null
    private var lastSeq = 0L
    private var poller: Job? = null
    private var player: Job? = null
    private var autoJob: Job? = null
    private var queued = 0

    fun start() {
        poller = scope.launch(Dispatchers.IO) {
            val t0 = SystemClock.elapsedRealtime()
            val s = try { ForgeService.start(input) } catch (t: Throwable) {
                Log.e(TAG, "start failed", t); _failure.value = t.message ?: "engine_start_failed"; _stage.value = Stage.FAILED; return@launch
            }
            session = s
            val started = SystemClock.elapsedRealtime() - t0
            var lastRev = -1L; var firstState = -1L
            while (isActive) {
                val st = try { MatchState.parse(s.call("GET", "/state", null).body()) } catch (t: Throwable) { Log.w(TAG, "state", t); null }
                if (st != null) {
                    if (firstState < 0) { firstState = SystemClock.elapsedRealtime() - t0; timings.value = mapOf("startMs" to started, "firstStateMs" to firstState) }
                    // A repeat revision still counts when Forge finished working without a new one.
                    val prev = latest
                    if (st.revision != lastRev || prev == null || prev.busy != st.busy || prev.inputType != st.inputType || prev.prompt?.id != st.prompt?.id) {
                        lastRev = st.revision; latest = st; queued++; snapshots.trySend(st)
                    }
                    if (st.status == "failed" || st.finished) { if (st.finished) break }
                }
                delay(if (st?.busy != false) 50 else 120)
            }
        }
        player = scope.launch(Dispatchers.Main) { play() }
    }

    fun close() {
        poller?.cancel(); player?.cancel(); autoJob?.cancel()
        ForgeService.close(session); session = null
    }

    /** Tap on the feed: the current action ends now (only that one, never the whole turn). */
    fun next() { skip?.complete(Unit) }

    private suspend fun hold(ms: Long) {
        val d = CompletableDeferred<Unit>(); skip = d
        withTimeoutOrNull(ms) { d.await() }
        skip = null
    }

    private fun show(st: MatchState) {
        _shown.value = st
        val l = latest
        _live.value = l != null && st.revision == l.revision && st.waitingOnMe && !_sending.value
        if (_live.value) scheduleAutoPass(st)
    }

    private suspend fun play() {
        var gatePassed = false
        var cpuHandAtKeep = 0
        for (st in snapshots) {
            queued--
            if (st.status == "failed") {
                _failure.value = (listOf(st.failure ?: "native_failed") + st.errors).joinToString("\n"); _stage.value = Stage.FAILED; show(st); continue
            }
            // 1. Before the keep: only the mulligan screen. The CPU's own mulligan is silent.
            if (!gatePassed && st.isMulligan) {
                _stage.value = Stage.MULLIGAN; lastSeq = st.events.maxOfOrNull { it.seq } ?: lastSeq
                cpuHandAtKeep = st.cpu.handCount
                show(st); continue
            }
            if (!gatePassed) {
                gatePassed = true
                // 2. Into hand, a quiet beat, then the first banner.
                _stage.value = Stage.INTRO
                hold(INTO_HAND_MS); hold(QUIET_MS)
                val first = st.events.firstOrNull { it.type == "turn" && it.seq > lastSeq }
                val cpuFirst = (first?.player ?: st.activePlayer) != st.viewer
                cpuHandAtKeep = st.cpu.handCount.coerceAtLeast(cpuHandAtKeep)
                _banner.value = Banner("Turn 1 · " + if (cpuFirst) "CPU goes first" else "You go first", !cpuFirst)
                hold(FIRST_BANNER_MS); _banner.value = null
                if (first != null) lastSeq = first.seq
                _stage.value = Stage.PLAYING
                beat(Beat(Beat.Kind.LAND, "CPU kept $cpuHandAtKeep", null, null, null, durationMs = LAND_MS))
            }
            // 3. Each new event in order: turn banners and CPU actions, one at a time.
            val fresh = st.events.filter { it.seq > lastSeq }
            if (fresh.isNotEmpty()) lastSeq = fresh.maxOf { it.seq }
            val beats = beatsFor(st, fresh)
            if (beats.isEmpty()) { show(st) } else {
                show(st)
                for (b in beats) {
                    if (b is BannerStep) { _banner.value = b.banner; hold(BANNER_MS); _banner.value = null; continue }
                    beat((b as BeatStep).beat)
                }
                _shown.value?.let { show(it) }
            }
            if (st.finished) { _stage.value = Stage.FINISHED; show(st) }
        }
    }

    private suspend fun beat(b: Beat) {
        val backlog = queued > BACKLOG
        val ms = when (b.kind) {
            Beat.Kind.LAND -> LAND_MS
            Beat.Kind.ACTION -> if (backlog) ACTION_FLOOR_MS else ACTION_MS
            Beat.Kind.AFFECTS_YOU -> if (backlog) AFFECTS_FLOOR_MS else AFFECTS_MS
        }
        _beat.value = b.copy(durationMs = ms)
        _log.value = (_log.value + b.title).takeLast(60)
        hold(ms)
        _beat.value = null
        delay(GAP_MS)
    }

    private sealed interface Step
    private data class BannerStep(val banner: Banner) : Step
    private data class BeatStep(val beat: Beat) : Step

    /** CPU actions from Forge's events, sorted into the three tiers. Your own actions need no replay. */
    private fun beatsFor(st: MatchState, events: List<GameEvent>): List<Step> {
        val me = st.viewer
        val mine = (st.me.battlefield + st.me.hand).map { it.id }.toSet()
        fun touchesMe(refs: List<dev.cardstashy.nativeplay.engine.Ref>) = refs.any { (it.kind == "player" && it.id == me) || (it.kind == "card" && it.id in mine) }
        fun controllerOf(id: Int?) = id?.let { st.card(it)?.controller }
        val out = mutableListOf<Step>()
        var explainedLife = false
        for (e in events) {
            when (e.type) {
                "turn" -> if (e.turn > 1) out += BannerStep(Banner("Turn ${e.turn} · " + if (e.player == me) "Your turn" else "CPU's turn", e.player == me))
                "land" -> if (e.player != null && e.player != me) out += BeatStep(Beat(Beat.Kind.LAND, "CPU plays ${e.card?.name ?: "a land"}", e.card?.id, e.card?.name, null))
                "cast" -> if (e.player != null && e.player != me) {
                    val hits = touchesMe(e.targets)
                    val life = if (hits) lifeChange(st, events) else null
                    if (life != null) explainedLife = true
                    out += BeatStep(Beat(if (hits) Beat.Kind.AFFECTS_YOU else Beat.Kind.ACTION, "CPU casts ${e.source?.name ?: "a spell"}", e.source?.id, e.source?.name,
                        if (hits) targetText(st, e.targets) else null, life?.first, life?.second))
                }
                "trigger" -> if (controllerOf(e.source?.id)?.let { it != me } == true) {
                    val hits = touchesMe(e.targets)
                    out += BeatStep(Beat(if (hits) Beat.Kind.AFFECTS_YOU else Beat.Kind.ACTION, "${e.source?.name ?: "A CPU card"} triggers", e.source?.id, e.source?.name, if (hits) targetText(st, e.targets) else null))
                }
                "attack" -> if (e.player != null && e.player != me && e.attackers.isNotEmpty()) {
                    val names = e.attackers.map { it.first.name ?: "a creature" }
                    out += BeatStep(Beat(Beat.Kind.AFFECTS_YOU, "CPU attacks with " + names.joinToString(", "), e.attackers.first().first.id, e.attackers.first().first.name,
                        "${names.size} attacker" + if (names.size == 1) "" else "s"))
                }
                "block" -> if (e.player != null && e.player != me) out += BeatStep(Beat(Beat.Kind.ACTION, "CPU blocks", e.card?.id ?: e.source?.id, e.card?.name ?: e.source?.name, null))
            }
        }
        // Damage or drain to you that no cast above explains (combat, a trigger resolving): one red beat.
        if (!explainedLife) lifeChange(st, events)?.let { (from, to) ->
            out += BeatStep(Beat(Beat.Kind.AFFECTS_YOU, if (to < from) "You lose ${from - to} life" else "You gain ${to - from} life", null, null, null, from, to))
        }
        return out
    }

    private fun lifeChange(st: MatchState, events: List<GameEvent>): Pair<Int, Int>? {
        val mine = events.filter { it.type == "life" && it.player == st.viewer && it.lifeFrom != null && it.lifeTo != null }
        if (mine.isEmpty()) return null
        val from = mine.first().lifeFrom!!; val to = mine.last().lifeTo!!
        return if (to < from) from to to else null
    }

    private fun targetText(st: MatchState, refs: List<dev.cardstashy.nativeplay.engine.Ref>) = refs.joinToString(", ") {
        if (it.kind == "player") (if (it.id == st.viewer) "Targets you" else "Targets CPU") else "Targets ${it.name ?: "a card"}"
    }

    // ---- Your actions ----

    fun ok() = send("ok")
    fun cancel() = send("cancel")
    fun card(id: Int) = send("card") { addProperty("id", id) }
    fun player(id: Int) = send("player") { addProperty("id", id) }
    fun concede() = send("concede", force = true)
    fun reply(promptId: Int, value: Boolean? = null, indexes: List<Int>? = null, amounts: List<Int>? = null) = send("reply") {
        addProperty("promptId", promptId)
        if (value != null) addProperty("value", value)
        if (indexes != null) add("indexes", JsonArray().apply { indexes.forEach { add(it) } })
        if (amounts != null) add("amounts", JsonArray().apply { amounts.forEach { add(it) } })
    }

    private fun send(op: String, force: Boolean = false, fill: JsonObject.() -> Unit = {}) {
        val st = latest ?: return
        if (!force && (!_live.value || _sending.value)) return
        autoJob?.cancel()
        _sending.value = true; _live.value = false
        scope.launch(Dispatchers.IO) {
            val body = JsonObject().apply { addProperty("revision", st.revision); addProperty("op", op); fill() }
            try {
                val r = session?.call("POST", "/action", body.toString())
                if (r != null && r.status() != 202) Log.i(TAG, "action $op -> ${r.status()} ${r.body()}")
            } catch (t: Throwable) { Log.w(TAG, "action", t) }
            // Wait for Forge to move on (a newer revision or a finished command), never forever.
            val until = SystemClock.elapsedRealtime() + 4000
            while (SystemClock.elapsedRealtime() < until) {
                val l = latest
                if (l != null && (l.revision > st.revision || (!l.busy && l.revision == st.revision && SystemClock.elapsedRealtime() > until - 3500))) break
                delay(30)
            }
            withContext(Dispatchers.Main) { _sending.value = false; _shown.value?.let { if (queued <= 0) show(latest ?: it) } }
        }
    }

    // Smart, the way the web table plays (forge-table.mjs): your own spell on top of the stack
    // passes for you, and priority with nothing you could play passes after a short beat.
    private fun scheduleAutoPass(st: MatchState) {
        autoJob?.cancel()
        if (st.prompt != null || st.inputType != "InputPassPriority" || st.priorityPlayer != st.viewer || !st.buttons.okEnabled || st.controlMode == "full") return
        val ownTop = st.stack.firstOrNull()?.controller == st.viewer
        val nothing = st.selection.actionable.isEmpty()
        if (!ownTop && !nothing) return
        autoJob = scope.launch(Dispatchers.Main) {
            delay(if (ownTop) 200 else 700)
            if (_live.value && latest?.revision == st.revision) ok()
        }
    }
}
