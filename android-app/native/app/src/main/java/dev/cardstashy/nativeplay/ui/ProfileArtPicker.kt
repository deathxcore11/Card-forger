package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.art.CardArt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URLEncoder
import kotlin.math.roundToInt

/** Opens the picker from anywhere (Settings, the card pop-up's "Use artwork as…"); hosted once at the app root. */
object ArtPick {
    data class Card(val game: String, val id: String, val name: String, val set: String, val image: String, val thumb: String)
    data class Request(val kind: String, val card: Card? = null)
    var request by mutableStateOf<Request?>(null); private set
    fun open(kind: String, card: Card? = null) { request = Request(kind, card) }
    fun close() { request = null }
}

private const val HEADER_ASPECT = 3.6f // the account hub banner on a phone (≈ 360 × 96 dp, plus the fade)

/**
 * How [art] covers a frame of aspect [frame] (width / height): the image's size in frame widths/heights at its zoom,
 * and the centre point kept inside so the frame never shows an edge. frame = 1 is profile-art.js profileCrop exactly.
 */
data class Fit(val w: Float, val h: Float, val x: Float, val y: Float)
fun fitArt(ratio: Double, zoom: Double, x: Double, y: Double, frame: Float): Fit {
    val r = ratio.coerceIn(.2, 5.0).toFloat(); val z = zoom.coerceIn(1.0, 4.0).toFloat()
    val w: Float; val h: Float
    if (r >= frame) { h = z; w = z * r / frame } else { w = z; h = z * frame / r }
    return Fit(w, h, x.toFloat().coerceIn(.5f / w, 1 - .5f / w), y.toFloat().coerceIn(.5f / h, 1 - .5f / h))
}

/** The art drawn into its frame at the saved crop (circle for the avatar, the banner for the header). */
@Composable
fun ArtFrame(art: Account.Art, frame: Float, modifier: Modifier = Modifier, shape: Shape? = null) {
    Box(modifier.then(if (shape != null) Modifier.clip(shape) else Modifier.clip(RoundedCornerShape(0.dp)))) {
        val f = fitArt(art.ratio, art.zoom, art.x, art.y, frame)
        coil3.compose.AsyncImage(art.image, null, imageLoader = CardArt.loader, contentScale = ContentScale.FillBounds,
            modifier = Modifier.layout { m, c ->
                val fw = c.maxWidth; val fh = c.maxHeight
                val iw = (fw * f.w).roundToInt(); val ih = (fh * f.h).roundToInt()
                val p = m.measure(Constraints.fixed(iw.coerceAtLeast(1), ih.coerceAtLeast(1)))
                layout(fw, fh) { p.place((fw * (.5f - f.x * f.w)).roundToInt(), (fh * (.5f - f.y * f.h)).roundToInt()) }
            })
    }
}

private val T = object {
    val Head get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Site.Text)
    val Eyebrow get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.3.sp, color = Site.Muted)
    val Body get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp, color = Site.Text)
    val Small get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 18.sp, color = Site.Muted)
}

private val GAMES = listOf("mtg" to "Magic: The Gathering", "ptcg" to "Pokémon", "ygo" to "Yu-Gi-Oh!")

/** profile-art.js createProfileArtPicker: search any game, pick a card, frame it (drag, pinch, slider), save. */
@Composable
fun ProfileArtPickerHost() {
    val req = ArtPick.request ?: return
    ProfileArtPicker(req.kind, req.card, onClose = { ArtPick.close() })
}

