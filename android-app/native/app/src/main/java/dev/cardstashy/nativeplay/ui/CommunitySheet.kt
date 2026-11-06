package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import dev.cardstashy.nativeplay.collection.CollectionEngine
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.art.CardArt
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

/**
 * community-profile.js createCommunity, the account's social side, as the site runs it from Settings › Account (friendsOpen,
 * View profile, Blocked accounts): the Friends pop-up (Friends / Requests / Add friend), a player's profile, your own profile
 * and the blocked list. Every call is cloud.js communityRequest (Account.community, community_action) and friends' presence is
 * presenceRequest('friends'), read again every 30 s while the Friends list is open (PRESENCE_TIMING.friendsMs).
 */
internal object Community {
    /** community.refresh's data: the overview (people, blocked, items, art) with presence, for this account. */
    val data = MutableStateFlow<JsonObject?>(null)
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow("")
    private var owner: String? = null

    private fun sync() { val id = Account.session.value?.userId; if (id != owner) { owner = id; data.value = null; error.value = "" } }
    /** createCommunity's refresh: overview and presence together; a late answer for another account is dropped. */
    /** Set by the app: repairOwnShowcase on your own items from this device's collection ({i, item} for each that changed). */
    var repair: (suspend (com.google.gson.JsonArray) -> com.google.gson.JsonArray)? = null
    suspend fun refresh() {
        sync(); val who = owner ?: return
        busy.value = true; error.value = ""
        try {
            val next = Account.community("overview")
            val live = runCatching { Account.presence("friends") }.getOrNull()
            if (who != Account.session.value?.userId) return
            if (live != null) next.add("presence", live.get("presence")?.takeIf { it.isJsonObject } ?: live)
            // Your shared snapshots repaired where their cards still match this device's, each shared again before it shows.
            next.getAsJsonArray("items")?.takeIf { it.size() > 0 }?.let { items -> repair?.invoke(items)?.forEach { r ->
                val o = r as? JsonObject ?: return@forEach; val i = o.get("i")?.asInt ?: return@forEach; val item = o.getAsJsonObject("item") ?: return@forEach
                Account.community("share", JsonObject().apply { add("item", item) })
                if (who != Account.session.value?.userId) return
                items.set(i, item)
            } }
            data.value = next
        } catch (e: Exception) { if (who == Account.session.value?.userId) error.value = e.message?.ifBlank { null } ?: "Could not load your friends." }
        finally { busy.value = false }
    }
    suspend fun presence() { val live = runCatching { Account.presence("friends") }.getOrNull() ?: return; val d = data.value ?: return
        data.value = d.deepCopy().apply { add("presence", live.get("presence")?.takeIf { it.isJsonObject } ?: live) } }

    fun people(d: JsonObject?) = d?.getAsJsonArray("people")?.mapNotNull { it as? JsonObject }.orEmpty()
    /** incomingRequestCount. */
    fun incoming(d: JsonObject?) = people(d).count { it.s("relationship") == "pending" && it.b("incoming") }
    fun friends(d: JsonObject?) = people(d).count { it.s("relationship") == "accepted" }

    internal fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    internal fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
    /** label: username, else display name, else Collector. */
    fun label(p: JsonObject) = p.s("username").ifBlank { p.s("display_name") }.ifBlank { "Collector" }
    fun profile(p: JsonObject) = Account.Profile(p.s("display_name").ifBlank { null }, p.s("avatar_url").takeIf { it.startsWith("https://") },
        p.s("username").ifBlank { null }, p.s("bio").ifBlank { null }, Account.Art.from(p.getAsJsonObject("avatar")), Account.Art.from(p.getAsJsonObject("header")))

    /** play-presence.js presenceLine: what a friend is doing, or when they were last seen. */
    data class Live(val online: Boolean, val inMatch: Boolean, val text: String)
    fun presenceLine(p: JsonObject?, now: Long = System.currentTimeMillis()): Live {
        if (p == null) return Live(false, false, "")
        if (p.b("online") && p.s("label").isNotBlank()) return Live(true, p.s("mode") in setOf("story", "quick", "practice", "friend"), p.s("label"))
        val at = runCatching { java.time.Instant.parse(p.s("at")).toEpochMilli() }.getOrNull() ?: return Live(false, false, "")
        val mins = maxOf(0L, Math.round((now - at) / 60000.0))
        val ago = if (mins < 60) "${maxOf(1, mins)} min" else if (mins < 1440) "${Math.round(mins / 60.0)} h" else "${Math.round(mins / 1440.0)} d"
        return Live(false, false, "Last seen $ago ago")
    }
}

/** What the pop-up shows: a list (friends, requests, add, blocks), a player's profile, or your own. */
internal sealed interface CommunityView {
    data class Panel(val kind: String) : CommunityView
    data class Person(val id: String, val back: Panel?) : CommunityView
    data object Mine : CommunityView
    /** [sharing]: "Preview before sharing", its foot Show on my profile (showItem(item, true)). */
    data class Item(val item: JsonObject, val back: CommunityView, val sharing: Boolean = false) : CommunityView
    /** chooseShare: Choose what friends see, on Binders or Decks. */
    data class Choose(val kind: String) : CommunityView
}

