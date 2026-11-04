package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import com.google.gson.JsonParser

/**
 * play-board-icons.js: the Battlefield Icons & States kit, 24-unit glyphs drawn in one colour (currentColor).
 * The web's own SVG fragments, exported as drawing ops by scripts/export-board-icons.mjs (assets/board-icons.json).
 */
object BoardIcons {
    sealed class Op(val fill: Boolean, val stroke: Boolean, val sw: Float, val s: Float, val cap: StrokeCap, val join: StrokeJoin)
    class PathOp(val path: Path, f: Boolean, st: Boolean, sw: Float, s: Float, c: StrokeCap, j: StrokeJoin) : Op(f, st, sw, s, c, j)
    class CircleOp(val cx: Float, val cy: Float, val r: Float, f: Boolean, st: Boolean, sw: Float, s: Float, c: StrokeCap, j: StrokeJoin) : Op(f, st, sw, s, c, j)
    class RectOp(val x: Float, val y: Float, val w: Float, val h: Float, val rx: Float, f: Boolean, st: Boolean, sw: Float, s: Float, c: StrokeCap, j: StrokeJoin) : Op(f, st, sw, s, c, j)
    class TextOp(val x: Float, val y: Float, val size: Float, val bold: Boolean, val anchor: String, val text: String, f: Boolean, st: Boolean, sw: Float, s: Float, c: StrokeCap, j: StrokeJoin) : Op(f, st, sw, s, c, j)

    @Volatile private var icons: Map<String, List<Op>>? = null

    fun get(context: Context, name: String): List<Op>? = (icons ?: load(context))[name]

    @Synchronized private fun load(context: Context): Map<String, List<Op>> {
        icons?.let { return it }
        val out = HashMap<String, List<Op>>()
        try {
            val root = context.assets.open("board-icons.json").bufferedReader().use { JsonParser.parseReader(it).asJsonObject }
            for ((name, arr) in root.entrySet()) out[name] = arr.asJsonArray.map { e ->
                val o = e.asJsonObject
                val f = o["fill"].asBoolean; val st = o["stroke"].asBoolean; val sw = o["sw"].asFloat; val s = o["s"].asFloat
                val cap = when (o["cap"]?.asString) { "round" -> StrokeCap.Round; "square" -> StrokeCap.Square; else -> StrokeCap.Butt }
                val join = when (o["join"]?.asString) { "round" -> StrokeJoin.Round; "bevel" -> StrokeJoin.Bevel; else -> StrokeJoin.Miter }
                when (o["t"].asString) {
                    "path" -> PathOp(PathParser().parsePathString(o["d"].asString).toPath(), f, st, sw, s, cap, join)
                    "circle" -> CircleOp(o["cx"].asFloat, o["cy"].asFloat, o["r"].asFloat, f, st, sw, s, cap, join)
                    "rect" -> RectOp(o["x"].asFloat, o["y"].asFloat, o["w"].asFloat, o["h"].asFloat, o["rx"].asFloat, f, st, sw, s, cap, join)
                    else -> TextOp(o["x"].asFloat, o["y"].asFloat, o["size"].asFloat, o["bold"].asBoolean, o["anchor"].asString, o["text"].asString, f, st, sw, s, cap, join)
                }
            }
        } catch (_: Exception) { /* no icons: badges keep their values */ }
        icons = out
        return out
    }

    fun DrawScope.draw(ops: List<Op>, color: Color) {
        val k = size.minDimension / 24f
        scale(k, k, pivot = Offset.Zero) {
            for (op in ops) scale(op.s, op.s, pivot = Offset.Zero) {
                val styles = buildList { if (op.fill) add(Fill); if (op.stroke) add(Stroke(op.sw, cap = op.cap, join = op.join)) }
                for (style in styles) when (op) {
                    is PathOp -> drawPath(op.path, color, style = style)
                    is CircleOp -> drawCircle(color, op.r, Offset(op.cx, op.cy), style = style)
                    is RectOp -> drawRoundRect(color, Offset(op.x, op.y), Size(op.w, op.h), CornerRadius(op.rx), style = style)
                    is TextOp -> if (style is Fill) drawIntoCanvas { c ->
                        val p = android.graphics.Paint().apply { isAntiAlias = true; this.color = color.toArgb(); textSize = op.size; isFakeBoldText = op.bold
                            textAlign = when (op.anchor) { "middle" -> android.graphics.Paint.Align.CENTER; "end" -> android.graphics.Paint.Align.RIGHT; else -> android.graphics.Paint.Align.LEFT } }
                        c.nativeCanvas.drawText(op.text, op.x, op.y, p)
                    }
                }
            }
        }
    }
}

/** boardIcon(name): one glyph at [size] in [color]; nothing when the kit has no such icon. */
@Composable
fun BoardIcon(name: String, color: Color, size: Dp, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val ops = remember(name) { BoardIcons.get(context, name) } ?: return
    Canvas(modifier.size(size)) { with(BoardIcons) { draw(ops, color) } }
}
