package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.Finder
import dev.cardstashy.nativeplay.play.Roles

/**
 * The app's one deck view (deck-viewer.js deckShell + deckViewer), married to Play: the same art hero,
 * badge and format chips, Cinzel title, event line and owned bar, the same Stacks / Art grid / Names only /
 * Detailed list switch. Where Collection shows prices, Play shows what you own and the seals to craft the rest.
 */
object DeckViewPref { var mode by mutableStateOf("gallery") }  // deckViewFor: Art grid by default

private val Ink = Site.Text
private val Warn = Color(0xFFFFB86B)
private val Ok = Color(0xFF8FD19E)
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
private fun named(name: String, version: String) = "https://api.scryfall.com/cards/named?format=image&version=$version&exact=" + java.net.URLEncoder.encode(name, "UTF-8").replace("+", "%20")
private fun img(c: JsonObject?, k: String) = c?.getAsJsonObject("image_uris")?.get(k)?.asString ?: c?.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")?.get(k)?.asString

private class Entry(val name: String, val qty: Int, val have: Int, val basic: Boolean, val seal: String, val rarity: String, val card: JsonObject?, val cat: String) {
    val missing get() = !basic && have < qty
    val image get() = img(card, "normal") ?: named(name, "normal")
    val thumb get() = img(card, "art_crop") ?: named(name, "art_crop")
    val category get() = cat
    val roles get() = Roles.of(card).filter { it != "Land" }
    val cmc get() = card?.get("cmc")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 99.0
}

/** One deckShell action: the first is the gold one. */
class DeckAction(val label: String, val enabled: Boolean = true, val onClick: () -> Unit)

/**
 * finderDeckMarkup (web finder, PR #105): deckShell with the archetype's name, Meta or Deck Forge, the format,
 * owned and the seals it costs, the state pill, Build it / Craft all / Copy list, pack goals, then the deck viewer
 * over type groups (Commander first), each sorted by mana value then name.
 */
@Composable
fun DeckView(row: Finder.Row, title: String, cardOf: (String) -> JsonObject?, onBack: () -> Unit, actions: List<DeckAction>, onCard: (String) -> Unit,
             goals: @Composable () -> Unit = {}, nav: @Composable () -> Unit) {
    val lead = row.list.commander
    val groups = remember(row) {
        val all = row.groups.flatMap { it.cards }.map { c -> val card = cardOf(c.name)
            Entry(c.name, c.qty, c.have, c.basic, c.seal, c.rarity, card, if (lead.isNotEmpty() && c.name == lead) "Commander" else if (c.basic) "Lands" else Roles.category(card)) }
        all.groupBy { it.cat }.toList().sortedBy { Roles.ORDER.indexOf(it.first).let { i -> if (i < 0) 99 else i } }
            .map { (g, l) -> g to l.sortedWith(compareBy<Entry> { it.cmc }.thenBy { it.name }) }
    }
    val entries = remember(groups) { groups.flatMap { it.second } }
    val mode = DeckViewPref.mode
    val sub = listOf(if (title != row.name) row.name else "", if (row.source == "Meta") "" else row.source, row.detail).filter { it.isNotEmpty() }.joinToString(" · ")
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val wide = maxWidth >= 600.dp
        val inner = maxWidth - 32.dp
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item { Column(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { Hero(row, title, sub, wide, onBack) } }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    // The hero already lists the seals; the pill only names the state.
                    StatePill(row.status, row.open)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        actions.forEachIndexed { i, a -> if (i == 0) GoldCta(a.label, Modifier.widthIn(min = if (wide) 200.dp else 150.dp), enabled = a.enabled, onClick = a.onClick)
                            else GhostButton(a.label, enabled = a.enabled, onClick = a.onClick) }
                    }
                }
            }
            item { goals() }
            item { Toolbar(mode) { DeckViewPref.mode = it } }
            when (mode) {
                "stacks" -> {
                    item { RoleSummary(entries) }
                    item { Stacks(entries, inner, wide, onCard) }
                }
                else -> groups.forEach { (g, list) ->
                    item(key = "h-$g") { GroupHead(g, list.sumOf { it.qty }) }
                    when (mode) {
                        "gallery" -> {
                            val cols = maxOf(2, (inner / (if (wide) 190.dp else 150.dp)).toInt())
                            itemsIndexed(list.chunked(cols), key = { i, l -> "g-$g-$i-" + l.first().name }) { _, line ->
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    line.forEach { e -> GalleryCard(e, Modifier.weight(1f)) { onCard(e.name) } }
                                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                                }
                            }
                        }
                        "symbols" -> itemsIndexed(list, key = { i, e -> "s-$g-$i-" + e.name }) { _, e -> NameRow(e) { onCard(e.name) } }
                        else -> itemsIndexed(list, key = { i, e -> "d-$g-$i-" + e.name }) { _, e -> DetailRow(e) { onCard(e.name) } }
                    }
                }
            }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
}

