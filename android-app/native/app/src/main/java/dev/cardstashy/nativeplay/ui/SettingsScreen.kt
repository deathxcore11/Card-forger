package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.text.withStyle

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.collection.WorkspaceSync
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.art.CardArt
import kotlinx.coroutines.launch


/*
 * Settings, ported from the site (views.js settings(), accountPanel, signedOutAccount; settings-theme.js; app-info.js infoPanel;
 * profile-art.js profileAvatar / profilePhotoControl) and laid out in the Console look (ConsoleSettings.kt).
 * Native differences (deviation list): Data (gap audit S1) leaves out Reset data and demo collection, Keep offline data and the
 * install card (app updates live in Help); Google and the email link return through the verified link (gap audit S3).
 */

private val Bad get() = if (AppSettings.theme == "light") Color(0xFF922A24) else Color(0xFFF08A7E)       // --bad
private val Faint get() = Site.Faint     // --faint
private val Good get() = if (AppSettings.theme == "light") Color(0xFF125334) else Color(0xFF6FD29A)     // --good (settings-theme.css light)
private val Ok get() = if (AppSettings.theme == "light") Color(0xFF125334) else Color(0xFF7BD88F)

private object S {
    val H1 get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp, color = Site.Text, letterSpacing = (-.02).sp)
    val H2 get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 24.sp, color = Site.Text)
    val Eyebrow get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.3.sp, color = Site.Muted)
    val Body get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp, color = Site.Text)
    val Small get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 18.sp, color = Site.Muted)
    val Foot get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 17.sp, color = Faint)
    val Btn get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Site.Text)
}

/*
 * The Settings screen in the Console look (Randall's pick of 14 Nov 2026; ConsoleSettings.kt draws it). Six sections, each about
 * one thing: Gameplay, Sound, Display, Account, Data, Help. Every setting the old four tabs (Account, Look, Backup, Help) had is
 * here once, as one line. New: Music volume and Effects volume.
 */
internal val SETTINGS_TABS = listOf(ConsoleTab("Gameplay", SiteIcons.Sword), ConsoleTab("Sound", SiteIcons.Sound), ConsoleTab("Display", SiteIcons.Appearance),
    ConsoleTab("Account", SiteIcons.Profile), ConsoleTab("Data", SiteIcons.Backup), ConsoleTab("Help", SiteIcons.Help))

/** The section a caller asks for by its old or its new name. The profile orb and every "Sign in" land on Account. */
internal fun settingsTab(start: String): Int = when (start) { "game", "gameplay" -> 0; "sound" -> 1; "app", "display" -> 2; "recovery", "backup", "data" -> 4; "info", "help" -> 5; else -> 3 }

@Composable
fun SettingsScreen(onBack: () -> Unit, onWeb: (String) -> Unit, startTab: String = "account", onChallenge: ((com.google.gson.JsonObject) -> Unit)? = null,
                   onDeck: ((game: String, id: String) -> Unit)? = null, startLine: String? = null) {
    BackHandler(onBack = onBack)
    var tab by rememberSaveable { mutableStateOf(settingsTab(startTab)) }
    // The line the panel explains; [startLine] is the one a caller opens Settings on.
    var focus by rememberSaveable { mutableStateOf(startLine) }
    var page by rememberSaveable { mutableStateOf<String?>(null) }
    val community = remember { CommunityLayerState() }
    val toTab: (Int) -> Unit = { i -> val n = i.coerceIn(0, SETTINGS_TABS.lastIndex); if (n != tab) { tab = n; page = null; focus = null } }
    // Controller: LB/RB step the sections; a full-screen layer, so nothing under it lends buttons.
    PadScreen(remember { PadActs(tabs = { d -> toTab(tab + d) }, tabsLabel = "Section", opaque = true) })
    val open: (String?) -> Unit = { page = it }
    val section = when (tab) {
        0 -> ConsoleSection(gameplayItems())
        1 -> soundSection(page, open)
        2 -> displaySection()
        3 -> accountSection(page, open, onWeb, community)
        4 -> dataSection(page, open)
        else -> helpSection(page, open, onWeb)
    }
    ConsoleScreen("Settings", SETTINGS_TABS, tab, toTab, onBack, section, { page = null }, focus, { focus = it }) {
        // The community pop-up and what it opens (a friend's shared binder or deck, a card's page), over the whole screen.
        CommunityLayer(community, onHeader = { ArtPick.open("header") }, onChallenge = onChallenge, web = { url, _ -> onWeb(url) }, onDeck = onDeck)
    }
}

// ---------------------------------------------------------------- Gameplay, Sound, Display: the lines

private fun line(id: String, title: String, about: String, ctl: ConsoleCtl, default: String? = null, pic: ConsolePic = ConsolePic.ICON, danger: Boolean = false,
                 status: Pair<String, ConsoleTone>? = null, picOn: Boolean? = null, picLevel: Int? = null) =
    ConsoleItem.Line(ConsoleRow(id, title, about, ctl, default, pic, danger, status, picOn, picLevel))
private fun switch(key: String, on: Boolean) = ConsoleCtl.Switch(on) { AppSettings.set(key, it) }

/** Mobile table M3 and M4, and the table's two effect levels (Story playmat MOTION-SPEC; the living table F1 to F10). */
internal fun gameplayItems(): List<ConsoleItem> = listOf(
    ConsoleItem.Head("Your turn"),
    line("stop", "Stop to respond", "Off: your own spell or trigger on top of the stack resolves by itself. On: the table waits whenever you could play something in response.",
        switch("stopToRespond", AppSettings.stopToRespond), "Off"),
    line("order", "Ask me to order triggers", "On: when several of your triggers happen together, you choose their order. Off: they are put in order for you.",
        switch("askTriggerOrder", AppSettings.askTriggerOrder), "Off"),
    ConsoleItem.Head("The table"),
    line("tfx", "Table effects", when (AppSettings.effects) {
        "cinematic" -> "Every light, mote, leaf and flyer on Story mats, plus boss moments."
        "minimal" -> "A still painted mat with a soft glow. Lightest on battery."
        else -> "Light rays, glints and glows, with fewer leaves. Follows Reduce motion and battery saver."
    }, ConsoleCtl.Choice(AppSettings.EFFECTS, AppSettings.effects) { AppSettings.applyEffects(it) }, "Balanced", ConsolePic.GLOW),
    line("mfx", "Match effects", when (AppSettings.matchEffects) {
        "off" -> "In a match: the table as it was, with no turn light, mana light, weight or map feel."
        "reduced" -> "In a match: light and marks stay. No shake, no freeze frames, no clock stop."
        else -> "In a match: the table's light, the weight of big creatures and the hits, in the map's own style."
    }, ConsoleCtl.Choice(TableFeel.MODES, AppSettings.matchEffects) { AppSettings.applyMatchEffects(it) }, "Full", ConsolePic.GLOW))

/** Sound and vibration. [onCredits] opens the stage music's credits. */
internal fun soundItems(onCredits: () -> Unit): List<ConsoleItem> = listOf(
    ConsoleItem.Head("Sound"),
    line("sound", "Sound and music", "Match music and table sounds, on or off. Music plays only in matches and Planeswalk. It streams the first time, then stays on this device.",
        switch("packSound", AppSettings.sound), "On", ConsolePic.VOLUME),
    line("music", "Music volume", "How loud the stage music plays in a match.",
        ConsoleCtl.Level(AppSettings.musicVolume, AppSettings.sound) { AppSettings.applyMusicVolume(it) }, "100%", ConsolePic.VOLUME, picOn = AppSettings.sound),
    line("sfx", "Effects volume", "How loud cards, hits, the clock and the app's soft sounds are.",
        ConsoleCtl.Level(AppSettings.effectsVolume, AppSettings.sound || AppSettings.appSounds) { AppSettings.applyEffectsVolume(it) }, "100%", ConsolePic.VOLUME, picOn = AppSettings.sound || AppSettings.appSounds),
    line("soft", "Soft sounds in the app", "Outside matches you hear only a few soft sounds, like opening a pack or adding a card. Sound starts after your first tap.",
        switch("appSounds", AppSettings.appSounds), "On", ConsolePic.VOLUME),
    ConsoleItem.Head("Vibration"),
    line("mvib", "Match vibration", "In a match: landings, hits, the winning hit and the clock stop. Off while Match effects is Reduced.",
        switch("matchVibration", AppSettings.matchVibration), "On", ConsolePic.BUZZ),
    line("tvib", "Tap vibration", "A light tick when you press buttons and cards, and when a setting changes.", switch("haptics", AppSettings.haptics), "On", ConsolePic.BUZZ),
    ConsoleItem.Head("Credits"),
    line("credits", "Stage music credits", "The instrument libraries the stage music is rendered with.", ConsoleCtl.Go(run = onCredits)))

private fun soundSection(page: String?, open: (String?) -> Unit) = ConsoleSection(soundItems { open("credits") },
    if (page == "credits") ConsolePage("credits", "Stage music credits") { Text(STAGE_MUSIC_CREDIT, style = S.Small.copy(color = Site.Text)) } else null)

/**
 * The look: colour mode (settings-theme.js), card grids (grid-settings.js), card feel, glass, and the second screen.
 * [touch]: no pinch line where there is no touch screen; [pad]: with a controller the pinch is named by its effect (fix list E1).
 */
