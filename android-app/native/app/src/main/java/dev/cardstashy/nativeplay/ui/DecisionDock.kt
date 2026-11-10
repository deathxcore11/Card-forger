package dev.cardstashy.nativeplay.ui

import android.graphics.BlurMaskFilter
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.R
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Prompt
import dev.cardstashy.nativeplay.engine.PromptOption
import kotlinx.coroutines.delay

/*
 * The decision dock for Forge's modal questions (st.prompt), ported from the site's hosted panel
 * (experiments/forge-proof/native-panel.mjs, prompt section ~218-400 and 440-473) and its rules in play-forge-table.css,
 * as measured at 844 × 390 (scratchpad site/dockprobe.mjs). Every size is that measurement in design units (1 u = 1 CSS px).
 *
 *  - order prompts (Order your triggers) and damage splits: the centred card dialog (.forge-order-cards / .forge-assign-cards);
 *  - a search of library / graveyard / exile: the full-screen picker (.forge-zone-search);
 *  - optional costs (Kicker…), confirm, showInputDialog, reveals and plain choice lists: the dock's column at the bottom right;
 *  - anything else: the site's "not yet adapted" line, and no reply.
 *
 * The site keeps the player's draft (picked options, the order) in its session until Confirm; here it lives in this
 * composable, keyed by revision and prompt, and Confirm sends it with TableIntents.reply.
 */

/** Replies the site sends that TableIntents.reply cannot carry. Unwired, the dock sends what reply can (see each). */
class DockReplies(
    /** session.replyValue(string) for showInputDialog. Unwired: the input's Confirm does nothing. */
    val text: ((promptId: Int, value: String) -> Unit)? = null,
    /** An order with "Remember this order" (confirmPrompt's remember flag). Unwired: reply(indexes) without it. */
    val order: ((promptId: Int, indexes: List<Int>, remember: Boolean) -> Unit)? = null,
    /** replyAmounts(null): "As though unblocked" (skip: true). Unwired: the button is not offered. */
    val skipAmounts: ((promptId: Int) -> Unit)? = null,
    /** E3c: leave a match stuck on a prompt nothing can answer, as no result. Unwired (a friend match): the line shows alone. */
    val leave: (() -> Unit)? = null,
)

/**
 * Forge's modal question, drawn over the table. Call it on every frame of the match (it shows nothing while there
 * is no prompt, but it carries the mode back-out from one decision to the next, native-panel.mjs:152-170).
 */
@Composable
fun DecisionDock(st: MatchState, live: Boolean, intents: TableIntents, onInspect: (Card) -> Unit, u: Float, modifier: Modifier = Modifier, replies: DockReplies = DockReplies()) {
    BackOutStep(st, live, intents)
    // A controller: once the question is answered the ring goes back to where it was on the table (only if the dock took it).
    LaunchedEffect(st.prompt == null) { if (st.prompt == null && DockFocus.took) { DockFocus.took = false; TablePad.restore() } }
    // The dock owns the pad while it asks (the table's Start and X wait); each kind adds its own X, the gold answer. Always composed,
    // so its place among the layers stays put (an open card drawn over the table stays above it).
    PadScreen(PadActs(opaque = st.prompt != null && st.failure == null && !st.finished))
    val p = st.prompt ?: return
    if (st.failure != null || st.finished) return
    val d = DockU(u)
    val pad = remember(p.id) { DockFocus() }
    BoxWithConstraints(modifier.fillMaxSize()) {
        val W = maxWidth; val H = maxHeight
        val ctx = DockCtx(st, p, live, intents, replies, onInspect, d, W, H, pad)
        // Draft: s.nativeDraft for this revision and prompt (forge-session.mjs selectPrompt / clearPrompt).
        val draft = remember(st.revision, p.id, p.method) { mutableStateListOf<Int>() }
        val zone = zoneSearch(st)
        // native-panel.mjs:218-221
        val hostedOrder = p.method == "order" && p.supportedExact && p.ordered
        val optionalCosts = p.supportedExact && p.method in setOf("order", "getChoices") && p.options.isNotEmpty() && p.options.all { it.kind == "optionalCost" }
        // The turn clock's ring goes round the prompt's confirm button (the site's [data-native-key=confirm-prompt]), drawn over the dock.
        val ring = remember { PromptRing() }
        androidx.compose.runtime.CompositionLocalProvider(LocalPromptRing provides ring) {
        when {
            zone != null -> ZoneSearchDialog(ctx, zone, draft)                                                       // :257-307
            !p.supportedExact || (p.method == "order" && !p.ordered) -> SideDock(ctx) { DeadEnd(ctx) }  // :309
            optionalCosts -> SideDock(ctx) { OptionalCosts(ctx, draft) }                                             // :310-326
            p.method in AMOUNT_METHODS && amountSpec(p) != null -> AssignDialog(ctx)                                 // :318-341
            p.method in setOf("confirm", "showConfirmDialog") -> SideDock(ctx) { ConfirmChoice(ctx) }                // :342-346
            p.method == "showInputDialog" -> SideDock(ctx) { InputDialog(ctx) }                                      // :346-353
            p.acknowledgeOnly && p.method == "getChoices" -> SideDock(ctx) { Reveal(ctx) }                           // :354-359
            p.method in OPTION_METHODS && hostedOrder -> OrderDialog(ctx, draft)                                     // :363-382
            // U4: the choice reads as the search picker does (framed, the card's name on top, Forge's question under it).
            p.method in OPTION_METHODS -> TitledDock(ctx, choiceTitle(p, st).ifEmpty { "Your choice" }) { ChoiceList(ctx, draft) }  // :384-395
            else -> SideDock(ctx) { DeadEnd(ctx) }        // :397
        }
        }
        PromptRingLayer(ring, u, Modifier.fillMaxSize())
        // A controller: the ring goes into the dock as the question opens (its first choice, or its gold answer), once laid out.
        // Tried again if the choice could not take it yet (busy); never pulled back while the ring is already in the dock.
        LaunchedEffect(p.id, ctx.busy) { if (Pad.connected.value && !pad.inside && !(TablePad.held && !DockFocus.took)) { withFrameNanos { }; runCatching { pad.first.requestFocus() } } }
    }
}

/** The controller's way into one decision: [first] is the choice the ring starts on; [inside] while the ring is anywhere in the dock. */
private class DockFocus {
    val first = FocusRequester()
    var inside by mutableStateOf(false)
    companion object { /** The dock took the ring from the table (TablePad.held), so it hands it back when the question ends. */ var took = false }
}

/** On the dock's own box: notes the ring in it, and that the table should get it back afterwards. */
private fun Modifier.dockFocus(ctx: DockCtx): Modifier = onFocusChanged { ctx.pad.inside = it.hasFocus; if (it.hasFocus && Pad.connected.value) { TablePad.held = true; DockFocus.took = true } }

/** The ring's first stop in the dock. */
private fun Modifier.padFirst(ctx: DockCtx): Modifier = focusRequester(ctx.pad.first)

// ---- Logic (native-panel.mjs helpers) ----

/** native-panel.mjs:2 */
internal val OPTION_METHODS = setOf("getChoices", "getAbilityToPlay", "chooseSingleEntityForEffect", "chooseEntitiesForEffect", "showOptionDialog", "order")
/** native-panel.mjs:3 */
private val SEARCH_ZONES = setOf("Library", "Graveyard", "Exile")
/** native-panel.mjs:57 */
internal val AMOUNT_METHODS = setOf("assignCombatDamage", "assignGenericAmount")

/** plainText (native-panel.mjs:86): Forge's " (49)" ids off card names. */
internal fun plainText(line: String): String = line.replace(Regex(" \\(\\d+\\)(?=[\\s,.:;!?)]|$)"), "").trim()

