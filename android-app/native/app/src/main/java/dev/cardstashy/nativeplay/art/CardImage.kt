package dev.cardstashy.nativeplay.art

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil3.compose.AsyncImage
import dev.cardstashy.nativeplay.match.DemoDecks
import dev.cardstashy.nativeplay.ui.AssetImage

/**
 * A card's picture by its (Forge-spelled) name: bundled art for the demo decks, else the exact
 * printing from the art cache (already decoded behind the versus beat). [fallback] draws when
 * the card has no picture at all (a token, say).
 */
@Composable
fun CardImage(name: String?, modifier: Modifier = Modifier, crop: Boolean = false, contentScale: ContentScale = ContentScale.Crop,
              shape: Shape? = null, fallback: @Composable () -> Unit = {}) {
    if (name == null) { Box(modifier) { fallback() }; return }
    val context = LocalContext.current
    val asset = remember(name, crop) { DemoDecks.load(context).image(name, crop) }
    if (asset != null) { AssetImage(asset, modifier, maxWidth = if (crop) 900 else 488, contentScale = contentScale, shape = shape); return }
    val v by CardArt.version.collectAsState()
    val url = remember(name, crop, v) { CardArt.url(name, crop) }
    if (url == null) { Box(modifier) { fallback() }; return }
    val request = remember(url, crop) { CardArt.request(context, url, crop) }
    AsyncImage(model = request, contentDescription = null, imageLoader = CardArt.loader, modifier = (if (shape != null) modifier.clip(shape) else modifier), contentScale = contentScale)
}
