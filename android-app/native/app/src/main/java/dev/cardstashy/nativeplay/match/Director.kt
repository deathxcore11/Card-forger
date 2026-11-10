package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref

/**
 * The match director (specs/match-director-native.md, Randall approved the feel reference 10 Nov): Forge's event log becomes one
 * ordered list of steps, each one readable moment with its own length, the shortest it may ever be cut to, its sound and whether
 * the player must be able to read it. Before each CPU decision it puts a think step (the CPU behaves like a person). Pure, so the
 * reference round, coverage over real logs and the think ranges are checked on the JVM.
 *
 * [Step.held] steps are the ones the controller waits on (the caption beat, the banner, a think); the rest are drawn by the
 * Living Battlefield as the board changes and are listed so every event has a place (coverage) and a length.
 */
object Director {
    enum class Kind { THINK, BANNER, UNTAP, DRAW, LAND, CAST, TRIGGER, ABILITY, RESOLVE, FIZZLE, DAMAGE, LIFE, COUNTERS, ATTACH,
        ENTER, TO_GRAVE, DIES, EXILE, TO_HAND, TOKEN, ATTACK, BLOCK, SHUFFLE }

    data class Step(
        val kind: Kind, val ms: Long, val minMs: Long, val cue: String? = null, val focal: Boolean = false,
        /** The CPU did it (a think came before it, or it is the CPU's own turn banner). */
        val cpu: Boolean = false,
        val cardId: Int? = null, val cardName: String? = null,
        /** The caption the table shows for a CPU action (the existing beat card), or the turn banner. */
        val beat: Beat? = null, val banner: Banner? = null,
        val count: Int = 1,
    ) { val held get() = kind == Kind.THINK || beat != null || banner != null }

    /** Event types with no step of their own: the opening deal and mulligans keep their own flow. */
    val SILENT = setOf("mulligan")
    val KNOWN = setOf("turn", "draw", "land", "cast", "trigger", "ability", "resolve", "damage", "life", "counters", "attach", "zone", "shuffle") + SILENT

    enum class Decision(val lo: Long, val hi: Long) { LAND(700, 1000), CAST(1100, 1500), CAST_TARGETED(1500, 2100), ATTACK(700, 1000), BLOCK(900, 1400), RESPOND(700, 1100) }

    /**
     * How long the CPU thinks: uniform in the decision's range, never the same value twice running, at most 8 s in one CPU turn
     * (the rest scales down), and the Fast setting halves it (and nothing else).
     */
    class ThinkClock(private val random: () -> Double = Math::random) {
        private var last = -1L; private var turn = -1; private var spent = 0L
        fun next(d: Decision, turnNo: Int, fast: Boolean = false): Long {
            if (turnNo != turn) { turn = turnNo; spent = 0 }
            var ms = d.lo + (random().coerceIn(0.0, 1.0) * (d.hi - d.lo)).toLong()
            if (ms == last) ms = if (ms + 37 <= d.hi) ms + 37 else ms - 37
            last = ms
            val left = (CAP_MS - spent).coerceAtLeast(0)
            val scaled = if (ms > left) left else ms
            spent += scaled
            return if (fast) scaled / 2 else scaled
        }
    }
    const val CAP_MS = 8000L