/** seatWords (native-panel.mjs:167). */
internal fun seatWords(msg: String): String = msg
    .replace(Regex("\\b(?:CardStashy|You|[^,\\n]{1,40}), you are going (first|second|1st|2nd)[!.]?", RegexOption.IGNORE_CASE)) { m ->
        val w = m.groupValues[1].lowercase(); "You’re going ${mapOf("1st" to "first", "2nd" to "second")[w] ?: w}." }
    .replace(Regex("\\s*Do you want to keep your hand\\??", RegexOption.IGNORE_CASE), "")
    .replace(Regex("\\bCardStashy's\\b"), "your").replace(Regex("\\bCardStashy\\b"), "You")
    .replace(Regex("Forge AI\\s+—\\s+[^\\n]*?'s\\s+(library|hand|graveyard|deck)\\b"), "the CPU’s $1").trim()

/** cpuName (native-panel.mjs:168). */
internal fun cpuName(msg: String): String = seatWords(msg)
    .replaceFirst(Regex("Forge AI\\b.*?\\s(?=(?:revealed|reveals|picked|picks|chose|chooses|named|names|casts?|plays?|looked|looks)\\b)"), "CPU ")
    .replaceFirst(Regex("Forge AI(?:\\s+—[^·\\n]*·?)?"), "CPU")

/** orderRemainder (native-panel.mjs:78-84): Forge reports an unbounded side as -1. */
internal fun orderRemainder(p: Prompt): String {
    val lo = p.remainingMin?.takeIf { it >= 0 }; val hi = p.remainingMax?.takeIf { it >= 0 }
    if (lo == null && hi == null) return ""
    if (hi == null) return if (lo != null && lo != 0) " Leave at least $lo in the source." else ""
    return " Leave ${if ((lo ?: 0) == hi) "$hi" else "${lo ?: 0}–$hi"} in the source."
}

/** costName (native-panel.mjs:53): "Kicker 2 G" → "Kicker". */
internal fun costName(label: String): String =
    Regex("^[A-Za-z][A-Za-z' -]*?(?=\\s*(?:[:{\\d(]|[WUBRGCX]\\b|$))").find(label)?.value?.trim()?.takeIf { it.isNotEmpty() } ?: "optional cost"

/** amountSpec (native-panel.mjs:58-61). */
internal data class AmountSpec(val combat: Boolean, val amount: Int, val lethal: List<Int?>, val defender: Int?, val free: Boolean, val maySkip: Boolean,
                               val maxima: List<Int>, val atLeastOne: Boolean, val label: String)
internal fun amountSpec(p: Prompt?): AmountSpec? {
    if (p == null || p.method !in AMOUNT_METHODS) return null
    val amount = p.assignAmount ?: return null
    val size = p.options.size
    if (amount < 0 || size == 0) return null
    if (p.method == "assignCombatDamage") {
        if (!p.hasLethal || p.assignLethal.size != size) return null
        return AmountSpec(true, amount, p.assignLethal, p.defenderIndex, p.assignFree, p.maySkip, emptyList(), false, "")
    }
    if (!p.hasMaxima || p.assignMaxima.size != size) return null
    return AmountSpec(false, amount, emptyList(), null, false, p.maySkip, p.assignMaxima, p.assignAtLeastOne, p.assignLabel)
}

/** amountsLegal (native-panel.mjs:64-68). */
internal fun amountsLegal(p: Prompt, amounts: List<Int>): Boolean {
    val spec = amountSpec(p) ?: return false
    if (amounts.size != p.options.size || amounts.any { it < 0 }) return false
    if (amounts.sum() != spec.amount) return false
    if (spec.combat) {
        if (spec.defender != null && amounts.getOrElse(spec.defender) { 0 } > 0 && !spec.free) return amounts.indices.all { i -> i == spec.defender || amounts[i] >= (spec.lethal.getOrNull(i) ?: 0) }
        return true
    }
    return amounts.indices.all { i -> amounts[i] <= spec.maxima[i] && (!spec.atLeastOne || amounts[i] >= 1) }
}

/** amountsDefault (native-panel.mjs:71-76): lethal to each blocker in turn, the rest to the player (or the last blocker). */
internal fun amountsDefault(p: Prompt): List<Int>? {
    val spec = amountSpec(p) ?: return null
    val n = p.options.size; val out = MutableList(n) { 0 }; var left = spec.amount
    if (spec.combat) {
        for (i in 0 until n) { if (left <= 0) break; if (i == spec.defender) continue; val take = minOf(left, maxOf(0, spec.lethal.getOrNull(i) ?: 0)); out[i] = take; left -= take }
        if (left > 0) { val to = spec.defender ?: (0 until n).last(); out[to] += left }
        return out
    }
    if (spec.atLeastOne) for (i in 0 until n) { if (left <= 0) break; out[i] = 1; left-- }
    for (i in 0 until n) { if (left <= 0) break; val room = maxOf(0, spec.maxima[i] - out[i]); val take = minOf(room, left); out[i] += take; left -= take }
    return out
}

/** nativePromptUnanswerable (native-panel.mjs:65-72). */
internal fun promptUnanswerable(p: Prompt?): Boolean {
    if (p == null) return false
    if (!p.supportedExact || (p.method == "order" && !p.ordered)) return true
    if (p.method in AMOUNT_METHODS) { val start = amountsDefault(p); return !((start != null && amountsLegal(p, start)) || amountSpec(p)?.maySkip == true) }
    if (p.method in setOf("confirm", "showConfirmDialog", "showInputDialog") || (p.acknowledgeOnly && p.method == "getChoices")) return false
    if (p.method in OPTION_METHODS) return p.options.count { it.described } < p.min
    return true
}

/** One card in the search picker (nativeZoneSearch, native-panel.mjs:12-21). */
internal data class SearchChoice(val index: Int, val cardId: Int?, val zone: String?, val name: String, val visible: Boolean, val artName: String?)
internal data class ZoneSearch(val choices: List<SearchChoice>, val zones: List<String>, val min: Int, val max: Int)

/** nativeZoneSearch for a prompt (native-panel.mjs:12-21); the dock only draws while Forge asks a prompt. */
internal fun zoneSearch(st: MatchState): ZoneSearch? {
    val p = st.prompt ?: return null
    if (st.failure != null || st.finished) return null
    if (promptUnanswerable(p) || !p.supportedExact || p.acknowledgeOnly || p.method !in setOf("getChoices", "chooseSingleEntityForEffect", "chooseEntitiesForEffect") || p.options.isEmpty()) return null
    val choices = p.options.map { o ->
        val surface = o.cardId?.let { st.card(it) }
        val zone = o.zone ?: surface?.zone
        SearchChoice(o.index, o.cardId, zone, o.label, o.cardId != null, if (surface != null && !surface.hidden) surface.name else o.cardName.takeIf { o.cardId != null })
    }
    if (!choices.all { it.zone in SEARCH_ZONES } || choices.none { it.visible }) return null
    return ZoneSearch(choices, choices.mapNotNull { it.zone }.distinct(), p.min, p.max)
}

/** searchSource (native-panel.mjs:24): the top of the stack while it resolves, else the latest cast or trigger. */
internal fun searchSource(st: MatchState): String {
    st.stack.firstOrNull()?.source?.name?.takeIf { it.isNotEmpty() }?.let { return it }
    for (e in st.events.asReversed()) if (Regex("^(cast|ability|trigger|resolve)$").matches(e.type) && !e.source?.name.isNullOrEmpty()) return e.source!!.name!!
    return ""
}

/** searchAsk (native-panel.mjs:26-27): "Choose 1 card from your library", "Choose up to 2 cards", "Choose 1 to 3 cards". */
internal fun searchAsk(z: ZoneSearch): String {
    val min = z.min; val max = z.max
    if (max < 1) return ""
    val n = if (max == 1) "1 card" else "$max cards"
    val count = if (min == max) n else if (min == 0) "up to $n" else "$min to $n"
    val from = if (z.zones.size == 1) mapOf("Library" to " from your library", "Graveyard" to " from a graveyard", "Exile" to " from exile")[z.zones[0]] ?: "" else ""
    return "Choose $count$from"
}

