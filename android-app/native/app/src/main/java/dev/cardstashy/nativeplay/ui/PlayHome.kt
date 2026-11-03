package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.ui.BiasAlignment
import androidx.compose.runtime.collectAsState
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.produceState
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.animateFloatAsState
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.play.SetFacts

/**
 * The Play homepage, block for block as the live site's (play-home.js playHomeMarkup + play-menu.js
 * mode cards + play-deeds-ui.js): the PLAY title with the mastery ring, the purse, the four mode
 * cards, the Story card, Today and Achievements, Your packs and the Forge, Your decks and Your
 * collection, then the Merchant. Copy, order and numbers are the web's; look is play-menu.css.
 */
data class PlayHomeData(
    val state: JsonObject,
    val rules: PlayRules,
    val story: PlayMath.StoryHome,
    val day: String,
    val user: String = "",
    /** The site's glass ambient: the Collection home's hero art (today's card), blurred behind every page. */
    val ambient: String? = null,
    /** GET /api/progress/achievements when it has answered; the golden-tested PlayMath until then. */
    val deeds: JsonObject? = null,
)

class PlayHomeActions(
    val mode: (String) -> Unit = {},          // social / quick / practice / planeswalk
    val story: () -> Unit = {},
    val view: (String) -> Unit = {},          // deeds / packs / decks / collection / shop / finder
    val claim: (kind: String, id: String) -> Unit = { _, _ -> },
    val claimDeed: (id: String, step: Int) -> Unit = { _, _ -> },
    val forge: (to: String, times: Int) -> Unit = { _, _ -> },
    val openPack: (id: String) -> Unit = {},
    val buy: (code: String) -> Unit = {},
    val deck: (id: String) -> Unit = {},
    val set: (code: String) -> Unit = {},
)

// play-menu.css tokens for the Play side.
private object P {
    val Ink = Color(0xFFF6EEDB)
    val Copy = Color(0xFFD6DBE2)
    val Gold = Color(0xFFE8B95B)
    val GoldSoft = Color(0xFFE9CF93)
    val CtaEdge = Color(0xFFF6DFA8); val CtaTop = Color(0xFFF2D18E); val CtaBottom = Color(0xFFC99A4B); val CtaInk = Color(0xFF1B1408)
    val RowBg = Color(0x0DFFFFFF); val RowLine = Color(0x1AFFFFFF)
    val CardLine = Color(0xFF5B4D33)          // color-mix(gold 22-26%, line)
    val Muted = Color(0xFF9AA2B1)
    val Sans = Type.Sans
    val h2 = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, letterSpacing = .02.em, color = Color(0xFFF1EDE4))
    val link = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Gold)
    val shadow = Shadow(Color(0xCC000000), Offset(0f, 4f), 28f)
}

private val MODE_ART = mapOf(
    "social" to "https://cards.scryfall.io/art_crop/front/5/a/5a7241f5-4d69-47fe-b037-95037008184c.jpg?1783934878",
    "quick" to "https://cards.scryfall.io/art_crop/front/4/1/4101e3fe-b0e7-4f0f-b9ac-9b61a4d628b3.jpg?1783912843",
    "practice" to "https://cards.scryfall.io/art_crop/front/c/a/ca10e2b8-a317-4c98-a866-43bf274e82cb.jpg?1783931052",
    "planeswalk" to "https://cards.scryfall.io/art_crop/front/a/8/a83ca3a1-82a9-4f47-b0b8-21687afd705b.jpg?1783931174")
private val MODE_FOCUS = mapOf("social" to BiasAlignment(0f, -.3f), "quick" to BiasAlignment(.16f, -.2f), "practice" to BiasAlignment(.04f, -.1f), "planeswalk" to BiasAlignment(0f, -.76f))
private const val BUILD_ART = "https://cards.scryfall.io/art_crop/front/f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg"
const val FORGE_ART_NAME = "Great Furnace"

/** Art for the home: an in-memory bitmap (screenshots) or a URL through the Coil cache. [art] maps a URL to what to load. */
var homeArt: (String) -> Any? = { it }

@Composable
private fun Art(url: String?, modifier: Modifier, align: Alignment = Alignment.Center, scale: ContentScale = ContentScale.Crop, filter: ColorFilter = artFilter) {
    val p: Painter? = heroPainter(url?.let(homeArt))
    if (p != null) androidx.compose.foundation.Image(p, null, modifier, alignment = align, contentScale = scale, colorFilter = filter)
    else Box(modifier.background(Color(0xFF121318)))
}

private val artFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(1.12f) })

@Composable
fun PlayHome(d: PlayHomeData, top: @Composable () -> Unit, act: PlayHomeActions = PlayHomeActions(), nav: @Composable () -> Unit) {
    val s = d.state
    val purse = PlayMath.purse(s) ?: return
    val level = PlayMath.mastery(s, purse.xp)
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Ambient(d.ambient)
        Column(Modifier.fillMaxSize()) {
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                val wide = maxWidth >= 600.dp; val duo = maxWidth >= 1000.dp
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 72.dp + statusTop(), bottom = 28.dp, start = 16.dp, end = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(26.dp)) {
                    item("head") {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Play", style = Site.Display.copy(fontSize = 34.sp, letterSpacing = .04.em), modifier = Modifier.weight(1f))
                                LevelRing(level, framed = true)
                            }
                            PurseRow(purse, onCoins = { act.view("shop") }, onSeals = { act.view("shop") }, onPacks = { act.view("packs") })
                        }
                    }
                    item("modes") { Modes(wide, act) }
                    item("story") { StoryCard(d, wide, act) }
                    item("today") { Duo(duo, { Today(d, act) }, { Deeds(d, act) }) }
                    item("packs") { Duo(duo, { Packs(s, act) }, { Forge(s, act) }) }
                    item("decks") { Duo(duo, { Decks(s, wide, act) }, { Collection(s, act) }) }
                    if ((s.getAsJsonArray("shop")?.size() ?: 0) > 0) item("shop") { Merchant(s, act) }
                }
                // The site's sticky glass top bar.
                Box(Modifier.fillMaxWidth().background(Color(0xD90C0E13)).drawBehind {
                    drawLine(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x80D6AD64), Color.Transparent)), Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
                }.statusBarsPadding()) { top() }
            }
            nav()
        }
    }
}

