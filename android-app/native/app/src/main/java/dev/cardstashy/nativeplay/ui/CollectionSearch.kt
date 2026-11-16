package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.LinearEasing
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.b
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.o
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.objs
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.s
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.strs

// ---------------------------------------------------------------- the model (CollectionEngine.search: views.js search() / tcg.js tcgSearch())

/** A field of the Filters: a select (data-change, data-field) or an input, under its label's words; [span2] takes the whole row. */
class SearchField(val label: String, val title: String, val span2: Boolean, val select: Boolean, val act: String, val field: String, val options: List<CollOption>,
                  val value: String, val placeholder: String, val number: Boolean, val max: Int, val caps: Boolean)
class SearchChip(val label: String, val aria: String, val act: String, val field: String)
class SearchSaved(val label: String, val act: String, val i: String, val del: String, val delAria: String)
class SearchPip(val value: String, val label: String, val on: Boolean, val act: String)
class SearchHint(val label: String, val act: String, val q: String)
class SearchFanCard(val act: String, val name: String, val id: String, val aria: String, val i: Float, val sources: List<String>, val alt: String)

/** The page as it reads, top to bottom: each part of the site's markup a block, drawn in the same order. */
sealed interface SearchBlock {
    class Field(val value: String, val placeholder: String, val label: String, val input: String, val enter: String, val ask: CardPress?) : SearchBlock
    class Tools(val items: List<CardPress>) : SearchBlock
    class Chips(val items: List<SearchChip>, val clear: CardPress?) : SearchBlock
    class Saved(val label: String, val items: List<SearchSaved>) : SearchBlock
    class Filters(val label: String, val icon: SiteSvg?, val count: String, val heading: String, val pips: List<SearchPip>, val fields: List<SearchField>,
                  val advanced: String?, val advancedFields: List<SearchField>, val foot: String) : SearchBlock
    class Count(val text: String, val save: CardPress?) : SearchBlock
    class Loading(val count: Int) : SearchBlock
    class Tiles(val tiles: List<SetTileM>) : SearchBlock
    class Hints(val label: String, val items: List<SearchHint>) : SearchBlock
    class Fan(val title: String, val text: String, val cards: List<SearchFanCard>) : SearchBlock
    class Empty(val title: String, val text: String) : SearchBlock
    class More(val press: CardPress) : SearchBlock
    /** p.note / p.foot / p.small.muted / .center / .pad, its words before an inline button ([text]) and after it ([after]). */
    class Note(val text: String, val warn: Boolean, val button: CardPress?, val after: String = "", val boxed: Boolean = false, val foot: Boolean = false,
               val small: Boolean = false, val center: Boolean = false, val pad: Boolean = false) : SearchBlock
}

class CollectionSearchModel(val game: CardGame, val title: String, val views: List<CollView>, val mode: String, val blocks: List<SearchBlock>, val busy: Boolean, val term: String) {
    val field get() = blocks.firstNotNullOfOrNull { it as? SearchBlock.Field }

    companion object {
        private fun field(j: JsonObject): SearchField = SearchField(j.s("label"), j.s("title"), j.b("span2"), j.s("kind") == "select", j.s("act"), j.s("field"),
            j.objs("options").map { CollOption(it.s("value"), it.s("label"), it.b("on")) }, j.s("value"), j.s("placeholder"), j.s("type") == "number",
            j.s("max").toIntOrNull() ?: 0, j.b("caps"))

        private fun block(j: JsonObject, game: CardGame): SearchBlock? = when (j.s("kind")) {
            "search" -> SearchBlock.Field(j.s("value"), j.s("placeholder"), j.s("label"), j.s("input"), j.s("enter"),
                j.o("ask")?.let { a -> CardPress(a.s("label"), null, a.s("act"), emptyMap(), "", a.s("aria"), "", false, false, false, false, false) })
            "tools" -> SearchBlock.Tools(j.objs("items").mapNotNull { CollectionCardModel.press(it) })
            "chips" -> SearchBlock.Chips(j.objs("items").map { SearchChip(it.s("label"), it.s("aria"), it.s("act"), it.s("field")) }, CollectionCardModel.press(j.o("clear")))
            "saved" -> SearchBlock.Saved(j.s("label"), j.objs("items").map { SearchSaved(it.s("label"), it.s("act"), it.s("i"), it.s("del"), it.s("delAria")) })
            "filters" -> j.o("advanced").let { adv ->
                SearchBlock.Filters(j.s("label"), CollectionCardsModel.svg(j.o("icon")), j.s("count"), j.s("heading"),
                    j.objs("pips").map { SearchPip(it.s("value"), it.s("label"), it.b("on"), it.s("act")) }, j.objs("fields").map(::field),
                    adv?.s("label"), adv?.objs("fields").orEmpty().map(::field), adv?.s("foot").orEmpty())
            }
            "count" -> SearchBlock.Count(j.s("text"), CollectionCardModel.press(j.o("save")))
            "loading" -> SearchBlock.Loading(j.get("count")?.takeIf { it.isJsonPrimitive }?.asInt ?: 8)
            "tiles" -> SearchBlock.Tiles(j.objs("tiles").map { if (game != CardGame.MTG || it.s("act") == "tCard") CollectionSetModel.tcgTile(it) else CollectionSetModel.tile(it) })
            "hints" -> SearchBlock.Hints(j.s("label"), j.objs("items").map { SearchHint(it.s("label"), it.s("act"), it.s("q")) })
            "fan" -> SearchBlock.Fan(j.s("title"), j.s("text"), j.objs("cards").map { c ->
                val pic = c.o("picture")
                SearchFanCard(c.s("act"), c.s("name"), c.s("id"), c.s("aria"), c.get("i")?.takeIf { it.isJsonPrimitive }?.asFloat ?: 0f,
                    pic?.strs("sources").orEmpty().ifEmpty { listOfNotNull(pic?.s("src")?.ifBlank { null }) }, c.s("alt"))
            })
            "empty" -> SearchBlock.Empty(j.s("title"), j.s("text"))
            "more" -> CollectionCardModel.press(j)?.let { SearchBlock.More(it) }
            "note" -> SearchBlock.Note(j.s("text"), j.b("warn"), CollectionCardModel.press(j.o("button")), j.s("after"), j.b("note"), j.b("foot"), j.b("small"), j.b("center"), j.b("pad"))
            else -> null
        }

        fun parse(j: JsonObject): CollectionSearchModel {
            val game = CardGame.of(j.s("game"))
            return CollectionSearchModel(game, j.s("title"), j.objs("views").map { CollView(it.s("mode"), it.s("label"), it.b("on"), CollectionCardsModel.svg(it.o("icon"))) },
                j.s("mode").ifBlank { "gallery" }, j.objs("blocks").mapNotNull { block(it, game) }, j.b("busy"), j.s("term"))
        }
    }
}