/** The owner's showcase controls: Choose binders / decks, Edit binder / deck (the item on this device), Update shared copy, Hide. */
internal class ShowcaseOwner(val choose: (String) -> Unit, val source: (JsonObject) -> Unit, val preview: (String) -> Unit, val hide: (String) -> Unit)

/**
 * The .community-dialog: the title and ✕ in a sticky head, the body under it, the status line (.community-message) at the foot.
 * [onEditProfile]: Edit profile (the account panel's own editor); [onHeader]: Edit header (the header picker); [onChallenge]: the
 * crossed swords on a friend (A.playChallenge), null where Play can't take it.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CommunitySheet(start: CommunityView, onClose: () -> Unit, onEditProfile: () -> Unit, onHeader: () -> Unit,
                            onChallenge: ((JsonObject) -> Unit)?, toast: (String) -> Unit, onOpenItem: ((JsonObject) -> Unit)? = null,
                            /** createCommunity's editItem: the binder's editor or the deck's page; the pop-up closes first. */
                            onSource: (JsonObject) -> Unit = {}) {
    var view by remember { mutableStateOf(start) }
    val data by Community.data.collectAsState()
    val busy by Community.busy.collectAsState()
    val error by Community.error.collectAsState()
    val session by Account.session.collectAsState()
    val mine by Account.profile.collectAsState()
    val scope = rememberCoroutineScope()
    var message by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    LaunchedEffect(session?.userId) { Community.refresh() }
    // Friends' presence stays fresh while the list is open (every 30 s), without reloading the profiles.
    LaunchedEffect(view) { if ((view as? CommunityView.Panel)?.kind == "friends") while (true) { delay(30_000); Community.presence() } }
    fun back() { when (val v = view) { is CommunityView.Person -> v.back?.let { view = it } ?: onClose(); is CommunityView.Item -> view = v.back
        is CommunityView.Choose -> view = CommunityView.Mine; else -> onClose() }; message = "" }
    // showcaseChoices: this device's binders and decks, read when the picker or a preview needs them.
    val context = androidx.compose.ui.platform.LocalContext.current
    var choices by remember { mutableStateOf<List<JsonObject>?>(null) }
    suspend fun loadChoices(): List<JsonObject> = choices ?: (CollectionWrites.showcaseChoices(context)?.mapNotNull { it as? JsonObject }.orEmpty()).also { choices = it }
    BackHandler { back() }
    // createCommunity's mutate: the change, the overview again, then the list it came from (or close), and its toast.
    fun mutate(action: String, payload: JsonObject) {
        if (working) return; working = true; message = "Saving…"
        scope.launch {
            try {
                Account.community(action, payload); Community.refresh()
                val keep = (view as? CommunityView.Panel) ?: (view as? CommunityView.Person)?.back
                if (keep != null && action in setOf("accept", "decline", "remove", "block", "unblock")) view = keep
                else onClose()
                message = ""
                toast(mapOf("request" to "Friend request sent.", "accept" to "Friend added.", "decline" to "Request removed.", "remove" to "Friend removed.",
                    "block" to "Account blocked.", "unblock" to "Account unblocked.", "share" to "Shown on your profile.", "unshare" to "Hidden from your profile.")[action] ?: "Saved.")
            } catch (e: Exception) { message = e.message ?: "Could not save that change." } finally { working = false }
        }
    }
    val ownerActs = ShowcaseOwner(choose = { k -> view = CommunityView.Choose(k); message = "" },
        source = { item -> scope.launch { val local = loadChoices().firstOrNull { with(Community) { it.s("key") } == with(Community) { item.s("key") } } ?: return@launch; onClose(); onSource(local) } },
        preview = { key -> scope.launch { val local = loadChoices().firstOrNull { with(Community) { it.s("key") } == key }
            if (local != null) { view = CommunityView.Item(local, view, sharing = true); message = "" } else toast("This saved item is no longer on this device.") } },
        hide = { key -> mutate("unshare", JsonObject().apply { addProperty("key", key) }) })
    val title = when (val v = view) {
        is CommunityView.Panel -> if (v.kind == "blocks") "Blocked accounts" else "Friends"
        is CommunityView.Person -> "Player profile"
        CommunityView.Mine -> "My profile"
        is CommunityView.Item -> if (v.sharing) "Preview before sharing" else v.item.let { with(Community) { it.s("title") } }.ifBlank { "Shared item" }
        is CommunityView.Choose -> "Choose what friends see"
    }
    Box(Modifier.fillMaxSize().background(Color(0xB8060910)).clickable(remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, null) { onClose() }.statusBarsPadding().navigationBarsPadding(),
        contentAlignment = Alignment.Center) {
        val shape = RoundedCornerShape(26.dp)
        Column(Modifier.widthIn(max = 900.dp).fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp).clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape)
            .clickable(remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, null) {}) {
            Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = Site.CardTitle, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClose).semantics { contentDescription = "Close" }, contentAlignment = Alignment.Center) {
                    Text("✕", style = Site.Button.copy(color = Site.Muted)) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Site.Line))
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp)) {
                when (val v = view) {
                    is CommunityView.Panel -> {
                        if (v.kind != "blocks") FriendsNav(v.kind, Community.incoming(data)) { view = CommunityView.Panel(it); message = "" }
                        if (v.kind == "add") AddFriend(data, working, onMessage = { message = it }, onAct = { a, id -> mutate(a, JsonObject().apply { addProperty("target", id) }) },
                            onPerson = { view = CommunityView.Person(it, v) })
                        else PanelRows(v.kind, data, busy, error, onRetry = { scope.launch { Community.refresh() } },
                            onPerson = { view = CommunityView.Person(it, v) }, onChallenge = onChallenge?.let { c -> { p: JsonObject -> onClose(); c(p) } },
                            onAct = { a, id -> mutate(a, JsonObject().apply { addProperty("target", id) }) })
                    }
                    is CommunityView.Person -> PersonView(v, onBack = { back() }, onAct = { a -> mutate(a, JsonObject().apply { addProperty("target", v.id) }) },
                        onItem = { onOpenItem?.invoke(it) ?: run { view = CommunityView.Item(it, v) } })
                    CommunityView.Mine -> {
                        val me = (mine ?: Account.Profile(null, null)).let { p -> p.copy(avatar = Account.Art.from(data?.getAsJsonObject("art")?.getAsJsonObject("avatar")) ?: p.avatar,
                            header = Account.Art.from(data?.getAsJsonObject("art")?.getAsJsonObject("header")) ?: p.header) }
                        if (error.isNotBlank()) message = error
                        ProfileCard(me, data?.getAsJsonArray("items"), owner = true, onEdit = { onClose(); onEditProfile() }, onHeader = onHeader,
                            onItem = { onOpenItem?.invoke(it) ?: run { view = CommunityView.Item(it, CommunityView.Mine) } }, owner2 = ownerActs)
                    }
                    is CommunityView.Item -> {
                        ShowcaseDetail(v.item)
                        if (v.sharing) SiteButton("Show on my profile", Modifier.padding(top = 18.dp).heightIn(min = 44.dp), enabled = !working) {
                            mutate("share", JsonObject().apply { add("item", v.item) }) }
                    }
                    is CommunityView.Choose -> ChooseShare(v.kind, choices, onLoad = { scope.launch { loadChoices() } }, onKind = { view = CommunityView.Choose(it) },
                        onPreview = { item -> view = CommunityView.Item(item, v, sharing = true); message = "" }, onSource = ownerActs.source)
                }
            }
            if (message.isNotBlank()) Text(message, style = Site.Meta.copy(color = Color(0xFFF2C66D)), modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp))
        }
    }
}

