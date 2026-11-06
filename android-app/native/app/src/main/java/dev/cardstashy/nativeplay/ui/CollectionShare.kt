package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
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
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.launch

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.n(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()

/**
 * A deck's share sheet. Magic's is views.js shareSheet: the words under the title, Shown as creator and About this deck, the note on
 * what is and isn't shared, Create link (app.js A.shareMake: the two fields saved, then the link), then the link with Copy link,
 * Share… and Preview and how long it is (Update link makes it again). Yu-Gi-Oh! and Pokémon's is tcg.js A.tShare's: the link straight
 * away with its buttons. The link is share.js encodeShare's as the browser makes it ([CollectionWrites.shareCode]); Copy link and
 * Share… are A.shareCopy / A.shareNative (Android's share sheet, which the browser's navigator.share opens); Preview opens the link.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ShareSheet(o: CollectionWrites.ShareOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var sheet by remember { mutableStateOf<JsonObject?>(null) }
    var author by remember { mutableStateOf("") }
    var about by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    /** The sheet as the site draws it after its link is made: the payload of the deck as saved, then the sheet showing that link. */
    suspend fun withLink(): JsonObject? {
        val first = CollectionWrites.shareModel(context, o.deck, o.game) ?: return null
        return CollectionWrites.shareModel(context, o.deck, o.game, CollectionWrites.SHARE_BASE + CollectionWrites.shareCode(first.s("payload")))?.o("sheet")
    }
    fun adopt(m: JsonObject) {
        m.objs("fields").forEach { f -> when (f.s("id")) { "shareAuthor" -> author = f.s("value"); "shareAbout" -> about = f.s("value") } }
        sheet = m
    }
    LaunchedEffect(o.id) {
        val m = if (o.game == "mtg") CollectionWrites.shareModel(context, o.deck, o.game)?.o("sheet") else withLink()
        if (m == null) onClose() else adopt(m)
    }
    val m = sheet ?: return
    val pal = LocalSheetPal.current
    val link = m.s("link")
    SiteSheet(m.s("title"), backdrop, onClose) { _ ->
        // p.muted.small: 13 muted, 6 above and under.
        Text(m.s("intro"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, Site.Muted))
        // label.field: 8 above and under, a grid 4 apart: its words (12.5 / 600 muted), "(optional)" (a muted small, its own row),
        // then the field (it takes the label's font; a textarea 13.5).
        val fields = m.objs("fields")
        fields.forEachIndexed { i, f ->
            Spacer(Modifier.height(if (i == 0) 2.dp else 8.dp))
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(f.s("label"), style = SHEET_LABEL)
                if (f.s("small").isNotEmpty()) Text(f.s("small"), style = cssType(13f, 600, 18.85f, Site.Muted))
                val max = f.n("max").takeIf { it > 0 } ?: Int.MAX_VALUE
                if (f.s("id") == "shareAbout") FormArea(about, { if (it.length <= max) about = it }, f.s("placeholder"), f.n("rows"), f.s("label"), weight = 600)
                else FormInput(author, { if (it.length <= max) author = it }, SHEET_IN_LABEL, f.s("placeholder"), desc = f.s("label"))
            }
        }
        val note = m.objs("note")
        if (note.isNotEmpty()) {
            Spacer(Modifier.height(if (fields.isEmpty()) 4.dp else 10.dp))
            // .note: 10 / 12 in, corners 12, surface-2, 13.5; its <b> bold, its <br> a new line.
            Text(buildAnnotatedString {
                var fresh = true
                note.forEach { p ->
                    if (p.b("br")) { append("\n"); fresh = true; return@forEach }
                    val t = p.s("t").replace(Regex("\\s+"), " ").let { if (fresh) it.trimStart() else it }
                    if (p.b("b")) withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(t) } else append(t)
                    fresh = false
                }
            }, Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Site.Surface2).padding(horizontal = 12.dp, vertical = 10.dp),
                style = cssType(13.5f, 400, 19.575f, Site.Text))
        }
        // .btn.block: the whole width, 10 above.
        if (m.s("make").isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            FormGold(if (busy) m.s("make") else m.s("make"), enabled = !busy, modifier = Modifier.fillMaxWidth(), pal = pal) {
                if (busy) return@FormGold
                busy = true
                scope.launch {
                    try {
                        val saved = CollectionWrites.act(context, "shareMake", JsonObject().apply { addProperty("deck", o.deck); addProperty("author", author); addProperty("about", about) })
                        if (saved) withLink()?.let(::adopt)
                    } finally { busy = false }
                }
            }
        }
        if (link.isNotEmpty()) {
            // .share-link: 12 above, a grid 8 apart: the link (12, read only), the buttons (.actions: 10 more above, 8 apart, wrapping),
            // the foot (12 faint, 10 more above).
            Spacer(Modifier.height(if (m.s("make").isEmpty()) 6.dp else 12.dp))
            SelectionContainer {
                Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).siteGlassField(11.dp).semantics { contentDescription = "Share link" }
                    .padding(horizontal = 13.dp, vertical = 10.dp), contentAlignment = Alignment.CenterStart) {
                    Text(link, style = cssType(12f, 400, 17.4f, Site.Text), maxLines = 1, softWrap = false, overflow = TextOverflow.Clip)
                }
            }
            Spacer(Modifier.height(18.dp))
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                m.objs("actions").forEach { a ->
                    val go = {
                        when (a.s("act")) {
                            "shareCopy", "tShareCopy" -> {
                                val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                cm.setPrimaryClip(android.content.ClipData.newPlainText("Share link", link))
                                CollectionWrites.show(m.s("copied"))
                            }
                            "shareNative", "tShareNative" -> {
                                val n = m.o("native") ?: JsonObject()
                                val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
                                    .putExtra(android.content.Intent.EXTRA_SUBJECT, n.s("title"))
                                    .putExtra(android.content.Intent.EXTRA_TEXT, listOf(n.s("text"), link).filter { it.isNotEmpty() }.joinToString(" "))
                                runCatching { context.startActivity(android.content.Intent.createChooser(send, null).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) }
                            }
                            "preview" -> o.preview(link)
                        }
                        Unit
                    }
                    if (a.b("ghost")) GhostBtn(a.s("label")) { go() } else FormGold(a.s("label"), pal = pal) { go() }
                }
            }
            if (m.s("foot").isNotEmpty()) {
                Spacer(Modifier.height(18.dp))
                Text(m.s("foot"), style = cssType(12f, 400, 17.4f, Site.Faint))
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}
