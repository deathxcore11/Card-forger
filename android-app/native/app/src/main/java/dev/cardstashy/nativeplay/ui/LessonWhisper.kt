package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.os.SystemClock
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.play.LessonCoach
import dev.cardstashy.nativeplay.play.StoryLessons
import kotlinx.coroutines.delay

/** The cards a lesson whisper points at (story-mode.css .st-glow): CardFace draws them with a slow gold pulse. */
val LocalLessonGlow = compositionLocalOf<Set<Int>> { emptySet() }

/**
 * One Story match's Rift whispers (app.js storyPlay + story-lessons.js createLessonCoach): fed the snapshots the table shows,
 * one whisper at a time, each on screen for its reading time, a 0.6 s pause between them. The first one of a match offers
 * Skip lessons, which turns lessons off for good on this device.
 */
class LessonTable(context: Context, battleId: String?, playerSide: String) {
    private val app = context.applicationContext
    private val seen = StoryLessons.seen(app)
    private val coach = LessonCoach(StoryLessons.load(app), battleId, playerSide, seen) { SystemClock.elapsedRealtime() }
    private var busy = false
    private var gone = false
    private var shownAny = false

    var whisper by mutableStateOf<LessonCoach.Whisper?>(null); private set
    var visible by mutableStateOf(false); private set
    /** Only the match's first whisper carries Skip lessons. */
    var skippable by mutableStateOf(false); private set
    /** The cards to glow while the whisper is up. */
    val glow: Set<Int> get() = if (visible) whisper?.ids?.toSet().orEmpty() else emptySet()

    fun update(st: MatchState) {
        if (gone || StoryLessons.off(app)) return
        val w = coach.update(st, idle = !busy) ?: return
        busy = true
        coach.shown(w); StoryLessons.saveSeen(app, seen)
        skippable = !shownAny; shownAny = true
        whisper = w; visible = true
    }

    /** The whisper's life on screen: up for min(7 s, 3.2 s + 45 ms a character), out in 0.3 s, then 0.6 s before the next. */
    suspend fun play(w: LessonCoach.Whisper) {
        delay(minOf(7000L, 3200L + w.text.length * 45L))
        visible = false; delay(300)
        if (whisper === w) whisper = null
        delay(600); busy = false
    }

    /** api.destroy: the match is over or lessons were skipped; nothing more shows. */
    fun destroy() { gone = true; visible = false; whisper = null }

    fun skip() { StoryLessons.setOff(app, true); destroy() }
}

/** story-mode.css .st-whisper: a glass note at the right of the board, clear of the dock's buttons; it never takes a tap except Skip lessons. */
@Composable
fun LessonWhisper(lessons: LessonTable) {
    val w = lessons.whisper
    LaunchedEffect(w) { if (w != null) lessons.play(w) }
    val a by animateFloatAsState(if (lessons.visible) 1f else 0f, tween(if (Motion.still) 0 else 300), label = "whisper")
    if (w == null || a <= 0f) return
    BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        // The dock: two buttons stacked from 94 du above the bottom on a phone, one row 180 dp up on a big board.
        val bottom = if (bigBoard(maxWidth, maxHeight)) 232.dp else 104.dp * chromeU(maxWidth, maxHeight)
        val shape = RoundedCornerShape(16.dp)
        Column(Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = bottom).width(minOf(260.dp, maxWidth - 32.dp))
            .graphicsLayer { alpha = a; translationY = (1f - a) * 8.dp.toPx() }
            .background(Brush.verticalGradient(listOf(Color(0xF014161C), Color(0xF50D0F14))), shape).border(1.dp, Color(0x99D6AD64), shape)
            .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 11.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("THE RIFT", style = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 11.sp, lineHeight = 13.sp, letterSpacing = 1.3.sp, color = Color(0xFFD8B565)))
            Text(w.text, style = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 21.sp, color = Color(0xFFF3E7C4)))
            if (lessons.skippable) Box(Modifier.align(Alignment.End).heightIn(min = 44.dp).widthIn(min = 44.dp)
                .background(Color(0x10FFFFFF), RoundedCornerShape(99.dp)).border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(99.dp))
                .clickable { lessons.skip() }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
                Text("Skip lessons", style = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = Color(0xFFF3E7C4)))
            }
        }
    }
}
