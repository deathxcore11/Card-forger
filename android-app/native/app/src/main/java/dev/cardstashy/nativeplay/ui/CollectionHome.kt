package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * Collection Home, ported from the site's home (views.js home(), tcg.js tcgHome(), home-ui.js): the Card of the Day art
 * header with the search dock, the collection at a glance (homeValueModel), your decks (homeDeckShelf: the last worked
 * deck first, then two more), the random tools, the format's top decks (homeMetaCarousel) and the news (homeEdition).
 * Three layouts from one model: upright phone, sideways (handhelds, a phone on its side) and unfolded / tablet.
 */

enum class CardGame(val id: String, val label: String) { MTG("mtg", "Magic"), PTCG("ptcg", "Pokémon"), YGO("ygo", "Yu-Gi-Oh!") }

data class CollectionHomeData(
    val game: CardGame,
    val dailyArt: Any?, val dailyName: String, val dailySet: String,
    /** homeValueModel(): amount, note, movement line and its direction (up / down / flat / ""). */
    val amount: String, val note: String, val movement: String, val direction: String, val copies: Int, val decks: Int,
    val shelf: List<ShelfDeck>,
    val metaFormat: String, val meta: List<MetaDeck>,
    val news: List<NewsItem>,
)
data class ShelfDeck(val name: String, val format: String, val cards: Int, val art: Any?, val edited: String? = null)
data class MetaDeck(val name: String, val share: String, val art: Any?, val colors: String = "")
data class NewsItem(val title: String, val source: String, val date: String, val category: String, val art: Any?)

class CollectionHomeActions(
    val game: (CardGame) -> Unit = {}, val search: () -> Unit = {}, val ask: () -> Unit = {}, val daily: () -> Unit = {},
    val value: () -> Unit = {}, val cards: () -> Unit = {}, val decks: () -> Unit = {}, val deck: (ShelfDeck) -> Unit = {},
    val randomCard: () -> Unit = {}, val randomDeck: () -> Unit = {}, val meta: (MetaDeck) -> Unit = {}, val news: (NewsItem) -> Unit = {},
)

enum class CollectionTab(val label: String) { HOME("Home"), CARDS("Collection"), SEARCH("Search"), DECKS("Decks"), SCAN("Scan") }

@Composable
fun CollectionHome(d: CollectionHomeData, top: @Composable () -> Unit, act: CollectionHomeActions = CollectionHomeActions(), nav: @Composable (vertical: Boolean) -> Unit = {}) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val side = sideways()
        val wide = !side && maxWidth >= 600.dp
        val tall = maxHeight
        if (side) Row(Modifier.fillMaxSize()) {
            // Sideways (handhelds, a phone on its side): the nav becomes a rail so the height goes to content; the art header
            // owns the left, the scrolling content the right.
            nav(true)
            Box(Modifier.fillMaxHeight().weight(1f)) {
                // The art melts into the page like the upright header does: it runs on behind the content column and fades
                // out sideways and at the foot, so there's no hard edge down the middle (Randall 4 Nov 20:27Z).
                SideArt(d, Modifier.fillMaxHeight().fillMaxWidth(.7f))
                Row(Modifier.fillMaxSize()) {
                    Box(Modifier.fillMaxHeight().weight(.46f)) { Header(d, act, top, Modifier.fillMaxSize(), compact = true, drawArt = false) }
                    Column(Modifier.fillMaxHeight().weight(.54f).verticalScroll(rememberScrollState()).windowInsetsPadding(WindowInsets.statusBars)
                        .padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        ValueCard(d, act); Shelf(d, act, columns = 3, lead = 124.dp, small = 96.dp); RandomRow(act); Meta(d, act); News(d, act, compact = true)
                    }
                }
            }
        } else Column(Modifier.fillMaxSize()) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // Unfolded / tablet: a taller header, then everything runs full width so no column is left half empty.
                Header(d, act, top, Modifier.fillMaxWidth().height(if (wide) (tall * .4f).coerceIn(340.dp, 520.dp) else 420.dp), compact = false)
                Box(Modifier.fillMaxWidth().padding(horizontal = if (wide) 24.dp else 16.dp), contentAlignment = Alignment.TopCenter) {
                    Column(Modifier.widthIn(max = if (wide) 1040.dp else 640.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(if (wide) 20.dp else 14.dp)) {
                        if (wide) {
                            Row(Modifier.height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                ValueCard(d, act, Modifier.weight(1.6f).fillMaxHeight())
                                Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Chip("Random card", Modifier.fillMaxWidth().weight(1f), act.randomCard); Chip("Random deck", Modifier.fillMaxWidth().weight(1f), act.randomDeck)
                                }
                            }
                            Shelf(d, act, columns = 3, lead = 210.dp, small = 132.dp)
                            Meta(d, act); News(d, act, compact = false)
                        } else { ValueCard(d, act); Shelf(d, act, columns = 2); RandomRow(act); Meta(d, act); News(d, act, compact = false) }
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
            nav(false)
        }
    }
}

