package dev.cardstashy.nativeplay.ui

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

private class Entry(val name: String, val qty: Int, val have: Int, val basic: Boolean, val seal: String, val rarity: String, val card: JsonObject?) {
    val missing get() = !basic && have < qty
    val image get() = img(card, "normal") ?: named(name, "normal")
    val thumb get() = img(card, "art_crop") ?: named(name, "art_crop")
    val category get() = if (basic) "Lands" else Roles.category(card)
    val roles get() = Roles.of(card).filter { it != "Land" }
}

@Composable
fun DeckView(row: Finder.Row, cardOf: (String) -> JsonObject?, onBack: () -> Unit, onUse: () -> Unit, onCard: (String) -> Unit, nav: @Composable () -> Unit) {
    // The list's own order, as the site shows it; owned counts and seals from the finder row.
    val entries = remember(row) { val chips = row.groups.flatMap { it.cards }.associateBy { it.name }
        row.list.cards.map { it.name }.distinct().mapNotNull { chips[it] }.ifEmpty { chips.values.toList() }
            .map { Entry(it.name, it.qty, it.have, it.basic, it.seal, it.rarity, cardOf(it.name)) } }
    val main = entries.sumOf { it.qty }
    val mode = DeckViewPref.mode
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val wide = maxWidth >= 600.dp
        val inner = maxWidth - 32.dp
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item { Column(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { Hero(row, main, wide, onBack) } }
            item { GoldCta(if (row.complete) "Use deck" else "Build it", if (wide) Modifier.widthIn(min = 220.dp) else Modifier.fillMaxWidth(), onClick = onUse) }
            item { Toolbar(mode) { DeckViewPref.mode = it } }
            when (mode) {
                "stacks" -> {
                    item { RoleSummary(entries) }
                    item { Stacks(entries, inner, wide, onCard) }
                }
                "gallery" -> {
                    val cols = maxOf(2, (inner / (if (wide) 190.dp else 150.dp)).toInt())
                    items(entries.chunked(cols)) { line ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            line.forEach { e -> GalleryCard(e, Modifier.weight(1f)) { onCard(e.name) } }
                            repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
                "symbols" -> items(entries) { e -> NameRow(e) { onCard(e.name) } }
                else -> items(entries) { e -> DetailRow(e) { onCard(e.name) } }
            }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
}

/** deckShell: hero art, shade, back, badge + format, title, event line, the quiet facts, the owned bar. */
@Composable
private fun Hero(row: Finder.Row, main: Int, wide: Boolean, onBack: () -> Unit) {
    val p = heroPainter(row.cover.ifBlank { DECKS_ART }.let(homeArt))
    Box(Modifier.fillMaxWidth().heightIn(min = if (wide) 330.dp else 300.dp).softTile(26.dp)) {
        if (p != null) Image(p, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x40000000), .3f to Color(0x0A000000), .62f to Color(0xC008090C), 1f to Color(0xF508090C))))
        Box(Modifier.padding(16.dp).size(48.dp).softPill(RoundedCornerShape(14.dp)).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
            Icon(SiteIcons.Back, 22.dp, Color(0xFFF6EEDB)) }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 84.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HeroChip(if (row.source == "Meta" || row.source.isEmpty()) "Meta" else row.source)
                HeroChip("Magic · ${row.format}")
            }
            Text(row.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = if (wide) 32.sp else 26.sp, lineHeight = if (wide) 36.sp else 30.sp, color = Color(0xFFF6EEDB)),
                maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (row.detail.isNotEmpty()) Text(row.detail, style = t(14f, color = Color(0xFFC4C9D2)))
            Spacer(Modifier.height(4.dp))
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                Fact("$main", "main")
                Fact("${row.cardsHave}/${row.size}", "owned")
                // Collection says "$580 to finish"; Play says what the seals cost.
                if (row.complete) Fact("✓", "in your Trunk", Ok) else Status(row.status, row.shortfall.seals, row.short, row.open)
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
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (set != null) Tag(if (cn != null) "$set · #$cn" else set, Site.Gold, Color(0x1FE8B95B))
                if (!e.basic && e.rarity.isNotEmpty()) Tag(e.rarity.replaceFirstChar { it.uppercase() }, Color(0xFFC4C9D2), Color(0x14FFFFFF))
                e.roles.forEach { Tag(it.lowercase(), Ok, Color(0x1F8FD19E)) }
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(if (e.basic) "${e.qty}" else "${e.have}/${e.qty}", style = t(16f, FontWeight.ExtraBold, if (e.missing) Site.Muted else Color.White))
            if (e.missing) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { SealMini(e.seal, 18.dp); Text("${e.qty - e.have}", style = t(13f, FontWeight.ExtraBold, Site.Gold)) }
            else Text("owned", style = t(12f, color = Site.Muted))
        }
    }
}

@Composable
private fun Tag(label: String, ink: Color, fill: Color) = Text(label, style = t(12.5f, FontWeight.Bold, ink),
    modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(fill).padding(horizontal = 8.dp, vertical = 3.dp))
