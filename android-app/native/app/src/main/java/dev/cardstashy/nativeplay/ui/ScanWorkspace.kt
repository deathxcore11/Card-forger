package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.scale
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate as turn
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * What the Scanner page needs from the phone: [camera] the live preview drawn in #camSlot, [pick] a file input's gallery or camera
 * (its <input type=file>, so the photos go to the same change listener as on the site).
 */
class ScanHost(val camera: @Composable (Modifier) -> Unit = {}, val pick: (SiteNode) -> Unit = {})
val LocalScanHost = staticCompositionLocalOf { ScanHost() }

// style.css :root --game-color, and the scanner's own colours (style.css "Scanner redesign", polish.css .scan-go).
private val GameColor = Color(0xFFF08A5D)
private val GlassLine get() = if (AppSettings.theme == "light") Site.Line else Color(0x31EEC980)

/**
 * scancam.js scanView's .scan-workspace, drawn with style.css / polish.css: the toolbar, the panel (the idle frame with Start camera,
 * the live camera with its status pill and rail, or Photo's Take photo / Upload), the batch tray and the disclosure. Camera on
 * (.is-live) it fills the screen: the preview under a glass toolbar and a glass tray. Anything else in it ([rest]: the review card,
 * Your scans) is drawn by the page's block flow.
 */
@Composable
internal fun ScanWorkspace(n: SiteNode, ui: SiteUi, mark: Modifier, rest: @Composable (SiteNode) -> Unit) {
    val live = n.has("is-live")
    val bar = n.elements.firstOrNull { it.has("scan-toolbar") }
    val panel = n.elements.firstOrNull { it.has("scan-panel") }
    val tray = n.elements.firstOrNull { it.has("scan-tray") }
    if (live) {
        // #app .scan-workspace.is-camera > .scan-panel fills; the toolbar 12 from the top, 14 in; the tray fixed 10 over the nav, 12 in.
        Box(mark.fillMaxSize().background(Color.Black)) {
            panel?.let { ScanPanel(it, ui, true, tray?.has("is-empty") != false, Modifier.fillMaxSize()) }
            bar?.let { ScanToolbar(it, ui, true, Modifier.padding(top = 12.dp, start = 14.dp, end = 14.dp)) }
            tray?.let { ScanTray(it, ui, true, Modifier.align(Alignment.BottomCenter).padding(start = 12.dp, end = 12.dp, bottom = 10.dp)) }
        }
        return
    }
    // Your scans (.is-grid) and Fix card (.is-fixing): the page and its bar fixed over the nav (.scan-grid-bar), as the site has them.
    if (n.has("is-grid")) { ScanGridPage(n, ui, mark, rest); return }
    Column(mark.fillMaxWidth()) {
        n.elements.forEach { k ->
            when {
                k === bar -> ScanToolbar(k, ui, false, Modifier.padding(top = 8.dp, bottom = 4.dp))
                k === panel -> ScanPanel(k, ui, false, true, Modifier.padding(horizontal = 16.dp), n.has("is-camera"))
                k === tray -> ScanTray(k, ui, false, Modifier.padding(horizontal = 16.dp, vertical = 10.dp))
                k.has("scan-disclosure") -> Text(k.text(), Modifier.padding(horizontal = 16.dp, vertical = 6.dp), style = cssType(11f, 400, 15.95f, Site.Muted))
                k.hidden -> {}
                else -> Box(Modifier.padding(horizontal = 16.dp)) { rest(k) }
            }
        }
    }
}

/**
 * .scan-toolbar: "Scan" (Cinzel 700, 24 off camera / 22 on it), Auto game (11.5, a pill in the glass line), Photo / Camera (.btn ghost
 * small) and the gear or stop (a 44 square). Camera on it's glass: 6 8 6 14 in, corners 20, #15181fbf, a 1 #ffffff20 line, white.
 */
@Composable
private fun ScanToolbar(n: SiteNode, ui: SiteUi, live: Boolean, modifier: Modifier) {
    val shape = RoundedCornerShape(20.dp)
    val box = if (live) modifier.fillMaxWidth().clip(shape).background(Color(0xBF15181F)).border(1.dp, Color(0x20FFFFFF), shape).padding(start = 14.dp, end = 8.dp, top = 6.dp, bottom = 6.dp)
        else modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
    Row(box.heightIn(min = 44.dp), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
        n.elements.forEach { k ->
            when {
                k.tag == "h1" -> Text(k.text(), style = androidx.compose.ui.text.TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold,
                    fontSize = (if (live) 22 else 24).sp, lineHeight = (if (live) 26.4 else 28.8).sp, letterSpacing = .02.em, color = if (live) Color.White else Site.Text))
                k.has("scan-auto-game") -> {
                    Text(k.text(), Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, GlassLine, RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp),
                        style = cssType(11.5f, 400, 16.7f, if (live) Color(0xFFD4D7DF) else Site.Muted), maxLines = 1)
                    Spacer(Modifier.weight(1f))
                }
                k.has("btn") -> {
                    val s = RoundedCornerShape(11.dp)
                    Box(Modifier.heightIn(min = 44.dp).clickable { ui.tap(k.id) }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
                        Text(k.text(), Modifier.heightIn(min = 34.dp).clip(s).background(Site.Surface2.copy(alpha = .52f)).border(1.dp, GlassLine, s)
                            .padding(horizontal = 12.dp, vertical = 7.dp), style = cssType(13.5f, 700, 19.6f, Site.Text))
                    }
                }
                k.tag == "button" -> {
                    val s = RoundedCornerShape(12.dp)
                    Box(Modifier.size(44.dp).clip(s).background(Site.Surface2).border(1.dp, Site.Line, s).clickable { ui.tap(k.id) }
                        .semantics { role = Role.Button; k["aria-label"]?.let { contentDescription = it } }, contentAlignment = Alignment.Center) {
                        k.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 20.dp, Site.Text) }
                    }
                }
            }
        }
    }
}