// ---------------------------------------------------------------- the art header (home-hero + home-today + search dock)

@Composable
private fun Header(d: CollectionHomeData, act: CollectionHomeActions, top: @Composable () -> Unit, modifier: Modifier, compact: Boolean, drawArt: Boolean = true) {
    val art = if (drawArt) heroPainter(d.dailyArt) else null
    Box(modifier.clip(if (compact) RoundedCornerShape(0.dp) else RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp))) {
        if (art != null) Image(art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.2f))
        else if (drawArt) Box(Modifier.fillMaxSize().background(Site.Surface))
        if (drawArt) Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x8C000000), .28f to Color.Transparent, .55f to Color(0x66000000), 1f to Color(0xF20B0D11))))
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top() }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = if (compact) 16.dp else 22.dp),
            verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 12.dp)) {
            GameSwitch(d.game, act.game)
            Text("Your cards. Your next adventure.", style = Site.Title.copy(fontSize = if (compact) 22.sp else 28.sp, lineHeight = if (compact) 26.sp else 32.sp, color = Color(0xFFF8F0DC)))
            SearchDock(act)
            // Card of the Day: the credit for the art behind it, and a door to that card.
            Row(Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = act.daily).padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("CARD OF THE DAY", style = Site.Label.copy(color = Color(0xFFE8B95B), letterSpacing = .14.sp, fontWeight = FontWeight.Bold))
                Text(d.dailyName, style = Site.Label.copy(color = Color(0xFFF1F3F6), fontSize = 13.sp, fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                Text(d.dailySet, style = Site.Label.copy(color = Color(0xB3F1F3F6)), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** Sideways: the Card of the Day art as a backdrop that fades into the page on the right and at the foot, under the words. */
@Composable
private fun SideArt(d: CollectionHomeData, modifier: Modifier) {
    val art = heroPainter(d.dailyArt) ?: return
    val bg = Site.Bg
    Box(modifier) {
        Image(art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.2f))
        // Words stay readable: dark at the top (status bar) and lower left (title, search), clear in the middle of the art.
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x8C000000), .3f to Color.Transparent, .6f to bg.copy(alpha = .55f), 1f to bg.copy(alpha = .96f))))
        // The melt: art thins out across the right third into the page colour, with a soft start so there's no seam.
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(0f to bg, .07f to bg.copy(alpha = .45f), .18f to Color.Transparent, .5f to Color.Transparent,
            .72f to bg.copy(alpha = .6f), .88f to bg.copy(alpha = .92f), 1f to bg)))
    }
}

@Composable
private fun GameSwitch(game: CardGame, onGame: (CardGame) -> Unit) {
    Row(Modifier.clip(CircleShape).background(Color(0x66000000)).border(1.dp, Color(0x26FFFFFF), CircleShape).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        CardGame.entries.forEach { g ->
            val on = g == game
            Box(Modifier.height(30.dp).clip(CircleShape).background(if (on) Color(0xFFE8B95B) else Color.Transparent).clickable { onGame(g) }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                Text(g.label, style = Site.Label.copy(color = if (on) Color(0xFF1B1406) else Color(0xE6F1F3F6), fontWeight = FontWeight.Bold, fontSize = 13.sp))
            }
        }
    }
}

/** home-search: one glass field for cards, decks and rules, with Ask (the AI wiki) at its end. */
@Composable
private fun SearchDock(act: CollectionHomeActions) {
    Row(Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x99101318)).border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(14.dp)),
        verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.weight(1f).fillMaxHeight().clickable(onClick = act.search).padding(start = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(SiteIcons.Search, 20.dp, Color(0xCCF1F3F6))
            Text("Search cards, decks and rules", style = Site.Meta.copy(color = Color(0xB3F1F3F6)), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Box(Modifier.padding(5.dp).fillMaxHeight().clip(RoundedCornerShape(10.dp)).background(Brush.verticalGradient(listOf(Color(0xFFF2CF7E), Color(0xFFC9963A))))
            .clickable(onClick = act.ask).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
            Text("Ask", style = Site.Label.copy(color = Color(0xFF1B1406), fontWeight = FontWeight.ExtraBold, fontSize = 14.sp))
        }
    }
}

// ---------------------------------------------------------------- your collection at a glance (homeValue)

