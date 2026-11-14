package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * The search box's answer card (Randall 13 Nov: one search that answers from the app's own data, no AI), as the approved preview
 * draws it: "Read as" chips for what the words were taken to mean (a format or game chip opens the other choices), the answer in
 * one sentence with its subject in bold, a wiki fact box or a quoted rule, the card / deck / set tiles, the buttons, and where the
 * answer came from. Every word comes from CollectionEngine.searchAnswer (answer-search.js and answer-run.js in the engine).
 */
class AnswerActs(
    /** A tile (its data-ask-show): the card, deck or set it names. */
    val open: (show: JsonObject) -> Unit = {},
    /** A button or a wiki chip: where the engine says it leads ({to, ...}). */
    val go: (dest: JsonObject) -> Unit = {},
    /** A "Read as" chip's other choice: the same words asked again with it. */
    val fix: (kind: String, choice: String) -> Unit = { _, _ -> },
    /** An "Ask more" chip: its question goes in the box and is answered about the same deck or card. */
    val ask: (q: String) -> Unit = {},
)

private val AnsInk = Color(0xFFEEF0F4)
private val AnsMute = Color(0xFF9AA2B1)
private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.list(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.filter { it.isJsonObject }?.map { it.asJsonObject }.orEmpty()
private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.filter { it.isJsonPrimitive }?.map { it.asString }.orEmpty()

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun AnswerCard(m: JsonObject, act: AnswerActs, modifier: Modifier = Modifier) {
    val gold = LocalGameGold.current
    val a = m.o("answer")
    var fixing by remember(m.s("q")) { mutableStateOf<String?>(null) }
    val shape = RoundedCornerShape(20.dp)
    val pill = RoundedCornerShape(999.dp)
    Column(modifier.fillMaxWidth().clip(shape).background(Brush.linearGradient(listOf(Color(0xFF1D1F29), Color(0xFF12141B))))
        .border(1.dp, gold.copy(alpha = .45f), shape).padding(14.dp).semantics { contentDescription = "Answer" }, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val read = m.list("read")
        if (read.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text("READ AS", style = cssType(10.5f, 800, 14f, AnsMute, .8f))
            read.forEach { c ->
                val can = c.strs("choices").isNotEmpty(); val kind = c.s("kind")
                Text(c.s("label") + if (can) " ▾" else "", Modifier.clip(pill).background(if (can) gold.copy(alpha = .12f) else Color(0x0FFFFFFF))
                    .border(1.dp, if (can) gold.copy(alpha = .5f) else Color(0x1FFFFFFF), pill)
                    .then(if (can) Modifier.clickable { fixing = if (fixing == kind) null else kind }.semantics { role = Role.Button; contentDescription = "Change ${c.s("label")}" } else Modifier)
                    .padding(horizontal = 10.dp, vertical = 5.dp), style = cssType(12.5f, 700, 16f, if (can) gold else AnsInk))
            }
        }
        fixing?.let { kind ->
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                read.firstOrNull { it.s("kind") == kind }?.strs("choices").orEmpty().forEach { choice -> AskPill(choice, true, small = true) { fixing = null; act.fix(kind, choice) } }
            }
        }
        if (a == null) { Text("Looking…", style = cssType(15f, 600, 22f, AnsMute)); return@Column }
        val ask = a.o("ask")
        if (ask != null) {
            Text(ask.s("ask"), style = cssType(16f, 700, 23f, AnsInk))
            val choices = ask.list("choices")
            if (choices.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                choices.forEach { c -> AskPill(c.s("label"), true, small = true) { c.o("show")?.let(act.open) } }
            }
            return@Column
        }
        if (a.get("ok")?.asBoolean != true) {
            Text(a.s("miss"), style = cssType(15f, 600, 22f, AnsInk))
            a.list("items").forEach { AskTile(it, act.open) }
            Text("Here is the closest the app has.", style = cssType(12f, 400, 16f, AnsMute))
            return@Column
        }
        val bold = SpanStyle(fontWeight = FontWeight.ExtraBold, color = Color.White)
        Text(buildAnnotatedString {
            if (a.get("wiki")?.asBoolean == true) { append(a.s("say")); append(" "); withStyle(bold) { append(a.s("strong")) }; append(":") }
            else { if (a.s("strong").isNotEmpty()) { withStyle(bold) { append(a.s("strong")) }; if (!a.s("say").startsWith(":")) append(" ") }; append(a.s("say")) }
        }, style = cssType(16f, 500, 23f, AnsInk))
        a.o("fact")?.let { f ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(gold.copy(alpha = .10f)).border(1.dp, gold.copy(alpha = .35f), RoundedCornerShape(14.dp)).padding(horizontal = 12.dp, vertical = 9.dp)) {
                Text(f.s("label").uppercase(), style = cssType(10.5f, 800, 14f, gold, .8f))
                Text(f.s("value"), style = cssType(18f, 800, 24f, Color.White))
            }
        }
        if (a.s("quote").isNotEmpty()) Text(a.s("quote"), Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x0DFFFFFF)).padding(horizontal = 12.dp, vertical = 9.dp),
            style = cssType(13.5f, 400, 20f, AnsInk))
        a.o("meter")?.let { mt ->
            Box(Modifier.fillMaxWidth().height(8.dp).clip(pill).background(Color(0x14FFFFFF)).semantics { contentDescription = mt.s("label") }) {
                Box(Modifier.fillMaxWidth((mt.get("pct")?.asFloat ?: 0f).coerceIn(0f, 100f) / 100f).height(8.dp).clip(pill).background(gold))
            }
        }
        if (a.s("note").isNotEmpty()) Text(a.s("note"), style = cssType(12.5f, 400, 18f, AnsMute))
        // .answer-rows: a deck's cards, the cards that break a format, price moves. The name on the left, its fact on the right.
        a.list("rows").forEach { r ->
            val rs = RoundedCornerShape(10.dp)
            Row(Modifier.fillMaxWidth().clip(rs).background(Color(0x0AFFFFFF)).border(1.dp, Color(0x1FFFFFFF), rs).padding(horizontal = 10.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(r.s("label"), Modifier.weight(1f), style = cssType(13.5f, 700, 18f, AnsInk))
                Text(r.s("value"), style = cssType(13f, 400, 18f, when (r.s("tone")) { "bad" -> Color(0xFFF0A261); "good" -> Color(0xFF7FD1A0); "warn" -> Color(0xFFE6C873); else -> AnsMute }),
                    textAlign = androidx.compose.ui.text.style.TextAlign.End)
            }
        }
        a.list("items").forEach { AskTile(it, act.open) }
        val buttons = a.list("buttons")
        if (buttons.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            buttons.forEachIndexed { i, b ->
                val first = i == 0; val r = RoundedCornerShape(12.dp)
                Text(b.s("label"), Modifier.heightIn(min = 44.dp).clip(r)
                    .then(if (first) Modifier.background(Brush.verticalGradient(listOf(Color(0xFFF2D496), Color(0xFFA67C34)))) else Modifier.background(Color(0xFF1F232B)).border(1.dp, Color(0xFF2A2F39), r))
                    .clickable { b.o("dest")?.let(act.go) }.semantics { role = Role.Button }.padding(horizontal = 14.dp, vertical = 12.dp),
                    style = cssType(14f, 800, 20f, if (first) Color(0xFF1A1408) else AnsInk))
            }
        }
        // .answer-follow: what people ask next about this deck or card, each one tap away.
        val follow = a.list("follow")
        if (follow.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text("ASK MORE", style = cssType(10.5f, 800, 14f, AnsMute, .8f))
            follow.forEach { f ->
                Text(f.s("label"), Modifier.clip(pill).background(gold.copy(alpha = .09f)).border(1.dp, gold.copy(alpha = .45f), pill)
                    .clickable { act.ask(f.s("q")) }.semantics { role = Role.Button }.padding(horizontal = 11.dp, vertical = 8.dp), style = cssType(12.5f, 700, 16f, AnsInk))
            }
        }
        if (a.s("source").isNotEmpty()) Text(a.s("source"), style = cssType(11.5f, 400, 16f, AnsMute))
        val more = a.list("more")
        if (more.isNotEmpty()) {
            Text(a.s("moreLabel").uppercase(), style = cssType(10.5f, 800, 14f, AnsMute, .8f))
            more.forEach { AskTile(it, act.open) }
        }
        val others = a.list("others")
        if (others.isNotEmpty()) {
            Text("ALSO ON THE WIKI", style = cssType(10.5f, 800, 14f, AnsMute, .8f))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                others.forEach { o -> AskPill(o.s("label"), true, small = true) { o.o("dest")?.let(act.go) } }
            }
        }
    }
}

