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
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.art.CardArt
import kotlinx.coroutines.launch

/*
 * Settings, ported from the site: views.js settings() 1949 (tabs, panes), accountPanel 1889, signedOutAccount 1861,
 * settings-theme.js SETTINGS_TABS, app-info.js infoPanel, profile-art.js profileAvatar / profilePhotoControl.
 * Native differences (deviation list): no Backup tab (it holds the device's Collection workspace, which this Play app
 * doesn't keep; app updates live in Help), no Google button or email link yet (both need the browser round trip), Friends / View profile /
 * Blocked accounts open the site.
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

private enum class Tab(val label: String) { ACCOUNT("Profile & account"), APP("Appearance"), INFO("Help") }

@Composable
fun SettingsScreen(onBack: () -> Unit, onWeb: (String) -> Unit, startTab: String = "account", onChallenge: ((com.google.gson.JsonObject) -> Unit)? = null,
                   onDeck: ((game: String, id: String) -> Unit)? = null) {
    BackHandler(onBack = onBack)
    var tab by rememberSaveable { mutableStateOf(if (startTab == "info") Tab.INFO else if (startTab == "app") Tab.APP else Tab.ACCOUNT) }
    val community = remember { CommunityLayerState() }
    // Controller: LB/RB step the tab row (Profile & account, Appearance, Help); a full-screen layer, so nothing under it lends buttons.
    PadScreen(remember { PadActs(tabs = { d -> tab = Tab.entries[(tab.ordinal + d).coerceIn(0, Tab.entries.size - 1)] }, opaque = true) })
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop() // #ambient: the shared art (glass on, or Aura)
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding()) {
            // The dialog head: brand mark, "CARDSTASHY · ALL GAMES", Settings, close.
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                BrandMark(34.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("CARDSTASHY · ALL GAMES", style = S.Eyebrow.copy(fontSize = 10.sp))
                    Text("Settings", style = S.H1)
                }
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(12.dp)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center) { Icon(SiteIcons.Close, 18.dp, Site.Text) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Site.Line))
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
                Column(Modifier.widthIn(max = 760.dp).fillMaxWidth().align(Alignment.CenterHorizontally).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Tabs(tab) { tab = it }
                    when (tab) {
                        Tab.ACCOUNT -> AccountPane(onWeb, onPick = { ArtPick.open(it) }, community)
                        Tab.APP -> AppPane()
                        Tab.INFO -> InfoPane(onWeb)
                    }
                }
            }
        }
        // The community pop-up and what it opens (a friend's shared binder or deck, a card's page), over the whole screen.
        CommunityLayer(community, onHeader = { ArtPick.open("header") }, onChallenge = onChallenge, web = { url, _ -> onWeb(url) }, onDeck = onDeck)
    }
}

@Composable
private fun Tabs(tab: Tab, onTab: (Tab) -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(14.dp)).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Tab.entries.forEach { t ->
            val on = t == tab; val sh = RoundedCornerShape(11.dp)
            Row(Modifier.weight(1f).heightIn(min = 46.dp).clip(sh).then(if (on) Modifier.background(Site.Surface).border(1.dp, Site.Gold.copy(alpha = .45f), sh) else Modifier)
                .clickable { onTab(t) }.padding(horizontal = 6.dp, vertical = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Icon(when (t) { Tab.ACCOUNT -> SiteIcons.Profile; Tab.APP -> SiteIcons.Appearance; Tab.INFO -> SiteIcons.Help }, 15.dp, if (on) Site.Text else Site.Muted)
                Spacer(Modifier.width(6.dp))
                Text(t.label, style = S.Btn.copy(fontSize = 12.sp, color = if (on) Site.Text else Site.Muted), maxLines = 2)
            }
        }
    }
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

/** accountPanel's .sync-line: the state (green when synced, red when paused or waiting on a choice), when it last synced, Sync now. */
@Composable
private fun SyncLine(st: WorkspaceSync.Status, onSync: () -> Unit) {
    val label = when (st.state) {
        WorkspaceSync.State.SYNCED -> "Synced"; WorkspaceSync.State.SYNCING, WorkspaceSync.State.WAITING -> "Syncing…"
        WorkspaceSync.State.ERROR -> "Sync paused"; WorkspaceSync.State.DECIDE -> "Needs your decision"
        WorkspaceSync.State.OFFLINE -> "Offline — will sync when you’re back online"; WorkspaceSync.State.LOCAL -> "Account sync not confirmed"
    }
    val tone = when (st.state) { WorkspaceSync.State.SYNCED -> Good; WorkspaceSync.State.ERROR, WorkspaceSync.State.DECIDE -> Bad; else -> Site.Text }
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Site.Surface2).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(androidx.compose.ui.text.buildAnnotatedString {
            pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.Bold, color = tone)); append(label); pop()
            if (st.state == WorkspaceSync.State.SYNCED && st.at != null) append(" · " + siteWhen(st.at))
        }, Modifier.weight(1f), style = S.Body)
        SiteButton("Sync now", ghost = true, small = true, onClick = onSync)
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