/** .scan-panel: the camera (.cam-wrap), or Photo's actions and status line. */
@Composable
private fun ScanPanel(n: SiteNode, ui: SiteUi, live: Boolean, trayEmpty: Boolean, modifier: Modifier, workspaceCamera: Boolean = true) {
    val cam = n.elements.firstOrNull { it.has("cam-wrap") }
    val status = n.elements.firstOrNull { it.has("scan-status-line") }
    if (cam != null && live) { LiveCamera(cam, ui, trayEmpty, modifier); return }
    val shape = RoundedCornerShape(if (cam != null) 18.dp else 14.dp)
    Column(modifier.fillMaxWidth().clip(shape)
        .then(if (cam != null) Modifier.background(Site.Surface).border(1.dp, Site.Line, shape)
            else Modifier.background(Site.Surface.copy(alpha = .46f)).background(Brush.linearGradient(0f to Color(0x0BFFFFFF), .45f to Color.Transparent)).border(1.dp, GlassLine, shape))) {
        if (cam != null) IdleFrame(cam, ui, workspaceCamera)
        n.elements.firstOrNull { it.has("actions") }?.let { PhotoActions(it, Modifier.padding(top = 10.dp)) }
        status?.takeIf { it.text().isNotEmpty() }?.let { Text(it.text(), Modifier.fillMaxWidth().heightIn(min = 30.dp).padding(horizontal = 12.dp, vertical = 7.dp), style = cssType(11f, 400, 15.4f, Site.Muted)) }
    }
}

/**
 * The idle frame (.cam-wrap:has(.scan-drop)): the game's glow (90% 70% at 50% 40%, 10 %) on the surface, at least
 * clamp(170, screen less 610, 480) tall; in it .scan-drop, at most 300 wide, 16 down, 28 22 in, 12 apart, a dashed card outline 10 in
 * (the game colour at 35 %) round a tilted ghost card; "Ready for your next find." 22 / 800 Manrope, the line under it 13 muted, then
 * Start camera.
 */
