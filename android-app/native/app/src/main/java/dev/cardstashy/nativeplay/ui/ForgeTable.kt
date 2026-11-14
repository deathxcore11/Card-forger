package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.draw.drawWithContent
import dev.cardstashy.nativeplay.match.BoardFoil
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
import kotlin.math.PI
import kotlin.math.sin
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
import androidx.compose.ui.semantics.onClick
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
 *  - the graveyard as a real card pile (0.4.60 Z4: its top card with its count in its player's square; the library and the
 *    hand are "Deck N" and "Hand N" in words there, the CPU hand's backs are gone);
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

/** M3: how long the table may take to pass for you before the Resolve press comes back. */
internal const val RESOLVE_LATE_MS = 2500L
/** M3: the gold button's words while your own spell or trigger resolves by itself. It is not a press. */
internal const val RESOLVING = "Resolving…"
/** native-panel.mjs nativeActionLabel with the hosted short step ("To combat"). */
internal fun okLabel(st: MatchState): String {
    val raw = st.buttons.ok ?: "OK"
    if (!Regex("^(ok|auto|cancel|end turn)$", RegexOption.IGNORE_CASE).matches(raw.trim())) return raw
    val mine = st.me.battlefield
    return when {
        st.inputType == "InputPassPriority" -> when {
            // Mobile table M3: your own spell or trigger resolves by itself; the button says so and offers no press.
            st.stack.isNotEmpty() -> if (st.stack.first().controller != st.viewer) "No response"
                else if (dev.cardstashy.nativeplay.match.AutoPass.resolvesItself(st, AppSettings.stopToRespond)) RESOLVING else "Resolve"
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
/**
 * The colour pip on a back-row tile: lands only. Thor 0.4.56 (finding F): the back row also holds non-creature permanents (a white
 * saga), and each wore a land's W pip over the start of its name.
 */
internal fun landPip(card: Card, rowIsLand: Boolean): Char? = if (rowIsLand && card.isLand) cardColors(card)?.firstOrNull() else null

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
internal val CpuRed = Color(0xFFE0533F)
private val StopOrange = Color(0xFFFF8A3D)

internal fun sans(size: TextUnit, weight: FontWeight = FontWeight.Bold, color: Color = Color(0xFFEEE6D4)) =
    TextStyle(fontFamily = Type.Sans, fontWeight = weight, fontSize = size, color = color)

/** One design unit as Dp: the site's CSS px at 844 × 390, scaled to fit. */
internal val LocalAttackInput = androidx.compose.runtime.staticCompositionLocalOf { false }
/** 0.4.60 G6 review: the permanent whose ability rows are open in the inspect view (ForgeBoard's abilityOpen), else null. */
internal val LocalAbilityOpen = androidx.compose.runtime.compositionLocalOf<Int?> { null }
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
internal fun chromeU(w: Dp, h: Dp) = ZoneLayout.scale(w.value, h.value)

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
    modifier: Modifier = Modifier, menu: MatchMenu? = null, afk: String? = null,
    /**
     * 0.4.60 G6 (glow-rules.md "The ability opens on the card"): a tap or A on your permanent wearing the usable ring opens the card
     * with its ability rows instead of firing blind; the Activate there runs the activation. Null: [onInspect] opens it.
     */
    onAbility: ((Card) -> Unit)? = null,
    /**
     * 0.4.60 G6 review: the permanent whose ability rows are open (the inspect view): its payment light shows what Activate would
     * tap, and on two screens the pad's A on its tile says "Activate" (the second press activates). Null: none open.
     */
    abilityOpen: Int? = null,
    overlay: @Composable (Dp.() -> Unit)? = null,
) {
    // Living Battlefield: effects read from each new snapshot; a touch anywhere skips them to their end.
    // One per board; a caller's own (a frame-by-frame test) wins, so card moves and the shake follow it too.
    val outer = LocalBattlefield.current
    val fx = outer ?: remember { Battlefield() }
    FxDriver(fx, st)
    // 0.4.60 G5 review: the ringed tile is this board's own, so a match that ends takes it along (never a stale id in the next).
    val ringedTile = remember { RingedTile() }
    androidx.compose.runtime.CompositionLocalProvider(LocalBattlefield provides fx, LocalRinged provides ringedTile) {
    BoxWithConstraints(modifier.fillMaxSize().fxSkip(fx)
        // Live 0.4.56 on the Thor: Android's own default focus (leaving touch mode, a cleared ring) comes in from the top as a Down
        // search and landed on the menu button, so A opened the menu. On two screens with a controller it goes to the hand instead.
        .focusProperties { onEnter = {
            if (requestedFocusDirection == androidx.compose.ui.focus.FocusDirection.Down && DualScreen.active && Pad.connected.value)
                TableZones.hand?.let { h -> TablePad.autoRing = true; val ok = h.tryFocus(androidx.compose.ui.focus.FocusDirection.Enter); TablePad.autoRing = false
                    android.util.Log.i("PadA", "board entered from the top: ring to the hand chip ok=$ok") }
        } }
        .onFocusChanged { TableZones.ringIn = it.hasFocus }
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
            // Live 0.4.57: while Forge asks for targets the targets own the ring; the hand chip lifts nothing and A on it goes to them.
            val targeting = live && st.prompt == null && st.inputType == "InputSelectTargets"
            // A cast you started asks for targets or for mana: the ring goes there (V4) and LT may cancel it.
            val padAsking = targeting || (live && st.prompt == null && st.inputType?.startsWith("InputPayMana") == true)
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
            val payLight = carriedId?.let { id -> me.hand.firstOrNull { it.id == id } }?.let { Glow.payment(st, live, it, blocked, quiet) }
                // G6 review (glow-rules.md: "the payment light shows what it would tap"): the open ability's sources.
                ?: abilityOpen?.let { id -> st.card(id) }?.let { Glow.abilityPayment(st, live, it, blocked, quiet) } ?: emptySet()
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
            // 0.4.60 G6: an ability is never fired blind on the first tap: the usable ring's tap opens the card with its rows.
            fun tapOf(card: Card): (() -> Unit)? = if (blockingNow) blockTap(card)
                else if (live && card.zone == "Battlefield" && markOf(card) == Mark.USABLE) ({ (onAbility ?: onInspect)(card) })
                else if (live && (card.id in st.selection.cards || card.id in st.selection.targetCards || (card.id in st.selection.actionable && card.id !in blocked) || card.id in st.selection.chosenCards ||
                ((st.inputType == "InputAttack" || st.inputType == "InputBlock") && card.controller == st.viewer && (card.attacking || card.blocking)))) ({ intents.card(card.id) }) else null

            // 0.4.59 T3: the open sheet (a pile or a graveyard), kept as a key so it reads the table as it is.
            var open by remember { mutableStateOf<Open?>(null) }
            // A question that asks for a graveyard card opens that graveyard as the chooser (legal cards ringed); it closes again
            // when the question is answered, unless you opened it yourself.
            var openedForAsk by remember { mutableStateOf(false) }
            val graveAsk = graveChoices(st, live).map { it.id }
            LaunchedEffect(graveAsk) {
                val c = graveAsk.firstOrNull()?.let { st.card(it) }
                if (c != null) { if (open == null) { open = Open.Grave(c.owner); openedForAsk = true } }
                else if (openedForAsk) { open = null; openedForAsk = false }
            }
            // 0.4.60 G3: a lone permanent opens the one inspect view (CardInspect, with its attachments); a pile opens the group sheet.
            val openPile: (List<Card>) -> Unit = { pile -> when (val t = pileTap(pile)) { is PileTap.Inspect -> onInspect(t.card); is PileTap.Sheet -> { open = t.open; openedForAsk = false } } }
            val openGrave: (Int) -> Unit = { id -> open = Open.Grave(id); openedForAsk = false }

            val large = bigBoard(W, H)
            // The gold button's and the quiet one's measured widths (the rows below and the turn count keep clear of them).
            var goldW by remember { mutableStateOf(0.dp) }
            var quietW by remember { mutableStateOf(0.dp) }
            // 0.4.60 Z1: the table's zones, measured in order from this box (TableScreen pads it by the safe-drawing insets, so cutouts
            // and bars are already off): the two strips, the hand tray, and the board is what is left (ZoneLayout).
            val zones = remember(W, H, DualScreen.active, u) { ZoneLayout.of(W.value, H.value, dual = DualScreen.active, k = u) }
            fun ZoneLayout.Box.at() = Modifier.offset(x = x.dp, y = y.dp)
            // 0.4.60 Z6: the gold button and the quiet row above it are 44 dp tall at the least (touch targets; ZoneLayout.BUTTON).
            val btnH = maxOf(44.du, ZoneLayout.BUTTON.dp)
            // The gold button's top: its height above the bottom of the actions corner.
            val goldY = zones.actions.bottom.dp - btnH
            // Z6: the three-dot menu beside the quiet button (Yield), open or not, and the ring's way into its first line.
            var dotsOpen by remember { mutableStateOf(false) }
            // Opened by the controller (LT): its first line takes the ring; a finger's tap leaves the ring where it was.
            var dotsByPad by remember { mutableStateOf(false) }
            val dotsFocus = remember { FocusRequester() }
            val dotsMenu = TableActions.menu(st, live)
            if (dotsMenu.isEmpty() && dotsOpen) dotsOpen = false
            // 0.4.60 Z2: the four rows in the board, their heights fixed from the usable height (TableGeometry.rows): each side hugs
            // its own edge. A pod's opponent rail runs along the top.
            val rowsG = ZoneLayout.rows(zones, DualScreen.active, if (pod) 58.du.value else 0f)
            val mid = rowsG.divider.dp
            val centreX = W / 2

            // The divider between the halves: a thin violet line with a notch on your side's turn.
            Box(Modifier.offset(y = mid).fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x998A7BD8), Color(0x998A7BD8), Color.Transparent))))
            // The mat's ambient light: turn warmth, the priority edge light and combat grain, under every card.
            // The living table F1: the turn light, under every card.
            TurnLight(st)
            // F2: the mana light of the lands you tapped this turn.
            ManaLight(st)
            // F3: what a heavy landing left on the mat this turn.
            LandMarks()
            // F7: the winning hit's flood and crack, in the mat.
            WinMark()
            // F8: the air over the mat.
            TableAir(st)
            FxMat(st, mid)
            // Nothing of the turn clock lies on the divider (table additions 5): it is a ring on the gold button and a line under the phase track.

            // While the side dock asks (it sits bottom right, over the board's corner) the rows end before it (the dock lane below).
            val docked = live && st.failure == null && !st.finished && st.prompt?.let { p -> p.method != "order" && !p.method.startsWith("assign") && p.options.none { it.zone in setOf("Library", "Graveyard", "Exile") } } == true
            // CPU half: lands at the back, creatures at the front; yours mirrored.
            // A creature Forge says must attack this combat wears a tag until it is in the attack.
            // P4: the board before this one, to know which tiles the new turn readied (read in composition, so their turn is delayed).
            val lastBoard = remember { arrayOfNulls<MatchState>(2) }
            val ripple = remember(st.revision) { if (lastBoard[1] !== st) { lastBoard[0] = lastBoard[1]; lastBoard[1] = st }
                lastBoard[0]?.let { untapOrder(it, st) } ?: emptyList() }
            PayEmbers(payLight)
            // P5: the attackers this board declared, in the order they step up.
            val declared = remember(st.revision) { lastBoard[0]?.takeIf { lastBoard[1] === st }?.let { declareOrder(it, st) } ?: emptyList() }
            // M2 (Randall 11 Nov 22:54Z): the tags carry the seat names the table already shows, yours and the other side's.
            val seatName = dev.cardstashy.nativeplay.account.Account.profile.collectAsState().value?.name?.takeIf { it.isNotBlank() }
            androidx.compose.runtime.CompositionLocalProvider(LocalUntapRipple provides (if (Motion.still || fx.reduced) emptyList() else ripple), LocalDeclare provides declared, LocalAttackInput provides (live && st.inputType == "InputAttack"),
                LocalSideTags provides Glow.sideTags(st, live), LocalSideNames provides (sideName(seatName ?: me.name) to sideName(cpu.name)), LocalPayLight provides payLight, LocalHandCarry provides payLight.isNotEmpty(), LocalAbilityOpen provides abilityOpen, LocalPayInput provides (live && Glow.paying(st)),
                LocalAttackNumbers provides (if (blockingNow && attackersNow.size > 1) attackersNow.withIndex().associate { (i, c) -> c.id to i + 1 } else emptyMap()),
                LocalBlockDrag provides (if (blockingNow) blockDrag else null)) {
                // 0.4.60 Z1: the stack lives in the right strip and never takes board width (walk line 27). Only the side dock, which
                // stands bottom right over the board's corner (196 du at most, 8 du in), still has the rows end short of it while it asks.
                val boardRight = zones.board.right.dp
                val lane by androidx.compose.animation.core.animateDpAsState(if (docked) (boardRight - (W - 8.du - 196.du) + 8.du).coerceAtLeast(0.dp) else 0.dp, tween(if (Motion.still) 0 else 220), label = "dockLane")
                // 0.4.60 Z2: the existing tiles, their heights fixed by the rows. Crowding squeezes them sideways (the art cropped, then
                // the piles overlapping), one width for both creature rows and one for both back rows (TableGeometry.tiles).
                fun sizes(cs: List<Card>, split: Int) = pilesOf(cs, split, ::markOf, ::tapOf).map { it.size }
                fun twoLanes(p: Player) = lands(p.battlefield).isNotEmpty() && backOthers(p.battlefield).isNotEmpty()
                // The creature rows keep a tapped tile's turned corner on the board at both ends (the narrowest tile reaches furthest);
                // the back rows start 6 du in (or as far as their tapped corner reaches).
                val fh = rowsG.cpuFront.height; val bh0 = rowsG.cpuBack.height
                val reach = TableGeometry.sideReach(fh * TableGeometry.CROP_MIN, fh).dp
                val frontLeft = zones.board.x.dp + reach
                // M14: the planeswalkers stand in a column at the right end of their owner's side; the creature rows end short of it.
                val cpuWalk = walkers(cpu.battlefield); val myWalk = walkers(me.battlefield)
                val walkFull = H * (if (zones.phone) Walkers.PHONE else Walkers.BIG)
                val myWalkCol = if (myWalk.isEmpty()) null else Walkers.column(myWalk.size, walkFull.value, mid.value + 3.du.value,
                    minOf(zones.handTray?.y ?: zones.window.bottom, if (zones.phone) Float.MAX_VALUE else rowsG.myBack.top - 10.du.value) - 4.du.value,
                    rowsG.myFront.centre + (if (zones.phone) 4.du.value else rowsG.myFront.height * .25f), Walkers.GAP.du.value)
                val cpuWalkCol = if (cpuWalk.isEmpty()) null else Walkers.column(cpuWalk.size, walkFull.value,
                    if (zones.phone) zones.window.y + 40.du.value else rowsG.cpuBack.bottom + 4.du.value, mid.value - 3.du.value,
                    rowsG.cpuFront.centre - (if (zones.phone) 4.du.value else rowsG.cpuFront.height * .25f), Walkers.GAP.du.value)
                val walkLane = listOfNotNull(myWalkCol, cpuWalkCol).maxOfOrNull { it.first * Walkers.WIDE }?.let { it.dp + Walkers.INSET.du + 8.du } ?: 0.dp
                val room = boardRight - reach - lane - walkLane - frontLeft
                val backIn = maxOf(6.du, TableGeometry.sideReach(bh0 * TableGeometry.CROP_MIN, bh0).dp)
                val backX = zones.board.x.dp + backIn
                val backRoom = boardRight - backIn - lane - backX
                val frontX = frontLeft + room / 2
                // Z1 review: no button takes your back row's width any more. Undo has its slot in the right strip (zones.undo) and the
                // buttons keep off the board's box (goldMax, quietMax below), so your back row has the board's whole width.
                // M5, a phone: your lands lie in the shelf left of the hand, so your back row has that room, not the board's width.
                val myBackRoom = zones.shelf?.let { minOf(backRoom, it.right.dp - backX) } ?: backRoom
                // M5, a phone (the brief's "Phone conflicts from the full picture run", 2): the shelf holds your lands only; your loose
                // permanents stand at the right end of your creature row, a lane's gap after the creatures, and count toward its squeeze.
                val shelfLands = zones.shelf != null
                val myFront = if (shelfLands) others(me.battlefield) + backOthers(me.battlefield) else others(me.battlefield)
                val myFrontSplit = if (shelfLands) others(me.battlefield).size else 0
                val myBack = if (shelfLands) lands(me.battlefield) else backRow(me.battlefield)
                val cpuFrontPiles = sizes(others(cpu.battlefield), 0); val myFrontPiles = sizes(myFront, myFrontSplit)
                val cpuBackPiles = sizes(backRow(cpu.battlefield), lands(cpu.battlefield).size); val myBackPiles = sizes(myBack, lands(me.battlefield).size)
                val tiles = TableGeometry.tiles(rowsG, room.value, backRoom.value, cpuFrontPiles, myFrontPiles, cpuBackPiles, myBackPiles,
                    twoLanes(cpu), twoLanes(me), myBackRoom.value, k = u)
                val frontGap = TableGeometry.gap(maxOf(cpuFrontPiles.size, myFrontPiles.size), u).dp
                val backGap = TableGeometry.gap(maxOf(cpuBackPiles.size, myBackPiles.size), u).dp
                val fw = tiles.frontW.dp; val bw = tiles.backW.dp; val bh = tiles.back.dp
                val tilePiece = tiles.front.dp / .9f
                val advance = TableGeometry.advance(rowsG, tiles.front, 12.du.value).dp
                val advancePx = with(LocalDensity.current) { advance.toPx() }
                androidx.compose.runtime.SideEffect { fx.advancePx = advancePx }
                // Match punch P1: the shake and push-in move the board box only (the four rows), about the board's centre. The squares,
                // phase, End turn and the gold button live outside it and never move under a thumb.
                Box(Modifier.fillMaxSize().zIndex(if (fx.strikers.value.isEmpty()) 0f else 1f).graphicsLayer {
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin((zones.board.x + zones.board.w / 2) / W.value.coerceAtLeast(1f),
                        (zones.board.y + zones.board.h / 2) / H.value.coerceAtLeast(1f))
                    fx.pivot = fx.origin + Offset(transformOrigin.pivotFractionX * size.width, transformOrigin.pivotFractionY * size.height)
                    fx.shake(this) }) {
                // M14: on a phone the CPU's column reaches up beside its back row, so that row ends short of it.
                PermanentRow(backRow(cpu.battlefield), true, lands(cpu.battlefield).size, backX, rowsG.cpuBack.centre.dp, if (zones.phone && cpuWalkCol != null) backRoom - walkLane else backRoom, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) }, piece = tilePiece, tile = bw to bh, fromLeft = true, onPile = openPile, gap = backGap, looseRight = true)
                // M14: yours stack upward from the first (the second above it), the CPU's downward, the mirror.
                for ((cards, col, mineSide) in listOf(Triple(cpuWalk, cpuWalkCol, false), Triple(myWalk, myWalkCol, true))) if (col != null) cards.forEachIndexed { i, c -> key(c.id) {
                    val (wh, top) = col; val ww = wh * Walkers.WIDE
                    val slot = if (mineSide) cards.lastIndex - i else i
                    Tile(c, ww.dp, wh.dp, false, markOf(c), mineSide, { st.card(it) }, tapOf(c), onInspect,
                        Modifier.offset(x = boardRight - lane - Walkers.INSET.du - ww.dp, y = (top + slot * (wh + Walkers.GAP.du.value)).dp).zIndex(40f), d, piece = tilePiece, whole = true)
                } }
                PermanentRow(others(cpu.battlefield), false, 0, frontX, rowsG.cpuFront.centre.dp, room, d, ::markOf, ::tapOf, onInspect, lookup = { st.card(it) }, piece = tilePiece, tile = fw to fh.dp, advance = advance, onPile = openPile, gap = frontGap, squeezed = tiles.squeezed)
                PermanentRow(myFront, false, myFrontSplit, frontX, rowsG.myFront.centre.dp, room, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) }, piece = tilePiece, tile = fw to fh.dp, advance = advance, onPile = openPile, gap = frontGap, squeezed = tiles.squeezed)
                // The shelf's lands overlap like a fan when they do not fit, [SHELF_SHOW] dp of each pile showing at the least; past
                // that the row runs on under the hand's left edge (the hand's cards lie on top).
                val shelfNeed = if (!shelfLands || myBackPiles.isEmpty()) 0.dp else TableGeometry.rowWidth(bh.value, myBackPiles, step = TableGeometry.FAN_MIN, w = bw.value, gap = 0f).dp - (bw - SHELF_SHOW.dp) * (myBackPiles.size - 1)
                PermanentRow(myBack, true, lands(me.battlefield).size, backX, rowsG.myBack.centre.dp, if (shelfLands) maxOf(myBackRoom, minOf(shelfNeed, backRoom)) else myBackRoom, d, ::markOf, ::tapOf, onInspect, mine = true, lookup = { st.card(it) }, piece = tilePiece, tile = bw to bh, fromLeft = true, onPile = openPile, gap = backGap,
                    // On a phone your back row is the shelf left of the hand: the hand lies where its right end would be.
                    looseRight = zones.shelf == null)
                }
            }

            // 0.4.60 Z4 (specs/table-zones-brief.md, "Player squares in the corners"; mockup lines 306 to 321): each player's glass
            // square in its corner of the left strip, the CPU's top left and yours bottom left (the brief's corners; the mockup draws
            // the same). A square holds the name, the round portrait with the life on its gold pill, "Hand N" and "Deck N" in words and
            // the graveyard's top card with its count (a tap, or A on the pad, opens the T3 sheet); the player whose turn it is wears
            // the gold edge. The CPU's hand backs and both libraries' piles are gone from the strip: their counts are the words.
            val profile by dev.cardstashy.nativeplay.account.Account.profile.collectAsState()
            // Z4 review: in a pod the rail draws the opponents along the board's top (each chip its own life and hand), as before Z4.
            if (pod) PodRail(st, cpu.id, live, intents, { podFocus.seat = it; picks++ }, W, d, x = zones.board.x.dp, width = zones.board.w.dp)
            // Mobile table M12: the CPU's hand as a fan of card backs at the top edge, one back per card; the cast card and the
            // drawn card start and end there ("cpuhand"), so the square's "Hand N" words carry their own key.
            if (!pod) CpuHandFan(cpu.handCount, zones, d)
            if (!pod) PlayerSquare(cpu, zones.cpuSquare, cpu.name, st.activePlayer == cpu.id, d, handKey = "cpuhandwords",
                portrait = { a, m, lifeSp -> Medallion(cpu, mine = false, live && cpu.id in st.selection.players, cpu.id in st.selection.chosenPlayers, m.anchorRect("cpuseat"), d,
                    side = a, lifeSp = lifeSp, onOpen = commanderOf(cpu)?.let { c -> { onInspect(c) } }) { intents.player(cpu.id) } },
                grave = { w, h, sp -> GravePile(cpu, w, h, sp, d, onInspect, onGrave = openGrave) })
            PlayerSquare(me, zones.mySquare, profile?.name?.takeIf { it.isNotBlank() } ?: me.name, st.activePlayer == me.id, d, handKey = null,
                portrait = { a, m, lifeSp -> Medallion(me, mine = true, live && me.id in st.selection.players, me.id in st.selection.chosenPlayers, m, d, side = a, lifeSp = lifeSp) { intents.player(me.id) } },
                grave = { w, h, sp -> GravePile(me, w, h, sp, d, onInspect, playable = { markOf(it) == Mark.PLAYABLE }, onCast = { intents.card(it.id) }, onGrave = openGrave) })
            // The CPU's thinking dots: in its square's top right corner, right of its name.
            if (!pod) ThinkDots(Modifier.offset(x = zones.cpuSquare.right.dp - 37.du, y = zones.cpuSquare.y.dp + 1.du).anchorRect("thinkdots"), d)
            // Command-zone crests (Z7 gives them their marks): the CPU's under its square at the right, yours over your tools at the left,
            // so the two shields never meet in the strip.
            // 0.4.60 Z7: the shield stays while the commander is out of the command zone (on the battlefield it wears "In play"),
            // with Forge's tax for the next cast on its badge.
            if (!pod) Crest(CommanderMarks.shield(cpu, st.players), cpu.id, Modifier.offset(x = zones.cpuSquare.right.dp - 52.du, y = zones.cpuSquare.bottom.dp - 1.du).anchorRect("cpucrest"), d, onInspect)
            val myShield = CommanderMarks.shield(me, st.players)
            // The room the CPU's crest takes under its square (LAST MOVES starts below it).
            val cpuCrestH = if (!pod && CommanderMarks.shield(cpu, st.players) != null) 62.du else 0.dp
            @Composable fun myCrest(m: Modifier) = Crest(myShield, me.id, m, d, onInspect,
                playable = myShield?.card?.takeIf { it.zone == "Command" }?.let { markOf(it) == Mark.PLAYABLE } == true) { intents.card(it.id) }
            // Table additions 6: while you declare blocks, what gets through, above your seat. Gone the moment blocks are confirmed.
            if (blockingNow) damageThrough(st)?.let { t -> ThroughChip(t, me.life, Modifier.offset(x = zones.mySquare.x.dp + 50.du, y = zones.mySquare.bottom.dp - 120.du), d) }
            val tools = (if (st.controlMode in setOf("smart", "full")) 2 + (if (st.autoPay != null) 1 else 0) else 0) + 1
            // The dual top's tool row in the chip band: its width (first frame: the tools at their 42 du pitch, the mana not yet measured).
            val dockDensity = LocalDensity.current
            var dockW by remember { mutableStateOf(0.dp) }
            // Z1 review: the dual top's board runs down beside your square, so there the tools and the mana stand in one row at the left
            // end of the hand chip's band under the board (the chip keeps clear of them: chipMax). Its ask line keeps left of the old
            // tray's reach (trayRight), as before Z4.
            val dockBand = zones.handChip
            val x0 = zones.mySquare.x.dp + 116.du
            val handLeftAt = centreX + 44.du - (if (large) (H.value * .13f).coerceIn(66f, 120f).dp else 66.du) / 66f * 222f
            val chatInRow = x0 + 42.du * tools - 8.du + 8.du <= handLeftAt
            val trayRight = if (dockBand != null) x0 + 42.du * (if (chatInRow) tools else tools - 1) - 8.du else zones.leftStrip.right.dp
            if (dockBand != null) {
                Row(Modifier.offset(x = dockBand.x.dp + 4.du, y = dockBand.y.dp + (dockBand.h.dp - 34.du) / 2).anchorRect("tools")
                    .onSizeChanged { dockW = with(dockDensity) { it.width.toDp() } }, horizontalArrangement = Arrangement.spacedBy(8.du), verticalAlignment = Alignment.CenterVertically) {
                    ControlEmblems(st, intents, Modifier, d)
                    EmoteButton(Modifier, d)
                    ManaPool(me.mana, Modifier, d)
                }
                myCrest(Modifier.offset(x = zones.mySquare.x.dp - 6.du, y = zones.mySquare.y.dp - 74.du))
                // LAST MOVES (Every Result Names Its Cause): in the left strip between the two squares, clear of both crests.
                val movesTop = (if (pod) zones.leftStrip.y.dp else zones.cpuSquare.bottom.dp + 6.du) + cpuCrestH
                val movesH = zones.mySquare.y.dp - 6.du - (if (myShield != null) 74.du else 0.dp) - movesTop
                if (movesH > 0.dp) LastMoves(LocalLastMoves.current, Modifier.offset(x = zones.mySquare.x.dp, y = movesTop).width(zones.mySquare.w.dp).height(movesH), d)
            } else {
                // Z4: chat and the bolt (the Smart emblem; Full Control and auto-pay beside them as before) keep their function, at 44 dp,
                // just above your square: two to a row (chat and the bolt the row nearest the square), one when the strip is narrower
                // than two. Above them the floating mana, then your crest. All of it in the left strip, off the board.
                val btn = TextFloors.TOUCH.dp
                val room = zones.leftStrip.w.dp
                val gap = minOf(8.du, room - btn * 2)
                val perRow = if (gap >= 2.dp) 2 else 1
                val rowW = if (perRow == 2) btn * 2 + gap else btn
                val left = if (zones.mySquare.x.dp + rowW <= zones.mySquare.right.dp) zones.mySquare.x.dp else zones.leftStrip.x.dp + ((room - rowW) / 2).coerceAtLeast(0.dp)
                val top = if (pod) zones.leftStrip.y.dp else zones.cpuSquare.bottom.dp + 6.du
                val buttons = listOf<@Composable () -> Unit>({ EmoteButton(Modifier, d, side = btn) }) + emblemsOf(st, intents, d, btn)
                val stripH = (zones.mySquare.y.dp - 6.du - top).coerceAtLeast(0.dp)
                var toolsH by remember { mutableStateOf(0.dp) }
                Box(Modifier.offset(x = left, y = top).width(zones.leftStrip.right.dp - left).height(stripH)) {
                    // LAST MOVES (Every Result Names Its Cause): the room the strip has left above your tools and the mana (and
                    // above your crest; its 66 du are free when you have no commander), below the CPU's crest.
                    val movesH = stripH - toolsH - 6.du - cpuCrestH + (if (myShield == null) 66.du else 0.dp)
                    if (movesH > 0.dp && toolsH > 0.dp) LastMoves(LocalLastMoves.current, Modifier.align(Alignment.TopStart).offset(y = cpuCrestH)
                        .width(minOf(zones.mySquare.right.dp, zones.leftStrip.right.dp) - left).height(movesH), d)
                    Column(Modifier.align(Alignment.BottomStart).wrapContentHeight(Alignment.Bottom, unbounded = true).onSizeChanged { toolsH = with(dockDensity) { it.height.toDp() } }, verticalArrangement = Arrangement.spacedBy(6.du)) {
                        // The crest's box is 70 du for a 60 du shield: it takes only the shield's height in the strip.
                        Box(Modifier.height(60.du), contentAlignment = Alignment.Center) { myCrest(Modifier.offset(x = zones.mySquare.x.dp - left - 6.du).wrapContentHeight(unbounded = true)) }
                        ManaPool(me.mana, Modifier.anchorRect("tray2"), d, maxW = zones.leftStrip.right.dp - left)
                        Column(Modifier.anchorRect("tools"), verticalArrangement = Arrangement.spacedBy(6.du)) {
                            for (row in buttons.chunked(perRow).reversed()) Row(horizontalArrangement = Arrangement.spacedBy(gap.coerceAtLeast(0.dp))) { row.forEach { it() } }
                        }
                    }
                }
            }

            // 0.4.60 Z1: the menu with the turn beside it, then the phase box, top right in the right strip (nothing in the top middle).
            val menuX = zones.menu.right.dp - 44.du; val menuY = zones.menu.y.dp
            val menuFocus = remember { FocusRequester() }
            Box(Modifier.offset(x = menuX, y = menuY).size(44.du).anchorRect("menu").clip(CircleShape).background(Color(0x6612141A)).border(1.dp, Color(0x24FFFFFF), CircleShape)
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
            Box(Modifier.offset(x = zones.menu.x.dp, y = menuY).width((menuX - 6.du - zones.menu.x.dp).coerceAtLeast(0.dp)).height(44.du).anchorRect("turn"), contentAlignment = Alignment.CenterEnd) {
                Text("Turn ${st.turn}", style = sans(sp(12f), FontWeight.Bold, if (st.activePlayer == st.viewer) Sky else Ember).copy(letterSpacing = .48.sp), maxLines = 1, softWrap = false)
            }
            PhaseTrack(st, stopLights(st), intents.stop, zones.phase.at().anchorRect("phasetrack"), d, width = zones.phase.w.dp, height = zones.phase.h.dp)

            // The stack, fanned on the right over its portal, with the arc to its source.
            // T6 (Arena clip 1): the card you are casting waits on top of the stack while it asks for its targets or its mana.
            val lane = laneStack(st)
            if (lane.isNotEmpty()) {
                // 0.4.60 Z1: the stack card stands in the right strip between the phase box and the buttons and never takes board width.
                // The card (104 × 145 du) and the words under it (8 + 22 du) shrink together to fit the strip; the height the strip has
                // to spare above them is where older cards fan up (BB10: their titles show whole), else they fold into "+N". With an
                // older card under the top one the strip keeps at least one 22 du step for it (T6: the Counterspell under your Bolt shows).
                // Z1 review: while Undo shows in its slot at the foot of the stack slot, the stack card stands above it.
                val undoShown = st.prompt == null && st.waitingOnMe && cancelLabel(st)?.startsWith("Undo", ignoreCase = true) == true
                val sz = zones.stackAbove(undoShown)
                val fit = minOf(1f, sz.w / 104.du.value, sz.h / (145.du + 30.du + (if (lane.size > 1) 22.du else 0.dp)).value)
                val fitSpare = (sz.h.dp - (145.du + 30.du) * fit).coerceAtLeast(0.dp)
                // Mobile table M5 (the brief's "stack card and the right strip"): on one screen the card stands at Arena's size (58 %
                // of the height on a phone, 43 % on a big screen) against the right strip, over the right end of the board; the board
                // does not move or shrink (walk line 27). Step aside: while a question is open and a legal target lies under it, it
                // drops to the size that fits the strip until the question is answered, so every target stays pickable.
                val fullH = H * ZoneLayout.stackShare(zones)
                val sFull = fullH / 145.du
                val fullX = zones.rightStrip.x.dp - 4.du - 104.du * sFull
                val fullY = (mid - fullH / 2).coerceIn(zones.window.y.dp + 8.du + (if (lane.size > 1) 22.du * sFull else 0.dp), ((zones.handTray?.y?.dp ?: (zones.window.bottom.dp - 8.du)) - (145.du + 30.du) * sFull).coerceAtLeast(zones.window.y.dp + 8.du + (if (lane.size > 1) 22.du * sFull else 0.dp)))
                val stackDensity = LocalDensity.current
                // Phone conflicts, 3: the card never rests on a creature tile either, question or not (the cast pop is its own card
                // and still shows full size).
                val asked = remember(st.revision, st, live) { (st.players.flatMap { p -> p.battlefield.filter { (it.isCreature || it.type.contains("Planeswalker")) && it.attachedTo == null }.map { it.id } } +
                    (if (live && st.prompt == null) st.selection.cards + st.selection.targetCards else emptySet())).toSet() }
                val fullBox = with(stackDensity) { androidx.compose.ui.geometry.Rect(fullX.toPx(), fullY.toPx(), (fullX + 104.du * sFull).toPx(), (fullY + (145.du + 30.du) * sFull).toPx()) }
                val stackAnchors = LocalAnchors.current
                val askedNow by androidx.compose.runtime.rememberUpdatedState(asked); val boxNow by androidx.compose.runtime.rememberUpdatedState(fullBox)
                // Where the tiles are comes from their anchors (written at layout): read through a derived state, so the board is
                // composed again only when the answer changes, not each time a tile moves.
                val under by remember(stackAnchors) { androidx.compose.runtime.derivedStateOf {
                    stackAnchors?.version?.intValue
                    askedNow.isNotEmpty() && stackAnchors != null && askedNow.any { id -> stackAnchors.rects["c$id"]?.overlaps(boxNow) == true } } }
                val full = !DualScreen.active && sFull > fit && !under
                val stackSpec = if (Motion.still) androidx.compose.animation.core.snap<Float>() else tween<Float>(200, easing = FastOutSlowInEasing)
                val big by animateFloatAsState(if (full) 1f else 0f, stackSpec, label = "stackSize")
                val s = fit + (sFull - fit) * big
                // Fold and tablets (Randall on the Fold, 12 Nov: the small card stood beside the hand, its words under the hand cards): at
                // strip size the card is centred on the middle line too, inside its slot; the room above it is the older cards'.
                val stripSpare = if (zones.phone || DualScreen.active) fitSpare else (mid - 145.du * fit / 2 - sz.y.dp).coerceIn(0.dp, fitSpare)
                val spare = stripSpare + (fullY - zones.window.y.dp - 8.du - stripSpare) * big
                val cardX = (sz.x.dp + (sz.w.dp - 104.du * fit) / 2).let { it + (fullX - it) * big }
                val cardY = (sz.y.dp + stripSpare).let { it + (fullY - it) * big }
                // The words under the top card end 16 dp inside the screen (the stack zone already does).
                // Z1 review: the fan is drawn smaller (s) to fit the strip, so its small touch targets (Yield, "+N") take taps in a box as big
                // on the screen as anywhere else: Compose's nearby-touch box (48 dp) is measured in the fan's own scaled units, so it grows by 1/s.
                val vc = androidx.compose.ui.platform.LocalViewConfiguration.current
                val fanVc = remember(vc, s) { object : androidx.compose.ui.platform.ViewConfiguration by vc {
                    override val minimumTouchTargetSize get() = androidx.compose.ui.unit.DpSize(vc.minimumTouchTargetSize.width / s, vc.minimumTouchTargetSize.height / s) } }
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalViewConfiguration provides fanVc) {
                    StackFan(if (lane === st.stack) st else st.copy(stack = lane), Modifier.offset(x = cardX - 44.du * s, y = cardY - 34.du * s)
                        .graphicsLayer { scaleX = s; scaleY = s; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0f) }, d, onInspect, live, intents.stack,
                        room = spare / s, labelMax = (W - 16.dp - cardX) / s, stepX = 0.dp)
                }
                StackArc(st, d)
            }

            // The hand: centred 44 du right of the middle (between your seat and the buttons), the middle card's top 67 du above the bottom.
            // T6: the card you cancelled comes back to the place it left, not to the end of its mana value.
            val leftAt = remember { HashMap<Int, Int>() }
            val lastHand = remember { arrayOf(emptyList<Int>()) }
            // Your own drag order wins: a drag forgets where a cancelled card came back to.
            val lastOrder = remember { arrayOf(handOrder) }
            if (lastOrder[0] != handOrder) { leftAt.clear(); lastOrder[0] = handOrder }
            val hand = returnToPlace(orderedHand(me.hand, handOrder), me.hand.map { it.id }.toSet(), lastHand[0], pendingCast(st)?.id, leftAt)
            lastHand[0] = hand.map { it.id }
            // The hand: 66 px cards on a phone; on a big board they grow with the screen (site: 109 px at 840 tall, 104 at 800).
            val handW = if (large) (H.value * .13f).coerceIn(66f, 120f).dp else 66.du
            val handAnchors = LocalAnchors.current
            // A controller: when A plays the last hand card, the ring goes to the gold button (else the menu button), so it isn't lost.
            val goldFocus = remember { FocusRequester() }
            // 0.4.60 Z5: on one screen the hand lies in a glass tray in the tray's band (ZoneLayout.hand): whole cards side by side, 6 du
            // apart, flat, inside the window (clear of the bottom edge and the navigation bar); a lifted card grows upward and never past
            // the window's top. The dual top has no tray (its hand is on the bottom screen, whose fan stays as it was).
            val trayHand = if (DualScreen.active) null else ZoneLayout.hand(zones, hand.size)
            // The fan itself, at any card width: on the table, or on a dual-screen handheld's bottom screen (MatchBottom).
            val fan: @Composable (Dp) -> Unit = { fanW ->
                HandFan(hand, fanW, Modifier.fillMaxWidth(), raised = selectedHand, angleDeg = if (trayHand != null) ZoneLayout.HAND_TILT else 1.2f, flatLift = DualScreen.active,
                    gap = trayHand?.gap?.dp ?: 4.dp, arc = if (trayHand != null) ZoneLayout.HAND_ARC.dp else 2.dp, pop = trayHand?.pop, liftRise = trayHand?.rise?.dp,
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
            // whose right end it measures) wherever the two share a height (0.4.60 Z1: the buttons stand bottom right on every board,
            // so on a big board too). With no line it takes the width its words need.
            val goldInset = 8.du
            val askAll = if (live) askLine(st) else null
            // 0.4.59 T6: the hand dips out of the way while you pick on the table, and the question takes its strip.
            val tucked = handTucked(st, live)
            val tuck by animateFloatAsState(if (tucked) 1f else 0f, if (Motion.still) androidx.compose.animation.core.snap() else tween(220, easing = FastOutSlowInEasing), label = "tuck")
            // The tucked buttons' widths, worked out from their words (GlassPill: 12.5 sp, 14 du each side) so the line's right end is
            // right in the very first frame.
            val tuckMeasurer = androidx.compose.ui.text.rememberTextMeasurer()
            val tuckBtnW = if (!tucked) 0.dp else with(LocalDensity.current) {
                val style = sans(sp(12.5f), FontWeight.SemiBold, Color.White)
                tuckLabels(st).maxOfOrNull { tuckMeasurer.measure(it, style, maxLines = 1).size.width.toDp() + 28.du + 2.dp } ?: 0.dp }
            // Two screens: a question the bottom asks is not said on the top too (live 0.4.57, fault list 4 and 14; table-info I5.1).
            val askText = if (dual && bottomAsk(st, live, askAll) != null) null else askAll
            var askRight by remember { mutableStateOf(Dp.Unspecified) }
            LaunchedEffect(askText == null) { if (askText == null) askRight = Dp.Unspecified }
            // Z1 review: a button keeps off every zone box beside it at its height (the board where it runs down beside the buttons, as
            // on the dual top, the hand tray, the hand chip's band): its width stops [gap] short of the nearest one's right edge, so it
            // never takes board width (on the Thor's top the gold button stays in the right strip, its label cut with … as BB8).
            fun clearOf(top: Dp, bottom: Dp, gap: Dp): Dp = listOfNotNull(zones.board, zones.handTray, zones.handChip)
                .filter { it.y.dp < bottom && it.bottom.dp > top }.maxOfOrNull { it.right.dp }?.let { (zones.actions.right.dp - gap - it).coerceAtLeast(0.dp) } ?: Dp.Infinity
            // The gold button with its turn ring (6 du out) and the quiet row above it (Z6: [btnH] tall, 6 du above the gold one's top),
            // the three-dot button ([btnH] square) at that row's right end when its menu has a line, the quiet pill left of it.
            val dotsShown = dotsMenu.isNotEmpty()
            val dotsW = if (dotsShown) btnH + 6.du else 0.dp
            val goldClear = clearOf(goldY - 6.du, goldY + btnH + 6.du, 8.du)
            val quietMax = (clearOf(goldY - 6.du - btnH, goldY - 6.du, 4.du) - dotsW).coerceAtLeast(0.dp)
            val askMax = if (askText != null && askRight != Dp.Unspecified) (W - goldInset - askRight - 12.du).coerceAtLeast(138.du) else Dp.Infinity
            val goldMax = minOf(goldClear, askMax)
            // With Attack all the gold button stands in the quiet one's row, and Attack all (a glass pill) 8 du into the gold one's.
            val upperGoldMax = (minOf(clearOf(goldY - 12.du - btnH, goldY + 8.du, 8.du), askMax) - dotsW).coerceAtLeast(0.dp)
            val attackAllMax = clearOf(goldY + 8.du, goldY + btnH, 4.du)
            // The hand chip (two screens) is centred on the hand; on a phone-sized table it shares the gold button's height and stops
            // 12 du short of where the gold button starts (BB8: "Discard Ultimate Magic: Mete…" ran under it).
            val goldDensity = LocalDensity.current
            val chipMax = ((W - goldInset - goldW - 12.du - (centreX + 44.du)) * 2).coerceAtLeast(120.du).let { m ->
                // Z1 review: on the dual top the chip has its own band under the board (zones.handChip) and stays inside it.
                zones.handChip?.let { b -> minOf(m, minOf(centreX + 44.du - (b.x.dp + 4.du + maxOf(dockW, 42.du * tools - 8.du) + 12.du), b.right.dp - centreX - 44.du) * 2) } ?: m }
            val handTop = H - handW / 66f * 67f
            if (trayHand != null) {
                val t = trayHand.tray; val f = trayHand.fan
                // M5: on the CPU's turn (and nothing asked of you) the hand sinks until 14 % of the height shows (9 % on a big screen).
                // M8: during a question it dips and dims but stays in view, and takes no taps.
                val sunk by animateFloatAsState(if (st.activePlayer != st.viewer && !live && !st.finished) 1f else 0f,
                    if (Motion.still) androidx.compose.animation.core.snap() else tween(260, easing = FastOutSlowInEasing), label = "handSunk")
                val tuckDip: androidx.compose.ui.graphics.GraphicsLayerScope.() -> Unit = {
                    translationY = maxOf(sunk * trayHand.sunk.dp.toPx(), tuck * AskTuck.DIP * t.h.dp.toPx())
                    if (tuck > 0f) alpha = 1f - tuck * (1f - AskTuck.SHADE) }
                // Nothing is drawn behind the hand (M5: no tray, no glass, no shade; each card has only its own shadow). The box is
                // the cards' reach: "hand" is where drawn cards fly to.
                Box(Modifier.offset(x = t.x.dp, y = t.y.dp).width(t.w.dp).height(t.h.dp)
                    .then(if (handAnchors != null) Modifier.onGloballyPositioned { val r = it.boundsInRoot(); handAnchors.putRect("hand", r); handAnchors.putRect("handTray", r) } else Modifier))
                Box(Modifier.offset(x = f.x.dp, y = f.y.dp).width(f.w.dp).height(f.h.dp).graphicsLayer(tuckDip)) {
                    fan(trayHand.cardW.dp)
                    if (tucked) Box(Modifier.matchParentSize().pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } })
                }
            } else Box(Modifier.offset(x = centreX + 44.du - handW / 66f * 222f, y = handTop).width(handW / 66f * 444f).height(handW / 66f * 120f)
                .then(if (handAnchors != null) Modifier.onGloballyPositioned { handAnchors.putRect("hand", it.boundsInRoot()) } else Modifier)
                .graphicsLayer { if (tuck > 0f) { translationY = tuck * AskTuck.DIP * (handW / 66f * 67f).toPx(); alpha = 1f - tuck * (1f - AskTuck.SHADE) } }) {
                // With the bottom screen up the hand lives there; the table keeps a small count where the fan was.
                if (!dual) fan(handW)
                if (!dual && tucked) Box(Modifier.matchParentSize().pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } })
                if (dual && hand.isNotEmpty()) {
                    // The hand's handle on the table: the d-pad lands here, left and right walk the hand on the bottom screen (the lifted
                    // card follows), A plays the lifted card when it can be played (else opens it), Y opens it (Randall 9 Nov: "d-pad should
                    // work better on the hand on the bottom screen").
                    val picked = hand.firstOrNull { it.id == selectedHand }
                    // While a discard asks, the chip shows the card the d-pad rests on; only A or a tap picks it (W12).
                    val lifted = if (discardAsk) picked ?: hand.firstOrNull { it.id == discardWalk } else picked
                    val playable = { c: Card -> castable(c) }
                    // Live 0.4.57: after a cast the next lift is where that card was, not card 1 (a land, and it moved with each draw).
                    fun restAt() = TablePad.handAt.coerceIn(0, hand.lastIndex)
                    fun step(dx: Int) {
                        if (discardAsk) { val i = hand.indexOfFirst { it.id == (discardWalk ?: selectedHand) }
                            discardWalk = hand[if (i < 0) (if (dx > 0) 0 else hand.lastIndex) else (i + dx).coerceIn(0, hand.lastIndex)].id; return }
                        val i = hand.indexOfFirst { it.id == selectedHand }
                        onSelectHand(hand[if (i < 0) (if (TablePad.handAt >= 0) restAt() else if (dx > 0) 0 else hand.lastIndex) else (i + dx).coerceIn(0, hand.lastIndex)].id) }
                    // A on the chip: the walked card is picked for discard, the same card again goes; otherwise it plays what is lifted, or opens it.
                    var chipOn by remember { mutableStateOf(false) }
                    val chipA = {
                        val c = lifted
                        // W11: what A met on the hand chip, so a Thor run shows why a press cast or only lifted (logcat -s PadA).
                        android.util.Log.i("PadA", "chip lifted=${c?.name} sel=$selectedHand discard=$discardAsk live=$live actionable=${c?.let { it.id in st.selection.actionable }} blocked=${c?.let { blocked[it.id] }} prompt=${st.prompt != null} input=${st.inputType}")
                        // Live 0.4.57: A here during a target prompt lifted a hand card; now it takes the ring to the first legal target.
                        if (targeting) { TableZones.toAsk("A on the hand chip") }
                        else if (discardAsk && live) {
                            when (val step = discardChipStep(c, selectedHand, hand, st.selection.cards)) {
                                is DiscardStep.Walk -> { discardWalk = step.id }
                                is DiscardStep.Pick -> onSelectHand(step.id)
                                is DiscardStep.Discard -> { onSelectHand(null); intents.card(step.id) }
                                is DiscardStep.Inspect -> hand.firstOrNull { it.id == step.id }?.let(onInspect)
                                null -> {}
                            }
                        } else if (c == null) onSelectHand(hand[restAt()].id)
                        else if (playable(c)) { TablePad.handAt = hand.indexOf(c); onSelectHand(null); if (chipOn && !c.isLand) { TablePad.castAt = android.os.SystemClock.uptimeMillis(); TablePad.castId = c.id }; intents.card(c.id) } else onInspect(c)
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
                    Row(Modifier.align(Alignment.TopCenter).padding(top = zones.handChip?.let { b -> (b.y.dp + 4.du - handTop).coerceAtLeast(0.dp) } ?: (handW / 66f * 30f)).widthIn(max = chipMax).anchorRect("handchip")
                        .focusRequester(chipFocus)
                        .onFocusChanged { if (chipOn != it.isFocused) android.util.Log.i("PadA", "chip focus=${it.isFocused} autoRing=${TablePad.autoRing} sel=$selectedHand"); if (chipOn != it.isFocused) liftLive = it.isFocused && selectedHand != null; chipOn = it.isFocused; if (it.isFocused) { TableZones.at = 0; TablePad.last = chipFocus; if (selectedHand == null && !discardAsk && !targeting && !TablePad.autoRing) onSelectHand(hand[restAt()].id); TablePad.autoRing = false } }
                        .onKeyEvent { e -> if (e.nativeKeyEvent.action != android.view.KeyEvent.ACTION_DOWN) return@onKeyEvent false
                            when (e.nativeKeyEvent.keyCode) {
                                android.view.KeyEvent.KEYCODE_DPAD_LEFT -> { if (targeting) TableZones.toAsk("left on the hand chip") else step(-1); true }
                                android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> { if (targeting) TableZones.toAsk("right on the hand chip") else step(1); true }; else -> false } }
                        .padActs(PadActs(a = if (targeting) "To target" else if (discardAsk && live) (if (lifted != null && lifted.id == selectedHand) "Discard" else "Pick") else (lifted?.let { if (playable(it)) (if (it.isLand) "Play land" else "Cast") else "Inspect" } ?: "Lift"), y = lifted?.let { c -> PadAct("Inspect") { onInspect(c) } }))
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
            // The visible Cancel pill is the last stop of the target walk (live 0.4.57), so it can take the ring.
            val cancelFocus = remember { FocusRequester() }
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
                // 0.4.60 Z6: the corner's words and presses (TableActions: the same branches as before, unit tested in TableActionsTest).
                // M3: your own spell or trigger resolves by itself and the button offers no press. If the table has still not
                // passed 2.5 s on (it never leaves you without a way on), the press comes back as "Resolve".
                val resolving = live && dev.cardstashy.nativeplay.match.AutoPass.resolvesItself(st, AppSettings.stopToRespond)
                var resolveLate by remember { mutableStateOf(false) }
                LaunchedEffect(st.revision, st.stack.firstOrNull()?.id, resolving) { resolveLate = false; if (resolving) { delay(RESOLVE_LATE_MS); resolveLate = true } }
                val corner = TableActions.of(st, live, selected, tucked, discardingNow, resolveLate)
                fun press(a: TableActions.Action): () -> Unit = when (a.press) {
                    TableActions.Press.OK -> ({ intents.ok() })
                    TableActions.Press.CANCEL -> ({ intents.cancel() })
                    TableActions.Press.PLAY -> ({ if (selected != null) { onSelectHand(null); intents.card(selected.id) } else intents.ok() })
                    TableActions.Press.ATTACK_ALL -> ({ intents.attackAll(offered.map { it.id }) })
                }
                // 0.4.60 Z1: the buttons stand in the right strip's bottom corner on every board (a big board's one row 180 above the
                // bottom ran across your back row once the board took the full height): the gold step at the bottom, the quiet one above
                // it, right edges 8 du in (the strip's padding), as the site's phone dock. Z6: the quiet row is [btnH] tall, 6 du above
                // the gold one, and stands left of the three-dot button when that shows ([dotsW]).
                val goldTop = goldY; val quietTop = goldTop - 6.du - btnH
                val edge = W - zones.actions.right.dp
                val upperM = Modifier.align(Alignment.TopEnd).offset(x = -(edge + dotsW), y = quietTop)
                // The quiet pill in that spot reports its width, so the phone's turn count can stand left of it.
                val quietM = upperM.onSizeChanged { quietW = with(goldDensity) { it.width.toDp() } }.anchorRect("quiet")
                val cancelM = if (targeting) quietM.focusRequester(cancelFocus) else quietM
                val lowerM = Modifier.align(Alignment.TopEnd).offset(x = -edge, y = goldTop)
                val attackM = Modifier.align(Alignment.TopEnd).offset(x = -edge, y = goldTop + 8.du)
                // Undo's own spot: never where End turn or the gold step was (U6), never on a pile or its count (BB11), never on the
                // stack's words. Z1 review: its slot in the right strip (zones.undo), at the foot of the stack slot, 16 du above the
                // quiet one's place; the stack card stands above it while it shows.
                val undoM = Modifier.align(Alignment.TopEnd).offset(x = -edge, y = zones.undo.y.dp)
                // The turn clock's last-10 count stands in the quiet one's row above the gold button: left of the quiet pill when there
                // is one (its right edge 12 du short of it), else at the right edge (where the quiet one would be). With Attack all the
                // gold button is itself in that row, so the count goes one row higher at the right edge.
                val pickOne = oneTarget(st) || onePick(st)
                // The quiet pill's width from its words (GlassPill: 12.5 sp, 14 du each side), so the count is clear of it in the first frame.
                val quietWords = corner.quiet?.label?.let { w -> with(goldDensity) {
                    tuckMeasurer.measure(w, sans(sp(12.5f), FontWeight.SemiBold, Color.White), maxLines = 1).size.width.toDp() + 28.du + 2.dp } } ?: 0.dp
                val quietShown = corner.kind != TableActions.Kind.ATTACK_ALL && corner.quiet != null
                val goldShown = !tucked && (!pickOne || attackAll || (st.selection.min == 0 && st.buttons.okEnabled))
                // 0.4.59 T6: while the hand is tucked the gold button gives way to a quiet Cancel in its spot; a confirm Forge offers
                // (several targets, "No target") stays as a glass pill above it. Both report their width for the line's right end.
                val tuckW = Modifier
                @Composable fun pair(content: @Composable () -> Unit) {
                    androidx.compose.runtime.CompositionLocalProvider(LocalTurnCountOutside provides true) { content() }
                    val countRight = W - edge - dotsW - (if (quietShown) maxOf(quietW, quietWords) + 12.du else 0.dp)
                    val countY0 = if (attackAll) quietTop - 8.du - 32.du else quietTop + (btnH - 32.du) / 2
                    // Z1 review: where that spot meets a zone box (on a phone the board's corner ends 2 du into the quiet row), the count
                    // drops to just under that box, at most touching the gold button's ring.
                    val zoneBoxes = listOfNotNull(zones.board, zones.handTray, zones.handChip)
                    fun meets(r: Dp, y: Dp) = zoneBoxes.filter { it.right.dp > r - 32.du && it.x.dp < r && it.y.dp < y + 32.du && it.bottom.dp > y }
                    val under = meets(countRight, countY0).maxOfOrNull { it.bottom.dp }?.takeIf { it + 32.du <= goldTop - 6.du + .5.dp }?.let { maxOf(it, countY0) }
                    // Z6 review: when that does not fit (the hand tray runs down beside the quiet row, crowded 884x796), the count
                    // slides right to clear the box by 4 du if it still keeps 12 du off the quiet pill and inside the window; else it
                    // goes one row higher at the right edge, as with Attack all.
                    val clash = meets(countRight, countY0)
                    val slid = clash.maxOfOrNull { it.right.dp }?.let { it + 4.du + 32.du }
                        ?.takeIf { r -> r <= W - edge - dotsW && meets(r, countY0).isEmpty() && (!quietShown || r + 12.du <= W - edge - dotsW - maxOf(quietW, quietWords)) }
                    val (countX, countY) = when {
                        clash.isEmpty() -> countRight to countY0
                        under != null -> countRight to under
                        slid != null -> slid to countY0
                        else -> (W - edge - dotsW) to (quietTop - 8.du - 32.du)
                    }
                    if (goldShown) TurnCount(d.u, Modifier.align(Alignment.TopEnd).offset(x = -(W - countX), y = countY))
                }
                padX = when {
                    attackAll -> if (live && okOn) PadAct(ok) { intents.ok() } else null
                    oneTarget(st) || onePick(st) -> if (live && st.selection.min == 0 && st.buttons.okEnabled) PadAct("No target") { intents.ok() } else null
                    short && second != null -> if (live) PadAct(second) { intents.cancel() } else null
                    endTurnGold -> if (live) PadAct(ok) { intents.cancel() } else null
                    // An "up to N" discard Forge lets you finish keeps its OK (only a must-discard waits for a pick).
                    discardingNow && selected == null && !okOn -> null
                    else -> if (live && (selected != null || okOn)) PadAct(ok) { if (selected != null) { onSelectHand(null); intents.card(selected.id) } else intents.ok() } else null
                }
                // M3: nothing to press while your own spell or trigger resolves by itself.
                if (corner.gold?.label == RESOLVING) padX = null
                // S3: the controller's X is the gold button's press: it dips and sounds as under a finger.
                if (corner.gold != null) padX = padX?.let { x -> PadAct(x.label, x.run?.let { run -> { GoldPress.pulse.intValue++; run() } }) }
                val goldM = lowerM.focusRequester(goldFocus).anchorRect("gold").onSizeChanged { goldW = with(goldDensity) { it.width.toDp() } }
                pair {
                    when (corner.kind) {
                        TableActions.Kind.TUCKED -> {
                            corner.quiet?.let { GlassPill(it.label, it.enabled, lowerM.then(tuckW).focusRequester(cancelFocus).anchorRect("quiet").anchorRect("cancel"), d, maxW = goldClear, height = btnH, onClick = press(it)) }
                            corner.confirm?.let { GlassPill(it.label, it.enabled, upperM.then(tuckW).focusRequester(goldFocus).anchorRect("confirm"), d, tone = Color(0xFFF3D27E), edge = Color(0x66F3D27E), maxW = quietMax, height = btnH, onClick = press(it)) }
                        }
                        TableActions.Kind.ATTACK_ALL -> {
                            corner.gold?.let { GoldPill(it.label, it.enabled, upperM.focusRequester(goldFocus).anchorRect("gold").onSizeChanged { goldW = with(goldDensity) { it.width.toDp() } }, d, padKey = padX != null, maxW = upperGoldMax, height = btnH, onClick = press(it)) }
                            corner.extra?.let { GlassPill(it.label, it.enabled, attackM, d, tone = Color(0xFFFFD9CF), edge = Color(0x88FF8A6A), maxW = attackAllMax, onClick = press(it)) }
                        }
                        TableActions.Kind.PICK_ONE -> {
                            corner.quiet?.let { GlassPill(it.label, it.enabled, cancelM, d, maxW = quietMax, height = btnH, onClick = press(it)) }
                            corner.gold?.let { GoldPill(it.label, it.enabled, goldM, d, padKey = padX != null, maxW = goldMax, height = btnH, onClick = press(it)) }
                        }
                        TableActions.Kind.SHORT, TableActions.Kind.END_TURN -> {
                            corner.quiet?.let { GlassPill(it.label, it.enabled, quietM, d, maxW = quietMax, height = btnH, onClick = press(it)) }
                            corner.gold?.let { GoldPill(it.label, it.enabled, goldM, d, padKey = padX != null, maxW = goldMax, height = btnH, onClick = press(it)) }
                        }
                        TableActions.Kind.PLAIN -> {
                            // Forge turns its cancel from End turn into "Undo" once a land or a mana tap can be taken back
                            // (InputPassPriority.showMessage), and then cancel undoes. Drawn in End turn's place, a tap meant for End turn
                            // took the land back (U6), so Undo stands in its own spot and ignores taps for its first 400 ms.
                            val undo = corner.undo
                            val shownAt = remember(undo?.label) { android.os.SystemClock.uptimeMillis() }
                            undo?.let { GlassPill(it.label, it.enabled, undoM.anchorRect("undo"), d, maxW = zones.undo.w.dp) {
                                if (android.os.SystemClock.uptimeMillis() - shownAt >= 400) intents.cancel() } }
                            corner.quiet?.let { GlassPill(it.label, it.enabled, cancelM, d, maxW = quietMax, height = btnH, onClick = press(it)) }
                            corner.gold?.let { GoldPill(it.label, it.enabled, goldM, d, padKey = padX != null, maxW = goldMax, height = btnH, onClick = press(it)) }
                        }
                    }
                }
            }
            // 0.4.60 Z6: the three-dot button at the quiet row's right end (beside End turn), whenever its menu has a line (Yield while an
            // ability is on top of the stack, whoever's priority it is); its menu opens above it. A controller opens it with LT and its
            // first line takes the ring, so Yield is two presses (LT, A); a finger, two taps.
            if (dotsShown) {
                val dotsTop = goldY - 6.du - btnH
                val dotsEdge = W - zones.actions.right.dp
                DotsButton(dotsOpen, Modifier.align(Alignment.TopEnd).offset(x = -dotsEdge, y = dotsTop).anchorRect("dots"), btnH, d) { dotsByPad = false; dotsOpen = !dotsOpen }
                if (dotsOpen) {
                    // A tap anywhere else closes it; so does a controller's B (a phone with no pad keeps its back as it was).
                    Box(Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { dotsOpen = false } })
                    androidx.activity.compose.BackHandler(Pad.connected.collectAsState().value) { dotsOpen = false }
                    PadScreen(PadActs(b = "Close", opaque = true))
                    DotsMenu(dotsMenu, Modifier.align(Alignment.BottomEnd).offset(x = -dotsEdge, y = -(H - dotsTop + 6.du)).anchorRect("dotsmenu"), dotsFocus, d) { item ->
                        dotsOpen = false
                        if (item.key == TableActions.YIELD) st.stack.firstOrNull()?.let { top -> intents.yieldSource(top.id, !top.yielded) }
                    }
                    LaunchedEffect(Unit) { if (dotsByPad) { androidx.compose.runtime.withFrameNanos { }; runCatching { dotsFocus.requestFocus() } } }
                }
            }
            // The table's controller buttons: X the gold button, Start the menu (the same toggle as its button). A hand card or permanent adds its own A and Y.
            // LB/RB step through your hand (lifting each card: on a dual screen's bottom, or the table's own fan); RT is the gold button
            // (pass, resolve, confirm), LT the quiet one (cancel) — specs/dual-screen-native.md's match map.
            val padGold = padX
            val castCancel = padAsking && st.buttons.cancelEnabled
            // The stops of the target walk: target cards (theirs, then yours), target players, then the Cancel pill when it is shown.
            val targetStops = {
                val sel = st.selection
                val on = sel.targetCards.mapNotNull { TableZones.theirs[it] } + sel.targetCards.mapNotNull { TableZones.mine[it] } +
                    sel.players.filter { it in sel.targetPlayers }.sortedBy { it == st.viewer }.mapNotNull { TableZones.orbs[it] }
                // A spell on the stack (a counter) or a card off the table has no stop here: no walk, so the d-pad can still reach it
                // instead of sitting on Cancel.
                if (sel.stackTargets.isNotEmpty() || on.isEmpty()) emptyList<FocusRequester>()
                else on + listOfNotNull(cancelFocus.takeIf { st.waitingOnMe && cancelLabel(st) != null })
            }
            val stopsNow by androidx.compose.runtime.rememberUpdatedState(targetStops)
            // Only while the ring is on the table (or nowhere): an open menu, dock or card keeps its own d-pad.
            fun steerTargets(step: Int): Boolean = if (TablePad.held || (PadPrompts.anyFocus && !TableZones.ringIn)) false else TableZones.steer(stopsNow(), step)
            PadScreen(PadActs(x = padX, start = PadAct("Menu") { if (menu != null) menu.open = !menu.open else onMenu() },
                // On two screens d-pad left/right on the hand chip already walks the hand, so the shoulders jump between zones instead.
                // While targets are asked they walk the legal targets only (spec "Match, targeting").
                tabs = if (targeting) ({ step: Int -> steerTargets(step) }) else if (dual) ({ step: Int -> TableZones.jump(step) }) else if (hand.isEmpty()) null else ({ step: Int ->
                    val i = hand.indexOfFirst { it.id == selectedHand }
                    val next = if (i < 0) (if (step > 0) 0 else hand.lastIndex) else (i + step).coerceIn(0, hand.lastIndex)
                    onSelectHand(hand[next].id) }), tabsLabel = if (targeting) "Targets" else if (dual) "Zone" else "Hand",
                // RT (Randall 9 Nov): between your hand and the field; X is already the gold button (pass). LT cancels only a cast you
                // started, while it asks for targets or mana (spec "Match, targeting: LT cancel"), on a fresh press. At plain priority
                // Forge's cancel is End turn or Undo, and LT ended the turn or took a land back with no word (live 0.4.57): there it does nothing.
                // 0.4.60 Z6: when LT has nothing to cancel and the three-dot menu has a line (Yield), LT opens it with its first line
                // ringed, so A on it is the second press.
                page = if (dual) ({ step: Int -> if (step > 0) TableZones.handOrField() else if (castCancel && PadPrompts.keyRepeat == 0) intents.cancel()
                        else if (dotsMenu.isNotEmpty() && PadPrompts.keyRepeat == 0) { dotsByPad = true; dotsOpen = true } })
                    else if (!live) null else ({ step: Int -> if (step > 0) padGold?.run?.invoke() else if (castCancel && PadPrompts.keyRepeat == 0) intents.cancel()
                        else if (dotsMenu.isNotEmpty() && PadPrompts.keyRepeat == 0) { dotsByPad = true; dotsOpen = true } }),
                pageLabel = if (dual) (if (castCancel) "Cancel cast · Hand/Field" else if (dotsMenu.isNotEmpty()) "More · Hand/Field" else "Hand / Field")
                    else if (castCancel) "Cancel cast / Pass" else if (dotsMenu.isNotEmpty()) "More / Pass" else "Pass"))
            // V4 a controller's cast: what Forge asks next takes the ring. While it asks for targets, the first legal one (the
            // opponent's cards first, then a player), where A picks; while it asks for mana, a source that pays, where A taps it
            // (X still pays automatically). RT finds the same spot; when the cast is done the ring goes back to the hand chip.
            val padAsk: () -> FocusRequester? = {
                val sel = st.selection
                when {
                    !live || st.prompt != null -> null
                    st.inputType == "InputSelectTargets" -> sel.targetCards.firstNotNullOfOrNull { TableZones.theirs[it] }
                        ?: sel.targetCards.firstNotNullOfOrNull { TableZones.mine[it] }
                        // Only a player who is a target: an orb that is not one cannot take the ring (live 0.4.57).
                        ?: sel.players.filter { it in sel.targetPlayers }.sortedBy { it == st.viewer }.firstNotNullOfOrNull { TableZones.orbs[it] }
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
            // The d-pad on a target prompt (live 0.4.57: a spatial walk reached the menu and the emblems): the legal targets in
            // padAsk's order, then the visible Cancel pill, round again. One stop refusing the ring is passed over.
            androidx.compose.runtime.DisposableEffect(targeting) {
                val s: (Int) -> Boolean = { k -> steerTargets(k) }
                if (targeting) PadPrompts.steer = s
                // 0.4.59 T6: the left stick snaps the ring to the nearest legal target the way it is pushed (the d-pad's list, no free cursor).
                val snap: (Offset) -> Boolean = snap@{ dir ->
                    if (TablePad.held || (PadPrompts.anyFocus && !TableZones.ringIn)) return@snap false
                    val a = handAnchors ?: return@snap false
                    val sel = st.selection
                    val stops = sel.targetCards.mapNotNull { id -> (TableZones.theirs[id] ?: TableZones.mine[id])?.let { r -> a.rects["c$id"]?.let { r to it } } } +
                        sel.players.filter { it in sel.targetPlayers }.mapNotNull { id -> TableZones.orbs[id]?.let { r -> a.rects["orb$id"]?.let { r to it } } }
                    val from = stops.firstOrNull { it.first === TablePad.last }?.second?.center ?: a.rects["hand"]?.center ?: return@snap false
                    TableZones.nearest(from, dir, stops.filter { it.first !== TablePad.last })?.let { TableZones.snapTo(it) } ?: false
                }
                if (targeting) PadCursor.snap = snap
                // The arc goes with the question: the next one starts with none until a press or the ring gives it one.
                onDispose { if (PadPrompts.steer === s) PadPrompts.steer = null; if (PadCursor.snap === snap) PadCursor.snap = null; TableAim.key = null }
            }
            LaunchedEffect(padAsking, st.inputType) {
                if (!Pad.connected.value || TablePad.held) {
                    if (padAsking) android.util.Log.i("PadA", "ask jump skipped held=${TablePad.held} connected=${Pad.connected.value}")
                    return@LaunchedEffect
                }
                androidx.compose.runtime.withFrameNanos { }
                if (padAsking) TableZones.toAsk("cast")
                // The cast is done: back to the hand chip, put there by the table, so it lifts nothing (live 0.4.57 lifted card 1).
                else if (TableZones.jumped) { TableZones.jumped = false; TableZones.toHand() }
            }
            // 0.4.59 T3: the open sheet, kept as a key and read from the table as it is now; it closes when what was opened is gone.
            open?.let { o -> if (sheetOf(st, o, live) == null) LaunchedEffect(o) { open = null } }
            // The view reads the open key itself, so the bottom screen (its own composition) redraws when it changes.
            val sheetView: @Composable () -> Unit = {
                open?.let { o -> sheetOf(st, o, live) }?.let { sheet ->
                    TableSheetView(sheet, { id -> open = Open.Grave(id) }, { c -> tapOf(c)?.invoke() }, onInspect, { open = null; openedForAsk = false; TablePad.restore() }, bottom = dual) }
            }
            // Two screens: the sheet lies over the bottom screen's lower half, under the hand; the top screen does not change.
            if (dual) { val goldAct = padX; BottomScreen { Box(Modifier.fillMaxSize()) { MatchBottom(st, hand, (selectedHand ?: discardWalk.takeIf { discardAsk })?.let { id -> hand.firstOrNull { it.id == id } }, goldAct, fan, onInspect, afk,
                ask = askAll, carried = carried?.let { id -> hand.firstOrNull { it.id == id } }, live = live, canPlay = { castable(it) }, why = { dimWhy(it) },
                // 0.4.60 G5: the ring on a tile on the top screen: the bottom's panel reads that card and its keywords.
                ringed = ringedTile.id?.let { id -> st.card(id)?.takeIf { it.zone == "Battlefield" } },
                onAnswer = { a -> a.card?.let { intents.card(it.id) } ?: a.player?.let { intents.player(it) } },
                onCancel = st.buttons.takeIf { it.cancelEnabled }?.let { { intents.cancel() } }); sheetView() } } }
            // With the bottom screen up the hand chip sits where the line would be: the line goes just above the chip, high enough
            // that its 10 du drop shadow (AskLine) clears the chip too (U3).
            // "Respond to X?" follows M1 on one screen (design thread, 12 Nov): a plain line on the middle line, never a plate over
            // the hand cards you would answer with.
            val parts = if (tucked) askParts(st) else askText?.takeIf { !dual && it.startsWith("Respond to ") }?.let { AskParts(null, it) }
            if (parts != null) {
                // Mobile table M1: the question is one plain line on the middle of the table, between the rows and beside the targets
                // (it was a pill in the hand's strip): centred on the board, ending left of the stack card at its full size.
                val left = zones.board.x.dp + 8.du
                val right = if (lane.isNotEmpty()) zones.rightStrip.x.dp - 4.du - 104.du * (H * ZoneLayout.stackShare(zones) / 145.du) - 10.du else zones.board.right.dp - 8.du
                TuckedAskLine(parts, left, right, mid, d, big = !zones.phone)
            } else askText?.let { val askBottom = if (dual && hand.isNotEmpty()) H - handW / 66f * 37f - 16.du else null
                AskLine(it, W, H, d, bottom = askBottom, goldInset = goldInset, leftLimit = if (askBottom != null) trayRight + 12.du else null) { r -> askRight = r } }
            // The line between the halves turns into the combat line while you declare (gold attacking, blue blocking).
            CombatLine(st, mid, W, d)
            // Arrivals, casts, hits, deaths and numbers over the cards, under the threads.
            FxLayer()
            // 0.4.59 T5: the card itself on its way to the stack, its slot, its host or its group.
            TravelCard()
            // Arrows: attackers to what they attack, blockers to their attacker, your spell to its targets, the top of the stack to its own.
            Arrows(st, live, intents, d)
            if (blockingNow) DragLine(blockDrag, d)
            overlay?.invoke(W)
            // T3, one screen: the sheet over the lower 56 % of the table (on two screens it is on the bottom screen, above).
            if (!dual) sheetView()
            // The order dialog, a damage split and the zone picker sit over the table; the CPU's line waits under them.
            val covered = live && dev.cardstashy.nativeplay.match.AutoPass.triggerOrder(st, AppSettings.askTriggerOrder) == null && st.prompt?.let { p -> p.method == "order" || p.method.startsWith("assign") || p.options.any { it.zone in setOf("Library", "Graveyard", "Exile") } } == true
            if (!covered) EmoteLayer(W, H, d)
            // The deck tracker under the table controls on the left; the menu over everything.
            if (menu != null) {
                // History & stack: the story is kept on every state, the panel shows while it is open.
                LaunchedEffect(st) { menu.story.take(st) }
                if (menu.history) HistoryPanel(st, menu.story, onInspect, { menu.history = false }, u)
            }
            if (menu != null) { DeckTracker(st, menu, H, d, menuX + 44.du - 210.du, menuY + 44.du + 10.du); if (menu.open) MenuPanel(menu, st.stack.size, d, menuX + 44.du - 220.du, menuY + 44.du + 8.du) }
        }
    }
    }
}

