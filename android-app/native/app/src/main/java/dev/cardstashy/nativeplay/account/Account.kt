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
    /** profile-art.js profileArt: the chosen card art and its circle crop, never an uploaded image. */
    data class Art(val game: String, val cardId: String, val name: String, val image: String, val ratio: Double, val zoom: Double, val x: Double, val y: Double) {
        fun json() = JsonObject().apply { addProperty("game", game); addProperty("cardId", cardId); addProperty("name", name); addProperty("image", image)
            addProperty("ratio", ratio); addProperty("zoom", zoom); addProperty("x", x); addProperty("y", y) }
        companion object {
            private fun clamp(n: Double, a: Double, b: Double) = n.coerceIn(a, b)
            /** profileArt(value): null unless game, cardId and an https image are present; ratio, zoom and x/y clamped like profileCrop. */
            fun from(o: JsonObject?): Art? {
                o ?: return null
                fun s(k: String) = o.get(k)?.takeIf { it.isJsonPrimitive }?.asString
                fun d(k: String, f: Double) = o.get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble ?: s(k)?.toDoubleOrNull() ?: f
                val game = s("game")?.takeIf { it in setOf("mtg", "ptcg", "ygo") } ?: return null
                val id = s("cardId")?.takeIf { it.isNotBlank() } ?: return null
                val image = s("image")?.takeIf { it.startsWith("https://") } ?: return null
                return crop(Art(game, id.take(100), (s("name") ?: "Card artwork").take(200), image, d("ratio", 1.0), d("zoom", 1.0), d("x", .5), d("y", .5)))
            }
            fun crop(a: Art): Art {
                val ratio = clamp(a.ratio, .2, 5.0); val zoom = clamp(a.zoom, 1.0, 4.0)
                val w = maxOf(1.0, ratio) * zoom; val h = maxOf(1.0, 1 / ratio) * zoom
                return a.copy(ratio = ratio, zoom = zoom, x = clamp(a.x, .5 / w, 1 - .5 / w), y = clamp(a.y, .5 / h, 1 - .5 / h))
            }
        }
    }
    /** cloud.js loadProfile: the profiles row plus community_action overview art. */
    data class Profile(val name: String?, val avatarUrl: String?, val username: String? = null, val bio: String? = null, val avatar: Art? = null, val header: Art? = null)

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
        prefs.getString("profileName", null).let { n -> if (n != null || prefs.contains("profileAvatar")) _profile.value = Profile(n, prefs.getString("profileAvatar", null),
            prefs.getString("profileUser", null), prefs.getString("profileBio", null),
            prefs.getString("artAvatar", null)?.let { runCatching { Art.from(com.google.gson.JsonParser.parseString(it).asJsonObject) }.getOrNull() },
            prefs.getString("artHeader", null)?.let { runCatching { Art.from(com.google.gson.JsonParser.parseString(it).asJsonObject) }.getOrNull() }) }
    }

    /** JVM screenshot tests only: show a signed-in account without the network. */
    internal fun setForTest(session: Session?, profile: Profile?) { _session.value = session; _profile.value = profile }

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
        if (!validEmail(email.trim())) return@withContext "Enter a valid email address."
        if (password.isEmpty()) return@withContext "Enter your password."
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

    private fun JsonObject.str(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }

    /** cloud.js loadProfile: profiles row (username, display_name, avatar_url, bio) and the card-art avatar/header. */
    suspend fun refreshProfile() = withContext(Dispatchers.IO) {
        val s = _session.value ?: return@withContext
        val t = token() ?: return@withContext
        try {
            val rows = Http.call("GET", "$URL/rest/v1/profiles?select=username,display_name,avatar_url,bio&id=eq.${s.userId}", headers(t))?.asJsonArray
            val o = rows?.firstOrNull() as? JsonObject
            val art = runCatching { (Http.call("POST", "$URL/rest/v1/rpc/community_action", headers(t),
                JsonObject().apply { addProperty("action", "overview"); add("payload", JsonObject()) }.toString()) as? JsonObject)?.get("art") as? JsonObject }.getOrNull()
            if (_session.value?.userId != s.userId) return@withContext
            val was = _profile.value
            val user = o?.str("username")
            val p = Profile(user ?: o?.str("display_name") ?: s.email.substringBefore('@'), o?.str("avatar_url"), user, o?.str("bio"),
                if (art != null) Art.from(art.get("avatar") as? JsonObject) else was?.avatar,
                if (art != null) Art.from(art.get("header") as? JsonObject) else was?.header)
            remember(p)
        } catch (_: Exception) {}
    }

    private fun remember(p: Profile) {
        prefs.edit().putString("profileName", p.name).putString("profileAvatar", p.avatarUrl).putString("profileUser", p.username).putString("profileBio", p.bio)
            .putString("artAvatar", p.avatar?.json()?.toString()).putString("artHeader", p.header?.json()?.toString()).apply()
        _profile.value = p
    }

    /** cloud.js saveProfile, called by A.saveProfile with display_name = username. Returns null or the web's error sentence. */
    suspend fun saveProfile(username: String, bio: String): String? = withContext(Dispatchers.IO) {
        val s = _session.value ?: return@withContext "Sign in first."
        val u = username.trim()
        if (u.isNotEmpty() && !Regex("^[A-Za-z0-9_]{3,30}$").matches(u)) return@withContext "Usernames are 3–30 letters, numbers or underscores."
        val t = token() ?: return@withContext "Sign in first."
        try {
            val body = JsonObject().apply { addProperty("id", s.userId)
                if (u.isEmpty()) add("display_name", com.google.gson.JsonNull.INSTANCE) else addProperty("display_name", u.take(60))
                if (u.isEmpty()) add("username", com.google.gson.JsonNull.INSTANCE) else addProperty("username", u)
                bio.trim().take(500).let { if (it.isEmpty()) add("bio", com.google.gson.JsonNull.INSTANCE) else addProperty("bio", it) } }.toString()
            val row = (Http.call("POST", "$URL/rest/v1/profiles?on_conflict=id&select=username,display_name,avatar_url,bio",
                headers(t) + mapOf("Prefer" to "resolution=merge-duplicates,return=representation"), body)?.asJsonArray?.firstOrNull() as? JsonObject)
            if (_session.value?.userId != s.userId) return@withContext "Your account changed. Please try again."
            val was = _profile.value
            val user = row?.str("username")
            remember(Profile(user ?: row?.str("display_name") ?: s.email.substringBefore('@'), row?.str("avatar_url"), user, row?.str("bio"), was?.avatar, was?.header))
            null
        } catch (e: Http.Failure) { if (Regex("duplicate|unique", RegexOption.IGNORE_CASE).containsMatchIn(e.body)) "That username is taken." else Regex("\"message\"\\s*:\\s*\"([^\"]+)\"").find(e.body)?.groupValues?.get(1) ?: "Couldn’t save your profile. Try again." }
        catch (_: Exception) { "Couldn’t reach the account service. Check your connection and try again." }
    }

    /** app.js saveProfileArtwork via community_action save_art (keeps the other of avatar/header). */
    suspend fun saveArt(kind: String, art: Art): Boolean = withContext(Dispatchers.IO) {
        val s = _session.value ?: return@withContext false
        val t = token() ?: return@withContext false
        val was = _profile.value
        val avatar = if (kind == "avatar") art else was?.avatar; val header = if (kind == "header") art else was?.header
        try {
            val payload = JsonObject().apply { add("avatar", avatar?.json() ?: com.google.gson.JsonNull.INSTANCE); add("header", header?.json() ?: com.google.gson.JsonNull.INSTANCE) }
            val res = Http.call("POST", "$URL/rest/v1/rpc/community_action", headers(t), JsonObject().apply { addProperty("action", "save_art"); add("payload", payload) }.toString())
            if ((res as? JsonObject)?.get("error")?.takeIf { it.isJsonPrimitive } != null) return@withContext false
            if (_session.value?.userId != s.userId) return@withContext false
            remember((was ?: Profile(s.email.substringBefore('@'), null)).copy(avatar = avatar, header = header)); true
        } catch (_: Exception) { false }
    }

    /** cloud.js deleteAccount: rpc delete_my_account with this session's token, then the session goes. */
    suspend fun deleteAccount(): String? = withContext(Dispatchers.IO) {
        val s = _session.value ?: return@withContext "Sign in first to delete your account."
        val t = token() ?: return@withContext "Your sign-in changed. Account deletion was cancelled."
        if (_session.value?.userId != s.userId) return@withContext "Your account changed. Account deletion was cancelled."
        try { Http.call("POST", "$URL/rest/v1/rpc/delete_my_account", headers(t), "{}"); lock.withLock { clear() }; null }
        catch (e: Http.Failure) { if (Regex("does not exist|PGRST202", RegexOption.IGNORE_CASE).containsMatchIn(e.body)) "Account deletion isn't set up on the server yet. Please try again later." else authError(e.body) }
        catch (_: Exception) { "Couldn't delete the account. Try again." }
    }

    private const val REDIRECT = "https://cardstashy.com/"
    private fun validEmail(e: String) = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(e)

    /** password-auth.js validateNewPassword: null when fine, else its sentence. */
    fun newPasswordError(p: String, confirm: String): String? = when {
        p.length < 8 -> "Use a password with at least 8 characters."
        !p.any { it.isUpperCase() } -> "Add a capital letter to your password."
        !p.any { it.isDigit() } -> "Add a number to your password."
        p != confirm -> "The passwords don’t match."
        else -> null
    }
    /** password-auth.js PASSWORD_RULES, for the live checklist under a new password. */
    val passwordRules = listOf<Pair<String, (String) -> Boolean>>("At least 8 characters" to { it.length >= 8 }, "A capital letter" to { p -> p.any { it.isUpperCase() } }, "A number" to { p -> p.any { it.isDigit() } })

    /** createPasswordAuth.signup. Returns (error, signedInNow). */
    suspend fun signUp(email: String, password: String, confirm: String): Pair<String?, Boolean> = withContext(Dispatchers.IO) {
        val e = email.trim()
        if (!validEmail(e)) return@withContext "Enter a valid email address." to false
        newPasswordError(password, confirm)?.let { return@withContext it to false }
        try {
            val body = JsonObject().apply { addProperty("email", e); addProperty("password", password) }.toString()
            val o = Http.call("POST", "$URL/auth/v1/signup?redirect_to=${java.net.URLEncoder.encode(REDIRECT, "UTF-8")}", headers(), body) as? JsonObject
            if (o?.get("access_token")?.isJsonPrimitive == true) { lock.withLock { store(o) }; refreshProfile(); null to true } else null to false
        } catch (x: Http.Failure) { authError(x.body) to false } catch (_: Exception) { "Couldn’t reach the account service. Check your connection and try again." to false }
    }

    /** createPasswordAuth.resend / reset: emails only, null or an error sentence. */
    suspend fun resendConfirm(email: String): String? = mail(email, "$URL/auth/v1/resend") { addProperty("type", "signup") }
    suspend fun sendReset(email: String): String? = mail(email, "$URL/auth/v1/recover?redirect_to=${java.net.URLEncoder.encode(REDIRECT, "UTF-8")}") {}
    private suspend fun mail(email: String, url: String, extra: JsonObject.() -> Unit): String? = withContext(Dispatchers.IO) {
        val e = email.trim()
        if (!validEmail(e)) return@withContext "Enter a valid email address."
        try { Http.call("POST", url, headers(), JsonObject().apply { addProperty("email", e); extra() }.toString()); null }
        catch (x: Http.Failure) { authError(x.body) } catch (_: Exception) { "Couldn’t reach the account service. Check your connection and try again." }
    }

    /** The web's authError wording (password-auth.js), from Supabase's error body. */
    fun authError(body: String): String {
        val code = Regex("\"(?:error_code|code|error)\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1) ?: ""
        val message = Regex("\"(?:msg|message|error_description)\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1) ?: ""
        return when {
            code == "invalid_credentials" || code == "invalid_grant" && message.contains("invalid login", true) || message.contains("invalid login credentials", true) -> "Email or password is incorrect. Try again or use Forgot password."
            code == "email_not_confirmed" -> "Confirm your email before logging in. Check your inbox and spam folder."
            code == "email_address_not_authorized" -> "We couldn’t send email to this address. Try again later or contact support."
            Regex("rate_limit|over_email_send_rate_limit").containsMatchIn(code) -> "Too many requests. Wait before trying again."
            Regex("otp_expired|flow_state_expired|bad_code_verifier|flow_state_not_found").containsMatchIn(code) -> "This sign-in or reset link expired, or was opened in a different browser. Request a new link and open it in the same browser."
            Regex("supabase|smtp|database|configuration|unexpected_failure", RegexOption.IGNORE_CASE).containsMatchIn("$message $code") -> "The account service couldn’t finish this request. Please try again or contact support."
            else -> message.ifBlank { "Sign-in failed. Please try again." }
        }
    }
}
