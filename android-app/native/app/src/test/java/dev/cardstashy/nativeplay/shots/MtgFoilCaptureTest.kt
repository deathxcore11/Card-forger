package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.foil.DepthMatte
import dev.cardstashy.nativeplay.foil.DepthModel
import dev.cardstashy.nativeplay.foil.MtgFoil
import dev.cardstashy.nativeplay.play.CardData
import dev.cardstashy.nativeplay.ui.Foil
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Inputs for Magic foil captures off the phone: for each card, the recipe and frame Foil.look picks, the maps MtgFoil.analyze measures
 * from the scan scaled exactly as FoilMaps.mtg scales it, and the app's own AGSL (Foil.AGSL). Robolectric's canvas is software only
 * and refuses RuntimeShader, so a Skia renderer (CanvasKit, CPU) draws the shader from these. Opt in: MTG_FOIL_CARDS names a folder of
 * Scryfall card JSON + normal scan pairs (fra-458.json / fra-458.jpg ...), MTG_FOIL_OUT where the files go; otherwise skipped.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class MtgFoilCaptureTest {
    @Test fun captures() {
        val cards = System.getenv("MTG_FOIL_CARDS")?.let(::File); val out = System.getenv("MTG_FOIL_OUT")?.let(::File)
        assumeTrue(cards != null && cards.isDirectory && out != null)
        out!!.mkdirs()
        File(out, "foil.agsl").writeText(Foil.AGSL)
        val data = CardData.of(javaClass.classLoader!!.getResource("card-data.json")!!.readText())
        for (json in cards!!.listFiles { f -> f.name.endsWith(".json") }!!.sortedBy { it.name }) {
            val id = json.name.removeSuffix(".json")
            val card = JsonParser.parseString(json.readText()).asJsonObject
            val scan = BitmapFactory.decodeFile(File(cards, "$id.jpg").path) ?: continue
            val look = Foil.look(data, card, "foil")
            val r = look.recipe ?: continue
            val src = scan.copy(Bitmap.Config.ARGB_8888, false)
            val (aw, ah) = MtgFoil.analysisSize(src.width, src.height)
            val small = Bitmap.createScaledBitmap(src, aw, ah, true)
            val px = IntArray(aw * ah).also { small.getPixels(it, 0, aw, 0, 0, aw, ah) }
            val m = MtgFoil.analyze(px, aw, ah, look.facetText)
            fun bmp(b: ByteArray) = Bitmap.createBitmap(IntArray(aw * ah) { i -> val k = i * 4
                (255 shl 24) or ((b[k].toInt() and 255) shl 16) or ((b[k + 1].toInt() and 255) shl 8) or (b[k + 2].toInt() and 255) }, aw, ah, Bitmap.Config.ARGB_8888)
            val measured = MtgFoil.needsMaps(r.cover, r.relief, r.film, r.pat) // what Look.measure asks the phone for
            fun save(b: Bitmap, n: String) = File(out, "$id.$n.png").outputStream().use { b.compress(Bitmap.CompressFormat.PNG, 100, it) }
            // Facet foil's matte figure, as the phone lays it in (DepthLayers.facetFigure -> FoilMaps.figure): the depth cut of the whole card
            // from the model's output, which an off-phone runner saves next to the scan ($id.depth.bin: 518 x 518 big-endian floats, 0..1).
            val depth = File(cards, "$id.depth.bin")
            val facet = m.facet?.let { f ->
                if (!depth.isFile) return@let f
                val d = java.io.DataInputStream(depth.inputStream().buffered()).use { inp -> FloatArray(DepthModel.SIZE * DepthModel.SIZE) { inp.readFloat() } }
                val hw = minOf(src.width, 720); val hh = Math.round(src.height.toFloat() * hw / src.width)
                val hiBmp = if (hw == src.width) src else Bitmap.createScaledBitmap(src, hw, hh, true)
                val hi = IntArray(hw * hh).also { hiBmp.getPixels(it, 0, hw, 0, 0, hw, hh) }
                val lw = minOf(src.width, DepthMatte.CUT_WIDTH); val lh = Math.round(src.height.toFloat() * lw / src.width)
                val lo = IntArray(lw * lh).also { Bitmap.createScaledBitmap(src, lw, lh, true).getPixels(it, 0, lw, 0, 0, lw, lh) }
                val cut = DepthMatte.cutFull(lo, DepthMatte.resize(d, DepthModel.SIZE, DepthModel.SIZE, lw, lh), lw, lh, hi, hw, hh)
                println("capture $id depth ${cut.gate}")
                cut.figure?.let { MtgFoil.figureMatte(f, it, hw, hh, aw, ah, look.facetText!!) } ?: f
            }
            if (measured) { save(bmp(m.mask), "mask"); save(bmp(m.relief), "relief"); save(bmp(m.stroke), "stroke"); facet?.let { save(bmp(it), "facet") } }
            // The uniforms Modifier.foil sets, so a renderer off the phone draws the same frame (RuntimeShader needs a GPU canvas here).
            File(out, "$id.params.json").writeText(com.google.gson.Gson().toJson(mapOf("recipe" to r.key, "u_r1" to listOf(r.pat, r.tint, r.cover, r.relief),
                "u_r2" to listOf(r.film, r.sparkle, r.stamp.takeIf { it > 0f } ?: if (look.stamp) 2f else 0f, r.keep), "u_art" to look.frame.art.toList(),
                "u_text" to look.frame.text.toList(), "maps" to measured, "facet" to (m.facet != null), "map" to listOf(aw, ah))))
            println("capture $id ${r.key} pat ${r.pat} maps $measured facets ${m.facet != null}")
        }
    }
}
