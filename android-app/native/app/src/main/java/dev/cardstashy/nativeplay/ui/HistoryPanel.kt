package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.foundation.gestures.animateScrollBy
import kotlinx.coroutines.launch
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref

/*
 * The in-match "History & stack" panel, ported from the site:
 *  - storyLines (experiments/forge-proof/cpu-action-playback.mjs) turns the engine's events into plain-words lines;
 *  - tellStory (experiments/forge-proof/forge-table.mjs) keeps them by event number (400 at most) and shows the last 40;
 *  - the inspector rail (experiments/phase-engine/match-table.mjs render()) holds the "Close inspector" button,
 *    the "Stack · N" list and the "Game progress" disclosure; the look is match-table.css + play-forge-table.css
 *    as measured in Chrome at 844 × 390 (one design unit = one CSS px there).
 */

/** One history line (storyLines' {seq, turn, text, card?}). */
data class StoryLine(val seq: Long, val turn: Int, val text: String, val card: Int? = null)

/**
 * An engine event as storyLines reads it. [number] (turn events), [fizzled] (resolve events) and [token] (zone events)
 * are keys the bridge sends that [GameEvent] does not carry yet, so [Story.take] passes them as absent, which is
 * what the site's code does when a key is missing.
 */
data class StoryEvent(val e: GameEvent, val number: Int? = null, val fizzled: Boolean = false, val token: Boolean = false)

/** What storyLines reads from the board (surface): who you are, what the table calls each seat, and the cards it can see. */
class StorySurface(val me: Int?, val labels: Map<Int, String>, val cards: Map<Int, Card>) {
    companion object {
        /** forge-session.mjs projectForge: players[].label and the cards by id (known when shown face up with a name). */
        fun of(st: MatchState): StorySurface {
            val cards = LinkedHashMap<Int, Card>()
            for (p in st.players) for (c in p.hand + p.battlefield + p.graveyard + p.exile + p.command) cards.putIfAbsent(c.id, c)
            for (s in st.stack) s.source?.let { cards.putIfAbsent(it.id, it) }
            val me = st.players.firstOrNull { it.id == st.viewer }?.id
            val labels = HashMap<Int, String>()
            // "CPU" in a duel; in a Commander pod each CPU by its commander (a friend's name and the deck alias are not in MatchState).
            st.players.forEachIndexed { seat, p ->
                labels[p.id] = when {
                    p.id == st.viewer -> "You"
                    st.players.size == 2 -> "CPU"
                    else -> cards.values.firstOrNull { it.commander && it.owner == p.id && known(it) }?.name?.split(Regex(",| // "))?.first()?.trim()?.takeIf { it.isNotEmpty() }
                        ?: "CPU $seat"
                }
            }
            return StorySurface(me, labels, cards)
        }
        internal fun known(c: Card) = !c.hidden && c.name.isNotEmpty()
    }
}

private fun listWords(xs: List<String>): String = if (xs.size < 3) xs.joinToString(" and ") else "${xs.dropLast(1).joinToString(", ")} and ${xs.last()}"

/**
 * The match history in plain words, for both sides (Arena's game log): "You cast Biotech Specialist.",
 * "Chandra's Pyreling and Burnished Hart blocked Biotech Specialist." One entry per public event, keyed by
 * its sequence number so a history kept across boards never repeats a line. Draws and other hidden moves stay out.
 */
