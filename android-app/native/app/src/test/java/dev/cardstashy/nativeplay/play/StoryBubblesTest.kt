package dev.cardstashy.nativeplay.play

import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Test

class StoryBubblesTest {
    private val battle = JsonParser.parseString("""{"hero":{"who":"you"},"villain":{"who":"archers"},"cues":{"villain":{"start":"Bows up.","low":"Fall back!","win":"Go home.","loss":"The forest remembers."}}}""").asJsonObject
    private val state = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!

    @Test fun startSaysOnceAndOnlyAfterTurnOne() {
        val b = StoryBubbles(battle, "hero")
        assertEquals(emptyList<String>(), b.update(state.copy(turn = 0)).map { it.text })
        assertEquals(listOf("Bows up."), b.update(state.copy(turn = 1, players = state.players.map { it.copy(life = 20) })).map { it.text })
        assertEquals(emptyList<String>(), b.update(state.copy(turn = 2, players = state.players.map { it.copy(life = 20) })).map { it.text })
    }

    @Test fun finishUsesTheOtherSidesLine() {
        assertEquals(listOf("The forest remembers."), StoryBubbles(battle, "hero").finish(true).map { it.text })
        assertEquals(listOf("Go home."), StoryBubbles(battle, "hero").finish(false).map { it.text })
    }
}
