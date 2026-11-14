package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/*
 * Console Settings (Randall picked mock-up 2 of the Settings preview on 14 Nov 2026, https://claude.ai/artifact/RE2XCDRwgwqatGcFLZdybV):
 * the way big console games lay settings out. One line per setting (its name, its value), and a panel that explains and shows
 * the line you are on. On a phone the panel is a strip under the list; on a wide screen it stands at the right; on two screens
 * it is the bottom screen. A finger: tap a line to see what it does, tap it again (or tap its value) to change it. A controller:
 * the ring walks the lines, A changes, left and right step the value, LB and RB change section.
 *
 * This file is the look and the rules of a line. What the lines are lives in SettingsScreen.kt and MatchMenu.kt.
 */

/** A line's right side, and what pressing it does. */
internal sealed interface ConsoleCtl {
    class Switch(val on: Boolean, val set: (Boolean) -> Unit) : ConsoleCtl
    /** One of a few words (the id as stored; shown with a capital). */
    class Choice(val options: List<String>, val value: String, val set: (String) -> Unit) : ConsoleCtl
    /** 0 to 100 in tens. */
    class Level(val value: Int, val enabled: Boolean = true, val set: (Int) -> Unit) : ConsoleCtl
    /** Opens or does something. [verb] is A's word in the controller bar. */
    class Go(val value: String? = null, val tone: ConsoleTone = ConsoleTone.PLAIN, val verb: String = "Open", val run: () -> Unit) : ConsoleCtl
    /** A fact, with nothing to press. */
    class Info(val value: String, val tone: ConsoleTone = ConsoleTone.PLAIN) : ConsoleCtl
}

internal enum class ConsoleTone { PLAIN, GOOD, WARN, BAD }

/**
 * How a line stands to the controller's ring. FREE: the line you are on takes the ring when it appears, if nothing has it.
 * TAKE: it takes the ring whatever has it (a menu over the table). STOP: a stop only. NONE: no stop at all (a copy drawn on the
 * bottom screen for the eye and the finger).
 */
internal enum class ConsoleRing { FREE, TAKE, STOP, NONE;
    /** For the lines that are not the one you are on. */
    fun quiet() = if (this == NONE) NONE else STOP }

/** The little picture the panel draws for a line. */
internal enum class ConsolePic { ICON, THEME, GRID, GLOW, FOIL, DEPTH, VOLUME, BUZZ }

/**
 * One line. [about] is what the panel says (two sentences at most: the strip on a phone holds five short lines).
 * [default] names the value a new install has. [status]: fresh news about the line (a backup was made, a file is not valid).
 */
internal class ConsoleRow(val id: String, val title: String, val about: String, val ctl: ConsoleCtl, val default: String? = null,
                          val pic: ConsolePic = ConsolePic.ICON, val danger: Boolean = false, val status: Pair<String, ConsoleTone>? = null,
                          /** For the picture: is the thing on, and how strong (0..2 for a glow, 0..100 for a volume). Null = read it off [ctl]. */
                          val picOn: Boolean? = null, val picLevel: Int? = null) {
    val adjustable: Boolean get() = ctl is ConsoleCtl.Switch || ctl is ConsoleCtl.Choice || ctl is ConsoleCtl.Level

    fun valueText(): String = when (val c = ctl) {
        is ConsoleCtl.Switch -> if (c.on) "On" else "Off"
        is ConsoleCtl.Choice -> c.value.replaceFirstChar { it.uppercase() }
        is ConsoleCtl.Level -> "${c.value}%"
        is ConsoleCtl.Go -> c.value.orEmpty()
        is ConsoleCtl.Info -> c.value
    }

    /** A press (A, or a second tap): a switch flips, a choice goes to the next and round again, a level goes up ten and round to zero. */
    fun press() = step(1, round = true)

    /** Left (-1) or right (+1). A choice goes round; a level stops at its ends; a switch flips. */
    fun step(dir: Int, round: Boolean = false) {
        when (val c = ctl) {
            is ConsoleCtl.Switch -> c.set(!c.on)
            is ConsoleCtl.Choice -> { val i = c.options.indexOf(c.value).coerceAtLeast(0); c.set(c.options[(i + dir).mod(c.options.size)]) }
            is ConsoleCtl.Level -> if (c.enabled) { val n = if (round && dir > 0 && c.value >= 100) 0 else (c.value + 10 * dir).coerceIn(0, 100); if (n != c.value) c.set(n) }
            is ConsoleCtl.Go -> c.run()
            is ConsoleCtl.Info -> {}
        }
    }

    internal val on: Boolean get() = picOn ?: (ctl as? ConsoleCtl.Switch)?.on ?: true
    internal val level: Int get() = picLevel ?: when (val c = ctl) {
        is ConsoleCtl.Level -> c.value
        // The strongest choice is written first (Cinematic, Balanced, Minimal; Full, Reduced, Off).
        is ConsoleCtl.Choice -> (c.options.size - 1 - c.options.indexOf(c.value)).coerceAtLeast(0)
        else -> 100
    }
}

