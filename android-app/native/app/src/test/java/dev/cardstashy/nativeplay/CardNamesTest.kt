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

    /** Randall 17 Nov ("can we not add types"): a land name prompt offers lands only, a nonland one no lands. */
    @Test fun theAskSaysWhichTypes() {
        val land = CardNames.want("Choose a land card card name.")!!
        assertTrue(land.fits("L") && land.fits("CL") && !land.fits("C") && !land.fits("I"))
        val nonland = CardNames.want("Choose a nonland card name.")!!
        assertTrue(nonland.fits("C") && nonland.fits("I") && !nonland.fits("L") && !nonland.fits("CL"))
        val either = CardNames.want("Choose an artifact or creature card name.")!!
        assertTrue(either.fits("A") && either.fits("C") && !either.fits("L"))
        assertEquals("a type the list cannot check leaves every name", null, CardNames.want("Choose a basic land card name."))
        assertEquals(null, CardNames.want("Choose a card name"))
        assertTrue("a name newer than the list is offered", land.fits(null))
        assertEquals("L", CardNames.letters("Basic Land — Island")); assertEquals("AC", CardNames.letters("Artifact Creature — Golem"))
        assertEquals("CL", CardNames.letters("Land Creature — Forest Dryad"))
    }

    @Test fun suggestionsKeepToTheAsk() {
        val names = listOf("Mutavault", "Mutagenic Growth", "Mutant Surveyor")
        val types = mapOf("Mutavault" to "L", "Mutagenic Growth" to "I", "Mutant Surveyor" to "C")
        val land = CardNames.want("Choose a land card card name.")!!
        assertEquals(listOf("Mutavault"), CardNames.suggest(names, "mut", fits = { land.fits(types[it]) }))
    }

    /** The baked list (scripts/bake-card-types.mjs): every seed name has its types, Petrified Hamlet's lands among them. */
    @Test fun theTypeListCoversTheSeed() {
        val root = System.getProperty("repoRoot")
        val types = File(root, "android-app/native/app/src/main/assets/forge-rules-seed/card-types.json").reader().use { CardNames.readTypes(JsonReader(it)) }
        assertEquals("L", types["Petrified Hamlet"]); assertEquals("L", types["Mutavault"]); assertEquals("I", types["Fire"]); assertEquals("CL", types["Dryad Arbor"])
        val names = File(root, "android-app/native/app/src/main/assets/forge-rules-seed/cards.json").reader().use { CardNames.faces(CardNames.keys(JsonReader(it))) }
        val missing = names.filter { it !in types }
        assertTrue("${missing.size} seed names have no types, e.g. ${missing.take(8)}", missing.size < names.size / 50)
    }
}
