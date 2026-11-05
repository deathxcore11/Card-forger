package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.ui.BiasAlignment
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject

// ---------------------------------------------------------------- the model (CollectionEngine.decks, views.js decks() → My decks)

/** A site button as the engine read it: its words, its data-act, ghost or gold, War Chest's own gold outline, its icon. */
class SiteButton(val label: String, val act: String, val ghost: Boolean, val chest: Boolean, val aria: String, val icon: SiteSvg?)

/** views.js deckTile. */
class DeckTileModel(val id: String, val to: String, val cover: String?, val tier: String, val tierColor: String, val format: String, val formatIcon: SiteSvg?,
                    val boxColor: String, val boxCards: List<String>, val dots: List<Pair<String, String>>, val name: String, val line: String,
                    val power: String, val powerLabel: String, val powerLevel: String, val powerTitle: String,
                    val owned: String, val ownedText: String, val find: String, val findText: String, val bar: Float,
                    /** tcg.js deckTile (Yu-Gi-Oh!, Pokémon): the cover's fallbacks and "pokemon" for a card's art window (.pk-crop), the
                     *  legality chip (its words and ok / warn / bad), and every stat as the tile words it (owned, value, to finish). */
                    val sources: List<String> = emptyList(), val crop: String = "", val check: Pair<String, String>? = null,
                    val stats: List<Pair<String, String>> = emptyList())

class CollectionDecksModel(val game: CardGame, val title: String, val actions: List<SiteButton>, val tabs: List<CollTab>, val tools: List<SiteButton>,
                           val searchValue: String?, val searchPlaceholder: String, val tiles: List<DeckTileModel>, val none: String,
                           val emptyTitle: String?, val emptyText: String, val emptyActions: List<SiteButton>) {
    companion object {
        private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
        private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
        private fun button(j: JsonObject) = SiteButton(j.s("label"), j.s("act"), j.b("ghost"), j.b("chest"), j.s("aria"), CollectionCardsModel.svg(j.o("icon")))

        fun parse(j: JsonObject): CollectionDecksModel {
            val e = j.o("empty"); val search = j.o("search")
            return CollectionDecksModel(CardGame.of(j.s("game")), j.s("title"), j.objs("actions").map(::button),
                j.objs("tabs").map { CollTab(it.s("key"), it.s("label"), it.b("on"), CollectionCardsModel.svg(it.o("icon"))) }, j.objs("tools").map(::button),
                search?.s("value"), search?.s("placeholder") ?: "",
                j.objs("tiles").map { t ->
                    val f = t.o("format"); val box = t.o("box"); val p = t.o("power")
                    DeckTileModel(t.s("id"), t.s("to"), t.o("cover")?.s("src")?.ifBlank { null } ?: t.s("art").ifBlank { null }, t.s("tier"), t.s("tierColor"), f?.s("name") ?: "", CollectionCardsModel.svg(f?.o("icon")),
                        box?.s("color") ?: "", box?.get("cards")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }.orEmpty(),
                        t.objs("dots").map { it.s("src") to it.s("alt") }, t.s("name"), t.s("line"),
                        p?.s("value") ?: "", p?.s("label") ?: "", p?.s("level") ?: "mid", p?.s("title") ?: "",
                        t.s("owned"), t.s("ownedText"), t.s("find"), t.s("findText"), t.get("bar")?.takeIf { it.isJsonPrimitive }?.asFloat ?: 0f,
                        t.get("sources")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }.orEmpty(), t.s("crop"),
                        t.o("check")?.let { it.s("text") to it.s("tone") }, t.objs("stats").map { it.s("value") to it.s("label") })
                }, j.s("none"), e?.s("title"), e?.s("text") ?: "", e?.objs("actions")?.map(::button).orEmpty())
        }
    }
}

