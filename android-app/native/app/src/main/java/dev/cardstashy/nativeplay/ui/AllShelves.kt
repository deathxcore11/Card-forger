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
import kotlinx.coroutines.sync.withLock
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
    /** The last try at the list failed (offline): the shelves say so, and the next start() tries again. */
    val failed = MutableStateFlow(false)
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
            failed.value = rows == null
        } finally { busy = false }
    }
}

/** "2 Oct 2026", a set's release date as the shelves show it. */
internal fun shelfDate(iso: String): String = runCatching {
    java.time.LocalDate.parse(iso.take(10)).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.UK))
}.getOrDefault(iso)

const val FIT_SHELF = "fit"

/**
 * One deck's Magic shelves: the cards each one loaded for the search it was loaded for. The set shelves follow the pool's search
 * ([use]'s base: format, colours, type) and "For this deck" its own (the deck's colours), so adding a card in a new colour starts only
 * that shelf over. A shelf loads while it is on screen ([load] is cancelled when it leaves), two at a time and never closer than
 * Scryfall's tenth of a second apart.
 */
class MagicShelves(private val scope: CoroutineScope) {
    private var base = ""; private var fit = ""
    private val cards = mutableStateMapOf<String, List<JsonObject>>()
    private val more = mutableStateMapOf<String, Boolean>()
    private val errors = mutableStateMapOf<String, String>()
    private val gate = Semaphore(2)
    private val pace = kotlinx.coroutines.sync.Mutex(); private var lastAt = 0L
    var sets by mutableStateOf(MagicSets.list.value)
    var setsFailed by mutableStateOf(false)
    /** Bumped when the shelves start over: the shelves on screen ask again (BenchModel.shelvesGen). */
    var gen by mutableStateOf(0)

    fun use(base: String, fitQuery: String) {
        if (base != this.base) { this.base = base; for (k in cards.keys.toList()) if (k != FIT_SHELF) cards.remove(k); more.clear(); errors.clear(); gen++ }
        if (fitQuery != fit) { fit = fitQuery; cards.remove(FIT_SHELF); errors.remove(FIT_SHELF); gen++ }
    }
    fun start() { if (sets == null) scope.launch { setsFailed = false; MagicSets.ensure(); sets = MagicSets.list.value; setsFailed = sets == null && MagicSets.failed.value } }
    /** The shelf's cards, while it is on screen: suspends until they're in (or failed), cancelled when it scrolls away. */
    suspend fun load(key: String) {
        if (cards.containsKey(key)) return
        if (key != FIT_SHELF && sets == null) { start(); return }
        errors.remove(key)
        val q = if (key == FIT_SHELF) fit else "$base e:$key"; val was = if (key == FIT_SHELF) fit else base
        gate.withPermit {
            if (cards.containsKey(key)) return
            pace.withLock { val wait = lastAt + 110 - System.currentTimeMillis(); if (wait > 0) kotlinx.coroutines.delay(wait); lastAt = System.currentTimeMillis() }
            val r = CardFacts.search(q, "edhrec", 1)
            if (was != (if (key == FIT_SHELF) fit else base)) return
            if (r == null) errors[key] = "This shelf couldn't load. Check your connection, then scroll back to try again."
            else { cards[key] = r.first; more[key] = r.second }
        }
    }

    private class Made(val from: List<JsonObject>, val stamp: Any?, val tiles: List<BenchTile>, val why: Map<String, String>)
    private val made = HashMap<String, Made>()
    /**
     * The shelves as the Bench draws them. [tile] makes a browser tile of a Scryfall card (the pool's own tiles); [inDeck] leaves the
     * deck's own cards out of "For this deck", which says what each card is. A shelf's tiles are made again only when its cards or
     * [stamp] (the deck's rows: what is in it, how many) change, so a shelf landing doesn't rebuild the others.
     */
    fun shelves(tile: (JsonObject) -> BenchTile, inDeck: (String) -> Boolean, fitTitle: String, fitMeta: String, stamp: Any?): List<BenchShelf> {
        fun tiles(key: String, got: List<JsonObject>, fit: Boolean): Made = made[key]?.takeIf { it.from === got && it.stamp == stamp } ?: run {
            val use = if (fit) got.filter { !inDeck(it.get("name")?.asString.orEmpty()) }.take(20) else got
            Made(got, stamp, use.map(tile), if (fit) use.associate { c -> c.get("name")?.asString.orEmpty() to roleWord(c) } else emptyMap()).also { made[key] = it }
        }
        val out = ArrayList<BenchShelf>()
        if (fit.isNotEmpty()) {
            val m = cards[FIT_SHELF]?.let { tiles(FIT_SHELF, it, true) }
            out += BenchShelf(FIT_SHELF, fitTitle, meta = fitMeta, gold = true, tiles = if (errors[FIT_SHELF] != null) emptyList() else m?.tiles, note = errors[FIT_SHELF].orEmpty(),
                why = m?.why.orEmpty())
        }
        if (sets == null && setsFailed) out += BenchShelf(SETS_SHELF, "Every set", tiles = emptyList(), note = "The list of sets couldn't load. Check your connection, then scroll back to try again.")
        for (s in sets.orEmpty()) {
            val got = cards[s.code]
            out += BenchShelf(s.code, s.name, s.code.uppercase(), shelfDate(s.released), tiles = if (errors[s.code] != null) emptyList() else got?.let { tiles(s.code, it, false).tiles }, note = errors[s.code].orEmpty(),
                count = if (more[s.code] == true) (got?.size ?: 0) + 1 else 0)
        }
        return out
    }
    /**
     * Ready once [use] has set the searches: "For this deck" then shows (before the list of sets, which follows). Never before, or the
     * list would first draw the sets alone and keep its place on them when "For this deck" arrives above.
     */
    val ready get() = fit.isNotEmpty()

    private fun roleWord(c: JsonObject): String {
        val t = c.get("type_line")?.asString ?: c.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.get("type_line")?.asString.orEmpty()
        return listOf("Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Artifact", "Enchantment", "Land").firstOrNull { it in t } ?: t.substringBefore(" —")
    }
}
/** The stand-in shelf when the list of sets couldn't load: asking it again tries the list again. */
const val SETS_SHELF = "sets"

/** A deck's colour identity for Scryfall's id<= (the cards' own, as the facts know them), or null when none is known yet. */
internal fun deckIdentity(names: Collection<String>): String? {
    val byName = HashMap<String, CardFacts.Fact>(); for (f in CardFacts.cards.value.values) { val n = f.card.get("name")?.asString ?: continue; byName.putIfAbsent(n, f); byName.putIfAbsent(n.substringBefore(" // "), f) }
    val known = names.mapNotNull { byName[it] }
    if (known.isEmpty()) return null
    return "WUBRG".filter { k -> known.any { k in it.k } }.lowercase().ifEmpty { "c" }
}
