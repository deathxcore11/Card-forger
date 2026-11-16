package dev.cardstashy.nativeplay.art

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Every Scryfall /cards/collection call the app makes, paced the way the site's own client paces them (scryfall-client.js:
 * collection calls start at least 510 ms apart, a 429 waits for its Retry-After, at least 1 s, and is asked again).
 * Scryfall allows two collection calls a second. Before this the art lookup sent up to three at once, the type lookup three
 * more straight after, and a refused call was tried once more after 700 ms and then never again that match, so a new deck's
 * cards could stay on their plain frame (Randall 11 Nov, "missing art when doing a new deck"). A deck played before needs no
 * call at all, which is why only new decks showed it.
 */
object ScryfallGate {
    const val GAP_MS = 510L
    private const val URL = "https://api.scryfall.com/cards/collection"

    /** One answer: its status, its body when it was JSON, and Retry-After in ms when Scryfall sent one. */
    class Reply(val status: Int, val body: JsonObject?, val retryAfterMs: Long? = null)

    private val client by lazy { OkHttpClient.Builder().retryOnConnectionFailure(true).build() }

    private fun post(body: String, timeoutMs: Int): Reply {
        val req = Request.Builder().url(URL).header("User-Agent", CardArt.UA).header("Accept", "application/json")
            .post(body.toRequestBody("application/json".toMediaType())).build()
        client.newBuilder().callTimeout(timeoutMs.toLong(), TimeUnit.MILLISECONDS).build().newCall(req).execute().use { r ->
            val text = r.body?.string().orEmpty()
            val json = runCatching { JsonParser.parseString(text).asJsonObject }.getOrNull()
            val after = r.header("Retry-After")?.trim()?.toDoubleOrNull()?.let { (it * 1000).toLong() }
            return Reply(r.code, json, after)
        }
    }

    /** Unit tests: the network and the clock. */
    @Volatile internal var send: (String, Int) -> Reply = ::post
    @Volatile internal var now: () -> Long = System::currentTimeMillis
    @Volatile internal var pause: suspend (Long) -> Unit = { delay(it) }
    internal fun reset() { generation++; send = ::post; now = System::currentTimeMillis; pause = { delay(it) }; nextStart.set(0L); quietUntil = 0L }

    /** Longest wait the gate takes for one busy answer, whatever Retry-After says, so a match never waits on Scryfall for long. */
    const val MAX_WAIT_MS = 4_000L
    /** One collection call gives up once this long has passed since it began (a stalled network: the match must still open). */
    const val BUDGET_MS = 25_000L
    /** After a call that never got any answer, every call skips Scryfall for this long instead of waiting out its own timeouts. */
    const val QUIET_MS = 30_000L

    /** Callers take their start slot one at a time; a busy answer moves [nextStart] without the lock, so a caller already waiting sees it. */
    private val lock = Mutex()
    private val nextStart = java.util.concurrent.atomic.AtomicLong(0L)
    @Volatile private var quietUntil = 0L
    /** Unit tests: a call begun before [reset] (a background lookup one test left running) stops instead of reaching the next test's fakes. */
    @Volatile private var generation = 0

    /**
     * POST [body] to /cards/collection and return its `data`, or null when Scryfall refused the request outright (a 4xx other
     * than 429: asking again would not help), did not answer after [attempts] tries, or [BUDGET_MS] ran out. Calls start one at a
     * time, [GAP_MS] apart; their answers may overlap.
     */
    suspend fun collection(body: String, timeoutMs: Int = 10_000, attempts: Int = 4): JsonArray? {
        val began = now(); val gen = generation
        var silent = false
        for (attempt in 0 until attempts) {
            if (gen != generation || now() < quietUntil) return null
            // A try that could run past the budget is not started: a stalled network gets a quick no, and the rest of the app goes quiet.
            if (attempt > 0 && now() - began + timeoutMs > BUDGET_MS) { if (silent) quietUntil = now() + QUIET_MS; return null }
            lock.withLock {
                // Wait for the slot, and again if a busy answer moved it while this caller slept.
                while (true) { val wait = nextStart.get() - now(); if (wait <= 0) break; pause(wait) }
                nextStart.accumulateAndGet(now() + GAP_MS, ::maxOf)
            }
            val r = withContext(Dispatchers.IO) { runCatching { send(body, timeoutMs) }.getOrNull() }
            if (gen != generation) return null
            if (r != null && r.status in 200..299) { quietUntil = 0L; return r.body?.getAsJsonArray("data") ?: JsonArray() }
            if (r != null && r.status in 400..499 && r.status != 429) return null
            val last = attempt == attempts - 1
            silent = r == null
            if (silent && last) { quietUntil = now() + QUIET_MS; return null }
            // Busy (429), a server error or no answer: everyone waits, then this call is asked again. Busy says how long (at least
            // 1 s, at most MAX_WAIT_MS); a call that is giving up moves nobody's start, except a busy one, which Scryfall asked for.
            val busy = r?.status == 429
            val back = if (busy) (r!!.retryAfterMs ?: 1000L).coerceIn(1000L, MAX_WAIT_MS) else minOf(600L shl attempt, MAX_WAIT_MS)
            val giveUp = last || now() - began + back >= BUDGET_MS
            if (!giveUp || busy) nextStart.accumulateAndGet(now() + back, ::maxOf)
            if (giveUp) return null
        }
        return null
    }

    /** A deck row's identifier Scryfall would refuse (and with it the whole 75-card call): an empty name, a set code outside 3-6 characters, a collector number outside 1-10. */
    fun valid(id: JsonObject): Boolean {
        fun s(k: String) = id.get(k)?.takeIf { it.isJsonPrimitive }?.asString
        s("name")?.let { return it.isNotBlank() }
        s("id")?.let { return it.isNotBlank() }
        val set = s("set"); val num = s("collector_number")
        return set != null && set.length in 3..6 && num != null && num.length in 1..10
    }
}
