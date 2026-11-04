package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.layout.layout
import dev.cardstashy.nativeplay.foil.finish
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/** Mana and other card symbols, Scryfall's own SVGs as the site's symbolUrl: {W/U} → WU.svg. */
fun symbolUrl(sym: String) = "https://svgs.scryfall.io/card-symbols/" + sym.replace("/", "").uppercase() + ".svg"

@Composable
fun Symbol(sym: String, size: Dp, modifier: Modifier = Modifier) {
    val p = heroPainter(symbolUrl(sym).let(homeArt))
    if (p != null) Image(p, sym, modifier.size(size)) else Box(modifier.size(size).clip(CircleShape).background(Color(0xFFCAC5C0)))
}

/** manaCost(): each {X} symbol in a row. */
@Composable
fun ManaCost(cost: String, size: Dp = 16.dp, modifier: Modifier = Modifier) {
    val syms = Regex("\\{([^}]+)\\}").findAll(cost).map { it.groupValues[1] }.toList()
    if (syms.isEmpty()) return
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) { syms.forEach { Symbol(it, size) } }
}

/** .pe-pips: four 10 dp dots, gold when owned; holo copies wear the rainbow. */
@Composable
fun Pips(n: Int, holo: Boolean = false, modifier: Modifier = Modifier) = Row(modifier, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
    for (i in 1..4) {
        val on = i <= n
        Box(Modifier.size(10.dp).clip(CircleShape)
            .then(if (on && holo) Modifier.background(HOLO_PIP) else if (on) Modifier.background(Site.Gold) else Modifier)
            .border(1.dp, if (on && holo) Color(0x88FFFFFF) else if (on) Site.Gold else Color(0x88D6AD64), CircleShape))
    }
}
private val HOLO_PIP = Brush.linearGradient(listOf(Color(0xFFFF9AD5), Color(0xFFFFE48A), Color(0xFF8AFFC8), Color(0xFF8AD0FF)))
/** .pe-holo-tag: 11 sp, 800, tracked, rainbow text. */
@Composable
fun HoloTag() = Text("HOLO", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, letterSpacing = .08.em,
    brush = Brush.linearGradient(listOf(Color(0xFFFF9AD5), Color(0xFFFFE48A), Color(0xFF8AFFC8), Color(0xFF8AD0FF), Color(0xFFC79AFF)))))

/** Rarity colours of the set symbol (.set-badge.r-* .set-icon). */
fun rarityBrush(rarity: String): Brush = when (rarity) {
    "uncommon" -> Brush.linearGradient(listOf(Color(0xFF8A9AA8), Color(0xFFE6EEF4), Color(0xFF7D8B96)))
    "rare" -> Brush.linearGradient(listOf(Color(0xFF8D6D2B), Color(0xFFF5D78A), Color(0xFF9B7A33)))
    "mythic" -> Brush.linearGradient(listOf(Color(0xFFB4421C), Color(0xFFFFB15E), Color(0xFFC2471B)))
    else -> Brush.linearGradient(listOf(Color(0xFFD9DCE2), Color(0xFFD9DCE2)))
}

/** The set icon filled with the rarity colours (the site masks the SVG with them). */
@Composable
fun RaritySetIcon(code: String, rarity: String, size: Dp, modifier: Modifier = Modifier) {
    val p = heroPainter(dev.cardstashy.nativeplay.play.SetFacts.icon(code).let(homeArt)) ?: return
    val brush = rarityBrush(rarity)
    Box(modifier.size(size)) {
        Image(p, null, Modifier.fillMaxSize().graphicsLayerOffscreen().drawWithBrush(brush), colorFilter = ColorFilter.tint(Color.White, BlendMode.SrcIn))
    }
}

