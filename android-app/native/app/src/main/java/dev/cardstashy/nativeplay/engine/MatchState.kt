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
    val commander: Boolean = false, val setCode: String? = null, val collectorNumber: String? = null,
    /** Who or what this attacker attacks (a player or a planeswalker/battle), when Forge says. */
    val attackTarget: Ref? = null,
    /** Forge sent its own keyword list (an empty list then means none); otherwise the rules text decides. */
    val keywordsKnown: Boolean = false, val attachments: List<Int> = emptyList(), val crew: Int? = null,
    /** Forge says this creature attacks each combat if able (native-panel.mjs owesAttack). */
    val mustAttack: Boolean = false,
) {
    val isLand get() = type.contains("Land")
    val isCreature get() = type.contains("Creature")
}

data class Player(
    val id: Int, val name: String, val life: Int, val isViewer: Boolean,
    val handCount: Int, val libraryCount: Int,
    val hand: List<Card>, val battlefield: List<Card>, val graveyard: List<Card>, val exile: List<Card>,
    val command: List<Card> = emptyList(), val mana: Map<String, Int> = emptyMap(), val counters: Map<String, Int> = emptyMap(),
    /** players[].commanderDamage: what each opponent's commander has dealt this player. */
    val commanderDamage: List<CommanderDamage> = emptyList(),
)
data class CommanderDamage(val from: Int, val commander: String, val damage: Int)

data class StackItem(val id: Int, val text: String, val source: Card?, val controller: Int, val ability: Boolean = false, val yielded: Boolean = false, val targets: List<Ref> = emptyList())
data class Buttons(val ok: String?, val cancel: String?, val okEnabled: Boolean, val cancelEnabled: Boolean)
data class Selection(
    val cards: Set<Int>, val players: Set<Int>, val chosenCards: Set<Int>, val chosenPlayers: Set<Int>,
    val actionable: Set<Int>, val blocked: Map<Int, String>, val min: Int, val max: Int,
    /** Cards Forge offers as targets for the spell or ability being cast (selection.targets). */
    val targetCards: Set<Int> = emptySet(),
    /** selection.actionable[].affordability: available, unavailable, uncertain or unknown (Forge's own pay check). */
    val affordability: Map<Int, String> = emptyMap(),
    /** Stack items Forge offers as targets (selection.targets of kind stack), and the players among the targets. */
    val stackTargets: Set<Int> = emptySet(), val targetPlayers: Set<Int> = emptySet(),
)
/** n.payment while Forge asks for mana: what is still owed, the card it is for, and the real cost for the chosen target. */
data class Payment(val remaining: String?, val forCard: Int?, val forName: String?, val costNow: String?)
data class PromptOption(
    val index: Int, val label: String, val cardId: Int?,
    /** value.kind ("card", "ability", "player", "optionalCost"…), when the option is an object. */
    val kind: String? = null,
    /** The zone of the option's card (value.card.zone, else value.zone). */
    val zone: String? = null,
    /** isDescribedOption (native-panel.mjs): a primitive, or a visible object with a name, description or text. */
    val described: Boolean = true,
    /** value.card.id / value.card.zone even when the card is not shown (modeBackOutOffered). */
    val rawCardId: Int? = null, val cardZone: String? = null,
    /** The option's card name (value.card.name, else value.name) when it is visible. */
    val cardName: String? = null,
    /** value.id for a player option. */
    val playerId: Int? = null,
    /** String(value) for a primitive option (showInputDialog sends it back). */
    val valueText: String? = null,
)
data class Prompt(
    val id: Int, val method: String, val message: String, val min: Int, val max: Int,
    val options: List<PromptOption>, val supported: Boolean, val ordered: Boolean, val destinationIndexes: List<Int>,
    val assignAmount: Int?, val assignMaxima: List<Int>, val maySkip: Boolean,
    val assignLethal: List<Int?>, val defenderIndex: Int?,
    val sourceIndexes: List<Int> = emptyList(), val remainingMin: Int? = null, val remainingMax: Int? = null,
    val rememberAllowed: Boolean = false, val topLabel: String? = null, val acknowledgeOnly: Boolean = false,
    val cancelable: Boolean = false, val numeric: Boolean = false,
    /** assign.freeDivision / assign.atLeastOne / assign.label; whether assign.lethal / assign.maxima came as arrays. */
    val assignFree: Boolean = false, val assignAtLeastOne: Boolean = false, val assignLabel: String = "",
    val hasLethal: Boolean = false, val hasMaxima: Boolean = false,
    /** Whether supported came as true (the site's p.supported===true). */
    val supportedExact: Boolean = true,
    /** Forge's message before tidy() (the dock's cpuName works on Forge's own words). */
    val rawMessage: String = "",
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
    /** events.items[].number (a turn event's turn), fizzled (left the stack with no legal targets), token (a token was created). */
    val number: Int? = null, val fizzled: Boolean = false, val token: Boolean = false,

)

