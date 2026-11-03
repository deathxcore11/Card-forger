package dev.cardstashy.nativeplay

import app.cash.zipline.QuickJs
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/** The Deck Forge bundle in QuickJS must answer exactly as the same bundle does in Node (scripts/export-deck-engine.mjs). */
class EngineTest {
    @Test fun trunkBuildsMatchTheWeb() {
        val golden = JsonParser.parseString(javaClass.classLoader!!.getResource("engine-golden.json")!!.readText()).asJsonArray.map { it.asJsonObject }
        val qjs = QuickJs.create()
        try {
            qjs.evaluate(File("src/main/assets/deck-engine.js").readText(), "deck-engine.js")
            for (g in golden) assertEquals(g["format"].asString, g["out"].asString, qjs.evaluate("CardStashyEngine.forgeTrunk(" + JsonPrimitive(g["input"].asString) + ")"))
        } finally { qjs.close() }
    }
}