@Composable private fun statusTop(): Dp = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

/**
 * body.glass #ambient (style.css): the hero art blurred 42 px, saturate 1.35, brightness .5, at 85 %,
 * under the game-colour glows and the dark wash. One layer for the whole page.
 */
@Composable
fun Ambient(art: String?) {
    Box(Modifier.fillMaxSize()) {
        if (art != null) Art(art, Modifier.fillMaxSize().scale(1.08f).androidx_blur(42.dp).graphicsLayer { alpha = .85f }, BiasAlignment(0f, -.4f), filter = ambientFilter)
        Box(Modifier.fillMaxSize().drawBehind {
            val game = Color(0xFFF08A5D)
            drawRect(Brush.radialGradient(listOf(game.copy(alpha = .26f), Color.Transparent), center = Offset(size.width * .85f, 0f), radius = size.width * .8f))
            drawRect(Brush.radialGradient(listOf(game.copy(alpha = .16f), Color.Transparent), center = Offset(0f, size.height), radius = size.width * .7f))
            drawRect(Brush.verticalGradient(0f to Color(0x590A0C10), .6f to Color(0xC70A0C10), 1f to Color(0xEB0A0C10)))
        })
    }
}

private val ambientFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(1.35f); timesAssign(ColorMatrix(floatArrayOf(.5f,0f,0f,0f,0f, 0f,.5f,0f,0f,0f, 0f,0f,.5f,0f,0f, 0f,0f,0f,1f,0f))) })
private fun Modifier.androidx_blur(r: Dp) = this.blur(r, androidx.compose.ui.draw.BlurredEdgeTreatment.Rectangle)

/** The Play page's backdrop without art (signed out, loading): --bg. */
fun Modifier.playBackdrop() = this.background(Site.Bg)

@Composable
private fun Duo(two: Boolean, a: @Composable () -> Unit, b: @Composable () -> Unit) {
    if (two) Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) { Box(Modifier.weight(1f)) { a() }; Box(Modifier.weight(1f)) { b() } }
    else Column(verticalArrangement = Arrangement.spacedBy(26.dp)) { a(); b() }
}

// ---------------------------------------------------------------- purse (pe-purse, full width on phones)

@Composable
internal fun PurseRow(p: PlayMath.Purse, onCoins: () -> Unit, onSeals: () -> Unit, onPacks: () -> Unit) {
    Row(Modifier.fillMaxWidth().shadow(10.dp, CircleShape).clip(CircleShape).background(Color(0xB80D0F14))
        .border(1.dp, Color(0xFF6A5838), CircleShape).padding(4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceEvenly) {
        PurseCell(onCoins, "${p.coins} coins") { Icon(SiteIcons.Coin, 18.dp); Num(p.coins) }
        PurseCell(onSeals, "Seals") {
            for (k in listOf("c", "u", "r", "m")) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { Icon(SiteIcons.Seals.getValue(k), 18.dp); Num(p.seals[k] ?: 0) }
        }
        PurseCell(onPacks, "${p.packs} packs") { Icon(SiteIcons.Pack, 18.dp); Num(p.packs) }
    }
}

@Composable private fun PurseCell(onClick: () -> Unit, label: String, content: @Composable () -> Unit) =
    Row(Modifier.height(44.dp).clip(CircleShape).clickable(onClick = onClick).semantics { contentDescription = label }.padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { content() }

@Composable private fun Num(n: Int, size: Int = 14) = Text("%,d".format(n), style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = size.sp, color = P.Ink, fontFeatureSettings = "tnum"), maxLines = 1, softWrap = false)

// ---------------------------------------------------------------- gold CTA (pl-mode-cta / pe-buy / pd-claim)

@Composable
fun GoldCta(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, muted: Boolean = false, radius: Dp = 13.dp, leading: (@Composable () -> Unit)? = null, onClick: () -> Unit) {
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    val k by animateFloatAsState(if (pressed) .96f else 1f, Site.spring(), label = "cta")
    val shape = RoundedCornerShape(radius)
    Row(modifier.scale(k).heightIn(min = 44.dp).shadow(if (enabled) 10.dp else 0.dp, shape, spotColor = P.CtaBottom).clip(shape)
        .background(if (enabled) Brush.verticalGradient(listOf(P.CtaTop, P.CtaBottom)) else if (muted) Brush.verticalGradient(listOf(Color(0xFFB3A88F), Color(0xFF8C8370))) else Brush.verticalGradient(listOf(Color(0xFF2A2620), Color(0xFF1C1A16))))
        .border(1.dp, if (enabled) P.CtaEdge else if (muted) Color(0x55FFFFFF) else Color(0x33D6AD64), shape)
        .let { if (enabled) it.clickable(press, null, onClick = onClick) else it }.padding(horizontal = 22.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
        leading?.invoke()
        Text(label, style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, letterSpacing = .03.em, color = if (enabled) P.CtaInk else if (muted) Color(0xFF26221B) else Color(0x99D6AD64)), maxLines = 1, softWrap = false)
    }
}

/** .btn.cs-plate: the bevelled gold plate with an inner line and diamonds either side of a Cinzel label (Story's Begin). */
@Composable
fun GoldPlate(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    val k by animateFloatAsState(if (pressed) .96f else 1f, Site.spring(), label = "plate")
    val shape = RoundedCornerShape(10.dp)
    Box(modifier.scale(k).height(56.dp).shadow(14.dp, shape, spotColor = Color(0xFF8A6A2A)).clip(shape)
        .background(Brush.verticalGradient(listOf(Color(0xFFF4DA9C), Color(0xFFE2BC6C), Color(0xFFC9973F))))
        .clickable(press, null, onClick = onClick).drawBehind {
            val i = 4.dp.toPx()
            drawRoundRect(Color(0x5E6B4515), Offset(i, i), Size(size.width - 2 * i, size.height - 2 * i), androidx.compose.ui.geometry.CornerRadius(7.dp.toPx()), style = Stroke(1.dp.toPx()))
            drawLine(Color(0x99FFFFFF), Offset(10f, 1.5f), Offset(size.width - 10f, 1.5f), 1.dp.toPx())
        }.padding(horizontal = 30.dp), contentAlignment = Alignment.Center) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Diamond(); Text(label, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 19.sp, letterSpacing = .08.em, color = Color(0xFF3A2708)), maxLines = 1); Diamond()
        }
    }
}

