package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.background
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.ui.pageColumn
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.Hero
import dev.cardstashy.nativeplay.ui.HeroPage
import dev.cardstashy.nativeplay.ui.HeroSlide
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.PlayNav
import dev.cardstashy.nativeplay.ui.PlayTab
import dev.cardstashy.nativeplay.ui.PursePill
import dev.cardstashy.nativeplay.ui.SectionCard
import dev.cardstashy.nativeplay.ui.Site
import dev.cardstashy.nativeplay.ui.TopBarItems
import dev.cardstashy.nativeplay.ui.ValuePill
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The shared skin (mockup step 1) rendered on the JVM at the four widths, at 100 % and 130 % text.
 * Purse numbers are the ones in Randall's site screenshot (170 coins, seals 0/15/7/2, no packs, level 1).
 * Hero art is fetched into build/shot-art by the shots script; the shot shows the plain surface without it.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class ShotTest {
    private val artDir = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art")
    private fun art(name: String) = artDir.resolve(name).takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() }

    private val state = JsonParser.parseString("""{"wallet":{"coins":170,"xp":230,"seal_c":0,"seal_u":15,"seal_r":7,"seal_m":2},"packs":[],"config":{}}""").asJsonObject

    private fun shot(name: String, w: Int, h: Int, scale: Float, content: @Composable () -> Unit) {
        // Bundled art decodes off the main thread in the app; load it first so the frame is complete.
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "$name-${w}x$h-${(scale * 100).toInt()}.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, scale)) { content() }
        }
    }

    @Composable private fun PlaySkin() {
        val purse = PlayMath.purse(state)!!
        val top = @Composable { TopBarItems(Mode.PLAY, null, "Randall", unread = true, onSwitch = {}, onProfile = {}) }
        HeroPage(top = top, nav = { PlayNav(PlayTab.DECKS, {}) }, hero = {
            Hero(listOf(HeroSlide(art("act1.jpg"), "Story · Act 1", "The Dawn of Dominaria", "1993 to 1994. Urza and Mishra, and the first spells ever cast.", "Begin", battles = 8)), 0, {}, top) { a, size, pillTop ->
                PursePill(purse, PlayMath.mastery(state, purse.xp), a, size, pillTop)
            }
        }) {
            item { Sample("Today", "Quests") }
            item { Sample("Achievements", "All achievements") }
        }
    }

    @Composable private fun CollectionSkin() {
        val top = @Composable { TopBarItems(Mode.COLLECTION, null, "Randall", unread = false, onSwitch = {}, onProfile = {}) }
        val slides = listOf(HeroSlide(art("cotd.jpg"), "Card of the day", "Skyshroud Claim", "Secret Lair Drop · Rare", "View card"))
        HeroPage(top = top, hero = {
            Hero(slides, 0, {}, top) { a, size, pillTop -> ValuePill("$1,284.50", 2_318, 14, "+$12.40 since 27 Oct", a, size, pillTop) }
        }) {
            item { Sample("Your decks", "All decks") }
        }
    }

    /** A section card with the skin's type ramp, so the shot shows every size in use. */
    @Composable private fun Sample(title: String, action: String) = Column(Modifier.pageColumn()) {
        SectionCard(title, action) {
            Text("Finish 3 matches", style = Site.CardTitle)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("250 coins · 50 XP", style = Site.Meta); Text("0 / 3", style = Site.Meta, textAlign = TextAlign.End)
            }
            Text("This week: 0 of 3 weekly quests done", style = Site.Body)
        }
    }

    // ---- Play home, from the parity keeper's /api/progress/state fixture (the same one the web board renders).
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private val missing = java.util.TreeSet<String>()
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun homeArt(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        if (f == null) { missing += url; return null }
        return BitmapFactory.decodeFile(f.path)?.asImageBitmap()
    }

    @Composable private fun Home() {
        val ctx = RuntimeEnvironment.getApplication()
        val fixture = File("/mnt/project-files/design/native/parity/fixtures/progress-state.json").takeIf { it.exists() }
            ?: home.resolve("progress-state.json")
        val state = JsonParser.parseString(fixture.readText()).asJsonObject
        val rules = dev.cardstashy.nativeplay.play.PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        val top = @Composable { TopBarItems(Mode.PLAY, null, "Randall", unread = true, onSwitch = {}, onProfile = {}) }
        dev.cardstashy.nativeplay.ui.PlayHome(dev.cardstashy.nativeplay.ui.PlayHomeData(state, rules, dev.cardstashy.nativeplay.play.PlayMath.StoryHome(1, 0, false), "2026-11-03", ambient = AMBIENT),
            top = top, nav = { PlayNav(null, {}) })
    }

    private val AMBIENT = "https://cards.scryfall.io/art_crop/front/a/6/a6d2d79b-bef8-440f-a262-34349cf9fe5c.jpg?1783904262"

    @Test fun playHome() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        home.resolve("facts.json").takeIf { it.exists() }?.let { f ->
            dev.cardstashy.nativeplay.play.SetFacts.seed(JsonParser.parseString(f.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                k to dev.cardstashy.nativeplay.play.SetFacts.Set(o["name"].asString, o["icon"].asString, o["released"].asString, o["total"]?.asInt, o["art"].asString) })
        }
        for ((w, h) in listOf(390 to 844, 884 to 1104)) for (s in listOf(1f, 1.3f)) {
            if (w > 390 && s > 1f) continue
            tall("play-home", w, h, s) { Home() }
        }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    /** A long page: rendered at 4x the screen height so the whole scroll shows in one image. */
    private fun tall(name: String, w: Int, h: Int, scale: Float, content: @Composable () -> Unit) {
        RuntimeEnvironment.setQualifiers("w${w}dp-h${if (w < 600) h * 7 else h * 4}dp-xxhdpi")
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (c in listOf("left", "center", "right")) AssetImages.load(RuntimeEnvironment.getApplication(), "play/brand-$c.webp", maxWidth = 384)
            for (c in dev.cardstashy.nativeplay.ui.WRAPPERS.keys) AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-$c.webp", maxWidth = 600) }
        captureRoboImage(File(System.getProperty("shotsDir"), "$name-${w}x$h-${(scale * 100).toInt()}.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, scale)) { content() }
        }
    }

    /** Pack tiles: Randall's wrappers (hob, fra) beside the drawn fallback (dsk), full and mini. */
    @Test fun packWrappers() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        home.resolve("facts.json").takeIf { it.exists() }?.let { f ->
            dev.cardstashy.nativeplay.play.SetFacts.seed(JsonParser.parseString(f.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                k to dev.cardstashy.nativeplay.play.SetFacts.Set(o["name"].asString, o["icon"].asString, o["released"].asString, o["total"]?.asInt, o["art"].asString) })
        }
        for (sc in listOf(1f, 1.3f)) tall("packs", 390, 120, sc) {
            Column(Modifier.background(Site.Bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for (c in listOf("hob", "fra", "dsk")) dev.cardstashy.nativeplay.ui.Booster(c, null, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    for (c in listOf("hob", "fra", "dsk")) dev.cardstashy.nativeplay.ui.Booster(c, null, Modifier.size(width = 64.dp, height = 105.dp), mini = true)
                }
            }
        }
    }

    /** The animated mark, frame by frame across one 6 s shuffle with the foil light moving. */
    @Test fun brandFrames() {
        val m = dev.cardstashy.nativeplay.ui.Motion
        m.still = true
        kotlinx.coroutines.runBlocking { for (c in listOf("left", "center", "right")) AssetImages.load(RuntimeEnvironment.getApplication(), "play/brand-$c.webp", maxWidth = 384) }
        RuntimeEnvironment.setQualifiers("w200dp-h200dp-xxhdpi")
        for (i in 0 until 12) {
            m.cycle = i / 12f; m.light = .5f + i * .035f; m.breathe = (kotlin.math.sin(i / 12f * 2.5f * Math.PI) * .5 + .5).toFloat()
            captureRoboImage(File(System.getProperty("shotsDir"), "brand-%02d.png".format(i)).path) {
                androidx.compose.foundation.layout.Box(Modifier.size(200.dp).background(Site.Bg), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    dev.cardstashy.nativeplay.ui.BrandMark(160.dp)
                }
            }
        }
        m.cycle = .5f; m.light = .7f; m.breathe = .5f
    }

    private val sizes = listOf(360 to 780, 412 to 915, 600 to 960, 840 to 1000)

    @Test fun playSkin() { dev.cardstashy.nativeplay.ui.Motion.still = true; for ((w, h) in sizes) for (s in listOf(1f, 1.3f)) shot("skin-play-placeholder-rows", w, h, s) { PlaySkin() } }
    @Test fun collectionSkin() { dev.cardstashy.nativeplay.ui.Motion.still = true; for ((w, h) in listOf(412 to 915, 840 to 1000)) shot("skin-collection-placeholder-rows", w, h, 1f) { CollectionSkin() } }
}
