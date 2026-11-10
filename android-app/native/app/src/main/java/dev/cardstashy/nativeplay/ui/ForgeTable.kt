package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.draw.drawWithContent
import androidx.compose.runtime.SideEffect
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
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.IntSize
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import kotlin.math.roundToInt
import androidx.compose.foundation.focusable
import androidx.compose.foundation.focusGroup
import androidx.compose.ui.focus.focusProperties
import androidx.compose.foundation.indication
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.onKeyEvent
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
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectDragGestures
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
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.runtime.mutableIntStateOf
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.boundsInParent
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
    /** forge-table.mjs dropCombat: this blocker blocks that attacker (blocker, attacker). */
    val block: (Int, Int) -> Unit = { _, _ -> },
    val stop: (String) -> Unit = {}, val mode: (String) -> Unit = {}, val autoPay: (Boolean) -> Unit = {}, val yieldSource: (Int, Boolean) -> Unit = { _, _ -> },
    /** nativeSelect('stack', id): a spell or ability on the stack picked as a target. */
    val stack: (Int) -> Unit = {},
    /** A short line over the table (the controller's note), e.g. why a creature can't block. */
    val note: (String) -> Unit = {},
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
/** W10: your main phase 1, an empty stack, and none of your creatures can attack (all tapped or summoning sick): Forge's cancel is End turn. */
internal fun noAttackersLeft(st: MatchState): Boolean = st.inputType == "InputPassPriority" && st.phase == "MAIN1" && st.activePlayer == st.viewer && st.stack.isEmpty() &&
    st.buttons.cancelEnabled && st.buttons.cancel?.trim().equals("end turn", true) &&
    st.me.battlefield.none { it.isCreature && !it.tapped && !(it.summoningSick && it.keywords.none { k -> Regex("haste", RegexOption.IGNORE_CASE).containsMatchIn(k) }) }
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
/** glow-rules.md: the usable ring (dashed) and the payment light (soft fill). */
private val UsableViolet = Color(0xFFB79CFF)
private val PayGold = Color(0xFFFFD98A)
private val Ember = Color(0xFFFF9A7A)
private val Sky = Color(0xFF8FDCFF)
private val CpuRed = Color(0xFFE0533F)
private val StopOrange = Color(0xFFFF8A3D)

internal fun sans(size: TextUnit, weight: FontWeight = FontWeight.Bold, color: Color = Color(0xFFEEE6D4)) =
    TextStyle(fontFamily = Type.Sans, fontWeight = weight, fontSize = size, color = color)

/** One design unit as Dp: the site's CSS px at 844 × 390, scaled to fit. */
internal val LocalAttackInput = androidx.compose.runtime.staticCompositionLocalOf { false }
/** The CPU's attackers numbered in attack order while you block (Table spec, 5 Nov: name each attacker before you drag). */
internal val LocalAttackNumbers = androidx.compose.runtime.compositionLocalOf { emptyMap<Int, Int>() }

/** A blocker on its way to an attacker (forge-table.mjs combat drag): where the finger is and the attacker it would land on. */
internal class BlockDrag {
    var from by mutableStateOf<Int?>(null)
    var at by mutableStateOf(Offset.Zero)
    var over by mutableStateOf<Int?>(null)
    /** Your creatures that can be dragged onto an attacker now, and what a drop does. */
    var blockers: Set<Int> = emptySet()
    var attackers: List<Int> = emptyList()
    var drop: (Int, Int) -> Unit = { _, _ -> }
}
internal val LocalBlockDrag = androidx.compose.runtime.compositionLocalOf<BlockDrag?> { null }

/** Forge still judges every block; this only tells which attacker a creature could plausibly meet (a flyer needs flying or reach). */
internal fun mayBlock(attacker: Card, blocker: Card): Boolean {
    fun has(c: Card, k: String) = c.keywords.any { it.equals(k, true) || it.startsWith("$k ", true) }
    return !has(attacker, "Flying") || has(blocker, "Flying") || has(blocker, "Reach")
}

/**
 * Why a block can't be made, read from the cards themselves (Randall 6 Nov: block mistakes say why, as attacks do). Forge still
 * judges every block; this only words the refusal. Null when the cards show no reason. [attacker] null: the blocker alone.
 */
internal fun blockRefusal(attacker: Card?, blocker: Card): String? {
    fun has(c: Card, k: String) = c.keywords.any { it.equals(k, true) || it.startsWith("$k ", true) }
    fun says(c: Card, what: String) = Regex("(?im)^(?:this creature|this card|CARDNAME|${Regex.escape(c.name)}) $what\\.?$").containsMatchIn(c.text.replace('\u2019', '\''))
        || c.keywords.any { Regex("(?i)^(?:this creature|CARDNAME) $what\\.?$").matches(it.replace('\u2019', '\'')) }
    return when {
        blocker.tapped -> "${blocker.name} is tapped, so it can’t block."
        says(blocker, "can't block") -> "${blocker.name} can’t block."
        attacker == null -> null
        says(attacker, "can't be blocked") -> "${attacker.name} can’t be blocked."
        has(attacker, "Flying") && !has(blocker, "Flying") && !has(blocker, "Reach") -> "${attacker.name} has flying. Only a creature with flying or reach can block it."
        else -> null
    }
}

/** The site's touch layout for a big board (min-width 600, min-height 480). */
internal fun bigBoard(w: Dp, h: Dp) = w >= 600.dp && h >= 480.dp
/** Controls keep their CSS px on a big board; a phone scales the 844 × 390 design to fit. */
internal fun chromeU(w: Dp, h: Dp) = if (bigBoard(w, h)) 1f else minOf(w.value / 844f, h.value / 390f)

/** A seat's commander for its portrait's inspect, always named as that seat's card (CardInspect reads "CPU" or "You" from its controller). */
internal fun commanderOf(p: Player): Card? = p.command.firstOrNull()?.let { if (it.controller < 0) it.copy(controller = p.id) else it }