// ---------------------------------------------------------------- Profile & account

@Composable
private fun AccountPane(onWeb: (String) -> Unit, onPick: (String) -> Unit, community: CommunityLayerState) {
    val session by Account.session.collectAsState()
    if (session == null) SignedOut() else SignedIn(onWeb, onPick, community)
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
        Disclosure("Help with email links") { Text("Check spam and open the newest link in the browser where you requested it. If a link has expired, request a new one.", style = S.Foot) }
    }
}

/** views.js accountPanel, signed in: the account hub, Edit profile, the account actions and Delete account. */
@Composable
private fun SignedIn(onWeb: (String) -> Unit, onPick: (String) -> Unit, layer: CommunityLayerState) {
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
    val editProfile = layer.editProfile
    val circle by Community.data.collectAsState()
    androidx.compose.runtime.LaunchedEffect(session?.userId) { Community.refresh() }
    Panel(padding = 0.dp) {
        // account-hub: the header art (or the avatar's art) as a 96 dp banner fading into the panel, the 72 dp avatar overlapping it.
        Box(Modifier.fillMaxWidth()) {
            val header = profile?.header ?: profile?.avatar
            Box(Modifier.fillMaxWidth().height(96.dp).background(Brush.radialGradient(listOf(Site.Gold.copy(alpha = .26f), Color.Transparent), radius = 600f)).background(Site.Surface2)
                .drawWithContent { drawContent(); drawRect(Brush.verticalGradient(.35f to Color.Transparent, 1f to Site.Surface)) }) {
                // The header keeps its own framing (picked in the same drag-and-zoom editor); the avatar fallback fills the banner.
                profile?.header?.let { h -> BoxWithConstraints(Modifier.fillMaxSize()) { ArtFrame(h, maxWidth / maxHeight, Modifier.fillMaxSize()) } }
                    ?: header?.let { coil3.compose.AsyncImage(it.image, null, imageLoader = CardArt.loader, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
                        alignment = androidx.compose.ui.BiasAlignment(0f, -.44f)) }
            }
            Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 60.dp), verticalAlignment = Alignment.Bottom) {
                Box(Modifier.clip(CircleShape).background(Site.Surface).padding(3.dp)) { ProfileAvatar(profile, 72.dp) }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f).padding(bottom = 4.dp)) {
                    Text(profile?.username ?: profile?.name ?: "Collector", style = S.H1, maxLines = 2)
                    Text(session?.email ?: "", style = S.Foot.copy(color = Site.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.Center) {
                        Text("Visible to friends only", style = S.Foot.copy(fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = Site.Gold),
                            modifier = Modifier.align(Alignment.CenterVertically).clip(RoundedCornerShape(999.dp)).background(Site.Gold.copy(alpha = .12f)).border(1.dp, Site.Gold.copy(alpha = .3f), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 2.dp))
                        LinkText("View profile", small = true) { community = CommunityView.Mine }
                    }
                }
            }
        }
        // Friends row (account-hub-friends).
        Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().heightIn(min = 60.dp).clip(RoundedCornerShape(16.dp)).background(Site.Surface2.copy(alpha = .55f))
            .border(1.dp, Site.Line, RoundedCornerShape(16.dp)).clickable { community = CommunityView.Panel("friends") }.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Site.Gold.copy(alpha = .14f)), contentAlignment = Alignment.Center) { Icon(SiteIcons.Friends, 20.dp, Site.Gold) }
            Spacer(Modifier.width(14.dp))
            // views.js account-hub-friends: "Friends" (+ the waiting count), then "N friends · M requests waiting · add by username or email".
            val requests = Community.incoming(circle); val friends = circle?.let { Community.friends(it) }
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Friends", style = S.Btn)
                    if (requests > 0) Text("$requests", style = S.Foot.copy(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Site.Bg),
                        modifier = Modifier.padding(start = 6.dp).clip(RoundedCornerShape(999.dp)).background(Site.Gold).padding(horizontal = 7.dp, vertical = 1.dp))
                }
                Text((friends?.let { "$it friend${if (it == 1) "" else "s"}" } ?: "Your circle") +
                    (if (requests > 0) " · $requests request${if (requests == 1) "" else "s"} waiting" else "") + " · add by username or email", style = S.Foot.copy(color = Site.Muted))
            }
            Text("›", style = S.H1.copy(color = Site.Gold, fontSize = 22.sp))
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Site.Line))
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // accountPanel: "Choose which copy to keep" while the sync waits on the player, otherwise the sync line; an error's words.
            val sync by WorkspaceSync.status.collectAsState()
            val pend by WorkspaceSync.pending.collectAsState()
            if (pend != null) SiteButton("Choose which copy to keep", Modifier.fillMaxWidth().padding(top = 10.dp)) { CollectionWrites.deciding.value = true }
            else SyncLine(sync) { scope.launch { WorkspaceSync.syncNow(context) } }
            if (sync.state == WorkspaceSync.State.ERROR && sync.msg.isNotBlank())
                Text("${sync.msg} Your cards are still saved on this device.", style = S.Small.copy(color = Bad))
            Disclosure("Edit profile", bold = true, force = editProfile) { EditProfile(profile, onPick) }
            Text("Your collection and decks are private. Saved here first, then synced to your account.", style = S.Foot)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SiteButton("Blocked accounts", ghost = true, small = true) { community = CommunityView.Panel("blocks") }
                SiteButton(if (busy == "reset") "Sending…" else "Reset password", ghost = true, small = true, enabled = busy == null) {
                    busy = "reset"; scope.launch { val e = Account.sendReset(session?.email ?: ""); busy = null; toast(e ?: "Check your email for a password-reset link.") }
                }
                SiteButton("Sign out", ghost = true, small = true) { confirmOut = true }
            }
            Text("Signing out hides this account’s cards and profile on this device.", style = S.Foot)
            Disclosure("Delete account", danger = true) {
                Text("Permanently deletes your CardStashy account and the collection, decks and profile synced to it.", style = S.Foot)
                LinkText("How account deletion works", small = true) { onWeb("https://cardstashy.com/delete-account.html") }
                SiteButton(if (busy == "delete") "Deleting…" else "Delete my account", ghost = true, danger = true, enabled = busy == null) { confirmDelete = true }
            }
        }
    }
    if (confirmOut) AlertDialog(onDismissRequest = { confirmOut = false }, containerColor = Site.Surface,
        text = { Text("Sign out? Your account’s cards and profile will be hidden. They’ll be here when you sign back in.", style = S.Body) },
        confirmButton = { TextButton({ confirmOut = false; scope.launch { Account.signOut(); Decks.clear(); dev.cardstashy.nativeplay.play.Progress.clear(); toast("Signed out. Your account data is saved.") } }) { Text("Sign out", style = S.Btn.copy(color = Site.Gold)) } },
        dismissButton = { TextButton({ confirmOut = false }) { Text("Cancel", style = S.Btn.copy(color = Site.Muted)) } })
    if (confirmDelete) {
        var typed by remember { mutableStateOf("") }
        AlertDialog(onDismissRequest = { confirmDelete = false }, containerColor = Site.Surface, title = { Text("Delete account", style = S.H2) },
            text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("This permanently deletes ${session?.email ?: "your account"} and the collection, decks and profile synced to it. It can't be undone. Type DELETE to confirm.", style = S.Body)
                Field("", typed, { typed = it }, ime = ImeAction.Done) } },
            confirmButton = { TextButton({
                confirmDelete = false
                if (typed.trim() != "DELETE") { toast("Account not deleted. Type DELETE in capitals to confirm."); return@TextButton }
                busy = "delete"; scope.launch { val e = Account.deleteAccount(); busy = null; if (e == null) { Decks.clear(); dev.cardstashy.nativeplay.play.Progress.clear() }; toast(e ?: "Your account and its synced data were deleted.") }
            }) { Text("Delete account", style = S.Btn.copy(color = Bad)) } },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel", style = S.Btn.copy(color = Site.Muted)) } })
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

