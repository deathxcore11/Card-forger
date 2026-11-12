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
    /** Game-feel home G3, the search box typed in where it sits: the cards that match [String] so far (home-search.js lookup), or the recent searches for an empty box. */
    val suggest: suspend (String) -> SearchSuggest? = { null },
    /** A matching card picked from the list under the box (home-search.js pick). */
    val pick: (String) -> Unit = {},
    /** Search pressed on the keyboard: every match for these words, on the Search tab. */
    val find: (String) -> Unit = {},
)

/** Game-feel home G3: the home search box while it is being typed in. */
internal class HomeFind {
    var open by mutableStateOf(false); var q by mutableStateOf(""); var suggest by mutableStateOf<SearchSuggest?>(null)
    fun shut() { open = false; q = ""; suggest = null }
}

/** A deck on Home's shelf, the one last worked on first ([tag] is its eyebrow). */
internal class DeckBoxM(val name: String, val line: String, val tag: String, val art: String?, val to: String, val sources: List<String>, val crop: String)
/** homeDeckShelf's lead and its next two, as the three deck boxes. */
internal fun deckBoxes(s: HomeShelf): List<DeckBoxM> = buildList {
    s.lead?.takeIf { !it.empty }?.let { add(DeckBoxM(it.name, it.line, it.eyebrow, it.art, it.to, it.sources, it.crop)) }
    for (d in s.decks) add(DeckBoxM(d.name, d.line, "", d.art, d.to, d.sources, d.crop))
}.take(3)

// ---------------------------------------------------------------- the page

/**
 * [top] is the app's own bar (mode switch and profile); it is handed the game tabs to hold between them when there is room
 * (the site puts them in its top bar at every width). On a phone they sit in their own row over the art instead.
 */
@Composable
fun CollectionHome(m: CollectionHomeModel, hints: SearchHints?, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit,
                   act: CollectionHomeActions = CollectionHomeActions(), checking: Boolean = false, nav: @Composable (vertical: Boolean) -> Unit = {}) =
    // body[data-game]: the open game's --gold (Yu-Gi-Oh!'s violet, Pokémon's coral) on every gold word of the page.
    androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides m.game.gold) {
    val lens = rememberLens()
    BottomScreen { androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides m.game.gold) { CollectionHomeBottom(m, act, lens) } }
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        // Sideways (handhelds, a phone on its side): the nav stands up as a rail so the short height goes to the page.
        val screen = maxWidth
        if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); Page(m, hints, top, act, Modifier.weight(1f).fillMaxHeight(), screen, lens, checking) }
        else Column(Modifier.fillMaxSize()) { Page(m, hints, top, act, Modifier.weight(1f).fillMaxWidth(), screen, lens, checking); nav(false) }
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
        val d = k?.takeIf { it.startsWith("deck:") }?.removePrefix("deck:")?.toIntOrNull()?.let { deckBoxes(m.shelf).getOrNull(it) }
        if (d != null) DeckCase(d, act) else if (k == "daily" && c != null) DailyCase(c, act) else ValueCase(m, act)
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

