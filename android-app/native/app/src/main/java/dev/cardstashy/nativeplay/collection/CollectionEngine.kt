package dev.cardstashy.nativeplay.collection

import android.content.Context
import app.cash.zipline.QuickJs
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit

/**
 * The site's Collection Home, run as the site's own code (assets/collection-engine.js: store.js, insights.js
 * collectionValue, home-ui.js homeValueModel and the Home rails, meta.js, community-feed.js, news-pulse.js and
 * app.js's resolveNames, bundled by scripts/export-collection-engine.mjs). Nothing about the collection is decided
 * here: this only carries the bundle's fetches over the network, runs its jobs and timers, and reads its models.
 * One thread owns the QuickJS instance; every call goes through it.
 */
object CollectionEngine {
    private val thread = java.util.concurrent.Executors.newSingleThreadExecutor { r -> Thread(null, r, "collection-engine", 8L shl 20).apply { isDaemon = true } }.asCoroutineDispatcher()
    private var qjs: QuickJs? = null
    private var source: () -> String = { "" }
    private val answers = ConcurrentLinkedQueue<Triple<Int, Int, Pair<String, String>>>()
    private val client by lazy { OkHttpClient.Builder().callTimeout(20, TimeUnit.SECONDS).build() }

    fun init(context: Context) { val app = context.applicationContext; filesDir = app.filesDir; source = { app.assets.open("collection-engine.js").bufferedReader().readText() }
        if (store !is FileStore) store = FileStore(File(app.filesDir, "collection-store"), app.getSharedPreferences("collection-engine-storage", Context.MODE_PRIVATE)) }

