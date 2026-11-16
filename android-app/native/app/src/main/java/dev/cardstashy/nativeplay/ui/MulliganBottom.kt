package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/** The deck you brought, for the opening hand's bottom screen: its name (the versus plate's), Forge's format and its card count. */
internal data class MullDeck(val name: String, val format: String, val count: Int)

/** The deck Forge was handed for you (the match input's humanDeck and format); [name] is the plate's, since Forge's seat is "You". */
internal fun mullDeckOf(input: String, name: String?): MullDeck? = runCatching {
    val o = JsonParser.parseString(input).asJsonObject.getAsJsonObject("input")
    val d = o.getAsJsonObject("humanDeck")
    val count = d.getAsJsonArray("cards")?.sumOf { e -> if (e.isJsonObject) e.asJsonObject.get("qty")?.asInt ?: 1 else 1 } ?: 0
    val format = o.get("format")?.asString.orEmpty().let { if (it == "Brawl") "Standard Brawl" else it }
    MullDeck(name?.takeIf { it.isNotBlank() } ?: return@runCatching null, format, count)
}.getOrNull()

/**
 * The opening hand's words (0.4.59 T9), all from Forge. Seen on the real engine (MulliganProbe, Modern and Commander 1v1): a
 * mulligan draws 7 new cards and Forge at once asks to return N to the bottom (InputLondonMulligan, "Return N card(s) to the
 * bottom of your library", N counting down as you pick), then asks Keep or Mulligan again with the smaller hand. So [mulls] is
 * 7 less the hand at the keep question, or Forge's N plus the cards already picked while it asks for the bottom.
 */
internal data class MullLines(val mulls: Int, val mullLine: String?, val caption: String)

/** A card you may pick at the opening hand: one Forge lists, or, while it asks for the bottom (it lists none), any card in your hand. */
internal fun mullPickable(st: MatchState, live: Boolean, card: Card): Boolean =
    live && (card.id in st.selection.cards || (st.inputType == "InputLondonMulligan" && st.me.hand.any { it.id == card.id }))

internal fun mulliganLines(st: MatchState): MullLines {
    val hand = st.me.hand.size
    if (st.inputType == "InputLondonMulligan") {
        val left = Regex("(?i)return (\\d+) card").find(st.message)?.groupValues?.get(1)?.toIntOrNull() ?: 0
        val first = st.message.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() }.orEmpty()
        // Forge's own line, its "card(s)" said once.
        val caption = if (left == 0) "Done. Keep these ${hand - st.selection.chosenCards.size}." else first.replace("card(s)", if (left == 1) "card" else "cards")
        return MullLines(left + st.selection.chosenCards.size, null, caption)
    }
    val mulls = (7 - hand).coerceAtLeast(0)
    val caption = if (mulls == 0) (if (hand > 1) "$hand cards · you may mulligan to ${hand - 1}" else "$hand card") else "You keep $hand."
    return MullLines(mulls, "Draw 7 new cards, then put ${mulls + 1} on the bottom.", caption)
}

/**
 * Better table scene 11: the gold button at the keep question carries the hand it keeps ("Keep 7", Forge's own word and your hand's
 * count); anything else Forge says there (its "OK" while it asks for the bottom) stands as it is.
 */
internal fun keepLabel(st: MatchState): String {
    val ok = st.buttons.ok ?: "Keep"
    return if (st.inputType == "InputConfirmMulligan" && ok.equals("Keep", ignoreCase = true) && st.me.hand.isNotEmpty()) "$ok ${st.me.hand.size}" else ok
}

/** Better table scene 11: the hand a mulligan leaves you ("to 6": Forge draws 7 and you put one more on the bottom each time). */
internal fun mullTo(st: MatchState): String? =
    st.me.hand.size.takeIf { st.inputType == "InputConfirmMulligan" && it > 1 }?.let { "to ${it - 1}" }

/**
 * Better table scene 11: what the CPU kept, only once Forge's state says it has kept. Seen on the real engine (MulliganProbe, 16 Nov):
 * Forge asks in rounds, in turn order, and sends a "mulligan" event (its player) each time a player takes one; nothing is sent for a
 * keep. So at your keep question the CPU has decided as many rounds as you have mulliganed, one more when it goes first, and it has
 * kept when it took fewer mulligans than that. Its hand is Forge's count. Null when it has not decided yet, or in a pod.
 */