/** friendsNav: Friends / Requests (with the incoming count) / Add friend, the one open pressed. */
@Composable
private fun FriendsNav(on: String, requests: Int, pick: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = 16.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for ((k, label) in listOf("friends" to "Friends", "requests" to "Requests", "add" to "Add friend")) {
            val sel = k == on
            Row(Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(9.dp)).background(if (sel) Site.Surface else Color.Transparent)
                .drawWithContent { drawContent(); if (sel) drawRect(Site.Gold, topLeft = androidx.compose.ui.geometry.Offset(0f, size.height - 2.dp.toPx()), size = androidx.compose.ui.geometry.Size(size.width, 2.dp.toPx())) }
                .clickable { pick(k) }.semantics { contentDescription = if (k == "requests" && requests > 0) "Requests, $requests waiting" else label },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Text(label, style = Site.Meta.copy(color = if (sel) Site.Text else Site.Muted, fontWeight = FontWeight.SemiBold), maxLines = 1)
                if (k == "requests" && requests > 0) Text(" $requests", style = Site.Meta.copy(color = Site.Gold, fontWeight = FontWeight.Bold))
            }
        }
    }
}

/** personPill: the avatar (44), the name and the presence line (a gold dot online, green in a match), then its controls. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PersonPill(p: JsonObject, live: Community.Live? = null, modifier: Modifier = Modifier, controls: @Composable () -> Unit = {}) {
    FlowRow(modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
        itemVerticalAlignment = Alignment.CenterVertically) {
        ProfileAvatar(Community.profile(p), 44.dp, ring = false)
        Column(Modifier.weight(1f).widthIn(min = 100.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(Community.label(p), style = Site.Body.copy(fontWeight = FontWeight.Bold))
            if (live != null && live.text.isNotBlank()) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (live.online) Box(Modifier.size(8.dp).clip(CircleShape).background(if (live.inMatch) Color(0xFF7FC79A) else Color(0xFFD6AD64)))
                Text(live.text, style = Site.Meta.copy(fontSize = 13.sp, color = if (live.inMatch) Site.Text else Site.Muted))
            }
        }
        controls()
    }
}

@Composable
private fun Divider() = Box(Modifier.fillMaxWidth().height(1.dp).background(Site.Line))

/** panelRows: the friends (with the challenge swords), the requests (Accept / Decline, or Request sent), or the blocked (Unblock). */
@Composable
private fun PanelRows(kind: String, data: JsonObject?, busy: Boolean, error: String, onRetry: () -> Unit, onPerson: (String) -> Unit,
                      onChallenge: ((JsonObject) -> Unit)?, onAct: (String, String) -> Unit) = with(Community) {
    if (busy && data == null) { Text("Loading your friends…", style = Site.Meta); return }
    if (error.isNotBlank() && data == null) { Text(error, style = Site.Body); Spacer(Modifier.height(10.dp)); SiteButton("Retry", ghost = true, onClick = onRetry); return }
    if (data == null) { Text("Loading your friends…", style = Site.Meta); return }
    if (error.isNotBlank()) Text("Showing previously loaded information. $error", style = Site.Meta.copy(color = Color(0xFFF2C66D)), modifier = Modifier.padding(bottom = 8.dp))
    val people = if (kind == "blocks") data.getAsJsonArray("blocked")?.mapNotNull { it as? JsonObject }.orEmpty()
        else people(data).filter { it.s("relationship") == (if (kind == "requests") "pending" else "accepted") }
    if (people.isEmpty()) { Text(when (kind) { "requests" -> "No friend requests."; "blocks" -> "No blocked accounts."; else -> "No friends yet. Add someone by their exact username or email." },
        style = Site.Meta, modifier = Modifier.padding(vertical = 8.dp)); return }
    val presence = data.getAsJsonObject("presence")
    for (p in people) {
        val id = p.s("id")
        when (kind) {
            "friends" -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PersonPill(p, presenceLine(presence?.getAsJsonObject(id)), Modifier.weight(1f).clickable { onPerson(id) })
                if (onChallenge != null) Swords(label(p)) { onChallenge(p) }
            }
            "blocks" -> PersonPill(p) { SiteButton("Unblock", ghost = true, small = true) { onAct("unblock", id) } }
            else -> PersonPill(p) { RelationshipControls(p, onPerson, onAct) }
        }
        Divider()
    }
}

