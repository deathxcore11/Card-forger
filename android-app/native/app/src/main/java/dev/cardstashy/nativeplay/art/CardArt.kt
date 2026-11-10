package dev.cardstashy.nativeplay.art

import android.content.Context
import coil3.ImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.size.Size
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okio.Path.Companion.toOkioPath
import java.io.File

/**
 * Card art like the web (big picture, section 1): the exact printing from Scryfall's CDN, cached
 * like a game. Every image shown is kept in a 2 GB disk cache; a deck's faces are fetched and
 * decoded behind the versus beat, so nothing on the table ever waits for a download. Only
 * online: the cache is for speed, never for offline play.
 */
object CardArt {
    /** Table size: every card face decodes once at this size and is reused everywhere. */
    val FACE = Size(488, 680)
    val CROP = Size(626, 457)
    const val UA = "CardStashyNative/1.0 (+https://cardstashy.com)"

    lateinit var loader: ImageLoader; private set

    /**
     * Scryfall refuses a library's default User-Agent ("okhttp/x", 400 generic_user_agent), images
     * included, so every request names the app. 0.2.0 shipped without this and no card loaded.
     */
    val client: OkHttpClient by lazy {
        // OkHttp lets 5 calls per host run at once by default: a match's 300 pictures all come from one host, so the art
        // gate's 12 slots were really 5 (T1, Thor run 10 Nov: 15 s of art). One HTTP/2 connection carries them all.
        OkHttpClient.Builder().dispatcher(okhttp3.Dispatcher().apply { maxRequests = 64; maxRequestsPerHost = 16 }).addNetworkInterceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("User-Agent", UA).header("Accept", "image/avif,image/webp,image/*,*/*;q=0.8").build())
        }.build()
    }
    private lateinit var indexFile: File
    // Forge-spelled name (lower case) -> [full card image URL, art crop URL].
    private val index = HashMap<String, Pair<String, String?>>()
    /** Each card's rarity as Scryfall gave it with its art (table additions 3: entrances by importance). */
    private val rarities = HashMap<String, String>()
    fun rarity(name: String): String? = synchronized(index) { rarities[name.lowercase()] }
    /** Each card's type line as Scryfall gave it with its art, kept in the index file (W9: the deck tracker counts lands by it). */
    private val types = HashMap<String, String>()
    fun typeLine(name: String): String? = synchronized(index) { types[name.lowercase()] ?: types[lookupName(name).lowercase()] }
    /** W9: type lines for names that have none yet (one Scryfall call per 75 names), for the deck tracker; bumps [version]. */
    suspend fun fetchTypes(names: Collection<String>) = withContext(Dispatchers.IO) {
        // Also any name with no rarity on record (entrances by importance: rarity was not kept in the index before 0.4.56).
        val need = synchronized(index) { names.filter { typeLine(it) == null || rarity(it) == null }.distinctBy { it.lowercase() } }
        if (need.isEmpty()) return@withContext
        var got = false
        for (chunk in need.chunked(75)) {
            val body = JsonObject().apply { add("identifiers", JsonArray().apply { chunk.forEach { add(JsonObject().apply { addProperty("name", lookupName(it)) }) } }) }.toString()
            val found = try { Http.call("POST", "https://api.scryfall.com/cards/collection", mapOf("User-Agent" to UA), body, timeoutMs = 10000)?.asJsonObject?.getAsJsonArray("data") } catch (_: Exception) { null } ?: continue
            synchronized(index) { found.mapNotNull { it as? JsonObject }.forEach { c ->
                c.get("type_line")?.asString?.let { t -> names(c).forEach { n -> types[n.lowercase()] = t }; got = true }
                c.get("rarity")?.asString?.let { r -> names(c).forEach { n -> rarities.putIfAbsent(n.lowercase(), r) }; got = true } } }
        }
        if (got) { save(); version.value++ }
    }
    /** Bumped when new names resolve, so the table redraws a card that just got its picture. */
    val version = MutableStateFlow(0)

    @Volatile private var appContext: Context? = null
    fun init(context: Context) {
        appContext = context.applicationContext
        if (::loader.isInitialized) return
        val app = context.applicationContext
        ThumbStore.init(app)
        loader = ImageLoader.Builder(app)
            .components { add(ThumbStore.interceptor); add(OkHttpNetworkFetcherFactory(callFactory = { client })); add(coil3.svg.SvgDecoder.Factory()) }
            .memoryCache { MemoryCache.Builder().maxSizePercent(app, .25).build() }
            .diskCache { DiskCache.Builder().directory(File(app.filesDir, "art-cache").toOkioPath()).maxSizeBytes(2L shl 30).build() }
            .eventListener(object : coil3.EventListener() {
                override fun onSuccess(request: coil3.request.ImageRequest, result: coil3.request.SuccessResult) =
                    dev.cardstashy.nativeplay.FreezeReport.image(request.data.toString(), result.image.width, result.image.height, result.image.size)
            })
            .build()
        indexFile = File(app.filesDir, "art-index.json")
        try {
            JsonParser.parseString(indexFile.readText()).asJsonObject.entrySet().forEach { (k, v) ->
                val a = v.asJsonArray
                if (a.size() > 0 && !a[0].isJsonNull) index[k] = a[0].asString to a.get(1)?.takeIf { !it.isJsonNull }?.asString
                if (a.size() > 2) a[2]?.takeIf { it.isJsonPrimitive }?.let { types[k] = it.asString }
                if (a.size() > 3) a[3]?.takeIf { it.isJsonPrimitive }?.let { rarities[k] = it.asString }
            }
        } catch (_: Exception) {}
    }

    /** Unit tests: the name index without an image loader. */
    internal fun initIndexOnly(dir: File) { indexFile = File(dir, "art-index.json") }

    fun url(name: String, crop: Boolean = false): String? = synchronized(index) { pins[name.lowercase()] ?: index[name.lowercase()] }?.let { if (crop) it.second ?: it.first else it.first }

    /**
     * The match on the table pins its own printings (a Story deck plays its era's art, Act 1 Alpha):
     * name -> picture for this match only, ahead of the shared name index. Cleared when the next match pins.
     */
    private val pins = HashMap<String, Pair<String, String?>>()
    fun pinned(name: String): Boolean = synchronized(index) { pins.containsKey(name.lowercase()) }
    private fun pinId(row: JsonObject) = str(row, "printingId", "scryfallId")?.takeIf { UUID.matches(it) }?.lowercase()

    /** True when every row's picture is on record: its pinned printing when it has one, else its name. */
    fun knowsRows(rows: List<Pair<String, JsonObject>>) = synchronized(index) { rows.all { (n, r) -> pinId(r)?.let { index.containsKey("#$it") } ?: index.containsKey(n.lowercase()) } }

    /** A match is starting: resolve both decks with their pinned printings first, and pin those for the match. */
    suspend fun resolveMatch(rows: List<Pair<String, JsonObject>>) {
        TableFacts.clear(); clearAhead(); synchronized(index) { pins.clear(); matchRows.clear(); rows.forEach { (n, r) -> matchRows[n.lowercase()] = r }; tries.clear() }
        resolve(rows)
        // Names already in the index carry no rarity from before 0.4.56: fill them in the background (never holds the table).
        val unrated = synchronized(index) { rows.map { it.first }.filter { rarity(it) == null } }
        if (unrated.isNotEmpty()) kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch { runCatching { fetchTypes(unrated) } }
        var pinnedAny = false
        // A name in both decks with different printings keeps the first row's (your deck comes first), never neither.
        synchronized(index) { rows.forEach { (n, r) -> pinId(r)?.let { index["#$it"] }?.let { if (pins.putIfAbsent(n.lowercase(), it) == null) pinnedAny = true } } }
        if (pinnedAny) version.value++
    }

    /** The index is copied under its lock and written outside it, so a card on screen never waits on a file write. */
    private val saving = Any()
    private fun save() = synchronized(saving) {
        val (copy, tcopy, rcopy) = synchronized(index) { Triple(index.toList(), HashMap(types), HashMap(rarities)) }
        // [picture, art crop, type line, rarity]; a missing type line is a null so the rarity keeps its place.
        val o = JsonObject(); copy.forEach { (k, v) -> o.add(k, JsonArray().apply { add(v.first); add(v.second)
            val t = tcopy[k]; val r = rcopy[k]
            if (t != null || r != null) add(t?.let { com.google.gson.JsonPrimitive(it) } ?: com.google.gson.JsonNull.INSTANCE)
            if (r != null) add(r) }) }

        try { indexFile.writeText(o.toString()) } catch (_: Exception) {}
    }

    private fun str(o: JsonObject, vararg keys: String) = keys.firstNotNullOfOrNull { k -> o.get(k)?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() } }
    private val UUID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)

    /** Scryfall finds a split or double-faced card by its front face ("Wear", not "Wear // Tear"), and a token without Forge's " Token" ("Spider"). */
    private fun lookupName(name: String) = name.substringBefore(" // ").trim().removeSuffix(" Token")

    /**
     * The card behind a name Forge shows (Randall 10 Nov: Skyward Spider played as its Omenpaths name "Wonderweave Aerialist", which
     * Scryfall does not know, so it showed a name plate all match). Set by the app; called on the IO thread only.
     */
    @Volatile var oracleOf: ((String) -> String?)? = null

    /** The Scryfall identifier for a deck row: its exact printing when the row names one, else its name. */
    fun identifier(row: JsonObject, engineName: String): JsonObject = JsonObject().apply {
        val id = str(row, "printingId", "scryfallId")?.takeIf { UUID.matches(it) }
        val set = str(row, "set", "setCode")?.lowercase(); val num = str(row, "collectorNumber", "collector_number", "number")
        when {
            id != null -> addProperty("id", id)
            set != null && num != null -> { addProperty("set", set); addProperty("collector_number", num) }
            else -> addProperty("name", str(row, "oracleName") ?: lookupName(engineName))
        }
    }

    private fun images(card: JsonObject): Pair<String, String?>? {
        val uris = card.getAsJsonObject("image_uris") ?: card.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris") ?: return null
        val normal = uris.get("normal")?.asString ?: uris.get("large")?.asString ?: return null
        return normal to uris.get("art_crop")?.asString
    }

    /**
     * Finds the picture of every (Forge-spelled name, deck row) pair not yet known, 75 per
     * Scryfall call, and remembers it. A deck seen before needs no call at all.
     */
    suspend fun resolve(rows: List<Pair<String, JsonObject>>) = withContext(Dispatchers.IO) {
        val missing = synchronized(index) { rows.filter { (name, r) -> pinId(r)?.let { !index.containsKey("#$it") } ?: (index[name.lowercase()] == null) } }
            .distinctBy { (n, r) -> pinId(r) ?: n.lowercase() }
        if (missing.isEmpty()) return@withContext
        val addedAny = java.util.concurrent.atomic.AtomicBoolean(false)
        // The 75-card calls go side by side (T1: they went one after another), at most three at once.
        val calls = Semaphore(3)
        coroutineScope { missing.chunked(75).map { chunk -> async { calls.withPermit {
            val ids = chunk.map { (n, r) -> identifier(r, n) }
            val body = JsonObject().apply { add("identifiers", JsonArray().apply { ids.forEach { add(it) } }) }.toString()
            // A dropped or rate-limited call (two chunks back to back) is asked once more after a breath, so a deck's second
            // half never stays name-only (Randall 10 Nov, Draconic Destruction's hand).
            var found: JsonArray? = null
            for (attempt in 0..1) {
                if (attempt > 0) kotlinx.coroutines.delay(700)
                found = try { Http.call("POST", "https://api.scryfall.com/cards/collection", mapOf("User-Agent" to UA), body, timeoutMs = 10000)?.asJsonObject?.getAsJsonArray("data") } catch (_: Exception) { null }
                if (found != null) break
            }
            if (found == null) return@withPermit
            val cards = found.mapNotNull { it as? JsonObject }
            synchronized(index) {
                chunk.forEachIndexed { i, (name, _) ->
                    val want = ids[i]
                    val card = cards.firstOrNull { c ->
                        want.get("id")?.asString?.let { it.equals(c.get("id")?.asString, true) }
                            ?: want.get("collector_number")?.asString?.let { it == c.get("collector_number")?.asString && want.get("set")?.asString == c.get("set")?.asString }
                            ?: names(c).any { it.equals(name, true) || it.equals(want.get("name")?.asString, true) }
                    } ?: cards.firstOrNull { c -> names(c).any { it.equals(name, true) || it.equals(want.get("name")?.asString, true) } }
                    card?.get("rarity")?.asString?.let { rarities[name.lowercase()] = it }
                    card?.get("type_line")?.asString?.let { t -> types[name.lowercase()] = t }
                    val img = card?.let { images(it) } ?: return@forEachIndexed
                    // A pinned printing is kept by its id; the shared name entry stays whatever it was.
                    val pin = want.get("id")?.asString?.lowercase()?.takeIf { it.equals(card.get("id")?.asString, true) }
                    if (pin != null) { index["#$pin"] = img; index.putIfAbsent(name.lowercase(), img) } else index[name.lowercase()] = img
                    card.let { names(it) }.forEach { n -> index.putIfAbsent(n.lowercase(), img) }
                    addedAny.set(true)
                }
            }
        } } }.awaitAll() }
        var added = addedAny.get()
        // A printing that Scryfall could not match by id or number falls back to its name once.
        val still = missing.filter { (n, _) -> url(n) == null }
        if (still.isNotEmpty()) for (chunk in still.chunked(75)) {
            val asked = chunk.map { (n, r) -> n to (str(r, "oracleName") ?: lookupName(n)) }
            val body = JsonObject().apply { add("identifiers", JsonArray().apply { asked.forEach { (_, q) -> add(JsonObject().apply { addProperty("name", q) }) } }) }.toString()
            val cards = try { Http.call("POST", "https://api.scryfall.com/cards/collection", mapOf("User-Agent" to UA), body, timeoutMs = 10000)?.asJsonObject?.getAsJsonArray("data") } catch (_: Exception) { null } ?: continue
            synchronized(index) {
                cards.mapNotNull { it as? JsonObject }.forEach { c -> images(c)?.let { img ->
                    names(c).forEach { n -> index.putIfAbsent(n.lowercase(), img) }
                    // Kept under the name the table asks for too ("Spider Token", a flavor name), or url() never finds it.
                    asked.filter { (_, q) -> names(c).any { it.equals(q, true) } }.forEach { (n, _) -> index.putIfAbsent(n.lowercase(), img) }
                    added = true } }
            }
        }
        if (added) { save(); version.value++ }
    }

    // ---- A picture missing on the table is looked up again (Randall 6 Nov: "art just doesn't load sometimes") ----
    // A lookup that failed while the match loaded (a slow or dropped Scryfall call) used to leave those cards blank all match.
    // Each name is asked again a few times, spaced out, in one batched call; the match's own rows keep their printings.
    private val bg = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val matchRows = HashMap<String, JsonObject>()
    private val tries = HashMap<String, Int>()
    private val pending = LinkedHashSet<String>()
    private var pumping: Job? = null
    private const val MAX_TRIES = 3

    /** The engine's printing of a card the match's deck rows didn't pin: used when that name's picture is looked up again. */
    fun enginePrinting(name: String, set: String, number: String) {
        if (!::indexFile.isInitialized) return
        synchronized(index) { matchRows.putIfAbsent(name.lowercase(), JsonObject().apply { addProperty("name", name); addProperty("set", set.lowercase()); addProperty("collectorNumber", number) }) }
    }

    /** A card on screen has no picture on record: find it again soon (at most [MAX_TRIES] lookups a name). */
    fun want(name: String) {
        if (!::indexFile.isInitialized) return
        val k = name.lowercase()
        synchronized(index) {
            if (index.containsKey(k) || pins.containsKey(k) || (tries[k] ?: 0) >= MAX_TRIES) return
            pending.add(name); if (pumping == null) pumping = bg.launch { pump() }
        }
    }

    private suspend fun pump() {
        var round = 0
        while (true) {
            delay(if (round == 0) 400L else 2000L * round)
            val batch = synchronized(index) {
                val b = pending.filter { n -> !index.containsKey(n.lowercase()) }; pending.clear()
                if (b.isEmpty()) pumping = null
                b.onEach { n -> tries[n.lowercase()] = (tries[n.lowercase()] ?: 0) + 1 }
            }
            if (batch.isEmpty()) return
            // A flavor name takes its card's picture already on record (the deck's own printing), else is asked by its card's name.
            val oracle = oracleOf
            val rows = batch.mapNotNull { n ->
                val o = runCatching { oracle?.invoke(n) }.getOrNull()
                synchronized(index) {
                    if (o != null) (index[o.lowercase()])?.let { index[n.lowercase()] = it; version.value++; return@mapNotNull null }
                    n to (matchRows[n.lowercase()] ?: o?.let { matchRows[it.lowercase()] } ?: JsonObject().apply { addProperty("name", n); if (o != null) addProperty("oracleName", o) })
                }
            }
            if (rows.isNotEmpty()) resolve(rows)
            // Still missing (Scryfall did not answer): once more on the next round, up to the limit.
            synchronized(index) { batch.filter { n -> !index.containsKey(n.lowercase()) && (tries[n.lowercase()] ?: 0) < MAX_TRIES }.forEach { pending.add(it) } }
            round++
        }
    }

    private fun names(c: JsonObject): List<String> = buildList {
        c.get("name")?.asString?.let { add(it); if (it.contains(" // ")) addAll(it.split(" // ")) }
        c.getAsJsonArray("card_faces")?.forEach { f -> (f as? JsonObject)?.get("name")?.asString?.let { add(it) } }
    }

    /** [attempt] above 0 is a retry after a failed load: a new request, so the picture is fetched again (the disk cache key stays the URL). */
    fun request(context: Context, url: String, crop: Boolean = false, attempt: Int = 0): ImageRequest =
        ImageRequest.Builder(context).data(url).size(if (crop) CROP else FACE).apply { if (attempt > 0) memoryCacheKeyExtra("try", "$attempt") }.build()

    /** Only onto disk: the download is kept, decoded tiny and never held in memory (a battlefield art crop reads it back at once). */
    private fun diskOnly(context: Context, url: String): ImageRequest =
        ImageRequest.Builder(context).data(url).size(Size(8, 8)).memoryCachePolicy(CachePolicy.DISABLED).build()

    /**
     * Decode ahead (spec 12 item 4): a card's battlefield crop is decoded into memory as soon as it is in a hand, on the stack or
     * in the command zone, so it is ready before it can reach the felt. Each name once a match.
     */
    private val decodedAhead = java.util.Collections.newSetFromMap(java.util.concurrent.ConcurrentHashMap<String, Boolean>())
    fun decodeAhead(name: String) {
        val ctx = appContext ?: return
        if (!::loader.isInitialized || !decodedAhead.add(name.lowercase())) return
        val u = url(name, crop = true) ?: run { decodedAhead.remove(name.lowercase()); return }
        loader.enqueue(request(ctx, u, true))
        url(name)?.let { loader.enqueue(request(ctx, it, false)) }
    }
    fun clearAhead() { decodedAhead.clear(); firstSeen.clear() }

    /**
     * Spec 12 item 7: a token or a card made mid-match that the gate never knew. Its picture is asked for on the event that makes
     * it, and its arrival waits for it: what is left of 400 ms since it was first asked for, then it lands with art or its frame.
     */
    private val firstSeen = java.util.concurrent.ConcurrentHashMap<String, Long>()
    fun made(name: String) {
        if (firstSeen.putIfAbsent(name.lowercase(), android.os.SystemClock.elapsedRealtime()) != null) return
        if (url(name, crop = true) == null) want(name) else decodeAhead(name)
    }
    fun holdFor(name: String): Long {
        val at = firstSeen[name.lowercase()] ?: return 0L
        return (400L - (android.os.SystemClock.elapsedRealtime() - at)).coerceIn(0L, 400L)
    }

    /** Proof counter (spec 12): a card drawn on screen with no picture on record. Logged by name; 0 is the goal on a cold cache. */
    val artMissAtShow = java.util.concurrent.atomic.AtomicInteger(0)
    fun missAtShow(name: String) { android.util.Log.i("CardArt", "artMissAtShow #${artMissAtShow.incrementAndGet()}: $name") }

    /** The last finished warm: how many pictures and where they came from (memory_cache, disk, network, failed), for the logs. */
    @Volatile var lastWarm = ""
    /** The same for the last background warm (progress = false). */
    @Volatile var lastBehind = ""

    /** How far the match's art gate has got (0..1), for the matchup screen's "Preparing the table" bar. */
    val warmProgress = kotlinx.coroutines.flow.MutableStateFlow(0f)

    /** True when every name already has a picture on record (a deck played or warmed before). */
    fun knows(names: Collection<String>) = synchronized(index) { names.all { index.containsKey(it.lowercase()) } }

    /**
     * Downloads (or reads from disk) and decodes every face, and the art crops of [crops], at
     * most 12 at a time, so the table shows them at once. Returns how many loaded, or -1 on timeout.
     * [diskCrops] are only downloaded to disk. [detach]: what is not done by the timeout keeps
     * downloading after it (a match's own cards), instead of being dropped.
     */
    suspend fun warm(context: Context, names: Collection<String>, timeoutMs: Long, crops: Collection<String> = emptyList(),
                     diskCrops: Collection<String> = emptyList(), detach: Boolean = false, progress: Boolean = true): Int {
        val gate = Semaphore(12)
        // Battlefield crops that only go onto disk run in their own lane, so they never hold a slot a face is waiting for (T1).
        val diskGate = Semaphore(6)
        val faces = names.mapNotNull { url(it) }.distinct()
        // The versus plates' covers first (high priority, spec 12a), then every face, then every battlefield crop onto disk.
        val jobs = crops.mapNotNull { url(it, crop = true) }.distinct().map { request(context, it, true) to gate } + faces.map { request(context, it, false) to gate } +
            diskCrops.mapNotNull { url(it, crop = true) }.distinct().filter { it !in faces }.map { diskOnly(context, it) to diskGate }
        val done = java.util.concurrent.atomic.AtomicInteger(0)
        val from = java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger>()
        if (progress) warmProgress.value = if (jobs.isEmpty()) 1f else 0f
        suspend fun all() = coroutineScope { jobs.map { (r, lane) -> async(Dispatchers.IO) { lane.withPermit { (loader.execute(r) as? SuccessResult).let { ok ->
            from.getOrPut(ok?.dataSource?.name ?: "FAILED") { java.util.concurrent.atomic.AtomicInteger() }.incrementAndGet()
            done.incrementAndGet().let { n -> if (progress) warmProgress.value = n.toFloat() / jobs.size }; ok != null } } } }.awaitAll().count { it }
            .also { val t = "${jobs.size} pictures " + from.entries.sortedBy { it.key }.joinToString(" ") { "${it.key.lowercase()}=${it.value.get()}" }; if (progress) lastWarm = t else lastBehind = t } }
        if (!detach) return withTimeoutOrNull(timeoutMs) { all() } ?: -1
        val job = bg.async { all() }
        return withTimeoutOrNull(timeoutMs) { job.await() } ?: -1
    }
}
