package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.Progress
import kotlinx.coroutines.launch

/*
 * The Achievements screen, play-deeds-ui.js deedsScreenMarkup: Hall of Deeds totals, the quest book (Today, This
 * week, the weekly bonus), the DEED_TABS strip with gold ready counts, and one tab of deed cards. Every row comes
 * worked out from GET /api/progress/achievements (ACHIEVEMENTS-DATA.md); claims POST /claim. Every JSON read is
 * null-safe (the server sends JSON null for empty fields; that is what froze 0.3.x).
 */

private fun JsonElement?.str(): String? = this?.takeIf { it.isJsonPrimitive }?.asString
private fun JsonElement?.int(): Int = this?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble?.toInt() ?: 0
private fun JsonElement?.bool(): Boolean = this?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean == true
private fun JsonObject.arr(k: String) = (get(k) as? com.google.gson.JsonArray)?.mapNotNull { it as? JsonObject }.orEmpty()

private val Gold = Color(0xFFD6AD64)
private val Cream = Color(0xFFF3E3BD)
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Site.Text, line: Float = size * 1.35f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
// Light (native fix, Randall 4 Nov 10:26Z): panels and deed cards turn light, so their titles and copy follow the tokens.
private val light: Boolean get() = AppSettings.theme == "light"
private val Soft: Color get() = if (light) Site.Muted else Color(0xFFC9CED6)
private val cinzel: TextStyle get() = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 21.sp, color = if (light) Site.Text else Cream)

/** rewardIcons' aria label, the toast's words: coins, seals, packs, Collector packs, XP, in that order. */
fun rewardWords(r: JsonObject?): String {
    r ?: return ""
    val seals = (r.get("seals") as? JsonObject)?.entrySet()?.filter { it.value.int() > 0 }?.map { (k, v) -> val n = v.int(); "$n ${mapOf("c" to "common", "u" to "uncommon", "r" to "rare", "m" to "mythic")[k] ?: k} seal${if (n == 1) "" else "s"}" }.orEmpty()
    return listOfNotNull(r.get("coins").int().takeIf { it > 0 }?.let { "%,d coins".format(it) }) .plus(seals)
        .plus(listOfNotNull(r.get("packs").int().takeIf { it > 0 }?.let { "$it pack${if (it == 1) "" else "s"}" },
            r.get("collector").int().takeIf { it > 0 }?.let { "$it Collector pack${if (it == 1) "" else "s"}" },
            r.get("xp").int().takeIf { it > 0 }?.let { "%,d XP".format(it) })).joinToString(", ")
}

@Composable
internal fun RewardIcons(r: JsonObject?) {
    r ?: return
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        @Composable fun cell(icon: androidx.compose.ui.graphics.vector.ImageVector, n: Int) = Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(icon, 16.dp); Text("%,d".format(n), style = t(13f, FontWeight.ExtraBold)) }
        r.get("coins").int().takeIf { it > 0 }?.let { cell(SiteIcons.Coin, it) }
        (r.get("seals") as? JsonObject)?.entrySet()?.forEach { (k, v) -> val n = v.int(); if (n > 0) SiteIcons.Seals[k]?.let { cell(it, n) } }
        r.get("packs").int().takeIf { it > 0 }?.let { cell(SiteIcons.Pack, it) }
        r.get("collector").int().takeIf { it > 0 }?.let { cell(SiteIcons.Pack, it) }
        r.get("xp").int().takeIf { it > 0 }?.let { Text("%,d XP".format(it), style = t(13f, FontWeight.Bold, Soft)) }
    }
}

@Composable
private fun Bar(frac: Float, thin: Boolean = false, modifier: Modifier = Modifier) = Box(modifier.fillMaxWidth().height(if (thin) 5.dp else 8.dp).clip(CircleShape).background(if (light) Site.Surface2 else Color(0xFF1F2430))) {
    Box(Modifier.fillMaxWidth(frac.coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(Color(0xFFE2B866)))
}

@Composable
private fun Section(title: String, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) =
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(if (light) Color(0x94FFFFFF) else Color(0xCC0D0F14)).border(1.dp, if (light) SolidColor(Site.GlassLine) else Brush.verticalGradient(listOf(Color(0x40E9C27A), Color(0x0FE9C27A))), RoundedCornerShape(22.dp))
        .padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, style = cinzel.copy(fontSize = 20.sp)); content()
    }