internal fun displayItems(touch: Boolean, pad: Boolean): List<ConsoleItem> = buildList {
    add(ConsoleItem.Head("Theme"))
    add(line("theme", "Color mode", "Light, Dark or Aura (soft color from the art you explore), for all three games on this device. Play is always dark.",
        ConsoleCtl.Choice(listOf("light", "dark", "aura"), AppSettings.chosenTheme) { AppSettings.applyTheme(it) }, "Dark", ConsolePic.THEME))
    add(ConsoleItem.Head("Cards"))
    add(line("size", "Card size", "How big cards are in the card galleries of all three games. List views keep their layout.",
        ConsoleCtl.Choice(AppSettings.GRID_SIZES, AppSettings.gridSize) { AppSettings.applyGridSize(it) }, "Medium", ConsolePic.GRID))
    if (touch) add(line("pinch", if (pad) "Resize card grids with two fingers" else "Pinch to resize card grids", "Spread two fingers for larger cards; pinch for smaller cards. Only card grids use this gesture.",
        ConsoleCtl.Switch(AppSettings.gridPinch) { AppSettings.applyGridPinch(it) }, "Off", ConsolePic.GRID))
    add(line("foil", "Card lighting and foil", "Soft light follows your tilt in card details. Foil cards shimmer in the gallery.", switch("finishEffects", AppSettings.finish), "On", ConsolePic.FOIL))
    add(line("depth", "3D cards", "The art sits a little deeper than the frame and shifts as you tilt. Off: the flat card, with its foil as before.", switch("depthCards", AppSettings.depth), "On", ConsolePic.DEPTH))
    add(line("tilt", "Phone tilt in card views", "Move your phone to move the card and its light. Off: touch only. Follows Reduce motion.", switch("motionTilt", AppSettings.tilt), "On", ConsolePic.DEPTH))
    add(ConsoleItem.Head("Screen"))
    add(line("glass", "Frosted glass", "Frosted panels over the art. Off: plain solid panels, a little lighter on older phones.", switch("glass", AppSettings.glass), "On"))
    // Dual screen (Randall 8 Nov): on a handheld with a second built-in screen the bottom shows the hand, the stack, the card the ring is on.
    val second = DualScreen.detected
    add(line("dual", "Dual screen", if (second != null) "Second screen found: ${second.name.ifBlank { "built-in" }}, ${second.width}×${second.height} at ${second.hz.toInt()} Hz. Off keeps everything on one screen."
        else "No second screen found on this device. On a two-screen handheld the bottom screen shows your hand, the stack and the card the ring is on.",
        ConsoleCtl.Switch(DualScreen.active || (second == null && DualScreen.choice == true)) { DualScreen.set(it) }))
}

@Composable
private fun displaySection(): ConsoleSection {
    val touch = LocalContext.current.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TOUCHSCREEN)
    val pad by Pad.connected.collectAsState()
    return ConsoleSection(displayItems(touch, pad))
}

// ---------------------------------------------------------------- shared pieces (the site's .panel, .btn, .field, .check)

@Composable
private fun Panel(modifier: Modifier = Modifier, padding: Dp = 18.dp, content: @Composable ColumnScope.() -> Unit) =
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(18.dp)).padding(padding),
        verticalArrangement = Arrangement.spacedBy(10.dp), content = content)

@Composable
private fun CardHeading(eyebrow: String, title: String) = Column { Text(eyebrow, style = S.Eyebrow); Text(title, style = S.H2) }

@Composable
fun SiteButton(label: String, modifier: Modifier = Modifier, ghost: Boolean = false, danger: Boolean = false, small: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val sh = RoundedCornerShape(12.dp)
    Box(modifier.heightIn(min = if (small) 40.dp else 46.dp).clip(sh)
        .background(if (ghost) Brush.verticalGradient(listOf(Site.Surface2, Site.Surface2)) else goldButtonBrush(enabled))
        .then(if (ghost) Modifier.border(1.dp, if (danger) Bad.copy(alpha = .5f) else Site.Line, sh) else Modifier)
        .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        Text(label, style = S.Btn.copy(fontSize = if (small) 13.sp else 14.sp, color = when { danger -> Bad; ghost -> Site.Text; else -> Site.GoldInk }))
    }
}

@Composable
private fun LinkText(label: String, small: Boolean = false, color: Color = Site.Gold, onClick: () -> Unit) =
    Text(label, style = S.Btn.copy(fontSize = if (small) 13.sp else 14.sp, color = color), modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(vertical = 6.dp))

@Composable
private fun Field(label: String, value: String, onValue: (String) -> Unit, placeholder: String = "", hint: String? = null, password: Boolean = false,
                  keyboard: KeyboardType = KeyboardType.Text, ime: ImeAction = ImeAction.Next, onGo: () -> Unit = {}, lines: Int = 1) {
    var shown by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (label.isNotEmpty()) Text(androidx.compose.ui.text.buildAnnotatedString {
            append(label); hint?.let { pushStyle(S.Foot.toSpanStyle()); append("  $it"); pop() } }, style = S.Body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
        OutlinedTextField(value, onValue, Modifier.fillMaxWidth(), singleLine = lines == 1, minLines = lines,
            placeholder = { Text(placeholder, style = S.Body.copy(color = Faint)) }, textStyle = S.Body,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Site.Text, unfocusedTextColor = Site.Text, focusedBorderColor = Site.Gold, unfocusedBorderColor = Site.Line,
                focusedContainerColor = Site.Surface2, unfocusedContainerColor = Site.Surface2, cursorColor = Site.Gold),
            visualTransformation = if (password && !shown) PasswordVisualTransformation() else VisualTransformation.None,
            trailingIcon = if (password) ({ Text(if (shown) "Hide" else "Show", style = S.Btn.copy(fontSize = 12.sp, color = Site.Muted), modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { shown = !shown }.padding(8.dp)) }) else null,
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = ime), keyboardActions = KeyboardActions(onGo = { onGo() }, onDone = { onGo() }))
    }
}

/** auth-form.js passwordRules: each rule turns gold as it is met. */
@Composable
private fun PasswordRules(p: String) = Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
    Account.passwordRules.forEach { (label, ok) ->
        val met = ok(p)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(if (met) Site.Gold else Site.Line))
            Spacer(Modifier.width(8.dp)); Text(label, style = S.Small.copy(color = if (met) Site.Gold else Site.Muted))
        }
    }
}

