package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.play.MatchFacts
import android.os.SystemClock
import android.util.Log
import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.ForgeService
import dev.cardstashy.nativeplay.engine.Card
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
const val NO_RESULT = "This match hit a choice the app cannot play yet. It will not count."

class MatchController(private val scope: CoroutineScope, val input: String, private val remote: (() -> EngineSession)? = null) {
    companion object {
        const val LAND_MS = 900L; const val ACTION_MS = 2400L; const val AFFECTS_MS = 3600L
        const val ACTION_FLOOR_MS = 1500L; const val AFFECTS_FLOOR_MS = 2400L
        const val GAP_MS = 250L; const val BACKLOG = 3; const val STEP_GAP_MS = 120L
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
        if (now.inputType != "InputBlock" || now.prompt != null || now.lastActionError != null) return@launch; if (awaitLive()) { card(blocker); if (awaitSent() && latest?.card(blocker)?.blocking != true) pairs.remove(blocker) } } }
    /**
     * forge-table.mjs dropCombat (block): Forge pairs a block as two clicks, the attacker and then the blocker. A creature
     * already blocking another attacker leaves that block first (it blocks one), and a block that does not take says so.
     */
    fun block(blocker: Int, attacker: Int) { scope.launch {
        val s = latest ?: return@launch; if (s.inputType != "InputBlock" || s.prompt != null) return@launch
        val me = s.card(blocker) ?: return@launch
        val was = me.blockingIds.firstOrNull()
        if (me.blocking && was == attacker) return@launch
        if (me.blocking && was != null) { if (!clickPair(was, blocker) || latest?.card(blocker)?.blocking == true) { say("Block not assigned. Try again."); return@launch }; pairs.remove(blocker) }
        // A block Forge refuses says why when the cards show it (flying, tapped, can't block), else the site's line.
        fun refused() = say(s.card(attacker)?.let { dev.cardstashy.nativeplay.ui.blockRefusal(it, me) } ?: "Block not assigned. Try again.")
        if (!clickPair(attacker, blocker)) { refused(); return@launch }
        val now = latest ?: return@launch
        if (now.card(blocker)?.blocking == true) { pairs[blocker] = attacker; latest = paired(now); _shown.value?.let { if (it.revision == now.revision) show(latest!!) } }
        else if (now.inputType == "InputBlock" && now.prompt == null) refused()
    } }

    /**
     * Who blocks whom. The app's engine marks a blocker but does not name its attacker (the host's names it as blockingIds), so
     * the table fills it in: your own pairings as you make them, the attacker Forge has in focus when you tap a creature
     * ("Select creatures to block Savannah Lions (117) …"), and Forge's block events once blocks are declared.
     */
    private val pairs = java.util.concurrent.ConcurrentHashMap<Int, Int>()
    internal fun paired(st: MatchState): MatchState {
        val field = st.players.flatMap { it.battlefield }
        if (field.none { it.blocking }) { if (st.inputType != "InputBlock") pairs.clear(); return st }
        val attackers = field.filter { it.attacking }.map { it.id }.toSet()
        for (e in st.events) if (e.type == "block" && e.turn == st.turn) for ((b, a) in e.blockers) if (a != null && a in attackers) pairs[b.id] = a
        if (field.none { it.blocking && it.blockingIds.isEmpty() }) return st
        val focus = if (st.inputType == "InputBlock") Regex("\\((\\d+)\\)").find(st.message)?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in attackers } else null
        fun pairOf(c: Card): Int? = pairs[c.id]?.takeIf { it in attackers }
            ?: (if (c.controller == st.viewer && focus != null) focus.also { pairs[c.id] = it } else null)
            ?: attackers.singleOrNull()
        return st.copy(players = st.players.map { p -> p.copy(battlefield = p.battlefield.map { c ->
            if (c.blocking && c.blockingIds.isEmpty()) pairOf(c)?.let { c.copy(blockingIds = listOf(it)) } ?: c else c }) })
    }
    /** Two clicks Forge reads as one pairing; the second only when Forge took the first and still asks the same question. */
    private suspend fun clickPair(first: Int, second: Int): Boolean {
        if (!awaitLive()) return false
        val input = latest?.inputType
        card(first); if (!awaitSent()) return false
        val now = latest ?: return false
        if (now.inputType != input || now.prompt != null || now.lastActionError != null) return false
        if (!awaitLive()) return false
        card(second); return awaitSent()
    }
    /** The last action has gone through (send() clears its flag once Forge has moved on, never later than 4 s). */
    private suspend fun awaitSent(): Boolean = withTimeoutOrNull(6000) { _sending.first { !it } } != null
    /** A short line over the table ("Block not assigned. Try again."), gone after a few seconds. */
    private val _note = MutableStateFlow<String?>(null); val note: StateFlow<String?> = _note
    private fun say(text: String) { scope.launch(Dispatchers.Main) { _note.value = text; delay(3500); if (_note.value == text) _note.value = null } }
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
        stop = { toggleStop(it) }, attackAll = { attackAll(it) }, unblock = { b, a -> unblock(b, a) }, block = { b, a -> block(b, a) }, mode = { setMode(it) }, autoPay = { setAutoPay(it) }, yieldSource = { id, on -> yieldSource(id, on) }, note = { say(it) }) }
    val timings = MutableStateFlow<Map<String, Long>>(emptyMap())

    /** match-facts.js for this match, and the finished-match hook (play:match-recorded). */
    val facts = MatchFacts()
    @Volatile private var playedFrom: Long? = null
    @Volatile private var recorded = false
    var onFinished: ((MatchState, MatchFacts, Long?) -> Unit)? = null

    @Volatile private var session: EngineSession? = null
    @Volatile private var latest: MatchState? = null
    /** A Story lesson's engine keeps your opening seven (setup.noMulligan): Forge never asks, so there is no keep to wait for. */
    private val keepsOpeningHand = runCatching { com.google.gson.JsonParser.parseString(input).asJsonObject.getAsJsonObject("input")
        ?.getAsJsonObject("setup")?.get("noMulligan")?.asBoolean == true }.getOrDefault(false)
    /** You have answered the opening hand (keep, or the cards to bottom). Until then no later snapshot is shown, in every mode. */
    @Volatile private var answeredMulligan = keepsOpeningHand
    private val snapshots = Channel<MatchState>(Channel.UNLIMITED)
    /** Your opening hand's names as soon as Forge deals it (read off the polled board, before the table shows it): the art gate waits for these. */
    private val _firstHand = MutableStateFlow<List<String>?>(null); val firstHand: StateFlow<List<String>?> = _firstHand
    private var skip: CompletableDeferred<Unit>? = null
    private var lastSeq = 0L
    private var poller: Job? = null
    private var player: Job? = null
    private var autoJob: Job? = null
    /** Snapshots waiting to be shown. Counted on the polling thread and the main thread both, so atomic: a plain count
     *  drifted, and a drifted count kept a decision from ever going live after your tap (a stuck table). */
    private val queue = java.util.concurrent.atomic.AtomicInteger(0)
    private val queued get() = queue.get()

    fun start() {
        poller = scope.launch(Dispatchers.IO) {
            val t0 = SystemClock.elapsedRealtime()
            val s: EngineSession = try { remote?.invoke() ?: LocalSession(ForgeService.start(input)) } catch (t: Throwable) {
                Log.e(TAG, "start failed", t); _failure.value = t.message ?: "engine_start_failed"; _stage.value = Stage.FAILED; return@launch
            }
            session = s
            val started = SystemClock.elapsedRealtime() - t0
            poll(s, t0, started)
        }
        player = scope.launch(Dispatchers.Main) { play() }
        startWatch()
    }

    /** Forge's board, read every 50-120 ms; restarted by the stuck watch if a read never comes back. */
    private suspend fun poll(s: EngineSession, t0: Long, started: Long) {
            val job = kotlinx.coroutines.currentCoroutineContext()
            var lastRev = latest?.revision ?: -1L; var firstState = if (latest != null) 0L else -1L
            while (job.isActive) {
                var body: String? = null
                readAsked = SystemClock.elapsedRealtime()
                val st = try { s.call("GET", "/state", null).body().also { body = it }.let { MatchState.parse(it) }?.let { paired(it) } } catch (t: Throwable) { Log.w(TAG, "state", t); null }
                readAt = SystemClock.elapsedRealtime()
                if (st != null) {
                    // What the table showed (match-facts.js), fed every new snapshot; the match is recorded once when Forge ends it.
                    if (st.revision != lastRev || st.finished) runCatching { facts.update(MatchFacts.surface(com.google.gson.JsonParser.parseString(body).asJsonObject)) }
                    if (st.revision != lastRev) dev.cardstashy.nativeplay.art.TableFacts.note(st)
                    if (playedFrom == null && st.turn > 0) playedFrom = SystemClock.elapsedRealtime()
                    dev.cardstashy.nativeplay.play.Presence.matchTurn = st.turn
                    if (st.finished && !recorded) { recorded = true; runCatching { onFinished?.invoke(st, facts, playedFrom?.let { SystemClock.elapsedRealtime() - it }) } }
                    if (firstState < 0) { firstState = SystemClock.elapsedRealtime() - t0; timings.value = mapOf("startMs" to started, "firstStateMs" to firstState)
                        Log.i("Speed", "engine started in $started ms, first state read at $firstState ms (from controller.start)") }
                    if (remote != null && st.revision >= hostRev) { hostRev = st.revision
                        hostClock = st.hasAfk to st.afk?.let { it to SystemClock.elapsedRealtime() } }
                    // A repeat revision still counts when Forge finished working without a new one.
                    val prev = latest
                    if (st.revision != lastRev || prev == null || prev.busy != st.busy || prev.inputType != st.inputType || prev.prompt?.id != st.prompt?.id) {
                        if (st.revision != lastRev) revisionAt = SystemClock.elapsedRealtime()
                        TableLog.board("read", st, latest?.revision)
                        if (_firstHand.value == null) runCatching { st.me.hand.map { it.name }.filter { it.isNotBlank() } }.getOrNull()?.takeIf { it.isNotEmpty() }?.let { _firstHand.value = it }
                        lastRev = st.revision; latest = st; queue.incrementAndGet(); snapshots.trySend(st)
                    }
                    if (st.status == "failed" || st.finished) { if (st.finished) break }
                }
                delay(if (st?.busy != false) 50 else 120)
            }
    }

    fun close() {
        poller?.cancel(); player?.cancel(); autoJob?.cancel(); ticker?.cancel(); watch?.cancel(); timer.stop(); CombatPace.release()
        session?.close(); session = null
    }

    /** Tap on the feed: the current action ends now (only that one, never the whole turn). */
    fun next() { skip?.complete(Unit) }

    /** While the app is in the background the CPU's beats wait, so nothing plays out unseen. */
    private val paused = MutableStateFlow(false)
    fun setPaused(on: Boolean) { paused.value = on }
    /** A Story scene over the table: the clock holds and the first turn waits until it ends, so nothing is missed behind it. */
    private val scene = MutableStateFlow(false)
    fun setScene(on: Boolean) { scene.value = on }

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
        if (_shown.value?.revision != st.revision) TableLog.board("show", st, latest?.revision)
        _shown.value = st
        val l = latest
        _live.value = l != null && st.revision == l.revision && st.waitingOnMe && !_sending.value
        if (_live.value) scheduleAutoPass(st)
        startTicker()
    }

    // ---- The turn clock (TurnClock.Timer, the site's turn-timer.mjs): ticks every 250 ms while the match is on ----
    /** What the table draws: when the window ends (or how much is left while it holds), its full length, and whose it is. */
    class Clock(val endsAt: Long, val totalMs: Long, val frozenLeft: Long? = null, val own: Boolean = true)
    private val _clock = MutableStateFlow<Clock?>(null); val clock: StateFlow<Clock?> = _clock
    /** "One more missed turn and you concede." for 7 s, friend matches only. */
    private val _afkNote = MutableStateFlow<String?>(null); val afkNote: StateFlow<String?> = _afkNote
    private var autoAnswering = false
    private var noteJob: Job? = null
    /** A line under the clock for 7 s (the same place as the missed-turn warning). */
    private fun note(text: String) { noteJob?.cancel(); noteJob = scope.launch { _afkNote.value = text; delay(7000); _afkNote.value = null } }
    /** A card pop-up, the menu or a held card: the clock holds while any is open. */
    private val holds = HashSet<String>()
    fun hold(reason: String, on: Boolean) { if (on) holds.add(reason) else holds.remove(reason) }
    private val timer = TurnClock.Timer(
        snapshot = { latest?.takeIf { (_stage.value == Stage.PLAYING || _stage.value == Stage.MULLIGAN) && _noResult.value == null } },
        paused = { paused.value || scene.value || holds.isNotEmpty() || _beat.value != null || _think.value != null || _sending.value || _shown.value?.revision != latest?.revision },
        act = { w, st, done ->
            autoAnswering = true
            try {
                when (val a = TurnClock.answer(w, st)) {
                    // A dead-end prompt: against the CPU the match ends as no result; with a friend the old reply still goes out (the host decides).
                    TurnClock.Answer.Leave -> if (remote == null) leaveNoResult() else st.prompt?.let { p -> reply(p.id, indexes = p.options.take(maxOf(0, p.min)).map { it.index }) }
                    is TurnClock.Answer.Prompt -> reply(a.id, indexes = a.indexes)
                    TurnClock.Answer.Cancel -> cancel()
                    TurnClock.Answer.Ok -> ok()
                    // A friend match only (against the CPU the discard waits for you): say plainly which card went.
                    is TurnClock.Answer.Discard -> { card(a.id); note("Time ran out. Discarded ${a.name}.") }
                }
            } finally { autoAnswering = false }
            done(true)
        },
        concede = { concede() },
        onChange = { c -> val now = SystemClock.elapsedRealtime()
            _clock.value = c?.let { Clock(now + it.remaining, it.total, if (it.paused) it.remaining else null, it.own) } },
        onStrike = { n, limit -> if (limit != null && n == limit - 1) scope.launch { _afkNote.value = "One more missed turn and you concede."; delay(7000); _afkNote.value = null } },
        friend = remote != null,
        onNag = { note("Time's up. Choose a card to discard.") },
        now = { SystemClock.elapsedRealtime() },
        host = { hostClock },
    )
    /** The host's clock as last received (it changes without a new revision), with its arrival time. Never rewound by an older board. */
    @Volatile private var hostClock: Pair<Boolean, Pair<dev.cardstashy.nativeplay.engine.Afk, Long>?> = false to null
    private var hostRev = -1L
    private var ticker: Job? = null
    private fun startTicker() { if (ticker == null) ticker = scope.launch(Dispatchers.Main) { while (true) { timer.tick(); delay(250) } } }
    /** Any touch of the table says you are here. */
    fun poke() = timer.poke()

    // The pacing loop's place, kept outside it so the stuck watch can restart a loop that stopped without replaying the intro.
    private var gatePassed = false
    private var mulliganSeen = keepsOpeningHand
    private var cpuHandAtKeep = 0
    private suspend fun play() {
        for (st in snapshots) {
            queue.decrementAndGet(); progressAt = SystemClock.elapsedRealtime()
            // Staged combat still playing on the board: the next board waits for it (a touch skips it).
            CombatPace.await()
            if (st.status == "failed") {
                _failure.value = (listOf(st.failure ?: "native_failed") + st.errors).joinToString("\n"); _stage.value = Stage.FAILED; show(st); continue
            }
            // 1. Before the keep: only the mulligan screen. The CPU's own mulligan is silent.
            // The board stays closed until Forge has actually asked for the keep at least once.
            if (!gatePassed && st.isMulligan && !st.busy && (st.prompt != null || st.inputType != null)) mulliganSeen = true
            if (!gatePassed && !mulliganSeen) continue
            // A lesson's opening seven is kept by the engine: the deal is never drawn as a choice, the table opens on turn 1.
            if (!gatePassed && keepsOpeningHand && st.isMulligan) continue
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
                        if (withTimeoutOrNull(20_000) { d.await() } == null) Log.w(TAG, "toss: not finished on screen in 20 s, the keep goes on without it")
                        tossDone = null
                    }
                }
                _stage.value = Stage.MULLIGAN; lastSeq = st.events.maxOfOrNull { it.seq } ?: lastSeq
                cpuHandAtKeep = st.cpu.handCount
                show(st); continue
            }
            if (!gatePassed) {
                scene.first { !it }
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
                beat(Beat(Beat.Kind.LAND, "CPU kept $cpuHandAtKeep", null, null, null), LAND_MS)
            }
            // 3. Each new event in order: turn banners and CPU actions, one at a time.
            val fresh = st.events.filter { it.seq > lastSeq }
            if (fresh.isNotEmpty()) lastSeq = fresh.maxOf { it.seq }
            // The director (specs/match-director-native.md): every new event becomes a step; the controller is the only clock and
            // waits on the held ones (a CPU think, the turn banner, a CPU action's caption), one at a time.
            val steps = Director.plan(st, fresh, if (remote == null) thinkClock else null).filter { it.held }
            TableLog.line("plan rev=${st.revision} fresh=${fresh.size} [${fresh.joinToString(",") { it.type }}] steps=${steps.size} shown=${_shown.value?.revision} queue=${queue.get()}")
            if (steps.isEmpty()) { show(st) } else {
                // The board advances one CPU action at a time: a CPU card that a step is about to
                // announce stays off the table (and off the stack) until that step starts.
                val before = _shown.value?.players?.flatMap { p -> p.battlefield.map { it.id } }?.toSet() ?: emptySet()
                val announced = steps.mapNotNull { it.beat?.cardId }.toSet()
                val hidden = st.cpu.battlefield.map { it.id }.filter { it !in before && it in announced }.toMutableSet()
                hidden += st.stack.mapNotNull { it.source?.id }.filter { it in announced && st.card(it)?.controller != st.viewer }
                show(masked(st, hidden))
                steps.forEachIndexed { i, step ->
                    val waiting = latest?.waitingOnMe == true
                    val ms = Director.lengthOf(step, waiting, steps.drop(i).sumOf { it.ms })
                    TableLog.line("step ${i + 1}/${steps.size} ${step.kind} ${step.cardName ?: step.beat?.title ?: step.banner?.text ?: ""} ${ms}ms cpu=${step.cpu} hidden=${hidden.size}")
                    when {
                        step.kind == Director.Kind.THINK -> think(ms, st.cpu.handCount)
                        step.banner != null -> { _banner.value = step.banner; hold(ms); _banner.value = null }
                        step.beat != null -> {
                            if (step.beat.cardId != null && hidden.remove(step.beat.cardId)) show(masked(st, hidden))
                            beat(step.beat, ms)
                        }
                    }
                }
                show(st)
            }
            if (st.finished) { _stage.value = Stage.FINISHED; show(st) }
        }
    }

    private suspend fun beat(b: Beat, ms: Long) {
        _beat.value = b.copy(durationMs = ms)
        _log.value = (_log.value + b.title).takeLast(60)
        hold(ms)
        _beat.value = null
        delay(STEP_GAP_MS)
    }

    /** The CPU's think times (section 5): ranged, never twice the same, capped per turn. */
    private val thinkClock = Director.ThinkClock()
    /** While the CPU thinks: the dots by its portrait and which of its hand's card backs is lifted (the tell). */
    private val _think = CpuThink.now

    /** A think step: one card back lifts, holds and settles; 60 % of the time a second one does the same (reference think()). */
    private suspend fun think(ms: Long, hand: Int) {
        try { thinkInner(ms, hand) } finally { _think.value = null }
    }
    private suspend fun thinkInner(ms: Long, hand: Int) {
        if (ms <= 0) return
        val r = java.util.Random()
        val first = if (hand > 0) r.nextInt(hand) else null
        _think.value = CpuThink.Tell(first)
        if (first != null && hand > 1 && r.nextDouble() < .6) {
            hold(ms * 55 / 100)
            _think.value = CpuThink.Tell(null); hold(200)
            _think.value = CpuThink.Tell((first + 1 + r.nextInt(hand - 1)) % hand)
            hold((ms * 45 / 100 - 200).coerceAtLeast(0))
        } else hold(ms)
        _think.value = null
    }

    // ---- Your actions ----

    fun ok() = send("ok")
    fun cancel() = send("cancel")
    fun card(id: Int) = send("card") { addProperty("id", id) }
    fun stackItem(id: Int) = send("stack") { addProperty("id", id) }
    fun player(id: Int) = send("player") { addProperty("id", id) }
    /** The player conceded this match (play-forge-player-mat.js conceding): a loss that way stays off the Quick Play streak. */
    @Volatile var conceded = false; private set
    fun concede() { conceded = true; send("concede", force = true) }

    /**
     * E3c: the match met a choice the app cannot play (Prompt.deadEnd). Against the CPU it ends here as no result: nothing is
     * recorded (no win, no loss, no reward, no streak change), the report goes out by itself, and the table shows [noResult]
     * with the way back. A friend match is left as it is: only the host can end it.
     */
    private val _noResult = MutableStateFlow<String?>(null)
    val noResult: StateFlow<String?> = _noResult
    val canLeaveNoResult: Boolean get() = remote == null
    fun leaveNoResult() {
        if (remote != null || _noResult.value != null) return
        recorded = true
        val p = latest?.prompt
        runCatching { dev.cardstashy.nativeplay.FreezeReport.matchStuck("dead-end prompt", "method ${p?.method} supported ${p?.supportedExact} ordered ${p?.ordered} options ${p?.options?.map { it.kind ?: "plain" }?.distinct()} message ${p?.rawMessage?.take(200)}") }
        _noResult.value = NO_RESULT
    }
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
    val dockReplies by lazy { dev.cardstashy.nativeplay.ui.DockReplies(leave = if (remote == null) ({ leaveNoResult() }) else null, text = { id, v -> replyText(id, v) }, order = { id, i, r -> replyOrder(id, i, r) }, skipAmounts = { replySkip(it) }) }

    private fun send(op: String, force: Boolean = false, fill: JsonObject.() -> Unit = {}) {
        val st = latest ?: return
        if (!force && (!_live.value || _sending.value)) return
        autoJob?.cancel()
        if (!autoAnswering && op != "concede") timer.poke()
        // W1: your own "To <step>" press on an empty stack carries the whole way: if Forge hands priority back in the same step of the
        // same turn with nothing new (no stack, no question), it is passed again for you. Anything else you press clears it.
        if (!autoAnswering) { carries = 0; passSeq = st.events.maxOfOrNull { it.seq } ?: 0L }
        if (!autoAnswering) passFrom = if (op == "ok" && st.inputType == "InputPassPriority" && st.prompt == null && st.stack.isEmpty() && st.activePlayer == st.viewer) st.turn to st.phase else null
        if (st.isMulligan) answeredMulligan = true
        _sending.value = true; _live.value = false; sendingAt = SystemClock.elapsedRealtime()
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
                TableLog.line("send ${body} prompt=${st.prompt?.id} input=${st.inputType} auto=$autoAnswering -> ${r?.status()}")
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

    // ---- The stuck watch (Randall, 5 Nov: "a lot of getting stuck ... detect that and fix it") ----
    // Every second: can the match move? Forge waiting on you must be a table that takes your taps, and a board Forge has
    // moved on must reach the screen. When either has held too long the watch frees it, and each time it sends a short
    // report of what was held (FreezeReport, quietly), so the cause can be fixed too.
    @Volatile private var progressAt = SystemClock.elapsedRealtime()
    @Volatile private var sendingAt = 0L
    @Volatile private var readAsked = 0L
    @Volatile private var readAt = SystemClock.elapsedRealtime()
    @Volatile private var revisionAt = SystemClock.elapsedRealtime()
    private var watch: Job? = null
    private val stuckSince = HashMap<String, Long>()
    private val engineReported = HashSet<Long>()
    /** How many times the watch freed the table this match (the tests read it). */
    @Volatile var freed = 0; private set
    private fun startWatch() { if (watch == null) watch = scope.launch(Dispatchers.Main) { while (isActive) { delay(1000); runCatching { watchOnce() }.onFailure { Log.w(TAG, "watch", it) } } } }

    internal fun watchOnce(now: Long = SystemClock.elapsedRealtime()) {
        val stage = _stage.value
        if ((stage != Stage.PLAYING && stage != Stage.MULLIGAN) || paused.value || session == null) { stuckSince.clear(); return }
        val l = latest ?: return
        val on = _shown.value ?: return
        val calm = _beat.value == null && _banner.value == null && autoJob?.isActive != true
        fun held(kind: String, cond: Boolean, ms: Long): Boolean {
            if (!cond) { stuckSince.remove(kind); return false }
            val t = stuckSince.getOrPut(kind) { now }; if (now - t < ms) return false
            stuckSince.remove(kind); return true
        }
        // 1. A tap went out and never came back: the sending flag would hold every later tap.
        if (held("send", _sending.value && now - sendingAt > 9000, 0)) free("send", l) { _sending.value = false; show(latest ?: on) }
        // 2. Forge waits on you and the table shows that very moment, yet it takes no taps.
        if (held("live", l.waitingOnMe && on.revision == l.revision && !_live.value && !_sending.value && calm, 2500)) free("live", l) { show(l) }
        // 3. Forge has moved on, nothing is playing out, and the pacing loop takes no new board: restart the loop where it was.
        if (stage == Stage.PLAYING && held("behind", on.revision != l.revision && calm && !scene.value && now - progressAt > 6000, 6000)) free("behind", l) {
            player?.cancel(); player = scope.launch(Dispatchers.Main) { play() }
            if (queued <= 0) show(l)
        }
        // 4. A board read that never came back: start reading again.
        if (held("read", readAsked > readAt && now - readAsked > 15000, 0)) free("read", l) {
            val s = session ?: return@free
            poller?.cancel(); poller = scope.launch(Dispatchers.IO) { poll(s, 0, 0) }; readAt = now
        }
        // 5. Forge itself has not moved for a minute while it is not waiting on you (working, or on the CPU): the cause is in
        // the engine, so this is only reported, once per board.
        if (!l.waitingOnMe && !l.finished && l.status == "running" && now - revisionAt > 60_000 && engineReported.add(l.revision))
            dev.cardstashy.nativeplay.FreezeReport.matchStuck("engine", describe(l, on))
    }

    private inline fun free(kind: String, l: MatchState, fix: () -> Unit) {
        val what = describe(l, _shown.value)
        Log.w(TAG, "stuck ($kind), freeing: $what")
        TableLog.line("stuck ($kind) freed: " + what.replace('\n', ' '))
        freed++
        fix()
        dev.cardstashy.nativeplay.FreezeReport.matchStuck(kind, what)
    }

    private fun describe(l: MatchState, on: MatchState?): String = buildString {
        val now = SystemClock.elapsedRealtime()
        append("input=${l.inputType} prompt=${l.prompt?.let { "${it.method} \"${it.message.take(120)}\" options=${it.options.size}" }} busy=${l.busy} status=${l.status}\n")
        append("turn=${l.turn} phase=${l.phase} active=${l.activePlayer} priority=${l.priorityPlayer} viewer=${l.viewer} message=\"${l.message.take(160)}\"\n")
        append("revision latest=${l.revision} shown=${on?.revision} live=${_live.value} sending=${_sending.value} (${if (sendingAt > 0) now - sendingAt else -1} ms) queued=$queued\n")
        append("beat=${_beat.value?.title} banner=${_banner.value?.text} stage=${_stage.value} paused=${paused.value} scene=${scene.value} holds=$holds\n")
        append("loop idle ${now - progressAt} ms, board unchanged ${now - revisionAt} ms, last read ${now - readAt} ms ago, mode=${l.controlMode} remote=${remote != null}\n")
        append("last events: " + l.events.takeLast(6).joinToString(" | ") { "${it.type} ${it.card?.name ?: ""}".trim() })
    }

    // Smart, the way the web table plays (forge-table.mjs): your own spell on top of the stack
    // passes for you, and priority with nothing you could play passes after a short beat.
    /** A look at cards that asks nothing of you ("Looking at cards in …", a reveal). */
    private fun isReveal(st: MatchState): Boolean {
        val p = st.prompt ?: return false
        // A search ("Select a card from your library", chooseSingleEntityForEffect, min 0 because you may find nothing) is a
        // choice even when the card's text says "reveal it": it is never answered for you.
        if (p.method.endsWith("ForEffect") || p.message.startsWith("Select", true)) return false
        return p.min == 0 && (p.method.contains("reveal", true) || p.message.startsWith("Looking at cards", true) || p.message.contains(" reveals", true))
    }
    private fun known(st: MatchState, id: Int) = st.players.any { pl -> (pl.hand + pl.battlefield + pl.graveyard + pl.exile).any { it.id == id } } || st.stack.any { it.source?.id == id }
    private fun mine(st: MatchState, id: Int?) = id != null && st.me.let { (it.hand + it.battlefield + it.graveyard + it.exile).any { c -> c.id == id } }

    /** W1: the (turn, step) where you pressed the gold "To <step>" button; Forge stopping there again is passed for you. */
    private var passFrom: Pair<Int, String?>? = null
    /** The newest engine event when you pressed: anything after it (a CPU spell, a trigger) is "something new" and stops the carry. */
    private var passSeq = 0L
    private var carries = 0
    private val shortCasts = dev.cardstashy.nativeplay.ui.ShortCasts()
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
        val d = decide(st)
        TableLog.line("decide ${st.phase} turn ${st.turn} input=${st.inputType} -> ${d.op ?: "wait"} (${d.why})")
        val op = d.op ?: return
        autoJob = scope.launch(Dispatchers.Main) {
            delay(d.delayMs)
            if (_live.value && latest?.revision == st.revision) { autoAnswering = true; try { if (op == "cancel") cancel() else ok() } finally { autoAnswering = false } }
        }
    }

    private class Decision(val op: String?, val why: String, val delayMs: Long = 0)

    /** A permanent whose only abilities make mana (a land, a mana rock): tapping it is never a reason to stop for you (W7, W8). */
    private fun manaOnly(c: dev.cardstashy.nativeplay.engine.Card): Boolean {
        val acts = c.text.lines().map { it.replace(Regex("\\([^)]*\\)"), "").trim() }.filter { it.contains(":") }
        if (acts.isEmpty()) return c.isLand
        return acts.all { Regex("\\badd\\b", RegexOption.IGNORE_CASE).containsMatchIn(it.substringAfter(":")) }
    }

    /**
     * W1, W7, W8: the one place that decides whether the table waits on you. It waits only while Forge offers you a real choice you
     * can make now: a card or ability it lists as actionable that is not plainly unpayable (ShortCasts) and is not only a mana ability;
     * a block with a creature that could block. Otherwise the step is passed for you, after its normal beat. Your phase stops and full
     * control still stop. Every decision is logged under TableStep as one "decide" line.
     */
    private fun decide(st: MatchState): Decision {
        if (st.prompt != null || !st.buttons.okEnabled) return Decision(null, "a question or no button")
        val stopHere = st.phaseStops?.containsKey("${if (st.activePlayer == st.viewer) "you" else "opponent"}:${st.phase}") == true
        if (st.inputType == "InputBlock") {
            if (st.controlMode == "full" || stopHere) return Decision(null, "blocks: your stop")
            val can = st.me.battlefield.filter { it.isCreature && !it.tapped }
            return if (can.isEmpty()) Decision("ok", "blocks: no untapped creature can block", 900)
            else Decision(null, "blocks: ${can.size} could block (${can.take(4).joinToString(",") { it.name }})")
        }
        if (st.inputType != "InputPassPriority" || st.priorityPlayer != st.viewer) return Decision(null, "not a priority pass")
        // W1: the step you already pressed through, offered again with nothing new: carry on to the step the button named.
        val again = passFrom
        if (again != null) {
            if (again.first == st.turn && again.second == st.phase && st.stack.isEmpty() && st.activePlayer == st.viewer && carries < 3 &&
                st.events.none { it.seq > passSeq && it.type !in setOf("turn", "phase", "priority") }) {
                carries++
                return Decision("ok", "carry: ${st.phase} offered again after your press", 150)
            }
            if (again.first != st.turn || again.second != st.phase || st.stack.isNotEmpty()) passFrom = null
        }
        if (st.controlMode == "full") return Decision(null, "full control")
        if (stopHere) return Decision(null, "your phase stop")
        val ownTop = st.stack.firstOrNull()?.controller == st.viewer
        if (ownTop) return Decision("ok", "your own spell or ability on top", 200)
        // Smart auto-pass (director spec 6a): Forge sometimes lists a card you plainly can't pay for as actionable ("unknown"
        // affordability, a {1}{R} creature with one land out). Those don't count, nor do mana abilities.
        val no: Set<Int> = runCatching { shortCasts.blocked(st).keys }.getOrDefault(emptySet())
        val mine = st.me.hand + st.me.battlefield + st.me.graveyard + st.me.exile
        val real = st.selection.actionable.filter { id ->
            val c = mine.firstOrNull { it.id == id }
            id !in no && st.selection.affordability[id] != "unavailable" && !(c != null && c in st.me.battlefield && manaOnly(c))
        }
        val cards = real.take(6).joinToString(",") { id -> mine.firstOrNull { it.id == id }?.let { "${it.name}:${st.selection.affordability[id] ?: "?"}" } ?: "$id" }
        if (real.isNotEmpty()) return Decision(null, "${if (st.stack.isNotEmpty()) "respond" else "play"} stop yes, cards=$cards")
        // Your turn, nothing to play and nothing that can attack: straight to the end of the turn in one beat ("End turn").
        val yourTurn = st.activePlayer == st.viewer
        val canAttack = st.me.battlefield.any { it.isCreature && !it.tapped && !it.summoningSick }
        val toEnd = yourTurn && !canAttack && st.stack.isEmpty() && st.buttons.cancelEnabled && st.buttons.cancel?.contains("end", true) == true
        return Decision(if (toEnd) "cancel" else "ok", "${if (st.stack.isNotEmpty()) "respond" else "play"} stop no (nothing you can do now)${if (toEnd) ", to end of turn" else ""}", 700)
    }
}