// ---------------------------------------------------------------- Appearance

/** views.js settings app pane, "Glass, motion & feel" (ST-02): the exact labels and foot notes, each live (ST-04). */
@Composable
private fun AppPane() {
    ThemeCard()
    GridCard()
    CardArtCard()
    Panel {
        CardHeading("DISPLAY & FEEDBACK", "Glass, motion & feel")
        Check("Frosted glass", AppSettings.glass, "Turn it off for plain solid panels (a little lighter on older phones).") { AppSettings.set("glass", it) }
        Check("Card lighting & foil effects", AppSettings.finish, "Soft light follows your tilt in card details. Foil cards shimmer automatically in the gallery.") { AppSettings.set("finishEffects", it) }
        Check("Phone tilt in card views", AppSettings.tilt, "Move your phone to move the card and light. Turn off to use touch controls. Follows Reduce motion.") { AppSettings.set("motionTilt", it) }
        Check("3D cards", AppSettings.depth, "The art sits a little deeper than the frame and shifts as you tilt, like looking into the card. Turn off for the flat card with its foil exactly as before.") { AppSettings.set("depthCards", it) }
        // Story playmat MOTION-SPEC: the table's living mat (light rays, leaves, smoke). Reduce motion and battery saver keep it still.
        Text("Table effects", style = S.Body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.padding(top = 6.dp))
        Segmented(AppSettings.EFFECTS, AppSettings.effects) { AppSettings.applyEffects(it) }
        Text(when (AppSettings.effects) {
            "cinematic" -> "Every light, mote, leaf and flyer on Story mats, plus boss moments."
            "minimal" -> "A still painted mat with a soft glow. Lightest on battery."
            else -> "Light rays, glints and glows, with fewer leaves. Follows Reduce motion and battery saver."
        }, style = S.Foot)
        Check("Tap vibration", AppSettings.haptics, "Animations follow your phone’s “Reduce motion” setting.") { AppSettings.set("haptics", it) }
        // Signed in only (views.js setPresence); C.setPresence's toasts.
        val signedIn = dev.cardstashy.nativeplay.account.Account.session.collectAsState().value != null
        if (signedIn) {
            val context = androidx.compose.ui.platform.LocalContext.current; val scope = androidx.compose.runtime.rememberCoroutineScope()
            Check("Show friends what I’m playing", AppSettings.presence, "Accepted friends see your Play screen or match, like “Quick Play · Pauper · turn 7”.") { on ->
                AppSettings.set("presence", on); scope.launch { dev.cardstashy.nativeplay.play.Presence.setShare(on) }
                Toast.makeText(context, if (on) "Friends can see what you’re playing." else "Friends no longer see what you’re playing.", Toast.LENGTH_SHORT).show()
            }
        }
        Check("Sound & music", AppSettings.sound) { AppSettings.set("packSound", it) }
        Check("Soft sounds in the app", AppSettings.appSounds, "Music plays only in matches and Planeswalk. Elsewhere you hear only a few soft sounds, like opening a pack or adding a card, if “Soft sounds in the app” is on. Music streams the first time, then stays on this device. Sound starts after your first tap.") { AppSettings.set("appSounds", it) }
    }
}