@Composable
private fun IdleFrame(cam: SiteNode, ui: SiteUi, camera: Boolean) {
    val drop = cam.elements.firstOrNull { it.has("scan-drop") } ?: return
    Box(Modifier.fillMaxWidth()) {
        val screen = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp.dp
        val minH = (screen - 610.dp).coerceIn(170.dp, 480.dp)
        Box(Modifier.fillMaxWidth().heightIn(min = minH).drawBehind {
            val c = Offset(size.width / 2, size.height * .4f)
            drawRect(Brush.radialGradient(listOf(GameColor.copy(alpha = .1f), Color.Transparent), c, size.width * .9f * .7f))
        }, contentAlignment = Alignment.Center) {
            Column(Modifier.padding(vertical = 16.dp).widthIn(max = 300.dp).fillMaxWidth()
                .drawBehind {
                    // .scan-workspace.is-camera hides the outline and the ghost (style.css 3754).
                    if (camera) return@drawBehind
                    val i = 10.dp.toPx(); val w = size.width - 2 * i; val h = size.height - 2 * i
                    drawRoundRect(GameColor.copy(alpha = .35f), Offset(i, i), androidx.compose.ui.geometry.Size(w, h), CornerRadius(w * .0475f, h * .035f),
                        style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
                    // .scan-ghost: inset 22% 26% 30%, corners 6% / 4.5%, a 1.5 white line at 8 %, tilted 4° back.
                    val gx = size.width * .26f; val gy = size.height * .22f; val gw = size.width * .48f; val gh = size.height * .48f
                    turn(-4f, Offset(gx + gw / 2, gy + gh / 2)) {
                        drawRoundRect(Brush.linearGradient(listOf(Color(0x0DFFFFFF), Color.Transparent), Offset(gx, gy), Offset(gx + gw * .6f, gy + gh * .6f)), Offset(gx, gy),
                            androidx.compose.ui.geometry.Size(gw, gh), CornerRadius(gw * .06f, gh * .045f))
                        drawRoundRect(Color(0x14FFFFFF), Offset(gx, gy), androidx.compose.ui.geometry.Size(gw, gh), CornerRadius(gw * .06f, gh * .045f), style = Stroke(1.5.dp.toPx()))
                    }
                }.then(if (camera) Modifier.padding(horizontal = 12.dp, vertical = 20.dp) else Modifier.padding(horizontal = 22.dp, vertical = 28.dp)),
                verticalArrangement = Arrangement.spacedBy(if (camera) 18.dp else 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                drop.elements.forEach { k ->
                    when {
                        k.tag == "b" -> Text(k.text(), style = androidx.compose.ui.text.TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp,
                            lineHeight = 25.3.sp, letterSpacing = (-.01).em, color = Site.Text), textAlign = TextAlign.Center)
                        k.has("small") -> Text(k.text(), Modifier.widthIn(max = 270.dp), style = cssType(13f, 400, 18.85f, Site.Muted), textAlign = TextAlign.Center)
                        k.has("scan-go") -> GoldPlate(k, ui)
                        k.has("scan-status-line") && k.text().isNotEmpty() -> Text(k.text(), style = cssType(11f, 400, 15.4f, Site.Text), textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}

/**
 * .btn.scan-go (polish.css cs-plate): 52 tall, 26 in, corners 10, the gold bar (180°: #f8e2a8, #e9bf6c 44 %, #c08a3a 56 %, #ddb064),
 * Cinzel 700 16 tracked .1em in #2a1906, a 1 #6b45155e line 4 in, its glow 0 10 30 gold at 30 %; the camera icon 10 before the words.
 */
@Composable
private fun GoldPlate(n: SiteNode, ui: SiteUi) {
    val shape = RoundedCornerShape(10.dp)
    Row(Modifier.heightIn(min = 52.dp).cssShadow(Site.Gold.copy(alpha = .3f), 30.dp, 10.dp, 0.dp, 10.dp).clip(shape)
        .background(Brush.verticalGradient(0f to Color(0xFFF8E2A8), .44f to Color(0xFFE9BF6C), .56f to Color(0xFFC08A3A), 1f to Color(0xFFDDB064)))
        .drawBehind {
            val i = 4.dp.toPx()
            drawRoundRect(Color(0x5E6B4515), Offset(i, i), androidx.compose.ui.geometry.Size(size.width - 2 * i, size.height - 2 * i), CornerRadius(7.dp.toPx()), style = Stroke(1.dp.toPx()))
        }
        .clickable { ui.tap(n.id) }.semantics(mergeDescendants = true) { role = Role.Button }.padding(horizontal = 26.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        n.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 18.dp, Color(0xFF2A1906)) }
        Text(n.text(), style = androidx.compose.ui.text.TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 16.sp,
            letterSpacing = .1.em, color = Color(0xFF2A1906)))
    }
}

/** Photo mode's .actions: Take photo (.btn, gold) and Upload (.btn ghost), 44 tall, 12.5 / 700, corners 11, 8 apart. */
@Composable
private fun PhotoActions(n: SiteNode, modifier: Modifier) {
    val host = LocalScanHost.current
    Row(modifier.padding(horizontal = 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        n.elements.forEach { k ->
            val ghost = k.has("ghost"); val s = RoundedCornerShape(11.dp)
            val ink = if (ghost) Site.Text else Site.GoldInk
            val input = k.find { it.tag == "input" } ?: return@forEach
            Row(Modifier.heightIn(min = 44.dp).clip(s).background(if (ghost) Site.Surface2.copy(alpha = .52f) else Site.Gold)
                .then(if (ghost) Modifier.border(1.dp, GlassLine, s) else Modifier).clickable { host.pick(input) }.semantics(mergeDescendants = true) { role = Role.Button }
                .padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                k.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 16.dp, ink) }
                Text(k.text(), style = cssType(12.5f, 700, 18.1f, ink))
            }
        }
    }
}

/**
 * The live camera (.cam-wrap.immersive): the preview fills it (#camSlot); the status pill (.cam-status: 12 / 700 white on
 * rgba(20,20,24,.85), corners 18, a 2 line red / amber / green) centred 118 over the bottom (206 once the tray holds cards); the rail
 * (.cam-rail: 3 in, corners 14, rgba(10,12,16,.55), 44 buttons) 80 down at the right; the add flash (.scan-flash) 14 down.
 */
@Composable
private fun LiveCamera(cam: SiteNode, ui: SiteUi, trayEmpty: Boolean, modifier: Modifier) {
    val host = LocalScanHost.current
    Box(modifier.background(Color.Black)) {
        if (cam.find { it["id"] == "camSlot" } != null) host.camera(Modifier.fillMaxSize())
        cam.elements.firstOrNull { it.has("cam-status") }?.let { s ->
            val green = s.has("green"); val amber = s.has("amber")
            val line = when { green -> Color(0xFF30C48D); amber -> Color(0xFFF5A524); else -> Color(0xFFE5484D) }
            val shape = RoundedCornerShape(18.dp)
            Row(Modifier.align(Alignment.BottomCenter).padding(bottom = if (trayEmpty) 118.dp else 206.dp, start = 16.dp, end = 16.dp).clip(shape)
                .background(if (green) Color(0xE6104632) else Color(0xD9141418)).border(2.dp, line, shape).padding(horizontal = 12.dp, vertical = 8.dp)
                .semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.padding(end = 8.dp).size(8.dp).clip(CircleShape).background(Color.White))
                Text(s.text(), style = cssType(12f, 700, 15.6f, Color.White), textAlign = TextAlign.Center)
            }
        }
        cam.elements.firstOrNull { it.has("cam-rail") }?.let { r ->
            Row(Modifier.align(Alignment.TopEnd).padding(top = 80.dp, end = 14.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x8C0A0C10))
                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(14.dp)).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                r.elements.filter { it.tag == "button" && !it.hidden }.forEach { b ->
                    val on = b.has("on")
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(if (on) Site.Gold.copy(alpha = .85f) else Color.Transparent).clickable { ui.tap(b.id) }
                        .semantics { role = Role.Button; b["aria-label"]?.let { contentDescription = it } }, contentAlignment = Alignment.Center) {
                        b.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 22.dp, if (on) Site.GoldInk else Color.White) }
                    }
                }
            }
        }
        cam.elements.firstOrNull { it.has("scan-flash") && it.has("show") && it.text().isNotEmpty() }?.let { f ->
            Text(f.text(), Modifier.align(Alignment.TopCenter).padding(top = 14.dp).clip(RoundedCornerShape(999.dp)).background(Color(0xFF62B988))
                .padding(horizontal = 14.dp, vertical = 8.dp), style = cssType(13f, 800, 16f, Color(0xFF04150D)), maxLines = 1)
        }
    }
}