@Composable
fun AchievementsRoute(onBack: () -> Unit, startTab: String? = null, nav: @Composable () -> Unit = {}) {
    BackHandler(onBack = onBack)
    val deeds by Progress.deeds.collectAsState()
    val state by Progress.state.collectAsState()
    val scope = rememberCoroutineScope()
    val view = LocalView.current
    val context = androidx.compose.ui.platform.LocalContext.current
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    var tab by rememberSaveable { mutableStateOf(startTab?.takeIf { it != "quests" } ?: "journey") }
    LaunchedEffect(Unit) { Progress.refreshDeeds() }
    // playEconClaim: one claim at a time, then the toast in the web's join order and fresh rows.
    fun claim(kind: String, id: String, step: Int?, reward: JsonObject?) {
        if (busy) return; busy = true; status = ""
        scope.launch {
            runCatching { Progress.claim(kind, id, step) }
                .onSuccess { Feel.perform(view, "reward-claim"); android.widget.Toast.makeText(context, "Claimed: ${rewardWords(reward)}.", android.widget.Toast.LENGTH_SHORT).show() }
                .onFailure { status = it.message ?: "Couldn’t claim. Try again." }
            Progress.refresh(); Progress.refreshDeeds(); busy = false
        }
    }
    // playEconReroll: the swapped quest comes back as another from the same pool.
    fun swap(level: String, kind: String?, id: String?) {
        if (busy) return; busy = true; status = ""
        scope.launch {
            runCatching { Progress.reroll(level, kind, id) }.onSuccess { Feel.perform(view, "tap") }
                .onFailure { status = when ((it as? Progress.Failure)?.code) {
                    "rerolled" -> if (kind == "weekly") "You’ve used this week’s swap." else "You’ve used today’s swap."
                    "quest_done" -> "Finished quests can’t be swapped."
                    else -> it.message ?: "Couldn’t swap. Try again." } }
            Progress.refreshDeeds(); busy = false
        }
    }
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        val d = deeds
        val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
        if (d == null) { Text("Opening your Hall of Deeds…", style = Site.Body, modifier = Modifier.align(Alignment.Center)); return@Box }
        val rows = remember(d) { d.arr("achievements") }
        val tabs = remember(d) { d.arr("tabs").map { (it.get("id").str() ?: "") to (it.get("label").str() ?: "") }.filter { it.first.isNotEmpty() } }
        val totals = d.get("totals") as? JsonObject
        val earned = totals?.get("earned").int(); val total = totals?.get("total").int(); val ready = totals?.get("ready").int()
        val quests = d.get("quests") as? JsonObject
        val shown = rows.filter { it.get("tab").str() == tab }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = top + 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item("head") {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    PageHeader("Achievements", "Play", onBack = onBack)
                    PlayMath.purse(state)?.let { PurseRow(it, {}, {}, {}, level = PlayMath.mastery(state, it.xp)) }
                }
            }
            item("sum") {
                Section("Hall of Deeds") {
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("%,d".format(earned), style = cinzel.copy(fontSize = 28.sp)); Text("/ %,d earned".format(total), style = t(16f, FontWeight.SemiBold, if (light) Site.Muted else Color(0xFFB9BFC9)), modifier = Modifier.padding(bottom = 3.dp))
                    }
                    Bar(if (total > 0) earned.toFloat() / total else 0f)
                    Text(if (ready > 0) "$ready ready to claim. Look for the gold edge."
                        else "Every count comes from real matches, log-ins, packs, the Merchant and your Trunk. Practice deeds are for honour only.", style = t(14f, color = Site.Muted))
                }
            }
            if (quests != null) item("quests") {
                Section("Quests") {
                    QuestHead("Today", quests.arr("daily"))
                    // rerollUsed: the day's swap is spent once either easy or hard was swapped (play-achievements.js).
                    val day = PlayMath.playDay(java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000)
                    val counters = state?.get("counters") as? JsonObject
                    val used = quests.get("rerollUsed").bool() || listOf("easy", "hard").any { counters?.get("d:$day:reroll_$it").int() > 0 }
                    quests.arr("daily").forEach { q ->
                        val level = q.get("level").str() ?: ""
                        val canSwap = q.get("canSwap")?.let { it.bool() } ?: (!used && level in setOf("easy", "hard") && !q.get("done").bool() && !q.get("claimed").bool())
                        QuestLine(q, busy, onSwap = if (canSwap) ({ swap(level, null, null) }) else null) { claim("daily", q.get("id").str() ?: "", null, q.get("reward") as? JsonObject) } }
                    QuestHead("This week", quests.arr("weekly"), Modifier.padding(top = 6.dp))
                    // One weekly swap a week, only on an unfinished weekly: the server says which rows can (canSwap, web 4.3.83).
                    quests.arr("weekly").forEach { q -> QuestLine(q, busy, onSwap = if (q.get("canSwap").bool()) ({ swap("weekly", "weekly", q.get("id").str()) }) else null) { claim("weekly", q.get("id").str() ?: "", null, q.get("reward") as? JsonObject) } }
                    (quests.get("weeklyAll") as? JsonObject)?.takeIf { it.get("done").bool() && !it.get("claimed").bool() }?.let { w ->
                        GoldCta("Claim the weekly bonus", Modifier.fillMaxWidth(), enabled = !busy) { claim("weekly-all", "all", null, w.get("reward") as? JsonObject) }
                    }
                }
            }
            item("tabs") {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    tabs.forEach { (k, label) ->
                        val on = k == tab; val n = rows.count { it.get("tab").str() == k && it.get("ready").bool() }
                        Row(Modifier.height(40.dp).clip(RoundedCornerShape(20.dp)).background(if (on) Color(0x26E8B95B) else Site.Surface)
                            .border(1.dp, if (on) Color(0x80E8B95B) else Site.Line, RoundedCornerShape(20.dp)).clickable { tab = k }.padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Text(label, style = t(13f, FontWeight.Bold, if (on) Site.Gold else Site.Muted))
                            if (n > 0) Box(Modifier.padding(start = 6.dp).heightIn(min = 18.dp).clip(CircleShape).background(Gold).padding(horizontal = 5.dp), contentAlignment = Alignment.Center) {
                                Text("$n", style = t(11f, FontWeight.ExtraBold, Color(0xFF1A1206))) }
                        }
                    }
                }
            }
            // pd-grid: cards at least 250 dp wide, as many columns as fit.
            item("grid") {
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val cols = maxOf(1, ((maxWidth + 14.dp) / (250.dp + 14.dp)).toInt())
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        shown.chunked(cols).forEach { line ->
                            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                line.forEach { r -> DeedCard(r, busy, Modifier.weight(1f)) { step -> claim("ach", r.get("id").str() ?: "", step, (r.arr("steps").getOrNull(step)?.get("reward") as? JsonObject)) } }
                                repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
            if (status.isNotEmpty()) item("status") { Text(status, style = t(14f, color = Color(0xFFF08A7E))) }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
}

/** One progress bar per quest book: how many of today's (or this week's) quests are finished. */
@Composable
private fun QuestHead(label: String, rows: List<JsonObject>, modifier: Modifier = Modifier) {
    val done = rows.count { it.get("done").bool() || it.get("claimed").bool() }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label.uppercase(), style = t(12f, FontWeight.Bold, Site.Muted).copy(letterSpacing = 1.2.sp), modifier = Modifier.weight(1f))
            Text("$done / ${rows.size} done", style = t(13f, FontWeight.Bold, if (rows.isNotEmpty() && done == rows.size) Gold else Soft))
        }
        Bar(if (rows.isEmpty()) 0f else done.toFloat() / rows.size)
    }
}