/** modeBackOutOffered (native-panel.mjs:147-150): Cancel on a spell's mode choice, for a spell cast from your hand whose every mode targets. */
internal fun modeBackOutOffered(p: Prompt, st: MatchState): Boolean {
    if (p.method != "getChoices" || p.acknowledgeOnly || p.min < 1 || p.max != 1 || p.options.size < 2) return false
    return p.options.all { o ->
        if (o.kind != "ability" || !Regex("\\btarget", RegexOption.IGNORE_CASE).containsMatchIn(o.label)) false
        else o.cardZone == "Hand" || (o.rawCardId != null && st.players.any { pl -> pl.hand.any { it.id == o.rawCardId } })
    }
}

/** The back-out in flight (native-panel.mjs:145 backOut): module state, so it outlives the dock between decisions. */
private object BackOut { var until = 0L; var key = "" }

/** native-panel.mjs:152-158: after Cancel on a mode, pick the first mode, then cancel at its target step. */
@Composable
private fun BackOutStep(st: MatchState, live: Boolean, intents: TableIntents) {
    val p = st.prompt
    LaunchedEffect(st.revision, p?.id, st.inputType, live) {
        if (BackOut.until <= System.currentTimeMillis() || !live || st.busy) return@LaunchedEffect
        val key = "${st.revision}:${p?.id ?: st.inputType}"
        if (BackOut.key == key) return@LaunchedEffect
        BackOut.key = key
        val input = st.inputType ?: ""
        if (p != null && p.method == "getChoices" && p.min >= 1 && p.max == 1 && p.options.isNotEmpty()) intents.reply(p.id, null, listOf(p.options[0].index), null)
        else if (p == null && (input == "InputSelectTargets" || input.startsWith("InputPayMana")) && st.buttons.cancelEnabled) { BackOut.until = 0; intents.cancel() }
        else BackOut.until = 0
    }
}

/** forge-session.mjs:248-253 promptNamedCard: the card a yes/no question names ("Put X on the top of library?"). */
internal fun promptNamedCard(p: Prompt, message: String): String? {
    val text = p.rawMessage.ifEmpty { p.message }.ifEmpty { message }
    val m = Regex("\\bput (.+?) (?:on(?:to)? (?:the )?(?:top|bottom)|in(?:to)? (?:your |its owner's )?(?:graveyard|hand|library))", RegexOption.IGNORE_CASE).find(text)
    val name = m?.groupValues?.get(1)?.replace(Regex(" \\(\\d+\\)$"), "")?.trim()
    return name?.takeIf { it.isNotEmpty() && it.length <= 80 }
}

/** selectPrompt (forge-session.mjs:221): tap again to take one back; one-pick prompts swap; a full list takes no more. */
private fun select(p: Prompt, draft: MutableList<Int>, index: Int) {
    if (p.options.none { it.index == index }) return
    if (index in draft) draft.remove(index)
    else if (p.max == 1) { draft.clear(); draft.add(index) }
    else if (draft.size < p.max) draft.add(index)
}

// ---- Drawing ----

/** One design unit as Dp (1 CSS px at 844 × 390). */
private class DockU(val u: Float) {
    val Int.du: Dp get() = (this * u).dp
    val Float.du: Dp get() = (this * u).dp
    val Double.du: Dp get() = (this * u).dp
    fun sp(px: Float): TextUnit = (px * u).sp
}

private class DockCtx(val st: MatchState, val p: Prompt, val live: Boolean, val intents: TableIntents, val replies: DockReplies,
                      val onInspect: (Card) -> Unit, val d: DockU, val W: Dp, val H: Dp, val pad: DockFocus) {
    val busy get() = !live || st.busy
    val hu get() = H.value / d.u
}

internal val Spectral = FontFamily(Font(R.font.spectral_bold, FontWeight.Bold))
private val TRIM = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)
private fun DockU.ts(size: Float, line: Float, weight: FontWeight = FontWeight.Normal, color: Color = Color(0xFFEDF0E8), family: FontFamily = Type.Sans, spacing: Float = 0f) =
    TextStyle(fontFamily = family, fontWeight = weight, fontSize = sp(size), lineHeight = sp(line), color = color, letterSpacing = sp(spacing), lineHeightStyle = TRIM)

/** A CSS box-shadow (blur, offset, spread) under a rounded box. */
private fun Modifier.boxShadow(color: Color, blur: Dp, dy: Dp = 0.dp, spread: Dp = 0.dp, radius: Dp = 0.dp) = drawBehind {
    drawIntoCanvas { c ->
        val paint = Paint().asFrameworkPaint().apply { isAntiAlias = true; this.color = color.toArgb(); if (blur.toPx() > 0f) maskFilter = BlurMaskFilter(blur.toPx() / 2f, BlurMaskFilter.Blur.NORMAL) }
        val s = spread.toPx(); val r = radius.toPx() + s
        c.nativeCanvas.drawRoundRect(-s, dy.toPx() - s, size.width + s, size.height + dy.toPx() + s, r, r, paint)
    }
}

/** A tap with the haptic tick the table uses (gated on the haptics setting). */
@Composable
private fun Modifier.tap(enabled: Boolean, onClick: () -> Unit): Modifier {
    val hf = LocalHapticFeedback.current
    return clickable(enabled = enabled) { if (AppSettings.haptics) hf.performHapticFeedback(HapticFeedbackType.TextHandleMove); onClick() }
}

private enum class Look { PLAIN, PRESSED, GOLD, SEARCH_GOLD }

/**
 * The hosted dock's button (forge-native-panel button: #203A40, a 44 % gold hairline, 9 px corners, 8 × 11 padding, 12 px DM Sans),
 * with the site's variants: pressed (#766344, #E3CE9D edge), the order dialog's gold Done and the search picker's gold Confirm.
 */
@Composable
private fun DockButton(text: String, enabled: Boolean, d: DockU, modifier: Modifier = Modifier, look: Look = Look.PLAIN, radius: Float = 9f, height: Float = 44f,
                       padH: Float = 11f, size: Float = 12f, weight: FontWeight = FontWeight.Normal, align: TextAlign = TextAlign.Center,
                       disabledAlpha: Float = .45f, ring: CountAt? = null, content: (@Composable () -> Unit)? = null, onClick: () -> Unit) = with(d) {
    val shape = RoundedCornerShape(radius.du)
    // The prompt's confirm button ([ring] says where its last-10 count stands) wears the turn clock's ring (TurnRing.kt).
    val ringM = if (ring != null) Modifier.promptRing(radius, ring) else Modifier
    val gold = look == Look.GOLD && enabled
    val bg = when {
        gold -> Modifier.background(Brush.verticalGradient(0f to Color(0xFFF7DA97), .55f to Color(0xFFE8B95B), 1f to Color(0xFFC4903A)), shape)
        look == Look.SEARCH_GOLD -> Modifier.background(Brush.linearGradient(listOf(Color(0xFFE3BB68), Color(0xFFC99C48)), Offset.Zero, Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)), shape)
        look == Look.PRESSED -> Modifier.background(Color(0xFF766344), shape)
        else -> Modifier.background(Color(0xFF203A40), shape)
    }
    val edge = when { gold -> Color(0xFFFFE2A0); look == Look.SEARCH_GOLD -> Color(0xFFF0D695); look == Look.PRESSED -> Color(0xFFE3CE9D); else -> Color(0x70DFC58E) }
    val ink = when { gold -> Color(0xFF241605); look == Look.SEARCH_GOLD -> Color(0xFF14171A); else -> Color(0xFFEDF0E8) }
    Box(modifier.then(ringM).alpha(if (enabled) 1f else disabledAlpha)
        .then(if (gold) Modifier.boxShadow(Color(0x66E8B95B), 18.du, radius = radius.du) else Modifier)
        .heightIn(min = height.du).then(bg).border(1.dp, edge, shape).clip(shape).tap(enabled, onClick)
        .padding(horizontal = padH.du, vertical = 8.du),
        contentAlignment = if (align == TextAlign.Start || align == TextAlign.Left) Alignment.CenterStart else Alignment.Center) {
        if (content != null) content() else Text(text, style = ts(size, size * 1.3f, weight, ink).copy(textAlign = align))
    }
}

