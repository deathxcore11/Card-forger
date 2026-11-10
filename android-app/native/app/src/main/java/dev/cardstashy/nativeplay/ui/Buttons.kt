package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/*
 * The one button family (rulebook R3, specs/rulebook-native.md): Gold (the screen's main action or something earned), Ghost
 * (everything else), Danger (a destructive choice) and Link (words only). 44 tall, 13 corners, Manrope Bold. The older
 * per-screen buttons (DeckGhost, Skin.GoldButton, GoldPlate, the binders' GhostButton) are thin wrappers over these.
 */

/** .btn.cs-cta: the gold gradient button. [muted]: a disabled one that still reads on a light picture. */
@Composable
fun GoldCta(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, muted: Boolean = false, radius: Dp = Rule.Radius.Button, leading: (@Composable () -> Unit)? = null, onClick: () -> Unit) {
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    val k by animateFloatAsState(if (pressed) .96f else 1f, Site.spring(), label = "cta")
    val shape = RoundedCornerShape(radius)
    Row(modifier.scale(k).heightIn(min = Rule.ButtonHeight)
        .then(if (enabled && !HomeTest.noPictures) Modifier.shadow(10.dp, shape, spotColor = Rule.Color.CtaBottom) else Modifier).clip(shape)
        .background(if (enabled) Brush.verticalGradient(listOf(Rule.Color.CtaTop, Rule.Color.CtaBottom)) else if (muted) Brush.verticalGradient(listOf(Rule.Color.CtaMutedTop, Rule.Color.CtaMutedBottom)) else Brush.verticalGradient(listOf(Rule.Color.CtaOffTop, Rule.Color.CtaOffBottom)))
        .border(1.dp, if (enabled) Rule.Color.CtaEdge else if (muted) Rule.Color.CtaMutedEdge else Rule.Color.CtaOffEdge, shape)
        .let { if (enabled) it.clickable(press, PadFocus.Ring, onClick = onClick) else it }.semantics { role = Role.Button }.padding(horizontal = 22.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
        leading?.invoke()
        Text(label, style = Rule.Type.sans(15, FontWeight.ExtraBold, if (enabled) Rule.Color.CtaInk else if (muted) Rule.Color.CtaMutedInk else Rule.Color.CtaOffInk).copy(letterSpacing = .03.em), maxLines = 1, softWrap = false)
    }
}

/** The glass button. [gold]: a gold edge and gold words, for the second-most important choice. */
@Composable
fun GhostButton(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, gold: Boolean = false, minHeight: Dp = Rule.ButtonHeight, pad: Dp = 16.dp, onClick: () -> Unit) =
    Plain(label, modifier, enabled, if (gold) Rule.Color.GoldEdge else Rule.Color.Edge, if (gold) Rule.Color.Gold else Rule.Color.Text, minHeight, pad, onClick)

/** A destructive choice (Delete, Remove, Concede): the glass button with a coral edge and coral words. */
@Composable
fun DangerButton(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) =
    Plain(label, modifier, enabled, Rule.Color.Coral.copy(alpha = .5f), Rule.Color.Coral, Rule.ButtonHeight, 16.dp, onClick)

/** Words only, in gold: a way onward that is not the screen's main action. Still 44 tall to the finger and the ring. */
@Composable
fun LinkButton(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(modifier.alpha(if (enabled) 1f else .45f).heightIn(min = Rule.ButtonHeight).clip(RoundedCornerShape(Rule.Radius.Button))
        .clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button }.padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
        Text(label, style = Rule.Type.Button.copy(color = Rule.Color.Gold), maxLines = 1)
    }
}

@Composable
private fun Plain(label: String, modifier: Modifier, enabled: Boolean, edge: Color, ink: Color, minHeight: Dp, pad: Dp, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Rule.Radius.Button)
    Box(modifier.alpha(if (enabled) 1f else .45f).heightIn(min = minHeight).clip(shape).background(Rule.Color.Glass).border(1.dp, edge, shape)
        .clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button }.padding(horizontal = pad), contentAlignment = Alignment.Center) {
        Text(label, style = Rule.Type.Button.copy(color = ink), maxLines = 1)
    }
}
