package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.StoryLessons
import dev.cardstashy.nativeplay.play.StoryLogic

/** A Play deck offered for a Story battle: its fit for this act (story-client.js ownDeckFits, then Play ownership). */
class StoryOwnDeck(val id: String, val name: String, val art: String?, val count: Int, val fit: StoryLogic.Fit)

/** The duel setup's own choices (the site's ui: deck, seat, list). */
class StoryDuelUi(val deck: String = "loaner", val seat: String = "hero", val listOpen: Boolean = false, val listSide: String = "mine")

private val DECK_LABELS = mapOf("exact" to "Historical Exact", "tribute" to "Historical Tribute", "experimental" to "Experimental")
private val LABEL_LINE = mapOf("exact" to "The original list, card for card.", "tribute" to "Built from this era's cards for the story.", "experimental" to "A deck made for this fight.")
private val cardInk: Color get() = if (AppSettings.theme == "light") Site.Text else Color(0xFFF6EEDB)

private fun JsonObject.str(k: String): String? = get(k)?.takeIf { it.isJsonPrimitive }?.asString
private fun JsonObject.obj(k: String): JsonObject? = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.cards(): List<Pair<String, Int>> = getAsJsonArray("cards")?.map { it.asJsonObject.let { c -> c.str("name").orEmpty() to (c.get("qty")?.asInt ?: 0) } } ?: emptyList()
private val basic = Regex("^(snow-covered )?(plains|island|swamp|mountain|forest)$", RegexOption.IGNORE_CASE)

@Composable
private fun SideCard(who: String, name: String, deckName: String?, face: String?, focusBias: BiasAlignment, you: Boolean, modifier: Modifier) {
    val shape = RoundedCornerShape(20.dp)
    Box(modifier.clip(shape).border(1.dp, if (you) Color(0xAAD6AD64) else Color(0x1FFFFFFF), shape).semantics { contentDescription = "$who $name" }) {
        StoryPic(face, Modifier.matchParentSize(), focusBias)
        Box(Modifier.matchParentSize().background(Color(0xF20C0C0E).let { ink -> Brush.verticalGradient(0f to Color.Transparent, .2f to Color.Transparent, .62f to ink.copy(alpha = .72f), 1f to ink) }))
        Column(Modifier.align(Alignment.BottomStart).padding(16.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(who.uppercase(), style = storyText(11f, FontWeight.ExtraBold, Color(0xFFE8B95B), 2.2f))
            Text(name, style = storyCinzel(22f, Color(0xFFF6EEDB)))
            if (deckName != null) Text(deckName, style = storyText(13f, FontWeight.Medium, Color(0xFFD6DBE2)))
        }
    }
}

@Composable
private fun DeckOpt(name: String, sub: String, art: String?, on: Boolean, ok: Boolean, reason: String, open: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(Modifier.fillMaxWidth().height(86.dp).clip(shape).border(if (on) 2.dp else 1.dp, if (on) Site.Gold else Site.Line, shape).background(Site.Surface)
        .then(if (ok) Modifier.clickable(onClick = onClick) else Modifier).semantics { contentDescription = "$name. $sub" + if (!ok) ". $reason" else "" }) {
        StoryPic(art, Modifier.matchParentSize(), BiasAlignment(0f, -.3f))
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0f to Color(0xF0101216), .75f to Color(0x99101216), 1f to Color(0x30101216))))
        Column(Modifier.align(Alignment.CenterStart).padding(horizontal = 16.dp, vertical = 10.dp).fillMaxWidth(.8f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(name, style = storyCinzel(16f, Color(0xFFF6EEDB)), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(if (ok) sub else reason, style = storyText(12f, FontWeight.Medium, if (ok) Color(0xFFC9D0D8) else Color(0xFFE08C80)), maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        if (!ok) Box(Modifier.matchParentSize().background(Color(0x66000000)))
        if (on && ok) Text(if (open) "▴" else "▾", style = storyText(16f, FontWeight.Bold, Site.Gold), modifier = Modifier.align(Alignment.BottomEnd).padding(14.dp))
    }
}

@Composable
private fun Seg(options: List<Pair<String, String>>, value: String, onPick: (String) -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Row(Modifier.clip(shape).border(1.dp, Site.Line, shape).padding(4.dp)) {
        options.forEach { (k, label) ->
            val on = k == value
            Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp)).then(if (on) Modifier.background(Color(0x2AE6C884)).border(1.dp, Color(0x66D4B77C), RoundedCornerShape(10.dp)) else Modifier)
                .clickable { onPick(k) }.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                Text(label, style = storyText(14f, FontWeight.Bold, if (on) Site.Text else Site.Muted), maxLines = 1) }
        }
    }
}

