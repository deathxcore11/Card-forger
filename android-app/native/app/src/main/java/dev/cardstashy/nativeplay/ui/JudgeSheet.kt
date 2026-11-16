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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
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
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Ask a Judge, no AI (judge-ui.js on the site; judge-search.js in the Collection engine): the head ("<Game> rulebook · offline",
 * "Ask a Judge", New); an empty chat's greeting, the card it is about and the game's starter questions (a tap asks it); then the
 * chat: your line, and each answer as the rulebook's own words: what the question was read as, the rule that covers it in a gold
 * frame with its number, the rules that go with it, any card named (its text and matching official rulings), the rulebook's
 * definition of the terms, and the edition. A rule opens on the app's Rules page. Nothing is sent to an AI service and no account is
 * needed. A two-screen handheld keeps the chat on the bottom screen and shows the newest answer's rules on the top one.
 */
@Composable
internal fun JudgeSheet(o: CollectionWrites.JudgeOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var model by remember { mutableStateOf<JsonObject?>(null) }
    var typed by remember { mutableStateOf("") }
    var leaving by remember { mutableStateOf(false) }
    suspend fun runOut() { model = CollectionEngine.judgeWait { m -> model = m } }
    LaunchedEffect(o.id) {
        if (!CollectionReady.ready(context)) { onClose(); return@LaunchedEffect }
        model = CollectionEngine.judgeOpen(o.context)
        if (model?.get("busy")?.asBoolean == true) runOut()
    }
    DisposableEffect(o.id) { onDispose { if (!leaving) CoroutineScope(Dispatchers.Default).launch { runCatching { CollectionEngine.judgeClose() } } } }
    val m = model ?: return
    val busy = m.get("busy")?.asBoolean == true
    fun send(text: String) {
        val q = text.trim().take(400); if (q.isEmpty() || busy) return
        scope.launch { typed = ""; val next = CollectionEngine.judgeSend(q); model = next; if (next.get("busy")?.asBoolean == true) runOut() }
    }
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
        if (lines.isEmpty() && !busy) JudgeEmpty(m, !busy, ::send, ::dropCards)
        else Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            lines.forEach { l -> JudgeLine(l, busy, ::cite, ::send) }
            if (busy) AiBubble {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    BrandMark(30.dp)
                    Text("Reading the rulebook…", style = cssType(13.5f, 600, 19f, JudgeMute))
                }
            }
        }
        Spacer(Modifier.height(1.dp).bringIntoViewRequester(end))
    }
    val bar: @Composable () -> Unit = {
        AskBar(typed, { typed = it.take(400) }, m.s("placeholder").ifBlank { "Ask about a rule, keyword or card…" }, enabled = !busy) { send(typed) }
    }
    SiteSheet(m.s("title").ifBlank { "Ask a Judge" }, backdrop, onClose = onClose, eyebrow = m.s("eyebrow"),
        lead = { Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(Site.Gold), contentAlignment = Alignment.Center) { Text("J", style = cssType(19f, 800, 22f, Color(0xFF1B1406))) } },
        action = { AskNew(enabled = !busy) { restart() } },
        foot = if (two) null else bar) { _ ->
        if (two) JudgeCited(lines, ::cite) else chat()
    }
    if (two) BottomScreen {
        Column(Modifier.fillMaxSize().background(Site.Bg).padding(horizontal = 16.dp, vertical = 12.dp)) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), content = chat)
            Spacer(Modifier.height(10.dp)); bar()
        }
    }
    PadScreen(PadActs(y = if (!busy && lines.isNotEmpty()) PadAct("New") { restart() } else null))
}

private val JudgeMute = Color(0xFF9B9CA8)
private val JudgeLineC = Color(0x1FFFFFFF)

