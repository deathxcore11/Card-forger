package dev.cardstashy.nativeplay.ui

import android.content.Context
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.collection.CollectionEngine
import java.io.File
import kotlinx.coroutines.launch

/**
 * Collection's Home and Decks pages as they were last drawn, kept on the device (the site's pages paint at once from the browser's
 * storage; this is the app's same first paint): a launch shows them in its first frame while the engine starts and the account is read,
 * then the fresh page replaces them. Kept per account, game and tab, and only for this install of the app (an update can change what
 * the engine draws). The Card of the Day is dropped once its day is over (daily-clock.js: New York midnight).
 */
internal object LastSeen {
    private const val V = 1
    @Volatile private var dir: File? = null
    @Volatile private var stamp = ""
    fun init(context: Context) {
        if (dir != null) return
        val app = context.applicationContext
        stamp = runCatching { val pi = app.packageManager.getPackageInfo(app.packageName, 0)
            "${pi.lastUpdateTime}-${androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(pi)}" }.getOrDefault("")
        dir = File(app.filesDir, "collection-last")
    }
    /** For tests: where the pages go, and the install they belong to. */
    internal fun initForTest(at: File, install: String) { dir = at; stamp = install }

    fun day(): String = java.time.LocalDate.now(java.time.ZoneId.of("America/New_York")).toString()
    private fun safe(s: String) = s.replace(Regex("[^A-Za-z0-9_-]"), "_")
    private fun file(user: String?, name: String) = dir?.let { File(it, safe(user ?: "anon") + "/" + safe(name) + ".json") }
    fun homeName(game: String) = "home-$game"
    fun decksName(game: String, tab: String) = "decks-$game-$tab"

    /** The page last kept for [user] (IO: call off the main thread), or null when there is none for this account and install. */
    fun read(user: String?, name: String): JsonObject? {
        val f = file(user, name)?.takeIf { it.isFile } ?: return null
        val o = runCatching { JsonParser.parseString(f.readText()).asJsonObject }.getOrNull() ?: return null
        if (o.get("v")?.asInt != V || o.get("stamp")?.asString != stamp || o.get("user")?.asString != (user ?: "")) return null
        val m = o.getAsJsonObject("model") ?: return null
        // Yesterday's Card of the Day (its name, set and pack) is not today's: the header shows none until today's is in.
        if (o.get("day")?.asString != day()) (m.get("hero") as? JsonObject)?.remove("card")
        return m
    }

    /** Keeps [raw] (the engine's own model text) for [user]. Written to a .tmp file, then renamed. */
    fun write(user: String?, name: String, raw: String) {
        val f = file(user, name) ?: return
        runCatching {
            f.parentFile?.mkdirs()
            val head = JsonObject().apply { addProperty("v", V); addProperty("stamp", stamp); addProperty("user", user ?: ""); addProperty("day", day()); addProperty("at", System.currentTimeMillis()) }.toString()
            val tmp = File(f.path + ".tmp"); tmp.writeText(head.dropLast(1) + ",\"model\":" + raw + "}")
            if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
        }
    }

    fun clear() { dir?.let { runCatching { it.deleteRecursively() } } }
    /** This account has had a Collection page drawn on this device (the launch warm-up is only for those who use Collection). */
    fun seenBefore(context: Context, user: String): Boolean { init(context); return dir?.let { File(it, safe(user)).isDirectory } == true }
}

/**
 * The Collection pages this run of the app has drawn, by account (and game, and tab), so coming back to a tab paints at once; cleared
 * with the account's decks (sign out, account switch) along with the pages kept on the device.
 */
internal object CollectionCaches {
    fun clear() {
        HomeCache.models.clear(); HomeCache.raw.clear(); HomeCache.loaded = null; HomeCache.hints = null; HomeCache.hintsGame = null
        decksCacheClear()
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch { LastSeen.clear() }
    }
}

/**
 * Today's Card of the Day as last drawn, kept on a fresh page that has the same card but not yet its set and pack (home-today.js
 * dailyDetails is still on its way): the header keeps the pack it showed instead of losing it for a moment.
 */
internal fun keepHeroDetails(fresh: JsonObject, shown: JsonObject?) {
    fun JsonObject.obj(k: String) = get(k) as? JsonObject
    val f = fresh.obj("hero")?.obj("card") ?: return
    val s = shown?.obj("hero")?.obj("card") ?: return
    if (f.get("id")?.asString != s.get("id")?.asString || f.get("date")?.asString != s.get("date")?.asString) return
    if (f.get("pack")?.isJsonObject == true || f.get("set")?.asString?.isNotBlank() == true) return
    for (k in listOf("set", "setCode", "setName", "rarity", "pack")) s.get(k)?.let { if (!it.isJsonNull) f.add(k, it) }
}

/** The game Collection opens on (the header's tabs, kept on the device). */
internal fun collectionWarmGame(context: Context): String { CollectionGame.init(context); return CollectionGame.current.value.id }
/** Home drawn by the launch warm-up: shown at once on the first open, and kept for the next launch. */
internal suspend fun warmHome(user: String, game: String) {
    val k = "$user|$game"
    if (HomeCache.models[k] != null) return
    val raw = CollectionEngine.homeRaw(game)
    val m = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { CollectionHomeModel.parse(JsonParser.parseString(raw).asJsonObject) }
    if (HomeCache.models.putIfAbsent(k, m) == null) { HomeCache.raw[k] = raw; kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { LastSeen.write(user, LastSeen.homeName(game), raw) } }
    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { HomePins.pin(m) }
}
