package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.animation.core.animateFloat
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
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

// ---------------------------------------------------------------- the model (CollectionEngine.set: views.js setPage())

/** One card of the set grid: its row parts (art, foil, tier), "#1 Name", the price, what you own, the emblem dock; [i] is its data-set-i. */
class SetTileM(val r: CollRow, val i: Int, val label: String, val price: String, val badge: String?, val badgeOther: Boolean, val badgeTitle: String, val own: Boolean,
               val missing: Boolean, val emb: List<Pair<String, String>>, val set: String?, val rarity: String, val setTitle: String, val imp: SiteSvg?,
               /** Yu-Gi-Oh! / Pokémon: the card's id (data-act="tCard" data-id), its chrome, what kind of price it is ("Market ref."), its finish. */
               val id: String = "", val tcgEmb: List<TcgEmb> = emptyList(), val tcgSet: TcgSetBadge? = null, val priceNote: String = "", val tcgFinish: TcgFinish? = null,
               /** What the tile hands the card page (A.tCard's dataset): setId, setVariant, printing, edition. */
               val open: Map<String, String> = emptyMap())
/** tiles.js typePart: a Level / Rank star with its number, an Attribute or energy orb (the site's own svg), or "+1". */
class TcgEmb(val icon: SiteSvg?, val text: String, val label: String)
/** emblems.js tcgSetBadge: Yu-Gi-Oh!'s set code and rarity code ([tone] / [rarityKind] colour them); Pokémon's set and rarity symbols. */
class TcgSetBadge(val tone: String, val code: String, val rarity: String, val rarityKind: String, val symbol: List<String>, val mark: List<String>, val markInk: Boolean,
                  val markText: String, val markGold: Boolean, val title: String)
/** finish-preview.js's model for a Yu-Gi-Oh! or Pokémon tile: the recipe ([effect] / [treatment]), its masks, the Level-star foil, the frame. */
class TcgFinish(val effect: String, val treatment: String, val mask: String, val clip: String, val stars: Float, val frame: String)
class SetPack(val label: String, val sub: String, val disabled: Boolean, val act: String)

class CollectionSetModel(val code: String, val title: String, val line: String, val back: CardPress?, val atmosphere: List<String>, val icon: String, val progress: SetProgress?,
                         val pack: SetPack?, val error: String?, val retry: CardPress?, val searchValue: String, val searchPlaceholder: String, val filters: List<CollTab>,
                         val selects: List<CollSelect>, val views: List<CollView>, val mode: String, val results: String, val tiles: List<SetTileM>, val more: String,
                         val emptyTitle: String?, val emptyText: String, val busy: Boolean, val loaded: Boolean, val game: CardGame = CardGame.MTG,
                         /** Yu-Gi-Oh! / Pokémon: the set's artwork (img.set-logo.big) and Pokémon's set symbol before the name (img.pks.big, its addresses in turn). */
                         val logo: String = "", val symbol: List<String> = emptyList(),
                         /** p.set-coverage-note (what the card list covers) and its button; details.set-coverage-note (how the prices were picked). */
                         val coverage: String? = null, val coverageButton: CardPress? = null, val details: Pair<String, String>? = null) {
    companion object {
        private fun tcgTile(j: JsonObject): SetTileM {
            val pic = j.o("picture"); val fin = j.o("finish"); val c = j.o("chrome"); val set = c?.o("set"); val badge = j.o("badge"); val mark = set?.o("mark"); val rx = set?.o("rarity")
            val r = CollRow("set:" + j.s("id"), j.s("name"), false, j.s("tier").ifBlank { "tn" }, j.s("tierColor"), pic?.s("src")?.ifBlank { null }, pic?.strs("sources").orEmpty(),
                j.s("fallback"), fin?.s("key") ?: "", fin?.s("effect") ?: "", "", null, null, emptyList(), emptyList(), "", "", "", false, j.s("price"), "", "", "", 0, false, "")
            return SetTileM(r, -1, j.s("label"), j.s("price"), badge?.s("text"), badge?.b("other") ?: false, badge?.s("title") ?: "", j.b("own"), false, emptyList(), null, "", "", null,
                j.s("id"), c?.objs("emb").orEmpty().map { TcgEmb(CollectionCardsModel.svg(it.o("icon")), it.s("text"), it.s("label")) },
                set?.let { TcgSetBadge(it.s("tone"), it.s("code"), rx?.s("text") ?: "", rx?.s("kind") ?: "", it.strs("symbol"), mark?.strs("src").orEmpty(), mark?.b("ink") ?: false,
                    mark?.s("text") ?: "", mark?.b("gold") ?: false, it.s("title")) }, j.s("priceNote"),
                fin?.let { TcgFinish(it.s("effect"), it.s("treatment"), it.s("mask"), it.s("clip"), it.get("stars")?.takeIf { x -> x.isJsonPrimitive }?.asFloat ?: 0f, it.s("frame")) },
                j.o("open")?.entrySet()?.associate { (k, v) -> k to (if (v.isJsonPrimitive) v.asString else "") }.orEmpty())
        }

        private fun tile(j: JsonObject): SetTileM {
            val pic = j.o("picture"); val fin = j.o("finish"); val c = j.o("chrome"); val set = c?.o("set"); val badge = j.o("badge")
            val r = CollRow("set:" + j.get("i")?.asInt, j.s("name"), false, j.s("tier").ifBlank { "tn" }, j.s("tierColor"), pic?.s("src")?.ifBlank { null }, pic?.strs("sources").orEmpty(),
                j.s("fallback"), fin?.s("key") ?: "", fin?.s("effect") ?: "", "", null, null, emptyList(), emptyList(), "", "", "", false, j.s("price"), "", "", "", 0, false, "", j.o("print"))
            return SetTileM(r, j.get("i")?.takeIf { it.isJsonPrimitive }?.asInt ?: -1, j.s("label"), j.s("price"), badge?.s("text"), badge?.b("other") ?: false, badge?.s("title") ?: "",
                j.b("own"), j.b("missing"), c?.objs("emb").orEmpty().map { it.s("src") to it.s("alt") },
                set?.s("src")?.let { Regex("/sets/([^/.?]+)\\.svg").find(it)?.groupValues?.get(1) }, set?.s("rarity") ?: "common", set?.s("title") ?: "",
                CollectionCardsModel.svg(c?.o("imp")))
        }

        fun parse(j: JsonObject): CollectionSetModel {
            val pack = j.o("pack"); val err = j.o("error"); val empty = j.o("empty")
            return CollectionSetModel(j.s("code"), j.s("title"), j.s("line"), CollectionCardModel.press(j.o("back")), j.strs("atmosphere"), j.s("icon"),
                CollectionSetsModel.progress(j.o("progress")), pack?.let { SetPack(it.s("label"), it.s("sub"), it.b("disabled"), it.s("act")) },
                err?.s("text")?.ifBlank { null }, CollectionCardModel.press(err?.o("retry")), j.o("search")?.s("value") ?: "", j.o("search")?.s("placeholder") ?: "",
                j.objs("filters").map { CollTab(it.s("id"), it.s("label"), it.b("on"), null) }, j.objs("selects").mapNotNull { CollectionSetsModel.select(it) },
                j.objs("views").map { CollView(it.s("mode"), it.s("label"), it.b("on"), CollectionCardsModel.svg(it.o("icon"))) }, j.s("mode").ifBlank { "gallery" },
                j.s("results"), j.objs("tiles").map { if (it.s("act") == "tCard") tcgTile(it) else tile(it) }, j.s("more"), empty?.s("title"), empty?.s("text") ?: "", j.b("busy"), j.b("loaded"),
                CardGame.of(j.s("game")), j.s("logo"), j.strs("symbol"), j.o("coverage")?.s("text")?.ifBlank { null }, CollectionCardModel.press(j.o("coverage")?.o("button")),
                j.o("details")?.let { it.s("summary") to it.s("text") })
        }
    }
}

