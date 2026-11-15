package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * Scry 1 with the card on screen (specs/scry-view-brief.md L1, approved 11 Nov; gaps list 1, 15 Nov: "Bottom" and "Top" with no card,
 * he sat 10 s on it). Forge asks a one-card scry as a plain InputConfirm with no prompt: "Put <card> on the top or bottom of your
 * library?" with Top as its OK and Bottom as its cancel (PlayerControllerHuman.willPutCardOnTop). The card is named only in that line.
 */
object ScryOne {
    private val ASK = Regex("^Put (.+) on the top or bottom of your library\\?$")

    /** The card a one-card scry is about, or null when this is not that question. */
    fun of(st: MatchState): String? {
        val input = st.inputType ?: return null
        if (st.prompt != null || !input.startsWith("InputConfirm") || input == "InputConfirmMulligan") return null
        if (!st.buttons.ok.equals("Top", true) || !st.buttons.cancel.equals("Bottom", true)) return null
        return st.message.lines().map { it.trim() }.firstNotNullOfOrNull { ASK.find(it)?.groupValues?.get(1) }
    }

    /** What asked: your own spell or trigger on top of the stack (the Sorcerer Role's attack trigger), when the table knows it. */
    fun from(st: MatchState): String? = st.stack.firstOrNull()?.takeIf { it.controller == st.viewer }?.source?.name
}

/** The one-card scry over the dimmed table: the card large, then Bottom (Forge's cancel) and Keep on top (Forge's OK, the gold one). */
@Composable
internal fun ScryOneView(st: MatchState, name: String, live: Boolean, d: Du, onTop: () -> Unit, onBottom: () -> Unit) = with(d) {
    PadScreen(PadActs(x = if (live) PadAct("Keep on top") { onTop() } else null))
    BoxWithConstraints(Modifier.fillMaxSize().background(Color(0xE6050608)).pointerInput(Unit) { detectTapGestures { } }, contentAlignment = Alignment.Center) {
        // The card takes about half the height (Arena's scry card), never wider than a third of the screen.
        val cardH = minOf(maxHeight * .5f, maxWidth / 3f * 680f / 488f)
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(16.du)) {
            Text("Scry 1", style = sans(sp(13f), FontWeight.ExtraBold, Color(0xFFE8C77A)))
            Spacer(Modifier.height(10.du))
            CardImage(name, Modifier.height(cardH).width(cardH * 488f / 680f).clip(RoundedCornerShape(10.du))
                .border(1.dp, Color(0x66D6AD64), RoundedCornerShape(10.du)).semantics { contentDescription = "$name, the top card of your library" })
            ScryOne.from(st)?.let { src -> Spacer(Modifier.height(6.du)); Text("From $src", style = sans(sp(11.5f), FontWeight.SemiBold, Color(0xFF9AA2B1))) }
            Spacer(Modifier.height(10.du))
            Text("Keep it on top, or put it on the bottom?", style = sans(sp(14f), FontWeight.SemiBold, Color(0xFFEDF0E8)), textAlign = TextAlign.Center)
            Spacer(Modifier.height(14.du))
            Row(horizontalArrangement = Arrangement.spacedBy(12.du), verticalAlignment = Alignment.CenterVertically) {
                GlassPill("Bottom", live, Modifier, d, height = 44.du, onClick = onBottom)
                GoldPill("Keep on top", live, Modifier, d, padKey = live, height = 44.du, onClick = onTop)
            }
        }
    }
}
