package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.foil.MtgStamp
import dev.cardstashy.nativeplay.play.CardData
import dev.cardstashy.nativeplay.ui.Foil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64
import java.util.zip.GZIPInputStream
import kotlin.math.abs

/**
 * Magic's security stamp is found on each card's own picture, as the site finds it (mtg-stamp.js measureStamp, ported in
 * foil/MtgStamp.kt), and drawn only there. Owner's report, 15 Nov (app 0.4.82): Torrential Gearhulk (KLD 67) set to Nonfoil showed a
 * pink rainbow oval at a fixed spot, half over its printed stamp; the site's fix (f1f9e2a) had never reached the app.
 *
 * Inputs: the site's own fixture (test-fixtures/mtg-security-stamps.json.gz: bottom-centre strips of 32 real Scryfall pictures) with
 * what the site's measureStamp returns on each, written by node (mtg-security-stamps-site.json.gz); and the exact card that broke,
 * Scryfall's record and pictures for KLD 67 (normal 488 px, the picture the app measures, and large 672 px), fetched 15 Nov.
 */
class MtgStampTest {
    private fun stream(n: String) = javaClass.getResourceAsStream(n)!!
    private fun gz(n: String): JsonObject = JsonParser.parseString(GZIPInputStream(stream(n)).readBytes().decodeToString()).asJsonObject
    private fun json(n: String): JsonObject = JsonParser.parseString(stream(n).readBytes().decodeToString()).asJsonObject

    /** A fixture strip laid into a black card of its full size, as the site's test builds it. */
    private fun picture(c: JsonObject): IntArray {
        val W = c["W"].asInt; val H = c["H"].asInt; val x0 = c["x0"].asInt; val y0 = c["y0"].asInt; val w = c["w"].asInt; val h = c["h"].asInt
        val l = Base64.getDecoder().decode(c["lum"].asString)
        val px = IntArray(W * H) { 0xFF000000.toInt() }
        for (y in 0 until h) for (x in 0 until w) { val v = l[y * w + x].toInt() and 255; px[(y + y0) * W + x + x0] = (255 shl 24) or (v shl 16) or (v shl 8) or v }
        return px
    }

    @Test fun portMeasuresEveryFixtureStripLikeTheSite() {
        val cards = gz("/foil/mtg-security-stamps.json.gz").getAsJsonArray("cards").map { it.asJsonObject }
        val site = gz("/foil/mtg-security-stamps-site.json.gz").getAsJsonArray("rows").map { it.asJsonObject }
        assertEquals(32, cards.size); assertEquals(cards.size, site.size)
        var found = 0; var none = 0
        for ((c, js) in cards.zip(site)) {
            val id = "${c["name"]?.asString} (${c["set"].asString} ${c["number"].asString})"
            assertEquals(id, js["set"].asString, c["set"].asString); assertEquals(id, js["number"].asString, c["number"].asString)
            val W = c["W"].asInt; val H = c["H"].asInt
            val s = MtgStamp.measure(picture(c), W, H)
            val want = js.get("stamp")?.takeIf { it.isJsonObject }?.asJsonObject
            if (want == null) { assertNull("$id: the site draws no stamp here, nor may the app", s); none++; continue }
            assertNotNull("$id: the site finds a stamp here", s); s!!; found++
            // Box within 1 px of the site's.
            for ((k, got) in listOf("x" to s.x * W, "y" to s.y * H, "w" to s.w * W, "h" to s.h * H)) {
                val exp = want[k].asDouble * (if (k == "x" || k == "w") W else H)
                assertTrue("$id: $k ${"%.2f".format(got)} px vs site ${"%.2f".format(exp)} px", abs(got - exp) <= 1.0)
            }
            assertEquals(id, want["mw"].asInt, s.mw); assertEquals(id, want["mh"].asInt, s.mh)
            // The mask follows the same outline and print, byte for byte within rounding.
            val m = Base64.getDecoder().decode(want["mask"].asString)
            assertEquals(id, m.size, s.mask.size)
            val worst = m.indices.maxOf { abs((m[it].toInt() and 255) - (s.mask[it].toInt() and 255)) }
            assertTrue("$id: mask off by $worst", worst <= 1)
        }
        // mtg-stamp test: 24 stamps found; 7 cards without one and 1 known miss (ss3 6) draw nothing.
        assertEquals(24, found); assertEquals(8, none)
        assertNull(MtgStamp.measure(null, 0, 0)); assertNull(MtgStamp.measure(IntArray(40 * 40), 40, 40))
    }

    /** The JPEG decoded by the JVM's own reader (javax.imageio, reached by name: the Android test classpath does not declare it). */
    private fun scan(n: String): Triple<IntArray, Int, Int> {
        val img = Class.forName("javax.imageio.ImageIO").getMethod("read", java.io.InputStream::class.java).invoke(null, stream(n))!!
        val k = img.javaClass
        val w = k.getMethod("getWidth").invoke(img) as Int; val h = k.getMethod("getHeight").invoke(img) as Int
        val get = k.getMethod("getRGB", Int::class.java, Int::class.java, Int::class.java, Int::class.java, IntArray::class.java, Int::class.java, Int::class.java)
        return Triple(get.invoke(img, 0, 0, w, h, null, 0, w) as IntArray, w, h)
    }

