package dev.cardstashy.nativeplay.account

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Gap audit S2: only the exact sign-in return address is taken, as native-auth.js parseAuthCallback checks it. */
class AuthReturnTest {
    @Test fun exactAddressOnly() {
        assertEquals(AuthReturn.Result.Code("abc-123_x.y~z"), AuthReturn.parse("https://cardstashy.com/auth/android/callback?code=abc-123_x.y~z"))
        assertEquals(AuthReturn.Result.Error, AuthReturn.parse("https://cardstashy.com/auth/android/callback?error=access_denied&error_description=Expired%20link"))
        listOf(
            null, "", "https://cardstashy.com/auth/android/callback", "https://cardstashy.com/auth/android/callback?",
            "http://cardstashy.com/auth/android/callback?code=a", "https://evil.com/auth/android/callback?code=a",
            "https://cardstashy.com.evil.com/auth/android/callback?code=a", "https://cardstashy.com:443/auth/android/callback?code=a",
            "https://user@cardstashy.com/auth/android/callback?code=a", "https://cardstashy.com/auth/android/callbackx?code=a",
            "https://cardstashy.com/auth/android/callback?code=a#frag", "https://cardstashy.com/auth/android/callback?code=a&code=b",
            "https://cardstashy.com/auth/android/callback?code=a&next=/x", "https://cardstashy.com/auth/android/callback?code=a b",
            "https://cardstashy.com/auth/android/callback?code=%3Cx%3E", "https://cardstashy.com/auth/android/callback?error=x&code=a",
        ).forEach { assertNull(it, AuthReturn.parse(it)) }
    }
}
