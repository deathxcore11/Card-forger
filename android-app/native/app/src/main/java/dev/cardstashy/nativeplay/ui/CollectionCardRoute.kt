package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * A card the site's [data-act="card"] opens: [name] with the tile's lot ([entry], the Cards tab) or deck ([deck], a deck
 * page). [page] is the website's page the tile sits on and [tile] the tile's selector there, so a control the app does not
 * draw yet opens that page, presses the tile, then presses the control in the site's card sheet.
 */
data class CardOpen(val name: String, val entry: String = "", val deck: String = "", val page: String, val tile: String,
                    /** A set page's tile: its data-set-i (that printing) and data-set-finish (the finish the page prices). */
                    val setI: Int? = null, val setFinish: String = "",
                    /** A card pulled in Open Pack that isn't one of the set page's (another sheet's printing): its place in the pack. */
                    val pack: Int? = null,
                    /** Yu-Gi-Oh! or Pokémon (tcg.js A.tCard): the game, the card's id and what its tile hands the sheet (the set it was
                     *  opened from, the finish that page prices, Yu-Gi-Oh!'s printing::rarity and edition). */
                    val game: String = "mtg", val id: String = "", val setId: String = "", val setVariant: String = "", val printing: String = "", val edition: String = "",
                    /** Opened by Random (data-random): the page offers 🎲 Another. */
                    val random: Boolean = false)

private fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")

/**
 * views.js cardSheet through the site's own code (Collection.card / cardDo), drawn natively over the page that opened it.
 * The page draws at once from what the catalog has; app.js's lookups (the full card, its printings, the guide's pairings,
 * rulings, the price history and the set index) then fill it in as they land. Overview, Meta, the Play guide and Prices are
 * drawn here; the wishlist heart and the owned − / ＋ save from here (CollectionWrites); rule words and the other actions that change
 * the account (own, decks, your price, Compare, Build, Sort & filter, the wiki, the proven lists, Compare all printings) open the
 * website's card sheet and press the same control there.
 */