fun storyLines(items: List<StoryEvent>, surface: StorySurface): List<StoryLine> {
    val me = surface.me
    val rivals = surface.labels.filterKeys { it != me }
    fun who(id: Int?): String = if (id != null && id == me) "You" else rivals[id] ?: "CPU"
    fun card(ref: Ref?): String? = if (ref?.kind == "card") {
        val c = surface.cards[ref.id]
        if (c != null && StorySurface.known(c)) c.name else ref.name?.takeIf { it.isNotEmpty() }
    } else null
    fun target(ref: Ref?): String? = if (ref?.kind == "player") (if (ref.id == me) "you" else who(ref.id)) else card(ref)
    val out = ArrayList<StoryLine>()
    fun push(e: GameEvent, text: String?, id: Int? = null) { if (!text.isNullOrEmpty()) out += StoryLine(e.seq, e.turn, text, id) }
    for (x in items) {
        val e = x.e
        when (e.type) {
            "turn" -> push(e, "Turn ${x.number ?: e.turn} · ${if (e.player != null && e.player == me) "your turn" else "${who(e.player)}’s turn"}")
            "land" -> push(e, card(e.card)?.let { "${who(e.player)} played $it." }, e.card?.id)
            "cast", "ability" -> {
                val name = card(e.source) ?: continue
                val aims = e.targets.mapNotNull { target(it) }
                push(e, "${who(e.player)} ${if (e.type == "cast") "cast" else "activated"} $name${if (e.type == "ability") "’s ability" else ""}${if (aims.isNotEmpty()) " targeting ${listWords(aims)}" else ""}.", e.source?.id)
            }
            "trigger" -> push(e, card(e.source)?.let { "$it triggered." }, e.source?.id)
            "resolve" -> if (x.fizzled) push(e, card(e.source)?.let { "$it didn’t resolve: no legal targets." }, e.source?.id)
            "attack" -> {
                val by = e.attackers.mapNotNull { (a, to) -> card(a)?.let { it to target(to) } }
                if (by.isEmpty()) continue
                val tos = by.mapNotNull { it.second }.distinct()
                push(e, "${who(e.player)} attacked${if (tos.size == 1) " ${tos[0]}" else ""} with ${listWords(by.map { it.first })}.")
            }
            "block" -> {
                val by = LinkedHashMap<String, List<String>>()
                for ((b, blocking) in e.blockers) {
                    val n = card(b); val a = blocking?.let { card(Ref("card", it, null)) }
                    if (n != null && a != null) by[a] = (by[a] ?: emptyList()) + n
                }
                for ((a, bs) in by) push(e, "${listWords(bs)} blocked $a.")
            }
            "damage" -> {
                val from = card(e.source); val to = target(e.target)
                if (from != null && to != null && (e.amount ?: 0) > 0) push(e, "$from dealt ${e.amount} damage to $to.", e.source?.id)
            }
            "life" -> if (e.lifeFrom != null && e.lifeTo != null && e.lifeTo > e.lifeFrom) push(e, "${who(e.player)} gained ${e.lifeTo - e.lifeFrom} life.")
            "zone" -> {
                val n = card(e.card) ?: continue
                val id = e.card?.id
                if (e.from == "Battlefield" && e.to == "Graveyard")
                    push(e, "$n ${if (Regex("Creature").containsMatchIn(surface.cards[id]?.type?.takeIf { it.isNotEmpty() } ?: "Creature")) "died" else "went to the graveyard"}.", id)
                else if (e.to == "Exile" && e.from != "Stack") push(e, "$n was exiled.", id)
                else if (e.to == "Battlefield" && x.token) push(e, "${who(e.player)} created ${if (Regex("^[aeiou]", RegexOption.IGNORE_CASE).containsMatchIn(n)) "an" else "a"} $n.", id)
                else if (e.from == "Battlefield" && e.to == "Hand") push(e, "$n returned to its owner’s hand.", id)
            }
        }
    }
    return out
}

/**
 * tellStory's memory for one match: lines kept by event number, so the story outlives the engine's short event window
 * (400 kept, the last 40 shown). Hold one per match (`remember(matchId) { Story() }`) and call [take] with every new
 * state, open or not, as the site does after each render. It also keeps the panel's own state that the site keeps
 * across renders: whether "Game progress" is open (data-keep-open) and the scroll (data-keep-scroll).
 */
class Story {
    private val kept = LinkedHashMap<Long, StoryLine>()
    /** The last 40 lines, oldest first. */
    var rows by mutableStateOf(emptyList<StoryLine>()); private set
    var progressOpen by mutableStateOf(false)
    val scroll = ScrollState(0)

    fun take(st: MatchState) = take(st.events.map { StoryEvent(it, it.number, it.fizzled, it.token) }, StorySurface.of(st))

    fun take(events: List<StoryEvent>, surface: StorySurface) {
        for (line in storyLines(events, surface)) if (!kept.containsKey(line.seq)) kept[line.seq] = line
        if (kept.size > 400) kept.keys.take(kept.size - 400).toList().forEach { kept.remove(it) }
        val next = kept.values.toList().takeLast(40)
        if (next.isEmpty() || next.map { it.seq } == rows.map { it.seq }) return
        rows = next
    }
}

