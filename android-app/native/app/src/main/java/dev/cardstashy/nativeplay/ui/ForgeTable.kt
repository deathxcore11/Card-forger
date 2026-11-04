package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.draw.drawWithContent
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.engine.GameEvent
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.unit.em
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.Paint
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
    val attackAll: (List<Int>) -> Unit = {}, val unblock: (Int, Int) -> Unit = { _, _ -> },
    val stop: (String) -> Unit = {}, val mode: (String) -> Unit = {}, val autoPay: (Boolean) -> Unit = {}, val yieldSource: (Int, Boolean) -> Unit = { _, _ -> },
    /** nativeSelect('stack', id): a spell or ability on the stack picked as a target. */
    val stack: (Int) -> Unit = {},
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
        st.inputType == "InputAttack" -> mine.count { Affordability.owesAttack(it) }.let { must -> if (must > 0) "$must must attack" else mine.count { it.attacking }.let { if (it > 0) "Attack with $it" else "No attacks" } }
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

internal fun sans(size: TextUnit, weight: FontWeight = FontWeight.Bold, color: Color = Color(0xFFEEE6D4)) =
    TextStyle(fontFamily = Type.Sans, fontWeight = weight, fontSize = size, color = color)

/** One design unit as Dp: the site's CSS px at 844 × 390, scaled to fit. */
internal val LocalAttackInput = androidx.compose.runtime.staticCompositionLocalOf { false }

/** The site's touch layout for a big board (min-width 600, min-height 480). */
internal fun bigBoard(w: Dp, h: Dp) = w >= 600.dp && h >= 480.dp
/** Controls keep their CSS px on a big board; a phone scales the 844 × 390 design to fit. */
internal fun chromeU(w: Dp, h: Dp) = if (bigBoard(w, h)) 1f else minOf(w.value / 844f, h.value / 390f)

