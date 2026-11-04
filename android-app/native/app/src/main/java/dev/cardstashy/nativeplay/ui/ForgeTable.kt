package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Player
import dev.cardstashy.nativeplay.engine.StackItem

/*
 * The match table, ported from the site's hosted Forge table (experiments/forge-proof/forge-table.mjs, native-panel.mjs,
 * play-forge-table.css, play-player-mat.js) at the phone size the site was measured at (844 × 390 CSS px, scripts in
 * scratchpad site/tableprobe.mjs). Every place and size below is that measurement, in design units (1 du = 1 CSS px at
 * 844 × 390). The table scales by one factor so the whole design fits the screen both ways; items the site pins to an
 * edge stay on that edge, so a wider or taller screen gives the board the room, never stretched art.
 *
 * Randall's approved calm additions (3 Nov 23:56Z, design/stack-cards/calm-*.png, stack-*.png):
 *  - the stack as fanned cards on the right over a portal, gold rim yours / red rim the CPU's, an arc to the source;
 *  - library and graveyard as real card piles (yours right of your back row, the CPU's left of its back row), no count chips;
 *  - the CPU hand tucked off the top edge (only the lower half of the backs);
 *  - stops on the phase lights (tap a light, an orange ring);
 *  - sideways drag reorders the hand (HandFan).
 */

/** What the table can ask of the match (MatchController in the app; nothing in a screenshot test). */
class TableIntents(
    val card: (Int) -> Unit = {}, val player: (Int) -> Unit = {}, val ok: () -> Unit = {}, val cancel: () -> Unit = {},
    val reply: (Int, Boolean?, List<Int>?, List<Int>?) -> Unit = { _, _, _, _ -> },
    val stop: (String) -> Unit = {}, val mode: (String) -> Unit = {}, val autoPay: (Boolean) -> Unit = {}, val yieldSource: (Int, Boolean) -> Unit = { _, _ -> },
)

/** The engine phase each light sets a stop on (native-panel.mjs STOP_PHASES). */
internal val STOP_PHASE = mapOf("Upkeep" to "UPKEEP", "Draw" to "DRAW", "Main" to "MAIN1", "Combat" to "COMBAT_BEGIN", "Main 2" to "MAIN2", "End" to "END_OF_TURN")

/** The lights with a stop for the seat whose turn the track shows; null when the bridge offers no stops. */
internal fun stopLights(st: MatchState): Set<String>? {
    val stops = st.phaseStops ?: return null
    val seat = if (st.activePlayer == st.viewer) "you" else "opponent"
    return STOP_PHASE.filterValues { stops.containsKey("$seat:$it") }.keys
}

/** The phase lights (forge-table.mjs PHASE_STEPS), in the engine's phase names. */
internal val PHASE_STEPS = listOf(
    "Upkeep" to setOf("UNTAP", "UPKEEP"), "Draw" to setOf("DRAW"), "Main" to setOf("MAIN1"),
    "Combat" to setOf("COMBAT_BEGIN", "COMBAT_DECLARE_ATTACKERS", "COMBAT_DECLARE_BLOCKERS", "COMBAT_FIRST_STRIKE_DAMAGE", "COMBAT_DAMAGE", "COMBAT_END"),
    "Main 2" to setOf("MAIN2"), "End" to setOf("END_OF_TURN", "CLEANUP"))

private val SHORT_STEP = mapOf("UPKEEP" to "To draw", "DRAW" to "To main", "MAIN1" to "To combat", "COMBAT_BEGIN" to "To attackers",
    "COMBAT_DECLARE_ATTACKERS" to "To blocks", "COMBAT_DECLARE_BLOCKERS" to "To damage", "COMBAT_FIRST_STRIKE_DAMAGE" to "To damage",
    "COMBAT_DAMAGE" to "End combat", "COMBAT_END" to "To main 2", "MAIN2" to "To end step", "END_OF_TURN" to "To cleanup")

/** native-panel.mjs nativeActionLabel with the hosted short step ("To combat"). */
internal fun okLabel(st: MatchState): String {
    val raw = st.buttons.ok ?: "OK"
    if (!Regex("^(ok|auto|cancel|end turn)$", RegexOption.IGNORE_CASE).matches(raw.trim())) return raw
    val mine = st.me.battlefield
    return when {
        st.inputType == "InputPassPriority" -> when {
            st.stack.isNotEmpty() -> if (st.stack.first().controller == st.viewer) "Resolve" else "No response"
            st.players.none { p -> p.battlefield.any { it.attacking } } && st.phase in setOf("COMBAT_DECLARE_ATTACKERS", "COMBAT_DECLARE_BLOCKERS", "COMBAT_FIRST_STRIKE_DAMAGE", "COMBAT_DAMAGE") ->
                if (st.activePlayer == st.viewer) "To main 2" else "Pass"
            st.activePlayer == st.viewer -> SHORT_STEP[st.phase] ?: "Pass priority"
            else -> "Pass"
        }
        st.inputType == "InputAttack" -> mine.count { it.attacking }.let { if (it > 0) "Attack with $it" else "No attacks" }
        st.inputType == "InputBlock" -> mine.count { it.blocking }.let { if (it > 0) "Block with $it" else "No blocks" }
        st.inputType?.startsWith("InputPayMana") == true && raw.equals("auto", true) -> "Pay automatically"
        st.inputType == "InputSelectTargets" -> "Confirm targets"
        else -> raw
    }
}
internal fun cancelLabel(st: MatchState): String? {
    val raw = st.buttons.cancel?.takeIf { st.buttons.cancelEnabled } ?: return null
    return if (st.inputType == "InputPassPriority" && raw.equals("end turn", true)) "End turn" else raw
}

// ---- Colours (play-token-art.js PALETTE / frameTone; .forge-land-color) ----

private val PALETTE = mapOf('W' to Color(0xFFEFE3BD), 'U' to Color(0xFF3F86D8), 'B' to Color(0xFF6B5679), 'R' to Color(0xFFD6503A), 'G' to Color(0xFF3F9A55))
private val LAND_DOT = mapOf('W' to Color(0xFFF5EBC7), 'U' to Color(0xFF226EB5), 'B' to Color(0xFF433B50), 'R' to Color(0xFFB72F27), 'G' to Color(0xFF267B45))
private const val ORDER = "WUBRG"
private val BASIC = mapOf("Plains" to 'W', "Island" to 'U', "Swamp" to 'B', "Mountain" to 'R', "Forest" to 'G')

