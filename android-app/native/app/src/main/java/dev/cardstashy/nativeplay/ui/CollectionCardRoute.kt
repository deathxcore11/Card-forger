package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * A card the site's [data-act="card"] opens: [name] with the tile's lot ([entry], the Cards tab) or deck ([deck], a deck
 * page). [page] is the website's page the tile sits on and [tile] the tile's selector there, so a control the app does not
 * draw yet opens that page, presses the tile, then presses the control in the site's card sheet.
 */
data class CardOpen(val name: String, val entry: String = "", val deck: String = "", val page: String, val tile: String,
                    /** A set page's tile: its data-set-i (that printing) and data-set-finish (the finish the page prices). */
                    val setI: Int? = null, val setFinish: String = "")

private fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")

/**
 * views.js cardSheet through the site's own code (Collection.card / cardDo), drawn natively over the page that opened it.
 * The page draws at once from what the catalog has; app.js's lookups (the full card, its printings, the guide's pairings,
 * rulings, the price history and the set index) then fill it in as they land. Overview, Meta, the Play guide and Prices are
 * drawn here; rule words and the actions that change the account (own, wishlist, the ±, decks, your price, Compare, Build,
 * Sort & filter, the wiki, the proven lists, Compare all printings) open the website's card sheet and press the same control there.
 */
@Composable
fun CollectionCardHost(open: CardOpen, onClose: () -> Unit, onOpen: (CardOpen) -> Unit, web: (url: String, press: String?) -> Unit, onSet: ((String) -> Unit)? = null) {
    val context = LocalContext.current
    var model by remember(open) { mutableStateOf<CollectionCardModel?>(null) }
    /** A control waiting for the site's handler (kind to value). */
    var asked by remember(open) { mutableStateOf<Pair<String, String>?>(null) }
    LaunchedEffect(open) {
        runCatching {
            val o = JsonObject().apply { addProperty("name", open.name); addProperty("entry", open.entry); addProperty("deck", open.deck); open.setI?.let { addProperty("setI", it); addProperty("setFinish", open.setFinish) } }
            model = withContext(Dispatchers.Default) { CollectionCardModel.parse(CollectionEngine.card("mtg", o)) }
            CollectionEngine.cardLoad()
            CollectionEngine.settle(30_000, CollectionEngine.CARD_MODEL) { j -> if (j.size() > 0) model = CollectionCardModel.parse(j) }
            CollectionEngine.cardModel().takeIf { it.size() > 0 }?.let { model = CollectionCardModel.parse(it) }
        }
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
            p.act == "card" && !d["name"].isNullOrBlank() -> onOpen(open.copy(name = d.getValue("name"), entry = "", setI = null, setFinish = ""))
            p.act == "go" && !d["to"].isNullOrBlank() -> web("https://cardstashy.com/" + d.getValue("to"), null)
            p.act == "set" && !d["code"].isNullOrBlank() -> onSet?.invoke(d.getValue("code").lowercase()) ?: web("https://cardstashy.com/#set/" + android.net.Uri.encode(d.getValue("code").lowercase()), null)
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
        card = { n -> onOpen(open.copy(name = n, entry = "", setI = null, setFinish = "")) },
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