/** What the set page's controls do: search, Owned / Missing, the selects, the view and Show more are the site's own handlers in the engine. */
class CollectionSetActions(
    val game: (CardGame) -> Unit = {},
    /** "‹ All sets" (data-act="go" data-to="#sets"). */
    val back: () -> Unit = {},
    val search: (String) -> Unit = {},
    /** data-act="setFilter" data-id: all / owned / missing. */
    val filter: (String) -> Unit = {},
    /** data-change setRarity / setFinish / setSort. */
    val select: (name: String, value: String) -> Unit = { _, _ -> },
    val view: (String) -> Unit = {},
    val more: () -> Unit = {},
    /** A card (data-act="card" data-name data-set-i data-set-finish). */
    val card: (SetTileM) -> Unit = {},
    /** Open Pack · Simulator (data-act="openSetPack"). */
    val pack: () -> Unit = {},
    /** Try again. */
    val press: (CardPress) -> Unit = {},
)

private val GlassLine = Color(0x31EDC980)
private val GlassFill = Color(0x851F232B)
private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val LineC = Color(0xFF2A2F39)
private val Surface2 = Color(0xFF1F232B)
/** --gold: the open game's accent (LocalGameGold). */
private val GoldC: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current

// CSS line boxes: the whole line height on every line, the text centred in it (Compose trims the first and last by default).
private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color,
        lineHeightStyle = androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center, androidx.compose.ui.text.style.LineHeightStyle.Trim.None))
/** color-mix(in srgb, var(--tier) 70%, var(--text)): the price in its tier's colour. */
private fun tierInk(css: String): Color = cssColor(css, Color.Transparent)?.let { Color(it.red * .7f + Ink.red * .3f, it.green * .7f + Ink.green * .3f, it.blue * .7f + Ink.blue * .3f) } ?: Mute

// ---------------------------------------------------------------- the page

@Composable
fun CollectionSet(m: CollectionSetModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSetActions = CollectionSetActions(),
                  nav: @Composable (vertical: Boolean) -> Unit = {}, query: String = m.searchValue) {
    androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides m.game.gold) {
        BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
            val screen = maxWidth; val tall = maxHeight
            if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); SetPage(m, top, act, Modifier.weight(1f).fillMaxHeight(), screen, tall, query) }
            else Column(Modifier.fillMaxSize()) { SetPage(m, top, act, Modifier.weight(1f).fillMaxWidth(), screen, tall, query); nav(false) }
        }
    }
}

