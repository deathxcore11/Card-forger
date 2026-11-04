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
 * Play home rebuilt one section at a time (Randall, 3 Nov 19:04Z). Sections below the ones proven on his Fold
 * are set aside, not deleted: [groups] caps how many show, and each comes back only after cold starts on the phone.
 *  C1  stops at Story (proven safe 18:56Z).
 *  C2  adds Today and Achievements (Achievements froze on JsonNull "unit"; fixed in 0.3.7, proving now).
 * Set aside for now: Packs/Forge, Decks/Collection, Merchant (groups 2, 3, 4).
 * The D pieces from the 0.3.6 bisect stay in code for reuse but are no longer on the bar.
 */
object HomeTest {
    /** Screenshots only: draw the short (sideways phone) layout on a tall test page so the whole scroll shows. */
    var forceShort: Boolean? = null
    val variants = listOf("C1", "C2")
    /** Highest group allowed in this build; raise by one per proven step. */
    private const val PROVEN = 1
    var variant by mutableStateOf("A"); private set
    private var prefs: android.content.SharedPreferences? = null
    fun init(context: Context) {
        prefs = context.getSharedPreferences("home-test", Context.MODE_PRIVATE)
        variant = "C2" // 0.3.8: proven on the Fold 19:22Z; the bar is gone
    }
    fun pick(v: String) { variant = v; prefs?.edit()?.putString("v", v)?.commit() }
    val noPictures get() = variant == "B"
    /** How many groups below Story show: 0 = none (C1, D1-D4 show only their one piece) … 4 = all. */
    /** JVM tests still compose every section, set aside or not. */
    internal var allForTests = false
    val groups get() = if (allForTests) 4 else minOf(PROVEN, when (variant) { "C1", "D1", "D2", "D3", "D4" -> 0; "C2" -> 1; "C3" -> 2; "C4" -> 3; else -> 4 })
    /** D1 the 7-day calendar as it is, D2 the calendar in plain rows, D3 the daily quests only, D4 Achievements only. */
    val piece get() = variant.takeIf { it.startsWith("D") }
}

@Composable
fun HomeTestBar() {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Home test", style = TextStyle(fontSize = 12.sp, color = Color(0xFF9AA2B1)), modifier = Modifier.padding(top = 8.dp, end = 4.dp))
        HomeTest.variants.forEach { v ->
            val on = v == HomeTest.variant; val sh = RoundedCornerShape(10.dp)
            Text(if (v == "C1") "Story only" else "+ Today & Achievements", style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (on) Color(0xFF1A1206) else Color(0xFFE6E8EC)),
                modifier = Modifier.background(if (on) Color(0xFFD6AD64) else Color(0x22FFFFFF), sh).border(1.dp, Color(0x44D6AD64), sh)
                    .clickable { HomeTest.pick(v) }.padding(horizontal = 12.dp, vertical = 6.dp))
        }
    }
}