internal sealed interface ConsoleItem {
    /** A group's small gold heading. */
    class Head(val title: String) : ConsoleItem
    class Line(val row: ConsoleRow) : ConsoleItem
    /** Something that is not a line: a sign-in form, a search box, a line of small print. */
    class Block(val key: String, val content: @Composable () -> Unit) : ConsoleItem
}

/** A page a line opens in place of the list (Edit profile, What's new, a help topic): Back, a title, then its own content. */
internal class ConsolePage(val key: String, val title: String, val content: @Composable ColumnScope.() -> Unit)

internal class ConsoleTab(val name: String, val icon: ImageVector)

/**
 * A section as its builder hands it over: the lines, and the page that is open over them (if any). [form]: the section opens on a
 * form (signing in), so the panel waits until a line is picked and leaves its room to the form.
 */
internal class ConsoleSection(val items: List<ConsoleItem>, val page: ConsolePage? = null, val form: Boolean = false)

internal fun List<ConsoleItem>.rows(): List<ConsoleRow> = mapNotNull { (it as? ConsoleItem.Line)?.row }

/** The longest [ConsoleRow.about] the phone's strip shows whole: five lines of 13 sp beside the picture on a 360 dp phone. */
internal const val CONSOLE_ABOUT_MAX = 170
/** The strip under the list on a phone. One height for every line, so the list never moves as you step through it. */
internal val CONSOLE_STRIP: Dp = 136.dp
/** From this width the panel stands beside the list. */
internal val CONSOLE_WIDE: Dp = 700.dp

internal fun ConsoleTone.ink(plain: Color): Color = when (this) {
    ConsoleTone.PLAIN -> plain; ConsoleTone.GOOD -> Rule.Console.Good; ConsoleTone.WARN -> Rule.Console.Warn; ConsoleTone.BAD -> Rule.Console.Bad
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ConsoleScreen(title: String, tabs: List<ConsoleTab>, tab: Int, onTab: (Int) -> Unit, onClose: () -> Unit, section: ConsoleSection,
                           onPageClose: () -> Unit, focus: String?, onFocus: (String) -> Unit, overlay: @Composable BoxScope.() -> Unit = {}) {
    val rows = section.items.rows()
    val current = rows.firstOrNull { it.id == focus } ?: rows.firstOrNull().takeIf { !section.form }
    val pad by Pad.connected.collectAsState()
    val dual = DualScreen.active
    val icon = tabs[tab.coerceIn(0, tabs.lastIndex)].icon
    val page = section.page
    // Two screens: the bottom screen is the panel, so the top is all list.
    BottomScreen { ConsoleDetail(current, icon, ConsoleDetailShape.BOTTOM) }
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop()
        // A little gold light from the top left corner, where the title stands.
        Box(Modifier.matchParentSize().drawBehind {
            drawRect(Brush.radialGradient(listOf(Site.Gold.copy(alpha = .11f), Color.Transparent), center = Offset.Zero, radius = size.width * .9f))
        })
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding()) {
            val width = maxWidth
            val wide = width >= CONSOLE_WIDE
            val side = wide && !dual
            val typing = WindowInsets.isImeVisible
            Column(Modifier.fillMaxSize()) {
                ConsoleHeader(title, onClose)
                ConsoleTabs(tabs, tab, wide, pad, onTab)
                Row(Modifier.weight(1f).fillMaxWidth()) {
                    Column(Modifier.weight(1f).fillMaxHeight()) {
                        val scroll = remember(tab, page?.key) { ScrollState(0) }
                        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(scroll)) {
                            if (page != null) ConsolePageView(page, onPageClose) else ConsoleList(section.items, current?.id, onFocus)
                            Spacer(Modifier.height(14.dp + padBarSpace()))
                        }
                        // The keyboard takes the strip's room while you type.
                        if (!side && !dual && page == null && !typing && current != null) ConsoleDetail(current, icon, ConsoleDetailShape.STRIP)
                    }
                    if (side) ConsoleDetail(current, icon, ConsoleDetailShape.SIDE, Modifier.width(if (width < 840.dp) 268.dp else 310.dp))
                }
            }
        }
        overlay()
    }
}