/** Offline art plan (4 Nov): what this phone keeps for fast grids, the keep-all switch and Clear. */
@Composable
private fun CardArtCard() = Panel {
    CardHeading("CARD ART", "Saved on this phone")
    val store = dev.cardstashy.nativeplay.art.ThumbStore
    val running by store.progress.collectAsState()
    var stamp by remember { mutableStateOf(0) }
    val used = remember(stamp, running) { store.bytes() }; val sets = remember(stamp, running) { store.setsSaved() }
    Text(if (sets == 0 && used < 1048576) "Nothing saved yet" else "${"%,.0f".format(used / 1048576.0)} MB · $sets ${if (sets == 1) "set" else "sets"}", style = S.Body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
    Text("A set's grid pictures save the first time you open it, so it is instant (and works offline) after that. Foil still shimmers on saved cards.", style = S.Foot)
    if (used > 0) SiteButton("Clear saved art", small = true) { store.clear(); stamp++ }
}

/** settings-theme.js themeSettings(): Color mode, three choices (aura.css: one column under 480 px, radio · 64 px swatch · text). */
@Composable
private fun ThemeCard() = Panel {
    CardHeading("APPEARANCE", "Appearance")
    Text("Color mode", style = S.Body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.padding(top = 4.dp, bottom = 2.dp))
    // Measured on the site (polish.css over settings-theme.css): rows 67 px, 3 px apart, padding 9, radius 10; only the checked one
    // has a fill (--gold mixed into the panel: #232323 dark, #f6f4f0 light) and a 2 px gold ring. Names are DM Sans 14/900 in --muted.
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        for ((id, label, description) in listOf(Triple("light", "Light", "Bright, soft surfaces"), Triple("dark", "Dark", "The familiar night view"), Triple("aura", "Aura", "Soft color from the art you explore"))) {
            val on = AppSettings.theme == id; val sh = RoundedCornerShape(10.dp)
            Row(Modifier.fillMaxWidth().heightIn(min = 67.dp).clip(sh).then(if (on) Modifier.background(if (AppSettings.theme == "light") Color(0xFFF6F4F0) else Color(0xFF232323)).border(2.dp, Site.Gold, sh) else Modifier)
                .clickable { AppSettings.applyTheme(id) }.padding(9.dp), verticalAlignment = Alignment.CenterVertically) {
                // input[type=radio] 18 px, accent-color --gold
                Box(Modifier.size(18.dp).clip(CircleShape).border(if (on) 5.dp else 1.dp, if (on) Site.Gold else Site.Muted, CircleShape).background(if (on) Color.White else Color.Transparent, CircleShape))
                Spacer(Modifier.width(6.dp))
                Swatch(id, Modifier.width(64.dp))
                Spacer(Modifier.width(6.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(label, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Black, fontSize = 14.sp, lineHeight = 20.sp, color = Site.Muted))
                    Text(description, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.8.sp, color = Site.Muted))
                }
            }
        }
    }
    Text("Applies to all three games on this device.", style = S.Foot)
}