/** surfaceColors(): a land by what it makes, anything else by its cost. Null: no idea (a crest colour). */
internal fun cardColors(c: Card): List<Char>? {
    if (c.isLand) {
        val made = BASIC.filterKeys { Regex("\\b$it\\b").containsMatchIn(c.type) }.values +
            Regex("\\{([WUBRG])\\}").findAll(c.text.lines().filter { Regex("\\badd\\b", RegexOption.IGNORE_CASE).containsMatchIn(it) }.joinToString(" ")).map { it.groupValues[1][0] }
        return made.toSet().sortedBy { ORDER.indexOf(it) }
    }
    if (c.manaCost.isBlank()) return null
    return Regex("\\{([^}]+)\\}").findAll(c.manaCost).flatMap { m -> m.groupValues[1].filter { it in ORDER }.asSequence() }.toSet().sortedBy { ORDER.indexOf(it) }
}
/** frameTone(): [a, b]. Colourless grey, three or more gold. */
internal fun frameTone(colors: List<Char>?): Pair<Color, Color> = when {
    colors == null || colors.isEmpty() -> Color(0xFFAAB3B9) to Color(0xFF6F7A82)
    colors.size > 2 -> Color(0xFFE6C66D) to Color(0xFFA8812F)
    else -> PALETTE.getValue(colors.first()) to PALETTE.getValue(colors.last())
}

private val Gold = Color(0xFFE8B95B)
private val Ice = Color(0xFF5CC8FF)
private val Ember = Color(0xFFFF9A7A)
private val Sky = Color(0xFF8FDCFF)
private val CpuRed = Color(0xFFE0533F)
private val StopOrange = Color(0xFFFF8A3D)

private fun sans(size: TextUnit, weight: FontWeight = FontWeight.Bold, color: Color = Color(0xFFEEE6D4)) =
    TextStyle(fontFamily = Type.Sans, fontWeight = weight, fontSize = size, color = color)

/** One design unit as Dp: the site's CSS px at 844 × 390, scaled to fit. */
private class Du(val u: Float) {
    val Int.du: Dp get() = (this * u).dp
    val Float.du: Dp get() = (this * u).dp
    fun sp(px: Float): TextUnit = (px * u).sp
}

/**
 * The board while a match is on: everything on one surface, nothing in a sidebar. [stops] are the phase lights you set;
 * [selectedHand] is the lifted hand card (tap once to lift, again to open it; slide up or the gold button to play).
 */
@Composable
fun ForgeBoard(
    st: MatchState, live: Boolean, intents: TableIntents, selectedHand: Int?, onSelectHand: (Int?) -> Unit, onInspect: (Card) -> Unit,
    onMenu: () -> Unit, handOrder: List<Int>, onHandOrder: (List<Int>) -> Unit,
    modifier: Modifier = Modifier, overlay: @Composable (Dp.() -> Unit)? = null,
) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        val d = Du(minOf(maxWidth.value / 844f, maxHeight.value / 390f))
        with(d) {
            val W = maxWidth; val H = maxHeight
            val me = st.me; val cpu = st.cpu
            fun markOf(card: Card): Mark = when {
                !live -> Mark.NONE
                card.id in st.selection.chosenCards || (st.inputType == "InputAttack" && card.attacking && card.controller == st.viewer) ||
                    (st.inputType == "InputBlock" && card.blocking && card.controller == st.viewer) -> Mark.PICKED
                card.id in st.selection.cards -> Mark.PICKABLE
                card.id in st.selection.actionable -> Mark.PLAYABLE
                else -> Mark.NONE
            }
            fun tapOf(card: Card): (() -> Unit)? = if (live && (card.id in st.selection.cards || card.id in st.selection.actionable || card.id in st.selection.chosenCards ||
                ((st.inputType == "InputAttack" || st.inputType == "InputBlock") && card.controller == st.viewer && (card.attacking || card.blocking)))) ({ intents.card(card.id) }) else null

            // The battlefield band (46 du from the top to 61 du from the bottom); the two halves meet at its middle.
            val bandTop = 46.du; val bandBottom = H - 61.du
            val mid = (bandTop + bandBottom) / 2
            val stretch = ((bandBottom - bandTop) / 283.du).coerceAtLeast(1f)
            val centreX = W / 2

            // The divider between the halves: a thin violet line with a notch on your side's turn.
            Box(Modifier.offset(y = mid).fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x998A7BD8), Color(0x998A7BD8), Color.Transparent))))

            // CPU half: lands at the back, creatures at the front; yours mirrored.
            PermanentRow(backRow(cpu.battlefield), true, lands(cpu.battlefield).size, centreX, mid - 77.5f.du * stretch, W - 180.du, d, ::markOf, ::tapOf, onInspect)
            PermanentRow(others(cpu.battlefield), false, 0, centreX, mid - 34.du * stretch, W - 180.du, d, ::markOf, ::tapOf, onInspect)
            PermanentRow(others(me.battlefield), false, 0, centreX, mid + 27.du * stretch, W - 180.du, d, ::markOf, ::tapOf, onInspect)
            PermanentRow(backRow(me.battlefield), true, lands(me.battlefield).size, centreX, mid + 71.5f.du * stretch, W - 300.du, d, ::markOf, ::tapOf, onInspect)

            // Piles: yours right of your back row, the CPU's left of its back row.
            Piles(me, mine = true, Modifier.offset(x = W - 120.du, y = mid + 46.du * stretch), d, onInspect)
            Piles(cpu, mine = false, Modifier.offset(x = 44.du, y = mid - 104.du * stretch), d, onInspect)

            // The CPU's hand, tucked off the top edge: the lower half of each back.
            TuckedHand(cpu.handCount, Modifier.offset(y = (-17).du).align(Alignment.TopCenter), d)

            // Seats: the CPU top right, you bottom left; command-zone crests beside them.
            Crest(cpu.command.firstOrNull(), Modifier.offset(x = W - 136.du, y = 6.du), d, onInspect)
            Medallion(cpu, mine = false, live && cpu.id in st.selection.players, cpu.id in st.selection.chosenPlayers, Modifier.offset(x = W - 66.du, y = 12.du), d) { intents.player(cpu.id) }
            Crest(me.command.firstOrNull(), Modifier.offset(x = 10.du, y = H - 86.du), d, onInspect)
            Medallion(me, mine = true, live && me.id in st.selection.players, me.id in st.selection.chosenPlayers, Modifier.offset(x = 80.du, y = H - 78.du), d) { intents.player(me.id) }
            ManaPool(me.mana, Modifier.offset(x = 106.du, y = H - 103.du), d)
            // Smart / Full Control / auto-pay just right of your portrait, the emote button on its top-right corner (site: 117, 297).
            ControlEmblems(st, intents, Modifier.offset(x = 149.du, y = H - 103.du), d)
            EmoteButton(Modifier.offset(x = 117.du, y = H - 93.du), d)

            // Menu and the phase track, top left.
            Box(Modifier.offset(x = 8.du, y = 34.du).size(44.du).clip(CircleShape).background(Color(0x6612141A)).border(1.dp, Color(0x24FFFFFF), CircleShape)
                .clickable(onClick = onMenu), contentAlignment = Alignment.Center) { MenuGlyph(d) }
            PhaseTrack(st, stopLights(st), intents.stop, Modifier.offset(x = 74.du, y = 42.du), d)

            // The stack, fanned on the right over its portal, with the arc to its source.
            if (st.stack.isNotEmpty()) { StackFan(st, Modifier.offset(x = W - 214.du, y = mid - 110.du), d, onInspect, live, intents.yieldSource); StackArc(st, d) }

            // The hand: centred 44 du right of the middle (between your seat and the buttons), the middle card's top 67 du above the bottom.
            val hand = orderedHand(me.hand, handOrder)
            Box(Modifier.offset(x = centreX + 44.du - 222.du, y = H - 67.du).width(444.du).height(120.du)) {
                HandFan(hand, 66.du, Modifier.fillMaxWidth(), raised = selectedHand, angleDeg = 1.2f,
                    markOf = { card -> if (live && card.id in st.selection.cards) Mark.PICKABLE else if (live && card.id in st.selection.actionable) Mark.PLAYABLE else Mark.NONE },
                    canPlay = { card -> live && card.id in st.selection.actionable },
                    onTap = { card ->
                        val playable = live && card.id in st.selection.actionable
                        when {
                            live && card.id in st.selection.cards -> intents.card(card.id)
                            playable && selectedHand == card.id -> onInspect(card)
                            playable -> onSelectHand(card.id)
                            else -> onInspect(card)
                        }
                    },
                    onPlay = { card -> onSelectHand(null); intents.card(card.id) },
                    onHold = onInspect, onReorder = { ids -> onHandOrder(ids) })
            }

            // The buttons, bottom right: the gold step and the quiet second one above it.
            if (st.prompt == null && st.waitingOnMe) {
                val selected = selectedHand?.let { st.card(it) }
                val ok = if (selected != null) (if (selected.isLand) "Play land" else "Cast") else okLabel(st)
                val second = if (selected != null) null else cancelLabel(st)
                second?.let { GlassPill(it, live, Modifier.offset(x = W - 90.du, y = H - 94.du), d) { intents.cancel() } }
                GoldPill(ok, live && (selected != null || st.buttons.okEnabled), Modifier.offset(x = W - 146.du, y = H - 52.du), d) {
                    if (selected != null) { onSelectHand(null); intents.card(selected.id) } else intents.ok()
                }
            }
            overlay?.invoke(W)
            EmoteLayer(W, H, d)
        }
    }
}