@Composable
private fun Disclosure(summary: String, danger: Boolean = false, bold: Boolean = false, force: Int = 0, content: @Composable ColumnScope.() -> Unit) {
    var open by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(force) { if (force > 0) open = true }
    Column(Modifier.fillMaxWidth().animateContentSize()) {
        Row(Modifier.clip(RoundedCornerShape(10.dp)).clickable { open = !open }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (open) "▾" else "▸", style = S.Small.copy(color = if (danger) Bad else Site.Text)); Spacer(Modifier.width(6.dp))
            Text(summary, style = S.Small.copy(color = if (danger) Bad else Site.Text, fontWeight = if (bold) FontWeight.Bold else FontWeight.Medium))
        }
        if (open) Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun Notice(text: String, tone: Color) =
    Text(text, style = S.Small.copy(color = tone), modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(tone.copy(alpha = .1f)).border(1.dp, tone.copy(alpha = .35f), RoundedCornerShape(12.dp)).padding(12.dp))

// ---------------------------------------------------------------- avatar (profile-art.js profileAvatar)

/** profileAvatar: the initial (or person mark), covered by the card art in its saved circle crop, else the photo. */
@Composable
fun ProfileAvatar(profile: Account.Profile?, size: Dp, ring: Boolean = true) {
    val initial = (profile?.username ?: profile?.name)?.trim()?.firstOrNull()?.uppercase()
    Box(Modifier.size(size).clip(CircleShape).background(Brush.radialGradient(listOf(Color(0xFF2B2F38), Color(0xFF171A20))))
        .then(if (ring) Modifier.border(1.5.dp, Site.Gold.copy(alpha = .7f), CircleShape) else Modifier), contentAlignment = Alignment.Center) {
        if (initial != null) Text(initial, style = S.H1.copy(fontSize = (size.value * .42f).sp, color = Site.Text)) else Icon(SiteIcons.Profile, size * .55f, Site.Muted)
        val art = profile?.avatar
        if (art != null) ArtFrame(art, 1f, Modifier.fillMaxSize(), CircleShape)
        else if (!profile?.avatarUrl.isNullOrBlank()) coil3.compose.AsyncImage(profile?.avatarUrl, null, imageLoader = CardArt.loader, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
    }
}


// ---------------------------------------------------------------- Account

/** Console Settings: who you are, in one strip over the Account lines. */
@Composable
private fun ProfileStrip(profile: Account.Profile?, email: String?, onView: () -> Unit) =
    Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 12.dp, top = 14.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        ProfileAvatar(profile, 54.dp)
        Column(Modifier.weight(1f)) {
            Text(profile?.username ?: profile?.name ?: "Collector", style = S.H2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!email.isNullOrBlank()) Text(email, style = S.Foot.copy(color = Site.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("Visible to friends only", style = S.Foot.copy(color = Site.Muted))
        }
        LinkText("View profile", small = true, onClick = onView)
    }

/**
 * views.js accountPanel as lines. Signed out: the account card (Log in / Create account) with the notification line under it.
 * Signed in: sync, friends and privacy, notifications, then profile and sign-in. Edit profile and Delete account are pages.
 */
@Composable
internal fun accountSection(page: String?, open: (String?) -> Unit, onWeb: (String) -> Unit, layer: CommunityLayerState): ConsoleSection {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val session by Account.session.collectAsState()
    // Gap audit H2 step 4: the daily price check (collection/PriceAlertDaily.kt), new beyond the website.
    val price = line("price", "Price alert notifications", "Once a day on Wi-Fi the app checks the cards you set a price alert on and notifies you when one crosses your price, even when the app is closed.",
        ConsoleCtl.Switch(AppSettings.priceAlertDaily) { on ->
            AppSettings.set("priceAlertDaily", on)
            scope.launch { dev.cardstashy.nativeplay.collection.PriceAlertDaily.sync(context, if (on) CollectionEngine.alertList().size() else 0) }
        }, "On")
    if (session == null) return ConsoleSection(listOf(
        ConsoleItem.Block("sign-in") { Box(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp).widthIn(max = 560.dp)) { SignedOut() } },
        ConsoleItem.Head("Notifications"), price), form = true)
    return signedInSection(page, open, onWeb, layer, price)
}

@Composable
private fun signedInSection(page: String?, open: (String?) -> Unit, onWeb: (String) -> Unit, layer: CommunityLayerState, price: ConsoleItem): ConsoleSection {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val session by Account.session.collectAsState()
    val profile by Account.profile.collectAsState()
    androidx.compose.runtime.LaunchedEffect(session?.userId) { Account.refreshProfile() }
    var confirmOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf<String?>(null) }
    fun toast(m: String) = Toast.makeText(context, m, Toast.LENGTH_LONG).show()
    // The community pop-up (community-profile.js): Friends, View profile and Blocked accounts open it here, natively.
    var community by layer::view
    val circle by Community.data.collectAsState()
    androidx.compose.runtime.LaunchedEffect(session?.userId) { Community.refresh() }
    // Edit profile pressed in the pop-up: its page opens here (app.js editProfile).
    val editAsked = layer.editProfile
    androidx.compose.runtime.LaunchedEffect(editAsked) { if (editAsked > 0) open("edit") }
    val sync by WorkspaceSync.status.collectAsState()
    val pend by WorkspaceSync.pending.collectAsState()
    val requests = Community.incoming(circle); val friends = circle?.let { Community.friends(it) }

    val items = buildList {
        add(ConsoleItem.Block("profile") { ProfileStrip(profile, session?.email) { community = CommunityView.Mine } })
        add(ConsoleItem.Head("Sync"))
        // accountPanel: "Choose which copy to keep" while the sync waits on the player, otherwise the sync line; an error's words.
        val paused = if (sync.state == WorkspaceSync.State.ERROR && sync.msg.isNotBlank()) ("${sync.msg} Your cards are still saved on this device." to ConsoleTone.BAD) else null
        if (pend != null) add(line("decide", "Choose which copy to keep", "This device and your account hold different copies. Sync is paused until you choose which one to keep.",
            ConsoleCtl.Go(value = "Needs you", tone = ConsoleTone.BAD, verb = "Choose") { CollectionWrites.deciding.value = true }, status = paused))
        else {
            val (label, tone) = when (sync.state) {
                WorkspaceSync.State.SYNCED -> "Synced" to ConsoleTone.GOOD; WorkspaceSync.State.SYNCING, WorkspaceSync.State.WAITING -> "Syncing…" to ConsoleTone.PLAIN
                WorkspaceSync.State.ERROR -> "Paused" to ConsoleTone.BAD; WorkspaceSync.State.DECIDE -> "Needs you" to ConsoleTone.BAD
                WorkspaceSync.State.OFFLINE -> "Offline" to ConsoleTone.PLAIN; WorkspaceSync.State.LOCAL -> "Not confirmed" to ConsoleTone.WARN
            }
            val now = when (sync.state) {
                WorkspaceSync.State.SYNCED -> sync.at?.let { " Last synced ${siteWhen(it)}." }.orEmpty()
                WorkspaceSync.State.OFFLINE -> " Offline: it will sync when you’re back online."
                WorkspaceSync.State.LOCAL -> " Account sync is not confirmed yet."
                else -> ""
            }
            add(line("sync", "Account sync", "Your collection and decks are private. Saved here first, then synced to your account.$now",
                ConsoleCtl.Go(value = label, tone = tone, verb = "Sync now") { scope.launch { WorkspaceSync.syncNow(context) } }, status = paused))
        }
        add(ConsoleItem.Head("Friends and privacy"))
        // views.js account-hub-friends: the count, and the requests that wait.
        add(line("friends", "Friends", "Add friends by username or email, and answer requests." + if (requests > 0) " $requests request${if (requests == 1) "" else "s"} waiting." else "",
            ConsoleCtl.Go(value = listOfNotNull(friends?.let { "$it friend${if (it == 1) "" else "s"}" }, if (requests > 0) "$requests waiting" else null).joinToString(" · ").ifBlank { null },
                tone = if (requests > 0) ConsoleTone.WARN else ConsoleTone.PLAIN) { community = CommunityView.Panel("friends") }))
        // views.js setPresence; C.setPresence's toasts.
        add(line("presence", "Show friends what I’m playing", "Accepted friends see your Play screen or match, like “Quick Play · Pauper · turn 7”.",
            ConsoleCtl.Switch(AppSettings.presence) { on ->
                AppSettings.set("presence", on); scope.launch { dev.cardstashy.nativeplay.play.Presence.setShare(on) }
                Toast.makeText(context, if (on) "Friends can see what you’re playing." else "Friends no longer see what you’re playing.", Toast.LENGTH_SHORT).show()
            }, "On"))
        add(line("blocks", "Blocked accounts", "The people you have blocked.", ConsoleCtl.Go { community = CommunityView.Panel("blocks") }))
        add(ConsoleItem.Head("Notifications")); add(price)
        add(ConsoleItem.Head("Profile and sign-in"))
        add(line("edit", "Edit profile", "Change your picture, header, username and bio.", ConsoleCtl.Go { open("edit") }))
        add(line("reset", "Reset password", "Sends a password-reset link to ${session?.email ?: "your email"}.",
            ConsoleCtl.Go(value = if (busy == "reset") "Sending…" else null, verb = "Send") {
                if (busy == null) { busy = "reset"; scope.launch { val e = Account.sendReset(session?.email ?: ""); busy = null; toast(e ?: "Check your email for a password-reset link.") } }
            }))
        add(line("signout", "Sign out", "Signing out hides this account’s cards and profile on this device. They are here when you sign back in.", ConsoleCtl.Go(verb = "Sign out") { confirmOut = true }))
        add(line("delete", "Delete account", "Permanently deletes your CardStashy account and the collection, decks and profile synced to it. You type DELETE to confirm.",
            ConsoleCtl.Go { open("delete") }, danger = true))
    }
    val opened = when (page) {
        "edit" -> ConsolePage("edit", "Edit profile") { EditProfile(profile) { ArtPick.open(it) } }
        "delete" -> ConsolePage("delete", "Delete account") {
            Text("Permanently deletes your CardStashy account and the collection, decks and profile synced to it.", style = S.Body)
            LinkText("How account deletion works", small = true) { onWeb("https://cardstashy.com/delete-account.html") }
            SiteButton(if (busy == "delete") "Deleting…" else "Delete my account", ghost = true, danger = true, enabled = busy == null) { confirmDelete = true }
        }
        else -> null
    }
    if (confirmOut) RuleConfirm("Your account’s cards and profile will be hidden. They’ll be here when you sign back in.", "Sign out", title = "Sign out?", onCancel = { confirmOut = false },
        onAction = { confirmOut = false; scope.launch { Account.signOut(); Decks.clear(); dev.cardstashy.nativeplay.play.Progress.clear(); toast("Signed out. Your account data is saved.") } })
    if (confirmDelete) {
        var typed by remember { mutableStateOf("") }
        RuleConfirm("This permanently deletes ${session?.email ?: "your account"} and the collection, decks and profile synced to it. It can't be undone. Type DELETE to confirm.",
            "Delete account", title = "Delete account", danger = true, onCancel = { confirmDelete = false },
            body = { Field("", typed, { typed = it }, ime = ImeAction.Done) },
            onAction = {
                confirmDelete = false
                if (typed.trim() != "DELETE") toast("Account not deleted. Type DELETE in capitals to confirm.")
                else { busy = "delete"; scope.launch { val e = Account.deleteAccount(); busy = null; if (e == null) { Decks.clear(); dev.cardstashy.nativeplay.play.Progress.clear() }; toast(e ?: "Your account and its synced data were deleted.") } }
            })
    }
    return ConsoleSection(items, opened)
}

/** views.js signedOutAccount: tabs Log in / Create account, the reset pane, the privacy line and email help. */
@Composable
fun SignedOut(onSignedIn: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var mode by rememberSaveable { mutableStateOf("login") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf<Pair<String, Boolean>?>(null) } // message, ok
    fun run(block: suspend () -> Unit) { if (busy) return; busy = true; feedback = null; scope.launch { try { block() } finally { busy = false } } }
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BrandMark(40.dp); Spacer(Modifier.width(12.dp)); CardHeading("CARDSTASHY ACCOUNT", "Your account")
        }
        Text("Keep your collection and decks with you across devices.", style = S.Small)
        // Gap audit S3: Continue with Google (shown when the account service has it on, as views.js does), then "or".
        var google by remember { mutableStateOf<Boolean?>(null) }
        androidx.compose.runtime.LaunchedEffect(Unit) { google = Account.googleEnabled() }
        if (google == true && mode != "reset") {
            SiteButton(if (busy) "Opening Google…" else "Continue with Google", Modifier.fillMaxWidth(), ghost = true, enabled = !busy) {
                runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(Account.googleUrl()))) }
                    .onFailure { feedback = "Couldn’t open the browser. Try again." to false }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f).height(1.dp).background(Site.Line)); Text("or", Modifier.padding(horizontal = 10.dp), style = S.Foot); Box(Modifier.weight(1f).height(1.dp).background(Site.Line))
            }
        }
        if (mode != "reset") Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(14.dp)).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf("login" to "Log in", "signup" to "Create account").forEach { (id, label) ->
                val on = mode == id; val sh = RoundedCornerShape(11.dp)
                Box(Modifier.weight(1f).heightIn(min = 42.dp).clip(sh).then(if (on) Modifier.background(Site.Surface).border(1.dp, Site.Gold.copy(alpha = .45f), sh) else Modifier)
                    .clickable { mode = id; feedback = null }, contentAlignment = Alignment.Center) { Text(label, style = S.Btn.copy(fontSize = 13.sp, color = if (on) Site.Text else Site.Muted)) }
            }
        }
        feedback?.let { (m, ok) -> Notice(m, if (ok) Ok else Bad) }
        when (mode) {
            "login" -> {
                fun go() = run {
                    val e = Account.signIn(email, password)
                    if (e != null) feedback = e to false else { password = ""; Decks.clear(); Decks.load(context); dev.cardstashy.nativeplay.play.Progress.clear(); onSignedIn() }
                }
                Field("Email address", email, { email = it }, "you@example.com", keyboard = KeyboardType.Email)
                Field("Password", password, { password = it }, "Your password", password = true, keyboard = KeyboardType.Password, ime = ImeAction.Go, onGo = { go() })
                SiteButton(if (busy) "Logging in…" else "Log in", Modifier.fillMaxWidth(), enabled = !busy) { go() }
                // Gap audit S3: the email link (cloud.js signInEmail), which opens the app signed in.
                SiteButton("Email me a sign-in link instead", Modifier.fillMaxWidth(), ghost = true, enabled = !busy) {
                    if (email.isBlank()) feedback = "Type your email first." to false
                    else run { val e = Account.sendLink(email); feedback = (e ?: "Check your email for the sign-in link. It opens CardStashy signed in.") to (e == null) }
                }
                Text("No password needed with a link.", style = S.Foot)
                LinkText("Forgot password?", small = true) { mode = "reset"; feedback = null }
            }
            "signup" -> {
                fun go() = run {
                    val (e, signedIn) = Account.signUp(email, password, confirm)
                    when { e != null -> feedback = e to false; signedIn -> { password = ""; confirm = ""; Decks.clear(); Decks.load(context); onSignedIn() }
                        else -> { password = ""; confirm = ""; feedback = "Check your email to finish creating your account." to true } }
                }
                Field("Email address", email, { email = it }, "you@example.com", keyboard = KeyboardType.Email)
                Field("Password", password, { password = it }, "Create a password", password = true, keyboard = KeyboardType.Password)
                PasswordRules(password)
                Field("Confirm password", confirm, { confirm = it }, "Enter it again", password = true, keyboard = KeyboardType.Password, ime = ImeAction.Go, onGo = { go() })
                SiteButton(if (busy) "Creating…" else "Create account", Modifier.fillMaxWidth(), enabled = !busy) { go() }
                Text("Check your email to finish creating your account.", style = S.Foot)
                LinkText("Didn’t get the email? Resend confirmation email", small = true) {
                    run { val e = Account.resendConfirm(email); feedback = (e ?: "Confirmation email sent. Check your inbox and spam folder.") to (e == null) }
                }
            }
            else -> {
                Text("Reset your password", style = S.H2)
                Text("Enter your account email to request a reset link.", style = S.Small)
                fun go() = run { val e = Account.sendReset(email); feedback = (e ?: "Check your email for a password-reset link.") to (e == null) }
                Field("Email address", email, { email = it }, "you@example.com", keyboard = KeyboardType.Email, ime = ImeAction.Go, onGo = { go() })
                SiteButton(if (busy) "Sending…" else "Send reset link", Modifier.fillMaxWidth(), enabled = !busy) { go() }
                LinkText("Back to log in", small = true) { mode = "login"; feedback = null }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(SiteIcons.Sync, 14.dp, Site.Muted); Spacer(Modifier.width(8.dp))
            Text("Your collection stays private. Device saving works without an account.", style = S.Foot)
        }
        Disclosure("Help with email links") { Text("Check spam and open the newest link on the device where you requested it. If a link has expired, request a new one.", style = S.Foot) }
    }
}