/** relationshipControls: View profile for a friend; Accept / Decline for a request to you; Request sent; else Add friend. */
@Composable
private fun RelationshipControls(p: JsonObject, onPerson: (String) -> Unit, onAct: (String, String) -> Unit) = with(Community) {
    val id = p.s("id")
    when {
        p.s("relationship") == "accepted" -> SiteButton("View profile", ghost = true, small = true) { onPerson(id) }
        p.s("relationship") == "pending" && p.b("incoming") -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SiteButton("Accept", small = true) { onAct("accept", id) }
            Text("Decline", style = Site.Button.copy(fontSize = 13.sp, color = Site.Gold), modifier = Modifier.heightIn(min = 44.dp).clickable { onAct("decline", id) }.padding(horizontal = 6.dp, vertical = 12.dp))
        }
        p.s("relationship") == "pending" -> Text("Request sent", style = Site.Meta.copy(fontSize = 13.sp))
        else -> SiteButton("Add friend", small = true) { onAct("request", id) }
    }
}

/** .community-challenge: crossed swords in a gold coin (44), "Challenge … to a match". */
@Composable
private fun Swords(name: String, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Color(0xFF3A2C16), Color(0xFF1A140B)))).border(1.dp, Color(0x8CC99A4B), CircleShape)
        .clickable(onClick = onClick).semantics { contentDescription = "Challenge $name to a match" }, contentAlignment = Alignment.Center) {
        androidx.compose.foundation.Canvas(Modifier.size(22.dp)) {
            val u = size.width / 24f; val st = androidx.compose.ui.graphics.drawscope.Stroke(1.7f * u, cap = androidx.compose.ui.graphics.StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round)
            val c = Color(0xFFF2D18E)
            fun line(vararg p: Float) { val path = androidx.compose.ui.graphics.Path(); path.moveTo(p[0] * u, p[1] * u); var i = 2; while (i < p.size) { path.lineTo(p[i] * u, p[i + 1] * u); i += 2 }; drawPath(path, c, style = st) }
            // SWORDS: M14.5 17.5 3 6V3h3l11.5 11.5 · m13 19 6-6 · m16 16 4 4 · m19 21 2-2 · M14.5 6.5 18 3h3v3l-3.5 3.5 · m5 14 4 4 · m7 17-3 3 · m3 19 2 2
            line(14.5f, 17.5f, 3f, 6f, 3f, 3f, 6f, 3f, 17.5f, 14.5f); line(13f, 19f, 19f, 13f); line(16f, 16f, 20f, 20f); line(19f, 21f, 21f, 19f)
            line(14.5f, 6.5f, 18f, 3f, 21f, 3f, 21f, 6f, 17.5f, 9.5f); line(5f, 14f, 9f, 18f); line(7f, 17f, 4f, 20f); line(3f, 19f, 5f, 21f)
        }
    }
}

/** add: "Enter their exact username or email…", the search field and Search, then who was found (or "No account found"). */
@Composable
private fun AddFriend(data: JsonObject?, working: Boolean, onMessage: (String) -> Unit, onAct: (String, String) -> Unit, onPerson: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var q by remember { mutableStateOf("") }
    var found by remember { mutableStateOf<JsonObject?>(null) }
    var none by remember { mutableStateOf(false) }
    var searching by remember { mutableStateOf(false) }
    fun search() {
        val t = q.trim(); if (t.length < 3 || searching) return
        searching = true; onMessage("Searching…")
        scope.launch {
            try { val r = Account.community("lookup", JsonObject().apply { addProperty("query", t) }); found = r.getAsJsonObject("person"); none = found == null; onMessage("") }
            catch (e: Exception) { onMessage(e.message ?: "Could not search right now.") } finally { searching = false }
        }
    }
    Text("Enter their exact username or email. Profiles stay private until the request is accepted.", style = Site.Meta.copy(fontSize = 13.sp))
    Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Username or email", style = Site.Label)
            BasicTextField(q, { q = it.take(254) }, singleLine = true, textStyle = Site.Body, cursorBrush = SolidColor(Site.Gold),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { search() }),
                modifier = Modifier.fillMaxWidth().heightIn(min = 46.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 12.dp).semantics { contentDescription = "Username or email" })
        }
        SiteButton(if (searching) "Searching…" else "Search", enabled = q.trim().length >= 3 && !searching && !working) { search() }
    }
    found?.let { p -> PersonPill(p) { RelationshipControls(p, onPerson, onAct) } }
    if (none) Text("No account found. Check the exact username or email.", style = Site.Meta)
}