private val SwapIcon by lazy { androidx.compose.ui.graphics.vector.ImageVector.Builder("swap", 24.dp, 24.dp, 24f, 24f).apply {
    addPath(androidx.compose.ui.graphics.vector.PathParser().parsePathString("M4 9h12l-3-3M20 15H8l3 3").toNodes(), stroke = androidx.compose.ui.graphics.SolidColor(Color.White), strokeLineWidth = 2f,
        strokeLineCap = androidx.compose.ui.graphics.StrokeCap.Round, strokeLineJoin = androidx.compose.ui.graphics.StrokeJoin.Round) }.build() }

/** questLine: name, thin bar and have / need until done, then Claim, then Claimed; reward icons while not done. */
@Composable
private fun QuestLine(q: JsonObject, busy: Boolean, onSwap: (() -> Unit)? = null, onClaim: () -> Unit) {
    val done = q.get("done").bool(); val claimed = q.get("claimed").bool(); val need = q.get("need").int().coerceAtLeast(1); val have = q.get("have").int()
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (light) Site.Surface2.copy(alpha = .6f) else Color(0x0DFFFFFF)).border(1.dp, if (done && !claimed) Color(0x55D6AD64) else if (light) Site.GlassLine else Color(0x14FFFFFF), RoundedCornerShape(14.dp))
        .padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(q.get("label").str() ?: "", style = t(15f, FontWeight.SemiBold, Site.Text.copy(alpha = if (claimed) .6f else 1f)), modifier = Modifier.weight(1f).padding(end = 10.dp))
            when { claimed -> Text("CLAIMED", style = t(12f, FontWeight.Bold, if (light) Site.Gold else Gold).copy(letterSpacing = .7.sp))
                done -> GoldCta("Claim", enabled = !busy, onClick = onClaim)
                else -> RewardIcons(q.get("reward") as? JsonObject) }
        }
        if (!done) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Bar(have.toFloat() / need, thin = true, modifier = Modifier.weight(1f)); Text("%,d / %,d".format(have, need), style = t(13f, FontWeight.Bold, Soft))
            // pd-swap: the two-arrow swap, once a day (dailies) or once a week (weeklies), only on an unfinished quest.
            if (onSwap != null) Row(Modifier.height(32.dp).clip(CircleShape).background(Color(0x14FFFFFF)).border(1.dp, Color(0x33D6AD64), CircleShape)
                .clickable(enabled = !busy, onClick = onSwap).padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Icon(SwapIcon, 14.dp, if (light) Site.Gold else Gold); Text("Swap", style = t(12f, FontWeight.Bold, if (light) Site.Gold else Gold)) }
        }
    }
}

