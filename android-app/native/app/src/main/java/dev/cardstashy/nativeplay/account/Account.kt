package dev.cardstashy.nativeplay.account

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * The CardStashy account, the same one the web uses (Supabase, password-auth.js): email and
 * password through Supabase Auth, the session refreshed before it expires and kept in this app's
 * private storage only. Passwords are sent to Supabase Auth and never stored.
 */
object Account {
    // Public by design (config.js): the publishable key only allows what row-level security allows.
    const val URL = "https://noxfmbwuytnbvfgukpiv.supabase.co"
    const val KEY = "sb_publishable_TpEfTlAdziX6ALSZLA7U_A_tBKKHcAz"

    data class Session(val access: String, val refresh: String, val expiresAt: Long, val userId: String, val email: String)
    data class Profile(val name: String?, val avatarUrl: String?)

    private lateinit var prefs: SharedPreferences
    private val lock = Mutex()
    private val _session = MutableStateFlow<Session?>(null); val session: StateFlow<Session?> = _session
    private val _profile = MutableStateFlow<Profile?>(null); val profile: StateFlow<Profile?> = _profile

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.applicationContext.getSharedPreferences("account", Context.MODE_PRIVATE)
        val access = prefs.getString("access", null); val refresh = prefs.getString("refresh", null); val user = prefs.getString("user", null)
        if (access != null && refresh != null && user != null)
            _session.value = Session(access, refresh, prefs.getLong("expiresAt", 0), user, prefs.getString("email", "") ?: "")
        prefs.getString("profileName", null).let { n -> if (n != null || prefs.contains("profileAvatar")) _profile.value = Profile(n, prefs.getString("profileAvatar", null)) }
    }

    private fun headers(token: String? = null) = buildMap { put("apikey", KEY); if (token != null) put("Authorization", "Bearer $token") }

    private fun store(o: JsonObject): Session {
        val user = o.getAsJsonObject("user")
        val expiresAt = o.get("expires_at")?.takeIf { !it.isJsonNull }?.asLong
            ?: (System.currentTimeMillis() / 1000 + (o.get("expires_in")?.asLong ?: 3600))
        val s = Session(o.get("access_token").asString, o.get("refresh_token").asString, expiresAt, user.get("id").asString, user.get("email")?.takeIf { !it.isJsonNull }?.asString ?: "")
        prefs.edit().putString("access", s.access).putString("refresh", s.refresh).putLong("expiresAt", s.expiresAt).putString("user", s.userId).putString("email", s.email).apply()
        _session.value = s
        return s
    }

    /** Signs in with email and password; returns null or a sentence the person can act on. */
    suspend fun signIn(email: String, password: String): String? = withContext(Dispatchers.IO) {
        try {
            val body = JsonObject().apply { addProperty("email", email.trim()); addProperty("password", password) }.toString()
            val o = Http.call("POST", "$URL/auth/v1/token?grant_type=password", headers(), body)?.asJsonObject ?: return@withContext "Sign-in failed. Please try again."
            lock.withLock { store(o) }
            refreshProfile()
            null
        } catch (e: Http.Failure) { authError(e.body) } catch (e: Exception) { "Couldn’t reach the account service. Check your connection and try again." }
    }

    /** A valid access token, refreshed when it ends within a minute; null when signed out or the refresh token was revoked. */
    suspend fun token(): String? = withContext(Dispatchers.IO) {
        lock.withLock {
            val s = _session.value ?: return@withLock null
            if (s.expiresAt - System.currentTimeMillis() / 1000 > 60) return@withLock s.access
            try {
                val body = JsonObject().apply { addProperty("refresh_token", s.refresh) }.toString()
                Http.call("POST", "$URL/auth/v1/token?grant_type=refresh_token", headers(), body)?.asJsonObject?.let { store(it).access }
            } catch (e: Http.Failure) { if (e.status in 400..499) clear(); null } catch (_: Exception) { null }
        }
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        val s = _session.value
        try { if (s != null) Http.call("POST", "$URL/auth/v1/logout", headers(s.access)) } catch (_: Exception) {}
        lock.withLock { clear() }
    }

    private fun clear() {
        prefs.edit().clear().apply(); _session.value = null; _profile.value = null
    }

    /** The account's player card (name and picture), as the web's profile. */
    suspend fun refreshProfile() = withContext(Dispatchers.IO) {
        val s = _session.value ?: return@withContext
        val t = token() ?: return@withContext
        try {
            val rows = Http.call("GET", "$URL/rest/v1/profiles?select=display_name,avatar_url&id=eq.${s.userId}", headers(t))?.asJsonArray ?: return@withContext
            val o = rows.firstOrNull()?.asJsonObject ?: return@withContext
            val p = Profile(o.get("display_name")?.takeIf { !it.isJsonNull }?.asString, o.get("avatar_url")?.takeIf { !it.isJsonNull }?.asString)
            prefs.edit().putString("profileName", p.name).putString("profileAvatar", p.avatarUrl).apply()
            _profile.value = p
        } catch (_: Exception) {}
    }

    /** The web's authError wording (password-auth.js), from Supabase's error body. */
    fun authError(body: String): String {
        val code = Regex("\"(?:error_code|code|error)\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1) ?: ""
        val message = Regex("\"(?:msg|message|error_description)\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1) ?: ""
        return when {
            code == "invalid_credentials" || code == "invalid_grant" && message.contains("invalid login", true) || message.contains("invalid login credentials", true) -> "Email or password is incorrect. Try again or use Forgot password on the website."
            code == "email_not_confirmed" -> "Confirm your email before logging in. Check your inbox and spam folder."
            Regex("rate_limit|over_email_send_rate_limit").containsMatchIn(code) -> "Too many requests. Wait before trying again."
            else -> message.ifBlank { "Sign-in failed. Please try again." }
        }
    }
}
