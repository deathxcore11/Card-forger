package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Friend rooms (play-forge-host-client.js createFriendRooms): one person opens a room with a deck, the other joins it with the invite
 * (a link or a challenge), and the server starts one hosted Forge game with a seat each. Same routes, same refusal codes and messages.
 */
class FriendRooms(private val site: String = "https://cardstashy.com", private val token: suspend () -> String? = { Account.token() },
                  private val http: (String, String, Map<String, String>, String?) -> JsonElement? = { m, u, h, b -> Http.call(m, u, h, b, timeoutMs = 15000) }) {
    class Failure(val code: String, override val message: String, val status: Int = 0) : Exception(message)
    class Challenge(val roomId: String, val invite: String, val format: String, val fromId: String, val fromName: String?)

    companion object {
        val FORMATS = listOf("Commander", "Standard", "Modern")
        private val UUID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)
        private val INVITE = Regex("^[A-Za-z0-9_-]{43}$")
        val MESSAGES = mapOf(
            "room_full" to "This room already has two players.", "invite_expired" to "This invite has expired. Ask your friend for a new one.",
            "room_closed" to "Your friend closed this room.", "invite_not_found" to "This invite is no longer valid.", "own_room" to "This is your own room. Send the invite to a friend.",
            "player_busy" to "One of you is still in another match. Finish it, then try again.", "global_match_capacity" to "Every table is busy right now. Try again in a minute.",
            "invalid_match_input" to "This deck does not fit the room's format.")
        fun link(invite: String) = "https://cardstashy.com/#play/join/$invite"
        /** friendInviteFromHash, widened to what people paste: the link, the hash or the bare invite. */
        fun inviteFrom(text: String?): String? {
            val t = text?.trim() ?: return null
            Regex("#play/join/([A-Za-z0-9_-]{43})").find(t)?.let { return it.groupValues[1] }
            return t.takeIf { INVITE.matches(it) }
        }
        /** friendPlayerCard: your name and picture as the other player sees them. */
        fun playerCard(name: String?, image: String?): JsonObject? {
            val n = name?.replace(Regex("[\\u0000-\\u001f\\u007f]"), "")?.trim()?.take(40)?.ifBlank { null }
            val i = image?.takeIf { it.length <= 512 && it.startsWith("https://") }
            if (n == null && i == null) return null
            return JsonObject().apply { if (n != null) addProperty("name", n) else add("name", com.google.gson.JsonNull.INSTANCE); if (i != null) addProperty("image", i) else add("image", com.google.gson.JsonNull.INSTANCE); add("crop", com.google.gson.JsonNull.INSTANCE) }
        }
    }

    private suspend fun call(path: String, method: String = "POST", body: JsonObject? = null): JsonObject? = withContext(Dispatchers.IO) {
        val t = token() ?: throw Failure("sign_in", "Sign in to play with friends.")
        try {
            http(method, "$site$path", mapOf("Authorization" to "Bearer $t"), body?.toString())?.takeIf { it.isJsonObject }?.asJsonObject
        } catch (e: Http.Failure) {
            val code = Regex("\"error\"\\s*:\\s*\"([a-z0-9_]{1,100})\"").find(e.body)?.groupValues?.get(1) ?: "room_request_rejected"
            throw Failure(code, MESSAGES[code] ?: "The room could not be reached. Try again.", e.status)
        } catch (e: java.io.IOException) { throw Failure("offline", "Couldn’t reach CardStashy. Check your connection.") }
    }

    private fun room(id: String): String { require(UUID.matches(id)) { "FRIEND_ROOM_INVALID" }; return "/api/play/rooms/$id" }
    private fun invite(v: String): String { if (!INVITE.matches(v)) throw Failure("invite_not_found", MESSAGES.getValue("invite_not_found")); return v }
    private fun deckFor(format: String, deck: JsonObject) = deck.deepCopy().apply { addProperty("format", format) }

    /** A server from before player cards refuses the extra field: the room then opens without it. */
    private suspend fun withPlayer(path: String, body: JsonObject, player: JsonObject?, refusal: String): JsonObject? {
        if (player == null) return call(path, body = body)
        return try { call(path, body = body.deepCopy().apply { add("player", player) }) } catch (e: Failure) { if (e.code == refusal) call(path, body = body) else throw e }
    }

    /** {roomId, format, status:'open', expiresAt, seat:'host', invite}; [to] makes it a challenge only that friend sees, for five minutes. */
    suspend fun open(format: String, deck: JsonObject, player: JsonObject?, to: String? = null): JsonObject {
        require(format in FORMATS) { "FRIEND_FORMAT_UNSUPPORTED" }
        require(to == null || UUID.matches(to)) { "FRIEND_INVALID" }
        val body = JsonObject().apply { addProperty("format", format); add("deck", deckFor(format, deck)); if (to != null) addProperty("to", to) }
        return withPlayer("/api/play/rooms", body, player, "invalid_room") ?: JsonObject()
    }
    /** The room an invite opens, before choosing a deck: {roomId, format, status, seat:'guest'}. */
    suspend fun peek(code: String): JsonObject = call("/api/play/rooms/join", body = JsonObject().apply { addProperty("invite", invite(code)) }) ?: JsonObject()
    /** Take the second seat; the answer names the match both players then open. */
    suspend fun join(code: String, format: String, deck: JsonObject, player: JsonObject?): JsonObject {
        require(format in FORMATS) { "FRIEND_FORMAT_UNSUPPORTED" }
        val body = JsonObject().apply { addProperty("invite", invite(code)); add("deck", deckFor(format, deck)) }
        return withPlayer("/api/play/rooms/join", body, player, "invalid_invite") ?: JsonObject()
    }
    /** The host waits here: status 'started' brings matchId. */
    suspend fun read(id: String): JsonObject = call(room(id), "GET") ?: JsonObject()
    suspend fun cancel(id: String) { call(room(id), "DELETE") }
    suspend fun decline(id: String) { call(room(id), "DELETE") }
    /** Challenges waiting for you. */
    suspend fun challenges(): List<Challenge> {
        val a: JsonArray = call("/api/play/rooms", "GET")?.get("challenges")?.takeIf { it.isJsonArray }?.asJsonArray ?: return emptyList()
        return a.mapNotNull { e -> (e as? JsonObject)?.let { c ->
            fun s(k: String) = c.get(k)?.takeIf { it.isJsonPrimitive }?.asString
            val r = s("roomId"); val i = s("invite"); val f = s("fromId"); val fmt = s("format")
            if (r != null && UUID.matches(r) && i != null && INVITE.matches(i) && f != null && UUID.matches(f) && fmt in FORMATS) Challenge(r, i, fmt!!, f, c.getAsJsonObject("from")?.get("name")?.takeIf { it.isJsonPrimitive }?.asString) else null
        } }
    }
}
