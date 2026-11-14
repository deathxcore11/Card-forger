package dev.cardstashy.nativeplay.foil

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Gap audit G2: the depth model left the APK and comes from the site in parts. Only a file whose size and sha256 match is used;
 * a missing, cut short or wrong file means no model (the card keeps its window-only depth), and a wrong one is removed.
 */
class DepthModelFileTest {
    private val root = File(System.getProperty("repoRoot"))
    private val parts = (1..DepthModelFile.PARTS).map { File(root, "downloads/models/depth-anything-v2-small.onnx.part$it") }
    private fun dir() = kotlin.io.path.createTempDirectory("depth").toFile()

    @Test fun missingIsNone() { assertNull(DepthModelFile.readyIn(dir())) }

    @Test fun wrongFileIsRemoved() {
        val d = dir(); val f = DepthModelFile.fileIn(d); f.parentFile!!.mkdirs(); f.writeText("not a model")
        assertNull(DepthModelFile.readyIn(d))
        assertFalse(f.exists())
    }

    @Test fun shortOrWrongPartsAreNotKept() {
        val d = dir()
        assertFalse(DepthModelFile.install(d, listOf({ "half a model".byteInputStream() })))
        assertFalse(DepthModelFile.fileIn(d).exists())
        // A part that fails mid-way (no network) leaves nothing either.
        assertFalse(DepthModelFile.install(d, listOf({ throw java.io.IOException("offline") })))
        assertNull(DepthModelFile.readyIn(d))
    }

    /** The site's parts join into the exact model the app checks for. */
    @Test fun siteParts() {
        assumeTrue(parts.all { it.isFile })
        val d = dir()
        assertTrue(DepthModelFile.install(d, parts.map { p -> { p.inputStream() } }))
        val f = DepthModelFile.readyIn(d)!!
        assertEquals(DepthModelFile.SIZE, f.length())
        assertEquals(DepthModelFile.SHA256, DepthModelFile.sha256(f))
        // Every part is under Cloudflare's 25 MiB file limit.
        assertTrue(parts.all { it.length() <= 25L * 1024 * 1024 })
    }
}
