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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.launch

/**
 * Compare cards (gap audit H1; app.js A.compareOpen and tcg.js A.tCompareOpen), in the app as the gap-screens preview draws it: two
 * whole cards side by side with VS between, the site's facts under each, the site's verdict in a panel (for Magic, "Swap into <deck>"
 * when the first card is in the open deck), and Clear. An empty side takes a typed name (the site's Look up). A card opens its page.
 * The pair and every word are the site's own, run in the Collection engine (CollectionEngine.compare*). On a two-screen handheld
 * the cards stay on the top screen and the verdict and buttons go to the bottom one.
 */
@Composable
internal fun CardCompareSheet(o: CollectionWrites.CompareOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var model by remember { mutableStateOf<JsonObject?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val typed = remember { mutableStateMapOf<Int, String>() }
    LaunchedEffect(o.id) {
        if (!CollectionReady.ready(context)) { onClose(); return@LaunchedEffect }
        o.first?.let { ref -> busy = true; CollectionEngine.compareFrom(o.game, ref)?.let { error = it }; busy = false }
        model = CollectionEngine.compareModel(o.game)
    }
    val m = model ?: return
    fun lookup(i: Int) {
        val q = typed[i].orEmpty().trim(); if (q.isEmpty() || busy) return
        busy = true; error = ""
        scope.launch {
            CollectionEngine.compareLookup(o.game, i, q)?.let { error = it }
            model = CollectionEngine.compareModel(o.game); typed.remove(i); busy = false
        }
    }
    fun clear() { scope.launch { error = ""; model = CollectionEngine.compareClear(o.game, -1) } }
    fun swap() {
        if (busy) return
        busy = true
        scope.launch { val saved = CollectionWrites.act(context, "compareSwap", JsonObject()); busy = false; if (saved) onClose() }
    }
    val sides = m.getAsJsonArray("sides")?.map { it.asJsonObject }.orEmpty()
    val two = DualScreen.active
    SiteSheet(m.s("title").ifBlank { "Compare cards" }, backdrop, onClose = onClose) { _ ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            sides.getOrNull(0)?.let { CompareSide(it, o.game, typed[0].orEmpty(), { v -> typed[0] = v }, { lookup(0) }, o.openCard, Modifier.weight(1f)) }
            Text("VS", Modifier.align(Alignment.CenterVertically).border(1.dp, Site.Gold, RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 7.dp),
                style = cssType(12f, 700, 14f, Site.Gold))
            sides.getOrNull(1)?.let { CompareSide(it, o.game, typed[1].orEmpty(), { v -> typed[1] = v }, { lookup(1) }, o.openCard, Modifier.weight(1f)) }
        }
        if (!two) CompareVerdict(m, error, busy, ::swap, ::clear)
    }
    if (two) BottomScreen { Column(Modifier.fillMaxWidth().background(Site.Bg).padding(16.dp)) { CompareVerdict(m, error, busy, ::swap, ::clear) } }
    PadScreen(PadActs(x = if (m.s("swap").isNotEmpty()) PadAct(m.s("swap")) { swap() } else null, y = if (m.get("clear")?.asBoolean == true) PadAct("Clear") { clear() } else null))
}