@Composable
private fun ConsoleHeader(title: String, onClose: () -> Unit) =
    Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 12.dp, top = 12.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title.uppercase(), Modifier.weight(1f).semantics { heading(); contentDescription = title }, style = Rule.Type.cinzel(22).copy(letterSpacing = .08.em), maxLines = 1)
        val shape = RoundedCornerShape(Rule.Radius.Button)
        Box(Modifier.size(44.dp).clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape)
            .clickable(onClickLabel = "Close", role = Role.Button, onClick = onClose).semantics { contentDescription = "Close" }, contentAlignment = Alignment.Center) {
            Icon(SiteIcons.Close, 20.dp, Site.Text)
        }
    }

/** A small key cap (LB, RB) beside the sections while a controller is here. */
@Composable
private fun ConsoleKey(label: String) {
    val shape = RoundedCornerShape(Rule.Radius.Tag)
    Text(label, Modifier.clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape).padding(horizontal = 6.dp, vertical = 3.dp), style = Rule.Type.sans(11, FontWeight.ExtraBold, Site.Muted))
}

/**
 * The six sections on one line with no sideways scroll on a 360 dp phone (butter pass B3): each takes only its word's width and
 * they share the spare room. The one you are in is gold over a short bar. Large text may still make the row scroll.
 */
@Composable
private fun ConsoleTabs(tabs: List<ConsoleTab>, tab: Int, wide: Boolean, pad: Boolean, onTab: (Int) -> Unit) {
    val line = Site.Line
    BoxWithConstraints(Modifier.fillMaxWidth().drawBehind { drawRect(line, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }) {
        Row(Modifier.horizontalScroll(rememberScrollState()).widthIn(min = maxWidth).padding(horizontal = if (wide) 18.dp else 8.dp),
            horizontalArrangement = if (wide) Arrangement.spacedBy(8.dp) else Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            if (wide && pad) ConsoleKey("LB")
            tabs.forEachIndexed { i, t ->
                val on = i == tab
                val gold = Site.Gold
                Box(Modifier.heightIn(min = 44.dp).selectable(selected = on, role = Role.Tab) { onTab(i) }.semantics { contentDescription = t.name }
                    .drawBehind {
                        if (!on) return@drawBehind
                        val inset = 3.dp.toPx(); val slant = 5.dp.toPx(); val h = 3.dp.toPx()
                        drawPath(Path().apply { moveTo(inset, size.height); lineTo(inset + slant, size.height - h); lineTo(size.width - inset - slant, size.height - h); lineTo(size.width - inset, size.height); close() }, gold)
                    }.padding(horizontal = if (wide) 12.dp else 5.dp), contentAlignment = Alignment.Center) {
                    Text(t.name.uppercase(), style = Rule.Type.sans(if (wide) 13 else 11, FontWeight.ExtraBold, if (on) gold else Site.Muted).copy(letterSpacing = if (wide) .11.em else .05.em), maxLines = 1, softWrap = false)
                }
            }
            if (wide && pad) ConsoleKey("RB")
        }
    }
}

@Composable
private fun ConsoleList(items: List<ConsoleItem>, focus: String?, onFocus: (String) -> Unit) {
    for (item in items) when (item) {
        is ConsoleItem.Head -> ConsoleHead(item.title)
        is ConsoleItem.Line -> key(item.row.id) { ConsoleLine(item.row, item.row.id == focus, { onFocus(item.row.id) }) }
        is ConsoleItem.Block -> key(item.key) { item.content() }
    }
}

@Composable
internal fun ConsoleHead(title: String) =
    Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title.uppercase(), Modifier.semantics { heading(); contentDescription = title }, style = Rule.Type.cinzel(11, Site.Gold).copy(letterSpacing = .16.em))
        Box(Modifier.weight(1f).height(1.dp).background(Brush.horizontalGradient(listOf(Site.Line, Color.Transparent))))
    }