/** suggest.js's list under the box: the recent searches (empty box) or the matching cards (homeResultRow: art, name, set line, price). */
class SearchSuggestItem(val name: String, val art: String, val sub: String, val price: String)
class SearchSuggest(val q: String, val recent: Boolean, val items: List<SearchSuggestItem>) {
    companion object {
        fun parse(j: JsonObject?): SearchSuggest? = j?.let { SearchSuggest(it.s("q"), it.b("recent"), it.objs("items").map { x -> SearchSuggestItem(x.s("name"), x.s("art"), x.s("sub"), x.s("price")) }) }
    }
}

/** What the page's controls do: [press] is a site control by its data-act and dataset (with an input's value), handed to the site's own handler. */
class CollectionSearchActions(
    val game: (CardGame) -> Unit = {},
    /** The search box as typed (data-input), and Enter (data-enter). */
    val type: (String) -> Unit = {},
    val enter: () -> Unit = {},
    val press: (act: String, data: Map<String, String>, value: String) -> Unit = { _, _, _ -> },
    val view: (String) -> Unit = {},
    /** A result tile or a card of the fan (data-act="card" data-name / data-act="tCard" data-id). */
    val card: (SetTileM) -> Unit = {},
    /** A result tile held: the card's actions (Compare). */
    val hold: ((SetTileM) -> Unit)? = null,
    val fan: (SearchFanCard) -> Unit = {},
    /** The box gained or lost focus (suggest.js opens its list on focus). */
    val focus: (Boolean) -> Unit = {},
    /** A suggestion picked: it fills the box and searches. */
    val pick: (String) -> Unit = {},
    /** The answer card's taps (a typed question answered from the app's own data). */
    val answer: AnswerActs = AnswerActs(),
)

private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val LineC = Color(0xFF2A2F39)
private val SurfaceC = Color(0xFF171A20)
private val Surface2 = Color(0xFF1F232B)
private val GlassLine = Color(0x31EDC980)
private val GlassFill = Color(0x851F232B)
private val GoldC: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current

private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color,
        lineHeightStyle = androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center, androidx.compose.ui.text.style.LineHeightStyle.Trim.None))
/** color-mix(in srgb, a p, b). */
private fun mix(a: Color, p: Float, b: Color) = Color(a.red * p + b.red * (1 - p), a.green * p + b.green * (1 - p), a.blue * p + b.blue * (1 - p), a.alpha * p + b.alpha * (1 - p))

// ---------------------------------------------------------------- the page

@Composable
fun CollectionSearch(m: CollectionSearchModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSearchActions = CollectionSearchActions(),
                     nav: @Composable (vertical: Boolean) -> Unit = {}, query: String = m.field?.value ?: "", suggest: SearchSuggest? = null,
                     /** The answer to the words in the box when they are a question (CollectionEngine.searchAnswer), else null. */
                     answer: JsonObject? = null) {
    androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides m.game.gold) {
        BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
            val screen = maxWidth; val tall = maxHeight
            if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); SearchPage(m, top, act, Modifier.weight(1f).fillMaxHeight(), screen, tall, query, suggest, answer) }
            else Column(Modifier.fillMaxSize()) { SearchPage(m, top, act, Modifier.weight(1f).fillMaxWidth(), screen, tall, query, suggest, answer); nav(false) }
        }
    }
}

