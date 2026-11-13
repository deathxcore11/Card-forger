package dev.cardstashy.nativeplay.collection

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.File

/**
 * Settings > Backup's Earlier saves (gap audit S1): recovery-store.js's journal, kept on this device for each account as the site
 * keeps it under recoveryKey(owner): {version: 1, owner, snapshots: [{id, owner, createdAt, label, reason, revision, summary, state}]},
 * newest first. A copy that differs from one already kept only in lastSavedAt is kept once (recoveryStateSignature), and none is
 * ever pushed out (appendRecoverySnapshot). Every copy the app saves before replacing this device's workspace goes in with the
 * site's label: a restore or a whole-collection replacement ("Before workspace replacement", app.js replaceWorkspace), a sync
 * merge or choice ("Before loading your account copy", "Account copy before replacing it", cloud.js hooks.backup).
 * The single copies the app kept before this list existed (recovery-<user>.json, workspace-recovery-<user>.json) are listed too,
 * as createRecoverySnapshot's default label, when the journal doesn't already hold them.
 */
object RecoveryJournal {
    fun file(c: Context, u: String) = File(c.filesDir, "recovery-journal-$u.json")
    private fun legacy(c: Context, u: String) = listOf(File(c.filesDir, "recovery-$u.json"), File(c.filesDir, "workspace-recovery-$u.json"))

    data class Snapshot(val id: String, val createdAt: String, val label: String, val state: String, val summary: WorkspaceSync.Summary)

    /** recovery-store.js appendRecoverySnapshot(raw, createRecoverySnapshot(state, {owner, label, reason})). */
    @Synchronized fun append(c: Context, u: String, state: String, label: String, reason: String, now: java.time.Instant = java.time.Instant.now()) {
        val f = file(c, u)
        val parsed = parseState(state) ?: return
        val raw = if (f.isFile) runCatching { JsonParser.parseString(f.readText()).asJsonObject }.getOrNull() else null
        // An unreadable journal is never overwritten (the site refuses to replace one it can't verify): it is set aside whole.
        if (f.isFile && (raw == null || !valid(raw, u))) f.renameTo(File(f.path + ".unreadable-" + now.toEpochMilli()))
        val snaps = raw?.takeIf { valid(it, u) }?.getAsJsonArray("snapshots") ?: JsonArray()
        val sig = signature(parsed)
        if (snaps.any { s -> (s as? JsonObject)?.get("state")?.let { signature(it) } == sig }) return
        val sum = WorkspaceSync.summarize(state)
        val snap = JsonObject().apply {
            addProperty("id", java.util.UUID.randomUUID().toString()); addProperty("owner", u); addProperty("createdAt", iso(now))
            addProperty("label", label.take(180)); addProperty("reason", reason.take(80)); add("revision", com.google.gson.JsonNull.INSTANCE)
            add("summary", JsonObject().apply {
                addProperty("copies", sum.copies); addProperty("names", sum.names); addProperty("decks", sum.decks); addProperty("wishlist", sum.wishlist)
                sum.saved?.let { addProperty("saved", it) } ?: add("saved", com.google.gson.JsonNull.INSTANCE)
            })
            add("state", parsed)
        }
        val out = JsonArray().apply { add(snap); snaps.forEach { add(it) } }
        val text = JsonObject().apply { addProperty("version", 1); addProperty("owner", u); add("snapshots", out) }.toString()
        val tmp = File(f.path + ".tmp"); tmp.writeText(text); if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
    }

    /** recovery-store.js readRecoverySnapshots, then the older single copies the journal lacks; newest first. */
    @Synchronized fun list(c: Context, u: String): List<Snapshot> {
        val raw = file(c, u).takeIf { it.isFile }?.let { runCatching { JsonParser.parseString(it.readText()).asJsonObject }.getOrNull() }?.takeIf { valid(it, u) }
        val out = raw?.getAsJsonArray("snapshots")?.mapNotNull { e ->
            val s = e as? JsonObject ?: return@mapNotNull null
            val st = s.get("state") as? JsonObject ?: return@mapNotNull null
            val text = st.toString()
            Snapshot(s.str("id"), s.str("createdAt"), s.str("label").ifEmpty { "Automatic recovery copy" }, text, WorkspaceSync.summarize(text))
        }.orEmpty().toMutableList()
        val seen = out.map { signature(JsonParser.parseString(it.state)) }.toMutableSet()
        for (f in legacy(c, u)) {
            if (!f.isFile) continue
            val text = runCatching { f.readText() }.getOrNull() ?: continue
            val st = parseState(text) ?: continue
            if (!seen.add(signature(st))) continue
            out += Snapshot("file:" + f.name, iso(java.time.Instant.ofEpochMilli(f.lastModified())), "Automatic recovery copy", text, WorkspaceSync.summarize(text))
        }
        return out.sortedByDescending { it.createdAt }
    }

    /** The journal's size as the site estimates it (JSON length × 2), with the older copies, in bytes. */
    fun estimate(c: Context, u: String): Long = (listOf(file(c, u)) + legacy(c, u)).filter { it.isFile }.sumOf { it.length() } * 2

    private fun valid(raw: JsonObject, u: String) = raw.get("version")?.takeIf { it.isJsonPrimitive }?.asString?.toDoubleOrNull() == 1.0 &&
        raw.get("owner")?.takeIf { it.isJsonPrimitive }?.asString == u && raw.get("snapshots")?.isJsonArray == true
    private fun parseState(t: String): JsonObject? = runCatching { JsonParser.parseString(t) as? JsonObject }.getOrNull()
    /** recovery-store.js recoveryStateSignature: the whole copy, keys in order, without lastSavedAt. */
    internal fun signature(e: JsonElement): String {
        fun stable(x: JsonElement): JsonElement = when {
            x.isJsonObject -> JsonObject().also { o -> x.asJsonObject.entrySet().sortedBy { it.key }.forEach { (k, v) -> o.add(k, stable(v)) } }
            x.isJsonArray -> JsonArray().also { a -> x.asJsonArray.forEach { a.add(stable(it)) } }
            else -> x
        }
        val o = (e as? JsonObject)?.deepCopy()?.apply { remove("lastSavedAt") } ?: e
        return stable(o).toString()
    }
    private fun iso(i: java.time.Instant) = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC).format(i)
    private fun JsonObject.str(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
}
