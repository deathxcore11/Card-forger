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

    /** dialog.js ask: a question the player answers before the write runs; yes taps again with confirmed. */
    data class Ask(val question: String, val kind: String, val data: JsonObject)
    private val _ask = MutableStateFlow<Ask?>(null); val ask: StateFlow<Ask?> = _ask
    fun answer(yes: Boolean, context: Context, scope: kotlinx.coroutines.CoroutineScope) {
        val a = _ask.value ?: return; _ask.value = null
        if (yes) scope.launch { act(context, a.kind, a.data.deepCopy().apply { addProperty("confirmed", true) }) }
    }

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
     * One saving tap: [kind] is the site's data-act (cardWishlist, cardOwnedQty, qty, wishRemove, tEntryQty, tWish) and [data]
     * the button's dataset. True when something was saved.
     */
    suspend fun act(context: Context, kind: String, data: JsonObject): Boolean {
        val s = Account.session.value ?: run { show("Sign in to save cards to your collection."); return false }
        val app = context.applicationContext
        pendingAsk = Ask("", kind, data)
        val r = WorkspaceSync.lock.withLock {
            if (!ensureCollection(app, s.userId, true, Decks.fullRevision.value)) return false.also { show("Your collection is still loading. Try again in a moment.") }
            val r = CollectionEngine.act(kind, data)
            if ((r["writes"]?.asInt ?: 0) > 0) { val text = CollectionEngine.saved(); withContext(Dispatchers.IO) { WorkspaceSync.wroteLocally(app, s.userId, text) } }
            r
        }
        return done(r)
    }

    /** app.js A.undo: the toast's Undo. */
    suspend fun undo(context: Context) {
        val s = Account.session.value ?: return
        val app = context.applicationContext
        val r = WorkspaceSync.lock.withLock {
            if (!ensureCollection(app, s.userId, true, Decks.fullRevision.value)) return
            val r = CollectionEngine.undo()
            if ((r["writes"]?.asInt ?: 0) > 0) { val text = CollectionEngine.saved(); withContext(Dispatchers.IO) { WorkspaceSync.wroteLocally(app, s.userId, text) } }
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
