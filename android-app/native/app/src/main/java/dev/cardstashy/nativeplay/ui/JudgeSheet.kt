package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Ask a Judge (gap audit H4; app.js A.askRules, ai-rules.js openRulesAsk), as the gap-screens preview's tab draws it: the head with the
 * orb, "AI rules guide · <game>", "Ask a Judge" and New; the format as a sideways row of chips (the bar waits, with the site's words,
 * until one is chosen); an empty chat's greeting, the card it is about, and the game's three starter questions; then the chat: your
 * line, "Reading the indexed rules…", each checked answer (its label, short answer, explanation, example, the questions it needs
 * answered, why and exceptions, and its citations as tiles that open that exact rule on the app's Rules page), or the error line. Every
 * word, the request and the site's check of each answer are ai-rules.js's own, run in the Collection engine (CollectionEngine.judge*).
 * A two-screen handheld keeps the chat on the bottom screen and shows the newest answer's cited rules on the top one.
 */
@Composable
internal fun JudgeSheet(o: CollectionWrites.JudgeOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var model by remember { mutableStateOf<JsonObject?>(null) }
    var typed by remember { mutableStateOf("") }
    var leaving by remember { mutableStateOf(false) }
    suspend fun signIn() { CollectionEngine.auth(if (Account.session.value != null) Account.token() else null) }
    suspend fun runOut() { model = CollectionEngine.judgeWait { m -> model = m } }
    LaunchedEffect(o.id) {
        if (!CollectionReady.ready(context)) { onClose(); return@LaunchedEffect }
        signIn()
        model = CollectionEngine.judgeOpen(o.context)
        if (model?.get("busy")?.asBoolean == true) runOut()
    }
    // Leaving: ai-rules.js closeRulesAsk (an answer still coming in is kept for when this chat opens again, never asked twice).
    DisposableEffect(o.id) { onDispose { if (!leaving) CoroutineScope(Dispatchers.Default).launch { runCatching { CollectionEngine.judgeClose() } } } }
    val m = model ?: return
    val busy = m.get("busy")?.asBoolean == true
    fun send(text: String) {
        val q = text.trim().take(1200); if (q.isEmpty() || busy) return
        scope.launch {
            signIn(); val next = CollectionEngine.judgeSend(q); model = next
            // The site keeps the question in the bar when no format is chosen yet ("Your question is still here").
            if (next.get("busy")?.asBoolean == true) { typed = ""; runOut() }
        }
    }
    fun format(f: String) { if (!busy) scope.launch { model = CollectionEngine.judgeFormat(f) } }
    fun restart() { if (!busy) scope.launch { typed = ""; model = CollectionEngine.judgeNew() } }
    fun dropCards() { if (!busy) scope.launch { model = CollectionEngine.judgeDropCards() } }
    fun cite(c: JsonObject) {
        val ref = c.getAsJsonObject("reference") ?: return
        leaving = true; onClose()
        CollectionWrites.ruleRef?.invoke(ref.s("game").ifBlank { m.s("game") }, ref, c.s("title"), c.s("quote"))
    }
    val lines = m.getAsJsonArray("lines")?.map { it.asJsonObject }.orEmpty()
    val end = remember { BringIntoViewRequester() }
    LaunchedEffect(lines.size, busy) { runCatching { end.bringIntoView() } }
    val two = DualScreen.active
    val chat: @Composable ColumnScope.() -> Unit = {
        if (lines.isEmpty() && !busy) JudgeEmpty(m, !busy, { typed = it }, ::dropCards)
        else Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            lines.forEach { l -> JudgeLine(l, busy, ::cite, ::dropCards) }
            if (busy) AiBubble {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    BrandMark(30.dp)
                    Column {
                        Text(m.s("thinking").ifBlank { "Reading the indexed rules…" }, style = cssType(13.5f, 600, 19f, JudgeMute))
                        Text("No automatic retries.", style = cssType(12f, 400, 16f, JudgeMute))
                    }
                }
            }
        }
        Spacer(Modifier.height(1.dp).bringIntoViewRequester(end))
    }
    val bar: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (m.s("status").isNotEmpty() && !busy) Text(m.s("status"), style = cssType(12.5f, 600, 17f, Site.Gold))
            AskBar(typed, { typed = it.take(1200) }, m.s("placeholder").ifBlank { "Describe the rule or situation…" }, enabled = !busy) { send(typed) }
        }
    }
    val chips: @Composable () -> Unit = { JudgeFormats(m, !busy, ::format) }
    SiteSheet(m.s("title").ifBlank { "Ask a Judge" }, backdrop, onClose = onClose, eyebrow = m.s("eyebrow"),
        lead = { Box(Modifier.size(38.dp).clip(CircleShape).background(Color(0x1AD6AD64)), contentAlignment = Alignment.Center) { BrandMark(30.dp) } },
        action = { AskNew(enabled = !busy) { restart() } },
        foot = if (two) null else bar) { _ ->
        if (two) JudgeCited(lines, ::cite) else { chips(); Spacer(Modifier.height(12.dp)); chat() }
    }
    if (two) BottomScreen {
        Column(Modifier.fillMaxSize().background(Site.Bg).padding(horizontal = 16.dp, vertical = 12.dp)) {
            chips(); Spacer(Modifier.height(10.dp))
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), content = chat)
            Spacer(Modifier.height(10.dp)); bar()
        }
    }
    PadScreen(PadActs(y = if (!busy && lines.isNotEmpty()) PadAct("New") { restart() } else null))
}

