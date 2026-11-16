package dev.cardstashy.nativeplay.art

import android.content.Context
import android.graphics.BitmapFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import okhttp3.Request
import java.io.File
import java.security.MessageDigest

/**
 * Card art saved once, then drawn from the phone (Randall 13 Nov: "Put this saved pop in on art because omg thats the biggest
 * problem I have", as Planeswalk's art is saved once on its first open). Every picture the player's decks, collection and wishlist
 * draw, in every game (the engine's Collection.artKeep, the site's own choice of picture), is downloaded once in the background
 * and kept in filesDir/art-keep, apart from the 2 GB image cache that can evict. Coil reads it first ([interceptor]), so a tile
 * never waits on the network again, offline included. A Magic picture goes to the grid store ([ThumbStore], WebP, filed by its
 * Scryfall id) as the set download keeps it; any other picture is kept byte for byte, filed by its address. A file that does not
 * decode as a picture is never kept (tried again next time). Downloads wait while a match runs ([ThumbStore.paused]).
 */
object ArtKeep {
    private lateinit var root: File
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile private var running: kotlinx.coroutines.Job? = null
    @Volatile private var wanted: List<String> = emptyList()
    /** (saved, total) of the last list asked for; total 0 before the first. */
    val progress = MutableStateFlow(0 to 0)
    /** Tests: the download, in place of the network. */
    @Volatile internal var fetch: ((String) -> ByteArray?)? = null

    private val ready get() = ::root.isInitialized
    fun init(context: Context) { if (!ready) root = File(context.applicationContext.filesDir, "art-keep").apply { mkdirs() } }
    internal fun initDir(dir: File) { root = dir.apply { mkdirs() } }

    private fun name(url: String) = MessageDigest.getInstance("SHA-1").digest(url.substringBefore('#').toByteArray()).joinToString("") { "%02x".format(it) }
    /** Where [url]'s picture is kept: the grid store for a Scryfall picture, else this store; null before init or for a non-web address. */
    fun file(url: String): File? = when {
        !ready || !url.startsWith("https://") -> null
        ThumbStore.key(url) != null -> ThumbStore.file(url)
        else -> File(root, name(url))
    }
    fun local(url: String): File? = file(url)?.takeIf { it.isFile && it.length() > 0 }

    /** Coil: a kept picture answers before the cache or the network (memory key unchanged, so a decoded tile is still shared). */
    val interceptor = object : coil3.intercept.Interceptor {
        override suspend fun intercept(chain: coil3.intercept.Interceptor.Chain): coil3.request.ImageResult {
            val data = chain.request.data as? String ?: return chain.proceed()
            val f = local(data) ?: return chain.proceed()
            return chain.withRequest(chain.request.newBuilder().data(f).memoryCacheKey(chain.request.memoryCacheKey ?: data).build()).proceed()
        }
    }

    /** Saves every picture in [urls] the phone does not have yet, quietly, four at a time. A newer list replaces one still running. */
    fun keep(urls: List<String>) {
        if (!ready) return
        wanted = urls.filter { it.startsWith("https://") }.distinct()
        if (running?.isActive == true) return
        running = scope.launch {
            var list: List<String>
            do { list = wanted; runCatching { save(list) } } while (list !== wanted)
        }
    }

    /** One pass over [urls]: the missing count left (0 when every picture is on the phone). */
    internal suspend fun save(urls: List<String>): Int {
        val missing = urls.filter { local(it) == null }
        var saved = urls.size - missing.size
        progress.value = saved to urls.size
        val gate = Semaphore(4)
        val ok = coroutineScope { missing.map { u -> async { gate.withPermit { while (ThumbStore.paused) delay(1000); store(u) } } }.awaitAll() }
        saved += ok.count { it }
        progress.value = saved to urls.size
        return urls.size - saved
    }

    /** One picture: a Scryfall one through the grid store, any other byte for byte once it decodes, written atomically. */
    internal fun store(url: String): Boolean = runCatching {
        if (ThumbStore.key(url) != null && fetch == null) return ThumbStore.store(url)
        val out = file(url) ?: return false
        val raw = (fetch ?: ::download)(url) ?: return false
        if (!picture(raw)) return false
        val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(raw, 0, raw.size, o)
        if (o.outWidth <= 0 || o.outHeight <= 0) return false
        out.parentFile?.mkdirs()
        val tmp = File(out.parentFile, out.name + ".part")
        tmp.writeBytes(raw)
        tmp.renameTo(out)
    }.getOrDefault(false)

    /** A picture file by its first bytes (JPEG, PNG, WebP, GIF): an error page or a cut-off answer is never kept. */
    internal fun picture(b: ByteArray): Boolean {
        fun at(i: Int, vararg x: Int) = b.size >= i + x.size && x.indices.all { (b[i + it].toInt() and 0xFF) == x[it] }
        return at(0, 0xFF, 0xD8, 0xFF) || at(0, 0x89, 0x50, 0x4E, 0x47) || (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) || at(0, 0x47, 0x49, 0x46, 0x38)
    }

    private fun download(url: String): ByteArray? =
        CardArt.client.newCall(Request.Builder().url(url).build()).execute().use { r -> if (r.isSuccessful) r.body?.bytes() else null }

    /** How much the kept pictures take (this store only; the grid store counts its own). */
    fun bytes(): Long = if (!ready) 0 else root.walkTopDown().filter { it.isFile }.sumOf { it.length() }
    fun files(): Int = if (!ready) 0 else root.walkTopDown().count { it.isFile }
    /** Settings > Backup's Remove downloaded pictures. */
    fun clear() { if (ready) { root.deleteRecursively(); root.mkdirs() } }
}