/** Two screens, the ring on a deck box: the deck in the case below, while the top screen wears its cover (game-feel home G6). */
@Composable
private fun DeckCase(d: DeckBoxM, act: CollectionHomeActions) {
    ShowcaseCase(d.tag.ifBlank { "Your deck" }, d.name, heroWeight = .46f, buttons = listOf(CaseButton("A", "Open deck", gold = true) { act.go(d.to) }),
        hero = if (d.art == null) null else ({
            val raw = if (d.sources.size > 1) firstOf(d.sources) else heroPainter(homeArt(d.art))
            val p = if (d.crop == "pokemon" && raw != null) remember(raw) { PkArtCrop(raw) } else raw
            if (p != null) Image(p, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.3f))
        })) {
        if (d.line.isNotBlank()) CaseFact("Deck", d.line)
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

/**
 * Game-feel home (specs/game-feel-home-brief.md; Randall 12 Nov: "we are a game on an app now, and it should feel and look like one",
 * approved on the mock-up the same day). One screen, not a feed: the Card of the Day's art is the whole top of the screen, its pack
 * and name sit low on it, then the value plate, three doors (Sets, Meta decks, News) and the decks as boxes. Meta and News open
 * from their doors. Upright screens stack; screens wider than tall put the art and the name at the left and the rest at the right.
 */
@Composable
private fun Page(m: CollectionHomeModel, hints: SearchHints?, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionHomeActions, modifier: Modifier, screen: Dp, lens: LensHost, checking: Boolean = false) {
    // The site's breakpoints are the window's width: --gutter 16 / 22 from 600.
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    // C3: the Card of the Day and the deck covers show together, not one by one.
    val reveal = remember(m.game) { TopReveal() }
    LaunchedEffect(reveal) { delay(reveal.capMs); reveal.giveUp() }
    var door by remember { mutableStateOf<String?>(null) }
    val find = remember { HomeFind() }
    val boxes = remember(m.shelf) { deckBoxes(m.shelf) }
    val games = CardGame.entries
    val game by androidx.compose.runtime.rememberUpdatedState(m.game)
    val step: (Int) -> Unit = remember(act) { { d -> act.game(games[(games.indexOf(game) + d + games.size) % games.size]) } }
    // The pad (ui/PadPrompts.kt): LT / RT change game, X types in the search box, Y opens today's pack (or the card). LB / RB stay the nav's.
    val daily = m.daily
    PadScreen(remember(daily?.id, daily?.pack != null, act) { PadActs(page = step, pageLabel = "Game", x = PadAct("Search") { find.open = true },
        y = daily?.let { c -> PadAct(if (c.pack != null) "Open pack" else "Open card") { if (c.pack != null) act.todayPack(c) else act.daily(c) } }) })
    androidx.compose.runtime.CompositionLocalProvider(LocalTopReveal provides reveal) {
    BoxWithConstraints(modifier) {
        val h = maxHeight
        val panes = maxWidth > maxHeight
        // Two screens: the ring on a deck box turns the top screen into that deck's cover (G6).
        val over = lens.key?.takeIf { DualScreen.active && it.startsWith("deck:") }?.removePrefix("deck:")?.toIntOrNull()?.let { boxes.getOrNull(it) }
        HomeStage(m.game, daily, over, if (panes) h else h * .8f, panes, dim = find.open)
        // A sideways swipe on the art is the next or the last game.
        val swipe = Modifier.pointerInput(step) {
            var drag = 0f
            detectHorizontalDragGestures(onDragStart = { drag = 0f }, onDragEnd = { if (abs(drag) > 56.dp.toPx()) step(if (drag < 0) 1 else -1) }) { _, dx -> drag += dx }
        }
        // One screen tall. A screen too short for it (a small phone, very large text) scrolls instead of squeezing.
        val body = if (panes) maxOf(h, 330.dp) else maxOf(h, 600.dp)
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Column(Modifier.fillMaxWidth().height(body)) {
            // The status bar and the bar float on the art; a short scrim keeps them readable (as on Play's hero).
            Box(Modifier.fillMaxWidth()) {
                // Light: the site's light .topbar (settings-theme.css 49), so the rail, the bar and the dark status icons read as one (U12).
                Box(Modifier.matchParentSize().then(if (AppSettings.theme == "light") Modifier.background(Rule.Color.Bar) else Modifier.background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = .45f), Color.Transparent)))))
                Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(if (wide) ({ GameTabs(m.game, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null) }
                CheckLine(checking, Modifier.align(Alignment.BottomCenter))
            }
            val boxH = when { !panes && wide -> 132.dp; !panes -> 96.dp; h >= 600.dp -> 190.dp; else -> 92.dp }
            val rest: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit = {
                // With a bottom screen up, the value lives in its case there (not twice).
                if (!DualScreen.active) { Hoard(m.value, wide && !(panes && h < 600.dp), act); Spacer(Modifier.height(10.dp)) }
                if (!panes) { Doors(act) { door = it }; Spacer(Modifier.height(10.dp)) }
                if (m.example.isNotEmpty()) { Note(m.example); Spacer(Modifier.height(10.dp)) }
                DeckShelf(m.shelf, boxes, m.game, boxH, act, lens)
                if (panes) { Spacer(Modifier.height(10.dp)); Doors(act) { door = it } }
            }
            if (!panes) Column(Modifier.weight(1f).fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 14.dp else 6.dp, bottom = 12.dp)) {
                if (!wide) GameTabs(m.game, act.game, compact = true, Modifier.padding(bottom = 10.dp))
                HomeSearch(m.prompt, hints, find, act, Modifier.dualLens(lens, null))
                if (find.open) FindResults(find, act, Modifier.weight(1f))
                else {
                    // The open art: nothing sits on it.
                    Box(Modifier.weight(1f).fillMaxWidth().then(swipe))
                    daily?.let { Box(Modifier.dualLens(lens, "daily").then(swipe)) { Today(it, m.game, screen, act) } }
                    rest()
                }
            }
            else Row(Modifier.weight(1f).fillMaxWidth().padding(horizontal = gutter).padding(top = 4.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                Column(Modifier.weight(.44f).fillMaxHeight().then(swipe), verticalArrangement = Arrangement.Bottom) {
                    daily?.let { Box(Modifier.dualLens(lens, "daily")) { Today(it, m.game, screen, act) } }
                }
                Column(Modifier.weight(.56f).fillMaxHeight()) {
                    HomeSearch(m.prompt, hints, find, act, Modifier.dualLens(lens, null))
                    if (find.open) FindResults(find, act, Modifier.weight(1f))
                    else { Spacer(Modifier.weight(1f)); rest() }
                }
            }
        }
        }
        door?.let { which -> DoorSheet(which, m, screen, gutter, act) { door = null } }
    }
    }
}

// ---------------------------------------------------------------- the stage: the Card of the Day's art as the top of the screen

private data class StageArt(val art: String?, val sources: List<String>, val pokemon: Boolean, val daily: Boolean)

/**
 * Game-feel home G4 (Randall 12 Nov: the "card of the day art bleed into the background ... I like that the most, it livens up
 * the app"): the art at full strength across the whole width, melting into the page below it. It drifts slowly, leans a little
 * with the device, and embers in the game's colour rise over it. A change of game crosses to the new art under one sweep of light.
 * [over]: a deck's cover instead (two screens, the ring on that deck). [dim]: the search box is being typed in.
 */
