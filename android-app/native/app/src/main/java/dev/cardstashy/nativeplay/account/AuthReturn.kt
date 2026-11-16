package dev.cardstashy.nativeplay.account

import kotlinx.coroutines.flow.MutableStateFlow

/**
 * The sign-in return link (gap audit S2): https://cardstashy.com/auth/android/callback, verified for this app through the site's
 * /.well-known/assetlinks.json (worker.js ANDROID_APPS). Only that exact address is taken, with only the provider's own fields, as
 * android-app/runtime/native-auth.js parseAuthCallback checks it. The code is held for the sign-in that asked for it (S3) and is
 * never logged, shown or reported.
 */
object AuthReturn {
    const val CALLBACK = "https://cardstashy.com/auth/android/callback"
    sealed interface Result { data class Code(val code: String) : Result; data object Error : Result }
    /** The latest return not yet taken by the sign-in waiting for it. */
    val pending = MutableStateFlow<Result?>(null)

    /** parseAuthCallback: null for anything but the exact address with ?code=… or ?error=… (and its error_code / error_description). */
    fun parse(raw: String?): Result? {
        if (raw == null || raw.length > 8192 || raw.any { it.isWhitespace() || it == '\\' || it.code < 0x20 || it.code == 0x7f }) return null
        if (!raw.startsWith("$CALLBACK?")) return null
        val u = runCatching { java.net.URI(raw) }.getOrNull() ?: return null
        if (u.scheme != "https" || u.host != "cardstashy.com" || u.port != -1 || u.rawUserInfo != null || u.rawFragment != null || u.path != "/auth/android/callback") return null
        val pairs = (u.rawQuery ?: return null).split('&').map { p -> p.substringBefore('=') to java.net.URLDecoder.decode(p.substringAfter('=', ""), "UTF-8") }
        val keys = pairs.map { it.first }
        if (keys.any { it !in setOf("code", "error", "error_code", "error_description") } || keys.toSet().size != keys.size) return null
        val q = pairs.toMap()
        if ("error" in q) return if ("code" in q) null else Result.Error
        val code = q["code"] ?: return null
        return if (Regex("^[A-Za-z0-9._~-]{1,2048}$").matches(code)) Result.Code(code) else null
    }

    /** A VIEW intent's link: kept for the sign-in when it is the return address; true when it was one (the intent is then spent). */
    fun take(intent: android.content.Intent?): Boolean {
        if (intent?.action != android.content.Intent.ACTION_VIEW) return false
        val r = parse(intent.dataString) ?: return false
        pending.value = r
        intent.data = null
        return true
    }
}