@Composable
private fun SearchPage(m: CollectionSearchModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSearchActions, modifier: Modifier, screen: Dp, tall: Dp, query: String,
                       suggest: SearchSuggest?, answer: JsonObject?) {
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    val inner = screen - gutter * 2
    val reduced = Playmats.reduced(LocalContext.current)
    // .card-grid: repeat(auto-fill, minmax(140px, 1fr)) 10 apart; 160 from 600; 150 and 12 apart on a tablet-shaped screen.
    val h = LocalConfiguration.current.screenHeightDp.toFloat().coerceAtLeast(tall.value)
    val tablet = (screen.value >= 680 && h >= 560 && screen.value / h >= .75f) || (screen.value >= 800 && h >= 560)
    val (minCol, gap) = when { tablet -> 150f to 12.dp; wide -> 160f to 10.dp; else -> 140f to 10.dp }
    val cols = ((inner.value + gap.value) / (minCol + gap.value)).toInt().coerceAtLeast(1)
    // The site's <details> open themselves in the browser: the app keeps them open or shut per game.
    var filtersOpen by rememberSaveable(m.game) { mutableStateOf(SearchShots.filters) }
    var advancedOpen by rememberSaveable(m.game) { mutableStateOf(SearchShots.filters) }
    val tileAct = remember(act) { CollectionSetActions(card = act.card, hold = act.hold) }
    LazyColumn(modifier, contentPadding = PaddingValues(bottom = 28.dp)) {
        item(key = "top") {
            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                top(if (wide) ({ GameTabs(m.game, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
            }
        }
        item(key = "head") {
            // .page-head: the Cinzel title and the view switch on one line (4 above, 2 below).
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 16.dp else 10.dp)) {
                if (!wide) GameTabs(m.game, act.game, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(m.title, Modifier.weight(1f), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 29.9.sp, letterSpacing = .52.sp, color = Ink))
                    ViewSwitch(m.views, act.view)
                }
            }
        }
        for ((n, b) in m.blocks.withIndex()) when (b) {
            is SearchBlock.Field -> item(key = "field") { SearchBar(b, query, act, wide, suggest, answer, Modifier.padding(horizontal = gutter).padding(top = 14.dp, bottom = 12.dp)) }
            is SearchBlock.Tools -> item(key = "tools") { Tools(b.items, act, screen, Modifier.padding(bottom = 14.dp), gutter) }
            is SearchBlock.Chips -> item(key = "chips") { Chips(b, act, Modifier.padding(horizontal = gutter).padding(vertical = 8.dp)) }
            is SearchBlock.Saved -> item(key = "saved") { Saved(b, act, Modifier.padding(horizontal = gutter).padding(vertical = 8.dp)) }
            is SearchBlock.Filters -> item(key = "filters") {
                Filters(b, act, filtersOpen, { filtersOpen = !filtersOpen }, advancedOpen, { advancedOpen = !advancedOpen }, Modifier.padding(horizontal = gutter).padding(top = 8.dp, bottom = 8.dp))
            }
            is SearchBlock.Count -> item(key = "count") {
                Row(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(b.text, Modifier.weight(1f), style = sans(13f, 400, Mute))
                    b.save?.let { s -> LinkButton(s) { act.press(s.act, s.data, "") } }
                }
            }
            is SearchBlock.Note -> item(key = "note$n") {
                if (b.warn) WarnNote(b.text, b.button, { b.button?.let { p -> act.press(p.act, p.data, "") } }, Modifier.padding(horizontal = gutter).padding(vertical = 8.dp))
                else NoteBlock(b, act, Modifier.padding(horizontal = gutter))
            }
            is SearchBlock.Loading -> items((0 until b.count).chunked(cols), key = { "skel" + it.first() }) { line ->
                // ui.js skeletonGrid: the card shape and two lines (the second 55 %), a pale band sweeping across every 1.3 s.
                Row(Modifier.padding(horizontal = gutter).padding(bottom = gap), horizontalArrangement = Arrangement.spacedBy(gap)) {
                    val skel = shimmer()
                    for (i in line) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f).clip(RoundedCornerShape(10.dp)).background(skel))
                        Box(Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)).background(skel))
                        Box(Modifier.fillMaxWidth(.55f).height(10.dp).clip(RoundedCornerShape(5.dp)).background(skel))
                    }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            is SearchBlock.Tiles -> when (m.mode) {
                "compact", "symbols" -> items(b.tiles, key = { "l:" + it.id.ifEmpty { it.i.toString() } }) { t ->
                    Box(Modifier.padding(horizontal = gutter).padding(bottom = 8.dp)) { ListCard(t, m.mode == "compact", reduced, tileAct) }
                }
                else -> {
                    val lines = b.tiles.chunked(cols)
                    items(lines, key = { line -> "g:" + line.joinToString("|") { it.id.ifEmpty { it.i.toString() } } }) { line ->
                        Row(Modifier.padding(horizontal = gutter).padding(bottom = gap).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
                            for (t in line) if (t.id.isNotEmpty()) TcgGridCard(t, m.game, reduced, tileAct, Modifier.weight(1f).fillMaxHeight()) else GridCard(t, reduced, tileAct, Modifier.weight(1f).fillMaxHeight())
                            repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
            is SearchBlock.Fan -> item(key = "fan") { Fan(b, act, screen, Modifier.padding(horizontal = gutter)) }
            is SearchBlock.Hints -> item(key = "hints") { Hints(b, act, centred = m.blocks.getOrNull(n - 1) is SearchBlock.Fan, Modifier.padding(horizontal = gutter).padding(top = 18.dp)) }
            is SearchBlock.Empty -> item(key = "empty$n") {
                Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = 28.dp, bottom = 36.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(b.title, style = sans(17f, 700), textAlign = TextAlign.Center)
                    Text(b.text, Modifier.widthIn(max = 440.dp), style = sans(14f, 400, Mute), textAlign = TextAlign.Center)
                }
            }
            is SearchBlock.More -> item(key = "more$n") {
                GhostBlock(b.press.label, Modifier.padding(horizontal = gutter).padding(top = 8.dp).alpha(if (b.press.disabled) .45f else 1f)) { if (!b.press.disabled) act.press(b.press.act, b.press.data, "") }
            }
        }
    }
}