/** The empty chat: the greeting, the card it was opened on, and the starter questions (a tap asks it, as the site does). */
@Composable
private fun ColumnScope.JudgeEmpty(m: JsonObject, enabled: Boolean, ask: (String) -> Unit, dropCards: () -> Unit) {
    Spacer(Modifier.height(10.dp))
    Text(m.s("hello"), Modifier.fillMaxWidth(), style = cssType(20f, 750, 27f), textAlign = TextAlign.Center)
    Spacer(Modifier.height(8.dp))
    Text(m.s("blurb"), Modifier.fillMaxWidth(), style = cssType(13f, 400, 19f, JudgeMute), textAlign = TextAlign.Center)
    val cards = m.getAsJsonArray("cards")?.map { it.asJsonObject }.orEmpty()
    if (cards.isNotEmpty()) Column(Modifier.padding(top = 14.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x0CFFFFFF))
        .border(1.dp, JudgeLineC, RoundedCornerShape(14.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("ASKING ABOUT", style = cssType(11f, 800, 14f, JudgeMute, .66f))
        cards.forEach { c -> Text(c.s("name"), style = cssType(14f, 700, 19f)) }
        AskPill("Ask without this card", enabled, small = true) { dropCards() }
    }
    Spacer(Modifier.height(14.dp))
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        m.getAsJsonArray("examples")?.map { it.asString }.orEmpty().forEach { q -> AskPill(q, enabled, Modifier.fillMaxWidth()) { ask(q) } }
    }
}

/** One line: your question (the game's colour), the error line, or an answer in the rulebook's own words. */
@Composable
internal fun JudgeLine(l: JsonObject, busy: Boolean, cite: (JsonObject) -> Unit, ask: (String) -> Unit) {
    val gold = LocalGameGold.current
    when (l.s("who")) {
        "me" -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
            Text(l.s("text"), Modifier.clip(RoundedCornerShape(20.dp, 20.dp, 6.dp, 20.dp)).background(gold).padding(horizontal = 15.dp, vertical = 12.dp),
                style = cssType(14f, 600, 21f, Color(0xFF0D0F14)))
        }
        "error" -> AiBubble(border = Color(0x55F07C7C)) { Text(l.s("text"), style = cssType(14f, 400, 21f, Color(0xFFF6B3B3))) }
        else -> if (l.s("status") == "none") Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0x0CFFFFFF)).border(1.dp, JudgeLineC, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(l.s("missTitle"), style = cssType(18f, 750, 24f))
            Text(l.s("missText"), style = cssType(14f, 400, 20f, JudgeMute))
            l.strings("examples").forEach { q -> AskPill(q, !busy, Modifier.fillMaxWidth()) { ask(q) } }
        } else Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val read = l.strings("read")
            if (read.isNotEmpty()) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Read as", style = cssType(12f, 400, 16f, JudgeMute))
                read.forEach { Text(it, Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0x14FFFFFF)).border(1.dp, JudgeLineC, RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp), style = cssType(12f, 700, 16f)) }
            }
            val cards = l.getAsJsonArray("cards")?.map { it.asJsonObject }.orEmpty()
            if (cards.isNotEmpty()) { JudgeLabel("Cards you named"); cards.forEach { JudgeCard(it) } }
            if (l.s("rulesLabel").isNotEmpty()) JudgeLabel(l.s("rulesLabel"))
            val rules = l.getAsJsonArray("rules")?.map { it.asJsonObject }.orEmpty()
            rules.forEachIndexed { n, r -> if (n == 1 && rules[0].get("lead")?.asBoolean == true) JudgeLabel("Goes with it"); JudgeRule(r, cite) }
            l.getAsJsonArray("terms")?.map { it.asJsonObject }.orEmpty().forEach { t ->
                Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.width(2.dp).fillMaxHeight().background(JudgeGood))
                    Column {
                        Text(t.s("label"), style = cssType(13f, 700, 18f))
                        Text(t.s("def"), style = cssType(13f, 400, 18f, JudgeMute))
                        if (t.get("ours")?.asBoolean == true) Text("CardStashy note", style = cssType(11f, 600, 14f, JudgeGood))
                    }
                }
            }
            Text(l.s("foot"), Modifier.padding(top = 2.dp), style = cssType(12f, 400, 16f, JudgeMute))
        }
    }
}

