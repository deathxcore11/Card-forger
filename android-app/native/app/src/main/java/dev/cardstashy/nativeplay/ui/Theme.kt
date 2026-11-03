package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Image
import dev.cardstashy.nativeplay.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// The web table's glass and gold (play-forge-table.css): panel #1b1b1f→#0e0e11, hairline #d6ad6452, gold #d6ad64 / #e8b95b.
object Palette {
    val Gold = Color(0xFFD6AD64)
    val GoldBright = Color(0xFFE8B95B)
    val GoldDeep = Color(0xFF9A7A35)
    val Hairline = Color(0x52D6AD64)
    val PanelTop = Color(0xF51B1B1F)
    val PanelBottom = Color(0xF70E0E11)
    val Ink = Color(0xFFF3EBDD)
    val InkSoft = Color(0xFFB9AE9C)
    val Red = Color(0xFFE0533F)
    val Night = Color(0xFF0C0C0E)
}

object Type {
    val Cinzel = FontFamily(Font(R.font.cinzel_semibold, FontWeight.SemiBold), Font(R.font.cinzel_bold, FontWeight.Bold))
    val Sans = FontFamily(Font(R.font.dmsans_regular, FontWeight.Normal), Font(R.font.dmsans_semibold, FontWeight.SemiBold), Font(R.font.dmsans_bold, FontWeight.Bold))
    val Title = TextStyle(fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Palette.Ink)
    val Label = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Palette.Ink)
    val Body = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 12.sp, color = Palette.InkSoft, lineHeight = 16.sp)
}

/** A glass panel: dark gradient, gold hairline, soft shadow. No live blur behind moving cards. */
fun Modifier.glass(radius: Dp = 14.dp, edge: Color = Palette.Hairline): Modifier {
    val shape = RoundedCornerShape(radius)
    return this.shadow(18.dp, shape, ambientColor = Color.Black, spotColor = Color.Black)
        .clip(shape)
        .background(Brush.verticalGradient(listOf(Palette.PanelTop, Palette.PanelBottom)))
        .border(1.dp, edge, shape)
}

fun goldButtonBrush(enabled: Boolean) = if (enabled) Brush.verticalGradient(listOf(Color(0xFFF2CF7E), Color(0xFFD6AD64), Color(0xFFA9802F)))
    else Brush.verticalGradient(listOf(Color(0xFF4A4339), Color(0xFF2E2A24)))

/** Bitmaps from the app's assets (card art, mats, banners), decoded off the main thread and kept in memory. */
object AssetImages {
    private val cache = object : LruCache<String, ImageBitmap>(48 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ImageBitmap) = value.width * value.height * 4
    }
    fun cached(path: String): ImageBitmap? = cache.get(path)
    suspend fun load(context: Context, path: String, maxWidth: Int = 0): ImageBitmap? {
        val key = "$path@$maxWidth"
        cache.get(key)?.let { return it }
        return withContext(Dispatchers.IO) {
            try {
                val opts = BitmapFactory.Options()
                if (maxWidth > 0) {
                    opts.inJustDecodeBounds = true
                    context.assets.open(path).use { BitmapFactory.decodeStream(it, null, opts) }
                    var s = 1; while (opts.outWidth / (s * 2) >= maxWidth) s *= 2
                    opts.inJustDecodeBounds = false; opts.inSampleSize = s
                }
                context.assets.open(path).use { BitmapFactory.decodeStream(it, null, opts) }?.asImageBitmap()?.also { cache.put(key, it) }
            } catch (_: Exception) { null }
        }
    }
}

@Composable
fun AssetImage(path: String?, modifier: Modifier = Modifier, maxWidth: Int = 0, contentScale: ContentScale = ContentScale.Crop, shape: Shape? = null) {
    val context = LocalContext.current
    val image by produceState(initialValue = path?.let { AssetImages.cached("$it@$maxWidth") }, path, maxWidth) {
        value = path?.let { AssetImages.load(context, it, maxWidth) }
    }
    val m = if (shape != null) modifier.clip(shape) else modifier
    image?.let { Image(it, null, m, contentScale = contentScale) } ?: Box(m)
}

@Composable
fun Backdrop(path: String, dim: Float = .45f, content: @Composable BoxScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(Palette.Night)) {
        AssetImage(path, Modifier.fillMaxSize(), maxWidth = 1600)
        Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color.Black.copy(alpha = dim * .4f), Color.Black.copy(alpha = dim + .3f)))))
        content()
    }
}