@Composable private fun Diamond() = Box(Modifier.size(7.dp).rotate(45f).background(Color(0xFF4A3410)))

// ---------------------------------------------------------------- mode cards (pl-modes)

@Composable
private fun Modes(wide: Boolean, act: PlayHomeActions) {
    val modes = listOf(
        Triple("social", "Multiplayer", "Your deck against a friend's.") to "Invite",
        Triple("quick", "Quick Play", "Your deck against a matched CPU.") to "Play",
        Triple("practice", "Practice", "Any two decks, head to head.") to "Set up",
        Triple("planeswalk", "Planeswalk", "Climb Innistrad. Take down Sorin.") to "Open")
    val rows = if (wide) modes.chunked(2) else modes.map { listOf(it) }
    Column(verticalArrangement = Arrangement.spacedBy(if (wide) 18.dp else 12.dp)) {
        rows.forEach { r -> Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            r.forEach { (m, cta) -> ModeCard(m.first, m.second, m.third, cta, wide, Modifier.weight(1f)) { act.mode(m.first) } }
        } }
    }
}

@Composable
private fun ModeCard(key: String, name: String, copy: String, cta: String, wide: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(if (wide) 22.dp else 18.dp)
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    val k by animateFloatAsState(if (pressed) .98f else 1f, Site.spring(), label = "mode")
    Box(modifier.scale(k).heightIn(min = if (wide) 300.dp else 200.dp).shadow(22.dp, shape).clip(shape).background(Color(0xFF121318))
        .clickable(press, null, onClick = onClick).semantics { contentDescription = name }) {
        // Planeswalk's old scan is zoomed to trim its black frame (pl-mode-art--trim).
        Art(MODE_ART[key], Modifier.matchParentSize().let { if (key == "planeswalk") it.scale(1.16f) else it }, MODE_FOCUS[key] ?: Alignment.Center)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x000C0C0E), .34f to Color(0x000C0C0E), .66f to Color(0xB80C0C0E), 1f to Color(0xF20C0C0E))))
        Box(Modifier.matchParentSize().background(Brush.radialGradient(.55f to Color.Transparent, 1f to Color(0x8C0C0C0E))))
        Box(Modifier.matchParentSize().border(if (key == "quick") 1.5.dp else 1.dp, if (key == "quick") Brush.linearGradient(listOf(Color(0x40E8B95B), P.Gold, Color(0xFFFFF3D0), P.Gold, Color(0x40E8B95B))) else Brush.linearGradient(listOf(P.CardLine, P.CardLine)), shape))
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(start = if (wide) 22.dp else 16.dp, end = if (wide) 22.dp else 16.dp, bottom = if (wide) 22.dp else 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = if (wide) 28.sp else 24.sp, letterSpacing = .03.em, color = P.Ink, shadow = P.shadow))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(copy, style = TextStyle(fontFamily = P.Sans, fontSize = 14.sp, lineHeight = 21.sp, color = P.Copy), modifier = Modifier.weight(1f).padding(end = 12.dp, bottom = if (wide) 0.dp else 2.dp))
                GoldCta(cta, onClick = onClick)
            }
        }
    }
}

// ---------------------------------------------------------------- Story (pe-story)

@Composable
private fun StoryCard(d: PlayHomeData, wide: Boolean, act: PlayHomeActions) {
    val a = d.rules.acts.firstOrNull { it.act == d.story.act } ?: d.rules.acts.first()
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.fillMaxWidth().heightIn(min = if (wide) 360.dp else 320.dp).shadow(24.dp, shape).clip(shape).background(Color(0xFF101218)).border(1.dp, P.CardLine, shape)) {
        Art(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0f to Color(0xF2090B10), .38f to Color(0xC0090B10), .7f to Color(0x30090B10))))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.45f to Color.Transparent, 1f to Color(0xD0090B10))))
        val copy = @Composable { m: Modifier ->
            Column(m, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("STORY · ACT ${a.act}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = .16.em, color = P.GoldSoft))
                Text(a.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = if (wide) 36.sp else 30.sp, lineHeight = if (wide) 40.sp else 33.sp, color = Color(0xFFFBF3DF), shadow = P.shadow))
                Text("${a.years}. ${a.line}", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, lineHeight = 22.sp, color = Color(0xFFDFE3EA)))
                Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (i in 0 until a.battles) { val boss = i == a.battles - 1; val on = i < d.story.won
                        Box(Modifier.size(if (boss) 30.dp else 22.dp, 8.dp).clip(CircleShape).background(if (on) P.Gold else Color(0x26FFFFFF))
                            .border(1.dp, if (on) P.Gold else if (boss) Color(0x88D6AD64) else Color(0x22FFFFFF), CircleShape)) }
                }
                GoldPlate(if (d.story.done) "Replay" else if (d.story.won > 0) "Continue" else "Begin", onClick = act.story)
            }
        }
        val packs = @Composable { m: Modifier, w: Dp ->
            Row(m, horizontalArrangement = Arrangement.spacedBy(if (wide) 24.dp else 14.dp), verticalAlignment = Alignment.Bottom) {
                a.sets.forEachIndexed { i, (code, name) ->
                    Booster(code, name, Modifier.width(if (i == 1) w * 1.18f else w).rotate(listOf(-4f, 0f, 4f).getOrElse(i) { 0f }), mini = true)
                }
            }
        }
        if (wide) Row(Modifier.matchParentSize().padding(32.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            copy(Modifier.weight(1f).widthIn(max = 560.dp)); packs(Modifier, 100.dp)
        } else Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            packs(Modifier.align(Alignment.CenterHorizontally), 96.dp); copy(Modifier)
        }
    }
}

