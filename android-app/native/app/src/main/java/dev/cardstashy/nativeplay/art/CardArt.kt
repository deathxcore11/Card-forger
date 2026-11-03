package dev.cardstashy.nativeplay.art

import android.content.Context
import coil3.ImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.size.Size
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
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
        loader = ImageLoader.Builder(app)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { client })); add(coil3.svg.SvgDecoder.Factory()) }
            .memoryCache { MemoryCache.Builder().maxSizePercent(app, .25).build() }
            .diskCache { DiskCache.Builder().directory(File(app.filesDir, "art-cache").toOkioPath()).maxSizeBytes(2L shl 30).build() }
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

    fun url(name: String, crop: Boolean = false): String? = synchronized(index) { index[name.lowercase()] }?.let { if (crop) it.second ?: it.first else it.first }

    private fun save() = synchronized(index) {
        val o = JsonObject(); index.forEach { (k, v) -> o.add(k, JsonArray().apply { add(v.first); add(v.second) }) }
        try { indexFile.writeText(o.toString()) } catch (_: Exception) {}
    }

    private fun str(o: JsonObject, vararg keys: String) = keys.firstNotNullOfOrNull { k -> o.get(k)?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() } }
    private val UUID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)

    /** Scryfall finds a split or double-faced card by its front face ("Wear", not "Wear // Tear"). */
    private fun lookupName(name: String) = name.substringBefore(" // ").trim()

    /** The Scryfall identifier for a deck row: its exact printing when the row names one, else its name. */
    fun identifier(row: JsonObject, engineName: String): JsonObject = JsonObject().apply {
        val id = str(row, "printingId", "scryfallId")?.takeIf { UUID.matches(it) }
        val set = str(row, "set", "setCode")?.lowercase(); val num = str(row, "collectorNumber", "collector_number")
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
        val missing = rows.filter { (name, _) -> url(name) == null }.distinctBy { it.first.lowercase() }
        if (missing.isEmpty()) return@withContext
        var added = false
        for (chunk in missing.chunked(75)) {
            val ids = chunk.map { (n, r) -> identifier(r, n) }
            val body = JsonObject().apply { add("identifiers", JsonArray().apply { ids.forEach { add(it) } }) }.toString()
            val found = try {
                Http.call("POST", "https://api.scryfall.com/cards/collection", mapOf("User-Agent" to UA), body, timeoutMs = 10000)?.asJsonObject?.getAsJsonArray("data")
            } catch (_: Exception) { null } ?: continue
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
                    index[name.lowercase()] = img
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

    private fun names(c: JsonObject): List<String> = buildList {
        c.get("name")?.asString?.let { add(it); if (it.contains(" // ")) addAll(it.split(" // ")) }
        c.getAsJsonArray("card_faces")?.forEach { f -> (f as? JsonObject)?.get("name")?.asString?.let { add(it) } }
    }

    fun request(context: Context, url: String, crop: Boolean = false): ImageRequest =
        ImageRequest.Builder(context).data(url).size(if (crop) CROP else FACE).build()

    /** True when every name already has a picture on record (a deck played or warmed before). */
    fun knows(names: Collection<String>) = synchronized(index) { names.all { index.containsKey(it.lowercase()) } }

    /**
     * Downloads (or reads from disk) and decodes every face, and the art crops of [crops], at
     * most 12 at a time, so the table shows them at once. Returns how many loaded, or -1 on timeout.
     */
    suspend fun warm(context: Context, names: Collection<String>, timeoutMs: Long, crops: Collection<String> = emptyList()): Int = withTimeoutOrNull(timeoutMs) {
        val gate = Semaphore(12)
        val jobs = names.mapNotNull { url(it) }.distinct().map { it to false } + crops.mapNotNull { url(it, crop = true) }.distinct().map { it to true }
        coroutineScope {
            jobs.map { (u, crop) -> async(Dispatchers.IO) { gate.withPermit { (loader.execute(request(context, u, crop)) as? SuccessResult) != null } } }.awaitAll().count { it }
        }
    } ?: -1
}
