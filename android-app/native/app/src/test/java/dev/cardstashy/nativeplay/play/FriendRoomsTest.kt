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

    /** A 100-card Commander deck whose rows carry images, prices and card text: the room body stays small (host cap 128 KB). */
    @Test fun roomDeckIsSmallForAHundredCardCommanderDeck() = runBlocking {
        val heavy = "x".repeat(1500)
        val rows = (1..99).joinToString(",") { i -> """{"name":"Card $i/Face","qty":1.0,"set":"cmm","number":"$i","finish":"foil","image":"https://img.test/$i.jpg","prices":{"usd":"1.00"},"oracle":"$heavy","art":"$heavy"}""" }
        val deck = JsonParser.parseString("""{"name":"Limit Break","format":"Commander","commander":"Cloud, Ex-SOLDIER","notes":"$heavy","cards":[$rows,{"name":"Cloud, Ex-SOLDIER","qty":1,"image":"$heavy"}],"commanders":[{"name":"Cloud, Ex-SOLDIER","qty":1}]}""").asJsonObject
        assertTrue("fixture should be over the host cap", deck.toString().toByteArray().size > 131072)
        val r = rooms { _, _ -> """{"roomId":"r","invite":"$inv"}""" }
        r.open("Commander", deck, FriendRooms.playerCard("Ann", null))
        val body = calls.single().third!!
        val size = body.toByteArray().size
        println("friend room body: $size bytes (raw deck ${deck.toString().toByteArray().size} bytes)")
        assertTrue("body $size bytes", size < 16384)
        val sent = JsonParser.parseString(body).asJsonObject.getAsJsonObject("deck")
        assertEquals(setOf("format", "name", "cards", "commanders", "commander"), sent.keySet())
        val first = sent.getAsJsonArray("cards")[0].asJsonObject
        assertEquals("Card 1 // Face", first["name"].asString); assertEquals("1", first["qty"].toString())
        assertEquals("cmm", first["set"].asString); assertEquals("1", first["number"].asString); assertEquals("foil", first["finish"].asString)
        assertNull(first["image"]); assertNull(first["prices"])
    }

    @Test fun pastedInvitesSurviveChatCopying() {
        val code = "QDtviC3HFM2fPmHwIjzz39zs8U9-HNS8_voRYgUSavg"
        assertEquals(43, code.length)
        assertEquals(code, FriendRooms.inviteFrom(code))
        assertEquals(code, FriendRooms.inviteFrom("https://cardstashy.com/#play/join/$code"))
        assertEquals(code, FriendRooms.inviteFrom("QDtviC3HFM2fPmHwIjzz39zs8U9-HNS8 _voRYgUSavg"))
        assertEquals(code, FriendRooms.inviteFrom("https://cardstashy.com/#play/jo\u200Bin/QDtviC3HFM2fPmHw\u200BIjzz39zs8U9-HNS8_voRYgUSavg"))
        assertEquals(code, FriendRooms.inviteFrom("$code\n"))
        assertEquals(code, FriendRooms.inviteFrom("\uFEFF https://cardstashy.com/#play/join/$code\r\n"))
        assertEquals(code, FriendRooms.inviteFrom("Join me: $code thanks"))
        assertNull(FriendRooms.inviteFrom("QDtviC3HFM2fPmHw"))
    }

    @Test fun everyRoomCallSendsTheSitesOrigin() = runBlocking {
        val heads = mutableListOf<Pair<String, String?>>()
        val r = FriendRooms("https://x.test", { "tok" }, { m, _, h, _ -> heads += m to h["Origin"]; JsonParser.parseString("""{"roomId":"r","invite":"$inv"}""") })
        r.open("Modern", JsonParser.parseString("""{"name":"D","format":"Modern","cards":[{"name":"Island","qty":60}]}""").asJsonObject, null)
        r.peek(inv)
        r.cancel("11111111-1111-1111-1111-111111111111")
        assertEquals(listOf("POST", "POST", "DELETE"), heads.map { it.first })
        assertTrue(heads.all { it.second == "https://cardstashy.com" })
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