/** .settings-theme-swatch-{light,dark,aura}: 52 px, a 17 px column beside a 12 px bar over a panel. */
@Composable
private fun Swatch(id: String, modifier: Modifier) {
    val (bg, bar, panel) = when (id) {
        "light" -> Triple(Brush.linearGradient(listOf(Color(0xFFF0F3F7), Color(0xFFF0F3F7))), Color(0xFFC1CBD9), Color(0xFFFFFFFF))
        "aura" -> Triple(Brush.linearGradient(listOf(Color(0xFF505967), Color(0xFF434056), Color(0xFF665348))), Color(0x808792A6), Color(0xB8252B36))
        else -> Triple(Brush.linearGradient(listOf(Color(0xFF10141B), Color(0xFF10141B))), Color(0xFF4B5568), Color(0xFF252E3C))
    }
    val sh = RoundedCornerShape(8.dp)
    Row(modifier.height(52.dp).clip(sh).background(bg).border(1.dp, Color(0x55798397), sh).padding(7.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.width(17.dp).fillMaxSize().clip(RoundedCornerShape(3.dp)).background(bar))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Box(Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(3.dp)).background(bar))
            Box(Modifier.fillMaxSize().clip(RoundedCornerShape(3.dp)).background(panel))
        }
    }
}

/** grid-settings.js gridSettings(): Card size (Small / Medium / Large) and the pinch switch. */
@Composable
private fun GridCard() = Panel {
    CardHeading("CARD GRIDS", "Room to browse")
    Text("Card size", style = S.Body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.padding(top = 4.dp))
    Segmented(AppSettings.GRID_SIZES, AppSettings.gridSize) { AppSettings.applyGridSize(it) }
    Text("Applies to card galleries in all three games. List views keep their current layout.", style = S.Foot)
    Check("Pinch to resize card grids", AppSettings.gridPinch, "Spread two fingers for larger cards; pinch for smaller cards. Only card grids use this gesture when enabled. Turn it off to use browser pinch zoom there.") { AppSettings.applyGridPinch(it) }
}