// ---------------------------------------------------------------- booster wrapper (pe-booster)

@Composable
fun Booster(code: String, name: String?, modifier: Modifier = Modifier, mini: Boolean = false) {
    val facts: Map<String, SetFacts.Set> = SetFacts.sets.collectAsState().value
    val f = facts[code]
    val label = name?.ifBlank { null } ?: f?.name ?: code.uppercase()
    wrapperFor(code)?.let { (asset, wrap) ->
        val ctx = LocalContext.current
        val img = produceState(AssetImages.cached("$asset@600"), asset) { value = AssetImages.load(ctx, asset, maxWidth = 600) }.value
        if (img != null) { WrappedBooster(code, label, wrap, img, modifier, mini); return }
    }
    val shape = RoundedCornerShape(6.dp)
    Box(modifier.aspectRatio(5f / 8.2f).shadow(18.dp, shape).clip(shape)
        .background(Brush.linearGradient(listOf(Color(0xFF2A2F3A), Color(0xFF14171D), Color(0xFF262B35))))) {
        // Art window: from the crimp to 30 % above the bottom.
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val h = maxHeight; val w = maxWidth
            val dens = LocalDensity.current; val px = with(dens) { w.toPx() }
            val sp = { f: Float -> with(dens) { (px * f).toSp() } }
            Box(Modifier.padding(top = h * .055f, bottom = h * .30f).fillMaxSize()) {
                if (f?.art?.isNotBlank() == true) Art(f.art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
                else Box(Modifier.matchParentSize().background(Brush.radialGradient(listOf(Color(0xFF3B4152), Color(0xFF15181F)))))
                Box(Modifier.matchParentSize().background(Brush.verticalGradient(.55f to Color.Transparent, 1f to Color(0xFF0C0E13))))
            }
            // The band: set icon in gold, Cinzel name, PLAY BOOSTER.
            Column(Modifier.align(Alignment.BottomCenter).padding(bottom = h * .055f).fillMaxWidth().heightIn(min = h * (if (mini) .2f else .25f))
                .background(Brush.verticalGradient(listOf(Color(0xFF0C0E13), Color(0xFF1B1F28)))).drawBehind { drawLine(Color(0x66D6AD64), Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }
                .padding(horizontal = 8.dp, vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically)) {
                SetIcon(code, Modifier.size(minOf(w * .22f, 30.dp)))
                if (!mini) {
                    Text(label.uppercase(), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(.07f), lineHeight = sp(.082f), letterSpacing = .02.em, color = P.Ink, textAlign = TextAlign.Center), maxLines = 2)
                    Text("PLAY BOOSTER", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = sp(.05f), letterSpacing = .14.em, color = Color(0xFFD6AD64)), maxLines = 1)
                }
            }
            // Crimped foil edges top and bottom.
            Crimp(Modifier.align(Alignment.TopCenter).fillMaxWidth().height(h * .055f))
            Crimp(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(h * .055f))
        }
        // Sheen.
        Box(Modifier.matchParentSize().background(Brush.linearGradient(.3f to Color.Transparent, .45f to Color(0x26FFFFFF), .6f to Color.Transparent)))
        Box(Modifier.matchParentSize().border(1.dp, Color(0x1FFFFFFF), shape))
    }
}

/** Randall's pack wrappers (art piece 16): where each wrapper's black band sits, as fractions of its height. */
class Wrap(val aspect: Float, val notch: Float, val top: Float, val bottom: Float, val iconInNotch: Boolean = false)
val WRAPPERS = mapOf(
    "hob" to Wrap(600f / 1029f, notch = .636f, top = .672f, bottom = .868f),
    "fra" to Wrap(600f / 918f, notch = .641f, top = .676f, bottom = .892f),
)

/**
 * Randall's seven theme wrappers (3 Nov, "by set theme"): one painted template, notch emblem at 70 %,
 * name band 76 to 87 %. A set whose world fits a theme wears it; every other set takes one in turn
 * (stable per set code), so no pack is ever bare.
 */
private val THEME_WRAP = Wrap(320f / 497f, notch = .70f, top = .752f, bottom = .871f, iconInNotch = true)
val THEMES = listOf("desert-ruins", "dragon-hoard", "vampire-castle", "elf-forest", "shire-hill", "ghost-ship-swamp", "dwarf-forge")
/** Randall 3 Nov: each theme wrapper belongs to one set only. Every other set keeps its foil pack with its own art. */
val SET_THEME: Map<String, String> = mapOf("hob" to "shire-hill", "mh2" to "dwarf-forge")
fun themeFor(code: String): String? = SET_THEME[code.lowercase()]
/** The wrapper a set wears: its own painted pack, else its theme wrapper, else none (the foil pack with the set's art). */
fun wrapperFor(code: String): Pair<String, Wrap>? = WRAPPERS[code.lowercase()]?.let { "play/pack-${code.lowercase()}.webp" to it }
    ?: themeFor(code)?.let { "play/wrap-$it.webp" to THEME_WRAP }

/**
 * A wrapper pack: the painted foil wrapper, and on its black band the gold star emblem in the notch,
 * the set symbol in gold, the set name in Cinzel and PLAY BOOSTER, all moving as one with the sheen.
 */