/** The duel setup (story-ui.js storyBattleMarkup): both sides, what's new, your deck, the prize and Duel. */
@Composable
fun StoryDuelPage(
    act: Int, data: JsonObject, b: JsonObject, p: StoryLogic.Progress, setNames: Map<String, String>, avatarUrl: String?,
    ownDecks: List<StoryOwnDeck>, ui: StoryDuelUi, onUi: (StoryDuelUi) -> Unit, onBack: () -> Unit, onPlay: (seat: String, own: String?) -> Unit,
    listFor: (String) -> List<Pair<String, Int>>? = { null }, purse: @Composable () -> Unit = {},
) {
    val id = b.str("id")!!; val slot = b["slot"].asInt; val rec = p.battles[id] ?: emptySet()
    val villainOpen = StoryLogic.battleCleared(p, id)
    val seat = if (villainOpen && ui.seat == "villain") "villain" else "hero"
    val other = if (seat == "hero") "villain" else "hero"
    val mine = b.obj(seat)!!; val theirs = b.obj(other)!!
    val cast = data.obj("cast")
    fun person(side: String) = cast?.obj(b.obj(side)!!.str("who") ?: "")
    fun faceOf(side: String): Pair<String?, BiasAlignment> =
        if (b.obj(side)!!.str("who") == "you" && !avatarUrl.isNullOrBlank()) avatarUrl to BiasAlignment(0f, 0f)
        else person(side)?.obj("portrait").let { it?.str("crop") to storyFocus(it?.str("focus")) }
    // Playing the other side, the opponent is the hero's deck, never "You" (fix list D1): its deck name is the title.
    val foeIsYou = theirs.str("who") == "you"
    val foeName = if (foeIsYou) theirs.obj("deck")?.str("name") ?: person(other)?.str("name").orEmpty() else person(other)?.str("name").orEmpty()
    val foeDeck = if (foeIsYou) null else theirs.obj("deck")?.str("name")
    val rw = b.obj("reward"); val set = b.str("rewardSet") ?: ""
    val mineDone = if (seat == "villain") "villain" in rec else "loaner" in rec
    // Story gives you its deck (Randall 8 Nov: "just have the deck that the game is wanting to give you"); your own decks come back later.
    val ownPick = false
    val collector = if (slot >= 8 && seat == "hero" && !villainOpen) " + a Collector pack" else ""
    val prize: Pair<String, String> = when {
        ownPick -> "Your deck" to (if (collector.isNotEmpty()) "XP$collector" else "XP only")
        !mineDone -> "Win" to (StoryLogic.rewardText(rw?.obj(seat), set, setNames) + collector)
        seat == "hero" && "villain" !in rec && rw?.obj("villain")?.obj("card") != null -> "Their side" to StoryLogic.rewardText(rw.obj("villain"), set, setNames)
        else -> "Reward claimed" to ""
    }
    val lessonText = StoryLessons.load(androidx.compose.ui.platform.LocalContext.current).map
    val teaches = b.getAsJsonArray("teaches")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }?.filter { it in lessonText }.orEmpty()
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val loanLead = mine.obj("deck")?.cards()?.firstOrNull { !basic.matches(it.first) }
    val loanArt = mine.obj("deck")?.getAsJsonArray("cards")?.map { it.asJsonObject }?.firstOrNull { c -> !basic.matches(c.str("name").orEmpty()) }?.str("id")?.takeIf { it.length == 36 }
        ?.let { "https://cards.scryfall.io/art_crop/front/${it[0]}/${it[1]}/$it.jpg" }
    // A controller's X is the gold Duel (Replay once won) at the foot of the page: the same seat and deck as its tap.
    PadScreen(PadActs(x = PadAct(if (villainOpen) "Replay" else "Duel") { onPlay(seat, null) }))
    // Dual screen (specs/dual-screen-native.md, screen 3): the deck the story gives you on the left, who you face and the prize on the right.
    BottomScreen {
        val deckObj = mine.obj("deck")
        val cards = deckObj?.cards().orEmpty()
        Row(Modifier.fillMaxSize().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(Modifier.weight(1.2f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("YOUR DECK", style = storyText(11f, FontWeight.ExtraBold, Site.Gold, 1.6f))
                Text(deckObj?.str("name").orEmpty(), style = storyCinzel(18f, Color(0xFFF3E7C9)))
                Text("Story deck · ${cards.sumOf { it.second }} cards", style = storyText(13f, FontWeight.Medium, Site.Muted))
                cards.filter { !basic.matches(it.first) }.take(5).forEach { (n, q) -> Text("${q}×  $n", style = storyText(13.5f, FontWeight.SemiBold, Site.Text)) }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("OPPONENT", style = storyText(11f, FontWeight.ExtraBold, Site.Gold, 1.6f))
                Text(foeName, style = storyCinzel(17f, Color(0xFFF3E7C9)))
                foeDeck?.let { Text(it, style = storyText(13f, FontWeight.Medium, Site.Muted)) }
                Spacer(Modifier.weight(1f))
                Text(prize.first.uppercase(), style = storyText(11f, FontWeight.ExtraBold, Site.Gold, 1.6f))
                Text(prize.second, style = storyText(13.5f, FontWeight.Medium, Site.Text))
            }
        }
    }
    LazyColumn(Modifier.fillMaxSize().background(Site.Bg), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = top + 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item("head") { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { PageHeader(b.str("title")!!, "Act $act · " + (if (slot == 8) "Boss" else b.str("kind")), onBack = onBack); purse() } }
        item("stage") {
            val shape = RoundedCornerShape(24.dp)
            Box(Modifier.fillMaxWidth().clip(shape).border(1.dp, Site.Line, shape).background(Color(0xFF0E1016))) {
                StoryPic(person("villain")?.obj("portrait")?.str("crop"), Modifier.matchParentSize().blur(22.dp), BiasAlignment(0f, -.4f))
                Box(Modifier.matchParentSize().background(Color(0x99000000)))
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            val (yf, ya) = faceOf(seat); val (tf, ta) = faceOf(other)
                            SideCard("You play", person(seat)?.str("name") ?: "You", null, yf, ya, true, Modifier.fillMaxWidth().height(150.dp))
                            SideCard("Opponent", foeName, foeDeck, tf, ta, false, Modifier.fillMaxWidth().height(150.dp))
                        }
                        // On the seam at the right, clear of both cards' labels, which sit bottom left (fix list D2).
                        Box(Modifier.align(Alignment.CenterEnd).padding(end = 18.dp).size(44.dp).clip(CircleShape).background(Color(0xEE101216)).border(1.5.dp, Color(0xFFD6AD64), CircleShape), contentAlignment = Alignment.Center) {
                            Text("VS", style = storyCinzel(14f, Color(0xFFE8C36F))) }
                    }
                    Text(b.str("blurb").orEmpty(), style = storyText(15f, FontWeight.Medium, Color(0xFFE4E7EA)))
                }
            }
        }
        b.obj("archive")?.let { a ->
            item("archive") {
                LearnBox("Archive record · ${a.str("when").orEmpty()}") {
                    Text(a.str("what").orEmpty(), style = storyText(14f, FontWeight.Medium, Site.Text))
                    listOf("Format" to "format", "Why it won" to "why", "How to beat it" to "beat", "What came next" to "after").forEach { (k, f) -> a.str(f)?.takeIf { it.isNotBlank() }?.let { v ->
                        Column(Modifier.padding(top = 6.dp)) { Text(k.uppercase(), style = storyText(11f, FontWeight.ExtraBold, Site.Gold, 1.6f)); Text(v, style = storyText(13.5f, FontWeight.Medium, Site.Muted)) } } }
                }
            }
        }
        if (teaches.isNotEmpty()) item("learn") {
            LearnBox("New in this battle") { teaches.forEach { t -> Text(androidx.compose.ui.text.buildAnnotatedString {
                pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.ExtraBold)); append(t); pop(); append(" "); append(lessonText.getValue(t)) }, style = storyText(14f, FontWeight.Medium, Site.Text)) } }
        }
        item("decks") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DeckOpt(mine.obj("deck")?.str("name").orEmpty(), "Story deck · ${mine.obj("deck")?.cards()?.sumOf { it.second } ?: 0} cards", loanArt, true, true, "", ui.listOpen) {
                    onUi(StoryDuelUi("loaner", seat, !ui.listOpen, ui.listSide)) }
            }
        }
        item("bar") {
            val shape = RoundedCornerShape(20.dp)
            Column(Modifier.fillMaxWidth().clip(shape).border(1.dp, Site.Line, shape).background(Site.Surface.copy(alpha = .9f)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (villainOpen) Seg(listOf("hero" to (person("hero")?.str("name") ?: "You"), "villain" to (person("villain")?.str("name") ?: "")), seat) { onUi(StoryDuelUi(ui.deck, it, ui.listOpen, ui.listSide)) }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    StarsRow(rec)
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                        Text(prize.first.uppercase(), style = storyText(11f, FontWeight.ExtraBold, Site.Gold, 1.6f)); Text(prize.second, style = storyText(14f, FontWeight.Medium, Site.Text)) }
                }
                GoldCta(if (villainOpen) "Replay" else "Duel", Modifier.fillMaxWidth()) { onPlay(seat, null) }
            }
        }
        if (ui.listOpen) {
            val theirsList = villainOpen && ui.listSide == "theirs"
            val deck = if (theirsList) theirs.obj("deck") else mine.obj("deck")
            item("list") {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (villainOpen) Seg(listOf("mine" to "Your deck", "theirs" to "Their deck"), ui.listSide) { onUi(StoryDuelUi(ui.deck, seat, true, it)) }
                    deck?.let { Dossier(it) }
                    val rows = if (deck != null) deck.cards() else listFor(ui.deck).orEmpty()
                    rows.forEach { (n, q) -> Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) { Text("$q", style = storyText(14f, FontWeight.Bold, Site.Gold), modifier = Modifier.size(28.dp, 20.dp)); Text(n, style = storyText(14f, FontWeight.Medium, Site.Text)) } }
                }
            }
        }
    }
}