@Composable
private fun HomeStage(game: CardGame, daily: DailyCard?, over: DeckBoxM?, height: Dp, panes: Boolean, dim: Boolean) {
    val shown = if (over != null) StageArt(over.art, over.sources, over.crop == "pokemon", false)
        else StageArt(daily?.art, daily?.sources.orEmpty(), daily?.crop == "pokemon", true)
    val still = Motion.still
    val lean = rememberCardLean()
    val drift = if (still) null else rememberInfiniteTransition(label = "stage").animateFloat(0f, 1f,
        infiniteRepeatable(tween(26_000, easing = LinearEasing), androidx.compose.animation.core.RepeatMode.Reverse), label = "drift")
    val veil by androidx.compose.animation.core.animateFloatAsState(if (dim) .8f else 0f, if (still) androidx.compose.animation.core.snap() else tween(250), label = "stage veil")
    val gold = game.gold
    // The sweep: only when the game changes, never on the first paint.
    val flash = remember { Animatable(1f) }
    var seenGame by remember { mutableStateOf(game) }
    LaunchedEffect(game) { if (seenGame != game) { seenGame = game; if (!still) { flash.snapTo(0f); flash.animateTo(1f, tween(650)) } } }
    Box(Modifier.fillMaxWidth().height(height)) {
        Crossfade(shown, animationSpec = if (still) androidx.compose.animation.core.snap() else tween(550), label = "stage art") { a ->
            StagePicture(a, panes) { d ->
                val t = drift?.value ?: .5f
                scaleX = 1.07f + .05f * t; scaleY = scaleX
                translationX = (t - .5f) * 12f * d - lean.tx / 9f * 8f * d
                translationY = (.5f - t) * 8f * d + lean.ty / 9f * 6f * d
            }
        }
        // The shade: the bar's words stay readable at the top, and the page's own colour takes over at the foot.
        Box(Modifier.matchParentSize().background(if (panes) Brush.horizontalGradient(.2f to Color.Transparent, .85f to Color(0x8C0D1016))
            else Brush.verticalGradient(.5f to Color.Transparent, 1f to Site.Bg)).background(Brush.verticalGradient(0f to Color(0x8C080A0E), .22f to Color.Transparent)))
        if (panes) Box(Modifier.matchParentSize().background(Brush.verticalGradient(.62f to Color.Transparent, 1f to Site.Bg.copy(alpha = .9f))))
        if (!still) Embers(gold, Modifier.matchParentSize())
        Box(Modifier.matchParentSize().drawBehind {
            val t = flash.value
            if (t < 1f) {
                val band = size.width * .5f; val x = -band + (size.width + 2 * band) * t; val a = (1f - t).coerceIn(0f, 1f)
                drawRect(Brush.linearGradient(0f to Color.Transparent, .42f to gold.copy(alpha = .45f * a), .5f to Color.White.copy(alpha = .6f * a), .58f to gold.copy(alpha = .45f * a), 1f to Color.Transparent,
                    start = Offset(x - band, 0f), end = Offset(x + band, size.height * .35f)), blendMode = BlendMode.Plus)
            }
            if (veil > 0f) drawRect(Color(0xFF07090D), alpha = veil)
        })
    }
}

@Composable
private fun StagePicture(a: StageArt, panes: Boolean, move: androidx.compose.ui.graphics.GraphicsLayerScope.(density: Float) -> Unit) {
    val url = a.art?.takeIf { it.isNotBlank() }
    // The img's data-art-sources, walked in order as its onerror does. C4: one picture is asked for at the size of this box; a list
    // of fallbacks walks as before, and a Pokémon card keeps its full size because only its art window is shown.
    val boxed = if (a.sources.size > 1 || a.pokemon) null else url?.let { boxArt(homeArt(it)) }
    val raw = if (a.sources.size > 1) firstOf(a.sources) else if (a.pokemon) url?.let { heroPainter(homeArt(it)) } else boxed?.painter
    val fit = boxed?.fit ?: Modifier
    val p = if (a.pokemon && raw != null) remember(raw) { PkArtCrop(raw) } else raw
    // C3: the Card of the Day waits for the deck covers; a deck's cover shown from the ring does not.
    val seen = revealAlpha(if (a.daily) url?.let { "daily|$it" } else null, raw)
    if (p == null) return
    Box(Modifier.fillMaxSize().graphicsLayer { alpha = seen.value; compositingStrategy = CompositingStrategy.Offscreen }
        .drawWithContent {
            drawContent()
            // The melt into the page: whole to the middle, gone at the foot (side by side: it only darkens low down).
            drawRect(if (panes) Brush.verticalGradient(.66f to Color.Black, 1f to Color.Black.copy(alpha = .28f))
                else Brush.verticalGradient(.46f to Color.Black, .8f to Color.Black.copy(alpha = .45f), 1f to Color.Transparent), blendMode = BlendMode.DstIn)
        }) {
        Image(p, null, Modifier.matchParentSize().then(fit).graphicsLayer { move(density) }, contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.36f))
    }
}

private class Ember(val x: Float, val y: Float, val r: Float, val v: Float, val w: Float, val ph: Float, val a: Float)

