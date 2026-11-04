package dev.cardstashy.nativeplay

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.ui.UpdateUi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/*
 * In-app updates (Randall 4 Nov). The app reads the same release the site's download button uses
 * (GET /api/releases/current -> nativeTest {href, bytes, version, versionCode?, sha256?, notes?}), offers a newer build,
 * downloads it into the app's cache (resumes after a drop), checks it is really ours (same package, same signing
 * certificate, higher version code, and the sha256 when the site gives one), then hands it to Android's installer.
 * Android always asks the player to confirm; the first time it also asks them to allow installs from CardStashy.
 */
object Updater {
    private const val RELEASE = "https://cardstashy.com/api/releases/current"
    private const val SITE = "https://cardstashy.com"
    private const val CHECK_EVERY = 6 * 3600_000L
    private const val LATER_FOR = 24 * 3600_000L

    data class Release(val version: String, val code: Long, val url: String, val bytes: Long, val sha256: String?, val notes: List<Pair<String, String>>)

    /** What the prompt shows; null hides it. Hidden at the table (the prompt waits until the match is over). */
    var ui by mutableStateOf<UpdateUi?>(null); private set
    var inGame by mutableStateOf(false)
    /** For Settings: the newer build the site offers, if any (shown as "Update to X"). */
    var available by mutableStateOf<Release?>(null); private set
    /** For Settings: the last check found nothing newer. */
    var upToDate by mutableStateOf(false); private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client by lazy { OkHttpClient.Builder().retryOnConnectionFailure(true).readTimeout(30, TimeUnit.SECONDS).build() }
    private var download: Job? = null
    private var ready: File? = null

    private fun prefs(ctx: Context) = ctx.getSharedPreferences("updates", Context.MODE_PRIVATE)
    private fun dir(ctx: Context) = File(ctx.cacheDir, "updates").apply { mkdirs() }

    private fun installed(ctx: Context): PackageInfo = ctx.packageManager.getPackageInfo(ctx.packageName, 0)

    /** "0.4.10-test5-native-test" -> [0, 4, 10]. */
    internal fun numbers(v: String): List<Int> = Regex("^\\s*v?(\\d+(?:\\.\\d+)*)").find(v)?.groupValues?.get(1)?.split('.')?.map { it.toIntOrNull() ?: 0 } ?: emptyList()

    /** True when [offered] is newer than the installed build. The version code decides when the site gives one. */
    internal fun newer(offered: String, offeredCode: Long, haveName: String, haveCode: Long): Boolean {
        if (offeredCode > 0) return offeredCode > haveCode
        val a = numbers(offered); val b = numbers(haveName)
        for (i in 0 until maxOf(a.size, b.size)) { val x = a.getOrElse(i) { 0 }; val y = b.getOrElse(i) { 0 }; if (x != y) return x > y }
        // Same numbers: the finished release beats its own test builds (0.4.10 over 0.4.10-test5).
        // Only a numbered test build ("-test6"); the public build's own name ends in "-native-test" and must not loop.
        val testBuild = Regex("-test\\d")
        return testBuild.containsMatchIn(haveName) && !testBuild.containsMatchIn(offered)
    }

    internal fun parse(o: JsonObject?): Release? {
        val n = o?.getAsJsonObject("nativeTest") ?: return null
        val href = n.get("href")?.takeIf { it.isJsonPrimitive }?.asString ?: return null
        val version = n.get("version")?.takeIf { it.isJsonPrimitive }?.asString ?: return null
        val url = if (href.startsWith("https://")) href else if (href.startsWith("/")) SITE + href else return null
        if (!url.startsWith("$SITE/")) return null   // only ever the site's own downloads
        val notes = (n.get("notes") as? JsonArray)?.mapNotNull { e ->
            when {
                e.isJsonPrimitive -> e.asString.split(": ", limit = 2).let { if (it.size == 2) it[0] to it[1] else "" to it[0] }
                e.isJsonObject -> e.asJsonObject.let { (it.get("tag")?.asString ?: "") to (it.get("line")?.asString ?: return@mapNotNull null) }
                else -> null
            }
        } ?: emptyList()
        return Release(version, n.get("versionCode")?.takeIf { it.isJsonPrimitive }?.asLong ?: 0L, url,
            n.get("bytes")?.takeIf { it.isJsonPrimitive }?.asLong ?: 0L, n.get("sha256")?.takeIf { it.isJsonPrimitive }?.asString?.lowercase(), notes)
    }