private val JudgeMute = Color(0xFF9B9CA8)
private val JudgeLineC = Color(0x1FFFFFFF)

/** .rules-ai-format-bar: "Format" and the game's formats as chips in one sideways row (the site's select); the hint until one is chosen. */
@Composable
private fun JudgeFormats(m: JsonObject, enabled: Boolean, pick: (String) -> Unit) {
    val now = m.s("format")
    val gold = LocalGameGold.current
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(m.s("formatLabel").ifBlank { "Format" }.uppercase(), style = cssType(11f, 800, 14f, JudgeMute, .66f))
            m.getAsJsonArray("formats")?.map { it.asJsonObject }.orEmpty().forEach { f ->
                val on = f.s("value") == now
                Text(f.s("label"), Modifier.clip(RoundedCornerShape(999.dp)).background(if (on) gold else Color(0x0CFFFFFF))
                    .border(1.dp, if (on) gold else JudgeLineC, RoundedCornerShape(999.dp))
                    .clickable(enabled = enabled && !on) { pick(f.s("value")) }.semantics { role = Role.Button; selected = on }
                    .padding(horizontal = 12.dp, vertical = 7.dp), style = cssType(13f, 700, 17f, if (on) Color(0xFF0D0F14) else Color.Unspecified))
            }
        }
        if (m.s("formatHint").isNotEmpty()) Text(m.s("formatHint"), style = cssType(12f, 400, 16f, JudgeMute))
    }
}

/** .ask-empty: the greeting, the selected card's context, the three starter questions (a tap puts it in the bar, as the site does), the foot. */
@Composable
private fun ColumnScope.JudgeEmpty(m: JsonObject, enabled: Boolean, fill: (String) -> Unit, dropCards: () -> Unit) {
    Spacer(Modifier.height(10.dp))
    Text(m.s("hello"), Modifier.fillMaxWidth(), style = cssType(20f, 750, 27f), textAlign = TextAlign.Center)
    Spacer(Modifier.height(8.dp))
    Text(m.s("blurb"), Modifier.fillMaxWidth(), style = cssType(13f, 400, 19f, JudgeMute), textAlign = TextAlign.Center)
    val cards = m.getAsJsonArray("cards")?.map { it.asJsonObject }.orEmpty()
    if (cards.isNotEmpty()) Column(Modifier.padding(top = 14.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x0CFFFFFF))
        .border(1.dp, JudgeLineC, RoundedCornerShape(14.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("SELECTED CARD CONTEXT", style = cssType(11f, 800, 14f, JudgeMute, .66f))
        cards.forEach { c -> Text(c.s("name"), style = cssType(14f, 700, 19f)); if (c.s("line").isNotEmpty()) Text(c.s("line"), style = cssType(12f, 400, 16f, JudgeMute)) }
        if (m.s("cardsNote").isNotEmpty()) Text(m.s("cardsNote"), style = cssType(12f, 400, 16f, JudgeMute))
        if (m.get("dropCards")?.asBoolean == true) AskPill("Ask without selected card", enabled, small = true) { dropCards() }
    }
    Spacer(Modifier.height(14.dp))
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        m.getAsJsonArray("examples")?.map { it.asString }.orEmpty().forEach { q -> AskPill(q, enabled, Modifier.fillMaxWidth()) { fill(q) } }
    }
    Spacer(Modifier.height(12.dp))
    m.getAsJsonArray("foot")?.map { it.asString }.orEmpty().filter { it.isNotBlank() }.forEach { Text(it, Modifier.padding(top = 4.dp), style = cssType(12f, 400, 16f, JudgeMute)) }
}

