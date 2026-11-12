package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * 0.4.60 G6 (glow-rules.md, "The ability opens on the card"): one activated ability of a card, its cost and that ability's own text,
 * split from the card's rules text (Forge's words, never ours).
 */
data class AbilityRow(val cost: String, val text: String)

/**
 * 0.4.60 G6: what the inspect view's ability rows show for one of your permanents: its abilities ([rows]), whether Forge lets you
 * activate one now ([usable]: the usable ring's own answer, Glow.usable), and, when not, the reason in place of the button
 * ([reason]: Forge's selection.blocked, the bridge's pay plan, or the card's own facts; null when none is known).
 */
data class AbilityView(val rows: List<AbilityRow>, val usable: Boolean, val reason: String?)

/**
 * The activated abilities in [card]'s rules text, one per line of the form "cost: effect", reminder text dropped. Mana abilities
 * (an effect that adds mana) are left out, as the usable ring leaves them out (glow-rules.md rule 3). Triggered lines ("When…",
 * "Whenever…", "At…") and sentences that only hold a colon are not abilities.
 */
internal fun abilityRows(card: Card): List<AbilityRow> {
    if (card.hidden) return emptyList()
    return card.text.split(Regex("\n+")).mapNotNull { raw ->
        val line = raw.replace(Regex("\\s*\\([^)]*\\)"), "").trim()
        // 0.4.60 G6 review: an activated keyword ability (Equip {2}, Crew 3...) has no colon of its own. Its row is Forge's reminder
        // text when the line carries one as "cost: effect", else the line itself as Forge wrote it (cost and words together).
        if (KEYWORD_ABILITY.containsMatchIn(line) && ':' !in line) {
            val reminder = Regex("\\(([^)]*)\\)").find(raw)?.groupValues?.get(1)?.trim()
            val j = reminder?.indexOf(':') ?: -1
            return@mapNotNull if (reminder != null && j > 0 && j < 60) AbilityRow(reminder.substring(0, j).trim(), reminder.substring(j + 1).trim()) else AbilityRow("", line)
        }
        val i = line.indexOf(':')
        if (i <= 0) return@mapNotNull null
        val cost = line.substring(0, i).trim(); val text = line.substring(i + 1).trim()
        when {
            text.isEmpty() || cost.length > 60 -> null
            Regex("^(when|whenever|at|if|as|choose)\\b", RegexOption.IGNORE_CASE).containsMatchIn(cost) -> null
            Regex("\\badd\\b", RegexOption.IGNORE_CASE).containsMatchIn(text) -> null
            else -> AbilityRow(cost, text)
        }
    }
}

/**
 * 0.4.60 G6 review: the activated keyword abilities a permanent's line can start with, which Forge writes without a colon
 * ("Equip {2}", "Crew 3", "Reconfigure {2}"). A line that is only this keyword and its cost; never a line of other keywords.
 */
private val KEYWORD_ABILITY = Regex("^(Equip|Fortify|Reconfigure|Crew|Saddle|Outlast|Level up|Station)\\b[^,;]*$", RegexOption.IGNORE_CASE)

/**
 * 0.4.60 G6: the ability rows for [card] as [st] stands, or null when the view shows none: only your own permanents on the
 * battlefield, and only when they have a (non-mana) ability in their text or Forge lets you activate one now.
 */
internal fun abilityView(card: Card, st: MatchState, live: Boolean, sc: ShortCasts = ShortCasts()): AbilityView? {
    val c = st.card(card.id)?.takeIf { it.zone == card.zone } ?: card
    if (c.zone != "Battlefield" || c.hidden || c.controller != st.viewer) return null
    val blocked = runCatching { sc.blocked(st) }.getOrDefault(emptyMap())
    val quiet = runCatching { sc.quiet(st, blocked) }.getOrDefault(emptySet())
    val usable = Glow.usable(c, st, live, blocked, quiet) == Mark.USABLE
    val rows = abilityRows(c)
    if (rows.isEmpty() && !usable) return null
    val reason = if (usable) null else st.selection.blocked[c.id] ?: blocked[c.id] ?: Glow.costOf(st, c.id)?.takeIf { Glow.planSaysNo(st, c.id) } ?: run {
        // The card's own facts: every ability taps it, and it is tapped or summoning sick.
        val taps = rows.isNotEmpty() && rows.all { "{T}" in it.cost }
        when { taps && c.tapped -> "Tapped"; taps && c.isCreature && c.summoningSick -> "Summoning sick"; else -> null }
    }
    return AbilityView(rows, usable, reason)
}