/** What the Decks page's controls do. Search is the engine's own (I.shelfSearch); the rest open the website's page for now. */
class CollectionDecksActions(
    val game: (CardGame) -> Unit = {},
    /** A head, random-tools or empty-state button: data-act warChest, importDeck, newDeck, randomDeck, randomDeckOptions. */
    val button: (String) -> Unit = {},
    /** seg data-act="decksTab": Ideas and Meta decks. */
    val tab: (String) -> Unit = {},
    val search: (String) -> Unit = {},
    /** A deck tile: data-act="go" data-to="#deck/<id>". */
    val deck: (DeckTileModel) -> Unit = {},
)

// ---------------------------------------------------------------- site colours (style.css tokens as the live page computes them)

private val GlassLine = Color(0x31EDC980)
private val GlassFill = Color(0x851F232B)
private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val LineC = Color(0xFF2A2F39)
private val Surface2 = Color(0xFF1F232B)
private val ChestInk = Color(0xFFE8CE87)

private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color)

// ---------------------------------------------------------------- the page

@Composable
fun CollectionDecks(m: CollectionDecksModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionDecksActions = CollectionDecksActions(),
                    nav: @Composable (vertical: Boolean) -> Unit = {}, query: String = m.searchValue ?: "") {
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val screen = maxWidth
        if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); DecksPage(m, top, act, Modifier.weight(1f).fillMaxHeight(), screen, query) }
        else Column(Modifier.fillMaxSize()) { DecksPage(m, top, act, Modifier.weight(1f).fillMaxWidth(), screen, query); nav(false) }
    }
}