/** forge-table.mjs laneFor: creatures in the front row; lands, then the "other" lane (artifacts, enchantments, planeswalkers, battles) in the back row. */
private fun lands(cards: List<Card>) = cards.filter { it.isLand && !it.isCreature && it.attachedTo == null }
private fun backOthers(cards: List<Card>) = cards.filter { !it.isLand && !it.isCreature && it.attachedTo == null }
private fun others(cards: List<Card>) = cards.filter { it.isCreature && it.attachedTo == null }
private fun backRow(cards: List<Card>) = lands(cards) + backOthers(cards)

/** Your hand in the order you dragged it to; new cards join on the right. */
/** forge-session.mjs manaValue: numbers count, X/Y/Z count 0, a hybrid "2/W" counts its number, any other symbol 1. */
internal fun manaValue(cost: String): Int = Regex("\\{([^}]+)\\}").findAll(cost).sumOf { m ->
    val sym = m.groupValues[1]
    when { sym.all { it.isDigit() } -> sym.toInt(); sym.matches(Regex("[XYZ]")) -> 0; else -> Regex("^(\\d+)/").find(sym)?.groupValues?.get(1)?.toInt() ?: 1 }
}

/** forge-session.mjs arenaHandOrder (lands first, then mana value, then Forge's order), then your own drag order on top. */
internal fun orderedHand(hand: List<Card>, order: List<Int>): List<Card> {
    val arena = hand.withIndex().sortedWith(compareBy({ if (it.value.name.isNotEmpty() && it.value.isLand) 0 else 1 }, { if (it.value.name.isNotEmpty()) manaValue(it.value.manaCost) else Int.MAX_VALUE }, { it.index })).map { it.value }
    val at = order.withIndex().associate { (i, id) -> id to i }
    return arena.sortedWith(compareBy({ at[it.id] ?: Int.MAX_VALUE }, { arena.indexOf(it) }))
}

// ---- Battlefield ----

/**
 * One row of permanents, centred on [cx] with its middle at [cy]. Lands and untouched identical permanents pile (×N, 9 du
 * apart); everything else stands alone 10 du apart. A row wider than [room] shrinks to fit (the site's zone scale).
 */
@Composable
private fun PermanentRow(cards: List<Card>, land: Boolean, split: Int = 0, cx: Dp, cy: Dp, room: Dp, d: Du, markOf: (Card) -> Mark, tapOf: (Card) -> (() -> Unit)?, onInspect: (Card) -> Unit) = with(d) {
    if (cards.isEmpty()) return@with
    val piles = cards.withIndex().groupBy { (i, it) -> if (markOf(it) == Mark.NONE && tapOf(it) == null && it.counters.isEmpty() && it.damage == 0 && !it.attacking && !it.blocking) "${if (i < split) "l" else "o"}|${it.name}|${it.tapped}" else "id${it.id}" }.values.map { g -> g.map { it.value } }
    // The second lane (site: +22 px between lanes) starts at the first pile past the lands.
    val laneAt = piles.indexOfFirst { p -> cards.indexOf(p.first()) >= split }.takeIf { split in 1 until cards.size } ?: -1
    val laneGap = 12.du
    val w = if (land) 42.du else 50.du; val h = if (land) 29.du else 38.du
    val step = 9.du; val gap = 10.du
    val widths = piles.map { w + step * (it.size - 1) }
    val total = widths.fold(0.dp) { a, b -> a + b } + gap * (piles.size - 1) + if (laneAt > 0) laneGap else 0.dp
    val k = if (total > room) room / total else 1f
    Box(Modifier.offset(x = cx - total * k / 2, y = cy - h * k / 2).graphicsLayer { scaleX = k; scaleY = k; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0f) }) {
        var x = 0.dp
        piles.forEachIndexed { i, pile ->
            if (i == laneAt && i > 0) x += laneGap
            val px = x
            key(pile.first().id) {
                pile.forEachIndexed { j, card ->
                    Tile(card, w, h, land, markOf(card), tapOf(card), onInspect, Modifier.offset(x = px + step * j).zIndex(j.toFloat()), d,
                        count = if (j == pile.lastIndex && pile.size > 1) pile.size else 1)
                }
            }
            x += widths[i] + gap
        }
    }
}

