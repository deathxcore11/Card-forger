package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
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
    fun list(state: JsonObject?, workspace: List<UserDeck>, typeOf: (String) -> String): List<Deck> {
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
        return play + collection
    }

    /** playLockedDecks. */
    fun locked(decks: List<Deck>): Set<String> = decks.filter { !it.unlocked }.map { it.id }.toSet()

    /** quickDeckReady: no deck yet, or a saved deck (not a pasted or source list) that isn't locked. */
    fun quickReady(selectedId: String?, selectedSaved: Boolean, locked: Set<String>) = selectedId == null || (selectedSaved && selectedId !in locked)

    const val LOCKED_TOAST = "Some of its cards aren't in your Trunk yet. Practice can use it."
    const val QUICK_NEEDS = "Quick Play needs a deck with every card in your Trunk."
    const val QUICK_INTRO = "Quick Play needs every card of a deck in your Trunk. Greyed decks are missing some; Practice can use any deck."
}
