package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.play.LandStyles

/**
 * The land picker (Randall 16 Nov 2026, preview https://claude.ai/artifact/Xv5a3wJ2Kqmnr2ASuwSsc6; the site's play-econ-ui.js
 * landPicker): where the card browser was, a land's styles, owned first and locked greyed. Tap one to look at it; the bar under the
 * sort says what it takes: Use, Craft for a seal, or Found in packs. Names and values only.
 */
class LandPick(
    val type: String, val sort: String, val focus: String, val limit: Int, val busy: Boolean,
    val list: List<LandStyles.Style>?, val error: Boolean, val owned: Map<String, LandStyles.Owned>, val inUse: String,
    val seals: Map<String, Int>, val config: com.google.gson.JsonObject?, val isNew: (String) -> Boolean,
    /** Mixed styles (Randall 17 Nov, preview https://claude.ai/artifact/EzrgZVY4D9Qb8Y1rPkDyQ5): copies of each style in the deck, and the
     *  deck row being restyled (held from the deck list), if any. */
    val counts: Map<String, Int> = emptyMap(), val held: LandHeld? = null,
)
/** A held deck row: its style as shown ([id]) and its copies. */
class LandHeld(val id: String, val qty: Int)
/** [use]: Set as main (only the land bar changes); [add]: one copy of a style as its own row; [restyle]: the held row to a style. */
class LandActs(val type: (String) -> Unit, val sort: (String) -> Unit, val focus: (String) -> Unit, val use: (String) -> Unit,
               val craft: (String) -> Unit, val all: () -> Unit, val more: () -> Unit, val duals: () -> Unit,
               val add: (String) -> Unit = {}, val restyle: (String) -> Unit = {}, val done: () -> Unit = {})