@Composable
private fun EditProfile(profile: Account.Profile?, onPick: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var user by remember(profile?.username) { mutableStateOf(profile?.username ?: "") }
    var bio by remember(profile?.bio) { mutableStateOf(profile?.bio ?: "") }
    var busy by remember { mutableStateOf(false) }
    // profilePhotoControl(editAvatar): the avatar and "Change profile picture" with the art's name and a brush.
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.clip(CircleShape).clickable { onPick("avatar") }) { ProfileAvatar(profile, 56.dp) }
        Spacer(Modifier.width(12.dp))
        Row(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(14.dp)).clickable { onPick("avatar") }
            .padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Change profile picture", style = S.Btn); Text(profile?.avatar?.name ?: "Choose card art from any game", style = S.Foot.copy(color = Site.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis) }
            Icon(SiteIcons.Paint, 18.dp, Site.Gold)
        }
    }
    SiteButton("Choose profile header", ghost = true, small = true) { onPick("header") }
    Field("Username", user, { user = it }, "letters, numbers, _", hint = "Your displayed player name. Friends can search for it.")
    Field("Bio", bio, { bio = it.take(500) }, lines = 2, ime = ImeAction.Default)
    SiteButton(if (busy) "Saving…" else "Save profile", small = true, enabled = !busy) {
        busy = true; scope.launch { val e = Account.saveProfile(user, bio); busy = false; Toast.makeText(context, e ?: "Profile saved.", Toast.LENGTH_SHORT).show() }
    }
}


// ---------------------------------------------------------------- Data

/**
 * views.js settings' Backup pane ("Backups & offline storage", gap audit S1) as lines: Download backup (app.js A.exportBackup: the
 * site's file in Downloads), Restore backup and Check a backup file (C.restoreBackup, C.checkBackup, through Android's file picker),
 * Earlier saves (renderRecoverySnapshots: this device's Recovery journal; each opens a page with Download and Restore…) and Storage
 * (Remove downloaded pictures, app.js clearCachedImages). Every write goes through the site's handler in the engine
 * (Collection.act restoreBackup / restoreRecovery), with its question first; the copy it replaces joins Earlier saves.
 */