@Composable
private fun GroupHead(label: String, n: Int) = Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
    Text(label, style = t(16f, FontWeight.ExtraBold))
    Text("$n", style = t(12.5f, FontWeight.Bold, Site.Muted), modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Site.Surface2).padding(horizontal = 8.dp, vertical = 2.dp))
}

/** statusMarkup without costs: Buildable ✓, Craftable, or N slots to fill. */
@Composable
private fun StatePill(status: String, slots: Int) {
    val shape = RoundedCornerShape(16.dp)
    when (status) {
        "buildable" -> Text("✓ Buildable", style = t(14f, FontWeight.Bold, Ok), modifier = Modifier.clip(shape).background(Color(0x1F8FD19E)).border(1.dp, Color(0x598FD19E), shape).padding(horizontal = 12.dp, vertical = 6.dp))
        "craftable" -> Text("Craftable", style = t(14f, FontWeight.Bold, Site.Gold), modifier = Modifier.clip(shape).background(Color(0x1FE8B95B)).border(1.dp, Color(0x59E8B95B), shape).padding(horizontal = 12.dp, vertical = 6.dp))
        "open" -> Text("$slots slot${if (slots == 1) "" else "s"} to fill", style = t(13.5f, FontWeight.Bold), modifier = Modifier.softPill(shape).padding(horizontal = 12.dp, vertical = 6.dp))
        else -> {}
    }
}

/** deckShell: hero art, shade, back, badge + format, title, event line, the quiet facts, the owned bar. */
@Composable
private fun Hero(row: Finder.Row, title: String, sub: String, wide: Boolean, onBack: () -> Unit) {
    val p = heroPainter(row.cover.ifBlank { DECKS_ART }.let(homeArt))
    Box(Modifier.fillMaxWidth().heightIn(min = if (wide) 330.dp else 300.dp).softTile(26.dp)) {
        if (p != null) Image(p, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x40000000), .3f to Color(0x0A000000), .62f to Color(0xC008090C), 1f to Color(0xF508090C))))
        Box(Modifier.padding(16.dp).size(48.dp).softPill(RoundedCornerShape(14.dp)).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
            Icon(SiteIcons.Back, 22.dp, Color(0xFFF6EEDB)) }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 84.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HeroChip(if (row.list.trunk) "Deck Forge" else "Meta")
                HeroChip(row.format)
            }
            Text(title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = if (wide) 32.sp else 26.sp, lineHeight = if (wide) 36.sp else 30.sp, color = Color(0xFFF6EEDB)),
                maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (sub.isNotEmpty()) Text(sub, style = t(14f, color = Color(0xFFC4C9D2)))
            Spacer(Modifier.height(4.dp))
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                Fact("${row.cardsHave}/${row.size}", "owned")
                // Collection says "$580 to finish"; Play says what the seals cost, one stat per rarity.
                for ((k, label) in listOf("c" to "Common", "u" to "Uncommon", "r" to "Rare", "m" to "Mythic")) { val n = row.shortfall.seals[k] ?: 0; if (n == 0) continue
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        SealMini(k, 20.dp); Text("$n", style = t(18f, FontWeight.ExtraBold, if ((row.short[k] ?: 0) > 0) Warn else Color.White))
                        Text("$label seal${if (n > 1) "s" else ""}", style = t(13f, color = Color(0xFFC4C9D2))) } }
            }
        }
        Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(3.dp).background(Color(0x14FFFFFF))) {
            Box(Modifier.fillMaxHeight().fillMaxWidth(row.share.toFloat().coerceIn(0f, 1f)).background(goldButtonBrush(true))) }
    }
}

