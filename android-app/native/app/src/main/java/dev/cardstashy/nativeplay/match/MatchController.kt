package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.play.MatchFacts
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
import kotlinx.coroutines.flow.first
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

enum class Stage { STARTING, TOSS, MULLIGAN, INTRO, PLAYING, FINISHED, FAILED }

/**
 * The table's pace, owned by the client (standing rule): Forge's snapshots are queued and shown
 * at human speed. Nothing from turn 1 is drawn before the keep; then a beat and the turn banner;
 * then each CPU action alone in the feed for its tier (land 0.9 s, other 2.4 s, affects you 3.6 s),
 * 0.25 s apart. A decision for you waits with no timer. Skipping or delaying never changes the game:
 * the queue only decides when a snapshot is shown, and every action goes against Forge's latest revision.
 */
class MatchController(private val scope: CoroutineScope, val input: String, private val remote: (() -> EngineSession)? = null) {
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
    /** The coin (play-forge-pregame.js reveal): who Forge already committed to start and whether it was a flip. Shown in full before the opening hand. */
    class Toss(val youFirst: Boolean, val flip: Boolean)
    private val _toss = MutableStateFlow<Toss?>(null); val toss: StateFlow<Toss?> = _toss
    private var tossDone: CompletableDeferred<Unit>? = null
    /** The table calls this when the coin has landed and been read; the opening hand follows. */
    fun tossFinished() { tossDone?.complete(Unit) }
    private val _sending = MutableStateFlow(false); val sending: StateFlow<Boolean> = _sending
    private val _live = MutableStateFlow(false); val live: StateFlow<Boolean> = _live // shown == latest and Forge waits on you
    private val _failure = MutableStateFlow<String?>(null); val failure: StateFlow<String?> = _failure
    private val _log = MutableStateFlow<List<String>>(emptyList()); val log: StateFlow<List<String>> = _log
    /** The phase lights you stopped at (the table's track): priority there is never passed for you. */
    /**
     * A phase light (approved calm v2: tap a light, an orange ring) is Forge's own phase stop (forge-session.mjs setPhaseStop):
     * for the seat whose turn the track shows, off → pinned for the match → off. A bridge without phaseStops offers none.
     */
    fun toggleStop(label: String) {
        val st = latest ?: return
        val stops = st.phaseStops ?: return
        val phase = dev.cardstashy.nativeplay.ui.STOP_PHASE[label] ?: return
        val seat = if (st.activePlayer == st.viewer) "you" else "opponent"
        setting("phaseStop") { addProperty("seat", seat); addProperty("phase", phase); addProperty("mode", if (stops.containsKey("$seat:$phase")) "off" else "pinned") }
    }

    /** forge-table.mjs switchMode: Smart or Full Control; auto-pay keeps your own setting (the engine resets it on a switch, so it is put back). */
    fun setMode(mode: String) {
        val keep = latest?.autoPay
        if (!setting("controlMode") { addProperty("value", mode) }) return
        if (keep == null) return
        scope.launch {
            val until = SystemClock.elapsedRealtime() + 3000
            while (SystemClock.elapsedRealtime() < until && latest?.controlMode != mode) delay(100)
            val now = latest
            if (now?.controlMode == mode && now.autoPay != null && now.autoPay != keep) setting("autoPay") { addProperty("value", keep) }
        }
    }
    /** native-panel.mjs "Attack all": each offered creature joins in turn, while Forge still asks for attackers. */
    fun attackAll(ids: List<Int>) { scope.launch { for (id in ids) { val now = latest ?: break; if (now.inputType != "InputAttack" || now.prompt != null || now.lastActionError != null) break
        if (now.card(id)?.attacking == true) continue; if (!awaitLive()) break; card(id); awaitSettled(now.revision) } } }
    /** forge-table.mjs unblock: Forge drops a blocker clicked again while its attacker is in focus. */
    fun unblock(blocker: Int, attacker: Int) { scope.launch { val s = latest ?: return@launch; if (s.inputType != "InputBlock" || s.prompt != null) return@launch
        card(attacker); if (!awaitSettled(s.revision)) return@launch; val now = latest ?: return@launch
        if (now.inputType != "InputBlock" || now.prompt != null || now.lastActionError != null) return@launch; if (awaitLive()) card(blocker) } }
    private suspend fun awaitLive(): Boolean = withTimeoutOrNull(4000) { _live.first { it } } != null
    private suspend fun awaitSettled(from: Long): Boolean = withTimeoutOrNull(4000) { while (true) { val l = latest; if (l != null && l.revision > from && !l.busy && !_sending.value) break; delay(50) }; true } == true
    fun setAutoPay(on: Boolean) { setting("autoPay") { addProperty("value", on) } }
    /** Forge's own yield on a triggered ability: passes while it is on top, until your next turn. */
    fun yieldSource(id: Int, on: Boolean) { setting("yieldSource") { addProperty("id", id); addProperty("value", on) } }