@Composable
fun CollectionCardHost(open: CardOpen, onClose: () -> Unit, onOpen: (CardOpen) -> Unit, web: (url: String, press: String?) -> Unit, onSet: ((String) -> Unit)? = null,
                       /** 🎲 Another (A.dbRandom / A.tRandomCard) on a random card's page, where the opener draws the next one; null: the website's. */
                       onRandom: (() -> Unit)? = null) {
    if (open.game != "mtg") return TcgCardHost(open, onClose, onOpen, web, onSet, onRandom)
    val context = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var model by remember(open) { mutableStateOf<CollectionCardModel?>(null) }
    /** A control waiting for the site's handler (kind to value). */
    var asked by remember(open) { mutableStateOf<Pair<String, String>?>(null) }
    LaunchedEffect(open) {
        runCatching {
            val o = JsonObject().apply { addProperty("name", open.name); addProperty("entry", open.entry); addProperty("deck", open.deck); if (open.random) addProperty("random", "1"); open.setI?.let { addProperty("setI", it); addProperty("setFinish", open.setFinish) }; open.pack?.let { addProperty("pack", it); addProperty("setFinish", open.setFinish) } }
            model = withContext(Dispatchers.Default) { CollectionCardModel.parse(CollectionEngine.card("mtg", o)) }
            CollectionEngine.cardLoad()
            CollectionEngine.settle(30_000, CollectionEngine.CARD_MODEL) { j -> if (j.size() > 0) model = CollectionCardModel.parse(j) }
            CollectionEngine.cardModel().takeIf { it.size() > 0 }?.let { model = CollectionCardModel.parse(it) }
        }
    }
    // A save made over this page (the add sheet's): the page is read again, so its owned count is the new one.
    val written by CollectionWrites.written.collectAsState()
    var seenWrite by remember(open) { mutableStateOf(written) }
    LaunchedEffect(written) {
        if (written == seenWrite) return@LaunchedEffect
        seenWrite = written
        runCatching { CollectionEngine.cardModel().takeIf { it.size() > 0 }?.let { model = CollectionCardModel.parse(it) } }
    }
    LaunchedEffect(asked) {
        val (kind, value) = asked ?: return@LaunchedEffect
        runCatching {
            model = withContext(Dispatchers.Default) { CollectionCardModel.parse(CollectionEngine.cardDo(kind, value)) }
            // A printing or "Load more" starts lookups of its own (app.js loadMagicVersions / loadCardExtras); a tab, finish or
            // printing its tab's (the guide's pairings and rulings, the price history).
            CollectionEngine.settle(20_000, CollectionEngine.CARD_MODEL) { j -> if (j.size() > 0) model = CollectionCardModel.parse(j) }
        }
        asked = null
    }
    /** The website's card sheet, then [control] inside it. */
    fun site(control: String?) = web(open.page, listOfNotNull(open.tile, control?.let { "#sheet[open] $it" }).joinToString("\n"))
    fun press(p: CardPress) {
        val d = p.data
        when {
            p.href.isNotBlank() -> {
                val uri = android.net.Uri.parse(p.href)
                if (uri.host?.endsWith("cardstashy.com") == true) web(p.href, null)
                else runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri)) }
            }
            p.act == "dbRandom" && onRandom != null -> onRandom()
            p.act == "card" && !d["name"].isNullOrBlank() -> onOpen(open.copy(name = d.getValue("name"), entry = "", setI = null, setFinish = "", pack = null))
            p.act == "go" && !d["to"].isNullOrBlank() -> web("https://cardstashy.com/" + d.getValue("to"), null)
            p.act == "set" && !d["code"].isNullOrBlank() -> onSet?.invoke(d.getValue("code").lowercase()) ?: web("https://cardstashy.com/#set/" + android.net.Uri.encode(d.getValue("code").lowercase()), null)
            // The heart and the owned − / ＋ save here: the site's handler, then the page again (CollectionWrites).
            p.act in CollectionWrites.CARD_ACTS -> scope.launch { if (CollectionWrites.act(context, p.act, dataset(d))) CollectionEngine.cardModel().takeIf { it.size() > 0 }?.let { model = CollectionCardModel.parse(it) } }
            // The "In <deck>" panel (a card opened from a deck): its − / ＋ and Remove from deck save here (app.js deckQty / deckRemove);
            // Remove closes the page, as the site's closeSheet does.
            p.act == "deckQty" && open.deck.isNotBlank() -> scope.launch { CollectionWrites.act(context, "deckQty", dataset(d).apply { addProperty("deck", open.deck) }) }
            p.act == "deckRemove" && open.deck.isNotBlank() -> scope.launch { if (CollectionWrites.act(context, "deckRemove", dataset(d).apply { addProperty("deck", open.deck) })) onClose() }
            // Add to deck (A.cardDeckPicker): the deck picker over this page, saved here.
            p.act == "cardDeckPicker" && d["game"] == "mtg" && !d["name"].isNullOrBlank() ->
                CollectionWrites.picking.value = CollectionWrites.DeckPick("mtg", d.getValue("name"), closeAll = onClose, go = { to -> web("https://cardstashy.com/$to", null) })
            // pricing-presentation.js's Add to collection (A.own): the add sheet with this printing, saved here.
            p.act == "own" && !d["name"].isNullOrBlank() -> CollectionWrites.openAdd(JsonObject().apply { addProperty("own", d.getValue("name")); addProperty("fromCard", true) })
            p.act == "magicVersionsMore" -> asked = "more" to ""
            p.act == "flipFace" -> asked = "face" to ""
            p.act == "cardTab" && d["tab"] in setOf("overview", "meta", "guide", "prices") -> asked = "tab" to d.getValue("tab")
            p.act == "marketRange" && !d["range"].isNullOrBlank() -> asked = "range" to d.getValue("range")
            p.act == "priceSource" && !d["src"].isNullOrBlank() -> asked = "source" to d.getValue("src")
            p.act.isNotBlank() -> site("[data-act=\"${css(p.act)}\"]" + d.filterKeys { it != "act" }.entries.joinToString("") { (k, v) -> "[data-${k}=\"${css(v)}\"]" })
        }
    }
    val m = model ?: return
    val act = CollectionCardActions(
        tab = { k -> if (k in setOf("overview", "meta", "guide", "prices")) asked = "tab" to k else site("[data-act=\"cardTab\"][data-tab=\"${css(k)}\"]") },
        range = { r -> asked = "range" to r },
        source = { src -> asked = "source" to src },
        historySource = { key, src -> asked = "historySource" to JsonObject().apply { addProperty("key", key); addProperty("source", src) }.toString() },
        finish = { f -> asked = "finish" to f },
        print = { i -> asked = "print" to i.toString() },
        face = { asked = "face" to "" },
        card = { n -> onOpen(open.copy(name = n, entry = "", setI = null, setFinish = "", pack = null)) },
        rule = { key -> site("[data-act=\"ruleHint\"][data-rule=\"${css(key)}\"]") },
        profile = {
            val s = m.shown
            val img = s?.getAsJsonObject("image_uris") ?: s?.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")
            fun u(k: String) = img?.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            val art = u("art_crop").ifBlank { u("large") }.ifBlank { m.overview?.image.orEmpty() }
            // As the picker's own Magic search makes them (ProfileArtPicker.kt): the art crop, the set's name.
            ArtPick.open("avatar", ArtPick.Card("mtg", s?.get("id")?.asString.orEmpty(), m.name, s?.get("set_name")?.asString ?: "Magic", art, art))
        },
        press = ::press,
    )
    CollectionCardSheet(m, act, onClose)
}

