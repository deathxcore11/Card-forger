package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.Plate
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import dev.cardstashy.nativeplay.art.CardImage
import kotlin.math.abs

/**
 * play-forge-pregame.js reveal: one calm full-screen moment before the opening hand. A two-faced coin (your profile
 * picture, the opponent deck's art) is tossed for 1.5 s and rests on the side Forge already committed. It never
 * decides anything. The whole toss is always seen (Randall, 1 Nov): it starts once this screen is painted and ends
 * only after the result has been on screen 1.3 s.
 */
@Composable
fun TossScreen(toss: MatchController.Toss, cpu: Plate?, onDone: () -> Unit) {
    val context = LocalContext.current
    val reduced = remember { Playmats.reduced(context) }
    val profile by Account.profile.collectAsState()
    val spin = remember { Animatable(0f) }
    val arc = remember { Animatable(0f) }
    var landed by remember { mutableStateOf(false) }
    val target = if (toss.youFirst) 1800f else 1980f
    LaunchedEffect(toss) {
        delay(120) // the screen is painted before the coin moves
        if (toss.flip && !reduced) {
            kotlinx.coroutines.coroutineScope {
                launch { spin.animateTo(target, tween(1500, easing = CubicBezierEasing(.25f, .6f, .3f, 1f))) }
                launch { arc.animateTo(1f, tween(1500, easing = CubicBezierEasing(.3f, .7f, .4f, 1f))) }
            }
        } else { delay(if (reduced) 200 else 250); spin.snapTo(target) }
        landed = true
        delay(if (reduced) 350 else 1300)
        onDone()
    }
    val coin = 190.dp
    val lift = kotlin.math.sin(Math.PI * arc.value.toDouble()).toFloat() // 0 → 1 → 0: the toss's height
    Backdrop("play/playmat-charcoal-table.webp", dim = .6f) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (!landed) (if (toss.flip) "FLIPPING THE COIN…" else "STARTING PLAYER") else (if (toss.flip) "COIN TOSS COMPLETE" else "STARTING PLAYER"),
                style = Type.Label.copy(color = Palette.InkSoft, letterSpacing = 2.sp))
            Box(Modifier.padding(vertical = 34.dp).size(coin)
                .graphicsLayer { translationY = -lift * 120.dp.toPx(); val s = 1f + .06f * lift; scaleX = s; scaleY = s }) {
                val flipped = abs(((spin.value % 360f) + 360f) % 360f - 180f) < 90f // the far face shows between 90° and 270°
                Box(Modifier.fillMaxSize().graphicsLayer { rotationX = spin.value; cameraDistance = 14f * density }) {
                    Box(Modifier.fillMaxSize().graphicsLayer { if (flipped) rotationX = 180f }) {
                        if (!flipped) Face(Color(0xFFE3BB6A), "YOU") { ProfileAvatar(profile, coin - 24.dp, ring = false) }
                        else Face(Color(0xFFD89A57), "CPU") { CardImage(cpu?.face, Modifier.size(coin - 24.dp).clip(CircleShape), crop = true) }
                    }
                }
            }
            val text = if (toss.youFirst) "You play first" else "${cpu?.name ?: "CPU"} plays first"
            Text(text, style = Type.Title.copy(color = if (landed) Palette.GoldBright else Color.Transparent, fontSize = 26.sp, fontWeight = FontWeight.SemiBold))
            Text("Your opening hand is next.", style = Type.Label.copy(color = Palette.InkSoft), modifier = Modifier.padding(top = 6.dp))
        }
    }
}

/** forge-coin-face: a gold coin with its rim rings and the side's tag, the picture inset in a circle. */
@Composable
private fun Face(base: Color, tag: String, picture: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().clip(CircleShape)
        .background(Brush.radialGradient(listOf(Color(0xFFFFF3C8), base, Color(0xFFA07A34), Color(0xFF6E5222))))
        .border(3.dp, Color(0xFFF6DDA0), CircleShape).padding(6.dp).border(3.dp, Color(0xFF8A682C), CircleShape), contentAlignment = Alignment.Center) {
        Box(Modifier.padding(6.dp).clip(CircleShape).background(Color(0xFF18181C))) { picture() }
        Text(tag, style = Type.Label.copy(color = Color(0xFFF6EEDB), fontSize = 11.sp, letterSpacing = 2.sp), modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 22.dp)
            .clip(RoundedCornerShape(999.dp)).background(Color(0xD90C0C0E)).border(1.dp, Color(0x99F2D496), RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 2.dp))
    }
}