/** Small lights in the game's colour rising over the art. Drawn in their own layer, so a frame of them redraws nothing else. */
@Composable
private fun Embers(color: Color, modifier: Modifier) {
    val parts = remember { val r = java.util.Random(7); List(24) { Ember(r.nextFloat(), r.nextFloat(), .6f + r.nextFloat() * 1.6f, .012f + r.nextFloat() * .03f, .5f + r.nextFloat(), r.nextFloat() * 6.28f, .25f + r.nextFloat() * .55f) } }
    var nanos by remember { androidx.compose.runtime.mutableLongStateOf(0L) }
    LaunchedEffect(Unit) { while (true) androidx.compose.runtime.withFrameNanos { nanos = it } }
    Canvas(modifier.graphicsLayer { }) {
        val t = (nanos / 1_000_000L % 3_600_000L) / 1000f
        for (e in parts) {
            val up = (e.y + t * e.v) % 1f
            val y = size.height * (.95f - up * .95f); val x = size.width * e.x + sin(t * e.w + e.ph) * 10.dp.toPx()
            val a = e.a * (y / (size.height * .25f)).coerceIn(0f, 1f) * (1f - up).coerceIn(0f, 1f) * (.6f + .4f * sin(t * 2.4f * e.w + e.ph))
            if (a <= 0f) continue
            drawCircle(color.copy(alpha = a * .22f), e.r * 3.2f * density, Offset(x, y))
            drawCircle(Color.White.copy(alpha = a * .8f), e.r * .7f * density, Offset(x, y))
        }
    }
}

// ---------------------------------------------------------------- the value plate, the doors, the deck boxes

/** Your collection at a glance (homeValue) as a dark glass plate over the art's foot: the same words and taps as [ValueRow]. */
@Composable
internal fun Hoard(v: HomeValue, roomy: Boolean, act: CollectionHomeActions) {
    val shape = RoundedCornerShape(18.dp)
    val gold = HGold
    Row(Modifier.fillMaxWidth().heightIn(min = if (roomy) 100.dp else 80.dp).clip(shape).background(Color(0xB80D1119)).border(1.dp, Color(0x29FFFFFF), shape)
        .drawWithContent {
            drawContent()
            // Gold corner brackets, top left and bottom right.
            val c = 22.dp.toPx(); val r = CornerRadius(18.dp.toPx()); val s = Stroke(2.dp.toPx())
            androidx.compose.ui.graphics.drawscope.clipRect(0f, 0f, c, c) { drawRoundRect(gold, cornerRadius = r, style = s) }
            androidx.compose.ui.graphics.drawscope.clipRect(size.width - c, size.height - c, size.width, size.height) { drawRoundRect(gold, cornerRadius = r, style = s) }
        }
        .padding(horizontal = if (roomy) 22.dp else 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f).heightIn(min = 44.dp).clickable { act.go("#collection/value") }, verticalArrangement = Arrangement.spacedBy(1.dp, Alignment.CenterVertically)) {
            Text("YOUR COLLECTION", style = sans(9.5f, FontWeight.Bold, Color(0xFFAEB6C4), ls = 2f))
            Text(v.amount, maxLines = 1, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.ExtraBold, fontSize = if (roomy) 40.sp else 30.sp, lineHeight = if (roomy) 46.sp else 35.sp,
                brush = Brush.verticalGradient(listOf(Color(0xFFFFF6D8), Color(0xFFE9C877), Color(0xFFB98A35))), fontFeatureSettings = "tnum"))
            if (v.note.isNotEmpty()) Text(v.note, style = sans(if (roomy) 12.5f else 11f, color = Color(0xFFB5BCC9)))
            if (v.movement.isNotEmpty()) Text(v.movement, style = sans(11f, FontWeight.SemiBold, if (v.direction == "flat") Site.Muted else Site.Text, lh = 1.5f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // The paper-card tracker's count, never the Trunk's game cards (Randall 11 Nov: "Paper cards").
            Medal(v.copies, "paper cards", gold, roomy) { act.go("#collection") }
            Medal(v.decks, "decks", gold, roomy) { act.go("#decks") }
        }
    }
}

@Composable
private fun Medal(n: String, label: String, gold: Color, roomy: Boolean, onClick: () -> Unit) =
    Column(Modifier.size(if (roomy) 76.dp else 62.dp).clip(CircleShape)
        .drawBehind {
            drawCircle(Brush.radialGradient(listOf(gold.copy(alpha = .3f), Color(0x990D1119)), center = Offset(size.width / 2, size.height * .3f), radius = size.width * .7f))
            drawCircle(gold.copy(alpha = .8f), size.minDimension / 2 - 1.dp.toPx(), style = Stroke(1.5.dp.toPx()))
        }.clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(n, maxLines = 1, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.ExtraBold, fontSize = if (roomy) 22.sp else 17.sp, color = Color.White))
        Text(label, maxLines = 1, softWrap = false, style = sans(if (roomy) 9f else 7.5f, FontWeight.Bold, Color(0xFFB5BCC9), lh = 1.2f, ls = .3f))
    }