    /** A settings command (forge-session.mjs SETTINGS_OPS): accepted at once, never waits for a new revision, never while Forge works or asks. */
    private fun setting(op: String, fill: JsonObject.() -> Unit): Boolean {
        val st = latest ?: return false
        if (st.prompt != null || st.inputType == "InputLockUI" || st.busy || _sending.value) return false
        val body = JsonObject().apply { addProperty("revision", st.revision); addProperty("op", op); fill() }
        scope.launch(Dispatchers.IO) {
            try { val r = session?.call("POST", "/action", body.toString()); if (r != null && r.status() != 202) Log.i(TAG, "setting $op -> ${r.status()} ${r.body()}") }
            catch (t: Throwable) { Log.w(TAG, "setting", t) }
        }
        return true
    }
    val intents by lazy { dev.cardstashy.nativeplay.ui.TableIntents(card = { card(it) }, stack = { stackItem(it) }, player = { player(it) }, ok = { ok() }, cancel = { cancel() }, reply = { id, v, i, a -> reply(id, v, i, a) },
        stop = { toggleStop(it) }, attackAll = { attackAll(it) }, unblock = { b, a -> unblock(b, a) }, mode = { setMode(it) }, autoPay = { setAutoPay(it) }, yieldSource = { id, on -> yieldSource(id, on) }) }
    val timings = MutableStateFlow<Map<String, Long>>(emptyMap())

    /** match-facts.js for this match, and the finished-match hook (play:match-recorded). */
    val facts = MatchFacts()
    @Volatile private var playedFrom: Long? = null
    @Volatile private var recorded = false
    var onFinished: ((MatchState, MatchFacts, Long?) -> Unit)? = null