@Composable
private fun LearnBox(tag: String, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Column(Modifier.fillMaxWidth().clip(shape).border(1.dp, Color(0x55D6AD64), shape).background(Brush.horizontalGradient(listOf(Color(0x1AE6C884), Color(0x08B39D6C)))).background(Site.Surface.copy(alpha = .9f)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(tag.uppercase(), style = storyText(11f, FontWeight.ExtraBold, Site.Gold, 2f)); content()
    }
}

/** deckDossierMarkup: the label, its line, and every change from the original with the reason. */
@Composable
private fun Dossier(deck: JsonObject) {
    val label = deck.str("label")?.takeIf { it in DECK_LABELS } ?: return
    val line = deck.str("rules") ?: deck.str("note") ?: LABEL_LINE.getValue(label)
    val changes = deck.getAsJsonArray("changes")?.map { it.asJsonObject }.orEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(DECK_LABELS.getValue(label).uppercase(), style = storyText(11f, FontWeight.ExtraBold, Site.Gold, 1.6f))
        Text(line, style = storyText(13.5f, FontWeight.Medium, Site.Muted))
        if (changes.isNotEmpty()) {
            Text("Changed from the ${deck.obj("original")?.str("source") ?: "original"}", style = storyText(13f, FontWeight.Bold, Site.Text), modifier = Modifier.padding(top = 4.dp))
            changes.forEach { c -> Column(Modifier.padding(vertical = 2.dp)) {
                Text(androidx.compose.ui.text.buildAnnotatedString { pushStyle(androidx.compose.ui.text.SpanStyle(textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough, color = Site.Muted)); append(c.str("from").orEmpty()); pop(); append("  →  "); pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.Bold)); append(c.str("to").orEmpty()); pop() }, style = storyText(13.5f, FontWeight.Medium, Site.Text))
                Text(c.str("why").orEmpty(), style = storyText(12.5f, FontWeight.Medium, Site.Muted)) } }
        }
    }
}
