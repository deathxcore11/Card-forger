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
 * Randall's 15 Nov recording (specs/arena-vs-ours-gaps-1115.md): Spellbook Vendor's combat trigger with no mana open, its Sorcerer
 * Role's scry 1 on attack, second main and a CPU attack. Prints what Forge sends at each, raw where the table has no prompt.
 * Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class GapProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    private fun names(vararg n: String) = JsonArray().apply { n.forEach { add(it) } }
    @Test fun vendorScryMain2Block() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 56, "Spellbook Vendor" to 4)
        val cpu = deck("Swamp" to 56, "Memnite" to 4)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", names("Plains", "Spellbook Vendor", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains"))
            add("villain", names("Swamp", "Memnite", "Swamp", "Swamp", "Memnite", "Swamp", "Swamp", "Swamp", "Swamp", "Swamp", "Swamp", "Swamp")) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 5L)
        val until = System.currentTimeMillis() + 200_000; var lastRev = -1L; val seen = HashSet<String>()
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            if (st.status == "failed" || st.finished || st.turn > 6) { println("END ${st.status} turn=${st.turn} ${st.failure} ${st.errors}"); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            val quiet = st.inputType == "InputPassPriority" && st.stack.isEmpty() && st.phase !in setOf("MAIN2", "COMBAT_BEGIN")
            if (!quiet) {
                println("STATE rev=${st.revision} turn=${st.turn} phase=${st.phase} active=${st.activePlayer} input=${st.inputType} buttons=${st.buttons} mana=${st.me.battlefield.count { it.isLand && !it.tapped }} untapped lands")
                println("  MSG <<${st.message}>> stack=${st.stack.map { "${it.source?.name}:${it.ability}" }}")
                println("  sel min=${st.selection.min} max=${st.selection.max} cards=${st.selection.cards.map { "$it:${st.card(it)?.name}:${st.card(it)?.zone}" }} actionable=${st.selection.actionable.map { "$it:${st.card(it)?.name}:${st.card(it)?.zone}" }}")
                st.prompt?.let { p -> println("  PROMPT ${p.method} supported=${p.supportedExact} min=${p.min} max=${p.max} msg=<<${p.rawMessage.ifEmpty { p.message }}>> options=${p.options.map { "${it.index}:${it.label.take(50)}:${it.cardId}" }}") }
                if (st.inputType?.startsWith("InputPayMana") == true) println("  PAY unpayable=${dev.cardstashy.nativeplay.ui.Affordability.unpayableTrigger(st)} paying=${dev.cardstashy.nativeplay.ui.Affordability.paying(st)} payment=${com.google.gson.JsonParser.parseString(raw).asJsonObject.get("payment")} top=${st.stack.firstOrNull()?.let { "${it.controller}/${it.ability}/${it.source?.id}" }} viewer=${st.viewer} control=${st.controlMode}")
                val key = st.inputType + ":" + (st.prompt?.method ?: "")
                if ((st.inputType?.startsWith("InputConfirm") == true || st.inputType?.startsWith("InputPayMana") == true || st.phase == "MAIN2") && seen.add(key + st.turn)) {
                    val o = com.google.gson.JsonParser.parseString(raw).asJsonObject
                    println("  RAWKEYS ${o.keySet()}")
                    for (k in listOf("input", "message", "selection", "buttons", "prompt", "revealed", "shown", "tempShown", "zoom", "card")) o.get(k)?.let { println("  RAW $k = ${it.toString().take(1500)}") }
                }
            }
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val vendor = st.me.battlefield.firstOrNull { it.name == "Spellbook Vendor" }
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { add(0) }) }
                    st.inputType?.startsWith("InputPayMana") == true -> addProperty("op", if (st.me.battlefield.any { it.isLand && !it.tapped }) "ok" else "cancel")
                    st.inputType == "InputSelectTargets" -> { val pick = st.selection.cards.firstOrNull(); if (pick != null && pick !in st.selection.chosenCards) { addProperty("op", "card"); addProperty("id", pick) } else addProperty("op", "ok") }
                    st.inputType == "InputAttack" && vendor != null && !vendor.attacking && st.turn >= 3 -> { addProperty("op", "card"); addProperty("id", vendor.id) }
                    st.inputType?.startsWith("InputConfirm") == true && st.inputType != "InputConfirmMulligan" -> addProperty("op", "ok")
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && st.stack.isEmpty() -> {
                        val next = hand.firstOrNull { it.isLand } ?: hand.firstOrNull { it.name == "Spellbook Vendor" }
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) } else addProperty("op", "ok")
                    }
                    else -> addProperty("op", "ok")
                } }
            if (!quiet) println("  -> " + body)
            s.call("POST", "/action", body.toString())
        }
        s.close()
    }
}
