package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.collection.WorkspaceSync
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val TEXT = Color(0xFFEEF0F4)
private fun type(size: Float, weight: Int, line: Float, color: Color = TEXT) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = line.sp, color = color)

/** A CSS box-shadow under a rounded box (blur is the CSS blur radius). */
internal fun Modifier.cssShadow(color: Color, blur: Dp, dy: Dp, spread: Dp, radius: Dp) = drawBehind {
    drawIntoCanvas { c ->
        val paint = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true; this.color = color.toArgb()
            if (blur.toPx() > 0f) maskFilter = android.graphics.BlurMaskFilter(blur.toPx() / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL) }
        val s = spread.toPx(); val r = radius.toPx() + s
        c.nativeCanvas.drawRoundRect(-s, dy.toPx() - s, size.width + s, size.height + dy.toPx() + s, r, r, paint)
    }
}

/**
 * Over every screen: what a Collection save says (app.js toast, with Undo), dialog.js ask's question before a removal, a merge's
 * notice, the save's haptic and chime, and the sync's "Which copy should we keep?" sheet. [backdrop]: the app as drawn, for the
 * backdrop-filters.
 */
@Composable
fun CollectionWritesHost(backdrop: androidx.compose.ui.graphics.layer.GraphicsLayer? = null) {
    val context = LocalContext.current; val view = LocalView.current
    val scope = rememberCoroutineScope()
    val toast by CollectionWrites.toast.collectAsState()
    val ask by CollectionWrites.ask.collectAsState()
    val feel by CollectionWrites.feel.collectAsState()
    val notice by WorkspaceSync.notice.collectAsState()
    val user = Account.session.collectAsState().value?.userId
    // Another account (or none): nothing of the last one's sync stays in flight.
    var last by remember { androidx.compose.runtime.mutableStateOf(user) }
    LaunchedEffect(user) { if (user != last) { last = user; WorkspaceSync.reset() } }
    LaunchedEffect(feel) { feel?.let { f -> Feel.perform(view, f.kind); if (f.chime) PackSfx.app("COL-005", .6f) } }
    LaunchedEffect(notice) { notice?.let { CollectionWrites.show(it); WorkspaceSync.notice.value = null } }
    val deciding by CollectionWrites.deciding.collectAsState()
    val pending by WorkspaceSync.pending.collectAsState()
    if (deciding && pending != null) key(pending) { SyncDecideSheet(backdrop, onClose = { CollectionWrites.deciding.value = false }) }
    val adding by CollectionWrites.adding.collectAsState()
    adding?.let { a -> key(a.id) { AddLotSheet(a, backdrop, onClose = { if (CollectionWrites.adding.value === a) CollectionWrites.adding.value = null }) } }
    val tAdding by CollectionWrites.tAdding.collectAsState()
    tAdding?.let { a -> key(a.id) { TcgAddSheet(a, backdrop, onClose = { if (CollectionWrites.tAdding.value === a) CollectionWrites.tAdding.value = null }) } }
    val comparing by CollectionWrites.comparing.collectAsState()
    comparing?.let { o -> key(o.id) { GameAccent(o.game) { CardCompareSheet(o, backdrop, onClose = { if (CollectionWrites.comparing.value === o) CollectionWrites.comparing.value = null }) } } }
    val askChat by CollectionWrites.asking.collectAsState()
    askChat?.let { o -> key(o.id) { GameAccent(o.game) { AskSheet(o, backdrop, onClose = { if (CollectionWrites.asking.value === o) CollectionWrites.asking.value = null }) } } }
    val metaOpen by CollectionWrites.metaDeck.collectAsState()
    metaOpen?.let { o -> key(o.id) { GameAccent(o.game) {
        val shut = { if (CollectionWrites.metaDeck.value === o) CollectionWrites.metaDeck.value = null }
        MetaDeckHost("https://cardstashy.com/#decks/inspiration", close = shut,
            // A.provenSave: the saved deck's page.
            deck = { d -> shut(); val id = d.get("id")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                val g = if (d.get("go")?.asString == "tdeck") d.get("game")?.asString ?: o.game else "mtg"
                if (id.isNotBlank()) CollectionWrites.deckNav?.invoke(id, g) ?: o.web("https://cardstashy.com/" + (if (g == "mtg") "#deck/" else "#tdeck/") + android.net.Uri.encode(id), null) },
            site = { u, sel -> o.web(u, sel) }, web = o.web)
    } } }
    val alerting by CollectionWrites.alerting.collectAsState()
    alerting?.let { a -> key(a.id) { GameAccent(a.game) { PriceAlertSheet(a, backdrop, onClose = { if (CollectionWrites.alerting.value === a) CollectionWrites.alerting.value = null }) } } }
    // app.js onAlert: an alert a price seen now set off, as the site's toast (pricehist.js alertText).
    LaunchedEffect(Unit) { dev.cardstashy.nativeplay.collection.CollectionEngine.alertsFired.collect { f -> f.get("text")?.asString?.let { CollectionWrites.show(it) } } }
    val picking by CollectionWrites.picking.collectAsState()
    picking?.let { pk -> key(pk.id) { DeckPickSheet(pk, backdrop, onBack = { if (CollectionWrites.picking.value === pk) CollectionWrites.picking.value = null }) } }
    val building by CollectionWrites.building.collectAsState()
    building?.let { b -> key(b.id) { CollectionBuildDeckSheet(b, backdrop, onClose = { if (CollectionWrites.building.value === b) CollectionWrites.building.value = null },
        // Magic builds in the WebView; Yu-Gi-Oh! and Pokémon in the Collection engine (where tcg.js is).
        engine = if ((b.request.get("game")?.takeIf { it.isJsonPrimitive }?.asString ?: "mtg") == "mtg") WebBuildFlow else EngineBuildFlow) } }
    val menu by CollectionWrites.menu.collectAsState()
    menu?.let { m -> key(m.id) { DeckMenuSheet(m, backdrop, onClose = { if (CollectionWrites.menu.value === m) CollectionWrites.menu.value = null }) } }
    val binderOpen by CollectionWrites.binder.collectAsState()
    binderOpen?.let { b -> key(b.id) { GameAccent(b.game) { BinderSheet(b, backdrop, onClose = { if (CollectionWrites.binder.value === b) CollectionWrites.binder.value = null }) } } }
    val binderEditing by CollectionWrites.binderEditing.collectAsState()
    binderEditing?.let { e -> key(e.id) { GameAccent(e.game) { BinderEditSheet(e, backdrop, onClose = { if (CollectionWrites.binderEditing.value === e) CollectionWrites.binderEditing.value = null }) } } }
    val binderHold by CollectionWrites.binderHold.collectAsState()
    binderHold?.let { h -> key(h.id) { GameAccent(h.game) { BinderHoldSheet(h, backdrop, onClose = { if (CollectionWrites.binderHold.value === h) CollectionWrites.binderHold.value = null }) } } }
    val batch by CollectionWrites.batch.collectAsState()
    batch?.let { b -> key(b.id) { GameAccent(b.game) { BatchSheet(b, backdrop, onClose = { if (CollectionWrites.batch.value === b) CollectionWrites.batch.value = null }) } } }
    val collMenu by CollectionWrites.collMenu.collectAsState()
    collMenu?.let { m -> key(m.id) { GameAccent("mtg") { CollMenuSheet(m, backdrop, onClose = { if (CollectionWrites.collMenu.value === m) CollectionWrites.collMenu.value = null }) } } }
    val importing by CollectionWrites.importing.collectAsState()
    importing?.let { i -> key(i.id) { GameAccent(i.game) { ImportSheet(i, backdrop, onClose = { if (CollectionWrites.importing.value === i) CollectionWrites.importing.value = null }) } } }
    val newDeck by CollectionWrites.newDeck.collectAsState()
    newDeck?.let { o -> key(o.id) { GameAccent("mtg") { NewDeckSheet(o, backdrop, onClose = { if (CollectionWrites.newDeck.value === o) CollectionWrites.newDeck.value = null }) } } }
    val deckImport by CollectionWrites.deckImport.collectAsState()
    deckImport?.let { o -> key(o.id) { GameAccent("mtg") { DeckImportSheet(o, backdrop, onClose = { if (CollectionWrites.deckImport.value === o) CollectionWrites.deckImport.value = null }) } } }
    val tDeckImport by CollectionWrites.tDeckImport.collectAsState()
    tDeckImport?.let { o -> key(o.id) { GameAccent(o.game) { TcgDeckImportSheet(o, backdrop, onClose = { if (CollectionWrites.tDeckImport.value === o) CollectionWrites.tDeckImport.value = null }) } } }
    val tNewDeck by CollectionWrites.tNewDeck.collectAsState()
    tNewDeck?.let { o -> key(o.id) { GameAccent(o.game) { TcgNewDeckSheet(o, backdrop, onClose = { if (CollectionWrites.tNewDeck.value === o) CollectionWrites.tNewDeck.value = null }) } } }
    val acquiring by CollectionWrites.acquiring.collectAsState()
    acquiring?.let { o -> key(o.id) { GameAccent("mtg") { AcquireSheet(o, backdrop, onClose = { if (CollectionWrites.acquiring.value === o) CollectionWrites.acquiring.value = null }) } } }
    val proxying by CollectionWrites.proxySheet.collectAsState()
    proxying?.let { o -> key(o.id) { ProxySheet(o, onClose = { if (CollectionWrites.proxySheet.value === o) CollectionWrites.proxySheet.value = null }) } }
    val sharing by CollectionWrites.share.collectAsState()
    sharing?.let { o -> key(o.id) { GameAccent(o.game) { ShareSheet(o, backdrop, onClose = { if (CollectionWrites.share.value === o) CollectionWrites.share.value = null }) } } }
    toast?.let { t -> key(t.id) { SiteToast(t, onUndo = { CollectionWrites.dismiss(t); scope.launch { CollectionWrites.undo(context) } }, onGone = { CollectionWrites.dismiss(t) }) } }
    ask?.let { a -> key(a) { AskDialog(a.question, backdrop, site = a.site, onAnswer = { yes -> CollectionWrites.answer(yes, context, scope) }) } }
    val asking by CollectionWrites.askingText.collectAsState()
    asking?.let { a -> key(a) { AskDialog(a.question, backdrop, input = a.value, onText = { a.reply.complete(it) }, onAnswer = {}) } }
}

