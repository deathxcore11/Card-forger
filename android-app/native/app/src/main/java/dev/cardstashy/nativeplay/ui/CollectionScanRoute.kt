package dev.cardstashy.nativeplay.ui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.collection.ScanWeb
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private const val SITE = "https://cardstashy.com/"

/**
 * The Scan tab (the site's #scan: scancam.js scanView with app.js's scanCtx) for [game]: the site's own scanner running in
 * ScanWeb's hidden page, drawn by SitePanel (ScanWorkspace) from its markup. The phone's camera (CameraX) shows under the page's
 * glass and feeds the site's reader each frame, as getUserMedia's video does on the website; Photo picks from the gallery or
 * takes one with the camera app. What it saves goes to the collection through the Collection engine (ScanWeb). With the camera
 * on the page fills the screen over the tabs, as the site's live scanner does; back stops it first.
 */
@Composable
fun CollectionScanRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, onDecks: () -> Unit, onSearch: () -> Unit,
                        onSets: () -> Unit, web: (url: String, press: String?) -> Unit, game: String = "mtg", onGame: (String) -> Unit = {}) {
    val context = LocalContext.current
    // The scanner shares the page engine with background deck builds: they wait while it is open.
    DisposableEffect(Unit) { dev.cardstashy.nativeplay.play.RandomBuild.foreground = true; onDispose { dev.cardstashy.nativeplay.play.RandomBuild.foreground = false } }
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    var failed by remember(game) { mutableStateOf(false) }
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    val all by ScanWeb.model.collectAsState()
    val panel = all?.takeIf { it.key == "scan|$game" }
    val page = SITE + "#scan"
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    val screen = androidx.compose.ui.platform.LocalConfiguration.current
    val hasCamera = remember { context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) }
    val hasFlash = remember { context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH) }

    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(game, session?.userId, revision) {
        failed = false
        val s = session
        val ws = if (s != null && runCatching { ensureCollection(context, s.userId, true, revision) }.getOrDefault(false))
            runCatching { CollectionEngine.scanWorkspace() }.getOrNull() else null
        if (!ScanWeb.open(game, ws, s?.userId, s?.access, hasCamera, hasFlash, screen.screenWidthDp, screen.screenHeightDp)) failed = true
    }
    DisposableEffect(Unit) { onDispose { ScanWeb.close() } }
    // What the page leaves to the app (scanCtx.details: a card's page; a link the scanner doesn't run itself).
    LaunchedEffect(game) {
        ScanWeb.acted.collect { a ->
            val act = a.get("act")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            val d = a.getAsJsonObject("data") ?: JsonObject()
            fun ds(k: String) = d.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            when (act) {
                "card" -> cards = cards + CardOpen(ds("name"), page = page, tile = "[data-act=\"card\"][data-name=\"${css(ds("name"))}\"]")
                "tCard" -> cards = cards + CardOpen("", page = page, tile = "[data-act=\"tCard\"][data-id=\"${css(ds("id"))}\"]", game = ds("game").ifBlank { game }, id = ds("id"))
                "go" -> when (val to = ds("to")) { "#sets" -> onSets(); "#search" -> onSearch(); "#decks" -> onDecks(); "#collection" -> onCards(); "#home" -> onHome(); else -> web(SITE + to, null) }
                else -> if (act.isNotBlank()) web(page, "[data-act=\"${css(act)}\"]")
            }
        }
    }
    val siteUi = remember(screen.screenWidthDp) {
        SiteUi(tap = ScanWeb::tap, type = ScanWeb::type,
            open = { href -> runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(href)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } },
            screen = screen.screenWidthDp.dp)
    }

    // Photo: the gallery (input without capture) or the camera app (capture="environment"), its picture handed to the input.
    var picking by remember { mutableStateOf<Int?>(null) }
    var shotFile by remember { mutableStateOf<File?>(null) }
    // Full-size photos are read and encoded off the main thread; ScanWeb hands them to the page on main.
    val io = rememberCoroutineScope()
    fun hand(id: Int, uris: List<android.net.Uri>) { io.launch(Dispatchers.IO) {
        val files = uris.mapNotNull { u -> runCatching { context.contentResolver.openInputStream(u)?.use { it.readBytes() } }.getOrNull()?.let { b ->
            Triple(u.lastPathSegment?.substringAfterLast('/')?.takeIf { it.contains('.') } ?: "photo.jpg", context.contentResolver.getType(u) ?: "image/jpeg", b) } }
        if (files.isNotEmpty()) ScanWeb.files(id, files)
    } }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris -> picking?.let { hand(it, uris) }; picking = null }
    val takePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val f = shotFile; val id = picking; picking = null
        if (ok && f != null && id != null) io.launch(Dispatchers.IO) { runCatching { f.readBytes() }.getOrNull()?.let { ScanWeb.files(id, listOf(Triple("photo.jpg", "image/jpeg", it))) } }
    }
    val pick: (SiteNode) -> Unit = { input ->
        picking = input.id
        if (input["capture"] != null && hasCamera) {
            val f = File(context.cacheDir, "scan").apply { mkdirs() }.let { File(it, "photo.jpg") }
            shotFile = f
            runCatching { takePhoto.launch(FileProvider.getUriForFile(context, context.packageName + ".updates", f)) }.onFailure { gallery.launch("image/*") }
        } else gallery.launch("image/*")
    }
    val host = remember { ScanHost(camera = { m -> ScanCamera(m) }, pick = pick) }

    val live = panel?.scanLive() == true
    // The camera's back stops it (scancam's ✕), as leaving the live scanner does on the site.
    BackHandler(live && cards.isEmpty()) { panel?.page?.find { it["data-act"] == "scanStop" }?.let { ScanWeb.tap(it.id) } }
    val sheet = panel?.sheetBody
    val g = CardGame.of(game)
    CompositionLocalProvider(LocalScanHost provides host) {
        GameAccent(game) {
            if (live && panel != null) Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color.Black).windowInsetsPadding(WindowInsets.safeDrawing)) {
                SitePanel(panel, siteUi, Modifier.fillMaxSize(), padded = false)
            } else BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
                val wide = maxWidth >= 600.dp
                val gutter = if (wide) 22.dp else 16.dp
                val nav: @Composable (Boolean) -> Unit = { v ->
                    CollectionNav(CollectionTab.SCAN, vertical = v) { t ->
                        when (t) {
                            CollectionTab.HOME -> onHome(); CollectionTab.CARDS -> onCards(); CollectionTab.SEARCH -> onSearch(); CollectionTab.DECKS -> onDecks()
                            CollectionTab.SCAN -> {}
                        }
                    }
                }
                // Your scans / Fix card: the page scrolls under its own bar, which sits over the nav (.scan-grid-bar), so it isn't in the scroll.
                val grid = panel?.scanGrid() == true
                val body: @Composable (Modifier) -> Unit = { mod ->
                    Column(if (grid) mod else mod.verticalScroll(rememberScrollState())) {
                        Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                            TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile,
                                middle = if (wide) ({ GameTabs(g, { c -> if (c != g) onGame(c.id) }, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
                        }
                        Column(Modifier.fillMaxWidth().then(if (grid) Modifier.weight(1f) else Modifier).padding(horizontal = gutter).padding(top = if (wide) 4.dp else 10.dp, bottom = if (grid) 0.dp else 28.dp)) {
                            if (!wide) GameTabs(g, { c -> if (c != g) onGame(c.id) }, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                            if (panel == null) Text(if (failed) "The Scanner couldn’t open on this phone. Check your connection and try again." else "Opening the Scanner…",
                                Modifier.fillMaxWidth().padding(top = 40.dp), style = Site.Meta, textAlign = TextAlign.Center)
                            else if (grid) Box(Modifier.widthIn(max = 1196.dp).weight(1f).align(Alignment.CenterHorizontally)) { SitePanel(panel, siteUi, Modifier.fillMaxSize(), padded = false) }
                            else Box(Modifier.widthIn(max = 1196.dp).align(Alignment.CenterHorizontally)) { SitePanel(panel, siteUi, padded = false) }
                        }
                    }
                }
                if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); body(Modifier.weight(1f).fillMaxHeight()) }
                else Column(Modifier.fillMaxSize()) { body(Modifier.weight(1f).fillMaxWidth()); nav(false) }
            }
            // index.html's #sheet (scancam's settings, a review's details): the site's sheet, its own head left to SiteSheet.
            if (sheet != null) {
                val head = sheet.find { it.has("sheet-head") }
                val title = head?.find { it.tag == "h2" }?.text().orEmpty()
                val rest = SiteNode(sheet.tag, sheet.id, sheet.attrs, sheet.kids.filter { it !== head }, sheet.value, sheet.icon, sheet.pic)
                SiteSheet(title, null, onClose = { ScanWeb.closeSheet() }) { _ -> SiteSheetBody(rest, siteUi) }
            }
        }
    }
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
        CollectionCardHost(c, onClose = { cards = emptyList() }, onOpen = { cards = cards + it }, web = web, onBack = { cards = cards.dropLast(1) })
    } }
}