/** The three doors: Sets (its own page), and Meta decks and News, which open over Home instead of lengthening it. */
@Composable
private fun Doors(act: CollectionHomeActions, open: (String) -> Unit) =
    Row(Modifier.fillMaxWidth().height(44.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Door(SiteIcons.PackIcon, "Sets", Modifier.weight(1f)) { act.go("#sets") }
        Door(SiteIcons.Trophy, "Meta decks", Modifier.weight(1f)) { open("meta") }
        Door(SiteIcons.CardStack, "News", Modifier.weight(1f)) { open("news") }
    }

@Composable
private fun Door(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(13.dp)
    Row(modifier.fillMaxHeight().clip(shape).background(Color(0xA60D1119)).border(1.dp, Color(0x26FFFFFF), shape).clickable(onClickLabel = "Open $label", onClick = onClick)
        .semantics { role = Role.Button }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally)) {
        Icon(icon, 17.dp, HGold)
        Text(label, maxLines = 1, style = sans(12.5f, FontWeight.Bold, Color(0xFFE8EBF2)))
    }
}

/** Meta decks or News, opened from its door: the same parts Home had under its decks, over the page; Back or the arrow closes it. */
@Composable
private fun DoorSheet(which: String, m: CollectionHomeModel, screen: Dp, gutter: Dp, act: CollectionHomeActions, close: () -> Unit) {
    androidx.activity.compose.BackHandler(onBack = close)
    Column(Modifier.fillMaxSize().padCover().blockTouchBehind().background(Site.Bg.copy(alpha = .98f)).windowInsetsPadding(WindowInsets.statusBars)) {
        Row(Modifier.fillMaxWidth().height(52.dp).padding(horizontal = gutter - 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = close).semantics { contentDescription = "Back to Home" }.padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(SiteIcons.Back, 18.dp, Site.Text)
                Text("Home", style = sans(14f, FontWeight.SemiBold, Site.Text))
            }
        }
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = gutter).padding(bottom = 24.dp)) {
            if (which == "meta") MetaCarousel(m.meta, m.game, screen, act) else News(m.news, m.game, screen, act)
        }
    }
}

