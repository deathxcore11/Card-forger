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
    /** A lobby pick (Quick Play or Practice): both decks chosen, the CPU's level, and whether it is Quick Play. */
    data class Table(val you: JsonObject, override val name: String, override val format: String, override val face: String?, val cpu: JsonObject,
                     val level: String, val quick: Boolean, val story: StoryCtx? = null,
                     /** Quick Play's power-tier.js matchupLine for the CPU's deck ("" when it was picked at random). */
                     val matchup: String = "") : Pick {
        override val id get() = you.get("id")?.takeIf { it.isJsonPrimitive }?.asString ?: name; override val raw get() = you
    }
    /** A friend match: the server already started it, so both seats just open it (play-forge-host-client.js attach). The friend's cards arrive as they are played. */
    data class Friend(val you: JsonObject, override val name: String, override val format: String, override val face: String?, val matchId: String, val friendName: String?) : Pick {
        override val id get() = you.get("id")?.takeIf { it.isJsonPrimitive }?.asString ?: name; override val raw get() = you
    }
    data class Mine(val deck: UserDeck) : Pick {
        override val id get() = deck.id; override val name get() = deck.name; override val format get() = QuickPlay.formatOf(deck)
        override val face get() = deck.face?.let(EngineNames::name); override val raw get() = deck.raw
    }
}

/** A Story battle's context (app.js storyPlay): which battle and side, whether your own deck plays, and the act's cast, scenes and cues. */
/** Who stands on a side of a story battle ("hero" / "villain"); blank when the battle file names nobody, never a crash. */
fun storyWho(battle: JsonObject, side: String): String = (battle.get(side) as? JsonObject)?.get("who")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
/** A story battle's title; blank when the file has none. */
fun storyTitle(battle: JsonObject): String = battle.get("title")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()

class StoryCtx(val act: Int, val battle: JsonObject, val cast: JsonObject?, val seat: String, val own: Boolean, val firstVisit: Boolean, val avatarUrl: String?,
               val intro: List<JsonObject>, val finale: List<JsonObject>, val villainFinale: List<JsonObject>,
               /** An Act 1 lesson run (first hero-side play, lessons on): the battle whose ideas the Rift whispers, and the engine's
                *  match setup (stacked draws, no mulligan; you go first) when this engine has it. */
               val lessonBattle: String? = null, val setup: JsonObject? = null)