internal class Du(val u: Float) {
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
    modifier: Modifier = Modifier, menu: MatchMenu? = null, overlay: @Composable (Dp.() -> Unit)? = null,
) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        val d = Du(chromeU(maxWidth, maxHeight))
        with(d) {
            val W = maxWidth; val H = maxHeight
            val me = st.me; val cpu = st.cpu
            // forge-table.mjs role(): chosen, then a target, then a choice (discard while a discard asks), then playable.
            val discarding = st.prompt == null && st.selection.cards.isNotEmpty() && Regex("\\bdiscard\\b", RegexOption.IGNORE_CASE).containsMatchIn(st.message)
            // forge-table.mjs: a card you can't pay for leaves the playable set and says why ("Not enough mana").
            val shortCasts = remember { ShortCasts() }
            val blocked = remember(st) { shortCasts.blocked(st) }
            fun markOf(card: Card): Mark = when {
                !live -> Mark.NONE
                card.id in blocked -> Mark.NONE
                card.id in st.selection.chosenCards -> Mark.PICKED
                card.id in st.selection.targetCards -> Mark.TARGET
                card.id in st.selection.cards -> if (discarding) Mark.DISCARD else Mark.PICKABLE
                card.id in st.selection.actionable -> Mark.PLAYABLE
                else -> Mark.NONE
            }
            fun tapOf(card: Card): (() -> Unit)? = if (live && (card.id in st.selection.cards || card.id in st.selection.targetCards || (card.id in st.selection.actionable && card.id !in blocked) || card.id in st.selection.chosenCards ||
                ((st.inputType == "InputAttack" || st.inputType == "InputBlock") && card.controller == st.viewer && (card.attacking || card.blocking)))) ({ intents.card(card.id) }) else null

            // The battlefield band (46 du from the top to 61 du from the bottom); the two halves meet at its middle.
            val bandTop = 46.du; val bandBottom = H - 61.du
            val large = bigBoard(W, H)
            // A big board (the site's touch layout at 600 × 480 and up): the seats take 146 px at the top and 152 at the bottom.
            val mid = if (large) (146.dp + H - 152.dp) / 2 else (bandTop + bandBottom) / 2
            val stretch = ((bandBottom - bandTop) / 283.du).coerceAtLeast(1f)
            val centreX = W / 2
            // --play-piece: the larger of one creature row or two that fits the half's height and the board's width, clamp(56, …, 168).
            val piece: Dp? = if (!large) null else {
                val zoneH = (mid - 146.dp - 52.dp).value; val zoneW = (W - 152.dp).value
                fun piles(cs: List<Card>) = cs.groupBy { if (it.counters.isEmpty() && it.damage == 0 && !it.attacking && !it.blocking) "${it.name}|${it.tapped}" else "id${it.id}" }.size
                val cu = maxOf(piles(others(cpu.battlefield)), piles(others(me.battlefield)), 1); val ou = maxOf(piles(backRow(cpu.battlefield)), piles(backRow(me.battlefield)), 1)
                val cg = 12f * (cu - 1); val og = 12f * (ou - 1) + 22f
                val h1 = (zoneH - 24f) * .55f; val h2 = (zoneH * .6f - 22f) / 1.8f
                val c1 = (zoneW - 40f - cg) / (cu * 1.18f); val c2 = (zoneW - 40f - cg / 2) / (cu * 1.18f / 2 + .6f)
                val o = (zoneW - 56f - og) / (ou * .98f) * 1.6f
                maxOf(minOf(h1, c1, o), minOf(h2, c2, o)).coerceIn(56f, 168f).dp
            }

            // The divider between the halves: a thin violet line with a notch on your side's turn.
            Box(Modifier.offset(y = mid).fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x998A7BD8), Color(0x998A7BD8), Color.Transparent))))

            // CPU half: lands at the back, creatures at the front; yours mirrored.
            // A creature Forge says must attack this combat wears a tag until it is in the attack.
            androidx.compose.runtime.CompositionLocalProvider(LocalAttackInput provides (live && st.inputType == "InputAttack")) {
                if (piece != null) {
                    // Rows on a big board: the CPU's creatures end 34 above the divider, its other lane 32 above them; yours start 26 below, the other lane 19 under.
                    val ch = piece * .9f; val oh = piece * .68f; val room = W - 192.dp
                    PermanentRow(backRow(cpu.battlefield), true, lands(cpu.battlefield).size, centreX, mid - 34.dp - ch - 32.dp - oh / 2, room, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) }, piece = piece)
                    PermanentRow(others(cpu.battlefield), false, 0, centreX, mid - 34.dp - ch / 2, room, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) }, piece = piece)
                    PermanentRow(others(me.battlefield), false, 0, centreX, mid + 26.dp + ch / 2, room, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) }, piece = piece)
                    PermanentRow(backRow(me.battlefield), true, lands(me.battlefield).size, centreX, mid + 26.dp + ch + 19.dp + oh / 2, room, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) }, piece = piece)
                } else {
                    PermanentRow(backRow(cpu.battlefield), true, lands(cpu.battlefield).size, centreX, mid - 77.5f.du * stretch, W - 180.du, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) })
                    PermanentRow(others(cpu.battlefield), false, 0, centreX, mid - 34.du * stretch, W - 180.du, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) })
                    PermanentRow(others(me.battlefield), false, 0, centreX, mid + 27.du * stretch, W - 180.du, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) })
                    PermanentRow(backRow(me.battlefield), true, lands(me.battlefield).size, centreX, mid + 71.5f.du * stretch, W - 300.du, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) })
                }
            }

            // Piles: yours right of your back row, the CPU's left of its back row.
            Piles(me, mine = true, Modifier.offset(x = W - 120.du, y = if (large) mid + 60.dp else mid + 46.du * stretch), d, onInspect)
            Piles(cpu, mine = false, Modifier.offset(x = 44.du, y = if (large) mid - 120.dp else mid - 104.du * stretch), d, onInspect)

            // The CPU's hand, tucked off the top edge: the lower half of each back.
            TuckedHand(cpu.handCount, Modifier.offset(y = (-17).du).align(Alignment.TopCenter), d)

            // Seats: the CPU top right, you bottom left; command-zone crests beside them.
            // A big board moves the seats 4 px in and the bottom-left group 14 px up (site probes at 960 × 840 and 1280 × 800).
            val lx = if (large) 4.dp else 0.dp; val ly = if (large) 14.dp else 0.dp
            Crest(cpu.command.firstOrNull(), Modifier.offset(x = W - 136.du - lx, y = 6.du + lx), d, onInspect)
            Medallion(cpu, mine = false, live && cpu.id in st.selection.players, cpu.id in st.selection.chosenPlayers, Modifier.offset(x = W - 66.du - lx, y = 12.du + lx), d) { intents.player(cpu.id) }
            Crest(me.command.firstOrNull(), Modifier.offset(x = 10.du + lx, y = H - 86.du - ly), d, onInspect)
            Medallion(me, mine = true, live && me.id in st.selection.players, me.id in st.selection.chosenPlayers, Modifier.offset(x = 80.du + lx, y = H - 78.du - ly), d) { intents.player(me.id) }
            ManaPool(me.mana, Modifier.offset(x = 106.du + lx, y = H - 103.du - ly), d)
            // Smart / Full Control / auto-pay just right of your portrait, the emote button on its top-right corner (site: 117, 297).
            ControlEmblems(st, intents, Modifier.offset(x = 149.du + lx, y = H - 103.du - ly), d)
            EmoteButton(Modifier.offset(x = 117.du + lx, y = H - 93.du - ly), d)

            // Menu and the phase track, top left.
            val menuX = if (large) 12.dp else 8.du; val menuY = if (large) 12.dp else 34.du
            Box(Modifier.offset(x = menuX, y = menuY).size(44.du).clip(CircleShape).background(Color(0x6612141A)).border(1.dp, Color(0x24FFFFFF), CircleShape)
                .clickable { if (menu != null) menu.open = !menu.open else onMenu() }, contentAlignment = Alignment.Center) { MenuGlyph(d) }
            // The menu carries the stack size as a badge (summary[data-count]::after: 18 px gold pill at -4, -4).
            if (st.stack.isNotEmpty()) Box(Modifier.offset(x = menuX + (44 - 18 + 4).du, y = menuY - 4.du).heightIn(min = 18.du).widthIn(min = 18.du).clip(RoundedCornerShape(9.du)).background(Color(0xFFE8B95B)).padding(horizontal = 5.du),
                contentAlignment = Alignment.Center) { Text("${st.stack.size}", style = sans(sp(11f), FontWeight.ExtraBold, Color(0xFF1B1406))) }
            PhaseTrack(st, stopLights(st), intents.stop, Modifier.offset(x = if (large) 80.dp else 74.du, y = if (large) 20.dp else 42.du), d)

            // The stack, fanned on the right over its portal, with the arc to its source.
            if (st.stack.isNotEmpty()) { StackFan(st, Modifier.offset(x = W - 214.du, y = mid - 110.du), d, onInspect, live, intents.yieldSource, intents.stack); StackArc(st, d) }

            // The hand: centred 44 du right of the middle (between your seat and the buttons), the middle card's top 67 du above the bottom.
            val hand = orderedHand(me.hand, handOrder)
            // The hand: 66 px cards on a phone; on a big board they grow with the screen (site: 109 px at 840 tall, 104 at 800).
            val handW = if (large) (H.value * .13f).coerceIn(66f, 120f).dp else 66.du
            Box(Modifier.offset(x = centreX + 44.du - handW / 66f * 222f, y = H - handW / 66f * 67f).width(handW / 66f * 444f).height(handW / 66f * 120f)) {
                HandFan(hand, handW, Modifier.fillMaxWidth(), raised = selectedHand, angleDeg = 1.2f,
                    markOf = ::markOf,
                    canPlay = { card -> live && card.id in st.selection.actionable && card.id !in blocked },
                    blockedOf = { card -> if (live) blocked[card.id] else null },
                    onTap = { card ->
                        val playable = live && card.id in st.selection.actionable && card.id !in blocked
                        when {
                            live && card.id in st.selection.cards -> intents.card(card.id)
                            live && card.id in blocked -> if (selectedHand == card.id) onInspect(card) else onSelectHand(card.id)
                            playable && selectedHand == card.id -> onInspect(card)
                            playable -> onSelectHand(card.id)
                            else -> onInspect(card)
                        }
                    },
                    onPlay = { card -> onSelectHand(null); intents.card(card.id) },
                    onHold = onInspect, onReorder = { ids -> onHandOrder(ids) })
            }

            // The buttons, bottom right: the gold step and the quiet second one above it (right edges 8 du in, as the site's dock).
            if (st.prompt == null && st.waitingOnMe) {
                val selected = selectedHand?.takeIf { it !in blocked }?.let { st.card(it) }
                val ok = if (selected != null) (if (selected.isLand) "Play land" else "Cast") else okLabel(st)
                val second = if (selected != null) null else cancelLabel(st)
                // A declaration Forge would refuse (a must-attack creature left out) is not offered as a live button.
                val mustLeft = st.inputType == "InputAttack" && st.me.battlefield.any { Affordability.owesAttack(it) }
                val okOn = st.buttons.okEnabled && !mustLeft
                // A payment your mana can't finish: Cancel is the main button, and Pay automatically steps aside.
                val short = Affordability.paying(st)?.short == true
                // native-panel.mjs "Attack all": every creature Forge offers joins, one tap each, in order.
                val offered = if (st.inputType == "InputAttack") st.selection.cards.mapNotNull { st.card(it) }.filter { it.zone == "Battlefield" && it.controller == st.viewer && !it.attacking } else emptyList()
                val attackAll = offered.isNotEmpty() && st.selection.cards.size >= 2
                // On a big board the dock's buttons stand in one row, 12 from the right edge and 180 above the bottom (site: 660 at 840 tall).
                val upperM = if (large) Modifier else Modifier.align(Alignment.TopEnd).offset(x = (-8).du, y = H - 94.du)
                val lowerM = if (large) Modifier else Modifier.align(Alignment.TopEnd).offset(x = (-8).du, y = H - 52.du)
                val attackM = if (large) Modifier else Modifier.align(Alignment.TopEnd).offset(x = (-8).du, y = H - 44.du)
                val rowM = Modifier.align(Alignment.TopEnd).offset(x = (-12).dp, y = H - 180.dp)
                @Composable fun pair(content: @Composable () -> Unit) = if (large) Row(rowM, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { content() } else content()
                pair {
                    if (attackAll) {
                        GoldPill(ok, live && okOn, upperM, d) { intents.ok() }
                        GlassPill("Attack all", live, attackM, d, tone = Color(0xFFFFD9CF), edge = Color(0x88FF8A6A)) { intents.attackAll(offered.map { it.id }) }
                    } else if (oneTarget(st)) {
                        second?.let { GlassPill(it, live, upperM, d) { intents.cancel() } }
                        if (st.selection.min == 0 && st.buttons.okEnabled) GoldPill("No target", live, lowerM, d) { intents.ok() }
                    } else if (short && second != null) {
                        if (st.buttons.okEnabled) GlassPill(ok, live, upperM, d) { intents.ok() }
                        GoldPill(second, live, lowerM, d) { intents.cancel() }
                    } else {
                        second?.let { GlassPill(it, live, upperM, d) { intents.cancel() } }
                        GoldPill(ok, live && (selected != null || okOn), lowerM, d) {
                            if (selected != null) { onSelectHand(null); intents.card(selected.id) } else intents.ok()
                        }
                    }
                }
            }
            if (live) askLine(st)?.let { AskLine(it, W, H, d) }
            // The line between the halves turns into the combat line while you declare (gold attacking, blue blocking).
            CombatLine(st, mid, W, d)
            // Arrows: attackers to what they attack, blockers to their attacker, your spell to its targets, the top of the stack to its own.
            Arrows(st, live, intents, d)
            OwnCast(st, d)
            overlay?.invoke(W)
            // The order dialog, a damage split and the zone picker sit over the table; the CPU's line waits under them.
            val covered = live && st.prompt?.let { p -> p.method == "order" || p.method.startsWith("assign") || p.options.any { it.zone in setOf("Library", "Graveyard", "Exile") } } == true
            if (!covered) EmoteLayer(W, H, d)
            // The deck tracker under the table controls on the left; the menu over everything.
            if (menu != null) { DeckTracker(st, menu, H, d, menuX, menuY + 44.du + 10.du); if (menu.open) MenuPanel(menu, st.stack.size, d, menuX, menuY + 44.du + 8.du) }
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
private fun PermanentRow(cards: List<Card>, land: Boolean, split: Int = 0, cx: Dp, cy: Dp, room: Dp, d: Du, markOf: (Card) -> Mark, tapOf: (Card) -> (() -> Unit)?, onInspect: (Card) -> Unit, mine: Boolean = false, lookup: (Int) -> Card? = { null }, piece: Dp? = null) = with(d) {
    if (cards.isEmpty()) return@with
    val piles = cards.withIndex().groupBy { (i, it) -> if (markOf(it) == Mark.NONE && tapOf(it) == null && it.counters.isEmpty() && it.damage == 0 && !it.attacking && !it.blocking) "${if (i < split) "l" else "o"}|${it.name}|${it.tapped}" else "id${it.id}" }.values.map { g -> g.map { it.value } }
    // The second lane (site: +22 px between lanes) starts at the first pile past the lands.
    val laneAt = piles.indexOfFirst { p -> cards.indexOf(p.first()) >= split }.takeIf { split in 1 until cards.size } ?: -1
    // A big board: creatures piece·1.18 × piece·.9, other permanents piece·.98 × piece·.68; a pile overlaps by piece·.8 (·.6); lanes 22 apart.
    val laneGap = if (piece != null) 22.dp else 12.du
    val w = if (piece != null) (if (land) piece * .98f else piece * 1.18f) else if (land) 42.du else 50.du
    val h = if (piece != null) (if (land) piece * .68f else piece * .9f) else if (land) 29.du else 38.du
    val step = if (piece != null) (if (land) w - piece * .6f else w - piece * .8f) else 9.du; val gap = if (piece != null) 12.dp else 10.du
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
                    Tile(card, w, h, land, markOf(card), mine, lookup, tapOf(card), onInspect, Modifier.offset(x = px + step * j).zIndex(j.toFloat()), d,
                        count = if (j == pile.lastIndex && pile.size > 1) pile.size else 1, piece = piece, pileTop = j == pile.lastIndex)
                }
            }
            x += widths[i] + gap
        }
    }
}

