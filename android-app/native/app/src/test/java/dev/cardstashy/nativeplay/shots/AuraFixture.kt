package dev.cardstashy.nativeplay.shots

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref

/**
 * Randall's Fold recording 15 Nov 2026: Savannah Lions (1/2) wearing Holy Strength (his) and Weakness (the CPU's); with [board]'s
 * asking, Disenchant asks for its target as the real engine asked it (AuraTargetProbe): "Disenchant (1) - Destroy target artifact
 * or enchantment.", both auras in selection.cards, none in selection.targets.
 */
internal object AuraFixture {
    const val HOLY = 9401; const val WEAK = 9402; const val DIS = 9403

    private fun aura(id: Int, name: String, text: String, owner: Int, on: Card) = on.copy(id = id, name = name, type = "Enchantment — Aura", power = null, toughness = null,
        tapped = false, attacking = false, owner = owner, controller = owner, attachedTo = on.id, attachments = emptyList(), counters = emptyMap(), keywords = emptyList(), text = text, manaCost = "{W}")

    /** Savannah Lions (1/2) wearing Holy Strength (yours) and Weakness (the CPU's); [asking]: Disenchant asks for its target. */
    fun board(base: MatchState, asking: Boolean): MatchState {
        val me = base.viewer; val cpuId = base.players.first { it.id != me }.id
        val lions0 = base.me.battlefield.first { it.isCreature }
        val holy = aura(HOLY, "Holy Strength", "Enchant creature\nEnchanted creature gets +1/+2.", me, lions0)
        val weak = aura(WEAK, "Weakness", "Enchant creature\nEnchanted creature gets -2/-1.", cpuId, lions0).copy(manaCost = "{B}")
        val lions = lions0.copy(name = "Savannah Lions", power = 1, toughness = 2, text = "", keywords = emptyList(), keywordsKnown = true, counters = emptyMap(), attachments = listOf(HOLY, WEAK))
        val lands = base.me.battlefield.filter { it.isLand }.take(3)
        val st = base.copy(phase = "MAIN1", activePlayer = me, priorityPlayer = me, stack = emptyList(),
            players = base.players.map { p -> when (p.id) { me -> p.copy(battlefield = lands + lions + holy); cpuId -> p.copy(battlefield = p.battlefield.filter { it.isLand } + weak); else -> p } })
        if (!asking) return st.copy(inputType = "InputPassPriority", message = "", selection = st.selection.copy(cards = emptySet(), targetCards = emptySet(), chosenCards = emptySet(), actionable = emptySet()))
        // Disenchant left the hand for the stack (forge-table's pendingCast reads this zone event) and asks for its target.
        val moved = GameEvent(base.events.maxOfOrNull { it.seq }?.plus(1) ?: 1L, "zone", base.turn, "MAIN1", me, Ref("card", DIS, "Disenchant"), null, null, emptyList(), emptyList(), emptyList(),
            "Hand", "Stack", null, null, null, null)
        return st.copy(inputType = "InputSelectTargets", message = "Disenchant (1) - Destroy target artifact or enchantment.", events = st.events + moved,
            selection = st.selection.copy(cards = setOf(HOLY, WEAK), targetCards = emptySet(), chosenCards = emptySet(), players = emptySet(), actionable = emptySet(), min = 1, max = 1))
    }

}
