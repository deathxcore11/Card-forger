package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.art.CardArt
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/**
 * Live 0.4.57 on the Thor (fault list 7, 11): the opening hand and the log said "Wonderweave Aerialist" over a blank face, the
 * table and the bottom said "Skyward Spider". Every surface now reads the deck row's name, and the face has its picture at once.
 */
class FlavorNameTest {
    private val asked = mutableListOf<String>()

    @Before fun setUp() {
        CardArt.initIndexOnly(java.nio.file.Files.createTempDirectory("art").toFile())
        CardArt.seedForTest(listOf("Skyward Spider" to JsonObject().apply { addProperty("name", "Skyward Spider"); addProperty("set", "spm"); addProperty("collectorNumber", "1") }),
            mapOf("skyward spider" to ("u" to "c")))
        CardArt.oracleOf = { asked += it; if (it == "Wonderweave Aerialist") "Skyward Spider" else null }
        MatchState.shownName = CardArt::shown; MatchState.shownIn = CardArt::shownIn
    }

    @After fun tearDown() {
        MatchState.shownName = { it }; MatchState.shownIn = { it }
        CardArt.oracleOf = null; CardArt.seedForTest(emptyList(), emptyMap())
    }

    private val json = """
        {"status":"running","viewer":1,"turn":0,
         "players":[
          {"id":1,"name":"CardStashy","isViewer":true,"zones":{"Hand":{"count":1,"cards":[
            {"id":11,"zone":"Hand","hidden":false,"name":"Wonderweave Aerialist","type":"Creature","setCode":"om1","collectorNumber":"1","text":"Flying"}]}}},
          {"id":2,"name":"Forge AI","isViewer":false,"zones":{"Battlefield":{"cards":[
            {"id":21,"zone":"Battlefield","hidden":false,"name":"Spider Token","token":true},
            {"id":22,"zone":"Battlefield","hidden":false,"name":"Seam Rip"}]}}}],
         "stack":[{"id":5,"text":"Wonderweave Aerialist","source":{"id":31,"zone":"Stack","hidden":false,"name":"Wonderweave Aerialist"}}],
         "prompt":{"id":1,"method":"choose","message":"Choose targets for Wonderweave Aerialist","options":[]},
         "payment":{"forCard":{"kind":"card","id":31,"name":"Wonderweave Aerialist"}},
         "events":{"items":[{"seq":1,"type":"cast","card":{"kind":"card","id":31,"name":"Wonderweave Aerialist"}}]}}
    """.trimIndent()

    @Test fun everySurfaceReadsTheDeckName() {
        val st = MatchState.parse(json)!!
        // Item 7: the opening hand's face finds its picture on the first frame, under either name.
        assertEquals("u", CardArt.url("Wonderweave Aerialist"))
        assertEquals("Skyward Spider", st.me.hand.single().name)
        assertEquals("Skyward Spider", st.stack.single().source!!.name)
        assertEquals("Skyward Spider", st.stack.single().text)
        assertEquals("Choose targets for Skyward Spider", st.prompt!!.message)
        assertEquals("Choose targets for Skyward Spider", st.prompt!!.rawMessage)
        assertEquals("Skyward Spider", st.payment!!.forName)
        assertEquals("Skyward Spider", st.events.single().card!!.name)
        // A token and a card with no flavor name are as Forge sent them.
        assertEquals(listOf("Spider Token", "Seam Rip"), st.cpu.battlefield.map { it.name })
    }

    @Test fun eachNameIsAskedOnceAMatch() {
        MatchState.parse(json); MatchState.parse(json)
        // The deck's own name is never asked; a token never is; the rest once each.
        assertEquals(listOf("Wonderweave Aerialist", "Seam Rip"), asked)
    }
}
