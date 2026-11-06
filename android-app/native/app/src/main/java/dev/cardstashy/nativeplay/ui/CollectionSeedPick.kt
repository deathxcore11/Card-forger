package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.launch

/** tcg.js tcgPickSheet as data (Collection.seedPick). */
internal class SeedPickModel(val title: String, val intro: String, val placeholder: String, val rows: List<Row>, val empty: String, val go: String) {
    class Row(val id: String, val name: String, val qty: String, val art: String, val key: String)
    companion object {
        fun parse(j: JsonObject): SeedPickModel {
            fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            return SeedPickModel(j.s("title"), j.s("intro"), j.s("placeholder"),
                j.getAsJsonArray("rows")?.map { it.asJsonObject }?.map { r -> Row(r.s("id"), r.s("name"), r.s("qty"), r.s("art"), r.s("key")) }.orEmpty(), j.s("empty"), j.s("go"))
        }
    }
}

/**
 * Yu-Gi-Oh! and Pokémon's ☑ Pick cards to build around (tcg.js A.tPickSeeds, tcgPickSheet): the intro, Filter your cards (I.tSeedQ hides
 * rows whose name doesn't hold the words), the player's cards (.seed-row: an 18 checkbox, a 28 × 40 picture with 3 corners, the name cut
 * with …, ×qty muted), and the foot's button: "Pick cards to build around" (disabled) until a card is ticked, then "⚒ Build with N
 * card(s)" (C.tSeedToggle), which runs A.tSeedGo (the sheet closes, then A.tBuildMulti) and opens Build a deck on its request.
 */
@Composable
internal fun SeedPickSheet(game: String, backdrop: GraphicsLayer?, onClose: () -> Unit, onBuild: (JsonObject) -> Unit, initial: SeedPickModel? = null) {
    val scope = rememberCoroutineScope()
    val model by produceState(initial, game) { if (initial == null) value = runCatching { SeedPickModel.parse(CollectionEngine.seedPick(game)) }.getOrNull() ?: run { onClose(); null } }
    val m = model ?: return
    var q by remember { mutableStateOf("") }
    var picked by remember { mutableStateOf(listOf<String>()) }
    var busy by remember { mutableStateOf(false) }
    fun go() {
        if (busy || picked.isEmpty()) return
        busy = true
        scope.launch {
            try {
                val r = CollectionEngine.act("tSeedGo", JsonObject().apply { addProperty("game", game); addProperty("ids", picked.joinToString(",")) }, 60_000)
                r.get("error")?.takeIf { it.isJsonPrimitive }?.asString?.let { CollectionWrites.show(it); return@launch }
                r.getAsJsonArray("toasts")?.lastOrNull()?.asJsonObject?.get("text")?.asString?.let { CollectionWrites.show(it) }
                val req = r.get("made")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.startsWith("{") }?.let { JsonParser.parseString(it).asJsonObject } ?: return@launch
                onClose(); onBuild(req)
            } finally { busy = false }
        }
    }
    val n = picked.size
    // C.tSeedToggle: the button's words as the ticks change.
    val label = if (n > 0) "⚒ Build with $n card${if (n == 1) "" else "s"}" else m.go
    SiteSheet(m.title, backdrop, onClose, foot = {
        FormGold(label, enabled = n > 0 && !busy, modifier = Modifier.fillMaxWidth(), pal = LocalSheetPal.current) { go() }
    }) { _ ->
        Text(m.intro, style = cssType(13f, 400, 19.5f, Site.Muted))
        Spacer(Modifier.height(10.dp))
        FormInput(q, { q = it }, cssType(14f, 400, 20f), m.placeholder, desc = m.placeholder)
        Spacer(Modifier.height(8.dp))
        val words = q.trim().lowercase()
        if (m.rows.isEmpty()) Text(m.empty, style = cssType(13f, 400, 19.5f, Site.Muted))
        Column {
            val shown = m.rows.filter { words.isEmpty() || it.key.contains(words) }
            shown.forEachIndexed { i, r ->
                val on = r.id in picked
                val line = Site.Line
                Row(Modifier.fillMaxWidth().heightIn(min = 44.dp)
                    .clickable { picked = if (on) picked - r.id else picked + r.id }
                    .semantics { role = Role.Checkbox; stateDescription = if (on) "Ticked" else "Not ticked"; contentDescription = r.name }
                    .drawBehind { if (i < shown.size - 1) drawLine(line, Offset(0f, size.height - .5.dp.toPx()), Offset(size.width, size.height - .5.dp.toPx()), 1.dp.toPx()) }
                    .padding(horizontal = 2.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        ChromeCheck(on)
                        val p = heroPainter(homeArt(r.art))
                        Box(Modifier.size(28.dp, 40.dp).clip(RoundedCornerShape(3.dp)).background(Site.Surface2)) {
                            if (p != null) Image(p, null, Modifier.size(28.dp, 40.dp), contentScale = ContentScale.Crop)
                        }
                        Text(r.name, style = cssType(14f, 400, 20f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(r.qty, style = cssType(12f, 400, 17f, Site.Muted))
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}