/** Records this element's box in root space under [key] when a table [Anchors] is provided (tests read the boxes to prove nothing overlaps). */
@Composable
internal fun Modifier.anchorRect(key: String): Modifier {
    val a = LocalAnchors.current ?: return this
    return this.onGloballyPositioned { a.putRect(key, it.boundsInRoot()) }
}

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
    modifier: Modifier = Modifier, menu: MatchMenu? = null, afk: String? = null, overlay: @Composable (Dp.() -> Unit)? = null,
) {
    // Living Battlefield: effects read from each new snapshot; a touch anywhere skips them to their end.
    // One per board; a caller's own (a frame-by-frame test) wins, so card moves and the shake follow it too.
    val outer = LocalBattlefield.current
    val fx = outer ?: remember { Battlefield() }
    FxDriver(fx, st)
    androidx.compose.runtime.CompositionLocalProvider(LocalBattlefield provides fx) {
    BoxWithConstraints(modifier.fillMaxSize().fxSkip(fx).graphicsLayer { fx.shake(this) }
        // Live 0.4.56 on the Thor: Android's own default focus (leaving touch mode, a cleared ring) comes in from the top as a Down
        // search and landed on the menu button, so A opened the menu. On two screens with a controller it goes to the hand instead.
        .focusProperties { onEnter = {
            if (requestedFocusDirection == androidx.compose.ui.focus.FocusDirection.Down && DualScreen.active && Pad.connected.value)
                TableZones.hand?.let { h -> TablePad.autoRing = true; val ok = h.requestFocus(androidx.compose.ui.focus.FocusDirection.Enter); TablePad.autoRing = false
                    android.util.Log.i("PadA", "board entered from the top: ring to the hand chip ok=$ok") }
        } }
        .focusGroup()) {
        val d = Du(chromeU(maxWidth, maxHeight))
        with(d) {
            val W = maxWidth; val H = maxHeight
            val me = st.me
            // A Commander pod shows one opponent at a time (PodFocus); a duel its only opponent.
            val podFocus = remember { PodFocus() }
            var picks by remember { mutableStateOf(0) }
            val pod = st.players.size > 2
            val cpu = remember(st, picks) { podFocus.of(st, null) }
            // forge-table.mjs role(): chosen, then a target, then a choice (discard while a discard asks), then playable.
            // W12: the cleanup discard never lifts a card by itself; selectedHand is the card he picked (A or a tap), and only that is discarded.
            val discardAsk = dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) != null
            // The d-pad's walk along the hand while a discard asks: it shows a card's words and name but picks nothing.
            var discardWalk by remember { mutableStateOf<Int?>(null) }
            // W12: a card lifted before cleanup never carries into the discard; he picks again.
            LaunchedEffect(discardAsk) { if (!discardAsk) discardWalk = null else onSelectHand(null) }
            // forge-table.mjs: a card you can't pay for leaves the playable set and says why ("Not enough mana").
            val shortCasts = remember { ShortCasts() }
            val blocked = remember(st) { shortCasts.blocked(st) }
            val quiet = remember(st, blocked) { shortCasts.quiet(st, blocked) }
            // Blocking by tap, either order (Table spec, 5 Nov): a creature you tap first waits for the attacker you tap next;
            // an attacker you tap first waits for your creature. One attacker, or one it could meet, pairs at once.
            val blockingNow = live && st.inputType == "InputBlock" && st.prompt == null
            var blockPick by remember { mutableStateOf<Int?>(null) }
            var attackFocus by remember { mutableStateOf<Int?>(null) }
            LaunchedEffect(blockingNow) { if (!blockingNow) { blockPick = null; attackFocus = null } }
            val attackersNow = if (blockingNow) attackOrder(st).mapNotNull { st.card(it) } else emptyList()
            val blockDrag = remember { BlockDrag() }
            fun myBlocker(card: Card) = blockingNow && card.controller == st.viewer && card.zone == "Battlefield" && card.isCreature && !card.attacking &&
                (card.blocking || card.id in st.selection.cards || card.id in st.selection.actionable || (!card.tapped && st.selection.cards.isEmpty() && st.selection.actionable.isEmpty()))
            blockDrag.blockers = if (blockingNow) me.battlefield.filter { myBlocker(it) && !it.blocking }.map { it.id }.toSet() else emptySet()
            blockDrag.attackers = attackersNow.map { it.id }
            blockDrag.drop = { b, a -> blockPick = null; attackFocus = null; intents.block(b, a) }
            // glow-rules.md: the one light each card wears (Glow.mark: chosen, target, pick, then playable / usable / nothing).
            fun markOf(card: Card): Mark = Glow.mark(card, st, live, blocked, quiet, selectedHand, blockPick,
                aimed = blockingNow && card.attacking && card.controller != st.viewer && (card.id == attackFocus || card.id == blockDrag.over ||
                    (blockPick ?: blockDrag.from)?.let { b -> st.card(b)?.let { mayBlock(card, it) } } == true))
            // Rule 7 / I4: a hand card the bridge's pay plan dims says why when lifted. One that costs life or a sacrifice stays lit
            // and shows that cost when lifted; the gold button, A or a slide up then casts it.
            fun costly(card: Card) = Glow.costly(st, live, card, blocked, quiet)
            fun dimWhy(card: Card): String? = if (!live) null else blocked[card.id]
                ?: card.id.takeIf { card.zone == "Hand" && card.id in st.selection.actionable && !Glow.asking(st) && (Glow.planSaysNo(st, it) || costly(card)) }?.let { Glow.costOf(st, it) }
            // A costly card is lit but asks first: a drag or A from rest lifts it (its cost shows), the next one casts.
            fun castable(card: Card) = markOf(card) == Mark.PLAYABLE && (!costly(card) || card.id == selectedHand)
            // The hand card being dragged or under the finger or the controller's ring (HandFan reports it): its payment sources light.
            var carried by remember { mutableStateOf<Int?>(null) }
            // A card lifted by a tap is carried too, from the first frame. On two screens a lift outlives the ring (TableScreen keeps it),
            // so there it counts only while it is fresh or the hand chip holds the ring; the ring leaving the hand puts it down.
            var liftLive by remember { mutableStateOf(true) }
            LaunchedEffect(selectedHand) { liftLive = selectedHand != null }
            val carriedId = (carried ?: selectedHand?.takeIf { liftLive })?.takeIf { id -> me.hand.any { it.id == id } }
            val payLight = carriedId?.let { id -> me.hand.firstOrNull { it.id == id } }?.let { Glow.payment(st, live, it, blocked, quiet) } ?: emptySet()
            fun blockTap(card: Card): (() -> Unit)? = when {
                card.attacking && card.controller != st.viewer -> ({
                    val b = blockPick
                    if (b != null) { blockPick = null; intents.block(b, card.id) } else attackFocus = if (attackFocus == card.id) null else card.id
                })
                // Your creature that can't block says why (it is tapped, or it can't block at all).
                !myBlocker(card) -> if (card.controller == st.viewer && card.zone == "Battlefield" && card.isCreature && !card.attacking) blockRefusal(null, card)?.let { why -> { intents.note(why) } } else null
                // Your creature already blocking: a tap takes that block back (forge-table.mjs unblock).
                card.blocking -> ({ (card.blockingIds.firstOrNull() ?: attackersNow.singleOrNull()?.id)?.let { intents.unblock(card.id, it) } ?: intents.card(card.id) })
                else -> ({
                    val focus = attackFocus?.takeIf { f -> attackersNow.any { it.id == f } }
                    val fit = attackersNow.filter { mayBlock(it, card) }
                    when {
                        focus != null -> { attackFocus = null; intents.block(card.id, focus) }
                        attackersNow.size == 1 -> intents.block(card.id, attackersNow[0].id)
                        fit.size == 1 -> intents.block(card.id, fit[0].id)
                        else -> blockPick = if (blockPick == card.id) null else card.id
                    }
                })
            }
            fun tapOf(card: Card): (() -> Unit)? = if (blockingNow) blockTap(card) else if (live && (card.id in st.selection.cards || card.id in st.selection.targetCards || (card.id in st.selection.actionable && card.id !in blocked) || card.id in st.selection.chosenCards ||
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
            // The mat's ambient light: turn warmth, the priority edge light and combat grain, under every card.
            FxMat(st, mid)
            // Nothing of the turn clock lies on the divider (table additions 5): it is a ring on the gold button and a line under the phase track.

            // CPU half: lands at the back, creatures at the front; yours mirrored.
            // A creature Forge says must attack this combat wears a tag until it is in the attack.
            androidx.compose.runtime.CompositionLocalProvider(LocalAttackInput provides (live && st.inputType == "InputAttack"),
                LocalPayLight provides payLight, LocalHandCarry provides payLight.isNotEmpty(), LocalPayInput provides (live && Glow.paying(st)),
                LocalAttackNumbers provides (if (blockingNow && attackersNow.size > 1) attackersNow.withIndex().associate { (i, c) -> c.id to i + 1 } else emptyMap()),
                LocalBlockDrag provides (if (blockingNow) blockDrag else null)) {
                // The stack keeps its own lane (fix list B6): while anything is on it the rows end left of the fan (it starts 214 du
                // from the right edge) instead of running under it; they shrink to fit as they do on a crowded board.
                val lane by androidx.compose.animation.core.animateDpAsState(if (st.stack.isNotEmpty()) 132.du else 0.dp, tween(if (Motion.still) 0 else 220), label = "stackLane")
                val rowX = centreX - lane / 2
                if (piece != null) {
                    // Rows on a big board: the CPU's creatures end 34 above the divider, its other lane 32 above them; yours start 26 below, the other lane 19 under.
                    val ch = piece * .9f; val oh = piece * .68f; val room = W - 192.dp - lane
                    PermanentRow(backRow(cpu.battlefield), true, lands(cpu.battlefield).size, rowX, mid - 34.dp - ch - 32.dp - oh / 2, room, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) }, piece = piece)
                    PermanentRow(others(cpu.battlefield), false, 0, rowX, mid - 34.dp - ch / 2, room, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) }, piece = piece)
                    PermanentRow(others(me.battlefield), false, 0, rowX, mid + 26.dp + ch / 2, room, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) }, piece = piece)
                    PermanentRow(backRow(me.battlefield), true, lands(me.battlefield).size, rowX, mid + 26.dp + ch + 19.dp + oh / 2, room, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) }, piece = piece)
                } else {
                    PermanentRow(backRow(cpu.battlefield), true, lands(cpu.battlefield).size, rowX, mid - 77.5f.du * stretch, W - 180.du - lane, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) })
                    PermanentRow(others(cpu.battlefield), false, 0, rowX, mid - 34.du * stretch, W - 180.du - lane, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) })
                    PermanentRow(others(me.battlefield), false, 0, rowX, mid + 27.du * stretch, W - 180.du - lane, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) })
                    // Your back row also ends left of your piles, which stand left of the stack while it is up.
                    PermanentRow(backRow(me.battlefield), true, lands(me.battlefield).size, rowX - lane * (24f / 132f), mid + 71.5f.du * stretch, minOf(W - 300.du, W - 180.du - lane * (180f / 132f)), d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) })
                }
            }

            // Piles: yours right of your back row, the CPU's left of its back row.
            // While the side dock asks (it sits bottom right, 168 du wide), your piles slide left of it so their cards and counts stay in view.
            val docked = live && st.failure == null && !st.finished && st.prompt?.let { p -> p.method != "order" && !p.method.startsWith("assign") && p.options.none { it.zone in setOf("Library", "Graveyard", "Exile") } } == true
            val pilesX by androidx.compose.animation.core.animateDpAsState(if (docked || st.stack.isNotEmpty()) W - 262.du else W - 120.du, tween(if (Motion.still) 0 else 220), label = "pilesX")
            Piles(me, mine = true, Modifier.offset(x = pilesX, y = if (large) mid + 60.dp else mid + 46.du * stretch), d, onInspect,
                playable = { markOf(it) == Mark.PLAYABLE }) { intents.card(it.id) }
            if (!pod) Piles(cpu, mine = false, Modifier.offset(x = 44.du, y = if (large) mid - 120.dp else mid - 104.du * stretch), d, onInspect)

            // The CPU's hand, tucked off the top edge: the lower half of each back.
            // In a pod the rail takes the opponent hand's place (each chip shows its own hand size).
            if (pod) PodRail(st, cpu.id, live, intents, { podFocus.seat = it; picks++ }, W, d)
            else TuckedHand(cpu.handCount, Modifier.offset(y = (-17).du).align(Alignment.TopCenter).then(LocalAnchors.current?.let { a -> Modifier.onGloballyPositioned { a.putRect("cpuhand", it.boundsInRoot()) } } ?: Modifier), d)

            // Seats: the CPU top right, you bottom left; command-zone crests beside them.
            // A big board moves the seats 4 px in and the bottom-left group 14 px up (site probes at 960 × 840 and 1280 × 800).
            val lx = if (large) 4.dp else 0.dp; val ly = if (large) 14.dp else 0.dp
            // Seat dock (Randall 4 Nov, design/seat-dock/spec.md): your corner is crest, portrait, then a tray: one row of 34 du
            // round tools (stops, hold, [auto-pay], chat; pitch 42) and under it the floating mana. Nothing overlaps.
            // The CPU's corner is the same dock turned half a circle: crest outermost at the right edge, portrait inside it.
            // Library and graveyard stay the calm-v2 card piles with their counts, so the dock carries no count pill.
            val ax = 80.du + lx; val ay = H - 78.du - ly; val x0 = ax + 52.du + 14.du
            if (!pod) Crest(cpu.command.firstOrNull(), Modifier.offset(x = W - 68.du - lx, y = 16.du + lx), d, onInspect)
            if (!pod) Medallion(cpu, mine = false, live && cpu.id in st.selection.players, cpu.id in st.selection.chosenPlayers, Modifier.offset(x = W - 132.du - lx, y = 26.du + lx).anchorRect("cpuseat"), d,
                onOpen = commanderOf(cpu)?.let { c -> { onInspect(c) } }) { intents.player(cpu.id) }
            if (!pod) ThinkDots(Modifier.offset(x = W - 132.du - lx - 34.du, y = 26.du + lx + 20.du), d)
            // Rule 2: your commander wears the playable ring while Forge offers it and you can pay; a tap casts it (long press opens it).
            Crest(me.command.firstOrNull(), Modifier.offset(x = 10.du + lx, y = H - 86.du - ly), d, onInspect,
                playable = me.command.firstOrNull()?.let { markOf(it) == Mark.PLAYABLE } == true) { intents.card(it.id) }
            Medallion(me, mine = true, live && me.id in st.selection.players, me.id in st.selection.chosenPlayers, Modifier.offset(x = ax, y = ay), d) { intents.player(me.id) }
            // Table additions 6: while you declare blocks, what gets through, above your seat. Gone the moment blocks are confirmed.
            if (blockingNow) damageThrough(st)?.let { t -> ThroughChip(t, me.life, Modifier.offset(x = ax, y = ay - 50.du), d) }
            // A phone's hand starts close to the seat: when the full tool row would reach it, chat drops to the second row
            // beside the mana, so the tray still never touches the hand.
            val tools = (if (st.controlMode in setOf("smart", "full")) 2 + (if (st.autoPay != null) 1 else 0) else 0) + 1
            val handLeftAt = centreX + 44.du - (if (large) (H.value * .13f).coerceIn(66f, 120f).dp else 66.du) / 66f * 222f
            val chatInRow = x0 + 42.du * tools - 8.du + 8.du <= handLeftAt
            Row(Modifier.offset(x = x0, y = ay - 4.du), horizontalArrangement = Arrangement.spacedBy(8.du), verticalAlignment = Alignment.CenterVertically) {
                ControlEmblems(st, intents, Modifier, d)
                if (chatInRow) EmoteButton(Modifier, d)
            }
            Row(Modifier.offset(x = x0, y = ay + 34.du), horizontalArrangement = Arrangement.spacedBy(8.du), verticalAlignment = Alignment.CenterVertically) {
                if (!chatInRow) EmoteButton(Modifier, d)
                ManaPool(me.mana, Modifier, d)
            }

            // Menu and the phase track, top left.
            val menuX = if (large) 12.dp else 8.du; val menuY = if (large) 12.dp else 34.du
            val menuFocus = remember { FocusRequester() }
            Box(Modifier.offset(x = menuX, y = menuY).size(44.du).clip(CircleShape).background(Color(0x6612141A)).border(1.dp, Color(0x24FFFFFF), CircleShape)
                .focusRequester(menuFocus).onFocusChanged { if (it.isFocused) { TablePad.last = menuFocus
                    android.util.Log.i("PadA", "ring on menu button mode=${PadPrompts.inputModes?.inputMode}", Throwable()) } }
                .padActs(PadActs(a = "Menu"))
                .clickable { if (menu != null) menu.open = !menu.open else onMenu() }, contentAlignment = Alignment.Center) { MenuGlyph(d) }
            // The controller's ring comes back to where it was once the menu closes (it went into the menu's first row).
            LaunchedEffect(menu?.open) { if (menu?.open == false) {
                // On two screens the ring goes back to the hand, never to the menu button it may have come from (or A reopens the menu).
                if (DualScreen.active && TablePad.last === menuFocus) TableZones.hand?.let { TablePad.last = it }
                TablePad.restore() } }
            // The menu carries the stack size as a badge (summary[data-count]::after: 18 px gold pill at -4, -4).
            if (st.stack.isNotEmpty()) Box(Modifier.offset(x = menuX + (44 - 18 + 4).du, y = menuY - 4.du).heightIn(min = 18.du).widthIn(min = 18.du).clip(RoundedCornerShape(9.du)).background(Color(0xFFE8B95B)).padding(horizontal = 5.du),
                contentAlignment = Alignment.Center) { Text("${st.stack.size}", style = sans(sp(11f), FontWeight.ExtraBold, Color(0xFF1B1406))) }
            PhaseTrack(st, stopLights(st), intents.stop, Modifier.offset(x = if (large) 80.dp else 74.du, y = if (pod) 58.du else if (large) 20.dp else 42.du).anchorRect("phasetrack"), d)

            // The stack, fanned on the right over its portal, with the arc to its source.
            if (st.stack.isNotEmpty()) {
                val fanX = minOf(W - 214.du, W - 150.du - 16.dp); val fanY = mid - 110.du
                // BB10: older cards fan up only as far as the CPU's seat (its portrait and life pill end 92 du below its top);
                // the words under the top card end 16 dp inside the screen.
                StackFan(st, Modifier.offset(x = fanX, y = fanY), d, onInspect, live, intents.yieldSource, intents.stack,
                    room = fanY + 34.du - (26.du + lx + 66.du), labelMax = W - 16.dp - fanX - 44.du)
                StackArc(st, d)
            }

            // The hand: centred 44 du right of the middle (between your seat and the buttons), the middle card's top 67 du above the bottom.
            val hand = orderedHand(me.hand, handOrder)
            // The hand: 66 px cards on a phone; on a big board they grow with the screen (site: 109 px at 840 tall, 104 at 800).
            val handW = if (large) (H.value * .13f).coerceIn(66f, 120f).dp else 66.du
            val handAnchors = LocalAnchors.current
            // A controller: when A plays the last hand card, the ring goes to the gold button (else the menu button), so it isn't lost.
            val goldFocus = remember { FocusRequester() }
            // The fan itself, at any card width: on the table, or on a dual-screen handheld's bottom screen (MatchBottom).
            val fan: @Composable (Dp) -> Unit = { fanW ->
                HandFan(hand, fanW, Modifier.fillMaxWidth(), raised = selectedHand, angleDeg = 1.2f,
                    markOf = ::markOf,
                    canPlay = { card -> castable(card) },
                    onCarry = { carried = it },
                    blockedOf = { card -> dimWhy(card) },
                    // Two screens: a controller's A on a fan card lifts it, A again plays or casts it (W11); the hint says which.
                    padLift = DualScreen.active,
                    padA = { card -> if (live && discardAsk && card.id in st.selection.cards) (if (card.id == selectedHand) "Discard" else "Pick") else null },
                    onTap = { card ->
                        val playable = markOf(card) == Mark.PLAYABLE
                        when {
                            // The discard asks for a pick first (W12): the tap lifts and marks the card, the same card again discards it.
                            live && discardAsk && card.id in st.selection.cards -> if (selectedHand == card.id) { onSelectHand(null); intents.card(card.id) } else onSelectHand(card.id)
                            live && card.id in st.selection.cards -> intents.card(card.id)
                            // A dark card says why on itself (I4): the tap lifts it with its reason, again opens it.
                            dimWhy(card) != null -> if (selectedHand == card.id) onInspect(card) else onSelectHand(card.id)
                            playable && selectedHand == card.id -> onInspect(card)
                            playable -> onSelectHand(card.id)
                            else -> onInspect(card)
                        }
                    },
                    onPlay = { card -> onSelectHand(null); intents.card(card.id) },
                    onHold = onInspect, onReorder = { ids -> onHandOrder(ids) },
                    padEmpty = { runCatching { goldFocus.requestFocus() }.onFailure { runCatching { menuFocus.requestFocus() } } })
            }
            val dual = DualScreen.active
            // BB8: the gold button's words stay inside it (cut with …) and it stops 12 du short of the line in the middle (AskLine,
            // whose right end it measures) wherever the two share a height: on a phone always, on a big board when the line sits up
            // above the hand chip on two screens. With no line it takes the width its words need.
            val goldInset = if (large) 12.dp else 8.du
            val askText = if (live) askLine(st) else null
            var askRight by remember { mutableStateOf(Dp.Unspecified) }
            LaunchedEffect(askText == null) { if (askText == null) askRight = Dp.Unspecified }
            val goldMax = if ((!large || dual) && askText != null && askRight != Dp.Unspecified) (W - goldInset - askRight - 12.du).coerceAtLeast(138.du) else Dp.Infinity
            // The hand chip (two screens) is centred on the hand; on a phone-sized table it shares the gold button's height and stops
            // 12 du short of where the gold button starts (BB8: "Discard Ultimate Magic: Mete…" ran under it).
            var goldW by remember { mutableStateOf(0.dp) }
            var quietW by remember { mutableStateOf(0.dp) }
            val goldDensity = LocalDensity.current
            val chipMax = if (large) Dp.Infinity else ((W - goldInset - goldW - 12.du - (centreX + 44.du)) * 2).coerceAtLeast(120.du)
            Box(Modifier.offset(x = centreX + 44.du - handW / 66f * 222f, y = H - handW / 66f * 67f).width(handW / 66f * 444f).height(handW / 66f * 120f)
                .then(if (handAnchors != null) Modifier.onGloballyPositioned { handAnchors.putRect("hand", it.boundsInRoot()) } else Modifier)) {
                // With the bottom screen up the hand lives there; the table keeps a small count where the fan was.
                if (!dual) fan(handW)
                else if (hand.isNotEmpty()) {
                    // The hand's handle on the table: the d-pad lands here, left and right walk the hand on the bottom screen (the lifted
                    // card follows), A plays the lifted card when it can be played (else opens it), Y opens it (Randall 9 Nov: "d-pad should
                    // work better on the hand on the bottom screen").
                    val picked = hand.firstOrNull { it.id == selectedHand }
                    // While a discard asks, the chip shows the card the d-pad rests on; only A or a tap picks it (W12).
                    val lifted = if (discardAsk) picked ?: hand.firstOrNull { it.id == discardWalk } else picked
                    val playable = { c: Card -> castable(c) }
                    fun step(dx: Int) {
                        if (discardAsk) { val i = hand.indexOfFirst { it.id == (discardWalk ?: selectedHand) }
                            discardWalk = hand[if (i < 0) (if (dx > 0) 0 else hand.lastIndex) else (i + dx).coerceIn(0, hand.lastIndex)].id; return }
                        val i = hand.indexOfFirst { it.id == selectedHand }
                        onSelectHand(hand[if (i < 0) (if (dx > 0) 0 else hand.lastIndex) else (i + dx).coerceIn(0, hand.lastIndex)].id) }
                    // A on the chip: the walked card is picked for discard, the same card again goes; otherwise it plays what is lifted, or opens it.
                    var chipOn by remember { mutableStateOf(false) }
                    val chipA = {
                        val c = lifted
                        // W11: what A met on the hand chip, so a Thor run shows why a press cast or only lifted (logcat -s PadA).
                        android.util.Log.i("PadA", "chip lifted=${c?.name} sel=$selectedHand discard=$discardAsk live=$live actionable=${c?.let { it.id in st.selection.actionable }} blocked=${c?.let { blocked[it.id] }} prompt=${st.prompt != null} input=${st.inputType}")
                        if (discardAsk && live) {
                            val pick = c ?: hand.first()
                            if (pick.id in st.selection.cards) { if (pick.id == selectedHand) { onSelectHand(null); intents.card(pick.id) } else onSelectHand(pick.id) } else onInspect(pick)
                        } else if (c == null) onSelectHand(hand.first().id)
                        else if (playable(c)) { onSelectHand(null); if (chipOn && !c.isLand) { TablePad.castAt = android.os.SystemClock.uptimeMillis(); TablePad.castId = c.id }; intents.card(c.id) } else onInspect(c)
                    }
                    val chipFocus = remember { FocusRequester() }
                    androidx.compose.runtime.DisposableEffect(chipFocus) { TableZones.hand = chipFocus; onDispose { if (TableZones.hand === chipFocus) TableZones.hand = null } }
                    // W11/Y5: with a controller the ring starts on the hand chip when your turn to act comes and nothing has it, so the first
                    // d-pad press or A is on your hand (not the command zone or a field card).
                    // The table's entry for the ring: a d-pad press or A with nothing focused lands here (no card lifted).
                    androidx.compose.runtime.DisposableEffect(chipFocus) {
                        val e: () -> Boolean = { PadPrompts.inputModes?.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard)
                            TablePad.autoRing = true; val ok = runCatching { chipFocus.requestFocus(androidx.compose.ui.focus.FocusDirection.Enter) }.getOrDefault(false); TablePad.autoRing = false
                            android.util.Log.i("PadA", "entry to the hand chip ok=$ok mode=${PadPrompts.inputModes?.inputMode}"); if (ok) TableZones.at = 0; ok }
                        PadPrompts.entry = e; onDispose { if (PadPrompts.entry === e) PadPrompts.entry = null }
                    }
                    // Keyed on the ring too: when the board loses it (a CPU beat, a closed overlay) while you can act, it comes back here.
                    LaunchedEffect(live, PadPrompts.anyFocus) {
                        if (!live || !Pad.connected.value || PadPrompts.anyFocus || TablePad.held) return@LaunchedEffect
                        androidx.compose.runtime.withFrameNanos { }
                        if (PadPrompts.anyFocus || TablePad.held) return@LaunchedEffect
                        // The ring arrives without lifting a card, so X keeps its pass/step meaning until he walks or presses A.
                        TablePad.autoRing = true
                        // A clickable can't take focus in touch mode (a match is started by touch): leave it first, and log what really happened.
                        PadPrompts.inputModes?.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard)
                        val ok = runCatching { chipFocus.requestFocus(androidx.compose.ui.focus.FocusDirection.Enter) }.getOrDefault(false)
                        android.util.Log.i("PadA", if (ok) "ring starts on the hand chip" else "ring start refused (mode=${PadPrompts.inputModes?.inputMode})")
                        if (ok) TableZones.at = 0
                        TablePad.autoRing = false
                    }
                    val shape = RoundedCornerShape(999.dp)
                    Row(Modifier.align(Alignment.TopCenter).padding(top = handW / 66f * 30f).widthIn(max = chipMax).anchorRect("handchip")
                        .focusRequester(chipFocus)
                        .onFocusChanged { if (chipOn != it.isFocused) android.util.Log.i("PadA", "chip focus=${it.isFocused} autoRing=${TablePad.autoRing} sel=$selectedHand"); if (chipOn != it.isFocused) liftLive = it.isFocused && selectedHand != null; chipOn = it.isFocused; if (it.isFocused) { TableZones.at = 0; TablePad.last = chipFocus; if (selectedHand == null && !discardAsk && !TablePad.autoRing) onSelectHand(hand.first().id); TablePad.autoRing = false } }
                        .onKeyEvent { e -> if (e.nativeKeyEvent.action != android.view.KeyEvent.ACTION_DOWN) return@onKeyEvent false
                            when (e.nativeKeyEvent.keyCode) { android.view.KeyEvent.KEYCODE_DPAD_LEFT -> { step(-1); true }; android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> { step(1); true }; else -> false } }
                        .padActs(PadActs(a = if (discardAsk && live) (if (lifted != null && lifted.id == selectedHand) "Discard" else "Pick") else (lifted?.let { if (playable(it)) (if (it.isLand) "Play land" else "Cast") else "Inspect" } ?: "Lift"), y = lifted?.let { c -> PadAct("Inspect") { onInspect(c) } }))
                        .clip(shape).background(if (chipOn) Color(0x33E8C36F) else Color(0xCC101216)).border(if (chipOn) 2.dp else 1.dp, if (chipOn) Color(0xFFF3D494) else Color(0x40D6AD64), shape)
                        .clickable { chipA() }
                        .padding(horizontal = 12.du, vertical = 5.du), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (chipOn) "\u25C0  " else "", style = sans(sp(11f), FontWeight.Bold, Color(0xFFE8C36F)))
                        Text(lifted?.let { "${if (discardAsk && it.id == selectedHand) "Discard " else ""}${it.name} · ${hand.indexOf(it) + 1} of ${hand.size}" } ?: (if (discardAsk) "Hand ${hand.size} · pick a card" else "Hand ${hand.size} · bottom screen"), style = sans(sp(12f), FontWeight.Bold, Color(0xFFE8C36F)), maxLines = 1,
                            overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                        Text(if (chipOn) "  \u25B6" else "", style = sans(sp(11f), FontWeight.Bold, Color(0xFFE8C36F)))
                    }
                }
            }

            // The buttons, bottom right: the gold step and the quiet second one above it (right edges 8 du in, as the site's dock).
            // A controller's X is the gold one: its words and its tap, only while it can be pressed.
            var padX: PadAct? = null
            if (st.prompt == null && st.waitingOnMe) {
                // The cleanup discard (U1): a lifted card goes, so its button says Discard, never Play or Cast.
                val discardingNow = dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) != null
                // A lift the hand chip keeps on two screens may not be playable now (U8): the gold button offers it only when it is.
                val selected = selectedHand?.let { st.card(it) }?.takeIf { c -> if (discardingNow) c.id in st.selection.cards && c.id !in blocked else castable(c) }
                // W12: the gold button names the card he picked; with none picked it only asks for one and does nothing.
                val pickedDiscard = discardingNow && selected != null
                // W10: your main phase 1, nothing on the stack and no creature able to attack: the step that follows is the end of the turn.
                val endTurnGold = selected == null && !discardingNow && noAttackersLeft(st)
                val ok = if (selected != null) (if (discardingNow) "Discard ${selected.name}" else if (selected.isLand) "Play land" else "Cast")
                    else if (discardingNow && !st.buttons.okEnabled) "Choose a card to discard" else if (endTurnGold) "End turn" else okLabel(st)
                // End turn takes the gold spot (it presses Forge's cancel); the quiet one keeps the way on to combat.
                val second = if (selected != null) null else if (endTurnGold) okLabel(st) else cancelLabel(st)
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
                // The quiet pill in that spot reports its width, so the phone's turn count can stand left of it.
                val quietM = upperM.onSizeChanged { quietW = with(goldDensity) { it.width.toDp() } }.anchorRect("quiet")
                val lowerM = if (large) Modifier else Modifier.align(Alignment.TopEnd).offset(x = (-8).du, y = H - 52.du)
                val attackM = if (large) Modifier else Modifier.align(Alignment.TopEnd).offset(x = (-8).du, y = H - 44.du)
                // Undo's own spot: never where End turn or the gold step was (U6), and never on a pile or its count (BB11: one slot
                // above the quiet one, the old spot, sat on your library and its count at 844 x 390). It takes the quiet one's row,
                // left of where End turn stands (End turn and Undo are never shown together), and drops under the piles if they reach it.
                val pilesFoot = (if (large) mid + 60.dp else mid + 46.du * stretch) + 46.du + 2.du + 16.du
                // It also ends 2 du above the gold button's turn ring (6 du out from the button at H - 52), which is drawn over it. When
                // there is no room for it between the piles' counts and the ring (844 × 390: 40 du for its 36 + 8), it stands at that
                // floor and steps left of the piles instead (6 du clear), when they are where it would be.
                val undoLow = maxOf(H - 94.du, pilesFoot + 4.du); val undoFloor = H - 52.du - 6.du - 2.du - 36.du
                val undoRight = if (undoLow <= undoFloor || pilesX + 78.du <= W - 106.du - 72.du || pilesX >= W - 106.du) 106.du else W - pilesX + 6.du
                val undoM = if (large) Modifier else Modifier.align(Alignment.TopEnd).offset(x = -undoRight, y = minOf(undoLow, undoFloor))
                // A short big board (Thor 960 × 540) puts H - 180 across your piles (mid + 60 to the foot of their counts, V12): there the
                // row drops just under them; a tall board keeps the site's H - 180. Undo shares End turn's place here with its 400 ms guard.
                val rowM = Modifier.align(Alignment.TopEnd).offset(x = (-12).dp, y = maxOf(H - 180.dp, pilesFoot + 14.dp))   // Y7/BB11: clear of the piles' counts
                // The turn clock's last-10 count stands first in that row, never over the button beside the gold one (TurnRing.kt).
                // On a phone the site's spot (44 px left of the gold button) is on the right-most hand card and on the line in the
                // middle, so the count stands in the quiet one's row above the gold button: left of the quiet pill when there is one
                // (its right edge 12 du short of it), else at the right edge (where the quiet one would be). With Attack all the gold
                // button is itself in that row, so the count goes one row higher at the right edge (right of your piles).
                val pickOne = oneTarget(st) || onePick(st)
                val quietShown = when { attackAll -> false; pickOne -> second != null; short && second != null -> st.buttons.okEnabled; endTurnGold -> true
                    else -> second != null && !second.startsWith("Undo", ignoreCase = true) }
                val goldShown = !pickOne || attackAll || (st.selection.min == 0 && st.buttons.okEnabled)
                @Composable fun pair(content: @Composable () -> Unit) = if (large) Row(rowM, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    TurnCount(d.u); androidx.compose.runtime.CompositionLocalProvider(LocalTurnCountOutside provides true) { content() } } else {
                    androidx.compose.runtime.CompositionLocalProvider(LocalTurnCountOutside provides true) { content() }
                    if (goldShown) TurnCount(d.u, Modifier.align(Alignment.TopEnd).offset(x = -(8.du + (if (quietShown) quietW + 12.du else 0.dp)),
                        y = if (attackAll) H - 94.du - 8.du - 32.du else H - 92.du))
                    Unit }
                padX = when {
                    attackAll -> if (live && okOn) PadAct(ok) { intents.ok() } else null
                    oneTarget(st) || onePick(st) -> if (live && st.selection.min == 0 && st.buttons.okEnabled) PadAct("No target") { intents.ok() } else null
                    short && second != null -> if (live) PadAct(second) { intents.cancel() } else null
                    endTurnGold -> if (live) PadAct(ok) { intents.cancel() } else null
                    // An "up to N" discard Forge lets you finish keeps its OK (only a must-discard waits for a pick).
                    discardingNow && selected == null && !okOn -> null
                    else -> if (live && (selected != null || okOn)) PadAct(ok) { if (selected != null) { onSelectHand(null); intents.card(selected.id) } else intents.ok() } else null
                }
                pair {
                    if (attackAll) {
                        GoldPill(ok, live && okOn, upperM.focusRequester(goldFocus).anchorRect("gold").onSizeChanged { goldW = with(goldDensity) { it.width.toDp() } }, d, padKey = padX != null, maxW = goldMax) { intents.ok() }
                        GlassPill("Attack all", live, attackM, d, tone = Color(0xFFFFD9CF), edge = Color(0x88FF8A6A)) { intents.attackAll(offered.map { it.id }) }
                    } else if (oneTarget(st) || onePick(st)) {
                        second?.let { GlassPill(it, live, quietM, d) { intents.cancel() } }
                        if (st.selection.min == 0 && st.buttons.okEnabled) GoldPill("No target", live, lowerM.focusRequester(goldFocus).anchorRect("gold").onSizeChanged { goldW = with(goldDensity) { it.width.toDp() } }, d, padKey = padX != null, maxW = goldMax) { intents.ok() }
                    } else if (short && second != null) {
                        if (st.buttons.okEnabled) GlassPill(ok, live, quietM, d) { intents.ok() }
                        GoldPill(second, live, lowerM.focusRequester(goldFocus).anchorRect("gold").onSizeChanged { goldW = with(goldDensity) { it.width.toDp() } }, d, padKey = padX != null, maxW = goldMax) { intents.cancel() }
                    } else if (endTurnGold) {
                        GlassPill(second ?: "To combat", live && okOn, quietM, d) { intents.ok() }
                        GoldPill(ok, live, lowerM.focusRequester(goldFocus).anchorRect("gold").onSizeChanged { goldW = with(goldDensity) { it.width.toDp() } }, d, padKey = padX != null, maxW = goldMax) { intents.cancel() }
                    } else {
                        // Forge turns its cancel from End turn into "Undo" once a land or a mana tap can be taken back
                        // (InputPassPriority.showMessage), and then cancel undoes. Drawn in End turn's place, a tap meant for End turn
                        // took the land back (U6), so Undo stands in its own spot and ignores taps for its first 400 ms.
                        val undo = second?.startsWith("Undo", ignoreCase = true) == true
                        val shownAt = remember(second) { android.os.SystemClock.uptimeMillis() }
                        second?.let { GlassPill(it, live, if (undo) undoM.anchorRect("undo") else quietM, d) {
                            if (!undo || android.os.SystemClock.uptimeMillis() - shownAt >= 400) intents.cancel() } }
                        GoldPill(ok, live && (selected != null || okOn), lowerM.focusRequester(goldFocus).anchorRect("gold").onSizeChanged { goldW = with(goldDensity) { it.width.toDp() } }, d, padKey = padX != null, maxW = goldMax) {
                            if (selected != null) { onSelectHand(null); intents.card(selected.id) } else intents.ok()
                        }
                    }
                }
            }
            // The table's controller buttons: X the gold button, Start the menu (the same toggle as its button). A hand card or permanent adds its own A and Y.
            // LB/RB step through your hand (lifting each card: on a dual screen's bottom, or the table's own fan); RT is the gold button
            // (pass, resolve, confirm), LT the quiet one (cancel) — specs/dual-screen-native.md's match map.
            val padGold = padX
            PadScreen(PadActs(x = padX, start = PadAct("Menu") { if (menu != null) menu.open = !menu.open else onMenu() },
                // On two screens d-pad left/right on the hand chip already walks the hand, so the shoulders jump between zones instead.
                tabs = if (dual) ({ step: Int -> TableZones.jump(step) }) else if (hand.isEmpty()) null else ({ step: Int ->
                    val i = hand.indexOfFirst { it.id == selectedHand }
                    val next = if (i < 0) (if (step > 0) 0 else hand.lastIndex) else (i + step).coerceIn(0, hand.lastIndex)
                    onSelectHand(hand[next].id) }), tabsLabel = if (dual) "Zone" else "Hand",
                // RT (Randall 9 Nov): between your hand and the field; X is already the gold button (pass). LT cancels.
                page = if (dual) ({ step: Int -> if (step > 0) TableZones.handOrField() else if (live && st.buttons.cancelEnabled) intents.cancel() })
                    else if (!live) null else ({ step: Int -> if (step > 0) padGold?.run?.invoke() else if (st.buttons.cancelEnabled) intents.cancel() }),
                pageLabel = if (dual) (if (live && st.buttons.cancelEnabled) "Cancel · Hand/Field" else "Hand / Field") else if (st.buttons.cancelEnabled) "Cancel / Pass" else "Pass"))
            // V4 a controller's cast: what Forge asks next takes the ring. While it asks for targets, the first legal one (the
            // opponent's cards first, then a player), where A picks; while it asks for mana, a source that pays, where A taps it
            // (X still pays automatically). RT finds the same spot; when the cast is done the ring goes back to the hand chip.
            val padAsk: () -> FocusRequester? = {
                val sel = st.selection
                when {
                    !live || st.prompt != null -> null
                    st.inputType == "InputSelectTargets" -> sel.targetCards.firstNotNullOfOrNull { TableZones.theirs[it] }
                        ?: sel.targetCards.firstNotNullOfOrNull { TableZones.mine[it] }
                        ?: sel.players.sortedBy { it == st.viewer }.firstNotNullOfOrNull { TableZones.orbs[it] }
                    st.inputType?.startsWith("InputPayMana") == true -> sel.actionable.ifEmpty { sel.cards }.firstNotNullOfOrNull { TableZones.mine[it] }
                    else -> null
                }
            }
            TableZones.ask = padAsk
            // W11 (Randall: a pad-only cast, the Arena feel): a spell cast with A pays itself when Forge can pay it automatically and
            // auto-pay is not switched off; the ring only goes to a land when the mana has to be picked by hand.
            val autoPaid = remember { longArrayOf(-1L) }
            LaunchedEffect(st.revision) {
                val paying = live && st.prompt == null && st.inputType?.startsWith("InputPayMana") == true
                // The cast is over (back to priority or anything but targets and payment): nothing later pays itself.
                if (!paying && st.inputType != null && st.inputType != "InputSelectTargets" && st.inputType != "InputLockUI") { TablePad.castAt = 0L; TablePad.castId = null }
                if (!paying || autoPaid[0] == st.revision) return@LaunchedEffect
                if (android.os.SystemClock.uptimeMillis() - TablePad.castAt > 8000 || st.autoPay == false) return@LaunchedEffect
                if (st.buttons.okEnabled && st.buttons.ok.equals("auto", true)) {
                    autoPaid[0] = st.revision; TablePad.castAt = 0L; TablePad.castId = null
                    android.util.Log.i("PadA", "pad cast pays automatically (card ${TablePad.castId}, revision ${st.revision})")
                    intents.ok()
                }
            }
            val padAsking = live && st.prompt == null && (st.inputType == "InputSelectTargets" || st.inputType?.startsWith("InputPayMana") == true)
            val padJumped = remember { booleanArrayOf(false) }
            LaunchedEffect(padAsking, st.inputType) {
                if (!Pad.connected.value || TablePad.held) return@LaunchedEffect
                androidx.compose.runtime.withFrameNanos { }
                if (padAsking) padAsk()?.let { r -> if (runCatching { r.requestFocus() }.isSuccess) { TableZones.at = 1; padJumped[0] = true } }
                else if (padJumped[0]) { padJumped[0] = false; TableZones.hand?.let { r -> if (runCatching { r.requestFocus() }.isSuccess) TableZones.at = 0 } }
            }
            if (dual) { val goldAct = padX; BottomScreen { MatchBottom(st, hand, (selectedHand ?: discardWalk.takeIf { discardAsk })?.let { id -> hand.firstOrNull { it.id == id } }, goldAct, fan, onInspect, afk) } }
            // With the bottom screen up the hand chip sits where the line would be: the line goes just above the chip, high enough
            // that its 10 du drop shadow (AskLine) clears the chip too (U3).
            askText?.let { AskLine(it, W, H, d, bottom = if (dual && hand.isNotEmpty()) H - handW / 66f * 37f - 16.du else null) { r -> askRight = r } }
            // The line between the halves turns into the combat line while you declare (gold attacking, blue blocking).
            CombatLine(st, mid, W, d)
            // Arrivals, casts, hits, deaths and numbers over the cards, under the threads.
            FxLayer()
            // Arrows: attackers to what they attack, blockers to their attacker, your spell to its targets, the top of the stack to its own.
            Arrows(st, live, intents, d)
            if (blockingNow) DragLine(blockDrag, d)
            // On a big board the menu and the CPU's piles own the top-left corner (U5, Thor 960 × 540: CASTING drew over both);
            // there it sits under the piles instead.
            OwnCast(st, d, if (large) mid - 120.dp + 70.dp else null)
            overlay?.invoke(W)
            // The order dialog, a damage split and the zone picker sit over the table; the CPU's line waits under them.
            val covered = live && st.prompt?.let { p -> p.method == "order" || p.method.startsWith("assign") || p.options.any { it.zone in setOf("Library", "Graveyard", "Exile") } } == true
            if (!covered) EmoteLayer(W, H, d)
            // The deck tracker under the table controls on the left; the menu over everything.
            if (menu != null) {
                // History & stack: the story is kept on every state, the panel shows while it is open.
                LaunchedEffect(st) { menu.story.take(st) }
                if (menu.history) HistoryPanel(st, menu.story, onInspect, { menu.history = false }, u)
            }
            if (menu != null) { DeckTracker(st, menu, H, d, menuX, menuY + 44.du + 10.du); if (menu.open) MenuPanel(menu, st.stack.size, d, menuX, menuY + 44.du + 8.du) }
        }
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
 * One row of permanents, centred on [cx] with its middle at [cy]. Identical permanents pile ([pilesOf], ×N, 9 right and 6 up
 * apart); everything else stands alone 10 du apart. A row wider than [room] shrinks to fit (the site's zone scale).
 */
@Composable
private fun PermanentRow(cards: List<Card>, land: Boolean, split: Int = 0, cx: Dp, cy: Dp, room: Dp, d: Du, markOf: (Card) -> Mark, tapOf: (Card) -> (() -> Unit)?, onInspect: (Card) -> Unit, mine: Boolean = false, lookup: (Int) -> Card? = { null }, piece: Dp? = null) = with(d) {
    if (cards.isEmpty()) return@with
    val piles = pilesOf(cards, split, markOf, tapOf)
    // The second lane (site: +22 px between lanes) starts at the first pile past the lands.
    val laneAt = piles.indexOfFirst { p -> cards.indexOf(p.first()) >= split }.takeIf { split in 1 until cards.size } ?: -1
    // A big board: creatures piece·1.18 × piece·.9, other permanents piece·.98 × piece·.68; a pile overlaps by piece·.8 (·.6); lanes 22 apart.
    val laneGap = if (piece != null) 22.dp else 12.du
    val w = if (piece != null) (if (land) piece * .98f else piece * 1.18f) else if (land) 42.du else 50.du
    val h = if (piece != null) (if (land) piece * .68f else piece * .9f) else if (land) 29.du else 38.du
    // Table additions 2: a pile's cards sit 9 px right and 6 px up of the one under them, at most 4 edges showing.
    val step = if (piece != null) 9.dp else 9.du; val rise = if (piece != null) 6.dp else 6.du; val gap = if (piece != null) 12.dp else 10.du
    val widths = piles.map { w + step * (minOf(it.size, PILE_EDGES) - 1) }
    val total = widths.fold(0.dp) { a, b -> a + b } + gap * (piles.size - 1) + if (laneAt > 0) laneGap else 0.dp
    val k = if (total > room) room / total else 1f
    Box(Modifier.offset(x = cx - total * k / 2, y = cy - h * k / 2).graphicsLayer { scaleX = k; scaleY = k; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0f) }) {
        var x = 0.dp
        piles.forEachIndexed { i, pile ->
            if (i == laneAt && i > 0) x += laneGap
            val px = x
            pile.forEachIndexed { j, card ->
                key(card.id) {
                    // Cards below the four showing edges hide under the bottom one; a card joining or leaving a pile re-lays out in 260 ms.
                    val e = pileEdge(j, pile.size)
                    val ax by androidx.compose.animation.core.animateDpAsState(px + step * e, tween(260, easing = FastOutSlowInEasing), label = "px")
                    // Every pile's top card sits on the row's line (three rises up, as the rows were tuned); the cards under it hang below.
                    val ay by androidx.compose.animation.core.animateDpAsState(-rise * (e + (PILE_EDGES - 1) - pileEdge(pile.lastIndex, pile.size)), tween(260, easing = FastOutSlowInEasing), label = "py")
                    Tile(card, w, h, land, markOf(card), mine, lookup, tapOf(card), onInspect, Modifier.offset(x = ax, y = ay).zIndex(j.toFloat()), d,
                        count = if (j == pile.lastIndex && pile.size > 1) pile.size else 1, piece = piece, pileTop = j == pile.lastIndex)
                }
            }
            x += widths[i] + gap
        }
    }
}