/**
 * The live camera under the scanner's glass: CameraX's preview fills [modifier], and each frame (at most every 150 ms, scancam's own
 * pace is 160) goes to the site's reader as a JPEG up to 1920 on its long side, turned upright, as the website's 1920×1080 video gives
 * it. The flashlight follows the page's ⚡. Without the camera permission, the page's camera stops with the site's words.
 */
@Composable
private fun ScanCamera(modifier: Modifier) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        granted = ok
        if (!ok) { CollectionWrites.show("Camera access is off. Allow it in Settings, or use Photo instead.")
            ScanWeb.model.value?.page?.find { it["data-act"] == "scanStop" }?.let { ScanWeb.tap(it.id) } }
    }
    LaunchedEffect(Unit) { if (!granted) ask.launch(Manifest.permission.CAMERA) }
    if (!granted) { Box(modifier.background(androidx.compose.ui.graphics.Color.Black)); return }
    BoxWithConstraints(modifier) {
        LaunchedEffect(maxWidth, maxHeight) { ScanWeb.preview(maxWidth.value.toInt(), maxHeight.value.toInt()) }
        val view = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER; implementationMode = PreviewView.ImplementationMode.COMPATIBLE } }
        AndroidView({ view }, Modifier.fillMaxSize())
        DisposableEffect(owner) {
            val exec = Executors.newSingleThreadExecutor()
            var camera: Camera? = null
            val future = ProcessCameraProvider.getInstance(context)
            var provider: ProcessCameraProvider? = null
            future.addListener({
                val p = runCatching { future.get() }.getOrNull() ?: return@addListener
                provider = p
                val size = ResolutionSelector.Builder().setResolutionStrategy(ResolutionStrategy(android.util.Size(1920, 1080), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER)).build()
                val preview = Preview.Builder().setResolutionSelector(size).build().also { it.surfaceProvider = view.surfaceProvider }
                val analysis = ImageAnalysis.Builder().setResolutionSelector(size).setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888).build()
                var last = 0L
                analysis.setAnalyzer(exec) { img ->
                    try {
                        val now = System.currentTimeMillis()
                        // A frame still on its way to the page: this one is skipped without being made.
                        if (now - last >= 150 && ScanWeb.frame { jpeg(img.toBitmap(), img.imageInfo.rotationDegrees) }) last = now
                    } catch (_: Throwable) {} finally { img.close() }
                }
                runCatching {
                    p.unbindAll()
                    camera = p.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
                    ScanWeb.torch = { on -> camera?.cameraControl?.enableTorch(on) }
                }.onFailure { CollectionWrites.show("The camera couldn’t start. Use Photo instead.") }
            }, ContextCompat.getMainExecutor(context))
            onDispose { ScanWeb.torch = {}; runCatching { camera?.cameraControl?.enableTorch(false) }; provider?.unbindAll(); exec.shutdown() }
        }
    }
}

/** A frame upright, its long side at most 1920, as JPEG (quality 85). */
private fun jpeg(b: Bitmap, rotation: Int): ByteArray {
    val long = maxOf(b.width, b.height); val k = if (long > 1920) 1920f / long else 1f
    val m = Matrix().apply { if (k != 1f) postScale(k, k); if (rotation != 0) postRotate(rotation.toFloat()) }
    val up = if (k == 1f && rotation == 0) b else Bitmap.createBitmap(b, 0, 0, b.width, b.height, m, true)
    return ByteArrayOutputStream().use { o -> up.compress(Bitmap.CompressFormat.JPEG, 85, o); if (up !== b) up.recycle(); b.recycle(); o.toByteArray() }
}
