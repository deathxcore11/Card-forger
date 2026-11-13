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
}
