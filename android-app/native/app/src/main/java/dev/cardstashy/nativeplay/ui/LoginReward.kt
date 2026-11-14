package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.focus.focusProperties
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.em
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
    val enter = remember { Animatable(if (Motion.still) 1f else 0f) }
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
    // The whole screen celebrates the day (Console look, Randall's pick of 14 Nov): slow rays behind the day's number, each reward
    // on its own medal, the week as a track. One layer, drawn offscreen and faded as a whole, so nothing goes see-through on Claim.
    val context = LocalContext.current
    val still = Motion.still || remember { Playmats.reduced(context) }
    val turn = if (still) 0f else rememberInfiniteTransition(label = "rays").animateFloat(0f, 360f, infiniteRepeatable(tween(50_000, easing = LinearEasing)), label = "turn").value
    val gold = Rule.Console.CardRim
    val bonus = bonusLine(pieces(login.get("monthReward") as? JsonObject), all)
    Box(Modifier.fillMaxSize().graphicsLayer { alpha = enter.value.coerceIn(0f, 1f); compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }.background(Rule.Console.Night)
        .drawBehind {
            val c = Offset(size.width / 2, size.height * .4f); val r = size.minDimension * .75f
            drawCircle(Brush.radialGradient(listOf(gold.copy(alpha = .24f), Color.Transparent), c, r), r, c)
            rotate(turn, c) { for (i in 0 until 20) drawArc(Brush.radialGradient(0f to gold.copy(alpha = .15f), .72f to Color.Transparent, center = c, radius = r), i * 18f, 6f, true, c - Offset(r, r), Size(r * 2, r * 2)) }
        }
        .focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) {}, contentAlignment = Alignment.Center) {
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp)
            .graphicsLayer { val k = .86f + .14f * enter.value; scaleX = k; scaleY = k }, contentAlignment = Alignment.Center) {
            // A screen too short for the column (a phone on its side, the Thor's top): the day and the week at the left, the rewards and Claim at the right.
            val short = maxHeight < 470.dp
            val track = !DualScreen.active
            val medals: @Composable (Boolean) -> Unit = { small ->
                // The reward rises toward the purse on Claim.
                Box(Modifier.fillMaxWidth().graphicsLayer { translationY = -lift.value * 260f; alpha = 1f - lift.value * .9f; val k = 1f - .35f * lift.value; scaleX = k; scaleY = k }) { RewardMedals(all, small, still) }
            }
            val claim: @Composable () -> Unit = {
                if (bonus != null) Text(bonus, style = Rule.Type.sans(13, FontWeight.SemiBold, Rule.Color.GoldHair), textAlign = TextAlign.Center)
                GoldCta("Claim", Modifier.widthIn(max = 300.dp).fillMaxWidth(), enabled = !leaving) { claim() }
            }
            if (short) Row(Modifier.widthIn(max = 780.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                Column(Modifier.weight(.85f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) { RewardDay(stamp); if (track) WeekTrack(stamp) }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) { medals(true); claim() }
            } else Column(Modifier.widthIn(max = 420.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                RewardDay(stamp)
                Spacer(Modifier.height(8.dp))
                medals(false)
                if (track) { Spacer(Modifier.height(6.dp)); WeekTrack(stamp) }
                claim()
            }
        }
    }
}

/** "Monthly bonus included: 3 of the 5 packs." The month's part is named, never squeezed in as a tile of its own (butter pass B2). */
internal fun bonusLine(month: List<Piece>, all: List<Piece>): String? {
    if (month.isEmpty()) return null
    return "Monthly bonus included: " + merged(month).joinToString(", ") { m ->
        val whole = all.firstOrNull { it.icon == m.icon && it.label.removeSuffix("s") == m.label.removeSuffix("s") }
        if (whole != null && whole.count > m.count) "%,d of the %,d %s".format(m.count, whole.count, whole.label) else "%,d %s".format(m.count, m.label)
    } + "."
}

