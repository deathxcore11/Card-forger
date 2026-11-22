package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The Thor desk's stage (approved mock-up "Thor Desk Showstopper", Randall 21 Nov 2026 9:15 PM: "OMG i love it build it"). The top band of
 * the bottom screen always shows a real card with its art: the hand card under the ring, or whatever is on the stack. A spell or
 * ability arrives across the hinge as its own card in a light of its side's colour, its targets are plates with their art, and what
 * it does is said in plain words (Forge's words, with the engine's numbers taken out). Nothing here asks a question you cannot answer.
 */

/** Whose thing it is: yours ice, a trigger of yours gold, the other side's coral. */
internal val DESK_ICE = Color(0xFF5CC8FF); internal val DESK_GOLD = Color(0xFFE3C070); internal val DESK_CORAL = Color(0xFFFF7A6B)

/** The tag on what arrived: who did it and whether it is a spell or an ability ("CPU CASTS", "YOUR TRIGGER"). [me]/[them] are the seats' names. */
internal fun deskTag(item: StackItem, viewer: Int, them: String): String {
    val mine = item.controller == viewer
    return when {
        item.trigger -> if (mine) "YOUR TRIGGER" else "$them TRIGGER"
        item.ability -> if (mine) "YOUR ABILITY" else "$them ABILITY"
        else -> if (mine) "YOUR SPELL" else "$them CASTS"
    }
}

/** The colour of what arrived (see [DESK_ICE]). */
internal fun deskColor(item: StackItem, viewer: Int): Color = if (item.controller != viewer) DESK_CORAL else if (item.trigger || item.ability) DESK_GOLD else DESK_ICE

/**
 * What a stack item does, as short lines for the desk: Forge's own words with the engine's card numbers taken out ("Requiting Hex (82) -
 * Destroy Undercity Dire Rat (59). CPU gains 2 life." gives "Destroy Undercity Dire Rat." and "CPU gains 2 life."), the leading "Name -"
 * dropped because the card itself is shown, one line per sentence, at most [max]. Never a word the engine did not say.
 */
internal fun deskEffects(text: String, sourceName: String?, max: Int = 3): List<String> {
    var t = plainText(text)
    if (!sourceName.isNullOrBlank()) for (sep in listOf(" - ", " — ", ": ")) if (t.startsWith(sourceName + sep)) { t = t.removePrefix(sourceName + sep); break }
    // A reminder in brackets is the card's small print; the card is on screen, so the chips leave it out.
    t = t.replace(Regex("\\s*\\([^)]*\\)"), "").trim()
    return t.split(Regex("(?<=[.!?])\\s+")).map { it.trim() }.filter { it.isNotEmpty() }.take(max)
}

/** What waits behind the newest stack item, newest first: their names, or how many when the engine named no card ("Then: Thoughtseize", "Then 3 more"). */
internal fun deskThen(names: List<String?>): String = if (names.all { it != null }) "Then: " + names.joinToString(", ") else "Then ${names.size} more"

/** True when a lit hand card could answer what is on the stack now: only then does the desk say so. */
internal fun deskCanAnswer(waitingOnMe: Boolean, hand: List<Card>, canPlay: (Card) -> Boolean): Boolean = waitingOnMe && hand.any(canPlay)

/** One line under the arrived card: gold when you hold an answer, quiet otherwise. Never a button that does nothing. */
internal fun deskStatus(waitingOnMe: Boolean, canAnswer: Boolean): Pair<String, Reading.Tone> = when {
    canAnswer -> "You can answer · play a lit card" to Reading.Tone.OK
    waitingOnMe -> "No answer in hand" to Reading.Tone.NONE
    else -> "Resolving…" to Reading.Tone.NONE
}

/** How long the card takes to arrive, and when its targets and the line to them follow (ms). */
internal const val DESK_DROP_MS = 520; internal const val DESK_PLATES_AT = 420L; internal const val DESK_AIM_MS = 420

