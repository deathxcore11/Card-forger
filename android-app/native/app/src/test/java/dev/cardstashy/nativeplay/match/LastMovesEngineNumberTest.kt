package dev.cardstashy.nativeplay.match

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * Regression, recording 20261119_100903 (app 0.4.98) at 1:07.9: the banner and the "Last moves" row both read
 * "The Naked Time (116)'s Effect: +1/+1 counter on Cosmogrand Zenith". "(116)" is Forge's own card number and must not reach the
 * player.
 *
 * The input is rebuilt from what the screen showed, word for word: the cause's name as Forge gave it and the one +1/+1 counter on
 * Cosmogrand Zenith. The stack id, card ids and seat numbers below are stand-ins (the recording cannot show them).
 */
class LastMovesEngineNumberTest {
    private val cpu = 2
    private val you = 1
    private val seen = Director.Resolution(
        seq = 1, stackId = 9, sourceId = null, sourceName = "The Naked Time (116)'s Effect", controller = cpu, trigger = true,
        fizzled = false, text = null, targets = emptyList(),
        counters = listOf(Director.CounterChange(cardId = 120, cardName = "Cosmogrand Zenith", counter = "P1P1", delta = 1)))

    @Test fun theRowSaysWhatItDid() {
        assertEquals("+1/+1 counter on Cosmogrand Zenith", seen.lines(you).single().text)
    }

    @Test fun theRowNamesTheCardWithoutForgesNumber() {
        val name = seen.lines(you).single().sourceName
        assertFalse("Last moves showed Forge's card number: \"$name\"", Regex("\\(\\d+\\)").containsMatchIn(name))
    }
}
