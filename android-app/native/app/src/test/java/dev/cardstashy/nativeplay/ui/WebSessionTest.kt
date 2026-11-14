package dev.cardstashy.nativeplay.ui

import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Gap audit G5: the in-app website is signed in as the app. The page that hands over the session writes the site's own Supabase entry
 * (supabase-js's storage key and shape) with the access token only, never the app's refresh token, and only for cardstashy.com.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class WebSessionTest {
    private val s = Account.Session("acc.ess.tok", "REAL-REFRESH", System.currentTimeMillis() / 1000 + 3000, "user-1", "me@example.test")

    @Test fun siteKeyAndShape() {
        assertEquals("sb-noxfmbwuytnbvfgukpiv-auth-token", WebSession.KEY)
        val e = JsonParser.parseString(WebSession.entry(s)).asJsonObject
        // supabase-js _isValidSession: access_token, refresh_token and expires_at present.
        assertEquals("acc.ess.tok", e["access_token"].asString)
        assertEquals(s.expiresAt, e["expires_at"].asLong)
        assertTrue(e.has("refresh_token"))
        assertFalse("the app's refresh token never reaches the page", WebSession.entry(s).contains("REAL-REFRESH"))
        assertEquals("user-1", e["user"].asJsonObject["id"].asString)
    }

    @Test fun pageWritesThenMovesOn() {
        val target = "https://cardstashy.com/#decks</script><script>alert(1)"
        val html = WebSession.page(WebSession.entry(s), target)
        assertTrue(html.contains("localStorage.setItem(\"sb-noxfmbwuytnbvfgukpiv-auth-token\""))
        assertTrue(html.contains("location.replace("))
        // Nothing in the strings can close the script early.
        assertEquals(1, Regex("</script>").findAll(html).count())
        assertFalse(WebSession.page(null, "https://cardstashy.com/").contains("localStorage"))
    }

    @Test fun onlyOurSite() {
        assertTrue(WebSession.ours("https://cardstashy.com/#play"))
        assertTrue(WebSession.ours("https://www.cardstashy.com/"))
        assertFalse(WebSession.ours("https://cardstashy.com.evil.test/"))
        assertFalse(WebSession.ours("http://cardstashy.com/"))
        assertFalse(WebSession.ours("https://example.com/"))
    }
}