@Composable
private fun WrappedBooster(code: String, label: String, wrap: Wrap, img: ImageBitmap, modifier: Modifier, mini: Boolean) {
    Box(modifier.aspectRatio(5f / 8.2f), contentAlignment = Alignment.BottomCenter) {
        BoxWithConstraints(Modifier.fillMaxWidth().aspectRatio(wrap.aspect, matchHeightConstraintsFirst = true)
            .graphicsLayer { shadowElevation = 14.dp.toPx(); shape = RoundedCornerShape(4.dp); clip = false }) {
            val w = maxWidth; val h = maxHeight
            Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
            // The star emblem, centred in the band's notch.
            if (wrap.iconInNotch) SetIcon(code, Modifier.align(Alignment.TopCenter).offset(y = h * wrap.notch - w * .05f).size(w * .1f))
            else StarEmblem(Modifier.align(Alignment.TopCenter).offset(y = h * wrap.notch - w * .045f).size(w * .09f))
            // Printed on the wrapper, so it sizes with the pack, not with the font setting.
            val dens = LocalDensity.current
            val px = with(dens) { w.toPx() }
            val sp = { f: Float -> with(dens) { (px * f).toSp() } }
            Column(Modifier.align(Alignment.TopCenter).offset(y = h * wrap.top).fillMaxWidth().height(h * (wrap.bottom - wrap.top)).padding(horizontal = w * .1f),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(w * .018f, Alignment.CenterVertically)) {
                if (!wrap.iconInNotch) SetIcon(code, Modifier.size(w * (if (mini) .2f else .1f)))
                if (!mini) {
                    Text(label.uppercase(), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(.062f), lineHeight = sp(.072f), letterSpacing = .02.em, color = P.Ink, textAlign = TextAlign.Center), maxLines = 2)
                    Text("PLAY BOOSTER", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = sp(.046f), letterSpacing = .14.em, color = Color(0xFFD6AD64)), maxLines = 1)
                }
            }
            // Sheen across wrapper and lettering alike.
            Box(Modifier.matchParentSize().background(Brush.linearGradient(.32f to Color.Transparent, .45f to Color(0x1AFFFFFF), .58f to Color.Transparent)))
        }
    }
}

/** The six-pointed star in a ring that every wrapper carries at the top of its band. */
@Composable
private fun StarEmblem(modifier: Modifier) = androidx.compose.foundation.Canvas(modifier) {
    val gold = Brush.linearGradient(listOf(Color(0xFFFFF0B8), Color(0xFFE0AC48), Color(0xFFFFF4CF), Color(0xFFC58A2C)), Offset.Zero, Offset(size.width, size.height))
    val c = center; val r = size.minDimension / 2f
    drawCircle(Color(0xFF0C0E13), r)
    drawCircle(gold, r * .9f, style = androidx.compose.ui.graphics.drawscope.Stroke(r * .1f))
    for (k in 0..1) {
        val path = androidx.compose.ui.graphics.Path()
        for (i in 0..2) {
            val a = Math.toRadians(-90.0 + k * 60 + i * 120)
            val x = c.x + r * .62f * kotlin.math.cos(a).toFloat(); val y = c.y + r * .62f * kotlin.math.sin(a).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close(); drawPath(path, gold)
    }
}

@Composable private fun Crimp(m: Modifier) = Box(m.drawBehind {
    val w = 3.dp.toPx(); var x = 0f; var i = 0
    while (x < size.width) { drawRect(if (i % 2 == 0) Color(0xE6D9DDE3) else Color(0xE68C939E), Offset(x, 0f), Size(w, size.height)); x += w; i++ }
})

/** The set's icon in the wrapper gold (masked like the web's pe-booster-icon). */
@Composable
fun SetIcon(code: String, modifier: Modifier, tint: Color = Color(0xFFE9C878)) {
    val p = heroPainter(SetFacts.icon(code).let(homeArt))
    if (p != null) Image(p, null, modifier, colorFilter = ColorFilter.tint(tint, BlendMode.SrcIn))
}


// ---------------------------------------------------------------- shelves

@Composable
private fun Shelf(title: String, link: String?, onLink: () -> Unit, content: @Composable ColumnScope.() -> Unit) = Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = P.h2, modifier = Modifier.weight(1f))
        if (link != null) Box(Modifier.heightIn(min = 44.dp).clickable(onClick = onLink).padding(horizontal = 6.dp), contentAlignment = Alignment.Center) { Text(link, style = P.link, maxLines = 1) }
    }
    content()
}

@Composable
private fun Bar(frac: Float, thin: Boolean = false, modifier: Modifier = Modifier) = Box(modifier.fillMaxWidth().height(if (thin) 5.dp else 8.dp).clip(CircleShape).background(Color(0xFF1F2430))) {
    Box(Modifier.fillMaxWidth(frac.coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(Color(0xFFE2B866)))
}

private val rowShape = RoundedCornerShape(14.dp)
private fun Modifier.rowGlass() = this.clip(rowShape).background(P.RowBg).border(1.dp, P.RowLine, rowShape)

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun Rewards(r: PlayRules.Reward, column: Boolean = false) {
    val items = buildList<@Composable () -> Unit> {
        if (r.coins > 0) add { Icon(SiteIcons.Coin, 16.dp); Num(r.coins, 13) }
        r.seals.filter { it.value > 0 }.forEach { (k, v) -> add { Icon(SiteIcons.Seals.getValue(k), 16.dp); Num(v, 13) } }
        if (r.packs > 0) add { Icon(SiteIcons.Pack, 16.dp); Num(r.packs, 13) }
    }
    if (column) FlowRow(horizontalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        items.forEach { Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) { it() } }
    } else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { it() } }
        if (r.xp > 0) Text("${r.xp} XP", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFC9CED6)))
    }
}

// ---------------------------------------------------------------- Today (pd-today)