@Composable
private fun SetPage(m: CollectionSetModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSetActions, modifier: Modifier, screen: Dp, tall: Dp, query: String) {
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    val inner = screen - gutter * 2
    val reduced = Playmats.reduced(LocalContext.current)
    // .card-grid: repeat(auto-fill, minmax(140px, 1fr)) 10 apart; 160 from 600; 150 and 12 apart on a tablet-shaped screen (style.css 1961).
    val h = LocalConfiguration.current.screenHeightDp.toFloat().coerceAtLeast(tall.value)
    val tablet = (screen.value >= 680 && h >= 560 && screen.value / h >= .75f) || (screen.value >= 800 && h >= 560)
    val (minCol, gap) = when { tablet -> 150f to 12.dp; wide -> 160f to 10.dp; else -> 140f to 10.dp }
    val cols = ((inner.value + gap.value) / (minCol + gap.value)).toInt().coerceAtLeast(1)
    LazyColumn(modifier, contentPadding = PaddingValues(bottom = 28.dp)) {
        item(key = "top") {
            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                // As on Cards and Decks: the game tabs ride in the bar when there is room, and sit centred under it on a phone.
                top(if (wide) ({ GameTabs(m.game, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
            }
        }
        item(key = "hero") {
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 4.dp else 10.dp, bottom = if (wide) 16.dp else 12.dp)) {
                if (!wide) GameTabs(m.game, act.game, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                Hero(m, act, screen)
            }
        }
        item(key = "tools") {
            Column(Modifier.padding(horizontal = gutter)) {
                m.error?.let { WarnNote(it, m.retry, { m.retry?.let(act.press) }, Modifier.padding(bottom = 12.dp)) }
                m.coverage?.let { CoverageNote(it, m.coverageButton, act) }
                Toolbar(m, act, wide, query)
                // .set-results: "579 cards", 7 above and 8 below (the price details, when there are some, right under it).
                Text(m.results, Modifier.padding(top = 7.dp, bottom = 8.dp).heightIn(min = 15.dp), style = sans(11f, 400, Mute, lh = if (wide) 1.45f else 1.4f))
                m.details?.let { (summary, text) -> PriceDetails(summary, text) }
            }
        }
        when (m.mode) {
            "compact", "symbols" -> items(m.tiles, key = { "l:" + it.id.ifEmpty { it.i.toString() } }) { t ->
                Box(Modifier.padding(horizontal = gutter).padding(bottom = 8.dp)) { ListCard(t, m.mode == "compact", reduced, act) }
            }
            else -> {
                val lines = m.tiles.chunked(cols)
                items(lines, key = { line -> "g:" + line.joinToString("|") { it.id.ifEmpty { it.i.toString() } } }) { line ->
                    Row(Modifier.padding(horizontal = gutter).padding(bottom = if (line === lines.last()) 0.dp else gap).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
                        for (t in line) if (t.id.isNotEmpty()) TcgGridCard(t, m.game, reduced, act, Modifier.weight(1f).fillMaxHeight()) else GridCard(t, reduced, act, Modifier.weight(1f).fillMaxHeight())
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        m.emptyTitle?.let { t ->
            item(key = "empty") {
                Column(Modifier.fillMaxWidth().padding(horizontal = gutter, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(t, style = sans(17f, 700), textAlign = TextAlign.Center)
                    Text(m.emptyText, style = sans(14f, 400, Mute), textAlign = TextAlign.Center)
                }
            }
        }
        if (m.more.isNotBlank()) item(key = "more") { GhostBlock(m.more, Modifier.padding(horizontal = gutter).padding(top = 16.dp), act.more) }
    }
}

// ---------------------------------------------------------------- .set-hero.set-overview: identity, your progress, the pack simulator

@Composable
private fun Hero(m: CollectionSetModel, act: CollectionSetActions, screen: Dp) {
    val phone = screen < 600.dp
    val desk = screen >= 1000.dp
    val shape = RoundedCornerShape(if (phone) 18.dp else 22.dp)
    Box(Modifier.fillMaxWidth().clip(shape).background(Color(0xE0171A20)).border(1.dp, LineC, shape)) {
        SetAtmosphere(m.atmosphere, if (screen < 700.dp) .72f else .58f, if (screen < 700.dp) .2f else .3f, Modifier.matchParentSize())
        // CSS padding plus the 1 px border it sits inside.
        val pad = if (phone) PaddingValues(15.dp) else PaddingValues(horizontal = 21.dp, vertical = 19.dp)
        if (desk) Row(Modifier.padding(pad), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(22.dp)) {
            Identity(m, act, screen, Modifier.weight(1f))
            m.progress?.let { p ->
                Box(Modifier.widthIn(min = 210.dp, max = 280.dp).width(((screen.value - 40) * .3f).dp)
                    .drawBehind { drawLine(LineC, Offset(.5f, 0f), Offset(.5f, size.height), 1.dp.toPx()) }.padding(start = 22.dp)) { HeroProgress(p, phone) }
            }
            m.pack?.let { Pack(it, phone, Modifier.widthIn(max = 130.dp), act.pack) }
        } else Column(Modifier.padding(pad), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Identity(m, act, screen, Modifier.fillMaxWidth())
            if (m.progress != null || m.pack != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (phone) 12.dp else 18.dp)) {
                Box(Modifier.weight(1f)) { m.progress?.let { HeroProgress(it, phone) } }
                m.pack?.let { Pack(it, phone, Modifier, act.pack) }
            }
        }
    }
}

/** .set-identity: the set symbol (38, 52 from 600), "‹ All sets", the name in Cinzel and code · type · date. */
@Composable
private fun Identity(m: CollectionSetModel, act: CollectionSetActions, screen: Dp, modifier: Modifier) {
    val phone = screen < 600.dp
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (phone) 12.dp else 16.dp)) {
        if (m.icon.isNotBlank()) {
            val p = heroPainter(homeArt(m.icon))
            if (p != null) Image(p, null, Modifier.size(if (phone) 38.dp else 52.dp), colorFilter = ColorFilter.tint(Color(0xFFD9DCE2), BlendMode.SrcIn))
        }
        // .set-identity .set-logo.big: the set's artwork, contained in 58 × 48 (86 × 64 from 600); gone if it doesn't load (onerror remove).
        if (m.logo.isNotBlank()) {
            val p = heroPainter(homeArt(m.logo))
            val st = (p as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
            if (p != null && st !is coil3.compose.AsyncImagePainter.State.Error)
                Image(p, m.title + " set artwork", Modifier.size(if (phone) 58.dp else 86.dp, if (phone) 48.dp else 64.dp), contentScale = ContentScale.Fit)
        }
        Column(Modifier.weight(1f)) {
            m.back?.let { b ->
                Row(Modifier.clickable(onClick = act.back).semantics { role = Role.Button }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    SiteIcon(b.icon, 14.dp, GoldC)
                    Text(b.label, style = sans(13f, 600, GoldC))
                }
            }
            val size = if (screen >= 1000.dp) (screen.value * .021f).coerceIn(20f, 28f) else 20f
            val title = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, lineHeight = (size * 1.2f).sp, letterSpacing = (size * .02f).sp, color = Ink)
            // Pokémon: h1 img.pks.big, the set symbol (28, 4 before the name) in light ink.
            if (m.symbol.isNotEmpty()) Row(Modifier.padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                PkSymbol(m.symbol, 28.dp, Modifier.padding(end = 4.dp))
                Text(" " + m.title, style = title)
            } else Text(m.title, Modifier.padding(vertical = 5.dp), style = title)
            if (m.line.isNotBlank()) Text(m.line, style = sans(11f, 400, Mute, lh = 1.45f))
        }
    }
}

/** The set's .set-collection-progress inside the hero: "Your collection", "1 of 579 unique cards", the share in gold, the bar. */
@Composable
private fun HeroProgress(p: SetProgress, phone: Boolean) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                if (p.eyebrow.isNotBlank()) Text(p.eyebrow.uppercase(), Modifier.padding(bottom = if (phone) 4.dp else 6.dp), style = SetsEyebrow)
                Text(p.label, style = sans(if (phone) 11f else 12f, 400, Ink))
            }
            if (p.pct.isNotBlank()) {
                val s = if (phone) 23f else 26f
                Text(p.pct, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(650), fontSize = s.sp, letterSpacing = (-.04f * s).sp, color = GoldC, fontFeatureSettings = "tnum"))
            }
        }
        p.fill?.let { SetProgressBar(it, Modifier.padding(top = 10.dp)) }
        if (p.caption.isNotBlank()) Text(p.caption, Modifier.padding(top = 7.dp), style = sans(10f, 400, Mute, lh = 1.4f))
    }
}