private fun lt(size: Float, weight: FontWeight = FontWeight.SemiBold, color: Color = Site.Text) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = (size * 1.3f).sp, color = color)
private val GoldLine = Color(0x66E5C47E)
private val Gold = Color(0xFFE5C47E)

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun LandPicker(p: LandPick, a: LandActs, tileMod: ((key: String, image: String) -> Modifier)? = null) {
    val type = p.type
    val list = remember(p.list, type, p.owned, p.sort, p.inUse) { p.list?.filter { it.type == type }?.let { LandStyles.sorted(it, p.owned, p.sort, p.inUse) } }
    val held = p.held
    val focus = list?.let { l -> l.firstOrNull { it.id == p.focus } ?: l.firstOrNull { it.id == (held?.id ?: p.inUse) } ?: l.firstOrNull() }
    val cols = GridCells.Adaptive(104.dp)
    LazyVerticalGrid(cols, Modifier.fillMaxSize().semantics { contentDescription = "$type styles" }, contentPadding = PaddingValues(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item(key = "types", span = { GridItemSpan(maxLineSpan) }) {
            // Wraps (as the web's strip does), so Duals never sits off screen on a narrow phone.
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for (t in LandStyles.TYPES) LandChip(t, t == type) { a.type(t) }
                LandChip("Duals", false, a.duals)
            }
        }
        if (list == null) {
            item(key = "wait", span = { GridItemSpan(maxLineSpan) }) {
                Text(if (p.error) "Land styles could not load. Try again in a moment." else "Loading land styles…", style = lt(13f, color = Site.Muted), modifier = Modifier.padding(vertical = 12.dp))
            }
            return@LazyVerticalGrid
        }
        item(key = "head", span = { GridItemSpan(maxLineSpan) }) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("$type styles".uppercase(), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Gold, letterSpacing = .06.sp))
                Text("${list.count { it.id in p.owned }} owned", style = lt(12f, FontWeight.Bold), modifier = Modifier.weight(1f))
                for (k in listOf("c", "u")) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp),
                    modifier = Modifier.semantics { contentDescription = "${if (k == "c") "Common" else "Uncommon"} seals ${p.seals[k] ?: 0}" }) {
                    SealMini(k, 16.dp); Text("${p.seals[k] ?: 0}", style = lt(12f, FontWeight.ExtraBold, Gold))
                }
            }
        }
        if (held != null) item(key = "held", span = { GridItemSpan(maxLineSpan) }) {
            val hs = p.list?.firstOrNull { it.id == held.id }
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x24E5C47E)).border(1.dp, Gold, RoundedCornerShape(12.dp)).padding(horizontal = 10.dp, vertical = 8.dp)
                .semantics { contentDescription = "Changing ${held.qty} $type" }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(44.dp, 32.dp).clip(RoundedCornerShape(6.dp)).background(Color(0x40000000))) {
                    heroPainter(LandStyles.image(held.id, "art_crop").let(homeArt))?.let { Image(it, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) } }
                Column(Modifier.weight(1f)) {
                    Text("Changing ${held.qty} $type", style = lt(13f, FontWeight.ExtraBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (hs != null) Text("${hs.set.uppercase()} ${hs.num}", style = lt(11.5f, FontWeight.Bold, Site.Muted), maxLines = 1)
                }
                LineBtn("Done", true, a.done)
            }
        }
        item(key = "sort", span = { GridItemSpan(maxLineSpan) }) { Box { BenchSwitch(LandStyles.SORTS, p.sort, a.sort) } }
        if (focus != null) item(key = "bar", span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x8C08090C)).border(1.dp, GoldLine, RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(focus.setName, style = lt(13f, FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        // The set and number first on the second line: what the deck row's chip says.
                        Text("${focus.set.uppercase()} ${focus.num} · ${LandStyles.KINDS[focus.kind] ?: ""} · ${focus.artist}", style = lt(11.5f, color = Site.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    when {
                        held != null && focus.id in p.owned ->
                            if (focus.id == held.id) Text("These ${held.qty}", style = lt(13f, FontWeight.ExtraBold, Gold))
                            else GoldCta("Change these ${held.qty}", enabled = !p.busy) { a.restyle(focus.id) }
                        focus.id in p.owned -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            if (focus.id == p.inUse) Text("Main", style = lt(13f, FontWeight.ExtraBold, Gold))
                            else GoldCta("Set as main", enabled = !p.busy) { a.use(focus.id) }
                            LineBtn("Add one", !p.busy) { a.add(focus.id) }
                        }
                        focus.kind == "s" -> Text("Found in packs", style = lt(12.5f, FontWeight.Bold, Site.Muted))
                        else -> { val k = LandStyles.craftSeal(focus.kind, p.config) ?: "c"
                            GoldCta("Craft", enabled = !p.busy && (p.seals[k] ?: 0) > 0, leading = { SealMini(k, 18.dp) }) { a.craft(focus.id) } }
                    }
                }
                val can = p.inUse in p.owned && !p.busy
                // Only on the main style: "this style" is then the one the button sets.
                if (held == null && focus.id == p.inUse) Box(Modifier.heightIn(min = 44.dp).alpha(if (can) 1f else .5f).clip(RoundedCornerShape(12.dp)).background(Color(0x40000000)).border(1.dp, Color(0x17FFFFFF), RoundedCornerShape(12.dp))
                    .clickable(enabled = can, onClick = a.all).semantics { role = Role.Button }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
                    Text("Use this style in all my decks", style = lt(12.5f, FontWeight.Bold))
                }
            }
        }
        val shown = list.take(p.limit)
        items(shown, key = { it.id }) { s -> Tile(s, s.id in p.owned, s.id == p.inUse, focus?.id == s.id, p.isNew(s.id), p.config, p.counts[s.id] ?: 0,
            if (s.id in p.owned) tileMod?.invoke(LandStyles.key(s.type, s.id), LandStyles.image(s.id)) else null) { a.focus(s.id) } }
        if (list.size > shown.size) item(key = "more", span = { GridItemSpan(maxLineSpan) }) { BenchPill("More", onClick = a.more) }
    }
}