/** Where the answer card's taps lead from the page that shows it. */
internal class AnswerEnv(
    val game: String, val page: String, val card: (CardOpen) -> Unit, val sets: (String) -> Unit, val set: (game: String, code: String) -> Unit,
    val wiki: ((game: String, topic: String) -> Unit)?, val web: (url: String, press: String?) -> Unit,
    /** "See them all in Search": the Search tab on these words and this sort (usd, usdAsc or blank). */
    val search: (game: String, q: String, sort: String) -> Unit,
    /** A Yu-Gi-Oh! / Pokémon artist or chip search (A.ruleCards). */
    val discover: (game: String, kind: String, value: String) -> Unit,
    val play: (() -> Unit)? = null, val cards: (() -> Unit)? = null, val decks: (() -> Unit)? = null, val rules: ((String) -> Unit)? = null,
)

private const val ANSWER_SITE = "https://cardstashy.com/"

/** A tile: the site's tools.open in the engine says where it leads; a tournament deck or a deck opens the app's own sheet or page. */
internal fun answerShow(scope: CoroutineScope, show: JsonObject, e: AnswerEnv) {
    scope.launch {
        val d = runCatching { CollectionEngine.askShow(show) }.getOrNull() ?: return@launch
        if (d.s("to") == "help") { e.web(ANSWER_SITE + "#settings", null); return@launch }
        askTo(d, CollectionWrites.AskOpen(show.s("game").ifBlank { e.game }, go = { x -> answerRoute(x, e) }, web = e.web))
    }
}

