package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * specs/glow-rules.md: a card glows only when touching it right now does something legal. Forge says what can act
 * (selection.actionable); this only takes a light away when it can prove it wrong, never adds one.
 * Three lights that never look alike: the playable ring (ice, solid) on a card you can cast or play from hand, command zone,
 * graveyard or exile; the usable ring (violet, dashed, outside the card) on a permanent with a non-mana ability you can
 * activate; the payment light (mana gold, soft) over each source Forge's auto-pay would tap for the card you are carrying.
 * Nothing here looks at the device: every screen gets the same lights.
 */
object Glow {
    /** Rule 5: a question is open (targets, a choice, discard, payment, attackers, blockers, the opening hand). Every "usable" light is off. */
    fun asking(st: MatchState): Boolean = st.prompt != null || paying(st) ||
        st.inputType in setOf("InputSelectTargets", "InputAttack", "InputBlock", "InputConfirmMulligan") ||
        st.selection.cards.isNotEmpty() || st.selection.targetCards.isNotEmpty()

    /** Forge asks for mana (no dialog over it): the sources it lists are that question's answers. */
    fun paying(st: MatchState): Boolean = st.prompt == null && st.inputType?.startsWith("InputPayMana") == true

    /** Rule 3: a permanent whose only abilities make mana (a land, a mana rock, a mana creature). It lights only as payment. */
    fun manaOnly(c: Card): Boolean {
        val acts = c.text.lines().map { it.replace(Regex("\\([^)]*\\)"), "").trim() }.filter { it.contains(":") }
        if (acts.isEmpty()) return c.isLand
        return acts.all { Regex("\\badd\\b", RegexOption.IGNORE_CASE).containsMatchIn(it.substringAfter(":")) }
    }

    /**
     * Rule 7: the bridge's own pay plan says no (an empty tapPreview). A tapWarning (auto-pay would cost life or a sacrifice) is a
     * legal cast, so the card stays lit; its cost shows when lifted and the cast waits for that lift (glow-rules.md rule 7, 10 Nov).
     */
    fun planSaysNo(st: MatchState, id: Int): Boolean = st.selection.tapPlans[id]?.let { it.sources?.isEmpty() == true } == true

    /**
     * Rule 7 and I4: why a card the bridge's plan turned dark is dark, said on the card when it is lifted. A tapWarning is not a
     * "can't pay" (the bridge sets it only beside a real plan): the card stays castable on purpose (lift it, see the cost, then cast),
     * as the web asks confirmCostly before paying. An empty tapPreview has no plan at all.
     */
    fun costOf(st: MatchState, id: Int): String? = st.selection.tapPlans[id]?.let { p ->
        when (p.warning) { "life" -> "Costs life"; "sacrifice" -> "Costs a sacrifice"; else -> if (p.sources?.isEmpty() == true) "Not enough mana" else null }
    }

    /** A lit card whose payment costs life or a sacrifice: it casts only once lifted, with its cost showing (the web's confirmCostly). */
    fun costly(st: MatchState, live: Boolean, card: Card, blocked: Map<Int, String>, quiet: Set<Int>): Boolean =
        st.selection.tapPlans[card.id]?.warning != null && usable(card, st, live, blocked, quiet) == Mark.PLAYABLE

    /**
     * The "you can do this" light Forge's actionable list earns, after the proofs that take it away: [Mark.PLAYABLE] for a card
     * off the battlefield, [Mark.USABLE] for a permanent, [Mark.PICKABLE] for a source while Forge asks for mana, else NONE.
     * [blocked] and [quiet] are ShortCasts' sets for this snapshot.
     */
    fun usable(card: Card, st: MatchState, live: Boolean, blocked: Map<Int, String>, quiet: Set<Int>): Mark = when {
        !live -> Mark.NONE                                          // rule 1
        card.id !in st.selection.actionable -> Mark.NONE
        card.controller != st.viewer -> Mark.NONE                   // rule 6
        paying(st) -> Mark.PICKABLE                                 // rule 5: Forge's own list of sources it asks for
        asking(st) -> Mark.NONE                                     // rule 5
        card.id in blocked || card.id in quiet -> Mark.NONE         // rule 7 (provenUnaffordable, Forge's own pay check)
        planSaysNo(st, card.id) -> Mark.NONE                        // rule 7 (the bridge's tapPreview)
        card.zone == "Battlefield" -> if (manaOnly(card)) Mark.NONE else Mark.USABLE // rule 3
        else -> Mark.PLAYABLE
    }

    /**
     * W7/W8: the cards that make the table wait on you at a priority pass: exactly the ones that glow (playable or usable) and that
     * Forge does not call unavailable. An id Forge lists that is not one of your cards is no reason to stop.
     */
    fun stopsFor(st: MatchState, sc: ShortCasts = ShortCasts()): List<Int> {
        val blocked = runCatching { sc.blocked(st) }.getOrDefault(emptyMap())
        val quiet = runCatching { sc.quiet(st, blocked) }.getOrDefault(emptySet())
        val mine = st.me.hand + st.me.battlefield + st.me.graveyard + st.me.exile + st.me.command
        return st.selection.actionable.filter { id ->
            val c = mine.firstOrNull { it.id == id } ?: return@filter false
            st.selection.affordability[id] != "unavailable" && usable(c, st, true, blocked, quiet) != Mark.NONE
        }
    }