/** The host's turn window as sent: whose it is, why, its length, the time left when the host wrote it, and the strikes. */
data class Afk(val own: Boolean, val reason: String, val total: Long, val remainingMs: Long, val strikes: Int, val strikeLimit: Int)

data class MatchState(
    val revision: Long, val status: String, val failure: String?, val errors: List<String>,
    val viewer: Int, val turn: Int, val phase: String?, val activePlayer: Int?, val priorityPlayer: Int?,
    val players: List<Player>, val stack: List<StackItem>, val buttons: Buttons, val inputType: String?,
    val selection: Selection, val prompt: Prompt?, val busy: Boolean, val message: String,
    val events: List<GameEvent>, val winnerPlayerId: Int?, val draw: Boolean, val priorityStop: String?,
    val hasPriorityView: Boolean, val lastActionError: String?, val controlMode: String?,
    /** Auto-pay mana (null on a bridge without it); phase stops "you:MAIN1" → pinned (true) or once (false), null when the bridge has none. */
    val autoPay: Boolean? = null, val phaseStops: Map<String, Boolean>? = null,
    val payment: Payment? = null,
    /** snapshot.pregame (forgeStartingPlayer): who Forge committed to start, and how it was chosen (random = the coin). */
    val firstPlayerId: Int? = null, val startSelection: String? = null,
    /** A friend match host's turn clock (afk): absent on hosts without one ([hasAfk] false), null when no window is open. */
    val hasAfk: Boolean = false, val afk: Afk? = null,
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
                min = sel?.int("min") ?: 0, max = sel?.int("max") ?: 0, targetCards = refs("targets", "card"),
                stackTargets = refs("targets", "stack"), targetPlayers = refs("targets", "player"),
                affordability = sel?.arr("actionable")?.mapNotNull { e -> e.asJsonObject.takeIf { it.str("kind") == "card" }?.let { x -> val id = x.int("id"); val a = x.str("affordability"); if (id != null && a != null) id to a else null } }?.toMap() ?: emptyMap(),
            )
            val b = o.obj("buttons")
            val init = o.obj("initialization")
            val pv = o.obj("priority")
            // Players are "You" and "CPU" in every line the table shows; "Forge AI" never reaches the screen.
            return MatchState(
                revision = o.get("revision")?.takeIf { !it.isJsonNull }?.asLong ?: 0, status = status, failure = o.str("failure"),
                errors = init?.arr("errors")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList(),
                viewer = viewer, turn = o.int("turn") ?: 0, phase = o.str("phase"), activePlayer = o.int("activePlayer"), priorityPlayer = o.int("priorityPlayer"),
                players = players,
                stack = o.arr("stack").map { e -> val s = e.asJsonObject; StackItem(s.int("id") ?: 0, tidy((s.str("text") ?: "").replace(Regex("\\s*\\[Phase: [^\\]]*\\]"), "").trim()), s.obj("source")?.let { parseCard(it) }, s.int("activatingPlayer") ?: -1, s.bool("ability") == true, s.bool("yielded") == true, refsOf(s, "targets")) },
                buttons = Buttons(b?.str("ok"), b?.str("cancel"), b?.bool("okEnabled") == true, b?.bool("cancelEnabled") == true),
                inputType = o.str("inputType"), selection = selection, prompt = o.obj("prompt")?.let { parsePrompt(it) }?.let { p -> p.copy(message = tidy(p.message), options = p.options.map { it.copy(label = tidy(it.label)) }) },
                busy = o.bool("busy") == true, message = tidy(o.str("message") ?: ""),
                events = o.obj("events")?.arr("items")?.map { parseEvent(it.asJsonObject) } ?: emptyList(),
                winnerPlayerId = o.int("winnerPlayerId"), draw = o.bool("draw") == true,
                priorityStop = pv?.str("stop"), hasPriorityView = pv != null, lastActionError = o.str("lastActionError"), controlMode = o.str("controlMode"),
                payment = o.obj("payment")?.let { pm -> val fc = pm.obj("forCard")?.takeIf { it.str("kind") == "card" }
                    Payment(pm.get("remaining")?.takeIf { it.isJsonPrimitive }?.asString, fc?.int("id"), fc?.str("name"), pm.obj("costNow")?.get("mana")?.takeIf { it.isJsonPrimitive }?.asString) },
                hasAfk = o.has("afk"), afk = o.obj("afk")?.let { a -> Afk(a.bool("own") == true, a.str("reason") ?: "turn", a.get("total")?.takeIf { it.isJsonPrimitive }?.asLong ?: 90_000,
                    a.get("remainingMs")?.takeIf { it.isJsonPrimitive }?.asLong ?: 0, a.int("strikes") ?: 0, a.int("strikeLimit") ?: 3) },
                firstPlayerId = o.obj("pregame")?.int("firstPlayerId"), startSelection = o.obj("pregame")?.str("selection"),
                autoPay = o.bool("autoPay"), phaseStops = o.obj("phaseStops")?.entrySet()?.mapNotNull { (k, v) -> if (v.isJsonPrimitive && v.asJsonPrimitive.isBoolean) k to v.asBoolean else null }?.toMap(),
            )
        }

        /**
         * Forge's lines with plain seat names: both seats reach Forge named "You" and "CPU" (quickInput),
         * so only Forge's own "Forge AI" label and the grammar around the two names need fixing. Card
         * names are never touched (a deck may share a card's name).
         */
        fun tidy(text: String): String = text
            .replace(Regex("Forge AI(\\s*[—–-]\\s*CPU)?"), "CPU")
            .replace(Regex("(?<![Tt]he )\\bCPU's"), "the CPU's")
            .replace(Regex("\\bin You's\\b"), "in your").replace(Regex("\\bYou's\\b"), "Your").replace(Regex("\\bYou is\\b"), "You are")

        private fun parsePlayer(p: JsonObject): Player {
            val z = p.obj("zones")
            fun cards(zone: String) = z?.obj(zone)?.arr("cards")?.map { parseCard(it.asJsonObject) } ?: emptyList()
            return Player(
                id = p.int("id") ?: 0, name = p.str("name") ?: "", life = p.int("life") ?: 0, isViewer = p.bool("isViewer") == true,
                handCount = z?.obj("Hand")?.int("count") ?: 0, libraryCount = z?.obj("Library")?.int("count") ?: 0,
                hand = cards("Hand"), battlefield = cards("Battlefield"), graveyard = cards("Graveyard"), exile = cards("Exile"),
                command = cards("Command"), mana = nums(p.obj("mana")), counters = nums(p.obj("counters")),
                commanderDamage = p.arr("commanderDamage").mapNotNull { e -> (e as? JsonObject)?.let { x -> val f = x.int("from"); val dmg = x.int("damage"); val c = x.str("commander"); if (f != null && dmg != null && dmg >= 0 && c != null) CommanderDamage(f, c.take(200), dmg) else null } },
            )
        }

        private fun nums(o: JsonObject?) = o?.entrySet()?.mapNotNull { (k, v) -> if (v.isJsonPrimitive && v.asJsonPrimitive.isNumber) k to v.asInt else null }?.toMap() ?: emptyMap()

        fun parseCard(c: JsonObject) = Card(
            id = c.int("id") ?: 0, zone = c.str("zone") ?: "", owner = c.int("owner") ?: -1, controller = c.int("controller") ?: -1,
            hidden = c.bool("hidden") != false, name = c.str("name") ?: "", type = c.str("type") ?: "", manaCost = c.str("manaCost")?.takeIf { it != "no cost" } ?: "",
            text = (c.str("text") ?: "").replace("\r", ""), power = c.int("power"), toughness = c.int("toughness"),
            tapped = c.bool("tapped") == true, attacking = c.bool("attacking") == true, blocking = c.bool("blocking") == true,
            damage = c.int("damage") ?: 0, summoningSick = c.bool("summoningSick") == true, token = c.bool("token") == true,
            counters = c.obj("counters")?.entrySet()?.mapNotNull { (k, v) -> if (v.isJsonPrimitive && v.asJsonPrimitive.isNumber) k to v.asInt else null }?.toMap() ?: emptyMap(),
            keywords = c.arr("keywords").mapNotNull { if (it.isJsonPrimitive) it.asString.replace(Regex("([a-z])([A-Z])"), "$1 $2") else it.asJsonObject.let { o -> o.str("text") ?: o.str("keyword") } },
            keywordsKnown = c.get("keywords")?.isJsonArray == true,
            attachments = c.arr("attachments").mapNotNull { if (it.isJsonPrimitive && it.asJsonPrimitive.isNumber) it.asInt else null }, crew = c.int("crew"),
            attachedTo = c.int("attachedTo"), blockingIds = c.arr("blockingIds").mapNotNull { if (it.isJsonPrimitive) it.asInt else null },
            commander = c.bool("commander") == true, setCode = c.str("setCode"), collectorNumber = c.str("collectorNumber"),
            mustAttack = c.bool("mustAttack") == true,
            attackTarget = c.obj("attackTarget")?.let { t -> val k = t.str("kind"); val i = t.int("id"); if (k != null && i != null) Ref(k, i, null) else null },
        )

        private fun parsePrompt(p: JsonObject): Prompt {
            val assign = p.obj("assign")
            return Prompt(
                id = p.int("id") ?: 0, method = p.str("method") ?: "", message = p.str("message") ?: "",
                min = p.int("min") ?: 0, max = p.int("max") ?: 0,
                options = p.arr("options").map { e -> val x = e.asJsonObject; val v = x.get("value"); option(x.int("index") ?: 0, v) },
                supported = p.bool("supported") != false, ordered = p.bool("ordered") == true,
                destinationIndexes = p.arr("destinationIndexes").map { it.asInt },
                assignAmount = assign?.int("amount"), assignMaxima = assign?.arr("maxima")?.map { if (it.isJsonPrimitive) it.asInt else 0 } ?: emptyList(),
                maySkip = assign?.bool("maySkip") == true,
                assignLethal = assign?.arr("lethal")?.map { if (it.isJsonPrimitive) it.asInt else null } ?: emptyList(),
                defenderIndex = assign?.int("defenderIndex"),
                sourceIndexes = p.arr("sourceIndexes").mapNotNull { if (it.isJsonPrimitive && it.asJsonPrimitive.isNumber) it.asInt else null },
                remainingMin = p.int("remainingMin"), remainingMax = p.int("remainingMax"),
                rememberAllowed = p.bool("rememberAllowed") == true, topLabel = p.str("topLabel"), acknowledgeOnly = p.bool("acknowledgeOnly") == true,
                cancelable = p.bool("cancelable") == true, numeric = p.bool("numeric") == true,
                assignFree = assign?.bool("freeDivision") == true, assignAtLeastOne = assign?.bool("atLeastOne") == true, assignLabel = assign?.str("label") ?: "",
                hasLethal = assign?.get("lethal")?.isJsonArray == true, hasMaxima = assign?.get("maxima")?.isJsonArray == true,
                supportedExact = p.bool("supported") == true, rawMessage = p.str("message") ?: "",
            )
        }

        private fun option(index: Int, v: JsonElement?): PromptOption {
            val o = v?.takeIf { it.isJsonObject }?.asJsonObject
            val c = o?.obj("card")
            // isDescribedOption (native-panel.mjs:55).
            val described = v != null && !v.isJsonNull && (v.isJsonPrimitive || (o != null && o.bool("hidden") != true && c?.bool("hidden") != true && (o.str("name") != null || o.str("description") != null || o.str("text") != null)))
            val visible = o != null && o.bool("hidden") != true && c?.bool("hidden") != true
            return PromptOption(index, label(v), cardId(v), kind = o?.str("kind"), zone = c?.str("zone") ?: o?.str("zone"), described = described,
                rawCardId = c?.int("id"), cardZone = c?.str("zone"), cardName = if (visible) c?.str("name") ?: o?.str("name") else null,
                playerId = if (o?.str("kind") == "player") o.int("id") else null, valueText = v?.takeIf { it.isJsonPrimitive }?.asString)
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
            number = e.int("number"), fizzled = e.bool("fizzled") == true, token = e.bool("token") == true,
        )
    }
}

private fun JsonObject.str(k: String): String? = get(k)?.takeIf { it.isJsonPrimitive }?.asString
private fun JsonObject.int(k: String): Int? = get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt
internal fun refsOf(o: JsonObject, k: String): List<Ref> = o.get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { e -> e.takeIf { it.isJsonObject }?.asJsonObject?.let { r -> val kind = r.get("kind")?.takeIf { it.isJsonPrimitive }?.asString; val id = r.get("id")?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt; if (kind != null && id != null) Ref(kind, id, r.get("name")?.takeIf { it.isJsonPrimitive }?.asString) else null } } ?: emptyList()
private fun JsonObject.bool(k: String): Boolean? = get(k)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean
private fun JsonObject.obj(k: String): JsonObject? = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.arr(k: String): JsonArray = get(k)?.takeIf { it.isJsonArray }?.asJsonArray ?: JsonArray()
