package dev.cardstashy.nativeplay.match

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.RandomBuild
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.security.MessageDigest

/**
 * Quick Play's Power reads (app.js quickContext: capturePracticeDeckContext's Power and bracket, run by the site's own code in the
 * random-build bundle). The site rates from the card catalog it keeps; the app's bundle loads card data first, so each read is kept on
 * the device for meta.js's 12-hour freshness (Power reads the tournament data), and the lobby reads the Quick Play pool in the
 * background so Play finds a matched deck at once. Reads go to the bundle ten lists at a time, the pick's own ahead of the background's.
 */
object QuickPower {
    private const val TTL = 12 * 3_600_000L
    private const val CHUNK = 10

    /** The bundle's call (RandomBuild.quickContext); tests answer it themselves. */
    @Volatile internal var engine: suspend (String, List<JsonObject>) -> JsonArray? = { f, d -> RandomBuild.quickContext(f, d).await() }
    /** True while a match is on the table: background reads wait. */
    @Volatile internal var paused: () -> Boolean = { RandomBuild.paused }

    private class Ask(val format: String, val items: List<Pair<String, JsonObject>>, val urgent: Boolean)
    private val lock = Any()
    private val known = HashMap<String, Pair<Long, QuickOpponent.Ctx>>()
    private val pending = HashMap<String, CompletableDeferred<QuickOpponent.Ctx?>>()
    private val queue = ArrayDeque<Ask>()
    private var worker: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var file: File? = null

    fun init(context: Context) {
        if (file != null) return
        val f = File(context.applicationContext.filesDir, "quick-power.json"); file = f
        runCatching {
            val now = System.currentTimeMillis()
            val rows = JsonParser.parseString(f.readText()).asJsonObject
            synchronized(lock) { for ((k, v) in rows.entrySet()) { val a = v.asJsonArray; val at = a[0].asLong
                if (now - at < TTL && k !in known) known[k] = at to QuickOpponent.Ctx(a[1].takeIf { !it.isJsonNull }?.asDouble, a[2].takeIf { !it.isJsonNull }?.asInt) } }
        }
    }

    private fun save() {
        val f = file ?: return
        val out = JsonObject(); val now = System.currentTimeMillis()
        synchronized(lock) { for ((k, v) in known) if (now - v.first < TTL) out.add(k, JsonArray().apply { add(v.first); add(v.second.power); add(v.second.bracket) }) }
        runCatching { val tmp = File(f.path + ".tmp"); tmp.writeText(out.toString()); tmp.renameTo(f) }
    }

    private fun key(format: String, d: JsonObject): String =
        MessageDigest.getInstance("SHA-1").digest((format + "\u0001" + d).toByteArray()).joinToString("") { "%02x".format(it) }

    /** Each deck's read: a kept one at once, one already asked for shared, the rest asked of the bundle. */
    private fun start(format: String, decks: List<JsonObject>, urgent: Boolean): List<Deferred<QuickOpponent.Ctx?>> {
        val now = System.currentTimeMillis(); val ask = ArrayList<Pair<String, JsonObject>>()
        val out = synchronized(lock) {
            decks.map { d -> val k = key(format, d)
                known[k]?.takeIf { now - it.first < TTL }?.let { CompletableDeferred(it.second) }
                    ?: pending[k] ?: CompletableDeferred<QuickOpponent.Ctx?>().also { pending[k] = it; ask += k to d } }
        }
        if (ask.isNotEmpty()) synchronized(lock) {
            val parts = ask.chunked(CHUNK).map { Ask(format, it, urgent) }
            if (urgent) parts.asReversed().forEach(queue::addFirst) else queue.addAll(parts)
            if (worker == null) worker = scope.launch { work() }
        }
        return out
    }

    private suspend fun work() {
        while (true) {
            val a = synchronized(lock) { (queue.firstOrNull { it.urgent } ?: queue.firstOrNull())?.also { queue.remove(it) } ?: run { worker = null; null } } ?: return
            if (!a.urgent && paused()) { synchronized(lock) { queue.addFirst(a) }; delay(2000); continue }
            val arr = runCatching { engine(a.format, a.items.map { it.second }) }.getOrNull()
            val now = System.currentTimeMillis()
            synchronized(lock) {
                a.items.forEachIndexed { i, (k, _) ->
                    val o = arr?.takeIf { i < it.size() }?.get(i) as? JsonObject
                    val c = o?.let { QuickOpponent.Ctx(it.get("power")?.takeIf { p -> p.isJsonPrimitive }?.asDouble, it.get("bracket")?.takeIf { b -> b.isJsonPrimitive }?.asInt) }
                    // A read the site's code finished is kept; one it couldn't make (no bundle, an error) is asked again next time.
                    if (c != null && o.get("error") == null) known[k] = now to c
                    pending.remove(k)?.complete(c)
                }
            }
            save()
            version.value++
        }
    }

    /** Reads for [decks] in [format], waiting until [deadline] (System.currentTimeMillis()); a read not in by then is null (unrated). */
    suspend fun rate(format: String, decks: List<JsonObject>, deadline: Long): List<QuickOpponent.Ctx?> =
        start(format, decks, urgent = true).map { d -> withTimeoutOrNull((deadline - System.currentTimeMillis()).coerceAtLeast(1)) { d.await() } }

    /** Bumps when new reads are kept, so a screen showing [peek]s draws them as they arrive (0.4.59 T8 deck tiles). */
    val version = kotlinx.coroutines.flow.MutableStateFlow(0)
    /** A kept read for [d] in [format], without asking for one (null: not read yet). */
    fun peek(format: String, d: JsonObject): QuickOpponent.Ctx? {
        val k = key(format, d); val now = System.currentTimeMillis()
        return synchronized(lock) { known[k]?.takeIf { now - it.first < TTL }?.second }
    }

    /** The lobby's background read of the Quick Play pool in [format]. */
    fun warm(format: String, decks: List<JsonObject>) { start(format, decks, urgent = false) }

    /** Tests: forget every read, and ask the bundle again. */
    internal fun reset() = synchronized(lock) {
        known.clear(); pending.clear(); queue.clear(); file = null
        engine = { f, d -> RandomBuild.quickContext(f, d).await() }; paused = { RandomBuild.paused }
    }
}
