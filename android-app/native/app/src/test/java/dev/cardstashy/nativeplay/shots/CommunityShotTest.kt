package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.Community
import dev.cardstashy.nativeplay.ui.CommunitySheet
import dev.cardstashy.nativeplay.ui.CommunityView
import dev.cardstashy.nativeplay.ui.Site
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The community pop-up (community-profile.js) drawn natively: Friends with presence and the swords, Requests, your profile's showcase. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CommunityShotTest {
    @get:Rule val rule = createComposeRule()

    private val overview = """{"people":[
        {"id":"11111111-1111-4111-8111-111111111111","username":"mira","display_name":"Mira","relationship":"accepted"},
        {"id":"22222222-2222-4222-8222-222222222222","username":"jonah","display_name":"Jonah","relationship":"accepted"},
        {"id":"33333333-3333-4333-8333-333333333333","username":"tess","display_name":"Tess","relationship":"pending","incoming":true}],
      "presence":{"11111111-1111-4111-8111-111111111111":{"online":true,"label":"Quick Play · Commander · turn 5","mode":"quick","at":"2026-11-06T20:00:00Z"}},
      "items":[{"key":"binder:b1","kind":"binder","game":"mtg","title":"Red Rares","presentationSchema":1,"appearance":{"color":"#aa3344","cover":[]},
                "cards":[{"id":"x1","name":"Lightning Bolt","qty":4,"image":"","referenceUSD":1.5}]},
               {"key":"deck:mtg:d2","kind":"deck","game":"mtg","title":"Izzet Tempo","format":"Modern","deckSchema":1,"presentationSchema":1,"appearance":{"cover":[]},
                "cards":[{"id":"x2","name":"Counterspell","qty":4,"image":"","zone":"main"}]}]}"""

    private fun shot(name: String, start: CommunityView, expect: List<String>, qualifiers: String? = null) {
        qualifiers?.let { RuntimeEnvironment.setQualifiers(it) }
        dev.cardstashy.nativeplay.ui.Motion.still = true
        Community.data.value = JsonParser.parseString(overview).asJsonObject
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Site.Bg)) {
                CommunitySheet(start, onClose = {}, onEditProfile = {}, onHeader = {}, onChallenge = {}, toast = {}, onOpenItem = {})
            }
        }
        rule.waitForIdle()
        for (t in expect) assertTrue(t, rule.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty())
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "$name.png").path)
    }

    /** The server's overview as it really comes (community_action: 'avatar', a.avatar from a left join): null for a friend with no profile
     *  art. Reading it as an object stopped the pop-up from drawing and the screen from answering (Randall 7 Nov). */
    @Test fun friendsWithNullArt() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        Community.data.value = JsonParser.parseString(overview.replace("\"relationship\":\"accepted\"}", "\"avatar\":null,\"avatar_url\":null,\"relationship\":\"accepted\"}")
            .replace("\"items\":[", "\"art\":{\"avatar\":null,\"header\":null},\"items\":[")).asJsonObject
        val view = androidx.compose.runtime.mutableStateOf<CommunityView>(CommunityView.Panel("friends"))
        rule.setContent { Box(Modifier.fillMaxSize().background(Site.Bg)) { androidx.compose.runtime.key(view.value) {
            CommunitySheet(view.value, onClose = {}, onEditProfile = {}, onHeader = {}, onChallenge = {}, toast = {}, onOpenItem = {}) } } }
        rule.waitForIdle()
        assertTrue(rule.onAllNodesWithText("mira", substring = true).fetchSemanticsNodes().isNotEmpty())
        view.value = CommunityView.Mine; rule.waitForIdle()
        assertTrue(rule.onAllNodesWithText("Red Rares", substring = true).fetchSemanticsNodes().isNotEmpty())
    }
    @Test fun friends() = shot("community-friends", CommunityView.Panel("friends"), listOf("mira", "jonah", "Quick Play · Commander", "Requests"))
    @Test fun requests() = shot("community-requests", CommunityView.Panel("requests"), listOf("tess", "Accept"))
    @Test fun mine() = shot("community-mine", CommunityView.Mine, listOf("Accepted friends only", "Choose binders", "Red Rares", "Update shared copy", "Izzet Tempo"))
    @Test fun friendsWide() = shot("community-friends-954", CommunityView.Panel("friends"), listOf("mira"), "w954dp-h860dp-xhdpi")
    @Test fun mineSmall() = shot("community-mine-360", CommunityView.Mine, listOf("Choose decks"), "w360dp-h780dp-xxhdpi")
}