/**
 * The batch tray (.scan-tray): 12 in, corners 22, --surface-2 with the line (camera on: rgba(10,12,16,.74) glass, a #ffffff1f line);
 * the strip of thumbnails and its summary when it holds cards; then Add photos, the shutter (camera on: 64 round, a 4 white ring and a
 * 1 ring 4 out) and the gold Done pile with the count.
 */
@Composable
private fun ScanTray(n: SiteNode, ui: SiteUi, live: Boolean, modifier: Modifier) {
    val host = LocalScanHost.current
    val shape = RoundedCornerShape(22.dp)
    Column(modifier.fillMaxWidth().clip(shape).background(if (live) Color(0xBD0A0C10) else Site.Surface2).border(1.dp, if (live) Color(0x1FFFFFFF) else Site.Line, shape)
        .padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!n.has("is-empty")) n.elements.firstOrNull { it.has("scan-tray-top") }?.let { top ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                top.elements.firstOrNull { it.has("scan-tray-summary") }?.let { Text(it.text(), style = cssType(12f, 400, 15.6f, if (live) Color(0xFFD4D7DF) else Site.Muted)) }
            }
        }
        val row = n.elements.firstOrNull { it.has("scan-tray-row") } ?: return@Column
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            row.elements.forEach { k ->
                when {
                    k.has("scan-tray-pick") -> {
                        val wide = k.has("scan-tray-pick-wide"); val s = RoundedCornerShape(16.dp)
                        val input = k.find { it.tag == "input" }
                        Row((if (wide) Modifier.weight(1f) else Modifier).heightIn(min = 52.dp).widthIn(min = 52.dp).clip(s)
                            .background(if (live) Color(0x17FFFFFF) else Site.Surface).border(1.dp, if (live) Color(0x22FFFFFF) else Site.Line, s)
                            .clickable { input?.let(host.pick) }.semantics(mergeDescendants = true) { role = Role.Button; k["aria-label"]?.let { contentDescription = it } }
                            .padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                            val ink = if (live) Color.White else Site.Text
                            k.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 24.dp, ink) }
                            k.elements.firstOrNull { it.tag == "span" }?.let { Text(it.text(), style = cssType(14f, 700, 20.3f, ink), maxLines = 1) }
                        }
                    }
                    k.has("scan-shutter") -> {
                        Box(Modifier.size(74.dp).border(1.dp, Color(0x65FFFFFF), CircleShape).padding(5.dp).clip(CircleShape).background(Color(0xEDFFFFFF))
                            .border(4.dp, Color.White, CircleShape).clickable { ui.tap(k.id) }
                            .semantics { role = Role.Button; k["aria-label"]?.let { contentDescription = it } }, contentAlignment = Alignment.Center) {
                            k.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 26.dp, Color(0xFF15181F)) }
                        }
                        Spacer(Modifier.weight(1f))
                    }
                    k.has("scan-pile") -> ScanPile(k, ui)
                }
            }
        }
    }
}

/**
 * .scan-tray .scan-pile (Done): 52 tall, 16 0 10 in, corners 16, the gold (180°: #f3cd7c, #d9a743), 16 / 800 Manrope gold-ink, its
 * glow 0 6 18 gold at 30 %; half seen and no glow while empty (disabled). The pile: two cards 30 × 40 (the back one tilted −12°), the
 * count in a 20 dark badge 10 past the top right.
 */
@Composable
private fun ScanPile(n: SiteNode, ui: SiteUi) {
    val off = "disabled" in n.attrs
    val shape = RoundedCornerShape(16.dp)
    val count = n.find { it.tag == "b" }?.text().orEmpty()
    Row(Modifier.alpha(if (off) .5f else 1f).then(if (off) Modifier else Modifier.cssShadow(Color(0x4DE8B95B), 18.dp, 6.dp, 0.dp, 16.dp))
        .heightIn(min = 52.dp).clip(shape).background(Brush.verticalGradient(listOf(Color(0xFFF3CD7C), Color(0xFFD9A743))))
        .clickable(enabled = !off) { ui.tap(n.id) }.semantics(mergeDescendants = true) { role = Role.Button; n["aria-label"]?.let { contentDescription = it } }
        .padding(start = 10.dp, end = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(30.dp, 40.dp)) {
            val card = Modifier.size(30.dp, 40.dp).clip(RoundedCornerShape(4.dp))
                .background(Brush.linearGradient(listOf(androidx.compose.ui.graphics.lerp(Color(0xFF262C39), GameColor, .3f), Color(0xFF151923))))
                .border(1.dp, Color(0xC8FFFFFF), RoundedCornerShape(4.dp))
            Box(Modifier.offset((-5).dp, 0.dp).rotate(-12f).then(card))
            Box(card)
            if (count.isNotEmpty()) Box(Modifier.align(Alignment.TopEnd).offset(10.dp, (-8).dp).heightIn(min = 20.dp).widthIn(min = 20.dp).clip(RoundedCornerShape(99.dp))
                .background(Color(0xFF15181F)).border(2.dp, Color(0xFFD9A743), RoundedCornerShape(99.dp)).padding(horizontal = 5.dp), contentAlignment = Alignment.Center) {
                Text(count, style = cssType(11f, 800, 14f, Color.White))
            }
        }
        n.find { it.has("scan-pile-text") }?.let { t ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(t.text(), style = androidx.compose.ui.text.TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, lineHeight = 16.sp, color = Color(0xFF1B1406)))
                t.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 18.dp, Color(0xFF1B1406), stroke = 2.6f) }
            }
        }
    }
}

