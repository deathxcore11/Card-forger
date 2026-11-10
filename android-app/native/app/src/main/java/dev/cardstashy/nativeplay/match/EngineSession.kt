package dev.cardstashy.nativeplay.match

import cardstashy.forge.LocalEngine
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.engine.ForgeService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.UUID

/** What the table needs from a running match: the same two calls whether Forge runs on the phone or on the host. */
class Reply(private val status: Int, private val body: String) { fun status() = status; fun body() = body }

interface EngineSession {
    fun call(method: String, path: String, body: String?): Reply
    fun close()
}

class LocalSession(private val s: LocalEngine.Session) : EngineSession {
    override fun call(method: String, path: String, body: String?): Reply = s.call(method, path, body).let { Reply(it.status(), it.body()) }
    override fun close() = ForgeService.close(s)
}

/**
 * A friend match: Forge runs on the host with one seat per player (play-forge-host-client.js attach). The state read answers with this
 * seat's own view, an action is posted with a fresh command id and the match's generation, and a finished match keeps its last board
 * with the result on it. Both calls answer in the local engine's shape, so the table does not know the difference.
 */
class RemoteSession(private val matchId: String, private val token: suspend () -> String? = { Account.token() }, private val site: String = "https://cardstashy.com",
                    private val http: (String, String, Map<String, String>, String?) -> com.google.gson.JsonElement? = { m, u, h, b -> Http.call(m, u, h, b, timeoutMs = 15000) }) : EngineSession {
    @Volatile private var generation: String? = null
    @Volatile private var last: JsonObject? = null
    private val base get() = "$site/api/play/matches/$matchId"
    // The host refuses any non-GET without the site's Origin (session-authority verifyHostUser); a browser adds it, OkHttp does not.
    private fun auth(): Map<String, String> = mapOf("Authorization" to "Bearer " + (runBlocking { token() } ?: throw java.io.IOException("sign_in")), "Origin" to dev.cardstashy.nativeplay.play.FriendRooms.ORIGIN)

    override fun call(method: String, path: String, body: String?): Reply = try {
        when {
            method == "GET" && path == "/state" -> state()
            method == "POST" && path == "/action" -> act(body ?: "{}")
            else -> Reply(404, "{\"error\":\"not_found\"}")
        }
    } catch (f: Http.Failure) {
        // The host ended this seat's table (the other player left, the match expired or was interrupted): 410 match_<status>. Without a
        // board the table polled forever; it now gets the last board marked failed with the host's reason, never a guessed winner.
        val prev = last
        if (method == "GET" && path == "/state" && f.status == 410 && prev != null && prev.get("status")?.asString.let { it == "finished" || it == "failed" })
            Reply(200, prev.toString())
        else if (method == "GET" && path == "/state" && f.status == 410 && prev != null)
            Reply(200, terminal(prev, "failed").apply { addProperty("failure", "host_" + (runCatching { JsonParser.parseString(f.body).asJsonObject.get("error")?.asString }.getOrNull() ?: "match_ended")) }.toString())
        else Reply(f.status, f.body.ifBlank { "{\"error\":\"http_${f.status}\"}" })
    }

    /**
     * The last board as a terminal one. Its revision moves on by one: the table queues a board only when the revision (or the input)
     * changes, so a finish carried on the old revision was never shown (live 0.4.57: the winner stayed on the attack screen).
     */
    private fun terminal(prev: JsonObject, status: String): JsonObject = prev.deepCopy().apply {
        addProperty("status", status)
        val rev = get("revision")?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asLong ?: 0L
        addProperty("revision", rev + 1)
        last = this
    }

    private fun state(): Reply {
        val d = http("GET", base, auth(), null)?.asJsonObject ?: return Reply(502, "{}")
        d.get("generation")?.takeIf { it.isJsonPrimitive }?.asString?.let { generation = it }
        return when (d.get("status")?.asString) {
            "running" -> { val s = d.getAsJsonObject("snapshot"); last = s; Reply(200, s.toString()) }
            "finished" -> {
                val r = d.getAsJsonObject("result")
                val s = (last?.takeIf { it.get("status")?.asString != "finished" }?.let { terminal(it, "finished") } ?: last?.deepCopy() ?: JsonObject()).apply {
                    addProperty("status", "finished")
                    r?.get("winnerPlayerId")?.takeIf { it.isJsonPrimitive }?.let { add("winnerPlayerId", it) }
                    addProperty("draw", r?.get("draw")?.asBoolean == true)
                }
                Reply(200, s.toString())
            }
            else -> Reply(202, "{\"status\":\"initializing\"}")
        }
    }

    private fun act(body: String): Reply {
        val g = generation ?: return Reply(409, "{\"error\":\"native_match_unavailable\"}")
        val wrapped = JsonObject().apply { addProperty("commandId", UUID.randomUUID().toString()); addProperty("generation", g); add("action", JsonParser.parseString(body)) }
        http("POST", "$base/actions", auth(), wrapped.toString())
        return Reply(202, "{}")
    }

    /** Leave the match: the host ends the table (its one-match-per-account limit frees up). */
    // Called from the table on the main thread: the token read and the request go to the network threads, and finish even if the table goes.
    override fun close() { CoroutineScope(Dispatchers.IO + NonCancellable).launch { runCatching { http("DELETE", base, auth(), null) } } }
}