// ---------------------------------------------------------------- the search box and its answer card (.searchbar.search-query)

@Composable
private fun SearchBar(b: SearchBlock.Field, query: String, act: CollectionSearchActions, wide: Boolean, suggest: SearchSuggest?, answer: JsonObject?, modifier: Modifier) {
    val gold = GoldC
    var focused by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val shape = RoundedCornerShape(18.dp)
    Column(modifier.fillMaxWidth()) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        // The capsule: 52 tall, 18 corners, a gold-tinted rim (brighter with a halo while typing).
        Box(Modifier.weight(1f).height(52.dp)
            .then(if (focused) Modifier.drawBehind {
                drawRoundRect(gold.copy(alpha = .16f), topLeft = Offset(-4.dp.toPx(), -4.dp.toPx()), size = androidx.compose.ui.geometry.Size(size.width + 8.dp.toPx(), size.height + 8.dp.toPx()),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(22.dp.toPx()))
            } else Modifier)
            .clip(shape).background(Brush.verticalGradient(listOf(mix(SurfaceC, .94f, Color.White), SurfaceC)))
            .border(1.dp, if (focused) gold.copy(alpha = .8f) else mix(gold, .3f, LineC), shape)) {
            BasicTextField(query, { v -> act.type(v) }, Modifier.fillMaxSize().onFocusChanged { if (focused != it.isFocused) { focused = it.isFocused; act.focus(it.isFocused) } }.semantics { contentDescription = b.label },
                singleLine = true, textStyle = sans(16f, 400, Ink), cursorBrush = SolidColor(gold),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { focus.clearFocus(); act.enter() }),
                decorationBox = { inner ->
                    Row(Modifier.fillMaxSize().padding(start = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                            if (query.isEmpty()) Text(b.placeholder, style = sans(16f, 400, Mute.copy(alpha = .85f)), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            inner()
                        }
                        // input[type=search]: its clear button while there is text.
                        if (query.isNotEmpty()) Box(Modifier.size(44.dp).clickable { act.type("") }.semantics { contentDescription = "Clear search" }, contentAlignment = Alignment.Center) {
                            Text("✕", style = sans(16f, 800, Ink))
                        } else Spacer(Modifier.width(10.dp))
                    }
                })
        }
    }
    // A typed question: its answer from the app's own data, above the matching cards (no AI; the Ask button is gone, Randall 13 Nov).
    if (answer != null) { Spacer(Modifier.height(8.dp)); AnswerCard(answer, act.answer) }
    // suggest.js: the list sits under the field, in the page (rulebook R5), so the focus ring walks into it.
    if (focused && suggest != null && suggest.items.isNotEmpty()) { Spacer(Modifier.height(6.dp)); SuggestList(suggest, act) }
    }
}

// ---------------------------------------------------------------- Compare, Sets, Wiki, Random (.search-tools)

@Composable
private fun Tools(items: List<CardPress>, act: CollectionSearchActions, screen: Dp, modifier: Modifier, gutter: Dp) {
    val narrow = screen <= 420.dp
    val gold = GoldC
    val chip = @Composable { p: CardPress, mod: Modifier ->
        val shape = RoundedCornerShape(999.dp)
        // 36 tall as drawn, its tap target the full 44.
        Row(mod.heightIn(min = 44.dp).clickable { act.press(p.act, p.data, "") }.semantics { contentDescription = p.aria.ifBlank { p.label }; role = Role.Button }
            .padding(vertical = 4.dp).clip(shape).background(SurfaceC.copy(alpha = .86f)).border(1.dp, LineC.copy(alpha = .9f), shape)
            .padding(start = if (narrow) 9.dp else 11.dp, end = if (narrow) 9.dp else 14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (narrow) 5.dp else 6.dp, Alignment.CenterHorizontally)) {
            SiteIcon(p.icon, if (narrow) 15.dp else 16.dp, gold)
            Text(p.label, maxLines = 1, style = sans(13f, 650))
        }
    }
    // Under 420 the four share the row; wider they keep their own width and the row scrolls if it must.
    // Too wide for the row at a large text size: they keep their own width and the row scrolls, as the site's overflow-x does.
    if (narrow) BoxWithConstraints(modifier.fillMaxWidth()) {
        val room = maxWidth - gutter * 2
        Box(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = gutter)) { GrowRow(6.dp, room, Modifier) { for (p in items) chip(p, Modifier) } }
    }
    else Row(modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = gutter), horizontalArrangement = Arrangement.spacedBy(8.dp)) { for (p in items) chip(p, Modifier) }
}