/** For the route: the scanner page's markup is live (the camera fills the screen and the page doesn't scroll). */
fun SitePanelModel.scanLive(): Boolean = page?.find { it.has("scan-workspace") }?.has("is-live") == true
/** For the route: Your scans or Fix card, whose bar sits over the nav (the page scrolls inside, under the bar). */
fun SitePanelModel.scanGrid(): Boolean = page?.find { it.has("scan-workspace") }?.has("is-grid") == true

private val Warn = Color(0xFFF2C66D)
private val Good = Color(0xFF6FD29A)
private val GoldBar = Brush.verticalGradient(listOf(Color(0xFFF3CD7C), Color(0xFFD9A743)))
private val Ink = Color(0xFF1B1406)

/** An img of the page: its data: picture (the photo the scanner took) decoded here, else the first of its sources that loads. */
@Composable
private fun scanPic(img: SiteNode?): androidx.compose.ui.graphics.painter.Painter? {
    val src = img?.get("src").orEmpty()
    if (src.startsWith("data:image")) {
        val bmp: androidx.compose.ui.graphics.ImageBitmap? = androidx.compose.runtime.remember(src) { runCatching { val b = android.util.Base64.decode(src.substringAfter(','), android.util.Base64.DEFAULT)
            android.graphics.BitmapFactory.decodeByteArray(b, 0, b.size)?.asImageBitmap() }.getOrNull() }
        return bmp?.let { androidx.compose.ui.graphics.painter.BitmapPainter(it) }
    }
    val list = img?.pic.orEmpty().ifEmpty { listOfNotNull(src.ifBlank { null }) }
    return if (list.isEmpty()) null else firstOf(list)
}

/**
 * Your scans and Fix card (scancam.js batch grid; style.css "Scan grid"): the head (back, the title 22 with its count line 13 muted,
 * Select), Add to (12.5 / 700 muted, then the destination chips: 44 tall pills, the chosen one gold), the tiles (150 wide or more, 16
 * down 10 across; 2 across under 380), and the bar fixed over the nav (22 12 in, fading in from the page): its ghost button and the
 * gold one, 52 tall, corners 16, 16 / 800. Fix card is the same page with its review (.scan-confirm.is-fix-page) in place of the grid.
 */
@Composable
private fun ScanGridPage(n: SiteNode, ui: SiteUi, mark: Modifier, rest: @Composable (SiteNode) -> Unit) {
    val fix = n.elements.firstOrNull { it.has("is-fix-page") }
    val bar = (fix ?: n).elements.firstOrNull { it.has("scan-grid-bar") }
    Box(mark.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(androidx.compose.foundation.rememberScrollState()).padding(bottom = 96.dp)) {
            val parts = if (fix != null) fix.elements else n.elements
            parts.forEach { k ->
                when {
                    k === bar -> {}
                    k.has("scan-grid-head") -> GridHead(k, ui)
                    k.has("scan-dest") -> DestRow(k, ui)
                    k.has("scan-grid") -> TileGrid(k, ui)
                    k.has("scan-confirm-body") -> FixBody(k, ui, rest)
                    k.hidden -> {}
                    else -> rest(k)
                }
            }
        }
        bar?.let { GridBar(it, ui, Modifier.align(Alignment.BottomCenter)) }
    }
}

@Composable
private fun GridHead(n: SiteNode, ui: SiteUi) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        n.elements.forEach { k ->
            when {
                k.has("icon") -> { val sh = RoundedCornerShape(12.dp)
                    Box(Modifier.size(44.dp).clip(sh).background(Site.Surface2).border(1.dp, Site.Line, sh).clickable { ui.tap(k.id) }
                        .semantics { role = Role.Button; contentDescription = k["aria-label"] ?: "Back" }, contentAlignment = Alignment.Center) {
                        k.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 20.dp, Site.Text) } ?: Text(k.text(), style = cssType(18f, 700, 20f, Site.Text))
                    } }
                k.has("scan-grid-title") -> Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    k.elements.firstOrNull { it.tag == "h1" }?.let { Text(it.text(), style = androidx.compose.ui.text.TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold,
                        fontSize = 22.sp, lineHeight = 25.3.sp, color = Site.Text)) }
                    k.elements.firstOrNull { it.tag == "span" }?.let { Text(it.text(), style = cssType(13f, 400, 17f, Site.Muted)) }
                }
                k.has("btn") -> { val sh = RoundedCornerShape(12.dp)
                    Box(Modifier.heightIn(min = 44.dp).clip(sh).background(Site.Surface2).border(1.dp, Site.Line, sh).clickable { ui.tap(k.id) }
                        .semantics { role = Role.Button }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
                        Text(k.text(), style = cssType(14f, 700, 18f, Site.Text), maxLines = 1)
                    } }
            }
        }
    }
}