/** The dock's column at the bottom right (the phone dock: right 8, bottom 8, 168 wide; children 5 apart, bottom-aligned). */
@Composable
private fun SideDock(ctx: DockCtx, content: @Composable () -> Unit) = with(ctx.d) {
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.align(Alignment.BottomEnd).dockFocus(ctx).padding(end = 8.du, bottom = 8.du).width(168.du).heightIn(max = ctx.H - 16.du).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(5.du), horizontalAlignment = Alignment.Start) { content() }
    }
}

/** The search picker's frame (gradient, gold hairline, deep shadow), shared by the search dialog and the titled dock. */
private fun Modifier.dockFrame(d: DockU, shape: androidx.compose.ui.graphics.Shape, blur: Float, spread: Float): Modifier = with(d) {
    this@dockFrame.boxShadow(Color(0xBB000000), blur.du, spread.du, radius = 18.du).clip(shape)
        .background(Brush.linearGradient(listOf(Color(0xF5202630), Color(0xFC10151E)), Offset.Zero, Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)))
        .border(1.dp, Color(0x8AD6AD64), shape)
}

/** The dock's column in the search picker's frame (fix list B2/B3, U4): the card's name in Cinzel on top, then the question. */
@Composable
private fun TitledDock(ctx: DockCtx, title: String, content: @Composable () -> Unit) = with(ctx.d) {
    val shape = RoundedCornerShape(18.du)
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.align(Alignment.BottomEnd).dockFocus(ctx).padding(end = 8.du, bottom = 8.du).width(196.du).heightIn(max = ctx.H - 16.du)
            .dockFrame(this@with, shape, 40f, 14f).verticalScroll(rememberScrollState()).padding(horizontal = 12.du, vertical = 10.du),
            verticalArrangement = Arrangement.spacedBy(5.du), horizontalAlignment = Alignment.Start) {
            Text(title, style = ts(14f, 16.1f, FontWeight.Bold, TITLE_INK, Type.Cinzel, .28f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            content()
        }
    }
}
private val TITLE_INK = Color(0xFFF5EBD3)

/** A choice's title is a name, never a rules sentence (fix list B3): the one card all its options belong to (Rugged Prairie's
 *  mana abilities), else the spell being paid for, else the one resolving. */
internal fun choiceTitle(p: Prompt, st: MatchState): String {
    val ids = p.options.mapNotNull { it.cardId ?: it.rawCardId }.distinct()
    if (p.options.size > 1) ids.singleOrNull()?.let { st.card(it) }?.takeIf { !it.hidden && it.name.isNotEmpty() }?.let { return it.name }
    p.options.map { it.cardName }.distinct().singleOrNull()?.takeIf { !it.isNullOrEmpty() && p.options.size > 1 }?.let { return it }
    return pendingCast(st)?.name?.takeIf { it.isNotEmpty() } ?: searchSource(st)
}

/** E3c: a prompt nothing can answer. The plain line, and against the CPU the way out at once (X): the match ends as no result. */
@Composable
private fun DeadEnd(ctx: DockCtx) {
    val leave = ctx.replies.leave
    Diagnostic(if (leave != null) dev.cardstashy.nativeplay.match.NO_RESULT else "This choice is not playable in the app yet.", ctx.d)
    if (leave != null) {
        PadScreen(remember(leave) { PadActs(x = PadAct("Leave match") { leave() }, opaque = true) })
        GoldCta("Leave match", Modifier.fillMaxWidth(), onClick = leave)
    }
}

/** .forge-diagnostic (play-forge-table.css:161). */
@Composable
private fun Diagnostic(text: String, d: DockU) = with(d) {
    Text(text, style = ts(12f, 16.8f, color = Color(0xFFFFD3B8)), modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(7.du))
        .background(Color(0x407A3C28)).border(1.dp, Color(0x60F5B384), RoundedCornerShape(7.du)).padding(8.du))
}

/** A plain dock line (panel p: 12 px / 1.4, 4 px margins). */
@Composable
private fun DockLine(text: String, d: DockU, color: Color = Color(0xFFEEE6D4)) = with(d) {
    Text(text, style = ts(12f, 16.8f, color = color), modifier = Modifier.padding(vertical = 4.du))
}

/** A label with Forge's {X} costs drawn as mana symbols ("Kicker {2}{G}"), like the site's symbolText. */
@Composable
private fun CostLabel(label: String, d: DockU) = with(d) {
    val parts = Regex("\\{[^}]+\\}|[^{]+").findAll(label).map { it.value }.toList()
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.du)) {
        for (part in parts) if (part.startsWith("{")) Symbol(part.trim('{', '}'), 12.6f.du) else Text(part.trimEnd() + if (part.endsWith(" ")) " " else "", style = ts(12f, 15.6f))
    }
}

// ---- Optional costs (native-panel.mjs:310-326) ----

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OptionalCosts(ctx: DockCtx, draft: MutableList<Int>) = with(ctx.d) {
    val p = ctx.p
    val answer = { pick: List<Int> -> ctx.intents.reply(p.id, null, pick, null) }
    // A controller's X: the several-costs Cast (its words, its tap, while it can be pressed); one cost is two plain choices, no X.
    val castOn = !ctx.busy && draft.size >= p.min && draft.size <= p.max
    val castLabel = if (draft.isNotEmpty()) "Cast" else "Cast without extras"
    PadScreen(PadActs(x = if (p.options.size != 1 && castOn) PadAct(castLabel) { answer(draft.toList()) } else null))
    FlowRow {
        if (p.options.size == 1) {
            // One cost: answer in one tap (Arena's "Kicker" / "Cast without").
            val o = p.options[0]
            DockButton("", !ctx.busy, this@with, Modifier.padFirst(ctx), content = { CostLabel(o.label, this@with) }) { answer(listOf(o.index)) }
            DockButton("Cast without ${costName(o.label).lowercase()}", !ctx.busy, this@with) { answer(emptyList()) }
        } else {
            // Several: toggle, then cast.
            p.options.forEachIndexed { i, o -> DockButton("", !ctx.busy, this@with, look = if (o.index in draft) Look.PRESSED else Look.PLAIN,
                modifier = (if (i == 0) Modifier.padFirst(ctx) else Modifier).semantics { selected = o.index in draft }, content = { CostLabel(o.label, this@with) }) { select(p, draft, o.index) } }
            // The dock's full width: the hand is to its left and the screen's edge to its right, so the count stands above its right end.
            DockButton(castLabel, castOn, this@with, ring = CountAt.ABOVE) { answer(draft.toList()) }
        }
    }
}

// ---- Confirm (native-panel.mjs:342-346) ----

@Composable
private fun ConfirmChoice(ctx: DockCtx) = with(ctx.d) {
    val p = ctx.p
    // The card a yes/no question names, when it says one (forge-native-card: min(132 px, 52 %) wide, 4 px above, 10 px below).
    promptNamedCard(p, ctx.st.message)?.let { name ->
        val w = minOf(132f, 168f * .52f)
        Box(Modifier.fillMaxWidth().padding(top = 4.du, bottom = 5.du), contentAlignment = Alignment.Center) {
            CardImage(name, Modifier.width(w.du).height((w * 680f / 488f).du).boxShadow(Color(0xCC000000), 30.du, 14.du, radius = 6.du)
                .clip(RoundedCornerShape(6.du)).border(1.dp, Color(0x66D6AD64), RoundedCornerShape(6.du)), contentScale = ContentScale.Crop)
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.du)) {
        // Two equal answers, no gold one: the ring starts on the first, and X stays unset.
        DockButton(p.options.getOrNull(0)?.label ?: "Confirm", !ctx.busy, this@with, Modifier.weight(1f).padFirst(ctx)) { ctx.intents.reply(p.id, true, null, null) }
        DockButton(p.options.getOrNull(1)?.label ?: "Decline", !ctx.busy, this@with, Modifier.weight(1f)) { ctx.intents.reply(p.id, false, null, null) }
    }
}

