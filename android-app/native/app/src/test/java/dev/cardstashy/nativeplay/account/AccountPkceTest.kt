package dev.cardstashy.nativeplay.account

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Gap audit S3: Continue with Google and the email link, with Supabase's PKCE flow returning through the verified link (AuthReturn).
 * The account service is a stand-in; what is checked is what the app sends and keeps.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AccountPkceTest {
    private val app = RuntimeEnvironment.getApplication()
    private val prefs get() = Account.prefsForTest
    private val calls = mutableListOf<Triple<String, String, String?>>()
    private val session = """{"access_token":"a1","refresh_token":"r1","expires_in":3600,"user":{"id":"u-9","email":"p@example.com"}}"""

    @Before fun setUp() {
        Account.init(app); Account.setForTest(null, null); prefs.edit().clear().apply(); calls.clear()
        Http.fake = { m, u, b -> calls += Triple(m, u, b)
            when {
                u.contains("/auth/v1/token?grant_type=pkce") -> JsonParser.parseString(session)
                u.contains("/auth/v1/settings") -> JsonParser.parseString("""{"external":{"google":true,"email":true}}""")
                else -> null
            } }
    }
    @After fun tearDown() { Http.fake = null; Account.setForTest(null, null) }

    private fun challengeOf(verifier: String) = java.util.Base64.getUrlEncoder().withoutPadding()
        .encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))

    @Test fun googleRoundTrip() = runBlocking {
        assertEquals(true, Account.googleEnabled())
        val url = Account.googleUrl()
        val verifier = prefs.getString("pkceVerifier", null)!!
        assertTrue(verifier.length >= 43)
        assertTrue(url, url.startsWith("${Account.URL}/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fcardstashy.com%2Fauth%2Fandroid%2Fcallback&code_challenge="))
        assertTrue(url.contains("code_challenge=${challengeOf(verifier)}&code_challenge_method=s256"))
        // The link comes back with the code: exchanged with the verifier, and signed in.
        assertNull(Account.finishReturn(AuthReturn.Result.Code("code-1")))
        val ex = calls.first { it.second.contains("grant_type=pkce") }
        val body = JsonParser.parseString(ex.third).asJsonObject
        assertEquals("code-1", body["auth_code"].asString); assertEquals(verifier, body["code_verifier"].asString)
        assertEquals("u-9", Account.session.value!!.userId)
        assertNull(prefs.getString("pkceVerifier", null))
        // The same link again: nothing is waiting for it.
        assertEquals("This sign-in link is no longer pending. Request a new link.", Account.finishReturn(AuthReturn.Result.Code("code-1")))
    }

    @Test fun emailLinkSendsTheChallenge() = runBlocking {
        assertEquals("Enter a valid email address.", Account.sendLink("nope"))
        assertNull(Account.sendLink(" p@example.com "))
        val otp = calls.single { it.second.contains("/auth/v1/otp") }
        assertEquals("POST", otp.first)
        assertTrue(otp.second.endsWith("/auth/v1/otp?redirect_to=https%3A%2F%2Fcardstashy.com%2Fauth%2Fandroid%2Fcallback"))
        val b = JsonParser.parseString(otp.third).asJsonObject
        assertEquals("p@example.com", b["email"].asString); assertEquals("s256", b["code_challenge_method"].asString)
        assertEquals(challengeOf(prefs.getString("pkceVerifier", null)!!), b["code_challenge"].asString)
        // The provider said no (the person backed out): the site's sentence, and the verifier is gone.
        assertEquals("Sign-in was not completed. Please try again.", Account.finishReturn(AuthReturn.Result.Error))
        assertNull(Account.session.value)
    }

    @Test fun aLinkOlderThanHalfAnHourIsNotTaken() = runBlocking {
        Account.beginPkce("email", System.currentTimeMillis() - 31 * 60 * 1000L)
        assertEquals("This sign-in link is no longer pending. Request a new link.", Account.finishReturn(AuthReturn.Result.Code("c")))
        assertTrue(calls.none { it.second.contains("grant_type=pkce") })
    }

    @Test fun aRefusedCodeSaysWhy() = runBlocking {
        Http.fake = { _, u, _ -> if (u.contains("grant_type=pkce")) throw Http.Failure(400, """{"error_code":"flow_state_expired","msg":"x"}""") else null }
        Account.googleUrl()
        assertEquals("This sign-in or reset link expired, or was opened in a different browser. Request a new link and open it in the same browser.",
            Account.finishReturn(AuthReturn.Result.Code("c")))
        assertNull(Account.session.value)
    }
}