/** showPerson: "← Back to friends", their profile, then Remove friend and Block. */
@Composable
private fun PersonView(v: CommunityView.Person, onBack: () -> Unit, onAct: (String) -> Unit, onItem: (JsonObject) -> Unit) {
    var p by remember(v.id) { mutableStateOf<JsonObject?>(null) }
    var err by remember(v.id) { mutableStateOf("") }
    LaunchedEffect(v.id) { try { p = Account.community("profile", JsonObject().apply { addProperty("target", v.id) }) } catch (e: Exception) { err = e.message ?: "Could not load this profile." } }
    if (v.back != null) Text("← Back to friends", style = Site.Button.copy(fontSize = 14.sp, color = Site.Gold), modifier = Modifier.heightIn(min = 44.dp).clickable(onClick = onBack).padding(vertical = 12.dp))
    val person = p
    when {
        err.isNotBlank() -> Text(err, style = Site.Body)
        person == null -> Text("Loading profile…", style = Site.Meta)
        else -> {
            ProfileCard(Community.profile(person), person.getAsJsonArray("items"), owner = false, onItem = onItem)
            Row(Modifier.padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                Text("Remove friend", style = Site.Button.copy(fontSize = 14.sp, color = Site.Gold), modifier = Modifier.heightIn(min = 44.dp).clickable { onAct("remove") }.padding(vertical = 12.dp))
                Text("Block", style = Site.Button.copy(fontSize = 14.sp, color = Color(0xFFF08A7E)), modifier = Modifier.heightIn(min = 44.dp).clickable { onAct("block") }.padding(vertical = 12.dp))
            }
        }
    }
}

