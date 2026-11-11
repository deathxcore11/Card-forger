package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.CommanderDamage
import dev.cardstashy.nativeplay.engine.Player

/**
 * 0.4.60 Z7 (specs/table-zones-brief.md, "Commander marks"): what the table shows of a seat's commander. Every number comes from
 * Forge through the bridge (a card's "commanderTax", a player's "commanderDamage"); nothing here works a number out.
 */
internal object CommanderMarks {
    /** The commander's shield beside its player's square: the card, Forge's tax for the next cast (null: none to show) and
     *  whether the commander is on the battlefield now ("In play"). */
    data class Shield(val card: Card, val tax: Int?, val inPlay: Boolean)

    /** Losing threshold for damage from one commander (rule 903.10a); the line reads "N/21". */
    const val LETHAL = 21

    /**
     * The shield for [p]: its commander in the command zone; else on any battlefield (another player may control it), owned by [p];
     * else in [p]'s graveyard or exile; else the command zone's first card (an older snapshot without the flag). Null: nothing to show.
     */
    fun shield(p: Player, players: List<Player>): Shield? {
        val c = p.command.firstOrNull { it.commander }
            ?: players.asSequence().flatMap { it.battlefield }.firstOrNull { it.commander && it.owner == p.id }
            ?: (p.graveyard + p.exile).firstOrNull { it.commander && it.owner == p.id }
            ?: p.command.firstOrNull()
            ?: return null
        return Shield(c, c.commanderTax?.takeIf { it > 0 }, c.zone == "Battlefield")
    }

    /** The tax badge's words ("+2"), or null when Forge charges none. */
    fun taxLabel(s: Shield): String? = s.tax?.let { "+$it" }

    /** Shown by the life total in a square: at most [max], the most damage first when there are more, else in Forge's order. */
    fun damageShown(p: Player, max: Int = 2): List<CommanderDamage> =
        if (p.commanderDamage.size <= max) p.commanderDamage
        else p.commanderDamage.withIndex().sortedByDescending { it.value.damage }.take(max).sortedBy { it.index }.map { it.value }

    /** "Cmdr damage 7/21". */
    fun damageLine(d: CommanderDamage): String = "Cmdr damage ${d.damage}/$LETHAL"

    /** The crown on a battlefield tile: the card is a commander (Forge's flag) and on the battlefield. */
    fun crowned(c: Card): Boolean = c.commander && c.zone == "Battlefield"
}
