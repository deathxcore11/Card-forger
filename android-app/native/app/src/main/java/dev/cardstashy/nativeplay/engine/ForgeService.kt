package dev.cardstashy.nativeplay.engine

import android.content.Context
import android.util.Log
import cardstashy.forge.LocalEngine
import cardstashy.forge.NativeRulesData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.zip.GZIPInputStream
import java.util.zip.ZipInputStream

/**
 * The Forge rules engine inside the app, the same way the beta's CardStashyForge plugin runs it:
 * the engine pack unpacks once per version, the card database loads once per process and stays
 * loaded, and each match is a new LocalEngine session over it. Nothing here changes Forge, the
 * bridge or the rules data; it only calls them.
 */
object ForgeService {
    sealed interface Status {
        data object Idle : Status
        data class Loading(val step: String) : Status
        data class Ready(val unpackMs: Long, val loadMs: Long, val rulesValidUntil: String?) : Status
        data class Failed(val reason: String) : Status
    }

    private const val TAG = "ForgeService"
    private const val PACK = "forge-engine/pack.zip"
    private const val VERSION = "forge-engine/pack.version"
    private const val RULES_URL = "https://cardstashy.com/forge-rules/current/"

    // One engine thread with a deep stack, as in the beta (Forge recurses deeply in the AI).
    private val engine: ExecutorService = Executors.newSingleThreadExecutor { r -> Thread(null, r, "forge-engine", 16L shl 20) }
    private val _status = MutableStateFlow<Status>(Status.Idle)
    val status: StateFlow<Status> = _status

    /** This engine build takes a lesson's match setup (setup.stack + noMulligan, rebuild-bridge.sh): older engines refuse the key. */
    val matchSetup: Boolean by lazy { runCatching { Class.forName("cardstashy.forge.NativeMatchSetup", false, ForgeService::class.java.classLoader) }.isSuccess }

    @Volatile private var loading: Future<*>? = null
    /** The engine thread's id while it loads cards at background priority (0 when not loading). */
    @Volatile private var loaderTid = 0

    /**
     * The player is choosing a match (U2, Thor 10 Nov: ~3.4 s from the pick to the engine on a cold start): the card load stops
     * yielding to the screen and runs at normal priority, so it is done, or nearly, by the time a deck is picked.
     */
    fun hurry() {
        val t = loaderTid
        if (t != 0) runCatching { android.os.Process.setThreadPriority(t, android.os.Process.THREAD_PRIORITY_DEFAULT); Log.i(TAG, "card load hurried (lobby open)") }
    }
    @Volatile private var rulesValidUntil: String? = null
    @Volatile private var rulesVersion: String? = null
    private val rulesLock = Any()
    private lateinit var app: Context