/** The verdict panel (the site's own sentence), its Swap button, the error line and Clear. */
@Composable
internal fun ColumnScope.CompareVerdict(m: JsonObject, error: String, busy: Boolean, swap: () -> Unit, clear: () -> Unit) {
    if (error.isNotEmpty()) { Spacer(Modifier.height(10.dp)); Text(error, style = cssType(13f, 600, 18.85f, Color(0xFFFFB86B))) }
    val verdict = m.s("verdict").ifBlank { m.s("foot") }
    if (verdict.isNotEmpty()) {
        Spacer(Modifier.height(12.dp))
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFF151821)).border(1.dp, Color(0xFF2B3040), RoundedCornerShape(14.dp)).padding(12.dp)) {
            Text(verdict, style = cssType(14f, 400, 21f))
            if (m.s("swap").isNotEmpty()) { Spacer(Modifier.height(10.dp)); FormGold(m.s("swap"), enabled = !busy, modifier = Modifier.fillMaxWidth()) { swap() } }
        }
    }
    if (m.get("clear")?.asBoolean == true) { Spacer(Modifier.height(10.dp)); SiteGhost("Clear", Modifier.fillMaxWidth()) { clear() } }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CompareSide(c: JsonObject, game: String, typed: String, onType: (String) -> Unit, onLookup: () -> Unit, openCard: (String, String) -> Unit, modifier: Modifier) {
    if (c.get("empty")?.asBoolean == true) {
        Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            FormInput(typed, onType, cssType(14f, 400, 20f), placeholder = "Card name", desc = "Card ${c.get("i")?.asInt?.plus(1) ?: 1} name", onGo = onLookup)
            SiteGhost("Look up", Modifier.fillMaxWidth()) { onLookup() }
        }
        return
    }
    val name = c.s("name")
    val ygo = c.getAsJsonObject("picture")?.s("src")?.contains("/ygo/") == true
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(if (ygo) 421f / 614f else 488f / 680f).clip(RoundedCornerShape(9.dp))
            .clickable { openCard(name, c.s("id")) }.semantics { role = Role.Button; contentDescription = "Open $name" }) {
            CardPicture(c.getAsJsonObject("picture")?.s("src"), null, null, Modifier.fillMaxWidth(), RoundedCornerShape(9.dp))
        }
        Text(name, style = cssType(13.5f, 700, 17f))
        val facts = compareFacts(game, c)
        if (facts.isNotEmpty()) Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            facts.forEach { (k, v) -> Row(Modifier.fillMaxWidth()) {
                Text(k, Modifier.weight(1f), style = cssType(12f, 400, 16f, Color(0xFF9B9CA8)))
                Text(v, style = cssType(12f, 600, 16f))
            } }
        }
        compareNotes(game, c).forEach { Text(it, style = cssType(12f, 400, 16f, Color(0xFF9B9CA8))) }
        val chips = c.getAsJsonArray("chips")?.map { it.asString }.orEmpty()
        if (chips.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            chips.forEach { Text(it, Modifier.border(1.dp, Color(0xFF2B3040), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 5.dp), style = cssType(11f, 700, 12f)) }
        }
    }
}

/**
 * The facts under a card: Yu-Gi-Oh! and Pokémon's are tcgcompare.js compareFacts as the site lists them; Magic's are views.js
 * compareSheet's lines ("MV 1 · $1.20", "3 free in collection") as the preview labels them (Mana value, Price, Free in collection).
 */
internal fun compareFacts(game: String, c: JsonObject): List<Pair<String, String>> {
    val facts = c.getAsJsonArray("facts")?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()
    if (game != "mtg") return facts
    val out = mutableListOf<Pair<String, String>>()
    for (l in c.getAsJsonArray("lines")?.map { it.asString }.orEmpty()) {
        Regex("^MV (\\S+) · (.+)$").find(l)?.let { out += "Mana value" to it.groupValues[1]; out += "Price" to it.groupValues[2] }
        Regex("^(\\d+) free in collection$").find(l)?.let { out += "Free in collection" to it.groupValues[1] }
    }
    return out
}
/** What is left of a side's lines once the facts are out: the type line, Magic's complexity, Yu-Gi-Oh! effects. */
internal fun compareNotes(game: String, c: JsonObject): List<String> {
    val lines = c.getAsJsonArray("lines")?.map { it.asString }.orEmpty()
    val rest = if (game == "mtg") lines.filterNot { Regex("^MV \\S+ · |^\\d+ free in collection$").containsMatchIn(it) } else lines
    return rest + listOfNotNull(c.s("effects").takeIf { it.isNotBlank() })
}

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()

/** The collection loaded for the signed-in account before the engine is asked (as the alert sheet does). */
internal object CollectionReady {
    suspend fun ready(context: android.content.Context): Boolean {
        val s = dev.cardstashy.nativeplay.account.Account.session.value
        val ok = ensureCollection(context.applicationContext, s?.userId, s != null, dev.cardstashy.nativeplay.account.Decks.fullRevision.value)
        if (!ok) CollectionWrites.show("Your collection is still loading. Try again in a moment.")
        return ok
    }
}