@Composable
private fun HeroChip(label: String) = Text(label, style = t(13f, FontWeight.Bold, Color(0xFFF2F3F5)),
    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0xB30B0D11)).border(1.dp, Color(0x29FFFFFF), RoundedCornerShape(999.dp)).padding(horizontal = 12.dp, vertical = 5.dp))

@Composable
private fun Fact(value: String, label: String, tint: Color = Color.White) = Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
    Text(value, style = t(18f, FontWeight.ExtraBold, tint)); Text(label, style = t(13f, color = Color(0xFFC4C9D2)))
}

/** deckViewControl: "Deck view" and the four-way switch. */
@Composable
private fun Toolbar(mode: String, pick: (String) -> Unit) = Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    Text("Deck view", style = t(14f, color = Site.Muted), modifier = Modifier.weight(1f))
    Row(Modifier.softPill(RoundedCornerShape(16.dp)).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        for ((k, icon) in listOf("stacks" to SiteIcons.ViewStacks, "gallery" to SiteIcons.ViewGallery, "symbols" to SiteIcons.ViewSymbols, "compact" to SiteIcons.ViewCompact)) {
            val on = k == mode
            Box(Modifier.size(width = 52.dp, height = 44.dp).clip(RoundedCornerShape(12.dp)).background(if (on) Color(0x33E8B95B) else Color.Transparent)
                .border(1.dp, if (on) Color(0x80E8B95B) else Color.Transparent, RoundedCornerShape(12.dp)).clickable { pick(k) }, contentAlignment = Alignment.Center) {
                Icon(icon, 22.dp, if (on) Site.Gold else Color(0xFFC4C9D2))
            }
        }
    }
}

/** stackSummary: role counts over the main deck. */
@Composable
private fun RoleSummary(entries: List<Entry>) {
    val counts = LinkedHashMap<String, Int>()
    for (e in entries) for (r in e.roles) counts[r] = (counts[r] ?: 0) + e.qty
    if (counts.isEmpty()) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        counts.forEach { (r, n) -> Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) { Text(r, style = t(13f, color = Site.Muted)); Text("$n", style = t(13f, FontWeight.ExtraBold)) } }
    }
}

/** stackList: type groups in GROUP_ORDER, piles of six fanned by a fixed step, groups side by side when they fit. */
@Composable
private fun Stacks(entries: List<Entry>, inner: Dp, wide: Boolean, onCard: (String) -> Unit) {
    val groups = entries.groupBy { it.category }.toList().sortedBy { Roles.ORDER.indexOf(it.first).let { i -> if (i < 0) 99 else i } }
    val pileW = if (wide) 190.dp else ((inner - 12.dp) / 2).coerceAtMost(170.dp)
    val step = if (wide) 38.dp else 32.dp
    FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        for ((cat, list) in groups) Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                Text(cat, style = t(16f, FontWeight.ExtraBold))
                Text("${list.sumOf { it.qty }}", style = t(12.5f, FontWeight.Bold, Site.Muted), modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Site.Surface2).padding(horizontal = 8.dp, vertical = 2.dp))
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                list.chunked(6).forEach { pile ->
                    val cardH = pileW * (88f / 63f)
                    Box(Modifier.width(pileW).height(cardH + step * (pile.size - 1))) {
                        pile.forEachIndexed { i, e -> CardTile(e, Modifier.offset(y = step * i).width(pileW), showRoles = i == pile.lastIndex) { onCard(e.name) } }
                    }
                }
            }
        }
    }
}

