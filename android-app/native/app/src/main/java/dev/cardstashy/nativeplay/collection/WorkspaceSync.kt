package dev.cardstashy.nativeplay.collection

import android.content.Context
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

/**
 * cloud.js's account sync, for this device's copy of the workspace (Decks' workspace-full-<user>.json, which the Collection
 * engine runs on). A Collection write lands in the device copy first; the account follows a few seconds later (cloud.js
 * scheduleSync, PUSH_DELAY) with the same revision-checked PATCH (pushNow). When the account moved on meanwhile, the three
 * copies are combined by the site's own sync-merge.js, account first (act() with accountFirst), and the result is pushed.
 *
 * Kept per account, as cloud.js keeps them: meta (cardforge-cloud-v1: {userId, revision, sig}, plus whether this device holds
 * edits the account lacks and a write counter) and the baseline (recovery-store.js syncBaselineKey: the copy last synced). The
 * copy a merge replaced goes to workspace-recovery-<user>.json, as the site journals it to Recovery.
 *
 * Every change to the device copy happens under [lock], and the engine always holds the device copy before a write runs on it
 * (ensureCollection reloads it when Decks.fullRevision moved), so an account copy that arrives between a tap and its save can
 * never be overwritten by a stale one.
 */
object WorkspaceSync {
    /** cloud.js PUSH_DELAY. */
    const val PUSH_DELAY = 2500L

    /** cloud.js statusLabel's states. */
    enum class State(val label: String) {
        LOCAL("Saved on this device"), WAITING("Saved on this device · waiting to sync"), SYNCING("Syncing…"), SYNCED("Synced to your account"),
        ERROR("Saved on this device · sync paused"), DECIDE("Sync needs your decision"), OFFLINE("Saved on this device · offline")
    }
    /** cloud.js status: its state, the message an error carries, and when it last synced (status.at). */
    data class Status(val state: State, val msg: String = "", val at: Long? = null)
    private fun synced() = Status(State.SYNCED, at = System.currentTimeMillis())
    private val _status = MutableStateFlow(Status(State.LOCAL)); val status: StateFlow<Status> = _status
    /** A merge's word to the player (cloud.js adopt's recoveryNotice), shown once. */
    val notice = MutableStateFlow<String?>(null)

    data class Meta(val userId: String, val revision: Long, val sig: String?, val dirty: Boolean, val gen: Long, val baseRevision: Long) {
        fun json() = JsonObject().apply { addProperty("userId", userId); addProperty("revision", revision); sig?.let { addProperty("sig", it) }
            addProperty("dirty", dirty); addProperty("gen", gen); addProperty("baseRevision", baseRevision) }.toString()
        companion object {
            fun parse(t: String) = JsonParser.parseString(t).asJsonObject.let { o ->
                Meta(o["userId"].asString, o["revision"].asLong, o["sig"]?.takeIf { it.isJsonPrimitive }?.asString, o["dirty"]?.asBoolean ?: false,
                    o["gen"]?.asLong ?: 0, o["baseRevision"]?.asLong ?: -1)
            }
        }
    }
    /** The account's row: what cloud.js fetchCloud reads (updated_at and device name the copy on the choice sheet). */
    data class Row(val revision: Long, val data: String, val updatedAt: String? = null, val device: String? = null)