    /**
     * The board's light for [card] (ForgeBoard's markOf, pure so it can be checked per fixture): forge-table.mjs role(), chosen,
     * then a target, then a choice (discard while a discard asks), then [usable]. [blockPick] is the creature picked to block with,
     * [aimed] true when the block in hand may meet this attacker; [selectedHand] the lifted hand card.
     */
    fun mark(card: Card, st: MatchState, live: Boolean, blocked: Map<Int, String>, quiet: Set<Int>,
             selectedHand: Int? = null, blockPick: Int? = null, aimed: Boolean = false): Mark {
        val blockingNow = live && st.inputType == "InputBlock" && st.prompt == null
        val discarding = st.prompt == null && st.selection.cards.isNotEmpty() && Regex("\\bdiscard\\b", RegexOption.IGNORE_CASE).containsMatchIn(st.message)
        val discardAsk = dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) != null
        return when {
            !live -> Mark.NONE
            blockingNow && card.id == blockPick -> Mark.PICKED
            discardAsk && card.id == selectedHand && card.id in st.selection.cards -> Mark.PICKED
            blockingNow && aimed && card.attacking && card.controller != st.viewer -> Mark.TARGET
            card.id in blocked -> Mark.NONE
            card.id in st.selection.chosenCards -> Mark.PICKED
            card.id in st.selection.targetCards -> Mark.TARGET
            card.id in st.selection.cards -> if (discarding) Mark.DISCARD else Mark.PICKABLE
            // glow-rules.md rules 1-7: playable (hand, command zone, graveyard, exile), usable (a permanent's ability), or nothing.
            else -> usable(card, st, live, blocked, quiet)
        }
    }

    /**
     * Mobile table M2: while a target question offers permanents on both sides of the table, each offered one says whose it is
     * (true: yours, a blue ring and your seat name; false: the other side's, a red ring and its seat name). Whose it is comes from the table state
     * (its controller), never from a rules judgment. One side only, or no target question: empty, the ring alone.
     */
    fun sideTags(st: MatchState, live: Boolean): Map<Int, Boolean> {
        if (!live || st.prompt != null || st.inputType != "InputSelectTargets") return emptyMap()
        val sides = (st.selection.cards + st.selection.targetCards + st.selection.chosenCards).mapNotNull { st.card(it) }
            .filter { it.zone == "Battlefield" }.associate { it.id to (it.controller == st.viewer) }
        return if (sides.values.toSet().size == 2) sides else emptyMap()
    }

    /** Every card this snapshot shows with its board light (see [mark]), for checks. */
    fun boardMarks(st: MatchState, live: Boolean, sc: ShortCasts = ShortCasts(), selectedHand: Int? = null): Map<Int, Mark> {
        val blocked = sc.blocked(st); val quiet = sc.quiet(st, blocked)
        return st.players.flatMap { it.hand + it.battlefield + it.graveyard + it.exile + it.command }.associate { it.id to mark(it, st, live, blocked, quiet, selectedHand) }
    }

    /** Every card this snapshot shows with its usable light (none listed: NONE), for checks. */
    fun usableMarks(st: MatchState, live: Boolean, sc: ShortCasts = ShortCasts()): Map<Int, Mark> {
        val blocked = sc.blocked(st); val quiet = sc.quiet(st, blocked)
        return st.players.flatMap { it.hand + it.battlefield + it.graveyard + it.exile + it.command }.associate { it.id to usable(it, st, live, blocked, quiet) }
    }

    /**
     * The payment light: the sources the bridge's tapPreview names for [carried] (the hand card being dragged, lifted or under the
     * controller's ring). Only for a card that wears the playable ring; no preview from the bridge, no light.
     */
    fun payment(st: MatchState, live: Boolean, carried: Card?, blocked: Map<Int, String>, quiet: Set<Int>): Set<Int> {
        if (carried == null || usable(carried, st, live, blocked, quiet) != Mark.PLAYABLE) return emptySet()
        return st.selection.tapPlans[carried.id]?.sources?.toSet() ?: emptySet()
    }

    /**
     * 0.4.60 G6 review (glow-rules.md "The ability opens on the card": "The payment light shows what it would tap"): while [open]'s
     * ability rows are open, the sources the bridge's tapPreview names for it. Only for a permanent that wears the usable ring; no
     * preview from the bridge, no light (the same rule as [payment]).
     */
    fun abilityPayment(st: MatchState, live: Boolean, open: Card, blocked: Map<Int, String>, quiet: Set<Int>): Set<Int> {
        if (usable(open, st, live, blocked, quiet) != Mark.USABLE) return emptySet()
        return st.selection.tapPlans[open.id]?.sources?.toSet() ?: emptySet()
    }
}

/** M2: the offered targets that say whose they are ([Glow.sideTags]): card id to "yours". */
val LocalSideTags = compositionLocalOf<Map<Int, Boolean>> { emptyMap() }
/** M2: your side's ring and tag, and the CPU's. */
val SideYours = Color(0xFF5CC8FF)
val SideCpu = Color(0xFFFF5A4A)
/** The sources lit as payment for the carried hand card (mana gold over the card). */
val LocalPayLight = compositionLocalOf<Set<Int>> { emptySet() }
/** A payment light is showing (a hand card carried with a plan): the usable ring steps back so the payment light reads alone. */
val LocalHandCarry = compositionLocalOf { false }
/** Forge asks for mana: a source's A hint says "Tap for mana". */
val LocalPayInput = compositionLocalOf { false }