/**
 * profileHTML: the header (its art, else the avatar's, fading into the card; Edit header for you), the avatar (92, 74 on a phone) over
 * its edge, the name and "Accepted friends only", Edit profile for you, the bio, then the shared Binders and Decks.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProfileCard(p: Account.Profile, items: JsonArray?, owner: Boolean, onEdit: () -> Unit = {}, onHeader: () -> Unit = {}, onItem: (JsonObject) -> Unit, owner2: ShowcaseOwner? = null) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth; val phone = w < 500.dp
        val shape = RoundedCornerShape(26.dp)
        Column(Modifier.fillMaxWidth().clip(shape).background(Site.Surface).border(1.dp, Site.Line, shape)) {
            Box(Modifier.fillMaxWidth().height((w * .25f).coerceIn(160.dp, 280.dp)).background(Brush.linearGradient(listOf(Site.Gold.copy(alpha = .16f).compositeOver(Site.Surface), Site.Surface2)))
                .drawWithContent { drawContent()
                    drawRect(Brush.horizontalGradient(0f to Color(0x4D000000), .18f to Color.Transparent, .82f to Color.Transparent, 1f to Color(0x4D000000)))
                    drawRect(Brush.verticalGradient(.15f to Color.Transparent, 1f to Site.Surface)) }) {
                val header = p.header ?: p.avatar
                if (header != null) coil3.compose.AsyncImage(header.image, null, imageLoader = CardArt.loader, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
                    alignment = androidx.compose.ui.BiasAlignment(0f, -.36f))
                if (owner) SiteButton("Edit header", Modifier.align(Alignment.TopEnd).padding(16.dp), ghost = true, small = true, onClick = onHeader)
            }
            Column(Modifier.padding(start = if (phone) 16.dp else 24.dp, end = if (phone) 16.dp else 24.dp, bottom = if (phone) 18.dp else 24.dp)) {
                FlowRow(Modifier.fillMaxWidth().offset(y = (-38).dp), horizontalArrangement = Arrangement.spacedBy(if (phone) 12.dp else 16.dp), itemVerticalAlignment = Alignment.Bottom) {
                    Box(Modifier.clip(CircleShape).background(Site.Surface).padding(4.dp)) { ProfileAvatar(p, if (phone) 74.dp else 92.dp, ring = false) }
                    Column(Modifier.weight(1f).widthIn(min = 120.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(p.username ?: p.name ?: "Collector", style = Site.CardTitle.copy(fontSize = if (phone) 22.sp else 28.sp, fontWeight = FontWeight.Bold))
                        Text("Accepted friends only", style = Site.Label.copy(fontSize = 10.sp, fontWeight = FontWeight.Medium),
                            modifier = Modifier.clip(RoundedCornerShape(20.dp)).border(1.dp, Site.Line, RoundedCornerShape(20.dp)).padding(horizontal = 9.dp, vertical = 5.dp))
                    }
                    if (owner) SiteButton("Edit profile", ghost = true, small = true, onClick = onEdit)
                }
                if (!p.bio.isNullOrBlank()) Text(p.bio, style = Site.Body.copy(lineHeight = 26.sp), modifier = Modifier.padding(bottom = 6.dp))
                else if (owner) Text("Add a short bio to make this space yours.", style = Site.Meta.copy(fontSize = 13.sp))
                ShowcaseSections(items?.mapNotNull { it as? JsonObject }.orEmpty(), if (owner) owner2 else null, onItem)
            }
        }
    }
}

private fun Color.compositeOver(bg: Color) = Color(red * alpha + bg.red * (1 - alpha), green * alpha + bg.green * (1 - alpha), blue * alpha + bg.blue * (1 - alpha), 1f)

/** showcaseSections: Binders N and Decks N, each a grid of its shared tiles, or what to do when empty. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShowcaseSections(items: List<JsonObject>, own: ShowcaseOwner?, onItem: (JsonObject) -> Unit) = with(Community) {
    val owner = own != null
    for (kind in listOf("binder", "deck")) {
        val group = items.filter { it.s("kind") == kind }
        Row(Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (kind == "binder") "Binders" else "Decks", style = Site.Body.copy(fontSize = 18.sp, fontWeight = FontWeight.Bold))
            Text(" ${group.size}", style = Site.Meta.copy(fontSize = 13.sp), modifier = Modifier.weight(1f))
            if (own != null) SiteButton(if (kind == "binder") "Choose binders" else "Choose decks", Modifier.heightIn(min = 44.dp), ghost = true, small = true) { own.choose(kind) }
        }
        if (group.isEmpty()) Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).border(1.dp, Site.Line, RoundedCornerShape(18.dp)).padding(horizontal = 18.dp, vertical = 30.dp), contentAlignment = Alignment.Center) {
            Text(if (owner) "Choose what to share with accepted friends." else "Nothing shared here yet.", style = Site.Meta.copy(fontSize = 13.sp))
        } else BoxWithConstraints(Modifier.fillMaxWidth()) {
            val cols = maxOf(2, (maxWidth / 170.dp).toInt())
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(14.dp), maxItemsInEachRow = cols) {
                for (item in group) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShowcaseTile(item) { onItem(item) }
                    // .community-item-actions: Edit binder / deck, Update shared copy, Hide.
                    if (own != null) ItemActions(item, own, picker = false)
                }
                repeat((cols - group.size % cols) % cols) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ItemActions(item: JsonObject, own: ShowcaseOwner, picker: Boolean) = with(Community) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        SiteButton("Edit ${item.s("kind")}", Modifier.heightIn(min = 44.dp), ghost = true, small = true) { own.source(item) }
        if (!picker) {
            Text("Update shared copy", style = Site.Button.copy(fontSize = 13.sp, color = Site.Gold), modifier = Modifier.heightIn(min = 44.dp).clickable { own.preview(item.s("key")) }.padding(vertical = 12.dp))
            Text("Hide", style = Site.Button.copy(fontSize = 13.sp, color = Site.Gold), modifier = Modifier.heightIn(min = 44.dp).clickable { own.hide(item.s("key")) }.padding(vertical = 12.dp))
        }
    }
}

/**
 * chooseShare: what it shares and keeps private, Binders / Decks, the search (shareResults: title and game name), then each of this device's
 * binders or decks (itemTile with picker: the tile previews it, Edit binder / deck), or "No matching …".
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChooseShare(kind: String, choices: List<JsonObject>?, onLoad: () -> Unit, onKind: (String) -> Unit, onPreview: (JsonObject) -> Unit, onSource: (JsonObject) -> Unit) = with(Community) {
    LaunchedEffect(Unit) { if (choices == null) onLoad() }
    var query by remember { mutableStateOf("") }
    Text("Choose an existing binder or deck, then preview before sharing. Public reference totals are shown for binders. Purchase costs and private notes stay private.",
        style = Site.Meta.copy(fontSize = 13.sp))
    Row(Modifier.fillMaxWidth().padding(vertical = 14.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for (k in listOf("binder", "deck")) {
            val sel = k == kind
            Box(Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(9.dp)).background(if (sel) Site.Surface else Color.Transparent).clickable { onKind(k) }
                .semantics { contentDescription = if (k == "binder") "Binders" else "Decks" }, contentAlignment = Alignment.Center) {
                Text(if (k == "binder") "Binders" else "Decks", style = Site.Meta.copy(color = if (sel) Site.Text else Site.Muted, fontWeight = FontWeight.SemiBold))
            }
        }
    }
    Text("Search your binders or decks", style = Site.Label.copy(color = Site.Text, fontWeight = FontWeight.SemiBold))
    Box(Modifier.padding(top = 6.dp, bottom = 16.dp).fillMaxWidth().heightIn(min = 46.dp).clip(RoundedCornerShape(12.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
        contentAlignment = Alignment.CenterStart) {
        androidx.compose.foundation.text.BasicTextField(query, { query = it.take(120) }, singleLine = true, textStyle = Site.Body.copy(color = Site.Text),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(Site.Gold), modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner -> if (query.isEmpty()) Text("Name or game…", style = Site.Body.copy(color = Site.Muted)); inner() })
    }
    if (choices == null) { Text("Loading your binders and decks…", style = Site.Meta); return@with }
    val q = query.lowercase()
    val shown = choices.filter { it.s("kind") == kind && "${it.s("title")} ${GAME_NAME[it.s("game")] ?: ""}".lowercase().contains(q) }
    if (shown.isEmpty()) { Text("No matching ${if (kind == "binder") "binders" else "decks"}. Create and edit them in Collection or Decks, then choose what to share here.", style = Site.Meta.copy(fontSize = 13.sp)); return@with }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val cols = maxOf(2, (maxWidth / 170.dp).toInt())
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(14.dp), maxItemsInEachRow = cols) {
            for (item in shown) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ShowcaseTile(item) { onPreview(item) }
                SiteButton("Edit ${item.s("kind")}", Modifier.heightIn(min = 44.dp), ghost = true, small = true) { onSource(item) }
            }
            repeat((cols - shown.size % cols) % cols) { Spacer(Modifier.weight(1f)) }
        }
    }
}

/** games.js GAMES[g].name, for the picker's search. */
private val GAME_NAME = mapOf("mtg" to "Magic: The Gathering", "ptcg" to "Pokémon TCG", "ygo" to "Yu-Gi-Oh!")
private val GAME_SHORT = mapOf("mtg" to "Magic", "ptcg" to "Pokémon", "ygo" to "Yu-Gi-Oh!")
private fun JsonObject.cards() = getAsJsonArray("cards")?.mapNotNull { it as? JsonObject }.orEmpty()
private fun JsonObject.count() = cards().sumOf { c -> c.get("qty")?.takeIf { it.isJsonPrimitive }?.asInt ?: 1 }