/** grid-settings.js's three-way pill (Small / Medium / Large), shared with Table effects. */
@Composable
private fun Segmented(options: List<String>, selected: String, onPick: (String) -> Unit) =
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(14.dp)).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for (id in options) {
            val on = selected == id; val sh = RoundedCornerShape(10.dp)
            // input:checked+span: var(--glass) (white .58 light, surface .46 dark) and a soft drop.
            Box(Modifier.weight(1f).heightIn(min = 44.dp).then(if (on) Modifier.shadow(2.dp, sh, ambientColor = Color(0x22000000), spotColor = Color(0x22000000)).clip(sh).background(if (AppSettings.theme == "light") Color(0x94FFFFFF) else Site.Surface.copy(alpha = .46f)) else Modifier.clip(sh)).clickable { onPick(id) },
                contentAlignment = Alignment.Center) {
                Text(id.replaceFirstChar { it.uppercase() }, style = S.Body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (on) Site.Text else Site.Muted))
            }
        }
    }

@Composable
private fun Check(label: String, on: Boolean, foot: String? = null, onChange: (Boolean) -> Unit) = Column {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { onChange(!on) }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Checkbox(on, onChange, colors = CheckboxDefaults.colors(checkedColor = Site.Gold, uncheckedColor = Site.Muted, checkmarkColor = Site.GoldInk))
        Text(label, style = S.Body)
    }
    foot?.let { Text(it, style = S.Foot, modifier = Modifier.padding(start = 12.dp)) }
}

// ---------------------------------------------------------------- Help (app-info.js infoPanel + views.js sources/about/legal)