@Composable
private fun Today(d: PlayHomeData, act: PlayHomeActions) {
    val s = d.state
    val q = remember(d.rules, s, d.day, d.user) { PlayMath.quests(d.rules, s, d.day, d.user) }
    val stamp = s.getAsJsonObject("login")?.get("stamp")?.asInt ?: 0
    Shelf("Today", "Quests", { act.view("deeds") }) {
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp).height(androidx.compose.foundation.layout.IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            d.rules.loginWeek.forEachIndexed { i, r ->
                val on = i < stamp; val sh = RoundedCornerShape(12.dp)
                Column(Modifier.weight(1f).fillMaxHeight().heightIn(min = 72.dp).clip(sh)
                    .background(if (on) Brush.verticalGradient(listOf(Color(0xFF2A2116), Color(0xFF17120D))) else Brush.verticalGradient(listOf(Color(0x05FFFFFF), Color(0x05FFFFFF))))
                    .border(1.dp, if (on) Color(0x66D6AD64) else Color(0x12FFFFFF), sh).padding(vertical = 8.dp, horizontal = 2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${i + 1}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, letterSpacing = .04.em, color = if (on) Color(0xFFF3DFB4) else P.Muted))
                    Rewards(r.copy(xp = 0), column = true)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            q.daily.forEach { r -> QuestRow(r, PlayMath.questReward(r.quest, s.getAsJsonObject("config"))) { act.claim("daily", r.quest.id) } }
        }
        Text("This week: ${q.weekly.count { it.done }} of ${q.weekly.size} weekly quests done", style = TextStyle(fontFamily = P.Sans, fontSize = 14.sp, color = P.Muted), modifier = Modifier.padding(top = 10.dp))
    }
}

@Composable
private fun QuestRow(r: PlayMath.QuestRow, reward: PlayRules.Reward, claim: () -> Unit) {
    Column(Modifier.fillMaxWidth().rowGlass().border(1.dp, if (r.done) Color(0x55D6AD64) else Color.Transparent, rowShape).let { if (r.claimed) it.then(Modifier) else it }
        .padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(r.quest.label, style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 21.sp, color = P.Ink.copy(alpha = if (r.claimed) .6f else 1f)), modifier = Modifier.weight(1f).padding(end = 12.dp))
            when { r.claimed -> Text("Claimed", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = P.Muted))
                r.done -> GoldCta("Claim", onClick = claim)
                else -> Rewards(reward) }
        }
        if (!r.done) Row(verticalAlignment = Alignment.CenterVertically) {
            Bar(r.have.toFloat() / r.quest.need, thin = true, modifier = Modifier.weight(1f))
            Text("${r.have} / ${r.quest.need}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFFC9CED6), fontFeatureSettings = "tnum"), modifier = Modifier.widthIn(min = 72.dp), textAlign = TextAlign.End)
        }
    }
}

// ---------------------------------------------------------------- Achievements (pd-deeds-home)

/** One "almost there" row, from the server's payload or PlayMath. */
private data class Near(val title: String, val art: String?, val trim: Boolean, val value: Int, val need: Int, val hours: Boolean)

private fun nearFromServer(p: JsonObject): Triple<PlayMath.Totals, List<Near>, Unit> {
    val t = p.getAsJsonObject("totals")
    val totals = PlayMath.Totals(t?.get("total")?.asInt ?: 0, t?.get("earned")?.asInt ?: 0, t?.get("ready")?.asInt ?: 0)
    val near = p.getAsJsonArray("achievements")?.mapNotNull { it as? JsonObject }
        ?.filter { it.get("complete")?.asBoolean != true && it.get("secret")?.asBoolean != true && it.get("hidden")?.asBoolean != true && it.get("kind")?.asString != "honour" }
        ?.mapNotNull { a -> val next = a.getAsJsonArray("steps")?.mapNotNull { it as? JsonObject }?.firstOrNull { it.get("done")?.asBoolean != true } ?: return@mapNotNull null
            val art = a.getAsJsonObject("art")
            Near(a.get("title")?.asString ?: "", art?.get("url")?.asString, art?.get("trim")?.asBoolean == true, a.get("value")?.asInt ?: 0, next.get("need")?.asInt ?: 1, a.get("unit")?.asString == "h") }
        ?.sortedByDescending { it.value.toDouble() / it.need }?.take(2) ?: emptyList()
    return Triple(totals, near, Unit)
}