/**
 * tcg.js tcgCardSheet through the site's own code (Collection.tcard / tcardDo), drawn natively over the page that opened it: the card
 * draws at once from what the set page has, then the full card, Pokémon's other printings, the set list, the Play guide's pairings and
 * the price history fill it in (A.tCard). The tabs, finish chips, Yu-Gi-Oh!'s rarity chips and Edition / Printing pickers, the price
 * jump, the history range, other printings and the set are drawn here; the wishlist heart and the owned − / ＋ save from here
 * (CollectionWrites), and Add to collection opens the site's add sheet here (TcgAddSheet); the rest that changes the account (decks, your price,
 * Compare, Build), the archetype list, a set by name
 * and the wiki open the website's card sheet and press the same control.
 */
@Composable
private fun TcgCardHost(open: CardOpen, onClose: () -> Unit, onOpen: (CardOpen) -> Unit, web: (url: String, press: String?) -> Unit, onSet: ((String) -> Unit)?, onRandom: (() -> Unit)?) {
    val context = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var model by remember(open) { mutableStateOf<CollectionCardModel?>(null) }
    var asked by remember(open) { mutableStateOf<Pair<String, String>?>(null) }
    fun show(j: JsonObject) { if (j.size() > 0 && j.get("missing") == null) model = CollectionCardModel.parse(j) }
    LaunchedEffect(open) {
        runCatching {
            val o = JsonObject().apply {
                addProperty("game", open.game); addProperty("id", open.id); addProperty("entry", open.entry); addProperty("deck", open.deck); if (open.random) addProperty("random", "1")
                addProperty("setId", open.setId); addProperty("setVariant", open.setVariant); addProperty("printing", open.printing); addProperty("edition", open.edition)
                open.pack?.let { addProperty("pack", it) }
            }
            show(withContext(Dispatchers.Default) { CollectionEngine.tcard(o) })
            CollectionEngine.tcardLoad()
            CollectionEngine.settle(30_000, CollectionEngine.TCARD_MODEL, ::show)
            show(CollectionEngine.tcardModel())
        }
    }
    LaunchedEffect(asked) {
        val (kind, value) = asked ?: return@LaunchedEffect
        runCatching {
            show(withContext(Dispatchers.Default) { CollectionEngine.tcardDo(kind, value) })
            // A tab, finish, rarity or edition starts its tab's lookups (the guide's pairings, the shown quote's price history).
            CollectionEngine.settle(20_000, CollectionEngine.TCARD_MODEL, ::show)
        }
        asked = null
    }
    /** The website's card sheet (the page, the tile that opened it), then [control] inside it. */
    fun site(control: String?) = web(open.page, listOfNotNull(open.tile.ifBlank { null }, control?.let { "#sheet[open] $it" }).joinToString("\n").ifBlank { null })
    fun press(p: CardPress) {
        val d = p.data
        fun v(k: String) = d[k].orEmpty()
        when {
            p.href.isNotBlank() -> {
                val uri = android.net.Uri.parse(p.href)
                if (uri.host?.endsWith("cardstashy.com") == true) web(p.href, null)
                else runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri)) }
            }
            // Another printing (card-detail-extras.js miniPrintingMarkup): its page over this one; on the website, this card's sheet then that printing.
            p.act == "tCard" && v("id").isNotBlank() && (v("game").isBlank() || v("game") == open.game) ->
                onOpen(CardOpen("", entry = v("entry"), deck = v("deck").ifBlank { open.deck }, page = open.page,
                    tile = listOfNotNull(open.tile.ifBlank { null }, "#sheet[open] [data-act=\"tCard\"][data-id=\"${css(v("id"))}\"]").joinToString("\n"),
                    game = open.game, id = v("id"), setId = v("set-id"), setVariant = v("set-variant"), printing = v("printing"), edition = v("edition")))
            p.act == "tSet" && v("id").isNotBlank() && onSet != null -> onSet(v("id"))
            p.act == "tRandomCard" && onRandom != null -> onRandom()
            p.act in CollectionWrites.CARD_ACTS -> scope.launch { if (CollectionWrites.act(context, p.act, dataset(d))) show(CollectionEngine.tcardModel()) }
            // pricing-presentation.js's Add to collection (A.tOwn): the site's add sheet over this page, saved here; the page shows the copies after.
            p.act == "tOwn" && v("id").isNotBlank() -> CollectionWrites.tAdding.value = CollectionWrites.TcgAddOpen(dataset(d).apply { addProperty("game", open.game) },
                saved = { scope.launch { show(CollectionEngine.tcardModel()) } }, closeAll = onClose)
            p.act == "go" && v("to").isNotBlank() -> web("https://cardstashy.com/" + v("to"), null)
            p.act == "cardTab" && v("tab") in setOf("overview", "meta", "guide", "prices", "rulings", "legal") -> asked = "tab" to v("tab")
            p.act == "cardFinishPreview" && v("finish").isNotBlank() -> asked = "finish" to v("finish")
            p.act == "ygoPickRarity" && v("edition").isNotBlank() -> asked = "rarity" to v("edition")
            p.act == "cardPriceJump" -> asked = "jump" to v("finish")
            p.act == "marketRange" && v("range").isNotBlank() -> asked = "range" to v("range")
            p.act.isNotBlank() -> site("[data-act=\"${css(p.act)}\"]" + d.filterKeys { it != "act" }.entries.joinToString("") { (k, x) -> "[data-${k}=\"${css(x)}\"]" })
        }
    }
    val m = model ?: return
    val act = CollectionCardActions(
        tab = { k -> asked = "tab" to k },
        range = { r -> asked = "range" to r },
        historySource = { key, src -> asked = "historySource" to JsonObject().apply { addProperty("key", key); addProperty("source", src) }.toString() },
        finish = { f -> asked = "finish" to f },
        select = { name, value -> asked = "select" to JsonObject().apply { addProperty("name", name); addProperty("value", value) }.toString() },
        card = { _ -> },
        rule = { key -> site("[data-act=\"ruleHint\"][data-rule=\"${css(key)}\"]") },
        profile = {
            // app.js A.cardProfilePhoto: the enlarged card's picture, as the picker's own search makes a card (ProfileArtPicker.kt).
            val o = m.overview
            val img = o?.zoomSrc?.ifBlank { null } ?: o?.image.orEmpty()
            ArtPick.open("avatar", ArtPick.Card(open.game, m.id, m.name, m.set?.name?.ifBlank { null } ?: m.game.label, img, img))
        },
        press = ::press,
    )
    CollectionCardSheet(m, act, onClose)
}

/** A tapped button's data-* attributes as the site's handler reads them (t.dataset). */
internal fun dataset(d: Map<String, String>) = JsonObject().apply { for ((k, v) in d) if (k != "act") addProperty(k, v) }