/** A whole card, large, in a soft light of [glow]. With [arrive] it drops in from the hinge once per [id]. */
@Composable
internal fun DeskCard(name: String, id: Any, h: Dp, glow: Color, modifier: Modifier = Modifier, arrive: Boolean = false, onTap: (() -> Unit)? = null) {
    val w = h / 1.4f
    val calm = Motion.still
    val p = remember(id) { Animatable(if (arrive && !calm) 0f else 1f) }
    val shock = remember(id) { Animatable(1f) }
    LaunchedEffect(id) {
        if (arrive && !calm) {
            p.animateTo(1f, spring(dampingRatio = .62f, stiffness = 260f))
        }
    }
    LaunchedEffect(id) { if (arrive && !calm) { delay((DESK_DROP_MS * .7f).toLong()); shock.snapTo(0f); shock.animateTo(1f, tween(560)) } }
    Box(modifier.width(w).height(h).drawBehind {
        // The light behind the card, and one ring that spreads when it lands.
        drawCircle(Brush.radialGradient(listOf(glow.copy(alpha = .42f), Color.Transparent), radius = size.height * .78f), radius = size.height * .78f)
        val q = shock.value; if (q < 1f) drawCircle(glow.copy(alpha = .8f * (1f - q)), radius = size.width * (.3f + q * 1.6f), style = Stroke(2.dp.toPx()))
    }) {
        val shape = RoundedCornerShape(w * .05f)
        Box(Modifier.fillMaxSize().graphicsLayer {
            val v = p.value
            translationY = -(1f - v) * size.height * 1.15f
            rotationZ = -(1f - v) * 14f
            val s = .7f + .3f * v; scaleX = s; scaleY = s
            alpha = v.coerceIn(0f, 1f)
        }.clip(shape).background(Color.Black).then(if (onTap != null) Modifier.clickable(onClick = onTap) else Modifier)) {
            CardImage(name, Modifier.fillMaxSize())
        }
    }
}