/** itemTile: the binder's cover or the deck's tile (its first cover picture, the shade, the format chip, the name and "Game · N cards"). */
@Composable
private fun ShowcaseTile(item: JsonObject, onClick: () -> Unit) = with(Community) {
    val cover = item.getAsJsonObject("appearance")?.getAsJsonArray("cover")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
    val image = cover.firstOrNull() ?: item.cards().firstNotNullOfOrNull { it.s("image").ifBlank { null } }
    val color = item.getAsJsonObject("appearance")?.s("color")?.takeIf { Regex("^#[0-9a-fA-F]{6}$").matches(it) }?.let { Color(android.graphics.Color.parseColor(it)) } ?: Color(0xFF7664A0)
    val shape = RoundedCornerShape(16.dp)
    Box(Modifier.fillMaxWidth().height(if (item.s("kind") == "binder") 200.dp else 180.dp).clip(shape).background(Brush.verticalGradient(listOf(color.copy(alpha = .55f), Site.Surface2)))
        .border(1.dp, Site.GlassLine, shape).clickable(onClick = onClick).semantics { contentDescription = "Open ${item.s("title")}" }) {
        if (image != null) coil3.compose.AsyncImage(image, null, imageLoader = CardArt.loader, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = androidx.compose.ui.BiasAlignment(0f, -.5f))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.35f to Color.Transparent, 1f to Color(0xE6101218))))
        Text(item.s("format").ifBlank { GAME_SHORT[item.s("game")] ?: "" }, style = Site.Label.copy(color = Color(0xFFF4F6FB)),
            modifier = Modifier.padding(10.dp).clip(RoundedCornerShape(999.dp)).background(Color(0x99101318)).padding(horizontal = 9.dp, vertical = 4.dp))
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(item.s("title"), style = Site.Body.copy(fontWeight = FontWeight.Bold, color = Color(0xFFF4F6FB)), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("${GAME_SHORT[item.s("game")] ?: ""} · ${item.count()} cards", style = Site.Label.copy(color = Color(0xFFD0D8E6)))
        }
    }
}

/**
 * showcaseDetail: "Game · format · N cards · Read-only shared binder/deck", a binder's known reference subtotal, the commander,
 * every card (its picture, name, ×qty · #number · version · zone).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShowcaseDetail(item: JsonObject) = with(Community) {
    val cards = item.cards(); val count = item.count()
    Text(listOfNotNull(GAME_SHORT[item.s("game")], item.s("format").ifBlank { null }, "$count cards", "Read-only shared ${item.s("kind")}").joinToString(" · "), style = Site.Meta.copy(fontSize = 13.sp))
    if (item.s("kind") == "binder") {
        var total = 0.0; var priced = 0; var unpriced = 0
        for (c in cards) { val q = c.get("qty")?.takeIf { it.isJsonPrimitive }?.asInt ?: 1; val r = c.get("referenceUSD"); if (r == null || r.isJsonNull) unpriced += q else { total += r.asDouble * q; priced += q } }
        Column(Modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(if (priced > 0) java.text.NumberFormat.getCurrencyInstance(java.util.Locale.US).format(total) else "Value unavailable", style = Site.CardTitle.copy(fontWeight = FontWeight.Bold))
            Text("Known reference subtotal" + if (unpriced > 0) " · $unpriced unpriced" else "", style = Site.Meta)
            Text("Public reference prices when shared; condition and edition may differ.", style = Site.Label)
        }
    }
    if (item.s("commander").isNotBlank()) Text("Commander: ${item.s("commander")}", style = Site.Body, modifier = Modifier.padding(vertical = 8.dp))
    BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 10.dp)) {
        val cols = maxOf(2, (maxWidth / 140.dp).toInt())
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp), maxItemsInEachRow = cols) {
            for (c in cards) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                if (c.s("image").isNotBlank()) coil3.compose.AsyncImage(c.s("image"), null, imageLoader = CardArt.loader, modifier = Modifier.fillMaxWidth().height(200.dp), contentScale = ContentScale.Fit)
                Text(c.s("name"), style = Site.Label.copy(color = Site.Text, fontWeight = FontWeight.Bold))
                Text(buildString { append("×${c.get("qty")?.takeIf { it.isJsonPrimitive }?.asInt ?: 1}"); if (c.s("number").isNotBlank()) append(" · #${c.s("number")}")
                    if (c.s("version").isNotBlank()) append(" · ${c.s("version")}"); if (item.s("kind") == "deck" && c.s("zone").isNotBlank() && c.s("zone") != "main") append(" · ${c.s("zone")}") }, style = Site.Label)
            }
            repeat((cols - cards.size % cols) % cols) { Spacer(Modifier.weight(1f)) }
        }
    }
}

/** What the community pop-up has open over Settings: the pop-up's view, a friend's shared deck sheet, the card pages opened from it. */
@androidx.compose.runtime.Stable
internal class CommunityLayerState {
    var view by mutableStateOf<CommunityView?>(null)
    /** Edit profile pressed in the pop-up: the account panel opens its editor (app.js editProfile). */
    var editProfile by mutableStateOf(0)
    var deck by mutableStateOf<MetaDeckSheetModel?>(null)
    var cards by mutableStateOf(listOf<CardOpen>())
    /** The shared binder a card page was opened from: it opens again when the page closes. */
    var parked: CollectionWrites.BinderOpen? = null
}