/** deedCard: art 16:7 (trim zooms 116 %), Cinzel title, lore, tier pips, bar and count, reward or Claim / Earned. Hidden: the back and the riddle. */
@Composable
private fun DeedCard(r: JsonObject, busy: Boolean, modifier: Modifier, onClaim: (Int) -> Unit) {
    val steps = r.arr("steps")
    val hidden = r.get("hidden").bool(); val earnedSteps = r.get("earned").int()
    val complete = r.get("complete").bool(); val honour = r.get("honour").bool()
    val readyStep = if (honour) -1 else steps.indexOfFirst { it.get("done").bool() && !it.get("claimed").bool() }
    val shape = RoundedCornerShape(18.dp)
    val edge = when { readyStep >= 0 -> Gold; complete -> Color(0x99D6AD64); else -> Color(0x29D6AD64) }
    Column(modifier.clip(shape).background(if (light) Site.Surface else Color(0xFF121318)).border(1.dp, edge, shape)) {
        if (hidden && earnedSteps == 0) {
            Box(Modifier.fillMaxWidth().aspectRatio(16f / 7f).background(Brush.radialGradient(listOf(Color(0xFF3A2A14), Color(0xFF120D08)))))
            Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Hidden", style = cinzel.copy(color = Site.Muted)); Text(r.get("riddle").str() ?: "", style = t(13f, color = Site.Muted))
            }
            return@Column
        }
        val art = r.get("art") as? JsonObject
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 7f).clip(RoundedCornerShape(0.dp)).background(Color(0xFF0C0E13))) {
            art?.get("url").str()?.let { url -> coil3.compose.AsyncImage(url, null, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader, contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().let { if (art?.get("trim").bool()) it.scale(1.16f) else it }) }
        }
        Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(r.get("title").str() ?: "", style = cinzel)
            r.get("lore").str()?.let { Text(it, style = t(13f, color = Site.Muted)) }
            if (steps.size > 1) Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                steps.forEach { s ->
                    val (fill, line) = when (s.get("tier").str()) { "bronze" -> Color(0xFFB0703C) to Color(0xFFE0A46C); "silver" -> Color(0xFFA9B3C0) to Color(0xFFE3E9F0)
                        "gold" -> Color(0xFFD6AD64) to Color(0xFFF3DFB4); "mythic" -> Color(0xFFD4552C) to Color(0xFFFF9A6A); else -> Gold to Cream }
                    val on = s.get("done").bool()
                    Box(Modifier.size(12.dp).clip(CircleShape).background(if (on) fill else if (light) Site.Surface2 else Color(0x08FFFFFF)).border(1.dp, if (on) line else if (light) Site.Line else Color(0x30FFFFFF), CircleShape))
                }
            }
            // The step shown: the one ready to claim, else the next, else the last.
            val shownIdx = if (readyStep >= 0) readyStep else steps.indexOfFirst { !it.get("done").bool() }.takeIf { it >= 0 } ?: (steps.size - 1)
            val step = steps.getOrNull(shownIdx)
            val need = step?.get("need").int()?.coerceAtLeast(1) ?: 1; val value = r.get("value").int()
            val hours = r.get("unit").str() == "h"
            Bar(minOf(1f, value.toFloat() / need), thin = true, modifier = Modifier.padding(top = 4.dp))
            Text(if (hours) "${minOf(value, need) / 60} / ${"%,d".format(need / 60)} h" else "%,d / %,d".format(minOf(value, need), need), style = t(12f, FontWeight.Bold, Site.Muted))
            Row(Modifier.fillMaxWidth().heightIn(min = 44.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                if (honour) Text(if (complete) "Earned with honour" else "Honour only", style = t(13f, FontWeight.SemiBold, Site.Muted))
                else RewardIcons(step?.get("reward") as? JsonObject)
                if (readyStep >= 0) GoldCta("Claim", enabled = !busy) { onClaim(readyStep) }
                else if (complete && !honour) Text("EARNED", style = t(12f, FontWeight.Bold, Gold).copy(letterSpacing = .7.sp))
            }
        }
    }
}
