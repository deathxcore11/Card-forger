package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.LinearGradientShader
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * Collection Home: views.js home() as the website draws it on a phone, an unfolded foldable and a handheld. Every word,
 * date, link and picture comes from the site's own Home code running in the app (collection/CollectionEngine.home:
 * home-ui.js homeValueModel / homeDeckShelf / homeMetaCarousel / homeCommunity, tcg.js homeHero / homeToday,
 * home-today.js); nothing here decides what Home says. Sizes and colours are the live site's computed styles
 * (home-overview.css, style.css's #content Home overrides, community-curation.css, game-tabs.css), measured at 390, 412,
 * 844 and 884 px wide.
 */

/** games.js GAMES / GAME_IDS order, GAME_COLOR, and game-tabs.css's tab colour and card-back art per game. */
enum class CardGame(val id: String, val label: String, val color: Color, val tab: Color, val tabArt: String, val tabY: Float, val tabSize: Float, val tabMin: Float) {
    MTG("mtg", "Magic", Color(0xFFF08A5D), Color(0xFFE1B774), "collection/game-tab-mtg.jpg", .60f, 1.15f, 110f),
    YGO("ygo", "Yu-Gi-Oh!", Color(0xFFF5B335), Color(0xFFF7AD61), "collection/game-tab-ygo.png", .48f, 1.15f, 110f),
    PTCG("ptcg", "Pokémon", Color(0xFFEF5350), Color(0xFFFFDC62), "collection/game-tab-ptcg.jpg", .53f, 1.55f, 150f);
    companion object { fun of(id: String) = entries.firstOrNull { it.id == id } ?: MTG }
    /** style.css body[data-game] --gold: the accent a game's pages wear (Magic's gold, Yu-Gi-Oh!'s violet, Pokémon's coral). */
    val gold: Color get() = when (this) { MTG -> Color(0xFFE8B95B); YGO -> Color(0xFFB99BFF); PTCG -> Color(0xFFFF7566) }
}

/** The open game's --gold, for the parts of a page (and its bottom nav) that wear the accent. Magic's gold unless a page says otherwise. */
val LocalGameGold = androidx.compose.runtime.staticCompositionLocalOf { Color(0xFFE8B95B) }

enum class CollectionTab(val label: String) { HOME("Home"), CARDS("Collection"), SEARCH("Search"), DECKS("Decks"), SCAN("Scan") }

// ---------------------------------------------------------------- the model (CollectionEngine.home / hints, as JSON)

/** A site button or link: data-act="go" data-to="#route", or an outside href. */
class HomeLink(val label: String, val href: String, val to: String, val act: String)
/** community-art.js communityArtwork: the picture, what it is, its credit, the fallback caption and the one fallback picture. */
class HomeArt(val src: String, val kind: String, val credit: String, val caption: String, val fallback: String, val fallbackLabel: String, val theme: Boolean)
/** [crop] "pokemon": the art is the card picture's art window (artwork.js pokemonArtCrop), as Pokémon's hero draws it. */
class DailyCard(val id: String, val name: String, val date: String, val art: String, val label: String, val set: String, val setCode: String, val rarity: String, val crop: String = "",
                /** Yu-Gi-Oh!'s set link names its set (data-name) instead of an id. */
                val setName: String = "", val sources: List<String> = emptyList(),
                /** Today's pack (todayPackMarkup): the set's booster to open with this card as its hit; null when the set has none. */
                val pack: TodayPackArt? = null)
class HomeValue(val amount: String, val note: String, val copies: String, val decks: String, val movement: String, val direction: String, val explanation: String)
/** A deck's cover: [art], its fallbacks ([sources], data-art-sources) and [crop] "pokemon" for a Pokémon card's art window (.pk-crop). */
class ShelfLead(val id: String, val empty: Boolean, val eyebrow: String, val name: String, val line: String, val action: HomeLink?, val to: String, val art: String?,
                val sources: List<String> = emptyList(), val crop: String = "")
class ShelfDeck(val id: String, val name: String, val line: String, val art: String?, val to: String, val sources: List<String> = emptyList(), val crop: String = "")
class HomeShelf(val title: String, val all: HomeLink?, val lead: ShelfLead?, val decks: List<ShelfDeck>)
class MetaSlide(val key: String, val state: String, val eyebrow: String, val title: String, val result: String, val source: String, val method: String,
                val note: String, val original: String, val explore: HomeLink?, val art: HomeArt?, val format: String)
class HomeMeta(val title: String, val all: HomeLink?, val slides: List<MetaSlide>, val empty: Boolean, val interval: Long)
class NewsSlide(val id: String, val kind: String, val chips: List<String>, val title: String, val href: String, val summary: String, val source: List<String>,
                val details: List<String>, val detailsLabel: String, val unavailable: String, val art: HomeArt?, val textOnly: Boolean)
class HomeNews(val title: String, val note: String, val status: String, val links: List<HomeLink>, val pageSize: Int, val slides: List<NewsSlide>, val empty: Boolean)
/** search-hints.js: the prompt, then names and questions faded in on the site's own timer. */
class SearchHints(val prompt: String, val first: Long, val every: Long, val fade: Long, val pool: List<String>)

class CollectionHomeModel(val game: CardGame, val heroEyebrow: String, val heroTitle: String, val prompt: String, val daily: DailyCard?, val value: HomeValue,
                          val example: String, val shelf: HomeShelf, val meta: HomeMeta, val news: HomeNews) {
    companion object {
        private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
        private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
        private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonPrimitive)?.asString }.orEmpty()
        private fun link(o: JsonObject?) = o?.let { HomeLink(it.s("label"), it.s("href"), it.s("to"), it.s("act")) }
        private fun art(o: JsonObject?) = o?.let { HomeArt(it.s("src"), it.s("kind"), it.s("credit"), it.s("caption"), it.s("fallback"), it.s("fallbackLabel"), it.b("theme")) }

        fun parse(j: JsonObject): CollectionHomeModel {
            val hero = j.o("hero") ?: JsonObject(); val v = j.o("value") ?: JsonObject(); val sh = j.o("shelf") ?: JsonObject()
            val me = j.o("meta") ?: JsonObject(); val nw = j.o("news") ?: JsonObject()
            return CollectionHomeModel(
                CardGame.of(j.s("game")), hero.s("eyebrow"), hero.s("title"), hero.s("prompt"),
                hero.o("card")?.let { DailyCard(it.s("id"), it.s("name"), it.s("date"), it.s("art"), it.s("label"), it.s("set"), it.s("setCode"), it.s("rarity"), it.s("crop"), it.s("setName"), it.strs("sources"), TodayPackArt.of(it.o("pack"))) },
                HomeValue(v.s("amount"), v.s("note"), v.s("copies"), v.s("decks"), v.s("movement"), v.s("direction"), v.s("explanation")),
                j.s("example"),
                HomeShelf(sh.s("title"), link(sh.o("all")), sh.o("lead")?.let { ShelfLead(it.s("id"), it.b("empty"), it.s("eyebrow"), it.s("name"), it.s("line"), link(it.o("action")), it.s("to"), it.s("art").ifBlank { null }, it.strs("sources"), it.s("crop")) },
                    sh.objs("decks").map { ShelfDeck(it.s("id"), it.s("name"), it.s("line"), it.s("art").ifBlank { null }, it.s("to"), it.strs("sources"), it.s("crop")) }),
                HomeMeta(me.s("title"), link(me.o("all")), me.objs("slides").map {
                    MetaSlide(it.s("key"), it.s("state"), it.s("eyebrow"), it.s("title"), it.s("result"), it.s("source"), it.s("method"), it.s("note"), it.s("original"), link(it.o("explore")), art(it.o("art")), it.s("format"))
                }, me.b("empty"), me.get("interval")?.takeIf { it.isJsonPrimitive }?.asLong ?: 8000),
                HomeNews(nw.s("title"), nw.s("note"), nw.s("status"), nw.objs("links").mapNotNull { link(it) }, nw.get("pageSize")?.takeIf { it.isJsonPrimitive }?.asInt ?: 3,
                    nw.objs("slides").map {
                        NewsSlide(it.s("id"), it.s("kind"), it.strs("chips"), it.s("title"), it.s("href"), it.s("summary"), it.strs("source"), it.strs("details"), it.s("detailsLabel"), it.s("unavailable"), art(it.o("art")), it.b("textOnly"))
                    }, nw.b("empty")))
        }

        fun hints(j: JsonObject) = SearchHints(j.s("prompt"), j.get("first")?.asLong ?: 4000, j.get("every")?.asLong ?: 4200, j.get("fade")?.asLong ?: 260, j.strs("pool"))
    }
}

