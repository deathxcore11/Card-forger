package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.forgeInput
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Every Result Names Its Cause (Randall 14 Nov: "a card will do something and ill just not know"). Plays a real match on the
 * engine to the three moments of the approved preview and prints every event exactly as the bridge wrote it, so the table's cause
 * plates read real Forge data: Sheltered by Ghosts exiles a card, Feather of Flight draws one, and a destroy takes the creature
 * (its Auras fall off, the exiled card comes back). Run with ENGINE_ROOT=<unpacked pack.zip>; CAUSE_OUT=<file> also writes the log.
 */
class CauseProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    private fun names(vararg n: String) = JsonArray().apply { n.forEach { add(it) } }

    /** [murder]: you destroy your own enchanted creature on turn 4; else you stop after turn 3 and the CPU's Ravenous Chupacabra may. */
    private fun play(murder: Boolean, tag: String): List<String> {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 24, "Swamp" to 20, "Savannah Lions" to 4, "Sheltered by Ghosts" to 4, "Feather of Flight" to 4, "Murder" to 4)
        val cpu = deck("Swamp" to 48, "Memnite" to 4, "Ravenous Chupacabra" to 4, "Vampire Nighthawk" to 4)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", names("Plains", "Savannah Lions", "Plains", "Sheltered by Ghosts", "Swamp", "Feather of Flight", "Swamp", "Murder", "Plains", "Plains"))
            add("villain", names("Swamp", "Memnite", "Swamp", "Swamp", "Swamp", "Ravenous Chupacabra", "Swamp", "Swamp", "Vampire Nighthawk", "Swamp", "Swamp", "Swamp", "Ravenous Chupacabra")) })
            addProperty("noMulligan", true) }
        val out = StringBuilder(); val states = StringBuilder()
        fun say(s: String) { println(s); out.append(s).append('\n') }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 400_000; var lastRev = -1L; var lastSeq = -1L
        var dirSeq = -1L; var prev: MatchState? = null; var held = emptyMap<Int, Int>(); val triggerIds = HashSet<Int>(); val told = ArrayList<String>()
        val plan = listOf("Savannah Lions", "Sheltered by Ghosts", "Feather of Flight") + if (murder) listOf("Murder") else emptyList()
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            // Every event since the last board, as the bridge wrote it.
            val items = runCatching { JsonParser.parseString(raw).asJsonObject.getAsJsonObject("events").getAsJsonArray("items") }.getOrNull()
            if (items?.any { (it.asJsonObject.get("seq")?.asLong ?: -1) > lastSeq } == true) states.append(raw).append('\n')
            // The director reads every board the way the controller does: the board before, the new events, what it holds.
            val fresh = st.events.filter { it.seq > dirSeq }
            if (fresh.isNotEmpty()) {
                dirSeq = fresh.maxOf { it.seq }
                fresh.forEach { if (it.type == "trigger") it.stackId?.let(triggerIds::add) }
                for (step in Director.plan(st, fresh, before = prev, triggerIds = triggerIds, held = held)) step.result?.let { r ->
                    r.lines(st.viewer).forEach { l -> told += "${l.sourceName}: ${l.text}"; say("LINE[$tag] rev=${st.revision} ${l.sourceName}: ${l.text}") }
                    if (r.holds && r.sourceId != null) held = held + r.moves.filter { it.went == Director.Went.EXILED && it.cardId != null }.associate { it.cardId!! to r.sourceId!! }
                }
                held = Director.stillHeld(held, st)
            }
            prev = st
            items?.forEach { e -> val seq = e.asJsonObject.get("seq")?.asLong ?: -1; if (seq > lastSeq) { lastSeq = seq; say("EVENT[$tag] rev=${st.revision} $e") } }
            if (st.status == "failed" || st.finished || st.turn > (if (murder) 8 else 15)) { say("END[$tag] ${st.status} turn=${st.turn}"); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            val top = st.stack.firstOrNull()
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val mine = st.me.battlefield
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null && p.method == "order" -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { p.options.forEach { add(it.index) } }); addProperty("remember", false) }
                    p != null -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { add(0) }) }
                    st.inputType == "InputSelectTargets" -> {
                        val offered = st.selection.cards + st.selection.targetCards
                        val own = offered.firstOrNull { st.card(it)?.controller == st.viewer && st.card(it)?.isCreature == true }
                        val theirs = offered.firstOrNull { st.card(it)?.controller != st.viewer }
                        val pick = (if (st.message.contains("opponent controls", true)) theirs else own) ?: offered.firstOrNull()
                        say("TARGET[$tag] msg=<<${st.message}>> pick=${pick?.let { st.card(it)?.name }}")
                        if (pick != null && pick !in st.selection.chosenCards) { addProperty("op", "card"); addProperty("id", pick) } else addProperty("op", "ok")
                    }
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && top == null -> {
                        val want = plan.getOrNull(st.turn / 2)
                        val land = LANDS.getOrNull(st.turn / 2)
                        val next = hand.firstOrNull { it.isLand && it.name == land } ?: hand.firstOrNull { it.isLand } ?: hand.firstOrNull { it.name == want && (want == "Savannah Lions" || mine.any { c -> c.isCreature }) }
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) } else addProperty("op", "ok")
                    }
                    else -> addProperty("op", "ok")
                } }
            s.call("POST", "/action", body.toString())
        }
        s.close()
        say("TOLD[$tag] " + told.joinToString(" | "))
        System.getenv("CAUSE_OUT")?.let { File("$it-$tag.log").writeText(out.toString()); File("$it-$tag.states.jsonl").writeText(states.toString()) }
        return told
    }

    private companion object { /** White first: Savannah Lions and both Auras need it; Murder's two Swamps come after. */ val LANDS = listOf("Plains", "Plains", "Swamp", "Swamp") }

    private val fell = listOf("Savannah Lions: died, so its 2 Auras fell off", "Sheltered by Ghosts: left, so Memnite returns")

    /** Every result of the whole match and nothing else: no land play, draw step or combat is told as a card's doing. */
    @Test fun youDestroyYourOwn() = assertEquals(listOf("Sheltered by Ghosts: exiled Memnite", "Feather of Flight: drew you a card", "Murder: destroyed Savannah Lions") + fell,
        play(murder = true, tag = "murder"))
    @Test fun cpuAnswers() = assertEquals(listOf("Sheltered by Ghosts: exiled Memnite", "Feather of Flight: drew you a card", "Savannah Lions: countered Ravenous Chupacabra's ability",
        "Savannah Lions: ward: the CPU paid 2", "Ravenous Chupacabra: destroyed Savannah Lions") + fell, play(murder = false, tag = "cpu"))
}