    /**
     * The site's browser storage the bundle keeps between visits (its KEPT_KEYS: meta.js's tournament cache), here on the device:
     * handed back when the bundle starts and written as each pump reports a change. Tests keep it in memory ([MemoryStore]).
     */
    interface Store { fun load(): Map<String, String>; fun save(key: String, value: String?) }
    class MemoryStore : Store {
        val kept = java.util.concurrent.ConcurrentHashMap<String, String>()
        override fun load(): Map<String, String> = HashMap(kept)
        override fun save(key: String, value: String?) { if (value == null) kept.remove(key) else kept[key] = value }
    }
    /**
     * One file per key (written to a .tmp file, then renamed, off the engine's thread), so a change to one key never rewrites the others: the
     * tournament cache alone is megabytes, and a preferences file rewritten on every change would hold the screen as the app goes to the
     * background. The old preferences file is moved over once. Day keys (today's pack claim) older than two days are dropped as it loads.
     */
    internal class FileStore(private val dir: File, private val legacy: android.content.SharedPreferences? = null) : Store {
        private val io = java.util.concurrent.Executors.newSingleThreadExecutor { r -> Thread(r, "collection-store").apply { isDaemon = true } }
        private fun name(k: String) = java.net.URLEncoder.encode(k, "UTF-8").replace("*", "%2A")
        private fun key(n: String) = java.net.URLDecoder.decode(n, "UTF-8")
        override fun load(): Map<String, String> {
            dir.mkdirs()
            legacy?.let { p -> val all = p.all; if (all.isNotEmpty()) { all.forEach { (k, v) -> if (v is String) write(k, v) }; p.edit().clear().commit() } }
            val old = java.time.LocalDate.now(java.time.ZoneId.of("America/New_York")).minusDays(2).toString()
            val out = HashMap<String, String>()
            for (f in dir.listFiles().orEmpty()) {
                if (!f.isFile || f.name.endsWith(".tmp")) continue
                val k = runCatching { key(f.name) }.getOrNull() ?: continue
                val day = Regex("^cardstashy-today-pack:[^:]+:(\\d{4}-\\d{2}-\\d{2})").find(k)?.groupValues?.get(1)
                if (day != null && day < old) { f.delete(); continue }
                runCatching { out[k] = f.readText() }
            }
            return out
        }
        private fun write(k: String, v: String?) {
            val f = File(dir, name(k))
            if (v == null) { f.delete(); return }
            runCatching { dir.mkdirs(); val tmp = File(f.path + ".tmp"); tmp.writeText(v); if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) } }
        }
        override fun save(key: String, value: String?) { io.execute { write(key, value) } }
    }
    @Volatile var store: Store = MemoryStore()
    /** This device's files (rulebooks kept for offline use); unset in tests run from a file. */
    @Volatile internal var filesDir: File? = null
    /** For tests: the bundle from a file. */
    fun initFrom(file: File) { source = { file.readText() } }
    /** For tests: a fresh engine (the bundle read again on the next call), so one test's pages don't carry into the next. */
    suspend fun restart() = withContext(thread) { qjs?.close(); qjs = null; answers.clear() }

    private fun js(): QuickJs = qjs ?: QuickJs.create().also { q ->
        q.maxStackSize = 6L shl 20
        // QuickJS has no time zone data: the site's daily clock (daily-clock.js, America/New_York) reads the zone's UTC
        // offsets from the device's own rules, three years either side of now (web-locale-prelude.js DateTimeFormat).
        q.evaluate("globalThis.__tz=${zoneTable(listOf("America/New_York"))}")
        q.evaluate(source(), "collection-engine.js")
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        runCatching { q.evaluate("Collection.storeLoad(${str(JsonObject().apply { store.load().forEach { (k, v) -> addProperty(k, v) } }.toString())})") }
        qjs = q
    }

    /** {zone: [[fromMs, offsetMinutes], …]} from java.time's rules for each zone. */
    internal fun zoneTable(zones: List<String>, now: java.time.Instant = java.time.Instant.now()): String = JsonObject().apply {
        for (z in zones) {
            val rules = java.time.ZoneId.of(z).rules
            val from = now.minus(java.time.Duration.ofDays(3 * 366)); val until = now.plus(java.time.Duration.ofDays(3 * 366))
            val rows = com.google.gson.JsonArray()
            fun row(at: Long, off: Int) = rows.add(com.google.gson.JsonArray().apply { add(at); add(off) })
            row(from.toEpochMilli(), rules.getOffset(from).totalSeconds / 60)
            var t = rules.nextTransition(from)
            while (t != null && t.instant.isBefore(until)) { row(t.instant.toEpochMilli(), t.offsetAfter.totalSeconds / 60); t = rules.nextTransition(t.instant) }
            add(z, rows)
        }
    }.toString()

    private suspend fun <T> on(block: (QuickJs) -> T): T = withContext(thread) { block(js()) }
    /** Starts the bundle (QuickJS and the 4.5 MB bundle evaluated), so the first Collection screen doesn't wait for it. [init] first. */
    suspend fun warm() { on { } }
    /** The engine's thread at a lower priority while the app warms it up at launch, and back to normal for anything a screen asks. */
    suspend fun nice(on: Boolean) = withContext(thread) { runCatching { android.os.Process.setThreadPriority(if (on) 5 else android.os.Process.THREAD_PRIORITY_DEFAULT) }; Unit }
    /**
     * One turn of the bundle: the answers that came in, its jobs and due timers run, and the fetches it asked for sent. A cancelled
     * caller can't cut it short (a fetch the bundle asked for that nobody sent would leave its promise open for good). [after]
     * reads what the caller needs in the same turn ([landed]: an answer came in).
     */
    private suspend fun <T> turn(after: (q: QuickJs, p: JsonObject, landed: Boolean) -> T): Pair<JsonObject, T> = withContext(kotlinx.coroutines.NonCancellable + thread) {
        val q = js(); var landed = false
        while (true) { val a = answers.poll() ?: break; landed = true; q.evaluate("__host.answer(${a.first}, ${a.second}, ${str(a.third.first)}, ${str(a.third.second)})") }
        val p = JsonParser.parseString(q.evaluate("__host.pump(${System.currentTimeMillis()})") as String).asJsonObject
        for (x in p.getAsJsonArray("requests")) send(x.asJsonObject)
        // Price alerts a price seen in this turn set off (app.js onAlert): their lines for the app's toast.
        p.getAsJsonArray("alerts")?.forEach { a -> runCatching { alertsFired.tryEmit(a.asJsonObject) } }
        p.getAsJsonObject("stored")?.entrySet()?.forEach { (k, v) -> runCatching { store.save(k, v.takeIf { it.isJsonPrimitive }?.asString) } }
        p to after(q, p, landed)
    }
    private fun str(v: String) = JsonPrimitive(v).toString()

    /** app.js normalize() of the account's workspace data, with the catalog this device saved last time. */
    suspend fun load(workspace: JsonObject, catalog: String?): JsonObject = load(workspace.toString(), catalog)
    /** The same from the workspace's JSON text (the device's saved copy), without parsing it here first. */
    suspend fun load(workspace: String, catalog: String?): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.load(${str(workspace)}, ${catalog?.let(::str) ?: "null"})") as String).asJsonObject }

    /** Looks up every card name the catalog lacks (app.js autoEnrich's names) and starts Home's feeds; returns when done or after [maxMs]. */
    /** Resolves the workspace's missing names and loads Home's feeds (and, for a deck page, [deckId]'s format meta). */
    suspend fun refresh(game: String, maxMs: Long = 60_000, deckId: String? = null, onStep: (String) -> Unit = {}): JsonObject {
        on { q -> q.evaluate("Collection.enrich()"); q.evaluate("Collection.feeds(${str(game)}, ${str(deckId ?: "")})") }
        val until = System.currentTimeMillis() + maxMs
        var status = JsonObject()
        while (System.currentTimeMillis() < until) {
            val (p, s) = turn { q, _, _ -> JsonParser.parseString(q.evaluate("Collection.poll()") as String).asJsonObject }
            status = s
            s.get("step")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let(onStep)
            if (!s.get("busy").asBoolean && p.get("open").asInt == 0 && answers.isEmpty()) break
            if (p.get("ran").asInt == 0 && answers.isEmpty()) {
                val next = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
                delay(if (next != null) (next - System.currentTimeMillis()).coerceIn(1, 25) else 15)
            }
        }
        return status
    }

    /** views.js home() / tcg.js tcgHome() as a model: value at a glance, your decks, Top Meta and News. */
    suspend fun home(game: String): JsonObject = JsonParser.parseString(homeRaw(game)).asJsonObject
    /** The same as the bundle's own text (saved as it is for the next launch, and compared with the last paint without parsing it). */
    suspend fun homeRaw(game: String): String = on { q -> q.evaluate("Collection.home(${str(game)})") as String }

    /** views.js collection(): the Cards tab as a model; [opts] = {sort, direction, filter, q, limit}, the site's own control values. */
    suspend fun cards(game: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cards(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** Collection › Value (views.js collectionValueView, tcg.js tcgValueView) as blocks in the site's order. */
    suspend fun value(game: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.value(${str(game)})") as String).asJsonObject }

    /** Collection › Binders (binders.js binderShelf): the game's shelf as views.js / tcg.js draw it with the Binders tab open. */
    suspend fun binders(game: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.binders(${str(game)})") as String).asJsonObject }

    /** app.js showBinder: binder [id]'s page [page] (binders.js binderPage) with the pages either side; {gone} when it no longer exists. */
    /** Every binder and deck here as a friend would see it (app.js showcaseChoices, each through showcaseItem). */
    suspend fun showcaseChoices(): JsonArray =
        on { q -> JsonParser.parseString(q.evaluate("Collection.showcaseChoices()") as String).asJsonArray }
    /** repairOwnShowcase over the overview's [items]: [{i, item}] for each that changed. */
    suspend fun showcaseRepair(items: JsonArray): JsonArray =
        on { q -> JsonParser.parseString(q.evaluate("Collection.showcaseRepair(${str(items.toString())})") as String).asJsonArray }
    /** A friend's shared binder (app.js showBinder with sharedItem) at page [page]: the binder model, read-only, with its reference [value]. */
    suspend fun sharedBinder(item: JsonObject, page: Int): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.sharedBinder(${str(item.toString())}, $page)") as String).asJsonObject }
    /** A friend's shared deck in the proven deck sheet (app.js openSharedShowcase): the sheet's model, as provenModel. */
    suspend fun sharedDeck(item: JsonObject): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.sharedDeck(${str(item.toString())})") as String).asJsonObject }
    suspend fun binder(game: String, id: String, page: Int): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.binder(${str(game)}, ${str(id)}, $page)") as String).asJsonObject }

    /** app.js binderEditor: the New binder / Binder settings sheet's fields ([id] blank for a new one). */
    suspend fun binderEdit(game: String, id: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.binderEdit(${str(game)}, ${str(id)})") as String).asJsonObject }

    /** views.js decks(), My decks, as a model; [opts] = {q} as I.shelfSearch sets it. */
    suspend fun decks(game: String, opts: JsonObject = JsonObject()): JsonObject = JsonParser.parseString(decksRaw(game, opts)).asJsonObject
    suspend fun decksRaw(game: String, opts: JsonObject = JsonObject()): String =
        on { q -> q.evaluate("Collection.decks(${str(game)}, ${str(opts.toString())})") as String }

    /** One Cards-tab control as app.js handles it (sort, direction, filter, search, more), then the page again. */
    /** The Select tray's sheet (workbench-ui.js A.batchAction) for [kind]: move, deck, wish or compare; or {toast} when the site refuses. */
    suspend fun batchSheet(game: String, kind: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.batchSheet(${str(game)}, ${str(kind)})") as String).asJsonObject }
    private suspend fun model(js: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate(js) as String).let { if (it.isJsonObject) it.asJsonObject else JsonObject() } }
    /** Magic Collection's ⋯ menu (app.js A.collMenu): {title, items [{act, icon, label}]}. */
    suspend fun collMenu(): JsonObject = model("Collection.collMenu()")
    /** app.js A.exportCSV's file: {name, text, type}. */
    suspend fun exportCSV(): JsonObject = model("Collection.exportCSV()")
    /** app.js importCollectionSheet's fields and its first (empty) state. */
    suspend fun importSheet(): JsonObject = model("Collection.importSheet()")
    /** The import sheet as it stands (drawImport's data and #impError). */
    suspend fun importModel(): JsonObject = model("Collection.importModel()")
    /** I.impText: the text changed, the preview gone. */
    suspend fun importText(): JsonObject = model("Collection.importText()")
    /** A.impPreview for [raw], whose SHA-256 (hex) is [hash]. */
    suspend fun importPreview(raw: String, hash: String): JsonObject = model("Collection.importPreview(${str(raw)}, ${str(hash)})")
    /** C.impUse: row [i] ticked or not. */
    suspend fun importUse(i: Int, on: Boolean): JsonObject = model("Collection.importUse($i, $on)")
    /** C.impPrinting: row [i]'s printing [j] (an index into its candidates); {toast} when it doesn't fit. */
    suspend fun importPrinting(i: Int, j: String): JsonObject = model("Collection.importPrinting($i, ${str(j)})")
    /** A.impErrors' file (the skipped lines), or null. */
    suspend fun importErrors(): JsonObject = model("Collection.importErrors()")
    suspend fun importClose() { on { q -> q.evaluate("Collection.importClose()") } }
    /** app.js closeSheet over Import a deck / New deck (Yu-Gi-Oh!, Pokémon) while it runs: the run's importGuard stops it unsaved. */
    suspend fun tDeckSheetClose() { on { q -> q.evaluate("Collection.tDeckSheetClose()") } }
    /** Yu-Gi-Oh! or Pokémon Paste a list (tcg.js tcgImportSheet "coll"): {title, hint, placeholder, rows, button}. */
    suspend fun tImportSheet(game: String): JsonObject = model("Collection.tImportSheet(${str(game)})")

    suspend fun cardsDo(game: String, kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cardsDo(${str(game)}, ${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** views.js deckPage(), the Cards tab of deck [id], as a model; [opts] = {search, filter, sort, view} applied first. */
    suspend fun deck(game: String, id: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.deck(${str(game)}, ${str(id)}, ${str(opts.toString())})") as String).asJsonObject }

    /**
     * Deck Bench's browser in Collection (Collection.benchPool): the collection's cards by name, each with its picture, mana value,
     * type line, colours and the copies owned. A var so tests answer it themselves.
     */
    var benchPool: suspend (game: String, id: String) -> com.google.gson.JsonArray = { game, id ->
        on { q -> JsonParser.parseString(q.evaluate("Collection.benchPool(${str(game)}, ${str(id)})") as String).asJsonArray } }

    /** One deck-page control as app.js handles it (search, filter, sort, view), then the page again. */
    suspend fun deckDo(game: String, id: String, kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.deckDo(${str(game)}, ${str(id)}, ${str(kind)}, ${str(value)})") as String).asJsonObject }

    /**
     * A panel of the site's own markup run by its own scripts (the bundle's site-dom.mjs): the deck page's Rules tab (rule-learning.js
     * interactiveRules for [game] and the deck's [format]). The model is the page's nodes as those scripts leave them; [panelTap] and
     * [panelType] reach their listeners; what they start (the rulebook, a source) lands through [settle] with "Collection.panelModel()".
     */
    /** The Rules page (rules.js rulesPage) for [game] as a panel; read again with panelModel. */
    suspend fun rulesPage(game: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.rulesPage(${str(game)})") as String).asJsonObject }
    /** How to play · keywords (A.learnGame: learnSheet) for [game] as a panel. */
    suspend fun learnGame(game: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.learnGame(${str(game)})") as String).asJsonObject }
    /** The Scan page (scancam.js scanView) for [game] with S.ui.scan = [state] (JSON) and, for a review, [card]'s Scryfall card. */
    suspend fun scanPage(game: String, state: String, card: String = ""): JsonObject = 
        on { q -> JsonParser.parseString(q.evaluate("Collection.scanPage(${str(game)}, ${str(state)}, ${str(card)})") as String).asJsonObject }
    /** The Wiki page (app.js #wiki[/<topic>[/search]]) for [game] as a panel: home when [topic] is blank, [query] for a search. */
    /** What the Scanner's page reads from the workspace (collection, settings, locations, binders, tcg): ScanWeb's copy. */
    suspend fun scanWorkspace(): String = on { q -> q.evaluate("Collection.scanWorkspace()") as String }
    /** Each deck's Power as this device worked it out before (the engine's Power keep), for a fresh engine. */
    suspend fun powerLoad(raw: String?) { on { q -> q.evaluate("Collection.powerLoad(${str(raw ?: "")})") } }
    /** The Power keep to save, or "" when nothing new was worked out. */
    suspend fun powerSave(): String = on { q -> q.evaluate("Collection.powerSave()") as String }
    suspend fun wikiPage(game: String, topic: String, query: Boolean): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.wikiPage(${str(game)}, ${str(topic)}, $query)") as String).asJsonObject }
    suspend fun rules(game: String, format: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.rules(${str(game)}, ${str(format)})") as String).asJsonObject }
    /** A Yu-Gi-Oh! or Pokémon deck's [tab] other than Cards (tcg.js A.tDeckTab): tcgDeck's .deck-body as such a panel (the page: [deck] with "tab"). */
    suspend fun deckPanel(game: String, id: String, tab: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.deckPanel(${str(game)}, ${str(id)}, ${str(tab)})") as String).asJsonObject }
    const val PANEL_MODEL = "Collection.panelModel()"
    /** The Decks page's Ideas (or Meta decks) tab body (views.js decks() / tcg.js tcgDecks() with that tab, after .random-tools) as such a
     *  panel, run by app.js's / tcg.js's own handlers; its route's loads (the ideas auto-build, the tournament meta, card data) start too. */
    suspend fun decksPanel(game: String, tab: String): JsonObject = model("Collection.decksPanel(${str(game)}, ${str(tab)})")
    /** icons.js decorateGlyphs: each leading glyph's icon ({"↻": svg, …}). */
    /** Yu-Gi-Oh! / Pokémon's Import a deck sheet (tcg.js tcgImportSheet "deck"); Import runs through act("tImpDeck"). */
    suspend fun tDeckImportSheet(game: String): JsonObject = model("Collection.tDeckImportSheet(${str(game)})")
    /** Yu-Gi-Oh! / Pokémon's New deck sheet (tcg.js tcgNewDeckSheet), [format] preselected (Meta decks' Create a … deck); Create deck runs through act("tNewDeckSave"). */
    suspend fun tNewDeckSheet(game: String, format: String = ""): JsonObject = model("Collection.tNewDeckSheet(${str(game)}, ${str(format)})")
    /** Magic's Deck review sheet for deck [id] (views.js deckReviewSheet). */
    suspend fun deckReview(id: String): JsonObject = model("Collection.deckReview(${str(id)})")
    /** The review's Find {role} cards / Find {format} cards ([kind] findRole / formatSearch): the search left for the Search tab ({term, filters}). */
    suspend fun reviewSearch(kind: String, deck: String, role: String = ""): JsonObject = model("Collection.reviewSearch(${str(kind)}, ${str(deck)}, ${str(role)})")
    /** The War Chest window from the Decks head (app.js A.warChest) as the open panel; [warChestClose] brings back the panel under it. */
    suspend fun warChest(game: String): JsonObject = model("Collection.warChest(${str(game)})")
    suspend fun warChestClose(): JsonObject = model("Collection.warChestClose()")
    /** The Build decks sheet (Compare budget builds) closed: the panel under it. */
    suspend fun tbuildClose(): JsonObject = model("Collection.tbuildClose()")
    /** A rule word on a card's page (A.ruleHint): rule-dex.js's glass, as a panel; [ruleGlassClose] puts back the panel it covered. */
    suspend fun ruleGlass(game: String, rule: String): JsonObject = model("Collection.ruleGlass(${str(game)}, ${str(rule)})")
    suspend fun ruleGlassClose(): JsonObject = model("Collection.ruleGlassClose()")
    /** A Play deck's Power tab ({name, format, cards}), Play-safe: no Upgrades, no prices; read again with [settle] and [PANEL_MODEL]. */
    suspend fun playPower(deck: JsonObject): JsonObject = model("Collection.playPower(${str(deck.toString())})")
    /** The card page's condition switch: each condition's price for the printing shown (the site's condition lookup); read again with [settle] and [COND_MODEL]. */
    suspend fun conditions(game: String, retry: Boolean = false): JsonObject = model("Collection.conditions(${str(game)}, $retry)")
    const val COND_MODEL = "Collection.condModel()"
    suspend fun condModel(): JsonObject = model(COND_MODEL)
    suspend fun glyphs(): JsonObject = model("Collection.glyphs()")
    /** views.js ideaSheet for idea [i] of the Ideas tab (app.js openIdea: it builds as it opens); read again with [settle] and [IDEA_MODEL]. */
    suspend fun ideaSheet(i: Int): JsonObject = model("Collection.ideaSheet($i)")
    const val IDEA_MODEL = "Collection.ideaModel()"
    /** One idea-sheet control (app.js A.ideaBudget "budget", A.ideaCustomBudget "custom", C.ideaPick "pick" {name, on}, A.ideaSelect "select", the deck view "view"). */
    suspend fun ideaDo(kind: String, value: String = ""): JsonObject = model("Collection.ideaDo(${str(kind)}, ${str(value)})")
    suspend fun ideaClose() { on { q -> q.evaluate("Collection.ideaClose()") } }
    /** The tournament deck's sheet (tcg.js provenSheetHtml) open now, as a model; read again with [settle] and [PROVEN_MODEL] while it loads. */
    suspend fun provenModel(): JsonObject = model(PROVEN_MODEL)
    const val PROVEN_MODEL = "Collection.provenModel()"
    /** One sheet control (tcg.js A.provenMode "mode", A.provenBudget "budget", A.provenRetry "retry", the deck view "view"). */
    suspend fun provenDo(kind: String, value: String = ""): JsonObject = model("Collection.provenDo(${str(kind)}, ${str(value)})")
    suspend fun provenClose() { on { q -> q.evaluate("Collection.provenClose()") } }
    /** Back from a card's page the sheet opened (app.js A.sheetHistoryBack): the sheet's context again, as a model. */
    suspend fun provenBack(): JsonObject = model("Collection.provenBack()")
    /** Home's Community Meta decks card [key] of [game]: its sheet, from the list Home shows ({missing} when that list isn't here). */
    suspend fun provenHome(game: String, key: String): JsonObject = model("Collection.provenHome(${str(game)}, ${str(key)})")
    /** The open tab drawn again from the account as it is now (after a save made from it). */
    /** What the open tab runs once the player said yes (A.lifeEnd). */
    suspend fun panelDone(kind: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.panelDone(${str(kind)})") as String).asJsonObject }
    suspend fun panelRedraw(): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.panelRedraw()") as String).asJsonObject }
    suspend fun panelTap(id: Int): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.panelTap($id)") as String).asJsonObject }
    suspend fun panelType(id: Int, value: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.panelType($id, ${str(value)})") as String).asJsonObject }
    /** A field's Enter: its form's submit, as the browser sends it. */
    suspend fun panelSubmit(id: Int): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.panelSubmit($id)") as String).asJsonObject }

    /** views.js cardSheet(), a card's page, as a model; [opts] = {name, entry, deck} as the tapped tile has them. */
    suspend fun card(game: String, opts: JsonObject): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.card(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** One card-page control as app.js handles it (tab, face, finish, print, source, more), then the page again. */
    suspend fun cardDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cardDo(${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** Starts the open card page's lookups (app.js loadCardExtras, its printings, the guide and the set index). */
    suspend fun cardLoad() = on { q -> q.evaluate("Collection.cardLoad()"); Unit }

    /**
     * Carries the bundle's open requests and timers until it goes quiet or [maxMs] passes; after each round in which an
     * answer landed, [model] is read again and handed to [onModel] (the page draws what has arrived so far).
     */
    suspend fun settle(maxMs: Long = 30_000, model: String? = null, onModel: (JsonObject) -> Unit = {}) {
        val until = System.currentTimeMillis() + maxMs
        while (System.currentTimeMillis() < until) {
            val (p, m) = turn { q, p, landed -> if (model != null && (landed || p.get("ran").asInt > 0)) JsonParser.parseString(q.evaluate(model) as String).asJsonObject else null }
            m?.let(onModel)
            // Quiet: nothing in flight and no timer due soon (a far timer, such as a cache's expiry, does not hold the page).
            val nt = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
            if (p.get("open").asInt == 0 && p.getAsJsonArray("requests").size() == 0 && answers.isEmpty() && (nt == null || nt - System.currentTimeMillis() > 1500)) break
            if (p.get("ran").asInt == 0 && answers.isEmpty()) {
                val next = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
                delay(if (next != null) (next - System.currentTimeMillis()).coerceIn(1, 25) else 15)
            }
        }
    }
    /** The open card page as a model again (after [settle]); empty when none is open. */
    const val CARD_MODEL = "Collection.cardModel()"
    suspend fun cardModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(CARD_MODEL) as String).asJsonObject }

    /** tcg.js tcgCardSheet(), a Yu-Gi-Oh! or Pokémon card's page, as a model; [opts] = A.tCard's dataset {game, id, setId, setVariant, printing,
     *  edition, entry, deck} (or {pack: i}, a card pulled in Open Pack). */
    suspend fun tcard(opts: JsonObject): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.tcard(${str(opts.toString())})") as String).asJsonObject }
    /** Starts its lookups (the full card, Pokémon's printings, the set list, the open tab's). */
    suspend fun tcardLoad() = on { q -> q.evaluate("Collection.tcardLoad()"); Unit }
    /** One control as app.js / workbench-ui.js handle it (tab, finish, rarity, select, jump, range, historySource), then the page again. */
    suspend fun tcardDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.tcardDo(${str(kind)}, ${str(value)})") as String).asJsonObject }
    const val TCARD_MODEL = "Collection.tcardModel()"
    suspend fun tcardModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(TCARD_MODEL) as String).asJsonObject }

    /**
     * All cards, shelf by shelf, for a Yu-Gi-Oh! or Pokémon deck (collection-engine-entry.mjs shelvesStart): the set list newest first and
     * "For this deck" (the format's tournament staples the list doesn't play); pump with [settle] and read [shelvesJs]. [shelfStart] loads one
     * set's cards as tiles, read again with [shelfJs].
     */
    suspend fun shelvesStart(game: String, id: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.shelvesStart(${str(game)}, ${str(id)})") as String).asJsonObject }
    fun shelvesJs(game: String, id: String) = "Collection.shelvesModel(${str(game)}, ${str(id)})"
    suspend fun shelfStart(game: String, id: String, set: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.shelfStart(${str(game)}, ${str(id)}, ${str(set)})") as String).asJsonObject }
    fun shelfJs(game: String, id: String, set: String) = "Collection.shelfModel(${str(game)}, ${str(id)}, ${str(set)})"
    suspend fun shelvesModel(game: String, id: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate(shelvesJs(game, id)) as String).asJsonObject }
    suspend fun shelfModel(game: String, id: String, set: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate(shelfJs(game, id, set)) as String).asJsonObject }

    /** views.js setsPage(), every set by year, as a model; [opts] = {q, family, release, year, sort}, the site's own filter values. */
    suspend fun sets(game: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.sets(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** One set-browser control as app.js handles it (search, family, type, release, year, sort, more, reset, reload), then the page again. */
    suspend fun setsDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.setsDo(${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** Starts app.js loadSetIndex (the set list); [settle] with [SETS_MODEL] draws it as it lands. */
    suspend fun setsLoad() = on { q -> q.evaluate("Collection.setsLoad()"); Unit }

    /** The Search tab (views.js search(), tcg.js tcgSearch(); the site's #search) for [game], as a model of its blocks in page order. */
    suspend fun search(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.search(${str(game)})") as String).asJsonObject }
    /** One search control handed to the site's own handler: [act] is its data-act / data-change / data-input, [data] {dataset, value}. A search
     *  runs on; pump it with [settle] and read [SEARCH_MODEL]. */
    suspend fun searchDo(act: String, data: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.searchDo(${str(act)}, ${str(data.toString())})") as String).asJsonObject }
    const val SEARCH_MODEL = "Collection.searchModel()"
    suspend fun searchModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(SEARCH_MODEL) as String).asJsonObject }
    /** The card a press opened (Random: {act: card, name} or {act: tCard, id, game}), once; null when none. */
    suspend fun searchWent(): JsonObject? = on { q -> JsonParser.parseString(q.evaluate("Collection.searchWent()") as String).takeIf { it.isJsonObject }?.asJsonObject }
    /** What the search's handlers said (toast), once. */
    suspend fun searchToasts(): List<String> = on { q -> JsonParser.parseString(q.evaluate("Collection.searchToasts()") as String).asJsonArray.map { it.asString } }
    /** The saved searches (tcg.js savedSearches' device storage, every game), to keep and to put back. */
    // ---- Compare cards (gap audit H1; the engine's Collection.compare*) ----
    /** The compare sheet of [game]: {title, sides [{empty, i} or {i, name, picture, id, lines, chips, facts, effects}], verdict, swap, foot, clear}. */
    suspend fun compareModel(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.compareModel(${str(game)})") as String).asJsonObject }
    private suspend fun compareWait(maxMs: Long): String? {
        val until = System.currentTimeMillis() + maxMs
        while (System.currentTimeMillis() < until) {
            val r = on { q -> JsonParser.parseString(q.evaluate("Collection.compareDone()") as String).asJsonObject }
            if (r["done"]?.asBoolean == true) return r["error"]?.takeIf { it.isJsonPrimitive }?.asString
            settle(1_000)
        }
        return "Card lookup timed out. Check your connection and try again."
    }
    /** A held card into the first empty side ([ref]: a Magic name, else the card id); the error line or null. */
    suspend fun compareFrom(game: String, ref: String, maxMs: Long = 30_000): String? { on { q -> q.evaluate("Collection.compareFrom(${str(game)}, ${str(ref)})") }; return compareWait(maxMs) }
    /** Side [i] from a typed name; the site's error line ("No card with that name.") or null. */
    suspend fun compareLookup(game: String, i: Int, name: String, maxMs: Long = 30_000): String? { on { q -> q.evaluate("Collection.compareLookup(${str(game)}, $i, ${str(name)})") }; return compareWait(maxMs) }
    /** Clear side [i], or both with -1 (A.compareReset); the sheet again. */
    suspend fun compareClear(game: String, i: Int): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.compareClear(${str(game)}, $i)") as String).asJsonObject }

    // ---- Ask CardStashy (gap audit H3: ai-ask.js, ai-tools.js and ai-ask-loop.js in the engine; Collection.ask*) ----
    private suspend fun askEval(code: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate(code) as String).asJsonObject }
    const val ASK_MODEL = "Collection.askModel()"
    /**
     * Game [game]'s chat (kept while the app runs, one per game): {open, game, title, eyebrow, placeholder, draft, hello, blurb,
     * examples, lines, busy}. Each line is {who: me|thinking|error|ai, ...}; an answer has source, sourceKind, text, items (tiles:
     * show, title, lines, price, art, build, status), choices ({id, label, turn}) and follow (follow-up questions). [prefill] asks it.
     */
    suspend fun askOpen(game: String, prefill: String = ""): JsonObject = askEval("Collection.askOpen(${str(game)}, ${str(prefill)})")
    suspend fun askModel(): JsonObject = askEval(ASK_MODEL)
    /** A question (typed, a starter or a follow-up); [askWait] runs it to its answer. */
    suspend fun askSend(game: String, text: String): JsonObject = askEval("Collection.askSend(${str(game)}, ${str(text)})")
    /** One of the latest answer's deck choices. */
    suspend fun askChoice(game: String, id: String, label: String, turn: Int): JsonObject =
        askEval("Collection.askChoice(${str(game)}, ${str(id)}, ${str(label)}, $turn)")
    /** New chat. */
    suspend fun askNew(game: String): JsonObject = askEval("Collection.askNew(${str(game)})")
    /** Leaving the chat: a question still out is called off (the site's closeAsk), the chat kept. */
    suspend fun askClose() { askEval("Collection.askClose()") }
    /** Runs the question out to its answer (each round's fetches and tools), [onModel] seeing the chat as it changes. */
    suspend fun askWait(maxMs: Long = 600_000, onModel: (JsonObject) -> Unit = {}): JsonObject {
        val until = System.currentTimeMillis() + maxMs
        var m = askModel()
        while (m.get("busy")?.asBoolean == true && System.currentTimeMillis() < until) {
            val t = System.currentTimeMillis()
            settle(1_000, ASK_MODEL) { onModel(it) }
            if (System.currentTimeMillis() - t < 20) delay(40)
            m = askModel()
        }
        onModel(m)
        return m
    }
    /**
     * A tapped tile ([show], its data-ask-show): the site's tools.open worked out; where the app goes, or null. {to: card (game, name
     * or id, setId), meta (game, key, format), route (hash), build (game, id or seed, budget, format), help (id), wiki (game, topic)}.
     */
    suspend fun askShow(show: JsonObject, maxMs: Long = 30_000): JsonObject? {
        askEval("Collection.askShow(${str(show.toString())})")
        val until = System.currentTimeMillis() + maxMs
        while (System.currentTimeMillis() < until) {
            val r = askEval("Collection.askShowDone()")
            if (r["done"]?.asBoolean == true) return r.getAsJsonObject("dest")
            settle(1_000)
        }
        return null
    }

    // ---- Price alerts (pricehist.js; the engine's Collection.alert*) ----
    /** Each alert a price seen in the engine set off: {game, id, name, usd, text} (pricehist.js alertText). */
    val alertsFired = kotlinx.coroutines.flow.MutableSharedFlow<JsonObject>(extraBufferCapacity = 16)
    /** Whose alerts the site's code reads and writes: the signed-in account, or "guest". */
    suspend fun alertOwner(user: String?) = on { q -> q.evaluate("Collection.alertOwner(${str(user ?: "guest")})"); Unit }
    /** The alert sheet for one card: {name, price, exists, below, above, hintBelow, hintAbove, series}. */
    suspend fun alertOpen(game: String, id: String, name: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.alertOpen(${str(game)}, ${str(id)}, ${str(name)})") as String).asJsonObject }
    /** Save Alert with the two fields as typed: {error} or {ok, toast}. A turn follows so the list reaches the device's storage. */
    suspend fun alertSave(game: String, id: String, name: String, below: String, above: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.alertSave(${str(game)}, ${str(id)}, ${str(name)}, ${str(below)}, ${str(above)})") as String).asJsonObject }.also { turn { _, _, _ -> } }
    suspend fun alertClear(game: String, id: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.alertClear(${str(game)}, ${str(id)})") as String).asJsonObject }.also { turn { _, _, _ -> } }
    /**
     * The daily check (gap audit H2 step 4): every alerted card's price fetched now and recorded as the site records a price it sees;
     * returns what it set off ({game, id, name, usd, text}). Gives up after [maxMs].
     */
    suspend fun alertCheck(maxMs: Long = 120_000): List<JsonObject> = kotlinx.coroutines.coroutineScope {
        val got = java.util.Collections.synchronizedList(mutableListOf<JsonObject>())
        val listen = launch(start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED) { alertsFired.collect { got += it } }
        try {
            on { q -> q.evaluate("Collection.alertCheck()") }
            val until = System.currentTimeMillis() + maxMs
            while (System.currentTimeMillis() < until) {
                settle(2_000)
                if (on { q -> JsonParser.parseString(q.evaluate("Collection.alertCheckPoll()") as String).asJsonObject["done"].asBoolean }) break
            }
            settle(1_000)
        } finally { listen.cancel() }
        got.toList()
    }
    /** This account's alerts: [{game, id, name, below, above, created, firedAt}]. */
    suspend fun alertList(): com.google.gson.JsonArray = on { q -> JsonParser.parseString(q.evaluate("Collection.alertList()") as String).asJsonObject.getAsJsonArray("alerts") }
    suspend fun searchSaved(): String = on { q -> q.evaluate("Collection.searchSaved()") as String }
    suspend fun searchSavedSet(raw: String) = on { q -> q.evaluate("Collection.searchSavedSet(${str(raw)})"); Unit }
    /** suggest.js under the search box: start it for [text] (empty: the recent searches at once); pump with [settle] on [SUGGEST_MODEL]. */
    suspend fun searchSuggest(game: String, text: String): JsonObject? = on { q -> JsonParser.parseString(q.evaluate("Collection.searchSuggest(${str(game)}, ${str(text)})") as String).takeIf { it.isJsonObject }?.asJsonObject }
    const val SUGGEST_MODEL = "Collection.searchSuggestModel()"
    suspend fun searchSuggestModel(): JsonObject? = on { q -> JsonParser.parseString(q.evaluate(SUGGEST_MODEL) as String).takeIf { it.isJsonObject }?.asJsonObject }
    /** suggest.js rememberSearch: Enter, or a picked suggestion. */
    suspend fun searchRemember(game: String, text: String) = on { q -> q.evaluate("Collection.searchRemember(${str(game)}, ${str(text)})"); Unit }
    const val SETS_MODEL = "Collection.setsModel()"
    suspend fun setsModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(SETS_MODEL) as String).asJsonObject }

    /** views.js setPage(), one set's cards, as a model (app.js's #set/<code> route). */
    suspend fun set(game: String, code: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.set(${str(game)}, ${str(code)})") as String).asJsonObject }

    /** One set-page control as app.js handles it (search, filter, finish, rarity, sort, more, reload, view), then the page again. */
    suspend fun setDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.setDo(${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** Starts app.js loadSet for the open set (and the set index for its name and symbol). */
    suspend fun setLoad() = on { q -> q.evaluate("Collection.setLoad()"); Unit }
    const val SET_MODEL = "Collection.setModel()"
    /** The open set page as a model again; empty when none is open. */
    suspend fun setModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(SET_MODEL) as String).asJsonObject }

    /**
     * Open Pack on the open set page (app.js A.openSetPack): starts the draw (the set's booster sheets, then the pack), read with
     * [settle] and [packModel]. Each opening draws from a fresh secure seed (pack-preview.js packRandom: never a fixed or saved seed).
     */
    suspend fun packOpen(game: String): JsonObject = on { q ->
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        JsonParser.parseString(q.evaluate("Collection.packOpen(${str(game)})") as String).asJsonObject
    }
    const val PACK_MODEL = "Collection.packModel()"
    suspend fun packModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(PACK_MODEL) as String).asJsonObject }
    /** A new sealed pack from the same set ("Open a new pack"). */
    suspend fun packAgain(): JsonObject = on { q ->
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        JsonParser.parseString(q.evaluate("Collection.packAgain()") as String).asJsonObject
    }
    suspend fun packClose() = on { q -> q.evaluate("Collection.packClose()"); Unit }

    /**
     * One of the site's saving taps (the engine's writeActs: app.js's cardWishlist, cardOwnedQty, qty, wishRemove; tcg.js's
     * tEntryQty, tWish) with the tapped button's dataset, run through app.js's commit; returns once its chain has finished:
     * {done, error, ask (a question to put to the player, then tap again with confirmed), toasts [{text, undo}], writes}.
     */
    suspend fun act(kind: String, data: JsonObject, ms: Long = 15_000, onStep: (String) -> Unit = {}): JsonObject {
        on { q -> q.evaluate("Collection.act(${str(kind)}, ${str(data.toString())})") }
        val until = System.currentTimeMillis() + ms
        var said = ""
        while (true) {
            val (p, r) = turn { q, _, _ -> JsonParser.parseString(q.evaluate("Collection.actPoll()") as String).asJsonObject }
            if (r.get("done")?.asBoolean == true) return r
            // What the handler is saying as it goes (a status line it writes, "Checking 2/9…").
            r.get("step")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it != said }?.let { said = it; onStep(it) }
            if (System.currentTimeMillis() > until) return r.apply { addProperty("done", true); addProperty("error", "That took too long. Try again.") }
            if (p.get("ran").asInt == 0) delay(10)
        }
    }
    /** Pumps the bundle's jobs, timers and fetches until [poll] says done (or [ms] pass); [each] sees every answer on the way. */
    private suspend fun pumpUntil(poll: String, ms: Long, each: (JsonObject) -> Unit = {}): JsonObject {
        val until = System.currentTimeMillis() + ms
        while (true) {
            val (p, r) = turn { q, _, _ -> JsonParser.parseString(q.evaluate(poll) as String).asJsonObject }
            each(r)
            if (r.get("done")?.asBoolean == true || System.currentTimeMillis() > until) return r
            if (p.get("ran").asInt == 0) delay(10)
        }
    }
    /** The account's sign-in for the site's condition feed. */
    suspend fun auth(token: String?) { on { q -> q.evaluate("Collection.auth(${str(token ?: "")})") } }
    /** app.js addSheet: the add / edit sheet's model ({entry} to edit, {own, fromCard} for Got it, {} empty). */
    suspend fun addOpen(o: JsonObject): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.addOpen(${str(o.toString())})") as String).asJsonObject }
    suspend fun addClose(id: Int) { on { q -> q.evaluate("Collection.addClose($id)") } }
    /** tcg.js A.tOwn: a Yu-Gi-Oh! or Pokémon card's Add to collection ([o]: the button's dataset and its game), as the site fills it ({error} when it can't open). */
    suspend fun tAddOpen(o: JsonObject): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.tAddOpen(${str(o.toString())})") as String).asJsonObject }
    suspend fun tAddClose(id: Int) { on { q -> q.evaluate("Collection.tAddClose($id)") } }
    /** app.js refreshMagicCollectionPrices: the saved Magic cards a day old read again from Scryfall (prices, TCGplayer numbers); {total, refreshed, committed…}. */
    suspend fun pricesRefresh(force: Boolean): JsonObject {
        on { q -> q.evaluate("Collection.pricesRefresh($force)") }
        return pumpUntil("Collection.pricesPoll()", 120_000)
    }
    /** app.js refreshConditionPrice for that sheet ([form]: qty, condition, language, print, edition, value): painted as it changes. */
    suspend fun tAddPrice(form: JsonObject, retry: Boolean, paint: (JsonObject) -> Unit) {
        on { q -> q.evaluate("Collection.tAddPrice(${str(form.toString())}, $retry)") }
        var last = ""
        pumpUntil("Collection.pricePoll()", 30_000) { r -> val t = r.toString(); if (t != last) { last = t; paint(r) } }
    }
    /**
     * Build a deck for Yu-Gi-Oh! and Pokémon (the engine's flowTcgCalls: deck-experience.js over the site's pipeline with tcg.js): one
     * step ([name] with [a]) pumped until it ends; [onStatus] gets the pipeline's live line while it builds. A build waits up to [ms].
     */
    suspend fun flow(name: String, a: JsonObject, ms: Long = 300_000, onStatus: (String) -> Unit = {}): dev.cardstashy.nativeplay.play.RandomBuild.Flow {
        on { q -> q.evaluate("Collection.flow(${str(name)}, ${str(a.toString())})") }
        var said = ""
        val r = pumpUntil("Collection.flowPoll()", ms) { p -> p.get("status")?.takeIf { it.isJsonPrimitive }?.asString?.let { if (it != said) { said = it; onStatus(it) } } }
        if (r.get("done")?.asBoolean != true) { flowCancel(); return dev.cardstashy.nativeplay.play.RandomBuild.Flow(null, "The deck builder took too long. Try again.") }
        val err = r.get("error")?.takeIf { it.isJsonPrimitive }?.asString
        return dev.cardstashy.nativeplay.play.RandomBuild.Flow(if (err == null) r.get("value") else null, err)
    }
    suspend fun flowCancel() { on { q -> q.evaluate("Collection.flowCancel()"); Unit } }
    /** tcg.js A.tPickSeeds' sheet as data: {title, intro, placeholder, rows [{id, name, qty, art, key}], empty, go}. */
    suspend fun seedPick(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.seedPick(${str(game)})") as String).asJsonObject }
    /** What Build a deck reads from the workspace (owned cards, decks, the player's prices and settings), for the WebView's builder. */
    suspend fun flowWorkspace(): String = on { q -> q.evaluate("Collection.flowWorkspace()") as String }
    /** app.js A.deckMenu: deck [id]'s ⋯ menu as the site draws it ({missing} when the deck is gone). */
    suspend fun deckMenu(id: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.deckMenu(${str(id)})") as String).asJsonObject }
    /** app.js A.deckCopy / A.deckExport: {text, file}. */
    suspend fun deckText(id: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.deckText(${str(id)})") as String).asJsonObject }
    /** app.js A.newDeck's sheet ([commander] prefilled): {title, formats, format, info, commander, name, budget, save, foot, rows (each format's commander row and line)}. */
    suspend fun newDeck(commander: String = ""): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.newDeck(${str(commander)})") as String).asJsonObject }
    /** app.js deckImportSheet([preset]) for [deck] (the ⋯ menu's Re-import; null from the Decks page): the sheet's fields, read back. */
    suspend fun deckImport(preset: JsonObject = JsonObject(), deck: String? = null): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.deckImport(${str(preset.toString())}, ${deck?.let(::str) ?: "null"})") as String).asJsonObject }
    /** app.js I.dImpText: the list was typed in, so the preview is gone. */
    suspend fun deckImportText() { on { q -> q.evaluate("Collection.deckImportText()") } }
    /** app.js drawDeckImport for [form] (a format, commander or destination change): {results} or {status} (the list's error). */
    suspend fun deckImportDraw(form: JsonObject): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.deckImportDraw(${str(form.toString())})") as String).asJsonObject }
    /** app.js A.proxies: deck [id]'s proxy sheet ({html, title, file}) for [scope] "all" or "missing", or {toast} when there's nothing to print. */
    suspend fun proxies(id: String, scope: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.proxies(${str(id)}, ${str(scope)})") as String).asJsonObject }
    /** app.js acquireSheet: "Cards I got" ([mode] missing) or "Add the whole deck to my collection" (purchase), or {missing} when the deck is gone. */
    suspend fun acquire(id: String, mode: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.acquire(${str(id)}, ${str(mode)})") as String).asJsonObject }
    /** app.js A.deckToPlay's Play deck for [id]: {name, format, cards [{name, qty, board?}]}, or {} when the deck is gone. */
    suspend fun deckPlay(id: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.deckPlay(${str(id)})") as String).asJsonObject }
    /** tcg.js A.tDeckMenu's sheet for a Yu-Gi-Oh! or Pokémon deck, read as deckMenu reads the Magic one. */
    suspend fun tdeckMenu(game: String, id: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.tdeckMenu(${str(game)}, ${str(id)})") as String).asJsonObject }
    /** tcg.js A.tDeckCopy's list and A.tDeckExport's file: {text, export, file}. */
    suspend fun tdeckText(game: String, id: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.tdeckText(${str(game)}, ${str(id)})") as String).asJsonObject }
    /** app.js A.cardDeckPicker: {decks: [[id, name]], selected} for a card page's Add to deck. */
    suspend fun deckPick(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.deckPick(${str(game)})") as String).asJsonObject }
    /** app.js A.addLookup: {name, preview, clearPrint} or {error}. */
    suspend fun addLookup(name: String): JsonObject {
        on { q -> q.evaluate("Collection.addLookup(${str(name)})") }
        return pumpUntil("Collection.lookupPoll()", 20_000).also { if (it["done"]?.asBoolean != true) it.addProperty("error", "That took too long. Try again.") }
    }
    /** app.js refreshConditionPrice for the add sheet: [paint] gets {blocks, placeholder} at once and again when the feed answers. */
    suspend fun addPrice(form: JsonObject, retry: Boolean, paint: (JsonObject) -> Unit) {
        on { q -> q.evaluate("Collection.addPrice(${str(form.toString())}, $retry)") }
        var last = ""
        pumpUntil("Collection.pricePoll()", 30_000) { r -> val t = r.toString(); if (t != last) { last = t; paint(r) } }
    }
    /** Saves the bundle made outside a tap since the last ask (condition quotes kept on lots). */
    suspend fun bg(): Int = on { q -> (q.evaluate("Collection.bg()") as Number).toInt() }

    /** app.js A.undo: the state before the last undoable change, written the same way; {writes, toasts}. */
    suspend fun undo(): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.undo()") as String).asJsonObject }
    /** The workspace as the account keeps it (this device's copy, and what a push sends). */
    suspend fun saved(): String = on { q -> q.evaluate("Collection.saved()") as String }
    /** cloud.js workspaceSig and isEmptyWorkspace of [saved]: {sig, empty}. */
    suspend fun syncInfo(): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.syncInfo()") as String).asJsonObject }
    /** cloud.js workspaceSig of an account copy's data. */
    suspend fun sigOf(data: String): String = on { q -> q.evaluate("Collection.sigOf(${str(data)})") as String }
    /** sync-merge.js mergeAccountWorkspaces(base, this device's copy, the account's): the result becomes this device's copy. */
    suspend fun mergeIn(base: String?, cloud: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.mergeIn(${base?.let(::str) ?: "null"}, ${str(cloud)})") as String).asJsonObject }

    /** search-hints.js: the search field's prompt and the names and questions it fades through. */
    /** tcg.js loadCache: the Yu-Gi-Oh! and Pokémon card data this device kept ([raw], the saved record), merged as the site does. */
    suspend fun tcgCacheLoad(raw: String?) { on { q -> q.evaluate("Collection.tcgCacheLoad(${raw?.let(::str) ?: "null"})") }; turn { _, _, _ -> } }
    /** tcg.js's card cache as the site saves it (TCG_CACHE), to keep for the next visit. */
    suspend fun tcgCache(): String = on { q -> q.evaluate("Collection.tcgCache()") as String }

    /** tcg.js A.tSetByName: the set a Yu-Gi-Oh! set name points to (its id), or "" when none is found in [maxMs]. */
    /**
     * Today's pack (app.js A.homeTodayPack, up to the set): today's set and the Card of the Day the next Open Pack in it pulls as its hit.
     * {game, set (Magic's code, Pokémon's id; Yu-Gi-Oh! names it), name} or {error}.
     */
    suspend fun todayPack(game: String, maxMs: Long = 30_000): JsonObject {
        on { q -> q.evaluate("Collection.todayPack(${str(game)})") }
        // Only its own lookups (the Card of the Day, then its set): Home's refresh can keep fetching beside it.
        pumpUntil("Collection.todayPoll()", maxMs)
        return model("Collection.todayWent()")
    }

    /** The launch warm-up: only today's Card of the Day and its set (tcg.js loadHero, home-today.js dailyDetails), no other feed. */
    suspend fun today(game: String, maxMs: Long = 20_000) { on { q -> q.evaluate("Collection.today(${str(game)})") }; pumpUntil("Collection.todayDone()", maxMs) }

    suspend fun setByName(game: String, name: String, maxMs: Long = 30_000): String {
        on { q -> q.evaluate("Collection.setByName(${str(game)}, ${str(name)})") }
        pumpUntil("Collection.setPoll()", maxMs)
        return on { q -> q.evaluate("Collection.setWent()") as String }
    }

    suspend fun hints(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.hints(${str(game)})") as String).asJsonObject }

    /** The catalog the lookups filled (store.js S.catalog), for the app to keep between visits. */
    suspend fun catalog(): String = on { q -> q.evaluate("Collection.catalog()") as String }

    /** For tests: any expression in the bundle's scope, as a string. */
    internal suspend fun eval(code: String): String = on { q -> q.evaluate("String($code)") as String }

    private val JSON = "application/json".toMediaType()
    /** A body as text: a gzip file (the rulebooks, .json.gz) unpacked first, as the site's loadRulePack unpacks it. */
    private fun body(b: ByteArray): String =
        if (b.size > 2 && b[0] == 0x1f.toByte() && b[1] == 0x8b.toByte()) java.util.zip.GZIPInputStream(b.inputStream()).use { it.readBytes() }.toString(Charsets.UTF_8)
        else b.toString(Charsets.UTF_8)
    /** Where a rulebook file is kept on this device (the manifest and each game's book), or null for anything else. */
    private fun kept(url: String): java.io.File? {
        val m = Regex("^https://cardstashy\\.com/rulebooks/([\\w.-]+)$").find(url.substringBefore('?')) ?: return null
        val dir = filesDir ?: return null
        return java.io.File(dir, "rulebooks/" + m.groupValues[1])
    }
    /** Tests: a URL's answer (status, body) without the network; null sends it as usual; status 0 holds it until [releaseForTest]. */
    @Volatile internal var answerForTest: ((String) -> Pair<Int, String>?)? = null
    private val heldForTest = ConcurrentLinkedQueue<JsonObject>()
    internal fun releaseForTest() { while (true) send(heldForTest.poll() ?: break) }
    private fun send(r: JsonObject) {
        val id = r.get("id").asInt
        val raw = r.get("url").asString
        // The site's own routes are relative ("api/meta/mtg?…", "/api/…"): they resolve against the site.
        val url = if (raw.startsWith("http")) raw else "https://cardstashy.com/" + raw.removePrefix("/")
        answerForTest?.invoke(url)?.let { (code, text) -> if (code == 0) heldForTest.add(r) else answers.add(Triple(id, code, "{}" to text)); return }
        val method = r.get("method")?.asString ?: "GET"
        val body = r.get("body")?.takeIf { it.isJsonPrimitive }?.asString
        CoroutineScope(Dispatchers.IO).launch {
            val ans = try {
                val b = Request.Builder().url(url).header("User-Agent", dev.cardstashy.nativeplay.art.CardArt.UA)
                r.getAsJsonObject("headers")?.entrySet()?.forEach { (k, v) -> if (v.isJsonPrimitive) b.header(k, v.asString) }
                b.method(method, body?.toRequestBody(JSON) ?: if (method == "GET" || method == "HEAD") null else ByteArray(0).toRequestBody(JSON))
                client.newCall(b.build()).execute().use { res ->
                    val h = JsonObject(); res.headers.forEach { (k, v) -> h.addProperty(k.lowercase(), v) }
                    val text = body(res.body?.bytes() ?: ByteArray(0))
                    if (res.isSuccessful) kept(url)?.let { f -> runCatching { f.parentFile?.mkdirs(); f.writeText(text) } }
                    Triple(id, res.code, h.toString() to text)
                }
            } catch (_: Exception) {
                // Offline: the rulebook files saved when they last came in (the site keeps them in the browser's storage).
                kept(url)?.takeIf { it.exists() }?.let { f -> Triple(id, 200, "{}" to body(f.readBytes())) } ?: Triple(id, -1, "{}" to "")
            }
            answers.add(ans)
        }
    }
}