/** .btn.ghost.set-open-pack: "Open Pack" over "Simulator" on a phone, side by side from 600 (wrapping at 130 on a desk). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Pack(p: SetPack, phone: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(11.dp)
    val base = modifier.clip(shape).background(GlassFill).border(1.dp, GlassLine, shape)
        .drawWithContent { drawContent(); drawRect(Color(0x12FFFFFF), size = Size(size.width, 1.dp.toPx())) }
        .clickable(enabled = !p.disabled, onClick = onClick).semantics { role = Role.Button }.alpha(if (p.disabled) .55f else 1f)
    // 8 / 10 of padding inside a 1 px border.
    if (phone) Column(base.padding(horizontal = 11.dp, vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(p.label, style = sans(12f, 700, Ink, lh = 1.45f))
        if (p.sub.isNotBlank()) Text(p.sub, style = sans(11f, 400, Mute, lh = 1.45f))
    } else FlowRow(base.heightIn(min = 44.dp).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.Center, itemVerticalAlignment = Alignment.CenterVertically) {
        Text(p.label, style = sans(15f, 700, Ink))
        if (p.sub.isNotBlank()) Text(p.sub, style = sans(11f, 400, Mute))
    }
}

// ---------------------------------------------------------------- .set-card-toolbar: search, All / Owned / Missing, rarity, finish, order, the view

@Composable
private fun Toolbar(m: CollectionSetModel, act: CollectionSetActions, wide: Boolean, query: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Search(query, m.searchPlaceholder, act.search, Modifier.fillMaxWidth())
        if (wide) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlideStrip(m.filters, 13.5f, 6.dp, grow = false, onPick = act.filter)
            for (s in m.selects) GlassSelect(s, { v -> act.select(s.name, v) }, Modifier.weight(1f))
            ViewSwitch(m.views, act.view)
        } else Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            // Under 600 a two-column grid: the segments on their own line, then the selects two by two and the view switch at the end.
            GlideStrip(m.filters, 13.5f, 6.dp, grow = false, onPick = act.filter)
            val cells: List<CollSelect?> = m.selects + listOf(null)
            for (line in cells.chunked(2)) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                for (c in line) if (c != null) GlassSelect(c, { v -> act.select(c.name, v) }, Modifier.weight(1f))
                    else Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) { ViewSwitch(m.views, act.view) }
                if (line.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

// ---------------------------------------------------------------- the cards

/**
 * A gallery card (.set-grid .grid-card): the card in its price band (7.5 wide, 12 corners; a still silver 5 when it has no price)
 * with its aura, the emblem dock clipped on its foot, what you own clipped on its top edge; "#1 Name" and the price under it.
 */
