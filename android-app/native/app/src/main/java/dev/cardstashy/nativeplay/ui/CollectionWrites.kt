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
    data class Ask(val question: String, val kind: String, val data: JsonObject, val then: (suspend () -> Unit)? = null, val after: ((JsonObject) -> Unit)? = null,
                   val site: SiteAsk? = null)
    /** dialog.js open's own title, buttons and danger, when a site handler asked (the engine's siteRun). */
    data class SiteAsk(val title: String, val ok: String, val cancel: String, val danger: Boolean)
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
    suspend fun act(context: Context, kind: String, data: JsonObject, after: ((JsonObject) -> Unit)? = null): Boolean = actSaying(context, kind, data, {}, after)
    /** [act] for a tap whose handler says how it is going ([onStep]: "Checking 2/9…", a status line it writes). */
    suspend fun actSaying(context: Context, kind: String, data: JsonObject, onStep: (String) -> Unit, after: ((JsonObject) -> Unit)? = null): Boolean {
        pendingAsk = Ask("", kind, data, after = after)
        val r = commitAct(context, kind, data, when (kind) { in CHECK_ACTS -> 600_000; in LONG_ACTS -> 120_000; else -> 15_000 }, onStep) ?: return false
        // The words the handler left on the page last (tcg.js's #tImpStatus: "Paste a list first.", what wasn't found).
        r["texts"]?.takeIf { it.isJsonObject }?.asJsonObject?.entrySet()?.lastOrNull()?.value?.takeIf { it.isJsonPrimitive }?.asString?.let(onStep)
        // What a site handler gave the browser (siteRun): the list it copied goes on the clipboard, the page it opened opens.
        r["copied"]?.takeIf { it.isJsonPrimitive }?.asString?.let { t ->
            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            cm.setPrimaryClip(android.content.ClipData.newPlainText("CardStashy", t)) }
        r["opened"]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.startsWith("https://") }?.let { u ->
            runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(u)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } }
        // A file it downloaded (tcg.js A.tExportColl): saved to Downloads, as the browser saves it.
        r["downloaded"]?.takeIf { it.isJsonObject }?.asJsonObject?.let { f -> saveFile(context, f) }
        // The recovery copy a whole-collection replacement keeps first (app.js commit's recovery: RECOVERY in this device's storage).
        r["recovery"]?.takeIf { it.isJsonPrimitive }?.asString?.let { t -> Account.session.value?.userId?.let { u ->
            runCatching { withContext(Dispatchers.IO) { java.io.File(Decks.deviceFile(context.applicationContext, u).parentFile, "recovery-$u.json").writeText(t) } } } }
        val saved = done(r)
        if (kind == "addDelete" && saved) adding.value = null
        if (saved) { settleLater(context); after?.invoke(r) }
        return saved
    }

    /** A tap that may save nothing (the Scanner's condition price): its raw result ({made, error…}); null when it could not run. */
    suspend fun actRaw(context: Context, kind: String, data: JsonObject): JsonObject? = commitAct(context, kind, data, 30_000)

    /** The write itself: under the sync's lock, in the engine holding this device's copy, then that copy written. Null: not run. */
    /** Taps that read the card sources for a while (every card's price, each card's printings). */
    private val LONG_ACTS = setOf("tDeckRefresh", "tDeckCheapest", "tDeckCopyMissing", "refreshPrices", "tRefreshPrices", "tImpColl", "tImpDeck", "impApply", "provenSave", "refreshDeck")
    /** Taps that check card after card against Scryfall (Verify exact printings, the import's Check names & printings). */
    private val CHECK_ACTS = setOf("verifyAll", "impVerify")
    private suspend fun commitAct(context: Context, kind: String, data: JsonObject, ms: Long = 15_000, onStep: (String) -> Unit = {}): JsonObject? {
        val s = Account.session.value ?: run { show("Sign in to save cards to your collection."); return null }
        val app = context.applicationContext
        return WorkspaceSync.lock.withLock {
            if (!ensureCollection(app, s.userId, true, Decks.fullRevision.value)) return null.also { show("Your collection is still loading. Try again in a moment.") }
            val r = CollectionEngine.act(kind, data, ms, onStep)
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
    /**
     * A save a panel's tap made just before it opens another page (app.js A.copyRef / makeMyVersion: commit, then go("#deck/<id>")):
     * kept first, out of the page's scope so leaving the page can't cancel it, then [then] on the main thread, as scopedCommit saves
     * before go() on the site.
     */
    fun keepThen(context: Context, then: () -> Unit) {
        val app = context.applicationContext
        bg.launch { runCatching { keepBackground(app) }; withContext(Dispatchers.Main) { then() } }
    }
    /** Saves the engine made outside a tap (condition quotes on lots) go to this device's copy and the account. */
    suspend fun keepBackground(context: Context) {
        val s = Account.session.value ?: return
        WorkspaceSync.lock.withLock {
            // The file write off Main: refreshMagicPrices runs this from the page.
            if (CollectionEngine.bg() > 0) { val text = CollectionEngine.saved(); withContext(Dispatchers.IO) { WorkspaceSync.wroteLocally(context.applicationContext, s.userId, text) }; _written.value++ }
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
    /** pricehist.js alertSheet (app.js A.priceAlert) for card [cardId] of [game]; [saved] redraws the page that opened it. */
    data class AlertOpen(val game: String, val cardId: String, val name: String, val saved: () -> Unit = {}, val id: Long = System.nanoTime())
    val alerting = MutableStateFlow<AlertOpen?>(null)
    /**
     * Compare cards (app.js A.compareOpen / compareFrom, tcg.js A.tCompareOpen / tCompareFrom) for [game]; [first] a card to put in the
     * first empty side (a Magic name, else the card id); [openCard] opens a compared card's page (name, id).
     */
    data class CompareOpen(val game: String, val first: String? = null, val openCard: (String, String) -> Unit = { _, _ -> }, val id: Long = System.nanoTime())
    val comparing = MutableStateFlow<CompareOpen?>(null)
    /** Counts alert saves and removals: the Value tab's alert list reads again. */
    val alertsChanged = MutableStateFlow(0)
    /** A tap with the site's data-act="priceAlert" dataset (game, id, name). */
    fun openAlert(d: Map<String, String>, saved: () -> Unit = {}) {
        val g = d["game"].orEmpty(); val id = d["id"].orEmpty(); if (g.isBlank() || id.isBlank()) return
        alerting.value = AlertOpen(g, id, d["name"].orEmpty().ifBlank { "This card" }, saved)
    }
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
                            val deleted: () -> Unit, val id: Long = System.nanoTime(), val game: String = "mtg", val share: () -> Unit = {},
                            val site: (String) -> Unit = {})
    val menu = MutableStateFlow<DeckMenuOpen?>(null)
    /** The menu's model from this device's collection (CollectionEngine.deckMenu). Null (with a toast) when it can't open. */
    suspend fun deckMenuModel(context: Context, deck: String, game: String = "mtg"): JsonObject? =
        withCollection(context) { if (game == "mtg") CollectionEngine.deckMenu(deck) else CollectionEngine.tdeckMenu(game, deck) }
    /** core.js exportDeckText for the deck and app.js's file name for it: {text, file}; a Yu-Gi-Oh! or Pokémon deck's {text, export, file}. */
    suspend fun deckText(context: Context, deck: String, game: String = "mtg"): JsonObject? =
        withCollection(context) { if (game == "mtg") CollectionEngine.deckText(deck) else CollectionEngine.tdeckText(game, deck) }
    /** app.js A.proxies' page (CollectionEngine.proxies). */
    suspend fun proxiesModel(context: Context, deck: String, scope: String): JsonObject? = withCollection(context) { CollectionEngine.proxies(deck, scope) }
    /** app.js acquireSheet's model (CollectionEngine.acquire). */
    suspend fun acquireModel(context: Context, deck: String, mode: String): JsonObject? = withCollection(context) { CollectionEngine.acquire(deck, mode) }
    /** app.js A.deckToPlay's list for Play (CollectionEngine.deckPlay). */
    suspend fun deckPlay(context: Context, deck: String): JsonObject? = withCollection(context) { CollectionEngine.deckPlay(deck) }
    private suspend fun withCollection(context: Context, run: suspend () -> JsonObject): JsonObject? {
        val s = Account.session.value ?: return null.also { show("Sign in to save cards to your collection.") }
        return WorkspaceSync.lock.withLock {
            if (!ensureCollection(context.applicationContext, s.userId, true, Decks.fullRevision.value)) return null.also { show("Your collection is still loading. Try again in a moment.") }
            run()
        }
    }
    /**
     * Collection › Decks' Random Commander and Random deck (app.js A.randomDeck, A.randomDeckOptions): deck-experience.js's Build a deck
     * with [request] ({format: Commander, commanderLock} or {}), its first card picked at once. [web] opens the website (a phone whose
     * WebView can't build: it presses [act] there, or a card control that isn't native).
     */
    data class BuildOpen(val request: JsonObject, val act: String, val web: (url: String, press: String?) -> Unit, val id: Long = System.nanoTime())
    val building = MutableStateFlow<BuildOpen?>(null)
    /** The workspace Build a deck reads (CollectionEngine.flowWorkspace), from this device's copy; null (with a toast) when it can't. */
    suspend fun flowWorkspace(context: Context): String? {
        val s = Account.session.value ?: return null.also { show("Sign in to save cards to your collection.") }
        return WorkspaceSync.lock.withLock {
            if (!ensureCollection(context.applicationContext, s.userId, true, Decks.fullRevision.value)) return null.also { show("Your collection is still loading. Try again in a moment.") }
            CollectionEngine.flowWorkspace()
        }
    }

    /** app.js download(name, text): the file in Downloads (this app's own folder before Android 10), as the browser saves it. */
    @Volatile internal var download: (Context, String, String) -> Unit = { c, name, text -> saveText(c, name, text) }
    /** A file the site downloads ({name, text}): saved to Downloads, the toast saying where (as a deck's export does). */
    suspend fun saveFile(context: Context, f: JsonObject) {
        val name = f.get("name")?.asString ?: return; val text = f.get("text")?.asString ?: return
        runCatching { withContext(Dispatchers.IO) { download(context.applicationContext, name, text) } }
            .onSuccess { show("Saved $name to Downloads.") }.onFailure { show("Couldn’t save $name.") }
    }
    private fun saveText(c: Context, name: String, text: String) {
        val bytes = text.toByteArray()
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            val r = c.contentResolver
            val v = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name); put(android.provider.MediaStore.Downloads.MIME_TYPE, if (name.endsWith(".csv", true)) "text/csv" else "text/plain")
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
    /** Import a deck / New deck closed while its run is going: closeSheet in the engine, so the run saves nothing. */
    fun tDeckSheetClosed() { bg.launch { runCatching { CollectionEngine.tDeckSheetClose() } } }

    /**
     * An open binder (app.js showBinder): its game, id and page, and what a pocket's card (data-act card / tCard and its dataset)
     * and the set checklist link do on the page that opened it. [card] gets the binder back, to reopen when that card page closes.
     */
    data class BinderOpen(val game: String, val binder: String, val page: Int = 0,
                          val card: (act: String, data: JsonObject, name: String, back: BinderOpen) -> Unit = { _, _, _, _ -> },
                          val set: (String) -> Unit = {}, val id: Long = System.nanoTime(),
                          /** A friend's shared binder (community-profile.js item): read-only, its pockets open A.sharedCard. */
                          val shared: JsonObject? = null)
    val binder = MutableStateFlow<BinderOpen?>(null)
    /**
     * app.js binderEditor: New binder ([binder] blank) or Binder settings; [back] is the binder it was opened from (sheet history),
     * [open] shows a binder at a page (a changed binder opens again once saved).
     */
    data class BinderEditOpen(val game: String, val binder: String, val back: BinderOpen? = null, val open: (id: String, page: Int) -> Unit = { _, _ -> },
                              val id: Long = System.nanoTime())
    val binderEditing = MutableStateFlow<BinderEditOpen?>(null)
    /** app.js tileMenu on a held binder: Open binder and Edit cover and cards; [hold] is the engine's {title, items}, [open] shows a binder. */
    data class BinderHoldOpen(val game: String, val binder: String, val hold: JsonObject, val open: (id: String, page: Int) -> Unit, val id: Long = System.nanoTime())
    val binderHold = MutableStateFlow<BinderHoldOpen?>(null)
    /** binders.js binderPage's model for page [page] of binder [id] from this device's collection; {gone} once deleted. Null (with a toast) when it can't open. */
    /** app.js showcaseChoices: this device's binders and decks as shareable snapshots; null (with a toast) when the collection can't load. */
    suspend fun showcaseChoices(context: Context): com.google.gson.JsonArray? =
        withCollection(context) { JsonObject().apply { add("items", CollectionEngine.showcaseChoices()) } }?.getAsJsonArray("items")
    /** createCommunity's refresh: your shared [items] repaired from this device (repairOwnShowcase), quietly; empty when nothing can be read. */
    suspend fun showcaseRepair(context: Context, items: com.google.gson.JsonArray): com.google.gson.JsonArray {
        val s = Account.session.value ?: return com.google.gson.JsonArray()
        return runCatching { WorkspaceSync.lock.withLock {
            if (!ensureCollection(context.applicationContext, s.userId, true, Decks.fullRevision.value)) null else CollectionEngine.showcaseRepair(items)
        } }.getOrNull() ?: com.google.gson.JsonArray()
    }
    suspend fun sharedBinderModel(context: Context, item: JsonObject, page: Int): JsonObject? =
        withCollection(context) { CollectionEngine.sharedBinder(item, page) }
    suspend fun sharedDeckModel(context: Context, item: JsonObject): JsonObject? =
        withCollection(context) { CollectionEngine.sharedDeck(item) }
    suspend fun binderModel(context: Context, game: String, id: String, page: Int): JsonObject? =
        withCollection(context) { CollectionEngine.binder(game, id, page) }
    /** app.js binderEditor's fields for binder [id] (blank: a new one). */
    suspend fun binderEditModel(context: Context, game: String, id: String): JsonObject? =
        withCollection(context) { CollectionEngine.binderEdit(game, id) }

    /**
     * workbench-ui.js A.batchAction: the Select tray's Move, Add to deck, Wishlist or Compare sheet for [game], as the engine read it
     * (CollectionEngine.batchSheet); its button saves through act("batchApply").
     */
    data class BatchOpen(val game: String, val model: JsonObject, val id: Long = System.nanoTime())
    val batch = MutableStateFlow<BatchOpen?>(null)
    /** Opens the tray's [kind] sheet, or shows the site's toast in its place (Compare with more than four). */
    suspend fun openBatch(context: Context, game: String, kind: String) {
        val m = withCollection(context) { CollectionEngine.batchSheet(game, kind) } ?: return
        m.get("toast")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let { show(it); return }
        if (m.get("kind")?.isJsonPrimitive == true) batch.value = BatchOpen(game, m)
    }

    /** Magic Collection's ⋯ (app.js A.collMenu) over the Cards page; [lookups] runs the card lookups again (after Retry). */
    data class MenuOpen(val lookups: () -> Unit = {}, val id: Long = System.nanoTime())
    val collMenu = MutableStateFlow<MenuOpen?>(null)
    suspend fun collMenuModel(context: Context): JsonObject? = withCollection(context) { CollectionEngine.collMenu() }
    /** app.js A.exportCSV: the collection as a ManaBox-style CSV, saved to Downloads. */
    suspend fun exportCSV(context: Context) { withCollection(context) { CollectionEngine.exportCSV() }?.let { saveFile(context, it) } }
    /**
     * The list import: Magic's "Import cards you own" (app.js importCollectionSheet) or Yu-Gi-Oh! / Pokémon's "Paste cards you own"
     * (tcg.js tcgImportSheet "coll"), by [game]. [one] is the Magic sheet's One card (the add sheet); [imported] runs once it saved
     * (go("#collection/cards")).
     */
    data class ImportOpen(val game: String = "mtg", val one: (() -> Unit)? = null, val imported: () -> Unit = {}, val id: Long = System.nanoTime())
    val importing = MutableStateFlow<ImportOpen?>(null)
    suspend fun importSheet(context: Context, game: String): JsonObject? =
        withCollection(context) { if (game == "mtg") CollectionEngine.importSheet() else CollectionEngine.tImportSheet(game) }
    /** One of the import sheet's own taps, in the engine holding this device's copy (it writes nothing). */
    suspend fun importDo(context: Context, run: suspend () -> JsonObject): JsonObject? = withCollection(context) { run() }

    /** The website, for the pages that open there (CollectionWrites' links). */
    const val SITE = "https://cardstashy.com/"
    /** app.js A.newDeck's sheet ([commander] prefilled); [openDeck] opens the new deck's page on a tab (go(`#deck/<id>/<tab>`)). */
    data class NewDeckOpen(val commander: String = "", val openDeck: (id: String, tab: String) -> Unit, val id: Long = System.nanoTime())
    val newDeck = MutableStateFlow<NewDeckOpen?>(null)
    suspend fun newDeckModel(context: Context, commander: String): JsonObject? = withCollection(context) { CollectionEngine.newDeck(commander) }
    /**
     * app.js deckImportSheet([preset]) for [deck] (the ⋯ menu's Re-import; null from the Decks page). [openDeck] opens a deck's page on a
     * tab; [web] opens a page of the website (an Idea's Ideas tab).
     */
    data class DeckImportOpen(val preset: JsonObject = JsonObject(), val deck: String? = null, val openDeck: (id: String, tab: String) -> Unit,
                              val web: (String) -> Unit, val id: Long = System.nanoTime(),
                              /** app.js A.previewPrecon: the sheet runs Preview & match (A.dImpPreview) as it opens. */
                              val preview: Boolean = false)
    val deckImport = MutableStateFlow<DeckImportOpen?>(null)
    suspend fun deckImportModel(context: Context, preset: JsonObject, deck: String?): JsonObject? = withCollection(context) { CollectionEngine.deckImport(preset, deck) }
    /**
     * Yu-Gi-Oh! / Pokémon's Import a deck (tcg.js A.tImport) or New deck (A.tNewDeck, [format]: Meta decks' Create a … deck's data-format)
     * for [game]; [openDeck] opens the saved deck's page (go("#tdeck/<id>")).
     */
    data class TcgDeckOpen(val game: String, val format: String = "", val openDeck: (id: String) -> Unit, val id: Long = System.nanoTime())
    val tDeckImport = MutableStateFlow<TcgDeckOpen?>(null)
    val tNewDeck = MutableStateFlow<TcgDeckOpen?>(null)
    suspend fun tDeckImportModel(context: Context, game: String): JsonObject? = withCollection(context) { CollectionEngine.tDeckImportSheet(game) }
    suspend fun tNewDeckModel(context: Context, game: String, format: String): JsonObject? = withCollection(context) { CollectionEngine.tNewDeckSheet(game, format) }
    /** Magic's Deck review sheet (views.js deckReviewSheet) for [deck]; null (with a toast) when it can't open. */
    suspend fun reviewModel(context: Context, deck: String): JsonObject? = withCollection(context) { CollectionEngine.deckReview(deck) }
    /** The review's Find {role} cards / Find {format} cards: the search left in the engine for the Search tab. */
    suspend fun reviewSearch(context: Context, kind: String, deck: String, role: String): JsonObject? = withCollection(context) { CollectionEngine.reviewSearch(kind, deck, role) }
    /** app.js acquireSheet for a deck: A.acquire's "Cards I got" ([mode] missing) or A.deckBought's whole deck (purchase). */
    data class AcquireOpen(val deck: String, val mode: String, val id: Long = System.nanoTime())
    val acquiring = MutableStateFlow<AcquireOpen?>(null)
    /** app.js A.proxies' page, opened as the site opens it in a new window: the sheet's html and its title. */
    data class ProxyOpen(val html: String, val title: String, val file: String, val id: Long = System.nanoTime())
    val proxySheet = MutableStateFlow<ProxyOpen?>(null)
    /** app.js A.proxies for deck [deck]: the page opens, or the site's toast when there's nothing to print. */
    suspend fun proxies(context: Context, deck: String, scope: String) {
        val m = proxiesModel(context, deck, scope) ?: return
        m["toast"]?.takeIf { it.isJsonPrimitive }?.asString?.let { show(it); return }
        val html = m["html"]?.takeIf { it.isJsonPrimitive }?.asString ?: return
        proxySheet.value = ProxyOpen(html, m["title"]?.asString.orEmpty(), m["file"]?.asString.orEmpty())
    }
    /** A deck's share sheet (views.js shareSheet; tcg.js A.tShare for the other games). [preview]: opens the link (the shared deck's page). */
    data class ShareOpen(val deck: String, val game: String = "mtg", val preview: (String) -> Unit = {}, val id: Long = System.nanoTime())
    val share = MutableStateFlow<ShareOpen?>(null)
    /** The share sheet's {payload, sheet} (writeActs.shareOpen, which saves nothing), the sheet showing [link]. Null (with a toast) when it can't open. */
    suspend fun shareModel(context: Context, deck: String, game: String, link: String = ""): JsonObject? {
        val r = withCollection(context) { CollectionEngine.act("shareOpen", JsonObject().apply { addProperty("deck", deck); addProperty("game", game); addProperty("link", link) }) } ?: return null
        r["error"]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let { show(it); return null }
        return r["made"]?.takeIf { it.isJsonPrimitive }?.asString?.let { runCatching { com.google.gson.JsonParser.parseString(it).asJsonObject }.getOrNull() }
    }
    /** location.origin + location.pathname + "#shared/" on the site: where a share link opens. */
    const val SHARE_BASE = "https://cardstashy.com/#shared/"
    /** share.js encodeShare as the browser makes it (CompressionStream "deflate-raw"): the payload's UTF-8 deflated, base64url without padding, after "z.". */
    fun shareCode(payload: String): String {
        val def = java.util.zip.Deflater(java.util.zip.Deflater.DEFAULT_COMPRESSION, true)
        def.setInput(payload.toByteArray(Charsets.UTF_8)); def.finish()
        val out = java.io.ByteArrayOutputStream(); val buf = ByteArray(8192)
        while (!def.finished()) out.write(buf, 0, def.deflate(buf))
        def.end()
        return "z." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(out.toByteArray())
    }

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
        r["ask"]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let { q ->
            val site = (r["asking"] as? JsonObject)?.let { o -> fun str(k: String) = o[k]?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                SiteAsk(str("title"), str("ok"), str("cancel"), o["danger"]?.takeIf { it.isJsonPrimitive }?.asBoolean == true) }
            pendingAsk?.let { _ask.value = it.copy(question = q, site = site) }; return false }
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
