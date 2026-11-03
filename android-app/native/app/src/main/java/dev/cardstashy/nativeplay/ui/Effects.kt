package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.ui.graphics.ImageBitmap

/**
 * Randall's painted effect pieces (Part B). Each is optional: when its frames are in the app the
 * painted version plays, otherwise the code-drawn one does.
 */
object Effects {
    /** Piece 02, impact burst: 8 frames at 24 fps (333 ms); frame 03 is the hit. */
    const val BURST_FRAMES = 8
    const val BURST_MS = 333
    @Volatile private var burst: List<ImageBitmap>? = null
    @Volatile private var burstMissing = false

    suspend fun burst(context: Context): List<ImageBitmap>? {
        burst?.let { return it }
        if (burstMissing) return null
        val frames = (1..BURST_FRAMES).map { AssetImages.load(context, "play/impact-burst-%02d.webp".format(it)) }
        return if (frames.all { it != null }) frames.filterNotNull().also { burst = it } else { burstMissing = true; null }
    }
}