/** One side of the versus beat; [line] is Quick Play's matchup line under the CPU's name (play-forge-pregame.js forge-intro-power). */
data class Plate(val name: String, val who: String, val face: String?, val line: String = "")

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
        if (pick is Pick.Friend) {
            // The host's engine has the whole card list and checked both decks when the room opened; nothing to load here but your pictures.
            val youRows = rows(pick.raw)
            BoardFoil.arm(youRows) // 0.4.59 T10: your foil rows, for the board's light foil.
            return@withContext Setup.Ready("", Plate(pick.name, "You", pick.face), Plate(pick.friendName ?: "Friend", "Friend · ${pick.format}", null), youRows, listOfNotNull(pick.face), CardArt.knows(youRows.map { it.first }))
        }
        // The engine is usually ready long before a deck is picked; this only waits on a cold start.
        val tWait = SystemClock.elapsedRealtime()
        val status = ForgeService.status.first { it is ForgeService.Status.Ready || it is ForgeService.Status.Failed }
        // A cold engine (cards still loading) is the usual hidden cost between the pick and the table (U2): say how long it held.
        Log.i(TAG, "engine ready wait ${SystemClock.elapsedRealtime() - tWait} ms")
        if (status is ForgeService.Status.Failed) return@withContext Setup.Failed("The engine couldn’t start: ${status.reason}")
        val you = pick.raw
        val unknown = ForgeService.unknownNames(EngineNames.names(EngineNames.deck(you)))
        if (unknown.isNotEmpty()) return@withContext Setup.Unknown(unknown.sorted())
        val format = pick.format
        var cpu: JsonObject? = (pick as? Pick.Table)?.cpu
        if (cpu != null) { val u = ForgeService.unknownNames(EngineNames.names(EngineNames.deck(cpu))); if (u.isNotEmpty()) return@withContext Setup.Unknown(u.sorted()) }
        if (cpu == null) {
            val lists = MetaDecks.lists(context, format)
            // One engine question for every list's names, not one per list.
            val names = lists.map { EngineNames.names(EngineNames.deck(it)) }
            val bad = ForgeService.unknownNames(names.flatten().toSet()).toSet()
            cpu = MetaDecks.pick(lists.filterIndexed { i, _ -> names[i].none { it in bad } }, you)
            if (cpu == null && format == demos.format) cpu = demos.decks.firstOrNull { it.id != pick.id }?.let(demos::seat)
        }
        val cpuDeck: JsonObject = cpu ?: return@withContext Setup.Failed("Couldn’t load a $format opponent. Check your connection and try again.")
        val youRows = rows(you); val cpuRows = rows(cpuDeck)
        BoardFoil.arm(youRows) // 0.4.59 T10: your foil rows, for the board's light foil (the CPU's lists name no finish).
        // Meta lists are named by their key cards ("Karn, the Great Creator · Expedition Map"): the plate shows the first.
        val cpuName = cpuDeck.get("name")?.asString?.substringBefore(" · ")?.trim()?.ifBlank { null } ?: "Tournament list"
        val faces = listOfNotNull(pick.face, faceOf(cpuDeck))
        Setup.Ready((pick as? Pick.Table)?.let { val lesson = it.story?.setup
            forgeInput(format, you, cpuDeck, it.level, startingPlayer = if (lesson != null) "first" else "random", quick = it.quick, setup = lesson) } ?: quickInput(format, you, cpuDeck),
            Plate(pick.name, "You", pick.face), Plate(cpuName, "CPU · $format", faceOf(cpuDeck), (pick as? Pick.Table)?.takeIf { it.quick }?.matchup ?: ""),
            // A deck played before (V5): your rows only; the CPU's list is a fresh pick each match.
            youRows + cpuRows, faces, CardArt.knowsRows(youRows))
    }

    /** Finds and decodes both decks' pictures; returns when done or when [budgetMs] runs out (the table then fills in as they land). */
    /**
     * The art gate (director spec 12, Randall 10 Nov "the art still comes in late"): the table opens when every card of both decks
     * has its face decoded and its crop on disk, not after a fixed 3 or 8 s. 20 s is a safety cap with a connection (what misses
     * it draws its CardFrame and keeps loading); with no connection at all it passes at once on what the cache has.
     */
    suspend fun gateArt(context: Context, s: Setup.Ready, openingHand: kotlinx.coroutines.flow.Flow<List<String>?>? = null) {
        val online = runCatching { val cm = context.getSystemService(android.net.ConnectivityManager::class.java)
            cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) == true }.getOrDefault(true)
        if (!online) { warmArt(context, s, 800); s.faces.forEach { CardArt.decodeAhead(it) }; return }
        // T1 (Thor run 10 Nov: 15 s of art before every new match): the gate waits only for what the first screen shows (both
        // covers, the basic lands, your opening hand once Forge deals it); every other card keeps loading behind, and each one is
        // decoded ahead the moment it reaches a hand, the stack or the command zone (decodeAhead), before it can land on the felt.
        val t0 = SystemClock.elapsedRealtime(); val cap = 20_000L
        fun left() = (cap - (SystemClock.elapsedRealtime() - t0)).coerceAtLeast(300)
        CardArt.resolveMatch(s.rows)
        val tLookup = SystemClock.elapsedRealtime() - t0
        val names = s.rows.map { it.first }
        val first = (s.faces + names.filter { dev.cardstashy.nativeplay.play.Decks.isBasicLand(it) }).distinct()
        val n1 = CardArt.warm(context, first, left(), crops = s.faces, detach = true)
        val tFirst = SystemClock.elapsedRealtime() - t0
        val firstFrom = CardArt.lastWarm
        // Then, behind: every face and battlefield crop of both decks (not awaited; the opening hand asked below joins it).
        bg.launch { CardArt.warm(context, names, 60_000, diskCrops = names, progress = false); Log.i(TAG, "art behind: ${CardArt.lastBehind} in ${SystemClock.elapsedRealtime() - t0} ms") }
        val hand = openingHand?.let { f -> kotlinx.coroutines.withTimeoutOrNull(left()) { f.first { it != null } } }
        val n2 = if (hand.isNullOrEmpty()) 0 else CardArt.warm(context, hand, left(), crops = hand, detach = true)
        s.faces.forEach { CardArt.decodeAhead(it) }
        Log.i(TAG, "art gate: ${s.rows.size} rows, lookup $tLookup ms, first screen ${first.size} cards loaded=$n1 at $tFirst ms ($firstFrom), " +
            "opening hand ${hand?.size ?: 0} loaded=$n2 (${if (n2 != 0) CardArt.lastWarm else "-"}), gate ${SystemClock.elapsedRealtime() - t0} ms")
    }

    suspend fun warmArt(context: Context, s: Setup.Ready, budgetMs: Long) {
        val t0 = SystemClock.elapsedRealtime()
        CardArt.resolveMatch(s.rows)
        // Every card's face (the hand, the zoom) decoded, and its battlefield art crop on disk; what the budget leaves keeps downloading.
        val loaded = CardArt.warm(context, s.rows.map { it.first }, (budgetMs - (SystemClock.elapsedRealtime() - t0)).coerceAtLeast(300), crops = s.faces,
            diskCrops = s.rows.map { it.first }, detach = true)
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

    private val picked = arrayOfNulls<Job>(2)
    private val pickedDone = java.util.Collections.synchronizedSet(HashSet<Int>())

    /**
     * Art spec 12.5: a deck starts warming the moment it is chosen for a seat (yours in the picker, the CPU's when it is picked), on
     * any connection: the same rows the match will use, so a pinned printing is the one fetched. Faces decoded, crops onto disk.
     * A new choice for a seat ([slot] 0 yours, 1 the CPU's) replaces that seat's one in flight; a deck already warmed this session is not asked again.
     */
    fun warmDeck(context: Context, deck: JsonObject, slot: Int) {
        val key = System.identityHashCode(deck)
        if (key in pickedDone) return
        val app = context.applicationContext
        picked[slot]?.cancel()
        picked[slot] = bg.launch {
            val r = rows(deck)
            if (r.isEmpty() || r.size > 260) return@launch
            CardArt.resolve(r)
            val names = r.map { it.first }
            val n = CardArt.warm(app, names, 45_000, crops = listOfNotNull(faceOf(deck)), diskCrops = names)
            if (n >= 0) pickedDone += key
            Log.i(TAG, "deck warm at select: ${r.size} rows, loaded=$n")
        }
    }

    /** A match is starting: give the network to its two decks. */
    fun pauseBackground() { warming?.cancel(); warming = null; picked.indices.forEach { picked[it]?.cancel(); picked[it] = null } }

    private fun unmetered(context: Context): Boolean {
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return false
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }
}
