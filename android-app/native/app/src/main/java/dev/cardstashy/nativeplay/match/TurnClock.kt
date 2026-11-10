package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState

/**
 * The turn clock, a line-by-line port of the site's turn-timer.mjs (Randall, 4 Nov: every match mode shows a countdown while the
 * game waits on you, and a player who stays away is skipped). 90 s per turn, 30 s for each prompt (keep, attackers, blockers,
 * targets, payment) and for a response window on the CPU's turn. The clock runs only while the game waits on you and holds while
 * the CPU's play is told, a card pop-up or the menu is open, or the table is busy. A missed window plays the safe answer, and
 * three missed turns in a row concede in a friend match only; against the CPU a missed window just passes. Any touch clears the
 * count. Pure logic: the controller ticks it and the table draws what [onChange] reports.
 */
object TurnClock {
    const val TURN_MS = 90_000L
    const val PROMPT_MS = 30_000L
    const val WARN_MS = 10_000L
    const val STRIKE_LIMIT = 3

    enum class Kind { TURN, PROMPT, RESPONSE, RIVAL }
    data class Window(val id: String, val kind: Kind, val total: Long)
    /** What the table draws: whose window, how much is left, the last-10-s warning, held or running. */
    data class Shown(val kind: Kind, val own: Boolean, val total: Long, val remaining: Long, val seconds: Int, val warn: Boolean, val paused: Boolean)

    /** cpu-action-playback.mjs isPlayerDecision on the native snapshot. */
    fun isPlayerDecision(s: MatchState?): Boolean {
        if (s == null || s.finished || s.status != "running") return false
        if (s.prompt != null) return true
        return !s.busy && s.inputType != null && s.inputType != "InputLockUI"
    }

    /** waitingOn: the window the game waits on you in, or null. */
    fun waitingOn(s: MatchState?): Window? {
        if (s == null || !isPlayerDecision(s)) return null
        val input = s.inputType.orEmpty()
        s.prompt?.let { return Window("prompt:${it.id}:${s.revision}", Kind.PROMPT, PROMPT_MS) }
        // The cleanup discard is one window for the whole step (it keeps its time while you pick card after card).
        if (discardCount(s) != null) return Window("discard:${s.turn}", Kind.PROMPT, PROMPT_MS)
        if (input == "InputPassPriority") {
            if (s.activePlayer == s.viewer) return Window("turn:${s.turn}", Kind.TURN, TURN_MS)
            return Window("response:${s.revision}", Kind.RESPONSE, PROMPT_MS)
        }
        return Window("$input:${s.revision}", Kind.PROMPT, PROMPT_MS)
    }

    /**
     * The cleanup discard (U1, Thor 10 Nov): Forge asks it with no prompt, as a card selection (an anonymous
     * InputSelectCardsFromList, so the bridge reports no input name) whose message says "Select N card(s) to discard to bring
     * your hand down to the maximum of 7 cards". How many cards are still to go, or null when no discard is asked.
     */
    fun discardCount(s: MatchState?): Int? {
        if (s == null || s.prompt != null || s.selection.cards.isEmpty() || !Regex("\\bdiscard\\b", RegexOption.IGNORE_CASE).containsMatchIn(s.message)) return null
        val asked = Regex("select (\\d+) cards?", RegexOption.IGNORE_CASE).find(s.message)?.groupValues?.get(1)?.toIntOrNull()
            ?: s.selection.max.takeIf { it > 0 } ?: 1
        return maxOf(1, asked - s.selection.chosenCards.size)
    }
    /** "bring your hand down to the maximum of 7 cards": the hand size the discard brings you to (7 when Forge does not say). */
    fun discardTo(s: MatchState): Int = Regex("maximum of (\\d+)", RegexOption.IGNORE_CASE).find(s.message)?.groupValues?.get(1)?.toIntOrNull() ?: 7

    /** rivalTurn: a friend's turn, for the line only; nothing here ever acts. */
    fun rivalTurn(s: MatchState?): Window? {
        if (s == null || s.finished || s.status == "failed" || s.activePlayer == null || s.activePlayer == s.viewer) return null
        return Window("rival:${s.turn}", Kind.RIVAL, TURN_MS)
    }