/** What gets through your blocks right now: the sum of power of unblocked attackers aimed at you; [atLeast] when the exact number can't be known. */
internal data class Through(val n: Int, val atLeast: Boolean)

/**
 * Table additions 6 (ruling of 2 Nov: never predict what Forge has not stated). N is only the power of attackers aimed at you with no
 * blocker. Trample, double strike, anything attached to an attacker, an unknown power or unknown keywords make it "At least N";
 * when that leaves nothing certain (at least 0) the chip hides. In a pod only attacks aimed at you count.
 */
internal fun damageThrough(st: MatchState): Through? {
    val all = st.players.flatMap { it.battlefield }
    // C2: in a pod an attacker with no known target is not counted as aimed at you.
    val duel = st.players.size <= 2
    val atMe = all.filter { it.attacking && it.controller != st.viewer && ((it.attackTarget == null && duel) || (it.attackTarget?.kind == "player" && it.attackTarget.id == st.viewer)) }
    if (atMe.isEmpty()) return null
    val blocked = all.filter { it.blocking }.flatMap { it.blockingIds }.toSet()
    val open = atMe.filter { it.id !in blocked }
    // C1: Infect turns damage to you into poison counters, so it never comes off your life.
    fun infect(c: Card) = c.keywords.any { it.equals("Infect", true) }
    val n = open.filterNot(::infect).sumOf { (it.power ?: 0).coerceAtLeast(0) }
    fun unsure(c: Card) = !c.keywordsKnown || c.power == null || c.attachments.isNotEmpty() ||
        c.keywords.any { k -> k.equals("Trample", true) || k.equals("Double Strike", true) || k.startsWith("Trample", true) }
    val atLeast = open.any { unsure(it) || infect(it) } || atMe.any { it.id in blocked && it.keywords.any { k -> k.startsWith("Trample", true) } }
    if (atLeast && n == 0) return null
    return Through(n, atLeast)
}

