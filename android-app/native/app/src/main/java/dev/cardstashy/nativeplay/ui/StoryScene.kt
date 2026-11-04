package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import kotlinx.coroutines.delay

/**
 * Story talking heads (story-ui.js playScene): two portraits, the speaker lit and the others dimmed, stage and narrator lines
 * centred, whisper and offstage lines in italics. One line types out at 2 characters per 18 ms; a tap completes the line, then
 * goes on; Skip closes it. Reduced motion (Minimal effects) shows each line whole. [onDone] fires once, when the scene closes.
 */
@Composable
fun StoryScene(lines: List<JsonObject>, cast: JsonObject?, leftWho: String, rightWho: String, avatarUrl: String?, title: String, onDone: () -> Unit) {
    fun person(who: String?) = cast?.getAsJsonObject(who ?: "")
    fun face(who: String?): Pair<String?, BiasAlignment> =
        if (who == "you" && !avatarUrl.isNullOrBlank()) avatarUrl to BiasAlignment(0f, 0f)
        else person(who)?.getAsJsonObject("portrait").let { it?.get("crop")?.asString to storyFocus(it?.get("focus")?.asString) }
    var i by remember { mutableIntStateOf(0) }
    var shown by remember { mutableIntStateOf(0) }
    var closing by remember { mutableStateOf(false) }
    val l = lines.getOrNull(i)
    val who = l?.get("who")?.asString
    val stage = who == "stage" || who == "narrator"
    val aside = l?.get("aside")?.takeIf { it.isJsonPrimitive }?.asString
    val quote = l?.get("quote")?.takeIf { it.isJsonPrimitive }?.asBoolean == true
    val raw = l?.get("line")?.asString.orEmpty()
    val full = (if (aside != null) "($aside) " else "") + (if (quote) "“$raw”" else raw)
    val still = Motion.still
    val done = shown >= full.length
    LaunchedEffect(i) { shown = if (still) full.length else 0; if (!still) while (shown < full.length) { delay(18); shown = minOf(full.length, shown + 2) } }
    fun close() { if (!closing) closing = true }
    fun next() { if (!done) { shown = full.length; return }; if (i + 1 >= lines.size) close() else i++ }
    val fade by animateFloatAsState(if (closing) 0f else 1f, tween(if (still) 0 else 260), label = "scene") { if (closing && it == 0f) onDone() }
    LaunchedEffect(lines.isEmpty()) { if (lines.isEmpty()) onDone() }
    if (lines.isEmpty()) return
    // A third speaker stands with whoever they sit nearest: the right (villain) side if it is the villain's line.
    val right = who != null && !stage && who == rightWho
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding(); val bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    BoxWithConstraints(Modifier.fillMaxSize().alpha(fade).background(Color(0xFF0B0C10)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { next() }) {
        val (bgUrl, bgAlign) = face(rightWho).let { if (it.first != null) it else face(leftWho) }
        StoryPic(bgUrl, Modifier.fillMaxSize().blur(26.dp).graphicsLayer { alpha = .5f }, BiasAlignment(0f, -.4f))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0xA00B0C10), 1f to Color(0xE60B0C10))))
        val landscape = maxWidth > maxHeight
        val tw = if (landscape) maxWidth * .34f else maxWidth * .56f; val th = if (landscape) maxHeight * .92f else maxHeight * .5f
        @Composable fun Talker(w: String, alignment: Alignment, on: Boolean) {
            val (u, a) = face(w); if (u == null) return
            val lit by animateFloatAsState(if (on && !stage) 1f else 0f, tween(if (still) 0 else 300), label = "lit")
            Box(Modifier.align(alignment).padding(horizontal = 8.dp).width(tw).height(th).graphicsLayer { translationY = (1f - lit) * 14.dp.toPx(); scaleX = .97f + .03f * lit; scaleY = .97f + .03f * lit; alpha = .9f + .1f * lit }) {
                Box(Modifier.matchParentSize().clip(RoundedCornerShape(28.dp, 28.dp, 0.dp, 0.dp)).border(1.5.dp, Color(0x66D6AD64), RoundedCornerShape(28.dp, 28.dp, 0.dp, 0.dp))) {
                    StoryPic(u, Modifier.matchParentSize(), a)
                    Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = .58f * (1f - lit))))
                    Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Transparent, .6f to Color.Transparent, 1f to Color(0xFF0B0C10))))
                }
            }
        }
        Talker(leftWho, Alignment.BottomStart, who != null && who == leftWho || (!stage && who != null && who != rightWho))
        Talker(rightWho, Alignment.BottomEnd, right)
        // The speech box: speaker name in Cinzel gold, the line typing in.
        Column(Modifier.align(Alignment.BottomCenter).padding(start = 16.dp, end = 16.dp, bottom = bottom + 22.dp).widthIn(max = 560.dp).fillMaxWidth().heightIn(min = 120.dp)
            .clip(RoundedCornerShape(18.dp)).border(1.dp, Color(0x66D6AD64), RoundedCornerShape(18.dp)).background(Brush.verticalGradient(listOf(Color(0xEB16171C), Color(0xF20D0E12)))).padding(horizontal = 22.dp, vertical = 18.dp)) {
            Text(if (stage) "" else (person(who)?.get("name")?.asString ?: who.orEmpty()), style = storyCinzel(15f, Color(0xFFE8B95B)), textAlign = if (right) TextAlign.End else TextAlign.Start, modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp))
            val whisper = l?.get("whisper")?.asBoolean == true || l?.get("offstage")?.asBoolean == true
            Text(full.take(shown), style = storyText(17f, FontWeight.Medium, if (stage) Color(0xFFD8D2C2) else if (whisper) Color(0xFFC9CDD4) else Color(0xFFF4EFE2)).copy(fontStyle = if (stage || whisper) FontStyle.Italic else FontStyle.Normal),
                textAlign = if (stage) TextAlign.Center else TextAlign.Start, modifier = Modifier.fillMaxWidth())
            if (done) Text("▾", style = storyText(14f, FontWeight.Bold, Color(0xFFE8B95B)), modifier = Modifier.align(Alignment.End))
        }
        Box(Modifier.align(Alignment.TopEnd).padding(top = top + 14.dp, end = 14.dp).heightIn(min = 44.dp).width(76.dp).clip(RoundedCornerShape(999.dp)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(999.dp)).background(Color(0xB3101218))
            .clickable { close() }, contentAlignment = Alignment.Center) { Text("Skip", style = storyText(14f, FontWeight.Bold, Color(0xFFE9E4D6))) }
    }
}

/** What a Story match leaves on the table: the result note and the ending scene that follows the win (app.js storyPlay finished()). */
class StoryOutcome {
    var note by androidx.compose.runtime.mutableStateOf<String?>(null)
    var ending by androidx.compose.runtime.mutableStateOf<List<JsonObject>?>(null)
}