/** A permanent (.play-match-card on the battlefield): the art crop in a #141418 tile with a 1.5 du ring in its frame colour. */
@Composable
private fun Tile(card: Card, w: Dp, h: Dp, land: Boolean, mark: Mark, onTap: (() -> Unit)?, onInspect: (Card) -> Unit, modifier: Modifier, d: Du, count: Int = 1) = with(d) {
    val (a, _) = frameTone(cardColors(card))
    val ring = when {
        mark == Mark.PICKED -> Palette.GoldBright
        mark == Mark.PICKABLE -> Palette.GoldBright
        mark == Mark.PLAYABLE -> Ice
        card.attacking -> CpuRed
        card.blocking -> Color(0xFF6FA8DC)
        else -> lerp(a, Color.White, .15f)
    }
    val turn by animateFloatAsState(if (card.tapped) 20f else 0f, tween(140, easing = FastOutSlowInEasing), label = "tap")
    val anchors = LocalAnchors.current
    val shape = RoundedCornerShape(10.du)
    Box(modifier.size(w, h)
        .then(if (anchors != null) Modifier.onGloballyPositioned { anchors.put("c${card.id}", it.boundsInRoot().center) } else Modifier)
        .graphicsLayer { rotationZ = turn; val s = if (card.tapped) .94f else 1f; scaleX = s; scaleY = s; translationY = if (card.attacking) (if (card.controller == card.owner) -6f else 6f) * density else 0f }
        .drawBehind {
            // box-shadow: 0 0 0 1.5px ring, 0 0 0 2.5px #000d, 0 10px 22px #000b
            val r = 10.du.toPx()
            drawRoundRect(Color(0xBB000000), topLeft = Offset(0f, 6.du.toPx()), size = size, cornerRadius = CornerRadius(r))
            drawRoundRect(Color(0xDD000000), topLeft = Offset(-2.5f.du.toPx(), -2.5f.du.toPx()), size = Size(size.width + 5f.du.toPx(), size.height + 5f.du.toPx()), cornerRadius = CornerRadius(r + 2.5f.du.toPx()))
            val ringW = if (mark != Mark.NONE || card.attacking || card.blocking) 2.du.toPx() else 1.5f.du.toPx()
            drawRoundRect(ring, topLeft = Offset(-ringW, -ringW), size = Size(size.width + 2 * ringW, size.height + 2 * ringW), cornerRadius = CornerRadius(r + ringW))
            if (mark == Mark.PLAYABLE) drawRoundRect(Ice.copy(alpha = .35f), topLeft = Offset(-5.du.toPx(), -5.du.toPx()), size = Size(size.width + 10.du.toPx(), size.height + 10.du.toPx()), cornerRadius = CornerRadius(r + 5.du.toPx()))
        }
        .clip(shape).background(Color(0xFF141418))
        .pointerInput(card.id, onTap) { detectTapGestures(onTap = { onTap?.invoke() ?: onInspect(card) }, onLongPress = { onInspect(card) }) }) {
        Box(Modifier.fillMaxSize().padding(2.du).clip(RoundedCornerShape(9.du))) {
            CardImage(card.name, Modifier.fillMaxSize(), crop = true) { Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(frameTone(cardColors(card)).first, frameTone(cardColors(card)).second)))) }
            if (mark == Mark.PICKED) Box(Modifier.fillMaxSize().background(Palette.GoldBright.copy(alpha = .22f)))
        }
        if (land) cardColors(card)?.firstOrNull()?.let { c ->
            Box(Modifier.align(Alignment.BottomStart).offset(x = 4.du, y = (-3).du).size(10.du).clip(CircleShape).background(LAND_DOT.getValue(c)).border(1.dp, Color(0xAAFFFFFF), CircleShape),
                contentAlignment = Alignment.Center) { Text("$c", style = sans(sp(7f), FontWeight.Bold, if (c == 'W') Color(0xFF111111) else Color.White)) }
        }
        if (card.isCreature && card.power != null) {
            val tough = (card.toughness ?: 0) - card.damage
            Box(Modifier.align(Alignment.BottomCenter).offset(y = (-2).du).clip(RoundedCornerShape(999.dp)).background(Color(0xE60D0F14)).border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(999.dp))
                .padding(horizontal = 5.du)) { Text("${card.power}/$tough", style = sans(sp(9f), FontWeight.Bold, if (card.damage > 0) Color(0xFFFF9A8A) else Color(0xFFF4EEDF))) }
        }
        if (card.summoningSick && card.isCreature) Box(Modifier.align(Alignment.TopStart).offset(3.du, 3.du).size(9.du).clip(CircleShape).background(Color(0xEB101114)).border(1.dp, Color(0xB8D6AD64), CircleShape))
    }
    if (count > 1) Box(modifier.offset(x = w - 14.du, y = (-8).du).zIndex(20f).clip(RoundedCornerShape(999.dp))
        .background(Brush.radialGradient(listOf(Color(0xFFFFF2C6), Color(0xFFD9B463), Color(0xFFA9822F)))).border(2.dp, Color(0xFFFFF3CF), RoundedCornerShape(999.dp))
        .padding(horizontal = 4.du)) { Text("×$count", style = sans(sp(10f), FontWeight.Bold, Color(0xFF2A1D05))) }
}

// ---- Piles (approved: real card piles, a count printed under each) ----

@Composable
private fun Piles(p: Player, mine: Boolean, modifier: Modifier, d: Du, onInspect: (Card) -> Unit) = with(d) {
    // Yours: graveyard then library; the CPU's mirrored (library then graveyard).
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.du)) {
        @Composable fun lib() = Pile(p.libraryCount, null, d) {}
        @Composable fun grave() = Pile(p.graveyard.size, p.graveyard.lastOrNull(), d) { p.graveyard.lastOrNull()?.let(onInspect) }
        if (mine) { grave(); lib() } else { lib(); grave() }
    }
}

@Composable
private fun Pile(count: Int, top: Card?, d: Du, onTap: () -> Unit) = with(d) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(33.du, 46.du).clickable(enabled = top != null, onClick = onTap)) {
            // A little depth under the top card: up to three edges.
            val depth = minOf(3, (count - 1).coerceAtLeast(0))
            for (i in depth downTo 1) Box(Modifier.offset(x = (i * 1.5f).du, y = (i * 1.5f).du).fillMaxSize().clip(RoundedCornerShape(3.du)).background(Color(0xFF15182A)).border(1.dp, Color(0x55C9A75A), RoundedCornerShape(3.du)))
            if (count > 0) {
                if (top != null) CardImage(top.name, Modifier.fillMaxSize(), shape = RoundedCornerShape(3.du)) { CardBack(Modifier.fillMaxSize()) }
                else CardBack(Modifier.fillMaxSize().clip(RoundedCornerShape(3.du)))
            } else Box(Modifier.fillMaxSize().border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(3.du)))
        }
        Text("$count", style = sans(sp(11f), FontWeight.Bold, Color(0xFFD8D0BF)), modifier = Modifier.padding(top = 2.du))
    }
}

// ---- The CPU's hand, tucked ----

