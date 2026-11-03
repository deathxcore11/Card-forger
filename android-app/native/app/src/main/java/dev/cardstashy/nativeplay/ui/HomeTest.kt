package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Test build only: the freeze A/B on the phone. Randall picks a variant at the top of Play home; it is
 * kept across restarts so each one is tried from a cold start.
 *  A  the normal page.
 *  B  the same sections with no pictures at all: no art, no pack wrappers, no set icons, no ambient
 *     background, no shadows.
 *  C1..C5  pictures on, sections added one group at a time below Story: C1 stops at Story, C2 adds
 *     Today and Achievements, C3 adds Packs and the Forge, C4 adds decks and collection, C5 adds the Merchant.
 */
object HomeTest {
    val variants = listOf("A", "B", "C1", "C2", "C3", "C4", "C5")
    var variant by mutableStateOf("A"); private set
    private var prefs: android.content.SharedPreferences? = null
    fun init(context: Context) {
        prefs = context.getSharedPreferences("home-test", Context.MODE_PRIVATE)
        variant = prefs?.getString("v", "A") ?: "A"
    }
    fun pick(v: String) { variant = v; prefs?.edit()?.putString("v", v)?.commit() }
    val noPictures get() = variant == "B"
    /** How many groups below Story show: 0 = none (C1) … 4 = all (C5, A, B). */
    val groups get() = when (variant) { "C1" -> 0; "C2" -> 1; "C3" -> 2; "C4" -> 3; else -> 4 }
}

@Composable
fun HomeTestBar() {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Freeze test", style = TextStyle(fontSize = 12.sp, color = Color(0xFF9AA2B1)), modifier = Modifier.padding(top = 8.dp, end = 4.dp))
        HomeTest.variants.forEach { v ->
            val on = v == HomeTest.variant; val sh = RoundedCornerShape(10.dp)
            Text(v, style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (on) Color(0xFF1A1206) else Color(0xFFE6E8EC)),
                modifier = Modifier.background(if (on) Color(0xFFD6AD64) else Color(0x22FFFFFF), sh).border(1.dp, Color(0x44D6AD64), sh)
                    .clickable { HomeTest.pick(v) }.padding(horizontal = 12.dp, vertical = 6.dp))
        }
    }
}