/** Your decks (homeDeckShelf) as up to three deck boxes in one row, the one last worked on first with its tag. */
@Composable
private fun DeckShelf(s: HomeShelf, boxes: List<DeckBoxM>, game: CardGame, boxH: Dp, act: CollectionHomeActions, lens: LensHost) {
    Column {
        Row(Modifier.fillMaxWidth().heightIn(min = 30.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(s.title.ifEmpty { "Your decks" }.uppercase(), style = sans(10f, FontWeight.Bold, Color(0xFFAEB6C4), ls = 2.2f))
            s.all?.let { link -> Text(link.label + " ›", style = sans(12.5f, FontWeight.SemiBold, HGold),
                modifier = Modifier.clickable { if (link.to.isNotEmpty()) act.go(link.to) else if (link.href.isNotEmpty()) act.open(link.href) }.padding(start = 12.dp, top = 6.dp, bottom = 6.dp)) }
        }
        val lead = s.lead
        if (lead?.empty == true) EmptyShelf(lead, game, act)
        if (boxes.isNotEmpty()) Row(Modifier.fillMaxWidth().height(boxH), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            boxes.forEachIndexed { i, d -> DeckBox(d, i == 0 && d.tag.isNotEmpty(), boxH, Modifier.weight(1f).fillMaxHeight().dualLens(lens, "deck:$i"), act) }
        }
    }
}

@Composable
private fun DeckBox(d: DeckBoxM, lead: Boolean, boxH: Dp, modifier: Modifier, act: CollectionHomeActions) =
    TileFrame(d.art, lead, 0.dp, modifier, { act.go(d.to) }, "Open ${d.name}", d.sources, d.crop) {
        val big = boxH >= 130.dp
        Box(Modifier.fillMaxSize()) {
            if (lead) Text(d.tag.uppercase(), maxLines = 1, style = sans(if (big) 9f else 7.5f, FontWeight.ExtraBold, Color(0xFF17110A), lh = 1.3f, ls = .9f),
                modifier = Modifier.align(Alignment.TopStart).padding(top = 8.dp).clip(RoundedCornerShape(topEnd = 6.dp, bottomEnd = 6.dp))
                    .background(Brush.verticalGradient(listOf(Color(0xFFF7DE9C), Color(0xFFD4A94C)))).padding(horizontal = 7.dp, vertical = 2.dp))
            Column(Modifier.align(Alignment.BottomStart).padding(horizontal = if (big) 12.dp else 9.dp, vertical = if (big) 11.dp else 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(d.name, maxLines = if (big || !lead) 2 else 1, overflow = TextOverflow.Ellipsis, style = sans(if (big) 15f else 12f, FontWeight.Bold, Color(0xFFF5F6FA), lh = 1.2f).copy(shadow = tileShadow))
                if (d.line.isNotEmpty()) Text(d.line, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(if (big) 11f else 9.5f, color = Color(0xFFC9CED9)).copy(shadow = tileShadow))
            }
        }
    }

/**
 * C3: [key]'s picture takes part in the top's one reveal while [painter] is still loading; the opacity its Image draws at
 * (0 until the whole top is in, then 1 after one [TopReveal.FADE_MS] fade, or at once when everything was already in memory).
 */
@Composable
private fun revealAlpha(key: String?, painter: androidx.compose.ui.graphics.painter.Painter?): androidx.compose.runtime.State<Float> {
    val gate = LocalTopReveal.current
    val async = painter as? coil3.compose.AsyncImagePainter
    if (gate != null && key != null && async != null) {
        val st = async.state.collectAsState().value
        // Said while the page is first built (not a frame later), so no picture is ever drawn and then hidden again.
        remember(gate, key) { gate.expect(key) }
        androidx.compose.runtime.DisposableEffect(gate, key) { onDispose { gate.dropped(key) } }
        // A picture that cannot be loaded holds nothing up either.
        if (st is coil3.compose.AsyncImagePainter.State.Success || st is coil3.compose.AsyncImagePainter.State.Error) SideEffect { gate.landed(key) }
    }
    val open = gate?.open ?: true
    return androidx.compose.animation.core.animateFloatAsState(if (open) 1f else 0f,
        if (!open || gate?.instant != false || Motion.still) androidx.compose.animation.core.snap() else androidx.compose.animation.core.tween(TopReveal.FADE_MS), label = "top reveal")
}

/** C3: a slow band of light across a glass tile while its picture is still to come. Still when motion is off. */
@Composable
private fun Sheen(modifier: Modifier) {
    val t = if (Motion.still) .5f else androidx.compose.animation.core.rememberInfiniteTransition(label = "sheen").animateFloat(0f, 1f,
        androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(2600, easing = androidx.compose.animation.core.LinearEasing)), label = "sheen").value
    Box(modifier.drawBehind {
        val w = size.width * .45f; val x = -w + (size.width + 2 * w) * t
        drawRect(Brush.linearGradient(listOf(Color.Transparent, Site.GlassHi.copy(alpha = .07f), Color.Transparent), Offset(x - w, 0f), Offset(x + w, size.height)))
    })
}

/**
 * Lighter Collection home C1: while the account is checked, the page as last seen stays whole and the only sign is this thin
 * gold line under the top bar. It fades in and out in 250 ms and does not move, so it costs no redraws while it waits.
 */
@Composable
internal fun CheckLine(on: Boolean, modifier: Modifier = Modifier) {
    val a by androidx.compose.animation.core.animateFloatAsState(if (on) 1f else 0f, androidx.compose.animation.core.tween(if (Motion.still) 0 else 250), label = "checking")
    if (a > 0f) Box(modifier.fillMaxWidth().height(1.5.dp).alpha(a).background(Brush.horizontalGradient(listOf(Color.Transparent, HGold.copy(alpha = .85f), Color.Transparent)))
        .semantics { contentDescription = "Checking your account" })
}

// ---------------------------------------------------------------- game tabs (home-ui.js gameTabs, game-tabs.css)

/**
 * Game-feel home G1 (Randall 12 Nov: "notice how clunky it is to switch between the three games"): the three games are equal
 * thirds at every width and never change size or place. Only the light moves: one bright frame slides to the chosen game.
 * [compact] is the phone's row (smaller words); the tabs' own art, marks and colours are as before.
 */
@Composable
internal fun GameTabs(game: CardGame, onGame: (CardGame) -> Unit, compact: Boolean, modifier: Modifier = Modifier) {
    val outer = RoundedCornerShape(if (compact) 16.dp else 18.dp)
    val pad = if (compact) 3.dp else 4.dp
    val gap = if (compact) 2.dp else 5.dp
    val games = CardGame.entries
    // Where the light is, in tabs from the left; it springs over when the game changes and stands still otherwise.
    val at by androidx.compose.animation.core.animateFloatAsState(games.indexOf(game).toFloat(),
        if (Motion.still) androidx.compose.animation.core.snap() else androidx.compose.animation.core.spring(dampingRatio = .72f, stiffness = 420f), label = "game light")
    val tint by androidx.compose.animation.animateColorAsState(game.tab, if (Motion.still) androidx.compose.animation.core.snap() else tween(300), label = "game light colour")
    Row(modifier.fillMaxWidth().clip(outer).background(Color(0x90080B10)).border(1.dp, Color(0x13FFFFFF), outer).padding(pad)
        .drawWithContent {
            drawContent()
            val g = gap.toPx(); val w = (size.width - g * (games.size - 1)) / games.size
            val x = at * (w + g); val r = CornerRadius(13.dp.toPx())
            drawRoundRect(Brush.verticalGradient(listOf(tint.copy(alpha = .22f), tint.copy(alpha = .05f))), Offset(x, 0f), Size(w, size.height), r)
            drawRoundRect(tint, Offset(x, 0f), Size(w, size.height), r, style = Stroke(1.5.dp.toPx()))
            // The chosen game's underline rides with the light.
            drawRoundRect(tint, Offset(x + w / 2 - 12.dp.toPx(), size.height - 2.dp.toPx()), Size(24.dp.toPx(), 2.dp.toPx()), CornerRadius(2.dp.toPx()))
        },
        horizontalArrangement = Arrangement.spacedBy(gap)) {
        for (g in games) {
            val on = g == game
            GameTab(g, on, showName = true, compact, Modifier.weight(1f).height(44.dp)) { if (!on) onGame(g) }
        }
    }
}

@Composable
private fun GameTab(g: CardGame, on: Boolean, showName: Boolean, compact: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(13.dp)
    val context = LocalContext.current
    val art by produceState(AssetImages.cached("${g.tabArt}@480"), g) { value = AssetImages.load(context, g.tabArt, maxWidth = 480) }
    Box(modifier.clip(shape).background(Color(0xFF151A23)).drawBehind { art?.let { tabArt(it, g, on) } }
        .border(1.dp, Color(0x20FFFFFF), shape).clickable(onClick = onClick).semantics { contentDescription = g.label; role = Role.Tab },
        contentAlignment = Alignment.Center) {
        Row(Modifier.padding(horizontal = if (compact) 3.dp else 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 7.dp)) {
            GameMark(g, if (compact) 18.dp else 23.dp, g.tab.copy(alpha = if (on) 1f else .9f))
            if (showName) Text(g.label, maxLines = 1, softWrap = false, style = TextStyle(fontFamily = if (g == CardGame.MTG) Type.Sans else Site.Manrope, fontWeight = FontWeight.ExtraBold,
                fontSize = if (compact) 11.5.sp else 14.sp, letterSpacing = when (g) { CardGame.YGO -> (-.045).em; CardGame.PTCG -> (-.04).em; else -> 0.em },
                color = if (on) Color.White else Color(0xFFF1F3F7), shadow = Shadow(Color.Black, Offset(0f, 1f), 3f)))
        }
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

/**
 * Game-feel home G3 (Randall 12 Nov: the home search bar "acts like a button that takes you to the search tab, and that is not
 * what it should be doing"): the box is typed in where it sits, as the site's own is (home-search.js). A tap puts the cursor in
 * it with the keyboard up; the cards that match show under it; Back or Cancel puts Home back.
 */
@Composable
private fun HomeSearch(prompt: String, hints: SearchHints?, find: HomeFind, act: CollectionHomeActions, modifier: Modifier) {
    val shape = RoundedCornerShape(25.dp)
    val gold = Color(0xFFE8B95B)
    val open = find.open
    // ::before: a light that runs round the gold edge every 9 s (home-search-edge); it rests while the box is typed in.
    val edge = if (Motion.still || open) null else rememberInfiniteTransition(label = "search-edge").animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = LinearEasing)), label = "edge")
    var text by remember(hints, prompt) { mutableStateOf(hints?.prompt ?: prompt) }
    val fade = remember { Animatable(1f) }
    // startSearchHints: one timer every [every] ms; the first tick starts the clock, hints swap once [first] ms have passed.
    LaunchedEffect(hints, open) {
        val h = hints ?: return@LaunchedEffect
        if (open || Motion.still || h.pool.isEmpty()) return@LaunchedEffect
        var pool = ArrayDeque(h.pool); var ticks = 0L
        while (true) {
            delay(h.every); ticks++
            if ((ticks - 1) * h.every < h.first) continue
            if (pool.isEmpty()) pool = ArrayDeque(h.pool.shuffled())
            fade.animateTo(0f, tween(h.fade.toInt())); text = pool.removeFirst(); fade.animateTo(1f, tween(h.fade.toInt()))
        }
    }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    androidx.activity.compose.BackHandler(open) { find.shut() }
    LaunchedEffect(open) { if (open) { runCatching { focus.requestFocus() }; keyboard?.show() } else focusManager.clearFocus() }
    // home-search.js update: the list for what is in the box, 220 ms after the last key (an empty box: the recent searches).
    LaunchedEffect(open, find.q) {
        if (!open) return@LaunchedEffect
        val asked = find.q.trim()
        if (asked.isNotEmpty()) delay(220)
        val s = runCatching { act.suggest(asked) }.getOrNull()
        if (s != null && (if (asked.isEmpty()) s.recent else s.q == asked)) find.suggest = s else if (asked.isEmpty()) find.suggest = null
    }
    Box(modifier.fillMaxWidth().height(56.dp).shadow(10.dp, shape, ambientColor = Color.Black.copy(alpha = .2f), spotColor = Color.Black.copy(alpha = .27f))
        .clip(shape).then(if (AppSettings.theme == "light") Modifier.background(Rule.Color.Surface) else Modifier.background(cssGradient(120f, 0f to Color(0xE81B202D), 1f to Color(0xEF131720))))
        .border(if (open) 1.5.dp else 1.dp, gold.copy(alpha = if (open) .95f else .70f), shape)
        .drawWithContent {
            drawContent()
            if (open) return@drawWithContent
            // linear-gradient(110deg, transparent 15%, gold 40%, #d8f5ff 50%, gold 60%, transparent 85%) at 250% wide, sliding 250% per loop.
            val t = edge?.value ?: Motion.cycle
            val tile = size.width * 2.5f
            val shift = -3.75f * size.width * t
            drawRoundRect(ShaderBrush(cssGradientShader(110f, Size(tile, size.height), Offset(shift, 0f), TileMode.Repeated,
                0f to Color.Transparent, .15f to Color.Transparent, .40f to gold, .50f to Color(0xFFD8F5FF), .60f to gold, .85f to Color.Transparent, 1f to Color.Transparent)),
                cornerRadius = CornerRadius(25.dp.toPx()), style = Stroke(1.dp.toPx()))
        }
        .then(if (open) Modifier else Modifier.clickable { find.open = true }.semantics { contentDescription = "Find cards or ask CardStashy" }), contentAlignment = Alignment.CenterStart) {
        Row(Modifier.fillMaxSize().padding(start = 18.dp, end = if (open) 6.dp else 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(SiteIcons.Search, 19.dp, LocalGameGold.current)
            if (!open) Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).alpha(fade.value), style = sans(16f, color = Color(0xFF8A8F9B)))
            else {
                androidx.compose.foundation.text.BasicTextField(find.q, { find.q = it }, Modifier.weight(1f).focusRequester(focus).semantics { contentDescription = "Find cards or ask CardStashy" },
                    singleLine = true, textStyle = sans(16f, color = Site.Text), cursorBrush = androidx.compose.ui.graphics.SolidColor(gold),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { val q = find.q.trim(); if (q.isNotEmpty()) { find.shut(); act.find(q) } }),
                    decorationBox = { inner -> Box(contentAlignment = Alignment.CenterStart) {
                        if (find.q.isEmpty()) Text(prompt, maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(16f, color = Color(0xFF757575)))
                        inner()
                    } })
                Box(Modifier.heightIn(min = 44.dp).clip(CircleShape).clickable { find.shut() }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                    Text("Cancel", style = sans(13f, FontWeight.Bold, LocalGameGold.current))
                }
            }
        }
    }
}

