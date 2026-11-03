package dev.cardstashy.nativeplay.engine

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/** The fields of the bridge's cardstashy.forge-proof.v1 snapshot that the table reads. */
data class Card(
    val id: Int, val zone: String, val owner: Int, val controller: Int, val hidden: Boolean,
    val name: String, val type: String, val manaCost: String, val text: String,
    val power: Int?, val toughness: Int?, val tapped: Boolean, val attacking: Boolean, val blocking: Boolean,
    val damage: Int, val summoningSick: Boolean, val token: Boolean, val counters: Map<String, Int>,
    val keywords: List<String>, val attachedTo: Int?, val blockingIds: List<Int>,
) {
    val isLand get() = type.contains("Land")
    val isCreature get() = type.contains("Creature")
}

data class Player(
    val id: Int, val name: String, val life: Int, val isViewer: Boolean,
    val handCount: Int, val libraryCount: Int,
    val hand: List<Card>, val battlefield: List<Card>, val graveyard: List<Card>, val exile: List<Card>,
)

data class StackItem(val id: Int, val text: String, val source: Card?, val controller: Int)
data class Buttons(val ok: String?, val cancel: String?, val okEnabled: Boolean, val cancelEnabled: Boolean)
data class Selection(
    val cards: Set<Int>, val players: Set<Int>, val chosenCards: Set<Int>, val chosenPlayers: Set<Int>,
    val actionable: Set<Int>, val blocked: Map<Int, String>, val min: Int, val max: Int,
)
data class PromptOption(val index: Int, val label: String, val cardId: Int?)
data class Prompt(
    val id: Int, val method: String, val message: String, val min: Int, val max: Int,
    val options: List<PromptOption>, val supported: Boolean, val ordered: Boolean, val destinationIndexes: List<Int>,
    val assignAmount: Int?, val assignMaxima: List<Int>, val maySkip: Boolean,
    val assignLethal: List<Int?>, val defenderIndex: Int?,
) {
    /** Forge's damage split done the plain way: lethal to each blocker in order, the rest to the
     *  defender (trample) or the last blocker; a generic split fills each target up to its maximum. */
    fun autoAssign(): List<Int> {
        var left = assignAmount ?: 0
        val out = MutableList(options.size) { 0 }
        if (assignLethal.isNotEmpty()) {
            for (i in out.indices) { if (i == defenderIndex) continue; val l = assignLethal.getOrNull(i) ?: 0; val take = minOf(left, l); out[i] = take; left -= take }
            val sink = defenderIndex ?: out.indices.lastOrNull { it != defenderIndex } ?: return out
            out[sink] += left
        } else {
            for (i in out.indices) { val take = minOf(left, assignMaxima.getOrElse(i) { left }); out[i] = take; left -= take }
            if (left > 0 && out.isNotEmpty()) out[out.lastIndex] += left
        }
        return out
    }
}
data class Ref(val kind: String, val id: Int, val name: String?)
data class GameEvent(
    val seq: Long, val type: String, val turn: Int, val phase: String?, val player: Int?,
    val card: Ref?, val source: Ref?, val target: Ref?, val targets: List<Ref>, val attackers: List<Pair<Ref, Ref?>>, val blockers: List<Pair<Ref, Int?>>,
    val from: String?, val to: String?, val amount: Int?, val lifeFrom: Int?, val lifeTo: Int?, val cause: String?,
)