/**
 * app.js toast(): style.css #toast as the live page computes it (fixed, centred, 18 px from the bottom, at most half the screen
 * wide on a phone because its left edge sits at 50 %), the ok tone with its drawn tick for "Added…" and the like, Undo for 7 s.
 */
@Composable
private fun SiteToast(t: CollectionWrites.Toast, onUndo: () -> Unit, onGone: () -> Unit) {
    val ok = Regex("^(Added|Saved|On the list|Alert saved|Copied|List copied|Switched|Moved|Updated|\\+)").containsMatchIn(t.text)
    val still = Motion.still
    val a = remember { Animatable(if (still) 1f else 0f) }; val y = remember { Animatable(if (still) 0f else 20f) }
    val circle = remember { Animatable(if (still) 1f else 0f) }; val tick = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(Unit) {
        // #toast { transition: opacity .2s, transform .42s cubic-bezier(.2, 1.3, .3, 1) }; .toast-ico draws its circle, then the tick.
        launch { a.animateTo(1f, tween(200)) }
        launch { y.animateTo(0f, tween(420, easing = CubicBezierEasing(.2f, 1.3f, .3f, 1f))) }
        launch { circle.animateTo(1f, tween(450, easing = CubicBezierEasing(0f, 0f, .58f, 1f))) }
        launch { delay(300); tick.animateTo(1f, tween(300, easing = CubicBezierEasing(0f, 0f, .58f, 1f))) }
        delay(if (t.undo || t.text.startsWith("Backup prepared")) 7000 else 3800)
        launch { y.animateTo(20f, tween(420, easing = CubicBezierEasing(.2f, 1.3f, .3f, 1f))) }
        a.animateTo(0f, tween(200)); onGone()
    }
    val bottom = maxOf(18.dp, WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding())
    BoxWithConstraints(Modifier.fillMaxSize().padding(bottom = bottom), contentAlignment = Alignment.BottomCenter) {
        val w = maxWidth
        val shape = RoundedCornerShape(18.dp)
        Row(Modifier.widthIn(max = minOf(520.dp, w - 24.dp, w / 2))
            .graphicsLayer { alpha = a.value; translationY = y.value * density }
            .cssShadow(Color(0x66000000), 38.dp, 12.dp, 0.dp, 18.dp)
            .clip(shape).background(if (ok) Color(0xF520352F) else Color(0xF5222834)).border(1.dp, Color(0x30FFFFFF), shape)
            .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (ok) Canvas(Modifier.size(20.dp)) {
                // <circle cx=12 cy=12 r=10/><path d="m7.5 12.5 3 3 6-6.5"/>, stroke #1f9d62 2.2 on a 24 grid.
                val k = size.width / 24f; val st = Stroke(2.2f * k, cap = StrokeCap.Round, join = StrokeJoin.Round)
                drawArc(Color(0xFF1F9D62), -90f, 360f * circle.value, false, topLeft = Offset(2 * k, 2 * k), size = androidx.compose.ui.geometry.Size(20 * k, 20 * k), style = st)
                val p = Path().apply { moveTo(7.5f * k, 12.5f * k); relativeLineTo(3 * k, 3 * k); relativeLineTo(6 * k, -6.5f * k) }
                val part = Path(); PathMeasure().apply { setPath(p, false); getSegment(0f, length * tick.value, part, true) }
                drawPath(part, Color(0xFF1F9D62), style = st)
            }
            Text(t.text, Modifier.weight(1f, fill = false), style = type(14f, 600, 20.3f, if (ok) Color(0xFFE8FFF0) else TEXT))
            if (t.undo) Box(Modifier.defaultMinSize(minWidth = 60.dp, minHeight = 40.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x0AFFFFFF))
                .clickable(onClick = onUndo).padding(horizontal = 12.dp, vertical = 6.dp), contentAlignment = Alignment.Center) {
                Text("Undo", style = type(14f, 700, 20.3f, Site.Gold), textAlign = TextAlign.Center)
            }
        }
    }
}