    /** On launch and when the app comes back (at most every 6 h unless [force]); quiet when offline. */
    fun check(ctx: Context, force: Boolean = false) {
        val app = ctx.applicationContext
        val p = prefs(app); val now = System.currentTimeMillis()
        if (!force && now - p.getLong("checked", 0) < CHECK_EVERY && available == null) return
        if (download?.isActive == true || ui is UpdateUi.Ready || ui is UpdateUi.Allow) return
        scope.launch {
            val rel = runCatching { parse(dev.cardstashy.nativeplay.account.Http.call("GET", RELEASE, timeoutMs = 8000) as? JsonObject) }.getOrNull() ?: return@launch
            p.edit().putLong("checked", now).apply()
            val have = installed(app)
            if (!newer(rel.version, rel.code, have.versionName ?: "", PackageInfoCompat.getLongVersionCode(have))) {
                available = null; upToDate = true; cleanup(app, keep = null); return@launch
            }
            available = rel; upToDate = false
            val snoozed = p.getString("later", null) == rel.version && now - p.getLong("laterAt", 0) < LATER_FOR
            if (force || !snoozed) withContext(Dispatchers.Main) {
                // Already downloaded and checked earlier: go straight to install.
                val done = File(dir(app), "cardstashy-${rel.version}.apk").takeIf { it.exists() && verify(app, it, rel) == null }
                if (done != null) { ready = done; ui = UpdateUi.Ready(rel.version) } else ui = UpdateUi.Offer(rel.version, rel.bytes, rel.notes)
            }
        }
    }

    fun start(ctx: Context) {
        val rel = available ?: return
        val app = ctx.applicationContext
        if (download?.isActive == true) return
        ui = UpdateUi.Downloading(rel.version, 0, rel.bytes)
        download = scope.launch {
            val part = File(dir(app), "cardstashy-${rel.version}.part"); val apk = File(dir(app), "cardstashy-${rel.version}.apk")
            cleanup(app, keep = rel.version)
            val why = runCatching {
                var have = part.length()
                val req = Request.Builder().url(rel.url).header("User-Agent", dev.cardstashy.nativeplay.art.CardArt.UA)
                    .apply { if (have > 0) header("Range", "bytes=$have-") }.build()
                client.newCall(req).execute().use { r ->
                    if (!r.isSuccessful) error("The site answered ${r.code}.")
                    if (r.code != 206) have = 0   // the server sent the whole file: start over
                    val total = (r.body?.contentLength() ?: -1).let { if (it > 0) it + have else rel.bytes }
                    val src = r.body?.byteStream() ?: error("Empty download.")
                    FileOutputStream(part, have > 0).use { out ->
                        val buf = ByteArray(64 * 1024); var got = have; var shown = 0L
                        while (isActive) {
                            val n = src.read(buf); if (n < 0) break
                            out.write(buf, 0, n); got += n
                            if (got - shown > 256 * 1024 || got == total) { shown = got; val g = got; withContext(Dispatchers.Main) { ui = UpdateUi.Downloading(rel.version, g, total) } }
                        }
                    }
                }
                if (!isActive) return@launch
                verify(app, part, rel)?.let { part.delete(); error(it) }
                apk.delete(); if (!part.renameTo(apk)) error("Could not save the update.")
                null
            }.getOrElse { if (isActive) (it.message?.takeIf { m -> m.endsWith(".") } ?: "Check your connection and try again. What you already downloaded is kept.") else null }
            if (!isActive) return@launch
            withContext(Dispatchers.Main) {
                if (why != null) ui = UpdateUi.Failed(rel.version, why)
                else { ready = apk; ui = if (canInstall(app)) UpdateUi.Ready(rel.version) else UpdateUi.Allow(rel.version) }
            }
        }
    }