/** The glass chip: "N damage gets through" and "Your life: 20 → X", red border while N > 0; green "Your life stays at X" at 0. */
@Composable
private fun ThroughChip(t: Through, life: Int, modifier: Modifier, d: Du) = with(d) {
    val hurt = t.n > 0
    val edge = if (hurt) Color(0xFFFF6A4A) else Color(0xFF7BE08A)
    val head = when { !hurt -> "No damage gets through"; t.atLeast -> "At least ${t.n} damage gets through"; else -> "${t.n} damage gets through" }
    val sub = when { !hurt -> "Your life stays at $life"; t.atLeast -> "Your life: $life → ${life - t.n} or less"; else -> "Your life: $life → ${life - t.n}" }
    Column(modifier.zIndex(30f).clip(RoundedCornerShape(10.du)).background(Color(0xE60C0D12)).border(1.dp, edge, RoundedCornerShape(10.du))
        .padding(horizontal = 10.du, vertical = 5.du)) {
        Text(head, style = sans(sp(11.5f), FontWeight.Bold, Color(0xFFF6EEDB)).copy(fontFeatureSettings = "tnum"), maxLines = 1)
        Text(sub, style = sans(sp(10.5f), FontWeight.SemiBold, edge).copy(fontFeatureSettings = "tnum"), maxLines = 1)
    }
}