    /** The exact picture that broke. Site's measureStamp on the same files (decoded by PIL): normal 223, 622, 43 x 22 px; large
     *  307, 856, 59 x 31 px. Checked by eye on a crop: the box sits on the printed oval stamp below the text box. */
    @Test fun torrentialGearhulkStampIsFoundOnItsOwnPicture() {
        for ((file, box) in listOf("normal" to doubleArrayOf(223.0, 622.0, 43.0, 22.0), "large" to doubleArrayOf(307.0, 856.0, 59.0, 31.0))) {
            val (px, W, H) = scan("/foil/torrential-gearhulk-kld-67-$file.jpg")
            val s = MtgStamp.measure(px, W, H)
            assertNotNull("KLD 67 $file: stamp found", s); s!!
            val got = doubleArrayOf(s.x * W, s.y * H, s.w * W, s.h * H)
            for (i in 0..3) assertTrue("KLD 67 $file: box ${got.joinToString()} vs site ${box.joinToString()}", abs(got[i] - box[i]) <= 1.0)
            // As a share of the card: the printed oval at 45.7% left, 91.5% top, 8.8% x 3.2%.
            val pct = doubleArrayOf(s.x, s.y, s.w, s.h).map { it * 100 }
            listOf(45.7, 91.5, 8.8, 3.2).forEachIndexed { i, v -> assertTrue("KLD 67 $file: $pct", abs(pct[i] - v) <= .45) }
            // The mask follows the print, neither empty nor a solid block, and leaves the box's bottom corners clear.
            val lit = s.mask.count { (it.toInt() and 255) > 40 }.toDouble() / s.mask.size
            assertTrue("KLD 67 $file: lit $lit", lit > .2 && lit < .95)
            for (i in intArrayOf((s.mh - 1) * s.mw, s.mh * s.mw - 1)) assertTrue((s.mask[i].toInt() and 255) < 70)
        }
    }

    /** Scryfall's record for KLD 67 says oval, mythic, 2015 frame: it is stamped, foil or not, and the picture the app measures is
     *  this record's normal picture. */
    @Test fun torrentialGearhulkIsStamped() {
        val card = json("/foil/torrential-gearhulk-kld-67.json")
        assertEquals("oval", card["security_stamp"].asString)
        assertTrue(CardData.holoStamp(card))
        val data = CardData(json("/card-data.json"))
        val look = Foil.look(data, card, "nonfoil")
        assertNull(look.recipe); assertTrue(look.stamp); assertTrue(look.shines)
        assertEquals(card.getAsJsonObject("image_uris")["normal"].asString, look.image)
    }

    /** No stamp is drawn at a fixed place: the shader draws it only inside the box measured on the picture (u_stamp), through its mask. */
    @Test fun shaderHasNoFixedStamp() {
        assertFalse("the fixed oval at (.5, .925)", "float2(.5,.925)" in Foil.AGSL)
        assertTrue("u_stamp" in Foil.AGSL && "u_smask.eval" in Foil.AGSL)
    }

    /** u_tilt is already the light as -1..1 ((mx - .5) * 2), so the stamp's light is .5 + u_tilt * .5, the site's --mx/--my; the
     *  phone-tilt mapping (50% + tilt 40%) applied a second time kept the glint on the stamp at every angle. */
    @Test fun stampLightIsTheSitesLightPosition() {
        val line = Foil.AGSL.lines().first { "u_stamp.zw*u_size" in it }
        assertTrue(line, "P=clamp(float2(.5)+u_tilt*.5,0.,1.)" in line)
        assertFalse("u_tilt*.4" in line)
    }

    /** Same eligibility as the site's mtgStamped (finish-preview.js). */
    @Test fun eligibilityFollowsTheSite() {
        fun c(s: String) = JsonParser.parseString(s).asJsonObject
        assertTrue(CardData.holoStamp(c("""{"frame":"2015","rarity":"uncommon","security_stamp":"triangle"}""")))
        assertFalse(CardData.holoStamp(c("""{"frame":"2015","rarity":"uncommon","security_stamp":"oval"}""")))
        assertTrue(CardData.holoStamp(c("""{"frame":"2015","rarity":"rare","security_stamp":"oval","border_color":"borderless"}""")))
        assertFalse(CardData.holoStamp(c("""{"frame":"2015","rarity":"mythic","security_stamp":"arena"}""")))
        assertFalse(CardData.holoStamp(c("""{"frame":"2015","rarity":"rare","security_stamp":"oval","layout":"art_series"}""")))
        assertFalse(CardData.holoStamp(c("""{"frame":"2003","rarity":"rare","security_stamp":"oval"}""")))
        // No security_stamp in the record: the old rule (mtgHoloStamp).
        assertTrue(CardData.holoStamp(c("""{"frame":"2015","rarity":"rare"}""")))
        assertFalse(CardData.holoStamp(c("""{"frame":"2015","rarity":"rare","border_color":"borderless"}""")))
        assertFalse(CardData.holoStamp(c("""{"frame":"2015","rarity":"common"}""")))
    }
}