@Composable
private fun Deeds(d: PlayHomeData, act: PlayHomeActions) {
    val (t, near) = remember(d.deeds, d.state, d.rules) { d.deeds?.let { nearFromServer(it) }?.let { it.first to it.second } ?: run {
        val rows = PlayMath.achievements(d.rules, d.state)
        PlayMath.totals(rows) to PlayMath.almostThere(rows, 2).mapNotNull { r -> r.next?.let { Near(r.a.title,
            "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=" + java.net.URLEncoder.encode(r.a.art, "UTF-8"), false, r.value, it.need, r.a.unit == "h") } }
    } }
    Shelf("Achievements", if (t.ready > 0) "${t.ready} to claim" else "All achievements", { act.view("deeds") }) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
            Text("${t.earned}", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 30.sp, color = Color(0xFFF3E3BD)))
            Text("of ${t.total} earned", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = Color(0xFFB9BFC9)), modifier = Modifier.padding(bottom = 3.dp))
        }
        Bar(if (t.total > 0) t.earned.toFloat() / t.total else 0f, modifier = Modifier.padding(vertical = 6.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            near.forEach { r ->
                Row(Modifier.fillMaxWidth().rowGlass().clickable { act.view("deeds") }.padding(start = 6.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    // trim: zoom about 116 % around (50 %, 45 %) so no frame line or corner shows; never letterbox.
                    Box(Modifier.size(72.dp, 50.dp).clip(RoundedCornerShape(10.dp))) {
                        Art(r.art, Modifier.matchParentSize().let { if (r.trim) it.scale(1.16f) else it }, BiasAlignment(0f, -.1f))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(r.title, style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = P.Ink))
                        Bar(r.value.toFloat() / r.need, thin = true)
                        Text(if (r.hours) "${r.value / 60} / ${r.need / 60} h" else "${"%,d".format(r.value)} / ${"%,d".format(r.need)}",
                            style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = P.Muted, fontFeatureSettings = "tnum"))
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Your packs + the Forge

@Composable
private fun Packs(s: JsonObject, act: PlayHomeActions) {
    val groups = s.getAsJsonArray("packs")?.mapNotNull { it as? JsonObject }?.groupBy { it.get("set")?.asString ?: "" } ?: emptyMap()
    val names = buildMap { s.getAsJsonArray("shop")?.forEach { o -> (o as? JsonObject)?.let { put(it["code"].asString, it["name"].asString) } }
        s.getAsJsonObject("rewardSet")?.let { put(it["code"].asString, it["name"].asString) } }
    Shelf("Your packs", "All packs", { act.view("packs") }) {
        if (groups.isEmpty()) Text("Every pack is open. Story battles, Planeswalk bosses and the Merchant give more.", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, lineHeight = 22.sp, color = Color(0xFFB9BFC9)), modifier = Modifier.padding(top = 8.dp))
        else PackGrid(groups.entries.take(6).toList()) { (code, list) ->
            Box(Modifier.clickable { act.openPack(list.first()["id"].asString) }) {
                Booster(code, names[code])
                Box(Modifier.align(Alignment.TopEnd).offset(6.dp, (-6).dp).size(28.dp).clip(CircleShape).background(P.Gold), contentAlignment = Alignment.Center) { Num(list.size, 13).let { } ; Text("${list.size}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = P.CtaInk)) }
            }
        }
    }
}

@Composable
private fun <T> PackGrid(items: List<T>, cell: @Composable (T) -> Unit) = BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp)) {
    val cols = maxOf(2, ((maxWidth + 12.dp) / (150.dp + 12.dp)).toInt())
    val shown = if (maxWidth < 560.dp) items.take(4) else items
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        shown.chunked(cols).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            row.forEach { Box(Modifier.weight(1f)) { cell(it) } }; repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
        } }
    }
}

private val SEAL_NAME = mapOf("c" to "Common", "u" to "Uncommon", "r" to "Rare", "m" to "Mythic")
private val FORGE_FROM = mapOf("u" to "c", "r" to "u", "m" to "r")

@Composable
private fun Forge(s: JsonObject, act: PlayHomeActions) {
    val w = s.getAsJsonObject("wallet") ?: JsonObject()
    fun have(k: String) = w.get("seal_$k")?.asInt ?: 0
    fun ratio(to: String) = s.getAsJsonObject("config")?.getAsJsonObject("forge")?.get(to)?.takeIf { it.isJsonPrimitive }?.asInt ?: 3
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.fillMaxWidth().shadow(24.dp, shape).clip(shape).background(Brush.verticalGradient(listOf(Color(0xFF1B1611), Color(0xFF120E0B), Color(0xFF2A1A10)))).border(1.dp, Color(0x55D6AD64), shape)) {
        Art("https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=Great+Furnace", Modifier.matchParentSize().let { it }, Alignment.Center)
        Box(Modifier.matchParentSize().background(Color(0xE6140F0B)))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.6f to Color.Transparent, 1f to Color(0x55B4501E))))
        BoxWithConstraints { val narrow = maxWidth < 520.dp
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            val purse = @Composable {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (k in listOf("c", "u", "r", "m")) Column(Modifier.widthIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x66000000)).border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(12.dp)).padding(horizontal = 8.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) { Icon(SiteIcons.Seals.getValue(k), 22.dp); Num(have(k)) }
                }
            }
            val headText = @Composable { m: Modifier -> Column(m, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("The Forge", style = P.h2.copy(fontSize = 24.sp, color = Color(0xFFF3DFB4)))
                Text("Three seals strike one of the next rarity.", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, lineHeight = 21.sp, color = Color(0xFFDFD6C6)))
            } }
            if (narrow) { headText(Modifier); purse() } else Row(verticalAlignment = Alignment.Top) { headText(Modifier.weight(1f).padding(end = 12.dp)); purse() }
            for (to in listOf("u", "r", "m")) {
                val from = FORGE_FROM.getValue(to); val r = ratio(to); val h = have(from); val can = minOf(10, h / r); val lit = if (can > 0) r else h % r
                val sh = RoundedCornerShape(16.dp)
                val seals = @Composable {
                    Row(horizontalArrangement = Arrangement.spacedBy((-4).dp)) { repeat(r) { i -> Icon(SiteIcons.Seals.getValue(from), 18.dp, if (i < lit) null else Color(0xFF3A3632)) } }
                    Text("→", style = TextStyle(fontSize = 18.sp, color = if (can > 0) P.Gold else Color(0xFF55504A)))
                    Icon(SiteIcons.Seals.getValue(to), 30.dp, if (can > 0) null else Color(0xFF8A8A8A))
                }
                val text = @Composable { m: Modifier -> Column(m) {
                    Text("${SEAL_NAME[to]} Seal", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = P.Ink))
                    Text(if (can > 0) "$can ready to forge" else "${r - h} more ${SEAL_NAME[from]!!.lowercase()} needed", style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = Color(0xFFC9C2B6)))
                } }
                val acts = @Composable {
                    GoldCta("Forge", enabled = can > 0, radius = 22.dp) { act.forge(to, 1) }
                    if (can > 1) Box(Modifier.heightIn(min = 44.dp).clickable { act.forge(to, can) }.padding(start = 12.dp), contentAlignment = Alignment.Center) { Text("All $can", style = P.link) }
                }
                val box = Modifier.fillMaxWidth().clip(sh).background(if (can > 0) Brush.horizontalGradient(listOf(Color(0xFF2A1D10), Color(0xFF1A120B))) else Brush.horizontalGradient(listOf(Color(0xCC0E0B09), Color(0xCC0E0B09))))
                    .border(1.dp, if (can > 0) Color(0x88D6AD64) else Color(0x14FFFFFF), sh).padding(horizontal = 14.dp, vertical = 12.dp)
                if (narrow) Column(box, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) { seals(); Spacer(Modifier.weight(1f)); acts() }
                    text(Modifier)
                } else Row(box, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) { seals(); text(Modifier.weight(1f)); acts() }
            }
        } }
    }
}