// ---- showInputDialog (native-panel.mjs:346-353) ----

@Composable
private fun InputDialog(ctx: DockCtx) = with(ctx.d) {
    val p = ctx.p
    var value by remember(ctx.st.revision, p.id) { mutableStateOf("") }
    var open by remember { mutableStateOf(false) }
    val field = Modifier.fillMaxWidth().heightIn(min = 44.du).clip(RoundedCornerShape(6.du)).background(Color(0x851F232B))
        .border(1.dp, Color(0x31EDC980), RoundedCornerShape(6.du))
    Column {
        Text(p.message.ifBlank { if (p.options.isNotEmpty()) "Choose one" else if (p.numeric) "Choose a number" else "" }, style = ts(12.5f, 17.5f, FontWeight.SemiBold, Color(0xFF9AA2B1)))
        Spacer(Modifier.height(6.du))
        if (p.options.isNotEmpty()) {
            // <select>: "Select an offered value", then each option.
            Box(field.padFirst(ctx).tap(!ctx.busy) { open = true }.padding(start = 8.du, end = 12.du, top = 8.du, bottom = 8.du), contentAlignment = Alignment.CenterStart) {
                // <select>: 14 px semibold, the arrow 10 px in from the right edge.
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.du)) {
                    Text(p.options.firstOrNull { it.valueText == value && value.isNotEmpty() }?.label ?: "Choose one", style = ts(14f, 18.2f, FontWeight.SemiBold), modifier = Modifier.weight(1f))
                    Text("\u25BC", style = ts(9f, 12f, color = Color(0xFFEDF0E8)))
                }
                if (open) RuleMenu(null, p.options.map { o -> RuleRow(o.label, on = value.isNotEmpty() && o.valueText == value) { value = o.valueText ?: o.label } }) { open = false }
            }
        } else {
            BasicTextField(value, { v -> value = v.take(200) }, enabled = !ctx.busy, singleLine = true, textStyle = ts(12f, 15.6f),
                cursorBrush = SolidColor(Color(0xFFEDF0E8)),
                keyboardOptions = KeyboardOptions(keyboardType = if (p.numeric) KeyboardType.Number else KeyboardType.Text),
                modifier = field.padding(8.du).semantics { contentDescription = p.message.ifEmpty { "Forge input" } })
        }
    }
    // required: nothing is sent while the value is empty (form.reportValidity()).
    val confirm: () -> Unit = { if (value.isNotBlank() && (!p.numeric || value.trim().toIntOrNull() != null)) ctx.replies.text?.invoke(p.id, value) }
    // A controller's X is Confirm; a typed value starts the ring on Confirm, not the field (no keyboard thrown up unasked).
    PadScreen(PadActs(x = if (!ctx.busy) PadAct("Confirm") { confirm() } else null))
    DockButton("Confirm", !ctx.busy, this, if (p.options.isEmpty()) Modifier.padFirst(ctx) else Modifier) { confirm() }
}

// ---- A reveal (native-panel.mjs:354-359) ----

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Reveal(ctx: DockCtx) = with(ctx.d) {
    val p = ctx.p
    // A short look, like Arena's: it moves on by itself after 3.2 s.
    LaunchedEffect(ctx.st.revision, p.id) { delay(3200); if (ctx.live) ctx.intents.reply(p.id, null, emptyList(), null) }
    val label = MatchState.tidy(cpuName(plainText(p.rawMessage.ifEmpty { p.message }.ifEmpty { "Revealed" }.split("\n")[0])))
    Text(label.uppercase(), style = ts(12f, 15.6f, FontWeight.SemiBold, Color(0xFFCDBF9F), spacing = .48f), modifier = Modifier.padding(end = 8.du, bottom = 6.du))
    FlowRow(Modifier.padding(end = 8.du, bottom = 8.du), horizontalArrangement = Arrangement.spacedBy(6.du), verticalArrangement = Arrangement.spacedBy(6.du)) {
        for (o in p.options) Pop { Text(plainText(o.label), style = ts(17f, 21.25f, FontWeight.Bold, Color(0xFFF2D18E), Spectral)) }
    }
    val shape = RoundedCornerShape(999.dp)
    PadScreen(PadActs(x = if (!ctx.busy) PadAct("OK") { ctx.intents.reply(p.id, null, emptyList(), null) } else null))
    Box(Modifier.boxShadow(Color(0x3DC99A4B), 22.du, 8.du, radius = 24.du).height(48.du).clip(shape)
        .background(Brush.verticalGradient(listOf(Color(0xFFF2D18E), Color(0xFFC99A4B)))).border(1.dp, Color(0xFFF6DFA8), shape)
        .padFirst(ctx).tap(!ctx.busy) { ctx.intents.reply(p.id, null, emptyList(), null) }.padding(horizontal = 22.du), contentAlignment = Alignment.Center) {
        Text("OK", style = ts(16f, 19.2f, FontWeight.Bold, Color(0xFF1B1408)))
    }
}

/** forge-emote-pop: from opacity 0, scale .8 (.22 s); none with reduced motion. */
@Composable
private fun Pop(content: @Composable () -> Unit) {
    val a = remember { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(Unit) { if (!Motion.still) a.animateTo(1f, tween(220, easing = CubicBezierEasing(.2f, .9f, .3f, 1.3f))) }
    Box(Modifier.graphicsLayer { alpha = a.value.coerceIn(0f, 1f); val s = .8f + .2f * a.value; scaleX = s; scaleY = s }) { content() }
}

// ---- A plain choice list (native-panel.mjs:384-395) ----

@Composable
private fun ChoiceList(ctx: DockCtx, draft: MutableList<Int>) = with(ctx.d) {
    val p = ctx.p
    val confirmLabel = if (draft.isEmpty() && p.min == 0) (if (p.cancelable) "Cancel" else "Choose none") else "Confirm"
    val confirmOn = !ctx.busy && draft.size >= p.min && draft.size <= p.max
    PadScreen(PadActs(x = if (confirmOn) PadAct(confirmLabel) { ctx.intents.reply(p.id, null, draft.toList(), null) } else null))
    // Forge's own question is the line (fix list B2); a count only when Forge said nothing.
    val ask = plainText(p.rawMessage.ifEmpty { p.message }.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() } ?: "")
    DockLine(MatchState.tidy(cpuName(ask.ifEmpty { if (p.max == 1) "Choose one" else "Choose up to ${p.max}" })), this)
    val firstOn = p.options.firstOrNull { it.described }?.index
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.du)) {
        for (o in p.options) DockButton(o.label, !ctx.busy && o.described, this@with, Modifier.fillMaxWidth().then(if (o.index == firstOn) Modifier.padFirst(ctx) else Modifier).semantics { selected = o.index in draft },
            look = if (o.index in draft) Look.PRESSED else Look.PLAIN, align = TextAlign.Start) { select(p, draft, o.index) }
    }
    if (p.options.any { !it.described }) Diagnostic("Some native options have no safe presentation. Those options remain disabled.", this)
    DockLine(if (draft.isNotEmpty()) "Selected: ${draft.joinToString(" · ") { i -> p.options.firstOrNull { it.index == i }?.label ?: "" }}" else "Nothing selected", this, Color(0xFFDFC58E))
    DockButton(confirmLabel, confirmOn, this, if (firstOn == null) Modifier.padFirst(ctx) else Modifier, look = if (draft.isNotEmpty() || p.min > 0) Look.SEARCH_GOLD else Look.PLAIN, weight = FontWeight.Bold, ring = CountAt.RIGHT) { ctx.intents.reply(p.id, null, draft.toList(), null) }
    DockButton("Clear selection", !ctx.busy, this) { draft.clear() }
    if (modeBackOutOffered(p, ctx.st)) DockButton("Cancel", !ctx.busy, this) {
        BackOut.until = System.currentTimeMillis() + 8000; BackOut.key = "${ctx.st.revision}:${p.id}"
        ctx.intents.reply(p.id, null, listOf(p.options[0].index), null)
    }
}

