package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The one rulebook (specs/rulebook-native.md, Randall 10 Nov 11:46Z "Yes good"; sample
 * https://claude.ai/artifact/3XCDVtA4rMCkekQuQpmoJy). Every screen takes its text sizes, corners and colours from here.
 * The Play card sheet is the reference look. Table units (`du`) on the match table and anything cut from a card's own ratio
 * (CardCorner, foil) are exempt. RulebookTest counts what is still off this list, file by file, and only lets it go down.
 */
object Rule {
    /** The 12 text sizes, in sp. Nothing under 11. */
    val Sizes = listOf(11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 34)

    /** The nearest list size for a size found in old code (the brief's snap table). */
    fun snapSize(sp: Float): Int = when {
        sp < 11.5f -> 11; sp < 12.5f -> 12; sp < 13.5f -> 13; sp < 14.5f -> 14; sp < 15.5f -> 15; sp <= 17f -> 16
        sp <= 19f -> 18; sp <= 21f -> 20; sp <= 23f -> 22; sp <= 26f -> 24; sp <= 30f -> 28; else -> 34
    }

    /** The 7 corners, in dp. 0 and 1 stay as they are. */
    object Radius {
        val Tag: Dp = 6.dp
        val Card: Dp = 10.dp
        val Button: Dp = 13.dp
        val Panel: Dp = 16.dp
        val Sheet: Dp = 20.dp
        val Case: Dp = 24.dp
        val Pill: Shape = CircleShape
        val All = listOf(6, 10, 13, 16, 20, 24)
        fun shape(r: Dp): Shape = RoundedCornerShape(r)
        /** The nearest list corner for a radius found in old code; null = a pill (99 / 999). */
        fun snap(dp: Float): Int? = when {
            dp <= 1f -> dp.toInt(); dp <= 7f -> 6; dp <= 11f -> 10; dp <= 14f -> 13; dp <= 18f -> 16; dp <= 22f -> 20; dp <= 34f -> 24; else -> null
        }
    }

    /** Named text styles for the 12 steps: Cinzel for names and small gold labels, Manrope for everything else. */
    object Type {
        private fun base(size: Int, weight: FontWeight = FontWeight.Normal) = TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, color = Site.Text)
        private fun name(size: Int) = TextStyle(fontFamily = dev.cardstashy.nativeplay.ui.Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, color = Site.Text)
        val S11: TextStyle get() = base(11); val S12: TextStyle get() = base(12); val S13: TextStyle get() = base(13); val S14: TextStyle get() = base(14)
        val S15: TextStyle get() = base(15); val S16: TextStyle get() = base(16); val S18: TextStyle get() = base(18); val S20: TextStyle get() = base(20)
        val S22: TextStyle get() = base(22); val S24: TextStyle get() = base(24); val S28: TextStyle get() = base(28); val S34: TextStyle get() = base(34)
        /** Any list size in Manrope at a weight. */
        fun sans(size: Int, weight: FontWeight, color: androidx.compose.ui.graphics.Color = Site.Text): TextStyle { require(size in Sizes) { "$size sp is not on the list" }; return base(size, weight).copy(color = color) }
        /** A name or a small gold label in Cinzel, at a list size. */
        fun cinzel(size: Int, color: androidx.compose.ui.graphics.Color = Site.Text): TextStyle { require(size in Sizes) { "$size sp is not on the list" }; return name(size).copy(color = color) }
        /** A button's words: Manrope Bold 14. */
        val Button: TextStyle get() = base(14, FontWeight.Bold)
        /** A sheet's title: Cinzel 18. A menu row: Manrope SemiBold 15. */
        val SheetTitle: TextStyle get() = name(18)
        val MenuRow: TextStyle get() = base(15, FontWeight.SemiBold)
    }

    /** The Site tokens and the named extras. Gold is the screen's main action or something earned, nothing else. */
    object Color {
        val Bg get() = Site.Bg
        val Surface get() = Site.Surface
        val Surface2 get() = Site.Surface2
        val Line get() = Site.Line
        val Text get() = Site.Text
        val Muted get() = Site.Muted
        val Gold get() = Site.Gold
        /** The opaque ground of a top bar or bottom nav (the site's .topbar / .bottom-nav colour, made solid so scrolling text never shows through). */
        val Bar get() = if (AppSettings.theme == "light") androidx.compose.ui.graphics.Color(0xFFF6F9FD) else androidx.compose.ui.graphics.Color(0xFF0C0E13)
        /** White at 6 %: a glass fill. */
        val Glass = androidx.compose.ui.graphics.Color(0x0FFFFFFF)
        /** White at 16 %: a glass edge. */
        val Edge = androidx.compose.ui.graphics.Color(0x29FFFFFF)
        val GoldHair = androidx.compose.ui.graphics.Color(0xFFD6AD64)
        /** E8B95B at 50 %. */
        val GoldEdge = androidx.compose.ui.graphics.Color(0x80E8B95B)
        val Coral = androidx.compose.ui.graphics.Color(0xFFFF8A74)
        val CtaTop = androidx.compose.ui.graphics.Color(0xFFF2D18E)
        val CtaBottom = androidx.compose.ui.graphics.Color(0xFFC99A4B)
        val CtaInk = androidx.compose.ui.graphics.Color(0xFF1B1408)
        /** The gold button's light top edge; then its muted form (disabled, over a light picture) and its off form (disabled). */
        val CtaEdge = androidx.compose.ui.graphics.Color(0xFFF6DFA8)
        val CtaMutedTop = androidx.compose.ui.graphics.Color(0xFFB3A88F); val CtaMutedBottom = androidx.compose.ui.graphics.Color(0xFF8C8370); val CtaMutedEdge = androidx.compose.ui.graphics.Color(0x55FFFFFF); val CtaMutedInk = androidx.compose.ui.graphics.Color(0xFF26221B)
        val CtaOffTop = androidx.compose.ui.graphics.Color(0xFF2A2620); val CtaOffBottom = androidx.compose.ui.graphics.Color(0xFF1C1A16); val CtaOffEdge = androidx.compose.ui.graphics.Color(0x33D6AD64); val CtaOffInk = androidx.compose.ui.graphics.Color(0x99D6AD64)
    }

    /** Buttons are 44 tall (48 on a Thor case). */
    val ButtonHeight: Dp = 44.dp
    val CaseButtonHeight: Dp = 48.dp
}