// ---------------------------------------------------------------- Your decks + Your collection

private val BASICS = setOf("Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes")
private fun deckSize(format: String) = when (format.lowercase()) { "commander", "edh" -> 100; "brawl" -> 60; "standard brawl" -> 60; else -> 60 }

@Composable
private fun Decks(s: JsonObject, wide: Boolean, act: PlayHomeActions) {
    val decks = s.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject } ?: emptyList()
    Shelf("Your decks", "All decks", { act.view("decks") }) {
        val tiles = buildList<@Composable (Modifier) -> Unit> {
            add { m -> DeckTile(BUILD_ART, "Build a deck", "From the cards you own", m, cinzel = true) { act.view("finder") } }
            decks.take(3).forEach { d ->
                val cards = d.getAsJsonArray("cards")?.mapNotNull { it as? JsonObject } ?: emptyList()
                val count = cards.sumOf { it.get("qty")?.asInt ?: 0 }
                val lead = cards.firstOrNull { (it.get("name")?.asString ?: "") !in BASICS }?.get("name")?.asString
                val fmt = d.get("format")?.asString?.ifBlank { null } ?: "Standard"
                add { m -> DeckTile(lead?.let { "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=" + java.net.URLEncoder.encode(it, "UTF-8") },
                    d.get("name")?.asString?.ifBlank { null } ?: "Untitled deck", "$fmt · $count/${deckSize(fmt)} cards", m) { act.deck(d["id"].asString) } }
            }
        }
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            tiles.chunked(if (wide) 2 else 1).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { it(Modifier.weight(1f)) }; if (wide && row.size == 1) Spacer(Modifier.weight(1f)) } }
        }
    }
}

@Composable
private fun DeckTile(art: String?, name: String, meta: String, modifier: Modifier, cinzel: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(modifier.height(136.dp).shadow(14.dp, shape).clip(shape).background(Color(0xFF15171C)).border(1.dp, Color(0x1FFFFFFF), shape).clickable(onClick = onClick)) {
        Art(art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.35f to Color.Transparent, 1f to Color(0xE60B0C10))))
        Column(Modifier.align(Alignment.BottomStart).padding(16.dp)) {
            Text(name, style = if (cinzel) TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = P.Ink, shadow = P.shadow) else TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = P.Ink, shadow = P.shadow))
            Text(meta, style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = Color(0xFFC9CED6)))
        }
    }
}

@Composable
private fun Collection(s: JsonObject, act: PlayHomeActions) {
    val facts: Map<String, SetFacts.Set> = SetFacts.sets.collectAsState().value
    val owned = LinkedHashMap<String, Int>()
    s.getAsJsonArray("cards")?.forEach { c -> (c as? JsonObject)?.getAsJsonArray("s")?.forEach { owned[it.asString] = (owned[it.asString] ?: 0) + 1 } }
    s.getAsJsonObject("rewardSet")?.get("code")?.asString?.let { owned.putIfAbsent(it, 0) }
    val rows = owned.map { (code, have) -> val f = facts[code]; Triple(code, f, have) }
        .sortedWith(compareByDescending<Triple<String, SetFacts.Set?, Int>> { it.second?.released ?: "" }.thenBy { it.second?.name ?: it.first }).take(4)
    val total = s.getAsJsonArray("cards")?.size() ?: 0
    Shelf("Your collection", "${"%,d".format(total)} cards", { act.view("collection") }) {
        if (rows.isEmpty()) Text("Open a pack and your first set starts filling in.", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, color = Color(0xFFB9BFC9)))
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            rows.forEach { (code, f, have) ->
                val pct = f?.total?.takeIf { it > 0 }?.let { have.toFloat() / it } ?: 0f
                Column(Modifier.fillMaxWidth().rowGlass().clickable { act.set(code) }.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x0FFFFFFF)), contentAlignment = Alignment.Center) { SetIcon(code, Modifier.size(34.dp), Color(0xFFE6E8EC)) }
                        Column(Modifier.weight(1f)) {
                            Text(f?.name ?: code.uppercase(), style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = P.Ink))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(code.uppercase(), style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = P.Gold),
                                    modifier = Modifier.border(1.dp, Color(0x44D6AD64), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp))
                                Text(f?.released?.take(4) ?: "", style = TextStyle(fontFamily = P.Sans, fontSize = 12.sp, color = P.Muted))
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(f?.total?.let { "%,d".format(it) } ?: "", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = P.Ink))
                            Text("cards", style = TextStyle(fontFamily = P.Sans, fontSize = 12.sp, color = P.Muted))
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("$have / ${f?.total ?: "?"} unique cards owned", style = TextStyle(fontFamily = P.Sans, fontSize = 12.sp, color = P.Muted), modifier = Modifier.weight(1f))
                        Text("${(pct * 100).toInt()}%", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFC9CED6)))
                    }
                    Bar(pct, thin = true)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Merchant (pe-home-shop)

@Composable
private fun Merchant(s: JsonObject, act: PlayHomeActions) {
    val price = s.getAsJsonObject("config")?.get("packPrice")?.asInt ?: 500
    val coins = s.getAsJsonObject("wallet")?.get("coins")?.asInt ?: 0
    val shop = s.getAsJsonArray("shop")!!.mapNotNull { it as? JsonObject }.take(12)
    Shelf("Merchant", "Every set", { act.view("shop") }) {
        PackGrid(shop) { o ->
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Booster(o["code"].asString, o["name"].asString)
                GoldCta("%,d".format(price), Modifier.fillMaxWidth(), enabled = coins >= price, muted = true, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 16.dp) }) { act.buy(o["code"].asString) }
            }
        }
    }
}
