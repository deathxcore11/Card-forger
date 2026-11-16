package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonParser

/**
 * The found card's edge, as the scanner's page gives it (scancam.js showOutline, scan-web-entry.mjs scanCtx.outline): four corners
 * clockwise from the top left, each a fraction of the frame the page read ([w] × [h], upright), and whether the card is being
 * captured ([green]) or waited on (amber). Drawing only: nothing here reads or captures a card.
 */
data class ScanOutline(val green: Boolean, val w: Float, val h: Float, val quad: List<Pair<Float, Float>>) {
    /**
     * The corners in a preview [boxW] × [boxH] that shows the frame cropped to fill it, centred (PreviewView FILL_CENTER, the
     * site's object-fit: cover): x0, y0, x1, y1 … in the box's own units. Same rule as scancam.js outlinePoints.
     */
    fun inBox(boxW: Float, boxH: Float): FloatArray {
        val k = maxOf(boxW / w, boxH / h); val ox = (w * k - boxW) / 2f; val oy = (h * k - boxH) / 2f
        return FloatArray(8) { i -> val p = quad[i / 2]; if (i % 2 == 0) p.first * w * k - ox else p.second * h * k - oy }
    }

    companion object {
        /** {tone: "green" | "amber", w, h, quad: [{x, y} × 4]}; anything else (empty, no card, a frame without a size) is no outline. */
        fun parse(json: String?): ScanOutline? = runCatching {
            if (json.isNullOrBlank()) return null
            val o = JsonParser.parseString(json).asJsonObject
            val w = o["w"].asFloat; val h = o["h"].asFloat
            val quad = o["quad"].asJsonArray.map { it.asJsonObject.let { p -> p["x"].asFloat to p["y"].asFloat } }
            if (w <= 0f || h <= 0f || quad.size != 4 || quad.any { !it.first.isFinite() || !it.second.isFinite() }) null
            else ScanOutline(o["tone"]?.asString == "green", w, h, quad)
        }.getOrNull()
    }
}