/** What Home's buttons and links do; the host decides where each goes while the rest of Collection is still the website. */
class CollectionHomeActions(
    val game: (CardGame) -> Unit = {},
    /** A site route, data-act="go" data-to: #decks, #deck/<id>/cards, #collection, #collection/value, #decks/inspiration. */
    val go: (String) -> Unit = {},
    /** A source's own page (a story, an original deck list, News source, Find events): the phone's browser. */
    val open: (String) -> Unit = {},
    /** The search field (home-search.js). */
    val search: () -> Unit = {},
    /** hh-credit data-act="homeDailyCard": the Card of the Day's page. */
    val daily: (DailyCard) -> Unit = {},
    /** today-set-name data-act="set" (or tSet): the set's page. */
    val set: (String) -> Unit = {},
    /** today-set-name data-act="tSetByName": the Yu-Gi-Oh! set it names. */
    val setName: (String) -> Unit = {},
    /** today-pack data-act="homeTodayPack": today's set, its Open Pack with the Card of the Day as the hit. */
    val todayPack: (DailyCard) -> Unit = {},
    /** home-meta-open data-act="mtgProven": that Meta deck. */
    val metaDeck: (MetaSlide) -> Unit = {},
)

// ---------------------------------------------------------------- the page

/**
 * [top] is the app's own bar (mode switch and profile); it is handed the game tabs to hold between them when there is room
 * (the site puts them in its top bar at every width). On a phone they sit in their own row over the art instead.
 */
@Composable
fun CollectionHome(m: CollectionHomeModel, hints: SearchHints?, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit,
                   act: CollectionHomeActions = CollectionHomeActions(), nav: @Composable (vertical: Boolean) -> Unit = {}) =
    // body[data-game]: the open game's --gold (Yu-Gi-Oh!'s violet, Pokémon's coral) on every gold word of the page.
    androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides m.game.gold) {
    val lens = rememberLens()
    BottomScreen { androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides m.game.gold) { CollectionHomeBottom(m, act, lens) } }
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        // Sideways (handhelds, a phone on its side): the nav stands up as a rail so the short height goes to the page.
        val screen = maxWidth
        if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); Page(m, hints, top, act, Modifier.weight(1f).fillMaxHeight(), screen, lens) }
        else Column(Modifier.fillMaxSize()) { Page(m, hints, top, act, Modifier.weight(1f).fillMaxWidth(), screen, lens); nav(false) }
    }
    }

/**
 * Collection Home's bottom screen (plan "The Showcase"): the value case by default (what your collection is worth, how it moved
 * and why, which leave the top screen), and with the ring on the Card of the Day, its set and today's pack.
 */
@Composable
private fun CollectionHomeBottom(m: CollectionHomeModel, act: CollectionHomeActions, lens: LensHost) {
    ShowcaseLens(lens.key) { k ->
        val c = m.daily
        if (k == "daily" && c != null) DailyCase(c, act) else ValueCase(m, act)
    }
}

@Composable
private fun ValueCase(m: CollectionHomeModel, act: CollectionHomeActions) {
    val v = m.value
    val gold = HGold
    ShowcaseCase("Collection · ${m.game.label}", "Your collection", heroWeight = .46f,
        buttons = listOf(CaseButton("A", "See the value", gold = true) { act.go("#collection/value") }, CaseButton(null, "Cards") { act.go("#collection") }, CaseButton(null, "Decks") { act.go("#decks") }),
        hero = {
            Box(Modifier.matchParentSize().background(Brush.radialGradient(listOf(gold.copy(alpha = .22f), Color.Transparent))))
            Column(Modifier.align(Alignment.CenterStart).padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("WORTH TODAY", style = sans(11f, FontWeight.Bold, gold, ls = 1.6f))
                Text(v.amount, style = manrope(40f, FontWeight.ExtraBold, Site.Text, lh = 1.1f, ls = -.04f).copy(fontFeatureSettings = "tnum"), maxLines = 1)
                if (v.movement.isNotEmpty()) Text(v.movement,
                    style = sans(15f, FontWeight.SemiBold, when (v.direction) { "up" -> Color(0xFF7FD69A); "down" -> Color(0xFFF08A7E); else -> Site.Muted }, lh = 1.4f))
                if (v.note.isNotBlank()) Text(v.note, style = sans(13f, color = Site.Muted, lh = 1.4f))
            }
        }) {
        Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            // The paper-card tracker's count, never the Trunk's game cards (Randall 11 Nov: "Paper cards").
            if (v.copies.isNotBlank()) CaseFact("Paper cards", v.copies, big = true)
            if (v.decks.isNotBlank()) CaseFact("Decks", v.decks, big = true)
        }
        if (v.explanation.isNotBlank()) CaseFact("How it's counted", v.explanation)
    }
}

@Composable
private fun DailyCase(c: DailyCard, act: CollectionHomeActions) {
    val pack = c.pack?.sources?.let { s -> s.firstOrNull { !it.second } ?: s.firstOrNull() }?.first
    val setTitle = c.set.ifBlank { c.setName }.ifBlank { "Card of the Day" }
    val buttons = buildList {
        if (c.pack != null) add(CaseButton("A", c.pack.label.takeIf { it.isNotBlank() && it.length <= 18 } ?: "Open today’s pack", gold = true, weight = 1.6f) { act.todayPack(c) })
        add(CaseButton(if (c.pack == null) "A" else null, "Open the card", gold = c.pack == null) { act.daily(c) })
        if (c.setCode.isNotBlank() || c.setName.isNotBlank()) add(CaseButton(null, "The set") { if (c.setCode.isEmpty()) act.setName(c.setName) else act.set(c.setCode) })
    }
    ShowcaseCase(c.label.ifBlank { "Card of the Day" }, setTitle, buttons = buttons, heroWeight = .3f,
        hero = if (pack == null) null else ({
            val img = heroPainter(homeArt(pack))
            if (img != null) Image(img, null, Modifier.align(Alignment.Center).padding(18.dp).fillMaxHeight().aspectRatio(400f / 734f, matchHeightConstraintsFirst = true)
                .graphicsLayer { rotationZ = -3f }.shadow(14.dp, RoundedCornerShape(6.dp)).clip(RoundedCornerShape(6.dp)), contentScale = ContentScale.Crop)
        })) {
        Text("Today's card comes from this set. Its pack has it as the guaranteed hit.".takeIf { c.pack != null } ?: "Today's card comes from this set.",
            style = sans(15f, color = Color(0xFFE4DFD3), lh = 1.45f))
        Row(horizontalArrangement = Arrangement.spacedBy(26.dp)) {
            if (c.setCode.isNotBlank()) CaseFact("Set code", c.setCode.uppercase())
            if (c.rarity.isNotBlank()) CaseFact("Rarity", c.rarity.split(' ').joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } })
        }
        if (c.date.isNotBlank()) CaseFact("Card of the Day for", runCatching { java.time.LocalDate.parse(c.date).format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy", java.util.Locale.US)) }.getOrDefault(c.date))
    }
}

/** --gold on Home: Magic's (with its light theme), or the open game's own. */
private val HGold: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current.takeIf { it != Color(0xFFE8B95B) } ?: Site.Gold