// ---- The centred card dialog: order prompts and damage splits ----

/** forge-native-panel:has(.forge-order-cards) at a phone: centred, min(760, 100vw − 16) wide, the table dimmed around it. */
@Composable
private fun CardDialog(ctx: DockCtx, title: String, content: @Composable ColumnScope.() -> Unit) = with(ctx.d) {
    // cs-hud-pop: from opacity 0, 6 px up, scale .98 (.26 s).
    val a = remember(ctx.p.id) { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(ctx.p.id) { if (!Motion.still) a.animateTo(1f, tween(260, easing = CubicBezierEasing(.2f, .8f, .2f, 1f))) }
    Box(Modifier.fillMaxSize()) {
        // box-shadow: 0 0 0 100vmax #05060ab8 dims the table; it takes no taps.
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = a.value }.background(Color(0xB805060A)))
        val shape = RoundedCornerShape(20.du)
        Column(Modifier.align(Alignment.Center).dockFocus(ctx).width(minOf(760.du, ctx.W - 16.du)).heightIn(max = ctx.H - 16.du)
            .graphicsLayer { alpha = a.value; translationY = (1 - a.value) * -6.du.toPx(); val s = .98f + .02f * a.value; scaleX = s; scaleY = s }
            .boxShadow(Color(0xDD000000), 70.du, 30.du, radius = 20.du)
            .clip(shape).background(Color(0xF60D1016)).border(1.dp, Color(0x44D6AD64), shape)
            .padding(horizontal = 24.du, vertical = 12.du), horizontalAlignment = Alignment.CenterHorizontally) {
            // h2: Cinzel 700 14 px / 1.2, .28 px tracking, #F5EBD3, centred; 6 px below the context.
            Text(title, style = ts(14f, 16.8f, FontWeight.Bold, Color(0xFFF5EBD3), Type.Cinzel, .28f).copy(textAlign = TextAlign.Center),
                modifier = Modifier.padding(horizontal = 4.du))
            Spacer(Modifier.height(12.du))
            content()
        }
    }
}

/** The numbered disc on an order card (.forge-order-num: 34 px at −12, −12; dashed until picked, then gold with its place). */
@Composable
private fun OrderNum(at: Int, d: DockU, modifier: Modifier) = with(d) {
    val pop = remember(at) { Animatable(if (Motion.still || at < 0) 1f else .4f) }
    LaunchedEffect(at) { if (!Motion.still && at >= 0) pop.animateTo(1f, tween(300, easing = CubicBezierEasing(.3f, 1.6f, .5f, 1f))) }
    Box(modifier.size(34.du).graphicsLayer { scaleX = pop.value; scaleY = pop.value }.clip(CircleShape)
        .then(if (at >= 0) Modifier.background(Brush.verticalGradient(listOf(Color(0xFFF6DC9A), Color(0xFFD9A64A))))
              else Modifier.background(Color(0xE60F1117)).drawBehind {
                  val w = 1.dp.toPx(); drawCircle(Color(0x55FFFFFF), radius = size.minDimension / 2 - w / 2, style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.du.toPx(), 3.du.toPx()))))
              }), contentAlignment = Alignment.Center) {
        if (at >= 0) Text("${at + 1}", style = ts(16f, 16f, FontWeight.Bold, Color(0xFF1B1406)))
    }
}

/** .forge-order-noart: the card's name on a dark card when there is no picture. */
@Composable
private fun NoArt(text: String, d: DockU, modifier: Modifier) = with(d) {
    Box(modifier.background(Brush.linearGradient(listOf(Color(0xFF232833), Color(0xFF12151C)))).border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(4.du)).padding(12.du),
        contentAlignment = Alignment.Center) {
        Text(text, style = ts(14f, 16.8f, FontWeight.Bold, Color(0xFFEEF0F4), Spectral).copy(textAlign = TextAlign.Center))
    }
}

/** Hosted order (native-panel.mjs:363-382): each choice is its source card; tap them in order, tap again to take one back. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OrderDialog(ctx: DockCtx, draft: MutableList<Int>) = with(ctx.d) {
    val p = ctx.p; val st = ctx.st
    var keep by remember(st.revision, p.id) { mutableStateOf(false) }
    // native-panel.mjs:222
    val title = if (Regex("simultaneous|trigger", RegexOption.IGNORE_CASE).containsMatchIn(p.message.ifEmpty { st.message })) "Order your triggers" else "Choose an order"
    CardDialog(ctx, title) {
        // "Leave 0 in the source" only says every one must be ordered, which the Done button already shows.
        val rest = if ((p.remainingMax ?: 0) > 0 && p.min < p.options.size) orderRemainder(p) else ""
        val top = p.topLabel
        Text("${if (Pad.connected.value) "Choose" else "Tap"} them in order. 1 ${if (top != null && Regex("resolve", RegexOption.IGNORE_CASE).containsMatchIn(top)) "resolves first" else "is ${(top ?: "first").lowercase()}"}.$rest",
            style = ts(14f, 19.6f, color = Color(0xFFCFD4DC)).copy(textAlign = TextAlign.Center))
        Spacer(Modifier.height(6.du))
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f, fill = false)) {
            val inner = maxWidth - 24.du
            val cardW = minOf(300.du, inner / 2 - 7.du)
            val artW = (ctx.hu * .17f).coerceIn(56f, 84f)
            FlowRow(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 12.du, end = 12.du, top = 10.du),
                horizontalArrangement = Arrangement.spacedBy(14.du, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(14.du)) {
                val firstOn = p.options.firstOrNull { it.described }?.index
                for (o in p.options) {
                    val at = draft.indexOf(o.index)
                    val source = sourceOf(o, st)
                    val text = cleanLabel(o.label)
                    Box(Modifier.width(cardW).then(if (o.index == firstOn) Modifier.padFirst(ctx) else Modifier).semantics { selected = at >= 0; contentDescription = "${if (at >= 0) "${at + 1}: " else ""}${source?.let { it.name + " · " } ?: ""}$text" }
                        .tap(!ctx.busy && o.described) { select(p, draft, o.index) }) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.du)) {
                            val artMod = Modifier.width(artW.du).height((artW * 680f / 488f).du)
                                .then(if (at >= 0) Modifier.boxShadow(Color(0x77E8B95B), 26.du, radius = 3.2f.du).boxShadow(Color(0xFFE8B95B), 0.dp, spread = 2.du, radius = 3.2f.du) else Modifier)
                                .boxShadow(Color(0xCC000000), 40.du, 18.du, radius = 3.2f.du).clip(RoundedCornerShape(3.2f.du))
                            if (source != null) CardImage(source.name, artMod, contentScale = ContentScale.Crop, fallback = { NoArt(source.name, this@with, Modifier.fillMaxSize()) })
                            else NoArt("?", this@with, artMod)
                            Column(verticalArrangement = Arrangement.spacedBy(2.du)) {
                                Text(source?.name ?: text, style = ts(14f, 16.8f, FontWeight.Bold, Color(0xFFEEF0F4)))
                                if (source != null) Text(text, style = ts(11f, 14.3f, color = Color(0xFFD6DBE4)))
                            }
                        }
                        OrderNum(at, this@with, Modifier.offset((-12).du, (-12).du))
                    }
                }
            }
        }
        Spacer(Modifier.height(6.du))
        if (p.rememberAllowed) {
            // "Remember this order" (native-panel.mjs:391): a checkbox before its words, 13 px #CFD4DC.
            Row(Modifier.tap(!ctx.busy) { keep = !keep }.padding(vertical = 2.du), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(13.du).clip(RoundedCornerShape(2.du)).background(if (keep) Color(0xFFE8B95B) else Color(0xFF1F232B)).border(1.dp, Color(0xFF8C93A0), RoundedCornerShape(2.du)),
                    contentAlignment = Alignment.Center) { if (keep) Text("✓", style = ts(10f, 10f, FontWeight.Bold, Color(0xFF1B1406))) }
                Spacer(Modifier.width(4.du))
                Text("Remember this order", style = ts(13f, 18.2f, color = Color(0xFFCFD4DC)))
            }
            Spacer(Modifier.height(6.du))
        }
        val send = { indexes: List<Int> -> ctx.replies.order?.invoke(p.id, indexes, keep) ?: ctx.intents.reply(p.id, null, indexes, null) }
        // Like Arena's auto-order: keep the order they came in (the ones already tapped stay first) and go on.
        val fillable = minOf(p.max, p.options.count { it.described }) >= p.min
        val doneOn = !ctx.busy && draft.size >= p.min && draft.size <= p.max
        PadScreen(PadActs(x = if (doneOn) PadAct("Done") { send(draft.toList()) } else null))
        Row(horizontalArrangement = Arrangement.spacedBy(10.du)) {
            DockButton("Reset", !ctx.busy && draft.isNotEmpty(), this@with, radius = 23f, height = 46f, padH = 22f) { draft.clear() }
            DockButton("Auto order", !ctx.busy && fillable, this@with, radius = 23f, height = 46f, padH = 22f) {
                val picked = draft.toMutableList(); for (o in p.options) if (o.index !in picked && picked.size < p.max && o.described) picked += o.index
                send(picked)
            }
            // Last in its row: the count stands right of it, never on Auto order.
            DockButton("Done", doneOn, this@with, Modifier.widthIn(min = 160.du), look = Look.GOLD,
                radius = 23f, height = 46f, size = 16f, weight = FontWeight.Bold, ring = CountAt.RIGHT) { send(draft.toList()) }
        }
    }
}

/** The order card's words: Forge's description without "[Zone Changer: …]", "()" or card ids (native-panel.mjs:365). */
private fun cleanLabel(t: String) = plainText(t.replace(Regex("\\s*\\[[^\\]]*\\]"), "").replace(Regex("\\s*\\(\\s*\\)"), "")).trim()