@Composable
private fun DecksPage(m: CollectionDecksModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionDecksActions, modifier: Modifier, screen: Dp, query: String) {
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    // .deck-grid: one column, two from 640, three from 1000; 12 apart.
    val cols = if (screen >= 1000.dp) 3 else if (screen >= 640.dp) 2 else 1
    LazyColumn(modifier, contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(key = "top") {
            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                top(if (wide) ({ GameTabs(m.game, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
            }
        }
        item(key = "head") {
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 16.dp else 10.dp)) {
                if (!wide) GameTabs(m.game, act.game, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                Head(m, act, wide)
                if (m.tabs.isNotEmpty()) Box(Modifier.padding(top = 12.dp)) { CollTabs(m.tabs, act.tab) }
                if (m.tools.isNotEmpty()) RandomTools(m.tools, act, wide)
                m.searchValue?.let { DeckSearch(query, m.searchPlaceholder, act.search) }
            }
        }
        if (m.emptyTitle != null) item(key = "empty") { DecksEmpty(m, act, gutter) }
        else if (m.tiles.isEmpty()) item(key = "none") {
            Text(m.none.ifBlank { "No decks match." }, Modifier.fillMaxWidth().padding(horizontal = gutter).padding(vertical = 8.dp), style = sans(15f, color = Mute))
        }
        else items(m.tiles.chunked(cols), key = { line -> line.joinToString("|") { it.id } }) { line ->
            Row(Modifier.padding(horizontal = gutter).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                for (d in line) DeckTile(d, wide, Modifier.weight(1f).fillMaxHeight()) { act.deck(d) }
                repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

// ---------------------------------------------------------------- Decks, War Chest, Import, New

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Head(m: CollectionDecksModel, act: CollectionDecksActions, wide: Boolean) {
    val title = @Composable { mod: Modifier ->
        Text(m.title, mod, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 29.9.sp, letterSpacing = .52.sp, color = Ink))
    }
    val actions = @Composable { Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { m.actions.forEach { HeadButton(it, wide) { act.button(it.act) } } } }
    // .page-head: a phone stacks the title over its buttons (12 apart); from 600 dp they share one line.
    if (wide) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { title(Modifier.weight(1f)); actions() }
    else Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { title(Modifier); if (m.actions.isNotEmpty()) actions() }
}

/** .head-actions .btn: glass ghosts (War Chest in its own gold outline) and the gold Import plate in Cinzel. */
@Composable
private fun HeadButton(b: SiteButton, wide: Boolean, onClick: () -> Unit) {
    if (!b.ghost) {
        // linear-gradient(#f8e2a8, #e9bf6c 44%, #c08a3a 56%, #ddb064); inset 0 1px #fff6d6, inset 0 -2px #8a5c1f66, ring 1px #5a3b12, glow 0 10 26 #c99a4b3d.
        val shape = RoundedCornerShape(10.dp)
        Row(Modifier.heightIn(min = 44.dp)
            .drawBehind { drawRoundRect(Color(0x3DC99A4B), topLeft = Offset(0f, 10.dp.toPx() * .5f), size = size, cornerRadius = CornerRadius(14.dp.toPx())) }
            .clip(shape).background(Brush.verticalGradient(0f to Color(0xFFF8E2A8), .44f to Color(0xFFE9BF6C), .56f to Color(0xFFC08A3A), 1f to Color(0xFFDDB064)))
            .drawWithContent {
                drawContent()
                drawRect(Color(0xFFFFF6D6), size = Size(size.width, 1.dp.toPx()))
                drawRect(Color(0x668A5C1F), topLeft = Offset(0f, size.height - 2.dp.toPx()), size = Size(size.width, 2.dp.toPx()))
                drawRoundRect(Color(0xFF5A3B12), cornerRadius = CornerRadius(10.dp.toPx()), style = Stroke(1.dp.toPx()))
            }
            .clickable(onClick = onClick).semantics { role = Role.Button }.padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            SiteIcon(b.icon, 16.2.dp, Color(0xFF2A1906), stroke = 2f)
            Text(b.label, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, lineHeight = 13.5.sp, letterSpacing = 1.35.sp,
                color = Color(0xFF2A1906), shadow = Shadow(Color(0x99FBE9BD), Offset(0f, 1f), 0f)))
        }
        return
    }
    val ink = if (b.chest) ChestInk else Ink
    val shape = RoundedCornerShape(11.dp)
    Row(Modifier.heightIn(min = 44.dp).clip(shape).background(GlassFill).border(1.dp, if (b.chest) Color(0x8CE8CE87) else GlassLine, shape)
        .clickable(onClick = onClick).semantics { role = Role.Button }.padding(horizontal = 12.dp, vertical = 8.dp),
        // .wc-open svg { margin-right: 6px } on top of the button's 6 gap.
        horizontalArrangement = Arrangement.spacedBy(if (b.chest) 12.dp else 6.dp), verticalAlignment = Alignment.CenterVertically) {
        SiteIcon(b.icon, if (b.chest) 18.dp else 16.dp, ink, stroke = if (b.chest) null else 2f)
        Text(b.label, style = sans(if (wide) 13.5f else 12f, 700, ink, lh = 1.35f))
    }
}

/** .random-tools: 🎲 Random Commander, 🎲 Random deck; 34 tall glass, sharing a phone's width, 16 above and below. */
@Composable
private fun RandomTools(tools: List<SiteButton>, act: CollectionDecksActions, wide: Boolean) {
    Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        for (b in tools) {
            val shape = RoundedCornerShape(11.dp)
            Row(Modifier.then(if (wide) Modifier else Modifier.weight(1f)).height(34.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape)
                .clickable { act.button(b.act) }.semantics { contentDescription = b.aria.ifBlank { b.label }; role = Role.Button }.padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                SiteIcon(b.icon, 18.dp, Ink)
                Text(b.label, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(if (wide) 13.5f else 12f, 700, Ink))
            }
        }
    }
}

/** .toolbar input: Search decks…, shown once there are more than four. */
@Composable
private fun DeckSearch(value: String, placeholder: String, onChange: (String) -> Unit) {
    val shape = RoundedCornerShape(11.dp)
    BasicTextField(value, onChange, Modifier.padding(top = 12.dp).fillMaxWidth().heightIn(min = 44.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape),
        singleLine = true, textStyle = sans(15f, 400, Ink), cursorBrush = SolidColor(Color(0xFFE8B95B)), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        decorationBox = { inner ->
            Box(Modifier.padding(horizontal = 12.dp, vertical = 9.dp), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) Text(placeholder, style = sans(15f, 400, Mute), maxLines = 1)
                inner()
            }
        })
}

// ---------------------------------------------------------------- the deck tile (views.js deckTile)

/**
 * .deck-tile: 260 tall, 16 corners on the surface-2 plate; the cover art fills it under the shade, ringed in its price tier
 * (ui.js tierRing: 2 px inside the edge). On top: the deck box and format chip, colour identity at the
 * right; at the foot the Cinzel name, its size line, power, owned share, what is left to find, and the owned bar.
 */
@Composable
private fun DeckTile(d: DeckTileModel, wide: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val tier = cssColor(d.tierColor, Color.Transparent)?.takeIf { d.tier.isNotBlank() && d.tier != "tn" }?.let { if (d.tier == "t0") Color(0xFF8B939C) else it }
    // (The img's own tier glow sits outside it, so the tile's overflow: hidden clips it away; only the outline shows.)
    Box(modifier.heightIn(min = 260.dp)
        .clip(shape).background(Surface2).border(1.dp, LineC, shape).clickable(onClick = onClick).semantics { contentDescription = d.name; role = Role.Button }) {
        // .tile-art img (cover, centred) and its tier outline (2 px, offset -2, 6 corners; the tile's own corners clip it).
        Box(Modifier.matchParentSize().padding(1.dp)) {
            // A Yu-Gi-Oh! or Pokémon cover walks its fallbacks (ygoCropArt, pokemonArtCrop); a Pokémon card shows its art window.
            val raw = if (d.sources.size > 1) firstOf(d.sources) else heroPainter(d.cover?.let(homeArt))
            val p = if (d.crop == "pokemon" && raw != null) remember(raw) { PkArtCrop(raw) } else raw
            // .tcg-tile .tile-card-art.cropped (Yu-Gi-Oh!'s cropped art): no zoom, 50 % 35 %.
            if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
                alignment = if (d.sources.isNotEmpty() && d.crop != "pokemon") BiasAlignment(0f, -.3f) else Alignment.Center)
            if (tier != null) Box(Modifier.matchParentSize().drawBehind {
                val w = 2.dp.toPx()
                drawRoundRect(tier, topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w), cornerRadius = CornerRadius(6.dp.toPx()), style = Stroke(w))
            })
            // .tile-shade: transparent to 28 %, rgba(7,8,11,.85) at 78 %, .96 at the foot.
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Transparent, .28f to Color.Transparent, .78f to Color(0xD907080B), 1f to Color(0xF507080B))))
        }
        Column(Modifier.matchParentSize().padding(start = 13.dp, end = 13.dp, top = 17.dp, bottom = 13.dp), verticalArrangement = Arrangement.SpaceBetween) {
            // .tile-top: 66 tall at least; the deck box (10 down) then the format chip, 12 apart; the colour dots at the right.
            Row(Modifier.fillMaxWidth().heightIn(min = 66.dp)) {
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    SiteDeckBox(d.boxCards, d.boxColor, wide, Modifier.padding(top = 10.dp))
                    FormatChip(d.format, d.formatIcon)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) { d.dots.forEach { (src, alt) -> Dot(src, alt) } }
                // tcg.js: the deck check's chip (dark glass; ok-chip mint, bad-chip coral, warn amber).
                d.check?.let { (words, tone) -> FormatChip(words, null, when (tone) { "ok" -> Color(0xFFA6F0C4); "bad" -> Color(0xFFFFB3A8); "warn" -> Color(0xFFFFD98A); else -> Color.White }) }
            }
            TileBody(d)
        }
    }
}