@Composable
fun ProfileArtPicker(kind: String, start: ArtPick.Card? = null, onClose: () -> Unit) {
    BackHandler(onBack = onClose)
    val header = kind == "header"
    val profile = Account.profile.value
    val saved = if (header) profile?.header else profile?.avatar
    var game by remember { mutableStateOf(saved?.game ?: start?.game ?: "mtg") }
    var draft by remember { mutableStateOf<Account.Art?>(start?.let { Account.Art(it.game, it.id, it.name, it.image, 1.0, 1.0, .5, .4) } ?: saved) }
    // Controller: a modal over the screen; B closes it as its ✕ does. LB/RB walk the game row while searching.
    PadScreen(PadActs(b = "Close", tabs = if (draft == null) ({ d: Int -> game = GAMES[(GAMES.indexOfFirst { it.first == game } + d).coerceIn(0, GAMES.size - 1)].first }) else null, opaque = true))
    Box(Modifier.fillMaxSize().background(Color(0xE6000000)).clickable(enabled = false) {}) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding().padding(12.dp)
            .widthIn(max = 640.dp).align(Alignment.Center).clip(RoundedCornerShape(22.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(22.dp)).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("MAKE IT YOURS", style = T.Eyebrow); Text(if (header) "Profile header" else "Profile photo", style = T.Head) }
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(12.dp)).clickable(onClick = onClose),
                    contentAlignment = Alignment.Center) { Icon(SiteIcons.Close, 18.dp, Site.Text) }
            }
            val d = draft
            if (d == null) Search(game, { game = it }) { c -> draft = Account.Art(c.game, c.id, c.name, c.image, 1.0, 1.0, .5, .4) }
            else Crop(d, header, onBack = { draft = null }, onSaved = onClose)
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.ColumnScope.Search(game: String, onGame: (String) -> Unit, onPick: (ArtPick.Card) -> Unit) {
    var q by remember { mutableStateOf("") }
    var rows by remember { mutableStateOf<List<ArtPick.Card>>(emptyList()) }
    var status by remember { mutableStateOf("Search Magic, Pokémon, or Yu-Gi-Oh! without leaving your game.") }
    Text("Your favorite card, your own framing.", style = T.Small)
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(14.dp)).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        GAMES.forEach { (id, label) ->
            val on = id == game; val sh = RoundedCornerShape(11.dp)
            Box(Modifier.weight(1f).height(40.dp).clip(sh).then(if (on) Modifier.background(Site.Surface).border(1.dp, Site.Gold.copy(alpha = .45f), sh) else Modifier).clickable { onGame(id) },
                contentAlignment = Alignment.Center) { Text(label, style = T.Small.copy(fontWeight = FontWeight.Bold, color = if (on) Site.Text else Site.Muted, fontSize = 12.sp), maxLines = 1, overflow = TextOverflow.Ellipsis) }
        }
    }
    androidx.compose.material3.OutlinedTextField(q, { q = it.take(100) }, Modifier.fillMaxWidth(), singleLine = true, textStyle = T.Body, shape = RoundedCornerShape(12.dp),
        placeholder = { Text("Search for a card…", style = T.Body.copy(color = Site.Muted)) },
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(focusedTextColor = Site.Text, unfocusedTextColor = Site.Text, focusedBorderColor = Site.Gold, unfocusedBorderColor = Site.Line,
            focusedContainerColor = Site.Surface2, unfocusedContainerColor = Site.Surface2, cursorColor = Site.Gold))
    // 250 ms after typing stops, like the web's input timer; a newer query or game wins.
    LaunchedEffect(q, game) {
        val query = q.trim()
        if (query.length < 2) { rows = emptyList(); status = if (query.isEmpty()) "Search Magic, Pokémon, or Yu-Gi-Oh! without leaving your game." else "Type at least two letters to find a card."; return@LaunchedEffect }
        delay(250); status = "Finding card art…"
        val found = runCatching { lookup(game, query) }
        rows = found.getOrNull().orEmpty()
        status = when { found.isFailure -> "The card source is unavailable. Try again."; rows.isEmpty() -> "No cards found. Try another name."; else -> "Choose a card to frame your photo." }
    }
    Text(status, style = T.Small)
    LazyColumn(Modifier.weight(1f, fill = false).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        itemsIndexed(rows, key = { i, c -> c.game + c.id + i }) { _, c ->
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Site.Surface2).clickable { onPick(c) }.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                coil3.compose.AsyncImage(c.thumb, null, imageLoader = CardArt.loader, contentScale = ContentScale.Crop, modifier = Modifier.size(56.dp, 42.dp).clip(RoundedCornerShape(6.dp)))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) { Text(c.name, style = T.Body.copy(fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis); Text(c.set, style = T.Small, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            }
        }
    }
}

/** The card search per game: Scryfall (art crop), TCGdex, YGOPRODeck — the same sources the site's lookup uses. */
private suspend fun lookup(game: String, q: String): List<ArtPick.Card> = withContext(Dispatchers.IO) {
    val e = URLEncoder.encode(q, "UTF-8")
    fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString
    when (game) {
        "mtg" -> {
            val o = try { Http.call("GET", "https://api.scryfall.com/cards/search?q=${URLEncoder.encode("$q game:paper", "UTF-8")}&unique=art&order=released") as? JsonObject }
                catch (x: Http.Failure) { if (x.status == 404) null else throw x }
            (o?.getAsJsonArray("data") ?: JsonArray()).mapNotNull { it as? JsonObject }.take(24).mapNotNull { c ->
                val uris = c.getAsJsonObject("image_uris") ?: (c.getAsJsonArray("card_faces")?.firstOrNull() as? JsonObject)?.getAsJsonObject("image_uris")
                val art = uris?.s("art_crop") ?: uris?.s("large") ?: return@mapNotNull null
                ArtPick.Card("mtg", c.s("id") ?: return@mapNotNull null, c.s("name") ?: "", c.s("set_name") ?: "Magic", art, uris?.s("art_crop") ?: art)
            }
        }
        "ptcg" -> (Http.call("GET", "https://api.tcgdex.net/v2/en/cards?name=$e") as? JsonArray ?: JsonArray()).mapNotNull { it as? JsonObject }.filter { it.s("image") != null }.take(24).map { c ->
            ArtPick.Card("ptcg", c.s("id")!!, c.s("name") ?: "", "Pokémon", c.s("image") + "/high.webp", c.s("image") + "/low.webp")
        }
        else -> {
            val o = try { Http.call("GET", "https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=$e") as? JsonObject } catch (x: Http.Failure) { if (x.status == 400) null else throw x }
            (o?.getAsJsonArray("data") ?: JsonArray()).mapNotNull { it as? JsonObject }.take(24).map { c ->
                val id = c.get("id").asString
                ArtPick.Card("ygo", id, c.s("name") ?: "", ((c.getAsJsonArray("card_sets")?.firstOrNull() as? JsonObject)?.s("set_name")) ?: "Yu-Gi-Oh!",
                    "https://images.ygoprodeck.com/images/cards_cropped/$id.jpg", "https://images.ygoprodeck.com/images/cards_cropped/$id.jpg")
            }
        }
    }
}