/** A tile's name as fitted: its size and lines, whether it had to be shortened ([cut], shown with an ellipsis), and the words shown. */
private data class NameFit(val size: Float, val lines: Int, val cut: Boolean, val text: String, val newLine: Boolean = false)
/** M5, a phone: the least of each land pile that shows when the shelf's piles overlap (dp). */
internal const val SHELF_SHOW = 20f
/** forge-table.mjs laneFor: creatures in the front row; lands, then the "other" lane (artifacts, enchantments, planeswalkers, battles) in the back row. */
private fun lands(cards: List<Card>) = cards.filter { it.isLand && !it.isCreature && it.attachedTo == null }
private fun backOthers(cards: List<Card>) = cards.filter { !it.isLand && !it.isCreature && it.attachedTo == null && !isWalker(it) }
/** Mobile table M14: a planeswalker (not one that is also a creature, which fights in the creature row). */
internal fun isWalker(c: Card) = c.type.contains("Planeswalker") && !c.isCreature && !c.isLand && c.attachedTo == null
internal fun walkers(cards: List<Card>) = cards.filter(::isWalker)
/**
 * M14 (specs/mobile-table-arena-parity-brief.md; placement seen in Arena, phone sizes the brief's): a planeswalker stays a whole
 * upright card at the right end of its owner's side, several in a column, its loyalty in a shield on its bottom edge.
 */