    /** The account side: the workspaces row, read and revision-checked written (tests swap it). */
    interface Rows {
        suspend fun read(userId: String): Row?
        /** cloud.js pushNow's update: the new revision, or null when someone else saved first (zero rows matched). */
        suspend fun write(userId: String, revision: Long, data: String): Long?
    }
    object AccountRows : Rows {
        private suspend fun auth(): Map<String, String> {
            val token = Account.token() ?: throw IllegalStateException("Your sign-in expired. Sign in again to resume syncing.")
            return mapOf("apikey" to Account.KEY, "Authorization" to "Bearer $token")
        }
        override suspend fun read(userId: String): Row? = withContext(Dispatchers.IO) {
            val row = Http.call("GET", "${Account.URL}/rest/v1/workspaces?select=data,revision,updated_at,device&user_id=eq.$userId", auth(), timeoutMs = 20_000)
                ?.asJsonArray?.firstOrNull()?.asJsonObject ?: return@withContext null
            Row(row["revision"].asLong, row["data"].toString(), row["updated_at"]?.takeIf { it.isJsonPrimitive }?.asString,
                row["device"]?.takeIf { it.isJsonPrimitive }?.asString)
        }
        override suspend fun write(userId: String, revision: Long, data: String): Long? = withContext(Dispatchers.IO) {
            // {data, revision: rev + 1, device}, sent as the device copy's own text.
            val body = "{\"data\":$data,\"revision\":${revision + 1},\"device\":${JsonPrimitive(device())}}"
            val out = Http.call("PATCH", "${Account.URL}/rest/v1/workspaces?user_id=eq.$userId&revision=eq.$revision&select=revision",
                auth() + ("Prefer" to "return=representation"), body, timeoutMs = 30_000)?.asJsonArray
            out?.firstOrNull()?.asJsonObject?.get("revision")?.asLong
        }
    }
    @Volatile var rows: Rows = AccountRows
    /** The signed-in account (tests set it). */
    @Volatile internal var user: () -> String? = { Account.session.value?.userId }

    /** cloud.js device(): "<kind> · <local date>", at most 120 characters. */
    fun device() = ("Android · " + java.text.DateFormat.getDateInstance(java.text.DateFormat.SHORT).format(java.util.Date())).take(120)

    /** Held while the device copy, meta or baseline change, and while the engine writes. */
    val lock = Mutex()
    private val pushing = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var timer: Job? = null