    /**
     * The steps for [events] (new since the last shown point), read against the newest snapshot [st]. [think] null: no think
     * steps (a test of the bare plan, or a friend match where the other side is a person).
     */
    fun plan(st: MatchState, events: List<GameEvent>, think: ThinkClock? = null, fast: Boolean = false): List<Step> {
        val me = st.viewer
        val mine = (st.me.battlefield + st.me.hand + st.me.graveyard + st.me.exile).map { it.id }.toSet()
        fun touchesMe(refs: List<Ref>) = refs.any { (it.kind == "player" && it.id == me) || (it.kind == "card" && it.id in mine) }
        fun controllerOf(id: Int?) = id?.let { st.card(it)?.controller }
        fun cpu(p: Int?) = p != null && p != me
        // No think while the opening hand or one of your questions is open (they can't start then).
        val thinking = think != null && st.prompt == null && !st.isMulligan
        val waiting = st.waitingOnMe
        val out = ArrayList<Step>()
        var explainedLife = false
        fun thinkFor(d: Decision, turn: Int) { if (thinking) out += Step(Kind.THINK, think!!.next(d, turn, fast), 0, cpu = true) }
        // Whose turn each event is in: a turn event in the batch changes it; before one, two-player turns alternate.
        val firstTurn = events.firstOrNull { it.type == "turn" }
        var active: Int? = if (firstTurn != null) st.players.map { it.id }.firstOrNull { it != firstTurn.player } else st.activePlayer
        loop@ for (e in events) {
            when (e.type) {
                "turn" -> {
                    active = e.player
                    if (e.turn > 1) out += Step(Kind.BANNER, 1500, 900, if (e.player == me) "TT-001" else "TT-002", focal = true, cpu = cpu(e.player),
                        banner = Banner("Turn ${e.turn} · " + if (e.player == me) "Your turn" else "CPU's turn", e.player == me))
                }
                "land" -> if (cpu(e.player)) {
                    thinkFor(Decision.LAND, e.turn)
                    out += Step(Kind.LAND, 850, 550, "CARD-005", focal = true, cpu = true, cardId = e.card?.id, cardName = e.card?.name,
                        beat = Beat(Beat.Kind.LAND, "CPU plays ${e.card?.name ?: "a land"}", e.card?.id, e.card?.name, null))
                }
                "cast" -> if (cpu(e.player)) {
                    val targeted = e.targets.isNotEmpty()
                    // On your turn a CPU spell is an answer to you (an instant in response, or passing back while yours is on the stack).
                    val respond = active == me
                    thinkFor(if (respond) Decision.RESPOND else if (targeted) Decision.CAST_TARGETED else Decision.CAST, e.turn)
                    val hits = touchesMe(e.targets)
                    val life = if (hits) lifeChange(st, events) else null
                    if (life != null) explainedLife = true
                    // payment 340 + the card's flight 430 + its arrows 300 + read time on the stack (shorter before your prompt).
                    val ms = 340 + 430 + (if (targeted) 300 else 0) + if (waiting) 500 else 850
                    out += Step(Kind.CAST, ms.toLong(), 1000, "CARD-008", focal = true, cpu = true, cardId = e.source?.id, cardName = e.source?.name,
                        beat = Beat(if (hits) Beat.Kind.AFFECTS_YOU else Beat.Kind.ACTION, "CPU casts ${e.source?.name ?: "a spell"}", e.source?.id, e.source?.name,
                            if (hits) targetText(st, e.targets) else null, life?.first, life?.second))
                } else out += Step(Kind.CAST, 430, 300, "CARD-008", cardId = e.source?.id, cardName = e.source?.name)
                "trigger", "ability" -> {
                    val theirs = controllerOf(e.source?.id)?.let { it != me } == true
                    val kind = if (e.type == "trigger") Kind.TRIGGER else Kind.ABILITY
                    val cue = if (e.type == "trigger") "CARD-014" else "CARD-013"
                    if (!theirs) { out += Step(kind, 620, 300, cue, cardId = e.source?.id, cardName = e.source?.name); continue@loop }
                    if (e.type == "ability") thinkFor(if (e.targets.isNotEmpty()) Decision.CAST_TARGETED else Decision.CAST, e.turn)
                    val hits = touchesMe(e.targets)
                    val title = "${e.source?.name ?: "A CPU card"} " + if (e.type == "trigger") "triggers" else "is activated"
                    // The same trigger several times in a row (one per creature entering, say) is one step with a count.
                    val prev = out.lastOrNull()
                    if (prev?.beat != null && !hits && prev.kind == kind && prev.beat.kind == Beat.Kind.ACTION && prev.beat.title.substringBefore(" ×") == title) {
                        val n = prev.count + 1
                        out[out.lastIndex] = prev.copy(count = n, beat = prev.beat.copy(title = "$title ×$n"))
                    } else out += Step(kind, 1020, 600, cue, focal = true, cpu = true, cardId = e.source?.id, cardName = e.source?.name,
                        beat = Beat(if (hits) Beat.Kind.AFFECTS_YOU else Beat.Kind.ACTION, title, e.source?.id, e.source?.name, if (hits) targetText(st, e.targets) else null))
                }
                "attack" -> if (cpu(e.player) && e.attackers.isNotEmpty()) {
                    thinkFor(Decision.ATTACK, e.turn)
                    val names = e.attackers.map { it.first.name ?: "a creature" }
                    out += Step(Kind.ATTACK, 440L * names.size.coerceAtMost(4), 300, "CMB-001", focal = true, cpu = true, cardId = e.attackers.first().first.id,
                        cardName = e.attackers.first().first.name, count = names.size,
                        beat = Beat(Beat.Kind.AFFECTS_YOU, "CPU attacks with " + names.joinToString(", "), e.attackers.first().first.id, e.attackers.first().first.name,
                            "${names.size} attacker" + if (names.size == 1) "" else "s"))
                } else if (e.attackers.isNotEmpty()) out += Step(Kind.ATTACK, 440, 300, "CMB-001", count = e.attackers.size)
                "block" -> if (cpu(e.player) && e.blockers.isNotEmpty()) {
                    thinkFor(Decision.BLOCK, e.turn)
                    val first = e.blockers.first()
                    out += Step(Kind.BLOCK, 800, 500, "CMB-003", focal = true, cpu = true, cardId = first.first.id, cardName = first.first.name, count = e.blockers.size,
                        beat = Beat(Beat.Kind.ACTION, "CPU blocks", first.first.id, first.first.name,
                            e.blockers.joinToString("\n") { (b, a) -> "${b.name ?: "A creature"} blocks ${a?.let { st.card(it)?.name } ?: "an attacker"}" }))
                } else if (e.blockers.isNotEmpty()) out += Step(Kind.BLOCK, 800, 500, "CMB-003", count = e.blockers.size)
                "resolve" -> out += if (e.fizzled) Step(Kind.FIZZLE, 400, 250, "CARD-012", cardId = e.source?.id ?: e.card?.id)
                    else Step(Kind.RESOLVE, 300, 200, cardId = e.source?.id ?: e.card?.id)
                "damage" -> out += Step(Kind.DAMAGE, 1320, 500, "CMB-018", focal = touchesMe(listOfNotNull(e.target)), cardId = e.source?.id)
                "life" -> out += Step(Kind.LIFE, 360 + 90L * kotlin.math.abs((e.lifeTo ?: 0) - (e.lifeFrom ?: 0)).coerceAtMost(20), 360,
                    if ((e.lifeTo ?: 0) < (e.lifeFrom ?: 0)) "CMB-005" else "CMB-007", focal = e.player == me)
                "counters" -> groupOrAdd(out, Step(Kind.COUNTERS, 360, 200, "CARD-027", cardId = e.card?.id))
                "attach" -> out += Step(Kind.ATTACH, 300, 200, "CARD-028", cardId = e.card?.id)
                "shuffle" -> out += Step(Kind.SHUFFLE, 400, 200, "CARD-024")
                "draw" -> groupOrAdd(out, if (e.player == me) Step(Kind.DRAW, 460, 300, "CARD-001", cardId = e.card?.id) else Step(Kind.DRAW, 770, 250, "CARD-002"))
                "zone" -> zoneStep(e, me)?.let { if (it.kind == Kind.TOKEN || it.kind == Kind.DRAW) groupOrAdd(out, it) else out += it }
            }
        }
        // Damage or drain to you that no cast above explains (combat, a trigger resolving): one red caption.
        if (!explainedLife) lifeChange(st, events)?.let { (from, to) ->
            out += Step(Kind.LIFE, 360 + 90L * (from - to).coerceAtMost(20), 360, "CMB-005", focal = true, cpu = true,
                beat = Beat(Beat.Kind.AFFECTS_YOU, "You lose ${from - to} life", null, null, null, from, to))
        }
        return out
    }