/** flex: 1 1 auto in one row: each child at its own width, the room left shared out evenly (and taken back evenly when short). */
@Composable
private fun GrowRow(gap: Dp, width: Dp, modifier: Modifier, content: @Composable () -> Unit) {
    androidx.compose.ui.layout.Layout(content, modifier) { ms, c ->
        val g = gap.roundToPx()
        val natural = ms.map { it.maxIntrinsicWidth(c.maxHeight) }
        val room = width.roundToPx() - g * (ms.size - 1).coerceAtLeast(0)
        val extra = ((room - natural.sum()) / ms.size.coerceAtLeast(1)).coerceAtLeast(0)
        val ps = ms.mapIndexed { i, m -> val w = (natural[i] + extra).coerceAtLeast(0); m.measure(androidx.compose.ui.unit.Constraints.fixedWidth(w).copy(minHeight = 0, maxHeight = c.maxHeight)) }
        val h = ps.maxOfOrNull { it.height } ?: 0
        layout(ps.sumOf { it.width } + g * (ps.size - 1).coerceAtLeast(0), h) { var x = 0; for (p in ps) { p.place(x, (h - p.height) / 2); x += p.width + g } }
    }
}

/** .link.small: gold 13 / 600 words with their icon (☆ Save this search, Clear all, show all). */
@Composable
private fun LinkButton(p: CardPress, onClick: () -> Unit) {
    val gold = GoldC
    Row(Modifier.heightIn(min = 44.dp).clickable(onClick = onClick).semantics { role = Role.Button }.padding(horizontal = 2.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        p.icon?.let { SiteIcon(it, 15.dp, gold) }
        Text(p.label, style = sans(13f, 600, gold))
    }
}

// ---------------------------------------------------------------- the filter chips and saved searches

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Chips(b: SearchBlock.Chips, act: CollectionSearchActions, modifier: Modifier) {
    val gold = GoldC
    FlowRow(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        for (c in b.items) {
            val shape = RoundedCornerShape(999.dp)
            Row(Modifier.heightIn(min = 44.dp).clip(shape).background(mix(gold, .1f, SurfaceC)).border(1.dp, mix(gold, .5f, LineC), shape)
                .clickable { act.press(c.act, mapOf("field" to c.field), "") }.semantics { contentDescription = c.aria; role = Role.Button }.padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(c.label, Modifier.weight(1f, fill = false), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(14f, 600, Mute))
                Text("×", style = sans(14f, 600, Mute))
            }
        }
        b.clear?.let { p -> LinkButton(p) { act.press(p.act, p.data, "") } }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Saved(b: SearchBlock.Saved, act: CollectionSearchActions, modifier: Modifier) {
    FlowRow(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        Text(b.label, style = sans(13f, 400, Mute))
        for (s in b.items) {
            val shape = RoundedCornerShape(999.dp)
            Row(Modifier.height(IntrinsicSize.Min).clip(shape).border(1.dp, LineC, shape).background(SurfaceC), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.heightIn(min = 44.dp).widthIn(max = 240.dp).clickable { act.press(s.act, mapOf("i" to s.i), "") }.semantics { role = Role.Button }.padding(horizontal = 10.dp),
                    contentAlignment = Alignment.Center) { Text(s.label, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(12f, 400)) }
                Box(Modifier.fillMaxHeight().width(1.dp).background(LineC))
                Box(Modifier.heightIn(min = 44.dp).widthIn(min = 44.dp).clickable { act.press(s.del, mapOf("i" to s.i), "") }.semantics { contentDescription = s.delAria; role = Role.Button },
                    contentAlignment = Alignment.Center) { Text("×", style = sans(12f, 400, Mute)) }
            }
        }
    }
}

// ---------------------------------------------------------------- Filters (details.filters)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Filters(b: SearchBlock.Filters, act: CollectionSearchActions, open: Boolean, toggle: () -> Unit, advOpen: Boolean, advToggle: () -> Unit, modifier: Modifier) {
    val gold = GoldC
    val chev by animateFloatAsState(if (open) 180f else 0f, label = "chev")
    Column(modifier.fillMaxWidth()) {
        val shape = RoundedCornerShape(999.dp)
        Row(Modifier.heightIn(min = 44.dp).clip(shape).background(SurfaceC.copy(alpha = .86f)).border(1.dp, if (open) mix(gold, .45f, LineC) else LineC.copy(alpha = .9f), shape)
            .clickable(onClick = toggle).semantics { role = Role.Button; selected = open }.padding(start = 12.dp, end = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            b.icon?.let { SiteIcon(it, 16.dp, gold) }
            Text(b.label, style = sans(13f, 650))
            if (b.count.isNotBlank()) Box(Modifier.heightIn(min = 20.dp).widthIn(min = 20.dp).clip(RoundedCornerShape(999.dp)).background(gold).padding(horizontal = 6.dp), contentAlignment = Alignment.Center) {
                Text(b.count, style = sans(11.5f, 800, goldInk(gold), lh = 1.2f))
            }
            Box(Modifier.size(14.dp).rotate(chev), contentAlignment = Alignment.Center) { Chevron(Mute) }
        }
        if (open) Column(Modifier.padding(top = 10.dp)) {
            if (b.pips.isNotEmpty()) {
                Text(b.heading.uppercase(), Modifier.padding(top = 6.dp, bottom = 4.dp), style = sans(13f, 700, Ink, ls = .78f))
                FlowRow(Modifier.padding(top = 2.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (p in b.pips) Pip(p, gold) { act.press(p.act, mapOf("value" to p.value), "") }
                }
            }
            FieldGrid(b.fields, act)
            b.advanced?.let { label ->
                // details.advanced: "▸ Advanced" in muted 13, its own grid and the Scryfall note under it.
                Row(Modifier.padding(top = 8.dp).heightIn(min = 44.dp).clickable(onClick = advToggle).semantics { role = Role.Button; selected = advOpen },
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // The <summary> marker: a small filled triangle, pointing down when open.
                    Box(Modifier.size(9.dp).rotate(if (advOpen) 90f else 0f).drawBehind {
                        drawPath(Path().apply { moveTo(size.width * .2f, 0f); lineTo(size.width, size.height / 2); lineTo(size.width * .2f, size.height); close() }, Mute)
                    })
                    Text(label, style = sans(13f, 400, Mute))
                }
                if (advOpen) {
                    FieldGrid(b.advancedFields, act)
                    if (b.foot.isNotBlank()) Text(b.foot, Modifier.padding(top = 4.dp), style = sans(12f, 400, Color(0xFF8B93A3), lh = 1.5f))
                }
            }
        }
    }
}

@Composable
private fun Chevron(color: Color) {
    Box(Modifier.size(14.dp).drawBehind {
        val w = size.width
        drawPath(Path().apply { moveTo(w * .25f, w * .38f); lineTo(w * .5f, w * .63f); lineTo(w * .75f, w * .38f) }, color,
            style = androidx.compose.ui.graphics.drawscope.Stroke(1.8.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    })
}

/** .filter-pip: a 44 round on --surface-2 with the 24 colour pip inside (Multicolor a wheel of the five, Colorless a grey ◇); pressed, a gold ring. */
@Composable
private fun Pip(p: SearchPip, gold: Color, onClick: () -> Unit) {
    val W = Color(0xFFF3ECD2); val U = Color(0xFF7FB6EA); val B = Color(0xFFB7A6C9); val R = Color(0xFFF08A6C); val G = Color(0xFF79C98F)
    Box(Modifier.size(44.dp).graphicsLayer { translationY = if (p.on) -1.dp.toPx() else 0f }
        .then(if (p.on) Modifier.drawBehind { drawCircle(gold, radius = size.minDimension / 2 + 2.dp.toPx()) } else Modifier)
        .clip(CircleShape).background(Surface2).border(1.dp, if (p.on) gold else LineC, CircleShape)
        .clickable(onClick = onClick).semantics { contentDescription = p.label; role = Role.Button; selected = p.on }, contentAlignment = Alignment.Center) {
        val pip = Modifier.size(24.dp).clip(CircleShape)
        when (p.value) {
            "M" -> Box(pip.background(Brush.sweepGradient(listOf(W, U, B, R, G, W))))
            "C" -> Box(pip.background(Color(0xFFC9CCD3)), contentAlignment = Alignment.Center) { Text("◇", style = sans(12f, 800, Color(0xFF111111), lh = 1f)) }
            else -> Box(pip.background(when (p.value) { "W" -> W; "U" -> U; "B" -> B; "R" -> R; "G" -> G; else -> Color(0xFFC9CCD3) }))
        }
    }
}

/** .grid2: two columns 10 apart (a .span2 field takes the row); each label 12.5 / 600 muted over its control, 4 apart. */
@Composable
private fun FieldGrid(fields: List<SearchField>, act: CollectionSearchActions) {
    val rows = mutableListOf<List<SearchField>>(); var line = mutableListOf<SearchField>()
    for (f in fields) {
        if (f.span2) { if (line.isNotEmpty()) rows += line; rows += listOf(f); line = mutableListOf() }
        else { line += f; if (line.size == 2) { rows += line; line = mutableListOf() } }
    }
    if (line.isNotEmpty()) rows += line
    Column(Modifier.padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        for (r in rows) Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Bottom) {
            for (f in r) FieldCell(f, act, Modifier.weight(1f))
            if (r.size == 1 && !r[0].span2) Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun FieldCell(f: SearchField, act: CollectionSearchActions, modifier: Modifier) {
    Column(modifier.semantics { if (f.title.isNotBlank()) contentDescription = f.title }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(f.label, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(12.5f, 600, Mute))
        if (f.select) GlassSelect(CollSelect(f.field, f.label, f.options), { v -> act.press(f.act, mapOf("field" to f.field), v) }, Modifier.fillMaxWidth())
        else FieldInput(f, act)
    }
}

/** An input of the Filters (Max price $, Set code): its value goes to the site's handler when it changes (data-change: Done or leaving the field). */
@Composable
private fun FieldInput(f: SearchField, act: CollectionSearchActions) {
    var text by remember(f.field, f.value) { mutableStateOf(f.value) }
    var focused by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val gold = GoldC
    val shape = RoundedCornerShape(11.dp)
    fun commit() { if (text != f.value) act.press(f.act, mapOf("field" to f.field), text) }
    BasicTextField(text, { v -> text = (if (f.caps) v.uppercase() else v).let { if (f.max > 0) it.take(f.max) else it } },
        Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(shape).background(GlassFill).border(1.dp, if (focused) gold.copy(alpha = .6f) else GlassLine, shape)
            .onFocusChanged { if (focused && !it.isFocused) commit(); focused = it.isFocused }.semantics { contentDescription = f.label },
        singleLine = true, textStyle = sans(14f, 400, Ink), cursorBrush = SolidColor(gold),
        keyboardOptions = KeyboardOptions(keyboardType = if (f.number) KeyboardType.Decimal else KeyboardType.Text, imeAction = ImeAction.Done,
            capitalization = if (f.caps) KeyboardCapitalization.Characters else KeyboardCapitalization.None),
        keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
        decorationBox = { inner ->
            Box(Modifier.padding(horizontal = 12.dp, vertical = 9.dp), contentAlignment = Alignment.CenterStart) {
                if (text.isEmpty()) Text(f.placeholder, style = sans(14f, 400, Mute), maxLines = 1, overflow = TextOverflow.Ellipsis)
                inner()
            }
        })
}

// ---------------------------------------------------------------- Try: and the fan of your own cards

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Hints(b: SearchBlock.Hints, act: CollectionSearchActions, centred: Boolean, modifier: Modifier) {
    FlowRow(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, if (centred) Alignment.CenterHorizontally else Alignment.Start),
        verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        Text(b.label, style = sans(13f, 400, Mute))
        for (h in b.items) {
            val shape = RoundedCornerShape(999.dp)
            // .chip: 12 / 700 on --surface-2, its tap target the full 44.
            Box(Modifier.heightIn(min = 44.dp).clickable { act.press(h.act, mapOf("q" to h.q), "") }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
                Text(h.label, Modifier.clip(shape).background(Surface2).border(1.dp, LineC, shape).padding(horizontal = 9.dp, vertical = 3.dp), style = sans(12f, 700))
            }
        }
    }
}

/** .search-fan: up to five of your own cards fanned out (each 7° and its step further from the middle), the title under them in Cinzel. */
@Composable
private fun Fan(b: SearchBlock.Fan, act: CollectionSearchActions, screen: Dp, modifier: Modifier) {
    // --fan-w: clamp(112px, 15vw, 200px); --fan-step: clamp(36px, 8vw, 112px).
    val w = (screen.value * .15f).coerceIn(112f, 200f).dp
    val step = (screen.value * .08f).coerceIn(36f, 112f).dp
    Column(modifier.fillMaxWidth().padding(top = 34.dp, bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.fillMaxWidth().height(w * 1.4f + 44.dp).clip(androidx.compose.ui.graphics.RectangleShape)) {
            for (c in b.cards.sortedBy { -(it.i * it.i) }) {
                val p = firstOf(c.sources)
                Box(Modifier.align(Alignment.TopCenter).padding(top = 10.dp).width(w).aspectRatio(63f / 88f)
                    .graphicsLayer {
                        translationX = (c.i * step.value).dp.toPx(); translationY = (c.i * c.i * 6).dp.toPx(); rotationZ = c.i * 7f
                        transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, 1.2f)
                        shadowElevation = 24.dp.toPx(); shape = RoundedCornerShape(10.dp); clip = true
                    }
                    .background(Surface2).clickable { act.fan(c) }.semantics { contentDescription = c.aria; role = Role.Button }) {
                    if (p != null) Image(p, c.alt, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                }
            }
        }
        Text(b.title, Modifier.padding(top = 4.dp), textAlign = TextAlign.Center,
            style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = (screen.value * .02f).coerceIn(20f, 26f).sp, lineHeight = ((screen.value * .02f).coerceIn(20f, 26f) * 1.2f).sp, color = Ink))
        if (b.text.isNotBlank()) Text(b.text, textAlign = TextAlign.Center, style = sans(15f, 400, Mute))
    }
}

/** Screenshots: the Filters (and Advanced) drawn open. */
object SearchShots { @Volatile var filters = false }

/** .suggest (Recent: the names, 44 tall) or .home-suggestions with homeResultRow rows (34 by 47 art, the name in 14, the set line in 11, the price in gold). */
@Composable
internal fun SuggestList(s: SearchSuggest, act: CollectionSearchActions) {
    val gold = GoldC
    val screenW = LocalConfiguration.current.screenWidthDp.dp
    val shape = RoundedCornerShape(if (s.recent) 14.dp else 20.dp)
    Column(Modifier.fillMaxWidth().heightIn(max = if (s.recent) 320.dp else 450.dp)
        .drawBehind { outerShadow(Color(0xEE000000), 50f, 24f, -18f, if (s.recent) 14f else 20f) }
        .clip(shape).background(if (s.recent) Brush.verticalGradient(listOf(Color(0xF716181E), Color(0xF716181E))) else Brush.linearGradient(listOf(Color(0xFF1D1F29), Color(0xFF12141B))))
        .border(1.dp, if (s.recent) Color(0x1AFFFFFF) else mix(gold, .26f, Color(0x14FFFFFF)), shape)
        .verticalScroll(rememberScrollState()).padding(if (s.recent) 6.dp else 8.dp)) {
        if (s.recent) {
            Text("RECENT", Modifier.padding(horizontal = 12.dp, vertical = 4.dp), style = sans(11f, 800, Mute, ls = .88f))
            for (it in s.items) Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).clickable { act.pick(it.name) }.semantics { role = Role.Button }
                .padding(10.dp), contentAlignment = Alignment.CenterStart) { Text(it.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(15f)) }
        } else for ((i, it) in s.items.withIndex()) {
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x0DFFFFFF)))
            Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).clip(RoundedCornerShape(12.dp)).clickable { act.pick(it.name) }.semantics { role = Role.Button; contentDescription = it.name }
                .padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(34.dp, 47.dp).clip(RoundedCornerShape(4.dp)).background(Surface2), contentAlignment = Alignment.Center) {
                    val p = if (it.art.isNotBlank()) firstOf(listOf(it.art)) else null
                    if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Text("◇", style = sans(12f, 400, Mute))
                }
                Column(Modifier.weight(1f)) {
                    Text(it.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(14f, 700))
                    Text(it.sub, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(11f, 400, Mute))
                }
                if (it.price.isNotBlank()) Text(it.price, style = sans(13f, 700, gold).copy(fontFeatureSettings = "tnum"))
            }
        }
    }
}