    @Volatile private var session: EngineSession? = null
    @Volatile private var latest: MatchState? = null
    /** You have answered the opening hand (keep, or the cards to bottom). Until then no later snapshot is shown, in every mode. */
    @Volatile private var answeredMulligan = false
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
            val s: EngineSession = try { remote?.invoke() ?: LocalSession(ForgeService.start(input)) } catch (t: Throwable) {
                Log.e(TAG, "start failed", t); _failure.value = t.message ?: "engine_start_failed"; _stage.value = Stage.FAILED; return@launch
            }
            session = s
            val started = SystemClock.elapsedRealtime() - t0
            var lastRev = -1L; var firstState = -1L
            while (isActive) {
                var body: String? = null
                val st = try { s.call("GET", "/state", null).body().also { body = it }.let { MatchState.parse(it) } } catch (t: Throwable) { Log.w(TAG, "state", t); null }
                if (st != null) {
                    // What the table showed (match-facts.js), fed every new snapshot; the match is recorded once when Forge ends it.
                    if (st.revision != lastRev || st.finished) runCatching { facts.update(MatchFacts.surface(com.google.gson.JsonParser.parseString(body).asJsonObject)) }
                    if (playedFrom == null && st.turn > 0) playedFrom = SystemClock.elapsedRealtime()
                    dev.cardstashy.nativeplay.play.Presence.matchTurn = st.turn
                    if (st.finished && !recorded) { recorded = true; runCatching { onFinished?.invoke(st, facts, playedFrom?.let { SystemClock.elapsedRealtime() - it }) } }
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
        session?.close(); session = null
    }

    /** Tap on the feed: the current action ends now (only that one, never the whole turn). */
    fun next() { skip?.complete(Unit) }

    /** While the app is in the background the CPU's beats wait, so nothing plays out unseen. */
    private val paused = MutableStateFlow(false)
    fun setPaused(on: Boolean) { paused.value = on }

    private suspend fun hold(ms: Long) {
        paused.first { !it }
        val d = CompletableDeferred<Unit>(); skip = d
        withTimeoutOrNull(ms) { d.await() }
        skip = null
    }

    private fun masked(st: MatchState, hidden: Set<Int>): MatchState = if (hidden.isEmpty()) st else st.copy(
        players = st.players.map { p -> p.copy(battlefield = p.battlefield.filter { it.id !in hidden }) },
        stack = st.stack.filter { it.source?.id !in hidden })

    private fun show(st: MatchState) {
        _shown.value = st
        val l = latest
        _live.value = l != null && st.revision == l.revision && st.waitingOnMe && !_sending.value
        if (_live.value) { scheduleAutoPass(st); armClock(st) } else if (!_sending.value) clearClock()
    }

    // ---- The turn clock (TurnClock): runs while Forge waits on you, once per decision ----
    /** When the current decision ends, and how long it was given (for the countdown on the table). */
    class Clock(val endsAt: Long, val totalMs: Long)
    private val _clock = MutableStateFlow<Clock?>(null); val clock: StateFlow<Clock?> = _clock
    private var clockJob: Job? = null
    private var clockKey: String? = null
    private var missed = 0
    private var autoAnswering = false
    private fun clearClock() { clockJob?.cancel(); clockJob = null; clockKey = null; _clock.value = null }
    private fun armClock(st: MatchState) {
        val key = "${st.revision}:${st.prompt?.id}:${st.inputType}"
        if (key == clockKey) return
        clockJob?.cancel(); clockKey = key
        val total = TurnClock.budgetMs(st)
        _clock.value = Clock(SystemClock.elapsedRealtime() + total, total)
        clockJob = scope.launch(Dispatchers.Main) {
            delay(total)
            if (!_live.value || latest?.revision != st.revision) return@launch
            missed++
            // Friend matches only: someone who is gone for three decisions in a row concedes, so the other player is never left waiting.
            if (remote != null && missed >= TurnClock.CONCEDE_AFTER) { concede(); return@launch }
            autoAnswering = true
            try {
                when (TurnClock.answer(st)) {
                    TurnClock.Answer.OK -> ok()
                    TurnClock.Answer.CANCEL -> cancel()
                    TurnClock.Answer.SKIP -> st.prompt?.let { replySkip(it.id) }
                    TurnClock.Answer.EMPTY -> st.prompt?.let { reply(it.id, indexes = emptyList()) }
                    TurnClock.Answer.NONE -> {}
                }
            } finally { autoAnswering = false }
            clockKey = null  // the same decision may stay open (a choice that needs something); the clock runs it again
        }
    }

    private suspend fun play() {
        var gatePassed = false
        var mulliganSeen = false
        var cpuHandAtKeep = 0
        for (st in snapshots) {
            queued--
            if (st.status == "failed") {
                _failure.value = (listOf(st.failure ?: "native_failed") + st.errors).joinToString("\n"); _stage.value = Stage.FAILED; show(st); continue
            }
            // 1. Before the keep: only the mulligan screen. The CPU's own mulligan is silent.
            // The board stays closed until Forge has actually asked for the keep at least once.
            if (!gatePassed && st.isMulligan && !st.busy && (st.prompt != null || st.inputType != null)) mulliganSeen = true
            if (!gatePassed && !mulliganSeen) continue
            // A snapshot past the opening hand before you answered it is never drawn (unless the game now waits on you, so it can never stall).
            if (!gatePassed && !st.isMulligan && !answeredMulligan && !st.waitingOnMe) continue
            if (!gatePassed && st.isMulligan) {
                // The whole toss is always seen: the table shows it (once it is on screen) and answers when it is done.
                if (_toss.value == null && !answeredMulligan) {
                    val first = st.firstPlayerId ?: st.activePlayer
                    if (first != null) {
                        _toss.value = Toss(first == st.viewer, st.startSelection != "first" && st.startSelection != "second")
                        val d = CompletableDeferred<Unit>(); tossDone = d
                        _stage.value = Stage.TOSS
                        withTimeoutOrNull(20_000) { d.await() }
                        tossDone = null
                    }
                }
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
            val beats = Pacing.beatsFor(st, fresh)
            if (beats.isEmpty()) { show(st) } else {
                // The board advances one CPU action at a time: a CPU card that a beat is about to
                // announce stays off the table (and off the stack) until that beat starts.
                val before = _shown.value?.players?.flatMap { p -> p.battlefield.map { it.id } }?.toSet() ?: emptySet()
                val announced = beats.mapNotNull { (it as? Pacing.BeatStep)?.beat?.cardId }.toSet()
                val hidden = st.cpu.battlefield.map { it.id }.filter { it !in before && it in announced }.toMutableSet()
                hidden += st.stack.mapNotNull { it.source?.id }.filter { it in announced && st.card(it)?.controller != st.viewer }
                show(masked(st, hidden))
                for (b in beats) {
                    if (b is Pacing.BannerStep) { _banner.value = b.banner; hold(BANNER_MS); _banner.value = null; continue }
                    val beat = (b as Pacing.BeatStep).beat
                    if (beat.cardId != null && hidden.remove(beat.cardId)) show(masked(st, hidden))
                    beat(beat)
                }
                show(st)
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

    // ---- Your actions ----

    fun ok() = send("ok")
    fun cancel() = send("cancel")
    fun card(id: Int) = send("card") { addProperty("id", id) }
    fun stackItem(id: Int) = send("stack") { addProperty("id", id) }
    fun player(id: Int) = send("player") { addProperty("id", id) }
    fun concede() = send("concede", force = true)
    fun reply(promptId: Int, value: Boolean? = null, indexes: List<Int>? = null, amounts: List<Int>? = null) = send("reply") {
        addProperty("promptId", promptId)
        if (value != null) addProperty("value", value)
        if (indexes != null) add("indexes", JsonArray().apply { indexes.forEach { add(it) } })
        if (amounts != null) add("amounts", JsonArray().apply { amounts.forEach { add(it) } })
    }

    /** forge-session.mjs replyValue (showInputDialog), confirmPrompt with remember (order), replyAmounts(null) (skip). */
    fun replyText(promptId: Int, value: String) = send("reply") { addProperty("promptId", promptId); addProperty("value", value) }
    fun replyOrder(promptId: Int, indexes: List<Int>, remember: Boolean) = send("reply") {
        addProperty("promptId", promptId); add("indexes", JsonArray().apply { indexes.forEach { add(it) } }); addProperty("remember", remember)
    }
    fun replySkip(promptId: Int) = send("reply") { addProperty("promptId", promptId); addProperty("skip", true) }
    val dockReplies by lazy { dev.cardstashy.nativeplay.ui.DockReplies(text = { id, v -> replyText(id, v) }, order = { id, i, r -> replyOrder(id, i, r) }, skipAmounts = { replySkip(it) }) }

    private fun send(op: String, force: Boolean = false, fill: JsonObject.() -> Unit = {}) {
        val st = latest ?: return
        if (!force && (!_live.value || _sending.value)) return
        autoJob?.cancel()
        clearClock(); if (!autoAnswering && op != "concede") missed = 0
        if (st.isMulligan) answeredMulligan = true
        _sending.value = true; _live.value = false
        scope.launch(Dispatchers.IO) {
            val body = JsonObject().apply { addProperty("revision", st.revision); addProperty("op", op); fill() }
            try {
                var r = session?.call("POST", "/action", body.toString())
                // The board moved on under the tap: if it is still the same decision, send it once more on the new revision.
                if (r != null && r.status() == 409 && r.body().contains("stale_revision")) {
                    val now = session?.call("GET", "/state", null)?.body()?.let { MatchState.parse(it) }
                    if (now != null && now.inputType == st.inputType && now.prompt?.id == st.prompt?.id && !now.busy) {
                        body.addProperty("revision", now.revision)
                        r = session?.call("POST", "/action", body.toString())
                    }
                }
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
    /** A look at cards that asks nothing of you ("Looking at cards in …", a reveal). */
    private fun isReveal(st: MatchState): Boolean {
        val p = st.prompt ?: return false
        return p.min == 0 && (p.method.contains("reveal", true) || p.message.startsWith("Looking at cards", true) || p.message.contains(" reveals", true))
    }
    private fun known(st: MatchState, id: Int) = st.players.any { pl -> (pl.hand + pl.battlefield + pl.graveyard + pl.exile).any { it.id == id } } || st.stack.any { it.source?.id == id }
    private fun mine(st: MatchState, id: Int?) = id != null && st.me.let { (it.hand + it.battlefield + it.graveyard + it.exile).any { c -> c.id == id } }

    private fun scheduleAutoPass(st: MatchState) {
        autoJob?.cancel()
        // The CPU showing you its cards (an opening-hand reveal, a tutor): shown as its own beat, then
        // acknowledged for you. Its choice stays its own; nothing about it waits on a button.
        val p = st.prompt
        if (p != null && isReveal(st) && p.options.none { mine(st, it.cardId) } && p.options.all { o -> o.cardId == null || known(st, o.cardId) } && !p.message.contains("in your", true)) {
            Log.i(TAG, "reveal acknowledged for you: ${p.method} \"${p.message.take(160)}\" options=${p.options.map { it.label }}")
            autoJob = scope.launch(Dispatchers.Main) {
                val first = p.options.firstOrNull()
                _beat.value = Beat(Beat.Kind.ACTION, "CPU reveals", first?.cardId, first?.label, p.options.drop(1).joinToString(", ") { it.label }.ifBlank { null }, durationMs = ACTION_MS)
                hold(ACTION_MS)
                if (latest?.prompt?.id == p.id) { autoAnswering = true; try { reply(p.id, indexes = emptyList()) } finally { autoAnswering = false } }
            }
            return
        }
        if (st.prompt != null || st.inputType != "InputPassPriority" || st.priorityPlayer != st.viewer || !st.buttons.okEnabled || st.controlMode == "full") return
        // A stop you set on the phase track: you get priority there, whatever you hold.
        if (st.phaseStops?.containsKey("${if (st.activePlayer == st.viewer) "you" else "opponent"}:${st.phase}") == true) return
        val ownTop = st.stack.firstOrNull()?.controller == st.viewer
        val nothing = st.selection.actionable.isEmpty()
        if (!ownTop && !nothing) return
        autoJob = scope.launch(Dispatchers.Main) {
            delay(if (ownTop) 200 else 700)
            if (_live.value && latest?.revision == st.revision) { autoAnswering = true; try { ok() } finally { autoAnswering = false } }
        }
    }
}
