package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Mobile table M7, M13 (specs/mobile-table-arena-parity-brief.md): auras and equipment sit behind the permanent they are on, as
 * strips with their name bars ([aurasOn] feeds AuraStrips; pictures in TableLookT4ShotTest). Anything else attached, and a
 * face-down card, does not.
 */
class AttachedBehindTest {
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    @Test fun aurasAndEquipmentSitBehindTheirPermanent() {
        val host = st.me.battlefield.first { it.isCreature }
        fun on(id: Int, name: String, type: String, hidden: Boolean = false) = host.copy(id = id, name = name, type = type, attachedTo = host.id, attachments = emptyList(), hidden = hidden)
        val worn = listOf(on(900, "Ethereal Armor", "Enchantment — Aura"), on(901, "Bonesplitter", "Artifact — Equipment"), on(902, "Darksteel Garrison", "Artifact — Fortification"), on(903, "Feather of Flight", "Enchantment — Aura", hidden = true))
        val dressed = host.copy(attachments = worn.map { it.id })
        assertEquals(listOf("Ethereal Armor", "Bonesplitter"), aurasOn(dressed, { id -> worn.firstOrNull { it.id == id } }).map { it.name })
    }
}