@Composable
internal fun dataSection(page: String?, open: (String?) -> Unit): ConsoleSection {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val user = Account.session.collectAsState().value?.userId
    var exported by remember { mutableStateOf<Pair<String, ConsoleTone>?>(null) }
    var checked by remember { mutableStateOf<Pair<String, ConsoleTone>?>(null) }
    var cleared by remember { mutableStateOf<Pair<String, ConsoleTone>?>(null) }
    var confirmClear by remember { mutableStateOf(false) }
    var stamp by remember { mutableStateOf(0) }
    val written by CollectionWrites.written.collectAsState()
    val saves = remember(user, stamp, written) { mutableStateOf<List<dev.cardstashy.nativeplay.collection.RecoveryJournal.Snapshot>?>(null) }
    var savesSize by remember { mutableStateOf(0L) }
    var savedAt by remember { mutableStateOf<String?>(null) }
    androidx.compose.runtime.LaunchedEffect(user, stamp, written) {
        val u = user ?: return@LaunchedEffect
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            saves.value = runCatching { dev.cardstashy.nativeplay.collection.RecoveryJournal.list(context, u) }.getOrDefault(emptyList())
            savesSize = dev.cardstashy.nativeplay.collection.RecoveryJournal.estimate(context, u)
            savedAt = WorkspaceSync.summarize(Decks.deviceFile(context, u).takeIf { it.isFile }?.readText()).saved
        }
    }
    // The picked file's words, or null with the site's "Backup is larger than 60 MB." (readBackup's file.size check) in [fail].
    suspend fun read(uri: android.net.Uri, fail: (String) -> Unit): String? = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        runCatching {
            context.contentResolver.openInputStream(uri)!!.use { input ->
                val bytes = input.readNBytes(60_000_001)
                if (bytes.size > 60_000_000) { fail("Backup is larger than 60 MB."); null } else String(bytes, Charsets.UTF_8)
            }
        }.getOrElse { fail(it.message ?: "The file could not be read."); null }
    }
    val restorePick = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val text = read(uri) { CollectionWrites.show("Restore failed — nothing changed. $it") } ?: return@launch
            CollectionWrites.act(context, "restoreBackup", com.google.gson.JsonObject().apply { addProperty("text", text) }) { _ ->
                scope.launch { keepCatalog(context); stamp++ }
            }
        }
    }
    val checkPick = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val text = read(uri) { checked = "✕ Not a valid backup: $it" to ConsoleTone.BAD } ?: return@launch
            if (!CollectionReady.ready(context)) return@launch
            checked = CollectionEngine.backupCheck(text).let { it to if (it.startsWith("✓")) ConsoleTone.GOOD else ConsoleTone.BAD }
        }
    }
    val types = arrayOf("application/json", "text/plain", "application/octet-stream")
    val store = dev.cardstashy.nativeplay.art.ThumbStore
    val running by store.progress.collectAsState()
    val used = remember(stamp, running) { store.bytes() + dev.cardstashy.nativeplay.art.ArtKeep.bytes() }
    val sets = remember(stamp, running) { store.setsSaved() }
    val list = saves.value

    val items = buildList {
        add(ConsoleItem.Head("Backup"))
        // The app keeps cards only in an account (CollectionWrites), so signed out there is nothing on this device to back up yet.
        if (user == null) add(ConsoleItem.Block("signed-out") { ConsoleNote("Sign in to save cards to your collection.") })
        else {
            add(line("export", "Download backup", "Your collection, decks and settings for all three games, in one file. Last saved on this device: ${savedAt?.let { siteWhen(it) } ?: "Not yet"}.",
                ConsoleCtl.Go(verb = "Download") {
                    scope.launch {
                        if (!CollectionReady.ready(context)) return@launch
                        // app.js A.exportBackup: download(...) then the status line and the same words as a toast.
                        val ok = runCatching {
                            val text = CollectionEngine.backupPayload()
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                                CollectionWrites.download(context.applicationContext, "CardStashy_Backup_" + java.time.LocalDate.now(java.time.ZoneOffset.UTC) + ".json", text)
                            }
                        }.isSuccess
                        val message = if (ok) "Backup prepared. Check your downloads to confirm the file was saved." else "Backup could not be prepared. Your saved data is unchanged. Try again."
                        exported = (if (ok) "✓ $message" else message) to if (ok) ConsoleTone.GOOD else ConsoleTone.BAD
                        CollectionWrites.show(message)
                    }
                }, status = exported))
            add(line("restore", "Restore backup", "Replaces your collection, decks and settings with a backup file. You review the changes before you confirm.",
                ConsoleCtl.Go(verb = "Choose file") { restorePick.launch(types) }))
            add(line("check", "Check a backup file", "Looks inside a backup file and says whether it is valid. Nothing is changed.",
                ConsoleCtl.Go(verb = "Choose file") { checkPick.launch(types) }, status = checked))
            add(ConsoleItem.Head("Earlier saves"))
            add(line("saves", "Saved on this device", "Copies kept before loading another account version or restoring a backup. Restoring one also updates your online account. Your current cards are saved first.",
                ConsoleCtl.Go(value = if (list == null) "Loading…" else if (list.isEmpty()) "None yet" else "${list.size} ${if (list.size == 1) "copy" else "copies"} · ~${"%.1f".format(savesSize / 1048576.0)} MB", verb = "Refresh") { stamp++ }))
            if (list != null && list.isEmpty()) add(ConsoleItem.Block("no-saves") { ConsoleNote("No automatic recovery copies yet. Copies saved before sync conflicts and restores will appear here.") })
            list.orEmpty().forEach { item ->
                add(line("save-${item.id}", item.label, "${recoveryFacts(item)}. Saved ${siteWhen(item.createdAt)}. Open it to download it as a file or to restore it.",
                    ConsoleCtl.Go(value = siteWhen(item.createdAt)) { open("save-${item.id}") }))
            }
        }
        add(ConsoleItem.Head("Storage"))
        add(line("art", "Saved card art", "Your decks, collection and wishlist pictures save once, and a set’s grid pictures save the first time you open it, so they show at once, and offline, after that.",
            ConsoleCtl.Info(if (sets == 0 && used < 1048576) "Nothing saved yet" else "${"%,.0f".format(used / 1048576.0)} MB · $sets ${if (sets == 1) "set" else "sets"}")))
        add(line("clear", "Remove downloaded pictures", "Keeps your cards, decks, earlier saves and unfinished scans. Pictures download again when needed and may be unavailable offline until then.",
            ConsoleCtl.Go(verb = "Remove") { confirmClear = true }, status = cleared))
    }
    if (confirmClear) RuleConfirm("Your cards, decks, earlier saves and unfinished scans stay. Pictures download again when needed and may be unavailable offline until then.",
        "Remove", title = "Remove downloaded pictures?", onCancel = { confirmClear = false }, onAction = {
            confirmClear = false
            // app.js A.clearCachedImages' words, with this device's count of saved pictures.
            val n = store.files() + dev.cardstashy.nativeplay.art.ArtKeep.files(); store.clear(); dev.cardstashy.nativeplay.art.ArtKeep.clear(); stamp++
            val words = "Cleared $n cached images. Your saved data and pending scans are unchanged."
            cleared = words to ConsoleTone.GOOD; CollectionWrites.show(words)
        })
    val item = list.orEmpty().firstOrNull { "save-${it.id}" == page }
    val opened = item?.let {
        // renderRecoverySnapshots' row: the label, when it was saved, "N cards · M decks · All games", Download and Restore….
        ConsolePage("save-${it.id}", it.label) {
            Text(siteWhen(it.createdAt), style = S.Foot)
            Text(recoveryFacts(it), style = S.Body)
            Text("Restoring also updates your online account when signed in. Your current cards and decks are saved first.", style = S.Small)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                SiteButton("Download", ghost = true, small = true) { scope.launch {
                    val name = "CardStashy_Recovery_" + it.label.replace(Regex("[^a-z0-9]+", RegexOption.IGNORE_CASE), "_").trim('_').ifEmpty { "deck" } + ".json"
                    val ok = runCatching { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { CollectionWrites.download(context.applicationContext, name, WorkspaceSync.backupEnvelope(it.state)) } }.isSuccess
                    CollectionWrites.show(if (ok) "Backup prepared. Check your downloads to confirm the file was saved." else "Couldn’t save $name.")
                } }
                SiteButton("Restore…", small = true) { scope.launch {
                    CollectionWrites.act(context, "restoreRecovery", com.google.gson.JsonObject().apply { addProperty("text", it.state); addProperty("at", it.createdAt) }) { _ -> stamp++; open(null) }
                } }
            }
        }
    }
    return ConsoleSection(items, opened)
}

/** "N cards · M decks · All games" of an earlier save. */
private fun recoveryFacts(item: dev.cardstashy.nativeplay.collection.RecoveryJournal.Snapshot): String {
    val copies = item.summary.copies.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() }
    return "$copies ${if (item.summary.copies == 1.0) "card" else "cards"} · ${item.summary.decks} ${if (item.summary.decks == 1) "deck" else "decks"} · All games"
}

/** A few plain words between the lines. */
@Composable
private fun ConsoleNote(text: String, foot: Boolean = false) =
    Text(text, Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 4.dp), style = if (foot) S.Foot else S.Small)

// ---------------------------------------------------------------- Help (app-info.js infoPanel + views.js sources/about/legal)