/**
 * One line: 48 dp at least, the name at the left, the value at the right. The line you are on is washed gold from a gold bar
 * at its left, its name turns bright and its value shows its arrows.
 */
@Composable
internal fun ConsoleLine(r: ConsoleRow, focused: Boolean, onFocus: () -> Unit, ring: ConsoleRing = ConsoleRing.FREE, modifier: Modifier = Modifier) {
    val view = LocalView.current
    val gold = Site.Gold
    val row by rememberUpdatedState(r)
    val toFocus by rememberUpdatedState(onFocus)
    fun changed() { if (AppSettings.haptics) runCatching { view.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK) } }
    fun step(dir: Int) { toFocus(); row.step(dir); if (row.adjustable) changed() }
    fun press() { toFocus(); row.press(); if (row.adjustable) changed() }
    // A controller: the line you are on takes the ring when it appears (the screen opens, the section changes, a page closes).
    val stop = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (focused && Pad.connected.value && (ring == ConsoleRing.TAKE || (ring == ConsoleRing.FREE && !PadPrompts.anyFocus))) runCatching { stop.requestFocus() } }
    val verb = when (val c = r.ctl) { is ConsoleCtl.Go -> c.verb; is ConsoleCtl.Info -> null; else -> "Change" }
    val acts = remember(verb) { PadActs(a = verb) }
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp)
        .then(if (focused) Modifier.background(Brush.horizontalGradient(0f to gold.copy(alpha = .2f), .72f to gold.copy(alpha = .04f), 1f to Color.Transparent)) else Modifier)
        .drawBehind { if (focused) drawRect(gold, size = Size(3.dp.toPx(), size.height)) }
        .onFocusChanged { if (it.isFocused) toFocus() }
        .onKeyEvent { e ->
            val dir = when (e.key) { Key.DirectionLeft -> -1; Key.DirectionRight -> 1; else -> 0 }
            if (dir == 0 || !row.adjustable) false else { if (e.type == KeyEventType.KeyDown) step(dir); true }
        }
        .then(modifier).focusRequester(stop).focusProperties { canFocus = ring != ConsoleRing.NONE }.padActs(acts)
        .clickable(onClickLabel = verb, role = if (r.ctl is ConsoleCtl.Switch) Role.Switch else Role.Button) { if (focused || !row.adjustable) press() else toFocus() }
        .semantics { if (r.valueText().isNotEmpty()) stateDescription = r.valueText() }
        .padding(start = 18.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(r.title, Modifier.weight(1f).padding(vertical = 8.dp),
            style = Rule.Type.sans(15, if (focused) FontWeight.Bold else FontWeight.SemiBold, if (r.danger) Rule.Console.Bad else if (focused) Site.Text else Site.Muted))
        ConsoleValue(r, focused, onStep = { step(it) })
    }
}