@Composable
private fun TuckedHand(n: Int, modifier: Modifier, d: Du) = with(d) {
    if (n <= 0) return@with
    val step = 17.du
    Box(modifier.size(24.du + step * (n - 1), 34.du)) {
        repeat(n) { i ->
            Box(Modifier.offset(x = step * i).size(24.du, 34.du).drawBehind { drawRoundRect(Color(0xAA000000), topLeft = Offset(0f, 4.du.toPx()), size = size, cornerRadius = CornerRadius(5.du.toPx())) }
                .clip(RoundedCornerShape(5.du)).border(2.dp, Color(0xFFC9A75A), RoundedCornerShape(5.du))) { CardBack(Modifier.fillMaxSize()) }
        }
    }
}

// ---- Seats ----

/** .play-match-seat: a 52 du round portrait in a gold ring, the life total on a pill under it (tap to target the player). */
@Composable
private fun Medallion(p: Player, mine: Boolean, pickable: Boolean, picked: Boolean, modifier: Modifier, d: Du, onPick: () -> Unit) = with(d) {
    val flash = remember { Animatable(0f) }
    var last by remember { mutableStateOf(p.life) }
    LaunchedEffect(p.life) { if (p.life < last) { flash.snapTo(1f); flash.animateTo(0f, tween(900)) }; last = p.life }
    val anchors = LocalAnchors.current
    val pulse = if (pickable && !Motion.still) rememberInfiniteTransition(label = "pick").animateFloat(.55f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "a").value else 1f
    Box(modifier.size(52.du).then(if (anchors != null) Modifier.onGloballyPositioned { anchors.put("orb${p.id}", it.boundsInRoot().center) } else Modifier)
        .clickable(enabled = pickable, onClick = onPick)) {
        Box(Modifier.fillMaxSize().drawBehind {
            drawCircle(Color(0xFF0B0C10), radius = size.minDimension / 2 + 3.du.toPx())
            if (pickable || picked) drawCircle(Palette.GoldBright.copy(alpha = .5f * pulse), radius = size.minDimension / 2 + 9.du.toPx())
        }.clip(CircleShape).background(Color(0xFF1B1B20)).border(2.dp, if (pickable || picked) Palette.GoldBright else if (mine) Color(0xFFFFD98A) else Gold.copy(alpha = .8f), CircleShape).padding(2.du).clip(CircleShape)) {
            if (mine) {
                val profile by dev.cardstashy.nativeplay.account.Account.profile.collectAsState()
                // play-player-mat.js practicePlayerPortrait: your profile picture, else the brand mark (brand-idle).
                val url = profile?.avatarUrl?.takeIf { it.startsWith("http") }
                if (url == null) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { BrandMark(30.du) }
                url?.let { coil3.compose.AsyncImage(model = it, contentDescription = null, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
            } else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { BrandMark(30.du) } // the CPU wears the brand mark
            if (flash.value > 0f) Box(Modifier.fillMaxSize().background(CpuRed.copy(alpha = .55f * flash.value)))
        }
        // .play-match-life: 15 px 800 #fff4d8 on a dark pill with a gold hairline, 39 du below the portrait's top.
        Box(Modifier.align(Alignment.TopCenter).offset(y = 39.du).wrapContentSize(unbounded = true)
            .drawBehind { drawRoundRect(Color(0xCC000000), topLeft = Offset(0f, 3.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
            .clip(RoundedCornerShape(999.dp)).background(Brush.verticalGradient(listOf(Color(0xFF26221A), Color(0xFF14120E)))).border(1.dp, Gold, RoundedCornerShape(999.dp))
            .padding(horizontal = 8.du, vertical = 2.du)) {
            Text("${p.life}", style = sans(sp(15f), FontWeight.Bold, Color(0xFFFFF4D8)))
        }
    }
}

/** .play-command-zone.forge-crest: the commander's art on a shield, beside its owner's portrait. */
@Composable
private fun Crest(c: Card?, modifier: Modifier, d: Du, onInspect: (Card) -> Unit) = with(d) {
    if (c == null) return@with
    val shield = GenericShape { s, _ ->
        val r = s.width * .09f
        moveTo(r, 0f); lineTo(s.width - r, 0f); quadraticTo(s.width, 0f, s.width, r)
        lineTo(s.width, s.height * .6f); quadraticTo(s.width, s.height * .86f, s.width / 2, s.height)
        quadraticTo(0f, s.height * .86f, 0f, s.height * .6f); lineTo(0f, r); quadraticTo(0f, 0f, r, 0f); close()
    }
    Box(modifier.size(58.du, 70.du), contentAlignment = Alignment.Center) {
        Box(Modifier.size(46.du, 60.du).drawBehind { drawCircle(Gold.copy(alpha = .18f), radius = size.width * .7f) }
            .clip(shield).background(Brush.verticalGradient(listOf(Color(0xFFF2CF7E), Color(0xFF8A6526)))).padding(2.du).clip(shield)
            .clickable { onInspect(c) }) { CardImage(c.name, Modifier.fillMaxSize(), crop = true) }
    }
}

/** .forge-seat-mana: what is floating, one symbol each with its count. Nothing floating, nothing shown. */
@Composable
private fun ManaPool(mana: Map<String, Int>, modifier: Modifier, d: Du) = with(d) {
    val floating = listOf("W", "U", "B", "R", "G", "C").mapNotNull { k -> mana[k]?.takeIf { it > 0 }?.let { k to it } }
    if (floating.isEmpty()) return@with
    Row(modifier.offset(x = -(16 + 13 * floating.size).du).clip(RoundedCornerShape(999.dp)).background(Color(0xE60B0D12)).border(1.dp, Gold.copy(alpha = .33f), RoundedCornerShape(999.dp))
        .padding(horizontal = 6.du, vertical = 4.du), horizontalArrangement = Arrangement.spacedBy(4.du)) {
        floating.forEach { (k, n) ->
            Box(Modifier.size(24.du)) {
                Symbol(k, 22.du, Modifier.align(Alignment.Center))
                Box(Modifier.align(Alignment.BottomEnd).offset(4.du, 2.du).clip(CircleShape).background(Gold).border(1.dp, Color(0xFF0B0D12), CircleShape).padding(horizontal = 3.du)) {
                    Text("$n", style = sans(sp(10f), FontWeight.Bold, Color(0xFF1B1408)))
                }
            }
        }
    }
}

// ---- Top left ----

@Composable
private fun MenuGlyph(d: Du) = with(d) {
    Canvas(Modifier.size(18.du, 14.du)) {
        val w = 2.du.toPx()
        for (i in 0..2) { val y = size.height * i / 2f; drawLine(Color(0xFFEEE6D4), Offset(0f, y.coerceIn(w / 2, size.height - w / 2)), Offset(size.width, y.coerceIn(w / 2, size.height - w / 2)), w, StrokeCap.Round) }
    }
}

/** .forge-phase-track: "Turn N", then a light per step (the current one lit and named). Tap a light to stop there (orange ring). */
@Composable
private fun PhaseTrack(st: MatchState, stops: Set<String>?, onStop: (String) -> Unit, modifier: Modifier, d: Du) = with(d) {
    val at = PHASE_STEPS.indexOfFirst { st.phase in it.second }
    val yours = st.activePlayer == st.viewer
    val track = if (yours) Sky else Ember
    Row(modifier.height(26.du).clip(RoundedCornerShape(999.dp)).background(Color(0xA60F1218)).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(999.dp))
        .padding(horizontal = 10.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.du)) {
        Text("Turn ${st.turn}", style = sans(sp(12f), FontWeight.Bold, track).copy(letterSpacing = .48.sp))
        PHASE_STEPS.forEachIndexed { i, (label, _) ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.du)) {
                val stop = stops != null && label in stops
                Box(Modifier.size(16.du).clip(CircleShape).clickable(enabled = stops != null) { onStop(label) }, contentAlignment = Alignment.Center) {
                    val now = i == at
                    Box(Modifier.size(if (now) 9.5f.du else 7.du).drawBehind { if (now) drawCircle(track.copy(alpha = .45f), radius = size.minDimension) }
                        .clip(CircleShape).background(if (now) track else if (i < at) Color(0x70FFFFFF) else Color(0x33FFFFFF)))
                    if (stop) Box(Modifier.size(14.du).border(1.5.dp, StopOrange, CircleShape))
                }
                if (i == at) Text(label, style = sans(sp(12f), FontWeight.Bold, Color.White))
            }
        }
    }
}

// ---- The stack (approved: fanned cards over a portal, gold rim yours / red rim the CPU's, an arc to the source) ----

@Composable
private fun StackFan(st: MatchState, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, live: Boolean = false, onYield: (Int, Boolean) -> Unit = { _, _ -> }) = with(d) {
    // Identical items in a row (the same trigger from the same controller) show once with ×N.
    val groups = mutableListOf<Pair<StackItem, Int>>()
    for (s in st.stack) { val last = groups.lastOrNull(); if (last != null && last.first.text == s.text && last.first.controller == s.controller && last.first.source?.name == s.source?.name) groups[groups.lastIndex] = last.first to last.second + 1 else groups += s to 1 }
    val shown = groups.take(4)
    val spin = if (Motion.still) remember { mutableFloatStateOf(0f) } else rememberInfiniteTransition(label = "portal").animateFloat(0f, 360f, infiniteRepeatable(tween(9000, easing = LinearEasing)), label = "spin")
    val anchors = LocalAnchors.current
    Box(modifier.size(150.du, 190.du)) {
        // The portal: a slow violet-gold swirl behind the top card.
        Canvas(Modifier.offset(x = 30.du, y = 20.du).size(150.du).graphicsLayer { rotationZ = spin.value }) {
            drawCircle(Brush.sweepGradient(listOf(Color(0x008A6BFF), Color(0x668A6BFF), Color(0x55E8B95B), Color(0x008A6BFF))), radius = size.minDimension / 2)
            drawCircle(Brush.radialGradient(listOf(Color(0x88241A4A), Color(0x00241A4A))), radius = size.minDimension / 2)
        }
        // Older items fan up and behind, dimmed, names readable.
        shown.drop(1).reversed().forEachIndexed { k, (s, _) ->
            val depth = shown.size - 1 - k
            StackCard(st, s, 1, Modifier.offset(x = (44 - 16 * depth).du, y = (34 - 16 * depth).du).alpha(.6f), d, onInspect, small = true)
        }
        val (top, n) = shown.first()
        StackCard(st, top, n, Modifier.offset(x = 44.du, y = 34.du).then(if (anchors != null) Modifier.onGloballyPositioned { val b = it.boundsInRoot(); anchors.put("stacktop", Offset(b.left, b.top + b.height * .3f)) } else Modifier), d, onInspect)
        // native-panel.mjs withYield: an ability on top offers Forge's own yield (pass on it every time it is on top, until end of turn).
        if (top.ability) {
            val on = top.yielded
            val lock = st.prompt != null || st.inputType == "InputLockUI"
            Box(Modifier.offset(y = 183.du).width(192.du).wrapContentWidth(Alignment.CenterHorizontally)) {
                Box(Modifier.offset(x = (-44).du).clip(RoundedCornerShape(999.dp))
                    .background(if (on) Brush.verticalGradient(listOf(Color(0xFFF6DC9A), Color(0xFFD9A64A))) else Brush.verticalGradient(listOf(Color(0x0DFFFFFF), Color(0x0DFFFFFF))))
                    .semantics { contentDescription = if (on) "Stop yielding to this ability" else "Pass on this ability every time it is on top, until end of turn. Targets and choices still stop."; role = Role.Button; stateDescription = if (on) "On" else "Off" }
                    .clickable(enabled = !lock) { onYield(top.id, !on) }.padding(horizontal = 10.du, vertical = 4.du)) {
                    Text(if (on) "Yielding" else "Yield", style = sans(sp(11f), FontWeight.Bold, if (on) Color(0xFF1B1406) else Color(0xFFCFD4DC)))
                }
            }
        }
    }
}

/** The arc from the top of the stack back to its source permanent, which glows; drawn over the whole board in root space. */
@Composable
private fun StackArc(st: MatchState, d: Du) = with(d) {
    val anchors = LocalAnchors.current ?: return@with
    val top = st.stack.firstOrNull() ?: return@with
    val srcId = top.source?.id ?: return@with
    if (st.players.none { p -> p.battlefield.any { it.id == srcId } }) return@with
    val dash = if (Motion.still) remember { mutableFloatStateOf(0f) } else rememberInfiniteTransition(label = "arc").animateFloat(0f, 1f, infiniteRepeatable(tween(1200, easing = LinearEasing)), label = "dash")
    var self by remember { mutableStateOf(Offset.Zero) }
    Canvas(Modifier.fillMaxSize().onGloballyPositioned { self = it.boundsInRoot().topLeft }) {
        anchors.version.intValue
        val a = anchors.map["stacktop"] ?: return@Canvas; val b = anchors.map["c$srcId"] ?: return@Canvas
        val from = a - self; val to = b - self
        val path = Path().apply { moveTo(from.x, from.y); quadraticTo((from.x + to.x) / 2, minOf(from.y, to.y) - 60.du.toPx(), to.x, to.y) }
        drawPath(path, Gold.copy(alpha = .9f), style = Stroke(2.5f.du.toPx(), cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(1f, 9.du.toPx()), -dash.value * 10.du.toPx())))
        drawCircle(Brush.radialGradient(listOf(Gold.copy(alpha = .55f), Color.Transparent), center = to, radius = 34.du.toPx()), radius = 34.du.toPx(), center = to)
        drawCircle(Color(0xFFFFE9B0), radius = 4.du.toPx(), center = to)
    }
}

/** One stack item as a card: a spell shows its card; a triggered or activated ability shows the source's art, its kind and its text. */
@Composable
private fun StackCard(st: MatchState, s: StackItem, n: Int, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, small: Boolean = false) = with(d) {
    val mine = s.controller == st.viewer
    val rim = if (mine) Gold else CpuRed
    val src = s.source
    val ability = s.ability || src == null || src.zone != "Stack"
    val w = 104.du; val h = 145.du
    Box(modifier.size(w, h)) {
        Box(Modifier.fillMaxSize().drawBehind {
            drawRoundRect(rim.copy(alpha = .35f), topLeft = Offset(-6.du.toPx(), -6.du.toPx()), size = Size(size.width + 12.du.toPx(), size.height + 12.du.toPx()), cornerRadius = CornerRadius(12.du.toPx()))
        }.clip(RoundedCornerShape(7.du)).border(2.dp, rim, RoundedCornerShape(7.du)).background(Color(0xFF1A1714))
            .clickable(enabled = src != null) { src?.let(onInspect) }) {
            if (!ability && src != null) CardImage(src.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            else Column(Modifier.fillMaxSize().padding(4.du)) {
                Text((src?.name ?: "Ability"), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(9.5f), color = Color(0xFFF3E7C6)), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Box(Modifier.padding(top = 3.du).fillMaxWidth().height(52.du).clip(RoundedCornerShape(3.du))) { src?.let { CardImage(it.name, Modifier.fillMaxSize(), crop = true) } }
                Text(if (s.text.contains("Whenever") || s.text.contains("When ") || s.text.contains("At the beginning")) "Triggered ability" else "Activated ability",
                    style = sans(sp(9f), FontWeight.SemiBold, Color(0xFFD8C9A6)).copy(fontStyle = FontStyle.Italic), modifier = Modifier.padding(top = 3.du))
                Box(Modifier.padding(top = 3.du).fillMaxWidth().height(1.dp).background(rim.copy(alpha = .5f)))
                Text(s.text.substringAfter(" — ", s.text), style = sans(sp(8.5f), FontWeight.Normal, Color(0xFFEEE6D4)), modifier = Modifier.padding(top = 3.du), maxLines = 5, overflow = TextOverflow.Ellipsis)
            }
        }
        if (n > 1) Box(Modifier.align(Alignment.TopEnd).offset(6.du, (-8).du).clip(RoundedCornerShape(999.dp)).background(Brush.radialGradient(listOf(Color(0xFFFFF2C6), Color(0xFFD9B463), Color(0xFFA9822F))))
            .border(2.dp, Color(0xFFFFF3CF), RoundedCornerShape(999.dp)).padding(horizontal = 5.du)) { Text("×$n", style = sans(sp(11f), FontWeight.Bold, Color(0xFF2A1D05))) }
    }
}

// ---- Buttons (.forge-native-actions on the seat) ----

@Composable
private fun GoldPill(text: String, enabled: Boolean, modifier: Modifier, d: Du, onClick: () -> Unit) = with(d) {
    Box(modifier.size(138.du, 44.du).drawBehind { drawRoundRect(Color(0x3DC99A4B), topLeft = Offset(0f, 8.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
        .clip(RoundedCornerShape(999.dp)).background(if (enabled) Brush.verticalGradient(listOf(Color(0xFFF7DA97), Color(0xFFE8B95B), Color(0xFFC4903A))) else Brush.verticalGradient(listOf(Color(0xFF6B5A3A), Color(0xFF4A3E28))))
        .border(1.dp, Color(0xFFF6DFA8), RoundedCornerShape(999.dp)).clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) {
        Text(text, style = sans(sp(15f), FontWeight.Bold, Color(0xFF1B1408)), maxLines = 1, textAlign = TextAlign.Center)
    }
}

@Composable
private fun GlassPill(text: String, enabled: Boolean, modifier: Modifier, d: Du, onClick: () -> Unit) = with(d) {
    Box(modifier.height(36.du).clip(RoundedCornerShape(999.dp)).background(Color(0xB30C0D12)).border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(999.dp))
        .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 14.du), contentAlignment = Alignment.Center) {
        Text(text, style = sans(sp(12.5f), FontWeight.SemiBold, Color(0xFFEEE6D4)), maxLines = 1)
    }
}

// ---- Response controls (forge-table.mjs: Smart, Full Control and auto-pay emblems by your portrait) ----

private val SMART_ICON = "M13 2 4 14h7l-1 8 9-12h-7z"
private val FULL_ICON = "M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.5 1.5 0 0 1 2.5-1.7L8 15"
private val PAY_ICON = "M12 7v10M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14.5"
private val EMOTE_ICON = "M4 5h16v11H9l-5 4Z"

/** A 24-unit SVG stroke icon (stroke 2, round caps and joins), drawn at [size]. */
@Composable
private fun StrokeIcon(path: String, color: Color, size: Dp, stroke: Float = 2f, circle: Boolean = false, dots: Boolean = false) {
    val p = remember(path) { androidx.compose.ui.graphics.vector.PathParser().parsePathString(path).toPath() }
    Canvas(Modifier.size(size)) {
        val k = this.size.width / 24f
        scale(k, k, pivot = Offset.Zero) {
            val st = Stroke(stroke, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round)
            if (circle) drawCircle(color, radius = 8f, center = Offset(12f, 12f), style = st)
            drawPath(p, color, style = st)
            if (dots) for (x in listOf(8f, 12f, 16f)) drawCircle(color, radius = 1.2f, center = Offset(x, 10.5f))
        }
    }
}

/** .forge-control-emblem: 28 px, #0f1117cc with a #ffffff2a hairline; on = gold rim, warm radial fill, #f4d78f icon. */
@Composable
private fun Emblem(on: Boolean, enabled: Boolean, label: String, d: Du, onClick: () -> Unit, icon: @Composable (Color) -> Unit) = with(d) {
    val hf = androidx.compose.ui.platform.LocalHapticFeedback.current
    val press = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val down by press.collectIsPressedAsState()
    Box(Modifier.size(28.du).graphicsLayer { val s = if (down && enabled) .92f else 1f; scaleX = s; scaleY = s; alpha = if (enabled) 1f else .55f }
        .drawBehind { if (on) drawCircle(Brush.radialGradient(listOf(Gold.copy(alpha = .33f), Color.Transparent), radius = size.width * .9f), radius = size.width * .9f) }
        .clip(CircleShape)
        .background(if (on) Brush.radialGradient(listOf(Color(0xFF4A3C1F), Color(0xFF1B160C)), center = Offset.Unspecified) else Brush.linearGradient(listOf(Color(0xCC0F1117), Color(0xCC0F1117))))
        .border(1.dp, if (on) Gold else Color(0x2AFFFFFF), CircleShape)
        .semantics { contentDescription = label; role = Role.Button; stateDescription = if (on) "On" else "Off" }
        .clickable(enabled = enabled, interactionSource = press, indication = null) { if (AppSettings.haptics) hf.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove); onClick() },
        contentAlignment = Alignment.Center) { icon(if (on) Color(0xFFF4D78F) else Color(0xFF8D95A5)) }
}

@Composable
private fun ControlEmblems(st: MatchState, intents: TableIntents, modifier: Modifier, d: Du) = with(d) {
    if (st.controlMode !in setOf("smart", "full")) return@with
    val lock = st.prompt != null || st.inputType == "InputLockUI" || st.busy
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.du)) {
        Emblem(st.controlMode == "smart", !lock, "Smart: passes empty response windows. Targets and required choices stay yours.", d, { intents.mode("smart") }) { StrokeIcon(SMART_ICON, it, 14.du) }
        Emblem(st.controlMode == "full", !lock, "Full Control: stop at every response window.", d, { intents.mode("full") }) { StrokeIcon(FULL_ICON, it, 14.du) }
        st.autoPay?.let { on ->
            Emblem(on, !lock, if (on) "Auto-pay mana: on" else "Auto-pay mana: off", d, { intents.autoPay(!on) }) { StrokeIcon(PAY_ICON, it, 14.du, circle = true) }
        }
    }
}