/** This build's notes: short, plain, what a player would notice. */
internal const val NEWEST_NOTES = 5
internal val WHATS_NEW = listOf(
    "Star Trek" to "The match engine is the newest Forge, so Elim Garak, Georgiou, Kai Winn and the other new cards play. A card that asks you to name a card gives you a box to type it.",
    "Match sounds" to "Quieter clock: no sound when a timer starts, only the last 5 seconds tick softly, and the phase tick plays only on your own combat and second main.",
    "Smoother" to "The table always opens within 10 seconds, the Welcome back reward holds still, and Settings has four tabs that fit with the newest notes first.",
    "Triggers" to "When a card triggers it lifts with a ring (gold yours, coral the CPU's), waits on the stack long enough to read, then its result lands on the cards: counters, power and toughness, tokens.",
    "Match table" to "The rope is gone: your time is a ring around the gold button and the prompt buttons, coral with a sound in the last 10 seconds.",
    "Match table" to "No stop for a CPU spell you can't answer. A card you can cast in answer lights up. Your Main 1 is no longer skipped after your own trigger. An optional pay {1} trigger you can't afford is declined for you and says so.",
    "Match table" to "Art for renamed cards and tokens, the whole target prompt on two screens, nothing picked for you in a discard, and the cursor no longer picks things behind a card view.",
    "Controllers" to "On the match table the ring always comes back to your hand: A picks a card up, A again plays or casts it, and its mana pays itself when it can. X presses the gold button, which shows its X.",
    "Match table" to "The table only waits when you have a real move; otherwise it moves on at its normal pace. The turn and discard clocks count down, and a card you look at on the bottom screen no longer stops them.",
    "Match table" to "Seats are You and CPU everywhere, never the engine's names. A cleanup discard starts with nothing picked.",
    "Two screens" to "The card page is Card on the wall: the whole card on top, its tiles below, and tilt moves only the card and its foil. A opens rulings (or flips a two-faced card), Y opens the Art view.",
    "Friends" to "Creating a room works again, and the room shows its invite link with Copy, Share and Leave room.",
    "Play" to "Fixes from the Trunk: the search and filters no longer slide under the clock, flavour text shows emphasis as upright words instead of raw asterisks, card names no longer show through the bottom tabs, and the rarity chips stay on one row. Every Play card tile has Y Inspect, and holding a Collection deck (or Select) opens its menu.",
    "Gallery" to "On two screens, a card page’s Art view is now a gallery: the painting alone on a museum wall on the top screen, framed under one soft light, and its label on the bottom screen with the title, artist, set, year, number and flavour text from the card’s own record.",
    "Controllers" to "No two button hints ever say the same words. In a Story scene A is Next and X is Skip (B skips too); a card you can only look at shows one Inspect, not two; on dual screens the hint bar no longer repeats what a button on the case already says.",
    "Art" to "A deck starts loading its pictures the moment you choose it in the lobby, and the CPU deck the moment it is chosen, on any connection, so the Preparing the table wait is shorter. A token now waits a moment (up to 0.4 s) for its picture before it appears.",
    "Precons" to "Free precon decks show each card in the printing from its own decklist (the deck, the match, the versus screen and the preload), not the newest reprint.",
    "Match feel" to "Damage, burns, deaths and counters now sound on the frame you see them happen, not when the engine reports them, and counters have their own sound. When a spell on the stack resolves, the next one slides forward into its place.",
    "Blocks" to "While you choose blockers, a small chip over your portrait shows how much damage gets through and where your life ends up, red while damage gets through and green when it is all blocked. With trample or double strike in the attack it says \"at least\", never a wrong number.",
    "Match feel" to "Big cards make a big entrance: a rare or mythic hangs above its spot, then drops with gold rings and a small shake. A commander arriving from the command zone the first time takes the whole table: the board dims, it flies to the centre with its name in gold, then slams down into place. The usual arrival stays for everything else.",
    "Match table" to "A tidier board: identical permanents share one pile with a small ×N badge on its corner (lands and tokens from two, other cards from three). A card that differs, tapped, damaged, with counters or in combat, steps out of its pile and stands alone.",
    "Match table" to "The rope: in the last 30 s of your turn or a decision, the clock becomes a gold fuse burning along the middle of the table with the seconds beside it, coral for the last ten. It stands still while the clock is held and fades the moment you act.",
    "Match sounds" to "Each spell now sounds like its colour when it is cast: white, blue, black, red, green, colourless and multicolour each have their own cast sound.",
    "Match feel" to "A CPU spell is now the card itself: it leaves the CPU’s hand, turns face up and lands on the stack, where it stays with its arrow until it resolves (no pop-up box). Every spell on the stack keeps its arrows, and its target wears a red rim (hostile) or green (friendly).",
    "Match feel" to "The CPU now thinks before it acts, like a person: dots by its portrait and a card lifting in its hand, longer for a removal spell than a land. Its actions are no longer cut short when the decision comes back to you. With nothing playable and nothing to attack with, your turn ends by itself instead of stopping on To combat.",
    "Art" to "The matchup screen now waits (with a Preparing the table bar) until both decks’ pictures are in, up to 20 s, instead of opening the table after 3–8 s with art still loading. The versus plates appear once their art is ready.",
    "Match table" to "No card is ever a blank panel: each one looks up the engine’s own printing of it, and a picture that still won’t load shows the card’s frame in its colours with its name, cost, type, rules text and P/T (hand, battlefield, inspector, crests).",
    "Quick Play" to "A Commander CPU no longer gets cEDH tournament lists (it couldn’t play them: mulligans to four, a Workshop and nothing to cast) unless your own deck is Bracket 4 or higher; the ten free Commander precons are always in its pool. Precon cards load their exact printing’s art, and a failed art lookup is asked again.",
    "Controllers" to "One button map everywhere, like a console game: A opens, B goes back, X is the screen’s main action, Y inspects (the card big), Select opens the quick menu on decks, Trunk sets and binders (it was Start), LB/RB tabs. The hint bar never shows the same words twice.",
    "Dual screen" to "A card you open now spreads over both screens as one tall page: the same page as before, its top on the upper screen and the rest carrying on below. Scroll it with a finger on either screen, the right stick or the d-pad; tilt works across the hinge; B goes back. With the ring on a card in Collection, the bottom screen shows a quick look at it (what it is, what you have, its price and set; A opens it, X adds one).",
    "Controllers" to "Select opens the quick menu a long press opens, on whatever the ring is on. In a match on two screens RT jumps between your hand and the field (X still passes). A button a case already shows is no longer repeated in the hint bar.",
    "Dual screen" to "More of the bottom screen follows the ring: Collection’s Sets list (the set’s mark, card count and your progress) and Decks list (the deck’s box, power and what you still need), and precons in Play › Decks and the Shop (how much is in your Trunk and what finishing or buying it takes). A opens each.",
    "Dual screen" to "The Shop’s bottom screen follows the ring onto cards: in a set’s page the card under the ring shows big with how many you have and what crafting it takes (the set’s pack case shows otherwise, so the top no longer repeats it), and a Secret Lair card shows its art, price and what buying it leaves you; X buys it.",
    "Dual screen" to "Collection has no card pop-up on two screens: the bottom screen is the card’s whole page and follows the ring on the top grid (Cards, Search and set pages). LB/RB step through its tabs, and Y puts the card big on the top screen with its foil following the gyro.",
    "Dual screen" to "Pack opening: the card on the top screen is now as tall as the screen, with its name and rarity beside it. With a controller the ring starts on the sealed pack, so A tears it open, and it can no longer press things behind the pack.",
    "Controllers" to "On two-screen handhelds LB and RB in a match now jump the ring between your hand, your board and your opponent’s board, landing on the card you were last on there. D-pad left and right still walk your hand.",
    "Dual screen" to "A card you open from a pack or from your hand in a match now opens on the bottom screen, so the top stays on the game; Back closes it. When a pack is dealt, its cards drop down into the spread one after another. Slide a card up off your bottom-screen hand to cast it.",
    "Dual screen" to "The Story has its own bottom screen: on the road and on an act it shows the act (its line, era, battles won, stars and the boosters it gives), and with the ring on a battle it shows the villain, the prize booster, what they play and what it teaches; A duels. The purse sits in the case\u2019s plaque. Play \u203a Decks shows the deck under the ring as its box (how much is in your Trunk, cards left to stamp, what it leans on, your record), and otherwise your decks on a shelf; X builds a deck and Y rolls a random one.",
    "Dual screen" to "The Shop and pack opening have their own bottom screen too: the pack the ring is on shows your progress in its set, the price, what you\u2019d have left and packs of it waiting (X buys, A opens), and while a pack opens its cards sit in a binder page below, face down until turned; tap a pocket to bring that card up.",
    "Dual screen" to "On two-screen handhelds like the AYN Thor and Retroid Pocket Duo, the app finds the second screen by itself and uses it: your hand and the card you lift in a match (and the stack, with Respond and Resolve, whenever something is on it), the deck you\u2019re given before a Story battle or Quick Play match, the deck list while you build, and the card the ring is on in Collection with its price and Got one. On both Homes the bottom screen is a showcase case that follows the gold ring: in Play your den (level, purse, quests, packs and seals), the next Story battle, a deck\u2019s box or what the Merchant\u2019s pack leaves you; in Collection your collection\u2019s value, or the Card of the Day\u2019s set and today\u2019s pack. Settings \u203a Dual screen turns it off or back on.",
    "Controllers" to "Shoulders and triggers now follow the screen: in a match LB/RB step through your hand, RT passes and LT cancels; Quick Play LB/RB pick the format and X finds a match; Practice LT/RT set the CPU level; in Story LB/RB pick the battle and LT/RT the act.",
    "Controllers" to "The right stick is a smooth scroll wheel now: the page moves at the speed you push, starts at once, and when you let go it eases to a stop and stays put, with no fling and no bounce at the ends. Up and down move the page, sideways moves the shelf you\u2019re on.",
    "Controllers" to "A d-pad that reports as a hat (many handhelds) now lands the ring on the screen on its first press too, and Your packs puts the ring on your first pack, so the d-pad walks the packs at once.",
    "Dual screen" to "Your hand on the bottom screen fills its width and is as big as the screen allows, easing to a new size as cards come and go. On the table, the d-pad lands on the hand chip: left and right walk the hand, A plays the lifted card (or opens it), Y opens it. Play Home\u2019s den no longer repeats the act\u2019s picture from the top screen; Quests and Achievements are one button, and the gold button picks up what you were doing (your packs, your act, or Quick Play).",
    "Dual screen" to "In a match the bottom screen no longer repeats the life totals or the gold button; they stay on the table up top, and the bottom keeps your hand and the card you lift (the stack still brings Respond and Resolve when something is on it).",
    "Dual screen" to "Achievements on two screens: the bottom shows the deed under the ring with every step, what each gives and how far you are (A claims a ready one), otherwise the Hall of Deeds with the purse and the three deeds you\u2019re closest to. Every deed card now takes the ring, so the d-pad walks them all.",
    "Dual screen" to "Opening a pack on two screens: the top is all big card, and the whole pack lies in one spread across the bottom, face down until turned, the card on top lifted and ringed. Tap a card or drag sideways to sift; X reveals all, then opens the next. The Trunk\u2019s bottom screen shows the card under the ring (its rules text, copies, holo copies, the sets you own it in and what seals would buy), otherwise your binder: counts, your proudest cards, the sets closest to done and the purse.",
    "Packs" to "Sift through a pack your way: d-pad left and right on the card or the hand, LB/RB from anywhere, the right stick sideways (hold it to keep flicking), LT/RT to jump to the next face-down card, or your finger. The ring lands on the big card as soon as the cards are dealt.",
    "Play" to "Story battles always use the deck the story gives you.",
    "Sets" to "Sets are easy to find: Play\u2019s Trunk has a Cards | Sets switch with a Keep collecting row of the sets you\u2019ve started, each with a gold completion ring, and Collection Home has a Sets link. A set opens with every card, owned or missing.",
    "Decks" to "In a deck\u2019s All cards, tap a set\u2019s name to open the whole set as a grid and tap it again (or Back) for every shelf. The new Set button opens a glass list of every set, by year, with a search.",
    "Controllers" to "The first d-pad press always lands the ring on the screen, and up and down no longer get stuck on a search box or the top bar.",
    "Controllers" to "The left stick moves a soft cursor that slows over cards and buttons and carries the gold ring with it; A presses what it\u2019s on. The right stick scrolls, and the d-pad steps the ring as before (now on handhelds whose d-pad wasn\u2019t read, like the AYN Portal).",
    "Packs" to "On wide handheld screens the opened card fills the left half, with the pack\u2019s cards and buttons beside it.",
    "Controllers" to "On a handheld or with a controller connected, a small bar in the corner shows what each button does for whatever the gold ring is on. X is the screen\u2019s main action (in a match it follows the table\u2019s button), Y looks closer and hold Y tilts the card, LB/RB switch tabs, LT/RT page, Start opens the menu. Phones without a controller look the same.",
    "Collection" to "Tapping the Card of the Day opens its card page in the app instead of the website.",
    "Foil" to "Magic foils look more like the real card: no milky wash, black ink stays black, Fracture shards read as glass and the rainbow sits on the foil, not over the art. Silver foils like Elesh Norn\u2019s keep their deep silver.",
    "Fixes" to "Settings \u203a Friends opens again for every account. Fewer freezes and stutters, the set row on a card from a pack opens its set, and Collection opens at once with the pages you last saw.",
    "Scanner" to "The Scanner is built into the app: your phone\u2019s camera with the website\u2019s card reader. Your scans and Fix card open in the app, where you can swipe through printings, pick the finish, copies and condition, then add them to your collection or a binder.",
    "Decks" to "Collection Decks open in about a second instead of 8 to 12, and each deck\u2019s page has Practice, War Chest and Share up top like the website, without the doubled buttons.",
    "Decks" to "Building a Collection deck has Owned and All cards, like Play: add any card, and the ones you don\u2019t own show grey with \u201cTo buy\u201d. In portrait, drag or tap the grip between the deck and the collection to give either more room.",
    "Decks" to "On an unfolded phone, War Chest, Rules, Power and Versions open in the big side. Game Night and Ask the Judge in the War Chest always open, and Card lookup opens Search.",
    "Wiki" to "The Wiki is in the app for all three games: today\u2019s article, the glossary, suggestions as you type and full wiki articles whose links open other articles. Back steps through what you read.",
    "Rules" to "The Rules page is in the app: the interactive rules, formats and deck limits, live ban lists and the official documents. How to play opens right there.",
    "Friends" to "Settings \u203a Friends opens in the app: friends, requests, blocked accounts and profiles. Shared binders and decks open in the app, and the swords send a challenge.",
    "Play" to "Play decks have a Power tab (no prices), and rule words open their explanation in Play and Collection.",
    "Collection" to "Card pages can switch a copy\u2019s condition, and Open Pack\u2019s Wishlist all saves the whole pack.",
    "Collection" to "Your Cards, Decks, each deck\u2019s page, every card\u2019s page (Overview, Meta, Play guide, Prices) and All sets are built into the app now, laid out like the website.",
    "Collection" to "Open Pack on a Magic set page opens in the app: each pack comes from the set\u2019s real booster sheets, every pull wears its price frame, and Shop list sends the pack to TCGplayer.",
    "Collection" to "Yu-Gi-Oh! and Pok\u00e9mon sets are in the app too: every set by year, then each set\u2019s page with its foils, badges and prices.",
    "Collection" to "Sets run in number order, and tapping a card in a set opens that exact printing. Adding or changing cards, and Yu-Gi-Oh! and Pok\u00e9mon cards and packs, still open the website for now, and Open Pack has no Wishlist all yet.",
    "Blocking" to "Blocks you can see: tap your creature then the attacker it meets (either order works), or drag one onto the other. A gold line ties each blocker to its attacker, and numbered badges show the order attackers strike in.",
    "Combat" to "Combat plays out one attacker at a time: the board dims around the pair, a tag says who blocks whom or how much damage gets through, then the hit lands. Reduce motion keeps the tags and the order without the lunge.",
    "Fix" to "A match that stops taking taps frees itself after a few seconds and sends a report, so a stuck table no longer needs a restart.",
    "Fix" to "Deck art on Collection Home stays put while you scroll instead of flickering in and out.",
    "Collection" to "Collection opens on its own Home, built into the app: the Card of the Day, your collection\u2019s value, your decks, Meta decks and news, laid out like the website.",
    "Fix" to "When a spell makes you sacrifice, the table says which card to tap instead of showing a greyed-out OK.",
    "Fix" to "Random deck in the lobby builds a deck again; its builder was missing from the app.",
    "Packs" to "Every set's pack shows a hand-picked card's art in its window, and the art shifts behind the frame as you tilt the phone or slide a finger.",
    "Story" to "Act 1's first four battles teach as you play: the Rift whispers a tip and the cards it means glow. Skip lessons turns them off.",
    "Story" to "Acts 33 to 38 are playable, and early acts are retuned. Act 2's Tetsuo's Court, The Deck and the Elder Dragon's lair have living mats.",
    "Packs" to "Seven older packs lose the black box behind them, and Khans of Tarkir shows Siege Rhino.",
    "Fix" to "Quick Play no longer freezes while it picks a Commander opponent.",
    "Smoother" to "An open card scrolls smoothly: its frosted glass is painted once, not on every frame. 3D depth runs only on the card you are looking at, and the foil behind an open card holds still.",
    "Foil" to "A card that only comes in foil now shows its foil.",
    "3D cards" to "Big cards have depth: the art sits behind the frame and shifts as you tilt. Settings \u203a 3D cards turns it off.",
    "Updates" to "The app finds new versions and installs them for you.",
)

