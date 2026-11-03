package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.Finder
import org.junit.Assert.assertEquals
import org.junit.Test

/** The finder against the web's own answers (scripts/export-finder-golden.mjs over the finder branch). */
class FinderTest {
    private val g = JsonParser.parseString(javaClass.classLoader!!.getResource("finder-golden.json")!!.readText()).asJsonObject
    private val cards = g["cards"].asJsonArray.map { it.asJsonObject }
    private val byName = cards.flatMap { c -> val n = c["name"].asString; listOf(n to c, n.split(" // ")[0] to c) }.toMap()
    private val owned = g["owned"].asJsonObject.entrySet().associate { it.key to it.value.asInt }
    private val rarity = g["rarity"].asJsonObject.entrySet().associate { it.key to it.value.asString }
    private val lists = g["lists"].asJsonArray.map { e -> val o = e.asJsonObject
        Finder.MetaList(o["key"].asString, o["name"].asString, o["format"].asString, o["cards"].asJsonArray.map { r -> val x = r.asJsonObject; Decks.Row(x["name"].asString, x["qty"].asInt, x["board"]?.asString) },
            o["archetype"]?.asString ?: "", o["source"]?.asString ?: "", o["detail"]?.asString ?: "", o["commander"]?.asString ?: "", o["size"]?.asInt, o["trunk"]?.asBoolean ?: false) }
    private fun map(o: JsonObject?) = o?.entrySet()?.associate { it.key to it.value.asInt }

    @Test fun rulesAndCaps() {
        for (e in g["rules"].asJsonArray) { val a = e.asJsonArray; val r = a[1].asJsonObject; val k = Finder.deckRules(a[0].asString)
            assertEquals(a[0].asString, listOf(r["size"].asInt, r["copies"].asInt, r["exact"].asBoolean, r["commander"].asBoolean, r["legality"].asString), listOf(k.size, k.copies, k.exact, k.commander, k.legality)) }
        for (e in g["caps"].asJsonArray) { val a = e.asJsonArray
            assertEquals("${a[0]} ${a[1]}", a[2].asInt.let { if (it == 999999) Int.MAX_VALUE else it }, Finder.copyCap(a[0].asString, a[1].asString, byName[a[0].asString]?.getAsJsonObject("legalities"))) }
    }

    @Test fun clusters() {
        val c = Finder.clusterArchetypes(lists)
        for (e in g["clusters"].asJsonArray) { val a = e.asJsonArray; val o = a[1].asJsonObject; val k = c.of(a[0].asString)!!
            assertEquals(listOf(o["id"].asString, o["name"].asString, o["size"].asInt, o["trunk"].asBoolean), listOf(k.id, k.name, k.size, k.trunk)) }
    }

    @Test fun rows() {
        for (e in g["rows"].asJsonArray.map { it.asJsonObject }) {
            val l = lists.first { it.key == e["key"].asString }; val seals = e["seals"]?.takeIf { it.isJsonObject }?.asJsonObject?.let(::map)
            val r = Finder.finderRow(l, owned, { byName[it] }, seals) { rarity[it] ?: "" }; val o = e["out"].asJsonObject; val tag = "${l.key} $seals"
            assertEquals(tag, listOf(o["status"].asString, o["size"].asInt, o["cardsHave"].asInt, o["open"].asInt, o["want"].asInt, o["have"].asInt, o["share"].asDouble, o["complete"].asBoolean, o["enough"].asBoolean, o["cover"].asString),
                listOf(r.status, r.size, r.cardsHave, r.open, r.want, r.have, r.share, r.complete, r.enough, r.cover))
            assertEquals(tag, map(o["short"].asJsonObject), r.short)
            assertEquals(tag, o["colors"].asJsonArray.map { it.asString }, r.colors)
            assertEquals(tag, map(o["shortfall"].asJsonObject["seals"].asJsonObject), r.shortfall.seals)
            assertEquals(tag, o["shortfall"].asJsonObject["missing"].asJsonArray.map { val m = it.asJsonObject; listOf(m["name"].asString, m["need"].asInt, m["rarity"].asString, m["seal"].asString) },
                r.shortfall.missing.map { listOf(it.name, it.need, it.rarity, it.seal) })
            assertEquals(tag, o["groups"].asJsonArray.map { val x = it.asJsonObject; x["label"].asString + ":" + x["count"].asInt + ":" + x["cards"].asJsonArray.joinToString(",") { c -> val y = c.asJsonObject
                "${y["name"].asString}/${y["qty"].asInt}/${y["have"].asInt}/${y["rarity"].asString}/${y["seal"].asString}/${y["image"].asString}/${y["art"].asString}" } },
                r.groups.map { x -> x.label + ":" + x.count + ":" + x.cards.joinToString(",") { "${it.name}/${it.qty}/${it.have}/${it.rarity}/${it.seal}/${it.image}/${it.art}" } })
        }
    }

    @Test fun shares() {
        for (e in g["shares"].asJsonArray.map { it.asJsonObject }) {
            val l = lists.first { it.key == e["key"].asString }; val o = e["out"].asJsonObject
            val s = if (e.has("plain")) Finder.ownedShare(l, owned) else Finder.ownedShare(l, owned, { rarity[it] ?: "" }, map(e["seals"].asJsonObject))
            assertEquals(l.key, listOf(o["have"].asInt, o["size"].asInt, o["share"].asDouble, o["complete"].asBoolean, o["status"]?.asString), listOf(s.have, s.size, s.share, s.complete, s.status))
            if (!e.has("plain")) { assertEquals(map(o["cost"].asJsonObject), s.cost); assertEquals(map(o["short"].asJsonObject), s.short) }
        }
    }

    @Test fun ranks() {
        val seals = mapOf("c" to 20, "u" to 5, "r" to 4, "m" to 3); val c = Finder.clusterArchetypes(lists)
        for (e in g["ranks"].asJsonArray.map { it.asJsonObject }) {
            val cl = if (e["clusters"].asBoolean) c else null
            val r = Finder.rankFinderLists(lists, owned, e["sort"].asString, e["query"].asString, e["filter"].asString, { rarity[it] ?: "" }, seals, cl)
            val tag = "${e["sort"]} ${e["filter"]} ${e["query"]} ${e["clusters"]}"
            assertEquals(tag, e["keys"].asJsonArray.map { it.asString }, r.map { it.list.key })
            assertEquals(tag, e["arch"].asJsonArray.map { val a = it.asJsonObject; listOf(a["id"].asString, a["name"].asString, a["size"].asInt, a["lead"].asString, a["variants"].asJsonArray.map { v -> v.asString }) },
                Finder.finderArchetypes(r, cl).map { listOf(it.id, it.name, it.size, it.lead.list.key, it.variants.map { v -> v.list.key }) })
        }
    }
}
