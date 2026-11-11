package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * 0.4.60 Z6 (specs/table-zones-brief.md, "One gold action button"): what the bottom-right corner offers, worked out from the table
 * alone so it is unit tested (TableActionsTest). One gold button, 44 dp tall, is the current action with the app's existing words
 * (okLabel, Cast, Play land, Discard X, End turn on W10's turn, No target, a short payment's Cancel); a smaller quiet button above it
 * (End turn, or Forge's other cancel); Undo in its own slot (U6); Forge's Yield in a three-dot menu beside the quiet one.
 *
 * Taken out of ForgeBoard's button block, branch for branch, so the words and what each press does are the same as before.
 */
internal object TableActions {
    /** What a press does: Forge's ok, Forge's cancel, play or cast the lifted hand card, or Attack all. */
    enum class Press { OK, CANCEL, PLAY, ATTACK_ALL }

    /** Which of the old layouts the corner takes (each draws its buttons in its own places). */
    enum class Kind { TUCKED, ATTACK_ALL, PICK_ONE, SHORT, END_TURN, PLAIN }

    data class Action(val label: String, val press: Press, val enabled: Boolean)

    /** One line of the three-dot menu: its key, its words, whether it is switched on now, whether it can be pressed now. */
    data class Item(val key: String, val label: String, val on: Boolean, val enabled: Boolean, val about: String)

    /**
     * The corner. [gold] is the gold button (null when there is none: the tucked question, a pick with no "No target"); [quiet] the
     * glass one above it; [undo] Undo in its own slot; [extra] Attack all; [confirm] the tucked question's confirm; [menu] the
     * three-dot menu's lines (the button shows only when there is one).
     */
    data class Corner(val kind: Kind, val gold: Action?, val quiet: Action?, val undo: Action?, val extra: Action?, val confirm: Action?, val menu: List<Item>)

    /** The menu's Yield line: Forge's yield on the ability on top of the stack (never a spell: the bridge refuses it). */
    const val YIELD = "yield"

    /** The three-dot menu: Yield while an ability is on top of the stack, whoever's turn or priority it is. */
    fun menu(st: MatchState, live: Boolean): List<Item> {
        val top = st.stack.firstOrNull()?.takeIf { it.ability } ?: return emptyList()
        val lock = !live || st.prompt != null || st.inputType == "InputLockUI"
        return listOf(Item(YIELD, if (top.yielded) "Yielding" else "Yield", top.yielded, !lock,
            if (top.yielded) "Stop yielding to this ability" else "Pass on this ability every time it is on top, until end of turn. Targets and choices still stop."))
    }

    /**
     * The corner while it is your move ([st].waitingOnMe, no prompt). [selected] is the lifted hand card the gold button would play
     * (already checked castable, or picked for a discard); [tucked] the T6 tucked question; [discarding] the cleanup discard.
     */
    fun of(st: MatchState, live: Boolean, selected: Card?, tucked: Boolean, discarding: Boolean,
           /** M3's safety net: the table should have passed for you by now and has not, so the press comes back as "Resolve". */
           resolveLate: Boolean = false): Corner {
        val menu = menu(st, live)
        // W10: your main phase 1, nothing on the stack and no creature able to attack: the step that follows is the end of the turn.
        val endTurnGold = selected == null && !discarding && noAttackersLeft(st)
        val ok = if (selected != null) (if (discarding) "Discard ${selected.name}" else if (selected.isLand) "Play land" else "Cast")
            else if (discarding && !st.buttons.okEnabled) "Choose a card to discard" else if (endTurnGold) "End turn" else okLabel(st).let { if (it == RESOLVING && resolveLate) "Resolve" else it }
        // End turn takes the gold spot on W10's turn (it presses Forge's cancel); the quiet one keeps the way on to combat.
        val second = if (selected != null) null else if (endTurnGold) okLabel(st) else cancelLabel(st)
        // A declaration Forge would refuse (a must-attack creature left out) is not offered as a live button.
        val mustLeft = st.inputType == "InputAttack" && st.me.battlefield.any { Affordability.owesAttack(it) }
        val okOn = st.buttons.okEnabled && !mustLeft
        val short = Affordability.paying(st)?.short == true
        val offered = if (st.inputType == "InputAttack") st.selection.cards.mapNotNull { st.card(it) }.filter { it.zone == "Battlefield" && it.controller == st.viewer && !it.attacking } else emptyList()
        val attackAll = offered.isNotEmpty() && st.selection.cards.size >= 2
        val pickOne = oneTarget(st) || onePick(st)
        return when {
            tucked -> Corner(Kind.TUCKED, null, second?.let { Action(it, Press.CANCEL, live) }, null, null,
                tuckLabels(st).getOrNull(1)?.let { Action(it, Press.OK, live && okOn) }, menu)
            attackAll -> Corner(Kind.ATTACK_ALL, Action(ok, Press.OK, live && okOn), null, null, Action("Attack all", Press.ATTACK_ALL, live), null, menu)
            pickOne -> Corner(Kind.PICK_ONE, if (st.selection.min == 0 && st.buttons.okEnabled) Action("No target", Press.OK, live) else null,
                second?.let { Action(it, Press.CANCEL, live) }, null, null, null, menu)
            // A payment your mana can't finish: Cancel is the gold one, and Pay automatically steps aside.
            short && second != null -> Corner(Kind.SHORT, Action(second, Press.CANCEL, live), if (st.buttons.okEnabled) Action(ok, Press.OK, live) else null, null, null, null, menu)
            endTurnGold -> Corner(Kind.END_TURN, Action(ok, Press.CANCEL, live), Action(second ?: "To combat", Press.OK, live && okOn), null, null, null, menu)
            else -> {
                val undo = second?.startsWith("Undo", ignoreCase = true) == true
                // Mobile table M3: while your own spell or trigger resolves by itself the gold button is not a press.
                Corner(Kind.PLAIN, Action(ok, if (selected != null) Press.PLAY else Press.OK, live && (selected != null || (okOn && ok != RESOLVING))),
                    second?.takeIf { !undo }?.let { Action(it, Press.CANCEL, live) }, second?.takeIf { undo }?.let { Action(it, Press.CANCEL, live) }, null, null, menu)
            }
        }
    }
}
