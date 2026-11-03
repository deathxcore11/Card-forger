package dev.cardstashy.nativeplay.ui

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

private data class Piece(val icon: androidx.compose.ui.graphics.vector.ImageVector, val count: Int, val label: String)

private fun pieces(r: JsonObject?): List<Piece> = buildList {
    r ?: return@buildList
    r.get("coins").n().takeIf { it > 0 }?.let { add(Piece(SiteIcons.Coin, it, "coins")) }
    (r.get("seals") as? JsonObject)?.entrySet()?.forEach { (k, v) ->
        val n = v.n(); if (n > 0) SiteIcons.Seals[k]?.let { add(Piece(it, n, mapOf("c" to "common", "u" to "uncommon", "r" to "rare", "m" to "mythic")[k] ?: k)) } }
    r.get("packs").n().takeIf { it > 0 }?.let { add(Piece(SiteIcons.Pack, it, if (it == 1) "pack" else "packs")) }
}

@Composable
fun LoginRewardPopup(login: JsonObject, onDone: () -> Unit) {
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val stamp = login.get("stamp").n().coerceIn(1, 7)
    val all = pieces(login.get("reward") as? JsonObject) + pieces(login.get("monthReward") as? JsonObject)
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
    Box(Modifier.fillMaxSize().graphicsLayer { alpha = enter.value.coerceIn(0f, 1f) }.background(Color(0xCC07080B))
        .clickable(remember { MutableInteractionSource() }, null) {}, contentAlignment = Alignment.Center) {
        val shape = RoundedCornerShape(26.dp)
        Column(Modifier.padding(24.dp).widthIn(max = 380.dp).fillMaxWidth()
            .graphicsLayer { val k = .86f + .14f * enter.value; scaleX = k; scaleY = k }
            .background(Brush.verticalGradient(listOf(Color(0xFF221B12), Color(0xFF111217))), shape)
            .border(1.dp, Brush.verticalGradient(listOf(Color(0x99E9C27A), Color(0x22E9C27A))), shape)
            .padding(horizontal = 22.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("DAY $stamp OF 7", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = 1.6.sp, color = Color(0xFFB9BFC9)))
            Text("Welcome back", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, color = Color(0xFFF3E3BD)), textAlign = TextAlign.Center)
            // The week as seven quiet pips: today's glows, earlier days are filled.
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                for (i in 1..7) Box(Modifier.size(if (i == stamp) 14.dp else 10.dp).background(
                    when { i == stamp -> Color(0xFFE2B866); i < stamp -> Color(0x99D6AD64); else -> Color(0x22FFFFFF) }, CircleShape))
            }
            Row(Modifier.fillMaxWidth().graphicsLayer { translationY = -lift.value * 260f; alpha = 1f - lift.value * .9f; val k = 1f - .35f * lift.value; scaleX = k; scaleY = k },
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally)) {
                all.forEach { p ->
                    Column(Modifier.background(Color(0x14FFFFFF), RoundedCornerShape(18.dp)).border(1.dp, Color(0x33D6AD64), RoundedCornerShape(18.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(p.icon, 34.dp)
                        Text("%,d".format(p.count), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color(0xFFF3E3BD)))
                        Text(p.label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = Color(0xFFB9BFC9)))
                    }
                }
            }
            if (login.get("monthReward") is JsonObject) Text("Monthly bonus included.", style = TextStyle(fontFamily = Site.Manrope, fontSize = 13.sp, color = Color(0xFFD6AD64)))
            GoldCta("Claim", Modifier.fillMaxWidth(), enabled = !leaving) { claim() }
        }
    }
}
