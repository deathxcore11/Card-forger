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
 * Mobile table M14 (specs/mobile-table-arena-parity-brief.md): how Forge offers a planeswalker's abilities. Plays a real match
 * to Liliana of the Veil (loyalty 3: +1 and −2 can be paid, −6 cannot), taps her and prints what Forge asks and with which
 * options, then picks the first and prints what follows. Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class PlaneswalkerProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    @Test fun lilianaOffersHerAbilities() { play(false) }
    /**
     * The host change "a planeswalker's abilities are always asked": Liliana spends −2 and stands at loyalty 1, where only her
     * +1 can be paid. With the change in the bridge she still asks, with that one option and a way to cancel. Runs only on an
     * engine whose bridge has the change (ForgeHttpBridge.onPlaneswalker).
     */
    @Test fun oneAbilityIsStillAsked() {
        assumeTrue("this engine's bridge plays a single ability with no question", runCatching { Class.forName("cardstashy.forge.ForgeHttpBridge").getDeclaredMethod("onPlaneswalker", Any::class.java) }.isSuccess)
        val asked = play(true)
        org.junit.Assert.assertTrue("Liliana at loyalty 1 was tapped and asked nothing", asked.isNotEmpty())
        org.junit.Assert.assertTrue("asked with $asked", asked.all { it.size == 1 && it[0].startsWith("+1") })
    }
    /** Plays to Liliana and uses her each turn: the first option, or with [minus] her −2 first. The option lists asked while she stood at loyalty 1. */
    private fun play(minus: Boolean): List<List<String>> {
        val single = ArrayList<List<String>>()
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/current").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Swamp" to 56, "Liliana of the Veil" to 4)
        val cpu = deck("Forest" to 56, "Memnite" to 4)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", JsonArray().apply { listOf("Swamp", "Swamp", "Swamp", "Liliana of the Veil", "Swamp", "Swamp", "Swamp", "Swamp", "Swamp", "Swamp").forEach { add(it) } })
            add("villain", JsonArray().apply { listOf("Forest", "Memnite", "Forest", "Forest", "Forest", "Forest", "Forest", "Forest", "Forest").forEach { add(it) } }) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 200_000; var lastRev = -1L; var used = 0
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            if (st.status == "failed" || st.finished || st.turn > 7) { println("END ${st.status} turn=${st.turn} " + raw.take(600)); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            val lili = st.me.battlefield.firstOrNull { it.name == "Liliana of the Veil" }
            val top = st.stack.firstOrNull()
            val quiet = lili == null && st.prompt == null && top == null && st.inputType == "InputPassPriority"
            if (!quiet) {
                println("STATE rev=${st.revision} turn=${st.turn} phase=${st.phase} active=${st.activePlayer} input=${st.inputType} buttons=${st.buttons}")
                println("  stack=" + st.stack.map { "${it.id}:${it.source?.name}:ability=${it.ability}:text=<<${it.text}>>" })
                println("  sel cards=${st.selection.cards} actionable=${st.selection.actionable} players=${st.selection.players} targetPlayers=${st.selection.targetPlayers}")
                println("  MSG <<${st.message}>>")
                lili?.let { println("  LILI id=${it.id} counters=${it.counters} type=${it.type} text=<<${it.text}>>") }
                st.prompt?.let { p -> println("  PROMPT method=${p.method} supported=${p.supportedExact} min=${p.min} max=${p.max} msg=<<${p.rawMessage.ifEmpty { p.message }}>> options=${p.options.map { "${it.index}|${it.kind}|${it.label}|card=${it.cardId}" }}")
                    println("  RAWPROMPT " + com.google.gson.JsonParser.parseString(raw).asJsonObject.get("prompt")) }
                println("  EVENTS " + st.events.takeLast(5).joinToString(" | ") { e -> "${e.seq}:${e.type}:${e.card?.name ?: e.source?.name ?: ""}:${e.from ?: ""}>${e.to ?: ""}" })
            }
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null -> { addProperty("op", "reply"); addProperty("promptId", p.id)
                        if (p.method == "getAbilityToPlay" && lili?.counters?.get("LOYALTY") == 1) { single += p.options.map { it.label }; println("  ASKED AT LOYALTY 1: ${p.options.map { it.label }} cancelable=${com.google.gson.JsonParser.parseString(raw).asJsonObject.getAsJsonObject("prompt")?.get("cancelable")}") }
                        val pick = (if (minus) p.options.firstOrNull { p.method == "getAbilityToPlay" && !it.label.startsWith("+") } else null) ?: p.options.first()
                        add("indexes", JsonArray().apply { add(pick.index) }) }
                    st.inputType == "InputSelectTargets" -> { val pl = st.selection.players.firstOrNull { it != st.viewer } ?: st.selection.players.firstOrNull()
                        if (pl != null && pl !in st.selection.chosenPlayers) { addProperty("op", "player"); addProperty("id", pl) } else addProperty("op", "ok") }
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && top == null -> {
                        val next = hand.firstOrNull { it.isLand } ?: hand.firstOrNull { it.name == "Liliana of the Veil" }
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) }
                        else if (lili != null && lili.id in st.selection.actionable && used < st.turn) { used = st.turn; addProperty("op", "card"); addProperty("id", lili.id) }
                        else addProperty("op", "ok")
                    }
                    else -> addProperty("op", "ok")
                } }
            if (!quiet) println("  -> $body")
            s.call("POST", "/action", body.toString())
        }
        s.close()
        return single
    }
}