    /** What a missed window plays (forge-table.mjs afkAnswer). Never commits attackers or blockers. */
    sealed interface Answer {
        /** Clear the prompt, pick its first [indexes] (its minimum), confirm. */
        data class Prompt(val id: Int, val indexes: List<Int>) : Answer
        object Cancel : Answer
        object Ok : Answer
        /** The prompt cannot be answered (Prompt.deadEnd): leave the match as no result instead of retrying a reply the bridge refuses. */
        object Leave : Answer
        /** A friend match's cleanup discard ran out: discard [id] (the newest card in your hand) and say which. */
        data class Discard(val id: Int, val name: String) : Answer
    }
    fun answer(w: Window, s: MatchState): Answer {
        s.prompt?.let { p -> return if (p.deadEnd) Answer.Leave else Answer.Prompt(p.id, p.options.take(maxOf(0, p.min)).map { it.index }) }
        if (discardCount(s) != null) {
            // The simplest fair rule: the newest card in your hand (the one drawn last) that Forge lets you discard.
            val me = s.players.firstOrNull { it.id == s.viewer }
            val pick = me?.hand?.lastOrNull { it.id in s.selection.cards && it.id !in s.selection.chosenCards }
                ?: s.selection.cards.firstOrNull { it !in s.selection.chosenCards }?.let { id -> me?.hand?.firstOrNull { it.id == id } }
            if (pick != null) return Answer.Discard(pick.id, pick.name)
        }
        val input = s.inputType.orEmpty(); val b = s.buttons
        if (input == "InputSelectTargets" || input.startsWith("InputPayMana")) return if (b.cancelEnabled) Answer.Cancel else Answer.Ok
        if (w.kind == Kind.TURN && b.cancelEnabled && Regex("end turn", RegexOption.IGNORE_CASE).containsMatchIn(b.cancel.orEmpty())) return Answer.Cancel
        return Answer.Ok
    }