private data class Topic(val id: String, val category: String, val title: String, val summary: String, val route: String, val action: String, val details: List<String>)

@Composable
private fun HelpNote(tag: String, line: String) = Text(androidx.compose.ui.text.buildAnnotatedString {
    withStyle(androidx.compose.ui.text.SpanStyle(color = Site.Gold, fontWeight = FontWeight.Bold)) { append(tag) }; append("  "); append(line)
}, style = S.Small)

/** app-info.js findInfo: words over two letters; a title hit scores 4, any other hit 1; no words = every topic in its order. */
private fun findTopics(q: String): List<Topic> {
    val words = q.lowercase().split(Regex("\\W+")).filter { it.length > 2 }
    if (words.isEmpty()) return TOPICS
    return TOPICS.map { t -> t to words.sumOf { w -> when { w in t.title.lowercase() -> 4; "${t.category} ${t.title} ${t.summary} ${t.details.joinToString(" ")}".lowercase().contains(w) -> 1; else -> 0 }.toInt() } }
        .filter { it.second > 0 }.sortedByDescending { it.second }.map { it.first }
}

/**
 * Help (app-info.js infoPanel + views.js sources/about/legal) as lines: this app's version and its notes, the guides with their
 * search, then the sources and About. What's new, each guide, the sources and About are pages.
 */