    /** Starts unpacking and loading in the background; safe to call often. */
    @Synchronized fun prepare(context: Context) {
        app = context.applicationContext
        val l = loading
        if (l != null && (!l.isDone || _status.value !is Status.Failed)) return
        val home = File(app.filesDir, "forge-home").apply { mkdirs() }
        // Forge keeps its preferences under user.home, which Android leaves empty.
        System.setProperty("user.home", home.absolutePath)
        System.setProperty("java.io.tmpdir", app.cacheDir.absolutePath)
        loading = engine.submit {
            // Loading 30,000 cards must never compete with the screen: background priority until it is done.
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND)
            loaderTid = android.os.Process.myTid()
            try {
                _status.value = Status.Loading("Unpacking the engine")
                val t0 = System.currentTimeMillis()
                val root = unpack()
                val unpackMs = System.currentTimeMillis() - t0
                // The weekly rules bundle: a fresher one from the website if reachable, else the one
                // shipped in the app (seeded on first launch), else the engine's own.
                _status.value = Status.Loading("Updating rules")
                seedRules()
                pickDownloadedRules()
                // Only a bundle about to expire is worth waiting for; otherwise cards load first and
                // the check runs afterwards off the engine thread (a slow network never delays a match).
                val soon = LocalDate.now(ZoneOffset.UTC).plusDays(2).toString()
                val expiring = rulesValidUntil == null || rulesValidUntil!! <= soon
                if (expiring) try { downloadRules() } catch (t: Throwable) { Log.i(TAG, "rules update skipped: ${t.message}") }
                _status.value = Status.Loading("Loading cards")
                val loadMs = LocalEngine.init(root.absolutePath)
                _status.value = Status.Ready(unpackMs, loadMs, rulesValidUntil)
                if (!expiring) Thread({ try { downloadRules() } catch (t: Throwable) { Log.i(TAG, "rules update skipped: ${t.message}") } }, "forge-rules-update").start()
            } catch (t: Throwable) {
                Log.e(TAG, "engine load failed", t)
                _status.value = Status.Failed(t.javaClass.simpleName + ": " + t.message)
            } finally { loaderTid = 0; android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_DEFAULT) }
        }
    }

    /** Starts a match once the engine is ready. Blocks the calling (background) thread. */
    fun start(inputJson: String): LocalEngine.Session {
        loading?.get()
        (status.value as? Status.Failed)?.let { throw IllegalStateException(it.reason) }
        // Test builds: an adb hook can name the seed; every test-build match logs the seed it ran on (TableStep).
        val seed = dev.cardstashy.nativeplay.TestHooks.nextSeed?.also { dev.cardstashy.nativeplay.TestHooks.nextSeed = null } ?: (SecureRandom().nextLong() and Long.MAX_VALUE)
        dev.cardstashy.nativeplay.match.TableLog.line("engine seed $seed")
        // W9: what each seat's deck holds as handed to Forge (rows, copies, basic lands), so a land-light draw can be checked.
        runCatching {
            val o = com.google.gson.JsonParser.parseString(inputJson).asJsonObject.let { it.getAsJsonObject("input") ?: it }
            for (seat in listOf("humanDeck", "opponentDeck")) o.getAsJsonObject(seat)?.let { d ->
                val rows = d.getAsJsonArray("cards")?.mapNotNull { it as? com.google.gson.JsonObject }.orEmpty()
                fun q(r: com.google.gson.JsonObject) = r.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 1
                val basics = rows.filter { it.get("name")?.asString?.removePrefix("Snow-Covered ") in setOf("Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes") }.sumOf { q(it) }
                dev.cardstashy.nativeplay.match.TableLog.line("deck $seat \"${d.get("name")?.takeIf { it.isJsonPrimitive }?.asString}\" rows=${rows.size} copies=${rows.sumOf { q(it) }} basics=$basics " +
                    "names=" + rows.joinToString("|") { "${q(it)}x${it.get("name")?.asString}" })
            }
        }
        return engine.submit(Callable { LocalEngine.start(inputJson, seed) }).get()
    }

    /** Names the loaded card database does not know (Forge would refuse the match). Engine thread, after loading. */
    fun unknownNames(names: Collection<String>): List<String> {
        loading?.get()
        if (status.value !is Status.Ready) return emptyList()
        return engine.submit(Callable {
            val db = forge.StaticData.instance().commonCards
            names.filter { n -> !db.contains(n) && !(n.contains(" // ") && db.contains(n.substringBefore(" // "))) }
        }).get()
    }

    fun close(session: LocalEngine.Session?) {
        if (session == null) return
        engine.submit { try { session.close() } catch (t: Throwable) { Log.w(TAG, "close", t) } }
    }

    // ---- Engine pack (same steps as CardStashyForge.unpack) ----

    private fun unpack(): File {
        val version = app.assets.open(VERSION).use { String(it.readBytes(), Charsets.UTF_8).trim() }
        val root = File(app.filesDir, "forge-engine/$version")
        val done = File(root, ".unpacked")
        if (done.isFile) { readRulesDate(root); return root }
        root.parentFile?.listFiles()?.forEach { if (it.name != version) it.deleteRecursively() }
        root.deleteRecursively()
        val buffer = ByteArray(1 shl 16)
        ZipInputStream(BufferedInputStream(app.assets.open(PACK), 1 shl 16)).use { zip ->
            while (true) {
                val e = zip.nextEntry ?: break
                val out = File(root, e.name)
                if (!out.canonicalPath.startsWith(root.canonicalPath + File.separator)) throw IOException("pack_entry_outside_root")
                if (e.isDirectory) { out.mkdirs(); continue }
                out.parentFile?.mkdirs()
                FileOutputStream(out).use { o -> while (true) { val n = zip.read(buffer); if (n <= 0) break; o.write(buffer, 0, n) } }
            }
        }
        if (!done.createNewFile() && !done.isFile) throw IOException("pack_marker_unwritable")
        readRulesDate(root)
        return root
    }

    private fun field(json: String, key: String): String? =
        Regex("\"" + key + "\"\\s*:\\s*\"([^\"]{1,160})\"").find(json)?.groupValues?.get(1)

    private fun readRulesDate(root: File) {
        try {
            val m = File(root, "rules-data/current/manifest.json").readText()
            rulesValidUntil = field(m, "validUntilExclusive"); rulesVersion = field(m, "version")
        } catch (_: IOException) { rulesValidUntil = null }
    }

    private fun rulesDir() = File(app.filesDir, "forge-rules")

    // The website's bundle shipped inside this APK, put where a download would go. It is
    // checked by the engine itself (NativeRulesData.load) before it is used, like a download.
    private fun seedRules() {
        val m = try { app.assets.open("forge-rules-seed/manifest.json").use { String(it.readBytes(), Charsets.UTF_8) } } catch (_: IOException) { return }
        val version = field(m, "version") ?: return
        if (!version.matches(Regex("[A-Za-z0-9._-]{1,120}"))) return
        val dir = File(rulesDir(), version)
        if (File(dir, "manifest.json").isFile) return
        val part = File(rulesDir(), "$version.part").apply { deleteRecursively(); mkdirs() }
        for (name in listOf("manifest.json", "cards.json", "official-format-facts.json")) {
            app.assets.open("forge-rules-seed/$name").use { input -> FileOutputStream(File(part, name)).use { input.copyTo(it) } }
        }
        dir.deleteRecursively()
        part.renameTo(dir)
    }

    // A bundle on disk newer than the one in use that still passes the engine's own checks.
    private fun pickDownloadedRules() {
        val today = LocalDate.now(ZoneOffset.UTC).toString()
        for (dir in rulesDir().listFiles().orEmpty()) {
            if (!dir.isDirectory || dir.name.endsWith(".part")) continue
            try {
                val m = File(dir, "manifest.json").readText()
                val until = field(m, "validUntilExclusive") ?: continue
                if (today >= until || (rulesValidUntil != null && until <= rulesValidUntil!!)) continue
                NativeRulesData.load(dir.toPath(), LocalDate.now(ZoneOffset.UTC), "current", null)
                useRules(dir, until, field(m, "version"))
            } catch (_: Exception) { /* the bundled rules stay in use */ }
        }
    }

    // Matches started from now on read this bundle; Forge's cached copy is dropped.
    private fun useRules(dir: File, until: String?, version: String?) {
        synchronized(NativeRulesData::class.java) {
            System.setProperty("proof.rulesData", dir.absolutePath)
            val cached = NativeRulesData::class.java.getDeclaredField("cached")
            cached.isAccessible = true
            cached.set(null, null)
        }
        rulesValidUntil = until; rulesVersion = version
    }

    private fun fetch(url: String, limit: Int): ByteArray {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 8000; c.readTimeout = 20000
        c.setRequestProperty("Accept-Encoding", "gzip")
        try {
            if (c.responseCode != 200) throw IOException("http_" + c.responseCode)
            val raw: InputStream = BufferedInputStream(c.inputStream, 1 shl 16)
            (if ("gzip".equals(c.contentEncoding, true)) GZIPInputStream(raw) else raw).use { input ->
                val out = ByteArrayOutputStream(); val b = ByteArray(1 shl 16)
                while (true) { val n = input.read(b); if (n <= 0) break; out.write(b, 0, n); if (out.size() > limit) throw IOException("too_large") }
                return out.toByteArray()
            }
        } finally { c.disconnect() }
    }

    // CardStashyForge.downloadRules: this week's bundle from the website when it is newer.
    private fun downloadRules() = synchronized(rulesLock) {
        val manifest = String(fetch(RULES_URL + "manifest.json", 65536), Charsets.UTF_8)
        val version = field(manifest, "version"); val until = field(manifest, "validUntilExclusive")
        if (version == null || until == null || !version.matches(Regex("[A-Za-z0-9._-]{1,120}"))) throw IOException("manifest_invalid")
        if (version == rulesVersion || (rulesValidUntil != null && until <= rulesValidUntil!!)) return@synchronized
        val base = rulesDir(); val part = File(base, "$version.part"); val dir = File(base, version)
        part.deleteRecursively()
        if (!part.mkdirs()) throw IOException("rules_dir_unwritable")
        File(part, "manifest.json").writeBytes(manifest.toByteArray())
        File(part, "cards.json").writeBytes(fetch(RULES_URL + "cards.json", 16 shl 20))
        File(part, "official-format-facts.json").writeBytes(fetch(RULES_URL + "official-format-facts.json", 65536))
        NativeRulesData.load(part.toPath(), LocalDate.now(ZoneOffset.UTC), "current", null)
        dir.deleteRecursively()
        if (!part.renameTo(dir)) throw IOException("rules_dir_unwritable")
        useRules(dir, until, version)
        base.listFiles()?.forEach { if (it.name != version) it.deleteRecursively() }
    }
}
