package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.focus.focusProperties
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.launch

/*
 * The day's log-in reward as a one-time pop-up (Randall 3 Nov 20:21Z): the calendar is off the home page. The server
 * stamps and pays the day on POST /api/progress/login (fresh: true only on the first visit of the day); Claim plays the
 * landing (haptic, the reward lifting toward the purse) and closes. Shape: {day, stamp 1..7, month, reward, monthReward}.
 */

private fun JsonElement?.n(): Int = this?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt ?: 0

internal data class Piece(val icon: androidx.compose.ui.graphics.vector.ImageVector, val count: Int, val label: String)

/** Butter pass B2 (Randall 14 Nov, "how shifty that pop up was"): the day's packs and the monthly bonus packs were two tiles and
 *  the fourth tile was crushed to a sliver. Same reward, one tile: 2 packs + 3 packs = 5 packs. */
internal fun merged(all: List<Piece>): List<Piece> = all.groupBy { it.icon to it.label.removeSuffix("s") }.values.map { g ->
    val n = g.sumOf { it.count }; val base = g.first().label.removeSuffix("s")
    Piece(g.first().icon, n, if (base == "pack" || base == "coin") (if (n == 1) base else base + "s") else g.first().label) }

private fun pieces(r: JsonObject?): List<Piece> = buildList {
    r ?: return@buildList
    r.get("coins").n().takeIf { it > 0 }?.let { add(Piece(SiteIcons.Coin, it, "coins")) }
    (r.get("seals") as? JsonObject)?.entrySet()?.forEach { (k, v) ->
        val n = v.n(); if (n > 0) SiteIcons.Seals[k]?.let { add(Piece(it, n, mapOf("c" to "common", "u" to "uncommon", "r" to "rare", "m" to "mythic")[k] ?: k)) } }
    r.get("packs").n().takeIf { it > 0 }?.let { add(Piece(SiteIcons.Pack, it, if (it == 1) "pack" else "packs")) }
}

/** How many reward tiles fit a row [widthDp] wide: each at least 80 dp (room for "uncommon") with 10 dp gaps, four at most. */
internal fun tilesPerRow(widthDp: Float, count: Int): Int = ((widthDp + 10f) / 90f).toInt().coerceIn(1, 4).coerceAtMost(count.coerceAtLeast(1))

