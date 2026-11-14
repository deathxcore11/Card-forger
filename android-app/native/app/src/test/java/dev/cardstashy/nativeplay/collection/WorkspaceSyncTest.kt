package dev.cardstashy.nativeplay.collection

import android.content.Context
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Decks
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.withLock
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * cloud.js's sync as the app runs it (WorkspaceSync): a Collection write lands in this device's copy, goes to the account with the
 * revision check, and when another device saved first the three copies are combined (sync-merge.js) and pushed. The account is a
 * stand-in that behaves as the workspaces row does (PATCH ... revision=eq.N matches zero rows once someone else saved).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class WorkspaceSyncTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private val u = "user-1"
    private lateinit var c: Context

    /** The account's row. */
    class Account(var revision: Long, var data: String) : WorkspaceSync.Rows {
        var writes = 0
        override suspend fun read(userId: String) = WorkspaceSync.Row(revision, data)
        override suspend fun write(userId: String, revision: Long, data: String): Long? {
            if (revision != this.revision) return null
            this.revision++; this.data = data; writes++; return this.revision
        }
        fun json(): JsonObject = JsonParser.parseString(data).asJsonObject
        /** Another device saves. */
        fun edit(change: (JsonObject) -> Unit) { val o = json(); change(o); data = o.toString(); revision++ }
    }

    private fun fx(name: String) = JsonParser.parseString(javaClass.getResource("/account-writes/$name")!!.readText()).asJsonObject
    private var loaded = -1L
    private val downloads = mutableListOf<Pair<String, String>>()
    @Before fun setUp() {
        downloads.clear()
        WorkspaceSync.download = { _, label, data -> downloads += label to data }
        assumeTrue(bundle.isFile)
        c = RuntimeEnvironment.getApplication()
        CollectionEngine.initFrom(bundle)
        c.filesDir.listFiles()?.forEach { it.delete() }
        WorkspaceSync.autoPush = false
        WorkspaceSync.user = { u }
        loaded = -1L
        // As ui ensureCollection does: the engine reloads this device's copy whenever it changed from outside.
        WorkspaceSync.ensureEngine = { ctx, user -> val f = Decks.deviceFile(ctx, user)
            if (!f.isFile) false else { if (loaded != Decks.fullRevision.value) { CollectionEngine.load(f.readText(), null); loaded = Decks.fullRevision.value }; true } }
        WorkspaceSync.engineHolds = { _, rev -> loaded = rev }
        WorkspaceSync.reset()
    }
    @After fun tearDown() { WorkspaceSync.autoPush = true; WorkspaceSync.rows = WorkspaceSync.AccountRows; WorkspaceSync.download = { c, l, d -> WorkspaceSync.saveBackupFile(c, l, d) } }

    /** A tap, as CollectionWrites runs it. */
    private suspend fun tap(kind: String, data: JsonObject) = WorkspaceSync.lock.withLock {
        assertTrue(WorkspaceSync.ensureEngine(c, u))
        val r = CollectionEngine.act(kind, data)
        assertEquals(r.toString(), 1, r["writes"].asInt)
        WorkspaceSync.wroteLocally(c, u, CollectionEngine.saved())
    }
    private fun lot(o: JsonObject, id: String) = o.getAsJsonArray("collection").map { it.asJsonObject }.firstOrNull { it["id"].asString == id }
    private fun plus(id: String) = JsonObject().apply { addProperty("game", "mtg"); addProperty("lot", id); addProperty("delta", "1") }

    @Test fun writeThenPush() = runBlocking {
        val acct = Account(5, fx("qty-plus.json")["before"].toString()); WorkspaceSync.rows = acct
        // The first read links this device to the account's copy.
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        assertEquals(acct.data, Decks.deviceFile(c, u).readText())
        assertEquals(5, WorkspaceSync.readMeta(c, u)!!.revision)
        tap("cardOwnedQty", plus("l1"))
        assertEquals(WorkspaceSync.State.WAITING, WorkspaceSync.status.value.state)
        assertEquals(3, lot(JsonParser.parseString(Decks.deviceFile(c, u).readText()).asJsonObject, "l1")!!["qty"].asInt)
        WorkspaceSync.pushNow(c)
        assertEquals(1, acct.writes); assertEquals(6, acct.revision)
        assertEquals(3, lot(acct.json(), "l1")!!["qty"].asInt)
        val m = WorkspaceSync.readMeta(c, u)!!
        assertEquals(6, m.revision); assertEquals(false, m.dirty)
        assertEquals(WorkspaceSync.State.SYNCED, WorkspaceSync.status.value.state)
        // Nothing new: no write (pushNow's fingerprint check), and a re-read of the same revision changes nothing.
        WorkspaceSync.pushNow(c); assertEquals(1, acct.writes)
        val bumps = Decks.fullRevision.value
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        assertEquals(bumps, Decks.fullRevision.value)
    }

    @Test fun anotherDeviceSavedFirst() = runBlocking {
        val acct = Account(5, fx("qty-plus.json")["before"].toString()); WorkspaceSync.rows = acct
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        // The phone adds a copy of Lightning Bolt and wishes for Sol Ring; meanwhile the website changes the Islands.
        tap("cardOwnedQty", plus("l1"))
        tap("cardWishlist", JsonObject().apply { addProperty("game", "mtg"); addProperty("name", "Sol Ring"); addProperty("id", "") })
        acct.edit { o -> lot(o, "l2")!!.addProperty("qty", 11) }
        WorkspaceSync.pushNow(c)
        // The first PATCH matched nothing; the merge of both was pushed.
        assertEquals(1, acct.writes); assertEquals(7, acct.revision)
        val a = acct.json()
        assertEquals(3, lot(a, "l1")!!["qty"].asInt)
        assertEquals(11, lot(a, "l2")!!["qty"].asInt)
        assertEquals("Sol Ring", a.getAsJsonArray("wishlist")[0].asJsonObject["name"].asString)
        // This device's copy before the merge is kept (the site's Recovery), and the engine shows the merged copy.
        assertTrue(WorkspaceSync.recoveryFile(c, u).isFile)
        assertEquals(10, lot(JsonParser.parseString(WorkspaceSync.recoveryFile(c, u).readText()).asJsonObject, "l2")!!["qty"].asInt)
        // ...and listed in Settings > Backup's Earlier saves with the site's label.
        assertEquals(listOf("Before loading your account copy"), RecoveryJournal.list(c, u).map { it.label })
        assertEquals(11, lot(JsonParser.parseString(CollectionEngine.saved()).asJsonObject, "l2")!!["qty"].asInt)
        assertEquals("Changes from both devices were combined. The previous device copy is saved in Recovery.", WorkspaceSync.notice.value)
        assertEquals(false, WorkspaceSync.readMeta(c, u)!!.dirty)
    }

    @Test fun sameLotEditedOnBoth() = runBlocking {
        val acct = Account(5, fx("qty-plus.json")["before"].toString()); WorkspaceSync.rows = acct
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        tap("cardOwnedQty", plus("l1"))
        acct.edit { o -> lot(o, "l1")!!.addProperty("qty", 9) }
        WorkspaceSync.pushNow(c)
        // Account first (sync-merge.js): the account's copy of the lot wins, never a sum.
        assertEquals(9, lot(acct.json(), "l1")!!["qty"].asInt)
        assertEquals("Your account copy is active. This device’s other edits are saved in Recovery.", WorkspaceSync.notice.value)
    }

    @Test fun accountChangedWithNoEditsHere() = runBlocking {
        val acct = Account(5, fx("qty-plus.json")["before"].toString()); WorkspaceSync.rows = acct
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        acct.edit { o -> lot(o, "l2")!!.addProperty("qty", 12) }
        val bumps = Decks.fullRevision.value
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        // Adopted: the device copy is the account's, and the pages reload it.
        assertEquals(acct.data, Decks.deviceFile(c, u).readText())
        assertEquals(bumps + 1, Decks.fullRevision.value)
        assertEquals(6, WorkspaceSync.readMeta(c, u)!!.revision)
        // The next tap runs on the new copy.
        tap("cardOwnedQty", plus("l2"))
        assertEquals(13, lot(JsonParser.parseString(Decks.deviceFile(c, u).readText()).asJsonObject, "l2")!!["qty"].asInt)
        WorkspaceSync.pushNow(c)
        assertEquals(13, lot(acct.json(), "l2")!!["qty"].asInt)
    }

    @Test fun editsWaitingWhenTheAccountIsReadAgain() = runBlocking {
        val acct = Account(5, fx("qty-plus.json")["before"].toString()); WorkspaceSync.rows = acct
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        tap("cardOwnedQty", plus("l1"))
        // A visit reads the account (still revision 5): the edit stays on the device and is pushed, never replaced by the older copy.
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        assertEquals(3, lot(JsonParser.parseString(Decks.deviceFile(c, u).readText()).asJsonObject, "l1")!!["qty"].asInt)
        WorkspaceSync.pushNow(c)
        assertEquals(3, lot(acct.json(), "l1")!!["qty"].asInt)
    }

    @Test fun firstWriteOnACopyAnEarlierVersionKept() = runBlocking {
        // 0.4.20 and before kept the account's copy here without a sync record.
        val before = fx("qty-plus.json")["before"].toString()
        Decks.deviceFile(c, u).writeText(before)
        val acct = Account(5, before); WorkspaceSync.rows = acct
        tap("cardOwnedQty", plus("l1"))
        acct.edit { o -> lot(o, "l2")!!.addProperty("qty", 11) }
        // Never linked: the push reads the account first, and the copy it was taken from is the baseline, so both edits survive.
        WorkspaceSync.pushNow(c)
        WorkspaceSync.pushNow(c)
        assertEquals(3, lot(acct.json(), "l1")!!["qty"].asInt)
        assertEquals(11, lot(acct.json(), "l2")!!["qty"].asInt)
        assertEquals(false, WorkspaceSync.readMeta(c, u)!!.dirty)
    }

    @Test fun accountWentBackwards() = runBlocking {
        val acct = Account(5, fx("qty-plus.json")["before"].toString()); WorkspaceSync.rows = acct
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        tap("cardOwnedQty", plus("l1"))
        // Restored elsewhere to revision 3 (cloud.js decideSync: "choose"): nothing is written until the player picks.
        WorkspaceSync.fromAccount(c, u, 3, acct.data)
        assertNotNull(WorkspaceSync.pending.value)
        assertEquals(WorkspaceSync.State.DECIDE, WorkspaceSync.status.value.state)
        assertEquals(0, acct.writes)
        // The sheet's sides (cloud.js summarize): the device has the extra Lightning Bolt.
        val dev = WorkspaceSync.summarize(Decks.deviceFile(c, u).readText()); val acc = WorkspaceSync.summarize(WorkspaceSync.pending.value!!.cloud.data)
        assertEquals(acc.copies + 1, dev.copies, 0.0); assertEquals(acc.names, dev.names)
        acct.revision = 3
        WorkspaceSync.resolve(c, "later")
        assertEquals(WorkspaceSync.State.ERROR, WorkspaceSync.status.value.state)
        assertEquals("Sync paused until you choose which copy to keep.", WorkspaceSync.status.value.msg)
        assertNotNull(WorkspaceSync.pending.value)
        WorkspaceSync.resolve(c, "account")
        assertNull(WorkspaceSync.pending.value)
        assertEquals(acct.data, Decks.deviceFile(c, u).readText())
        // The device's copy is kept (Recovery, and the backup file app.js downloads).
        assertEquals(3, lot(JsonParser.parseString(WorkspaceSync.recoveryFile(c, u).readText()).asJsonObject, "l1")!!["qty"].asInt)
        assertEquals("Before loading your account copy", downloads.single().first)
        assertEquals(3, lot(JsonParser.parseString(downloads.single().second).asJsonObject, "l1")!!["qty"].asInt)
        assertEquals(0, acct.writes)
        assertEquals(WorkspaceSync.State.SYNCED, WorkspaceSync.status.value.state)
    }

    @Test fun accountWentBackwardsKeepThisDevice() = runBlocking {
        val acct = Account(5, fx("qty-plus.json")["before"].toString()); WorkspaceSync.rows = acct
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        tap("cardOwnedQty", plus("l1"))
        acct.revision = 3; acct.edit { o -> lot(o, "l2")!!.addProperty("qty", 1) }; acct.revision = 3
        WorkspaceSync.fromAccount(c, u, acct.revision, acct.data)
        assertNotNull(WorkspaceSync.pending.value)
        // "Replace account with device copy": the account's copy is backed up first, then this device's goes up, revision-checked.
        WorkspaceSync.resolve(c, "device")
        assertNull(WorkspaceSync.pending.value)
        assertEquals("Account copy before replacing it", downloads.single().first)
        assertEquals(1, lot(JsonParser.parseString(downloads.single().second).asJsonObject, "l2")!!["qty"].asInt)
        assertEquals(1, lot(JsonParser.parseString(WorkspaceSync.recoveryFile(c, u).readText()).asJsonObject, "l2")!!["qty"].asInt)
        assertEquals(1, acct.writes); assertEquals(4, acct.revision)
        assertEquals(3, lot(acct.json(), "l1")!!["qty"].asInt); assertEquals(10, lot(acct.json(), "l2")!!["qty"].asInt)
        assertEquals(false, WorkspaceSync.readMeta(c, u)!!.dirty)
        assertEquals(WorkspaceSync.State.SYNCED, WorkspaceSync.status.value.state)
    }

    @Test fun backupFileIsTheSitesEnvelope() {
        val data = """{"version":3,"collection":[{"id":"l1","qty":2}],"lastSavedAt":"2026-11-05T13:20:00.000Z"}"""
        val o = JsonParser.parseString(WorkspaceSync.backupEnvelope(data, java.time.Instant.parse("2026-11-05T14:02:03.456789Z"))).asJsonObject
        assertEquals(listOf("version", "collection", "lastSavedAt", "exportedAt", "backupKind", "schemaVersion"), o.keySet().toList())
        assertEquals("2026-11-05T14:02:03.456Z", o["exportedAt"].asString)
        assertEquals("cardforge-workspace", o["backupKind"].asString); assertEquals(3, o["schemaVersion"].asInt)
        assertEquals("CardStashy_Backup_Account_copy_before_replacing_it_2026-11-05.json", WorkspaceSync.backupName("Account copy before replacing it", java.time.LocalDate.of(2026, 11, 5)))
        assertEquals("CardStashy_Backup_Before_loading_your_account_copy_2026-11-05.json", WorkspaceSync.backupName("Before loading your account copy", java.time.LocalDate.of(2026, 11, 5)))
    }
}