/** The .skel-img / .skel-line band: white 5 % to 13 % to 5 %, three widths wide, sliding right to left every 1.3 s. */
@Composable
private fun shimmer(): Brush {
    val t = if (Motion.still) .5f else rememberInfiniteTransition(label = "skel").animateFloat(0f, 1f,
        infiniteRepeatable(tween(1300, easing = LinearEasing)), label = "x").value
    return object : androidx.compose.ui.graphics.ShaderBrush() {
        override fun createShader(size: androidx.compose.ui.geometry.Size): androidx.compose.ui.graphics.Shader {
            // background-size 300 %, background-position 100 % to -100 %: the band starts left of the box and leaves on its right.
            val x0 = size.width * (-2f + 4f * t)
            return androidx.compose.ui.graphics.LinearGradientShader(Offset(x0, 0f), Offset(x0 + size.width * 3, 0f),
                listOf(Color(0x0DFFFFFF), Color(0x0DFFFFFF), Color(0x21FFFFFF), Color(0x0DFFFFFF), Color(0x0DFFFFFF)), listOf(0f, .2f, .4f, .6f, 1f))
        }
    }
}

/** p.note (a --surface-2 box, 13.5), p.foot (12 in --faint, 10 above), p.small.muted (13 in --muted); .center, .pad (28 above and below); an inline .link button. */
@Composable
private fun NoteBlock(b: SearchBlock.Note, act: CollectionSearchActions, modifier: Modifier) {
    val gold = GoldC
    val style = when { b.boxed -> sans(if (b.small) 13f else 13.5f, 400, Ink, lh = 1.5f); b.foot -> sans(12f, 400, Color(0xFF8B93A3), lh = 1.5f); else -> sans(if (b.small) 13f else 15f, 400, Mute, lh = 1.5f) }
    val words = androidx.compose.ui.text.buildAnnotatedString {
        append(b.text)
        b.button?.let { p ->
            if (b.text.isNotEmpty()) append(" ")
            withLink(androidx.compose.ui.text.LinkAnnotation.Clickable("note", androidx.compose.ui.text.TextLinkStyles(androidx.compose.ui.text.SpanStyle(color = gold, fontWeight = FontWeight.SemiBold))) { act.press(p.act, p.data, "") }) { append(p.label) }
        }
        append(b.after)
    }
    val box = if (b.boxed) Modifier.clip(RoundedCornerShape(12.dp)).background(Surface2).padding(horizontal = 12.dp, vertical = 10.dp) else Modifier
    Text(words, modifier.fillMaxWidth().padding(vertical = if (b.pad) 28.dp else if (b.boxed) 10.dp else if (b.foot) 10.dp else 6.dp).then(box)
        .then(if (b.button != null) Modifier.heightIn(min = 44.dp) else Modifier), style = style, textAlign = if (b.center) TextAlign.Center else TextAlign.Start)
}
