package dev.cardstashy.nativeplay.ui

import android.content.Context
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.collection.WorkspaceSync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * The Collection taps that save (the wishlist heart, the owned − and +, the wanted card's ×) as the site runs them: the site's
 * own handler and app.js commit in the engine, this device's copy written at once, the account a few seconds later
 * (WorkspaceSync). What app.js does around the commit is here: the toast with its Undo (app.js toast), the haptic (success, or
 * warn for a removal), the soft chime for something kept (COL-005), and dialog.js ask's question before a removal.
 */
internal object CollectionWrites {
    /** The card page's saving buttons (views.js / tcg.js card sheets, quick-quantity.js detailOwnedGroups). */
    val CARD_ACTS = setOf("cardWishlist", "cardOwnedQty")
    /** app.js toast(text, {undo}); [id] tells two identical toasts apart. */
    data class Toast(val text: String, val undo: Boolean, val id: Long = System.nanoTime())
    private val _toast = MutableStateFlow<Toast?>(null); val toast: StateFlow<Toast?> = _toast
    fun dismiss(t: Toast) { if (_toast.value == t) _toast.value = null }
    fun show(text: String, undo: Boolean = false) { _toast.value = Toast(text, undo) }

    /** dialog.js ask: a question the player answers before the write runs; yes taps again with confirmed (or runs [then]). */
    data class Ask(val question: String, val kind: String, val data: JsonObject, val then: (suspend () -> Unit)? = null, val after: ((JsonObject) -> Unit)? = null)
    private val _ask = MutableStateFlow<Ask?>(null); val ask: StateFlow<Ask?> = _ask
    fun answer(yes: Boolean, context: Context, scope: kotlinx.coroutines.CoroutineScope) {
        val a = _ask.value ?: return; _ask.value = null
        if (yes) scope.launch { a.then?.invoke() ?: act(context, a.kind, a.data.deepCopy().apply { addProperty("confirmed", true) }, a.after) }
    }
    /** dialog.js askText(question, value): the words typed (trimmed), or null for Cancel. One at a time. */
    data class AskText(val question: String, val value: String, val reply: kotlinx.coroutines.CompletableDeferred<String?> = kotlinx.coroutines.CompletableDeferred())
    val askingText = MutableStateFlow<AskText?>(null)
    suspend fun askText(question: String, value: String): String? {
        val a = AskText(question, value); askingText.value = a
        return try { a.reply.await() } finally { if (askingText.value === a) askingText.value = null }
    }
    /** dialog.js ask(question) for anything else: [then] runs on yes. */
    fun confirm(question: String, then: suspend () -> Unit) { _ask.value = Ask(question, "", JsonObject(), then) }

    /** The account panel's "Choose which copy to keep" (app.js A.syncDecide): the sheet is open. */
    val deciding = MutableStateFlow(false)

    internal fun askForTest(a: Ask?) { _ask.value = a }

    /** Bumped after every write, so an open page reads its model again. */
    private val _written = MutableStateFlow(0L); val written: StateFlow<Long> = _written
    /** The haptic and sound of the last write, for the page to play (it holds the View): "success" or "warn", and the chime. */
    data class Feel(val kind: String, val chime: Boolean, val id: Long = System.nanoTime())
    val feel = MutableStateFlow<Feel?>(null)

    /** The sync's way into the engine: this device's copy, loaded when the engine doesn't hold it. */
    fun init() {
        WorkspaceSync.ensureEngine = { c, u -> Account.session.value?.userId == u && ensureCollection(c, u, true, Decks.fullRevision.value) }
        WorkspaceSync.engineHolds = { u, rev -> HomeCache.loaded = "$u|$rev" }
    }

    /**
     * One saving tap: [kind] is the site's data-act (cardWishlist, cardOwnedQty, qty, wishRemove, tEntryQty, tWish, addDelete, deckQty,
     * deckRemove, deckEmbSwap, deckAdd, addToDeck) and
     * [data] the button's dataset. True when something was saved; [after] then gets the result (its `made`), here or once a
     * question before it is answered yes.
     */
    suspend fun act(context: Context, kind: String, data: JsonObject, after: ((JsonObject) -> Unit)? = null): Boolean {
        pendingAsk = Ask("", kind, data, after = after)
        val r = commitAct(context, kind, data) ?: return false
        val saved = done(r)
        if (kind == "addDelete" && saved) adding.value = null
        if (saved) { settleLater(context); after?.invoke(r) }
        return saved
    }

    /** The write itself: under the sync's lock, in the engine holding this device's copy, then that copy written. Null: not run. */
    private suspend fun commitAct(context: Context, kind: String, data: JsonObject): JsonObject? {
        val s = Account.session.value ?: run { show("Sign in to save cards to your collection."); return null }
        val app = context.applicationContext
        return WorkspaceSync.lock.withLock {
            if (!ensureCollection(app, s.userId, true, Decks.fullRevision.value)) return null.also { show("Your collection is still loading. Try again in a moment.") }
            val r = CollectionEngine.act(kind, data)
            if ((r["writes"]?.asInt ?: 0) > 0 || CollectionEngine.bg() > 0) { val text = CollectionEngine.saved(); withContext(Dispatchers.IO) { WorkspaceSync.wroteLocally(app, s.userId, text) } }
            r
        }
    }

    /**
     * What a commit sets going after it (app.js: the changed lots' condition quotes, kept on them and saved): the engine runs it
     * to the end, and anything it saved is written like a tap.
     */
    fun settleLater(context: Context) {
        val app = context.applicationContext
        settling?.cancel()
        settling = bg.launch { CollectionEngine.settle(20_000); keepBackground(app) }
    }
    private val bg = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.IO)
    private var settling: kotlinx.coroutines.Job? = null
    /**
     * app.js refreshMagicCollectionPrices, as the Magic Collection view runs it: a day-old card's data read again (today's prices and its
     * TCGplayer number, which the condition prices and "Find this condition on TCGplayer" need). The catalog and the printings saved
     * with lots are kept (the account too); the page repaints.
     */
    suspend fun refreshMagicPrices(context: Context) {
        val app = context.applicationContext
        val r = runCatching { CollectionEngine.pricesRefresh(false) }.getOrNull()
        keepCatalog(app)
        keepBackground(app)
        if (r?.getAsJsonObject("result")?.get("refreshed")?.asInt ?: 0 > 0) _written.value++
    }
    /** Saves the engine made outside a tap (condition quotes on lots) go to this device's copy and the account. */
    suspend fun keepBackground(context: Context) {
        val s = Account.session.value ?: return
        WorkspaceSync.lock.withLock {
            if (CollectionEngine.bg() > 0) { val text = CollectionEngine.saved(); WorkspaceSync.wroteLocally(context.applicationContext, s.userId, text); _written.value++ }
        }
    }

    /** The add / edit sheet (app.js addSheet): what opened it, and the route's way to the site's list import (not native yet). */
    data class AddOpen(val req: JsonObject, val onList: (() -> Unit)? = null, val id: Long = System.nanoTime())
    val adding = MutableStateFlow<AddOpen?>(null)
    fun openAdd(req: JsonObject, onList: (() -> Unit)? = null) { adding.value = AddOpen(req, onList) }
    /**
     * A card page's Add to deck (app.js A.cardDeckPicker): the card, and what the sheet's ✕ (closeSheet: the card page too) and
     * Open Decks do on the page that opened it.
     */
    data class DeckPick(val game: String, val name: String, val closeAll: () -> Unit, val go: (String) -> Unit, val id: Long = System.nanoTime())
    val picking = MutableStateFlow<DeckPick?>(null)
    /** The picker's decks from this device's collection: {decks: [[id, name]], selected}. Null (with a toast) when it can't open. */
    suspend fun deckPickModel(context: Context, game: String): JsonObject? {
        val s = Account.session.value ?: return null.also { show("Sign in to save cards to your collection.") }
        return WorkspaceSync.lock.withLock {
            if (!ensureCollection(context.applicationContext, s.userId, true, Decks.fullRevision.value)) return null.also { show("Your collection is still loading. Try again in a moment.") }
            CollectionEngine.deckPick(game)
        }
    }

    /**
     * A deck's ⋯ menu (app.js A.deckMenu) over the page that opened it: what its shortcuts, the actions still on the website, a
     * duplicate and a deletion do there.
     */
    data class DeckMenuOpen(val deck: String, val tab: (String) -> Unit, val web: (act: String, scope: String) -> Unit, val openDeck: (String) -> Unit,
                            val deleted: () -> Unit, val id: Long = System.nanoTime())
    val menu = MutableStateFlow<DeckMenuOpen?>(null)
    /** The menu's model from this device's collection (CollectionEngine.deckMenu). Null (with a toast) when it can't open. */
    suspend fun deckMenuModel(context: Context, deck: String): JsonObject? = withCollection(context) { CollectionEngine.deckMenu(deck) }
    /** core.js exportDeckText for the deck and app.js's file name for it: {text, file}. */
    suspend fun deckText(context: Context, deck: String): JsonObject? = withCollection(context) { CollectionEngine.deckText(deck) }
    private suspend fun withCollection(context: Context, run: suspend () -> JsonObject): JsonObject? {
        val s = Account.session.value ?: return null.also { show("Sign in to save cards to your collection.") }
        return WorkspaceSync.lock.withLock {
            if (!ensureCollection(context.applicationContext, s.userId, true, Decks.fullRevision.value)) return null.also { show("Your collection is still loading. Try again in a moment.") }
            run()
        }
    }
    /** app.js download(name, text): the file in Downloads (this app's own folder before Android 10), as the browser saves it. */
    @Volatile internal var download: (Context, String, String) -> Unit = { c, name, text -> saveText(c, name, text) }
    private fun saveText(c: Context, name: String, text: String) {
        val bytes = text.toByteArray()
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            val r = c.contentResolver
            val v = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name); put(android.provider.MediaStore.Downloads.MIME_TYPE, "text/plain")
                put(android.provider.MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = r.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: error("Couldn’t save the file.")
            r.openOutputStream(uri)!!.use { it.write(bytes) }
            r.update(uri, android.content.ContentValues().apply { put(android.provider.MediaStore.Downloads.IS_PENDING, 0) }, null, null)
        } else java.io.File(c.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS) ?: c.filesDir, name).writeBytes(bytes)
    }

    /** A Yu-Gi-Oh! or Pokémon card's Add to collection (tcg.js A.tOwn): the button's dataset and its game; [saved] repaints what opened it, [closeAll] is the ✕ (the card page goes too). */
    data class TcgAddOpen(val req: JsonObject, val saved: () -> Unit = {}, val closeAll: () -> Unit = {}, val id: Long = System.nanoTime())
    val tAdding = MutableStateFlow<TcgAddOpen?>(null)
    /** tcgAddSheet's model from this device's collection, the condition feed signed in. Null (with a toast) when it can't open. */
    suspend fun tAddModel(context: Context, req: JsonObject): JsonObject? {
        val token = Account.token()
        return withCollection(context) { CollectionEngine.auth(token); CollectionEngine.tAddOpen(req) }
    }
    fun tAddClosed(ctx: Int) { bg.launch { CollectionEngine.tAddClose(ctx) } }

    /** app.js closeSheet for the add sheet whose model said [ctx]. */
    fun addClosed(ctx: Int) { bg.launch { CollectionEngine.addClose(ctx) } }

    /**
     * app.js addSheet's model for [req] ({entry} to edit a lot, {own, fromCard} for Got it, {} empty): this device's collection
     * held by the engine, and the account's sign-in handed to the condition feed. Null (with a toast) when it can't open.
     */
    suspend fun addModel(context: Context, req: JsonObject): JsonObject? {
        val s = Account.session.value ?: return null.also { show("Sign in to save cards to your collection.") }
        val app = context.applicationContext
        val token = Account.token()
        return WorkspaceSync.lock.withLock {
            if (!ensureCollection(app, s.userId, true, Decks.fullRevision.value)) return null.also { show("Your collection is still loading. Try again in a moment.") }
            CollectionEngine.auth(token)
            CollectionEngine.addOpen(req)
        }
    }

    /** app.js saveLot: the form's save. Null when saved (the sheet closes, the toast says so); otherwise the words for under the form. */
    suspend fun addSave(context: Context, form: JsonObject): String? {
        val r = commitAct(context, "addSave", form) ?: return "Your collection is still loading. Try again in a moment."
        r["error"]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let { return it }
        if ((r["writes"]?.asInt ?: 0) == 0) return null.also { adding.value = null }
        done(r); adding.value = null; settleLater(context)
        return null
    }

    /** app.js A.undo: the toast's Undo. */
    suspend fun undo(context: Context) {
        val s = Account.session.value ?: return
        val app = context.applicationContext
        val r = WorkspaceSync.lock.withLock {
            if (!ensureCollection(app, s.userId, true, Decks.fullRevision.value)) return
            val r = CollectionEngine.undo()
            if ((r["writes"]?.asInt ?: 0) > 0 || CollectionEngine.bg() > 0) { val text = CollectionEngine.saved(); withContext(Dispatchers.IO) { WorkspaceSync.wroteLocally(app, s.userId, text) } }
            r
        }
        done(r)
    }

    private fun done(r: JsonObject): Boolean {
        r["error"]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let { show(it); return false }
        val writes = r["writes"]?.asInt ?: 0
        r["ask"]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let { q -> pendingAsk?.let { _ask.value = it.copy(question = q) }; return false }
        val toasts = r.getAsJsonArray("toasts")?.mapNotNull { it as? JsonObject }.orEmpty()
        toasts.lastOrNull()?.let { t ->
            val text = t["text"].asString
            _toast.value = Toast(text, t["undo"]?.asBoolean == true)
            // app.js commit: a removal buzzes twice, anything else gets the success beat; something kept also chimes.
            val removed = Regex("^(−|-|Removed|Deleted|Cleared|Undid)").containsMatchIn(text)
            if (writes > 0) feel.value = Feel(if (removed) "warn" else "success", !removed && Regex("^(Added|Saved|Moved|Cards added|Deck (saved|imported|updated))\\b").containsMatchIn(text))
        }
        if (writes > 0) _written.value++
        return writes > 0
    }
    /** The tap a question belongs to, set by [act] just before it runs. */
    private var pendingAsk: Ask? = null
}