/** A full card: the printing's image, qty badge top right; a missing card greyed with the seal that crafts it. */
@Composable
private fun CardTile(e: Entry, modifier: Modifier, showRoles: Boolean = false, onClick: () -> Unit) {
    val p = heroPainter(e.image.let(homeArt))
    Box(modifier.aspectRatio(63f / 88f).clip(RoundedCornerShape(11.dp)).background(Color(0xFF111318)).clickable(onClick = onClick)) {
        if (p != null) Image(p, e.name, Modifier.fillMaxSize().alpha(if (e.missing) .45f else 1f), contentScale = ContentScale.Crop)
        else Text(e.name, style = t(13f, FontWeight.Bold), modifier = Modifier.padding(10.dp))
        Text("${e.qty}×", style = t(13f, FontWeight.ExtraBold), modifier = Modifier.align(Alignment.TopEnd).padding(6.dp)
            .clip(RoundedCornerShape(10.dp)).background(Color(0xD90B0D11)).border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 2.dp))
        if (e.missing) Row(Modifier.align(Alignment.BottomStart).padding(6.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xE60B0D11)).padding(horizontal = 6.dp, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            SealMini(e.seal, 16.dp); Text("${e.qty - e.have}", style = t(12.5f, FontWeight.ExtraBold))
        }
        else if (showRoles && e.roles.isNotEmpty()) Text(e.roles.joinToString(" · "), style = t(10.5f, FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.BottomStart).padding(6.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xE8141820)).border(1.dp, Color(0x35FFFFFF), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 3.dp))
    }
}

@Composable
private fun GalleryCard(e: Entry, modifier: Modifier, onClick: () -> Unit) = Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
    CardTile(e, Modifier.fillMaxWidth(), onClick = onClick)
    Text("${e.qty}× ${e.name}", style = t(14f, FontWeight.Bold), maxLines = 2, overflow = TextOverflow.Ellipsis)
}

@Composable
private fun NameRow(e: Entry, onClick: () -> Unit) = Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x0AFFFFFF))
    .border(1.dp, SoftRim, RoundedCornerShape(14.dp)).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
    Text("${e.qty}× ${e.name}", style = t(15f, FontWeight.Bold, if (e.missing) Site.Muted else Ink), modifier = Modifier.weight(1f))
    if (e.missing) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { SealMini(e.seal, 18.dp); Text("${e.qty - e.have}", style = t(14f, FontWeight.ExtraBold, Site.Gold)) }
}

/** Detailed list: the card, set · number and rarity, its roles, and owned or the seals in place of a price. */
@Composable
private fun DetailRow(e: Entry, onClick: () -> Unit) {
    val set = e.card?.get("set")?.asString?.uppercase(); val cn = e.card?.get("collector_number")?.asString
    Row(Modifier.fillMaxWidth().softTile(18.dp).clickable(onClick = onClick).padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        CardTile(e, Modifier.width(78.dp), onClick = onClick)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("${e.qty}× ${e.name}", style = t(16f, FontWeight.Bold))
            if (!e.basic) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                if (!e.missing) Text("In your Trunk", style = t(13f, FontWeight.SemiBold, Ok))
                else { if (e.have > 0) Text("${e.have}/${e.qty} ·", style = t(13f, FontWeight.SemiBold, Site.Muted)); SealMini(e.seal, 16.dp); Text("${e.qty - e.have} to craft", style = t(13f, FontWeight.SemiBold, Site.Gold)) }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (set != null) Tag(if (cn != null) "$set · #$cn" else set, Site.Gold, Color(0x1FE8B95B))
                if (!e.basic && e.rarity.isNotEmpty()) Tag(e.rarity.replaceFirstChar { it.uppercase() }, Color(0xFFC4C9D2), Color(0x14FFFFFF))
                e.roles.forEach { Tag(it.lowercase(), Ok, Color(0x1F8FD19E)) }
            }
        }
    }
}

@Composable
private fun Tag(label: String, ink: Color, fill: Color) = Text(label, style = t(12.5f, FontWeight.Bold, ink),
    modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(fill).padding(horizontal = 8.dp, vertical = 3.dp))
