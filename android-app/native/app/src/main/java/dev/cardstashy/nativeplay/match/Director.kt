package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import kotlin.math.abs

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
        ENTER, TO_GRAVE, DIES, EXILE, TO_HAND, TOKEN, ATTACK, BLOCK, SHUFFLE,
        /** Match punch P2b: mana made by hand, or taken back with Undo (no card moves). */
        MANA,
        /** A TRIGGER SHOWS ITSELF, beat 3: a trigger's resolve with what it changed ([Step.result]). */
        RESULT }

    data class Step(
        val kind: Kind, val ms: Long, val minMs: Long, val cue: String? = null, val focal: Boolean = false,
        /** The CPU did it (a think came before it, or it is the CPU's own turn banner). */
        val cpu: Boolean = false,
        val cardId: Int? = null, val cardName: String? = null,
        /** The caption the table shows for a CPU action (the existing beat card), or the turn banner. */
        val beat: Beat? = null, val banner: Banner? = null,
        val count: Int = 1,
        /** A TRIGGER SHOWS ITSELF, beats 1 and 2: the source lifts and rings, then (when Forge resolved it in the same poll) its stack item is held to read. */
        val trig: Trig? = null,
        /** Beat 3: the resolve of a trigger and what it changed, landed on the changed cards. */
        val result: Resolution? = null,
        /** 0.4.59 T5, the cast travels: the card itself moving on this step (hand to stack, its rest, stack to slot or host, a land to its group). */
        val travel: Travel? = null,
    ) { val held get() = kind == Kind.THINK || beat != null || banner != null || trig != null || result != null || travel != null }

    /**
     * 0.4.59 T5: one leg of a card's travel. [TAPS] the paying lands ([taps], in order) turn one by one; [TO_STACK] the card goes from
     * its hand (yours) or the CPU seat to the stack lane and grows to the stack size; [REST] it lies on the stack with its rim;
     * [TO_SLOT], [TO_HOST] (an aura onto its creature) and [TO_GROUP] (a land, which skips the stack) end at the anchor [toKey].
     */
    /** BACK (T6): Cancel while the spell asked; from the stack back to its place in your hand. */
    enum class Leg { TAPS, TO_STACK,
        /** Mobile table M6: a CPU cast, at the stack, grows large to be read ([POP_GROW_MS]), holds ([POP_HOLD_MS]) and returns to stack size ([POP_SHRINK_MS]) before its lands pay. */
        POP, REST, TO_SLOT, TO_HOST, TO_GROUP, BACK,
        /** Match punch P2b: lands you tapped by hand ([Travel.taps]) send their light to the floating mana by your square. */
        TO_POOL,
        /** P2b: Forge's Undo took the taps back: the lands ([Travel.taps]) turn back with a gold glint and the light returns to them. */
        UNTAP }
    data class Travel(val cardId: Int?, val name: String?, val mine: Boolean, val leg: Leg, val toKey: String?, val ms: Long,
                      val stackId: Int? = null, val taps: List<Int> = emptyList(), val targets: List<Ref> = emptyList(),
                      /** P2: the burst's size on a cast's rest (.5 when nothing was paid). */
                      val power: Float = 1f,
                      /** P2b: how many of a pay's streaks come from the floating mana by your square (mana you made by hand), before the lands'. */
                      val pool: Int = 0)

    /** A trigger going on the stack (Forge's "trigger" event): who, from which card, at what; [resolvedHere] its resolve is in the same poll. */
    data class Trig(val stackId: Int?, val sourceId: Int?, val sourceName: String?, val controller: Int?, val yours: Boolean,
                    val targets: List<Ref>, val resolvedHere: Boolean)

    /** One counter change Forge reported on a card (counters event: counter type, old and new count). */
    data class CounterChange(val cardId: Int, val cardName: String?, val counter: String, val delta: Int)
    /** A card's power/toughness before and after a resolve, from the two snapshots around it (no counters needed). */
    data class PtChange(val cardId: Int, val cardName: String?, val fromP: Int, val fromT: Int, val toP: Int, val toT: Int) {
        val up get() = toP + toT > fromP + fromT
    }
    data class LifeChange(val player: Int, val from: Int, val to: Int)

    /**
     * What one stack item's resolve changed, all as Forge reported it: counters (counters events), power/toughness (snapshot diff),
     * tokens (zone, token=true), damage and life. Forge applies an item's effects first and fires its resolve last, so the results
     * that belong to a resolve are the ones since the last stack event before it ([resolutions]).
     */
    data class Resolution(
        val seq: Long, val stackId: Int?, val sourceId: Int?, val sourceName: String?, val controller: Int?, val trigger: Boolean,
        val fizzled: Boolean, val text: String?, val targets: List<Ref>,
        val counters: List<CounterChange> = emptyList(), val pt: List<PtChange> = emptyList(), val tokens: List<Ref> = emptyList(),
        val damage: List<Pair<Ref, Int>> = emptyList(), val life: List<LifeChange> = emptyList(),
        /** Same source, same cards changed, one after another: played as one beat with ×N (table-info I1 addition a). */
        val count: Int = 1,
        /** Every stack item this result stands for (one, or the ×N it collapsed). */
        val stackIds: List<Int> = listOfNotNull(stackId),
    ) {
        /** The permanents the result lands on (counters and P/T), in the order Forge changed them. */
        val changed: List<Int> get() = (counters.map { it.cardId } + pt.map { it.cardId }).distinct()
        val empty get() = counters.isEmpty() && pt.isEmpty() && tokens.isEmpty() && damage.isEmpty() && life.isEmpty()

        /** The one trail line ("Optimistic Scavenger: +1/+1 counter on Grizzly Bears"), or null when it changed nothing shown. */
        fun line(viewer: Int): String? {
            val who = sourceName ?: "A trigger"
            if (fizzled) return "$who: no legal targets"
            val parts = ArrayList<String>()
            for ((_, list) in counters.groupBy { it.cardId }) for ((kind, same) in list.groupBy { it.counter }) {
                val n = same.sumOf { it.delta }; if (n == 0) continue
                val on = same.first().cardName ?: "a card"
                val k = abs(n)
                val what = when { kind.equals("P1P1", true) -> "+1/+1"; kind.equals("M1M1", true) -> "-1/-1"; else -> counterWord(kind) }
                parts += (if (k == 1 && n > 0) "" else "$k ") + "$what counter" + (if (k == 1) "" else "s") + (if (n > 0) " on " else " off ") + on
            }
            val counted = counters.map { it.cardId }.toSet()
            for (p in pt) if (p.cardId !in counted) parts += "${p.cardName ?: "a creature"} ${signed(p.toP - p.fromP)}/${signed(p.toT - p.fromT)}"
            if (tokens.isNotEmpty()) {
                val names = tokens.mapNotNull { it.name }.distinct()
                parts += "created " + (if (tokens.size == 1) "a " else "${tokens.size} ") + (names.singleOrNull()?.let { if (it.endsWith("Token", true)) it else "$it token" } ?: "token") + if (tokens.size > 1 && names.size <= 1) "s" else ""
            }
            for ((t, n) in damage) parts += "$n damage to " + if (t.kind == "player") (if (t.id == viewer) "you" else "CPU") else (t.name ?: "a card")
            for (l in life) if (l.to != l.from) parts += (if (l.player == viewer) "you " else "CPU ") + (if (l.to > l.from) "gain${if (l.player == viewer) "" else "s"} ${l.to - l.from}" else "lose${if (l.player == viewer) "" else "s"} ${l.from - l.to}") + " life"
            if (parts.isEmpty()) return null
            return who + (if (count > 1) " ×$count" else "") + ": " + parts.joinToString(", ")
        }
    }

    private fun signed(n: Int) = if (n >= 0) "+$n" else "−${-n}"
    private fun counterWord(k: String) = k.lowercase().replace('_', ' ')

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
    fun plan(st: MatchState, events: List<GameEvent>, think: ThinkClock? = null, fast: Boolean = false,
             before: MatchState? = null, triggerIds: Set<Int> = emptySet()): List<Step> {
        val me = st.viewer
        // A TRIGGER SHOWS ITSELF: each resolve tied to what it changed; a trigger's result is its own held step at its resolve.
        val results = resolutions(before, st, events, triggerIds)
        val resultAt = results.filter { it.trigger && (it.fizzled || !it.empty) }.associateBy { it.seq }
        val resolvedHere = results.flatMap { it.stackIds }.toSet()
        // A result collapsed from N copies (×N) gets one source beat for all of them, at its first trigger event in the poll.
        val mergedOf = results.filter { it.stackIds.size > 1 }.flatMap { r -> r.stackIds.map { it to r } }.toMap()
        val merged = HashSet<Int>()
        val mine = (st.me.battlefield + st.me.hand + st.me.graveyard + st.me.exile).map { it.id }.toSet()
        fun touchesMe(refs: List<Ref>) = refs.any { (it.kind == "player" && it.id == me) || (it.kind == "card" && it.id in mine) }
        fun controllerOf(id: Int?) = id?.let { st.card(it)?.controller?.takeIf { c -> c >= 0 } }
        // A trigger's source may have left the battlefield (a dies trigger): its controller from the board before, else whose zones hold it.
        fun sourceSide(id: Int?) = id?.let { i -> controllerOf(i) ?: before?.card(i)?.controller?.takeIf { it >= 0 }
            ?: (st.players + before?.players.orEmpty()).firstOrNull { p -> (p.battlefield + p.graveyard + p.exile + p.hand + p.command).any { it.id == i } }?.id }
        fun cpu(p: Int?) = p != null && p != me
        // No think while the opening hand or one of your questions is open (they can't start then).
        val thinking = think != null && st.prompt == null && !st.isMulligan
        val waiting = st.waitingOnMe
        val out = ArrayList<Step>()
        var explainedLife = false
        fun thinkFor(d: Decision, turn: Int) { if (thinking) out += Step(Kind.THINK, think!!.next(d, turn, fast), 0, cpu = true) }
        // T5: the lands each side tapped since the board last shown (once per side per poll: the first cast pays with them).
        val tapsLeft = st.players.associate { p -> p.id to p.battlefield.filter { c -> c.isLand && c.tapped && !c.attacking &&
            before?.card(c.id)?.let { it.zone == "Battlefield" && !it.tapped } == true }.map { it.id } }.toMutableMap()
        // P2b: your floating mana before and now. What a cast of yours spent of it (5 streaks at most) pays from the pool.
        val poolBefore = before?.players?.firstOrNull { it.id == me }?.mana?.values?.sum() ?: 0
        val poolNow = st.players.firstOrNull { it.id == me }?.mana?.values?.sum() ?: 0
        var poolSpent = (poolBefore - poolNow).coerceIn(0, 5)
        // Cards whose cast is in this poll: their move from the stack is part of their travel.
        val castHere = events.filter { it.type == "cast" && it.source != null }.associate { it.source!!.id to (it.player == me) }
        /** Whose card is travelling: its controller on the board, else who cast it in this poll. */
        fun mineOf(id: Int) = st.card(id)?.controller?.takeIf { it >= 0 }?.let { it == me } ?: castHere[id] ?: false
        val toHost = HashSet<Int>()
        /** The three legs of a cast (taps, to the stack, the rest); the rest carries [beat] and the read time [restMs]. */
        // T6: the spell you are choosing targets or paying for already went up (its own leg in the poll that asked).
        val waiting0 = before?.let { dev.cardstashy.nativeplay.ui.pendingCast(it) }
        val waitingUp = waiting0?.id
        // Match punch P2: the card lifts to the stack first, its lands then pay into it (each a flash and a streak), and its rest opens
        // with the burst. With nothing to pay the pay is skipped and the burst is half size. [readMs] is the read after the burst.
        fun castLegs(e: GameEvent, mine: Boolean, readMs: Long, beat: Beat?) {
            val id = e.source?.id; val name = e.source?.name
            val taps = e.player?.let { tapsLeft.remove(it) }.orEmpty()
            // P2b: floating mana you made by hand and this cast spent: its streaks leave the pool by your square, before the lands'.
            val pool = if (mine) poolSpent.also { poolSpent = 0 } else 0
            if (!(mine && id != null && id == waitingUp)) out += Step(Kind.CAST, TO_STACK_MS, TO_STACK_MS, cpu = !mine, cardId = id, cardName = name, travel = Travel(id, name, mine, Leg.TO_STACK, "stackcard", TO_STACK_MS, e.stackId, targets = e.targets))
            // M6 (measured from Arena, both players): the card comes out at stack size, grows large and is held to be read with its
            // caption, then returns to stack size while its lands pay. Your own card that waited on the stack for its target or
            // its mana popped when it went there (below); it does not pop a second time.
            val pop = !(mine && id != null && id == waitingUp)
            if (pop) out += Step(Kind.CAST, POP_MS, POP_MS, focal = true, cpu = !mine, cardId = id, cardName = name, beat = beat,
                travel = Travel(id, name, mine, Leg.POP, "stackcard", POP_MS, e.stackId, targets = e.targets))
            if (taps.isNotEmpty() || pool > 0) { val ms = payMs(taps.size + pool)
                out += Step(Kind.CAST, ms, PAY_MIN_MS, cpu = !mine, cardId = id, cardName = name, travel = Travel(id, name, mine, Leg.TAPS, "stackcard", ms, e.stackId, taps, pool = pool)) }
            // Your own card read large in its pop needs no second read after the burst.
            val restMs = BURST_MS + (if (pop && mine) 0L else readMs)
            out += Step(Kind.CAST, restMs, BURST_MIN_MS + (if (pop) 0L else CAST_READ_PROMPT_MS), focal = true, cpu = !mine, cardId = id, cardName = name, beat = if (pop) null else beat,
                travel = Travel(id, name, mine, Leg.REST, "stackcard", restMs, e.stackId, targets = e.targets, power = if (taps.isEmpty() && pool == 0) .5f else 1f))
        }
        /** The CPU plays a land: its think, then the land from its seat to its group with the caption. */
        fun cpuLand(card: Ref?, turn: Int) {
            thinkFor(Decision.LAND, turn)
            // M6: a land flies 500 and the table pauses 500.
            out += Step(Kind.LAND, TO_GROUP_MS + 500, 550, "CARD-005", focal = true, cpu = true, cardId = card?.id, cardName = card?.name,
                beat = Beat(Beat.Kind.LAND, "CPU plays ${card?.name ?: "a land"}", card?.id, card?.name, null),
                travel = Travel(card?.id, card?.name, false, Leg.TO_GROUP, card?.id?.let { "c$it" }, TO_GROUP_MS))
        }
        val landHere = events.filter { it.type == "land" }.mapNotNull { it.card?.id }.toSet()
        val lastSeq = events.lastOrNull()?.seq
        // Whose turn each event is in: a turn event in the batch changes it; before one, two-player turns alternate.
        val firstTurn = events.firstOrNull { it.type == "turn" }
        var active: Int? = if (firstTurn != null) st.players.map { it.id }.firstOrNull { it != firstTurn.player } else st.activePlayer
        /** The CPU casts [e]: its think, then its legs (taps, to the stack, the rest with the caption). */
        fun cpuCast(e: GameEvent) {
            val targeted = e.targets.isNotEmpty()
            // On your turn a CPU spell is an answer to you (an instant in response, or passing back while yours is on the stack).
            val respond = active == me
            thinkFor(if (respond) Decision.RESPOND else if (targeted) Decision.CAST_TARGETED else Decision.CAST, e.turn)
            val hits = touchesMe(e.targets)
            val life = if (hits) lifeChange(st, events) else null
            if (life != null) explainedLife = true
            // P2: the card goes from the CPU seat to the stack, its lands pay into it, then it bursts and rests there with the caption:
            // its arrows 300 + the read (525, or 500 before your prompt).
            // M6: the read is the pop (the card large, with the caption); after the burst only its arrows' 300 remain.
            val read = if (targeted) 300L else 0L
            castLegs(e, mine = false, readMs = read, beat = Beat(if (hits) Beat.Kind.AFFECTS_YOU else Beat.Kind.ACTION, "CPU casts ${e.source?.name ?: "a spell"}", e.source?.id, e.source?.name,
                    if (hits) targetText(st, e.targets) else null, life?.first, life?.second))
        }
        loop@ for (e in events) {
            when (e.type) {
                "turn" -> {
                    active = e.player
                    if (e.turn > 1) out += Step(Kind.BANNER, BANNER_MS, 900, if (e.player == me) "TT-001" else "TT-002", focal = true, cpu = cpu(e.player),
                        banner = Banner("Turn ${e.turn} · " + if (e.player == me) "Your turn" else "CPU's turn", e.player == me))
                }
                // A land already on the board shown: its play was told from its move (below), in the board before this one.
                "land" -> if (e.card?.id != null && before?.card(e.card.id)?.zone == "Battlefield") continue@loop
                else if (cpu(e.player)) cpuLand(e.card, e.turn)
                else if (e.card != null) {
                    // T5 item 6: your land skips the stack, hand to its group.
                    out += Step(Kind.LAND, TO_GROUP_MS, TO_GROUP_MS, cardId = e.card.id, cardName = e.card.name,
                        travel = Travel(e.card.id, e.card.name, true, Leg.TO_GROUP, "c${e.card.id}", TO_GROUP_MS))
                }
                // A CPU spell already on the stack shown: its cast was told from its move (below), in the board before this one.
                "cast" -> if (cpu(e.player) && e.source?.id != null && before?.stack?.any { it.source?.id == e.source.id } == true) continue@loop
                else if (cpu(e.player)) cpuCast(e)
                else castLegs(e, mine = true, readMs = if (waiting) CAST_READ_PROMPT_MS else CAST_READ_MS, beat = null)
                "trigger" -> {
                    // Beats 1 and 2 for every trigger, yours or the CPU's: the source lifts and rings; when Forge resolved it in this same
                    // poll its stack item is put up and held to read (900 ms), since no snapshot ever showed it.
                    val ctl = e.player ?: sourceSide(e.source?.id)
                    val here = e.stackId != null && e.stackId in resolvedHere
                    val group = e.stackId?.let { mergedOf[it] }
                    if (group != null && !merged.add(group.stackIds.first())) continue@loop
                    val prev = out.lastOrNull()
                    if (group != null) out += Step(Kind.TRIGGER, if (here) SOURCE_MS + STACK_HOLD_MS else SOURCE_MS, if (here) SOURCE_MS + STACK_HOLD_MS else SOURCE_MS, "CARD-014",
                        focal = true, cpu = cpu(ctl), cardId = e.source?.id, cardName = e.source?.name, count = group.count,
                        trig = Trig(e.stackId, e.source?.id, e.source?.name, ctl, ctl == me, e.targets, here))
                    else if (prev?.trig != null && prev.kind == Kind.TRIGGER && prev.trig.sourceId != null && prev.trig.sourceId == e.source?.id &&
                        prev.trig.targets == e.targets && prev.trig.resolvedHere == here) out[out.lastIndex] = prev.copy(count = prev.count + 1)
                    else out += Step(Kind.TRIGGER, if (here) SOURCE_MS + STACK_HOLD_MS else SOURCE_MS, if (here) SOURCE_MS + STACK_HOLD_MS else SOURCE_MS, "CARD-014",
                        focal = true, cpu = cpu(ctl), cardId = e.source?.id, cardName = e.source?.name,
                        trig = Trig(e.stackId, e.source?.id, e.source?.name, ctl, ctl == me, e.targets, here))
                }
                "ability" -> {
                    val theirs = controllerOf(e.source?.id)?.let { it != me } == true
                    if (!theirs) { out += Step(Kind.ABILITY, 620, 300, "CARD-013", cardId = e.source?.id, cardName = e.source?.name); continue@loop }
                    thinkFor(if (e.targets.isNotEmpty()) Decision.CAST_TARGETED else Decision.CAST, e.turn)
                    val hits = touchesMe(e.targets)
                    val title = "${e.source?.name ?: "A CPU card"} is activated"
                    // The same ability several times in a row is one step with a count.
                    val prev = out.lastOrNull()
                    if (prev?.beat != null && !hits && prev.kind == Kind.ABILITY && prev.beat.kind == Beat.Kind.ACTION && prev.beat.title.substringBefore(" ×") == title) {
                        val n = prev.count + 1
                        out[out.lastIndex] = prev.copy(count = n, beat = prev.beat.copy(title = "$title ×$n"))
                    } else out += Step(Kind.ABILITY, 1020, 600, "CARD-013", focal = true, cpu = true, cardId = e.source?.id, cardName = e.source?.name,
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
                "resolve" -> {
                    val r = resultAt[e.seq]
                    out += when {
                        // Beat 3: the result lands on the card it changed (counter chip, P/T tick, tokens from the source).
                        r != null -> {
                            if (r.life.any { it.player == me && it.to < it.from }) explainedLife = true
                            Step(Kind.RESULT, if (r.fizzled) FIZZLE_MS else RESULT_MS, if (r.fizzled) FIZZLE_MS else RESULT_MS, if (r.fizzled) "CARD-012" else "CARD-027",
                                focal = true, cpu = cpu(r.controller), cardId = r.sourceId, cardName = r.sourceName, count = r.count, result = r)
                        }
                        e.fizzled -> Step(Kind.FIZZLE, 400, 250, "CARD-012", cardId = e.source?.id ?: e.card?.id)
                        else -> Step(Kind.RESOLVE, 300, 200, cardId = e.source?.id ?: e.card?.id)
                    }
                }
                "damage" -> out += Step(Kind.DAMAGE, 1320, 500, "CMB-018", focal = touchesMe(listOfNotNull(e.target)), cardId = e.source?.id)
                "life" -> out += Step(Kind.LIFE, 360 + 90L * kotlin.math.abs((e.lifeTo ?: 0) - (e.lifeFrom ?: 0)).coerceAtMost(20), 360,
                    if ((e.lifeTo ?: 0) < (e.lifeFrom ?: 0)) "CMB-005" else "CMB-007", focal = e.player == me)
                "counters" -> groupOrAdd(out, Step(Kind.COUNTERS, 360, 200, "CARD-027", cardId = e.card?.id))
                "attach" -> {
                    // T5 item 5: an aura cast in this poll goes from the stack to its host, unless its move from the stack already did.
                    val id = e.card?.id; val host = id?.let { st.card(it)?.attachedTo }
                    out += if (id != null && host != null && id in castHere && toHost.add(id))
                        Step(Kind.ATTACH, TO_HOST_MS, TO_HOST_MS, cardId = id, cardName = e.card.name, cpu = !mineOf(id),
                            travel = Travel(id, e.card.name, mineOf(id), Leg.TO_HOST, "c$host", TO_HOST_MS))
                    else Step(Kind.ATTACH, 300, 200, "CARD-028", cardId = id)
                }
                "shuffle" -> out += Step(Kind.SHUFFLE, 400, 200, "CARD-024")
                "draw" -> groupOrAdd(out, if (e.player == me) Step(Kind.DRAW, 460, 300, "CARD-001", cardId = e.card?.id) else Step(Kind.DRAW, 770, 250, "CARD-002"))
                "zone" -> {
                    val id = e.card?.id
                    // T5 items 4 and 5: a spell leaving the stack for the battlefield goes to its slot, or an aura to its host.
                    if (e.from == "Stack" && e.to == "Battlefield" && id != null && !e.token) {
                        val c = st.card(id); val host = c?.attachedTo
                        val travel = if (host != null) { toHost += id; Travel(id, e.card.name ?: c.name, mineOf(id), Leg.TO_HOST, "c$host", TO_HOST_MS) }
                            else Travel(id, e.card.name ?: c?.name, mineOf(id), Leg.TO_SLOT, "c$id", TO_SLOT_MS)
                        out += Step(Kind.ENTER, travel.ms, travel.ms, focal = true, cpu = !travel.mine, cardId = id, cardName = travel.name, travel = travel)
                    } else if (e.from == "Stack" && e.to == "Hand" && id != null && waitingUp != null && (id == waitingUp || (e.card.name != null && e.card.name == waiting0.name))) {
                        // T6: you cancelled while it asked: it goes back to its place in your hand (no card-to-hand sound, no other step).
                        out += Step(Kind.TO_HAND, BACK_MS, BACK_MS, cardId = id, cardName = e.card.name,
                            travel = Travel(id, e.card.name, true, Leg.BACK, "hand$id", BACK_MS))
                    } else if (e.from == "Hand" && e.to == "Stack" && id != null && id !in castHere && dev.cardstashy.nativeplay.ui.pendingCast(st)?.id == id) {
                        // T6 (Arena clip 1): the card goes to the stack first, then asks for its targets or its mana.
                        out += Step(Kind.CAST, TO_STACK_MS, TO_STACK_MS, cardId = id, cardName = e.card.name,
                            travel = Travel(id, e.card.name, true, Leg.TO_STACK, "stackcard", TO_STACK_MS))
                        // M6: it pops large, then waits at stack size until answered.
                        out += Step(Kind.CAST, POP_MS, POP_MS, focal = true, cardId = id, cardName = e.card.name,
                            travel = Travel(id, e.card.name, true, Leg.POP, "stackcard", POP_MS))
                    } else if (e.from == "Hand" && e.to == "Stack" && id != null && id !in castHere && e.seq == lastSeq &&
                        cpu(e.player ?: controllerOf(id)) && before?.stack?.any { it.source?.id == id } != true) {
                        // The host pauses the CPU on its cast and publishes the board then, and may do so before it writes the cast event
                        // (Forge's handlers for one event run in no fixed order): that board ends on the card's move to the stack. It is the
                        // cast, told once here with the stack item's own targets; the cast event in the next board is skipped above.
                        val item = st.stack.firstOrNull { it.source?.id == id }
                        cpuCast(e.copy(type = "cast", player = e.player ?: controllerOf(id), source = e.card, card = null,
                            stackId = item?.id, targets = item?.targets.orEmpty()))
                    } else if (e.from == "Hand" && e.to == "Battlefield" && id != null && !e.token && id !in landHere && e.seq == lastSeq &&
                        cpu(e.player ?: controllerOf(id)) && st.card(id)?.isLand == true && before?.card(id)?.zone != "Battlefield") {
                        // The host pauses the CPU on its land play and publishes the board then, before it writes the land event: that
                        // board ends on the land's move from the hand. It is the land play, told once here; the land event that follows
                        // in the next board is skipped above (live 0.4.59: the CPU's land flew in twice).
                        cpuLand(e.card, e.turn)
                    } else zoneStep(e, me)?.let { if (it.kind == Kind.TOKEN || it.kind == Kind.DRAW) groupOrAdd(out, it) else out += it }
                }
            }
        }
        // P2b, tapping lands by hand (Randall 11 Nov): lands of yours that tapped with no cast to pay for, while your floating mana
        // grew, send their light to the mana by your square. One step. Forge alone says what was tapped and what is floating.
        val byHand = tapsLeft[me].orEmpty()
        if (byHand.isNotEmpty() && poolNow > poolBefore && events.none { it.type in PAID_FOR && it.player == me }) {
            val ms = poolMs(byHand.size)
            out += Step(Kind.MANA, ms, PAY_MIN_MS, travel = Travel(null, null, true, Leg.TO_POOL, "manapool", ms, taps = byHand))
        }
        // P2b, Undo: lands of yours that stood tapped and are ready again in the same turn, your floating mana gone down with them:
        // they turn back with a gold glint (240) and the light returns from the pool. One step.
        if (before != null && before.turn == st.turn && poolNow < poolBefore && events.none { it.type == "turn" || (it.type in PAID_FOR && it.player == me) }) {
            val back = st.players.firstOrNull { it.id == me }?.battlefield.orEmpty().filter { c -> c.isLand && !c.tapped && before.card(c.id)?.let { it.zone == "Battlefield" && it.tapped } == true }.map { it.id }
            if (back.isNotEmpty()) out += Step(Kind.MANA, UNDO_MS, UNDO_MS, travel = Travel(null, null, true, Leg.UNTAP, "manapool", UNDO_MS, taps = back))
        }
        // Damage or drain to you that no cast above explains (combat, a trigger resolving): one red caption.
        if (!explainedLife) lifeChange(st, events)?.let { (from, to) ->
            out += Step(Kind.LIFE, 360 + 90L * (from - to).coerceAtMost(20), 360, "CMB-005", focal = true, cpu = true,
                beat = Beat(Beat.Kind.AFFECTS_YOU, "You lose ${from - to} life", null, null, null, from, to))
        }
        return out
    }

    /**
     * Whether a trigger Forge resolved in this poll keeps its stack item up after its read: only while a result of it is still to
     * land ([pending], the RESULT steps not yet played). One that changed nothing shown (a draw, a scry) leaves the stack after its read.
     */
    fun keepsStack(t: Trig, pending: Collection<Resolution>): Boolean = t.stackId != null && pending.any { t.stackId in it.stackIds }

    /** The result whose words a trigger's stack item reads: the one for its own stack id, by source only when Forge gave no id. */
    fun resultFor(t: Trig, pending: Collection<Resolution>): Resolution? =
        if (t.stackId != null) pending.firstOrNull { t.stackId in it.stackIds } else pending.firstOrNull { it.sourceId != null && it.sourceId == t.sourceId }

    /**
     * How long the auto-pass waits with a trigger on top of the stack: null while it is not on screen yet ([seenAt] null), else at
     * least what is left of its [STACK_HOLD_MS] read since [seenAt], and never less than the pass's own [base] delay.
     */
    fun passWait(seenAt: Long?, now: Long, base: Long): Long? = seenAt?.let { maxOf(base, STACK_HOLD_MS - (now - it)) }

    /**
     * 0.4.59 T5: the auto-pass wait with [top] on top of the stack, for every item (a spell rests 900 ms too, not only a trigger):
     * [base] with nothing there, null while it is not on screen yet ([shown] the items the shown board has), else [passWait].
     */
    fun passWaitFor(top: Int?, seenAt: Map<Int, Long>, shown: Collection<Int>, now: Long, base: Long): Long? =
        if (top == null) base else passWait(seenAt[top]?.takeIf { top in shown }, now, base)

    /** T5 item 1: the paying lands tap one by one, [TAP_GAP_MS] apart, each turning in [TAP_TURN_MS]. */
/** T6: Cancel, the card from the stack back to your hand. */
    const val BACK_MS = 380L
    /** Match punch P2, Pay: the lands turn [TAP_GAP_MS] apart, each with a bounce in [TAP_TURN_MS]. */
    const val TAP_GAP_MS = 80L
    const val TAP_TURN_MS = 170L
    fun tapsMs(n: Int): Long = if (n <= 0) 0 else TAP_GAP_MS * (n - 1) + TAP_TURN_MS
    /** P2, Pay: a land's streak leaves [STREAK_LEAVE_MS] after its turn starts and reaches the stack card [STREAK_MS] later. */
    const val STREAK_LEAVE_MS = 60L
    const val STREAK_MS = 280L
    /** P2, Charge: each arrival swells the spell 4 % for this long. */
    const val CHARGE_MS = 160L
    /** When land [i]'s streak reaches the spell, from the start of the pay. */
    fun streakArrives(i: Int): Long = TAP_GAP_MS * i + STREAK_LEAVE_MS + STREAK_MS
    /** P2, Pay as a whole: the last streak in, then 40 ms before the burst. Never under [PAY_MIN_MS] with a prompt waiting. */
    fun payMs(n: Int): Long = if (n <= 0) 0 else streakArrives(n - 1) + 40L
    const val PAY_MIN_MS = 200L
    /** P2b: lands tapped by hand, their streaks to the floating mana (the last one in ends the step). */
    fun poolMs(n: Int): Long = if (n <= 0) 0 else streakArrives(n - 1)
    /** P2b: Undo, the land turns back with a gold glint. */
    const val UNDO_MS = 240L
    /** Events that mana is spent on: with one of yours in the poll, tapped lands paid for it and are not "by hand". */
    private val PAID_FOR = setOf("cast", "ability")
    /** P2, Burst: a 70 ms freeze, then 300 ms of spikes, ring, sparks, push-in and shake. Min 150. */
    const val BURST_FREEZE_MS = 70L
    const val BURST_MS = 370L
    const val BURST_MIN_MS = 150L
    /** P2, Read: a cast spell stays on the stack this long after its burst (500 before one of your prompts). */
    const val CAST_READ_MS = 525L
    const val CAST_READ_PROMPT_MS = 500L
    /** P2, Lift: the card dips 10 dp and shrinks 4 % ([LIFT_MS]), then flies to the stack with a small overshoot (300). */
    const val LIFT_MS = 70L
    const val TO_STACK_MS = 200L
    /** Mobile table M6 (measured from Arena): out to stack size 200, grow 300, hold 650, shrink 200, the lands pay, drop 400. */
    const val POP_GROW_MS = 300L
    const val POP_HOLD_MS = 650L
    const val POP_SHRINK_MS = 200L
    const val POP_MS = POP_GROW_MS + POP_HOLD_MS + POP_SHRINK_MS
    /** How far along its pop a card is at [ms]: 0 at stack size, 1 large. */
    fun popAt(ms: Long): Float = when {
        ms <= 0L || ms >= POP_MS -> 0f
        ms < POP_GROW_MS -> (1f - ms.toFloat() / POP_GROW_MS).let { 1f - it * it * it }
        ms <= POP_GROW_MS + POP_HOLD_MS -> 1f
        else -> ((POP_MS - ms).toFloat() / POP_SHRINK_MS).let { it * it * (3f - 2f * it) }
    }
    /** T5 items 4 to 6: stack to its slot, stack to its host, a land from the hand to its group. */
    /**
     * Match punch P4, the turn banner: 280 in (from half size with a bounce over a widening streak), held to 950, 240 out. The
     * steps after it start [BANNER_LEAD_MS] in and play under it (the untap ripple from 140, your draw from 380); it never blocks input.
     */
    const val BANNER_MS = 1190L
    const val BANNER_LEAD_MS = 380L
    /** Match punch P3: on the stack the card rises 6 % and 12 dp ([RISE_MS]), then dives to its slot, accelerating (240). */
    const val RISE_MS = 90L
    const val TO_SLOT_MS = 400L
    const val TO_HOST_MS = 400L
    const val TO_GROUP_MS = 500L

    /** Beat 1, the source's lift and ring (sTrig: 180 up, 260 held, 180 down; the ring 520 ms). */
    const val SOURCE_MS = 520L
    /** Beat 2: a trigger's stack item stays readable at least this long, even when nobody can respond (also with reduced motion). */
    const val STACK_HOLD_MS = 900L
    /** Beat 3: the landing (streak, flash, "+1/+1" rising, chip pop) and the P/T plate's green or coral tick. */
    const val RESULT_MS = 1200L
    const val FIZZLE_MS = 700L

    /** A stack item while the director follows the stack through one poll (top at the end of the list). */
    private class Entry(val stackId: Int?, val sourceId: Int?, val sourceName: String?, val controller: Int?, val trigger: Boolean, val text: String?, val targets: List<Ref>)

    /**
     * Each resolve in [events] tied to what it changed, read from Forge's own log and the snapshots around it ([before] the board
     * last shown, [after] the newest). Forge applies a stack item's effects and fires its resolve last, so a result (counters, a
     * token entering, non-combat damage, a life change) belongs to the resolve that follows it, as long as no other stack event
     * (cast, trigger, ability, turn, attack, block, land) comes between; when Forge names the resolving card on the result
     * (counters.source, zone.by) it must be that resolve's card. Which item resolved comes from following the stack: [before]'s
     * stack plus the items put on it in [events]; [triggerIds] are the stack ids Forge reported as triggers in earlier polls.
     * A power/toughness change comes from comparing [before] and [after]: it goes to the resolve that put counters on the card when
     * those counters explain the whole change, else (never across a turn) to the one that targeted it, else to the only resolve in
     * the poll when the card is that resolve's own source.
     * The same trigger from the same source changing the same cards, one after another, is one result with a count.
     */
    fun resolutions(before: MatchState?, after: MatchState, events: List<GameEvent>, triggerIds: Set<Int> = emptySet()): List<Resolution> {
        val snapStack = after.stack + before?.stack.orEmpty()
        fun textOf(id: Int?) = id?.let { i -> snapStack.firstOrNull { it.id == i }?.text?.takeIf { it.isNotBlank() } }
        val stack = ArrayList<Entry>()
        before?.stack?.reversed()?.forEach { s -> stack += Entry(s.id, s.source?.id, s.source?.name, s.controller, s.trigger || s.id in triggerIds, s.text.takeIf { it.isNotBlank() }, s.targets) }
        val pending = ArrayList<GameEvent>()
        val out = ArrayList<Resolution>()
        fun counterDelta(e: GameEvent): Int {
            val from = e.from?.toIntOrNull(); val to = e.to?.toIntOrNull()
            if (from != null && to != null) return to - from
            val id = e.card?.id ?: return 0; val k = e.counter ?: return 0
            val now = after.card(id)?.counters?.get(k) ?: 0; val was = before?.card(id)?.counters?.get(k) ?: 0
            return now - was
        }
        for (e in events.sortedBy { it.seq }) when (e.type) {
            "cast", "trigger", "ability" -> {
                pending.clear()
                stack += Entry(e.stackId, e.source?.id, e.source?.name, e.player ?: e.source?.id?.let { after.card(it)?.controller }, e.type == "trigger", textOf(e.stackId), e.targets)
            }
            "counters", "life" -> pending += e
            "damage" -> if (!e.combat) pending += e
            "zone" -> if (e.token && e.to == "Battlefield") pending += e
            "turn", "attack", "block", "land" -> pending.clear()
            "resolve" -> {
                val src = e.source?.id ?: e.card?.id
                val i = stack.indexOfLast { it.sourceId == src }
                val entry = if (i >= 0) stack.removeAt(i) else null
                // A result Forge tied to another resolving card is not this one's.
                val mine = if (e.fizzled) emptyList() else pending.filter { r -> val by = when (r.type) { "zone" -> r.by; "counters" -> r.source; else -> null }; by == null || by.id == src }
                pending.clear()
                fun nameOf(r: Ref?) = r?.name ?: r?.id?.let { (after.card(it) ?: before?.card(it))?.name }
                out += Resolution(e.seq, entry?.stackId, src, e.source?.name ?: entry?.sourceName ?: src?.let { (after.card(it) ?: before?.card(it))?.name },
                    entry?.controller ?: src?.let { (after.card(it) ?: before?.card(it))?.controller }, entry?.trigger == true, e.fizzled, entry?.text, entry?.targets.orEmpty(),
                    counters = mine.filter { it.type == "counters" && it.card != null }.map { CounterChange(it.card!!.id, nameOf(it.card), it.counter ?: "", counterDelta(it)) }.filter { it.delta != 0 },
                    tokens = mine.filter { it.type == "zone" }.mapNotNull { z -> z.card?.let { c -> c.copy(name = nameOf(c)) } },
                    damage = mine.filter { it.type == "damage" && it.target != null && (it.amount ?: 0) > 0 }.map { it.target!!.let { t -> t.copy(name = if (t.kind == "card") nameOf(t) else t.name) } to it.amount!! },
                    life = mine.filter { it.type == "life" && it.player != null && it.lifeFrom != null && it.lifeTo != null }.map { LifeChange(it.player!!, it.lifeFrom!!, it.lifeTo!!) })
            }
        }
        // Power/toughness that moved without (only) counters: the snapshot diff, given to the resolve that explains it.
        if (before != null && out.isNotEmpty()) {
            val crossTurn = events.any { it.type == "turn" }
            val was = before.players.flatMap { it.battlefield }.associateBy { it.id }
            val live = out.indices.filter { !out[it].fizzled }
            for (c in after.players.flatMap { it.battlefield }) {
                val o = was[c.id] ?: continue
                val p0 = o.power ?: continue; val p1 = c.power ?: continue
                val t0 = o.toughness ?: 0; val t1 = c.toughness ?: 0
                if (p0 == p1 && t0 == t1) continue
                // Counters Forge reported on the card own its change only when they explain all of it: +1/+1 and -1/-1 counters
                // summed over the poll equal the change on both numbers (anything else, such as a pump ending across a turn, also moved it).
                val counted = live.filter { k -> out[k].counters.any { it.cardId == c.id } }
                val owner = if (counted.isNotEmpty()) {
                    val n = counted.sumOf { k -> out[k].counters.filter { it.cardId == c.id }.sumOf { ch ->
                        when { ch.counter.equals("P1P1", true) -> ch.delta; ch.counter.equals("M1M1", true) -> -ch.delta; else -> 0 } } }
                    counted.last().takeIf { n != 0 && p1 - p0 == n && t1 - t0 == n } ?: continue
                } else if (crossTurn) continue
                // Else the resolve that targeted it, else the only resolve in the poll when the card is its own source; never a change
                // Forge did not tie to it (a lord dying, a static effect), and never across a turn.
                else live.lastOrNull { k -> out[k].targets.any { it.kind == "card" && it.id == c.id } }
                    ?: live.singleOrNull()?.takeIf { out[it].sourceId == c.id } ?: continue
                out[owner] = out[owner].copy(pt = out[owner].pt + PtChange(c.id, c.name, p0, t0, p1, t1))
            }
        }
        // One beat with ×N for the same trigger from the same source landing on the same cards (table-info I1 addition a).
        val merged = ArrayList<Resolution>()
        for (r in out) {
            val p = merged.lastOrNull()
            if (p != null && p.trigger && r.trigger && !p.fizzled && !r.fizzled && !p.empty && !r.empty && p.sourceId != null && p.sourceId == r.sourceId &&
                p.text == r.text && p.targets == r.targets && p.changed.toSet() == r.changed.toSet()) {
                val pt = (p.pt + r.pt).groupBy { it.cardId }.map { (_, l) -> l.first().copy(toP = l.last().toP, toT = l.last().toT) }
                merged[merged.lastIndex] = r.copy(counters = p.counters + r.counters, pt = pt, tokens = p.tokens + r.tokens, damage = p.damage + r.damage,
                    life = p.life + r.life, count = p.count + r.count, stackIds = p.stackIds + r.stackIds)
            } else merged += r
        }
        return merged
    }

    /**
     * [after] as it was before [pending] results landed: the cards they changed keep [before]'s power, toughness and counters, and
     * the tokens they made are not there yet. The table shows this until each result's own beat, so the change happens on screen.
     */
    fun beforeResults(after: MatchState, before: MatchState?, pending: Collection<Resolution>): MatchState {
        if (pending.isEmpty()) return after
        val tokens = pending.flatMap { r -> r.tokens.map { it.id } }.toSet()
        val changed = pending.flatMap { it.changed }.toSet()
        val was = before?.players?.flatMap { it.battlefield }?.associateBy { it.id }.orEmpty()
        val added = pending.flatMap { it.counters }.groupBy { it.cardId }
        return after.copy(players = after.players.map { p -> p.copy(battlefield = p.battlefield.filter { it.id !in tokens }.map { c ->
            if (c.id !in changed) c
            else was[c.id]?.let { o -> c.copy(power = o.power, toughness = o.toughness, counters = o.counters) }
                // New since the last board: take back only the counters Forge said were added.
                ?: c.copy(counters = c.counters.mapValues { (k, v) -> v - added[c.id].orEmpty().filter { it.counter == k }.sumOf { it.delta } }.filterValues { it > 0 })
        }) })
    }

    /** A trigger's own words when Forge never showed its stack item: the source's lines that start "When", "Whenever" or "At". */
    fun triggerText(text: String?): String =
        text.orEmpty().lines().map { it.trim() }.filter { Regex("^(When|Whenever|At) ", RegexOption.IGNORE_CASE).containsMatchIn(it) }.joinToString("\n")

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
     * [QUEUE_CUT_MS] of steps are queued, a non-focal step plays at its Min and a focal one never under its Min. Butter pass B4
     * (Randall 14 Nov, "cpu playing too fast"): the CPU's own moves (a cast, a land, an attack, a block, an ability or trigger, a
     * card's travel) are never cut; only plain steps such as resolves are.
     */
    fun lengthOf(s: Step, waiting: Boolean, queuedMs: Long): Long = when {
        s.kind == Kind.THINK -> s.ms
        s.cpu && (s.kind in CPU_MOVES || s.travel != null) -> maxOf(s.ms, s.minMs)
        (waiting || queuedMs > QUEUE_CUT_MS) && !s.focal -> s.minMs
        else -> maxOf(s.ms, s.minMs)
    }
    const val QUEUE_CUT_MS = 12_000L
    private val CPU_MOVES = setOf(Kind.CAST, Kind.LAND, Kind.ATTACK, Kind.BLOCK, Kind.ABILITY, Kind.TRIGGER, Kind.ENTER)

    /** Whether the board's wait counts for [lengthOf]: a chance to respond on the CPU's turn is the very move being shown, so it
     *  does not hurry that move; your own turn's waits and real questions (a prompt) still do. */
    fun waitingFor(st: MatchState?): Boolean = st?.waitingOnMe == true && (st.activePlayer == st.viewer || st.prompt != null)
}

/**
 * A TRIGGER SHOWS ITSELF: the beat of a trigger the table is drawing now, set by the controller for each of its three beats.
 * SOURCE: the card that triggered lifts and rings in the caster's colour. STACK: its item is up as an art card with "Trigger"
 * and its text (held to read). RESULT: [result] lands on the cards it changed, with its one trail [line]. [key] is new per beat.
 */
data class TriggerMoment(val phase: Phase, val sourceId: Int?, val sourceName: String?, val yours: Boolean, val stackId: Int?, val count: Int = 1,
                         val result: Director.Resolution? = null, val line: String? = null, val key: Long = 0) {
    enum class Phase { SOURCE, STACK, RESULT }
}

/** 0.4.59 T5: the leg of a card's travel the table is drawing now, from [startedAt] (elapsedRealtime); [key] is new per leg. */
data class TravelMoment(val travel: Director.Travel, val startedAt: Long, val key: Long)

/** The CPU thinking right now (the dots by its portrait, the lifted card back in its hand), read by the table. */
object CpuThink {
    data class Tell(val lifted: Int?)
    val now = kotlinx.coroutines.flow.MutableStateFlow<Tell?>(null)
}
