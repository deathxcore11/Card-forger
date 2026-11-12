package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.ui.discoveryWords
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * A card page's artist name and its "Explore types & abilities" chips (card-discovery.js A.ruleCards) as words for the app's own
 * Search tab: the same search the site runs (cardDiscoverySpec), so the tap no longer leaves for the website.
 */
class DiscoveryWordsTest {
    private fun d(kind: String, value: String, game: String = "mtg") = mapOf("act" to "ruleCards", "game" to game, "discovery-kind" to kind, "discovery-value" to value)

    @Test fun artistOpensTheirCards() = assertEquals("a:\"Jeffrey R. Busch\"", discoveryWords(d("artist", "Jeffrey R. Busch")))
    @Test fun typeIsOneTermPerWord() = assertEquals("t:\"legendary\" t:\"creature\"", discoveryWords(d("type", "Legendary Creature")))
    @Test fun timeLordIsOneType() = assertEquals("t:\"time lord\"", discoveryWords(d("type", "Time Lord")))
    @Test fun keywordSearchesTheKeyword() = assertEquals("keyword:\"flying\"", discoveryWords(d("keyword", "Flying")))
    @Test fun otherGamesAndConceptsStayWithTheSite() {
        assertNull(discoveryWords(d("artist", "Mitsuhiro Arita", "ptcg")))
        assertNull(discoveryWords(d("concept", "bloodthirst")))
        assertNull(discoveryWords(d("artist", "")))
        assertNull(discoveryWords(d("artist", "bad\"name")))
    }
}
