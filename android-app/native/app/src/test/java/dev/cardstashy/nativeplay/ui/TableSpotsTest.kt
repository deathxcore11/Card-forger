package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Thor 0.4.56 Mono-White Auras findings D (discard chip) and F (land pip on a saga), on the table's pure helpers. */
class TableSpotsTest {
    private fun card(id: Int, name: String, type: String, cost: String, text: String = "") = MatchState.parseCard(com.google.gson.JsonParser.parseString(
        """{"id":$id,"zone":"Battlefield","owner":1,"controller":1,"hidden":false,"name":"$name","type":"$type","manaCost":"$cost","text":"$text"}""").asJsonObject)

    @Test fun aOnTheChipDuringADiscardOnlyRestsOnTheFirstCard() {
        val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-early.json")!!.readText())!!
        val hand = orderedHand(base.me.hand, emptyList())
        val first = hand.first()
        val all = hand.map { it.id }.toSet()
        // Before: A with nothing walked picked hand.first() (the land) at once. Now it only rests on it.
        assertEquals(DiscardStep.Walk(first.id), discardChipStep(null, null, hand, all))
        assertEquals(DiscardStep.Pick(first.id), discardChipStep(first, null, hand, all))
        assertEquals(DiscardStep.Discard(first.id), discardChipStep(first, first.id, hand, all))
        assertEquals(DiscardStep.Inspect(first.id), discardChipStep(first, null, hand, emptySet()))
        assertNull(discardChipStep(null, null, emptyList(), all))
    }

    @Test fun onlyLandsWearTheLandPip() {
        val saga = card(1, "A Most Helpful Weaver", "Enchantment — Saga", "{1}{W}")
        val plains = card(2, "Plains", "Basic Land — Plains", "", "({T}: Add {W}.)")
        assertNull(landPip(saga, true))
        assertEquals('W', landPip(plains, true))
        assertNull(landPip(plains, false))
    }
}