@Composable
private fun Page(m: CollectionHomeModel, hints: SearchHints?, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionHomeActions, modifier: Modifier, screen: Dp, lens: LensHost) {
    // The site's breakpoints are the window's width: --gutter 16 / 22 from 600, the Home columns from 600, 700, 760 and 900.
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    var root by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var pillTop by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current
    Box(modifier.verticalScroll(rememberScrollState()).onGloballyPositioned { root = it }) {
        // hh-art + hh-shade: 590 tall, starting 124 above the search pill, so it runs on under the value line.
        DailyArt(m.daily?.art, with(density) { pillTop.toDp() } + 466.dp, pokemon = m.daily?.crop == "pokemon", sources = m.daily?.sources.orEmpty())
        Column(Modifier.fillMaxWidth()) {
            // The status bar and the bar float on the art; a short scrim keeps them readable (as on Play's hero).
            Box(Modifier.fillMaxWidth()) {
                // Light: the site's light .topbar (settings-theme.css 49), so the rail, the bar and the dark status icons read as one (U12).
                Box(Modifier.matchParentSize().then(if (AppSettings.theme == "light") Modifier.background(Rule.Color.Bar) else Modifier.background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = .45f), Color.Transparent)))))
                Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(if (wide) ({ GameTabs(m.game, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null) }
            }
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 22.dp else 10.dp, bottom = 28.dp)) {
                if (!wide) GameTabs(m.game, act.game, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 18.dp))
                SearchPill(m.prompt, hints, act.search, Modifier.dualLens(lens, null).onGloballyPositioned { c -> root?.takeIf { it.isAttached && c.isAttached }?.let { pillTop = it.localPositionOf(c, Offset.Zero).y.roundToInt() } })
                Spacer(Modifier.height(18.dp))
                m.daily?.let { Box(Modifier.dualLens(lens, "daily")) { Today(it, m.game, screen, act) } }
                // With a bottom screen up, the value lives in its case there (not twice).
                if (!DualScreen.active) { ValueRow(m.value, screen, act); Spacer(Modifier.height(12.dp)) }
                SetsLink(act)
                Spacer(Modifier.height(16.dp))
                if (m.example.isNotEmpty()) { Note(m.example); Spacer(Modifier.height(16.dp)) }
                Box(Modifier.dualLens(lens, null)) { Shelf(m.shelf, m.game, screen, act) }
                Spacer(Modifier.height(24.dp))
                MetaCarousel(m.meta, m.game, screen, act)
                Spacer(Modifier.height(22.dp))
                News(m.news, m.game, screen, act)
            }
        }
    }
}

// ---------------------------------------------------------------- the Card of the Day art behind the top of the page

@Composable
private fun DailyArt(url: String?, height: Dp, pokemon: Boolean = false, sources: List<String> = emptyList()) {
    // The img's data-art-sources, walked in order as its onerror does.
    val raw = if (sources.size > 1) firstOf(sources) else url?.takeIf { it.isNotBlank() }?.let { heroPainter(homeArt(it)) }
    val p = if (pokemon && raw != null) remember(raw) { PkArtCrop(raw) } else raw
    Box(Modifier.fillMaxWidth().height(height)) {
        // opacity .78, object-position 50% 32%, mask: #000 5%, #000e 40%, #0006 74%, transparent.
        if (p != null) Image(p, null, Modifier.matchParentSize().graphicsLayer { alpha = .78f; compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                drawRect(Brush.verticalGradient(.05f to Color.Black, .40f to Color.Black.copy(alpha = .933f), .74f to Color.Black.copy(alpha = .4f), 1f to Color.Transparent), blendMode = BlendMode.DstIn)
            }, contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.36f))
        // .hh-shade: linear-gradient(90deg, #090c13bb, transparent 88%) over linear-gradient(0deg, var(--bg), transparent 65%).
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.35f to Color.Transparent, 1f to Site.Bg))
            .background(Brush.horizontalGradient(0f to Color(0xBB090C13), .88f to Color.Transparent)))
    }
}

// ---------------------------------------------------------------- game tabs (home-ui.js gameTabs, game-tabs.css)

@Composable
internal fun GameTabs(game: CardGame, onGame: (CardGame) -> Unit, compact: Boolean, modifier: Modifier = Modifier) {
    val outer = RoundedCornerShape(if (compact) 16.dp else 18.dp)
    Row(modifier.fillMaxWidth().clip(outer).background(Color(0x90080B10)).border(1.dp, Color(0x13FFFFFF), outer).padding(if (compact) 3.dp else 4.dp),
        horizontalArrangement = Arrangement.spacedBy(if (compact) 2.dp else 5.dp)) {
        for (g in CardGame.entries) {
            val on = g == game
            // Phone: the chosen game stretches with its name, the others are 44 dp marks (style.css .topbar .game-tab).
            GameTab(g, on, showName = !compact || on, compact, (if (!compact || on) Modifier.weight(1f) else Modifier.width(44.dp)).height(44.dp)) { if (!on) onGame(g) }
        }
    }
}

@Composable
private fun GameTab(g: CardGame, on: Boolean, showName: Boolean, compact: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(13.dp)
    val context = LocalContext.current
    val art by produceState(AssetImages.cached("${g.tabArt}@480"), g) { value = AssetImages.load(context, g.tabArt, maxWidth = 480) }
    Box(modifier.clip(shape).background(Color(0xFF151A23)).drawBehind { art?.let { tabArt(it, g, on) } }
        .border(1.dp, if (on) g.tab else Color(0x20FFFFFF), shape).clickable(onClick = onClick).semantics { contentDescription = g.label; role = Role.Tab },
        contentAlignment = Alignment.Center) {
        Row(Modifier.padding(horizontal = if (compact) 3.dp else 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 7.dp)) {
            GameMark(g, if (compact) 20.dp else 23.dp, g.tab.copy(alpha = if (on) 1f else .9f))
            if (showName) Text(g.label, maxLines = 1, style = TextStyle(fontFamily = if (g == CardGame.MTG) Type.Sans else Site.Manrope, fontWeight = FontWeight.ExtraBold,
                fontSize = if (compact) 11.5.sp else 14.sp, letterSpacing = when (g) { CardGame.YGO -> (-.045).em; CardGame.PTCG -> (-.04).em; else -> 0.em },
                color = if (on) Color.White else Color(0xFFF1F3F7), shadow = Shadow(Color.Black, Offset(0f, 1f), 3f)))
        }
        if (on) Box(Modifier.align(Alignment.BottomCenter).size(24.dp, 2.dp).clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)).background(g.tab))
    }
}

/** .game-tab::before: the card back at max(115%, 110px) wide, held at the game's own height, under a dark wash; dimmer when not chosen. */
private fun DrawScope.tabArt(img: ImageBitmap, g: CardGame, on: Boolean) {
    val w = maxOf(size.width * g.tabSize, g.tabMin * density); val h = w * img.height / img.width
    val dst = Offset((size.width - w) * .5f, (size.height - h) * g.tabY)
    val a = if (on) 1f else .65f
    drawImage(img, srcOffset = androidx.compose.ui.unit.IntOffset.Zero, srcSize = androidx.compose.ui.unit.IntSize(img.width, img.height),
        dstOffset = androidx.compose.ui.unit.IntOffset(dst.x.roundToInt(), dst.y.roundToInt()), dstSize = androidx.compose.ui.unit.IntSize(w.roundToInt(), h.roundToInt()), alpha = a)
    drawRect(Brush.horizontalGradient(if (on) listOf(Color(0x70070B12), Color(0x99070B12)) else listOf(Color(0xA8070B12), Color(0xC7070B12))), alpha = a)
}

private val MARKS: Map<String, Path> by lazy {
    mapOf("mtg" to "M12 4.2 19.4 9.6 16.6 18.3H7.4L4.6 9.6z", "ygo-tri" to "M12 3 21.5 20h-19z", "ygo-eye" to "M7.6 14.2Q12 10.4 16.4 14.2 12 18 7.6 14.2z", "ptcg-bar" to "M3 12h5.6M15.4 12H21")
        .mapValues { PathParser().parsePathString(it.value).toPath() }
}

/** icons.js GAME_MARK, drawn at its 24-unit view box. */
@Composable
private fun GameMark(g: CardGame, size: Dp, color: Color, modifier: Modifier = Modifier) = Canvas(modifier.size(size)) { gameMark(g, color, this.size.minDimension) }

// ---------------------------------------------------------------- the search pill (home-search.js, search-hints.js)