internal object Walkers {
    /** The card's height as a share of the screen's: a phone, a big screen. */
    const val PHONE = .24f; const val BIG = .17f
    /** A card's width over its height. */
    const val WIDE = .716f
    /** Between two cards of a column (the upper card's shield hangs in it), and from the board's right edge (du). */
    const val GAP = 14f; const val INSET = 10f
    /** A column of [n] cards in [roomH]: each card's height (never taller than [full]) and the column's top, centred on [centre] while it fits. */
    fun column(n: Int, full: Float, top: Float, bottom: Float, centre: Float, gap: Float): Pair<Float, Float> {
        val h = minOf(full, ((bottom - top) - gap * (n - 1)) / n).coerceAtLeast(1f)
        val total = h * n + gap * (n - 1)
        return h to (centre - total / 2).coerceIn(top, maxOf(top, bottom - total))
    }
}
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

/**
 * T6, Cancel: the card you were casting goes back to the place it left in [ordered]. [leftAt] remembers, for the card waiting on the
 * stack ([pending]), its index in the hand as last shown ([was]); while it is back in the hand it keeps that index, and the
 * entry goes once it leaves the hand again for any other reason.
 */
internal fun returnToPlace(ordered: List<Card>, inHand: Set<Int>, was: List<Int>, pending: Int?, leftAt: MutableMap<Int, Int>): List<Card> {
    if (pending != null && pending !in inHand && pending in was) leftAt[pending] = was.indexOf(pending)
    leftAt.keys.retainAll { it == pending || it in inHand }
    val back = ordered.filter { it.id in leftAt }
    if (back.isEmpty()) return ordered
    val out = ordered.filter { it.id !in leftAt }.toMutableList()
    for (c in back.sortedBy { leftAt.getValue(it.id) }) out.add(leftAt.getValue(c.id).coerceIn(0, out.size), c)
    return out
}

