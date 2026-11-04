package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.match.RemoteSession
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FriendRoomsTest {
    private val inv = "A".repeat(43)
    private val calls = mutableListOf<Triple<String, String, String?>>()
    private fun rooms(answer: (String, String) -> String) = FriendRooms("https://x.test", { "tok" }, { m, u, h, b -> calls += Triple(m, u, b); assertEquals("Bearer tok", h["Authorization"]); JsonParser.parseString(answer(m, u)) })

    @Test fun inviteFromLinkOrBare() {
        assertEquals(inv, FriendRooms.inviteFrom("https://cardstashy.com/#play/join/$inv"))
        assertEquals(inv, FriendRooms.inviteFrom("  $inv "))
        assertNull(FriendRooms.inviteFrom("hello"))
        assertEquals("https://cardstashy.com/#play/join/$inv", FriendRooms.link(inv))
    }

    @Test fun openSendsTheDeckInTheRoomsFormatAndThePlayerCard() = runBlocking {
        val r = rooms { _, _ -> """{"roomId":"r","invite":"$inv"}""" }
        val deck = JsonParser.parseString("""{"name":"D","format":"Legacy","cards":[]}""").asJsonObject
        r.open("Modern", deck, FriendRooms.playerCard("Ann", "https://i.test/a.png"), to = "11111111-1111-1111-1111-111111111111")
        val sent = JsonParser.parseString(calls.single().third).asJsonObject
        assertEquals("Modern", sent.getAsJsonObject("deck")["format"].asString)
        assertEquals("Ann", sent.getAsJsonObject("player")["name"].asString)
        assertEquals("11111111-1111-1111-1111-111111111111", sent["to"].asString)
    }

    @Test fun refusalsKeepTheSitesWords() {
        val r = FriendRooms("https://x.test", { "t" }, { _, _, _, _ -> throw Http.Failure(409, """{"error":"room_full"}""") })
        val e = runCatching { runBlocking { r.peek(inv) } }.exceptionOrNull() as FriendRooms.Failure
        assertEquals("room_full", e.code); assertEquals("This room already has two players.", e.message)
    }

    @Test fun remoteSessionPostsActionsWithGenerationAndKeepsTheFinishedBoard() {
        val seen = mutableListOf<Pair<String, String?>>()
        var phase = "running"
        val s = RemoteSession("m1", { "tok" }, "https://x.test", { m, u, _, b ->
            seen += (m + " " + u) to b
            when {
                m == "GET" && phase == "running" -> JsonParser.parseString("""{"status":"running","generation":"g1","snapshot":{"status":"running","revision":4}}""")
                m == "GET" -> JsonParser.parseString("""{"status":"finished","result":{"draw":false,"winnerPlayerId":1}}""")
                else -> JsonParser.parseString("{}")
            }
        })
        assertEquals(4, JsonParser.parseString(s.call("GET", "/state", null).body()).asJsonObject["revision"].asInt)
        assertEquals(202, s.call("POST", "/action", """{"revision":4,"op":"ok"}""").status())
        val wrapped = JsonParser.parseString(seen.last().second).asJsonObject
        assertEquals("g1", wrapped["generation"].asString); assertEquals("ok", wrapped.getAsJsonObject("action")["op"].asString); assertTrue(wrapped["commandId"].asString.length > 20)
        phase = "done"
        val fin = JsonParser.parseString(s.call("GET", "/state", null).body()).asJsonObject
        assertEquals("finished", fin["status"].asString); assertEquals(1, fin["winnerPlayerId"].asInt); assertEquals(4, fin["revision"].asInt)
    }
}