@Composable
private fun SearchPill(prompt: String, hints: SearchHints?, onClick: () -> Unit, modifier: Modifier) {
    val shape = RoundedCornerShape(25.dp)
    val gold = Color(0xFFE8B95B)
    // ::before: a light that runs round the gold edge every 9 s (home-search-edge).
    val edge = if (Motion.still) null else rememberInfiniteTransition(label = "search-edge").animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = LinearEasing)), label = "edge")
    var text by remember(hints, prompt) { mutableStateOf(hints?.prompt ?: prompt) }
    val fade = remember { Animatable(1f) }
    // startSearchHints: one timer every [every] ms; the first tick starts the clock, hints swap once [first] ms have passed.
    LaunchedEffect(hints) {
        val h = hints ?: return@LaunchedEffect
        if (Motion.still || h.pool.isEmpty()) return@LaunchedEffect
        var pool = ArrayDeque(h.pool); var ticks = 0L
        while (true) {
            delay(h.every); ticks++
            if ((ticks - 1) * h.every < h.first) continue
            if (pool.isEmpty()) pool = ArrayDeque(h.pool.shuffled())
            fade.animateTo(0f, tween(h.fade.toInt())); text = pool.removeFirst(); fade.animateTo(1f, tween(h.fade.toInt()))
        }
    }
    Box(modifier.fillMaxWidth().heightIn(min = 76.dp).shadow(10.dp, shape, ambientColor = Color.Black.copy(alpha = .2f), spotColor = Color.Black.copy(alpha = .27f))
        .clip(shape).then(if (AppSettings.theme == "light") Modifier.background(Rule.Color.Surface) else Modifier.background(cssGradient(120f, 0f to Color(0xE81B202D), 1f to Color(0xEF131720))))
        .border(1.dp, gold.copy(alpha = .70f), shape)
        .drawWithContent {
            drawContent()
            // linear-gradient(110deg, transparent 15%, gold 40%, #d8f5ff 50%, gold 60%, transparent 85%) at 250% wide, sliding 250% per loop.
            val t = edge?.value ?: Motion.cycle
            val tile = size.width * 2.5f
            val shift = -3.75f * size.width * t
            drawRoundRect(ShaderBrush(cssGradientShader(110f, Size(tile, size.height), Offset(shift, 0f), TileMode.Repeated,
                0f to Color.Transparent, .15f to Color.Transparent, .40f to gold, .50f to Color(0xFFD8F5FF), .60f to gold, .85f to Color.Transparent, 1f to Color.Transparent)),
                cornerRadius = CornerRadius(25.dp.toPx()), style = Stroke(1.dp.toPx()))
        }
        .clickable(onClick = onClick).semantics { contentDescription = "Find cards or ask CardStashy" }, contentAlignment = Alignment.CenterStart) {
        Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 22.dp).alpha(fade.value),
            style = sans(16f, color = Color(0xFF757575)))
    }
}

// ---------------------------------------------------------------- Card of the Day (tcg.js homeToday, home-today.js)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Today(card: DailyCard, game: CardGame, screen: Dp, act: CollectionHomeActions) {
    val wide = screen >= 600.dp
    // .home-today: the pack (.today-pack-slot, centred) then the text, 16 apart (22 wide); no pack, the text alone.
    Row(Modifier.fillMaxWidth().heightIn(min = if (wide) 190.dp else 160.dp).padding(horizontal = if (wide) 8.dp else 0.dp)
        .padding(top = if (wide) 26.dp else 22.dp, bottom = if (wide) 24.dp else 22.dp), horizontalArrangement = Arrangement.spacedBy(if (wide) 22.dp else 16.dp),
        verticalAlignment = Alignment.CenterVertically) {
    card.pack?.let { TodayPack(it, game, screen) { act.todayPack(card) } }
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
        Column(Modifier.clip(RoundedCornerShape(10.dp)).clickable { act.daily(card) }.semantics { contentDescription = "Explore ${card.name}, Card of the Day" }
            .padding(top = 8.dp, end = 42.dp, bottom = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(card.label, style = sans(11f, FontWeight.Bold, LocalGameGold.current, lh = 1.4f, ls = .66f).copy(shadow = Shadow(Color(0x99000000), Offset(0f, 2f), 18f)))
            // #homeToday .hh-credit b: clamp(19px, 5vw, 24px), Manrope 800.
            Text(card.name, style = manrope((screen.value * .05f).coerceIn(19f, 24f), FontWeight.ExtraBold, Color.White, lh = 1.15f, ls = -.035f)
                .copy(shadow = Shadow(Color(0xCC000000), Offset(0f, 2f), 12f)))
        }
        if (card.set.isNotEmpty() || card.rarity.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp),
            itemVerticalAlignment = Alignment.CenterVertically) {
            if (card.set.isNotEmpty()) Text(card.set, modifier = Modifier.clickable { if (card.setCode.isEmpty() && card.setName.isNotEmpty()) act.setName(card.setName) else act.set(card.setCode) },
                style = sans(12.5f, color = Color.White).copy(shadow = Shadow(Color(0xBB000000), Offset(0f, 1f), 8f)))
            // .today-rarity: text-transform capitalize, each word.
            if (card.rarity.isNotEmpty()) Chip(card.rarity.split(' ').joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }, 11f)
        }
    }
}
}