internal fun cpuKept(st: MatchState, youFirst: Boolean): Int? {
    if (st.inputType != "InputConfirmMulligan" || st.players.size != 2) return null
    val cpu = st.players.firstOrNull { it.id != st.viewer } ?: return null
    val mulls = st.events.filter { it.type == "mulligan" }
    val mine = mulls.count { it.player == st.viewer }
    val theirs = mulls.count { it.player == cpu.id }
    val decided = mine + if (youFirst) 0 else 1
    return cpu.handCount.takeIf { decided > 0 && theirs < decided }
}

/** The line under who goes first: "CPU kept 7", else none. */
internal fun cpuKeptLine(st: MatchState, youFirst: Boolean): String? = cpuKept(st, youFirst)?.let { "CPU kept $it" }

/**
 * 0.4.59 T9, two screens: the opening hand's bottom screen, no logo. Left, the card under the ring read in full (the T7 panel);
 * right, three glass tiles (who plays first, this hand counted, your deck), then Keep (gold) and Mulligan with its line. The seven
 * cards stay on the top screen, where Left and Right walk the ring.
 */
@Composable
internal fun MulliganBottom(st: MatchState, lines: MullLines, ringed: Card?, deck: MullDeck?, yours: Boolean, choosing: Boolean, youFirst: Boolean,
                            /** Better table scene 11: the held "View table" (it hides the hand on the top screen), and what the CPU kept. */
                            peek: TablePeek? = null, kept: String? = null,
                            onKeep: () -> Unit, onMull: () -> Unit) {
    val hand = st.me.hand
    Row(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF15171D), Color(0xFF0B0C10)))).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.weight(1.1f).fillMaxHeight()) {
            ringed?.let { ReadingPanel(Reading("In your opening hand", it, null, Reading.Tone.NONE), Modifier.fillMaxSize().anchorRect("m.read")) }
        }
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Tile("Who plays first", if (youFirst) "You go first" else "CPU goes first", kept, Modifier.anchorRect("m.first"))
            val lands = hand.count { it.isLand }
            Tile("This hand", "${hand.size} cards", "$lands ${if (lands == 1) "land" else "lands"} · ${hand.size - lands} ${if (hand.size - lands == 1) "spell" else "spells"}", Modifier.anchorRect("m.hand"))
            deck?.let { Tile("Your deck", it.name, "${it.format} · ${it.count} cards", Modifier.anchorRect("m.deck")) }
            Box(Modifier.weight(1f))
            Text(lines.caption, Modifier.fillMaxWidth(), style = small(12.5f, Color(0xFFE6DCC6), FontWeight.Medium), textAlign = TextAlign.Center, maxLines = 2)
            if (peek != null && !choosing) PeekTablePill(peek, Du(1f), Modifier.align(Alignment.CenterHorizontally))
            if (yours) {
                val shape = RoundedCornerShape(999.dp)
                Box(Modifier.fillMaxWidth().height(46.dp).clip(shape).background(if (st.buttons.okEnabled) Brush.verticalGradient(listOf(Color(0xFFF3D27E), Color(0xFFC4903A)))
                    else Brush.verticalGradient(listOf(Color(0x33FFFFFF), Color(0x22FFFFFF)))).clickable(enabled = st.buttons.okEnabled, onClick = onKeep).anchorRect("m.keep"),
                    contentAlignment = Alignment.Center) {
                    Text(keepLabel(st), style = small(16f, Color(0xFF1B1408), FontWeight.ExtraBold))
                }
                if (!choosing) st.buttons.cancel?.takeIf { st.buttons.cancelEnabled }?.let { label ->
                    Box(Modifier.fillMaxWidth().height(42.dp).clip(shape).background(Color(0xE60C0D12)).border(1.dp, Color(0x26FFFFFF), shape).clickable(onClick = onMull).anchorRect("m.mull"),
                        contentAlignment = Alignment.Center) { Text(label, style = small(15f, Color(0xFFF3E9D2), FontWeight.Bold)) }
                    lines.mullLine?.let { Text(it, Modifier.fillMaxWidth().anchorRect("m.line"), style = small(11.5f, Color(0xFFCFC6B2), FontWeight.Medium), textAlign = TextAlign.Center, maxLines = 2) }
                }
            }
        }
    }
}

@Composable
private fun Tile(tag: String, value: String, sub: String?, modifier: Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Column(modifier.fillMaxWidth().clip(shape).background(Color(0xC7121620)).border(1.dp, Color(0x61E3C070), shape).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(tag.uppercase(), style = small(10f, Site.Gold, FontWeight.ExtraBold).copy(letterSpacing = 1.4.sp))
        Text(value, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Site.Text), maxLines = 1, overflow = TextOverflow.Ellipsis)
        sub?.let { Text(it, style = small(12f, Site.Muted, FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis) }
    }
}