    /** Null when [f] is a CardStashy build newer than this one, signed with this app's key; otherwise why not. */
    private fun verify(ctx: Context, f: File, rel: Release): String? {
        if (rel.bytes > 0 && f.length() != rel.bytes) return "The download was incomplete. Try again."
        rel.sha256?.let { want ->
            val md = MessageDigest.getInstance("SHA-256"); f.inputStream().use { s -> val b = ByteArray(64 * 1024); while (true) { val n = s.read(b); if (n < 0) break; md.update(b, 0, n) } }
            if (md.digest().joinToString("") { "%02x".format(it) } != want) return "The download was damaged. Try again."
        }
        val pm = ctx.packageManager
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
        val them = pm.getPackageArchiveInfo(f.path, flags) ?: return "That file is not an app update."
        if (them.packageName != ctx.packageName) return "That file is a different app."
        val me = pm.getPackageInfo(ctx.packageName, flags)
        if (PackageInfoCompat.getLongVersionCode(them) <= PackageInfoCompat.getLongVersionCode(me)) return "You already have this version."
        if (certs(them) != certs(me)) return "That update is not signed by CardStashy."
        return null
    }

    @Suppress("DEPRECATION")
    private fun certs(p: PackageInfo): Set<String> {
        val sigs = if (Build.VERSION.SDK_INT >= 28) p.signingInfo?.let { if (it.hasMultipleSigners()) it.apkContentsSigners else it.signingCertificateHistory } else p.signatures
        return sigs.orEmpty().map { MessageDigest.getInstance("SHA-256").digest(it.toByteArray()).joinToString("") { b -> "%02x".format(b) } }.toSet()
    }

    private fun canInstall(ctx: Context) = ctx.packageManager.canRequestPackageInstalls()

    /** The one-time "Allow from this source" switch, in Android's own settings for this app. */
    fun allow(activity: Activity) {
        runCatching { activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))) }
    }

    /** Back from Android's settings: if the switch is on now, the update is ready to install. Also re-checks now and then. */
    fun resumed(ctx: Context) {
        val u = ui
        if (u is UpdateUi.Allow && canInstall(ctx)) ui = UpdateUi.Ready(u.version)
        if (u == null) check(ctx)
    }

    fun install(activity: Activity) {
        val f = ready?.takeIf { it.exists() } ?: run { ui = null; check(activity, force = true); return }
        if (!canInstall(activity)) { ui = UpdateUi.Allow(available?.version ?: ""); return }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", f)
        runCatching {
            activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
        }.onFailure { ui = UpdateUi.Failed(available?.version ?: "", "Android could not open its installer.") }
    }

    fun cancel() { download?.cancel(); download = null; ui = null }

    fun retry(ctx: Context) = start(ctx)

    fun later(ctx: Context) {
        val v = available?.version ?: return run { ui = null }
        prefs(ctx).edit().putString("later", v).putLong("laterAt", System.currentTimeMillis()).apply()
        ui = null
    }

    /** From Settings: show the prompt again for the waiting update. */
    fun reopen(ctx: Context) { if (available != null || ready != null) { prefs(ctx).edit().remove("later").apply() }; check(ctx, force = true) }

    /** Old downloads go once a newer one is on the way, or once this build is current. */
    private fun cleanup(ctx: Context, keep: String?) {
        dir(ctx).listFiles()?.forEach { if (keep == null || !it.name.startsWith("cardstashy-$keep.")) it.delete() }
    }
}
