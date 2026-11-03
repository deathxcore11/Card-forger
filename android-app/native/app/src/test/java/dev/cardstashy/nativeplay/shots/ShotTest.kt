package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
            Hero(listOf(HeroSlide(art("act1.jpg"), "Story · Act 1", "The Dawn of Dominaria", "0 of 8 battles", "Begin")), 0, {}, top) { a, size, pillTop ->
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

    private val sizes = listOf(360 to 780, 412 to 915, 600 to 960, 840 to 1000)

    @Test fun playSkin() { for ((w, h) in sizes) for (s in listOf(1f, 1.3f)) shot("skin-play", w, h, s) { PlaySkin() } }
    @Test fun collectionSkin() { for ((w, h) in listOf(412 to 915, 840 to 1000)) shot("skin-collection", w, h, 1f) { CollectionSkin() } }
}