// Colours and type from the measured site panel (aside.play-match-inspector at 844 × 390).
private val PanelBg = Color(0xF7121215)          // #121215f7
private val PanelEdge = Color(0x40D6AD64)        // var(--ob-line), rgba(214,173,100,.25)
private val PanelShadow = Color(0xCC000000)      // 0 18px 44px #000c
private val Ink = Color(0xFFEEE6D4)              // rgb(238,230,212)
private val Soft = Color(0xFFC6D7DC)             // .play-match-inspector p/ol: #c6d7dc
private val Line = Color(0x30C3D8DF)             // var(--play-line), rgba(195,216,223,.19)
private val ButtonBg = Color(0xFF203239)         // rgb(32,50,57)

private fun cssText(family: FontFamily, px: TextUnit, line: TextUnit, color: Color, weight: FontWeight = FontWeight.Normal, tracking: TextUnit = TextUnit.Unspecified) =
    TextStyle(fontFamily = family, fontWeight = weight, fontSize = px, lineHeight = line, letterSpacing = tracking, color = color,
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None))

/**
 * The History & stack panel, top right under the header (play-forge-table.css: top and right var(--edge) = 8, width
 * var(--hud) + 24 = 192, max-height 100dvh − 2 × edge − 230, scrolling). [u] is the table's design unit (ForgeTable's
 * `Du.u`: dp per site CSS px at 844 × 390); draw it over the whole board, it places itself.
 *
 * As on the site, a line naming a card carries that card ([StoryLine.card]) but the site wires no tap to it, so
 * [onInspect] is not called from here.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun HistoryPanel(st: MatchState, story: Story, onInspect: (Card) -> Unit, onClose: () -> Unit, u: Float) {
    LaunchedEffect(st) { story.take(st) }
    // A controller: B closes the panel (as Close inspector does) instead of leaving the match, and LT / RT scroll it a page
    // (its lines take no focus). A phone with no pad keeps its back as it was.
    val scope = rememberCoroutineScope()
    androidx.activity.compose.BackHandler(Pad.connected.collectAsState().value) { onClose() }
    PadScreen(PadActs(b = "Close", page = { dir -> scope.launch { story.scroll.animateScrollBy(dir * story.scroll.viewportSize * .85f) } }, pageLabel = "Scroll", opaque = true))
    fun du(px: Float): Dp = (px * u).dp
    fun sp(px: Float): TextUnit = (px * u).sp
    val sans = Type.Sans
    BoxWithConstraints(Modifier.fillMaxSize().padLayer()) {
        val maxH = (maxHeight - du(8f * 2 + 230f)).coerceAtLeast(0.dp)
        val shape = RoundedCornerShape(du(16f))
        val density = LocalDensity.current
        // The button floats right and sticks to the top of the scroll; the first lines of the panel wrap beside it.
        var buttonW by remember { mutableIntStateOf(0) }
        val floatW = with(density) { buttonW.toDp() } + du(7f)
        Box(
            Modifier.align(Alignment.TopEnd).padding(top = du(8f), end = du(8f)).width(du(192f)).heightIn(max = maxH)
                .drawBehind {
                    drawIntoCanvas { c ->
                        val blur = du(44f).toPx() / 2f
                        val p = Paint().asFrameworkPaint().apply {
                            isAntiAlias = true; color = PanelShadow.toArgb()
                            if (blur > .5f) maskFilter = android.graphics.BlurMaskFilter((blur - .5f) / .57735f, android.graphics.BlurMaskFilter.Blur.NORMAL)
                        }
                        val r = du(16f).toPx(); val dy = du(18f).toPx()
                        c.nativeCanvas.drawRoundRect(0f, dy, size.width, size.height + dy, r, r, p)
                    }
                }
                .clip(shape).background(PanelBg, shape).border(1.dp * u, PanelEdge, shape)
                .semantics { contentDescription = "History & stack" },
        ) {
            Column(Modifier.padding(du(1f)).verticalScroll(story.scroll).padding(du(16f))) {
                val stack = st.stack
                // .play-match-stack: hidden when nothing is waiting (:has(.play-match-stack-empty)).
                if (stack.isNotEmpty()) {
                    Row(Modifier.fillMaxWidth()) {
                        // h2: Manrope 800, 16px / 1.15, −0.02em, 10px below.
                        Text("Stack · ${stack.size}", Modifier.weight(1f).padding(bottom = du(10f)),
                            style = cssText(Site.Manrope, sp(16f), sp(18.4f), Ink, FontWeight.ExtraBold, sp(-.32f)))
                        Spacer(Modifier.width(floatW))
                    }
                    val surface = StorySurface.of(st)
                    stack.forEachIndexed { i, entry ->
                        // The source Forge names for the entry (fix list B7): the card on the table, else the entry's own copy of it.
                        val src = (surface.cards[entry.source?.id]?.takeIf { StorySurface.known(it) } ?: entry.source?.takeIf { StorySurface.known(it) })?.name
                        val name = if (src == null) "Ability or spell" else if (entry.ability) "$src ability" else src
                        // p: 13px / 1.55, #c6d7dc, 8px apart (margins collapse; the heading's 10px wins above the first).
                        Text(name, Modifier.padding(top = if (i == 0) 0.dp else du(8f)), style = cssText(sans, sp(13f), sp(20.15f), Soft))
                    }
                    // The section's 15px bottom margin and the details' 10px top margin collapse to 15.
                    Spacer(Modifier.height(du(15f)))
                } else Spacer(Modifier.height(du(10f)))
                // details[data-keep-open=game-progress]: 12px, a hairline on top; closed until opened.
                Column(Modifier.fillMaxWidth()) {
                    Box(Modifier.fillMaxWidth().height(1.dp * u).background(Line))
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = du(32f))
                            .clickable(role = Role.Button) { story.progressOpen = !story.progressOpen }
                            .semantics { stateDescription = if (story.progressOpen) "Expanded" else "Collapsed" }
                            .padding(vertical = du(6f)),
                    ) {
                        // The summary's own disclosure triangle, inline before the words (Chrome's: about 6 × 7 px, 13 px with its gap).
                        val open = story.progressOpen
                        Text(buildAnnotatedString { appendInlineContent("marker", if (open) "▼" else "▶"); append("Game progress") }, Modifier.weight(1f),
                            style = cssText(sans, sp(12f), sp(16.8f), Ink),
                            inlineContent = mapOf("marker" to InlineTextContent(Placeholder(sp(13f), sp(16.8f), PlaceholderVerticalAlign.TextCenter)) {
                                Canvas(Modifier.fillMaxSize()) {
                                    val k = du(1f).toPx(); val cy = size.height / 2
                                    val tri = Path().apply {
                                        if (open) { moveTo(0f, cy - 3f * k); lineTo(7f * k, cy - 3f * k); lineTo(3.5f * k, cy + 3f * k) }
                                        else { moveTo(0f, cy - 3.5f * k); lineTo(6f * k, cy); lineTo(0f, cy + 3.5f * k) }
                                        close()
                                    }
                                    drawPath(tri, Ink)
                                }
                            }))
                        // Beside the floating button only while the stack section is not above it.
                        if (stack.isEmpty()) Spacer(Modifier.width(floatW))
                    }
                    if (story.progressOpen) {
                        // ol: 8px above and below, a 40px gutter for the 1. 2. 3. markers; li 13px / 1.55, #c6d7dc.
                        val li = cssText(sans, sp(13f), sp(20.15f), Soft)
                        Column(Modifier.padding(vertical = du(8f))) {
                            story.rows.forEachIndexed { i, r ->
                                Row {
                                    Text("${i + 1}. ", Modifier.width(du(40f)), style = li.copy(textAlign = TextAlign.End))
                                    Text(r.text, Modifier.weight(1f), style = li)
                                }
                            }
                        }
                    }
                }
            }
            // .play-match-inspector>button: sticky top, float right, 11px, 6px 9px, min-height 32, radius 12.
            Box(
                Modifier.align(Alignment.TopEnd).padding(top = du(17f), end = du(17f))
                    .onSizeChanged { buttonW = it.width }
                    .clip(RoundedCornerShape(du(12f))).background(ButtonBg).border(1.dp * u, Line, RoundedCornerShape(du(12f)))
                    .clickable(role = Role.Button, onClick = onClose)
                    .heightIn(min = du(32f)).padding(du(1f)).padding(horizontal = du(9f), vertical = du(6f)),
                contentAlignment = Alignment.Center,
            ) {
                Text("Close inspector", Modifier.wrapContentSize(), style = cssText(sans, sp(11f), sp(15.4f), Ink).copy(textAlign = TextAlign.Center))
            }
        }
    }
}