// ---- Battlefield ----

/**
 * One row of permanents, centred on [cx] with its middle at [cy]. Identical permanents pile ([pilesOf], ×N, fanned sideways);
 * everything else stands alone [gap] apart. 0.4.60 Z2: a row wider than [room] never shrinks: its gaps close, then its piles
 * overlap from the right like a fan, each later pile over the one before (TableGeometry.layRow). [squeezed]: the tiles are cropped
 * narrow, so a name may take three lines.
 */
@Composable
private fun PermanentRow(cards: List<Card>, land: Boolean, split: Int = 0, cx: Dp, cy: Dp, room: Dp, d: Du, markOf: (Card) -> Mark, tapOf: (Card) -> (() -> Unit)?, onInspect: (Card) -> Unit, mine: Boolean = false, lookup: (Int) -> Card? = { null }, piece: Dp? = null,
                         tile: Pair<Dp, Dp>? = null, fromLeft: Boolean = false, advance: Dp? = null,
                         /** T3: a tap or long press on a pile with no game action opens it (G3: the whole pile; a lone card opens CardInspect). */
                         onPile: ((List<Card>) -> Unit)? = null, gap: Dp? = null, squeezed: Boolean = false,
                         /** M13: a back row's permanents that are neither land nor creature stand at its right end, the mirror of the lands. */
                         looseRight: Boolean = false) = with(d) {
    if (cards.isEmpty()) return@with
    val piles = pilesOf(cards, split, markOf, tapOf)
    // The second lane (site: +22 px between lanes) starts at the first pile past the lands.
    val laneAt = piles.indexOfFirst { p -> cards.indexOf(p.first()) >= split }.takeIf { split in 1 until cards.size } ?: -1
    // A big board: creatures piece·1.18 × piece·.9, other permanents piece·.98 × piece·.68; a pile overlaps by piece·.8 (·.6); lanes 22 apart.
    val w = tile?.first ?: if (piece != null) (if (land) piece * .98f else piece * 1.18f) else if (land) 42.du else 50.du
    val h = tile?.second ?: if (piece != null) (if (land) piece * .68f else piece * .9f) else if (land) 29.du else 38.du
    // Table additions 2: a pile's cards sit 9 px right and 6 px up of the one under them, at most 4 edges showing.
    // T2: a pile fans sideways as wide as the row has room for (TableGeometry.fanStep), so it shows what is in it; no rise.
    // Z2: the row's layout (fan, gaps, overlap) comes from TableGeometry.layRow; the tiles keep their height.
    val lay = TableGeometry.layRow(w.value, h.value, room.value, piles.map { it.size }, land, laneAt,
        // A land narrower than a finger (a phone's CPU lands): its neighbour stands a touch target away while the row has the room.
        (gap ?: (w * TableGeometry.GAP)).let { if (land && tile != null) maxOf(it, TextFloors.TOUCH.dp - w) else it }.value,
        rightFrom = if (!looseRight || !land) -1 else if (split == 0) 0 else laneAt)
    val step = w * lay.fan
    val rise = if (tile != null) 0.dp else if (piece != null) 6.dp else 6.du
    val total = lay.total.dp
    // Z2: while piles overlap, only the left part of each pile's top tile shows: its name keeps to it and its P/T moves to its left edge.
    val visible = lay.visible?.dp
    // F6: a row with an attacker in a strike is drawn over the other rows, and that attacker over its own row.
    val strikers = LocalBattlefield.current?.let { it.strikers.value + it.landers.value }.orEmpty()
    Box(Modifier.offset(x = if (fromLeft) cx else cx - total / 2, y = cy - h / 2).zIndex(if (cards.any { it.id in strikers }) 50f else 0f)) {
        piles.forEachIndexed { i, pile ->
            val px = lay.xs[i].dp
            // Each later pile lies over the one before (overlap from the right); inside a pile, each card over the one under it.
            val z = i * 30f
            pile.forEachIndexed { j, card ->
                key(card.id) {
                    // Cards below the four showing edges hide under the bottom one; a card joining or leaving a pile re-lays out in 260 ms.
                    val e = pileEdge(j, pile.size)
                    val ax by androidx.compose.animation.core.animateDpAsState(px + step * e, tween(260, easing = FastOutSlowInEasing), label = "px")
                    // Every pile's top card sits on the row's line (three rises up, as the rows were tuned); the cards under it hang below.
                    val ay by androidx.compose.animation.core.animateDpAsState(-rise * (e + (PILE_EDGES - 1) - pileEdge(pile.lastIndex, pile.size)), tween(260, easing = FastOutSlowInEasing), label = "py")
                    // T4 (aura look A): a creature's auras peek above it as strips, drawn under its tile.
                    if (tile != null && pile.size == 1) aurasOn(card, lookup).takeIf { it.isNotEmpty() }?.let { auras ->
                        AuraStrips(card, auras, w, h, advance, mine, Modifier.offset(x = ax, y = ay).zIndex(z - 1f), d) }
                    val top = j == pile.lastIndex
                    Tile(card, w, h, land, markOf(card), mine, lookup, tapOf(card), if (onPile != null) { _ -> onPile(pile) } else onInspect, Modifier.offset(x = ax, y = ay).zIndex(z + j + (if (card.id in strikers) 5000f else 0f)), d,
                        count = if (top && pile.size > 1) pile.size else 1, piece = piece, pileTop = top, advance = advance,
                        visibleW = if (top && i < piles.lastIndex) visible else null, squeezed = squeezed)
                }
            }
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

/**
 * T4: the auras on [card] that show (Forge's attachments whose type says Aura and whose face is up). Mobile table M13: equipment
 * sits behind its permanent the same way (it was a corner badge).
 */
internal fun aurasOn(card: Card, lookup: (Int) -> Card?): List<Card> =
    card.attachments.mapNotNull(lookup).filter { !it.hidden && BEHIND.containsMatchIn(it.type) }
/** What sits behind the permanent it is on, as a strip with its name bar (M7, M13). */
internal val BEHIND = Regex("\\b(?:Aura|Equipment)\\b")

/**
 * T4 (specs/table-look-0459.md, aura look A, Randall 10 Nov): each aura on a creature is a strip behind its tile, raised
 * TableGeometry.STRIP of the tile's height per aura, its name bar over a sliver of its art; the creature's art and numbers stay clear.
 * Two strips at most, the upper one saying "+N" for the rest. The strips turn and step with the tile (tapped, attacking).
 */
@Composable
private fun AuraStrips(card: Card, auras: List<Card>, w: Dp, h: Dp, advance: Dp?, mineSide: Boolean, modifier: Modifier, d: Du) = with(d) {
    val turn by animateFloatAsState(if (card.tapped) 20f else 0f, tapSpec(card.id), label = "auraTap")
    val stepUp by attackStep(card)
    val shown = auras.take(TableGeometry.STRIPS_MAX); val n = shown.size; val more = auras.size - n
    val anchors = LocalAnchors.current
    // 0.4.59 T5: an aura on its way from the stack (TravelCard) shows its strip once it has arrived.
    val coming = LocalTravel.current?.travel?.takeIf { it.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_HOST && LocalBattlefield.current?.reduced != true }?.cardId
    Box(modifier.size(w, h).graphicsLayer { rotationZ = turn; attackLayer(card.tapped, stepUp, mineSide, advance?.toPx() ?: (12f * u * density)) }) {
        // The name bar takes about 60 % of the 15 % that shows, so a sliver of the aura's art shows under it; on a small tile
        // (a phone) the bar takes the whole of it, up to 10 dp, so the name stays readable.
        val bar = maxOf(h * .095f, minOf(h * TableGeometry.STRIP, 10.dp))
        shown.forEachIndexed { i, a ->
            val shape = RoundedCornerShape(6.du)
            Box(Modifier.offset(x = w * .04f, y = -h * (TableGeometry.STRIP * (n - i)))
                .size(w * .92f, h * .6f)
                .graphicsLayer { if (a.id == coming) alpha = 0f }
                .then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("aura${a.id}", it.boundsInRoot()) } else Modifier)
                .drawBehind { drawRoundRect(Color(0x99000000), topLeft = Offset(0f, 3.dp.toPx()), size = size, cornerRadius = CornerRadius(6.du.toPx())) }
                .clip(shape).background(Color(0xFF141418)).border(1.dp, Color(0x33E8D3A0), shape)
                .semantics { contentDescription = "${a.name} on ${card.name}" }) {
                CardImage(a.name, Modifier.fillMaxSize(), crop = true)
                Row(Modifier.fillMaxWidth().height(bar).background(Color(0xF0281E08)).padding(horizontal = 5.du), verticalAlignment = Alignment.CenterVertically) {
                    Text(a.name, style = sans((bar.value * .7f).sp, FontWeight.ExtraBold, Color(0xFFE8C77A)), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    if (i == 0 && more > 0) Text("+$more", style = sans((bar.value * .7f).sp, FontWeight.ExtraBold, Color.White), maxLines = 1)
                }
            }
        }
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
private fun Tile(card: Card, w: Dp, h: Dp, land: Boolean, mark: Mark, mineSide: Boolean, lookup: (Int) -> Card?, onTap: (() -> Unit)?, onInspect: (Card) -> Unit, modifier: Modifier, d: Du, count: Int = 1, piece: Dp? = null, pileTop: Boolean = true,
                 /** How far an attacker steps toward the other side (12 du unless the rows are closer: TableGeometry.advance). */
                 advance: Dp? = null,
                 /** 0.4.60 Z2: how much of this tile shows while the next pile lies over its right part (null: all of it). */
                 visibleW: Dp? = null,
                 /** 0.4.60 Z2: the tile is cropped narrow (TableGeometry.Tiles.squeezed): its name may take three lines, not two. */
                 squeezed: Boolean = false,
                 /** M14: the whole upright card (a planeswalker), no name strip of its own, its loyalty in a shield on its bottom edge. */
                 whole: Boolean = false) = with(d) {
    val (a, _) = frameTone(cardColors(card))
    // play-forge-table.css: a role's ring and glow (playable/choice #5cc8ff, target #ff9d5c, chosen #f3d27e), combat over it (attacking #ff6a4a, blocking #6aaeff).
    val combat = card.attacking || card.blocking
    // M2: an offered target says whose it is while the question offers both sides: blue for yours, red for the CPU's.
    val side = LocalSideTags.current[card.id]
    val role: Triple<Color, Float, Color>? = when {
        side != null && mark != Mark.PICKED -> if (side) Triple(SideYours, 2.5f, Color(0x8C5CC8FF)) else Triple(SideCpu, 2.5f, Color(0x8CFF5A4A))
        card.attacking -> Triple(Color(0xFFFF6A4A), 2f, Color(0x99FF5A3A))
        card.blocking -> Triple(Color(0xFF6AAEFF), 2f, Color(0x995A9CFF))
        mark == Mark.PICKED -> Triple(Color(0xFFF3D27E), 2.5f, Color(0x8CF3D27E))
        mark == Mark.TARGET -> Triple(Color(0xFFFF9D5C), 2f, Color(0x8CFF9D5C))
        mark == Mark.DISCARD -> Triple(Color(0xFFFF7A6B), 2f, Color(0x8CFF6A5A))
        mark == Mark.PLAYABLE || mark == Mark.PICKABLE -> Triple(Ice, 2f, Color(0x8C5CC8FF))
        // M14: a planeswalker Forge offers an ability for wears the blue rim.
        whole && mark == Mark.USABLE -> Triple(Ice, 2f, Color(0x8C5CC8FF))
        else -> null
    }
    val ring = role?.first ?: lerp(a, Color.White, .15f)
    // glow-rules.md: the usable ring (violet, dashed, 7 dp outside) steps back while a hand card is carried; the payment light shows then.
    val usableRing = mark == Mark.USABLE && !LocalHandCarry.current && !whole
    // Match punch P7: the sources that would pay for the card you hold light one after another, 40 ms apart.
    val payAt = LocalPayLight.current.indexOf(card.id)
    val payIn by animateFloatAsState(if (payAt >= 0) 1f else 0f, if (Motion.still || payAt < 0) androidx.compose.animation.core.snap() else tween(160, delayMillis = payAt * PAY_LIGHT_GAP_MS), label = "payLight")
    val paid = payAt >= 0 && payIn > .02f
    // Tap: 180 ms (Living Battlefield page 9).
    val turn by animateFloatAsState(if (card.tapped) 20f else 0f, tapSpec(card.id), label = "tap")
    val stepUp by attackStep(card)
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
        // 0.4.60 G6 review: A opens the card with its rows first; only on two screens, with this card already open, does A activate.
        mark == Mark.USABLE && mineSide -> if (DualScreen.active && LocalAbilityOpen.current == card.id) "Activate" else "Inspect"
        mark == Mark.PICKABLE && mineSide && LocalPayInput.current -> "Tap for mana"
        mark == Mark.PICKABLE -> "Choose"
        mark == Mark.NONE && mineSide && Glow.manaOnly(card) -> "Tap for mana"
        else -> null
    }
    val padHere = remember(card.id, padA) { PadActs(a = padA, y = PadAct("Inspect") { inspect(cardNow) }) }
    // 0.4.59 T10: the light board foil, on your foil printings only; never while the tile wears a pick, target or trigger ring.
    val trigger = LocalTrigger.current
    val foil = BoardFoil.wears(card.name, if (card.owner == card.controller) mineSide else !mineSide) &&
        mark !in FOIL_OFF && trigger?.sourceId != card.id
    // The band plays once when the card lands and once when it takes the ring (the tile's own kick on the board's one clock).
    val foilKick = remember(card.id) { androidx.compose.runtime.mutableLongStateOf(fx?.now?.longValue ?: 0L) }
    // 0.4.60 Z7: a commander on the battlefield (Forge's flag) wears a gold crown standing on its top edge, outside the tile, so the
    // name, art and badges stay as they are.
    val crown = pileTop && CommanderMarks.crowned(card)
    anchors?.let { if (crown) it.sizes["crown${card.id}"] = 1f else it.sizes.remove("crown${card.id}") }
    val ringedTile = LocalRinged.current
    if (pileTop) androidx.compose.runtime.DisposableEffect(card.id, mineSide) {
        val zone = if (mineSide) TableZones.mine else TableZones.theirs
        zone[card.id] = padFocus
        // 0.4.60 G5 review: a tile that goes away with the ring on it (no focus change) takes the ring's reading along.
        onDispose { if (zone[card.id] === padFocus) zone.remove(card.id); ringedTile?.off(card.id) }
    }
    Box(modifier.size(w, h)
        .graphicsLayer { rotationZ = turn; attackLayer(card.tapped, stepUp, mineSide, advance?.toPx() ?: (12f * u * density)) }
        .onGloballyPositioned { place[0] = it; anchors?.putRect("c${card.id}", it.boundsInRoot()) }
        // Effects move the card by transform only, after its anchor is read, so lines and slots never follow the motion.
        // Living table F8: a creature tile breathes (lands and whole cards do not).
        .then(if (fx != null) Modifier.graphicsLayer { fx.move(this, card.id, anchors); if (card.isCreature && !land && !whole) fx.breathe(this, card.id) } else Modifier)
        .drawBehind {
            // box-shadow: 0 0 0 1.5px ring, 0 0 0 2.5px #000d, 0 10px 22px #000b
            val r = 10.du.toPx()
            drawRoundRect(Color(0xBB000000), topLeft = Offset(0f, 6.du.toPx()), size = size, cornerRadius = CornerRadius(r))
            drawRoundRect(Color(0xDD000000), topLeft = Offset(-2.5f.du.toPx(), -2.5f.du.toPx()), size = Size(size.width + 5f.du.toPx(), size.height + 5f.du.toPx()), cornerRadius = CornerRadius(r + 2.5f.du.toPx()))
            if (role != null) drawIntoCanvas { c ->
                // 0 0 ~20px 4px glow
                // F8: the rim's glow pulses between 75 % and 100 %.
                val spread = 4.du.toPx(); val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = role.third.let { g -> g.copy(alpha = g.alpha * (fx?.rimPulse() ?: 1f)) }.toArgb(); maskFilter = android.graphics.BlurMaskFilter(10.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                c.nativeCanvas.drawRoundRect(-spread, -spread, size.width + spread, size.height + spread, r + spread, r + spread, p)
            }
            // The payment light: a wide soft mana-gold glow round the whole card (#ffd98a), under its thin edge.
            if (paid) drawIntoCanvas { c ->
                val spread = 6.du.toPx(); val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = PayGold.copy(alpha = .8f * payIn).toArgb(); maskFilter = android.graphics.BlurMaskFilter(16.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
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
            if (crown) {
                val cw = 20.du.toPx(); val ch = 12.du.toPx(); val cx = size.width / 2; val base = -4.du.toPx(); val top = base - ch
                val l = cx - cw / 2; val r2 = cx + cw / 2
                val path = androidx.compose.ui.graphics.Path().apply {
                    moveTo(l, base); lineTo(l, top + ch * .2f); lineTo(l + cw * .28f, top + ch * .58f); lineTo(cx, top)
                    lineTo(r2 - cw * .28f, top + ch * .58f); lineTo(r2, top + ch * .2f); lineTo(r2, base); close()
                }
                drawPath(path, Brush.verticalGradient(listOf(Color(0xFFFFE6A0), Color(0xFFE3C070), Color(0xFFA9792C)), startY = top, endY = base))
                drawPath(path, Color(0xFF1B1405), style = Stroke(1.2.dp.toPx(), join = androidx.compose.ui.graphics.StrokeJoin.Round))
            }
        }
        .aimOn("c${card.id}")
        .then(if (foil) Modifier.onFocusChanged { if (it.isFocused) foilKick.longValue = fx?.now?.longValue ?: 0L } else Modifier)
        .then(if (pileTop) Modifier.onFocusChanged { if (it.isFocused) { ringedTile?.on(card.id); if (mineSide) { TableZones.lastMine = card.id; TableZones.at = 1 } else { TableZones.lastTheirs = card.id; TableZones.at = 2 } }
                else ringedTile?.off(card.id) }
            .padActs(padHere).matchPadTap(padSource, padFocus) { tap?.invoke() ?: inspect(card) } else Modifier)
        .clip(shape).background(Color(0xFF141418))
        .pointerInput(card.id) { detectTapGestures(onTap = { tap?.invoke() ?: inspect(card) }, onLongPress = { inspect(card) }) }
        .then(if (draggable && drag != null) Modifier.pointerInput(card.id, drag) { blockDragGestures(card.id, drag, anchors, 22.dp.toPx()) { p -> place[0]?.takeIf { it.isAttached }?.localToRoot(p) } } else Modifier)) {
        // A big board (play-forge-table.css: --nh clamp(15, piece·.15, 22), --nf clamp(11, piece·.083, 13)): the name strip over a dark fade, the art below it.
        // 0.4.59 T1: tiles are sized from the screen, so the strip follows the tile (17 % of it) and a small tile shows art only.
        // 0.4.60 Z3: no tile shows art only any more: every top card wears its name, at the text floors (TextFloors), its words growing
        // with the tile on a bigger screen. The strip is at least one line of the name tall.
        val textK = piece?.let { TextFloors.scale(it.value * .9f) } ?: 1f
        val nameSp = TextFloors.nameSp(land, squeezed, textK)
        val nh = if (whole) null else piece?.let { maxOf((h.value * .17f).coerceIn(12f, 24f), nameSp * 1.2f).dp }
        if (whole) Box(Modifier.fillMaxSize().then(if (foil) Modifier.boardFoil(fx, card.id, card.tapped) { foilKick.longValue } else Modifier)) {
            CardImage(card.name, Modifier.fillMaxSize()) { CardFrame(card.name, card, Modifier.fillMaxSize(), crop = false) }
        }
        else Box(Modifier.fillMaxSize().padding(start = 2.du, end = 2.du, bottom = 2.du, top = nh?.let { it + 3.dp } ?: 2.du).clip(RoundedCornerShape(9.du))
            .then(if (foil) Modifier.boardFoil(fx, card.id, card.tapped) { foilKick.longValue } else Modifier)) {
            CardImage(card.name, Modifier.fillMaxSize(), crop = true) { CardFrame(card.name, card, Modifier.fillMaxSize(), crop = true) }
        }
        // A card under the top of its pile: art at brightness .78, no name.
        if (!pileTop) Box(Modifier.fillMaxSize().background(Color(0x38000000)))
        // The payment light over the whole card: a soft mana-gold wash.
        if (paid) Box(Modifier.fillMaxSize().background(PayGold.copy(alpha = .22f * payIn)))
        // 0.4.60 Z2: the name is never cut: it wraps to two lines (three on a squeezed tile) and keeps to the part of the tile that shows.
        var nameH by remember(card.id) { mutableStateOf(nh ?: 0.dp) }
        val dens = LocalDensity.current.density
        if (nh != null && piece != null && pileTop) {
            // 0.4.60 Z3: name 11 sp on two lines (a squeezed tile 9.5 sp on three, a land 10 sp), times the tile's scale. A name that does
            // not fit steps down, never under its floor; at the floor a third line comes before any cut (a long name on a narrow tile).
            val floor = TextFloors.nameFloor(land, squeezed)
            // A squeezed tile (the mockup's squeezed name), an overlapped one and a land (a small tile): tighter sides and letters.
            val tight = squeezed || visibleW != null || land
            // The size and lines are found by measuring before drawing (no redraw loop, so the first frame is already right).
            val side = if (tight) 3.dp else 7.dp
            val room = ((visibleW ?: w) - side * 2).coerceAtLeast(1.dp)
            fun nameStyle(sz: Float) = TextStyle(fontFamily = Spectral, fontWeight = FontWeight.Bold, fontSize = sz.sp,
                color = Color(0xFFF6EFDF), lineHeight = maxOf(sz * 1.15f, minOf(nh.value, sz * 1.5f)).sp, letterSpacing = if (tight) (-.03f).em else androidx.compose.ui.unit.TextUnit.Unspecified,
                shadow = androidx.compose.ui.graphics.Shadow(Color.Black, Offset(0f, 1f), 2f))
            val nameMeasurer = androidx.compose.ui.text.rememberTextMeasurer()
            val fit = remember(card.name, nameSp, floor, room, tight, nh) {
                val t = card.name
                val roomPx = (room.value * dens).toInt().coerceAtLeast(1)
                // Cut: a lost line, or a line that ends inside a word (as bad as a lost line).
                fun cut(sz: Float, ln: Int): Boolean {
                    val r = nameMeasurer.measure(t, nameStyle(sz), overflow = TextOverflow.Clip, maxLines = ln, constraints = androidx.compose.ui.unit.Constraints(maxWidth = roomPx))
                    return r.hasVisualOverflow || (0 until r.lineCount - 1).any { i -> val e = r.getLineEnd(i); e in 1 until t.length && !t[e - 1].isWhitespace() && t[e - 1] != '-' && !t[e].isWhitespace() }
                }
                val l0 = TextFloors.nameLines(squeezed || visibleW != null)
                var sz = nameSp
                while (sz > floor + .01f && cut(sz, l0)) sz = maxOf(floor, sz - .5f)
                when {
                    !cut(sz, l0) -> NameFit(sz, l0, false, t)
                    !cut(sz, 3) -> NameFit(sz, 3, false, t)
                    // Phone review, 6: a name is never wrapped inside a word. A word too long for the tile steps down to 9.5 sp; if it
                    // still does not fit, the name stops at that word, which ends in an ellipsis ("Llanowar…").
                    land -> NameFit(sz, 3, true, t) // a land drops its name instead (below)
                    !cut(minOf(sz, TextFloors.NAME_WORD), 3) -> NameFit(minOf(sz, TextFloors.NAME_WORD), 3, false, t)
                    else -> {
                        val small = minOf(sz, TextFloors.NAME_WORD)
                        val words = t.split(' ')
                        fun wide(w: String) = nameMeasurer.measure(w, nameStyle(small), maxLines = 1).size.width > roomPx
                        val k = words.indexOfFirst(::wide)
                        if (k < 0) NameFit(small, 3, true, t) // more than three lines of whole words: the last line ends in an ellipsis
                        else {
                            val before = if (k == 0) 0 else nameMeasurer.measure(words.take(k).joinToString(" "), nameStyle(small), constraints = androidx.compose.ui.unit.Constraints(maxWidth = roomPx)).lineCount
                            NameFit(small, (before + 1).coerceAtMost(3), true, words.take(k + 1).joinToString(" "), newLine = k > 0 && before < 3)
                        }
                    }
                }
            }
            val size = fit.size; val lines = fit.lines; val cut = fit.cut
            // M5 (phone conflicts, 2): a land's name is never broken letter by letter. Where it cannot be whole, or less than a
            // finger's width of the pile shows, the land keeps its mana symbol and its count and drops the name.
            val noName = land && (cut || (visibleW != null && visibleW < TextFloors.TOUCH.dp))
            if (noName) androidx.compose.runtime.SideEffect { anchors?.let { it.rects.remove("name${card.id}"); it.rects.remove("namecut${card.id}"); it.sizes["namelines${card.id}"] = 0f } }
            else Box((if (visibleW != null) Modifier.width(visibleW) else Modifier.fillMaxWidth()).heightIn(min = nh + 10.dp)
                .background(Brush.verticalGradient(0f to Color(0xF007070B), .55f to Color(0xB807070B), 1f to Color(0x0007070B)))
                .padding(start = side, end = side, top = 3.dp, bottom = 4.dp)) {
                // (A long last word is put on its own line so the ellipsis falls on it, not on the word before.)
                val shown = if (fit.newLine) fit.text.substringBeforeLast(' ') + "\n" + fit.text.substringAfterLast(' ') else fit.text
                Text(shown, maxLines = lines, overflow = if (cut) TextOverflow.Ellipsis else TextOverflow.Clip, style = nameStyle(size),
                    modifier = if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("name${card.id}", it.boundsInRoot()) } else Modifier,
                    onTextLayout = { r ->
                        nameH = maxOf(nh, (r.size.height / dens).dp - 3.dp)
                        // Test hooks: a name that does not fit its lines is marked, so a shot test can say no name is cut; its size and lines.
                        anchors?.let {
                            if (cut) it.putRect("namecut${card.id}", androidx.compose.ui.geometry.Rect(0f, 0f, 1f, 1f)) else it.rects.remove("namecut${card.id}")
                            it.sizes["namesp${card.id}"] = size; it.sizes["namelines${card.id}"] = r.lineCount.toFloat()
                            // A line that ends inside a word (never allowed: phone review, 6).
                            val broken = (0 until r.lineCount - 1).any { i -> val e = r.getLineEnd(i); e in 1 until shown.length && !shown[e - 1].isWhitespace() && shown[e - 1] != '-' && !shown[e].isWhitespace() }
                            if (broken) it.putRect("namebroken${card.id}", androidx.compose.ui.geometry.Rect(0f, 0f, 1f, 1f)) else it.rects.remove("namebroken${card.id}")
                        }
                    })
            }
        }
        landPip(card, land)?.let { c ->
            Box(Modifier.align(Alignment.BottomStart).offset(x = 4.du, y = (-3).du).size(10.du).clip(CircleShape).background(LAND_DOT.getValue(c)).border(1.dp, Color(0xAAFFFFFF), CircleShape),
                contentAlignment = Alignment.Center) { Text("$c", style = sans(sp(7f), FontWeight.Bold, if (c == 'W') Color(0xFF111111) else Color.White)) }
        }
        // P/T: clamp(15, piece·.16, 23) in the creature lane, clamp(11, piece·.12, 17) elsewhere, on a big board.
        // 0.4.60 Z3: on the table P/T is 15 sp, growing with the tile (TextFloors); elsewhere as before.
        val statPx = piece?.let { TextFloors.ptSp(textK) } ?: (h.value / u * .26f).coerceIn(9f, 18f)
        val fs = if (piece != null) statPx.sp else sp(statPx)
        // 0.4.60 Z2: while the next pile covers this tile's right part, the plate moves to the left edge, so it is never covered.
        // If even there the plate is wider than what shows, its numbers step down in size to fit.
        val left = visibleW != null && visibleW < w - 6.du
        val measurer = androidx.compose.ui.text.rememberTextMeasurer()
        // Phone review (the brief's "Builder's phone build", 5): the plate is whole inside the part that shows. Where "12 / 12" is
        // too wide for it, the spaces go first ("12/12"), then the numbers step down, never under 12 sp.
        val ptRoom = if (left) (visibleW!! - 6.du - 14.du - 2.dp).value else Float.MAX_VALUE
        // (A tight plate also draws its sides in: 3 du each, not 7.)
        val ptRoomTight = if (left) (visibleW!! - 3.du - 6.du - 2.dp).value else Float.MAX_VALUE
        val ptWide = "${card.power} / ${card.toughness ?: 0}"
        val ptTight = left && measurer.measure(ptWide, sans(fs, FontWeight.Bold, Color.White)).size.width / dens > ptRoom
        val ptSep = if (ptTight) "/" else " / "
        val ptText = "${card.power}$ptSep${card.toughness ?: 0}"
        val fsFit = if (!ptTight) fs else {
            val textW = measurer.measure(ptText, sans(fs, FontWeight.Bold, Color.White)).size.width / dens
            if (textW > ptRoomTight && textW > 0f) maxOf(TextFloors.PT_OVERLAPPED, fs.value * (ptRoomTight / textW).coerceIn(.5f, 1f)).sp else fs
        }
        val ptPad = if (ptTight) 3.du else 7.du
        // 0.4.60 G1: the plate's size (padding 7 × 1 du round the numbers), so the keyword strip keeps clear of it.
        val plate = if (card.isCreature && card.power != null) measurer.measure(ptText, sans(fsFit, FontWeight.Bold, Color.White)).size
            .let { (it.width / dens).dp + ptPad * 2 to (it.height / dens).dp + 2.du } else null
        TileLayer(card, mark == Mark.PLAYABLE || mark == Mark.USABLE, lookup, d, h, if (card.isCreature && card.power != null) (if (piece != null) statPx / u else statPx) else 0f, top = nh?.let { (if (pileTop) nameH else it) + 6.dp },
            w = w, visibleW = visibleW, plate = plate, plateLeft = left, plaque = !whole)
        // .play-current-stats: right 6px, bottom 2px, 1px 7px, #d6ad64c0 hairline, radius 7, #111114f2, white 700; the toughness reads #ff8f84 while damage is marked
        // (forge-table.mjs data-damaged; Forge's toughness already counts counters, damage is not subtracted).
        // T2: in a fanned pile only the front card wears its numbers; the ones behind show their art.
        if (card.isCreature && card.power != null && pileTop) {
            // A TRIGGER SHOWS ITSELF: while a result that changed this card's power/toughness lands (1.2 s), the plate ticks green (up)
            // or coral (down). Then it is white again: the steady colour waits for base P/T from the bridge.
            val tick = LocalTrigger.current?.takeIf { it.phase == dev.cardstashy.nativeplay.match.TriggerMoment.Phase.RESULT }?.result?.pt?.firstOrNull { it.cardId == card.id }
            val tone = tick?.let { if (it.up) TRIG_GREEN else TRIG_CORAL }
            anchors?.let { it.sizes["ptsp${card.id}"] = fsFit.value }
            Row(Modifier.align(if (left) Alignment.BottomStart else Alignment.BottomEnd).offset(x = if (left) 3.du else (-6).du, y = (-2).du)
                .then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("pt${card.id}", it.boundsInRoot()) } else Modifier)
                .clip(RoundedCornerShape(7.du)).background(tone?.copy(alpha = .28f)?.compositeOver(Color(0xF2111114)) ?: Color(0xF2111114))
                .border(if (tone != null) 1.5.dp else 1.dp, tone ?: Color(0xC0D6AD64), RoundedCornerShape(7.du))
                .padding(horizontal = ptPad, vertical = 1.du)) {
                Text("${card.power}$ptSep", style = sans(fsFit, FontWeight.Bold, tone ?: Color.White))
                Text("${card.toughness ?: 0}", style = sans(fsFit, FontWeight.Bold, tone ?: if (card.damage > 0) Color(0xFFFF8F84) else Color.White))
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
    // M2: whose it is on the top edge of an offered target, in its ring's colour: the owner's seat name (it said YOURS or CPU'S).
    if (side != null && pileTop) {
        Box(modifier.size(w, h).zIndex(22f)) {
            // The owner's name (your user name, CPU, a friend's name), cut with … so the tag is never wider than the tile.
            val names = LocalSideNames.current
            Text(if (side) names.first else names.second, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis, style = sans(sp(10f), FontWeight.ExtraBold, Color(0xFF0B0D12)).copy(letterSpacing = .06.em),
                modifier = Modifier.align(Alignment.TopCenter).offset(y = (-9).du).widthIn(max = w).anchorRect("sidetag${card.id}").clip(RoundedCornerShape(999.dp))
                    .background(if (side) SideYours else SideCpu).border(1.dp, Color(0xCC0B0D12), RoundedCornerShape(999.dp)).padding(horizontal = 6.du, vertical = 1.5f.du))
        }
    }
    // M14: the loyalty Forge counts, in a shield on the card's bottom edge, always in view.
    if (whole) card.counters["LOYALTY"]?.let { n ->
        val k = (h.value / u / 94f).coerceIn(.8f, 1.5f)
        Box(modifier.size(w, h).zIndex(21f)) {
            Box(Modifier.align(Alignment.BottomCenter).offset(y = (11f * k).du).size((38f * k).du, (26f * k).du).anchorRect("loyalty${card.id}")
                .semantics { contentDescription = "Loyalty $n" }
                // The shield travels with its card: the card's own effect transform (F5 lifts the card; a landing drops it), about the
                // card's middle, after the shield's anchor is read and with no shadow of its own.
                .then(if (fx != null) Modifier.graphicsLayer { fx.move(this, card.id, anchors); shadowElevation = 0f
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, (h.toPx() / 2f - (h.toPx() + (11f * k).du.toPx() - size.height)) / size.height) } else Modifier)
                .drawBehind {
                    val path = androidx.compose.ui.graphics.Path().apply { moveTo(0f, 0f); lineTo(size.width, 0f); lineTo(size.width, size.height * .58f); lineTo(size.width / 2, size.height); lineTo(0f, size.height * .58f); close() }
                    drawPath(path, Color(0xFF0B0E15)); drawPath(path, Ice, style = Stroke(1.6.dp.toPx(), join = androidx.compose.ui.graphics.StrokeJoin.Round))
                }, contentAlignment = Alignment.TopCenter) {
                Text("$n", style = sans(sp(15f * k), FontWeight.ExtraBold, Ice), maxLines = 1, modifier = Modifier.offset(y = (-1f * k).du))
            }
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
        // 0.4.60 Z2: on an overlapped pile it sits on the part that shows, over the next pile's edge.
        Box(modifier.offset(x = (visibleW?.coerceAtMost(w) ?: w) - 22.du, y = -bh / 2).zIndex(if (visibleW != null) 35f else 20f).height(bh).widthIn(min = 28.du)
            .clip(RoundedCornerShape(999.dp)).background(Color(0xEB0C0D12)).border(1.dp, Palette.Gold, RoundedCornerShape(999.dp))
            .pointerInput(card.id) { detectTapGestures(onTap = { tap?.invoke() ?: inspect(card) }) }
            .padding(horizontal = 5.du), contentAlignment = Alignment.Center) {
            Text("×$count", style = sans(sp(11f), FontWeight.ExtraBold, Palette.Gold).copy(fontFeatureSettings = "tnum"))
        }
    }
}

/** The rings that keep their meaning clean: a tile wearing one shows no foil (0.4.59 T10). */
private val FOIL_OFF = setOf(Mark.PICKED, Mark.TARGET, Mark.DISCARD, Mark.PICKABLE, Mark.PLAYABLE)
private val FOIL_SHEEN = listOf(Color(0xFFFFB8DA), Color(0xFFB8E6FF), Color(0xFFFFE7A6), Color(0xFFB9F2D6), Color(0xFFFFB8DA))

/**
 * 0.4.59 T10, the board's light foil, drawn over the art and inside it (clipped with it; nothing outside the tile, no glow): one soft
 * four-colour sheen at 13 % drifting corner to corner over 9 s and back, and a slanted band of white light a third of the tile wide
 * that crosses in 2.2 s once every 8 s from the tile's own start. One clock for the board (the effects layer's frame clock), read
 * only while drawing. Tapped: a third as strong. Reduced motion or Effects Minimal: the sheen stands still and the band rests.
 */
private fun Modifier.boardFoil(fx: Battlefield?, id: Int, tapped: Boolean, kick: () -> Long): Modifier = drawWithContent {
    drawContent()
    val t = fx?.now?.longValue ?: 0L
    val still = fx == null || fx.reduced || fx.low || Motion.still
    val k = if (tapped) BoardFoil.TAPPED else 1f
    val w = size.width; val h = size.height
    val p = if (still) .5f else BoardFoil.sheen(t)
    val sx = -w * (1f - p); val sy = -h * (1f - p)
    drawRect(Brush.linearGradient(FOIL_SHEEN, start = Offset(sx, sy), end = Offset(sx + 2f * w, sy + 2f * h)), alpha = .13f * k)
    if (!still) BoardFoil.band(t, id, kick())?.let { q ->
        val bw = w / 3f; val cx = -bw + q * (w + 2f * bw)
        drawRect(Brush.linearGradient(0f to Color.Transparent, .5f to Color.White.copy(alpha = .30f), 1f to Color.Transparent,
            start = Offset(cx - bw / 2f, 0f), end = Offset(cx + bw / 2f, bw * .36f)), alpha = k)
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

// ---- Player squares (0.4.60 Z4) ----

/** The mockup's phone square (dp at its scale 1): the square's contents are drawn at this size times how much bigger the square is. */
internal const val SQUARE_W = 104.3f
internal const val SQUARE_H = 83.8f

/** How much bigger than the mockup's phone square a [w] × [h] dp square is (its contents grow with it; smaller on the smallest phone). */
internal fun squareScale(w: Float, h: Float): Float = minOf(w / SQUARE_W, h / SQUARE_H)

/** M12: the CPU's fan of backs. A back's width on a phone and on a big screen (dp at the table's scale), and where the fan sits. */
internal object CpuFan {
    const val W_PHONE = 40f; const val W_BIG = 52f
    /** A back's height over its width. */
    const val TALL = 1.39f
    /** The fan's middle, as a share of the board's width from its left edge. */
    const val AT_PHONE = .66f; const val AT_BIG = .6f
    /** Each back steps this share of its width; a full hand closes up so the fan is never wider than [SPAN] of the board. */
    const val STEP = .62f; const val SPAN = .5f
    /** A back's middle sits this share of its height below the top edge, so a little over half of it shows. */
    const val DROP = .08f
    const val TILT = 2.9f; const val ARC = .9f
    fun step(n: Int, w: Float, boardW: Float): Float = if (n <= 1) 0f else minOf(w * STEP, (boardW * SPAN - w) / (n - 1)).coerceAtLeast(2f)
}

/**
 * Mobile table M12 (specs/mobile-table-arena-parity-brief.md; seen in the Arena phone recording): the CPU's hand at the top edge
 * as a fan of card backs, one per card Forge counts in its hand, so it grows on a draw and a back leaves when the CPU plays. The
 * whole fan is "cpuhand" (where the CPU's cast leaves from and its draw lands). It takes no taps. A revealed card turned face up
 * in the fan waits for the host to say which cards are revealed.
 */
@Composable
private fun CpuHandFan(n: Int, zones: ZoneLayout.Zones, d: Du) = with(d) {
    if (n <= 0) return@with
    val w = if (zones.phone) CpuFan.W_PHONE else CpuFan.W_BIG; val h = w * CpuFan.TALL
    val step = CpuFan.step(n, w, zones.board.w / u)
    val span = step * (n - 1) + w
    val cx = zones.board.x.dp + zones.board.w.dp * (if (zones.phone) CpuFan.AT_PHONE else CpuFan.AT_BIG)
    val top = zones.window.y.dp + (h * (CpuFan.DROP - .5f)).du
    // Under the table's cards: a permanent in the CPU's back row is never covered by a back.
    Box(Modifier.zIndex(-1f).offset(x = cx - span.du / 2, y = top).size(span.du, h.du).anchorRect("cpuhand").semantics { contentDescription = "CPU's hand: $n ${if (n == 1) "card" else "cards"}" }) {
        for (i in 0 until n) {
            val k = i - (n - 1) / 2f
            Box(Modifier.offset(x = (step * i).du, y = (k * k * CpuFan.ARC).du).size(w.du, h.du).graphicsLayer { rotationZ = -k * CpuFan.TILT }
                .drawBehind { drawRoundRect(Color(0x99000000), topLeft = Offset(0f, 3.dp.toPx()), size = size, cornerRadius = CornerRadius(4.dp.toPx())) }
                .clip(RoundedCornerShape(4.du)).anchorRect("cpuback$i")) { CardBack(Modifier.fillMaxSize()) }
        }
    }
}

/**
 * A player's glass square (mockup .plate, lines 51 to 66 and 306 to 314) filling [box]: the name at the top, the round portrait
 * ([portrait], given its size, its place and the life's sp) with the life on its gold pill under it, "Hand N" and "Deck N" in words
 * to its right and the graveyard's top card with its count ([grave], given the card's size and the count's sp) under them. The
 * player whose turn it is ([active]) wears the gold edge and its glow. [handKey] names the hand's words for the travelling cast and
 * the draw ("cpuhand"); the deck's words are "lib<id>" (where a drawn card leaves from), the square itself "square<id>".
 */
@Composable
private fun PlayerSquare(p: Player, box: ZoneLayout.Box, who: String, active: Boolean, d: Du, handKey: String?,
                         portrait: @Composable (Dp, Modifier, Float) -> Unit, grave: @Composable (Dp, Dp, Float) -> Unit) = with(d) {
    // 0.4.60 Z7: in a Commander game "Cmdr damage N/21" per opposing commander (Forge's numbers) under the portrait and the
    // graveyard, at 9 sp: the rest of the square is drawn small enough to leave those lines their room.
    val cmdr = CommanderMarks.damageShown(p)
    val cmdrSp = 9f
    val cmdrRoom = if (cmdr.isEmpty()) 0f else cmdr.size * cmdrSp * 1.3f + 4f
    val s = squareScale(box.w, box.h - cmdrRoom)
    fun m(v: Float) = (v * s).dp
    val shape = RoundedCornerShape(m(10f))
    val anchors = LocalAnchors.current
    val words = maxOf(9f, 10f * s)
    Box(Modifier.offset(x = box.x.dp, y = box.y.dp).size(box.w.dp, box.h.dp).anchorRect("square${p.id}")
        .then(if (active) Modifier.drawBehind { drawRoundRect(Gold.copy(alpha = .28f), topLeft = Offset(-5.dp.toPx(), -5.dp.toPx()), size = androidx.compose.ui.geometry.Size(size.width + 10.dp.toPx(), size.height + 10.dp.toPx()), cornerRadius = CornerRadius(m(14f).toPx())) } else Modifier)
        .background(Color(0xD10E121C), shape)
        .border(if (active) 1.5.dp else 1.dp, if (active) Color(0xFFE3C070) else Color(0x6BE3C070), shape)
        .semantics(mergeDescendants = false) { contentDescription = "$who: life ${p.life}, hand ${p.handCount}, deck ${p.libraryCount}, graveyard ${p.graveyard.size}" +
            cmdr.joinToString("") { ", ${it.damage} of ${CommanderMarks.LETHAL} commander damage from ${it.commander}" } + if (active) ", their turn" else "" }) {
        if (active) anchors?.let { it.sizes["squareactive${p.id}"] = 1f }
        else anchors?.sizes?.remove("squareactive${p.id}")
        Text(who.uppercase(), style = sans(maxOf(9f, 10f * s).sp, FontWeight.ExtraBold, Color(0xFFC9CFDB)).copy(letterSpacing = .05.em), maxLines = 1, softWrap = false,
            overflow = TextOverflow.Ellipsis, modifier = Modifier.offset(x = m(8f), y = m(4f)).widthIn(max = box.w.dp - m(16f) - (if (handKey != null) 40.du else 0.dp)))
        val a = m(38f)
        portrait(a, Modifier.offset(x = m(6f), y = m(20f)), TextFloors.LIFE * maxOf(1f, s))
        Column(Modifier.offset(x = m(51f), y = m(18f))) {
            @Composable fun line(label: String, n: Int, key: String?) = Row(Modifier.then(if (key != null) Modifier.anchorRect(key) else Modifier), verticalAlignment = Alignment.CenterVertically) {
                Text("$label ", style = sans(words.sp, FontWeight.Bold, Color(0xFFC9CFDB)), maxLines = 1, softWrap = false)
                Text("$n", style = sans(words.sp, FontWeight.ExtraBold, Color.White).copy(fontFeatureSettings = "tnum"), maxLines = 1, softWrap = false)
            }
            line("Hand", p.handCount, handKey)
            line("Deck", p.libraryCount, "lib${p.id}")
        }
        Box(Modifier.offset(x = m(51f), y = m(48f))) { grave(m(19f), m(19f / .716f), maxOf(10f, 11f * s)) }
        if (cmdr.isNotEmpty()) Column(Modifier.offset(x = m(8f), y = (box.h - cmdrRoom + 1f).dp).anchorRect("cmdrdmg${p.id}")) {
            // .czp em: 700, #ffd98a, one line each.
            for (line in CommanderMarks.damageLines(cmdr)) Text(line, style = sans(cmdrSp.sp, FontWeight.Bold, Color(0xFFFFD98A)).copy(fontFeatureSettings = "tnum", lineHeight = (cmdrSp * 1.3f).sp),
                maxLines = 1, softWrap = false)
        } else anchors?.rects?.remove("cmdrdmg${p.id}")
    }
}

/**
 * A player's graveyard in their square: the top card with its count beside it. A tap, or A on the pad, opens the graveyard sheet
 * (T3; a long press too); the top card wears the playable ring when Forge offers it from there (flashback and the like), and then a
 * tap casts it. Anchors: "grave<id>" the card (a dying card flies there), "piles<id>" the card with its count.
 */
@Composable
private fun GravePile(p: Player, w: Dp, h: Dp, countSp: Float, d: Du, onInspect: (Card) -> Unit, playable: (Card) -> Boolean = { false }, onCast: (Card) -> Unit = {},
                      onGrave: ((Int) -> Unit)? = null) = with(d) {
    val top = p.graveyard.lastOrNull(); val lit = top != null && playable(top)
    Box(Modifier.anchorRect("piles${p.id}")) {
        if (onGrave != null) Pile(p.graveyard.size, top, d, "grave${p.id}", lit = lit, onHold = { onGrave(p.id) }, pad = if (lit) "Cast" else "Open", w = w, h = h, countSp = countSp,
            label = "${if (p.isViewer) "Your" else "${p.name}'s"} graveyard, ${p.graveyard.size}") { if (lit && top != null) onCast(top) else onGrave(p.id) }
        else Pile(p.graveyard.size, top, d, "grave${p.id}", lit = lit, onHold = { top?.let(onInspect) }, w = w, h = h, countSp = countSp) { top?.let { if (lit) onCast(it) else onInspect(it) } }
    }
}

/** One pile: its top card ([w] × [h], a little depth under it) with its count beside it. */
@Composable
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
private fun Pile(count: Int, top: Card?, d: Du, anchor: String? = null, lit: Boolean = false, onHold: (() -> Unit)? = null,
                 /** T3: the pad's words for A; a pile with them takes the ring (Up from the hand reaches both graveyards). */
                 pad: String? = null, w: Dp, h: Dp, countSp: Float = 11f, label: String? = null, onTap: () -> Unit) = with(d) {
    val anchors = LocalAnchors.current
    val padSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val r = RoundedCornerShape(minOf(3.du, w / 8))
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.du)) {
        Box(Modifier.size(w, h).then(if (anchors != null && anchor != null) Modifier.onGloballyPositioned { anchors.putRect(anchor, it.boundsInRoot()) } else Modifier)
            .then(if (label != null) Modifier.semantics { contentDescription = label; role = Role.Button } else Modifier)
            // The playable ring (ice, solid), as on a hand card.
            .then(if (lit) Modifier.border(2.dp, Ice, r) else Modifier)
            .then(if (pad != null && top != null) Modifier.padActs(remember(pad) { PadActs(a = pad) }).matchPadTap(padSource) { onTap() } else Modifier)
            .combinedClickable(enabled = top != null, onLongClick = onHold, onClick = onTap)) {
            // A little depth under the top card: up to three edges.
            val depth = minOf(3, (count - 1).coerceAtLeast(0))
            for (i in depth downTo 1) Box(Modifier.offset(x = (i * 1.2f).du, y = (i * 1.2f).du).fillMaxSize().clip(r).background(Color(0xFF15182A)).border(1.dp, Color(0x55C9A75A), r))
            if (count > 0) {
                if (top != null) CardImage(top.name, Modifier.fillMaxSize(), crop = true, shape = r) { CardBack(Modifier.fillMaxSize()) }
                else CardBack(Modifier.fillMaxSize().clip(r))
            } else Box(Modifier.fillMaxSize().border(1.dp, Color(0x38FFFFFF), r))
        }
        Text("$count", style = sans(countSp.sp, FontWeight.ExtraBold, Color.White).copy(fontFeatureSettings = "tnum"), maxLines = 1, softWrap = false)
    }
}


/** Three dots that breathe in turn beside the CPU's portrait while it thinks (match director, think steps). */
@Composable
private fun ThinkDots(modifier: Modifier, d: Du) = with(d) {
    val tell by dev.cardstashy.nativeplay.match.CpuThink.now.collectAsState()
    val on by androidx.compose.animation.core.animateFloatAsState(if (tell != null) 1f else 0f, tween(180), label = "dots")
    if (on <= 0f) return@with
    // Z4 review: still (screenshots, reduced motion) draws the dots at one fixed phase; an endless animation there never lets the
    // test clock go idle.
    val phase = if (Motion.still) 1f else rememberInfiniteTransition(label = "think").animateFloat(0f, 3f, infiniteRepeatable(tween(1050, easing = LinearEasing)), label = "p").value
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
internal fun Medallion(p: Player, mine: Boolean, pickable: Boolean, picked: Boolean, modifier: Modifier, d: Du, onOpen: (() -> Unit)? = null,
                       /** 0.4.60 Z4: the portrait's size (52 du as live; the player squares draw it at the mockup's 38) and the life's sp. */
                       side: Dp? = null, lifeSp: Float = TextFloors.LIFE, onPick: () -> Unit) = with(d) {
    val a = side ?: 52.du
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
    val fx = LocalBattlefield.current
    LaunchedEffect(p.life) {
        val from = last; last = p.life
        if (p.life >= from || Motion.still || fx == null) { shown = p.life; return@LaunchedEffect }
        // Match punch P5: the pill follows the hits themselves. Each loss in flight (Battlefield.lifeShown) comes off one point every
        // 90 ms from the frame its blow lands, each with a punch; the portrait recoils and flares on the first. A loss with no
        // effect in flight (effects skipped by a touch) just shows.
        var first = true; var n = 0
        while (shown > p.life) {
            androidx.compose.runtime.withFrameMillis { }
            val v = fx.lifeShown(p.id, p.life).coerceAtMost(shown)
            if (v < shown) {
                if (first && !calm) { launch { flash.snapTo(1f); flash.animateTo(0f, tween(900)) }
                    launch { recoil.snapTo(1f); recoil.animateTo(0f, androidx.compose.animation.core.spring(dampingRatio = .45f, stiffness = 380f)) } }
                first = false; shown = v
                cue?.invoke("CMB-024", .7f, (1f - .03f * n++).coerceAtLeast(.6f)); tick.snapTo(1.4f); launch { tick.animateTo(1f, tween(200)) }
            } else if (!fx.lifePending(p.id)) shown = p.life
        }
    }
    // S2: the first time this player's life shows 5 or less, the pill beats red twice with the low-life sound. Once a game.
    val beat = remember { Animatable(0f) }
    LaunchedEffect(shown) {
        if (shown in 1..LOW_LIFE && fx != null && fx.lowSeen.add(p.id)) { cue?.invoke("CMB-019", 1f, 1f)
            if (!Motion.still) repeat(2) { beat.snapTo(1f); beat.animateTo(0f, tween(LOW_BEAT_MS)) } }
    }
    val anchors = LocalAnchors.current
    val feelFx = LocalBattlefield.current
    val pulse = if (pickable && !Motion.still) rememberInfiniteTransition(label = "pick").animateFloat(.55f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "a").value else 1f
    Box(modifier.size(a).then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("orb${p.id}", it.boundsInRoot()) } else Modifier)
        .graphicsLayer { translationY = (if (mine) 1f else -1f) * 14.dp.toPx() * recoil.value; translationX = (if (mine) -1f else 1f) * 6.dp.toPx() * recoil.value
            // Living table F7: the loser's orb is broken off the table; in a draw both dim.
            feelFx?.orbs?.value?.get(p.id)?.let { alpha = it } }
        .padActs(PadActs(a = if (pickable) "Choose" else if (onOpen != null) "Inspect" else null)).focusRequester(TableZones.orb(p.id)).aimOn("orb${p.id}")
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
                if (url == null) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { BrandMark(a * (30f / 52f)) }
                url?.let { coil3.compose.AsyncImage(model = it, contentDescription = null, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
            } else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { BrandMark(a * (30f / 52f)) } // the CPU wears the brand mark
            if (flash.value > 0f) Box(Modifier.fillMaxSize().background(CpuRed.copy(alpha = .55f * flash.value)))
            if (recoil.value > .3f) Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = .6f * (recoil.value - .3f) / .7f)))
        }
        // .play-match-life (0.4.60 Z3: 19 sp, never less, was 15 px): 800 #fff4d8 on a dark pill with a gold hairline, 39 du below the portrait's top
        // (Z4: three quarters of the way down a portrait of any size; the mockup's square puts its middle 9 above the portrait's foot).
        Box(Modifier.align(Alignment.TopCenter).offset(y = a * .75f).wrapContentSize(unbounded = true).anchorRect("lifepill${p.id}")
            .drawBehind { drawRoundRect(Color(0xCC000000), topLeft = Offset(0f, 3.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
            .clip(RoundedCornerShape(999.dp)).background(Brush.verticalGradient(listOf(Color(0xFF26221A), Color(0xFF14120E))))
            .drawBehind { if (beat.value > 0f) drawRect(Color(0xFFE5383B).copy(alpha = .85f * beat.value)) }.border(1.dp, Gold, RoundedCornerShape(999.dp))
            .padding(horizontal = 8.du, vertical = 2.du)) {
            Text("$shown", style = sans(lifeSp.sp, FontWeight.Bold, if (tick.value > 1.01f) Color(0xFFFF8A6A) else Color(0xFFFFF4D8)),
                modifier = Modifier.graphicsLayer { scaleX = tick.value; scaleY = tick.value })
            anchors?.let { it.sizes["lifesp${p.id}"] = lifeSp }
        }
    }
}

/**
 * .play-command-zone.forge-crest: the commander's art on a shield, beside its owner's portrait. 0.4.60 Z7 (mockup .czs): Forge's tax
 * for the next cast on a gold badge at its top left ("+2"; none while it is 0) and a green "In play" tag while the commander is on the
 * battlefield. Anchors: "cmdtax<id>" (and its number in sizes), "cmdinplay<id>", "crest<id>".
 */
@Composable
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
private fun Crest(sh: CommanderMarks.Shield?, owner: Int, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, playable: Boolean = false, onCast: (Card) -> Unit = {}) = with(d) {
    val anchors = LocalAnchors.current
    if (sh == null) { anchors?.let { it.rects.remove("cmdtax$owner"); it.rects.remove("cmdinplay$owner"); it.sizes.remove("cmdtaxn$owner") }; return@with }
    val c = sh.card
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
            .combinedClickable(onLongClick = { onInspect(c) }) { if (playable) onCast(c) else onInspect(c) }
            .semantics { contentDescription = c.name + (CommanderMarks.taxLabel(sh)?.let { ", tax $it" } ?: "") + if (sh.inPlay) ", in play" else "" }
            .anchorRect("crest$owner")) { CardImage(c.name, Modifier.fillMaxSize(), crop = true) }
        CommanderMarks.taxLabel(sh)?.let { t ->
            // .czs i: a #e3c070 pill, #1b1405 800 11 px, on the shield's top left corner.
            Box(Modifier.align(Alignment.TopStart).offset(x = 2.du, y = 1.du).anchorRect("cmdtax$owner").heightIn(min = 18.du).widthIn(min = 22.du)
                .clip(RoundedCornerShape(999.dp)).background(Color(0xFFE3C070)).border(1.dp, Color(0xFF1B1405), RoundedCornerShape(999.dp)).padding(horizontal = 5.du),
                contentAlignment = Alignment.Center) { Text(t, style = sans((11f * maxOf(1f, u)).sp, FontWeight.ExtraBold, Color(0xFF1B1405)), maxLines = 1, softWrap = false) }
            anchors?.let { it.sizes["cmdtaxn$owner"] = sh.tax!!.toFloat() }
        } ?: anchors?.let { it.rects.remove("cmdtax$owner"); it.sizes.remove("cmdtaxn$owner") }
        if (sh.inPlay) {
            // .czs u: #62e39a 800 8 px uppercase; here 9 sp on a dark pill over the shield's lower half, so it reads on any art.
            Box(Modifier.align(Alignment.BottomCenter).offset(y = (-18).du).anchorRect("cmdinplay$owner")
                .clip(RoundedCornerShape(999.dp)).background(Color(0xE60B0D12)).border(1.dp, Color(0x8062E39A), RoundedCornerShape(999.dp)).padding(horizontal = 5.du, vertical = 1.du)) {
                Text("IN PLAY", style = sans((9f * maxOf(1f, u)).sp, FontWeight.ExtraBold, Color(0xFF62E39A)).copy(letterSpacing = .04.em), maxLines = 1, softWrap = false)
            }
        } else anchors?.rects?.remove("cmdinplay$owner")
    }
}

/** .forge-seat-mana: what is floating, one symbol each with its count. Nothing floating, nothing shown. */
@Composable
private fun ManaPool(mana: Map<String, Int>, modifier: Modifier, d: Du, maxW: Dp = Dp.Infinity) = with(d) {
    val floating = listOf("W", "U", "B", "R", "G", "C").mapNotNull { k -> mana[k]?.takeIf { it > 0 }?.let { k to it } }
    if (floating.isEmpty()) return@with
    // 0.4.60 Z4: in the left strip the pool wraps to as many symbols a row as fit [maxW] (24 du each, 4 apart, 6 padding a side).
    val perRow = if (maxW == Dp.Infinity) floating.size else (((maxW - 12.du + 4.du) / 28.du).toInt()).coerceAtLeast(1)
    val shape = RoundedCornerShape(if (floating.size > perRow) 14.du else 999.dp)
    Column(modifier.anchorRect("manapool").heightIn(min = 34.du).clip(shape).background(Color(0xE60B0D12)).border(1.dp, Gold.copy(alpha = .33f), shape)
        .padding(horizontal = 6.du, vertical = 4.du), verticalArrangement = Arrangement.spacedBy(4.du)) {
      for (row in floating.chunked(perRow)) Row(horizontalArrangement = Arrangement.spacedBy(4.du)) {
        row.forEach { (k, n) ->
            Box(Modifier.size(24.du)) {
                Symbol(k, 22.du, Modifier.align(Alignment.Center))
                Box(Modifier.align(Alignment.BottomEnd).offset(4.du, 2.du).clip(CircleShape).background(Gold).border(1.dp, Color(0xFF0B0D12), CircleShape).padding(horizontal = 3.du)) {
                    Text("$n", style = sans(sp(10f), FontWeight.Bold, Color(0xFF1B1408)))
                }
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

/**
 * .forge-phase-track: "Turn N", then a light per step (the current one lit and named). Tap a light to stop there (orange ring).
 * 0.4.60 Z1: with a [width] it is the right strip's phase box (the turn stands by the menu): the current step's name over its lights.
 */
@Composable
private fun PhaseTrack(st: MatchState, stops: Set<String>?, onStop: (String) -> Unit, modifier: Modifier, d: Du, width: Dp? = null, height: Dp? = null) = with(d) {
    val at = PHASE_STEPS.indexOfFirst { st.phase in it.second }
    val yours = st.activePlayer == st.viewer
    val track = if (yours) Sky else Ember
    val anchors = LocalAnchors.current
    // 0.4.60 Z3: a dot is 8 dp at the least (the current one 9.5), on any screen. In the right strip's phase box each light's touch
    // box is its share of the box's width and the box's height (Compose's nearby touch makes it 48 dp tall); six lights 44 dp wide
    // each would not fit the strip.
    @Composable fun light(i: Int, label: String, mod: Modifier = Modifier.size(16.du)) {
        val stop = stops != null && label in stops
        Box(mod.then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("phaselight$i", it.boundsInRoot()) } else Modifier)
            .clip(CircleShape).clickable(enabled = stops != null) { onStop(label) }, contentAlignment = Alignment.Center) {
            val now = i == at
            Box(Modifier.size(if (now) maxOf(9.5f.du, 9.5f.dp) else maxOf(TextFloors.DOT.du, TextFloors.DOT.dp))
                .then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect("phasedot$i", it.boundsInRoot()) } else Modifier).drawBehind { if (now) drawCircle(track.copy(alpha = .45f), radius = size.minDimension) }
                .clip(CircleShape).background(if (now) track else if (i < at) Color(0x70FFFFFF) else Color(0x33FFFFFF)))
            if (stop) Box(Modifier.size(14.du).border(1.5.dp, StopOrange, CircleShape))
        }
    }
    if (width != null) {
        Column(modifier.size(width, height ?: 40.du).turnLine(u).clip(RoundedCornerShape(12.du)).background(Color(0xA60F1218)).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(12.du))
            .padding(horizontal = 2.du, vertical = 2.du), verticalArrangement = Arrangement.SpaceEvenly, horizontalAlignment = Alignment.CenterHorizontally) {
            Text(PHASE_STEPS.getOrNull(at)?.first ?: "", style = sans(sp(12f), FontWeight.Bold, Color.White), maxLines = 1, softWrap = false)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                PHASE_STEPS.forEachIndexed { i, (label, _) -> light(i, label, Modifier.weight(1f).height(maxOf(16.du, 18.dp))) }
            }
        }
        return@with
    }
    Row(modifier.height(26.du).turnLine(u).clip(RoundedCornerShape(999.dp)).background(Color(0xA60F1218)).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(999.dp))
        .padding(horizontal = 10.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.du)) {
        Text("Turn ${st.turn}", style = sans(sp(12f), FontWeight.Bold, track).copy(letterSpacing = .48.sp))
        PHASE_STEPS.forEachIndexed { i, (label, _) ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.du)) {
                light(i, label)
                if (i == at) Text(label, style = sans(sp(12f), FontWeight.Bold, Color.White))
            }
        }
    }
}