@Composable
fun LoginRewardPopup(login: JsonObject, week: List<dev.cardstashy.nativeplay.play.PlayRules.Reward> = emptyList(), onDone: () -> Unit) {
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val stamp = login.get("stamp").n().coerceIn(1, 7)
    val all = merged(pieces(login.get("reward") as? JsonObject) + pieces(login.get("monthReward") as? JsonObject))
    val enter = remember { Animatable(0f) }
    val lift = remember { Animatable(0f) }
    var leaving by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { enter.animateTo(1f, spring(dampingRatio = .72f, stiffness = Spring.StiffnessMediumLow)) }
    fun claim() {
        if (leaving) return; leaving = true
        Feel.perform(view, "reward-claim")
        scope.launch {
            // The reward rises toward the purse at the top, then the sheet fades away.
            lift.animateTo(1f, tween(520))
            enter.animateTo(0f, tween(180)); onDone()
        }
    }
    BackHandler { claim() }
    // Controller: X claims, and so does B (back claims here). The backdrop only swallows taps, so focus skips it.
    PadScreen(PadActs(x = PadAct("Claim") { claim() }, b = "Claim", opaque = true))
    // Bottom screen (W3): the reward stays on top; the week moves to the bottom as seven day tiles, each with what that day pays
    // (the rules' log-in week, LOGIN_WEEK on the site).
    BottomScreen {
        ShowcaseCase("Daily log-in", "Day $stamp of 7", scroll = false) {
            Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                for (i in 1..7) {
                    val today = i == stamp; val past = i < stamp
                    val tile = RoundedCornerShape(Rule.Radius.Panel)
                    val pays = week.getOrNull(i - 1)?.let { r -> buildList {
                        if (r.coins > 0) add(Piece(SiteIcons.Coin, r.coins, "coins"))
                        r.seals.forEach { (k, n) -> if (n > 0) SiteIcons.Seals[k]?.let { add(Piece(it, n, k)) } }
                        if (r.packs > 0) add(Piece(SiteIcons.Pack, r.packs, "packs")) } } ?: emptyList()
                    Column(Modifier.weight(1f).fillMaxHeight().clip(tile).background(if (today) Rule.Color.GoldEdge else if (past) Rule.Color.Glass else Color.Transparent)
                        .border(1.dp, if (today) Rule.Color.CtaTop else Rule.Color.Edge, tile).padding(vertical = 14.dp), horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("DAY", style = Rule.Type.sans(11, FontWeight.Bold, Rule.Color.Muted))
                        Text("$i", style = Rule.Type.cinzel(34, if (today) Rule.Color.CtaTop else if (past) Rule.Color.Text else Rule.Color.Muted))
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically)) {
                            pays.forEach { p -> Column(Modifier.alpha(if (past) .45f else 1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(p.icon, 28.dp); Text("%,d".format(p.count), style = Rule.Type.sans(14, FontWeight.ExtraBold, Rule.Color.Text)) } }
                        }
                        Text(if (past) "✓" else if (today) "Today" else " ", style = Rule.Type.sans(12, FontWeight.Bold, Rule.Color.Gold))
                    }
                }
            }
            Text(if (leaving) (if (stamp >= 7) "The week is complete." else "Come back tomorrow for day ${stamp + 1}.")
                else "Today: " + all.joinToString(", ") { "%,d ${it.label}".format(it.count) } + ".", style = Rule.Type.S15.copy(color = CaseMuted))
        }
    }
    // One layer for scrim and card: drawn offscreen and faded as a whole, the card never goes see-through over the page on Claim.
    Box(Modifier.fillMaxSize().graphicsLayer { alpha = enter.value.coerceIn(0f, 1f); compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }.background(Color(0xCC07080B))
        .focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) {}, contentAlignment = Alignment.Center) {
        val shape = RoundedCornerShape(26.dp)
        Column(Modifier.padding(24.dp).widthIn(max = 380.dp).fillMaxWidth()
            .graphicsLayer { val k = .86f + .14f * enter.value; scaleX = k; scaleY = k }
            .background(Brush.verticalGradient(listOf(Color(0xFF221B12), Color(0xFF111217))), shape)
            .border(1.dp, Brush.verticalGradient(listOf(Color(0x99E9C27A), Color(0x22E9C27A))), shape)
            .padding(horizontal = 22.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (!DualScreen.active) Text("DAY $stamp OF 7", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = 1.6.sp, color = Color(0xFFB9BFC9)))
            Text("Welcome back", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, color = Color(0xFFF3E3BD)), textAlign = TextAlign.Center)
            // The week as seven quiet pips: today's glows, earlier days are filled. On two screens the week is on the bottom.
            if (!DualScreen.active) Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                for (i in 1..7) Box(Modifier.size(if (i == stamp) 14.dp else 10.dp).background(
                    when { i == stamp -> Color(0xFFE2B866); i < stamp -> Color(0x99D6AD64); else -> Color(0x22FFFFFF) }, CircleShape))
            }
            // Equal tiles that share the width (each at least 80 dp, four to a row at most); a label never wraps.
            androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth().graphicsLayer { translationY = -lift.value * 260f; alpha = 1f - lift.value * .9f; val k = 1f - .35f * lift.value; scaleX = k; scaleY = k }) {
            val perRow = tilesPerRow(maxWidth.value, all.size)
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                all.chunked(perRow).forEach { row -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
                    row.forEach { p ->
                        Column(Modifier.weight(1f).widthIn(max = 104.dp).background(Color(0x14FFFFFF), RoundedCornerShape(18.dp)).border(1.dp, Color(0x33D6AD64), RoundedCornerShape(18.dp))
                            .padding(horizontal = 6.dp, vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(p.icon, 34.dp)
                            Text("%,d".format(p.count), maxLines = 1, softWrap = false, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color(0xFFF3E3BD)))
                            Text(p.label, maxLines = 1, softWrap = false, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = Color(0xFFB9BFC9)))
                        }
                    }
                    repeat(perRow - row.size) { if (all.size > perRow) androidx.compose.foundation.layout.Spacer(Modifier.weight(1f)) }
                } }
            }
            }
            if (login.get("monthReward") is JsonObject) Text("Monthly bonus included.", style = TextStyle(fontFamily = Site.Manrope, fontSize = 13.sp, color = Color(0xFFD6AD64)))
            GoldCta("Claim", Modifier.fillMaxWidth(), enabled = !leaving) { claim() }
        }
    }
}