@Composable
private fun ConsoleValue(r: ConsoleRow, focused: Boolean, onStep: (Int) -> Unit) {
    val ink = if (focused) Site.Gold else Site.Muted
    val stepNow by rememberUpdatedState(onStep)
    when (val c = r.ctl) {
        is ConsoleCtl.Switch, is ConsoleCtl.Choice -> Row(verticalAlignment = Alignment.CenterVertically) {
            // Before the line has the arrows, a tap anywhere on its value goes to the next one.
            ConsoleArrow("‹", focused) { stepNow(if (focused) -1 else 1) }
            Text(r.valueText(), Modifier.widthIn(min = 74.dp).pointerInput(Unit) { detectTapGestures { stepNow(1) } }.padding(vertical = 12.dp), textAlign = TextAlign.Center,
                style = Rule.Type.sans(14, FontWeight.Bold, ink), maxLines = 1, softWrap = false)
            ConsoleArrow("›", focused) { stepNow(1) }
        }
        is ConsoleCtl.Level -> Row(Modifier.alpha(if (c.enabled) 1f else .4f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ConsolePips(c, ink)
            Text("${c.value}%", Modifier.widthIn(min = 42.dp), textAlign = TextAlign.End, style = Rule.Type.sans(14, FontWeight.Bold, ink), maxLines = 1, softWrap = false)
        }
        is ConsoleCtl.Go -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            c.value?.takeIf { it.isNotBlank() }?.let { Text(it, Modifier.widthIn(max = 170.dp), style = Rule.Type.sans(14, FontWeight.Bold, c.tone.ink(ink)), maxLines = 1, overflow = TextOverflow.Ellipsis) }
            Icon(SiteIcons.ChevronRight, 18.dp, if (focused) Site.Gold else Site.Faint)
        }
        is ConsoleCtl.Info -> Text(c.value, Modifier.widthIn(max = 190.dp).padding(end = 6.dp), style = Rule.Type.sans(14, FontWeight.Bold, c.tone.ink(ink)), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** An arrow beside a value: seen only on the line you are on, 28 by 48 to the finger. */
@Composable
private fun ConsoleArrow(glyph: String, shown: Boolean, onTap: () -> Unit) {
    val tap by rememberUpdatedState(onTap)
    Box(Modifier.size(width = 28.dp, height = 48.dp).pointerInput(Unit) { detectTapGestures { tap() } }, contentAlignment = Alignment.Center) {
        Text(glyph, Modifier.alpha(if (shown) 1f else 0f), style = Rule.Type.sans(18, FontWeight.ExtraBold, Site.Gold))
    }
}

/** A level as ten pips. A tap or a drag along them sets it. */
@Composable
private fun ConsolePips(c: ConsoleCtl.Level, ink: Color) {
    val set by rememberUpdatedState(c.set)
    val enabled by rememberUpdatedState(c.enabled)
    val off = Site.Surface2; val edge = Site.Line
    fun at(x: Float, width: Int) { if (enabled) set((kotlin.math.ceil(x / width * 10f).toInt().coerceIn(0, 10)) * 10) }
    Canvas(Modifier.size(width = 97.dp, height = 44.dp)
        .pointerInput(Unit) { detectTapGestures { at(it.x, size.width) } }
        .pointerInput(Unit) { detectHorizontalDragGestures { change, _ -> change.consume(); at(change.position.x, size.width) } }) {
        val w = 7.dp.toPx(); val gap = 3.dp.toPx(); val h = 15.dp.toPx(); val top = (size.height - h) / 2; val r = CornerRadius(2.dp.toPx())
        for (i in 0 until 10) {
            val lit = i < c.value / 10
            drawRoundRect(if (lit) ink else off, Offset(i * (w + gap), top), Size(w, h), r)
            if (!lit) drawRoundRect(edge, Offset(i * (w + gap), top), Size(w, h), r, style = Stroke(1.dp.toPx()))
        }
    }
}

/** A page in place of the list. Back (and B) returns to the lines. */
@Composable
private fun ConsolePageView(page: ConsolePage, onClose: () -> Unit) {
    BackHandler(onBack = onClose)
    val ring = remember { FocusRequester() }
    LaunchedEffect(page.key) { if (Pad.connected.value) runCatching { ring.requestFocus() } }
    Column(Modifier.fillMaxWidth().widthIn(max = 760.dp)) {
        Row(Modifier.heightIn(min = 48.dp).focusRequester(ring).clickable(onClickLabel = "Back", role = Role.Button, onClick = onClose).padding(start = 14.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(SiteIcons.Back, 18.dp, Site.Gold)
            Text("Back", style = Rule.Type.sans(14, FontWeight.Bold, Site.Gold))
        }
        Text(page.title, Modifier.padding(horizontal = 18.dp).semantics { heading() }, style = Rule.Type.cinzel(20))
        Column(Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = page.content)
    }
}

internal enum class ConsoleDetailShape { STRIP, SIDE, BOTTOM }

/** The panel: the line's picture, its name, what it does, its default, and any fresh news about it. */
@Composable
internal fun ConsoleDetail(r: ConsoleRow?, icon: ImageVector, shape: ConsoleDetailShape, modifier: Modifier = Modifier) {
    val line = Site.Line
    val ground = Site.Surface.copy(alpha = .88f)
    when (shape) {
        ConsoleDetailShape.STRIP -> Row(modifier.fillMaxWidth().height(CONSOLE_STRIP).background(ground)
            .drawBehind { drawRect(line, size = Size(size.width, 1.dp.toPx())) }.padding(horizontal = 16.dp, vertical = 12.dp)
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            ConsolePicBox(r, icon, 1f, Modifier.size(94.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                // The name comes first: its default stands beside it only when both fit on the one line.
                Layout({
                    Text(r?.title.orEmpty(), style = Rule.Type.sans(15, FontWeight.ExtraBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    r?.default?.let { ConsoleDefault(it) }
                }, Modifier.fillMaxWidth()) { parts, c ->
                    val loose = c.copy(minWidth = 0, minHeight = 0)
                    val name = parts[0].measure(loose)
                    val tag = parts.getOrNull(1)?.measure(loose.copy(maxWidth = androidx.compose.ui.unit.Constraints.Infinity))?.takeIf { name.width + 8.dp.roundToPx() + it.width <= c.maxWidth }
                    val h = maxOf(name.height, tag?.height ?: 0)
                    layout(c.maxWidth, h) { name.placeRelative(0, (h - name.height) / 2); tag?.placeRelative(c.maxWidth - tag.width, (h - tag.height) / 2) }
                }
                // Fresh news takes the words' place here: the strip has one size.
                val news = r?.status
                Text(news?.first ?: r?.about.orEmpty(), style = Rule.Type.sans(13, FontWeight.Medium, news?.second?.ink(Site.Muted) ?: Site.Muted).copy(lineHeight = 18.sp), maxLines = 5, overflow = TextOverflow.Ellipsis)
            }
        }
        ConsoleDetailShape.SIDE -> Column(modifier.fillMaxHeight().background(ground).drawBehind { drawRect(line, size = Size(1.dp.toPx(), size.height)) }.padding(20.dp)
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ConsolePicBox(r, icon, 1.6f, Modifier.fillMaxWidth().height(168.dp))
            ConsoleWords(r, 18, 14)
        }
        ConsoleDetailShape.BOTTOM -> Column(modifier.fillMaxSize().background(Site.Bg).padding(horizontal = 22.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ConsolePicBox(r, icon, 3f, Modifier.fillMaxWidth().weight(1f))
            ConsoleWords(r, 20, 15)
        }
    }
}

@Composable
private fun ConsoleDefault(value: String) = Text("DEFAULT: ${value.uppercase()}", style = Rule.Type.sans(11, FontWeight.ExtraBold, Site.Faint).copy(letterSpacing = .08.em), maxLines = 1, softWrap = false)

@Composable
private fun ConsoleWords(r: ConsoleRow?, title: Int, body: Int) {
    Text(r?.title.orEmpty(), style = Rule.Type.sans(title, FontWeight.ExtraBold))
    Text(r?.about.orEmpty(), style = Rule.Type.sans(body, FontWeight.Medium, Site.Muted).copy(lineHeight = (body + 6).sp))
    r?.default?.let { ConsoleDefault(it) }
    r?.status?.let { (words, tone) -> Text(words, style = Rule.Type.sans(body, FontWeight.Bold, tone.ink(Site.Text)).copy(lineHeight = (body + 6).sp)) }
}

@Composable
private fun ConsolePicBox(r: ConsoleRow?, icon: ImageVector, scale: Float, modifier: Modifier) {
    val shape = RoundedCornerShape(Rule.Radius.Button)
    Box(modifier.clip(shape).background(Site.Bg).border(1.dp, Site.Line, shape), contentAlignment = Alignment.Center) {
        Crossfade(r?.id to r?.pic, animationSpec = tween(if (Motion.still) 0 else 140), label = "console-pic") { _ ->
            Box(Modifier.size(94.dp).graphicsLayer { scaleX = scale; scaleY = scale }, contentAlignment = Alignment.Center) { if (r != null) ConsolePicture(r, icon) else Icon(icon, 42.dp, Site.Gold) }
        }
    }
}

/** The pictures, each inside a 94 dp square. They move only when the phone allows motion. */
@Composable
private fun ConsolePicture(r: ConsoleRow, icon: ImageVector) {
    val context = LocalContext.current
    val still = Motion.still || remember { Playmats.reduced(context) }
    // One clock, 0..1 every 2.4 s, for whichever picture moves.
    val t = if (still) .35f else rememberInfiniteTransition(label = "console").animateFloat(0f, 1f, infiniteRepeatable(tween(2400, easing = LinearEasing), RepeatMode.Restart), label = "t").value
    val gold = Site.Gold
    when (r.pic) {
        ConsolePic.ICON -> Icon(icon, 42.dp, gold)
        ConsolePic.THEME -> {
            val chosen = (r.ctl as? ConsoleCtl.Choice)?.value
            Row(Modifier.size(width = 80.dp, height = 58.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                for ((id, ground, ink) in listOf(Triple("light", Brush.verticalGradient(listOf(Rule.Console.SwatchLight, Rule.Console.SwatchLight)), Rule.Console.SwatchLightInk),
                    Triple("dark", Brush.verticalGradient(listOf(Rule.Console.SwatchDark, Rule.Console.SwatchDark)), Rule.Console.SwatchDarkInk),
                    Triple("aura", Brush.verticalGradient(0f to Rule.Console.SwatchAuraTop, .6f to Rule.Console.SwatchAuraBottom), Rule.Console.SwatchDarkInk))) {
                    val shape = RoundedCornerShape(Rule.Radius.Tag)
                    Box(Modifier.weight(1f).fillMaxHeight().clip(shape).background(ground).border(if (chosen == id) 2.dp else 1.dp, if (chosen == id) Rule.Console.CardRim else Rule.Console.SwatchEdge, shape)
                        .drawBehind { for (i in 0..2) drawRect(ink.copy(alpha = .7f), Offset(size.width * .2f, size.height * (.2f + i * .17f)), Size(size.width * .6f, size.height * .07f)) })
                }
            }
        }
        ConsolePic.GRID -> {
            // Card size: three, two or one across, as a phone's grid has them.
            val across = when ((r.ctl as? ConsoleCtl.Choice)?.value ?: AppSettings.gridSize) { "small" -> 3; "large" -> 1; else -> 2 }
            Canvas(Modifier.size(width = if (across == 1) 38.dp else 58.dp, height = 78.dp)) {
                val gap = size.width * .06f; val w = (size.width - gap * (across - 1)) / across; val h = w * 7f / 5f
                val rowsDown = if (across == 1) 1 else 2
                val top = (size.height - (h * rowsDown + gap * (rowsDown - 1))) / 2
                for (y in 0 until rowsDown) for (x in 0 until across) {
                    val at = Offset(x * (w + gap), top + y * (h + gap))
                    drawRoundRect(Brush.linearGradient(listOf(Rule.Console.SmallCardTop, Rule.Console.SmallCardBottom), at, at + Offset(w, h)), at, Size(w, h), CornerRadius(3.dp.toPx()))
                    drawRoundRect(Rule.Console.CardRim.copy(alpha = .5f), at, Size(w, h), CornerRadius(3.dp.toPx()), style = Stroke(1.dp.toPx()))
                }
            }
        }
        ConsolePic.GLOW -> {
            // Table and match effects: no glow, a glow, a glow that breathes.
            val pulse = if (r.level >= 2) .55f + .2f * kotlin.math.sin(t * 2 * Math.PI).toFloat() else .5f
            Box(Modifier.size(width = 41.dp, height = 58.dp).then(if (r.level >= 1) Modifier.glow(Rule.Console.CardRim, pulse, if (r.level >= 2) .22f else .1f, if (r.level >= 2) .16f else .07f, .2f, if (r.level >= 2) 16.dp else 9.dp) else Modifier)
                .drawBehind { sampleCard(this) })
        }
        ConsolePic.FOIL -> Box(Modifier.size(width = 41.dp, height = 58.dp).drawWithContent {
            sampleCard(this)
            if (r.on) clipPath(Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, size.width, size.height, CornerRadius(6.dp.toPx()))) }) {
                // The foil's sheen: three bands sliding across the face.
                val x = size.width * (-1.2f + 2.4f * t)
                drawRect(Brush.linearGradient(0f to Color.Transparent, .4f to Rule.Console.SheenPink, .5f to Rule.Console.SheenBlue, .6f to Rule.Console.SheenGold, 1f to Color.Transparent,
                    start = Offset(x, 0f), end = Offset(x + size.width * 1.4f, size.height * .7f)))
            }
        })
        ConsolePic.DEPTH -> Box(Modifier.size(width = 41.dp, height = 58.dp).graphicsLayer {
            if (r.on) { rotationY = -24f + (if (still) 0f else 8f * kotlin.math.sin(t * 2 * Math.PI).toFloat()); rotationX = 8f; cameraDistance = 10f * density }
        }.drawBehind { if (r.on) drawRoundRect(Rule.Console.CardShade, Offset(10.dp.toPx(), 12.dp.toPx()), size, CornerRadius(6.dp.toPx())); sampleCard(this) })
        ConsolePic.VOLUME -> {
            // Five bars: as tall as the volume, moving while there is sound, flat when there is none.
            val loud = r.on && r.level > 0
            Canvas(Modifier.size(width = 66.dp, height = 56.dp).alpha(if (loud) 1f else .4f)) {
                val gap = size.width * .06f; val w = (size.width - gap * 4) / 5
                val full = size.height * (r.level / 100f).coerceIn(.2f, 1f)
                for (i in 0 until 5) {
                    val k = if (!loud) .08f else if (still) listOf(.5f, .9f, .65f, 1f, .4f)[i] else .25f + .75f * kotlin.math.abs(kotlin.math.sin((t * 2.4f + listOf(0f, .2f, .45f, .1f, .3f)[i]) * Math.PI)).toFloat()
                    drawRoundRect(gold, Offset(i * (w + gap), size.height - full * k), Size(w, full * k), CornerRadius(2.dp.toPx()))
                }
            }
        }
        ConsolePic.BUZZ -> {
            val shake = if (r.on && !still) kotlin.math.sin(t * 2 * Math.PI * 5).toFloat() else 0f
            Icon(SiteIcons.Vibrate, 46.dp, gold, Modifier.alpha(if (r.on) 1f else .45f).graphicsLayer { translationX = shake * 2.dp.toPx(); rotationZ = shake * 3f })
        }
    }
}

/** The sample card of the pictures: a dark blue face with a gold rim. */
private fun sampleCard(scope: DrawScope) = with(scope) {
    val r = CornerRadius(6.dp.toPx())
    drawRoundRect(Brush.linearGradient(listOf(Rule.Console.CardTop, Rule.Console.CardBottom), Offset.Zero, Offset(size.width, size.height)), cornerRadius = r)
    drawRoundRect(Rule.Console.CardRim, cornerRadius = r, style = Stroke(1.5.dp.toPx()))
}