/** .chip.dark.deck-format-emblem: the format's emblem (crown, shield or star) and name on black glass. */
@Composable
private fun FormatChip(name: String, icon: SiteSvg?, ink: Color = Color.White) {
    if (name.isBlank()) return
    Row(Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0x8C000000)).border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(999.dp))
        .padding(start = 8.dp, end = 9.dp, top = 3.dp, bottom = 3.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        // .format-emblem: 14 px, filled gold (crown) as the site paints it.
        SiteIcon(icon, 14.dp, Color(0xFFE8B95B), filled = true)
        Text(name, maxLines = 1, style = sans(12f, 700, ink, lh = 1.45f))
    }
}

@Composable
private fun Dot(src: String, alt: String) {
    val p = heroPainter(src.takeIf { it.isNotBlank() }?.let(homeArt))
    // .dots img: 18 round, a -1 1 0 rgba(0,0,0,.55) drop.
    Box(Modifier.size(18.dp).drawBehind { drawCircle(Color.Black.copy(alpha = .55f), size.minDimension / 2, center + Offset(-1.dp.toPx(), 1.dp.toPx())) }.semantics { contentDescription = alt }) {
        if (p != null) Image(p, null, Modifier.fillMaxSize().clip(RoundedCornerShape(50))) else Box(Modifier.fillMaxSize().clip(RoundedCornerShape(50)).background(Color(0xFFCAC5C0)))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TileBody(d: DeckTileModel) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(d.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 21.sp, lineHeight = 24.15.sp, letterSpacing = .21.sp, color = Color.White,
            shadow = Shadow(Color(0xAA000000), Offset(0f, 2f), 10f)))
        if (d.line.isNotBlank()) Text(d.line, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(12.5f, 400, Color(0xFFD5D9E0), lh = 1.45f))
        // .tile-stats: 4 below, 10 apart, the find count pushed to the right.
        val power = @Composable {
            if (d.power.isNotBlank()) Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.semantics { contentDescription = d.powerTitle }) {
                val (bg, ink) = when (d.powerLevel) { "hi" -> Color(0x406FD29A) to Color(0xFFA6F0C4); "lo" -> Color(0x40F08A7E) to Color(0xFFFFB3A8); else -> Color(0x40E8B95B) to Color(0xFFFFD98A) }
                Text(d.power, Modifier.clip(RoundedCornerShape(6.dp)).background(bg).padding(horizontal = 6.dp), style = sans(13f, 800, ink, lh = 1.45f))
                if (d.powerLabel.isNotBlank()) Text(d.powerLabel, style = sans(11.5f, 400, Color(0xFFC4C9D2)))
            }
        }
        // tcg.js's tile words every stat (owned, value, to finish) after the power chip; .tile-stats wraps them, 10 apart.
        if (d.stats.isNotEmpty()) FlowRow(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp),
            itemVerticalAlignment = Alignment.CenterVertically) {
            power(); d.stats.forEach { (v, l) -> Stat(v, l) }
        }
        else Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            power()
            if (d.owned.isNotBlank()) Stat(d.owned, d.ownedText)
            Spacer(Modifier.weight(1f))
            if (d.find.isNotBlank()) Stat(d.find, d.findText) else if (d.findText.isNotBlank()) Text(d.findText, style = sans(11.5f, 400, Color(0xFFC4C9D2)))
        }
        // .bar.thin: 4 tall on surface-2, 6 below the stats, the owned share in a gold run.
        Box(Modifier.padding(top = 6.dp).fillMaxWidth().height(4.dp).clip(RoundedCornerShape(99.dp)).background(Surface2)) {
            Box(Modifier.fillMaxWidth(d.bar.coerceIn(0f, 1f)).fillMaxHeight().clip(RoundedCornerShape(99.dp))
                .background(Brush.horizontalGradient(listOf(Color(0xFFC08A3A), Color(0xFFE8B95B)))))
        }
    }
}

