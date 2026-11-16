package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.foil.FoilMaps
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
 * Inputs for Magic foil captures off the phone: for each card, the recipe and frame Foil.look picks, the maps MtgFoil.cardMaps measures
 * from the scan read exactly as FoilMaps.mtgCard reads it (the maps' fixed size, area-averaged), and the app's own program for that
 * foil type (Foil.source). Robolectric's canvas is software only and refuses RuntimeShader, so a Skia renderer (CanvasKit, CPU) draws
 * the shader from these. Opt in: MTG_FOIL_CARDS names a folder of Scryfall card JSON + scan pairs (fra-458.json / fra-458.jpg ...;
 * silver scroll wants the large scan), MTG_FOIL_OUT where the files go; otherwise skipped.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class MtgFoilCaptureTest {
    @Test fun captures() {
        val cards = System.getenv("MTG_FOIL_CARDS")?.let(::File); val out = System.getenv("MTG_FOIL_OUT")?.let(::File)
        assumeTrue(cards != null && cards.isDirectory && out != null)
        out!!.mkdirs()
        val data = CardData.of(javaClass.classLoader!!.getResource("card-data.json")!!.readText())
        val W = MtgFoil.MAP_W; val H = MtgFoil.MAP_H
        for (json in cards!!.listFiles { f -> f.name.endsWith(".json") }!!.sortedBy { it.name }) {
            val id = json.name.removeSuffix(".json")
            val card = JsonParser.parseString(json.readText()).asJsonObject
            val scan = BitmapFactory.decodeFile(File(cards, "$id.jpg").path) ?: continue
            val look = Foil.look(data, card, "foil")
            val r = look.recipe ?: continue
            val px = FoilMaps.mapPixels(scan)
            val m = MtgFoil.cardMaps(px, W, H, r.pat.toInt(), look.frame.art, look.frame.text, null)
            fun bmp(b: ByteArray) = Bitmap.createBitmap(IntArray(W * H) { i -> val k = i * 4
                (255 shl 24) or ((b[k].toInt() and 255) shl 16) or ((b[k + 1].toInt() and 255) shl 8) or (b[k + 2].toInt() and 255) }, W, H, Bitmap.Config.ARGB_8888)
            fun save(b: Bitmap, n: String) = File(out, "$id.$n.png").outputStream().use { b.compress(Bitmap.CompressFormat.PNG, 100, it) }
            save(bmp(m.mask), "mask"); save(bmp(m.relief), "relief"); save(bmp(m.stroke), "stroke")
            File(out, "$id.agsl").writeText(Foil.source(r))
            // The uniforms Modifier.foil sets, so a renderer off the phone draws the same frame (RuntimeShader needs a GPU canvas here).
            val star = m.star
            File(out, "$id.params.json").writeText(com.google.gson.Gson().toJson(mapOf("recipe" to r.key, "u_r1" to listOf(r.pat, r.tint, r.cover, r.relief),
                "u_r2" to listOf(r.film, r.sparkle, r.stamp, r.keep), "stamp" to look.stamp, "u_art" to m.art.toList(), "u_text" to m.text.toList(),
                "u_star" to listOf(star?.get(0) ?: (m.text[0] + .1f), star?.get(1) ?: (m.text[3] - .005f), if (star != null) 2f else 1f), "map" to listOf(W, H))))
            println("capture $id ${r.key} pat ${r.pat} frame ${look.frameKey} star ${star != null}")
        }
    }
}