@Composable
private fun GridCard(t: SetTileM, reduced: Boolean, act: CollectionSetActions, modifier: Modifier) {
    val tn = t.r.tier == "tn"
    Column(modifier.then(if (t.own) Modifier.drawWithContent {
        drawContent()
        val w = 2.dp.toPx(); drawRect(Color(0x8C6FD29A), topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w), style = Stroke(w))
    } else Modifier)) {
        Box {
            TierFrame(t.r.tier, reduced, Modifier.fillMaxWidth().clickable { act.card(t) }.semantics { contentDescription = "Open ${t.r.name}" },
                fw = if (tn) 5.dp else 7.5.dp, corner = if (tn) null else 12.dp, blur = 18f, plain = tn) { framed ->
                val fw = if (!framed) 0.dp else if (tn) 5.dp else 7.5.dp
                Box(Modifier.fillMaxSize().padding(fw)) {
                    RowPicture(t.r, Modifier.fillMaxSize(), if (tn) RoundedCornerShape(percent = 4) else RoundedCornerShape((12.dp - fw).coerceAtLeast(2.dp)))
                }
                TileDock(t.emb, t.set, t.rarity, t.setTitle, t.imp, Modifier.align(Alignment.BottomStart).offset(y = 6.dp).padding(start = 10.75.dp, end = 6.dp), h = 18.dp)
            }
            t.badge?.let { Badge(it, t.badgeOther, t.badgeTitle, Modifier.align(Alignment.TopEnd).offset(y = (-9).dp).padding(end = 8.dp)) }
        }
        // .grid-meta: 7 under the card (and the grid's 4), the label cut short, the price in its tier's colour.
        Row(Modifier.padding(top = 11.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(t.label, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(12f, 400, Mute))
            Text(t.price, style = sans(12f, 400, if (tn) Mute else tierInk(t.r.tierColor)).copy(fontFeatureSettings = "tnum"))
        }
    }
}

/** .owned-badge: "×2" in green on a small dark glass chip ("other ed." in grey for a different printing you own). */
@Composable
private fun Badge(text: String, other: Boolean, title: String, modifier: Modifier) {
    val shape = RoundedCornerShape(10.dp)
    Box(modifier.heightIn(min = 18.dp).clip(shape).background(Color(0xCC0A0C12))
        .drawWithContent {
            drawRect(Brush.verticalGradient(0f to Color(0x1CFFFFFF), .55f to Color(0x03FFFFFF)))
            drawContent()
            drawRoundRect(if (other) Color(0x26FFFFFF) else Color(0x555FD39A), cornerRadius = androidx.compose.ui.geometry.CornerRadius(10.dp.toPx()),
                topLeft = Offset(.5.dp.toPx(), .5.dp.toPx()), size = Size(size.width - 1.dp.toPx(), size.height - 1.dp.toPx()), style = Stroke(1.dp.toPx()))
        }.semantics { if (title.isNotBlank()) contentDescription = title }.padding(horizontal = 7.dp), contentAlignment = Alignment.Center) {
        Text(text, style = sans(if (other) 10.5f else 11f, 800, if (other) Color(0xFFCFD5DE) else Color(0xFF8FF0B8), lh = 1.45f))
    }
}

/** The Compact and List views: a row in the collection's ring, the art (Compact only), name and price, then the emblem chips; the count at its foot. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ListCard(t: SetTileM, compact: Boolean, reduced: Boolean, act: CollectionSetActions) {
    Box(Modifier.fillMaxWidth().lotFrame(t.r, reduced).clickable { act.card(t) }.semantics { contentDescription = "Open ${t.r.name}" }) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (compact) Box(Modifier.size(48.dp, 67.dp).clip(RoundedCornerShape(5.dp)).background(Surface2)) { RowPicture(t.r, Modifier.fillMaxSize(), RoundedCornerShape(5.dp)) }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(t.label, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(15f, 650, Mute, lh = 1.5f))
                    Text(t.price, style = sans(13f, 700, tierInk(t.r.tierColor), lh = 1.5f).copy(fontFeatureSettings = "tnum"))
                }
                if (t.emb.isNotEmpty() || t.set != null || t.imp != null) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp),
                    itemVerticalAlignment = Alignment.CenterVertically) {
                    val chip = Modifier.height(24.dp).clip(RoundedCornerShape(10.dp)).background(Ink.copy(alpha = .07f)).padding(horizontal = 8.dp)
                    if (t.emb.isNotEmpty()) Row(chip, horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                        t.emb.forEach { (src, alt) -> Mana(src, alt) }
                    }
                    t.set?.let { code -> Box(chip.semantics { contentDescription = t.setTitle }, contentAlignment = Alignment.Center) { RaritySetIcon(code, t.rarity, 15.dp) } }
                    t.imp?.let { Box(chip, contentAlignment = Alignment.Center) { SiteIcon(it, 16.dp, Ink) } }
                }
            }
        }
        t.badge?.let { Badge(it, t.badgeOther, t.badgeTitle, Modifier.align(Alignment.BottomEnd).padding(end = 10.dp, bottom = 8.dp)) }
    }
}

// ---------------------------------------------------------------- Yu-Gi-Oh! and Pokémon (tcg.js tcgSet)

/** p.set-coverage-note: what the card list covers, 12 in --muted (1.65 lines, 4 in, 6 above and below), its button inline in --gold. */
@Composable
private fun CoverageNote(text: String, button: CardPress?, act: CollectionSetActions) {
    val gold = GoldC
    val s = androidx.compose.ui.text.buildAnnotatedString {
        append(text)
        if (button != null) {
            append(" ")
            withLink(androidx.compose.ui.text.LinkAnnotation.Clickable("cover", linkInteractionListener = { act.press(button) })) {
                withStyle(androidx.compose.ui.text.SpanStyle(color = gold, fontWeight = FontWeight(600), fontSize = 13.sp)) { append(button.label.replace(' ', '\u00A0')) }
            }
        }
    }
    Text(s, Modifier.padding(horizontal = 4.dp).padding(bottom = 6.dp), style = sans(12f, 400, Mute, lh = 1.65f))
}

