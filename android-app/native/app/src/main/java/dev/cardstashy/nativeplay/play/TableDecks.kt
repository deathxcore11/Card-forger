package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.UserDeck

/**
 * The Play table's decks (app.js playTableDecks, Randall 3 Nov 22:31Z-23:06Z): every Play deck and every
 * Collection deck. Practice can use any of them; Quick Play shows them all but greys out any deck missing
 * cards from your Trunk, and deals only a deck whose cards are all there (quickDeckReady).
 */
object TableDecks {
    /** One lobby deck: [raw] is the whole record the engine gets (name, format, commander, cards, side). */
    data class Deck(val id: String, val name: String, val format: String, val commander: String, val raw: JsonObject,
                    val collection: Boolean, val unlocked: Boolean) {
        val cards: List<Decks.Row> get() = rowsOf(raw.getAsJsonArray("cards"))
        val side: List<Decks.Row> get() = rowsOf(raw.getAsJsonArray("side"))
        val count: Int get() = cards.sumOf { it.qty }
    }

    val SINGLETON = listOf("Commander", "Standard Brawl", "Oathbreaker")

    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    private fun rowsOf(a: JsonArray?) = a?.mapNotNull { e -> val o = e as? JsonObject ?: return@mapNotNull null
        Decks.Row(o.s("name"), o.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 0, o.s("board").ifBlank { null }) } ?: emptyList()
    private fun row(r: Decks.Row) = JsonObject().apply { addProperty("name", r.name); addProperty("qty", maxOf(1, r.qty)) }