/** One line: your question (the game's colour), the error line, or a checked answer (rulesAnswerHtml). */
@Composable
internal fun JudgeLine(l: JsonObject, busy: Boolean, cite: (JsonObject) -> Unit, dropCards: () -> Unit) {
    val gold = LocalGameGold.current
    when (l.s("who")) {
        "me" -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
            Text(l.s("text"), Modifier.clip(RoundedCornerShape(20.dp, 20.dp, 6.dp, 20.dp)).background(gold).padding(horizontal = 15.dp, vertical = 12.dp),
                style = cssType(14f, 600, 21f, Color(0xFF0D0F14)))
        }
        "error" -> AiBubble(border = Color(0x55F07C7C)) {
            Text(l.s("text"), style = cssType(14f, 400, 21f, Color(0xFFF6B3B3)))
            if (l.s("foot").isNotEmpty()) Text(l.s("foot"), Modifier.padding(top = 6.dp), style = cssType(12f, 400, 16f, JudgeMute))
        }
        else -> AiBubble {
            val (fg, bg) = if (l.s("status") == "answered") Color(0xFF6FD3A0) to Color(0x246FD3A0) else Color(0xFFF4BF58) to Color(0x18F4BF58)
            Text(l.s("source").uppercase(), Modifier.clip(RoundedCornerShape(999.dp)).background(bg).padding(horizontal = 8.dp, vertical = 3.dp), style = cssType(11f, 800, 13f, fg, .66f))
            Spacer(Modifier.height(6.dp))
            Text(l.s("short"), style = cssType(15f, 700, 22f))
            l.strings("explanation").forEach { Text(it, Modifier.padding(top = 6.dp), style = cssType(14f, 400, 21f)) }
            if (l.s("example").isNotEmpty()) Column(Modifier.padding(top = 8.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x0CFFFFFF)).padding(10.dp)) {
                Text("FOR EXAMPLE", style = cssType(11f, 800, 14f, JudgeMute, .66f)); Text(l.s("example"), style = cssType(13.5f, 400, 20f))
            }
            l.strings("questions").forEach { Text("• $it", Modifier.padding(top = 6.dp), style = cssType(14f, 600, 20f)) }
            val details = l.strings("details")
            if (details.isNotEmpty()) JudgeFold("Why, timing & exceptions") { details.forEach { Text(it, Modifier.padding(top = 4.dp), style = cssType(13.5f, 400, 20f)) } }
            val cites = l.getAsJsonArray("citations")?.map { it.asJsonObject }.orEmpty()
            if (cites.isNotEmpty()) {
                Text("EXACT SOURCES · ${cites.size}", Modifier.padding(top = 10.dp), style = cssType(11f, 800, 14f, JudgeMute, .66f))
                Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { cites.forEach { JudgeCite(it, cite) } }
            }
            l.getAsJsonArray("external")?.map { it.asJsonObject }.orEmpty().forEach { r ->
                AskPill(r.s("label"), !busy, Modifier.padding(top = 8.dp), small = true) { cite(JsonObject().apply { add("reference", r.getAsJsonObject("reference")); addProperty("title", r.s("label")) }) }
            }
            if (l.get("dropCards")?.asBoolean == true) AskPill("Ask without selected card", !busy, Modifier.padding(top = 8.dp), small = true) { dropCards() }
            val limits = l.strings("limits")
            if (limits.isNotEmpty()) JudgeFold("Scope & source dates") { limits.forEach { Text(it, Modifier.padding(top = 4.dp), style = cssType(12.5f, 400, 18f, JudgeMute)) } }
            Text(l.s("disclaimer"), Modifier.padding(top = 8.dp), style = cssType(12f, 400, 16f, JudgeMute))
        }
    }
}