// ---- The stack (approved: fanned cards over a portal, gold rim yours / red rim the CPU's, an arc to the source) ----

@Composable
private fun StackFan(st: MatchState, modifier: Modifier, d: Du, onInspect: (Card) -> Unit, live: Boolean = false, onPick: (Int) -> Unit = {},
                     room: Dp = 66.dp, labelMax: Dp = 150.dp,
                     /** How far left each older card steps (0.4.60 Z1: none in the right strip, so they stay off the board). */
                     stepX: Dp? = null) = with(d) {
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
        if (!folded && anchors != null) androidx.compose.runtime.SideEffect { anchors.rects.remove("stackmore") }
        // Folded: the older cards are no longer drawn, so their places are forgotten (the card may have been fanned a frame ago, at full size).
        if (folded && anchors != null) androidx.compose.runtime.SideEffect { olderAll.forEach { g -> anchors.rects.remove("stack${g.first.id}") } }
        var listOpen by remember { mutableStateOf(false) }
        val olderTarget = pick != null && olderAll.any { it.first.id in st.selection.stackTargets }
        LaunchedEffect(olderTarget) { if (olderTarget) listOpen = true }
        if (!folded) shown.drop(1).reversed().forEachIndexed { k, (s, _) ->
            val depth = shown.size - 1 - k
            StackCard(st, s, 1, Modifier.offset(x = 44.du - (stepX ?: 12.du) * depth, y = 34.du - stepY * depth)
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
        // 0.4.59 T5: while the card itself travels here (TravelCard) the stack card stays clear, and its own flight is not needed.
        val travel = LocalTravel.current?.travel
        val punchFx = LocalBattlefield.current
        val reducedFx = punchFx?.reduced == true
        val arriving = !reducedFx && travel?.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_STACK && travel.cardId != null && travel.cardId == top.source?.id
        val travelled = travel?.cardId != null && travel.cardId == top.source?.id
        LaunchedEffect(top.id) {
            if (Motion.still || travelled || top.ability || top.controller == st.viewer || top.source == null || !flown.add(top.id)) return@LaunchedEffect
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
                if (arriving) { alpha = 0f; return@graphicsLayer }
                // Match punch P2, Charge and Burst: the spell swells as each land's streak reaches it, and again as it bursts.
                val swell = punchFx?.stackSwell(top.source?.id) ?: 1f
                if (swell != 1f) { scaleX = swell; scaleY = swell }
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
        // there): whose it is (U5: a CPU spell said nothing on the Thor). 0.4.60 Z6: Forge's yield moved to the three-dot menu beside
        // End turn (TableActions.menu). It starts at the top card's left edge and ends at most 16 dp inside the screen (W3: "CPU's
        // ability" cut at the edge), the words cut with … first.
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
                // Mobile table M1: a trigger's card is labelled ABILITY (it said "Trigger").
                if (s.trigger) Text(ABILITY_LABEL, style = sans(sp(8.5f), FontWeight.ExtraBold, if (mine) Gold else CpuRed).copy(letterSpacing = 1.5.sp), modifier = Modifier.padding(top = 3.du))
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
/**
 * Live 0.4.61 on the Thor (12 Nov, seen in logcat: "FocusRequester is not initialized", then the app froze on both screens): a
 * focus requester whose node is not on the screen throws when asked for the ring. The hand chip's is like that while the hand is
 * empty (cast your last card, then push the d-pad to pick its target). Asking is safe here: false when it cannot take the ring,
 * and the ring goes on to the board's own order.
 */
internal fun FocusRequester.tryFocus(direction: androidx.compose.ui.focus.FocusDirection = androidx.compose.ui.focus.FocusDirection.Enter): Boolean =
    runCatching { requestFocus(direction) }.getOrDefault(false)

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
        if (at != 0) { toHand(); return }
        val r = ask?.invoke() ?: lastMine?.let { mine[it] } ?: mine.values.firstOrNull()
        // Live 0.4.57: the no-argument requestFocus() can't refuse, so a refused jump still counted; only a real move does now.
        if (r != null && take(r)) { if (at == 0) at = 1 }
        android.util.Log.i("PadA", "hand or field target=${r != null} at=$at held=${TablePad.held} connected=${Pad.connected.value} anyFocus=${PadPrompts.anyFocus}")
    }
    /** The ring took [r]: the focus call's own answer, never "it didn't throw". */
    private fun take(r: FocusRequester): Boolean {
        PadPrompts.inputModes?.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard)
        return runCatching { r.requestFocus(androidx.compose.ui.focus.FocusDirection.Enter) }.getOrDefault(false)
    }
    /** The ring has gone to what the cast asks for (V4); when the cast is done it goes back to the hand chip. */
    var jumped = false
    /** The ring is somewhere on the board. */
    var ringIn = false
    /** V4: the ring to what the table asks for (a legal target, else a mana source). A card sets [at] itself; an orb or pill is 1. */
    fun toAsk(why: String): Boolean {
        val r = ask?.invoke()
        val ok = r != null && take(r)
        if (ok) { jumped = true; if (at == 0) at = 1; TablePad.last = r }
        android.util.Log.i("PadA", "ask jump ($why) target=${r != null} ok=$ok held=${TablePad.held} connected=${Pad.connected.value} anyFocus=${PadPrompts.anyFocus}")
        return ok
    }
    /** The ring back on the hand chip, put there by the table: it lifts nothing (live 0.4.57: it lifted card 1). */
    fun toHand(): Boolean {
        val r = hand ?: return false
        TablePad.autoRing = true
        val ok = take(r)
        TablePad.autoRing = false
        if (ok) at = 0
        return ok
    }
    /** One step along [stops] from where the ring is (from anywhere else, the first stop); a stop that refuses is passed over. */
    /**
     * 0.4.59 T6 (input, the left stick): the stop nearest [from] in the direction [dir] (y down), within 60° of it; the angle off
     * counts as much as the distance, so a push picks what lies that way rather than what is merely close. Null: nothing that way.
     */
    fun <T> nearest(from: Offset, dir: Offset, stops: List<Pair<T, androidx.compose.ui.geometry.Rect>>): T? {
        val len = dir.getDistance(); if (len < 1e-3f) return null
        val ux = dir.x / len; val uy = dir.y / len
        return stops.mapNotNull { (k, r) ->
            val vx = r.center.x - from.x; val vy = r.center.y - from.y; val d = kotlin.math.hypot(vx, vy)
            if (d < 1f) return@mapNotNull null
            val cos = (vx * ux + vy * uy) / d
            if (cos < .5f) null else k to d * (1f + 2f * (1f - cos))
        }.minByOrNull { it.second }?.first
    }
    /** Take [r] as a stick snap does: the ring moves there, the walk's place with it. */
    fun snapTo(r: FocusRequester): Boolean { val ok = take(r); if (ok) { jumped = true; if (at == 0) at = 1; TablePad.last = r }; return ok }

    fun steer(stops: List<FocusRequester>, step: Int): Boolean {
        if (stops.isEmpty()) return false
        val i = stops.indexOf(TablePad.last)
        for (k in 1..stops.size) {
            val r = stops[if (i < 0) k - 1 else Math.floorMod(i + step * k, stops.size)]
            if (take(r)) { jumped = true; if (at == 0) at = 1; TablePad.last = r; return true }
        }
        android.util.Log.i("PadA", "target walk: no stop took the ring (${stops.size})")
        return false
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
            if (r != null && take(r)) { at = z; return }
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
    /** Where in the hand the last card A cast or played sat: the next lift starts there (live 0.4.57). -1 none yet. */
    var handAt = -1
    /** 0.4.60 G6: the tap being run came from a controller's A (matchPadTap), not a touch. */
    var byPad = false
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
                if (e.nativeKeyEvent.action == android.view.KeyEvent.ACTION_UP && !e.nativeKeyEvent.isCanceled) { TablePad.byPad = true; try { onTap() } finally { TablePad.byPad = false } }
                true
            } else false
        }
        .indication(source, PadFocus.Ring).focusable(interactionSource = source)

// ---- Buttons (.forge-native-actions on the seat) ----

@Composable
internal fun GoldPill(text: String, enabled: Boolean, modifier: Modifier, d: Du, padKey: Boolean = false, maxW: Dp = Dp.Infinity,
                      /** 0.4.60 Z6: the table's action button passes its 44 dp floor; 44 du otherwise. */
                      height: Dp? = null,
                      /** The match sound pass: the cue of a press (`ui_gold`); null where the press has its own sound (Keep). */
                      press: String? = "ui_gold", onClick: () -> Unit) = with(d) {
    // S3: a press dips the button 4 % and a gleam crosses it (140 ms), with `ui_gold`. The controller's X presses it too ([GoldPress]).
    val cue = LocalTableCue.current
    val dip = remember { Animatable(1f) }
    val pulse = GoldPress.pulse.intValue
    val pulse0 = remember { pulse }
    LaunchedEffect(pulse) { if (pulse != pulse0 && enabled) { press?.let { cue?.invoke(it, 1f, 1f) }
        if (!Motion.still) { dip.snapTo(0f); dip.animateTo(1f, tween(GOLD_PRESS_MS, easing = androidx.compose.animation.core.LinearEasing)) } } }
    // The controller's X is this button: with a pad here the key is printed on it, and the hint bar does not say it again (no prompt twice).
    val pad by Pad.connected.collectAsState()
    val keyed = padKey && pad && enabled
    val owner = remember { Any() }
    androidx.compose.runtime.DisposableEffect(owner, keyed, text) {
        if (keyed) DualScreen.shownLabels[owner] = setOf(text.lowercase())
        onDispose { DualScreen.shownLabels.remove(owner) }
    }
    // The turn clock's ring (and, for the last 10 s, its seconds) sits on this button, wherever the table puts it (TurnRing.kt).
    // Z1 review: 138 du at the least, unless its zone is narrower (the dual top's right strip): then it takes [maxW] and cuts its words.
    Box(modifier.widthIn(min = minOf(138.du, maxW), max = maxW).height(height ?: 44.du).graphicsLayer { val k = goldDip(dip.value); scaleX = k; scaleY = k }.turnRing(u).drawBehind { drawRoundRect(Color(0x3DC99A4B), topLeft = Offset(0f, 8.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
        .clip(RoundedCornerShape(999.dp)).background(if (enabled) Brush.verticalGradient(listOf(Color(0xFFF7DA97), Color(0xFFE8B95B), Color(0xFFC4903A))) else Brush.verticalGradient(listOf(Color(0xFF6B5A3A), Color(0xFF4A3E28))))
        .drawWithContent { drawContent()
            // The gleam: a soft white band crossing left to right, brightest half way.
            val q = dip.value; if (q < 1f) { val bw = size.width * .35f; val x = -bw + q * (size.width + bw)
                drawRect(Brush.horizontalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .55f * sin(q * PI.toFloat())), Color.Transparent), startX = x, endX = x + bw), topLeft = Offset(x, 0f), size = androidx.compose.ui.geometry.Size(bw, size.height)) } }
        .border(1.dp, Color(0xFFF6DFA8), RoundedCornerShape(999.dp)).clickable(enabled = enabled) { GoldPress.pulse.intValue++; onClick() }, contentAlignment = Alignment.Center) {
        Row(Modifier.padding(horizontal = if (maxW < 138.du) 10.du else 18.du), horizontalArrangement = Arrangement.spacedBy(8.du), verticalAlignment = Alignment.CenterVertically) {
            if (keyed) PadKey("X", "")
            // [data-native-key=ok]:after { content: ' ›'; font-size: 20px }. A long label ("Discard Ultimate Magic: Meteor") is cut
            // with … inside the button (BB8); the › stays.
            Row(Modifier.weight(1f, fill = false)) {
                // A label is never cut while it can be fitted: its words step down (15 sp to 11) to the room the button has.
                val goldRoom = if (maxW == Dp.Infinity) Dp.Infinity else maxW - (if (maxW < 138.du) 20.du else 36.du) - (if (keyed) 36.du else 0.dp) - (if (enabled) 10.du else 0.dp)
                Text(text, style = sans(fitSp(text, 15f, 11f, goldRoom, FontWeight.Bold, d), FontWeight.Bold, Color(0xFF1B1408)), maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.weight(1f, fill = false).alignByBaseline())
                if (enabled) Text(" \u203A", style = sans(sp(20f), FontWeight.Bold, Color(0xFF1B1408)), maxLines = 1, modifier = Modifier.alignByBaseline())
            }
        }
    }
}

/**
 * The size (sp, already scaled by [d]) at which [text] fits [room] on one line: [base] where it fits, else stepped down in
 * proportion, never under [floor] (past that the button cuts it with …, as BB8).
 */
@Composable
internal fun fitSp(text: String, base: Float, floor: Float, room: Dp, weight: FontWeight, d: Du): androidx.compose.ui.unit.TextUnit = with(d) {
    if (room == Dp.Infinity) return@with sp(base)
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    val density = LocalDensity.current
    val full = sp(base)
    remember(text, base, floor, room, full) {
        val w = with(density) { measurer.measure(text, sans(full, weight, Color.White), maxLines = 1).size.width.toDp() } + 1.dp
        if (w <= room || w.value <= 0f) full else full * (room.value / w.value).coerceIn(floor / base, 1f)
    }
}

/** S3: a press of the gold button, by finger or by the controller's X: the button on screen dips, gleams and sounds once. */
internal object GoldPress { val pulse = androidx.compose.runtime.mutableIntStateOf(0) }
internal const val GOLD_PRESS_MS = 140; internal const val GOLD_DIP = .04f
/** The gold button's size [q] (0..1) through its press: down 4 % half way and back. */
internal fun goldDip(q: Float): Float = if (q <= 0f || q >= 1f) 1f else 1f - GOLD_DIP * sin(q * PI.toFloat())
/** S2: at this life or less a player's pill beats red twice ([LOW_BEAT_MS] each) with `low_life`, once a game. */
internal const val LOW_LIFE = 5; internal const val LOW_BEAT_MS = 220

@Composable
internal fun GlassPill(text: String, enabled: Boolean, modifier: Modifier, d: Du, tone: Color = Color(0xFFEEE6D4), edge: Color = Color(0x26FFFFFF),
                       /** Z1 review: the widest it may be (its zone's width); longer words are cut with …. */
                       maxW: Dp = Dp.Infinity,
                       /** 0.4.60 Z6: the quiet button above the gold one passes its 44 dp floor; 36 du otherwise. */
                       height: Dp? = null, onClick: () -> Unit) = with(d) {
    val cue = LocalTableCue.current
    Box(modifier.widthIn(max = maxW).height(height ?: 36.du).clip(RoundedCornerShape(999.dp)).background(Color(0xB30C0D12)).border(1.dp, edge, RoundedCornerShape(999.dp))
        .clickable(enabled = enabled) { cue?.invoke("ui_soft", 1f, 1f); onClick() }.padding(horizontal = if (maxW < 96.du) 8.du else 14.du), contentAlignment = Alignment.Center) {
        // A label is never cut while it can be fitted: tighter sides, then its words step down (12.5 sp to 10).
        Text(text, style = sans(fitSp(text, 12.5f, 10f, if (maxW == Dp.Infinity) Dp.Infinity else maxW - (if (maxW < 96.du) 16.du else 28.du), FontWeight.SemiBold, d), FontWeight.SemiBold, tone), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** 0.4.60 Z6: the three-dot button beside the quiet one (a [side] glass circle); a tap opens or closes its menu. */
@Composable
internal fun DotsButton(open: Boolean, modifier: Modifier, side: Dp, d: Du, onClick: () -> Unit) = with(d) {
    Box(modifier.size(side).clip(CircleShape).background(if (open) Color(0xE61A160E) else Color(0xB30C0D12))
        .border(1.dp, if (open) Color(0x99E8C36F) else Color(0x26FFFFFF), CircleShape)
        .semantics { contentDescription = "More: Yield"; role = Role.Button; stateDescription = if (open) "Open" else "Closed" }
        .clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Text("\u00B7\u00B7\u00B7", style = sans(sp(15f), FontWeight.Bold, Color(0xFFEEE6D4)).copy(letterSpacing = sp(1f)), maxLines = 1)
    }
}

/**
 * 0.4.60 Z6: the three-dot menu, one 44 dp line per item ([TableActions.menu]: Yield, gold while it is on). The first line takes
 * [first], so a controller's ring can be put on it (LT opens the menu, A presses it); a finger taps it.
 */
@Composable
internal fun DotsMenu(items: List<TableActions.Item>, modifier: Modifier, first: FocusRequester, d: Du, onPick: (TableActions.Item) -> Unit) = with(d) {
    Column(modifier.widthIn(min = 150.du, max = 240.du).clip(RoundedCornerShape(14.du)).background(Color(0xF0101319))
        .border(1.dp, Color(0x44D6AD64), RoundedCornerShape(14.du)).padding(6.du), verticalArrangement = Arrangement.spacedBy(4.du)) {
        items.forEachIndexed { i, item ->
            val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
            val tap = { if (item.enabled) onPick(item) }
            Row(Modifier.fillMaxWidth().heightIn(min = maxOf(44.du, ZoneLayout.BUTTON.dp)).anchorRect(item.key).clip(RoundedCornerShape(10.du))
                .background(if (item.on) Brush.verticalGradient(listOf(Color(0xFFF6DC9A), Color(0xFFD9A64A))) else Brush.verticalGradient(listOf(Color(0x0DFFFFFF), Color(0x0DFFFFFF))))
                .semantics { contentDescription = item.about; role = Role.Button; stateDescription = if (item.on) "On" else "Off"; onClick { tap(); true } }
                .then(if (i == 0) Modifier.focusRequester(first) else Modifier).matchPadTap(source) { tap() }
                .pointerInput(item) { detectTapGestures { tap() } }
                .alpha(if (item.enabled) 1f else .5f).padding(horizontal = 14.du), verticalAlignment = Alignment.CenterVertically) {
                Text(item.label, style = sans(sp(13f), FontWeight.Bold, if (item.on) Color(0xFF1B1406) else Color(0xFFEEE6D4)), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
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
private fun Emblem(on: Boolean, enabled: Boolean, label: String, d: Du, onClick: () -> Unit, side: Dp? = null, icon: @Composable (Color) -> Unit) = with(d) {
    val hf = androidx.compose.ui.platform.LocalHapticFeedback.current
    val press = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val down by press.collectIsPressedAsState()
    Box(Modifier.size(side ?: 34.du).graphicsLayer { val s = if (down && enabled) .92f else 1f; scaleX = s; scaleY = s; alpha = if (enabled) 1f else .55f }
        .drawBehind { if (on) drawCircle(Brush.radialGradient(listOf(Gold.copy(alpha = .33f), Color.Transparent), radius = size.width * .9f), radius = size.width * .9f) }
        .clip(CircleShape)
        .background(if (on) Brush.radialGradient(listOf(Color(0xFF4A3C1F), Color(0xFF1B160C)), center = Offset.Unspecified) else Brush.linearGradient(listOf(Color(0xCC0F1117), Color(0xCC0F1117))))
        .border(1.dp, if (on) Gold else Color(0x2AFFFFFF), CircleShape)
        .semantics { contentDescription = label; role = Role.Button; stateDescription = if (on) "On" else "Off" }
        // It draws its own press (a scale); PadFocus.Ring adds only the controller's focus ring.
        .clickable(enabled = enabled, interactionSource = press, indication = PadFocus.Ring) { if (AppSettings.haptics) hf.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove); onClick() },
        contentAlignment = Alignment.Center) { icon(if (on) Color(0xFFF4D78F) else Color(0xFF8D95A5)) }
}

/** The response emblems (Smart, the bolt; Full Control; auto-pay when Forge says), each [size] (34 du by default), or none. */
private fun emblemsOf(st: MatchState, intents: TableIntents, d: Du, side: Dp? = null): List<@Composable () -> Unit> = with(d) {
    if (st.controlMode !in setOf("smart", "full")) return@with emptyList()
    val lock = st.prompt != null || st.inputType == "InputLockUI" || st.busy
    val icon = (side ?: 34.du) * (14f / 34f)
    listOfNotNull<@Composable () -> Unit>(
        { Emblem(st.controlMode == "smart", !lock, "Smart: passes empty response windows. Targets and required choices stay yours.", d, { intents.mode("smart") }, side) { StrokeIcon(SMART_ICON, it, icon) } },
        { Emblem(st.controlMode == "full", !lock, "Full Control: stop at every response window.", d, { intents.mode("full") }, side) { StrokeIcon(FULL_ICON, it, icon) } },
        st.autoPay?.let { on -> { Emblem(on, !lock, if (on) "Auto-pay mana: on" else "Auto-pay mana: off", d, { intents.autoPay(!on) }, side) { StrokeIcon(PAY_ICON, it, icon, circle = true) } } },
    )
}

@Composable
private fun ControlEmblems(st: MatchState, intents: TableIntents, modifier: Modifier, d: Du) = with(d) {
    val emblems = emblemsOf(st, intents, d)
    if (emblems.isEmpty()) return@with
    // 0.4.60 Z3: the emblems are drawn 34 du but each takes taps in a 44 dp box (Compose's nearby touch); they stand far enough
    // apart that neighbouring boxes do not take each other's half.
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(maxOf(8.du, TextFloors.TOUCH.dp - 34.du))) { emblems.forEach { it() } }
}

// ---- Emotes (table-emotes.mjs) ----

/** .forge-emote-button: 30 px glass circle with a speech bubble, top-right of your portrait. */
@Composable
private fun EmoteButton(modifier: Modifier, d: Du, side: Dp? = null) = with(d) {
    val hf = androidx.compose.ui.platform.LocalHapticFeedback.current
    val open = TableEmotes.menuOpen
    Box(modifier.size(side ?: 34.du).drawBehind { drawCircle(Color(0x99000000), radius = size.width / 2 + 2.du.toPx(), center = center + Offset(0f, 4.du.toPx())) }
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

/**
 * One arrow. [caster] is who put a target thread there (gold yours, coral the CPU's: glow-rules "who is doing what to whom");
 * [aim] marks the arc to the target under the finger or the ring while you choose, which has no rim until it is picked.
 */
internal data class Rel(val kind: String, val from: String, val to: String, val held: Boolean = false, val blocker: Int? = null, val attacker: Int? = null, val caster: Int? = null, val aim: Boolean = false)

/** 0.4.59 T6: what the arc points at while a target is being chosen: the legal target the finger pressed or the ring is on, whichever moved last. */
internal object TableAim { var key by mutableStateOf<String?>(null) }

/** The CPU's thread and rim (the colour its cast flight already uses, Battlefield.kt). */
internal val ThreadCoral = Color(0xFFFF8A5C)

/** The aim follows a press (seen before the tap's own handler) or the pad ring arriving on [key]. */
internal fun Modifier.aimOn(key: String): Modifier = onFocusChanged { if (it.isFocused) TableAim.key = key }
    .pointerInput(key) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial); if (e.changes.any { it.pressed && !it.previousPressed }) TableAim.key = key } } }

/** forge-table.mjs relations(): what the arrows join, as anchor keys ("c<id>" a card, "orb<id>" a player, "stackcard", "owncast"). */
internal fun relations(st: MatchState, aim: String? = null): List<Rel> {
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
    // Every item keeps its arrows for its whole life on the stack (director spec 7, glow rules), the top one from the big card,
    // also while you choose a target for something else (0.4.59 T6: they used to vanish for the whole question).
    val pending = pendingCast(st)
    laneStack(st).forEachIndexed { i, item ->
        for (r in item.targets) {
            val to = if (r.kind == "card" && board.any { it.id == r.id }) "c${r.id}" else if (r.kind == "player" && st.players.any { it.id == r.id }) "orb${r.id}" else null
            if (to != null) out += Rel("target", if (i == 0) "stackcard" else "stack${item.id}", to, caster = item.controller)
        }
    }
    if (st.inputType == "InputSelectTargets") {
        val named = Regex("targets? for ([^\n]+)", RegexOption.IGNORE_CASE).find(st.message)?.groupValues?.get(1)?.trim()
        val mine = st.players.flatMap { listOf(it.battlefield, it.hand) }.flatten().filter { it.controller == st.viewer }
        val onStack = st.stack.withIndex().filter { (_, it) -> it.source?.controller == st.viewer && it.source.zone == "Stack" }.maxByOrNull { it.value.source!!.id }
        val source = onStack?.value?.source ?: named?.let { n -> mine.firstOrNull { it.zone == "Battlefield" && it.name == n } }
        val from = when {
            // Mobile table M1: an asking ability aims from its own card in the lane.
            askingAbility(st) != null -> "stackcard"
            source != null && source.zone == "Battlefield" -> "c${source.id}"
            pending != null -> "stackcard"
            onStack != null -> if (onStack.index == 0) "stackcard" else "stack${onStack.value.id}"
            else -> null
        }
        if (from != null) {
            for (id in st.selection.chosenCards) out += Rel("target", from, "c$id", caster = st.viewer)
            for (id in st.selection.chosenPlayers) out += Rel("target", from, "orb$id", caster = st.viewer)
            // The arc under the finger or the ring (Arena clip 1): only to a legal target not yet chosen.
            val sel = st.selection
            val legal = when {
                aim == null -> false
                aim.startsWith("orb") -> aim.removePrefix("orb").toIntOrNull()?.let { (it in sel.players || it in sel.targetPlayers) && it !in sel.chosenPlayers } == true
                aim.startsWith("c") -> aim.removePrefix("c").toIntOrNull()?.let { (it in sel.targetCards || it in sel.cards) && it !in sel.chosenCards && board.any { b -> b.id == it } } == true
                else -> false
            }
            if (legal) out += Rel("target", from, aim!!, caster = st.viewer, aim = true)
        }
    }
    return out
}

/**
 * The stack as the table draws it: the card you are casting on top while it asks for its targets or its mana ([pendingCast]: Forge
 * moved it from your hand but lists it only once cast), then Forge's own items. The same list when nothing is waiting.
 */
internal fun laneStack(st: MatchState): List<StackItem> {
    val c = pendingCast(st) ?: return askingAbility(st)?.let { listOf(it) + st.stack } ?: st.stack
    return listOf(StackItem(LANE_ID - c.id, "", c, st.viewer)) + st.stack
}
/**
 * Mobile table M1: the ability that is asking a target question, as the card on top of the lane. Forge asks a trigger's target
 * before it lists the trigger on the stack (TriggerTargetProbe: the stack is empty at the Scavenger's question), so the table
 * shows the asking card itself: the source Forge names by id ([asker]) and Forge's own words for what it does. Null for a
 * spell (its own card is in the lane already), when Forge names no card on the table, or when it gives no words.
 */
internal fun askingAbility(st: MatchState): StackItem? {
    val a = asker(st) ?: return null
    val src = st.card(a.cardId ?: return null)?.takeIf { it.name == a.name && it.zone != "Stack" && it.zone != "Hand" } ?: return null
    val does = a.text.replace(Regex("\\s*\\(Targeting ERROR\\)"), "").replace(Regex("\\s*\\[[^\\]]{0,120}\\]\\s*$"), "").trim()
    if (does.isEmpty() || does.equals(a.name, ignoreCase = true)) return null
    val trigger = Regex("^(?:[A-Z][A-Za-z' ]{1,24} — )?(?:When|Whenever|At the beginning)\\b").containsMatchIn(does)
    return StackItem(LANE_ID - src.id, does, src, st.viewer, ability = true, trigger = trigger)
}
/** The lane item's id: below every id Forge gives, so it is never taken for a stack target or a yield. */
internal const val LANE_ID = -1_000_000

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
    val aim = TableAim.key
    val rels = remember(st, aim) { relations(st, aim) }
    // Match punch P6, Aim: a new target thread whips out from the stack card in 200 ms; when it locks, the target flinches and a
    // ring closes on it (Battlefield.aimLock). Reduce motion and still pictures: the thread is simply there.
    val fx = LocalBattlefield.current
    val whips = remember { HashMap<String, Animatable<Float, androidx.compose.animation.core.AnimationVector1D>>() }
    val aimed = rels.filter { it.kind == "target" && !it.aim }.associateBy { "${it.caster}>${it.to}" }
    whips.keys.retainAll(aimed.keys)
    for (key in aimed.keys) if (key !in whips) whips[key] = Animatable(if (Motion.still || fx == null || fx.reduced) 1f else 0f)
    LaunchedEffect(aimed.keys) {
        for ((key, r) in aimed) { val w = whips[key] ?: continue; if (w.value >= 1f) continue
            launch { w.animateTo(1f, tween(200, easing = androidx.compose.animation.core.Easing { 1f - (1f - it) * (1f - it) * (1f - it) }))
                fx?.aimLock(r.to, if (r.caster != null && r.caster != st.viewer) ThreadCoral else Color(0xFFF3D27E)) } }
    }
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
            val whole = Path().apply { moveTo(sx, sy); quadraticTo(cx, cy, ex, ey) }
            // P6: how far a new target thread has whipped out (1 once it has locked).
            val whip = if (r.kind == "target" && !r.aim) whips["${r.caster}>${r.to}"]?.value ?: 1f else 1f
            val path = if (whip >= 1f) whole else Path().also { part -> androidx.compose.ui.graphics.PathMeasure().apply { setPath(whole, false); getSegment(0f, length * whip, part, true) } }
            // A target thread is in its caster's colour: gold yours, coral the CPU's (glow rules; T6 arc).
            val cpuThread = r.kind == "target" && r.caster != null && r.caster != st.viewer
            val col = if (cpuThread) ThreadCoral else colors.getValue(r.kind)
            val glow = if (cpuThread) ThreadCoral.copy(alpha = .67f) else glows.getValue(r.kind)
            val heldLine = r.kind == "attack" && r.held
            val dash = when { r.kind == "target" -> null; heldLine -> PathEffect.dashPathEffect(floatArrayOf(3 * k, 9 * k), 0f); else -> PathEffect.dashPathEffect(floatArrayOf(6 * k, 7 * k), -flow.value * k) }
            val w = (if (r.kind == "target") 2f else 2.5f) * k
            val alpha = if (heldLine) .22f else .9f
            if (!heldLine) drawIntoCanvas { c ->
                val gp = Paint().asFrameworkPaint().apply { isAntiAlias = true; style = android.graphics.Paint.Style.STROKE; strokeWidth = w + 2 * k; color = glow.toArgb(); maskFilter = android.graphics.BlurMaskFilter(6 * k, android.graphics.BlurMaskFilter.Blur.NORMAL); pathEffect = dash?.let { android.graphics.DashPathEffect(if (r.kind == "attack" || r.kind == "block") floatArrayOf(6 * k, 7 * k) else floatArrayOf(1f, 0f), flow.value * k) } }
                c.nativeCanvas.drawPath(path.asAndroidPath(), gp)
            }
            drawPath(path, col.copy(alpha = alpha), style = Stroke(w, cap = StrokeCap.Round, pathEffect = dash))
            // The target's rim, in the caster's colour, while the thread is there (glow rules "caster-colour rim + thread"; it was
            // red or green, hostile or friendly, before 0.4.59 T6). The arc you are still aiming has none until you pick.
            if (whip < 1f) { drawCircle(col.copy(alpha = alpha), radius = 3.5f * k, center = Offset(sx, sy)); continue }
            if (r.kind == "target" && !r.aim && r.to.startsWith("c")) {
                drawRoundRect(col.copy(alpha = .9f), Offset(b.left - self.x - 3 * k, b.top - self.y - 3 * k), androidx.compose.ui.geometry.Size(b.width + 6 * k, b.height + 6 * k),
                    CornerRadius(6 * k), style = Stroke(2.5f * k))
            }
            // Arrowhead (marker 10×10 at 4.5 × stroke, refX 7), along the curve's end tangent.
            run {
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

/**
 * Live 0.4.57 on the Thor (fault list 6, 11): in 68 du "Shardmage's Rescue" read "Shardmage' / s Rescue", since a word wider
 * than the line is split at a letter. The panel is 76 du, or as wide as the name's widest word ([wordWidth]) plus its
 * [pad], up to [cap]; it grows only while a long name is being cast, and the picture keeps its size.
 */
internal fun castPanelWidth(name: String, base: Dp, pad: Dp, cap: Dp, wordWidth: (String) -> Dp): Dp {
    val widest = name.split(' ').filter { it.isNotEmpty() }.maxOfOrNull { wordWidth(it) } ?: return base
    return (widest + pad).coerceIn(base, maxOf(base, cap))
}


/** What A on the hand chip does while a discard asks. */
internal sealed interface DiscardStep {
    val id: Int
    /** The d-pad rests on the card (its words show on the chip); nothing is chosen. */
    data class Walk(override val id: Int) : DiscardStep
    data class Pick(override val id: Int) : DiscardStep
    data class Discard(override val id: Int) : DiscardStep
    data class Inspect(override val id: Int) : DiscardStep
}

/**
 * A on the hand chip during a discard (W12). [lifted] is the picked card, else the one the d-pad rests on. Thor 0.4.56 (finding D):
 * A with nothing walked used to pick the first card at once (the only Plains, lands sort first), so a card stood chosen that the
 * player never chose. Now it only rests on the first card; A on a walked card picks it, A again discards it.
 */
internal fun discardChipStep(lifted: Card?, selected: Int?, hand: List<Card>, pickable: Set<Int>): DiscardStep? = when {
    lifted == null -> hand.firstOrNull()?.let { DiscardStep.Walk(it.id) }
    lifted.id !in pickable -> DiscardStep.Inspect(lifted.id)
    lifted.id == selected -> DiscardStep.Discard(lifted.id)
    else -> DiscardStep.Pick(lifted.id)
}

/**
 * Mobile table M1: who is asking a target question. Forge writes it as the first line of the question, "<card> (<id>) - <what
 * the spell or ability does>", and what to pick on the last ("Select target creature."). [cardId] is that card on the table
 * (null when Forge's line carries no id); [text] what it does; [pick] Forge's own words for what to pick.
 */
internal data class Asker(val name: String, val cardId: Int?, val text: String, val pick: String)
private val ASKER_HEAD = Regex("^(.{2,80}?)(?: \\((\\d+)\\))? - (.*)$")
private val ASKER_FOR = Regex("^Select targets? for (.{2,80}?)(?: \\((\\d+)\\))?\\.?$", RegexOption.IGNORE_CASE)
private val PICK_LINE = Regex("^(Select|Choose)\\b", RegexOption.IGNORE_CASE)
internal fun asker(st: MatchState): Asker? {
    if (st.prompt != null || st.inputType != "InputSelectTargets") return null
    val lines = st.message.lines().map { it.trim() }.filter { it.isNotEmpty() && !it.startsWith("Targeted:") && !it.startsWith("Parent Targeted:") && !Regex("^\\(\\d+ more can be targeted\\)$").matches(it) }
    val head = lines.firstNotNullOfOrNull { ASKER_HEAD.find(it) } ?: lines.firstNotNullOfOrNull { ASKER_FOR.find(it) } ?: return null
    val name = head.groupValues[1].trim(); if (name.isEmpty()) return null
    val said = head.groupValues.getOrElse(3) { "" }.trim()
    val pick = lines.lastOrNull { it != head.value && PICK_LINE.containsMatchIn(it) } ?: said.takeIf { PICK_LINE.containsMatchIn(it) } ?: ""
    return Asker(name, head.groupValues[2].toIntOrNull(), if (PICK_LINE.containsMatchIn(said)) "" else said, pick)
}
/**
 * M1: the question with its asker's name first, "Optimistic Scavenger: put a +1/+1 counter on target creature." What it does,
 * in Forge's words, when that is one short sentence about a target (a trigger's "Whenever …," and the card's own name at its
 * start are left off); otherwise [plain], the table's own short ask.
 */
internal fun askerLine(a: Asker, plain: String): String = "${a.name}: ${askerBody(a, plain)}"
/** The question without its asker's name: what it does or what to pick, starting small, ending with a full stop. */
internal fun askerBody(a: Asker, plain: String): String {
    // Forge's own words on the real engine (TriggerTargetProbe): "Eerie — Whenever …, put a +1/+1 counter on target creature.
    // [Zone Changer: Sheltered by Ghosts (54)]". The engine's bracketed note and the ability word are not part of what it does.
    var does = a.text.replace(Regex("\\s*\\(Targeting ERROR\\)"), "").replace(Regex("\\s*\\[[^\\]]{0,120}\\]\\s*$"), "")
        .replace(Regex("^[A-Z][A-Za-z' ]{1,24} — "), "").trim()
    Regex("^(?:When|Whenever|At the beginning)\\b[^,]{0,90}, (.+)$", RegexOption.IGNORE_CASE).find(does)?.let { does = it.groupValues[1] }
    if (does.startsWith(a.name, ignoreCase = true)) does = does.drop(a.name.length).trim()
    val body = if (does.length in 8..ASK_TEXT_MAX && Regex("\\btarget\\b", RegexOption.IGNORE_CASE).containsMatchIn(does) && does.count { it == '.' } <= 1) does
        else plain.replace(Regex("\\s+for ${Regex.escape(a.name)}$", RegexOption.IGNORE_CASE), "")
    val low = body.trim().trimEnd('.').let { b -> if (b.length > 1 && b[0].isUpperCase() && !b[1].isUpperCase()) b[0].lowercase() + b.drop(1) else b }
    return "$low."
}
/** M2: the words on an offered target while a question offers both sides. */
internal const val ABILITY_LABEL = "ABILITY"
/** M2: a seat's name as its tag wears it (capitals, as the squares do). */
internal fun sideName(name: String): String = name.trim().uppercase().ifEmpty { "PLAYER" }
/** M2: the names on the tags, yours then the other side's. */
internal val LocalSideNames = androidx.compose.runtime.compositionLocalOf { "YOU" to "CPU" }
/** M1: what a spell or ability does is said in the question when it is this short; longer, the question says only what to pick. */
internal const val ASK_TEXT_MAX = 90

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
        // Mobile table M1: a target question always starts with the card that asks it, never a bare "Select target creature".
        asker(st)?.let { a -> return askerLine(a, if (stackOnly) ask else a.pick.ifEmpty { ask }.replace(Regex("^Select\\b"), "Choose")) }
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
private fun AskLine(text: String, W: Dp, H: Dp, d: Du, bottom: Dp? = null, goldInset: Dp = 0.dp, leftLimit: Dp? = null, onRight: (Dp) -> Unit = {}) = with(d) {
    val density = LocalDensity.current
    val anchors = LocalAnchors.current
    // Thor 0.4.56 (Sheltered by Ghosts: "Choose target nonland permanent an opponent contr…"): on two screens the hand fan is on the
    // bottom screen, so the line need not keep the fan's 444 du clear. It is centred 15 du right of the middle and its right end
    // stays 12 du short of the gold button at its 138 du minimum; a line that still does not fit takes a second line upward.
    // Live 0.4.57 on the Thor (fault list 5): the centred two-line pill came down over your seat's tool row and hid the Full
    // Control hand. With [leftLimit] (the tray's right end plus 12 du) it is never wider than keeps its left end there; the
    // text takes its second line instead. The line does not move up, so the table keeps its space.
    val wide = if (bottom == null) W - 444.du else maxOf(W - 444.du, W - 330.du - goldInset * 2)
    val maxW = leftLimit?.let { minOf(wide, ((30.du + W / 2 - it) * 2).coerceAtLeast(0.dp)) } ?: wide
    val place = if (bottom == null) Modifier.offset(x = 30.du, y = H - 64.du)
        else Modifier.offset(x = 30.du).layout { m, c -> val p = m.measure(c.copy(minHeight = 0)); layout(p.width, p.height) { p.place(0, bottom.roundToPx() - p.height) } }
    Box(Modifier.fillMaxWidth().then(place).wrapContentHeight(unbounded = true, align = Alignment.Bottom), contentAlignment = Alignment.BottomCenter) {
        // Its right end on the board (it is centred in a box that starts 30 du in), for the gold button (BB8).
        Box(Modifier.widthIn(max = maxW).anchorRect("askline").onGloballyPositioned { c -> onRight(30.du + with(density) { c.boundsInParent().right.toDp() }) }.drawBehind {
            drawIntoCanvas { c ->
                val p = Paint().asFrameworkPaint().apply { isAntiAlias = true; color = Color(0x40F2D18E).toArgb(); maskFilter = android.graphics.BlurMaskFilter(11.du.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
                c.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, size.height / 2, size.height / 2, p)
            }
            drawRoundRect(Color(0xBB000000), topLeft = Offset(0f, 10.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2))
        }.clip(RoundedCornerShape(999.dp)).background(Color(0xF010131B))
            .background(Brush.linearGradient(listOf(Color(0x14FFFFFF), Color(0x03FFFFFF), Color.Transparent)))
            .border(1.dp, Color(0xAAF2D18E), RoundedCornerShape(999.dp)).padding(horizontal = 16.du, vertical = 8.du)) {
            Text(text, style = sans(sp(14f), FontWeight.Bold, Color(0xFFFBF3DF)), maxLines = if (bottom == null) 1 else 2, overflow = TextOverflow.Ellipsis,
                onTextLayout = { if (it.hasVisualOverflow) anchors?.putRect("askline.cut", androidx.compose.ui.geometry.Rect.Zero) })
        }
    }
}


// ---- The tile's decoration layer (play-board-badges.js tileLayerHtml, play-forge-table.css .cs-*) ----

private val BadgeEdge = Color(0xB8D6AD64)
private val BadgeInk = Color(0xFFF2D496)

@Composable
private fun TileLayer(card: Card, actionable: Boolean, lookup: (Int) -> Card?, d: Du, h: Dp, statFont: Float, top: Dp? = null,
                      /** 0.4.60 G1: the tile's width, the part of it that shows (an overlapped pile), and the P/T plate's size and side. */
                      w: Dp? = null, visibleW: Dp? = null, plate: Pair<Dp, Dp>? = null, plateLeft: Boolean = false,
                      /** M14: false on a whole planeswalker card, whose loyalty is in the shield on its bottom edge. */
                      plaque: Boolean = true) = with(d) {
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
        val tileAnchors = LocalAnchors.current
        val rail: @Composable () -> Unit = {
            b.keywords.forEach { badge(it.key) }
            if (b.keywordsMore > 0) badge(null, ink = Color.White, text = "+${b.keywordsMore}", dashed = true)
        }
        val top = top ?: 14.du
        // 0.4.60 G6: no corner pill for an ability (glow-rules.md): the usable ring is its mark, the inspect view its button.
        if (b.state.isNotEmpty() || (b.compact && (b.keywords.isNotEmpty() || b.keywordsMore > 0)))
            Row(Modifier.offset(x = 3.du, y = top).then(if (tileAnchors != null) Modifier.onGloballyPositioned { tileAnchors.putRect("state${card.id}", it.boundsInRoot()) } else Modifier),
                horizontalArrangement = Arrangement.spacedBy(1.du)) {
                b.state.forEach { badge(it) }
                if (b.compact) rail()
            }
        b.combat?.let { cb ->
            Box(Modifier.align(Alignment.TopCenter).offset(y = 13.du)) {
                if (cb == "attacking") badge("attacking", edge = Color(0xFFFF9D5C), ink = Color(0xFFFFB27A), glow = Color(0x99FF8A3D))
                else badge("blocking", edge = Color(0xFF7FB8FF), ink = Color(0xFFA8CEFF), glow = Color(0x995A9CFF))
            }
        }
        // 0.4.60 G1 (glance-marks-brief.md): a creature's keywords are a strip along the bottom edge, left of the P/T plate, big enough
        // to read at a glance: marks 22 % of the tile tall (never under 16 dp), the icon 74 % of the mark, the same dark pill with a
        // gold hairline and a gold icon. Marks show in rank order while they fit; the rest are one "+N". A squeezed tile (narrower
        // than it is tall) stacks them up the left edge from the bottom, the first keyword lowest, at most two. Lands and other
        // compact tiles keep the rail above.
        val kh = maxOf(16.dp, h * .22f)
        val kGap = 2.du
        val tileW = w ?: (h * 1.3f)
        var stripH = 0.dp
        // 0.4.60 G1 review: the strip keeps off the state corner (tapped, summoning sick: on the do-not-rebuild list; before G1 the rail
        // started 3 du under it), and leaves room above it for the crew or equipment badge, which sits on top of the strip.
        val attached = card.attachments.mapNotNull(lookup).filter { !it.hidden }
        val lowBadge = b.crew != null || attached.any { !BEHIND.containsMatchIn(it.type) }
        val ceil = (if (b.state.isNotEmpty()) top + bsz + 3.du else top) + (if (lowBadge) bsz + 2.du else 0.dp)
        // fitRails(): when the counters column would run into the stats plaque, it becomes a row (row-reverse) sitting 3px above the plaque.
        val railN = b.counters.size + (if (b.countersMore > 0) 1 else 0) + (if (b.damage > 0) 1 else 0)
        val floor = if (statFont > 0f) 2.du + (statFont * 1.25f + 4f).du else 0.du
        val railRow = statFont > 0f && top + bsz * railN + 2.du * (railN - 1) + 3.du > h - floor - 2.du
        // G1 review: the counters rail's own width (each badge as badge() lays it out), so the strip can keep clear of it.
        val railMeasurer = androidx.compose.ui.text.rememberTextMeasurer()
        val railDens = LocalDensity.current.density
        val badgeStyle = sans(sp(6.8f), FontWeight.Bold, Color.White).copy(lineHeight = sp(6.8f))
        fun badgeW(icon: Boolean, text: String?): Dp {
            val t = text?.let { (railMeasurer.measure(it, badgeStyle).size.width / railDens).dp } ?: 0.dp
            val inner = (if (icon) bsz * .72f else 0.dp) + t + (if (icon && text != null) 1.du else 0.dp)
            return maxOf(bsz, inner + bsz * .24f)
        }
        val railWs = if (railN == 0) emptyList() else b.counters.map { c -> if (c.icon != null) badgeW(true, "${c.count}") else badgeW(false, "${c.count} ${c.label.take(4)}") } +
            (if (b.countersMore > 0) listOf(badgeW(false, "+${b.countersMore}")) else emptyList()) + (if (b.damage > 0) listOf(badgeW(true, "${b.damage}")) else emptyList())
        val railW = if (railWs.isEmpty()) 0.dp else if (railRow) railWs.fold(0.dp) { a, x -> a + x } + 1.du * (railWs.size - 1) else railWs.maxOf { it }
        val railLeft = tileW - 3.du - railW
        // The rail as a column: from [top] down, bsz a badge.
        val railColBottom = top + bsz * railN + 1.du * (railN - 1).coerceAtLeast(0)
        // Where the rail row sits above the bottom (raised over a squeezed strip when the two would meet: see below).
        var railLift = floor + 3.du
        // 0.4.60 G2: keywords without an icon (Toxic 1, Prowess...) follow the icons as word marks, the same height and pill, as wide as
        // Forge's word; the same fit rule, in order while they fit, the rest in the "+N".
        val strip = if (b.compact) emptyList() else b.strip
        val kFont = (kh.value * .52f).sp
        val kStyle = sans(kFont, FontWeight.ExtraBold, Color.White).copy(lineHeight = kFont)
        val kMeasurer = androidx.compose.ui.text.rememberTextMeasurer()
        val kDens = LocalDensity.current.density
        if (strip.isNotEmpty()) {
            val anchors = LocalAnchors.current
            val squeezedK = tileW < h
            val right = (visibleW?.coerceAtMost(tileW) ?: tileW) - 3.du
            // The plate: right 6 du, bottom 2 du (left 3 du while the next pile covers this tile's right part).
            val px0 = plate?.let { if (plateLeft) 3.du else tileW - 6.du - it.first }
            val px1 = plate?.let { if (plateLeft) 3.du + it.first else tileW - 6.du }
            val n = strip.size
            // A word mark: padding .42 em each side round the word (the preview's .k), never narrower than an icon mark.
            val pad = kFont.value * .42f
            val markW = strip.map { k -> if (k.key != null) kh.value else maxOf(kh.value, kMeasurer.measure(k.label, kStyle).size.width / kDens + 2 * pad + 1f) }
            val x0: Dp; val bottom: Dp; val shown: Int; val more: Int
            if (!squeezedK) {
                x0 = if (plate != null && plateLeft) px1!! + 4.du else 3.du
                bottom = 3.du
                // G1 review: the counters rail, as a row over the plate or a column down the right, ends the strip when they share a height.
                val railMeets = railN > 0 && (if (railRow) h - bottom - kh < h - floor - 3.du else h - bottom - kh < railColBottom)
                val x1 = minOf(if (plate != null && !plateLeft) minOf(right, px0!! - 4.du) else right, if (railMeets) railLeft - 2.du else right)
                val room = (x1 - x0).value
                // Never up into the name, the state corner or the badge above the strip.
                shown = if (h - bottom - kh < ceil) 0 else TileBadges.stripFit(markW, room, kGap.value, kh.value)
                more = if (h - bottom - kh < ceil || (shown < n && kh.value > room + .01f)) 0 else n - shown
            } else {
                x0 = 3.du
                // Over the plate when the plate reaches the left column; up to the name, never into it.
                bottom = if (plate != null && px0!! < x0 + kh + 2.du && px1!! > x0) 2.du + plate.second + 3.du else 3.du
                // G1 review: the counters rail reaching over the left column: a column rail ends the strip below it; a row rail is lifted
                // over the strip, so the strip leaves room for it as for the badge above it.
                val railMeets = railN > 0 && railLeft < x0 + kh + 2.du
                val top2 = when { !railMeets -> ceil; railRow -> ceil + bsz + 2.du; else -> maxOf(ceil, railColBottom + 2.du) }
                val slots = minOf(TileBadges.SQUEEZED_MARKS, TileBadges.stripSlots((h - bottom - top2).value, kh.value, kGap.value))
                // A word wider than the tile's free width folds into the "+N" with what follows it.
                val wide = markW.indexOfFirst { it > (right - x0).value + .01f }.let { if (it < 0) n else it }
                shown = minOf(TileBadges.stripShown(n, slots), wide)
                more = if (slots > 0) n - shown else 0
            }
            anchors?.let { it.sizes["kwshown${card.id}"] = shown.toFloat(); it.sizes["kwmore${card.id}"] = more.toFloat() }
            @Composable fun mark(k: TileBadges.Keyword?, i: Int, text: String? = null) {
                val word = k != null && k.key == null
                Box(Modifier.height(kh).width(if (word) markW[i].dp else kh).then(if (anchors != null) Modifier.onGloballyPositioned { anchors.putRect(if (k != null) "kw${card.id}.$i" else "kwplus${card.id}", it.boundsInRoot()) } else Modifier)
                    .drawBehind { drawRoundRect(Color(0xB3000000), topLeft = Offset(0f, 1.dp.toPx()), size = this.size, cornerRadius = CornerRadius(this.size.height / 2)) }
                    .clip(RoundedCornerShape(50)).background(Color(0xF0101114))
                    .border(1.dp, if (k != null) Color(0xFFD6AD64) else Color(0x8CFFFFFF), RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                    if (k?.key != null) BoardIcon(k.key, BadgeInk, kh * .74f)
                    else Text(if (word) k!!.label else text ?: "", maxLines = 1, softWrap = false, style = kStyle)
                }
            }
            if (shown + more > 0) {
                val list = strip.take(shown).mapIndexed { i, k -> Triple(k as TileBadges.Keyword?, i, null as String?) } + (if (more > 0) listOf(Triple(null as TileBadges.Keyword?, shown, "+$more")) else emptyList())
                if (!squeezedK) Row(Modifier.align(Alignment.BottomStart).offset(x = x0, y = -bottom), horizontalArrangement = Arrangement.spacedBy(kGap)) { list.forEach { (k, i, t) -> mark(k, i, t) } }
                // First keyword lowest: the column is laid bottom up.
                else Column(Modifier.align(Alignment.BottomStart).offset(x = x0, y = -bottom), verticalArrangement = Arrangement.spacedBy(kGap, Alignment.Bottom)) {
                    list.asReversed().forEach { (k, i, t) -> mark(k, i, t) }
                }
                stripH = bottom + (if (squeezedK) kh * (shown + more) + kGap * (shown + more - 1) else kh)
                if (squeezedK && railRow && railN > 0 && railLeft < x0 + kh + 2.du) railLift = maxOf(railLift, stripH + 2.du + (if (lowBadge) bsz + 2.du else 0.dp))
            }
        }
        val railAnchor = if (tileAnchors != null) Modifier.onGloballyPositioned { tileAnchors.putRect("rail${card.id}", it.boundsInRoot()) } else Modifier
        @Composable fun railBox(content: @Composable () -> Unit) = if (railRow)
            Row(Modifier.align(Alignment.BottomEnd).offset(x = (-3).du, y = -railLift).then(railAnchor), horizontalArrangement = Arrangement.spacedBy(1.du, Alignment.End), verticalAlignment = Alignment.CenterVertically) { content() }
        else Column(Modifier.align(Alignment.TopEnd).offset(x = (-3).du, y = top).then(railAnchor), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.du)) { content() }
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
        if (plaque) b.plaque?.let { (kind, value) ->
            Row(Modifier.align(Alignment.BottomEnd).offset(x = (-4).du, y = (-4).du).clip(RoundedCornerShape(5.du)).background(Color(0xF2111114)).border(1.dp, Color(0xC0D6AD64), RoundedCornerShape(5.du))
                .padding(start = 3.du, end = 5.du, top = 1.du, bottom = 1.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.du)) {
                BoardIcon(if (kind == "loyalty") "loyalty" else "defense", BadgeInk, bsz * .8f)
                Text("$value", style = sans(sp(9f), FontWeight.Bold, Color.White))
            }
        }
        b.crew?.let { crew ->
            Row(Modifier.align(Alignment.BottomStart).offset(x = 3.du, y = if (stripH > 0.dp) -(stripH + 2.du) else (-4).du).then(if (tileAnchors != null) Modifier.onGloballyPositioned { tileAnchors.putRect("low${card.id}", it.boundsInRoot()) } else Modifier).clip(RoundedCornerShape(999.dp)).background(Color(0xEB101114)).border(1.dp, BadgeEdge, RoundedCornerShape(999.dp))
                .padding(start = 2.du, end = 4.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(1.du)) {
                BoardIcon("vehicle-crew", BadgeInk, bsz * .7f); Text("$crew", style = sans(sp(6.5f), FontWeight.Bold, Color.White))
            }
        }
        if (attached.any { !BEHIND.containsMatchIn(it.type) } && b.crew == null) {
            // T4, M13: auras and equipment show as strips above the tile (AuraStrips), so the corner badge counts only what is neither.
            val kinds = listOf("attached" to attached.count { !BEHIND.containsMatchIn(it.type) }).filter { it.second > 0 }
            Row(Modifier.align(Alignment.BottomStart).offset(x = 3.du, y = if (stripH > 0.dp) -(stripH + 2.du) else (-4).du)
                .then(if (tileAnchors != null) Modifier.onGloballyPositioned { tileAnchors.putRect("low${card.id}", it.boundsInRoot()) } else Modifier), horizontalArrangement = Arrangement.spacedBy(1.du)) {
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

/** T5 item 1, P2: when a cast's lands tap ([taps], in order), land [id]'s turn starts this long after the first (80 ms apart); null: not one of them. */
internal fun tapDelay(taps: List<Int>, id: Int): Long? = taps.indexOf(id).takeIf { it >= 0 }?.let { it * dev.cardstashy.nativeplay.match.Director.TAP_GAP_MS }

/** Match punch P7: the paying sources of the card you hold light this far apart (ms), and shed a slow ember each in turn. */
internal const val PAY_LIGHT_GAP_MS = 40

/** P7: while the payment light is on, its sources shed slow gold embers, one source every 130 ms in turn. */
@Composable
private fun PayEmbers(lit: Set<Int>) {
    val fx = LocalBattlefield.current ?: return
    val anchors = LocalAnchors.current ?: return
    val density = LocalDensity.current.density
    val ids = lit.toList()
    LaunchedEffect(ids) {
        if (ids.isEmpty() || Motion.still || fx.reduced || fx.low) return@LaunchedEffect
        delay(ids.size * PAY_LIGHT_GAP_MS.toLong())
        var i = 0
        while (true) {
            anchors.rects["c${ids[i % ids.size]}"]?.let { r -> fx.bits.embers(Offset(r.center.x, r.top + r.height * .3f) - fx.origin, 1, Color(0xFFFFD98A), fx.now.longValue, 22f * density, lifeMs = 900, sizePx = 1.3f * density, seed = i) }
            i++; delay(130)
        }
    }
}

/** Match punch P5: the attackers the board on show has just declared, in the order they step up ([declareOrder]); empty otherwise. */
internal val LocalDeclare = androidx.compose.runtime.compositionLocalOf<List<Int>> { emptyList() }

/**
 * Match punch P5, the declare: 0..1 as an attacker steps up (210 ms with a small overshoot, each 95 ms after the one before it in
 * attack order) and as it goes home after combat (260). With reduce motion, and in still pictures, it is simply there.
 */
@Composable
private fun attackStep(card: Card): androidx.compose.runtime.State<Float> {
    val i = LocalDeclare.current.indexOf(card.id).coerceAtLeast(0)
    val calm = Motion.still || LocalBattlefield.current?.reduced == true
    return animateFloatAsState(if (card.attacking) 1f else 0f, when {
        calm -> androidx.compose.animation.core.snap()
        card.attacking -> tween(DECLARE_MS, delayMillis = (i * DECLARE_GAP_MS).toInt(), easing = androidx.compose.animation.core.Easing { backOut(it) })
        else -> tween(260, easing = FastOutSlowInEasing)
    }, label = "attackStep")
}

/**
 * A tile's own layer while it attacks (the tile and its aura strips share it): stepped [advance] px toward the other side and 8 %
 * larger. The growth is taken off the step, so its leading edge reaches no further than it did before P5: it never crosses the
 * centre line or covers the row it faces (walk line 36).
 */
internal fun androidx.compose.ui.graphics.GraphicsLayerScope.attackLayer(tapped: Boolean, step: Float, mineSide: Boolean, advance: Float) {
    val s = (if (tapped) .94f else 1f) * (1f + ATTACK_GROW * step); scaleX = s; scaleY = s
    translationY = (if (mineSide) -1f else 1f) * attackShift(step, advance, size.height)
}
internal const val ATTACK_GROW = .08f
/** How far an attacker has stepped (px) at [step] of its declare: the advance less half of the growth, never backward when it has settled. */
internal fun attackShift(step: Float, advance: Float, tileH: Float): Float = (advance - tileH * ATTACK_GROW / 2f).coerceAtLeast(0f) * step

/** Match punch P4: the tiles readied by the turn that just began, in ripple order ([untapOrder]); empty otherwise. */
internal val LocalUntapRipple = androidx.compose.runtime.compositionLocalOf<List<Int>> { emptyList() }

/** A tile's turn as it taps: a paying land one by one (170 ms each, 80 ms apart) while its cast's taps play, any other tap 180 ms. */
@Composable
private fun tapSpec(id: Int): androidx.compose.animation.core.AnimationSpec<Float> {
    // Match punch P4, the untap ripple: on a new turn the readied tiles turn back one after another (240 ms each with a bounce, 50 ms
    // apart, from 140 ms in) under the banner.
    LocalUntapRipple.current.indexOf(id).takeIf { it >= 0 }?.let { i ->
        return tween(UNTAP_TURN_MS, delayMillis = (UNTAP_AT_MS + i * UNTAP_GAP_MS).toInt(), easing = androidx.compose.animation.core.Easing { backOut(it) }) }
    val t = LocalTravel.current?.travel?.takeIf { it.leg == dev.cardstashy.nativeplay.match.Director.Leg.TAPS || it.leg == dev.cardstashy.nativeplay.match.Director.Leg.TO_POOL }
    // P2b: a cast that also spends floating mana sends the pool's streaks first; its lands follow them.
    val at = t?.let { tr -> tapDelay(tr.taps, id)?.let { it + tr.pool * dev.cardstashy.nativeplay.match.Director.TAP_GAP_MS } }
    // Match punch P2, Pay: a paying land turns with a bounce (a small overshoot past its tapped angle, then back).
    return if (at != null) tween(dev.cardstashy.nativeplay.match.Director.TAP_TURN_MS.toInt(), delayMillis = at.toInt(), easing = androidx.compose.animation.core.Easing { backOut(it) })
        else tween(180, easing = FastOutSlowInEasing)
}

/**
 * 0.4.59 T6: the question line's two parts, the asking card's name (drawn in the aim colour) and the question. [askLine] stays
 * as it is (the bottom screen and other tests read it); a " for <card>" it ends with moves into [name].
 */
internal data class AskParts(val name: String?, val question: String)

internal fun askParts(st: MatchState): AskParts? {
    val ask = askLine(st) ?: return null
    // Mobile table M1: the asker Forge names, a trigger's as well as a spell's; its name is drawn once, in the aim colour.
    asker(st)?.let { a -> if (ask.startsWith(a.name + ": ")) return AskParts(a.name, ask.drop(a.name.length + 2).replaceFirstChar { it.uppercase() }) }
    Regex("^((?:Choose|Tap|Select) (?:a |any )?targets?) for (.+)$").find(ask)?.let { m -> return AskParts(m.groupValues[2].trim(), m.groupValues[1] + ".") }
    val name = pendingCast(st)?.name?.takeIf { it.isNotBlank() }
        ?: if (st.inputType == "InputSelectTargets") Regex("targets? for ([^\n]+)", RegexOption.IGNORE_CASE).find(st.message)?.groupValues?.get(1)?.trim()?.replace(Regex("\\s*\\(\\d+\\)$"), "") else null
    return AskParts(name, ask)
}

/**
 * 0.4.59 T6 (glow rule 5, hand cards are not answers): on one screen, while Forge asks you to pick on the table (targets, a card to
 * sacrifice, a card to keep), the hand dips and fades and the question takes its strip. Not for blocks (staged combat keeps its
 * own buttons), a discard (the hand is the answer), a payment or "Respond to …?".
 */
internal fun handTucked(st: MatchState, live: Boolean, anyScreen: Boolean = false): Boolean {
    if (!live || st.prompt != null || (DualScreen.active && !anyScreen)) return false
    val input = st.inputType ?: return false
    if (input in setOf("InputPassPriority", "InputAttack", "InputBlock", "InputConfirmMulligan", "InputLockUI") || input.startsWith("InputPayMana")) return false
    if (dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) != null) return false
    val sel = st.selection
    if (sel.cards.size + sel.targetCards.size + sel.players.size + sel.stackTargets.size == 0) return false
    val hand = st.me.hand.map { it.id }.toSet()
    if ((sel.cards + sel.targetCards).any { it in hand }) return false
    return askLine(st) != null
}

/** How far the hand dips while it is tucked (a share of its visible height) and how much of it still shows. */
internal object AskTuck { const val DIP = .58f; const val SHADE = .40f }

/**
 * Mobile table M1 (it was 0.4.59 T6's pill in the hand's strip): the question on one screen, one plain line on the middle of the
 * table: the asking card's name, then the question, on one line (smaller first, then cut with … , never wrapped) between [left]
 * and [right], centred there on the line between the rows ([mid]).
 */
@Composable
private fun TuckedAskLine(parts: AskParts, left: Dp, right: Dp, mid: Dp, d: Du, big: Boolean) = with(d) {
    val anchors = LocalAnchors.current
    val room = (right - left).coerceAtLeast(40.du)
    val h = if (big) 30.du else 24.du
    val words = parts.name?.let { n -> "$n: " + parts.question.let { q -> if (q.length > 1 && !q[1].isUpperCase()) q.replaceFirstChar { it.lowercase() } else q } } ?: parts.question
    Box(Modifier.offset(x = left, y = mid - h / 2).width(room).height(h), contentAlignment = Alignment.Center) {
        Box(Modifier.widthIn(max = room).height(h).anchorRect("askline").clip(RoundedCornerShape(999.dp)).background(Color(0xDB080A10)).padding(horizontal = 14.du),
            contentAlignment = Alignment.Center) {
            // One line: the size steps down before the words are cut with … .
            androidx.compose.foundation.text.BasicText(words, style = sans(sp(if (big) 17f else 14f), FontWeight.Bold, Color(0xFFEEF0F4)), maxLines = 1, overflow = TextOverflow.Ellipsis,
                autoSize = androidx.compose.foundation.text.TextAutoSize.StepBased(minFontSize = sp(10.5f), maxFontSize = sp(if (big) 17f else 14f), stepSize = sp(.5f)),
                onTextLayout = { if (it.hasVisualOverflow) anchors?.putRect("askline.cut", androidx.compose.ui.geometry.Rect.Zero) })
        }
    }
}

/** The tucked question's two buttons' words: Cancel (in the gold spot), then the confirm Forge offers, if any ("No target", or OK for several). */
internal fun tuckLabels(st: MatchState): List<String> {
    val pickOne = oneTarget(st) || onePick(st)
    val confirm = if (pickOne) (if (st.selection.min == 0 && st.buttons.okEnabled) "No target" else null) else okLabel(st).takeIf { st.buttons.okEnabled || st.selection.max > 1 }
    return listOfNotNull(cancelLabel(st) ?: "Cancel", confirm)
}

/**
 * 0.4.60 G5: the battlefield card the ring is on (a pile's top tile), read by the dual bottom screen's panel; null when it is off
 * the board. One per ForgeBoard (G5 review: it lived in TableZones for the whole process and was never cleared).
 *
 * The tile's focus callback can run while the board composes, applies or disposes; a state write there clashed with the same
 * write made outside composition ("Unsupported concurrent change during composition"). So [on] and [off] post the write to the
 * main thread's queue, in the order they were made, and it always lands outside composition.
 */
internal class RingedTile {
    var id by mutableStateOf<Int?>(null)
        private set
    private val main = android.os.Handler(android.os.Looper.getMainLooper())
    fun on(card: Int) { main.post { id = card } }
    /** Clears the reading only if [card] still holds it (the ring may have moved on already). */
    fun off(card: Int) { main.post { if (id == card) id = null } }
}

internal val LocalRinged = androidx.compose.runtime.staticCompositionLocalOf<RingedTile?> { null }
