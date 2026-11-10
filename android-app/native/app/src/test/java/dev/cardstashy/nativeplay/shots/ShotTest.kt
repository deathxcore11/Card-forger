package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxSize
import dev.cardstashy.nativeplay.ui.cardLean
import androidx.compose.foundation.background
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.ui.padRoot
import dev.cardstashy.nativeplay.ui.PadPromptBar
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
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (c in dev.cardstashy.nativeplay.ui.WRAPPERS.keys) AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-$c.webp", maxWidth = 600) }
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
    /**
     * A shot taken a few frames after the content first draws: a page hands its bottom view over in an effect, so the bottom
     * screen only has it from the second frame (fix list A1: the one-frame shot showed the empty default).
     */
    private fun settled(path: String, content: @Composable () -> Unit) {
        val app = RuntimeEnvironment.getApplication()
        org.robolectric.Shadows.shadowOf(app.packageManager).addActivityIfNotPresent(android.content.ComponentName(app, androidx.activity.ComponentActivity::class.java))
        androidx.test.core.app.ActivityScenario.launch(androidx.activity.ComponentActivity::class.java).use { sc ->
            sc.onActivity { a -> a.setContentView(androidx.compose.ui.platform.ComposeView(a).apply { setContent { content() } }) }
            repeat(8) { org.robolectric.shadows.ShadowLooper.idleMainLooper(50, java.util.concurrent.TimeUnit.MILLISECONDS) }
            sc.onActivity { a -> a.findViewById<android.view.View>(android.R.id.content).captureRoboImage(path) }
        }
    }

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
        // Sideways phone or handheld: the screen as held, then the whole page in that layout.
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("play-home-844x390-screen", 844, 390, 1f) { Home() }; tall("play-home", 844, 390, 1f) { Home() } }
        finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    /** Play before sign-in (Portal 2 report, 4 Nov): held sideways, and upright on a phone. */
    @Test fun signedOutHome() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        val rules = dev.cardstashy.nativeplay.play.PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        val page = @Composable { dev.cardstashy.nativeplay.ui.SignedOutHome(rules, top = { TopBarItems(Mode.PLAY, null, null, unread = false, onSwitch = {}, onProfile = {}) }, onQuickPlay = {}, onSignIn = {}) }
        shot("play-signed-out-390x844", 390, 844, 1f) { page() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("play-signed-out-844x390", 844, 390, 1f) { page() }; shot("play-signed-out-960x540", 960, 540, 1f) { page() } }
        finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
    }

    /** The app's update prompt (Randall 4 Nov), over Play home: each step, upright and held sideways. */
    @Test fun updatePrompt() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        val notes = listOf("Story" to "Acts 29 to 31 are playable.", "Combat" to "New block, clash and face-hit effects and sounds.",
            "Handhelds" to "Matches run on Android 8 to 13 devices like the Portal 2.", "Fix" to "Your spell\u2019s card closes once it resolves.")
        val steps = listOf(
            "offer" to dev.cardstashy.nativeplay.ui.UpdateUi.Offer("0.4.10", 74_063_483, notes),
            "downloading" to dev.cardstashy.nativeplay.ui.UpdateUi.Downloading("0.4.10", 39_800_000, 74_063_483),
            "allow" to dev.cardstashy.nativeplay.ui.UpdateUi.Allow("0.4.10"),
            "ready" to dev.cardstashy.nativeplay.ui.UpdateUi.Ready("0.4.10"),
            "failed" to dev.cardstashy.nativeplay.ui.UpdateUi.Failed("0.4.10", "Check your connection and try again. What you already downloaded is kept."))
        val page = @Composable { ui: dev.cardstashy.nativeplay.ui.UpdateUi -> androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
            Home(); dev.cardstashy.nativeplay.ui.UpdatePrompt(ui, {}, {}, {}, {}, {}, {}) } }
        for ((n, ui) in steps) shot("update-$n", 390, 844, 1f) { page(ui) }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { for ((n, ui) in steps.filter { it.first in setOf("offer", "allow") }) shot("update-$n", 844, 390, 1f) { page(ui) } }
        finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
    }

    /**
     * Collection Home from the site's own Home code (CollectionEngineTest.shotFixture: a sample collection, today's live Card of
     * the Day, Meta and News): upright, unfolded and sideways, each as the first screen and as the whole page.
     */
    @Test fun collectionHome() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        val fx = home.resolve("collection-home.json")
        org.junit.Assume.assumeTrue("run CollectionEngineTest.shotFixture first", fx.exists())
        val m = dev.cardstashy.nativeplay.ui.CollectionHomeModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
        val hints = home.resolve("collection-hints.json").takeIf { it.exists() }?.let { dev.cardstashy.nativeplay.ui.CollectionHomeModel.hints(JsonParser.parseString(it.readText()).asJsonObject) }
        val page = @Composable {
            dev.cardstashy.nativeplay.ui.CollectionHome(m, hints, top = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) },
                nav = { v -> dev.cardstashy.nativeplay.ui.CollectionNav(dev.cardstashy.nativeplay.ui.CollectionTab.HOME, vertical = v, scan = !v) {} })
        }
        shot("collection-home", 390, 844, 1f) { page() }
        shot("collection-home-page", 390, 2300, 1f) { page() }
        shot("collection-home", 884, 1104, 1f) { page() }
        shot("collection-home-page", 884, 1700, 1f) { page() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("collection-home", 844, 390, 1f) { page() } } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /**
     * Dual-screen handhelds (Randall 9 Nov): Play Home and Collection Home on the top screen (1920 × 1080) with a controller in hand,
     * with the bottom screen off (prompt bar on top) and on (prompt bar and the bottom view below), and the bottom screen itself at
     * the AYN Thor's 1240 × 1080 and the Retroid Pocket Duo's 1280 × 960.
     */
    @Test fun handheldHomes() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        home.resolve("facts.json").takeIf { it.exists() }?.let { f ->
            dev.cardstashy.nativeplay.play.SetFacts.seed(JsonParser.parseString(f.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                k to dev.cardstashy.nativeplay.play.SetFacts.Set(o["name"].asString, o["icon"].asString, o["released"].asString, o["total"]?.asInt, o["art"].asString) })
        }
        val fx = home.resolve("collection-home.json")
        val coll = fx.takeIf { it.exists() }?.let { dev.cardstashy.nativeplay.ui.CollectionHomeModel.parse(JsonParser.parseString(it.readText()).asJsonObject) }
        val hints = home.resolve("collection-hints.json").takeIf { it.exists() }?.let { dev.cardstashy.nativeplay.ui.CollectionHomeModel.hints(JsonParser.parseString(it.readText()).asJsonObject) }
        val pages = listOfNotNull("play" to @Composable { Home() }, coll?.let { m -> "collection" to @Composable {
            dev.cardstashy.nativeplay.ui.CollectionHome(m, hints, top = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) },
                nav = { v -> dev.cardstashy.nativeplay.ui.CollectionNav(dev.cardstashy.nativeplay.ui.CollectionTab.HOME, vertical = v, scan = !v) {} }) } })
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256) }
        dev.cardstashy.nativeplay.ui.Pad.used()
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        dev.cardstashy.nativeplay.ui.StoryActs.load(RuntimeEnvironment.getApplication(), 1)
        try {
            for ((name, page) in pages) for (dual in listOf(false, true)) {
                dev.cardstashy.nativeplay.ui.DualScreen.pretend(if (dual) dev.cardstashy.nativeplay.ui.DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
                RuntimeEnvironment.setQualifiers("w960dp-h540dp-land-xhdpi")
                captureRoboImage(File(System.getProperty("shotsDir"), "handheld/$name-home-top-1920x1080-dual-${if (dual) "on" else "off"}.png").path) {
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().padRoot()) { page(); PadPromptBar() }
                }
                val lenses = if (name == "play") listOf(null, "story", "deck:11111111-1111-4111-8111-111111111111", "shop:dsk") else listOf(null, "daily")
                if (dual) for (lens in lenses) for ((size, q) in listOf("thor-1240x1080" to "w620dp-h540dp-xhdpi", "duo-1280x960" to "w640dp-h480dp-xhdpi")) {
                    RuntimeEnvironment.setQualifiers(q)
                    dev.cardstashy.nativeplay.ui.LensHost.preset = lens
                    val tag = lens?.substringBefore(':')?.let { "-$it" } ?: ""
                    settled(File(System.getProperty("shotsDir"), "handheld/$name-home-bottom$tag-$size.png").path) {
                        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().padRoot()) {
                            // The top screen's prompts feed the bottom bar; draw the page off to the side so its screen acts register.
                            androidx.compose.foundation.layout.Box(Modifier.size(1.dp)) { page() }
                            dev.cardstashy.nativeplay.ui.BottomRoot()
                        }
                    }
                }
            }
        } finally { dev.cardstashy.nativeplay.ui.LensHost.preset = null; dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null; dev.cardstashy.nativeplay.ui.DualScreen.pretend(null); dev.cardstashy.nativeplay.ui.Pad.forget() }
    }

    /** A controller on a handheld: the gold focus ring on Quick Play and the A/B hint (Pad connected). */
    @Test fun padFocus() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        dev.cardstashy.nativeplay.ui.Pad.used()
        try {
            shot("play-home-pad", 844, 390, 1f) {
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.foundation.LocalIndication provides dev.cardstashy.nativeplay.ui.PadFocus) {
                    val modes = androidx.compose.ui.platform.LocalInputModeManager.current
                    val focus = androidx.compose.ui.platform.LocalFocusManager.current
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) { Home(); with(dev.cardstashy.nativeplay.ui.PadHintHostScope) { this@Box.hint() } }
                    androidx.compose.runtime.LaunchedEffect(Unit) {
                        modes.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard)
                        kotlinx.coroutines.delay(50)
                        repeat(System.getProperty("padSteps")?.toInt() ?: 8) { focus.moveFocus(androidx.compose.ui.focus.FocusDirection.Next) }
                    }
                }
            }
        } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
    }

    /** settings-theme.js: Play home and Trunk in each colour mode, against site-home-<theme>.png / site-trunk-cards-<theme>.png. */
    @Test fun themes() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        home.resolve("facts.json").takeIf { it.exists() }?.let { f ->
            dev.cardstashy.nativeplay.play.SetFacts.seed(JsonParser.parseString(f.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                k to dev.cardstashy.nativeplay.play.SetFacts.Set(o["name"].asString, o["icon"].asString, o["released"].asString, o["total"]?.asInt, o["art"].asString) })
        }
        try {
            for (t in listOf("light", "aura", "dark")) {
                dev.cardstashy.nativeplay.ui.AppSettings.applyTheme(t)
                tall("theme-$t-play-home", 390, 844, 1f) { Home() }
            }
            trunkSetup()
            for (t in listOf("light", "aura")) {
                dev.cardstashy.nativeplay.ui.AppSettings.applyTheme(t)
                RuntimeEnvironment.setQualifiers("w390dp-h${844 * 3}dp-xxhdpi")
                captureRoboImage(File(System.getProperty("shotsDir"), "theme-$t-trunk-cards.png").path) {
                    dev.cardstashy.nativeplay.ui.TrunkScreen(trunkState, {}, {}, {}) { PlayNav(PlayTab.TRUNK, {}) }
                }
            }
        } finally { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("dark") }
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
    /** Randall 3 Nov 21:37Z: the eleven painted wrappers on one template, at shelf size and at mini size, with their set names. */
    @Test fun newWrappers() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        val sets = listOf("dft" to "Aetherdrift", "ecl" to "Lorwyn Eclipsed", "eoe" to "Edge of Eternities", "fin" to "Final Fantasy", "hob" to "The Hobbit",
            "msh" to "Marvel Super Heroes", "sos" to "Secrets of Strixhaven", "spm" to "Marvel's Spider-Man", "tdm" to "Tarkir: Dragonstorm",
            "tla" to "Avatar: The Last Airbender", "tmt" to "Teenage Mutant Ninja Turtles", "fra" to "Reality Fracture")
        kotlinx.coroutines.runBlocking { for ((c, _) in sets) dev.cardstashy.nativeplay.ui.wrapperFor(c)?.let { AssetImages.load(RuntimeEnvironment.getApplication(), it.first, maxWidth = 600) } }
        tall("wrappers-new", 390, 120, 1f) {
            Column(Modifier.background(Site.Bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                for (row in sets.chunked(3)) Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for ((c, n) in row) dev.cardstashy.nativeplay.ui.Booster(c, n, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    for ((c, n) in sets.take(5)) dev.cardstashy.nativeplay.ui.Booster(c, n, Modifier.size(width = 64.dp, height = 105.dp), mini = true)
                }
            }
        }
    }

    @Test fun packWrappers() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        home.resolve("facts.json").takeIf { it.exists() }?.let { f ->
            dev.cardstashy.nativeplay.play.SetFacts.seed(JsonParser.parseString(f.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                k to dev.cardstashy.nativeplay.play.SetFacts.Set(o["name"].asString, o["icon"].asString, o["released"].asString, o["total"]?.asInt, o["art"].asString) })
        }
        val codes = listOf("hob", "fra", "msh", "isd", "khm", "ltr", "fdn", "mh2", "dmu")
        kotlinx.coroutines.runBlocking { for (c in codes) dev.cardstashy.nativeplay.ui.wrapperFor(c)?.let { AssetImages.load(RuntimeEnvironment.getApplication(), it.first, maxWidth = 600) } }
        for (sc in listOf(1f, 1.3f)) tall("packs", 390, 120, sc) {
            Column(Modifier.background(Site.Bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                for (row in codes.chunked(3)) Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for (c in row) dev.cardstashy.nativeplay.ui.Booster(c, null, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    for (c in listOf("hob", "fra", "dsk")) dev.cardstashy.nativeplay.ui.Booster(c, null, Modifier.size(width = 64.dp, height = 105.dp), mini = true)
                }
            }
        }
    }

    /** Pack opening (pack-preview.js variant 'play'): sealed, dealt face down, a mythic up, all revealed. */
    /** The site-parity states for the preview: the same ten Reality Fracture cards the site harness opens (scratchpad site/packs.mjs). */
    @Test fun packOpenFra() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        val out = JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open-fra.json")!!.readText()).asJsonObject
        val pack = dev.cardstashy.nativeplay.ui.packResult(out, "Reality Fracture")
        val n = pack.pulls.size
        val states = listOf(
            Triple("0-loading", dev.cardstashy.nativeplay.ui.PackStage.SEALED, Pair(emptySet<Int>(), 0)),
            Triple("1-sealed", dev.cardstashy.nativeplay.ui.PackStage.SEALED, Pair(emptySet<Int>(), 0)),
            Triple("3-dealt", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair(emptySet<Int>(), 0)),
            Triple("4-first-card", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair(setOf(0), 0)),
            Triple("5-all", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n).toSet(), n - 1)),
        )
        kotlinx.coroutines.runBlocking { AssetImages.load(RuntimeEnvironment.getApplication(), "play/mtg-back.webp", maxWidth = 400)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-fra.webp", maxWidth = 600) }
        RuntimeEnvironment.setQualifiers("w390dp-h844dp-xxhdpi")
        for ((name, stage, rv) in states) captureRoboImage(File(System.getProperty("shotsDir"), "fra-open-$name.png").path) {
            dev.cardstashy.nativeplay.ui.PackOpening(pack, onNext = null, onClose = {}, initial = stage, revealedAtStart = rv.first, focusAtStart = rv.second)
        }
        // A tap on a revealed card opens the Play card view over the pack (pack-preview.js inspect → onDetails).
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        captureRoboImage(File(System.getProperty("shotsDir"), "fra-open-6-card-view.png").path) {
            dev.cardstashy.nativeplay.ui.PackOpening(pack, onNext = null, onClose = {}, initial = dev.cardstashy.nativeplay.ui.PackStage.DEALT, revealedAtStart = (0 until n).toSet(), focusAtStart = n - 1, inspectAtStart = n - 1)
        }
    }

    @Test fun packOpen() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        home.resolve("facts.json").takeIf { it.exists() }?.let { f ->
            dev.cardstashy.nativeplay.play.SetFacts.seed(JsonParser.parseString(f.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                k to dev.cardstashy.nativeplay.play.SetFacts.Set(o["name"].asString, o["icon"].asString, o["released"].asString, o["total"]?.asInt, o["art"].asString) })
        }
        val out = JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open.json")!!.readText()).asJsonObject
        val pack = dev.cardstashy.nativeplay.ui.packResult(out, "The Hobbit")
        val n = pack.pulls.size

        val states = listOf(
            Triple("0-loading", dev.cardstashy.nativeplay.ui.PackStage.SEALED, Pair(emptySet<Int>(), 0)),
            Triple("1-sealed", dev.cardstashy.nativeplay.ui.PackStage.SEALED, Pair(emptySet<Int>(), 0)),
            Triple("2-dealt", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair(setOf(0, 1, 2), 10)),
            Triple("3-mythic", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n - 1).toSet() + (n - 1), n - 1)),
            Triple("4-foil", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n).toSet(), 9)),
        )
        for ((w, h) in listOf(390 to 844, 884 to 1104)) for ((name, stage, rv) in states) {
            if (w > 390 && name != "3-mythic" && name != "0-loading") continue
            kotlinx.coroutines.runBlocking { AssetImages.load(RuntimeEnvironment.getApplication(), "play/mtg-back.webp", maxWidth = 400)
                for (c in dev.cardstashy.nativeplay.ui.WRAPPERS.keys) AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-$c.webp", maxWidth = 600) }
            RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
            captureRoboImage(File(System.getProperty("shotsDir"), "pack-open-$name-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.PackOpening(if (name == "0-loading") dev.cardstashy.nativeplay.ui.loadingPack(pack.set, pack.name) else pack, onNext = { null }, onClose = {}, initial = stage, revealedAtStart = rv.first, focusAtStart = rv.second)
            }
        }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    /** The simulator's Yu-Gi-Oh! and Pokémon packs (fixtures from scratchpad cardpage/tpick2.cjs: Beyond the Brave, Surging Sparks). */
    @Test fun simTcgPackOpen() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        kotlinx.coroutines.runBlocking { for (l in listOf("left", "center", "right")) AssetImages.load(RuntimeEnvironment.getApplication(), "play/brand-$l.webp", maxWidth = 384)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-template.webp", maxWidth = 600); AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-window.png") }
        for (g in listOf("ygo", "ptcg")) {
            val f = home.resolve("collection-pack-$g.json")
            if (!f.exists()) continue
            val pack = dev.cardstashy.nativeplay.ui.simPack(JsonParser.parseString(f.readText()).asJsonObject)
            val n = pack.pulls.size
            val hit = pack.pulls.indices.maxBy { pack.pulls[it].level * 1000 + (pack.pulls[it].sim?.rank ?: 0) * 10 + (pack.pulls[it].sim?.worth ?: 0.0) }
            val foil = pack.pulls.indices.firstOrNull { pack.pulls[it].foil && it != hit } ?: hit
            val states = listOf(
                Triple("1-sealed", dev.cardstashy.nativeplay.ui.PackStage.SEALED, Pair(emptySet<Int>(), 0)),
                Triple("2-dealt", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair(setOf(0, 1, 2), 3)),
                Triple("4-done", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n).toSet(), hit)),
                Triple("5-foil", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n).toSet(), foil)),
            )
            for ((w, h) in listOf(390 to 844, 884 to 1104)) for ((name, stage, rv) in states) {
                if (w > 390 && name != "4-done") continue
                RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
                captureRoboImage(File(System.getProperty("shotsDir"), "sim-pack-$g-$name-${w}x$h.png").path) {
                    dev.cardstashy.nativeplay.ui.PackOpening(pack, onNext = { null }, onClose = {}, initial = stage, revealedAtStart = rv.first, focusAtStart = rv.second, onInspect = { _, _ -> })
                }
            }
        }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /** The set page's Open Pack simulator: a pack the engine drew from Duskmourn's real booster sheets (scratchpad tpick.cjs). */
    @Test fun simPackOpen() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        val f = home.resolve("collection-pack-mtg.json")
        org.junit.Assume.assumeTrue(f.exists())
        val pack = dev.cardstashy.nativeplay.ui.simPack(JsonParser.parseString(f.readText()).asJsonObject)
        val n = pack.pulls.size
        val hit = pack.pulls.indices.maxBy { pack.pulls[it].level * 1000 + (pack.pulls[it].sim?.worth ?: 0.0) }
        val foil = pack.pulls.indexOfFirst { it.foil }
        val states = listOf(
            Triple("1-sealed", dev.cardstashy.nativeplay.ui.PackStage.SEALED, Pair(emptySet<Int>(), 0)),
            Triple("2-dealt", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair(setOf(0, 1, 2), 3)),
            Triple("3-hit", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n).toSet() - hit, hit)),
            Triple("4-done", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n).toSet(), hit)),
            Triple("5-foil", dev.cardstashy.nativeplay.ui.PackStage.DEALT, Pair((0 until n).toSet(), foil)),
        )
        kotlinx.coroutines.runBlocking { AssetImages.load(RuntimeEnvironment.getApplication(), "play/mtg-back.webp", maxWidth = 400)
            for (l in listOf("left", "center", "right")) AssetImages.load(RuntimeEnvironment.getApplication(), "play/brand-$l.webp", maxWidth = 384)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-template.webp", maxWidth = 600); AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-window.png") }
        for ((w, h) in listOf(390 to 844, 884 to 1104)) for ((name, stage, rv) in states) {
            if (w > 390 && name != "4-done" && name != "1-sealed") continue
            RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
            captureRoboImage(File(System.getProperty("shotsDir"), "sim-pack-$name-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.PackOpening(pack, onNext = { null }, onClose = {}, initial = stage, revealedAtStart = rv.first, focusAtStart = rv.second, onInspect = { _, _ -> }, onWishlist = { true })
            }
        }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
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


    // ---- Trunk and card view, on real Scryfall printings (trunk-cards.json) as Play cards.
    private val trunkCards by lazy { JsonParser.parseString(javaClass.classLoader!!.getResource("trunk-cards.json")!!.readText()).asJsonArray.map { it.asJsonObject } }
    private val trunkState by lazy {
        val counts = mapOf("Ragavan, Nimble Pilferer" to (3 to 1), "Sol Ring" to (4 to 2), "Sheoldred, the Apocalypse" to (1 to 1), "Strip Mine" to (1 to 1), "Temple of Mystery" to (2 to 1),
            "Delver of Secrets // Insectile Aberration" to (4 to 0), "Llanowar Elves" to (2 to 1), "Shivan Dragon" to (1 to 0), "Swords to Plowshares" to (3 to 0), "Island" to (4 to 0))
        val cards = com.google.gson.JsonArray()
        trunkCards.forEachIndexed { i, c -> val (n, h) = counts[c["name"].asString] ?: (1 to 0)
            val img = c.getAsJsonObject("image_uris")?.get("normal")?.asString ?: c.getAsJsonArray("card_faces")[0].asJsonObject.getAsJsonObject("image_uris")["normal"].asString
            cards.add(JsonParser.parseString("""{"o":"${c["oracle_id"]?.asString ?: c.getAsJsonArray("card_faces")[0].asJsonObject["oracle_id"].asString}","n":${com.google.gson.JsonPrimitive(c["name"].asString)},"r":"${c["rarity"].asString}","c":$n,"h":$h,"s":["${c["set"].asString}"],
                "p":{"id":"${c["id"].asString}","set":"${c["set"].asString}","image":"$img","number":"${c["collector_number"].asString}"},"a":"2026-11-0${1 + i % 3}T0$i:00:00Z"}""")) }
        JsonParser.parseString("""{"wallet":{"coins":1250,"xp":2750,"seal_c":6,"seal_u":3,"seal_r":2,"seal_m":1},"packs":[],"config":{"holoSeals":2},
            "decks":[{"id":"d1","name":"Izzet Tempo","format":"Modern","cards":[{"name":"Ragavan, Nimble Pilferer","qty":2}]},{"id":"d2","name":"Elves","format":"Pioneer","cards":[]}],
            "shop":[{"code":"mh2","name":"Modern Horizons 2","released":"2021-06-18","format":"modern"},{"code":"dmu","name":"Dominaria United","released":"2022-09-09","format":"standard"},{"code":"fdn","name":"Foundations","released":"2024-11-15","format":"standard"}]}""").asJsonObject.apply { add("cards", cards) }
    }

    private fun trunkSetup() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::homeArt
        dev.cardstashy.nativeplay.play.CardFacts.seed(trunkCards)
        home.resolve("facts.json").takeIf { it.exists() }?.let { f ->
            dev.cardstashy.nativeplay.play.SetFacts.seed(JsonParser.parseString(f.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                k to dev.cardstashy.nativeplay.play.SetFacts.Set(o["name"].asString, o["icon"].asString, o["released"].asString, o["total"]?.asInt, o["art"].asString) })
        }
    }

    @Test fun trunk() {
        trunkSetup()
        for ((w, h) in listOf(390 to 844, 884 to 1104, 844 to 390)) {
            dev.cardstashy.nativeplay.ui.HomeTest.forceShort = if (h < 500) true else null
            RuntimeEnvironment.setQualifiers("w${w}dp-h${h * 3}dp-xxhdpi")
            captureRoboImage(File(System.getProperty("shotsDir"), "trunk-cards-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.TrunkScreen(trunkState, {}, {}, {}) { PlayNav(PlayTab.TRUNK, {}) }
            }
            // The Sets side of the Cards | Sets switch (Randall 8 Nov): Keep collecting rings, then every set by year.
            captureRoboImage(File(System.getProperty("shotsDir"), "trunk-sets-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.TrunkScreen(trunkState, {}, {}, {}, startSet = "") { PlayNav(PlayTab.TRUNK, {}) }
            }
        }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    @Test fun decks() {
        trunkSetup()
        fun row(name: String, qty: Int, board: String? = null) = trunkCards.first { it["name"].asString == name }.let {
            dev.cardstashy.nativeplay.play.Decks.Row(name, qty, board, it["set"].asString, it["collector_number"].asString, it["id"].asString, it["rarity"].asString) }
        val state = trunkState.deepCopy().apply {
            add("decks", JsonParser.parseString("""[
                {"id":"d1","name":"Izzet Tempo","format":"Modern","cards":[{"name":"Ragavan, Nimble Pilferer","qty":4,"id":"${row("Ragavan, Nimble Pilferer", 1).id}"},{"name":"Delver of Secrets // Insectile Aberration","qty":4},{"name":"Island","qty":20},{"name":"Swords to Plowshares","qty":4,"board":"side"}]},
                {"id":"d2","name":"Elves","format":"Pioneer","cards":[{"name":"Llanowar Elves","qty":4,"id":"${row("Llanowar Elves", 1).id}"},{"name":"Forest","qty":56}]},
                {"id":"d3","name":"Big Red","format":"","cards":[{"name":"Shivan Dragon","qty":2,"id":"${row("Shivan Dragon", 1).id}"},{"name":"Mountain","qty":58}]}]""").asJsonArray) }
        val index = listOf(dev.cardstashy.nativeplay.play.Decks.PreconEntry("Dimir Rogues", "CC1", "Challenger Deck", "2021-02-26", "DimirRogues_CC1.json"),
            dev.cardstashy.nativeplay.play.Decks.PreconEntry("Elves vs. Goblins: Elves", "EVG", "Duel Deck", "2007-11-16", "Elves_EVG.json"),
            dev.cardstashy.nativeplay.play.Decks.PreconEntry("Arena Starter Kit", "ANA", "Arena Starter Kit", "2018-07-14", "ArenaStarterKit_ANA.json"))
        val rows = listOf(row("Ragavan, Nimble Pilferer", 4), row("Sheoldred, the Apocalypse", 2), row("Strip Mine", 4), row("Swords to Plowshares", 4), row("Island", 22), row("Shivan Dragon", 2, "side"))
        val pasted = dev.cardstashy.nativeplay.ui.Check(text = "4 Ragavan, Nimble Pilferer\n4 Swords to Plowshares\n52 Island", name = "Pasted deck",
            rows = listOf(row("Ragavan, Nimble Pilferer", 4), row("Swords to Plowshares", 4), dev.cardstashy.nativeplay.play.Decks.Row("Island", 52)),
            rarity = mapOf("Ragavan, Nimble Pilferer" to "mythic", "Swords to Plowshares" to "uncommon"), formats = listOf("Legacy", "Vintage"), format = "Legacy")
        for ((w, h) in listOf(412 to 915, 840 to 1000)) for (open in listOf(false, true)) {
            RuntimeEnvironment.setQualifiers("w${w}dp-h${h * 3}dp-xxhdpi")
            val pc = dev.cardstashy.nativeplay.ui.PreconUi().apply { this.index = index
                if (open) this.open = dev.cardstashy.nativeplay.ui.OpenPrecon("DimirRogues_CC1.json", "Dimir Rogues", "Challenger Deck", "2021-02-26", listOf("Legacy", "Vintage"), rows) }
            captureRoboImage(File(System.getProperty("shotsDir"), "decks-${if (open) "precon-paste" else "list"}-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.DecksScreen(state, {}, {}, {}, {}, { PlayNav(PlayTab.DECKS, {}) }, pc, if (open) pasted else dev.cardstashy.nativeplay.ui.Check())
            }
        }
        // settings-theme.js: the deck list in Light and Aura too.
        try { for (t in listOf("light", "aura")) {
            dev.cardstashy.nativeplay.ui.AppSettings.applyTheme(t); RuntimeEnvironment.setQualifiers("w412dp-h${915 * 3}dp-xxhdpi")
            captureRoboImage(File(System.getProperty("shotsDir"), "theme-$t-decks-list.png").path) {
                dev.cardstashy.nativeplay.ui.DecksScreen(state, {}, {}, {}, {}, { PlayNav(PlayTab.DECKS, {}) }, dev.cardstashy.nativeplay.ui.PreconUi().apply { this.index = index }, dev.cardstashy.nativeplay.ui.Check())
            }
        } } finally { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("dark") }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    @Test fun deckEditor() {
        trunkSetup()
        val deck = JsonParser.parseString("""{"id":"d1","name":"Izzet Tempo","format":"Modern","cards":[{"name":"Ragavan, Nimble Pilferer","qty":4},{"name":"Delver of Secrets // Insectile Aberration","qty":4},
            {"name":"Swords to Plowshares","qty":4},{"name":"Sheoldred, the Apocalypse","qty":2},{"name":"Strip Mine","qty":2},{"name":"Temple of Mystery","qty":2},{"name":"Island","qty":18},{"name":"Shivan Dragon","qty":2,"board":"side"}]}""").asJsonObject
        for ((w, h) in listOf(412 to 915, 840 to 1000)) {
            // Deck Bench fills the screen (the dock and the browser scroll inside it), so the real size.
            RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
            val ui = dev.cardstashy.nativeplay.ui.EditorUi().apply { edit = dev.cardstashy.nativeplay.play.DeckEdit.open(deck) }
            captureRoboImage(File(System.getProperty("shotsDir"), "deck-editor-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.DeckEditor(trunkState, ui, {}, {}, {}, {}) { PlayNav(PlayTab.DECKS, {}) }
            }
            if (w == 412) try { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("light")
                captureRoboImage(File(System.getProperty("shotsDir"), "theme-light-deck-editor.png").path) {
                    dev.cardstashy.nativeplay.ui.DeckEditor(trunkState, ui, {}, {}, {}, {}) { PlayNav(PlayTab.DECKS, {}) }
                } } finally { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("dark") }
        }
        // Hold a deck row (PR #110 playHoldMenu): Play's card actions with Deck cover; then the deck wearing the picked art.
        RuntimeEnvironment.setQualifiers("w412dp-h915dp-xxhdpi")
        val hold = dev.cardstashy.nativeplay.ui.EditorUi().apply { edit = dev.cardstashy.nativeplay.play.DeckEdit.open(deck); holdName = "Sheoldred, the Apocalypse" }
        captureRoboImage(File(System.getProperty("shotsDir"), "deck-editor-hold-cover.png").path) {
            dev.cardstashy.nativeplay.ui.DeckEditor(trunkState, hold, {}, {}, {}, {}) { PlayNav(PlayTab.DECKS, {}) }
        }
        val sheol = trunkCards.first { it["name"].asString == "Sheoldred, the Apocalypse" }.getAsJsonObject("image_uris")["art_crop"].asString
        dev.cardstashy.nativeplay.account.Decks.setCoversForTest(mapOf("d1" to JsonParser.parseString("""{"name":"Sheoldred, the Apocalypse","image":"$sheol"}""").asJsonObject))
        val covered = dev.cardstashy.nativeplay.ui.EditorUi().apply { edit = dev.cardstashy.nativeplay.play.DeckEdit.open(deck); holdName = "Sheoldred, the Apocalypse" }
        captureRoboImage(File(System.getProperty("shotsDir"), "deck-editor-covered.png").path) {
            dev.cardstashy.nativeplay.ui.DeckEditor(trunkState, covered, {}, {}, {}, {}) { PlayNav(PlayTab.DECKS, {}) }
        }
        dev.cardstashy.nativeplay.account.Decks.setCoversForTest(emptyMap())
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    @Test fun finder() {
        trunkSetup()
        val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art")
        dev.cardstashy.nativeplay.play.CardFacts.seed(JsonParser.parseString(art.resolve("finder-cards.json").readText()).asJsonArray.map { it.asJsonObject })
        dev.cardstashy.nativeplay.play.MetaLists.seed("Modern", JsonParser.parseString(art.resolve("meta-Modern.json").readText()).asJsonObject)
        dev.cardstashy.nativeplay.play.DeckEngine.initFrom(File("../deck-engine/deck-engine.js"))
        for ((w, h) in listOf(412 to 915, 840 to 1000)) {
            RuntimeEnvironment.setQualifiers("w${w}dp-h${if (w < 600) h * 4 else h * 3}dp-xxhdpi")
            val trunk = dev.cardstashy.nativeplay.play.Trunk.cards(trunkState)
            val lists = kotlinx.coroutines.runBlocking { listOfNotNull(dev.cardstashy.nativeplay.play.DeckEngine.forgeTrunk("Modern", trunk, dev.cardstashy.nativeplay.play.CardFacts.cards.value)) +
                dev.cardstashy.nativeplay.play.MetaLists.load("Modern")!! }
            val ui = dev.cardstashy.nativeplay.ui.FinderUi().apply { format = "Modern"; this.lists = lists; loadedFor = "Modern" }
            captureRoboImage(File(System.getProperty("shotsDir"), "deck-finder-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.FinderScreen(trunkState, ui, {}, { _, _ -> }, {}) { PlayNav(PlayTab.DECKS, {}) }
            }
        }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    @Test fun deckView() {
        trunkSetup()
        val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art")
        dev.cardstashy.nativeplay.play.CardFacts.seed(JsonParser.parseString(art.resolve("finder-cards.json").readText()).asJsonArray.map { it.asJsonObject })
        dev.cardstashy.nativeplay.play.MetaLists.seed("Modern", JsonParser.parseString(art.resolve("meta-Modern.json").readText()).asJsonObject)
        val lists = kotlinx.coroutines.runBlocking { dev.cardstashy.nativeplay.play.MetaLists.load("Modern")!! }
        val pick = lists.first { "Broodscale" in it.name }
        for ((w, h) in listOf(412 to 915, 840 to 1000)) for (mode in listOf("gallery", "stacks", "symbols", "compact")) {
            RuntimeEnvironment.setQualifiers("w${w}dp-h${h * 2}dp-xxhdpi")
            dev.cardstashy.nativeplay.ui.DeckViewPref.mode = mode
            val ui = dev.cardstashy.nativeplay.ui.FinderUi().apply { format = "Modern"; this.lists = lists; loadedFor = "Modern"; open = pick }
            captureRoboImage(File(System.getProperty("shotsDir"), "deck-view-$mode-${w}x$h.png").path) {
                dev.cardstashy.nativeplay.ui.FinderScreen(trunkState, ui, {}, { _, _ -> }, {}) { PlayNav(PlayTab.DECKS, {}) }
            }
        }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    @Test fun cardSheet() {
        trunkSetup(); dev.cardstashy.nativeplay.play.CardData.load(RuntimeEnvironment.getApplication())
        fun pick(name: String, finish: String) = trunkCards.first { it["name"].asString == name }.let { dev.cardstashy.nativeplay.ui.CardPick(name, it["oracle_id"]?.asString ?: "", it["id"].asString, finish) }
        val cases = listOf(Triple("1-overview-holo", pick("Ragavan, Nimble Pilferer", "foil"), "overview"), Triple("2-overview-nonfoil", pick("Ragavan, Nimble Pilferer", "nonfoil"), "overview"),
            Triple("3-get", pick("Sheoldred, the Apocalypse", "foil"), "get"), Triple("4-guide", pick("Delver of Secrets // Insectile Aberration", "nonfoil"), "guide"),
            Triple("5-galaxy", pick("Strip Mine", "foil"), "overview"))
        for ((w, h) in listOf(390 to 844, 884 to 1104)) for ((name, p, tab) in cases) {
            if (w > 390 && name != "1-overview-holo") continue
            RuntimeEnvironment.setQualifiers("w${w}dp-h${if (tab == "overview") h * 2 else h}dp-xxhdpi")
            captureRoboImage(File(System.getProperty("shotsDir"), "card-sheet-$name-${w}x$h.png").path) {
                androidx.compose.foundation.layout.Box(Modifier.background(Site.Bg)) {
                    dev.cardstashy.nativeplay.ui.CardSheet(p, trunkState, dev.cardstashy.nativeplay.ui.CardSheetActions(), {}, startTab = tab)
                }
            }
        }
        home.mkdirs(); home.resolve("missing.txt").writeText(missing.joinToString("\n"))
    }

    /** CP-11/12/14: the card at rest, under a finger at its top right (±8°, scale 1.035, light spot), and leaned by the phone (x .6, y −.4). */
    @Test fun cardLean() {
        trunkSetup(); dev.cardstashy.nativeplay.ui.Motion.still = false
        val card = trunkCards.first { it["name"].asString == "Ragavan, Nimble Pilferer" }
        val url = card.getAsJsonObject("image_uris")?.get("normal")?.asString ?: card.getAsJsonArray("card_faces")[0].asJsonObject.getAsJsonObject("image_uris")["normal"].asString
        RuntimeEnvironment.setQualifiers("w390dp-h600dp-xxhdpi")
        for (state in listOf("rest", "finger-top-right", "gyro-right-down")) {
            captureRoboImage(File(System.getProperty("shotsDir"), "card-lean-$state.png").path) {
                val lean = dev.cardstashy.nativeplay.ui.rememberCardLean()
                androidx.compose.runtime.LaunchedEffect(Unit) {
                    lean.catchDone = true
                    when (state) {
                        "finger-top-right" -> { lean.pressed = true; lean.tx = (.85f - .5f) * 16f; lean.ty = (.5f - .15f) * 16f; lean.mx = .85f; lean.my = .15f }
                        "gyro-right-down" -> { lean.gyro = true; lean.tx = .6f * 9f; lean.ty = .4f * 9f; lean.mx = .5f + .6f * .45f; lean.my = .5f - .4f * .45f }
                    }
                }
                androidx.compose.foundation.layout.Box(Modifier.background(Site.Bg).fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    dev.cardstashy.nativeplay.ui.CardPicture(url, null, null, Modifier.size(300.dp, 300.dp * 88f / 63f).cardLean(lean, foil = false, shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp))
                }
            }
        }
    }

    private val sizes = listOf(360 to 780, 412 to 915, 600 to 960, 840 to 1000)

    @Test fun playSkin() { dev.cardstashy.nativeplay.ui.Motion.still = true; for ((w, h) in sizes) for (s in listOf(1f, 1.3f)) shot("skin-play-placeholder-rows", w, h, s) { PlaySkin() } }
    @Test fun collectionSkin() { dev.cardstashy.nativeplay.ui.Motion.still = true; for ((w, h) in listOf(412 to 915, 840 to 1000)) shot("skin-collection-placeholder-rows", w, h, 1f) { CollectionSkin() } }
}