    /** createTurnTimer. [act] answers [done] when its answer has gone out (true) or was refused (false). */
    class Timer(
        private val snapshot: () -> MatchState?,
        private val paused: () -> Boolean = { false },
        private val act: (Window, MatchState, done: (Boolean) -> Unit) -> Unit,
        private val concede: () -> Unit = {},
        private val onChange: (Shown?) -> Unit = {},
        private val onStrike: (Int, Int?) -> Unit = { _, _ -> },
        private val friend: Boolean = false,
        /** Against the CPU a cleanup discard is never made for you: when its time runs out the clock holds and this says so. */
        private val onNag: () -> Unit = {},
        private val now: () -> Long,
        /** A friend match host that sends its own clock: (present, the window with the time it arrived). The host acts, never this phone. */
        private val host: () -> Pair<Boolean, Pair<dev.cardstashy.nativeplay.engine.Afk, Long>?> = { false to null },
    ) {
        private class Cur(val w: Window, var left: Long, var since: Long?, var attempts: Int = 0)
        private var cur: Cur? = null
        private var acting = false
        private var strikes = 0
        private var lastStrikeTurn: Int? = null
        private var shown = ""
        private var stopped = false
        private val banks = HashMap<String, Long>()
        private val INF = Long.MAX_VALUE

        private fun left(): Long { val c = cur ?: return 0; if (c.left == INF) return INF; return maxOf(0, c.left - (c.since?.let { now() - it } ?: 0)) }
        private fun emit() {
            val c = cur
            val s = if (c != null && c.left != INF) ((left() + 999) / 1000).toInt() else 0
            val key = if (c != null) "${c.w.kind}|$s|${if (c.since == null) "p" else "r"}" else ""
            if (key == shown) return; shown = key
            onChange(c?.let { Shown(it.w.kind, it.w.kind != Kind.RIVAL, it.w.total, if (it.left == INF) 0 else left(), s,
                it.w.kind != Kind.RIVAL && it.left != INF && left() <= WARN_MS, it.since == null) })
        }
        private fun expire(w: Window, s: MatchState) {
            val c = cur!!
            if (c.w.kind == Kind.RIVAL) { c.left = 0; c.since = null; return }
            // Against the CPU nothing is waiting on you but the game: a discard is your choice, so the clock holds and asks again
            // (no missed turn). With a friend the standing rule holds: the time runs out, a card goes, and it counts as missed.
            if (!friend && (w.id.startsWith("discard:") || discardCount(s) != null)) { c.left = INF; c.since = null; runCatching(onNag); return }
            val turn = s.turn
            if (turn != lastStrikeTurn) { lastStrikeTurn = turn; strikes++; runCatching { onStrike(strikes, if (friend) STRIKE_LIMIT else null) } }
            c.attempts++
            if (friend && strikes >= STRIKE_LIMIT) { acting = true; runCatching(concede); return }
            // The answer goes out once; if it is refused (the board moved), try again shortly, a few times.
            if (c.attempts > 3) { c.left = INF; c.since = null; return }
            c.left = 3000; c.since = null; acting = true
            runCatching { act(w, s) { acting = false } }.onFailure { acting = false }
        }
        // The host's window, drawn as it stands: time left at receipt minus the time since, never the device's date.
        private var hostStrikes = 0
        private fun hostTick(h: Pair<dev.cardstashy.nativeplay.engine.Afk, Long>?) {
            if (h == null) { cur = null; emit(); return }
            val (a, at) = h
            val kind = if (a.own) when (a.reason) { "turn" -> Kind.TURN; "response" -> Kind.RESPONSE; else -> Kind.PROMPT } else Kind.RIVAL
            val remain = maxOf(0L, a.remainingMs - (now() - at))
            val c0 = cur
            if (c0 == null || c0.w.id != "host" || c0.w.kind != kind || c0.w.total != a.total) cur = Cur(Window("host", kind, if (a.total > 0) a.total else TURN_MS), 0, null)
            cur!!.left = remain; cur!!.since = now()
            if (a.own) { val n = a.strikes; if (n > hostStrikes) runCatching { onStrike(n, a.strikeLimit) }; hostStrikes = n }
            emit()
        }
        fun tick() {
            if (stopped) return
            val s = snapshot()
            // A friend match whose host sends its own clock: draw that one and let the host act (it works when the app is closed too).
            val (present, h) = host()
            if (friend && present) return hostTick(if (s == null || s.finished || s.status == "failed") null else h)
            val w = waitingOn(s) ?: if (friend) rivalTurn(s) else null
            if (w == null || s == null) { cur?.let { banks[it.w.id] = left() }; cur = null; emit(); return }
            val c0 = cur
            if (c0 == null || c0.w.id != w.id) {
                if (c0 != null && c0.w.kind == Kind.TURN) banks[c0.w.id] = left()
                // A prompt in the middle of your turn pauses that turn's clock; it picks up where it stopped.
                cur = Cur(w, banks[w.id] ?: w.total, null)
            }
            val c = cur!!
            // W6: the cleanup discard is plainly yours (Forge waits in its card list), so a busy flag left up by the bridge must not
            // freeze its rope at 30; it counts down and holds only at zero ("Time's up").
            val discard = c.w.id.startsWith("discard:")
            val p = paused(); val busy = s.busy && !discard
            val hold = p || acting || busy || c.left == INF
            if (hold && c.since == null && c0?.w?.id != w.id) runCatching { TableLog.line("clock opened held ${c.w.id}: paused=$p acting=$acting busy=${s.busy} inf=${c.left == INF}") }
            if (hold && c.left != INF && c.since != null) runCatching { TableLog.line("clock held ${c.w.id}: paused=$p acting=$acting busy=${s.busy}") }
            if (hold && c.since != null) { c.left -= now() - c.since!!; c.since = null }
            else if (!hold && c.since == null) c.since = now()
            if (c.w.kind == Kind.TURN) banks[c.w.id] = left()
            if (c.left != INF && left() <= 0 && !acting) expire(w, s)
            emit()
        }
        /** Any touch of the table: you are here. The count of missed turns clears, and a prompt's window starts over (never the turn's 90 s). */
        fun poke() {
            strikes = 0; lastStrikeTurn = null
            val c = cur ?: return
            // Against the CPU the cleanup discard keeps its one window (V13): walking the hand with the pad does not start it over.
            if (c.w.kind != Kind.TURN && c.w.kind != Kind.RIVAL && c.left != INF && (friend || !c.w.id.startsWith("discard:"))) { c.left = c.w.total; if (c.since != null) c.since = now(); emit() }
        }
        fun strikes() = strikes
        fun stop() { stopped = true; cur = null; onChange(null) }
    }
}
