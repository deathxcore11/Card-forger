package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ThroughTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun c(id: Int, ctl: Int, power: Int, attacking: Boolean = false, blocks: Int? = null, kw: List<String> = emptyList()) =
        Card(id = id, zone = "Battlefield", owner = ctl, controller = ctl, hidden = false, name = "C$id", type = "Creature", manaCost = "", text = "",
            power = power, toughness = 2, tapped = false, attacking = attacking, blocking = blocks != null, damage = 0, summoningSick = false, token = false,
            counters = emptyMap(), keywords = kw, attachedTo = null, blockingIds = listOfNotNull(blocks), keywordsKnown = true)
    private fun board(mine: List<Card>, theirs: List<Card>): MatchState {
        val me = base.viewer
        return base.copy(players = base.players.map { p -> if (p.id == me) p.copy(battlefield = mine) else p.copy(battlefield = theirs.map { it.copy(owner = p.id, controller = p.id) }) })
    }

    @Test fun threeAttackersOneBlocked() {
        val them = listOf(c(1, 0, 3, attacking = true), c(2, 0, 2, attacking = true), c(3, 0, 4, attacking = true))
        val st = board(listOf(c(10, base.viewer, 1, blocks = 3)), them)
        assertEquals(Through(5, false), damageThrough(st))
    }

    @Test fun trampleMakesItAtLeast() {
        val them = listOf(c(1, 0, 3, attacking = true, kw = listOf("Trample")), c(2, 0, 2, attacking = true))
        assertEquals(Through(5, true), damageThrough(board(emptyList(), them)))
    }

    @Test fun allBlockedIsZeroAndNoAttackIsNoChip() {
        val them = listOf(c(1, 0, 3, attacking = true))
        assertEquals(Through(0, false), damageThrough(board(listOf(c(10, base.viewer, 1, blocks = 1)), them)))
        assertNull(damageThrough(board(emptyList(), listOf(c(1, 0, 3)))))
    }

    @Test fun infectNeverComesOffLife() {
        val them = listOf(c(1, 0, 3, attacking = true, kw = listOf("Infect")), c(2, 0, 2, attacking = true))
        assertEquals(Through(2, true), damageThrough(board(emptyList(), them)))
        assertNull(damageThrough(board(emptyList(), listOf(c(1, 0, 3, attacking = true, kw = listOf("Infect"))))))
    }

    @Test fun podCountsOnlyAttackersAimedAtYou() {
        val extra = base.players.first { it.id != base.viewer }.copy(id = 77, battlefield = emptyList())
        val pod = board(emptyList(), listOf(c(1, 0, 3, attacking = true))).let { it.copy(players = it.players + extra) }
        assertNull(damageThrough(pod))
    }
}