/** 0.4.60 G6 review: what a tap or pad A on a permanent wearing the usable ring does (TableScreen's onAbility). */
internal enum class AbilityPress { OPEN, ACTIVATE, CLOSE }

/**
 * The first press opens the card with its rows. On two screens the table stays in view above while it is open, so a second press
 * on the same card ([openId] is [card]) is the tag's own: A ([byPad]) activates when it can, a tap puts it down (glow-rules.md: "a
 * second tap closes"). On one screen the open view covers the table, so a press on a tile always opens.
 */
internal fun abilityPress(dual: Boolean, openId: Int?, card: Int, byPad: Boolean, canActivate: Boolean): AbilityPress = when {
    !dual || openId != card -> AbilityPress.OPEN
    byPad && canActivate -> AbilityPress.ACTIVATE
    else -> AbilityPress.CLOSE
}

private val AbilityViolet = Color(0xFFB79CFF)

/**
 * 0.4.60 G6: the ability rows in the inspect view (the preview's .abrow): a dashed violet row per ability with its cost and text
 * ({symbols} drawn by the app's set) and the gold "Activate" ([onActivate], Forge's own activation path), or the reason in place of
 * the button when it can't be used now; never a dead button. A tap on the row activates as the button does.
 * Anchors: inspectAbilities{id}, inspectAbility{id}.{i}, inspectActivate{id}.{i}.
 */
@Composable
internal fun AbilityRows(host: Card, view: AbilityView, onActivate: (() -> Unit)?, modifier: Modifier = Modifier) {
    val act = onActivate?.takeIf { view.usable }
    // Forge lets you activate an ability whose words did not split out of the text: one row with the button alone.
    val rows = view.rows.ifEmpty { if (act != null) listOf(AbilityRow("", "")) else emptyList() }
    if (rows.isEmpty()) return
    Column(modifier.fillMaxWidth().anchorRect("inspectAbilities${host.id}"), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        rows.forEachIndexed { i, r ->
            val shape = RoundedCornerShape(10.dp)
            Row(Modifier.fillMaxWidth().anchorRect("inspectAbility${host.id}.$i")
                .drawBehind {
                    val sw = 1.5.dp.toPx()
                    drawRoundRect(AbilityViolet, topLeft = androidx.compose.ui.geometry.Offset(sw / 2, sw / 2),
                        size = androidx.compose.ui.geometry.Size(size.width - sw, size.height - sw), cornerRadius = CornerRadius(10.dp.toPx()),
                        style = Stroke(sw, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 3.dp.toPx()))))
                }
                .clip(shape).background(AbilityViolet.copy(alpha = .08f))
                .then(if (act != null) Modifier.clickable(remember { MutableInteractionSource() }, null) { AbilityPick.want(host.id, r); act() } else Modifier)
                .padding(horizontal = 9.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                val inline = HashMap<String, InlineTextContent>()
                val words = buildAnnotatedString { if (r.cost.isNotEmpty()) { symbols(r.cost, inline); append(": ") }; symbols(r.text, inline) }
                if (words.isNotEmpty()) Text(words, style = TextStyle(fontFamily = Spectral, fontSize = 14.sp, lineHeight = 18.sp, color = Color(0xFFEDE6D6)),
                    inlineContent = inline, modifier = Modifier.weight(1f))
                else Box(Modifier.weight(1f))
                if (act != null) Box(Modifier.anchorRect("inspectActivate${host.id}.$i").heightIn(min = 30.dp).clip(RoundedCornerShape(999.dp))
                    .background(Brush.verticalGradient(listOf(Color(0xFFF0D48A), Color(0xFFC79A3E))))
                    .semantics { contentDescription = "Activate ${host.name}" }
                    .clickable { AbilityPick.want(host.id, r); act() }.padding(horizontal = 13.dp), contentAlignment = Alignment.Center) {
                    Text("Activate", style = sans(12.sp, FontWeight.ExtraBold, Color(0xFF1B1405)))
                }
                else if (view.reason != null) Text(view.reason, modifier = Modifier.anchorRect("inspectAbilityWhy${host.id}.$i"),
                    style = sans(12.sp, FontWeight.Bold, Color(0xFFFFB4A8)))
            }
        }
    }
}
