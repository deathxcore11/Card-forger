package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private val AskPanel = Color(0x0DFFFFFF)
private val AskLineC = Color(0x17FFFFFF)
private val AskMute = Color(0xFF9B9CA8)

/** .ask-new: "＋ New". */
@Composable
internal fun AskNew(enabled: Boolean, onClick: () -> Unit) {
    Text("＋ New", Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF1F232B)).border(1.dp, Color(0xFF2A2F39), RoundedCornerShape(12.dp))
        .clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button; contentDescription = "New chat" }
        .padding(horizontal = 11.dp, vertical = 12.dp).alpha(if (enabled) 1f else .5f), style = cssType(13f, 700, 16f))
}

/** .ask-bar: the question field and the round gold Ask button. */
@Composable
internal fun AskBar(value: String, onValue: (String) -> Unit, placeholder: String, enabled: Boolean, onSend: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.weight(1f)) {
            FormInput(value, onValue, cssType(14f, 400, 20f), placeholder = placeholder.ifBlank { "Ask about cards, prices, sets, decks…" }, desc = "Your question",
                ime = ImeAction.Send, onGo = onSend)
        }
        Box(Modifier.size(44.dp).clip(CircleShape).background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Color(0xFFF2D496), Color(0xFFA67C34))))
            .alpha(if (enabled && value.isNotBlank()) 1f else .55f)
            .clickable(enabled = enabled, onClick = onSend).semantics { role = Role.Button; contentDescription = "Ask" }, contentAlignment = Alignment.Center) {
            Text("↑", style = cssType(18f, 800, 20f, Color(0xFF1A1408)))
        }
    }
}

@Composable
internal fun AskPill(q: String, enabled: Boolean, modifier: Modifier = Modifier, small: Boolean = false, onClick: () -> Unit) {
    Text(q, modifier.clip(RoundedCornerShape(if (small) 999.dp else 14.dp)).background(Color(0x0CFFFFFF)).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(if (small) 999.dp else 14.dp))
        .clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button }
        .padding(horizontal = if (small) 11.dp else 14.dp, vertical = if (small) 7.dp else 11.dp), style = cssType(if (small) 13f else 14f, 600, if (small) 17f else 19f))
}

@Composable
internal fun AiBubble(border: Color = AskLineC, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
        Column(Modifier.widthIn(max = 360.dp).clip(RoundedCornerShape(20.dp, 20.dp, 20.dp, 6.dp)).background(AskPanel)
            .border(1.dp, border, RoundedCornerShape(20.dp, 20.dp, 20.dp, 6.dp)).padding(horizontal = 15.dp, vertical = 12.dp), content = content)
    }
}

/** .ask-item: a card, set, deck or drafted deck the answer names; its picture, name, what it is and its price. */
@Composable
internal fun AskTile(t: JsonObject, open: (JsonObject) -> Unit) {
    val show = t.getAsJsonObject("show") ?: return
    val title = t.s("title").ifBlank { show.s("label").ifBlank { show.s("ref") } }
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x2A000000)).border(1.dp, Color(0x1CFFFFFF), RoundedCornerShape(14.dp))
        .clickable { open(show) }.semantics { role = Role.Button; contentDescription = t.s("label").ifBlank { "Open $title" } }.padding(8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (t.s("art").isNotEmpty()) CardPicture(t.s("art"), null, null, Modifier.width(if (t.get("build")?.asBoolean == true || show.s("kind") != "card") 64.dp else 34.dp).height(46.dp), RoundedCornerShape(6.dp),
            contentScale = androidx.compose.ui.layout.ContentScale.Crop)
        Column(Modifier.weight(1f)) {
            Text(title, style = cssType(13.5f, 700, 18f), maxLines = 2)
            (t.getAsJsonArray("lines")?.map { it.asString }.orEmpty() + listOfNotNull(t.s("status").takeIf { it.isNotEmpty() })).distinct().forEach {
                Text(it, style = cssType(12f, 400, 16f, AskMute), maxLines = 2) }
        }
        if (t.s("price").isNotEmpty()) Text(t.s("price"), style = cssType(13f, 700, 17f, Site.Gold))
    }
}

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()

/**
 * A tapped tile's place in the app: a tournament deck's sheet (over any page), the app's Build a deck on the drafted request, a deck's
 * page; anything else for the page that opened the chat ([CollectionWrites.AskOpen.go], [askGo]).
 */
internal fun askTo(d: JsonObject, o: CollectionWrites.AskOpen) {
    val game = d.s("game").ifBlank { o.game }
    when (d.s("to")) {
        "none" -> {}
        "meta" -> CollectionWrites.metaDeck.value = CollectionWrites.MetaOpen(game, o.web)
        "build" -> d.getAsJsonObject("request")?.let { CollectionWrites.building.value = CollectionWrites.BuildOpen(it, "openDeckFlow", o.web) }
        else -> {
            val h = d.s("hash"); val deck = Regex("^#t?deck/([^/]+)").find(h)?.groupValues?.get(1)?.let(android.net.Uri::decode)
            val nav = CollectionWrites.deckNav
            if (d.s("to") == "route" && deck != null && nav != null) nav(deck, if (h.startsWith("#tdeck/")) game else "mtg") else o.go(d)
        }
    }
}

/**
 * Where a tapped tile leads (CollectionEngine.askShow's {to, ...}) from a page that opens card pages over itself ([card]): a card's
 * page, the Sets pages, the Wiki; a deck, a tournament deck or a drafted deck on the website page the site goes to ([web]).
 */
internal fun askGo(d: JsonObject, page: String, card: (CardOpen) -> Unit, sets: (String) -> Unit, set: (String, String) -> Unit,
                   wiki: ((String, String) -> Unit)?, web: (String, String?) -> Unit) {
    val game = d.s("game").ifBlank { "mtg" }
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    when (d.s("to")) {
        "card" -> card(if (game == "mtg") CardOpen(d.s("name"), page = page, tile = "[data-act=\"card\"][data-name=\"${css(d.s("name"))}\"]")
            else CardOpen("", page = page, tile = "[data-act=\"tCard\"][data-id=\"${css(d.s("id"))}\"]", game = game, id = d.s("id"), setId = d.s("setId")))
        "wiki" -> wiki?.invoke(game, d.s("topic")) ?: web("https://cardstashy.com/#wiki/" + android.net.Uri.encode(d.s("topic")), null)
        "route" -> d.s("hash").let { h -> when {
            h == "#sets" -> sets(game)
            h.startsWith("#set/") -> set(game, android.net.Uri.decode(h.removePrefix("#set/")))
            h == "#search" -> {}
            else -> web("https://cardstashy.com/$h", null)
        } }
        else -> web("https://cardstashy.com/#search", "[data-act=\"askOpen\"]")
    }
}