@Composable
private fun ValueCard(d: CollectionHomeData, act: CollectionHomeActions, modifier: Modifier = Modifier) = Panel(modifier) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).clickable(onClick = act.value), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("YOUR COLLECTION", style = Site.Eyebrow.copy(fontSize = 11.sp))
            Text(d.amount, style = Site.CardTitle.copy(fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.ExtraBold, fontFeatureSettings = "tnum"))
            Text(d.note, style = Site.Label)
            if (d.movement.isNotEmpty()) Text(d.movement, style = Site.Label.copy(fontWeight = FontWeight.Bold,
                color = when (d.direction) { "up" -> Color(0xFF6FD39A); "down" -> Color(0xFFFF8A7A); else -> Site.Muted }))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Count("%,d".format(d.copies), "cards", act.cards); Count("%,d".format(d.decks), "decks", act.decks)
        }
    }
}

@Composable
private fun Count(n: String, label: String, onClick: () -> Unit) =
    Column(Modifier.widthIn(min = 64.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Text(n, style = Site.Count.copy(fontSize = 18.sp)); Text(label, style = Site.Label)
    }

// ---------------------------------------------------------------- your decks (homeDeckShelf)

@Composable
private fun Shelf(d: CollectionHomeData, act: CollectionHomeActions, columns: Int, lead: Dp = 150.dp, small: Dp = 112.dp) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitle("Your decks", "All decks", act.decks)
        val first = d.shelf.firstOrNull()
        if (first == null) { Panel { Text("No saved decks yet.", style = Site.Body); Text("Build one from your cards, copy a tournament list, or roll a random deck.", style = Site.Meta) }; return@Column }
        DeckTile(first, Modifier.fillMaxWidth().height(lead), big = true) { act.deck(first) }
        val rest = d.shelf.drop(1).take(columns)
        if (rest.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            rest.forEach { deck -> DeckTile(deck, Modifier.weight(1f).height(small), big = false) { act.deck(deck) } }
            repeat(columns - rest.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

@Composable
private fun DeckTile(deck: ShelfDeck, modifier: Modifier, big: Boolean, onClick: () -> Unit) {
    val art = heroPainter(deck.art)
    val shape = RoundedCornerShape(16.dp)
    Box(modifier.clip(shape).background(Site.Surface).border(1.dp, Site.GlassLine, shape).clickable(onClick = onClick)) {
        if (art != null) Image(art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.3f))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.25f to Color.Transparent, 1f to Color(0xE60B0D11))))
        Column(Modifier.align(Alignment.BottomStart).padding(if (big) 16.dp else 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (big && deck.edited != null) Text("LAST WORKED ON", style = Site.Label.copy(color = Color(0xFFE8B95B), fontWeight = FontWeight.Bold, letterSpacing = .14.sp))
            Text(deck.name, style = (if (big) Site.CardTitle else Site.Body.copy(fontWeight = FontWeight.Bold, fontSize = 14.sp)).copy(color = Color(0xFFF8F0DC)), maxLines = if (big) 1 else 2, overflow = TextOverflow.Ellipsis)
            Text(listOfNotNull(deck.format, "${deck.cards} cards", if (big) deck.edited?.let { "Edited $it" } else null).joinToString(" · "),
                style = Site.Label.copy(color = Color(0xCCF1F3F6)), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

// ---------------------------------------------------------------- random tools, top decks, news

@Composable
private fun RandomRow(act: CollectionHomeActions) = Row(Modifier.height(48.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Chip("Random card", Modifier.weight(1f), act.randomCard); Chip("Random deck", Modifier.weight(1f), act.randomDeck)
}

@Composable
private fun Chip(label: String, modifier: Modifier, onClick: () -> Unit) =
    Row(modifier.heightIn(min = 48.dp).clip(RoundedCornerShape(14.dp)).background(Site.Surface).border(1.dp, Site.GlassLine, RoundedCornerShape(14.dp)).clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
        Dice(18.dp); Text(label, style = Site.Button.copy(fontSize = 14.sp))
    }

/** A die face in gold, drawn (no emoji). */
@Composable
private fun Dice(size: Dp) = androidx.compose.foundation.Canvas(Modifier.size(size)) {
    val r = this.size.minDimension
    drawRoundRect(Color(0xFFE8B95B), cornerRadius = androidx.compose.ui.geometry.CornerRadius(r * .22f), style = androidx.compose.ui.graphics.drawscope.Stroke(r * .1f))
    for ((x, y) in listOf(.3f to .3f, .7f to .7f, .5f to .5f, .7f to .3f, .3f to .7f)) drawCircle(Color(0xFFE8B95B), r * .08f, androidx.compose.ui.geometry.Offset(r * x, r * y))
}

@Composable
private fun Meta(d: CollectionHomeData, act: CollectionHomeActions) {
    if (d.meta.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitle("Top decks · ${d.metaFormat}")
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            // Room for every tile at 150 dp: a full-width grid. Otherwise a rail that peeks the next tile so it reads as scrollable.
            val fits = maxWidth >= 150.dp * d.meta.size + 10.dp * (d.meta.size - 1)
            Row(if (fits) Modifier.fillMaxWidth() else Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                d.meta.forEach { m -> MetaTile(m, if (fits) Modifier.weight(1f).height(118.dp) else Modifier.width(150.dp).height(96.dp)) { act.meta(m) } }
            }
        }
    }
}

@Composable
private fun MetaTile(m: MetaDeck, modifier: Modifier, onClick: () -> Unit) {
    val art = heroPainter(m.art); val shape = RoundedCornerShape(14.dp)
    Box(modifier.clip(shape).background(Site.Surface).border(1.dp, Site.GlassLine, shape).clickable(onClick = onClick)) {
        if (art != null) Image(art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.2f to Color.Transparent, 1f to Color(0xE60B0D11))))
        Column(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
            Text(m.name, style = Site.Label.copy(color = Color(0xFFF8F0DC), fontWeight = FontWeight.Bold, fontSize = 13.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(m.share, style = Site.Label.copy(color = Color(0xCCF1F3F6)))
        }
    }
}

@Composable
private fun News(d: CollectionHomeData, act: CollectionHomeActions, compact: Boolean) {
    val n = d.news.firstOrNull() ?: return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitle("News")
        val art = heroPainter(n.art); val shape = RoundedCornerShape(16.dp)
        Column(Modifier.fillMaxWidth().clip(shape).background(Site.Surface).border(1.dp, Site.GlassLine, shape).clickable { act.news(n) }) {
            if (art != null && !compact) Image(art, null, Modifier.fillMaxWidth().aspectRatio(2.2f), contentScale = ContentScale.Crop)
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(n.category.uppercase(), style = Site.Label.copy(color = Color(0xFFE8B95B), fontWeight = FontWeight.Bold, letterSpacing = .12.sp))
                Text(n.title, style = Site.Body.copy(fontWeight = FontWeight.Bold), maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text("${n.source} · ${n.date}", style = Site.Label)
            }
        }
    }
}

@Composable
private fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) =
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Site.Surface).border(1.dp, Site.GlassLine, RoundedCornerShape(18.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), content = content)

/** Collection's bottom nav (index.html .bottom-nav): Home first, as in Play, so Home is one tap from everywhere. Sideways it
 *  stands up as a rail on the left edge, so the short screen height goes to the content. Scan only where there's a camera
 *  to scan with, never in game mode (Randall 4 Nov: handhelds have no cameras). */
@Composable
fun CollectionNav(active: CollectionTab?, vertical: Boolean = false, scan: Boolean = !vertical && hasCamera(), onSelect: (CollectionTab) -> Unit) {
    val icons = mapOf(CollectionTab.HOME to SiteIcons.House, CollectionTab.CARDS to SiteIcons.CardStack, CollectionTab.SEARCH to SiteIcons.Search,
        CollectionTab.DECKS to SiteIcons.Decks, CollectionTab.SCAN to SiteIcons.Scan)
    val tabs = CollectionTab.entries.filter { it != CollectionTab.SCAN || scan }
    @Composable fun item(t: CollectionTab, modifier: Modifier) {
        val on = t == active
        Column(modifier.clickable { onSelect(t) }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically)) {
            Box(Modifier.size(56.dp, 30.dp).clip(RoundedCornerShape(15.dp)).background(if (on) Site.Gold.copy(alpha = .2f) else Color.Transparent), contentAlignment = Alignment.Center) {
                Icon(icons.getValue(t), 22.dp, if (on) Site.Gold else Site.Muted)
            }
            Text(t.label, style = Site.Label.copy(color = if (on) Site.Text else Site.Muted, fontSize = if (vertical) 11.sp else Site.Label.fontSize), maxLines = 1)
        }
    }
    if (vertical) Column(Modifier.fillMaxHeight().width(76.dp).background(Site.Bg).windowInsetsPadding(WindowInsets.statusBars).padding(vertical = 6.dp)) {
        tabs.forEach { t -> item(t, Modifier.fillMaxWidth().weight(1f)) }
    } else Row(Modifier.fillMaxWidth().background(Color(0xF00C0E13)).navigationBarsPadding().height(72.dp)) {
        tabs.forEach { t -> item(t, Modifier.weight(1f).fillMaxHeight()) }
    }
}

@Composable
private fun hasCamera(): Boolean {
    val context = androidx.compose.ui.platform.LocalContext.current
    return androidx.compose.runtime.remember { context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA_ANY) }
}