    private fun metaFile(c: Context, u: String) = File(c.filesDir, "sync-meta-$u.json")
    private fun baselineFile(c: Context, u: String) = File(c.filesDir, "sync-baseline-$u.json")
    internal fun recoveryFile(c: Context, u: String) = File(c.filesDir, "workspace-recovery-$u.json")
    internal fun readMeta(c: Context, u: String): Meta? = runCatching { Meta.parse(metaFile(c, u).readText()) }.getOrNull()?.takeIf { it.userId == u }
    private fun writeMeta(c: Context, m: Meta) = atomic(metaFile(c, m.userId), m.json())
    private fun atomic(f: File, text: String) { val tmp = File(f.path + ".tmp"); tmp.writeText(text); if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) } }

    /**
     * Engine side: puts this device's copy into the engine when it isn't there already. Set by the app (ui ensureCollection);
     * returns false when there is no device copy yet.
     */
    @Volatile internal var ensureEngine: suspend (Context, String) -> Boolean = { _, _ -> false }
    /** Tells the pages the engine already holds the device copy at [rev] (a merge ran in it), so they redraw without reloading. */
    @Volatile internal var engineHolds: (String, Long) -> Unit = { _, _ -> }

    /**
     * After a write in the engine (the caller holds [lock]): [text] is the device copy now. Marks it as holding edits the account
     * lacks and schedules the push (app.js afterLocalSave: "Saved on this device · waiting to sync", then scheduleSync).
     */
    internal fun wroteLocally(c: Context, u: String, text: String) {
        val m = readMeta(c, u)
        // The first write on a copy this app only ever read (an earlier version kept it as a cache): that copy is the baseline
        // a later merge compares against.
        if (m == null) Decks.deviceFile(c, u).takeIf { it.isFile }?.let { atomic(baselineFile(c, u), it.readText()) }
        atomic(Decks.deviceFile(c, u), text)
        // Never synced on this device: it is linked at the next account read, before anything is pushed (pushNow's rule).
        writeMeta(c, (m ?: Meta(u, -1, null, false, 0, -1)).let { it.copy(dirty = true, gen = it.gen + 1) })
        _status.value = Status(State.WAITING)
        schedulePush(c)
    }

    /** cloud.js scheduleSync: one push PUSH_DELAY after the last write. */
    fun schedulePush(c: Context, after: Long = PUSH_DELAY) {
        if (!autoPush) return
        val app = c.applicationContext ?: c
        synchronized(this) { timer?.cancel(); timer = scope.launch { delay(after); pushNow(app) } }
    }

    /** Tests push by hand. */
    @Volatile internal var autoPush = true

    /** Pushes now if this device holds edits the account lacks (the app came back to the front, or the network did). */
    fun kick(c: Context) { val u = user() ?: return; if (readMeta(c, u)?.dirty == true) schedulePush(c, 0) }

    /**
     * cloud.js pushNow: this device's copy goes up only if the account still has the revision it was based on; when someone
     * saved first (zero rows), the account's copy is read and combined ([fromAccount]), and the combined copy is pushed.
     */
    suspend fun pushNow(c: Context): Unit = pushing.withLock {
        repeat(3) {
            val u = user() ?: return
            data class Snap(val meta: Meta, val text: String, val sig: String)
            val snap = lock.withLock {
                val m = readMeta(c, u) ?: return
                if (!m.dirty) { _status.value = synced(); return }
                // A missing link must be reconciled before any upload (pushNow: never an automatic insert or a blind write).
                if (m.revision < 1) return@withLock null
                if (!ensureEngine(c, u)) return
                val info = CollectionEngine.syncInfo()
                Snap(m, CollectionEngine.saved(), info["sig"].asString)
            }
            if (snap == null) { val row = read(u) ?: return; fromAccount(c, u, row.revision, row.data); return@repeat }
            if (snap.meta.sig == snap.sig) {
                lock.withLock { readMeta(c, u)?.takeIf { it.gen == snap.meta.gen }?.let { writeMeta(c, it.copy(dirty = false)) } }
                _status.value = synced(); return
            }
            _status.value = Status(State.SYNCING)
            val rev = try { rows.write(u, snap.meta.revision, snap.text) } catch (e: Exception) { fail(e); return }
            if (user() != u) return
            if (rev == null) {
                // Someone saved first: read what they saved and combine (cloud.js conflictFromServer).
                val row = read(u) ?: return
                fromAccount(c, u, row.revision, row.data)
                return@repeat
            }
            val still = lock.withLock {
                atomic(baselineFile(c, u), snap.text)
                val now = readMeta(c, u) ?: snap.meta
                val dirty = now.gen != snap.meta.gen
                writeMeta(c, now.copy(revision = rev, sig = snap.sig, baseRevision = rev, dirty = dirty))
                dirty
            }
            if (still) { _status.value = Status(State.WAITING); schedulePush(c) } else _status.value = synced()
            return
        }
    }

    private suspend fun read(u: String): Row? = try { rows.read(u) } catch (e: Exception) { fail(e); null }
    /** cloud.js friendly(). */
    internal fun fail(e: Exception) {
        val m = (e as? Http.Failure)?.body ?: e.message.orEmpty()
        _status.value = when {
            e is java.net.UnknownHostException || e is java.net.ConnectException -> Status(State.OFFLINE)
            Regex("schema cache|relation .* does not exist", RegexOption.IGNORE_CASE).containsMatchIn(m) || m.contains("PGRST205") -> Status(State.ERROR, "Your account storage isn’t set up yet (the database tables are missing).")
            Regex("JWT|token|session|sign-in", RegexOption.IGNORE_CASE).containsMatchIn(m) -> Status(State.ERROR, "Your sign-in expired. Sign in again to resume syncing.")
            e is java.io.IOException -> Status(State.ERROR, "Couldn’t reach the account service. Check your connection.")
            else -> Status(State.ERROR, m.ifBlank { "Something went wrong while syncing." })
        }
    }

    /**
     * The account's row was read (Decks.load on every visit, Decks.update after its own save, or a push that lost the race):
     * cloud.js decideSync and act, for an account this device is linked to.
     *  - no edits here: the account's copy becomes the device copy (adopt; link when they are the same);
     *  - edits here and the account unchanged since the last sync: push;
     *  - edits here and the account moved on: sync-merge.js combines baseline, device and account copies (account first), and
     *    the result is pushed;
     *  - the account went back to an older revision than this device last synced: the player chooses ([pending]).
     * This device's copy was only ever a cache of the account's before writes came to the app, so with no meta yet it is linked
     * to the account's copy rather than offered as a choice.
     */
    suspend fun fromAccount(c: Context, u: String, revision: Long, data: String) {
        var push = false
        lock.withLock {
            val m = readMeta(c, u)
            when {
                m == null || m.revision < 1 && !m.dirty -> adopt(c, u, revision, data, m)
                !m.dirty -> if (revision != m.revision || !Decks.deviceFile(c, u).isFile) adopt(c, u, revision, data, m) else _status.value = synced()
                m.revision < 1 || revision > m.revision -> { merge(c, u, m, revision, data); push = true }
                revision == m.revision -> push = true
                else -> { pending.value = Pending(u, Row(revision, data)); _status.value = Status(State.DECIDE) }
            }
        }
        if (push) schedulePush(c, 0)
    }

    private fun adopt(c: Context, u: String, revision: Long, data: String, m: Meta?) {
        val f = Decks.deviceFile(c, u)
        if (!(f.isFile && f.readText() == data)) { atomic(f, data); Decks.deviceChanged() }
        atomic(baselineFile(c, u), data)
        writeMeta(c, Meta(u, revision, null, false, m?.gen ?: 0, revision))
        _status.value = synced()
    }

    private suspend fun merge(c: Context, u: String, m: Meta, revision: Long, data: String) {
        if (!ensureEngine(c, u)) { adopt(c, u, revision, data, m); return }
        val before = CollectionEngine.saved()
        atomic(recoveryFile(c, u), before)
        runCatching { RecoveryJournal.append(c, u, before, "Before loading your account copy", "account-merge") }
        val base = if (m.baseRevision == m.revision) baselineFile(c, u).takeIf { it.isFile }?.readText() else null
        val r = CollectionEngine.mergeIn(base, data)
        atomic(Decks.deviceFile(c, u), CollectionEngine.saved())
        engineHolds(u, Decks.deviceChanged())
        atomic(baselineFile(c, u), data)
        writeMeta(c, m.copy(revision = revision, baseRevision = revision, sig = CollectionEngine.sigOf(data), dirty = true, gen = m.gen + 1))
        r["notice"]?.asString?.takeIf { it.isNotBlank() }?.let { notice.value = it }
        _status.value = Status(State.SYNCING)
    }

    /** cloud.js pending ("choose"): the account's copy is older than the one this device last synced, and this device has edits. */
    data class Pending(val userId: String, val cloud: Row)
    val pending = MutableStateFlow<Pending?>(null)

    /**
     * The choice sheet's account side: the pending copy with its updated_at and device (Decks.load reads only data and revision),
     * or the pending copy as it is when the account can't be reached or has moved on since.
     */
    suspend fun pendingDetails(): Pending? {
        val p = pending.value ?: return null
        val row = try { rows.read(p.userId) } catch (_: Exception) { null }
        return if (row != null && row.revision == p.cloud.revision && pending.value === p) p.copy(cloud = p.cloud.copy(updatedAt = row.updatedAt, device = row.device)) else p
    }

    /**
     * cloud.js resolvePending: "account" puts the account's copy on this device, "device" replaces the account's copy with this
     * device's (still revision-checked against what was just read), "later" keeps sync paused. The copy that is not kept is
     * saved first, as the site's hooks.backup does: in Recovery, and as a backup file in Downloads (app.js download).
     */
    suspend fun resolve(c: Context, choice: String, expected: Pending? = pending.value) {
        val p = pending.value ?: return
        if (p !== expected) return
        if (user() != p.userId) { pending.value = null; return }
        when (choice) {
            "account" -> lock.withLock {
                Decks.deviceFile(c, p.userId).takeIf { it.isFile }?.readText()?.let { local ->
                    atomic(recoveryFile(c, p.userId), local)
                    runCatching { RecoveryJournal.append(c, p.userId, local, "Before loading your account copy", "account-adopt") }
                    runCatching { download(c, "Before loading your account copy", local) }
                }
                pending.value = null
                adopt(c, p.userId, p.cloud.revision, p.cloud.data, readMeta(c, p.userId))
            }
            "device" -> {
                lock.withLock {
                    atomic(recoveryFile(c, p.userId), p.cloud.data)
                    runCatching { RecoveryJournal.append(c, p.userId, p.cloud.data, "Account copy before replacing it", "account-replace") }
                    runCatching { download(c, "Account copy before replacing it", p.cloud.data) }
                    readMeta(c, p.userId)?.let { writeMeta(c, it.copy(revision = p.cloud.revision, sig = "", dirty = true)) }
                    pending.value = null
                }
                pushNow(c)
            }
            else -> _status.value = Status(State.ERROR, "Sync paused until you choose which copy to keep.")
        }
    }

    /** app.js hooks.backup's file: CardStashy_Backup_<label>_<date>.json, the copy in backupEnvelope (tests swap it). */
    @Volatile internal var download: (Context, String, String) -> Unit = { c, label, data -> saveBackupFile(c, label, data) }

    /** confidence.js backupEnvelope, written where app.js download() puts it: Downloads (this app's own folder before Android 10). */
    fun saveBackupFile(c: Context, label: String, data: String) {
        val name = backupName(label)
        val bytes = backupEnvelope(data).toByteArray()
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            val r = c.contentResolver
            val v = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name); put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/json")
                put(android.provider.MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = r.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: error("Couldn’t save the backup file.")
            r.openOutputStream(uri)!!.use { it.write(bytes) }
            r.update(uri, android.content.ContentValues().apply { put(android.provider.MediaStore.Downloads.IS_PENDING, 0) }, null, null)
        } else File(c.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS) ?: c.filesDir, name).writeBytes(bytes)
    }

    /** confidence.js backupEnvelope: {...state, version: 3, exportedAt, backupKind: "cardforge-workspace", schemaVersion: 3}. */
    internal fun backupEnvelope(data: String, now: java.time.Instant = java.time.Instant.now()): String =
        JsonParser.parseString(data).asJsonObject.apply {
            addProperty("version", 3); addProperty("exportedAt", java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC).format(now))
            addProperty("backupKind", "cardforge-workspace"); addProperty("schemaVersion", 3)
        }.toString()
    /** app.js: `CardStashy_Backup_${fileSafe(label)}_${new Date().toISOString().slice(0, 10)}.json`. */
    internal fun backupName(label: String, day: java.time.LocalDate = java.time.LocalDate.now(java.time.ZoneOffset.UTC)): String =
        "CardStashy_Backup_${label.replace(Regex("[^a-z0-9]+", RegexOption.IGNORE_CASE), "_").trim('_').ifEmpty { "deck" }}_$day.json"

    /**
     * The account panel's Sync now (cloud.js syncNow → startSync): read the account, then decide as on every visit (Decks.load
     * passes the row to [fromAccount]); a device that matches the account is synced.
     */
    suspend fun syncNow(c: Context) {
        val u = user() ?: return
        if (pending.value != null) return
        _status.value = Status(State.SYNCING)
        try { Decks.load(c, rethrow = true) } catch (e: Exception) { fail(e); return }
        if (user() != u || _status.value.state != State.SYNCING || pending.value != null) return
        val m = readMeta(c, u)
        when {
            m == null -> _status.value = Status(State.LOCAL)
            !m.dirty -> _status.value = synced()
        }
    }

    /** cloud.js summarize: what the choice sheet says about a copy (every game's cards, decks and wishlist). */
    data class Summary(val copies: Double, val names: Int, val decks: Int, val wishlist: Int, val saved: String?)
    fun summarize(data: String?): Summary {
        val s = runCatching { JsonParser.parseString(data ?: "{}").asJsonObject }.getOrNull() ?: JsonObject()
        val games = listOf(s) + (s.getAsJsonObject("tcg")?.entrySet()?.mapNotNull { it.value as? JsonObject } ?: emptyList())
        fun arr(g: JsonObject, k: String) = (g[k] as? com.google.gson.JsonArray)
        return Summary(
            games.sumOf { g -> arr(g, "collection")?.sumOf { e -> (e as? JsonObject)?.get("qty")?.let { q -> runCatching { q.asDouble }.getOrNull()?.takeIf { it.isFinite() } } ?: 0.0 } ?: 0.0 },
            games.sumOf { arr(it, "collection")?.size() ?: 0 }, games.sumOf { arr(it, "decks")?.size() ?: 0 }, games.sumOf { arr(it, "wishlist")?.size() ?: 0 },
            s["lastSavedAt"]?.takeIf { it.isJsonPrimitive }?.asString)
    }

    internal fun setForTest(status: Status, pending: Pending?) { _status.value = status; this.pending.value = pending }

    /** Signed out or another account: nothing of the last one stays in flight. */
    fun reset() { synchronized(this) { timer?.cancel(); timer = null }; pending.value = null; notice.value = null; _status.value = Status(State.LOCAL) }
}