/** A target as a plate: its art, whose it is, its name. [hit] rings it in the colour of what aims at it. */
@Composable
private fun DeskPlate(art: String?, owner: String, mine: Boolean, name: String, hit: Color, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(10.dp)
    Column(modifier.clip(shape).background(Color(0xFF0B0E15)).border(2.dp, hit, shape)) {
        Box(Modifier.fillMaxWidth().weight(1f).background(Color(0xFF1B2230))) { if (art != null) CardImage(art, Modifier.fillMaxSize(), crop = true) }
        Column(Modifier.padding(horizontal = 8.dp, vertical = 5.dp)) {
            Text(owner, style = small(9.5f, if (mine) DESK_ICE else DESK_CORAL, FontWeight.ExtraBold).copy(letterSpacing = 1.2.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 12.5f.sp, lineHeight = 14.sp, color = Site.Text), maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * The stack on the desk: the newest item as its own card (dropping in when it arrives), the older ones stepped behind it, what it does
 * as chips, and its targets as plates with a line of light running to the first. [gold] is the table's gold button when the stack
 * view carries it (X on a controller). The hand stays below, lit where it can answer.
 */
@Composable
internal fun DeskStack(st: MatchState, hand: List<Card>, canPlay: (Card) -> Boolean, gold: (@Composable () -> Unit)?, onInspect: (Card) -> Unit, modifier: Modifier = Modifier) {
    val items = st.stack.asReversed()
    val top = items.firstOrNull() ?: return
    val (_, them) = LocalSideNames.current
    val col = deskColor(top, st.viewer)
    val calm = Motion.still
    val plates = remember(top.id) { Animatable(if (calm) 1f else 0f) }
    val aim = remember(top.id) { Animatable(if (calm) 1f else 0f) }
    val edge = remember(top.id) { Animatable(if (calm) 0f else 1f) }
    LaunchedEffect(top.id) {
        if (!calm) {
            launch { edge.animateTo(0f, tween(900)) }
            delay(DESK_PLATES_AT); plates.animateTo(1f, tween(260, easing = FastOutSlowInEasing)); aim.animateTo(1f, tween(DESK_AIM_MS, easing = FastOutSlowInEasing))
        }
    }
    val targets = top.targets.mapNotNull { r ->
        if (r.kind == "player") st.players.firstOrNull { it.id == r.id }?.let { p -> Triple(null as String?, p.isViewer, if (p.isViewer) "You" else p.name) }
        else st.card(r.id)?.let { c -> Triple(c.name as String?, c.controller == st.viewer, c.name) } ?: r.name?.let { n -> Triple(n as String?, false, n) }
    }.take(2)
    val name = top.source?.name ?: if (top.ability) "Ability" else "Spell"
    val effects = deskEffects(top.text, top.source?.name)
    val canAnswer = deskCanAnswer(st.waitingOnMe, hand, canPlay)
    val (status, tone) = deskStatus(st.waitingOnMe, canAnswer)
    androidx.compose.foundation.layout.BoxWithConstraints(modifier.fillMaxSize().drawBehind {
        // The hinge's edge lights in the arriving side's colour, then settles.
        val e = edge.value; if (e > 0f) drawRect(Brush.verticalGradient(listOf(col.copy(alpha = .55f * e), Color.Transparent), endY = size.height * .35f))
    }) {
        val h = maxHeight; val cardW = h / 1.4f; val plateW = if (targets.isEmpty()) 0.dp else minOf(132.dp, maxWidth * .26f)
        // The line of light from the card to its first target.
        if (targets.isNotEmpty()) Box(Modifier.fillMaxSize().zIndex(3f).drawBehind {
            val q = aim.value; if (q <= 0f) return@drawBehind
            val from = Offset(cardW.toPx() - 4.dp.toPx(), size.height * .62f); val to = Offset(size.width - plateW.toPx(), size.height * .3f)
            val path = Path().apply { moveTo(from.x, from.y); quadraticBezierTo((from.x + to.x) / 2f, size.height * .86f, to.x, to.y) }
            val seg = Path(); val pm = PathMeasure().apply { setPath(path, false) }; pm.getSegment(0f, pm.length * q, seg, true)
            drawPath(seg, col.copy(alpha = .35f), style = Stroke(7.dp.toPx(), cap = StrokeCap.Round))
            drawPath(seg, col, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
        })
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            // The cards: the older ones stepped behind, the newest in front.
            // An item with no card of its own (the engine named none) has no picture to show: its words take the room instead.
            if (items.any { it.source != null }) Box(Modifier.width(cardW + if (items.size > 1) 26.dp else 0.dp).fillMaxHeight()) {
                items.drop(1).take(2).forEachIndexed { i, s ->
                    s.source?.let { c -> Box(Modifier.offset(x = 14.dp * (i + 1) + 12.dp, y = 6.dp * (i + 1)).graphicsLayer { alpha = .55f; scaleX = .9f; scaleY = .9f }) { DeskCard(c.name, s.id, h, Color.Transparent) } }
                }
                top.source?.let { c -> Box(Modifier.zIndex(2f).anchorRect("b.stackcard")) { DeskCard(c.name, top.id, h, col, arrive = true, onTap = { onInspect(c) }) } }
            }
            Column(Modifier.weight(1f).fillMaxHeight().padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(deskTag(top, st.viewer, them), Modifier.clip(RoundedCornerShape(6.dp)).background(col).padding(horizontal = 7.dp, vertical = 2.dp).anchorRect("b.stacktag"),
                    style = small(9.5f, Color(0xFF14090A), FontWeight.ExtraBold).copy(letterSpacing = 1.4.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (top.source != null) Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 19.sp, color = Site.Text), maxLines = 2, overflow = TextOverflow.Ellipsis)
                Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    effects.forEachIndexed { i, line ->
                        val shape = RoundedCornerShape(9.dp)
                        Row(Modifier.fillMaxWidth().clip(shape).background(Color(0xC7121620)).border(1.dp, Color(0x33FFFFFF), shape).padding(horizontal = 8.dp, vertical = 5.dp).anchorRect("b.effect$i"),
                            horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.width(4.dp).height(16.dp).clip(RoundedCornerShape(2.dp)).background(col))
                            SymText(line, small(12f, Color(0xFFE4E7EA), FontWeight.Bold))
                        }
                    }
                    if (items.size > 1) Text(deskThen(items.drop(1).map { it.source?.name }), style = small(11f, Site.Muted, FontWeight.Bold), maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                DeskRibbon(status, tone, Modifier.anchorRect("b.stackstatus"))
                gold?.invoke()
            }
            if (targets.isNotEmpty()) Column(Modifier.width(plateW).fillMaxHeight().graphicsLayer { alpha = plates.value; translationY = (1f - plates.value) * 12.dp.toPx() },
                verticalArrangement = Arrangement.spacedBy(6.dp)) {
                targets.forEachIndexed { i, (art, mine, label) ->
                    DeskPlate(art, if (mine) "YOURS · TARGET" else "$them · TARGET", mine, label, col, Modifier.fillMaxWidth().weight(1f).anchorRect("b.target$i"))
                }
            }
        }
    }
}

/** The one status pill of the stage: gold "you can", steel "not yet" or quiet, ice for information. Words are the table's own. */
@Composable
internal fun DeskRibbon(text: String, tone: Reading.Tone, modifier: Modifier = Modifier) {
    val (fill, line, ink) = when (tone) {
        Reading.Tone.OK -> Triple(Color(0x33C79A2E), Color(0xFFE3C070), Color(0xFFFFE9B0))
        Reading.Tone.NO -> Triple(Color(0x12FFFFFF), Color(0x55C9D2D6), Color(0xFFD5DCDF))
        Reading.Tone.ASK -> Triple(Color(0x22FF9D4D), Color(0x88FF9D4D), Color(0xFFFFD9B8))
        Reading.Tone.STACK -> Triple(Color(0x1F7FD4FF), Color(0x667FD4FF), Color(0xFFCFEEFF))
        Reading.Tone.NONE -> Triple(Color(0x12FFFFFF), Color(0x24FFFFFF), Color(0xFFB9C4C6))
    }
    val shape = RoundedCornerShape(999.dp)
    Row(modifier.fillMaxWidth().clip(shape).background(fill).border(1.dp, line, shape).padding(horizontal = 12.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(8.dp).height(8.dp).clip(RoundedCornerShape(4.dp)).background(line))
        Text(text, style = small(12.5f, ink, FontWeight.ExtraBold), maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}