/**
 * dialog.js ask() and askText() on the one sheet (rulebook R4): the question is the title (or the site's own title over it),
 * a removal's button is the danger one and named for it, a text question carries its field. X answers, B cancels.
 */
@Composable
private fun AskDialog(question: String, backdrop: androidx.compose.ui.graphics.layer.GraphicsLayer?, input: String? = null, onText: (String?) -> Unit = {},
                      site: CollectionWrites.SiteAsk? = null, onAnswer: (Boolean) -> Unit) {
    val verb = Regex("^(Delete|Remove|Replace|Clear|Sign out|Start empty|Switch|End|Restore)\\b", RegexOption.IGNORE_CASE).find(question)?.groupValues?.get(1)
    // A question a site handler asked (dialog.js open's own title, buttons and danger) keeps them as the site set them.
    val danger = site?.danger ?: (verb != null && !Regex("^(Restore|Switch)$", RegexOption.IGNORE_CASE).matches(verb))
    val okLabel = site?.ok?.ifBlank { null } ?: if (input != null) "Save" else verb?.replaceFirstChar { it.uppercase() } ?: "OK"
    val cancelLabel = site?.cancel?.ifBlank { null } ?: "Cancel"
    var field by remember { androidx.compose.runtime.mutableStateOf(androidx.compose.ui.text.input.TextFieldValue(input.orEmpty(), androidx.compose.ui.text.TextRange(0, input.orEmpty().length))) }
    val answer: (Boolean) -> Unit = { yes -> if (input != null) onText(if (yes) field.text.trim() else null) else onAnswer(yes) }
    val view = LocalView.current
    LaunchedEffect(Unit) { Feel.perform(view, "tap") }
    val titled = !site?.title.isNullOrBlank()
    RuleConfirm(if (titled) question else "", okLabel, onAction = { if (danger) Feel.perform(view, "warn"); answer(true) }, onCancel = { answer(false) },
        title = if (titled) site!!.title else question, danger = danger, cancel = cancelLabel,
        body = if (input == null) null else ({
            // askText: the field with its words selected; Enter saves; 80 characters at most.
            val focus = remember { androidx.compose.ui.focus.FocusRequester() }
            LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
            androidx.compose.foundation.text.BasicTextField(field, { v -> field = if (v.text.length <= 80) v else v.copy(text = v.text.take(80)) },
                Modifier.fillMaxWidth().focusRequester(focus).semantics { contentDescription = question },
                singleLine = true, textStyle = Rule.Type.S16, cursorBrush = androidx.compose.ui.graphics.SolidColor(Rule.Color.Text),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { answer(true) }),
                decorationBox = { inner -> Box(Modifier.fillMaxWidth().defaultMinSize(minHeight = 44.dp).siteGlassField(12.dp).padding(horizontal = 15.dp, vertical = 13.dp)) { inner() } })
        }))
}

/** body[data-game] for a sheet over a Yu-Gi-Oh! or Pokémon page: its --gold and its buttons' ink are that game's. */
@Composable
internal fun GameAccent(game: String, content: @Composable () -> Unit) {
    val g = CardGame.of(game)
    androidx.compose.runtime.CompositionLocalProvider(LocalGameGold provides g.gold, LocalSheetPal provides sheetPal(g), content = content)
}