data class MatchState(
    val revision: Long, val status: String, val failure: String?, val errors: List<String>,
    val viewer: Int, val turn: Int, val phase: String?, val activePlayer: Int?, val priorityPlayer: Int?,
    val players: List<Player>, val stack: List<StackItem>, val buttons: Buttons, val inputType: String?,
    val selection: Selection, val prompt: Prompt?, val busy: Boolean, val message: String,
    val events: List<GameEvent>, val winnerPlayerId: Int?, val draw: Boolean, val priorityStop: String?,
    val hasPriorityView: Boolean, val lastActionError: String?, val controlMode: String?,
) {
    val me get() = players.first { it.id == viewer }
    val cpu get() = players.first { it.id != viewer }
    val finished get() = status == "finished"
    fun card(id: Int): Card? = players.firstNotNullOfOrNull { p -> (p.battlefield + p.hand + p.graveyard + p.exile).firstOrNull { it.id == id } }
        ?: stack.firstOrNull { it.source?.id == id }?.source

    /** The opening-hand decision: keep/mulligan, or picking cards to put on the bottom after a mulligan. */
    val isMulligan get() = if (hasPriorityView) priorityStop == "mulligan" || (turn == 0 && status == "running") else turn == 0 && status == "running"

    /** Forge is waiting on this player and is not working. */
    val waitingOnMe get() = status == "running" && !busy && (prompt != null || (inputType != null && inputType != "InputLockUI"))

    companion object {
        fun parse(json: String): MatchState? {
            val o = JsonParser.parseString(json).asJsonObject
            val status = o.str("status") ?: return null
            if (status == "initializing") return null
            val viewer = o.int("viewer") ?: 0
            val players = o.arr("players").map { parsePlayer(it.asJsonObject) }
            val sel = o.obj("selection")
            fun refs(key: String, kind: String) = sel?.arr(key)?.mapNotNull { e -> e.asJsonObject.takeIf { it.str("kind") == kind }?.int("id") }?.toSet() ?: emptySet()
            val selection = Selection(
                cards = refs("cards", "card"), players = refs("targets", "player") + refs("cards", "player"),
                chosenCards = refs("chosen", "card"), chosenPlayers = refs("chosen", "player"),
                actionable = refs("actionable", "card"),
                blocked = sel?.arr("blocked")?.mapNotNull { e -> val x = e.asJsonObject; x.int("id")?.let { it to (x.str("reason") ?: "") } }?.toMap() ?: emptyMap(),
                min = sel?.int("min") ?: 0, max = sel?.int("max") ?: 0,
            )
            val b = o.obj("buttons")
            val init = o.obj("initialization")
            val pv = o.obj("priority")
            // Players are "You" and "CPU" in every line the table shows: Forge's own names
            // ("Forge AI", deck names) never reach the screen.
            val tidy = names(players, viewer)
            return MatchState(
                revision = o.get("revision")?.takeIf { !it.isJsonNull }?.asLong ?: 0, status = status, failure = o.str("failure"),
                errors = init?.arr("errors")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList(),
                viewer = viewer, turn = o.int("turn") ?: 0, phase = o.str("phase"), activePlayer = o.int("activePlayer"), priorityPlayer = o.int("priorityPlayer"),
                players = players,
                stack = o.arr("stack").map { e -> val s = e.asJsonObject; StackItem(s.int("id") ?: 0, tidy((s.str("text") ?: "").replace(Regex("\\s*\\[Phase: [^\\]]*\\]"), "").trim()), s.obj("source")?.let { parseCard(it) }, s.int("activatingPlayer") ?: -1) },
                buttons = Buttons(b?.str("ok"), b?.str("cancel"), b?.bool("okEnabled") == true, b?.bool("cancelEnabled") == true),
                inputType = o.str("inputType"), selection = selection, prompt = o.obj("prompt")?.let { parsePrompt(it) }?.let { p -> p.copy(message = tidy(p.message), options = p.options.map { it.copy(label = tidy(it.label)) }) },
                busy = o.bool("busy") == true, message = tidy(o.str("message") ?: ""),
                events = o.obj("events")?.arr("items")?.map { parseEvent(it.asJsonObject) } ?: emptyList(),
                winnerPlayerId = o.int("winnerPlayerId"), draw = o.bool("draw") == true,
                priorityStop = pv?.str("stop"), hasPriorityView = pv != null, lastActionError = o.str("lastActionError"), controlMode = o.str("controlMode"),
            )
        }

        /** Replaces Forge's player names with "You" and "CPU" (longest first, so "Forge AI — deck" goes whole). */
        fun names(players: List<Player>, viewer: Int) = namesFor(players.associate { it.id to it.name }, viewer)
        fun namesFor(players: Map<Int, String>, viewer: Int): (String) -> String {
            val swaps = players.filter { it.value.isNotBlank() }.map { (id, name) -> name to if (id == viewer) "You" else "CPU" }
                .plus(listOf("Forge AI" to "CPU")).sortedByDescending { it.first.length }
            return { text -> var t = text; for ((from, to) in swaps) t = t.replace(from, to)
                t.replace(Regex("CPU\\s*[—–-]\\s*CPU"), "CPU").replace(Regex("(?<![Tt]he )CPU's"), "the CPU's").replace("in You's", "in your").replace("You is", "You are").replace("You's", "Your") }
        }

        private fun parsePlayer(p: JsonObject): Player {
            val z = p.obj("zones")
            fun cards(zone: String) = z?.obj(zone)?.arr("cards")?.map { parseCard(it.asJsonObject) } ?: emptyList()
            return Player(
                id = p.int("id") ?: 0, name = p.str("name") ?: "", life = p.int("life") ?: 0, isViewer = p.bool("isViewer") == true,
                handCount = z?.obj("Hand")?.int("count") ?: 0, libraryCount = z?.obj("Library")?.int("count") ?: 0,
                hand = cards("Hand"), battlefield = cards("Battlefield"), graveyard = cards("Graveyard"), exile = cards("Exile"),
            )
        }

        fun parseCard(c: JsonObject) = Card(
            id = c.int("id") ?: 0, zone = c.str("zone") ?: "", owner = c.int("owner") ?: -1, controller = c.int("controller") ?: -1,
            hidden = c.bool("hidden") != false, name = c.str("name") ?: "", type = c.str("type") ?: "", manaCost = c.str("manaCost")?.takeIf { it != "no cost" } ?: "",
            text = (c.str("text") ?: "").replace("\r", ""), power = c.int("power"), toughness = c.int("toughness"),
            tapped = c.bool("tapped") == true, attacking = c.bool("attacking") == true, blocking = c.bool("blocking") == true,
            damage = c.int("damage") ?: 0, summoningSick = c.bool("summoningSick") == true, token = c.bool("token") == true,
            counters = c.obj("counters")?.entrySet()?.mapNotNull { (k, v) -> if (v.isJsonPrimitive && v.asJsonPrimitive.isNumber) k to v.asInt else null }?.toMap() ?: emptyMap(),
            keywords = c.arr("keywords").mapNotNull { if (it.isJsonPrimitive) it.asString else it.asJsonObject.str("keyword") },
            attachedTo = c.int("attachedTo"), blockingIds = c.arr("blockingIds").mapNotNull { if (it.isJsonPrimitive) it.asInt else null },
        )

        private fun parsePrompt(p: JsonObject): Prompt {
            val assign = p.obj("assign")
            return Prompt(
                id = p.int("id") ?: 0, method = p.str("method") ?: "", message = p.str("message") ?: "",
                min = p.int("min") ?: 0, max = p.int("max") ?: 0,
                options = p.arr("options").map { e -> val x = e.asJsonObject; val v = x.get("value"); PromptOption(x.int("index") ?: 0, label(v), cardId(v)) },
                supported = p.bool("supported") != false, ordered = p.bool("ordered") == true,
                destinationIndexes = p.arr("destinationIndexes").map { it.asInt },
                assignAmount = assign?.int("amount"), assignMaxima = assign?.arr("maxima")?.map { if (it.isJsonPrimitive) it.asInt else 0 } ?: emptyList(),
                maySkip = assign?.bool("maySkip") == true,
                assignLethal = assign?.arr("lethal")?.map { if (it.isJsonPrimitive) it.asInt else null } ?: emptyList(),
                defenderIndex = assign?.int("defenderIndex"),
            )
        }

        // optionLabel / optionCardId in forge-session.mjs.
        private fun label(v: JsonElement?): String = when {
            v == null || v.isJsonNull -> "Option"
            v.isJsonPrimitive -> v.asString
            v.isJsonObject -> { val o = v.asJsonObject; val c = o.obj("card") ?: o
                if (o.bool("hidden") == true || c.bool("hidden") == true) "Face-down card" else o.str("description") ?: o.str("name") ?: o.str("text") ?: c.str("name") ?: "Option" }
            else -> "Option"
        }
        private fun cardId(v: JsonElement?): Int? {
            if (v == null || !v.isJsonObject) return null
            val c = v.asJsonObject.obj("card") ?: v.asJsonObject
            return if (c.bool("hidden") == false && c.str("name") != null) c.int("id") else null
        }

        private fun ref(e: JsonElement?): Ref? = e?.takeIf { it.isJsonObject }?.asJsonObject?.let { Ref(it.str("kind") ?: "", it.int("id") ?: -1, it.str("name")) }

        private fun parseEvent(e: JsonObject) = GameEvent(
            seq = e.get("seq")?.asLong ?: 0, type = e.str("type") ?: "", turn = e.int("turn") ?: 0, phase = e.str("phase"), player = e.int("player"),
            card = ref(e.get("card")), source = ref(e.get("source")), target = ref(e.get("target")),
            targets = e.arr("targets").mapNotNull { ref(it) },
            attackers = e.arr("attackers").mapNotNull { a -> ref(a)?.let { it to ref(a.asJsonObject.get("target")) } },
            blockers = e.arr("blockers").mapNotNull { b -> ref(b)?.let { it to b.asJsonObject.int("blocking") } },
            from = e.str("from"), to = e.str("to"), amount = e.int("amount"),
            lifeFrom = if (e.str("type") == "life") e.int("from") else null, lifeTo = if (e.str("type") == "life") e.int("to") else null,
            cause = e.str("cause"),
        )
    }
}

private fun JsonObject.str(k: String): String? = get(k)?.takeIf { it.isJsonPrimitive }?.asString
private fun JsonObject.int(k: String): Int? = get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt
private fun JsonObject.bool(k: String): Boolean? = get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean
private fun JsonObject.obj(k: String): JsonObject? = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.arr(k: String): JsonArray = get(k)?.takeIf { it.isJsonArray }?.asJsonArray ?: JsonArray()