    private fun zoneStep(e: GameEvent, me: Int): Step? {
        val id = e.card?.id; val from = e.from.orEmpty(); val to = e.to.orEmpty()
        return when {
            e.token && to == "Battlefield" -> Step(Kind.TOKEN, 400, 250, "CARD-025", cardId = id)
            from == "Library" && to == "Hand" -> if (e.player == me) Step(Kind.DRAW, 460, 300, "CARD-001", cardId = id) else Step(Kind.DRAW, 770, 250, "CARD-002", cardId = id)
            to == "Battlefield" -> Step(Kind.ENTER, 480, 300, "CARD-010", focal = true, cardId = id)
            from == "Battlefield" && to == "Graveyard" -> Step(Kind.DIES, 680, 400, "CMB-009", focal = true, cardId = id)
            to == "Graveyard" -> Step(Kind.TO_GRAVE, 380, 250, if (from == "Hand") "CARD-021" else if (from == "Library") "CARD-022" else null, cardId = id)
            to == "Exile" -> Step(Kind.EXILE, 400, 250, "CARD-019", cardId = id)
            to == "Hand" -> Step(Kind.TO_HAND, 380, 250, "CARD-020", cardId = id)
            else -> Step(Kind.TO_GRAVE, 380, 250, cardId = id)
        }
    }

    /** Several draws, tokens or counter changes in a row are one step with a count. */
    private fun groupOrAdd(out: MutableList<Step>, s: Step) {
        val prev = out.lastOrNull()
        if (prev != null && prev.kind == s.kind && prev.beat == null) out[out.lastIndex] = prev.copy(count = prev.count + 1) else out += s
    }

    private fun lifeChange(st: MatchState, events: List<GameEvent>): Pair<Int, Int>? {
        val mine = events.filter { it.type == "life" && it.player == st.viewer && it.lifeFrom != null && it.lifeTo != null }
        if (mine.isEmpty()) return null
        val from = mine.first().lifeFrom!!; val to = mine.last().lifeTo!!
        return if (to < from) from to to else null
    }

    private fun targetText(st: MatchState, refs: List<Ref>) = refs.joinToString(", ") {
        if (it.kind == "player") (if (it.id == st.viewer) "Targets you" else "Targets CPU") else "Targets ${it.name ?: "a card"}"
    }

    /**
     * How long a held step plays (section 6): full length normally; when a prompt of yours is already waiting or more than
     * 6 s of steps are queued, a non-focal step plays at its Min and a focal one never under its Min.
     */
    fun lengthOf(s: Step, waiting: Boolean, queuedMs: Long): Long = when {
        s.kind == Kind.THINK -> s.ms
        (waiting || queuedMs > 6000) && !s.focal -> s.minMs
        else -> maxOf(s.ms, s.minMs)
    }
}

/** The CPU thinking right now (the dots by its portrait, the lifted card back in its hand), read by the table. */
object CpuThink {
    data class Tell(val lifted: Int?)
    val now = kotlinx.coroutines.flow.MutableStateFlow<Tell?>(null)
}