/** DAILY LOG-IN, the day's number, and one line under it. */
@Composable
private fun RewardDay(stamp: Int) = Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text("DAILY LOG-IN", style = Rule.Type.cinzel(12, Rule.Color.GoldHair).copy(letterSpacing = .3.em))
    Text("Day $stamp", Modifier.semantics { heading() }, style = Rule.Type.cinzel(34, Rule.Console.Warm).copy(shadow = Shadow(Rule.Console.CardRim.copy(alpha = .45f), Offset(0f, 4f), 30f)), textAlign = TextAlign.Center)
    Text(if (stamp >= 7) "THE WEEK IS COMPLETE" else "WELCOME BACK", style = Rule.Type.sans(12, FontWeight.Bold, Rule.Console.Soft).copy(letterSpacing = .1.em), textAlign = TextAlign.Center)
}

/**
 * Each reward on its own medal, in equal cells that share the width (each at least 80 dp, four to a row at most): a label never
 * wraps and no cell is a sliver. The medals drop in one after another; nothing around them moves.
 */
@Composable
private fun RewardMedals(all: List<Piece>, small: Boolean, still: Boolean) = BoxWithConstraints(Modifier.fillMaxWidth()) {
    val perRow = tilesPerRow(maxWidth.value, all.size)
    val rows = all.chunked(perRow)
    val cell = (maxWidth - 10.dp * (perRow - 1)) / perRow
    val medal = minOf(if (small) (if (rows.size > 1) 56.dp else 76.dp) else 88.dp, cell - 12.dp)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(if (small) 8.dp else 14.dp)) {
        var n = 0
        rows.forEach { row -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
            row.forEach { p ->
                val i = n++
                val drop = remember { Animatable(if (still) 1f else 0f) }
                LaunchedEffect(Unit) { if (!still) { kotlinx.coroutines.delay(120L + i * 110L); drop.animateTo(1f, spring(dampingRatio = .6f, stiffness = Spring.StiffnessMediumLow)) } }
                Column(Modifier.width(cell).graphicsLayer { val d = drop.value; alpha = d.coerceIn(0f, 1f); translationY = (1f - d) * -26.dp.toPx(); val k = 1.25f - .25f * d; scaleX = k; scaleY = k },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(if (small) 2.dp else 5.dp)) {
                    val rim = Rule.Console.CardRim
                    Box(Modifier.padding(6.dp).size(medal).drawBehind { drawCircle(rim.copy(alpha = .12f), size.minDimension / 2 + 6.dp.toPx()) }
                        .background(Brush.radialGradient(listOf(Rule.Console.MedalTop, Rule.Console.MedalBottom)), CircleShape).border(2.dp, rim, CircleShape), contentAlignment = Alignment.Center) {
                        Icon(p.icon, medal * .52f)
                    }
                    Text("%,d".format(p.count), maxLines = 1, softWrap = false, style = Rule.Type.sans(if (small) 20 else 24, FontWeight.ExtraBold, Rule.Console.Warm))
                    Text(p.label, maxLines = 1, softWrap = false, style = Rule.Type.sans(12, FontWeight.Bold, Rule.Console.Soft).copy(letterSpacing = .06.em))
                }
            }
        } }
    }
}

/** The week as a track of seven: the days you have are gold, today is the big one. */
@Composable
private fun WeekTrack(stamp: Int) = Row(Modifier.widthIn(max = 336.dp).fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "Day $stamp of 7" }, verticalAlignment = Alignment.CenterVertically) {
    val gold = Rule.Console.CardRim
    for (n in 1..7) {
        val on = n <= stamp; val now = n == stamp
        if (n > 1) Box(Modifier.weight(1f).height(3.dp).background(if (on) gold else Rule.Console.TrackOff))
        Box(Modifier.size(if (now) 36.dp else 26.dp).drawBehind { if (now) drawCircle(gold.copy(alpha = .25f), size.minDimension / 2 + 5.dp.toPx()) }
            .background(if (on) gold else Rule.Console.TrackDot, CircleShape).then(if (on) Modifier else Modifier.border(1.5.dp, Rule.Console.TrackRim, CircleShape)), contentAlignment = Alignment.Center) {
            Text("$n", style = Rule.Type.sans(if (now) 15 else 12, FontWeight.ExtraBold, if (on) Rule.Color.CtaInk else Rule.Console.Soft))
        }
    }
}