/** sourceOf (native-panel.mjs:366): the option's card, else a battlefield card of its name, else the card named in "[…: Name (id)]". */
private fun sourceOf(o: PromptOption, st: MatchState): Card? {
    o.cardId?.let { id -> st.card(id)?.let { if (!it.hidden) return it } }
    o.cardName?.let { n -> st.players.flatMap { it.battlefield }.firstOrNull { !it.hidden && it.name == n }?.let { return it } }
    Regex("\\[[^\\]]*?:\\s*([^\\]]+?)\\s*\\((\\d+)\\)\\]").find(o.label)?.let { m ->
        return st.card(m.groupValues[2].toInt()) ?: st.players.flatMap { it.battlefield + it.hand + it.graveyard + it.exile }.firstOrNull { !it.hidden && it.name == m.groupValues[1] }
    }
    return null
}

/** Arena's damage split (native-panel.mjs:318-341): the cards themselves, a number on each, tap a card (or +) to add, − to take back. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AssignDialog(ctx: DockCtx) = with(ctx.d) {
    val p = ctx.p; val st = ctx.st
    val spec = amountSpec(p) ?: return@with
    val amounts = remember(st.revision, p.id) { mutableStateListOf<Int>().apply { addAll(amountsDefault(p) ?: emptyList()) } }
    val left = spec.amount - amounts.sum()
    val title = plainText(p.message.lines().firstOrNull { it.isNotBlank() } ?: "")
    fun bump(i: Int, by: Int) { val next = amounts.toMutableList(); next[i] = maxOf(0, next[i] + by); if (next.sum() > spec.amount) return; amounts[i] = next[i] }
    CardDialog(ctx, title) {
        val w = (ctx.hu * .27f).coerceIn(70f, 120f)
        FlowRow(Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(start = 12.du, end = 12.du, top = 12.du),
            horizontalArrangement = Arrangement.spacedBy(18.du, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(18.du)) {
            p.options.forEachIndexed { i, o ->
                val card = o.cardId?.let { st.card(it) }
                val isPlayer = (spec.combat && i == spec.defender) || o.kind == "player"
                val who = if (isPlayer) (if (o.playerId == st.viewer) "You" else "CPU") else null
                val lethal = if (spec.combat && !isPlayer) spec.lethal.getOrNull(i) else null
                val isLethal = lethal != null && lethal > 0 && amounts[i] >= lethal
                val canAdd = left > 0 && !ctx.busy && (spec.combat || amounts[i] < spec.maxima[i])
                Box(Modifier.width(w.du)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.du)) {
                        val artMod = Modifier.width(w.du).height((w * 680f / 488f).du)
                            .then(if (isLethal) Modifier.boxShadow(Color(0x88E0533F), 26.du, radius = 5.du).boxShadow(Color(0xFFE0533F), 0.dp, spread = 2.du, radius = 5.du) else Modifier)
                            .boxShadow(Color(0xCC000000), 40.du, 18.du, radius = 5.du).clip(RoundedCornerShape(5.du)).tap(canAdd) { bump(i, 1) }
                        val noArt = who ?: card?.takeIf { !it.hidden }?.name ?: plainText(o.label)
                        if (who == null && card != null && !card.hidden) CardImage(card.name, artMod, contentScale = ContentScale.Crop, fallback = { NoArt(noArt, this@with, Modifier.fillMaxSize()) })
                        else NoArt(noArt, this@with, artMod)
                        Row(horizontalArrangement = Arrangement.spacedBy(12.du)) {
                            DockButton("−", !ctx.busy && amounts[i] > 0, this@with, Modifier.size(40.du), radius = 20f, height = 40f, padH = 0f, size = 22f, weight = FontWeight.Bold) { bump(i, -1) }
                            DockButton("+", !ctx.busy && left > 0 && (spec.combat || amounts[i] < spec.maxima[i]), this@with, Modifier.size(40.du), radius = 20f, height = 40f, padH = 0f, size = 22f, weight = FontWeight.Bold) { bump(i, 1) }
                        }
                    }
                    Box(Modifier.offset((-10).du, (-10).du).size(32.du).clip(CircleShape).background(Brush.verticalGradient(listOf(Color(0xFFF6DC9A), Color(0xFFD9A64A))))
                        .semantics { contentDescription = "${amounts[i]} to ${who ?: card?.name ?: "this"}" }, contentAlignment = Alignment.Center) {
                        Text("${amounts[i]}", style = ts(16f, 16f, FontWeight.Bold, Color(0xFF1B1406)))
                    }
                }
            }
        }
        Spacer(Modifier.height(14.du))
        // A controller's X is the gold Done, and the ring starts on it (the split comes filled in, usually ready to send).
        val doneOn = !ctx.busy && amountsLegal(p, amounts)
        PadScreen(PadActs(x = if (doneOn) PadAct("Done") { ctx.intents.reply(p.id, null, null, amounts.toList()) } else null))
        Row(horizontalArrangement = Arrangement.spacedBy(10.du)) {
            DockButton("Reset", !ctx.busy, this@with, radius = 23f, height = 46f, padH = 22f) { amounts.clear(); amounts.addAll(amountsDefault(p) ?: emptyList()) }
            val skip = ctx.replies.skipAmounts
            if (spec.combat && spec.maySkip && skip != null) DockButton("As though unblocked", !ctx.busy, this@with, radius = 23f, height = 46f, padH = 22f) { skip(p.id) }
            DockButton("Done", doneOn, this@with, Modifier.widthIn(min = 160.du).padFirst(ctx), look = Look.GOLD,
                radius = 23f, height = 46f, size = 16f, weight = FontWeight.Bold, ring = CountAt.RIGHT) { ctx.intents.reply(p.id, null, null, amounts.toList()) }
        }
    }
}

// ---- The search picker (native-panel.mjs:257-307, .forge-zone-search) ----

@Composable
private fun ZoneSearchDialog(ctx: DockCtx, z: ZoneSearch, draft: MutableList<Int>) = with(ctx.d) {
    val p = ctx.p; val st = ctx.st
    // Forge's own words for a search are often bare ("Choose card(s)"): name the spell doing it and how many to take.
    val lines = p.rawMessage.ifEmpty { p.message }.split("\n").map { plainText(it) }.filter { it.isNotEmpty() }.toMutableList()
    val source = searchSource(st); val ask = searchAsk(z)
    val bare = { line: String? -> line != null && Regex("^(choose|select)\\s+(an?\\s+)?(card|cards|card\\(s\\))\\.?$", RegexOption.IGNORE_CASE).matches(line) }
    if (bare(lines.firstOrNull()) || lines.isEmpty()) {
        if (lines.isNotEmpty()) lines.removeAt(0)
        lines.addAll(0, listOf(source, ask).filter { it.isNotEmpty() })
        if (lines.isEmpty()) lines += "Choose from ${z.zones.joinToString(" / ")}"
    } else if (ask.isNotEmpty() && lines.none { Regex("\\b(up to\\s+)?\\d+\\b|\\b(a|an|one|two|three)\\s+cards?\\b", RegexOption.IGNORE_CASE).containsMatchIn(it) }) lines += ask
    // The title is a name, never a rules sentence (fix list B3): the card doing the search, else where it looks. A long first
    // line moves down into the body, where it wraps.
    val first = lines.firstOrNull()
    val named = first != null && (first == source || first.length <= 32)
    // Forge often leads the sentence with the card itself ("Many Partings - Search your library…"): that name is the title.
    val led = if (named || first == null) null else Regex("^(.{2,40}?) [\u2013\u2014-] (.+)$").find(first)
    val heading = MatchState.tidy(cpuName(if (named) first!! else led?.groupValues?.get(1) ?: source.ifEmpty { "Choose from ${z.zones.joinToString(" / ")}" }))
    val body = if (named) lines.drop(1) else if (led != null) listOf(led.groupValues[2]) + lines.drop(1) else lines
    Box(Modifier.fillMaxSize().background(Color(0xB8060912)).pointerInput(Unit) { detectTapGestures { } }) {
        val shape = RoundedCornerShape(18.du)
        val pad = (ctx.W.value / ctx.d.u * .03f).coerceIn(12f, 28f)
        Column(Modifier.align(Alignment.Center).dockFocus(ctx).padding(horizontal = pad.du).widthIn(max = 760.du).fillMaxWidth().heightIn(max = ctx.H - 32.du)
            .dockFrame(this@with, shape, 90f, 26f).verticalScroll(rememberScrollState()).padding(horizontal = 16.du, vertical = 8.du),
            verticalArrangement = Arrangement.spacedBy(4.du)) {
            Text(heading, style = ts(14f, 16.1f, FontWeight.Bold, TITLE_INK, Type.Cinzel, .28f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (body.isNotEmpty()) Text(body.joinToString("\n") { MatchState.tidy(cpuName(it)) }, style = ts(13f, 19.5f, color = Color(0xFFF4EDDD)))
            // One zone for every tile: say it once here, not under each name (reviewer follow-up to B3).
            val oneZone = z.choices.mapNotNull { it.zone }.distinct().singleOrNull()?.takeIf { z.choices.all { c -> c.zone == it } }
            if (oneZone != null) Text("From your ${oneZone.lowercase()}", style = ts(13f, 19.5f, color = Color(0xFFAEBACA)))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 4.du, vertical = 6.du), horizontalArrangement = Arrangement.spacedBy(15.du)) {
                val firstOn = z.choices.firstOrNull { it.visible }?.index
                for (c in z.choices) SearchCard(ctx, c, c.index in draft, if (c.index == firstOn) Modifier.padFirst(ctx) else Modifier, showZone = oneZone == null) { select(p, draft, c.index) }
            }
            Text(if (draft.isNotEmpty()) "${draft.size} selected" else "No card selected", style = ts(13f, 19.5f, color = Color(0xFFE9D5AA)), modifier = Modifier.heightIn(min = 20.du))
            if (st.busy) Text("One moment…", style = ts(13f, 19.5f, color = Color(0xFFAEBACA)))
            // Actions: a 17 % gold rule above, right-aligned, 8 apart. A controller's X is the gold Confirm while it can be pressed.
            val confirmOn = !ctx.busy && draft.size >= p.min && draft.size <= p.max
            PadScreen(PadActs(x = if (confirmOn) PadAct("Confirm") { ctx.intents.reply(p.id, null, draft.toList(), null) } else null))
            Row(Modifier.fillMaxWidth().drawBehind { drawRect(Color(0x2CD6AD64), size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx())) }.padding(top = 12.du), horizontalArrangement = Arrangement.spacedBy(8.du, Alignment.End)) {
                DockButton("Confirm", confirmOn, this@with, Modifier.widthIn(min = 112.du), look = Look.SEARCH_GOLD,
                    weight = FontWeight.Bold, disabledAlpha = .42f, ring = CountAt.LEFT) { ctx.intents.reply(p.id, null, draft.toList(), null) }
                if (p.min == 0) DockButton(if (p.cancelable) "Cancel" else "Choose none", !ctx.busy, this@with, Modifier.widthIn(min = 112.du), disabledAlpha = .42f) {
                    ctx.intents.reply(p.id, null, emptyList(), null)
                }
                if (draft.isNotEmpty()) DockButton("Clear selection", !ctx.busy, this@with, Modifier.widthIn(min = 112.du), disabledAlpha = .42f) { draft.clear() }
            }
        }
    }
}

/** .forge-zone-search-card (2 px edge, 11 px corners; the picture; name and zone at the foot). */
@Composable
private fun SearchCard(ctx: DockCtx, c: SearchChoice, chosen: Boolean, modifier: Modifier = Modifier, showZone: Boolean = true, onPick: () -> Unit) = with(ctx.d) {
    val shape = RoundedCornerShape(11.du)
    val art = c.artName
    // Wider than the site's 84 × 124 so a name gets two lines (fix list B4).
    Box(Modifier.offset(y = if (chosen) (-5).du else 0.dp).width(104.du).height(150.du)
        .then(if (chosen) Modifier.boxShadow(Color(0x38E5B84B), 24.du, 7.du, radius = 11.du).boxShadow(Color(0x44F4CD6B), 0.dp, spread = 2.du, radius = 11.du) else Modifier.boxShadow(Color(0x77000000), 14.du, 5.du, radius = 11.du))
        .clip(shape)
        .then(if (art == null) Modifier.background(Brush.radialGradient(listOf(Color(0xFF3A4B4C), Color(0xFF111924)))) else Modifier.background(Color(0xFF111924)))
        .border(2.du, if (chosen) Color(0xFFF4CD6B) else Color(0x44B1BFD2), shape)
        .semantics { selected = chosen; contentDescription = "${c.name} · ${c.zone}${if (chosen) " · selected" else ""}" }
        .then(modifier).tap(!ctx.busy && c.visible, onPick).padding(2.du)) {
        if (art != null) CardImage(art, Modifier.fillMaxWidth().height(138.du).align(Alignment.TopCenter), contentScale = ContentScale.Crop)
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth()) {
            Text(c.name, style = ts(if (art == null) 16f else 12f, 15f, FontWeight.Bold, Color(0xFFF6F0E3)), maxLines = 2, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().background(Brush.verticalGradient(0f to Color.Transparent, .3f to Color(0xF50C121D)))
                    .padding(start = 7.du, end = 7.du, top = if (art == null) 72.du else 24.du, bottom = 5.du))
            if (chosen || showZone) Text(if (chosen) "Selected" else c.zone ?: "", style = ts(11f, 14.3f, if (chosen) FontWeight.Bold else FontWeight.Normal, if (chosen) Color(0xFFF4CD6B) else Color(0xFFACBDD2)),
                maxLines = 1, modifier = Modifier.fillMaxWidth().background(Color(0xF50C121D)).padding(start = 7.du, end = 7.du, bottom = 7.du))
        }
    }
}
