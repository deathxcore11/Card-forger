package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.FocusCard
import dev.cardstashy.nativeplay.ui.FocusedCardView
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.HandFan
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.MatchBottom
import dev.cardstashy.nativeplay.ui.PadAct
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Dual-screen handhelds (specs/dual-screen-native.md): the bottom screen at the AYN Thor's 1240 × 1080 and the Retroid Pocket
 * Duo's 1280 × 960 (hand, stack, a Collection card), and the top screen at 1920 × 1080 with the bottom screen off and on.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class DualScreenShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "dual/$name.png").path

    @After fun off() { DualScreen.pretend(null) }

    @Test fun bottomScreens() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val main = state("main"); val crowded = state("crowded")
        val hand = main.me.hand.ifEmpty { main.me.battlefield.filter { !it.isLand }.take(5) }
        val bg = Brush.verticalGradient(listOf(Color(0xFF15171D), Color(0xFF0B0C10)))
        for ((size, q) in listOf("thor-1240x1080" to "w620dp-h540dp-xhdpi", "duo-1280x960" to "w640dp-h480dp-xhdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            captureRoboImage(shot("bottom-hand-$size")) {
                Box(Modifier.fillMaxSize().background(bg)) {
                    MatchBottom(main, hand, hand.getOrNull(1), PadAct("Pass") {}, { w -> HandFan(hand, w, Modifier.fillMaxWidth(), raised = hand.getOrNull(1)?.id, angleDeg = 1.2f) }, {})
                }
            }
            captureRoboImage(shot("bottom-stack-$size")) {
                Box(Modifier.fillMaxSize().background(bg)) {
                    MatchBottom(crowded, crowded.me.hand, null, PadAct("Resolve") {}, { w -> HandFan(crowded.me.hand, w, Modifier.fillMaxWidth()) }, {})
                }
            }
            val c = hand.first()
            captureRoboImage(shot("bottom-collection-$size")) {
                Box(Modifier.fillMaxSize().background(bg)) {
                    FocusedCardView(FocusCard(c.name, null, c.type, c.text, owned = "You have 2", price = "$1.24",
                        actions = listOf(PadAct("Got one") {}, PadAct("Open") {})))
                }
            }
        }
    }

    /** Wave 2: the Shop's cases (the store, a pack in focus) and the pack's binder page while it opens. */
    @Test fun shopAndPackBottoms() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
        val st = com.google.gson.JsonParser.parseString((File("/mnt/project-files/design/native/parity/fixtures/progress-state.json").takeIf { it.exists() } ?: home.resolve("progress-state.json")).readText()).asJsonObject
        val out = com.google.gson.JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open-fra.json")!!.readText()).asJsonObject
        val pack = dev.cardstashy.nativeplay.ui.packResult(out, "Reality Fracture")
        kotlinx.coroutines.runBlocking { dev.cardstashy.nativeplay.ui.AssetImages.load(RuntimeEnvironment.getApplication(), "play/mtg-back.webp", maxWidth = 400) }
        val packArt = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/pack")
        dev.cardstashy.nativeplay.ui.homeArt = { u -> packArt.resolve(java.security.MessageDigest.getInstance("SHA-1").digest(u.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg")
            .takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } ?: u }
        val bg = Brush.verticalGradient(listOf(Color(0xFF15171D), Color(0xFF0B0C10)))
        for ((size, q) in listOf("thor-1240x1080" to "w620dp-h540dp-xhdpi", "duo-1280x960" to "w640dp-h480dp-xhdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            captureRoboImage(shot("bottom-shop-$size")) { Box(Modifier.fillMaxSize().background(bg)) { dev.cardstashy.nativeplay.ui.ShopBottom(st, null, false, {}, {}, {}, {}) } }
            captureRoboImage(shot("bottom-shop-pack-$size")) { Box(Modifier.fillMaxSize().background(bg)) { dev.cardstashy.nativeplay.ui.ShopBottom(st, "dsk", false, {}, {}, {}, {}) } }
            captureRoboImage(shot("bottom-pack-$size")) { Box(Modifier.fillMaxSize().background(bg)) {
                dev.cardstashy.nativeplay.ui.PackBinderCase(pack, listOf(0, 1, 2, 3, 4, 5), 5, dealt = true, allOpen = false, busy = false, onShow = {}, onRevealAll = {}, onNext = null) } }
        }
    }

    @Test fun storyBottoms() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val ctx = RuntimeEnvironment.getApplication()
        val root = File(System.getProperty("shotsDir")!!).parentFile
        val dirs = listOf("home", "pack", "story").map { root.resolve("app/build/shot-art/$it") }
        val missed = File(root, "app/build/shot-art/story-missed.txt").apply { parentFile.mkdirs(); writeText("") }
        dev.cardstashy.nativeplay.ui.homeArt = { u -> val h = java.security.MessageDigest.getInstance("SHA-1").digest(u.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg"
            dirs.map { it.resolve(h) }.firstOrNull { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } ?: u.also { missed.appendText("$h $it\n") } }
        val rules = dev.cardstashy.nativeplay.play.PlayRules.load(ctx)
        val a = rules.acts.first { it.act == 2 }
        val data = dev.cardstashy.nativeplay.ui.StoryActs.load(ctx, 2)
        val p = dev.cardstashy.nativeplay.play.StoryLogic.Progress(battles = mapOf("a1b8" to setOf("clear"), "a2b1" to setOf("clear", "loaner", "own", "villain"), "a2b2" to setOf("clear", "own"), "a2b3" to setOf("clear")), acts = setOf(1))
        val bg = Brush.verticalGradient(listOf(Color(0xFF15171D), Color(0xFF0B0C10)))
        val cta = dev.cardstashy.nativeplay.ui.CaseButton("A", "Duel", gold = true) {}
        for ((size, q) in listOf("thor-1240x1080" to "w620dp-h540dp-xhdpi", "duo-1280x960" to "w640dp-h480dp-xhdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            captureRoboImage(shot("bottom-story-act-$size")) { Box(Modifier.fillMaxSize().background(bg)) { dev.cardstashy.nativeplay.ui.StoryBottom(a, data, p, null, true, cta, {}, {}) } }
            captureRoboImage(shot("bottom-story-battle-$size")) { Box(Modifier.fillMaxSize().background(bg)) { dev.cardstashy.nativeplay.ui.StoryBottom(a, data, p, "battle:a2b4", true, cta, {}, {}) } }
        }
    }

    @Test fun deckBottoms() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val root = File(System.getProperty("shotsDir")!!).parentFile
        val dirs = listOf("home", "pack", "story", "decks").map { root.resolve("app/build/shot-art/$it") }
        val missed = File(root, "app/build/shot-art/decks-missed.txt").apply { parentFile.mkdirs(); writeText("") }
        dev.cardstashy.nativeplay.ui.homeArt = { u -> val h = java.security.MessageDigest.getInstance("SHA-1").digest(u.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg"
            dirs.map { it.resolve(h) }.firstOrNull { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } ?: u.also { missed.appendText("$h $it\n") } }
        val st = com.google.gson.JsonParser.parseString((File("/mnt/project-files/design/native/parity/fixtures/progress-state.json").takeIf { it.exists() } ?: root.resolve("app/build/shot-art/home/progress-state.json")).readText()).asJsonObject
        val decks = st.getAsJsonArray("decks").mapNotNull { it as? com.google.gson.JsonObject }
        val owned = dev.cardstashy.nativeplay.play.Decks.ownedByName(st)
        val bg = Brush.verticalGradient(listOf(Color(0xFF15171D), Color(0xFF0B0C10)))
        for ((size, q) in listOf("thor-1240x1080" to "w620dp-h540dp-xhdpi", "duo-1280x960" to "w640dp-h480dp-xhdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            captureRoboImage(shot("bottom-decks-$size")) { Box(Modifier.fillMaxSize().background(bg)) { dev.cardstashy.nativeplay.ui.DecksShelfCase(decks, owned, {}, {}) } }
            captureRoboImage(shot("bottom-decks-deck-$size")) { Box(Modifier.fillMaxSize().background(bg)) {
                dev.cardstashy.nativeplay.ui.DeckBoxCase(decks.first(), owned, emptyList(), listOf(dev.cardstashy.nativeplay.ui.CaseButton("A", "Open deck", gold = true) {}, dev.cardstashy.nativeplay.ui.CaseButton(null, "Menu") {})) } }
        }
    }

    @Test fun topScreen() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        RuntimeEnvironment.setQualifiers("w960dp-h540dp-land-xhdpi")
        val st = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}").paired(state("main"))
        for (on in listOf(false, true)) {
            DualScreen.pretend(if (on) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            captureRoboImage(shot("top-1920x1080-dual-${if (on) "on" else "off"}")) {
                val anchors = remember { Anchors() }
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                    }
                }
            }
        }
    }
}