/** .rules-ai-citation: the rule's title, its book and date, "Open exact rule →" (the app's Rules page), and its excerpt to read here. */
@Composable
private fun JudgeCite(c: JsonObject, cite: (JsonObject) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x2A000000)).border(1.dp, Color(0x1CFFFFFF), RoundedCornerShape(14.dp))) {
        Column(Modifier.fillMaxWidth().clickable { cite(c) }.semantics { role = Role.Button; contentDescription = "Open exact rule " + c.s("title") }.padding(10.dp)) {
            Text(c.s("title"), style = cssType(13.5f, 700, 18f), maxLines = 3)
            Text(c.s("source"), style = cssType(12f, 400, 16f, JudgeMute))
            Text("Open exact rule →", Modifier.padding(top = 4.dp), style = cssType(12.5f, 700, 16f, Site.Gold))
        }
        Text(if (open) "Hide cited excerpt" else "Read cited excerpt", Modifier.fillMaxWidth().clickable { open = !open }.padding(horizontal = 10.dp, vertical = 8.dp),
            style = cssType(12.5f, 600, 16f, JudgeMute))
        if (open) Text(c.s("quote"), Modifier.padding(start = 10.dp, end = 10.dp, bottom = 10.dp), style = cssType(13f, 400, 19f))
    }
}

@Composable
private fun JudgeFold(title: String, body: @Composable ColumnScope.() -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.padding(top = 8.dp)) {
        Text((if (open) "▾ " else "▸ ") + title, Modifier.clickable { open = !open }.padding(vertical = 4.dp), style = cssType(12.5f, 700, 16f, JudgeMute))
        if (open) body()
    }
}

/** The top screen on a two-screen handheld: the newest answer's cited rules, large, each opening on the Rules page; before any, the greeting. */
@Composable
internal fun ColumnScope.JudgeCited(lines: List<JsonObject>, cite: (JsonObject) -> Unit) {
    val last = lines.lastOrNull { it.s("who") == "ai" }
    val cites = last?.getAsJsonArray("citations")?.map { it.asJsonObject }.orEmpty()
    if (cites.isEmpty()) {
        Spacer(Modifier.height(24.dp))
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { BrandMark(72.dp) }
        Spacer(Modifier.height(12.dp))
        Text(last?.s("short") ?: "Ask on the bottom screen. The exact rules it cites show here.", Modifier.fillMaxWidth(),
            style = cssType(15f, 600, 22f, JudgeMute), textAlign = TextAlign.Center)
        return
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        cites.take(3).forEach { c ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x14FFFFFF)).clickable { cite(c) }
                .semantics { role = Role.Button; contentDescription = "Open exact rule " + c.s("title") }.padding(14.dp)) {
                Text(c.s("title"), style = cssType(16f, 750, 22f), maxLines = 2)
                Text(c.s("source"), style = cssType(12.5f, 400, 17f, JudgeMute))
                Text(c.s("quote"), Modifier.padding(top = 8.dp), style = cssType(15f, 400, 22f))
                Text("Open exact rule →", Modifier.padding(top = 6.dp), style = cssType(13f, 700, 17f, Site.Gold))
            }
        }
    }
}

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.strings(k: String) = getAsJsonArray(k)?.mapNotNull { it?.takeIf { e -> e.isJsonPrimitive }?.asString?.takeIf { s -> s.isNotBlank() } }.orEmpty()
