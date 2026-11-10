package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

/*
 * The one sheet (rulebook R4, specs/rulebook-native.md): a glass panel with 20 corners, a grabber and a Cinzel 18 title, used
 * as a Menu (rows 48 tall, Manrope SemiBold 15) and as a Confirm (words, Ghost Cancel, Gold or Danger action). It is drawn in
 * the app's own tree by RuleSheetHost at the root, never in a Dialog or Popup window, so A, B, X, Y and the ring always
 * reach it. B cancels; on a Confirm X is the action.
 */

private class SheetEntry { var content: @Composable () -> Unit = {} }
private val sheets = mutableStateListOf<SheetEntry>()

/** On the app's root, over the pages and under the prompt bar. */
@Composable
fun RuleSheetHost() { sheets.forEach { e -> key(e) { e.content() } } }

/** Shows [content] in the root host for as long as this call stays in the composition. */
@Composable
private fun Portal(content: @Composable () -> Unit) {
    val now = rememberUpdatedState(content)
    val entry = remember { SheetEntry().also { it.content = { now.value() } } }
    DisposableEffect(entry) { sheets.add(entry); onDispose { sheets.remove(entry) } }
}

/** The panel itself: scrim, glass, grabber, title. A tap outside or B closes. */
@Composable
fun RuleSheet(title: String?, onClose: () -> Unit, pad: PadActs = PadActs(b = "Close", opaque = true), content: @Composable ColumnScope.() -> Unit) = Portal {
    BackHandler(onBack = onClose)
    PadScreen(pad)
    val shape = RoundedCornerShape(Rule.Radius.Sheet)
    Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color.Black.copy(alpha = .7f)).focusProperties { canFocus = false }
        .clickable(remember { MutableInteractionSource() }, null, onClick = onClose).padLayer(), contentAlignment = Alignment.Center) {
        Column(Modifier.windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp).widthIn(max = 460.dp).fillMaxWidth().testTag("ruleSheet")
            .clip(shape).background(Rule.Color.Surface).border(1.dp, Rule.Color.Edge, shape)
            .focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) {}
            .verticalScroll(rememberScrollState()).padding(start = 18.dp, end = 18.dp, top = 10.dp, bottom = 18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.align(Alignment.CenterHorizontally).width(36.dp).height(4.dp).clip(CircleShape).background(Rule.Color.Edge))
            if (!title.isNullOrBlank()) Text(title, style = Rule.Type.SheetTitle)
            content()
        }
    }
}

/** One row of a Menu. */
class RuleRow(val label: String, val danger: Boolean = false, val enabled: Boolean = true, val onClick: () -> Unit)

/** The sheet as a Menu: one 48 dp row per choice; picking one closes the sheet first. */
@Composable
fun RuleMenu(title: String?, rows: List<RuleRow>, onClose: () -> Unit) = RuleSheet(title, onClose) {
    Column {
        rows.forEachIndexed { i, r ->
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(Rule.Color.Line))
            Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(Rule.Radius.Tag)).clickable(enabled = r.enabled) { onClose(); r.onClick() }.padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(r.label, style = Rule.Type.MenuRow.copy(color = if (!r.enabled) Rule.Color.Muted else if (r.danger) Rule.Color.Coral else Rule.Color.Text))
            }
        }
    }
}

/**
 * The sheet as a Confirm: the words, an optional [body] (a field to type in), then Ghost [cancel] and the Gold (or Danger)
 * [action]. B and a tap outside cancel; X is the action.
 */
@Composable
fun RuleConfirm(text: String, action: String, onAction: () -> Unit, onCancel: () -> Unit, title: String? = null, danger: Boolean = false, cancel: String = "Cancel",
                body: (@Composable ColumnScope.() -> Unit)? = null) {
    val run = rememberUpdatedState(onAction)
    RuleSheet(title, onCancel, pad = remember(action) { PadActs(b = cancel, x = PadAct(action) { run.value() }, opaque = true) }) {
        Text(text, style = Rule.Type.S15.copy(lineHeight = androidx.compose.ui.unit.TextUnit(22f, androidx.compose.ui.unit.TextUnitType.Sp)))
        body?.invoke(this)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
            GhostButton(cancel, onClick = onCancel)
            if (danger) DangerButton(action, onClick = onAction) else GoldCta(action, onClick = onAction)
        }
    }
}
