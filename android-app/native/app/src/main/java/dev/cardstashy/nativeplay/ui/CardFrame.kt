package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.Card

/**
 * The art contract's last resort (overhaul plan, 10 Nov): a card whose picture never loads still reads as that card. A frame in
 * its colours with its name and cost, type line, rules text and P/T, sized to the slot. [crop]: an art-crop slot (a battlefield
 * tile, a crest), so only the name and type over the colour. [card] null: what the engine hasn't shown yet, so the name alone.
 */
@Composable
fun CardFrame(name: String?, card: Card?, modifier: Modifier = Modifier, crop: Boolean = false) {
    val tone = card?.let { frameTone(cardColors(it)) } ?: (Color(0xFF8A8F96) to Color(0xFF4E545B))
    BoxWithConstraints(modifier.background(Brush.verticalGradient(listOf(tone.first.copy(alpha = .9f), tone.second.copy(alpha = .9f), Color(0xFF15151A))))) {
        val w = maxWidth.value
        fun fs(f: Float) = (w * f).coerceIn(7f, 22f).sp
        val ink = Color(0xFFF4EEDD); val soft = Color(0xFFD7CFBC)
        val serif = TextStyle(fontFamily = Spectral, fontWeight = FontWeight.Bold, color = ink)
        if (crop || maxHeight.value < w * .9f) {
            Column(Modifier.fillMaxSize().padding((w * .05f).coerceAtMost(8f).let { androidx.compose.ui.unit.Dp(it) }), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Text(name.orEmpty(), style = serif.copy(fontSize = fs(.1f)), textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                card?.type?.takeIf { it.isNotBlank() }?.let { Text(it, style = TextStyle(fontSize = fs(.07f), color = soft), textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            }
            return@BoxWithConstraints
        }
        val pad = androidx.compose.ui.unit.Dp((w * .045f).coerceIn(2f, 10f))
        val box = RoundedCornerShape(pad)
        Column(Modifier.fillMaxSize().padding(pad), verticalArrangement = Arrangement.spacedBy(pad * .6f)) {
            Row(Modifier.fillMaxWidth().clip(box).background(Color(0xCC101114)).padding(horizontal = pad, vertical = pad * .5f), verticalAlignment = Alignment.CenterVertically) {
                Text(name.orEmpty(), style = serif.copy(fontSize = fs(.085f)), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                card?.manaCost?.takeIf { it.isNotBlank() }?.let { Text(it.replace("{", "").replace("}", ""), style = TextStyle(fontSize = fs(.07f), color = soft, fontWeight = FontWeight.Bold), maxLines = 1) }
            }
            Box(Modifier.weight(.8f).fillMaxWidth().clip(box).background(Brush.linearGradient(listOf(tone.first.copy(alpha = .55f), tone.second.copy(alpha = .35f)))).border(1.dp(), Color(0x33FFFFFF), box))
            card?.type?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = TextStyle(fontSize = fs(.065f), color = ink, fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().clip(box).background(Color(0xCC101114)).padding(horizontal = pad, vertical = pad * .4f))
            }
            Box(Modifier.weight(1f).fillMaxWidth().clip(box).background(Color(0xE6EDE6D3)).padding(pad)) {
                SymText(card?.text.orEmpty(), TextStyle(fontFamily = androidx.compose.ui.text.font.FontFamily.Serif, fontSize = fs(.06f), lineHeight = fs(.072f), color = Color(0xFF1B1A17)))
                if (card?.power != null && card.isCreature) Text("${card.power}/${card.toughness}", style = TextStyle(fontSize = fs(.08f), fontWeight = FontWeight.ExtraBold, color = Color(0xFF1B1A17)),
                    modifier = Modifier.align(Alignment.BottomEnd))
            }
        }
    }
}

private fun Int.dp() = androidx.compose.ui.unit.Dp(this.toFloat())