    /**
     * playTableDecks: Play decks first ({name, qty} rows split into cards and side; a singleton deck's commander is
     * its first one-copy legendary creature or planeswalker), then Collection decks as saved, each marked
     * unlocked when deckShortfall finds nothing missing from the Trunk. [typeOf] is the site's meta(name).type_line.
     */
    /**
     * loadFreePrecons: the free Commander precons (data/play-starters/precons.json) live only in the Play deck pickers
     * (Practice, Quick Play, Multiplayer), never in Decks or the Trunk, and always play (Randall 4 Nov 00:40Z).
     */
    val free = kotlinx.coroutines.flow.MutableStateFlow<List<Deck>?>(null)
    @Volatile private var freeAsked = false
    suspend fun loadFree() {
        if (freeAsked) return; freeAsked = true
        val body = runCatching { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            dev.cardstashy.nativeplay.account.Http.call("GET", "https://cardstashy.com/data/play-starters/precons.json", mapOf("Accept" to "application/json"), null, 20_000) as? JsonObject } }.getOrNull()
        if (body == null) { freeAsked = false; return }
        free.value = freeFrom(body)
        // The real cards go back in once the engine says it knows them (a card it doesn't know would refuse the match, so that one
        // keeps its stand-in). Off the caller's scope, so leaving the picker early doesn't strand the stand-ins.
        val swapped = body.getAsJsonObject("swaps")?.keySet()?.toSet().orEmpty() +
            (body.getAsJsonArray("decks") ?: JsonArray()).flatMap { d -> (d as? JsonObject)?.getAsJsonArray("rows")?.mapNotNull { (it as? JsonObject)?.s("was")?.takeIf { w -> w.isNotBlank() } }.orEmpty() }
        if (swapped.isNotEmpty()) kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            val st = dev.cardstashy.nativeplay.engine.ForgeService.status.first { it is dev.cardstashy.nativeplay.engine.ForgeService.Status.Ready || it is dev.cardstashy.nativeplay.engine.ForgeService.Status.Failed }
            if (st !is dev.cardstashy.nativeplay.engine.ForgeService.Status.Ready) return@launch
            val known = swapped - runCatching { dev.cardstashy.nativeplay.engine.ForgeService.unknownNames(swapped).toSet() }.getOrElse { return@launch }
            if (known.isNotEmpty()) free.value = freeFrom(body, known)
        }
    }
    /** [known]: real names (keys of the bake's swaps) the engine knows; their stand-ins are swapped back. */
    fun freeFrom(body: JsonObject, known: Set<String> = emptySet()): List<Deck> {
    // The web bake swaps cards its engine has no rules for (swaps: real name -> stand-in; a swapped row carries no set). Forge plays
    // every card, so native puts the real card back. Every free Commander precon in the file shows (10 from 10 Nov), no count.
    val real = body.getAsJsonObject("swaps")?.entrySet()?.mapNotNull { (k, v) -> if (k !in known) null else v.takeIf { it.isJsonPrimitive }?.asString?.let { it to k } }?.toMap().orEmpty()
    return (body.getAsJsonArray("decks") ?: JsonArray()).mapNotNull { it as? JsonObject }.filter { it.s("format") == "Commander" }.map { d ->
        val rows = (d.getAsJsonArray("rows")?.mapNotNull { it as? JsonObject } ?: emptyList()).map { r ->
            // The row names its real card ("was", bake from 10 Nov) or, in older files, a swapped row has no set of its own.
            val was = r.s("was").takeIf { it.isNotBlank() }
            val back = if (was != null) was.takeIf { it in known } else real[r.s("name")]?.takeIf { !r.has("set") }
            if (back == null) r else r.deepCopy().apply { addProperty("name", back); remove("set"); remove("number"); remove("id") } }
        val commander = rows.firstOrNull { it.get("commander")?.takeIf { p -> p.isJsonPrimitive }?.asBoolean == true }.s("name")
        val raw = JsonObject().apply {
            addProperty("id", "free:" + d.s("key")); addProperty("name", d.s("name")); addProperty("format", "Commander"); addProperty("commander", commander)
            add("cards", JsonArray().apply { rows.forEach { r -> add(JsonObject().apply { addProperty("name", r.s("name")); addProperty("qty", r.get("qty")?.asInt ?: 1)
                // Its exact printing (every row has one from web 4.3.152), so the hand and table find its art (CardArt.identifier).
                r.s("set").takeIf { it.isNotBlank() }?.let { addProperty("set", it) }; r.s("number").takeIf { it.isNotBlank() }?.let { addProperty("collectorNumber", it) }
                // The decklist's own printing (precons.json "id", an exact Scryfall printing id): pins deck views, the match, VS and the preload.
                r.s("id").takeIf { it.isNotBlank() }?.let { addProperty("printingId", it) } }) } })
            add("side", JsonArray()); addProperty("free", true)
        }
        Deck("free:" + d.s("key"), d.s("name"), "Commander", commander, raw, false, true)
    }
    }

    fun list(state: JsonObject?, workspace: List<UserDeck>, typeOf: (String) -> String, freeDecks: List<Deck> = free.value.orEmpty()): List<Deck> {
        val owned = Decks.ownedByName(state)
        val play = Trunk.decks(state).map { d ->
            val all = Decks.rows(d); val cards = all.filter { it.board != "side" }; val side = all.filter { it.board == "side" }
            val format = d.s("format").ifBlank { "Standard" }
            val commander = if (format in SINGLETON) cards.firstOrNull { it.qty == 1 && Regex("Legendary.*(Creature|Planeswalker)").containsMatchIn(typeOf(it.name)) }?.name ?: "" else ""
            val raw = JsonObject().apply {
                addProperty("id", d.s("id")); addProperty("name", d.s("name").ifBlank { "Untitled deck" }); addProperty("format", format); addProperty("commander", commander)
                add("cards", JsonArray().apply { cards.forEach { add(row(it)) } }); add("side", JsonArray().apply { side.forEach { add(row(it)) } })
            }
            Deck(d.s("id"), d.s("name").ifBlank { "Untitled deck" }, format, commander, raw, false,
                Decks.shortfall(cards.map { it.copy(qty = maxOf(1, it.qty)) }, owned).complete)
        }
        val collection = workspace.map { u ->
            val main = rowsOf(u.cards).filter { it.board == null || it.board == "main" }
            Deck(u.id, u.name, u.format, u.commander ?: "", u.raw, true, Decks.shortfall(main, owned).complete)
        }
        return play + freeDecks + collection
    }

    /** playLockedDecks. */
    fun locked(decks: List<Deck>): Set<String> = decks.filter { !it.unlocked }.map { it.id }.toSet()

    /** quickDeckReady: no deck yet, or a saved deck (not a pasted or source list) that isn't locked. */
    fun quickReady(selectedId: String?, selectedSaved: Boolean, locked: Set<String>) = selectedId == null || (selectedSaved && selectedId !in locked)

    const val LOCKED_TOAST = "Some of its cards aren't in your Trunk yet. Practice can use it."
    const val QUICK_NEEDS = "Quick Play needs a deck with every card in your Trunk."
    const val QUICK_INTRO = "Quick Play needs every card of a deck in your Trunk. Greyed decks are missing some; Practice can use any deck."
}
