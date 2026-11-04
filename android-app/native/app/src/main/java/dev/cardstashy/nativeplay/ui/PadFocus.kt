package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.interaction.FocusInteraction
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.invalidateDraw
import kotlinx.coroutines.launch

/**
 * The app's press and focus look for every clickable (LocalIndication).
 * A press dims like before (foundation's default, black at 30 %). Keyboard, d-pad or controller focus
 * gets a gold ring with a soft glow, so a handheld (AYN Thor and the like) always shows where A will land.
 * Touch never focuses a clickable, so phones never see the ring.
 */
object PadFocus : IndicationNodeFactory {
    val Gold = Color(0xFFE8B95B)
    override fun create(interactionSource: InteractionSource): DelegatableNode = Node(interactionSource, dim = true)
    override fun equals(other: Any?) = other === this
    override fun hashCode() = 7

    /** For controls that draw their own press (a scale or glow): only the controller's focus ring, no dim. */
    object Ring : IndicationNodeFactory {
        override fun create(interactionSource: InteractionSource): DelegatableNode = Node(interactionSource, dim = false)
        override fun equals(other: Any?) = other === this
        override fun hashCode() = 8
    }

    private class Node(private val source: InteractionSource, private val dim: Boolean) : Modifier.Node(), DrawModifierNode {
        private var pressed = 0
        private var focused = 0
        private val ring = Animatable(0f)

        override fun onAttach() {
            coroutineScope.launch {
                source.interactions.collect { i ->
                    when (i) {
                        is PressInteraction.Press -> pressed++
                        is PressInteraction.Release, is PressInteraction.Cancel -> pressed = (pressed - 1).coerceAtLeast(0)
                        is FocusInteraction.Focus -> { focused++; coroutineScope.launch { ring.animateTo(1f, tween(140)) { invalidateDraw() } } }
                        is FocusInteraction.Unfocus -> { focused = (focused - 1).coerceAtLeast(0); if (focused == 0) coroutineScope.launch { ring.animateTo(0f, tween(120)) { invalidateDraw() } } }
                    }
                    invalidateDraw()
                }
            }
        }

        override fun ContentDrawScope.draw() {
            drawContent()
            if (dim && pressed > 0) drawRect(Color.Black.copy(alpha = .3f))
            val k = ring.value
            if (k > 0f) {
                val r = CornerRadius(14.dp(this), 14.dp(this))
                val w = 2.5f * density
                // A gold wash, then a cream edge with a dark seam inside it, so the ring reads on dark glass and on gold buttons alike.
                drawRoundRect(Gold.copy(alpha = .12f * k), cornerRadius = r)
                drawRoundRect(Color(0xFF0C0D10).copy(alpha = .75f * k), Offset(w * 1.5f, w * 1.5f), Size(size.width - 3 * w, size.height - 3 * w), r, style = Stroke(w))
                drawRoundRect(Color(0xFFFFF1CF).copy(alpha = k), Offset(w / 2, w / 2), Size(size.width - w, size.height - w), r, style = Stroke(w))
            }
        }

        private fun Int.dp(s: ContentDrawScope) = this * s.density
    }
}