private val JudgeGood = Color(0xFF6FD29A)

@Composable
private fun JudgeLabel(text: String) = Text(text.uppercase(), Modifier.padding(top = 4.dp, start = 2.dp), style = cssType(11f, 800, 14f, JudgeMute, .99f))

/** One rule: its number in gold and its chapter, the words (a long rule leads with the sentences asked about), and "Open in Rules". The answer's lead rule has the gold frame. */
@Composable
private fun JudgeRule(r: JsonObject, cite: (JsonObject) -> Unit) {
    var whole by remember { mutableStateOf(false) }
    val lead = r.get("lead")?.asBoolean == true
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Site.Surface).border(if (lead) 2.dp else 1.dp, if (lead) Site.Gold else JudgeLineC, RoundedCornerShape(16.dp)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
            Text(r.s("number"), style = cssType(17f, 800, 21f, Site.Gold))
            Text(r.s("heading").uppercase(), Modifier.padding(bottom = 2.dp), style = cssType(11f, 600, 14f, JudgeMute, .77f), maxLines = 1)
        }
        Text(if (whole) r.s("quote") else r.s("text"), style = if (lead) cssType(16f, 400, 23f) else cssType(14f, 400, 21f))
        if (r.s("whole").isNotEmpty()) Text(if (whole) "Show less" else "Read the whole rule", Modifier.clickable { whole = !whole }.padding(vertical = 4.dp), style = cssType(13f, 600, 17f, JudgeMute))
        Text("Open in Rules", Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, JudgeLineC, RoundedCornerShape(999.dp)).clickable { cite(r) }
            .semantics { role = Role.Button; contentDescription = "Open rule " + r.s("title") + " in Rules" }.padding(horizontal = 14.dp, vertical = 8.dp), style = cssType(12.5f, 600, 16f))
    }
}

/** A card named in the question: its printed text and the official rulings that match the words asked. */
@Composable
private fun JudgeCard(c: JsonObject) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).border(1.dp, JudgeLineC, RoundedCornerShape(14.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(c.s("name"), style = cssType(14f, 750, 19f))
        if (c.s("text").isNotEmpty()) Text(c.s("text"), style = cssType(13.5f, 400, 20f, JudgeMute))
        c.getAsJsonArray("rulings")?.map { it.asJsonObject }.orEmpty().forEach { r ->
            Column { Text(r.s("label"), style = cssType(11f, 600, 14f, Site.Gold)); Text(r.s("text"), style = cssType(13.5f, 400, 20f)) }
        }
        if (c.s("note").isNotEmpty()) Text(c.s("note"), style = cssType(12f, 400, 16f, JudgeMute))
    }
}

/** The top screen on a two-screen handheld: the newest answer's rules, large, each opening on the Rules page; before any, the greeting. */
@Composable
internal fun ColumnScope.JudgeCited(lines: List<JsonObject>, cite: (JsonObject) -> Unit) {
    val last = lines.lastOrNull { it.s("who") == "judge" }
    val rules = last?.getAsJsonArray("rules")?.map { it.asJsonObject }.orEmpty()
    if (rules.isEmpty()) {
        Spacer(Modifier.height(24.dp))
        Text(last?.s("missTitle") ?: "Ask on the bottom screen. The exact rules show here.", Modifier.fillMaxWidth(),
            style = cssType(15f, 600, 22f, JudgeMute), textAlign = TextAlign.Center)
        return
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) { rules.take(3).forEach { JudgeRule(it, cite) } }
}

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.strings(k: String) = getAsJsonArray(k)?.mapNotNull { it?.takeIf { e -> e.isJsonPrimitive }?.asString?.takeIf { s -> s.isNotBlank() } }.orEmpty()