/** This build's notes: short, plain, what a player would notice. */
private val WHATS_NEW = listOf(
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
private fun InfoPane(onWeb: (String) -> Unit) {
    val context = LocalContext.current
    val version = remember { runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull() ?: "" }
    // Randall 4 Nov: one download, and notes on a need-to-know basis while the app is in testing (full patch notes at launch).
    val number = version.substringBefore('-'); val test = "test" in version
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("Updates", style = S.Btn.copy(fontSize = 16.sp))
            Text("Version $number" + if (test) " \u00B7 test build" else "", style = S.Foot)
        }
        // The same update prompt as on launch: "Update to X" when the site has a newer build, otherwise a fresh check.
        val ctx = androidx.compose.ui.platform.LocalContext.current
        val waiting = dev.cardstashy.nativeplay.Updater.available
        if (waiting == null && dev.cardstashy.nativeplay.Updater.upToDate) Text("Up to date", style = S.Foot)
        else LinkText(waiting?.let { "Update to ${it.version}" } ?: "Check for updates", small = true) { dev.cardstashy.nativeplay.Updater.reopen(ctx) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("WHAT\u2019S NEW", style = S.Eyebrow)
        WHATS_NEW.forEach { (tag, line) ->
            Text(androidx.compose.ui.text.buildAnnotatedString {
                withStyle(androidx.compose.ui.text.SpanStyle(color = Site.Gold, fontWeight = FontWeight.Bold)) { append(tag) }; append("  "); append(line)
            }, style = S.Small)
        }
    }
    Box(Modifier.fillMaxWidth().height(1.dp).background(Site.Line))
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("MAKE IT YOURS", style = S.Eyebrow)
        Text("A little guidance. A lot to explore.", style = S.H1.copy(fontSize = 24.sp, lineHeight = 30.sp))
        Text("Find an answer or watch the action happen.", style = S.Small)
    }
    var q by rememberSaveable { mutableStateOf("") }
    Field("Search help", q, { q = it }, "Conditions, scanning, formats…", ime = ImeAction.Search)
    // findInfo: words over two letters; title hits score 4, any other hit 1; no words = all topics in order.
    val words = q.lowercase().split(Regex("\\W+")).filter { it.length > 2 }
    val shown = if (words.isEmpty()) TOPICS else TOPICS.map { t -> t to words.sumOf { w -> when { w in t.title.lowercase() -> 4; "${t.category} ${t.title} ${t.summary} ${t.details.joinToString(" ")}".lowercase().contains(w) -> 1; else -> 0 }.toInt() } }
        .filter { it.second > 0 }.sortedByDescending { it.second }.map { it.first }
    Text("${shown.size} topics", style = S.Foot)
    if (shown.isEmpty()) Text("No topic matches. Try a shorter word, or ask the Home assistant.", style = S.Small)
    shown.forEach { t -> TopicCard(t, onWeb) }
    Panel(padding = 14.dp) {
        Disclosure("Card databases & prices") {
            listOf("Magic:" to "Scryfall card data, images and reference prices; MTGJSON precon lists.", "Pokémon:" to "TCGdex card data and images, with supplied TCGplayer and Cardmarket prices.",
                "Yu-Gi-Oh!:" to "YGOPRODeck card data, alternate art, printings and reference prices.", "Imports:" to "Supported text and CSV exports from deck and collection tools.").forEach { (b, t) ->
                Text(androidx.compose.ui.text.buildAnnotatedString { pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.Bold, color = Site.Text)); append(b); pop(); append(" $t") }, style = S.Small)
            }
            Text("Prices are estimates; check edition, condition and shipping with the seller.", style = S.Foot)
        }
    }
    Panel(padding = 14.dp) {
        Disclosure("About CardStashy") {
            Text("Scores and test games are estimates, not win rates. CardStashy is an independent fan app, not affiliated with or endorsed by the publishers. Magic: The Gathering is a trademark of Wizards of the Coast; Yu-Gi-Oh! of Konami; Pokémon of Nintendo, Creatures and GAME FREAK. Cards and art belong to their owners.", style = S.Foot)
            Text("Version $version", style = S.Foot)
        }
    }
    Text("CardStashy is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.", style = S.Foot)
}

@Composable
private fun TopicCard(t: Topic, onWeb: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Panel(Modifier.animateContentSize().clickable { open = !open }, padding = 16.dp) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(t.category.uppercase(), style = S.Eyebrow); Text(t.title, style = S.H2.copy(fontSize = 16.sp)); Text(t.summary, style = S.Small)
            }
            Text(if (open) "−" else "+", style = S.H2.copy(color = Site.Gold))
        }
        if (open) {
            t.details.forEach { Text(it, style = S.Small.copy(color = Site.Text)) }
            SiteButton(t.action, ghost = true, small = true) { onWeb("https://cardstashy.com/${t.route}") }
        }
    }
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