/** details.set-coverage-note: "▸ Price details" in 12 --muted, 4 in; open, the note under it. */
@Composable
private fun PriceDetails(summary: String, text: String) {
    var open by androidx.compose.runtime.saveable.rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    Column(Modifier.padding(horizontal = 4.dp)) {
        Text((if (open) "\u25BE " else "\u25B8 ") + summary, Modifier.clickable { open = !open }.semantics { role = Role.Button }, style = sans(12f, 400, Mute, lh = 1.65f))
        if (open) Text(text, style = sans(12f, 400, Mute, lh = 1.65f))
    }
}

/** filter: invert(1) hue-rotate(180deg): black ink to white, colours kept (img.pks, img.pkr.ink). */
private val InkFlip = androidx.compose.ui.graphics.ColorMatrix(floatArrayOf(
    .574f, -1.43f, -.144f, 0f, 255f,
    -.426f, -.43f, -.144f, 0f, 255f,
    -.426f, -1.43f, .856f, 0f, 255f,
    0f, 0f, 0f, 1f, 0f))

/** The first of [sources] that loads, or null once none has (the site's onerror chain). */
@Composable
internal fun firstOf(sources: List<String>): androidx.compose.ui.graphics.painter.Painter? {
    var i by remember(sources) { androidx.compose.runtime.mutableIntStateOf(0) }
    val p = heroPainter(sources.getOrNull(i)?.let(homeArt))
    val st = (p as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
    androidx.compose.runtime.LaunchedEffect(st, i) { if (st is coil3.compose.AsyncImagePainter.State.Error && i < sources.size) i++ }
    return if (i < sources.size) p else null
}

/** img.pks: a Pokémon set symbol, [size] square, in light ink with its 1 px drop shadow. */
@Composable
internal fun PkSymbol(sources: List<String>, size: Dp, modifier: Modifier = Modifier, ink: Boolean = true, glow: Boolean = false, height: Dp = size) {
    val p = firstOf(sources) ?: return
    Box(modifier.height(height).then(if (size == height) Modifier.width(size) else Modifier.widthIn(max = size))) {
        if (ink) Image(p, null, Modifier.matchParentSize().offset(y = 1.dp).alpha(.5f), contentScale = ContentScale.Fit, colorFilter = ColorFilter.tint(Color.Black, BlendMode.SrcIn))
        Image(p, null, Modifier.then(if (size == height) Modifier.matchParentSize() else Modifier.height(height)).then(if (glow) Modifier.drawBehind {
            drawCircle(Brush.radialGradient(listOf(Color(0x88FFD54A), Color.Transparent)), size.toPx() / 2)
        } else Modifier), contentScale = ContentScale.Fit, colorFilter = if (ink) ColorFilter.colorMatrix(InkFlip) else null)
    }
}

/**
 * style.css .tset small.rx-code: Yu-Gi-Oh!'s rarity code in the foil its name is printed in: Super's ice glow, Rare's silver,
 * Ultra and Gold Ultra's gold, Ultimate's antique gold, Secret and Prismatic's pastel holo, Ghost and Platinum's platinum, and
 * Starlight, Collector's and Quarter Century's rainbow sweeping across every 3.2 s; Common plain.
 */
@Composable
internal fun RxCode(text: String, kind: String, size: Float, reduced: Boolean) {
    val base = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(800), fontSize = size.sp, lineHeight = (size * 1.2f).sp, letterSpacing = (size * .02f).sp,
        lineHeightStyle = androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center, androidx.compose.ui.text.style.LineHeightStyle.Trim.None))
    fun stops(vararg s: Pair<Float, Long>) = s.map { (o, c) -> o to Color(c) }
    val (deg, cols) = when (kind) {
        "rare" -> 180f to stops(0f to 0xFFFFFFFF, 1f to 0xFFA9B3C2)
        "ultra", "gold" -> 100f to stops(.15f to 0xFFC99A2E, .35f to 0xFFFFE58A, .45f to 0xFFFFF8D6, .55f to 0xFFFFE58A, .75f to 0xFFC99A2E)
        "ultimate" -> 100f to stops(.15f to 0xFF9C7425, .35f to 0xFFE9C96A, .45f to 0xFFFFF1C2, .55f to 0xFFE9C96A, .75f to 0xFF9C7425)
        "secret", "prismatic" -> 115f to stops(.10f to 0xFFDFE6EE, .25f to 0xFFFFB3E6, .40f to 0xFFA8F0FF, .55f to 0xFFFFF1A6, .70f to 0xFFDFE6EE)
        "ghost", "platinum" -> 100f to stops(.20f to 0xFFB7C0CC, .40f to 0xFFFFFFFF, .60f to 0xFFB7C0CC)
        "starlight", "collector", "quarter" -> 100f to stops(.10f to 0xFFFF9DE1, .25f to 0xFFFFE08A, .40f to 0xFF9DFFB8, .55f to 0xFF8AD7FF, .70f to 0xFFC8A0FF, .85f to 0xFFFF9DE1)
        else -> 0f to emptyList()
    }
    when {
        kind == "super" -> Text(text, style = base.copy(color = Color(0xFFE9FBFF), shadow = androidx.compose.ui.graphics.Shadow(Color(0x997FF6FF), blurRadius = 6f * androidx.compose.ui.platform.LocalDensity.current.density)))
        cols.isEmpty() -> Text(text, style = base.copy(color = Mute))
        else -> {
            // background-size 250% 100%: the gradient runs across 2.5 × the code; the rainbow ones slide it one full length left every 3.2 s.
            val sweep = kind in setOf("starlight", "collector", "quarter") && !reduced
            val shift = if (sweep) androidx.compose.animation.core.rememberInfiniteTransition("rx").animateFloat(0f, 1f,
                androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(3200, easing = androidx.compose.animation.core.LinearEasing)), "rx").value else 0f
            val brush = remember(kind, shift) { object : androidx.compose.ui.graphics.ShaderBrush() {
                override fun createShader(size: Size): androidx.compose.ui.graphics.Shader {
                    val w = size.width * 2.5f; val h = size.height; val a = Math.toRadians(deg.toDouble())
                    val dx = kotlin.math.sin(a).toFloat(); val dy = -kotlin.math.cos(a).toFloat()
                    val half = (kotlin.math.abs(w * dx) + kotlin.math.abs(h * dy)) / 2
                    val cx = w / 2 - shift * w; val cy = h / 2
                    return androidx.compose.ui.graphics.LinearGradientShader(Offset(cx - dx * half, cy - dy * half), Offset(cx + dx * half, cy + dy * half),
                        cols.map { it.second }, cols.map { it.first }, androidx.compose.ui.graphics.TileMode.Repeated)
                }
            } }
            Text(text, style = base.copy(brush = brush))
        }
    }
}