@Composable
private fun Stat(value: String, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom) {
        Text(value, style = sans(13f, 800, Color.White, lh = 1.3f))
        Text(label, style = sans(11.5f, 400, Color(0xFFC4C9D2), lh = 1.45f))
    }
}

/**
 * deck-box.js on a tile (42 × 46, 50 × 54 from 600 dp): three cards (33 × 46 / 38 × 53, 5 corners, a faint white edge and a
 * soft drop), the second and third at ∓5° and ∓3 px; the case in front in the box colour (160°, lighter to darker) wears the
 * first card (cover at 50 % 22 %), under a 155° gloss.
 */
@Composable
internal fun SiteDeckBox(cards: List<String>, color: String, wide: Boolean, modifier: Modifier, box: androidx.compose.ui.unit.DpSize? = null) {
    val base = cssColor(color, Color(0xFF7664A0)) ?: Color(0xFF7664A0)
    // [box]: a .deck-box sized by its place (.context-art: 48 × 58), the cards centred in it as polish.css centres them.
    val (bw, bh) = box?.let { it.width to it.height } ?: if (wide) 50.dp to 54.dp else 42.dp to 46.dp
    val (cw, ch) = if (wide) 38.dp to 53.dp else 33.dp to 46.dp
    val card = RoundedCornerShape(5.dp)
    Box(modifier.size(bw, bh), contentAlignment = if (box != null) Alignment.Center else Alignment.TopCenter) {
        cards.forEachIndexed { i, src ->
            val p = heroPainter(homeArt(src))
            Box(Modifier.size(cw, ch).graphicsLayer {
                if (i == 1) { translationX = -3.dp.toPx(); rotationZ = -5f } else if (i == 2) { translationX = 3.dp.toPx(); rotationZ = 5f }
            }.shadow(6.dp, card, ambientColor = Color(0x55000000), spotColor = Color(0xBB000000))
                .clip(card).background(Color(0xFF2A2F39)).border(1.dp, Color(0x26FFFFFF), card)) {
                if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
        }
        // box-shadow: 0 8px 16px -6px rgba(0,0,0,.8), 0 1px 2px rgba(0,0,0,.47) (the case is opaque, so an elevation shadow reads the same).
        Box(Modifier.size(cw, ch).shadow(8.dp, card, ambientColor = Color(0x77000000), spotColor = Color(0xCC000000))
            .clip(card).background(Brush.linearGradient(listOf(lerp(base, Color.White, .14f), base, lerp(base, Color.Black, .22f)), start = Offset(0f, 0f), end = Offset(40f, 120f)))
            .border(1.dp, Color(0x30FFFFFF), card)) {
            cards.firstOrNull()?.let { src -> heroPainter(homeArt(src))?.let { Image(it, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = androidx.compose.ui.BiasAlignment(0f, -.56f)) } }
            Box(Modifier.matchParentSize().drawBehind {
                drawRect(Brush.linearGradient(0f to Color(0x30FFFFFF), .38f to Color.Transparent, start = Offset.Zero, end = Offset(size.width * .42f, size.height * .9f)))
                drawRoundRect(Color(0x22FFFFFF), cornerRadius = CornerRadius(5.dp.toPx()), style = Stroke(1.dp.toPx()))
            })
        }
    }
}

// ---------------------------------------------------------------- no decks yet (ui.js empty())

@Composable
private fun DecksEmpty(m: CollectionDecksModel, act: CollectionDecksActions, gutter: Dp) {
    Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(m.emptyTitle ?: "", style = sans(18f, 700, Ink), textAlign = TextAlign.Center)
        Text(m.emptyText, style = sans(14f, 400, Mute), textAlign = TextAlign.Center)
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            m.emptyActions.forEach { b ->
                val shape = RoundedCornerShape(11.dp)
                Box(Modifier.heightIn(min = 44.dp).clip(shape).then(if (!b.ghost) Modifier.background(Color(0xFFE8B95B)) else Modifier.background(GlassFill).border(1.dp, GlassLine, shape))
                    .clickable { act.button(b.act) }.padding(horizontal = 16.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
                    Text(b.label, style = sans(14f, 700, if (!b.ghost) Color(0xFF1A1408) else Ink))
                }
            }
        }
    }
}