/** A .scan-chip: 44 tall, 9 16 in, a pill in the line on --surface-2, 14 / 700; chosen (aria-checked), gold. */
@Composable
private fun ScanChip(k: SiteNode, ui: SiteUi, base: Color = Site.Surface2, dashed: Boolean = false, ink: Color = Site.Text) {
    val on = k["aria-checked"] == "true" || k["aria-pressed"] == "true" || k.has("is-selected")
    val off = "disabled" in k.attrs
    val sh = RoundedCornerShape(999.dp)
    Row(Modifier.alpha(if (off) .45f else 1f).heightIn(min = 44.dp).clip(sh)
        .then(if (on) Modifier.background(GoldBar) else Modifier.background(base))
        .then(if (on) Modifier else if (dashed) Modifier.drawBehind {
            drawRoundRect(Color(0xFF3A4150), cornerRadius = CornerRadius(size.height / 2), style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
        } else Modifier.border(1.dp, Site.Line, sh))
        .clickable(enabled = !off) { ui.tap(k.id) }.semantics(mergeDescendants = true) { role = Role.Button }.padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        val c = if (on) Ink else ink
        k.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 16.dp, c, stroke = 2.6f) }
        Text(k.text(), style = cssType(14f, if (on) 800 else 700, 18f, c), maxLines = 1)
    }
}

@Composable
private fun DestRow(n: SiteNode, ui: SiteUi) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        n.elements.firstOrNull { it.has("scan-dest-label") }?.let { Text(it.text(), style = cssType(12.5f, 700, 16f, Site.Muted)) }
        androidx.compose.foundation.layout.FlowRow(Modifier.weight(1f).padding(vertical = 3.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            n.find { it.has("scan-dest-chips") }?.elements?.forEach { k ->
                if (k.has("scan-dest-new-chip")) ScanChip(k, ui, Color.Transparent, dashed = true, ink = Site.Gold) else ScanChip(k, ui, Site.Surface)
            }
        }
    }
}

@Composable
private fun TileGrid(n: SiteNode, ui: SiteUi) {
    androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 16.dp)) {
        val cols = if (maxWidth < 380.dp) 2 else maxOf(1, ((maxWidth + 10.dp) / 160.dp).toInt())
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            n.elements.filter { !it.hidden }.chunked(cols).forEach { line ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    line.forEach { t -> Box(Modifier.weight(1f)) { ScanTile(t, ui, n.has("is-selecting")) } }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

/**
 * .scan-tile: the art 5:7, corners 12, on --surface-2 (one to check: a 2 warn line inside; picked: a 3 gold ring), its state top right
 * 8 in (ready: a 26 green dot with a tick; to check: a warn pill, 11.5 / 800; reading: a 26 gold dot), the name 13.5 / 700, the line
 * under 12 muted (warn when it needs a look).
 */
@Composable
private fun ScanTile(t: SiteNode, ui: SiteUi, selecting: Boolean) {
    val art = t.find { it.has("scan-tile-art") }
    val warn = t.has("is-review") || t.has("is-unresolved"); val picked = t.has("is-selected")
    val dim = t.has("is-reading") || t.has("is-captured")
    val sh = RoundedCornerShape(12.dp)
    Column(Modifier.fillMaxWidth().clip(sh).clickable(enabled = "disabled" !in t.attrs) { ui.tap(t.id) }.semantics(mergeDescendants = true) { role = Role.Button },
        verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(5f / 7f).then(if (picked) Modifier.border(3.dp, Site.Gold, sh) else Modifier).clip(sh).background(Site.Surface2)
            .alpha(if (selecting && !picked) .78f else 1f)) {
            scanPic(art?.find { it.tag == "img" })?.let { androidx.compose.foundation.Image(it, null, Modifier.fillMaxSize().alpha(if (dim) .6f else 1f), contentScale = androidx.compose.ui.layout.ContentScale.Crop) }
            if (warn) Box(Modifier.fillMaxSize().border(2.dp, Warn, sh))
            art?.elements?.firstOrNull { it.has("scan-tile-state") }?.let { st ->
                val m = Modifier.align(Alignment.TopEnd).padding(8.dp)
                when {
                    st.has("is-ok") -> Box(m.size(26.dp).clip(CircleShape).background(Good), contentAlignment = Alignment.Center) {
                        st.elements.firstOrNull { it.tag == "svg" }?.icon?.let { SiteIcon(it, 15.dp, Color(0xFF04150D), stroke = 3f) } }
                    st.has("is-warn") -> Text(st.text(), m.heightIn(min = 24.dp).clip(RoundedCornerShape(999.dp)).background(Warn).padding(horizontal = 9.dp, vertical = 5.dp),
                        style = cssType(11.5f, 800, 14f, Ink))
                    else -> Box(m.size(26.dp).clip(CircleShape).background(Site.Gold), contentAlignment = Alignment.Center) { Text(st.text(), style = cssType(14f, 800, 14f, Ink)) }
                }
            }
        }
        t.elements.firstOrNull { it.has("scan-tile-name") }?.let { Text(it.text(), style = cssType(13.5f, 700, 16.2f, Site.Text)) }
        t.elements.firstOrNull { it.has("scan-tile-meta") }?.let { Text(it.text(), style = cssType(12f, 400, 15f, if (it.has("is-warn")) Warn else Site.Muted)) }
    }
}

/** .scan-grid-bar: fixed over the nav, 22 12 in, the page fading into it; the ghost button and the gold one (flex), 52 tall, 16 / 800. */
@Composable
private fun GridBar(n: SiteNode, ui: SiteUi, modifier: Modifier) {
    Row(modifier.fillMaxWidth().background(Brush.verticalGradient(0f to Site.Bg.copy(alpha = 0f), .4f to Site.Bg)).padding(top = 22.dp, bottom = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp, if (n.has("scan-fix-bar")) Alignment.CenterHorizontally else Alignment.Start), verticalAlignment = Alignment.CenterVertically) {
        n.elements.filter { it.tag == "button" && !it.hidden }.forEach { b ->
            val ghost = b.has("ghost"); val off = "disabled" in b.attrs; val sh = RoundedCornerShape(16.dp)
            Box((if (ghost) Modifier else Modifier.weight(1f).widthIn(max = 760.dp)).alpha(if (off) .5f else 1f)
                .then(if (ghost || off) Modifier else Modifier.cssShadow(Color(0x4DE8B95B), 18.dp, 6.dp, 0.dp, 16.dp))
                .heightIn(min = 52.dp).clip(sh).then(if (ghost) Modifier.background(Site.Surface2).border(1.dp, Site.Line, sh) else Modifier.background(GoldBar))
                .clickable(enabled = !off) { ui.tap(b.id) }.semantics { role = Role.Button }.padding(horizontal = 18.dp), contentAlignment = Alignment.Center) {
                Text(b.text(), style = androidx.compose.ui.text.TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, lineHeight = 17.6.sp,
                    color = if (ghost) Site.Text else Ink), textAlign = TextAlign.Center)
            }
        }
    }
}