/** At most this many card edges show in a pile. */
internal const val PILE_EDGES = 4
/** How many edges right (and up) of the pile's bottom card the [j]th of [size] sits: 0 for a lone card, at most PILE_EDGES - 1 for the top. */
internal fun pileEdge(j: Int, size: Int): Int = maxOf(0, j - maxOf(0, size - PILE_EDGES))

/**
 * Table additions 2 (tidy board): identical permanents share a pile only when everything the player can see is the same: name, tapped,
 * summoning sick, controller, lane, and how the table marks it. Counters, damage, attachments, combat or a pick/target ring make a card
 * stand alone. Lands and tokens pile from 2; other permanents only at 3 or more.
 */
internal fun pilesOf(cards: List<Card>, split: Int, markOf: (Card) -> Mark, tapOf: (Card) -> (() -> Unit)?): List<List<Card>> {
    val alone = setOf(Mark.PICKED, Mark.TARGET, Mark.DISCARD, Mark.PICKABLE)
    val groups = cards.withIndex().groupBy { (i, it) ->
        val m = markOf(it)
        // A land Forge offers to pay with (or pick) still piles with its twins: the row keeps its shape while mana is asked for.
        if ((m in alone && !(m == Mark.PICKABLE && it.isLand)) || it.counters.isNotEmpty() || it.damage != 0 || it.attacking || it.blocking || it.attachments.isNotEmpty() || it.attachedTo != null) "id${it.id}"
        else "${if (i < split) "l" else "o"}|${it.name}|${it.tapped}|${it.summoningSick}|${it.controller}|${it.token}|$m|${tapOf(it) != null}"
    }.values.map { g -> g.map { it.value } }
    return groups.flatMap { g -> if (g.size == 2 && !g[0].isLand && !g[0].token) g.map { listOf(it) } else listOf(g) }
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
    // glow-rules.md: the usable ring (violet, dashed, 7 dp outside) steps back while a hand card is carried; the payment light shows then.
    val usableRing = mark == Mark.USABLE && !LocalHandCarry.current
    val paid = card.id in LocalPayLight.current
    // Tap: 180 ms (Living Battlefield page 9).
    val turn by animateFloatAsState(if (card.tapped) 20f else 0f, tween(180, easing = FastOutSlowInEasing), label = "tap")
    val anchors = LocalAnchors.current
    val fx = LocalBattlefield.current
    val shape = RoundedCornerShape(10.du)
    // The tap handler is read when the tap lands: keying the gesture on a fresh lambda restarted it on every redraw and dropped taps.
    val tap by androidx.compose.runtime.rememberUpdatedState(onTap)
    val inspect by androidx.compose.runtime.rememberUpdatedState(onInspect)
    val drag = LocalBlockDrag.current
    val draggable = drag != null && card.id in drag.blockers
    val place = remember { arrayOfNulls<androidx.compose.ui.layout.LayoutCoordinates>(1) }
    // A controller: the ring on the top card of a pile; A does what a tap does, Y opens it as a long press does.
    val padSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val padFocus = remember { FocusRequester() }
    val cardNow by androidx.compose.runtime.rememberUpdatedState(card)
    val padA = when {
        onTap == null -> "Inspect"
        mark == Mark.TARGET -> "Target"
        mark == Mark.DISCARD -> "Discard"
        draggable -> "Block"
        LocalAttackInput.current && mineSide && card.isCreature && !card.attacking -> "Attack"
        // V4: a land pays (while Forge asks for mana, or floats it), anything else of yours with a lit ability activates it.
        mark == Mark.USABLE && mineSide -> "Activate"
        mark == Mark.PICKABLE && mineSide && LocalPayInput.current -> "Tap for mana"
        mark == Mark.PICKABLE -> "Choose"
        mark == Mark.NONE && mineSide && Glow.manaOnly(card) -> "Tap for mana"
        else -> null
    }
    val padHere = remember(card.id, padA) { PadActs(a = padA, y = PadAct("Inspect") { inspect(cardNow) }) }
    if (pileTop) androidx.compose.runtime.DisposableEffect(card.id, mineSide) {
        val zone = if (mineSide) TableZones.mine else TableZones.theirs
        zone[card.id] = padFocus
        onDispose { if (zone[card.id] === padFocus) zone.remove(card.id) }
    }
    Box(modifier.size(w, h)
        .graphicsLayer { rotationZ = turn; val s = if (card.tapped) .94f else 1f; scaleX = s; scaleY = s; translationY = if (card.attacking) (if (mineSide) -12f else 12f) * u * density else 0f }
        .onGloballyPositioned { place[0] = it; anchors?.putRect("c${card.id}", it.boundsInRoot()) }
        // Effects move the card by transform only, after its anchor is read, so lines and slots never follow the motion.
        .then(if (fx != null) Modifier.graphicsLayer { fx.move(this, card.id, anchors) } else Modifier)
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
            // The payment light: a wide soft mana-gold glow round the whole card (#ffd98a), under its thin edge.
            if (paid) drawIntoCanvas { c ->
                val spread = 6.du.toPx(); val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = PayGold.copy(alpha = .8f).toArgb(); maskFilter = android.graphics.BlurMaskFilter(16.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                c.nativeCanvas.drawRoundRect(-spread, -spread, size.width + spread, size.height + spread, r + spread, r + spread, p)
            }
            val ringW = (role?.second ?: 1.5f).du.toPx()
            drawRoundRect(if (paid && role == null) PayGold else ring, topLeft = Offset(-ringW, -ringW), size = Size(size.width + 2 * ringW, size.height + 2 * ringW), cornerRadius = CornerRadius(r + ringW))
            // The usable ring: dashed violet (#b79cff), 7 dp outside the card, apart in shape from the solid ice ring.
            if (usableRing) {
                val o = 7.dp.toPx(); val sw = 2.dp.toPx()
                drawRoundRect(UsableViolet, topLeft = Offset(-o, -o), size = Size(size.width + 2 * o, size.height + 2 * o), cornerRadius = CornerRadius(r + o),
                    style = Stroke(sw, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx()))))
            }
        }
        .then(if (pileTop) Modifier.onFocusChanged { if (it.isFocused) { if (mineSide) { TableZones.lastMine = card.id; TableZones.at = 1 } else { TableZones.lastTheirs = card.id; TableZones.at = 2 } } }
            .padActs(padHere).matchPadTap(padSource, padFocus) { tap?.invoke() ?: inspect(card) } else Modifier)
        .clip(shape).background(Color(0xFF141418))
        .pointerInput(card.id) { detectTapGestures(onTap = { tap?.invoke() ?: inspect(card) }, onLongPress = { inspect(card) }) }
        .then(if (draggable && drag != null) Modifier.pointerInput(card.id, drag) { blockDragGestures(card.id, drag, anchors, 22.dp.toPx()) { p -> place[0]?.takeIf { it.isAttached }?.localToRoot(p) } } else Modifier)) {
        // A big board (play-forge-table.css: --nh clamp(15, piece·.15, 22), --nf clamp(11, piece·.083, 13)): the name strip over a dark fade, the art below it.
        val nh = piece?.let { (it.value * .15f).coerceIn(15f, 22f).dp }
        Box(Modifier.fillMaxSize().padding(start = 2.du, end = 2.du, bottom = 2.du, top = nh?.let { it + 3.dp } ?: 2.du).clip(RoundedCornerShape(9.du))) {
            CardImage(card.name, Modifier.fillMaxSize(), crop = true) { CardFrame(card.name, card, Modifier.fillMaxSize(), crop = true) }
        }
        // A card under the top of its pile: art at brightness .78, no name.
        if (!pileTop) Box(Modifier.fillMaxSize().background(Color(0x38000000)))
        // The payment light over the whole card: a soft mana-gold wash.
        if (paid) Box(Modifier.fillMaxSize().background(PayGold.copy(alpha = .22f)))
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
        TileLayer(card, mark == Mark.PLAYABLE || mark == Mark.USABLE, lookup, d, h, if (card.isCreature && card.power != null) (if (piece != null) statPx / u else statPx) else 0f, top = nh?.let { it + 6.dp })
        // .play-current-stats: right 6px, bottom 2px, 1px 7px, #d6ad64c0 hairline, radius 7, #111114f2, white 700; the toughness reads #ff8f84 while damage is marked
        // (forge-table.mjs data-damaged; Forge's toughness already counts counters, damage is not subtracted).
        if (card.isCreature && card.power != null) {
            val fs = if (piece != null) statPx.sp else sp(statPx)
            // A TRIGGER SHOWS ITSELF: while a result that changed this card's power/toughness lands (1.2 s), the plate ticks green (up)
            // or coral (down). Then it is white again: the steady colour waits for base P/T from the bridge.
            val tick = LocalTrigger.current?.takeIf { it.phase == dev.cardstashy.nativeplay.match.TriggerMoment.Phase.RESULT }?.result?.pt?.firstOrNull { it.cardId == card.id }
            val tone = tick?.let { if (it.up) TRIG_GREEN else TRIG_CORAL }
            Row(Modifier.align(Alignment.BottomEnd).offset(x = (-6).du, y = (-2).du).clip(RoundedCornerShape(7.du)).background(tone?.copy(alpha = .28f)?.compositeOver(Color(0xF2111114)) ?: Color(0xF2111114))
                .border(if (tone != null) 1.5.dp else 1.dp, tone ?: Color(0xC0D6AD64), RoundedCornerShape(7.du))
                .padding(horizontal = 7.du, vertical = 1.du)) {
                Text("${card.power} / ", style = sans(fs, FontWeight.Bold, tone ?: Color.White))
                Text("${card.toughness ?: 0}", style = sans(fs, FontWeight.Bold, tone ?: if (card.damage > 0) Color(0xFFFF8F84) else Color.White))
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
    // The attacker's number while you block (1, 2 … in attack order), on its top-left corner.
    LocalAttackNumbers.current[card.id]?.let { n ->
        Box(modifier.size(w, h).zIndex(21f)) {
            Box(Modifier.offset(x = (-7).du, y = (-7).du).size(19.du).clip(CircleShape).background(Color(0xFFB8321F)).border(1.5.dp, Color(0xFFFFC7B4), CircleShape),
                contentAlignment = Alignment.Center) { Text("$n", style = sans(sp(11f), FontWeight.ExtraBold, Color.White)) }
        }
    }
    // Table additions 2: "×N" on the pile's top-right corner, a dark pill with a 1 px gold border and a gold tabular number.
    // It takes a tap and passes it to the top card.
    if (count > 1) {
        val bh = 18.du
        Box(modifier.offset(x = w - 22.du, y = -bh / 2).zIndex(20f).height(bh).widthIn(min = 28.du)
            .clip(RoundedCornerShape(999.dp)).background(Color(0xEB0C0D12)).border(1.dp, Palette.Gold, RoundedCornerShape(999.dp))
            .pointerInput(card.id) { detectTapGestures(onTap = { tap?.invoke() ?: inspect(card) }) }
            .padding(horizontal = 5.du), contentAlignment = Alignment.Center) {
            Text("×$count", style = sans(sp(11f), FontWeight.ExtraBold, Palette.Gold).copy(fontFeatureSettings = "tnum"))
        }
    }
}

/** The CPU's attackers in the order Forge declared them (its last attack event), then any it did not list. */
internal fun attackOrder(st: MatchState): List<Int> {
    val now = st.players.filter { it.id != st.viewer }.flatMap { it.battlefield }.filter { it.attacking }.map { it.id }
    val said = st.events.lastOrNull { it.type == "attack" && it.attackers.isNotEmpty() }?.attackers?.map { it.first.id }.orEmpty().filter { it in now }
    return said + now.filter { it !in said }
}

/** Drag a blocker onto an attacker: the nearest attacker within [slack] of the finger lights, and a drop there blocks it. */
private suspend fun androidx.compose.ui.input.pointer.PointerInputScope.blockDragGestures(id: Int, drag: BlockDrag, anchors: Anchors?, slack: Float, toRoot: (Offset) -> Offset?) {
    fun nearest(p: Offset): Int? = drag.attackers.mapNotNull { a -> anchors?.rects?.get("c$a")?.let { r ->
        val dx = maxOf(r.left - p.x, 0f, p.x - r.right); val dy = maxOf(r.top - p.y, 0f, p.y - r.bottom); a to kotlin.math.hypot(dx, dy) } }
        .filter { it.second <= slack }.minByOrNull { it.second }?.first
    fun end(drop: Boolean) { val over = drag.over; drag.from = null; drag.over = null; if (drop && over != null) drag.drop(id, over) }
    detectDragGestures(
        onDragStart = { p -> toRoot(p)?.let { drag.at = it; drag.from = id; drag.over = nearest(it) } },
        onDrag = { change, _ -> change.consume(); toRoot(change.position)?.let { drag.at = it; drag.over = nearest(it) } },
        onDragEnd = { end(true) }, onDragCancel = { end(false) })
}

/** The blocker's line to your finger while you drag it (block blue, the site's forge-arrow block colour). */
@Composable
private fun DragLine(drag: BlockDrag, d: Du) = with(d) {
    val from = drag.from ?: return@with
    val anchors = LocalAnchors.current ?: return@with
    var self by remember { mutableStateOf(Offset.Zero) }
    Canvas(Modifier.fillMaxSize().onGloballyPositioned { self = it.boundsInRoot().topLeft }) {
        val a = anchors.rects["c$from"] ?: return@Canvas
        val to = drag.over?.let { anchors.rects["c$it"]?.center } ?: drag.at
        val s0 = a.center - self; val e = to - self
        drawLine(Color(0x665A9CFF), s0, e, strokeWidth = 9.du.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
        drawLine(Color(0xFF6AAEFF), s0, e, strokeWidth = 3.du.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
        drawCircle(Color(0xFF6AAEFF), 7.du.toPx(), e, style = Stroke(2.du.toPx()))
    }
}

// ---- Piles (approved: real card piles, a count printed under each) ----

@Composable
private fun Piles(p: Player, mine: Boolean, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, playable: (Card) -> Boolean = { false }, onCast: (Card) -> Unit = {}) = with(d) {
    // Yours: graveyard then library; the CPU's mirrored (library then graveyard).
    Row(modifier.anchorRect("piles${p.id}"), horizontalArrangement = Arrangement.spacedBy(8.du)) {
        @Composable fun lib() = Pile(p.libraryCount, null, d, "lib${p.id}") {}
        // Rule 2: the graveyard's top card wears the playable ring when Forge offers it from there (flashback and the like); a tap
        // casts it, a long press opens it. A castable card under the top is not drawn yet (glow-rules open item).
        val top = p.graveyard.lastOrNull(); val lit = top != null && playable(top)
        @Composable fun grave() = Pile(p.graveyard.size, top, d, "grave${p.id}", lit = lit, onHold = { top?.let(onInspect) }) { top?.let { if (lit) onCast(it) else onInspect(it) } }
        if (mine) { grave(); lib() } else { lib(); grave() }
    }
}

@Composable
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
private fun Pile(count: Int, top: Card?, d: Du, anchor: String? = null, lit: Boolean = false, onHold: (() -> Unit)? = null, onTap: () -> Unit) = with(d) {
    val anchors = LocalAnchors.current
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(33.du, 46.du).then(if (anchors != null && anchor != null) Modifier.onGloballyPositioned { anchors.putRect(anchor, it.boundsInRoot()) } else Modifier)
            // The playable ring (ice, solid), as on a hand card.
            .then(if (lit) Modifier.border(2.dp, Ice, RoundedCornerShape(3.du)) else Modifier)
            .combinedClickable(enabled = top != null, onLongClick = onHold, onClick = onTap)) {
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
    // The CPU's tell while it thinks (match director): one card back slides 16 dp out of the hand, holds, and settles.
    val tell by dev.cardstashy.nativeplay.match.CpuThink.now.collectAsState()
    Box(modifier.size(24.du + step * (n - 1), 50.du)) {
        repeat(n) { i ->
            val lift by androidx.compose.animation.core.animateDpAsState(if (tell?.lifted == i && !Motion.still) 16.dp else 0.dp,
                tween(if (tell?.lifted == i) 220 else 200, easing = FastOutSlowInEasing), label = "tell")
            Box(Modifier.offset(x = step * i, y = lift).size(24.du, 34.du).drawBehind { drawRoundRect(Color(0xAA000000), topLeft = Offset(0f, 4.du.toPx()), size = size, cornerRadius = CornerRadius(5.du.toPx())) }
                .clip(RoundedCornerShape(5.du)).border(2.dp, Color(0xFFC9A75A), RoundedCornerShape(5.du))) { CardBack(Modifier.fillMaxSize()) }
        }
    }
}

/** Three dots that breathe in turn beside the CPU's portrait while it thinks (match director, think steps). */
@Composable
private fun ThinkDots(modifier: Modifier, d: Du) = with(d) {
    val tell by dev.cardstashy.nativeplay.match.CpuThink.now.collectAsState()
    val on by androidx.compose.animation.core.animateFloatAsState(if (tell != null) 1f else 0f, tween(180), label = "dots")
    if (on <= 0f) return@with
    val t = rememberInfiniteTransition(label = "think")
    val phase by t.animateFloat(0f, 3f, infiniteRepeatable(tween(1050, easing = LinearEasing)), label = "p")
    Row(modifier.graphicsLayer { alpha = on }.clip(RoundedCornerShape(999.dp)).background(Color(0xCC14120E)).border(1.dp, Gold.copy(alpha = .6f), RoundedCornerShape(999.dp))
        .padding(horizontal = 7.du, vertical = 5.du), horizontalArrangement = Arrangement.spacedBy(4.du)) {
        repeat(3) { i ->
            val k = (1f - kotlin.math.abs(((phase - i + 3f) % 3f) - .5f).coerceAtMost(1f)).coerceIn(.35f, 1f)
            Box(Modifier.size(5.du).graphicsLayer { alpha = k; translationY = -(k - .35f) * 3.du.toPx() }.clip(CircleShape).background(Color(0xFFFFE7B0)))
        }
    }
}

// ---- Seats ----

/** .play-match-seat: a 52 du round portrait in a gold ring, the life total on a pill under it (tap to target the player). */
@Composable
internal fun Medallion(p: Player, mine: Boolean, pickable: Boolean, picked: Boolean, modifier: Modifier, d: Du, onOpen: (() -> Unit)? = null, onPick: () -> Unit) = with(d) {
    val flash = remember { Animatable(0f) }
    val recoil = remember { Animatable(0f) }
    val tick = remember { Animatable(1f) }
    var last by remember { mutableStateOf(p.life) }
    var shown by remember { mutableIntStateOf(p.life) }
    val cue = LocalTableCue.current
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val calm = remember { Playmats.reduced(ctx) } // reduce motion: the life still ticks down, the portrait stays put
    // A hit to the face (spec 3): the portrait recoils 14 dp and flares bright at contact, then the life ticks down one by one,
    // each step popping coral at 1.5x. Gains and reduced motion just show the new number.
    LaunchedEffect(p.life) {
        val from = last; last = p.life
        if (p.life >= from || Motion.still) { shown = p.life; return@LaunchedEffect }
        delay(730) // the strike reaches the portrait, then the 110 ms hit-stop
        if (!calm) launch { flash.snapTo(1f); flash.animateTo(0f, tween(900)) }
        if (!calm) launch { recoil.snapTo(1f); recoil.animateTo(0f, androidx.compose.animation.core.spring(dampingRatio = .45f, stiffness = 380f)) }
        delay(260)
        var n = 0
        while (shown > p.life) { shown--; cue?.invoke("CMB-024", .7f, (1f - .03f * n++).coerceAtLeast(.6f)); tick.snapTo(1.5f); launch { tick.animateTo(1f, tween(140)) }; delay(if (from - p.life > 8) 60 else 110) }
        shown = p.life
    }
    val anchors = LocalAnchors.current
    val pulse = if (pickable && !Motion.still) rememberInfiniteTransition(label = "pick").animateFloat(.55f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "a").value else 1f
    Box(modifier.size(52.du).then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("orb${p.id}", it.boundsInRoot()) } else Modifier)
        .graphicsLayer { translationY = (if (mine) 1f else -1f) * 14.dp.toPx() * recoil.value; translationX = (if (mine) -1f else 1f) * 6.dp.toPx() * recoil.value }
        .padActs(PadActs(a = if (pickable) "Choose" else if (onOpen != null) "Inspect" else null)).focusRequester(TableZones.orb(p.id))
        // BB12: while the portrait is not a target, a tap opens the seat's commander (the crest beside it opens the same card).
        .clickable(enabled = pickable || onOpen != null) { if (pickable) onPick() else onOpen?.invoke() }) {
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
            if (recoil.value > .3f) Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = .6f * (recoil.value - .3f) / .7f)))
        }
        // .play-match-life: 15 px 800 #fff4d8 on a dark pill with a gold hairline, 39 du below the portrait's top.
        Box(Modifier.align(Alignment.TopCenter).offset(y = 39.du).wrapContentSize(unbounded = true)
            .drawBehind { drawRoundRect(Color(0xCC000000), topLeft = Offset(0f, 3.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
            .clip(RoundedCornerShape(999.dp)).background(Brush.verticalGradient(listOf(Color(0xFF26221A), Color(0xFF14120E)))).border(1.dp, Gold, RoundedCornerShape(999.dp))
            .padding(horizontal = 8.du, vertical = 2.du)) {
            Text("$shown", style = sans(sp(15f), FontWeight.Bold, if (tick.value > 1.01f) Color(0xFFFF8A6A) else Color(0xFFFFF4D8)),
                modifier = Modifier.graphicsLayer { scaleX = tick.value; scaleY = tick.value })
        }
    }
}

/** .play-command-zone.forge-crest: the commander's art on a shield, beside its owner's portrait. */
@Composable
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
private fun Crest(c: Card?, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, playable: Boolean = false, onCast: (Card) -> Unit = {}) = with(d) {
    if (c == null) return@with
    val shield = GenericShape { s, _ ->
        val r = s.width * .09f
        moveTo(r, 0f); lineTo(s.width - r, 0f); quadraticTo(s.width, 0f, s.width, r)
        lineTo(s.width, s.height * .6f); quadraticTo(s.width, s.height * .86f, s.width / 2, s.height)
        quadraticTo(0f, s.height * .86f, 0f, s.height * .6f); lineTo(0f, r); quadraticTo(0f, 0f, r, 0f); close()
    }
    Box(modifier.size(58.du, 70.du), contentAlignment = Alignment.Center) {
        Box(Modifier.size(46.du, 60.du).drawBehind { drawCircle((if (playable) Ice else Gold).copy(alpha = .18f), radius = size.width * .7f) }
            // The playable ring (ice, solid) round the shield while the commander can be cast now.
            .then(if (playable) Modifier.border(2.dp, Ice, shield).padding(2.dp) else Modifier)
            .clip(shield).background(Brush.verticalGradient(listOf(Color(0xFFF2CF7E), Color(0xFF8A6526)))).padding(2.du).clip(shield)
            .combinedClickable(onLongClick = { onInspect(c) }) { if (playable) onCast(c) else onInspect(c) }) { CardImage(c.name, Modifier.fillMaxSize(), crop = true) }
    }
}

/** .forge-seat-mana: what is floating, one symbol each with its count. Nothing floating, nothing shown. */
@Composable
private fun ManaPool(mana: Map<String, Int>, modifier: Modifier, d: Du) = with(d) {
    val floating = listOf("W", "U", "B", "R", "G", "C").mapNotNull { k -> mana[k]?.takeIf { it > 0 }?.let { k to it } }
    if (floating.isEmpty()) return@with
    Row(modifier.heightIn(min = 34.du).clip(RoundedCornerShape(999.dp)).background(Color(0xE60B0D12)).border(1.dp, Gold.copy(alpha = .33f), RoundedCornerShape(999.dp))
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
    Row(modifier.height(26.du).turnLine(u).clip(RoundedCornerShape(999.dp)).background(Color(0xA60F1218)).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(999.dp))
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
private fun StackFan(st: MatchState, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, live: Boolean = false, onYield: (Int, Boolean) -> Unit = { _, _ -> }, onPick: (Int) -> Unit = {},
                     room: Dp = 66.dp, labelMax: Dp = 150.dp) = with(d) {
    val pick: ((Int) -> Unit)? = if (live && st.selection.stackTargets.isNotEmpty()) onPick else null
    // Identical items in a row (the same trigger from the same controller) show once with ×N.
    val groups = mutableListOf<Pair<StackItem, Int>>()
    for (s in st.stack) { val last = groups.lastOrNull(); if (last != null && last.first.text == s.text && last.first.controller == s.controller && last.first.source?.name == s.source?.name) groups[groups.lastIndex] = last.first to last.second + 1 else groups += s to 1 }
    val shown = groups.take(4)
    val spin = if (Motion.still) remember { mutableFloatStateOf(0f) } else rememberInfiniteTransition(label = "portal").animateFloat(0f, 360f, infiniteRepeatable(tween(9000, easing = LinearEasing)), label = "spin")
    val anchors = LocalAnchors.current
    Box(modifier.size(150.du, 211.du)) {
        // The portal: a slow violet-gold swirl behind the top card.
        Canvas(Modifier.offset(x = 30.du, y = 20.du).size(150.du).graphicsLayer { rotationZ = spin.value }) {
            drawCircle(Brush.sweepGradient(listOf(Color(0x008A6BFF), Color(0x668A6BFF), Color(0x55E8B95B), Color(0x008A6BFF))), radius = size.minDimension / 2)
            drawCircle(Brush.radialGradient(listOf(Color(0x88241A4A), Color(0x00241A4A))), radius = size.minDimension / 2)
        }
        // Older items fan up and behind, dimmed. Each steps 22 du up (BB10: its title's first line shows whole above the card in
        // front of it) and 12 du left, while there is room under the CPU's seat; with less room the steps shrink to fit.
        val olderN = shown.size - 1
        val stepY = if (olderN == 0) 0.dp else minOf(22.du, room / olderN).coerceAtLeast(0.dp)
        // BB10 on a phone: with less than 22 du a step the older titles show only their first letters, so the older items fold into
        // a "+N" chip beside the words under the top card; a tap on it lists them (each named in full, a tap opens it or, while it is
        // a target, picks it). The list opens by itself while one of them is a target.
        val folded = olderN > 0 && stepY < 22.du
        val olderAll = groups.drop(1)
        var listOpen by remember { mutableStateOf(false) }
        val olderTarget = pick != null && olderAll.any { it.first.id in st.selection.stackTargets }
        LaunchedEffect(olderTarget) { if (olderTarget) listOpen = true }
        if (!folded) shown.drop(1).reversed().forEachIndexed { k, (s, _) ->
            val depth = shown.size - 1 - k
            StackCard(st, s, 1, Modifier.offset(x = 44.du - 12.du * depth, y = 34.du - stepY * depth)
                // Dimmed with a shade, not see-through (BB10: at 60 % alpha the words of the cards behind showed through each title).
                .then(if (pick != null && s.id in st.selection.stackTargets) Modifier else Modifier.drawWithContent { drawContent(); drawRoundRect(Color(0x66000000), cornerRadius = CornerRadius(7.du.toPx())) })
                .then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("stack${s.id}", it.boundsInRoot()) } else Modifier), d, onInspect, small = true, pick = pick)
        }
        val (top, n) = shown.first()
        // Match director (cast row): a CPU spell is the card itself, out of the CPU's hand with a lift, turning face up, onto the stack
        // in 430 ms; it then stays there with its arrows until it resolves. No glass box.
        val fly = remember { Animatable(1f) }
        var flyFrom by remember { mutableStateOf<Offset?>(null) }
        val flown = remember { HashSet<Int>() }
        LaunchedEffect(top.id) {
            if (Motion.still || top.ability || top.controller == st.viewer || top.source == null || !flown.add(top.id)) return@LaunchedEffect
            flyFrom = anchors?.rects?.get("cpuhand")?.center ?: return@LaunchedEffect
            fly.snapTo(0f); fly.animateTo(1f, tween(430, easing = FastOutSlowInEasing)); flyFrom = null
        }
        // Director step 4: when the top resolves, the next item slides forward from its fanned place to the top (240 ms).
        val older = remember { arrayOf(emptySet<Int>()) }
        val promoted = remember(top.id) { top.id in older[0] }
        SideEffect { older[0] = shown.drop(1).map { it.first.id }.toSet() }
        val slide = remember { Animatable(1f) }
        LaunchedEffect(top.id) { if (promoted && !Motion.still) { slide.snapTo(0f); slide.animateTo(1f, tween(240, easing = FastOutSlowInEasing)) } }
        val back = 16.du
        var here by remember { mutableStateOf(Offset.Zero) }
        Box(Modifier.offset(x = 44.du, y = 34.du).then(if (anchors != null) Modifier.onGloballyPositioned { val b = it.boundsInRoot(); here = b.center; anchors.put("stacktop", Offset(b.left, b.top + b.height * .3f)); anchors.putRect("stackcard", b); anchors.putRect("stack${top.id}", b) } else Modifier)
            .graphicsLayer {
                val from = flyFrom; val e = fly.value
                if (from != null && e < 1f) {
                    translationX = (from.x - here.x) * (1f - e); translationY = (from.y - here.y) * (1f - e) + kotlin.math.sin(Math.PI.toFloat() * e) * 40.dp.toPx()
                    val k = .45f + .55f * e; scaleX = k; scaleY = k; rotationY = 180f * (1f - e); cameraDistance = 12f * density
                } else if (slide.value < 1f) {
                    val q = slide.value
                    translationX = -back.toPx() * (1f - q); translationY = -back.toPx() * (1f - q)
                    val k = .86f + .14f * q; scaleX = k; scaleY = k; alpha = .6f + .4f * q
                }
            }) {
            StackCard(st, top, n, Modifier, d, onInspect, pick = pick)
            // Face down for the first half of the turn-over.
            if (flyFrom != null && fly.value < .5f) Box(Modifier.matchParentSize().clip(RoundedCornerShape(6.du))) { CardBack(Modifier.fillMaxSize()) }
        }
        // Under the top card (BB10: above it the words sat on the top card's corner and on the titles of the older cards fanned
        // there): whose it is (U5: a CPU spell said nothing on the Thor) and, for an ability only, Forge's own yield
        // (native-panel.mjs withYield; the bridge refuses a yield on a spell: stack_item_not_offered). It starts at the top card's
        // left edge and ends at most 16 dp inside the screen (W3: "CPU's ability" cut at the edge), the words cut with … first.
        val yours = top.controller == st.viewer
        Row(Modifier.offset(x = 44.du, y = 34.du + 145.du + 8.du).widthIn(max = labelMax).anchorRect("stacklabel"),
            horizontalArrangement = Arrangement.spacedBy(6.du), verticalAlignment = Alignment.CenterVertically) {
            Text("${if (yours) "Your" else "CPU's"} ${if (top.trigger) "trigger" else if (top.ability) "ability" else "spell"}", style = sans(sp(11f), FontWeight.Bold, if (yours) Gold else CpuRed), maxLines = 1,
                overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            if (folded) Box(Modifier.anchorRect("stackmore").clip(RoundedCornerShape(999.dp)).background(if (listOpen) Color(0x33E8C36F) else Color(0x0DFFFFFF))
                .border(1.dp, Color(0x55E8C36F), RoundedCornerShape(999.dp))
                .semantics { contentDescription = "${olderAll.size} more on the stack"; role = Role.Button; stateDescription = if (listOpen) "Open" else "Closed" }
                .clickable { listOpen = !listOpen }.padding(horizontal = 8.du, vertical = 4.du)) {
                Text("+${olderAll.size}", style = sans(sp(11f), FontWeight.Bold, Color(0xFFE8C36F)), maxLines = 1)
            }
            if (top.ability) {
                val on = top.yielded
                val lock = st.prompt != null || st.inputType == "InputLockUI"
                Box(Modifier.clip(RoundedCornerShape(999.dp))
                    .background(if (on) Brush.verticalGradient(listOf(Color(0xFFF6DC9A), Color(0xFFD9A64A))) else Brush.verticalGradient(listOf(Color(0x0DFFFFFF), Color(0x0DFFFFFF))))
                    .semantics { contentDescription = if (on) "Stop yielding to this ability" else "Pass on this ability every time it is on top, until end of turn. Targets and choices still stop."; role = Role.Button; stateDescription = if (on) "On" else "Off" }
                    .clickable(enabled = !lock) { onYield(top.id, !on) }.padding(horizontal = 10.du, vertical = 4.du)) {
                    Text(if (on) "Yielding" else "Yield", style = sans(sp(11f), FontWeight.Bold, if (on) Color(0xFF1B1406) else Color(0xFFCFD4DC)))
                }
            }
        }
        // The folded items, listed left of the top card (next to resolve first), each one line with whose it is.
        if (folded && listOpen) Column(Modifier.offset(x = 44.du - 8.du - 168.du, y = 34.du).width(168.du).anchorRect("stacklist")
            .clip(RoundedCornerShape(10.du)).background(Color(0xF00C0D12)).border(1.dp, Color(0x40D6AD64), RoundedCornerShape(10.du)).padding(4.du),
            verticalArrangement = Arrangement.spacedBy(3.du)) {
            for ((s, n) in olderAll) {
                val target = pick != null && s.id in st.selection.stackTargets
                val mine = s.controller == st.viewer
                val src = s.source
                Row(Modifier.fillMaxWidth().anchorRect("stackrow${s.id}").clip(RoundedCornerShape(7.du))
                    .border(1.dp, if (target) Color(0xFFFF9D5C) else Color.Transparent, RoundedCornerShape(7.du))
                    .clickable(enabled = target || src != null) { if (target) pick!!(s.id) else src?.let(onInspect) }
                    .padding(horizontal = 6.du, vertical = 4.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.du)) {
                    Box(Modifier.size(6.du).clip(CircleShape).background(if (mine) Gold else CpuRed))
                    Text((src?.name ?: stackSourceName(s.text) ?: "Ability") + if (n > 1) " ×$n" else "", style = sans(sp(11f), FontWeight.SemiBold, Color(0xFFF3E7C6)),
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
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
        // glow-rules "who is doing what to whom": the arc and the source's rim in the caster's colour (gold you, coral CPU).
        val tone = if (top.controller == st.viewer) Gold else CpuRed
        drawPath(path, tone.copy(alpha = .9f), style = Stroke(2.5f.du.toPx(), cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(1f, 9.du.toPx()), -dash.value * 10.du.toPx())))
        drawCircle(Brush.radialGradient(listOf(tone.copy(alpha = .55f), Color.Transparent), center = to, radius = 34.du.toPx()), radius = 34.du.toPx(), center = to)
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
    // Forge writes an ability as "Source — rules text"; with no source card that lead is the name (fix list B7).
    val name = src?.name ?: stackSourceName(s.text)
    val w = 104.du; val h = 145.du
    Box(modifier.size(w, h)) {
        Box(Modifier.fillMaxSize().drawBehind {
            drawRoundRect(rim.copy(alpha = .35f), topLeft = Offset(-6.du.toPx(), -6.du.toPx()), size = Size(size.width + 12.du.toPx(), size.height + 12.du.toPx()), cornerRadius = CornerRadius(12.du.toPx()))
        }.clip(RoundedCornerShape(7.du)).border(2.dp, rim, RoundedCornerShape(7.du)).background(Color(0xFF1A1714))
            .clickable(enabled = target || src != null) { if (target) pick!!(s.id) else src?.let(onInspect) }) {
            if (!ability && src != null) CardImage(src.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            else Column(Modifier.fillMaxSize().padding(4.du)) {
                Text((name ?: "Ability"), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(9.5f), color = Color(0xFFF3E7C6)), maxLines = if (small) 1 else 2, overflow = TextOverflow.Ellipsis)
                // The source's art when there is a source card; no empty frame without one.
                if (src != null) Box(Modifier.padding(top = 3.du).fillMaxWidth().height(52.du).clip(RoundedCornerShape(3.du))) { CardImage(src.name, Modifier.fillMaxSize(), crop = true) }
                // A TRIGGER SHOWS ITSELF: an item Forge put up as a trigger says "Trigger" in the caster's colour (gold you, coral CPU).
                if (s.trigger) Text("Trigger", style = sans(sp(9.5f), FontWeight.Bold, if (mine) Gold else CpuRed).copy(fontStyle = FontStyle.Italic), modifier = Modifier.padding(top = 3.du))
                else Text(if (s.text.contains("Whenever") || s.text.contains("When ") || s.text.contains("At the beginning")) "Triggered ability" else "Activated ability",
                    style = sans(sp(9f), FontWeight.SemiBold, Color(0xFFD8C9A6)).copy(fontStyle = FontStyle.Italic), modifier = Modifier.padding(top = 3.du))
                Box(Modifier.padding(top = 3.du).fillMaxWidth().height(1.dp).background(rim.copy(alpha = .5f)))
                // X13: the ability's words wrap over as many lines as the card has room for, stepping the size down before cutting ("shares a cr…").
                androidx.compose.foundation.text.BasicText(s.text.substringAfter(" — ", s.text), style = sans(sp(8.5f), FontWeight.Normal, Color(0xFFEEE6D4)), modifier = Modifier.weight(1f).padding(top = 3.du),
                    overflow = TextOverflow.Ellipsis, autoSize = androidx.compose.foundation.text.TextAutoSize.StepBased(minFontSize = sp(6.5f), maxFontSize = sp(8.5f), stepSize = sp(.25f)))
            }
        }
        if (n > 1) Box(Modifier.align(Alignment.TopEnd).offset(6.du, (-8).du).clip(RoundedCornerShape(999.dp)).background(Brush.radialGradient(listOf(Color(0xFFFFF2C6), Color(0xFFD9B463), Color(0xFFA9822F))))
            .border(2.dp, Color(0xFFFFF3CF), RoundedCornerShape(999.dp)).padding(horizontal = 5.du)) { Text("×$n", style = sans(sp(11f), FontWeight.Bold, Color(0xFF2A1D05))) }
    }
}

/** The source's name Forge leads a stack entry's text with ("Soul Warden — Whenever…"), or null. */
internal fun stackSourceName(text: String): String? = text.substringBefore(" \u2014 ", "").trim().takeIf { it.isNotEmpty() && it.length <= 60 }

// ---- Controller (PadPrompts): the gold ring and A for things that answer touch with their own gestures ----

/**
 * The table's zones for the shoulders on a dual screen (specs/dual-screen-native.md's match map): LB/RB jump the ring
 * Hand → Your board → Opponent's board and round again, landing on the card it was last on in that zone, else the zone's first.
 */
internal object TableZones {
    var hand: FocusRequester? = null
    val mine = LinkedHashMap<Int, FocusRequester>(); val theirs = LinkedHashMap<Int, FocusRequester>()
    var lastMine: Int? = null; var lastTheirs: Int? = null
    /** 0 hand, 1 yours, 2 theirs: where the ring is now. */
    var at = 0
    /** The player portraits (Medallion) by player id, so a player target can take the ring. */
    val orbs = HashMap<Int, FocusRequester>()
    fun orb(id: Int): FocusRequester = orbs.getOrPut(id) { FocusRequester() }
    /** What the table asks for now (a legal target, else a mana source that pays), set by the table each frame (V4). */
    var ask: (() -> FocusRequester?)? = null
    /** RT: from the hand to what the table asks for, else your board; from anywhere else back to the hand. */
    fun handOrField() {
        val r = if (at == 0) (ask?.invoke() ?: lastMine?.let { mine[it] } ?: mine.values.firstOrNull()) else hand
        if (r != null && runCatching { r.requestFocus() }.isSuccess) at = if (at == 0) 1 else 0
    }
    fun jump(step: Int) {
        val order = listOf(0, 1, 2)
        var z = at
        repeat(3) {
            z = order[(order.indexOf(z) + step + 3) % 3]
            val r = when (z) {
                0 -> hand
                1 -> (lastMine?.let { mine[it] } ?: mine.values.firstOrNull())
                else -> (lastTheirs?.let { theirs[it] } ?: theirs.values.firstOrNull())
            }
            if (r != null && runCatching { r.requestFocus() }.isSuccess) { at = z; return }
        }
    }
}

/** Where the controller's ring was on the table (a hand card, a permanent, the menu button), so closing an open card or the menu puts it back. */
internal object TablePad {
    var last: FocusRequester? = null
    /** The ring went into an overlay (the open card, the menu); closing it hands focus back to [last]. */
    var held = false
    /** When A on the hand chip last cast a spell (W11): its mana is paid automatically when Forge can. */
    var castAt = 0L
    var castId: Int? = null
    /** The ring is being put on the hand chip by the table itself (not a d-pad press): it lifts nothing. */
    var autoRing = false
    fun restore() { if (held) { held = false; last?.let { runCatching { it.requestFocus(androidx.compose.ui.focus.FocusDirection.Enter) } } } }
}

/**
 * Controller reach for something whose touch is its own pointerInput gestures: the gold ring on pad focus, and A
 * (d-pad centre / Enter) does what a tap does. Touch is untouched: a finger never focuses it, and nothing draws without focus.
 */
internal fun Modifier.matchPadTap(source: androidx.compose.foundation.interaction.MutableInteractionSource, requester: FocusRequester? = null, onTap: () -> Unit): Modifier =
    (if (requester != null) focusRequester(requester).onFocusChanged { if (it.isFocused) TablePad.last = requester } else this)
        .onKeyEvent { e ->
            val k = e.nativeKeyEvent.keyCode
            if (k == android.view.KeyEvent.KEYCODE_DPAD_CENTER || k == android.view.KeyEvent.KEYCODE_ENTER || k == android.view.KeyEvent.KEYCODE_NUMPAD_ENTER) {
                if (e.nativeKeyEvent.action == android.view.KeyEvent.ACTION_UP && !e.nativeKeyEvent.isCanceled) onTap()
                true
            } else false
        }
        .indication(source, PadFocus.Ring).focusable(interactionSource = source)

// ---- Buttons (.forge-native-actions on the seat) ----

@Composable
internal fun GoldPill(text: String, enabled: Boolean, modifier: Modifier, d: Du, padKey: Boolean = false, maxW: Dp = Dp.Infinity, onClick: () -> Unit) = with(d) {
    // The controller's X is this button: with a pad here the key is printed on it, and the hint bar does not say it again (no prompt twice).
    val pad by Pad.connected.collectAsState()
    val keyed = padKey && pad && enabled
    val owner = remember { Any() }
    androidx.compose.runtime.DisposableEffect(owner, keyed, text) {
        if (keyed) DualScreen.shownLabels[owner] = setOf(text.lowercase())
        onDispose { DualScreen.shownLabels.remove(owner) }
    }
    // The turn clock's ring (and, for the last 10 s, its seconds) sits on this button, wherever the table puts it (TurnRing.kt).
    Box(modifier.widthIn(min = 138.du, max = maxOf(maxW, 138.du)).height(44.du).turnRing(u).drawBehind { drawRoundRect(Color(0x3DC99A4B), topLeft = Offset(0f, 8.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
        .clip(RoundedCornerShape(999.dp)).background(if (enabled) Brush.verticalGradient(listOf(Color(0xFFF7DA97), Color(0xFFE8B95B), Color(0xFFC4903A))) else Brush.verticalGradient(listOf(Color(0xFF6B5A3A), Color(0xFF4A3E28))))
        .border(1.dp, Color(0xFFF6DFA8), RoundedCornerShape(999.dp)).clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) {
        Row(Modifier.padding(horizontal = 18.du), horizontalArrangement = Arrangement.spacedBy(8.du), verticalAlignment = Alignment.CenterVertically) {
            if (keyed) PadKey("X", "")
            // [data-native-key=ok]:after { content: ' ›'; font-size: 20px }. A long label ("Discard Ultimate Magic: Meteor") is cut
            // with … inside the button (BB8); the › stays.
            Row(Modifier.weight(1f, fill = false)) {
                Text(text, style = sans(sp(15f), FontWeight.Bold, Color(0xFF1B1408)), maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.weight(1f, fill = false).alignByBaseline())
                if (enabled) Text(" \u203A", style = sans(sp(20f), FontWeight.Bold, Color(0xFF1B1408)), maxLines = 1, modifier = Modifier.alignByBaseline())
            }
        }
    }
}

@Composable
internal fun GlassPill(text: String, enabled: Boolean, modifier: Modifier, d: Du, tone: Color = Color(0xFFEEE6D4), edge: Color = Color(0x26FFFFFF), onClick: () -> Unit) = with(d) {
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
    Box(Modifier.size(34.du).graphicsLayer { val s = if (down && enabled) .92f else 1f; scaleX = s; scaleY = s; alpha = if (enabled) 1f else .55f }
        .drawBehind { if (on) drawCircle(Brush.radialGradient(listOf(Gold.copy(alpha = .33f), Color.Transparent), radius = size.width * .9f), radius = size.width * .9f) }
        .clip(CircleShape)
        .background(if (on) Brush.radialGradient(listOf(Color(0xFF4A3C1F), Color(0xFF1B160C)), center = Offset.Unspecified) else Brush.linearGradient(listOf(Color(0xCC0F1117), Color(0xCC0F1117))))
        .border(1.dp, if (on) Gold else Color(0x2AFFFFFF), CircleShape)
        .semantics { contentDescription = label; role = Role.Button; stateDescription = if (on) "On" else "Off" }
        // It draws its own press (a scale); PadFocus.Ring adds only the controller's focus ring.
        .clickable(enabled = enabled, interactionSource = press, indication = PadFocus.Ring) { if (AppSettings.haptics) hf.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove); onClick() },
        contentAlignment = Alignment.Center) { icon(if (on) Color(0xFFF4D78F) else Color(0xFF8D95A5)) }
}

@Composable
private fun ControlEmblems(st: MatchState, intents: TableIntents, modifier: Modifier, d: Du) = with(d) {
    if (st.controlMode !in setOf("smart", "full")) return@with
    val lock = st.prompt != null || st.inputType == "InputLockUI" || st.busy
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.du)) {
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
    Box(modifier.size(34.du).drawBehind { drawCircle(Color(0x99000000), radius = size.width / 2 + 2.du.toPx(), center = center + Offset(0f, 4.du.toPx())) }
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
        val cx = if (mine) 106.du else W - 106.du
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
        // A controller's B closes it too (as that tap does) instead of leaving the match; a phone with no pad keeps its back as it was.
        androidx.activity.compose.BackHandler(Pad.connected.collectAsState().value) { TableEmotes.menuOpen = false }
        PadScreen(PadActs(b = "Close", opaque = true))
        var mh by remember { mutableStateOf(0) }
        val hDp = with(density) { mh.toDp() }
        Column(Modifier.padLayer().offset(x = 117.du, y = (H - 93.du - hDp - 8.du).coerceAtLeast(8.du)).widthIn(min = 150.du).onSizeChanged { mh = it.height }
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

private data class Rel(val kind: String, val from: String, val to: String, val held: Boolean = false, val blocker: Int? = null, val attacker: Int? = null, val hostile: Boolean? = null)

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
    } else st.stack.forEachIndexed { i, item ->
        // Every item keeps its arrows for its whole life on the stack (director spec 7), the top one from the big card.
        for (r in item.targets) {
            val to = if (r.kind == "card" && board.any { it.id == r.id }) "c${r.id}" else if (r.kind == "player" && st.players.any { it.id == r.id }) "orb${r.id}" else null
            val hostile = when (r.kind) { "player" -> r.id != item.controller; else -> board.firstOrNull { it.id == r.id }?.controller != item.controller }
            if (to != null) out += Rel("target", if (i == 0) "stackcard" else "stack${item.id}", to, hostile = hostile)
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
    // The x on your own block line takes that block back (forge-table.mjs unblock). Each x is its own small button over the
    // line: a tap layer over the whole board took every tap during blocks, so no card could be picked (Randall, 6 Nov).
    val hits = remember { mutableStateListOf<Pair<Offset, Rel>>() }
    Canvas(Modifier.fillMaxSize().onGloballyPositioned { self = it.boundsInRoot().topLeft }) {
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
            val dash = when { r.kind == "target" -> null; heldLine -> PathEffect.dashPathEffect(floatArrayOf(3 * k, 9 * k), 0f); else -> PathEffect.dashPathEffect(floatArrayOf(6 * k, 7 * k), -flow.value * k) }
            val w = (if (r.kind == "target") 2f else 2.5f) * k
            val alpha = if (heldLine) .22f else .9f
            if (!heldLine) drawIntoCanvas { c ->
                val gp = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = w + 2 * k; color = glows.getValue(r.kind).toArgb(); maskFilter = android.graphics.BlurMaskFilter(6 * k, android.graphics.BlurMaskFilter.Blur.NORMAL); pathEffect = dash?.let { android.graphics.DashPathEffect(if (r.kind == "attack" || r.kind == "block") floatArrayOf(6 * k, 7 * k) else floatArrayOf(1f, 0f), flow.value * k) } }
                c.nativeCanvas.drawPath(path.asAndroidPath(), gp)
            }
            drawPath(path, col.copy(alpha = alpha), style = Stroke(w, cap = StrokeCap.Round, pathEffect = dash))
            // The target's rim (director cast row): red when the spell is hostile to it, green when friendly; stays while it does.
            if (r.kind == "target" && r.hostile != null && r.to.startsWith("c")) {
                val rim = if (r.hostile) Color(0xFFFF5A4A) else Color(0xFF6FE08A)
                drawRoundRect(rim.copy(alpha = .9f), Offset(b.left - self.x - 3 * k, b.top - self.y - 3 * k), androidx.compose.ui.geometry.Size(b.width + 6 * k, b.height + 6 * k),
                    CornerRadius(6 * k), style = Stroke(2.5f * k))
            }
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
    if (blocking && live) for ((at, r) in hits) {
        val density = LocalDensity.current
        val half = 22.dp
        Box(Modifier.offset { IntOffset((at.x - with(density) { half.toPx() }).roundToInt(), (at.y - with(density) { half.toPx() }).roundToInt()) }.size(half * 2)
            .semantics { contentDescription = "Take back this block"; role = Role.Button }
            .clickable(interactionSource = null, indication = PadFocus.Ring) { intents.unblock(r.blocker!!, r.attacker!!) })
    }
}

/** .forge-own-cast on a phone (max-height 520): the card you are casting, top left, while you pick its targets or pay. */
@Composable
private fun OwnCast(st: MatchState, d: Du, top: Dp? = null) = with(d) {
    val c = pendingCast(st) ?: return@with
    val anchors = LocalAnchors.current
    val name = c.name.ifEmpty { Regex("targets? for ([^\n]+)", RegexOption.IGNORE_CASE).find(st.message)?.groupValues?.get(1)?.trim() ?: "" }
    Column(Modifier.offset(x = 8.du, y = top ?: 58.du).width(76.du)
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
        val lines = st.message.lines().map { it.trim() }.filter { it.isNotEmpty() && !Regex("^(Priority|Turn|Phase|Stack):").containsMatchIn(it) }
        // A choose-cards input (InputSelectCardsFromList, e.g. Break Under Pressure making you sacrifice) writes "<card> (id)",
        // " - <its rules text>" and then what to do on its own line ("Select 1 creature …(s) to sacrifice."): that last line is the ask.
        val first = lines.drop(1).lastOrNull { Regex("^(Select|Choose)\\b", RegexOption.IGNORE_CASE).containsMatchIn(it) } ?: lines.firstOrNull() ?: ""
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
        // Forge's "Select 1 creature or planeswalker they control with the highest mana value …(s) to sacrifice." reads as
        // "Tap a creature or planeswalker to sacrifice" (the table already lights the cards that qualify).
        Regex("^(?:Select|Choose) (\\d+) (.+?)(?:\\(s\\))? to ([a-z][a-z ]*?)\\.?$", RegexOption.IGNORE_CASE).find(ask)?.let { m ->
            val n = m.groupValues[1].toInt(); val action = m.groupValues[3].trim()
            val what = m.groupValues[2].replace(Regex("\\s+(?:(?:they|you) control|with|among|that|from)\\b.*$", RegexOption.IGNORE_CASE), "").trim().ifEmpty { "card" }
            val verb = if (!Pad.connected.value && onePick(st) && st.selection.cards.all { st.card(it)?.zone == "Battlefield" }) "Tap" else "Choose"
            ask = if (n == 1) "$verb ${if (Regex("^[aeiou]", RegexOption.IGNORE_CASE).containsMatchIn(what)) "an" else "a"} $what to $action"
                else "Choose $n ${what.split(" or ").joinToString(" or ") { if (it.endsWith("s")) it else it + "s" }} to $action"
        }
        if (ask.isEmpty()) ask = if (input == "InputSelectTargets") "Choose a target" else "Choose a card on the table"
        ask = if (oneTarget(st) && !Pad.connected.value) ask.replace(Regex("^(Select|Choose) (a )?targets? for", RegexOption.IGNORE_CASE), "Tap a target for") else ask.replace(Regex("^Select\\b"), "Choose")
        return ask
    }
    // A payment your mana can't finish says so above the hand; Cancel is the way out.
    Affordability.paying(st)?.takeIf { it.short }?.let { return "Not enough mana" + (it.name?.let { n -> " for $n" } ?: "") }
    // The cleanup discard (U1): Forge asks it with no prompt and no input name, so this line is the only place that says so.
    if (discard) {
        val n = dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) ?: 1
        val to = dev.cardstashy.nativeplay.match.TurnClock.discardTo(st)
        val verb = if (Pad.connected.value) "choose" else "tap"
        return "Discard down to $to: $verb ${if (n == 1) "1 card" else "$n cards"}"
    }
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
/** Forge's pick-exactly-one card list (a sacrifice, a card to keep): the tap commits it, so a dead OK is never shown. */
internal fun onePick(st: MatchState): Boolean = st.prompt == null && st.inputType == "InputSelectCardsFromList" && st.selection.min == 1 && st.selection.max == 1 &&
    st.selection.cards.isNotEmpty() && st.selection.chosenCards.isEmpty()

/**
 * .forge-ask-line on a phone: centred 30 du right of the middle, its bottom 4 du above your hand. With the bottom screen up
 * ([bottom] given) its bottom sits at that line instead, above the hand chip, so the question and "Hand N" never overlap
 * (Thor run 10 Nov: "Respond to Sol Ring?" drawn over the hand label).
 */
@Composable
private fun AskLine(text: String, W: Dp, H: Dp, d: Du, bottom: Dp? = null, onRight: (Dp) -> Unit = {}) = with(d) {
    val density = LocalDensity.current
    val place = if (bottom == null) Modifier.offset(x = 30.du, y = H - 64.du)
        else Modifier.offset(x = 30.du).layout { m, c -> val p = m.measure(c.copy(minHeight = 0)); layout(p.width, p.height) { p.place(0, bottom.roundToPx() - p.height) } }
    Box(Modifier.fillMaxWidth().then(place).wrapContentHeight(unbounded = true, align = Alignment.Bottom), contentAlignment = Alignment.BottomCenter) {
        // Its right end on the board (it is centred in a box that starts 30 du in), for the gold button (BB8).
        Box(Modifier.widthIn(max = W - 444.du).anchorRect("askline").onGloballyPositioned { c -> onRight(30.du + with(density) { c.boundsInParent().right.toDp() }) }.drawBehind {
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