/** .set-badge: icon in rarity colours + the code, 5 dp corners, dark green-grey plate. */
@Composable
fun SetBadge(code: String, rarity: String) = Row(Modifier.clip(RoundedCornerShape(5.dp)).background(Color(0xFF252B25)).border(1.dp, Color(0xFF394034), RoundedCornerShape(5.dp))
    .padding(horizontal = 5.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    RaritySetIcon(code, rarity, 12.dp)
    Text(code.uppercase(), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = Color(0xFFD9D3BC)))
}

/** A card picture with its finish: the site's foil (or holo stamp) drawn over the image. */
@Composable
fun CardPicture(url: String?, look: Foil.Look?, tilt: State<Offset>?, modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(10.dp), contentScale: ContentScale = ContentScale.Fit) {
    val p = heroPainter(url?.let(homeArt))
    if (p != null && (contentScale == ContentScale.Fit || contentScale == ContentScale.Crop)) { CardFace(p, look, tilt, modifier, shape, crop = contentScale == ContentScale.Crop); return }
    Box(modifier.clip(shape).background(Color(0xFF1F232B))) {
        if (p != null) {
            val m = if (look != null && tilt != null) Modifier.fillMaxSize().foil(look, tilt) else Modifier.fillMaxSize()
            Image(p, null, m, contentScale = contentScale)
        }
    }
}

/**
 * One card face with its foil glued on (Randall 4 Nov: "make it glue to the card so when it scales or moves its not going to
 * mess it up"). The foil, its frame boxes and the holo stamp are all placed in 0..1 card space, so they only line up if the
 * layer that wears them is exactly the card: this box takes the picture's own aspect, draws it edge to edge, clips to the
 * card's corners and wears the foil itself. Any size, any slot, any scale or tilt from a parent: the foil moves with it.
 * Badges, counts and outlines go on top as siblings, outside this layer, so the foil never covers them.
 */
@Composable
fun CardFace(painter: androidx.compose.ui.graphics.painter.Painter, look: Foil.Look?, tilt: State<Offset>?, modifier: Modifier = Modifier,
             shape: Shape = RoundedCornerShape(10.dp), desc: String? = null, alignment: Alignment = Alignment.Center, crop: Boolean = false,
             finish: dev.cardstashy.nativeplay.foil.CardFinish? = null) {
    val s = painter.intrinsicSize
    val ratio = if (s.isSpecified && s.width > 0f && s.height > 0f) s.width / s.height else 63f / 88f
    // One foil layer for every game (foil/FoilLayer.kt); a bare Magic look still works for older callers.
    val foil = Modifier.finish(finish ?: look?.let { dev.cardstashy.nativeplay.foil.CardFinish.Magic(it) }, tilt)
    if (!crop) Box(modifier, contentAlignment = alignment) {
        Box(Modifier.aspectRatio(ratio).clip(shape).background(Color(0xFF1F232B)).then(foil)) {
            Image(painter, desc, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
        }
    } else Box(modifier.clip(shape).background(Color(0xFF1F232B))) {
        // A cropped tile: the plane is still the WHOLE card, sized to cover the tile and centred, so the foil's card-space boxes
        // land on the printed frame; the tile's clip cuts the overflow (foil-anchor-spec.md, site paintedImageBox 'cover').
        Box(Modifier.layout { m, c ->
            val w = c.maxWidth; val h = c.maxHeight
            val (pw, ph) = if (w.toFloat() / h > ratio) w to (w / ratio).toInt() else (h * ratio).toInt() to h
            val placeable = m.measure(androidx.compose.ui.unit.Constraints.fixed(pw, ph))
            layout(w, h) { placeable.place((w - pw) / 2, (h - ph) / 2) }
        }.then(foil)) {
            Image(painter, desc, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
        }
    }
}

private fun Modifier.graphicsLayerOffscreen() = this.graphicsLayer { compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
private fun Modifier.drawWithBrush(brush: Brush) = this.drawWithContent { drawContent(); drawRect(brush, blendMode = BlendMode.SrcIn) }
