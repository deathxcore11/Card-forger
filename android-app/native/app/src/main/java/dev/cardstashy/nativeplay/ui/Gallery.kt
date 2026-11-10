package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImagePainter
import coil3.compose.rememberAsyncImagePainter

/**
 * One piece on the Gallery wall (specs/thor-gallery-native.md, Randall 10 Nov "a true art museum"). Every field is the card's own
 * record; a missing one is null and is left off the label, never filled in. [open]: this piece's card page (A), when it has one.
 */
class GalleryPiece(val art: String, val title: String, val artist: String? = null, val set: String? = null, val year: String? = null,
                   val number: String? = null, val flavour: String? = null, val open: (() -> Unit)? = null) {
    /** "Set name · year · collector number", only the parts on record. */
    val line: String get() = listOfNotNull(set?.takeIf { it.isNotBlank() }, year?.takeIf { it.isNotBlank() }, number?.takeIf { it.isNotBlank() }?.let { "No. $it" }).joinToString(" · ")
}

/** The wall: the list the card was opened from, in its order, and which piece is in front. One piece = no neighbours, no Walk. */
class Gallery(val pieces: List<GalleryPiece>, val start: Int = 0)

/** A piece from a card's own record ([shown]: the printing as Scryfall names it). Anything the record lacks stays null. */
fun galleryPiece(art: String, title: String, artist: String?, flavour: String?, shown: com.google.gson.JsonObject?, open: (() -> Unit)? = null): GalleryPiece {
    fun s(k: String) = shown?.get(k)?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }
    return GalleryPiece(art, title, artist?.takeIf { it.isNotBlank() } ?: s("artist"), s("set_name"), s("released_at")?.take(4)?.takeIf { it.length == 4 && it.all(Char::isDigit) },
        s("collector_number"), flavour?.takeIf { it.isNotBlank() } ?: s("flavor_text"), open)
}

private val Brass = Color(0xFFB8935A)

/** Thumbnails for the label: other pieces by the same artist on this wall, else the neighbours ("Along this wall"). */
internal fun galleryMore(pieces: List<GalleryPiece>, index: Int): Pair<String, List<Int>> {
    val me = pieces.getOrNull(index) ?: return "" to emptyList()
    val same = me.artist?.takeIf { it.isNotBlank() }?.let { a -> pieces.indices.filter { it != index && pieces[it].artist.equals(a, true) } }.orEmpty()
    if (same.isNotEmpty()) return "More by ${me.artist}" to same.take(8)
    val near = listOf(index - 2, index - 1, index + 1, index + 2).filter { it in pieces.indices }
    return (if (near.isEmpty()) "" else "Along this wall") to near
}

