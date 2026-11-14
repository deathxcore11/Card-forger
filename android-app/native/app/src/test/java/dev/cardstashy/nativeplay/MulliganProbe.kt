package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.forgeInput
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * 0.4.59 T9: what Forge itself says at the opening hand, before and after a mulligan (its message, buttons, the input and how
 * many cards it asks to put on the bottom), so the Keep or Mulligan lines use Forge's numbers, never ours. Mulligans twice,
 * then keeps and prints each state. Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class MulliganProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }

    @Test fun whatForgeSaysAtTheOpeningHand() = run("Modern")
    @Test fun whatForgeSaysInCommander() = run("Commander")

    private fun run(format: String) {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 40, "Glory Seeker" to 4, "Savannah Lions" to 4, "Suntail Hawk" to 4, "Elite Vanguard" to 4, "Eager Cadet" to 4)
        val cpu = deck("Plains" to 40, "Glory Seeker" to 4, "Savannah Lions" to 4, "Suntail Hawk" to 4, "Elite Vanguard" to 4, "Eager Cadet" to 4)
        val cmd = deck("Isamaru, Hound of Konda" to 1, "Plains" to 99).apply { addProperty("commander", "Isamaru, Hound of Konda") }
        val s = LocalEngine.start(forgeInput(format, if (format == "Commander") cmd else hero, if (format == "Commander") cmd.deepCopy() else cpu, "Easy", startingPlayer = "first", quick = false), 7L)
        println("FORMAT $format")
        fun state(): MatchState { while (true) { MatchState.parse(s.call("GET", "/state", null).body())?.let { return it }; Thread.sleep(40) } }
        fun act(st: MatchState, op: String, id: Int? = null) = s.call("POST", "/action", JsonObject().apply { addProperty("revision", st.revision); addProperty("op", op); id?.let { addProperty("id", it) } }.toString())
        var mulls = 0; var lastRev = -1L; val until = System.currentTimeMillis() + 120_000
        while (System.currentTimeMillis() < until) {
            val st = state()
            if (st.status == "failed" || st.finished) { println("END ${st.status} ${st.failure} ${st.errors}"); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            println("MULL $format rev=${st.revision} turn=${st.turn} isMulligan=${st.isMulligan} input=${st.inputType} hand=${st.me.hand.size} lib=${st.me.libraryCount} " +
                "btn=${st.buttons.ok}/${st.buttons.okEnabled}|${st.buttons.cancel}/${st.buttons.cancelEnabled} sel=${st.selection.cards.size} min=${st.selection.min} max=${st.selection.max} " +
                "prompt=${st.prompt?.method} msg=<<${st.message.replace("\n", " / ")}>> handIds=${st.me.hand.map { it.id }} chosen=${st.selection.chosenCards} actionable=${st.selection.actionable}")
            if (st.inputType == "InputLondonMulligan") com.google.gson.JsonParser.parseString(s.call("GET", "/state", null).body()).asJsonObject.let { o ->
                println("RAW selection=${o.get("selection")} prompt=${o.get("prompt")} keys=${o.keySet()}") }
            if (!st.isMulligan) break
            when {
                st.inputType == "InputConfirmMulligan" && mulls < 2 -> { mulls++; act(st, "cancel") }
                st.inputType == "InputConfirmMulligan" -> act(st, "ok")
                st.selection.cards.isNotEmpty() -> act(st, "card", st.selection.cards.first())
                st.inputType == "InputLondonMulligan" && !st.buttons.okEnabled -> act(st, "card", st.me.hand.first { it.id !in st.selection.chosenCards }.id)
                st.buttons.okEnabled -> act(st, "ok")
                else -> { println("STUCK"); break }
            }
        }
    }
}
