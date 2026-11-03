package dev.cardstashy.nativeplay.match

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import android.util.Log
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.UserDeck
import dev.cardstashy.nativeplay.art.CardArt
import dev.cardstashy.nativeplay.engine.ForgeService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The deck you chose for Quick Play: a bundled demo deck or one of your own. */
sealed interface Pick {
    val id: String; val name: String; val format: String; val face: String?; val raw: JsonObject
    data class Demo(val deck: DemoDeck, val decks: DemoDecks) : Pick {
        override val id get() = deck.id; override val name get() = deck.name; override val format get() = decks.format
        override val face get() = deck.face; override val raw get() = decks.seat(deck)
    }
    data class Mine(val deck: UserDeck) : Pick {
        override val id get() = deck.id; override val name get() = deck.name; override val format get() = QuickPlay.formatOf(deck)
        override val face get() = deck.face?.let(EngineNames::name); override val raw get() = deck.raw
    }
}

/** One side of the versus beat. */
data class Plate(val name: String, val who: String, val face: String?)

/**
 * Quick Play's setup, the web's flow: your deck in its own format against a random tournament list
 * of that format, every name in Forge's spelling. Unknown names stop the match at pick time with
 * the names listed. Both decks' pictures load behind the versus beat while Forge opens the match.
 */
object QuickPlay {
    private const val TAG = "QuickPlay"

    /** The Forge format a saved deck plays in: its own when Forge plays it, else Commander for a commander deck, else Vintage (allows the most). */
    fun formatOf(d: UserDeck): String {
        val f = d.format.trim()
        ForgeFormats.firstOrNull { it.equals(f, true) || (it == "Commander" && f.equals("edh", true)) }?.let { return it }
        return if (d.commander != null || d.count >= 99) "Commander" else "Vintage"
    }
    val ForgeFormats = listOf("Standard", "Pioneer", "Modern", "Legacy", "Vintage", "Pauper", "Commander")

    sealed interface Setup {
        data class Ready(val input: String, val you: Plate, val cpu: Plate, val rows: List<Pair<String, JsonObject>>, val faces: List<String>, val known: Boolean) : Setup
        data class Unknown(val names: List<String>) : Setup
        data class Failed(val reason: String) : Setup
    }

    /** Rows of a deck with engine names, for the art lookup (name plus printing). */
    private fun rows(deck: JsonObject): List<Pair<String, JsonObject>> = buildList {
        val d = EngineNames.deck(deck)
        for (k in listOf("cards", "side", "commanders")) d.getAsJsonArray(k)?.forEach { r ->
            when {
                r is JsonObject -> r.get("name")?.takeIf { it.isJsonPrimitive }?.asString?.let { add(it to r) }
                r.isJsonPrimitive -> add(r.asString to JsonObject().apply { addProperty("name", r.asString) })
            }
        }
        d.get("commander")?.takeIf { it.isJsonPrimitive && it.asString.isNotBlank() }?.asString?.let { add(it to JsonObject().apply { addProperty("name", it) }) }
    }

    private fun faceOf(deck: JsonObject): String? = deck.get("commander")?.takeIf { it.isJsonPrimitive }?.asString?.let(EngineNames::name)
        ?: rows(deck).firstOrNull { (n, r) -> n !in UserDeck.BASICS && r.get("type")?.asString?.contains("Land") != true }?.first

    suspend fun setup(context: Context, pick: Pick, demos: DemoDecks): Setup = withContext(Dispatchers.Default) {
        // The engine is usually ready long before a deck is picked; this only waits on a cold start.
        val status = ForgeService.status.first { it is ForgeService.Status.Ready || it is ForgeService.Status.Failed }
        if (status is ForgeService.Status.Failed) return@withContext Setup.Failed("The engine couldn’t start: ${status.reason}")
        val you = pick.raw
        val unknown = ForgeService.unknownNames(EngineNames.names(EngineNames.deck(you)))
        if (unknown.isNotEmpty()) return@withContext Setup.Unknown(unknown.sorted())
        val format = pick.format
        val lists = MetaDecks.lists(context, format)
        var cpu = MetaDecks.pick(lists.filter { ForgeService.unknownNames(EngineNames.names(EngineNames.deck(it))).isEmpty() }, you)
        if (cpu == null && format == demos.format) cpu = demos.decks.firstOrNull { it.id != pick.id }?.let(demos::seat)
        cpu ?: return@withContext Setup.Failed("Couldn’t load a $format opponent. Check your connection and try again.")
        val youRows = rows(you); val cpuRows = rows(cpu)
        val cpuName = cpu.get("name")?.asString ?: "Tournament list"
        val faces = listOfNotNull(pick.face, faceOf(cpu))
        Setup.Ready(quickInput(format, you, cpu), Plate(pick.name, "You", pick.face), Plate(cpuName, "CPU · $format", faceOf(cpu)),
            youRows + cpuRows, faces, CardArt.knows(youRows.map { it.first }))
    }

    /** Finds and decodes both decks' pictures; returns when done or when [budgetMs] runs out (the table then fills in as they land). */
    suspend fun warmArt(context: Context, s: Setup.Ready, budgetMs: Long) {
        val t0 = SystemClock.elapsedRealtime()
        CardArt.resolve(s.rows)
        val loaded = CardArt.warm(context, s.rows.map { it.first }, (budgetMs - (SystemClock.elapsedRealtime() - t0)).coerceAtLeast(300), crops = s.faces)
        Log.i(TAG, "art warm: ${s.rows.size} rows, loaded=$loaded in ${SystemClock.elapsedRealtime() - t0} ms")
    }

    // ---- Background warm-up (snappy rule 1): as soon as Play opens, your decks and their formats' meta lists. ----
    private val bg = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var warming: Job? = null

    fun warmInBackground(context: Context, decks: List<UserDeck>) {
        if (warming?.isActive == true) return
        val app = context.applicationContext
        warming = bg.launch {
            decks.map(::formatOf).distinct().forEach { MetaDecks.lists(app, it) }
            // Tile art first (one lookup for every deck's face), then whole decks on Wi-Fi only.
            CardArt.resolve(decks.mapNotNull { d -> d.face?.let { EngineNames.name(it) to JsonObject().apply { addProperty("name", it) } } })
            CardArt.warm(app, emptyList(), 20_000, crops = decks.mapNotNull { it.face?.let(EngineNames::name) })
            if (!unmetered(app)) return@launch
            for (d in decks) {
                val r = rows(d.raw)
                CardArt.resolve(r)
                // Reading a cached image refreshes its place in the cache, so decks you own stay at the front and are never evicted.
                CardArt.warm(app, r.map { it.first }, 30_000)
                delay(150)
            }
        }
    }

    /** A match is starting: give the network to its two decks. */
    fun pauseBackground() { warming?.cancel(); warming = null }

    private fun unmetered(context: Context): Boolean {
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return false
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }
}