/** .today-rarity / .community-pills .chip: gold ink on a dark capsule with a gold hairline. */
@Composable
private fun Chip(text: String, size: Float, ls: Float = 0f) {
    val shape = RoundedCornerShape(999.dp)
    Box(Modifier.heightIn(min = if (size < 11f) 23.dp else 0.dp).clip(shape).background(Color(0x77000000)).border(1.dp, HGold.copy(alpha = .45f), shape).padding(horizontal = 8.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center) {
        // color-mix(in srgb, var(--gold) 80%, #fff)
        Text(text, style = sans(size, FontWeight.SemiBold, LocalGameGold.current.let { g -> if (g == Color(0xFFE8B95B)) Color(0xFFEDC77C) else androidx.compose.ui.graphics.lerp(g, Color.White, .2f) }, ls = ls))
    }
}

// ---------------------------------------------------------------- your collection at a glance (homeValue)

@Composable
internal fun ValueRow(v: HomeValue, screen: Dp, act: CollectionHomeActions) {
    val roomy = screen >= 700.dp
    val line = Color(0x24FFFFFF)
    Row(Modifier.fillMaxWidth().drawBehind { drawRect(line, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }
        .padding(start = 4.dp, end = 4.dp, top = 8.dp, bottom = if (screen >= 600.dp) 16.dp else 18.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = if (roomy) Arrangement.spacedBy(56.dp) else Arrangement.SpaceBetween) {
        Column(Modifier.weight(1f, fill = !roomy).heightIn(min = 44.dp).clickable { act.go("#collection/value") }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Your collection", style = sans(11f, FontWeight.Bold, HGold, ls = .66f))
            Text(v.amount, style = manrope(32f, FontWeight.ExtraBold, Site.Text, lh = 1.15f, ls = -.045f).copy(fontFeatureSettings = "tnum"))
            Text(v.note, style = sans(11f, color = Site.Muted))
            if (v.movement.isNotEmpty()) Text(v.movement, style = sans(11f, FontWeight.SemiBold, if (v.direction == "flat") Site.Muted else Site.Text, lh = 1.55f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy((screen.value * .04f).coerceIn(14f, 44f).dp)) {
            Count(v.copies, "paper cards", roomy, screen) { act.go("#collection") }
            Count(v.decks, "decks", roomy, screen) { act.go("#decks") }
        }
    }
}

/** Sets' front door (Randall 8 Nov: "I can't find a way" to look at sets): every set, your progress in each; the site has it under Search. */
@Composable
private fun SetsLink(act: CollectionHomeActions) {
    val shape = RoundedCornerShape(16.dp)
    Row(Modifier.fillMaxWidth().clip(shape).background(Color(0x0DFFFFFF)).border(1.dp, Color(0x40D6AD64), shape).clickable(onClickLabel = "Open every set") { act.go("#sets") }
        .padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(SiteIcons.Pack, 22.dp)
        Column(Modifier.weight(1f)) {
            Text("Sets", style = manrope(15f, FontWeight.Bold, Site.Text))
            Text("Every set, what you own and what's missing", style = sans(12f, color = Site.Muted))
        }
        Text("›", style = sans(22f, color = HGold))
    }
}

@Composable
private fun Count(n: String, label: String, start: Boolean, screen: Dp, onClick: () -> Unit) =
    Column(Modifier.heightIn(min = 44.dp).clickable(onClick = onClick), horizontalAlignment = if (start) Alignment.Start else Alignment.End,
        verticalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterVertically)) {
        Text(n, style = manrope((screen.value * .03f).coerceIn(17f, 24f), FontWeight.Bold, Color.White, lh = 1.15f))
        Text(label, style = sans(11f, color = Site.Muted))
    }

/** .note.warn */
@Composable
private fun Note(text: String) = Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x1AF2C66D)).padding(horizontal = 12.dp, vertical = 10.dp)) {
    Text(text, style = sans(13.5f, color = Color(0xFFF6DBA2)))
}

// ---------------------------------------------------------------- your decks (homeDeckShelf)

@Composable
private fun Shelf(s: HomeShelf, game: CardGame, screen: Dp, act: CollectionHomeActions) {
    Column {
        Heading(s.title.ifEmpty { "Your decks" }, s.all, 13f, act, Modifier.padding(bottom = 10.dp))
        val lead = s.lead
        // .home-personal-grid: one column on a phone, two from 600, three from 700; the empty card always spans the row.
        val cols = when { screen < 600.dp -> 1; screen < 700.dp -> 2; else -> 3 }
        val minH = if (screen < 600.dp) 132.dp else 154.dp
        val tiles = buildList<@Composable (Modifier) -> Unit> {
            if (lead != null && !lead.empty) add { mod -> LeadTile(lead, minH, mod, act) }
            for (d in s.decks.take(2)) add { mod -> DeckTile(d, minH, mod, act) }
        }
        if (lead?.empty == true) EmptyShelf(lead, game, act)
        Column(verticalArrangement = Arrangement.spacedBy(if (cols == 1) 10.dp else 12.dp)) {
            tiles.chunked(cols).forEach { row ->
                Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEach { it(Modifier.weight(1f).fillMaxHeight()) }
                    // Two columns and three decks: the last one takes the whole row instead of leaving a hole.
                    if (row.size < cols && !(cols == 2 && tiles.size == 3)) repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

/** h2 + the gold link at the right (.home-shelf-heading, .home-meta-heading). */
@Composable
private fun Heading(title: String, link: HomeLink?, linkSize: Float, act: CollectionHomeActions, modifier: Modifier = Modifier) =
    Row(modifier.fillMaxWidth().heightIn(min = 36.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Text(title, style = manrope(17f, FontWeight.ExtraBold, Site.Text, lh = 1.15f, ls = -.02f), modifier = Modifier.weight(1f, fill = false))
        if (link != null) Box(Modifier.heightIn(min = 36.dp).clickable { if (link.to.isNotEmpty()) act.go(link.to) else if (link.href.isNotEmpty()) act.open(link.href) }
            .padding(start = 12.dp, top = 4.dp, bottom = 4.dp), contentAlignment = Alignment.Center) {
            Text(link.label, style = sans(linkSize, FontWeight.SemiBold, HGold))
        }
    }

/** .home-personal-deck: the deck's cover under a dark wash, framed by a gold-to-glass hairline (brighter on the lead). */
@Composable
private fun TileFrame(art: String?, lead: Boolean, minH: Dp, modifier: Modifier, onClick: () -> Unit, label: String, sources: List<String> = emptyList(), crop: String = "",
                      content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    // The cover and the fallbacks its img walks (ygoCropArt, pokemonArtCrop); a Pokémon card shows its art window.
    val raw = if (sources.size > 1) firstOf(sources) else art?.let { heroPainter(homeArt(it)) }
    val p = if (crop == "pokemon" && raw != null) remember(raw) { PkArtCrop(raw) } else raw
    val loading = raw
    // A deck's cover can change while its card names arrive: the last cover shown holds until the new one has loaded.
    val state = (loading as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
    val ready = p != null && (loading !is coil3.compose.AsyncImagePainter || state is coil3.compose.AsyncImagePainter.State.Success)
    var shown by remember { mutableStateOf<String?>(null) }
    if (ready && shown != art) SideEffect { shown = art }
    val held = shown?.takeIf { !ready && it != art }?.let { heroPainter(homeArt(it)) }?.let { h -> if (crop == "pokemon") PkArtCrop(h) else h }
    Box(modifier.heightIn(min = minH).shadow(14.dp, shape, ambientColor = Color.Black.copy(alpha = .35f), spotColor = Color.Black.copy(alpha = .85f))
        .clip(shape).background(cssGradient(135f, 0f to Color(0xFF252936), 1f to Color(0xFF141720))).clickable(onClick = onClick).semantics { contentDescription = label }) {
        if (held != null) Image(held, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop)
        if (p != null) Image(p, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop)
        // .home-personal-art:after: linear-gradient(0deg, #0b0e15f7, #0b0e1590 55%, #0b0e1522)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x220B0E15), .45f to Color(0x900B0E15), 1f to Color(0xF70B0E15))))
        Box(Modifier.matchParentSize().drawBehind { drawRect(Color(0x1FFFFFFF), Offset.Zero, Size(size.width, 1.dp.toPx())) }
            .border(1.dp, if (lead) cssGradient(155f, 0f to Color(0xE6F6D891), .30f to Color(0x59F1D08A), .55f to Color(0x14FFFFFF), .72f to Color(0x0AFFFFFF), 1f to Color(0x8CF1D08A))
                else cssGradient(155f, 0f to Color(0xB3F1D08A), .26f to Color(0x38FFFFFF), .52f to Color(0x12FFFFFF), .70f to Color(0x0AFFFFFF), 1f to Color(0x66F1D08A)), shape))
        content()
    }
}

private val tileShadow = Shadow(Color(0xBB000000), Offset(0f, 1f), 2f)

/** The deck you last worked on (or one of yours, picked for this visit): its words sit in the middle of the tile. */
@Composable
private fun LeadTile(l: ShelfLead, minH: Dp, modifier: Modifier, act: CollectionHomeActions) =
    TileFrame(l.art, true, minH, modifier, { act.go(l.to) }, "Open ${l.name}", l.sources, l.crop) {
        Column(Modifier.fillMaxWidth().heightIn(min = minH).padding(18.dp), verticalArrangement = Arrangement.Center) {
            if (l.eyebrow.isNotEmpty()) Text(l.eyebrow, style = sans(11f, FontWeight.Bold, HGold, ls = .66f).copy(shadow = tileShadow), modifier = Modifier.padding(bottom = 6.dp))
            Text(l.name, style = manrope(19f, FontWeight.ExtraBold, Color(0xFFF5F6FA), lh = 1.35f, ls = -.02f).copy(shadow = tileShadow), modifier = Modifier.padding(bottom = 4.dp))
            if (l.line.isNotEmpty()) Text(l.line, style = sans(12f, color = Color(0xB0FFFFFF), lh = 1.6f).copy(shadow = tileShadow))
        }
    }

@Composable
private fun DeckTile(d: ShelfDeck, minH: Dp, modifier: Modifier, act: CollectionHomeActions) =
    TileFrame(d.art, false, minH, modifier, { act.go(d.to) }, "Open ${d.name}", d.sources, d.crop) {
        Column(Modifier.fillMaxWidth().heightIn(min = minH).padding(if (minH < 150.dp) 16.dp else 18.dp), verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.Bottom)) {
            Text(d.name, style = sans(17f, FontWeight.Bold, Color(0xFFF5F6FA), lh = 1.2f).copy(shadow = tileShadow))
            Text(d.line, style = sans(11f, color = Color(0xFFE0E3EB)).copy(shadow = tileShadow))
        }
    }

/** .home-resume-empty: no decks yet, and the way to Decks. */
@Composable
private fun EmptyShelf(l: ShelfLead, game: CardGame, act: CollectionHomeActions) {
    val shape = RoundedCornerShape(20.dp)
    Row(Modifier.fillMaxWidth().cardShadow(shape).clip(shape).background(cssGradient(160f, 0f to Color(0xFF1B1B25), 1f to Color(0xFF121218)))
        .drawBehind { ellipseGlow(game.color.copy(alpha = .16f), 0f, 0f, size.width * 1.1f, size.height * 1.5f, .6f) }
        .border(1.dp, Color(0x1CFFFFFF), shape).padding(horizontal = 20.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(l.line, style = sans(12f, color = Color(0xB0FFFFFF), lh = 1.6f), modifier = Modifier.weight(1f))
        l.action?.let { a -> Box(Modifier.heightIn(min = 44.dp).clip(CircleShape).clickable { act.go(a.to.ifEmpty { "#decks" }) }.padding(horizontal = 12.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
            Text(a.label, style = sans(12f, FontWeight.Bold, HGold))
        } }
    }
}

// ---------------------------------------------------------------- Community Meta decks (homeMetaCarousel)

@Composable
private fun MetaCarousel(meta: HomeMeta, game: CardGame, screen: Dp, act: CollectionHomeActions) {
    val n = meta.slides.size
    var index by remember(meta.slides.map { it.key }) { mutableIntStateOf(0) }
    var paused by remember { mutableStateOf(false) }
    val many = n > 1 && !meta.empty
    // The site's 8 s rotation; a tap on the arrows or a swipe starts the wait again.
    LaunchedEffect(index, paused, n) { if (many && !paused && !Motion.still) { delay(meta.interval); index = (index + 1) % n } }
    val slide = meta.slides.getOrNull(index) ?: return
    val quiet = meta.empty && slide.state != "loading"
    Column {
        Heading(meta.title.ifEmpty { "Community Meta decks" }, meta.all, 11f, act, Modifier.padding(horizontal = 4.dp).padding(bottom = 8.dp))
        var drag by remember { mutableStateOf(0f) }
        Box(Modifier.pointerInput(n) {
            detectHorizontalDragGestures(onDragStart = { drag = 0f }, onDragEnd = {
                if (many && abs(drag) > 48.dp.toPx()) index = ((index + if (drag < 0) 1 else -1) % n + n) % n
            }) { _, dx -> drag += dx }
        }) {
            Crossfade(slide, label = "meta") { s -> MetaCard(s, game, screen, quiet, act) }
        }
        if (!quiet) Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, top = 4.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            val off = if (many) 1f else .5f
            Box(Modifier.widthIn(min = 58.dp).height(44.dp).alpha(off).clip(RoundedCornerShape(10.dp)).clickable(enabled = many) { paused = !paused }.padding(6.dp), contentAlignment = Alignment.Center) {
                Text(if (paused) "Resume" else "Pause", style = sans(10f, color = Site.Muted))
            }
            Box(Modifier.size(44.dp).alpha(off).clip(RoundedCornerShape(10.dp)).clickable(enabled = many) { index = (index - 1 + n) % n }.semantics { contentDescription = "Previous Meta deck" },
                contentAlignment = Alignment.Center) { Icon(SiteIcons.Back, 18.dp, Site.Text) }
            Text(if (meta.empty) "0 / 0" else "${index + 1} / $n", textAlign = TextAlign.Center, modifier = Modifier.widthIn(min = 30.dp),
                style = sans(10f, color = Site.Muted).copy(fontFeatureSettings = "tnum"))
            Box(Modifier.size(44.dp).alpha(off).clip(RoundedCornerShape(10.dp)).clickable(enabled = many) { index = (index + 1) % n }.semantics { contentDescription = "Next Meta deck" },
                contentAlignment = Alignment.Center) { Text("→", style = sans(15f, color = Site.Text)) }
        }
    }
}

@Composable
private fun MetaCard(s: MetaSlide, game: CardGame, screen: Dp, quiet: Boolean, act: CollectionHomeActions) {
    val shape = RoundedCornerShape(20.dp)
    if (quiet) {
        // An empty or unavailable list is one quiet line with its link: no art, no carousel bar.
        Row(Modifier.fillMaxWidth().clip(shape).background(Site.Surface.copy(alpha = .6f)).border(1.dp, Site.Line, shape).padding(horizontal = 18.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(s.title, style = sans(14f, FontWeight.SemiBold, Site.Muted), modifier = Modifier.weight(1f).padding(vertical = 12.dp))
            s.explore?.let { e -> Box(Modifier.heightIn(min = 44.dp).clickable { act.go(e.to) }, contentAlignment = Alignment.Center) { Text(e.label, style = sans(13f, FontWeight.SemiBold, HGold)) } }
        }
        return
    }
    Box(Modifier.fillMaxWidth().heightIn(min = 150.dp).cardShadow(shape).clip(shape).background(Color(0xFF121218))) {
        CommunityArt(s.art, game, Modifier.matchParentSize(), meta = true)
        Column(Modifier.fillMaxWidth(if (screen >= 900.dp) .65f else 1f).padding(horizontal = 18.dp, vertical = 16.dp).padding(top = if (s.state == "loading") 18.dp else 0.dp)) {
            if (s.eyebrow.isNotEmpty()) Text(s.eyebrow.uppercase(), style = sans(11f, FontWeight.Bold, HGold, ls = .66f), modifier = Modifier.padding(bottom = 4.dp))
            Text(s.title, style = manrope((screen.value * .048f).coerceIn(18f, 22f), FontWeight.ExtraBold, Color.White, lh = 1.18f, ls = -.02f).copy(shadow = Shadow(Color(0xCC000000), Offset(0f, 2f), 12f)),
                modifier = Modifier.padding(bottom = 6.dp).then(if (s.key.isNotEmpty()) Modifier.clickable { act.metaDeck(s) } else Modifier))
            if (s.result.isNotEmpty()) Text(s.result, style = sans(12.5f, color = Color(0xC4FFFFFF), lh = 1.5f), modifier = Modifier.padding(bottom = 6.dp))
            if (s.note.isNotEmpty()) Text(s.note, style = sans(11f, color = Site.Muted, lh = 1.6f))
            for (t in listOf(s.source, s.method)) if (t.isNotEmpty()) Text(t, style = sans(10.5f, color = Color(0x9CFFFFFF), lh = 1.65f), modifier = Modifier.padding(vertical = 2.dp))
            if (s.original.isNotEmpty()) Box(Modifier.padding(top = 3.dp).heightIn(min = 35.dp).clickable { act.open(s.original) }, contentAlignment = Alignment.CenterStart) {
                Text("Original source", style = sans(10f, FontWeight.SemiBold, HGold))
            }
            s.explore?.let { e -> Box(Modifier.heightIn(min = 44.dp).clickable { act.go(e.to) }, contentAlignment = Alignment.CenterStart) { Text(e.label, style = sans(13f, FontWeight.SemiBold, HGold)) } }
        }
        CardEdge(shape)
    }
}

// ---------------------------------------------------------------- News (homeCommunity / featureArticle)

@Composable
private fun News(news: HomeNews, game: CardGame, screen: Dp, act: CollectionHomeActions) {
    val n = news.slides.size
    val size = news.pageSize.coerceAtLeast(1)
    val pages = if (news.empty) 0 else ceil(n / size.toFloat()).toInt()
    var page by remember(news.slides.map { it.id }) { mutableIntStateOf(0) }
    Column {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(news.title.ifEmpty { "News" }, style = manrope(17f, FontWeight.ExtraBold, Site.Text, lh = 1.15f, ls = -.02f))
            Text(news.note, style = sans(11f, color = Site.Muted))
        }
        if (news.empty) {
            val shape = RoundedCornerShape(20.dp)
            Box(Modifier.fillMaxWidth().clip(shape).background(Color(0xFF121218)).border(1.dp, Color(0x1CFFFFFF), shape).padding(horizontal = 18.dp, vertical = 18.dp)) {
                Text(news.slides.firstOrNull()?.title ?: "", style = sans(14f, FontWeight.SemiBold, Site.Muted))
            }
        } else {
            val start = page * size
            val shown = news.slides.subList(start.coerceAtMost(n), (start + size).coerceAtMost(n))
            var drag by remember { mutableStateOf(0f) }
            val swipe = Modifier.pointerInput(pages) {
                detectHorizontalDragGestures(onDragStart = { drag = 0f }, onDragEnd = {
                    if (pages > 1 && abs(drag) > 48.dp.toPx()) page = ((page + if (drag < 0) 1 else -1) % pages + pages) % pages
                }) { _, dx -> drag += dx }
            }
            // community-curation.css: three across from 760; one under another below that.
            if (screen >= 760.dp) Row(swipe.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                shown.forEach { NewsCard(it, game, screen, Modifier.weight(1f).fillMaxHeight(), act) }
                repeat(size - shown.size) { Spacer(Modifier.weight(1f)) }
            } else Column(swipe, verticalArrangement = Arrangement.spacedBy(12.dp)) { shown.forEach { NewsCard(it, game, screen, Modifier.fillMaxWidth(), act) } }
        }
        Row(Modifier.padding(top = 9.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            news.links.forEach { l -> Text(l.label, style = sans(14f, FontWeight.SemiBold, HGold), modifier = Modifier.clickable { act.open(l.href) }.padding(vertical = 5.6.dp)) }
        }
        if (!news.empty) Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(news.status, style = sans(10f, color = Site.Muted, lh = 1.55f), modifier = Modifier.weight(1f))
            val off = if (pages > 1) 1f else .5f
            Box(Modifier.size(44.dp).alpha(off).clip(CircleShape).clickable(enabled = pages > 1) { page = (page - 1 + pages) % pages }.semantics { contentDescription = "Previous news page" },
                contentAlignment = Alignment.Center) { Icon(SiteIcons.Back, 18.dp, Site.Text) }
            // communityPage().position: "1–3 / 13"
            Text("${page * size + 1}–${minOf(page * size + size, n)} / $n", style = sans(11f, color = Site.Muted).copy(fontFeatureSettings = "tnum"))
            Box(Modifier.size(44.dp).alpha(off).clip(CircleShape).clickable(enabled = pages > 1) { page = (page + 1) % pages }.semantics { contentDescription = "Next news page" },
                contentAlignment = Alignment.Center) { Text("→", style = sans(18f, color = Site.Text)) }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewsCard(s: NewsSlide, game: CardGame, screen: Dp, modifier: Modifier, act: CollectionHomeActions) {
    val shape = RoundedCornerShape(20.dp)
    var textOnly by remember(s.id) { mutableStateOf(s.textOnly || s.art == null) }
    var open by remember(s.id) { mutableStateOf(false) }
    Box(modifier.heightIn(min = 260.dp).cardShadow(shape).clip(shape).background(Color(0xFF121218))) {
        if (!textOnly) CommunityArt(s.art, game, Modifier.matchParentSize(), meta = false, onGone = { textOnly = true })
        Column(Modifier.fillMaxWidth().heightIn(min = 260.dp).padding(horizontal = 18.dp, vertical = 16.dp), verticalArrangement = Arrangement.Bottom) {
            if (s.chips.isNotEmpty()) FlowRow(Modifier.padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) { s.chips.forEach { Chip(it, 10.5f, .66f) } }
            val title = buildAnnotatedString {
                append(s.title.ifEmpty { "Visit the source" })
                if (s.href.isNotEmpty()) withStyle(SpanStyle(color = Site.Muted, fontSize = .75.em)) { append("\u00A0↗") }
            }
            Text(title, style = manrope((screen.value * .048f).coerceIn(18f, 22f), FontWeight.ExtraBold, Color(0xFFF7F8FC), lh = 1.18f, ls = -.02f).copy(shadow = Shadow(Color(0xCC000000), Offset(0f, 2f), 12f)),
                modifier = Modifier.padding(bottom = 6.dp).then(if (s.href.isNotEmpty()) Modifier.clickable { act.open(s.href) } else Modifier))
            if (s.summary.isNotEmpty()) Text(s.summary, style = sans(12.5f, color = Color(0xC4FFFFFF), lh = 1.55f), modifier = Modifier.padding(bottom = 6.dp))
            if (s.source.isNotEmpty()) FlowRow(Modifier.padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                s.source.forEachIndexed { i, t -> Text(t, style = if (i == 0) sans(10.5f, FontWeight.SemiBold, Color(0xFFEDF0F7), lh = 1.55f) else sans(10.5f, color = Color(0x9CFFFFFF), lh = 1.55f)) }
            }
            if (s.details.isNotEmpty()) {
                Row(Modifier.heightIn(min = 32.dp).clickable { open = !open }.padding(top = 8.dp, bottom = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(if (open) "▼" else "▶", style = sans(7f, color = Color(0xFFD4D9E4)))
                    Text(s.detailsLabel.ifEmpty { "Source details" }, style = sans(10f, color = Color(0xFFD4D9E4)))
                }
                if (open) s.details.forEach { Text(it, style = sans(11f, color = Site.Muted, lh = 1.55f), modifier = Modifier.padding(top = 6.dp)) }
            }
            if (s.unavailable.isNotEmpty()) Text(s.unavailable, style = sans(12f, color = Site.Muted))
        }
        CardEdge(shape)
    }
}

// ---------------------------------------------------------------- story and deck art (community-art.js)

/**
 * The picture the site chose, with its rules: a picture that fails gives way to its one fallback (relabelled), then to the
 * game theme; a source image with no fallback takes the art away and leaves a text-only card ([onGone]).
 */
@Composable
private fun CommunityArt(art: HomeArt?, game: CardGame, modifier: Modifier, meta: Boolean, onGone: () -> Unit = {}) {
    var src by remember(art) { mutableStateOf(art?.src.orEmpty()) }
    var credit by remember(art) { mutableStateOf(art?.credit.orEmpty()) }
    var missing by remember(art) { mutableStateOf(art == null || art.src.isEmpty()) }
    val painter: Painter? = if (!missing) heroPainter(homeArt(src)) else null
    val coil = painter as? coil3.compose.AsyncImagePainter
    val state = coil?.state?.collectAsState()?.value
    val failed = !missing && (painter == null || state is coil3.compose.AsyncImagePainter.State.Error)
    val ready = !missing && painter != null && (coil == null || state is coil3.compose.AsyncImagePainter.State.Success)
    LaunchedEffect(failed, src) {
        if (!failed || art == null) return@LaunchedEffect
        if (art.kind in setOf("publisher", "card") && art.fallback.isNotEmpty() && src != art.fallback) { credit = art.fallbackLabel.ifEmpty { "Illustrative card art" }; src = art.fallback }
        else { missing = true; if (art.kind == "publisher" && art.fallback.isEmpty()) onGone() }
    }
    Box(modifier) {
        if (art?.theme == true && !ready) Canvas(Modifier.matchParentSize()) { theme(game, meta) }
        // object-fit: cover; object-position: 50% 35%; faded in when it arrives.
        if (painter != null && !missing) Image(painter, null, Modifier.matchParentSize().alpha(if (ready) 1f else 0f), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.3f))
        // #content .community-art-shade: linear-gradient(90deg, #000e, #000b 45%, #0005) over linear-gradient(0deg, #0009, transparent 60%).
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.4f to Color.Transparent, 1f to Color(0x99000000)))
            .background(Brush.horizontalGradient(0f to Color(0xEE000000), .45f to Color(0xBB000000), 1f to Color(0x55000000))))
        // The credit once the picture is up; the fallback caption while there is none.
        val label = if (ready) credit else if (art?.theme == true || missing) art?.caption.orEmpty() else ""
        if (label.isNotEmpty()) Box(Modifier.align(Alignment.TopEnd).padding(top = 10.dp, end = 12.dp).fillMaxWidth(.46f), contentAlignment = Alignment.TopEnd) {
            Text(label, maxLines = 2, overflow = TextOverflow.Ellipsis, style = manrope(8f, FontWeight.Medium, Color(0xFFE3E8EF), lh = 1.4f, ls = .02f),
                modifier = Modifier.clip(CircleShape).background(Color(0x99000000)).border(1.dp, Color(0x1AFFFFFF), CircleShape).padding(horizontal = 9.dp, vertical = 3.dp))
        }
    }
}

/** .community-art-theme: the game's colour glowing from the top right over night blue, an orbit ring, the game mark and fine lines. */
private fun DrawScope.theme(game: CardGame, meta: Boolean) {
    val px = density
    drawRect(cssGradient(135f, 0f to Color(0xFF111B2D), 1f to Color(0xFF161521)))
    val glow = mix(game.color, Color(0xFF18324D), .65f)
    val cx = size.width * .85f; val cy = size.height * .12f
    ellipseGlow(glow, cx, cy, maxOf(cx, size.width - cx) * sqrt(2f), maxOf(cy, size.height - cy) * sqrt(2f), .62f)
    val orbit = Offset(size.width + 48 * px - 130 * px, -80 * px + 130 * px)
    drawCircle(Color(0x03FFFFFF), 142.5f * px, orbit, style = Stroke(25 * px)); drawCircle(Color(0x03FFFFFF), 162.5f * px, orbit, style = Stroke(65 * px))
    drawCircle(mix(game.color, Color(0x20FFFFFF), .5f), 130 * px, orbit, style = Stroke(px))
    // repeating-linear-gradient(125deg, transparent 0 38px, #ffffff08 38px 39px)
    val a = Math.toRadians(125.0); val dir = Offset(sin(a).toFloat(), -cos(a).toFloat()); val along = Offset(-dir.y, dir.x)
    val span = abs(size.width * dir.x) + abs(size.height * dir.y); val c = Offset(size.width / 2, size.height / 2); val reach = size.width + size.height
    var d = -span / 2 + 38.5f * px
    while (d < span / 2) { val p = c + dir * d; drawLine(Color(0x08FFFFFF), p - along * reach, p + along * reach, px); d += 39 * px }
    val box = (if (meta) 120 else 130) * px
    val left = if (meta) size.width - 18 * px - box else size.width * .88f - box
    val topY = (if (meta) 20 else 28) * px
    translate(left, topY) { rotate(-13f, Offset(box / 2, box / 2)) { gameMark(game, mix(game.color, Color.White, .65f).copy(alpha = .35f), box) } }
}

/** icons.js GAME_MARK, drawn from its 24-unit view box into a [box]-wide square. */
private fun DrawScope.gameMark(game: CardGame, color: Color, box: Float) {
    val k = box / 24f
    scale(k, k, Offset.Zero) {
        fun line(p: String, w: Float, a: Float = 1f) = drawPath(MARKS.getValue(p), color.copy(alpha = color.alpha * a), style = Stroke(w, cap = StrokeCap.Round, join = StrokeJoin.Round))
        when (game) {
            CardGame.MTG -> { line("mtg", 1.6f, .75f); for ((x, y) in listOf(12f to 4.2f, 19.4f to 9.6f, 16.6f to 18.3f, 7.4f to 18.3f, 4.6f to 9.6f)) drawCircle(color, 2.3f, Offset(x, y)) }
            CardGame.YGO -> { line("ygo-tri", 2.2f); line("ygo-eye", 1.8f); drawCircle(color, 1.7f, Offset(12f, 14.2f)) }
            CardGame.PTCG -> { drawCircle(color, 9f, Offset(12f, 12f), style = Stroke(2.2f)); line("ptcg-bar", 2.2f); drawCircle(color, 3f, Offset(12f, 12f), style = Stroke(2.2f)) }
        }
    }
}

// ---------------------------------------------------------------- shared drawing

/** #content .home-meta-card / .community-feature: 1px #ffffff1c edge with the inset top light. */
@Composable
private fun androidx.compose.foundation.layout.BoxScope.CardEdge(shape: RoundedCornerShape) =
    Box(Modifier.matchParentSize().drawBehind { drawRect(Color(0x0DFFFFFF), Offset(20.dp.toPx(), 1.dp.toPx()), Size(size.width - 40.dp.toPx(), 1.dp.toPx())) }.border(1.dp, Color(0x1CFFFFFF), shape))

/** box-shadow: 0 18px 40px #0005 as the platform's own shadow (cheap while scrolling). */
private fun Modifier.cardShadow(shape: RoundedCornerShape) = shadow(16.dp, shape, ambientColor = Color.Black.copy(alpha = .25f), spotColor = Color.Black.copy(alpha = .45f))

/** color-mix(in srgb, a p%, b). */
private fun mix(a: Color, b: Color, p: Float): Color {
    val alpha = a.alpha * p + b.alpha * (1 - p)
    if (alpha == 0f) return Color.Transparent
    fun ch(x: Float, y: Float) = (x * a.alpha * p + y * b.alpha * (1 - p)) / alpha
    return Color(ch(a.red, b.red), ch(a.green, b.green), ch(a.blue, b.blue), alpha)
}

/** A CSS linear-gradient(<deg>, stops) over whatever box it paints: the line runs through the centre, long enough to reach the corners. */
private fun cssGradient(deg: Float, vararg stops: Pair<Float, Color>) = object : ShaderBrush() {
    override fun createShader(size: Size): Shader = cssGradientShader(deg, size, Offset.Zero, TileMode.Clamp, *stops)
}

private fun cssGradientShader(deg: Float, size: Size, shift: Offset, mode: TileMode, vararg stops: Pair<Float, Color>): Shader {
    val a = Math.toRadians(deg.toDouble()); val dir = Offset(sin(a).toFloat(), -cos(a).toFloat())
    val half = (abs(size.width * dir.x) + abs(size.height * dir.y)) / 2f
    val c = Offset(size.width / 2, size.height / 2) + shift
    return LinearGradientShader(c - dir * half, c + dir * half, stops.map { it.second }, stops.map { it.first }, mode)
}

/** radial-gradient(rx ry at cx cy, color, transparent stop): an ellipse drawn as a stretched circle. */
private fun DrawScope.ellipseGlow(color: Color, cx: Float, cy: Float, rx: Float, ry: Float, stop: Float) {
    if (rx <= 0f || ry <= 0f) return
    scale(1f, ry / rx, Offset(cx, cy)) {
        drawCircle(Brush.radialGradient(0f to color, stop to color.copy(alpha = 0f), center = Offset(cx, cy), radius = rx), rx, Offset(cx, cy))
    }
}

private fun sans(size: Float, weight: FontWeight = FontWeight.Normal, color: Color = Site.Text, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = weight, fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color)

/** Manrope with the letter-spacing in em, as the site writes it. */
private fun manrope(size: Float, weight: FontWeight, color: Color, lh: Float = 1.2f, ls: Float = 0f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.em, color = color)

// ---------------------------------------------------------------- the bottom nav

/** Collection's bottom nav (index.html .bottom-nav): Home first, as in Play, so Home is one tap from everywhere. Sideways it
 *  stands up as a rail on the left edge, so the short screen height goes to the content. Scan only where there's a camera
 *  to scan with, never in game mode (Randall 4 Nov: handhelds have no cameras). */
@Composable
fun CollectionNav(active: CollectionTab?, vertical: Boolean = false, scan: Boolean = !vertical && hasCamera(), onSelect: (CollectionTab) -> Unit) {
    val icons = mapOf(CollectionTab.HOME to SiteIcons.House, CollectionTab.CARDS to SiteIcons.CardStack, CollectionTab.SEARCH to SiteIcons.Search,
        CollectionTab.DECKS to SiteIcons.Decks, CollectionTab.SCAN to SiteIcons.Scan)
    val tabs = CollectionTab.entries.filter { it != CollectionTab.SCAN || scan }
    // The controller's LB / RB step along these tabs (the same onSelect a tap runs), stopping at either end. A page with no tab lit
    // (Rules) starts from the first or the last.
    val onSelectNow by androidx.compose.runtime.rememberUpdatedState(onSelect)
    PadScreen(remember(active, tabs) { PadActs(tabs = { d ->
        val i = tabs.indexOf(active); val j = if (i < 0) (if (d > 0) 0 else tabs.lastIndex) else i + d
        tabs.getOrNull(j)?.let { onSelectNow(it) }
    }, nav = true) })
    @Composable fun item(t: CollectionTab, modifier: Modifier) {
        val on = t == active
        Column(modifier.clickable { onSelect(t) }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically)) {
            // .bottom-nav button.on span: the open game's --gold at 20 % behind its icon in --gold (Magic's gold in the app's own themes).
            val gold = LocalGameGold.current.takeIf { it != Color(0xFFE8B95B) } ?: Site.Gold
            Box(Modifier.size(56.dp, 30.dp).clip(RoundedCornerShape(15.dp)).background(if (on) gold.copy(alpha = .2f) else Color.Transparent), contentAlignment = Alignment.Center) {
                Icon(icons.getValue(t), 22.dp, if (on) gold else Site.Muted)
            }
            // style.css 1490: .bottom-nav button { font-size: 11px; letter-spacing: .01em } in a minmax(0,1fr) cell whose
            // overflow stays visible, so a long label at large text ("Collection" at 360 wide, 130 %) spills past its cell
            // rather than being cut to "Collectio".
            Text(t.label, Modifier.wrapContentWidth(unbounded = true), style = Site.Label.copy(color = if (on) Site.Text else Site.Muted, fontSize = 11.sp, letterSpacing = .01.em),
                maxLines = 1, softWrap = false)
        }
    }
    if (vertical) Column(Modifier.fillMaxHeight().width(76.dp).background(Site.Bg).windowInsetsPadding(WindowInsets.statusBars).padding(vertical = 6.dp)) {
        tabs.forEach { t -> item(t, Modifier.fillMaxWidth().weight(1f)) }
    } else Row(Modifier.fillMaxWidth().background(Rule.Color.Bar).navigationBarsPadding().height(72.dp)) {
        tabs.forEach { t -> item(t, Modifier.weight(1f).fillMaxHeight()) }
    }
}

@Composable
private fun hasCamera(): Boolean {
    val context = LocalContext.current
    return remember { context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA_ANY) }
}
