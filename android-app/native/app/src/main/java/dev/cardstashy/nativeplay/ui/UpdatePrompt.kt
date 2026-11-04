package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * The app's own update prompt (Randall 4 Nov: "app needs auto update download"). Same card as the day's log-in reward:
 * warm glass, gold hairline, one gold button. Android always asks the player to confirm an install from outside the Play
 * Store, so the flow is: offer -> download in the app -> (first time only) allow installs from CardStashy -> install.
 */
sealed interface UpdateUi {
    data class Offer(val version: String, val bytes: Long, val notes: List<Pair<String, String>>) : UpdateUi
    data class Downloading(val version: String, val done: Long, val total: Long) : UpdateUi
    data class Allow(val version: String) : UpdateUi
    data class Ready(val version: String) : UpdateUi
    data class Failed(val version: String, val why: String) : UpdateUi
}

private val Eyebrow = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = 1.6.sp, color = Color(0xFFB9BFC9))
private val Title = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 24.sp, color = Color(0xFFF3E3BD), textAlign = TextAlign.Center)
private val Body = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp, color = Color(0xFFC9CDD4), textAlign = TextAlign.Center)
private val Small = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = Color(0xFF9EA4AE), textAlign = TextAlign.Center)

private fun mb(bytes: Long) = if (bytes <= 0) "" else "%d MB".format(((bytes + 524_288) / 1_048_576).coerceAtLeast(1))

@Composable
fun UpdatePrompt(ui: UpdateUi, onUpdate: () -> Unit, onAllow: () -> Unit, onInstall: () -> Unit, onRetry: () -> Unit, onCancel: () -> Unit, onLater: () -> Unit) {
    val enter = remember { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(Unit) { enter.animateTo(1f, spring(dampingRatio = .72f, stiffness = Spring.StiffnessMediumLow)) }
    BackHandler { if (ui is UpdateUi.Downloading) onCancel() else onLater() }
    BoxWithConstraints(Modifier.fillMaxSize().graphicsLayer { alpha = enter.value.coerceIn(0f, 1f) }.background(Color(0xCC07080B))
        .clickable(remember { MutableInteractionSource() }, null) {}.windowInsetsPadding(WindowInsets.safeDrawing), contentAlignment = Alignment.Center) {
        // Held sideways (handhelds, a folded phone on its side) the card tightens up so it fits without scrolling.
        val short = maxHeight < 480.dp
        val gap = if (short) 10.dp else 16.dp
        val shape = RoundedCornerShape(26.dp)
        Column(Modifier.padding(if (short) 12.dp else 24.dp).widthIn(max = 380.dp).fillMaxWidth().heightIn(max = maxHeight)
            .graphicsLayer { val k = .86f + .14f * enter.value; scaleX = k; scaleY = k }
            .background(Brush.verticalGradient(listOf(Color(0xFF221B12), Color(0xFF111217))), shape)
            .border(1.dp, Brush.verticalGradient(listOf(Color(0x99E9C27A), Color(0x22E9C27A))), shape)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 22.dp, vertical = if (short) 16.dp else 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(gap)) {
            when (ui) {
                is UpdateUi.Offer -> {
                    Text("UPDATE READY", style = Eyebrow)
                    Text("Version ${ui.version}", style = Title)
                    if (ui.notes.isNotEmpty()) Column(Modifier.fillMaxWidth().background(Color(0x0FFFFFFF), RoundedCornerShape(16.dp))
                        .border(1.dp, Color(0x26D6AD64), RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        ui.notes.take(4).forEach { (tag, line) ->
                            Text(buildAnnotatedString {
                                withStyle(SpanStyle(color = Color(0xFFE2B866), fontWeight = FontWeight.Bold)) { append(tag) }; append("  "); append(line)
                            }, style = Body.copy(textAlign = TextAlign.Start, fontSize = 13.sp, lineHeight = 18.sp))
                        }
                    }
                    GoldCta("Update", Modifier.fillMaxWidth()) { onUpdate() }
                    Text(listOf(mb(ui.bytes), "Your decks and progress stay put").filter { it.isNotEmpty() }.joinToString(" · "), style = Small)
                    Later("Later", onLater)
                }
                is UpdateUi.Downloading -> {
                    Text("UPDATING", style = Eyebrow)
                    Text("Downloading ${ui.version}", style = Title)
                    val f = if (ui.total > 0) (ui.done.toFloat() / ui.total).coerceIn(0f, 1f) else 0f
                    val shown by animateFloatAsState(f, spring(stiffness = Spring.StiffnessLow), label = "dl")
                    Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(Color(0x22FFFFFF))) {
                        Box(Modifier.fillMaxHeight().fillMaxWidth(shown).clip(RoundedCornerShape(4.dp))
                            .background(Brush.horizontalGradient(listOf(Color(0xFFA9802F), Color(0xFFE2B866), Color(0xFFF2CF7E)))))
                    }
                    Text(if (ui.total > 0) "${mb(ui.done).ifEmpty { "0 MB" }} of ${mb(ui.total)}" else "Starting…", style = Small)
                    Later("Cancel", onCancel)
                }
                is UpdateUi.Allow -> {
                    Text("ONE-TIME STEP", style = Eyebrow)
                    Text("Allow updates", style = Title)
                    Text("Android needs your OK before CardStashy can install its own updates. Turn on “Allow from this source”, then come back.", style = Body)
                    GoldCta("Open settings", Modifier.fillMaxWidth()) { onAllow() }
                    Later("Not now", onLater)
                }
                is UpdateUi.Ready -> {
                    Text("DOWNLOADED", style = Eyebrow)
                    Text("Ready to install", style = Title)
                    Text("Android will ask you to confirm. The app restarts on ${ui.version}.", style = Body)
                    GoldCta("Install", Modifier.fillMaxWidth()) { onInstall() }
                    Later("Later", onLater)
                }
                is UpdateUi.Failed -> {
                    Text("UPDATE", style = Eyebrow)
                    Text("Download stopped", style = Title)
                    Text(ui.why, style = Body)
                    GoldCta("Try again", Modifier.fillMaxWidth()) { onRetry() }
                    Later("Later", onLater)
                }
            }
        }
    }
}

@Composable
private fun Later(label: String, onClick: () -> Unit) {
    Row(Modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFFD6AD64)))
    }
}
