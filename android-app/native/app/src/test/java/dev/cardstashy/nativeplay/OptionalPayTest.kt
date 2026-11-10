package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Affordability
import org.junit.Assert.assertEquals
import org.junit.Test

/** specs/match-table-master.md OPTIONAL PAY TRIGGERS (Randall 10 Nov, Spellbook Vendor "you may pay {1}" with no mana). */
class OptionalPayTest {
    private val vendor = """{"id":70,"zone":"Battlefield","owner":1,"controller":1,"hidden":false,"name":"Spellbook Vendor","type":"Creature — Human Peasant","manaCost":"{1}{W}","text":"At the beginning of combat on your turn, you may pay {1}.","tapped":false}"""
    private val plains = """{"id":40,"zone":"Battlefield","owner":1,"controller":1,"hidden":false,"name":"Plains","type":"Basic Land — Plains","manaCost":"","text":"({T}: Add {W}.)","tapped":TAPPED}"""

    private fun st(tapped: Boolean, actionable: String, top: String, cancel: Boolean = true) = MatchState.parse("""{"status":"running","viewer":1,"turn":9,
        "message":"Pay Mana Cost: {1}","inputType":"InputPayManaOfCostPayment",
        "buttons":{"ok":"Auto","okEnabled":${!tapped},"cancel":"Cancel","cancelEnabled":$cancel},
        "payment":{"remaining":"{1}","forCard":{"kind":"card","id":70,"name":"Spellbook Vendor"}},
        "stack":[$top],
        "players":[{"id":1,"isViewer":true,"zones":{"Battlefield":{"cards":[$vendor,${plains.replace("TAPPED", "$tapped")}]}},"mana":{}},{"id":2,"zones":{}}],
        "selection":{"actionable":[$actionable]}}""")!!

    private val trigger = """{"id":5,"text":"At the beginning of combat on your turn, you may pay {1}.","source":$vendor,"activatingPlayer":1,"ability":true}"""

    @Test fun unpayableOwnTriggerIsDeclinedForYou() {
        assertEquals("Spellbook Vendor", Affordability.unpayableTrigger(st(tapped = true, actionable = "", top = trigger)))
    }

    @Test fun aPayableOneStillAsks() {
        assertEquals(null, Affordability.unpayableTrigger(st(tapped = false, actionable = """{"kind":"card","id":40}""", top = trigger)))
    }

    @Test fun aSpellOrAMandatoryCostIsNeverCancelledForYou() {
        val spell = trigger.replace("\"ability\":true", "\"ability\":false")
        assertEquals(null, Affordability.unpayableTrigger(st(tapped = true, actionable = "", top = spell)))
        assertEquals(null, Affordability.unpayableTrigger(st(tapped = true, actionable = "", top = trigger, cancel = false)))
    }
}
