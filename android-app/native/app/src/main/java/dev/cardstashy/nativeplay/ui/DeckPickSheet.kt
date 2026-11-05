package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import kotlinx.coroutines.launch

/**
 * app.js A.cardDeckPicker: a card page's "Add to deck", in the site's #sheet over the card (its back button returns to it). The
 * card's name, the Deck <select> on the active deck, and the gold Add to deck, which saves through A.addToDeck (CollectionWrites)
 * and goes back to the card, as A.cardDeckAdd's sheetHistoryBack does. With no decks: the site's words and Open Decks.
 */
@Composable
internal fun DeckPickSheet(p: CollectionWrites.DeckPick, backdrop: GraphicsLayer?, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val model by produceState<JsonObject?>(null, p.id) { value = CollectionWrites.deckPickModel(context, p.game) ?: run { onBack(); null } }
    val m = model ?: return
    val decks = m.getAsJsonArray("decks")?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()
    var selected by remember(m) { mutableStateOf(m.get("selected")?.asString.orEmpty()) }
    var busy by remember { mutableStateOf(false) }
    SiteSheet("Add to deck", backdrop, onClose = { onBack(); p.closeAll() }, onBack = onBack) { _ ->
        // <p>: margin 6 0, in the sheet's own 15 / 400.
        Text(p.name, Modifier.padding(vertical = 6.dp), style = SHEET_PLAIN)
        if (decks.isNotEmpty()) {
            FormLabeled("Deck", Modifier.fillMaxWidth()) { FormSelect(decks, selected, SHEET_IN_LABEL, desc = "Deck") { selected = it } }
            // .btn.block: margin-top 10, the sheet's width.
            Spacer(Modifier.height(10.dp))
            // One save per tap (the site's button doesn't dim while it saves).
            FormGold("Add to deck", modifier = Modifier.fillMaxWidth()) {
                if (busy) return@FormGold
                busy = true
                scope.launch {
                    val saved = CollectionWrites.act(context, "addToDeck", JsonObject().apply { addProperty("deck", selected); addProperty("name", p.name) })
                    busy = false
                    if (saved) onBack()
                }
            }
        } else {
            // p.muted: its 6 above meets the name's 6 below (the margins collapse).
            Text("Create a deck first to add this card.", Modifier.padding(bottom = 6.dp), style = SHEET_PLAIN.copy(color = Color(0xFF9AA2B1)))
            FormGold("Open Decks") { onBack(); p.closeAll(); p.go("#decks") }
        }
    }
}
