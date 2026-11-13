package dev.cardstashy.nativeplay.ui

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.security.MessageDigest

/**
 * Gap audit G6: every file planeswalk.html loads as code (script src, link href, the "./x.js" it names, then each script's imports,
 * read here on their own, not with the export's walker) is in the app's pack, unchanged, and the pack's page is the site's page.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class PlaneswalkPackTest {
    private val root = File(System.getProperty("repoRoot"))
    private val pack = File(root, "android-app/native/app/src/main/assets/planeswalk")

    private fun refs(path: String, text: String): Set<String> {
        val dir = path.substringBeforeLast('/', "")
        val out = mutableSetOf<String>()
        fun add(r: String) {
            if (r.contains("\${") || Regex("^(https?:|data:|blob:|//)").containsMatchIn(r)) return
            val p = runCatching { java.net.URI("x:/" + (if (dir.isEmpty()) "" else "$dir/") + r).normalize().path.removePrefix("/") }.getOrNull() ?: return
            if (Regex("\\.(js|mjs|css)$").containsMatchIn(p)) out += p
        }
        if (path.endsWith(".html")) Regex("""<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']""").findAll(text).forEach { add(it.groupValues[1]) }
        Regex("""\b(?:import|export)\s[^;'"]*?from\s*["']([^"'\s]+)["']""").findAll(text).forEach { add(it.groupValues[1]) }
        Regex("""import\s*\(\s*["']([^"']+)["']\s*\)""").findAll(text).forEach { add(it.groupValues[1]) }
        Regex("""["'`](\./[\w./-]+\.(?:js|mjs|css))["'`]""").findAll(text).forEach { add(it.groupValues[1]) }
        return out
    }

    @Test fun everyImportIsPacked() {
        assumeTrue(File(pack, "manifest.json").isFile)
        val listed = JSONObject(File(pack, "manifest.json").readText()).getJSONArray("files").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }
        val need = mutableSetOf("planeswalk.html"); val queue = ArrayDeque(need)
        while (queue.isNotEmpty()) { val f = queue.removeFirst(); for (r in refs(f, File(root, f).readText())) if (need.add(r)) queue += r }
        assertTrue("missing from the pack: ${need - listed}", listed.containsAll(need))
        for (f in need) assertTrue("$f differs from the site's", File(root, f).readBytes().contentEquals(File(pack, f).readBytes()))
        val sha = MessageDigest.getInstance("SHA-256").digest(File(root, "planeswalk.html").readBytes()).joinToString("") { "%02x".format(it) }
        assertEquals(sha, JSONObject(File(pack, "manifest.json").readText()).getString("page"))
    }

    @Test fun onlyThePage() {
        assertTrue(PlaneswalkPack.isPage(android.net.Uri.parse("https://cardstashy.com/planeswalk.html")))
        assertTrue(!PlaneswalkPack.isPage(android.net.Uri.parse("https://cardstashy.com/")))
        assertTrue(!PlaneswalkPack.isPage(android.net.Uri.parse("https://evil.test/planeswalk.html")))
        assertEquals("text/javascript", PlaneswalkPack.mime("vendor/supabase-js-2.110.0.js"))
    }

    /** Freshness: a newer page from the site is saved whole with every file it loads; the same page or a missing file keeps nothing. */
    @Test fun newerPageSavedWhole() {
        val dir = File(kotlin.io.path.createTempDirectory("pw").toFile(), "planeswalk-live")
        val site = mapOf("a.js" to "import {x} from './b.js'".toByteArray(), "b.js" to "export const x=1".toByteArray(), "s.css" to "body{}".toByteArray())
        val page = "<script type=\"module\" src=\"./a.js\"></script><script>const css='./s.css'</script>".toByteArray()
        val sha = MessageDigest.getInstance("SHA-256").digest(page).joinToString("") { "%02x".format(it) }
        assertTrue("same page: nothing to save", !PlaneswalkPack.save(dir, sha, page, "e1") { site[it] })
        assertTrue("a file the site could not give: nothing kept", !PlaneswalkPack.save(dir, "old", page, "e1") { if (it == "b.js") null else site[it] })
        assertTrue(!dir.exists())
        assertTrue(PlaneswalkPack.save(dir, "old", page, "e2") { site[it] })
        assertEquals(setOf("planeswalk.html", "a.js", "b.js", "s.css", "manifest.json"), dir.list()!!.toSet())
        assertEquals(sha, JSONObject(File(dir, "manifest.json").readText()).getString("page"))
    }

    /** Randall 13 Nov, "Download once on first open": the art, figures and effects the page loads are listed, saved whole and answered offline. */
    @Test fun artAndSoundsSavedOnceThenServedOffline() {
        val media = File(pack, "media.json"); assumeTrue(media.isFile)
        val a = JSONObject(media.readText()).getJSONArray("files")
        val list = (0 until a.length()).map { a.getJSONArray(it) }.map { PlaneswalkPack.Media(it.getString(0), it.getLong(1), it.getString(2)) }
        val paths = list.map { it.path }.toSet()
        // What the page names at runtime: the cast's index and figures, a patron's art, an effect it plays, the finish stamp.
        for (p in listOf("planeswalk-cast/cast.json", "planeswalk-art/patrons/sealed-back.webp", "assets/audio/sfx/PWB-001.ogg", "assets/finishes/stamp-first-movie.png"))
            assertTrue(p, p in paths)
        assertTrue(list.sumOf { it.bytes } in 40_000_000L..90_000_000L)
        // Saving: a file the site answers wrongly is not kept (tried again next open); the rest are, byte for byte.
        val dir = kotlin.io.path.createTempDirectory("pw-media").toFile()
        val some = list.filter { it.path.startsWith("planeswalk-cast/") }.take(3) + list.first { it.path == "assets/audio/sfx/PWB-001.ogg" }
        var asked = 0
        val left = PlaneswalkPack.saveMedia(dir, some) { p -> asked++; if (p == some[1].path) "broken".toByteArray() else File(root, p).readBytes() }
        assertEquals(1, left); assertEquals(4, asked)
        assertEquals(some[0].sha, MessageDigest.getInstance("SHA-256").digest(File(dir, some[0].path).readBytes()).joinToString("") { "%02x".format(it) })
        assertTrue(!File(dir, some[1].path).exists())
        // A second open asks only for what is still missing.
        asked = 0
        assertEquals(0, PlaneswalkPack.saveMedia(dir, some) { p -> asked++; File(root, p).readBytes() }); assertEquals(1, asked)
        // While Planeswalk is open the app answers a saved file itself, so it shows with no connection.
        val ctx = org.robolectric.RuntimeEnvironment.getApplication()
        val saved = PlaneswalkPack.mediaDir(ctx).apply { deleteRecursively() }
        dir.copyRecursively(saved)
        if (PlaneswalkPack.mediaList(ctx).isNotEmpty()) {
            val r = PlaneswalkPack.serve(ctx, android.net.Uri.parse("https://cardstashy.com/assets/audio/sfx/PWB-001.ogg?v=kit3"))!!
            assertEquals("audio/ogg", r.mimeType)
            assertTrue(r.data.readBytes().contentEquals(File(root, "assets/audio/sfx/PWB-001.ogg").readBytes()))
            assertEquals(null, PlaneswalkPack.serve(ctx, android.net.Uri.parse("https://cardstashy.com/planeswalk-art/patrons/sealed-back.webp")))
        }
        saved.deleteRecursively(); dir.deleteRecursively()
    }
}