// ---- Emotes (table-emotes.mjs) ----

/** .forge-emote-button: 30 px glass circle with a speech bubble, top-right of your portrait. */
@Composable
private fun EmoteButton(modifier: Modifier, d: Du) = with(d) {
    val hf = androidx.compose.ui.platform.LocalHapticFeedback.current
    val open = TableEmotes.menuOpen
    Box(modifier.size(30.du).drawBehind { drawCircle(Color(0x99000000), radius = size.width / 2 + 2.du.toPx(), center = center + Offset(0f, 4.du.toPx())) }
        .clip(CircleShape).background(Color(0xD914161D)).border(1.dp, if (open) Color(0xFFF0C27A) else Color(0x66D6AD64), CircleShape)
        .semantics { contentDescription = "Emotes"; role = Role.Button }
        .clickable { if (AppSettings.haptics) hf.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove); TableEmotes.menuOpen = !open }, contentAlignment = Alignment.Center) {
        StrokeIcon(EMOTE_ICON, if (open) Color(0xFFF2D18E) else Color(0xFFE9DFCB), 17.du, stroke = 1.8f, dots = true)
    }
}

/** The emote menu (above the button) and both speech bubbles: yours above your portrait, the CPU's below its seat, kept 8 px inside the edges. */
@Composable
private fun EmoteLayer(W: Dp, H: Dp, d: Du) = with(d) {
    val hf = androidx.compose.ui.platform.LocalHapticFeedback.current
    val density = androidx.compose.ui.platform.LocalDensity.current
    @Composable fun bubble(b: TableEmotes.Bubble?, mine: Boolean) {
        if (b == null) return
        val shown = remember(b.serial) { Animatable(if (Motion.still) 1f else 0f) }
        LaunchedEffect(b.serial) { if (!Motion.still) shown.animateTo(1f, tween(220, easing = CubicBezierEasing(.2f, .9f, .3f, 1.3f))) }
        val leave by animateFloatAsState(if (b.leaving) 1f else 0f, tween(250), label = "leave")
        var size by remember(b.serial) { mutableStateOf(IntSize.Zero) }
        val w = with(density) { size.width.toDp() }; val h = with(density) { size.height.toDp() }
        val cx = if (mine) 106.du else W - 40.du
        val left = (cx - w / 2).coerceIn(8.du, (W - w - 8.du).coerceAtLeast(8.du))
        val top = if (mine) (H - 78.du - h - 10.du).coerceAtLeast(8.du) else 88.du
        Box(Modifier.offset(x = left, y = top).widthIn(max = 220.du).onSizeChanged { size = it }
            .graphicsLayer { alpha = (1f - leave) * shown.value.coerceIn(0f, 1f); val s = .85f + .15f * shown.value; scaleX = s; scaleY = s; translationY = -4.du.toPx() * leave }
            .drawBehind { drawRoundRect(Color(0xAA000000), topLeft = Offset(0f, 10.du.toPx()), size = this.size, cornerRadius = CornerRadius(16.du.toPx())) }
            .clip(RoundedCornerShape(16.du)).background(if (mine) Color(0xFFF4EAD6) else Color(0xFF1A1D26))
            .border(1.dp, if (mine) Color(0x55D6AD64) else Color(0x668FB6E8), RoundedCornerShape(16.du))
            .semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite; contentDescription = (if (mine) "You: " else "CPU: ") + b.text }
            .padding(horizontal = 14.du, vertical = 8.du)) {
            Text(b.text, style = sans(sp(14f), FontWeight.Bold, if (mine) Color(0xFF1B1408) else Color(0xFFEFE7D6)).copy(lineHeight = sp(17.5f)))
        }
    }
    bubble(TableEmotes.you, true); bubble(TableEmotes.cpu, false)
    if (TableEmotes.menuOpen) {
        // A tap anywhere else closes it.
        Box(Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { TableEmotes.menuOpen = false } })
        var mh by remember { mutableStateOf(0) }
        val hDp = with(density) { mh.toDp() }
        Column(Modifier.offset(x = 117.du, y = (H - 93.du - hDp - 8.du).coerceAtLeast(8.du)).widthIn(min = 150.du).onSizeChanged { mh = it.height }
            .drawBehind { drawRoundRect(Color(0xBB000000), topLeft = Offset(0f, 14.du.toPx()), size = size, cornerRadius = CornerRadius(14.du.toPx())) }
            .clip(RoundedCornerShape(14.du)).background(Color(0xF0101319)).border(1.dp, Color(0x44D6AD64), RoundedCornerShape(14.du)).padding(6.du)
            .width(IntrinsicSize.Max), verticalArrangement = Arrangement.spacedBy(4.du)) {
            for ((id, label) in TableEmotes.EMOTES)
                Box(Modifier.fillMaxWidth().heightIn(min = 40.du).clip(RoundedCornerShape(10.du)).clickable { if (AppSettings.haptics) hf.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove); TableEmotes.pick(id, label) }.padding(horizontal = 14.du), contentAlignment = Alignment.CenterStart) {
                    Text(label, style = sans(sp(14f), FontWeight.SemiBold, Color(0xFFEFE7D6)))
                }
            Box(Modifier.padding(top = 2.du).fillMaxWidth().height(1.dp).background(Color(0x14FFFFFF)))
            Box(Modifier.fillMaxWidth().heightIn(min = 40.du).clip(RoundedCornerShape(bottomStart = 10.du, bottomEnd = 10.du)).clickable { TableEmotes.toggleMute() }.padding(horizontal = 14.du), contentAlignment = Alignment.CenterStart) {
                Text(if (TableEmotes.muted) "Unmute CPU" else "Mute CPU", style = sans(sp(12f), FontWeight.SemiBold, Color(0xFFA99D86)))
            }
        }
    }
}
