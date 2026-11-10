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
        OkHttpClient.Builder().addNetworkInterceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("User-Agent", UA).header("Accept", "image/avif,image/webp,image/*,*/*;q=0.8").build())
        }.build()
    }
    private lateinit var indexFile: File
    // Forge-spelled name (lower case) -> [full card image URL, art crop URL].
    private val index = HashMap<String, Pair<String, String?>>()
    /** Bumped when new names resolve, so the table redraws a card that just got its picture. */
    val version = MutableStateFlow(0)

    fun init(context: Context) {
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
                val a = v.asJsonArray; index[k] = a[0].asString to a.get(1)?.takeIf { !it.isJsonNull }?.asString
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
        TableFacts.clear(); synchronized(index) { pins.clear(); matchRows.clear(); rows.forEach { (n, r) -> matchRows[n.lowercase()] = r }; tries.clear() }
        resolve(rows)
        var pinnedAny = false
        synchronized(index) { rows.forEach { (n, r) -> pinId(r)?.let { index["#$it"] }?.let { pins[n.lowercase()] = it; pinnedAny = true } } }
        if (pinnedAny) version.value++
    }

    /** The index is copied under its lock and written outside it, so a card on screen never waits on a file write. */
    private val saving = Any()
    private fun save() = synchronized(saving) {
        val copy = synchronized(index) { index.toList() }
        val o = JsonObject(); copy.forEach { (k, v) -> o.add(k, JsonArray().apply { add(v.first); add(v.second) }) }
        try { indexFile.writeText(o.toString()) } catch (_: Exception) {}
    }

    private fun str(o: JsonObject, vararg keys: String) = keys.firstNotNullOfOrNull { k -> o.get(k)?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() } }
    private val UUID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)

    /** Scryfall finds a split or double-faced card by its front face ("Wear", not "Wear // Tear"). */
    private fun lookupName(name: String) = name.substringBefore(" // ").trim()

    /** The Scryfall identifier for a deck row: its exact printing when the row names one, else its name. */
    fun identifier(row: JsonObject, engineName: String): JsonObject = JsonObject().apply {
        val id = str(row, "printingId", "scryfallId")?.takeIf { UUID.matches(it) }
        val set = str(row, "set", "setCode")?.lowercase(); val num = str(row, "collectorNumber", "collector_number", "number")
        when {
            id != null -> addProperty("id", id)
            set != null && num != null -> { addProperty("set", set); addProperty("collector_number", num) }
            else -> addProperty("name", lookupName(engineName))
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
        var added = false
        for (chunk in missing.chunked(75)) {
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
            if (found == null) continue
            val cards = found.mapNotNull { it as? JsonObject }
            synchronized(index) {
                chunk.forEachIndexed { i, (name, _) ->
                    val want = ids[i]
                    val card = cards.firstOrNull { c ->
                        want.get("id")?.asString?.let { it.equals(c.get("id")?.asString, true) }
                            ?: want.get("collector_number")?.asString?.let { it == c.get("collector_number")?.asString && want.get("set")?.asString == c.get("set")?.asString }
                            ?: names(c).any { it.equals(name, true) }
                    } ?: cards.firstOrNull { c -> names(c).any { it.equals(name, true) } }
                    val img = card?.let { images(it) } ?: return@forEachIndexed
                    // A pinned printing is kept by its id; the shared name entry stays whatever it was.
                    val pin = want.get("id")?.asString?.lowercase()?.takeIf { it.equals(card.get("id")?.asString, true) }
                    if (pin != null) { index["#$pin"] = img; index.putIfAbsent(name.lowercase(), img) } else index[name.lowercase()] = img
                    card.let { names(it) }.forEach { n -> index.putIfAbsent(n.lowercase(), img) }
                    added = true
                }
            }
        }
        // A printing that Scryfall could not match by id or number falls back to its name once.
        val still = missing.filter { (n, _) -> url(n) == null }
        if (still.isNotEmpty()) for (chunk in still.chunked(75)) {
            val body = JsonObject().apply { add("identifiers", JsonArray().apply { chunk.forEach { (n, _) -> add(JsonObject().apply { addProperty("name", lookupName(n)) }) } }) }.toString()
            val cards = try { Http.call("POST", "https://api.scryfall.com/cards/collection", mapOf("User-Agent" to UA), body, timeoutMs = 10000)?.asJsonObject?.getAsJsonArray("data") } catch (_: Exception) { null } ?: continue
            synchronized(index) {
                cards.mapNotNull { it as? JsonObject }.forEach { c -> images(c)?.let { img -> names(c).forEach { n -> index.putIfAbsent(n.lowercase(), img) }; added = true } }
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
            resolve(batch.map { n -> n to (synchronized(index) { matchRows[n.lowercase()] } ?: JsonObject().apply { addProperty("name", n) }) })
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

    /** Proof counter (spec 12): a card drawn on screen with no picture on record. Logged by name; 0 is the goal on a cold cache. */
    val artMissAtShow = java.util.concurrent.atomic.AtomicInteger(0)
    fun missAtShow(name: String) { android.util.Log.i("CardArt", "artMissAtShow #${artMissAtShow.incrementAndGet()}: $name") }

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
                     diskCrops: Collection<String> = emptyList(), detach: Boolean = false): Int {
        val gate = Semaphore(12)
        val faces = names.mapNotNull { url(it) }.distinct()
        // The versus plates' covers first (high priority, spec 12a), then every face, then every battlefield crop onto disk.
        val jobs = crops.mapNotNull { url(it, crop = true) }.distinct().map { request(context, it, true) } + faces.map { request(context, it, false) } +
            diskCrops.mapNotNull { url(it, crop = true) }.distinct().filter { it !in faces }.map { diskOnly(context, it) }
        val done = java.util.concurrent.atomic.AtomicInteger(0)
        warmProgress.value = if (jobs.isEmpty()) 1f else 0f
        suspend fun all() = coroutineScope { jobs.map { r -> async(Dispatchers.IO) { gate.withPermit { ((loader.execute(r) as? SuccessResult) != null).also {
            warmProgress.value = done.incrementAndGet().toFloat() / jobs.size } } } }.awaitAll().count { it } }
        if (!detach) return withTimeoutOrNull(timeoutMs) { all() } ?: -1
        val job = bg.async { all() }
        return withTimeoutOrNull(timeoutMs) { job.await() } ?: -1
    }
}
