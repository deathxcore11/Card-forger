package dev.cardstashy.nativeplay

import com.google.gson.stream.JsonReader
import dev.cardstashy.nativeplay.engine.CardNames
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.StringReader

/** Randall 14 Nov ("Fix star trek"): Kai Winn asks you to name a card, and the app had no screen for it, so the match froze. */
class CardNamesTest {
    @Test fun theBridgesNameChoiceIsRead() {
        val st = MatchState.parse("""{"status":"running","revision":3,"prompt":{"id":225,"method":"getChoices","message":"Choose a nonland card name.","min":1,"max":1,
            "options":[],"supported":true,"nameChoice":{"count":34350}}}""")!!
        assertEquals(34350, st.prompt!!.nameCount)
        assertTrue("a name choice is answerable", !st.prompt!!.deadEnd)
        val plain = MatchState.parse("""{"status":"running","revision":3,"prompt":{"id":1,"method":"getChoices","message":"x","min":1,"max":1,"options":[],"supported":true}}""")!!
        assertEquals(null, plain.prompt!!.nameCount)
    }

    @Test fun namesAreFacesWithoutArenaCopies() {
        val ids = CardNames.keys(JsonReader(StringReader("""{"Fire // Ice":{"a":1},"A-Unholy Heat":{},"Lightning Bolt":{"v":{"x":[1,2]}},"Ice":{}}""")))
        assertEquals(listOf("Fire // Ice", "A-Unholy Heat", "Lightning Bolt", "Ice"), ids)
        assertEquals(listOf("Fire", "Ice", "Lightning Bolt"), CardNames.faces(ids))
    }

    @Test fun suggestionsStartWithWhatWasTyped() {
        val names = listOf("Bolt Bend", "Fireblast", "Lightning Bolt", "Lightning Helix", "Thunderbolt")
        assertEquals(emptyList<String>(), CardNames.suggest(names, "l"))
        assertEquals(listOf("Lightning Bolt", "Lightning Helix"), CardNames.suggest(names, "light"))
        assertEquals(listOf("Bolt Bend", "Lightning Bolt", "Thunderbolt"), CardNames.suggest(names, "BOLT"))
        assertEquals(listOf("Bolt Bend"), CardNames.suggest(names, "bolt", limit = 1))
    }

    /** The app's own rules seed: every row's faces, and the Star Trek cards among them. */
    @Test fun theSeedGivesTheNames() {
        val f = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/forge-rules-seed/cards.json")
        val names = f.reader().use { CardNames.faces(CardNames.keys(JsonReader(it))) }
        assertTrue("${names.size} names", names.size > 30_000)
        assertTrue("Lightning Bolt" in names && "Kai Winn, Faithless Leader" in names && "Fire" in names)
    }
}
