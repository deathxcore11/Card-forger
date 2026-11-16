package dev.cardstashy.nativeplay.collection

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Gap audit S1: Settings > Backup. The file is the site's (app.js backupPayload: the workspace in backupEnvelope with its cards'
 * data), Check file and Restore read it as app.js readBackup does, a restore asks the site's question and keeps the replaced copy,
 * and Earlier saves is recovery-store.js's journal on this device.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BackupTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private fun fx(name: String) = JsonParser.parseString(javaClass.getResource("/account-writes/$name")!!.readText()).asJsonObject
    private fun workspace() = fx("qty-plus.json")["before"].asJsonObject.apply {
        add("decks", JsonArray().apply { add(JsonObject().apply {
            addProperty("id", "d1"); addProperty("name", "Burn"); addProperty("format", "Modern")
            add("cards", JsonArray().apply { add(JsonObject().apply { addProperty("name", "Lightning Bolt"); addProperty("qty", 4) }) })
        }) })
    }
    private fun data(vararg kv: Pair<String, Any>) = JsonObject().apply { kv.forEach { (k, v) -> if (v is Boolean) addProperty(k, v) else addProperty(k, v.toString()) } }
    private fun saved() = JsonParser.parseString(runBlocking { CollectionEngine.saved() }).asJsonObject
    private fun names(o: JsonObject, k: String) = o.getAsJsonArray(k).map { it.asJsonObject.let { e -> e["name"].asString + "×" + (e["qty"]?.asInt ?: 0) } }

    @Test fun downloadCheckAndRestoreRoundTrip() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        CollectionEngine.load(workspace().toString(), null)
        val before = saved()
        val file = CollectionEngine.backupPayload()
        val o = JsonParser.parseString(file).asJsonObject
        assertEquals("cardforge-workspace", o["backupKind"].asString)
        assertEquals(3, o["version"].asInt); assertEquals(3, o["schemaVersion"].asInt)
        assertTrue(o["exportedAt"].asString.matches(Regex("\\d{4}-\\d\\d-\\d\\dT.*Z")))
        assertTrue(o.has("cache"))
        assertEquals(names(before, "collection"), names(o, "collection"))

        val check = CollectionEngine.backupCheck(file)
        println("CHECK $check")
        assertTrue(check, check.startsWith("✓ Valid backup: 12 card copies, 1 decks across all games, exported "))
        assertTrue(CollectionEngine.backupCheck("{not json").startsWith("✕ Not a valid backup: "))

        // A blank workspace on this device; the file brings everything back after the site's question.
        CollectionEngine.load("{}", null)
        var r = CollectionEngine.act("restoreBackup", data("text" to file))
        assertEquals("Replace the workspace across all games with 12 card copies and 1 decks from this backup? The restored workspace will sync to your other devices. Your current data is saved as a recovery copy first.", r["ask"].asString)
        assertEquals(0, r["writes"].asInt)
        r = CollectionEngine.act("restoreBackup", data("text" to file, "confirmed" to true))
        println("RESTORE ${r.toString().take(300)}")
        assertEquals(1, r["writes"].asInt)
        assertEquals("Backup restored.", r.getAsJsonArray("toasts").single().asJsonObject["text"].asString)
        val after = saved()
        assertEquals(names(before, "collection"), names(after, "collection"))
        assertEquals(listOf("Burn"), after.getAsJsonArray("decks").map { it.asJsonObject["name"].asString })
        assertEquals(listOf("Lightning Bolt×4"), names(after.getAsJsonArray("decks")[0].asJsonObject, "cards"))
        // The blank copy it replaced is the recovery copy; restoring that one asks the site's Earlier saves question.
        val recovery = r["recovery"].asString
        assertEquals(0, JsonParser.parseString(recovery).asJsonObject.getAsJsonArray("collection").size())
        r = CollectionEngine.act("restoreRecovery", data("text" to recovery, "at" to "2026-11-12T23:02:00.000Z"))
        println("ASK ${r["ask"]}")
        assertTrue(r["ask"].asString, r["ask"].asString.startsWith("Restore 0 card copies, 0 decks and 0 wishlist entries across all games from "))
        assertTrue(r["ask"].asString.endsWith("? This replaces this account's current workspace and will sync to your other devices. Your current workspace will be saved as another recovery copy first."))
        r = CollectionEngine.act("restoreRecovery", data("text" to recovery, "at" to "2026-11-12T23:02:00.000Z", "confirmed" to true))
        assertEquals("Recovery copy restored. Your previous workspace remains in Recovery.", r.getAsJsonArray("toasts").single().asJsonObject["text"].asString)
        assertEquals(0, saved().getAsJsonArray("collection").size())

        // A file that isn't a backup changes nothing.
        r = CollectionEngine.act("restoreBackup", data("text" to "[1,", "confirmed" to true))
        assertEquals(0, r["writes"].asInt)
        assertTrue(r.getAsJsonArray("toasts").single().asJsonObject["text"].asString.startsWith("Restore failed — nothing changed. "))
    }

    @Test fun earlierSavesJournal() {
        val c: Context = RuntimeEnvironment.getApplication()
        c.filesDir.listFiles()?.forEach { it.delete() }
        val u = "user-1"
        val a = workspace().apply { addProperty("lastSavedAt", "2026-11-10T10:00:00.000Z") }
        RecoveryJournal.append(c, u, a.toString(), "Before workspace replacement", "restore", java.time.Instant.parse("2026-11-10T10:00:00Z"))
        // The same copy saved again later: kept once (recoveryStateSignature leaves out lastSavedAt).
        RecoveryJournal.append(c, u, a.deepCopy().apply { addProperty("lastSavedAt", "2026-11-11T10:00:00.000Z") }.toString(), "Before workspace replacement", "restore",
            java.time.Instant.parse("2026-11-11T10:00:00Z"))
        val b = workspace().apply { add("decks", JsonArray()) }
        RecoveryJournal.append(c, u, b.toString(), "Before loading your account copy", "account-merge", java.time.Instant.parse("2026-11-12T10:00:00Z"))
        // An older single copy (recovery-<user>.json) the journal lacks is listed too.
        File(c.filesDir, "recovery-$u.json").apply { writeText("{\"collection\":[],\"decks\":[]}"); setLastModified(java.time.Instant.parse("2026-11-09T10:00:00Z").toEpochMilli()) }
        val list = RecoveryJournal.list(c, u)
        assertEquals(listOf("Before loading your account copy", "Before workspace replacement", "Automatic recovery copy"), list.map { it.label })
        assertEquals(listOf(0, 1, 0), list.map { it.summary.decks })
        assertEquals(12.0, list[1].summary.copies, 0.0)
        val raw = JsonParser.parseString(RecoveryJournal.file(c, u).readText()).asJsonObject
        assertEquals(1, raw["version"].asInt); assertEquals(u, raw["owner"].asString); assertEquals(2, raw.getAsJsonArray("snapshots").size())
        // Another account's journal is not this one's.
        assertEquals(listOf<String>(), RecoveryJournal.list(c, "user-2").map { it.label })
    }
}