/**
 * Fix card's body (.scan-confirm.is-fix-page .scan-confirm-body, at most 760 wide): Your photo (a row in the line, its 52 × 72 picture),
 * the printings to swipe through (printing-picker.css: each slide 76 % wide, the others smaller and faded; the art in a soft glow of the
 * game colour, then name 21, set 13 muted, number, and the slide's chips or This is my card), the arrows with "1 / 7", then Finish and
 * copies, the condition (five 44 buttons, the chosen gold), language and price, the value card, and Different card?.
 */
@Composable
private fun FixBody(n: SiteNode, ui: SiteUi, rest: @Composable (SiteNode) -> Unit) {
    Column(Modifier.fillMaxWidth().widthIn(max = 760.dp)) {
        n.elements.forEach { k ->
            when {
                k.has("scan-fix-photo-row") -> { val sh = RoundedCornerShape(14.dp)
                    Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp).clip(sh).background(Site.Surface).border(1.dp, Site.Line, sh).padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(52.dp, 72.dp).clip(RoundedCornerShape(7.dp)).background(Site.Surface2)) {
                            scanPic(k.find { it.tag == "img" })?.let { androidx.compose.foundation.Image(it, null, Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop) }
                        }
                        Text(k.find { it.tag == "figcaption" }?.text().orEmpty(), style = cssType(13f, 400, 17.55f, Site.Muted))
                    } }
                k.has("scan-inline-printings") -> Printings(k, ui)
                k.has("scan-finish") -> FinishRow(k, ui)
                k.has("scan-confirm-conditions") -> Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    k.elements.filter { it.tag == "button" }.forEach { b -> val on = b["aria-pressed"] == "true"; val sh = RoundedCornerShape(12.dp)
                        Box(Modifier.weight(1f).heightIn(min = 44.dp).clip(sh).then(if (on) Modifier.background(GoldBar) else Modifier.background(Site.Surface).border(1.dp, Site.Line, sh))
                            .clickable { ui.tap(b.id) }.semantics { role = Role.Button; b["aria-label"]?.let { contentDescription = it } }, contentAlignment = Alignment.Center) {
                            Text(b.text(), style = cssType(13f, 700, 16f, if (on) Ink else Site.Text), maxLines = 1)
                        } } }
                k.has("scan-condition-value") -> { val sh = RoundedCornerShape(16.dp)
                    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp).clip(sh).background(androidx.compose.ui.graphics.lerp(Color(0xFF151820), Site.Gold, .08f))
                        .border(1.dp, Site.Gold.copy(alpha = .35f), sh).padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        k.elements.forEach { c -> if (c.tag == "strong") Text(c.text(), style = cssType(20f, 700, 24f, Site.Gold)) else Text(c.text(), style = cssType(12f, 400, 16f, Site.Muted)) }
                    } }
                k.has("scan-fix") && !k.has("is-open") -> k.elements.firstOrNull { it.has("scan-fix-toggle") }?.let { t ->
                    Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { ui.tap(t.id) }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
                        Text(t.text() + "  ▾", style = cssType(14f, 700, 18f, Site.Muted), textAlign = TextAlign.Center)
                    } }
                k.hidden -> {}
                else -> rest(k)
            }
        }
    }
}

