package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.indication
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.runtime.collectAsState
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
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first

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
    // Controller: the scene owns the pad over the match. A on the speech box goes on, as a tap anywhere does; X is the Skip button
    // (Randall 10 Nov: two prompts both said "Next"). B skips as well, instead of reaching the match menu under the scene.
    PadScreen(PadActs(x = PadAct("Skip") { close() }, b = "Skip", opaque = true))
    androidx.activity.compose.BackHandler(Pad.connected.collectAsState().value) { close() }
    // Bottom screen (W3): the lines already spoken, newest last, so the thread is never lost; Next and Skip with their keys.
    // The top keeps the portraits and the line, and gives its Skip pill to the bottom.
    BottomScreen {
        ShowcaseCase("Story", title.ifBlank { "The scene" }, scroll = false,
            buttons = listOf(CaseButton("A", "Next", gold = true) { next() }, CaseButton("X", "Skip") { close() })) {
            lines.take(i + 1).takeLast(6).forEachIndexed { k, said -> val w = said.get("who")?.asString
                val sp = w == "stage" || w == "narrator"
                val words = said.get("line")?.asString.orEmpty()
                val last = k == minOf(i, 5)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    if (!sp) Text(person(w)?.get("name")?.asString ?: w.orEmpty(), style = storyCinzel(14f, Rule.Color.Gold))
                    Text(if (last) full.take(shown) else words, style = storyText(16f, FontWeight.Medium, if (last) Rule.Color.Text else CaseMuted)
                        .copy(fontStyle = if (sp) FontStyle.Italic else FontStyle.Normal), maxLines = 4, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                }
            }
        }
    }
    val speech = remember { MutableInteractionSource() }
    // A third speaker stands with whoever they sit nearest: the right (villain) side if it is the villain's line.
    val right = who != null && !stage && who == rightWho
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding(); val bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    // The tap-anywhere layer stays a touch target only; the controller's stop is the speech box below (no full-screen ring).
    BoxWithConstraints(Modifier.fillMaxSize().padLayer().alpha(fade).background(Color(0xFF0B0C10)).focusProperties { canFocus = false }.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { next() }) {
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
            .clip(RoundedCornerShape(18.dp)).border(1.dp, Color(0x66D6AD64), RoundedCornerShape(18.dp)).background(Brush.verticalGradient(listOf(Color(0xEB16171C), Color(0xF20D0E12))))
            .onKeyEvent { e -> val k = e.nativeKeyEvent.keyCode
                if (k == android.view.KeyEvent.KEYCODE_DPAD_CENTER || k == android.view.KeyEvent.KEYCODE_ENTER || k == android.view.KeyEvent.KEYCODE_NUMPAD_ENTER) { if (e.type == KeyEventType.KeyUp) next(); true } else false }
            .indication(speech, PadFocus.Ring).padActs(PadActs(a = "Next")).focusable(interactionSource = speech).padding(horizontal = 22.dp, vertical = 18.dp)) {
            Text(if (stage) "" else (person(who)?.get("name")?.asString ?: who.orEmpty()), style = storyCinzel(15f, Color(0xFFE8B95B)), textAlign = if (right) TextAlign.End else TextAlign.Start, modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp))
            val whisper = l?.get("whisper")?.asBoolean == true || l?.get("offstage")?.asBoolean == true
            Text(full.take(shown), style = storyText(17f, FontWeight.Medium, if (stage) Color(0xFFD8D2C2) else if (whisper) Color(0xFFC9CDD4) else Color(0xFFF4EFE2)).copy(fontStyle = if (stage || whisper) FontStyle.Italic else FontStyle.Normal),
                textAlign = if (stage) TextAlign.Center else TextAlign.Start, modifier = Modifier.fillMaxWidth())
            if (done) Text("▾", style = storyText(14f, FontWeight.Bold, Color(0xFFE8B95B)), modifier = Modifier.align(Alignment.End))
        }
        if (!DualScreen.active) Box(Modifier.align(Alignment.TopEnd).padding(top = top + 14.dp, end = 14.dp).heightIn(min = 44.dp).width(76.dp).clip(RoundedCornerShape(999.dp)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(999.dp)).background(Color(0xB3101218))
            .clickable { close() }, contentAlignment = Alignment.Center) { Text("Skip", style = storyText(14f, FontWeight.Bold, Color(0xFFE9E4D6))) }
    }
}

/** What a Story match leaves on the table: the result note and the ending scene that follows the win (app.js storyPlay finished()). */
class StoryOutcome {
    var note by androidx.compose.runtime.mutableStateOf<String?>(null)
    var ending by androidx.compose.runtime.mutableStateOf<List<JsonObject>?>(null)
    /** Speech waiting to be shown, one bubble at a time. */
    val bubbles = androidx.compose.runtime.mutableStateListOf<dev.cardstashy.nativeplay.play.StoryBubbles.Line>()
}

/** A bubble from the speaker's side of the table, never taking a tap and never pausing play (story-mode.css .st-bubble, docked: theirs top, yours low). */
@Composable
fun StoryBubbleLayer(queue: androidx.compose.runtime.snapshots.SnapshotStateList<dev.cardstashy.nativeplay.play.StoryBubbles.Line>, cast: JsonObject?, avatarUrl: String?, modifier: Modifier = Modifier) {
    var line by remember { mutableStateOf<dev.cardstashy.nativeplay.play.StoryBubbles.Line?>(null) }
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(queue) {
        while (true) {
            val next = androidx.compose.runtime.snapshotFlow { queue.firstOrNull() }.filterNotNull().first()
            line = next; shown = true
            delay(minOf(5200L, 2200L + 45L * next.text.length))
            shown = false; delay(300); queue.removeAt(0); delay(250)
        }
    }
    val a by androidx.compose.animation.core.animateFloatAsState(if (shown) 1f else 0f, androidx.compose.animation.core.tween(if (Motion.still) 0 else 260), label = "bubble")
    val l = line
    if (l != null && a > 0f) {
        val person = cast?.getAsJsonObject(l.who)
        val url = if (l.who == "you") avatarUrl else person?.getAsJsonObject("portrait")?.get("crop")?.asString
        val bias = storyFocus(person?.getAsJsonObject("portrait")?.get("focus")?.asString)
        Box(modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = 12.dp, vertical = if (l.mine) 120.dp else 56.dp)
            .graphicsLayer { alpha = a; scaleX = .92f + .08f * a; scaleY = .92f + .08f * a }, contentAlignment = if (l.mine) Alignment.BottomCenter else Alignment.TopCenter) {
            androidx.compose.foundation.layout.Row(Modifier.widthIn(max = 300.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xF2191A22)).border(1.dp, Color(0x80D6AD64), RoundedCornerShape(16.dp)).padding(10.dp),
                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                if (url != null) StoryPic(url, Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).border(1.5.dp, Color(0xFFD6AD64), RoundedCornerShape(10.dp)), bias)
                Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(2.dp)) {
                    Text(person?.get("name")?.asString ?: "You", style = storyCinzel(12f, Color(0xFFE8B95B)))
                    Text(l.text, style = storyText(14f, FontWeight.Medium, Color(0xFFF6EEDB)))
                }
            }
        }
    }
}