/** The pill look of the tile dock (ui.js tileChrome as the Cards tab draws it): dark glass, a light top edge, a soft shadow under it. */
private fun Modifier.dockPill(start: Boolean, end: Boolean, h: Dp) = this
    .drawBehind { drawRect(Color(0x30000000), topLeft = Offset(0f, 2.dp.toPx()), size = size) }
    .height(h).clip(RoundedCornerShape(topStart = if (start) 10.dp else 0.dp, bottomStart = if (start) 10.dp else 0.dp, topEnd = if (end) 10.dp else 0.dp, bottomEnd = if (end) 10.dp else 0.dp))
    .background(Brush.verticalGradient(0f to Color(0xE62F3138), .55f to Color(0xD50E1016), 1f to Color(0xCC0A0C12)))
    .drawWithContent { drawContent(); drawRect(Color(0x24FFFFFF), size = Size(size.width, 1.dp.toPx())) }

/**
 * tiles.js tileChrome for Yu-Gi-Oh! and Pokémon, flush on the card's foot like Magic's: the Level / Rank star and its number with
 * the Attribute orb (or the energy orbs) in one pill; the set code and the rarity code (or the set and rarity symbols) in the next,
 * joined by a gold hairline.
 */
@Composable
private fun TcgDock(emb: List<TcgEmb>, set: TcgSetBadge?, reduced: Boolean, modifier: Modifier, h: Dp = 18.dp) {
    if (emb.isEmpty() && set == null) return
    val both = emb.isNotEmpty() && set != null
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (emb.isNotEmpty()) Row(Modifier.dockPill(true, !both, h).padding(start = 6.dp, end = 5.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
            for (e in emb) EmbItem(e)
        }
        set?.let { b ->
            Row(Modifier.dockPill(!both, true, h).drawWithContent {
                drawContent()
                if (both) drawRect(Brush.verticalGradient(listOf(Color(0x00F4BF58), Color(0xA0F4BF58), Color(0x00F4BF58))), topLeft = Offset(0f, 5.dp.toPx()), size = Size(1.dp.toPx(), size.height - 10.dp.toPx()))
            }.semantics { contentDescription = b.title }.padding(horizontal = 6.dp), horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                SetBadgeParts(b, reduced, 9.5f, 8.5f, 15.dp, 10.dp)
            }
        }
    }
}

/** One emblem: the orb (13) or the Level star (13) with its number in 11 / 800 white. */
@Composable
private fun EmbItem(e: TcgEmb) {
    if (e.icon == null) { Text(e.text, style = sans(10f, 700, Ink)); return }
    if (e.text.isBlank()) { SiteIcon(e.icon, 13.dp, Ink); return }
    Row(Modifier.semantics { if (e.label.isNotBlank()) contentDescription = e.label }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        SiteIcon(e.icon, 13.dp, Ink)
        Text(e.text, style = sans(11f, 800, Color.White, lh = 1.2f))
    }
}

/** The set badge's parts: Yu-Gi-Oh!'s code (bold, [code] sp) and rarity code ([rx] sp); Pokémon's set symbol ([sym]) and rarity mark ([mark] tall). */
@Composable
private fun SetBadgeParts(b: TcgSetBadge, reduced: Boolean, code: Float, rx: Float, sym: Dp, mark: Dp) {
    if (b.symbol.isNotEmpty()) PkSymbol(b.symbol, sym)
    when {
        b.mark.isNotEmpty() -> PkSymbol(b.mark, 28.dp, ink = b.markInk, glow = !b.markInk, height = mark)
        b.markText.isNotBlank() -> Text(b.markText, style = sans(rx + 1f, 700, if (b.markGold) Color(0xFFFFD54A) else Ink, lh = 1.2f))
    }
    if (b.code.isNotBlank() && b.symbol.isEmpty()) Text(b.code, style = sans(code, 700, Color.White, lh = 1.2f))
    if (b.rarity.isNotBlank()) RxCode(b.rarity, b.rarityKind, rx, reduced)
}