@Composable
private fun LandChip(label: String, on: Boolean, onClick: () -> Unit) = Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(99.dp))
    .background(if (on) Color(0x29E5C47E) else Color(0x40000000)).border(1.dp, if (on) Gold else Color(0x17FFFFFF), RoundedCornerShape(99.dp))
    .clickable(onClick = onClick).semantics { role = Role.Tab; selected = on }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
    Text(label, style = lt(12.5f, FontWeight.Bold, if (on) Gold else Site.Muted), maxLines = 1, softWrap = false)
}

private val GREY = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })

@Composable
private fun Tile(s: LandStyles.Style, owned: Boolean, use: Boolean, focus: Boolean, fresh: Boolean, config: com.google.gson.JsonObject?, count: Int, drag: Modifier?, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    val art = heroPainter(LandStyles.image(s.id).let(homeArt))
    val status = when { use -> "Main"; owned -> "Owned"; s.kind == "s" -> "Packs only"; else -> "Craft" }
    // The tap is the clickable's; a hold lifts the style to drag into the deck (DeckBench's benchCard), after it in the chain so it sees the press first.
    Column(Modifier.clip(RoundedCornerShape(10.dp)).clickable(onClick = onClick).then(drag ?: Modifier).semantics { contentDescription = "${s.setName} ${s.type}, $status${if (count > 0) ", $count in deck" else ""}"; selected = focus },
        verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f).clip(shape).background(Brush.verticalGradient(listOf(Color(0xFF1B1F2A), Color(0xFF12151C))))
            .border(if (focus || use) 2.dp else 1.dp, if (focus) Color.White else if (use) Gold else Color(0x17FFFFFF), shape)) {
            if (art != null) Image(art, null, Modifier.fillMaxSize().alpha(if (owned) 1f else .55f), contentScale = ContentScale.Crop, colorFilter = if (owned) null else GREY)
            // The deck's count chip (DeckBench's DeckCard): dark glass, white figures; gold stays for what you press.
            if (count > 0) Text("×$count", style = lt(11f, FontWeight.ExtraBold, Color.White).copy(textAlign = TextAlign.Center), modifier = Modifier.align(Alignment.TopEnd).padding(4.dp)
                .clip(RoundedCornerShape(7.dp)).background(Color(0xE8141820)).border(1.dp, Color(0x60FFFFFF), RoundedCornerShape(7.dp)).heightIn(min = 20.dp).widthIn(min = 24.dp).padding(horizontal = 6.dp, vertical = 2.dp))
            if (fresh) Text("New", style = lt(10.5f, FontWeight.ExtraBold, Color(0xFF1A1405)), modifier = Modifier.align(Alignment.TopStart).padding(4.dp)
                .clip(RoundedCornerShape(6.dp)).background(Color(0xFFECEAE4)).padding(horizontal = 5.dp))
            Row(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xD9000000)))).padding(5.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterHorizontally)) {
                if (!owned && s.kind != "s") SealMini(LandStyles.craftSeal(s.kind, config) ?: "c", 13.dp)
                Text(status, style = lt(11f, FontWeight.ExtraBold, if (use) Gold else Color.White), maxLines = 1, softWrap = false)
            }
        }
        Text(s.setName, style = lt(11f, color = Site.Muted), maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** An outlined button in the picker (Add one, Done): gold words on glass, 44 tall. */
@Composable
private fun LineBtn(label: String, enabled: Boolean, onClick: () -> Unit) = Box(Modifier.heightIn(min = 44.dp).alpha(if (enabled) 1f else .5f).clip(RoundedCornerShape(12.dp))
    .background(Color(0x40000000)).border(1.dp, GoldLine, RoundedCornerShape(12.dp)).clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button }
    .padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
    Text(label, style = lt(13f, FontWeight.ExtraBold, Gold), maxLines = 1, softWrap = false)
}