/** A {to: route} the app has its own page for, else the tile's usual place (askGo). */
private fun answerRoute(d: JsonObject, e: AnswerEnv) {
    val g = d.s("game").ifBlank { e.game }; val h = d.s("hash")
    if (d.s("to") != "route") { askGo(d, e.page, e.card, e.sets, e.set, e.wiki, e.web); return }
    when {
        h == "#play" && e.play != null -> e.play.invoke()
        h == "#collection" && e.cards != null -> e.cards.invoke()
        h == "#decks" && e.decks != null -> e.decks.invoke()
        h == "#rules" && e.rules != null -> e.rules.invoke(g)
        h == "#sets" -> e.sets(g)
        h.startsWith("#set/") -> e.set(g, android.net.Uri.decode(h.removePrefix("#set/")))
        h.startsWith("#wiki") && e.wiki != null -> e.wiki.invoke(g, android.net.Uri.decode(h.removePrefix("#wiki").removePrefix("/")))
        h.isNotBlank() -> e.web(ANSWER_SITE + h, null)
    }
}

/** A button or wiki chip ({to: show | wiki | search | discover | judge | route}). */
internal fun answerGo(scope: CoroutineScope, d: JsonObject, e: AnswerEnv) {
    val g = d.s("game").ifBlank { e.game }
    when (d.s("to")) {
        "show" -> d.o("show")?.let { answerShow(scope, it, e) }
        "wiki" -> e.wiki?.invoke(g, d.s("topic")) ?: e.web(ANSWER_SITE + "#wiki/" + android.net.Uri.encode(d.s("topic")), null)
        "search" -> e.search(g, d.s("q"), d.s("sort"))
        "discover" -> e.discover(g, d.s("kind"), d.s("value"))
        // The question goes with it: the Judge opens already answering (judge-search.js, no AI).
        "judge" -> CollectionWrites.judge(JsonObject().apply { addProperty("game", g); addProperty("question", d.s("text")) }.toString(), g)
        // A typed deck request: the app's Build a deck, set up from the words (format, budget, colours, theme).
        "build" -> d.o("request")?.let { CollectionWrites.building.value = CollectionWrites.BuildOpen(it, "openDeckFlow", e.web) }
        "route" -> answerRoute(d, e)
    }
}