/** finish-preview.js's model as the app's foil layer (foil/FoilLayer.kt): Yu-Gi-Oh!'s recipe on its frame, Pokémon's treatment in its masks. */
internal fun tcgFinishOf(context: android.content.Context, game: CardGame, f: TcgFinish, art: String): dev.cardstashy.nativeplay.foil.CardFinish? =
    if (game == CardGame.YGO) f.effect.takeIf { it in dev.cardstashy.nativeplay.foil.YgoFoil.RECIPES }?.let {
        dev.cardstashy.nativeplay.foil.CardFinish.Ygo(it, art, dev.cardstashy.nativeplay.foil.YgoFoil.layoutOf(f.frame), f.stars) }
    else f.treatment.takeIf { it in dev.cardstashy.nativeplay.foil.PtcgFoil.RECIPES && f.mask.isNotBlank() }?.let { tr ->
        val masks = runCatching { dev.cardstashy.nativeplay.foil.PtcgFoil.Masks.load(context) }.getOrNull()
        if (masks?.shape(f.mask) == null) null
        else dev.cardstashy.nativeplay.foil.CardFinish.Ptcg(tr, f.mask, art, f.clip.takeIf { c -> c.isNotBlank() && masks.shape(c) != null }, f.clip.isNotBlank())
    }

/** A Yu-Gi-Oh! / Pokémon card's picture with its foil (finish-preview.js → foil/FoilLayer.kt), walking its picture's addresses. */
@Composable
private fun TcgPicture(t: SetTileM, game: CardGame, modifier: Modifier, shape: androidx.compose.ui.graphics.Shape) {
    val p = firstOf(t.r.artSources.ifEmpty { listOfNotNull(t.r.art) })
    if (p == null) { Box(modifier.clip(shape).background(Surface2), contentAlignment = Alignment.Center) { Text(t.r.fallback.ifBlank { "◇" }, style = sans(10f, 400, Mute)) }; return }
    val context = LocalContext.current
    val f = t.tcgFinish
    val finish = remember(f, t.r.art) { f?.let { tcgFinishOf(context, game, it, t.r.art ?: "") } }
    val tilt = if (finish != null) rememberFoilTilt(live = true, phase = (t.r.name.hashCode() and 0xff) / 255f, tile = true) else null
    CardFace(p, null, tilt, modifier, shape, desc = null, finish = finish)
}

/**
 * A Yu-Gi-Oh! or Pokémon card of the set grid: the card (59:86 for Yu-Gi-Oh!) in its price band with its aura and foil, the dock on
 * its foot, what you own on its top edge; under it the number and name (Yu-Gi-Oh!: in full, then the price in bold and "Market
 * ref."; Pokémon: cut short beside the price).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TcgGridCard(t: SetTileM, game: CardGame, reduced: Boolean, act: CollectionSetActions, modifier: Modifier) {
    val tn = t.r.tier == "tn"
    val ygo = game == CardGame.YGO
    Column(modifier.then(if (t.own) Modifier.drawWithContent {
        drawContent()
        val w = 2.dp.toPx(); drawRect(Color(0x8C6FD29A), topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w), style = Stroke(w))
    } else Modifier)) {
        Box {
            TierFrame(t.r.tier, reduced, Modifier.fillMaxWidth().clickable { act.card(t) }.semantics { contentDescription = "Open ${t.r.name}" },
                fw = if (tn) 5.dp else 7.5.dp, corner = if (tn) null else 12.dp, blur = 18f, plain = tn, ratio = if (ygo) 59f / 86f else 63f / 88f) { framed ->
                val fw = if (!framed) 0.dp else if (tn) 5.dp else 7.5.dp
                Box(Modifier.fillMaxSize().padding(fw)) {
                    TcgPicture(t, game, Modifier.fillMaxSize(), if (tn) RoundedCornerShape(percent = 4) else RoundedCornerShape((12.dp - fw).coerceAtLeast(2.dp)))
                }
                TcgDock(t.tcgEmb, t.tcgSet, reduced, Modifier.align(Alignment.BottomStart).offset(y = 6.dp).padding(start = 10.75.dp, end = 6.dp))
            }
            t.badge?.let { Badge(it, t.badgeOther, t.badgeTitle, Modifier.align(Alignment.TopEnd).offset(y = (-9).dp).padding(end = 8.dp)) }
        }
        val ink = if (tn) Mute else tierInk(t.r.tierColor)
        if (ygo) Column(Modifier.padding(top = 11.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            // .ygo-set-meta: the number and name wrap (1.4 lines); the price in bold with what it is beside it (7 apart).
            Text(t.label, style = sans(12f, 400, Mute, lh = 1.4f))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(3.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                Text(t.price, style = sans(12f, 700, ink).copy(fontFeatureSettings = "tnum"))
                if (t.priceNote.isNotBlank()) Text(t.priceNote, style = sans(11f, 400, Mute))
            }
        } else Row(Modifier.padding(top = 11.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(t.label, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(12f, 400, Mute))
            Text(t.price + if (t.priceNote.isNotBlank()) " " + t.priceNote else "", style = sans(12f, 400, ink).copy(fontFeatureSettings = "tnum"))
        }
    }
}