/** A permanent (.play-match-card on the battlefield): the art crop in a #141418 tile with a 1.5 du ring in its frame colour. */
@Composable
private fun Tile(card: Card, w: Dp, h: Dp, land: Boolean, mark: Mark, mineSide: Boolean, lookup: (Int) -> Card?, onTap: (() -> Unit)?, onInspect: (Card) -> Unit, modifier: Modifier, d: Du, count: Int = 1, piece: Dp? = null, pileTop: Boolean = true) = with(d) {
    val (a, _) = frameTone(cardColors(card))
    // play-forge-table.css: a role's ring and glow (playable/choice #5cc8ff, target #ff9d5c, chosen #f3d27e), combat over it (attacking #ff6a4a, blocking #6aaeff).
    val combat = card.attacking || card.blocking
    val role: Triple<Color, Float, Color>? = when {
        card.attacking -> Triple(Color(0xFFFF6A4A), 2f, Color(0x99FF5A3A))
        card.blocking -> Triple(Color(0xFF6AAEFF), 2f, Color(0x995A9CFF))
        mark == Mark.PICKED -> Triple(Color(0xFFF3D27E), 2.5f, Color(0x8CF3D27E))
        mark == Mark.TARGET -> Triple(Color(0xFFFF9D5C), 2f, Color(0x8CFF9D5C))
        mark == Mark.DISCARD -> Triple(Color(0xFFFF7A6B), 2f, Color(0x8CFF6A5A))
        mark == Mark.PLAYABLE || mark == Mark.PICKABLE -> Triple(Ice, 2f, Color(0x8C5CC8FF))
        else -> null
    }
    val ring = role?.first ?: lerp(a, Color.White, .15f)
    val turn by animateFloatAsState(if (card.tapped) 20f else 0f, tween(140, easing = FastOutSlowInEasing), label = "tap")
    val anchors = LocalAnchors.current
    val shape = RoundedCornerShape(10.du)
    Box(modifier.size(w, h)
        .graphicsLayer { rotationZ = turn; val s = if (card.tapped) .94f else 1f; scaleX = s; scaleY = s; translationY = if (card.attacking) (if (mineSide) -12f else 12f) * u * density else 0f }
        .then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("c${card.id}", it.boundsInRoot()) } else Modifier)
        .drawBehind {
            // box-shadow: 0 0 0 1.5px ring, 0 0 0 2.5px #000d, 0 10px 22px #000b
            val r = 10.du.toPx()
            drawRoundRect(Color(0xBB000000), topLeft = Offset(0f, 6.du.toPx()), size = size, cornerRadius = CornerRadius(r))
            drawRoundRect(Color(0xDD000000), topLeft = Offset(-2.5f.du.toPx(), -2.5f.du.toPx()), size = Size(size.width + 5f.du.toPx(), size.height + 5f.du.toPx()), cornerRadius = CornerRadius(r + 2.5f.du.toPx()))
            if (role != null) drawIntoCanvas { c ->
                // 0 0 ~20px 4px glow
                val spread = 4.du.toPx(); val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = role.third.toArgb(); maskFilter = android.graphics.BlurMaskFilter(10.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                c.nativeCanvas.drawRoundRect(-spread, -spread, size.width + spread, size.height + spread, r + spread, r + spread, p)
            }
            val ringW = (role?.second ?: 1.5f).du.toPx()
            drawRoundRect(ring, topLeft = Offset(-ringW, -ringW), size = Size(size.width + 2 * ringW, size.height + 2 * ringW), cornerRadius = CornerRadius(r + ringW))
        }
        .clip(shape).background(Color(0xFF141418))
        .pointerInput(card.id, onTap) { detectTapGestures(onTap = { onTap?.invoke() ?: onInspect(card) }, onLongPress = { onInspect(card) }) }) {
        // A big board (play-forge-table.css: --nh clamp(15, piece·.15, 22), --nf clamp(11, piece·.083, 13)): the name strip over a dark fade, the art below it.
        val nh = piece?.let { (it.value * .15f).coerceIn(15f, 22f).dp }
        Box(Modifier.fillMaxSize().padding(start = 2.du, end = 2.du, bottom = 2.du, top = nh?.let { it + 3.dp } ?: 2.du).clip(RoundedCornerShape(9.du))) {
            CardImage(card.name, Modifier.fillMaxSize(), crop = true) { Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(frameTone(cardColors(card)).first, frameTone(cardColors(card)).second)))) }
        }
        // A card under the top of its pile: art at brightness .78, no name.
        if (!pileTop) Box(Modifier.fillMaxSize().background(Color(0x38000000)))
        if (nh != null && piece != null && pileTop) Box(Modifier.fillMaxWidth().height(nh + 10.dp).background(Brush.verticalGradient(0f to Color(0xF007070B), .55f to Color(0xB807070B), 1f to Color(0x0007070B)))
            .padding(start = 7.dp, end = 7.dp, top = 3.dp)) {
            Text(card.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(fontFamily = Spectral, fontWeight = FontWeight.Bold, fontSize = (piece.value * .083f).coerceIn(11f, 13f).sp,
                color = Color(0xFFF6EFDF), lineHeight = (nh.value * 1f).sp, shadow = androidx.compose.ui.graphics.Shadow(Color.Black, Offset(0f, 1f), 2f)))
        }
        if (land) cardColors(card)?.firstOrNull()?.let { c ->
            Box(Modifier.align(Alignment.BottomStart).offset(x = 4.du, y = (-3).du).size(10.du).clip(CircleShape).background(LAND_DOT.getValue(c)).border(1.dp, Color(0xAAFFFFFF), CircleShape),
                contentAlignment = Alignment.Center) { Text("$c", style = sans(sp(7f), FontWeight.Bold, if (c == 'W') Color(0xFF111111) else Color.White)) }
        }
        // P/T: clamp(15, piece·.16, 23) in the creature lane, clamp(11, piece·.12, 17) elsewhere, on a big board.
        val statPx = piece?.let { if (land) (it.value * .12f).coerceIn(11f, 17f) else (it.value * .16f).coerceIn(15f, 23f) } ?: (h.value / u * .26f).coerceIn(9f, 18f)
        TileLayer(card, mark == Mark.PLAYABLE, lookup, d, h, if (card.isCreature && card.power != null) (if (piece != null) statPx / u else statPx) else 0f, top = nh?.let { it + 6.dp })
        // .play-current-stats: right 6px, bottom 2px, 1px 7px, #d6ad64c0 hairline, radius 7, #111114f2, white 700; the toughness reads #ff8f84 while damage is marked
        // (forge-table.mjs data-damaged; Forge's toughness already counts counters, damage is not subtracted).
        if (card.isCreature && card.power != null) {
            val fs = if (piece != null) statPx.sp else sp(statPx)
            Row(Modifier.align(Alignment.BottomEnd).offset(x = (-6).du, y = (-2).du).clip(RoundedCornerShape(7.du)).background(Color(0xF2111114)).border(1.dp, Color(0xC0D6AD64), RoundedCornerShape(7.du))
                .padding(horizontal = 7.du, vertical = 1.du)) {
                Text("${card.power} / ", style = sans(fs, FontWeight.Bold, Color.White))
                Text("${card.toughness ?: 0}", style = sans(fs, FontWeight.Bold, if (card.damage > 0) Color(0xFFFF8F84) else Color.White))
            }
        }
    }
    // .forge-must-tag: bottom -8, centred, #9e2a1e with a #ff8a6a hairline, #fff1ec 800 10.5px uppercase; the card gets a 2px #ff6a4a outline 3px out.
    if (LocalAttackInput.current && Affordability.owesAttack(card)) {
        Box(modifier.size(w, h).zIndex(19f).drawBehind {
            val o = 3.du.toPx(); val sw = 2.du.toPx()
            drawRoundRect(Color(0xFFFF6A4A), topLeft = Offset(-o - sw / 2, -o - sw / 2), size = Size(size.width + 2 * o + sw, size.height + 2 * o + sw), cornerRadius = CornerRadius(10.du.toPx() + o), style = Stroke(sw))
        }) {
            Text("MUST ATTACK", maxLines = 1, softWrap = false, style = sans(sp(10.5f), FontWeight.ExtraBold, Color(0xFFFFF1EC)).copy(letterSpacing = .06.em),
                modifier = Modifier.align(Alignment.BottomCenter).offset(y = 8.du).wrapContentWidth(unbounded = true).clip(RoundedCornerShape(999.dp)).background(Color(0xFF9E2A1E))
                    .border(1.dp, Color(0xFFFF8A6A), RoundedCornerShape(999.dp)).padding(horizontal = 7.du, vertical = 2.du))
        }
    }
    // .play-match-pile-count: on the card's left edge (left -10px), hanging under the pile (bottom -12px, translate -50%); a tapped pile centres it
    // (left 50%, translate -50% 0). It takes a tap and passes it to the top card.
    if (count > 1) {
        val bh = 19.du
        Box(modifier.offset(x = if (card.tapped) w / 2 - 15.du else (-10).du, y = if (card.tapped) h + 12.du - bh else h + 12.du - bh * 1.5f).zIndex(20f).height(bh).widthIn(min = 30.du)
            .clip(RoundedCornerShape(999.dp)).background(Brush.radialGradient(listOf(Color(0xFFFFF2C6), Color(0xFFD9B463), Color(0xFFA9822F)))).border(2.dp, Color(0xFFFFF3CF), RoundedCornerShape(999.dp))
            .pointerInput(card.id, onTap) { detectTapGestures(onTap = { onTap?.invoke() ?: onInspect(card) }) }
            .padding(horizontal = 4.du), contentAlignment = Alignment.Center) { Text("×$count", style = sans(sp(11f), FontWeight.ExtraBold, Color(0xFF2A1D05))) }
    }
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
    Box(modifier.size(52.du).then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("orb${p.id}", it.boundsInRoot()) } else Modifier)
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
private fun StackFan(st: MatchState, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, live: Boolean = false, onYield: (Int, Boolean) -> Unit = { _, _ -> }, onPick: (Int) -> Unit = {}) = with(d) {
    val pick: ((Int) -> Unit)? = if (live && st.selection.stackTargets.isNotEmpty()) onPick else null
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
            StackCard(st, s, 1, Modifier.offset(x = (44 - 16 * depth).du, y = (34 - 16 * depth).du).alpha(if (pick != null && s.id in st.selection.stackTargets) 1f else .6f), d, onInspect, small = true, pick = pick)
        }
        val (top, n) = shown.first()
        StackCard(st, top, n, Modifier.offset(x = 44.du, y = 34.du).then(if (anchors != null) Modifier.onGloballyPositioned { val b = it.boundsInRoot(); anchors.put("stacktop", Offset(b.left, b.top + b.height * .3f)); anchors.putRect("stackcard", b) } else Modifier), d, onInspect, pick = pick)
        // native-panel.mjs withYield: an ability on top offers Forge's own yield (pass on it every time it is on top, until end of turn).
        if (top.ability) {
            val on = top.yielded
            val lock = st.prompt != null || st.inputType == "InputLockUI"
            Box(Modifier.offset(y = 34.du + 145.du - 42.du).width(36.du).wrapContentWidth(Alignment.End, unbounded = true)) {
                Box(Modifier.clip(RoundedCornerShape(999.dp))
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
private fun StackCard(st: MatchState, s: StackItem, n: Int, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, small: Boolean = false, pick: ((Int) -> Unit)? = null) = with(d) {
    val mine = s.controller == st.viewer
    // A stack item Forge offers as a target wears the target role (#ff9d5c) and takes the tap.
    val target = pick != null && s.id in st.selection.stackTargets
    val rim = if (target) Color(0xFFFF9D5C) else if (mine) Gold else CpuRed
    val src = s.source
    val ability = s.ability || src == null || src.zone != "Stack"
    val w = 104.du; val h = 145.du
    Box(modifier.size(w, h)) {
        Box(Modifier.fillMaxSize().drawBehind {
            drawRoundRect(rim.copy(alpha = .35f), topLeft = Offset(-6.du.toPx(), -6.du.toPx()), size = Size(size.width + 12.du.toPx(), size.height + 12.du.toPx()), cornerRadius = CornerRadius(12.du.toPx()))
        }.clip(RoundedCornerShape(7.du)).border(2.dp, rim, RoundedCornerShape(7.du)).background(Color(0xFF1A1714))
            .clickable(enabled = target || src != null) { if (target) pick!!(s.id) else src?.let(onInspect) }) {
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
    Box(modifier.widthIn(min = 138.du).height(44.du).drawBehind { drawRoundRect(Color(0x3DC99A4B), topLeft = Offset(0f, 8.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
        .clip(RoundedCornerShape(999.dp)).background(if (enabled) Brush.verticalGradient(listOf(Color(0xFFF7DA97), Color(0xFFE8B95B), Color(0xFFC4903A))) else Brush.verticalGradient(listOf(Color(0xFF6B5A3A), Color(0xFF4A3E28))))
        .border(1.dp, Color(0xFFF6DFA8), RoundedCornerShape(999.dp)).clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) {
        // [data-native-key=ok]:after { content: ' ›'; font-size: 20px }
        Text(androidx.compose.ui.text.buildAnnotatedString {
            append(text)
            if (enabled) withStyle(androidx.compose.ui.text.SpanStyle(fontSize = sp(20f))) { append(" \u203A") }
        }, style = sans(sp(15f), FontWeight.Bold, Color(0xFF1B1408)), maxLines = 1, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 18.du))
    }
}

@Composable
private fun GlassPill(text: String, enabled: Boolean, modifier: Modifier, d: Du, tone: Color = Color(0xFFEEE6D4), edge: Color = Color(0x26FFFFFF), onClick: () -> Unit) = with(d) {
    Box(modifier.height(36.du).clip(RoundedCornerShape(999.dp)).background(Color(0xB30C0D12)).border(1.dp, edge, RoundedCornerShape(999.dp))
        .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 14.du), contentAlignment = Alignment.Center) {
        Text(text, style = sans(sp(12.5f), FontWeight.SemiBold, tone), maxLines = 1)
    }
}

// ---- Response controls (forge-table.mjs: Smart, Full Control and auto-pay emblems by your portrait) ----

private val SMART_ICON = "M13 2 4 14h7l-1 8 9-12h-7z"
private val FULL_ICON = "M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.5 1.5 0 0 1 2.5-1.7L8 15"
private val PAY_ICON = "M12 7v10M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14.5"
private val EMOTE_ICON = "M4 5h16v11H9l-5 4Z"

/** A 24-unit SVG stroke icon (stroke 2, round caps and joins), drawn at [size]. */
@Composable
internal fun StrokeIcon(path: String, color: Color, size: Dp, stroke: Float = 2f, circle: Boolean = false, dots: Boolean = false) {
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


// ---- Combat line, arrows and the Casting panel (forge-table.mjs renderCombatLine, relations/drawArrows, paintOwnCast) ----

@Composable
private fun CombatLine(st: MatchState, mid: Dp, W: Dp, d: Du) = with(d) {
    val mode = when (st.inputType) { "InputAttack" -> "attack"; "InputBlock" -> "block"; else -> return@with }
    if (st.prompt != null) return@with
    val mine = st.me.battlefield
    val k = if (mode == "attack") mine.count { it.attacking } else mine.count { it.blockingIds.isNotEmpty() || it.blocking }
    val line = if (mode == "attack") Color(0xFFF2C46F) else Color(0xFF8FC4FF)
    val shown = remember(mode) { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(mode) { if (!Motion.still) shown.animateTo(1f, tween(360, easing = CubicBezierEasing(.2f, .8f, .2f, 1f))) }
    Row(Modifier.offset(y = mid - 1.dp).width(W).height(0.dp).wrapContentHeight(unbounded = true).graphicsLayer { alpha = shown.value; scaleX = .6f + .4f * shown.value },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.du)) {
        @Composable fun bar(reverse: Boolean) = Box(Modifier.weight(1f).height(3.du).drawBehind {
            drawIntoCanvas { c ->
                val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = line.copy(alpha = .5f).toArgb(); maskFilter = android.graphics.BlurMaskFilter(11.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                c.nativeCanvas.drawRect(size.width * (if (reverse) 0f else .3f), 0f, size.width * (if (reverse) .7f else 1f), size.height, p)
            }
        }.clip(RoundedCornerShape(2.dp)).background(Brush.horizontalGradient(if (reverse) listOf(line, line, Color.Transparent) else listOf(Color.Transparent, line, line), startX = 0f, endX = Float.POSITIVE_INFINITY)))
        bar(false)
        if (k > 0) {
            Row(Modifier.drawBehind { drawRoundRect(line.copy(alpha = .4f), topLeft = Offset(-4.du.toPx(), -4.du.toPx()), size = Size(size.width + 8.du.toPx(), size.height + 8.du.toPx()), cornerRadius = CornerRadius(size.height)) }
                .clip(RoundedCornerShape(999.dp)).background(Color(0xCC120E08)).border(1.dp, line.copy(alpha = .7f), RoundedCornerShape(999.dp)).padding(start = 11.du, end = 11.du, top = 3.du, bottom = 4.du),
                verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(5.du)) {
                Text("$k", style = sans(sp(14f), FontWeight.ExtraBold, if (mode == "attack") Color(0xFFFFF1CF) else Color(0xFFE6F1FF)))
            }
        } else bar(true)
    }
}

private data class Rel(val kind: String, val from: String, val to: String, val held: Boolean = false, val blocker: Int? = null, val attacker: Int? = null)

/** forge-table.mjs relations(): what the arrows join, as anchor keys ("c<id>" a card, "orb<id>" a player, "stackcard", "owncast"). */
private fun relations(st: MatchState): List<Rel> {
    val out = mutableListOf<Rel>()
    val board = st.players.flatMap { it.battlefield }
    val attackers = board.filter { it.attacking }
    for (a in attackers) {
        val defending = st.players.firstOrNull { it.id != a.controller }?.id
        val attackable = board.any { it.controller == defending && (it.type.contains("Planeswalker") || it.type.contains("Battle")) }
        val t = a.attackTarget
        val to = when {
            t?.kind == "card" && board.any { it.id == t.id } -> "c${t.id}"
            t?.kind == "player" && st.players.any { it.id == t.id } -> "orb${t.id}"
            !attackable && defending != null -> "orb$defending"
            else -> null
        } ?: continue
        val held = board.any { a.id in it.blockingIds } && a.keywords.none { it.contains("trample", true) }
        out += Rel("attack", "c${a.id}", to, held)
    }
    for (b in board.filter { it.blocking }) {
        val named = b.blockingIds.filter { id -> attackers.any { it.id == id } }
        val pair = named.ifEmpty { if (attackers.size == 1) listOf(attackers[0].id) else emptyList() }
        for (id in pair) out += Rel("block", "c${b.id}", "c$id", blocker = b.id, attacker = id)
    }
    if (st.inputType == "InputSelectTargets") {
        val named = Regex("targets? for ([^\n]+)", RegexOption.IGNORE_CASE).find(st.message)?.groupValues?.get(1)?.trim()
        val mine = st.players.flatMap { listOf(it.battlefield, it.hand) }.flatten().filter { it.controller == st.viewer }
        val source = st.stack.mapNotNull { it.source }.filter { it.controller == st.viewer && it.zone == "Stack" }.maxByOrNull { it.id }
            ?: named?.let { n -> mine.firstOrNull { it.zone == "Battlefield" && it.name == n } }
        val from = when { source != null && source.zone == "Battlefield" -> "c${source.id}"; pendingCast(st) != null -> "owncast"; else -> null }
        if (from != null) for (id in st.selection.chosenCards) out += Rel("target", from, "c$id")
        if (from != null) for (id in st.selection.chosenPlayers) out += Rel("target", from, "orb$id")
    } else st.stack.firstOrNull()?.let { top ->
        for (r in top.targets) {
            val to = if (r.kind == "card" && board.any { it.id == r.id }) "c${r.id}" else if (r.kind == "player" && st.players.any { it.id == r.id }) "orb${r.id}" else null
            if (to != null) out += Rel("target", "stackcard", to)
        }
    }
    return out
}

/** forge-table.mjs pendingCast: the card you just moved from hand to the stack, while its targets or mana are being chosen. */
internal fun pendingCast(st: MatchState): Card? {
    val input = st.inputType ?: ""
    if (!(input == "InputSelectTargets" || input.startsWith("InputPayMana") || st.prompt != null)) return null
    val last = HashMap<Int, GameEvent>()
    for (e in st.events) if (e.type == "zone" && e.card?.kind == "card") last[e.card.id] = e
    val ev = last.values.filter { it.to == "Stack" && it.from == "Hand" && (it.player == st.viewer || it.player == null) }.maxByOrNull { it.seq } ?: return null
    val id = ev.card!!.id
    if (st.stack.any { it.id == id || it.source?.id == id }) return null
    val all = st.players.flatMap { it.battlefield + it.hand + it.graveyard }
    if (all.any { it.id == id && it.zone != "Stack" }) return null
    return Card(id, "Stack", st.viewer, st.viewer, false, eventName(st, id), "", "", "", null, null, false, false, false, 0, false, false, emptyMap(), emptyList(), null, emptyList())
}
private fun eventName(st: MatchState, id: Int): String = st.events.lastOrNull { it.card?.id == id && it.card.name != null }?.card?.name ?: ""

@Composable
private fun Arrows(st: MatchState, live: Boolean, intents: TableIntents, d: Du) = with(d) {
    val anchors = LocalAnchors.current ?: return@with
    val rels = remember(st) { relations(st) }
    if (rels.isEmpty()) return@with
    val flowing = !Motion.still && rels.any { it.kind != "target" }
    val flow = if (flowing) rememberInfiniteTransition(label = "flow").animateFloat(0f, 13f, infiniteRepeatable(tween(1400, easing = LinearEasing)), label = "dash") else remember { mutableFloatStateOf(0f) }
    var self by remember { mutableStateOf(Offset.Zero) }
    val blocking = st.inputType == "InputBlock" && st.prompt == null
    val colors = mapOf("attack" to Color(0xFFFF6A4A), "block" to Color(0xFF6AAEFF), "target" to Color(0xFFF3D27E))
    val glows = mapOf("attack" to Color(0xAAFF5A3A), "block" to Color(0xAA5A9CFF), "target" to Color(0xAAF3D27E))
    // The x on your own block line takes that block back (forge-table.mjs unblock).
    val hits = remember { mutableStateListOf<Pair<Offset, Rel>>() }
    Canvas(Modifier.fillMaxSize().onGloballyPositioned { self = it.boundsInRoot().topLeft }
        .then(if (blocking && live) Modifier.pointerInput(rels) { detectTapGestures { p -> hits.firstOrNull { (at, _) -> (at - p).getDistance() < 18.du.toPx() }?.second?.let { r -> intents.unblock(r.blocker!!, r.attacker!!) } } } else Modifier)) {
        anchors.version.intValue
        val k = 1.du.toPx()
        val found = mutableListOf<Pair<Offset, Rel>>()
        for (r in rels) {
            val a = anchors.rects[r.from] ?: continue; val b = anchors.rects[r.to] ?: continue
            val ax = a.center.x - self.x; val ay = a.center.y - self.y; val bx = b.center.x - self.x; val by = b.center.y - self.y
            val len = kotlin.math.hypot(bx - ax, by - ay); if (len < 20 * k) continue
            val ux = (bx - ax) / len; val uy = (by - ay) / len
            val start = minOf(a.width, a.height) * .42f; val stop = minOf(b.width, b.height) * .48f + 4 * k
            val sx = ax + ux * start; val sy = ay + uy * start; val ex = bx - ux * stop; val ey = by - uy * stop
            val bend = minOf(60 * k, len * .16f); val cx = (sx + ex) / 2 - uy * bend; val cy = (sy + ey) / 2 + ux * bend
            val path = Path().apply { moveTo(sx, sy); quadraticTo(cx, cy, ex, ey) }
            val col = colors.getValue(r.kind)
            val heldLine = r.kind == "attack" && r.held
            val dash = when { r.kind == "target" -> null; Motion.still -> null; heldLine -> PathEffect.dashPathEffect(floatArrayOf(3 * k, 9 * k), 0f); else -> PathEffect.dashPathEffect(floatArrayOf(6 * k, 7 * k), -flow.value * k) }
            val w = (if (r.kind == "target") 2f else 2.5f) * k
            val alpha = if (heldLine) .22f else .9f
            if (!heldLine) drawIntoCanvas { c ->
                val gp = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = w + 2 * k; color = glows.getValue(r.kind).toArgb(); maskFilter = android.graphics.BlurMaskFilter(6 * k, android.graphics.BlurMaskFilter.Blur.NORMAL); pathEffect = dash?.let { android.graphics.DashPathEffect(if (r.kind == "attack" || r.kind == "block") floatArrayOf(6 * k, 7 * k) else floatArrayOf(1f, 0f), flow.value * k) } }
                c.nativeCanvas.drawPath(path.asAndroidPath(), gp)
            }
            drawPath(path, col.copy(alpha = alpha), style = Stroke(w, cap = StrokeCap.Round, pathEffect = dash))
            // Arrowhead (marker 10×10 at 4.5 × stroke, refX 7), along the curve's end tangent.
            if (r.kind != "target") {
                val tx = ex - cx; val ty = ey - cy; val tl = kotlin.math.hypot(tx, ty).coerceAtLeast(.001f); val dx = tx / tl; val dy = ty / tl
                val m = 4.5f * w / 10f
                val tipX = ex + dx * 3 * m; val tipY = ey + dy * 3 * m
                val head = Path().apply { moveTo(tipX, tipY); lineTo(tipX - dx * 10 * m - dy * 5 * m, tipY - dy * 10 * m + dx * 5 * m); lineTo(tipX - dx * 10 * m + dy * 5 * m, tipY - dy * 10 * m - dx * 5 * m); close() }
                drawPath(head, col.copy(alpha = alpha))
            }
            drawCircle(col.copy(alpha = alpha), radius = 3.5f * k, center = Offset(sx, sy))
            // The ring round the target (rx = min(14, w·0.18)).
            val rx = minOf(14 * k, b.width * .18f)
            drawRoundRect(col.copy(alpha = if (heldLine) .22f else 1f), topLeft = Offset(b.left - self.x - 4 * k, b.top - self.y - 4 * k), size = Size(b.width + 8 * k, b.height + 8 * k), cornerRadius = CornerRadius(rx), style = Stroke(2 * k))
            if (r.kind == "block" && blocking && st.card(r.blocker!!)?.controller == st.viewer) {
                val mx = (sx + 2 * cx + ex) / 4; val my = (sy + 2 * cy + ey) / 4
                drawCircle(Color(0xF014161D), radius = 11 * k, center = Offset(mx, my))
                drawCircle(Color(0xFFFF8A6A), radius = 11 * k, center = Offset(mx, my), style = Stroke(1.5f * k))
                drawLine(Color(0xFFFFF1EC), Offset(mx - 4 * k, my - 4 * k), Offset(mx + 4 * k, my + 4 * k), 2 * k, StrokeCap.Round)
                drawLine(Color(0xFFFFF1EC), Offset(mx + 4 * k, my - 4 * k), Offset(mx - 4 * k, my + 4 * k), 2 * k, StrokeCap.Round)
                found += Offset(mx, my) to r
            }
        }
        if (found.map { it.first } != hits.map { it.first }) { hits.clear(); hits.addAll(found) }
    }
}

/** .forge-own-cast on a phone (max-height 520): the card you are casting, top left, while you pick its targets or pay. */
@Composable
private fun OwnCast(st: MatchState, d: Du) = with(d) {
    val c = pendingCast(st) ?: return@with
    val anchors = LocalAnchors.current
    val name = c.name.ifEmpty { Regex("targets? for ([^\n]+)", RegexOption.IGNORE_CASE).find(st.message)?.groupValues?.get(1)?.trim() ?: "" }
    Column(Modifier.offset(x = 8.du, y = 58.du).width(76.du)
        .drawBehind { drawRoundRect(Color(0x55F0C27A), topLeft = Offset(-6.du.toPx(), -6.du.toPx()), size = Size(size.width + 12.du.toPx(), size.height + 12.du.toPx()), cornerRadius = CornerRadius(18.du.toPx())) }
        .clip(RoundedCornerShape(12.du)).background(Color(0xF5111622)).border(1.dp, Color(0xAAF0C27A), RoundedCornerShape(12.du)).padding(4.du),
        verticalArrangement = Arrangement.spacedBy(3.du)) {
        Box(Modifier.fillMaxWidth().aspectRatio(488f / 680f).heightIn(max = 150.du).clip(RoundedCornerShape(8.du)).background(Color(0xFF141418))
            .then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("owncast", it.boundsInRoot()) } else Modifier)) {
            if (name.isNotEmpty()) CardImage(name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Text("CASTING", style = sans(sp(11f), FontWeight.Bold, Color(0xFFF0C27A)).copy(letterSpacing = 0.05.em))
        Text(name, style = sans(sp(12f), FontWeight.Bold, Color(0xFFFBF3DF)), maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}


/** native-panel.mjs: the one line that says what the table is asking (the .forge-ask-line above your hand), or null. */
internal fun askLine(st: MatchState): String? {
    if (st.prompt != null) return null
    val input = st.inputType ?: ""
    val discard = st.selection.cards.isNotEmpty() && Regex("\\bdiscard\\b", RegexOption.IGNORE_CASE).containsMatchIn(st.message)
    val picks = st.selection.cards.size + st.selection.targetCards.size + st.selection.players.size + st.selection.stackTargets.size
    val asking = picks > 0 && input !in setOf("InputPassPriority", "InputAttack", "InputBlock", "InputConfirmMulligan", "InputLockUI") && !input.startsWith("InputPayMana") && !discard
    if (asking) {
        val first = st.message.lines().firstOrNull { !Regex("^(Priority|Turn|Phase|Stack):").containsMatchIn(it) } ?: ""
        var ask = first.replace(Regex("Forge AI(?:\\s+—[^·\\n]*·?)?"), "CPU").replace(Regex("\\s*\\[Phase: [^\\]]*\\]"), "").trim()
        if (Regex("legend(ary)? rule|same name|choose .* to keep|keep one", RegexOption.IGNORE_CASE).containsMatchIn(ask)) ask = "Two legendary permanents share a name. Choose the one to keep."
        val named = Regex("^(.{2,60}?) - (.+)$").find(ask)
        // Forge picks stack items through two inputs; "Select target noncreature spell" becomes "Choose a noncreature spell on the stack".
        val stackOnly = st.selection.stackTargets.isNotEmpty() && st.selection.targetCards.isEmpty() && st.selection.players.none { it in st.selection.targetPlayers }
        when {
            (input == "InputSelectTargets" || input == "InputSelectStackItems") && stackOnly -> {
                val src = named?.groupValues?.get(2) ?: ask
                val what = Regex("\\btarget ([a-z -]{3,40}?(?:spell|ability)(?: or ability)?)\\b", RegexOption.IGNORE_CASE).find(src)?.groupValues?.get(1)
                ask = if (Regex("\\bcounter target\\b", RegexOption.IGNORE_CASE).containsMatchIn(src)) "Choose a spell to counter"
                    else if (what != null) "Choose a${if (Regex("^[aeiou]", RegexOption.IGNORE_CASE).containsMatchIn(what)) "n" else ""} ${what.lowercase()} on the stack" else "Choose a spell or ability on the stack"
            }
            input == "InputSelectTargets" && named != null -> ask = "Choose a target for ${named.groupValues[1]}"
            named != null -> ask = named.groupValues[2]
        }
        if (ask.isEmpty()) ask = if (input == "InputSelectTargets") "Choose a target" else "Choose a card on the table"
        ask = if (oneTarget(st)) ask.replace(Regex("^(Select|Choose) (a )?targets? for", RegexOption.IGNORE_CASE), "Tap a target for") else ask.replace(Regex("^Select\\b"), "Choose")
        return ask
    }
    // A payment your mana can't finish says so above the hand; Cancel is the way out.
    Affordability.paying(st)?.takeIf { it.short }?.let { return "Not enough mana" + (it.name?.let { n -> " for $n" } ?: "") }
    if (discard) return null
    val top = st.stack.firstOrNull()
    val cpuTop = top != null && top.controller != st.viewer
    val topName = (top?.source?.name ?: top?.text?.split(Regex("\\s+[\\u2014-]\\s+"))?.firstOrNull() ?: "").replace(Regex("\\s*\\(\\d+\\)"), "").trim()
    return when {
        input == "InputBlock" -> "Block the CPU’s attack?"
        input == "InputPassPriority" && cpuTop && topName.isNotEmpty() && st.priorityPlayer == st.viewer -> "Respond to $topName?"
        else -> null
    }
}

/** A required single target commits on the tap (Arena): no Confirm then; an optional one offers "No target". */
internal fun oneTarget(st: MatchState): Boolean = st.prompt == null && st.inputType == "InputSelectTargets" && st.selection.max == 1 && st.selection.chosenCards.isEmpty() && st.selection.chosenPlayers.isEmpty()

/** .forge-ask-line on a phone: centred 30 du right of the middle, its bottom 4 du above your hand. */
@Composable
private fun AskLine(text: String, W: Dp, H: Dp, d: Du) = with(d) {
    Box(Modifier.fillMaxWidth().offset(x = 30.du, y = H - 64.du).wrapContentHeight(unbounded = true, align = Alignment.Bottom), contentAlignment = Alignment.BottomCenter) {
        Box(Modifier.widthIn(max = W - 444.du).drawBehind {
            drawIntoCanvas { c ->
                val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = Color(0x40F2D18E).toArgb(); maskFilter = android.graphics.BlurMaskFilter(11.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                c.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, size.height / 2, size.height / 2, p)
            }
            drawRoundRect(Color(0xBB000000), topLeft = Offset(0f, 10.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2))
        }.clip(RoundedCornerShape(999.dp)).background(Color(0xF010131B))
            .background(Brush.linearGradient(listOf(Color(0x14FFFFFF), Color(0x03FFFFFF), Color.Transparent)))
            .border(1.dp, Color(0xAAF2D18E), RoundedCornerShape(999.dp)).padding(horizontal = 16.du, vertical = 8.du)) {
            Text(text, style = sans(sp(14f), FontWeight.Bold, Color(0xFFFBF3DF)), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}


// ---- The tile's decoration layer (play-board-badges.js tileLayerHtml, play-forge-table.css .cs-*) ----

private val BadgeEdge = Color(0xB8D6AD64)
private val BadgeInk = Color(0xFFF2D496)

@Composable
private fun TileLayer(card: Card, actionable: Boolean, lookup: (Int) -> Card?, d: Du, h: Dp, statFont: Float, top: Dp? = null) = with(d) {
    val b = remember(card, actionable) { TileBadges.of(card, actionable) } ?: return@with
    val bsz = 9.du
    // .cs-badge: a dark pill with a gold hairline; an icon (72%) and a white number.
    @Composable fun badge(icon: String?, edge: Color = BadgeEdge, ink: Color = BadgeInk, fill: Color = Color(0xEB101114), glow: Color? = null, text: String? = null, dashed: Boolean = false) {
        Row(Modifier.heightIn(min = bsz).widthIn(min = bsz)
            .drawBehind { glow?.let { g -> drawIntoCanvas { c -> val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = g.toArgb(); maskFilter = android.graphics.BlurMaskFilter(4.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }; c.nativeCanvas.drawRoundRect(0f, 0f, this.size.width, this.size.height, this.size.height / 2, this.size.height / 2, p) } }
                drawRoundRect(Color(0xCC000000), topLeft = Offset(0f, 1.du.toPx()), size = this.size, cornerRadius = CornerRadius(this.size.height / 2)) }
            .clip(RoundedCornerShape(999.dp)).background(fill)
            .drawWithContent { drawContent(); drawRoundRect(edge, cornerRadius = CornerRadius(bsz.toPx() / 2), style = Stroke(1.dp.toPx(), pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(2f, 2f)) else null)) }
            .padding(horizontal = (bsz.value * .12f).dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(1.du, Alignment.CenterHorizontally)) {
            if (icon != null) BoardIcon(icon, ink, bsz * .72f)
            if (text != null) Text(text, style = sans(sp(6.8f), FontWeight.Bold, Color.White).copy(lineHeight = sp(6.8f)))
        }
    }
    Box(Modifier.fillMaxSize()) {
        val rail: @Composable () -> Unit = {
            b.keywords.forEach { badge(it.key) }
            if (b.keywordsMore > 0) badge(null, ink = Color.White, text = "+${b.keywordsMore}", dashed = true)
        }
        val top = top ?: 14.du
        if (b.state.isNotEmpty() || b.activation || (b.compact && (b.keywords.isNotEmpty() || b.keywordsMore > 0)))
            Row(Modifier.offset(x = 3.du, y = top), horizontalArrangement = Arrangement.spacedBy(1.du)) {
                b.state.forEach { badge(it) }
                if (b.activation) badge("activated-ability", edge = Color(0xFF7FD6F0), ink = Color(0xFF9BE6FF), glow = Color(0x805CC8F0))
                if (b.compact) rail()
            }
        b.combat?.let { cb ->
            Box(Modifier.align(Alignment.TopCenter).offset(y = 13.du)) {
                if (cb == "attacking") badge("attacking", edge = Color(0xFFFF9D5C), ink = Color(0xFFFFB27A), glow = Color(0x99FF8A3D))
                else badge("blocking", edge = Color(0xFF7FB8FF), ink = Color(0xFFA8CEFF), glow = Color(0x995A9CFF))
            }
        }
        val cornerShown = b.state.isNotEmpty() || b.activation
        if (!b.compact && (b.keywords.isNotEmpty() || b.keywordsMore > 0))
            Column(Modifier.offset(x = 3.du, y = if (cornerShown) top + bsz + 3.du else top), verticalArrangement = Arrangement.spacedBy(1.du)) { rail() }
        // fitRails(): when the counters column would run into the stats plaque, it becomes a row (row-reverse) sitting 3px above the plaque.
        val railN = b.counters.size + (if (b.countersMore > 0) 1 else 0) + (if (b.damage > 0) 1 else 0)
        val floor = if (statFont > 0f) 2.du + (statFont * 1.25f + 4f).du else 0.du
        val railRow = statFont > 0f && top + bsz * railN + 2.du * (railN - 1) + 3.du > h - floor - 2.du
        @Composable fun railBox(content: @Composable () -> Unit) = if (railRow)
            Row(Modifier.align(Alignment.BottomEnd).offset(x = (-3).du, y = -(floor + 3.du)), horizontalArrangement = Arrangement.spacedBy(1.du, Alignment.End), verticalAlignment = Alignment.CenterVertically) { content() }
        else Column(Modifier.align(Alignment.TopEnd).offset(x = (-3).du, y = top), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.du)) { content() }
        if (railN > 0)
            railBox {
                b.counters.forEach { c ->
                    val (edge, ink) = when (c.name) {
                        "P1P1" -> Color(0xFF5FD08A) to Color(0xFF8FF0B0); "M1M1" -> Color(0xFFEF6B5E) to Color(0xFFFF9A8F); "SHIELD" -> Color(0xFF6FD8F0) to Color(0xFFA6ECFF)
                        "STUN" -> Color(0xFFF0C35A) to Color(0xFFFFD98A); "FINALITY" -> Color(0xFFB0A4C8) to Color(0xFFD8CFF0); else -> BadgeEdge to BadgeInk
                    }
                    if (c.icon != null) badge(c.icon, edge = edge, ink = ink, text = "${c.count}") else badge(null, text = "${c.count} ${c.label.take(4)}")
                }
                if (b.countersMore > 0) badge(null, ink = Color.White, text = "+${b.countersMore}", dashed = true)
                if (b.damage > 0) badge("marked-damage", edge = Color(0xFFFF8A7D), ink = Color.White, fill = Color(0xF2A8322A), text = "${b.damage}")
            }
        b.plaque?.let { (kind, value) ->
            Row(Modifier.align(Alignment.BottomEnd).offset(x = (-4).du, y = (-4).du).clip(RoundedCornerShape(5.du)).background(Color(0xF2111114)).border(1.dp, Color(0xC0D6AD64), RoundedCornerShape(5.du))
                .padding(start = 3.du, end = 5.du, top = 1.du, bottom = 1.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.du)) {
                BoardIcon(if (kind == "loyalty") "loyalty" else "defense", BadgeInk, bsz * .8f)
                Text("$value", style = sans(sp(9f), FontWeight.Bold, Color.White))
            }
        }
        b.crew?.let { crew ->
            Row(Modifier.align(Alignment.BottomStart).offset(x = 3.du, y = (-4).du).clip(RoundedCornerShape(999.dp)).background(Color(0xEB101114)).border(1.dp, BadgeEdge, RoundedCornerShape(999.dp))
                .padding(start = 2.du, end = 4.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(1.du)) {
                BoardIcon("vehicle-crew", BadgeInk, bsz * .7f); Text("$crew", style = sans(sp(6.5f), FontWeight.Bold, Color.White))
            }
        }
        val attached = card.attachments.mapNotNull(lookup).filter { !it.hidden }
        if (attached.isNotEmpty() && b.crew == null) {
            fun kind(c: Card) = if (Regex("\\bEquipment\\b").containsMatchIn(c.type)) "equipment" else if (Regex("\\bAura\\b").containsMatchIn(c.type)) "aura" else "attached"
            val kinds = listOf("equipment", "aura", "attached").map { k -> k to attached.count { kind(it) == k } }.filter { it.second > 0 }
            Row(Modifier.align(Alignment.BottomStart).offset(x = 3.du, y = (-4).du), horizontalArrangement = Arrangement.spacedBy(1.du)) {
                kinds.forEach { (k, n) -> badge(k, text = if (n > 1) "$n" else null) }
            }
        }
        // .cs-damage-marks: three claw strokes over the art (viewBox 60 × 40, #ff6b5e, opacity .85 × .75).
        if (b.damage > 0) Canvas(Modifier.fillMaxSize().padding(horizontal = 11.du, vertical = 11.du)) {
            val sx = size.width / 60f; val sy = size.height / 40f; val k = minOf(sx, sy)
            val ox = (size.width - 60 * k) / 2; val oy = (size.height - 40 * k) / 2
            for (pts in listOf(listOf(14f to 4f, 8f to 18f, 16f to 24f, 10f to 38f), listOf(30f to 2f, 24f to 18f, 32f to 24f, 26f to 38f), listOf(46f to 4f, 40f to 18f, 48f to 24f, 42f to 38f))) {
                val path = Path().apply { pts.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(ox + x * k, oy + y * k) else lineTo(ox + x * k, oy + y * k) } }
                drawPath(path, Color(0xFFFF6B5E).copy(alpha = .64f), style = Stroke(3 * k, cap = StrokeCap.Round))
            }
        }
    }
}