/** Under the box while it is typed in: the matching cards (or the recent searches), each one tap from its page. */
@Composable
private fun FindResults(find: HomeFind, act: CollectionHomeActions, modifier: Modifier) {
    val s = find.suggest
    Column(modifier.fillMaxWidth().padding(top = 8.dp)) {
        if (s != null && s.items.isNotEmpty()) SuggestList(s, CollectionSearchActions(pick = { name -> find.shut(); act.pick(name) }))
        else if (find.q.isNotBlank()) Text("Press Search on the keyboard for every match.", style = sans(13f, color = Site.Muted), modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
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
    // C4: one cover is asked for at the size of its tile; a list of fallbacks walks as before, and a Pokémon card keeps its
    // full size because only its art window is shown.
    val pk = crop == "pokemon"
    val boxed = if (sources.size > 1 || pk) null else art?.let { boxArt(homeArt(it)) }
    val raw = if (sources.size > 1) firstOf(sources) else if (pk) art?.let { heroPainter(homeArt(it)) } else boxed?.painter
    val p = if (crop == "pokemon" && raw != null) remember(raw) { PkArtCrop(raw) } else raw
    val loading = raw
    // A deck's cover can change while its card names arrive: the last cover shown holds until the new one has loaded.
    val state = (loading as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
    val ready = p != null && (loading !is coil3.compose.AsyncImagePainter || state is coil3.compose.AsyncImagePainter.State.Success)
    var shown by remember { mutableStateOf<String?>(null) }
    if (ready && shown != art) SideEffect { shown = art }
    // C3: until the whole top is in, the tile is glass with a slow sheen; then its cover shows with the others.
    val gate = LocalTopReveal.current
    val seen = revealAlpha(art?.let { "tile|$label|$it" }, raw)
    val heldBox = if (pk) null else shown?.takeIf { !ready && it != art }?.let { boxArt(homeArt(it)) }
    val held = if (pk) shown?.takeIf { !ready && it != art }?.let { heroPainter(homeArt(it)) }?.let { PkArtCrop(it) } else heldBox?.painter
    Box(modifier.heightIn(min = minH).shadow(14.dp, shape, ambientColor = Color.Black.copy(alpha = .35f), spotColor = Color.Black.copy(alpha = .85f))
        .clip(shape).background(cssGradient(135f, 0f to Color(0xFF252936), 1f to Color(0xFF141720))).clickable(onClick = onClick).semantics { contentDescription = label }) {
        if (held != null) Image(held, null, Modifier.matchParentSize().then(heldBox?.fit ?: Modifier), contentScale = ContentScale.Crop)
        if (p != null) Image(p, null, Modifier.matchParentSize().then(boxed?.fit ?: Modifier).graphicsLayer { alpha = seen.value }, contentScale = ContentScale.Crop)
        if (gate != null && !gate.open && art != null) Sheen(Modifier.matchParentSize())
        // .home-personal-art:after: linear-gradient(0deg, #0b0e15f7, #0b0e1590 55%, #0b0e1522)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x220B0E15), .45f to Color(0x900B0E15), 1f to Color(0xF70B0E15))))
        Box(Modifier.matchParentSize().drawBehind { drawRect(Color(0x1FFFFFFF), Offset.Zero, Size(size.width, 1.dp.toPx())) }
            .border(1.dp, if (lead) cssGradient(155f, 0f to Color(0xE6F6D891), .30f to Color(0x59F1D08A), .55f to Color(0x14FFFFFF), .72f to Color(0x0AFFFFFF), 1f to Color(0x8CF1D08A))
                else cssGradient(155f, 0f to Color(0xB3F1D08A), .26f to Color(0x38FFFFFF), .52f to Color(0x12FFFFFF), .70f to Color(0x0AFFFFFF), 1f to Color(0x66F1D08A)), shape))
        content()
    }
}

private val tileShadow = Shadow(Color(0xBB000000), Offset(0f, 1f), 2f)

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
    val boxed = if (!missing) boxArt(homeArt(src)) else null
    val painter: Painter? = boxed?.painter
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
        if (painter != null && !missing) Image(painter, null, Modifier.matchParentSize().then(boxed?.fit ?: Modifier).alpha(if (ready) 1f else 0f), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.3f))
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
