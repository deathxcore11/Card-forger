package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.play.CardFacts
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

/**
 * All cards, shelf by shelf (Randall 6 Nov 23:46Z: "smart ways where you're only loading a set at a time … looks cool and works like
 * magic in all 3 games", only when All is picked; he chose deck-first shelves 23:47Z, preview approved 23:59Z). Magic's shelves, for
 * Play's deck and Collection's: "For this deck" first, then each set newest first, every shelf one Scryfall search (the pool's own
 * search with e:<set>, app.js loadPool's order) made only when the shelf comes on screen. Yu-Gi-Oh! and Pokémon have theirs in the
 * Collection engine (Collection.shelvesStart / shelfStart).
 */
object MagicSets {
    class Row(val code: String, val name: String, val released: String, val count: Int)
    /** Scryfall's sets a deck builds from, newest first: paper core, expansion, masters, draft and Commander sets that are out. */
    val list = MutableStateFlow<List<Row>?>(null)
    private var busy = false
    private val KINDS = setOf("core", "expansion", "masters", "draft_innovation", "commander")

    suspend fun ensure() {
        if (list.value != null || busy) return
        busy = true
        try {
            val today = java.time.LocalDate.now().toString()
            val body = withContext(Dispatchers.IO) { runCatching { Http.call("GET", "https://api.scryfall.com/sets", mapOf("Accept" to "application/json"), null, 15_000) as? JsonObject }.getOrNull() }
            val rows = body?.getAsJsonArray("data")?.mapNotNull { e -> val o = e as? JsonObject ?: return@mapNotNull null
                fun s(k: String) = o.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                if (s("set_type") !in KINDS || o.get("digital")?.asBoolean == true || s("parent_set_code").isNotEmpty()) return@mapNotNull null
                val at = s("released_at"); if (at.isEmpty() || at > today) return@mapNotNull null
                val n = o.get("card_count")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0; if (n == 0) return@mapNotNull null
                Row(s("code"), s("name"), at, n) }?.sortedByDescending { it.released }
            if (rows != null) list.value = rows
        } finally { busy = false }
    }
}

/** "2 Oct 2026", a set's release date as the shelves show it. */
internal fun shelfDate(iso: String): String = runCatching {
    java.time.LocalDate.parse(iso.take(10)).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.UK))
}.getOrDefault(iso)

const val FIT_SHELF = "fit"

/** One deck's Magic shelves: the cards each one loaded for the search they were loaded for. */
class MagicShelves(private val scope: CoroutineScope) {
    private var base = ""; private var fit = ""
    private val cards = mutableStateMapOf<String, List<JsonObject>>()
    private val more = mutableStateMapOf<String, Boolean>()
    private val errors = mutableStateMapOf<String, String>()
    private val asked = HashSet<String>()
    // Two searches at a time: Scryfall asks for no more than ten a second, and a fast fling should not queue dozens.
    private val gate = Semaphore(2)
    var sets by mutableStateOf<List<MagicSets.Row>?>(null)

    /** The pool's search without a name ([base]: format, colours, type) and "For this deck"'s ([fitQuery]); new ones start the shelves over. */
    fun use(base: String, fitQuery: String) {
        if (base == this.base && fitQuery == fit) return
        this.base = base; fit = fitQuery; cards.clear(); more.clear(); errors.clear(); asked.clear()
    }
    fun start() { scope.launch { MagicSets.ensure(); sets = MagicSets.list.value } }
    fun load(key: String) {
        if (!asked.add(key)) return
        val q = if (key == FIT_SHELF) fit else "$base e:$key"; val was = base to fit
        scope.launch {
            gate.withPermit {
                val r = CardFacts.search(q, "edhrec", 1)
                if (was != base to fit) return@withPermit
                if (r == null) { errors[key] = "This shelf couldn't load. Check your connection, then scroll back to try again."; asked.remove(key) }
                else { errors.remove(key); cards[key] = r.first; more[key] = r.second }
            }
        }
    }

    /**
     * The shelves as the Bench draws them. [tile] makes a browser tile of a Scryfall card (the pool's own tiles); [inDeck] leaves the
     * deck's own cards out of "For this deck", which says what each card is.
     */
    fun shelves(tile: (JsonObject) -> BenchTile, inDeck: (String) -> Boolean, fitTitle: String, fitMeta: String): List<BenchShelf> {
        val out = ArrayList<BenchShelf>()
        if (fit.isNotEmpty()) {
            val got = cards[FIT_SHELF]?.filter { !inDeck(it.get("name")?.asString.orEmpty()) }?.take(20)
            out += BenchShelf(FIT_SHELF, fitTitle, meta = fitMeta, gold = true, tiles = if (errors[FIT_SHELF] != null) emptyList() else got?.map(tile), note = errors[FIT_SHELF].orEmpty(),
                why = got.orEmpty().associate { c -> val n = c.get("name")?.asString.orEmpty(); n to roleWord(c) })
        }
        for (s in sets.orEmpty()) {
            val got = cards[s.code]
            out += BenchShelf(s.code, s.name, s.code.uppercase(), shelfDate(s.released), tiles = if (errors[s.code] != null) emptyList() else got?.map(tile), note = errors[s.code].orEmpty(),
                count = if (more[s.code] == true) (got?.size ?: 0) + 1 else 0)
        }
        return out
    }
    val ready get() = sets != null

    private fun roleWord(c: JsonObject): String {
        val t = c.get("type_line")?.asString ?: c.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.get("type_line")?.asString.orEmpty()
        return listOf("Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Artifact", "Enchantment", "Land").firstOrNull { it in t } ?: t.substringBefore(" —")
    }
}

/** A deck's colour identity for Scryfall's id<= (the cards' own, as the facts know them), or null when none is known yet. */
internal fun deckIdentity(names: Collection<String>): String? {
    val byName = HashMap<String, CardFacts.Fact>(); for (f in CardFacts.cards.value.values) { val n = f.card.get("name")?.asString ?: continue; byName.putIfAbsent(n, f); byName.putIfAbsent(n.substringBefore(" // "), f) }
    val known = names.mapNotNull { byName[it] }
    if (known.isEmpty()) return null
    return "WUBRG".filter { k -> known.any { k in it.k } }.lowercase().ifEmpty { "c" }
}
