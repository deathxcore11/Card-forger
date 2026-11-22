package dev.cardstashy.nativeplay.ui

/**
 * Adventures: the Play screen's one card for the games that live beside matches (Planeswalk now; Lost Memories and Duel Summoner when
 * they are ready). This file is the host side: a registry that games plug into. No Compose here, so plain JVM tests load it.
 *
 * To add a game: implement [AdventureGame] and call [Adventures.register] once (see [Adventures.defaults]). The hub draws it, selects
 * it, launches it and counts its achievements; no other file changes. A game with [AdventureGame.ready] false shows as "Coming soon"
 * and can't be opened, so unfinished games never launch. Nothing here invents numbers: a game that has no state or achievements
 * yet returns null and the hub draws nothing in their place.
 */

/** What the hub lets a game call on the app when it launches. Add a field here when a native game needs one (a screen route). */
class AdventureHost(val web: (String) -> Unit)

/** A game's own achievements: [earned] of [total], and the one it is closest to, in words. */
class AdventureProgress(val earned: Int, val total: Int, val next: String? = null) {
    init { require(earned >= 0 && total >= 0 && earned <= total) { "earned $earned of $total" } }
}

interface AdventureGame {
    val id: String
    val name: String
    /** A few words on what kind of game it is ("Map-climbing deck builder"). */
    val style: String
    /** One or two plain sentences for the detail panel. */
    val blurb: String
    /** The accent colour, 0xAARRGGBB: the selected card's rim and name. */
    val accent: Long
    /** The card's art (a URL the Play home art loader takes), or null for the accent wash alone. */
    val art: String?
    /** Vertical focus of the art on the card, -1 (top) to 1 (bottom). */
    val artFocus: Float get() = 0f
    /** False: shown as "Coming soon", never selectable, never launched. */
    val ready: Boolean
    /** One short live line ("Act 2, floor 6", "Best 6:42"), or null when the game has none to give yet. */
    fun state(): String? = null
    /** This game's achievements, or null when it has none yet. */
    fun progress(): AdventureProgress? = null
    /** Opens the game. Only called when [ready]. */
    fun launch(host: AdventureHost)
}

/** How many achievements pay a pack, and whether the count is one shared total or each game's own. Randall's answer is still open: both work. */
enum class PackCount { SHARED, PER_GAME }

object Adventures {
    private val games = ArrayList<AdventureGame>()

    /** Achievements per pack. 5 until Randall says otherwise. */
    @Volatile var packEvery = 5
    @Volatile var packCount = PackCount.SHARED

    init { defaults().forEach { register(it) } }

    /** Adds a game, or replaces the one with the same id (a game that grows from soon to ready re-registers itself). */
    @Synchronized fun register(game: AdventureGame) {
        val i = games.indexOfFirst { it.id == game.id }
        if (i >= 0) games[i] = game else games += game
    }

    @Synchronized fun unregister(id: String) { games.removeAll { it.id == id } }

    /** Every registered game, in the order they were added. */
    @Synchronized fun all(): List<AdventureGame> = games.toList()
    @Synchronized fun get(id: String): AdventureGame? = games.firstOrNull { it.id == id }
    fun readyGames(): List<AdventureGame> = all().filter { it.ready }
    /** The game the hub opens on: the first ready one, or null when none is (the hub then has nothing to start). */
    fun first(): AdventureGame? = readyGames().firstOrNull()

    /** The achievements of every ready game together, or null when none of them has any. */
    fun shared(): AdventureProgress? {
        val p = readyGames().mapNotNull { runCatching { it.progress() }.getOrNull() }
        return if (p.isEmpty() || p.sumOf { it.total } == 0) null else AdventureProgress(p.sumOf { it.earned }, p.sumOf { it.total })
    }

    /** Packs earned from these per-game counts under [count] and [every]. */
    fun packsEarned(perGame: List<Int>, every: Int = packEvery, count: PackCount = packCount): Int =
        if (every <= 0) 0 else when (count) { PackCount.SHARED -> perGame.sum() / every; PackCount.PER_GAME -> perGame.sumOf { it / every } }

    /** Achievements still to earn before the next pack (shared count), 1..every. */
    fun toNextPack(earned: Int, every: Int = packEvery): Int = if (every <= 0) 0 else every - earned % every

    /** The words under the Adventures card on Play home: the one ready game's name, or how many are ready. */
    fun copy(): String = readyGames().let { when (it.size) { 0 -> "Games are on their way."; 1 -> "${it[0].name}, with more games on the way."; else -> it.joinToString(", ") { g -> g.name } + "." } }
    /** The one short live line on the Adventures hand card: a single ready game's own line (or its name), else the count. */
    fun line(): String = readyGames().let { when (it.size) { 0 -> "Coming soon"; 1 -> it[0].state() ?: it[0].name; else -> "${it.size} games" } }

    /** The card's art strip on Play home: the pictures of the ready games, at most three. */
    fun strip(): List<AdventureGame> = readyGames().filter { it.art != null }.take(3)

    /** The games that ship now. Their text is the approved mock's. */
    internal fun defaults(): List<AdventureGame> = listOf(Planeswalk, LostMemories, DuelSummoner)
}

/** Planeswalk: the existing page, opened from the app. Its run lives in the page, so it has no state or achievements to show here yet. */
private object Planeswalk : AdventureGame {
    override val id = "planeswalk"
    override val name = "Planeswalk"
    override val style = "Map-climbing deck builder"
    override val blurb = "Climb Innistrad. Take down Sorin."
    override val accent = 0xFFD9482BL
    override val art = "https://cards.scryfall.io/art_crop/front/a/8/a83ca3a1-82a9-4f47-b0b8-21687afd705b.jpg?1783931174"
    override val artFocus = -.76f
    override val ready = true
    override fun launch(host: AdventureHost) = host.web("https://cardstashy.com/planeswalk.html")
}

/** Not ready: registered so the hub keeps its place, flips to ready when the game ships. */
private class Soon(override val id: String, override val name: String, override val style: String, override val blurb: String, override val accent: Long) : AdventureGame {
    override val art: String? = null
    override val ready = false
    override fun launch(host: AdventureHost) {}
}

private val LostMemories: AdventureGame = Soon("lost-memories", "Lost Memories", "Card duelling roguelite", "Meld cards and descend the pyramid, one duel at a time.", 0xFFD9A441L)
private val DuelSummoner: AdventureGame = Soon("duel-summoner", "Duel Summoner", "Summoner survival run", "Run, jump and survive the swarm with summoned monsters. Eight minutes a run.", 0xFF3FA89AL)