@Composable
private fun Crop(start: Account.Art, header: Boolean, onBack: () -> Unit, onSaved: () -> Unit) {
    val scope = rememberCoroutineScope()
    val frame = if (header) HEADER_ASPECT else 1f
    var art by remember(start) { mutableStateOf(start) }
    var ready by remember(start) { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var status by remember(start) { mutableStateOf("Loading artwork…") }
    fun set(zoom: Double = art.zoom, x: Double = art.x, y: Double = art.y) {
        val f = fitArt(art.ratio, zoom, x, y, frame); art = art.copy(zoom = zoom.coerceIn(1.0, 4.0), x = f.x.toDouble(), y = f.y.toDouble())
    }
    fun save() {
        saving = true; status = if (header) "Saving header…" else "Saving photo…"
        scope.launch {
            val ok = Account.saveArt(if (header) "header" else "avatar", art)
            saving = false
            if (ok) onSaved() else status = if (header) "Couldn’t save your header. Try again." else "Couldn’t save your photo. Try again."
        }
    }
    // Controller: X = the Save button, while it can save.
    PadScreen(remember(ready, saving, header) { PadActs(x = if (ready && !saving) PadAct(if (header) "Save header" else "Save photo") { save() } else null) })
    Text("← Choose another card", style = T.Body.copy(color = Site.Gold, fontWeight = FontWeight.Bold), modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(enabled = !saving, onClick = onBack).padding(vertical = 4.dp))
    Text(art.name, style = T.Head.copy(fontSize = 17.sp))
    Text(if (header) "Drag the artwork inside the frame. Pinch or use the slider to zoom. Your avatar stays as it is."
        else "Drag the artwork inside the circle. Pinch or use the slider to zoom.", style = T.Small)
    // The stage: the frame you drag and pinch in. Its natural size sets the ratio once the art loads.
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val w = if (header) maxWidth else minOf(maxWidth, 280.dp)
        val shape: Shape = if (header) RoundedCornerShape(14.dp) else CircleShape
        Box(Modifier.width(w).aspectRatio(frame).clip(shape).background(Site.Surface2).border(2.dp, Site.Gold.copy(alpha = .6f), shape)
            .pointerInput(ready, saving) {
                if (!ready || saving) return@pointerInput
                detectTransformGestures { _, pan, zoom, _ ->
                    val f = fitArt(art.ratio, art.zoom, art.x, art.y, frame)
                    val z = (art.zoom * zoom).coerceIn(1.0, 4.0)
                    set(z, art.x - pan.x / (size.width * f.w), art.y - pan.y / (size.height * f.h))
                }
            }) {
            ArtFrame(art, frame, Modifier.fillMaxSize())
            // Hidden loader: its natural size gives the artwork ratio (img.onload in the web).
            coil3.compose.AsyncImage(art.image, null, imageLoader = CardArt.loader, modifier = Modifier.size(1.dp), alpha = 0f,
                onSuccess = { s -> val sz = s.painter.intrinsicSize; if (sz.width > 0 && sz.height > 0) { art = Account.Art.crop(art.copy(ratio = (sz.width / sz.height).toDouble())).let { a -> val f = fitArt(a.ratio, a.zoom, a.x, a.y, frame); a.copy(x = f.x.toDouble(), y = f.y.toDouble()) }; ready = true; status = "" } },
                onError = { ready = false; status = "This artwork could not load. Choose another card or try again." })
        }
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Zoom", style = T.Body.copy(fontWeight = FontWeight.SemiBold)); Spacer(Modifier.width(12.dp))
        Slider(art.zoom.toFloat(), { set(zoom = it.toDouble()) }, Modifier.weight(1f), valueRange = 1f..4f, enabled = ready && !saving,
            colors = SliderDefaults.colors(thumbColor = Site.Gold, activeTrackColor = Site.Gold, inactiveTrackColor = Site.Line))
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (!header) { Box(Modifier.size(44.dp).clip(CircleShape).border(1.5.dp, Site.Gold.copy(alpha = .7f), CircleShape)) { if (ready) ArtFrame(art, 1f, Modifier.fillMaxSize(), CircleShape) }
            Spacer(Modifier.width(10.dp)); Text("Your profile preview", style = T.Small, modifier = Modifier.weight(1f)) } else Spacer(Modifier.weight(1f))
        SiteButton(if (saving) "Saving…" else if (header) "Save header" else "Save photo", enabled = ready && !saving) { save() }
    }
    if (status.isNotEmpty()) Text(status, style = T.Small)
}
