package dev.cardstashy.nativeplay.art

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import okhttp3.Request
import java.io.File

/**
 * The phone's own grid thumbnails (offline art plan, approved 4 Nov): one pinned store filed by Scryfall image id, apart
 * from the 2 GB image cache that can evict. The first time a set is opened its whole card list is saved here quietly,
 * so the grid and later visits never wait on the network. Each picture is the same 488 px "normal" image the grid already
 * shows, re-encoded to WebP (about 47 KB instead of 87 KB), so nothing looks softer. Foil is a live layer drawn over the
 * plain picture (ui/Foil.kt) from the printing's data, which is saved with the set, so stored tiles still shine offline.
 * Coil reads this store first (see [interceptor]). Downloads pause while a match is running.
 */
object ThumbStore {
    private const val SCRYFALL = "https://api.scryfall.com"
    private lateinit var root: File
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val busy = HashSet<String>()
    private val lock = Mutex()
    /** Set code -> (saved, total) while a set is downloading; removed when done. */
    val progress = MutableStateFlow<Map<String, Pair<Int, Int>>>(emptyMap())
    /** True while a match runs: downloads wait so the table gets the network and CPU. */
    @Volatile var paused = false

    private val ready get() = ::root.isInitialized
    fun init(context: Context) {
        if (::root.isInitialized) return
        root = File(context.applicationContext.filesDir, "thumbs/mtg").apply { mkdirs() }
    }

    /** cards.scryfall.io/normal/front/a/9/<uuid>.jpg?123 -> "<uuid>-front"; null for anything else. */
    fun key(url: String): String? {
        val m = Regex("""cards\.scryfall\.io/(?:normal|large|small)/(front|back)/[0-9a-f]/[0-9a-f]/([0-9a-f-]{36})\.""").find(url) ?: return null
        return m.groupValues[2] + "-" + m.groupValues[1]
    }
    fun file(url: String): File? = if (!ready) null else key(url)?.let { File(root, "$it.webp") }
    fun local(url: String): File? = file(url)?.takeIf { it.isFile && it.length() > 0 }

    fun setDone(code: String) = ready && File(root, "sets/${code.lowercase()}.json").isFile
    fun bytes(): Long = if (!ready) 0 else root.walkTopDown().filter { it.isFile }.sumOf { it.length() }
    fun setsSaved(): Int = if (!ready) 0 else File(root, "sets").list()?.size ?: 0

    /** Coil: a stored thumbnail answers before the cache or the network. */
    val interceptor = object : coil3.intercept.Interceptor {
        override suspend fun intercept(chain: coil3.intercept.Interceptor.Chain): coil3.request.ImageResult {
            val data = chain.request.data as? String ?: return chain.proceed()
            val f = local(data) ?: return chain.proceed()
            return chain.withRequest(chain.request.newBuilder().data(f).memoryCacheKey(data).build()).proceed()
        }
    }

    /** Saves every printing in [code] once, quietly, in the background. Calling it again while running or after it finished does nothing. */
    fun ensureSet(code: String) {
        if (!ready || code.isBlank()) return
        val c = code.lowercase()
        if (setDone(c)) return
        synchronized(busy) { if (!busy.add(c)) return }
        scope.launch {
            try { runCatching { downloadSet(c) } }
            finally { synchronized(busy) { busy.remove(c) }; progress.value = progress.value - c }
        }
    }

    private suspend fun waitIfPaused() { while (paused) delay(1000) }

    private suspend fun downloadSet(code: String) {
        // The set's printings from Scryfall's search (175 per page, 100 ms apart as Scryfall asks).
        val cards = ArrayList<JsonObject>()
        var url: String? = "$SCRYFALL/cards/search?order=set&unique=prints&q=" + java.net.URLEncoder.encode("e:$code game:paper", "UTF-8") // the Shop set page's own list
        while (url != null) {
            waitIfPaused()
            val body = get(url)?.let { JsonParser.parseString(it).asJsonObject } ?: return
            body.getAsJsonArray("data")?.forEach { (it as? JsonObject)?.let(cards::add) }
            url = if (body.get("has_more")?.asBoolean == true) body.get("next_page")?.asString else null
            delay(120)
        }
        val images = cards.flatMap { c ->
            listOfNotNull(c.getAsJsonObject("image_uris")?.get("normal")?.asString) +
                c.getAsJsonArray("card_faces")?.mapNotNull { (it as? JsonObject)?.getAsJsonObject("image_uris")?.get("normal")?.asString }.orEmpty()
        }.distinct()
        var saved = images.count { local(it) != null }
        progress.value = progress.value + (code to (saved to images.size))
        val gate = Semaphore(4)
        coroutineScopeAll(images.filter { local(it) == null }) { img ->
            gate.withPermit {
                waitIfPaused()
                if (store(img)) lock.withLock { saved++; progress.value = progress.value + (code to (saved to images.size)) }
            }
        }
        // The set's printings (with their finish data for foil), so the set reads offline too. Written last: it marks the set done.
        if (saved >= images.size) File(root, "sets").mkdirs().also {
            File(root, "sets/$code.json").writeText(JsonObject().apply { add("cards", JsonArray().apply { cards.forEach { add(dev.cardstashy.nativeplay.play.CardFacts.slim(it)) } }) }.toString())
        }
    }

    private suspend fun <T> coroutineScopeAll(items: List<T>, block: suspend (T) -> Unit) = kotlinx.coroutines.coroutineScope { items.map { async { block(it) } }.awaitAll() }

    private fun get(url: String): String? = runCatching {
        CardArt.client.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { r -> if (r.isSuccessful) r.body?.string() else null }
    }.getOrNull()

    /** One picture: fetched, re-encoded to WebP at its own size, written atomically. */
    fun store(url: String): Boolean = runCatching {
        val out = file(url) ?: return false
        val raw = CardArt.client.newCall(Request.Builder().url(url).build()).execute().use { r -> if (r.isSuccessful) r.body?.bytes() else null } ?: return false
        val bmp = BitmapFactory.decodeByteArray(raw, 0, raw.size) ?: return false
        val tmp = File(out.parentFile, out.name + ".part")
        tmp.outputStream().use { s -> @Suppress("DEPRECATION") bmp.compress(if (android.os.Build.VERSION.SDK_INT >= 30) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP, 78, s) }
        bmp.recycle()
        tmp.renameTo(out)
    }.getOrDefault(false)

    /** A saved set's printings (slim Scryfall cards), or empty when this phone has not saved it. */
    fun savedSet(code: String): List<JsonObject> = if (!ready) emptyList() else runCatching {
        JsonParser.parseString(File(root, "sets/${code.lowercase()}.json").readText()).asJsonObject.getAsJsonArray("cards").mapNotNull { it as? JsonObject }
    }.getOrDefault(emptyList())

    /** Settings: forget every stored thumbnail. */
    /** How many pictures are saved (Settings > Backup's Remove downloaded pictures says it). */
    fun files(): Int = if (!ready) 0 else root.walkTopDown().count { it.isFile }
    fun clear() { if (ready) { root.deleteRecursively(); root.mkdirs() } }
}