/** Top screen: the painting only. A warm dark wall, a floor band, the framed art under one breathing light, dimmed neighbours. */
@Composable
internal fun GalleryWall(g: Gallery, index: Int) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Color(0xFF0B0907))) {
        val W = maxWidth; val H = maxHeight
        Canvas(Modifier.fillMaxSize()) {
            val c = Offset(size.width * .5f, size.height * .38f)
            drawRect(Brush.radialGradient(0f to Color(0xFF3A3024), .38f to Color(0xFF221C16), .7f to Color(0xFF15120F), 1f to Color(0xFF0B0907), center = c, radius = size.maxDimension * .72f))
            // The floor: the bottom 13 %, with a 1 px line where it meets the wall.
            val fy = size.height * .87f
            drawRect(Brush.verticalGradient(listOf(Color(0xFF0D0B09), Color(0xFF050404)), startY = fy, endY = size.height), Offset(0f, fy), Size(size.width, size.height - fy))
            drawLine(Color(0xFF2A231A), Offset(0f, fy), Offset(size.width, fy), 1.dp.toPx())
        }
        // Neighbours: the previous and next piece at 9 % and 91 %, 46 % high, alpha .28, desaturated.
        val grey = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })
        for ((i, x) in listOf(index - 1 to .09f, index + 1 to .91f)) g.pieces.getOrNull(i)?.let { p ->
            val painter = rememberAsyncImagePainter(p.art, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader)
            val ratio = ratioOf(painter)
            val h = H * .46f; val w = h * ratio
            Image(painter, null, Modifier.offset(x = W * x - w / 2, y = H * .44f - h / 2).width(w).height(h).alpha(.28f), contentScale = ContentScale.Fit, colorFilter = grey)
        }
        // The piece: centred at 50 % / 44 %, 66 % of the height, its own shape, never cropped. Walking crossfades (650 ms).
        Crossfade(index, animationSpec = tween(if (Motion.still) 0 else 650), label = "piece") { i ->
            val p = g.pieces.getOrNull(i) ?: return@Crossfade
            val painter = rememberAsyncImagePainter(p.art, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader)
            val ratio = ratioOf(painter)
            val h = minOf(H * .66f, W * .8f / ratio); val w = h * ratio
            Box(Modifier.fillMaxSize()) {
                Box(Modifier.offset(x = W * .5f - w / 2, y = H * .44f - h / 2).width(w).height(h)
                    .shadow(28.dp, RoundedCornerShape(2.dp), ambientColor = Color.Black, spotColor = Color.Black)
                    .border(W * .0025f, Brass).padding(W * .0025f).border(W * .005f, Color(0xFF1A140D)).padding(W * .005f).background(Color(0xFF0B0907))) {
                    Image(painter, p.title, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                }
            }
        }
        // One light: a soft cone from the top centre, breathing over 6 s (1 → .72 → 1). Still when motion is off.
        val breath = if (Motion.still) 1f else rememberInfiniteTransition(label = "light").animateFloat(1f, 1f,
            infiniteRepeatable(keyframes { durationMillis = 6000; 1f at 0; .72f at 3000; 1f at 6000 }, RepeatMode.Restart), label = "b").value
        Canvas(Modifier.fillMaxSize()) {
            val top = Offset(size.width * .5f, -size.height * .05f)
            val cone = Path().apply { moveTo(top.x - size.width * .03f, 0f); lineTo(top.x + size.width * .03f, 0f); lineTo(size.width * .78f, size.height * .87f); lineTo(size.width * .22f, size.height * .87f); close() }
            drawPath(cone, Brush.verticalGradient(listOf(Color(0xFFFFE9C4).copy(alpha = .10f * breath), Color(0xFFFFE9C4).copy(alpha = .02f * breath), Color.Transparent), startY = 0f, endY = size.height * .87f))
        }
        Text("GALLERY · PIECE ${index + 1} OF ${g.pieces.size}", style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = .18.em, color = Color(0x99E8D9BC)),
            modifier = Modifier.padding(start = 28.dp, top = 22.dp))
    }
}

@Composable
private fun ratioOf(painter: AsyncImagePainter): Float {
    painter.state.collectAsState().value
    val s = painter.intrinsicSize
    return if (s.width > 0f && s.height > 0f && s.width.isFinite() && s.height.isFinite()) s.width / s.height else 626f / 457f
}

/** Bottom screen: the museum label. Title, artist, set · year · number, the flavour line, and the wall's other pieces to walk to. */
@Composable
internal fun GalleryLabel(g: Gallery, index: Int, onWalkTo: (Int) -> Unit) {
    val p = g.pieces.getOrNull(index) ?: return
    Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF1B1712), Color(0xFF0E0C0A)))).verticalScroll(rememberScrollState())
        .padding(horizontal = 56.dp, vertical = 44.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(Modifier.width(56.dp).height(2.dp).background(Brass))
        Text(p.title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 38.sp, lineHeight = 44.sp, letterSpacing = .02.em, color = Color(0xFFF6EEDB)))
        p.artist?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, color = Site.Gold)) }
        p.line.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontFamily = Type.Sans, fontSize = 15.sp, color = Color(0xB3E8D9BC)).copy(fontFeatureSettings = "tnum")) }
        p.flavour?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(6.dp))
            Text(flavourText(it), style = TextStyle(fontFamily = FontFamily.Serif, fontStyle = FontStyle.Italic, fontSize = 18.sp, lineHeight = 27.sp, color = Color(0xD9F1E7D2)))
        }
        val (head, more) = galleryMore(g.pieces, index)
        if (more.isNotEmpty()) {
            Spacer(Modifier.height(18.dp))
            Text(head.uppercase(), style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = .16.em, color = Color(0x99E8D9BC)))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                more.forEach { i -> val q = g.pieces[i]
                    Column(Modifier.width(150.dp).clip(RoundedCornerShape(4.dp)).clickable { onWalkTo(i) }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Image(rememberAsyncImagePainter(q.art, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader), q.title,
                            Modifier.fillMaxWidth().aspectRatio(626f / 457f).border(1.dp, Brass.copy(alpha = .6f)), contentScale = ContentScale.Crop)
                        Text(q.title, style = TextStyle(fontFamily = Type.Sans, fontSize = 12.sp, color = Color(0xCCE8D9BC)), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}