/**
 * The pop-up (CommunitySheet), then what app.js openSharedShowcase opens over it: a binder in the binder sheet (showBinder with
 * sharedItem, read-only), a deck in the proven deck sheet (sharedDeckSheet, Save to my decks); a card from either opens its page (A.sharedCard).
 */
@Composable
internal fun CommunityLayer(s: CommunityLayerState, onHeader: () -> Unit, onChallenge: ((JsonObject) -> Unit)?, web: (url: String, press: String?) -> Unit,
                            onDeck: ((game: String, id: String) -> Unit)? = null) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    fun toast(m: String) = android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_LONG).show()
    fun openCard(game: String, index: String, back: CollectionWrites.BinderOpen?) { scope.launch {
        val a = runCatching { CollectionEngine.act("sharedCard", JsonObject().apply { addProperty("index", index) }, 30_000) }.getOrNull() ?: return@launch
        a.get("error")?.takeIf { it.isJsonPrimitive }?.asString?.let { CollectionWrites.show(it); back?.let { b -> CollectionWrites.binder.value = b }; return@launch }
        val c = a.get("made")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.startsWith("{") }?.let { com.google.gson.JsonParser.parseString(it).asJsonObject } ?: return@launch
        with(Community) {
            s.parked = back
            s.cards = s.cards + (if (game == "mtg") CardOpen(c.s("name"), page = "https://cardstashy.com/#community", tile = "", shared = true)
                else CardOpen("", page = "https://cardstashy.com/#community", tile = "", game = game, id = c.s("id")))
        }
    } }
    fun openItem(item: JsonObject) { scope.launch {
        val game = with(Community) { item.s("game") }.ifBlank { "mtg" }
        if (with(Community) { item.s("kind") } == "binder") {
            CollectionWrites.binder.value = CollectionWrites.BinderOpen(game, with(Community) { item.s("key") }, 0, shared = item,
                card = { _, d, _, back -> openCard(game, d.get("index")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty(), back) })
        } else {
            val m = CollectionWrites.sharedDeckModel(context, item) ?: return@launch
            MetaDeckSheetModel.parse(m)?.let { s.deck = it } ?: m.get("error")?.takeIf { it.isJsonPrimitive }?.asString?.let { toast(it) }
        }
    } }
    androidx.compose.runtime.SideEffect { Community.repair = { items -> CollectionWrites.showcaseRepair(context.applicationContext, items) } }
    s.view?.let { start -> CommunitySheet(start, onClose = { s.view = null }, onEditProfile = { s.view = null; s.editProfile++ }, onHeader = onHeader,
        onChallenge = onChallenge, toast = ::toast, onOpenItem = { openItem(it) },
        // app.js editItem: a binder opens its editor (A.editBinder), a deck its page (#deck/<id>/cards, #tdeck/<id>).
        onSource = { item -> with(Community) {
            val key = item.s("key"); val game = item.s("game").ifBlank { "mtg" }
            if (item.s("kind") == "binder") CollectionWrites.binderEditing.value = CollectionWrites.BinderEditOpen(game, key.removePrefix("binder:"),
                open = { id, p -> CollectionWrites.binder.value = CollectionWrites.BinderOpen(game, id, p) })
            else onDeck?.invoke(game, key.removePrefix("deck:$game:"))
        } }) }
    s.deck?.let { d -> androidx.compose.runtime.key(d) {
        MetaDeckHost("https://cardstashy.com/#community", close = { s.deck = null }, deck = { s.deck = null }, site = { url, _ -> web(url, null) }, web = web, initial = d, standalone = true)
    } }
    s.cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
        CollectionCardHost(c, onClose = { s.cards = emptyList() },
            onOpen = { s.cards = s.cards + it }, web = web, onBack = { s.cards = s.cards.dropLast(1) })
    } }
    LaunchedEffect(s.cards.isEmpty()) { if (s.cards.isEmpty()) s.parked?.let { b -> s.parked = null; CollectionWrites.binder.value = b.copy(id = System.nanoTime()) } }
}
