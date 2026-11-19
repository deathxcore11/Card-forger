package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Regression, recording 20261119_100903 (app 0.4.98), faults D and J: The Naked Time's chapter cards showed only "I" / "II" and its
 * effect's trigger read "ABILITY / ABILITY" with no words. The texts below are Forge's own, printed by NakedTimeProbe from a real
 * match on 19 Nov: the card's text, and the effect card Forge puts in the command zone, "The Naked Time (117)'s Effect".
 * A trigger Forge puts up and resolves inside one poll is drawn from its source card (MatchController, the trigger's beat 2).
 */
class TriggerCardWordsTest {
    private val nakedTime = "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n" +
        "I — Search your library for a basic Mountain card, put it onto the battlefield tapped, then shuffle.\n" +
        "II — Whenever a creature you control enters this turn, put a +1/+1 counter on it and it gains haste until end of turn.\n" +
        "III — Sacrifice a land."
    private val effectText = "Whenever a creature you control enters this turn, put a +1/+1 counter on it and it gains haste until end of turn."
    private fun card(name: String, type: String, text: String, lore: Int?, zone: String = "Battlefield") = Card(117, zone, 2, 2, false, name, type, "{1}{R}", text,
        null, null, false, false, false, 0, false, false, lore?.let { mapOf("LORE" to it) } ?: emptyMap(), emptyList(), null, emptyList())

    @Test fun aChapterResolvedInOnePollShowsItsOwnLine() {
        val saga = card("The Naked Time", "Enchantment - Saga", nakedTime, lore = 2)
        assertEquals("II — Whenever a creature you control enters this turn, put a +1/+1 counter on it and it gains haste until end of turn.",
            Director.triggerItemText(saga))
        assertEquals("I — Search your library for a basic Mountain card, put it onto the battlefield tapped, then shuffle.",
            Director.triggerItemText(saga.copy(counters = mapOf("LORE" to 1))))
        assertEquals("sacrificed after III, no lore left: its last chapter", "III — Sacrifice a land.",
            Director.triggerItemText(saga.copy(zone = "Graveyard", counters = emptyMap())))
    }

    @Test fun theEffectsTriggerShowsItsWordsAndItsCardsName() {
        assertEquals("The Naked Time", MatchState.plainName("The Naked Time (117)'s Effect"))
        assertEquals("a real name is left alone", "Urza's Saga", MatchState.plainName("Urza's Saga"))
        val effect = card(MatchState.plainName("The Naked Time (117)'s Effect"), "Effect", effectText, lore = null, zone = "Command")
        assertEquals(effectText, Director.triggerItemText(effect))
    }
}