@Composable
private fun FinishRow(k: SiteNode, ui: SiteUi) {
    val sh = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp).clip(sh).background(Site.Surface2).border(1.dp, Site.Line, sh).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        k.elements.firstOrNull { it.has("scan-finish-label") }?.let { Text(it.text().uppercase(), style = cssType(12f, 800, 16f, Site.Muted, track = .48f)) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            androidx.compose.foundation.layout.FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                k.find { it.has("scan-chips") }?.elements?.forEach { c -> ScanChip(c, ui) }
            }
            k.find { it.has("ss-qty") }?.let { q -> Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                q.elements.forEach { e -> if (e.tag == "button") { val s2 = RoundedCornerShape(12.dp)
                    Box(Modifier.size(44.dp).clip(s2).background(Site.Surface2).border(1.dp, Site.Line, s2).clickable(enabled = "disabled" !in e.attrs) { ui.tap(e.id) }
                        .semantics { role = Role.Button; e["aria-label"]?.let { contentDescription = it } }, contentAlignment = Alignment.Center) {
                        Text(e.text(), style = cssType(16f, 800, 18f, Site.Text)) }
                } else Text(e.text(), Modifier.widthIn(min = 28.dp), style = cssType(16f, 800, 20f, Site.Text), textAlign = TextAlign.Center) }
            } }
        }
    }
}

/** .printing-carousel in the review: a pager of the slides (swiping or the arrows step the page's own current one, scanBrowseStep). */
@Composable
private fun Printings(k: SiteNode, ui: SiteUi) {
    val car = k.find { it.has("printing-carousel") }
    val slides = car?.elements?.filter { it.has("printing-slide") }.orEmpty()
    val cur = slides.indexOfFirst { it.has("is-current") }.coerceAtLeast(0)
    val nav = k.find { it.has("printing-carousel-nav") }
    val arrows = nav?.elements?.filter { it.tag == "button" }.orEmpty()
    if (slides.isNotEmpty()) {
        val pager = androidx.compose.foundation.pager.rememberPagerState(cur) { slides.size }
        androidx.compose.runtime.LaunchedEffect(cur) { if (pager.currentPage != cur) pager.animateScrollToPage(cur) }
        androidx.compose.runtime.LaunchedEffect(pager.settledPage) {
            val want = pager.settledPage
            if (want != cur && arrows.size == 2) ui.tap((if (want > cur) arrows[1] else arrows[0]).id)
        }
        androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth()) {
            val slideW = maxWidth * .76f
            androidx.compose.foundation.pager.HorizontalPager(pager, Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 10.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = (maxWidth - slideW) / 2), pageSpacing = 14.dp, verticalAlignment = Alignment.Top) { i ->
                val sl = slides[i]; val on = i == pager.currentPage
                Column(Modifier.fillMaxWidth().alpha(if (on) 1f else .5f).scale(if (on) 1f else .93f), horizontalAlignment = Alignment.CenterHorizontally) {
                    val screen = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp.dp
                    Box(Modifier.fillMaxWidth().height((screen * .32f).coerceIn(190.dp, 330.dp)).clip(RoundedCornerShape(14.dp))
                        .background(Brush.radialGradient(listOf(GameColor.copy(alpha = .13f), Color.Transparent))), contentAlignment = Alignment.Center) {
                        scanPic(sl.find { it.tag == "img" })?.let { androidx.compose.foundation.Image(it, null, Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)), contentScale = androidx.compose.ui.layout.ContentScale.Fit) }
                    }
                    sl.find { it.has("printing-slide-copy") }?.let { cp ->
                        Column(Modifier.fillMaxWidth().padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(7.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            cp.elements.forEach { c ->
                                when {
                                    c.tag == "strong" -> Text(c.text(), style = cssType(21f, 800, 25.2f, Site.Text), textAlign = TextAlign.Center)
                                    c.tag == "b" -> Text(c.text(), style = cssType(13f, 700, 17f, Site.Muted), textAlign = TextAlign.Center)
                                    c.has("scan-chips") -> androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) { c.elements.forEach { ScanChip(it, ui) } }
                                    c.tag == "button" -> { val sh = RoundedCornerShape(12.dp); val sel = c.has("is-selected")
                                        Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(sh).background(if (sel) GoldBar else Brush.verticalGradient(listOf(Site.Gold, Site.Gold)))
                                            .clickable { ui.tap(c.id) }.semantics { role = Role.Button }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                                            Text(c.text(), style = cssType(14f, 800, 18f, Ink), textAlign = TextAlign.Center) } }
                                    c.tag == "span" || c.tag == "small" -> Text(c.text(), style = cssType(13f, 400, 17f, Site.Muted), textAlign = TextAlign.Center)
                                    else -> {}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    nav?.let { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(22.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        it.elements.forEach { e -> if (e.tag == "button") { val sh = RoundedCornerShape(12.dp)
            Box(Modifier.size(44.dp).clip(sh).background(Site.Surface2).border(1.dp, Site.Line, sh).clickable(enabled = "disabled" !in e.attrs) { ui.tap(e.id) }
                .semantics { role = Role.Button; contentDescription = e["aria-label"] ?: if (e.text() == "←") "Previous printing" else "Next printing" }, contentAlignment = Alignment.Center) {
                Text(e.text(), style = cssType(16f, 700, 18f, Site.Text)) }
        } else Text(e.text(), style = cssType(13f, 400, 17f, Site.Muted)) }
    } }
    k.elements.firstOrNull { it.has("scan-browse-status") }?.let { Text(it.text(), Modifier.fillMaxWidth().padding(vertical = 6.dp), style = cssType(12f, 400, 16f, Site.Muted), textAlign = TextAlign.Center) }
}

