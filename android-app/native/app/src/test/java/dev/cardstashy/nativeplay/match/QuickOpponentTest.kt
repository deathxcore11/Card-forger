package dev.cardstashy.nativeplay.match

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/**
 * Power-matched Quick Play (Randall 5 Nov 23:18Z: the random button "trys to match the power or slightly above or below").
 * The port repeats the site's chooseQuickOpponent pick for pick: quick-play/quick-golden.json is what play-quick-match.js and
 * power-tier.js returned in Node for the same pool and the same stream of random numbers (Easy, Normal and Hard with streaks,
 * a small sample, Commander brackets, an unrated deck). Then 1000 draws a difficulty with a seeded RNG: the Wild Card share
 * stays near 1 in 8, the CPU never gets your own list, harder levels draw stronger decks, and a Commander CPU stays within one
 * bracket of yours.
 */
class QuickOpponentTest {
    private val golden = JsonParser.parseString(javaClass.classLoader!!.getResource("quick-play/quick-golden.json")!!.readText()).asJsonObject
    private val decks = golden.getAsJsonObject("decks")
    private fun list(k: String) = decks.getAsJsonArray(k).map { it.asJsonObject }
    private fun JsonObject.n(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asDouble
    private val rate: suspend (List<JsonObject>) -> List<QuickOpponent.Ctx?> = { l -> l.map { QuickOpponent.Ctx(it.n("power0"), it.n("b0")?.toInt()) } }

    @After fun clear() = QuickPower.reset()

    @Test fun sameAsTheSite() = runBlocking {
        val numbers = golden.getAsJsonArray("random").map { it.asDouble }
        val modern = list("modern"); val cmd = list("cmd")
        val me = decks.getAsJsonObject("me"); val mine = decks.getAsJsonObject("mine"); val unrated = decks.getAsJsonObject("unrated")
        for (c in golden.getAsJsonArray("cases").map { it.asJsonObject }) {
            var at = c["from"].asInt
            val (player, pool) = when (c["name"].asString) {
                "modern" -> me to modern + me
                "small-sample" -> me to modern
                "commander" -> mine to cmd
                else -> unrated to modern
            }
            val r = QuickOpponent.choose(player, pool, eligible = { true }, difficulty = c["difficulty"].asString, random = { numbers[at++] },
                streak = c["streak"].asInt, sample = c["sample"].asInt, rate = rate)
            val what = "${c["name"].asString} ${c["difficulty"].asString} from ${c["from"].asInt}"
            assertEquals("$what: random numbers used", c["to"].asInt, at)
            assertEquals("$what: pick", c["pick"].asString, r.deck["id"].asString)
            assertEquals(what, c["candidateCount"].asInt, r.candidateCount)
            assertEquals(what, c["estimated"].asBoolean, r.estimated)
            assertEquals(what, c["wildCard"].asBoolean, r.wildCard)
            assertEquals(what, c["power"].takeIf { !it.isJsonNull }?.asDouble, r.power)
            assertEquals(what, c["bracket"].takeIf { !it.isJsonNull }?.asInt, r.bracket)
            assertEquals(what, c["myPower"].takeIf { !it.isJsonNull }?.asDouble, r.myPower)
            assertEquals(what, c["mirror"].asBoolean, r.mirror)
            assertEquals(what, c["reason"].asString, r.reason)
            assertEquals(what, c["line"].asString, r.line)
        }
    }

    private fun deck(i: Int, power: Double?, arch: String, format: String = "Modern", bracket: Int? = null) = JsonObject().apply {
        addProperty("id", "x$i"); addProperty("name", "$arch · $i"); addProperty("format", format); power?.let { addProperty("power0", it) }; bracket?.let { addProperty("b0", it) }
        if (format == "Commander") addProperty("commander", "Leader $i")
        add("cards", JsonArray().apply { add(JsonObject().apply { addProperty("name", "Card $i"); addProperty("qty", 4) }); add(JsonObject().apply { addProperty("name", "Filler"); addProperty("qty", 56) }) })
    }

    @Test fun thousandDraws() = runBlocking {
        val arch = listOf("Burn", "Control", "Elves", "Tron", "Affinity", "Storm")
        val rnd = java.util.Random(20261106)
        // A wide pool: 120 lists from Casual to Tier 1, your own list among them twice (once under another record).
        val me = deck(0, 72.0, "Burn")
        val pool = (1..120).map { deck(it, 15.0 + rnd.nextInt(85), arch[it % arch.size]) } + me + me.deepCopy().apply { addProperty("id", "copy") }
        val mean = HashMap<String, Double>()
        for (level in listOf("Easy", "Medium", "Hard")) {
            val r = java.util.Random(level.hashCode().toLong())
            var wild = 0; var sum = 0.0; var gap = 0.0; var tame = 0
            repeat(1000) {
                val m = QuickOpponent.choose(me, pool, eligible = { true }, difficulty = level, random = r::nextDouble, rate = rate)
                assertFalse("never your own list", m.mirror || m.deck["name"].asString == me["name"].asString)
                assertTrue(m.estimated)
                if (m.wildCard) wild++ else { tame++; gap += m.power!! - 72.0 }
                sum += m.power!!
            }
            mean[level] = sum / 1000
            assertTrue("$level Wild Card share ${wild / 10.0}%", wild in 80..150)
            println("$level: mean ${"%.1f".format(sum / 1000)}, matched mean gap ${"%+.1f".format(gap / tame)}, wild $wild")
        }
        assertTrue("Easy draws weaker than Normal: $mean", mean["Easy"]!! < mean["Medium"]!!)
        assertTrue("Hard draws stronger than Normal: $mean", mean["Hard"]!! > mean["Medium"]!!)
        // Normal aims at your own rank: the matched picks average close to your Power.
        assertTrue("Normal centres on you: $mean", abs(mean["Medium"]!! - 72.0) < 8)
    }

    @Test fun streakLeans() = runBlocking {
        val rnd = java.util.Random(5)
        val me = deck(0, 60.0, "Burn")
        val pool = (1..80).map { deck(it, 10.0 + rnd.nextInt(90), "List$it") }
        suspend fun avg(streak: Int): Double { val r = java.util.Random(9); return (1..600).map { QuickOpponent.choose(me, pool, { true }, random = r::nextDouble, streak = streak, rate = rate).power!! }.average() }
        val down = avg(-15); val even = avg(0); val up = avg(15)
        assertTrue("losses lean weaker, wins stronger: $down $even $up", down < even && even < up)
    }

    @Test fun commanderStaysWithinOneBracket() = runBlocking {
        val me = deck(0, 55.0, "Mine", "Commander", bracket = 2)
        val pool = (1..60).map { deck(it, 20.0 + (it * 7) % 75, "C$it", "Commander", bracket = 1 + it % 5) }
        val r = java.util.Random(3)
        repeat(1000) {
            val m = QuickOpponent.choose(me, pool, { true }, random = r::nextDouble, rate = rate)
            assertTrue("bracket ${m.bracket}", m.bracket!! in 1..3)
            assertTrue(m.line, m.line.contains("Bracket ${m.bracket} " + PowerTier.BRACKET_NAMES[m.bracket]))
        }
    }

    @Test fun unratedFallsBackToRandomAndErrorsAreTheSites() = runBlocking {
        val me = deck(0, null, "Burn")
        val pool = (1..10).map { deck(it, 50.0, "L$it") }
        val m = QuickOpponent.choose(me, pool, { true }, rate = rate)
        assertFalse(m.estimated); assertNull(m.power); assertEquals("", m.line)
        assertTrue(m.reason, m.reason.startsWith("Picked at random from 10 decks in your format."))
        fun fails(block: suspend () -> Unit) = runCatching { runBlocking { block() } }.exceptionOrNull()?.message
        assertEquals("Your selected deck needs play-support review before Quick Play.", fails { QuickOpponent.choose(me, pool, { it !== me }) })
        assertEquals("No compatible CPU deck is available in this format yet. Choose another source in Practice.", fails { QuickOpponent.choose(me, pool.map { it.deepCopy().apply { addProperty("format", "Legacy") } }, { true }) })
        assertEquals("Quick Play needs a different deck for the CPU in this format. Load Precons or Meta, or pick the CPU deck in Practice.", fails { QuickOpponent.choose(me, listOf(me), { true }) })
        assertEquals("Choose a CPU difficulty.", fails { QuickOpponent.choose(me, pool, { true }, difficulty = "Insane") })
    }

    @Test fun matchupWords() {
        fun res(power: Double?, mine: Double?, wild: Boolean = false, bracket: Int? = null) = QuickOpponent.Result(JsonObject(), 1, true, wild, power, bracket, mine, false, "", "Medium")
        assertEquals("Tier 2 · 84 · You’re the underdog", res(84.0, 70.0).line)
        assertEquals("Wild Card · Tier 1 · 93 · You’re the underdog", res(93.0, 61.0, wild = true).line)
        assertEquals("Bracket 3 Upgraded · 72 · Even match", res(72.0, 69.0, bracket = 3).line)
        assertEquals("Casual · 41 · You’re favoured", res(41.0, 70.0).line)
        assertEquals("Tier 3 · 60", res(60.0, null).line)
        assertEquals("", res(null, 70.0).line)
    }

    @Test fun powerReadsAreKeptAndSharedAndBounded() = runBlocking {
        QuickPower.reset()
        val asked = mutableListOf<Int>()
        val slow = CompletableDeferred<Unit>()
        QuickPower.paused = { false }
        QuickPower.engine = { _, d ->
            asked += d.size
            if (d.any { it["id"].asString == "slow" }) slow.await()
            JsonArray().apply { d.forEach { x -> add(JsonObject().apply { addProperty("power", x["power0"]?.asDouble ?: 0.0); add("bracket", null) }) } }
        }
        val a = (1..25).map { deck(it, 40.0 + it, "A") }
        val first = QuickPower.rate("Modern", a, System.currentTimeMillis() + 5000)
        assertEquals((1..25).map { 40.0 + it }, first.map { it!!.power })
        assertEquals("ten lists a call", listOf(10, 10, 5), asked)
        asked.clear()
        // Kept: the same lists again ask nothing.
        assertEquals(first, QuickPower.rate("Modern", a.map { it.deepCopy() }, System.currentTimeMillis() + 5000)); assertTrue(asked.isEmpty())
        // A read not in by the deadline is unrated now and kept when it lands.
        val s = deck(99, 77.0, "S").apply { addProperty("id", "slow") }
        assertNull(QuickPower.rate("Modern", listOf(s), System.currentTimeMillis() + 200).single())
        slow.complete(Unit)
        var later: QuickOpponent.Ctx? = null
        repeat(50) { if (later == null) { later = QuickPower.rate("Modern", listOf(s), System.currentTimeMillis() + 100).single(); if (later == null) Thread.sleep(20) } }
        assertEquals(77.0, later!!.power!!, 0.0)
    }
}
