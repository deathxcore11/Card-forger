package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import com.google.gson.JsonObject

/**
 * Line-for-line port of the site's match-facts.js createMatchFacts (web 4.3.91): what one match showed the player,
 * for achievements and quests. Fed every table snapshot, it keeps only what the viewer could see (board,
 * graveyards, exile, life, poison, hand and library counts). [surface] is the slice of forge-session.mjs's
 * projection the tracker reads: seats by player order, face-down cards as known=false, the six card types.
 */
class MatchFacts {
    data class SCard(val id: Int, val owner: Int?, val controller: Int?, val zone: String, val known: Boolean, val name: String?, val type: String,
                     val types: List<String>, val power: Int?, val attacking: Boolean, val isToken: Boolean, val counters: Map<String, Int>,
                     val keywords: List<String>, val attachments: List<Int>)
    data class SPlayer(val seat: Int, val life: Int?, val handCount: Int?, val libraryCount: Int?, val counters: Map<String, Int>)
    data class Surface(val seat: Int, val turn: Int, val activeSeat: Int?, val players: List<SPlayer>, val cards: List<SCard>)

    companion object {
        private val TYPES = listOf("Creature", "Land", "Artifact", "Enchantment", "Planeswalker", "Battle", "Instant", "Sorcery")
        private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        private fun JsonObject.a(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray ?: JsonArray()
        private fun JsonObject.i(k: String) = get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble?.takeIf { it % 1.0 == 0.0 }?.toInt()
        private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString
        private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean
        private fun counts(o: JsonObject?) = o?.entrySet()?.mapNotNull { (k, v) -> if (v.isJsonPrimitive && v.asJsonPrimitive.isNumber) k to v.asInt else null }?.toMap() ?: emptyMap()

        /** forge-session.mjs: seats are the players' order; a viewer's own hand is public to them; hidden cards stay unknown. */
        fun surface(raw: JsonObject): Surface? {
            val players = raw.a("players").mapNotNull { it as? JsonObject }
            if (players.isEmpty()) return null
            val seatById = players.mapIndexedNotNull { i, p -> p.i("id")?.let { it to i } }.toMap()
            val seat = players.indexOfFirst { it.b("isViewer") == true }.takeIf { it >= 0 } ?: return null
            val viewerId = raw.i("viewer")
            val cards = LinkedHashMap<Int, SCard>()
            for (p in players) for ((zone, z) in (p.o("zones")?.entrySet() ?: emptySet())) for (e in (z as? JsonObject)?.a("cards") ?: JsonArray()) {
                val c = e as? JsonObject ?: continue; val id = c.i("id") ?: continue
                if (zone == "Library" || (zone == "Hand" && p.i("id") != viewerId)) continue
                if (c.s("zone") != null && c.s("zone") != zone) continue
                val owner = seatById[c.i("owner")]; val controller = seatById[c.i("controller")]
                if (c.b("hidden") == true) { cards[id] = SCard(id, owner, controller, zone, false, null, "", emptyList(), null, false, false, emptyMap(), emptyList(), emptyList()); continue }
                if (c.b("hidden") != false) continue
                val name = c.s("name")?.takeIf { it.isNotEmpty() } ?: continue
                val type = c.s("type") ?: ""
                val kw = c.a("keywords").mapNotNull { k -> if (k.isJsonPrimitive) k.asString else (k as? JsonObject)?.let { it.s("keyword") ?: it.s("text") } }
                cards[id] = SCard(id, owner, controller, zone, true, name, type, type.split(Regex("\\s+")).filter { it in TYPES }, c.i("power"),
                    c.b("attacking") == true, c.b("token") == true, counts(c.o("counters")), kw, c.a("attachments").mapNotNull { if (it.isJsonPrimitive) it.asInt else null })
            }
            val sp = players.mapIndexed { i, p -> val z = p.o("zones")
                SPlayer(i, p.i("life"), z?.o("Hand")?.i("count") ?: 0, z?.o("Library")?.i("count") ?: 0, counts(p.o("counters")).filterValues { it > 0 }) }
            return Surface(seat, raw.i("turn") ?: 0, seatById[raw.i("activePlayer")], sp, cards.values.toList())
        }
        private val SUBTYPES = Regex("(?:—|\\s-\\s)\\s*(.+)$")
        private val FLYING = Regex("^flying$", RegexOption.IGNORE_CASE)
        private val SLIVER = Regex("Sliver")
    }

    private var seat: Int? = null; private var lastTurn = 0; private var startLife: Int? = null; private var lastMyLife: Int? = null
    private var lastOppLife: Int? = null; private var oppTurnStart: Int? = null; private var turnOfStart = -1
    private var lastPile = HashMap<String, Int>()
    private class Was(val controller: Int?, val owner: Int?, val creature: Boolean, val token: Boolean, val name: String?) { var age = 0 }
    private val pending = LinkedHashMap<Int, Was>()
    private val turnOwner = HashMap<Int, Int>(); private val field = LinkedHashMap<Int, Was>(); private val lastFace = HashMap<Int, String?>()

    var turns = 0; var myTurns = 0; var minLife: Int? = null; var endLife: Int? = null; var maxLife: Int? = null; var lifeGained = 0; var startLifeF: Int? = null
    var oppEndLife: Int? = null; var oppMinLife: Int? = null; var oppBigTurn = 0; var oppPoison = 0; var myPoison = 0; var oppLibraryMin: Int? = null; var oppHandMin: Int? = null; var maxHand = 0
    var maxCreatures = 0; var maxTokens = 0; var maxLands = 0; var maxArtifacts = 0; var maxEnchantments = 0; var maxPower = 0; var maxBoardPower = 0; var maxAttackers = 0
    var maxFlyers = 0; var maxCounters = 0; var maxSuspended = 0; var maxFaceDown = 0; var maxAttach = 0; var maxSlivers = 0; val tribes = LinkedHashMap<String, Int>()
    var oppMaxCreatures = 0; var oppWipes = 0; var kills = 0; var losses = 0; var turnedUp = 0; var flipped = 0; var endCreatures = 0; var oppEndCreatures = 0
    val myCards = sortedSetOf<String>(); val theirCards = sortedSetOf<String>(); val killed = sortedSetOf<String>(); val myDead = sortedSetOf<String>()
    /** The seat that started turn 1 (forgeStartingPlayer's ownFirst). */
    val ownFirst: Boolean? get() = turnOwner[1]?.let { it == seat }

    private fun subtypes(c: SCard) = SUBTYPES.find(c.type)?.groupValues?.get(1)?.split(Regex("\\s+"))?.filter { it.isNotEmpty() } ?: emptyList()

    fun update(s: Surface?) {
        if (s == null) return
        seat = s.seat; val seat = s.seat
        val turn = s.turn
        if (turn > lastTurn) lastTurn = turn
        turns = maxOf(turns, turn)
        // A turn belongs to the seat the table last showed as active in it.
        if (turn > 0 && s.activeSeat != null) turnOwner[turn] = s.activeSeat
        myTurns = turnOwner.values.count { it == seat }
        val me = s.players.firstOrNull { it.seat == seat }; val opps = s.players.filter { it.seat != seat }; val opp = if (opps.size == 1) opps[0] else null
        me?.life?.let { life ->
            if (startLife == null) { startLife = life; startLifeF = life }
            lastMyLife?.let { if (life > it) lifeGained += life - it }
            lastMyLife = life; endLife = life
            minLife = minLife?.let { minOf(it, life) } ?: life
            maxLife = maxLife?.let { maxOf(it, life) } ?: life
        }
        myPoison = maxOf(myPoison, me?.counters?.get("POISON") ?: 0)
        me?.handCount?.let { maxHand = maxOf(maxHand, it) }
        if (opp != null) {
            opp.life?.let { life ->
                // Most life the opponent lost inside one turn (yours or theirs): the big turn.
                if (oppTurnStart == null || turn != turnOfStart) { turnOfStart = turn; oppTurnStart = lastOppLife ?: life }
                oppBigTurn = maxOf(oppBigTurn, oppTurnStart!! - life)
                lastOppLife = life; oppEndLife = life; oppMinLife = oppMinLife?.let { minOf(it, life) } ?: life
            }
            oppPoison = maxOf(oppPoison, opp.counters["POISON"] ?: 0)
            if (turn >= 1 && opp.libraryCount != null) oppLibraryMin = oppLibraryMin?.let { minOf(it, opp.libraryCount) } ?: opp.libraryCount
            if (opp.handCount != null && turn >= 3) oppHandMin = oppHandMin?.let { minOf(it, opp.handCount) } ?: opp.handCount
        }
        val cards = s.cards
        val bf = cards.filter { it.zone == "Battlefield" }; val mine = bf.filter { it.controller == seat }; val theirs = bf.filter { it.controller != seat }
        fun isCreature(c: SCard) = if (!c.known) true else "Creature" in c.types
        val myC = mine.filter { it.known && "Creature" in it.types }; val theirC = theirs.filter(::isCreature)
        maxCreatures = maxOf(maxCreatures, mine.count(::isCreature))
        maxTokens = maxOf(maxTokens, mine.count { it.isToken })
        maxLands = maxOf(maxLands, mine.count { "Land" in it.types })
        maxArtifacts = maxOf(maxArtifacts, mine.count { "Artifact" in it.types })
        maxEnchantments = maxOf(maxEnchantments, mine.count { "Enchantment" in it.types })
        maxPower = maxOf(maxPower, myC.maxOfOrNull { it.power ?: 0 } ?: 0, 0)
        maxBoardPower = maxOf(maxBoardPower, myC.sumOf { maxOf(0, it.power ?: 0) })
        maxAttackers = maxOf(maxAttackers, mine.count { it.attacking })
        fun flies(c: SCard) = c.keywords.any { FLYING.matches(it) }
        maxFlyers = maxOf(maxFlyers, myC.count(::flies))
        maxCounters = maxOf(maxCounters, mine.maxOfOrNull { it.counters["P1P1"] ?: 0 } ?: 0, 0)
        maxFaceDown = maxOf(maxFaceDown, mine.count { !it.known })
        maxAttach = maxOf(maxAttach, myC.maxOfOrNull { it.attachments.size } ?: 0, 0)
        maxSuspended = maxOf(maxSuspended, cards.count { it.zone == "Exile" && it.owner == seat && (it.counters["TIME"] ?: 0) > 0 })
        val tribe = LinkedHashMap<String, Int>()
        for (c in myC) for (t in subtypes(c)) tribe[t] = (tribe[t] ?: 0) + 1
        for ((t, n) in tribe) if (n > (tribes[t] ?: 0)) tribes[t] = n
        maxSlivers = maxOf(maxSlivers, myC.count { SLIVER.containsMatchIn(it.type.ifEmpty { it.name ?: "" }) })
        val prevTheirs = field.values.count { it.creature && it.controller != seat }
        if (prevTheirs >= 3 && theirC.isEmpty()) oppWipes++
        oppMaxCreatures = maxOf(oppMaxCreatures, theirC.size)
        endCreatures = mine.count(::isCreature); oppEndCreatures = theirC.size
        for (c in bf) if (c.known && !c.name.isNullOrEmpty()) (if (c.controller == seat) myCards else theirCards).add(c.name)
        // Creatures that left the battlefield for a graveyard or exile died; tokens just vanish. A creature that left
        // waits until it lands somewhere public (or never shows up again, and is dropped after a while).
        val onField = bf.map { it.id }.toSet(); val byId = cards.associateBy { it.id }
        val pile = HashMap<String, Int>()
        for (c in cards) if ((c.zone == "Graveyard" || c.zone == "Exile") && c.known && !c.name.isNullOrEmpty()) { val k = "${c.owner}|${c.name}"; pile[k] = (pile[k] ?: 0) + 1 }
        val grew = HashMap(pile.mapValues { (k, n) -> n - (lastPile[k] ?: 0) })
        for ((id, was) in field) if (was.creature && id !in onField) pending[id] = Was(was.controller, was.owner, was.creature, was.token, was.name)
        fun died(was: Was) { if (was.controller == seat) { losses++; was.name?.let { myDead.add(it) } } else { kills++; was.name?.let { killed.add(it) } } }
        val it = pending.entries.iterator()
        while (it.hasNext()) {
            val (id, was) = it.next(); val c = byId[id]; val k = "${was.owner}|${was.name}"
            if (id in onField) { it.remove(); continue }
            if (was.token) { died(was); it.remove(); continue }
            if (c != null && (c.zone == "Graveyard" || c.zone == "Exile")) { died(was); it.remove(); if ((grew[k] ?: 0) > 0) grew[k] = grew[k]!! - 1; continue }
            if (c == null && was.name != null && (grew[k] ?: 0) > 0) { died(was); it.remove(); grew[k] = grew[k]!! - 1; continue }
            if (++was.age > 40) it.remove()
        }
        lastPile = pile
        // A face-down card turned up, or a card that changed its face in place (flip, transform).
        for (c in mine) {
            if (!lastFace.containsKey(c.id)) continue
            val before = lastFace[c.id]
            if (before == null && c.known) turnedUp++ else if (before != null && c.known && !c.name.isNullOrEmpty() && c.name != before) flipped++
        }
        field.clear(); lastFace.clear()
        for (c in bf) {
            field[c.id] = Was(c.controller, c.owner, isCreature(c), c.isToken, if (!c.known) null else c.name)
            if (c.controller == seat) lastFace[c.id] = if (!c.known) null else (c.name ?: "")
        }
    }

    /** snapshot(): the facts as plain JSON (sets become sorted lists), with [onPlay] as extra. */
    fun snapshot(onPlay: Boolean?): JsonObject = JsonObject().apply {
        fun n(k: String, v: Int?) { if (v == null) add(k, com.google.gson.JsonNull.INSTANCE) else addProperty(k, v) }
        n("turns", turns); n("myTurns", myTurns); n("minLife", minLife); n("endLife", endLife); n("maxLife", maxLife); n("lifeGained", lifeGained); n("startLife", startLifeF)
        n("oppEndLife", oppEndLife); n("oppMinLife", oppMinLife); n("oppBigTurn", oppBigTurn); n("oppPoison", oppPoison); n("myPoison", myPoison); n("oppLibraryMin", oppLibraryMin); n("oppHandMin", oppHandMin); n("maxHand", maxHand)
        n("maxCreatures", maxCreatures); n("maxTokens", maxTokens); n("maxLands", maxLands); n("maxArtifacts", maxArtifacts); n("maxEnchantments", maxEnchantments); n("maxPower", maxPower); n("maxBoardPower", maxBoardPower); n("maxAttackers", maxAttackers)
        n("maxFlyers", maxFlyers); n("maxCounters", maxCounters); n("maxSuspended", maxSuspended); n("maxFaceDown", maxFaceDown); n("maxAttach", maxAttach); n("maxSlivers", maxSlivers)
        add("tribes", JsonObject().apply { tribes.forEach { (k, v) -> addProperty(k, v) } })
        n("oppMaxCreatures", oppMaxCreatures); n("oppWipes", oppWipes); n("kills", kills); n("losses", losses); n("turnedUp", turnedUp); n("flipped", flipped); n("endCreatures", endCreatures); n("oppEndCreatures", oppEndCreatures)
        fun l(k: String, s: Set<String>) = add(k, JsonArray().apply { s.forEach { add(it) } })
        l("myCards", myCards); l("theirCards", theirCards); l("killed", killed); l("myDead", myDead)
        if (onPlay == null) add("onPlay", com.google.gson.JsonNull.INSTANCE) else addProperty("onPlay", onPlay)
    }
}