@Composable
internal fun helpSection(page: String?, open: (String?) -> Unit, onWeb: (String) -> Unit): ConsoleSection {
    val context = LocalContext.current
    val version = remember { runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull() ?: "" }
    // Randall 4 Nov: one download, and notes on a need-to-know basis while the app is in testing (full patch notes at launch).
    val number = version.substringBefore('-') + if ("test" in version) " · test build" else ""
    val waiting = dev.cardstashy.nativeplay.Updater.available
    var q by rememberSaveable { mutableStateOf("") }
    val shown = findTopics(q)
    val items = buildList {
        add(ConsoleItem.Head("This app"))
        val about = "You have version $number. The app finds new versions and installs them for you." + (HomeStart.ms?.let { " Last start: Home in $it ms." } ?: "")
        // The same update prompt as on launch: "Update to X" when the site has a newer build, otherwise a fresh check.
        add(when {
            waiting != null -> line("version", "Version", about, ConsoleCtl.Go(value = "Update to ${waiting.version}", tone = ConsoleTone.WARN, verb = "Update") { dev.cardstashy.nativeplay.Updater.reopen(context) })
            dev.cardstashy.nativeplay.Updater.upToDate -> line("version", "Version", about, ConsoleCtl.Info("$number · Up to date"))
            else -> line("version", "Version", about, ConsoleCtl.Go(value = number, verb = "Check") { dev.cardstashy.nativeplay.Updater.reopen(context) })
        })
        add(line("new", "What’s new", "What changed in this version and the ones before it, newest first.", ConsoleCtl.Go { open("new") }))
        add(ConsoleItem.Head("Guides"))
        add(ConsoleItem.Block("help-search") {
            Box(Modifier.padding(start = 18.dp, end = 18.dp, top = 6.dp, bottom = 6.dp).widthIn(max = 560.dp)) { Field("", q, { q = it }, "Search help: conditions, scanning, formats…", ime = ImeAction.Search) }
        })
        if (shown.isEmpty()) add(ConsoleItem.Block("help-none") { ConsoleNote("No topic matches. Try a shorter word.") })
        shown.forEach { t -> add(line("topic-${t.id}", t.title, t.summary, ConsoleCtl.Go { open("topic-${t.id}") })) }
        add(ConsoleItem.Head("About"))
        add(line("sources", "Card databases and prices", "Where the card data, pictures and prices of each game come from.", ConsoleCtl.Go { open("sources") }))
        add(line("about", "About CardStashy", "An independent fan app. Scores and test games are estimates, not win rates.", ConsoleCtl.Go { open("about") }))
        add(ConsoleItem.Block("legal") {
            ConsoleNote("CardStashy is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.", foot = true)
        })
    }
    val topic = TOPICS.firstOrNull { "topic-${it.id}" == page }
    val opened = when {
        page == "new" -> ConsolePage("new", "What’s new") {
            // Butter pass B3 (Randall 14 Nov): the newest notes only; the whole history waits behind one closed row.
            WHATS_NEW.take(NEWEST_NOTES).forEach { (tag, line) -> HelpNote(tag, line) }
            if (WHATS_NEW.size > NEWEST_NOTES) Disclosure("Older releases (${WHATS_NEW.size - NEWEST_NOTES} notes)") { WHATS_NEW.drop(NEWEST_NOTES).forEach { (tag, line) -> HelpNote(tag, line) } }
        }
        page == "sources" -> ConsolePage("sources", "Card databases and prices") {
            listOf("Magic:" to "Scryfall card data, images and reference prices; MTGJSON precon lists.", "Pokémon:" to "TCGdex card data and images, with supplied TCGplayer and Cardmarket prices.",
                "Yu-Gi-Oh!:" to "YGOPRODeck card data, alternate art, printings and reference prices.", "Imports:" to "Supported text and CSV exports from deck and collection tools.").forEach { (b, t) ->
                Text(androidx.compose.ui.text.buildAnnotatedString { pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.Bold, color = Site.Text)); append(b); pop(); append(" $t") }, style = S.Small)
            }
            Text("Prices are estimates; check edition, condition and shipping with the seller.", style = S.Foot)
        }
        page == "about" -> ConsolePage("about", "About CardStashy") {
            Text("Scores and test games are estimates, not win rates. CardStashy is an independent fan app, not affiliated with or endorsed by the publishers. Magic: The Gathering is a trademark of Wizards of the Coast; Yu-Gi-Oh! of Konami; Pokémon of Nintendo, Creatures and GAME FREAK. Cards and art belong to their owners.", style = S.Small)
            Text("Version $version", style = S.Foot)
        }
        topic != null -> ConsolePage("topic-${topic.id}", topic.title) {
            Text(topic.category.uppercase(), style = S.Eyebrow)
            Text(topic.summary, style = S.Body)
            topic.details.forEach { Text(it, style = S.Small.copy(color = Site.Text)) }
            SiteButton(topic.action, ghost = true, small = true) { onWeb("https://cardstashy.com/${topic.route}") }
        }
        else -> null
    }
    return ConsoleSection(items, opened)
}


// app-info.js INFO_TOPICS, word for word.
private val TOPICS = listOf(
    Topic("start", "Start here", "Find your way around", "One workspace, with a separate collection and decks for each game.", "#home", "Open Home", listOf(
        "Choose Magic, Pokémon or Yu-Gi-Oh! at the top. Home also supports a horizontal swipe. Search, Collection, Decks and Scan stay within the selected game.",
        "The Home search finds real cards as you type. Choose a result to inspect that printing. Submit a question to ask the assistant; typing alone does not start an AI conversation.",
        "Open Settings without leaving your current page. Closing it returns to the same game and task.",
        "Use as profile photo in a card view or enlarged artwork opens the circle editor directly. Drag or pinch to frame it, then Save photo. This does not add the card to your collection.")),
    Topic("collection", "Your cards", "Copies, conditions & binders", "Record what you own, including each copy’s condition and printing.", "#collection", "Open Collection", listOf(
        "Open a card, choose Add to collection, then check the quantity, condition and version. Copies in different conditions or printings belong in separate saved lots.",
        "Hold a card to open its actions. Owned cards have minus and plus controls; if several saved lots exist, choose the lot you mean. Wishlist stays separate from ownership.",
        "Binders and locations organize saved copies. A card in a deck is a deck requirement, not proof that you own it. Check the owned and missing counts.",
        "A save receipt confirms the local change. Use Undo when offered. Cloud sync has its own status in Account; a local save alone does not confirm a cloud upload.")),
    Topic("scan", "Your cards", "Scan, review, save", "Get a clear card image, then confirm the exact match.", "#scan", "Open Scan", listOf(
        "Keep the entire card visible and the camera steady. You do not need perfect alignment. Sharp printing numbers and a readable name help distinguish versions; glare and motion blur can hide them.",
        "Review the game, name, set number, edition and finish. A name match alone cannot prove a printing. Use the version selector or search if the match is ambiguous.",
        "Choose condition and quantity before saving. The receipt uses that saved condition’s available quote, labeled estimate or manual value where applicable. Unavailable prices stay unavailable.",
        "The optional catalogue download helps local matching. Recognition and current data may still need internet. Replaying a demo never starts the camera or purchases a price lookup.")),
    Topic("decks", "Play & build", "What can I play?", "Pick a format, compare what you own, and inspect missing copies.", "#decks/inspiration", "Explore deck ideas", listOf(
        "Choose the game and format before building. Explore ideas, import a list or open a tournament list. Saving a deck creates a list; it does not add those cards to your collection.",
        "Owned counts compare quantities, not just names. Different legal printings can represent the same game piece. Copies are compared independently per deck; the app does not physically reserve them across simultaneous decks.",
        "Check missing copies, resources and deck review before playing. Incomplete budget builds are drafts. A cheaper suggestion is useful only if it still supports a playable plan and the chosen format.",
        "Missing prices are not free cards. A covered subtotal is not a guaranteed purchase total; shipping and seller availability can differ. Review the actual list before saving or buying.")),
    Topic("prices", "Your cards", "Understand a price", "Printing, condition, source and coverage matter more than a single number.", "#collection", "Open Collection value", listOf(
        "Catalogue prices are reference quotes. They may describe a specific finish or an aggregate market, not every physical condition. TCGplayer asking listings and a market-price feed are different kinds of evidence.",
        "Saved copies use their exact printing, finish and condition when a matching provider quote exists. Manual values and estimates are labeled. A price for Near Mint must not silently stand in for Lightly Played or Damaged.",
        "Quotes are cached and refreshed through the app’s pricing services, subject to availability and provider limits. Opening a screen does not guarantee a new quote. Look at the displayed source, date and coverage.",
        "Collection value and its history describe priced saved copies. Unpriced copies are counted separately. Additions, removals and manual changes can affect the graph as well as market movement.",
        "To set your own value, hold a price or use Set your price in card details. A personal value is private and is not a verified sale or a promise of sale proceeds.")),
    Topic("news", "Discover", "News & tournament lists", "Keep the source, date and format attached to the result.", "#home", "Open Home", listOf(
        "Home news uses supported publisher feeds, cached by the app and checked daily. It shows a bounded selection of recent stories with manual paging; it is not a guaranteed seven-day rotation.",
        "Each story keeps its publication date, source and applicable region. Japanese OCG news does not establish TCG release dates or legality.",
        "Meta lists come from supported tournament sources. Cached results can be older than today. Check the event date and format before treating a list as current.",
        "Loading and an unavailable source are different from an empty result. You can inspect an available list, then explicitly save a copy to your decks.")),
    Topic("ai", "Play & build", "Assistant, Coach & Judge", "Use the right evidence for the question you are asking.", "#decks", "Open Decks", listOf(
        "The Home assistant can retrieve card data, collection summaries, saved decks, tournament lists and these Info topics. It can prepare a builder or offer a destination; a recommendation is not a saved change.",
        "Coach works from the selected deck and available analysis. Scores and simulations are estimates, not measured tournament win rates. Review proposed changes before applying them.",
        "Use Ask rules for a ruling. Supply the exact cards, format, relevant text and the situation. The Judge can request missing details and cite the supporting rules; it cannot infer an entire board from a card name or life counter.",
        "AI requests use the app’s server and configured provider. The assistant only receives the app data needed by its tools, not automatic access to every private record. It can be wrong or lack current data.")),
    Topic("tabletop", "Play & build", "Tabletop tools", "Local counters with player-specific history and Undo.", "#tabletop", "Open Tabletop", listOf(
        "Choose the game and players. Magic tracks life, poison and commander damage by source and recipient. Pokémon tracks damage and status on each Active or Bench position. Yu-Gi-Oh! has life-point adjustments.",
        "Each player has their own Undo. A new session needs confirmation. Session counters stay on this device through a reload; they never change a collection or a deck.",
        "Coin flips, dice and counters work locally. Keep awake is optional where your browser supports it. The Judge is separate and needs card and situation details. Check an event’s policy before using any electronic aid.")),
    Topic("privacy", "Your workspace", "Account, backup & sharing", "Your account copy and a deliberately shared deck are different things.", "#settings", "Open Account", listOf(
        "Cards and decks are saved on this device first. Signing in adds a private account copy; check Account for sync progress or errors.",
        "Download a backup before changing devices or clearing storage. Restoring a backup changes saved data; checking one only inspects it. Reset onboarding clears guide history only.",
        "A shared deck requires an explicit sharing action. Public profiles, comments, voting and live collaboration are future work; private collections are not automatically public.")),
)

/** The stage music's required credit, shown under Sound in Settings. */
internal const val STAGE_MUSIC_CREDIT = "Stage music rendered with Virtual Playing Orchestra 3, Sonatina Symphonic Orchestra, VSCO-2 CE, FreePats and DrumGizmo MuldjordKit (CC BY and CC0). Drum samples provided by DrumGizmo.org"
